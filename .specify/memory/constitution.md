<!--
  ============================================================================
  SYNC IMPACT REPORT
  ============================================================================
  Version Change: Initial → 1.0.0

  Modified Principles:
  - None (initial creation)

  Added Sections:
  - I. Monorepo Modularity
  - II. Service-Oriented Architecture
  - III. Test-First Development
  - IV. Type Safety & Validation
  - V. Client-Agnostic Core
  - Technology Stack Requirements
  - Quality Standards
  - Development Workflow

  Removed Sections:
  - None (initial creation)

  Templates Requiring Updates:
  ✅ plan-template.md - Updated with constitution references
  ✅ spec-template.md - Aligned with test-first and modularity principles
  ✅ tasks-template.md - Task organization reflects service boundaries

  Follow-up TODOs:
  - None
  ============================================================================
-->

# Mud Constitution

An AI-assisted multiplayer text adventure game built on microservices architecture with a single unified world.

## Core Principles

### I. Monorepo Modularity

Every service and library in the Mud monorepo MUST be independently deployable, testable, and maintainable.

**Mandates**:

- Services communicate exclusively via REST APIs (no direct database access between services)
- Shared code MUST reside in `libs/` as reusable packages (`@mud/database`, `@mud/redis-client`, etc.)
- Each app MUST have its own `package.json`, `tsconfig.json`, and test configuration
- Dependencies between packages MUST be explicitly declared in `package.json`
- No circular dependencies between apps or libs

**Rationale**: Modularity enables parallel development, independent scaling, and clear ownership boundaries. Shared libraries prevent code duplication while maintaining service isolation.

### II. Service-Oriented Architecture

The game engine (`@mud/dm`) serves as the single source of truth for game state and logic. Client adapters (Slack, Discord, Web) are thin translation layers.

**Mandates**:

- Game logic MUST reside in `@mud/dm` or `@mud/engine` libraries, never in client adapters
- Client adapters MUST only handle platform-specific I/O (parsing commands, formatting responses)
- All players interact in a single shared world regardless of client platform
- Service-to-service communication MUST use GCP Cloud Run authentication
- Players MUST be identified by client-agnostic IDs (`clientId` format: `<platform>:<platform-id>`)

**Rationale**: Client-agnostic architecture enables multi-platform support (Slack, Discord, Web, CLI) without duplicating game logic. A single world creates authentic multiplayer experiences.

### III. Test-First Development (NON-NEGOTIABLE)

Tests MUST be written before implementation. Coverage targets are mandatory quality gates.

**Mandates**:

- Minimum 80% coverage for branches, statements, lines, and functions across all apps
- Tests MUST mock external dependencies (database, Redis, HTTP calls, AI APIs)
- Tests MUST mock environment variables using `jest.mock()` to prevent initialization failures
- Integration tests MUST verify service contracts and inter-service communication
- Clean up resources in `afterEach`/`afterAll` hooks
- Use descriptive test names with `describe` blocks for context
- Test both happy paths AND edge cases

**Rationale**: Test-first development catches regressions early, documents expected behavior, and enables confident refactoring. High coverage thresholds ensure production reliability.

### IV. Type Safety & Validation

TypeScript strict mode is mandatory. Runtime validation protects service boundaries.

**Mandates**:

- Use strict TypeScript configuration with null checks enabled
- Prefer explicit types over `any`
- Environment variables MUST be validated with `envalid` in dedicated `env.ts` files
- Environment validation MUST NOT call `process.exit()` to avoid breaking tests
- DTOs MUST validate input at REST endpoints
- Prisma schema is the single source of truth for database types
- Use `readonly` for immutable properties

**Rationale**: Strong typing catches errors at compile time. Runtime validation prevents invalid data from corrupting game state. Test-friendly environment validation avoids CI/CD failures.

### V. Client-Agnostic Core

Game mechanics MUST work identically regardless of whether a player uses Slack, Discord, Web, or CLI.

**Mandates**:

- Core game entities (Player, Monster, Tile, Party) MUST NOT contain client-specific fields
- Client-specific data (Slack tokens, Discord guild IDs) belongs in separate tables or adapter state
- REST API endpoints MUST accept generic `clientId`, not platform-specific IDs
- Event notifications MUST be platform-agnostic (adapters format for their platform)
- AI-generated content MUST be cached by game state, not by client

**Rationale**: Platform independence enables seamless migration (e.g., Slack user switching to Web), cross-platform parties, and new client additions without core changes.

## Technology Stack Requirements

### Primary Stack

