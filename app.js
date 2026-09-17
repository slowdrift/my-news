// マイニュース 表示スクリプト
// data.js（build_news.py が生成し window.NEWS_DATA に入る）を、
// カテゴリ → テーマ(group) → 記事 の順に描画する。
//
// 既読管理：一度開いた記事は既定で一覧から消える（読むほどスクロールが短くなる）。
// 「既読も表示」に切り替えれば読み返せる。設定はこの端末のブラウザにだけ保存される。

"use strict";

const APP = document.getElementById("app");

// 画面最下部に出す版と更新履歴。改修のたびにここへ1行足す。
const APP_VERSION = "v1.18.0";
const CHANGELOG = [
  ["v1.13.0", "2026-09-13", "記事を探せるように。つまらないの記録とはてなブックマーク数を追加"],
  ["v1.12.0", "2026-09-13", "読めない記事をまとめて隠せるように。テーマ名を押すと最小化"],
  ["v1.11.0", "2026-09-13", "終わったセールを残さないように。同じ出来事の重複をまとめ、届かず表示を設定へ移動"],
  ["v1.10.0", "2026-09-09", "「ときどき見る」テーマを作れるように。BLUE GIANTを追加"],
  ["v1.9.0", "2026-09-09", "取り消しを5件までさかのぼれるように。ボタンを押しやすくし、設定に使い方を追加"],
  ["v1.8.1", "2026-09-09", "天気の下に株価を一行添え、新着画面にテーマごとの一括既読を追加"],
  ["v1.8.0", "2026-09-09", "広い画面で2列に。1テーマが1日に新着として名乗れる数を20件までにした"],
  ["v1.7.1", "2026-09-09", "見出しの数字を押すと「きょうの新着」だけを見られるようにした"],
  ["v1.7.0", "2026-09-09", "見出しの数字を「きょうの新着」に。未読の合計は控えめに添えるだけにした"],
  ["v1.6.2", "2026-09-09", "取れなかったフィードを画面に出し、更新が半日あいたら知らせるようにした"],
  ["v1.6.1", "2026-09-09", "カテゴリの開閉と「もっと見る」の位置を覚えるようにした"],
  ["v1.6.0", "2026-09-09", "カードを右へ払うと既読、左へ払うとお気に入り。更新を朝と昼の2回に"],
  ["v1.5.0", "2026-09-08", "上部を4つに整理して設定を新設、テーマごとの一括既読、グロービスとAmazonのセールを追加、収集の精度を改善"],
  ["v1.4.0", "2026-09-08", "NHKを有料扱いに、読めない記事をまとめて既読に、「もっと見る」を1つに統合、本文で触れただけの記事に「関連」の印"],
  ["v1.3.0", "2026-09-08", "天気に時間帯の降水確率、株価を最下部へ、まとめて既読を分かりやすく、1か月以上前の記事に区切り"],
  ["v1.2.0", "2026-09-08", "ニュース以外（note・ほぼ日・出版社）からも収集。貯めた記事を全部表示し、読み切ると次が出るように"],
  ["v1.1.0", "2026-09-07", "未読バッジの不具合を修正、会員限定の判定を強化、既読を永続化、動画を分離、お気に入り"],
  ["v1.0.0", "2026-08-03", "GitHub Pagesで公開。有料記事の判定と読みやすさの改善"],
];

// テーマごとに初期表示する件数
const INITIAL_VISIBLE = 3;

// 一度に画面へ描くテーマあたりの件数。
// 収集側は貯めた全件を渡してくる（数百件になるテーマもある）ので、
// 描く量はこちらで抑える。足りなければ「さらに古い記事」で伸ばす。
const RENDER_CHUNK = 15;
let REREAD = {};   // 「読み返す」を押したテーマ（一時的なので保存しない）

// 画面の開き具合を端末に覚えておく。
// 設定（配色・文字・既読）は保存していたが、開閉や展開の位置は毎回まっさらに
// 戻っていた。毎朝「畳み直す」のは手間なので、ここも覚える。
// 通し番号ではなく名前で覚える。テーマが増減しても位置がずれないようにするため。
const UI_KEY = "mynews_ui";
let UI = { cats: {}, shown: {} };
try {
  const raw = JSON.parse(lsGet(UI_KEY, "{}") || "{}");
  UI.cats = raw.cats || {};
  UI.shown = raw.shown || {};
} catch (e) { /* 壊れていたら初期値のまま */ }

function saveUI() { lsSet(UI_KEY, JSON.stringify(UI)); }

// 開いているか。覚えが無ければ既定（カテゴリも動画も開いた状態）
function isOpen(key) { return UI.cats[key] !== false; }

// 記事そのものが古いと感じる境目（日）。ここに区切りを入れる。
const OLD_DAYS = 30;

// 選んでまとめて既読にするための状態。
// 「テーマごと全部」と「1件ずつ」の中間が無かったので、選んでから消せるようにする。
let SELECT_MODE = false;
let SELECTED = new Set();
let SETTINGS_OPEN = false;
let TROUBLE_OPEN = false;
let BORING_OPEN = false;
let ORDER_OPEN = false;    // テーマの並べ替えを開いているか
let SHOW_READ = false;     // 読んだ記事の一覧を見ているか
// 「きょうの新着だけ」を見る画面。ボタンを増やさず、見出しの数字を入口にする。
// 一時的な見方なので端末には覚えさせない（次に開いたときは通常表示に戻る）。
let SHOW_FRESH = false;
let SHOW_FOUND = false;   // 掘り出した古い記事だけの画面
let FOUND_TODAY = true;   // その画面で「きょう」に絞るか
// 蓄積が1900件を超え、「あの記事どこだっけ」を探せなくなった。
// 既読も含めて見出しから絞り込む（探すのは読んだ記事のことが多いため）。
let SEARCH = "";
let SEARCH_OPEN = false;
const SEARCH_MAX = 200;

// カテゴリごとのアクセント色（見出し・リード・件数に薄く効かせる）
const CAT_COLORS = ["#7c3aed", "#2563eb", "#059669", "#ea580c", "#ca8a04", "#db2777", "#0891b2"];

// URL に ?debug を付けたときだけ診断情報を画面に出す（通常は非表示・コンソールのみ）
const DEBUG = /[?&]debug\b/.test(location.search);

// ---- 設定の保存（localStorage）------------------------------------------
// 使えない環境（プライベートモード等）でも画面が壊れないよう、必ず try/catch で包む。
const READ_KEY = "mynews_read";        // { 記事の鍵: 既読にした時刻(ms) }
const FAV_KEY = "mynews_fav";          // { 記事の鍵: 記事そのもの } お気に入り
const SHOWALL_KEY = "mynews_showall";  // "1" なら既読も表示
const SHOWFAV_KEY = "mynews_showfav";  // "1" ならお気に入りだけ表示
const HIDELOCK_KEY = "mynews_hidelocked";  // "1" なら読めない記事を出さない
const ORDER_KEY = "mynews_order";      // { テーマ名: 並び順の数字 }
const GOOD_KEY = "mynews_good";        // { 発信元: 良かったと押した回数 }
const GOODED_KEY = "mynews_gooded";    // { 記事の鍵: 1 }（二度押しを避ける印）
const BORING_KEY = "mynews_boring";    // { 発信元: つまらないと押した回数 }
const OPENED_KEY = "mynews_opened";    // { 発信元: 実際に開いた回数 }
const THEME_KEY = "mynews_theme";      // "auto" | "light" | "dark"
const FONT_KEY = "mynews_font";        // "s" | "m" | "l"
// NEWバッジを何日光らせるか。読めば消えるので、長すぎなければ邪魔にならない。
const NEW_DAYS = 7;
// 「新しい記事」と「初めて見つけた古い記事」は別もの。
// 10年前のインタビュー記事に NEW が付くと、新着の意味が薄れる。
// 配信がこれより古ければ「発掘」として分けて数える（消しはしない）。
const NEW_MAX_AGE_DAYS = 30;
const FIRSTOPEN_KEY = "mynews_firstopen";  // このアプリを初めて開いた時刻

// 既読の記録は「日付では消さない」。一度読んだ記事は、ずっと既読のままにする。
// 増えすぎたときだけ、古い記録から減らして容量を抑える。
const READ_MAX = 5000;

function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch (e) { return fallback; }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* 保存できなくても続行 */ }
}

function loadRead() {
  try {
    const obj = JSON.parse(lsGet(READ_KEY, "{}") || "{}");
    const keys = Object.keys(obj);
    if (keys.length <= READ_MAX) return obj;
    // 新しく既読にしたものを優先して残す
    keys.sort(function (a, b) { return (obj[b] || 0) - (obj[a] || 0); });
    const kept = {};
    keys.slice(0, READ_MAX).forEach(function (k) { kept[k] = obj[k]; });
    saveRead(kept);
    return kept;
  } catch (e) {
    return {};  // 読めなければ「既読ゼロ」とみなし、全件表示で動き続ける
  }
}

function saveRead(obj) { lsSet(READ_KEY, JSON.stringify(obj)); }

function loadFav() {
  try { return JSON.parse(lsGet(FAV_KEY, "{}") || "{}"); } catch (e) { return {}; }
}

function saveFav() { lsSet(FAV_KEY, JSON.stringify(FAV)); }

let READ = loadRead();
let FAV = loadFav();

// 初めて開いた時刻を覚えておく（NEWの基準に使う）
let FIRST_OPEN = Number(lsGet(FIRSTOPEN_KEY, "0")) || 0;
if (!FIRST_OPEN) {
  FIRST_OPEN = Date.now();
  lsSet(FIRSTOPEN_KEY, String(FIRST_OPEN));
}
let SHOW_ALL = lsGet(SHOWALL_KEY, "0") === "1";
let SHOW_FAV = lsGet(SHOWFAV_KEY, "0") === "1";
// 読めない記事（有料・会員限定・一部有料）を一覧から外す。
// 以前は「まとめて既読」にしていたが、既読にすると埋もれて取り返せない。
// 隠すだけなら、設定を戻せばいつでも出てくる。
let HIDE_LOCKED = lsGet(HIDELOCK_KEY, "0") === "1";

