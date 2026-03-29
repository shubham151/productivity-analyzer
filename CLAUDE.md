# Engineering Impact Dashboard — CLAUDE.md

## 1. PROJECT OVERVIEW

A single-page dashboard for engineering leaders to identify the most impactful engineers in a GitHub repository. Analyzes 90 days of GitHub activity using raw metrics + optional AI enrichment. Fully configurable scoring weights and metric toggles.

**Stack**
- Frontend: React + TypeScript (Vercel)
- Backend: FastAPI (Python)
- AI: Google Gemini (`google-generativeai` SDK, model: `gemini-2.0-flash`)
- Data: JSON files (no database)

---

## 2. CODING PRINCIPLES

### ✅ DO:
- **Small, reusable functions** (max 30-50 lines)
- **Clear function names** that describe what they do
- **Type hints** for all function arguments and returns
- **Docstrings** for all functions/classes
- **Config-driven**: All hyperparameters in config.json
- **Error handling**: Try-except blocks for I/O operations
- **Logging**: Use logger instead of print()
- **Production-ready**: Clean, tested, documented code

### ❌ DON'T:
- No magic numbers — all constants in config.json
- No print() statements — use logger
- No functions over 50 lines — split them
- No untyped function signatures
- No silent error swallowing — always log exceptions
- No hardcoded repo names, tokens, or URLs

---

## 3. ARCHITECTURE

### Data Flow
```
Pull Latest button
    → FastAPI fetches org members (filter bots)
    → Fetches 90 days merged PRs (paginated)
    → Fetches reviews + comments per PR
    → Aggregates raw metrics per member
    → Clears ai_cache.json
    → Saves metrics.json
    → Streams progress via SSE

Engineer card "Analyze" click
    → Checks ai_cache.json
    → Cache miss: calls Claude API
    → Saves result to ai_cache.json
    → Returns narrative + top PRs + work type distribution
```

### Scoring (client-side only)
```
All raw metrics normalized 0–1 across members
Weighted composite = delivery * w1 + collaboration * w2 + influence * w3
Recalculates instantly when config changes
No scoring logic on the backend
```

---

## 4. FILE STRUCTURE

```
/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Dashboard.tsx
│       │   ├── EngineerCard.tsx
│       │   ├── ConfigPanel.tsx
│       │   ├── PullProgress.tsx
│       │   └── MetricsBreakdown.tsx
│       ├── hooks/
│       │   ├── useMetrics.ts
│       │   └── useConfig.ts
│       └── types/
│           └── index.ts
│
├── backend/
│   ├── main.py
│   ├── github_client.py
│   ├── metrics.py
│   ├── ai_enrichment.py
│   ├── config.py
│   └── data/
│       ├── config.json
│       ├── metrics.json
│       └── ai_cache.json
│
└── vercel.json
```

---

## 5. API ENDPOINTS

```
GET  /api/config                    → read config.json
PUT  /api/config                    → update config.json

GET  /api/metrics                   → read cached metrics.json
POST /api/metrics/pull              → trigger GitHub data pull
GET  /api/metrics/pull/stream       → SSE progress stream

GET  /api/ai/enrich/{username}      → return cached AI result or 404
POST /api/ai/enrich/{username}      → run AI enrichment, save to cache
```

---

## 6. CONFIG SCHEMA (config.json)

```json
{
  "github": {
    "repo": "PostHog/posthog",
    "org": "PostHog",
    "days": 90,
    "min_prs_to_include": 3
  },
  "scoring": {
    "weights": {
      "delivery": 40,
      "collaboration": 40,
      "influence": 20
    },
    "metrics": {
      "prs_merged": true,
      "cycle_time": true,
      "consistency": true,
      "reviews_given": true,
      "changes_requested_rate": true,
      "review_turnaround": true,
      "review_depth": true,
      "author_diversity": true,
      "reviews_received": true,
      "changes_requested_received": true
    }
  },
  "ai": {
    "enabled": true,
    "model": "gemini-2.0-flash"
  }
}
```

---

## 7. METRICS REFERENCE

### Delivery (default 40%)
| Metric | Derivation | Direction |
|---|---|---|
| prs_merged | count of merged PRs in window | higher = better |
| cycle_time | median(merged_at - created_at) in hours | lower = better |
| consistency | weeks with ≥1 merged PR / total weeks | higher = better |

### Collaboration (default 40%)
| Metric | Derivation | Direction |
|---|---|---|
| reviews_given | count of PR reviews submitted | higher = better |
| changes_requested_rate | CHANGES_REQUESTED / total reviews given | higher = better |
| review_turnaround | median hours from PR open to first review by them | lower = better |
| review_depth | avg inline + issue comments left per review | higher = better |
| author_diversity | count of unique PR authors reviewed | higher = better |

