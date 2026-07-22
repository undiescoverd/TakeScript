import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { getUserByTokenIdentifier } from "./users";
import {
  decryptApiKey,
  encryptApiKey,
  KeyDecryptionError,
  maskKey,
} from "./lib/byokCrypto";
import { assertSafeCustomBaseUrl } from "./lib/baseUrlValidation";

const providerValidator = v.union(
  v.literal("openrouter"),
  v.literal("openai"),
  v.literal("anthropic"),
  v.literal("custom")
);

const scopeValidator = v.union(v.literal("org"), v.literal("user"));

// Used only on the platform/OpenRouter path, so this is an OpenRouter id
// (provider-prefixed, dots in the version). Keep in sync with the
// "Recommended" entry in lib/ai-models.ts.
const DEFAULT_PLATFORM_MODEL = "anthropic/claude-sonnet-5";

/**
 * Masked view of a config for the settings UI. Never includes encryptedKey.
 */
function maskConfig(config: {
  provider: string;
  baseUrl?: string;
  model: string;
  keyLast4: string;
}) {
  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    keyLast4: config.keyLast4,
  };
}

async function getOrgConfig(ctx: QueryCtx, organizationId: Id<"organizations">) {
  return await ctx.db
    .query("aiProviderConfigs")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .unique();
}

async function getUserConfig(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("aiProviderConfigs")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

/**
 * Require the current user and check they may manage the given scope.
 * Org scope: owner/admin only. User scope: any authenticated user (self).
 */
async function requireUserForScope(ctx: QueryCtx, scope: "org" | "user") {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
  if (!user) throw new Error("User not found");

  if (scope === "org") {
    if (!user.organizationId) throw new Error("No organization found");
    if (user.role !== "owner" && user.role !== "admin") {
      throw new Error("Only owners and admins can manage the organization AI provider");
    }
  }

  return user;
}

function validateBaseUrl(provider: string, baseUrl: string | undefined) {
  if (provider === "custom") {
    if (!baseUrl) throw new Error("Base URL is required for custom providers");
    assertSafeCustomBaseUrl(baseUrl);
  }
}

/**
 * Masked configs for the settings UI: the caller's personal config, their
 * organization's config, their role, and which source AI calls will use.
 */
export const getMyConfigs = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user) return null;

    const userConfig = await getUserConfig(ctx, user._id);
    const orgConfig = user.organizationId
      ? await getOrgConfig(ctx, user.organizationId)
      : null;

    const effectiveSource: "user" | "org" | "platform" = userConfig
      ? "user"
      : orgConfig
      ? "org"
      : "platform";

    return {
      user: userConfig ? maskConfig(userConfig) : null,
      org: orgConfig ? maskConfig(orgConfig) : null,
      role: user.role ?? "member",
      effectiveSource,
    };
  },
});

/**
 * Save (create or update) a BYOK config. Runs as an action so the API key is
 * encrypted before it ever reaches a mutation. Omitting apiKey keeps the
 * existing stored key (edit model/baseUrl only).
 */
export const saveConfig = action({
  args: {
    scope: scopeValidator,
    provider: providerValidator,
    apiKey: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    validateBaseUrl(args.provider, args.baseUrl);
    if (!args.model.trim()) throw new Error("Model is required");

    const apiKey = args.apiKey?.trim();
    let encryptedKey: string | undefined;
    let keyLast4: string | undefined;
    if (apiKey) {
      encryptedKey = await encryptApiKey(apiKey);
      keyLast4 = maskKey(apiKey);
    }

    await ctx.runMutation(internal.aiProviders.upsertConfig, {
      scope: args.scope,
      provider: args.provider,
      baseUrl: args.provider === "custom" ? args.baseUrl?.replace(/\/+$/, "") : undefined,
      model: args.model.trim(),
      encryptedKey,
      keyLast4,
    });
  },
});

/**
 * Internal upsert — only ever sees ciphertext. Re-does auth and role checks
 * because actions can't be trusted as the sole gate.
 */