// 個人ブログの9割は、Googleの中継URLのため機械では質を測れない。
// そこで「つまらない」と押した回数と、実際に開いた回数を発信元ごとに数える。
// この2つを並べると、切ってよい発信元が見えてくる。
function loadTally(key) {
  try { return JSON.parse(lsGet(key, "{}") || "{}"); } catch (e) { return {}; }
}
let ORDER = loadTally(ORDER_KEY);   // 形が同じ（名前→数字）なので同じ読み方で足りる
let GOOD = loadTally(GOOD_KEY);
let GOODED = loadTally(GOODED_KEY);
let BORING = loadTally(BORING_KEY);
let OPENED = loadTally(OPENED_KEY);

// note や Zenn は「サイト」ではなく「書き手の集まり」なので、
// note ひとまとめで数えると、1人を嫌っただけで全部が悪者になってしまう。
// 直リンクのときは、URLの最初の区切り（note.com/○○）まで見て書き手ごとに数える。
const AUTHOR_SITES = ["note.com", "zenn.dev", "qiita.com", "medium.com", "ameblo.jp"];

function sourceOf(a) {
  const link = a.link || "";
  // Googleニュース経由の記事は中継URLしか無く、書き手までは分からない
  if (link && link.indexOf("news.google.") < 0) {
    try {
      const u = new URL(link);
      const host = u.hostname.replace(/^www\./, "");
      if (AUTHOR_SITES.indexOf(host) >= 0) {
        const seg = u.pathname.split("/").filter(Boolean)[0];
        if (seg) return host + "/" + seg;
      }
      return host;   // はてなブログ等は、そもそも住所が書き手ごとに分かれている
    } catch (e) { /* 壊れたURLは下の配信元名で数える */ }
  }
  if (a.via) {
    return AUTHOR_SITES.some(function (h) { return h.split(".")[0] === a.via.toLowerCase(); })
      ? a.via + "（書き手不明）" : a.via;
  }
  return "不明";
}

function tally(key, store, a) {
  const k = sourceOf(a);
  store[k] = (store[k] || 0) + 1;
  lsSet(key, JSON.stringify(store));
}
let THEME = lsGet(THEME_KEY, "auto");
let FONT = lsGet(FONT_KEY, "m");


// ---- 記事の「鍵」-----------------------------------------------------------
// 同じ記事でも、検索の経路が違うとURLが変わることがある。URLだけを鍵にすると、
// 一度読んだ記事が翌日また未読として出てきてしまう。
// そこで見出しからも鍵を作り、どちらかが一致すれば「読んだ記事」とみなす。

