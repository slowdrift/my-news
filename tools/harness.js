// 検査台：スマホの代わりに app.js をパソコン上で動かし、画面に出るものを数える。
//
// Claude はスマホの画面を直接見られない。そこで app.js を「仮の画面」で動かし、
// 「全部閉じるを押したらカードが何枚になったか」「翌日に開き直すと既読は残るか」を
// 数字で確かめる。点検（REVIEW_PROMPT.md）と改善（IMPROVE_PROMPT.md）の両方で使う。
//
// 使い方:
//   node tools/harness.js <data.js> <app.js> <記録.json> <時計を進める時間> <調べる式.js>
//
//   記録.json   … スマホの localStorage の代わり。無ければ「30日使い続けた状態」で作る。
//                 同じファイルを続けて使えば「閉じて、また開く」を再現できる。
//   時計を進める … 24 なら翌日に開いたことになる。
//   調べる式.js … 画面を開いた直後に実行する式。最後の値が JSON で表示される。
//                 使える道具:
//                   __APP.innerHTML      … 描かれた画面（HTML）
//                   __click(選択子, dataset) … ボタンを押す（例: __click(".more-btn", {older: "本田圭佑"})）
//                   __undo()             … 最後に出た知らせの「元に戻す」を押す
//                   __loadError          … 読み込み時のエラー（無ければ null）
//                   ほかに app.js の関数（isNew, isFresh, searchHits …）もそのまま呼べる。
//
// 例（公開版を30日使った人が朝に開いた状態で、カードの枚数を数える）:
//   curl -s https://slowdrift.github.io/my-news/data.js -o pub.js
//   curl -s https://slowdrift.github.io/my-news/app.js  -o pubapp.js
//   echo '({ カード: (__APP.innerHTML.match(/class="card/g)||[]).length })' > q.js
//   node tools/harness.js pub.js pubapp.js store.json 0 q.js

const fs = require("fs");
const vm = require("vm");

const [dataPath, appPath, storePath, shiftH, probePath] = process.argv.slice(2);
if (!probePath) {
  console.error("使い方: node tools/harness.js <data.js> <app.js> <記録.json> <時計を進める時間> <調べる式.js>");
  process.exit(2);
}

// スマホの localStorage の代わり。新しく作るときは「30日前から使っている人」にする
// （初めて開いた日の前に集まった記事には NEW を付けない仕様のため、
//   まっさらだと NEW や新着が0件に見えてしまう）。
const store = fs.existsSync(storePath)
  ? JSON.parse(fs.readFileSync(storePath, "utf8"))
  : { mynews_firstopen: String(Date.now() - 30 * 86400000) };

// 時計を進める（翌日・1週間後に開いた状態を作る）
const shift = Number(shiftH || 0) * 3600000;
const RealDate = Date;
class FakeDate extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + shift); }
  static now() { return RealDate.now() + shift; }
}

// 画面の部品の代わり。app.js が触る最低限だけを用意する。
const LISTENERS = {};
function el(id) {
  const self = {
    id, innerHTML: "", value: "", dataset: {}, style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener(type, fn) { if (id === "app") (LISTENERS[type] = LISTENERS[type] || []).push(fn); },
    removeEventListener() {}, focus() {}, setSelectionRange() {},
    remove() {}, appendChild() {}, querySelector() { return el("q"); }, querySelectorAll() { return []; },
    setAttribute() {}, getBoundingClientRect() { return { width: 400 }; },
  };
  // 「元に戻す」などの部品の押下を拾えるように、部品ごとの受け手を覚えておく
  self.addEventListener = function (type, fn) {
    if (id === "app") (LISTENERS[type] = LISTENERS[type] || []).push(fn);
    else (self._on = self._on || {})[type] = fn;
  };
  self.querySelector = function (sel) {
    if (sel === "#toast-undo") return (self._undo = self._undo || el("toast-undo"));
    return el("q");
  };
  if (id === "x") LAST_CREATED.push(self);
  return self;
}
const LAST_CREATED = [];
const nodes = {};
const document = {
  getElementById(id) { return nodes[id] || (id === "app" ? (nodes.app = el("app")) : null); },
  documentElement: el("html"), body: el("body"), createElement: () => el("x"),
  querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {},
};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};

const ctx = {
  document, localStorage, Date: FakeDate, setTimeout, clearTimeout,
  // app.js がコンソールに出す取得サマリーなどは黙らせる（エラーだけ表示）
  console: new Proxy({}, { get: (t, k) => (k === "error" ? console.error : () => {}) }),
  confirm: () => true, URL, URLSearchParams, Intl,
  location: { reload() {}, search: "" }, scrollY: 0, scrollTo() {},
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  navigator: { userAgent: "Android" },
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(dataPath, "utf8"), ctx);

let loadError = null;
try { vm.runInContext(fs.readFileSync(appPath, "utf8"), ctx); } catch (e) { loadError = e; }
ctx.__APP = document.getElementById("app");
ctx.__loadError = loadError ? String(loadError) : null;

// ボタンを押したことにする。app.js は画面全体で押下を受けて closest() で振り分けるので、
// その形に合わせた「押された物」を作って渡す。
ctx.__click = function (selector, dataset) {
  const hit = { dataset: dataset || {}, matches: s => s === selector };
  const target = {
    closest: s => (s === selector || s.split(",").map(x => x.trim()).includes(selector) ? hit : null),
    matches: s => s === selector,
    dataset: dataset || {},
  };
  const ev = { target, preventDefault() {}, stopPropagation() {} };
  (LISTENERS.click || []).forEach(fn => fn(ev));
};

// 最後に出た知らせ（トースト）の「元に戻す」を押す
ctx.__undo = function () {
  for (let i = LAST_CREATED.length - 1; i >= 0; i--) {
    const u = LAST_CREATED[i]._undo;
    if (u && u._on && u._on.click) { u._on.click({}); return true; }
  }
  return false;
};

const out = vm.runInContext(fs.readFileSync(probePath, "utf8"), ctx);
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(storePath, JSON.stringify(store));
