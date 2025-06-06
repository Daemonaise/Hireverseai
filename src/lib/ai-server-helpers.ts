'use server'; // This function accesses environment variables at runtime

/**
 * Chooses an AI model based on the prompt's content and API key availability.
 * This function reads environment variables at runtime. Needs 'use server'.
 */
export async function chooseModelBasedOnPrompt(promptContent: string): Promise<string> {
  // Re-evaluate API keys at runtime inside the function
  const GOOGLE_API_KEY    = process.env.GOOGLE_API_KEY;
  const OPENAI_API_KEY    = process.env.OPENAI_API_KEY;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  const promptLength = promptContent.length;
  const promptLower = promptContent.toLowerCase();
  const availableModels: string[] = [];

  // Updated model identifiers with provider prefix - Using stable Anthropic IDs
   const allModels = {
      googleFast: 'google/gemini-1.5-flash',
      googlePro: 'google/gemini-1.5-pro',
      openaiMini: 'openai/gpt-4o-mini',
      openaiFull: 'openai/gpt-4o',
      anthropicHaiku: 'anthropic/claude-3-haiku',      // Stable ID
      anthropicSonnet: 'anthropic/claude-3-sonnet',     // Stable ID
      anthropicOpus: 'anthropic/claude-3-opus'        // Stable ID
   };

  // Populate availableModels based on which keys are present *at call time*
  if (GOOGLE_API_KEY)    availableModels.push(allModels.googleFast, allModels.googlePro);
  if (OPENAI_API_KEY)    availableModels.push(allModels.openaiMini, allModels.openaiFull);
  if (ANTHROPIC_API_KEY) availableModels.push(allModels.anthropicHaiku, allModels.anthropicSonnet, allModels.anthropicOpus);

  if (availableModels.length === 0) {
    console.error('[AI Model Selection] No models available due to missing API keys.');
    return allModels.googleFast; // Default fallback
  }

  // Specific routing for coding/development to OpenAI o3 mini (gpt-4o-mini)
  if ( (promptLower.includes('code') || promptLower.includes('```') || promptLower.includes('debug') || promptLower.includes('development') || promptLower.includes('software') || promptLower.includes('scripting')) && availableModels.includes(allModels.openaiMini) ) {
     console.log("[AI Model Selection] Choosing gpt-4o-mini for coding/dev task.");
     return allModels.openaiMini;
  }

  // Prioritize specific models based on keywords if available
  if ( (promptLower.includes('graphic design') || promptLower.includes('visual critique')) && availableModels.includes(allModels.openaiFull) ) { // Use full gpt-4o for visual tasks
    console.log("[AI Model Selection] Choosing gpt-4o for graphic design.");
    return allModels.openaiFull;
  }
   // Use Opus for deep analysis
   if ( (promptLength > 1500 || promptLower.includes('analysis') || promptLower.includes('report')) && availableModels.includes(allModels.anthropicOpus) ) {
    console.log(`[AI Model Selection] Choosing ${allModels.anthropicOpus} for long/analysis task.`);
    return allModels.anthropicOpus;
  }
  // Use Sonnet for creative tasks or long context
  if ( (promptLower.includes('creative') || promptLower.includes('story') || promptLower.includes('marketing') || promptLength > 1500) && availableModels.includes(allModels.anthropicSonnet) ) {
      console.log(`[AI Model Selection] Choosing ${allModels.anthropicSonnet} for creative/long task.`);
      return allModels.anthropicSonnet;
  }
  // Use Gemini Pro for high-quality reasoning if not Opus or Sonnet
  if ( (promptLower.includes('reasoning') || promptLower.includes('complex problem')) && availableModels.includes(allModels.googlePro) ) {
      console.log(`[AI Model Selection] Choosing ${allModels.googlePro} for reasoning task.`);
      return allModels.googlePro;
  }


  // Fallback logic - Prioritize cost-effective models

  // Default general model: Sonnet
  if (availableModels.includes(allModels.anthropicSonnet)) {
    console.log(`[AI Model Selection] Defaulting to ${allModels.anthropicSonnet}.`);
    return allModels.anthropicSonnet;
  }
  // Next fallback: Gemini Flash
  if (availableModels.includes(allModels.googleFast)) {
    console.log(`[AI Model Selection] Fallback to ${allModels.googleFast}.`);
    return allModels.googleFast;
  }
  // Next fallback: GPT-4o Mini
  if (availableModels.includes(allModels.openaiMini)) {
    console.log(`[AI Model Selection] Fallback to ${allModels.openaiMini}.`);
    return allModels.openaiMini;
  }
  // Next fallback: Anthropic Haiku
  if (availableModels.includes(allModels.anthropicHaiku)) {
    console.log(`[AI Model Selection] Fallback to ${allModels.anthropicHaiku}.`);
    return allModels.anthropicHaiku;
  }


  // If somehow none of the specific fallbacks match, return the first available
  console.warn("[AI Model Selection] No specific model match or preferred fallback found, returning first available:", availableModels[0]);
  return availableModels[0];
}
