<template>
    <YottalertShell>
        <main class="builder">
            <header class="page-head">
                <span class="kicker">YOTTALERT</span>
                <h1 class="page-title">
                    {{ editingRuleId ? 'Edit alert rule' : 'Build a new alert rule' }}
                </h1>
                <p class="page-subtitle">
                    Describe what you want to monitor in plain English. Elemental interprets the
                    prompt into editable structured criteria before save.
                </p>
            </header>

            <div class="builder-grid">
                <div class="builder-left">
                    <div class="card">
                        <div class="card-title">Natural-language watch goal</div>
                        <v-textarea
                            v-model="prompt"
                            placeholder="Monitor Downtown Pittsburgh for commercial real estate stress."
                            rows="4"
                            auto-grow
                            hide-details
                        />
                        <div class="row mt-3">
                            <v-btn
                                color="primary"
                                :loading="interpretLoading"
                                :disabled="!prompt.trim()"
                                prepend-icon="mdi-flask-outline"
                                @click="interpret"
                            >
                                Interpret
                            </v-btn>
                            <span v-if="interpretLatency !== null" class="latency">
                                {{ interpretSource }} · {{ interpretLatency }}ms
                            </span>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-title">Rule basics</div>
                        <v-text-field
                            v-model="ruleName"
                            label="Rule name"
                            hide-details
                            class="mb-3"
                        />
                        <div class="grid-2">
                            <v-select
                                v-model="frequency"
                                :items="frequencies"
                                label="Delivery frequency"
                                item-title="label"
                                item-value="value"
                                hide-details
                            />
                            <v-text-field
                                v-model="deliveryDestination"
                                label="Delivery destination"
                                placeholder="dashboard_only"
                                hide-details
                            />
                        </div>
                        <div class="slider-block mt-4">
                            <div class="slider-label">
                                Sensitivity: <strong>{{ sensitivity }}</strong>
                            </div>
                            <v-btn-toggle
                                v-model="sensitivity"
                                color="primary"
                                density="compact"
                                divided
                                mandatory
                            >
                                <v-btn value="low">Low</v-btn>
                                <v-btn value="standard">Standard</v-btn>
                                <v-btn value="high">High</v-btn>
                            </v-btn-toggle>
                        </div>
                        <div class="slider-block mt-4">
                            <div class="slider-label">
                                Minimum confidence:
                                <strong>{{ minimumConfidence.toFixed(2) }}</strong>
                            </div>
                            <v-slider
                                v-model="minimumConfidence"
                                :min="0"
                                :max="1"
                                :step="0.05"
                                color="primary"
                                hide-details
                                thumb-label
                            />
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-title">Watch target</div>
                        <v-btn-toggle
                            v-model="watchTargetType"
                            color="primary"
                            density="compact"
                            divided
                            mandatory
                            class="flex-wrap"
                        >
                            <v-btn value="geography">Geography</v-btn>
                            <v-btn value="entity">Entity</v-btn>
                            <v-btn value="relationship">Relationship</v-btn>
                            <v-btn value="event_type">Event type</v-btn>
                            <v-btn value="portfolio">Portfolio</v-btn>
                            <v-btn value="natural_language">Free-form</v-btn>
                        </v-btn-toggle>
                        <v-text-field
                            v-model="watchTargetValue"
                            label="Target value"
                            class="mt-3"
                            hide-details
                        />
                        <v-autocomplete
                            v-model="entityChips"
                            :items="entitySuggestions"
                            label="Add entities (Elemental search)"
                            :loading="entityLoading"
                            multiple
                            chips
                            closable-chips
                            return-object
                            item-title="name"
                            item-value="neid"
                            no-filter
                            hide-no-data
                            class="mt-3"
                            hide-details
                            @update:search="onEntitySearch"
                        />
                    </div>

                    <div v-if="editingRuleId && feedbackInfluence" class="feedback-callout">
                        {{ feedbackInfluence }}
                    </div>

                    <div class="row actions">
                        <v-btn color="primary" :loading="saving" :disabled="!canSave" @click="save">
                            Save alert rule
                        </v-btn>
                        <v-btn
                            variant="outlined"
                            :loading="checking"
                            :disabled="!savedRuleId"
                            prepend-icon="mdi-play-circle-outline"
                            @click="checkNow"
                        >
                            Check now
                        </v-btn>
                        <span v-if="checkMessage" class="check-message">{{ checkMessage }}</span>
                    </div>
                </div>

                <aside class="builder-right">
                    <div class="card sticky">
                        <div class="card-title">
                            Structured interpretation
                            <span v-if="interpretSource" class="source-chip">
                                {{ interpretSource }}
                            </span>
                        </div>
                        <div v-if="structured" class="preview">
                            <StructuredRulePreview :rule="structured" />
                        </div>
                        <div v-else class="empty-preview">
                            Click <strong>Interpret</strong> to resolve the watch goal via the
                            deterministic Yottalert interpreter (the ADK agent is the P2 swap-in).
                            The structured rule shown here is what gets saved and what
                            <code>changeDetectionService</code> uses on every sync.
                        </div>
                    </div>
                </aside>
            </div>
        </main>
    </YottalertShell>
