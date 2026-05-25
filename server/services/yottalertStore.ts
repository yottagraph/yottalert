/**
 * KV-backed persistence for Yottalert state — watch area, alerts,
 * sync runs, feedback (PRD §6).
 *
 * Two backends are supported, in order:
 *   1. Upstash Redis if `KV_REST_API_URL` is set (production / Vercel).
 *   2. Local filesystem under `.aether-dev-prefs/yottalert/` so `npm run
 *      dev` and `npm run build` work without external credentials. This
 *      is the same dev fallback used by `usePrefsStore`.
 *
 * The store keeps **Yottalert state only** — every cross-reference to
 * Elemental graph data is an opaque object ID (PRD architectural rule).
 */

import {
    localFsDeleteDoc,
    localFsListDocuments,
    localFsReadDoc,
    localFsWriteField,
} from '../utils/localFsPrefsStore';
import { getRedis, isKVConfigured } from '../utils/redis';

import type {
    AlertFeedback,
    SyncRun,
    WatchArea,
    WatchFeedbackSignal,
    WatchSuppressionList,
    YottalertAlert,
} from '~/utils/yottalert/types';

const ROOT = 'yottalert';

function redisKey(collection: string, id?: string): string {
    return id ? `${ROOT}:${collection}:${id}` : `${ROOT}:${collection}`;
}

function listKey(collection: string): string {
    return `${ROOT}:index:${collection}`;
}

async function withBackend<T>(
    redisFn: () => Promise<T>,
    localFn: () => T | Promise<T>
): Promise<T> {
    if (isKVConfigured()) {
        try {
            return await redisFn();
        } catch (err) {
            console.warn('[yottalertStore] Redis op failed, falling back to local FS', err);
        }
    }
    return Promise.resolve(localFn());
}

function localPath(collection: string, id?: string): string {
    return id ? `${ROOT}/${collection}/${id}` : `${ROOT}/${collection}`;
}

function readLocalDoc<T>(collection: string, id: string): T | null {
    const doc = localFsReadDoc(localPath(collection, id));
    if (!doc) return null;
    const value = doc.value;
    if (value === undefined || value === null) return null;
    return value as T;
}

function writeLocalDoc<T>(collection: string, id: string, value: T): void {
    localFsWriteField(
        localPath(collection, id),
        'value',
        value as unknown as Record<string, unknown>
    );
}

function deleteLocalDoc(collection: string, id: string): void {
    localFsDeleteDoc(localPath(collection, id));
}

function listLocalDocs<T>(collection: string): T[] {
    const ids = localFsListDocuments(localPath(collection));
    return ids.map((id) => readLocalDoc<T>(collection, id)).filter((v): v is T => v !== null);
}

// ---------------- Generic CRUD ----------------

async function setDoc<T>(collection: string, id: string, value: T): Promise<void> {
    await withBackend(
        async () => {
            const redis = getRedis();
            if (!redis) throw new Error('redis-missing');
            await redis.set(redisKey(collection, id), JSON.stringify(value));
            await redis.sadd(listKey(collection), id);
        },
        () => writeLocalDoc(collection, id, value)
    );
}

async function getDoc<T>(collection: string, id: string): Promise<T | null> {
    return withBackend<T | null>(
        async () => {
            const redis = getRedis();
            if (!redis) throw new Error('redis-missing');
            const raw = await redis.get(redisKey(collection, id));
            if (!raw) return null;
            if (typeof raw === 'string') return JSON.parse(raw) as T;
            return raw as T;
        },
        () => readLocalDoc<T>(collection, id)
    );
}

async function deleteDoc(collection: string, id: string): Promise<void> {
    await withBackend(
        async () => {
            const redis = getRedis();
            if (!redis) throw new Error('redis-missing');
            await redis.del(redisKey(collection, id));
            await redis.srem(listKey(collection), id);
        },
        () => deleteLocalDoc(collection, id)
    );
}

