// Feature flags configuration for backend following documented Express.js patterns
// Used to enable/disable features across the API

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
  const envValue = process.env[`FEATURE_${flagName}`];
  if (envValue !== undefined) {
    return envValue.toLowerCase() === 'true';
  }
  
  return defaultValue;
};

// Enhanced feature check with environment override support
export const checkFeature = (feature: keyof FeatureFlags): boolean => {
  return getEnvironmentFlag(feature, featureFlags[feature]);
};

// Middleware to check feature flags
export const requireFeature = (feature: keyof FeatureFlags) => {
  return (req: any, res: any, next: any) => {
    if (!checkFeature(feature)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FEATURE_DISABLED',
          message: `Feature '${feature}' is currently disabled`,
          details: { feature }
        },
        timestamp: new Date().toISOString()
      });
    }
    next();
  };
};