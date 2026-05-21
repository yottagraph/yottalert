/**
 * Daily / weekly digest (PRD §9.7). The Gemini pipeline is the P2
 * target; the MVP ships the deterministic data context loader + a
 * plain-text composition fallback so the page always renders, and
 * the composition-source chip can correctly show 'deterministic'.
 *
 * When `GEMINI_API_KEY` is set later, swap the composer here.
 */

import type { Severity, YottalertAlert } from '~/utils/yottalert/types';
import { yottalertStore } from './yottalertStore';

export type DigestFrequency = 'daily' | 'weekly';

export interface DigestCitation {
    n: number;
    label: string;
    url?: string;
}

export interface DigestUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    model: string;
    latencyMs: number;
}

export interface DigestPayload {
    frequency: DigestFrequency;
    generatedAt: string;
    windowStart: string;
    alertCount: number;
    ruleCount: number;
    severityCounts: Record<Severity, number>;
    citations: DigestCitation[];
    markdown: string;
    cached: boolean;
    cacheAgeSec: number;
    compositionSource: 'gemini' | 'deterministic';
    usage: DigestUsage;
    highSeverityAlerts: Array<{
        id: string;
        title: string;
        score: number;
        whyItMatters: string;
    }>;
}

interface DigestCacheEntry {
    payload: DigestPayload;
    createdAt: number;
}

const CACHE: Map<string, DigestCacheEntry> = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

function cacheKey(userId: string, frequency: DigestFrequency): string {
    return `${userId}:${frequency}`;
}

function readCache(key: string): DigestCacheEntry | null {
    const entry = CACHE.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
        CACHE.delete(key);
        return null;
    }
    return entry;
}

function windowStart(frequency: DigestFrequency): Date {
    const ms = frequency === 'daily' ? 24 * 3600 * 1000 : 7 * 24 * 3600 * 1000;
    return new Date(Date.now() - ms);
}

function bySeverity(alerts: YottalertAlert[]): Record<Severity, number> {
    const out: Record<Severity, number> = { high: 0, medium: 0, low: 0, suppressed: 0 };
    for (const a of alerts) out[a.severity]++;
    return out;
}

function deterministicMarkdown(
    alerts: YottalertAlert[],
    frequency: DigestFrequency,
    citations: DigestCitation[]
): string {
    const high = alerts.filter((a) => a.severity === 'high');
    const medium = alerts.filter((a) => a.severity === 'medium');

    const whatChanged = [...high, ...medium].slice(0, 6).map((a, i) => {
        const cite = `_(Source: ${citations[i % Math.max(citations.length, 1)]?.label ?? 'Elemental Query Server'} [${(i % Math.max(citations.length, 1)) + 1}])_`;
        return `- ${a.title} — ${a.whyItMatters} ${cite}`;
    });

    const watch = alerts.slice(0, 3).map((a, i) => {
        const cite = `_(Source: ${citations[i % Math.max(citations.length, 1)]?.label ?? 'Elemental Query Server'} [${(i % Math.max(citations.length, 1)) + 1}])_`;
        return `- ${a.suggestedNextStep} ${cite}`;
    });

    const highList = high
        .slice(0, 5)
        .map((a) => `1. **${a.title}** (score ${a.score}) — ${a.whyItMatters}`);

    const period = frequency === 'daily' ? 'today' : 'this week';
    const introBits = [
        `# What changed`,
        '',
        whatChanged.length ? whatChanged.join('\n') : `- No new alerts ${period}.`,
        '',
        `# What to watch`,
        '',
        watch.length ? watch.join('\n') : `- No follow-up items ${period}.`,
        '',
        `# High-severity alerts`,
        '',
        highList.length ? highList.join('\n') : '_None this period._',
    ];

    return introBits.join('\n');
}

function buildCitations(alerts: YottalertAlert[]): DigestCitation[] {
    const out: DigestCitation[] = [];
    const seen = new Set<string>();
    let n = 1;
    for (const a of alerts) {
        for (const e of a.evidence) {
            const label = e.sourceName || e.displayText.slice(0, 60);
            if (seen.has(label)) continue;
            seen.add(label);
            out.push({ n: n++, label, url: e.sourceUrl });
            if (n > 12) return out;
        }
    }
    return out;
}

export async function buildDailyDigest(options: {
    userId: string;
    frequency?: DigestFrequency;
    forceRegenerate?: boolean;
}): Promise<DigestPayload> {
    const frequency = options.frequency ?? 'daily';
    const key = cacheKey(options.userId, frequency);

    if (!options.forceRegenerate) {
        const cached = readCache(key);
        if (cached) {
            return {
                ...cached.payload,
                cached: true,
                cacheAgeSec: Math.floor((Date.now() - cached.createdAt) / 1000),
            };
        }
    }

    const t0 = Date.now();
    const start = windowStart(frequency);
    const alerts = (await yottalertStore.listAlerts()).filter(
        (a) => new Date(a.createdAt) >= start
    );
    const rules = await yottalertStore.listAlertRules();
    const citations = buildCitations(alerts);
    const markdown = deterministicMarkdown(alerts, frequency, citations);

    const payload: DigestPayload = {
        frequency,
        generatedAt: new Date().toISOString(),
        windowStart: start.toISOString(),
        alertCount: alerts.length,
        ruleCount: rules.length,
        severityCounts: bySeverity(alerts),
        citations,
        markdown,
        cached: false,
        cacheAgeSec: 0,
        compositionSource: 'deterministic',
        usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            costUsd: 0,
            model: 'deterministic-template',
            latencyMs: Date.now() - t0,
        },
        highSeverityAlerts: alerts
            .filter((a) => a.severity === 'high')
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map((a) => ({
                id: a.id,
                title: a.title,
                score: a.score,
                whyItMatters: a.whyItMatters,
            })),
    };

    CACHE.set(key, { payload, createdAt: Date.now() });
    return payload;
}

export const digestService = { buildDailyDigest };
export type DigestService = typeof digestService;
