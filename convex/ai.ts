import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { decryptApiKey } from "./lib/byokCrypto";
import { assertSafeCustomBaseUrl } from "./lib/baseUrlValidation";
import { parseAIJson } from "./lib/parseAIJson";

/**
 * Shape the grammar-check prompt asks the model to return.
 *
 * The quote fields are optional on purpose: rule 6 of the prompt lets the model
 * omit originalText when it cannot point at a specific span, and those issues
 * are kept as unanchored general notes rather than being dropped or given a
 * hallucinated anchor.
 */
interface GrammarCheckPayload {
  issues?: Array<{
    type: "grammar" | "spelling" | "style" | "tone" | "clarity";
    originalText?: string;
    occurrence?: number;
    contextBefore?: string;
    contextAfter?: string;
    message: string;
    suggestion: string;
    severity: "low" | "medium" | "high";
  }>;
  overallScore?: number;
  summary?: string;
}

/** Shape the script-review prompt asks the model to return. */
interface ScriptReviewPayload {
  overallScore?: number;
  strengths?: string[];
  improvements?: string[];
  suggestions?: Array<{
    chapter: string;
    suggestion: string;
    priority: "low" | "medium" | "high";
  }>;
  toneCompliance?: { score: number; notes: string };
  pacing?: { score: number; notes: string };
  clarity?: { score: number; notes: string };
}

/**
 * Helper: Parse a structured AI response or throw.
 *
 * Throwing matters: the previous code returned a truthy `{error, rawResponse}`
 * object, which the client spread into `issues || []` and rendered as a
 * successful "No issues found" panel. Callers rely on try/catch → toast.error.
 */
function parseAIResponseOrThrow<T>(response: string, label: string): T {
  const parsed = parseAIJson<T>(response);
  if (!parsed.ok) {
    throw new Error(
      parsed.reason === "truncated"
        ? `The AI response for ${label} was cut off before it finished. Try again, or use a shorter selection.`
        : `The AI returned an unreadable ${label} response (${parsed.reason}). Please try again.`
    );
  }
  return parsed.data;
}

/**
 * Helper: Extract plain text from Tiptap JSONContent (server-side version)
 * Simplified version of exportToPlainText for use in Convex actions
 */
function extractPlainText(content: any): string {
  if (!content) return "";

  const lines: string[] = [];

  function extractText(node: any): void {
    // Handle text nodes
    if (node.type === "text" && node.text) {
      return; // Text is collected via getTextContent
    }

    // Handle different block types
    switch (node.type) {
      case "doc":
        node.content?.forEach(extractText);
        break;

      case "chapter":
        if (node.attrs?.title) {
          lines.push("");
          lines.push(`[${node.attrs.title.toUpperCase()}]`);
          if (node.attrs.duration) {
            lines.push(`(${node.attrs.duration})`);
          }
          lines.push("");
        }
        node.content?.forEach(extractText);
        break;

      case "screenRecording":
        lines.push("");
        lines.push("[SCREEN RECORDING]");
        const screenText = getTextContent(node);
        if (screenText) {
          lines.push(screenText);
        }
        lines.push("");
        break;

      case "demonstration":
        lines.push("");
        lines.push("[DEMONSTRATION]");
        const demoText = getTextContent(node);
        if (demoText) {
          lines.push(demoText);
        }
        lines.push("");
        break;

      case "paragraph":
        const text = getTextContent(node);
        if (text) {
          lines.push(text);
        }
        break;

      case "heading":
        const headingText = getTextContent(node);
        if (headingText) {
          lines.push("");
          lines.push(headingText.toUpperCase());
          lines.push("");
        }
        break;

      case "bulletList":
      case "orderedList":
        node.content?.forEach((item: any, index: number) => {
          const itemText = getTextContent(item);
          if (itemText) {
            const prefix = node.type === "orderedList" ? `${index + 1}. ` : "• ";
            lines.push(prefix + itemText);
          }
        });
        break;

      case "listItem":
        node.content?.forEach(extractText);
        break;

      case "blockquote":
        const quoteText = getTextContent(node);
        if (quoteText) {
          lines.push(`"${quoteText}"`);
        }
        break;

      case "hardBreak":
        lines.push("");
        break;

      default:
        // Recursively process unknown nodes
        node.content?.forEach(extractText);
    }
  }

  function getTextContent(node: any): string {
    if (node.type === "text" && node.text) {
      return node.text;
    }

    if (node.content) {
      return node.content.map(getTextContent).join("");
    }

    return "";
  }

  extractText(content);

  // Clean up: remove excessive blank lines
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Helper: Get brand guidelines for user's organization
 */
async function getBrandGuidelinesForUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const guideline = await ctx.runQuery(api.brandGuidelines.getActive);
  return guideline?.content || null;
}