async function listDocs<T>(collection: string): Promise<T[]> {
    return withBackend<T[]>(
        async () => {
            const redis = getRedis();
            if (!redis) throw new Error('redis-missing');
            const ids = (await redis.smembers(listKey(collection))) as string[];
            if (!ids.length) return [];
            const values = await Promise.all(
                ids.map(async (id) => {
                    const raw = await redis.get(redisKey(collection, id));
                    if (!raw) return null;
                    if (typeof raw === 'string') return JSON.parse(raw) as T;
                    return raw as T;
                })
            );
            return values.filter((v): v is T => v !== null);
        },
        () => listLocalDocs<T>(collection)
    );
}

// ---------------- Domain helpers ----------------

export const yottalertStore = {
    isPersistent(): boolean {
        return isKVConfigured();
    },

    backend(): 'redis' | 'localfs' {
        return isKVConfigured() ? 'redis' : 'localfs';
    },

    async saveWatchArea(area: WatchArea): Promise<void> {
        await setDoc('watch_areas', area.id, area);
    },
    async getWatchArea(userId: string): Promise<WatchArea | null> {
        const areas = await this.listWatchAreas(userId);
        if (areas.length) return areas[0];

        // Backward compatibility for older local/Redis data keyed by user id.
        return getDoc<WatchArea>('watch_areas', userId);
    },
    async listWatchAreas(userId?: string): Promise<WatchArea[]> {
        const areas = await listDocs<WatchArea>('watch_areas');
        return areas
            .filter((area) => (userId ? area.userId === userId : true))
            .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
    },
    async getWatchAreaById(id: string): Promise<WatchArea | null> {
        return getDoc<WatchArea>('watch_areas', id);
    },
    async deleteWatchArea(id: string): Promise<void> {
        await deleteDoc('watch_areas', id);
    },

    async saveAlert(alert: YottalertAlert): Promise<void> {
        await setDoc('alerts', alert.id, alert);
    },
    async getAlert(id: string): Promise<YottalertAlert | null> {
        return getDoc<YottalertAlert>('alerts', id);
    },
    async listAlerts(): Promise<YottalertAlert[]> {
        return listDocs<YottalertAlert>('alerts');
    },
    async deleteAlert(id: string): Promise<void> {
        await deleteDoc('alerts', id);
    },

    async appendFeedback(feedback: AlertFeedback): Promise<void> {
        await setDoc(`feedback:${feedback.alertId}`, feedback.id, feedback);
    },
    async listFeedback(alertId: string): Promise<AlertFeedback[]> {
        return listDocs<AlertFeedback>(`feedback:${alertId}`);
    },
    async listFeedbackForWatchArea(watchAreaId: string): Promise<AlertFeedback[]> {
        const alerts = await listDocs<YottalertAlert>('alerts');
        const alertIds = alerts.filter((a) => a.watchAreaId === watchAreaId).map((a) => a.id);
        if (!alertIds.length) return [];
        const batches = await Promise.all(
            alertIds.map((id) => listDocs<AlertFeedback>(`feedback:${id}`))
        );
        return batches.flat();
    },
    async getWatchFeedbackSignal(watchAreaId: string): Promise<WatchFeedbackSignal | null> {
        return getDoc<WatchFeedbackSignal>('watch_feedback_signals', watchAreaId);
    },
    async saveWatchFeedbackSignal(signal: WatchFeedbackSignal): Promise<void> {
        await setDoc('watch_feedback_signals', signal.watchAreaId, signal);
    },
    async getWatchSuppressionList(watchAreaId: string): Promise<WatchSuppressionList | null> {
        return getDoc<WatchSuppressionList>('watch_suppressions', watchAreaId);
    },
    async saveWatchSuppressionList(list: WatchSuppressionList): Promise<void> {
        await setDoc('watch_suppressions', list.watchAreaId, list);
    },

    async saveSyncRun(run: SyncRun): Promise<void> {
        await setDoc('sync_runs', run.id, run);
    },
    async listSyncRuns(): Promise<SyncRun[]> {
        return listDocs<SyncRun>('sync_runs');
    },
};

export type YottalertStore = typeof yottalertStore;
