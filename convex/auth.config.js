// Convex Auth configuration for Clerk
// Domain must match your Clerk instance exactly
// applicationID must match the JWT template name in Clerk (case-sensitive)

export default {
  providers: [
    {
      domain: "https://amazed-kite-49.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
