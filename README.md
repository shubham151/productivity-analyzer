# Engineering Impact Dashboard

A single-page dashboard for engineering leaders to identify the most impactful engineers in a GitHub repository.

**Live demo**: https://productivity-analyzer-frontend.vercel.app/

---

## Approach

Most GitHub dashboards measure volume — commits, lines of code, files changed. This dashboard measures something harder to fake: **quality of contribution and quality of collaboration**.

Impact is modeled across three dimensions:

- **Delivery** — are they consistently shipping real work? (merged PRs, cycle time, week-over-week consistency)
- **Collaboration** — are they making teammates better? (reviews given, how deeply they engage, how quickly they unblock others)
- **Influence** — is their work trusted? (reviews received, low revision request rate)

All three dimensions are configurable — an engineering leader can adjust weights and toggle individual metrics to reflect their team's context. Scoring is normalized across the team so rankings are relative, not absolute. Every number shown is a raw metric so findings are always verifiable.

On-demand AI enrichment (Gemini) generates a plain-English narrative for each engineer and surfaces their most significant PRs with a summary of what they built and how — giving the leader signal beyond the numbers.

---

## Tech Stack

| Layer         | Technology                                |
| ------------- | ----------------------------------------- |
| Frontend      | React + TypeScript, Vite                  |
| Backend       | FastAPI (Python)                          |
| AI Enrichment | Google Gemini 3.0 Flash Preview           |
| Data Source   | GitHub REST API                           |
| Hosting       | Vercel (frontend), configurable (backend) |
| Data Storage  | JSON files (no database)                  |

---

## Key Design Decisions

- **No database** — all data stored as JSON files on the backend, pulled on demand
- **Scoring is client-side** — backend returns raw metrics, all weighting happens in the browser so config changes are instant
- **AI is on-demand** — Gemini enrichment runs only when a leader expands an engineer's card, results cached to avoid repeat calls
- **Pull Latest clears AI cache** — ensures enrichment always reflects the most recent data window
- **PostHog org members only** — filters to internal team, excludes external contributors and bots
