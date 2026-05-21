<template>
    <div class="breakdown">
        <div v-for="factor in factors" :key="factor.key" class="row">
            <div class="label">{{ factor.label }}</div>
            <div class="bar">
                <div class="bar-fill" :style="{ width: factor.value + '%' }" />
            </div>
            <div class="value">{{ factor.value }}</div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import type { ScoreBreakdown } from '~/utils/yottalert/types';

    const props = defineProps<{ breakdown: ScoreBreakdown }>();

    const factors = computed(() => [
        { key: 'relevance', label: 'Relevance', value: props.breakdown.relevance },
        { key: 'novelty', label: 'Novelty', value: props.breakdown.novelty },
        {
            key: 'localSignificance',
            label: 'Local Significance',
            value: props.breakdown.localSignificance,
        },
        {
            key: 'entityImportance',
            label: 'Entity Importance',
            value: props.breakdown.entityImportance,
        },
        { key: 'confidence', label: 'Confidence', value: props.breakdown.confidence },
        { key: 'urgency', label: 'Urgency', value: props.breakdown.urgency },
    ]);
</script>

<style scoped>
    .breakdown {
        display: grid;
        gap: 10px;
    }
    .row {
        display: grid;
        grid-template-columns: 140px 1fr 32px;
        gap: 12px;
        align-items: center;
    }
    .label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.75);
    }
    .bar {
        height: 8px;
        background: rgba(255, 255, 255, 0.06);
        border-radius: 999px;
        overflow: hidden;
    }
    .bar-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--lv-blue), var(--lv-green));
        border-radius: 999px;
    }
    .value {
        font-family: var(--font-mono);
        font-size: 11px;
        color: rgba(255, 255, 255, 0.7);
        text-align: right;
    }
</style>
