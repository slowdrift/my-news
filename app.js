// マイニュース 表示スクリプト
// data.js（build_news.py が生成し window.NEWS_DATA に入る）を、
// カテゴリ → テーマ(group) → 記事 の順に描画する。
//
// 既読管理：一度開いた記事は既定で一覧から消える（読むほどスクロールが短くなる）。
// 「既読も表示」に切り替えれば読み返せる。設定はこの端末のブラウザにだけ保存される。

"use strict";

const APP = document.getElementById("app");

// テーマごとに初期表示する件数
const INITIAL_VISIBLE = 3;

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
const LASTOPEN_KEY = "mynews_lastseen"; // 前回このページを開いた時刻(ms)
const BUILD_KEY = "mynews_lastbuild";   // 前回開いたデータの生成時刻（NEWを据え置くための鍵）
const NEWBASE_KEY = "mynews_newbase";   // NEW判定の基準時刻(ms)。データが変わるまで動かさない

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
let SHOW_ALL = lsGet(SHOWALL_KEY, "0") === "1";
let SHOW_FAV = lsGet(SHOWFAV_KEY, "0") === "1";
let THEME = lsGet(THEME_KEY, "auto");
let FONT = lsGet(FONT_KEY, "m");

// NEW判定の基準時刻。
// 以前は「描画のたびに今の時刻へ更新」していたため、一度開くと基準が“たった今”になり、
// 再読み込み（スマホの引っぱって更新）でバッジが必ず消えていた。
// そこで基準を、データ（generated_at）が入れ替わるまで動かさないようにする。
//   基準 = 「新しいデータが届く前に、最後にアプリを開いた時刻」
// これなら同じデータを何度読み込んでも NEW は据え置かれる。
const BUILD_ID = String((window.NEWS_DATA || {}).generated_at || "");
let NEW_BASE = Number(lsGet(NEWBASE_KEY, "0")) || 0;
if (BUILD_ID && BUILD_ID !== lsGet(BUILD_KEY, "")) {
  NEW_BASE = Number(lsGet(LASTOPEN_KEY, "0")) || 0;  // 前回開いた時刻まで基準を進める
  lsSet(NEWBASE_KEY, String(NEW_BASE));
  lsSet(BUILD_KEY, BUILD_ID);
}
lsSet(LASTOPEN_KEY, String(Date.now()));

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

// 前回の訪問より後に「アプリへ入ってきた」記事か（NEWバッジの判定）
// 記事の配信日で判定すると、過去の記事しか無い日は永久にNEWが付かないため、
// 収集側が記録した first_seen（初めて見つけた日時）と比べる。
function isNew(a) {
  if (!NEW_BASE) return false;  // 初回訪問は全部が新着になってしまうので付けない
  const src = a.first_seen || a.dt;
  if (!src) return false;
  const t = new Date(src).getTime();
  return !isNaN(t) && t > NEW_BASE;
}

// ---- 表示用の小さな道具 --------------------------------------------------

function esc(s) {
  return (s == null ? "" : String(s)).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function fmtDate(iso) {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", month: "numeric", day: "numeric",
  }).formatToParts(d).reduce(function (a, x) { a[x.type] = x.value; return a; }, {});
  return p.month + "/" + p.day;
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
    + (a.blog ? '<span class="blog">個人ブログ</span>' : "")
    + (a.via ? '<span class="chip">' + esc(a.via) + "</span>" : "")
    + (a.views ? '<span class="views">▶ ' + fmtViews(a.views) + "</span>" : "")
    + (t ? '<span class="time">' + esc(t) + "</span>" : "");
  return inner ? '<div class="meta">' + inner + "</div>" : "";
}

// ★ボタン。リンクの外側に置くので、押しても記事は開かない。
function favBtn(a) {
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
    + (isRead(a) ? " read" : "");

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

function renderGroup(g, gi) {
  const all = g.items || [];
  const items = SHOW_ALL ? all : all.filter(function (a) { return !isRead(a); });
  if (!items.length) return "";

  const hiddenCount = Math.max(0, items.length - INITIAL_VISIBLE);
  const newCount = all.filter(isNew).length;

  let h = '<section class="group" data-group="' + gi + '">'
    + '<h3 class="ghead"><span class="gname">' + esc(g.name) + "</span>"
    + '<span class="gcount">' + countUnread(all) + "件</span>"
    + (newCount ? '<span class="gnew">NEW ' + newCount + "</span>" : "")
    + '<button class="read-all" type="button" title="このテーマをまとめて既読にする">✓ 既読に</button>'
    + "</h3>"
    + '<div class="gitems">';
  items.forEach(function (a, i) {
    h += renderCard(a, i >= INITIAL_VISIBLE, i === 0);
  });
  h += "</div>";
  if (hiddenCount > 0) {
    h += '<button class="more-btn" type="button" data-more="' + hiddenCount + '">'
      + "もっと見る（+" + hiddenCount + "）</button>";
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

function toolbar() {
  const themeLabel = { auto: "🌓 自動", light: "☀ 明るい", dark: "🌙 暗い" }[THEME] || "🌓 自動";
  const fontLabel = { s: "小", m: "中", l: "大" }[FONT] || "中";
  const favCount = Object.keys(FAV).length;
  return '<div class="tools">'
    + '<button class="tool-btn star' + (SHOW_FAV ? " on" : "") + '" type="button" id="toggle-fav">'
    + "★ お気に入り" + (favCount ? " " + favCount : "") + "</button>"
    + '<button class="tool-btn' + (SHOW_ALL ? " on" : "") + '" type="button" id="toggle-read">'
    + (SHOW_ALL ? "☑ 既読も表示" : "☐ 既読も表示") + "</button>"
    + '<button class="tool-btn" type="button" id="toggle-theme">' + themeLabel + "</button>"
    + '<button class="tool-btn" type="button" id="toggle-font">文字 ' + fontLabel + "</button>"
    + (SHOW_FAV ? "" : '<button class="tool-btn danger" type="button" id="read-everything">すべて既読</button>')
    + "</div>";
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

  // 動画は最下部の独立ブロックへ。まとめて見るものなので、既定は閉じておく。
  if (videoGroups.length) {
    const body = videoGroups.map(function (x) {
      return renderGroup(x.group, ALL_GROUPS.indexOf(x));
    }).join("");
    parts.push('<details class="cat videos" id="videos" style="--cat:#dc2626">');
    parts.push('<summary><h2>🎬 動画（あとで見る）'
      + '<span class="catcount">' + videoUnread + "件</span></h2></summary>");
    parts.push('<div class="body">');
    parts.push(body || '<div class="empty">すべて見終えました 🎉</div>');
    parts.push("</div></details>");
  }

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

  APP.innerHTML = parts.join("\n");
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
  // ★お気に入りの登録・解除（記事は開かない）
  const fav = ev.target.closest(".fav");
  if (fav) {
    ev.preventDefault();
    const key = fav.dataset.fav;
    const a = BY_LINK[key] || FAV[key];
    if (a) { toggleFav(a); rerender(); }
    return;
  }
  // 「もっと見る」/「閉じる」
  const more = ev.target.closest(".more-btn");
  if (more) {
    const items = more.previousElementSibling;
    const expanded = items.classList.toggle("expanded");
    more.textContent = expanded ? "閉じる" : "もっと見る（+" + more.dataset.more + "）";
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
