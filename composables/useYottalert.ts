import { computed, ref } from 'vue';

import type { AlertRule, YottalertAlert } from '~/utils/yottalert/types';

const _rules = ref<AlertRule[]>([]);
const _alerts = ref<YottalertAlert[]>([]);
const _rulesLoading = ref(false);
const _alertsLoading = ref(false);
const _backend = ref<string>('localfs');

async function refreshRules(): Promise<void> {
    _rulesLoading.value = true;
    try {
        const res = await $fetch<{ rules: AlertRule[]; backend: string }>(
            '/api/yottalert/alert-rules'
        );
        _rules.value = res.rules;
        _backend.value = res.backend;
    } finally {
        _rulesLoading.value = false;
    }
}

async function refreshAlerts(): Promise<void> {
    _alertsLoading.value = true;
    try {
        const res = await $fetch<{ alerts: YottalertAlert[] }>('/api/yottalert/alerts');
        _alerts.value = res.alerts;
    } finally {
        _alertsLoading.value = false;
    }
}

async function refreshAll(): Promise<void> {
    await Promise.all([refreshRules(), refreshAlerts()]);
}

export function useYottalert() {
    const highSeverity = computed(() =>
        _alerts.value.filter((a) => a.severity === 'high' || a.severity === 'medium')
    );
    const recent = computed(() => _alerts.value.slice(0, 20));
    const sortedByScore = computed(() => [..._alerts.value].sort((a, b) => b.score - a.score));

    const watchedGeographies = computed(() => {
        const counts = new Map<string, number>();
        for (const r of _rules.value) {
            const geo = r.structuredRule.geography?.name;
            if (geo) counts.set(geo, (counts.get(geo) ?? 0) + 1);
        }
        for (const a of _alerts.value) {
            if (a.geographyLabel) {
                counts.set(a.geographyLabel, (counts.get(a.geographyLabel) ?? 0) + 1);
            }
        }
        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }));
    });

    const watchedEntities = computed(() => {
        const counts = new Map<string, { count: number; neid?: string }>();
        for (const a of _alerts.value) {
            for (const e of a.entities) {
                const prev = counts.get(e.name) ?? { count: 0, neid: e.neid };
                prev.count++;
                counts.set(e.name, prev);
            }
        }
        return [...counts.entries()]
            .sort((a, b) => b[1].count - a[1].count)
            .map(([name, info]) => ({ name, count: info.count, neid: info.neid }));
    });

    return {
        rules: computed(() => _rules.value),
        alerts: computed(() => _alerts.value),
        rulesLoading: computed(() => _rulesLoading.value),
        alertsLoading: computed(() => _alertsLoading.value),
        backend: computed(() => _backend.value),
        highSeverity,
        recent,
        sortedByScore,
        watchedGeographies,
        watchedEntities,
        refreshRules,
        refreshAlerts,
        refreshAll,
    };
}
