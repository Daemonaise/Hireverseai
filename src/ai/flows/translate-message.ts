'use server';

import { ai } from '@/lib/ai';
import {
  TranslateMessageInputSchema,
  TranslateMessageOutputSchema,
} from '@/ai/schemas/translate-message-schema';

const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  ru: 'Russian',
};

export const translateMessage = ai.defineFlow(
  {
    name: 'translateMessage',
    inputSchema: TranslateMessageInputSchema,
    outputSchema: TranslateMessageOutputSchema,
  },
  async (input) => {
    const sourceName = LOCALE_NAMES[input.sourceLocale] || input.sourceLocale;
    const targetName = LOCALE_NAMES[input.targetLocale] || input.targetLocale;

    const { text: translatedText } = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt: `Translate the following message from ${sourceName} to ${targetName}.
Preserve the original tone, formatting, and any technical terms.
Return ONLY the translated text, nothing else.

Message:
${input.text}`,
    });

    return { translatedText: translatedText.trim() };
  }
);
