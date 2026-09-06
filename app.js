// マイニュース 表示スクリプト
// data.js（build_news.py が生成し window.NEWS_DATA に入る）を、
// カテゴリ → テーマ(group) → 記事 の順に描画する。
//
// 既読管理：一度開いた記事は既定で一覧から消える（読むほどスクロールが短くなる）。
// 「既読も表示」に切り替えれば読み返せる。既読はこの端末のブラウザにだけ保存される。

"use strict";

const APP = document.getElementById("app");

// テーマごとに初期表示する件数（動画も横並びで小さくしたので記事と同じ数にできる）
const INITIAL_VISIBLE = 3;

// カテゴリごとのアクセント色（見出し・リード・件数に薄く効かせる）
const CAT_COLORS = ["#7c3aed", "#2563eb", "#059669", "#ea580c", "#ca8a04", "#db2777"];

// URL に ?debug を付けたときだけ診断情報を画面に出す（通常は非表示・コンソールのみ）
const DEBUG = /[?&]debug\b/.test(location.search);

// ---- 既読の保存（localStorage）------------------------------------------
// 使えない環境（プライベートモード等）でも画面が壊れないよう、必ず try/catch で包む。
const READ_KEY = "mynews_read";        // { 記事URL: 既読にした時刻(ms) }
const SHOWALL_KEY = "mynews_showall";  // "1" なら既読も表示
const READ_KEEP_DAYS = 180;            // これより古い既読は捨てて容量を抑える

function loadRead() {
  try {
    const obj = JSON.parse(localStorage.getItem(READ_KEY) || "{}");
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

function saveRead(obj) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(obj));
  } catch (e) { /* 保存できなくても表示は続行する */ }
}

let READ = loadRead();

let SHOW_ALL = (function () {
  try { return localStorage.getItem(SHOWALL_KEY) === "1"; } catch (e) { return false; }
})();

function setShowAll(v) {
  SHOW_ALL = v;
  try { localStorage.setItem(SHOWALL_KEY, v ? "1" : "0"); } catch (e) { /* 続行 */ }
}

function isRead(a) { return !!READ[a.link]; }

function markRead(link) {
  READ[link] = Date.now();
  saveRead(READ);
}

function countUnread(list) {
  return (list || []).filter(function (a) { return !isRead(a); }).length;
}

// ---- 表示用の小さな道具 --------------------------------------------------

// HTMLエスケープ（属性値も安全になるよう引用符も変換）
function esc(s) {
  return (s == null ? "" : String(s)).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

// ISO日時 → 日本時間の "M/D"（古い記事の絶対表示用）
function fmtDate(iso) {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", month: "numeric", day: "numeric",
  }).formatToParts(d).reduce(function (a, x) { a[x.type] = x.value; return a; }, {});
  return p.month + "/" + p.day;
}

// ISO日時 → 「3時間前」「昨日」等の相対表示（1週間以上前は M/D）
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

// 有料記事の印（開く前に分かるようにタイトル直下へ）
function payBadge(a) {
  if (a.paywall === "paid") return '<span class="pw paid">🔒 有料</span>';
  if (a.paywall === "partial") return '<span class="pw partial">一部有料</span>';
  return "";
}

// 有料バッジ＋発信元チップ＋時刻のメタ行
function metaRow(a) {
  const t = relTime(a.dt);
  const inner = payBadge(a)
    + (a.via ? '<span class="chip">' + esc(a.via) + "</span>" : "")
    + (t ? '<span class="time">' + esc(t) + "</span>" : "");
  return inner ? '<div class="meta">' + inner + "</div>" : "";
}

