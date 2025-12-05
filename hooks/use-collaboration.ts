"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";

// Collaboration user info
export interface CollaborationUser {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  color: string;
}

// Awareness state for each user
export interface AwarenessState {
  user: CollaborationUser;
  cursor?: {
    anchor: number;
    head: number;
  };
}

// Generate a random color for user cursor
function generateUserColor(): string {
  const colors = [
    "#FF6B6B", // Red
    "#4ECDC4", // Teal
    "#45B7D1", // Blue
    "#96CEB4", // Green
    "#FFEAA7", // Yellow
    "#DDA0DD", // Plum
    "#98D8C8", // Mint
    "#F7DC6F", // Gold
    "#BB8FCE", // Purple
    "#85C1E9", // Sky
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

interface UseCollaborationOptions {
  documentId: string;
  enabled?: boolean;
}

interface UseCollaborationReturn {
  provider: HocuspocusProvider | null;
  ydoc: Y.Doc;
  isConnected: boolean;
  isSynced: boolean;
  collaborators: CollaborationUser[];
  currentUser: CollaborationUser | null;
  connectionStatus: "connecting" | "connected" | "disconnected";
}

export function useCollaboration({
  documentId,
  enabled = true,
}: UseCollaborationOptions): UseCollaborationReturn {
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [collaborators, setCollaborators] = useState<CollaborationUser[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("disconnected");

  const providerRef = useRef<HocuspocusProvider | null>(null);
  const colorRef = useRef<string>(generateUserColor());
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create Y.Doc instance (stable across renders)
  const ydoc = useMemo(() => new Y.Doc(), []);

  // Current user info
  const currentUser = useMemo<CollaborationUser | null>(() => {
    if (!isUserLoaded || !clerkUser) return null;
    return {
      id: clerkUser.id,
      name:
        clerkUser.fullName ||
        clerkUser.firstName ||
        clerkUser.emailAddresses[0]?.emailAddress ||
        "Anonymous",
      email: clerkUser.emailAddresses[0]?.emailAddress,
      avatar: clerkUser.imageUrl,
      color: colorRef.current,
    };
  }, [isUserLoaded, clerkUser]);

  // Create auth token for Hocuspocus (browser-compatible base64)
  const createAuthToken = useCallback(() => {
    if (!currentUser) return "";
    return btoa(JSON.stringify(currentUser));
  }, [currentUser]);

  // Update collaborators from awareness
  const updateCollaborators = useCallback(() => {
    if (!providerRef.current) return;

    const awareness = providerRef.current.awareness;
    if (!awareness) return;

    const states = awareness.getStates();
    const users: CollaborationUser[] = [];

    states.forEach((state, clientId) => {
      // Skip current user
      if (clientId === awareness.clientID) return;
      if (state.user) {
        users.push(state.user as CollaborationUser);
      }
    });

    setCollaborators(users);
  }, []);

  useEffect(() => {
    if (!enabled || !documentId || !currentUser) {
      return;
    }

    // Get WebSocket URL from environment or default to localhost
    const wsUrl =
      process.env.NEXT_PUBLIC_COLLABORATION_URL || "ws://localhost:1234";

    setConnectionStatus("connecting");

    const provider = new HocuspocusProvider({
      url: wsUrl,
      name: documentId,
      document: ydoc,
      token: createAuthToken(),

      // Connection events
      onConnect: () => {
        setIsConnected(true);
        setConnectionStatus("connected");
      },

      onDisconnect: () => {
        setIsConnected(false);
        setConnectionStatus("disconnected");
      },

      onSynced: () => {
        // Throttle sync status updates to prevent flashing
        // Only update UI after changes have stabilized
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
        syncTimeoutRef.current = setTimeout(() => {
          setIsSynced(true);
        }, 300); // 300ms delay before showing "Synced"
      },

      onAwarenessUpdate: () => {
        updateCollaborators();
      },
    });

    // Set user awareness
    provider.awareness?.setLocalStateField("user", currentUser);

    providerRef.current = provider;

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      provider.destroy();
      providerRef.current = null;
      setIsConnected(false);
      setIsSynced(false);
      setConnectionStatus("disconnected");
    };
  }, [
    enabled,
    documentId,
    ydoc,
    currentUser,
    createAuthToken,
    updateCollaborators,
  ]);

  return {
    provider: providerRef.current,
    ydoc,
    isConnected,
    isSynced,
    collaborators,
    currentUser,
    connectionStatus,
  };
}
