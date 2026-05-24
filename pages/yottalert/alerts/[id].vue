<template>
    <YottalertShell>
        <main class="detail">
            <div v-if="loading" class="loader">
                <v-progress-circular indeterminate size="32" color="primary" />
            </div>
            <div v-else-if="!alert" class="empty">
                <h2 class="empty-title">Alert not found</h2>
                <p>We couldn't find an alert with this ID. It may have been archived.</p>
                <v-btn to="/yottalert" prepend-icon="mdi-arrow-left">Back to dashboard</v-btn>
            </div>
            <template v-else>
                <header class="report-head">
                    <div class="kicker" :class="`kicker-${alert.severity}`">
                        ALERT · {{ severityLabel }}
                    </div>
                    <h1 class="title">{{ alert.title }}</h1>
                    <div class="report-meta">
                        Generated {{ relativeTime(alert.createdAt) }} · Watching
                        <NuxtLink v-if="watchArea" to="/yottalert/onboarding"
                            ><span class="mono">{{ watchArea.geographyLabel }}</span></NuxtLink
                        >
                        <span v-else class="mono">unknown</span>
                    </div>
                </header>

                <div class="meta-strip">
                    <span v-if="alert.geographyLabel" class="chip"
                        ><v-icon icon="mdi-map-marker-outline" size="12" />
                        {{ alert.geographyLabel }}</span
                    >
                    <span class="chip"
                        ><v-icon icon="mdi-account-multiple-outline" size="12" />
                        {{ alert.entities.length }} entities</span
                    >
                    <span class="chip"
                        ><v-icon icon="mdi-calendar-clock-outline" size="12" />
                        {{ alert.events.length }} events</span
                    >
                    <span class="chip"
                        ><v-icon icon="mdi-graph-outline" size="12" />
                        {{ alert.relationships.length }} relationships</span
                    >
                    <span class="chip"
                        ><v-icon icon="mdi-source-branch" size="12" />
                        {{ alert.sourceCount }} sources</span
                    >
                    <span class="chip primary"
                        ><v-icon icon="mdi-meter" size="12" /> score {{ alert.score }}</span
                    >
                    <span class="chip primary"
                        >{{ Math.round(alert.confidence * 100) }}% confidence</span
                    >
                    <span class="chip" :class="`prov-${alert.provenanceStatus}`"
                        >{{ alert.provenanceStatus }} provenance</span
                    >
                </div>

                <section class="block">
                    <h2 class="section-title">Score breakdown</h2>
                    <AlertScoreBreakdown :breakdown="alert.scoreBreakdown" />
                </section>

                <section class="block">
                    <h2 class="section-title">Summary</h2>
                    <p class="summary-text">{{ alert.summary }}</p>
                    <ul class="bullets">
                        <li><span class="kicker">Why it matters</span> {{ alert.whyItMatters }}</li>
                        <li><span class="kicker">What changed</span> {{ alert.whatChanged }}</li>
                        <li>
                            <span class="kicker">Suggested next step</span>
                            {{ alert.suggestedNextStep }}
                        </li>
                    </ul>
                </section>

                <section v-if="alert.entities.length" class="block">
                    <h2 class="section-title">Entities involved</h2>
                    <div class="chips">
                        <div v-for="ent in alert.entities" :key="ent.neid" class="entity-wrap">
                            <button class="entity-chip" type="button" @click="openEntity(ent)">
                                <v-icon icon="mdi-office-building-outline" size="12" />
                                <span>{{ ent.name }}</span>
                                <span v-if="ent.type" class="entity-type">{{ ent.type }}</span>
                            </button>
                            <NuxtLink
                                :to="`/yottalert/provenance/${encodeURIComponent(ent.neid)}`"
                                class="prov-link"
                            >
                                provenance
                            </NuxtLink>
                        </div>
                    </div>
                </section>

                <section v-if="alert.events.length" class="block">
                    <h2 class="section-title">Events involved</h2>
                    <table class="event-table">
                        <thead>
                            <tr>
                                <th>When</th>
                                <th>Type</th>
                                <th>Title</th>
                                <th>Publication</th>
                                <th>Sentiment</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="evt in alert.events" :key="evt.id">
                                <td class="mono">
                                    {{ evt.occurredAt ? relativeTime(evt.occurredAt) : '—' }}
                                </td>
                                <td class="mono">{{ evt.type }}</td>
                                <td>
                                    <NuxtLink
                                        :to="`/yottalert/provenance/${encodeURIComponent(evt.id)}`"
                                        class="event-link"
                                    >
                                        {{ evt.title }}
                                    </NuxtLink>
                                    <span v-if="evt.source === 'synthetic'" class="event-badge">
                                        synthetic
                                    </span>
                                </td>
                                <td>{{ evt.publication?.name ?? '—' }}</td>
                                <td class="mono">{{ eventSentimentLabel(evt) }}</td>
                                <td>
                                    <v-btn
                                        size="x-small"
                                        variant="outlined"
                                        class="detail-btn"
                                        :loading="loadingEventId === evt.id"
                                        @click="openEvent(evt)"
                                    >
                                        Inspect
                                    </v-btn>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                <section v-if="alert.relationships.length" class="block">
                    <h2 class="section-title">Relationships involved</h2>
                    <div class="rel-list">
                        <div v-for="rel in alert.relationships" :key="rel.id" class="rel-row">
                            <span class="mono">{{ rel.subject }}</span>
                            <span class="rel-arrow">→</span>
                            <span class="rel-predicate">{{ rel.predicate }}</span>
                            <span class="rel-arrow">→</span>
                            <span class="mono">{{ rel.object }}</span>
                            <div class="rel-bar">
                                <div
                                    class="rel-bar-fill"
                                    :style="{ width: rel.confidence * 100 + '%' }"
                                />
                            </div>
                            <span class="mono">{{ Math.round(rel.confidence * 100) }}%</span>
                        </div>
                    </div>
                </section>

                <section class="block">
                    <h2 class="section-title">Evidence &amp; provenance</h2>
                    <ol v-if="alert.evidence.length" class="evidence">
                        <li
                            v-for="(ev, idx) in alert.evidence"
                            :id="`source-${idx + 1}`"
                            :key="ev.id"
                        >
                            <NuxtLink
                                class="ref-n"
                                :to="`/yottalert/provenance/${encodeURIComponent(ev.elementalSourceId ?? ev.elementalObjectId ?? ev.id)}`"
                            >
                                [{{ idx + 1 }}]
                            </NuxtLink>
                            <div class="ev-body">
                                <div class="ev-text">{{ ev.displayText }}</div>
                                <div class="ev-meta">
                                    <span class="mono">{{ ev.sourceName }}</span>
                                    <span class="tag">{{ ev.evidenceType }}</span>
                                    <span v-if="ev.publishedAt" class="mono">
                                        published {{ relativeTime(ev.publishedAt) }}
                                    </span>
                                    <span v-if="ev.ingestedAt" class="mono">
                                        ingested {{ relativeTime(ev.ingestedAt) }}
                                    </span>
                                    <a
                                        v-if="ev.sourceUrl"
                                        :href="ev.sourceUrl"
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        class="ev-link"
                                        >open ↗</a
                                    >
                                </div>
                            </div>
                            <span class="conf mono">{{ Math.round(ev.confidence * 100) }}%</span>
                        </li>
                    </ol>
                    <div v-else class="empty-block">
                        Provenance unavailable — Elemental returned no source evidence for this
                        candidate.
                    </div>
                </section>

                <AlertFeedbackBar :alert-id="alert.id" />
            </template>
        </main>

        <EntityContextDrawer v-model="drawerOpen" :entity="drawerEntity" />
        <EventContextDrawer v-model="eventDrawerOpen" :event="drawerEvent" />
    </YottalertShell>