// 1記事のカード。開いたら既読にするため、リンクに data-link を持たせる。
function renderCard(a, hidden, lead) {
  const link = esc(a.link);
  const title = esc(a.title);
  const cls = "card"
    + (a.kind === "video" ? " video" : "")
    + (lead && a.kind !== "video" ? " lead" : "")
    + (hidden ? " extra" : "")
    + (isRead(a) ? " read" : "");

  if (a.kind === "video") {
    // 横並び（左サムネ・右タイトル）にして高さを抑える
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
  // リード文はリード記事だけに出して、コンパクトな行との差をつける
  if (lead && a.summary) h += '<div class="summary">' + esc(a.summary) + "</div>";
  h += "</div>";
  return h;
}

function renderGroup(g) {
  const all = g.items || [];
  // 既読を隠す設定なら、ここで先に除く（未読だけが並ぶ）
  const items = SHOW_ALL ? all : all.filter(function (a) { return !isRead(a); });
  if (!items.length) return "";

  const hiddenCount = Math.max(0, items.length - INITIAL_VISIBLE);

  let h = '<section class="group">'
    + '<h3 class="ghead"><span class="gname">' + esc(g.name) + "</span>"
    + '<span class="gcount">' + countUnread(all) + "件</span></h3>"
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

// 「更新: 9/6 10:22（3日前）」のように、データの鮮度が一目で分かるようにする
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

function render(data) {
  const cats = data.categories || [];
  const parts = [];

  let totalUnread = 0;
  cats.forEach(function (c) {
    (c.groups || []).forEach(function (g) { totalUnread += countUnread(g.items); });
  });

  parts.push("<header><h1>📰 マイニュース</h1>"
    + '<div class="meta-head">' + headUpdated(data.generated_at)
    + '<span class="unread">未読 ' + totalUnread + "件</span></div>"
    + '<div class="tools"><button class="tool-btn' + (SHOW_ALL ? " on" : "")
    + '" type="button" id="toggle-read">'
    + (SHOW_ALL ? "☑ 既読も表示" : "☐ 既読も表示") + "</button></div></header>");

  // 上部のカテゴリジャンプ（長い一覧でも目的地へ飛べる）
  const navs = cats.map(function (c, i) {
    let u = 0;
    (c.groups || []).forEach(function (g) { u += countUnread(g.items); });
    return '<a class="nav-chip" href="#cat' + i + '" style="--cat:'
      + CAT_COLORS[i % CAT_COLORS.length] + '">' + esc(c.name) + "<span>" + u + "</span></a>";
  }).join("");
  parts.push('<nav class="catnav">' + navs + "</nav>");

  cats.forEach(function (cat, ci) {
    const groups = cat.groups || [];
    const body = groups.map(renderGroup).join("");
    let unread = 0;
    groups.forEach(function (g) { unread += countUnread(g.items); });

    parts.push('<details class="cat" open id="cat' + ci + '" style="--cat:'
      + CAT_COLORS[ci % CAT_COLORS.length] + '">');
    parts.push("<summary><h2>" + esc(cat.name)
      + '<span class="catcount">' + unread + "件</span></h2></summary>");
    parts.push('<div class="body">');
    if (!body) {
      parts.push(SHOW_ALL
        ? '<div class="empty">この時間は取得できた記事がありませんでした。</div>'
        : '<div class="empty">すべて読み終えました 🎉</div>');
    } else {
      parts.push(body);
    }
    parts.push("</div></details>");
  });

  // 取得サマリーは内部情報なので、本番ページには出さずコンソールへ。
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

// ---- 操作 ---------------------------------------------------------------

APP.addEventListener("click", function (ev) {
  // 「もっと見る」/「閉じる」
  const more = ev.target.closest(".more-btn");
  if (more) {
    const items = more.previousElementSibling;  // .gitems
    const expanded = items.classList.toggle("expanded");
    more.textContent = expanded ? "閉じる" : "もっと見る（+" + more.dataset.more + "）";
    return;
  }
  // 「既読も表示」の切り替え
  if (ev.target.closest("#toggle-read")) {
    setShowAll(!SHOW_ALL);
    render(window.NEWS_DATA);
    window.scrollTo(0, 0);
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
// fetch を使わないので、ローカルサーバ無し（ファイルを直接開く file://）でも動く。
try {
  const data = window.NEWS_DATA;
  if (!data) throw new Error("data.js が読み込まれていません（build_news.py を実行してください）");
  render(data);
} catch (err) {
  APP.innerHTML = '<div class="loaderr">ニュースデータを読み込めませんでした。'
    + "<br><small>" + esc(String(err)) + "</small></div>";
}
