# -*- coding: utf-8 -*-
"""
個人専用ニュースアプリ — 収集スクリプト（Phase 4.5：データ/表示の分離）

feeds.json に書かれたフィードを取得・整形・フィルタし、結果を data.json に出力する。
表示（HTML描画）は index.html + app.js がブラウザ側で data.json を読んで行う。

設計方針:
- 取れたものだけ出力する（1つのフィードが失敗しても全体は止めない）
- 取得ゼロ件・エラーは fetch.log に記録して後から分かるようにする
- 自動要約はしない（RSSの見出し＋リード文をそのまま使う）
- 秘密のフィードURLはコードにも feeds.json にも書かず、環境変数（.env / Secrets）から渡す

使い方:
    pip install -r requirements.txt
    python build_news.py        # → data.json を生成
"""

import datetime
import html
import json
import os
import re
import socket
import unicodedata
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse, parse_qs, quote

import feedparser

# このスクリプトのあるフォルダ（出力先・設定・.env の基準）
BASE_DIR = Path(__file__).resolve().parent


def load_env(path: Path) -> None:
    """簡易 .env ローダ（外部ライブラリ不要）。

    `KEY=VALUE` 形式の行を os.environ に読み込む。すでに環境変数が
    設定済みの場合（GitHub Actions の Secrets 等）はそちらを優先する。
    秘密のURLをコードに直書きせず、ローカルは .env、CIは Secrets で渡すため。
    """
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


# フィードを組み立てる前に .env を読み込む（無ければ何もしない）
load_env(BASE_DIR / ".env")

# ----------------------------------------------------------------------------
# 設定ファイル・出力先
# ----------------------------------------------------------------------------

FEEDS_FILE = BASE_DIR / "feeds.json"     # フィード定義（編集はここ）
PAYWALL_FILE = BASE_DIR / "paywall.json"  # 有料媒体リスト（編集はここ）
OUTPUT_DATA = BASE_DIR / "data.js"       # 生成物（表示用データを JS に埋め込む）
LOG_FILE = BASE_DIR / "fetch.log"        # 取得ログ（追記）
ARCHIVE_FILE = BASE_DIR / "archive.json"  # これまでに見つけた記事の蓄積（消さずに貯める）

# 1テーマあたり蓄積しておく上限。超えたら配信日の古いものから捨てる。
# ※ 既読かどうかは収集側から分からないため、未読でも古ければ捨てられる。
#    テーマごとに feeds.json の "keep" で変更できる（人物テーマは到達しないことが多い）。
ARCHIVE_MAX_PER_GROUP = 500


def load_archive(path: Path):
    """これまでに見つけた記事の蓄積を読む。無ければ空。

    形式: { "テーマ名": [ {記事…, "first_seen": ISO日時}, ... ] }
    毎回ゼロから取り直すと、未読のまま消えてしまう記事が出るため貯めておく。
    """
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}  # 壊れていても全体は止めず、作り直す


def save_archive(path: Path, archive) -> None:
    path.write_text(json.dumps(archive, ensure_ascii=False, indent=1), encoding="utf-8")


def merge_into_archive(archive, group_name, items, now_iso, cap=None):
    """今回取得した記事を蓄積へ統合する。

    - すでにある記事（同じURL）は残し、first_seen を保つ
    - 新しい記事には first_seen（初めて見つけた日時）を付ける
      → これが「NEW」判定の根拠になる（記事の配信日ではなく、アプリに入ってきた日）
    """
    old_items = archive.get(group_name, [])
    by_link = {}
    for a in old_items:
        if a.get("link"):
            by_link[a["link"]] = a

    for a in items:
        link = a.get("link")
        if not link:
            continue
        if link in by_link:
            # 既にある記事：初めて見つけた日時は維持し、中身だけ最新に更新する
            a["first_seen"] = by_link[link].get("first_seen", now_iso)
        else:
            a["first_seen"] = now_iso
        by_link[link] = a

    # 見出しでも重複をまとめる。
    # Googleの中継URLは日によって変わるため、URLだけでは同じ記事を見分けられない
    #（実測：同じ hicbc.com の記事が別URLで3件貯まっていた）。
    merged = dedupe_by_title(list(by_link.values()))
    # 新しい順に整え、上限を超えた分は古いものから捨てる
    merged.sort(key=lambda x: x.get("dt") or "", reverse=True)
    archive[group_name] = merged[:(cap or ARCHIVE_MAX_PER_GROUP)]
    return archive[group_name]


def better_record(a, b):
    """同じ記事の2件から、残す方を選ぶ。

    直リンクのほうが読者にとって扱いやすく（中継URLを経由しない）、
    有料判定を実ページで確認済みの記録も価値が高い。
    """
    def score(x):
        n = 0
        if x.get("link") and "news.google.com" not in x["link"]:
            n += 2
        if x.get("pwv"):
            n += 1
        return n
    return a if score(a) >= score(b) else b


def dedupe_by_title(items):
    """見出しが同じ記事を1件にまとめる（元の並び順は保つ）。

    初めて見つけた日時は古いほうを引き継ぐ。
    新しいほうに合わせると、まとめた瞬間にNEWが再点灯してしまうため。
    """
    best = {}
    order = []
    for a in items:
        key = normalize_title(a.get("title") or "")
        if not key:
            order.append((False, a))   # 見出しが取れないものはそのまま残す
            continue
        if key not in best:
            best[key] = a
            order.append((True, key))
        else:
            cur = best[key]
            seen = [x.get("first_seen") for x in (cur, a) if x.get("first_seen")]
            keep = better_record(cur, a)
            if seen:
                keep["first_seen"] = min(seen)
            best[key] = keep
    return [best[v] if is_key else v for is_key, v in order]


def load_paywall(path: Path):
    """有料媒体リストを読む。無ければ空（判定しない）。

    返り値: {"paid": [語句...], "partial": [語句...]}
    """
    if not path.exists():
        return {"paid": [], "member": [], "partial": []}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {
        "paid": [s.lower() for s in data.get("paid", [])],
        "member": [s.lower() for s in data.get("member", [])],
        "partial": [s.lower() for s in data.get("partial", [])],
    }


PAYWALL = load_paywall(PAYWALL_FILE)


# 記事ページを実際に見て有料か確かめる設定（直リンクの記事のみ）
VERIFY_PAYWALL = True     # False にすると媒体リストだけの判定に戻る
VERIFY_TIMEOUT = 8        # 1記事あたりの待ち時間（秒）
VERIFY_WORKERS = 8        # 同時に確かめる数
VERIFY_MAX_BYTES = 400_000  # 読み込む最大バイト数（重いページ対策）

# 「お金を払わないと読めない」と断定できる文言（誤検出を避けるため強い表現だけ）
PAID_TEXT_MARKERS = [
    "有料会員限定", "有料記事です", "この記事は有料", "有料会員になると",
    "続きは有料", "有料プラン", "定期購読", "購読者限定",
    "プレミアム会員限定", "有料版",
]

# 「登録・ログインすれば読める」もの。無料だが、そのままでは本文が読めない。
MEMBER_TEXT_MARKERS = [
    "会員限定記事", "この記事は会員限定", "会員限定コンテンツ",
    "無料会員登録", "会員登録が必要", "会員登録すると", "会員登録して",
    "続きは会員登録", "続きを読むには会員", "続きを読むにはログイン",
    "ログインが必要です", "登録して続きを読む", "ログインしてください",
    "読者会員", "登録会員限定", "メンバーシップ限定",
]


def verify_paywall(link: str):
    """記事ページを実際に取得して、本文が読めるかを判定する。

    返り値: "paid"（有料）/ "member"（登録すれば読める）/ ""（無料と確認）
            / None（判定できず＝媒体リストに任せる）

    Googleニュースの中継URLは実記事に解決できないので対象外。

    ※以前は isAccessibleForFree が true なら即「無料」と決めていたが、
      申告は true のまま本文を隠す媒体があり、会員限定の取りこぼしが出ていた。
      そこで文言の検査を先に行い、そちらを優先する。
    """
    if not link:
        return None
    host = urlparse(link).netloc.lower()
    # 中継URL・動画は確かめても意味がないので飛ばす
    if "news.google.com" in host or "youtube.com" in host or "youtu.be" in host:
        return None
    try:
        req = urllib.request.Request(link, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=VERIFY_TIMEOUT) as r:
            html_text = r.read(VERIFY_MAX_BYTES).decode("utf-8", "ignore")
    except Exception:
        return None  # 取れなければ判定せず、媒体リストの推測に任せる

    # 1) 断定できる文言を最優先（サイトの申告より、実際に出ている表示を信じる）
    if any(k in html_text for k in PAID_TEXT_MARKERS):
        return "paid"
    if any(k in html_text for k in MEMBER_TEXT_MARKERS):
        return "member"
    # 2) 文言が無ければ schema.org の申告を使う
    m = re.search(r'isAccessibleForFree"?\s*:\s*"?(\w+)', html_text)
    if m:
        return "" if m.group(1).lower() == "true" else "paid"
    return None


