<template>
    <v-navigation-drawer
        v-model="open"
        location="right"
        temporary
        width="420"
        class="entity-drawer"
    >
        <div class="drawer-inner">
            <div class="drawer-head">
                <div class="kicker">ENTITY CONTEXT</div>
                <div class="title">{{ entity?.name ?? 'Loading…' }}</div>
                <div v-if="entity?.type" class="meta">{{ entity.type }}</div>
            </div>

            <div v-if="entity?.neid" class="neid-block">
                <span class="kicker">NEID</span>
                <span class="mono">{{ entity.neid }}</span>
            </div>

            <div v-if="loading" class="loading">
                <v-progress-circular indeterminate size="20" />
                <span>Querying Elemental…</span>
            </div>

            <div v-else-if="events.length" class="block">
                <div class="block-title">Recent events</div>
                <div v-for="evt in events" :key="evt.id" class="event-row">
                    <div class="event-title">{{ evt.summary }}</div>
                    <div v-if="evt.occurredAt" class="event-time">
                        {{ relativeTime(evt.occurredAt) }}
                    </div>
                </div>
            </div>
            <div v-else-if="entity" class="empty-block">
                No recent events surfaced from Elemental for this entity.
            </div>
        </div>
    </v-navigation-drawer>
</template>

<script setup lang="ts">
    import { computed, ref, watch } from 'vue';
    import type { AlertEntityRef } from '~/utils/yottalert/types';
    import { relativeTime } from '~/utils/yottalert/severity';

    const props = defineProps<{
        modelValue: boolean;
        entity: AlertEntityRef | null;
    }>();
    const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

    const open = computed({
        get: () => props.modelValue,
        set: (v: boolean) => emit('update:modelValue', v),
    });

    const events = ref<Array<{ id: string; summary: string; occurredAt?: string }>>([]);
    const loading = ref(false);

    async function load(neid: string | undefined) {
        if (!neid) {
            events.value = [];
            return;
        }
        loading.value = true;
        try {
            const res = await $fetch<{ results: Array<{ neid: string; name: string }> }>(
                `/api/yottalert/entities/search?q=${encodeURIComponent(props.entity?.name ?? '')}`
            );
            // Fall back to a placeholder list — the dedicated events endpoint
            // is not exposed on the gateway in the MVP. We surface related
            // entities here so the drawer still feels informative.
            events.value = res.results.slice(0, 5).map((r) => ({
                id: r.neid,
                summary: `Related entity: ${r.name}`,
                occurredAt: undefined,
            }));
        } catch {
            events.value = [];
        } finally {
            loading.value = false;
        }
    }

    watch(
        () => props.entity?.neid,
        (neid) => {
            if (props.modelValue && neid) load(neid);
        }
    );

    watch(
        () => props.modelValue,
        (v) => {
            if (v && props.entity?.neid) load(props.entity.neid);
        }
    );
</script>

<style scoped>
    .entity-drawer {
        background: var(--lv-surface) !important;
        color: rgba(255, 255, 255, 0.88) !important;
    }
    .drawer-inner {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 18px;
    }
    .kicker {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.45);
    }
    .title {
        font-family: var(--font-headline);
        font-size: 20px;
        font-weight: 400;
        margin-top: 4px;
    }
    .meta {
        margin-top: 4px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
    }
    .neid-block {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .mono {
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--lv-green);
        word-break: break-all;
    }
    .loading {
        display: flex;
        align-items: center;
        gap: 10px;
        color: rgba(255, 255, 255, 0.7);
    }
    .block-title {
        font-family: var(--font-mono);
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.55);
        margin-bottom: 10px;
    }
    .event-row {
        padding: 8px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .event-title {
        font-size: 13px;
    }
    .event-time {
        font-family: var(--font-mono);
        font-size: 10px;
        color: rgba(255, 255, 255, 0.45);
    }
    .empty-block {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.55);
        line-height: 1.4;
    }
</style>
