/**
 * ai-instance.ts
 *
 * Initializes Genkit with configured AI plugins (Google Gemini, OpenAI, Anthropic)
 * and provides helper functions for dynamic model selection, raw AI calls, and prompt definitions.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { openAI } from 'genkitx-openai';
import { anthropic } from 'genkitx-anthropic';
import { z } from 'zod';

// --- Environment Variables ---
const GOOGLE_API_KEY    = process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// --- Plugin Configuration ---
const plugins = [];
if (GOOGLE_API_KEY)    plugins.push(googleAI({ apiKey: GOOGLE_API_KEY }));
if (OPENAI_API_KEY)    plugins.push(openAI({ apiKey: OPENAI_API_KEY }));
if (ANTHROPIC_API_KEY) plugins.push(anthropic({ apiKey: ANTHROPIC_API_KEY }));

if (!plugins.length) {
  console.error('[AI] No API keys found: all AI calls will fail');
}

// --- Genkit Initialization ---
// Note: Removed 'use server' from here as this file exports the 'ai' object and prompts
export const ai = genkit({
  promptDir: './prompts',
  plugins,
});

/**
 * Dynamically choose the best Genkit model for a given prompt.
 * @param content The prompt text to analyze.
 * @returns The Genkit model identifier string.
 */
export async function chooseModelBasedOnPrompt(content: string): Promise<string> {
  const text = content.toLowerCase();
  const length = content.length;
  const available: string[] = [];

  if (GOOGLE_API_KEY) {
    available.push('googleai/gemini-1.5-flash'); // Updated to a common Gemini model
    // available.push('googleai/gemini-pro'); // Keep if needed
  }
  if (OPENAI_API_KEY) {
    available.push('openai/gpt-4o', 'openai/gpt-3.5-turbo');
  }
  if (ANTHROPIC_API_KEY) {
    available.push('anthropic/claude-3-5-sonnet-20240620', 'anthropic/claude-3-opus-20240229'); // Updated model name
  }

  if (!available.length) {
    console.error('[AI] No models available: defaulting to gemini-1.5-flash');
    return 'googleai/gemini-1.5-flash';
  }

   // Graphic Design -> GPT-4o (if available)
   const graphicKeywords = ['graphic design', 'visual critique', 'logo', 'illustration', 'branding', 'ui/ux', 'palette', 'typography'];
   if (graphicKeywords.some(k => text.includes(k)) && available.includes('openai/gpt-4o')) {
     return 'openai/gpt-4o';
   }

  // Technical or code-related -> GPT-4o (if available)
  const codeKeywords = ['```', 'function', 'class ', 'interface', 'api', 'typescript', 'python', 'react', 'node.js', 'sql', 'bug', 'error', 'debug'];
  if (codeKeywords.some(k => text.includes(k)) && available.includes('openai/gpt-4o')) {
    return 'openai/gpt-4o';
  }

  // Long/complex tasks or detailed analysis -> Claude Opus (if available)
  if ((length > 1500 || text.includes('analysis') || text.includes('summarize') || text.includes('report') || text.includes('complex problem'))
      && available.includes('anthropic/claude-3-opus-20240229')) {
    return 'anthropic/claude-3-opus-20240229';
  }
    // General purpose / Balanced -> Claude Sonnet (if available)
    if (available.includes('anthropic/claude-3-5-sonnet-20240620')) {
        return 'anthropic/claude-3-5-sonnet-20240620';
    }

  // Creative copy -> GPT-4o (if available)
  const creativeKeywords = ['story', 'creative', 'marketing', 'ad copy', 'poem', 'blog post', 'social media'];
  if (creativeKeywords.some(k => text.includes(k)) && available.includes('openai/gpt-4o')) {
    return 'openai/gpt-4o';
  }

  // Short Q&A / Fast response needed -> Gemini Flash (if available)
  if (length < 300 && available.includes('googleai/gemini-1.5-flash')) {
    return 'googleai/gemini-1.5-flash';
  }

  // Fallback to fastest/cheapest generally available model
  return available.includes('googleai/gemini-1.5-flash')
    ? 'googleai/gemini-1.5-flash'
    : available[0]; // Default to the first available model
}

