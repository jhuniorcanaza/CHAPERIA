import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../core/services/app-state.service';
import { comprimirImagenNavegadorWebp } from '../../core/utils/webp-compressor';
import { AuditHistoryPanelComponent } from '../../shared/components/audit-history-panel/audit-history-panel.component';

type FiltroRepuestos =
  | 'TODOS'
  | 'SOLICITADO'
  | 'OBSERVADO_NO_COMPATIBLE'
  | 'RECIBIDO_OK'
  | 'INSTALADO';

type ModoPanelRepuesto = 'recepcion' | 'editar';

interface LightboxRepuesto {
  url: string;
  titulo: string;
  descripcion: string;
}

@Component({
  selector: 'app-repuestos',
  standalone: true,
  imports: [CommonModule, FormsModule, AuditHistoryPanelComponent],
  template: `
    <div class="space-y-6">
      <!-- Encabezado principal -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div class="space-y-1 max-w-3xl">
          <div class="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <i class="ri-cpu-line text-sm"></i>
            <span>Control de Repuestos y Trazabilidad Fotográfica</span>
          </div>
          <h1 class="text-lg sm:text-xl font-bold text-white">
            Solicitudes por Pieza, Código de Serie y Recepción con Fotografía Obligatoria
          </h1>
          <p class="text-xs text-slate-400">
            Seguimiento individual de repuestos por vehículo con código de serie y fotografía de recepción.
          </p>
        </div>

        <button
          type="button"
          (click)="errorMsg.set(''); mostrarFormSolicitud.set(true)"
          class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
        >
          <i class="ri-add-line"></i>
          <span>Solicitar repuesto</span>
        </button>
      </div>

      <!-- KPIs clicables -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
        <button
          type="button"
          (click)="filtroEstado.set('TODOS')"
          [ngClass]="filtroEstado() === 'TODOS' ? 'border-blue-500 bg-blue-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
          class="p-3.5 rounded-xl border text-left transition cursor-pointer"
        >
          <div class="text-[11px] text-slate-400 font-semibold">Total repuestos</div>
          <div class="text-2xl font-black text-white font-mono mt-1">{{ resumenKpis().total }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">{{ resumenKpis().vehiculosConRepuestos }} unidad(es)</div>
        </button>

        <button
          type="button"
          (click)="filtroEstado.set('SOLICITADO')"
          [ngClass]="filtroEstado() === 'SOLICITADO' ? 'border-amber-400 bg-amber-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
          class="p-3.5 rounded-xl border text-left transition cursor-pointer"
        >
          <div class="text-[11px] text-amber-300 font-semibold">En camino / Por recibir</div>
          <div class="text-2xl font-black text-amber-300 font-mono mt-1">{{ resumenKpis().solicitados }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Esperando fotografía</div>
        </button>

        <button
          type="button"
          (click)="filtroEstado.set('OBSERVADO_NO_COMPATIBLE')"
          [ngClass]="filtroEstado() === 'OBSERVADO_NO_COMPATIBLE' ? 'border-rose-400 bg-rose-950/40' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
          class="p-3.5 rounded-xl border text-left transition cursor-pointer"
        >
          <div class="text-[11px] text-rose-400 font-semibold">Observados / Incompatibles</div>
          <div class="text-2xl font-black text-rose-400 font-mono mt-1">{{ resumenKpis().observados }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Requieren cambio o reclamo</div>
        </button>

        <button
          type="button"
          (click)="filtroEstado.set('RECIBIDO_OK')"
          [ngClass]="filtroEstado() === 'RECIBIDO_OK' ? 'border-cyan-400 bg-cyan-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
          class="p-3.5 rounded-xl border text-left transition cursor-pointer"
        >
          <div class="text-[11px] text-cyan-300 font-semibold">Recibidos OK (Listos)</div>
          <div class="text-2xl font-black text-cyan-300 font-mono mt-1">{{ resumenKpis().recibidosOk }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Pendientes de montaje</div>
        </button>

        <button
          type="button"
          (click)="filtroEstado.set('INSTALADO')"
          [ngClass]="filtroEstado() === 'INSTALADO' ? 'border-emerald-400 bg-emerald-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
          class="p-3.5 rounded-xl border text-left transition cursor-pointer col-span-2 sm:col-span-1"
        >
          <div class="text-[11px] text-emerald-400 font-semibold">Instalados & Valorización</div>
          <div class="text-lg font-black text-emerald-400 font-mono mt-1">
            {{ resumenKpis().instalados }} ({{ state.formatMoney(resumenKpis().inversionUsd) }})
          </div>
          <div class="text-[10px] text-slate-500 mt-0.5">Costo total acumulado</div>
        </button>
      </div>

      <!-- Barra de búsqueda y resumen -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 text-xs">
        <div class="relative flex-1 max-w-lg">
          <i class="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input
            type="text"
            [ngModel]="busquedaTexto()"
            (ngModelChange)="busquedaTexto.set($event)"
            placeholder="Buscar por vehículo, VIN, lote, nombre de pieza, proveedor o N° serie..."
            class="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          @if (busquedaTexto().trim()) {
            <button
              type="button"
              (click)="busquedaTexto.set('')"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
            >
              <i class="ri-close-circle-line"></i>
            </button>
          }
        </div>

        <div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span>
            Mostrando <strong class="text-white">{{ vehiculosFiltrados().length }}</strong> unidad(es) y
            <strong class="text-white">{{ totalRepuestosMostrados() }}</strong> pieza(s)
          </span>
          @if (filtroEstado() !== 'TODOS' || busquedaTexto().trim() || state.focusedVehiculoId() || state.focusedReferenciaId()) {
            <button
              type="button"
              (click)="limpiarFiltros()"
              class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold cursor-pointer"
            >
              Limpiar filtros
            </button>
          }
        </div>
      </div>

      <!-- Bandeja rápida de vehículos activos sin repuestos solicitados -->
      @if (vehiculosSinRepuestos().length > 0) {
        <div class="p-4 rounded-xl bg-amber-950/20 border border-amber-500/35 space-y-2 text-xs">
          <div class="font-bold text-amber-300 flex items-center gap-2">
            <i class="ri-truck-line text-base"></i>
            <span>Unidades activas sin repuestos registrados todavía ({{ vehiculosSinRepuestos().length }})</span>
          </div>
          <div class="flex flex-wrap gap-2">
            @for (vs of vehiculosSinRepuestos(); track vs.id) {
              <button
                type="button"
                (click)="iniciarSolicitudPara(vs.id)"
                class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-blue-600 border border-amber-500/40 text-slate-100 font-semibold flex items-center gap-2 transition cursor-pointer"
              >
                <i class="ri-add-circle-line text-amber-400"></i>
                <span>{{ vs.marca }} {{ vs.modelo }} ({{ vs.placaOLote }})</span>
                <span class="text-[10px] font-mono text-slate-400">{{ vs.estado }}</span>
              </button>
            }
          </div>
        </div>
      }

      <!-- Alertas de feedback -->
      @if (feedbackMsg()) {
        <div class="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-xs text-emerald-200 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <i class="ri-checkbox-circle-line text-emerald-400 text-base shrink-0"></i>
            <span>{{ feedbackMsg() }}</span>
          </div>
          <button type="button" (click)="feedbackMsg.set('')" class="text-emerald-300 hover:text-white cursor-pointer shrink-0">
            <i class="ri-close-line"></i>
          </button>
        </div>
      }
      @if (errorMsg()) {
        <div class="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <i class="ri-error-warning-line text-rose-400 text-base shrink-0"></i>
            <span>{{ errorMsg() }}</span>
          </div>
          <button type="button" (click)="errorMsg.set('')" class="text-rose-300 hover:text-white cursor-pointer shrink-0">
            <i class="ri-close-line"></i>
          </button>
        </div>
      }

      <!-- Modal nueva solicitud de repuesto -->
      @if (mostrarFormSolicitud()) {
        <div
          (click)="mostrarFormSolicitud.set(false)"
          class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            (click)="$event.stopPropagation()"
            class="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden text-xs shadow-2xl"
          >
            <div class="px-5 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 shrink-0">
              <div>
                <div class="font-bold text-sm text-white flex items-center gap-2">
                  <i class="ri-shopping-bag-3-line text-blue-400 text-base"></i>
                  <span>Nueva solicitud de repuesto</span>
                </div>
                <span class="text-[11px] text-slate-400">Notifica automáticamente al tablero al registrar la solicitud.</span>
              </div>
              <button
                type="button"
                (click)="mostrarFormSolicitud.set(false)"
                class="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <i class="ri-close-line text-lg"></i>
              </button>
            </div>

            <div class="p-5 space-y-4 overflow-y-auto flex-1">

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="lg:col-span-2">
              <label class="block text-slate-300 font-semibold mb-1">Vehículo destino *</label>
              <select
                [(ngModel)]="nuevo.vehiculoId"
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
              >
                <option value="">Selecciona vehículo</option>
                @for (v of state.vehiculos(); track v.id) {
                  <option [value]="v.id">{{ v.marca }} {{ v.modelo }} ({{ v.placaOLote }}) — VIN {{ v.vinChasis }}</option>
                }
              </select>
            </div>
            <div class="lg:col-span-2">
              <label class="block text-slate-300 font-semibold mb-1">Nombre / descripción del repuesto *</label>
              <input
                type="text"
                [(ngModel)]="nuevo.nombreRepuesto"
                placeholder="Ej: Farol derecho OEM LED o Parachoques delantero"
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
              />
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">Proveedor / Origen</label>
              <input
                type="text"
                [(ngModel)]="nuevo.proveedorOrigen"
                placeholder="Ej: Desarmaduría Iquique / OEM ZOFRI"
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
              />
            </div>
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Costo referencial (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                [(ngModel)]="nuevo.costoRepuestoUsd"
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 font-mono"
              />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-slate-300 font-semibold mb-1">Observación o urgencia para bodega</label>
              <input
                type="text"
                [(ngModel)]="nuevo.observacion"
                placeholder="Ej: Conector de 8 pines, verificar código antes de despachar"
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
              />
            </div>
          </div>

              @if (errorMsg()) {
                <div class="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 flex items-center gap-2">
                  <i class="ri-error-warning-line text-rose-400 text-base shrink-0"></i>
                  <span>{{ errorMsg() }}</span>
                </div>
              }
            </div>

            <div class="px-5 py-3.5 border-t border-slate-800 bg-slate-950/70 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                (click)="mostrarFormSolicitud.set(false)"
                class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                [disabled]="solicitando()"
                (click)="solicitar()"
                class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold flex items-center gap-2 cursor-pointer"
              >
                <i [class]="solicitando() ? 'ri-loader-4-line animate-spin' : 'ri-send-plane-line'"></i>
                <span>{{ solicitando() ? 'Enviando solicitud...' : 'Registrar solicitud de repuesto' }}</span>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Listado agrupado por vehículo -->
      @for (v of vehiculosFiltrados(); track v.id) {
        <div
          [attr.data-focus-vehiculo]="v.id"
          [ngClass]="
            state.focusedVehiculoId() === v.id
              ? 'ring-2 ring-cyan-400 border-cyan-500/70'
              : 'border-slate-800'
          "
          class="bg-slate-900 border rounded-2xl p-5 space-y-4 transition shadow-lg"
        >
          <!-- Encabezado de unidad -->
          <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="font-bold text-base text-white">{{ v.marca }} {{ v.modelo }} ({{ v.anio }})</h3>
                <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">{{ v.placaOLote }}</span>
                <span class="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-500/30 text-blue-300 text-[11px] font-semibold">
                  {{ v.estado }}
                </span>
                @if (contarEstadoVehiculo(v, 'OBSERVADO_NO_COMPATIBLE') > 0) {
                  <span class="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-bold">
                    {{ contarEstadoVehiculo(v, 'OBSERVADO_NO_COMPATIBLE') }} observado(s)
                  </span>
                }
              </div>
              <div class="text-xs text-slate-400 font-mono">
                VIN: {{ v.vinChasis }} • Cliente: {{ v.nombreCliente }}
              </div>
              <div class="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                <button
                  type="button"
                  (click)="irAModulo(v.id, 'cotizacion')"
                  class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Ver Cotización
                </button>
                <button
                  type="button"
                  (click)="irAModulo(v.id, 'ordenes')"
                  class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Órdenes de Trabajo ({{ (v.tareasOt || []).length }})
                </button>
                <button
                  type="button"
                  (click)="iniciarSolicitudPara(v.id)"
                  class="px-2.5 py-1 rounded-lg bg-blue-950/60 hover:bg-blue-900 border border-blue-500/40 text-blue-300 font-semibold cursor-pointer"
                >
                  + Solicitar pieza para este auto
                </button>
              </div>
            </div>

            <div class="text-right space-y-1">
              <div class="text-xs text-slate-400">
                Instalación: <strong class="text-emerald-400 font-mono">{{ contarEstadoVehiculo(v, 'INSTALADO') }} / {{ (v.repuestos || []).length }}</strong>
                <span class="mx-1.5 text-slate-600">•</span>
                Total piezas: <strong class="text-amber-300 font-mono">{{ state.formatMoney(totalCostoVehiculo(v)) }}</strong>
              </div>
              <div class="w-48 sm:w-56 h-2 rounded-full bg-slate-800 overflow-hidden ml-auto">
                <div
                  class="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all"
                  [style.width.%]="progresoInstalacionVehiculo(v)"
                ></div>
              </div>
            </div>
          </div>

          <!-- Lista de repuestos del vehículo -->
          <div class="space-y-3">
            @for (r of repuestosVisiblesVehiculo(v); track r.id) {
              <div
                [attr.data-focus-ref]="r.id"
                [ngClass]="{
                  'ring-2 ring-cyan-400 border-cyan-500/80': state.focusedReferenciaId() === r.id,
                  'bg-emerald-950/20 border-emerald-500/35': r.estado === 'INSTALADO' && state.focusedReferenciaId() !== r.id,
                  'bg-rose-950/25 border-rose-500/45': r.estado === 'OBSERVADO_NO_COMPATIBLE' && state.focusedReferenciaId() !== r.id,
                  'bg-cyan-950/15 border-cyan-500/35': r.estado === 'RECIBIDO_OK' && state.focusedReferenciaId() !== r.id,
                  'bg-slate-950/75 border-slate-800': r.estado === 'SOLICITADO' && state.focusedReferenciaId() !== r.id
                }"
                class="p-4 rounded-xl border space-y-3 text-xs transition"
              >
                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <!-- Info y miniatura -->
                  <div class="flex items-start gap-3.5 min-w-0">
                    @if (r.fotoRecepcionWebp) {
                      <button
                        type="button"
                        (click)="
                          abrirLightbox(
                            state.resolveMediaUrl(r.fotoRecepcionWebp),
                            r.nombreRepuesto,
                            r.descripcionFotoRecepcion || r.observacion || 'Evidencia de recepción del repuesto'
                          )
                        "
                        class="group relative w-24 h-16 rounded-xl overflow-hidden border border-slate-700 hover:border-cyan-400 shrink-0 cursor-pointer bg-slate-900"
                        title="Ampliar fotografía de recepción"
                      >
                        <img
                          [src]="state.resolveMediaUrl(r.fotoRecepcionWebp)"
                          [alt]="r.nombreRepuesto"
                          class="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                      </button>
                    } @else {
                      <div class="w-24 h-16 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 flex flex-col items-center justify-center text-slate-500 shrink-0 text-[10px] text-center px-1">
                        <i class="ri-camera-off-line text-base mb-0.5"></i>
                        <span>Sin foto aún</span>
                      </div>
                    }

                    <div class="space-y-1 min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="font-bold text-sm text-white">{{ r.nombreRepuesto }}</span>
                        <span
                          [ngClass]="{
                            'bg-emerald-500/20 text-emerald-300 border-emerald-500/40': r.estado === 'INSTALADO',
                            'bg-cyan-500/20 text-cyan-300 border-cyan-500/40': r.estado === 'RECIBIDO_OK',
                            'bg-rose-500/20 text-rose-300 border-rose-500/40': r.estado === 'OBSERVADO_NO_COMPATIBLE',
                            'bg-amber-500/20 text-amber-300 border-amber-500/40': r.estado === 'SOLICITADO'
                          }"
                          class="px-2 py-0.5 rounded-full border font-bold text-[10px]"
                        >
                          {{ etiquetaEstado(r.estado) }}
                        </span>
                      </div>

                      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                        <span>Proveedor: <strong class="text-slate-200">{{ r.proveedorOrigen || 'Por definir' }}</strong></span>
                        <span>Costo: <strong class="text-amber-300 font-mono">{{ state.formatMoney(r.costoRepuestoUsd) }}</strong></span>
                        <span>Solicitó: <strong class="text-slate-200">{{ r.solicitadoPor }}</strong></span>
                        @if (r.fechaRegistro) {
                          <span>• Solicitado: <strong class="text-slate-300 font-mono">{{ state.formatFechaHora(r.fechaRegistro) }}</strong></span>
                        }
                      </div>

                      @if (r.codigoSerie || r.fechaRecepcion) {
                        <div class="text-[11px] text-cyan-300 font-mono">
                          N° Serie / Lote: {{ r.codigoSerie || 'No registrado' }}
                          @if (r.fechaRecepcion) {
                            <span class="text-slate-400 font-sans ml-2">
                              • Recibido: <strong class="font-mono text-emerald-300">{{ state.formatFechaHora(r.fechaRecepcion) }}</strong>
                            </span>
                          }
                        </div>
                      }

                      @if (r.observacion) {
                        <div
                          [ngClass]="
                            r.estado === 'OBSERVADO_NO_COMPATIBLE'
                              ? 'text-rose-300 bg-rose-950/40 border-rose-500/30 px-2.5 py-1 rounded-lg border'
                              : 'text-slate-300 italic'
                          "
                          class="text-[11px] mt-1"
                        >
                          {{ r.observacion }}
                        </div>
                      }
                    </div>
                  </div>

                  <!-- Botones de acción -->
                  <div class="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      (click)="abrirPanelEditar(v, r)"
                      class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <i class="ri-edit-line"></i>
                      <span>Editar</span>
                    </button>

                    @if (r.estado === 'SOLICITADO' || r.estado === 'OBSERVADO_NO_COMPATIBLE') {
                      <button
                        type="button"
                        (click)="abrirPanelRecepcion(v, r)"
                        class="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <i class="ri-camera-line"></i>
                        <span>{{ r.estado === 'OBSERVADO_NO_COMPATIBLE' ? 'Re-recibir reemplazo + foto' : 'Registrar llegada + foto' }}</span>
                      </button>
                    }

                    @if (r.estado === 'RECIBIDO_OK') {
                      <button
                        type="button"
                        [disabled]="instalandoId() === r.id"
                        (click)="marcarInstalado(r.id)"
                        class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <i [class]="instalandoId() === r.id ? 'ri-loader-4-line animate-spin' : 'ri-check-double-line'"></i>
                        <span>{{ instalandoId() === r.id ? 'Instalando...' : 'Marcar como instalado' }}</span>
                      </button>
                    }

                    @if (r.estado === 'INSTALADO') {
                      <span class="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1.5">
                        <i class="ri-checkbox-circle-fill"></i>
                        <span>Montado en unidad</span>
                      </span>
                    }
                  </div>
                </div>

                <!-- Panel inline: Registrar llegada / foto obligatoria -->
                @if (panel()?.id === r.id && panel()?.modo === 'recepcion') {
                  <div class="p-4 rounded-xl bg-slate-900 border border-amber-500/40 space-y-4">
                    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                      <div class="font-bold text-amber-300 flex items-center gap-2">
                        <i class="ri-camera-lens-line text-base"></i>
                        <span>Recepción Física con Fotografía y Verificación de Serie</span>
                      </div>
                      <button
                        type="button"
                        (click)="cerrarPanel()"
                        class="text-slate-400 hover:text-white cursor-pointer"
                      >
                        <i class="ri-close-line text-base"></i>
                      </button>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label class="block text-slate-300 font-semibold mb-1">Resultado físico *</label>
                        <select
                          [(ngModel)]="rec.resultado"
                          class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                        >
                          <option value="RECIBIDO_OK">Recibido OK (Compatible)</option>
                          <option value="OBSERVADO_NO_COMPATIBLE">Observado / No compatible (Alerta Bolivia)</option>
                        </select>
                      </div>
                      <div>
                        <label class="block text-slate-300 font-semibold mb-1">
                          Código de serie / OEM / Lote {{ rec.resultado === 'RECIBIDO_OK' ? '*' : '(opcional si observado)' }}
                        </label>
                        <input
                          type="text"
                          [(ngModel)]="rec.codigoSerie"
                          placeholder="Ej: 81110-0K910-OEM"
                          class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label class="block text-slate-300 font-semibold mb-1">Confirmar proveedor</label>
                        <input
                          type="text"
                          [(ngModel)]="rec.proveedorOrigen"
                          class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                        />
                      </div>
                      <div>
                        <label class="block text-slate-300 font-semibold mb-1">Confirmar costo real (USD)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          [(ngModel)]="rec.costoRepuestoUsd"
                          class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 font-mono"
                        />
                      </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label class="block text-slate-300 font-semibold mb-1">Descripción de la foto *</label>
                        <input
                          type="text"
                          [(ngModel)]="rec.descripcionFoto"
                          placeholder="Ej: Farol original sellado en caja con etiqueta de serie legible"
                          class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                        />
                      </div>
                      <div>
                        <label class="block text-slate-300 font-semibold mb-1">
                          Observación {{ rec.resultado === 'OBSERVADO_NO_COMPATIBLE' ? '* (motivo de incompatibilidad)' : '(opcional)' }}
                        </label>
                        <input
                          type="text"
                          [(ngModel)]="rec.observacion"
                          placeholder="Ej: Conector de 4 pines cuando el vehículo usa 6 pines"
                          class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                        />
                      </div>
                    </div>

                    <!-- Carga y vista previa WebP -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div class="sm:col-span-2 space-y-2">
                        <label class="block text-slate-300 font-semibold">
                          Fotografía obligatoria de la pieza o etiqueta *
                        </label>
                        <input
                          #fileInputRecepcion
                          type="file"
                          accept="image/*"
                          (change)="alSeleccionarFoto($event, fileInputRecepcion)"
                          class="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-amber-600 file:text-white file:font-semibold hover:file:bg-amber-500 cursor-pointer"
                        />
                        @if (comprimiendoFoto()) {
                          <div class="text-[11px] text-amber-300 flex items-center gap-1.5">
                            <i class="ri-loader-4-line animate-spin"></i>
                            <span>Procesando fotografía...</span>
                          </div>
                        } @else if (rec.compresionInfo) {
                          <div class="text-[11px] text-emerald-400 flex items-center gap-2">
                            <i class="ri-checkbox-circle-line"></i>
                            <span>{{ rec.compresionInfo }}</span>
                          </div>
                        }
                      </div>

                      <div class="flex items-center justify-end gap-2">
                        @if (rec.previewLocalUrl) {
                          <img
                            [src]="rec.previewLocalUrl"
                            alt="Vista previa"
                            class="w-24 h-16 rounded-lg object-cover border border-emerald-500/50"
                          />
                          <button
                            type="button"
                            (click)="limpiarFotoSeleccionada(fileInputRecepcion)"
                            class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-white font-semibold cursor-pointer"
                            title="Quitar fotografía"
                          >
                            <i class="ri-delete-bin-line"></i>
                          </button>
                        } @else {
                          <span class="text-[11px] text-slate-500 italic">Vista previa pendiente</span>
                        }
                      </div>
                    </div>

                    <div class="flex justify-end gap-2">
                      <button
                        type="button"
                        (click)="cerrarPanel()"
                        class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        [disabled]="procesando() || comprimiendoFoto()"
                        (click)="guardarRecepcion(v, r)"
                        class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold flex items-center gap-2 cursor-pointer"
                      >
                        <i [class]="procesando() ? 'ri-loader-4-line animate-spin' : 'ri-upload-cloud-2-line'"></i>
                        <span>{{ procesando() ? 'Guardando recepción...' : 'Confirmar recepción con foto' }}</span>
                      </button>
                    </div>
                  </div>
                }

                <!-- Panel inline: Editar datos y costo con auditoría -->
                @if (panel()?.id === r.id && panel()?.modo === 'editar') {
                  <div class="p-4 rounded-xl bg-slate-900 border border-blue-500/40 space-y-3">
                    <div class="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div class="font-bold text-blue-300 flex items-center gap-2">
                        <i class="ri-edit-box-line"></i>
                        <span>Editar datos y costo del repuesto</span>
                      </div>
                      <button
                        type="button"
                        (click)="cerrarPanel()"
                        class="text-slate-400 hover:text-white cursor-pointer"
                      >
                        <i class="ri-close-line text-base"></i>
                      </button>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div class="sm:col-span-2">
                        <label class="block text-slate-300 font-semibold mb-1">Nombre del repuesto *</label>
                        <input
                          type="text"
                          [(ngModel)]="editForm.nombreRepuesto"
                          class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                        />
                      </div>
                      <div>
                        <label class="block text-slate-300 font-semibold mb-1">Proveedor</label>
                        <input
                          type="text"
                          [(ngModel)]="editForm.proveedorOrigen"
                          class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                        />
                      </div>
                      <div>
                        <label class="block text-slate-300 font-semibold mb-1">Costo (USD)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          [(ngModel)]="editForm.costoRepuestoUsd"
                          class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 font-mono"
                        />
                      </div>

                      <div>
                        <label class="block text-slate-300 font-semibold mb-1">Código de serie</label>
                        <input
                          type="text"
                          [(ngModel)]="editForm.codigoSerie"
                          class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label class="block text-slate-300 font-semibold mb-1">Observación</label>
                        <input
                          type="text"
                          [(ngModel)]="editForm.observacion"
                          class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                        />
                      </div>
                      <div class="sm:col-span-2">
                        <label class="block text-slate-300 font-semibold mb-1">Motivo obligatorio de edición *</label>
                        <input
                          type="text"
                          [(ngModel)]="editForm.motivoEdicion"
                          placeholder="Ej: Ajuste con boleta definitiva de desarmaduría (+15 USD)"
                          class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-blue-500/40 text-white"
                        />
                      </div>
                    </div>

                    <div class="flex justify-end gap-2">
                      <button
                        type="button"
                        (click)="cerrarPanel()"
                        class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        [disabled]="guardandoEdicion()"
                        (click)="guardarEdicion(r)"
                        class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold flex items-center gap-2 cursor-pointer"
                      >
                        <i [class]="guardandoEdicion() ? 'ri-loader-4-line animate-spin' : 'ri-save-3-line'"></i>
                        <span>{{ guardandoEdicion() ? 'Guardando cambios...' : 'Guardar edición' }}</span>
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      } @empty {
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-2 text-xs text-slate-400">
          <i class="ri-settings-5-line text-3xl text-slate-600"></i>
          <p class="text-sm font-bold text-slate-200">No hay repuestos que coincidan con este filtro</p>
          <p>
            Usa el botón <strong class="text-blue-400">"Solicitar repuesto"</strong> o selecciona una unidad de la bandeja superior para comenzar el seguimiento de repuestos.
          </p>
        </div>
      }

      <!-- Auditoría Inmutable de Repuestos -->
      <app-audit-history-panel defaultModulo="REPUESTOS"></app-audit-history-panel>

      <!-- Lightbox fotografía de repuesto -->
      @if (lightbox(); as lb) {
        <div
          (click)="lightbox.set(null)"
          class="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            (click)="$event.stopPropagation()"
            class="relative max-w-3xl w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3 shadow-2xl cursor-default"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <h4 class="font-bold text-sm text-white">{{ lb.titulo }}</h4>
                <p class="text-xs text-slate-400">{{ lb.descripcion }}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <a
                  [href]="lb.url"
                  target="_blank"
                  rel="noopener"
                  class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-blue-300 font-semibold"
                >
                  Abrir archivo
                </a>
                <button
                  type="button"
                  (click)="lightbox.set(null)"
                  class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer"
                >
                  <i class="ri-close-line text-base"></i>
                </button>
              </div>
            </div>
            <img [src]="lb.url" [alt]="lb.titulo" class="w-full max-h-[75vh] object-contain rounded-xl bg-slate-950" />
          </div>
        </div>
      }
    </div>
  `,
})
export class RepuestosComponent {
  state = inject(AppStateService);

