<template>
    <YottalertShell>
        <main class="provenance-page">
            <div v-if="loading" class="loader">
                <v-progress-circular indeterminate size="32" color="primary" />
            </div>

            <template v-else-if="record">
                <header class="head">
                    <div class="kicker">PROVENANCE · {{ record.objectType.toUpperCase() }}</div>
                    <h1 class="title">{{ record.sourceDocument?.name ?? record.objectId }}</h1>
                    <div class="meta">
                        Object ID <code>{{ record.objectId }}</code>
                    </div>
                    <div class="actions">
                        <v-btn
                            size="small"
                            variant="outlined"
                            prepend-icon="mdi-content-copy"
                            @click="copyLink"
                        >
                            Copy link
                        </v-btn>
                    </div>
                </header>

                <section class="block">
                    <div class="meta-strip">
                        <span class="chip">ingested: {{ renderDate(record.ingestedAt) }}</span>
                        <span class="chip">published: {{ renderDate(record.publishedAt) }}</span>
                        <span class="chip"
                            >entity: {{ percent(record.entityResolutionConfidence) }}</span
                        >
                        <span class="chip"
                            >relationship: {{ percent(record.relationshipConfidence) }}</span
                        >
                        <span class="chip"
                            >event: {{ percent(record.eventExtractionConfidence) }}</span
                        >
                        <span class="chip"
                            >geography: {{ percent(record.geographyResolutionConfidence) }}</span
                        >
                    </div>
                </section>

                <section class="block">
                    <h2 class="section-title">Evidence record</h2>
                    <ProvenanceCard :record="record" />
                </section>

                <section class="block">
                    <h2 class="section-title">Related alerts</h2>
                    <div v-if="record.relatedAlerts.length" class="related">
                        <NuxtLink
                            v-for="item in record.relatedAlerts"
                            :key="item.alertId"
                            :to="`/yottalert/alerts/${item.alertId}`"
                            class="related-item"
                        >
                            <span>{{ item.alertTitle }}</span>
                            <span class="mono">{{ relativeTime(item.createdAt) }}</span>
                        </NuxtLink>
                    </div>
                    <div v-else class="empty">No related alerts stored for this object yet.</div>
                </section>
            </template>

            <div v-else class="empty">
                Provenance unavailable for this object. Try checking again after the next sync run.
            </div>
        </main>
    </YottalertShell>
</template>

<script setup lang="ts">
    import { onMounted, ref } from 'vue';
    import { useRoute } from 'vue-router';

    import type { ProvenanceRecord } from '~/utils/yottalert/types';
    import { relativeTime } from '~/utils/yottalert/severity';

    definePageMeta({ layout: false });

    const route = useRoute();
    const loading = ref(true);
    const record = ref<ProvenanceRecord | null>(null);

    onMounted(async () => {
        loading.value = true;
        try {
            const res = await $fetch<{ provenance: ProvenanceRecord }>(
                `/api/yottalert/provenance/${encodeURIComponent(String(route.params.objectId || ''))}`
            );
            record.value = res.provenance;
        } catch {
            record.value = null;
        } finally {
            loading.value = false;
        }
    });

    function renderDate(value?: string): string {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        return d.toLocaleString();
    }

    function percent(value?: number): string {
        if (value === undefined || value === null || !Number.isFinite(value)) return '—';
        return `${Math.round(value * 100)}%`;
    }

    async function copyLink(): Promise<void> {
        try {
            await navigator.clipboard.writeText(window.location.href);
        } catch {
            // ignore clipboard errors
        }
    }
</script>

<style scoped>
    .provenance-page {
        max-width: 960px;
        margin: 0 auto;
        padding: 32px 32px 64px;
    }
    .loader,
    .empty {
        text-align: center;
        padding: 64px 0;
        color: rgba(255, 255, 255, 0.65);
    }
    .head {
        margin-bottom: 18px;
    }
    .kicker {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--dynamic-primary);
    }
    .title {
        margin-top: 4px;
        font-family: var(--font-headline);
        font-size: 1.6rem;
        font-weight: 400;
    }
    .meta {
        margin-top: 8px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
    }
    .actions {
        margin-top: 12px;
    }
    .block {
        background: var(--lv-surface);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 16px;
    }
    .meta-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .chip {
        font-family: var(--font-mono);
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 999px;
        border: 1px solid rgba(var(--dynamic-fg-rgb), 0.12);
        background: rgba(var(--dynamic-fg-rgb), 0.06);
        color: rgba(255, 255, 255, 0.8);
    }
    .section-title {
        margin-bottom: 10px;
        font-family: var(--font-headline);
        font-weight: 400;
        font-size: 1.05rem;
    }
    .related {
        display: grid;
        gap: 8px;
    }
    .related-item {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 8px;
        text-decoration: none;
        color: rgba(255, 255, 255, 0.85);
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
    }
    .mono {
        font-family: var(--font-mono);
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
    }
</style>
