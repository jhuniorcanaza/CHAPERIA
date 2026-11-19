import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  RequestActorContext,
  RequestContextService,
} from '../services/request-context.service';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly requestContext: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const user = req?.user;
    const actor: RequestActorContext = user
      ? {
          id: user.id || user.userId,
          email: user.email ? String(user.email).trim().toLowerCase() : undefined,
          nombreCompleto: user.nombreCompleto,
          rol: user.rol,
          pais: user.pais,
        }
      : {};

    return new Observable((subscriber) =>
      this.requestContext.run(actor, () => {
        const sub = next.handle().subscribe({
          next: (val) => subscriber.next(val),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
        return () => sub.unsubscribe();
      }),
    );
  }
}
