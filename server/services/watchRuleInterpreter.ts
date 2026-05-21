/**
 * Watch-rule interpreter — PRD §5.5.
 *
 * Turns a natural-language prompt into a structured `StructuredRule`.
 * This is the deterministic Nitro fallback that the brief mandates
 * ("Fall back to a deterministic Nitro endpoint when the ADK agent is
 * unavailable"). Replace `interpretViaAgent()` later with the ADK call.
 *
 * The heuristic is intentionally explainable: keyword buckets per
 * domain (real estate / financial / regulatory / civic / corporate),
 * geography extraction via "in {...}", entity extraction via Elemental
 * `searchEntities` for any capitalized phrase, and sensible defaults
 * for the time window and minimum confidence.
 */

import type {
    GeographyConstraint,
    Sensitivity,
    StructuredRule,
    WatchTargetType,
} from '~/utils/yottalert/types';
import { elementalApiClient } from './elementalApiClient';

interface KeywordBucket {
    eventCategories: string[];
    entityTypes: string[];
    relationshipTypes: string[];
}

const KEYWORD_BUCKETS: Record<string, KeywordBucket> = {
    real_estate: {
        eventCategories: [
            'commercial_permit',
            'zoning_hearing',
            'vacancy_signal',
            'foreclosure',
            'tax_lien',
            'business_closure',
        ],
        entityTypes: ['property', 'business', 'developer', 'government_body'],
        relationshipTypes: ['located_in', 'owns', 'leases', 'filed', 'subject_of'],
    },
    finance: {
        eventCategories: ['filing', 'earnings', 'rating_change', 'lawsuit', 'm_and_a'],
        entityTypes: ['company', 'financial_institution', 'regulator'],
        relationshipTypes: ['files_with', 'subject_of', 'subsidiary_of', 'covers'],
    },
    regulatory: {
        eventCategories: ['hearing', 'rule_change', 'enforcement_action', 'permit'],
        entityTypes: ['government_body', 'regulator', 'company'],
        relationshipTypes: ['regulated_by', 'filed', 'subject_of'],
    },
    civic: {
        eventCategories: [
            'public_meeting',
            'public_safety',
            'infrastructure_disruption',
            'local_news',
        ],
        entityTypes: ['government_body', 'community_org', 'property'],
        relationshipTypes: ['located_in', 'serves', 'covers'],
    },
    corporate: {
        eventCategories: ['business_closure', 'layoff', 'expansion', 'hiring', 'product_launch'],
        entityTypes: ['company', 'business'],
        relationshipTypes: ['employs', 'subsidiary_of', 'partners_with', 'subject_of'],
    },
};

const KEYWORD_TO_BUCKET: Array<[RegExp, keyof typeof KEYWORD_BUCKETS]> = [
    [/(real estate|commercial real estate|cre|property|properties|zoning)/i, 'real_estate'],
    [/(bank|financial|earnings|filing|lawsuit|sec |rating|m&a|merger)/i, 'finance'],
    [/(permit|regulator|hearing|enforcement|compliance|rule)/i, 'regulatory'],
    [/(public meeting|infrastructure|safety|community|local news)/i, 'civic'],
    [/(business|company|layoff|hiring|expansion|closure)/i, 'corporate'],
];

function pickBuckets(prompt: string): KeywordBucket {
    const matched: KeywordBucket[] = [];
    for (const [re, name] of KEYWORD_TO_BUCKET) {
        if (re.test(prompt)) matched.push(KEYWORD_BUCKETS[name]);
    }
    if (!matched.length) matched.push(KEYWORD_BUCKETS.civic);
    return mergeBuckets(matched);
}

function mergeBuckets(buckets: KeywordBucket[]): KeywordBucket {
    const out: KeywordBucket = {
        eventCategories: [],
        entityTypes: [],
        relationshipTypes: [],
    };
    for (const b of buckets) {
        for (const k of b.eventCategories)
            if (!out.eventCategories.includes(k)) out.eventCategories.push(k);
        for (const k of b.entityTypes) if (!out.entityTypes.includes(k)) out.entityTypes.push(k);
        for (const k of b.relationshipTypes)
            if (!out.relationshipTypes.includes(k)) out.relationshipTypes.push(k);
    }
    return out;
}

function detectTimeWindow(prompt: string): string {
    if (/this week|past week|last 7 days|7-day/i.test(prompt)) return 'last_7_days';
    if (/this month|past month|30 days|30-day/i.test(prompt)) return 'last_30_days';
    if (/quarter|90 days|90-day/i.test(prompt)) return 'last_90_days';
    if (/today|24 hours/i.test(prompt)) return 'last_24_hours';
    return 'last_30_days';
}

