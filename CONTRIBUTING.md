# Contributing to Coda Markdown Export

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## Getting Started

1. **Fork the repository** and clone your fork
2. **Install dependencies**: `npm install`
3. **Build the extension**: `npm run build`
4. **Run tests**: `npm test`

## Development Setup

### Prerequisites
- Node.js 16+ and npm
- Chrome/Chromium browser for testing
- Basic understanding of TypeScript and Chrome Extensions

### Project Structure
```
src/
├── domain/          # Core business logic
│   ├── models/      # Zod schemas and types
│   ├── ports/       # Interfaces for external dependencies
│   └── services/    # Business logic services
└── adapters/        # External integrations
    ├── api/         # Coda API client
    ├── storage/     # Chrome storage
    ├── ui/          # Popup interface
    ├── background/  # Service worker
    └── content/     # Content scripts
```

## Development Workflow

### 1. Create a Branch
```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

Follow these guidelines:
- **Code Style**: Run `npm run lint` and `npm run format`
- **Architecture**: Follow hexagonal architecture principles
- **TypeScript**: Use strict typing, no `any` types
- **Validation**: Use Zod for runtime validation

### 3. Write Tests

All new features require tests:
```bash
# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.ts

# Run with coverage
npm test -- --coverage
```

**Test Requirements**:
- Unit tests for services
- Integration tests for service interactions
- Maintain 100% test pass rate

### 4. Build and Test Extension

```bash
# Build the extension
npm run build

# Load in Chrome:
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the `dist` directory
```

### 5. Commit Your Changes

Use conventional commit messages:
```bash
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug in export"
git commit -m "docs: update README"
git commit -m "test: add tests for page detection"
```

**Commit Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

## Code Standards

### TypeScript
- Use strict mode
- No `any` types (use `unknown` with type guards)
- Prefer interfaces over types for public APIs
- Use `readonly` where appropriate

### Testing
- Test coverage should remain at or near 100%
- Write descriptive test names
- Use AAA pattern (Arrange, Act, Assert)
- Mock external dependencies

### Architecture
- Follow hexagonal architecture
- Keep domain logic pure (no side effects)
- Use ports for all external dependencies
- Keep adapters thin

## Pull Request Process

1. **Update Documentation**: Update README.md if needed
2. **Run Full Test Suite**: Ensure all tests pass
3. **Run Linter**: Fix all linting errors
4. **Build Successfully**: Ensure `npm run build` works
5. **Create PR**: 
   - Use a clear title
   - Describe what changed and why
   - Reference any related issues
   - Include screenshots for UI changes

### PR Title Format
```
[Type] Brief description

Examples:
[Feature] Add batch export functionality
[Fix] Resolve caching issue on tab switch
[Docs] Improve installation instructions
```

## Reporting Issues

When reporting issues, please include:
- Chrome version
- Extension version
- Steps to reproduce
- Expected vs actual behavior
- Console errors (if any)
- Screenshots (if applicable)

## Feature Requests

Feature requests are welcome! Please:
- Check if it's already been requested
- Describe the use case clearly
- Explain why it would be valuable
- Consider contributing it yourself!

## Code Review

All PRs require review. Reviewers will check:
- ✅ Code quality and style
- ✅ Test coverage
- ✅ Architecture consistency
- ✅ Documentation updates
- ✅ No breaking changes (or properly documented)

## Questions?

- Open an issue for questions
- Check existing issues and PRs
- Review the [Architecture Guide](ARCHITECTURE.md)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🎉

