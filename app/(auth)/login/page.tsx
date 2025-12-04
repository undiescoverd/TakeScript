"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      // Redirect to the script page if there's a redirect param, otherwise go to dashboard
      const redirect = searchParams.get("redirect");
      router.push(redirect || "/dashboard");
    }
  }, [isSignedIn, isLoaded, router, searchParams]);

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background">
      <div className="mx-auto flex w-full max-w-md flex-col items-center space-y-8 px-4">
        {/* Logo/Title */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">TakeScript</h1>
          <p className="mt-2 text-muted-foreground">
            Professional tutorial script editor
          </p>
        </div>

        {/* Features */}
        <div className="w-full space-y-4 rounded-lg border bg-card p-6">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <span className="text-primary">✓</span>
              Write scripts with embedded production notes
            </p>
            <p className="flex items-center gap-2">
              <span className="text-primary">✓</span>
              Clean export for teleprompter recording
            </p>
            <p className="flex items-center gap-2">
              <span className="text-primary">✓</span>
              Version history and team collaboration
            </p>
            <p className="flex items-center gap-2">
              <span className="text-primary">✓</span>
              Professional screenplay-style formatting
            </p>
          </div>
        </div>

        {/* Sign In Button */}
        <SignInButton mode="modal" forceRedirectUrl="/dashboard">
          <Button size="lg" className="w-full max-w-xs">
            <svg
              className="mr-2 h-5 w-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </Button>
        </SignInButton>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
