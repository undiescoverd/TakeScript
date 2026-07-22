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

  // AI Features
  aiEnabled: boolean;
  aiChatEnabled: boolean;
  aiBrandGuidelinesEnabled: boolean;
  aiGrammarCheckEnabled: boolean;
  aiReviewEnabled: boolean;
  aiGenerationEnabled: boolean;
  aiInlineSuggestionsEnabled: boolean;
  aiByokEnabled: boolean;
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

    // AI Features - disabled by default, must be explicitly enabled
    aiEnabled: process.env.NEXT_PUBLIC_FEATURE_AI === 'true',
    aiChatEnabled: process.env.NEXT_PUBLIC_FEATURE_AI_CHAT === 'true',
    aiBrandGuidelinesEnabled: process.env.NEXT_PUBLIC_FEATURE_AI_BRAND_GUIDELINES === 'true',
    aiGrammarCheckEnabled: process.env.NEXT_PUBLIC_FEATURE_AI_GRAMMAR_CHECK === 'true',
    aiReviewEnabled: process.env.NEXT_PUBLIC_FEATURE_AI_REVIEW === 'true',
    aiGenerationEnabled: process.env.NEXT_PUBLIC_FEATURE_AI_GENERATION === 'true',
    aiInlineSuggestionsEnabled: process.env.NEXT_PUBLIC_FEATURE_AI_INLINE === 'true',
    aiByokEnabled: process.env.NEXT_PUBLIC_FEATURE_AI_BYOK === 'true',
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

/**
 * Check if any AI features are enabled
 */
export function hasAnyAIFeatures(): boolean {
  return featureFlags.aiEnabled && (
    featureFlags.aiChatEnabled ||
    featureFlags.aiBrandGuidelinesEnabled ||
    featureFlags.aiGrammarCheckEnabled ||
    featureFlags.aiReviewEnabled ||
    featureFlags.aiGenerationEnabled ||
    featureFlags.aiInlineSuggestionsEnabled
  );
}

/**
 * Get list of enabled AI features
 */
export function getEnabledAIFeatures(): string[] {
  if (!featureFlags.aiEnabled) return [];

  const features: string[] = [];
  if (featureFlags.aiChatEnabled) features.push('chat');
  if (featureFlags.aiBrandGuidelinesEnabled) features.push('brand-guidelines');
  if (featureFlags.aiGrammarCheckEnabled) features.push('grammar-check');
  if (featureFlags.aiReviewEnabled) features.push('review');
  if (featureFlags.aiGenerationEnabled) features.push('generation');
  if (featureFlags.aiInlineSuggestionsEnabled) features.push('inline-suggestions');

  return features;
}

/**
 * Get feature flags object (alias for direct access)
 * Useful for components that need the full flags object
 */
export function getFeatureFlags(): FeatureFlags {
  return featureFlags;
}
