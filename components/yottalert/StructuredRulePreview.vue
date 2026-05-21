<template>
    <div class="rule-preview">
        <div class="block">
            <div class="block-title">Watch target</div>
            <div class="row">
                <span class="kicker">type</span>
                <span class="value">{{ rule.watchTargetType }}</span>
            </div>
            <div class="row">
                <span class="kicker">value</span>
                <span class="value">{{ rule.watchTargetValue }}</span>
            </div>
            <div v-if="rule.geography" class="row">
                <span class="kicker">geography</span>
                <span class="value"
                    >{{ rule.geography.name
                    }}<span v-if="rule.geography.type" class="muted">
                        · {{ rule.geography.type }}</span
                    ></span
                >
            </div>
            <div v-if="rule.entityRefs?.length" class="row">
                <span class="kicker">entities</span>
                <span class="value">
                    <v-chip
                        v-for="ent in rule.entityRefs"
                        :key="ent.neid || ent.name"
                        size="small"
                        variant="outlined"
                        class="mr-1 mt-1"
                    >
                        {{ ent.name }}
                    </v-chip>
                </span>
            </div>
        </div>

        <div class="block">
            <div class="block-title">Filters</div>
            <div class="chips">
                <v-chip
                    v-for="c in rule.eventCategories"
                    :key="`evt-${c}`"
                    size="small"
                    variant="outlined"
                    color="primary"
                >
                    {{ humanize(c) }}
                </v-chip>
            </div>
            <div class="chips mt-2">
                <v-chip
                    v-for="c in rule.entityTypes"
                    :key="`ety-${c}`"
                    size="small"
                    variant="outlined"
                >
                    {{ humanize(c) }}
                </v-chip>
            </div>
            <div class="chips mt-2">
                <v-chip
                    v-for="c in rule.relationshipTypes"
                    :key="`rel-${c}`"
                    size="small"
                    variant="outlined"
                    color="info"
                >
                    {{ humanize(c) }}
                </v-chip>
            </div>
        </div>

        <div class="block">
            <div class="block-title">Tuning</div>
            <div class="row">
                <span class="kicker">time window</span>
                <span class="value">{{ humanize(rule.timeWindow) }}</span>
            </div>
            <div class="row">
                <span class="kicker">sensitivity</span>
                <span class="value">{{ rule.sensitivity }}</span>
            </div>
            <div class="row">
                <span class="kicker">min confidence</span>
                <span class="value">{{ rule.minimumConfidence.toFixed(2) }}</span>
            </div>
        </div>

        <div v-if="rule.exclusions?.length" class="block">
            <div class="block-title">Exclusions</div>
            <ul class="exclusions">
                <li v-for="x in rule.exclusions" :key="x">{{ x }}</li>
            </ul>
        </div>
    </div>
</template>

<script setup lang="ts">
    import type { StructuredRule } from '~/utils/yottalert/types';

    defineProps<{ rule: StructuredRule }>();

    function humanize(slug: string): string {
        return slug.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
</script>

<style scoped>
    .rule-preview {
        display: grid;
        gap: 20px;
    }
    .block {
        background: var(--lv-surface);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 14px 16px;
    }
    .block-title {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.5);
        margin-bottom: 10px;
    }
    .row {
        display: grid;
        grid-template-columns: 110px 1fr;
        gap: 12px;
        align-items: baseline;
        padding: 4px 0;
        font-size: 13px;
    }
    .kicker {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.45);
    }
    .value {
        color: rgba(255, 255, 255, 0.92);
    }
    .muted {
        color: rgba(255, 255, 255, 0.4);
    }
    .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }
    .exclusions {
        margin: 0;
        padding-left: 18px;
        color: rgba(255, 255, 255, 0.8);
        font-size: 13px;
    }
</style>
