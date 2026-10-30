#!/usr/bin/env python3
"""Convert a LeetCode userProgressQuestionList response to the import format."""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


class ProgressError(ValueError):
    """The input cannot be safely converted to an import."""


def convert_progress(data: Any) -> tuple[list[dict[str, str | int]], int, int]:
    try:
        progress = data["data"]["userProgressQuestionList"]
        questions = progress["questions"]
    except (KeyError, TypeError) as exc:
        raise ProgressError("expected data.userProgressQuestionList.questions") from exc
    if not isinstance(questions, list):
        raise ProgressError("questions must be an array")
    total = progress.get("totalNum")
    if not isinstance(total, int) or isinstance(total, bool) or total < len(questions):
        raise ProgressError(
            "totalNum must be an integer at least as large as questions"
        )
    if total != len(questions):
        raise ProgressError(
            f"incomplete response: received {len(questions)} of {total} questions"
        )

    records: list[dict[str, str | int]] = []
    seen: set[str] = set()
    non_ac = 0
    for index, question in enumerate(questions):
        if not isinstance(question, dict) or question.get("questionStatus") not in {
            "SOLVED",
            "ATTEMPTED",
            "NOT_STARTED",
        }:
            raise ProgressError(
                f"question {index + 1}: missing or unknown questionStatus"
            )
        if question["questionStatus"] != "SOLVED":
            continue
        title, slug, submitted = (
            question.get(key) for key in ("title", "titleSlug", "lastSubmittedAt")
        )
        if not isinstance(title, str) or not title.strip() or len(title) > 500:
            raise ProgressError(f"question {index + 1}: invalid title")
        if (
            not isinstance(slug, str)
            or len(slug) > 300
            or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug)
        ):
            raise ProgressError(f"question {index + 1}: invalid titleSlug")
        if slug in seen:
            raise ProgressError(f"question {index + 1}: duplicate titleSlug {slug!r}")
        if not isinstance(submitted, str):
            raise ProgressError(f"question {index + 1}: missing lastSubmittedAt")
        try:
            parsed = datetime.fromisoformat(submitted)
            if parsed.utcoffset() is None:
                raise ValueError("timezone required")
            timestamp = int(parsed.timestamp())
            if not 0 <= timestamp <= 8_640_000_000_000:
                raise ValueError("timestamp outside supported range")
        except (ValueError, OverflowError, OSError) as exc:
            raise ProgressError(
                f"question {index + 1}: invalid lastSubmittedAt {submitted!r}"
            ) from exc
        if question.get("lastResult") != "AC":
            non_ac += 1
        seen.add(slug)
        records.append({"title": title, "titleSlug": slug, "timestamp": timestamp})
    records.sort(
        key=lambda record: (-int(record["timestamp"]), str(record["titleSlug"]))
    )
    return records, len(questions) - len(records), non_ac


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="LeetCode progress JSON response")
    parser.add_argument(
        "output",
        nargs="?",
        type=Path,
        default=Path("history.json"),
        help="output path (default: history.json)",
    )
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("input and output must be different files")
    try:
        with args.input.open(encoding="utf-8") as source:
            data = json.load(source)
        records, skipped, non_ac = convert_progress(data)
        with args.output.open("w", encoding="utf-8") as destination:
            json.dump(records, destination, ensure_ascii=False, indent=2)
            destination.write("\n")
    except (OSError, json.JSONDecodeError, ProgressError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(
        f"Wrote {len(records)} solved questions to {args.output}; skipped {skipped} unsolved."
    )
    print(
        "Timestamps are last submission times, which may differ from accepted times.",
        file=sys.stderr,
    )
    if non_ac:
        print(
            f"Warning: {non_ac} solved questions have a non-AC or missing lastResult.",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
