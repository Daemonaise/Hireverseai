'use server';

import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance';
import { z } from 'zod';
import {
  DeterminePrimarySkillInputSchema,
  type DeterminePrimarySkillInput,
  DeterminePrimarySkillOutputSchema,
  type DeterminePrimarySkillOutput,
} from '@/ai/schemas/determine-primary-skill-schema';

export type { DeterminePrimarySkillInput, DeterminePrimarySkillOutput };

export async function determinePrimarySkill(
  input: DeterminePrimarySkillInput
): Promise<DeterminePrimarySkillOutput> {
  DeterminePrimarySkillInputSchema.parse(input);

  const selectedModel = await chooseModelBasedOnPrompt(input.skillsDescription);
  console.log(`Using model: ${selectedModel}`);

  const promptFn = ai.definePrompt({
    name: 'determinePrimarySkill',
    input:  { schema: DeterminePrimarySkillInputSchema },
    output: { schema: DeterminePrimarySkillOutputSchema },
    model:  selectedModel,
    prompt: ({ skillsDescription }) => [{
      text: `You are analyzing a freelancer's skills description.
Identify:
1. The single most prominent (primary) skill.
2. All distinct skills mentioned or implied.

Description:
${skillsDescription}

Return ONLY:
{
  "primarySkill": "string",
  "extractedSkills": ["string", "..."]
}`
    }],
  });

  try {
    const result = await promptFn(input);
    const output = result?.output;
    if (!output?.primarySkill || output.extractedSkills.length === 0) {
      return { primarySkill: 'General', extractedSkills: ['General'] };
    }
    return output;
  } catch {
    return { primarySkill: 'General', extractedSkills: ['General'] };
  }
}
