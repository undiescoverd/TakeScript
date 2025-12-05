import { useMemo } from 'react';
import {
  featureFlags,
  type FeatureFlags,
  isFeatureEnabled,
  isTemplateSystemEnabled,
} from '@/lib/feature-flags';

/**
 * Hook to access feature flags in React components
 *
 * @example
 * const { templatesEnabled } = useFeatureFlags();
 * if (templatesEnabled) {
 *   // Show template features
 * }
 */
export function useFeatureFlags(): FeatureFlags {
  return useMemo(() => featureFlags, []);
}

/**
 * Hook to check if a specific feature is enabled
 *
 * @example
 * const isEnabled = useFeatureFlag('templatesEnabled');
 */
export function useFeatureFlag(feature: keyof FeatureFlags): boolean {
  return useMemo(() => isFeatureEnabled(feature), [feature]);
}

/**
 * Hook to check if template system is enabled
 */
export function useTemplateSystem(): boolean {
  return useMemo(() => isTemplateSystemEnabled(), []);
}
