/**
 * Storage diagnostic functions
 */

import { query } from "./_generated/server";

// Check storage usage across all tables
export const checkStorageUsage = query({
  args: {},
  handler: async (ctx) => {
    // Get counts and approximate sizes for each table
    const scripts = await ctx.db.query("scripts").collect();
    const versions = await ctx.db.query("scriptVersions").collect();
    const users = await ctx.db.query("users").collect();
    const comments = await ctx.db.query("comments").collect();
    const annotations = await ctx.db.query("annotations").collect();
    const templates = await ctx.db.query("templates").collect();
    const organizations = await ctx.db.query("organizations").collect();
    const brandGuidelines = await ctx.db.query("brandGuidelines").collect();
    const aiRequests = await ctx.db.query("aiRequests").collect();
    const invitations = await ctx.db.query("organizationInvitations").collect();

    // Calculate approximate content sizes
    const scriptsContentSize = scripts.reduce((sum, s) => sum + (s.content?.length || 0), 0);
    const versionsContentSize = versions.reduce((sum, v) => sum + (v.content?.length || 0), 0);
    const templatesContentSize = templates.reduce((sum, t) => sum + (t.content?.length || 0), 0);
    const brandGuidelinesContentSize = brandGuidelines.reduce((sum, b) => sum + (b.content?.length || 0), 0);

    return {
      tables: {
        scripts: { count: scripts.length, contentSize: scriptsContentSize },
        scriptVersions: { count: versions.length, contentSize: versionsContentSize },
        templates: { count: templates.length, contentSize: templatesContentSize },
        brandGuidelines: { count: brandGuidelines.length, contentSize: brandGuidelinesContentSize },
        users: { count: users.length },
        comments: { count: comments.length },
        annotations: { count: annotations.length },
        organizations: { count: organizations.length },
        aiRequests: { count: aiRequests.length },
        invitations: { count: invitations.length },
      },
      totalContentBytes: scriptsContentSize + versionsContentSize + templatesContentSize + brandGuidelinesContentSize,
      totalContentKB: Math.round((scriptsContentSize + versionsContentSize + templatesContentSize + brandGuidelinesContentSize) / 1024),
      totalContentMB: ((scriptsContentSize + versionsContentSize + templatesContentSize + brandGuidelinesContentSize) / 1024 / 1024).toFixed(2),
    };
  },
});
