import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../../core/services/app-state.service';
import { NotificacionItem } from '../../../core/models/system.models';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="no-print h-16 bg-slate-900/85 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between gap-3 sm:gap-4 sticky top-0 z-30">
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <button
          type="button"
          (click)="state.sidebarMobileOpen.set(true)"
          class="lg:hidden w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-200 hover:bg-slate-700 transition cursor-pointer shrink-0"
          aria-label="Abrir menú lateral"
        >
          <i class="ri-menu-2-line text-lg"></i>
        </button>

        <div class="relative flex-1 max-w-md">
          <i class="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input
            type="text"
            [ngModel]="state.searchQuery()"
            (ngModelChange)="state.searchQuery.set($event)"
            placeholder="Buscar VIN, placa, lote, vehículo o cliente..."
            class="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition shadow-inner"
          />
          @if (state.searchQuery()) {
            <button
              type="button"
              (click)="state.searchQuery.set('')"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
              title="Limpiar búsqueda"
            >
              <i class="ri-close-circle-line"></i>
            </button>
          }
        </div>
      </div>

      <div class="flex items-center gap-2 sm:gap-3 shrink-0">
        <!-- Estado real de conexión SSE -->
        @if (state.sseStatus() === 'CONECTADO') {
          <div
            class="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold tracking-wider uppercase"
            title="Flujo de eventos en tiempo real activo (Bolivia ↔ Chile)"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Tiempo Real</span>
          </div>
        } @else if (state.sseStatus() === 'CONECTANDO') {
          <div
            class="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[10px] font-bold tracking-wider uppercase"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
            <span>Conectando</span>
          </div>
        } @else {
          <button
            type="button"
            (click)="state.connectRealtimeSse()"
            class="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-300 hover:text-white text-[10px] font-bold tracking-wider uppercase cursor-pointer transition"
            title="Reintentar conexión en tiempo real"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            <span>Reconectar</span>
          </button>
        }

        <!-- Selector USD / CLP -->
        <div
          class="bg-slate-950 border border-slate-800 rounded-xl p-1 flex items-center text-[11px] font-bold shadow-inner"
          [title]="'Tipo de cambio vigente: 1 USD = ' + state.configuracion().tasaUsdAClp + ' CLP'"
        >
          <button
            type="button"
            (click)="state.currency.set('USD')"
            class="px-2 sm:px-2.5 py-1 rounded-lg transition cursor-pointer"
            [class.bg-blue-600]="state.currency() === 'USD'"
            [class.text-white]="state.currency() === 'USD'"
            [class.shadow]="state.currency() === 'USD'"
            [class.text-slate-400]="state.currency() !== 'USD'"
            [class.hover:text-white]="state.currency() !== 'USD'"
          >
            USD
          </button>
          <button
            type="button"
            (click)="state.currency.set('CLP')"
            class="px-2 sm:px-2.5 py-1 rounded-lg transition cursor-pointer"
            [class.bg-blue-600]="state.currency() === 'CLP'"
            [class.text-white]="state.currency() === 'CLP'"
            [class.shadow]="state.currency() === 'CLP'"
            [class.text-slate-400]="state.currency() !== 'CLP'"
            [class.hover:text-white]="state.currency() !== 'CLP'"
          >
            CLP
          </button>
        </div>

        <!-- Botón Subir Foto Rápida -->
        <button
          type="button"
          (click)="openPhotoModal.emit()"
          class="px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-900/30 transition cursor-pointer"
          title="Anexar fotografía al expediente del vehículo"
        >
          <i class="ri-camera-lens-line text-sm"></i>
          <span class="hidden sm:inline">Anexar Foto</span>
        </button>

        <!-- Campanita de Notificaciones Interactiva -->
        <div class="relative">
          <button
            type="button"
            (click)="toggleDrawer($event)"
            class="relative w-9 h-9 rounded-xl bg-slate-950 border flex items-center justify-center transition cursor-pointer"
            [class.border-blue-500]="state.notificationsDrawerOpen()"
            [class.text-white]="state.notificationsDrawerOpen()"
            [class.border-slate-800]="!state.notificationsDrawerOpen()"
            [class.text-slate-300]="!state.notificationsDrawerOpen()"
            title="Alertas en tiempo real"
          >
            <i class="ri-notification-3-line text-base"></i>
            @if (state.notificacionesNoLeidasCount() > 0) {
              <span class="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg border-2 border-slate-900">
                {{ state.notificacionesNoLeidasCount() }}
              </span>
            }
          </button>

          @if (state.notificationsDrawerOpen()) {
            <div
              (click)="$event.stopPropagation()"
              class="absolute right-0 mt-2.5 w-[calc(100vw-2rem)] sm:w-[420px] max-w-[420px] rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl z-50 overflow-hidden"
            >
              <!-- Header -->
              <div class="px-4 py-3 border-b border-slate-800 bg-slate-950/70 space-y-2.5">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-blue-400"></span>
                    <span class="text-xs font-extrabold text-white tracking-tight">
                      Notificaciones en Tiempo Real
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    @if (state.notificacionesNoLeidasCount() > 0) {
                      <button
                        type="button"
                        (click)="state.marcarNotificacionesLeidas()"
                        class="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition cursor-pointer"
                      >
                        Marcar todo leído
                      </button>
                    }
                    <button
                      type="button"
                      (click)="state.notificationsDrawerOpen.set(false)"
                      class="w-6 h-6 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
                    >
                      <i class="ri-close-line"></i>
                    </button>
                  </div>
                </div>

                <!-- Filtros Todas / No leídas -->
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    (click)="filtroLeidas.set('TODAS')"
                    class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer"
                    [class.bg-blue-600]="filtroLeidas() === 'TODAS'"
                    [class.text-white]="filtroLeidas() === 'TODAS'"
                    [class.bg-slate-800]="filtroLeidas() !== 'TODAS'"
                    [class.text-slate-400]="filtroLeidas() !== 'TODAS'"
                  >
                    Todas ({{ state.notificaciones().length }})
                  </button>
                  <button
                    type="button"
                    (click)="filtroLeidas.set('NO_LEIDAS')"
                    class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer"
                    [class.bg-blue-600]="filtroLeidas() === 'NO_LEIDAS'"
                    [class.text-white]="filtroLeidas() === 'NO_LEIDAS'"
                    [class.bg-slate-800]="filtroLeidas() !== 'NO_LEIDAS'"
                    [class.text-slate-400]="filtroLeidas() !== 'NO_LEIDAS'"
                  >
                    No leídas ({{ state.notificacionesNoLeidasCount() }})
                  </button>
                  <span class="ml-auto text-[10px] text-slate-500">Clic para ir al módulo</span>
                </div>
              </div>

              <!-- Lista clicable -->
              <div class="max-h-96 overflow-y-auto divide-y divide-slate-800/70">
                @for (n of notificacionesFiltradas(); track n.id) {
                  <div
                    role="button"
                    tabindex="0"
                    (click)="state.abrirNotificacion(n)"
                    (keydown.enter)="state.abrirNotificacion(n)"
                    class="p-3.5 transition cursor-pointer flex items-start gap-3 group hover:bg-slate-800/70"
                    [ngClass]="!n.leida ? 'bg-blue-950/25' : ''"
                  >
                    <div
                      class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                      [ngClass]="obtenerEstilosTipo(n.tipo)"
                    >
                      <i [class]="obtenerIconoTipo(n.tipo) + ' text-base'"></i>
                    </div>

                    <div class="flex-1 min-w-0 space-y-1">
                      <div class="flex items-start justify-between gap-2">
                        <p
                          class="text-xs leading-snug line-clamp-2"
                          [class.font-bold]="!n.leida"
                          [class.text-white]="!n.leida"
                          [class.font-medium]="n.leida"
                          [class.text-slate-300]="n.leida"
                        >
                          {{ n.titulo }}
                        </p>
                        @if (!n.leida) {
                          <span class="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-1" title="No leída"></span>
                        }
                      </div>

                      <p class="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                        {{ n.mensaje }}
                      </p>

                      <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div class="flex flex-wrap items-center gap-1.5">
                          <span class="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-semibold text-cyan-300 group-hover:border-cyan-500/50 transition">
                            Ir a: {{ obtenerEtiquetaModulo(n.moduloDestino) }}
                          </span>
                          <span class="text-[10px] text-slate-400">
                            {{ formatearTiempoRelativo(n.creadoEn) }} · {{ state.formatFechaHoraCorta(n.creadoEn) }}
                          </span>
                          @if (n.actorNombre) {
                            <span class="text-[10px] text-slate-400 truncate max-w-[160px]" [title]="n.actorNombre">
                              · {{ n.actorNombre }}
                            </span>
                          }
                        </div>

                        @if (!n.leida) {
                          <button
                            type="button"
                            (click)="$event.stopPropagation(); state.marcarUnaNotificacionLeida(n.id)"
                            class="text-[10px] font-semibold text-slate-400 hover:text-emerald-400 transition cursor-pointer"
                            title="Marcar solo como leída"
                          >
                            ✓ Leída
                          </button>
                        }
                      </div>
                    </div>
                  </div>
                } @empty {
                  <div class="p-8 text-center space-y-2 text-xs text-slate-500">
                    <i class="ri-notification-off-line text-2xl block text-slate-600"></i>
                    <p>
                      {{
                        filtroLeidas() === 'NO_LEIDAS'
                          ? 'No tienes notificaciones pendientes sin leer.'
                          : 'No hay alertas registradas por el momento.'
                      }}
                    </p>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </header>
  `,
})
export class NavbarComponent {
  state = inject(AppStateService);
  private elementRef = inject(ElementRef);
  @Output() openPhotoModal = new EventEmitter<void>();

  filtroLeidas = signal<'TODAS' | 'NO_LEIDAS'>('TODAS');

  notificacionesFiltradas = computed(() => {
    const list = this.state.notificaciones();
    if (this.filtroLeidas() === 'NO_LEIDAS') {
      return list.filter((n) => !n.leida);
    }
    return list;
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (
      this.state.notificationsDrawerOpen() &&
      !this.elementRef.nativeElement.contains(event.target)
    ) {
      this.state.notificationsDrawerOpen.set(false);
    }
  }

  toggleDrawer(event: MouseEvent) {
    event.stopPropagation();
    this.state.notificationsDrawerOpen.set(!this.state.notificationsDrawerOpen());
  }

  obtenerIconoTipo(tipo: string): string {
    if (tipo.includes('ATRASO') || tipo.includes('MULTA')) return 'ri-alarm-warning-line';
    if (tipo.includes('COTIZACION')) return 'ri-file-list-3-line';
    if (tipo.includes('REPUESTO')) return 'ri-settings-5-line';
    if (tipo.includes('HERRAMIENTA')) return 'ri-hammer-line';
    if (tipo.includes('INSUMO') || tipo.includes('STOCK')) return 'ri-paint-brush-line';
    if (tipo.includes('FINALIZADO')) return 'ri-file-pdf-2-line';
    if (tipo.includes('RECEPCION')) return 'ri-car-line';
    if (tipo.includes('EVIDENCIA')) return 'ri-image-2-line';
    return 'ri-notification-badge-line';
  }

  obtenerEstilosTipo(tipo: string): string {
    if (tipo.includes('ATRASO') || tipo.includes('BAJA') || tipo.includes('OBSERVADO')) {
      return 'bg-rose-500/15 border-rose-500/30 text-rose-400';
    }
    if (tipo.includes('COTIZACION_EDITADA') || tipo.includes('STOCK_BAJO')) {
      return 'bg-amber-500/15 border-amber-500/30 text-amber-400';
    }
    if (tipo.includes('FINALIZADO') || tipo.includes('APROBADA') || tipo.includes('RECIBIDO')) {
      return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
    }
    return 'bg-blue-500/15 border-blue-500/30 text-blue-400';
  }

  obtenerEtiquetaModulo(moduloDestino: string): string {
    const map: Record<string, string> = {
      dashboard: 'Panel Principal',
      recepcion: 'Recepción y Check-In',
      cotizacion: 'Cotizaciones',
      ordenes: 'Órdenes de Trabajo',
      repuestos: 'Repuestos',
      almacen: 'Almacén e Insumos',
      herramientas: 'Personal y Herramientas',
      reportes: 'Informes y Costeo',
    };
    return map[moduloDestino] || 'Módulo';
  }

  formatearTiempoRelativo(iso: string): string {
    if (!iso) return 'Reciente';
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.max(0, Math.floor(diffMs / 60000));
    if (mins < 1) return 'Ahora mismo';
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} d`;
  }
}
