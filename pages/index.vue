<template>
    <div class="redirect-shell">
        <v-progress-circular indeterminate size="22" color="primary" />
        <span class="redirect-text">Loading Yottalert…</span>
    </div>
</template>

<script setup lang="ts">
    import { onMounted } from 'vue';

    const router = useRouter();

    onMounted(() => {
        router.replace('/yottalert');
    });
</script>

<style scoped>
    .redirect-shell {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
        color: rgba(255, 255, 255, 0.7);
        font-family: var(--font-mono);
        font-size: 12px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
    }
    .redirect-text {
        margin-left: 6px;
    }
</style>