  feedbackMsg = signal('');
  errorMsg = signal('');
  mostrarFormSolicitud = signal(false);
  filtroEstado = signal<FiltroRepuestos>('TODOS');
  busquedaTexto = signal<string>('');

  solicitando = signal(false);
  panel = signal<{ id: string; modo: ModoPanelRepuesto; vehiculoId: string } | null>(null);
  procesando = signal(false);
  comprimiendoFoto = signal(false);
  guardandoEdicion = signal(false);
  instalandoId = signal<string | null>(null);
  lightbox = signal<LightboxRepuesto | null>(null);

  private fotoComprimidaFile: File | null = null;

  nuevo = {
    vehiculoId: '',
    nombreRepuesto: '',
    proveedorOrigen: '',
    costoRepuestoUsd: 0,
    observacion: '',
  };

  rec = {
    resultado: 'RECIBIDO_OK' as 'RECIBIDO_OK' | 'OBSERVADO_NO_COMPATIBLE',
    codigoSerie: '',
    proveedorOrigen: '',
    costoRepuestoUsd: 0,
    descripcionFoto: '',
    observacion: '',
    previewLocalUrl: '',
    compresionInfo: '',
  };

  editForm = {
    nombreRepuesto: '',
    proveedorOrigen: '',
    costoRepuestoUsd: 0,
    codigoSerie: '',
    observacion: '',
    motivoEdicion: '',
  };