def classify_paywall(via: str, link: str, via_host: str = "") -> str:
    """記事が読めない媒体かを判定して "paid" / "member" / "partial" / "" を返す。

    Googleニュース経由の記事はリンクが中継URLで実サイトが分からない。
    ただしRSSの source タグには発信元サイト（例: https://mainichi.jp）が入っているので、
    そのドメイン（via_host）も判定材料に加える。
    配信元名だけに頼ると「日経」と「日本経済新聞」のような表記違いで取りこぼすため。
    """
    hay = " ".join([via or "", link or "", via_host or ""]).lower()
    if not hay.strip():
        return ""
    for key in ("paid", "member", "partial"):  # 重い順に見る
        for word in PAYWALL[key]:
            if word and word in hay:
                return key
    return ""


# ----------------------------------------------------------------------------
# テーマ・エンジン
#   feeds.json に「検索語(topic)」を書くだけで、複数の検索型ソースへ自動展開する。
#   1テーマ=1フィードでは拾えない「深く・広く」を、無料の検索RSSの束で実現する。
# ----------------------------------------------------------------------------

SOURCE_TEMPLATES = {
    # Googleニュース検索（日本語）。検索エンジンが関連度を担保するので require は不要。
    "gnews_ja": {
        "url": "https://news.google.com/rss/search?q={q}&hl=ja&gl=JP&ceid=JP:ja",
        "label": "Googleニュース",
        "backfill": True,   # after:/before: で過去に遡れる
        "opts": {"gnews": True, "ng_only": True},
    },
    # Googleニュース検索（インド英語版）。海外テーマの現地報道用。
    # 英語見出しに日本語NGワードは無意味＆"Amazon"(Prime配信ニュース等)を誤爆するため無フィルタ。
    "gnews_in": {
        "url": "https://news.google.com/rss/search?q={q}&hl=en-IN&gl=IN&ceid=IN:en",
        "label": "海外報道",
        "english": True,
        "backfill": True,
        "opts": {"gnews": True},
    },
    # はてなブックマーク「タイトル」検索（新着順）。個人ブログ/note の深掘り層。
    # 本文検索(text)は「本文で一言触れただけ」の無関係記事が大半だったため、
    # タイトルに含む記事だけに絞る（実測で精度が段違い）。
    # ブログの深掘り記事は古くても価値があるので、鮮度上限だけ1年に緩和。
    "hatebu": {
        "url": "https://b.hatena.ne.jp/search/title?q={q}&mode=rss&sort=recent",
        "label": "ブログ/はてブ",
        "opts": {"alert": True, "require_in": "text", "max_age_days": 365},
    },
}


def split_topic(raw: str):
    """検索語を「検索クエリ」と「必須語（素の語）」に分ける。

    - すでに "..." で囲まれている → そのまま完全一致検索に使う
    - 空白を含む（例: アクアワールド 大洗） → 複数語のAND検索とみなし、囲まない。
      この場合そのままでは必須語にできないので、必須語は空にする（自動補完しない）
    - それ以外（例: 吉村昭） → 完全一致検索にするため囲む

    戻り値: (検索クエリ, 必須語にできる素の語／できなければ空文字)
    """
    raw = str(raw).strip()
    if len(raw) >= 2 and raw.startswith('"') and raw.endswith('"'):
        return raw, raw[1:-1]
    if " " in raw or "　" in raw:
        return raw, ""
    return f'"{raw}"', raw


def require_words(raw: str):
    """検索語から「見出しに含むべき語」を作る。

    以前は空白を含む検索語（例: アクアワールド 大洗）だと必須語が空になり、
    見出しの判定が丸ごと効かなくなっていた（「小林氏、引き続き要職に」等が混入した原因）。
    "..." で囲んだ語はひとまとまりの語として、それ以外は単語ごとに必須語にする。
    """
    raw = str(raw).strip()
    if len(raw) >= 2 and raw.startswith('"') and raw.endswith('"'):
        return [raw[1:-1]]
    return [w for w in re.split(r"[\s　]+", raw) if w]


# テーマ型で sources を省略したときに使うソース
DEFAULT_SOURCES = ["gnews_ja", "hatebu"]


def expand_topic(entry):
    """テーマ型エントリを、ソースごとの仮想フィードのリストに展開する。

    最小の書き方は { "topic": "吉村昭" } だけ。
    name / sources / require は検索語から自動で補う（明示された値が優先）。
      → 「吉村昭（Googleニュース）」「吉村昭（ブログ/はてブ）」の2フィードになる
    """
    quoted, plain = split_topic(entry.get("topic", ""))
    name = entry.get("name") or plain
    sources = entry.get("sources") or DEFAULT_SOURCES

    feeds = []
    for key in sources:
        tpl = SOURCE_TEMPLATES.get(key)
        if tpl is None:
            # 未知のソース名：全体は止めず、診断に出るだけの空フィードにする
            feeds.append({"name": f"{name}（{key}）", "url": "",
                          "skip_reason": f"未知のソース: {key}"})
            continue
        # 英語系ソースは topic_en を優先。必須語も英語側に合わせないと全滅するため、
        # 検索語とセットで切り替える。
        if tpl.get("english") and entry.get("topic_en"):
            q, plain_for_require = split_topic(entry["topic_en"])
        else:
            q, plain_for_require = quoted, plain

        feed = {
            "name": f"{name}（{tpl['label']}）",
            # group（表示上のテーマ名）：複数ソースを1つの見出しに束ねるための鍵
            "group": entry.get("group", name),
            "url": tpl["url"].format(q=quote(q)),
            **tpl.get("opts", {}),
        }
        # require（必須語）は、書かれていなければ検索語から自動で補う。
        # Googleニュース検索は「関連記事」として検索語を含まない無関係な記事を
        # 混ぜてくることがあるため、既定で効かせて誤混入を防ぐ。
        # 意図的に無効化したいテーマは feeds.json で "require": [] と書く。
        if "require" in entry:
            if entry["require"]:
                feed["require"] = entry["require"]
        else:
            source_raw = entry["topic_en"] if (tpl.get("english") and entry.get("topic_en"))                 else entry.get("topic", "")
            words = require_words(source_raw)
            if words:
                feed["require"] = words
        if entry.get("exclude"):
            feed["exclude"] = entry["exclude"]
        # 記事の重み付け（⑥）：優先したい語・後ろに回したい語
        for key in ("prefer", "demote", "blog_last", "keep"):
            if key in entry:
                feed[key] = entry[key]
        # 蓄積が少ないときに過去へ遡るための材料（囲む前の検索語を持つ）
        if tpl.get("backfill"):
            feed["backfill"] = {"url": tpl["url"], "q": q}
        # 鮮度の上限。テーマ側の指定はソース既定より優先する
        # （例: 近藤紘一のように新着が少ない人物は長めにする）
        if "max_age_days" in entry:
            feed["max_age_days"] = entry["max_age_days"]
        feeds.append(feed)

    # サイトを指定した検索（ニュース以外の情報源を名指しで探す）
    # 例: { "topic": "近藤紘一", "sites": ["1101.com", "note.com"] }
    news_tpl = SOURCE_TEMPLATES["gnews_ja"]
    for site in (entry.get("sites") or []):
        q_site = f"{quoted} site:{site}"
        site_feed = {
            "name": f"{name}（{site}）",
            "group": entry.get("group", name),
            "url": news_tpl["url"].format(q=quote(q_site)),
            # サイトで絞り込み済みなので、見出しに検索語があることまでは求めない。
            # 求めると「本文で語っているブログ記事」がすべて落ちてしまう。
            "site_search": True,
            **news_tpl.get("opts", {}),
            "backfill": {"url": news_tpl["url"], "q": q_site},
        }
        for key in ("exclude", "prefer", "demote", "blog_last", "keep"):
            if key in entry and entry[key] != []:
                site_feed[key] = entry[key]
        # 自動で作る必須語は使わないが、明示された必須語は効かせる
        # （「生成AI」のような広いテーマは、絞らないと何でも入ってしまうため）
        if entry.get("require"):
            site_feed["require"] = entry["require"]
        feeds.append(site_feed)
    return feeds


