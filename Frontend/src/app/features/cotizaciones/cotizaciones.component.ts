import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../core/services/app-state.service';
import { comprimirImagenNavegadorWebp } from '../../core/utils/webp-compressor';
import { AuditHistoryPanelComponent } from '../../shared/components/audit-history-panel/audit-history-panel.component';

type CategoriaCotizacion = 'CHAPERIA' | 'PINTURA' | 'MECANICA_INTERNA' | 'SERVICIO_TERCERO';
type GradoDanio = 'NO_APLICA' | 'LEVE' | 'FUERTE';
type FiltroEstadoCotizacion = 'TODAS' | 'AMARILLO' | 'PENDIENTE' | 'VERDE' | 'RECHAZADA';

interface BorradorItemCotizacion {
  categoria: CategoriaCotizacion;
  piezaZona: string;
  gradoDanio: GradoDanio;
  costoInternoOTerceroUsd: number;
  precioClienteUsd: number;
}

interface EditItemCotizacion {
  id: string;
  categoria: CategoriaCotizacion;
  piezaZona: string;
  gradoDanio: GradoDanio;
  costoInternoOTerceroUsd: number;
  precioCotizadoOriginalUsd: number;
  precioAcordadoClienteUsd: number;
}

interface LightboxPreview {
  url: string;
  titulo: string;
  descripcion: string;
}

