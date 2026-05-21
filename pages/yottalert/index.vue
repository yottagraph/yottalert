<template>
    <YottalertShell>
        <main class="dashboard">
            <header class="page-head">
                <span class="kicker">YOTTALERT</span>
                <h1 class="page-title">Watch overview</h1>
                <p class="page-subtitle">Live Elemental context · {{ alertSummary }}</p>
            </header>

            <StatusStrip />

            <section class="section">
                <div class="section-head">
                    <h2 class="section-title">High-priority alerts</h2>
                    <NuxtLink to="/yottalert/alerts/new" class="link"
                        ><v-icon icon="mdi-plus" size="14" /> New rule</NuxtLink
                    >
                </div>
                <div v-if="alertsLoading" class="loader">
                    <v-progress-circular indeterminate size="24" />
                </div>
                <div v-else-if="highSeverity.length" class="alert-grid">
                    <AlertCard v-for="a in highSeverity.slice(0, 6)" :key="a.id" :alert="a" />
                </div>
                <div v-else class="empty-card">
                    <div class="kicker">NO HIGH-SEVERITY ALERTS YET</div>
                    <div class="empty-text">
                        Create an alert rule and run "Check now" to surface candidate alerts
                        directly from Elemental.
                    </div>
                    <v-btn
                        color="primary"
                        to="/yottalert/alerts/new"
                        class="mt-3"
                        prepend-icon="mdi-plus"
                    >
                        Create your first rule
                    </v-btn>
                </div>
            </section>

            <section class="section">
                <div class="section-head">
                    <h2 class="section-title">Recent alerts</h2>
                    <span class="muted">{{ recent.length }} total</span>
                </div>
                <div v-if="recent.length" class="recent-list">
                    <AlertCard v-for="a in recent" :key="a.id" :alert="a" />
                </div>
                <div v-else class="empty-card slim">
                    <div class="empty-text">
                        No alerts yet — they appear here as soon as Elemental returns a new
                        candidate above the rule's minimum confidence.
                    </div>
                </div>
            </section>

            <section class="two-col">
                <div class="section">
                    <h2 class="section-title">Watched geographies</h2>
                    <div v-if="watchedGeographies.length" class="chips">
                        <NuxtLink
                            v-for="g in watchedGeographies"
                            :key="g.name"
                            :to="`/yottalert/geographies/${slugify(g.name)}`"
                            class="cloud-chip"
                        >
                            <v-icon icon="mdi-map-marker-outline" size="12" />
                            <span>{{ g.name }}</span>
                            <span class="count">{{ g.count }}</span>
                        </NuxtLink>
                    </div>
                    <div v-else class="empty-text small">
                        Geography mentions in your alert rules will appear here.
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">Watched entities</h2>
                    <div v-if="watchedEntities.length" class="chips">
                        <span
                            v-for="e in watchedEntities.slice(0, 20)"
                            :key="e.name"
                            class="cloud-chip"
                        >
                            <v-icon icon="mdi-office-building-outline" size="12" />
                            <span>{{ e.name }}</span>
                            <span class="count">{{ e.count }}</span>
                        </span>
                    </div>
                    <div v-else class="empty-text small">
                        Entities surfaced by your alerts will appear here.
                    </div>
                </div>
            </section>
        </main>
    </YottalertShell>
</template>

<script setup lang="ts">
    import { computed, onMounted } from 'vue';

    import { useElementalStatus } from '~/composables/useElementalStatus';
    import { useYottalert } from '~/composables/useYottalert';

    definePageMeta({ layout: false });

    const {
        alerts,
        highSeverity,
        recent,
        watchedGeographies,
        watchedEntities,
        alertsLoading,
        refreshAll,
    } = useYottalert();
    const { refresh: refreshStatus } = useElementalStatus();

    onMounted(() => {
        refreshAll();
        refreshStatus();
    });

    const alertSummary = computed(() => {
        const high = alerts.value.filter((a) => a.severity === 'high').length;
        const med = alerts.value.filter((a) => a.severity === 'medium').length;
        return `${high} high · ${med} medium · ${alerts.value.length} total`;
    });

    function slugify(s: string): string {
        return s
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
</script>

<style scoped>
    .dashboard {
        max-width: 1640px;
        padding: 32px 32px 48px;
        margin: 0 auto;
    }
    .page-head {
        margin-bottom: 24px;
    }
    .kicker {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--lv-green);
    }
    .page-title {
        font-family: var(--font-headline);
        font-weight: 400;
        font-size: 2rem;
        margin-top: 4px;
        line-height: 1.1;
    }
    .page-subtitle {
        margin-top: 6px;
        color: rgba(255, 255, 255, 0.55);
        font-size: 13px;
    }
    .section {
        margin-bottom: 32px;
    }
    .section-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 14px;
    }
    .section-title {
        font-family: var(--font-headline);
        font-weight: 400;
        font-size: 1.15rem;
        letter-spacing: 0.02em;
    }
    .link {
        font-family: var(--font-mono);
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--lv-green);
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }
    .muted {
        font-family: var(--font-mono);
        font-size: 10px;
        color: rgba(255, 255, 255, 0.45);
    }
    .alert-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 14px;
    }
    .recent-list {
        display: grid;
        gap: 10px;
    }
    .empty-card {
        background: var(--lv-surface);
        border: 1px dashed rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        padding: 28px;
        text-align: left;
    }
    .empty-card.slim {
        padding: 16px;
        text-align: left;
    }
    .empty-text {
        margin-top: 8px;
        color: rgba(255, 255, 255, 0.7);
        font-size: 13px;
        line-height: 1.5;
    }
    .empty-text.small {
        margin-top: 0;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
    }
    .loader {
        padding: 32px;
        display: flex;
        justify-content: center;
    }
    .two-col {
        display: grid;
        gap: 24px;
        grid-template-columns: 1fr 1fr;
    }
    @media (max-width: 900px) {
        .two-col {
            grid-template-columns: 1fr;
        }
    }
    .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .cloud-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 999px;
        text-decoration: none;
        color: rgba(255, 255, 255, 0.85);
        font-size: 12px;
    }
    .cloud-chip:hover {
        background: rgba(255, 255, 255, 0.1);
    }
    .count {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--lv-green);
        padding-left: 4px;
    }
</style>
