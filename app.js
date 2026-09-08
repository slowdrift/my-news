// マイニュース 表示スクリプト
// data.js（build_news.py が生成し window.NEWS_DATA に入る）を、
// カテゴリ → テーマ(group) → 記事 の順に描画する。
//
// 既読管理：一度開いた記事は既定で一覧から消える（読むほどスクロールが短くなる）。
// 「既読も表示」に切り替えれば読み返せる。設定はこの端末のブラウザにだけ保存される。

"use strict";

const APP = document.getElementById("app");

// 画面最下部に出す版と更新履歴。改修のたびにここへ1行足す。
const APP_VERSION = "v1.5.0";
const CHANGELOG = [
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
const RENDER_CHUNK = 30;
let SHOWN = {};    // テーマの通し番号 → いま何件まで描いているか
let REREAD = {};   // 「読み返す」を押したテーマ（そのテーマだけ既読も出す）

// 記事そのものが古いと感じる境目（日）。ここに区切りを入れる。
const OLD_DAYS = 30;

// 選んでまとめて既読にするための状態。
// 「テーマごと全部」と「1件ずつ」の中間が無かったので、選んでから消せるようにする。
let SELECT_MODE = false;
let SELECTED = new Set();
let SETTINGS_OPEN = false;

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
const THEME_KEY = "mynews_theme";      // "auto" | "light" | "dark"
const FONT_KEY = "mynews_font";        // "s" | "m" | "l"
// NEWバッジを何日光らせるか。読めば消えるので、長すぎなければ邪魔にならない。
const NEW_DAYS = 7;
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

function countUnread(list) {
  return (list || []).filter(function (a) { return !isRead(a); }).length;
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
function isNew(a) {
  if (isRead(a)) return false;
  const src = a.first_seen || a.dt;
  if (!src) return false;
  const t = new Date(src).getTime();
  if (isNaN(t)) return false;
  // 初めて開いた日より前に集まっていた記事には付けない。
  // 付けてしまうと、初回や情報源を増やした日に全件が光って意味をなさなくなる。
  // 7日たてば初回の時刻より「7日前」のほうが新しくなり、この縛りは自然に外れる。
  return t > Math.max(Date.now() - NEW_DAYS * 86400000, FIRST_OPEN);
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
    + payBadge(a)
    + (a.blog ? '<span class="blog' + (a.corp ? " corp" : "") + '">'
        + (a.corp ? "企業ブログ" : "個人ブログ") + "</span>" : "")
    + (a.related ? '<span class="rel" title="見出しにテーマ名が無い記事">関連</span>' : "")
    + (a.via ? '<span class="chip">' + esc(a.via) + "</span>" : "")
    + (a.views ? '<span class="views">▶ ' + fmtViews(a.views) + "</span>" : "")
    + (t ? '<span class="time">' + esc(t) + "</span>" : "");
  return inner ? '<div class="meta">' + inner + "</div>" : "";
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
function lockedIn(all) {
  return (all || []).filter(function (a) {
    return !isRead(a) && (a.paywall === "paid" || a.paywall === "member" || a.paywall === "partial");
  });
}

function groupHead(g, gi, all) {
  const newCount = all.filter(isNew).length;
  const locked = lockedIn(all).length;
  return '<h3 class="ghead"><span class="gname">' + esc(g.name) + "</span>"
    + '<span class="gcount">' + countUnread(all) + "件</span>"
    + (newCount ? '<span class="gnew">NEW ' + newCount + "</span>" : "")
    + (locked ? '<button class="lock-btn" type="button" data-lock="' + gi
      + '" title="このテーマの読めない記事を既読にする">🔒 ' + locked + "</button>" : "")
    + '<button class="read-all" type="button" title="このテーマをまとめて既読にする">✓ 既読に</button>'
    + "</h3>";
}

function renderGroup(g, gi) {
  const all = g.items || [];
  const showRead = SHOW_ALL || REREAD[gi];
  const list = showRead ? all : all.filter(function (a) { return !isRead(a); });

  // 読み終えてもテーマは消さない。消えるとカテゴリごと画面から無くなり、
  // 読み返す手段も分からなくなるため、見出しと戻り道は必ず残す。
  if (!list.length) {
    return '<section class="group done" data-group="' + gi + '">'
      + groupHead(g, gi, all)
      + '<div class="empty">すべて読み終えました 🎉'
      + (all.length ? '<button class="reread-btn" type="button" data-reread="' + gi + '">'
        + "読み返す（" + all.length + "件）</button>" : "")
      + "</div></section>";
  }

  // 表示は「先頭から limit 件」だけ。ボタンを押すたびに増える。
  // 以前は「もっと見る」と「さらに古い記事」の2つが縦に並んでいたが、
  // 内部の仕組みの違いであって、読む側には区別が要らないので1つにまとめた。
  const limit = SHOWN[gi] || INITIAL_VISIBLE;
  const items = list.slice(0, limit);
  const rest = list.length - items.length;

  let h = '<section class="group" data-group="' + gi + '">'
    + groupHead(g, gi, all)
    + '<div class="gitems expanded">';
  // 配信日が古い記事との境目に区切りを入れる。
  // NEWバッジは「アプリに入ってきた新しさ」、この区切りは「記事自体の古さ」。
  let dividerDone = false;
  items.forEach(function (a, i) {
    const t = a.dt ? new Date(a.dt).getTime() : 0;
    if (!dividerDone && t && (Date.now() - t) > OLD_DAYS * 86400000) {
      dividerDone = true;
      h += '<div class="agesep"><span>ここから1か月以上前の記事</span></div>';
    }
    h += renderCard(a, false, i === 0);
  });
  h += "</div>";
  if (rest > 0) {
    h += '<button class="more-btn" type="button" data-older="' + gi + '">'
      + "もっと見る（残り" + rest + "件）</button>";
  }
  h += "</section>";
  return h;
}

function headUpdated(generatedAt) {
  if (!generatedAt) return "";
  const m = String(generatedAt).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return "更新: " + esc(generatedAt);
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  const note = days >= 1 ? "（" + days + "日前）" : "";
  const stale = days >= 2 ? " stale" : "";
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
    + '<div class="wplace">' + esc(w.place || "") + "</div>" + rows + "</div>";
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
  return '<section class="stocks"><h2>📈 株価</h2>' + rows + "</section>";
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
function toolbar() {
  const themeLabel = { auto: "🌓 自動", light: "☀ 明るい", dark: "🌙 暗い" }[THEME] || "🌓 自動";
  const fontLabel = { s: "小", m: "中", l: "大" }[FONT] || "中";
  const favCount = Object.keys(FAV).length;
  let h = '<div class="tools">'
    + '<button class="tool-btn star' + (SHOW_FAV ? " on" : "") + '" type="button" id="toggle-fav">'
    + "★ お気に入り" + (favCount ? " " + favCount : "") + "</button>"
    + '<button class="tool-btn' + (SHOW_ALL ? " on" : "") + '" type="button" id="toggle-read">'
    + (SHOW_ALL ? "☑ 既読も表示" : "☐ 既読も表示") + "</button>"
    + (SHOW_FAV ? "" : '<button class="tool-btn' + (SELECT_MODE ? " on" : "") + '" type="button" id="toggle-select">'
      + (SELECT_MODE ? "✓ 選択をやめる" : "✓ まとめて既読") + "</button>")
    + '<button class="tool-btn' + (SETTINGS_OPEN ? " on" : "") + '" type="button" id="toggle-settings">⚙ 設定</button>'
    + "</div>";
  if (SETTINGS_OPEN) {
    h += '<div class="settings">'
      + '<div class="srow"><span>配色</span>'
      + '<button class="tool-btn" type="button" id="toggle-theme">' + themeLabel + "</button></div>"
      + '<div class="srow"><span>文字の大きさ</span>'
      + '<button class="tool-btn" type="button" id="toggle-font">文字 ' + fontLabel + "</button></div>"
      + '<div class="srow"><span>いま読まないものを片づける</span>'
      + '<button class="tool-btn danger" type="button" id="read-everything">すべて既読</button></div>'
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
    + '<span class="unread">' + items.length + "件を保存中</span></div>"
    + toolbar() + "</header>"];

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

// ---- 通常の画面 ------------------------------------------------------------

function render(data) {
  if (SHOW_FAV) { renderFavView(data); return; }

  const parts = [];
  // 動画は記事と分けて扱う（見る時間帯が違うため）
  const articleGroups = ALL_GROUPS.filter(function (x) { return !x.video; });
  const videoGroups = ALL_GROUPS.filter(function (x) { return x.video; });

  let totalUnread = 0, totalNew = 0;
  articleGroups.forEach(function (x) {
    totalUnread += countUnread(x.group.items);
    totalNew += (x.group.items || []).filter(isNew).length;
  });
  let videoUnread = 0;
  videoGroups.forEach(function (x) { videoUnread += countUnread(x.group.items); });

  parts.push("<header><h1>📰 マイニュース</h1>"
    + '<div class="meta-head">' + headUpdated(data.generated_at)
    + '<span class="unread">未読 ' + totalUnread + "件</span>"
    + (totalNew ? '<span class="newcount">NEW ' + totalNew + "</span>" : "")
    + "</div>"
    + weatherLine(data.weather)
    + toolbar() + "</header>");

  const cats = (data.categories || []).map(function (c) { return c.name; });
  const navs = cats.map(function (name, i) {
    let u = 0;
    articleGroups.forEach(function (x) { if (x.cat === name) u += countUnread(x.group.items); });
    const mine = articleGroups.some(function (x) { return x.cat === name; });
    if (!mine) return "";   // 動画だけのカテゴリは、下の動画ブロックに現れる
    return '<a class="nav-chip" href="#cat' + i + '" style="--cat:'
      + CAT_COLORS[i % CAT_COLORS.length] + '">' + esc(name) + "<span>" + u + "</span></a>";
  }).join("");
  parts.push('<nav class="catnav">' + navs
    + (videoGroups.length
      ? '<a class="nav-chip" href="#videos" style="--cat:#dc2626">🎬 動画<span>'
        + videoUnread + "</span></a>"
      : "")
    + "</nav>");

  cats.forEach(function (name, ci) {
    const mine = articleGroups.filter(function (x) { return x.cat === name; });
    if (!mine.length) return;   // 動画だけのカテゴリは下の動画ブロックへ
    const body = mine.map(function (x) {
      return renderGroup(x.group, ALL_GROUPS.indexOf(x));
    }).join("");
    let unread = 0;
    mine.forEach(function (x) { unread += countUnread(x.group.items); });

    parts.push('<details class="cat" open id="cat' + ci + '" style="--cat:'
      + CAT_COLORS[ci % CAT_COLORS.length] + '">');
    parts.push("<summary><h2>" + esc(name)
      + '<span class="catcount">' + unread + "件</span></h2></summary>");
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
    parts.push('<details class="cat videos" open id="videos" style="--cat:#dc2626">');
    parts.push('<summary><h2>🎬 動画'
      + '<span class="catcount">' + videoUnread + "件</span></h2></summary>");
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
  if (ev.target.closest("#toggle-select")) {
    SELECT_MODE = !SELECT_MODE;
    SELECTED.clear();
    rerender();
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
    const gi = Number(more.dataset.older);
    SHOWN[gi] = (SHOWN[gi] || INITIAL_VISIBLE) + RENDER_CHUNK;
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
    return;
  }
  // 「読み返す」：そのテーマだけ既読も表示する
  const reread = ev.target.closest(".reread-btn");
  if (reread) {
    const gi = Number(reread.dataset.reread);
    REREAD[gi] = true;
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
    return;
  }
  // テーマ単位のまとめて既読
  const readAll = ev.target.closest(".read-all");
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
  // そのテーマの読めない記事（有料・会員限定・一部有料）を既読にする
  const lock = ev.target.closest(".lock-btn");
  if (lock) {
    const entry = ALL_GROUPS[Number(lock.dataset.lock)];
    if (!entry) return;
    const locked = lockedIn(entry.group.items);
    if (!locked.length) return;
    if (!confirm("「" + entry.group.name + "」の読めない記事 " + locked.length
      + "件を既読にします。よろしいですか？")) return;
    const y = window.scrollY;
    locked.forEach(markRead);
    rerender();
    window.scrollTo(0, y);
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
    const a = BY_LINK[link.dataset.link] || { link: link.dataset.link, title: "" };
    markRead(a);
    const card = link.closest(".card");
    if (card) card.classList.add("read");
  }
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
