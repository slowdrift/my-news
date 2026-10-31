// マイニュース 表示スクリプト
// data.js（build_news.py が生成し window.NEWS_DATA に入る）を、
// カテゴリ → テーマ(group) → 記事 の順に描画する。
//
// 既読管理：一度開いた記事は既定で一覧から消える（読むほどスクロールが短くなる）。
// 「既読も表示」に切り替えれば読み返せる。設定はこの端末のブラウザにだけ保存される。

"use strict";

const APP = document.getElementById("app");

// 画面最下部に出す版と更新履歴。改修のたびにここへ1行足す。
const APP_VERSION = "v1.49.0";
const CHANGELOG = [
  ["v1.49.0", "2026-10-31", "HP が片づけたときと長く読んだときにも減るようにした（開かずに既読にすると1本で1、1日30まで。記事から戻るまで1分ごとに1、開いたときの3と合わせて1本で10まで。30分以上たって戻ったら3だけ）。経験値は変えていない"],
  ["v1.48.0", "2026-10-31", "レベルが上がるとホイミのリストに項目が増えるようにした（Lv3 から3レベルごとに2つ、全部で17個。資料で確かめて選んだ）。増えた項目は5つ目として、場所や体調にあまりとらわれずに出す（4つ目の職場向けは今までどおり）。増えた日は5つ目に先に出して「新しく増えた」の札を付ける。「元に戻す」でレベルが下がったときは、増えた項目もいったん消え、もう一度上がるとまた知らせる"],
  ["v1.47.0", "2026-10-31", "ホイミに HP と経験値・レベルを足した（記事を開くと HP−3・ホイミで＋15、日付が変わると100に戻る。読む・見終える・ホイミで経験値。レベルは下がらない）。一覧は行を押すと［できた］が出る形にし、押し間違いで記録されないようにした。全部の項目に一言の説明を付け、職場向けの13個を4つ目として足した。ふり返りを棒グラフにし、［できた］のあとの言葉を10通りにした。「元に戻す」を5秒から15秒にした"],
  ["v1.46.0", "2026-10-30", "ホイミを1日に何回でもできるようにした。「今日の新着」の上の1行を押すとホイミの画面に移り、今の3つ・ふり返り（今日・この7日・今月の回数、今月使った種類、月ごとの回数、よく使う5つ）・70個の一覧（最後にやった日つき。押すとそのまま記録）が並ぶ。［できた］のあとは、今日まだやっていない項目から次の3つを出す"],
  ["v1.45.1", "2026-10-30", "ホイミを新着が残っていても出すようにした（「今日の新着」の上の1行を押すと3つ開く）。画面の「きょう」を「今日」に直した"],
  ["v1.45.0", "2026-10-29", "新着をすべて確認すると、その下に「ホイミ」（1〜2分でできるひと休み）を3つ出すようにした（体・息と五感・頭と心から1つずつ。項目は70個）。できたものの［できた］で記録し、設定でこの7日にできた日数を見られる。あわせて、新着を見終えるまでの時間をこの端末に記録し、設定で直近7日と平均を見られるようにした。見終えたときの文は「新着はすべて確認しました」に改めた"],
  ["v1.44.1", "2026-10-24", "ウォッチ銘柄の詳細の表で、となりの期間と同じ安値・高値はマスをつなげて1回だけ書くようにした（10年の高値を最近1年で付けた銘柄では、1〜10年の高値に同じ数字が4回並んでいた）。右の縦線の長さが、同じ値の期間を示す"],
  ["v1.44.0", "2026-10-24", "ウォッチ銘柄を表にした（銘柄・株価・利回り・位置の4列）。見出しを押すと並べ替えられ、選んだ並びは覚えておく（元の順・前日比・いまの利回り・利回りが10年で高い順・期間内で安い順）。期間内の位置は「安値圏（緑）・なかほど・高値圏（橙）」の言葉と色、「高値から -○%」で示す。詳細の中の利回りの10年も同じ色の意味にそろえ、配当の内訳と1年ごとの配当を表にした。天気の下の株価は、先頭の3銘柄の代わりに「利回りが10年で高い」高配当の3銘柄を出す（配当が前の年より減った銘柄には「配当↓」、3割以上増えた銘柄には「＊」）"],
  ["v1.43.0", "2026-10-24", "書庫はいつも1行に畳んだ状態で始まるようにした（新着のあるテーマを添える。開いても、1時間以上あけて開き直すとまた畳んだ状態に）。発掘は1週間分で開き、表示中の分を「全部片づけ」でまとめて片づけられる（戻せる）。件数の少ない5テーマ（自治体の生成AI活用・実教出版・グロービス・テレビ情報・Amazonのセール）は、朝刊で「そのほか」の1行にまとめた。グロービスに混ざっていた別の会社（現代グロービス）とホールの記事を外した"],
  ["v1.42.0", "2026-10-22", "朝刊に「ほかの分野から」を足した。自分のテーマの外から、はてなブックマークの分野別の人気記事を1日3本（分野は日替わり・各分野の1位）。有料・会員限定の判定が、メニューや隠れた文字に反応して無料の記事（はてなブログなど）に札を付けていたのを直した"],
  ["v1.41.0", "2026-10-17", "アクアワールド大洗から遠足の記事を外した。YouTube 以外の動画サイト（TVer など）の記事は、各テーマの後ろへ回す（消さない）"],
  ["v1.40.0", "2026-10-14", "ウォッチ銘柄の詳細に、いまの利回りが10年の中でどのあたりかと、1年ごとの配当（減った年・特別配当らしい年）を表示。三井住友FG の分割の日の配当のずれと、Yahoo の過去の配当の誤り（10件）を直した"],
  ["v1.39.0", "2026-10-13", "ウォッチ銘柄の見出しの［ⓘ 見方］で、表の数字・棒・印・札の意味を開けるように（ふだんは畳んだまま）"],
  ["v1.38.0", "2026-10-13", "ウォッチ銘柄を押すと詳しい数字が開くように（1・3・5・10年の高値・安値と付けた年月、過去1年の配当の内訳と利回りの計算、Yahoo!ファイナンス・IR BANK への入口）。役割の札は、開いた中で替える"],
  ["v1.37.0", "2026-10-13", "朝刊の見出しの［↕ 並べ替え］で、行の順番を自由に入れ替えられるように（この端末だけ）。ウォッチ銘柄のニュースの一番上の固定をやめた（最初の位置は一番上のまま）"],
  ["v1.36.0", "2026-10-13", "ウォッチ銘柄の高値・安値の期間を、表の上で1年・3年・5年・10年に切り替えられるように（全銘柄いっしょ。開いたときは1年）"],
  ["v1.35.0", "2026-10-12", "同じ出来事の記事を、言い回しが違っても1枚にまとめやすく（大きな出来事・同じ会社の決算）。ウォッチ銘柄のニュースは買い物情報・レビュー・掲示板などを朝刊に出さない（書庫には残る）。生成AIの使いこなしの古い記事を発掘に出さない"],
  ["v1.34.0", "2026-10-11", "新着で「地元」「海外ニュース」もそれぞれ1行にまとめ、アクアワールド大洗とアーミル・カーンを行の先頭に。アーミル・カーンは海外ニュースのカテゴリへ"],
  ["v1.33.0", "2026-10-09", "ウォッチ銘柄に、いまの株価での配当利回りと1年の高値・安値の中の位置を表示。持っている銘柄を上に分け、高配当・長期保有・優待の札を付けられるように（この端末だけ）"],
  ["v1.32.0", "2026-10-09", "新着で「動画」「人物・作品」をそれぞれ1行にまとめた（開くとテーマ名で区切る）。新着画面の並びを朝刊とそろえた"],
  ["v1.31.0", "2026-10-08", "保有株の CSV を読み込み、含み損益と取得利回りを表示（この端末だけ）。ウォッチ銘柄を増やして会社のニュースを朝刊の先頭に。前日比の誤りを修正。👎は発信元の回数を数えず、設定に発信元ごとの読み方を表示"],
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
let MORNING_ARRANGE = false;   // 朝刊の行を並べ替えているところか（画面を見ている間だけ）
// ホイミの画面を見ているか（v1.46.0）。ほかの画面と同じく端末には覚えさせない。
// 戻ったときに元の位置へ戻れるよう、開いたときの位置を覚えておく
let SHOW_HOIMI = false;
let HOIMI_BACK_Y = 0;
// 一覧で［できた］を出している行の番号（v1.47.0）。押しただけでは記録せず、行の中に［できた］を出す。
// スクロールのつもりで触れて記録されてしまうことがあったため（CODE_TASK_11 ①）
let HOIMI_PICKED = "";
let SHOW_READ = false;     // 読んだ記事の一覧を見ているか
// 「きょうの新着だけ」を見る画面。ボタンを増やさず、見出しの数字を入口にする。
// 一時的な見方なので端末には覚えさせない（次に開いたときは通常表示に戻る）。
let SHOW_FRESH = false;
let SHOW_FOUND = false;   // 掘り出した古い記事だけの画面
let FOUND_TODAY = false;  // その画面で「きょう」に絞るか（開いたときは1週間分。CODE_TASK_08 ②）
// ウォッチ銘柄の高値・安値の期間（"1"・"3"・"5"・"10" 年。全銘柄いっしょに替わる。CODE_TASK_05 ③）。
// 端末には覚えさせない＝開くたびに1年から（利用者の決定 2026-10-13）
let STOCK_SPAN = "1";
// 詳細を開いているウォッチ銘柄（銘柄コード。CODE_TASK_05 ④）。期間と同じく端末には覚えさせない
let STOCK_OPEN = new Set();
// ウォッチ銘柄の「見方」（凡例）を開いているか（CODE_TASK_05 ⑤）。毎朝じゃまにならないよう、端末には覚えさせない
let STOCK_LEGEND = false;
// ウォッチ銘柄の表の並び（CODE_TASK_08 ⑤）。表の見出しを押して替え、指示書どおり端末に覚える
// （期間と違い、毎回同じ並びで見たいもののため）。"" は元の順（feeds.json の順）
const STOCK_SORT_KEY = "mynews_stock_sort";
const STOCK_SORT_LABEL = {
  "": "元の順", up: "前日比の上げ順", down: "前日比の下げ順",
  yield: "いまの利回りの高い順", dy: "利回りが10年で高い順", low: "期間内で安い順",
};
let STOCK_SORT = (function () {
  const v = lsGet(STOCK_SORT_KEY, "");
  return Object.prototype.hasOwnProperty.call(STOCK_SORT_LABEL, v) ? v : "";
})();
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
const ORDER_KEY = "mynews_order";      // { テーマ名: 並び順の数字 }（書庫の並び。カテゴリの中だけ）
// { 朝刊の行の目印: 並び順の数字 }。目印はテーマ名、まとめた行は "cat:カテゴリ名"（v1.37.0）、
// カテゴリをまたいでまとめた行は "row:行の名前"（そのほか。v1.43.0）
const MORNING_ORDER_KEY = "mynews_morning_order";
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
let MORNING_ORDER = loadTally(MORNING_ORDER_KEY);   // 朝刊の行の並び（書庫の ORDER とは別）
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
  // ほかの分野から（pick_day の印）は、配信が古くても「その日に選んだ記事」なので朝刊に出す（v1.42.0）。
  // 古いページがいま多くの人に読まれている、ということがあるため
  if (a.pick_day) return false;
  if (!a.dt) return false;
  const t = new Date(a.dt).getTime();
  if (isNaN(t)) return false;
  return t < Date.now() - NEW_MAX_AGE_DAYS * 86400000;
}

// 朝刊（新着）に出さない記事の印（aside）。ウォッチ銘柄のニュースの買い物情報・掲示板・
// 製品紹介など（feeds.json の aside で決め、build_news.py が付ける）。書庫には残る。CODE_TASK_06 ②

// 前回見てから届いた未読の記事（古い記事の発掘は含めない）
function isSinceLast(a) {
  // 1日の上限を超えて「新着」と名乗らない分（quiet）は、ここでも数えない
  if (!SINCE_LAST || isRead(a) || a.quiet || a.aside) return false;
  if (HIDE_LOCKED && isLocked(a)) return false;
  if (isOldArticle(a)) return false;
  const t = new Date(a.first_seen || "").getTime();
  return !isNaN(t) && t > SINCE_LAST;
}

// 初めて入ってきたのが最近で、記事そのものは古いもの＝「発掘」
function isFound(a) {
  // nofound … 古い記事を発掘に出さないテーマ（feeds.json の no_found。生成AIの使いこなし。CODE_TASK_06 ③）
  if (isRead(a) || a.quiet || a.aside || a.nofound) return false;
  if (HIDE_LOCKED && isLocked(a)) return false;
  return arrivedWithin(a, NEW_DAYS * 86400000) && isOldArticle(a);
}

// そのうち、きょう届いた分だけ
function isFoundToday(a) {
  return isFound(a) && arrivedWithin(a, FRESH_HOURS * 3600000);
}

function isFresh(a) {
  if (isRead(a) || a.quiet || a.aside) return false;   // 1日の上限を超えた分・朝刊に出さない分は騒がない
  if (HIDE_LOCKED && isLocked(a)) return false;
  if (isOldArticle(a)) return false;   // 掘り出した古い記事は「発掘」で数える
  return arrivedWithin(a, FRESH_HOURS * 3600000);
}

