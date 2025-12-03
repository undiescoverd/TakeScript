"use client";

import { useAuth, UserButton } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const storeUser = useMutation(api.users.store);
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/login");
    }
  }, [isSignedIn, isLoaded, router]);

  // Store user in Convex when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      storeUser();
    }
  }, [isAuthenticated, storeUser]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
