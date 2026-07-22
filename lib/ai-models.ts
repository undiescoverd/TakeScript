/**
 * Shared AI model lists for the model picker and BYOK provider settings.
 */

export interface AIModelOption {
  id: string;
  name: string;
  description: string;
}

// Popular OpenRouter models with their full identifiers.
//
// NOTE: OpenRouter namespaces its ids with a provider prefix and uses DOTS in
// Anthropic version numbers (`anthropic/claude-opus-4.8`). The direct Anthropic
// API uses DASHES and no prefix (`claude-opus-4-8`). The two are not
// interchangeable — see ANTHROPIC_MODEL_SUGGESTIONS below.
//
// Verified against https://openrouter.ai/api/v1/models on 2026-07-22. Model ids
// get retired; re-check this list against that endpoint rather than editing
// version numbers by hand.
export const OPENROUTER_MODELS: AIModelOption[] = [
  {
    id: "anthropic/claude-sonnet-5",
    name: "Claude Sonnet 5 (Recommended)",
    description: "Best balance of speed and intelligence",
  },
  {
    id: "anthropic/claude-opus-4.8",
    name: "Claude Opus 4.8",
    description: "Most capable model, slower",
  },
  {
    id: "openai/gpt-5.5",
    name: "GPT-5.5",
    description: "OpenAI's flagship model",
  },
  {
    id: "google/gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    description: "Google's fast model",
  },
  {
    id: "meta-llama/llama-4-maverick",
    name: "Llama 4 Maverick",
    description: "Open source, fast",
  },
];

// Suggestions for direct-provider BYOK configs (free-text field + datalist).
// These are bare provider ids — no OpenRouter prefix.
export const OPENAI_MODEL_SUGGESTIONS: string[] = ["gpt-5.5", "gpt-5.4-mini"];

// Dashed ids, as the Anthropic Messages API expects. Do not add date suffixes
// to these aliases (`claude-opus-4-8`, never `claude-opus-4-8-20260101`) — the
// alias is complete as written and a suffixed variant 404s.
export const ANTHROPIC_MODEL_SUGGESTIONS: string[] = [
  "claude-opus-4-8",
  "claude-sonnet-5",
  "claude-haiku-4-5",
];
