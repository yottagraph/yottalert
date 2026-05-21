import { computed, ref } from 'vue';

import type { ElementalConnectionStatus } from '~/utils/yottalert/types';

const _status = ref<ElementalConnectionStatus | null>(null);
const _schema = ref<{ flavorCount: number; propertyCount: number } | null>(null);
const _loading = ref(false);
const _error = ref<string | null>(null);
let _pollTimer: ReturnType<typeof setInterval> | null = null;

async function refresh(): Promise<void> {
    _loading.value = true;
    _error.value = null;
    try {
        const res = await $fetch<{
            status: ElementalConnectionStatus;
            schema: { flavorCount: number; propertyCount: number };
        }>('/api/yottalert/elemental/status');
        _status.value = res.status;
        _schema.value = res.schema;
    } catch (err) {
        _error.value = err instanceof Error ? err.message : String(err);
    } finally {
        _loading.value = false;
    }
}

function startPolling(intervalMs = 60_000): void {
    if (_pollTimer) return;
    refresh();
    _pollTimer = setInterval(refresh, intervalMs);
}

function stopPolling(): void {
    if (_pollTimer) {
        clearInterval(_pollTimer);
        _pollTimer = null;
    }
}

export function useElementalStatus() {
    const overall = computed<'green' | 'amber' | 'red' | 'unknown'>(() => {
        if (!_status.value) return 'unknown';
        const { apiReachable, mcpReachable } = _status.value;
        if (apiReachable && mcpReachable) return 'green';
        if (apiReachable || mcpReachable) return 'amber';
        return 'red';
    });

    const tooltip = computed(() => {
        const s = _status.value;
        if (!s) return 'Checking Elemental connection…';
        if (s.apiReachable && s.mcpReachable) {
            return `Elemental healthy · API ${s.latencyMs ?? '—'}ms · ${
                s.mcpToolCount ?? 0
            } MCP tools`;
        }
        if (s.apiReachable) return 'Elemental API healthy · MCP degraded';
        if (s.mcpReachable) return 'Elemental MCP healthy · API degraded';
        return s.lastError || 'Elemental unreachable';
    });

    return {
        status: computed(() => _status.value),
        schema: computed(() => _schema.value),
        loading: computed(() => _loading.value),
        error: computed(() => _error.value),
        overall,
        tooltip,
        refresh,
        startPolling,
        stopPolling,
    };
}
