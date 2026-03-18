import { z } from 'zod';

export const TranslateMessageInputSchema = z.object({
  text: z.string().describe('The message text to translate'),
  sourceLocale: z.string().describe('Source language code (en, es, ru)'),
  targetLocale: z.string().describe('Target language code (en, es, ru)'),
});

export const TranslateMessageOutputSchema = z.object({
  translatedText: z.string().describe('The translated message text'),
});

export type TranslateMessageInput = z.infer<typeof TranslateMessageInputSchema>;
export type TranslateMessageOutput = z.infer<typeof TranslateMessageOutputSchema>;
