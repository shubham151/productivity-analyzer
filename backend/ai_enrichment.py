"""Gemini AI enrichment for engineer profiles."""

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

try:
    from google import genai
    from google.genai import types as genai_types
    _GEMINI_AVAILABLE = True
except ImportError:
    _GEMINI_AVAILABLE = False
    logger.warning("google-genai not installed; AI enrichment disabled")


def _build_prompt(username: str, metrics: dict[str, Any], prs: list[dict[str, Any]]) -> str:
    """Construct the Gemini prompt for an engineer enrichment request."""
    pr_lines = "\n".join(
        f"  - [{p.get('number', '?')}] {p['title']}  {p['url']}"
        for p in prs[:20]
    ) or "  (none in window)"

    return f"""You are analyzing engineering impact for a busy engineering leader at PostHog.

Engineer GitHub username: {username}

Metrics over the last 90 days:
- PRs merged: {metrics['prs_merged']}
- Median cycle time (created → merged): {metrics['median_cycle_time_hrs']:.1f} hours
- Active weeks (out of 13): {metrics['consistency_weeks']}
- Code reviews given: {metrics['reviews_given']}
- Fraction of reviews with CHANGES_REQUESTED: {metrics['changes_requested_rate']:.0%}
- Median hours to first review after PR opened: {metrics['review_turnaround_hrs']:.1f}
- Avg inline comments per review: {metrics['review_depth_avg']:.1f}
- Unique PR authors reviewed: {metrics['author_diversity']}
- Reviews received on own PRs: {metrics['reviews_received']}
- Fraction of own reviews that were CHANGES_REQUESTED: {metrics['changes_requested_received_rate']:.0%}

Merged PRs (most recent first):
{pr_lines}

Respond with ONLY valid JSON — no markdown fences, no extra keys:
{{
  "narrative": "2–3 sentence impact summary for an engineering leader. Be specific and insightful; reference concrete patterns from the data.",
  "work_type_distribution": {{
    "feature": 0.0,
    "bugfix": 0.0,
    "refactor": 0.0,
    "infra": 0.0,
    "chore": 0.0
  }},
  "top_prs": [
    {{
      "title": "exact PR title",
      "url": "PR URL",
      "summary": "one sentence describing what was shipped",
      "approach": "one sentence on the technical approach or impact",
      "category": "feature | bugfix | refactor | infra | chore",
      "complexity": "trivial | moderate | significant"
    }}
  ]
}}

Rules:
- work_type_distribution values must sum to 1.0 (use 0.0 for absent types)
- top_prs: include up to 3 most impactful PRs, infer category from title
- narrative must be grounded in the numbers above — no generic praise"""


async def enrich_engineer(
    username: str,
    metrics: dict[str, Any],
    prs: list[dict[str, Any]],
    model_name: str,
    api_key: str,
) -> dict[str, Any]:
    """
    Call Gemini to generate an enrichment payload for an engineer.

    Returns the parsed JSON response dict.
    Raises RuntimeError if Gemini is unavailable, or ValueError on bad response.
    """
    if not _GEMINI_AVAILABLE:
        raise RuntimeError("google-genai package is not installed")

    client = genai.Client(api_key=api_key)
    prompt = _build_prompt(username, metrics, prs)

    try:
        response = await client.aio.models.generate_content(
            model=model_name,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                temperature=0.3,
                response_mime_type="application/json",
            ),
        )
        text = response.text.strip()

        # Strip markdown code fences if the model added them
        if text.startswith("```"):
            parts = text.split("```")
            text = parts[1] if len(parts) >= 2 else text
            if text.startswith("json"):
                text = text[4:].strip()

        return json.loads(text)

    except json.JSONDecodeError as e:
        logger.error("Gemini returned unparseable JSON for %s: %s", username, e)
        raise ValueError(f"Gemini response was not valid JSON: {e}") from e
    except Exception as e:
        logger.error("Gemini API error for %s: %s", username, e)
        raise
