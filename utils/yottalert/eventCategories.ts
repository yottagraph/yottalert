const CATEGORY_TO_TOPIC_LABEL: Record<string, string> = {
    // Existing structured-rule buckets
    m_and_a: 'Mergers & acquisitions',
    filing: 'Regulatory filing & compliance',
    earnings: 'Earnings call',
    rating_change: 'Analyst report',
    lawsuit: 'Significant legal judgement',
    hearing: 'Change in government policy',
    rule_change: 'Change in government policy',
    enforcement_action: 'Significant legal judgement',
    permit: 'Change in government policy',
    public_meeting: 'Political commentary',
    public_safety: 'Major crime',
    infrastructure_disruption: 'Major natural disaster',
    local_news: 'Market commentary',
    business_closure: 'Corporate restructuring',
    layoff: 'Layoffs',
    expansion: 'Launch of a new product',
    hiring: 'Personnel changes',
    product_launch: 'Launch of a new product',
    vacancy_signal: 'Market commentary',
    zoning_hearing: 'Change in government policy',
    commercial_permit: 'Change in government policy',
    foreclosure: 'Insolvency',
    tax_lien: 'Significant legal judgement',

    // Canonical schema categories (pass-through)
    bankruptcy: 'Bankruptcy',
    default: 'Default',
    seizure: 'Seizure',
    insolvency: 'Insolvency',
    expropriation: 'Expropriation',
    hostile_takeover: 'Hostile takeover',
    acts_of_war: 'Acts of war',
    terrorism: 'Terrorism',
    cybersecurity_breach: 'Cybersecurity breach',
    major_natural_disaster: 'Major natural disaster',
    ipo: 'IPO',
    spac: 'SPAC',
    win_of_long_term_high_value_contract: 'Win of long-term, high-value contract',
    technological_breakthrough: 'Technological breakthrough',
    epidemic_pandemic_disease: 'Epidemic/pandemic disease',
    insider_trading: 'Insider trading',
    dividend_announcement: 'Dividend announcement',
    corporate_restructuring: 'Corporate restructuring',
    layoffs: 'Layoffs',
    customer_loss: 'Customer loss',
    product_delays: 'Product delays',
    major_leadership_change: 'Major leadership change',
    credit_rating_downgrade: 'Credit rating downgrade',
    credit_rating_upgrade: 'Credit rating upgrade',
    strategic_partnership: 'Strategic partnership',
    new_funding_or_investment: 'New funding or investment',
    launch_of_a_new_product: 'Launch of a new product',
    major_crime: 'Major crime',
    earnings_call: 'Earnings call',
    change_in_government_policy: 'Change in government policy',
    market_commentary: 'Market commentary',
    political_commentary: 'Political commentary',
    analyst_report: 'Analyst report',
    interview: 'Interview',
    industry_award: 'Industry award',
    regulatory_filing_compliance: 'Regulatory filing & compliance',
    personnel_changes: 'Personnel changes',
    sports: 'Sports',
    entertainment: 'Entertainment',
};

function humanize(slug: string): string {
    return slug.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function canonicalTopicLabelForCategory(category: string): string {
    const normalized = category.trim().toLowerCase().replace(/\s+/g, '_');
    return CATEGORY_TO_TOPIC_LABEL[normalized] ?? humanize(normalized);
}

export function canonicalTopicLabelsForCategories(categories: string[]): string[] {
    return [...new Set(categories.map((category) => canonicalTopicLabelForCategory(category)))];
}

export const eventCategories = {
    canonicalTopicLabelForCategory,
    canonicalTopicLabelsForCategories,
};
