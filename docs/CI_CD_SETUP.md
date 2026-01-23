# CI/CD Pipeline Setup Guide

This document explains how to configure and test the CI/CD pipeline for TakeScript.

## Overview

The CI/CD pipeline automatically runs on every push and pull request to ensure code quality. It includes:

- **Linting**: ESLint checks for code style issues
- **Testing**: Vitest runs all unit and integration tests
- **Coverage**: Test coverage reports generated
- **Build Check**: Verifies Next.js build succeeds
- **TypeScript**: Validates all type definitions
- **Preview Deploy** (optional): Deploys PR previews to Vercel

## Files Created

The following files have been created in your repository:

1. **`.github/workflows/test.yml`** - GitHub Actions workflow definition
2. **`.github/CONTRIBUTING.md`** - Contribution guidelines for contributors
3. **`.github/pull_request_template.md`** - PR template for consistent pull requests

## Required GitHub Secrets

You need to manually configure these secrets in your GitHub repository for the pipeline to work.

### Access Settings

Go to: **Settings → Secrets and variables → Actions → New repository secret**

### Required Secrets (for builds)

These are **required** for the build check to succeed:

| Secret Name                         | Description                | Where to Find                                |
| ----------------------------------- | -------------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`            | Your Convex deployment URL | Convex Dashboard → Settings → Deployment URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key      | Clerk Dashboard → API Keys → Publishable key |
| `CLERK_SECRET_KEY`                  | Clerk secret key           | Clerk Dashboard → API Keys → Secret key      |

### Optional Secrets (for preview deployments)

These are **optional** and only needed if you want automatic PR preview deployments:

| Secret Name         | Description             | Where to Find                                    |
| ------------------- | ----------------------- | ------------------------------------------------ |
| `VERCEL_TOKEN`      | Vercel deployment token | Vercel → Settings → Tokens → Create Token        |
| `VERCEL_ORG_ID`     | Vercel organization ID  | Vercel → Settings → General → Organization ID    |
| `VERCEL_PROJECT_ID` | Vercel project ID       | Vercel Project → Settings → General → Project ID |

### Optional Secrets (for coverage reports)

These are **optional** and only needed if you want coverage reports on Codecov:

| Secret Name     | Description          | Where to Find                                   |
| --------------- | -------------------- | ----------------------------------------------- |
| `CODECOV_TOKEN` | Codecov upload token | Codecov.io → Repository Settings → Upload Token |

## Branch Protection Rules

To enforce CI checks before merging, configure branch protection rules:

### Setup Instructions

1. Go to: **Settings → Branches → Add branch protection rule**
2. Configure the following:

**Branch name pattern**: `main`

**Required checks**:

- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging
- Status checks that are required:
  - `Run Tests`
  - `Build Check`

**Pull request requirements**:

- ✅ Require a pull request before merging
- ✅ Require approvals: 1 (adjust based on team size)
- ✅ Dismiss stale pull request approvals when new commits are pushed

**Additional settings** (recommended):

- ✅ Require linear history (prevents merge commits)
- ✅ Do not allow bypassing the above settings

**Allow force pushes**: ❌ (disabled)
**Allow deletions**: ❌ (disabled)

### What This Does

- PRs cannot be merged until all CI checks pass
- PRs must be up to date with main branch before merging
- At least 1 reviewer must approve the PR
- Stale approvals are dismissed when new code is pushed
- Prevents accidental force pushes to main

## Testing the CI/CD Pipeline

### Test 1: Verify Workflow Runs on Push

```bash
# Make sure you're on the Fixes branch
git checkout Fixes

# Add the new CI/CD files
git add .github/workflows/test.yml .github/CONTRIBUTING.md .github/pull_request_template.md docs/CI_CD_SETUP.md

# Commit the changes
git commit -m "ci: Add CI/CD pipeline with GitHub Actions"

# Push to trigger the workflow
git push origin Fixes
```

**Expected Result**:

- Go to GitHub → Actions tab
- See workflow run for your commit
- All jobs should appear: "Run Tests", "Build Check"
- Check if jobs pass or fail

### Test 2: Create a Test Pull Request

```bash
# Create a test branch from main
git checkout main
git pull origin main
git checkout -b test-ci-pipeline

# Make a trivial change
echo "# Testing CI/CD" >> README.md

# Commit and push
git add README.md
git commit -m "test: Verify CI/CD pipeline on PR"
git push origin test-ci-pipeline
```

Then on GitHub:

1. Create a Pull Request from `test-ci-pipeline` to `main`
2. Observe the PR template appears automatically
3. Watch the CI checks run automatically
4. Verify all checks pass (green checkmarks)
5. See if merge button is enabled/disabled based on check status

### Test 3: Test Failure Scenario (Intentional)

```bash
# Still on test-ci-pipeline branch
# Create an intentionally failing test
cat > test/ci-test.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';