export const upsertConfig = internalMutation({
  args: {
    scope: scopeValidator,
    provider: providerValidator,
    baseUrl: v.optional(v.string()),
    model: v.string(),
    encryptedKey: v.optional(v.string()),
    keyLast4: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserForScope(ctx, args.scope);

    const existing =
      args.scope === "org"
        ? await getOrgConfig(ctx, user.organizationId!)
        : await getUserConfig(ctx, user._id);

    if (existing) {
      await ctx.db.patch(existing._id, {
        provider: args.provider,
        baseUrl: args.baseUrl,
        model: args.model,
        ...(args.encryptedKey && args.keyLast4
          ? { encryptedKey: args.encryptedKey, keyLast4: args.keyLast4 }
          : {}),
        updatedAt: Date.now(),
      });
      return;
    }

    if (!args.encryptedKey || !args.keyLast4) {
      throw new Error("API key required");
    }

    await ctx.db.insert("aiProviderConfigs", {
      scope: args.scope,
      organizationId: args.scope === "org" ? user.organizationId! : undefined,
      userId: args.scope === "user" ? user._id : undefined,
      provider: args.provider,
      baseUrl: args.baseUrl,
      encryptedKey: args.encryptedKey,
      keyLast4: args.keyLast4,
      model: args.model,
      createdBy: user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Remove a BYOK config, falling back to the next source in the chain.
 */
export const removeConfig = mutation({
  args: { scope: scopeValidator },
  handler: async (ctx, args) => {
    const user = await requireUserForScope(ctx, args.scope);

    const existing =
      args.scope === "org"
        ? await getOrgConfig(ctx, user.organizationId!)
        : await getUserConfig(ctx, user._id);

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/**
 * Resolve the effective AI config for a user: personal → org → platform.
 * The ONLY function that returns encryptedKey; must stay internal.
 * Pass `scope` to force a specific scope's config (used by key testing) —
 * in that mode there is no platform fallback and null means "not configured".
 */
export const resolveEffectiveConfig = internalQuery({
  args: {
    tokenIdentifier: v.string(),
    scope: v.optional(scopeValidator),
  },
  handler: async (ctx, args) => {
    const user = await getUserByTokenIdentifier(ctx, args.tokenIdentifier);
    if (!user) return null;

    const userConfig =
      args.scope === "org" ? null : await getUserConfig(ctx, user._id);
    if (userConfig && args.scope !== "org") {
      return {
        source: "user" as const,
        provider: userConfig.provider,
        baseUrl: userConfig.baseUrl,
        model: userConfig.model,
        encryptedKey: userConfig.encryptedKey,
      };
    }

    const orgConfig =
      args.scope === "user" || !user.organizationId
        ? null
        : await getOrgConfig(ctx, user.organizationId);
    if (orgConfig) {
      return {
        source: "org" as const,
        provider: orgConfig.provider,
        baseUrl: orgConfig.baseUrl,
        model: orgConfig.model,
        encryptedKey: orgConfig.encryptedKey,
      };
    }

    if (args.scope) return null;

    const org = user.organizationId
      ? await ctx.db.get(user.organizationId as Id<"organizations">)
      : null;
    return {
      source: "platform" as const,
      provider: "openrouter" as const,
      baseUrl: undefined,
      model: org?.openrouterModel || DEFAULT_PLATFORM_MODEL,
      encryptedKey: undefined,
    };
  },
});

/**
 * Cheap live check of an API key. Either pass provider + apiKey (pre-save
 * validation of a typed key) or scope (validate the saved config).
 * Returns { ok, error? }; never echoes the key.
 */
export const testProviderKey = action({
  args: {
    provider: v.optional(providerValidator),
    apiKey: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
    model: v.optional(v.string()),
    scope: v.optional(scopeValidator),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; error?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    let provider: string;
    let apiKey: string;
    let baseUrl: string | undefined;
    let model = "";

    if (args.apiKey && args.provider) {
      provider = args.provider;
      apiKey = args.apiKey.trim();
      baseUrl = args.baseUrl;
      model = args.model ?? "";
    } else if (args.scope) {
      const config = await ctx.runQuery(internal.aiProviders.resolveEffectiveConfig, {
        tokenIdentifier: identity.tokenIdentifier,
        scope: args.scope,
      });
      if (!config || !config.encryptedKey) {
        return { ok: false, error: "No saved key for this scope" };
      }
      provider = config.provider;
      try {
        apiKey = await decryptApiKey(config.encryptedKey);
      } catch (error) {
        if (!(error instanceof KeyDecryptionError)) throw error;
        // This action's whole contract is to report why a config is unusable,
        // so an unreadable key is a result, not a crash.
        return {
          ok: false,
          error:
            "Saved key could not be decrypted (the encryption secret has changed since it was saved). Re-enter the key to fix it.",
        };
      }
      baseUrl = config.baseUrl;
      model = config.model;
    } else {
      return { ok: false, error: "Provide an API key or a saved scope to test" };
    }

    try {
      validateBaseUrl(provider, baseUrl);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid configuration",
      };
    }

    try {
      switch (provider) {
        case "openrouter": {
          const res = await fetch("https://openrouter.ai/api/v1/key", {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (!res.ok) return { ok: false, error: `OpenRouter rejected the key (${res.status})` };
          return { ok: true };
        }
        case "openai": {
          const res = await fetch("https://api.openai.com/v1/models", {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (!res.ok) return { ok: false, error: `OpenAI rejected the key (${res.status})` };
          return { ok: true };
        }
        case "anthropic": {
          const res = await fetch("https://api.anthropic.com/v1/models", {
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
          });
          if (!res.ok) return { ok: false, error: `Anthropic rejected the key (${res.status})` };
          return { ok: true };
        }
        case "custom": {
          const root = baseUrl!.replace(/\/+$/, "");
          const modelsRes = await fetch(`${root}/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            redirect: "manual",
          });
          if (modelsRes.ok) return { ok: true };

          // Some OpenAI-compatible servers don't implement /models —
          // fall back to a minimal 1-token completion.
          const completionRes = await fetch(`${root}/chat/completions`, {
            method: "POST",
            redirect: "manual",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: model || "gpt-5.4-mini",
              messages: [{ role: "user", content: "hi" }],
              max_tokens: 1,
            }),
          });
          if (!completionRes.ok) {
            return {
              ok: false,
              error: `Endpoint rejected the key (${completionRes.status})`,
            };
          }
          return { ok: true };
        }
        default:
          return { ok: false, error: "Unknown provider" };
      }
    } catch {
      return { ok: false, error: "Could not reach the provider endpoint" };
    }
  },
});
