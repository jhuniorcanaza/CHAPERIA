import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment.development';
import {
  ActiveUser,
  EvidenciaFotograficaItem,
  HistorialEdicionItem,
  LiveToastPayload,
  MenuModuleItem,
  ModuloAuditoria,
  ModuloEvidencia,
  NotificacionItem,
  RolSistema,
  UsuarioSistemaItem,
} from '../models/system.models';
import {
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
  UNAUTHORIZED_SESSION_EVENT,
} from '../interceptors/auth.interceptor';

@Injectable({
  providedIn: 'root',
})
export class AppStateService {
  private http = inject(HttpClient);
  readonly apiUrl = environment.apiUrl;
  private eventSource: EventSource | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private bootstrapInFlight = false;
  private bootstrapQueued = false;

  currentUser = signal<ActiveUser | null>(null);
  currency = signal<'USD' | 'CLP'>('USD');
  activeTab = signal<string>('dashboard');
  searchQuery = signal<string>('');
  notificationsDrawerOpen = signal<boolean>(false);

  puedeVerReportes = computed(() => {
    const user = this.currentUser();
    if (!user) return false;
    return user.rol !== 'ENCARGADO_CHILE';
  });

  // Menú con clases de iconos vectoriales RemixIcon (Cero emojis)
  readonly allMenuModules: MenuModuleItem[] = [
    {
      id: 'dashboard',
      numero: 1,
      icono: 'ri-dashboard-3-line',
      titulo: 'Panel Principal',
      subtitulo: 'Resumen operativo, evidencias y auditoría',
    },
    {
      id: 'recepcion',
      numero: 2,
      icono: 'ri-car-line',
      titulo: 'Recepción y Check-In',
      subtitulo: 'Traspaso naviera e inventario físico',
    },
    {
      id: 'cotizacion',
      numero: 3,
      icono: 'ri-file-list-3-line',
      titulo: 'Cotizaciones',
      subtitulo: 'Aprobación bilateral e historial',
    },
    {
      id: 'ordenes',
      numero: 4,
      icono: 'ri-tools-line',
      titulo: 'Órdenes de Trabajo',
      subtitulo: 'Avance, prórrogas y penalizaciones',
    },
    {
      id: 'repuestos',
      numero: 5,
      icono: 'ri-settings-5-line',
      titulo: 'Control de Repuestos',
      subtitulo: 'Solicitados y recibidos por vehículo',
    },
    {
      id: 'almacen',
      numero: 6,
      icono: 'ri-archive-drawer-line',
      titulo: 'Almacén y Pintura',
      subtitulo: 'Insumos de taller y colorista',
    },
    {
      id: 'herramientas',
      numero: 7,
      icono: 'ri-hammer-line',
      titulo: 'Herramientas y Personal',
      subtitulo: 'Inventario activo, bajas y técnicos',
    },
    {
      id: 'reportes',
      numero: 8,
      icono: 'ri-bar-chart-box-line',
      titulo: 'Reportes e Informe Final',
      subtitulo: 'Cierre financiero y PDF cliente',
      soloBolivia: true,
    },
  ];

  visibleMenuModules = computed(() => {
    const canSeeReports = this.puedeVerReportes();
    return this.allMenuModules.filter((m) => !m.soloBolivia || canSeeReports);
  });

  vehiculos = signal<any[]>([]);
  tecnicos = signal<any[]>([]);
  insumos = signal<any[]>([]);
  movimientosInsumo = signal<any[]>([]);
  herramientas = signal<any[]>([]);
  notificaciones = signal<NotificacionItem[]>([]);
  evidenciasFotograficas = signal<EvidenciaFotograficaItem[]>([]);
  historialEdiciones = signal<HistorialEdicionItem[]>([]);
  usuariosSistema = signal<UsuarioSistemaItem[]>([]);

  configuracion = signal<{
    tasaUsdAClp: number;
    multaPorDiaRetrasoUsd: number;
    gastosFijosMensualesTallerUsd: number;
  }>({
    tasaUsdAClp: 980,
    multaPorDiaRetrasoUsd: 20,
    gastosFijosMensualesTallerUsd: 2400,
  });

  sseStatus = signal<'CONECTADO' | 'CONECTANDO' | 'DESCONECTADO'>('DESCONECTADO');
  bootstrapLoading = signal<boolean>(false);
  liveToast = signal<LiveToastPayload | null>(null);
  securityAlertBanner = signal<string | null>(null);
  loginNoticeBanner = signal<string | null>(null);
  notificationHighlightBanner = signal<string | null>(null);
  focusedVehiculoId = signal<string | null>(null);
  focusedReferenciaId = signal<string | null>(null);
  focusedSubTab = signal<string | null>(null);
  evidenciasModuloFilter = signal<ModuloEvidencia | 'TODAS'>('TODAS');
  sidebarMobileOpen = signal<boolean>(false);