def load_feeds(path: Path):
    """feeds.json を読み、{カテゴリ名: [feed, ...]} の形に整える。

    各 feed は次のいずれかの形:
      A) URL型   : name(必須) / url または url_env / type("video") / alert / require / exclude
      B) テーマ型: name(必須) / topic(検索語) / sources(ソース名の配列) / topic_en / require / exclude
         → SOURCE_TEMPLATES に従い複数の仮想フィードへ展開される
    url が無く url_env がある場合は、その名前の環境変数から実URLを解決する
    （秘密のアラートURLを公開ファイルに書かないため）。
    """
    data = json.loads(path.read_text(encoding="utf-8"))
    feeds_by_cat = {}
    for cat in data.get("categories", []):
        items = []
        for f in cat.get("feeds", []):
            if f.get("topic"):
                items.extend(expand_topic(f))
                continue
            feed = dict(f)  # 元データを壊さないようコピー
            if not feed.get("url") and feed.get("url_env"):
                feed["url"] = os.environ.get(feed["url_env"], "")
            feed.setdefault("url", "")
            # URL型フィードは既定で自分自身が1つのテーマ（group）になる
            feed.setdefault("group", feed["name"])
            items.append(feed)
        feeds_by_cat[cat["name"]] = items

    # サイト指定検索は見出し一致を求めないぶん、他テーマの記事が紛れ込む
    # （例: note を「近藤紘一」で探すと、沢木耕太郎の記事が混じる）。
    # 「別のテーマ名が見出しにあり、自分のテーマ名は無い」ものは落とす。
    names = {f.get("group") or f.get("name")
             for items in feeds_by_cat.values() for f in items}
    names.discard(None)
    for items in feeds_by_cat.values():
        for f in items:
            mine = f.get("group") or f.get("name")
            f["other_topics"] = sorted(n for n in names if n != mine)
    return feeds_by_cat


# 取得・表示に関する調整値
TIMEOUT_SEC = 10        # 1フィードあたりの取得タイムアウト
MAX_ITEMS_PER_FEED = 60   # 1フィードから取り込む上限（重複除去の前に切らないため多めに）
# ※ 以前は1テーマ30件だけを data.js に載せていた。その結果、貯めた記事の
#    73%が画面に届かず、読み切っても「すべて読み終えました」と出ていた。
#    収集側は選ばず全件を渡し、出す量は表示側（既読を知っている側）が決める。
SUMMARY_MAX_LEN = 120   # リード文の最大文字数

# ----------------------------------------------------------------------------
# ノイズ対策（多層フィルタ）の設定
#   主に Googleアラート（"alert": true のフィード）に適用する。
#   ITmedia・茨城新聞・YouTube など信頼できるフィードには余計なフィルタをかけない。
# ----------------------------------------------------------------------------

# 除外する発信元サイト（実URLのドメインに含まれたら捨てる）。通販・SNS等のノイズ源。
BLOCK_DOMAINS = [
    "rakuten.co.jp", "rakuten.com", "books.rakuten",
    "amazon.co.jp", "amazon.com",
    "mercari.com", "auctions.yahoo", "shopping.yahoo",
    "x.com", "twitter.com",  # アラートが拾うSNS/リアルタイム検索
]

# NGワード（タイトル＋リード文のどこかに含まれたら捨てる）
NG_WORDS = [
    "電子書籍", "通販", "セール", "クーポン", "リアルタイム検索",
    "楽天ブックス", "Amazon", "最安", "ポイント還元",
    "＜画像",  # Googleニュースの画像ギャラリー別ページ（同一記事の分身）
    # 記事本体ではなく写真・プロフィールのページに飛ぶもの
    "の画像", "（写真・画像", "| 写真 |", "｜写真｜", "写真提供＝",
    "のプロフィール", "フォトギャラリー", "関連画像",
    "求人・転職情報", "の求人",  # 技術テーマに混じる求人広告
    "タグ記事一覧", "の記事まとめ",  # noteのタグ一覧など、記事本体でないページ
]

# 配信元名（via）で除外する低品質なサイト。
# Googleニュース経由の記事は実URLが分からずドメイン判定が効かないため、名前で弾く。
BLOCK_SOURCES = [
    "mshale",              # 動画転載のスパム的サイト（無関係な語がタイトルに混じる）
    "pasquale pillitteri",
]

# 話題性が低くなりがちな記事を「消さずに後ろへ回す」ための語。
# 例：楽曲がテレビ番組で流れただけの記事は、本人の出演やインタビューより価値が低い。
# 消すと拾い漏れが怖いので、順番を下げるだけにする（テーマごとに demote で追加できる）。
DEMOTE_WORDS = [
    "BGM", "挿入歌", "主題歌", "劇中歌", "使用曲", "テーマソング",
    "エンディングテーマ", "オープニングテーマ", "セットリスト",
    "流れた曲", "今日の一曲", "今日の1曲", "カラオケランキング", "着信音",
    # 本人ではなく、他人が演奏・歌唱しただけのもの
    "演奏してみた", "弾いてみた", "歌ってみた", "ものまね", "アマチュア",
    # 写真ページなど（今後は取り込まないが、既に貯まっている分を後ろへ回すため）
    "関連画像", "フォトギャラリー", "写真・画像",
]


def compute_rank(text: str, prefer, demote) -> int:
    """記事の並び順の重みを返す（-1 前へ / 0 普通 / 1 後ろへ）。

    後回しの語を優先の語より強くしている。
    「コンサート」のような語は本人の出演でも他人の演奏会でも当たってしまい、
    優先を強くすると『アマチュア音楽家が名曲を披露』のような記事が先頭に来るため。
    """
    if any(w in text for w in demote):
        return 1
    if prefer and any(w in text for w in prefer):
        return -1
    return 0

# タイトル末尾に「(英数字10文字前後)」が付くもの（転載サイト特有のID）
JUNK_TITLE_PATTERN = re.compile(r"\([0-9A-Za-z_-]{8,14}\)\s*$")

# これより古い記事は表示しない。既読管理を入れたので、時間での足切りは緩めにする
# （未読なら古くても読みたいため）。テーマ個別に max_age_days で上書きできる。
MAX_AGE_DAYS = 365

# 記事が少ないテーマは、期間を広げてもう一度探す
# （例：故人の作家など新着が出ない相手でも、未読なら古い記事を読みたいため）
THIN_THRESHOLD = 3       # これ未満しか取れなかったら「少ない」とみなす
THIN_MAX_AGE_DAYS = 3650  # そのとき遡る日数（約10年）

# ---- 過去へ遡って補充する（バックフィル）----
# 検索は「最近のもの」しか返さないため、期間を区切って何度も聞き直さないと
# 昔の記事は出てこない。Googleニュース検索は after:/before: に対応している
# （実測：「沢木耕太郎 after:2010-01-01 before:2013-01-01」で2010〜2012年の記事を取得）。
# 蓄積が少ないテーマだけを対象にするので、毎朝の取得が重くなりすぎることはない。
# 記事の少ないテーマで、ニュース以外にも自動で当たる情報源。
# Googleニュース検索は site: 指定に対応しており、報道以外のページも索引にある
# （実測：「"近藤紘一" site:note.com」で54件。ニュース検索だけでは5件だった）。
DEFAULT_DEEP_SITES = ["note.com", "hatenablog.com", "1101.com"]

BACKFILL_TARGET = 40   # 蓄積がこの件数に届かないテーマは過去を掘る
BACKFILL_YEARS = 20    # 何年前まで遡るか
BACKFILL_SLICE = 4     # 何年ずつ区切って聞くか


