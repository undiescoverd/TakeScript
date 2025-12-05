# Feature Flags Guide

Feature flags allow you to control which features are enabled in your TakeScript deployment. This is useful for:
- Gradual feature rollout
- A/B testing
- Disabling features in specific environments
- Emergency feature toggles

## Available Feature Flags

### Template System Flags

#### `NEXT_PUBLIC_FEATURE_TEMPLATES`
**Controls**: Entire template system
**Default**:
- ✅ Enabled in development
- ❌ Disabled in production (must explicitly enable)

**Affects**:
- Template queries in NewScriptDialog
- All template-related functionality

**Usage**:
```bash
NEXT_PUBLIC_FEATURE_TEMPLATES=true
```

#### `NEXT_PUBLIC_FEATURE_TEMPLATES_LIBRARY`
**Controls**: Templates tab in dashboard
**Default**: Inherits from `NEXT_PUBLIC_FEATURE_TEMPLATES`

**Affects**:
- Templates tab visibility in dashboard
- Template library management UI
- Template search and filtering

**Usage**:
```bash
NEXT_PUBLIC_FEATURE_TEMPLATES_LIBRARY=true
```

#### `NEXT_PUBLIC_FEATURE_TEMPLATES_SAVE`
**Controls**: "Save as Template" button in editor
**Default**: Inherits from `NEXT_PUBLIC_FEATURE_TEMPLATES`

**Affects**:
- Save as Template button in script editor topbar
- Template creation from existing scripts

**Usage**:
```bash
NEXT_PUBLIC_FEATURE_TEMPLATES_SAVE=true
```

## Configuration

### Environment Variables

Add to your `.env.local` file:

```bash
# Template System (all flags)
NEXT_PUBLIC_FEATURE_TEMPLATES=true
NEXT_PUBLIC_FEATURE_TEMPLATES_LIBRARY=true
NEXT_PUBLIC_FEATURE_TEMPLATES_SAVE=true
```

### Per-Environment Configuration

#### Development (Default: Enabled)
```bash
# .env.local
# Templates are enabled by default, no config needed
```

#### Staging (Selective Enable)
```bash
# .env.staging
# Enable template system but hide save button
NEXT_PUBLIC_FEATURE_TEMPLATES=true
NEXT_PUBLIC_FEATURE_TEMPLATES_LIBRARY=true
NEXT_PUBLIC_FEATURE_TEMPLATES_SAVE=false
```

#### Production (Explicit Enable)
```bash
# .env.production
# Explicitly enable all template features
NEXT_PUBLIC_FEATURE_TEMPLATES=true
NEXT_PUBLIC_FEATURE_TEMPLATES_LIBRARY=true
NEXT_PUBLIC_FEATURE_TEMPLATES_SAVE=true
```

## Deployment Strategies

### Strategy 1: Gradual Rollout

**Week 1**: Enable templates for internal testing
```bash
NEXT_PUBLIC_FEATURE_TEMPLATES=true
NEXT_PUBLIC_FEATURE_TEMPLATES_LIBRARY=false  # Hide library
NEXT_PUBLIC_FEATURE_TEMPLATES_SAVE=false     # Hide save button
```

**Week 2**: Enable template library for beta users
```bash
NEXT_PUBLIC_FEATURE_TEMPLATES=true
NEXT_PUBLIC_FEATURE_TEMPLATES_LIBRARY=true
NEXT_PUBLIC_FEATURE_TEMPLATES_SAVE=false     # Still hide save
```

**Week 3**: Full rollout
```bash
NEXT_PUBLIC_FEATURE_TEMPLATES=true
NEXT_PUBLIC_FEATURE_TEMPLATES_LIBRARY=true
NEXT_PUBLIC_FEATURE_TEMPLATES_SAVE=true
```

### Strategy 2: Emergency Disable

If issues arise in production:

```bash
# Disable entire template system
NEXT_PUBLIC_FEATURE_TEMPLATES=false
```

