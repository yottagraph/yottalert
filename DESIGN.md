# Yottalert

## Vision

Build a web application called Yottalert. Tagline: "Context-aware alerts from the YottaGraph." Use Nuxt 3 + Vue 3 + Vuetify 3 + TypeScript in SPA mode. No mock data — use Elemental's MCP server and Elemental APIs for entities, events, relationships, geographies, sources, and provenance.

Implement the three-pane shell (app.vue + AppHeader.vue + YottalertShell.vue) following the Wealth Atlas blueprint: pinned header, persistent 184px dark sidebar (sidebar background hard-coded as --lv-sidebar-bg, does not theme), and a single scrollable main panel. Apply the --dynamic-\* token system via useLovelaceTheme() with five presets (lovelace-dark, lovelace-light, paper, bloomberg, slate). Hide body scrolling; scroll lives inside YottalertShell.

Create services: elementalMcpClient.ts, elementalApiClient.ts, changeDetectionService.ts, alertScoringService.ts, alertExplanationService.ts, provenanceService.ts, syncScheduler.ts, digestService.ts. The MCP client must expose stable Yottalert function names even if Elemental tool names change. Never invoke MCP from the browser.

Build screens: Dashboard, Watch Area Onboarding, Alert Detail, Entity Context Drawer, Geography Context Page, Provenance View, Elemental Connection Settings. Onboarding is now ZIP/county first: set one or more watch areas, pick one or more interests, then monitor important alerts for those areas. The Alert Detail page answers what happened / why it matters / what changed / who-where / evidence / confidence / next step, with a 6-component score breakdown and a feedback bar (Useful · Not relevant · Duplicate · Wrong location · Wrong entity · Too noisy · Too late · Increase sensitivity · Decrease sensitivity · Add similar · Suppress similar).

Use the Wealth Atlas agent UX for live workflow surfaces: SSE through /api/agent/[engineId]/stream, live step card under the in-flight bubble with AgentSteps (6-step Yottalert taxonomy: Dialogue → Watch Resolution → Graph Retrieval → Change Detection → Scoring → Composition), requestAnimationFrame typewriter at ~840 chars/sec, post-completion AgentMetaBar with model, tokens, cost, and feedback. Fall back to a deterministic Nitro endpoint when the ADK agent is unavailable.

Use the Gemini-brief pipeline for the daily/weekly digest: deterministic context loader → Gemini composition at temperature 0.3 → citation guardrail that strips any [N] not in the ALLOWED CITATIONS set. Cache by (userId, frequency, style, focus, tone, model) for 1 hour. Show a composition-source chip (green = Gemini, amber = deterministic fallback) and a tokens/cost chip strip. Render markdown with [N] → #source-N superscripts.

Local DB tables: users, organizations, elemental_connections, alert_rules, alerts, alert_evidence_refs, alert_feedback, sync_runs. Store only Yottalert state and Elemental object IDs — never duplicate the graph.

API routes per §8 above. Empty/error states per §10. Security per §11. Build order per §12. Acceptance per §13.

The app must be simple enough for an executive demo but real enough to operate against Elemental. The interface should make it obvious that Yottalert is using live Elemental context: entities, events, relationships, sources, confidence, and provenance — every single time.

PRD: Yottalert
Product tagline: Context-aware alerts from the YottaGraph.

Version 1.0 · Owner: Lovelace · Status: Draft synthesized from PRD-Yottalert.txr, 2026-05-20_ui_prd.md, AGENT_PIPELINE_UX_PRD.md, design-tokens.md, ui-architecture.md

1. Product Overview
   Yottalert is a local-context alerting application built on Elemental and the YottaGraph. Users create alerts around geographies, entities, events, and relationships, then Yottalert uses Elemental's MCP tools and APIs to retrieve live graph context, detect meaningful change, score candidate alerts, and present them in a simple, executive-readable interface with explainable evidence and provenance.

Mental model: Google Alerts (create a watch, get notified) — but the data source is Elemental's context graph rather than a search index. Every alert is grounded in entities, events, relationships, sources, and provenance, with editable structured criteria derived from a natural-language prompt.

Architectural rule: Elemental is the system of record for graph data. Yottalert is the monitoring, alerting, explanation, and workflow layer. Yottalert never duplicates Elemental's graph; it stores Elemental object IDs and Yottalert-specific state only.