function detectSensitivity(prompt: string): Sensitivity {
    if (/aggressive|every|all|noisy|broad|exhaustive/i.test(prompt)) return 'high';
    if (/quiet|only critical|sparing|narrow|conservative/i.test(prompt)) return 'low';
    return 'standard';
}

function detectMinimumConfidence(prompt: string): number {
    if (/high(ly)? confident|verified|certified|critical/i.test(prompt)) return 0.85;
    if (/exploratory|broad|noisy/i.test(prompt)) return 0.55;
    return 0.7;
}

function extractGeography(prompt: string): GeographyConstraint | undefined {
    const inMatch = prompt.match(/\bin\s+([A-Z][\w\s,'-]{2,80})/);
    const aroundMatch = prompt.match(/\b(?:around|near|across)\s+([A-Z][\w\s,'-]{2,80})/);
    const phrase = inMatch?.[1] ?? aroundMatch?.[1];
    if (!phrase) return undefined;
    const cleaned = phrase
        .replace(/\b(for|related|connected|that|which|with|when|and|or|to)\b.*$/i, '')
        .trim();
    if (!cleaned) return undefined;
    const lower = cleaned.toLowerCase();
    let type = 'place';
    if (/county/.test(lower)) type = 'county';
    else if (/(downtown|neighborhood|district)/.test(lower)) type = 'neighborhood';
    else if (/(city|town|borough)/.test(lower)) type = 'city';
    else if (/state|province/.test(lower)) type = 'state';
    return { name: cleaned, type, slug: slugify(cleaned) };
}

function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function detectWatchTargetType(prompt: string, geography?: GeographyConstraint): WatchTargetType {
    if (/portfolio|set of (companies|properties|locations|sites)|monitor these/i.test(prompt))
        return 'portfolio';
    if (/when .* becomes connected|connection|relationship/i.test(prompt)) return 'relationship';
    if (/when .* (appears|files|reports|releases|posts)/i.test(prompt)) return 'entity';
    if (/category|event type|class of event/i.test(prompt)) return 'event_type';
    if (geography) return 'geography';
    return 'natural_language';
}

function pickWatchTargetValue(
    prompt: string,
    geography: GeographyConstraint | undefined,
    target: WatchTargetType
): string {
    if (target === 'geography' && geography) return geography.name;
    const firstQuoted = prompt.match(/"([^"]{2,80})"/)?.[1];
    if (firstQuoted) return firstQuoted;
    const titleCase = prompt.match(/\b([A-Z][\w&.'-]+(?:\s+[A-Z][\w&.'-]+){0,4})\b/)?.[1];
    return titleCase ?? prompt.slice(0, 60);
}

function extractExclusions(prompt: string): string[] {
    const out: string[] = [];
    const re = /\b(?:except|exclude|not|excluding|ignore)\b([^.,;]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(prompt)) !== null) {
        const segment = m[1].trim();
        if (segment) out.push(segment);
    }
    return out;
}

export async function interpretWatchRule(prompt: string): Promise<StructuredRule> {
    const trimmed = prompt.trim();
    const geography = extractGeography(trimmed);
    const buckets = pickBuckets(trimmed);
    const sensitivity = detectSensitivity(trimmed);
    const minimumConfidence = detectMinimumConfidence(trimmed);
    const timeWindow = detectTimeWindow(trimmed);
    const watchTargetType = detectWatchTargetType(trimmed, geography);
    const watchTargetValue = pickWatchTargetValue(trimmed, geography, watchTargetType);
    const exclusions = extractExclusions(trimmed);

    let entityRefs: StructuredRule['entityRefs'] = [];
    if (elementalApiClient.isConfigured() && watchTargetType === 'entity') {
        const hits = await elementalApiClient.searchEntitiesByName(watchTargetValue, {
            maxResults: 3,
        });
        entityRefs = hits.map((h) => ({ neid: h.neid, name: h.name }));
    }

    return {
        watchTargetType,
        watchTargetValue,
        geography,
        entityRefs,
        eventCategories: buckets.eventCategories,
        entityTypes: buckets.entityTypes,
        relationshipTypes: buckets.relationshipTypes,
        geographyConstraints: geography ? [geography] : [],
        timeWindow,
        sensitivity,
        minimumConfidence,
        exclusions,
    };
}

export const watchRuleInterpreter = { interpretWatchRule };
export type WatchRuleInterpreter = typeof watchRuleInterpreter;
