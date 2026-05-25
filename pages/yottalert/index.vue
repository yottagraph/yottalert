<template>
    <YottalertShell>
        <main class="dashboard">
            <header class="page-head">
                <span class="kicker">YOTTALERT</span>
                <h1 class="page-title">
                    {{
                        watchAreas.length
                            ? `Watching ${watchAreas.length} area${watchAreas.length === 1 ? '' : 's'}`
                            : 'Watch overview'
                    }}
                </h1>
                <p class="page-subtitle">
                    Live Elemental context · {{ alertSummary }}
                    <NuxtLink to="/yottalert/onboarding?mode=add" class="change-link">
                        Add area
                    </NuxtLink>
                </p>
            </header>

            <StatusStrip />

            <section v-if="watchAreas.length" class="section">
                <div class="section-head">
                    <h2 class="section-title">Watch areas</h2>
                    <NuxtLink to="/yottalert/onboarding?mode=add" class="change-link">
                        Add another
                    </NuxtLink>
                </div>
                <div class="watch-area-grid">
                    <NuxtLink
                        v-for="area in watchAreas"
                        :key="area.id"
                        class="watch-area-card"
                        :to="`/yottalert/onboarding?id=${encodeURIComponent(area.id)}`"
                    >
                        <div class="watch-area-name">{{ area.geographyLabel }}</div>
                        <div class="watch-area-meta">
                            {{ area.geographyType }} · {{ area.interests.length }} interests
                        </div>
                    </NuxtLink>
                </div>
            </section>

            <section class="section">
                <div class="section-head">
                    <h2 class="section-title">High-priority alerts</h2>
                    <v-btn
                        size="small"
                        variant="outlined"
                        prepend-icon="mdi-refresh"
                        :loading="runningCheckNow"
                        @click="checkNow"
                    >
                        Check now
                    </v-btn>
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
                        Add a watch area and run "Check now" to surface candidate alerts directly
                        from Elemental.
                    </div>
                    <v-btn
                        color="primary"
                        to="/yottalert/onboarding?mode=add"
                        class="mt-3"
                        prepend-icon="mdi-map-marker-radius-outline"
                    >
                        Add watch area
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
        </main>
    </YottalertShell>
</template>

<script setup lang="ts">
    import { computed, onMounted, ref } from 'vue';

    import { useElementalStatus } from '~/composables/useElementalStatus';
    import { useYottalert } from '~/composables/useYottalert';

    definePageMeta({ layout: false });

    const {
        watchArea,
        watchAreas,
        alerts,
        highSeverity,
        recent,
        alertsLoading,
        refreshAll,
        runCheckNow,
    } = useYottalert();
    const { refresh: refreshStatus } = useElementalStatus();
    const runningCheckNow = ref(false);

    onMounted(() => {
        refreshAll();
        refreshStatus();
    });

    const alertSummary = computed(() => {
        const high = alerts.value.filter((a) => a.severity === 'high').length;
        const med = alerts.value.filter((a) => a.severity === 'medium').length;
        return `${high} high · ${med} medium · ${alerts.value.length} total`;
    });

    async function checkNow() {
        runningCheckNow.value = true;
        try {
            await runCheckNow();
        } finally {
            runningCheckNow.value = false;
        }
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
    .watch-area-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 10px;
    }
    .watch-area-card {
        display: block;
        padding: 14px 16px;
        background: var(--lv-surface);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        text-decoration: none;
        color: inherit;
    }
    .watch-area-name {
        font-weight: 600;
        font-size: 14px;
    }
    .watch-area-meta {
        margin-top: 6px;
        font-family: var(--font-mono);
        font-size: 10px;
        color: rgba(255, 255, 255, 0.55);
        text-transform: uppercase;
        letter-spacing: 0.08em;
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
    .change-link {
        margin-left: 10px;
        color: var(--lv-green);
        text-decoration: none;
        font-family: var(--font-mono);
        font-size: 11px;
    }
</style>
