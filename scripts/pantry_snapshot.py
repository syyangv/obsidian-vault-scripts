#!/usr/bin/env python3
"""Append a weekly 现有库存 snapshot to the Pantry snapshot note.

Recomputes the current untagged pantry cash value (sum of 💵 across Pantry items
that carry no #tag and are neither completed, forwarded, nor cancelled) and
appends one line to Logistics/库存/Pantry 快照.md for today's date. Items split
into 1/N subtasks are counted per open unit at the parent's per-unit price.
Tagged rows (e.g. #SF frozen goods) are excluded, matching the PWA pantry tab's
"Untagged" chip. Re-running on
the same date replaces that date's line instead of appending a duplicate.

The Pantry.md dataviewjs chart reads these lines for its 现有库存 snapshot
series (weekly view). Snapshot logic must stay in sync with the
existingPantryValue block in Logistics/库存/Pantry.md: both skip [x], [>] and
[-], both still count [/] (in-progress) items, both skip the parent of 1/N
subtasks while counting those subtasks at the parent's per-unit price, and both
drop tagged rows so the figure lines up with the chart's 无标签 chip.
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime
from pathlib import Path

VAULT = Path(__file__).resolve().parents[2]
PANTRY = VAULT / "Logistics/库存/Pantry.md"
SNAPSHOT = VAULT / "Logistics/库存/Pantry 快照.md"

SECTION_RE = re.compile(r"^#\s+([1-6])\b")
TASK_RE = re.compile(r"^(\s*)-\s+\[([^\]])\]\s?(.*)$")
AMOUNT_RE = re.compile(r"💵\s*\$?([\d,]+(?:\.\d+)?)")
UNIT_RE = re.compile(r"\d+/\d+")
# Any #tag on the row — the PWA pantry tab's "Untagged" chip is rows without one,
# and the snapshot tracks that same untagged total.
TAG_RE = re.compile(r"(?:^|[ \t])#[^\s#]+")

SNAPSHOT_LINE_RE = re.compile(
    r"^-\s*(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})[^$\n]*\$\s*([\d,]+(?:\.\d+)?)"
)
TABLE_ROW_RE = re.compile(r"^\|\s*(\d{4}-\d{2}-\d{2})\s*\|")
TABLE_HEADER_RE = re.compile(r"^\|\s*日期\s*\|")

HEADER = """---
modified_at: {modified}
type: pantry-inventory-snapshots
---
# Pantry 库存快照

![[noteNav]]

每周日 3am 自动记录一次「现有库存」——[[Pantry]] 里所有**无标签**、未完成、未
forward、未取消（`[x]` / `[>]` / `[-]`）的库存项的 💵 合计，与 PWA 的「无标签」
筛选一致。拆成 `1/N` 子项的物品按每个未用完的子项计价（父行上的 💵 是单个的
价）。[[Pantry]] 页面周视图中的橙色曲线读取本文件。

