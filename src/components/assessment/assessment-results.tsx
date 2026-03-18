'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { MotionDiv } from '@/components/motion/motion-div';
import { AnimateList } from '@/components/motion/animate-list';
import { Trophy, Brain, Target, Shield } from 'lucide-react';
import type { AssessmentResult, CognitiveDomain } from '@/types/assessment';

interface AssessmentResultsProps {
  result: AssessmentResult;
  onClose: () => void;
}

const CERT_COLORS: Record<string, string> = {
  master: 'bg-amber-500',
  expert: 'bg-purple-500',
  advanced: 'bg-blue-500',
  intermediate: 'bg-green-500',
  beginner: 'bg-gray-500',
  uncertified: 'bg-gray-400',
};

const DOMAIN_LABELS: Record<CognitiveDomain, string> = {
  patternRecognition: 'Pattern Recognition',
  numericalReasoning: 'Numerical Reasoning',
  verbalReasoning: 'Verbal Reasoning',
  spatialReasoning: 'Spatial Reasoning',
  logicalDeduction: 'Logical Deduction',
  workingMemory: 'Working Memory',
};

export function AssessmentResults({ result, onClose }: AssessmentResultsProps) {
  const minutes = Math.round(result.durationSeconds / 60);

  return (
    <MotionDiv preset="scaleIn" className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${CERT_COLORS[result.certificationLevel]}`}>
          <Trophy className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold">Assessment Complete</h2>
        <p className="text-muted-foreground">
          Completed in {minutes} minutes
        </p>
      </div>

      {/* Score cards */}
      <AnimateList className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Composite Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{result.compositeScore}</p>
            <Badge className={`mt-1 ${CERT_COLORS[result.certificationLevel]} text-white capitalize`}>
              {result.certificationLevel}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" /> Estimated IQ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{result.estimatedIQ}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Pay multiplier: {result.payRateMultiplier}x
            </p>
          </CardContent>
        </Card>
      </AnimateList>

      {/* Skill scores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Skill Proficiency</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(result.skillScores).map(([skill, score]) => (
            <div key={skill} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="capitalize">{skill}</span>
                <span className="font-mono">{score}/100</span>
              </div>
              <Progress value={score} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Cognitive profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cognitive Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(Object.entries(result.cognitiveProfile) as [CognitiveDomain, number][]).map(([domain, score]) => (
            <div key={domain} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{DOMAIN_LABELS[domain]}</span>
                <span className="font-mono">{score}/100</span>
              </div>
              <Progress value={score} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Session integrity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" /> Session Integrity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold">{result.sessionIntegrity}/100</span>
            <Badge variant={result.sessionIntegrity >= 90 ? 'default' : result.sessionIntegrity >= 70 ? 'secondary' : 'destructive'}>
              {result.sessionIntegrity >= 90 ? 'Clean' :
               result.sessionIntegrity >= 70 ? 'Minor flags' :
               result.sessionIntegrity >= 50 ? 'Unverified' : 'Invalidated'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button onClick={onClose} size="lg">
          Continue to Dashboard
        </Button>
      </div>
    </MotionDiv>
  );
}