</template>

<script setup lang="ts">
    import { computed, onMounted, ref } from 'vue';
    import { useRoute } from 'vue-router';

    import type {
        AlertEntityRef,
        AlertEventRef,
        WatchArea,
        YottalertAlert,
    } from '~/utils/yottalert/types';
    import { relativeTime, severityTone } from '~/utils/yottalert/severity';

    definePageMeta({ layout: false });

    const route = useRoute();
    const alert = ref<YottalertAlert | null>(null);
    const watchArea = ref<WatchArea | null>(null);
    const loading = ref(true);

    const drawerOpen = ref(false);
    const drawerEntity = ref<AlertEntityRef | null>(null);
    const eventDrawerOpen = ref(false);
    const drawerEvent = ref<AlertEventRef | null>(null);
    const loadingEventId = ref<string | null>(null);

    onMounted(load);

    async function load() {
        loading.value = true;
        try {
            const res = await $fetch<{ alert: YottalertAlert; watchArea: WatchArea | null }>(
                `/api/yottalert/alerts/${route.params.id}`
            );
            alert.value = res.alert;
            watchArea.value = res.watchArea;
        } catch {
            alert.value = null;
        } finally {
            loading.value = false;
        }
    }

    const severityLabel = computed(() =>
        alert.value ? severityTone(alert.value.severity).label.toUpperCase() : ''
    );

    function openEntity(ent: AlertEntityRef) {
        drawerEntity.value = ent;
        drawerOpen.value = true;
    }

    function eventSentimentLabel(evt: AlertEventRef) {
        if (typeof evt.sentiment !== 'number') return '—';
        return `${evt.sentiment > 0 ? '+' : ''}${evt.sentiment.toFixed(2)}`;
    }

    function isSparseEvent(evt: AlertEventRef): boolean {
        return (
            !evt.publication && !evt.actors?.length && !evt.rawValues && evt.source !== 'synthetic'
        );
    }

    async function openEvent(evt: AlertEventRef) {
        if (!alert.value) return;

        const events = alert.value.events;
        const idx = events.findIndex((e) => e.id === evt.id);
        if (idx < 0) return;

        if (isSparseEvent(events[idx])) {
            loadingEventId.value = evt.id;
            try {
                const res = await $fetch<{ event: AlertEventRef | null }>(
                    `/api/yottalert/events/${encodeURIComponent(evt.id)}`
                );
                if (res.event) {
                    events[idx] = {
                        ...events[idx],
                        ...res.event,
                    };
                }
            } catch {
                // Keep existing payload if detail fetch fails.
            } finally {
                loadingEventId.value = null;
            }
        }

        drawerEvent.value = events[idx];
        eventDrawerOpen.value = true;
    }
