/**
 * Composes the human-readable narrative for an alert (PRD §5.8): title,
 * summary, whyItMatters, whatChanged, suggestedNextStep. Deterministic
 * by design so the dev box never depends on an LLM key.
 */

import type {
    AlertRule,
    AlertEntityRef,
    AlertEventRef,
    AlertRelationshipRef,
    Severity,
} from '~/utils/yottalert/types';

interface ExplainInputs {
    rule: AlertRule;
    severity: Severity;
    score: number;
    confidence: number;
    geographyLabel?: string;
    entities: AlertEntityRef[];
    events: AlertEventRef[];
    relationships: AlertRelationshipRef[];
    elementalEntityCount: number;
    sourceCount: number;
}

export interface Explanation {
    title: string;
    summary: string;
    whyItMatters: string;
    whatChanged: string;
    suggestedNextStep: string;
}

function joinNames(items: { name: string }[], max = 3): string {
    if (!items.length) return '';
    const names = items.slice(0, max).map((i) => i.name);
    if (items.length > max) names.push(`+${items.length - max}`);
    return names.join(', ');
}

export function composeExplanation(inputs: ExplainInputs): Explanation {
    const {
        rule,
        severity,
        confidence,
        geographyLabel,
        entities,
        events,
        relationships,
        sourceCount,
    } = inputs;

    const focus = rule.structuredRule.watchTargetValue || rule.name;
    const eventLabel = events.length === 1 ? '1 new event' : `${events.length} new events`;
    const entityLabel =
        entities.length === 1 ? '1 watched entity' : `${entities.length} watched entities`;
    const relLabel = relationships.length
        ? `${relationships.length} relationship update${relationships.length === 1 ? '' : 's'}`
        : '';

    const where = geographyLabel ? ` in ${geographyLabel}` : '';
    const title = events[0]?.title
        ? `${events[0].title}${where}`
        : `New ${severity}-severity change for ${focus}`;

    const summaryBits = [eventLabel];
    if (entities.length) summaryBits.push(entityLabel);
    if (relLabel) summaryBits.push(relLabel);
    summaryBits.push(`${sourceCount || 0} source${sourceCount === 1 ? '' : 's'} attached`);

    const summary = `Elemental detected ${summaryBits.join(' · ')}${where} matching watch rule "${rule.name}". Confidence ${Math.round(confidence * 100)}%.`;

    const why = describeWhy(rule, severity, geographyLabel, entities);

    const what = events.length
        ? `Newest event: ${events[0].title}${events[0].occurredAt ? ` (${events[0].occurredAt})` : ''}. ${entities.length ? `Linked to ${joinNames(entities)}.` : ''}`
        : entities.length
          ? `${joinNames(entities)} appeared in the watched ${geographyLabel ?? 'context'} since the last sync.`
          : `Relationship change detected in the watched ${geographyLabel ?? 'context'} since the last sync.`;

    const next = suggestNext(rule, severity, entities);

    return {
        title,
        summary,
        whyItMatters: why,
        whatChanged: what,
        suggestedNextStep: next,
    };
}

function describeWhy(
    rule: AlertRule,
    severity: Severity,
    geo: string | undefined,
    entities: AlertEntityRef[]
): string {
    if (severity === 'high') {
        return `Above the rule's sensitivity threshold (${rule.sensitivity}). ${
            geo ? `Direct exposure to ${geo}.` : 'Entity exposure detected.'
        } Confirm before next briefing.`;
    }
    if (severity === 'medium') {
        return `Moderate match on ${geo ? `${geo}` : 'watched entities'}${entities.length ? ` (incl. ${entities[0].name})` : ''}. Review when convenient.`;
    }
    if (severity === 'low') {
        return `Weak signal — flagged because the rule is set to ${rule.sensitivity} sensitivity. Suppress similar items if noisy.`;
    }
    return 'Below the suppression threshold; recorded for audit only.';
}

function suggestNext(rule: AlertRule, severity: Severity, entities: AlertEntityRef[]): string {
    if (severity === 'high') {
        return entities.length
            ? `Open the Entity Context Drawer for ${entities[0].name} and confirm provenance before escalating.`
            : 'Open the alert detail and verify sources before escalating.';
    }
    if (severity === 'medium') {
        return 'Inspect the linked evidence and confirm whether this needs a follow-up.';
    }
    if (severity === 'low') {
        return `If this is noisy, tighten the minimum confidence (${rule.minimumConfidence.toFixed(2)}) or add an exclusion.`;
    }
    return 'No action required — alert is suppressed.';
}

export const alertExplanationService = { composeExplanation };
export type AlertExplanationService = typeof alertExplanationService;
