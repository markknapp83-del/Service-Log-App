// Feature flags configuration following documented React 18 patterns
// Used to enable/disable features across the application

export interface FeatureFlags {
  CUSTOM_FORMS_ENABLED: boolean;
  // Future feature flags can be added here
}

// Feature flag values - set to false to disable custom form features for post-launch
export const featureFlags: FeatureFlags = {
  CUSTOM_FORMS_ENABLED: false, // Disable custom form features for launch
};

// Helper function to check if a feature is enabled
export const isFeatureEnabled = (feature: keyof FeatureFlags): boolean => {
  return featureFlags[feature] ?? false;
};

// Environment-based feature flags (can be overridden by environment variables)
const getEnvironmentFlag = (flagName: string, defaultValue: boolean): boolean => {
  if (typeof window !== 'undefined') {
    // Client-side: check for window-based flags (for development)
    const envFlag = (window as any).__FEATURE_FLAGS__?.[flagName];
    if (envFlag !== undefined) {
      return Boolean(envFlag);
    }
  }
  
  // Default to configured value
  return defaultValue;
};

// Enhanced feature check with environment override support
export const checkFeature = (feature: keyof FeatureFlags): boolean => {
  return getEnvironmentFlag(feature, featureFlags[feature]);
};