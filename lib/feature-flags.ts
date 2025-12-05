/**
 * Feature Flags Configuration
 *
 * Centralized feature flag management for controlled feature rollout.
 * Supports environment variables and can be extended to database-backed flags.
 */

export interface FeatureFlags {
  // Template System
  templatesEnabled: boolean;
  templatesLibraryEnabled: boolean;
  templatesSaveEnabled: boolean;

  // Future features can be added here
  // collaborationEnabled: boolean;
  // aiAssistantEnabled: boolean;
  // advancedAnalyticsEnabled: boolean;
}

/**
 * Get feature flags from environment variables
 * Defaults to enabled in development, disabled in production for safety
 */
function getFeatureFlagsFromEnv(): FeatureFlags {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return {
    // Template System - enabled by default in dev, controlled by env var in prod
    templatesEnabled: process.env.NEXT_PUBLIC_FEATURE_TEMPLATES === 'true' || isDevelopment,
    templatesLibraryEnabled: process.env.NEXT_PUBLIC_FEATURE_TEMPLATES_LIBRARY === 'true' || isDevelopment,
    templatesSaveEnabled: process.env.NEXT_PUBLIC_FEATURE_TEMPLATES_SAVE === 'true' || isDevelopment,
  };
}

/**
 * Feature flags instance
 * Can be extended to support database-backed flags or remote config
 */
export const featureFlags: FeatureFlags = getFeatureFlagsFromEnv();

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return featureFlags[feature];
}

/**
 * Check if entire template system is enabled
 */
export function isTemplateSystemEnabled(): boolean {
  return featureFlags.templatesEnabled;
}

/**
 * Get all enabled features (useful for debugging)
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(featureFlags)
    .filter(([_, enabled]) => enabled)
    .map(([feature]) => feature);
}

/**
 * Get all disabled features (useful for debugging)
 */
export function getDisabledFeatures(): string[] {
  return Object.entries(featureFlags)
    .filter(([_, enabled]) => !enabled)
    .map(([feature]) => feature);
}
