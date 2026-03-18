/**
 * @file Unified Genkit AI configuration
 * This file initializes plugins based on available environment variables.
 */

import { genkit, type GenkitPlugin } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';
import { openAI } from '@genkit-ai/compat-oai/openai';
import { anthropic } from 'genkitx-anthropic';
import { ALL_MODELS } from './ai-models';

// --- Environment Variable Check ---
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// --- Plugin Configuration ---
const plugins: GenkitPlugin[] = [];

if (GOOGLE_CLOUD_PROJECT) {
  plugins.push(vertexAI({ projectId: GOOGLE_CLOUD_PROJECT, location: GOOGLE_CLOUD_LOCATION }));
}
if (OPENAI_API_KEY) plugins.push(openAI());
if (ANTHROPIC_API_KEY) plugins.push(anthropic());

// --- Create Genkit instance ---
export const ai = genkit({ plugins });

// Re-export all models for easy access
export const models = ALL_MODELS;
