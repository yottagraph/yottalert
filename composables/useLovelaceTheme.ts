import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { useTheme } from 'vuetify';
import { Pref } from '~/composables/usePrefsStore';
import { useUserState } from '~/composables/useUserState';
import {
    DEFAULT_THEME_ID,
    THEME_PRESETS,
    THEME_PRESETS_BY_ID,
    type ThemePresetId,
} from '~/utils/theme/themePresets';

const themeId = ref<ThemePresetId>(DEFAULT_THEME_ID);
const initialized = ref(false);
const themePref = shallowRef<Pref<string> | null>(null);
const prefReady = ref(false);

export const useLovelaceTheme = () => {
    const theme = useTheme();
    const runtime = useRuntimeConfig();
    const { userId } = useUserState();

    const currentPreset = computed(
        () => THEME_PRESETS_BY_ID[themeId.value] ?? THEME_PRESETS_BY_ID[DEFAULT_THEME_ID]
    );
    const currentThemeColors = computed(() => currentPreset.value.dynamicTokens);

    const applyCssVariables = (id: ThemePresetId) => {
        if (typeof window === 'undefined') return;
        const preset = THEME_PRESETS_BY_ID[id] ?? THEME_PRESETS_BY_ID[DEFAULT_THEME_ID];
        const colors = preset.dynamicTokens;
        const root = document.documentElement;

        root.style.setProperty('--dynamic-primary', colors.primary);
        root.style.setProperty('--dynamic-secondary', colors.secondary);
        root.style.setProperty('--dynamic-accent', colors.accent);
        root.style.setProperty('--dynamic-background', colors.background);
        root.style.setProperty('--dynamic-surface', colors.surface);
        root.style.setProperty('--dynamic-card-background', colors.cardBackground);
        root.style.setProperty('--dynamic-panel-background', colors.panelBackground);
        root.style.setProperty('--dynamic-text-primary', colors.textPrimary);
        root.style.setProperty('--dynamic-text-secondary', colors.textSecondary);
        root.style.setProperty('--dynamic-text-muted', colors.textMuted);
        root.style.setProperty('--dynamic-hover', colors.hover);
        root.style.setProperty('--dynamic-border', colors.border);
        root.style.setProperty('--dynamic-success', colors.success);
        root.style.setProperty('--dynamic-warning', colors.warning);
        root.style.setProperty('--dynamic-error', colors.error);
        root.style.setProperty('--dynamic-primary-rgb', colors.primaryRgb);
        root.style.setProperty('--dynamic-fg-rgb', colors.fgRgb);
        root.style.setProperty('--dynamic-severity-high', colors.severityHigh);
        root.style.setProperty('--dynamic-severity-medium', colors.severityMedium);
        root.style.setProperty('--dynamic-severity-low', colors.severityLow);
        root.style.setProperty('--dynamic-severity-suppressed', colors.severitySuppressed);
        root.style.setProperty('--dynamic-severity-high-rgb', colors.severityHighRgb);
        root.style.setProperty('--dynamic-severity-medium-rgb', colors.severityMediumRgb);
        root.style.setProperty('--dynamic-severity-low-rgb', colors.severityLowRgb);
        root.style.setProperty('--dynamic-severity-suppressed-rgb', colors.severitySuppressedRgb);
        root.style.setProperty('--dynamic-header-gradient-start', colors.headerGradientStart);
        root.style.setProperty('--dynamic-header-gradient-end', colors.headerGradientEnd);

        root.dataset.themeId = preset.id;
        root.dataset.themeMode = preset.mode;
    };

    const syncLocalMemory = (id: ThemePresetId) => {
        const mode = THEME_PRESETS_BY_ID[id]?.mode;
        if (!mode || typeof window === 'undefined') return;
        const key = mode === 'dark' ? 'yottalert:lastDark' : 'yottalert:lastLight';
        window.localStorage.setItem(key, id);
    };

    const maybePersist = async (id: ThemePresetId): Promise<void> => {
        if (!themePref.value || !prefReady.value) return;
        await themePref.value.set(id);
    };

    const applyThemeById = async (id: string, options?: { persist?: boolean }) => {
        const resolved = (
            THEME_PRESETS_BY_ID[id as ThemePresetId] ? id : DEFAULT_THEME_ID
        ) as ThemePresetId;
        themeId.value = resolved;
        applyCssVariables(resolved);
        theme.change(resolved);
        syncLocalMemory(resolved);
        if (options?.persist !== false) await maybePersist(resolved);
    };

    const resolveInitialTheme = (): ThemePresetId => {
        if (typeof window === 'undefined') return DEFAULT_THEME_ID;
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return prefersDark ? 'lovelace-dark' : 'lovelace-light';
    };

    const initializePref = async () => {
        const uid = userId.value || runtime.public.userName || 'dev-user';
        const appId = String(runtime.public.appId || 'yottalert');
        const docPath = `/users/${uid}/apps/${appId}/settings/theme`;
        themePref.value = new Pref<string>(docPath, 'themeId', resolveInitialTheme());
        await themePref.value.initialize();
        prefReady.value = true;
        const stored = themePref.value.v;
        const id =
            stored && THEME_PRESETS_BY_ID[stored as ThemePresetId]
                ? (stored as ThemePresetId)
                : resolveInitialTheme();
        await applyThemeById(id, { persist: false });
    };

    const toggleDarkLight = async () => {
        if (typeof window === 'undefined') return;
        const isDark = currentPreset.value.mode === 'dark';
        const targetMode = isDark ? 'light' : 'dark';
        const key = targetMode === 'dark' ? 'yottalert:lastDark' : 'yottalert:lastLight';
        const cached = window.localStorage.getItem(key) as ThemePresetId | null;
        const fallback = targetMode === 'dark' ? 'lovelace-dark' : 'lovelace-light';
        const next = cached && THEME_PRESETS_BY_ID[cached] ? cached : fallback;
        await applyThemeById(next);
    };

    onMounted(() => {
        if (initialized.value) return;
        initialized.value = true;
        initializePref();
    });

    watch(userId, () => {
        if (!initialized.value) return;
        initializePref();
    });

    return {
        presets: THEME_PRESETS,
        currentPreset,
        currentThemeColors,
        applyThemeById,
        toggleDarkLight,
    };
};