Rebuild and redeploy. Users will see the original interface without templates.

### Strategy 3: Feature-Specific Control

Enable viewing templates but not creating them:

```bash
NEXT_PUBLIC_FEATURE_TEMPLATES=true
NEXT_PUBLIC_FEATURE_TEMPLATES_LIBRARY=true   # Can browse templates
NEXT_PUBLIC_FEATURE_TEMPLATES_SAVE=false     # Cannot save new templates
```

## Behavior When Disabled

### `templatesEnabled=false`
- NewScriptDialog shows only hardcoded system templates (backward compatibility)
- No database template queries
- Template creation still works via old templateType parameter

### `templatesLibraryEnabled=false`
- Dashboard shows only "Scripts" section (no tabs)
- Templates tab is hidden
- Users cannot browse or manage templates

### `templatesSaveEnabled=false`
- "Save as Template" button hidden in editor
- Users cannot create new templates from scripts
- Can still use existing templates

## Checking Feature Status

### In Browser Console

```javascript
// Check all feature flags
import { featureFlags } from '@/lib/feature-flags';
console.log(featureFlags);

// Check specific feature
import { isFeatureEnabled } from '@/lib/feature-flags';
console.log('Templates:', isFeatureEnabled('templatesEnabled'));
```

### In Code

```typescript
import { useFeatureFlag } from '@/hooks/use-feature-flags';

function MyComponent() {
  const templatesEnabled = useFeatureFlag('templatesEnabled');

  if (!templatesEnabled) {
    return <LegacyTemplateUI />;
  }

  return <NewTemplateUI />;
}
```

## Advanced: Database-Backed Flags (Future)

The feature flag system is designed to support database-backed flags. To implement:

1. Create a `featureFlags` table in Convex
2. Add user/organization-specific flags
3. Update `lib/feature-flags.ts` to query database
4. Add admin UI for managing flags

Example future implementation:

```typescript
// convex/featureFlags.ts
export const getUserFlags = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const orgFlags = await ctx.db
      .query("featureFlags")
      .filter(q => q.eq(q.field("organizationId"), user.orgId))
      .first();

    return {
      templatesEnabled: orgFlags?.templatesEnabled ?? true,
      // ... other flags
    };
  }
});
```

## Troubleshooting

### Templates Not Showing
**Check**:
1. `NEXT_PUBLIC_FEATURE_TEMPLATES=true` in `.env.local`
2. Restart dev server after changing env vars
3. Clear Next.js cache: `rm -rf .next`

### Templates Showing in Development But Not Production
**Cause**: Default behavior is to enable in dev, disable in prod

**Fix**: Add to production environment:
```bash
NEXT_PUBLIC_FEATURE_TEMPLATES=true
```

### Changes Not Taking Effect
**Steps**:
1. Verify env var is set correctly
2. Restart development server
3. Clear browser cache
4. Check that env var starts with `NEXT_PUBLIC_` (required for client-side)

## Best Practices

1. **Always Test Before Production**
   - Test feature flags in staging environment first
   - Verify both enabled and disabled states work correctly

2. **Document Changes**
   - Add changelog entry when changing flags
   - Communicate flag changes to team

3. **Monitor After Enabling**
   - Watch error rates after enabling new features
   - Have rollback plan ready

4. **Use Granular Flags**
   - Enable features incrementally (e.g., view before create)
   - This minimizes risk and allows better testing

5. **Clean Up Old Flags**
   - Remove feature flags after full rollout
   - Keep codebase clean and maintainable

## Future Features

Planning to add feature flags for:
- `collaborationEnabled` - Real-time collaboration
- `aiAssistantEnabled` - AI writing assistant
- `advancedAnalyticsEnabled` - Advanced analytics dashboard
- `templateMarketplaceEnabled` - Public template sharing

---

**Need Help?** Check the implementation in:
- `lib/feature-flags.ts` - Feature flag configuration
- `hooks/use-feature-flags.ts` - React hooks for flags
- Component files - Usage examples
