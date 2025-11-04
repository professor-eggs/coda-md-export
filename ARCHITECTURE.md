# Architecture Documentation

## Hexagonal Architecture (Ports & Adapters)

This project implements the Hexagonal Architecture pattern, also known as Ports and Adapters pattern.

## Visual Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                           (Popup UI)                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                            │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              ConfigurationService                       │    │
│  │  (Business Logic - Domain Service)                     │    │
│  │                                                         │    │
│  │  • saveApiKey(apiKey)                                  │    │
│  │  • getConfiguration()                                  │    │
│  │  • clearConfiguration()                                │    │
│  │  • validateCurrentConfiguration()                      │    │
│  └────────────┬──────────────────────────┬─────────────────┘    │
│               │                          │                      │
└───────────────┼──────────────────────────┼──────────────────────┘
                │                          │
                │ Uses Ports               │ Uses Ports
                │ (Interfaces)             │ (Interfaces)
                │                          │
        ┌───────▼─────────┐        ┌──────▼──────────┐
        │  StoragePort    │        │  ApiClientPort  │
        │  (Interface)    │        │  (Interface)    │
        └───────┬─────────┘        └──────┬──────────┘
                │                          │
                │ Implemented by           │ Implemented by
                │                          │
        ┌───────▼──────────────┐   ┌──────▼──────────────────┐
        │ ChromeStorageAdapter │   │  CodaApiAdapter         │
        │  (Concrete Impl)     │   │  (Concrete Impl)        │
        └───────┬──────────────┘   └──────┬──────────────────┘
                │                          │
                ▼                          ▼
        ┌────────────────┐         ┌─────────────────┐
        │ Chrome Storage │         │   Coda API      │
        │      API       │         │ (External API)  │
        └────────────────┘         └─────────────────┘
```

## Layer Responsibilities

### Domain Layer (Core)

**Location:** `src/domain/`

The domain layer contains pure business logic with no external dependencies.

#### Models (`src/domain/models/`)
- Define data structures using Zod schemas
- Provide TypeScript types via `z.infer<>`
- Validate data at runtime
- Examples:
  - `api.schema.ts`: API request/response models
  - `configuration.schema.ts`: Configuration models

#### Ports (`src/domain/ports/`)
- Define interfaces for external services
- Abstractions that allow us to swap implementations
- No concrete implementations
- Examples:
  - `storage.port.ts`: Storage operations interface
  - `api-client.port.ts`: API client operations interface
  - `url-parser.port.ts`: URL parsing interface

#### Services (`src/domain/services/`)
- Orchestrate business logic
- Use ports (interfaces) instead of concrete implementations
- Handle domain-specific validations and rules
- Examples:
  - `configuration.service.ts`: Manages API key configuration

### Adapter Layer (Infrastructure)

**Location:** `src/adapters/`

Adapters implement the ports (interfaces) using concrete technologies.

#### API Adapter (`src/adapters/api/`)
- Implements `ApiClientPort`
- Handles HTTP communication with Coda API
- Manages authentication (Bearer tokens)
- Validates responses with Zod schemas
- Converts API errors to domain errors

#### Storage Adapter (`src/adapters/storage/`)
- Implements `StoragePort`
- Uses Chrome's `storage.local` API
- Validates data before storage
- Handles storage errors gracefully

#### UI Adapter (`src/adapters/ui/`)
- Provides user interface (popup)
- Handles user interactions
- Displays results and errors
- Creates service instances with concrete adapters

#### Background Worker (`src/adapters/background/`)
- Chrome extension service worker
- Handles extension lifecycle events
- (Will handle export orchestration in future increments)

#### Content Script (`src/adapters/content/`)
- Runs on Coda pages
- (Will extract page information in future increments)

## Data Flow Example

Let's trace what happens when a user saves an API key:

```
1. User enters API key in popup UI
   └─> popup.ts: handleSave()

2. UI creates service with concrete adapters
   └─> new ConfigurationService(
       new ChromeStorageAdapter(),
       new CodaApiAdapter()
   )

3. UI calls service method
   └─> service.saveApiKey(apiKey)

4. Service validates input
   └─> ApiKeyConfigSchema.parse({ apiKey })

5. Service calls API through port
   └─> apiClient.whoami(apiKey)
       └─> CodaApiAdapter.whoami()
           └─> fetch('https://coda.io/apis/v1/whoami')
               └─> Returns User data

6. Service validates API response
   └─> UserSchema.parse(user)

7. Service saves through port
   └─> storage.saveApiKey(apiKey)
       └─> ChromeStorageAdapter.saveApiKey()
           └─> chrome.storage.local.set()

8. Service returns result
   └─> { isValid: true, userName: 'John Doe' }

9. UI displays success
   └─> "Successfully configured! Welcome, John Doe"
```

## Benefits of This Architecture

### 1. Testability

**Domain Logic Tests** (Unit Tests)
```typescript
// Test with mocks - no Chrome APIs needed
const mockStorage = createMock<StoragePort>();
const mockApi = createMock<ApiClientPort>();
const service = new ConfigurationService(mockStorage, mockApi);
```

**Adapter Tests** (Unit Tests)
```typescript
// Test Chrome adapter with mocked chrome.storage
global.chrome = { storage: mockStorage };
const adapter = new ChromeStorageAdapter();
```

**Integration Tests**
```typescript
// Test real adapters with mocked external APIs
const storage = new ChromeStorageAdapter(); // Real adapter
const api = new CodaApiAdapter();          // Real adapter
global.fetch = mockFetch;                  // Mock external API
```

### 2. Flexibility

Want to use a different storage mechanism?
```typescript
// Just create a new adapter
class LocalStorageAdapter implements StoragePort {
  // Implement interface using localStorage
}

