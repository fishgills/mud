# @mud/gcp-auth

Small helper for authenticating requests to private Google Cloud Run services from other services (e.g., Slack bot, DM, World).

## What it does

- Uses Google Application Default Credentials to obtain an ID token scoped for the target Cloud Run service (audience).
- Exposes an `authorizedFetch` that automatically injects `Authorization: Bearer <id_token>` for non-localhost URLs.
- No-op on localhost to keep local development simple.

## Usage

In your HTTP client creation, pass `authorizedFetch`:

```ts
import { GraphQLClient } from 'graphql-request';
import { authorizedFetch } from '@mud/gcp-auth';

const client = new GraphQLClient('https://your-cloud-run-url.a.run.app/graphql', {
  fetch: authorizedFetch as any,
});
```

The helper will:

- For non-localhost URLs, derive the audience from the URL origin and sign an ID token using ADC.
- For localhost (127.0.0.1, ::1), send the request without auth headers.

## Requirements

- Running in Cloud Run or any environment with Application Default Credentials (ADC) available, or having `gcloud auth application-default login` configured for local use.

## Building

Run `nx build gcp-auth` to build the library.