2. Goals and Non-Goals
   2.1 Goals
   Let users create alert rules in natural language and have Elemental resolve them into structured monitoring criteria.
   Periodically query Elemental for new/changed entities, events, and relationships matching each rule.
   Score candidate alerts and surface only those above the user's sensitivity threshold.
   Present every alert with entities, events, relationships, source evidence, and confidence — inspectable without leaving the app.
   Provide a consistent three-pane shell (top app bar, persistent dark left nav, scrollable main panel) consistent with the Wealth Atlas blueprint so Yottalert feels like the rest of the Lovelace tenant suite.
   Use the chat-first agent surface with live workflow steps + typewriter streaming for the watch-rule interpreter, "check now" flow, and explanation generation.
   Use the Gemini-narrated brief pattern for daily/weekly digests so digests are cited markdown over deterministic data context — never invented numbers.
   2.2 Non-Goals (v1)
   A bespoke graph database (Elemental is the source of truth).
   A general workflow/case-management tool (only alert lifecycle and feedback).
   A mobile-native app (responsive web only; iOS-specific fixes inherited from the Wealth Atlas blueprint).
   Direct MCP invocation from the browser (always backend-mediated).
   A universal agent orchestration framework — Yottalert ships a thin pipeline, not a runtime.
3. Target Users
   Persona Primary monitoring concern
   FSI analyst
   Local economic, real-estate, corporate, and regulatory signals around branch markets
   Enterprise risk
   Facilities, suppliers, customers, geographies
   Real estate / infra investor
   Properties, zoning, permits, litigation, municipal activity
   Public affairs
   Local government, public meetings, policy shifts, community issues
   Elemental power user
   Lightweight alerting layer atop graph context
4. Primary Use Cases
   ID Use case Example
   UC-1
   Local context monitoring
   "Alert me when new events, entities, or relationships appear in Downtown Pittsburgh related to commercial real estate stress."
   UC-2
   Entity monitoring
   "Alert me when BNY Mellon appears in new local events, new relationships, or new documents connected to Pittsburgh."
   UC-3
   Relationship monitoring
   "Alert me when a monitored company becomes connected to a zoning hearing, lawsuit, permit filing, public meeting, infrastructure disruption, or adverse local news item."
   UC-4
   Event-type monitoring
   "Alert me when Elemental detects new business closures, permit changes, public hearings, lawsuits, infrastructure disruptions, or public-safety events in Allegheny County."
   UC-5
   Portfolio monitoring
   "Monitor these 200 branch locations and alert me when a local event may affect operations, reputation, demand, or regulatory exposure."
5. Functional Requirements
   5.1 Elemental Integration
   Yottalert must use Elemental as the source of truth via three channels:

Elemental MCP server — tool-based access to graph queries, entity/event/relationship lookup, source retrieval, provenance.
Elemental API — structured REST/GraphQL calls for deterministic application workflows.
Local Yottalert DB — user-specific state only (rules, history, preferences, feedback, delivery logs).
Selection rule: prefer the API for deterministic application workflows; prefer MCP for flexible graph exploration and natural-language watch-query interpretation.

5.2 MCP Client Contract (/services/elementalMcpClient.ts)
Exposes stable Yottalert function names even if underlying Elemental MCP tool names change (mapping layer required).

searchEntities(query, filters)
getEntity(entityId)
searchEvents(query, filters)
getEvent(eventId)
getRelationships(entityId, filters)
getRelatedEntities(entityId, depth, filters)
getEventsForEntity(entityId, filters)
getEventsForGeography(geography, filters)
getEntitiesForGeography(geography, filters)
getSourcesForObject(objectId)
getProvenanceForObject(objectId)
getGraphNeighborhood(seedObject, depth, filters)
resolveUserWatchQuery(naturalLanguagePrompt)
The client must handle: connection config, tool discovery, tool invocation, schema validation, error handling, response normalization, retry, logging, permission-aware access control.

5.3 API Client Contract (/services/elementalApiClient.ts)
fetchEntityById(entityId)
fetchEventById(eventId)
fetchRelationshipById(relationshipId)
fetchGeographyContext(geoInput)
fetchProvenance(objectId)
fetchSourceDocument(sourceId)
fetchRecentChanges(filters)
fetchGraphDelta(watchRuleId, sinceTimestamp)
5.4 Alert Rule Object
Each rule has: name, naturalLanguageGoal, watchTargetType (geography | entity | relationship | event_type | portfolio | natural_language), watchTargetValue, eventCategories, entityTypes, relationshipTypes, geographyConstraints, timeWindow, sensitivity, minimumConfidence, deliveryFrequency, deliveryDestination, exclusions, enabled.

Delivery frequency (Google Alerts parity): as_it_happens, daily_digest, weekly_digest, dashboard_only.

5.5 Watch-Query Interpretation
When the user submits natural language, the backend calls resolveUserWatchQuery(prompt) and returns structured monitoring criteria. Example input → output:

Input: "Monitor Downtown Pittsburgh for commercial real estate stress."

