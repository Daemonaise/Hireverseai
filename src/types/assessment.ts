import type { Timestamp } from 'firebase/firestore';

// --- Enums & Literal Types ---

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master';

export type CertificationLevel = 'master' | 'expert' | 'advanced' | 'intermediate' | 'beginner' | 'uncertified';

export type CognitiveDomain =
  | 'patternRecognition'
  | 'numericalReasoning'
  | 'verbalReasoning'
  | 'spatialReasoning'
  | 'logicalDeduction'
  | 'workingMemory';

export type AnswerFlag =
  | 'ai_generated_suspected'
  | 'plagiarized_suspected'
  | 'irrelevant'
  | 'too_short'
  | 'profane'
  | 'timing_anomaly'
  | 'cadence_anomaly'
  | 'consistency_check';

export type QuestionType = 'text' | 'matrix' | 'spatial' | 'sequence' | 'practical';

export type AssessmentPhase = 1 | 2 | 3;

// --- Difficulty Levels Array (for engine) ---

export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  'beginner', 'intermediate', 'advanced', 'expert', 'master',
];

// --- Cognitive Domain Weights (for IQ estimation) ---

export const COGNITIVE_WEIGHTS: Record<CognitiveDomain, number> = {
  patternRecognition: 0.25,
  numericalReasoning: 0.15,
  verbalReasoning: 0.15,
  spatialReasoning: 0.15,
  logicalDeduction: 0.20,
  workingMemory: 0.10,
};

// --- Difficulty Score Weights ---

export const DIFFICULTY_SCORE_WEIGHTS: Record<DifficultyLevel, number> = {
  beginner: 0.6,
  intermediate: 0.8,
  advanced: 1.0,
  expert: 1.2,
  master: 1.5,
};

// --- Question/Answer ---

export interface AssessmentQuestionAnswer {
  questionId: string;
  phase: AssessmentPhase;
  domain: string; // skill name or CognitiveDomain
  questionType: QuestionType;
  questionText: string;
  questionData?: string; // SVG string, 3D seed, structured data
  answerOptions?: string[]; // For multiple choice (matrix puzzles, spatial)
  answer: string;
  score: number;
  maxScore: number;
  difficulty: DifficultyLevel;
  feedback: string;
  flags: AnswerFlag[];
  timeSpentSeconds: number;
  answeredAt: Timestamp;
}

// --- Assessment Result ---

export interface AssessmentResult {
  id: string;
  freelancerId: string;
  attemptNumber: number;

  // Phase 1: Skill proficiency
  skillScores: Record<string, number>; // skill name → 0-100

  // Phase 2: Cognitive battery
  cognitiveProfile: Record<CognitiveDomain, number>; // domain → 0-100
  estimatedIQ: number; // IQ scale (mean 100, SD 15)

  // Phase 3: Practical challenge
  practicalScore: number; // 0-100

  // Combined
  compositeScore: number; // 0-100
  certificationLevel: CertificationLevel;
  payRateMultiplier: number; // 0.5 - 2.5

  // Integrity
  sessionIntegrity: number; // 0-100
  behavioralFlags: string[];

  // Questions
  questions: AssessmentQuestionAnswer[];

  // Meta
  startedAt: Timestamp;
  completedAt: Timestamp;
  durationSeconds: number;
}

// --- Proctor Signals ---

export interface ProctorSignals {
  tabSwitchCount: number;
  totalTimeAwayMs: number;
  pasteAttempts: number;
  mouseExits: number;
  rightClickAttempts: number;
  devToolsDetected: boolean;
  keystrokeIntervals: number[]; // ms between keystrokes (sampled)
  questionTimings: Array<{ questionId: string; timeMs: number; difficulty: DifficultyLevel }>;
}

// --- Legacy compatibility (keep old types working during migration) ---

export type { AssessmentResult as AdaptiveAssessmentResult };

export interface GenerateAssessmentQuestionInput {
  freelancerId: string;
  primarySkill: string;
  allSkills: string[];
  difficulty: DifficultyLevel;
  previousQuestions: string[];
}

export interface GenerateAssessmentQuestionOutput {
  questionId: string;
  questionText: string;
  skillTested: string;
  difficulty: DifficultyLevel;
}

export interface GradeAssessmentAnswerInput {
  freelancerId: string;
  questionId: string;
  questionText: string;
  skillTested: string;
  difficulty: DifficultyLevel;
  answerText: string;
  primarySkill: string;
}

export interface GradeAssessmentAnswerOutput {
  questionId: string;
  score: number;
  feedback: string;
  suggestedNextDifficulty: 'easier' | 'same' | 'harder';
  flags?: AnswerFlag[];
}
