import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const info = ctx.getInfo();

    // Log incoming request details
    this.logger.log(`[DM-REQUEST] Incoming GraphQL request:`);
    this.logger.log(
      `[DM-REQUEST] Operation: ${info.operation.operation} ${info.fieldName}`,
    );
    this.logger.log(`[DM-REQUEST] Variables: ${JSON.stringify(ctx.getArgs())}`);
    this.logger.log(`[DM-REQUEST] Headers: ${JSON.stringify(request.headers)}`);
    this.logger.log(
      `[DM-REQUEST] User-Agent: ${request.headers['user-agent'] || 'N/A'}`,
    );
    this.logger.log(
      `[DM-REQUEST] Authorization: ${request.headers.authorization ? 'Present' : 'Missing'}`,
    );

    const start = Date.now();
    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - start;
        this.logger.log(
          `[DM-RESPONSE] ${info.fieldName} completed in ${duration}ms`,
        );
        this.logger.log(
          `[DM-RESPONSE] Response success: ${(data as any)?.success ?? 'N/A'}`,
        );
      }),
    );
  }
}
