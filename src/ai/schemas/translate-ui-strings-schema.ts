import { z } from 'zod';

export const TranslateUiStringsInputSchema = z.object({
  sourceStrings: z.record(z.string()).describe('Flat key-value map of English UI strings'),
  targetLocale: z.string().describe('Target language code (es, ru)'),
});

export const TranslateUiStringsOutputSchema = z.object({
  translatedStrings: z.record(z.string()).describe('Flat key-value map of translated UI strings'),
});

export type TranslateUiStringsInput = z.infer<typeof TranslateUiStringsInputSchema>;
export type TranslateUiStringsOutput = z.infer<typeof TranslateUiStringsOutputSchema>;
