
'use client';

import React, { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import { generateAssessmentQuestion} from '@/ai/flows/generate-assessment-question';
import { gradeAssessmentAnswer} from '@/ai/flows/grade-assessment-answer';
import { storeAssessmentResult } from '@/services/firestore';
import type { AssessmentQuestionAnswer, AdaptiveAssessmentResult, GenerateAssessmentQuestionInput, GenerateAssessmentQuestionOutput, DifficultyLevel, GradeAssessmentAnswerInput, GradeAssessmentAnswerOutput } from '@/types/assessment';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertCircle, Send, CheckCircle, Info, RefreshCcw } from 'lucide-react'; // AlertCircle already imported
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore';

interface AdaptiveSkillAssessmentProps {
  freelancerId: string;
  primarySkill: string;
  allSkills: string[]; // All skills for context
  onComplete: () => void; // Callback when assessment finishes
}

const MAX_QUESTIONS = 50; // Maximum number of questions
const DIFFICULTY_LEVELS: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];

// Helper function to get the next difficulty level
const getNextDifficultyLevel = (current: DifficultyLevel, direction: 'easier' | 'same' | 'harder'): DifficultyLevel => {
    const currentIndex = DIFFICULTY_LEVELS.indexOf(current);
    if (direction === 'easier') {
        return DIFFICULTY_LEVELS[Math.max(0, currentIndex - 1)];
    }
    if (direction === 'harder') {
        return DIFFICULTY_LEVELS[Math.min(DIFFICULTY_LEVELS.length - 1, currentIndex + 1)];
    }
    return current; // 'same'
};


