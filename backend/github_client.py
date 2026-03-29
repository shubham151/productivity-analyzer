"""Async GitHub REST API client."""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Callable, Coroutine

import httpx

logger = logging.getLogger(__name__)

GITHUB_API_BASE = "https://api.github.com"
BOT_USERNAMES: frozenset[str] = frozenset({
    "dependabot[bot]",
    "github-actions[bot]",
    "posthog-bot",
    "renovate[bot]",
})
CONCURRENCY = 15


def is_bot(username: str) -> bool:
    """Return True if the username belongs to a known bot."""
    return username in BOT_USERNAMES or username.endswith("[bot]")


class GitHubClient:
    """Async client for the GitHub v3 REST API."""

    def __init__(self, token: str) -> None:
        """Initialize with a personal access token."""
        self._client = httpx.AsyncClient(
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            timeout=30.0,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()

    async def _get_paginated(self, url: str, params: dict[str, Any] | None = None) -> list[dict]:
        """Fetch all pages of a paginated GitHub endpoint."""
        results: list[dict] = []
        page = 1
        base_params = params or {}
        while True:
            try:
                resp = await self._client.get(
                    url, params={**base_params, "per_page": 100, "page": page}
                )
                resp.raise_for_status()
                data = resp.json()
                if not data:
                    break
                results.extend(data)
                page += 1
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    break
                logger.error("HTTP %s fetching %s page %d: %s", e.response.status_code, url, page, e)
                raise
            except httpx.HTTPError as e:
                logger.error("Error fetching %s page %d: %s", url, page, e)
                raise
        return results

    async def get_org_members(self, org: str) -> list[dict[str, Any]]:
        """Fetch all non-bot members of a GitHub organization."""
        raw = await self._get_paginated(f"{GITHUB_API_BASE}/orgs/{org}/members")
        return [
            {"username": m["login"], "avatar_url": m["avatar_url"]}
            for m in raw
            if not is_bot(m["login"])
        ]

    async def get_merged_prs(
        self,
        repo: str,
        since: datetime,
        progress_cb: Callable[[int, int], Coroutine] | None = None,
    ) -> list[dict[str, Any]]:
        """Fetch all merged PRs in the repo since the given datetime."""
        prs: list[dict[str, Any]] = []
        page = 1
        while True:
            try:
                resp = await self._client.get(
                    f"{GITHUB_API_BASE}/repos/{repo}/pulls",
                    params={
                        "state": "closed",
                        "sort": "updated",
                        "direction": "desc",
                        "per_page": 100,
                        "page": page,
                    },
                )
                resp.raise_for_status()
                page_data: list[dict] = resp.json()
                if not page_data:
                    break

                stop = False
                for pr in page_data:
                    if not pr.get("merged_at"):
                        continue
                    merged_dt = datetime.fromisoformat(pr["merged_at"].replace("Z", "+00:00"))
                    if merged_dt < since:
                        stop = True
                        continue
                    if is_bot(pr["user"]["login"]):
                        continue
                    prs.append({
                        "number": pr["number"],
                        "title": pr["title"],
                        "url": pr["html_url"],
                        "author": pr["user"]["login"],
                        "created_at": pr["created_at"],
                        "merged_at": pr["merged_at"],
                    })

                if progress_cb:
                    await progress_cb(page, len(prs))

                if stop:
                    break
                page += 1

            except httpx.HTTPError as e:
                logger.error("Error fetching PRs page %d: %s", page, e)
                raise

        return prs

    async def get_pr_reviews(self, repo: str, pr_number: int) -> list[dict[str, Any]]:
        """Fetch all non-bot reviews for a pull request."""
        try:
            resp = await self._client.get(
                f"{GITHUB_API_BASE}/repos/{repo}/pulls/{pr_number}/reviews",
                params={"per_page": 100},
            )
            resp.raise_for_status()
            return [
                {
                    "reviewer": r["user"]["login"],
                    "state": r["state"],
                    "submitted_at": r["submitted_at"],
                    "body": r.get("body", ""),
                }
                for r in resp.json()
                if r.get("user") and not is_bot(r["user"]["login"])
            ]
        except httpx.HTTPError as e:
            logger.warning("Failed to fetch reviews for PR #%d: %s", pr_number, e)
            return []

    async def get_pr_review_comments(self, repo: str, pr_number: int) -> list[dict[str, Any]]:
        """Fetch all non-bot inline review comments for a pull request."""
        try:
            resp = await self._client.get(
                f"{GITHUB_API_BASE}/repos/{repo}/pulls/{pr_number}/comments",
                params={"per_page": 100},
            )
            resp.raise_for_status()
            return [
                {"author": c["user"]["login"]}
                for c in resp.json()
                if c.get("user") and not is_bot(c["user"]["login"])
            ]
        except httpx.HTTPError as e:
            logger.warning("Failed to fetch comments for PR #%d: %s", pr_number, e)
            return []

    async def fetch_pr_details(
        self,
        repo: str,
        pr_numbers: list[int],
        progress_cb: Callable[[int], Coroutine] | None = None,
    ) -> dict[int, dict[str, Any]]:
        """
        Fetch reviews and inline comments for a batch of PRs concurrently.

        Returns a dict mapping pr_number → {reviews, comments}.
        """
        semaphore = asyncio.Semaphore(CONCURRENCY)
        results: dict[int, dict[str, Any]] = {}
        completed = 0

        async def fetch_one(pr_num: int) -> None:
            nonlocal completed
            async with semaphore:
                reviews, comments = await asyncio.gather(
                    self.get_pr_reviews(repo, pr_num),
                    self.get_pr_review_comments(repo, pr_num),
                )
                results[pr_num] = {"reviews": reviews, "comments": comments}
                completed += 1
                if progress_cb and completed % 10 == 0:
                    await progress_cb(completed)

        await asyncio.gather(*[fetch_one(n) for n in pr_numbers])
        return results
