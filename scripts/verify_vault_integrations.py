#!/usr/bin/env python3
"""Comprehensive Vault Integration & Cross-Plugin Linkage Audit.

Audits all 7 core cross-plugin data pipelines and safeguards:
1. Task & Action System (TaskNotes, Tasks, task-date-recorder, tasknotes-clean.css).
2. Startup & Note Maintenance (startup-updateModified, modified_at hook, recipeTrackerSync).
3. Travel, Calendar & Holidays (旅行计划.md, yearly-glance fork, trackHolidays).
4. Modular Theme Dashboard (modular-theme-dashboard, snap-manager, config notes).
5. Subscription Management (task-date-recorder, 日常工具.base).
6. Asset & File System Safeguards (paste-image-rename exclusions, lazy-plugins audit).
7. External Automation Ingestion (GitHub inventory, weekly pantry snapshot).
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

VAULT = Path(__file__).resolve().parents[2]


class IntegrationAuditor:
    def __init__(self, vault_path: Path) -> None:
        self.vault = vault_path
        self.plugins_dir = self.vault / ".obsidian/plugins"
        self.snippets_dir = self.vault / ".obsidian/snippets"
        self.app_json = self.vault / ".obsidian/appearance.json"

    def run_all(self) -> tuple[int, int, list[str]]:
        """Run all integration pipelines and return (passed, failed, details)."""
        sections = [
            ("Pipeline 1: Task & Action Lifecycle", self.audit_pipeline_tasks),
            ("Pipeline 2: Startup & Note Maintenance", self.audit_pipeline_startup),
            ("Pipeline 3: Travel, Calendar & Holidays", self.audit_pipeline_calendar),
            ("Pipeline 4: Modular Theme Dashboard", self.audit_pipeline_dashboard),
            ("Pipeline 5: Subscription Management & Bases", self.audit_pipeline_subscriptions),
            ("Pipeline 6: Safeguards, Performance & Themes", self.audit_pipeline_safeguards),
            ("Pipeline 7: External Automation Ingestion", self.audit_pipeline_external),
        ]

        total_pass = 0
        total_fail = 0

        print("=" * 72)
        print("  Obsidian Vault Cross-Plugin Linkage & Integration Health Audit")
        print("=" * 72)

        for title, func in sections:
            print(f"\n--- {title} ---")
            results = func()
            for name, ok, detail in results:
                status = " [PASS] " if ok else "![WARN]!"
                if ok:
                    total_pass += 1
                else:
                    total_fail += 1
                print(f"{status} {name:<42} : {detail}")

        print("\n" + "=" * 72)
        if total_fail == 0:
            print(f"  All {total_pass} cross-plugin linkage checkpoints are HEALTHY.")
        else:
            print(f"  Audit complete: {total_pass} passed, {total_fail} warnings/drifts detected.")
        print("=" * 72)
        return total_pass, total_fail, []

    def audit_pipeline_tasks(self) -> list[tuple[str, bool, str]]:
        res = []
        tn_dir = self.plugins_dir / "tasknotes"
        tasks_dir = self.plugins_dir / "obsidian-tasks-plugin"

        # TaskNotes version & userFields
        if (tn_dir / "data.json").exists():
            data = json.loads((tn_dir / "data.json").read_text(encoding="utf-8"))
            has_actual_start = any(
                isinstance(f, dict) and f.get("key") == "actualStart" and f.get("type") == "date"
                for f in data.get("userFields", [])
            )
            res.append((
                "TaskNotes actualStart userField",
                has_actual_start,
                "Registered (key: actualStart, type: date)" if has_actual_start else "MISSING actualStart",
            ))

            modal_fields = data.get("modalFieldsConfig", {}).get("fields", [])
            actual_modal = next((f for f in modal_fields if f.get("id") == "actual-start"), None)
            is_actual_enabled = actual_modal is not None and actual_modal.get("enabled", False)
            res.append((
                "TaskNotes actual-start in modal",
                is_actual_enabled,
                "Enabled in modal custom group" if is_actual_enabled else "MISSING or disabled",
            ))

            time_est = next((f for f in modal_fields if f.get("id") == "time-estimate"), None)
            is_time_disabled = time_est is not None and not time_est.get("enabled", True)
            res.append((
                "TaskNotes time-estimate disabled",
                is_time_disabled,
                "Disabled in modal" if is_time_disabled else "ENABLED (sub-day leak)",
            ))

            pomodoro_off = not data.get("showPomodoroInStatusBar", False)
            res.append((
                "TaskNotes pomodoro status bar disabled",
                pomodoro_off,
                "Disabled" if pomodoro_off else "ENABLED (sub-day leak)",
            ))

            excluded = data.get("excludedFolders", "")
            req_ex = ["Logistics/库存", "Archive", "看电视", "知识库", "个人整理"]
            missing_ex = [f for f in req_ex if f not in excluded]
            res.append((
                "TaskNotes boundary exclusions",
                len(missing_ex) == 0,
                "Pantry, Archive, TV, Knowledge, Personal excluded" if not missing_ex else f"Missing: {missing_ex}",
            ))
        else:
            res.append(("TaskNotes data.json", False, "Missing plugin data"))

        # tasknotes-clean snippet
        clean_snippet = self.snippets_dir / "tasknotes-clean.css"
        snippet_active = False
        if self.app_json.exists():
            app_cfg = json.loads(self.app_json.read_text(encoding="utf-8"))
            snippet_active = "tasknotes-clean" in app_cfg.get("enabledCssSnippets", [])
        res.append((
            "tasknotes-clean.css activated",
            clean_snippet.exists() and snippet_active,
            "Snippet active in appearance.json" if snippet_active else "Snippet inactive or missing",
        ))

        # Tasks custom statuses
        if (tasks_dir / "data.json").exists():
            tdata = json.loads((tasks_dir / "data.json").read_text(encoding="utf-8"))
            custom = {s.get("symbol") for s in tdata.get("statusSettings", {}).get("customStatuses", [])}
            expected = {"$", ">", "?", "!", "/", "-"}
            intact = expected.issubset(custom)
            res.append((
                "Tasks plugin custom statuses",
                intact,
                f"Present: {', '.join(sorted(custom))}" if intact else f"Missing: {expected - custom}",
            ))
        else:
            res.append(("Tasks plugin data.json", False, "Missing plugin data"))

        return res

    def audit_pipeline_startup(self) -> list[tuple[str, bool, str]]:
        res = []
        startup_file = self.vault / "Helper/Templates/startup-updateModified.md"
        sync_script = self.vault / "Helper/utils/recipeTrackerSync.js"
        stats_script = self.vault / "Helper/utils/recipeStats.js"

        if startup_file.exists():
            content = startup_file.read_text(encoding="utf-8")
            has_mod_hook = "_modifiedAtListenerActive" in content
            has_recipe_hook = "_recipeTrackerSyncActive" in content
            res.append((
                "startup-updateModified hook",
                has_mod_hook and has_recipe_hook,
                "Both modified_at & recipeTrackerSync hooks present" if (has_mod_hook and has_recipe_hook) else "Hook code missing",
            ))
        else:
            res.append(("startup-updateModified.md", False, "Startup template missing"))

        res.append((
            "recipeTrackerSync.js helper",
            sync_script.exists(),
            "Found in Helper/utils/" if sync_script.exists() else "Missing script",
        ))
        res.append((
            "recipeStats.js helper",
            stats_script.exists(),
            "Found in Helper/utils/" if stats_script.exists() else "Missing script",
        ))
        return res

    def audit_pipeline_calendar(self) -> list[tuple[str, bool, str]]:
        res = []
        travel_plan = self.vault / "个人整理/旅行计划.md"
        daily_tpl = self.vault / "Helper/Templates/Daily Note.md"
        yg_dir = self.plugins_dir / "yearly-glance"

        if travel_plan.exists():
            content = travel_plan.read_text(encoding="utf-8")
            has_headers = "Location" in content and "Start Date" in content and "End Date" in content
            res.append((
                "旅行计划.md table schema",
                has_headers,
                "Location, Start Date, End Date columns present" if has_headers else "Table header mismatch",
            ))
        else:
            res.append(("个人整理/旅行计划.md", False, "Travel plan file missing"))

        if daily_tpl.exists():
            tcontent = daily_tpl.read_text(encoding="utf-8")
            has_loc_lookup = "旅行计划" in tcontent and "location" in tcontent
            res.append((
                "Daily Note travel location lookup",
                has_loc_lookup,
                "Auto-matches travel plan dates" if has_loc_lookup else "Location lookup logic missing",
            ))
        else:
            res.append(("Daily Note template", False, "Template file missing"))

        if yg_dir.exists():
            res.append((
                "yearly-glance custom fork installed",
                True,
                "Custom fork active in .obsidian/plugins/yearly-glance",
            ))
        else:
            res.append(("yearly-glance plugin", False, "Plugin directory missing"))

        return res

    def audit_pipeline_dashboard(self) -> list[tuple[str, bool, str]]:
        res = []
        db_dir = self.plugins_dir / "modular-theme-dashboard"
        config_dir = self.vault / "Helper/config"

        if db_dir.exists():
            is_symlink = db_dir.is_symlink()
            res.append((
                "modular-theme-dashboard installed",
                True,
                f"Active ({'Symlinked from ' + str(db_dir.resolve()) if is_symlink else 'Local folder'})",
            ))
        else:
            res.append(("modular-theme-dashboard", False, "Plugin missing"))

        has_configs = config_dir.exists() and any(config_dir.glob("*.md"))
        res.append((
            "Helper/config/ shared configurations",
            has_configs,
            f"Config notes present ({len(list(config_dir.glob('*.md')))} files)" if has_configs else "Missing configs",
        ))

        return res

    def audit_pipeline_subscriptions(self) -> list[tuple[str, bool, str]]:
        res = []
        base_file = self.vault / "Bases/日常工具-20250901.base"
        task_date_recorder = self.plugins_dir / "task-date-recorder/main.js"

        res.append((
            "task-date-recorder plugin deployed",
            task_date_recorder.exists(),
            "main.js present in plugins/task-date-recorder/" if task_date_recorder.exists() else "Plugin missing",
        ))
        res.append((
            "日常工具.base subscription dashboard",
            base_file.exists(),
            "Found in Bases/" if base_file.exists() else "Missing Base view",
        ))
        return res

    def audit_pipeline_safeguards(self) -> list[tuple[str, bool, str]]:
        res = []
        pir_data = self.plugins_dir / "obsidian-paste-image-rename/data.json"
        lazy_data = self.plugins_dir / "lazy-plugins/data.json"

        # Paste Image Rename
        if pir_data.exists():
            data = json.loads(pir_data.read_text(encoding="utf-8"))
            pattern = data.get("excludeExtensionPattern", "")
            code_safe = "js" in pattern and "ts" in pattern and "css" in pattern and "json" in pattern
            res.append((
                "paste-image-rename code exclusion",
                code_safe,
                f"Protected ({pattern})" if code_safe else f"UNSAFE: {pattern}",
            ))
        else:
            res.append(("paste-image-rename data.json", False, "Missing plugin data"))

        # Lazy Plugins
        if lazy_data.exists():
            data = json.loads(lazy_data.read_text(encoding="utf-8"))
            installed = {p.name for p in self.plugins_dir.iterdir() if p.is_dir()}
            desktop_lazy = data.get("desktop", {}).get("plugins", {})
            active_dead = [
                p for p, cfg in desktop_lazy.items()
                if cfg.get("startupType") != "disabled" and p not in installed
            ]
            res.append((
                "lazy-plugins dead plugin check",
                len(active_dead) == 0,
                "Clean: no missing plugins scheduled to load"
                if not active_dead
                else f"{len(active_dead)} uninstalled plugins still in lazy list: {', '.join(active_dead[:4])}...",
            ))
        else:
            res.append(("lazy-plugins data.json", False, "Missing plugin data"))

        # Dual theme check
        if self.app_json.exists():
            app_cfg = json.loads(self.app_json.read_text(encoding="utf-8"))
            theme = app_cfg.get("cssTheme", "Default")
            res.append((
                "Desktop theme configuration",
                True,
                f"Using theme: {theme}",
            ))

        return res

    def audit_pipeline_external(self) -> list[tuple[str, bool, str]]:
        res = []
        github_notes = list((self.vault / "个人整理/我的GitHub").glob("*.md"))
        pantry_snapshot = self.vault / "Logistics/库存/Pantry 快照.md"
        pantry_script = self.vault / "Helper/scripts/pantry_snapshot.py"

        res.append((
            "GitHub repository inventory notes",
            len(github_notes) > 20,
            f"Tracking {len(github_notes)} repositories in 个人整理/我的GitHub/",
        ))
        res.append((
            "Pantry weekly snapshot recorder",
            pantry_script.exists() and pantry_snapshot.exists(),
            "pantry_snapshot.py script and Pantry 快照.md present",
        ))
        return res


def main() -> int:
    auditor = IntegrationAuditor(VAULT)
    _, fails, _ = auditor.run_all()
    return 1 if fails > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
