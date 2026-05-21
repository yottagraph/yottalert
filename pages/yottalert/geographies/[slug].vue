<template>
    <YottalertShell>
        <main class="geo-page">
            <header class="page-head">
                <span class="kicker">GEOGRAPHY CONTEXT</span>
                <h1 class="page-title">{{ humanName }}</h1>
                <p class="page-subtitle">
                    {{ alertsForGeo.length }} alert{{ alertsForGeo.length === 1 ? '' : 's' }} ·
                    {{ rulesForGeo.length }} watched rule{{ rulesForGeo.length === 1 ? '' : 's' }}
                </p>
            </header>

            <section class="block">
                <h2 class="section-title">Recent alerts here</h2>
                <div v-if="alertsForGeo.length" class="alert-grid">
                    <AlertCard v-for="a in alertsForGeo" :key="a.id" :alert="a" />
                </div>
                <div v-else class="empty-block">
                    No alerts yet for this geography — try the
                    <NuxtLink to="/yottalert/alerts/new">alert builder</NuxtLink>.
                </div>
            </section>

            <section class="block">
                <h2 class="section-title">Watched rules</h2>
                <div v-if="rulesForGeo.length" class="rule-list">
                    <NuxtLink
                        v-for="r in rulesForGeo"
                        :key="r.id"
                        :to="`/yottalert/alerts/new?ruleId=${r.id}`"
                        class="rule-card"
                    >
                        <div class="rule-name">{{ r.name }}</div>
                        <div class="rule-meta">
                            {{ r.frequency }} · {{ r.sensitivity }} · min
                            {{ r.minimumConfidence.toFixed(2) }}
                        </div>
                    </NuxtLink>
                </div>
                <div v-else class="empty-block">No rules currently target this geography.</div>
            </section>

            <section class="block">
                <h2 class="section-title">Entities mentioned</h2>
                <div v-if="entitiesHere.length" class="chips">
                    <span v-for="e in entitiesHere" :key="e.name" class="cloud-chip">
                        <v-icon icon="mdi-office-building-outline" size="12" />
                        <span>{{ e.name }}</span>
                        <span class="count">{{ e.count }}</span>
                    </span>
                </div>
                <div v-else class="empty-block">No entities surfaced here yet.</div>
            </section>
        </main>
    </YottalertShell>
</template>

<script setup lang="ts">
    import { computed, onMounted } from 'vue';
    import { useRoute } from 'vue-router';

    import { useYottalert } from '~/composables/useYottalert';

    definePageMeta({ layout: false });

    const route = useRoute();
    const { alerts, rules, refreshAll } = useYottalert();

    const slug = computed(() => String(route.params.slug || ''));
    const humanName = computed(() =>
        slug.value
            .split('-')
            .filter(Boolean)
            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
            .join(' ')
    );

    onMounted(() => refreshAll());

    function slugify(s: string): string {
        return s
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    const alertsForGeo = computed(() =>
        alerts.value.filter((a) => a.geographyLabel && slugify(a.geographyLabel) === slug.value)
    );
    const rulesForGeo = computed(() =>
        rules.value.filter(
            (r) =>
                r.structuredRule.geography?.name &&
                slugify(r.structuredRule.geography.name) === slug.value
        )
    );
    const entitiesHere = computed(() => {
        const counts = new Map<string, number>();
        for (const a of alertsForGeo.value) {
            for (const e of a.entities) {
                counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
            }
        }
        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }));
    });
</script>

<style scoped>
    .geo-page {
        max-width: 1640px;
        padding: 32px 32px 48px;
        margin: 0 auto;
    }
    .page-head {
        margin-bottom: 24px;
    }
    .kicker {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--lv-green);
    }
    .page-title {
        font-family: var(--font-headline);
        font-weight: 400;
        font-size: 2rem;
        margin-top: 4px;
    }
    .page-subtitle {
        margin-top: 6px;
        color: rgba(255, 255, 255, 0.55);
        font-size: 13px;
    }
    .block {
        background: var(--lv-surface);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 18px 20px;
        margin-bottom: 18px;
    }
    .section-title {
        font-family: var(--font-headline);
        font-weight: 400;
        font-size: 1.1rem;
        margin-bottom: 12px;
    }
    .alert-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 12px;
    }
    .rule-list {
        display: grid;
        gap: 8px;
    }
    .rule-card {
        background: rgba(255, 255, 255, 0.03);
        border-radius: 8px;
        padding: 10px 12px;
        text-decoration: none;
        color: inherit;
    }
    .rule-card:hover {
        background: rgba(255, 255, 255, 0.07);
    }
    .rule-name {
        font-size: 13px;
        font-weight: 600;
    }
    .rule-meta {
        font-family: var(--font-mono);
        font-size: 11px;
        color: rgba(255, 255, 255, 0.55);
        margin-top: 2px;
    }
    .chips {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }
    .cloud-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 999px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.85);
    }
    .count {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--lv-green);
        padding-left: 4px;
    }
    .empty-block {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.55);
        padding: 12px 0;
    }
</style>