  constructor() {
    effect(() => {
      const fVehiculo = this.state.focusedVehiculoId();
      const fRef = this.state.focusedReferenciaId();
      if (!fVehiculo && !fRef) return;
      this.filtroEstado.set('TODOS');
      this.busquedaTexto.set('');
      this.mostrarFormSolicitud.set(false);
    });
  }

  resumenKpis = computed(() => {
    let total = 0;
    let solicitados = 0;
    let observados = 0;
    let recibidosOk = 0;
    let instalados = 0;
    let inversionUsd = 0;
    let vehiculosConRepuestos = 0;

    for (const v of this.state.vehiculosFiltrados()) {
      const reps = v.repuestos || [];
      if (reps.length > 0) vehiculosConRepuestos += 1;
      for (const r of reps) {
        total += 1;
        inversionUsd += Number(r.costoRepuestoUsd || 0);
        if (r.estado === 'SOLICITADO') solicitados += 1;
        else if (r.estado === 'OBSERVADO_NO_COMPATIBLE') observados += 1;
        else if (r.estado === 'RECIBIDO_OK') recibidosOk += 1;
        else if (r.estado === 'INSTALADO') instalados += 1;
      }
    }

    return {
      total,
      solicitados,
      observados,
      recibidosOk,
      instalados,
      inversionUsd: Math.round(inversionUsd * 100) / 100,
      vehiculosConRepuestos,
    };
  });

