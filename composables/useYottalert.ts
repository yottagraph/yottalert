import { computed, ref } from 'vue';

import type { WatchArea, YottalertAlert } from '~/utils/yottalert/types';

const _watchArea = ref<WatchArea | null>(null);
const _watchAreas = ref<WatchArea[]>([]);
const _alerts = ref<YottalertAlert[]>([]);
const _watchAreaLoading = ref(false);
const _alertsLoading = ref(false);
const _backend = ref<string>('localfs');

async function refreshWatchArea(): Promise<void> {
    _watchAreaLoading.value = true;
    try {
        const res = await $fetch<{
            watchArea: WatchArea;
            watchAreas?: WatchArea[];
            backend: string;
        }>('/api/yottalert/watch-area');
        _watchArea.value = res.watchArea;
        _watchAreas.value = res.watchAreas ?? [res.watchArea];
        if (res.backend) _backend.value = res.backend;
    } catch {
        _watchArea.value = null;
        _watchAreas.value = [];
    } finally {
        _watchAreaLoading.value = false;
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
    await Promise.all([refreshWatchArea(), refreshAlerts()]);
}

async function runCheckNow(): Promise<void> {
    await $fetch('/api/yottalert/watch-area/check-now', { method: 'POST' });
    await refreshAlerts();
}

export function useYottalert() {
    const highSeverity = computed(() =>
        _alerts.value.filter((a) => a.severity === 'high' || a.severity === 'medium')
    );
    const recent = computed(() => _alerts.value.slice(0, 20));
    const sortedByScore = computed(() => [..._alerts.value].sort((a, b) => b.score - a.score));

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
        watchArea: computed(() => _watchArea.value),
        watchAreas: computed(() => _watchAreas.value),
        alerts: computed(() => _alerts.value),
        watchAreaLoading: computed(() => _watchAreaLoading.value),
        alertsLoading: computed(() => _alertsLoading.value),
        backend: computed(() => _backend.value),
        highSeverity,
        recent,
        sortedByScore,
        watchedEntities,
        refreshWatchArea,
        refreshAlerts,
        refreshAll,
        runCheckNow,
    };
}
