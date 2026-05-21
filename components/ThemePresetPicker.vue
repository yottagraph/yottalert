<template>
    <div class="theme-picker" :class="variantClass">
        <button
            v-for="preset in presets"
            :key="preset.id"
            type="button"
            class="preset-btn"
            :class="{ active: preset.id === currentPreset.id }"
            @click="applyThemeById(preset.id)"
        >
            <span class="swatches">
                <span class="swatch" :style="{ background: preset.dynamicTokens.primary }" />
                <span class="swatch" :style="{ background: preset.dynamicTokens.surface }" />
                <span class="swatch" :style="{ background: preset.dynamicTokens.textPrimary }" />
            </span>
            <span class="label">{{ preset.label }}</span>
            <v-icon v-if="preset.id === currentPreset.id" icon="mdi-check" size="14" />
        </button>
    </div>
</template>

<script setup lang="ts">
    import { computed } from 'vue';

    import { useLovelaceTheme } from '~/composables/useLovelaceTheme';

    const props = withDefaults(
        defineProps<{
            variant?: 'compact' | 'full';
        }>(),
        { variant: 'full' }
    );

    const { presets, currentPreset, applyThemeById } = useLovelaceTheme();
    const variantClass = computed(() => (props.variant === 'compact' ? 'compact' : 'full'));
</script>

<style scoped>
    .theme-picker {
        display: grid;
        gap: 8px;
    }
    .theme-picker.compact {
        width: 240px;
    }
    .theme-picker.full {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .preset-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.03);
        color: inherit;
        border-radius: 8px;
        padding: 8px 10px;
        cursor: pointer;
    }
    .preset-btn.active {
        border-color: rgba(var(--dynamic-primary-rgb), 0.55);
        background: rgba(var(--dynamic-primary-rgb), 0.12);
    }
    .swatches {
        display: inline-flex;
        gap: 5px;
    }
    .swatch {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.35);
    }
    .label {
        flex: 1;
        text-align: left;
        font-size: 12px;
    }
</style>
