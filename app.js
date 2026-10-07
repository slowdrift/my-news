// マイニュース 表示スクリプト
// data.js（build_news.py が生成し window.NEWS_DATA に入る）を、
// カテゴリ → テーマ(group) → 記事 の順に描画する。
//
// 既読管理：一度開いた記事は既定で一覧から消える（読むほどスクロールが短くなる）。
// 「既読も表示」に切り替えれば読み返せる。設定はこの端末のブラウザにだけ保存される。

"use strict";

const APP = document.getElementById("app");

// 画面最下部に出す版と更新履歴。改修のたびにここへ1行足す。
const APP_VERSION = "v1.30.0";
const CHANGELOG = [
  ["v1.30.0", "2026-10-07", "生成AIの使いこなしから導入ニュースを外し、自治体の成果事例を別テーマに。Claude Code は読む傾向の記事を前に"],
  ["v1.29.0", "2026-10-07", "端末の記録をファイルに書き出し・読み込めるように。既読にした操作（開いた・片づけた等）も記録"],
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

// 書庫のテーマは、既定で畳んでおく（目次として使う）。
// 朝刊を上に置いたので、書庫はまず「どのテーマがあるか」を1行ずつ見せ、読みたいものだけ開く。
// （以前は既定で開いていて、朝刊の下に記事カードが54枚続いていた）
function isFolded(name) { return UI.cats["fold:" + name] !== true; }

// すべてのテーマが閉じているか（＝「目次」の状態か）
function allFolded() {
  return ALL_GROUPS.length > 0 && ALL_GROUPS.every(function (x) { return isFolded(x.group.name); });
}

// 全部閉じて「目次」にする／全部開く。
// 毎朝は新着の有無だけ見たいことが多く、20テーマ・54枚のカードを
// スクロールして探すのは手間だった。閉じるとテーマが1行ずつ並ぶ。
// 次に開いたときも同じ状態のまま（端末に覚えさせる）。
function setAllFolded(fold) {
  ALL_GROUPS.forEach(function (x) {
    if (fold) delete UI.cats["fold:" + x.group.name];
    else UI.cats["fold:" + x.group.name] = true;
  });
  // 目次を見るためにカテゴリの枠は開けておく
  Object.keys(UI.cats).forEach(function (k) {
    if (k.indexOf("fold:") !== 0 && k.indexOf("sec:") !== 0 && UI.cats[k] === false) delete UI.cats[k];
  });
  saveUI();
}

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

// どの操作で既読にしたかの記録（v1.29.0 から）。分析で「開いた記事」と
// 「開かずに流した記事」を分けるため。READ は鍵と時刻しか持たず、蓄積から消えた記事は
// 何だったか分からないので、テーマと見出しもここに残す。
// 1行 = [時刻(ms), 操作, 画面, テーマ, 見出し, 発信元]。操作・画面の略号は HOW_LABEL / WHERE_LABEL。
const READLOG_KEY = "mynews_readlog";
const READLOG_MAX = 5000;      // 既読の記録と同じく、超えたら古いものから減らす
const READLOG_TITLE_MAX = 80;  // 見出しはこの文字数で切る（保存領域を圧迫しないため）

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

function loadReadLog() {
  try {
    const v = JSON.parse(lsGet(READLOG_KEY, "[]") || "[]");
    // 形の崩れた行（時刻が数でない等）は捨てる
    return Array.isArray(v) ? v.filter(function (r) { return Array.isArray(r) && typeof r[0] === "number"; }) : [];
  } catch (e) { return []; }
}

// 保存に失敗しても既読そのものは READ に入っているので、動きは変わらない。
// 端末の保存領域がいっぱいのときだけ、古い半分を捨てて1回やり直す。
function saveReadLog() {
  if (READLOG.length > READLOG_MAX) READLOG = READLOG.slice(READLOG.length - READLOG_MAX);
  try {
    localStorage.setItem(READLOG_KEY, JSON.stringify(READLOG));
  } catch (e) {
    READLOG = READLOG.slice(Math.floor(READLOG.length / 2));
    lsSet(READLOG_KEY, JSON.stringify(READLOG));
  }
}

let READLOG = loadReadLog();

// 既読にした記事を、操作の種類と一緒に記録する。返した行は「元に戻す」で消すのに使う。
function logRead(items, how, where) {
  const now = Date.now();
  const rows = (items || []).map(function (a) {
    return [now, how, where || "", GROUP_OF[a.link] || "",
      String(a.title || "").slice(0, READLOG_TITLE_MAX), sourceOf(a)];
  });
  if (!rows.length) return rows;
  rows.forEach(function (r) { READLOG.push(r); });
  saveReadLog();
  return rows;
}

// 「元に戻す」を押したら記録からも外す（流したと誤って数えないため）
function unlogRead(rows) {
  if (!rows || !rows.length) return;
  const drop = new Set(rows);
  READLOG = READLOG.filter(function (r) { return !drop.has(r); });
  saveReadLog();
}

// 押された場所が、どの画面のどこか。render() の振り分けと同じ順に見る。
function screenOf(el) {
  if (SHOW_READ) return "read";
  if (SHOW_FAV) return "fav";
  if (SEARCH_OPEN) return "search";
  if (SHOW_FRESH) return "fresh";
  if (SHOW_FOUND) return "found";
  if (el && typeof el.closest === "function") {
    if (el.closest("#morning")) return "morning";
    if (el.closest("#videos")) return "video";
  }
  return "shelf";
}

// 初めて開いた時刻を覚えておく（NEWの基準に使う）
let FIRST_OPEN = Number(lsGet(FIRSTOPEN_KEY, "0")) || 0;
if (!FIRST_OPEN) {
  FIRST_OPEN = Date.now();
  lsSet(FIRSTOPEN_KEY, String(FIRST_OPEN));
}

// 「前回見てから届いた分」。昼に開いたとき、朝に見た分と見分けるための印。
// 開き直すたびに基準を動かすと、少し画面を閉じただけで印が消えてしまう
// （昔 NEW をこの方式で作って消えてしまった）。そこで「続けて使っている間」を
// ひとまとまりとみなし、SESSION_GAP より間が空いたときだけ基準を進める。
// NEW（7日間）とは別の、控えめな印にする。
const SESSION_KEY = "mynews_session";   // { start: 今回の開始, prev: 前回の開始, last: 最後に開いた時刻 }
const SESSION_GAP = 60 * 60000;         // 1時間空いたら「別の回」
let SINCE_LAST = 0;                     // この時刻より後に届いた記事に印を付ける（0なら付けない）
(function () {
  let ses = {};
  try { ses = JSON.parse(lsGet(SESSION_KEY, "{}") || "{}"); } catch (e) { ses = {}; }
  const now = Date.now();
  if (!ses.start || now - (ses.last || 0) > SESSION_GAP) {
    ses.prev = ses.start || 0;   // 前回の開始時刻
    ses.start = now;
  }
  ses.last = now;
  lsSet(SESSION_KEY, JSON.stringify(ses));
  SINCE_LAST = ses.prev || 0;
})();
let SHOW_ALL = lsGet(SHOWALL_KEY, "0") === "1";
let SHOW_FAV = lsGet(SHOWFAV_KEY, "0") === "1";
// 読めない記事（有料・会員限定・一部有料）を一覧から外す。
// 以前は「まとめて既読」にしていたが、既読にすると埋もれて取り返せない。
// 隠すだけなら、設定を戻せばいつでも出てくる。
let HIDE_LOCKED = lsGet(HIDELOCK_KEY, "0") === "1";

// 個人ブログの9割は、Googleの中継URLのため機械では質を測れない。
// そこで「良かった（👍）」と押した回数と、実際に開いた回数を発信元ごとに数える。
// （「つまらない（👎）」の回数も数えていたが、v1.31.0 でやめた。判断は読み方の記録で行う）
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

// 前回見てから届いた未読の記事（古い記事の発掘は含めない）
function isSinceLast(a) {
  // 1日の上限を超えて「新着」と名乗らない分（quiet）は、ここでも数えない
  if (!SINCE_LAST || isRead(a) || a.quiet) return false;
  if (HIDE_LOCKED && isLocked(a)) return false;
  if (isOldArticle(a)) return false;
  const t = new Date(a.first_seen || "").getTime();
  return !isNaN(t) && t > SINCE_LAST;
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

let IN_MORNING = false;   // 朝刊の中を描いている最中か
const BLOG_VIA_RE = /^(note|zenn|qiita|はてなブログ|はてなダイアリー|アメブロ|medium)/i;

// 発信元の名前。名前が分からない記事（アラートで拾った記事など）は、サイトの住所を出す
// （Google ニュースも名前の無い記事には「daily.co.jp」のように住所を出している）。
// 動画は全部 YouTube なので出さない。Googleニュースの中継URLは本当の住所ではないので使わない。
function sourceName(a) {
  if (a.via) return a.via;
  if (a.kind === "video") return "";
  const m = String(a.via_host || a.link || "").match(/^(?:https?:\/\/)?([^/:?#]+)/i);
  const host = m ? m[1].toLowerCase().replace(/^www\./, "") : "";
  return host && host.indexOf("news.google.") !== 0 ? host : "";
}

// NEW＋有料バッジ＋発信元＋再生回数＋時刻のメタ行
function metaRow(a) {
  const t = relTime(a.dt);
  const src = sourceName(a);
  const inner = (isSinceLast(a) ? '<span class="since dot" title="前回見てから届いた記事">●</span>'
      : isNew(a) ? '<span class="new">NEW</span>' : "")
    + (isFound(a) ? '<span class="found" title="初めて見つけた、少し前の記事">発掘</span>' : "")
    + payBadge(a)
    // 発信元が note・Zenn などなら「個人ブログ」は言わずもがななので省く
    + (a.blog && (a.corp || !BLOG_VIA_RE.test(src)) ? '<span class="blog' + (a.corp ? " corp" : "") + '">'
        + (a.corp ? "企業ブログ" : "個人ブログ") + "</span>" : "")
    // 朝刊の中では出さない（note・Zenn等から集めたテーマではほとんどに付き、意味を持たない）
    + (a.related && !IN_MORNING ? '<span class="rel" title="見出しにテーマ名が無い記事">関連</span>' : "")
    + (src ? '<span class="chip">' + esc(src) + "</span>" : "")
    + (a.views ? '<span class="views">▶ ' + fmtViews(a.views) + "</span>" : "")
    + (a.hb ? '<span class="hb" title="はてなブックマーク数">🔖' + a.hb + "</span>" : "")
    + (t ? '<span class="time">' + esc(t) + "</span>" : "");
  const k = favKey(a);
  // 👍 は「この発信元をもっと」の票。読むつもりの記事なので既読にはしない。
  // 👎 は「読まずに片づける」印。発信元の回数は数えない（v1.31.0）。
  const good = '<button class="good' + (GOODED[k] ? " on" : "") + '" type="button" data-good="'
    + esc(k) + '" title="良かった。この発信元を大事にします">👍</button>';
  const boring = '<button class="boring" type="button" data-boring="'
    + esc(k) + '" title="つまらない。読まずに片づけます（発信元の評価には数えません）">👎</button>';
  return '<div class="meta">' + inner + '<span class="votes">' + good + boring + "</span></div>";
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
  // 説明文が日付だけ（茨城新聞の配信など）なら出さない。場所を取るだけで情報が無いため
  const dateOnly = /^\s*\d{4}年\d{1,2}月\d{1,2}日(\s*[(（][^)）]*[)）])?\s*$/.test(a.summary || "");
  // 説明文が見出しの繰り返しなら出さない（実測：先頭カードの説明文6件中5件が繰り返しだった）
  const squash = function (x) { return String(x || "").replace(/[\s|｜\-–—:：]/g, ""); };
  const repeats = squash(a.summary).indexOf(squash(a.title).slice(0, 15)) === 0;
  if (lead && a.summary && !dateOnly && !repeats) h += '<div class="summary">' + esc(a.summary) + "</div>";
  h += "</div>";
  return h;
}

// テーマの見出し（名前・件数・NEW・まとめて既読ボタン）
function groupHead(g, gi, all) {
  const newCount = all.filter(isFresh).length;
  const folded = isFolded(g.name);
  return '<h3 class="ghead"><button class="gname" type="button" data-fold="'
    + esc(g.name) + '">' + (folded ? "▸ " : "") + esc(g.name) + "</button>"
    + '<span class="gcount">' + shelfCount(all) + "件</span>"
    + (newCount ? '<span class="gnew">新着 ' + newCount + "</span>" : "")
    + "</h3>" + (folded ? "" : groupLinks(g));   // 目次（畳んだ状態）では出さない
}

// 記事として集められない情報源への「入口」。
// X（旧Twitter）は無料の配信が無く記事を取り込めないので、1タップで開けるようにする。
// TVer のように、読むのではなく「見に行く」先もここに置く。
function groupLinks(g) {
  if (!g.links || !g.links.length) return "";
  return '<div class="glinks">' + g.links.map(function (x) {
    return '<a class="glink" href="' + esc(x.url) + '" target="_blank" rel="noopener">'
      + esc(x.label) + "</a>";
  }).join("") + "</div>";
}

function renderGroup(g, gi, noHead) {
  const all = g.items || [];
  // テーマ名を押すと最小化する。見出しと件数だけ残し、記事は隠す。
  if (!noHead && isFolded(g.name)) {
    const hasNew = all.some(isFresh);
    return '<section class="group folded' + (hasNew ? " hasnew" : "") + '" data-group="' + gi + '">'
      + groupHead(g, gi, all) + "</section>";
  }
  // 書庫：読んだ記事も消さずに薄く残す（本棚のように）。
  // 並びは「きょう届いた → まだ読んでいない → 読んだ」。読んだものは後ろへ回るだけ。
  const list = shelfOrder(all.filter(function (a) { return !(HIDE_LOCKED && isLocked(a)); }));

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
  let h = '<section class="group" data-group="' + gi + '">'
    + (noHead ? "" : groupHead(g, gi, all));

  // 小分類（設定・工夫／自動化…）があるテーマは、まず小分類を1行ずつ並べる。
  // 以前は先頭3件しか出さなかったため、2つ目の小分類は169件先まで見えなかった。
  // 分類は見出しから機械で当てており、当たらないものは「その他」に置く（消さない）。
  if (g.sections && g.sections.length) {
    const names = g.sections.concat(["その他"]);
    names.forEach(function (sec) {
      const secList = list.filter(function (x) { return (x.sec || "その他") === sec; });
      if (!secList.length) return;
      const key = g.name + "|" + sec;
      const open = UI.cats["sec:" + key] === true;   // 既定は閉じておく（目次として使う）
      const fresh = secList.filter(isFresh).length;
      h += '<button class="secrow' + (open ? " open" : "") + (fresh ? " hasnew" : "")
        + '" type="button" data-sec="' + esc(key) + '">'
        + '<span class="secname">' + (open ? "▾ " : "▸ ") + esc(sec) + "</span>"
        + (fresh ? '<b class="gnew">新着 ' + fresh + "</b>" : "")
        + "<i>" + secList.length + "件</i></button>";
      if (open) {
        const lim = UI.shown[key] || INITIAL_VISIBLE;
        h += cardList(secList.slice(0, lim));
        if (secList.length > lim) {
          h += '<button class="more-btn" type="button" data-older="' + esc(key) + '">'
            + "もっと見る（残り" + (secList.length - lim) + "件）</button>";
        }
      }
    });
    return h + "</section>";
  }

  const items = list.slice(0, limit);
  const rest = list.length - items.length;
  h += cardList(items);
  if (rest > 0) {
    h += '<button class="more-btn" type="button" data-older="' + esc(g.name) + '">'
      + "もっと見る（残り" + rest + "件）</button>";
  }
  h += "</section>";
  return h;
}

// 書庫の並び：きょう届いた → まだ読んでいない → 読んだ（それぞれの中は元の並び）
function shelfOrder(list) {
  const fresh = [], unread = [], read = [];
  list.forEach(function (x) { (isFresh(x) ? fresh : isRead(x) ? read : unread).push(x); });
  return fresh.concat(unread, read);
}

// 本棚にある数（読めない記事を隠しているときは、それを除く）
function shelfCount(list) {
  return (list || []).filter(function (a) { return !(HIDE_LOCKED && isLocked(a)); }).length;
}

// きょう届いた記事を先頭へ（それ以外の並びはそのまま）。
// 優先語などで並べていると、新着が30番目・90番目に埋もれ、
// テーマを開いても「最初の3件」に出てこなかった。
function freshFirst(list) {
  const a = [], b = [];
  list.forEach(function (x) { (isFresh(x) ? a : b).push(x); });
  return a.concat(b);
}

// カードを並べる。配信日が古い記事との境目に区切りを入れる。
// NEWバッジは「アプリに入ってきた新しさ」、この区切りは「記事自体の古さ」。
// noLead … 朝刊の中では先頭を目立たせない（中身が全部新着なので意味が無い）
function cardList(items, noLead) {
  let h = '<div class="gitems expanded">';
  let dividerDone = false;
  items.forEach(function (a, i) {
    const t = a.dt ? new Date(a.dt).getTime() : 0;
    if (!dividerDone && t && (Date.now() - t) > OLD_DAYS * 86400000) {
      dividerDone = true;
      h += '<div class="agesep"><span>ここから1か月以上前の記事</span></div>';
    }
    h += renderCard(a, false, !noLead && i === 0 && isFresh(a));
  });
  return h + "</div>";
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
//
// 発信元ごとの読み方。読み方の記録（v1.29.0 から）を発信元でまとめ、
// 「開いた」と「開かずに片づけた（払った・✓片づけ・ここまで見た・👎など）」を並べる。
// 以前は👎を押した回数を発信元ごとに数えていたが、押すと note など媒体まるごとが
// 悪者になるので、ほとんど押されていなかった（v1.31.0 で数えるのをやめた。これまでの回数は端末に残してある）。
const SOURCE_ROWS_MAX = 100;   // 表に出す発信元の数（多い順）
function sourceRow() {
  const tally = {};
  READLOG.forEach(function (r) {
    if (!Array.isArray(r) || r[1] === "all") return;   // 「すべて既読」の目印は1記事の記録ではない
    const k = r[5] || "（発信元不明）";
    if (!tally[k]) tally[k] = { k: k, o: 0, p: 0, g: 0 };
    if (r[1] === "open") tally[k].o += 1; else tally[k].p += 1;
  });
  Object.keys(GOOD).forEach(function (k) {
    if (!tally[k]) tally[k] = { k: k, o: 0, p: 0, g: 0 };
    tally[k].g = GOOD[k] || 0;
  });
  const rows = Object.keys(tally).map(function (k) { return tally[k]; })
    .sort(function (a, b) { return (b.o + b.p) - (a.o + a.p) || b.g - a.g; });
  if (!rows.length) return "";
  const since = READLOG.length ? READLOG[0][0] : 0;
  let h = '<div class="srow"><span>発信元ごとの読み方'
    + (since ? "<small>読み方の記録（" + esc(dayLabel(since)) + "から）で数えています</small>" : "")
    + '</span><button class="tool-btn" type="button" id="show-boring">' + rows.length
    + "件の発信元</button></div>";
  if (BORING_OPEN) {
    h += '<div class="trouble-list"><table>'
      + "<tr><td></td><td>開いた</td><td>流した</td><td></td></tr>"
      + rows.slice(0, SOURCE_ROWS_MAX).map(function (r) {
        return "<tr><td>" + esc(r.k) + "</td><td>" + r.o + "</td><td>" + r.p
          + "</td><td>" + (r.g ? "👍" + r.g : "") + "</td></tr>";
      }).join("")
      + "</table>"
      + (rows.length > SOURCE_ROWS_MAX ? "<p>ほかに " + (rows.length - SOURCE_ROWS_MAX) + "件の発信元があります。</p>" : "")
      + "<p>「流した」は、開かずに片づけた数（払った・✓片づけ・ここまで見た・👎など）です。"
      + "開いた数が0で流した数の多い発信元は、外す相談ができます。"
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

// 朝刊をトップに置いたので、天気は短くまとめる（以前は約160pxあり、朝刊を押し下げていた）。
// 「今日 ☁ 25℃ ☔10%｜明日 ☔ 26/19℃ ☔30%」の1行と、株価の1行。
// 降水確率は朝・夕の高いほう。詳しい予報文は長押しで出る（title）。
function weatherLine(w) {
  if (!w || !w.days || !w.days.length) return "";
  const cells = w.days.slice(0, 2).map(function (d, i) {
    const temp = d.max != null && d.min != null ? d.max + "/" + d.min + "℃"
      : d.max != null ? d.max + "℃" : "";
    const pops = [d.pops && d.pops["06"], d.pops && d.pops["12"]]
      .filter(function (v) { return v != null; }).map(Number);
    const pop = pops.length ? Math.max.apply(null, pops) : null;
    return '<span class="wday" title="' + esc(d.text || d.short || "") + '"><b>' + (i === 0 ? "今日" : "明日") + "</b>"
      + '<span class="wicon">' + (d.icon || "") + "</span>"
      + (temp ? '<span class="wtemp">' + temp + "</span>" : "")
      + (pop != null ? '<span class="wpop' + (pop >= 50 ? " strong" : "") + '">☔' + pop + "%</span>" : "")
      + "</span>";
  }).join('<span class="wsep">｜</span>');
  return '<div class="weather compact"><div class="wline"><span class="wplace">' + esc(w.place || "") + "</span>"
    + cells + "</div>" + stockStrip((window.NEWS_DATA || {}).stocks) + "</div>";
}

function weatherLineFull(w) {
  if (!w || !w.days || !w.days.length) return "";
  const rows = w.days.slice(0, 2).map(function (d, i) {
    const temp = (d.max != null ? d.max + "℃" : "")
      + (d.min != null ? "／" + d.min + "℃" : "");
    return '<div class="wrow"><b>' + (i === 0 ? "今日" : "明日") + "</b>"
      + '<span class="wicon">' + (d.icon || "") + "</span>"
      + '<span class="wtext">' + esc(d.short || d.text) + "</span>"
      + (temp ? '<span class="wtemp">' + temp + "</span>" : "")
      + '<span class="wpops">' + popPart(d, "06", "朝") + popPart(d, "12", "夕") + "</span>"
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
const GROUP_OF = {};     // リンク → テーマ名（記事そのものはテーマ名を持たないため）

(function indexData() {
  const cats = (window.NEWS_DATA || {}).categories || [];
  cats.forEach(function (c) {
    (c.groups || []).forEach(function (g) {
      ALL_GROUPS.push({ cat: c.name, group: g, video: isVideoGroup(g) });
      (g.items || []).forEach(function (a) {
        if (!a.link) return;
        BY_LINK[a.link] = a;
        if (!GROUP_OF[a.link]) GROUP_OF[a.link] = g.name;
      });
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
    + '<button class="tool-btn' + (SEARCH ? " on" : "") + '" type="button" id="toggle-search">🔍 探す</button>'
    + '<button class="tool-btn" type="button" id="toggle-toc">'
    + (allFolded() ? "☰ 全部開く" : "☰ 全部閉じる") + "</button>"
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
      + '<div class="srow"><span>読んだ記事をふり返る</span>'
      + '<button class="tool-btn" type="button" id="show-read">📖 読んだ記事</button></div>'
      + orderRow()
      + sourceRow()
      + troubleRow(sources)
      + backupRow()
      + '<details class="howto"><summary>使い方</summary><ul>'
      + "<li>カードを<b>右へ払う</b>と既読、<b>左へ払う</b>とお気に入り（払った後5秒は戻せます）</li>"
      + "<li><b>朝刊と書庫</b>：一番上の<b>「きょうの新着」</b>が朝刊です。見出しを見て、読むものは開き、"
      + "読まないものは<b>✓ 片づけ</b>（押したあと5秒は戻せます）。ゼロになれば今日の分はおしまい</li>"
      + "<li>テーマの一覧は<b>書庫</b>です。読んだ記事も薄くして残すので、あとから読み返せます</li>"
      + "<li>テーマの<b>🔒</b>は、そのテーマの読めない記事をまとめて既読にします</li>"
      + "<li>記事右上の<b>☆</b>は、一覧から消えても残る保存です</li>"
      + "<li>テーマ名を押すと<b>畳めます</b>（並び順は設定の「並べ替え」で変えられます）</li>"
      + "<li><b>📖読んだ記事</b>は、読んだ順にさかのぼって見直せます</li>"
      + "<li>記事の<b>👍</b>は「この発信元をもっと」の印です（既読にしません）。"
      + "<b>👎</b>は「読まずに片づける」印です（発信元の評価には数えません）</li>"
      + "<li>見出しの<b>⚠</b>は、取得できなかった配信元がある印です</li>"
      + "<li><b>⬇ 書き出す</b>は、この端末だけにある記録（既読・お気に入り・👍👎など）をファイルに保存します。"
      + "機種変更やデータを消したあとは<b>⬆ 読み込む</b>で戻せます</li>"
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

// ---- 記録の書き出し・読み込み ----------------------------------------------
// 既読・お気に入り・👍👎などは、この端末のブラウザにしか無い。データ削除や機種変更で
// 一度に失われるので、ファイルに書き出して守れるようにする。書き出したファイルは
// 分析（どの記事を開き、どれを流したか）にも使う。
//
// ・対象は localStorage の「mynews_」で始まる記録すべて。名前で拾うので、
//   これから記録を増やしても（保有株など）書き足さずに対象に入る。
// ・ファイルには「復元用（storage）」と「分析用（analysis）」の2つを入れる。
//   読み込みに使うのは storage だけ。analysis は人や Claude が読むための写し。
// ・読み込みは合算ではなく置き換え。中身を見せてから確定し、直前の記録は
//   このタブを閉じるまで控えておく（sessionStorage）ので、1回だけ戻せる。

const BACKUP_PREFIX = "mynews_";
const BACKUP_FORMAT = 1;                       // ファイルの形の版。形を変えたら上げる
const BEFORE_IMPORT_KEY = "mynews_beforeimport";  // sessionStorage：読み込む直前の控え
const BACKUP_FILE_MAX = 20 * 1024 * 1024;      // これより大きいファイルは読まない（別物とみなす）
let IMPORT_PREVIEW = null;   // 読み込もうとしているファイルの中身（確定前）

// 中身が「名前→値」の形でないといけない記録。形が違えば読み込まない。
const BACKUP_OBJECT_KEYS = [READ_KEY, FAV_KEY, UI_KEY, ORDER_KEY, GOOD_KEY, GOODED_KEY,
  BORING_KEY, OPENED_KEY, SESSION_KEY];
const BACKUP_ARRAY_KEYS = [READLOG_KEY];

const HOW_LABEL = {
  open: "開いた", swipe: "右へ払った", boring: "👎つまらない",
  tidy: "テーマの✓片づけ", seen: "ここまで見た", found: "発掘の片づけ",
  tidyall: "全部片づけ", pick: "選んで既読", all: "すべて既読",
};
const WHERE_LABEL = {
  morning: "朝刊", shelf: "書庫", video: "動画", fresh: "新着画面", found: "発掘画面",
  search: "検索", fav: "お気に入り", read: "読んだ記事",
};

function storageKeys() {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(BACKUP_PREFIX) === 0) keys.push(k);
    }
  } catch (e) { /* 読めない環境では空のまま */ }
  return keys.sort();
}

// 今の端末の記録を { 名前: 保存されている文字列 } で写し取る
function snapshotStorage() {
  const out = {};
  storageKeys().forEach(function (k) {
    const v = lsGet(k, null);
    if (v !== null) out[k] = v;
  });
  return out;
}

// ファイルでは読みやすいよう、中身が JSON のものは開いた形で持つ。
// 戻すときは開いたものを文字列に、文字列はそのまま書く（元と一字一句同じになる）。
function decodeValue(raw) {
  try {
    const v = JSON.parse(raw);
    if (v !== null && typeof v === "object") return v;
  } catch (e) { /* JSON でない値（"auto" など）は文字列のまま */ }
  return raw;
}

function pad2(n) { return (n < 10 ? "0" : "") + n; }

// 端末の時計（日本時間）で「2026-10-07 06:12:33」の形にする
function fmtTime(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate())
    + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
}

function isPlainObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

// 件数の数え方は「今の端末」と「ファイル」で同じにする（読み込む前に並べて見せるため）
function countStorage(raw) {
  function obj(k) { const v = decodeValue(raw[k] || "{}"); return isPlainObject(v) ? v : {}; }
  const read = Object.keys(obj(READ_KEY));
  const log = decodeValue(raw[READLOG_KEY] || "[]");
  const srcs = {};
  [GOOD_KEY, BORING_KEY, OPENED_KEY].forEach(function (k) {
    Object.keys(obj(k)).forEach(function (s) { srcs[s] = 1; });
  });
  const known = [READ_KEY, FAV_KEY, READLOG_KEY, GOOD_KEY, BORING_KEY, OPENED_KEY];
  return {
    // 1記事につきリンクと見出しの2つの鍵を持つので、リンクの鍵の数を記事数の目安にする
    read: read.filter(function (k) { return k.indexOf("t:") !== 0; }).length,
    fav: Object.keys(obj(FAV_KEY)).length,
    log: Array.isArray(log) ? log.length : 0,
    sources: Object.keys(srcs).length,
    other: Object.keys(raw).filter(function (k) { return known.indexOf(k) < 0; }).length,
  };
}

// 分析用の写し。記事ごとに「テーマ・見出し・発信元・いつ・どう読んだか」を並べる。
function buildAnalysis(raw) {
  function obj(k) { const v = decodeValue(raw[k] || "{}"); return isPlainObject(v) ? v : {}; }
  const read = obj(READ_KEY);
  const fav = obj(FAV_KEY);
  const log = decodeValue(raw[READLOG_KEY] || "[]");

  // 見出しの鍵（t:…）から記事を引く表。今の蓄積とお気に入りから作る
  const byTitle = {};
  ALL_GROUPS.forEach(function (x) {
    (x.group.items || []).forEach(function (a) { const k = titleKey(a); if (k && !byTitle[k]) byTitle[k] = a; });
  });
  Object.keys(fav).forEach(function (k) {
    const a = fav[k];
    if (!a) return;
    const t = titleKey(a);
    if (t && !byTitle[t]) byTitle[t] = a;
  });
  function themeOf(a) { return GROUP_OF[a.link] || ""; }
  // 同じ記事を1行にまとめるための名札。短い見出しは鍵を作らないので、テーマと見出しで代える
  function idOf(theme, title) {
    return titleKey({ title: title }) || ("s:" + theme + "|" + title);
  }

  const rows = {};   // 名札 → { theme, title, source, acts }
  function row(theme, title, source) {
    const id = idOf(theme, title);
    if (!rows[id]) rows[id] = { theme: theme, title: title, source: source, acts: [] };
    return rows[id];
  }

  // 1) これから先の記録（どの操作で既読にしたかが分かる）
  (Array.isArray(log) ? log : []).forEach(function (r) {
    if (!Array.isArray(r)) return;
    if (r[1] === "all") return;   // 「すべて既読」の目印は下の markers に分けて出す
    row(r[3] || "", r[4] || "", r[5] || "").acts.push(
      [fmtTime(r[0]), HOW_LABEL[r[1]] || String(r[1] || ""), WHERE_LABEL[r[2]] || String(r[2] || "")]);
  });

  // 2) これまでの既読（操作は分からない）。上の記録に同じ記事があれば足さない
  const unknown = [];
  const seen = {};
  Object.keys(read).forEach(function (k) {
    const a = k.indexOf("t:") === 0 ? byTitle[k] : (BY_LINK[k] || fav[k]);
    if (!a) {
      // 蓄積から消えた記事。リンクの鍵と見出しの鍵が別の行に出る（同じ時刻なら同じ記事のことが多い）
      unknown.push(k.indexOf("t:") === 0
        ? { time: fmtTime(read[k]), title_key: k.slice(2) }
        : { time: fmtTime(read[k]), link: k });
      return;
    }
    const theme = themeOf(a);
    const title = String(a.title || "").slice(0, READLOG_TITLE_MAX);
    const id = idOf(theme, title);
    if (seen[id]) return;   // リンクと見出しの2つの鍵で同じ記事に2回当たる
    seen[id] = 1;
    const r = row(theme, title, sourceOf(a));
    if (!r.acts.length) r.acts.push([fmtTime(read[k]), "不明（v1.29.0より前）", ""]);
  });

  const list = Object.keys(rows).map(function (id) { return rows[id]; });
  list.forEach(function (r) { r.acts.sort(function (x, y) { return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0; }); });
  list.sort(function (x, y) {
    const a = x.acts[x.acts.length - 1][0], b = y.acts[y.acts.length - 1][0];
    return a < b ? 1 : a > b ? -1 : 0;
  });

  const markers = (Array.isArray(log) ? log : []).filter(function (r) { return Array.isArray(r) && r[1] === "all"; })
    .map(function (r) { return { time: fmtTime(r[0]), what: HOW_LABEL.all + r[4] }; });

  const favList = Object.keys(fav).map(function (k) {
    const a = fav[k] || {};
    return { saved: fmtTime(a.saved_at), theme: themeOf(a), title: a.title || "", source: sourceOf(a), link: a.link || "" };
  }).sort(function (x, y) { return x.saved < y.saved ? 1 : -1; });

  const good = obj(GOOD_KEY), boring = obj(BORING_KEY), opened = obj(OPENED_KEY);
  const sources = {};
  [good, boring, opened].forEach(function (src) { Object.keys(src).forEach(function (s) { sources[s] = {}; }); });
  Object.keys(sources).forEach(function (s) {
    sources[s] = { good: good[s] || 0, boring: boring[s] || 0, opened: opened[s] || 0 };
  });

  const logTimes = (Array.isArray(log) ? log : []).map(function (r) { return r[0]; }).filter(Boolean);
  return {
    summary: {
      read_articles: list.length,
      read_unknown_keys: unknown.length,
      log_rows: logTimes.length,
      log_since: logTimes.length ? fmtTime(Math.min.apply(null, logTimes)) : "",
      fav: favList.length,
      sources: Object.keys(sources).length,
    },
    read: list,
    read_unknown: unknown,
    markers: markers,
    fav: favList,
    sources: sources,
  };
}

function buildBackup() {
  const raw = snapshotStorage();
  const storage = {};
  Object.keys(raw).forEach(function (k) { storage[k] = decodeValue(raw[k]); });
  return {
    app: "mynews",
    kind: "backup",
    format: BACKUP_FORMAT,
    version: APP_VERSION,
    exported_at: fmtTime(Date.now()),
    data_generated_at: (window.NEWS_DATA || {}).generated_at || "",
    guide: {
      analysis: "分析用の写し（読み込みでは使わない）。read は1記事1行で、acts に [いつ, どの操作で, どの画面で] を古い順に並べる",
      read_unknown: "蓄積から消え、何の記事か引けなかった既読の鍵。link か title_key（見出しの先頭30字・記号抜き）だけが分かる",
      sources: "発信元ごとの 👍(good)・👎(boring。v1.31.0 からは数えていない)・開いた回数(opened)",
      storage: "復元用。端末に保存している記録そのもの（⚙設定の「読み込む」で戻す）",
    },
    analysis: buildAnalysis(raw),
    storage: storage,
  };
}

function backupFileName() {
  const d = new Date();
  return "mynews-backup-" + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate())
    + "-" + pad2(d.getHours()) + pad2(d.getMinutes()) + ".json";
}

// ファイルとして保存させる（Android の Chrome では「ダウンロード」フォルダに入る）
function downloadBackup() {
  const text = JSON.stringify(buildBackup());
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  return text.length;
}

// 読み込もうとしているファイルを調べる。何を渡されても例外を外へ出さない。
// 返り値：{ ok: true, storage: {名前: 文字列}, info } か { ok: false, msg }
function parseBackup(text) {
  const NG = { ok: false, msg: "マイニュースの記録ファイルではありません。何も変えていません。" };
  let obj;
  try { obj = JSON.parse(String(text == null ? "" : text)); } catch (e) { return NG; }
  if (!isPlainObject(obj) || obj.app !== "mynews" || !isPlainObject(obj.storage)) return NG;
  if (typeof obj.format === "number" && obj.format > BACKUP_FORMAT) {
    return { ok: false, msg: "新しい版のアプリで書き出したファイルです。アプリを最新にしてから読み込んでください。" };
  }
  const storage = {};
  let skipped = 0;
  Object.keys(obj.storage).forEach(function (k) {
    const v = obj.storage[k];
    if (k.indexOf(BACKUP_PREFIX) !== 0 || k === BEFORE_IMPORT_KEY) { skipped += 1; return; }
    if (BACKUP_OBJECT_KEYS.indexOf(k) >= 0 && !isPlainObject(v)) { skipped += 1; return; }
    if (BACKUP_ARRAY_KEYS.indexOf(k) >= 0 && !Array.isArray(v)) { skipped += 1; return; }
    if (typeof v === "string") storage[k] = v;
    else if (typeof v === "number" || typeof v === "boolean") storage[k] = String(v);
    else if (v !== null && typeof v === "object") storage[k] = JSON.stringify(v);
    else skipped += 1;
  });
  if (!Object.keys(storage).length) {
    return { ok: false, msg: "ファイルに記録が入っていませんでした。何も変えていません。" };
  }
  return {
    ok: true, storage: storage,
    info: {
      exported_at: String(obj.exported_at || ""), version: String(obj.version || ""),
      skipped: skipped, file: countStorage(storage), now: countStorage(snapshotStorage()),
    },
  };
}

// 端末の記録を、渡された中身に入れ替える。途中で書けなくなったら元に戻して false を返す。
function replaceStorage(storage) {
  const before = snapshotStorage();
  function put(src) {
    let ok = true;
    storageKeys().forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { ok = false; } });
    Object.keys(src).forEach(function (k) {
      try { localStorage.setItem(k, src[k]); } catch (e) { ok = false; }
    });
    return ok;
  }
  if (put(storage)) return true;
  put(before);
  return false;
}

// 読み込みを確定する。直前の記録をこのタブの間だけ控えておく。
function applyBackup(storage) {
  let kept = false;
  try {
    sessionStorage.setItem(BEFORE_IMPORT_KEY,
      JSON.stringify({ at: Date.now(), notice: true, storage: snapshotStorage() }));
    kept = true;
  } catch (e) { /* 控えを置けなかった */ }
  if (!kept && !confirm("今の記録の控えを残せませんでした。置き換えると元に戻せません。続けますか？")) {
    return false;
  }
  if (!replaceStorage(storage)) {
    alert("端末に書き込めませんでした。記録は元のままです。");
    return false;
  }
  return true;
}

function beforeImport() {
  try {
    const v = JSON.parse(sessionStorage.getItem(BEFORE_IMPORT_KEY) || "null");
    return isPlainObject(v) && isPlainObject(v.storage) ? v : null;
  } catch (e) { return null; }
}

// 設定の中の1段。書き出し・読み込みのボタンと、読み込む前の確認を出す。
function backupRow() {
  const c = countStorage(snapshotStorage());
  const since = READLOG.length ? READLOG[0][0] : 0;
  let h = '<div class="srow backup"><span>記録の控え（機種変更・分析用）'
    + "<small>既読 約" + c.read + "件・お気に入り " + c.fav + "件・読み方の記録 " + c.log + "件"
    + (since ? "（" + dayLabel(since) + "から）" : "") + "</small></span>"
    + '<button class="tool-btn" type="button" id="backup-export">⬇ 書き出す</button>'
    + '<button class="tool-btn" type="button" id="backup-import">⬆ 読み込む</button></div>'
    // Android では accept で絞ると .json を選べなくなることがあるので、絞らずに中身で見分ける
    + '<input type="file" id="backup-file" hidden>';
  const prev = beforeImport();
  if (prev) {
    h += '<div class="srow"><span>読み込む前の記録<small>このタブを閉じるまで戻せます</small></span>'
      + '<button class="tool-btn" type="button" id="import-undo">↩ 読み込む前に戻す</button></div>';
  }
  const p = IMPORT_PREVIEW;
  if (p && !p.ok) {
    h += '<div class="trouble-list import-box"><p>⚠ ' + esc(p.msg) + "</p>"
      + '<button class="tool-btn" type="button" id="import-cancel">閉じる</button></div>';
  } else if (p) {
    const f = p.info.file, n = p.info.now;
    const line = function (label, a, b) {
      return "<tr><td>" + label + "</td><td>" + a + "</td><td><b>" + b + "</b></td></tr>";
    };
    h += '<div class="trouble-list import-box">'
      + "<p>このファイルの中身" + (p.info.exported_at ? "（" + esc(p.info.exported_at) + " に書き出し"
        + (p.info.version ? "・" + esc(p.info.version) : "") + "）" : "") + "</p>"
      + "<table><tr><td></td><td>今の端末</td><td>ファイル</td></tr>"
      + line("既読（約）", n.read, f.read)
      + line("お気に入り", n.fav, f.fav)
      + line("読み方の記録", n.log, f.log)
      + line("👍👎・開いた数の発信元", n.sources, f.sources)
      + line("そのほかの設定", n.other, f.other)
      + "</table>"
      + (p.info.skipped ? "<p>形の合わない記録 " + p.info.skipped + " 件は読み込みません。</p>" : "")
      + "<p><b>置き換え</b>です（合わせるのではありません）。今の端末の記録はファイルの中身に入れ替わります。"
      + "置き換えたあとも、このタブを閉じるまでは「読み込む前に戻す」で戻せます。</p>"
      + '<div class="import-btns"><button class="tool-btn on" type="button" id="import-apply">この内容に置き換える</button>'
      + '<button class="tool-btn" type="button" id="import-cancel">やめる</button></div></div>';
  }
  return h;
}

// ---- きょうの新着だけの画面 ------------------------------------------------
// 新着があっても、どのテーマにあるかスクロールして探すしかなかった。
// テーマの並びは feeds.json 順のまま動かさず（毎日同じ場所にある安心感を保つ）、
// 別の入口として「新着だけ」を集める。

// 新着のあるテーマを、設定の並び順で（動画は後ろ）
function freshBlocks() {
  const ordered = sortByOrder(ALL_GROUPS.filter(function (x) { return !isVideoGroup(x.group); }))
    .concat(sortByOrder(ALL_GROUPS.filter(function (x) { return isVideoGroup(x.group); })));
  return ordered.map(function (x) {
    const items = (x.group.items || []).filter(isFresh);
    return items.length ? { name: x.group.name, cat: x.cat, items: items } : null;
  }).filter(Boolean);
}

// 件数の多いテーマは、開いても最初の数枚だけ見せ、残りはボタンの奥に置く
// （Yahoo!ニュースのトピックスが数本で止めるのと同じ考え）。
// 実測：Claude Code の新着20件を開くと 2,603px（スマホ約3画面）あった。
// 隠した分も「ここまで見た」で一緒に片づく（ボタンに件数を出している）。書庫には残る。
const MORNING_SPLIT = 8;   // 新着がこの件数以上のテーマを区切る
const MORNING_SHOW = 5;    // 区切るときに先に見せる枚数（同じ話題は畳んで1枚と数える）
const PEEK_MAX = 2;        // 閉じたテーマの下に先に見せる見出しの本数
let MORE_OPEN = {};        // 「残りを見る」を押したテーマ（この画面を見ている間だけ覚える）

// テーマの新着を、表に出す順の「まとまり」（同じ話題を畳んだ単位）に並べる。
// 小分類のあるテーマ（Claude Code など）は小分類の順に並べる。
function morningUnits(b) {
  const g = (ALL_GROUPS.find(function (x) { return x.group.name === b.name; }) || {}).group;
  const secs = g && g.sections && g.sections.length ? g.sections.concat(["その他"]) : [null];
  const units = [];
  secs.forEach(function (sec) {
    const list = sec === null ? b.items
      : b.items.filter(function (a) { return (a.sec || "その他") === sec; });
    if (!list.length) return;
    topicClusters(b.name, list, g ? g.items : null).map(pickLead).forEach(function (c) {
      units.push({ sec: sec, secCount: list.length, items: c });
    });
  });
  return units;
}

// 朝刊でテーマを開いたときのカード。小分類のあるテーマは小見出しを入れて並べる
// （20件が1列に並ぶと読みたいものを探しにくい）。
function freshCards(b) {
  IN_MORNING = true;
  let h = "";
  try {
    const units = morningUnits(b);
    const split = b.items.length >= MORNING_SPLIT && !MORE_OPEN[b.name] && units.length > MORNING_SHOW;
    let sec;
    (split ? units.slice(0, MORNING_SHOW) : units).forEach(function (u) {
      if (u.sec !== null && u.sec !== sec) {
        h += '<div class="msec">' + esc(u.sec) + "<i>" + u.secCount + "</i></div>";
      }
      sec = u.sec;
      h += topicCards(b.name, u.items);
    });
    if (split) {
      const rest = units.slice(MORNING_SHOW).reduce(function (t, u) { return t + u.items.length; }, 0);
      h += '<button class="mmore" type="button" data-fresh-more="' + esc(b.name) + '">'
        + "▾ 残り" + rest + "件を見る</button>";
    }
  } finally { IN_MORNING = false; }
  return h;
}

// 閉じたテーマの行の下に、代表の見出しを2本まで出す（Google ニュースのまとめ方）。
// 開かなくても「読むか、片づけるか」を決められるように。押すとテーマが開く。
// 長い見出しは1行で切る（画面の幅で「…」になるだけで、要約はしない）。
function freshPeek(b) {
  const units = morningUnits(b).slice(0, PEEK_MAX);
  if (!units.length) return "";
  return '<button class="mpeek" type="button" data-fresh-peek="' + esc(b.name) + '">'
    + units.map(function (u) { return "<span>" + esc(u.items[0].title) + "</span>"; }).join("")
    + "</button>";
}

// ---- 同じ話題の記事を1枚に畳む（朝刊）--------------------------------------
// 言い回しが違うと重複としてまとまらない（例：アーミル・カーンの新作公開を
// 「9年ぶり日本公開」「9年ぶり来日」「2027年春公開」と3社が書いた）。
// 見出しの「珍しい語」が十分重なる報道どうしを、先頭の1枚＋「同じ話題 ほか◯件」にする。
// 個人ブログは同じ話題でも別の論考なので畳まない。
let TOPIC_OPEN = {};

// どの話題にも出るカタカナ語。1語だけで話題を決めない（実測：「オープン」で別々の開店を、
// 「ローカル」で別々の旅番組をつないだ）
const TOPIC_STOP = ["オープン", "ローカル", "リニューアル", "イベント", "キャンペーン", "サービス",
  "スタート", "ニュース", "ランキング", "プロジェクト", "シリーズ", "ライブ", "アニメ", "チーム",
  "ドラマ", "テレビ", "コーナー", "スペシャル", "アプリ", "システム", "データ", "ビジネス", "セミナー",
  "レポート", "インタビュー", "コメント", "メンバー", "ファン", "グループ", "スタジオ", "ショップ",
  // 英語は小文字で書く（大文字・小文字を区別せずに比べる）。
  // 実測：「イオンリテールnews」と「CBC news」の一致で、開業の記事と地震の記事を畳んだ
  "news"];

// 見出しから「目印の語」を取り出す。値は { 重み, かたまりの番号 }。
// 漢字は2文字ずつに刻む（「日本公開作」と「日本公開決定」を突き合わせるため）が、
// 同じかたまり（例：「常陸太田」）から出た一致は1つと数える。
function topicWords(title, theme) {
  const t = String(title || "").normalize("NFKC").replace(/[―‐－—]/g, "ー");
  const out = {};
  let run = 0;
  (t.match(/[ァ-ヶー]{3,}|[A-Za-z][A-Za-z0-9]{2,}/g) || []).forEach(function (w) {
    if (theme.indexOf(w) >= 0 || TOPIC_STOP.indexOf(w.toLowerCase()) >= 0) return;   // テーマ名・ありふれた語は使わない
    out[w] = { w: w.length >= 4 ? 2 : 1, run: "r" + (run++) };
  });
  (t.match(/[一-龠々]{2,}/g) || []).forEach(function (chunk) {
    const id = "r" + (run++);
    for (let i = 0; i + 2 <= chunk.length; i++) {
      const w = chunk.slice(i, i + 2);
      if (theme.indexOf(w) < 0) out[w] = { w: 1, run: id };
    }
  });
  return out;
}

// 語の珍しさは、そのテーマに貯めてある全記事で測る（pool）。
// 新着の中だけで測ると、海外ニュースの「アメリカ」のような、そのテーマでは
// ありふれた語が目印になり、別の話題をつないでしまう。
const DF_CACHE = {};
function themeDf(theme, pool) {
  if (DF_CACHE[theme]) return DF_CACHE[theme];
  const df = {};
  (pool || []).forEach(function (a) {
    Object.keys(topicWords(a.title, theme)).forEach(function (w) { df[w] = (df[w] || 0) + 1; });
  });
  return (DF_CACHE[theme] = df);
}

function topicClusters(theme, items, pool) {
  const words = items.map(function (a) { return topicWords(a.title, theme); });
  const df = themeDf(theme, pool && pool.length ? pool : items);
  const size = pool && pool.length ? pool.length : items.length;
  // テーマ全体で4件を超える記事に出る語は目印にしない。割合で決めると、
  // 500件あるテーマでは25件に出る語（「活用」など）まで目印になり、別々の会社の発表をつないだ。
  const limit = 4 + 0 * size;
  // 同じ話題とみなす条件：長いカタカナ・英字の語が重なる（重み2）か、
  // 漢字2文字の重なりが3つ以上。「情報」「茨城県」程度の一致ではつなげない
  // （実測：スタンプラリーの記事が「情報」「城県」の一致で地震の記事と畳まれた）。
  // 1語だけでつないでよいのは、テーマ全体で2件以下にしか出ない特に珍しい長い語
  // （「シターレ」「バスケコーチ」など作品や出来事の固有の語）。
  // 「アメリカ」は海外ニュースで3件あり、1語では別の話題をつないでしまった。
  // 見出しを2文字ずつに刻み、どれだけ重なるか（ほぼ同じ見出しを見分ける）
  const grams = items.map(function (a) {
    // 末尾の媒体名（「 - FNN」「（茨城新聞）」など）だけを落とす
    const t = String(a.title || "").normalize("NFKC")
      .replace(/\s*[-|｜]\s*[^-|｜]*$/, "").replace(/[（(][^）)]*[）)]\s*$/, "")
      .replace(/[^\p{L}\p{N}]/gu, "");
    const g = {};
    for (let k = 0; k + 2 <= t.length; k++) g[t.slice(k, k + 2)] = true;
    return g;
  });
  const overlap = function (i, j) {
    const a = Object.keys(grams[i]), b = grams[j];
    if (!a.length) return 0;
    const hit = a.filter(function (x) { return b[x]; }).length;
    return hit / (a.length + Object.keys(b).length - hit);
  };
  // 見出しの数字（回数・日付）。連載の別の回（part1 と part3 など）を同じ話題にしない
  const nums = items.map(function (a) {
    const t = String(a.title || "").normalize("NFKC");
    return (t.match(/(?:part|vol\.?|第|#)\s*(?:\d+|[一二三四五六七八九十]+)|(?:\d+|[一二三四五六七八九十]+)\s*(?:回|話|夜|弾)/gi) || []).join(",");
  });
  const same = function (i, j) {
    // ほぼ同じ見出し（同じ地震を2社が報じた等）。ただし数字が違えば別の回
    if (overlap(i, j) >= 0.6 && nums[i] === nums[j]) return true;
    const ri = {}, rj = {};
    let strong = false;
    Object.keys(words[i]).forEach(function (w) {
      if (!words[j][w] || df[w] > limit) return;
      ri[words[i][w].run] = true;          // 同じかたまりからの一致は1つと数える
      rj[words[j][w].run] = true;          // 相手の見出し側でも数え、多いほうを採る
      if (words[i][w].w >= 2 && df[w] <= 2) strong = true;
    });
    return strong || Math.max(Object.keys(ri).length, Object.keys(rj).length) >= 3;
  };
  const days = function (a, b) { return Math.abs(new Date(a.dt || 0) - new Date(b.dt || 0)) / 86400000; };
  const used = {}, clusters = [];
  items.forEach(function (a, i) {
    if (used[i]) return;
    used[i] = true;
    const c = [i];
    if (!a.blog) {
      // つながりを最後までたどる（AとC、CとBがつながれば、AとBも同じ話題）
      let grew = true;
      while (grew) {
        grew = false;
        items.forEach(function (b, j) {
          if (used[j] || b.blog || days(a, b) > 3) return;
          if (c.some(function (k) { return same(k, j); })) { used[j] = true; c.push(j); grew = true; }
        });
      }
    }
    clusters.push(c.map(function (k) { return items[k]; }));
  });
  return clusters;
}

// 同じ話題の中から、表に出す1件（代表）を選ぶ。
// 本文の長さは測れない（Googleニュースの中継URLを実URLに解決できない）ので、次の順で推し量る。
//   ① 2ページ目・画像ページ・写真ページ・記事一覧は後ろへ（実測：吉村昭で「2ページ目」、
//      アクアワールド大洗で「画像ページ[3/9]」が代表になり、本文の記事が畳まれていた）
//   ② 無料の記事を有料・会員限定より前へ
//   ③ 説明文が長いほうを前へ（見出しのくり返しの部分は数えない）
//   ④ 差が無ければ元の並び順
const SUBPAGE_RE = /[2-9２-９]\s*ページ目|[（(]\s*[2-9]\s*ページ|画像ページ|写真・画像|記事一覧/;
function topicRank(a) {
  const sub = SUBPAGE_RE.test(a.title || "") ? 1 : 0;
  const paid = a.paywall && a.paywall !== "free" ? 1 : 0;
  // 見出しの文字を説明文から取り除いた残りの長さ＝見出しに無い情報の量
  const squash = function (x) { return String(x || "").replace(/[\s|｜\-–—:：]/g, ""); };
  const t = squash(a.title).slice(0, 15), s = squash(a.summary);
  const info = (t && s.indexOf(t) === 0 ? s.slice(t.length) : s).length;
  return [sub, paid, -info];
}
function pickLead(c) {
  const ranks = c.map(topicRank);
  let best = 0;
  for (let i = 1; i < c.length; i++) {
    for (let k = 0; k < 3; k++) {
      if (ranks[i][k] !== ranks[best][k]) { if (ranks[i][k] < ranks[best][k]) best = i; break; }
    }
  }
  // 代表を先頭へ。残りは元の並びのまま
  return [c[best]].concat(c.filter(function (_, i) { return i !== best; }));
}

function topicCards(theme, items) {
  let h = "";
  const g = (ALL_GROUPS.find(function (x) { return x.group.name === theme; }) || {}).group;
  topicClusters(theme, items, g ? g.items : null).map(pickLead).forEach(function (c) {
    h += cardList([c[0]], true);
    if (c.length < 2) return;
    const key = theme + "|" + favKey(c[0]);
    if (TOPIC_OPEN[key]) {
      h += cardList(c.slice(1), true);
    } else {
      h += '<button class="topic-more" type="button" data-topic="' + esc(key) + '">'
        + "▸ 同じ話題 ほか" + (c.length - 1) + "件"
        + "<small>" + esc(c.slice(1).map(sourceName).filter(Boolean).join("・")) + "</small>"
        + "</button>";
    }
  });
  return h;
}

// ---- 朝刊（トップ画面の一番上）---------------------------------------------
// 開いた瞬間に「きょう読むもの」が目に入り、下へ進むと書庫になる（新聞の1面と後ろのページ）。
// テーマは畳んで1行ずつ並べ、読みたいテーマだけ開く。見終わったら片づけてゼロにする。
function morningEdition() {
  const blocks = freshBlocks();
  const total = blocks.reduce(function (t, b) { return t + b.items.length; }, 0);
  let since = 0, foundToday = 0, foundWeek = 0;
  ALL_GROUPS.forEach(function (x) {
    (x.group.items || []).forEach(function (a) {
      if (isSinceLast(a)) since += 1;
      if (isFound(a)) { foundWeek += 1; if (isFoundToday(a)) foundToday += 1; }
    });
  });

  let h = '<section class="morning" id="morning"><div class="mhead">'
    + "<h2>⚡ きょうの新着</h2>"
    + '<span class="mcount">' + total + "件</span>"
    + (since && since < total ? '<span class="since">●前回から ' + since + "</span>" : "")
    + "</div>";

  if (!total) {
    h += '<div class="mdone">✓ きょうの分はおしまいです。新しい記事は次の更新で届きます。</div>';
  } else {
    blocks.forEach(function (b) {
      const open = !!FRESH_OPEN[b.name];
      const bs = b.items.filter(isSinceLast).length;
      h += '<div class="mtheme' + (open ? " open" : "") + '"><div class="mrow">'
        + '<button class="mname" type="button" data-fresh-open="' + esc(b.name) + '">'
        + '<span class="mcaret">' + (open ? "▾" : "▸") + "</span>" + esc(b.name) + "</button>"
        + '<span class="mnum">' + b.items.length + "</span>"
        + (bs && bs < b.items.length ? '<span class="since" title="前回見てから届いた数">●' + bs + "</span>" : "")
        + '<button class="read-all mtidy" type="button" data-fresh="' + esc(b.name)
        + '" title="このテーマの新着を片づける（あとで戻せます）">✓ 片づけ</button></div>'
        + (open ? freshCards(b)
            + '<button class="mseen" type="button" data-fresh-done="' + esc(b.name) + '">'
            + "✓ ここまで見た（" + b.items.length + "件を片づけて次へ）</button>" : freshPeek(b))
        + "</div>";
    });
  }
  if (foundWeek) {
    h += '<button class="mfound" type="button" id="show-found">⛏ '
      + (foundToday ? "きょうの発掘 " + foundToday : "発掘 " + foundWeek) + "件"
      + "<small>初めて見つけた、少し前の記事</small><i>→</i></button>";
  }
  if (total) {
    h += '<button class="mtidyall" type="button" id="tidy-all-fresh">✓ 見終わったので全部片づけ（'
      + total + "件）</button>";
  }
  h += "</section>"
    + '<div class="shelf-head"><h2>📚 書庫</h2>'
    + "<p>テーマごとに貯めた記事です。読んだ記事も薄くして残します。</p></div>";
  return h;
}

// 新着画面はテーマごとに畳んでおく。59枚・12画面を上から見る時間は無いので、
// まず「どのテーマに何件あるか」を1画面で見せ、読みたいテーマだけ開く。
// 開いた状態はこの画面を見ている間だけ覚える（翌日は新着の中身が変わるため）。
// スマホがタブを読み込み直しても（記事を読んで戻ったときなど）、開いていたテーマと
// 読んでいた位置に戻れるように、ページを開いている間だけ覚えておく（sessionStorage）。
const VIEW_KEY = "mynews_view";
function ssGet() {
  try { return JSON.parse(sessionStorage.getItem(VIEW_KEY) || "{}"); } catch (e) { return {}; }
}
function ssSave(extra) {
  try {
    const v = ssGet();
    v.open = FRESH_OPEN;
    if (extra) Object.keys(extra).forEach(function (k) { v[k] = extra[k]; });
    sessionStorage.setItem(VIEW_KEY, JSON.stringify(v));
  } catch (e) { /* 覚えられなくても動作は続ける */ }
}
let FRESH_OPEN = ssGet().open || {};

function renderFreshView(data) {
  // 並びは設定の「テーマの並べ替え」の順。動画は記事の後ろへ。
  const ordered = sortByOrder(ALL_GROUPS.filter(function (x) { return !isVideoGroup(x.group); }))
    .concat(sortByOrder(ALL_GROUPS.filter(function (x) { return isVideoGroup(x.group); })));
  const blocks = ordered.map(function (x) {
    const items = (x.group.items || []).filter(isFresh);
    return items.length ? { name: x.group.name, cat: x.cat, items: items } : null;
  }).filter(Boolean);
  const total = blocks.reduce(function (n, b) { return n + b.items.length; }, 0);

  const parts = ["<header><h1>⚡ きょうの新着</h1>"
    + '<div class="meta-head">' + headUpdated(data.generated_at)
    + '<button class="newcount on" type="button" id="show-fresh">← 書庫へ</button>'
    + '<span class="unread">' + total + "件</span>"
    + (total ? '<button class="tool-btn tidy-all" type="button" id="tidy-all-fresh">✓ 全部片づけ</button>' : "")
    + "</div>"
    + toolbar(data.sources) + "</header>"];

  // 朝刊のように「読み切れる量で終わる」ことを目指す。
  // 見出しを見て、読むものは開き、読まないものは片づける。ゼロになったら今日の分はおしまい。
  if (!blocks.length) {
    parts.push('<div class="empty done-today">✓ きょうの分はおしまいです。<br>'
      + "新しい記事は次の更新で届きます。古い記事や発掘は「← 書庫へ」でいつでも読めます。</div>");
  } else {
    blocks.forEach(function (b) {
      const open = !!FRESH_OPEN[b.name];
      const since = b.items.filter(isSinceLast).length;
      parts.push('<section class="group' + (open ? "" : " folded hasnew") + '"><h3 class="ghead">'
        + '<button class="gname" type="button" data-fresh-open="' + esc(b.name) + '">'
        + (open ? "▾ " : "▸ ") + esc(b.name) + "</button>"
        + '<span class="gcount">' + b.items.length + "件</span>"
        + (since ? '<span class="since">●前回から ' + since + "</span>" : "")
        + '<button class="read-all" type="button" data-fresh="' + esc(b.name)
        + '" title="このテーマの新着を片づける（あとで戻せます）">✓ 片づけ</button></h3>'
        + (open
          ? '<div class="gitems expanded">'
            + b.items.map(function (a) { return renderCard(a, false, false); }).join("")
            + "</div>"
          : "")
        + "</section>");
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
        + '" title="このテーマの発掘分を片づける（あとで戻せます）">✓ 片づけ</button></h3>'
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
    + '<div class="meta-head">' + headUpdated(data.generated_at) + "</div>"
    + weatherLine(data.weather)
    + toolbar(data.sources) + "</header>");
  // 朝刊（きょうの新着）を一番上に。その下が書庫
  parts.push(morningEdition());

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
      + "</a>";
  }).join("");
  // （カテゴリへ飛ぶ札は外した。書庫が目次になり、すぐ下の見出しと役割が重なっていたため）

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
      + "</span></h2></summary>");
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
      + "</span></h2></summary>");
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
// まとめて片づける（既読にする）。確認のダイアログは出さず、押したあとで戻せるようにする。
// スワイプと同じ考え方：迷わず押せて、間違えたら5秒以内に戻す。
// how / where は「どう読んだか」の記録に残す操作と画面（logRead を参照）。
function tidyUp(items, label, how, where) {
  if (!items.length) return;
  const done = items.slice();
  done.forEach(markRead);
  const rows = logRead(done, how, where);
  pushUndo(label + " " + done.length + "件を片づけました", function () {
    done.forEach(unmarkRead);
    unlogRead(rows);
  });
}

function unmarkRead(a) {
  if (a.link) delete READ[a.link];
  const k = titleKey(a);
  if (k) delete READ[k];
  saveRead(READ);
}

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
      const picked = [];
      SELECTED.forEach(function (key) {
        const a = BY_LINK[key] || { link: key, title: "" };
        markRead(a);
        picked.push(a);
      });
      logRead(picked, "pick", screenOf(null));
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
  // 👎 つまらない（記事は開かない）。片づけて、読み方の記録に「👎」と残すだけ。
  // 発信元ごとの回数は数えない（v1.31.0。媒体まるごとが悪者になるのを避けるため）
  const boring = ev.target.closest(".boring");
  if (boring) {
    ev.preventDefault();
    const a = BY_LINK[boring.dataset.boring] || FAV[boring.dataset.boring];
    if (!a) return;
    markRead(a);
    const rows = logRead([a], "boring", screenOf(boring));
    pushUndo("つまらないとして片づけました", function () {
      if (a.link) delete READ[a.link];
      const t = titleKey(a);
      if (t) delete READ[t];
      saveRead(READ);
      unlogRead(rows);
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
  if (ev.target.closest("#toggle-toc")) {
    setAllFolded(!allFolded());
    rerender();
    window.scrollTo(0, 0);
    return;
  }
  // 小分類の開け閉め
  const secRow = ev.target.closest(".secrow");
  if (secRow) {
    const key = "sec:" + secRow.dataset.sec;
    UI.cats[key] = !(UI.cats[key] === true);
    saveUI();
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
    return;
  }
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
  // （テーマの「✓ 既読に」は外した。押した瞬間に過去分まで全部既読になり、
  //   戻せなかったため。片づけは「きょうの新着」画面で、戻せる形で行う）
  // テーマ名を押して最小化／元に戻す
  const fold = ev.target.closest(".gname[data-fold]");
  if (fold) {
    const key = "fold:" + fold.dataset.fold;
    if (isFolded(fold.dataset.fold)) UI.cats[key] = true;
    else delete UI.cats[key];
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
  // 朝刊：開いたテーマの一番下「ここまで見た」→ 片づけて閉じ、次のテーマの位置へ
  const topicBtn = ev.target.closest("[data-topic]");
  if (topicBtn) {
    TOPIC_OPEN[topicBtn.dataset.topic] = true;
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
    return;
  }
  const seenBtn = ev.target.closest("[data-fresh-done]");
  if (seenBtn) {
    const name = seenBtn.dataset.freshDone;
    const entry = ALL_GROUPS.find(function (x) { return x.group.name === name; });
    const rows = [].slice.call(document.querySelectorAll("[data-fresh-open]"));
    const idx = rows.findIndex ? rows.findIndex(function (r) { return r.dataset.freshOpen === name; }) : -1;
    if (entry) tidyUp((entry.group.items || []).filter(isFresh), "「" + name + "」の新着", "seen", "morning");
    FRESH_OPEN[name] = false;
    ssSave();
    rerender();
    // 片づけたテーマの行は消えるので、同じ位置に来た「次のテーマ」へ移る
    const next = document.querySelectorAll("[data-fresh-open]")[Math.max(0, idx)];
    if (next && next.getBoundingClientRect) {
      window.scrollTo(0, Math.max(0, next.getBoundingClientRect().top + (window.scrollY || 0) - 12));
    }
    return;
  }
  // 朝刊：件数の多いテーマの「残り◯件を見る」
  const moreBtn = ev.target.closest("[data-fresh-more]");
  if (moreBtn) {
    MORE_OPEN[moreBtn.dataset.freshMore] = true;
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
    return;
  }
  // 新着画面：テーマを開く／畳む（閉じた行の下の見出しを押しても開く）
  const freshOpen = ev.target.closest("[data-fresh-open]") || ev.target.closest("[data-fresh-peek]");
  if (freshOpen) {
    const k = freshOpen.dataset.freshOpen || freshOpen.dataset.freshPeek;
    FRESH_OPEN[k] = !FRESH_OPEN[k];
    ssSave();
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
    return;
  }
  const readFound = ev.target.closest(".read-all[data-found]");
  if (readFound) {
    const entry = ALL_GROUPS.find(function (x) { return x.group.name === readFound.dataset.found; });
    if (!entry) return;
    const y0 = window.scrollY;
    tidyUp((entry.group.items || []).filter(FOUND_TODAY ? isFoundToday : isFound),
      "「" + entry.group.name + "」の発掘", "found", screenOf(null));
    rerender();
    window.scrollTo(0, y0);
    return;
  }
  const readFresh = ev.target.closest(".read-all[data-fresh]");
  if (readFresh) {
    const entry = ALL_GROUPS.find(function (x) { return x.group.name === readFresh.dataset.fresh; });
    if (!entry) return;
    const y = window.scrollY;
    tidyUp((entry.group.items || []).filter(isFresh), "「" + entry.group.name + "」の新着",
      "tidy", SHOW_FRESH ? "fresh" : "morning");
    rerender();
    window.scrollTo(0, y);
    return;
  }
  if (ev.target.closest("#tidy-all-fresh")) {
    const items = [];
    ALL_GROUPS.forEach(function (x) { (x.group.items || []).filter(isFresh).forEach(function (a) { items.push(a); }); });
    tidyUp(items, "きょうの新着", "tidyall", SHOW_FRESH ? "fresh" : "morning");
    rerender();
    window.scrollTo(0, 0);
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
  // 発信元ごとの読み方の表を開く・閉じる
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
    if (!SETTINGS_OPEN) IMPORT_PREVIEW = null;
    rerender();
    return;
  }
  // 記録の書き出し・読み込み
  if (ev.target.closest("#backup-export")) {
    try {
      const size = downloadBackup();
      toast("書き出しました（" + Math.max(1, Math.round(size / 1024)) + "KB）");
    } catch (e) {
      toast("書き出せませんでした：" + String(e && e.message || e));
    }
    return;
  }
  if (ev.target.closest("#backup-import")) {
    const input = document.getElementById("backup-file");
    if (input) { input.value = ""; input.click(); }
    return;
  }
  if (ev.target.closest("#import-cancel")) {
    IMPORT_PREVIEW = null;
    rerender();
    return;
  }
  if (ev.target.closest("#import-apply")) {
    const p = IMPORT_PREVIEW;
    IMPORT_PREVIEW = null;
    if (p && p.ok && applyBackup(p.storage)) { location.reload(); return; }
    rerender();
    return;
  }
  if (ev.target.closest("#import-undo")) {
    const prev = beforeImport();
    if (!prev || !confirm("読み込む前の記録に戻します。よろしいですか？")) return;
    if (!replaceStorage(prev.storage)) { alert("端末に書き込めませんでした。記録は今のままです。"); return; }
    try { sessionStorage.removeItem(BEFORE_IMPORT_KEY); } catch (e) { /* 消せなくても続行 */ }
    location.reload();
    return;
  }
  // すべて既読（取り返しがつかないので確認する）
  if (ev.target.closest("#read-everything")) {
    if (!confirm("表示中のすべての記事を既読にします。よろしいですか？")) return;
    let n = 0;
    ALL_GROUPS.forEach(function (x) { markGroupRead(x.group.items); n += (x.group.items || []).length; });
    saveRead(READ);
    // 全件を1行ずつ残すと、ほかの記録が押し出されてしまう。「すべて既読にした」の1行だけ残す
    READLOG.push([Date.now(), "all", "", "", "（" + n + "件をまとめて既読）", ""]);
    saveReadLog();
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
    logRead([a], "open", screenOf(link));
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
      const rows = logRead([a], "swipe", screenOf(card));
      pushUndo("既読にしました", function () {
        if (link) delete READ[link];
        if (key) delete READ[key];
        saveRead(READ);
        unlogRead(rows);
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

// 読み込むファイルが選ばれたら、中身を調べて確認の表を出す（まだ何も変えない）
APP.addEventListener("change", function (ev) {
  if (!ev.target.matches("#backup-file")) return;
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  function show(p) { IMPORT_PREVIEW = p; SETTINGS_OPEN = true; rerender(); }
  if (file.size > BACKUP_FILE_MAX) {
    show({ ok: false, msg: "ファイルが大きすぎます（マイニュースの記録ではないようです）。何も変えていません。" });
    return;
  }
  const reader = new FileReader();
  reader.onload = function () { show(parseBackup(reader.result)); };
  reader.onerror = function () { show({ ok: false, msg: "ファイルを読めませんでした。何も変えていません。" }); };
  reader.readAsText(file);
});

// data.js（<script src> で先に読み込まれ window.NEWS_DATA に入っている）を描画。
try {
  const data = window.NEWS_DATA;
  if (!data) throw new Error("data.js が読み込まれていません（build_news.py を実行してください）");
  applyPrefs();
  render(data);
  // 読み込み直したときは、読んでいた位置に戻す（ページを開いている間だけ覚えている）
  const saved = ssGet();
  if (saved.y) window.scrollTo(0, saved.y);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") ssSave({ y: window.scrollY || 0 });
  });
  // ※「最後に開いた時刻」の記録は上（NEW_BASE の算出直後）で済ませている。
  //   ここで更新すると、再読み込みのたびに基準が動いて NEW が消えてしまう。
  // 記録を読み込んで開き直した直後だけ、知らせを出す
  const prev = beforeImport();
  if (prev && prev.notice) {
    prev.notice = false;
    try { sessionStorage.setItem(BEFORE_IMPORT_KEY, JSON.stringify(prev)); } catch (e) { /* 続行 */ }
    toast("記録を読み込みました（設定の「読み込む前に戻す」で戻せます）");
  }
} catch (err) {
  APP.innerHTML = '<div class="loaderr">ニュースデータを読み込めませんでした。'
    + "<br><small>" + esc(String(err)) + "</small></div>";
}
