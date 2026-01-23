# Remaining Code Quality Improvements

This document outlines the remaining phases for TakeScript code quality improvements. Phases 0-4 have been completed successfully with 26 passing tests and 4 critical bugs fixed.

## Status Summary

### ✅ Completed Phases (Phases 0-4)
- **Phase 0**: Testing infrastructure (Vitest, React Testing Library, mocks)
- **Phase 1**: Autosave race condition fix (save queue implementation)
- **Phase 2**: Silent error failures fix (logger utility, user notifications)
- **Phase 3**: Memory leaks fix (stable event listener references)
- **Phase 4**: Deep comparison optimization (fast-deep-equal library)

### 🔄 Remaining Phases (Phases 5-6)
These phases focus on **automation and infrastructure** to maintain code quality over time.

---

## Phase 5: Add Pre-commit Hooks

**Goal**: Enforce quality gates before commits
**Duration**: 1 hour
**Priority**: High (prevents bad code from entering the repository)

### Overview

Pre-commit hooks automatically run checks before allowing a commit. This ensures:
- Code follows linting standards
- Tests pass before committing
- Formatting is consistent
- No accidental commits of broken code

### Implementation Steps

#### 1. Install Dependencies

```bash
npm install --save-dev husky lint-staged
npx husky init
```

#### 2. Create Pre-commit Hook

Create file: `.husky/pre-commit`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

Make it executable:

```bash
chmod +x .husky/pre-commit
```

#### 3. Configure lint-staged

Create file: `.lintstagedrc.json`

```json
{
  "*.{ts,tsx}": [
    "eslint --fix",
    "vitest related --run --reporter=verbose"
  ],
  "*.{js,jsx,ts,tsx,json,css,md}": [
    "prettier --write"
  ]
}
```

**What this does**:
- For TypeScript files: Runs ESLint to fix issues, then runs tests related to changed files
- For all files: Formats code with Prettier (if configured)

#### 4. Update package.json

Add to `scripts` section:

```json
{
  "scripts": {
    "prepare": "husky"
  }
}
```

#### 5. Optional: Install Prettier

If not already installed:

```bash
npm install --save-dev prettier
```

Create `.prettierrc.json`:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": false,
  "printWidth": 100,
  "tabWidth": 2
}
```

Create `.prettierignore`:

```
node_modules
.next
convex/_generated
coverage
dist
build
```

### Testing the Setup

#### Test 1: Lint Error Prevention

```bash
# Create a file with a lint error
echo "const x = 'test'" > test-file.ts

# Try to commit (should be blocked)
git add test-file.ts
git commit -m "Test hook"
# Expected: Commit blocked by ESLint

# Fix the error
echo "const x = 'test';" > test-file.ts

# Commit again (should succeed)
git add test-file.ts
git commit -m "Test hook"
# Expected: Commit succeeds

# Clean up
git reset HEAD~1
rm test-file.ts
```

#### Test 2: Failing Test Prevention

```bash
# Create a failing test
cat > test/failing-test.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
describe('Intentional Failure', () => {
  it('should fail', () => {
    expect(1 + 1).toBe(3);
  });
});
EOF

# Try to commit (should be blocked)
git add test/failing-test.test.ts
git commit -m "Test failing test prevention"
# Expected: Commit blocked by Vitest

