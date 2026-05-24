<template>
    <div class="status-strip">
        <div class="chip">
            <span class="dot" :class="`dot-${elemental.overall.value}`" />
            <span class="kicker">ELEMENTAL</span>
            <span class="value">{{
                elemental.overall.value === 'green'
                    ? 'live'
                    : elemental.overall.value === 'amber'
                      ? 'degraded'
                      : elemental.overall.value === 'red'
                        ? 'down'
                        : 'probing'
            }}</span>
        </div>
        <div class="chip">
            <span class="kicker">LAST SYNC</span>
            <span class="value">{{ lastSync }}</span>
        </div>
        <div class="chip">
            <span class="kicker">WATCH AREA</span>
            <span class="value">{{ watchArea ? watchArea.geographyType : 'none' }}</span>
        </div>
        <div class="chip">
            <span class="kicker">ALERTS · 24H</span>
            <span class="value">{{ alerts24h }}</span>
        </div>
        <div class="chip">
            <span class="kicker">HIGH SEVERITY</span>
            <span class="value high">{{ highCount }}</span>
        </div>
        <div class="chip">
            <span class="kicker">PROVENANCE</span>
            <span class="value">{{ provenanceHealth }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import { useElementalStatus } from '~/composables/useElementalStatus';
    import { useYottalert } from '~/composables/useYottalert';
    import { relativeTime } from '~/utils/yottalert/severity';

    const elemental = useElementalStatus();
    const { watchArea, alerts } = useYottalert();

    const alerts24h = computed(() => {
        const cutoff = Date.now() - 24 * 3600 * 1000;
        return alerts.value.filter((a) => new Date(a.createdAt).getTime() >= cutoff).length;
    });
    const highCount = computed(() => alerts.value.filter((a) => a.severity === 'high').length);
    const lastSync = computed(() => {
        const lastChecked = watchArea.value?.lastCheckedAt;
        if (lastChecked) return relativeTime(lastChecked);
        return elemental.status.value
            ? relativeTime(elemental.status.value.lastCheckedAt)
            : 'never';
    });
    const provenanceHealth = computed(() => {
        const list = alerts.value;
        if (!list.length) return 'no data';
        const complete = list.filter((a) => a.provenanceStatus === 'complete').length;
        const partial = list.filter((a) => a.provenanceStatus === 'partial').length;
        const total = list.length;
        return `${Math.round((complete / total) * 100)}% complete · ${partial} partial`;
    });
</script>

<style scoped>
    .status-strip {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 28px;
    }
    .chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        font-family: var(--font-mono);
        font-size: 11px;
        color: rgba(255, 255, 255, 0.7);
    }
    .kicker {
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.45);
    }
    .value {
        color: #fff;
    }
    .value.high {
        color: var(--dynamic-severity-high);
    }
    .dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: var(--lv-silver);
    }
    .dot-green {
        background: var(--lv-green);
        box-shadow: 0 0 10px rgba(63, 234, 0, 0.6);
    }
    .dot-amber {
        background: #ff9f0a;
    }
    .dot-red {
        background: #ef4444;
    }
    .dot-unknown {
        background: #757575;
    }
</style>
