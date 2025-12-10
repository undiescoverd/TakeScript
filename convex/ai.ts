import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Helper: Extract plain text from Tiptap JSONContent (server-side version)
 * Simplified version of exportToPlainText for use in Convex actions
 */
function extractPlainText(content: any): string {
  if (!content) return "";

  const lines: string[] = [];

  function extractText(node: any): void {
    // Skip editor notes
    if (node.type === "editorNote") {
      return;
    }

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

/**
 * Helper: Get organization AI settings
 * Returns default settings if user doesn't have an organization yet
 * Currently only supports OpenRouter
 */
async function getDefaultAIModel(ctx: any): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.runQuery(api.users.getByToken, {
    tokenIdentifier: identity.tokenIdentifier
  });
  if (!user) throw new Error("User not found");

  // If user doesn't have an organization, use default model
  if (!user.organizationId) {
    return "anthropic/claude-3.5-sonnet";
  }

  const org = await ctx.runQuery(api.organizations.get, {
    organizationId: user.organizationId,
  });

  // Return organization's preferred OpenRouter model or default
  return org?.openrouterModel || "anthropic/claude-3.5-sonnet";
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
 * Helper: Call OpenRouter API
 * OpenRouter provides unified access to multiple AI models (Anthropic, OpenAI, Google, etc.)
 * Uses OpenAI-compatible API format
 */
async function callOpenRouter(
  messages: Array<{ role: string; content: string }>,
  model: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || "https://takescript.app",
      "X-Title": process.env.OPENROUTER_APP_NAME || "TakeScript",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.statusText} - ${error}`);
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
  model: string
) {
  try {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const user = await ctx.runQuery(api.users.getByToken, {
      tokenIdentifier: identity.tokenIdentifier
    });
    if (!user || !user.organizationId) return;

    await ctx.runMutation(api.aiRequests.create, {
      userId: user._id,
      organizationId: user.organizationId,
      scriptId,
      requestType,
      provider: "openrouter",
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

    // Get default model
    const model = await getDefaultAIModel(ctx);

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

    // Call OpenRouter
    const response = await callOpenRouter(messages, model);

    // Track usage
    await trackAIRequest(ctx, args.scriptId, "chat", model);

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
    const model = await getDefaultAIModel(ctx);

    // Get script content
    const script = await ctx.runQuery(api.scripts.get, { scriptId: args.scriptId });
    const scriptContent = script?.content ? JSON.parse(script.content) : null;
    const textToCheck = args.selectedText || (scriptContent ? extractPlainText(scriptContent) : "");

    const systemPrompt = buildSystemPrompt(
      brandGuidelines,
      "Analyze the text for grammar, spelling, style, tone, and clarity issues."
    );

    const prompt = `Analyze this text and provide structured feedback in JSON format:
{
  "issues": [
    {
      "type": "grammar" | "spelling" | "style" | "tone" | "clarity",
      "message": "Brief description of the issue",
      "suggestion": "Suggested fix",
      "severity": "low" | "medium" | "high"
    }
  ],
  "overallScore": 1-10,
  "summary": "Brief overall assessment"
}

TEXT TO ANALYZE:
${textToCheck.slice(0, 8000)}`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ];

    const response = await callOpenRouter(messages, model);

    // Track usage
    await trackAIRequest(ctx, args.scriptId, "grammar", model);

    try {
      return JSON.parse(response);
    } catch {
      return { error: "Failed to parse AI response", rawResponse: response };
    }
  },
});

/**
 * Script Review - Comprehensive analysis
 */
export const reviewScript = action({
  args: { scriptId: v.id("scripts") },
  handler: async (ctx, args) => {
    const brandGuidelines = await getBrandGuidelinesForUser(ctx);
    const model = await getDefaultAIModel(ctx);

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

    const response = await callOpenRouter(messages, model);

    // Track usage
    await trackAIRequest(ctx, args.scriptId, "review", model);

    try {
      return JSON.parse(response);
    } catch {
      return { error: "Failed to parse AI response", rawResponse: response };
    }
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
    const defaultModel = await getDefaultAIModel(ctx);

    // Override with user-selected model if provided
    const model = args.model || defaultModel;

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

    const response = await callOpenRouter(messages, model);

    // Track usage
    await trackAIRequest(ctx, args.scriptId, "generation", model);

    return { generatedContent: response };
  },
});
