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
    const headers = request?.headers ?? {};

    // Skip noisy logging for health endpoints (unless they fail).
    // Match paths like /health, /health-check or any segment containing 'health'.
    const isHealthEndpoint = /(^|\/)health(-check)?($|\/)/i.test(url);

    if (!isHealthEndpoint) {
      this.logger.log(`[DM-REQUEST] ${method} ${url}`);
      this.logger.debug(`[DM-REQUEST] Headers: ${JSON.stringify(headers)}`);

      const userAgent = headers['user-agent'] ?? headers['User-Agent'] ?? 'N/A';
      const authPresent = headers.authorization ? 'Present' : 'Missing';
      this.logger.debug(`[DM-REQUEST] User-Agent: ${userAgent}`);
      this.logger.debug(`[DM-REQUEST] Authorization: ${authPresent}`);
    }

    const start = Date.now();
    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - start;
        // Some test ExecutionContext mocks provide getResponse as a function,
        // others provide a plain property. Be defensive when retrieving it.
        const _getRes = (http as any).getResponse;
        const response: Response | undefined =
          typeof _getRes === 'function'
            ? _getRes.call(http)
            : ((http as any).getResponse ?? (http as any).response);
        const status = (response as any)?.statusCode ?? 0;

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
        const _getRes = (http as any).getResponse;
        const response: Response | undefined =
          typeof _getRes === 'function'
            ? _getRes.call(http)
            : ((http as any).getResponse ?? (http as any).response);
        const status =
          (response as any)?.statusCode ?? (err && err.status) ?? 500;

        // Always log errors, including health endpoint failures.
        this.logger.error(
          `[DM-ERROR] ${method} ${url} failed with status ${status} after ${duration}ms - ${err?.message ?? err}`,
        );
        return throwError(() => err);
      }),
    );
  }
}