interface EffectiveAIConfig {
  provider: "openrouter" | "openai" | "anthropic" | "custom";
  baseUrl?: string;
  apiKey: string;
  model: string;
  source: "user" | "org" | "platform";
}

/**
 * Helper: Resolve which AI provider + key + model to use for this request.
 * Resolution order: personal BYOK config → org BYOK config → platform
 * OpenRouter key (preserves pre-BYOK behavior exactly).
 */
async function resolveAIConfig(ctx: any): Promise<EffectiveAIConfig> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const config = await ctx.runQuery(internal.aiProviders.resolveEffectiveConfig, {
    tokenIdentifier: identity.tokenIdentifier,
  });
  if (!config) throw new Error("User not found");

  if (config.source === "platform") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");
    return {
      provider: "openrouter",
      apiKey,
      model: config.model,
      source: "platform",
    };
  }

  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    apiKey: await decryptApiKey(config.encryptedKey),
    model: config.model,
    source: config.source,
  };
}

/**
 * Helper: Build system prompt with brand guidelines
 */
function buildSystemPrompt(brandGuidelines: string | null, task: string): string {
  let prompt = `You are a professional writing assistant for video tutorial scripts. ${task}\n\n`;

  if (brandGuidelines) {
    prompt += `BRAND GUIDELINES:\n${brandGuidelines}\n\n`;
    prompt += `Always follow these brand guidelines in your suggestions.\n\n`;
  }

  return prompt;
}

/**
 * Helper: Call the Anthropic Messages API (not OpenAI-compatible).
 * Leading system messages are extracted into the top-level `system` field.
 */