def backfill_ranges(now_year: int):
    """過去へ遡るための期間（新しい区間から順）を作る。"""
    ranges = []
    end = now_year
    oldest = now_year - BACKFILL_YEARS
    while end > oldest:
        start = max(end - BACKFILL_SLICE, oldest)
        ranges.append((f"{start}-01-01", f"{end}-01-01"))
        end = start
    return ranges

# 一部サーバ対策のためブラウザ風 User-Agent を名乗る
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


# ----------------------------------------------------------------------------
# ユーティリティ
# ----------------------------------------------------------------------------

def strip_html(text: str) -> str:
    """RSSのリード文に混じるHTMLタグを除去して整形する。"""
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", "", text)      # タグを除去
    text = html.unescape(text)               # &amp; などを元の文字へ
    text = re.sub(r"\s+", " ", text).strip()  # 連続する空白を1つに
    return text


def truncate(text: str, limit: int) -> str:
    """長すぎるリード文を limit 文字で省略する。"""
    return text if len(text) <= limit else text[:limit] + "…"


# 表示に使う時刻はすべて日本時間で揃える（実行環境の時計に左右されないため）
JST = datetime.timezone(datetime.timedelta(hours=9))

# 日時不明な記事を末尾に回すための比較用の最小値（aware）
DT_MIN = datetime.datetime.min.replace(tzinfo=datetime.timezone.utc)


def entry_datetime(entry):
    """記事の公開日時を UTC aware の datetime で返す（取れなければ None）。"""
    for key in ("published_parsed", "updated_parsed"):
        t = entry.get(key)
        if t:
            # time.struct_time（UTC）→ aware datetime
            return datetime.datetime(*t[:6], tzinfo=datetime.timezone.utc)
    return None


def extract_views(entry):
    """YouTubeエントリから再生回数を取り出す（取れなければ None）。

    YouTubeのRSSには media:community/media:statistics に views が入っている。
    追加のAPIを呼ばずに済む。
    """
    st = entry.get("media_statistics")
    if isinstance(st, dict):
        try:
            return int(st.get("views"))
        except (TypeError, ValueError):
            return None
    return None


def extract_thumbnail(entry) -> str:
    """YouTubeエントリからサムネイル画像URLを取り出す（なければ空文字）。"""
    thumbs = entry.get("media_thumbnail")  # [{'url': ...}, ...]
    if thumbs and isinstance(thumbs, list):
        return thumbs[0].get("url", "")
    return ""


# ---- ノイズ対策（多層フィルタ）のための補助関数 ----

def clean_link(url: str) -> str:
    """Googleアラートの中継URL（google.com/url?...）を実URLに復元する。

    それ以外のURLはそのまま返す。リンクが綺麗になり、発信元ドメイン判定も可能になる。
    """
    if not url:
        return url
    p = urlparse(url)
    if "google.com" in p.netloc and p.path.startswith("/url"):
        qs = parse_qs(p.query)
        for key in ("url", "q"):  # 実URLは url= か q= に入っている
            if qs.get(key):
                url = qs[key][0]
                break
    return strip_page_number(url)


def strip_page_number(url: str) -> str:
    """記事の「9ページ目」等へのリンクを1ページ目に直す。

    分割記事の途中から始まると読みにくいうえ、同じ記事が別ページとして
    重複してしまうため、ページ指定を取り除いてから扱う。
    """
    if not url:
        return url
    # ?page=9 / &p=3 のような指定だけを消す（他の条件は壊さない）
    parts = urlparse(url)
    if parts.query:
        keep = [kv for kv in parts.query.split("&")
                if kv.split("=")[0].lower() not in ("page", "p", "pagenum", "page_num")]
        url = parts._replace(query="&".join(keep)).geturl()
    # /article/12345/3 のように末尾がページ番号のもの（2〜99）も落とす
    url = re.sub(r"/([2-9]|[1-9]\d)/?$", "/", url)
    return url


def is_blocked_domain(url: str) -> bool:
    """実URLのドメインが除外リストに該当するか。"""
    net = urlparse(url).netloc.lower()
    return any(b in net for b in BLOCK_DOMAINS)


# 個人が書いている場（報道機関ではない）と判断するドメイン
BLOG_DOMAINS = [
    "hatenablog", "hatenadiary", "note.com", "ameblo.jp", "livedoor.blog",
    "fc2.com", "blogspot", "wordpress.com", "qiita.com", "zenn.dev",
    "medium.com", "substack.com", "seesaa.net", "exblog.jp", "goo.ne.jp",
]


# 会社が運営しているブログ。個人の書き物と読み方が違うので分けて印を付ける。
# （並び順は変えない。技術テーマでは企業のテックブログも十分に役立つため）
CORP_BLOG_PATTERN = re.compile(
    r"株式会社|有限会社|Tech\s?Blog|テックブログ|開発者ブログ|Engineering|Engineer\s?Blog|"
    r"公式|Developers|Developer\s?Blog|Corp|Inc\.")


def looks_like_corp(via: str, title: str) -> bool:
    return bool(CORP_BLOG_PATTERN.search((via or "") + " " + (title or "")))


def looks_like_blog(link: str, via_host: str = "") -> bool:
    """リンクか発信元ドメインが、個人が書く場のものか。"""
    hay = urlparse(link or "").netloc.lower() + " " + (via_host or "").lower()
    return any(d in hay for d in BLOG_DOMAINS)


def is_personal_blog(feed, link: str, via_host: str = "") -> bool:
    """個人ブログ・note などの「素人記事」かどうか。

    はてブ検索から来たものと、ブログ系ドメインを個人発信とみなす。
    報道と区別して印を付けるためのもので、除外はしない。

    ※Googleニュース経由の記事はリンクが中継URLなので、リンクだけ見ても
      note やはてなブログだと分からない。発信元ドメイン（via_host）も見る。
    """
    if "b.hatena.ne.jp" in (feed.get("url") or ""):
        return True
    return looks_like_blog(link, via_host)


# 見出しの文字種を見分けるための判定
HANGUL_RE = re.compile(r"[가-힯ᄀ-ᇿ]")          # ハングル
JAPANESE_RE = re.compile(r"[぀-ヿ一-鿿]")        # ひらがな・カタカナ・漢字


def is_foreign_title(title: str) -> bool:
    """日本語で書かれていない見出しか。

    サイト指定検索は見出し一致を求めないぶん、同じ書き手が多言語で出している
    記事まで拾ってしまう（近藤紘一に韓国語版・英語版が混じっていた）。
    ハングルを含むもの、または冒頭に日本語が1文字も無いものを外す。
    """
    title = title or ""
    if HANGUL_RE.search(title):
        return True
    return not JAPANESE_RE.search(title[:30])


def is_blocked_source(via: str, title: str) -> bool:
    """配信元名や、転載サイト特有のタイトルの型で低品質な記事を弾く。

    Googleニュース経由の記事は実URLが分からないため、ドメインではなく
    配信元名（via）で判定する必要がある。
    """
    v = (via or "").lower()
    if any(w in v for w in BLOCK_SOURCES):
        return True
    if JUNK_TITLE_PATTERN.search(title or ""):
        return True
    return False


def passes_keywords(require_hay: str, text: str, require, exclude) -> bool:
    """必須語/NG語による判定。

    - require（必須語）は require_hay に対して判定。
      通常はタイトルのみ（本文まで見ると関連リンク等で拾いすぎる）。
      ブログ系ソースは require_in:"text" によりタイトル＋リード文が渡ってくる。
    - exclude（NG語）は タイトル＋リード文（text）で判定
    """
    if require and not any(r in require_hay for r in require):
        return False  # 必須語が無ければ捨てる
    if exclude and any(ng in text for ng in exclude):
        return False  # NG語が含まれていれば捨てる
    return True


def normalize_title(title: str) -> str:
    """重複判定用にタイトルを正規化する。

    1) 末尾の「 - サイト名」「｜サイト名」を落とす（同一記事が別媒体で出る対策）
    2) 空白・記号を除去し、英字は小文字化（\\W は Unicode では日本語を残す）
    """
    base = re.sub(r"\s*[|｜\-–—]\s*[^|｜\-–—]*$", "", title)  # 末尾の媒体名を除去
    base = base or title
    # 全角と半角を揃える（「２０２６年」と「2026年」を同じ記事とみなすため）
    base = unicodedata.normalize("NFKC", base)
    return re.sub(r"[\s\W_]+", "", base, flags=re.UNICODE).lower()