{
"watchTargetType": "geography",
"geography": { "name": "Downtown Pittsburgh", "type": "neighborhood" },
"eventCategories": [
"business_closure", "commercial_permit", "zoning_hearing",
"foreclosure", "tax_lien", "lawsuit", "vacancy_signal", "local_news"
],
"entityTypes": [
"property", "business", "developer",
"government_body", "financial_institution"
],
"relationshipTypes": [
"located_in", "owns", "leases", "filed",
"subject_of", "appears_in", "adjacent_to"
],
"timeWindow": "last_30_days",
"minimumConfidence": 0.7
}
The structured interpretation is always editable before save.

5.6 Change Detection
For each enabled rule, the sync scheduler periodically checks Elemental for:

New entity matching the rule
New event matching the rule
New relationship between watched objects
Changed property on a watched entity
Changed relationship strength or confidence
New source evidence attached to an object
New event cluster in a watched geography
New connection between a watched entity and a watched geography
New provenance that changes confidence or interpretation
Significant increase in matching event volume over a defined window
Storage rule: watermarks and snapshots only, never full graph copies. Per-rule state:

lastCheckedAt
lastElementalCursor
lastSeenObjectIds
lastSeenRelationshipIds
lastSeenEventIds
lastAlertedAt
5.7 Alert Scoring
Alert Score = Relevance × Novelty × Local Significance
× Entity Importance × Confidence × Urgency
Severity band Score
High
80–100
Medium
60–79
Low
40–59
Suppressed
< 40
Each component is computed from Elemental data where possible (centrality, source confidence, entity-resolution confidence, urgency signals from event metadata).

5.8 Alert Object
type YottalertAlert = {
id: string;
watchAreaId: string;
elementalObjectIds: string[];
elementalEntityIds: string[];
elementalEventIds: string[];
elementalRelationshipIds: string[];
title: string;
summary: string;
whyItMatters: string;
whatChanged: string;
suggestedNextStep: string;
geographyLabel?: string;
severity: "high" | "medium" | "low" | "suppressed";
score: number;
scoreBreakdown: {
relevance: number; novelty: number; localSignificance: number;
entityImportance: number; confidence: number; urgency: number;
};
confidence: number;
createdAt: string;
sourceCount: number;
provenanceStatus: "complete" | "partial" | "unavailable";
status: "new" | "read" | "archived" | "suppressed";
};
5.9 Provenance Requirements
Every alert must show: source document/item, source URL or identifier, ingestion timestamp, published timestamp (if known), extracted claim or event, entity-resolution confidence, relationship confidence, event-extraction confidence, geography-resolution confidence, and Elemental object IDs.

6. Data Model (Yottalert Local DB)
   Table Key fields
   users
   id, email, name, organization_id, created_at
   organizations
   id, name, created_at
   elemental_connections
   id, organization_id, connection_name, mcp_server_url, api_base_url, auth_type, encrypted_credentials_ref, status, last_checked_at, created_at
   watch_areas
   id, user_id, geography_type, geography_code, geography_label, geography_neid, interests_json, minimum_confidence, last_checked_at, created_at, updated_at
   alerts
   id, organization_id, watch_area_id, title, summary, why_it_matters, what_changed, suggested_next_step, severity, score, score_breakdown_json, confidence, elemental_object_refs_json, source_count, provenance_status, status, created_at
   alert_evidence_refs
   id, alert_id, elemental_source_id, elemental_object_id, evidence_type, display_text, confidence, created_at
   alert_feedback
   id, alert_id, user_id, feedback_type, comment, created_at
   sync_runs
   id, organization_id, watch_area_id, status, started_at, completed_at, objects_checked, candidate_alerts_created, errors_json
7. Backend Services
   /services/elementalMcpClient.ts // MCP wrapper, stable function surface
   /services/elementalApiClient.ts // Typed API client
   /services/changeDetectionService.ts // Watch-area sync diff
   /services/alertScoringService.ts // 6-factor score
   /services/alertExplanationService.ts // Composes title/summary/whyItMatters/whatChanged/nextStep
   /services/provenanceService.ts // Source + confidence rollup
   /services/syncScheduler.ts // Cron / queue runner
   /services/digestService.ts // Daily/weekly Gemini-narrated digest
8. API Routes
   GET /api/health
   GET /api/elemental/status
   POST /api/elemental/test-connection
   GET /api/watch-area
   POST /api/watch-area
   PATCH /api/watch-area
   POST /api/watch-area/check-now
   GET /api/geographies/search
   GET /api/alerts
   GET /api/alerts/:id
   PATCH /api/alerts/:id/status
   POST /api/alerts/:id/feedback
   GET /api/entities/:elementalEntityId
   GET /api/events/:elementalEventId
   GET /api/relationships/:elementalRelationshipId
   GET /api/geographies/context
   GET /api/digest/daily
   POST /api/sync/run
