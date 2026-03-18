'use client';

import { useState, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useProctor } from '@/hooks/use-proctor';
import { DifficultyEngine } from '@/lib/assessment/difficulty-engine';
import {
  calculateSkillScores,
  calculateCognitiveProfile,
  calculateCompositeScore,
  estimateIQ,
  getCertificationLevel,
  getPayRateMultiplier,
} from '@/lib/assessment/scoring';
import { calculateIntegrityScore } from '@/lib/assessment/integrity-scorer';
import { generateMatrixPuzzle } from '@/lib/puzzles/matrix-generator';
import { generateMemorySequence } from '@/lib/puzzles/sequence-generator';
import { generateSpatialPuzzle } from '@/lib/puzzles/block-structure';
import { generateSkillQuestion } from '@/ai/flows/generate-skill-question';
import { gradeSkillAnswer } from '@/ai/flows/grade-skill-answer';
import { generatePracticalChallenge } from '@/ai/flows/generate-practical-challenge';
import { gradePracticalAnswer } from '@/ai/flows/grade-practical-answer';
import type {
  AssessmentPhase,
  AssessmentQuestionAnswer,
  AssessmentResult,
  CognitiveDomain,
  DifficultyLevel,
} from '@/types/assessment';
import { PhaseIndicator } from './phase-indicator';
import { TimerBar } from './timer-bar';
import { SkillQuestion } from './skill-question';
import { MatrixPuzzle } from './matrix-puzzle';
import { SpatialViewer } from './spatial-viewer';
import { SequenceRecall } from './sequence-recall';
import { PracticalChallenge } from './practical-challenge';
import { AssessmentResults } from './assessment-results';
import { PageTransition } from '@/components/motion/page-transition';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Play } from 'lucide-react';

interface AssessmentShellProps {
  freelancerId: string;
  primarySkill: string;
  allSkills: string[];
  onComplete: (result: AssessmentResult) => void;
}

const COGNITIVE_DOMAINS: CognitiveDomain[] = [
  'patternRecognition', 'numericalReasoning', 'verbalReasoning',
  'spatialReasoning', 'logicalDeduction', 'workingMemory',
];

const SKILL_QUESTION_COUNT = 22;
const COG_QUESTIONS_PER_DOMAIN = 3;

