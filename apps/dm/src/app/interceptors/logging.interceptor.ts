import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const method = request?.method ?? 'UNKNOWN';
    const url = request?.originalUrl ?? request?.url ?? 'unknown';

    // Skip noisy logging for health endpoints (unless they fail).
    // Match paths like /health, /health-check or any segment containing 'health'.
    const isHealthEndpoint = /(^|\/)health(-check)?($|\/)/i.test(url);

    if (!isHealthEndpoint) {
      const ip =
        (request as Request & { ip?: string }).ip ??
        (request.socket &&
          (request.socket as unknown as { remoteAddress?: string })
            .remoteAddress) ??
        'unknown';
      this.logger.log(`[DM-REQUEST] ${method} ${url} from ${ip}`);
    }

    const start = Date.now();

    const resolveResponse = (httpObj: unknown): Response | undefined => {
      // Convert through unknown first so TypeScript won't complain when
      // narrowing potentially concrete framework types to a loose Record.
      const h = httpObj as unknown as Record<string, unknown>;
      const getRes = h.getResponse;
      if (typeof getRes === 'function') {
        try {
          return (getRes as (...args: unknown[]) => unknown).call(
            httpObj,
          ) as Response;
        } catch {
          return undefined;
        }
      }
      const maybeRes = (h.getResponse ?? h.response) as unknown;
      if (typeof maybeRes === 'object' && maybeRes !== null) {
        const sr = maybeRes as unknown as Record<string, unknown>;
        if (typeof sr.statusCode === 'number') return maybeRes as Response;
      }
      return undefined;
    };

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - start;
        // Some test ExecutionContext mocks provide getResponse as a function,
        // others provide a plain property. Be defensive when retrieving it.
        const response = resolveResponse(http);
        const status =
          response &&
          typeof (response as unknown as Record<string, unknown>).statusCode ===
            'number'
            ? (response as unknown as { statusCode: number }).statusCode
            : 0;

        // For health endpoints, only log when status indicates failure (>= 400).
        if (isHealthEndpoint) {
          if (status >= 400) {
            this.logger.warn(
              `[DM-HEALTH-FAIL] ${method} ${url} responded ${status} in ${duration}ms`,
            );
            this.logger.debug(
              `{ "event": "dm.response", "method": "${method}", "url": "${url}", "durationMs": ${duration}, "status": ${status} }`,
            );
          }
          return;
        }

        this.logger.log(
          `[DM-RESPONSE] ${method} ${url} completed in ${duration}ms`,
        );
        const success =
          typeof data === 'object' && data !== null && 'success' in data
            ? (data as { success?: unknown }).success
            : 'N/A';
        const successLabel =
          typeof success === 'string' || typeof success === 'number'
            ? success
            : JSON.stringify(success);
        this.logger.debug(
          `{ "event": "dm.response", "method": "${method}", "url": "${url}", "durationMs": ${duration}, "success": ${JSON.stringify(successLabel)} }`,
        );
      }),
      catchError((err) => {
        const duration = Date.now() - start;
        const response = resolveResponse(http);
        const status =
          response &&
          typeof (response as unknown as Record<string, unknown>).statusCode ===
            'number'
            ? (response as unknown as { statusCode: number }).statusCode
            : ((err &&
                ((err as unknown as Record<string, unknown>)
                  .status as number)) ??
              500);

        // Always log errors, including health endpoint failures.
        const errMsg =
          err &&
          typeof (err as unknown as Record<string, unknown>).message ===
            'string'
            ? (err as { message?: string }).message
            : String(err);
        this.logger.error(
          `[DM-ERROR] ${method} ${url} failed with status ${status} after ${duration}ms - ${errMsg}`,
        );
        return throwError(() => err);
      }),
    );
  }
}