9. UI Specification
   Stack note: The canonical implementation follows the Wealth Atlas blueprint (2026-05-20*ui_prd.md): Nuxt 3 + Vue 3 + Vuetify 3 + TypeScript, SPA mode, file-based routing under pages/, file-based API under server/api/. The palette/typography rules from design-tokens.md (HSL CSS custom properties, Space Grotesk + JetBrains Mono, sidebar-always-dark) are adopted but expressed as the Wealth Atlas --dynamic-* / --lv-sidebar-\_ token names. The page primitives from ui-architecture.md (PageHeader / SectionCard / FilterBar) are reused as Vue equivalents.

9.1 Stack and conventions
Layer Choice
Framework
Nuxt 3, SPA (ssr: false)
UI kit
Vuetify 3 via vuetify-nuxt-module
Language
TypeScript, <script setup lang="ts"> only
Auth
Auth0 (Lovelace platform); dev bypass via userName env var
Theming
useLovelaceTheme() composable + Vuetify themes from a single preset list in utils/theme/themePresets.ts
Agents
ADK Python agents (Vertex AI Agent Engine) with deterministic Nitro fallback; SSE via /api/agent/[engineId]/stream
Briefs
Gemini 2.5 Flash, server-composed with deterministic fallback
Vuetify defaults set once in nuxt.config.ts:

