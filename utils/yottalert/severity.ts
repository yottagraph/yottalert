import type { Severity } from './types';

export interface SeverityTone {
    label: string;
    token: string;
    cssVar: string;
}

const TONES: Record<Severity, SeverityTone> = {
    high: { label: 'High', token: 'severity-high', cssVar: '--dynamic-severity-high' },
    medium: { label: 'Medium', token: 'severity-medium', cssVar: '--dynamic-severity-medium' },
    low: { label: 'Low', token: 'severity-low', cssVar: '--dynamic-severity-low' },
    suppressed: {
        label: 'Suppressed',
        token: 'severity-suppressed',
        cssVar: '--dynamic-severity-suppressed',
    },
};

export function severityTone(severity: Severity): SeverityTone {
    return TONES[severity] ?? TONES.low;
}

export function severityForScore(score: number): Severity {
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    if (score >= 40) return 'low';
    return 'suppressed';
}

export function relativeTime(iso: string | undefined): string {
    if (!iso) return '—';
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return iso;
    const diff = Date.now() - then;
    if (diff < 0) return 'just now';
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}d ago`;
    const mo = Math.floor(day / 30);
    if (mo < 12) return `${mo}mo ago`;
    return `${Math.floor(mo / 12)}y ago`;
}