# 重複とみなす「先頭一致」の最小文字数。これ以上共通なら同一記事とみなす。
DUP_PREFIX_MIN = 14


# 見出しの似ている度合いがこの値以上なら同一記事とみなす
# （実データで検証：0.75 で言い換え記事だけを拾い、別ニュースの誤マージは0件）
DUP_SIMILARITY = 0.75


def title_bigrams(norm: str):
    """正規化済みの見出しを2文字ずつに刻んだ集合にする（類似度の計算用）。"""
    return set(norm[i:i + 2] for i in range(len(norm) - 1))


def similarity(a_grams, b_grams) -> float:
    """2つの見出しの重なり具合（0〜1）。共通部分 ÷ 全体で求める。"""
    if not a_grams or not b_grams:
        return 0.0
    return len(a_grams & b_grams) / len(a_grams | b_grams)


def is_duplicate_title(norm: str, seen_titles) -> bool:
    """既出タイトルとの重複判定。

    完全一致に加え、**一方が他方の先頭部分**なら同一記事とみなす
    （例：「…沢木耕太郎著」と「…沢木耕太郎著（写真・画像 1/1）」＝配信社違いの同じ書評）。
    短いタイトルの誤マージを避けるため、共通部分が DUP_PREFIX_MIN 文字以上のときだけ適用。
    """
    if not norm:
        return False
    grams = title_bigrams(norm)
    for s in seen_titles:
        if norm == s:
            return True
        # 一方が他方の先頭部分（末尾に装飾が付いただけの同一記事）
        if min(len(norm), len(s)) >= DUP_PREFIX_MIN and (norm.startswith(s) or s.startswith(norm)):
            return True
        # 言い換えられた見出しでも、重なり具合が高ければ同一記事とみなす
        if len(norm) >= DUP_PREFIX_MIN and len(s) >= DUP_PREFIX_MIN:
            if similarity(grams, title_bigrams(s)) >= DUP_SIMILARITY:
                return True
    return False


# ----------------------------------------------------------------------------
# 天気と株価
#   どちらも「取れなければ黙って消える」。ニュースの取得を止めない。
# ----------------------------------------------------------------------------

JMA_URL = "https://www.jma.go.jp/bosai/forecast/data/forecast/{area}.json"
STOCK_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{code}?range=5d&interval=1d"


def get_json(url: str, timeout: int = 12):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def weather_icon(text: str) -> str:
    """天気の文章から絵文字を選ぶ。

    気象庁は時間帯別の天気を出していないので、アイコンは1日単位。
    「くもり時々雨」のように複数入るため、影響の大きいものから順に見る。
    """
    t = text or ""
    if "雪" in t:
        return "❄️"
    if "雷" in t:
        return "⛈"
    if "雨" in t:
        return "☔"
    if "くもり" in t or "曇" in t:
        return "☁️"
    if "晴" in t:
        return "☀️"
    return "🌤"


def fetch_weather(cfg):
    """気象庁の公開データから、今日と明日の天気を取る。

    公式が出しているJSONで、APIキーも登録も要らない（継続コストゼロの条件を満たす）。
    形が変わることもあるので、取れたところだけ返して残りは空にする。
    """
    if not cfg or not cfg.get("area"):
        return None
    try:
        data = get_json(JMA_URL.format(area=cfg["area"]))
    except Exception as e:
        print(f"天気: 取得できず（{type(e).__name__}）")
        return None

    out = {"place": cfg.get("point") or "", "days": []}
    try:
        series = data[0]["timeSeries"]
        # 天気の文章（今日・明日・明後日）
        wx = next(t for t in series if "weathers" in t["areas"][0])
        w_times = wx["timeDefines"]
        w_texts = wx["areas"][0]["weathers"]
        out["office"] = data[0].get("publishingOffice", "")
        w_codes = wx["areas"][0].get("weatherCodes") or []
        # 降水確率は6時間ごと（00-06 / 06-12 / 12-18 / 18-24）。
        # 時間帯別の天気は公開されていないので、通勤・退勤の目安はこれで補う。
        pops = {}
        for t in series:
            if "pops" not in t["areas"][0]:
                continue
            for when, val in zip(t["timeDefines"], t["areas"][0]["pops"]):
                pops.setdefault(when[:10], {})[when[11:13]] = val
        # 気温。地点名（水戸など）が一致するものを選ぶ
        temps_by_time = {}
        for t in series:
            if "temps" not in t["areas"][0]:
                continue
            area = next((a for a in t["areas"]
                         if a["area"]["name"] == out["place"]), t["areas"][0])
            for when, val in zip(t["timeDefines"], area["temps"]):
                temps_by_time.setdefault(when[:10], []).append(val)
        for when, text in list(zip(w_times, w_texts))[:2]:
            day = when[:10]
            vals = [int(v) for v in temps_by_time.get(day, []) if str(v).lstrip("-").isdigit()]
            # 気象庁の文章は区切りに空白が入る（「くもり　時々　雨　所により…」）。
            # 詰めて1行にし、一目で分かる前半だけ short に持たせる。
            full = re.sub(r"[\s　]+", "", text)
            short = re.split(r"所により|ところにより", full)[0] or full
            hi = max(vals) if vals else None
            lo = min(vals) if vals else None
            out["days"].append({
                "date": day,
                "text": full,
                "short": short[:14],
                "icon": weather_icon(full),
                "max": hi,
                "min": lo if (lo is not None and hi is not None and lo != hi) else None,
                "pops": pops.get(day, {}),   # {"06": "60", "12": "70", ...}
            })
    except Exception as e:
        print(f"天気: 形が読めず（{type(e).__name__}）")
        return out if out["days"] else None
    print(f"天気: {out['place']} {len(out['days'])}日分")
    return out


def fetch_stocks(items):
    """設定した銘柄の値段と前日比を取る。

    ※取得先は公式に開放されたものではない。使えなくなったら黙って消える作りにする
      （1つ落ちても全体を止めない、という既存の方針と同じ）。
    """
    if not items:
        return []
    out = []
    for it in items:
        code = it.get("code")
        if not code:
            continue
        try:
            data = get_json(STOCK_URL.format(code=quote(code)))
            m = data["chart"]["result"][0]["meta"]
            price = m.get("regularMarketPrice")
            prev = m.get("chartPreviousClose") or m.get("previousClose")
            if price is None or prev in (None, 0):
                continue
            out.append({
                "name": it.get("name") or m.get("shortName") or code,
                "code": code,
                "price": price,
                "diff": round(price - prev, 2),
                "pct": round((price - prev) / prev * 100, 2),
                "currency": m.get("currency", ""),
            })
        except Exception as e:
            print(f"株価 {code}: 取得できず（{type(e).__name__}）")
    if out:
        print(f"株価: {len(out)}/{len(items)}銘柄を取得")
    return out


# ----------------------------------------------------------------------------
# 取得
# ----------------------------------------------------------------------------

