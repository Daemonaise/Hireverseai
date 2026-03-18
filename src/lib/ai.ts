/**
 * @file Unified Genkit AI configuration
 * This file initializes plugins based on available environment variables.
 */

import { genkit, type GenkitPlugin } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { openAI } from '@genkit-ai/compat-oai/openai';
import { anthropic } from 'genkitx-anthropic';
import { ALL_MODELS } from './ai-models'; // Import the centralized models

// --- Environment Variable Check ---
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Keys checked silently — logged only in dev if needed

// --- Plugin Configuration ---
// Initialize an empty array; TypeScript will infer the plugin type.
const plugins: GenkitPlugin[] = [];

if (GOOGLE_API_KEY) plugins.push(googleAI());
if (OPENAI_API_KEY) plugins.push(openAI());
if (ANTHROPIC_API_KEY) plugins.push(anthropic());

// --- Create Genkit instance ---
// This central `ai` instance should be used for all model interactions.
export const ai = genkit({ plugins });

// Re-export all models for easy access from the central AI config
export const models = ALL_MODELS;
