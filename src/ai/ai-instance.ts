import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { openAI } from 'genkitx-openai';
import { anthropic } from 'genkitx-anthropic';
import { z } from 'zod';

const GOOGLE_API_KEY    = process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const plugins = [];
if (GOOGLE_API_KEY)    plugins.push(googleAI({ apiKey: GOOGLE_API_KEY }));
if (OPENAI_API_KEY)    plugins.push(openAI({ apiKey: OPENAI_API_KEY }));
if (ANTHROPIC_API_KEY) plugins.push(anthropic({ apiKey: ANTHROPIC_API_KEY }));
if (!plugins.length) console.error('[AI] No API keys found: all AI calls will fail');

export const ai = genkit({
  promptDir: './prompts',
  plugins,
});

export async function chooseModelBasedOnPrompt(content: string): Promise<string> {
  const text = content.toLowerCase();
  const length = content.length;
  const available: string[] = [];

  if (GOOGLE_API_KEY)    available.push('googleai/gemini-1.5-flash');
  if (OPENAI_API_KEY)    available.push('openai/gpt-4o', 'openai/gpt-3.5-turbo');
  if (ANTHROPIC_API_KEY) available.push('anthropic/claude-3-5-sonnet-20240620', 'anthropic/claude-3-opus-20240229');
  if (!available.length) {
    console.error('[AI] No models available: defaulting to gemini-1.5-flash');
    return 'googleai/gemini-1.5-flash';
  }

  const graphicKeywords = ['graphic design','visual critique','logo','illustration','branding','ui/ux','palette','typography'];
  if (graphicKeywords.some(k => text.includes(k)) && available.includes('openai/gpt-4o')) {
    return 'openai/gpt-4o';
  }

  const codeKeywords = ['```','function','class ','interface','api','typescript','python','react','node.js','sql','bug','error','debug'];
  if (codeKeywords.some(k => text.includes(k)) && available.includes('openai/gpt-4o')) {
    return 'openai/gpt-4o';
  }

  if ((length > 1500 || text.includes('analysis') || text.includes('summarize') || text.includes('report') || text.includes('complex problem'))
      && available.includes('anthropic/claude-3-opus-20240229')) {
    return 'anthropic/claude-3-opus-20240229';
  }

  if (available.includes('anthropic/claude-3-5-sonnet-20240620')) {
    return 'anthropic/claude-3-5-sonnet-20240620';
  }

  const creativeKeywords = ['story','creative','marketing','ad copy','poem','blog post','social media'];
  if (creativeKeywords.some(k => text.includes(k)) && available.includes('openai/gpt-4o')) {
    return 'openai/gpt-4o';
  }

  if (length < 300 && available.includes('googleai/gemini-1.5-flash')) {
    return 'googleai/gemini-1.5-flash';
  }

  return available.includes('googleai/gemini-1.5-flash')
    ? 'googleai/gemini-1.5-flash'
    : available[0];
}

export async function callAI(promptText: string, modelOverride?: string): Promise<string> {
  const modelId = modelOverride ?? await chooseModelBasedOnPrompt(promptText);
  console.log(`[AI Call] Using model: ${modelId}`);
  try {
    const { text } = await ai.generate({ model: modelId, prompt: promptText });
    if (!text) throw new Error('AI returned empty response');
    return text;
  } catch (err: any) {
    console.error(`[AI Call Error] ${err.message}`);
    return `Error: ${err.message}`;
  }
}

export const projectDecompositionPrompt = ai.definePrompt({
  name: 'projectDecomposition',
  input:  { schema: z.object({ brief: z.string() }) },
  output: { schema: z.string().describe('Markdown checklist') },
  prompt: ({ brief }) => [{
    text: `You are an expert AI project manager. Decompose this brief into clear, ordered microtasks (markdown):

${brief}`
  }],
});

export const generateProjectIdeaPrompt = ai.definePrompt({
  name: 'generateProjectIdea',
  input:  { schema: z.object({ industryHint: z.string().optional() }) },
  output: {
    schema: z.object({
      idea:             z.string().min(1),
      details:          z.string().optional(),
      estimatedTimeline:z.string().min(1),
      estimatedHours:   z.number().positive(),
      requiredSkills:   z.array(z.string()).min(1).max(5),
    })
  },
  prompt: ({ industryHint }) => [{
    text: `Generate a single, valid JSON object representing a freelance project idea.

STRICTLY adhere to this structure:
{
  "idea": "Short, catchy project title",
  "details": "Detailed description (optional)",
  "estimatedTimeline": "e.g., '3-5 days'",
  "estimatedHours": positive integer,
  "requiredSkills": ["1-5 relevant skills"]
}
${industryHint ? `Industry Hint: Focus on '${industryHint}'.` : ''}
Return ONLY the JSON. No markdown or explanations.`
  }],
});

export const matchFreelancerPrompt = ai.definePrompt({
  name: 'matchFreelancers',
  input:  { schema: z.object({ projectBrief: z.string(), freelancerId: z.string().optional() }) },
  output: { schema: z.string().describe('Matching JSON and reasoning') },
  prompt: ({ projectBrief, freelancerId }) => [{
    text: `Match this project brief to an ideal freelancer. Brief: ${projectBrief}` +
          (freelancerId ? `\nClient ID: ${freelancerId}` : '')
  }],
});