| 日期 | 现有库存 | 库存项数 |
| --- | --- | --- |
"""


def amount_of(text: str) -> float:
    m = AMOUNT_RE.search(text)
    return float(m.group(1).replace(",", "")) if m else 0.0


def compute() -> tuple[int, float]:
    """Return (item count, total cash value) for the current pantry."""
    lines = PANTRY.read_text(encoding="utf-8").split("\n")
    tasks: list[dict] = []
    section = None
    in_code = False

    for idx, line in enumerate(lines):
        if line.lstrip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        m = SECTION_RE.match(line)
        if m:
            section = m.group(1)
            continue
        m = TASK_RE.match(line)
        if m:
            tasks.append(
                {
                    "line": idx + 1,  # 1-indexed, matches dataview t.line
                    "indent": len(m.group(1).expandtabs(4)),
                    "marker": m.group(2),
                    "text": m.group(3),
                    "section": section,
                }
            )

    # line number -> task, plus nearest-parent lookup for unit children
    by_line = {t["line"]: t for t in tasks}
    parent_of: dict[int, int] = {}
    for t in tasks:
        candidates = [
            p
            for p in tasks
            if p["line"] < t["line"] and p["indent"] < t["indent"]
        ]
        if candidates:
            parent_of[t["line"]] = max(candidates, key=lambda p: p["line"])["line"]

    # A "1/2" / "2/2" subtask is one real unit. The parent's 💵 is the *per-unit*
    # price (see wholefoods-to-pantry references/pantry-write.md), so the parent
    # is skipped and its open units are counted at that per-unit price.
    unit_parents = {
        parent_of[t["line"]]
        for t in tasks
        if parent_of.get(t["line"]) is not None and UNIT_RE.search(t["text"])
    }

    count = 0
    total = 0.0
    for t in tasks:
        if t["section"] is None:
            continue
        if t["marker"] in ("x", ">", "-"):  # done / forwarded / cancelled
            continue
        if t["line"] in unit_parents:
            continue  # counted via its 1/N subtasks instead
        if TAG_RE.search(t["text"]):
            continue  # tagged rows are excluded: the snapshot is the untagged total
        count += 1
        value = amount_of(t["text"])
        if not value and parent_of.get(t["line"]) is not None and UNIT_RE.search(t["text"]):
            parent = by_line.get(parent_of[t["line"]])
            if parent:
                value = amount_of(parent["text"])   # per-unit price lives on the parent
        total += value

    return count, total


def write_snapshot(stamp: datetime, count: int, total: float) -> str:
    iso_date = f"{stamp:%Y-%m-%d}"

    # Harvest existing history (both the bullet list and the table) so the file
    # can be rebuilt from one template instead of patched in place.
    entries: dict[str, dict] = {}
    if SNAPSHOT.exists():
        for line in SNAPSHOT.read_text(encoding="utf-8").split("\n"):
            m = SNAPSHOT_LINE_RE.match(line)
            if m:
                cells = line.split("·")
                entries[m.group(1)] = {
                    "value": float(m.group(3).replace(",", "")),
                    "count": int(cells[2].strip().removesuffix("项").strip())
                    if len(cells) > 2
                    else 0,
                    "time": m.group(3),
                }
                continue
            m = TABLE_ROW_RE.match(line)
            if m and not TABLE_HEADER_RE.match(line):
                cells = [c.strip() for c in line.strip().strip("|").split("|")]
                entries[m.group(1)] = {
                    "value": float(cells[1].replace("$", "").replace(",", "")),
                    "count": int(cells[2]),
                    "time": "03:00",
                }

    entries[iso_date] = {
        "value": round(total, 2),
        "count": count,
        "time": f"{stamp:%H:%M}",
    }

    body = [
        f"- {d} {e['time']} · ${e['value']:.2f} · {e['count']} 项"
        for d, e in sorted(entries.items())
    ]
    table = [
        f"| {d} | ${e['value']:.2f} | {e['count']} |" for d, e in sorted(entries.items())
    ]
    out = HEADER.format(modified=iso_date) + "\n".join(body + table) + "\n"
    SNAPSHOT.write_text(out, encoding="utf-8")
    return body[-1] if body[-1].startswith(f"- {iso_date} ") else body[0]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run", action="store_true", help="print the value without writing"
    )
    parser.add_argument(
        "--at",
        help="override timestamp (YYYY-MM-DDTHH:MM), used for backfilling",
    )
    args = parser.parse_args()

    stamp = (
        datetime.fromisoformat(args.at) if args.at else datetime.now().astimezone()
    ).replace(microsecond=0)

    count, total = compute()
    if args.dry_run:
        print(f"📦 {count} 项 · 💵 ${total:.2f} ({stamp:%Y-%m-%d %H:%M})")
        return 0

    line = write_snapshot(stamp, count, total)
    print(f"✅ {line} → {SNAPSHOT.relative_to(VAULT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