</template>

<script setup lang="ts">
    import { computed, onMounted, ref, watch } from 'vue';
    import { useRoute, useRouter } from 'vue-router';

    import { useRuleFeedback } from '~/composables/useRuleFeedback';
    import { useYottalert } from '~/composables/useYottalert';
    import type {
        AlertRule,
        DeliveryFrequency,
        Sensitivity,
        StructuredRule,
        WatchTargetType,
    } from '~/utils/yottalert/types';

    definePageMeta({ layout: false });

    const route = useRoute();
    const router = useRouter();
    const { refreshAll } = useYottalert();

    const prompt = ref('');
    const ruleName = ref('');
    const frequency = ref<DeliveryFrequency>('dashboard_only');
    const deliveryDestination = ref('dashboard_only');
    const sensitivity = ref<Sensitivity>('standard');
    const minimumConfidence = ref(0.7);
    const watchTargetType = ref<WatchTargetType>('geography');
    const watchTargetValue = ref('');
    const entityChips = ref<Array<{ neid: string; name: string }>>([]);
    const entitySuggestions = ref<Array<{ neid: string; name: string }>>([]);
    const entityLoading = ref(false);

    const structured = ref<StructuredRule | null>(null);
    const interpretSource = ref<string | null>(null);
    const interpretLatency = ref<number | null>(null);
    const interpretLoading = ref(false);
    const saving = ref(false);
    const checking = ref(false);
    const checkMessage = ref('');
    const savedRuleId = ref<string | null>(null);
    const editingRuleId = ref<string | null>(null);
    const { signal, suppression, load: loadFeedbackSignal } = useRuleFeedback();

    const frequencies = [
        { label: 'As it happens', value: 'as_it_happens' },
        { label: 'Daily digest', value: 'daily_digest' },
        { label: 'Weekly digest', value: 'weekly_digest' },
        { label: 'Dashboard only', value: 'dashboard_only' },
    ];

    const canSave = computed(() => !!prompt.value.trim() && !!structured.value);
    const feedbackInfluence = computed(() => {
        if (!editingRuleId.value || !signal.value) return '';
        const total = signal.value.totalFeedback;
        const utility = Math.round(signal.value.utilityScore * 100);
        const noise = Math.round(signal.value.noiseScore * 100);
        const suppressed = suppression.value
            ? suppression.value.suppressedEntityIds.length +
              suppression.value.suppressedGeographySlugs.length
            : 0;
        const boosted = suppression.value
            ? suppression.value.boostedEntityIds.length +
              suppression.value.boostedGeographySlugs.length
            : 0;
        return `Feedback influence: ${total} responses (${utility}% utility / ${noise}% noise), ${suppressed} suppressed target(s), ${boosted} boosted target(s).`;
    });

    async function interpret() {
        interpretLoading.value = true;
        try {
            const res = await $fetch<{
                structured: StructuredRule;
                compositionSource: string;
                latencyMs: number;
            }>('/api/yottalert/alert-rules/interpret', {
                method: 'POST',
                body: { prompt: prompt.value },
            });
            structured.value = res.structured;
            interpretSource.value = res.compositionSource;
            interpretLatency.value = res.latencyMs;
            sensitivity.value = res.structured.sensitivity;
            minimumConfidence.value = res.structured.minimumConfidence;
            watchTargetType.value = res.structured.watchTargetType;
            watchTargetValue.value = res.structured.watchTargetValue;
            if (!ruleName.value.trim()) {
                ruleName.value = res.structured.watchTargetValue.slice(0, 60);
            }
            if (res.structured.entityRefs?.length) {
                entityChips.value = res.structured.entityRefs.map((e) => ({
                    neid: e.neid || `local-${e.name}`,
                    name: e.name,
                }));
            }
        } catch (err) {
            console.warn('interpret failed', err);
        } finally {
            interpretLoading.value = false;
        }
    }

    let entitySearchTimer: ReturnType<typeof setTimeout> | null = null;
    function onEntitySearch(query: string) {
        if (entitySearchTimer) clearTimeout(entitySearchTimer);
        if (!query || query.length < 2) {
            entitySuggestions.value = [];
            return;
        }
        entitySearchTimer = setTimeout(async () => {
            entityLoading.value = true;
            try {
                const res = await $fetch<{ results: Array<{ neid: string; name: string }> }>(
                    `/api/yottalert/entities/search?q=${encodeURIComponent(query)}`
                );
                entitySuggestions.value = res.results;
            } catch {
                entitySuggestions.value = [];
            } finally {
                entityLoading.value = false;
            }
        }, 250);
    }

    function syncStructuredWithForm() {
        if (!structured.value) return;
        structured.value = {
            ...structured.value,
            sensitivity: sensitivity.value,
            minimumConfidence: minimumConfidence.value,
            watchTargetType: watchTargetType.value,
            watchTargetValue: watchTargetValue.value,
            entityRefs: entityChips.value,
        };
    }

    watch([sensitivity, minimumConfidence, watchTargetType, watchTargetValue, entityChips], () => {
        syncStructuredWithForm();
    });

    async function save() {
        saving.value = true;
        try {
            syncStructuredWithForm();
            const body = {
                name: ruleName.value || prompt.value.slice(0, 60),
                naturalLanguagePrompt: prompt.value,
                structuredRule: structured.value!,
                frequency: frequency.value,
                sensitivity: sensitivity.value,
                minimumConfidence: minimumConfidence.value,
                deliveryDestination: deliveryDestination.value,
                enabled: true,
            };

            let res: { rule: AlertRule };
            if (editingRuleId.value) {
                res = await $fetch<{ rule: AlertRule }>(
                    `/api/yottalert/alert-rules/${editingRuleId.value}`,
                    { method: 'PATCH', body }
                );
            } else {
                res = await $fetch<{ rule: AlertRule }>('/api/yottalert/alert-rules', {
                    method: 'POST',
                    body,
                });
            }
            savedRuleId.value = res.rule.id;
            editingRuleId.value = res.rule.id;
            await loadFeedbackSignal(res.rule.id);
            checkMessage.value = `Saved rule ${res.rule.id} — click "Check now" to run a sync.`;
            await refreshAll();
        } catch (err) {
            checkMessage.value = `Save failed: ${err instanceof Error ? err.message : String(err)}`;
        } finally {
            saving.value = false;
        }
    }

    async function checkNow() {
        if (!savedRuleId.value) return;
        checking.value = true;
        checkMessage.value = '';
        try {
            const res = await $fetch<{
                syncRun: { status: string; candidateAlertsCreated: number };
                created: Array<{ id: string; title: string }>;
            }>(`/api/yottalert/alert-rules/${savedRuleId.value}/check-now`, { method: 'POST' });
            checkMessage.value = `Sync ${res.syncRun.status} — created ${res.created.length} candidate alert(s).`;
            await refreshAll();
            if (res.created.length) {
                router.push(`/yottalert/alerts/${res.created[0].id}`);
            }
        } catch (err) {
            checkMessage.value = `Check failed: ${err instanceof Error ? err.message : String(err)}`;
        } finally {
            checking.value = false;
        }
    }

    onMounted(async () => {
        const ruleId = route.query.ruleId as string | undefined;
        if (ruleId) {
            try {
                const res = await $fetch<{ rule: AlertRule }>(
                    `/api/yottalert/alert-rules/${ruleId}`
                );
                hydrateFromRule(res.rule);
            } catch {
                // Rule not found — silently fall through to new-rule mode.
            }
        }
    });

    function hydrateFromRule(rule: AlertRule) {
        editingRuleId.value = rule.id;
        savedRuleId.value = rule.id;
        prompt.value = rule.naturalLanguagePrompt;
        ruleName.value = rule.name;
        frequency.value = rule.frequency;
        sensitivity.value = rule.sensitivity;
        minimumConfidence.value = rule.minimumConfidence;
        deliveryDestination.value = rule.deliveryDestination;
        watchTargetType.value = rule.watchTargetType;
        watchTargetValue.value = rule.structuredRule.watchTargetValue;
        structured.value = rule.structuredRule;
        entityChips.value = (rule.structuredRule.entityRefs ?? []).map((e) => ({
            neid: e.neid || `local-${e.name}`,
            name: e.name,
        }));
        interpretSource.value = 'loaded';
        loadFeedbackSignal(rule.id);
    }
