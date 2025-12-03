"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { ReactNode } from "react";
import { StoreUserEffect } from "@/components/auth/StoreUserEffect";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY as string}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <StoreUserEffect />
          {children}
        </ThemeProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
