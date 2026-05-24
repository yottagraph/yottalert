<template>
    <YottalertShell>
        <main class="digest">
            <header class="page-head">
                <span class="kicker">YOTTALERT · {{ frequency.toUpperCase() }} DIGEST</span>
                <h1 class="page-title">{{ titleFor(frequency) }}</h1>
                <p class="page-subtitle">
                    Numbers come straight from the deterministic substrate. The composition source
                    chip flips to green when Gemini is wired up.
                </p>
            </header>

            <div v-if="loading" class="loader">
                <v-progress-circular indeterminate size="28" color="primary" />
                <div class="loader-text">
                    Composing {{ frequency }} digest — numbers are not invented.
                </div>
            </div>

            <template v-else-if="digest">
                <div class="meta-strip">
                    <span class="chip">{{ digest.alertCount }} alerts</span>
                    <span class="chip">{{ digest.watchAreaCount }} watch area</span>
                    <span class="chip"
                        >{{ digest.severityCounts.high }} high ·
                        {{ digest.severityCounts.medium }} medium</span
                    >
                    <span class="chip">{{ digest.usage.model }}</span>
                    <span
                        class="chip"
                        :class="
                            digest.compositionSource === 'gemini' ? 'chip-success' : 'chip-amber'
                        "
                    >
                        composition: {{ digest.compositionSource }}
                    </span>
                    <span class="chip">{{
                        digest.cached ? `cached ${digest.cacheAgeSec}s` : 'fresh'
                    }}</span>
                    <span class="chip mono">{{ digest.usage.latencyMs }}ms</span>
                </div>

                <div class="row mb-4">
                    <v-btn-toggle
                        v-model="frequency"
                        color="primary"
                        density="compact"
                        divided
                        mandatory
                        @update:model-value="load()"
                    >
                        <v-btn value="daily">Daily</v-btn>
                        <v-btn value="weekly">Weekly</v-btn>
                    </v-btn-toggle>
                    <v-btn variant="text" prepend-icon="mdi-refresh" @click="load(true)">
                        Regenerate
                    </v-btn>
                </div>

                <article class="markdown-body">
                    <pre class="markdown">{{ digest.markdown }}</pre>
                </article>

                <section v-if="digest.citations.length" class="sources">
                    <h2 class="section-title">Sources</h2>
                    <ol>
                        <li v-for="c in digest.citations" :key="c.n">
                            <span class="ref-n">[{{ c.n }}]</span>
                            <a v-if="c.url" :href="c.url" target="_blank" rel="noreferrer">
                                {{ c.label }} ↗
                            </a>
                            <span v-else>{{ c.label }}</span>
                        </li>
                    </ol>
                </section>
            </template>
        </main>
    </YottalertShell>
</template>

<script setup lang="ts">
    import { onMounted, ref } from 'vue';

    import type { DigestPayload } from '~/server/services/digestService';

    definePageMeta({ layout: false });

    const frequency = ref<'daily' | 'weekly'>('daily');
    const digest = ref<DigestPayload | null>(null);
    const loading = ref(false);

    async function load(force = false) {
        loading.value = true;
        try {
            const params = new URLSearchParams({ frequency: frequency.value });
            if (force) params.set('force', 'true');
            digest.value = await $fetch<DigestPayload>(
                `/api/yottalert/digest/daily?${params.toString()}`
            );
        } finally {
            loading.value = false;
        }
    }

    onMounted(() => load());

    function titleFor(f: 'daily' | 'weekly'): string {
        return f === 'daily' ? "Today's signal digest" : 'This week in your watch list';
    }
</script>

<style scoped>
    .digest {
        max-width: 960px;
        padding: 32px 32px 48px;
        margin: 0 auto;
    }
    .page-head {
        margin-bottom: 16px;
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
        font-size: 1.8rem;
        margin-top: 4px;
    }
    .page-subtitle {
        margin-top: 6px;
        color: rgba(255, 255, 255, 0.55);
        font-size: 13px;
        max-width: 640px;
    }
    .loader {
        padding: 64px;
        text-align: center;
    }
    .loader-text {
        margin-top: 14px;
        color: rgba(255, 255, 255, 0.55);
        font-family: var(--font-mono);
        font-size: 11px;
    }
    .meta-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 18px 0 20px;
    }
    .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        font-family: var(--font-mono);
        font-size: 11px;
        background: rgba(255, 255, 255, 0.05);
        color: rgba(255, 255, 255, 0.78);
        border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .chip.mono {
        font-family: var(--font-mono);
    }
    .chip-success {
        background: rgba(63, 234, 0, 0.18);
        color: var(--lv-green);
        border-color: rgba(63, 234, 0, 0.3);
    }
    .chip-amber {
        background: rgba(255, 159, 10, 0.18);
        color: var(--dynamic-severity-medium);
        border-color: rgba(255, 159, 10, 0.3);
    }
    .row {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
    }
    .markdown-body {
        background: var(--lv-surface);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 24px;
    }
    .markdown {
        font-family: var(--font-primary);
        color: rgba(255, 255, 255, 0.9);
        font-size: 14px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-word;
        margin: 0;
    }
    .sources {
        margin-top: 24px;
    }
    .section-title {
        font-family: var(--font-headline);
        font-weight: 400;
        font-size: 1.1rem;
        margin-bottom: 12px;
    }
    .sources ol {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 6px;
    }
    .sources li {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.78);
        display: flex;
        gap: 8px;
    }
    .ref-n {
        font-family: var(--font-mono);
        color: var(--lv-green);
    }
</style>
