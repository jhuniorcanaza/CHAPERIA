import { Injectable, Optional } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { RequestContextService } from './request-context.service';

export type ModuloDestinoTab =
  | 'dashboard'
  | 'recepcion'
  | 'cotizacion'
  | 'ordenes'
  | 'repuestos'
  | 'almacen'
  | 'herramientas'
  | 'reportes';

export interface RealtimePayload {
  id?: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  destinoRol?: 'TODOS' | 'BOLIVIA' | 'CHILE';
  moduloDestino?: ModuloDestinoTab;
  vehiculoId?: string | null;
  referenciaId?: string | null;
  subTabDestino?: string | null;
  actorEmail?: string | null;
  actorNombre?: string | null;
  timestamp: string;
  data?: any;
}

@Injectable()
export class RealtimeService {
  private eventsSubject = new Subject<RealtimePayload>();

  constructor(
    @Optional() private readonly requestContext?: RequestContextService,
  ) {}

  emitEvent(payload: Omit<RealtimePayload, 'timestamp'>) {
    const actor = this.requestContext?.getUser();
    const actorEmail =
      payload.actorEmail !== undefined
        ? payload.actorEmail?.trim().toLowerCase() || null
        : actor?.email || null;
    const actorNombre =
      payload.actorNombre !== undefined
        ? payload.actorNombre || null
        : actor?.nombreCompleto || null;

    this.eventsSubject.next({
      destinoRol: 'TODOS',
      ...payload,
      actorEmail,
      actorNombre,
      timestamp: new Date().toISOString(),
    });
  }

  getStream(
    paisUsuario?: 'BOLIVIA' | 'CHILE',
    userEmail?: string,
    rolUsuario?: string,
  ): Observable<MessageEvent> {
    const viewerEmail = userEmail ? userEmail.trim().toLowerCase() : null;

    return this.eventsSubject.asObservable().pipe(
      filter((payload) => {
        if (viewerEmail && payload.actorEmail) {
          if (payload.actorEmail.trim().toLowerCase() === viewerEmail) {
            return false;
          }
        }
        if (
          (paisUsuario === 'CHILE' || rolUsuario === 'ENCARGADO_CHILE') &&
          payload.moduloDestino === 'reportes'
        ) {
          return false;
        }
        if (!paisUsuario) return true;
        const dest = payload.destinoRol || 'TODOS';
        return dest === 'TODOS' || dest === paisUsuario;
      }),
      map(
        (payload) =>
          ({
            data: JSON.stringify(payload),
          }) as MessageEvent,
      ),
    );
  }
}