export function AdaptiveSkillAssessment({
  freelancerId,
  primarySkill,
  allSkills,
  onComplete,
}: AdaptiveSkillAssessmentProps) {
  const [currentQuestion, setCurrentQuestion] = useState<GenerateAssessmentQuestionOutput | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [answeredQuestions, setAnsweredQuestions] = useState<AssessmentQuestionAnswer[]>([]);
  const [currentDifficulty, setCurrentDifficulty] = useState<DifficultyLevel>('beginner');
  const [isLoading, setIsLoading] = useState(true); // Combined loading state for initial Q and fetching next Q
  const [isSubmitting, startSubmitTransition] = useTransition(); // For submitting answer + grading
  const [isFinalizing, setIsFinalizing] = useState(false); // Specific state for final submission process
  const [error, setError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null); // Separate state for fetch errors
  const { toast } = useToast();


  const questionNumber = answeredQuestions.length + 1;
  // Cap progress percentage at 100
  const progressPercentage = Math.min(100, (answeredQuestions.length / MAX_QUESTIONS) * 100);

  // Function to fetch the next question
  const fetchNextQuestion = useCallback(async (difficulty: DifficultyLevel) => {
    setIsLoading(true);
    setFetchError(null); // Clear previous fetch errors
    setError(null); // Clear general errors
    try {
        const input: GenerateAssessmentQuestionInput = {
            freelancerId,
            primarySkill,
            allSkills,
            difficulty,
            previousQuestions: answeredQuestions.map(q => q.questionText),
        };
        const nextQuestion = await generateAssessmentQuestion(input);
        setCurrentQuestion(nextQuestion);
        setCurrentDifficulty(nextQuestion.difficulty);
        setCurrentAnswer('');
    } catch (err: any) {
        const message = `Failed to load the next question: ${err.message}.`;
        setFetchError(message); // Set specific fetch error
        toast({ title: "Error Loading Question", description: err.message, variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }, [freelancerId, primarySkill, allSkills, answeredQuestions, toast]); // Correct dependencies

  // Fetch the first question on mount
  useEffect(() => {
    fetchNextQuestion('beginner');
  }, [fetchNextQuestion]); // Include fetchNextQuestion in dependency array

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || !currentAnswer.trim()) {
      toast({
        title: 'Missing Answer',
        description: 'Please provide an answer before submitting.',
        variant: 'destructive',
      });
      return;
    }
    if (currentAnswer.trim().length < 10) {
      toast({
        title: 'Answer Too Short',
        description: 'Please provide a more detailed answer (min 10 characters).',
        variant: 'destructive',
      });
      return;
    }

    if (questionNumber === MAX_QUESTIONS) {
      // If this is the last question, call finalize directly
      await finalizeAssessment([
        ...answeredQuestions,
        {
          // Create temporary record for finalization logic
          questionId: currentQuestion.questionId,
          questionText: currentQuestion.questionText,
          skillTested: currentQuestion.skillTested,
          difficulty: currentQuestion.difficulty,
          answerText: currentAnswer,
          score: -1, // Placeholder score, will be calculated
          feedback: '', // Placeholder feedback
          answeredAt: Timestamp.now(),
        },
      ]);
      return;
    }

    startSubmitTransition(async () => {
      setError(null); // Clear previous submission errors
      setIsLoading(true); // Use isLoading to indicate processing next question
      try {
        const gradeInput: GradeAssessmentAnswerInput = {
          freelancerId,
          questionId: currentQuestion.questionId,
          questionText: currentQuestion.questionText,
          skillTested: currentQuestion.skillTested,
          difficulty: currentQuestion.difficulty,
          answerText: currentAnswer,
          primarySkill: primarySkill,
        };
        const gradeResult = await gradeAssessmentAnswer(gradeInput);
        const newAnsweredQuestion: AssessmentQuestionAnswer = {
          questionId: gradeResult.questionId,
          questionText: currentQuestion.questionText,
          skillTested: currentQuestion.skillTested,
          difficulty: currentQuestion.difficulty,
          answerText: currentAnswer,
          score: gradeResult.score,
          feedback: gradeResult.feedback,
          flags: gradeResult.flags,
          answeredAt: Timestamp.now(),
        };
        const updatedAnsweredQuestions = [...answeredQuestions, newAnsweredQuestion];
        setAnsweredQuestions(updatedAnsweredQuestions);

        const suggestedDirection = ['easier', 'same', 'harder'].includes(gradeResult.suggestedNextDifficulty)
          ? (gradeResult.suggestedNextDifficulty as 'easier' | 'same' | 'harder')
          : 'same';
        const nextDifficulty = getNextDifficultyLevel(currentDifficulty, suggestedDirection);
        await fetchNextQuestion(nextDifficulty);
      } catch (err: any) {
        setError(`An error occurred during submission: ${err.message}. You can try submitting again or contact support.`);
        toast({ title: 'Submission Error', description: err.message, variant: 'destructive' });
        setIsLoading(false);
      } finally {
      }
    });
  };

  const finalizeAssessment = async (finalAnswers: AssessmentQuestionAnswer[]) => {
    setIsFinalizing(true);
    setIsLoading(true);
    setError(null);

    try {
      const lastAnswer = finalAnswers[finalAnswers.length - 1];
      if (lastAnswer.score === -1 && currentQuestion) {
        const gradeInput: GradeAssessmentAnswerInput = {
          freelancerId,
          questionId: lastAnswer.questionId,
          questionText: lastAnswer.questionText,
          skillTested: lastAnswer.skillTested,
          difficulty: lastAnswer.difficulty,
          answerText: lastAnswer.answerText,
          primarySkill: primarySkill,
        };
        const gradeResult = await gradeAssessmentAnswer(gradeInput);
        lastAnswer.score = gradeResult.score;
        lastAnswer.feedback = gradeResult.feedback;
        lastAnswer.flags = gradeResult.flags;
      }

      const totalScore = finalAnswers.reduce((sum, q) => sum + q.score, 0);
      const finalScore = Math.round(finalAnswers.length > 0 ? totalScore / finalAnswers.length : 0);

      let certificationLevel: AdaptiveAssessmentResult['certificationLevel'] = 'Uncertified';
      if (finalScore >= 90) certificationLevel = 'Expert';
      else if (finalScore >= 75) certificationLevel = 'Advanced';
      else if (finalScore >= 50) certificationLevel = 'Intermediate';
      else if (finalScore >= 30) certificationLevel = 'Beginner';

      const assessmentResult: AdaptiveAssessmentResult = {
        freelancerId,
        primarySkill,
        allSkills,
        questions: finalAnswers,
        finalScore,
        certificationLevel,
        completedAt: Timestamp.now(),
      };

      const assessmentId = await storeAssessmentResult(assessmentResult);
      toast({
        title: 'Assessment Complete!',
        description: `Your final score is ${finalScore}. Certification: ${certificationLevel}. Results saved.`,
        variant: 'default',
        duration: 5000,
      });

      onComplete();
    } catch (err: any) {
      setError(`Failed to save assessment results: ${err.message}. Please contact support.`);
      toast({ title: 'Error Saving Results', description: err.message, variant: 'destructive' });
    } finally {
      setIsFinalizing(false);
      setIsLoading(false);
    }
  };

  // Disable copy-paste using React event handlers
  const preventPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    toast({
        title: "Paste Disabled",
        description: "Pasting content into the answer field is disabled.",
        variant: "destructive",
        duration: 3000, // Shorter duration might be less intrusive
    });
  };

  // Memoize button disabled state logic for clarity
  const isSubmitDisabled = useMemo(() => {
    return isSubmitting || isLoading || isFinalizing || !currentAnswer.trim() || currentAnswer.trim().length < 10 || fetchError !== null;
  }, [isSubmitting, isLoading, isFinalizing, currentAnswer, fetchError]);

  // --- Rendering Logic ---

  if (isLoading && !currentQuestion && !fetchError) {
    // Initial loading state
    return (
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <CardTitle>Loading Assessment...</CardTitle>
          <CardDescription>Please wait while we prepare your first question.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-16">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (fetchError) {
    // Error state for fetching questions
    return (
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <CardTitle>Assessment Error</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Question</AlertTitle>
            <AlertDescription>
                {fetchError}
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => fetchNextQuestion(currentDifficulty)}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
               Retry Loading
           </Button>
        </CardContent>
      </Card>
    );
  }

  if (!currentQuestion && !isLoading) {
     // Fallback if no question loaded and not loading/error state
     return (
       <Card className="w-full max-w-2xl shadow-lg">
         <CardHeader>
           <CardTitle>Assessment Unavailable</CardTitle>
         </CardHeader>
         <CardContent>
           <p>Could not load assessment questions at this time. Please try again later.</p>
         </CardContent>
       </Card>
     );
   }

  if (!currentQuestion) {
    // Should not be reached if logic above is sound, but safety check
    return <p>Loading question...</p>;
  }

  // Main assessment view
  return (
    <Card className="w-full max-w-2xl shadow-lg relative"> {/* Added relative for overlay */}
      <CardHeader>
        <CardTitle>Adaptive Skill Assessment</CardTitle>
        <CardDescription>
          Answer the following questions to the best of your ability. Difficulty adjusts based on your performance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-1">
          <Progress value={progressPercentage} className="w-full h-2" />
          <p className="text-sm text-muted-foreground text-center">
            Question {Math.min(questionNumber, MAX_QUESTIONS)} of {MAX_QUESTIONS}
          </p>
        </div>

        {/* Loading overlay for processing/fetching next question */}
        {(isLoading || isSubmitting || isFinalizing) && (
          <div className="absolute inset-0 bg-background/80 flex justify-center items-center z-10 rounded-md">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">{isFinalizing ? 'Finalizing...' : 'Processing...'}</span>
          </div>
        )}
        {/* Current Question */}
        <div className={`space-y-2 ${isLoading || isSubmitting || isFinalizing ? 'opacity-50' : ''}`}>
          {' '}
          {/* Dim content while loading */}
          <label htmlFor="answer-textarea" className="text-base font-semibold block">
            Q{questionNumber}: {currentQuestion.questionText}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (Skill: {currentQuestion.skillTested} | Difficulty: {currentQuestion.difficulty})
            </span>
          </label>
          <Textarea
            id="answer-textarea"
            placeholder="Your detailed answer here... (Pasting is disabled)"
            className="min-h-[200px] resize-none"
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            onPaste={preventPaste}
            // onContextMenu={preventContextMenu} // Keep context menu for accessibility? Only block specific paste actions.
            disabled={isSubmitting || isLoading || isFinalizing || fetchError !== null}
            aria-label={`Answer for question ${questionNumber}`}
            autoFocus
          />
        </div>

        {/* Informational Alert about disabled features */}
        <Alert variant="default" className="bg-muted/50 border-muted-foreground/20 text-muted-foreground">
          <Info className="h-4 w-4" />
          <AlertTitle className="text-sm">Note</AlertTitle>
          <AlertDescription className="text-xs">Pasting content is disabled in the answer field to ensure original work.</AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter className="flex flex-col items-center gap-4">
        <Button
          onClick={handleSubmitAnswer}
          disabled={isSubmitDisabled}
          className="w-full md:w-auto"
          aria-label={questionNumber >= MAX_QUESTIONS ? 'Submit Final Answer' : 'Submit Answer and Get Next Question'}
        >
          {isSubmitting || isLoading || isFinalizing ? ( // Show generic spinner
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              {questionNumber >= MAX_QUESTIONS ? 'Submit Final Answer' : 'Submit Answer'}
              <Send className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
        {error && !(isLoading || isSubmitting || isFinalizing) && (
          // Show submit errors only when not processing
          <Alert variant="destructive" className="w-full">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Submission Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardFooter>
    </Card>
  );
}
