import type {
    AlertFeedback,
    AlertFeedbackType,
    WatchFeedbackSignal,
    WatchSuppressionList,
    YottalertAlert,
} from './types';

const MAX_LIST_ENTRIES = 200;

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

function emptyCounts(): Record<AlertFeedbackType, number> {
    return {
        useful: 0,
        not_relevant: 0,
        duplicate: 0,
        wrong_location: 0,
        wrong_entity: 0,
        too_noisy: 0,
        too_late: 0,
        increase_sensitivity: 0,
        decrease_sensitivity: 0,
        add_similar: 0,
        suppress_similar: 0,
    };
}

function slugify(s?: string): string | null {
    if (!s) return null;
    const out = s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return out || null;
}

function capWithRecency(values: string[]): string[] {
    return [...new Set(values)].slice(-MAX_LIST_ENTRIES);
}

export function computeRuleFeedbackSignal(
    feedbackList: AlertFeedback[]
): Omit<WatchFeedbackSignal, 'watchAreaId' | 'updatedAt'> {
    const counts = emptyCounts();
    for (const item of feedbackList) {
        counts[item.feedbackType] = (counts[item.feedbackType] ?? 0) + 1;
    }
    const total = feedbackList.length;
    if (!total) {
        return {
            totalFeedback: 0,
            counts,
            utilityScore: 0,
            noiseScore: 0,
            sensitivityDelta: 0,
        };
    }

    const utility = counts.useful + counts.add_similar;
    const noise =
        counts.not_relevant +
        counts.duplicate +
        counts.too_noisy +
        counts.too_late +
        counts.suppress_similar;
    const inc = counts.increase_sensitivity;
    const dec = counts.decrease_sensitivity;

    const sensitivityDelta = clamp((inc - dec) / total, -0.2, 0.2);
    return {
        totalFeedback: total,
        counts,
        utilityScore: Number((utility / total).toFixed(3)),
        noiseScore: Number((noise / total).toFixed(3)),
        sensitivityDelta: Number(sensitivityDelta.toFixed(3)),
    };
}

export function applyFeedbackToSuppressionList(
    list: WatchSuppressionList | null | undefined,
    alert: YottalertAlert,
    feedback: AlertFeedback
): WatchSuppressionList {
    const next: WatchSuppressionList = list ?? {
        watchAreaId: alert.watchAreaId,
        suppressedEntityIds: [],
        suppressedGeographySlugs: [],
        boostedEntityIds: [],
        boostedGeographySlugs: [],
        updatedAt: new Date().toISOString(),
    };

    const geoSlug = slugify(alert.geographyLabel);
    const entities = alert.elementalEntityIds;
    const addSuppressedEntities =
        feedback.feedbackType === 'suppress_similar' || feedback.feedbackType === 'wrong_entity';
    const addSuppressedGeo =
        feedback.feedbackType === 'suppress_similar' || feedback.feedbackType === 'wrong_location';
    const addBoosted = feedback.feedbackType === 'add_similar';

    if (addSuppressedEntities && entities.length) {
        next.suppressedEntityIds = capWithRecency([...next.suppressedEntityIds, ...entities]);
    }
    if (addSuppressedGeo && geoSlug) {
        next.suppressedGeographySlugs = capWithRecency([...next.suppressedGeographySlugs, geoSlug]);
    }
    if (addBoosted && entities.length) {
        next.boostedEntityIds = capWithRecency([...next.boostedEntityIds, ...entities]);
    }
    if (addBoosted && geoSlug) {
        next.boostedGeographySlugs = capWithRecency([...next.boostedGeographySlugs, geoSlug]);
    }

    next.updatedAt = new Date().toISOString();
    return next;
}