def fetch_feed(feed):
    """1フィードを取得して記事リストと取得結果(status)を返す。

    例外が起きても呼び出し側を止めないよう、ここで全部受け止める。
    返り値: (articles: list[dict], status: str)
    各 article は内部用に "dt"（datetime）を持つ。JSON化は呼び出し側で行う。
    """
    name, url = feed["name"], feed["url"]
    kind = feed.get("type", "article")  # "article"（既定）or "video"
    # テーマ展開時に問題があったフィード（未知のソース名など）
    if feed.get("skip_reason"):
        return [], f"SKIP（{feed['skip_reason']}）"
    # 環境変数（.env / Secrets）未設定でURLが空のときは取得せずスキップ
    if not url:
        return [], "SKIP（URL未設定）"
    try:
        parsed = feedparser.parse(url, agent=USER_AGENT)
    except Exception as e:  # ネットワーク/パース以前の予期せぬ失敗
        return [], f"ERROR ({type(e).__name__}: {e})"

    # feedparser はネットワーク例外を bozo_exception に格納することがある
    if parsed.get("bozo") and not parsed.get("entries"):
        err = parsed.get("bozo_exception", "不明なエラー")
        return [], f"ERROR ({err})"

    entries = parsed.get("entries", [])
    if not entries:
        return [], "0件（取得できず or 配信なし）"

    # フィルタ設定
    #   alert   : 強フィルタ（ドメイン除外＋NGワード）… Googleアラート・はてブ等
    #   ng_only : NGワードだけ適用 … Googleニュース検索（関連度は検索側が担保済み）
    #   require : テーマに指定されていれば、ソース種別によらず常に適用する
    #             （Googleニュース検索も無関係な関連記事を混ぜてくることがあるため）
    is_alert = feed.get("alert", False)
    is_gnews = feed.get("gnews", False)
    require = feed.get("require")
    use_ng = is_alert or feed.get("ng_only", False)
    exclude = (NG_WORDS + feed.get("exclude", [])) if use_ng else None
    # require の判定対象："title"（既定）/ "text"（タイトル＋リード文。ブログ向け）
    require_in = feed.get("require_in", "title")
    # ショート動画を除くか。既定で除外する（本編と内容が重なりやすく、一覧も長くなるため）。
    # 特定チャンネルだけ残したい場合は feeds.json で "skip_shorts": false と書く。
    skip_shorts = feed.get("skip_shorts", True)
    # 記事の重み付け（消さずに並び順だけ変える）
    #   prefer … 読みたい種類の記事（例: 出演・インタビュー）→ 前へ
    #   demote … 話題性の低い記事（例: BGMに使われただけ）→ 後ろへ
    prefer = feed.get("prefer") or []
    demote = DEMOTE_WORDS + (feed.get("demote") or [])
    # サイト指定検索での「別テーマの紛れ込み」を防ぐための材料
    # 実際に使うのはサイト指定検索のときだけ。
    # 通常の検索は見出し一致（require）で守られているため、ここまで絞ると取りこぼす。
    other_topics = (feed.get("other_topics") or []) if feed.get("site_search") else []
    my_topic = feed.get("group") or name
    # 日本語のテーマかどうか。英語圏のソース（海外報道）には効かせない。
    japanese_topic = bool(feed.get("site_search")) and bool(JAPANESE_RE.search(my_topic))
    # 鮮度上限はフィード個別に上書き可（ブログ層は古い深掘り記事にも価値があるため）
    max_age = feed.get("max_age_days", MAX_AGE_DAYS)
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=max_age)

    articles = []
    for e in entries:
        dt = entry_datetime(e)
        link = clean_link(e.get("link", ""))  # 中継URLを実URLへ（全フィード共通・無害）
        title = strip_html(e.get("title", "(無題)"))
        summary_raw = strip_html(e.get("summary", ""))

        # Googleニュース：真の配信元（朝日新聞等）を via に取り、タイトル末尾の「 - 配信元」を除去
        via = ""
        via_host = ""
        if is_gnews:
            src = e.get("source") or {}
            if hasattr(src, "get"):
                via = src.get("title") or ""
                # source の href は発信元サイト（例: https://mainichi.jp）。
                # 中継URLからは分からない「本当の媒体」を知る唯一の手がかり。
                via_host = urlparse(src.get("href") or "").netloc.lower()
            if via and title.endswith(" - " + via):
                title = title[: -(len(via) + 3)].rstrip()

        # --- 多層フィルタ ---
        if is_alert and link and is_blocked_domain(link):
            continue  # 通販・SNS等の発信元を除外
        if is_blocked_source(via, title):
            continue  # 低品質な転載サイト・スパム的なタイトルを除外
        if skip_shorts and "/shorts/" in link:
            continue  # ショート版は本編と内容が重なるので落とす
        if other_topics and my_topic not in title and any(n in title for n in other_topics):
            continue  # 別テーマの記事の紛れ込み（サイト指定検索のみ）
        if japanese_topic and is_foreign_title(title):
            continue  # 日本語のテーマに混じった外国語の記事（サイト指定検索のみ）
        text = title + " " + summary_raw
        require_hay = text if require_in == "text" else title
        if not passes_keywords(require_hay, text, require, exclude):
            continue  # 必須語なし or NG語ありを除外
        if dt and dt < cutoff:
            continue  # 古すぎる記事を除外（日時不明は残す）

        rank = compute_rank(text, prefer, demote)

        # 動画はリード文を出さない（見出し＋サムネイル＋リンクで見せる）
        summary = "" if kind == "video" else truncate(summary_raw, SUMMARY_MAX_LEN)
        articles.append({
            "title": title,
            "link": link,
            "summary": summary,
            "thumb": extract_thumbnail(e) if kind == "video" else "",
            "views": extract_views(e) if kind == "video" else None,
            "blog": is_personal_blog(feed, link, via_host),
            "rank": rank,   # 並び順の重み（-1 優先 / 0 普通 / 1 後回し）
            "kind": kind,
            "via": via,
            "via_host": via_host,  # 発信元サイトのドメイン（Googleニュース経由のみ）
            "paywall": classify_paywall(via, link, via_host),  # paid / member / partial / ""
            "dt": dt,
            "group": feed.get("group") or name,  # 表示上のテーマ見出し
        })

    # 新しい順に並べ、上位だけ残す（日時不明は末尾へ）
    articles.sort(key=lambda a: a["dt"] or DT_MIN, reverse=True)
    articles = articles[:MAX_ITEMS_PER_FEED]
    if not articles:
        # 取得はできたがフィルタで全部落ちた場合
        return [], "0件（フィルタ後）"
    return articles, f"OK {len(articles)}件"


def to_json_item(a):
    """内部の記事dictを data.json 用に整える（datetime→ISO文字列）。"""
    return {
        "title": a["title"],
        "link": a["link"],
        "summary": a["summary"],
        "thumb": a["thumb"],
        "views": a.get("views"),   # 動画の再生回数（記事は None）
        "blog": a.get("blog", False),  # 個人ブログ・note等（報道と区別する印）
        "rank": a.get("rank", 0),  # 並び順の重み（-1 優先 / 0 普通 / 1 後回し）
        "related": a.get("related", False),  # 見出しにテーマ名が無い＝本文で触れただけ
        "corp": a.get("corp", False),        # 会社が運営するブログ
        "first_seen": a.get("first_seen"),  # アプリに初めて入ってきた日時（NEW判定用）
        "kind": a["kind"],
        "via": a.get("via", ""),  # 実際の配信元（Googleニュース経由の記事のみ）
        "via_host": a.get("via_host", ""),  # 発信元サイトのドメイン（判定の見直しに使う）
        "pwv": a.get("pwv", False),  # 実ページで確かめた判定か（Trueなら推測で上書きしない）
        "paywall": a.get("paywall", ""),  # paid / member（登録で読める）/ partial / ""
        "dt": a["dt"].isoformat() if a["dt"] else None,  # 例: 2026-06-04T10:12:35+00:00（UTC）
    }


# ----------------------------------------------------------------------------
# メイン
# ----------------------------------------------------------------------------

