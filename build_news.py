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


def load_paywall(path: Path):
    """有料媒体リストを読む。無ければ空（判定しない）。

    返り値: {"paid": [語句...], "partial": [語句...]}
    """
    if not path.exists():
        return {"paid": [], "partial": []}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {
        "paid": [s.lower() for s in data.get("paid", [])],
        "partial": [s.lower() for s in data.get("partial", [])],
    }


PAYWALL = load_paywall(PAYWALL_FILE)


# 記事ページを実際に見て有料か確かめる設定（直リンクの記事のみ）
VERIFY_PAYWALL = True     # False にすると媒体リストだけの判定に戻る
VERIFY_TIMEOUT = 8        # 1記事あたりの待ち時間（秒）
VERIFY_WORKERS = 8        # 同時に確かめる数
VERIFY_MAX_BYTES = 400_000  # 読み込む最大バイト数（重いページ対策）

# 「この記事は有料」と断定できる文言（誤検出を避けるため強い表現だけ）
PAYWALL_TEXT_MARKERS = [
    "有料会員限定", "有料記事です", "この記事は有料", "会員限定記事",
    "続きは会員登録", "続きを読むには会員",
]


def verify_paywall(link: str):
    """記事ページを実際に取得して有料かを判定する。

    返り値: "paid"（有料）/ ""（無料と確認）/ None（判定できず＝媒体リストに任せる）

    Googleニュースの中継URLは実記事に解決できないので対象外。
    schema.org の isAccessibleForFree が最も信頼できる手がかり。
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

    m = re.search(r'isAccessibleForFree"?\s*:\s*"?(\w+)', html_text)
    if m:
        return "" if m.group(1).lower() == "true" else "paid"
    if any(k in html_text for k in PAYWALL_TEXT_MARKERS):
        return "paid"
    return None


def classify_paywall(via: str, link: str) -> str:
    """記事が有料媒体かを判定して "paid" / "partial" / "" を返す。

    Googleニュース経由の記事はリンクが中継URLで実サイトが分からないため、
    配信元名（via）で判定する。直リンクの記事はドメインで判定する。
    """
    hay = ((via or "") + " " + (link or "")).lower()
    if not hay.strip():
        return ""
    for word in PAYWALL["paid"]:
        if word and word in hay:
            return "paid"
    for word in PAYWALL["partial"]:
        if word and word in hay:
            return "partial"
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
        "opts": {"gnews": True, "ng_only": True},
    },
    # Googleニュース検索（インド英語版）。海外テーマの現地報道用。
    # 英語見出しに日本語NGワードは無意味＆"Amazon"(Prime配信ニュース等)を誤爆するため無フィルタ。
    "gnews_in": {
        "url": "https://news.google.com/rss/search?q={q}&hl=en-IN&gl=IN&ceid=IN:en",
        "label": "海外報道",
        "english": True,
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
        elif plain_for_require:
            feed["require"] = [plain_for_require]
        if entry.get("exclude"):
            feed["exclude"] = entry["exclude"]
        feeds.append(feed)
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
    return feeds_by_cat


# 取得・表示に関する調整値
TIMEOUT_SEC = 10        # 1フィードあたりの取得タイムアウト
MAX_ITEMS_PER_FEED = 8  # フィードごとに表示する最大件数
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
]

# これより古い記事は表示しない（アラートが拾う古いページ対策）。日数。
MAX_AGE_DAYS = 45

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
                return qs[key][0]
    return url


def is_blocked_domain(url: str) -> bool:
    """実URLのドメインが除外リストに該当するか。"""
    net = urlparse(url).netloc.lower()
    return any(b in net for b in BLOCK_DOMAINS)


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
    return re.sub(r"[\s\W_]+", "", base, flags=re.UNICODE).lower()


# 重複とみなす「先頭一致」の最小文字数。これ以上共通なら同一記事とみなす。
DUP_PREFIX_MIN = 14


def is_duplicate_title(norm: str, seen_titles) -> bool:
    """既出タイトルとの重複判定。

    完全一致に加え、**一方が他方の先頭部分**なら同一記事とみなす
    （例：「…沢木耕太郎著」と「…沢木耕太郎著（写真・画像 1/1）」＝配信社違いの同じ書評）。
    短いタイトルの誤マージを避けるため、共通部分が DUP_PREFIX_MIN 文字以上のときだけ適用。
    """
    if not norm:
        return False
    for s in seen_titles:
        if norm == s:
            return True
        if min(len(norm), len(s)) >= DUP_PREFIX_MIN and (norm.startswith(s) or s.startswith(norm)):
            return True
    return False


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
        if is_gnews:
            src = e.get("source") or {}
            via = (src.get("title") or "") if hasattr(src, "get") else ""
            if via and title.endswith(" - " + via):
                title = title[: -(len(via) + 3)].rstrip()

        # --- 多層フィルタ ---
        if is_alert and link and is_blocked_domain(link):
            continue  # 通販・SNS等の発信元を除外
        text = title + " " + summary_raw
        require_hay = text if require_in == "text" else title
        if not passes_keywords(require_hay, text, require, exclude):
            continue  # 必須語なし or NG語ありを除外
        if dt and dt < cutoff:
            continue  # 古すぎる記事を除外（日時不明は残す）

        # 動画はリード文を出さない（見出し＋サムネイル＋リンクで見せる）
        summary = "" if kind == "video" else truncate(summary_raw, SUMMARY_MAX_LEN)
        articles.append({
            "title": title,
            "link": link,
            "summary": summary,
            "thumb": extract_thumbnail(e) if kind == "video" else "",
            "kind": kind,
            "via": via,
            "paywall": classify_paywall(via, link),  # "paid" / "partial" / ""
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
        "kind": a["kind"],
        "via": a.get("via", ""),  # 実際の配信元（Googleニュース経由の記事のみ）
        "paywall": a.get("paywall", ""),  # "paid"（ほぼ全文有料）/ "partial"（一部有料）/ ""
        "dt": a["dt"].isoformat() if a["dt"] else None,  # 例: 2026-06-04T10:12:35+00:00（UTC）
    }


# ----------------------------------------------------------------------------
# メイン
# ----------------------------------------------------------------------------

def main():
    socket.setdefaulttimeout(TIMEOUT_SEC)  # 遅いサーバでハングしないように
    now = datetime.datetime.now()
    generated_at = now.strftime("%Y-%m-%d %H:%M")

    feeds_by_cat = load_feeds(FEEDS_FILE)

    categories_out = []   # 出力用：[{name, groups:[...]}, ...]
    cat_items = []        # [(カテゴリ名, 記事リスト), ...] 有料判定の後にまとめる
    summary_rows = []     # [{name, status}, ...] 診断＆ログ用
    log_lines = [f"===== {now.strftime('%Y-%m-%d %H:%M:%S')} ====="]

    # 重複除去：ページ全体で、同じURL／似た見出しは1つだけ残す
    seen_links = set()
    seen_titles = []  # 先頭一致の判定に使うため list

    for cat, feeds in feeds_by_cat.items():
        collected = []
        for feed in feeds:
            articles, status = fetch_feed(feed)
            for a in articles:
                norm = normalize_title(a["title"])
                if (a["link"] and a["link"] in seen_links) or is_duplicate_title(norm, seen_titles):
                    continue  # 既出（同一URL or 似た見出し）はスキップ
                seen_links.add(a["link"])
                if norm:
                    seen_titles.append(norm)
                collected.append(a)
            summary_rows.append({"name": feed["name"], "status": status})
            line = f"[{cat}] {feed['name']}: {status}"
            log_lines.append(line)
            print(line)  # コンソールにも進捗を出す
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
                    a["paywall"] = r  # "paid" か ""（無料と確認できた）
            line = f"有料判定: {checked}/{len(targets)}件を実ページで確認"
            log_lines.append(line)
            print(line)

    # カテゴリごとにテーマ(group)へ束ねる。group の初出順を保つ。
    for cat, collected in cat_items:
        order = []
        buckets = {}
        for a in collected:
            g = a.get("group") or "その他"
            if g not in buckets:
                buckets[g] = []
                order.append(g)
            buckets[g].append(a)
        groups_out = []
        for g in order:
            # まず新しい順、そのあと「有料(paid)は後ろ」に安定ソート。
            # → 各テーマの先頭（リード表示）に有料記事が来ず、有料が連続しない。
            items = sorted(buckets[g], key=lambda a: a["dt"] or DT_MIN, reverse=True)
            items.sort(key=lambda a: a.get("paywall") == "paid")
            groups_out.append({"name": g, "items": [to_json_item(a) for a in items]})
        categories_out.append({"name": cat, "groups": groups_out})

    # data.js 書き出し（UTF-8・日本語そのまま）
    #   window.NEWS_DATA にデータを入れる形にすると、<script src> で読めるため
    #   ローカルサーバ無しの file:// でも動く（fetch はブロックされるため使わない）。
    data = {
        "generated_at": generated_at,
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