  vehiculosSinRepuestos = computed(() =>
    this.state
      .vehiculosFiltrados()
      .filter(
        (v) =>
          !(v.repuestos || []).length &&
          v.estado !== 'FINALIZADO' &&
          v.estado !== 'RETIRADO_SIN_REPARAR',
      ),
  );

  vehiculosFiltrados = computed(() => {
    const fVeh = this.state.focusedVehiculoId();
    const list = this.state.vehiculosFiltrados().filter((v) => this.repuestosVisiblesVehiculo(v).length > 0);
    if (!fVeh) return list;
    return [...list].sort((a, b) => (a.id === fVeh ? 0 : 1) - (b.id === fVeh ? 0 : 1));
  });

  totalRepuestosMostrados = computed(() => {
    let count = 0;
    for (const v of this.vehiculosFiltrados()) {
      count += this.repuestosVisiblesVehiculo(v).length;
    }
    return count;
  });

  repuestosVisiblesVehiculo(v: any): any[] {
    const reps = v.repuestos || [];
    if (reps.length === 0) return [];

    const filtro = this.filtroEstado();
    const q = this.busquedaTexto().trim().toLowerCase();
    const matchVehiculo = q
      ? `${v.marca} ${v.modelo} ${v.vinChasis} ${v.placaOLote} ${v.nombreCliente}`.toLowerCase().includes(q)
      : true;

    return reps.filter((r: any) => {
      if (filtro !== 'TODOS' && r.estado !== filtro) return false;
      if (!q || matchVehiculo) return true;
      const textoRep = `${r.nombreRepuesto} ${r.proveedorOrigen || ''} ${r.codigoSerie || ''} ${r.solicitadoPor || ''} ${r.observacion || ''}`.toLowerCase();
      return textoRep.includes(q);
    });
  }

