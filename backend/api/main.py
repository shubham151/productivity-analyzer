"""FastAPI application for the Engineering Impact Dashboard."""

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from ai_enrichment import enrich_engineer
from config import (
    clear_ai_cache,
    load_ai_cache,
    load_config,
    load_metrics,
    save_ai_cache,
    save_config,
    save_metrics,
)
from github_client import GitHubClient
from metrics import aggregate_metrics

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Engineering Impact Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Config endpoints
# ---------------------------------------------------------------------------


@app.get("/api/config")
async def get_config() -> dict[str, Any]:
    """Return the current configuration."""
    return load_config()


@app.put("/api/config")
async def put_config(body: dict[str, Any]) -> dict[str, Any]:
    """Replace the configuration with the provided body."""
    save_config(body)
    return body


# ---------------------------------------------------------------------------
# Metrics endpoints
# ---------------------------------------------------------------------------


@app.get("/api/metrics")
async def get_metrics() -> dict[str, Any]:
    """Return cached metrics.json (may be empty if not yet pulled)."""
    return load_metrics()


@app.post("/api/metrics/pull")
async def post_metrics_pull() -> dict[str, str]:
    """Acknowledge a pull request; client should open the SSE stream."""
    return {"status": "connect to /api/metrics/pull/stream to begin"}


@app.get("/api/metrics/pull/stream")
async def pull_stream(request: Request) -> EventSourceResponse:
    """
    SSE endpoint that fetches GitHub data and streams progress events.

    Clients should open this as an EventSource to trigger and monitor a pull.
    """

    async def generator():
        def _event(step: str, message: str, **extra) -> dict:
            return {"data": json.dumps({"step": step, "message": message, **extra})}

        token = os.getenv("GITHUB_TOKEN")
        if not token:
            yield _event("error", "GITHUB_TOKEN environment variable is not set")
            return

        config = load_config()
        gh_cfg = config["github"]
        repo = gh_cfg["repo"]
        org = gh_cfg["org"]
        days = gh_cfg["days"]
        min_prs = gh_cfg.get("min_prs_to_include", 3)

        window_end = datetime.now(timezone.utc)
        window_start = window_end - timedelta(days=days)

        client = GitHubClient(token)
        try:
            # Step 1 – org members
            yield _event("members", "Fetching org members…")
            members = await client.get_org_members(org)
            yield _event("members", f"Found {len(members)} members", count=len(members))

            # Step 2 – merged PRs
            yield _event("prs", "Fetching merged PRs…", progress=0)
            pr_count_ref: list[int] = [0]

            async def pr_progress(page: int, count: int) -> None:
                pr_count_ref[0] = count
                yield_queue.append(
                    _event("prs", f"Fetching merged PRs… page {page} ({count} so far)", progress=count)
                )

            yield_queue: list[dict] = []
            prs = await client.get_merged_prs(repo, window_start, pr_progress)
            for ev in yield_queue:
                yield ev
            yield _event("prs", f"Found {len(prs)} merged PRs", progress=len(prs))

            # Step 3 – reviews + inline comments
            total_prs = len(prs)
            yield _event("reviews", f"Fetching reviews for {total_prs} PRs…", progress=0)
            reviewed_ref: list[int] = [0]

            async def review_progress(completed: int) -> None:
                pct = round(completed / total_prs * 100)
                reviewed_ref[0] = completed
                yield_queue2.append(
                    _event(
                        "reviews",
                        f"Fetching reviews… {completed}/{total_prs} PRs",
                        progress=pct,
                    )
                )

            yield_queue2: list[dict] = []
            pr_numbers = [p["number"] for p in prs]
            pr_details = await client.fetch_pr_details(repo, pr_numbers, review_progress)
            for ev in yield_queue2:
                yield ev
            yield _event("reviews", f"Reviews fetched for {total_prs} PRs", progress=100)

            # Step 4 – aggregate
            yield _event("aggregating", "Aggregating metrics…")
            member_metrics = aggregate_metrics(
                members, prs, pr_details, window_start, window_end
            )

            # filter by minimum PR count
            included = [m for m in member_metrics if m["metrics"]["prs_merged"] >= min_prs]

            # Step 5 – save
            yield _event("saving", "Saving metrics.json…")
            payload: dict[str, Any] = {
                "meta": {
                    "pulled_at": window_end.isoformat(),
                    "date_range": {
                        "from": window_start.isoformat(),
                        "to": window_end.isoformat(),
                    },
                    "total_members": len(members),
                    "total_prs_analyzed": len(prs),
                },
                "members": [
                    {k: v for k, v in m.items() if k != "_prs"}
                    for m in included
                ],
                # store PR lists separately for AI enrichment
                "_pr_map": {m["username"]: m["_prs"] for m in included},
            }
            save_metrics(payload)
            clear_ai_cache()

            yield _event(
                "done",
                f"Done. {len(included)} engineers analyzed.",
                total=len(included),
            )

        except Exception as e:
            logger.error("Pull failed: %s", e, exc_info=True)
            yield _event("error", str(e))
        finally:
            await client.close()

    return EventSourceResponse(generator())


# ---------------------------------------------------------------------------
# AI enrichment endpoints
# ---------------------------------------------------------------------------


@app.get("/api/ai/enrich/{username}")
async def get_ai_enrich(username: str) -> dict[str, Any]:
    """Return cached AI enrichment for a user, or 404 if not cached."""
    cache = load_ai_cache()
    if username not in cache:
        raise HTTPException(status_code=404, detail="No cached enrichment for this user")
    return cache[username]


@app.post("/api/ai/enrich/{username}")
async def post_ai_enrich(username: str) -> dict[str, Any]:
    """Run Gemini enrichment for a user and cache the result."""
    config = load_config()
    ai_cfg = config.get("ai", {})
    if not ai_cfg.get("enabled", True):
        raise HTTPException(status_code=400, detail="AI enrichment is disabled in config")

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set")

    metrics_data = load_metrics()
    if not metrics_data:
        raise HTTPException(status_code=400, detail="No metrics data — run a pull first")

    member = next(
        (m for m in metrics_data.get("members", []) if m["username"] == username),
        None,
    )
    if member is None:
        raise HTTPException(status_code=404, detail=f"Engineer '{username}' not found in metrics")

    pr_map = metrics_data.get("_pr_map", {})
    prs = pr_map.get(username, [])

    try:
        result = await enrich_engineer(
            username=username,
            metrics=member["metrics"],
            prs=prs,
            model_name=ai_cfg.get("model", "gemini-2.0-flash"),
            api_key=api_key,
        )
    except Exception as e:
        logger.error("AI enrichment failed for %s: %s", username, e)
        raise HTTPException(status_code=500, detail=str(e))

    from datetime import datetime, timezone

    enriched: dict[str, Any] = {
        "cached_at": datetime.now(timezone.utc).isoformat(),
        **result,
    }

    cache = load_ai_cache()
    cache[username] = enriched
    save_ai_cache(cache)

    return enriched
