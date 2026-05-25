<template>
    <main class="onboarding">
        <section class="card">
            <span class="kicker">YOTTALERT</span>
            <h1 class="title">
                {{ existingWatchArea ? 'Change your watch area' : 'Start with one place' }}
            </h1>
            <p class="subtitle">
                Pick a ZIP code or county, then choose a few things you care about.
            </p>

            <v-autocomplete
                v-model="selectedGeography"
                :items="geographySuggestions"
                :loading="searching"
                label="ZIP or county"
                placeholder="e.g. 15213 or Allegheny County"
                item-title="name"
                return-object
                hide-no-data
                no-filter
                class="mt-4"
                @update:search="onSearch"
            />

            <div class="interest-section">
                <div class="interest-title">Interests (pick 2-5)</div>
                <div class="interest-grid">
                    <button
                        v-for="option in interestOptions"
                        :key="option.key"
                        type="button"
                        class="interest-chip"
                        :class="{ selected: selectedInterests.includes(option.key) }"
                        @click="toggleInterest(option.key)"
                    >
                        {{ option.label }}
                    </button>
                </div>
            </div>

            <div v-if="errorMessage" class="error">{{ errorMessage }}</div>

            <div class="actions">
                <v-btn
                    color="primary"
                    :loading="saving"
                    :disabled="!canSubmit"
                    prepend-icon="mdi-radar"
                    @click="startWatching"
                >
                    {{ existingWatchArea ? 'Update watch area' : 'Start watching' }}
                </v-btn>
            </div>
        </section>
    </main>
</template>

<script setup lang="ts">
    import { computed, onMounted, ref } from 'vue';
    import { useRouter } from 'vue-router';

    import { INTEREST_LABELS } from '~/utils/yottalert/interests';
    import type { GeographySearchResult, InterestKey, WatchArea } from '~/utils/yottalert/types';

    definePageMeta({ layout: false });

    const router = useRouter();
    const selectedGeography = ref<GeographySearchResult | null>(null);
    const geographySuggestions = ref<GeographySearchResult[]>([]);
    const selectedInterests = ref<InterestKey[]>([]);
    const searching = ref(false);
    const saving = ref(false);
    const errorMessage = ref('');
    const existingWatchArea = ref<WatchArea | null>(null);

    let searchTimer: ReturnType<typeof setTimeout> | null = null;

    const interestOptions = Object.entries(INTEREST_LABELS).map(([key, label]) => ({
        key: key as InterestKey,
        label,
    }));

    const canSubmit = computed(
        () =>
            Boolean(selectedGeography.value) &&
            selectedInterests.value.length >= 2 &&
            selectedInterests.value.length <= 5
    );

    onMounted(async () => {
        try {
            const res = await $fetch<{ watchArea: WatchArea }>('/api/yottalert/watch-area');
            existingWatchArea.value = res.watchArea;
            selectedGeography.value = {
                neid: res.watchArea.geographyNeid,
                name: res.watchArea.geographyLabel,
                geographyType: res.watchArea.geographyType,
                code: res.watchArea.geographyCode,
            };
            geographySuggestions.value = [selectedGeography.value];
            selectedInterests.value = [...res.watchArea.interests];
        } catch {
            // Stay on onboarding if no watch area exists yet.
        }
    });

    function toggleInterest(key: InterestKey): void {
        if (selectedInterests.value.includes(key)) {
            selectedInterests.value = selectedInterests.value.filter((item) => item !== key);
            return;
        }
        if (selectedInterests.value.length >= 5) return;
        selectedInterests.value = [...selectedInterests.value, key];
    }

    function onSearch(query: string): void {
        if (searchTimer) clearTimeout(searchTimer);
        if (!query || query.trim().length < 2) {
            geographySuggestions.value = [];
            return;
        }
        searchTimer = setTimeout(async () => {
            searching.value = true;
            try {
                const results = await $fetch<{ results: GeographySearchResult[] }>(
                    `/api/yottalert/geographies/search?q=${encodeURIComponent(query)}`
                );
                geographySuggestions.value = results.results;
            } catch {
                geographySuggestions.value = [];
            } finally {
                searching.value = false;
            }
        }, 250);
    }

    async function startWatching(): Promise<void> {
        if (!selectedGeography.value || !canSubmit.value) return;
        saving.value = true;
        errorMessage.value = '';
        try {
            await $fetch('/api/yottalert/watch-area', {
                method: 'POST',
                body: {
                    geographyType: selectedGeography.value.geographyType,
                    geographyCode: selectedGeography.value.code,
                    geographyLabel: selectedGeography.value.name,
                    geographyNeid: selectedGeography.value.neid,
                    interests: selectedInterests.value,
                },
            });
            await $fetch('/api/yottalert/watch-area/check-now', { method: 'POST' });
            router.push('/yottalert');
        } catch (error) {
            errorMessage.value =
                error instanceof Error ? error.message : 'Could not save watch area.';
        } finally {
            saving.value = false;
        }
    }
</script>

<style scoped>
    .onboarding {
        min-height: calc(100vh - 64px);
        display: grid;
        place-items: center;
        padding: 32px 20px;
        background: var(--lv-black);
    }
    .card {
        width: min(760px, 100%);
        background: var(--lv-surface);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 24px;
    }
    .kicker {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--lv-green);
    }
    .title {
        margin-top: 8px;
        font-family: var(--font-headline);
        font-weight: 400;
        font-size: 1.8rem;
    }
    .subtitle {
        margin-top: 8px;
        color: rgba(255, 255, 255, 0.65);
        font-size: 14px;
    }
    .interest-section {
        margin-top: 16px;
    }
    .interest-title {
        font-family: var(--font-mono);
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.6);
    }
    .interest-grid {
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .interest-chip {
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.04);
        color: rgba(255, 255, 255, 0.9);
        padding: 7px 12px;
        font-size: 12px;
        cursor: pointer;
    }
    .interest-chip.selected {
        border-color: rgba(63, 234, 0, 0.45);
        background: rgba(63, 234, 0, 0.16);
        color: var(--lv-green);
    }
    .actions {
        margin-top: 20px;
        display: flex;
        justify-content: flex-end;
    }
    .error {
        margin-top: 12px;
        color: #fca5a5;
        font-size: 12px;
    }
</style>
