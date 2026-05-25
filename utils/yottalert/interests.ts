import type { InterestKey } from './types';

export const INTEREST_LABELS: Record<InterestKey, string> = {
    real_estate: 'Real estate',
    public_safety: 'Public safety',
    business: 'Business',
    government: 'Government',
    jobs: 'Jobs',
    civic: 'Civic news',
    culture: 'Culture & events',
};

export const INTEREST_TO_EVENT_CATEGORIES: Record<InterestKey, string[]> = {
    real_estate: ['commercial_permit', 'zoning_hearing', 'foreclosure', 'vacancy_signal'],
    public_safety: ['major_crime', 'major_natural_disaster', 'infrastructure_disruption'],
    business: [
        'business_closure',
        'layoffs',
        'expansion',
        'product_launch',
        'corporate_restructuring',
    ],
    government: [
        'public_meeting',
        'rule_change',
        'change_in_government_policy',
        'enforcement_action',
    ],
    jobs: ['hiring', 'layoffs', 'personnel_changes'],
    civic: ['local_news', 'political_commentary', 'lawsuit'],
    culture: ['entertainment', 'sports', 'industry_award', 'conference', 'festival', 'concert'],
};

export function categoriesForInterests(interests: InterestKey[]): string[] {
    return [
        ...new Set(interests.flatMap((interest) => INTEREST_TO_EVENT_CATEGORIES[interest] ?? [])),
    ];
}
