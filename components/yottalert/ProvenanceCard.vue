<template>
    <div class="provenance-card">
        <div class="top-row">
            <div>
                <div class="label">Source document</div>
                <div class="value">{{ record.sourceDocument?.name ?? 'Unavailable' }}</div>
            </div>
            <a
                v-if="record.sourceDocument?.url"
                :href="record.sourceDocument.url"
                target="_blank"
                rel="noreferrer noopener"
                class="open-link"
            >
                open source ↗
            </a>
        </div>

        <div class="chips">
            <span class="chip">status: {{ record.status }}</span>
            <span class="chip">type: {{ record.objectType }}</span>
            <span class="chip" v-if="record.sourceDocument?.type">
                source: {{ record.sourceDocument.type }}
            </span>
        </div>

        <p v-if="record.extractedClaim" class="claim">{{ record.extractedClaim }}</p>

        <div class="grid">
            <div class="kv">
                <span>Ingested</span>
                <strong>{{ renderDate(record.ingestedAt) }}</strong>
            </div>
            <div class="kv">
                <span>Published</span>
                <strong>{{ renderDate(record.publishedAt) }}</strong>
            </div>
            <div class="kv">
                <span>Entity confidence</span>
                <strong>{{ percent(record.entityResolutionConfidence) }}</strong>
            </div>
            <div class="kv">
                <span>Relationship confidence</span>
                <strong>{{ percent(record.relationshipConfidence) }}</strong>
            </div>
            <div class="kv">
                <span>Event confidence</span>
                <strong>{{ percent(record.eventExtractionConfidence) }}</strong>
            </div>
            <div class="kv">
                <span>Geography confidence</span>
                <strong>{{ percent(record.geographyResolutionConfidence) }}</strong>
            </div>
        </div>

        <div class="object-ids">
            <div class="label">Elemental object IDs</div>
            <div v-if="record.elementalObjectIds.length" class="ids">
                <code v-for="id in record.elementalObjectIds" :key="id">{{ id }}</code>
            </div>
            <div v-else class="muted">No related object IDs available.</div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import type { ProvenanceRecord } from '~/utils/yottalert/types';

    defineProps<{ record: ProvenanceRecord }>();

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
</script>

<style scoped>
    .provenance-card {
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.02);
    }
    .top-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
    }
    .label {
        font-family: var(--font-mono);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: rgba(255, 255, 255, 0.45);
    }
    .value {
        margin-top: 4px;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.92);
    }
    .open-link {
        color: var(--dynamic-primary);
        text-decoration: none;
        font-size: 12px;
    }
    .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
    }
    .chip {
        font-family: var(--font-mono);
        font-size: 10px;
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(var(--dynamic-fg-rgb), 0.06);
        border: 1px solid rgba(var(--dynamic-fg-rgb), 0.12);
        color: rgba(255, 255, 255, 0.75);
    }
    .claim {
        margin-top: 12px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.86);
        line-height: 1.5;
    }
    .grid {
        margin-top: 14px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
    }
    .kv {
        padding: 8px 10px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.03);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        font-size: 12px;
    }
    .kv span {
        color: rgba(255, 255, 255, 0.6);
    }
    .kv strong {
        font-family: var(--font-mono);
        color: rgba(255, 255, 255, 0.92);
    }
    .object-ids {
        margin-top: 14px;
    }
    .ids {
        margin-top: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .ids code {
        font-family: var(--font-mono);
        font-size: 11px;
        color: rgba(255, 255, 255, 0.9);
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        padding: 2px 6px;
    }
    .muted {
        margin-top: 8px;
        color: rgba(255, 255, 255, 0.5);
        font-size: 12px;
    }
    @media (max-width: 700px) {
        .grid {
            grid-template-columns: 1fr;
        }
    }
</style>