# Clean up
git checkout test/
```

### Success Criteria

- ✅ Husky installed and initialized
- ✅ Commits with lint errors are blocked
- ✅ Commits with failing tests are blocked
- ✅ Valid commits work normally
- ✅ Hook runs only on staged files (fast)

### Benefits

1. **Prevents Broken Code**: Bad code never enters the repository
2. **Faster Reviews**: Reviewers don't waste time on lint issues
3. **Consistent Quality**: Every commit meets quality standards
4. **Team Alignment**: Same standards enforced for all developers
5. **Early Detection**: Catch issues before they reach CI/CD

### Troubleshooting

**Issue**: Hook doesn't run
- **Solution**: Ensure `.husky/pre-commit` is executable: `chmod +x .husky/pre-commit`

**Issue**: Hook is too slow
- **Solution**: Use `vitest related` instead of running all tests
- **Alternative**: Use `lint-staged` with specific file patterns

**Issue**: Hook blocks legitimate commits
- **Solution**: Fix the underlying issue first
- **Emergency bypass**: `git commit --no-verify` (use sparingly!)

---

## Phase 6: Add CI/CD Pipeline

**Goal**: Automate testing on every PR
**Duration**: 1-2 hours
**Priority**: High (ensures all changes are tested)

### Overview

Continuous Integration/Continuous Deployment (CI/CD) automatically runs tests and builds on every pull request. This ensures:
- All tests pass before merging
- Code builds successfully
- No breaking changes slip through
- Team has confidence in main branch

### Implementation Steps

#### 1. Create GitHub Actions Workflow

Create file: `.github/workflows/test.yml`

```yaml
name: Test

on:
  push:
    branches: [main, Fixes]
  pull_request:
    branches: [main, Fixes]

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm run test:run

      - name: Generate coverage
        run: npm run test:coverage

      - name: Upload coverage to Codecov (optional)
        if: github.event_name == 'pull_request'
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/coverage-final.json
          fail_ci_if_error: false

  build:
    name: Build Check
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build
        env:
          # Mock environment variables for build
          NEXT_PUBLIC_CONVEX_URL: ${{ secrets.NEXT_PUBLIC_CONVEX_URL }}
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}
          CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}

      - name: Check TypeScript
        run: npx tsc --noEmit

  # Optional: Deploy preview for PRs
  preview:
    name: Deploy Preview
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    needs: [test, build]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to Vercel Preview
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          scope: ${{ secrets.VERCEL_ORG_ID }}
```

#### 2. Configure GitHub Repository Settings

**Branch Protection Rules** (Settings → Branches → Add rule):

1. Branch name pattern: `main`
2. Require status checks to pass before merging:
   - ✅ Run Tests
   - ✅ Build Check
3. Require branches to be up to date before merging: ✅
4. Require pull request reviews: ✅ (at least 1 approval)
5. Dismiss stale pull request approvals: ✅
6. Require linear history: ✅

#### 3. Set Up GitHub Secrets

**Required Secrets** (Settings → Secrets and variables → Actions):

For Build:
- `NEXT_PUBLIC_CONVEX_URL`: Your Convex deployment URL
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk publishable key
- `CLERK_SECRET_KEY`: Clerk secret key

Optional for Preview Deployments:
- `VERCEL_TOKEN`: Vercel deployment token
- `VERCEL_ORG_ID`: Vercel organization ID
- `VERCEL_PROJECT_ID`: Vercel project ID

Optional for Coverage:
- `CODECOV_TOKEN`: Codecov upload token

#### 4. Create Contributing Guidelines

Create file: `.github/CONTRIBUTING.md`

```markdown
# Contributing to TakeScript

Thank you for considering contributing to TakeScript! Here's how to ensure your PR is accepted quickly.

## Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards:
   - Write tests for new functionality
   - Update existing tests if you change behavior
   - Follow existing code style (enforced by ESLint)

3. **Test locally** before pushing:
   ```bash
   npm run lint        # Check linting
   npm run test        # Run all tests
   npm run build       # Ensure build succeeds
   ```

4. **Commit with clear messages**:
   ```bash
   git commit -m "feat: Add new feature description"
   ```

   Use conventional commit format:
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `test:` Test additions/changes
   - `refactor:` Code refactoring
   - `perf:` Performance improvements

5. **Push your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** on GitHub:
   - Provide a clear description of changes
   - Link any related issues
   - Ensure all CI checks pass

## Code Quality Standards

All PRs must pass:
- ✅ **Linting**: No ESLint errors
- ✅ **Tests**: All tests pass, coverage maintained
- ✅ **Build**: Next.js build succeeds
- ✅ **TypeScript**: No type errors