async function callAnthropic(
  config: EffectiveAIConfig,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const systemParts: string[] = [];
  const chatMessages = [...messages];
  while (chatMessages.length > 0 && chatMessages[0].role === "system") {
    systemParts.push(chatMessages.shift()!.content);
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      ...(systemParts.length > 0 ? { system: systemParts.join("\n\n") } : {}),
      messages: chatMessages,
      // No `temperature`/`top_p`/`top_k`: current Anthropic models (Opus 4.8,
      // Opus 4.7, Sonnet 5, Fable 5) reject sampling parameters with a 400.
      // The model field is free text in BYOK settings, so any hardcoded
      // sampling parameter breaks every AI call the moment someone selects a
      // current model. Steer tone via the system prompt instead.
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.statusText} - ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

/**
 * Helper: Call the resolved AI provider with an OpenAI-shaped message list.
 * OpenRouter, OpenAI, and custom endpoints share the chat-completions shape;
 * Anthropic is dispatched to its native Messages API.
 */
async function callAI(
  config: EffectiveAIConfig,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  if (config.provider === "anthropic") {
    return callAnthropic(config, messages);
  }

  let url: string;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  switch (config.provider) {
    case "openrouter":
      url = "https://openrouter.ai/api/v1/chat/completions";
      headers["HTTP-Referer"] =
        process.env.OPENROUTER_HTTP_REFERER || "https://takescript.app";
      headers["X-Title"] = process.env.OPENROUTER_APP_NAME || "TakeScript";
      break;
    case "openai":
      url = "https://api.openai.com/v1/chat/completions";
      break;
    case "custom":
      if (!config.baseUrl) throw new Error("Custom provider base URL not configured");
      // Re-check at request time — stored configs must never reach internal hosts
      assertSafeCustomBaseUrl(config.baseUrl);
      url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
      break;
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    // Custom endpoints must not follow redirects (SSRF guard); their error
    // bodies are also never echoed back to clients.
    ...(config.provider === "custom" ? { redirect: "manual" as const } : {}),
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    if (config.provider === "custom") {
      throw new Error(`AI provider error (custom): ${response.status} ${response.statusText}`);
    }
    const error = await response.text();
    throw new Error(`AI provider error (${config.provider}): ${response.statusText} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Helper: Track AI request for analytics
 */
async function trackAIRequest(
  ctx: any,
  scriptId: string | undefined,
  requestType: string,
  model: string,
  provider: string
) {
  try {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const user = await ctx.runQuery(internal.users.getByToken, {
      tokenIdentifier: identity.tokenIdentifier
    });
    if (!user || !user.organizationId) return;

    await ctx.runMutation(api.aiRequests.create, {
      scriptId,
      requestType,
      provider,
      model,
    });
  } catch (error) {
    // Don't fail the request if tracking fails
    console.error("Failed to track AI request:", error);
  }
}

/**
 * AI Chat - Context-aware conversation with brand guidelines
 */
export const chat = action({
  args: {
    scriptId: v.id("scripts"),
    message: v.string(),
    conversationHistory: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Get brand guidelines
    const brandGuidelines = await getBrandGuidelinesForUser(ctx);

    // Resolve provider config (personal → org → platform)
    const config = await resolveAIConfig(ctx);

    // Get current script content for context
    const script = await ctx.runQuery(api.scripts.get, { scriptId: args.scriptId });
    const scriptContent = script?.content ? JSON.parse(script.content) : null;

    // Extract plain text from Tiptap JSONContent
    const plainText = scriptContent ? extractPlainText(scriptContent) : "";

    // Build context-aware prompt
    const systemPrompt = buildSystemPrompt(
      brandGuidelines,
      "Help the user write better tutorial scripts by providing suggestions, improvements, and guidance."
    );

    const contextPrompt = plainText
      ? `\n\nCURRENT SCRIPT CONTENT:\n${plainText.slice(0, 4000)}\n\n`
      : "";

    // Prepare messages
    const messages = [
      { role: "system", content: systemPrompt + contextPrompt },
      ...args.conversationHistory,
      { role: "user", content: args.message },
    ];

    const response = await callAI(config, messages);

    // Track usage
    await trackAIRequest(ctx, args.scriptId, "chat", config.model, config.provider);

    return { response };
  },
});

/**
 * Grammar & Style Check - Analyze text for issues
 */
export const checkGrammarAndStyle = action({
  args: {
    scriptId: v.id("scripts"),
    selectedText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const brandGuidelines = await getBrandGuidelinesForUser(ctx);
    const config = await resolveAIConfig(ctx);

    // Get script content
    const script = await ctx.runQuery(api.scripts.get, { scriptId: args.scriptId });
    const scriptContent = script?.content ? JSON.parse(script.content) : null;
    const textToCheck = args.selectedText || (scriptContent ? extractPlainText(scriptContent) : "");

    const systemPrompt = buildSystemPrompt(
      brandGuidelines,
      "Analyze the text for grammar, spelling, style, tone, and clarity issues."
    );

    const prompt = `Return ONLY a JSON object. No markdown fences, no prose.
{
  "issues": [{
    "type": "grammar"|"spelling"|"style"|"tone"|"clarity",
    "originalText": "EXACT verbatim substring copied character-for-character from the text below",
    "occurrence": 1,
    "contextBefore": "up to 40 chars immediately preceding originalText, verbatim",
    "contextAfter":  "up to 40 chars immediately following originalText, verbatim",
    "message": "what is wrong, one sentence",
    "suggestion": "replacement text for originalText, or \\"\\" if advice only",
    "severity": "low"|"medium"|"high"
  }],
  "overallScore": 1-10,
  "summary": "brief overall assessment"
}

RULES FOR originalText — strict:
1. Copy EXACTLY. Do not fix, normalize, re-case, or re-punctuate it.
2. Between 3 and 200 characters. Prefer the shortest span containing the issue.
3. It must NOT span a line break.
4. Quote ONLY from ordinary prose. Never quote a line in [SQUARE BRACKETS], an ALL-CAPS
   heading, a "(00:45)" duration line, or the "• "/"1. " prefix of a list item.
5. "occurrence" is 1-based: if originalText appears 3 times and you mean the 2nd, set 2.
6. If you cannot point at a specific span, OMIT originalText and give the observation in
   "message". It will be shown as a general note.

TEXT TO ANALYZE:
${textToCheck.slice(0, 8000)}`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ];

    const response = await callAI(config, messages);

    // Track usage
    await trackAIRequest(ctx, args.scriptId, "grammar", config.model, config.provider);

    const parsed = parseAIResponseOrThrow<GrammarCheckPayload>(
      response,
      "grammar check"
    );
    return { ...parsed, model: config.model, provider: config.provider };
  },
});

/**
 * Script Review - Comprehensive analysis
 */
export const reviewScript = action({
  args: { scriptId: v.id("scripts") },
  handler: async (ctx, args) => {
    const brandGuidelines = await getBrandGuidelinesForUser(ctx);
    const config = await resolveAIConfig(ctx);

    const script = await ctx.runQuery(api.scripts.get, { scriptId: args.scriptId });
    const scriptContent = script?.content ? JSON.parse(script.content) : null;
    const plainText = scriptContent ? extractPlainText(scriptContent) : "";

    const systemPrompt = buildSystemPrompt(
      brandGuidelines,
      "Provide comprehensive review of tutorial scripts."
    );

    const prompt = `Provide a comprehensive review of this tutorial script in JSON format:
{
  "overallScore": 1-10,
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["area 1", "area 2"],
  "suggestions": [
    {
      "chapter": "chapter title",
      "suggestion": "specific suggestion",
      "priority": "low" | "medium" | "high"
    }
  ],
  "toneCompliance": {
    "score": 1-10,
    "notes": "assessment of brand voice adherence"
  },
  "pacing": {
    "score": 1-10,
    "notes": "assessment of tutorial pacing"
  },
  "clarity": {
    "score": 1-10,
    "notes": "assessment of clarity and accessibility"
  }
}

SCRIPT CONTENT:
${plainText.slice(0, 8000)}`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ];

    const response = await callAI(config, messages);

    // Track usage
    await trackAIRequest(ctx, args.scriptId, "review", config.model, config.provider);

    const parsed = parseAIResponseOrThrow<ScriptReviewPayload>(
      response,
      "script review"
    );
    return { ...parsed, model: config.model, provider: config.provider };
  },
});

/**
 * Content Generation - Generate, expand, or rephrase content
 */
export const generateContent = action({
  args: {
    scriptId: v.id("scripts"),
    prompt: v.string(),
    task: v.string(), // "expand" | "rephrase" | "generate" | "summarize"
    context: v.optional(v.string()),
    model: v.optional(v.string()), // Optional model override (OpenRouter model ID)
  },
  handler: async (ctx, args) => {
    const brandGuidelines = await getBrandGuidelinesForUser(ctx);
    const resolved = await resolveAIConfig(ctx);

    // Override with user-selected model if provided (OpenRouter model picker)
    const config = args.model ? { ...resolved, model: args.model } : resolved;

    const script = await ctx.runQuery(api.scripts.get, { scriptId: args.scriptId });
    const scriptContent = script?.content ? JSON.parse(script.content) : null;
    const plainText = scriptContent ? extractPlainText(scriptContent) : "";

    const systemPrompt = buildSystemPrompt(
      brandGuidelines,
      `Generate tutorial script content. Task: ${args.task}.`
    );

    let taskPrompt = "";
    switch (args.task) {
      case "expand":
        taskPrompt = `Expand this text with more detail and examples:\n\n${args.prompt}`;
        break;
      case "rephrase":
        taskPrompt = `Rephrase this text for better clarity:\n\n${args.prompt}`;
        break;
      case "summarize":
        taskPrompt = `Summarize this text concisely:\n\n${args.prompt}`;
        break;
      case "generate":
        taskPrompt = args.prompt;
        break;
      default:
        taskPrompt = args.prompt;
    }

    const contextPrompt = args.context
      ? `\n\nCONTEXT:\n${args.context}\n\n`
      : plainText
      ? `\n\nCURRENT SCRIPT:\n${plainText.slice(0, 2000)}\n\n`
      : "";

    const messages = [
      { role: "system", content: systemPrompt + contextPrompt },
      { role: "user", content: taskPrompt },
    ];

    const response = await callAI(config, messages);

    // Track usage
    await trackAIRequest(ctx, args.scriptId, "generation", config.model, config.provider);

    return { generatedContent: response };
  },
});