  etiquetaEstado(estado: string): string {
    switch (estado) {
      case 'SOLICITADO':
        return 'SOLICITADO';
      case 'RECIBIDO_OK':
        return 'RECIBIDO OK';
      case 'OBSERVADO_NO_COMPATIBLE':
        return 'OBSERVADO / NO COMPATIBLE';
      case 'INSTALADO':
        return 'INSTALADO';
      default:
        return estado;
    }
  }

  contarEstadoVehiculo(v: any, estado: string): number {
    return (v.repuestos || []).filter((r: any) => r.estado === estado).length;
  }

  totalCostoVehiculo(v: any): number {
    return (v.repuestos || []).reduce((acc: number, r: any) => acc + Number(r.costoRepuestoUsd || 0), 0);
  }

  progresoInstalacionVehiculo(v: any): number {
    const total = (v.repuestos || []).length;
    if (!total) return 0;
    return Math.round((this.contarEstadoVehiculo(v, 'INSTALADO') / total) * 100);
  }

  limpiarFiltros() {
    this.filtroEstado.set('TODOS');
    this.busquedaTexto.set('');
    this.state.clearNotificationFocus();
  }

  toggleFormSolicitud() {
    this.mostrarFormSolicitud.set(!this.mostrarFormSolicitud());
    this.errorMsg.set('');
  }