## Pre-commit Hooks

We use Husky to run checks before commits:
- Automatic linting and fixing
- Related tests run on changed files
- Prevents committing broken code

If checks fail, fix the issues before committing.

## Getting Help

- **Questions**: Open a discussion on GitHub
- **Bugs**: Create an issue with reproduction steps
- **Features**: Discuss in an issue before implementing

## Code of Conduct

Be respectful and constructive in all interactions.
```

#### 5. Create Pull Request Template

Create file: `.github/pull_request_template.md`

```markdown
## Description

<!-- Describe your changes in detail -->

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## How Has This Been Tested?

<!-- Describe the tests you ran to verify your changes -->

- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing

## Checklist

- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published

## Screenshots (if applicable)

<!-- Add screenshots to show visual changes -->

## Related Issues

<!-- Link related issues: Fixes #123, Related to #456 -->
```

### Testing the CI/CD Pipeline

#### Test 1: Create Test Branch and PR

```bash
# Create test branch
git checkout -b test-ci-pipeline
echo "// Test CI" >> README.md
git add README.md
git commit -m "test: Verify CI/CD pipeline"
git push origin test-ci-pipeline
```

Then:
1. Go to GitHub and create a Pull Request
2. Verify GitHub Actions runs automatically
3. Check that all checks appear in the PR
4. Verify checks pass (green checkmarks)

#### Test 2: Test Failure Scenario

```bash
# Create failing test
cat > test/failing-test.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
describe('Intentional Failure', () => {
  it('should fail', () => {
    expect(1 + 1).toBe(3);
  });
});
EOF

git add test/failing-test.test.ts
git commit -m "test: Add failing test"
git push
```

Verify:
1. CI fails with clear error message
2. Merge button is disabled
3. Status check shows failure

Clean up:
```bash
rm test/failing-test.test.ts
git add test/failing-test.test.ts
git commit -m "test: Remove failing test"
git push
```

Verify:
1. CI passes
2. Merge button is enabled
3. Status checks are green

#### Test 3: Merge and Verify

1. Merge the test PR
2. Verify main branch CI runs successfully
3. Clean up test branch

### Success Criteria

- ✅ Workflow runs on PR creation
- ✅ Tests run successfully in CI
- ✅ Build succeeds in CI
- ✅ Workflow fails when tests fail
- ✅ PR cannot merge with failing checks
- ✅ Branch protection rules enforced

### Benefits

1. **Automated Testing**: Every change is tested automatically
2. **Prevent Regressions**: Breaking changes caught before merge
3. **Team Confidence**: Main branch is always stable
4. **Code Review**: Reviewers see test results immediately
5. **Documentation**: CI logs provide debugging information

### Cost Considerations

**GitHub Actions Free Tier**:
- 2,000 minutes/month for private repos
- Unlimited for public repos

**Estimate for TakeScript**:
- ~5 minutes per workflow run
- ~10 PRs per week = 50 minutes/week = 200 minutes/month
- Well within free tier

### Advanced Configurations (Optional)

#### Matrix Testing (Multiple Node Versions)

```yaml
jobs:
  test:
    strategy:
      matrix:
        node-version: [18, 20, 21]
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
```

#### Caching for Faster Builds

Already included in workflow with `cache: 'npm'`

#### Conditional Workflows

```yaml
on:
  push:
    branches: [main]
    paths-ignore:
      - '**.md'
      - 'docs/**'