</script>

<style scoped>
    .detail {
        max-width: 960px;
        padding: 32px 32px 64px;
        margin: 0 auto;
    }
    .loader,
    .empty {
        padding: 64px 0;
        text-align: center;
        color: rgba(255, 255, 255, 0.7);
    }
    .empty-title {
        font-family: var(--font-headline);
        font-weight: 400;
        margin-bottom: 12px;
    }
    .report-head {
        margin-bottom: 18px;
    }
    .kicker {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--lv-green);
    }
    .kicker-high {
        color: var(--dynamic-severity-high);
    }
    .kicker-medium {
        color: var(--dynamic-severity-medium);
    }
    .kicker-low {
        color: var(--dynamic-severity-low);
    }
    .kicker-suppressed {
        color: var(--dynamic-severity-suppressed);
    }
    .title {
        font-family: var(--font-headline);
        font-weight: 400;
        font-size: 1.8rem;
        margin-top: 4px;
    }
    .report-meta {
        margin-top: 6px;
        color: rgba(255, 255, 255, 0.55);
        font-size: 12px;
    }
    .mono {
        font-family: var(--font-mono);
        font-size: 12px;
        color: rgba(255, 255, 255, 0.85);
    }
    .meta-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 28px;
    }
    .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        border-radius: 999px;
        font-family: var(--font-mono);
        font-size: 11px;
        background: rgba(255, 255, 255, 0.05);
        color: rgba(255, 255, 255, 0.78);
        border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .chip.primary {
        background: rgba(63, 234, 0, 0.12);
        color: var(--lv-green);
        border-color: rgba(63, 234, 0, 0.3);
    }
    .chip.prov-complete {
        color: var(--lv-green);
    }
    .chip.prov-partial {
        color: var(--dynamic-severity-medium);
    }
    .chip.prov-unavailable {
        color: var(--dynamic-severity-suppressed);
    }
    .block {
        background: var(--lv-surface);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 18px 20px;
        margin-bottom: 18px;
    }
    .section-title {
        font-family: var(--font-headline);
        font-weight: 400;
        font-size: 1.1rem;
        margin-bottom: 12px;
    }
    .summary-text {
        font-size: 14px;
        line-height: 1.55;
        color: rgba(255, 255, 255, 0.88);
        margin-bottom: 12px;
    }
    .bullets {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 8px;
    }
    .bullets li {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.85);
        line-height: 1.55;
        padding-left: 12px;
        border-left: 2px solid rgba(255, 255, 255, 0.08);
    }
    .bullets .kicker {
        display: block;
        margin-bottom: 2px;
        color: rgba(255, 255, 255, 0.45);
    }
    .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }
    .entity-wrap {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }
    .entity-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.88);
        font-size: 12px;
        cursor: pointer;
    }
    .entity-chip:hover {
        background: rgba(255, 255, 255, 0.1);
    }
    .prov-link,
    .event-link {
        color: var(--dynamic-primary);
        text-decoration: none;
        font-size: 12px;
    }
    .entity-type {
        font-family: var(--font-mono);
        font-size: 10px;
        color: rgba(255, 255, 255, 0.45);
    }
    .event-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
    }
    .event-table th {
        text-align: left;
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.45);
        padding: 6px 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .event-table td {
        padding: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        color: rgba(255, 255, 255, 0.85);
    }
    .event-badge {
        margin-left: 8px;
        display: inline-flex;
        padding: 1px 6px;
        border-radius: 999px;
        border: 1px solid rgba(255, 176, 0, 0.5);
        color: #ffcf6d;
        font-size: 10px;
        font-family: var(--font-mono);
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }
    .detail-btn {
        text-transform: none;
        letter-spacing: 0;
    }
    .rel-list {
        display: grid;
        gap: 12px;
    }
    .rel-row {
        display: grid;
        grid-template-columns: 1fr auto 1fr auto 1fr 80px 40px;
        gap: 8px;
        align-items: center;
        font-size: 12px;
    }
    .rel-arrow {
        color: rgba(255, 255, 255, 0.4);
    }
    .rel-predicate {
        font-family: var(--font-mono);
        color: var(--lv-blue-light);
    }
    .rel-bar {
        height: 6px;
        background: rgba(255, 255, 255, 0.06);
        border-radius: 999px;
        overflow: hidden;
    }
    .rel-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--lv-blue), var(--lv-green));
    }
    .evidence {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 10px;
    }
    .evidence li {
        display: grid;
        grid-template-columns: 32px 1fr auto;
        gap: 10px;
        padding: 8px 10px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.03);
        align-items: start;
    }
    .ref-n {
        font-family: var(--font-mono);
        color: var(--lv-green);
        font-size: 12px;
    }
    .ev-body {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .ev-text {
        font-size: 13px;
        line-height: 1.4;
        color: rgba(255, 255, 255, 0.88);
    }
    .ev-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        font-family: var(--font-mono);
        font-size: 11px;
        color: rgba(255, 255, 255, 0.5);
        align-items: center;
    }
    .tag {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 1px 6px;
        background: rgba(255, 255, 255, 0.06);
        border-radius: 999px;
        color: rgba(255, 255, 255, 0.75);
    }
    .ev-link {
        color: var(--lv-green);
        text-decoration: none;
    }
    .conf {
        font-family: var(--font-mono);
        font-size: 11px;
        color: rgba(255, 255, 255, 0.7);
    }
    .empty-block {
        padding: 16px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 8px;
        color: rgba(255, 255, 255, 0.55);
        font-size: 13px;
        text-align: center;
    }
</style>
