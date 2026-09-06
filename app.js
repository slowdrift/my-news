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
const READ_KEY = "mynews_read";        // { 記事URL: 既読にした時刻(ms) }
const SHOWALL_KEY = "mynews_showall";  // "1" なら既読も表示
const THEME_KEY = "mynews_theme";      // "auto" | "light" | "dark"
const FONT_KEY = "mynews_font";        // "s" | "m" | "l"
const LASTSEEN_KEY = "mynews_lastseen"; // 前回このページを開いた時刻(ms)
const READ_KEEP_DAYS = 180;            // これより古い既読は捨てて容量を抑える

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
    // 古い既読を掃除（記事が入れ替わっても記録だけ残り続けるのを防ぐ）
    const limit = Date.now() - READ_KEEP_DAYS * 86400000;
    let changed = false;
    for (const k of Object.keys(obj)) {
      if (!(obj[k] > limit)) { delete obj[k]; changed = true; }
    }
    if (changed) saveRead(obj);
    return obj;
  } catch (e) {
    return {};  // 読めなければ「既読ゼロ」とみなし、全件表示で動き続ける
  }
}

function saveRead(obj) { lsSet(READ_KEY, JSON.stringify(obj)); }

let READ = loadRead();
let SHOW_ALL = lsGet(SHOWALL_KEY, "0") === "1";
let THEME = lsGet(THEME_KEY, "auto");
let FONT = lsGet(FONT_KEY, "m");

// 前回開いた時刻。これより後に配信された記事に NEW を付ける。
// 描画に使うため先に読み出し、更新は描画後に行う（同じ訪問中はNEWが消えないように）。
const LAST_SEEN = Number(lsGet(LASTSEEN_KEY, "0")) || 0;

function isRead(a) { return !!READ[a.link]; }
function markRead(link) { READ[link] = Date.now(); saveRead(READ); }
function countUnread(list) { return (list || []).filter((a) => !isRead(a)).length; }

// 前回の訪問より後に出た記事か（NEWバッジの判定）
function isNew(a) {
  if (!LAST_SEEN || !a.dt) return false;
  const t = new Date(a.dt).getTime();
  return !isNaN(t) && t > LAST_SEEN;
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
  if (a.paywall === "partial") return '<span class="pw partial">一部有料</span>';
  return "";
}

// NEW＋有料バッジ＋発信元＋再生回数＋時刻のメタ行
function metaRow(a) {
  const t = relTime(a.dt);
  const inner = (isNew(a) ? '<span class="new">NEW</span>' : "")
    + payBadge(a)
    + (a.via ? '<span class="chip">' + esc(a.via) + "</span>" : "")
    + (a.views ? '<span class="views">▶ ' + fmtViews(a.views) + "</span>" : "")
    + (t ? '<span class="time">' + esc(t) + "</span>" : "");
  return inner ? '<div class="meta">' + inner + "</div>" : "";
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
      + "</a></div>";
    return h;
  }

  let h = '<div class="' + cls + '">'
    + '<a class="title" href="' + link + '" target="_blank" rel="noopener" data-link="' + link + '">'
    + title + "</a>"
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

function render(data) {
  const cats = data.categories || [];
  const parts = [];

  let totalUnread = 0, totalNew = 0;
  cats.forEach(function (c) {
    (c.groups || []).forEach(function (g) {
      totalUnread += countUnread(g.items);
      totalNew += (g.items || []).filter(isNew).length;
    });
  });

  const themeLabel = { auto: "🌓 自動", light: "☀ 明るい", dark: "🌙 暗い" }[THEME] || "🌓 自動";
  const fontLabel = { s: "小", m: "中", l: "大" }[FONT] || "中";

  parts.push("<header><h1>📰 マイニュース</h1>"
    + '<div class="meta-head">' + headUpdated(data.generated_at)
    + '<span class="unread">未読 ' + totalUnread + "件</span>"
    + (totalNew ? '<span class="newcount">NEW ' + totalNew + "</span>" : "")
    + "</div>"
    + '<div class="tools">'
    + '<button class="tool-btn' + (SHOW_ALL ? " on" : "") + '" type="button" id="toggle-read">'
    + (SHOW_ALL ? "☑ 既読も表示" : "☐ 既読も表示") + "</button>"
    + '<button class="tool-btn" type="button" id="toggle-theme">' + themeLabel + "</button>"
    + '<button class="tool-btn" type="button" id="toggle-font">文字 ' + fontLabel + "</button>"
    + '<button class="tool-btn danger" type="button" id="read-everything">すべて既読</button>'
    + "</div></header>");

  const navs = cats.map(function (c, i) {
    let u = 0;
    (c.groups || []).forEach(function (g) { u += countUnread(g.items); });
    return '<a class="nav-chip" href="#cat' + i + '" style="--cat:'
      + CAT_COLORS[i % CAT_COLORS.length] + '">' + esc(c.name) + "<span>" + u + "</span></a>";
  }).join("");
  parts.push('<nav class="catnav">' + navs + "</nav>");

  let gi = 0;
  cats.forEach(function (cat, ci) {
    const groups = cat.groups || [];
    const body = groups.map(function (g) { return renderGroup(g, gi++); }).join("");
    let unread = 0;
    groups.forEach(function (g) { unread += countUnread(g.items); });

    parts.push('<details class="cat" open id="cat' + ci + '" style="--cat:'
      + CAT_COLORS[ci % CAT_COLORS.length] + '">');
    parts.push("<summary><h2>" + esc(cat.name)
      + '<span class="catcount">' + unread + "件</span></h2></summary>");
    parts.push('<div class="body">');
    parts.push(body || (SHOW_ALL
      ? '<div class="empty">この時間は取得できた記事がありませんでした。</div>'
      : '<div class="empty">すべて読み終えました 🎉</div>'));
    parts.push("</div></details>");
  });

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

// 表示中のグループから、対応する記事一覧を取り出す
function groupItemsByIndex(gi) {
  let n = 0;
  const cats = (window.NEWS_DATA || {}).categories || [];
  for (const c of cats) {
    for (const g of (c.groups || [])) {
      if (n === gi) return g.items || [];
      n++;
    }
  }
  return [];
}

function rerender() {
  render(window.NEWS_DATA);
  applyPrefs();
}

// ---- 操作 ---------------------------------------------------------------

APP.addEventListener("click", function (ev) {
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
    groupItemsByIndex(gi).forEach(function (a) { if (a.link) READ[a.link] = Date.now(); });
    saveRead(READ);
    rerender();
    return;
  }
  // すべて既読（取り返しがつかないので確認する）
  if (ev.target.closest("#read-everything")) {
    if (!confirm("表示中のすべての記事を既読にします。よろしいですか？")) return;
    const cats = (window.NEWS_DATA || {}).categories || [];
    cats.forEach(function (c) {
      (c.groups || []).forEach(function (g) {
        (g.items || []).forEach(function (a) { if (a.link) READ[a.link] = Date.now(); });
      });
    });
    saveRead(READ);
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
    markRead(link.dataset.link);
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
  // 描画が終わってから「最後に見た時刻」を更新する（今回のNEWは残したいため）
  lsSet(LASTSEEN_KEY, String(Date.now()));
} catch (err) {
  APP.innerHTML = '<div class="loaderr">ニュースデータを読み込めませんでした。'
    + "<br><small>" + esc(String(err)) + "</small></div>";
}