```

#### Deploy on Merge

```yaml
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Production
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-args: '--prod'
```

---

## Implementation Timeline

### Recommended Schedule

**Week 1**:
- **Day 1**: Implement Phase 5 (pre-commit hooks) - 1 hour
- **Day 2**: Test pre-commit hooks with team - 30 minutes
- **Day 3**: Implement Phase 6 (CI/CD) - 2 hours
- **Day 4**: Test CI/CD pipeline - 1 hour
- **Day 5**: Document and train team - 1 hour

**Total Time**: ~5-6 hours spread over a week

### Team Coordination

1. **Announce Changes**: Notify team about new hooks
2. **Migration Period**: Allow 1 week for team to adapt
3. **Support**: Be available for questions
4. **Iterate**: Adjust based on feedback

---

## Verification Checklist

After implementing both phases, verify:

### Phase 5 Verification
- [ ] Husky is installed and active
- [ ] Pre-commit hook runs on `git commit`
- [ ] Lint errors block commits
- [ ] Failing tests block commits
- [ ] Valid commits succeed normally
- [ ] Hook runs quickly (<10 seconds for typical changes)

### Phase 6 Verification
- [ ] GitHub Actions workflow exists
- [ ] Workflow runs on PR creation
- [ ] Workflow runs on push to main
- [ ] Tests execute in CI environment
- [ ] Build succeeds in CI environment
- [ ] Failed checks prevent merging
- [ ] Branch protection rules active
- [ ] Team can see CI results in PRs

---

## Maintenance

### Regular Tasks

**Weekly**:
- Monitor CI/CD usage (stay within free tier)
- Review failed workflow runs

**Monthly**:
- Update dependencies in workflow
- Review and update linting rules
- Check coverage trends

**Quarterly**:
- Review workflow performance
- Update Node.js version in CI
- Evaluate new GitHub Actions features

### Updating Hooks

To modify pre-commit checks:

1. Edit `.lintstagedrc.json`
2. Test locally: `npx lint-staged`
3. Commit and push
4. Team automatically gets updates on next `npm install`

### Updating CI Workflow

To modify GitHub Actions:

1. Edit `.github/workflows/test.yml`
2. Push to test branch
3. Create PR to verify changes
4. Merge when verified

---

## Troubleshooting

### Common Issues

#### Issue: "Husky not installed" error

**Cause**: `husky` not properly initialized
**Solution**:
```bash
npx husky install
git config core.hooksPath .husky
```

#### Issue: CI runs but tests fail with module errors

**Cause**: Missing dependencies in CI
**Solution**: Ensure `npm ci` runs before tests in workflow

#### Issue: CI times out

**Cause**: Tests take too long
**Solution**:
- Optimize slow tests
- Increase timeout in workflow: `timeout-minutes: 30`
- Use `vitest --no-coverage` for faster runs

#### Issue: Branch protection blocks emergency fixes

**Cause**: Strict branch protection rules
**Solution**:
- Create separate `hotfix/*` branch pattern with relaxed rules
- Or use admin override (use sparingly)

---

## Expected Outcomes

After implementing both phases:

### Developer Experience
- ✅ **Faster Development**: Catch issues early (pre-commit)
- ✅ **Confidence**: Know code works before pushing
- ✅ **Less Rework**: Fix issues immediately, not days later

### Code Quality
- ✅ **Consistent Style**: All code follows linting rules
- ✅ **Test Coverage**: All changes are tested
- ✅ **Stable Main**: Main branch always builds and passes tests

### Team Efficiency
- ✅ **Faster Reviews**: No time wasted on style issues
- ✅ **Fewer Bugs**: Issues caught before merge
- ✅ **Better Onboarding**: New devs see standards immediately

---

## Next Steps

1. **Schedule Implementation**: Block time for Phase 5 setup (1 hour)
2. **Notify Team**: Announce pre-commit hooks are coming
3. **Implement Phase 5**: Follow steps above
4. **Test Thoroughly**: Ensure hooks work for all team members
5. **Implement Phase 6**: Set up GitHub Actions
6. **Monitor**: Watch CI usage and adjust as needed

---

## Questions or Issues?

If you encounter problems during implementation:

1. Check this document's troubleshooting section
2. Review GitHub Actions logs for CI issues
3. Test hooks locally with: `npx husky run .husky/pre-commit`
4. Consult team members who have implemented similar setups

---

**Document Version**: 1.0
**Last Updated**: 2026-01-24
**Maintained By**: TakeScript Team
