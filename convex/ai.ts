import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { getUserByTokenIdentifier } from "./users";

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
 */
async function getOrganizationAISettings(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
  if (!user || !user.organizationId) throw new Error("User not found");

  const org = await ctx.runQuery(api.organizations.get, {
    organizationId: user.organizationId,
  });

  return {
    provider: (org?.aiProvider as "anthropic" | "openai") || "anthropic",
    model:
      org?.aiProvider === "anthropic"
        ? org?.anthropicModel || "claude-sonnet-4-5-20250929"
        : org?.openaiModel || "gpt-4o",
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
 * Helper: Call AI API (supports both Anthropic and OpenAI)
 */
async function callAI(
  messages: Array<{ role: string; content: string }>,
  provider: "anthropic" | "openai",
  model: string
): Promise<string> {
  if (provider === "anthropic") {
    return await callAnthropic(messages, model);
  } else {
    return await callOpenAI(messages, model);
  }
}

/**
 * Helper: Call Anthropic API
 */
async function callAnthropic(
  messages: Array<{ role: string; content: string }>,
  model: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  // Convert OpenAI-style messages to Anthropic format
  const systemMessage = messages.find((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemMessage?.content,
      messages: conversationMessages,
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
 * Helper: Call OpenAI API
 */
async function callOpenAI(
  messages: Array<{ role: string; content: string }>,
  model: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
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
    throw new Error(`OpenAI API error: ${response.statusText} - ${error}`);
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
  provider: string,
  model: string
) {
  try {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user || !user.organizationId) return;

    await ctx.runMutation(api.aiRequests.create, {
      userId: user._id,
      organizationId: user.organizationId,
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

    // Get AI settings
    const aiSettings = await getOrganizationAISettings(ctx);

    // Get current script content for context
    const script = await ctx.runQuery(api.scripts.get, { scriptId: args.scriptId });
    const scriptContent = script?.content ? JSON.parse(script.content) : null;

    // TODO: Import exportToPlainText from lib/tiptap/export
    // For now, use simple extraction
    const plainText = scriptContent ? JSON.stringify(scriptContent) : "";

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

    // Call AI with user's preferred provider
    const response = await callAI(messages, aiSettings.provider, aiSettings.model);

    // Track usage
    await trackAIRequest(ctx, args.scriptId, "chat", aiSettings.provider, aiSettings.model);

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
    const aiSettings = await getOrganizationAISettings(ctx);

    // Get script content
    const script = await ctx.runQuery(api.scripts.get, { scriptId: args.scriptId });
    const scriptContent = script?.content ? JSON.parse(script.content) : null;
    const textToCheck = args.selectedText || JSON.stringify(scriptContent);

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

    const response = await callAI(messages, aiSettings.provider, aiSettings.model);

    // Track usage
    await trackAIRequest(ctx, args.scriptId, "grammar", aiSettings.provider, aiSettings.model);

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
    const aiSettings = await getOrganizationAISettings(ctx);

    const script = await ctx.runQuery(api.scripts.get, { scriptId: args.scriptId });
    const scriptContent = script?.content ? JSON.parse(script.content) : null;
    const plainText = JSON.stringify(scriptContent);

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

    const response = await callAI(messages, aiSettings.provider, aiSettings.model);

    // Track usage
    await trackAIRequest(ctx, args.scriptId, "review", aiSettings.provider, aiSettings.model);

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
  },
  handler: async (ctx, args) => {
    const brandGuidelines = await getBrandGuidelinesForUser(ctx);
    const aiSettings = await getOrganizationAISettings(ctx);

    const script = await ctx.runQuery(api.scripts.get, { scriptId: args.scriptId });
    const scriptContent = script?.content ? JSON.parse(script.content) : null;
    const plainText = JSON.stringify(scriptContent);

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

    const response = await callAI(messages, aiSettings.provider, aiSettings.model);

    // Track usage
    await trackAIRequest(ctx, args.scriptId, "generation", aiSettings.provider, aiSettings.model);

    return { generatedContent: response };
  },
});