  vehiculosFiltrados = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.vehiculos();
    if (!q) return list;
    return list.filter(
      (v) =>
        (v.vinChasis || '').toLowerCase().includes(q) ||
        (v.placaOLote || '').toLowerCase().includes(q) ||
        (v.marca || '').toLowerCase().includes(q) ||
        (v.modelo || '').toLowerCase().includes(q) ||
        (v.nombreCliente || '').toLowerCase().includes(q),
    );
  });

  totalVehiculosTaller = computed(() => this.vehiculos().length);

  tareasAtrasadasCount = computed(() => {
    let count = 0;
    for (const v of this.vehiculos()) {
      for (const t of v.tareasOt || []) {
        if (!t.completada && t.diasAtraso > 0) count++;
      }
    }
    return count;
  });

  cotizacionesEnAmarilloCount = computed(() => {
    let count = 0;
    for (const v of this.vehiculos()) {
      for (const c of v.cotizaciones || []) {
        if (c.estadoAprobacion === 'AMARILLO_EDITADA_POR_BOLIVIA') count++;
      }
    }
    return count;
  });

  notificacionesNoLeidasCount = computed(
    () => this.notificaciones().filter((n) => !n.leida).length,
  );

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener(UNAUTHORIZED_SESSION_EVENT, () => {
        if (this.currentUser()) {
          this.logout('Tu sesión expiró o dejó de ser válida. Inicia sesión nuevamente.');
        }
      });
    }

    const savedUser = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    const savedToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (savedUser && savedToken) {
      try {
        const parsedRaw = JSON.parse(savedUser);
        const parsed: ActiveUser = parsedRaw?.user || parsedRaw;
        if (!parsed?.id || !parsed?.email) {
          this.logout();
          return;
        }
        if (parsedRaw?.user) {
          localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(parsed));
        }
        this.currentUser.set(parsed);
        if (parsed.rol === 'ENCARGADO_CHILE' && this.activeTab() === 'reportes') {
          this.activeTab.set('dashboard');
        }
        this.verificarPerfilYArrancar();
      } catch {
        this.logout();
      }
    } else if (savedUser || savedToken) {
      this.logout();
    }
  }

  private verificarPerfilYArrancar() {
    this.http.get<any>(`${this.apiUrl}/auth/perfil`).subscribe({
      next: (res) => {
        const freshUser: ActiveUser = res?.user || res;
        if (!freshUser?.email) {
          this.logout('Tu sesión dejó de ser válida. Inicia sesión nuevamente.');
          return;
        }
        localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(freshUser));
        this.currentUser.set(freshUser);
        if (freshUser.rol === 'ENCARGADO_CHILE' && this.activeTab() === 'reportes') {
          this.activeTab.set('dashboard');
        }
        this.loadBootstrapData();
        this.connectRealtimeSse();
      },
      error: () => {
        // El interceptor despacha UNAUTHORIZED_SESSION_EVENT ante 401; si falla red se intenta igual
      },
    });
  }

  login(
    email: string,
    password: string,
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    this.loginNoticeBanner.set(null);
    this.http.post<any>(`${this.apiUrl}/auth/login`, { email, password }).subscribe({
      next: (res) => {
        localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, res.accessToken);
        localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(res.user));
        this.currentUser.set(res.user);
        this.clearNotificationFocus();

        if (res.user.rol === 'ENCARGADO_CHILE' && this.activeTab() === 'reportes') {
          this.activeTab.set('dashboard');
        }

        this.loadBootstrapData();
        this.connectRealtimeSse();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        if (err?.status === 0) {
          if (onError) {
            onError('No hay conexión con el servidor Backend (http://localhost:3000/api). Inicia o reinicia iniciar-local.bat.');
          }
          return;
        }
        const msg = err?.error?.message;
        const normalized = Array.isArray(msg) ? msg.join(', ') : msg || 'Credenciales inválidas.';
        if (onError) onError(normalized);
      },
    });
  }

  logout(motivoNotice?: string) {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    this.currentUser.set(null);
    this.vehiculos.set([]);
    this.tecnicos.set([]);
    this.insumos.set([]);
    this.movimientosInsumo.set([]);
    this.herramientas.set([]);
    this.notificaciones.set([]);
    this.evidenciasFotograficas.set([]);
    this.historialEdiciones.set([]);
    this.usuariosSistema.set([]);
    this.notificationsDrawerOpen.set(false);
    this.securityAlertBanner.set(null);
    this.clearNotificationFocus();
    this.dismissToast();
    this.disconnectSse();
    if (motivoNotice) {
      this.loginNoticeBanner.set(motivoNotice);
    }
  }

  selectModuleTab(tabId: string, preserveFocus = false) {
    if (tabId === 'reportes' && !this.puedeVerReportes()) {
      this.securityAlertBanner.set(
        'Acceso restringido: El usuario de Taller Chile tiene acceso operativo completo excepto a los Reportes Financieros e Informe Final.',
      );
      return;
    }
    this.securityAlertBanner.set(null);
    if (!preserveFocus) {
      this.clearNotificationFocus();
    }
    this.activeTab.set(tabId);
    this.sidebarMobileOpen.set(false);
    if (!preserveFocus && typeof window !== 'undefined') {
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 30);
    }
  }

  private scrollAFocusActivo(vehiculoId?: string | null, referenciaId?: string | null) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!vehiculoId && !referenciaId) {
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 40);
      return;
    }

    let intentos = 0;
    const buscarYDesplazar = () => {
      intentos += 1;
      const selectorRef = referenciaId ? `[data-focus-ref="${referenciaId}"]` : '';
      const selectorVeh = vehiculoId ? `[data-focus-vehiculo="${vehiculoId}"]` : '';
      const target =
        (selectorRef ? document.querySelector(selectorRef) : null) ||
        (selectorVeh ? document.querySelector(selectorVeh) : null);

      if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (intentos < 15) {
        setTimeout(buscarYDesplazar, 30);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    requestAnimationFrame(() => setTimeout(buscarYDesplazar, 25));
  }

  irAVehiculoEnModulo(
    vehiculoId: string | null,
    modulo: string,
    referenciaId: string | null = null,
    subTab: string | null = null,
    tituloCustom?: string,
  ) {
    if (modulo === 'reportes' && !this.puedeVerReportes()) {
      this.selectModuleTab('reportes');
      return;
    }

    if (
      vehiculoId &&
      this.searchQuery().trim() &&
      !this.vehiculosFiltrados().some((v) => v.id === vehiculoId)
    ) {
      this.searchQuery.set('');
    }

    this.focusedVehiculoId.set(vehiculoId || null);
    this.focusedReferenciaId.set(referenciaId || null);
    this.focusedSubTab.set(subTab || null);

    let vehiculoLabel = '';
    if (vehiculoId) {
      const v = this.vehiculos().find((item) => item.id === vehiculoId);
      if (v) {
        vehiculoLabel = ` • ${v.marca} ${v.modelo} (${v.placaOLote})`;
      }
    }

    const moduloTitulo =
      this.allMenuModules.find((m) => m.id === modulo)?.titulo || modulo.toUpperCase();
    this.notificationHighlightBanner.set(
      tituloCustom
        ? `Enfocado en ${moduloTitulo}${vehiculoLabel}: ${tituloCustom}`
        : `Enfocado en ${moduloTitulo}${vehiculoLabel}`,
    );

    this.selectModuleTab(modulo, true);
    this.scrollAFocusActivo(vehiculoId || null, referenciaId || null);
  }

  loadBootstrapData() {
    if (!this.currentUser() || !localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) return;
    if (this.bootstrapInFlight) {
      this.bootstrapQueued = true;
      return;
    }

    this.bootstrapInFlight = true;
    this.bootstrapLoading.set(true);
    this.http.get<any>(`${this.apiUrl}/bootstrap`).subscribe({
      next: (data) => {
        this.vehiculos.set(data.vehiculos || []);
        this.tecnicos.set(data.tecnicos || []);
        this.insumos.set(data.insumos || []);
        this.movimientosInsumo.set(data.movimientosInsumo || []);
        this.herramientas.set(data.herramientas || []);
        if (data.configuracion) this.configuracion.set(data.configuracion);
        this.notificaciones.set(data.notificaciones || []);
        this.evidenciasFotograficas.set(data.evidenciasFotograficas || []);
        this.historialEdiciones.set(data.historialEdiciones || []);
        this.bootstrapLoading.set(false);
        this.bootstrapInFlight = false;
        if (this.bootstrapQueued) {
          this.bootstrapQueued = false;
          this.loadBootstrapData();
        }
      },
      error: () => {
        this.bootstrapLoading.set(false);
        this.bootstrapInFlight = false;
        if (this.bootstrapQueued) {
          this.bootstrapQueued = false;
          this.loadBootstrapData();
        }
      },
    });
  }

  resolveMediaUrl(rawUrl?: string | null): string {
    if (!rawUrl) return '';
    const trimmed = String(rawUrl).trim();
    if (!trimmed) return '';
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:') ||
      trimmed.startsWith('/images/')
    ) {
      return trimmed;
    }
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    if (this.apiUrl.startsWith('http')) {
      const origin = this.apiUrl.replace(/\/api\/?$/, '');
      return `${origin}${cleanPath}`;
    }
    return cleanPath;
  }

  private disconnectSse() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.sseStatus.set('DESCONECTADO');
  }

  connectRealtimeSse() {
    this.disconnectSse();
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (!token) {
      this.sseStatus.set('DESCONECTADO');
      return;
    }

    this.sseStatus.set('CONECTANDO');
    this.eventSource = new EventSource(
      `${this.apiUrl}/realtime/stream?token=${encodeURIComponent(token)}`,
    );

    this.eventSource.onopen = () => {
      this.sseStatus.set('CONECTADO');
    };

    this.eventSource.onerror = () => {
      this.sseStatus.set('DESCONECTADO');
    };

    this.eventSource.onmessage = (event) => {
      try {
        const payload: LiveToastPayload = JSON.parse(event.data);
        const user = this.currentUser();
        if (
          user?.email &&
          payload.actorEmail &&
          payload.actorEmail.trim().toLowerCase() === user.email.trim().toLowerCase()
        ) {
          return;
        }
        if (
          (user?.pais === 'CHILE' || user?.rol === 'ENCARGADO_CHILE') &&
          payload.moduloDestino === 'reportes'
        ) {
          return;
        }
        if (
          payload.destinoRol &&
          payload.destinoRol !== 'TODOS' &&
          user &&
          payload.destinoRol !== user.pais
        ) {
          return;
        }
        this.showLiveToast(payload);
        this.loadBootstrapData();
      } catch (e) {
        console.error('Error procesando evento SSE:', e);
      }
    };
  }

  private showLiveToast(payload: LiveToastPayload) {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.liveToast.set(payload);
    this.toastTimer = setTimeout(() => {
      this.liveToast.set(null);
      this.toastTimer = null;
    }, 8000);
  }

  dismissToast() {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.liveToast.set(null);
  }

  clearNotificationFocus() {
    this.focusedVehiculoId.set(null);
    this.focusedReferenciaId.set(null);
    this.focusedSubTab.set(null);
    this.notificationHighlightBanner.set(null);
  }

  marcarUnaNotificacionLeida(id: string) {
    if (!id) return;
    this.notificaciones.update((list) =>
      list.map((n) => (n.id === id ? { ...n, leida: true, leidaEn: new Date().toISOString() } : n)),
    );
    this.http.patch(`${this.apiUrl}/notificaciones/${id}/leer`, {}).subscribe({
      error: () => this.loadBootstrapData(),
    });
  }

  abrirNotificacion(notif: Partial<NotificacionItem> | LiveToastPayload) {
    if (!notif) return;

    if (notif.id && !notif.leida) {
      this.marcarUnaNotificacionLeida(notif.id);
    }

    this.notificationsDrawerOpen.set(false);
    this.dismissToast();

    const destino = notif.moduloDestino || 'dashboard';
    this.irAVehiculoEnModulo(
      notif.vehiculoId || null,
      destino,
      notif.referenciaId || null,
      notif.subTabDestino || null,
      notif.titulo || 'Notificación',
    );
  }

  marcarNotificacionesLeidas() {
    this.notificaciones.update((list) =>
      list.map((n) => ({ ...n, leida: true, leidaEn: n.leidaEn || new Date().toISOString() })),
    );
    this.http.patch(`${this.apiUrl}/notificaciones/leer-todas`, {}).subscribe({
      error: () => this.loadBootstrapData(),
    });
  }

  formatMoney(usdValue: number | string): string {
    const val = Number(usdValue || 0);
    if (this.currency() === 'USD') {
      return `USD $${val.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })}`;
    }
    const clp = Math.round(val * Number(this.configuracion().tasaUsdAClp || 980));
    return `CLP $${clp.toLocaleString('es-CL')}`;
  }

  private obtenerZonaHorariaCuenta(): { timeZone: string; etiquetaPais: string } {
    if (this.currentUser()?.pais === 'CHILE') {
      return { timeZone: 'America/Santiago', etiquetaPais: 'CL' };
    }
    return { timeZone: 'America/La_Paz', etiquetaPais: 'BO' };
  }

  private extraerPartesFechaHora(fecha: Date, timeZone: string): Record<string, string> {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const map: Record<string, string> = {};
    for (const p of formatter.formatToParts(fecha)) {
      if (p.type !== 'literal') map[p.type] = p.value;
    }
    return map;
  }

  private formatearInstante(
    valor?: string | Date | null,
    incluirAnio = true,
    incluirPais = true,
  ): string {
    if (!valor) return '';
    const d = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(d.getTime())) return '';
    const { timeZone, etiquetaPais } = this.obtenerZonaHorariaCuenta();
    const p = this.extraerPartesFechaHora(d, timeZone);
    const fecha = incluirAnio ? `${p['day']}/${p['month']}/${p['year']}` : `${p['day']}/${p['month']}`;
    const base = `${fecha} ${p['hour']}:${p['minute']}`;
    return incluirPais ? `${base} ${etiquetaPais}` : base;
  }

  formatFechaHora(valor?: string | Date | null, incluirPais = true): string {
    return this.formatearInstante(valor, true, incluirPais);
  }

  formatFechaHoraCorta(valor?: string | Date | null, incluirPais = true): string {
    return this.formatearInstante(valor, false, incluirPais);
  }

  subirEvidenciaConDetalle(
    file: File,
    datos: {
      moduloOrigen: ModuloEvidencia;
      referenciaId?: string;
      vehiculoReferencia: string;
      tituloDetalle: string;
      descripcionBreve: string;
      pesoOriginalClienteKb?: number;
      skipBootstrapReload?: boolean;
    },
    onSuccess?: (evidencia: EvidenciaFotograficaItem) => void,
    onError?: (msg: string) => void,
  ) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('moduloOrigen', datos.moduloOrigen);
    if (datos.referenciaId) {
      formData.append('referenciaId', datos.referenciaId);
    }
    if (datos.pesoOriginalClienteKb && datos.pesoOriginalClienteKb > 0) {
      formData.append('pesoOriginalClienteKb', String(datos.pesoOriginalClienteKb));
    }
    formData.append('vehiculoReferencia', datos.vehiculoReferencia);
    formData.append('tituloDetalle', datos.tituloDetalle);
    formData.append('descripcionBreve', datos.descripcionBreve);
    formData.append(
      'subidoPor',
      this.currentUser()?.nombreCompleto || 'Alfredo (Encargado Taller Chile)',
    );
    formData.append('paisOrigen', this.currentUser()?.pais || 'CHILE');

    this.http
      .post<EvidenciaFotograficaItem>(`${this.apiUrl}/evidencias-fotos/subir`, formData)
      .subscribe({
        next: (res) => {
          if (!datos.skipBootstrapReload) {
            this.loadBootstrapData();
          }
          if (onSuccess) onSuccess(res);
        },
        error: (err) => {
          const msg =
            err?.error?.message ||
            'Error al subir la evidencia fotográfica. Verifica título y descripción.';
          if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
        },
      });
  }

  registrarEdicionManual(
    input: {
      modulo: ModuloAuditoria;
      entidadReferencia: string;
      tipoAccion: string;
      valorAnterior: string;
      valorNuevo: string;
      motivoEdicion: string;
      aprobadoPor?: string;
    },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const payload = {
      ...input,
      editadoPor: this.currentUser()?.nombreCompleto || 'Usuario Autenticado',
    };

    this.http.post(`${this.apiUrl}/auditoria-ediciones`, payload).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al registrar edición.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  probarIntentoBorradoAuditoria(id: string, onBlockedMessage: (msg: string) => void) {
    this.http.delete(`${this.apiUrl}/auditoria-ediciones/${id}`).subscribe({
      next: () => {},
      error: (err) => {
        onBlockedMessage(
          err?.error?.message ||
            'Operación denegada: El historial de ediciones es inmutable y no se puede borrar.',
        );
      },
    });
  }

  crearVehiculoConCheckIn(
    dto: any,
    onSuccess?: (vehiculo: any) => void,
    onError?: (msg: string) => void,
  ) {
    this.http.post<any>(`${this.apiUrl}/vehiculos`, dto).subscribe({
      next: (res) => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess(res);
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al registrar el vehículo.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  actualizarCheckInVehiculo(
    vehiculoId: string,
    dto: any,
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const payload = {
      ...dto,
      editadoPor: this.currentUser()?.nombreCompleto || 'Encargado Taller',
    };
    this.http.patch(`${this.apiUrl}/vehiculos/${vehiculoId}/checkin`, payload).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al actualizar el registro de recepción.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  agregarFotoAlCheckIn(
    vehiculoId: string,
    foto: { titulo: string; descripcionBreve: string; url: string; pesoKb: number },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    this.http.post(`${this.apiUrl}/vehiculos/${vehiculoId}/fotos-checkin`, foto).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'No se pudo anexar la fotografía al Check-In.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  crearCotizacionNueva(
    dto: {
      vehiculoId: string;
      observacionInicial?: string;
      items: Array<{
        categoria: 'CHAPERIA' | 'PINTURA' | 'MECANICA_INTERNA' | 'SERVICIO_TERCERO';
        piezaZona: string;
        gradoDanio?: 'NO_APLICA' | 'LEVE' | 'FUERTE';
        costoInternoOTerceroUsd: number;
        precioClienteUsd: number;
        fotoDesarmeAdendaWebp?: string;
        descripcionFotoAdenda?: string;
      }>;
    },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const payload = {
      ...dto,
      creadoPor: this.currentUser()?.nombreCompleto || 'Alfredo (Encargado Taller Chile)',
    };
    this.http.post(`${this.apiUrl}/cotizaciones`, payload).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al crear la cotización.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  agregarAdendaDesarme(
    cotizacionId: string,
    dto: {
      categoria: 'CHAPERIA' | 'PINTURA' | 'MECANICA_INTERNA' | 'SERVICIO_TERCERO';
      piezaZona: string;
      gradoDanio?: 'NO_APLICA' | 'LEVE' | 'FUERTE';
      costoInternoOTerceroUsd: number;
      precioClienteUsd: number;
      motivoAdenda: string;
      fotoDesarmeAdendaWebp?: string;
      descripcionFotoAdenda?: string;
    },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const payload = {
      ...dto,
      usuarioNombre: this.currentUser()?.nombreCompleto || 'Alfredo (Encargado Taller Chile)',
    };
    this.http.post(`${this.apiUrl}/cotizaciones/${cotizacionId}/items-adenda`, payload).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al registrar adenda por desarme.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  editarCotizacionCompleta(
    cotizacionId: string,
    dto: {
      montoAcordadoUsd?: number;
      motivo: string;
      pasarACola30Dias?: boolean;
      prioridadCola?: 'ALTA_15_DIAS' | 'COLA_30_DIAS';
      itemsActualizados?: Array<{
        id: string;
        piezaZona?: string;
        gradoDanio?: 'NO_APLICA' | 'LEVE' | 'FUERTE';
        costoInternoOTerceroUsd?: number;
        precioAcordadoClienteUsd: number;
      }>;
    },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const autorizadoPor = this.currentUser()?.nombreCompleto || 'Gerencia Bolivia';
    this.http
      .patch(`${this.apiUrl}/cotizaciones/${cotizacionId}/editar-bolivia`, {
        ...dto,
        autorizadoPor,
      })
      .subscribe({
        next: () => {
          this.loadBootstrapData();
          if (onSuccess) onSuccess();
        },
        error: (err) => {
          const msg = err?.error?.message || 'Error al guardar la edición de la cotización.';
          if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
        },
      });
  }

  editarCotizacionBolivia(
    cotizacionId: string,
    montoAcordadoUsd: number,
    motivo: string,
    pasarACola30Dias: boolean,
  ) {
    const autorizadoPor = this.currentUser()?.nombreCompleto || 'Gerencia Bolivia';
    this.http
      .patch(`${this.apiUrl}/cotizaciones/${cotizacionId}/editar-bolivia`, {
        montoAcordadoUsd,
        autorizadoPor,
        motivo,
        pasarACola30Dias,
      })
      .subscribe(() => this.loadBootstrapData());
  }

  aceptarCotizacionChile(
    cotizacionId: string,
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const aprobadoPor = this.currentUser()?.nombreCompleto || 'Alfredo (Chile)';
    this.http
      .patch(`${this.apiUrl}/cotizaciones/${cotizacionId}/aceptar-chile`, { aprobadoPor })
      .subscribe({
        next: () => {
          this.loadBootstrapData();
          if (onSuccess) onSuccess();
        },
        error: (err) => {
          const msg = err?.error?.message || 'Error al aprobar cotización en estado Verde.';
          if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
        },
      });
  }

  rechazarCotizacion(
    cotizacionId: string,
    dto: { motivo: string; retirarSinReparar?: boolean },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const rechazadoPor = this.currentUser()?.nombreCompleto || 'Administración / Taller';
    this.http
      .patch(`${this.apiUrl}/cotizaciones/${cotizacionId}/rechazar`, {
        ...dto,
        rechazadoPor,
      })
      .subscribe({
        next: () => {
          this.loadBootstrapData();
          if (onSuccess) onSuccess();
        },
        error: (err) => {
          const msg = err?.error?.message || 'Error al registrar el rechazo de la cotización.';
          if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
        },
      });
  }

  // --- MÓDULO 4: ÓRDENES DE TRABAJO (OT) ---
  recalcularAtrasos(onSuccess?: (res: any) => void, onError?: (msg: string) => void) {
    this.http.post<any>(`${this.apiUrl}/tareas/recalcular-atrasos`, {}).subscribe({
      next: (res) => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess(res);
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al recalcular atrasos.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  crearTareaOt(
    dto: {
      vehiculoId: string;
      titulo: string;
      tipo: string;
      tecnicoAsignadoId: string;
      pagoAcordadoUsd: number;
      fechaInicio: string;
      fechaLimite: string;
    },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const payload = {
      ...dto,
      usuarioNombre: this.currentUser()?.nombreCompleto || 'Alfredo (Taller Chile)',
    };
    this.http.post(`${this.apiUrl}/tareas`, payload).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al crear la tarea de la OT.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  cambiarEstadoTarea(
    tareaId: string,
    dto: {
      completada: boolean;
      calificacionEstrellas?: number;
      controlCalidadMasilla?: 'APROBADA' | 'EXCESO_MASILLA';
      observacionCalidad?: string;
      motivo?: string;
    },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const payload = {
      ...dto,
      usuarioNombre: this.currentUser()?.nombreCompleto || 'Alfredo (Taller Chile)',
    };
    this.http.patch(`${this.apiUrl}/tareas/${tareaId}/estado`, payload).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al actualizar estado de la tarea.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  darProrroga(
    tareaId: string,
    dto: { dias: number; causa: string; motivo: string },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const usuarioNombre = this.currentUser()?.nombreCompleto || 'Alfredo (Chile)';
    this.http
      .patch(`${this.apiUrl}/tareas/${tareaId}/prorroga`, { ...dto, usuarioNombre })
      .subscribe({
        next: () => {
          this.loadBootstrapData();
          if (onSuccess) onSuccess();
        },
        error: (err) => {
          const msg = err?.error?.message || 'Error al otorgar prórroga.';
          if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
        },
      });
  }

  aplicarMulta(
    tareaId: string,
    diasMora: number,
    onSuccess?: () => void,
    onError?: (msg: string) => void,
    motivo?: string,
  ) {
    const usuarioNombre = this.currentUser()?.nombreCompleto || 'Gerencia Bolivia';
    this.http
      .patch(`${this.apiUrl}/tareas/${tareaId}/multa`, {
        diasMora,
        motivo: motivo?.trim() || undefined,
        usuarioNombre,
      })
      .subscribe({
        next: () => {
          this.loadBootstrapData();
          if (onSuccess) onSuccess();
        },
        error: (err) => {
          const msg = err?.error?.message || 'Error al aplicar multa por retraso.';
          if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
        },
      });
  }

  reasignarTecnico(
    tareaId: string,
    nuevoTecnicoId: string,
    motivo: string,
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const usuarioNombre = this.currentUser()?.nombreCompleto || 'Alfredo (Chile)';
    this.http
      .patch(`${this.apiUrl}/tareas/${tareaId}/reasignar`, {
        nuevoTecnicoId,
        motivo,
        usuarioNombre,
      })
      .subscribe({
        next: () => {
          this.loadBootstrapData();
          if (onSuccess) onSuccess();
        },
        error: (err) => {
          const msg = err?.error?.message || 'Error al reasignar el técnico.';
          if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
        },
      });
  }

  // --- MÓDULO 5: REPUESTOS EN CUENTAGOTAS ---
  solicitarRepuesto(
    dto: {
      vehiculoId: string;
      nombreRepuesto: string;
      proveedorOrigen?: string;
      costoRepuestoUsd?: number;
      observacion?: string;
    },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const payload = {
      ...dto,
      solicitadoPor: this.currentUser()?.nombreCompleto || 'Alfredo (Taller Chile)',
    };
    this.http.post(`${this.apiUrl}/repuestos`, payload).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al solicitar repuesto.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  registrarRecepcionRepuesto(
    repuestoId: string,
    dto: {
      resultado: 'RECIBIDO_OK' | 'OBSERVADO_NO_COMPATIBLE';
      codigoSerie: string;
      fotoUrl: string;
      descripcionFoto: string;
      costoRepuestoUsd?: number;
      proveedorOrigen?: string;
      observacion?: string;
    },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const payload = {
      ...dto,
      usuarioNombre: this.currentUser()?.nombreCompleto || 'Alfredo (Taller Chile)',
    };
    this.http.patch(`${this.apiUrl}/repuestos/${repuestoId}/recepcion`, payload).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al registrar recepción del repuesto.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  editarRepuesto(
    repuestoId: string,
    dto: {
      nombreRepuesto?: string;
      proveedorOrigen?: string;
      costoRepuestoUsd?: number;
      codigoSerie?: string;
      observacion?: string;
      motivoEdicion: string;
    },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    this.http.patch(`${this.apiUrl}/repuestos/${repuestoId}`, dto).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al actualizar datos del repuesto.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  marcarRepuestoInstalado(
    repuestoId: string,
    onSuccess?: () => void,
    onError?: (msg: string) => void,
    observacion?: string,
  ) {
    const usuarioNombre = this.currentUser()?.nombreCompleto || 'Alfredo (Taller Chile)';
    const payload: { usuarioNombre: string; observacion?: string } = { usuarioNombre };
    if (observacion?.trim()) {
      payload.observacion = observacion.trim();
    }
    this.http.patch(`${this.apiUrl}/repuestos/${repuestoId}/instalado`, payload).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al marcar repuesto como instalado.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  // --- MÓDULO 6: ALMACÉN E INSUMOS RECURRENTES Y COLORISTA ---
  crearInsumoAlmacen(
    dto: {
      nombre: string;
      unidadMedida: string;
      stockActual?: number;
      stockMinimoAlerta?: number;
      costoUnitarioUsd?: number;
    },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const payload = {
      ...dto,
      usuarioNombre: this.currentUser()?.nombreCompleto || 'Alfredo (Taller Chile)',
    };
    this.http.post(`${this.apiUrl}/almacen/insumos`, payload).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al dar de alta el insumo en el almacén.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  editarInsumoAlmacen(
    insumoId: string,
    dto: {
      nombre?: string;
      unidadMedida?: string;
      stockActual?: number;
      stockMinimoAlerta?: number;
      costoUnitarioUsd?: number;
      motivoEdicion: string;
    },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const payload = {
      ...dto,
      usuarioNombre: this.currentUser()?.nombreCompleto || 'Alfredo (Taller Chile)',
    };
    this.http.patch(`${this.apiUrl}/almacen/insumos/${insumoId}`, payload).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al actualizar datos del insumo.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  registrarMovimientoAlmacen(
    dto: {
      tipo: 'ENTRADA_STOCK' | 'SALIDA_POR_TAREA' | 'COMPRA_PINTURA_COLORISTA';
      insumoId?: string;
      insumoNombre?: string;
      cantidad: number;
      unidad?: string;
      vehiculoId?: string;
      vehiculoReferencia?: string;
      tareaReferencia?: string;
      costoTotalUsd?: number;
      fotoFacturaUrl?: string;
      descripcionFotoFactura?: string;
    },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const payload = {
      ...dto,
      usuarioNombre: this.currentUser()?.nombreCompleto || 'Alfredo (Taller Chile)',
    };
    this.http.post(`${this.apiUrl}/almacen/movimientos`, payload).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al registrar movimiento en almacén.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  // --- MÓDULO 7: PERSONAL Y HERRAMIENTAS ---
  crearTecnico(
    dto: {
      nombre: string;
      especialidad: string;
      modalidad: string;
      sueldoFijoMensualUsd?: number;
      observacionDesempeno?: string;
    },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const payload = {
      ...dto,
      usuarioNombre: this.currentUser()?.nombreCompleto || 'Encargado Taller',
    };
    this.http.post(`${this.apiUrl}/personal/tecnicos`, payload).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al registrar técnico en el directorio.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  editarTecnico(
    id: string,
    dto: {
      nombre?: string;
      especialidad?: string;
      modalidad?: string;
      sueldoFijoMensualUsd?: number;
      observacionDesempeno?: string;
      motivoEdicion: string;
    },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const payload = {
      ...dto,
      usuarioNombre: this.currentUser()?.nombreCompleto || 'Administración',
    };
    this.http.patch(`${this.apiUrl}/personal/tecnicos/${id}`, payload).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al actualizar datos del especialista.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  toggleBloqueoTecnico(
    id: string,
    motivo: string,
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const payload = {
      motivo,
      usuarioNombre: this.currentUser()?.nombreCompleto || 'Administración',
    };
    this.http.patch(`${this.apiUrl}/personal/tecnicos/${id}/toggle-bloqueo`, payload).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al cambiar estado del técnico.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  crearHerramienta(
    dto: {
      nombre: string;
      costoCompraUsd?: number;
      estado?: 'ACTIVA' | 'COMPRA_SOLICITADA';
      detalleBaja?: string;
    },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const payload = {
      ...dto,
      usuarioNombre: this.currentUser()?.nombreCompleto || 'Encargado Taller',
    };
    this.http.post(`${this.apiUrl}/herramientas`, payload).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al registrar herramienta.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  editarHerramienta(
    id: string,
    dto: {
      nombre?: string;
      costoCompraUsd?: number;
      motivoEdicion: string;
    },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const payload = {
      ...dto,
      usuarioNombre: this.currentUser()?.nombreCompleto || 'Encargado Taller',
    };
    this.http.patch(`${this.apiUrl}/herramientas/${id}`, payload).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al actualizar herramienta.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  activarHerramientaCompra(
    id: string,
    dto: {
      costoCompraUsd?: number;
      motivo?: string;
    },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const payload = {
      ...dto,
      usuarioNombre: this.currentUser()?.nombreCompleto || 'Encargado Taller',
    };
    this.http.patch(`${this.apiUrl}/herramientas/${id}/activar`, payload).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al confirmar ingreso de herramienta.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  darDeBajaHerramienta(
    id: string,
    dto: {
      tipoCausaBaja: 'DESGASTE_NORMAL' | 'MAL_USO_COBRAR';
      responsableBaja: string;
      detalleBaja: string;
      fotoHerramientaRotaWebp: string;
      descripcionFotoBaja: string;
    },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    const payload = {
      ...dto,
      usuarioNombre: this.currentUser()?.nombreCompleto || 'Encargado Taller',
    };
    this.http.patch(`${this.apiUrl}/herramientas/${id}/baja`, payload).subscribe({
      next: () => {
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al registrar baja de la herramienta.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  // --- MÓDULO 8: REPORTES FINANCIEROS E INFORME FINAL (EXCLUSIVO BOLIVIA) ---
  obtenerReporteFinanciero(
    onSuccess?: (data: any) => void,
    onError?: (msg: string) => void,
  ) {
    const rol = this.currentUser()?.rol || 'SUPERADMIN_BOLIVIA';
    this.http
      .get<any>(`${this.apiUrl}/reportes/financiero?rol=${rol}`, {
        headers: { 'x-user-role': rol },
      })
      .subscribe({
        next: (data) => {
          if (onSuccess) onSuccess(data);
        },
        error: (err) => {
          const msg = err?.error?.message || 'Error al cargar reporte financiero.';
          if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
        },
      });
  }

  obtenerInformeFinalPdfData(
    vehiculoId: string,
    onSuccess?: (data: any) => void,
    onError?: (msg: string) => void,
  ) {
    const rol = this.currentUser()?.rol || 'SUPERADMIN_BOLIVIA';
    this.http
      .get<any>(`${this.apiUrl}/reportes/informe-final-pdf-data/${vehiculoId}?rol=${rol}`, {
        headers: { 'x-user-role': rol },
      })
      .subscribe({
        next: (data) => {
          if (onSuccess) onSuccess(data);
        },
        error: (err) => {
          const msg = err?.error?.message || 'Error al generar datos del informe final.';
          if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
        },
      });
  }

  actualizarConfiguracionGlobal(
    payload: {
      tasaUsdAClp: number;
      multaPorDiaRetrasoUsd: number;
      gastosFijosMensualesTallerUsd: number;
      motivo?: string;
    },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    this.http.patch<any>(`${this.apiUrl}/configuracion`, payload).subscribe({
      next: (res) => {
        if (res?.configuracion) {
          this.configuracion.set(res.configuracion);
        }
        this.loadBootstrapData();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'No se pudo actualizar la configuración global.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  cargarUsuariosSistema(onError?: (msg: string) => void) {
    this.http.get<UsuarioSistemaItem[]>(`${this.apiUrl}/usuarios`).subscribe({
      next: (list) => {
        this.usuariosSistema.set(list || []);
      },
      error: (err) => {
        const msg = err?.error?.message || 'No se pudo cargar la lista de usuarios.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  crearUsuarioSistema(
    payload: { nombreCompleto: string; email: string; password: string; rol: RolSistema },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    this.http.post<UsuarioSistemaItem>(`${this.apiUrl}/usuarios`, payload).subscribe({
      next: () => {
        this.cargarUsuariosSistema();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'No se pudo crear el usuario.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  toggleUsuarioActivo(id: string, onSuccess?: () => void, onError?: (msg: string) => void) {
    this.http.patch<UsuarioSistemaItem>(`${this.apiUrl}/usuarios/${id}/toggle-activo`, {}).subscribe({
      next: () => {
        this.cargarUsuariosSistema();
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'No se pudo actualizar el estado del usuario.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }

  cambiarMiPassword(
    payload: { currentPassword: string; newPassword: string },
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) {
    this.http.patch<any>(`${this.apiUrl}/auth/cambiar-password`, payload).subscribe({
      next: () => {
        if (onSuccess) onSuccess();
      },
      error: (err) => {
        const msg = err?.error?.message || 'No se pudo actualizar la contraseña.';
        if (onError) onError(Array.isArray(msg) ? msg.join(', ') : msg);
      },
    });
  }
}