// Use it
const service = new ConfigurationService(
  new LocalStorageAdapter(),  // Different storage!
  new CodaApiAdapter()
);
```

### 3. Maintainability

- **Clear separation of concerns**: Each layer has one responsibility
- **Easy to understand**: Follow the arrows (dependencies point inward)
- **Easy to change**: Swap adapters without touching domain logic

### 4. Type Safety

- **Compile-time safety**: TypeScript ensures interfaces are implemented correctly
- **Runtime safety**: Zod validates data at runtime
- **No `any` types**: Strict typing throughout

## Dependency Rule

The key principle of hexagonal architecture:

```
Dependencies always point INWARD
(From adapters → toward domain)

✅ Adapters depend on Ports (interfaces)
✅ Services use Ports (interfaces)
❌ Domain NEVER depends on adapters
❌ Domain NEVER depends on external frameworks
```

## File Organization

```
src/
├── domain/                 # Inner hexagon (pure logic)
│   ├── models/            # Data structures
│   ├── ports/             # Interfaces (boundaries)
│   └── services/          # Business logic
└── adapters/              # Outer hexagon (implementations)
    ├── api/              # External API adapter
    ├── storage/          # Storage adapter
    ├── ui/               # UI adapter
    ├── background/       # Background worker
    └── content/          # Content script
```

## Testing Strategy

### Unit Tests
- Test domain services with mocked ports
- Test adapters with mocked external APIs
- Fast execution (< 100ms each)
- High isolation

### Integration Tests
- Test real adapters together
- Mock only truly external things (Chrome APIs, network)
- Verify data flows correctly
- Medium speed (< 1s each)

### E2E Tests
- Test complete user journeys
- Simulate real user interactions
- Verify end-to-end behavior
- Slower but comprehensive

## Design Patterns Used

### 1. Dependency Injection
Services receive their dependencies through constructor:
```typescript
class ConfigurationService {
  constructor(
    private readonly storage: StoragePort,
    private readonly apiClient: ApiClientPort
  ) {}
}
```

### 2. Repository Pattern
Storage ports abstract data persistence:
```typescript
interface StoragePort {
  getConfiguration(): Promise<Configuration>;
  saveApiKey(apiKey: string): Promise<void>;
}
```

### 3. Adapter Pattern
Adapters convert between interfaces:
```typescript
class ChromeStorageAdapter implements StoragePort {
  async saveApiKey(apiKey: string): Promise<void> {
    // Convert domain operation to Chrome API call
    await chrome.storage.local.set({ /* ... */ });
  }
}
```

### 4. Strategy Pattern
Different adapters can be swapped at runtime:
```typescript
// Development
const service = new ConfigurationService(
  new MockStorageAdapter(),
  new MockApiAdapter()
);

// Production
const service = new ConfigurationService(
  new ChromeStorageAdapter(),
  new CodaApiAdapter()
);
```

## Validation Strategy

### Two-Layer Validation

1. **Compile-time (TypeScript)**
   - Ensures correct types are used
   - Catches errors during development
   - IDE support and autocomplete

2. **Runtime (Zod)**
   - Validates data from external sources
   - Catches unexpected data shapes
   - Provides helpful error messages

Example:
```typescript
// 1. Compile-time: TypeScript knows the shape
const user: User = await apiClient.whoami(apiKey);

// 2. Runtime: Zod validates the actual data
const validatedUser = UserSchema.parse(user);
// Throws if data doesn't match schema
```

## Error Handling

Errors flow from outer layers inward, then back out:

```
External Error → Adapter catches → Converts to domain error
    ↓
Service catches → Decides how to handle → Returns result
    ↓
UI receives result → Displays to user
```

Example:
```typescript
// Adapter: Catches HTTP error
catch (error) {
  throw new CodaApiError(message, status);
}

// Service: Catches domain error
catch (error) {
  return { isValid: false, error: error.message };
}

// UI: Displays result
if (!result.isValid) {
  showMessage(result.error, 'error');
}
```

## Future Architecture Extensions

### Increment 2: URL Parser
```
┌─────────────────┐
│  UrlParserPort  │ (New interface)
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ CodaUrlParserAdapter│ (New adapter)
└─────────────────────┘
```

### Increment 3: Export Service
```
┌──────────────────┐
│  ExportService   │ (New domain service)
└────────┬─────────┘
         │
         ├──> ApiClientPort (existing)
         ├──> StoragePort (existing)
         └──> DownloaderPort (new interface)
                    │
                    ▼
            ┌────────────────────┐
            │ ChromeDownloader   │ (New adapter)
            └────────────────────┘
```

## Conclusion

This architecture provides:
- ✅ **Testability**: Easy to test with mocks
- ✅ **Flexibility**: Easy to swap implementations
- ✅ **Maintainability**: Clear structure and responsibilities
- ✅ **Type Safety**: Compile-time and runtime validation
- ✅ **Scalability**: Easy to add new features

The domain logic is completely isolated from external concerns, making it easy to understand, test, and maintain.

