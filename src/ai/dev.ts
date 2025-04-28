
import '@/ai/flows/match-freelancer.ts';
import '@/ai/flows/administer-skill-test.ts';
import '@/ai/flows/score-skill-test.ts';
import '@/ai/flows/determine-primary-skill.ts';
import '@/ai/flows/generate-assessment-question.ts';
import '@/ai/flows/grade-assessment-answer.ts';
import '@/ai/flows/request-project-change.ts';
import '@/ai/flows/decompose-project.ts'; // Keep this flow
import '@/ai/flows/generate-project-idea.ts';

// Schemas are implicitly loaded via the flows that import them
// No need to explicitly import schema files here anymore.