  iniciarSolicitudPara(vehiculoId: string) {
    this.nuevo = {
      vehiculoId,
      nombreRepuesto: '',
      proveedorOrigen: '',
      costoRepuestoUsd: 0,
      observacion: '',
    };
    this.mostrarFormSolicitud.set(true);
    this.errorMsg.set('');
  }

  private ok(msg: string) {
    this.errorMsg.set('');
    this.feedbackMsg.set(msg);
  }

  private fail(msg: string) {
    this.feedbackMsg.set('');
    this.errorMsg.set(msg);
  }

  solicitar() {
    if (!this.nuevo.vehiculoId || this.nuevo.nombreRepuesto.trim().length < 2) {
      this.fail('Selecciona el vehículo e indica el nombre del repuesto solicitado.');
      return;
    }
    this.solicitando.set(true);
    this.state.solicitarRepuesto(
      {
        vehiculoId: this.nuevo.vehiculoId,
        nombreRepuesto: this.nuevo.nombreRepuesto.trim(),
        proveedorOrigen: this.nuevo.proveedorOrigen.trim() || undefined,
        costoRepuestoUsd: Number(this.nuevo.costoRepuestoUsd || 0),
        observacion: this.nuevo.observacion.trim() || undefined,
      },
      () => {
        this.solicitando.set(false);
        this.ok('Repuesto solicitado y notificado al tablero.');
        this.nuevo = {
          vehiculoId: this.nuevo.vehiculoId,
          nombreRepuesto: '',
          proveedorOrigen: '',
          costoRepuestoUsd: 0,
          observacion: '',
        };
        this.mostrarFormSolicitud.set(false);
      },
      (e) => {
        this.solicitando.set(false);
        this.fail(e);
      },
    );
  }

