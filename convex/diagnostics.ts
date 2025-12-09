import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Diagnostic query to check script health
 * Returns detailed information about a script's content validity
 */
export const checkScriptHealth = query({
  args: { scriptId: v.id("scripts") },
  handler: async (ctx, args) => {
    const script = await ctx.db.get(args.scriptId);

    if (!script) {
      return {
        status: "not_found",
        message: "Script does not exist in database",
      };
    }

    const diagnostics = {
      status: "ok" as "ok" | "warning" | "error",
      scriptId: script._id,
      title: script.title,
      userId: script.userId,
      createdAt: new Date(script.createdAt).toISOString(),
      lastEditedAt: new Date(script.lastEditedAt).toISOString(),
      contentLength: script.content?.length || 0,
      contentPreview: script.content?.substring(0, 200) || "",
      issues: [] as string[],
      contentType: null as "valid_json" | "empty" | "invalid" | null,
      parsedContent: null as any,
    };

    // Check content validity
    if (!script.content || script.content.trim() === "") {
      diagnostics.status = "warning";
      diagnostics.contentType = "empty";
      diagnostics.issues.push("Content is empty or null");
    } else {
      try {
        const parsed = JSON.parse(script.content);
        diagnostics.parsedContent = parsed;
        diagnostics.contentType = "valid_json";

        // Check if it's a valid Tiptap document
        if (!parsed.type || parsed.type !== "doc") {
          diagnostics.status = "warning";
          diagnostics.issues.push("Content is valid JSON but not a valid Tiptap document (missing type: 'doc')");
        }

        if (!parsed.content || !Array.isArray(parsed.content)) {
          diagnostics.status = "warning";
          diagnostics.issues.push("Content is valid JSON but missing content array");
        }
      } catch (parseError) {
        diagnostics.status = "error";
        diagnostics.contentType = "invalid";
        diagnostics.issues.push(`JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        diagnostics.issues.push(`Content starts with: ${script.content.substring(0, 100)}`);
      }
    }

    return diagnostics;
  },
});

/**
 * List all scripts with basic health check
 */
export const listAllScriptsHealth = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { error: "Not authenticated" };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      return { error: "User not found" };
    }

    const scripts = await ctx.db
      .query("scripts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return scripts.map((script) => {
      let contentStatus = "ok";
      let contentError = null;

      if (!script.content || script.content.trim() === "") {
        contentStatus = "empty";
      } else {
        try {
          const parsed = JSON.parse(script.content);
          if (!parsed.type || parsed.type !== "doc") {
            contentStatus = "invalid_structure";
          }
        } catch (e) {
          contentStatus = "parse_error";
          contentError = e instanceof Error ? e.message : String(e);
        }
      }

      return {
        id: script._id,
        title: script.title,
        contentStatus,
        contentError,
        contentLength: script.content?.length || 0,
        lastEditedAt: new Date(script.lastEditedAt).toISOString(),
      };
    });
  },
});

/**
 * Attempt to repair a corrupted script (read-only preview)
 */
export const repairScript = query({
  args: { scriptId: v.id("scripts") },
  handler: async (ctx, args) => {
    const script = await ctx.db.get(args.scriptId);

    if (!script) {
      return { success: false, message: "Script not found" };
    }

    let repairedContent = null;
    let repairStrategy = null;

    // Try to repair the content
    if (!script.content || script.content.trim() === "") {
      // Empty content - provide minimal valid document
      repairedContent = JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "" }],
          },
        ],
      });
      repairStrategy = "empty_content_replaced";
    } else {
      try {
        const parsed = JSON.parse(script.content);

        // Check structure and fix if needed
        if (!parsed.type) {
          parsed.type = "doc";
          repairStrategy = "added_doc_type";
        }

        if (!parsed.content || !Array.isArray(parsed.content)) {
          parsed.content = [
            {
              type: "paragraph",
              content: [{ type: "text", text: "" }],
            },
          ];
          repairStrategy = "added_content_array";
        }

        repairedContent = JSON.stringify(parsed);
      } catch (parseError) {
        // Can't parse as JSON - create new document with original as text
        repairedContent = JSON.stringify({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: `[Recovered from corrupted content]:\n${script.content.substring(0, 500)}...`
                },
              ],
            },
          ],
        });
        repairStrategy = "json_parse_error_recovered";
      }
    }

    return {
      success: true,
      repairStrategy,
      originalContentLength: script.content?.length || 0,
      repairedContentLength: repairedContent?.length || 0,
      repairedContent,
      message: "Script can be repaired. Use the 'applyRepair' mutation to apply the fix.",
    };
  },
});

/**
 * Apply repair to a corrupted script
 */
export const applyRepair = mutation({
  args: { scriptId: v.id("scripts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const script = await ctx.db.get(args.scriptId);
    if (!script) {
      throw new Error("Script not found");
    }

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || script.userId !== user._id) {
      throw new Error("Not authorized");
    }

    let repairedContent = null;
    let repairStrategy = null;

    // Perform the same repair logic
    if (!script.content || script.content.trim() === "") {
      repairedContent = JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "" }],
          },
        ],
      });
      repairStrategy = "empty_content_replaced";
    } else {
      try {
        const parsed = JSON.parse(script.content);

        if (!parsed.type) {
          parsed.type = "doc";
          repairStrategy = "added_doc_type";
        }

        if (!parsed.content || !Array.isArray(parsed.content)) {
          parsed.content = [
            {
              type: "paragraph",
              content: [{ type: "text", text: "" }],
            },
          ];
          repairStrategy = "added_content_array";
        }

        repairedContent = JSON.stringify(parsed);
      } catch (parseError) {
        repairedContent = JSON.stringify({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: `[Recovered from corrupted content]:\n${script.content.substring(0, 500)}...`
                },
              ],
            },
          ],
        });
        repairStrategy = "json_parse_error_recovered";
      }
    }

    // Apply the repair
    await ctx.db.patch(args.scriptId, {
      content: repairedContent,
      lastEditedAt: Date.now(),
    });

    return {
      success: true,
      repairStrategy,
      message: `Script repaired successfully using strategy: ${repairStrategy}`,
    };
  },
});
