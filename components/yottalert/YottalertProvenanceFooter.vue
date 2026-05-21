<template>
    <footer class="provenance-footer">
        <div class="footer-block">
            <span class="kicker">SOURCE OF TRUTH</span>
            <span class="footer-text">Elemental Query Server · {{ schemaSummary }}</span>
        </div>
        <div class="footer-block">
            <span class="kicker">SYNC</span>
            <span class="footer-text">{{ lastSync }}</span>
        </div>
        <div class="footer-block">
            <span class="kicker">STORE</span>
            <span class="footer-text">{{ backend === 'redis' ? 'Upstash KV' : 'local-fs' }}</span>
        </div>
    </footer>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import { useElementalStatus } from '~/composables/useElementalStatus';
    import { useYottalert } from '~/composables/useYottalert';
    import { relativeTime } from '~/utils/yottalert/severity';

    const { schema, status } = useElementalStatus();
    const { backend, alerts } = useYottalert();

    const schemaSummary = computed(() => {
        if (!schema.value) return 'not yet probed';
        return `${schema.value.flavorCount} flavors · ${schema.value.propertyCount} PIDs`;
    });

    const lastSync = computed(() => {
        if (status.value?.lastCheckedAt) {
            return `last check ${relativeTime(status.value.lastCheckedAt)}`;
        }
        const newest = alerts.value[0]?.createdAt;
        return newest ? `last alert ${relativeTime(newest)}` : 'no syncs yet';
    });
</script>

<style scoped>
    .provenance-footer {
        margin: 32px auto 24px;
        max-width: 1640px;
        padding: 16px 24px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        display: flex;
        gap: 32px;
        flex-wrap: wrap;
        font-family: var(--font-mono);
        color: rgba(255, 255, 255, 0.45);
    }
    .footer-block {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .kicker {
        font-size: 9px;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.32);
    }
    .footer-text {
        font-size: 11px;
    }
</style>