def main():
    socket.setdefaulttimeout(TIMEOUT_SEC)  # 遅いサーバでハングしないように
    # 日本時間で記録する。GitHub Actions の時計はUTCなので、そのまま使うと
    # 画面の「更新」が9時間前に見えてしまう（実際にずれていた）。
    now = datetime.datetime.now(JST)
    generated_at = now.strftime("%Y-%m-%d %H:%M")

    feeds_by_cat = load_feeds(FEEDS_FILE)

    categories_out = []   # 出力用：[{name, groups:[...]}, ...]
    cat_items = []        # [(カテゴリ名, 記事リスト), ...] 有料判定の後にまとめる
    summary_rows = []     # [{name, status}, ...] 診断＆ログ用
    log_lines = [f"===== {now.strftime('%Y-%m-%d %H:%M:%S')} ====="]

    # 重複除去：ページ全体で、同じURL／似た見出しは1つだけ残す
    seen_links = set()
    seen_titles = []  # 先頭一致の判定に使うため list

    # これまでに見つけた記事の蓄積。どのテーマが手薄かを知るため、取得の前に読む。
    archive = load_archive(ARCHIVE_FILE)
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # テーマごとの並べ替え規則（feeds.json の prefer / demote）を集める。
    # 同じテーマに複数のフィードがぶら下がることがあるので、すべて足し合わせる。
    rank_rules = {}
    blog_last = {}
    keep_rules = {}       # テーマごとの蓄積上限（feeds.json の keep）
    topic_words = {}      # テーマごとの検索語（「関連」判定に使う）
    site_groups = set()   # サイト指定検索を使うテーマ
    exclude_rules = {}    # テーマごとのNG語（貯めてある分にも当て直す）
    video_groups = set()  # 動画フィードを持つテーマ
    for feeds in feeds_by_cat.values():
        for f in feeds:
            g = f.get("group") or f.get("name")
            if not g:
                continue
            pr, dm = rank_rules.get(g, ([], []))
            rank_rules[g] = (pr + (f.get("prefer") or []), dm + (f.get("demote") or []))
            # 個人ブログを末尾に回すか。既定は回す（報道と素人記事を区別するため）。
            # ただしAIの使いこなしのように、ブログこそが本命のテーマもある。
            if f.get("blog_last") is False:
                blog_last[g] = False
            if f.get("keep"):
                keep_rules[g] = int(f["keep"])
            if f.get("exclude"):
                exclude_rules.setdefault(g, []).extend(f["exclude"])
            if f.get("type") == "video":
                video_groups.add(g)
            # 「関連」判定に使う語。サイト指定検索は見出し一致を求めないぶん、
            # 本文で触れているだけの記事が混ざる。それを見分けるための手がかり。
            if f.get("require"):
                topic_words.setdefault(g, []).extend(f["require"])
            if f.get("site_search"):
                site_groups.add(g)

    # 既に貯めてある記事にも、今の基準を当て直す。
    # 設定を直しても過去分が古いままだと、ラベル漏れや変な並びが残り続けるため。
    relabeled = 0
    reranked = 0
    reblogged = 0
    for g, items in archive.items():
        prefer, demote_extra = rank_rules.get(g, ([], []))
        demote = DEMOTE_WORDS + demote_extra
        for a in items:
            if not a.get("pwv"):  # 実ページで確かめた結果は動かさない
                new_pw = classify_paywall(a.get("via", ""), a.get("link", ""), a.get("via_host", ""))
                if new_pw != a.get("paywall", ""):
                    a["paywall"] = new_pw
                    relabeled += 1
            text = (a.get("title") or "") + " " + (a.get("summary") or "")
            new_rank = compute_rank(text, prefer, demote)
            if new_rank != a.get("rank", 0):
                a["rank"] = new_rank
                reranked += 1
            # 発信元ドメインで個人ブログを判定し直す
            # （中継URLしか見ていなかった頃の記事は note でも印が付いていない）
            if not a.get("blog") and looks_like_blog(a.get("link", ""), a.get("via_host", "")):
                a["blog"] = True
                reblogged += 1
    # 設定から外したテーマの蓄積を捨てる（残しても表示されず、保存だけが膨らむ）
    live_groups = {f.get("group") or f.get("name")
                   for feeds in feeds_by_cat.values() for f in feeds}
    gone = [g for g in archive if g not in live_groups]
    if gone:
        n = sum(len(archive[g]) for g in gone)
        for g in gone:
            del archive[g]
        line = f"整理: 設定から外したテーマ {', '.join(gone)} の{n}件を削除"
        log_lines.append(line)
        print(line)

    # NG語（exclude）を貯めてある記事にも当て直す。設定を直しても過去分が残るため。
    # あわせて、動画フィードを持たないテーマに紛れ込んだ動画も外す。
    ng_removed = 0
    for g, items in archive.items():
        ng = exclude_rules.get(g) or []
        keep = []
        for a in items:
            text = (a.get("title") or "") + " " + (a.get("summary") or "")
            if ng and any(w in text for w in ng):
                ng_removed += 1
                continue
            if a.get("kind") == "video" and g not in video_groups:
                ng_removed += 1
                continue
            keep.append(a)
        archive[g] = keep
    if ng_removed:
        line = f"整理: NG語・場違いな動画 {ng_removed}件を削除"
        log_lines.append(line)
        print(line)

    # 見出しに含むべき語（require）を、貯めてある記事にも当て直す。
    # 設定を直しても過去分が残っていては、無関係な記事が消えないため。
    # ただしサイト指定検索を使うテーマは対象外。あちらは「見出しに名前が無くても
    # 本文で語っている記事」を意図して拾っているので、当てると正しい記事まで消える。
    require_rules = {}
    for feeds in feeds_by_cat.values():
        for f in feeds:
            g = f.get("group") or f.get("name")
            if not g:
                continue
            words, has_site = require_rules.get(g, ([], False))
            require_rules[g] = (words + (f.get("require") or []),
                                has_site or bool(f.get("site_search")))
    off_topic = 0
    for g, items in archive.items():
        words, has_site = require_rules.get(g, ([], True))
        if has_site or not words:
            continue
        keep = [a for a in items if any(w in (a.get("title") or "") for w in words)]
        off_topic += len(items) - len(keep)
        archive[g] = keep
    if off_topic:
        line = f"整理: 見出しが条件に合わない{off_topic}件を削除"
        log_lines.append(line)
        print(line)

    # 記事ではないページと、日本語テーマに混じった韓国語の記事を取り除く。
    # （サイト指定検索を入れる前に貯めた分の手当て。ここだけは移動ではなく削除する）
    # 貯めてある分にも当てる「記事ではないもの」の語。
    # NG_WORDS 全部を当てると "Amazon"（Bedrock等）のような語で正当な記事まで
    # 消してしまうため、誤解の余地がないものだけに絞る。
    JUNK_TITLE_WORDS = ["タグ記事一覧", "関連画像", "フォトギャラリー",
                        "求人・転職情報", "の求人"]
    dropped = 0
    for g in list(archive):
        items = archive[g]
        # そのテーマが「日本語で読むテーマ」かどうか。
        # アーミル・カーンのように英語の現地報道を集めるテーマまで巻き込まないため、
        # テーマ名が日本語で、かつ実際に日本語の記事が大半のときだけ外国語を外す。
        ja = sum(1 for x in items if JAPANESE_RE.search((x.get("title") or "")[:30]))
        ja_theme = bool(JAPANESE_RE.search(g)) and items and ja / len(items) >= 0.8
        keep = []
        for a in items:
            t = a.get("title") or ""
            if any(w in t for w in JUNK_TITLE_WORDS) or (ja_theme and is_foreign_title(t)):
                dropped += 1
                continue
            keep.append(a)
        archive[g] = keep
    if dropped:
        line = f"整理: 記事でないページ等 {dropped}件を削除"
        log_lines.append(line)
        print(line)

    # 別テーマの記事が紛れ込んでいたら、消さずに本来のテーマへ移す。
    # （サイト指定検索を入れる前に貯めた分の手当て。記事自体には読む価値がある）
    theme_names = set(archive)
    moved = 0
    for g in list(archive):
        keep = []
        for a in archive[g]:
            title = a.get("title") or ""
            if g not in title:
                owners = [n for n in theme_names if n != g and n in title]
                if len(owners) == 1:
                    dest = owners[0]
                    links = {x.get("link") for x in archive.get(dest, [])}
                    if a.get("link") not in links:
                        archive.setdefault(dest, []).append(a)
                    moved += 1
                    continue   # 元のテーマからは外す（移動であって削除ではない）
            keep.append(a)
        archive[g] = keep
    if moved:
        line = f"整理: 別テーマに紛れていた{moved}件を本来のテーマへ移動"
        log_lines.append(line)
        print(line)

    if relabeled or reranked or reblogged:
        line = (f"蓄積分の見直し: ラベル{relabeled}件 / 並び順{reranked}件 / "
                f"個人ブログ{reblogged}件を更新")
        log_lines.append(line)
        print(line)

    def take(articles, collected):
        """重複を除いて採用する。同じURL・似た見出しは1つだけ残す。"""
        added = 0
        for a in articles:
            norm = normalize_title(a["title"])
            if (a["link"] and a["link"] in seen_links) or is_duplicate_title(norm, seen_titles):
                continue
            seen_links.add(a["link"])
            if norm:
                seen_titles.append(norm)
            collected.append(a)
            added += 1
        return added

    for cat, feeds in feeds_by_cat.items():
        collected = []
        for feed in feeds:
            articles, status = fetch_feed(feed)
            # 取れた件数が少ないテーマは、期間を大きく広げて取り直す
            # （既読管理があるので、古い記事が混ざっても未読なら読む価値がある）
            if len(articles) < THIN_THRESHOLD and not feed.get("max_age_days"):
                wide = dict(feed)
                wide["max_age_days"] = THIN_MAX_AGE_DAYS
                more, more_status = fetch_feed(wide)
                if len(more) > len(articles):
                    articles, status = more, more_status + "（期間を拡大）"
            take(articles, collected)
            summary_rows.append({"name": feed["name"], "status": status})
            line = f"[{cat}] {feed['name']}: {status}"
            log_lines.append(line)
            print(line)  # コンソールにも進捗を出す
        # --- 蓄積が手薄なテーマは、期間を区切って過去へ遡り補充する ---
        # 検索は既定では最近の記事しか返さない。「何十年前でも読みたい」を叶えるには、
        # 年で区切って何度も聞き直す必要がある。手薄なテーマだけが対象なので負荷は小さい。
        deep_done = set()   # サイト指定の深掘りはテーマごとに1回だけ
        for feed in feeds:
            bf = feed.get("backfill")
            if not bf or feed.get("site_search"):
                continue   # 既にサイト指定のフィードは、そこからさらに掘らない
            g = feed.get("group") or feed["name"]
            # 「実際に貯まっている件数」だけで判断する。
            # 今回取得した分を足すと、その大半は蓄積済みの記事と重複しているため、
            # 二重に数えて「足りている」と誤判定してしまう（沢木耕太郎が補充されなかった原因）。
            have = len(archive.get(g, []))
            if have >= BACKFILL_TARGET:
                continue
            gained = 0
            # (a) まずニュース以外の情報源へ。報道が少ない相手でも、
            #     ブログや媒体サイトには書かれていることがある。
            if g not in deep_done:
                deep_done.add(g)
                for site in DEFAULT_DEEP_SITES:
                    if have + gained >= BACKFILL_TARGET:
                        break
                    sub = dict(feed)
                    sub.pop("backfill", None)
                    sub.pop("require", None)   # サイトで絞るので見出し一致までは求めない
                    sub["site_search"] = True
                    sub["url"] = bf["url"].format(q=quote(f'{bf["q"]} site:{site}'))
                    sub["max_age_days"] = 36500
                    arts, _ = fetch_feed(sub)
                    got = take(arts, collected)
                    if got:
                        line = f"[{cat}] {g}: {site} から{got}件"
                        summary_rows.append({"name": f"{g}（{site}）", "status": f"OK {got}件"})
                        log_lines.append(line)
                        print(line)
                    gained += got

            # (b) それでも足りなければ、期間を区切って過去へ遡る
            for start, end in backfill_ranges(now.year):
                if have + gained >= BACKFILL_TARGET:
                    break
                past = dict(feed)
                past.pop("backfill", None)
                past["url"] = bf["url"].format(q=quote(f'{bf["q"]} after:{start} before:{end}'))
                past["max_age_days"] = 36500  # 期間は検索側で絞るので、こちらでは切らない
                arts, _ = fetch_feed(past)
                gained += take(arts, collected)
            if gained:
                line = f"[{cat}] {g}: 情報源を広げて{gained}件を補充（{have}件 → {have + gained}件）"
                log_lines.append(line)
                print(line)

        cat_items.append((cat, collected))

    # --- 有料かどうかを実際に確かめる（直リンクの記事だけ・並行処理） ---
    # 媒体リストは「推測」なので、実ページで分かった事実があればそれで上書きする。
    if VERIFY_PAYWALL:
        targets = [a for _, items in cat_items for a in items
                   if a["kind"] != "video" and a["link"]]
        if targets:
            with ThreadPoolExecutor(max_workers=VERIFY_WORKERS) as ex:
                results = list(ex.map(lambda a: verify_paywall(a["link"]), targets))
            checked = sum(1 for r in results if r is not None)
            for a, r in zip(targets, results):
                if r is not None:
                    a["paywall"] = r   # paid / member / ""（無料と確認できた）
                    a["pwv"] = True    # 実ページで確かめた事実。以後、推測で上書きしない
            line = f"有料判定: {checked}/{len(targets)}件を実ページで確認"
            log_lines.append(line)
            print(line)

    # これまでに見つけた記事の蓄積を読み込む（未読のまま消えないようにするため）
    # カテゴリごとにテーマ(group)へ束ねる。group の初出順を保つ。
    for cat, collected in cat_items:
        buckets = {}
        for a in collected:
            buckets.setdefault(a.get("group") or "その他", []).append(a)

        # テーマの並びは feeds.json の定義順にする。
        # 以前は「今回取れた記事」からテーマを組み立てていたため、
        # 配信側が一時的に落ちるとテーマごと画面から消えていた
        #（実測：YouTubeが4本エラーになり、蓄積9〜14件があるのに0件表示）。
        # 貯めてある以上は出す。それがストック型にした意味だから。
        order = []
        for f in feeds_by_cat.get(cat, []):
            g = f.get("group") or f.get("name")
            if g and g not in order:
                order.append(g)
        for g in buckets:
            if g not in order:
                order.append(g)

        groups_out = []
        for g in order:
            # 今回の取得分を蓄積へ統合し、過去に見つけた記事も一緒に扱う
            fresh = [to_json_item(a) for a in buckets.get(g, [])]
            if not fresh and not archive.get(g):
                continue   # 取れず、蓄積も無いテーマは出さない
            merged = merge_into_archive(archive, g, fresh, now_iso, keep_rules.get(g))

            # 「関連」＝ 見出しにテーマの語が無い記事。本文で触れているだけのものが多い。
            # 消さずに後ろへ回す（当たりの読み物も混じっているため）。
            words = topic_words.get(g) or ([g] if g in site_groups else [])
            for a in merged:
                if g in site_groups and words:
                    a["related"] = not any(w in (a.get("title") or "") for w in words)
                elif "related" in a:
                    del a["related"]
                if a.get("blog"):
                    a["corp"] = looks_like_corp(a.get("via", ""), a.get("title", ""))

            # 並べ替え：新しい順 →「読めないもの・個人ブログは後ろ」の順に安定ソート。
            # 先に読める報道を持ってくることで、冒頭が有料記事だらけになるのを防ぐ。
            items = sorted(merged, key=lambda a: a.get("dt") or "", reverse=True)
            # 安定ソートを重ねる。あとに書いたものほど強く効く。
            items.sort(key=lambda a: a.get("rank", 0))       # 話題性の低いものを後ろへ
            if blog_last.get(g, True):
                items.sort(key=lambda a: bool(a.get("blog")))
            # 「関連」はブログかどうかより強く後ろへ回す。
            # 本人について書かれた個人ブログのほうが、名前に触れただけの報道より読みたいため。
            items.sort(key=lambda a: bool(a.get("related")))
            items.sort(key=lambda a: a.get("paywall") in ("paid", "member", "partial"))
            groups_out.append({"name": g, "items": items})
        categories_out.append({"name": cat, "groups": groups_out})

    # 蓄積を保存（次回以降、未読の記事が消えないようにするため）
    save_archive(ARCHIVE_FILE, archive)
    total_archived = sum(len(v) for v in archive.values())
    line = f"蓄積: {total_archived}件（{len(archive)}テーマ）を archive.json に保存"
    log_lines.append(line)
    print(line)

    # data.js 書き出し（UTF-8・日本語そのまま）
    #   window.NEWS_DATA にデータを入れる形にすると、<script src> で読めるため
    #   ローカルサーバ無しの file:// でも動く（fetch はブロックされるため使わない）。
    # 天気と株価（どちらも失敗したら黙って消える）
    conf = json.loads(FEEDS_FILE.read_text(encoding="utf-8"))
    weather = fetch_weather(conf.get("weather"))
    stocks = fetch_stocks(conf.get("stocks"))

    data = {
        "generated_at": generated_at,
        "weather": weather,
        "stocks": stocks,
        "categories": categories_out,
        "sources": summary_rows,
    }
    payload = "window.NEWS_DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n"
    OUTPUT_DATA.write_text(payload, encoding="utf-8")

    # ログ追記
    total = sum(len(g["items"]) for c in categories_out for g in c["groups"])
    log_lines.append(f"合計記事数: {total} / 出力: {OUTPUT_DATA.name}")
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write("\n".join(log_lines) + "\n\n")

    print(f"\n完了: {OUTPUT_DATA} に {total} 件を出力しました。")
    print(f"ログ: {LOG_FILE}")


if __name__ == "__main__":
    main()