describe('CI Pipeline Test', () => {
  it('should fail intentionally', () => {
    expect(1 + 1).toBe(3);  // This will fail
  });
});
EOF

# Commit and push
git add test/ci-test.test.ts
git commit -m "test: Add intentional failing test"
git push
```

**Expected Result**:

- CI workflow runs again
- "Run Tests" job fails
- Red X appears on PR
- Merge button is disabled (if branch protection is enabled)

**Clean up the failure**:

```bash
# Fix the test
cat > test/ci-test.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';

describe('CI Pipeline Test', () => {
  it('should pass correctly', () => {
    expect(1 + 1).toBe(2);  // Correct assertion
  });
});
EOF

# Commit and push
git add test/ci-test.test.ts
git commit -m "test: Fix failing test"
git push
```

**Expected Result**:

- CI runs again
- All checks pass
- Green checkmarks appear
- Merge button is enabled

### Test 4: Verify Build Check

The build check ensures the app can compile with the secrets:

1. Check the "Build Check" job in Actions
2. Verify it uses the secrets you configured
3. Confirm TypeScript check runs
4. Ensure build succeeds

If build fails:

- Check that all required secrets are set correctly
- Verify secret values are correct (no typos)
- Look at the detailed logs in the Actions tab

### Test 5: Clean Up

After verifying everything works:

```bash
# Delete the test file
rm test/ci-test.test.ts
git add test/ci-test.test.ts
git commit -m "test: Remove CI test file"
git push

# Merge the PR on GitHub
# Then delete the branch
git checkout main
git pull origin main
git branch -d test-ci-pipeline
git push origin --delete test-ci-pipeline
```

## Success Criteria

Your CI/CD pipeline is successfully configured when:

- ✅ Workflow runs automatically on every push to main/Fixes
- ✅ Workflow runs automatically on every pull request
- ✅ All jobs complete successfully (green checkmarks)
- ✅ Failing tests cause the workflow to fail
- ✅ Build succeeds with environment secrets
- ✅ TypeScript check passes without errors
- ✅ PR template appears when creating PRs
- ✅ Branch protection prevents merging with failing checks

## Troubleshooting

### Issue: Build fails with "Missing environment variable"

**Solution**: Double-check that all required secrets are set in GitHub Settings → Secrets

### Issue: Tests pass locally but fail in CI

**Possible causes**:

- Environment differences (Node version, dependencies)
- Test relies on local files/setup not in repository
- Async timing issues that appear in CI environment

**Solution**: Run tests with `npm ci` locally to match CI environment

### Issue: Workflow doesn't trigger

**Solution**:

- Verify workflow file is in `.github/workflows/` directory
- Check YAML syntax is valid (use YAML validator)
- Ensure branch names match what's configured in `on.push.branches`

### Issue: TypeScript check fails in CI but works locally

**Solution**:

- Run `npx tsc --noEmit` locally to reproduce
- Check for missing type definitions in dependencies
- Verify `tsconfig.json` is committed to repository

### Issue: Preview deployment fails (optional job)

**Solution**:

- This is optional, you can comment out the `preview` job
- If you want previews, ensure all Vercel secrets are set correctly
- Verify Vercel project is linked to the GitHub repository

## Benefits

With the CI/CD pipeline configured, you get:

1. **Automated Testing**: Every change is tested automatically
2. **Prevent Regressions**: Breaking changes caught before merge
3. **Team Confidence**: Main branch is always stable
4. **Code Review**: Reviewers see test results immediately
5. **Documentation**: CI logs provide debugging information
6. **Quality Gates**: Enforce standards automatically

## Cost Considerations

**GitHub Actions Free Tier**:

- 2,000 minutes/month for private repositories
- Unlimited for public repositories

**Estimated Usage**:

- ~5 minutes per workflow run
- ~10 PRs per week = 50 minutes/week
- ~200 minutes/month (well within free tier)

## Next Steps

After setting up CI/CD:

1. ✅ Configure GitHub secrets (required)
2. ✅ Set up branch protection rules (recommended)
3. ✅ Test the pipeline with a sample PR
4. ✅ Review and update CONTRIBUTING.md for your team
5. ✅ Communicate workflow to team members
6. ✅ Monitor Actions tab for failures

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Vercel GitHub Integration](https://vercel.com/docs/git/vercel-for-github)

---

**Note**: The CI/CD pipeline is now ready to use. Make sure to configure the GitHub secrets before expecting builds to pass.
