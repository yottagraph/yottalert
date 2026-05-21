<template>
    <v-tooltip :text="tooltip">
        <template v-slot:activator="{ props: tooltipProps }">
            <button
                v-bind="tooltipProps"
                class="status-pill"
                :class="`status-${overall}`"
                type="button"
                @click="refresh"
            >
                <span class="status-dot" :class="`dot-${overall}`" />
                <span class="status-label">{{ label }}</span>
            </button>
        </template>
    </v-tooltip>
</template>

<script setup lang="ts">
    import { computed, onMounted, onBeforeUnmount } from 'vue';
    import { useElementalStatus } from '~/composables/useElementalStatus';

    const { overall, tooltip, refresh, startPolling, stopPolling, status } = useElementalStatus();

    onMounted(() => startPolling());
    onBeforeUnmount(() => stopPolling());

    const label = computed(() => {
        if (overall.value === 'green') return 'ELEMENTAL LIVE';
        if (overall.value === 'amber') return 'ELEMENTAL DEGRADED';
        if (overall.value === 'red') return 'ELEMENTAL DOWN';
        return 'ELEMENTAL —';
    });
    // Expose so linter sees usage
    void status;
</script>

<style scoped>
    .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
        font-family: var(--font-mono);
        font-size: 0.7rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
        border: 1px solid rgba(255, 255, 255, 0.16);
        transition: background 0.15s ease;
    }
    .status-pill:hover {
        background: rgba(255, 255, 255, 0.14);
    }
    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: var(--lv-silver);
        box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
    }
    .dot-green {
        background: #3fea00;
        box-shadow: 0 0 12px rgba(63, 234, 0, 0.7);
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
    .status-label {
        line-height: 1;
    }
</style>
