"""2つの archive.json を、記事を1件も落とさずに合わせる。

GitHub Actions で「記事の蓄積」を保存するとき、別の実行が先に保存していると
push が弾かれる。そのとき相手の蓄積を取り込み、自分の分を足してから保存し直す。
どちらか一方で上書きすると記事が消えるため、必ず両方を残す。

使い方: python merge_archive.py <自分の蓄積.json> <相手の蓄積.json(ここに書き戻す)>
"""
import json
import sys


def merge_seen(mine, theirs):
    """見た記事の控え（見出し → 初めて見た日時）を合わせる。早いほうを残す。"""
    out = dict(theirs)
    for k, t in mine.items():
        if k not in out or t < out[k]:
            out[k] = t
    return out


def merge(mine, theirs):
    # seen.json（値が文字列）なら控えとして合わせる
    if all(isinstance(v, str) for v in list(mine.values())[:50] + list(theirs.values())[:50]):
        return merge_seen(mine, theirs)
    out = {}
    for src in (theirs, mine):
        for group, items in src.items():
            by_link = {a.get("link"): a for a in out.get(group, [])}
            for a in items:
                old = by_link.get(a.get("link"))
                if old is None:
                    by_link[a.get("link")] = a
                    continue
                # 初めて見つけた日時は古いほう（NEW が再点灯しないように）
                if a.get("first_seen") and a["first_seen"] < old.get("first_seen", "9999"):
                    old["first_seen"] = a["first_seen"]
                if old.get("hb") is None and a.get("hb") is not None:
                    old["hb"] = a["hb"]
            out[group] = list(by_link.values())
    return out


if __name__ == "__main__":
    mine_path, theirs_path = sys.argv[1], sys.argv[2]
    with open(mine_path, encoding="utf-8") as f:
        mine = json.load(f)
    with open(theirs_path, encoding="utf-8") as f:
        theirs = json.load(f)
    merged = merge(mine, theirs)
    with open(theirs_path, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False)
    n = lambda d: sum(len(v) if isinstance(v, list) else 1 for v in d.values())
    print(f"蓄積を合わせました: 自分 {n(mine)} ＋ 相手 {n(theirs)} → {n(merged)} 件")
