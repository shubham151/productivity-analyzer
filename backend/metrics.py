"""Aggregate raw GitHub data into per-member metrics."""

import logging
from collections import defaultdict
from datetime import datetime
from statistics import median
from typing import Any

logger = logging.getLogger(__name__)

WEEKS = 13


def _parse_dt(ts: str) -> datetime:
    """Parse an ISO timestamp string to a timezone-aware datetime."""
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def _hours_between(start_ts: str, end_ts: str) -> float:
    """Calculate hours elapsed between two ISO timestamp strings."""
    return (_parse_dt(end_ts) - _parse_dt(start_ts)).total_seconds() / 3600


def _week_index(dt: datetime, window_start: datetime) -> int:
    """Return the 0-based week bucket (capped at WEEKS-1) for a datetime."""
    days = (dt - window_start).days
    return max(0, min(days // 7, WEEKS - 1))


def aggregate_metrics(
    members: list[dict[str, Any]],
    prs: list[dict[str, Any]],
    pr_details: dict[int, dict[str, Any]],
    window_start: datetime,
    window_end: datetime,
) -> list[dict[str, Any]]:
    """
    Compute per-member metrics from raw GitHub data.

    Args:
        members: List of {username, avatar_url} dicts.
        prs: List of merged PR dicts from GitHubClient.get_merged_prs.
        pr_details: Mapping of pr_number → {reviews, comments}.
        window_start: Start of the analysis window (timezone-aware).
        window_end: End of the analysis window (timezone-aware).

    Returns:
        List of member dicts with computed metrics, sorted by prs_merged desc.
    """
    member_set = {m["username"] for m in members}
    member_map = {m["username"]: m for m in members}

    # --- accumulators ---
    prs_merged: dict[str, list[dict]] = defaultdict(list)
    cycle_times: dict[str, list[float]] = defaultdict(list)
    weekly: dict[str, list[int]] = defaultdict(lambda: [0] * WEEKS)

    # reviewer → list of review events
    reviews_given: dict[str, list[dict]] = defaultdict(list)
    # reviewer → {pr_num → inline_comment_count}
    inline_by_reviewer: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    # reviewer → set of unique authors reviewed
    reviewed_authors: dict[str, set] = defaultdict(set)

    # pr_author → list of review events received
    reviews_received: dict[str, list[dict]] = defaultdict(list)

    for pr in prs:
        author = pr["author"]
        pr_num = pr["number"]
        details = pr_details.get(pr_num, {"reviews": [], "comments": []})

        if author in member_set:
            prs_merged[author].append(pr)
            cycle_times[author].append(_hours_between(pr["created_at"], pr["merged_at"]))
            merged_dt = _parse_dt(pr["merged_at"])
            weekly[author][_week_index(merged_dt, window_start)] += 1

        for review in details["reviews"]:
            reviewer = review["reviewer"]
            if reviewer not in member_set or reviewer == author:
                continue
            reviews_given[reviewer].append({
                "pr_num": pr_num,
                "pr_author": author,
                "state": review["state"],
                "submitted_at": review["submitted_at"],
                "pr_created_at": pr["created_at"],
            })
            reviewed_authors[reviewer].add(author)
            if author in member_set:
                reviews_received[author].append({
                    "reviewer": reviewer,
                    "state": review["state"],
                })

        for comment in details["comments"]:
            commenter = comment["author"]
            if commenter in member_set and commenter != author:
                inline_by_reviewer[commenter][pr_num] += 1

    result: list[dict[str, Any]] = []

    for username in member_set:
        merged = prs_merged[username]
        ct = cycle_times[username]
        given = reviews_given[username]
        received = reviews_received[username]

        # delivery
        prs_count = len(merged)
        median_cycle = median(ct) if ct else 0.0
        weeks_active = sum(1 for w in weekly[username] if w > 0)

        # collaboration
        rev_count = len(given)
        cr_given = sum(1 for r in given if r["state"] == "CHANGES_REQUESTED")
        cr_rate = cr_given / rev_count if rev_count else 0.0

        turnaround_list: list[float] = []
        seen_prs: set[int] = set()
        for r in sorted(given, key=lambda x: x["submitted_at"]):
            if r["pr_num"] not in seen_prs:
                seen_prs.add(r["pr_num"])
                hrs = _hours_between(r["pr_created_at"], r["submitted_at"])
                if hrs >= 0:
                    turnaround_list.append(hrs)
        median_turnaround = median(turnaround_list) if turnaround_list else 0.0

        total_inline = sum(inline_by_reviewer[username].values())
        depth_avg = total_inline / rev_count if rev_count else 0.0
        author_div = len(reviewed_authors[username])

        # influence
        rev_received_count = len(received)
        cr_received = sum(1 for r in received if r["state"] == "CHANGES_REQUESTED")
        cr_received_rate = cr_received / rev_received_count if rev_received_count else 0.0

        result.append({
            "username": username,
            "display_name": username,
            "avatar_url": member_map[username].get("avatar_url", ""),
            "metrics": {
                "prs_merged": prs_count,
                "median_cycle_time_hrs": round(median_cycle, 2),
                "consistency_weeks": weeks_active,
                "reviews_given": rev_count,
                "changes_requested_rate": round(cr_rate, 4),
                "review_turnaround_hrs": round(median_turnaround, 2),
                "review_depth_avg": round(depth_avg, 4),
                "author_diversity": author_div,
                "reviews_received": rev_received_count,
                "changes_requested_received_rate": round(cr_received_rate, 4),
                "weekly_activity": weekly[username],
            },
            # keep PR list for AI enrichment (title + url only)
            "_prs": [{"title": p["title"], "url": p["url"], "number": p["number"]} for p in merged],
        })

    return sorted(result, key=lambda m: m["metrics"]["prs_merged"], reverse=True)
