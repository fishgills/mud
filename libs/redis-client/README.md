# redis-client

Redis-based event bridge for cross-service communication and notifications.

## Features

### EventBridge Service

Provides pub/sub messaging for game events and notifications:

- **Channel-based routing**: Messages published to client-specific channels (e.g., `notifications:slack`, `notifications:discord`)
- **Notification types**: Combat, monster, player, world events
- **Multi-workspace support**: Handles multiple Slack workspaces via clientId format `"slack:TEAM_ID:USER_ID"`
- **Combat notifications**: Includes detailed message blocks with combat log buttons

### Key Methods

- `publishNotification()` - Publish notification to appropriate client channel
- `publishCombatNotifications()` - Helper for combat-specific messages with proper clientId formatting
- `subscribeToNotifications()` - Subscribe to client-specific notification channel

### Client ID Format

For Slack notifications, clientId must include the full format:

- ✅ Correct: `"slack:TB1QW3SQH:UB389SP46"` (includes prefix)
- ❌ Wrong: `"TB1QW3SQH:UB389SP46"` (missing prefix)

The prefix is required for multi-workspace Slack bot installation lookup.

## Building

Run `yarn build redis-client` to build the library.

## Running unit tests

Run `yarn test redis-client` to execute the unit tests via [Jest](https://jestjs.io).
