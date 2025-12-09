"use client";

import { useEffect, useRef } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * This component ensures that authenticated Clerk users are stored in the Convex database.
 * It should be rendered once in the app layout to run on every page load.
 */
export function StoreUserEffect() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const storeUser = useMutation(api.users.store);
  const hasStoredUser = useRef(false);

  useEffect(() => {
    // Only run once per authentication session
    if (isAuthenticated && !isLoading && !hasStoredUser.current) {
      hasStoredUser.current = true;
      storeUser()
        .then(() => {
          console.log("[StoreUserEffect] User stored successfully");
        })
        .catch((error) => {
          console.error("[StoreUserEffect] Failed to store user in Convex:", error);
          // Reset so it can retry on next auth change
          hasStoredUser.current = false;
        });
    }

    // Reset when user signs out
    if (!isAuthenticated && !isLoading) {
      hasStoredUser.current = false;
    }
  }, [isAuthenticated, isLoading, storeUser]);

  return null;
}
