/**
 * Shared AI model lists for the model picker and BYOK provider settings.
 */

export interface AIModelOption {
  id: string;
  name: string;
  description: string;
}

// Popular OpenRouter models with their full identifiers
export const OPENROUTER_MODELS: AIModelOption[] = [
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet (Recommended)",
    description: "Best balance of speed and intelligence",
  },
  {
    id: "anthropic/claude-opus-4-5",
    name: "Claude Opus 4.5",
    description: "Most capable model, slower",
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    description: "OpenAI's flagship model",
  },
  {
    id: "google/gemini-pro-1.5",
    name: "Gemini Pro 1.5",
    description: "Google's latest model",
  },
  {
    id: "meta-llama/llama-3.1-70b-instruct",
    name: "Llama 3.1 70B",
    description: "Open source, fast",
  },
];

// Suggestions for direct-provider BYOK configs (free-text field + datalist)
export const OPENAI_MODEL_SUGGESTIONS: string[] = ["gpt-4o", "gpt-4o-mini"];

export const ANTHROPIC_MODEL_SUGGESTIONS: string[] = [
  "claude-sonnet-4-5-20250929",
  "claude-3-5-haiku-latest",
];
