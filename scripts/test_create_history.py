import json
import subprocess
import sys
from pathlib import Path

import pytest
from create_history import ProgressError, convert_progress


def export(*questions, total=None):
    return {
        "data": {
            "userProgressQuestionList": {
                "totalNum": len(questions) if total is None else total,
                "questions": list(questions),
            }
        }
    }


def question(**changes):
    return {
        "questionStatus": "SOLVED",
        "title": "Two Sum",
        "titleSlug": "two-sum",
        "lastSubmittedAt": "2026-01-02T08:00:00+08:00",
        "lastResult": "AC",
        **changes,
    }


def test_conversion_filters_and_converts_timezone():
    records, skipped, non_ac = convert_progress(
        export(question(), question(questionStatus="ATTEMPTED"))
    )
    assert records == [
        {"title": "Two Sum", "titleSlug": "two-sum", "timestamp": 1767312000}
    ]
    assert (skipped, non_ac) == (1, 0)


def test_solved_with_non_ac_last_result_is_kept_and_reported():
    records, _, non_ac = convert_progress(export(question(lastResult="WA")))
    assert len(records) == 1
    assert non_ac == 1


@pytest.mark.parametrize(
    "data",
    [
        {},
        export(question(), total=2),
        export(question(), question()),
        export(question(lastSubmittedAt="2026-01-02T00:00:00")),
        export(question(titleSlug="../invalid")),
        export(question(questionStatus="UNKNOWN")),
    ],
)
def test_rejects_invalid_input(data):
    with pytest.raises(ProgressError):
        convert_progress(data)


def test_cli_writes_import_json_and_does_not_clobber_on_error(tmp_path):
    source, target = tmp_path / "progress.json", tmp_path / "history.json"
    source.write_text(json.dumps(export(question())), encoding="utf-8")
    script = Path(__file__).with_name("create_history.py")
    result = subprocess.run(
        [sys.executable, str(script), str(source), str(target)],
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0
    assert json.loads(target.read_text(encoding="utf-8"))[0]["titleSlug"] == "two-sum"
    source.write_text("{}", encoding="utf-8")
    result = subprocess.run(
        [sys.executable, str(script), str(source), str(target)],
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1
    assert json.loads(target.read_text(encoding="utf-8"))[0]["titleSlug"] == "two-sum"