export function AssessmentShell({
  freelancerId,
  primarySkill,
  allSkills,
  onComplete,
}: AssessmentShellProps) {
  const { toast } = useToast();
  const { getSignals, recordQuestionTiming } = useProctor();

  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<AssessmentPhase>(1);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [answers, setAnswers] = useState<AssessmentQuestionAnswer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);

  // Phase 1 state
  const [currentSkillQuestion, setCurrentSkillQuestion] = useState<{
    questionId: string; questionText: string; skillTested: string; difficulty: DifficultyLevel;
  } | null>(null);
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([]);
  const [difficultyEngine] = useState(() => new DifficultyEngine());

  // Phase 2 state
  const [cogDomainIdx, setCogDomainIdx] = useState(0);
  const [cogQuestionInDomain, setCogQuestionInDomain] = useState(0);
  const [cogQuestionData, setCogQuestionData] = useState<any>(null);

  // Phase 3 state
  const [practicalChallenge, setPracticalChallenge] = useState<{
    challengeId: string; challengeText: string; expectedDeliverableType: string; estimatedMinutes: number;
  } | null>(null);

  // Timing
  const [startedAt] = useState(Timestamp.now());
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const sessionSeed = `${freelancerId}_${Date.now()}`;

  // --- Phase 1: Skill Questions ---

  const fetchNextSkillQuestion = useCallback(async () => {
    const skillIdx = questionNumber % allSkills.length;
    const targetSkill = allSkills[skillIdx] || primarySkill;
    const difficulty = difficultyEngine.getDifficulty(targetSkill);

    setLoading(true);
    try {
      const q = await generateSkillQuestion({
        freelancerId,
        skills: allSkills,
        targetSkill,
        difficulty,
        previousQuestions,
        sessionSeed,
      });
      setCurrentSkillQuestion(q);
      setPreviousQuestions((prev) => [...prev, q.questionText]);
      setQuestionStartTime(Date.now());
    } catch {
      toast({ title: 'Error generating question', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [freelancerId, allSkills, primarySkill, questionNumber, difficultyEngine, previousQuestions, sessionSeed, toast]);

  async function handleSkillAnswer(answerText: string) {
    if (!currentSkillQuestion) return;
    setSubmitting(true);
    const timeMs = Date.now() - questionStartTime;
    const timeSpentSeconds = Math.round(timeMs / 1000);

    try {
      const grade = await gradeSkillAnswer({
        freelancerId,
        questionId: currentSkillQuestion.questionId,
        questionText: currentSkillQuestion.questionText,
        skillTested: currentSkillQuestion.skillTested,
        difficulty: currentSkillQuestion.difficulty,
        answerText,
        timeSpentSeconds,
      });

      recordQuestionTiming(currentSkillQuestion.questionId, timeMs, currentSkillQuestion.difficulty);

      const qa: AssessmentQuestionAnswer = {
        questionId: currentSkillQuestion.questionId,
        phase: 1,
        domain: currentSkillQuestion.skillTested,
        questionType: 'text',
        questionText: currentSkillQuestion.questionText,
        answer: answerText,
        score: grade.score,
        maxScore: 100,
        difficulty: currentSkillQuestion.difficulty,
        feedback: grade.feedback,
        flags: (grade.flags ?? []) as any,
        timeSpentSeconds,
        answeredAt: Timestamp.now(),
      };

      setAnswers((prev) => [...prev, qa]);
      difficultyEngine.update(currentSkillQuestion.skillTested, grade.score);

      const nextQ = questionNumber + 1;
      setQuestionNumber(nextQ);

      if (nextQ >= SKILL_QUESTION_COUNT) {
        setPhase(2);
        setCogDomainIdx(0);
        setCogQuestionInDomain(0);
        loadCognitiveQuestion(0, 0);
      } else {
        setCurrentSkillQuestion(null);
        // Will trigger next question fetch
        setTimeout(() => fetchNextSkillQuestion(), 100);
      }
    } catch {
      toast({ title: 'Error grading answer', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  // --- Phase 2: Cognitive Battery ---

  function loadCognitiveQuestion(domainIdx: number, qInDomain: number) {
    const domain = COGNITIVE_DOMAINS[domainIdx];
    const difficulty = difficultyEngine.getDifficulty(domain);
    const seed = hashCode(`${sessionSeed}_${domain}_${qInDomain}`);

    setLoading(true);
    setQuestionStartTime(Date.now());

    switch (domain) {
      case 'patternRecognition': {
        const puzzle = generateMatrixPuzzle(seed, difficulty);
        setCogQuestionData({ type: 'matrix', ...puzzle, difficulty, domain });
        break;
      }
      case 'spatialReasoning': {
        const puzzle = generateSpatialPuzzle(seed, difficulty);
        setCogQuestionData({ type: 'spatial', ...puzzle, difficulty, domain });
        break;
      }
      case 'workingMemory': {
        const seq = generateMemorySequence(seed, difficulty);
        setCogQuestionData({ type: 'sequence', ...seq, difficulty, domain });
        break;
      }
      default: {
        // Text-based cognitive questions (numerical, verbal, logical) — use AI
        generateCognitiveTextQuestion(domain, difficulty);
        return;
      }
    }
    setLoading(false);
  }

  async function generateCognitiveTextQuestion(domain: CognitiveDomain, difficulty: DifficultyLevel) {
    const domainLabels: Record<string, string> = {
      numericalReasoning: 'numerical reasoning and mathematical problem-solving',
      verbalReasoning: 'verbal reasoning, analogies, and logical inference from text',
      logicalDeduction: 'logical deduction, rule-based puzzles, and syllogisms',
    };

    try {
      const q = await generateSkillQuestion({
        freelancerId,
        skills: [domainLabels[domain] || domain],
        targetSkill: domainLabels[domain] || domain,
        difficulty,
        previousQuestions,
        sessionSeed: `${sessionSeed}_cog`,
      });
      setCogQuestionData({ type: 'text', ...q, domain, difficulty });
      setPreviousQuestions((prev) => [...prev, q.questionText]);
    } catch {
      toast({ title: 'Error generating question', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function handleCognitiveAnswer(score: number) {
    const timeMs = Date.now() - questionStartTime;
    const domain = COGNITIVE_DOMAINS[cogDomainIdx];
    const difficulty = difficultyEngine.getDifficulty(domain);

    recordQuestionTiming(`cog_${domain}_${cogQuestionInDomain}`, timeMs, difficulty);

    const qa: AssessmentQuestionAnswer = {
      questionId: `cog_${domain}_${cogQuestionInDomain}`,
      phase: 2,
      domain,
      questionType: cogQuestionData?.type || 'text',
      questionText: cogQuestionData?.questionText || `${domain} question`,
      answer: String(score),
      score,
      maxScore: 100,
      difficulty,
      feedback: '',
      flags: [],
      timeSpentSeconds: Math.round(timeMs / 1000),
      answeredAt: Timestamp.now(),
    };

    setAnswers((prev) => [...prev, qa]);
    difficultyEngine.update(domain, score);
    setQuestionNumber((prev) => prev + 1);

    const nextQInDomain = cogQuestionInDomain + 1;
    if (nextQInDomain >= COG_QUESTIONS_PER_DOMAIN) {
      // Move to next domain
      const nextDomainIdx = cogDomainIdx + 1;
      if (nextDomainIdx >= COGNITIVE_DOMAINS.length) {
        // Phase 2 complete → Phase 3
        setPhase(3);
        loadPracticalChallenge();
      } else {
        setCogDomainIdx(nextDomainIdx);
        setCogQuestionInDomain(0);
        loadCognitiveQuestion(nextDomainIdx, 0);
      }
    } else {
      setCogQuestionInDomain(nextQInDomain);
      loadCognitiveQuestion(cogDomainIdx, nextQInDomain);
    }
  }

  // --- Phase 3: Practical Challenge ---

  async function loadPracticalChallenge() {
    setLoading(true);
    try {
      const skillScores = calculateSkillScores(answers);
      const challenge = await generatePracticalChallenge({
        freelancerId,
        primarySkill,
        allSkills,
        skillScoresSoFar: skillScores,
      });
      setPracticalChallenge(challenge);
      setQuestionStartTime(Date.now());
    } catch {
      toast({ title: 'Error generating challenge', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handlePracticalAnswer(answerText: string) {
    if (!practicalChallenge) return;
    setSubmitting(true);
    const timeMs = Date.now() - questionStartTime;

    try {
      const grade = await gradePracticalAnswer({
        freelancerId,
        challengeId: practicalChallenge.challengeId,
        challengeText: practicalChallenge.challengeText,
        primarySkill,
        answerText,
        timeSpentSeconds: Math.round(timeMs / 1000),
      });

      const qa: AssessmentQuestionAnswer = {
        questionId: practicalChallenge.challengeId,
        phase: 3,
        domain: primarySkill,
        questionType: 'practical',
        questionText: practicalChallenge.challengeText,
        answer: answerText,
        score: grade.score,
        maxScore: 100,
        difficulty: 'advanced',
        feedback: grade.feedback,
        flags: [],
        timeSpentSeconds: Math.round(timeMs / 1000),
        answeredAt: Timestamp.now(),
      };

      const allAnswers = [...answers, qa];
      setAnswers(allAnswers);
      finalizeAssessment(allAnswers);
    } catch {
      toast({ title: 'Error grading challenge', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  // --- Finalization ---

  function finalizeAssessment(allAnswers: AssessmentQuestionAnswer[]) {
    const skillScores = calculateSkillScores(allAnswers);
    const cognitiveProfile = calculateCognitiveProfile(allAnswers);
    const practicalAnswers = allAnswers.filter((a) => a.phase === 3);
    const practicalScore = practicalAnswers.length > 0
      ? Math.round(practicalAnswers.reduce((sum, a) => sum + a.score, 0) / practicalAnswers.length)
      : 0;

    const compositeScore = calculateCompositeScore(skillScores, cognitiveProfile, practicalScore);
    const iq = estimateIQ(cognitiveProfile);
    const certificationLevel = getCertificationLevel(compositeScore);
    const payRateMultiplier = getPayRateMultiplier(compositeScore);

    const signals = getSignals();
    const { score: sessionIntegrity, flags: behavioralFlags } = calculateIntegrityScore(signals);

    const now = Timestamp.now();
    const durationSeconds = Math.round((now.toMillis() - startedAt.toMillis()) / 1000);

    const assessmentResult: AssessmentResult = {
      id: '',
      freelancerId,
      attemptNumber: 1,
      skillScores,
      cognitiveProfile,
      estimatedIQ: iq,
      practicalScore,
      compositeScore,
      certificationLevel,
      payRateMultiplier,
      sessionIntegrity,
      behavioralFlags,
      questions: allAnswers,
      startedAt,
      completedAt: now,
      durationSeconds,
    };

    setResult(assessmentResult);
    onComplete(assessmentResult);
  }

  // --- Start screen ---

  if (!started) {
    return (
      <PageTransition>
        <div className="max-w-lg mx-auto py-12">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Skill Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                This assessment takes 45-60 minutes and evaluates your skills, cognitive ability,
                and practical problem-solving. Your results determine your certification level
                and pay rate.
              </p>
              <div className="text-left space-y-2 text-sm">
                <p><strong>Phase 1:</strong> {SKILL_QUESTION_COUNT} skill-specific questions (25-35 min)</p>
                <p><strong>Phase 2:</strong> {COGNITIVE_DOMAINS.length * COG_QUESTIONS_PER_DOMAIN} cognitive reasoning questions (15-20 min)</p>
                <p><strong>Phase 3:</strong> 1 practical challenge (5-10 min)</p>
              </div>
              <div className="text-left text-xs text-muted-foreground space-y-1 border-t pt-3">
                <p>• Copy-paste is disabled</p>
                <p>• Switching tabs is monitored</p>
                <p>• Each question is timed</p>
                <p>• All questions are unique to your session</p>
              </div>
              <Button size="lg" onClick={() => { setStarted(true); fetchNextSkillQuestion(); }}>
                <Play className="h-4 w-4 mr-2" />
                Begin Assessment
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    );
  }

  // --- Results screen ---

  if (result) {
    return <AssessmentResults result={result} onClose={() => {}} />;
  }

  // --- Active assessment ---

  const totalQuestions = SKILL_QUESTION_COUNT + (COGNITIVE_DOMAINS.length * COG_QUESTIONS_PER_DOMAIN) + 1;

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto space-y-6">
        <PhaseIndicator
          currentPhase={phase}
          questionNumber={questionNumber + 1}
          totalQuestions={totalQuestions}
        />

        <TimerBar durationSeconds={3600} />

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Generating question...</span>
          </div>
        )}

        {/* Phase 1: Skill Questions */}
        {phase === 1 && currentSkillQuestion && !loading && (
          <SkillQuestion
            questionText={currentSkillQuestion.questionText}
            skillTested={currentSkillQuestion.skillTested}
            difficulty={currentSkillQuestion.difficulty}
            questionNumber={questionNumber + 1}
            onSubmit={handleSkillAnswer}
            submitting={submitting}
          />
        )}

        {/* Phase 2: Cognitive Questions */}
        {phase === 2 && cogQuestionData && !loading && (
          <>
            {cogQuestionData.type === 'matrix' && (
              <MatrixPuzzle
                svgGrid={cogQuestionData.svgGrid}
                svgOptions={cogQuestionData.svgOptions}
                correctIndex={cogQuestionData.correctIndex}
                questionNumber={questionNumber + 1}
                difficulty={cogQuestionData.difficulty}
                onSubmit={(_, correct) => handleCognitiveAnswer(correct ? 100 : 0)}
                submitting={submitting}
              />
            )}
            {cogQuestionData.type === 'spatial' && (
              <SpatialViewer
                structureA={cogQuestionData.structureA}
                structureB={cogQuestionData.structureB}
                isSame={cogQuestionData.isSame}
                questionNumber={questionNumber + 1}
                difficulty={cogQuestionData.difficulty}
                onSubmit={(_, correct) => handleCognitiveAnswer(correct ? 100 : 0)}
                submitting={submitting}
              />
            )}
            {cogQuestionData.type === 'sequence' && (
              <SequenceRecall
                sequence={cogQuestionData.sequence}
                displayDurationMs={cogQuestionData.displayDurationMs}
                type={cogQuestionData.type === 'sequence' ? 'number' : cogQuestionData.type}
                questionNumber={questionNumber + 1}
                difficulty={cogQuestionData.difficulty}
                onSubmit={(_, correct) => handleCognitiveAnswer(correct ? 100 : 0)}
                submitting={submitting}
              />
            )}
            {cogQuestionData.type === 'text' && (
              <SkillQuestion
                questionText={cogQuestionData.questionText}
                skillTested={cogQuestionData.domain}
                difficulty={cogQuestionData.difficulty}
                questionNumber={questionNumber + 1}
                onSubmit={async (text) => {
                  setSubmitting(true);
                  try {
                    const grade = await gradeSkillAnswer({
                      freelancerId,
                      questionId: cogQuestionData.questionId,
                      questionText: cogQuestionData.questionText,
                      skillTested: cogQuestionData.domain,
                      difficulty: cogQuestionData.difficulty,
                      answerText: text,
                      timeSpentSeconds: Math.round((Date.now() - questionStartTime) / 1000),
                    });
                    handleCognitiveAnswer(grade.score);
                  } catch {
                    toast({ title: 'Error grading', variant: 'destructive' });
                  } finally {
                    setSubmitting(false);
                  }
                }}
                submitting={submitting}
              />
            )}
          </>
        )}

        {/* Phase 3: Practical Challenge */}
        {phase === 3 && practicalChallenge && !loading && (
          <PracticalChallenge
            challengeText={practicalChallenge.challengeText}
            expectedDeliverableType={practicalChallenge.expectedDeliverableType}
            estimatedMinutes={practicalChallenge.estimatedMinutes}
            primarySkill={primarySkill}
            onSubmit={handlePracticalAnswer}
            submitting={submitting}
          />
        )}
      </div>
    </PageTransition>
  );
}

// Simple string hash for seed generation
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
