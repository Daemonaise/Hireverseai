'use server';

import { callAI } from '@/ai/ai-instance'; // Import the centralized callAI function
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

  console.log(`Determining primary skill for description starting with: "${input.skillsDescription.substring(0, 50)}..."`);

  // Construct the prompt for the callAI function
  const promptText = `You are analyzing a freelancer's skills description.
Identify:
1. The single most prominent (primary) skill.
2. All distinct skills mentioned or implied.

Description:
${input.skillsDescription}

Return ONLY a valid JSON object with the following structure:
{
  "primarySkill": "string (non-empty)",
  "extractedSkills": ["string", "..."] (array of non-empty strings, at least one)
}`;

  try {
    // Call the centralized AI function
    const responseText = await callAI(promptText);

    // Attempt to parse the JSON response
    let parsedOutput: DeterminePrimarySkillOutput;
    try {
       // Basic JSON extraction
       const jsonMatch = responseText.match(/\{[\s\S]*\}/);
       if (!jsonMatch) throw new Error("No JSON object found in response.");
       const rawOutput = JSON.parse(jsonMatch[0]);

       // Validate the parsed output against the schema
       const validationResult = DeterminePrimarySkillOutputSchema.safeParse(rawOutput);
       if (!validationResult.success) {
           throw new Error(`Invalid JSON structure: ${validationResult.error.errors.map(e => e.message).join(', ')}`);
       }
       parsedOutput = validationResult.data; // Use validated data

        // Additional check for empty strings which schema might not catch if optional
        if (!parsedOutput.primarySkill) throw new Error("Primary skill cannot be empty.");
        if (!parsedOutput.extractedSkills || parsedOutput.extractedSkills.length === 0 || parsedOutput.extractedSkills.some(s => !s)) {
            throw new Error("Extracted skills cannot be empty or contain empty strings.");
        }


    } catch (parseError: any) {
       console.error(`Error parsing primary skill JSON:`, parseError.message, "Raw Response:", responseText);
       throw new Error('AI did not return a valid JSON object for skills.');
    }

    console.log(`Determined primary skill: ${parsedOutput.primarySkill}, Extracted: ${parsedOutput.extractedSkills.join(', ')}`);
    return parsedOutput;

  } catch (error: any) {
    console.error(`Error in determinePrimarySkill flow:`, error?.message || error);
    // Return a default value on error
    return { primarySkill: 'General', extractedSkills: ['General'] };
  }
}
    
