"""配当の記録の点検：Yahoo の配当を、IR BANK（会社の決算資料の数字）と1回ずつ突き合わせる。

Yahoo の過去の配当には、権利落ち日の時点の「予想の額」のまま、会社があとで額を変えても
直っていないものがある（2026-10-14 に見つけた。2020〜2021年を中心に約10件）。
10年の利回りの幅や「前の年より減った年」（CODE_TASK_05 ⑥）を誤らせるので、
見つけたものは feeds.json の銘柄の行の "div_fix" に書いて直す（build_news.py の dividend_events）。

使い方（月1回の大掃除のときに。何も書き換えない）:
  python tools/check_dividends.py              # ウォッチ銘柄の全部
  python tools/check_dividends.py 1419 4927    # 銘柄コードを選んで

・突き合わせるのは、決算の年の「実績」の中間と期末（過去10年半）。IR BANK の額はその時の株数の額なので、
  そのあとの株式分割のぶんを割って、Yahoo と同じ物差しにそろえる。
・div_fix で直したあとの額で比べる（直したものは一致になる）。食い違いがあれば、足す行の案を出す。
・IR BANK は1秒ずつあけて読む（相手のサイトに負担をかけないため）。表の形が読めない銘柄は「読めず」と出す。
・IR BANK 側の誤りもある（JFEシステムズの「分割調整」の列は、古い年が分割1回分しか割られていない）。
  ここでは「分割調整」の列は使わず、元の額を Yahoo の分割の記録で割る。
・決算の月を変えた年（ピジョン 2019年・住友林業 2020年・小林製薬 2016年）は、中間・期末の月がずれるので
  食い違いに見えることがある。案をそのまま足さず、IR BANK の表で確かめてから足す。
・2026-10-14 の結果：29銘柄で一致 523・食い違い 0（div_fix の10件を足したあと）。
"""
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import build_news as b  # noqa: E402  （株価の取り方と配当の直し方を、毎回の更新と同じものにするため）

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"
YEARS = 10.5        # 何年前の決算まで比べるか（1年ごとの配当の11個ぶん）
TOL = 0.01          # 1%（端数の差は食い違いにしない。0.06円未満も同じ）


def irbank_rows(code):
    """IR BANK の配当の表から、決算の年ごとの実績を [(年, 月, 中間, 期末)] で返す。中間の無い会社は中間を 0 にする。"""
    req = urllib.request.Request(f"https://irbank.net/{code}/dividend", headers={"User-Agent": UA})
    h = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "replace")
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", h, flags=re.S)
    t = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", t))
    i = t.find("年度 区分")
    if i < 0:
        return None
    has_interim = "中間" in t[i:i + 30]     # 年1回の会社は「期末 合計」だけの表
    seg = t[i:t.find("配当利回り 20", i)]
    out = []
    for y, m, body in re.findall(r"(\d{4})年 (\d+)月 (.*?)(?=\d{4}年 \d+月 |$)", seg):
        mm = re.search(r"実績 (\S+) (\S+)" + (r" (\S+)" if has_interim else ""), body)
        if not mm:
            continue

        def num(s):
            s = s.replace(",", "")
            return 0.0 if s in ("-", "") else float(s)
        try:
            interim, final = (num(mm.group(1)), num(mm.group(2))) if has_interim else (0.0, num(mm.group(1)))
        except ValueError:
            continue
        out.append((int(y), int(m), interim, final))
    return out


def split_factor(splits, day):
    """day の配当を今の物差しにそろえる倍率（day 以後の分割の比で割る。分割の日の配当は分割前の株数の額）。"""
    f = 1.0
    for sday, ratio in splits:
        if sday >= day:
            f /= ratio
    return f


def check(item):
    code = item["code"].replace(".T", "")
    result, long = b.get_chart(item["code"])
    off = int(result["meta"].get("gmtoffset") or 0)
    ev = result.get("events") or {}
    splits = [(b.local_day(s.get("date") or k, off), s["numerator"] / s["denominator"])
              for k, s in (ev.get("splits") or {}).items() if s.get("numerator") and s.get("denominator")]
    events = b.dividend_events(result, item.get("div_fix"))
    by_month = {}
    for day, amt, orig in events:
        by_month.setdefault(b.month_no(day), []).append((day, amt, orig))
    rows = irbank_rows(code)
    if rows is None:
        return f"{item['name']}（{code}）：IR BANK の表が読めず", []
    last = b.local_day(result["timestamp"][-1], off)
    oldest = b.month_no(last) - int(YEARS * 12)
    ok, bad = 0, []
    for y, m, interim, final in rows:
        end = y * 12 + m - 1
        if end < oldest or end > b.month_no(last):
            continue
        # 期末＝決算の月の配当、中間＝その3〜8か月前の配当（決算の月を変えた年は9か月の決算になり、
        # 中間が3か月前に来る＝住友林業 2020年12月期・小林製薬 2016年12月期。ふだんの年は3か月前に配当は無い）
        parts = [("期末", final, [d for d in by_month.get(end, [])])]
        mid = [d for n in range(end - 8, end - 2) for d in by_month.get(n, [])]
        parts.append(("中間", interim, mid))
        for label, raw, got in parts:
            if not got and raw == 0:
                continue
            day = got[0][0] if got else None
            want = raw * split_factor(splits, day) if day else raw
            have = sum(d[1] for d in got)
            if abs(have - want) <= max(0.06, want * TOL):
                ok += 1
                continue
            if len(got) == 1:
                rec = got[0][2] if got[0][2] is not None else got[0][1]   # Yahoo が記録している額
                bad.append(f"{y}年{m}月期の{label}：Yahoo {have:g}円・IR BANK {want:g}円"
                           f"（案: \"{day.isoformat()}\": [{rec:g}, {round(want, 2):g}]）")
            else:
                bad.append(f"{y}年{m}月期の{label}：Yahoo {have:g}円（{len(got)}回）・IR BANK {want:g}円（案なし。手で確かめる）")
    return f"{item['name']}（{code}）：一致 {ok}・食い違い {len(bad)}", bad


def main():
    feeds = json.loads((ROOT / "feeds.json").read_text(encoding="utf-8"))
    pick = set(sys.argv[1:])
    items = [s for s in feeds.get("stocks", []) if not pick or s["code"].replace(".T", "") in pick]
    total_bad = 0
    for it in items:
        try:
            head, bad = check(it)
        except Exception as e:
            head, bad = f"{it['name']}：点検できず（{type(e).__name__}）", []
        print(head)
        for x in bad:
            print("   ", x)
        total_bad += len(bad)
        time.sleep(1)
    print(f"食い違い 合計 {total_bad} 件（直すときは feeds.json の銘柄の行に \"div_fix\": {{…}} を足す。IR BANK の表で確かめてから）")


if __name__ == "__main__":
    main()
