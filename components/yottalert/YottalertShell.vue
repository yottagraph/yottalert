<template>
    <div class="yottalert-shell">
        <div class="yottalert-layout">
            <aside class="yottalert-sidebar">
                <div class="sidebar-section">
                    <div class="section-label">Navigation</div>
                    <NuxtLink
                        v-for="item in navItems"
                        :key="item.to"
                        :to="item.to"
                        class="nav-link"
                        :class="{ active: isActive(item) }"
                    >
                        <v-icon :icon="item.icon" size="14" class="nav-icon" />
                        <span>{{ item.label }}</span>
                    </NuxtLink>
                </div>

                <div class="sidebar-footer">
                    <div class="footer-line">{{ alertCount }} alerts</div>
                    <div class="footer-line">
                        Watch areas:
                        <span class="watch-name">
                            {{ watchAreas.length || 'not set' }}
                        </span>
                    </div>
                    <div class="footer-line">
                        <NuxtLink to="/yottalert/onboarding" class="change-link">
                            Change area
                        </NuxtLink>
                    </div>
                    <div class="footer-line muted">
                        Store: {{ backend === 'redis' ? 'KV' : 'local-fs' }}
                    </div>
                </div>
            </aside>

            <div class="yottalert-content">
                <div class="yottalert-scroll">
                    <slot />
                    <YottalertProvenanceFooter />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { computed, onMounted } from 'vue';
    import { useRoute } from 'vue-router';

    import { useYottalert } from '~/composables/useYottalert';

    const route = useRoute();
    const { watchAreas, alerts, backend, refreshAll } = useYottalert();

    onMounted(() => {
        refreshAll();
    });

    const navItems = [
        { to: '/yottalert', label: 'Dashboard', icon: 'mdi-view-dashboard-outline' },
        { to: '/yottalert/digest', label: 'Digest', icon: 'mdi-file-document-outline' },
        { to: '/yottalert/settings/elemental', label: 'Settings', icon: 'mdi-cog-outline' },
    ];

    const alertCount = computed(() => alerts.value.length);

    function isActive(item: { to: string }): boolean {
        if (item.to === '/yottalert') {
            return route.path === '/yottalert' || route.path === '/yottalert/';
        }
        return route.path.startsWith(item.to);
    }
</script>

<style scoped>
    .yottalert-shell {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    .yottalert-layout {
        flex: 1;
        display: flex;
        min-height: 0;
    }
    .yottalert-sidebar {
        flex: 0 0 184px;
        background: var(--lv-sidebar-bg);
        color: rgb(var(--lv-sidebar-fg-rgb));
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        border-right: 1px solid var(--lv-sidebar-divider);
    }
    .sidebar-section {
        padding: 16px 0 12px;
        border-bottom: 1px solid var(--lv-sidebar-divider);
    }
    .section-label {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.45);
        padding: 0 16px 8px;
    }
    .nav-link {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 16px;
        color: rgba(255, 255, 255, 0.78);
        text-decoration: none;
        font-size: 13px;
        line-height: 1.3;
        transition: background 0.12s ease;
    }
    .nav-link:hover {
        background: rgba(255, 255, 255, 0.04);
        color: #fff;
    }
    .nav-link.active {
        background: rgba(63, 234, 0, 0.16);
        color: var(--lv-green);
    }
    .nav-link.active .nav-icon {
        color: var(--lv-green);
    }
    .nav-icon {
        color: rgba(255, 255, 255, 0.6);
    }
    .rule-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
    }
    .sidebar-footer {
        margin-top: auto;
        padding: 12px 16px;
        font-family: var(--font-mono);
        font-size: 10px;
        color: rgba(255, 255, 255, 0.55);
        border-top: 1px solid var(--lv-sidebar-divider);
    }
    .footer-line {
        margin-bottom: 4px;
    }
    .footer-line.muted {
        color: rgba(255, 255, 255, 0.35);
    }
    .watch-name {
        color: rgba(255, 255, 255, 0.9);
    }
    .change-link {
        color: var(--lv-green);
        text-decoration: none;
    }
    .yottalert-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
    }
    .yottalert-scroll {
        flex: 1;
        overflow-y: auto;
        background: var(--lv-black);
    }
</style>
