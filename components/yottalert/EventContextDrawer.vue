<template>
    <v-navigation-drawer v-model="open" location="right" temporary width="460" class="event-drawer">
        <div class="drawer-inner">
            <div class="drawer-head">
                <div class="kicker">EVENT CONTEXT</div>
                <div class="title">{{ event?.title ?? 'Loading…' }}</div>
                <div class="meta-row">
                    <span v-if="event?.type" class="meta-chip">{{ event.type }}</span>
                    <span v-if="event?.status" class="meta-chip">{{ event.status }}</span>
                    <span v-if="event?.source" class="meta-chip" :class="`src-${event.source}`">
                        {{ event.source }}
                    </span>
                </div>
            </div>

            <div class="meta-grid">
                <div>
                    <span class="kicker">Published</span>
                    <div class="mono">
                        {{ event?.occurredAt ? relativeTime(event.occurredAt) : '—' }}
                    </div>
                </div>
                <div>
                    <span class="kicker">Sentiment</span>
                    <div class="mono">{{ sentimentLabel }}</div>
                </div>
                <div>
                    <span class="kicker">Tone</span>
                    <div class="mono">{{ event?.tone ?? '—' }}</div>
                </div>
                <div>
                    <span class="kicker">Factuality</span>
                    <div class="mono">{{ event?.titleFactuality ?? '—' }}</div>
                </div>
            </div>

            <div v-if="event?.publication?.name || event?.url" class="block">
                <div class="block-title">Publication</div>
                <div class="event-title">
                    {{ event?.publication?.name ?? 'Unknown publication' }}
                </div>
                <a
                    v-if="event?.url"
                    :href="event.url"
                    target="_blank"
                    rel="noreferrer noopener"
                    class="event-link"
                >
                    Open source ↗
                </a>
            </div>

            <div v-if="event?.actors?.length" class="block">
                <div class="block-title">Actors</div>
                <div class="chips">
                    <NuxtLink
                        v-for="actor in event.actors"
                        :key="actor.neid"
                        :to="`/yottalert/provenance/${encodeURIComponent(actor.neid)}`"
                        class="actor-chip"
                    >
                        <span>{{ actor.name }}</span>
                        <span v-if="typeof actor.sentiment === 'number'" class="actor-score">
                            {{ actor.sentiment > 0 ? '+' : '' }}{{ actor.sentiment.toFixed(2) }}
                        </span>
                    </NuxtLink>
                </div>
            </div>

            <div v-if="rawEntries.length" class="block">
                <div class="block-title">Raw values</div>
                <dl class="raw-list">
                    <template v-for="row in rawEntries" :key="row.key">
                        <dt>{{ row.key }}</dt>
                        <dd>{{ row.value }}</dd>
                    </template>
                </dl>
            </div>

            <div class="block">
                <NuxtLink
                    :to="`/yottalert/provenance/${encodeURIComponent(event?.id ?? '')}`"
                    class="provenance-link"
                >
                    View provenance report
                </NuxtLink>
            </div>
        </div>
    </v-navigation-drawer>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import type { AlertEventRef } from '~/utils/yottalert/types';
    import { relativeTime } from '~/utils/yottalert/severity';

    const props = defineProps<{
        modelValue: boolean;
        event: AlertEventRef | null;
    }>();

    const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

    const open = computed({
        get: () => props.modelValue,
        set: (v: boolean) => emit('update:modelValue', v),
    });

    const sentimentLabel = computed(() => {
        if (typeof props.event?.sentiment !== 'number') return '—';
        const v = props.event.sentiment;
        return `${v > 0 ? '+' : ''}${v.toFixed(2)}`;
    });

    const rawEntries = computed(() => {
        const raw = props.event?.rawValues ?? {};
        return Object.entries(raw)
            .filter(([, value]) => value !== null && value !== undefined && value !== '')
            .map(([key, value]) => ({ key, value: String(value) }));
    });
</script>

<style scoped>
    .event-drawer {
        background: var(--lv-surface) !important;
        color: rgba(255, 255, 255, 0.88) !important;
    }
    .drawer-inner {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
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
        line-height: 1.25;
    }
    .meta-row {
        margin-top: 8px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }
    .meta-chip {
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 999px;
        padding: 3px 8px;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.72);
    }
    .src-synthetic {
        border-color: rgba(255, 176, 0, 0.5);
        color: #ffcf6d;
    }
    .src-elemental {
        border-color: rgba(98, 255, 160, 0.5);
        color: #8dffbf;
    }
    .meta-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }
    .mono {
        margin-top: 4px;
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--lv-green);
    }
    .block-title {
        font-family: var(--font-mono);
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.55);
        margin-bottom: 8px;
    }
    .event-title {
        font-size: 14px;
        line-height: 1.4;
    }
    .event-link,
    .provenance-link {
        margin-top: 8px;
        display: inline-flex;
        color: var(--lv-green);
        text-decoration: none;
        font-size: 12px;
    }
    .event-link:hover,
    .provenance-link:hover {
        text-decoration: underline;
    }
    .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .actor-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 9px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 999px;
        color: rgba(255, 255, 255, 0.9);
        text-decoration: none;
        font-size: 12px;
    }
    .actor-chip:hover {
        border-color: rgba(255, 255, 255, 0.35);
    }
    .actor-score {
        font-family: var(--font-mono);
        color: var(--lv-green);
    }
    .raw-list {
        display: grid;
        grid-template-columns: 1fr;
        gap: 6px;
        margin: 0;
    }
    .raw-list dt {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.55);
        font-family: var(--font-mono);
    }
    .raw-list dd {
        margin: 0 0 8px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.85);
        word-break: break-word;
    }
</style>
