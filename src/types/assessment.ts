import type { Timestamp } from 'firebase/firestore';
// Import types from their new schema file locations


/**
 * Represents the difficulty level of an assessment question.
 */
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';


/**
 * Input data for generating an assessment question.
 */
export interface GenerateAssessmentQuestionInput {
    freelancerId: string;
    primarySkill: string;
    allSkills: string[]; // All skills for context
    difficulty: DifficultyLevel; // The difficulty of the requested question
    previousQuestions: string[]; // List of previous question texts for uniqueness
}


/**
 * Output data representing a generated assessment question.
 */
export interface GenerateAssessmentQuestionOutput {
    questionId: string; // Unique identifier for the question
    questionText: string; // The text of the question
    skillTested: string; // The skill being tested by this question
    difficulty: DifficultyLevel; // The difficulty of the question
}

/**
 * Input data for grading an assessment answer.
 */
export interface GradeAssessmentAnswerInput {
    freelancerId: string; // ID of the freelancer being assessed
    questionId: string; // ID of the question
    questionText: string; // The actual text of the question
    skillTested: string; // The skill tested by this question
    difficulty: DifficultyLevel; // The difficulty of the question
    answerText: string; // The answer provided by the freelancer
    primarySkill: string; // The primary skill for this assessment
}

export type AnswerFlags =
  | 'ai_generated_suspected'
  | 'irrelevant'
  | 'too_short'
  | 'plagiarized_suspected'
  | 'profane';



/**
 * Represents a single question-answer pair within an adaptive assessment.
 */
export interface AssessmentQuestionAnswer {
    questionId: string;
    questionText: string;
    skillTested: string; // The skill the question focused on
    difficulty: DifficultyLevel; // The difficulty level of the question
    answerText: string; // Freelancer's answer
    score: number; // Score given for this answer (0-100)
    feedback: string; // Feedback provided for the this answer
    flags?: AnswerFlags[]; // Any flags raised for this answer
    answeredAt: Timestamp; // When the answer was submitted
}

/**
 * Represents the overall result of an adaptive skill assessment stored in Firestore.
 */
export interface AdaptiveAssessmentResult {
    id?: string; // Firestore document ID
    freelancerId: string; // ID of the freelancer who took the assessment
    primarySkill: string; // The main skill assessed
    allSkills: string[]; // All skills mentioned by the freelancer
    questions: AssessmentQuestionAnswer[]; // Array of all questions asked and their graded answers
    finalScore: number; // Overall calculated score (0-100)
    certificationLevel: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' | 'Uncertified'; // Final certification level achieved
    completedAt: Timestamp; // When the assessment was completed
}


/**
 * Output data representing the result of grading an assessment answer.
 */
export interface GradeAssessmentAnswerOutput {
    questionId: string; // ID of the question
    score: number; // Score for this answer (0-100)
    feedback: string; // Feedback on the answer
    suggestedNextDifficulty: 'easier' | 'same' | 'harder'; // Suggestion for next question difficulty
    flags?: AnswerFlags[]; // Array of flags (optional)
}