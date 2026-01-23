import { mutation } from "./_generated/server";

// Helper function to generate unique IDs for blocks
function generateBlockId(blockType: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${blockType}-${timestamp}-${random}`;
}

// Migration: Populate database with system templates
export const seedSystemTemplates = mutation({
  handler: async (ctx) => {
    // Check if system templates already exist
    const existingSystemTemplates = await ctx.db
      .query("templates")
      .withIndex("system_templates", (q) => q.eq("isSystem", true))
      .collect();

    if (existingSystemTemplates.length > 0) {
      return {
        success: false,
        message: "System templates already exist. Skipping migration.",
        count: existingSystemTemplates.length,
      };
    }

    const systemTemplates = [
      {
        name: "Tutorial",
        description: "Step-by-step guide with chapters and clear instructions. Perfect for educational content and how-to guides.",
        category: "Educational",
        content: JSON.stringify({
          type: "doc",
          content: [
            {
              type: "chapter",
              attrs: { title: "Introduction", duration: "30s", id: generateBlockId("chapter") },
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Welcome to this tutorial. In this guide, we'll cover..." },
                  ],
                },
              ],
            },
            {
              type: "chapter",
              attrs: { title: "Step 1: Getting Started", duration: "2m", id: generateBlockId("chapter") },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "First, let's start by..." }],
                },
                {
                  type: "screenRecording",
                  attrs: { id: generateBlockId("screenRecording") },
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "Show the initial setup process..." },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "chapter",
              attrs: { title: "Step 2: Main Content", duration: "3m", id: generateBlockId("chapter") },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Now let's dive into..." }],
                },
              ],
            },
            {
              type: "chapter",
              attrs: { title: "Conclusion", duration: "1m", id: generateBlockId("chapter") },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Let's recap what we've learned today..." }],
                },
              ],
            },
          ],
        }),
      },
      {
        name: "Product Demo",
        description: "Product demonstration with screen recordings. Ideal for showcasing features and capabilities.",
        category: "Marketing",
        content: JSON.stringify({
          type: "doc",
          content: [
            {
              type: "chapter",
              attrs: { title: "Product Demo", duration: "1m", id: generateBlockId("chapter") },
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "In this demo, we'll show you how our product solves..." },
                  ],
                },
                {
                  type: "screenRecording",
                  attrs: { id: generateBlockId("screenRecording") },
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "Navigate to the main dashboard and show..." },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "chapter",
              attrs: { title: "Key Features", duration: "2m", id: generateBlockId("chapter") },
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Let's explore the key features..." },
                  ],
                },
                {
                  type: "screenRecording",
                  attrs: { id: generateBlockId("screenRecording") },
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "Demonstrate feature 1..." },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      },
      {
        name: "Training Course",
        description: "Educational content with demonstrations and practice exercises. Best for employee onboarding and skill development.",
        category: "Training",
        content: JSON.stringify({
          type: "doc",
          content: [
            {
              type: "chapter",
              attrs: { title: "Training Overview", duration: "1m", id: generateBlockId("chapter") },
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Welcome to this training session. Today we'll learn..." },
                  ],
                },
              ],
            },
            {
              type: "chapter",
              attrs: { title: "Core Concepts", duration: "3m", id: generateBlockId("chapter") },
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Let's start with the fundamental concepts..." },
                  ],
                },
                {
                  type: "demonstration",
                  attrs: { id: generateBlockId("demonstration") },
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "Demonstrate the core workflow step-by-step..." },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "chapter",
              attrs: { title: "Practice Exercise", duration: "4m", id: generateBlockId("chapter") },
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Now it's time to practice what you've learned..." },
                  ],
                },
              ],
            },
          ],
        }),
      },
      {
        name: "Product Walkthrough",
        description: "Comprehensive feature overview with detailed explanations. Great for onboarding new users.",
        category: "Onboarding",
        content: JSON.stringify({
          type: "doc",
          content: [
            {
              type: "chapter",
              attrs: { title: "Product Introduction", duration: "1m", id: generateBlockId("chapter") },
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Welcome! Let's take a comprehensive tour of our product..." },
                  ],
                },
              ],
            },
            {
              type: "chapter",
              attrs: { title: "Feature 1: Dashboard", duration: "2m", id: generateBlockId("chapter") },
              content: [
                {
                  type: "screenRecording",
                  attrs: { id: generateBlockId("screenRecording") },
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "Show the dashboard overview and key metrics..." },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "chapter",
              attrs: { title: "Feature 2: Analytics", duration: "2m", id: generateBlockId("chapter") },
              content: [
                {
                  type: "screenRecording",
                  attrs: { id: generateBlockId("screenRecording") },
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "Navigate to analytics and explain data visualization..." },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "chapter",
              attrs: { title: "Feature 3: Settings", duration: "1m", id: generateBlockId("chapter") },
              content: [
                {
                  type: "screenRecording",
                  attrs: { id: generateBlockId("screenRecording") },
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "Show customization options and preferences..." },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      },
    ];

    const insertedIds = [];
    for (const template of systemTemplates) {
      const id = await ctx.db.insert("templates", {
        ...template,
        userId: undefined,
        isSystem: true,
        createdAt: Date.now(),
      });
      insertedIds.push(id);
    }

    return {
      success: true,
      message: "System templates seeded successfully",
      count: insertedIds.length,
      templateIds: insertedIds,
    };
  },
});

// Helper mutation to clear all system templates (for development/testing)
export const clearSystemTemplates = mutation({
  handler: async (ctx) => {
    const systemTemplates = await ctx.db
      .query("templates")
      .withIndex("system_templates", (q) => q.eq("isSystem", true))
      .collect();

    for (const template of systemTemplates) {
      await ctx.db.delete(template._id);
    }

    return {
      success: true,
      message: "System templates cleared",
      count: systemTemplates.length,
    };
  },
});

// Helper mutation to check migration status
export const checkMigrationStatus = mutation({
  handler: async (ctx) => {
    const systemTemplates = await ctx.db
      .query("templates")
      .withIndex("system_templates", (q) => q.eq("isSystem", true))
      .collect();

    const userTemplates = await ctx.db
      .query("templates")
      .filter((q) => q.neq(q.field("isSystem"), true))
      .collect();

    return {
      systemTemplatesCount: systemTemplates.length,
      userTemplatesCount: userTemplates.length,
      systemTemplates: systemTemplates.map((t) => ({
        id: t._id,
        name: t.name,
        category: t.category,
      })),
    };
  },
});
