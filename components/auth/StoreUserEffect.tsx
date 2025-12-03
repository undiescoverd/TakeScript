"use client";

import { useEffect } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * This component ensures that authenticated Clerk users are stored in the Convex database.
 * It should be rendered once in the app layout to run on every page load.
 */
export function StoreUserEffect() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const storeUser = useMutation(api.users.store);

  useEffect(() => {
    console.log("[StoreUserEffect] Auth state:", { isAuthenticated, isLoading });

    // If user is authenticated with Clerk, ensure they exist in Convex
    if (isAuthenticated && !isLoading) {
      console.log("[StoreUserEffect] Attempting to store user...");
      storeUser()
        .then(() => {
          console.log("[StoreUserEffect] User stored successfully");
        })
        .catch((error) => {
          console.error("[StoreUserEffect] Failed to store user in Convex:", error);
        });
    }
  }, [isAuthenticated, isLoading, storeUser]);

  return null; // This component doesn't render anything
}
