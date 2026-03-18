import {
  COGNITIVE_WEIGHTS,
  DIFFICULTY_SCORE_WEIGHTS,
  type AssessmentQuestionAnswer,
  type CertificationLevel,
  type CognitiveDomain,
  type DifficultyLevel,
} from '@/types/assessment';

/**
 * Calculate weighted average score for a set of answers, weighting by difficulty.
 */
export function weightedAverage(answers: AssessmentQuestionAnswer[]): number {
  if (answers.length === 0) return 0;

  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const a of answers) {
    const weight = DIFFICULTY_SCORE_WEIGHTS[a.difficulty] ?? 1.0;
    totalWeightedScore += a.score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;
}

/**
 * Calculate per-skill scores from Phase 1 answers.
 */
export function calculateSkillScores(
  answers: AssessmentQuestionAnswer[]
): Record<string, number> {
  const byDomain: Record<string, AssessmentQuestionAnswer[]> = {};
  for (const a of answers) {
    if (a.phase !== 1) continue;
    if (!byDomain[a.domain]) byDomain[a.domain] = [];
    byDomain[a.domain].push(a);
  }

  const scores: Record<string, number> = {};
  for (const [domain, domainAnswers] of Object.entries(byDomain)) {
    scores[domain] = weightedAverage(domainAnswers);
  }
  return scores;
}

/**
 * Calculate cognitive profile from Phase 2 answers.
 */
export function calculateCognitiveProfile(
  answers: AssessmentQuestionAnswer[]
): Record<CognitiveDomain, number> {
  const domains: CognitiveDomain[] = [
    'patternRecognition', 'numericalReasoning', 'verbalReasoning',
    'spatialReasoning', 'logicalDeduction', 'workingMemory',
  ];

  const profile = {} as Record<CognitiveDomain, number>;
  for (const domain of domains) {
    const domainAnswers = answers.filter(a => a.phase === 2 && a.domain === domain);
    profile[domain] = weightedAverage(domainAnswers);
  }
  return profile;
}

/**
 * Estimate IQ from cognitive profile using weighted composite and standard mapping.
 */
export function estimateIQ(profile: Record<CognitiveDomain, number>): number {
  let composite = 0;
  for (const [domain, weight] of Object.entries(COGNITIVE_WEIGHTS)) {
    composite += (profile[domain as CognitiveDomain] ?? 0) * weight;
  }

  // Map 0-100 composite to IQ scale (mean 100, SD 15)
  // Linear mapping: composite 50 → IQ 100, each 10 points ≈ 15 IQ points
  const iq = Math.round(100 + (composite - 50) * 1.5);
  return Math.max(55, Math.min(160, iq)); // Clamp to reasonable range
}

/**
 * Calculate composite score from skill + cognitive averages.
 */
export function calculateCompositeScore(
  skillScores: Record<string, number>,
  cognitiveProfile: Record<CognitiveDomain, number>,
  practicalScore: number
): number {
  const skillValues = Object.values(skillScores);
  const avgSkill = skillValues.length > 0
    ? skillValues.reduce((a, b) => a + b, 0) / skillValues.length
    : 0;

  const cogValues = Object.values(cognitiveProfile);
  const avgCog = cogValues.length > 0
    ? cogValues.reduce((a, b) => a + b, 0) / cogValues.length
    : 0;

  // Weight: 55% skill, 30% cognitive, 15% practical
  return Math.round(avgSkill * 0.55 + avgCog * 0.30 + practicalScore * 0.15);
}

/**
 * Determine certification level from composite score.
 */
export function getCertificationLevel(compositeScore: number): CertificationLevel {
  if (compositeScore >= 95) return 'master';
  if (compositeScore >= 85) return 'expert';
  if (compositeScore >= 75) return 'advanced';
  if (compositeScore >= 50) return 'intermediate';
  if (compositeScore >= 35) return 'beginner';
  return 'uncertified';
}

/**
 * Calculate pay rate multiplier from composite score.
 */
export function getPayRateMultiplier(compositeScore: number): number {
  if (compositeScore >= 95) return 2.5;
  if (compositeScore >= 85) return 2.0;
  if (compositeScore >= 75) return 1.5;
  if (compositeScore >= 65) return 1.2;
  if (compositeScore >= 50) return 1.0;
  if (compositeScore >= 35) return 0.75;
  return 0.5;
}
