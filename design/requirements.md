# Yottalert — MVP Requirements

Extracted from the PRD in `DESIGN.md`. The PRD is large; this file is the
working checklist for the first build. Items below are grouped by priority.
The MVP is what the agent ships first; P1/P2 follow once the MVP is live.

## Core principle

Yottalert is a **local-context alerting application** built on Elemental.
Users create alert rules in natural language, Yottalert resolves them into
structured monitoring criteria via Elemental, periodically diffs the graph
to surface candidate alerts, scores them, and presents every alert with
entities, events, relationships, sources, confidence, and provenance.

Architectural rule: Elemental is the system of record. Yottalert only
stores Yottalert-specific state (rules, alerts, feedback, sync run state)
plus Elemental object IDs. It never duplicates the graph.

## MVP (P0)

1. **Three-pane shell** — pinned `AppHeader`, persistent 184px dark
   `YottalertShell` sidebar (sidebar background = `--lv-sidebar-bg`, does
   not theme), single scrollable main panel. Body scrolling hidden.
2. **Elemental status pill in header** — green/amber/red dot reflecting
   API + MCP reachability (polled from `/api/yottalert/elemental/status`).
3. **Dashboard** (`/yottalert`) — status strip (6 chips), high-priority
   alerts grid (top 6 by score), recent alerts list, watched-geographies
   chip cloud, watched-entities chip cloud.
4. **Alert Builder** (`/yottalert/alerts/new`, `/yottalert/alerts/:id/edit`)
   — natural-language prompt + Interpret button, calls
   `/api/yottalert/alert-rules/interpret`, renders structured interpretation
   preview (editable), sensitivity / minimum-confidence sliders, frequency
   selector, Save + Check now buttons.
5. **Alert Detail** (`/yottalert/alerts/:id`) — report header, meta strip,
   6-bar score breakdown, summary block (what happened / why / what
   changed / next step), entities + events + relationships sections,
   evidence + provenance list, feedback bar (Useful · Not relevant ·
   Duplicate · Wrong location · Wrong entity · Too noisy · Too late ·
   Increase sensitivity · Decrease sensitivity · Add similar · Suppress
   similar).
6. **Elemental Connection Settings** (`/yottalert/settings/elemental`) —
   connection name, MCP URL, API URL, auth type, credentials (write-only),
   Test connection button, live status panel.
7. **Server services** — TypeScript modules under `server/services/`:
    - `elementalMcpClient.ts` — stable Yottalert function surface even
      if MCP tool names change.
    - `elementalApiClient.ts` — typed wrapper around the Elemental REST
      Query Server using gateway proxy.
    - `watchRuleInterpreter.ts` — deterministic NL → structured rule
      heuristic; pluggable for an ADK agent later.
    - `changeDetectionService.ts` — per-rule diff against last cursor.
    - `alertScoringService.ts` — 6-component score (relevance, novelty,
      local significance, entity importance, confidence, urgency).
    - `alertExplanationService.ts` — composes title / summary /
      whyItMatters / whatChanged / nextStep.
    - `provenanceService.ts` — source + confidence rollup.
    - `digestService.ts` — deterministic digest now; Gemini wiring later.
    - `syncScheduler.ts` — `runSyncForRule()` invoked by manual Check now
      and (later) a cron task.
    - `yottalertStore.ts` — KV-backed persistence for rules / alerts /
      sync runs / feedback. Stores Elemental object IDs only.
8. **API routes** (under `/api/yottalert/`):
    - `GET /alert-rules`, `POST /alert-rules`,
      `GET|PATCH|DELETE /alert-rules/:id`,
      `POST /alert-rules/interpret`,
      `POST /alert-rules/:id/check-now`.
    - `GET /alerts`, `GET /alerts/:id`,
      `PATCH /alerts/:id/status`, `POST /alerts/:id/feedback`.
    - `GET /elemental/status`, `POST /elemental/test-connection`.
    - `GET /digest/daily`.
9. **Theme tokens** — `--dynamic-severity-{high,medium,low,suppressed}`
   tokens for the badge pattern (12% bg / 30% border / full text).
10. **Real Elemental data** — entity autocomplete in builder uses
    `searchEntities()`; sample alerts in dashboard reference real entity
    NEIDs returned by the Elemental Query Server when reachable, and
    degrade gracefully to an explicit "no data" empty state when not.

## P1 (next)

- Entity Context Drawer (right-side teleport, opens from any entity chip).
- Geography Context Page (`/yottalert/geographies/:slug`).
- Provenance modal (`/yottalert/provenance/:objectId`).
- Theme picker with 5 presets (lovelace-dark default; lovelace-light,
  paper, bloomberg, slate).
- KV-backed alert-feedback aggregation surfaced in scoring.

## P2 (later)

- Live ADK agent SSE workflow surface for the interpret / check-now /
  digest pipelines (AgentSteps, typewriter, AgentMetaBar).
- Gemini-narrated daily/weekly digest with citation guardrail.
- Cron-driven sync scheduler (Vercel Cron) for `as_it_happens` /
  `daily_digest` / `weekly_digest` rules.
- Slack / webhook delivery destinations.

## Out of scope for this app

- Bespoke graph database (Elemental owns the graph).
- General workflow / case-management.
- Mobile-native app.
- Direct MCP from the browser — always backend-mediated.
