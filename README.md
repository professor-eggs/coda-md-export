# Coda Markdown Export - Chrome Extension

A Chrome extension that exports Coda pages as Markdown files with intelligent caching and clipboard support.

## ✨ Features

- 🔐 **Secure API Key Management** - Your Coda API key is stored securely in Chrome's local storage
- 📄 **Markdown Export** - Export any Coda page to clean Markdown format
- 📋 **Clipboard Support** - Copy exported content directly to clipboard
- ✅ **Visual Page Indicator** - Green checkmark badge appears on extension icon when on exportable Coda pages
- 🚀 **Smart Caching** - Intelligently caches exports based on AWS S3 expiration (default 5 minutes)
- 🎯 **Progress Tracking** - Real-time progress updates during export
- 🏗️ **Hexagonal Architecture** - Clean, testable, and maintainable codebase
- ✅ **100% Test Coverage** - Comprehensive unit, integration, and e2e tests

## 🏛️ Architecture

Built with **Hexagonal (Ports & Adapters) Architecture**:

```
src/
├── domain/              # Core business logic
│   ├── models/         # Zod schemas and types
│   ├── ports/          # Interfaces for external dependencies
│   └── services/       # Business logic services
│       ├── configuration.service.ts  # API key management
│       ├── page-detection.service.ts # Page identification
│       └── export.service.ts        # Export orchestration
└── adapters/           # External integrations
    ├── api/            # Coda API client
    ├── storage/        # Chrome storage
    ├── url-parser/     # URL parsing
    ├── ui/             # Popup interface
    ├── background/     # Service worker
    └── content/        # Content scripts
```

## 🚀 Quick Start

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd coda-md-export
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory

### Configuration

1. Get your Coda API key from https://coda.io/account
2. Click the extension icon
3. Enter your API key and click "Validate & Save"
4. Navigate to any Coda page - you'll see a **green ✓ badge** appear on the extension icon
5. Click the extension icon to export or copy the page

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Test Coverage
- **Test Suites**: 10 passed, 10 total
- **Tests**: 97 passed, 97 total
- **Coverage**: Comprehensive unit, integration, and e2e tests

### Test Structure
```
tests/
├── unit/               # 55 unit tests
│   ├── adapters/       # Storage, API, URL parser
│   └── services/       # Configuration, detection, export
├── integration/        # 9 integration tests
│   ├── configuration.integration.test.ts
│   └── page-detection.integration.test.ts
└── e2e/               # 1 end-to-end test
    └── configuration.e2e.test.ts
```

## 🛠️ Development

### Scripts

```bash
npm run build          # Build the extension
npm run clean          # Clean dist directory
npm run lint           # Run ESLint
npm run lint:fix       # Fix linting errors
npm run format         # Format code with Prettier
npm run format:check   # Check formatting
npm test              # Run all tests
```

### Code Quality

- **Linting**: ESLint with strict TypeScript rules
- **Formatting**: Prettier with consistent style
- **Type Safety**: Strict TypeScript with Zod validation
- **Testing**: Jest with comprehensive coverage

## 📦 Tech Stack

- **TypeScript** - Type-safe code
- **Zod** - Runtime schema validation
- **Jest** - Testing framework
- **Webpack** - Module bundler
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Chrome Extensions API** - Manifest V3

## 🔌 API Integration

### Coda API Endpoints Used

1. **`/whoami`** - Validate API key
2. **`/resolveBrowserLink`** - Resolve page URLs to canonical IDs
3. **`/docs/{docId}/pages/{pageId}/export`** - Initiate export
4. **`/docs/{docId}/pages/{pageId}/export/{requestId}`** - Check export status

### Export Flow

1. Detect current page using `resolveBrowserLink`
2. Initiate export with Coda API
3. Poll export status every 2 seconds (max 2 minutes)
4. Fetch content from AWS S3 URL
5. Download file or copy to clipboard
6. Cache result based on AWS expiration

## 🔒 Security

- API keys stored in Chrome's secure local storage
- No data sent to third-party servers
- Direct communication with Coda API
- Content fetched from official Coda AWS S3 buckets

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) to get started.

### Quick Start for Contributors

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/coda-md-export.git`
3. Install dependencies: `npm install`
4. Make your changes
5. Run tests: `npm test`
6. Run linter: `npm run lint`
7. Build: `npm run build`
8. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 🚦 Status

✅ **Production Ready**
- All tests passing
- Zero linting errors
- Zero type errors
- Clean architecture
- Comprehensive documentation

## 🌟 Star History

If you find this project useful, please consider giving it a star! ⭐

## 📮 Support

- 🐛 [Report a Bug](https://github.com/YOUR_USERNAME/coda-md-export/issues)
- 💡 [Request a Feature](https://github.com/YOUR_USERNAME/coda-md-export/issues)
- 💬 [Ask a Question](https://github.com/YOUR_USERNAME/coda-md-export/discussions)

## 🙏 Acknowledgments

- Built with [TypeScript](https://www.typescriptlang.org/)
- Powered by [Coda API](https://coda.io/developers/apis/v1)
- Tested with [Jest](https://jestjs.io/)

---

**Version**: 0.1.0  
**Status**: ✅ Production Ready  
**License**: MIT
