import { query } from "./_generated/server";

// Helper function to calculate word count from Tiptap JSON content
function calculateWordCount(content: string): number {
  try {
    const doc = JSON.parse(content);
    const text = extractText(doc);
    return text.split(/\s+/).filter(Boolean).length;
  } catch {
    return 0;
  }
}

// Recursively extract text from Tiptap JSON nodes
function extractText(node: any): string {
  if (!node) return "";

  // If node has text content, return it
  if (node.text) return node.text;

  // If node has content array, recursively extract text from children
  if (Array.isArray(node.content)) {
    return node.content.map(extractText).join(" ");
  }

  return "";
}

export const getUserStats = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      return null;
    }

    // Get all user's scripts
    const scripts = await ctx.db
      .query("scripts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Use cached word count (falls back to calculation if not cached)
    const totalWordCount = scripts.reduce((acc, script) => {
      // Prefer cached wordCount, fallback to calculation for old scripts
      const wordCount = script.wordCount ?? calculateWordCount(script.content);
      return acc + wordCount;
    }, 0);

    // Count completed scripts
    const completedScripts = scripts.filter(
      (s) => s.status === "complete"
    ).length;

    // Recent activity (scripts edited in last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentActivity = scripts.filter(
      (s) => s.lastEditedAt > sevenDaysAgo
    ).length;

    // Count unique categories
    const categories = new Set(
      scripts.map((s) => s.category).filter(Boolean)
    );

    return {
      totalScripts: scripts.length,
      totalWordCount,
      completedScripts,
      recentActivity,
      categories: categories.size,
    };
  },
});
