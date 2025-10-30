# @mud/gcp-auth

Small helper for authenticating requests to private Google Cloud Run services from other services (e.g., Slack bot, DM, World).

## What it does

# @mud/gcp-auth (DEPRECATED)

This package used to provide Cloud Run service-to-service authentication helpers
for projects running on Google Cloud Run. The repository has since standardized on
GKE-only deployments and these helpers are no longer required.

What changed

- Callers were updated to use the platform's global `fetch` or GKE-native auth.
- The implementation in `src/gcp-auth.ts` is now a small compatibility shim that
  forwards to `globalThis.fetch` and no-ops for Cloud Run-specific features.

If you want to remove this package entirely from the monorepo, delete this
directory and remove `@mud/gcp-auth` entries from package.json files in apps.

For now the shim remains to avoid breaking any stray imports.

- Uses Google Application Default Credentials to obtain an ID token scoped for the target Cloud Run service (audience).
- Exposes an `authorizedFetch` that automatically injects `Authorization: Bearer <id_token>` for non-localhost URLs.
- No-op on localhost to keep local development simple.

## Usage

In your HTTP client creation, pass `authorizedFetch`:

```ts
import { authorizedFetch, setAuthLogger } from '@mud/gcp-auth';

setAuthLogger(customLogger); // optional, defaults to console

const response = await authorizedFetch('https://your-cloud-run-url.a.run.app/api/health', {
  method: 'GET',
});
```

The helper will:

- For non-localhost URLs, derive the audience from the URL origin and sign an ID token using ADC.
- For localhost (127.0.0.1, ::1), send the request without auth headers.

`setAuthLogger` accepts any object with `log`, `warn`, and `error` methods (e.g., Nest `Logger`, Pino, Winston) so you can integrate with your service's structured logging.

## Requirements

- Running in Cloud Run or any environment with Application Default Credentials (ADC) available, or having `gcloud auth application-default login` configured for local use.

## Building

Run `yarn build gcp-auth` to build the library.