- **Language**: TypeScript 5.9+ with strict mode enabled
- **Monorepo**: Turborepo with task caching and parallel execution
- **Backend Framework**: NestJS for `@mud/dm` and `@mud/world` services
- **API Protocol**: REST with JSON payloads (future: GraphQL or gRPC for performance-critical paths)
- **Database**: PostgreSQL 15+ with Prisma ORM
- **Cache**: Redis 7+ for world rendering, tile descriptions, and coordination locks
- **Testing**: Jest with SWC transform (`@swc/jest`)
- **Deployment**: Google Cloud Platform (Cloud Run) with Terraform IaC

### Service-Specific Requirements

- **DM Service**: OpenAI API integration with retry logic and exponential backoff
- **Slack Bot**: Slack Bolt SDK with socket mode or HTTP events
- **World Service**: Procedural generation algorithms with Redis caching
- **Tick Service**: Scheduled Cloud Run job for world state advancement

### Build Tools

- **Linting**: ESLint with Prettier integration
- **Formatting**: Prettier for TypeScript, Markdown, YAML, JSON
- **Pre-commit**: Husky + lint-staged for automated formatting
- **CI/CD**: GitHub Actions for testing, building, and deployment

## Quality Standards

### Test Coverage Targets

All apps MUST meet these minimum coverage thresholds:

- **Branches**: 80%
- **Statements**: 80%
- **Lines**: 80%
- **Functions**: 80%

Coverage reports are generated via `yarn test -- --coverage`.

### Code Quality

- No `any` types without explicit justification and `@ts-ignore` comment
- Functions MUST have single responsibility
- Cyclomatic complexity MUST NOT exceed 10 without justification
- DRY principle: Shared logic belongs in `libs/`
- YAGNI principle: Don't add features until needed

### Documentation

- Each app MUST have a `README.md` or `SETUP.md`
- Complex game mechanics MUST be documented (e.g., `GAME_FLOW.md`, `TILE_OPERATIONS.md`)
- API contracts MUST be documented (REST decorators for OpenAPI generation)
- Prisma schema MUST include comments for non-obvious fields

### Performance Standards

- REST endpoints MUST respond within 200ms p95 (excluding AI generation)
- AI-generated descriptions MUST be cached with appropriate TTLs
- Redis operations MUST have timeouts to prevent hanging
- Database queries MUST use indexes for frequently accessed fields
- Tile rendering MUST leverage cache-aside pattern

## Development Workflow

### Feature Development

1. **Spec Definition**: Create feature spec in `.specify/` with user stories and acceptance criteria
2. **Plan Creation**: Define technical approach, entities, contracts, and tasks
3. **Test Writing**: Write tests that fail before implementation (TDD)
4. **Implementation**: Build feature incrementally, running tests after each change
5. **Coverage Verification**: Ensure 80%+ coverage before PR
6. **Code Review**: Peer review with constitution compliance check

### Database Migrations

- **Local Development**: `yarn db:migrate:dev` creates and applies migrations
- **Production**: `yarn db:migrate:deploy` applies migrations without prompts
- **Schema Changes**: Always run `npx prisma generate` after schema updates
- **Transactions**: Use Prisma transactions for multi-step operations

### Service Communication

- **Authentication**: Use `@mud/gcp-auth` for Cloud Run service tokens
- **Error Handling**: Implement retry logic with exponential backoff
- **Logging**: Log all external service calls with request/response context
- **Circuit Breakers**: Fail fast when downstream services are unhealthy

### Deployment

- **Infrastructure**: Terraform modules in `infra/terraform/`
- **Secrets**: GCP Secret Manager (never commit secrets)
- **Rollback**: Blue-green deployments via Cloud Run revisions
- **Monitoring**: Structured logging to Google Cloud Logging

## Governance

### Constitution Authority

This constitution supersedes all conflicting practices, conventions, or documentation. When in doubt, constitution principles take precedence.

### Amendment Process

1. Propose amendment with rationale and impact analysis
2. Update affected templates and documentation
3. Obtain team consensus
4. Increment version according to semantic versioning:
   - **MAJOR**: Backward-incompatible principle changes
   - **MINOR**: New principles or material expansions
   - **PATCH**: Clarifications, wording fixes, non-semantic refinements
5. Update `LAST_AMENDED` date and add to Sync Impact Report

### Compliance Verification

- All PRs MUST pass test coverage thresholds
- All PRs MUST pass linting and type checks
- Code reviews MUST verify adherence to service boundaries
- Complexity violations MUST be justified in PR description
- Constitution principles MUST be cited when rejecting PRs

### Living Documentation

- `.github/copilot-instructions.md` provides AI-assisted development guidance
- Service-specific docs (e.g., `apps/dm/GAME_FLOW.md`) supplement this constitution
- When conflicts arise, constitution principles win

**Version**: 1.0.0 | **Ratified**: 2025-10-15 | **Last Amended**: 2025-10-15
