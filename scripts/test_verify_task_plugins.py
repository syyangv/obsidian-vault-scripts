"""Regression tests; no Obsidian, network, or vault writes required."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import re
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("audit", Path(__file__).with_name("verify_task_plugins.py"))
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)


class AuditTests(unittest.TestCase):
    def test_css_guard_rejects_comments_visible_rules_and_missing_modal_rule(self):
        original = audit.SNIPPET_FILE.read_text()
        uncommented = re.sub(r"/\*.*?\*/", "", original, flags=re.S)
        variants = [(original, True), ("/*" + uncommented + "*/", False),
                    (original.replace("display: none !important", "display: block !important"), False),
                    (original.replace(".date-time-picker-modal__time-input", ".renamed-time-input"), False)]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "fixture.css"
            for css, expected in variants:
                path.write_text(css)
                with patch.object(audit, "SNIPPET_FILE", path):
                    row = next(r for r in audit.audit_tasknotes() if r[0] == "TaskNotes CSS hiding guards")
                    self.assertEqual(row[1], expected)

    def test_unavailable_cli_is_unverified(self):
        with patch.object(audit.subprocess, "run", side_effect=FileNotFoundError):
            self.assertEqual(audit.audit_live(["ribbon"])[0]["state"], "UNVERIFIED")

    def test_timeout_is_unverified(self):
        with patch.object(audit.subprocess, "run", side_effect=subprocess.TimeoutExpired("obsidian", 15)):
            self.assertEqual(audit.audit_live(["ribbon"])[0]["state"], "UNVERIFIED")

    def test_no_or_incomplete_report_is_not_pass(self):
        for stdout in ("CLI unable to find Obsidian", "{}", json.dumps({"probe": "tasknotes-css-v1", "results": []})):
            with patch.object(audit.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, stdout, "")):
                self.assertEqual(audit.audit_live(["ribbon"])[0]["state"], "UNVERIFIED")

    def test_structured_report(self):
        for state in ("PASS", "FAIL", "UNVERIFIED"):
            rows = [{"surface": "ribbon", "state": state, "detail": "sample"}]
            stdout = "CLI log\n=> " + json.dumps({"probe": "tasknotes-css-v1", "results": rows})
            with patch.object(audit.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, stdout, "")):
                self.assertEqual(audit.audit_live(["ribbon"]), rows)
                self.assertEqual(audit.subprocess.run.call_args.args[0][:2], ["obsidian", "eval"])

    def test_exit_codes(self):
        for options, state, expected in (([], "UNVERIFIED", 2), ([], "FAIL", 1),
                                         (["--surface", "ribbon"], "PASS", 0),
                                         (["--static-only"], "PASS", 0)):
            with patch.object(sys, "argv", ["audit", *options]), \
                 patch.object(audit, "audit_tasknotes", return_value=[]), \
                 patch.object(audit, "audit_tasks_plugin", return_value=[]), \
                 patch.object(audit, "audit_live", return_value=[{"surface": "ribbon", "state": state}]), \
                 contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(audit.main(), expected)
                if options == ["--static-only"]:
                    self.assertIn("UI compatibility NOT verified", output.getvalue())

    def test_probe_detects_visible_ribbon_and_does_not_pass_missing_dom(self):
        probe = Path(__file__).with_name("verify_tasknotes_dom.js").read_text().replace(
            "__SURFACES__", json.dumps(list(audit.LIVE_SURFACES)))
        harness = r'''
const assert = require('node:assert/strict');
global.Element = class {};
const make = display => Object.assign(new Element(), {
  display, parentElement: null, getAttribute: () => 'Open Pomodoro timer'
});
global.getComputedStyle = el => ({display: el.display, visibility:'visible', opacity:'1'});
global.app = {vault:{getName:()=> 'syang'}, plugins:{plugins:{tasknotes:{settings:{
  showPomodoroInStatusBar:false, showTrackedTasksInStatusBar:false
}}}}};
let buttons = [make('none'), make('none')];
global.document = {querySelectorAll: s => s === '.workspace-ribbon.mod-primary [aria-label]' ? buttons : []};
const run = () => JSON.parse(eval(PROBE)).results;
assert.equal(run()[0].state, 'PASS');
assert.equal(run()[1].state, 'PASS');
assert(run().slice(2).every(r => r.state === 'UNVERIFIED'));
buttons[1].display = 'flex';
assert.equal(run()[0].state, 'FAIL');
buttons = [];
assert.equal(run()[0].state, 'UNVERIFIED');
app.vault.getName = () => 'other-vault';
assert(run().every(r => r.state === 'UNVERIFIED'));
app.vault.getName = () => 'syang';
app.plugins.plugins.tasknotes.settings.modalFieldsConfig = {fields:[{id:'time-estimate',enabled:false}]};
const modal = make('flex');
modal.querySelectorAll = () => [];
const time = make('none');
const picker = make('flex');
picker.querySelectorAll = () => [time];
global.document.querySelectorAll = s => {
  if(s === '.modal.mod-tasknotes:has(.tn-task-modal__action-bar)') return [modal];
  if(s === '.modal:has(.date-time-picker-modal__date-input)') return [picker];
  return [];
};
assert.equal(run().find(r => r.surface === 'task-modal').state, 'PASS');
assert.equal(run().find(r => r.surface === 'date-picker').state, 'PASS');
time.display = 'block';
assert.equal(run().find(r => r.surface === 'date-picker').state, 'FAIL');
app.plugins.plugins.tasknotes.settings.modalFieldsConfig.fields[0].enabled = true;
assert.equal(run().find(r => r.surface === 'task-modal').state, 'FAIL');
const tracking = make('block');
const card = make('flex');
card.querySelectorAll = s => {
  assert(s.includes('.task-card__metadata-property--totalTrackedTime'));
  assert(s.includes('.task-card__metadata-property--timeEstimate'));
  return [tracking];
};
global.document.querySelectorAll = s => s === '.tasknotes-plugin .task-card' ? [card] : [];
assert.equal(run().find(r => r.surface === 'task-cards').state, 'FAIL');
tracking.display = 'none';
assert.equal(run().find(r => r.surface === 'task-cards').state, 'PASS');
card.querySelectorAll = () => [];
assert.equal(run().find(r => r.surface === 'task-cards').state, 'UNVERIFIED');
'''.replace("PROBE", json.dumps(probe))
        subprocess.run(["node", "-e", harness], check=True, capture_output=True, text=True)


if __name__ == "__main__":
    unittest.main()