### Influence (default 20%)
| Metric | Derivation | Direction |
|---|---|---|
| reviews_received | count of reviews received on own PRs | higher = better |
| changes_requested_received | CHANGES_REQUESTED received / total reviews received | lower = better |

---

## 8. DATA SCHEMAS

### metrics.json
```json
{
  "meta": {
    "pulled_at": "ISO timestamp",
    "date_range": { "from": "ISO", "to": "ISO" },
    "total_members": 45,
    "total_prs_analyzed": 847
  },
  "members": [
    {
      "username": "string",
      "display_name": "string",
      "avatar_url": "string",
      "metrics": {
        "prs_merged": 0,
        "median_cycle_time_hrs": 0.0,
        "consistency_weeks": 0,
        "reviews_given": 0,
        "changes_requested_rate": 0.0,
        "review_turnaround_hrs": 0.0,
        "review_depth_avg": 0.0,
        "author_diversity": 0,
        "reviews_received": 0,
        "changes_requested_received_rate": 0.0,
        "weekly_activity": []
      }
    }
  ]
}
```

### ai_cache.json
```json
{
  "username": {
    "cached_at": "ISO timestamp",
    "narrative": "string",
    "work_type_distribution": {
      "feature": 0.0,
      "bugfix": 0.0,
      "refactor": 0.0,
      "infra": 0.0,
      "chore": 0.0
    },
    "top_prs": [
      {
        "title": "string",
        "url": "string",
        "summary": "string",
        "approach": "string",
        "category": "feature | bugfix | refactor | infra | chore",
        "complexity": "trivial | moderate | significant"
      }
    ]
  }
}
```

---

## 9. ENGINEER ARCHETYPES

Derived from delivery vs collaboration score ratio. Shown as a badge on each card.

| Archetype | Condition |
|---|---|
| Anchor | delivery ≥ 60th percentile AND collaboration ≥ 60th percentile |
| Shipper | delivery ≥ 60th percentile AND collaboration < 60th percentile |
| Multiplier | collaboration ≥ 60th percentile AND delivery < 60th percentile |
| Contributor | all others |

---

## 10. FRONTEND LAYOUT

```
┌─────────────────────────────────────────────────────┐
│  Header: repo name · last pulled · [Pull Latest]    │
├────────────────────────────────┬────────────────────┤
│                                │  Config Panel      │
│  Top 5 Engineer Cards          │  Weight sliders    │
│  (collapsed by default)        │  Metric toggles    │
│  [Analyze] per card            │  Repo settings     │
│                                │                    │
│  [Show More]                   │                    │
└────────────────────────────────┴────────────────────┘
```

### Card — collapsed
```
[avatar]  Name  · [archetype badge]
          ████████░░  Score
          23 PRs · 4.2hr cycle · 31 reviews
          [Analyze ▼]
```

### Card — expanded (after Analyze)
```
[avatar]  Name  · [archetype badge]
          ████████░░  Score
          Delivery | Collaboration | Influence bars
          Work type: feature 60% · fix 20% · refactor 20%
          "Narrative summary 2-3 sentences"
          Top PRs:
            [feature] Title — summary · approach
            [bugfix]  Title — summary · approach
            [infra]   Title — summary · approach
          Weekly activity sparkline (13 weeks)
```

---

## 11. ENVIRONMENT VARIABLES

```
# Backend
GITHUB_TOKEN=ghp_...
GEMINI_API_KEY=...

# Frontend
VITE_API_BASE_URL=https://your-backend-url.com
```

---

## 12. BOT EXCLUSION LIST

Automatically excluded from all analysis:
- dependabot[bot]
- github-actions[bot]
- posthog-bot
- renovate[bot]
- Any username ending in [bot]

---

## 13. SSE PROGRESS EVENTS

Stream format for `/api/metrics/pull/stream`:
```
data: {"step": "members", "message": "Fetching org members...", "count": 45}
data: {"step": "prs", "message": "Fetching merged PRs... page 2/9", "progress": 22}
data: {"step": "reviews", "message": "Fetching reviews... 234/847 PRs", "progress": 55}
data: {"step": "aggregating", "message": "Aggregating metrics..."}
data: {"step": "saving", "message": "Saving metrics.json..."}
data: {"step": "done", "message": "Done. 38 engineers analyzed.", "total": 38}
data: {"step": "error", "message": "Error details here"}
```
