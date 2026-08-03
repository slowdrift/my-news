// マイニュース 表示スクリプト
// data.js（build_news.py が生成し window.NEWS_DATA に入る）を、
// カテゴリ → テーマ(group) → 記事 の順に描画する。
// 各テーマは先頭を大きな「リード」で見せ、以降はコンパクトに（羅列感の解消）。
// skim優先：各テーマは最初は数件だけ表示し「もっと見る」で残りを開く。

"use strict";

const APP = document.getElementById("app");

// テーマごとに初期表示する件数（記事は多め、動画は縦に長いので少なめ）
const INITIAL_VISIBLE = { article: 4, video: 2 };

// カテゴリごとのアクセント色（見出し・リード・件数に薄く効かせる）
const CAT_COLORS = ["#7c3aed", "#2563eb", "#059669", "#ea580c", "#ca8a04", "#db2777"];

// URL に ?debug を付けたときだけ診断情報を画面に出す（通常は非表示・コンソールのみ）
const DEBUG = /[?&]debug\b/.test(location.search);

// HTMLエスケープ（属性値も安全になるよう引用符も変換）
function esc(s) {
  return (s == null ? "" : String(s)).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ISO日時 → 日本時間の "M/D"（古い記事の絶対表示用）
function fmtDate(iso) {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", month: "numeric", day: "numeric",
  }).formatToParts(d).reduce((a, x) => (a[x.type] = x.value, a), {});
  return `${p.month}/${p.day}`;
}

// ISO日時 → 「3時間前」「昨日」等の相対表示（1週間以上前は M/D）
function relTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  const day = Math.floor(h / 24);
  if (day === 1) return "昨日";
  if (day < 7) return `${day}日前`;
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
  const badge = payBadge(a);
  const chip = a.via ? `<span class="chip">${esc(a.via)}</span>` : "";
  const t = relTime(a.dt);
  const time = t ? `<span class="time">${esc(t)}</span>` : "";
  const inner = badge + chip + time;
  return inner ? `<div class="meta">${inner}</div>` : "";
}

// 1記事のカード。lead=先頭記事（大きく・リード文つき）、それ以外はコンパクト。
function renderCard(a, hidden, lead) {
  const link = esc(a.link);
  const title = esc(a.title);
  const cls = "card"
    + (a.kind === "video" ? " video" : "")
    + (lead ? " lead" : "")
    + (hidden ? " extra" : "");

  if (a.kind === "video") {
    // サムネイルとタイトルを1つのリンクに統合（タブ移動1回・重複リンクを解消）。
    // 画像は装飾なので alt="" にしてタイトルの二重読み上げを避ける。
    let h = `<div class="${cls}">`;
    h += `<a class="vlink" href="${link}" target="_blank" rel="noopener">`;
    if (a.thumb) {
      h += `<span class="thumb"><img loading="lazy" src="${esc(a.thumb)}" alt="">`
        + `<span class="play">▶</span></span>`;
    }
    h += `<span class="title">${title}</span></a>`;
    const mr = metaRow(a);
    if (mr) h += `<div class="vfoot">${mr}</div>`;
    return h + "</div>";
  }

  let h = `<div class="${cls}">`
    + `<a class="title" href="${link}" target="_blank" rel="noopener">${title}</a>`
    + metaRow(a);
  // リード文はリード記事だけに出して、コンパクトな行との差をつける
  if (lead && a.summary) h += `<div class="summary">${esc(a.summary)}</div>`;
  h += "</div>";
  return h;
}

function renderGroup(g) {
  const items = g.items || [];
  if (!items.length) return "";
  const kind = items[0].kind === "video" ? "video" : "article";
  const n = INITIAL_VISIBLE[kind];
  const hiddenCount = Math.max(0, items.length - n);

  // テーマ名は h3（カテゴリの h2 の下位）。見出しジャンプで構造をたどれるようにする。
  let h = '<section class="group">';
  h += `<h3 class="ghead"><span class="gname">${esc(g.name)}</span>`
    + `<span class="gcount">${items.length}件</span></h3>`;
  h += '<div class="gitems">';
  items.forEach((a, i) => {
    // 記事テーマは先頭をリードに。動画はサムネで十分目立つのでリード化しない。
    const lead = (i === 0 && kind === "article");
    h += renderCard(a, i >= n, lead);
  });
  h += "</div>";
  if (hiddenCount > 0) {
    h += `<button class="more-btn" type="button" data-more="${hiddenCount}">`
      + `もっと見る（+${hiddenCount}）</button>`;
  }
  h += "</section>";
  return h;
}

// 「更新: 7/21 11:11（3日前）」のように、データの鮮度が一目で分かるようにする
function headUpdated(generatedAt) {
  if (!generatedAt) return "";
  // "YYYY-MM-DD HH:MM"（ローカル時刻）を Date に。パースできなければそのまま出す。
  const m = String(generatedAt).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return `更新: ${esc(generatedAt)}`;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  let note = "";
  if (days >= 1) note = `（${days}日前）`;
  const stale = days >= 2 ? " stale" : "";
  return `更新: ${esc(generatedAt)}<span class="age${stale}">${note}</span>`;
}

function render(data) {
  const parts = [];
  parts.push(`<header><h1>📰 マイニュース</h1>`
    + `<div class="meta-head">${headUpdated(data.generated_at)}</div></header>`);

  (data.categories || []).forEach((cat, ci) => {
    const groups = cat.groups || [];
    const count = groups.reduce((s, g) => s + (g.items ? g.items.length : 0), 0);
    const color = CAT_COLORS[ci % CAT_COLORS.length];
    // カテゴリ名は h2。<summary> の中に置くことで、見出しジャンプでも開閉でも辿れる。
    parts.push(`<details class="cat" open style="--cat:${color}">`);
    parts.push(`<summary><h2>${esc(cat.name)}<span class="catcount">${count}件</span></h2></summary>`);
    parts.push('<div class="body">');
    if (count === 0) {
      parts.push('<div class="empty">この時間は取得できた記事がありませんでした。</div>');
    } else {
      for (const g of groups) parts.push(renderGroup(g));
    }
    parts.push("</div></details>");
  });

  // 取得サマリーは内部情報なので、本番ページには出さずコンソールへ。
  // URL に ?debug を付けたときだけ画面下部にも表示する（保守用）。
  if (window.console && console.table) {
    console.groupCollapsed("マイニュース 取得サマリー");
    console.table(data.sources || []);
    console.groupEnd();
  }
  if (DEBUG) {
    parts.push('<footer><details class="diag" open><summary>診断情報（取得サマリー）</summary><table>');
    for (const s of (data.sources || [])) {
      const ok = (s.status || "").startsWith("OK");
      parts.push(`<tr><td>${esc(s.name)}</td>`
        + `<td class="${ok ? "st-ok" : "st-ng"}">${esc(s.status)}</td></tr>`);
    }
    parts.push("</table></details></footer>");
  }

  APP.innerHTML = parts.join("\n");
}

// 「もっと見る」/「閉じる」：クリックしたテーマの隠れカードを開閉する（イベント委譲）
APP.addEventListener("click", (ev) => {
  const btn = ev.target.closest(".more-btn");
  if (!btn) return;
  const items = btn.previousElementSibling; // .gitems
  const expanded = items.classList.toggle("expanded");
  btn.textContent = expanded ? "閉じる" : `もっと見る（+${btn.dataset.more}）`;
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