@Component({
  selector: 'app-cotizaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, AuditHistoryPanelComponent],
  template: `
    <div class="space-y-6">
      <!-- ENCABEZADO DEL ÁREA -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div class="space-y-1 max-w-3xl">
          <div class="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
            <i class="ri-file-list-3-line text-sm"></i>
            <span>Presupuestos, Desarme y Aprobación Bilateral</span>
          </div>
          <h1 class="text-lg sm:text-xl font-bold text-white">
            Cotizaciones y Aprobación de Presupuestos
          </h1>
          <p class="text-xs text-slate-400">
            Desglose por pieza o trabajo. Las ediciones y adendas pasan a estado <strong class="text-amber-300">AMARILLO</strong> hasta confirmarse en <strong class="text-emerald-400">VERDE</strong>.
          </p>
        </div>

        <button
          type="button"
          (click)="errorMsg.set(''); mostrarConstructorNueva.set(true)"
          class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-blue-600/20 cursor-pointer shrink-0"
        >
          <i class="ri-file-add-line text-sm"></i>
          <span>Armar Nueva Cotización</span>
        </button>
      </div>

      <!-- KPIs INTERACTIVOS + FILTROS -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <button
          type="button"
          (click)="filtroEstado.set('TODAS')"
          [ngClass]="filtroEstado() === 'TODAS' ? 'border-blue-500 bg-blue-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
          class="p-3.5 rounded-xl border text-left transition cursor-pointer"
        >
          <div class="text-[11px] text-slate-400 font-semibold">Total Cotizaciones</div>
          <div class="text-xl font-black text-white mt-1 font-mono">{{ kpis().total }}</div>
        </button>

        <button
          type="button"
          (click)="filtroEstado.set('AMARILLO')"
          [ngClass]="filtroEstado() === 'AMARILLO' ? 'border-amber-400 bg-amber-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
          class="p-3.5 rounded-xl border text-left transition cursor-pointer"
        >
          <div class="text-[11px] text-amber-300 font-semibold flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>En Amarillo</span>
          </div>
          <div class="text-xl font-black text-amber-300 mt-1 font-mono">{{ kpis().amarillo }}</div>
        </button>

        <button
          type="button"
          (click)="filtroEstado.set('PENDIENTE')"
          [ngClass]="filtroEstado() === 'PENDIENTE' ? 'border-cyan-400 bg-cyan-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
          class="p-3.5 rounded-xl border text-left transition cursor-pointer"
        >
          <div class="text-[11px] text-cyan-300 font-semibold">Pendientes Rev.</div>
          <div class="text-xl font-black text-cyan-300 mt-1 font-mono">{{ kpis().pendiente }}</div>
        </button>

        <button
          type="button"
          (click)="filtroEstado.set('VERDE')"
          [ngClass]="filtroEstado() === 'VERDE' ? 'border-emerald-400 bg-emerald-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
          class="p-3.5 rounded-xl border text-left transition cursor-pointer"
        >
          <div class="text-[11px] text-emerald-300 font-semibold flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>En Verde (OT)</span>
          </div>
          <div class="text-xl font-black text-emerald-400 mt-1 font-mono">{{ kpis().verde }}</div>
        </button>

        <button
          type="button"
          (click)="filtroEstado.set('RECHAZADA')"
          [ngClass]="filtroEstado() === 'RECHAZADA' ? 'border-rose-400 bg-rose-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
          class="p-3.5 rounded-xl border text-left transition cursor-pointer"
        >
          <div class="text-[11px] text-rose-300 font-semibold">Rechazadas</div>
          <div class="text-xl font-black text-rose-300 mt-1 font-mono">{{ kpis().rechazada }}</div>
        </button>

        <div class="p-3.5 rounded-xl border border-slate-800 bg-slate-900/80 text-left">
          <div class="text-[11px] text-slate-400 font-semibold">Sin Cotizar Aún</div>
          <div class="text-xl font-black text-slate-100 mt-1 font-mono">{{ kpis().sinCotizar }}</div>
        </div>
      </div>

      <!-- BUSCADOR Y UNIDADES PENDIENTES DE COTIZACIÓN -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 text-xs">
        <div class="relative flex-1 max-w-md">
          <i class="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input
            type="text"
            [ngModel]="busquedaTexto()"
            (ngModelChange)="busquedaTexto.set($event)"
            placeholder="Buscar por marca, modelo, VIN, lote o cliente..."
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
          <span>Mostrando <strong class="text-white">{{ tarjetasCotizaciones().length }}</strong> cotización(es)</span>
          @if (filtroEstado() !== 'TODAS' || busquedaTexto().trim() || state.focusedVehiculoId() || state.focusedReferenciaId()) {
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

      @if (vehiculosSinCotizar().length > 0) {
        <div class="p-4 rounded-xl bg-blue-950/25 border border-blue-500/35 space-y-2.5 text-xs">
          <div class="font-bold text-blue-300 flex items-center gap-2">
            <i class="ri-car-washing-line text-base"></i>
            <span>Unidades recepcionadas listas para armar su cotización inicial ({{ vehiculosSinCotizar().length }})</span>
          </div>
          <div class="flex flex-wrap gap-2">
            @for (vPending of vehiculosSinCotizar(); track vPending.id) {
              <button
                type="button"
                (click)="iniciarCotizacionParaVehiculo(vPending.id)"
                class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-blue-600 border border-blue-500/40 text-slate-100 font-semibold flex items-center gap-2 transition cursor-pointer"
              >
                <i class="ri-add-circle-line text-blue-400"></i>
                <span>{{ vPending.marca }} {{ vPending.modelo }} ({{ vPending.placaOLote }})</span>
                <span class="text-[10px] font-mono text-slate-400">{{ vPending.estado }}</span>
              </button>
            }
          </div>
        </div>
      }

      <!-- ALERTAS DE RETROALIMENTACIÓN -->
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

      <!-- ====================================================================
           MODAL 1: CONSTRUCTOR DE NUEVA COTIZACIÓN POR PIEZAS
           ==================================================================== -->
      @if (mostrarConstructorNueva()) {
        <div
          (click)="mostrarConstructorNueva.set(false)"
          class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            (click)="$event.stopPropagation()"
            class="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-xs shadow-2xl"
          >
            <div class="px-5 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h2 class="font-bold text-sm text-white flex items-center gap-2">
                  <i class="ri-calculator-line text-blue-400 text-base"></i>
                  <span>Armado de Cotización por Vehículo</span>
                </h2>
                <span class="text-[11px] text-slate-400">
                  Responsable: <strong class="text-slate-200">{{ state.currentUser()?.nombreCompleto }}</strong>
                </span>
              </div>
              <button
                type="button"
                (click)="mostrarConstructorNueva.set(false)"
                class="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <i class="ri-close-line text-lg"></i>
              </button>
            </div>

            <div class="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Seleccionar Vehículo del Taller *</label>
              <select
                [(ngModel)]="vehiculoSeleccionadoId"
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Selecciona una unidad del taller --</option>
                @for (v of state.vehiculos(); track v.id) {
                  <option [value]="v.id">
                    {{ (v.cotizaciones?.length || 0) === 0 ? '[SIN COTIZAR] ' : '[YA TIENE v' + v.cotizaciones.length + '] ' }}{{ v.marca }} {{ v.modelo }} ({{ v.anio }}) — {{ v.placaOLote }} • {{ v.nombreCliente }}
                  </option>
                }
              </select>
              @if (vehiculoSeleccionadoResumen(); as vs) {
                <div class="mt-2 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 flex flex-wrap gap-3">
                  <span>VIN: <strong class="font-mono text-white">{{ vs.vinChasis }}</strong></span>
                  <span>Cola: <strong class="text-cyan-300">{{ vs.prioridadCola }}</strong></span>
                  <span>Estado: <strong class="text-amber-300">{{ vs.estado }}</strong></span>
                  @if (vs.checkIn?.airbagsReventados) {
                    <span class="text-rose-400 font-semibold">• Airbags detonados en Check-In</span>
                  }
                </div>
              }
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">Observación Inicial del Presupuesto *</label>
              <input
                type="text"
                [(ngModel)]="observacionInicial"
                placeholder="Ej: Presupuesto inicial previo a desarme profundo"
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
              />
              <div class="mt-2 flex flex-wrap items-center gap-1.5">
                <span class="text-[11px] text-slate-400">Plantillas rápidas:</span>
                <button
                  type="button"
                  (click)="aplicarPlantillaRapida('FRONTAL')"
                  class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] cursor-pointer"
                >
                  + Frontal + Pintura
                </button>
                <button
                  type="button"
                  (click)="aplicarPlantillaRapida('LATERAL_LEVE')"
                  class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] cursor-pointer"
                >
                  + Lateral Leve
                </button>
                <button
                  type="button"
                  (click)="aplicarPlantillaRapida('TERCERO_SRS')"
                  class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] cursor-pointer"
                >
                  + Airbag / Tercero
                </button>
              </div>
            </div>
          </div>

          <!-- Agregar Ítem a la Cotización -->
          <div class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div class="font-bold text-slate-200 flex items-center gap-2">
              <i class="ri-list-settings-line text-blue-400"></i>
              <span>Agregar Pieza / Trabajo a la Cotización</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div>
                <label class="block text-slate-400 mb-1">Categoría *</label>
                <select
                  [(ngModel)]="nuevoItemCategoria"
                  (ngModelChange)="onCategoriaChange($event)"
                  class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                >
                  <option value="CHAPERIA">1. Chapería (Leve o Fuerte)</option>
                  <option value="PINTURA">2. Pintura Estándar</option>
                  <option value="MECANICA_INTERNA">3. Mecánica Ligera (Planta)</option>
                  <option value="SERVICIO_TERCERO">4. Servicio Tercero Externo</option>
                </select>
              </div>

              <div>
                <label class="block text-slate-400 mb-1">Pieza / Zona / Servicio *</label>
                <input
                  type="text"
                  [(ngModel)]="nuevoItemPieza"
                  list="catalogo-piezas"
                  placeholder="Ej: Capó Delantero, Puerta Der..."
                  class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                />
                <datalist id="catalogo-piezas">
                  <option value="Capó Delantero"></option>
                  <option value="Guardafango Delantero Derecho"></option>
                  <option value="Guardafango Delantero Izquierdo"></option>
                  <option value="Puerta Delantera Derecha"></option>
                  <option value="Puerta Trasera Derecha"></option>
                  <option value="Parachoques Delantero y Soporte"></option>
                  <option value="Pintura Bicapa Frente y Lateral"></option>
                  <option value="Plastificado de Volante y Reparación Airbags"></option>
                  <option value="Cambio de Amortiguador y Rótula"></option>
                </datalist>
              </div>

              <div>
                <label class="block text-slate-400 mb-1">Grado Daño (Solo Chapería)</label>
                @if (nuevoItemCategoria === 'CHAPERIA') {
                  <select
                    [(ngModel)]="nuevoItemGrado"
                    class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-blue-500/50 text-white font-semibold"
                  >
                    <option value="LEVE">LEVE (Abolladura menor)</option>
                    <option value="FUERTE">FUERTE (Impacto estructural)</option>
                  </select>
                } @else {
                  <input
                    type="text"
                    value="NO_APLICA (Estándar)"
                    disabled
                    class="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-500"
                  />
                }
              </div>

              <div>
                <label class="block text-slate-400 mb-1">Costo Contratista/Tercero (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  [(ngModel)]="nuevoItemCostoUsd"
                  class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-amber-400 font-mono"
                />
              </div>

              <div>
                <label class="block text-slate-400 mb-1">Precio Cliente (USD)</label>
                <div class="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    [(ngModel)]="nuevoItemPrecioUsd"
                    class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 font-mono font-bold"
                  />
                  <button
                    type="button"
                    (click)="agregarItemAlBorrador()"
                    class="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shrink-0 cursor-pointer"
                    title="Agregar pieza al borrador"
                  >
                    <i class="ri-add-line"></i>
                  </button>
                </div>
              </div>
            </div>

            <!-- Tabla de Ítems en el Borrador -->
            @if (itemsBorrador().length > 0) {
              <div class="overflow-x-auto pt-3">
                <table class="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr class="border-b border-slate-800 text-slate-400">
                      <th class="py-2">Categoría</th>
                      <th class="py-2">Pieza / Trabajo</th>
                      <th class="py-2">Grado Chapería</th>
                      <th class="py-2">Costo Taller/Tercero</th>
                      <th class="py-2">Precio Cliente</th>
                      <th class="py-2 text-right">Quitar</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800">
                    @for (it of itemsBorrador(); track $index) {
                      <tr>
                        <td class="py-2 font-semibold text-white">{{ it.categoria }}</td>
                        <td class="py-2 text-slate-300">{{ it.piezaZona }}</td>
                        <td class="py-2">
                          <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[11px]">
                            {{ it.gradoDanio }}
                          </span>
                        </td>
                        <td class="py-2 font-mono text-amber-400">{{ state.formatMoney(it.costoInternoOTerceroUsd) }}</td>
                        <td class="py-2 font-mono font-bold text-emerald-400">{{ state.formatMoney(it.precioClienteUsd) }}</td>
                        <td class="py-2 text-right">
                          <button
                            type="button"
                            (click)="quitarItemBorrador($index)"
                            class="text-rose-400 hover:text-rose-300 cursor-pointer"
                            title="Quitar ítem"
                          >
                            <i class="ri-delete-bin-line"></i>
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <div class="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800 text-slate-400">
                <span>Costo Interno/Terceros: <strong class="text-amber-400 font-mono">{{ state.formatMoney(totalCostoBorrador()) }}</strong></span>
                <span>• Total Cotizado Cliente: <strong class="text-emerald-400 font-mono text-sm">{{ state.formatMoney(totalPrecioBorrador()) }}</strong></span>
                <span>• Margen Bruto Est.: <strong class="text-cyan-300 font-mono">{{ state.formatMoney(totalPrecioBorrador() - totalCostoBorrador()) }}</strong></span>
              </div>
            } @else {
              <div class="p-4 rounded-lg border border-dashed border-slate-800 text-center text-slate-400">
                Agrega al menos una pieza/trabajo o utiliza una plantilla rápida para armar el presupuesto.
              </div>
            }
          </div>

          @if (errorMsg()) {
            <div class="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 flex items-center gap-2">
              <i class="ri-error-warning-line text-rose-400 text-base shrink-0"></i>
              <span>{{ errorMsg() }}</span>
            </div>
          }
        </div>

        <div class="px-5 py-3.5 border-t border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            (click)="mostrarConstructorNueva.set(false)"
            class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            [disabled]="guardandoCotizacion() || itemsBorrador().length === 0"
            (click)="guardarNuevaCotizacion()"
            class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold flex items-center gap-2 cursor-pointer"
          >
            <i [class]="guardandoCotizacion() ? 'ri-loader-4-line animate-spin' : 'ri-save-3-line'"></i>
            <span>{{ guardandoCotizacion() ? 'Guardando...' : 'Guardar Cotización' }}</span>
          </button>
        </div>
      </div>
    </div>
  }

      <!-- ====================================================================
           2. LISTADO DE COTIZACIONES CON EDICIÓN INMUTABLE Y PASO AMARILLO -> VERDE
           ==================================================================== -->
      <div class="space-y-5">
        @for (card of tarjetasCotizaciones(); track card.cot.id) {
          <div
            [attr.data-focus-vehiculo]="card.vehiculo.id"
            [attr.data-focus-ref]="card.cot.id"
            [ngClass]="
              state.focusedVehiculoId() === card.vehiculo.id || state.focusedReferenciaId() === card.cot.id
                ? 'ring-2 ring-cyan-400 border-cyan-500/70'
                : card.cot.estadoAprobacion === 'AMARILLO_EDITADA_POR_BOLIVIA'
                  ? 'border-amber-500/40'
                  : 'border-slate-800'
            "
            class="bg-slate-900 border rounded-2xl p-5 space-y-4 transition shadow-lg"
          >
            <!-- Cabecera de la Cotización -->
            <div class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div class="space-y-1.5">
                <div class="flex flex-wrap items-center gap-2.5">
                  <h3 class="font-bold text-base text-white">
                    Cotización v{{ card.cot.version }} — {{ card.vehiculo.marca }} {{ card.vehiculo.modelo }} ({{ card.vehiculo.anio }})
                  </h3>
                  <span class="font-mono text-xs px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                    {{ card.vehiculo.placaOLote }} • VIN: {{ card.vehiculo.vinChasis }}
                  </span>

                  <!-- Semáforo de Estado -->
                  @if (card.cot.estadoAprobacion === 'VERDE_ACEPTADA_POR_CHILE') {
                    <span class="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                      <i class="ri-checkbox-circle-fill text-emerald-400"></i>
                      <span>VERDE: ACEPTADA (EN TALLER / OT)</span>
                    </span>
                  } @else if (card.cot.estadoAprobacion === 'AMARILLO_EDITADA_POR_BOLIVIA') {
                    <span class="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                      <i class="ri-alert-fill text-amber-400"></i>
                      <span>AMARILLO: CAMBIOS REALIZADOS (POR CONFIRMAR)</span>
                    </span>
                  } @else if (card.cot.estadoAprobacion === 'RECHAZADA_CLIENTE') {
                    <span class="px-3 py-1 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5">
                      <i class="ri-close-circle-fill text-rose-400"></i>
                      <span>RECHAZADA POR CLIENTE</span>
                    </span>
                  } @else {
                    <span class="px-3 py-1 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1.5">
                      <i class="ri-time-line text-blue-400"></i>
                      <span>PENDIENTE DE REVISIÓN</span>
                    </span>
                  }
                </div>

                <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pt-1">
                  <span class="text-slate-400">
                    Original:
                    <strong class="text-slate-200 font-mono">{{ state.formatMoney(card.cot.montoOriginalUsd) }}</strong>
                  </span>
                  <span class="text-slate-400">
                    Acordado Actual:
                    <strong class="text-emerald-400 font-mono text-sm">{{ state.formatMoney(card.cot.montoAcordadoUsd) }}</strong>
                    @if (card.deltaOriginal !== 0) {
                      <span
                        [ngClass]="card.deltaOriginal > 0 ? 'text-amber-300' : 'text-cyan-300'"
                        class="ml-1 text-[11px] font-mono font-semibold"
                      >
                        ({{ card.deltaOriginal > 0 ? '+' : '' }}{{ state.formatMoney(card.deltaOriginal) }})
                      </span>
                    }
                  </span>
                  <span class="text-slate-400">
                    Costos Mano Obra/Terc.:
                    <strong class="text-amber-400 font-mono">{{ state.formatMoney(card.costosTotales) }}</strong>
                  </span>
                  <span class="text-slate-400">
                    Margen Bruto Est.:
                    <strong
                      [ngClass]="card.margenBruto >= 0 ? 'text-cyan-300' : 'text-rose-400'"
                      class="font-mono"
                    >
                      {{ state.formatMoney(card.margenBruto) }}
                    </strong>
                  </span>
                  <span class="text-slate-400">
                    Cola: <strong class="text-white">{{ card.vehiculo.prioridadCola }}</strong>
                  </span>
                  @if (card.cot.creadoEn) {
                    <span class="text-slate-400">
                      Emitida: <strong class="text-slate-300 font-mono">{{ state.formatFechaHora(card.cot.creadoEn) }}</strong>
                    </span>
                  }
                  @if (card.cot.fechaAceptacionChile) {
                    <span class="text-slate-400">
                      Aprobada Verde: <strong class="text-emerald-300 font-mono">{{ state.formatFechaHora(card.cot.fechaAceptacionChile) }}</strong>
                    </span>
                  }
                </div>
              </div>

              <!-- Botonera de Acciones del Flujo Amarillo -> Verde -->
              <div class="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  (click)="irARecepcion(card.vehiculo.id)"
                  class="px-2.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold flex items-center gap-1 cursor-pointer"
                  title="Ver Check-In de ingreso"
                >
                  <i class="ri-car-line"></i>
                  <span>Check-In</span>
                </button>

                <button
                  type="button"
                  (click)="abrirEditorCotizacion(card.cot, card.vehiculo)"
                  class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-amber-300 font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <i class="ri-edit-2-line"></i>
                  <span>Editar Precios (Amarillo)</span>
                </button>

                @if (card.cot.estadoAprobacion !== 'RECHAZADA_CLIENTE') {
                  <button
                    type="button"
                    (click)="abrirAdenda(card.cot.id)"
                    class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-blue-500/40 text-blue-300 font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <i class="ri-tools-line"></i>
                    <span>+ Adenda Desarme</span>
                  </button>

                  <button
                    type="button"
                    (click)="abrirRechazo(card.cot.id)"
                    class="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-500/50 text-rose-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <i class="ri-close-circle-line"></i>
                    <span>Rechazar</span>
                  </button>
                }

                @if (card.cot.estadoAprobacion === 'AMARILLO_EDITADA_POR_BOLIVIA' || card.cot.estadoAprobacion === 'PENDIENTE_REVISION_BOLIVIA') {
                  <button
                    type="button"
                    [disabled]="aceptandoId() === card.cot.id"
                    (click)="aceptarPasoAVerde(card.cot)"
                    class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer"
                  >
                    <i [class]="aceptandoId() === card.cot.id ? 'ri-loader-4-line animate-spin' : 'ri-check-double-line text-sm'"></i>
                    <span>{{ aceptandoId() === card.cot.id ? 'Aprobando...' : 'Aceptar Cambios (Pasar a Verde)' }}</span>
                  </button>
                }

                @if (card.cot.estadoAprobacion === 'VERDE_ACEPTADA_POR_CHILE') {
                  <button
                    type="button"
                    (click)="irAOrdenesTrabajo(card.vehiculo.id)"
                    class="px-3.5 py-2 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Ver en OT</span>
                    <i class="ri-arrow-right-line"></i>
                  </button>
                }
              </div>
            </div>

            <!-- PANEL DESPLEGABLE 1: EDICIÓN POR ÍTEM Y TOTAL CON HISTORIAL INMUTABLE (PASO A AMARILLO) -->
            @if (cotizacionActivaEdicionId() === card.cot.id) {
              <div class="p-4 rounded-xl bg-slate-950 border-2 border-amber-500/50 space-y-4 text-xs">
                <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div class="font-bold text-amber-300 flex items-center gap-2">
                    <i class="ri-shield-keyhole-line text-base"></i>
                    <span>Edición Auditada por Pieza y Total (Original {{ state.formatMoney(card.cot.montoOriginalUsd) }} permanece intacto)</span>
                  </div>
                  <button type="button" (click)="cotizacionActivaEdicionId.set(null)" class="text-slate-400 hover:text-white cursor-pointer">
                    <i class="ri-close-line"></i>
                  </button>
                </div>

                @if (editItems().length > 0) {
                  <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr class="border-b border-slate-800 text-slate-400">
                          <th class="py-2 pr-2">Pieza / Trabajo</th>
                          <th class="py-2 pr-2">Grado Chapería</th>
                          <th class="py-2 pr-2">Costo Taller/Tercero (USD)</th>
                          <th class="py-2">Precio Acordado Cliente (USD)</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-800">
                        @for (ei of editItems(); track ei.id) {
                          <tr>
                            <td class="py-2 pr-2">
                              <input
                                type="text"
                                [(ngModel)]="ei.piezaZona"
                                class="w-full min-w-[180px] px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white"
                              />
                            </td>
                            <td class="py-2 pr-2">
                              @if (ei.categoria === 'CHAPERIA') {
                                <select
                                  [(ngModel)]="ei.gradoDanio"
                                  class="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white"
                                >
                                  <option value="LEVE">LEVE</option>
                                  <option value="FUERTE">FUERTE</option>
                                </select>
                              } @else {
                                <span class="text-slate-500 font-mono">NO_APLICA</span>
                              }
                            </td>
                            <td class="py-2 pr-2">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                [(ngModel)]="ei.costoInternoOTerceroUsd"
                                class="w-28 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-400 font-mono"
                              />
                            </td>
                            <td class="py-2">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                [(ngModel)]="ei.precioAcordadoClienteUsd"
                                (ngModelChange)="recalcularTotalEdicion()"
                                class="w-32 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-emerald-500/40 text-emerald-400 font-mono font-bold"
                              />
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }

                <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label class="block text-slate-300 font-semibold mb-1">Total Acordado (USD) *</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      [(ngModel)]="edicionMontoAcordadoUsd"
                      class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-emerald-400 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label class="block text-slate-300 font-semibold mb-1">Prioridad de Cola</label>
                    <select
                      [(ngModel)]="edicionPrioridadCola"
                      class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                    >
                      <option value="ALTA_15_DIAS">ALTA_15_DIAS (Urgente)</option>
                      <option value="COLA_30_DIAS">COLA_30_DIAS (Rebaja / Espera)</option>
                    </select>
                  </div>

                  <div class="sm:col-span-2">
                    <label class="block text-slate-300 font-semibold mb-1">
                      Motivo Obligatorio de la Edición (Mín. 4 caracteres) *
                    </label>
                    <input
                      type="text"
                      [(ngModel)]="edicionMotivo"
                      placeholder="Ej: Descuento acordado con cliente; unidad pasa a cola de 30 días"
                      class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div class="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    (click)="cotizacionActivaEdicionId.set(null)"
                    class="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    [disabled]="guardandoEdicion()"
                    (click)="confirmarEdicionAmarillo(card.cot)"
                    class="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <i [class]="guardandoEdicion() ? 'ri-loader-4-line animate-spin' : 'ri-lock-line'"></i>
                    <span>{{ guardandoEdicion() ? 'Guardando...' : 'Guardar Edición y Poner en Amarillo' }}</span>
                  </button>
                </div>
              </div>
            }

            <!-- PANEL DESPLEGABLE 2: ADENDA POR DESARME (1ER, 2DO O 3ER DESARME CON FOTO .WEBP) -->
            @if (cotizacionActivaAdendaId() === card.cot.id) {
              <div class="p-4 rounded-xl bg-slate-950 border border-blue-500/50 space-y-4 text-xs">
                <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div class="font-bold text-blue-300 flex items-center gap-2">
                    <i class="ri-add-box-line text-base"></i>
                    <span>Agregar Pieza / Daño Oculto Detectado en Desarme</span>
                  </div>
                  <button type="button" (click)="cotizacionActivaAdendaId.set(null)" class="text-slate-400 hover:text-white cursor-pointer">
                    <i class="ri-close-line"></i>
                  </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div>
                    <label class="block text-slate-400 mb-1">Categoría *</label>
                    <select
                      [(ngModel)]="adendaCategoria"
                      (ngModelChange)="onAdendaCategoriaChange($event)"
                      class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                    >
                      <option value="CHAPERIA">CHAPERIA</option>
                      <option value="PINTURA">PINTURA</option>
                      <option value="MECANICA_INTERNA">MECANICA_INTERNA</option>
                      <option value="SERVICIO_TERCERO">SERVICIO_TERCERO</option>
                    </select>
                  </div>

                  <div class="lg:col-span-2">
                    <label class="block text-slate-400 mb-1">Pieza o Daño Oculto *</label>
                    <input
                      type="text"
                      [(ngModel)]="adendaPieza"
                      placeholder="Ej: Soporte interior de radiador e intercooler desplazado"
                      class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                    />
                  </div>

                  <div>
                    <label class="block text-slate-400 mb-1">Grado Daño</label>
                    @if (adendaCategoria === 'CHAPERIA') {
                      <select
                        [(ngModel)]="adendaGrado"
                        class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-blue-500/40 text-white font-semibold"
                      >
                        <option value="LEVE">LEVE</option>
                        <option value="FUERTE">FUERTE</option>
                      </select>
                    } @else {
                      <input
                        type="text"
                        value="NO_APLICA"
                        disabled
                        class="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-500"
                      />
                    }
                  </div>

                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="block text-slate-400 mb-1">Costo (USD)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        [(ngModel)]="adendaCostoUsd"
                        class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-amber-400 font-mono"
                      />
                    </div>
                    <div>
                      <label class="block text-slate-400 mb-1">Precio Cli. *</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        [(ngModel)]="adendaPrecioUsd"
                        class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label class="block text-slate-400 mb-1">Motivo y Descripción del Hallazgo en Desarme *</label>
                    <input
                      type="text"
                      [(ngModel)]="adendaMotivo"
                      placeholder="Ej: Al desmontar parachoques se evidenció fisura oculta..."
                      class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                    />
                  </div>

                  <div>
                    <label class="block text-slate-400 mb-1">Adjuntar Fotografía del Hallazgo</label>
                    <input
                      type="file"
                      accept="image/*"
                      [disabled]="subiendoFotoAdenda()"
                      (change)="subirFotoAdendaDesarme($event, card.vehiculo, card.cot)"
                      class="block w-full text-[11px] text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                    />
                  </div>
                </div>

                @if (adendaFotoWebpUrl) {
                  <div class="p-2.5 rounded-xl bg-slate-900 border border-blue-500/40 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                      <img
                        [src]="state.resolveMediaUrl(adendaFotoWebpUrl)"
                        alt="Vista previa adenda"
                        (click)="abrirLightbox(state.resolveMediaUrl(adendaFotoWebpUrl), adendaPieza || 'Evidencia de desarme', adendaMotivo || 'Foto lista para anexar')"
                        class="w-14 h-11 rounded-lg object-cover border border-slate-700 cursor-pointer shrink-0"
                      />
                      <div class="min-w-0">
                        <div class="font-semibold text-white truncate">Evidencia lista para anexar</div>
                        <div class="text-[11px] text-emerald-400">Fotografía lista para anexar al expediente</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      (click)="quitarFotoAdenda()"
                      class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-300 text-[11px] font-semibold cursor-pointer shrink-0"
                    >
                      Quitar foto
                    </button>
                  </div>
                }

                <div class="flex justify-end gap-2">
                  <button
                    type="button"
                    (click)="cotizacionActivaAdendaId.set(null)"
                    class="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    [disabled]="guardandoAdenda() || subiendoFotoAdenda()"
                    (click)="guardarAdendaDesarme(card.cot)"
                    class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <i [class]="guardandoAdenda() ? 'ri-loader-4-line animate-spin' : 'ri-save-line'"></i>
                    <span>{{ guardandoAdenda() ? 'Registrando Adenda...' : 'Registrar Adenda en Cotización e Historial' }}</span>
                  </button>
                </div>
              </div>
            }

            <!-- PANEL DESPLEGABLE 3: RECHAZAR COTIZACIÓN / RETIRO SIN REPARAR -->
            @if (cotizacionActivaRechazoId() === card.cot.id) {
              <div class="p-4 rounded-xl bg-rose-950/25 border border-rose-500/50 space-y-3 text-xs">
                <div class="flex items-center justify-between border-b border-rose-500/30 pb-2">
                  <div class="font-bold text-rose-300 flex items-center gap-2">
                    <i class="ri-error-warning-line text-base"></i>
                    <span>Registrar Rechazo de Cotización (Quedará sellado en Auditoría)</span>
                  </div>
                  <button type="button" (click)="cotizacionActivaRechazoId.set(null)" class="text-slate-400 hover:text-white cursor-pointer">
                    <i class="ri-close-line"></i>
                  </button>
                </div>

                <div>
                  <label class="block text-slate-300 font-semibold mb-1">Motivo del rechazo del presupuesto *</label>
                  <input
                    type="text"
                    [(ngModel)]="rechazoMotivo"
                    placeholder="Ej: Cliente no acepta monto ni espera en cola de 30 días y retira unidad"
                    class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-rose-500/40 text-white"
                  />
                </div>

                <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <label class="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input type="checkbox" [(ngModel)]="rechazoRetirarVehiculo" class="w-4 h-4 accent-rose-500" />
                    <span>Marcar vehículo como <strong class="text-rose-300">RETIRADO_SIN_REPARAR</strong></span>
                  </label>

                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      (click)="cotizacionActivaRechazoId.set(null)"
                      class="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      [disabled]="guardandoRechazo()"
                      (click)="confirmarRechazoCotizacion(card.cot)"
                      class="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <i [class]="guardandoRechazo() ? 'ri-loader-4-line animate-spin' : 'ri-close-circle-line'"></i>
                      <span>{{ guardandoRechazo() ? 'Guardando...' : 'Confirmar Rechazo' }}</span>
                    </button>
                  </div>
                </div>
              </div>
            }

            <!-- TABLA DE ÍTEMS DE LA COTIZACIÓN -->
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="border-b border-slate-800 text-slate-400">
                    <th class="py-2 pr-3">Categoría</th>
                    <th class="py-2 pr-3">Pieza / Zona / Trabajo</th>
                    <th class="py-2 pr-3">Grado Chapería</th>
                    <th class="py-2 pr-3">Costo Taller / Terc.</th>
                    <th class="py-2 pr-3">Original</th>
                    <th class="py-2 text-right">Precio Acordado</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
                  @for (it of card.cot.items || []; track it.id) {
                    <tr>
                      <td class="py-2.5 pr-3 font-semibold text-white whitespace-nowrap">{{ it.categoria }}</td>
                      <td class="py-2.5 pr-3 text-slate-300">
                        <div class="flex flex-wrap items-center gap-2">
                          <span>{{ it.piezaZona }}</span>
                          @if (it.fotoDesarmeAdendaWebp || it.descripcionFotoAdenda) {
                            <span class="px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/35 text-[10px] font-bold text-blue-300">
                              Adenda Desarme
                            </span>
                          }
                        </div>
                        @if (it.fotoDesarmeAdendaWebp || it.descripcionFotoAdenda) {
                          <div class="mt-1.5 flex items-center gap-2">
                            @if (it.fotoDesarmeAdendaWebp) {
                              <button
                                type="button"
                                (click)="abrirLightbox(state.resolveMediaUrl(it.fotoDesarmeAdendaWebp), it.piezaZona, it.descripcionFotoAdenda || 'Evidencia fotográfica de desarme en taller')"
                                class="inline-flex items-center gap-2 p-1 pr-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 transition cursor-pointer group text-left"
                              >
                                <img
                                  [src]="state.resolveMediaUrl(it.fotoDesarmeAdendaWebp)"
                                  alt="Evidencia desarme"
                                  class="w-10 h-8 rounded object-cover border border-slate-700 shrink-0"
                                />
                                <span class="text-[11px] text-blue-400 group-hover:underline font-medium">
                                  {{ it.descripcionFotoAdenda || 'Ver fotografía del desarme' }}
                                </span>
                              </button>
                            } @else if (it.descripcionFotoAdenda) {
                              <div class="text-[11px] text-blue-400">
                                Hallazgo desarme: {{ it.descripcionFotoAdenda }}
                              </div>
                            }
                          </div>
                        }
                      </td>
                      <td class="py-2.5 pr-3">
                        <span
                          [ngClass]="
                            it.gradoDanio === 'FUERTE'
                              ? 'bg-rose-500/20 text-rose-300 font-semibold'
                              : it.gradoDanio === 'LEVE'
                                ? 'bg-blue-500/20 text-blue-300 font-semibold'
                                : 'bg-slate-800 text-slate-400'
                          "
                          class="px-2 py-0.5 rounded text-[11px]"
                        >
                          {{ it.gradoDanio }}
                        </span>
                      </td>
                      <td class="py-2.5 pr-3 font-mono text-amber-400 whitespace-nowrap">
                        {{ state.formatMoney(it.costoInternoOTerceroUsd) }}
                      </td>
                      <td class="py-2.5 pr-3 font-mono text-slate-400 whitespace-nowrap">
                        {{ state.formatMoney(it.precioCotizadoOriginalUsd) }}
                      </td>
                      <td class="py-2.5 font-mono font-bold text-emerald-400 text-right whitespace-nowrap">
                        {{ state.formatMoney(it.precioAcordadoClienteUsd) }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Pie de Auditoría de la Cotización -->
            <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <div>
                Elaboró en Chile: <strong class="text-slate-200">{{ card.cot.creadoPorChile }}</strong> •
                Última modificación / firma: <strong class="text-slate-200">{{ card.cot.autorizadoEdicionBolivia || 'Sin ediciones previas' }}</strong>
              </div>
              <div>
                Detalle de acuerdo: <strong class="text-slate-300">"{{ card.cot.motivoEdicionAcuerdo || 'Cotización inicial' }}"</strong>
              </div>
            </div>
          </div>
        } @empty {
          <div class="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2 text-xs text-slate-400">
            <i class="ri-file-search-line text-3xl text-slate-600"></i>
            <p class="text-sm font-bold text-slate-200">No hay cotizaciones en este filtro</p>
            <p>Ajusta los filtros o arma una nueva cotización desde la barra superior.</p>
          </div>
        }
      </div>

      <!-- ====================================================================
           3. HISTORIAL INMUTABLE DE EDICIONES (PREFILTRADO A COTIZACION)
           ==================================================================== -->
      <app-audit-history-panel defaultModulo="COTIZACION"></app-audit-history-panel>

      <!-- LIGHTBOX PARA FOTOS DE DESARME .WEBP -->
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
export class CotizacionesComponent {
  state = inject(AppStateService);

  mostrarConstructorNueva = signal<boolean>(false);
  filtroEstado = signal<FiltroEstadoCotizacion>('TODAS');
  busquedaTexto = signal<string>('');

  feedbackMsg = signal<string>('');
  errorMsg = signal<string>('');
  lightbox = signal<LightboxPreview | null>(null);

  guardandoCotizacion = signal<boolean>(false);
  guardandoEdicion = signal<boolean>(false);
  guardandoAdenda = signal<boolean>(false);
  subiendoFotoAdenda = signal<boolean>(false);
  guardandoRechazo = signal<boolean>(false);
  aceptandoId = signal<string | null>(null);

  // Estado del Constructor de Nueva Cotización
  vehiculoSeleccionadoId = '';
  observacionInicial = 'Cotización inicial elaborada en taller previa verificación de recepción';
  nuevoItemCategoria: CategoriaCotizacion = 'CHAPERIA';
  nuevoItemPieza = '';
  nuevoItemGrado: GradoDanio = 'FUERTE';
  nuevoItemCostoUsd = 100;
  nuevoItemPrecioUsd = 280;
  itemsBorrador = signal<BorradorItemCotizacion[]>([]);

  // Estado de Edición en Amarillo (Ítems + Global)
  cotizacionActivaEdicionId = signal<string | null>(null);
  editItems = signal<EditItemCotizacion[]>([]);
  edicionMontoAcordadoUsd = 0;
  edicionPrioridadCola: 'ALTA_15_DIAS' | 'COLA_30_DIAS' = 'ALTA_15_DIAS';
  edicionMotivo = '';

  // Estado de Adenda por Desarme
  cotizacionActivaAdendaId = signal<string | null>(null);
  adendaCategoria: CategoriaCotizacion = 'CHAPERIA';
  adendaPieza = '';
  adendaGrado: GradoDanio = 'FUERTE';
  adendaCostoUsd = 80;
  adendaPrecioUsd = 220;
  adendaMotivo = '';
  adendaFotoWebpUrl = '';
  adendaFotoPesoKb = 0;

  // Estado de Rechazo / Retiro
  cotizacionActivaRechazoId = signal<string | null>(null);
  rechazoMotivo = '';
  rechazoRetirarVehiculo = false;

  constructor() {
    effect(() => {
      const fVehiculo = this.state.focusedVehiculoId();
      const fRef = this.state.focusedReferenciaId();
      const lista = this.state.vehiculos();
      if (!fVehiculo && !fRef) return;

      this.filtroEstado.set('TODAS');
      this.busquedaTexto.set('');

      if (fVehiculo) {
        const encontrado = lista.find((v) => v.id === fVehiculo);
        if (encontrado && !(encontrado.cotizaciones?.length)) {
          this.vehiculoSeleccionadoId = encontrado.id;
          this.mostrarConstructorNueva.set(true);
        } else {
          this.mostrarConstructorNueva.set(false);
        }
      } else {
        this.mostrarConstructorNueva.set(false);
      }
    });
  }

  vehiculosSinCotizar = computed(() =>
    this.state
      .vehiculosFiltrados()
      .filter((v) => !(v.cotizaciones?.length) && v.estado !== 'RETIRADO_SIN_REPARAR'),
  );

  vehiculoSeleccionadoResumen() {
    if (!this.vehiculoSeleccionadoId) return null;
    return this.state.vehiculos().find((v) => v.id === this.vehiculoSeleccionadoId) || null;
  }

  kpis = computed(() => {
    let total = 0;
    let amarillo = 0;
    let pendiente = 0;
    let verde = 0;
    let rechazada = 0;
    for (const v of this.state.vehiculosFiltrados()) {
      for (const cot of v.cotizaciones || []) {
        total += 1;
        if (cot.estadoAprobacion === 'AMARILLO_EDITADA_POR_BOLIVIA') amarillo += 1;
        else if (cot.estadoAprobacion === 'VERDE_ACEPTADA_POR_CHILE') verde += 1;
        else if (cot.estadoAprobacion === 'RECHAZADA_CLIENTE') rechazada += 1;
        else pendiente += 1;
      }
    }
    return {
      total,
      amarillo,
      pendiente,
      verde,
      rechazada,
      sinCotizar: this.vehiculosSinCotizar().length,
    };
  });

  tarjetasCotizaciones = computed(() => {
    const q = this.busquedaTexto().trim().toLowerCase();
    const filtro = this.filtroEstado();
    const fVeh = this.state.focusedVehiculoId();
    const fRef = this.state.focusedReferenciaId();
    const salida: Array<{
      vehiculo: any;
      cot: any;
      costosTotales: number;
      margenBruto: number;
      deltaOriginal: number;
    }> = [];

    for (const v of this.state.vehiculosFiltrados()) {
      const matchQuery =
        !q ||
        `${v.marca} ${v.modelo} ${v.vinChasis} ${v.placaOLote} ${v.nombreCliente}`
          .toLowerCase()
          .includes(q);
      if (!matchQuery) continue;

      for (const cot of v.cotizaciones || []) {
        const est = cot.estadoAprobacion;
        if (filtro === 'AMARILLO' && est !== 'AMARILLO_EDITADA_POR_BOLIVIA') continue;
        if (filtro === 'VERDE' && est !== 'VERDE_ACEPTADA_POR_CHILE') continue;
        if (filtro === 'RECHAZADA' && est !== 'RECHAZADA_CLIENTE') continue;
        if (filtro === 'PENDIENTE' && est !== 'PENDIENTE_REVISION_BOLIVIA') continue;

        const costosTotales = (cot.items || []).reduce(
          (acc: number, it: any) => acc + Number(it.costoInternoOTerceroUsd || 0),
          0,
        );
        const acordado = Number(cot.montoAcordadoUsd || 0);
        const original = Number(cot.montoOriginalUsd || 0);
        salida.push({
          vehiculo: v,
          cot,
          costosTotales: Math.round(costosTotales * 100) / 100,
          margenBruto: Math.round((acordado - costosTotales) * 100) / 100,
          deltaOriginal: Math.round((acordado - original) * 100) / 100,
        });
      }
    }

    const prioridadEstado: Record<string, number> = {
      AMARILLO_EDITADA_POR_BOLIVIA: 0,
      PENDIENTE_REVISION_BOLIVIA: 1,
      VERDE_ACEPTADA_POR_CHILE: 2,
      RECHAZADA_CLIENTE: 3,
    };
    return salida.sort((a, b) => {
      const aFocus = (fRef && a.cot.id === fRef) || (fVeh && a.vehiculo.id === fVeh) ? 0 : 1;
      const bFocus = (fRef && b.cot.id === fRef) || (fVeh && b.vehiculo.id === fVeh) ? 0 : 1;
      if (aFocus !== bFocus) return aFocus - bFocus;
      return (prioridadEstado[a.cot.estadoAprobacion] ?? 9) - (prioridadEstado[b.cot.estadoAprobacion] ?? 9);
    });
  });

  limpiarFiltros() {
    this.filtroEstado.set('TODAS');
    this.busquedaTexto.set('');
    this.state.clearNotificationFocus();
  }

  toggleConstructor() {
    this.mostrarConstructorNueva.set(!this.mostrarConstructorNueva());
  }

  iniciarCotizacionParaVehiculo(vehiculoId: string) {
    this.vehiculoSeleccionadoId = vehiculoId;
    this.mostrarConstructorNueva.set(true);
    this.errorMsg.set('');
  }

  aplicarPlantillaRapida(tipo: 'FRONTAL' | 'LATERAL_LEVE' | 'TERCERO_SRS') {
    const plantillas: Record<'FRONTAL' | 'LATERAL_LEVE' | 'TERCERO_SRS', BorradorItemCotizacion[]> = {
      FRONTAL: [
        {
          categoria: 'CHAPERIA',
          piezaZona: 'Enderezado Capó, Punta Chasis y Guardabarros',
          gradoDanio: 'FUERTE',
          costoInternoOTerceroUsd: 180,
          precioClienteUsd: 420,
        },
        {
          categoria: 'PINTURA',
          piezaZona: 'Pintura Bicapa Frente Completo y Pulido',
          gradoDanio: 'NO_APLICA',
          costoInternoOTerceroUsd: 140,
          precioClienteUsd: 350,
        },
      ],
      LATERAL_LEVE: [
        {
          categoria: 'CHAPERIA',
          piezaZona: 'Desabolladura Puerta y Guardabarros Lateral',
          gradoDanio: 'LEVE',
          costoInternoOTerceroUsd: 85,
          precioClienteUsd: 210,
        },
        {
          categoria: 'PINTURA',
          piezaZona: 'Pintado Paño Lateral + Difuminado Barniz UHS',
          gradoDanio: 'NO_APLICA',
          costoInternoOTerceroUsd: 100,
          precioClienteUsd: 260,
        },
      ],
      TERCERO_SRS: [
        {
          categoria: 'SERVICIO_TERCERO',
          piezaZona: 'Reseteo Centralita SRS y Reemplazo Airbags',
          gradoDanio: 'NO_APLICA',
          costoInternoOTerceroUsd: 160,
          precioClienteUsd: 260,
        },
      ],
    };
    this.itemsBorrador.update((prev) => [...prev, ...plantillas[tipo]]);
  }

  onCategoriaChange(cat: CategoriaCotizacion) {
    this.nuevoItemGrado = cat === 'CHAPERIA' ? 'FUERTE' : 'NO_APLICA';
  }

  onAdendaCategoriaChange(cat: CategoriaCotizacion) {
    this.adendaGrado = cat === 'CHAPERIA' ? 'FUERTE' : 'NO_APLICA';
  }

  agregarItemAlBorrador() {
    if (!this.nuevoItemPieza.trim() || this.nuevoItemPieza.trim().length < 2) {
      this.errorMsg.set('Ingresa el nombre de la pieza o servicio (mín. 2 caracteres).');
      return;
    }
    this.itemsBorrador.update((prev) => [
      ...prev,
      {
        categoria: this.nuevoItemCategoria,
        piezaZona: this.nuevoItemPieza.trim(),
        gradoDanio: this.nuevoItemCategoria === 'CHAPERIA' ? this.nuevoItemGrado : 'NO_APLICA',
        costoInternoOTerceroUsd: Math.max(0, Number(this.nuevoItemCostoUsd || 0)),
        precioClienteUsd: Math.max(0, Number(this.nuevoItemPrecioUsd || 0)),
      },
    ]);
    this.nuevoItemPieza = '';
    this.errorMsg.set('');
  }

  quitarItemBorrador(idx: number) {
    this.itemsBorrador.update((prev) => prev.filter((_, i) => i !== idx));
  }

  totalCostoBorrador(): number {
    return this.itemsBorrador().reduce((acc, it) => acc + Number(it.costoInternoOTerceroUsd), 0);
  }

  totalPrecioBorrador(): number {
    return this.itemsBorrador().reduce((acc, it) => acc + Number(it.precioClienteUsd), 0);
  }

  guardarNuevaCotizacion() {
    this.errorMsg.set('');
    if (!this.vehiculoSeleccionadoId) {
      this.errorMsg.set('Selecciona primero el vehículo al que pertenece esta cotización.');
      return;
    }
    if (this.itemsBorrador().length === 0) {
      this.errorMsg.set('Agrega al menos una pieza o trabajo a la cotización.');
      return;
    }

    this.guardandoCotizacion.set(true);
    this.state.crearCotizacionNueva(
      {
        vehiculoId: this.vehiculoSeleccionadoId,
        observacionInicial: this.observacionInicial.trim(),
        items: this.itemsBorrador(),
      },
      () => {
        this.guardandoCotizacion.set(false);
        this.itemsBorrador.set([]);
        this.vehiculoSeleccionadoId = '';
        this.feedbackMsg.set('Cotización creada y registrada correctamente.');
        this.mostrarConstructorNueva.set(false);
      },
      (err) => {
        this.guardandoCotizacion.set(false);
        this.errorMsg.set(err);
      },
    );
  }

  abrirEditorCotizacion(cot: any, vehiculo: any) {
    this.cotizacionActivaAdendaId.set(null);
    this.cotizacionActivaRechazoId.set(null);
    this.cotizacionActivaEdicionId.set(cot.id);
    this.editItems.set(
      (cot.items || []).map((it: any) => ({
        id: it.id,
        categoria: it.categoria,
        piezaZona: it.piezaZona,
        gradoDanio: it.gradoDanio,
        costoInternoOTerceroUsd: Number(it.costoInternoOTerceroUsd || 0),
        precioCotizadoOriginalUsd: Number(it.precioCotizadoOriginalUsd || 0),
        precioAcordadoClienteUsd: Number(it.precioAcordadoClienteUsd || 0),
      })),
    );
    this.edicionMontoAcordadoUsd = Number(cot.montoAcordadoUsd);
    this.edicionPrioridadCola = vehiculo?.prioridadCola || 'ALTA_15_DIAS';
    this.edicionMotivo = '';
  }

  recalcularTotalEdicion() {
    const suma = this.editItems().reduce(
      (acc, it) => acc + Math.max(0, Number(it.precioAcordadoClienteUsd || 0)),
      0,
    );
    this.edicionMontoAcordadoUsd = Math.round(suma * 100) / 100;
  }

  confirmarEdicionAmarillo(cot: any) {
    this.errorMsg.set('');
    if (!this.edicionMotivo.trim() || this.edicionMotivo.trim().length < 4) {
      this.errorMsg.set(
        'Debes escribir obligatoriamente el motivo de la edición (mín. 4 caracteres).',
      );
      return;
    }

    this.guardandoEdicion.set(true);
    this.state.editarCotizacionCompleta(
      cot.id,
      {
        montoAcordadoUsd: Math.max(0, Number(this.edicionMontoAcordadoUsd)),
        motivo: this.edicionMotivo.trim(),
        prioridadCola: this.edicionPrioridadCola,
        pasarACola30Dias: this.edicionPrioridadCola === 'COLA_30_DIAS',
        itemsActualizados: this.editItems().map((it) => ({
          id: it.id,
          piezaZona: it.piezaZona.trim(),
          gradoDanio: it.categoria === 'CHAPERIA' ? it.gradoDanio : 'NO_APLICA',
          costoInternoOTerceroUsd: Math.max(0, Number(it.costoInternoOTerceroUsd || 0)),
          precioAcordadoClienteUsd: Math.max(0, Number(it.precioAcordadoClienteUsd || 0)),
        })),
      },
      () => {
        this.guardandoEdicion.set(false);
        this.cotizacionActivaEdicionId.set(null);
        this.feedbackMsg.set(
          'Cotización actualizada a estado AMARILLO y registrada en el historial.',
        );
      },
      (err) => {
        this.guardandoEdicion.set(false);
        this.errorMsg.set(err);
      },
    );
  }

  abrirAdenda(cotId: string) {
    this.cotizacionActivaEdicionId.set(null);
    this.cotizacionActivaRechazoId.set(null);
    this.cotizacionActivaAdendaId.set(this.cotizacionActivaAdendaId() === cotId ? null : cotId);
  }

  async subirFotoAdendaDesarme(event: Event, vehiculo: any, cot: any) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    let file = input.files[0];
    let originalKb: number | undefined;
    this.errorMsg.set('');
    this.subiendoFotoAdenda.set(true);

    try {
      const comp = await comprimirImagenNavegadorWebp(file);
      file = comp.file;
      originalKb = comp.originalKb;
      if (comp.previewUrl.startsWith('blob:')) URL.revokeObjectURL(comp.previewUrl);
    } catch {
      // Fallback al servidor para compresión con Sharp
    }

    this.state.subirEvidenciaConDetalle(
      file,
      {
        moduloOrigen: 'DESARME_COTIZACION',
        referenciaId: cot.id,
        vehiculoReferencia: `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.vinChasis})`,
        tituloDetalle: this.adendaPieza.trim() || 'Daño oculto en desarme',
        descripcionBreve: this.adendaMotivo.trim() || 'Evidencia fotográfica de desarme en taller',
        pesoOriginalClienteKb: originalKb,
      },
      (ev) => {
        this.subiendoFotoAdenda.set(false);
        this.adendaFotoWebpUrl = ev.archivoWebpUrl;
        this.adendaFotoPesoKb = ev.pesoWebpKb;
        input.value = '';
        this.feedbackMsg.set('Fotografía de desarme cargada y lista para anexar.');
      },
      (err) => {
        this.subiendoFotoAdenda.set(false);
        input.value = '';
        this.errorMsg.set(err);
      },
    );
  }

  quitarFotoAdenda() {
    this.adendaFotoWebpUrl = '';
    this.adendaFotoPesoKb = 0;
  }

  guardarAdendaDesarme(cot: any) {
    this.errorMsg.set('');
    if (!this.adendaPieza.trim() || this.adendaPieza.trim().length < 2) {
      this.errorMsg.set('Especifica el nombre de la pieza o daño oculto detectado.');
      return;
    }
    if (!this.adendaMotivo.trim() || this.adendaMotivo.trim().length < 4) {
      this.errorMsg.set('Escribe el motivo y descripción del hallazgo (mín. 4 caracteres).');
      return;
    }

    this.guardandoAdenda.set(true);
    this.state.agregarAdendaDesarme(
      cot.id,
      {
        categoria: this.adendaCategoria,
        piezaZona: this.adendaPieza.trim(),
        gradoDanio: this.adendaCategoria === 'CHAPERIA' ? this.adendaGrado : 'NO_APLICA',
        costoInternoOTerceroUsd: Math.max(0, Number(this.adendaCostoUsd || 0)),
        precioClienteUsd: Math.max(0, Number(this.adendaPrecioUsd || 0)),
        motivoAdenda: this.adendaMotivo.trim(),
        fotoDesarmeAdendaWebp: this.adendaFotoWebpUrl || undefined,
        descripcionFotoAdenda: this.adendaMotivo.trim(),
      },
      () => {
        this.guardandoAdenda.set(false);
        this.adendaPieza = '';
        this.adendaMotivo = '';
        this.adendaFotoWebpUrl = '';
        this.adendaFotoPesoKb = 0;
        this.cotizacionActivaAdendaId.set(null);
        this.feedbackMsg.set(
          'Adenda por desarme agregada. La cotización pasó a estado AMARILLO y se registró en auditoría.',
        );
      },
      (err) => {
        this.guardandoAdenda.set(false);
        this.errorMsg.set(err);
      },
    );
  }

  abrirRechazo(cotId: string) {
    this.cotizacionActivaEdicionId.set(null);
    this.cotizacionActivaAdendaId.set(null);
    this.rechazoMotivo = '';
    this.rechazoRetirarVehiculo = false;
    this.cotizacionActivaRechazoId.set(
      this.cotizacionActivaRechazoId() === cotId ? null : cotId,
    );
  }

  confirmarRechazoCotizacion(cot: any) {
    this.errorMsg.set('');
    if (!this.rechazoMotivo.trim() || this.rechazoMotivo.trim().length < 4) {
      this.errorMsg.set('Debes ingresar el motivo del rechazo (mín. 4 caracteres).');
      return;
    }

    this.guardandoRechazo.set(true);
    this.state.rechazarCotizacion(
      cot.id,
      {
        motivo: this.rechazoMotivo.trim(),
        retirarSinReparar: this.rechazoRetirarVehiculo,
      },
      () => {
        this.guardandoRechazo.set(false);
        this.cotizacionActivaRechazoId.set(null);
        this.feedbackMsg.set('Cotización marcada como RECHAZADA POR CLIENTE y sellada en auditoría.');
      },
      (err) => {
        this.guardandoRechazo.set(false);
        this.errorMsg.set(err);
      },
    );
  }

  aceptarPasoAVerde(cot: any) {
    this.errorMsg.set('');
    this.aceptandoId.set(cot.id);
    this.state.aceptarCotizacionChile(
      cot.id,
      () => {
        this.aceptandoId.set(null);
        this.feedbackMsg.set(
          'Cotización verificada y aceptada: pasó a estado VERDE y se generaron/sincronizaron sus tareas en Orden de Trabajo.',
        );
      },
      (err) => {
        this.aceptandoId.set(null);
        this.errorMsg.set(err);
      },
    );
  }

  irARecepcion(vehiculoId: string) {
    this.state.irAVehiculoEnModulo(vehiculoId, 'recepcion');
  }

  irAOrdenesTrabajo(vehiculoId: string) {
    this.state.irAVehiculoEnModulo(vehiculoId, 'ordenes');
  }

  abrirLightbox(url: string, titulo: string, descripcion: string) {
    this.lightbox.set({ url, titulo, descripcion });
  }
}