</script>

<style scoped>
    .builder {
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
        font-size: 1.8rem;
        margin-top: 4px;
    }
    .page-subtitle {
        margin-top: 6px;
        color: rgba(255, 255, 255, 0.55);
        font-size: 13px;
        max-width: 720px;
    }
    .builder-grid {
        display: grid;
        gap: 24px;
        grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    }
    @media (max-width: 1100px) {
        .builder-grid {
            grid-template-columns: 1fr;
        }
    }
    .card {
        background: var(--lv-surface);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 18px 18px 22px;
        margin-bottom: 18px;
    }
    .card-title {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.55);
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }
    @media (max-width: 700px) {
        .grid-2 {
            grid-template-columns: 1fr;
        }
    }
    .row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
    }
    .row.actions {
        margin-top: 4px;
    }
    .feedback-callout {
        margin-bottom: 10px;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid rgba(var(--dynamic-primary-rgb), 0.35);
        background: rgba(var(--dynamic-primary-rgb), 0.12);
        font-size: 12px;
        color: rgba(255, 255, 255, 0.9);
    }
    .latency {
        font-family: var(--font-mono);
        font-size: 11px;
        color: rgba(255, 255, 255, 0.5);
    }
    .check-message {
        font-family: var(--font-mono);
        font-size: 11px;
        color: rgba(255, 255, 255, 0.7);
    }
    .source-chip {
        margin-left: auto;
        font-size: 10px;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(63, 234, 0, 0.18);
        color: var(--lv-green);
        letter-spacing: 0.08em;
    }
    .slider-block {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .slider-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.7);
    }
    .builder-right .card.sticky {
        position: sticky;
        top: 16px;
    }
    .preview {
        margin-top: 4px;
    }
    .empty-preview {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.6);
        line-height: 1.5;
    }
</style>
