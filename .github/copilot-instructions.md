# GitHub Copilot Instructions for Mud

## Project Overview

Mud is an AI-assisted multiplayer text adventure game built as a Turborepo monorepo. It features procedurally generated worlds, turn-based gameplay, and a Slack bot interface for player interaction.

### Architecture

- **Backend**: NestJS services communicating via GraphQL
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for world rendering and coordination
- **Frontend**: Slack Bolt app for player interactions
- **Infrastructure**: Google Cloud Platform (Cloud Run) with Terraform
- **AI Integration**: OpenAI API for dynamic descriptions and content

## Technology Stack

### Core Technologies

- **TypeScript** - Primary language across all services
- **Turborepo** - Monorepo management with task orchestration
- **NestJS** - Framework for `dm` and `world` services
- **GraphQL** - API layer with Apollo Server
- **Prisma** - Database ORM and migrations
- **Redis** - Caching layer
- **Jest** - Testing framework with SWC transform
- **Slack Bolt** - Bot framework

### Build & Dev Tools

### Building

# Build all apps

# Build specific app

yarn lint
yarn format

```

- Use NestJS built-in exceptions (`BadRequestException`, `NotFoundException`, etc.)
- Handle Redis connection errors gracefully with retries
- Implement cache warming for frequently accessed data

<REPLACE_WITH_ORIGIN_MAIN>
mud/
```