// 記号・空白を取り除くための正規表現。Unicode指定が使えない古い端末向けに控えも用意する。
let PUNCT_RE;
try {
  PUNCT_RE = new RegExp("[\\p{P}\\p{S}\\s]", "gu");
} catch (e) {
  PUNCT_RE = /[\s!-\/:-@\[-`{-~、。・「」『』（）［］…—–〜！？：；]/g;
}

const TITLE_KEY_MIN = 14;   // これ未満の短い見出しは、別記事と衝突しうるので鍵にしない
const TITLE_KEY_LEN = 30;   // 鍵に使う文字数（末尾の飾り違いを吸収する）

function normTitle(t) {
  // 全角と半角を揃えてから記号を落とす（「２０２６年」と「2026年」を同じ扱いに）
  return String(t == null ? "" : t).normalize("NFKC").replace(PUNCT_RE, "").toLowerCase();
}

function titleKey(a) {
  const n = normTitle(a && a.title);
  return n.length >= TITLE_KEY_MIN ? "t:" + n.slice(0, TITLE_KEY_LEN) : "";
}

function isRead(a) {
  if (a.link && READ[a.link]) return true;
  const k = titleKey(a);
  return !!(k && READ[k]);
}

function markRead(a) {
  const now = Date.now();
  if (a.link) READ[a.link] = now;
  const k = titleKey(a);
  if (k) READ[k] = now;   // 経路違いで同じ記事が再登場しても既読のまま
  saveRead(READ);
}

function isLocked(a) {
  return a.paywall === "paid" || a.paywall === "member" || a.paywall === "partial";
}

// 画面に出す記事か。隠している記事は数にも入れない（数字と見た目を合わせるため）。
function isShown(a) {
  if (isRead(a)) return false;
  return !(HIDE_LOCKED && isLocked(a));
}

function countUnread(list) {
  return (list || []).filter(isShown).length;
}

// ---- お気に入り ------------------------------------------------------------
// 一覧から消えても読み返せるよう、記事の中身ごと端末に保存する。

function favKey(a) { return a.link || titleKey(a); }
function isFav(a) { const k = favKey(a); return !!(k && FAV[k]); }

function toggleFav(a) {
  const k = favKey(a);
  if (!k) return;
  if (FAV[k]) {
    delete FAV[k];
  } else {
    const copy = {};
    for (const p in a) {
      if (Object.prototype.hasOwnProperty.call(a, p)) copy[p] = a[p];
    }
    copy.saved_at = Date.now();
    FAV[k] = copy;
  }
  saveFav();
}

// NEW＝「まだ読んでいない、最近アプリへ入ってきた記事」。
//
// 以前は「前回見たデータより後に入ってきたか」で判定していたが、
// それだと一度画面に出ただけで消えてしまい、読む前に印が無くなっていた。
// 日数で見るようにすれば、何度開いても NEW_DAYS 日は光り、読めば消える。
// 記事の配信日ではなく first_seen（アプリに入ってきた日）で見るのは、
// 昔の記事を新しく見つけた日にも新着として知らせるため。
// ヘッダーやカテゴリに出す数は「きょう届いた分」に絞る。
// NEWの印は7日光らせているが、その数を出すと7日分＝約1000件になり、
// 「今日なにを読めばいいか」の指標として働かない（実測1154件）。
//   ヘッダーの数字 … きょうやること
//   カードのNEW印 … 数日空けても見逃さないための印
const FRESH_HOURS = 24;

// アプリに入ってきてからの日数で見る（記事の配信日ではない）
function arrivedWithin(a, ms) {
  const src = a.first_seen || a.dt;
  if (!src) return false;
  const t = new Date(src).getTime();
  if (isNaN(t)) return false;
  return t > Math.max(Date.now() - ms, FIRST_OPEN);
}

// 記事そのものが古いか（配信から NEW_MAX_AGE_DAYS 日以上たっているか）
function isOldArticle(a) {
  if (!a.dt) return false;
  const t = new Date(a.dt).getTime();
  if (isNaN(t)) return false;
  return t < Date.now() - NEW_MAX_AGE_DAYS * 86400000;
}

// 初めて入ってきたのが最近で、記事そのものは古いもの＝「発掘」
function isFound(a) {
  if (isRead(a) || a.quiet) return false;
  if (HIDE_LOCKED && isLocked(a)) return false;
  return arrivedWithin(a, NEW_DAYS * 86400000) && isOldArticle(a);
}

// そのうち、きょう届いた分だけ
function isFoundToday(a) {
  return isFound(a) && arrivedWithin(a, FRESH_HOURS * 3600000);
}

function isFresh(a) {
  if (isRead(a) || a.quiet) return false;   // 1日の上限を超えた分は騒がない
  if (HIDE_LOCKED && isLocked(a)) return false;
  if (isOldArticle(a)) return false;   // 掘り出した古い記事は「発掘」で数える
  return arrivedWithin(a, FRESH_HOURS * 3600000);
}

function isNew(a) {
  if (isRead(a) || a.quiet) return false;   // 1日の上限を超えた分は騒がない
  if (HIDE_LOCKED && isLocked(a)) return false;
  // 初めて開いた日より前に集まっていた記事には付けない。
  // 付けてしまうと、初回や情報源を増やした日に全件が光って意味をなさなくなる。
  // 7日たてば初回の時刻より「7日前」のほうが新しくなり、この縛りは自然に外れる。
  if (isOldArticle(a)) return false;   // 古い記事は NEW ではなく「発掘」
  return arrivedWithin(a, NEW_DAYS * 86400000);
}

// ---- 表示用の小さな道具 --------------------------------------------------

function esc(s) {
  return (s == null ? "" : String(s)).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function fmtDate(iso) {
  const d = new Date(iso);
  // 年をまたぐ記事は年も出す。月日だけだと2019年の記事が今年に見えてしまう。
  const opt = { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" };
  if (d.getFullYear() !== new Date().getFullYear()) opt.year = "numeric";
  const p = new Intl.DateTimeFormat("ja-JP", opt)
    .formatToParts(d).reduce(function (a, x) { a[x.type] = x.value; return a; }, {});
  return (p.year ? p.year + "/" : "") + p.month + "/" + p.day;
}

function relTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return min + "分前";
  const h = Math.floor(min / 60);
  if (h < 24) return h + "時間前";
  const day = Math.floor(h / 24);
  if (day === 1) return "昨日";
  if (day < 7) return day + "日前";
  return fmtDate(iso);
}

// 再生回数を読みやすく丸める（12345 → 1.2万回）
function fmtViews(n) {
  if (!n && n !== 0) return "";
  if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, "") + "億回";
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, "") + "万回";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "千回";
  return n + "回";
}

function payBadge(a) {
  if (a.paywall === "paid") return '<span class="pw paid">🔒 有料</span>';
  if (a.paywall === "member") return '<span class="pw member">会員限定</span>';
  if (a.paywall === "partial") return '<span class="pw partial">一部有料</span>';
  return "";
}

// NEW＋有料バッジ＋発信元＋再生回数＋時刻のメタ行
function metaRow(a) {
  const t = relTime(a.dt);
  const inner = (isNew(a) ? '<span class="new">NEW</span>' : "")
    + (isFound(a) ? '<span class="found" title="初めて見つけた、少し前の記事">発掘</span>' : "")
    + payBadge(a)
    + (a.blog ? '<span class="blog' + (a.corp ? " corp" : "") + '">'
        + (a.corp ? "企業ブログ" : "個人ブログ") + "</span>" : "")
    + (a.related ? '<span class="rel" title="見出しにテーマ名が無い記事">関連</span>' : "")
    + (a.via ? '<span class="chip">' + esc(a.via) + "</span>" : "")
    + (a.views ? '<span class="views">▶ ' + fmtViews(a.views) + "</span>" : "")
    + (a.hb ? '<span class="hb" title="はてなブックマーク数">🔖' + a.hb + "</span>" : "")
    + (t ? '<span class="time">' + esc(t) + "</span>" : "");
  const k = favKey(a);
  // 👍 は「この発信元をもっと」の票。読むつもりの記事なので既読にはしない。
  // 👎 は「もう要らない」の票。こちらは片づける（既読にする）。
  const good = '<button class="good' + (GOODED[k] ? " on" : "") + '" type="button" data-good="'
    + esc(k) + '" title="良かった。この発信元を大事にします">👍</button>';
  const boring = '<button class="boring" type="button" data-boring="'
    + esc(k) + '" title="つまらない。以後この発信元を見直す材料にします">👎</button>';
  return '<div class="meta">' + inner + good + boring + "</div>";
}

// ★ボタン。リンクの外側に置くので、押しても記事は開かない。
// 選択中はチェック印に置き換える（右上に2つ並べると押し間違えるため）。
function favBtn(a) {
  if (SELECT_MODE) {
    const picked = SELECTED.has(favKey(a));
    return '<span class="pick' + (picked ? " on" : "") + '">' + (picked ? "☑" : "☐") + "</span>";
  }
  const on = isFav(a);
  return '<button class="fav' + (on ? " on" : "") + '" type="button"'
    + ' data-fav="' + esc(favKey(a)) + '"'
    + ' aria-label="' + (on ? "お気に入りから外す" : "お気に入りに入れる") + '">'
    + (on ? "★" : "☆") + "</button>";
}

function renderCard(a, hidden, lead) {
  const link = esc(a.link);
  const title = esc(a.title);
  const cls = "card"
    + (a.kind === "video" ? " video" : "")
    + (lead && a.kind !== "video" ? " lead" : "")
    + (hidden ? " extra" : "")
    + (isRead(a) ? " read" : "")
    + (SELECT_MODE ? " picking" : "")
    + (SELECT_MODE && SELECTED.has(favKey(a)) ? " picked" : "")
    + '" data-key="' + esc(favKey(a));

  if (a.kind === "video") {
    let h = '<div class="' + cls + '">'
      + '<a class="vlink" href="' + link + '" target="_blank" rel="noopener" data-link="' + link + '">';
    if (a.thumb) {
      h += '<span class="thumb"><img loading="lazy" src="' + esc(a.thumb) + '" alt="">'
        + '<span class="play">▶</span></span>';
    }
    h += '<span class="vtext"><span class="title">' + title + "</span>" + metaRow(a) + "</span>"
      + "</a>" + favBtn(a) + "</div>";
    return h;
  }

  let h = '<div class="' + cls + '">'
    + '<a class="title" href="' + link + '" target="_blank" rel="noopener" data-link="' + link + '">'
    + title + "</a>"
    + favBtn(a)
    + metaRow(a);
  if (lead && a.summary) h += '<div class="summary">' + esc(a.summary) + "</div>";
  h += "</div>";
  return h;
}

// テーマの見出し（名前・件数・NEW・まとめて既読ボタン）
function groupHead(g, gi, all) {
  const newCount = all.filter(isFresh).length;
  const folded = UI.cats["fold:" + g.name] === false;
  return '<h3 class="ghead"><button class="gname" type="button" data-fold="'
    + esc(g.name) + '">' + (folded ? "▸ " : "") + esc(g.name) + "</button>"
    + '<span class="gcount">' + countUnread(all) + "件</span>"
    + (newCount ? '<span class="gnew">新着 ' + newCount + "</span>" : "")
    + '<button class="read-all" type="button" title="このテーマをまとめて既読にする">✓ 既読に</button>'
    + "</h3>";
}

function renderGroup(g, gi, noHead) {
  const all = g.items || [];
  // テーマ名を押すと最小化する。見出しと件数だけ残し、記事は隠す。
  if (!noHead && UI.cats["fold:" + g.name] === false) {
    return '<section class="group folded" data-group="' + gi + '">'
      + groupHead(g, gi, all) + "</section>";
  }
  const showRead = SHOW_ALL || REREAD[g.name];
  const list = showRead
    ? all.filter(function (a) { return !(HIDE_LOCKED && isLocked(a)); })
    : all.filter(isShown);

  // 読み終えてもテーマは消さない。消えるとカテゴリごと画面から無くなり、
  // 読み返す手段も分からなくなるため、見出しと戻り道は必ず残す。
  if (!list.length) {
    return '<section class="group done" data-group="' + gi + '">'
      + (noHead ? "" : groupHead(g, gi, all))
      + '<div class="empty">すべて読み終えました 🎉'
      + (all.length ? '<button class="reread-btn" type="button" data-reread="' + esc(g.name) + '">'
        + "読み返す（" + all.length + "件）</button>" : "")
      + "</div></section>";
  }

  // 表示は「先頭から limit 件」だけ。ボタンを押すたびに増える。
  // 以前は「もっと見る」と「さらに古い記事」の2つが縦に並んでいたが、
  // 内部の仕組みの違いであって、読む側には区別が要らないので1つにまとめた。
  const limit = UI.shown[g.name] || INITIAL_VISIBLE;
  const items = list.slice(0, limit);
  const rest = list.length - items.length;

  let h = '<section class="group" data-group="' + gi + '">'
    + (noHead ? "" : groupHead(g, gi, all))
    + '<div class="gitems expanded">';
  // 配信日が古い記事との境目に区切りを入れる。
  // NEWバッジは「アプリに入ってきた新しさ」、この区切りは「記事自体の古さ」。
  let dividerDone = false;
  // 小分類（設定・工夫／自動化…）があるテーマでは、変わり目に見出しを入れる。
  // 500件がひと塊では探せないため。分類は見出しから機械で当てているので
  // 当たらないものもあり、それは「その他」に置く（消さない）。
  let curSec = null;
  const hasSec = !!(g.sections && g.sections.length);
  items.forEach(function (a, i) {
    if (hasSec) {
      const sec = a.sec || "その他";
      if (sec !== curSec) {
        curSec = sec;
        const cnt = list.filter(function (x) { return (x.sec || "その他") === sec; }).length;
        h += '<div class="secsep"><span>' + esc(sec) + "</span><i>" + cnt + "件</i></div>";
      }
    }
    const t = a.dt ? new Date(a.dt).getTime() : 0;
    if (!dividerDone && t && (Date.now() - t) > OLD_DAYS * 86400000) {
      dividerDone = true;
      h += '<div class="agesep"><span>ここから1か月以上前の記事</span></div>';
    }
    h += renderCard(a, false, i === 0);
  });
  h += "</div>";
  if (rest > 0) {
    h += '<button class="more-btn" type="button" data-older="' + esc(g.name) + '">'
      + "もっと見る（残り" + rest + "件）</button>";
  }
  h += "</section>";
  return h;
}

// 取れなかったフィードだけを拾う。
// 「0件（フィルタ後）」は絞り込みが効いた正常な結果なので数えない。
// 何でも警告にすると、本当に困ったときに信用されなくなる。
function troubled(sources) {
  return (sources || []).filter(function (s) {
    const st = String(s.status || "");
    return st.indexOf("ERROR") === 0 || st.indexOf("0件（取得できず") === 0;
  });
}

// 取れなかった配信元の知らせは、設定の中に置く。
// 毎朝見る場所に出しても、読めないことに変わりはなく判断は変わらないため。
// 「つまらない」と押した回数を、発信元ごとに集計して見せる。
// 押した数だけでなく「開いた数」も並べる。よく開く発信元なら、
// たまたま1本つまらなかっただけかもしれないため。
function boringRow() {
  const names = [];
  [GOOD, BORING, OPENED].forEach(function (src) {
    Object.keys(src).forEach(function (k) { if (names.indexOf(k) < 0) names.push(k); });
  });
  if (!names.length) return "";
  const votes = names.filter(function (k) { return GOOD[k] || BORING[k]; }).length;
  let h = '<div class="srow"><span>良かった・つまらないの記録</span>'
    + '<button class="tool-btn" type="button" id="show-boring">' + votes
    + "件の発信元</button></div>";
  if (BORING_OPEN) {
    const rows = names.map(function (k) {
      return { k: k, g: GOOD[k] || 0, n: BORING[k] || 0, o: OPENED[k] || 0 };
    }).sort(function (a, b) { return (b.g + b.n) - (a.g + a.n) || b.o - a.o; });
    h += '<div class="trouble-list"><table>'
      + rows.map(function (r) {
        return "<tr><td>" + esc(r.k) + "</td><td>" + (r.g ? "👍" + r.g : "")
          + "</td><td>" + (r.n ? "👎" + r.n : "") + "</td><td>開いた" + r.o + "</td></tr>";
      }).join("")
      + "</table>"
      + "<p>👎が多く開いた数が0に近い発信元は、除外の相談ができます。"
      + "👍が多い発信元は、情報源として増やせないか調べられます。</p></div>";
  }
  return h;
}

// テーマの並び順。指定が無ければ feeds.json の順（＝画面に出てきた順）のまま。
function orderOf(x, i) {
  const v = ORDER[x.group.name];
  return (v === undefined || v === null) ? i + 1000 : v;
}

function sortByOrder(list) {
  return list.map(function (x, i) { return { x: x, i: i }; })
    .sort(function (a, b) {
      const d = orderOf(a.x, a.i) - orderOf(b.x, b.i);
      return d !== 0 ? d : a.i - b.i;
    })
    .map(function (r) { return r.x; });
}

// 並べ替えの操作盤。カテゴリの中だけで上下に動かす
// （カテゴリをまたぐと「地元」の中に仕事の記事が現れて分かりにくくなるため）。
function orderRow() {
  let h = '<div class="srow"><span>テーマの並べ替え</span>'
    + '<button class="tool-btn' + (ORDER_OPEN ? " on" : "") + '" type="button" id="toggle-order">'
    + (ORDER_OPEN ? "とじる" : "並べ替え") + "</button></div>";
  if (!ORDER_OPEN) return h;
  const cats = [];
  ALL_GROUPS.forEach(function (x) { if (cats.indexOf(x.cat) < 0) cats.push(x.cat); });
  h += '<div class="orderbox">';
  cats.forEach(function (c) {
    const mine = sortByOrder(ALL_GROUPS.filter(function (x) { return x.cat === c; }));
    h += "<h4>" + esc(c) + "</h4>";
    mine.forEach(function (x, i) {
      h += '<div class="orow"><span>' + esc(x.group.name) + "</span>"
        + '<button class="tool-btn" type="button" data-move="up" data-name="'
        + esc(x.group.name) + '"' + (i === 0 ? " disabled" : "") + ">▲</button>"
        + '<button class="tool-btn" type="button" data-move="down" data-name="'
        + esc(x.group.name) + '"' + (i === mine.length - 1 ? " disabled" : "") + ">▼</button>"
        + "</div>";
    });
  });
  h += '<p>よく読むテーマを上へ。順番はこの端末に覚えます。</p>'
    + '<button class="tool-btn" type="button" id="order-reset">元の順番に戻す</button></div>';
  return h;
}

// ▲▼ が押されたとき、そのカテゴリの中で入れ替えて順番を保存する
function moveTheme(name, dir) {
  const mineCat = (ALL_GROUPS.filter(function (x) { return x.group.name === name; })[0] || {}).cat;
  if (!mineCat) return;
  const list = sortByOrder(ALL_GROUPS.filter(function (x) { return x.cat === mineCat; }));
  const at = list.map(function (x) { return x.group.name; }).indexOf(name);
  const to = dir === "up" ? at - 1 : at + 1;
  if (at < 0 || to < 0 || to >= list.length) return;
  const moved = list.splice(at, 1)[0];
  list.splice(to, 0, moved);
  list.forEach(function (x, i) { ORDER[x.group.name] = i; });
  lsSet(ORDER_KEY, JSON.stringify(ORDER));
}

function troubleRow(sources) {
  const bad = troubled(sources);
  if (!bad.length) return "";
  let h = '<div class="srow"><span>取れなかった配信元</span>'
    + '<button class="tool-btn" type="button" id="show-trouble">⚠ '
    + bad.length + "件</button></div>";
  if (TROUBLE_OPEN) {
    h += '<div class="trouble-list"><table>'
      + bad.map(function (s) {
        return "<tr><td>" + esc(s.name) + "</td><td>" + esc(s.status) + "</td></tr>";
      }).join("")
      + "</table></div>";
  }
  return h;
}

function headUpdated(generatedAt) {
  if (!generatedAt) return "";
  const m = String(generatedAt).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return "更新: " + esc(generatedAt);
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const hours = (Date.now() - d.getTime()) / 3600000;
  let note = "";
  if (hours >= 1) {
    note = hours < 24
      ? "（" + Math.floor(hours) + "時間前）"
      : "（" + Math.floor(hours / 24) + "日前）";
  }
  // 朝と昼の2回更新しているので、半日あいたら止まっている可能性がある。
  // 以前は2日たたないと色が変わらず、半日止まっても気づけなかった。
  const stale = hours >= 12 ? " stale" : "";
  return "更新: " + esc(generatedAt) + '<span class="age' + stale + '">' + note + "</span>";
}

// ---- 天気と株価 ------------------------------------------------------------
// どちらも取れなかったときは何も出さない（1つ落ちても全体は止めない方針）。

// 気象庁は時間帯別の天気（晴/曇/雨）を出していない。取れるのは1日単位の天気と、
// 6時間ごとの降水確率。そこでアイコンは1日単位にし、通勤（朝）と退勤（夕）は
// その時間帯の降水確率で補う。
function popPart(d, hour, label) {
  const v = d.pops && d.pops[hour];
  if (v == null) return "";
  const strong = Number(v) >= 50 ? " strong" : "";
  return '<span class="wpop' + strong + '">' + label + " ☔" + v + "%</span>";
}

function weatherLine(w) {
  if (!w || !w.days || !w.days.length) return "";
  const rows = w.days.slice(0, 2).map(function (d, i) {
    const temp = (d.max != null ? d.max + "℃" : "")
      + (d.min != null ? "／" + d.min + "℃" : "");
    return '<div class="wrow"><b>' + (i === 0 ? "今日" : "明日") + "</b>"
      + '<span class="wicon">' + (d.icon || "") + "</span>"
      + '<span class="wtext">' + esc(d.short || d.text) + "</span>"
      + (temp ? '<span class="wtemp">' + temp + "</span>" : "")
      + popPart(d, "06", "朝") + popPart(d, "12", "夕")
      + "</div>";
  }).join("");
  return '<div class="weather" title="' + esc(w.days[0].text) + '">'
    + '<div class="wplace">' + esc(w.place || "") + "</div>" + rows
    + stockStrip((window.NEWS_DATA || {}).stocks) + "</div>";
}

// 天気の下に添える一行。株価そのものは最下部に置いたまま
// （記事を優先したいというご指示のため）、朝のひと目だけここで済ませる。
// 押すと最下部の株価ブロックへ飛ぶ。
function stockStrip(list) {
  if (!list || !list.length) return "";
  const cells = list.map(function (s) {
    const up = s.diff > 0, down = s.diff < 0;
    return '<span class="wst"><b>' + esc(s.name) + "</b> "
      + Number(s.price).toLocaleString("ja-JP")
      + '<i class="' + (up ? "up" : down ? "down" : "") + '">'
      + (up ? "▲" : down ? "▼" : "―") + Math.abs(s.diff).toLocaleString("ja-JP")
      + "</i></span>";
  }).join("");
  return '<a class="wstocks" href="#stocks">' + cells + "</a>";
}

function stockBlock(list) {
  if (!list || !list.length) return "";
  const rows = list.map(function (s) {
    const up = s.diff > 0, down = s.diff < 0;
    const sign = up ? "▲" : (down ? "▼" : "―");
    const cls = up ? " up" : (down ? " down" : "");
    return '<div class="srow"><span class="sname">' + esc(s.name) + "</span>"
      + '<span class="sprice">' + Number(s.price).toLocaleString("ja-JP") + "</span>"
      + '<span class="sdiff' + cls + '">' + sign + " "
      + Math.abs(s.diff).toLocaleString("ja-JP") + "（" + (up ? "+" : down ? "-" : "")
      + Math.abs(s.pct).toFixed(2) + "%）</span></div>";
  }).join("");
  return '<section class="stocks" id="stocks"><h2>📈 株価</h2>' + rows + "</section>";
}

function versionBlock(generatedAt) {
  const rows = CHANGELOG.map(function (c) {
    return "<tr><td>" + esc(c[0]) + "</td><td>" + esc(c[1]) + "</td><td>" + esc(c[2]) + "</td></tr>";
  }).join("");
  return '<footer class="ver"><details><summary>マイニュース <b>' + esc(APP_VERSION)
    + "</b>　更新: " + esc(generatedAt || "") + "</summary>"
    + '<table class="vlog">' + rows + "</table></details></footer>";
}

// 見た目の設定（テーマ・文字サイズ）をページ全体に反映する
function applyPrefs() {
  const root = document.documentElement;
  root.setAttribute("data-theme", THEME);
  root.setAttribute("data-font", FONT);
}

// ---- テーマ一覧の平坦化 ----------------------------------------------------
// 「まとめて既読」などが使う通し番号を、画面の並び順から切り離して固定するための表。
// 動画を別ブロックへ移しても番号がずれないようにする。

function isVideoGroup(g) {
  const items = g.items || [];
  return items.length > 0 && items.every(function (a) { return a.kind === "video"; });
}

const ALL_GROUPS = [];   // [{cat, group, video}, ...] data.js の並び順そのまま
const BY_LINK = {};      // リンク → 記事（押された記事を引くため）

(function indexData() {
  const cats = (window.NEWS_DATA || {}).categories || [];
  cats.forEach(function (c) {
    (c.groups || []).forEach(function (g) {
      ALL_GROUPS.push({ cat: c.name, group: g, video: isVideoGroup(g) });
      (g.items || []).forEach(function (a) { if (a.link) BY_LINK[a.link] = a; });
    });
  });
  // お気に入りは一覧から消えても引けるようにしておく
  Object.keys(FAV).forEach(function (k) {
    const a = FAV[k];
    if (a && a.link && !BY_LINK[a.link]) BY_LINK[a.link] = a;
  });
})();

// 上部に出すのは毎日使う4つだけ。
// 配色や文字サイズは一度決めたら変えないので、設定の中に畳む。
// 「すべて既読」は取り返しがつかないので、押し間違えない場所へ移す。
function toolbar(sources) {
  const themeLabel = { auto: "🌓 自動", light: "☀ 明るい", dark: "🌙 暗い" }[THEME] || "🌓 自動";
  const fontLabel = { s: "小", m: "中", l: "大" }[FONT] || "中";
  const favCount = Object.keys(FAV).length;
  let h = '<div class="tools">'
    + '<button class="tool-btn star' + (SHOW_FAV ? " on" : "") + '" type="button" id="toggle-fav">'
    + "★ お気に入り" + (favCount ? " " + favCount : "") + "</button>"
    + '<button class="tool-btn' + (SHOW_ALL ? " on" : "") + '" type="button" id="toggle-read">'
    + (SHOW_ALL ? "☑ 既読も表示" : "☐ 既読も表示") + "</button>"
    + '<button class="tool-btn' + (SEARCH ? " on" : "") + '" type="button" id="toggle-search">🔍 探す</button>'
    + '<button class="tool-btn' + (SETTINGS_OPEN ? " on" : "") + '" type="button" id="toggle-settings">⚙ 設定</button>'
    + "</div>"
    + (SEARCH_OPEN
      ? '<div class="searchbox"><input type="search" id="search-input" placeholder="見出しから探す（既読も含む）" value="'
        + esc(SEARCH) + '"></div>'
      : "");
  if (SETTINGS_OPEN) {
    h += '<div class="settings">'
      + '<div class="srow"><span>配色</span>'
      + '<button class="tool-btn" type="button" id="toggle-theme">' + themeLabel + "</button></div>"
      + '<div class="srow"><span>文字の大きさ</span>'
      + '<button class="tool-btn" type="button" id="toggle-font">文字 ' + fontLabel + "</button></div>"
      + '<div class="srow"><span>読めない記事（有料・会員限定）</span>'
      + '<button class="tool-btn' + (HIDE_LOCKED ? " on" : "") + '" type="button" id="toggle-locked">'
      + (HIDE_LOCKED ? "隠している" : "表示する") + "</button></div>"
      + '<div class="srow"><span>いま読まないものを片づける</span>'
      + '<button class="tool-btn danger" type="button" id="read-everything">すべて既読</button></div>'
      + '<div class="srow"><span>読んだ記事をふり返る</span>'
      + '<button class="tool-btn" type="button" id="show-read">📖 読んだ記事</button></div>'
      + orderRow()
      + boringRow()
      + troubleRow(sources)
      + '<details class="howto"><summary>使い方</summary><ul>'
      + "<li>カードを<b>右へ払う</b>と既読、<b>左へ払う</b>とお気に入り（払った後5秒は戻せます）</li>"
      + "<li>見出しの<b>「きょうの新着」</b>を押すと、24時間以内に届いた分だけ見られます</li>"
      + "<li>テーマの<b>🔒</b>は、そのテーマの読めない記事をまとめて既読にします</li>"
      + "<li>記事右上の<b>☆</b>は、一覧から消えても残る保存です</li>"
      + "<li>テーマ名を押すと<b>畳めます</b>（並び順は設定の「並べ替え」で変えられます）</li>"
      + "<li><b>📖読んだ記事</b>は、読んだ順にさかのぼって見直せます</li>"
      + "<li>記事の<b>👍</b>は「この発信元をもっと」、<b>👎</b>は「もう要らない」の印です"
      + "（👍は既読にしません）</li>"
      + "<li>見出しの<b>⚠</b>は、取得できなかった配信元がある印です</li>"
      + "</ul></details>"
      + "</div>";
  }
  return h;
}

// ---- お気に入りだけの画面 --------------------------------------------------

function renderFavView(data) {
  const items = Object.keys(FAV).map(function (k) { return FAV[k]; })
    .sort(function (x, y) { return (y.saved_at || 0) - (x.saved_at || 0); });

  const parts = ["<header><h1>★ お気に入り</h1>"
    + '<div class="meta-head">' + headUpdated(data.generated_at)
    + '<button class="newcount on" type="button" id="fav-back">← 全部を見る</button>'
    + '<span class="unread">' + items.length + "件を保存中</span></div>"
    + toolbar(data.sources) + "</header>"];

  if (!items.length) {
    parts.push('<div class="empty">まだありません。記事の右上の ☆ を押すと、'
      + "ここに残せます（一覧から消えても、既読にしても残ります）。</div>");
  } else {
    parts.push('<section class="group"><div class="gitems expanded">');
    items.forEach(function (a) { parts.push(renderCard(a, false, false)); });
    parts.push("</div></section>");
  }
  APP.innerHTML = parts.join("\n");
}

// ---- 読んだ記事の一覧 ------------------------------------------------------
// 既読は「いつ読んだか」も残してある（READ = {記事の鍵: 時刻}）。
// ただし鍵が見出しから作られている記事は元をたどれないので、
// リンクで記録されている分だけを新しい順に並べる。
const READ_VIEW_MAX = 200;

function readHistory() {
  const rows = [];
  Object.keys(READ).forEach(function (k) {
    const a = BY_LINK[k];
    if (a) rows.push({ a: a, at: READ[k] });
  });
  rows.sort(function (x, y) { return (y.at || 0) - (x.at || 0); });
  return rows;
}

function dayLabel(ms) {
  if (!ms) return "いつ読んだか不明";
  const d = new Date(ms), t = new Date();
  const same = function (x, y) { return x.toDateString() === y.toDateString(); };
  if (same(d, t)) return "きょう";
  const y = new Date(t.getTime() - 86400000);
  if (same(d, y)) return "きのう";
  return (d.getMonth() + 1) + "月" + d.getDate() + "日";
}

function renderReadView(data) {
  const rows = readHistory();
  const parts = ["<header><h1>📖 読んだ記事</h1>"
    + '<div class="meta-head">'
    + '<button class="newcount on" type="button" id="read-back">← 全部を見る</button>'
    + '<span class="unread">' + rows.length + "件</span></div>"
    + toolbar(data.sources) + "</header>"];

  if (!rows.length) {
    parts.push('<div class="empty">まだありません。読んだ記事がここに新しい順で並びます。</div>');
  } else {
    let day = "";
    parts.push('<section class="group">');
    rows.slice(0, READ_VIEW_MAX).forEach(function (r) {
      const label = dayLabel(r.at);
      if (label !== day) {
        day = label;
        parts.push('<div class="minor-sep"><span>' + esc(label) + "</span></div>");
      }
      parts.push('<div class="gitems expanded">' + renderCard(r.a, false, false) + "</div>");
    });
    if (rows.length > READ_VIEW_MAX) {
      parts.push('<div class="empty">ほかに ' + (rows.length - READ_VIEW_MAX) + "件あります。</div>");
    }
    parts.push("</section>");
  }
  parts.push('<div class="empty"><small>見出しだけで既読にした記事（同じ記事が別の経路で'
    + "届いた分など）は、元をたどれないためここには出ません。</small></div>");
  APP.innerHTML = parts.join("");
}

// ---- きょうの新着だけの画面 ------------------------------------------------
// 新着があっても、どのテーマにあるかスクロールして探すしかなかった。
// テーマの並びは feeds.json 順のまま動かさず（毎日同じ場所にある安心感を保つ）、
// 別の入口として「新着だけ」を集める。

function renderFreshView(data) {
  const blocks = ALL_GROUPS.map(function (x) {
    const items = (x.group.items || []).filter(isFresh);
    return items.length ? { name: x.group.name, cat: x.cat, items: items } : null;
  }).filter(Boolean);
  const total = blocks.reduce(function (n, b) { return n + b.items.length; }, 0);

  const parts = ["<header><h1>⚡ きょうの新着</h1>"
    + '<div class="meta-head">' + headUpdated(data.generated_at)
    + '<button class="newcount on" type="button" id="show-fresh">← 全部を見る</button>'
    + '<span class="unread">' + total + "件</span></div>"
    + toolbar(data.sources) + "</header>"];

  if (!blocks.length) {
    parts.push('<div class="empty">きょう届いた記事はまだありません。'
      + "「← 全部を見る」で貯めてある記事を読めます。</div>");
  } else {
    blocks.forEach(function (b) {
      parts.push('<section class="group"><h3 class="ghead">'
        + '<span class="gname">' + esc(b.name) + "</span>"
        + '<span class="gcount">' + b.items.length + "件</span>"
        + '<span class="gcat">' + esc(b.cat) + "</span>"
        + '<button class="read-all" type="button" data-fresh="' + esc(b.name)
        + '" title="このテーマの新着をまとめて既読にする">✓ 既読に</button></h3>'
        + '<div class="gitems expanded">'
        + b.items.map(function (a) { return renderCard(a, false, false); }).join("")
        + "</div></section>");
    });
  }
  APP.innerHTML = parts.join("\n");
}

// 掘り出した古い記事だけを並べる。
// 「古い＝価値がない」ではないので、消さずに分けて置く。
function renderFoundView(data) {
  const pick = FOUND_TODAY ? isFoundToday : isFound;
  const blocks = ALL_GROUPS.map(function (x) {
    const items = (x.group.items || []).filter(pick);
    return items.length ? { name: x.group.name, cat: x.cat, items: items } : null;
  }).filter(Boolean);
  const total = blocks.reduce(function (t, b) { return t + b.items.length; }, 0);
  let today = 0, week = 0;
  ALL_GROUPS.forEach(function (x) {
    (x.group.items || []).forEach(function (a) {
      if (isFound(a)) { week += 1; if (isFoundToday(a)) today += 1; }
    });
  });

  const parts = ["<header><h1>⛏ 発掘した記事</h1>"
    + '<div class="meta-head">'
    + '<button class="newcount on" type="button" id="show-found">← 全部を見る</button>'
    + '<span class="unread">' + total + "件</span></div>"
    + '<div class="tools">'
    + '<button class="tool-btn' + (FOUND_TODAY ? " on" : "") + '" type="button" '
    + 'data-found-span="today">きょう ' + today + "件</button>"
    + '<button class="tool-btn' + (FOUND_TODAY ? "" : " on") + '" type="button" '
    + 'data-found-span="week">この1週間 ' + week + "件</button></div>"
    + toolbar(data.sources) + "</header>"
    + '<div class="note">新しく見つけた、少し前の記事です'
    + "（配信から" + NEW_MAX_AGE_DAYS + "日以上たっているもの）。</div>"];

  if (!blocks.length) {
    parts.push('<div class="empty">掘り出した記事はまだありません。</div>');
  } else {
    blocks.forEach(function (b) {
      parts.push('<section class="group"><h3 class="ghead">'
        + '<span class="gname">' + esc(b.name) + "</span>"
        + '<span class="gcount">' + b.items.length + "件</span>"
        + '<span class="gcat">' + esc(b.cat) + "</span>"
        + '<button class="read-all" type="button" data-found="' + esc(b.name)
        + '" title="このテーマの発掘分をまとめて既読にする">✓ 既読に</button></h3>'
        + '<div class="gitems expanded">'
        + b.items.map(function (a) { return renderCard(a, false, false); }).join("")
        + "</div></section>");
    });
  }
  APP.innerHTML = parts.join("\n");
}

// ---- 探した結果 ------------------------------------------------------------

function normForSearch(t) {
  return String(t == null ? "" : t).normalize("NFKC").toLowerCase();
}

function searchHits(word) {
  const q = normForSearch(word);
  const hits = [];
  if (!q) return hits;
  ALL_GROUPS.forEach(function (x) {
    (x.group.items || []).forEach(function (a) {
      // 見出しに加えて配信元も見る（「ロイター」「日経」で絞りたくなるため）
      if (normForSearch(a.title).indexOf(q) >= 0
          || (a.via && normForSearch(a.via).indexOf(q) >= 0)) {
        hits.push({ theme: x.group.name, a: a });
      }
    });
  });
  hits.sort(function (p, r) { return (r.a.dt || "").localeCompare(p.a.dt || ""); });
  return hits;
}

// 検索結果の中身だけを組み立てる。画面全体を作り直さないのが肝心で、
// 作り直すと入力欄そのものが消え、日本語入力の変換が途中で壊れる
// （「よしゆき」と打っている最中に欄が入れ替わり、変換できなくなっていた）。
function searchResultsHTML(hits) {
  if (!SEARCH) {
    return '<div class="empty">探したい言葉を入れてください（既読も含めて探します）。</div>';
  }
  if (!hits.length) {
    return '<div class="empty">' + esc(SEARCH) + "にあてはまる記事はありませんでした。<br>"
      + "<small>集めていないテーマの記事は、ここにも出てきません。</small></div>";
  }
  const parts = ['<section class="group"><div class="gitems expanded">'];
  hits.slice(0, SEARCH_MAX).forEach(function (h) {
    parts.push(renderCard(h.a, false, false));
  });
  parts.push("</div>");
  if (hits.length > SEARCH_MAX) {
    parts.push('<div class="empty">ほかに ' + (hits.length - SEARCH_MAX)
      + "件あります。言葉を足すと絞り込めます。</div>");
  }
  parts.push("</section>");
  return parts.join("");
}

// 入力のたびに呼ぶ。触るのは件数と結果の2か所だけ。
function updateSearchResults() {
  const box = document.getElementById("search-results");
  if (!box) { rerender(); return; }
  const hits = searchHits(SEARCH);
  box.innerHTML = searchResultsHTML(hits);
  const c = document.getElementById("search-count");
  if (c) c.textContent = SEARCH ? hits.length + "件みつかりました" : "";
}

function renderSearchView(data) {
  const hits = searchHits(SEARCH);
  APP.innerHTML = "<header><h1>🔍 探す</h1>"
    + '<div class="meta-head">'
    + '<button class="newcount on" type="button" id="close-search">← 全部を見る</button>'
    + '<span class="unread" id="search-count">'
    + (SEARCH ? hits.length + "件みつかりました" : "") + "</span></div>"
    + toolbar(data.sources) + "</header>"
    + '<div id="search-results">' + searchResultsHTML(hits) + "</div>";
}

// ---- 通常の画面 ------------------------------------------------------------

function render(data) {
  if (SHOW_READ) { renderReadView(data); return; }
  if (SHOW_FAV) { renderFavView(data); return; }
  if (SEARCH_OPEN) { renderSearchView(data); return; }
  if (SHOW_FRESH) { renderFreshView(data); return; }
  if (SHOW_FOUND) { renderFoundView(data); return; }

  const parts = [];
  // 動画は記事と分けて扱う（見る時間帯が違うため）
  const articleGroups = ALL_GROUPS.filter(function (x) { return !x.video; });
  const videoGroups = ALL_GROUPS.filter(function (x) { return x.video; });

  // 見出しの数字は記事と動画をまとめた全体。
  // 記事だけで数えると「きょうの新着」画面（動画も並ぶ）と食い違う。
  let totalUnread = 0, totalNew = 0, totalFound = 0, totalFoundToday = 0;
  ALL_GROUPS.forEach(function (x) {
    totalUnread += countUnread(x.group.items);
    totalNew += (x.group.items || []).filter(isFresh).length;
    totalFound += (x.group.items || []).filter(isFound).length;
    totalFoundToday += (x.group.items || []).filter(isFoundToday).length;
  });
  let videoUnread = 0, videoNew = 0;
  videoGroups.forEach(function (x) {
    videoUnread += countUnread(x.group.items);
    videoNew += (x.group.items || []).filter(isFresh).length;
  });

  parts.push("<header><h1>📰 マイニュース</h1>"
    + '<div class="meta-head">' + headUpdated(data.generated_at)
    // 「未読1624件」は読み切れる数ではなく、指標として働かない。
    // 今日読むべき「新着」を主役にし、貯まっている数は控えめに添える。
    + (totalNew
      ? '<button class="newcount" type="button" id="show-fresh">きょうの新着 '
        + totalNew + "件</button>"
      : '<span class="nonew">きょうの新着はありません</span>')
    + (totalFoundToday
      ? '<button class="newcount found-btn" type="button" id="show-found">'
        + "⛏ きょうの発掘 " + totalFoundToday + "件</button>"
      : (totalFound
        ? '<button class="newcount found-btn" type="button" id="show-found">⛏ 発掘 '
          + totalFound + "件</button>"
        : ""))
    + '<span class="unread">未読 ' + totalUnread + "件</span>"
    + "</div>"
    + weatherLine(data.weather)
    + toolbar(data.sources) + "</header>");

  const cats = (data.categories || []).map(function (c) { return c.name; });
  const navs = cats.map(function (name, i) {
    let u = 0, n = 0;
    articleGroups.forEach(function (x) {
      if (x.cat !== name) return;
      u += countUnread(x.group.items);
      n += (x.group.items || []).filter(isFresh).length;
    });
    const mine = articleGroups.some(function (x) { return x.cat === name; });
    if (!mine) return "";   // 動画だけのカテゴリは、下の動画ブロックに現れる
    return '<a class="nav-chip" href="#cat' + i + '" style="--cat:'
      + CAT_COLORS[i % CAT_COLORS.length] + '">' + esc(name)
      + (n ? '<b class="navnew">' + n + "</b>" : "")
      + "<span>" + u + "</span></a>";
  }).join("");
  parts.push('<nav class="catnav">' + navs
    + (videoGroups.length
      ? '<a class="nav-chip" href="#videos" style="--cat:#dc2626">🎬 動画'
        + (videoNew ? '<b class="navnew">' + videoNew + "</b>" : "")
        + "<span>" + videoUnread + "</span></a>"
      : "")
    + "</nav>");

  cats.forEach(function (name, ci) {
    const mine = sortByOrder(articleGroups.filter(function (x) { return x.cat === name; }));
    if (!mine.length) return;   // 動画だけのカテゴリは下の動画ブロックへ
    const daily = mine;
    let body = daily.map(function (x) {
      return renderGroup(x.group, ALL_GROUPS.indexOf(x));
    }).join("");
    let unread = 0, fresh = 0;
    mine.forEach(function (x) { unread += countUnread(x.group.items); });
    // 「ときどき見る」は新着に数えない。毎朝の数字を実態に合わせるため。
    daily.forEach(function (x) {
      fresh += (x.group.items || []).filter(isFresh).length;
    });

    parts.push('<details class="cat"' + (isOpen(name) ? " open" : "")
      + ' data-cat="' + esc(name) + '" id="cat' + ci + '" style="--cat:'
      + CAT_COLORS[ci % CAT_COLORS.length] + '">');
    parts.push("<summary><h2>" + esc(name)
      + '<span class="catcount">'
      + (fresh ? '<b class="catnew">新着 ' + fresh + "</b>" : "")
      + unread + "件</span></h2></summary>");
    parts.push('<div class="body">');
    parts.push(body || (SHOW_ALL
      ? '<div class="empty">この時間は取得できた記事がありませんでした。</div>'
      : '<div class="empty">すべて読み終えました 🎉</div>'));
    parts.push("</div></details>");
  });

  // 動画は最下部の独立ブロックへ。記事とは読む時間帯が違うため枠で分ける
  // （閉じてはおかない。分かれてさえいれば、そのまま見られるほうが良い）。
  if (videoGroups.length) {
    const body = videoGroups.map(function (x) {
      return renderGroup(x.group, ALL_GROUPS.indexOf(x));
    }).join("");
    parts.push('<details class="cat videos"' + (isOpen("__videos") ? " open" : "")
      + ' data-cat="__videos" id="videos" style="--cat:#dc2626">');
    parts.push('<summary><h2>🎬 動画'
      + '<span class="catcount">'
      + (videoNew ? '<b class="catnew">新着 ' + videoNew + "</b>" : "")
      + videoUnread + "件</span></h2></summary>");
    parts.push('<div class="body">');
    parts.push(body || '<div class="empty">すべて見終えました 🎉</div>');
    parts.push("</div></details>");
  }

  parts.push(stockBlock(data.stocks));
  parts.push(versionBlock(data.generated_at));

  if (window.console && console.table) {
    console.groupCollapsed("マイニュース 取得サマリー");
    console.table(data.sources || []);
    console.groupEnd();
  }
  if (DEBUG) {
    parts.push('<footer><details class="diag" open><summary>診断情報（取得サマリー）</summary><table>');
    (data.sources || []).forEach(function (s) {
      const ok = (s.status || "").startsWith("OK");
      parts.push("<tr><td>" + esc(s.name) + "</td>"
        + '<td class="' + (ok ? "st-ok" : "st-ng") + '">' + esc(s.status) + "</td></tr>");
    });
    parts.push("</table></details></footer>");
  }

  // 選択中は画面下に操作バーを出す
  if (SELECT_MODE) {
    parts.push('<div class="pickspacer"></div>');   // 固定バーで最後の記事が隠れないように
    parts.push('<div class="pickbar">'
      + '<span id="pick-count">' + pickLabel() + "</span>"
      + '<button class="pick-btn" type="button" id="pick-clear">やめる</button>'
      + '<button class="pick-btn go" type="button" id="pick-read">既読にする</button></div>');
  }

  APP.innerHTML = parts.join("\n");
}

// 下のバーの文言。0件のときは何をすればよいかを書く。
function pickLabel() {
  return SELECTED.size
    ? SELECTED.size + "件を選択中"
    : "読んだ記事を押してください";
}

function rerender() {
  render(window.NEWS_DATA);
  applyPrefs();
}

// テーマ内の記事をまとめて既読にする
function markGroupRead(items) {
  const now = Date.now();
  (items || []).forEach(function (a) {
    if (a.link) READ[a.link] = now;
    const k = titleKey(a);
    if (k) READ[k] = now;
  });
}

// ---- 操作 ---------------------------------------------------------------

APP.addEventListener("click", function (ev) {
  // ---- 選択モード中の操作 ----
  if (SELECT_MODE) {
    if (ev.target.closest("#pick-clear")) {
      SELECTED.clear();
      rerender();
      return;
    }
    if (ev.target.closest("#pick-read")) {
      SELECTED.forEach(function (key) {
        const a = BY_LINK[key] || { link: key, title: "" };
        markRead(a);
      });
      SELECTED.clear();
      SELECT_MODE = false;
      rerender();
      return;
    }
    // カードのどこを押しても選択が切り替わる（記事は開かない）
    const card = ev.target.closest(".card");
    if (card && card.dataset.key) {
      ev.preventDefault();
      const key = card.dataset.key;
      if (SELECTED.has(key)) {
        SELECTED.delete(key);
        card.classList.remove("picked");
      } else {
        SELECTED.add(key);
        card.classList.add("picked");
      }
      const mark = card.querySelector(".pick");
      if (mark) {
        mark.textContent = SELECTED.has(key) ? "☑" : "☐";
        mark.classList.toggle("on", SELECTED.has(key));
      }
      // 数だけ書き換える（全体を描き直すと選ぶたびに重くなる）
      const n = document.getElementById("pick-count");
      if (n) n.textContent = pickLabel();
      return;
    }
  }
  // 「選ぶ」の切り替え
  // 👍 良かった（記事は開かない・既読にもしない）
  const goodBtn = ev.target.closest(".good");
  if (goodBtn) {
    ev.preventDefault();
    const key = goodBtn.dataset.good;
    const a = BY_LINK[key] || FAV[key];
    if (!a) return;
    if (GOODED[key]) {          // もう一度押したら取り消し
      const k2 = sourceOf(a);
      if (GOOD[k2]) { GOOD[k2] -= 1; if (!GOOD[k2]) delete GOOD[k2]; }
      delete GOODED[key];
      lsSet(GOOD_KEY, JSON.stringify(GOOD));
      lsSet(GOODED_KEY, JSON.stringify(GOODED));
      toast("👍 を取り消しました");
    } else {
      tally(GOOD_KEY, GOOD, a);
      GOODED[key] = 1;
      lsSet(GOODED_KEY, JSON.stringify(GOODED));
      toast("👍 " + sourceOf(a) + " を覚えました");
    }
    const y0 = window.scrollY;
    rerender();
    window.scrollTo(0, y0);
    return;
  }
  // 👎 つまらない（記事は開かない）
  const boring = ev.target.closest(".boring");
  if (boring) {
    ev.preventDefault();
    const a = BY_LINK[boring.dataset.boring] || FAV[boring.dataset.boring];
    if (!a) return;
    tally(BORING_KEY, BORING, a);
    markRead(a);
    pushUndo("つまらないとして片づけました", function () {
      const k = sourceOf(a);
      if (BORING[k]) { BORING[k] -= 1; if (!BORING[k]) delete BORING[k]; }
      lsSet(BORING_KEY, JSON.stringify(BORING));
      if (a.link) delete READ[a.link];
      const t = titleKey(a);
      if (t) delete READ[t];
      saveRead(READ);
    });
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
    return;
  }
  // ★お気に入りの登録・解除（記事は開かない）
  const fav = ev.target.closest(".fav");
  if (fav) {
    ev.preventDefault();
    const key = fav.dataset.fav;
    const a = BY_LINK[key] || FAV[key];
    if (a) { toggleFav(a); rerender(); }
    return;
  }
  // 「もっと見る」：そのテーマだけ表示件数を増やす
  const more = ev.target.closest(".more-btn");
  if (more) {
    const name = more.dataset.older;
    UI.shown[name] = (UI.shown[name] || INITIAL_VISIBLE) + RENDER_CHUNK;
    saveUI();
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
    return;
  }
  // 「読み返す」：そのテーマだけ既読も表示する
  const reread = ev.target.closest(".reread-btn");
  if (reread) {
    REREAD[reread.dataset.reread] = true;
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
    return;
  }
  // テーマ単位のまとめて既読
  // 新着画面のボタンは別に扱うので、ここでは拾わない
  const readAll = ev.target.closest(".read-all:not([data-fresh])");
  if (readAll) {
    const gi = Number(readAll.closest(".group").dataset.group);
    const entry = ALL_GROUPS[gi];
    if (entry) {
      markGroupRead(entry.group.items);
      saveRead(READ);
      rerender();
    }
    return;
  }
  // テーマ名を押して最小化／元に戻す
  const fold = ev.target.closest(".gname[data-fold]");
  if (fold) {
    const key = "fold:" + fold.dataset.fold;
    UI.cats[key] = (UI.cats[key] === false);
    saveUI();
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
    return;
  }
  // 読めない記事を隠す／表示する
  if (ev.target.closest("#toggle-locked")) {
    HIDE_LOCKED = !HIDE_LOCKED;
    lsSet(HIDELOCK_KEY, HIDE_LOCKED ? "1" : "0");
    rerender();
    return;
  }
  // 新着画面で、そのテーマの新着をまとめて既読にする
  const readFound = ev.target.closest(".read-all[data-found]");
  if (readFound) {
    const entry = ALL_GROUPS.find(function (x) { return x.group.name === readFound.dataset.found; });
    if (!entry) return;
    const items = (entry.group.items || []).filter(FOUND_TODAY ? isFoundToday : isFound);
    if (!items.length) return;
    if (!confirm("「" + entry.group.name + "」の発掘分 " + items.length
      + "件を既読にします。よろしいですか？")) return;
    const y0 = window.scrollY;
    items.forEach(markRead);
    rerender();
    window.scrollTo(0, y0);
    return;
  }
  const readFresh = ev.target.closest(".read-all[data-fresh]");
  if (readFresh) {
    const entry = ALL_GROUPS.find(function (x) { return x.group.name === readFresh.dataset.fresh; });
    if (!entry) return;
    const items = (entry.group.items || []).filter(isFresh);
    if (!items.length) return;
    if (!confirm("「" + entry.group.name + "」の新着 " + items.length
      + "件を既読にします。よろしいですか？")) return;
    const y = window.scrollY;
    items.forEach(markRead);
    rerender();
    window.scrollTo(0, y);
    return;
  }
  // お気に入り画面から戻る
  if (ev.target.closest("#fav-back")) {
    SHOW_FAV = false;
    lsSet(SHOWFAV_KEY, "0");
    rerender();
    window.scrollTo(0, 0);
    return;
  }
  // 「きょうの新着だけ」の切り替え
  if (ev.target.closest("#show-fresh")) {
    SHOW_FRESH = !SHOW_FRESH;
    if (SHOW_FRESH) SHOW_FOUND = false;
    rerender();
    return;
  }
  const foundSpan = ev.target.closest("[data-found-span]");
  if (foundSpan) {
    FOUND_TODAY = (foundSpan.dataset.foundSpan === "today");
    rerender();
    return;
  }
  if (ev.target.closest("#show-found")) {
    SHOW_FOUND = !SHOW_FOUND;
    if (SHOW_FOUND) {
      SHOW_FRESH = false; SHOW_FAV = false;
      const today = ALL_GROUPS.reduce(function (t, x) {
        return t + (x.group.items || []).filter(isFoundToday).length;
      }, 0);
      FOUND_TODAY = today > 0;   // きょうの分が無ければ1週間分を見せる
    }
    rerender();
    window.scrollTo(0, 0);
    return;
  }
  // つまらないと押した記録
  if (ev.target.closest("#show-boring")) {
    BORING_OPEN = !BORING_OPEN;
    rerender();
    return;
  }
  // 届かなかったフィードの内訳
  if (ev.target.closest("#show-trouble")) {
    TROUBLE_OPEN = !TROUBLE_OPEN;
    rerender();
    return;
  }
  // 探す窓の開閉
  if (ev.target.closest("#toggle-search")) {
    SEARCH_OPEN = !SEARCH_OPEN;
    if (!SEARCH_OPEN) SEARCH = "";
    rerender();
    const box = document.getElementById("search-input");
    if (box) box.focus();
    window.scrollTo(0, 0);
    return;
  }
  if (ev.target.closest("#close-search")) {
    SEARCH = ""; SEARCH_OPEN = false;
    rerender();
    window.scrollTo(0, 0);
    return;
  }
  // 読んだ記事の一覧
  if (ev.target.closest("#show-read")) {
    SHOW_READ = true; SEARCH_OPEN = false; SEARCH = ""; SHOW_FAV = false;
    rerender();
    window.scrollTo(0, 0);
    return;
  }
  if (ev.target.closest("#read-back")) {
    SHOW_READ = false;
    rerender();
    window.scrollTo(0, 0);
    return;
  }
  // テーマの並べ替え
  if (ev.target.closest("#toggle-order")) {
    ORDER_OPEN = !ORDER_OPEN;
    rerender();
    return;
  }
  if (ev.target.closest("#order-reset")) {
    ORDER = {};
    lsSet(ORDER_KEY, "{}");
    rerender();
    return;
  }
  const mv = ev.target.closest("[data-move]");
  if (mv) {
    moveTheme(mv.dataset.name, mv.dataset.move);
    rerender();
    return;
  }
  // 設定の開閉
  if (ev.target.closest("#toggle-settings")) {
    SETTINGS_OPEN = !SETTINGS_OPEN;
    rerender();
    return;
  }
  // すべて既読（取り返しがつかないので確認する）
  if (ev.target.closest("#read-everything")) {
    if (!confirm("表示中のすべての記事を既読にします。よろしいですか？")) return;
    ALL_GROUPS.forEach(function (x) { markGroupRead(x.group.items); });
    saveRead(READ);
    rerender();
    window.scrollTo(0, 0);
    return;
  }
  // 「お気に入りだけ表示」の切り替え
  if (ev.target.closest("#toggle-fav")) {
    SHOW_FAV = !SHOW_FAV;
    if (SHOW_FAV) SHOW_FRESH = false;
    lsSet(SHOWFAV_KEY, SHOW_FAV ? "1" : "0");
    rerender();
    window.scrollTo(0, 0);
    return;
  }
  // 「既読も表示」の切り替え
  if (ev.target.closest("#toggle-read")) {
    SHOW_ALL = !SHOW_ALL;
    lsSet(SHOWALL_KEY, SHOW_ALL ? "1" : "0");
    rerender();
    window.scrollTo(0, 0);
    return;
  }
  // 配色の切り替え（自動 → 明るい → 暗い）
  if (ev.target.closest("#toggle-theme")) {
    THEME = { auto: "light", light: "dark", dark: "auto" }[THEME] || "auto";
    lsSet(THEME_KEY, THEME);
    rerender();
    return;
  }
  // 文字サイズの切り替え（中 → 大 → 小）
  if (ev.target.closest("#toggle-font")) {
    FONT = { m: "l", l: "s", s: "m" }[FONT] || "m";
    lsSet(FONT_KEY, FONT);
    rerender();
    return;
  }
  // 記事を開いたら既読にする（その場では消さず、次に開いたときに消える）
  const link = ev.target.closest("a[data-link]");
  if (link) {
    if (swDone) { swDone = false; ev.preventDefault(); return; }
    const a = BY_LINK[link.dataset.link] || { link: link.dataset.link, title: "" };
    tally(OPENED_KEY, OPENED, a);
    markRead(a);
    const card = link.closest(".card");
    if (card) card.classList.add("read");
  }
});

// ---- 指で払って仕分ける（スワイプ）--------------------------------------
// 右へ払う＝既読、左へ払う＝お気に入り。
//
// 気をつけること3つ:
//  1) Androidは画面の左右どちらの端からのスワイプも「戻る」になる。
//     端から始まった指の動きは相手にしない。
//  2) 縦に送りたいのか横に払いたいのか、動き始めは分からない。
//     横の動きが縦よりはっきり大きくなってから初めてカードを動かす。
//  3) 指1本で完結してしまうので誤操作が起きる。必ず「元に戻す」を出す。

const SWIPE_EDGE = 30;        // 画面の端から何pxを「戻る」用に空けるか
const SWIPE_START = 12;       // これだけ動いたら向きを判定する
const SWIPE_RATIO = 1.4;      // 横が縦のこの倍を超えたら「横に払った」とみなす
const SWIPE_MIN = 60;         // 仕分けが成立する最小の距離(px)

let swCard = null, swArticle = null, swX = 0, swY = 0, swDX = 0, swLock = "", swDone = false;

function swipeHint(kind, ready) {
  let el = document.getElementById("swipe-hint");
  if (!kind) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement("div");
    el.id = "swipe-hint";
    document.body.appendChild(el);
  }
  el.textContent = kind === "read" ? "✓ 既読にする" : "★ お気に入りに入れる";
  el.className = kind + (ready ? " ready" : "");
}

// 取り消しは直前の1件だけだと、続けて払ったときに戻せない。
// 直近5件まで覚えておき、押すたびに1件ずつ戻す。
const UNDO_MAX = 5;
let UNDO_STACK = [];
let UNDO_TIMER = null;

function pushUndo(msg, undo) {
  UNDO_STACK.push({ msg: msg, undo: undo });
  if (UNDO_STACK.length > UNDO_MAX) UNDO_STACK.shift();
  showToast();
}

// 「元に戻す」の要らない短い知らせ
function toast(msg) {
  const old = document.getElementById("toast");
  if (old) old.remove();
  if (UNDO_TIMER) clearTimeout(UNDO_TIMER);
  const el = document.createElement("div");
  el.id = "toast";
  el.innerHTML = "<span>" + esc(msg) + "</span>";
  document.body.appendChild(el);
  UNDO_TIMER = setTimeout(function () { el.remove(); }, 2500);
}

function showToast() {
  const old = document.getElementById("toast");
  if (old) old.remove();
  if (UNDO_TIMER) clearTimeout(UNDO_TIMER);
  if (!UNDO_STACK.length) return;

  const last = UNDO_STACK[UNDO_STACK.length - 1];
  const rest = UNDO_STACK.length - 1;
  const el = document.createElement("div");
  el.id = "toast";
  el.innerHTML = "<span>" + esc(last.msg)
    + (rest ? '<i class="more">あと' + rest + "件戻せます</i>" : "") + "</span>"
    + '<button type="button" id="toast-undo">元に戻す</button>';
  document.body.appendChild(el);
  UNDO_TIMER = setTimeout(function () {
    el.remove();
    UNDO_STACK = [];
  }, 5000);

  el.querySelector("#toast-undo").addEventListener("click", function () {
    const item = UNDO_STACK.pop();
    if (item) item.undo();
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
    showToast();   // まだ残っていれば続けて戻せる
  });
}

function swipeThreshold(card) {
  return Math.max(SWIPE_MIN, card.getBoundingClientRect().width * 0.25);
}

APP.addEventListener("touchstart", function (ev) {
  swCard = null; swLock = ""; swDX = 0; swDone = false;
  if (SELECT_MODE || ev.touches.length !== 1) return;
  const t = ev.touches[0];
  // 画面の端は「戻る」に譲る
  if (t.clientX < SWIPE_EDGE || t.clientX > window.innerWidth - SWIPE_EDGE) return;
  const card = ev.target.closest(".card");
  if (!card || !card.dataset.key) return;
  swCard = card;
  swArticle = BY_LINK[card.dataset.key] || FAV[card.dataset.key];
  swX = t.clientX; swY = t.clientY;
}, { passive: true });

APP.addEventListener("touchmove", function (ev) {
  if (!swCard || !swArticle) return;
  const t = ev.touches[0];
  const dx = t.clientX - swX, dy = t.clientY - swY;
  if (!swLock) {
    if (Math.abs(dy) > SWIPE_START && Math.abs(dy) >= Math.abs(dx)) { swCard = null; return; }
    if (Math.abs(dx) < SWIPE_START || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return;
    swLock = "x";
    swCard.classList.add("swiping");
  }
  swDX = dx;
  ev.preventDefault();          // 横に払っている間は画面を動かさない
  swCard.style.transform = "translateX(" + dx + "px)";
  swCard.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / 320));
  swipeHint(dx > 0 ? "read" : "fav", Math.abs(dx) >= swipeThreshold(swCard));
}, { passive: false });

APP.addEventListener("touchend", function () {
  if (!swCard) { swipeHint(""); return; }
  const card = swCard, a = swArticle, dx = swDX;
  swCard = null; swipeHint("");
  card.classList.remove("swiping");
  if (!swLock || Math.abs(dx) < swipeThreshold(card)) {
    card.style.transform = ""; card.style.opacity = "";
    return;
  }
  swDone = true;               // 直後の click で記事を開かないための目印
  card.classList.add("sw-out");
  card.style.transform = "translateX(" + (dx > 0 ? 1 : -1) * 400 + "px)";
  card.style.opacity = "0";
  setTimeout(function () {
    const y = window.scrollY;
    if (dx > 0) {
      const link = a.link, key = titleKey(a);
      markRead(a);
      pushUndo("既読にしました", function () {
        if (link) delete READ[link];
        if (key) delete READ[key];
        saveRead(READ);
      });
    } else {
      const was = isFav(a);
      toggleFav(a);
      pushUndo(was ? "お気に入りから外しました" : "お気に入りに入れました",
        function () { toggleFav(a); });
    }
    rerender();
    window.scrollTo(0, y);
  }, 180);
}, { passive: true });

// 折りたたみの開閉を保存する。
// toggle は親へ伝わらないイベントなので、捕まえる段階（第3引数 true）で拾う。
document.addEventListener("toggle", function (ev) {
  const d = ev.target;
  if (!d || !d.matches || !d.matches("details.cat")) return;
  const key = d.dataset.cat;
  if (!key) return;
  UI.cats[key] = d.open;
  saveUI();
}, true);

let SEARCH_TIMER = null;
let COMPOSING = false;   // 日本語を変換している最中かどうか

function scheduleSearch(value, wait) {
  if (SEARCH_TIMER) clearTimeout(SEARCH_TIMER);
  // 1文字打つたびに1900件を探し直すと指が重くなるので、少し待つ
  SEARCH_TIMER = setTimeout(function () {
    SEARCH = value.trim();
    updateSearchResults();
  }, wait);
}

// 変換中（「よしゆき」を「吉行」にしている最中）は数えに行かない。
// 画面をいじると変換が中断され、目当ての字が打てなくなるため。
APP.addEventListener("compositionstart", function (ev) {
  if (ev.target.matches("#search-input")) COMPOSING = true;
});
APP.addEventListener("compositionend", function (ev) {
  if (!ev.target.matches("#search-input")) return;
  COMPOSING = false;
  scheduleSearch(ev.target.value, 0);   // 確定したらすぐ探す
});
APP.addEventListener("input", function (ev) {
  if (!ev.target.matches("#search-input")) return;
  if (COMPOSING) return;
  scheduleSearch(ev.target.value, 250);
});

// data.js（<script src> で先に読み込まれ window.NEWS_DATA に入っている）を描画。
try {
  const data = window.NEWS_DATA;
  if (!data) throw new Error("data.js が読み込まれていません（build_news.py を実行してください）");
  applyPrefs();
  render(data);
  // ※「最後に開いた時刻」の記録は上（NEW_BASE の算出直後）で済ませている。
  //   ここで更新すると、再読み込みのたびに基準が動いて NEW が消えてしまう。
} catch (err) {
  APP.innerHTML = '<div class="loaderr">ニュースデータを読み込めませんでした。'
    + "<br><small>" + esc(String(err)) + "</small></div>";
}
