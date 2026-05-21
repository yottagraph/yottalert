import { ref } from 'vue';

import type { RuleFeedbackSignal, RuleSuppressionList } from '~/utils/yottalert/types';

export function useRuleFeedback() {
    const signal = ref<RuleFeedbackSignal | null>(null);
    const suppression = ref<RuleSuppressionList | null>(null);
    const loading = ref(false);

    async function load(ruleId: string): Promise<void> {
        if (!ruleId) return;
        loading.value = true;
        try {
            const res = await $fetch<{
                signal: RuleFeedbackSignal | null;
                suppression: RuleSuppressionList | null;
            }>(`/api/yottalert/alert-rules/${ruleId}/feedback-signal`);
            signal.value = res.signal;
            suppression.value = res.suppression;
        } catch {
            signal.value = null;
            suppression.value = null;
        } finally {
            loading.value = false;
        }
    }

    return { signal, suppression, loading, load };
}