  abrirPanelRecepcion(v: any, r: any) {
    const actual = this.panel();
    if (actual?.id === r.id && actual?.modo === 'recepcion') {
      this.cerrarPanel();
      return;
    }
    this.revocarPreviewLocal();
    this.fotoComprimidaFile = null;
    this.rec = {
      resultado: 'RECIBIDO_OK',
      codigoSerie: r.codigoSerie || '',
      proveedorOrigen: r.proveedorOrigen || '',
      costoRepuestoUsd: Number(r.costoRepuestoUsd || 0),
      descripcionFoto:
        r.descripcionFotoRecepcion || `Recepción física de ${r.nombreRepuesto} (${v.placaOLote})`,
      observacion: '',
      previewLocalUrl: '',
      compresionInfo: '',
    };
    this.panel.set({ id: r.id, modo: 'recepcion', vehiculoId: v.id });
    this.errorMsg.set('');
  }

  abrirPanelEditar(v: any, r: any) {
    const actual = this.panel();
    if (actual?.id === r.id && actual?.modo === 'editar') {
      this.cerrarPanel();
      return;
    }
    this.revocarPreviewLocal();
    this.fotoComprimidaFile = null;
    this.editForm = {
      nombreRepuesto: r.nombreRepuesto || '',
      proveedorOrigen: r.proveedorOrigen || '',
      costoRepuestoUsd: Number(r.costoRepuestoUsd || 0),
      codigoSerie: r.codigoSerie || '',
      observacion: r.observacion || '',
      motivoEdicion: '',
    };
    this.panel.set({ id: r.id, modo: 'editar', vehiculoId: v.id });
    this.errorMsg.set('');
  }

  cerrarPanel() {
    this.revocarPreviewLocal();
    this.fotoComprimidaFile = null;
    this.panel.set(null);
  }

