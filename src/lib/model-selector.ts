/**
 * @fileOverview Smart Model Chooser Utility
 * Decides which AI model to use based on prompt characteristics.
 */

export function chooseModelBasedOnPrompt(prompt: string): 'gpt-4o' | 'gemini' | 'claude-3.5' {
    const promptLength = prompt.length;
    const promptLower = prompt.toLowerCase();
  
    if (
      promptLength > 2000 ||
      promptLower.includes('technical') ||
      promptLower.includes('architecture') ||
      promptLower.includes('system design')
    ) {
      return 'claude-3.5';
    }
  
    if (
      promptLower.includes('creative writing') ||
      promptLower.includes('story') ||
      promptLower.includes('ad copy') ||
      promptLower.includes('novel')
    ) {
      return 'gpt-4o';
    }
  
    return 'gemini';
  }
  