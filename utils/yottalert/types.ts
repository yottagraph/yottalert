/**
 * Shared types for Yottalert. The shapes mirror §5.4 and §5.8 of the
 * Yottalert PRD in `DESIGN.md`. Keep this module dependency-free so it
 * can be imported from both client and server.
 */

export type WatchTargetType =
    | 'geography'
    | 'entity'
    | 'relationship'
    | 'event_type'
    | 'portfolio'
    | 'natural_language';

export type DeliveryFrequency =
    | 'as_it_happens'
    | 'daily_digest'
    | 'weekly_digest'
    | 'dashboard_only';

export type Sensitivity = 'low' | 'standard' | 'high';

export type Severity = 'high' | 'medium' | 'low' | 'suppressed';

export type AlertStatus = 'new' | 'read' | 'archived' | 'suppressed';

export type ProvenanceStatus = 'complete' | 'partial' | 'unavailable';

export interface GeographyConstraint {
    name: string;
    type?: string;
    slug?: string;
}

export interface StructuredRule {
    watchTargetType: WatchTargetType;
    watchTargetValue: string;
    geography?: GeographyConstraint;
    entityRefs?: Array<{ neid?: string; name: string }>;
    eventCategories: string[];
    entityTypes: string[];
    relationshipTypes: string[];
    geographyConstraints?: GeographyConstraint[];
    timeWindow: string;
    sensitivity: Sensitivity;
    minimumConfidence: number;
    exclusions: string[];
}

export interface AlertRule {
    id: string;
    organizationId: string;
    userId: string;
    name: string;
    naturalLanguagePrompt: string;
    structuredRule: StructuredRule;
    watchTargetType: WatchTargetType;
    frequency: DeliveryFrequency;
    minimumConfidence: number;
    sensitivity: Sensitivity;
    deliveryDestination: string;
    enabled: boolean;
    lastCheckedAt?: string;
    lastElementalCursor?: string;
    lastSeenEntityIds: string[];
    lastSeenRelationshipIds: string[];
    lastSeenEventIds: string[];
    lastAlertedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ScoreBreakdown {
    relevance: number;
    novelty: number;
    localSignificance: number;
    entityImportance: number;
    confidence: number;
    urgency: number;
}

export interface AlertEvidenceRef {
    id: string;
    elementalSourceId?: string;
    elementalObjectId?: string;
    evidenceType: 'regulatory' | 'press' | 'census' | 'elemental' | 'synthetic';
    displayText: string;
    sourceName: string;
    sourceUrl?: string;
    publishedAt?: string;
    ingestedAt?: string;
    confidence: number;
}

export interface AlertEntityRef {
    neid: string;
    name: string;
    type?: string;
}

export interface AlertEventRef {
    id: string;
    title: string;
    type: string;
    geography?: string;
    occurredAt?: string;
    confidence: number;
}

export interface AlertRelationshipRef {
    id: string;
    subject: string;
    predicate: string;
    object: string;
    confidence: number;
}

export interface YottalertAlert {
    id: string;
    alertRuleId: string;
    title: string;
    summary: string;
    whyItMatters: string;
    whatChanged: string;
    suggestedNextStep: string;
    geographyLabel?: string;
    severity: Severity;
    score: number;
    scoreBreakdown: ScoreBreakdown;
    confidence: number;
    createdAt: string;
    sourceCount: number;
    provenanceStatus: ProvenanceStatus;
    status: AlertStatus;
    elementalEntityIds: string[];
    elementalEventIds: string[];
    elementalRelationshipIds: string[];
    elementalObjectIds: string[];
    entities: AlertEntityRef[];
    events: AlertEventRef[];
    relationships: AlertRelationshipRef[];
    evidence: AlertEvidenceRef[];
}

export type AlertFeedbackType =
    | 'useful'
    | 'not_relevant'
    | 'duplicate'
    | 'wrong_location'
    | 'wrong_entity'
    | 'too_noisy'
    | 'too_late'
    | 'increase_sensitivity'
    | 'decrease_sensitivity'
    | 'add_similar'
    | 'suppress_similar';

export interface AlertFeedback {
    id: string;
    alertId: string;
    userId: string;
    feedbackType: AlertFeedbackType;
    comment?: string;
    createdAt: string;
}

export interface SyncRun {
    id: string;
    organizationId: string;
    alertRuleId: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    startedAt: string;
    completedAt?: string;
    objectsChecked: number;
    candidateAlertsCreated: number;
    errors: string[];
}

export interface ElementalConnectionStatus {
    apiReachable: boolean;
    mcpReachable: boolean;
    lastCheckedAt: string;
    latencyMs?: number;
    mcpToolCount?: number;
    apiVersion?: string;
    lastError?: string;
}

export interface AgentStepDescriptor {
    id: string;
    name: string;
    icon: string;
    color: string;
    workingText: string;
    completedText: string;
}

export const YOTTALERT_AGENT_STEPS: AgentStepDescriptor[] = [
    {
        id: 'dialogue',
        name: 'Dialogue Agent',
        icon: 'mdi-head-question',
        color: 'deep-purple',
        workingText: 'Interpreting watch goal',
        completedText: 'Intent understood',
    },
    {
        id: 'watch_resolution',
        name: 'Watch Resolution Agent',
        icon: 'mdi-target',
        color: 'blue',
        workingText: 'Resolving target via Elemental',
        completedText: 'Target resolved',
    },
    {
        id: 'graph_retrieval',
        name: 'Graph Retrieval Agent',
        icon: 'mdi-graph',
        color: 'teal',
        workingText: 'Querying Elemental graph',
        completedText: 'Context assembled',
    },
    {
        id: 'change_detection',
        name: 'Change Detection Agent',
        icon: 'mdi-delta',
        color: 'cyan',
        workingText: 'Diffing against last cursor',
        completedText: 'Changes computed',
    },
    {
        id: 'scoring',
        name: 'Scoring Agent',
        icon: 'mdi-meter',
        color: 'amber-darken-2',
        workingText: 'Scoring candidates',
        completedText: 'Candidates ranked',
    },
    {
        id: 'composition',
        name: 'Composition Agent',
        icon: 'mdi-file-document-edit-outline',
        color: 'green',
        workingText: 'Composing alert explanation',
        completedText: 'Alert ready',
    },
];
