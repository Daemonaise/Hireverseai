'use server';

import { ai } from '@/lib/ai';
import {
  TranslateUiStringsInputSchema,
  TranslateUiStringsOutputSchema,
} from '@/ai/schemas/translate-ui-strings-schema';

const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  ru: 'Russian',
};

export const translateUiStrings = ai.defineFlow(
  {
    name: 'translateUiStrings',
    inputSchema: TranslateUiStringsInputSchema,
    outputSchema: TranslateUiStringsOutputSchema,
  },
  async (input) => {
    const targetName = LOCALE_NAMES[input.targetLocale] || input.targetLocale;
    const jsonStr = JSON.stringify(input.sourceStrings, null, 2);

    const { text } = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt: `Translate the following JSON object of UI strings from English to ${targetName}.
Rules:
- Preserve all JSON keys exactly as-is
- Translate only the string values
- Keep placeholders like {provider}, {date}, {count} unchanged
- Keep technical terms (API, OAuth, Firestore, etc.) unchanged
- Return valid JSON only, no markdown fencing

${jsonStr}`,
    });

    try {
      const translatedStrings = JSON.parse(text.trim());
      return { translatedStrings };
    } catch {
      return { translatedStrings: {} };
    }
  }
);
