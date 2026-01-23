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
