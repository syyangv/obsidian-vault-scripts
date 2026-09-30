#!/usr/bin/env python3
"""Audit and verify Tasks and TaskNotes plugin configuration and invariant health.

Use after upgrading the Tasks or TaskNotes plugins, or during task-system audits.
Verifies:
1. TaskNotes custom userFields ('actualStart' date field) and modal configuration.
2. TaskNotes sub-day suppression (time-estimate disabled, pomodoro in status bar disabled).
3. TaskNotes excludedFolders boundary (Pantry, Archive, TV, Knowledge, Personal).
4. tasknotes-clean.css snippet existence and activation in appearance.json.
5. Obsidian Tasks plugin customStatuses ([$], [>], [?], [!], [/], [-]).
6. Tasks query blocks syntax integrity in 待办事项/任务视图.md.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

VAULT = Path(__file__).resolve().parents[2]
TN_DIR = VAULT / ".obsidian/plugins/tasknotes"
TASKS_DIR = VAULT / ".obsidian/plugins/obsidian-tasks-plugin"
APP_JSON = VAULT / ".obsidian/appearance.json"
SNIPPET_FILE = VAULT / ".obsidian/snippets/tasknotes-clean.css"
TASK_VIEW_FILE = VAULT / "待办事项/任务视图.md"

REQUIRED_EXCLUDED_FOLDERS = [
    "Logistics/库存",
    "Archive",
    "看电视",
    "知识库",
    "个人整理",
]

EXPECTED_CUSTOM_STATUSES = {
    "$": "NON_TASK",
    ">": "NON_TASK",
    "?": "TODO",
    "!": "TODO",
    "/": "IN_PROGRESS",
    "-": "CANCELLED",
}


def audit_tasknotes() -> list[tuple[str, bool, str]]:
    results: list[tuple[str, bool, str]] = []
    manifest_path = TN_DIR / "manifest.json"
    data_path = TN_DIR / "data.json"

    if not manifest_path.exists() or not data_path.exists():
        results.append(("TaskNotes plugin installed", False, "Plugin directory or manifest missing"))
        return results

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        version = manifest.get("version", "unknown")
        results.append(("TaskNotes plugin version", True, f"v{version}"))
    except Exception as e:
        results.append(("TaskNotes manifest readable", False, str(e)))

    try:
        data = json.loads(data_path.read_text(encoding="utf-8"))
    except Exception as e:
        results.append(("TaskNotes data.json readable", False, str(e)))
        return results

    # 1. userFields actualStart
    user_fields = data.get("userFields", [])
    has_actual_start = any(
        isinstance(f, dict) and f.get("key") == "actualStart" and f.get("type") == "date"
        for f in user_fields
    )
    results.append((
        "TaskNotes actualStart userField",
        has_actual_start,
        "Registered (key: actualStart, type: date)" if has_actual_start else "MISSING actualStart date field",
    ))

    # 2. modalFieldsConfig actual-start
    modal_fields = data.get("modalFieldsConfig", {}).get("fields", [])
    actual_modal = next((f for f in modal_fields if isinstance(f, dict) and f.get("id") == "actual-start"), None)
    is_modal_enabled = actual_modal is not None and actual_modal.get("enabled", False)
    results.append((
        "TaskNotes actual-start modal field",
        is_modal_enabled,
        "Present & enabled in modal" if is_modal_enabled else "MISSING or disabled in modalFieldsConfig",
    ))

    # 3. time-estimate disabled
    time_est = next((f for f in modal_fields if isinstance(f, dict) and f.get("id") == "time-estimate"), None)
    is_time_disabled = time_est is not None and not time_est.get("enabled", True)
    results.append((
        "TaskNotes time-estimate disabled",
        is_time_disabled,
        "Disabled in modal (pure day-level)" if is_time_disabled else "ENABLED (drift: sub-day estimate active)",
    ))

    # 4. Pomodoro in status bar disabled
    pomodoro_off = not data.get("showPomodoroInStatusBar", False)
    results.append((
        "TaskNotes pomodoro status bar disabled",
        pomodoro_off,
        "Disabled (pure day-level)" if pomodoro_off else "ENABLED (drift: pomodoro active in status bar)",
    ))

    # 5. excludedFolders boundary
    excluded_raw = data.get("excludedFolders", "")
    excluded_list = [f.strip() for f in excluded_raw.split(",") if f.strip()]
    missing_exclusions = [f for f in REQUIRED_EXCLUDED_FOLDERS if f not in excluded_list]
    results.append((
        "TaskNotes excludedFolders boundaries",
        len(missing_exclusions) == 0,
        f"Protected folders excluded: {', '.join(excluded_list)}"
        if not missing_exclusions
        else f"MISSING exclusions: {', '.join(missing_exclusions)}",
    ))

    # 6. CSS snippet active
    snippet_exists = SNIPPET_FILE.exists()
    snippet_enabled = False
    if APP_JSON.exists():
        try:
            app_cfg = json.loads(APP_JSON.read_text(encoding="utf-8"))
            snippet_enabled = "tasknotes-clean" in app_cfg.get("enabledCssSnippets", [])
        except Exception:
            pass

    results.append((
        "tasknotes-clean.css snippet installed",
        snippet_exists,
        "File exists under .obsidian/snippets/" if snippet_exists else "MISSING file",
    ))
    results.append((
        "tasknotes-clean.css snippet activated",
        snippet_enabled,
        "Enabled in appearance.json" if snippet_enabled else "DISABLED in appearance.json",
    ))

    return results


def audit_tasks_plugin() -> list[tuple[str, bool, str]]:
    results: list[tuple[str, bool, str]] = []
    manifest_path = TASKS_DIR / "manifest.json"
    data_path = TASKS_DIR / "data.json"

    if not manifest_path.exists() or not data_path.exists():
        results.append(("Tasks plugin installed", False, "Plugin directory or manifest missing"))
        return results

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        version = manifest.get("version", "unknown")
        results.append(("Tasks plugin version", True, f"v{version}"))
    except Exception as e:
        results.append(("Tasks manifest readable", False, str(e)))

    try:
        data = json.loads(data_path.read_text(encoding="utf-8"))
    except Exception as e:
        results.append(("Tasks data.json readable", False, str(e)))
        return results

    # customStatuses
    custom_statuses = data.get("statusSettings", {}).get("customStatuses", [])
    found_statuses = {
        s.get("symbol"): s.get("type")
        for s in custom_statuses
        if isinstance(s, dict)
    }

    missing_statuses = []
    for sym, exp_type in EXPECTED_CUSTOM_STATUSES.items():
        if sym not in found_statuses:
            missing_statuses.append(f"[{sym}] missing")
        elif found_statuses[sym] != exp_type:
            missing_statuses.append(f"[{sym}] type {found_statuses[sym]} != {exp_type}")

    results.append((
        "Tasks custom statuses intact",
        len(missing_statuses) == 0,
        f"All 6 custom statuses present ({', '.join(sorted(found_statuses.keys()))})"
        if not missing_statuses
        else f"Status drift: {', '.join(missing_statuses)}",
    ))

    # Query blocks in 待办事项/任务视图.md
    if TASK_VIEW_FILE.exists():
        content = TASK_VIEW_FILE.read_text(encoding="utf-8")
        query_blocks = re.findall(r"```tasks\s*\n(.*?)\n```", content, re.DOTALL)
        results.append((
            "Tasks query blocks in 任务视图.md",
            len(query_blocks) > 0,
            f"Found {len(query_blocks)} tasks query blocks" if query_blocks else "No query blocks found",
        ))
    else:
        results.append(("待办事项/任务视图.md exists", False, "File not found"))

    return results


def main() -> int:
    print("=" * 68)
    print("  Obsidian Tasks & TaskNotes Invariant & Configuration Audit")
    print("=" * 68)

    all_passed = True
    print("\n--- TaskNotes Plugin (Option A: Pure TaskNotes + Pure Day Dates) ---")
    for name, ok, detail in audit_tasknotes():
        status = " [PASS] " if ok else "![FAIL]!"
        if not ok:
            all_passed = False
        print(f"{status} {name:<40} : {detail}")

    print("\n--- Obsidian Tasks Plugin (Inline Protected Sync Pools & Statuses) ---")
    for name, ok, detail in audit_tasks_plugin():
        status = " [PASS] " if ok else "![FAIL]!"
        if not ok:
            all_passed = False
        print(f"{status} {name:<40} : {detail}")

    print("\n" + "=" * 68)
    if all_passed:
        print("  All Tasks and TaskNotes configuration invariants are HEALTHY.")
        print("=" * 68)
        return 0
    else:
        print("  DRIFT DETECTED: Review the failed items above.")
        print("=" * 68)
        return 1


if __name__ == "__main__":
    sys.exit(main())
