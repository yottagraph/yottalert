/**
 * Shared types for Yottalert. The shapes mirror §5.4 and §5.8 of the
 * Yottalert PRD in `DESIGN.md`. Keep this module dependency-free so it
 * can be imported from both client and server.
 */

export type InterestKey =
    | 'real_estate'
    | 'public_safety'
    | 'business'
    | 'government'
    | 'jobs'
    | 'civic';

export type GeographyType = 'zip' | 'county';

export type Severity = 'high' | 'medium' | 'low' | 'suppressed';

export type AlertStatus = 'new' | 'read' | 'archived' | 'suppressed';

export type ProvenanceStatus = 'complete' | 'partial' | 'unavailable';

export interface WatchArea {
    id: string;
    userId: string;
    geographyType: GeographyType;
    geographyCode: string;
    geographyLabel: string;
    geographyNeid?: string;
    interests: InterestKey[];
    minimumConfidence: number;
    lastCheckedAt?: string;
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
    source: 'elemental' | 'synthetic';
    status?: 'observed' | 'predicted' | 'historical';
    publication?: { name: string; url?: string };
    url?: string;
    sentiment?: number;
    sentimentReasoning?: string;
    tone?: 'opinionated' | 'matter-of-fact';
    titleFactuality?: 'sensational' | 'factual';
    actors?: Array<{ neid: string; name: string; sentiment?: number }>;
    rawValues?: Record<string, string | number | null>;
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
    watchAreaId: string;
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
    retrievalSource?: 'galaxy' | 'find';
    provenanceStatus: ProvenanceStatus;
    feedbackAdjustment?: number;
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

export interface WatchFeedbackSignal {
    watchAreaId: string;
    totalFeedback: number;
    counts: Record<AlertFeedbackType, number>;
    utilityScore: number;
    noiseScore: number;
    sensitivityDelta: number;
    updatedAt: string;
}

export interface WatchSuppressionList {
    watchAreaId: string;
    suppressedEntityIds: string[];
    suppressedGeographySlugs: string[];
    boostedEntityIds: string[];
    boostedGeographySlugs: string[];
    updatedAt: string;
}

export interface ProvenanceRecord {
    objectId: string;
    objectType: 'entity' | 'event' | 'relationship' | 'source' | 'unknown';
    sourceDocument?: {
        name: string;
        url?: string;
        type: string;
    };
    ingestedAt?: string;
    publishedAt?: string;
    extractedClaim?: string;
    entityResolutionConfidence?: number;
    relationshipConfidence?: number;
    eventExtractionConfidence?: number;
    geographyResolutionConfidence?: number;
    elementalObjectIds: string[];
    relatedAlerts: Array<{ alertId: string; alertTitle: string; createdAt: string }>;
    status: ProvenanceStatus;
}

export interface SyncRun {
    id: string;
    organizationId: string;
    watchAreaId: string;
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
    galaxyReachable?: boolean;
    lastCheckedAt: string;
    latencyMs?: number;
    galaxyLatencyMs?: number;
    galaxyEntityCount?: number;
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

export interface GeographySearchResult {
    neid?: string;
    name: string;
    geographyType: GeographyType;
    code: string;
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