function isNew(a) {
  if (isRead(a) || a.quiet || a.aside) return false;   // 1日の上限を超えた分・朝刊に出さない分は騒がない
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
    // ほかの分野から：どの分野の人気記事から選んだか（世の中・学び など。v1.42.0）
    + (a.field ? '<span class="field" title="はてなブックマークの分野">' + esc(a.field) + "</span>" : "")
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

// 書庫の並べ替えの操作盤。カテゴリの中だけで上下に動かす
// （カテゴリをまたぐと「地元」の中に仕事の記事が現れて分かりにくくなるため）。
// 朝刊の行の並びは、朝刊の見出しの［↕ 並べ替え］で別に決める（v1.37.0）。
function orderRow() {
  let h = '<div class="srow"><span>書庫のテーマの並べ替え</span>'
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
  h += '<p>書庫で、よく読むテーマを上へ。順番はこの端末に覚えます。'
    + "朝刊の行の順番は、朝刊の見出しの［↕ 並べ替え］で変えます。</p>"
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
// 押すと最下部のウォッチ銘柄ブロックへ飛ぶ。自動で横に流れる表示はしない。
// 保有株を読み込んだ端末では「含み損益と取得利回りの合計」の行を出し、その下に3銘柄を添える。
// 3銘柄は「利回りが10年で高い順」（CODE_TASK_08 ⑦。以前は feeds.json の先頭3銘柄で、選んだ意味が無かった）
const STRIP_MAX = 3;   // 天気の下に並べる銘柄の数
// 3銘柄の選び方：役割が高配当（この端末の札）で配当の記録がある銘柄を、
// いまの利回りが10年の中で高い順（＝配当に比べて株価が安い順）に並べる。
// 利回りの10年が無い銘柄は、指示書どおり表の上で選んでいる期間の中の株価の位置（安い順）で比べるが、
// 2つの物差しを1つの順位に混ぜないよう、利回りの10年がある銘柄の後ろに回す（2026-10-24 の公開版では該当なし）
function stripPicks(list) {
  const cand = (list || []).filter(function (s) {
    return roleOf(String(s.code || "").replace(/\.T$/, "")) === "div" && nowYield(s) != null;
  });
  const byDy = cand.filter(function (s) { return dyPosRaw(s) != null; })
    .sort(function (a, b) { return dyPosRaw(b) - dyPosRaw(a); });
  const byPrice = cand.filter(function (s) { return dyPosRaw(s) == null && spanPosRaw(s) != null; })
    .sort(function (a, b) { return spanPosRaw(a) - spanPosRaw(b); });
  return byDy.concat(byPrice).slice(0, STRIP_MAX);
}
// 過去1年の配当の印（詳細の「1年ごとの配当」と同じ決め方）。
// down＝前の年より減った（年の区切りが決算の年とずれるので、本当は減っていなくても出ることがある）、
// bump＝前の年より3割以上多い（特別配当・記念配当なら、いまの利回りは高めに出ている）
function divFlags(s) {
  const ys = s.dyears || [];
  if (ys.length < 2) return { down: false, bump: false };
  const last = ys[ys.length - 1][1], before = ys[ys.length - 2][1];
  return { down: before != null && last < before * DIV_DOWN, bump: before > 0 && last > DIV_BUMP * before };
}
function stockStrip(list) {
  const rows = holdingRows();
  let h = "";
  if (rows.length) {
    const t = holdingTotals(rows);
    // 長期保有・優待の札を付けた銘柄があれば、高配当だけの取得利回りを出す（札が無ければ全体と同じ）
    const y = t.nOther ? t.yieldPctH : t.yieldPct;
    h += '<span class="wrow"><span class="wst"><b>💼 含み損益</b>'
      + fmtYen(t.pl, true) + '<i class="' + signCls(t.pl) + '">' + fmtPct(t.plPct, true) + "</i></span>"
      + (y != null ? '<span class="wst"><b>取得利回り' + (t.nOther ? "（高配当）" : "") + "</b>" + fmtPct(y) + "</span>" : "")
      + "</span>";
  }
  const picks = stripPicks(list);
  if (picks.length) {
    // 選んだ理由は前に1つだけ書く。全部が10年の中で上3分の1なら「高め」、そうでなければ並べた順だけを言う。
    // 利回りの10年が無く株価の位置で選んだ銘柄には、その銘柄に理由（「1年の安値圏」など）を添える
    const nDy = picks.filter(function (s) { return dyPosRaw(s) != null; }).length;
    const high = nDy === picks.length && picks.every(function (s) { return dyPosRaw(s) > 200 / 3; });
    const label = high ? "利回りが10年で高め" : nDy ? "利回りが10年で高い順" : "株価が期間内で安い順";
    h += '<span class="wrow"><span class="wlb' + (high ? " z-lo" : "") + '">' + label + "</span>"
      + picks.map(function (s) {
        const f = divFlags(s);
        let why = "";
        if (dyPosRaw(s) == null) {
          const z = zoneOf(Math.max(0, Math.min(100, spanPosRaw(s) * 100)));
          why = '<i class="z-' + z + '">' + STOCK_SPAN + "年の" + ZONE_LABEL[z] + "</i>";
        }
        return '<span class="wst"><b>' + esc(s.name) + "</b>" + Number(s.price).toLocaleString("ja-JP") + why
          + (f.down ? '<i class="down" title="過去1年の配当が前の年より減った">配当↓</i>' : "")
          + (f.bump ? '<i title="過去1年の配当が前の年より3割以上多い（特別配当なら、利回りは高めに出ている）">＊</i>' : "")
          + "</span>";
      }).join("") + "</span>";
  }
  return h ? '<a class="wstocks" href="#stocks">' + h + "</a>" : "";
}

// 保有している銘柄の行の下に添える1行（株数・取得単価・取得利回り・含み損益。この端末だけ）。
// 表の列は全銘柄で同じ4つにそろえ、保有の数字はここにまとめる（CODE_TASK_08 ⑤）
function holdLine(r) {
  return "<span>" + fmtNum(r.qty) + "株・取得 " + fmtNum(r.cost) + "円</span>"
    + (r.yieldPct != null ? "<span>取得利回り <b>" + fmtPct(r.yieldPct) + "</b></span>" : "")
    + (r.pl != null ? '<span class="' + signCls(r.pl) + '">' + fmtYen(r.pl, true)
      + "（" + fmtPct(r.plPct, true) + "）</span>" : "");
}

// 選んだ期間（1・3・5・10年）の値動きの中で、いまどのあたりか（CODE_TASK_04 ②、期間は CODE_TASK_05 ③）。
// 安値・高値の数字と、その間の点で示す。
// 29銘柄を見比べるので、棒の幅はそろえる（点の位置だけを目で比べられるように）。
// 選んだ期間の分の値動きがそろわない銘柄（上場して間もない等）は「○か月分」「○年分」と添える。
const RANGE_FULL_DAYS = 230;   // これより日足が少なければ「1年分そろっていない」とみなす（1年は約245営業日）
const SPAN_LIST = ["1", "3", "5", "10"];
// 期間の高値・安値（y を省くと、表の上で選んでいる期間）。
// 1年は data.js の hi・lo・days・hi_at・lo_at、3・5・10年は span（build_news.py が10年分の日足から出す）
function spanOf(s, y) {
  y = y || STOCK_SPAN;
  if (y === "1") {
    if (typeof s.hi !== "number" || typeof s.lo !== "number") return null;
    const short = s.days && s.days < RANGE_FULL_DAYS;
    return { hi: s.hi, lo: s.lo, hiAt: s.hi_at, loAt: s.lo_at,
      short: short ? Math.max(1, Math.round(s.days / 20.5)) + "か月分" : "" };
  }
  const v = s.span && s.span[y];
  if (!v || typeof v.hi !== "number" || typeof v.lo !== "number") return null;
  // 期間より半年以上短ければ「○年分」（1年に満たなければ「○か月分」）
  const short = v.yrs < Number(y) - 0.5;
  return { hi: v.hi, lo: v.lo, hiAt: v.hi_at, loAt: v.lo_at,
    short: !short ? "" : v.yrs >= 1 ? v.yrs.toFixed(1) + "年分" : Math.max(1, Math.round(v.yrs * 12)) + "か月分" };
}
// 安値〜高値の中のいまの位置（0〜100%）
function spanPos(s, r) {
  return Math.max(0, Math.min(100, (Number(s.price) - r.lo) / (r.hi - r.lo) * 100));
}
// 表の上で選んでいる期間の中の位置（0〜1）。並べ替え・天気の下の3銘柄で使うので、
// 安値を割った・高値を超えた分も比べられるよう、端で切らない。数字が無ければ null
function spanPosRaw(s) {
  const r = spanOf(s);
  return r && r.hi > r.lo ? (Number(s.price) - r.lo) / (r.hi - r.lo) : null;
}
function fmtYm(ym) { return ym ? ym.replace(/^(\d{4})-0?(\d+)$/, "$1年$2月") : ""; }

// 期間の中のいまの位置を3つに分けた区分（CODE_TASK_08 ⑥）。下3分の1が安値圏、上3分の1が高値圏。
// 色は「安い側＝緑」「高い側＝橙」の2つだけで、株価の位置と利回りの位置の両方に同じ意味で使う
// （株価は低いほど安い側、利回りは高いほど株価が安い側で、向きが逆。取り違えないよう色でそろえる）。
// 前日比の赤・青（上げ・下げ）と混ざらないよう、緑と橙にした（利用者の決定 2026-10-24）
const ZONE_LABEL = { lo: "安値圏", mid: "なかほど", hi: "高値圏" };
function zoneOf(pos) { return pos < 100 / 3 ? "lo" : pos > 200 / 3 ? "hi" : "mid"; }
// 高値からの下がり幅。安値圏でも同じ書き方にそろえ、列を縦に見比べられるようにする（利用者の決定 2026-10-24）
function fromHigh(price, hi) {
  const d = Math.round((price / hi - 1) * 100);
  return d < 0 ? "高値から -" + Math.abs(d) + "%" : "高値と同じ水準";
}
// 表の4列目：選んだ期間（1・3・5・10年）の中のいまの位置。棒と区分の言葉、下に高値からの下がり幅。
// 棒の幅は全行でそろえる（点の位置だけを目で比べられるように）。安値・高値の数字と年月は詳細の表で見る
function posCell(s) {
  const r = spanOf(s);
  if (!r || !(r.hi > r.lo)) return "<small>—</small>";
  const pos = spanPos(s, r), z = zoneOf(pos);
  // マウスを乗せると出る説明（スマホでは出ない見込み）
  const tip = STOCK_SPAN + "年の安値 " + fmtNum(r.lo) + (r.loAt ? "（" + fmtYm(r.loAt) + "）" : "")
    + "から高値 " + fmtNum(r.hi) + (r.hiAt ? "（" + fmtYm(r.hiAt) + "）" : "")
    + "までの、いまの位置（下から" + Math.round(pos) + "%）";
  return '<span class="spos" title="' + esc(tip) + '">'
    + '<span class="srange"><i class="z-' + z + '" style="left:' + pos.toFixed(1) + '%"></i></span>'
    + '<b class="z-' + z + '">' + ZONE_LABEL[z] + "</b></span>"
    + "<small>" + fromHigh(Number(s.price), r.hi) + (r.short ? "（" + r.short + "）" : "") + "</small>";
}

// 表の上の期間の切り替え（全銘柄いっしょに替わる。利用者の決定 2026-10-13）。
// 3年以上の数字がどの銘柄にも無いとき（10年分が取れず1年分で取り直したとき）は出さない
function spanSwitch(list) {
  if (!(list || []).some(function (s) { return s.span; })) return "";
  return '<div class="sspan">高値・安値の期間' + SPAN_LIST.map(function (y) {
    const on = STOCK_SPAN === y;
    return '<button class="tool-btn' + (on ? " on" : "") + '" type="button" data-stock-span="' + y + '"'
      + ' aria-pressed="' + on + '">' + y + "年</button>";
  }).join("") + "</div>";
}

// いまの利回り＝過去1年の1株配当÷いまの株価（配当の記録が無ければ null）
function nowYield(s) {
  return s && typeof s.div === "number" && s.price ? s.div / Number(s.price) * 100 : null;
}
// いまの利回りが「利回りの10年」の幅のどこか（0〜100%）。並べ替え・天気の下の3銘柄で使うので、
// 10年の最高を超えた分も比べられるよう、端で切らない
function dyPosRaw(s) {
  const now = nowYield(s), dy = s && s.dy;
  if (now == null || !dy || !(dy.hi > dy.lo)) return null;
  return (now - dy.lo) / (dy.hi - dy.lo) * 100;
}
// 表の3列目：いまの利回りと、下に配当の額（割合は必ず額と並べる＝利用者の指示）。
// 配当の記録が無い銘柄は「記録なし」（無配か取れなかったか見分けられないため、0% とは書かない）。
// 長期保有・優待の札の銘柄は、高配当の物差しではないので控えめな色にする（CSS の .muted）
function yieldCell(s) {
  const y = nowYield(s);
  if (y == null) return "<b>—</b><small>記録なし</small>";
  return "<b>" + fmtPct(y) + "</b><small>" + fmtNum(s.div) + "円</small>";
}

// 役割の札。行には見せるだけ（押しても替わらない）。
// 替えるのは詳細の中の札で、押すたびに 高配当→長期保有→優待→高配当 と替わる（この端末だけに覚える）。
// 以前は行の札を押して替えていたが、行を押すと詳細が開くようにしたので、押し間違えないよう詳細の中へ移した
// （CODE_TASK_05 ④、利用者の決定 2026-10-13）
function roleTag(role) {
  return '<span class="srole r-' + role + '">' + ROLE_LABEL[role] + "</span>";
}
function roleChip(code) {
  const role = roleOf(code);
  return '<button class="srole r-' + role + '" type="button" data-role="' + esc(code) + '"'
    + ' title="押すと役割が替わります（高配当→長期保有→優待）">' + ROLE_LABEL[role] + "</button>";
}

// 外部の銘柄ページ（CODE_TASK_05 ④）。どちらも 2026-10-13 にウォッチ銘柄29社すべてで、その銘柄のページが開くことを確かめた。
// IR BANK は「/コード/dividend」で開くと、会社ごとの住所（/E03614/dividend など）へ自動で移る
const STOCK_LINKS = [
  { name: "Yahoo!ファイナンス", what: "株価・チャート", url: function (c) { return "https://finance.yahoo.co.jp/quote/" + c + ".T"; } },
  { name: "IR BANK", what: "配当の推移", url: function (c) { return "https://irbank.net/" + c + "/dividend"; } },
];

// 1・3・5・10年の高値・安値と付けた年月、いまの位置の表。表の上で選んでいる期間の行を目立たせる。
// 10年分が取れなかった銘柄（span が無い）は1年だけ
function spanTable(s) {
  const list = SPAN_LIST.map(function (y) { return { y: y, r: spanOf(s, y) }; })
    .filter(function (o) { return o.r && o.r.hi > o.r.lo; });
  if (!list.length) return "";
  // 隣り合う期間で値と年月が同じなら、マスを下へつなげて（rowspan）数字を1回だけ書く。
  // 10年の高値を最近1年で付けた銘柄は、1〜10年の高値に同じ数字が4回並んでいた（利用者の指摘 2026-10-24。安値も同じ扱い）。
  // 返すのは期間ごとのマスの HTML で、上のマスにつながれた期間は null
  const joined = function (key, atKey) {
    const out = [];
    for (let i = 0; i < list.length; ) {
      let n = 1;
      while (i + n < list.length && list[i + n].r[key] === list[i].r[key]
        && list[i + n].r[atKey] === list[i].r[atKey]) n++;
      // つないだマスは最初の期間の行にあるので、選んでいる期間を含むなら印（on）を付けて太字にする
      const on = list.slice(i, i + n).some(function (o) { return o.y === STOCK_SPAN; });
      const at = list[i].r[atKey];
      out.push("<td" + (n > 1 ? ' rowspan="' + n + '" class="join' + (on ? " on" : "") + '"' : "") + ">"
        + fmtNum(list[i].r[key]) + (at ? "<small>" + fmtYm(at) + "</small>" : "") + "</td>");
      for (let k = 1; k < n; k++) out.push(null);
      i += n;
    }
    return out;
  };
  const lo = joined("lo", "loAt"), hi = joined("hi", "hiAt");
  const rows = list.map(function (o, i) {
    const r = o.r, pos = spanPos(s, r), z = zoneOf(pos);
    return "<tr" + (o.y === STOCK_SPAN ? ' class="on"' : "") + "><td>" + o.y + "年"
      + (r.short ? "<small>" + r.short + "</small>" : "") + "</td>"
      + (lo[i] || "") + (hi[i] || "")
      + '<td><span class="z-' + z + '">' + ZONE_LABEL[z] + "</span><small>下から" + Math.round(pos) + "%</small></td></tr>";
  }).join("");
  return '<table class="sdtab"><thead><tr><th>期間</th><th>安値</th><th>高値</th><th>いまの位置</th></tr></thead>'
    + "<tbody>" + rows + "</tbody></table>";
}

// 配当の元の数字：過去1年の1回ずつの額（権利落ち日）と、利回りの計算そのもの
function divDetail(s, r) {
  if (!s) return '<div class="sddiv">ウォッチ銘柄に無いので、株価の推移と配当は取っていません（CSV の現在値で計算）</div>';
  if (typeof s.div !== "number") {
    return '<div class="sddiv">過去1年の配当の記録はありません（無配か、取れなかったかは見分けられません）</div>';
  }
  const price = Number(s.price);
  const list = s.divs && s.divs.length;
  let h = '<div class="sddiv"><div class="sdh">過去1年の配当</div>';
  if (list) {
    // 1回ずつの額を小さな表に（CODE_TASK_08 ⑤：数字が並ぶところは表の形にそろえる）。
    // 3つ目は、Yahoo の記録を直した回の元の額（分割の日の額のずれ・会社の発表との食い違い。build_news.py の dividend_events）
    h += '<table class="sdtab sdmini"><thead><tr><th>権利落ち日</th><th>1株配当</th></tr></thead><tbody>'
      + s.divs.map(function (d) {
        return "<tr><td>" + esc(String(d[0]).replace(/^(\d{4})-0?(\d+)-0?(\d+)$/, "$1/$2/$3")) + "</td><td>"
          + fmtNum(d[1]) + "円" + (d[2] != null ? "<small>Yahoo の記録は " + fmtNum(d[2]) + "円。直した</small>" : "")
          + "</td></tr>";
      }).join("") + "</tbody></table>";
  }
  h += "<div>合計 " + fmtNum(s.div) + "円 ÷ いまの株価 " + fmtNum(price) + "円 ＝ いまの利回り <b>"
    + fmtPct(s.div / price * 100) + "</b></div>";
  if (r && r.yieldPct != null) {
    h += "<div>合計 " + fmtNum(s.div) + "円 ÷ 取得単価 " + fmtNum(r.cost) + "円 ＝ 取得利回り <b>"
      + fmtPct(r.yieldPct) + "</b></div>";
  }
  return h + "</div>";
}

// 10年の中の、いまの利回りの水準と、1年ごとの配当（CODE_TASK_05 ⑥）。
// 高配当株の買い時は、株価そのものより「いまの利回りが過去と比べて高いか」で見るほうが目的に合う
// （配当を増やしてきた銘柄は、株価が10年の高値でも配当に比べて割安なことがある。逆に減配していれば、安いのには理由がある）。
// 利回りは棒にせず言葉で示す（株価の棒は右ほど割高、利回りは右ほど割安で、並べると向きを取り違えやすいため）
const DIV_DOWN = 0.98;   // 前の年の98%未満を「減った」とする（分割で割り戻した額の端数で減って見えないように）
const DIV_BUMP = 1.3;    // 前後の年より3割以上多い年を「特別配当・記念配当かもしれない」とする（推測）
function yieldHistory(s) {
  const dy = s.dy, ys = s.dyears || [];
  if (!dy && ys.length < 2) return "";
  let h = '<div class="sdyld">';
  if (dy) {
    const now = nowYield(s);
    h += '<div class="sdh">利回りの10年<small>（毎月末の株価と、その月までの1年の配当から'
      + (dy.yrs < 9.5 ? "。" + dy.yrs.toFixed(1) + "年分" : "") + "）</small></div>"
      + "<div>最低 " + fmtPct(dy.lo) + "（" + fmtYm(dy.lo_at) + "）／最高 " + fmtPct(dy.hi) + "（" + fmtYm(dy.hi_at) + "）</div>";
    if (now == null) {
      h += "<div>いまは過去1年の配当の記録がありません</div>";
    } else if (dy.hi > dy.lo) {
      const pos = Math.max(0, Math.min(100, (now - dy.lo) / (dy.hi - dy.lo) * 100));
      // 色は株価の位置と同じ意味にそろえる（利回りが高いほう＝株価が安い側＝緑。CODE_TASK_08 ⑥）
      const where = pos < 100 / 3 ? ["低いほう", "＝配当に比べて株価が高め", "hi"]
        : pos > 200 / 3 ? ["高いほう", "＝配当に比べて株価が安め", "lo"] : ["なかほど", "", "mid"];
      h += "<div>いま <b>" + fmtPct(now) + "</b>：10年の中で" + '<b class="z-' + where[2] + '">' + where[0] + "</b>"
        + "（下から" + Math.round(pos) + "%）" + where[1] + "</div>";
    }
    if (dy.hi_bump) h += '<div class="sdnote">最高のときは、1年の配当がその前後の年より3割以上多い（特別配当・記念配当かもしれない）</div>';
    if (dy.zero) h += '<div class="sdnote">配当の記録が無い月（' + dy.zero + "か月）は除いた</div>";
  }
  if (ys.length >= 2) {
    const m = Number(String(ys[ys.length - 1][0]).slice(5, 7));
    const span = m === 12 ? "その年の1月〜12月" : "前の年の" + (m + 1) + "月〜その年の" + m + "月";
    const downs = [], bumps = [];
    // 1年1行の表（年・配当・前の年との差）。以前は横に並べていたが、数字を縦にそろえて見比べられるようにした（CODE_TASK_08 ⑤）
    const items = ys.map(function (y, i) {
      const v = y[1], prev = i > 0 ? ys[i - 1][1] : null, next = i < ys.length - 1 ? ys[i + 1][1] : null;
      const down = prev != null && v < prev * DIV_DOWN;
      // 前後の年のどちらかが0（無配・記録なし）のときは「再開」や「無配の前」なので、特別配当らしいとは言わない
      const bump = prev > 0 && next > 0 && v > DIV_BUMP * Math.max(prev, next);
      const year = String(y[0]).slice(0, 4);
      if (down) downs.push(year + "（" + fmtNum(prev) + "→" + fmtNum(v) + "円）");
      if (bump) bumps.push(year + "（" + fmtNum(v) + "円）");
      const diff = prev == null ? "" : v === prev ? "±0" : (v > prev ? "+" : "-") + fmtNum(Math.abs(v - prev));
      return '<tr class="' + (down ? "dn" : bump ? "bp" : "") + '"><td>' + year + (i === ys.length - 1 ? "<small>過去1年</small>" : "")
        + "</td><td><b>" + fmtNum(v) + "</b>" + (down ? "↓" : bump ? "＊" : "") + "</td><td>" + diff + "</td></tr>";
    });
    h += '<div class="sdh">1年ごとの配当<small>（' + span + "）</small></div>"
      + '<table class="sdtab sdmini"><thead><tr><th>年</th><th>1株配当（円）</th><th>前の年との差</th></tr></thead><tbody>'
      + items.join("") + "</tbody></table>"
      + "<div>前の年より減った年：" + (downs.length ? '<span class="dn">' + downs.join("、") + "</span>" : "なし") + "</div>";
    if (bumps.length) h += "<div>前後の年より3割以上多い年：" + bumps.join("、") + "（＊。特別配当・記念配当かもしれない）</div>";
    const last = ys[ys.length - 1][1], before = ys[ys.length - 2][1];
    if (before > 0 && last > DIV_BUMP * before) {
      h += '<div class="sdnote">過去1年は前の年より' + Math.round((last / before - 1) * 100)
        + "%多い。特別配当・記念配当なら、いまの利回りは高めに出ている</div>";
    }
    if (ys.some(function (y) { return !y[1]; })) h += '<div class="sdnote">0 は配当の記録なし（無配か、取れなかったかは見分けられない）</div>';
    h += '<div class="sdnote">年の区切りは今の月なので、会社の決算の年とはずれる。中間と期末の配分が変わっただけでも増減して見えることがある（決算の年ごとの配当は IR BANK で）'
      + (s.dfix ? "。Yahoo の配当の記録のうち " + s.dfix + "回分は直した（会社の発表と食い違う額、分割の日の額のずれ）" : "") + "</div>";
  }
  return h + "</div>";
}

// 銘柄を押すと開く詳細（CODE_TASK_05 ④）。行に収まらない、判断の裏付けになる数字と、外部の銘柄ページへの入口
function stockDetail(s, r, code) {
  return '<div class="sdetail">'
    + (s ? spanTable(s) : "")
    + divDetail(s, r)
    + (s ? yieldHistory(s) : "")
    + '<div class="sdrole">役割 ' + roleChip(code) + "<small>押すと 高配当→長期保有→優待 の順に替わります</small></div>"
    + '<div class="slinks">' + STOCK_LINKS.map(function (l) {
      return '<a href="' + esc(l.url(encodeURIComponent(code))) + '" target="_blank" rel="noopener">'
        + esc(l.name) + "<small>" + esc(l.what) + "</small></a>";
    }).join("") + "</div></div>";
}

// 表の1銘柄ぶん（CODE_TASK_08 ⑤）。1銘柄を1つの tbody にまとめ、
// 1行目＝銘柄（下に役割）・株価（下に前日比）・利回り（下に配当の額）・位置（下に高値からの下がり幅）、
// 保有していればその下に保有の1行、開いていればさらに下に詳細。
// 1行目・保有の行のどこを押しても詳細が開く（もう一度押すと閉じる）
function stockItem(s, r) {
  const code = s ? String(s.code || "").replace(/\.T$/, "") : r.code;
  const role = roleOf(code);
  const open = STOCK_OPEN.has(code);
  let price;
  if (s) {
    const up = s.diff > 0, down = s.diff < 0;
    price = "<b>" + Number(s.price).toLocaleString("ja-JP") + "</b>"
      + '<small class="' + (up ? "up" : down ? "down" : "") + '">' + (up ? "▲" : down ? "▼" : "―")
      + Math.abs(s.diff).toLocaleString("ja-JP") + " " + (up ? "+" : down ? "-" : "")
      + Math.abs(s.pct).toFixed(2) + "%</small>";
  } else {   // ウォッチ銘柄に無い保有株（CSV の現在値で計算）
    price = "<b>" + (r.price != null ? fmtNum(r.price) : "—") + "</b>"
      + "<small>CSV " + esc(shortDay(HOLD.asof)) + " 時点</small>";
  }
  const opener = ' data-stock-open="' + esc(code) + '"';
  return '<tbody class="sitem' + (r ? " held" : "") + (open ? " open" : "") + (role !== "div" ? " muted" : "") + '">'
    + '<tr class="shead" role="button" tabindex="0" aria-expanded="' + open + '"' + opener + ">"
    + '<td class="sn"><span class="sname"><i class="scaret">' + (open ? "▾" : "▸") + "</i>"
    + esc(s ? s.name : r.name) + "</span>" + roleTag(role) + "</td>"
    + '<td class="sp">' + price + "</td>"
    + '<td class="sy">' + (s ? yieldCell(s) : "") + "</td>"
    + '<td class="sz">' + (s ? posCell(s) : "") + "</td></tr>"
    + (r ? '<tr class="shold"' + opener + '><td colspan="4">' + holdLine(r) + "</td></tr>" : "")
    + (open ? '<tr class="sdrow"><td colspan="4">' + stockDetail(s, r, code) + "</td></tr>" : "")
    + "</tbody>";
}

// 表の並べ替え（CODE_TASK_08 ⑤）。「持っている」「気になる」のそれぞれの中で並べる。
// 値が無い銘柄（配当の記録なし・期間の数字なし）は後ろ。同じ値どうしは元の順（feeds.json の順）
function sortStocks(list) {
  if (!STOCK_SORT) return list;
  const val = function (s) {
    if (STOCK_SORT === "up" || STOCK_SORT === "down") return typeof s.pct === "number" ? (s.diff < 0 ? -1 : 1) * Math.abs(s.pct) : null;
    if (STOCK_SORT === "yield") return nowYield(s);
    if (STOCK_SORT === "dy") return dyPosRaw(s);
    return spanPosRaw(s);   // 期間内で安い順
  };
  const asc = STOCK_SORT === "down" || STOCK_SORT === "low";   // 下げの大きい順・安い順は小さい値から
  return list.map(function (s, i) { return { s: s, i: i, v: val(s) }; }).sort(function (a, b) {
    if (a.v == null || b.v == null) return (a.v == null) - (b.v == null) || a.i - b.i;
    return (asc ? a.v - b.v : b.v - a.v) || a.i - b.i;
  }).map(function (x) { return x.s; });
}

// 表の見出し。押すと並べ替える（銘柄＝元の順、株価＝前日比の上げ順⇄下げ順、
// 利回り＝いまの利回りの高い順⇄利回りが10年で高い順、位置＝期間内で安い順）。いまの並びの列は色を付ける
function sortHead(col, label) {
  const on = col === "name" ? STOCK_SORT === ""
    : col === "price" ? STOCK_SORT === "up" || STOCK_SORT === "down"
    : col === "yield" ? STOCK_SORT === "yield" || STOCK_SORT === "dy"
    : STOCK_SORT === "low";
  return '<th><button type="button" class="ssort-btn' + (on ? " on" : "") + '" data-stock-sort="' + col + '"'
    + ' aria-pressed="' + on + '">' + label + "</button></th>";
}

// 表の見方（凡例。CODE_TASK_05 ⑤）。左に実物と同じ見た目の見本、右に意味。
// 持っている銘柄に関わる行は、保有株を読み込んだ端末だけに出す（held）
function stockLegend(held) {
  const row = function (sample, text, cls) {
    return '<div class="slg-row"><div class="slg-s' + (cls ? " " + cls : "") + '">' + sample + "</div>"
      + '<div class="slg-t">' + text + "</div></div>";
  };
  // 表にしたので、見本と説明も表の列の順に並べ直した（CODE_TASK_08 ⑤⑥）
  return '<div class="slegend">'
    + row("［株価］など",
      "表の見出しを押すと並べ替え（この端末に覚える）。銘柄＝元の順、株価＝前日比の上げ順（もう一度で下げ順）、"
      + "利回り＝いまの利回りの高い順（もう一度で利回りが10年で高い順）、位置＝期間内で安い順。"
      + (held ? "「持っている」「気になる」のそれぞれの中で並ぶ" : "表の上にいまの並びを書いてある"))
    + row('<span class="sname"><i class="scaret">▸</i>名前</span>',
      "行を押すと下に詳細が開く（1〜10年の安値・高値と付けた年月、過去1年の配当の内訳、利回りの10年の幅、1年ごとの配当と減った年、外部の銘柄ページ、役割の切り替え）。もう一度押すと閉じる")
    + row(roleTag("div") + roleTag("long") + roleTag("perk"),
      "役割の札（この端末だけ）。行では見せるだけで、替えるのは詳細の中。長期保有・優待は利回りを控えめな色にし、合計の取得利回りの「高配当だけ」から外す")
    + row('<span class="up">▲</span><span class="down">▼</span>',
      "株価の下：前の取引日の終値からの上げ・下げと率（日本の慣習で上げが赤、下げが青）")
    + row("<b>○%</b>　○円", "利回りの列：いまの利回り＝配当÷いまの株価。下は過去1年に実際に支払われた1株配当の合計。「記録なし」は、無配か取れなかったかを見分けられない")
    + row('<span class="srange"><i class="z-lo" style="left:15%"></i></span><b class="z-lo">安値圏</b>',
      "位置の列：選んだ期間の安値〜高値の中で、いまの株価がどこにあるか（左端が安値、右端が高値）。"
      + '下3分の1が<b class="z-lo">安値圏</b>（緑）、上3分の1が<b class="z-hi">高値圏</b>（橙）、あいだが「なかほど」。'
      + "下は高値から何%下がっているか。「○年分」は、上場して間もないなどで期間に足りない銘柄",
      "bar")
    + row('<b class="z-lo">緑</b>・<b class="z-hi">橙</b>',
      "色の意味は株価でも利回りでも同じ。緑＝安い側（株価が安値圏・利回りが10年で高いほう＝配当に比べて株価が安め）、"
      + "橙＝高い側（株価が高値圏・利回りが10年で低いほう）")
    + row("［1〜10年］",
      "期間の切り替え。全銘柄いっしょに替わり、開くたびに1年から。"
      + "10年の安値は 2020年3〜4月（コロナの暴落）の銘柄が多く、値上がりしてきた銘柄は点が右に寄りやすい")
    + (held ? row("○株・取得○円", "持っている銘柄の下の行：株数・取得単価・取得利回り（配当÷取得単価）・含み損益（率）")
      + row("💼 保有", "表の上の合計：取得額→評価額、含み損益、取得利回り。株数と取得単価はこの端末だけで、公開されない") : "")
    + "</div>";
}

// 最下部のブロック。上に保有株の合計（この端末だけ）、その下に「持っている」「気になる」に分けて並べる
// （以前は feeds.json の順に混ざっていて、持っている銘柄を探すのにスクロールが要った。CODE_TASK_04 ③）。
// 分け方は端末の保有株で決め、公開側の順番や構成は変えない。
// v1.44.0 から表にした（CODE_TASK_08 ⑤。1銘柄2〜3行のカードでは29銘柄を見比べにくかった）。
// それぞれの中は、見出しで選んだ並び（決めていなければ feeds.json の順）
function stockBlock(list) {
  const rows = holdingRows();
  if ((!list || !list.length) && !rows.length) return "";
  const held = {};
  rows.forEach(function (r) { held[r.code] = r; });
  const codeOf = function (s) { return String(s.code || "").replace(/\.T$/, ""); };
  // 見出しの右に「見方」の入口（期間の行の横だとスマホの幅で折り返すので、見出しの行に置く）
  let h = '<section class="stocks" id="stocks"><div class="shtop"><h2>📈 ウォッチ銘柄</h2>'
    + '<button class="tool-btn slg-btn' + (STOCK_LEGEND ? " on" : "") + '" type="button" data-stock-legend'
    + ' aria-expanded="' + STOCK_LEGEND + '">ⓘ 見方</button></div>'
    + spanSwitch(list) + (STOCK_LEGEND ? stockLegend(rows.length > 0) : "");
  if (rows.length) {
    const t = holdingTotals(rows);
    h += '<div class="stotal"><div><b>💼 保有 ' + t.n + "銘柄</b>（この端末だけ）</div>"
      + "<div>取得 " + fmtYen(t.cost) + " → 評価 " + fmtYen(t.value) + "</div>"
      + '<div>含み損益 <b class="' + signCls(t.pl) + '">' + fmtYen(t.pl, true)
      + "（" + fmtPct(t.plPct, true) + "）</b></div>"
      + (t.nOther && t.yieldPctH != null
        ? "<div>取得利回り 高配当だけ <b>" + fmtPct(t.yieldPctH) + "</b>（" + t.nDivH + "銘柄）"
          + (t.yieldPct != null ? "／全体 " + fmtPct(t.yieldPct) : "") + "</div>"
        : (t.yieldPct != null ? "<div>取得利回り <b>" + fmtPct(t.yieldPct) + "</b>"
          + (t.nDiv < t.n ? "（配当が分かった " + t.nDiv + "/" + t.n + "銘柄）" : "") + "</div>" : ""))
      + "<small>株数・取得単価は CSV（" + esc(shortDay(HOLD.asof)) + " 時点）。株価は "
      + esc(((window.NEWS_DATA || {}).generated_at || "").slice(5, 16).replace("-", "/"))
      + " の更新。配当は過去1年の実績。"
      + (t.nCsv ? "ウォッチ銘柄に無い " + t.nCsv + "銘柄は CSV の現在値で計算。" : "")
      + "銘柄を押すと詳しい数字が開き、その中で役割の札（高配当・長期保有・優待）を替えられます。</small></div>";
  }
  const mine = sortStocks((list || []).filter(function (s) { return held[codeOf(s)]; }));
  const others = sortStocks((list || []).filter(function (s) { return !held[codeOf(s)]; }));
  const csvOnly = rows.filter(function (r) { return r.fromCsv; });   // 株価の推移が無いので、並べ替えず最後に置く
  const sec = function (label, n) {
    return '<tbody class="ssec"><tr><td colspan="4">' + label + "<i>" + n + "</i></td></tr></tbody>";
  };
  h += '<div class="ssort">並び：<b>' + STOCK_SORT_LABEL[STOCK_SORT] + "</b><small>（見出しを押して替える）</small></div>"
    + '<table class="stab"><colgroup><col class="c-n"><col class="c-p"><col class="c-y"><col class="c-z"></colgroup>'
    + "<thead><tr>" + sortHead("name", "銘柄") + sortHead("price", "株価") + sortHead("yield", "利回り")
    + sortHead("pos", "位置（" + STOCK_SPAN + "年）") + "</tr></thead>";
  if (rows.length) h += sec("💼 持っている", mine.length + csvOnly.length);
  mine.forEach(function (s) { h += stockItem(s, held[codeOf(s)]); });
  csvOnly.forEach(function (r) { h += stockItem(null, r); });
  if (rows.length && others.length) h += sec("👀 気になる", others.length);
  others.forEach(function (s) { h += stockItem(s, null); });
  return h + "</table></section>";
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
        if (g.no_found) a.nofound = true;   // 記事はテーマ名を持たないので、発掘の判定用に印を移す
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
      + hoimiRow()
      + doneTimeRow()
      + holdingsRow()
      + backupRow()
      + '<details class="howto"><summary>使い方</summary><ul>'
      + "<li>カードを<b>右へ払う</b>と既読、<b>左へ払う</b>とお気に入り（払った後" + UNDO_SEC + "秒は戻せます）</li>"
      + "<li><b>朝刊と書庫</b>：一番上の<b>「今日の新着」</b>が朝刊です。見出しを見て、読むものは開き、"
      + "読まないものは<b>✓ 片づけ</b>（押したあと" + UNDO_SEC + "秒は戻せます）。ゼロになると「新着はすべて確認しました」と出ます。"
      + "行の順番は、朝刊の見出しの<b>↕ 並べ替え</b>で変えられます</li>"
      + "<li><b>ホイミ</b>：「今日の新着」の上の<b>▸ ホイミ</b>を押すと、ホイミの画面に移ります。"
      + "1〜2分でできるひと休みが3つ（体・息と五感・頭と心から1つずつ）と職場向けの1つ、"
      + "Lv3 からはレベルで増えた1つ、ふり返り、全部の一覧が並びます。"
      + "できそうなものの<b>できた</b>を押すと記録し、今日まだやっていないものから次の組が出ます（何回でもできます。" + UNDO_SEC + "秒は戻せます）。"
      + "<b>ほかの○つにする</b>で入れ替えられます。"
      + "一覧の項目は、押すと<b>できた</b>が出て、それを押すと記録します。"
      + "新着をすべて確認したときは、その下に出ます。"
      + "<b>HP</b>は記事を開くと3減り、戻るまで1分ごとにさらに1減ります（1本で10まで。30分以上たって戻ったら3だけ）。"
      + "開かずに片づけても1本につき1減ります（1日30まで）。10より下がらず、<b>できた</b>で15回復し、日付が変わると100に戻ります。"
      + "読む・見終える・ホイミで経験値がたまり、<b>Lv</b>が上がります（休んでも下がりません。"
      + "ホイミを元に戻したときだけ、その分が無かったことになって戻ります）。"
      + "Lv3 から3レベルごとに、ホイミのリストに項目が2つずつ増えます。"
      + "出したくないときは、この設定の「ホイミ」で止められます</li>"
      + "<li>テーマの一覧は<b>書庫</b>です。読んだ記事も薄くして残すので、あとから読み返せます。"
      + "書庫はいつも1行に畳んだ状態で始まります（押すと開きます）。件数の少ないテーマは、朝刊では<b>「そのほか」</b>の1行にまとめています</li>"
      + "<li><b>⛏ 発掘</b>は、初めて見つけた少し前の記事です。開くと1週間分が出ます。上の<b>✓ 全部片づけ</b>で、表示中の分をまとめて片づけられます（" + UNDO_SEC + "秒は戻せます）</li>"
      + "<li>テーマの<b>🔒</b>は、そのテーマの読めない記事をまとめて既読にします</li>"
      + "<li>記事右上の<b>☆</b>は、一覧から消えても残る保存です</li>"
      + "<li>書庫のテーマ名を押すと<b>畳めます</b>（書庫の並び順は設定の「書庫のテーマの並べ替え」で変えられます）</li>"
      + "<li><b>📖読んだ記事</b>は、読んだ順にさかのぼって見直せます</li>"
      + "<li>記事の<b>👍</b>は「この発信元をもっと」の印です（既読にしません）。"
      + "<b>👎</b>は「読まずに片づける」印です（発信元の評価には数えません）</li>"
      + "<li>見出しの<b>⚠</b>は、取得できなかった配信元がある印です</li>"
      + "<li><b>保有株</b>：SBI証券のポートフォリオの CSV を読み込むと、天気の下に含み損益と取得利回り、"
      + "最下部のウォッチ銘柄に銘柄ごとの損益が出ます（株数・取得単価はこの端末だけに置き、公開されません）</li>"
      + "<li><b>⬇ 書き出す</b>は、この端末だけにある記録（既読・お気に入り・👍👎など）をファイルに保存します。"
      + "保有株は「保有株も入れる」を選んだときだけ入ります。"
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
  if (same(d, t)) return "今日";
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
const BACKUP_OBJECT_KEYS = [READ_KEY, FAV_KEY, UI_KEY, ORDER_KEY, MORNING_ORDER_KEY, GOOD_KEY, GOODED_KEY,
  BORING_KEY, OPENED_KEY, SESSION_KEY, "mynews_holdings", "mynews_roles"];
const BACKUP_ARRAY_KEYS = [READLOG_KEY];

const HOW_LABEL = {
  open: "開いた", swipe: "右へ払った", boring: "👎つまらない",
  tidy: "テーマの✓片づけ", seen: "ここまで見た", found: "発掘の片づけ",
  tidyall: "全部片づけ", foundall: "発掘の全部片づけ", pick: "選んで既読", all: "すべて既読",
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
  const known = [READ_KEY, FAV_KEY, READLOG_KEY, GOOD_KEY, BORING_KEY, OPENED_KEY, HOLD_KEY];
  const hold = obj(HOLD_KEY);
  return {
    // 1記事につきリンクと見出しの2つの鍵を持つので、リンクの鍵の数を記事数の目安にする
    read: read.filter(function (k) { return k.indexOf("t:") !== 0; }).length,
    fav: Object.keys(obj(FAV_KEY)).length,
    log: Array.isArray(log) ? log.length : 0,
    sources: Object.keys(srcs).length,
    // 保有株は「入っていない」と「0銘柄」を分ける（入っていなければ端末の分を残すため）
    hold: HOLD_KEY in raw ? (Array.isArray(hold.items) ? hold.items.length : 0) : null,
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

// withHoldings が true のときだけ保有株を入れる。書き出したファイルは分析のため
// Claude Chat に渡すこともあるので、既定では金額の情報を入れない（利用者の決定・2026-10-08）。
// 分析用の写し（analysis）には、選んでも入れない（読み方の分析に保有株は要らないため）。
function buildBackup(withHoldings) {
  const raw = snapshotStorage();
  if (!withHoldings) delete raw[HOLD_KEY];
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
      storage: "復元用。端末に保存している記録そのもの（⚙設定の「読み込む」で戻す）。"
        + "保有株（mynews_holdings）は、書き出すときに選んだ場合だけ入る",
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
function downloadBackup(withHoldings) {
  const text = JSON.stringify(buildBackup(withHoldings));
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
// ファイルに保有株が入っていなければ、端末の保有株はそのまま残す
// （置き換えなので、何もしないと「保有株を入れずに書き出したファイル」で消えてしまうため）。
function applyBackup(storage) {
  const myHold = lsGet(HOLD_KEY, null);
  if (myHold !== null && !(HOLD_KEY in storage)) {
    const merged = {};
    Object.keys(storage).forEach(function (k) { merged[k] = storage[k]; });
    merged[HOLD_KEY] = myHold;
    storage = merged;
  }
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
    + '<button class="tool-btn" type="button" id="backup-import">⬆ 読み込む</button>'
    // 毎回外れた状態から始める（分析のために渡すファイルへ、うっかり金額を入れないため）
    + (HOLD ? '<label class="hold-opt"><input type="checkbox" id="backup-hold"> 保有株も入れる</label>' : "")
    + "</div>"
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
      + line("保有株", n.hold == null ? "なし" : n.hold + "銘柄",
        f.hold == null ? (n.hold == null ? "入っていない" : "入っていない（今のまま残す）") : f.hold + "銘柄")
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

// ---- 保有株（この端末だけ）------------------------------------------------
// 株数と取得単価は、どこにも公開しない。SBI証券のポートフォリオの CSV を端末に読み込み、
// 公開側のウォッチ銘柄の株価・配当（data.js）と組み合わせて、この画面の中だけで計算する。
// ウォッチ銘柄に無い銘柄（あとで買った株など）は、CSV に書かれた現在値で代わりに計算する。
const HOLD_KEY = "mynews_holdings";   // { asof: CSVの保存日時(ms), at: 読み込んだ時刻(ms), items: [{code, name, qty, cost, price}] }
const HOLD_FILE_MAX = 2 * 1024 * 1024;   // これより大きいファイルは CSV ではないとみなす
let HOLD = loadHoldings();
let HOLD_PREVIEW = null;   // 読み込もうとしている CSV の中身（確定前）

function loadHoldings() {
  try {
    const v = JSON.parse(lsGet(HOLD_KEY, "null") || "null");
    return isPlainObject(v) && Array.isArray(v.items) && v.items.length ? v : null;
  } catch (e) { return null; }
}

// CSV の1行をセルに分ける（"…" の中のカンマは区切りにしない）
function csvCells(line) {
  const out = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

// 「+1,234.5」のような数を読む。空や読めないものは NaN
function csvNum(s) {
  const t = String(s == null ? "" : s).replace(/[,+\s]/g, "");
  return t === "" ? NaN : Number(t);
}

// SBI証券「ポートフォリオ一覧」の CSV（2026-10 の実物で形を確認）から、株式の段だけを読む。
// 段は「株式（現物/特定預り）」のような1つだけの見出しで始まり、次の行が列名、その下が銘柄。
// 投資信託・国債の段と「…合計」の段は読まない。同じ銘柄が2つの段にあれば足し合わせる。
// 返り値：{ ok: true, items, skipped } か { ok: false, msg }
function parseHoldingsCsv(text) {
  const NG = { ok: false, msg: "SBI証券のポートフォリオの CSV ではないようです。何も変えていません。" };
  const lines = String(text == null ? "" : text).replace(/^﻿/, "").split(/\r?\n/);
  const byCode = {};
  const order = [];
  let inStock = false, cols = null, sections = 0, skipped = 0;
  lines.forEach(function (line) {
    const c = csvCells(line);
    const filled = c.filter(function (x) { return x !== ""; });
    if (filled.length === 1 && c[0] !== "") {   // 段の見出し
      inStock = /^株式[（(]/.test(c[0]) && c[0].indexOf("合計") < 0;
      if (inStock) sections += 1;
      cols = null;
      return;
    }
    if (!inStock || !filled.length) return;
    if (!cols) {   // 段の見出しのすぐ下は列名
      cols = { qty: c.indexOf("数量"), cost: c.indexOf("取得単価"), price: c.indexOf("現在値") };
      if (cols.qty < 0 || cols.cost < 0) { cols = null; inStock = false; }
      return;
    }
    const m = (c[0] || "").match(/^([0-9][0-9A-Z]{3})\s+(.+)$/);   // 「2685 アンドエスティＨＤ」
    const qty = csvNum(c[cols.qty]), cost = csvNum(c[cols.cost]);
    const price = cols.price >= 0 ? csvNum(c[cols.price]) : NaN;
    if (!m || !(qty > 0) || !(cost > 0)) { skipped += 1; return; }
    const k = m[1];
    if (!byCode[k]) {
      byCode[k] = { code: k, name: m[2], qty: 0, cost: 0, price: price > 0 ? price : null };
      order.push(k);
    }
    const h = byCode[k];
    // 取得単価は株数で重みを付けて平均する
    h.cost = (h.cost * h.qty + cost * qty) / (h.qty + qty);
    h.qty += qty;
  });
  if (!sections) return NG;
  if (!order.length) return { ok: false, msg: "株式の段に読める銘柄がありませんでした。何も変えていません。" };
  return { ok: true, items: order.map(function (k) { return byCode[k]; }), skipped: skipped };
}

// SBI の CSV は Shift_JIS。念のため UTF-8 でも試し、中身の言葉で見分ける
function decodeHoldingsCsv(buf) {
  const tries = ["shift_jis", "utf-8"];
  for (let i = 0; i < tries.length; i++) {
    try {
      const t = new TextDecoder(tries[i]).decode(buf);
      if (t.indexOf("取得単価") >= 0) return t;
    } catch (e) { /* その文字コードを使えない環境なら次へ */ }
  }
  return "";
}

// 銘柄の役割（この端末だけ）。既定は高配当。長期保有（SUBARU など）・優待（パルグループなど）は、
// 高配当の物差しで見ると低く見え、合計の取得利回りも押し下げるので分けて扱う（CODE_TASK_04 ④）。
// どれを持っているかの推測につながるので、公開側（feeds.json）には書かない。
const ROLE_KEY = "mynews_roles";   // { コード: "long" | "perk" }（高配当は書かない）
const ROLE_LABEL = { div: "高配当", long: "長期保有", perk: "優待" };
const ROLE_NEXT = { div: "long", long: "perk", perk: "div" };   // 札を押すたびにこの順で替わる
let ROLES = loadTally(ROLE_KEY);
function roleOf(code) {
  const r = ROLES[code];
  return r === "long" || r === "perk" ? r : "div";
}

function watchByCode() {
  const out = {};
  ((window.NEWS_DATA || {}).stocks || []).forEach(function (s) {
    out[String(s.code || "").replace(/\.T$/, "")] = s;
  });
  return out;
}

// 1銘柄ずつの損益と取得利回り。取得利回り＝1株配当（過去1年の実績）÷取得単価（現在値は使わない）
function holdingRows() {
  if (!HOLD) return [];
  const watch = watchByCode();
  return HOLD.items.map(function (h) {
    const w = watch[h.code];
    const price = w ? Number(w.price) : h.price;
    const div = w && typeof w.div === "number" ? w.div : null;
    const costTotal = h.cost * h.qty;
    const value = price != null ? price * h.qty : null;
    return {
      code: h.code, name: w ? w.name : h.name, qty: h.qty, cost: h.cost, price: price,
      fromCsv: !w, div: div, costTotal: costTotal, value: value, role: roleOf(h.code),
      pl: value != null ? value - costTotal : null,
      plPct: value != null && costTotal ? (value - costTotal) / costTotal * 100 : null,
      yieldPct: div != null && h.cost ? div / h.cost * 100 : null,
    };
  });
}

// 合計。取得利回りは「配当が分かった銘柄」だけで出し、何銘柄分かを添える
// （配当の記録が無い銘柄は、無配なのか取れなかったのか見分けられないため）。
// 役割が高配当の銘柄だけの取得利回りも出す（長期保有・優待が合計を押し下げないように）。
function holdingTotals(rows) {
  const t = { n: rows.length, cost: 0, value: 0, nDiv: 0, divSum: 0, divCost: 0, nCsv: 0,
    nOther: 0, nDivH: 0, divSumH: 0, divCostH: 0 };
  rows.forEach(function (r) {
    if (r.value == null) return;
    t.cost += r.costTotal;
    t.value += r.value;
    if (r.fromCsv) t.nCsv += 1;
    if (r.role !== "div") t.nOther += 1;
    if (r.div != null) {
      t.nDiv += 1; t.divSum += r.div * r.qty; t.divCost += r.costTotal;
      if (r.role === "div") { t.nDivH += 1; t.divSumH += r.div * r.qty; t.divCostH += r.costTotal; }
    }
  });
  t.pl = t.value - t.cost;
  t.plPct = t.cost ? t.pl / t.cost * 100 : null;
  t.yieldPct = t.divCost ? t.divSum / t.divCost * 100 : null;
  t.yieldPctH = t.divCostH ? t.divSumH / t.divCostH * 100 : null;
  return t;
}

// 金額と率の書き方（上げは赤・下げは青。日本の慣習）
function signCls(v) { return v > 0 ? "up" : v < 0 ? "down" : ""; }
function fmtYen(v, signed) {
  const s = Math.round(Math.abs(v)).toLocaleString("ja-JP") + "円";
  return signed ? (v > 0 ? "+" : v < 0 ? "-" : "±") + s : s;
}
function fmtPct(v, signed) {
  if (v == null) return "";
  return (signed ? (v > 0 ? "+" : v < 0 ? "-" : "±") : "") + Math.abs(v).toFixed(2) + "%";
}
function fmtNum(v) { return Number(v).toLocaleString("ja-JP", { maximumFractionDigits: 2 }); }
function shortDay(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  return (d.getMonth() + 1) + "/" + d.getDate();
}

// 設定の中の1段。CSV を読み込むボタンと、置き換える前の確認
function holdingsRow() {
  const n = HOLD ? HOLD.items.length : 0;
  let h = '<div class="srow backup"><span>保有株（この端末だけ・公開されません）<small>'
    + (n ? n + "銘柄（CSV " + shortDay(HOLD.asof) + " 時点の株数・取得単価）"
      : "SBI証券のポートフォリオの CSV を読み込むと、含み損益と取得利回りを出します")
    + "</small></span>"
    + '<button class="tool-btn" type="button" id="hold-import">⬆ CSV を読み込む</button>'
    + (n ? '<button class="tool-btn" type="button" id="hold-clear">消す</button>' : "")
    + "</div>"
    + '<input type="file" id="hold-file" hidden>';
  const p = HOLD_PREVIEW;
  if (p && !p.ok) {
    h += '<div class="trouble-list import-box"><p>⚠ ' + esc(p.msg) + "</p>"
      + '<button class="tool-btn" type="button" id="hold-cancel">閉じる</button></div>';
  } else if (p) {
    const watch = watchByCode();
    const missing = p.items.filter(function (x) { return !watch[x.code]; });
    h += '<div class="trouble-list import-box">'
      + "<p>この CSV の株式は <b>" + p.items.length + "銘柄</b>"
      + (p.asof ? "（" + esc(fmtTime(p.asof)) + " 保存）" : "")
      + "。今の端末は " + n + "銘柄です。</p>"
      + (p.skipped ? "<p>読めなかった行 " + p.skipped + " 行は入れません。</p>" : "")
      + (missing.length
        ? "<p>ウォッチ銘柄に無い " + missing.length + "銘柄（"
          + esc(missing.map(function (x) { return x.code + " " + x.name; }).join("、"))
          + "）は、CSV の現在値で計算し、配当は出ません。毎朝の株価と配当がほしければ、ウォッチ銘柄に足してください。</p>"
        : "")
      + "<p><b>置き換え</b>です。株数と取得単価は、この端末の中だけに置きます。</p>"
      + '<div class="import-btns"><button class="tool-btn on" type="button" id="hold-apply">この内容に置き換える</button>'
      + '<button class="tool-btn" type="button" id="hold-cancel">やめる</button></div></div>';
  }
  return h;
}

// ---- きょうの新着だけの画面 ------------------------------------------------
// 新着があっても、どのテーマにあるかスクロールして探すしかなかった。
// テーマの並びは feeds.json 順のまま動かさず（毎日同じ場所にある安心感を保つ）、
// 別の入口として「新着だけ」を集める。

// 新着でテーマを1行にまとめるカテゴリ（feeds.json のカテゴリに "fresh_merge": true）
function mergeCats() {
  const out = {};
  ((window.NEWS_DATA || {}).categories || []).forEach(function (c) { if (c.fresh_merge) out[c.name] = true; });
  return out;
}

// 新着の「行」を、設定の並び順で（動画は後ろ）。朝刊と新着画面はどちらもこれを使う。
// 行はふつうテーマ1つ。まとめるカテゴリ（動画・人物・作品・地元・海外ニュース）は、カテゴリ1つで1行にし、
// 中のテーマを members に持つ（1〜2件のテーマが1行ずつ並び、開く・片づけるが増えていたため。CODE_TASK_03）。
// feeds.json の fresh_rows に書いたテーマは、カテゴリをまたいで1行（そのほか）にまとめる（CODE_TASK_08 ③）。
// key は開閉・片づけの目印。まとめた行は "cat:"（そのほかは "row:"）を付けてテーマ名と区別する
// （カテゴリ「テレビ情報」とテーマ「テレビ情報」のように、同じ名前があるため）。
// まとめた行は、中のテーマのうち一番前のものの位置に置く。
// 行の中では「先頭に出す」印（feeds.json の merge_top）のテーマを件数に関係なく前に置く
// （件数の多い茨城のニュース・海外ニュースと一緒にすると、大洗・アーミル・カーンが
//  「残り◯件」の奥に沈むため。CODE_TASK_05 ①②）。のぞき見も開いたカードも、この順に並ぶ。
function freshBlocks() {
  return freshRows().filter(function (b) { return b.items.length; });
}

// 新着の無い行も含めた、朝刊の全部の行（並べ替えの画面はこれを全部出す。v1.37.0）。
// 並びは、利用者が［↕ 並べ替え］で決めた順（arrangeRows）。決めていなければ元の並び：
// 設定の並び順（書庫と同じ）で、動画は後ろ、「top」の印のテーマ（ウォッチ銘柄のニュース）を一番上。
// top は v1.36.0 まで「並べ替えより前に固定」だったが、利用者の意図ではなかったので（10/13）、
// 今は最初の並びを決めるだけ（並べ替えで下へも動かせる）。
function freshRows() {
  const sorted = sortByOrder(ALL_GROUPS.filter(function (x) { return !isVideoGroup(x.group); }))
    .concat(sortByOrder(ALL_GROUPS.filter(function (x) { return isVideoGroup(x.group); })));
  const ordered = sorted.filter(function (x) { return x.group.top; })
    .concat(sorted.filter(function (x) { return !x.group.top; }));
  const merge = mergeCats();
  const rowOf = mergeRowOf();
  const out = [];
  const byCat = {};
  const byRow = {};
  ordered.forEach(function (x, i) {
    const items = (x.group.items || []).filter(isFresh);
    const one = { key: x.group.name, name: x.group.name, cat: x.cat, items: items,
      first: !!x.group.merge_top, pos: i };
    // カテゴリをまたいでまとめる行（そのほか）。置き場所の決め方はカテゴリでまとめた行と同じ
    const row = rowOf[x.group.name];
    if (row) {
      let r = byRow[row.name];
      if (!r) {
        r = byRow[row.name] = { key: "row:" + row.name, name: row.name, cat: x.cat, items: [], members: [],
          pos: i, memberNames: row.themes };
        out.push(r);
      }
      if (items.length) {
        if (!r.members.length) r.pos = i;
        one.idx = row.themes.indexOf(x.group.name);
        r.members.push(one);
      }
      return;
    }
    if (!merge[x.cat]) { out.push(one); return; }
    let b = byCat[x.cat];
    if (!b) {
      b = byCat[x.cat] = { key: "cat:" + x.cat, name: x.cat, cat: x.cat, items: [], members: [], pos: i };
      out.push(b);
    }
    // まとめた行の元の位置は、中の新着のあるテーマのうち一番前のもの（新着が無ければ一番前のテーマ）。
    // v1.36.0 までと同じ置き方（新着のある行どうしの順番が変わらないように）
    if (items.length) {
      if (!b.members.length) b.pos = i;
      b.members.push(one);
    }
  });
  // まとめた行の中を「先頭に出す」テーマ → ほかのテーマ の順にし、記事もその順で持たせる
  Object.keys(byCat).forEach(function (c) {
    const b = byCat[c];
    b.members = b.members.filter(function (m) { return m.first; })
      .concat(b.members.filter(function (m) { return !m.first; }));
    b.items = b.members.reduce(function (all, m) { return all.concat(m.items); }, []);
  });
  // そのほかの行の中は、feeds.json に書いた順（件数が少なく見落としたくないものが前）
  Object.keys(byRow).forEach(function (n) {
    const r = byRow[n];
    r.members.sort(function (a, b) { return a.idx - b.idx; });
    r.items = r.members.reduce(function (all, m) { return all.concat(m.items); }, []);
  });
  out.sort(function (a, b) { return a.pos - b.pos; });
  return arrangeRows(out);
}

// カテゴリをまたいで1行にまとめるテーマ（feeds.json の fresh_rows。CODE_TASK_08 ③）。{テーマ名: {name, themes}}。
// 件数で自動に決めず固定にする（件数で決めると、日によって行の位置が変わるため。CODE_TASK_03 と同じ考え）
function mergeRowOf() {
  const out = {};
  ((window.NEWS_DATA || {}).fresh_rows || []).forEach(function (r) {
    (r.themes || []).forEach(function (t) { if (!out[t]) out[t] = { name: r.name, themes: r.themes }; });
  });
  return out;
}

// 行の並び順の数字。まとめた行（そのほか）にまだ数字が無ければ、中のテーマが［↕ 並べ替え］で
// 置かれていた一番上の位置を使う（まとめる前の位置をできるだけ引き継ぐ。CODE_TASK_08 ③）
function morningOrderOf(r) {
  if (typeof MORNING_ORDER[r.key] === "number") return MORNING_ORDER[r.key];
  const nums = (r.memberNames || []).map(function (n) { return MORNING_ORDER[n]; })
    .filter(function (v) { return typeof v === "number"; });
  return nums.length ? Math.min.apply(null, nums) : null;
}

// 利用者が決めた朝刊の並び（MORNING_ORDER）を当てる。決めていなければ元の並びのまま。
// 覚えた順に無い行（あとで増えたテーマ）は、元の並びで1つ前にある行のすぐ後ろに入れる。
function arrangeRows(rows) {
  const has = function (r) { return morningOrderOf(r) !== null; };
  if (!rows.some(has)) return rows;
  const out = rows.filter(has).sort(function (a, b) { return morningOrderOf(a) - morningOrderOf(b); });
  rows.forEach(function (r, i) {
    if (has(r)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = out.indexOf(rows[j]);
      if (k >= 0) { at = k + 1; break; }
    }
    out.splice(at, 0, r);
  });
  return out;
}

// 並べ替えの ▲▼。今の並び（新着の無い行も含む）で1つ入れ替え、全部の行の順番を覚える
function moveMorningRow(key, dir) {
  const rows = freshRows();
  const at = rows.map(function (r) { return r.key; }).indexOf(key);
  const to = dir === "up" ? at - 1 : at + 1;
  if (at < 0 || to < 0 || to >= rows.length) return;
  const moved = rows.splice(at, 1)[0];
  rows.splice(to, 0, moved);
  MORNING_ORDER = {};
  rows.forEach(function (r, i) { MORNING_ORDER[r.key] = i; });
  lsSet(MORNING_ORDER_KEY, JSON.stringify(MORNING_ORDER));
}

function freshBlockByKey(key) {
  return freshBlocks().find(function (b) { return b.key === key; }) || null;
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

// 行の「まとまり」。まとめた行は、中のテーマごとに並べ、どのテーマの記事かを持たせる
function blockUnits(b) {
  if (!b.members) return morningUnits(b);
  const units = [];
  b.members.forEach(function (m) {
    morningUnits(m).forEach(function (u) {
      u.member = m.name;
      u.memberCount = m.items.length;
      units.push(u);
    });
  });
  return units;
}

// 朝刊でテーマを開いたときのカード。小分類のあるテーマは小見出しを入れて並べる
// （20件が1列に並ぶと読みたいものを探しにくい）。まとめた行は、テーマ名（チャンネル名）を小見出しにする。
function freshCards(b) {
  IN_MORNING = true;
  let h = "";
  try {
    const units = blockUnits(b);
    const split = b.items.length >= MORNING_SPLIT && !MORE_OPEN[b.key] && units.length > MORNING_SHOW;
    let head;
    (split ? units.slice(0, MORNING_SHOW) : units).forEach(function (u) {
      const label = b.members ? u.member : u.sec;
      const count = b.members ? u.memberCount : u.secCount;
      if (label !== null && label !== undefined && label !== head) {
        h += '<div class="msec">' + esc(label) + "<i>" + count + "</i></div>";
      }
      head = label;
      h += topicCards(u.member || b.name, u.items);
    });
    if (split) {
      const rest = units.slice(MORNING_SHOW).reduce(function (t, u) { return t + u.items.length; }, 0);
      h += '<button class="mmore" type="button" data-fresh-more="' + esc(b.key) + '">'
        + "▾ 残り" + rest + "件を見る</button>";
    }
  } finally { IN_MORNING = false; }
  return h;
}

// 閉じたテーマの行の下に、代表の見出しを2本まで出す（Google ニュースのまとめ方）。
// 開かなくても「読むか、片づけるか」を決められるように。押すとテーマが開く。
// 長い見出しは1行で切る（画面の幅で「…」になるだけで、要約はしない）。
// まとめた行は、中身の種類が分かるよう、テーマごとに1本ずつ選んでテーマ名を添える。
function freshPeek(b) {
  let units = blockUnits(b);
  if (b.members) {
    const firsts = [], seen = {};
    units.forEach(function (u) { if (!seen[u.member]) { seen[u.member] = 1; firsts.push(u); } });
    units = firsts.concat(units.filter(function (u) { return firsts.indexOf(u) < 0; }));
  }
  units = units.slice(0, PEEK_MAX);
  if (!units.length) return "";
  return '<button class="mpeek" type="button" data-fresh-peek="' + esc(b.key) + '">'
    + units.map(function (u) {
      return "<span>" + (u.member ? "<b>" + esc(u.member) + "</b>" : "") + esc(u.items[0].title) + "</span>";
    }).join("")
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

// 配信の近い記事をつなぐとき（topicClusters の最後の条件）に数えない、どの話題にも出る漢字の語
// （見出しを2文字ずつに刻んだ形で書く）。実測（CODE_TASK_06 ①）：「対象・最大・価格・販売」で
// Amazon の別々の商品の宣伝を、「動画・解説」でグロービスの別々の解説動画をつないだ。
const NEAR_STOP = ["対象", "最大", "特別", "別価", "価格", "販売", "提供", "供開", "開始", "公開", "開中",
  "動画", "解説", "株式", "式会", "会社", "商品", "製品", "発売", "開催", "情報", "登場", "予約", "受付",
  "発表", "記事", "一覧", "今日", "本日", "全国"];
// 決算の記事に出る語。同じ会社の決算は、言い回しが違っても同じ出来事とみなす
const EARN_RE = /決算|月期|増益|減益|増収|減収|純利益|経常|営業益|業績|上方修正|下方修正/;

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
  // 配信の近い記事どうしで、少しありふれた漢字の語（テーマ全体で15件以下）が重なるかたまりの数。
  // カタカナ・英字の語は数えない（固有名詞がテーマの中でくり返し出て、別の出来事をつないだ。
  // 実測：「アンソロピック」で Claude の別々の発表を、「サッカー」「ゴール」で別々の選手の初ゴールを）
  const nearRuns = function (i, j) {
    const ri = {}, rj = {};
    Object.keys(words[i]).forEach(function (w) {
      if (!words[j][w] || df[w] > 15 || !/^[一-龠々]+$/.test(w) || NEAR_STOP.indexOf(w) >= 0) return;
      ri[words[i][w].run] = true;
      rj[words[j][w].run] = true;
    });
    return Math.max(Object.keys(ri).length, Object.keys(rj).length);
  };
  const same = function (i, j) {
    const A = items[i], B = items[j];
    // 会社のテーマ（ウォッチ銘柄）で、別の会社の記事は別の出来事（co は build_news.py が付ける）。
    // 実測：別々の会社の「AI株価診断」のページが、ありふれた語の一致で畳まれていた
    if (A.co && B.co && A.co !== B.co) return false;
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
    if (strong || Math.max(Object.keys(ri).length, Object.keys(rj).length) >= 3) return true;
    // ここから下の2つは CODE_TASK_06 ①。どちらも連載の別の回（数字が違う）はつながない
    if (nums[i] !== nums[j]) return false;
    // 同じ会社の決算の記事は、配信が2日以内なら同じ出来事。会社名・「決算」はそのテーマでは
    // ありふれた語で、上の条件ではつながらなかった（ビックカメラの決算が5件別々に並んだ）
    if (A.co && A.co === B.co && days(A, B) <= 2
        && EARN_RE.test(A.title || "") && EARN_RE.test(B.title || "")) return true;
    // 大きな出来事は、その出来事の語（閲覧・県警・暫定など）がテーマの中で何度も出て
    // 「ありふれた語」になり、上の条件ではつながらなかった（茨城県HP障害の16件が12枚に分かれた）。
    // 配信が1日以内で、見出しの重なりが一定あり、少しありふれた漢字の語が2かたまり以上重なればつなぐ
    return days(A, B) <= 1 && overlap(i, j) >= 0.15 && nearRuns(i, j) >= 2;
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
//   ② 無料の記事を有料・会員限定より前へ。YouTube 以外の動画サイト（TVer など。build_news.py が vsite の印を付ける）も
//      スマホでは見ないので、有料と同じく後ろへ（利用者の希望 2026-10-17）
//   ③ 説明文が長いほうを前へ（見出しのくり返しの部分は数えない）
//   ④ 差が無ければ元の並び順
const SUBPAGE_RE = /[2-9２-９]\s*ページ目|[（(]\s*[2-9]\s*ページ|画像ページ|写真・画像|記事一覧/;
function topicRank(a) {
  const sub = SUBPAGE_RE.test(a.title || "") ? 1 : 0;
  const paid = (a.paywall && a.paywall !== "free") || a.vsite ? 1 : 0;
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

// ---- ホイミ（1〜2分のひと休み）---------------------------------------------
// ストレスコーピングアプリ（slowdrift.github.io/Stress_Coping/）は、開くきっかけが無くて使われていなかった。
// そこで毎日開くこのアプリの「新着はすべて確認しました」の下に、1〜2分でできることを出す（CODE_TASK_09 ①）。
// v1.45.1 から、新着が残っていても「今日の新着」の上の1行から開ける（hoimiLine）。
// v1.46.0 から、その1行を押すと「ホイミの画面」に移る（今の3つ・ふり返り・70個の一覧）。1日に何回でもできる
// （利用者の指摘 10/30「1日1回しかできないのが不満」「ストレスコーピングはやればやるほど良いもの」）。
// 一覧は元のコーピングアプリの核心「最近やっていないものが見える」をそのまま持ってきたもの。
// v1.47.0 で HP と経験値・レベルを足した（利用者の希望 10/30。下の「HP と経験値」）。
// ただし、減って責められる作り（連続記録が途切れる・レベルが下がる・HPが0で終わる）は入れない。
// 通知とストレスの点数も入れない（コーピングアプリで外した理由のまま。点数は手帳とすみ分け）。
// 名前はドラクエの小さな回復の呪文から（利用者の命名 10/29）。
// コーピングアプリとはつながず、このアプリだけで完結させる（利用者の決定 10/29。あちらは今後使わないかもしれないため）。
// 3つ並べ、どれか1つを選んでもらう（利用者の発案 10/29：サプリは無ければ飲めない、体操は家でしかできない、など
// 1つだけだと、その場でできないことがあるため）。3つは性格の違う組から1つずつ出す。
// 「心」の組はほぼどこでもできるので、3つのうち少なくとも1つはその場でできる。
//   body … 体（動かす・ゆるめる）  sense … 息・五感・まわり  mind … 頭と心（考え方・言葉・書く・人とのつながり）
// 項目は元の70個（利用者の了承 10/29。組み分けは Claude の判断）と、職場向けの13個（v1.47.0）。番号の付け方：
//   i〇〇   … コーピングアプリ（Stress_Coping）の1〜2分の項目そのまま（番号も同じ）
//   i〇〇-n … コーピングアプリの小分け（音楽・自然音）を1つずつにしたもの
//   i〇〇s  … コーピングアプリの5〜15分の項目を、1〜2分でできる形に縮めたもの（言い回しは Claude の案）
//   h〇〇   … このアプリで足した新しい項目（Claude の案）
//   w〇〇   … 職場向け（CODE_TASK_11 ⑥。元の70個は利用者が厳選したものなので、混ぜずに別の組にした）
//   l〇〇   … レベルで増える項目（CODE_TASK_12。並びが増える順。出典は README）
// 4つ目の値は一言の説明（CODE_TASK_11 ③。名前の下に小さく出す。文は Claude の案で、README に一覧がある）。
// 元のコーピングアプリには説明が無かったので、意味が分からない項目（と思ってみた法・呼吸法）は推測で書いた。
//
// 4つ目と5つ目の考え方（利用者の考え 2026-10-31）：職場にいるのにランニングはできない、体調が悪いのに
// サウナには行けない、という当然の制限を無視して出すと「今はそんなのできないよ」というストレスになる。
// そこで4つ目は職場でもできるものだけから出し、必ず1つは今できるものがあるようにする。
// 5つ目はレベルで増えた項目から、場所や体調の制限にあまりとらわれずに出す。
const HOIMI_KINDS = ["body", "sense", "mind"];   // 今の3つの組（1つずつ出す）
const HOIMI_WORK = "work";                        // 4つ目に出す組（職場向け）
const HOIMI_LV = "lvup";                          // 5つ目に出す組（レベルで増えた。CODE_TASK_12）
const HOIMI_ALL_KINDS = HOIMI_KINDS.concat([HOIMI_WORK, HOIMI_LV]);
// レベルで増える項目は、Lv3 から3レベルごとに2つずつ使えるようになる（Lv3・6・9…）。
// HOIMI_ITEMS の l〇〇 の並び順に増えるので、足すときは後ろに足せば続きのレベル（Lv30・33…）に並ぶ
const HOIMI_LV_FIRST = 3, HOIMI_LV_EVERY = 3, HOIMI_LV_PER = 2;
const HOIMI_ITEMS = [
  // コーピングアプリの1〜2分（32）
  ["i01", "青竹を踏む", "body", "青竹の上で足踏みし、足の裏を刺激する"],
  ["i07", "指を押す", "body", "指先を1本ずつ、反対の手でぎゅっと押す"],
  ["i14", "耳を引っ張る", "body", "耳たぶを横・上・下へ、やさしく引っ張る"],
  ["i49", "手足グーパー", "body", "手足をにぎって開く、を10回くり返す"],
  ["i51", "ガムを噛む", "body", "ガムをゆっくり噛んで、あごを動かす"],
  ["i60", "口角を上げる", "body", "口の両端を上げて、10秒そのままにする"],
  ["i63", "体を揺らす", "body", "立ったまま、または座ったまま体を左右に揺らす"],
  ["i05", "深呼吸", "sense", "鼻からゆっくり吸って、口から長く吐く"],
  ["i06", "呼吸法", "sense", "決めている呼吸法を1〜2分続ける"],
  ["i17", "サプリを飲む", "sense", "いつものサプリを、水と一緒に飲む"],
  ["i23-1", "音楽を聴く：井上陽水", "sense", "1曲だけ、ほかのことをせずに聴く"],
  ["i23-2", "音楽を聴く：ドビュッシー", "sense", "1曲だけ、ほかのことをせずに聴く"],
  ["i23-3", "音楽を聴く：鈴木愛理", "sense", "1曲だけ、ほかのことをせずに聴く"],
  ["i24-1", "自然音を聴く：雨", "sense", "目を閉じて、1〜2分だけ聴く"],
  ["i24-2", "自然音を聴く：川", "sense", "目を閉じて、1〜2分だけ聴く"],
  ["i24-3", "自然音を聴く：波", "sense", "目を閉じて、1〜2分だけ聴く"],
  ["i24-4", "自然音を聴く：焚き火", "sense", "目を閉じて、1〜2分だけ聴く"],
  ["i26", "植物にふれる", "sense", "葉や土にふれて、手ざわりを感じる"],
  ["i44", "温かい飲み物を持つ", "sense", "両手で包んで、温かさを感じる"],
  ["i45", "顔を洗う・手を冷やす", "sense", "冷たい水で、気分を切り替える"],
  ["i47", "白湯を飲む", "sense", "温かいお湯を、ゆっくり飲む"],
  ["i50", "グラウンディング", "sense", "足の裏が床についている感じに意識を向ける"],
  ["i58", "香りを使う", "sense", "好きな香りをかぐ（アロマ・ハンドクリームなど）"],
  ["i59", "空を見上げる", "sense", "顔を上げて、雲や空の色を眺める"],
  ["i62", "ひとくち味わう", "sense", "ひと口を、味と香りに集中して食べる"],
  ["i03", "と思ってみた法", "mind", "浮かんだ考えに「…と思った」と付けて眺める"],
  ["i08", "ストレス把握", "mind", "いまのストレスに10点満点で点をつける"],
  ["i53", "感謝を3つ", "mind", "ありがたかったことを3つ思い浮かべる"],
  ["i54", "自分に優しく", "mind", "友だちにかけるような言葉を、自分にかける"],
  ["i55", "「一時的」と唱える", "mind", "「この気分は一時的」と心の中で言う"],
  ["i61", "推しを見る", "mind", "好きな人やキャラクターの写真・動画を見る"],
  ["i66", "いいことを読む", "mind", "書きためた「良かったこと」を読み返す"],
  // コーピングアプリの5〜15分を、1〜2分に縮めたもの（15）
  ["i12s", "首と肩を回す", "body", "首をゆっくり回し、肩を前後に回す"],
  ["i13s", "手のひらをもむ", "body", "手のひらを、反対の親指でぐっともむ"],
  ["i16s", "スクワットを10回", "body", "ゆっくり腰を落として、10回"],
  ["i57s", "机の上を1か所だけ片づける", "body", "目に入る1か所だけ。全部はやらない"],
  ["i21s", "好きな歌を口ずさむ", "sense", "1番だけ、小さな声で"],
  ["i25s", "自然の映像を少し見る", "sense", "海や森の映像を1〜2分だけ眺める"],
  ["i27s", "外の空気を吸う", "sense", "窓を開けるか外に出て、深く吸う"],
  ["i48s", "手のひらで目を覆う", "sense", "温めた手のひらで、目を暗くして休める"],
  ["i04s", "1分だけ目を閉じて座る", "mind", "息の出入りだけに意識を向ける"],
  ["i09s", "日記を1行だけ書く", "mind", "今日のことを1行だけ書く"],
  ["i18s", "本を1ページ読む", "mind", "読みかけの本やマンガを1ページ"],
  ["i22s", "短いお笑いを1本見る", "mind", "漫才やコントを1本だけ"],
  ["i52s", "気になっていることを1行書き出す", "mind", "頭の中のもやもやを、紙に出す"],
  ["i56s", "誰かに一言お礼を言う", "mind", "身近な人に「ありがとう」を伝える"],
  ["i65s", "行きたい場所を1つ調べる", "mind", "旅の計画の、はじめの一歩にする"],
  // 新しく足したもの（23）
  ["h01", "背伸びをする", "body", "両手を上げて、全身をぐっと伸ばす"],
  ["h02", "肩をすくめて、すとんと落とす", "body", "肩を耳に近づけてから、力を抜いて落とす"],
  ["h03", "こぶしを5秒にぎって、ゆるめる", "body", "力を入れてから抜くと、ゆるんだ感じが分かる"],
  ["h04", "胸を開いて姿勢を正す", "body", "肩を後ろに引き、胸を広げて座り直す"],
  ["h05", "手をこすって温める", "body", "手のひらをこすり合わせ、温かさを感じる"],
  ["h06", "その場で足踏みを30回", "body", "腕も振って、体を温める"],
  ["h07", "吸うより長く吐く（4つ吸って6つ吐く）", "sense", "吐く息を長めにして、5回くり返す"],
  ["h08", "吸い足して、長いため息を2回", "sense", "2回続けて吸ってから、口から長く吐く"],
  ["h09", "遠くを見る", "sense", "窓の外など、遠くの1点を眺める"],
  ["h10", "目を閉じて、聞こえる音を3つ数える", "sense", "近い音・遠い音を聞き分ける"],
  ["h11", "手を洗うとき、水の温度を感じる", "sense", "手を洗うついでに、水の感じに集中する"],
  ["h12", "日の光を浴びる", "sense", "窓辺や外で、顔に日の光を当てる"],
  ["h13", "スマホを1分伏せて置く", "sense", "画面を見ない時間を1分つくる"],
  ["h14", "動物の動画を1本見る", "sense", "短い動物の動画を1本だけ"],
  ["h15", "ゆっくり10数える", "mind", "数えることだけに集中する"],
  ["h16", "好きな言葉を思い出す", "mind", "支えになっている言葉を1つ思い出す"],
  ["h17", "今日うまくいったことを1つ思い出す", "mind", "小さなことでよい"],
  ["h18", "楽しみな予定を1つ思い浮かべる", "mind", "週末や次の休みのことを考える"],
  ["h19", "いまできることを1つだけ決める", "mind", "次にやることを1つにしぼる"],
  ["h20", "気がかりを「あとで考える」とメモする", "mind", "考える時間を後に回して、頭を空ける"],
  ["h21", "家族に一言声をかける", "mind", "「お疲れさま」など短くてよい"],
  ["h22", "誰かに短いメッセージを送る", "mind", "気軽な一言を1通だけ"],
  ["h23", "好きな写真を1枚見る", "mind", "家族や旅の写真を1枚"],
  // 職場向け（13。CODE_TASK_11 ⑥。言い回しは指示書のとおり。出典は README）
  ["w01", "首を横に倒して伸ばす", "work", "左右10秒ずつ。座ったままできる"],
  ["w02", "座ったまま上体をひねる", "work", "片手を反対のひざに置き、ゆっくり左右"],
  ["w03", "手を前で組んで背中を丸める", "work", "肩甲骨の間をのばす"],
  ["w04", "額・あご・肩の力を順に抜く", "work", "力が入っている所に気づいてゆるめる"],
  ["w05", "両足を床につけて座り直す", "work", "背すじをのばして姿勢を整える"],
  ["w06", "箱呼吸", "work", "4つ吸う・4つ止める・4つ吐く・4つ止める、を3回"],
  ["w07", "冷たい水をひと口飲む", "work", "温度の変化で気分を切り替える"],
  ["w08", "画面を暗くし、通知を1つ切る", "work", "目と耳に入るものを減らす"],
  ["w09", "眉間や鎖骨の下を指で軽くたたく", "work", "タッピング。気がかりを言葉にしながら"],
  ["w10", "考えを実況中継する", "work", "「いま〜と考えている」と、良し悪しをつけずに言葉にする"],
  ["w11", "言い換えてみる", "work", "起きたことを別の言葉・別の見方で言い直す"],
  ["w12", "変えられること・変えられないことに分ける", "work", "変えられないことは手放す"],
  ["w13", "終わった作業に✓をつけてから次へ", "work", "区切りをつけて頭を切り替える"],
  // レベルで増える（17。CODE_TASK_12。指示書の例の26個をもとに、Claude が資料で確かめて選び直した。
  // 1〜2分でできる・今の83個とやり方が重ならない・出典を読んで確かめた、の3つで選んだ。言い回しは Claude の案）
  ["l01", "5・4・3・2・1", "lvup", "見えるもの5つ、ふれているもの4つ、聞こえる音3つ、におい2つ、味1つを数える"],
  ["l02", "1歩ずつ「右・左」とゆっくり歩く", "lvup", "足の運びに合わせて、心の中で言う"],
  ["l03", "自律訓練法", "lvup", "「両手が重たい」「両手が温かい」と心の中でくり返し、手の感じを味わう"],
  ["l04", "仲間集め", "lvup", "動物・国・野菜など、1つの仲間を思いつくだけ挙げる"],
  ["l05", "気持ちに名前をつける", "lvup", "いまの気持ちを「いらいら」「不安」など一言で"],
  ["l06", "クッションやぬいぐるみを抱える", "lvup", "腕の中の重さと手ざわりを感じる"],
  ["l07", "落ち着ける場所を思い浮かべる", "lvup", "前にほっとした場所の景色を思い出す"],
  ["l08", "ヨガのポーズを1つ", "lvup", "楽な形で30秒（ひざをついて体を前に倒す、など）"],
  ["l09", "目の前の様子を心の中で説明する", "lvup", "色・形・置いてある物を、人に伝えるつもりで"],
  ["l10", "人の声に耳を傾ける", "lvup", "近くの会話やラジオの声に、注意を向ける"],
  ["l11", "大切な人の顔を思い浮かべる", "lvup", "家族などの顔を、1人ずつ"],
  ["l12", "自分を名前で呼んで話しかける", "lvup", "「○○は、いま何が気になっているの？」と外から見るように"],
  ["l13", "いつもの作業を細かく思い浮かべる", "lvup", "お茶をいれる手順などを、1つずつ順に"],
  ["l14", "いまの気持ちを誰かに一言話す", "lvup", "「ちょっと疲れた」など、短くてよい"],
  ["l15", "自分をいたわる3つの言葉", "lvup", "「いまはつらい」「つらいのは自分だけじゃない」「自分にやさしく」と心の中で言う"],
  ["l16", "目に入る文字を1語ずつ心で読む", "lvup", "掲示や本の題などを、ゆっくり"],
  ["l17", "場所と日付を確かめる", "lvup", "「ここは○○、今日は○月○日、季節は○」と心の中で言う"],
];
const HOIMI_KEY = "mynews_hoimi";          // { day: "2026-10-29", ids: [今日出している3〜5つ（組の順）], skip: [今日替えた項目] }
// レベルが上がって増えた項目（v1.48.0）。{ ids: [増えた項目], day: 初めて見せた日（まだなら ""） }。
// 初めて見せた日のうちは、5つ目にこの項目を先に出し「新しく増えた」の札を付ける
const HOIMI_NEW_KEY = "mynews_hoimi_new";
const HOIMI_LOG_KEY = "mynews_hoimi_log";  // [[できた時刻(ms), 項目の番号], …]
const HOIMI_OFF_KEY = "mynews_hoimi_off";  // "1" なら出さない（既定は出す）
const HOIMI_WORK_OFF_KEY = "mynews_hoimi_work_off";   // "1" なら4つ目（職場向け）を出さない（既定は出す。v1.47.0）
// 超えたら古いものから減らす。v1.45.0 の 400 は1日1回のつもりの数だった。
// 何回でもできるようにしたので 5000 に（1日10回でも1年以上残る。v1.46.0）
const HOIMI_LOG_MAX = 5000;
const HOIMI_WAIT_MAX = 30;                 // 何日空いたら「十分に久しぶり」とみなすか（選ばれやすさの頭打ち）
const HOIMI_RARE_DAYS = 10;                // 一覧でこれだけ空いた項目に「○日ぶり✨」を付ける
const HOIMI_MONTHS = 6;                    // ふり返りの月ごとの回数を何か月分並べるか
const HOIMI_KIND_LABEL = { body: "体", sense: "息と五感", mind: "頭と心", work: "職場向け", lvup: "レベルで増えた" };
// ［できた］のあとの言葉。順に出す（CODE_TASK_11 ⑦。ドラゴンクエストの言い回し風。1つ目は利用者が選んだ文）
const HOIMI_MSGS = [
  "HPが すこし かいふくした！",
  "からだに ちからが みなぎってきた！",
  "いきが ととのった！",
  "かたの ちからが ぬけた！",
  "こころが すこし かるくなった！",
  "あたまが すっきりした！",
  "げんきが わいてきた！",
  "きもちが ほっと やすらいだ！",
  "めのまえが すこし あかるくなった！",
  "つかれが すこし とれた！",
];

// 端末の時計で「2026-10-29」の形（日ごとの記録の名前に使う）
function dayKey(ms) {
  const d = new Date(ms);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

// 2つの時刻が端末の暦で何日離れているか（同じ日なら0、昨日なら1）。24時間ごとに区切ると、
// 夜にやった項目が翌朝まだ「今日」に見えるので、日付で数える
function calDays(from, to) {
  const a = new Date(from), b = new Date(to);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
    - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
}

function hoimiName(id) {
  const it = HOIMI_ITEMS.find(function (x) { return x[0] === id; });
  return it ? it[1] : "";
}

function hoimiKind(id) {
  const it = HOIMI_ITEMS.find(function (x) { return x[0] === id; });
  return it ? it[2] : "";
}

function hoimiDesc(id) {
  const it = HOIMI_ITEMS.find(function (x) { return x[0] === id; });
  return it ? it[3] || "" : "";
}

function hoimiOff() { return lsGet(HOIMI_OFF_KEY, "0") === "1"; }
function hoimiWorkOff() { return lsGet(HOIMI_WORK_OFF_KEY, "0") === "1"; }

// ---- レベルで増える項目（v1.48.0、CODE_TASK_12）-----------------------------
// レベルの実際の意味として、レベルが上がるとホイミのリストに項目が増える（利用者の発案。
// gcal-excel-app の見た目だけのレベルは続かなかったため）。「元に戻す」でレベルが下がれば、
// その分は無かったことになり、増えた項目もいったん消える（利用者の判断 2026-10-31）

// 全部のレベルで増える項目（l〇〇）を、増える順に
function hoimiLvItems() {
  return HOIMI_ITEMS.filter(function (x) { return x[2] === HOIMI_LV; });
}

// その項目が使えるようになるレベル（増える項目でなければ 0）。i 番目は Lv3＋3×（i÷2 の切り捨て）
function hoimiLvOf(id) {
  const i = hoimiLvItems().findIndex(function (x) { return x[0] === id; });
  return i < 0 ? 0 : HOIMI_LV_FIRST + HOIMI_LV_EVERY * Math.floor(i / HOIMI_LV_PER);
}

// 今のレベル（lv を渡さなければ、経験値から数え直す）で使える「増えた項目」の番号
function hoimiUnlocked(lv) {
  if (lv === undefined) {
    try { lv = hpState().lv; } catch (e) { lv = 1; }
  }
  return hoimiLvItems().filter(function (x) { return hoimiLvOf(x[0]) <= lv; }).map(function (x) { return x[0]; });
}

// 1つの組の項目。増える組は、今使える分だけ
function hoimiItemsOf(kind, open) {
  const all = HOIMI_ITEMS.filter(function (x) { return x[2] === kind; });
  if (kind !== HOIMI_LV) return all;
  open = open || hoimiUnlocked();
  return all.filter(function (x) { return open.indexOf(x[0]) >= 0; });
}

// 今使える項目の数（83＋増えた数）。一覧の見出しと、ふり返りの「今月使った種類」の分母
function hoimiAvailCount(open) {
  return HOIMI_ITEMS.filter(function (x) { return x[2] !== HOIMI_LV; }).length + (open || hoimiUnlocked()).length;
}

// 次に増えるレベルと数（全部そろっていれば null）
function hoimiNextUnlock(lv) {
  const later = hoimiLvItems().map(function (x) { return hoimiLvOf(x[0]); }).filter(function (v) { return v > lv; });
  if (!later.length) return null;
  const next = Math.min.apply(null, later);
  return { lv: next, n: later.filter(function (v) { return v === next; }).length };
}

// ふり返りに小さく出す1行（指示書の例「Lv 9 で あと2つ増えます」）
function hoimiNextUnlockText(lv) {
  const nx = hoimiNextUnlock(lv);
  return nx ? "次は Lv " + nx.lv + " で " + nx.n + "つ 増えます" : "今ある項目は すべて そろいました";
}

function hoimiFreshLoad() {
  try {
    const v = JSON.parse(lsGet(HOIMI_NEW_KEY, "{}") || "{}");
    if (isPlainObject(v) && Array.isArray(v.ids) && typeof v.day === "string") return v;
  } catch (e) { /* 壊れていたら無かったことにする */ }
  return { ids: [], day: "" };
}

// レベルが上がって増えた項目を覚える（hpNotice から）。まだ見せていない分・今日見せている分には足し、
// 前の日に見せた分は入れ替える
function hoimiSetFresh(ids) {
  const cur = hoimiFreshLoad();
  const today = dayKey(Date.now());
  const keep = cur.day === "" || cur.day === today ? cur.ids : [];
  const all = keep.concat(ids.filter(function (id) { return keep.indexOf(id) < 0; }));
  lsSet(HOIMI_NEW_KEY, JSON.stringify({ ids: all, day: cur.day === today ? today : "" }));
}

// ホイミの3〜5つを画面に出したとき：増えた項目をまだ見せていなければ、今日を「初めて見せた日」にする
// （オ：レベルが上がったのが夜や、ホイミを開かなかった日でも見逃さないように。利用者の了承 2026-10-31）
function hoimiSeen() {
  const cur = hoimiFreshLoad();
  if (cur.ids.length && cur.day === "") {
    cur.day = dayKey(Date.now());
    lsSet(HOIMI_NEW_KEY, JSON.stringify(cur));
  }
}

// 今「新しく増えた」として先に出す項目（初めて見せた日のうち・まだ使える・今日まだやっていない）
function hoimiFreshIds(open) {
  const cur = hoimiFreshLoad();
  if (!cur.ids.length || cur.day !== dayKey(Date.now())) return [];
  open = open || hoimiUnlocked();
  const done = hoimiDoneIds();
  return cur.ids.filter(function (id) { return open.indexOf(id) >= 0 && done.indexOf(id) < 0; });
}

// 今出す組。4つ目（職場向け）は設定で止められる。5つ目（レベルで増えた）は、増えた項目が1つ以上あれば出す
function hoimiShownKinds(open) {
  const kinds = hoimiWorkOff() ? HOIMI_KINDS.slice() : HOIMI_KINDS.concat([HOIMI_WORK]);
  return (open || hoimiUnlocked()).length ? kinds.concat([HOIMI_LV]) : kinds;
}

function loadHoimiLog() {
  try {
    const v = JSON.parse(lsGet(HOIMI_LOG_KEY, "[]") || "[]");
    return Array.isArray(v) ? v.filter(function (r) { return Array.isArray(r) && typeof r[0] === "number"; }) : [];
  } catch (e) { return []; }
}

function saveHoimiLog(log) {
  lsSet(HOIMI_LOG_KEY, JSON.stringify(log.slice(-HOIMI_LOG_MAX)));
}

// 日付から決まる乱数（同じ日・同じ回数なら同じ値）。端末に保存できなくても、同じ日は同じ項目になる
function hoimiSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

// 1つの組の中から1つ選ぶ。最後にやってから日が空いた項目ほど選ばれやすくする
// （コーピングアプリの「ふと、これは？」と同じ考え方）。重み＝空いた日数＋1。
// まだ一度もやっていない項目は、十分に久しぶりの項目と同じ扱い。きょう出した項目（skip）は避ける。
// 5つ目（レベルで増えた）は、今使える分から選び、「新しく増えた」項目があればそれを先に出す（v1.48.0）
function hoimiPick(seed, skip, kind, open) {
  if (kind === HOIMI_LV) {
    const fresh = hoimiFreshIds(open).filter(function (id) { return skip.indexOf(id) < 0; });
    if (fresh.length) return fresh[0];
  }
  const last = {};
  loadHoimiLog().forEach(function (r) { last[r[1]] = Math.max(last[r[1]] || 0, r[0]); });
  const all = hoimiItemsOf(kind, open);
  let cands = all.filter(function (x) { return skip.indexOf(x[0]) < 0; });
  if (!cands.length) cands = all;
  const now = Date.now();
  const w = cands.map(function (x) {
    const t = last[x[0]];
    const waited = t ? Math.floor((now - t) / 86400000) : HOIMI_WAIT_MAX;
    return Math.min(Math.max(waited, 0), HOIMI_WAIT_MAX) + 1;
  });
  let r = hoimiSeed(seed) * w.reduce(function (s, v) { return s + v; }, 0);
  for (let i = 0; i < cands.length; i++) {
    r -= w[i];
    if (r < 0) return cands[i][0];
  }
  return cands[cands.length - 1][0];
}

// 組ごとに1つずつ選ぶ（組の順に並べる）。種は組ごとなので、4つ目・5つ目を足しても前の3つは変わらない
function hoimiPickSet(day, skip, kinds, open) {
  return kinds.map(function (k) { return hoimiPick(day + "#" + skip.length + "#" + k, skip, k, open); });
}

// 今日出す3〜5つ。日が替わったら選び直し、同じ日のうちは開き直しても同じにする
function hoimiToday() {
  const day = dayKey(Date.now());
  const open = hoimiUnlocked();
  const kinds = hoimiShownKinds(open);
  let st = {};
  try { st = JSON.parse(lsGet(HOIMI_KEY, "{}") || "{}") || {}; } catch (e) { st = {}; }
  const ok = st.day === day && Array.isArray(st.skip) && Array.isArray(st.ids)
    && st.ids.length >= HOIMI_KINDS.length && st.ids.length <= HOIMI_ALL_KINDS.length
    && HOIMI_KINDS.every(function (k, i) { return hoimiKind(st.ids[i]) === k; });
  if (!ok) {
    st = { day: day, ids: hoimiPickSet(day, [], kinds, open), skip: [] };
    lsSet(HOIMI_KEY, JSON.stringify(st));
    return st;
  }
  // 4つ目・5つ目は、今の3つをそのままにして後ろだけ合わせる。4つ目の出す・出さないを切り替えたとき、
  // レベルが上がって5つ目が出せるようになったとき・増えた項目があるとき、元に戻してレベルが下がったとき
  const rest = kinds.slice(HOIMI_KINDS.length);
  const have = st.ids.slice(HOIMI_KINDS.length);
  const usable = function (id, k) { return hoimiKind(id) === k && (k !== HOIMI_LV || open.indexOf(id) >= 0); };
  const skip = st.skip.concat(hoimiDoneIds());
  // 「新しく増えた」項目は、［ほかの○つにする］で飛ばされていなければ5つ目に先に出す
  const fresh = hoimiFreshIds(open).filter(function (id) { return st.skip.indexOf(id) < 0; });
  const ids = rest.map(function (k) {
    const keep = have.filter(function (id) { return usable(id, k); })[0];
    if (k === HOIMI_LV && fresh.length && fresh.indexOf(keep) < 0) return fresh[0];
    return keep || hoimiPick(day + "#" + skip.length + "#" + k, skip, k, open);
  });
  if (ids.join() !== have.join()) {
    st.ids = st.ids.slice(0, HOIMI_KINDS.length).concat(ids);
    lsSet(HOIMI_KEY, JSON.stringify(st));
  }
  return st;
}

// 今日［できた］を押した項目の番号（同じ項目は1つにまとめる）
function hoimiDoneIds() {
  const day = dayKey(Date.now());
  const ids = [];
  loadHoimiLog().forEach(function (r) {
    if (dayKey(r[0]) === day && ids.indexOf(r[1]) < 0) ids.push(r[1]);
  });
  return ids;
}

// 今日［できた］を押した回数
function hoimiCountToday() {
  const day = dayKey(Date.now());
  return loadHoimiLog().filter(function (r) { return dayKey(r[0]) === day; }).length;
}

// ［ほかの3つにする］と［できた］のあと：いま出している3つを避けて選び直す。
// 今日やった項目も避ける（v1.46.0。何回でもできるので、2回目以降は「まだやっていないもの」から）。
// ある組を出し切ったら、その組だけ最初から（いま出している項目は続けて出さない。今日やった項目はそれでも避ける）
function hoimiNext() {
  const st = hoimiToday();
  const done = hoimiDoneIds();
  const open = hoimiUnlocked();
  const kinds = hoimiShownKinds(open);
  st.skip = st.skip.concat(st.ids);
  kinds.forEach(function (k, i) {
    const all = hoimiItemsOf(k, open).map(function (x) { return x[0]; });
    const left = all.filter(function (id) { return st.skip.indexOf(id) < 0 && done.indexOf(id) < 0; });
    if (!left.length) {
      st.skip = st.skip.filter(function (id) { return all.indexOf(id) < 0 || id === st.ids[i]; });
    }
  });
  st.ids = hoimiPickSet(st.day, st.skip.concat(done), kinds, open);
  lsSet(HOIMI_KEY, JSON.stringify(st));
  return st;
}

// ［できた］のあとの言葉。これまでの回数で順に回す（取り消すと回数が戻るので、次も同じ言葉になる）
function hoimiMsg() {
  const n = loadHoimiLog().length;
  return HOIMI_MSGS[(Math.max(n, 1) - 1) % HOIMI_MSGS.length];
}

// ［できた］（今の3つ・一覧のどちらからでも）：記録に1件足す。
// 今の3つに入っている項目なら、すぐ次の3つにする（利用者の依頼 10/30「1回できたら2回目を提案してほしい」）。
// 戻す手順を返す。戻すと、足した1件を消し、入れ替える前の3つに戻す。
// HP と経験値はこの記録から数え直すので、戻せば HP と経験値も戻る
function hoimiDone(id) {
  const st = hoimiToday();
  const before = JSON.stringify(st);
  const row = [Date.now(), id];
  const log = loadHoimiLog();
  log.push(row);
  saveHoimiLog(log);
  if (st.ids.indexOf(id) >= 0) hoimiNext();
  return function () {
    saveHoimiLog(loadHoimiLog().filter(function (r) { return !(r[0] === row[0] && r[1] === row[1]); }));
    lsSet(HOIMI_KEY, before);
  };
}

// 名前と、その下の小さな説明（今の3つ・一覧で同じ形）
function hoimiNameHTML(id) {
  const d = hoimiDesc(id);
  return '<span class="hname">' + esc(hoimiName(id))
    + (d ? '<small class="hdesc">' + esc(d) + "</small>" : "") + "</span>";
}

// 3〜5つを並べた枠。inView … ホイミの画面の中（見出しを「今の○つ」に、一覧への入口は出さない）。
// 新着を全部確認したときの枠はニュースより目立たせず、下に一覧・ふり返りへの入口を置く。
// ［できた］は緑で塗り、［ほかの○つにする］は枠だけにして下に離す（押し間違えないように。CODE_TASK_11 ②）
function hoimiCard(inView) {
  if (!inView && hoimiOff()) return "";
  try {
    hoimiSeen();   // 増えた項目を初めて見せる日を決める（v1.48.0）
    const st = hoimiToday();
    const n = hoimiCountToday();
    const k = st.ids.length;
    const fresh = hoimiFreshIds();
    return '<div class="hoimi' + (inView ? " hview" : "") + '">'
      + '<div class="hlabel"><span>' + (inView ? "今の" + k + "つ" : "ホイミ（1〜2分）") + "　どれか1つ</span>"
      + (n ? '<span class="hn">今日 ' + n + "回</span>" : "") + "</div>"
      + (!inView && !hpOff() ? '<div class="hpline">' + hpGauge() + "</div>" : "")
      + st.ids.map(function (id) {
        // 4つ目（職場向け）・5つ目（レベルで増えた）は色を変えて、前の3つと区別する（CODE_TASK_11 ⑥・CODE_TASK_12）
        const kind = hoimiKind(id);
        const cls = kind === HOIMI_WORK ? " work" : kind === HOIMI_LV ? " lv" : "";
        const tag = kind === HOIMI_WORK ? '<span class="wtag">職場向け</span>'
          : kind === HOIMI_LV ? '<span class="ltag">' + (fresh.indexOf(id) >= 0
            ? "✨ 新しく増えた（Lv " + hoimiLvOf(id) + "）" : "レベルで増えた") + "</span>"
          : "";
        return '<div class="hrow' + cls + '">'
          + tag + hoimiNameHTML(id)
          + '<button class="hbtn go" type="button" data-hoimi-done="' + esc(id) + '">できた</button></div>';
      }).join("")
      + '<div class="hbtns"><button class="hbtn" type="button" id="hoimi-next">↻ ほかの' + k + "つにする</button>"
      + (inView ? "" : '<button class="hbtn" type="button" id="hoimi-open">一覧・ふり返り →</button>')
      + "</div></div>";
  } catch (e) { return ""; }   // 何かあっても、新着の画面は壊さない
}

// 新着が残っているときに「⚡ 今日の新着」の上に出す1行（v1.45.1）。押すとホイミの画面に移る（v1.46.0）。
// 新着を全部見るのは時間がかかり、見終わったときだけでは出る日が少ないため（利用者の指摘 2026-10-30）。
// v1.47.0 から HP のゲージとレベルを並べる。ゲージが橙・赤になっても、呼びかけの文は出さず、
// この1行がそのままホイミの入口になる（CODE_TASK_11 ④）。幅に収めるため「1〜2分のひと休み」は外した
// （HP の表示を切ると元の1行に戻る）。
// 新着が0件のときは呼ばない（「確認しました」の下に3つが出る）
function hoimiLine() {
  if (hoimiOff()) return "";
  try {
    return '<button class="hoimi hfold" type="button" id="hoimi-open">'
      + '<span class="hlabel">▸ ホイミ</span>'
      + (hpOff() ? "<span>1〜2分のひと休み</span>" : hpGauge())
      + '<span class="hn">今日 ' + hoimiCountToday() + "回</span></button>";
  } catch (e) { return ""; }
}

// ---- HP と経験値（v1.47.0、CODE_TASK_11 ④）---------------------------------
// 利用者の発案「ニュースを読むとHPが減る代わりに経験値が入る。ホイミでHPが回復する」。
// 読むと少し疲れ、ホイミで回復する流れを、ゲージの色で見せる（呼びかけの文は出さない）。
// 減って責められる作りは入れない：HP は 10 より下がらず、0 で何かが終わることもない。
// 休んだ日があっても何も減らない。レベルは休んでも下がらない（ホイミを「元に戻す」と、その分は無かったことに
// なってレベルも戻る。v1.48.0 で利用者が了承「Lv2 に戻していい。なかったことになっているので」）。
// gcal-excel-app の「実績・レベル」（v1.12.0 で廃止）からの教訓：あちらは一度きりの実績でレベルが上がり、
// 最初に一気に上がって止まった。こちらは毎日くり返す行動（読む・見終える・ホイミ）だけから経験値が入る。
//
// 今日の HP と経験値は、すでにある記録から毎回数え直す：
//   読み方の記録（READLOG）の「開いた」 … 記事・動画のリンクを押した回数（どの画面でも）
//   読み方の記録の、開かずに既読にした行 … 払う・✓片づけなど（HP だけ。v1.49.0）
//   記事から戻るまでの時間（mynews_hp_away）… 長く読んだ分（HP だけ。v1.49.0）
//   ホイミの記録（mynews_hoimi_log）    … ［できた］の回数と、今月はじめての種類か
//   見終えるまでの時間（mynews_donetime）… その日の新着を見終えたか
// こうすると「元に戻す」や記録の読み込みのあとも数字が食い違わない。
// 端末に新しく残すのは、前の日までの経験値の合計と、最後に知らせたレベルだけ（mynews_hp）。
const HP_KEY = "mynews_hp";          // { day: "2026-10-31"（この日より前の分は xp に足し込み済み）, xp: その合計, lv: 最後に知らせたレベル }
const HP_OFF_KEY = "mynews_hp_off";  // "1" なら HP・経験値を出さない（既定は出す。出さない間も経験値は数える）
const HP_AWAY_KEY = "mynews_hp_away"; // [[記事を開いた時刻, マイニュースに戻った時刻], …]（今日開いた分だけ。v1.49.0）
// 数字は1か所にまとめる（後で調整しやすいように。初期値は指示書のとおり）
const HP_RULE = {
  max: 100,         // 日付が変わった最初の表示で、ここに戻る
  min: 10,          // これより下がらない
  open: 3,          // 記事を1本開くと減る
  // 開かずに既読にしても、見出しを見てニュースを浴びたことに変わりはないので少し減らす（CODE_TASK_13 ①）。
  // 1日の上限は、新着77本を全部片づけた日に毎日下限に張りつき、色の変化に意味がなくなるのを防ぐため
  clear: 1,         // 払う・✓片づけ・ここまで見た・選んで既読・👎・全部片づけ・発掘の片づけ 1本につき減る
  clearMax: 30,     // 片づけで減る分の1日の上限（記事を開いた分・長く読んだ分はここに数えない）
  // 本文を取っていないので記事の長さは分からない。開いてから戻るまでの時間を、読んだ長さとみなす（CODE_TASK_13 ②）
  readMin: 1,       // 戻るまでの1分ごとに、開いたときの分に足して減る
  readMax: 10,      // 開いたときの分と合わせた、1本あたりの上限（開いたまま別のアプリにいた時間を数えすぎないため）
  readAwayMax: 30,  // これ以上（分）離れていたら読んでいたとはみなさず、開いたときの分だけにする
  hoimi: 15,        // ホイミの［できた］で増える
  mid: 50,          // これ以下で橙
  low: 25,          // これ以下で赤
  xpOpen: 2,        // 記事を開く（1日 xpOpenMax 本まで）
  xpOpenMax: 20,
  xpDone: 10,       // その日の新着を見終えた（1日1回）
  xpHoimi: 5,       // ホイミの［できた］（1日 xpHoimiMax 回まで）
  xpHoimiMax: 10,
  xpNewKind: 10,    // 今月はじめてやる種類のホイミ（月が変わると数え直す）
  lvBase: 100,      // 次のレベルまでに要る経験値＝lvBase＋lvStep×（いまのレベル−1）
  // 指示書の初期値は 20。60日の試しで、ふつうの日（記事10本・見終える・ホイミ3回）の経験値が見込みの45でなく
  // 約66になり（今月はじめての種類の＋10が3回のうち平均2回付く）、レベルが見込みの1.5倍ほど早かったので 30 にした
  // （利用者の決定 2026-10-31。Lv10 が約30日・Lv20 が約3.5か月・Lv30 が約7.5か月）
  lvStep: 30,
  lvMax: 99,
};

function hpOff() { return lsGet(HP_OFF_KEY, "0") === "1"; }

function hpLoad() {
  try {
    const v = JSON.parse(lsGet(HP_KEY, "{}") || "{}");
    return isPlainObject(v) ? v : {};
  } catch (e) { return {}; }
}

// 日ごとの経験値（from 以上 to 未満の日。日は "2026-10-31" の形で比べる）
function hpXpByDay(from, to) {
  const opens = {}, hoimi = {}, out = {};
  READLOG.forEach(function (r) {
    if (r[1] !== "open" || typeof r[0] !== "number") return;
    const d = dayKey(r[0]);
    if (d >= from && d < to) opens[d] = (opens[d] || 0) + 1;
  });
  // 「今月はじめての種類」は、月と項目の組で最初の記録かどうか。月の初めから見る必要があるので全部を時刻順に
  const first = {};
  loadHoimiLog().slice().sort(function (a, b) { return a[0] - b[0]; }).forEach(function (r) {
    const d = dayKey(r[0]);
    const mk = d.slice(0, 7) + "#" + r[1];
    const isNew = !!hoimiName(r[1]) && !first[mk];   // 一覧に無い番号は回数だけ（ふり返りと同じ扱い）
    first[mk] = true;
    if (d >= from && d < to) {
      const h = hoimi[d] = hoimi[d] || { n: 0, fresh: 0 };
      h.n += 1;
      if (isNew) h.fresh += 1;
    }
  });
  const done = loadDoneTime();
  const days = {};
  [opens, hoimi, done].forEach(function (o) { Object.keys(o).forEach(function (d) { if (d >= from && d < to) days[d] = true; }); });
  Object.keys(days).forEach(function (d) {
    const h = hoimi[d] || { n: 0, fresh: 0 };
    out[d] = Math.min(opens[d] || 0, HP_RULE.xpOpenMax) * HP_RULE.xpOpen
      + (Array.isArray(done[d]) && done[d][1] ? HP_RULE.xpDone : 0)
      + Math.min(h.n, HP_RULE.xpHoimiMax) * HP_RULE.xpHoimi
      + h.fresh * HP_RULE.xpNewKind;
  });
  return out;
}

// 開かずに既読にした操作（読み方の記録の2つ目。HOW_LABEL の名前）。
// 「すべて既読」（all）は入れない：画面に入口が無く、何件片づけても記録が1行しか残らないため
const HP_CLEAR_HOW = { swipe: 1, tidy: 1, seen: 1, found: 1, tidyall: 1, foundall: 1, pick: 1, boring: 1 };

function loadHpAway() {
  try {
    const v = JSON.parse(lsGet(HP_AWAY_KEY, "[]") || "[]");
    return Array.isArray(v) ? v.filter(function (r) {
      return Array.isArray(r) && typeof r[0] === "number" && typeof r[1] === "number" && r[1] > r[0];
    }) : [];
  } catch (e) { return []; }
}

// 記事を開いてから戻るまで ms ミリ秒だったときに、開いたときの分に足して減る数
function hpReadExtra(ms) {
  const min = Math.floor(ms / 60000);
  if (!(min >= 1) || min >= HP_RULE.readAwayMax) return 0;
  return Math.min(min * HP_RULE.readMin, HP_RULE.readMax - HP_RULE.open);
}

// 記事のリンクを押した時刻を覚える。スマホが戻ったときにページを読み込み直しても測れるように、
// ページを開いている間だけ覚える場所（sessionStorage）に置く。続けて開いたら新しいほうで上書きする
function hpAwayStart() {
  ssSave({ hpOpenAt: Date.now() });
}

// マイニュースの画面に戻ったら（表に出た・読み込み直した）、離れていた時間を記録に足す。
// 減る数は hpToday で記録から数え直すので、ここでは時刻だけ残す（数字を変えても記録はそのまま使える）
function hpAwayEnd() {
  try {
    const at = Number(ssGet().hpOpenAt) || 0;
    if (!at) return;
    ssSave({ hpOpenAt: 0 });
    const now = Date.now();
    const today = dayKey(now);
    // 前の日に開いた分は前の日の HP に入るが、前の日の HP はもう出さないので残さない
    if (!(now > at) || dayKey(at) !== today) return;
    const rec = loadHpAway().filter(function (r) { return dayKey(r[0]) === today; });
    rec.push([at, now]);
    lsSet(HP_AWAY_KEY, JSON.stringify(rec));
  } catch (e) { /* 測れなくても、開いたときの分は減っている */ }
}

// 今日の HP。今日の「開いた」（−3）・長く読んだ分・開かずに既読（−1、1日30まで）と
// ［できた］（＋15）を時刻順に当て、上下の端で止める
function hpToday(now) {
  const day = dayKey(now);
  const ev = [];
  READLOG.forEach(function (r) {
    if (typeof r[0] !== "number" || dayKey(r[0]) !== day) return;
    if (r[1] === "open") ev.push([r[0], -HP_RULE.open]);
    else if (HP_CLEAR_HOW[r[1]]) ev.push([r[0], -HP_RULE.clear, true]);
  });
  // 長く読んだ分は、記事を開いた時刻に置く（開いた日の HP に入る）
  loadHpAway().forEach(function (r) {
    const x = hpReadExtra(r[1] - r[0]);
    if (x && dayKey(r[0]) === day) ev.push([r[0], -x]);
  });
  loadHoimiLog().forEach(function (r) { if (dayKey(r[0]) === day) ev.push([r[0], HP_RULE.hoimi]); });
  ev.sort(function (a, b) { return a[0] - b[0]; });
  let hp = HP_RULE.max, cleared = 0;
  ev.forEach(function (e) {
    let d = e[1];
    if (e[2]) {   // 片づけの分：その日の最初の clearMax ぶんまで
      d = -Math.min(-d, Math.max(0, HP_RULE.clearMax - cleared));
      cleared -= d;
    }
    hp = Math.min(HP_RULE.max, Math.max(HP_RULE.min, hp + d));
  });
  return hp;
}

// 経験値の合計からレベルを出す。lv … レベル、into … 今のレベルに入ってからの経験値、need … 次までに要る分
function hpLevel(xp) {
  let lv = 1, rest = xp, need = HP_RULE.lvBase;
  while (lv < HP_RULE.lvMax && rest >= need) {
    rest -= need;
    lv += 1;
    need = HP_RULE.lvBase + HP_RULE.lvStep * (lv - 1);
  }
  return { lv: lv, into: rest, need: lv < HP_RULE.lvMax ? need : 0 };
}

// 今の HP・経験値・レベル。日付が変わっていたら、前の日までの分を合計に足し込む。
// 初めて開いた日は、その日から数える（前の日までの記録はさかのぼらない＝初日にレベルが一気に上がらないように）
function hpState() {
  const now = Date.now();
  const today = dayKey(now);
  let st = hpLoad();
  if (typeof st.day !== "string" || !/^\d{4}-\d\d-\d\d$/.test(st.day) || typeof st.xp !== "number" || !(st.xp >= 0)) {
    st = { day: today, xp: 0, lv: 1 };
    lsSet(HP_KEY, JSON.stringify(st));
  } else if (st.day < today) {
    const byDay = hpXpByDay(st.day, today);
    st.xp += Object.keys(byDay).reduce(function (s, d) { return s + byDay[d]; }, 0);
    st.day = today;
    lsSet(HP_KEY, JSON.stringify(st));
  }
  const todayXp = hpXpByDay(today, today + "~")[today] || 0;   // "~" は数字より後ろに並ぶので、今日の分だけになる
  const xp = st.xp + todayXp;
  const lv = hpLevel(xp);
  return { hp: hpToday(now), xp: xp, todayXp: todayXp, lv: lv.lv, into: lv.into, need: lv.need, shown: Number(st.lv) || 1 };
}

// ゲージの色の名前（51以上はふつう・26〜50 は橙・25以下は赤。ドラゴンクエストと同じく色だけで見せる）
function hpTone(hp) {
  return hp <= HP_RULE.low ? "low" : hp <= HP_RULE.mid ? "mid" : "ok";
}

// 「HP 72/100」と棒とレベル。朝刊の1行・新着0件の枠・ホイミの画面で使う
function hpGauge(s) {
  try {
    s = s || hpState();
    return '<span class="hpg ' + hpTone(s.hp) + '">'
      + '<span class="hpn">HP ' + s.hp + "/" + HP_RULE.max + "</span>"
      + '<span class="hpbar"><i style="width:' + Math.round(s.hp / HP_RULE.max * 100) + '%"></i></span>'
      + '<span class="hplv">Lv ' + s.lv + "</span></span>";
  } catch (e) { return ""; }
}

// 描き直さずにゲージの数字だけ書き換える（記事を開いたとき。戻ったときに減っているのが分かるように）
function hpPaint() {
  if (hpOff()) return;
  try {
    const html = hpGauge();
    [].slice.call(document.querySelectorAll(".hpg")).forEach(function (el) { el.outerHTML = html; });
  } catch (e) { /* 書き換えられなくても、次に描き直したときに直る */ }
}

// レベルが上がっていたら1回だけ「レベルが あがった！」と出し、ゲージを少し光らせる（音は出さない）。
// ホイミのリストに項目が増えたときは「ホイミに ○つ くわわった！」も足す（v1.48.0。ホイミはリスト全体の
// 愛称なので、増えるのは「ホイミ」ではなくリストの中身）。
// 「元に戻す」の知らせが出ているときは、その文に足す（上書きすると戻せなくなるため）。
// 同じレベルには二度知らせない。ただし「元に戻す」でレベルが下がったときは、知らせた記録も戻し、
// もう一度上がったらまた知らせる（元に戻した分は無かったことにする。利用者の判断 2026-10-31）。
// HP・経験値を出さない設定のときは、知らせずに覚えだけ進める（項目は増える）
function hpNotice() {
  hpShow(hpSync());
}

// 知らせたレベルを今のレベルに合わせ、上がっていれば知らせる文を返す（知らせる必要が無ければ ""）。
// 増えた項目もここで覚えるので、描き直す前に呼ぶと、その描き直しから5つ目に「新しく増えた」が出る
function hpSync() {
  try {
    const s = hpState();
    if (s.lv === s.shown) return "";
    const st = hpLoad();
    st.lv = s.lv;
    lsSet(HP_KEY, JSON.stringify(st));
    if (s.lv < s.shown) return "";
    const before = hoimiUnlocked(s.shown);
    const added = hoimiUnlocked(s.lv).filter(function (id) { return before.indexOf(id) < 0; });
    if (added.length) hoimiSetFresh(added);
    if (hpOff()) return "";
    return "レベルが あがった！（Lv " + s.lv + "）"
      + (added.length ? "　ホイミに " + added.length + "つ くわわった！" : "");
  } catch (e) { return ""; }
}

// hpSync の文を出し、ゲージを光らせる（描き直した後に呼ぶ）
function hpShow(msg) {
  if (!msg) return;
  try {
    if (UNDO_STACK.length) {
      UNDO_STACK[UNDO_STACK.length - 1].msg += "　" + msg;
      showToast();
    } else {
      toast(msg);
    }
    [].slice.call(document.querySelectorAll(".hpg")).forEach(function (el) { el.classList.add("lvup"); });
  } catch (e) { /* 知らせられなくても続ける */ }
}

// ふり返りの数字。GCal→Excel 変換ツールの振り返り（月ごとのまとめと推移）にならう。
// 「今月使った種類」は『超ストレス解消法』の「コーピングは量（種類の多さ）が大事」を数字で見るため
function hoimiStats(now) {
  const monthOf = function (ms) { const d = new Date(ms); return d.getFullYear() * 12 + d.getMonth(); };
  const thisMonth = monthOf(now);
  const s = {
    today: 0, week: 0, weekDays: 0, month: 0, prev: 0, kinds: 0, total: 0,
    byKind: { body: 0, sense: 0, mind: 0, work: 0, lvup: 0 }, days: [], months: [], top: [],
  };
  const weekDays = {}, used = {}, perMonth = {}, freq = {}, perDay = [0, 0, 0, 0, 0, 0, 0];
  loadHoimiLog().forEach(function (r) {
    const d = calDays(r[0], now);
    if (d < 0) return;   // 端末の時計を戻したときの未来の記録は数えない
    s.total += 1;
    if (d === 0) s.today += 1;
    if (d < 7) { s.week += 1; weekDays[dayKey(r[0])] = true; perDay[d] += 1; }
    const m = monthOf(r[0]);
    const kind = hoimiKind(r[1]);   // 一覧に無い項目の記録は、回数にだけ数える
    if (m === thisMonth) {
      s.month += 1;
      if (kind) { s.byKind[kind] += 1; used[r[1]] = true; }
    }
    if (m === thisMonth - 1) s.prev += 1;
    if (m > thisMonth - HOIMI_MONTHS) {
      perMonth[m] = (perMonth[m] || 0) + 1;
      if (kind) freq[r[1]] = (freq[r[1]] || 0) + 1;
    }
  });
  s.weekDays = Object.keys(weekDays).length;
  s.kinds = Object.keys(used).length;
  // 直近7日（古い日から今日へ）。日付は暦で数える（夜の分が翌朝「今日」にならないように）
  const t = new Date(now);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - i);
    s.days.push({ label: i ? (d.getMonth() + 1) + "/" + d.getDate() : "今日", n: perDay[i], now: !i });
  }
  for (let m = thisMonth - HOIMI_MONTHS + 1; m <= thisMonth; m++) {
    s.months.push({ label: (m % 12 + 1) + "月", n: perMonth[m] || 0, now: m === thisMonth });
  }
  // よく使う5つ（この6か月）。同じ回数なら一覧の順
  s.top = HOIMI_ITEMS.filter(function (x) { return freq[x[0]]; })
    .map(function (x, i) { return { id: x[0], n: freq[x[0]], i: i }; })
    .sort(function (a, b) { return b.n - a.n || a.i - b.i; })
    .slice(0, 5);
  return s;
}

// 縦の棒グラフ（直近7日・月ごと）。外部のライブラリは使わず、CSS の高さで描く（CODE_TASK_11 ⑤）。
// 回数は棒の上に小さく。今日・今月の棒と文字は濃くする。0回の日は棒を描かず「0」だけ
function hoimiCols(rows, label) {
  const max = Math.max.apply(null, rows.map(function (r) { return r.n; }).concat([1]));
  return '<div class="hcols" role="img" aria-label="' + esc(label + "：" + rows.map(function (r) {
    return r.label + " " + r.n + "回";
  }).join("、")) + '">'
    + rows.map(function (r) {
      // 棒の高さは一番多い日（月）を72pxとして比べる。回数は棒のすぐ上に乗る
      return '<div class="hcol' + (r.now ? " now" : "") + '"><span class="cb">'
        + '<span class="cv">' + r.n + "</span>"
        + (r.n ? '<i style="height:' + Math.max(4, Math.round(r.n / max * 72)) + 'px"></i>' : "")
        + '</span><span class="cl">' + r.label + "</span></div>";
    }).join("") + "</div>";
}

// 今月の組ごとの回数。1本の横棒を組の色で分け、下に色の見本と回数を並べる（偏りがひと目で分かるように）。
// 「レベルで増えた」は、まだ1つも増えていなければ見本も出さない（v1.48.0）
function hoimiKindBar(s) {
  if (!s.month) return '<div class="note">今月はまだありません。</div>';
  const kinds = HOIMI_ALL_KINDS.filter(function (k) { return k !== HOIMI_LV || s.byKind[k] || hoimiUnlocked().length; });
  const known = kinds.reduce(function (t, k) { return t + s.byKind[k]; }, 0);
  return '<div class="hstack" role="img" aria-label="' + esc("今月の組ごとの回数：" + kinds.map(function (k) {
    return HOIMI_KIND_LABEL[k] + " " + s.byKind[k] + "回";
  }).join("、")) + '">'
    + kinds.filter(function (k) { return s.byKind[k]; }).map(function (k) {
      return '<i class="k-' + k + '" style="flex-grow:' + s.byKind[k] + '"></i>';
    }).join("") + "</div>"
    + '<div class="hkeys">' + kinds.map(function (k) {
      const pct = known ? Math.round(s.byKind[k] / known * 100) : 0;
      return '<span class="hkey"><i class="sw k-' + k + '"></i>' + HOIMI_KIND_LABEL[k]
        + " <b>" + s.byKind[k] + "</b>回<small>（" + pct + "%）</small></span>";
    }).join("") + "</div>";
}

// ホイミの画面の中ほど：ふり返り（v1.47.0 で、数字の枠をグラフに置き換えた）。
// 上にレベル・経験値・今月使った種類をまとめ、その下に直近7日・月ごとの棒、組ごとの色分けの横棒、よく使う5つ
function hoimiReview(s) {
  let h = '<section class="hsec"><h2>ふり返り</h2><div class="hsum">';
  const p = hpState();
  if (!hpOff()) {
    h += '<div class="hlv"><b>Lv ' + p.lv + "</b>"
      + "<span>経験値 " + p.xp.toLocaleString("ja-JP")
      + (p.need ? "（次のレベルまで あと " + (p.need - p.into) + "）" : "") + "</span></div>"
      + (p.need ? '<span class="hxp"><i style="width:' + Math.round(p.into / p.need * 100) + '%"></i></span>' : "");
  }
  // 分母は今使える数（83＋レベルで増えた数。利用者の判断 2026-10-31「増やさないとおかしい」）
  h += '<div class="hkinds">今月使った種類　<b>' + s.kinds + "</b> / " + hoimiAvailCount(hoimiUnlocked(p.lv)) + "</div>"
    + (hpOff() ? "" : '<div class="hnext">' + hoimiNextUnlockText(p.lv) + "</div>") + "</div>";
  if (!s.total) {
    return h + '<div class="note">［できた］を押すと、ここに回数がたまります。</div></section>';
  }
  h += "<h3>この7日　" + s.week + "回（" + s.weekDays + "日）</h3>" + hoimiCols(s.days, "この7日の回数")
    + "<h3>月ごとの回数　今月 " + s.month + "回・先月 " + s.prev + "回</h3>" + hoimiCols(s.months, "月ごとの回数")
    + "<h3>今月の組ごと</h3>" + hoimiKindBar(s);
  if (s.top.length) {
    h += "<h3>よく使う5つ（この" + HOIMI_MONTHS + "か月）</h3><ol class=\"htop\">"
      + s.top.map(function (t) {
        return "<li><span>" + esc(hoimiName(t.id)) + "</span><b>" + t.n + "回</b></li>";
      }).join("") + "</ol>";
  }
  return h + "</section>";
}

// 一覧の右に出す「最後にやった日」。最近やっていないものほど目に入るように、10日以上空いたら✨
function hoimiAgo(t, now) {
  if (!t) return { text: "まだ", cls: "never" };
  const d = calDays(t, now);
  if (d <= 0) return { text: "今日", cls: "today" };
  if (d === 1) return { text: "昨日", cls: "" };
  if (d >= HOIMI_RARE_DAYS) return { text: d + "日ぶり✨", cls: "rare" };
  return { text: d + "日前", cls: "" };
}

// ホイミの画面の下：全部の項目を組ごとに。並びは毎回同じ（居場所が変わらないように）。
// v1.47.0 から、行を押すとその行の中に［できた］が出るだけ（もう一度押すと閉じる）。記録は［できた］のときだけ。
// スクロールのつもりで触れて記録されてしまうことがあったため（CODE_TASK_11 ①）
function hoimiList(now) {
  const last = {};
  loadHoimiLog().forEach(function (r) { last[r[1]] = Math.max(last[r[1]] || 0, r[0]); });
  const lv = hpState().lv;
  const unlocked = hoimiUnlocked(lv);
  let h = '<section class="hsec hlist"><h2>一覧（' + hoimiAvailCount(unlocked) + "）</h2>"
    + '<div class="note">行を押すと［できた］が出ます。［できた］を押すと記録します（' + UNDO_SEC + "秒は元に戻せます）。"
    + "右は最後にやった日です。</div>";
  HOIMI_ALL_KINDS.forEach(function (k) {
    // レベルで増えた組は、今使える分だけ並べる（まだのものは出さない）。0個のときは次に増えるレベルを書く
    const items = hoimiItemsOf(k, unlocked);
    const cls = k === HOIMI_WORK ? "work" : k === HOIMI_LV ? "lv" : "";
    h += '<h3 class="' + cls + '">' + HOIMI_KIND_LABEL[k] + "（" + items.length + "）</h3>"
      + (k === HOIMI_LV && !items.length && !hpOff() ? '<div class="note">' + hoimiNextUnlockText(lv) + "</div>" : "")
      + items.map(function (x) {
        const a = hoimiAgo(last[x[0]], now);
        const open = HOIMI_PICKED === x[0];
        return '<div class="hitem' + (open ? " open" : "") + (cls ? " " + cls : "") + '">'
          + '<button class="hhead" type="button" data-hoimi-pick="' + esc(x[0]) + '" aria-expanded="' + open + '">'
          + hoimiNameHTML(x[0])
          + '<span class="hago' + (a.cls ? " " + a.cls : "") + '">' + a.text + "</span></button>"
          + (open ? '<div class="hact"><button class="hbtn go" type="button" data-hoimi-done="' + esc(x[0]) + '">できた</button></div>' : "")
          + "</div>";
      }).join("");
  });
  return h + "</section>";
}

// ホイミの画面（v1.46.0）。上＝今の3つ、中＝ふり返り、下＝一覧。
// 発掘画面などと同じく、上の［← 戻る］で元の画面へ（スマホの戻るボタンでは戻らない）。
// v1.47.0 から、［← 戻る］の横に HP のゲージとレベル（［できた］で回復するのが見えるように）
function renderHoimiView(data) {
  const now = Date.now();
  APP.innerHTML = "<header><h1>🌿 ホイミ</h1>"
    + '<div class="meta-head">'
    + '<button class="newcount on" type="button" id="hoimi-back">← 戻る</button>'
    + (hpOff() ? '<span class="unread">1〜2分のひと休み</span>' : hpGauge()) + "</div></header>"
    + hoimiCard(true)
    + hoimiReview(hoimiStats(now))
    + hoimiList(now);
}

// 設定の段：ホイミの出す・出さないの切り替えと、この7日の回数・日数。
// その下に、HP・経験値と4つ目（職場向け）の出す・出さない（v1.47.0）
function hoimiRow() {
  const off = hoimiOff();
  const log = loadHoimiLog();
  const now = Date.now();
  const days = {};
  let n = 0;
  log.forEach(function (r) {
    const d = calDays(r[0], now);
    if (d >= 0 && d < 7) { n += 1; days[dayKey(r[0])] = true; }
  });
  const known = log.filter(function (r) { return hoimiName(r[1]); });   // 一覧に無い項目の記録は名前を出せない
  const last = known.length ? known[known.length - 1] : null;
  return '<div class="srow"><span>ホイミ（1〜2分のひと休み）'
    + "<small>この7日で " + n + "回（" + Object.keys(days).length + "日）"
    + (last ? "（最後は" + dayLabel(last[0]) + "：" + esc(hoimiName(last[1])) + "）" : "") + "</small></span>"
    + '<button class="tool-btn' + (off ? "" : " on") + '" type="button" id="toggle-hoimi">'
    + (off ? "出さない" : "出す") + "</button></div>"
    + toggleRow("ホイミの HP・経験値", "出さない間も経験値は数えています", "toggle-hp", !hpOff())
    + toggleRow("ホイミの4つ目（職場向け）", "一覧の「職場向け」は出さないときも残ります", "toggle-hoimi-work", !hoimiWorkOff());
}

// 設定の「出す／出さない」の1段
function toggleRow(label, note, id, on) {
  return '<div class="srow"><span>' + label + "<small>" + note + "</small></span>"
    + '<button class="tool-btn' + (on ? " on" : "") + '" type="button" id="' + id + '">'
    + (on ? "出す" : "出さない") + "</button></div>";
}

// ---- 見終えるまでの時間 ------------------------------------------------------
// 「短い時間で見終わる」ことを数字で見るため（CODE_TASK_09 ②）。
// その日の新着が残っていて、画面が表に出ている間だけ数える。新着が0件になったら「見終えた」とする。
// 画面が裏に回っている間（記事を読みに行っている・画面を消した）は数えない。放っておいた分が混ざらないように。
// 1日に何度か開いたら、その日の合計にする。記録はこの端末だけ（mynews_ で始まるので書き出しには入る）。
const DONETIME_KEY = "mynews_donetime";   // { "2026-10-29": [数えた時間(ms), 見終えたら1・まだなら0] }
const DONETIME_DAYS = 60;                 // 直近60日分だけ残す
let DT_START = 0;                          // 今数えている区間の始まり（0なら数えていない）

function loadDoneTime() {
  try {
    const v = JSON.parse(lsGet(DONETIME_KEY, "{}") || "{}");
    return isPlainObject(v) ? v : {};
  } catch (e) { return {}; }
}

function saveDoneTime(rec) {
  const oldest = dayKey(Date.now() - (DONETIME_DAYS - 1) * 86400000);
  const kept = {};
  Object.keys(rec).forEach(function (d) { if (d >= oldest && Array.isArray(rec[d])) kept[d] = rec[d]; });
  lsSet(DONETIME_KEY, JSON.stringify(kept));
}

// ここまで数えた分を、きょうの記録に足す（markDone なら「見終えた」の印も付ける）
function dtFlush(markDone) {
  const now = Date.now();
  const rec = loadDoneTime();
  const day = dayKey(now);
  const r = Array.isArray(rec[day]) ? rec[day] : [0, 0];
  if (DT_START) r[0] += Math.max(0, now - DT_START);
  if (markDone) r[1] = 1;
  rec[day] = r;
  saveDoneTime(rec);
  if (DT_START) DT_START = now;
}

function freshLeft() {
  return freshBlocks().reduce(function (t, b) { return t + b.items.length; }, 0);
}

// 画面を描き直すたびに呼ぶ。数えている最中に新着が0件になったら、そこで「見終えた」
function dtCheck() {
  try {
    const visible = !document.visibilityState || document.visibilityState !== "hidden";
    const left = freshLeft();
    if (DT_START) {
      if (!left) { dtFlush(true); DT_START = 0; }
      else if (!visible) { dtFlush(false); DT_START = 0; }
      else dtFlush(false);   // 途中の分も書いておく（急に閉じられても残るように）
    } else if (left && visible) {
      DT_START = Date.now();
    }
  } catch (e) { /* 数えられなくても画面は動かす */ }
}

// 画面が裏に回ったら、そこまでの分を書いて止める
function dtHidden() {
  try { if (DT_START) { dtFlush(false); DT_START = 0; } } catch (e) { /* 続行 */ }
}

// 「4分12秒」の形
function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m ? m + "分" + pad2(s % 60) + "秒" : s + "秒";
}

// 設定の1段：直近7日の時間と平均（平均は見終えた日だけで出す。途中でやめた日を混ぜると短く見えるため）
function doneTimeRow() {
  const rec = loadDoneTime();
  const now = Date.now();
  const lines = [];
  let sum = 0, n = 0;
  for (let i = 0; i < 7; i++) {
    const ms = now - i * 86400000;
    const r = rec[dayKey(ms)];
    if (!Array.isArray(r)) continue;
    const d = new Date(ms);
    lines.push((d.getMonth() + 1) + "/" + d.getDate() + " " + fmtDuration(r[0]) + (r[1] ? "" : "（途中まで）"));
    if (r[1]) { sum += r[0]; n += 1; }
  }
  return '<div class="srow dtime"><span>見終えるまでの時間（新着が0件になるまで）<small>'
    + (lines.length
      ? lines.join("<br>") + (n ? "<br>平均 " + fmtDuration(sum / n) + "（見終えた" + n + "日）" : "")
      : "まだ記録がありません")
    + "</small></span></div>";
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

  // 見出しの右端に［↕ 並べ替え］。押すと「並べ替え中」になり、［✓ おわる］で戻る（v1.37.0）
  // その上にホイミの1行（新着が残っているときだけ。0件なら「確認しました」の下に出る。v1.45.1）
  let h = (total && !MORNING_ARRANGE ? hoimiLine() : "")
    + '<section class="morning' + (MORNING_ARRANGE ? " arranging" : "") + '" id="morning"><div class="mhead">'
    + "<h2>⚡ 今日の新着</h2>"
    + (MORNING_ARRANGE ? '<span class="marr-note">並べ替え中</span>'
      : '<span class="mcount">' + total + "件</span>"
        + (since && since < total ? '<span class="since">●前回から ' + since + "</span>" : ""))
    + '<button class="tool-btn marr-btn' + (MORNING_ARRANGE ? " on" : "") + '" type="button" id="morning-arrange">'
    + (MORNING_ARRANGE ? "✓ おわる" : "↕ 並べ替え") + "</button>"
    + "</div>";

  if (MORNING_ARRANGE) return h + morningArrangeList() + "</section>";

  if (!total) {
    h += '<div class="mdone">✓ 新着はすべて確認しました。次の記事は次の更新で届きます。</div>' + hoimiCard();
  } else {
    blocks.forEach(function (b) {
      const open = !!FRESH_OPEN[b.key];
      const bs = b.items.filter(isSinceLast).length;
      h += '<div class="mtheme' + (open ? " open" : "") + '"><div class="mrow">'
        + '<button class="mname" type="button" data-fresh-open="' + esc(b.key) + '">'
        + '<span class="mcaret">' + (open ? "▾" : "▸") + "</span>" + esc(b.name) + "</button>"
        + '<span class="mnum">' + b.items.length + "</span>"
        + (bs && bs < b.items.length ? '<span class="since" title="前回見てから届いた数">●' + bs + "</span>" : "")
        + '<button class="read-all mtidy" type="button" data-fresh="' + esc(b.key)
        + '" title="このテーマの新着を片づける（あとで戻せます）">✓ 片づけ</button></div>'
        + (open ? freshCards(b)
            + '<button class="mseen" type="button" data-fresh-done="' + esc(b.key) + '">'
            + "✓ ここまで見た（" + b.items.length + "件を片づけて次へ）</button>" : freshPeek(b))
        + "</div>";
    });
  }
  // 発掘の入口は1週間分の件数を基本に、きょうの分は「うちきょう」で添える（CODE_TASK_08 ②）
  if (foundWeek) {
    h += '<button class="mfound" type="button" id="show-found"><b>⛏ 発掘 ' + foundWeek + "件"
      + (foundToday ? "（うち今日" + foundToday + "）" : "") + "</b>"
      + "<small>初めて見つけた、少し前の記事</small><i>→</i></button>";
  }
  if (total) {
    h += '<button class="mtidyall" type="button" id="tidy-all-fresh">✓ 見終わったので全部片づけ（'
      + total + "件）</button>";
  }
  return h + "</section>";
}

// 書庫の見出し。畳んでいるときは1行だけにして、新着のあるテーマを短く添える（CODE_TASK_08 ①）。
// 新着のあるテーマを自動で開くことはしない（朝刊と同じ記事が2回出るため。利用者と合意済み）。
const SHELF_PEEK = 3;   // 畳んだ行に名前を出すテーマの数。残りは「ほか○」
function shelfHead() {
  if (!SHELF_OPEN) {
    const list = shelfFreshList();
    const names = list.slice(0, SHELF_PEEK).map(function (x) { return esc(x.name) + " " + x.n; }).join("・");
    const rest = list.length - SHELF_PEEK;
    // 名前が長くて「…」で切れても「ほか○」は見えるように、別の札にして右端に置く
    return '<button class="shelf-head shelf-fold" type="button" id="toggle-shelf">'
      + '<h2>📚 書庫<span class="scaret">▸</span></h2>'
      + '<span class="shelf-new">' + (list.length
        ? '<span class="sn-names">新着あり：' + names + "</span>"
          + (rest > 0 ? '<span class="sn-rest">ほか' + rest + "</span>" : "")
        : '<span class="sn-names">テーマごとに貯めた記事（読んだ記事も残っています）</span>')
      + "</span></button>";
  }
  return '<div class="shelf-head"><h2><button class="shelf-toggle" type="button" id="toggle-shelf">'
    + '📚 書庫<span class="scaret">▾</span></button></h2>'
    + "<p>テーマごとに貯めた記事です。読んだ記事も薄くして残します。次に開いたときは、また畳んだ状態から始まります。</p></div>";
}

// 書庫の並び（カテゴリの順・その中は書庫の並べ替えの順・動画は最後）で、新着のあるテーマと件数
function shelfFreshList() {
  const out = [];
  const add = function (x) {
    const n = (x.group.items || []).filter(isFresh).length;
    if (n) out.push({ name: x.group.name, n: n });
  };
  ((window.NEWS_DATA || {}).categories || []).forEach(function (c) {
    sortByOrder(ALL_GROUPS.filter(function (x) { return x.cat === c.name && !x.video; })).forEach(add);
  });
  ALL_GROUPS.filter(function (x) { return x.video; }).forEach(add);
  return out;
}

// 並べ替え中の朝刊。新着の無い行も含めて全部の行を ▲▼ 付きで並べる
// （出ていない行は置き場所を決められないため）。のぞき見・片づけ・発掘は隠す。
function morningArrangeList() {
  const rows = freshRows();
  let h = '<p class="marr-help">上から順に朝刊に並びます。▲▼で1つずつ動かせます。順番はこの端末に覚えます。'
    + "新着の無い日は、その行は朝刊に出ません。</p>";
  rows.forEach(function (r, i) {
    h += '<div class="mtheme marr-row"><div class="mrow">'
      + '<span class="mname">' + esc(r.name) + "</span>"
      + '<span class="mnum' + (r.items.length ? "" : " zero") + '" title="今日の新着">' + r.items.length + "</span>"
      + '<button class="tool-btn" type="button" data-mmove="up" data-mkey="' + esc(r.key) + '"'
      + (i === 0 ? " disabled" : "") + ' aria-label="' + esc(r.name) + 'を上へ">▲</button>'
      + '<button class="tool-btn" type="button" data-mmove="down" data-mkey="' + esc(r.key) + '"'
      + (i === rows.length - 1 ? " disabled" : "") + ' aria-label="' + esc(r.name) + 'を下へ">▼</button>'
      + "</div></div>";
  });
  const custom = rows.some(function (r) { return typeof MORNING_ORDER[r.key] === "number"; });
  if (custom) {
    h += '<button class="tool-btn marr-reset" type="button" id="morning-order-reset">元の順番に戻す</button>';
  }
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

// 書庫（朝刊の下のテーマ一覧と動画の枠）は、毎回1行に畳んだ状態で始める（CODE_TASK_08 ①）。
// 新着は朝刊で読むので、書庫はふだん閉じていてよい。毎朝開け閉めする手間をなくすため、端末には覚えない。
// ただし記事を読んでアプリに戻ったとき（読み込み直しを含む）に閉じると、読んでいた場所を見失うので、
// 最後に画面を離れてから SESSION_GAP（1時間）以内なら開いたままにする（「●前回から」と同じ区切り）。
let SHELF_OPEN = (function () {
  const v = ssGet();
  const last = Math.max(v.hid || 0, v.shelfAt || 0);
  return !!v.shelf && Date.now() - last < SESSION_GAP;
})();
function setShelfOpen(open) {
  SHELF_OPEN = !!open;
  ssSave({ shelf: SHELF_OPEN, shelfAt: Date.now() });
}

function renderFreshView(data) {
  // 行の分け方・並びは朝刊と同じ（freshBlocks）。以前はここだけ別に作っていて、
  // ウォッチ銘柄のニュースを先頭に出す並びが新着画面に効いていなかった。
  const blocks = freshBlocks();
  const total = blocks.reduce(function (n, b) { return n + b.items.length; }, 0);

  const parts = ["<header><h1>⚡ 今日の新着</h1>"
    + '<div class="meta-head">' + headUpdated(data.generated_at)
    + '<button class="newcount on" type="button" id="show-fresh">← 書庫へ</button>'
    + '<span class="unread">' + total + "件</span>"
    + (total ? '<button class="tool-btn tidy-all" type="button" id="tidy-all-fresh">✓ 全部片づけ</button>' : "")
    + "</div>"
    + toolbar(data.sources) + "</header>"];
  if (blocks.length) parts.push(hoimiLine());   // 朝刊と同じく、新着の上にホイミの1行（v1.45.1）

  // 朝刊のように「読み切れる量で終わる」ことを目指す。
  // 見出しを見て、読むものは開き、読まないものは片づける。ゼロになったら、きょうの新着は確認済み。
  if (!blocks.length) {
    parts.push('<div class="empty done-today">✓ 新着はすべて確認しました。<br>'
      + "次の記事は次の更新で届きます。古い記事や発掘は「← 書庫へ」でいつでも読めます。</div>" + hoimiCard());
  } else {
    blocks.forEach(function (b) {
      const open = !!FRESH_OPEN[b.key];
      const since = b.items.filter(isSinceLast).length;
      // まとめた行は、テーマ名（チャンネル名）の小見出しで区切る
      const cards = b.members
        ? b.members.map(function (m) {
          return '<div class="msec">' + esc(m.name) + "<i>" + m.items.length + "</i></div>"
            + m.items.map(function (a) { return renderCard(a, false, false); }).join("");
        }).join("")
        : b.items.map(function (a) { return renderCard(a, false, false); }).join("");
      parts.push('<section class="group' + (open ? "" : " folded hasnew") + '"><h3 class="ghead">'
        + '<button class="gname" type="button" data-fresh-open="' + esc(b.key) + '">'
        + (open ? "▾ " : "▸ ") + esc(b.name) + "</button>"
        + '<span class="gcount">' + b.items.length + "件</span>"
        + (since ? '<span class="since">●前回から ' + since + "</span>" : "")
        + '<button class="read-all" type="button" data-fresh="' + esc(b.key)
        + '" title="このテーマの新着を片づける（あとで戻せます）">✓ 片づけ</button></h3>'
        + (open ? '<div class="gitems expanded">' + cards + "</div>" : "")
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
    + 'data-found-span="today">今日 ' + today + "件</button>"
    + '<button class="tool-btn' + (FOUND_TODAY ? "" : " on") + '" type="button" '
    + 'data-found-span="week">この1週間 ' + week + "件</button>"
    // いま表示している発掘を全部まとめて片づける（知らせから元に戻せる。CODE_TASK_08 ②）
    + (total ? '<button class="tool-btn tidy-all" type="button" id="tidy-all-found">✓ 全部片づけ</button>' : "")
    + "</div>"
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
  // ホイミの画面には上の道具（お気に入り・探す・設定）を置かないので、開いている間はこれだけを描く
  if (SHOW_HOIMI) { renderHoimiView(data); return; }
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
  parts.push(shelfHead());

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

  // 書庫を畳んでいるときは、テーマの一覧も動画の枠も出さない（CODE_TASK_08 ①）
  if (SHELF_OPEN) cats.forEach(function (name, ci) {
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
  if (SHELF_OPEN && videoGroups.length) {
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
  // 見終えるまでの時間（新着が0件になった瞬間を拾う）。描く前に数えておくと、設定の一覧にきょうの分まで出る
  dtCheck();
  // 見終えた・ホイミでレベルが上がっていたら、1回だけ知らせる（v1.47.0）。
  // 増えた項目を覚えるのは描く前（その描き直しから5つ目に出るように。v1.48.0）、知らせは描いた後
  const lvMsg = hpSync();
  render(window.NEWS_DATA);
  applyPrefs();
  hpShow(lvMsg);
}

// テーマ内の記事をまとめて既読にする
// まとめて片づける（既読にする）。確認のダイアログは出さず、押したあとで戻せるようにする。
// スワイプと同じ考え方：迷わず押せて、間違えたら15秒以内に戻す（UNDO_SEC）。
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
  // 書庫を開く・畳む（CODE_TASK_08 ①）。畳むときは書庫の見出しが画面の上に来るように戻す
  if (ev.target.closest("#toggle-shelf")) {
    const wasOpen = SHELF_OPEN;
    setShelfOpen(!SHELF_OPEN);
    const y = window.scrollY;
    rerender();
    const head = document.getElementById("toggle-shelf");
    if (wasOpen && head && head.getBoundingClientRect) {
      window.scrollTo(0, Math.max(0, head.getBoundingClientRect().top + (window.scrollY || 0) - 12));
    } else {
      window.scrollTo(0, y);
    }
    return;
  }
  if (ev.target.closest("#toggle-toc")) {
    setAllFolded(!allFolded());
    setShelfOpen(true);   // 書庫を畳んだまま押しても何も変わらないので、書庫も開く
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
  // ホイミ：出す／出さない
  if (ev.target.closest("#toggle-hoimi")) {
    lsSet(HOIMI_OFF_KEY, lsGet(HOIMI_OFF_KEY, "0") === "1" ? "0" : "1");
    rerender();
    return;
  }
  // ホイミの HP・経験値：出す／出さない（v1.47.0）
  if (ev.target.closest("#toggle-hp")) {
    lsSet(HP_OFF_KEY, hpOff() ? "0" : "1");
    rerender();
    return;
  }
  // ホイミの4つ目（職場向け）：出す／出さない（v1.47.0）
  if (ev.target.closest("#toggle-hoimi-work")) {
    lsSet(HOIMI_WORK_OFF_KEY, hoimiWorkOff() ? "0" : "1");
    rerender();
    return;
  }
  // ホイミ：上の1行・［一覧・ふり返り →］→ ホイミの画面へ（v1.46.0）
  if (ev.target.closest("#hoimi-open")) {
    HOIMI_BACK_Y = window.scrollY || 0;
    SHOW_HOIMI = true;
    HOIMI_PICKED = "";
    rerender();
    window.scrollTo(0, 0);
    return;
  }
  // ホイミの画面から戻る（開く前に見ていた位置へ）
  if (ev.target.closest("#hoimi-back")) {
    SHOW_HOIMI = false;
    HOIMI_PICKED = "";
    rerender();
    window.scrollTo(0, HOIMI_BACK_Y);
    return;
  }
  // ホイミの一覧：行を押すと、その行の中に［できた］を出す（もう一度押すと閉じる。開くのは1行だけ）。
  // ここでは記録しない（v1.47.0、CODE_TASK_11 ①）
  const hoimiPick = ev.target.closest("[data-hoimi-pick]");
  if (hoimiPick) {
    const id = hoimiPick.dataset.hoimiPick;
    HOIMI_PICKED = HOIMI_PICKED === id ? "" : id;
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
    return;
  }
  // ホイミ：できた（今の3つ・一覧で開いた行）→ 記録に1件足し、今の3つの項目ならすぐ次の3つ。
  // 15秒は戻せる（足した1件を消し、前の3つに戻す。HP と経験値も戻る）。
  // レベルが上がったら、rerender の中の hpNotice が知らせの文に「レベルが あがった！」を足す
  const hoimiBtn = ev.target.closest("[data-hoimi-done]");
  if (hoimiBtn) {
    const id = hoimiBtn.dataset.hoimiDone;
    if (!hoimiName(id)) return;
    const undo = hoimiDone(id);
    pushUndo(hoimiMsg(), undo);
    HOIMI_PICKED = "";
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
    return;
  }
  // ホイミ：ほかの3つにする → きょう出した項目を避けて、3つとも選び直す
  if (ev.target.closest("#hoimi-next")) {
    hoimiNext();
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
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
    // 行の目印（テーマ名、まとめた行は "cat:カテゴリ名"）。まとめた行は中の全テーマの新着を片づける
    const key = seenBtn.dataset.freshDone;
    const block = freshBlockByKey(key);
    const rows = [].slice.call(document.querySelectorAll("[data-fresh-open]"));
    const idx = rows.findIndex ? rows.findIndex(function (r) { return r.dataset.freshOpen === key; }) : -1;
    if (block) tidyUp(block.items, "「" + block.name + "」の新着", "seen", "morning");
    FRESH_OPEN[key] = false;
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
    const block = freshBlockByKey(readFresh.dataset.fresh);
    if (!block) return;
    const y = window.scrollY;
    tidyUp(block.items, "「" + block.name + "」の新着", "tidy", SHOW_FRESH ? "fresh" : "morning");
    rerender();
    window.scrollTo(0, y);
    return;
  }
  // 発掘画面の「✓ 全部片づけ」。いま表示している分（きょう／この1週間）を全部（CODE_TASK_08 ②）
  if (ev.target.closest("#tidy-all-found")) {
    const pick = FOUND_TODAY ? isFoundToday : isFound;
    const items = [];
    ALL_GROUPS.forEach(function (x) { (x.group.items || []).filter(pick).forEach(function (a) { items.push(a); }); });
    tidyUp(items, FOUND_TODAY ? "今日の発掘" : "この1週間の発掘", "foundall", "found");
    rerender();
    window.scrollTo(0, 0);
    return;
  }
  if (ev.target.closest("#tidy-all-fresh")) {
    const items = [];
    ALL_GROUPS.forEach(function (x) { (x.group.items || []).filter(isFresh).forEach(function (a) { items.push(a); }); });
    tidyUp(items, "今日の新着", "tidyall", SHOW_FRESH ? "fresh" : "morning");
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
      // 開いたときはいつも1週間分（v1.42.0 までは、きょうの分があれば「きょう」。CODE_TASK_08 ②）
      FOUND_TODAY = false;
    }
    rerender();
    window.scrollTo(0, 0);
    return;
  }
  // ウォッチ銘柄の高値・安値の期間（1・3・5・10年）。全銘柄いっしょに替わる。端末には覚えさせない
  const spanBtn = ev.target.closest("[data-stock-span]");
  if (spanBtn) {
    STOCK_SPAN = spanBtn.dataset.stockSpan;
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
    return;
  }
  // ウォッチ銘柄の表の見出し＝並べ替え（CODE_TASK_08 ⑤）。株価・利回りは押すたびに2つの並びを行き来する。端末に覚える
  const sortBtn = ev.target.closest("[data-stock-sort]");
  if (sortBtn) {
    const col = sortBtn.dataset.stockSort;
    STOCK_SORT = col === "price" ? (STOCK_SORT === "up" ? "down" : "up")
      : col === "yield" ? (STOCK_SORT === "yield" ? "dy" : "yield")
      : col === "pos" ? "low" : "";
    lsSet(STOCK_SORT_KEY, STOCK_SORT);
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
    return;
  }
  // ウォッチ銘柄の「見方」（凡例）を開く・閉じる（CODE_TASK_05 ⑤）。端末に覚えない
  if (ev.target.closest("[data-stock-legend]")) {
    STOCK_LEGEND = !STOCK_LEGEND;
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
    return;
  }
  // ウォッチ銘柄の行を押すと、詳細を開く・閉じる（CODE_TASK_05 ④）。開いた状態は端末に覚えない
  const stockHead = ev.target.closest("[data-stock-open]");
  if (stockHead) {
    const code = stockHead.dataset.stockOpen;
    if (STOCK_OPEN.has(code)) STOCK_OPEN.delete(code); else STOCK_OPEN.add(code);
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
    return;
  }
  // ウォッチ銘柄の役割の札（高配当→長期保有→優待→高配当）。詳細の中の札で替える。この端末だけに覚える
  const roleBtn = ev.target.closest("[data-role]");
  if (roleBtn) {
    const code = roleBtn.dataset.role;
    const next = ROLE_NEXT[roleOf(code)];
    if (next === "div") delete ROLES[code]; else ROLES[code] = next;
    lsSet(ROLE_KEY, JSON.stringify(ROLES));
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
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
  // 朝刊の行の並べ替え（見出しの［↕ 並べ替え］／［✓ おわる］、行の ▲▼、元の順番に戻す）
  if (ev.target.closest("#morning-arrange")) {
    MORNING_ARRANGE = !MORNING_ARRANGE;
    const y = window.scrollY;   // ボタンは朝刊の見出しにあるので、画面は動かさない
    rerender();
    window.scrollTo(0, y);
    return;
  }
  const mmove = ev.target.closest("[data-mmove]");
  if (mmove) {
    moveMorningRow(mmove.dataset.mkey, mmove.dataset.mmove);
    const y = window.scrollY;
    rerender();
    window.scrollTo(0, y);
    return;
  }
  if (ev.target.closest("#morning-order-reset")) {
    const before = MORNING_ORDER;
    MORNING_ORDER = {};
    lsSet(MORNING_ORDER_KEY, "{}");
    rerender();
    pushUndo("朝刊を元の順番に戻しました", function () {
      MORNING_ORDER = before;
      lsSet(MORNING_ORDER_KEY, JSON.stringify(before));
    });
    return;
  }
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
    if (!SETTINGS_OPEN) { IMPORT_PREVIEW = null; HOLD_PREVIEW = null; }
    rerender();
    return;
  }
  // 保有株の CSV を読み込む・消す
  if (ev.target.closest("#hold-import")) {
    const input = document.getElementById("hold-file");
    if (input) { input.value = ""; input.click(); }
    return;
  }
  if (ev.target.closest("#hold-cancel")) {
    HOLD_PREVIEW = null;
    rerender();
    return;
  }
  if (ev.target.closest("#hold-apply")) {
    const p = HOLD_PREVIEW;
    HOLD_PREVIEW = null;
    if (p && p.ok) {
      const v = { asof: p.asof || Date.now(), at: Date.now(), items: p.items };
      lsSet(HOLD_KEY, JSON.stringify(v));
      HOLD = loadHoldings();
      toast(HOLD ? "保有株を " + HOLD.items.length + "銘柄 読み込みました" : "保存できませんでした");
    }
    rerender();
    return;
  }
  if (ev.target.closest("#hold-clear")) {
    if (!confirm("保有株の記録をこの端末から消します。よろしいですか？（CSV を読み込み直せば戻せます）")) return;
    try { localStorage.removeItem(HOLD_KEY); } catch (e) { /* 消せなくても続行 */ }
    HOLD = loadHoldings();
    rerender();
    return;
  }
  // 記録の書き出し・読み込み
  if (ev.target.closest("#backup-export")) {
    try {
      const opt = document.getElementById("backup-hold");
      const size = downloadBackup(!!(opt && opt.checked));
      toast("書き出しました（" + Math.max(1, Math.round(size / 1024)) + "KB"
        + (opt && opt.checked ? "・保有株を含む" : "") + "）");
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
    hpAwayStart();   // 戻るまでの時間を測り始める（長く読んだ分も減らす。v1.49.0）
    hpPaint();   // HP が減ったのを、戻ったときに数字で見えるように（描き直しはしない。v1.47.0）
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
// 「元に戻す」を出しておく秒数。v1.46.0 までは5秒だったが、間違えたときに短くて戻せなかったので
// 15秒にした（利用者の指摘 2026-10-31。片づけ・払う・👎・ホイミのすべて）
const UNDO_SEC = 15;
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
  }, UNDO_SEC * 1000);

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

// 保有株の CSV が選ばれたら、中身を調べて確認を出す（まだ何も変えない）。
// SBI の CSV は Shift_JIS なので、文字として読む前に文字コードを見分ける。
APP.addEventListener("change", function (ev) {
  if (!ev.target.matches("#hold-file")) return;
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  function show(p) { HOLD_PREVIEW = p; SETTINGS_OPEN = true; rerender(); }
  if (file.size > HOLD_FILE_MAX) {
    show({ ok: false, msg: "ファイルが大きすぎます（ポートフォリオの CSV ではないようです）。何も変えていません。" });
    return;
  }
  const reader = new FileReader();
  reader.onload = function () {
    const p = parseHoldingsCsv(decodeHoldingsCsv(reader.result));
    if (p.ok) p.asof = file.lastModified || 0;   // CSV に日付が無いので、ファイルの保存日時を「時点」にする
    show(p);
  };
  reader.onerror = function () { show({ ok: false, msg: "ファイルを読めませんでした。何も変えていません。" }); };
  reader.readAsArrayBuffer(file);
});

// data.js（<script src> で先に読み込まれ window.NEWS_DATA に入っている）を描画。
try {
  const data = window.NEWS_DATA;
  if (!data) throw new Error("data.js が読み込まれていません（build_news.py を実行してください）");
  applyPrefs();
  hpAwayEnd();   // 記事を読んでいる間にスマホがページを読み込み直した場合も、離れていた時間を測る（v1.49.0）
  const lvMsg = hpSync();   // 前に開いてからレベルが上がっていたら、描く前に増えた項目を覚える（v1.48.0）
  render(data);
  dtCheck();   // 新着が残っていれば、見終えるまでの時間を数え始める
  hpShow(lvMsg);  // 1回だけ知らせる（v1.47.0）
  hpNotice();     // 数え始めたときに「見終えた」でレベルが上がった分
  // 読み込み直したときは、読んでいた位置に戻す（ページを開いている間だけ覚えている）
  const saved = ssGet();
  if (saved.y) window.scrollTo(0, saved.y);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      dtHidden();
      ssSave({ y: window.scrollY || 0, hid: Date.now() });
      return;
    }
    dtCheck();   // 表に戻ったら、新着が残っていれば数え直す
    hpAwayEnd(); // 記事から戻ったなら、離れていた時間の分も HP を減らす（v1.49.0）
    hpPaint();   // 記事から戻ったとき・日付が変わったときの HP を、描き直さずに出し直す（v1.47.0）
    hpNotice();
    // 開いたまま1時間以上離れていたら、次に開いたときと同じく書庫を畳んで一番上から（CODE_TASK_08 ①）。
    // スマホがページを読み込み直さずに残していた場合のため
    const hid = ssGet().hid || 0;
    if (SHELF_OPEN && hid && Date.now() - hid >= SESSION_GAP) {
      setShelfOpen(false);
      rerender();
      window.scrollTo(0, 0);
    }
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
