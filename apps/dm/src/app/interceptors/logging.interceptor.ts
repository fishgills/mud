import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const method = request?.method ?? 'UNKNOWN';
    const url = request?.originalUrl ?? request?.url ?? 'unknown';
    const headers = request?.headers ?? {};

    this.logger.log(`[DM-REQUEST] ${method} ${url}`);
    this.logger.debug(`[DM-REQUEST] Headers: ${JSON.stringify(headers)}`);

    const userAgent = headers['user-agent'] ?? headers['User-Agent'] ?? 'N/A';
    const authPresent = headers.authorization ? 'Present' : 'Missing';
    this.logger.debug(`[DM-REQUEST] User-Agent: ${userAgent}`);
    this.logger.debug(`[DM-REQUEST] Authorization: ${authPresent}`);

    const start = Date.now();
    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - start;
        this.logger.log(`[DM-RESPONSE] ${method} ${url} completed in ${duration}ms`);
        const success =
          typeof data === 'object' && data !== null && 'success' in data
            ? (data as { success?: unknown }).success
            : 'N/A';
        const successLabel =
          typeof success === 'string' || typeof success === 'number'
            ? success
            : JSON.stringify(success);
        this.logger.debug(`{ "event": "dm.response", "method": "${method}", "url": "${url}", "durationMs": ${duration}, "success": ${JSON.stringify(successLabel)} }`);
      }),
    );
  }
}