defaults: {
VBtn: { variant: 'flat', rounded: 'lg' },
VCard: { rounded: 'lg', variant: 'outlined' },
VTextField: { variant: 'outlined', density: 'comfortable', color: 'primary' },
VSelect: { variant: 'outlined', density: 'comfortable', color: 'primary' },
VChip: { size: 'small', variant: 'tonal' },
VDialog: { VCard: { variant: 'flat' } },
VTooltip: { contentClass: 'lv-tooltip' },
VMenu: { contentClass: 'lv-menu' },
}
Auto-imports under components/** and composables/** (path-prefix off); utils/ is excluded from auto-import scanning to avoid false-positive named exports.

9.2 App Shell — header + persistent left nav + scrollable main
Four top-level concerns mirror the Wealth Atlas blueprint:

app.vue — Vuetify root, global dialogs, conditional framework rendering.
components/AppHeader.vue — top app bar, always visible on authenticated routes.
components/yottalert/YottalertShell.vue — the feature shell (left nav + main scrollable area).
pages/yottalert/\*.vue — feature pages wrapped in YottalertShell.
Critical layout rule: html, body, #\_\_nuxt, .v-application, .v-main are all height: 100%; overflow: hidden in assets/brand-globals.css. Scrolling lives inside YottalertShell's main panel, not the body. This is what allows a pinned header and persistent sidebar with internal scroll.

9.2.1 Top header (AppHeader.vue)
<v-app-bar app density="default">. Left → right:

Brand block — Lovelace logo SVG + Yottalert wordmark in --font-headline.
Spacer.
Theme picker — palette icon → v-menu with ThemePresetPicker and Quick Toggle (dark↔light).
Elemental connection status pill — green dot when MCP+API both reachable, amber when degraded, red when down. (Yottalert-specific addition — replaces the agent-mode badge from Wealth Atlas.)
Settings gear — opens SettingsDialog.vue (⇧⌘G / Alt+Shift+G).
User avatar menu — proxied avatar via useProxiedAvatar.
Background is a CSS gradient driven by var(--header-gradient-start) → var(--header-gradient-end). Across all presets these are intentionally dark; icons and the wordmark are forced white.

9.2.2 Left nav + main panel (YottalertShell.vue)
.yottalert-shell // 100% column
└─ .yottalert-layout // row, flex: 1
├─ aside.yottalert-sidebar // 184px fixed, dark, internally scrollable
└─ .yottalert-content // flex: 1, column
└─ .yottalert-scroll // overflow-y: auto
├─ <slot /> // page main panel
└─ <YottalertProvenanceFooter />
Sidebar contract:

Width: flex: 0 0 184px.
Background: hard-coded --lv-sidebar-bg (near-black) — does not change with theme.
Foreground: --lv-sidebar-fg-rgb so chrome stays light text on dark even when the active palette is light.
Sections: 14px SVG icon + 10px uppercase letter-spaced label, divided by 1px translucent borders.
Yottalert's sidebar sections:

Section Items
Navigation
Dashboard · Digest · Settings
Current watch
(single ZIP/county watch area with change shortcut)
Recent sync runs
(last 5 with status dot + relative time)
Active link uses rgba(63, 234, 0, 0.16) background with HSL primary text — intentionally hard-coded cyber-green even on non-Lovelace presets (sidebar = brand chrome).

9.2.3 Page wrap pattern
<template>
<YottalertShell>

<main class="alerts-page">
<header class="page-head">
<span class="kicker">YOTTALERT</span>
<h1 class="page-title">Recent alerts</h1>
<p class="page-subtitle">12 high severity · 34 medium · last sync 3m ago</p>
</header>
<section>...</section>
</main>
</YottalertShell>
</template>

<script setup lang="ts">
definePageMeta({ layout: false });
</script>

max-width: 1640px for the dashboard, 960px for narrow reading surfaces (alert detail, builder).

9.3 Theming
Single source of truth: utils/theme/themePresets.ts. Ship five presets to start:

ID Mode Notes
lovelace-dark
dark
Default cyber-dark Lovelace brand
lovelace-light
light
Muted green primary for daytime/demo
paper
light
Editorial finance palette (navy primary #0A4D8C)
bloomberg
dark
Amber-on-black terminal feel — natural fit for alerts
slate
dark
Low-glare, mint primary
Each preset's tokens includes brand colors (primary, primaryStrong, secondary, accent), surfaces, text, chrome, header gradient (always dark), RGB triplets for tinted overlays, overlay tokens, map tokens, and scoreRamp: [low, mid, high] for severity choropleth.

Two-channel application in useLovelaceTheme.applyThemeById:

vuetifyTheme.change(preset.vuetifyTheme) — swaps Vuetify M3 components.
applyCssVariables(preset) — writes ~30 --dynamic-\* properties onto document.documentElement, plus data-theme-id and data-theme-mode.
Canonical patterns:

.chip {
background: rgba(var(--dynamic-fg-rgb), 0.06);
color: var(--dynamic-text-secondary);
border: 1px solid rgba(var(--dynamic-fg-rgb), 0.12);
}
.chip.primary {
background: rgba(var(--dynamic-primary-rgb), 0.15);
color: var(--dynamic-primary-strong);
}
Persistence: active theme persists to KV at /users/{uid}/apps/yottalert/settings/theme; last-dark and last-light tracked separately in localStorage for Quick Toggle. First-visit default reads prefers-color-scheme.

Severity color mapping (Yottalert-specific addition):

Severity Token Default values
High
--dynamic-severity-high
hsl(0 72% 51%) / hsl(0 62% 50%) (red, mapped to --status-danger from design-tokens.md)
Medium
--dynamic-severity-medium
hsl(36 100% 50%) / hsl(36 100% 55%) (orange, --status-warning)
Low
--dynamic-severity-low
hsl(226 100% 50%) / hsl(226 100% 60%) (blue, --status-info)
Suppressed
--dynamic-severity-suppressed
hsl(0 0% 60%) / hsl(0 0% 50%) (gray, --status-neutral)
Badge pattern: 12% opacity background + 30% opacity border + full-strength text (carried directly from design-tokens.md's bg-status-{level}/12 text-status-{level} border border-status-{level}/30).

9.4 Typography
Token Use
--font-primary / --font-brand
FK Grotesk / Inter / Space Grotesk fallback — body
--font-headline
FK Grotesk Mono — page titles and section headings, weight 400
--font-mono
FK Grotesk Mono / JetBrains Mono — chips, kickers, scores, IDs, "data" feel
Standard size scale:

Class Definition
.text-page-title
text-3xl font-semibold tracking-tight
.text-section-title
text-lg font-semibold tracking-tight
.text-card-title
text-base font-semibold tracking-tight
.text-body
text-sm text-foreground
.text-metadata
text-xs text-muted-foreground
9.5 Pages
9.5.1 Dashboard (/yottalert or /yottalert/dashboard)
Answers: What changed that I should care about?

Layout (top → bottom, in a max-width: 1640px main):

Page head — kicker YOTTALERT, title Watch overview, subtitle "Live Elemental context · last sync {relative}".
Status strip — 6 chips: Elemental connection status, last sync timestamp, active rules count, alerts in last 24h, high-severity count, provenance health (% with complete provenance).
High-priority alerts (3-column grid on xl, single column on md) — top 6 alert cards by score.
Recent alerts — vertical list, 20 rows with severity-tinted left border.
Watched geographies — chip cloud with alert volume per geography.
Watched entities — chip cloud with alert volume per entity.
Alert volume by category — sparkline grid (event categories × last 7 days).
Source / provenance health — small horizontal bar: % complete · % partial · % unavailable.
Alert card anatomy (used wherever alerts render):

Severity dot + uppercase mono severity label (top-left).
Score chip (top-right) — mdi-meter icon + integer score on rgba(--dynamic-primary-rgb, 0.1) background.
14px primary title.
12px geography or entity tag (link to context).
13px one-sentence summary.
12px italic muted "Why it matters" (one line, truncated).
Footer row: source count chip (mdi-source-branch), confidence chip (e.g. 87%), relative time (e.g. 12m ago).
9.5.2 Watch Area Onboarding (/yottalert/onboarding)
Layout: single centered card with two steps:

Step 1 — geography selection:

ZIP/county search input backed by `/api/yottalert/geographies/search`.
User picks one geography result that resolves to `{ geographyType, geographyCode, geographyLabel, geographyNeid }`.

Step 2 — interest chips:

User selects one or more chips from: Real estate, Public safety, Business, Government, Jobs, Civic news, Culture & events.
Submit stores the watch area via `POST /api/yottalert/watch-area`, then triggers `POST /api/yottalert/watch-area/check-now`.

The dashboard and sidebar always reflect this single active watch area.

9.5.3 Alert Detail Page (/yottalert/alerts/:id)
Answers, in order: What happened? Why does it matter? What changed? Who/where? What evidence? How confident? What next?

Sections (top → bottom, max-width: 960px):

Report header — kicker ALERT · {severity} (severity-tinted), title (alert.title), generated timestamp, alert-rule link, copy-link and regenerate icon buttons. Mirrors the Wealth Atlas brief header.
Meta strip — chips: geography label, entity count, event count, relationship count, source count, confidence %, score (with mdi-meter icon), provenance status. Mirrors Wealth Atlas brief meta-strip pattern; chips use rgba(--dynamic-primary-rgb, 0.08) background with primary border for the "AI" surface tells (score, confidence).
Score breakdown card — 6 horizontal bars (relevance, novelty, local significance, entity importance, confidence, urgency), each 0–100.
Summary block — summary paragraph + 3 bullets: Why it matters · What changed · Suggested next step.
Entities involved — chip list; each chip opens the Entity Context Drawer (§9.5.4).
Events involved — table (date · type · title · geography · confidence); rows open Event Detail in a side drawer.
Relationships involved — list (subject → predicate → object) with confidence bars.
Timeline — horizontal mini-timeline of related events (last 90 days), severity-colored ticks.
Geography context card — name, type, map (if Elemental returns geometry), link to Geography Context Page.
Evidence and provenance — ordered list of citations; each row has [N] ref, source name, type tag (regulatory / census / press / elemental / synthetic), published date, open ↗ link. Mirrors ZipBriefReport.vue sources block.
Feedback bar — pinned bottom: Useful | Not relevant | Duplicate | Wrong location | Wrong entity | Too noisy | Too late | Increase sensitivity | Decrease sensitivity | Add similar | Suppress similar. Submits to POST /api/alerts/:id/feedback.
9.5.4 Entity Context Drawer
Triggered by clicking any entity chip; opens as a right-side drawer via <teleport to="body"> (mirrors ZipBriefModal pattern from Wealth Atlas).

Shows: entity name, entity type, Elemental ID (mono, copy-on-click), description, known aliases, related entities (chips), recent events (table), watched relationships, sources, confidence + provenance.

9.5.5 Geography Context Page (/yottalert/geographies/:slug)
Full page wrapped in YottalertShell. Sections: geography name + type · related entities (chip cloud) · recent events (table) · event categories (volume by category) · relationship clusters (small graph viz) · watched alert rules · map (when Elemental returns geometry) · source coverage · recent changes.

9.5.6 Provenance View (modal or /yottalert/provenance/:objectId)
Source document or item · source URL/identifier · ingestion timestamp · published timestamp (if known) · extracted claim/event · entity-resolution confidence · relationship confidence · event-extraction confidence · geography-resolution confidence · Elemental object IDs.

9.5.7 Elemental Connection Settings (/yottalert/settings/elemental)
Form: connection name · MCP server URL · API base URL · auth type · credentials (write-only field; never read back) · Test connection button. Below the form: a live status panel (last checked, latest ping latency, MCP tool count discovered, last error).

9.6 Agent Pipeline UX (live workflow + meta bar)
Adopted directly from AGENT_PIPELINE_UX_PRD.md. Used in three Yottalert surfaces:

Alert builder — while resolveUserWatchQuery runs.
"Check now" — while a rule's sync runs.
Digest generation — while Gemini composes the daily/weekly digest.
Yottalert agent taxonomy (extends the standard 4-step backbone)

# Agent Icon Color Working text Completed text

1
Dialogue Agent
mdi-head-question
deep-purple
Interpreting watch goal
Intent understood
2
Watch Resolution Agent
mdi-target
blue
Resolving target via Elemental
Target resolved
3
Graph Retrieval Agent
mdi-graph
teal
Querying Elemental graph
Context assembled
4
Change Detection Agent
mdi-delta
cyan
Diffing against last cursor
Changes computed
5
Scoring Agent
mdi-meter
amber-darken-2
Scoring candidates
Candidates ranked
6
Composition Agent
mdi-file-document-edit-outline
green
Composing alert explanation
Alert ready
Steps render with the standard SummaryAgentSteps contract: 28×28 circle icon (number when pending, animated ring when working, ✓ when completed), uppercase mono agent name in accent color, 13px summary, optional 11px mono detail, right-aligned 10px mono duration (Xms or X.Xs).

Workflow card placement
Inside the message stream, directly under the in-flight assistant bubble (same pattern as Wealth Atlas pages/wealth/agent.vue):

<div v-if="msg.role === 'assistant' && msg.streaming
        && idx === chatMessages.length - 1
        && liveSteps.length"
     class="workflow-card">
  <div class="workflow-header running">
    <span class="workflow-pill running">Running</span>
    <span class="workflow-summary">
      Live agent workflow — {{ liveSteps.length }} step(s)
    </span>
  </div>
  <AgentSteps :steps="liveSteps" />
</div>
Typewriter pacing
For long composed outputs (alert summaries, digest narration), use the same requestAnimationFrame typewriter as the Wealth Atlas chat: CHARS_PER_FRAME = 14 (~840 chars/sec at 60fps), blinking ▍ caret, flushTypewriter() on stream end. Handles both incremental-delta and cumulative-snapshot SSE payloads.

Summary meta bar
After completion, the in-bubble AgentMetaBar shows: entities, events, read time, model + temperature (with ✦ sparkle), tokens (Xk in / Yk out), cost ($X.XX or <$0.01), agent-steps summary chip (6 steps in 8.2s with show/hide toggle), and thumbs-up/down feedback.

9.7 Digest as a Gemini-Narrated Brief
The daily/weekly digest follows the canonical Gemini-brief pipeline from 2026-05-20_ui_prd.md §6:

Dialogue Agent — captures digest config (frequency, watch-rule set, style, focus, tone, days window, model). No I/O.
Data Agent — calls a deterministic context loader (loadDigestContext({ userId, sinceTimestamp })) that aggregates the period's alerts, evidence refs, and counts. Returns { ...data, citations: Citation[] }.
Composition Agent — builds a system prompt + main prompt and calls Gemini 2.5 Flash at temperature 0.3. Falls back to a deterministic template when GEMINI_API_KEY is missing so dev boxes never 500.
Citation Agent — strips any [N] reference whose N is not in the ALLOWED CITATIONS set. This is the guardrail that prevents the model from inventing footnotes.
Required output schema:

# What changed

[3-8 bullets, each ending with _(Source: <publication or dataset> [N])_]

# What to watch

[2-3 forward-looking items with sources]

# High-severity alerts

[ordered list with score and one-sentence why-it-matters]
Frontend (DigestBriefReport.vue) mirrors ZipBriefReport.vue:

Report header (kicker YOTTALERT · DAILY DIGEST, title, generated timestamp, cached pill, copy-markdown + regenerate buttons).
Meta strip (alert count, rule count, model + temperature, composition source gemini | deterministic, tokens, cost, read minutes).
Expandable agent-steps card.
Markdown body with :deep(sup.cite-ref a) linking [N] → #source-N as primary-colored mono superscripts.
Sources block (ordered, with type tags and open ↗ links).
Caching: 1 hour by (userId, frequency, style, focus, tone, model); forceRegenerate: true bypasses. Response always carries cached, cache_age_sec, composition_source (green chip for Gemini, amber for deterministic), usage: { prompt_tokens, completion_tokens, total_tokens, cost_usd, model, latency_ms }.

Loading state: "Composing daily digest… Numbers are not invented — they come straight from the deterministic substrate."

9.8 Reusable building blocks
Component Purpose
AppHeader.vue
Top bar; theme picker, Elemental status, settings, user menu
YottalertShell.vue
Left nav + main scroll container
ThemePresetPicker.vue
Palette grid (compact in header, full in settings)
AlertCard.vue
Severity-tinted alert summary card
AlertScoreBreakdown.vue
6-bar score visualization
AlertFeedbackBar.vue
Fixed-bottom feedback chips for alert detail
EntityContextDrawer.vue
Right-side drawer for entity inspection
ProvenanceCard.vue
Source + confidence panel
AgentSteps.vue
Animated workflow step list (shared)
AgentMetaBar.vue
Run summary chips + feedback (shared)
DigestBriefReport.vue
Gemini-narrated digest surface
ServerStatus.vue / ServerStatusFooter.vue
Health + version pinned at the bottom
SettingsDialog.vue
Global preferences (theme, defaults, connections)
Composables: useLovelaceTheme(), useAgentChat(), useAlertRuleBuilder(), useElementalStatus(), usePrefsStore() + Pref<T>, useUserState(), useTenantConfig(), useNotification(), useProxiedAvatar().

10. Empty and Error States
    Render explicit, well-named states for every failure mode (the app is live-data-dependent, so empty states matter):

State UX
Elemental connection unavailable
Banner in header (red dot), retry CTA, link to connection settings
MCP tool unavailable
Inline notice on the affected surface with the tool name and a Retry button
API endpoint unavailable
Same pattern; degrade to MCP if equivalent exists
No entities / events / relationships found
Empty card with kicker + single helpful sentence
No changes since last sync
"No new changes found for this alert rule. Yottalert checked Elemental for matching entities, events, relationships, and source updates. No new matching graph changes were found since the last sync."
Provenance unavailable
Provenance card collapses to a muted "Provenance unavailable" line; alert still renders with provenanceStatus: "unavailable" flag
User lacks permission
Standard 403 card with the requested object ID and a contact-admin CTA
Watch query too ambiguous
"This watch rule needs a more specific target. Elemental found multiple possible matches for 'Oakland.' Choose one: 1. Oakland neighborhood, Pittsburgh, PA · 2. Oakland, CA · 3. Oakland County, MI"
Agent-error surface for streaming runs uses the Wealth Atlas pattern: red-tinted panel inside the message stream, bold "Agent failed." headline in #fca5a5, plain message, optional mono detail, Retry button.

11. Security
    MCP and API credentials stored server-side only.
    No raw MCP tool invocation from the browser. All Elemental calls route through /server/api/_.
    Role-based access checks before every Elemental query.
    All Elemental object access logged (user, time, object ID, tool/endpoint).
    All natural-language watch queries logged for auditability.
    No untrusted tool output rendered as executable HTML (markdown rendering uses the inline-friendly renderer described in 2026-05-20_ui_prd.md §4.4; if fenced code or tables become needed, swap to marked + DOMPurify).
    Rate limiting on /api/sync/_ and /api/watch-area/\*.
    Organization-level Elemental connection settings (users inherit credentials from their org).
12. Build Priority
    Elemental connection settings page + elementalMcpClient.ts + elementalApiClient.ts.
    Watch-area schema + database migrations.
    ZIP/county onboarding with interest chips.
    Manual Check now workflow + sync-run record.
    changeDetectionService.ts + alertScoringService.ts.
    Dashboard.
    Alert Detail page (with full provenance and feedback).
    Entity Context Drawer + Geography Context Page.
    Feedback loop (writes to alert_feedback, surfaces in scoring weights over time).
    Daily digest via Gemini brief pipeline.
    Scheduled sync (cron/queue) for as_it_happens, daily_digest, weekly_digest rules.
13. Acceptance Criteria
    The v1 is successful when:

A user can connect Yottalert to Elemental.
A user can create an alert rule from natural language; Elemental resolves it; the structured interpretation is editable before save.
Yottalert can detect graph changes since the last cursor and create alerts from real Elemental data (no mock data anywhere in the live path).
Every alert displays entities, events, relationships, sources, confidence, and provenance — and lets the user inspect each.
The user can give feedback on every alert; feedback persists.
The app degrades cleanly when MCP, API, KV, or GEMINI_API_KEY are missing.
Header is pinned, left nav is persistent and dark-anchored, and the main panel is the only scroll container on every page.
Theme picker swaps Vuetify components and --dynamic-\* tokens simultaneously and survives reload.
Chat surfaces (interpreter, check-now, digest) stream via SSE, show a live workflow card under the in-flight bubble, and reveal long outputs at ~840 chars/sec via the typewriter.
Digest contains no number absent from the deterministic data context and no [N] reference outside the ALLOWED CITATIONS set.

## Status

The product now uses a ZIP/county-first watch area model. Users can configure multiple areas and interest chips, including culture/events, then receive ranked alerts across those areas. The prior free-form Alert Builder and `alert-rules` API surface have been removed from the running implementation.

## Modules

- **Three-pane shell** — `components/AppHeader.vue` + `components/yottalert/YottalertShell.vue` + `YottalertProvenanceFooter`, with a slim nav (`Dashboard`, `Digest`, `Settings`) and watch-area count footer.
- **Watch Area Onboarding** — `pages/yottalert/onboarding.vue`, backed by `/api/yottalert/geographies/search` and `/api/yottalert/watch-area`, supports adding or editing areas, then immediate `/api/yottalert/watch-area/check-now`.
- **Dashboard** — `pages/yottalert/index.vue` shows all watch areas, status strip, high-priority cards, and recent alerts.
- **Alert Detail** — `pages/yottalert/alerts/[id].vue` keeps score breakdown, evidence/provenance, and feedback.
- **Server services** — `changeDetectionService.ts` now consumes `WatchArea` + interest chips; `syncScheduler.ts` runs `runSyncForWatchArea()`; `yottalertStore.ts` persists multiple watch areas per user plus alerts/feedback/sync runs.
- **API routes** — `watch-area` (get/post/patch/check-now), `geographies/search`, `alerts`, `digest/daily`, and Elemental status/connection routes.
- **Composables** — `useElementalStatus`, `useYottalert`.

## Roadmap (P1/P2)

See `design/requirements.md` for the prioritized backlog. Notable
follow-ups: live ADK agent SSE workflow (workflow card + typewriter +
AgentMetaBar), Gemini-narrated digest with citation guardrail, cron
sync scheduler, Slack/webhook delivery, and the theme picker (5
presets).
