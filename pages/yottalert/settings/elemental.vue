<template>
    <YottalertShell>
        <main class="settings">
            <header class="page-head">
                <span class="kicker">YOTTALERT</span>
                <h1 class="page-title">Elemental connection</h1>
                <p class="page-subtitle">
                    Yottalert routes every Elemental call through your tenant's portal gateway —
                    credentials never live in the browser. Verify the live connection here.
                </p>
            </header>

            <div class="grid">
                <div class="card">
                    <div class="card-title">Connection</div>
                    <v-text-field
                        v-model="form.connectionName"
                        label="Connection name"
                        hide-details
                        class="mb-3"
                    />
                    <v-text-field
                        v-model="form.mcpServerUrl"
                        label="MCP server URL"
                        hide-details
                        class="mb-3"
                    />
                    <v-text-field
                        v-model="form.apiBaseUrl"
                        label="API base URL"
                        hide-details
                        class="mb-3"
                    />
                    <v-select
                        v-model="form.authType"
                        :items="authOptions"
                        label="Auth type"
                        hide-details
                        class="mb-3"
                    />
                    <v-text-field
                        v-model="form.credentials"
                        label="Credentials (write-only — never read back)"
                        type="password"
                        hint="Stored server-side. The portal gateway proxies the call so the browser never sees the token."
                        persistent-hint
                    />
                    <div class="row mt-4">
                        <v-btn
                            color="primary"
                            :loading="testing"
                            prepend-icon="mdi-lan-check"
                            @click="testConnection"
                        >
                            Test connection
                        </v-btn>
                        <span v-if="testMessage" class="test-message">{{ testMessage }}</span>
                    </div>
                </div>

                <div class="card">
                    <div class="card-title">Live status</div>
                    <div class="status-grid">
                        <div class="status-row">
                            <span class="kicker">API reachable</span>
                            <span :class="['value', status?.apiReachable ? 'ok' : 'bad']">
                                {{ status?.apiReachable ? 'yes' : 'no' }}
                            </span>
                        </div>
                        <div class="status-row">
                            <span class="kicker">MCP reachable</span>
                            <span :class="['value', status?.mcpReachable ? 'ok' : 'bad']">
                                {{ status?.mcpReachable ? 'yes' : 'no' }}
                            </span>
                        </div>
                        <div class="status-row">
                            <span class="kicker">Last checked</span>
                            <span class="value mono">{{
                                status ? relativeTime(status.lastCheckedAt) : 'never'
                            }}</span>
                        </div>
                        <div class="status-row">
                            <span class="kicker">Latency</span>
                            <span class="value mono">{{
                                status?.latencyMs !== undefined ? `${status.latencyMs} ms` : '—'
                            }}</span>
                        </div>
                        <div class="status-row">
                            <span class="kicker">MCP tools</span>
                            <span class="value mono">{{ status?.mcpToolCount ?? 0 }}</span>
                        </div>
                        <div class="status-row">
                            <span class="kicker">Schema</span>
                            <span class="value mono"
                                >{{ schema?.flavorCount ?? 0 }} flavors ·
                                {{ schema?.propertyCount ?? 0 }} PIDs</span
                            >
                        </div>
                        <div v-if="status?.lastError" class="status-row last-error">
                            <span class="kicker">Last error</span>
                            <span class="value bad mono">{{ status.lastError }}</span>
                        </div>
                    </div>
                </div>

                <div class="card span-2">
                    <div class="card-title">Stable MCP surface</div>
                    <div class="surface-grid">
                        <div
                            v-for="tool in mcpSurface"
                            :key="tool.name"
                            class="surface-row"
                            :class="{ degraded: !tool.available }"
                        >
                            <span class="mono">{{ tool.name }}</span>
                            <span class="badge" :class="tool.available ? 'ok' : 'bad'">{{
                                tool.available ? 'live' : 'fallback'
                            }}</span>
                        </div>
                    </div>
                    <p class="caption">
                        Yottalert exposes the function names above to the rest of the app even if
                        the upstream Elemental MCP tool names change. Functions marked
                        <strong>fallback</strong> route through the REST gateway instead.
                    </p>
                </div>
            </div>
        </main>
    </YottalertShell>
</template>