/**
 * Raw AI call helper: selects model (if not overridden), invokes AI, and returns text.
 * This function SHOULD NOT be marked with 'use server' because it's called by server-side flows.
 * @param prompt The text prompt to send.
 * @param modelOverride Optional explicit model to use.
 * @returns AI-generated text response.
 */
export async function callAI(
  promptText: string,
  modelOverride?: string
): Promise<string> {
  const modelId = modelOverride ?? await chooseModelBasedOnPrompt(promptText);
  console.log(`[AI Call] Using model: ${modelId} for prompt: "${promptText.substring(0, 50)}..."`);

  try {
    const { text } = await ai.generate({ model: modelId, prompt: promptText });
    if (!text) {
        throw new Error("AI returned an empty response.");
    }
    return text;
  } catch (error: any) {
    console.error(`[AI Call Error] Model ${modelId} failed:`, error.message);
    // Consider a more robust fallback or error propagation strategy
    return `Error generating response with ${modelId}: ${error.message}`;
  }
}


// --- Prompt Definitions ---
// These definitions themselves are okay here, as they are just configurations
// They are only *used* within the 'use server' flows.

/**
 * Decompose a project brief into ordered microtasks (markdown checklist).
 */
export const projectDecompositionPrompt = ai.definePrompt({
  name: 'projectDecomposition',
  input: { schema: z.object({ brief: z.string() }) },
  output: { schema: z.string().describe('Markdown checklist of microtasks') },
  prompt: ({ brief }) => [{ text: `You are an expert AI project manager. Decompose this brief into clear, ordered microtasks (markdown):

${brief}` }],
});

/**
 * Generate a realistic freelance project idea (strict JSON output).
 */
export const generateProjectIdeaPrompt = ai.definePrompt({
  name: 'generateProjectIdea',
  input: { schema: z.object({ industryHint: z.string().optional() }) },
  output: {
    schema: z.object({
      idea: z.string().min(1, 'Idea cannot be empty.'),
      details: z.string().optional(), // Make details optional for robustness
      estimatedTimeline: z.string().min(1, 'Timeline cannot be empty.'),
      estimatedHours: z.number().positive('Estimated hours must be a positive number.'),
      requiredSkills: z.array(z.string().min(1)).min(1, "At least one skill required").max(5, "Max 5 skills"),
    }),
  },
  prompt: ({ industryHint }) => `
Generate a single, valid JSON object representing a freelance project idea.

STRICTLY adhere to this JSON structure:
{
  "idea": "Short, catchy project title (string, min 1 char)",
  "details": "Detailed description of the project (string, optional)",
  "estimatedTimeline": "Realistic timeline (string, e.g., '3-5 days', min 1 char)",
  "estimatedHours": "Positive integer number of hours (number, > 0)",
  "requiredSkills": ["Array of 1-5 relevant skill strings (string[], min 1 item, max 5 items)"]
}

${industryHint ? `Industry Hint: Focus on projects related to '${industryHint}'.` : ''}

CRITICAL: Ensure 'estimatedHours' is a positive integer. Ensure 'requiredSkills' has between 1 and 5 strings.
Return ONLY the valid JSON object. No introductory text, no explanations, no markdown formatting. Use sensible defaults if unsure, but include all keys.
`,
});


/**
 * Match freelancers to a project brief (structured AI flow definition).
 */
export const matchFreelancerPrompt = ai.definePrompt({
  name: 'matchFreelancers',
  input: {
    schema: z.object({ projectBrief: z.string(), freelancerId: z.string().optional() }),
  },
  output: { schema: z.string().describe('AI matching reasoning and JSON details') },
  prompt: ({ projectBrief, freelancerId }) => [{ text: `Match this project brief to an ideal freelancer. Brief: ${projectBrief}` +
    (freelancerId ? `
Client ID: ${freelancerId}` : '') }],
});

// Note: Fine-tuning logic (getUserFineTunedModel, triggerFineTuningJob) is removed
// as it's complex and requires significant infrastructure beyond basic API calls.
// It would typically involve dedicated services and asynchronous job handling.