  private revocarPreviewLocal() {
    if (this.rec.previewLocalUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.rec.previewLocalUrl);
    }
    this.rec.previewLocalUrl = '';
  }

  async alSeleccionarFoto(ev: Event, input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;

    this.comprimiendoFoto.set(true);
    this.errorMsg.set('');
    try {
      const res = await comprimirImagenNavegadorWebp(file, 1400, 0.82);
      this.revocarPreviewLocal();
      this.fotoComprimidaFile = res.file;
      this.rec.previewLocalUrl = res.previewUrl || URL.createObjectURL(res.file);
      this.rec.compresionInfo = 'Fotografía lista para guardar';
      input.value = '';
    } catch (err: any) {
      this.fail(err?.message || 'No se pudo procesar o comprimir la imagen seleccionada.');
      input.value = '';
    } finally {
      this.comprimiendoFoto.set(false);
    }
  }

  limpiarFotoSeleccionada(input: HTMLInputElement) {
    this.revocarPreviewLocal();
    this.fotoComprimidaFile = null;
    this.rec.compresionInfo = '';
    input.value = '';
  }

  guardarRecepcion(v: any, r: any) {
    if (!this.fotoComprimidaFile) {
      this.fail('Debes adjuntar la fotografía obligatoria de recepción del repuesto.');
      return;
    }
    if (!this.rec.descripcionFoto.trim()) {
      this.fail('Indica una breve descripción de lo que muestra la fotografía.');
      return;
    }
    if (this.rec.resultado === 'RECIBIDO_OK' && !this.rec.codigoSerie.trim()) {
      this.fail('Ingresa el código de serie o lote OEM del repuesto compatible.');
      return;
    }
    if (this.rec.resultado === 'OBSERVADO_NO_COMPATIBLE' && this.rec.observacion.trim().length < 4) {
      this.fail('Cuando el repuesto es observado o no compatible, describe el motivo para alertar a Bolivia.');
      return;
    }

    this.procesando.set(true);
    this.state.subirEvidenciaConDetalle(
      this.fotoComprimidaFile,
      {
        moduloOrigen: 'REPUESTOS_CUENTAGOTAS',
        referenciaId: v.id,
        vehiculoReferencia: `${v.marca} ${v.modelo} (${v.vinChasis})`,
        tituloDetalle: `${r.nombreRepuesto} (${this.rec.resultado})`,
        descripcionBreve: this.rec.descripcionFoto.trim(),
        skipBootstrapReload: true,
      },
      (ev) => {
        this.state.registrarRecepcionRepuesto(
          r.id,
          {
            resultado: this.rec.resultado,
            codigoSerie: this.rec.codigoSerie.trim(),
            fotoUrl: ev.archivoWebpUrl,
            descripcionFoto: this.rec.descripcionFoto.trim(),
            costoRepuestoUsd: Number(this.rec.costoRepuestoUsd || 0),
            proveedorOrigen: this.rec.proveedorOrigen.trim() || undefined,
            observacion: this.rec.observacion.trim() || undefined,
          },
          () => {
            this.procesando.set(false);
            this.cerrarPanel();
            this.ok(
              this.rec.resultado === 'OBSERVADO_NO_COMPATIBLE'
                ? 'Repuesto observado con fotografía de respaldo y alerta enviada a Bolivia.'
                : 'Repuesto recibido OK con fotografía de respaldo y N° de serie registrado.',
            );
          },
          (e) => {
            this.procesando.set(false);
            this.fail(e);
          },
        );
      },
      (e) => {
        this.procesando.set(false);
        this.fail(e);
      },
    );
  }

  guardarEdicion(r: any) {
    if (this.editForm.nombreRepuesto.trim().length < 2) {
      this.fail('El nombre del repuesto no puede quedar vacío.');
      return;
    }
    if (this.editForm.motivoEdicion.trim().length < 4) {
      this.fail('Ingresa el motivo obligatorio de edición (mínimo 4 caracteres) para auditoría.');
      return;
    }

    this.guardandoEdicion.set(true);
    this.state.editarRepuesto(
      r.id,
      {
        nombreRepuesto: this.editForm.nombreRepuesto.trim(),
        proveedorOrigen: this.editForm.proveedorOrigen.trim() || undefined,
        costoRepuestoUsd: Number(this.editForm.costoRepuestoUsd || 0),
        codigoSerie: this.editForm.codigoSerie.trim() || undefined,
        observacion: this.editForm.observacion.trim() || undefined,
        motivoEdicion: this.editForm.motivoEdicion.trim(),
      },
      () => {
        this.guardandoEdicion.set(false);
        this.cerrarPanel();
        this.ok('Datos del repuesto actualizados y registrados en el historial.');
      },
      (e) => {
        this.guardandoEdicion.set(false);
        this.fail(e);
      },
    );
  }

  marcarInstalado(repuestoId: string) {
    this.instalandoId.set(repuestoId);
    this.state.marcarRepuestoInstalado(
      repuestoId,
      () => {
        this.instalandoId.set(null);
        this.ok('Repuesto marcado como instalado y auditado en el historial.');
      },
      (e) => {
        this.instalandoId.set(null);
        this.fail(e);
      },
    );
  }

  irAModulo(vehiculoId: string, modulo: 'cotizacion' | 'ordenes') {
    this.state.irAVehiculoEnModulo(vehiculoId, modulo);
  }

  abrirLightbox(url: string, titulo: string, descripcion: string) {
    this.lightbox.set({ url, titulo, descripcion });
  }
}
