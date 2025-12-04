import { Server } from "@hocuspocus/server";

// Hocuspocus collaborative editing server
// Run this server separately: npx ts-node server/hocuspocus.ts
// Or add to package.json scripts for production deployment

const server = new Server({
  name: "takescript-collab",
  port: parseInt(process.env.HOCUSPOCUS_PORT || "1234"),
  timeout: 30000,
  debounce: 2000,
  maxDebounce: 10000,
  quiet: process.env.NODE_ENV === "production",

  // Authentication hook - validates connection requests
  async onAuthenticate({ token, documentName }) {
    // In production, verify JWT token here
    // For now, accept all connections
    if (!token) {
      // Allow anonymous connections in development
      return {
        user: {
          id: "anonymous",
          name: "Anonymous",
        },
      };
    }

    // TODO: Verify token with your auth provider (Clerk)
    // For now, decode basic user info from token
    try {
      // Decode base64 token (works in both Node.js and browser)
      const decoded = Buffer.from(token, "base64").toString("utf-8");
      const userData = JSON.parse(decoded);
      return {
        user: {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          avatar: userData.avatar,
        },
      };
    } catch {
      return {
        user: {
          id: "anonymous",
          name: "Anonymous",
        },
      };
    }
  },

  // Store document hook - persist to your database
  async onStoreDocument({ documentName, document }) {
    // TODO: Persist Y.Doc to Convex or your preferred storage
    // This is called periodically (debounced) when document changes
    console.log(`[Hocuspocus] Storing document: ${documentName}`);
  },

  // Load document hook - retrieve from your database
  async onLoadDocument({ documentName }) {
    // TODO: Load Y.Doc from Convex or your preferred storage
    // Return null to start with empty document
    console.log(`[Hocuspocus] Loading document: ${documentName}`);
    return null;
  },

  // Connection hooks for logging
  async onConnect({ documentName, socketId }) {
    console.log(
      `[Hocuspocus] Client connected: ${socketId} to ${documentName}`
    );
  },

  async onDisconnect({ documentName, socketId }) {
    console.log(
      `[Hocuspocus] Client disconnected: ${socketId} from ${documentName}`
    );
  },
});

// Start the server
server.listen().then(() => {
  console.log(`[Hocuspocus] Server running on port ${server.configuration.port}`);
});

export { server };