<script setup lang="ts">
    import { computed, onMounted, ref } from 'vue';

    import { useElementalStatus } from '~/composables/useElementalStatus';
    import { relativeTime } from '~/utils/yottalert/severity';

    definePageMeta({ layout: false });

    const { status, schema, refresh } = useElementalStatus();

    const form = ref({
        connectionName: 'Tenant default',
        mcpServerUrl: '',
        apiBaseUrl: '',
        authType: 'gateway_proxy',
        credentials: '',
    });
    const testing = ref(false);
    const testMessage = ref('');

    const authOptions = [
        { title: 'Portal gateway proxy (recommended)', value: 'gateway_proxy' },
        { title: 'API key', value: 'api_key' },
        { title: 'Bearer token', value: 'bearer' },
    ];

    const mcpSurface = computed(() => [
        { name: 'searchEntities', available: status.value?.apiReachable ?? false },
        { name: 'getEntity', available: status.value?.apiReachable ?? false },
        { name: 'searchEvents', available: false },
        { name: 'getEventsForEntity', available: status.value?.apiReachable ?? false },
        { name: 'getEntitiesForGeography', available: status.value?.apiReachable ?? false },
        { name: 'getRelationships', available: false },
        { name: 'getRelatedEntities', available: false },
        { name: 'getSourcesForObject', available: false },
        { name: 'getProvenanceForObject', available: false },
        { name: 'getGraphNeighborhood', available: false },
        { name: 'resolveUserWatchQuery', available: true },
    ]);

    onMounted(() => {
        if (!status.value) refresh();
        const config = useRuntimeConfig().public as Record<string, string>;
        form.value.apiBaseUrl = config.gatewayUrl
            ? `${config.gatewayUrl}/api/qs/${config.tenantOrgId}`
            : '';
        form.value.mcpServerUrl = config.gatewayUrl
            ? `${config.gatewayUrl}/api/mcp/${config.tenantOrgId}`
            : '';
    });

    async function testConnection() {
        testing.value = true;
        testMessage.value = '';
        try {
            const res = await $fetch<{
                ok: boolean;
                api: { ok: boolean; error?: string; latencyMs?: number };
                mcp: { ok: boolean; error?: string; toolCount?: number };
            }>('/api/yottalert/elemental/test-connection', { method: 'POST' });
            testMessage.value = res.ok
                ? `Healthy · API ${res.api.latencyMs ?? '—'}ms · ${res.mcp.toolCount ?? 0} MCP tools`
                : `Degraded — ${res.api.error || res.mcp.error || 'unknown error'}`;
            await refresh();
        } catch (err) {
            testMessage.value = `Test failed: ${err instanceof Error ? err.message : String(err)}`;
        } finally {
            testing.value = false;
        }
    }
</script>

<style scoped>
    .settings {
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
    .grid {
        display: grid;
        gap: 20px;
        grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    }
    @media (max-width: 1000px) {
        .grid {
            grid-template-columns: 1fr;
        }
        .span-2 {
            grid-column: span 1;
        }
    }
    .span-2 {
        grid-column: span 2;
    }
    .card {
        background: var(--lv-surface);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 18px 20px;
    }
    .card-title {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.55);
        margin-bottom: 16px;
    }
    .row {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
    }
    .test-message {
        font-family: var(--font-mono);
        font-size: 11px;
        color: rgba(255, 255, 255, 0.75);
    }
    .status-grid {
        display: grid;
        gap: 8px;
    }
    .status-row {
        display: grid;
        grid-template-columns: 130px 1fr;
        gap: 12px;
        align-items: baseline;
        padding: 4px 0;
        font-size: 13px;
    }
    .status-row .kicker {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.45);
    }
    .status-row .value.ok {
        color: var(--lv-green);
    }
    .status-row .value.bad {
        color: var(--dynamic-severity-high);
    }
    .last-error {
        grid-template-columns: 130px 1fr;
    }
    .mono {
        font-family: var(--font-mono);
        font-size: 12px;
        color: rgba(255, 255, 255, 0.85);
    }
    .surface-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 8px;
    }
    .surface-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 10px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.03);
        font-size: 13px;
    }
    .surface-row.degraded {
        opacity: 0.85;
    }
    .badge {
        font-family: var(--font-mono);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        padding: 2px 8px;
        border-radius: 999px;
    }
    .badge.ok {
        background: rgba(63, 234, 0, 0.15);
        color: var(--lv-green);
    }
    .badge.bad {
        background: rgba(var(--dynamic-severity-medium-rgb), 0.18);
        color: var(--dynamic-severity-medium);
    }
    .caption {
        margin-top: 14px;
        color: rgba(255, 255, 255, 0.55);
        font-size: 12px;
        line-height: 1.5;
    }
</style>
