import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestActorContext {
  id?: string;
  email?: string;
  nombreCompleto?: string;
  rol?: string;
  pais?: 'BOLIVIA' | 'CHILE';
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestActorContext>();

  run<T>(actor: RequestActorContext, callback: () => T): T {
    return this.storage.run(actor, callback);
  }

  getUser(): RequestActorContext | undefined {
    return this.storage.getStore();
  }
}
