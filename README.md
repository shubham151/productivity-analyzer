# Engineering Impact Dashboard

A single-page dashboard for engineering leaders to identify the most impactful engineers in a GitHub repository — built for the PostHog repo using 90 days of real activity.

**Live demo**: https://productivity-analyzer-frontend.vercel.app/

---

## What "impact" means here

Most GitHub dashboards measure volume — commits, lines of code, files changed. Volume is easy to game and doesn't tell you who is actually moving the team forward.

This dashboard measures three things that are harder to fake:

### 1. Delivery (default 40%)
Are they consistently shipping real work?

| Metric | Why it matters |
|---|---|
| PRs merged | Raw output — a necessary baseline, but not sufficient on its own |
| Median cycle time | Fast-moving PRs signal clear thinking and well-scoped work. Long cycle times often mean unclear requirements or too-large diffs |
| Active weeks | Consistency beats bursts. An engineer active 12/13 weeks is more reliable than one who ships 20 PRs in one week then disappears |

### 2. Collaboration (default 40%)
Are they making their teammates better?

| Metric | Why it matters |
|---|---|
| Reviews given | Participation in the review process is a direct multiplier on team quality |
| Changes-requested rate | A high rate means they're doing real reviews, not rubber-stamping. Low means LGTMs without engagement |
| Review turnaround | Fast reviewers unblock teammates. Slow reviewers create queues that slow the whole team down |
| Inline comments per review | Specific, line-level feedback is more actionable than a top-level comment. Depth signals genuine engagement |
| Unique authors reviewed | Broad reviewers spread knowledge across the team. Narrow reviewers create knowledge silos |

### 3. Influence (default 20%)
Is their work trusted by the team?

| Metric | Why it matters |
|---|---|
| Reviews received | Work that attracts peer engagement tends to touch shared areas or raise important questions |
| Changes-requested received rate | Low means they're shipping clean, well-considered code. High means rework is common — a signal worth investigating |

---

## How scoring works

1. Every metric is normalized 0–1 across the current team (min-max). Rankings are relative — not absolute thresholds.
2. Lower-is-better metrics (cycle time, review turnaround, changes-requested received) are inverted so higher normalized score always means better.
3. Each dimension score is the average of its enabled, normalized metrics.
4. Composite score = weighted sum of dimension scores. Weights are fully configurable in the UI.
5. **All scoring happens client-side** — the backend only returns raw numbers. Adjusting weights or toggling metrics recalculates instantly without a re-pull.

Engineer archetypes are derived from delivery vs. collaboration percentile position:
- **Anchor** — high delivery AND high collaboration (60th percentile in both)
- **Shipper** — high delivery, lower collaboration
- **Multiplier** — high collaboration, lower delivery
- **Contributor** — solid across the board, below 60th in both

---

## Known limitations

- **Cycle time favours small PRs** — an engineer who ships 20 small PRs will score better on cycle time than one who ships 3 large architectural changes. Context matters.
- **Changes-requested rate is ambiguous** — a high rate could mean rigorous reviews or a combative reviewer. The AI narrative helps distinguish these.
- **Review depth via inline comments is a proxy** — some engineers leave fewer, higher-quality comments. A low depth score doesn't necessarily mean shallow engagement.
- **Influence is the weakest signal** — reviews received depends heavily on what areas an engineer works in (shared infra gets more eyes than product features).
- **90-day window** — a new joiner or someone on leave will be penalized unfairly. The `min_prs_to_include` threshold (default: 3) filters out low-sample engineers.
- **Bot exclusion is heuristic** — accounts ending in `[bot]` and known PostHog bots are excluded, but unusual bot naming may slip through.

---

## AI enrichment

Clicking **Analyze** on any engineer card calls Google Gemini with their metrics and PR titles. Gemini returns:
- A 2–3 sentence plain-English narrative of their impact pattern
- A work type breakdown (feature / bugfix / refactor / infra / chore)
- Their top 3 most significant PRs with a summary and approach

This is intentionally on-demand — running Gemini for all engineers upfront would be slow and expensive. The leader can drill into whoever is interesting.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript, Vite |
| Backend | FastAPI (Python 3.12) |
| AI | Google Gemini 3.0 Flash Preview |
| Data source | GitHub REST API v3 |
| Hosting | Vercel |
| Storage | JSON files (no database) |

---

## Running locally

```bash
# Backend
cd backend
cp .env.example .env        # add GITHUB_TOKEN and GEMINI_API_KEY
pip install -r requirements.txt
uvicorn api.main:app --reload

# Frontend
cd frontend
npm install
npm run dev                 # proxies /api → localhost:8000
```
