"""スマホと同じ幅で画面を撮る（デザインの点検用）。

Claude はスマホの画面を直接見られない。パソコンの Chrome に、スマホの幅（412px）で
画面を描かせて画像にする。「30日使い続けた状態」を仕込んでから撮るので、
NEW や「●前回から」の印も実際に近い形で出る。

使い方:
  python tools/screenshot.py 出力.png                # 明るい配色・高さ1800px
  python tools/screenshot.py 出力.png --dark         # 暗い配色
  python tools/screenshot.py 出力.png --height 900   # 最初の1画面だけ
  python tools/screenshot.py 出力.png --src 公開版を置いたフォルダ
  python tools/screenshot.py 出力.png --click "[data-fresh-open]"   # 撮る前に押す（最初の1つ）

注意: Chrome の画面は500pxより狭くできないため、ページの幅を412pxに固定して撮る。
      右側に余白が写るのはそのため（はみ出しではない）。
"""
import argparse
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--dark", action="store_true")
    ap.add_argument("--height", type=int, default=1800)
    ap.add_argument("--width", type=int, default=412)
    ap.add_argument("--src", default=str(Path(__file__).resolve().parent.parent))
    ap.add_argument("--click", default="", help="撮る前に押す部品（CSSの選択子。最初の1つ）")
    args = ap.parse_args()

    chrome = next((c for c in CHROME_CANDIDATES if Path(c).exists()), None)
    if not chrome:
        raise SystemExit("Chrome / Edge が見つかりません")

    work = Path(tempfile.mkdtemp(prefix="mynews_shot_"))
    for name in ("index.html", "app.js", "data.js"):
        shutil.copy(Path(args.src) / name, work / name)

    # 30日使っている人の状態（初回・前回の回）を仕込み、幅をスマホに固定する
    now = int(time.time() * 1000)
    seed = (
        "<script>try{"
        f'localStorage.setItem("mynews_firstopen","{now - 30 * 86400000}");'
        f'localStorage.setItem("mynews_session",JSON.stringify({{start:{now - 13 * 3600000},'
        f'prev:{now - 20 * 3600000},last:{now - 12 * 3600000}}}));'
        f'localStorage.setItem("mynews_theme","{"dark" if args.dark else "light"}");'
        "}catch(e){}</script>"
    )
    page = (work / "index.html").read_text(encoding="utf-8")
    page = page.replace('<script src="data.js"></script>', seed + '<script src="data.js"></script>', 1)
    page = page.replace("<title>", f"<style>html{{width:{args.width}px!important;overflow-x:hidden}}</style><title>", 1)
    if args.click:
        # 画面ができてから押す（押す部品は app.js が描いたあとにしか無いため）
        sel = args.click.replace("\\", "\\\\").replace('"', '\\"')
        page = page.replace("</body>", '<script>setTimeout(function(){var b=document.querySelector("'
                            + sel + '");if(b)b.click();},300);</script></body>', 1)
    (work / "index.html").write_text(page, encoding="utf-8")

    out = Path(args.out).resolve()
    subprocess.run([
        chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        f"--user-data-dir={work / 'profile'}", f"--window-size=500,{args.height}",
        "--force-device-scale-factor=1", "--virtual-time-budget=3000",
        f"--screenshot={out}", (work / "index.html").as_uri(),
    ], check=False, capture_output=True, timeout=120)
    shutil.rmtree(work, ignore_errors=True)
    print(f"撮影しました: {out}" if out.exists() else "撮影できませんでした")


if __name__ == "__main__":
    main()
