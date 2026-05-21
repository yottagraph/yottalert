<template>
    <div class="feedback-bar">
        <div class="bar-label">Feedback</div>
        <div class="chips">
            <button
                v-for="opt in options"
                :key="opt.value"
                class="fb-chip"
                :class="{ active: lastValue === opt.value, busy: busyValue === opt.value }"
                :disabled="!!busyValue"
                type="button"
                @click="submit(opt.value)"
            >
                <v-icon v-if="opt.icon" :icon="opt.icon" size="12" class="fb-icon" />
                {{ opt.label }}
            </button>
        </div>
        <div v-if="lastValue" class="status">Thanks — feedback saved.</div>
    </div>
</template>

<script setup lang="ts">
    import { ref } from 'vue';
    import type { AlertFeedbackType } from '~/utils/yottalert/types';

    const props = defineProps<{ alertId: string }>();
    const emit = defineEmits<{ (e: 'submitted', value: AlertFeedbackType): void }>();

    const options: { label: string; value: AlertFeedbackType; icon?: string }[] = [
        { label: 'Useful', value: 'useful', icon: 'mdi-thumb-up-outline' },
        { label: 'Not relevant', value: 'not_relevant', icon: 'mdi-cancel' },
        { label: 'Duplicate', value: 'duplicate', icon: 'mdi-content-duplicate' },
        { label: 'Wrong location', value: 'wrong_location', icon: 'mdi-map-marker-off-outline' },
        { label: 'Wrong entity', value: 'wrong_entity', icon: 'mdi-account-off-outline' },
        { label: 'Too noisy', value: 'too_noisy', icon: 'mdi-volume-vibrate' },
        { label: 'Too late', value: 'too_late', icon: 'mdi-clock-alert-outline' },
        {
            label: 'Increase sensitivity',
            value: 'increase_sensitivity',
            icon: 'mdi-arrow-up-bold',
        },
        {
            label: 'Decrease sensitivity',
            value: 'decrease_sensitivity',
            icon: 'mdi-arrow-down-bold',
        },
        { label: 'Add similar', value: 'add_similar', icon: 'mdi-plus-circle-outline' },
        { label: 'Suppress similar', value: 'suppress_similar', icon: 'mdi-eye-off-outline' },
    ];

    const lastValue = ref<AlertFeedbackType | null>(null);
    const busyValue = ref<AlertFeedbackType | null>(null);

    async function submit(value: AlertFeedbackType) {
        busyValue.value = value;
        try {
            await $fetch(`/api/yottalert/alerts/${props.alertId}/feedback`, {
                method: 'POST',
                body: { feedbackType: value },
            });
            lastValue.value = value;
            emit('submitted', value);
        } catch (err) {
            console.warn('feedback failed', err);
        } finally {
            busyValue.value = null;
        }
    }
</script>

<style scoped>
    .feedback-bar {
        position: sticky;
        bottom: 0;
        margin-top: 24px;
        padding: 14px 16px;
        background: rgba(20, 20, 20, 0.92);
        backdrop-filter: blur(8px);
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
    }
    .bar-label {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.5);
        margin-bottom: 8px;
    }
    .chips {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }
    .fb-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.8);
        font-size: 12px;
        padding: 5px 10px;
        border-radius: 999px;
        cursor: pointer;
        transition: background 0.15s ease;
    }
    .fb-chip:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.1);
    }
    .fb-chip.active {
        background: rgba(63, 234, 0, 0.18);
        color: var(--lv-green);
        border-color: rgba(63, 234, 0, 0.4);
    }
    .fb-chip.busy {
        opacity: 0.6;
    }
    .fb-icon {
        opacity: 0.8;
    }
    .status {
        margin-top: 8px;
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--lv-green);
        letter-spacing: 0.08em;
    }
</style>
