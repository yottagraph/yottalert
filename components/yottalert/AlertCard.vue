<template>
    <NuxtLink
        class="alert-card"
        :class="`alert-${alert.severity}`"
        :to="`/yottalert/alerts/${alert.id}`"
    >
        <div class="row top">
            <div class="severity-tag" :class="`tag-${alert.severity}`">
                <span class="sev-dot" />
                <span>{{ severityLabel }}</span>
            </div>
            <div class="score-chip">
                <v-icon icon="mdi-meter" size="12" />
                <span>{{ alert.score }}</span>
            </div>
        </div>
        <div class="title">{{ alert.title }}</div>
        <div v-if="alert.geographyLabel" class="geo">
            <v-icon icon="mdi-map-marker-outline" size="12" /> {{ alert.geographyLabel }}
        </div>
        <div class="summary">{{ alert.summary }}</div>
        <div v-if="alert.whyItMatters" class="why">{{ alert.whyItMatters }}</div>
        <div class="row foot">
            <span class="chip">
                <v-icon icon="mdi-source-branch" size="11" />
                {{ alert.sourceCount }} source{{ alert.sourceCount === 1 ? '' : 's' }}
            </span>
            <span class="chip">{{ Math.round(alert.confidence * 100) }}% conf</span>
            <span class="time">{{ relativeTime(alert.createdAt) }}</span>
        </div>
    </NuxtLink>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import type { YottalertAlert } from '~/utils/yottalert/types';
    import { relativeTime, severityTone } from '~/utils/yottalert/severity';

    const props = defineProps<{ alert: YottalertAlert }>();
    const severityLabel = computed(() => severityTone(props.alert.severity).label.toUpperCase());
</script>

<style scoped>
    .alert-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 14px 16px;
        background: var(--lv-surface);
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-left-width: 3px;
        text-decoration: none;
        color: inherit;
        transition:
            transform 0.15s ease,
            background 0.15s ease;
    }
    .alert-card:hover {
        background: var(--lv-surface-light);
        transform: translateY(-1px);
    }
    .alert-high {
        border-left-color: var(--dynamic-severity-high);
    }
    .alert-medium {
        border-left-color: var(--dynamic-severity-medium);
    }
    .alert-low {
        border-left-color: var(--dynamic-severity-low);
    }
    .alert-suppressed {
        border-left-color: var(--dynamic-severity-suppressed);
    }
    .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }
    .severity-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        padding: 3px 8px;
        border-radius: 999px;
        border-width: 1px;
        border-style: solid;
    }
    .tag-high {
        color: var(--dynamic-severity-high);
        background: rgba(var(--dynamic-severity-high-rgb), 0.12);
        border-color: rgba(var(--dynamic-severity-high-rgb), 0.3);
    }
    .tag-medium {
        color: var(--dynamic-severity-medium);
        background: rgba(var(--dynamic-severity-medium-rgb), 0.12);
        border-color: rgba(var(--dynamic-severity-medium-rgb), 0.3);
    }
    .tag-low {
        color: var(--dynamic-severity-low);
        background: rgba(var(--dynamic-severity-low-rgb), 0.12);
        border-color: rgba(var(--dynamic-severity-low-rgb), 0.3);
    }
    .tag-suppressed {
        color: var(--dynamic-severity-suppressed);
        background: rgba(var(--dynamic-severity-suppressed-rgb), 0.12);
        border-color: rgba(var(--dynamic-severity-suppressed-rgb), 0.3);
    }
    .sev-dot {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: currentColor;
    }
    .score-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-family: var(--font-mono);
        font-size: 11px;
        padding: 3px 8px;
        border-radius: 6px;
        background: rgba(var(--dynamic-primary-rgb), 0.12);
        color: var(--lv-green);
    }
    .title {
        font-size: 14px;
        font-weight: 600;
        color: #fff;
        line-height: 1.3;
    }
    .geo {
        font-family: var(--font-mono);
        font-size: 11px;
        color: rgba(255, 255, 255, 0.55);
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }
    .summary {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.78);
        line-height: 1.45;
    }
    .why {
        font-style: italic;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        line-height: 1.4;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
    }
    .foot {
        margin-top: 6px;
        flex-wrap: wrap;
    }
    .chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-family: var(--font-mono);
        font-size: 10px;
        color: rgba(255, 255, 255, 0.62);
        background: rgba(255, 255, 255, 0.04);
        padding: 2px 7px;
        border-radius: 999px;
    }
    .time {
        font-family: var(--font-mono);
        font-size: 10px;
        color: rgba(255, 255, 255, 0.4);
        margin-left: auto;
    }
</style>
