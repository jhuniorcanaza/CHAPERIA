import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../core/services/app-state.service';
import { comprimirImagenNavegadorWebp } from '../../core/utils/webp-compressor';
import { AuditHistoryPanelComponent } from '../../shared/components/audit-history-panel/audit-history-panel.component';

type TipoMovimientoAlmacen =
  | 'ENTRADA_STOCK'
  | 'SALIDA_POR_TAREA'
  | 'COMPRA_PINTURA_COLORISTA';

type FiltroMovimientos = 'TODOS' | TipoMovimientoAlmacen;

interface LightboxBoleta {
  url: string;
  titulo: string;
  descripcion: string;
}

@Component({
  selector: 'app-almacen',
  standalone: true,
  imports: [CommonModule, FormsModule, AuditHistoryPanelComponent],
  template: `
    <div class="space-y-6">
      <!-- Encabezado principal -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div class="space-y-1 max-w-3xl">
          <div class="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <i class="ri-store-2-line text-sm"></i>
            <span>Almacén de Insumos y Pintura Colorista</span>
          </div>
          <h1 class="text-lg sm:text-xl font-bold text-white">
            Control de Stock, Consumos por Vehículo/Tarea y Boletas de Pintura
          </h1>
          <p class="text-xs text-slate-400">
            Control de stock, consumos imputados a cada vehículo/tarea y compras de pintura al colorista.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            (click)="abrirModalMovimiento('ENTRADA_STOCK')"
            class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <i class="ri-arrow-down-line text-sm"></i>
            <span>Entrada Stock</span>
          </button>
          <button
            type="button"
            (click)="abrirModalMovimiento('SALIDA_POR_TAREA')"
            class="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <i class="ri-arrow-up-line text-sm"></i>
            <span>Consumo por Auto/Tarea</span>
          </button>
          <button
            type="button"
            (click)="abrirModalMovimiento('COMPRA_PINTURA_COLORISTA')"
            class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <i class="ri-palette-line text-sm"></i>
            <span>Pintura Colorista</span>
          </button>
          <button
            type="button"
            (click)="errorMsg.set(''); mostrarCrearInsumo.set(true)"
            class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <i class="ri-add-line"></i>
            <span>Nuevo Insumo</span>
          </button>
        </div>
      </div>

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

      <!-- KPIs clicables -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <button
          type="button"
          (click)="aplicarKpiCatalogo(false)"
          [ngClass]="vistaTab() === 'catalogo' && !soloBajoStock() ? 'border-blue-500 bg-blue-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
          class="p-4 rounded-xl border text-left transition cursor-pointer"
        >
          <div class="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5">
            <i class="ri-archive-line text-blue-400"></i>
            <span>Catálogo & Valorización</span>
          </div>
          <div class="text-xl font-black text-white font-mono mt-1">
            {{ state.insumos().length }} ítems • {{ state.formatMoney(resumenKpis().valorInventarioUsd) }}
          </div>
          <div class="text-[10px] text-slate-500 mt-0.5">Stock total valorizado</div>
        </button>

        <button
          type="button"
          (click)="aplicarKpiCatalogo(true)"
          [ngClass]="vistaTab() === 'catalogo' && soloBajoStock() ? 'border-rose-400 bg-rose-950/40' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
          class="p-4 rounded-xl border text-left transition cursor-pointer"
        >
          <div class="text-[11px] text-amber-400 font-semibold flex items-center gap-1.5">
            <i class="ri-alert-line"></i>
            <span>En Alerta de Stock Mínimo</span>
          </div>
          <div
            [ngClass]="resumenKpis().bajoStock > 0 ? 'text-rose-400' : 'text-emerald-400'"
            class="text-2xl font-black font-mono mt-1"
          >
            {{ resumenKpis().bajoStock }}
          </div>
          <div class="text-[10px] text-slate-500 mt-0.5">
            {{ resumenKpis().bajoStock > 0 ? 'Clic para filtrar reposición urgente' : 'Todos sobre el mínimo' }}
          </div>
        </button>

        <button
          type="button"
          (click)="aplicarKpiMovimientos('SALIDA_POR_TAREA')"
          [ngClass]="vistaTab() === 'movimientos' && filtroMovimiento() === 'SALIDA_POR_TAREA' ? 'border-amber-400 bg-amber-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
          class="p-4 rounded-xl border text-left transition cursor-pointer"
        >
          <div class="text-[11px] text-amber-300 font-semibold flex items-center gap-1.5">
            <i class="ri-exchange-line"></i>
            <span>Consumos en OT / Movimientos</span>
          </div>
          <div class="text-xl font-black text-amber-300 font-mono mt-1">
            {{ resumenKpis().salidasCount }} ({{ state.formatMoney(resumenKpis().totalSalidasUsd) }})
          </div>
          <div class="text-[10px] text-slate-500 mt-0.5">{{ state.movimientosInsumo().length }} movimientos en kardex</div>
        </button>

        <button
          type="button"
          (click)="aplicarKpiMovimientos('COMPRA_PINTURA_COLORISTA')"
          [ngClass]="vistaTab() === 'movimientos' && filtroMovimiento() === 'COMPRA_PINTURA_COLORISTA' ? 'border-indigo-400 bg-indigo-950/40' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
          class="p-4 rounded-xl border text-left transition cursor-pointer"
        >
          <div class="text-[11px] text-indigo-300 font-semibold flex items-center gap-1.5">
            <i class="ri-palette-line"></i>
            <span>Pintura Directa Colorista</span>
          </div>
          <div class="text-xl font-black text-indigo-300 font-mono mt-1">
            {{ resumenKpis().comprasColorista }} ({{ state.formatMoney(resumenKpis().totalPinturaUsd) }})
          </div>
          <div class="text-[10px] text-slate-500 mt-0.5">Respaldo obligatorio con boleta</div>
        </button>
      </div>

      <!-- Modal Alta de Nuevo Insumo -->
      @if (mostrarCrearInsumo()) {
        <div
          (click)="mostrarCrearInsumo.set(false)"
          class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            (click)="$event.stopPropagation()"
            class="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden text-xs shadow-2xl"
          >
            <div class="px-5 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 shrink-0">
              <div>
                <div class="font-bold text-sm text-white flex items-center gap-2">
                  <i class="ri-folder-add-line text-amber-400 text-base"></i>
                  <span>Alta de Nuevo Insumo en Catálogo</span>
                </div>
                <span class="text-[11px] text-slate-400">El movimiento queda registrado en el historial del almacén.</span>
              </div>
              <button
                type="button"
                (click)="mostrarCrearInsumo.set(false)"
                class="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <i class="ri-close-line text-lg"></i>
              </button>
            </div>

            <div class="p-5 space-y-4 overflow-y-auto flex-1">

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div class="lg:col-span-2">
              <label class="block text-slate-300 font-semibold mb-1">Nombre del insumo *</label>
              <input
                type="text"
                [(ngModel)]="nuevoInsumo.nombre"
                placeholder="Ej: Lija al agua P1200, Masilla Poliéster, Thinner..."
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Unidad de medida *</label>
              <select
                [(ngModel)]="nuevoInsumo.unidadMedida"
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
              >
                @for (u of unidadesCatalogo; track u) {
                  <option [value]="u">{{ u }}</option>
                }
              </select>
            </div>
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Stock inicial</label>
              <input
                type="number"
                min="0"
                step="0.5"
                [(ngModel)]="nuevoInsumo.stockActual"
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Stock mínimo alerta</label>
              <input
                type="number"
                min="0"
                step="0.5"
                [(ngModel)]="nuevoInsumo.stockMinimoAlerta"
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Costo unitario (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                [(ngModel)]="nuevoInsumo.costoUnitarioUsd"
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
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
                (click)="mostrarCrearInsumo.set(false)"
                class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                [disabled]="creandoInsumo()"
                (click)="guardarNuevoInsumo()"
                class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white font-bold cursor-pointer flex items-center gap-1.5"
              >
                <i [class]="creandoInsumo() ? 'ri-loader-4-line animate-spin' : 'ri-check-line'"></i>
                <span>{{ creandoInsumo() ? 'Guardando...' : 'Guardar insumo' }}</span>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modal de Registro de Movimiento -->
      @if (movimientoActivo(); as tipoMov) {
        <div
          (click)="cerrarMovimiento()"
          class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            (click)="$event.stopPropagation()"
            [ngClass]="{
              'border-emerald-500/40': tipoMov === 'ENTRADA_STOCK',
              'border-amber-500/40': tipoMov === 'SALIDA_POR_TAREA',
              'border-indigo-500/40': tipoMov === 'COMPRA_PINTURA_COLORISTA'
            }"
            class="bg-slate-900 border rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-xs shadow-2xl"
          >
            <div class="px-5 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 shrink-0">
              <div class="font-bold text-sm text-white flex items-center gap-2">
                @if (tipoMov === 'ENTRADA_STOCK') {
                  <i class="ri-arrow-down-circle-line text-emerald-400 text-base"></i>
                  <span>Registrar Entrada / Reposición al Stock de Almacén</span>
                } @else if (tipoMov === 'SALIDA_POR_TAREA') {
                  <i class="ri-arrow-up-circle-line text-amber-400 text-base"></i>
                  <span>Registrar Consumo de Insumo por Vehículo y Tarea</span>
                } @else {
                  <i class="ri-palette-line text-indigo-400 text-base"></i>
                  <span>Registrar Compra Directa a Colorista (Boleta Obligatoria)</span>
                }
              </div>
              <button
                type="button"
                (click)="cerrarMovimiento()"
                class="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <i class="ri-close-line text-lg"></i>
              </button>
            </div>

            <div class="p-5 space-y-4 overflow-y-auto flex-1">

          <!-- ENTRADA o SALIDA regular -->
          @if (tipoMov !== 'COMPRA_PINTURA_COLORISTA') {
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="lg:col-span-2">
                <label class="block text-slate-300 font-semibold mb-1">Insumo del almacén *</label>
                <select
                  [(ngModel)]="movForm.insumoId"
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">Selecciona un insumo...</option>
                  @for (ins of state.insumos(); track ins.id) {
                    <option [value]="ins.id">
                      {{ ins.nombre }} — Disponible: {{ ins.stockActual }} {{ ins.unidadMedida }} ({{ state.formatMoney(ins.costoUnitarioUsd) }}/u)
                    </option>
                  }
                </select>
                @if (insumoSeleccionado(); as insSel) {
                  <div class="mt-1 text-[11px] flex flex-wrap gap-3 text-slate-400">
                    <span>
                      Stock disponible:
                      <strong [ngClass]="esStockBajo(insSel) ? 'text-rose-400' : 'text-emerald-400'" class="font-mono">
                        {{ insSel.stockActual }} {{ insSel.unidadMedida }}
                      </strong>
                    </span>
                    <span>
                      Costo unitario:
                      <strong class="text-amber-300 font-mono">{{ state.formatMoney(insSel.costoUnitarioUsd) }}</strong>
                    </span>
                  </div>
                }
              </div>

              <div>
                <label class="block text-slate-300 font-semibold mb-1">Cantidad *</label>
                <input
                  type="number"
                  [(ngModel)]="movForm.cantidad"
                  min="0.1"
                  step="0.5"
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-amber-500"
                />
                @if (tipoMov === 'SALIDA_POR_TAREA' && insumoSeleccionado(); as insSel) {
                  <div class="mt-1 text-[11px] text-cyan-300 font-mono">
                    Costo imputado aprox.: {{ state.formatMoney(toNum(movForm.cantidad) * toNum(insSel.costoUnitarioUsd)) }}
                  </div>
                }
              </div>

              @if (tipoMov === 'ENTRADA_STOCK') {
                <div>
                  <label class="block text-slate-300 font-semibold mb-1">Costo total factura compra (USD)</label>
                  <input
                    type="number"
                    [(ngModel)]="movForm.costoTotalUsd"
                    min="0"
                    step="0.01"
                    class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  @if (toNum(movForm.costoTotalUsd) > 0 && toNum(movForm.cantidad) > 0) {
                    <div class="mt-1 text-[11px] text-emerald-400 font-mono">
                      Nuevo costo unit.: {{ state.formatMoney(toNum(movForm.costoTotalUsd) / toNum(movForm.cantidad)) }}
                    </div>
                  }
                </div>

                <div class="lg:col-span-4">
                  <label class="block text-slate-300 font-semibold mb-1">Proveedor / Nota de compra (opcional)</label>
                  <input
                    type="text"
                    [(ngModel)]="movForm.tareaReferencia"
                    placeholder="Ej: Compra mayorista Zofri Iquique — Boleta #1042"
                    class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              }

              @if (tipoMov === 'SALIDA_POR_TAREA') {
                <div>
                  <label class="block text-slate-300 font-semibold mb-1">Costo estimado (USD)</label>
                  <div class="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-amber-300 font-mono font-bold">
                    @if (insumoSeleccionado(); as insSel) {
                      {{ state.formatMoney(toNum(movForm.cantidad) * toNum(insSel.costoUnitarioUsd)) }}
                    } @else {
                      $0.00 USD
                    }
                  </div>
                </div>

                <div class="lg:col-span-2">
                  <label class="block text-slate-300 font-semibold mb-1">Vehículo que consume *</label>
                  <select
                    [(ngModel)]="movForm.vehiculoId"
                    (ngModelChange)="onVehiculoMovimientoChange($event)"
                    class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Selecciona vehículo en taller...</option>
                    @for (v of state.vehiculos(); track v.id) {
                      <option [value]="v.id">
                        {{ v.marca }} {{ v.modelo }} ({{ v.placaOLote }}) — VIN {{ v.vinChasis }}
                      </option>
                    }
                  </select>
                </div>

                <div class="lg:col-span-2">
                  <label class="block text-slate-300 font-semibold mb-1">Tarea de la OT o actividad *</label>
                  <input
                    type="text"
                    [(ngModel)]="movForm.tareaReferencia"
                    placeholder="Ej: Desbaste capó o selecciona una tarea de la OT debajo"
                    class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                @if (vehiculoMovimientoSeleccionado(); as vehSel) {
                  @if ((vehSel.tareasOt || []).length > 0) {
                    <div class="lg:col-span-4 p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div class="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
                        <i class="ri-task-line"></i>
                        <span>Tareas reales en OT de {{ vehSel.marca }} {{ vehSel.modelo }} (clic para vincular):</span>
                      </div>
                      <div class="flex flex-wrap gap-2">
                        @for (t of vehSel.tareasOt; track t.id) {
                          <button
                            type="button"
                            (click)="movForm.tareaReferencia = t.titulo"
                            [ngClass]="
                              movForm.tareaReferencia === t.titulo
                                ? 'bg-amber-600 text-white border-amber-400'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                            "
                            class="px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition"
                          >
                            #{{ t.orden }} {{ t.titulo }} ({{ t.tecnicoAsignadoNombre }})
                          </button>
                        }
                      </div>
                    </div>
                  }
                }
              }
            </div>
          }

          <!-- COMPRA DIRECTA A COLORISTA -->
          @if (tipoMov === 'COMPRA_PINTURA_COLORISTA') {
            <div class="space-y-4">
              <div class="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/35 text-xs text-indigo-200 flex items-center gap-2">
                <i class="ri-information-line text-indigo-400 text-base shrink-0"></i>
                <span>
                  La pintura comprada al colorista va directo al vehículo (sin stock general) y exige fotografía de la boleta con su descripción.
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="lg:col-span-2">
                  <label class="block text-slate-300 font-semibold mb-1">Vehículo destinatario *</label>
                  <select
                    [(ngModel)]="movForm.vehiculoId"
                    (ngModelChange)="onVehiculoMovimientoChange($event)"
                    class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Selecciona vehículo...</option>
                    @for (v of state.vehiculos(); track v.id) {
                      <option [value]="v.id">
                        {{ v.marca }} {{ v.modelo }} ({{ v.placaOLote }}) — Color: {{ v.color }}
                      </option>
                    }
                  </select>
                </div>

                <div class="lg:col-span-2">
                  <label class="block text-slate-300 font-semibold mb-1">Descripción / Código de color *</label>
                  <input
                    type="text"
                    [(ngModel)]="movForm.insumoNombre"
                    placeholder="Ej: Pintura Bicapa Blanco Perlado Código 070 (Toyota)"
                    class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label class="block text-slate-300 font-semibold mb-1">Cantidad *</label>
                  <input
                    type="number"
                    [(ngModel)]="movForm.cantidad"
                    min="0.1"
                    step="0.25"
                    class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label class="block text-slate-300 font-semibold mb-1">Unidad</label>
                  <select
                    [(ngModel)]="movForm.unidad"
                    class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="LITROS">LITROS</option>
                    <option value="ML">MILILITROS (ML)</option>
                    <option value="GALONES">GALONES</option>
                    <option value="ONZAS">ONZAS</option>
                  </select>
                </div>

                <div class="lg:col-span-2">
                  <label class="block text-slate-300 font-semibold mb-1">Costo total factura (USD) *</label>
                  <input
                    type="number"
                    [(ngModel)]="movForm.costoTotalUsd"
                    min="1"
                    step="0.01"
                    placeholder="USD"
                    class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div class="lg:col-span-4">
                  <label class="block text-slate-300 font-semibold mb-1">Aplicación / Piezas a pintar (opcional)</label>
                  <input
                    type="text"
                    [(ngModel)]="movForm.tareaReferencia"
                    placeholder="Ej: Preparación bicapa cabina y difuminado de guardabarros"
                    class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>

                <!-- Carga y vista previa WebP de la factura -->
                <div class="lg:col-span-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div class="font-semibold text-slate-200 flex items-center gap-2">
                    <i class="ri-file-text-line text-indigo-400"></i>
                    <span>Respaldo de Boleta / Factura del Colorista *</span>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div>
                      <label class="block text-slate-400 mb-1">Foto de la boleta / factura *</label>
                      <input
                        #fileInputBoleta
                        type="file"
                        accept="image/*"
                        (change)="alSeleccionarFactura($event, fileInputBoleta)"
                        class="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                      />
                      @if (comprimiendoFoto()) {
                        <div class="mt-1.5 text-[11px] text-amber-300 flex items-center gap-1.5">
                          <i class="ri-loader-4-line animate-spin"></i>
                          <span>Procesando imagen de boleta...</span>
                        </div>
                      } @else if (compresionBoletaInfo()) {
                        <div class="mt-1.5 text-[11px] text-emerald-400">
                          {{ compresionBoletaInfo() }}
                        </div>
                      }
                    </div>

                    <div>
                      <label class="block text-slate-400 mb-1">Descripción breve del comprobante *</label>
                      <input
                        type="text"
                        [(ngModel)]="movForm.descripcionFotoFactura"
                        placeholder="Ej: Boleta #4589 Pinturas Andina, 1L bicapa perlado"
                        class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div class="flex items-center justify-end gap-2">
                      @if (previewBoletaUrl()) {
                        <img
                          [src]="previewBoletaUrl()"
                          alt="Vista previa factura"
                          class="w-24 h-16 rounded-lg object-cover border border-indigo-500/50"
                        />
                        <button
                          type="button"
                          (click)="limpiarBoletaSeleccionada(fileInputBoleta)"
                          class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-white cursor-pointer"
                          title="Quitar imagen"
                        >
                          <i class="ri-delete-bin-line"></i>
                        </button>
                      } @else {
                        <span class="text-[11px] text-slate-500 italic">Vista previa pendiente</span>
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }

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
                (click)="cerrarMovimiento()"
                [disabled]="procesando()"
                class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="confirmarMovimiento()"
                [disabled]="procesando() || comprimiendoFoto()"
                class="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                @if (procesando()) {
                  <i class="ri-loader-4-line animate-spin"></i>
                  <span>Procesando...</span>
                } @else {
                  <i class="ri-check-line"></i>
                  <span>Confirmar movimiento</span>
                }
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Barra de búsqueda y pestañas -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div class="flex items-center gap-6 text-xs font-semibold">
          <button
            type="button"
            (click)="vistaTab.set('catalogo')"
            [ngClass]="vistaTab() === 'catalogo' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'"
            class="pb-2 border-b-2 transition flex items-center gap-2 cursor-pointer"
          >
            <i class="ri-list-check-2"></i>
            <span>Catálogo de Insumos ({{ insumosFiltrados().length }})</span>
          </button>

          <button
            type="button"
            (click)="vistaTab.set('movimientos')"
            [ngClass]="vistaTab() === 'movimientos' ? 'border-blue-400 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'"
            class="pb-2 border-b-2 transition flex items-center gap-2 cursor-pointer"
          >
            <i class="ri-history-line"></i>
            <span>Historial de Movimientos ({{ movimientosFiltrados().length }})</span>
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs">
          <div class="relative w-full sm:w-72">
            <i class="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              [ngModel]="busquedaTexto()"
              (ngModelChange)="busquedaTexto.set($event)"
              placeholder="Buscar insumo, vehículo, tarea o boleta..."
              class="w-full pl-9 pr-8 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
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

          @if (soloBajoStock() || filtroMovimiento() !== 'TODOS' || busquedaTexto().trim() || state.focusedReferenciaId()) {
            <button
              type="button"
              (click)="limpiarFiltros()"
              class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold cursor-pointer"
            >
              Limpiar filtros
            </button>
          }
        </div>
      </div>

      <!-- VISTA 1: CATÁLOGO DE INSUMOS -->
      @if (vistaTab() === 'catalogo') {
        <div class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
            <label class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                [ngModel]="soloBajoStock()"
                (ngModelChange)="soloBajoStock.set($event)"
                class="accent-rose-500"
              />
              <span>Mostrar solo insumos en alerta de reposición ({{ resumenKpis().bajoStock }})</span>
            </label>
            <span class="text-slate-400 text-[11px]">
              Usa <strong class="text-slate-200">"Editar"</strong> para ajustes físicos de inventario, costo unitario o stock mínimo.
            </span>
          </div>

          <!-- Panel inline de edición de insumo -->
          @if (editandoInsumoId()) {
            <div class="bg-slate-900 border border-blue-500/50 rounded-2xl p-5 space-y-4 text-xs shadow-2xl">
              <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div class="font-bold text-blue-300 flex items-center gap-2">
                  <i class="ri-edit-box-line text-base"></i>
                  <span>Editar / Ajustar Insumo de Catálogo (Auditado en Historial)</span>
                </div>
                <button type="button" (click)="editandoInsumoId.set(null)" class="text-slate-400 hover:text-white cursor-pointer">
                  <i class="ri-close-line text-base"></i>
                </button>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div class="sm:col-span-2">
                  <label class="block text-slate-300 font-semibold mb-1">Nombre *</label>
                  <input
                    type="text"
                    [(ngModel)]="editInsumoForm.nombre"
                    class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label class="block text-slate-300 font-semibold mb-1">Unidad *</label>
                  <input
                    type="text"
                    [(ngModel)]="editInsumoForm.unidadMedida"
                    class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white uppercase font-mono"
                  />
                </div>
                <div>
                  <label class="block text-slate-300 font-semibold mb-1">Stock físico actual</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    [(ngModel)]="editInsumoForm.stockActual"
                    class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-emerald-300 font-mono"
                  />
                </div>
                <div>
                  <label class="block text-slate-300 font-semibold mb-1">Mín. alerta</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    [(ngModel)]="editInsumoForm.stockMinimoAlerta"
                    class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 font-mono"
                  />
                </div>
                <div>
                  <label class="block text-slate-300 font-semibold mb-1">Costo unit. (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    [(ngModel)]="editInsumoForm.costoUnitarioUsd"
                    class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-amber-300 font-mono"
                  />
                </div>
                <div class="sm:col-span-2 lg:col-span-4">
                  <label class="block text-slate-300 font-semibold mb-1">Motivo obligatorio del ajuste o edición *</label>
                  <input
                    type="text"
                    [(ngModel)]="editInsumoForm.motivoEdicion"
                    placeholder="Ej: Conteo físico semanal o actualización de precio proveedor"
                    class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-blue-500/40 text-white"
                  />
                </div>
              </div>

              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  (click)="editandoInsumoId.set(null)"
                  class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  [disabled]="guardandoEdicion()"
                  (click)="guardarEdicionInsumo()"
                  class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold flex items-center gap-2 cursor-pointer"
                >
                  <i [class]="guardandoEdicion() ? 'ri-loader-4-line animate-spin' : 'ri-save-3-line'"></i>
                  <span>{{ guardandoEdicion() ? 'Guardando...' : 'Guardar ajuste' }}</span>
                </button>
              </div>
            </div>
          }

          <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs text-slate-300">
                <thead class="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th class="px-4 py-3">Insumo</th>
                    <th class="px-4 py-3">Unidad</th>
                    <th class="px-4 py-3 text-right">Stock Actual</th>
                    <th class="px-4 py-3 text-right">Mín. Alerta</th>
                    <th class="px-4 py-3 text-right">Costo Unit.</th>
                    <th class="px-4 py-3 text-right">Valorizado</th>
                    <th class="px-4 py-3 text-center">Estado</th>
                    <th class="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60 font-sans">
                  @for (ins of insumosFiltrados(); track ins.id) {
                    <tr
                      [attr.data-focus-ref]="ins.id"
                      [ngClass]="
                        state.focusedReferenciaId() === ins.id
                          ? 'bg-cyan-950/35 ring-1 ring-inset ring-cyan-400'
                          : 'hover:bg-slate-800/40'
                      "
                      class="transition"
                    >
                      <td class="px-4 py-3 font-semibold text-white">
                        {{ ins.nombre }}
                      </td>
                      <td class="px-4 py-3 text-slate-400 font-mono">
                        {{ ins.unidadMedida }}
                      </td>
                      <td
                        [ngClass]="esStockBajo(ins) ? 'text-rose-400' : 'text-emerald-400'"
                        class="px-4 py-3 text-right font-mono font-bold"
                      >
                        {{ ins.stockActual }}
                      </td>
                      <td class="px-4 py-3 text-right font-mono text-slate-400">
                        {{ ins.stockMinimoAlerta }}
                      </td>
                      <td class="px-4 py-3 text-right font-mono text-slate-300">
                        {{ state.formatMoney(ins.costoUnitarioUsd) }}
                      </td>
                      <td class="px-4 py-3 text-right font-mono font-semibold text-amber-300">
                        {{ state.formatMoney(toNum(ins.stockActual) * toNum(ins.costoUnitarioUsd)) }}
                      </td>
                      <td class="px-4 py-3 text-center">
                        @if (esStockBajo(ins)) {
                          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/35">
                            <i class="ri-alert-line"></i>
                            <span>REPOSICIÓN REQUERIDA</span>
                          </span>
                        } @else {
                          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <i class="ri-checkbox-circle-line"></i>
                            <span>STOCK ÓPTIMO</span>
                          </span>
                        }
                      </td>
                      <td class="px-4 py-3 text-right">
                        <div class="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            (click)="abrirEdicionInsumo(ins)"
                            title="Editar datos o ajustar inventario"
                            class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            (click)="prepararMovimientoRapido(ins, 'ENTRADA_STOCK')"
                            title="Ingresar stock"
                            class="p-1.5 rounded hover:bg-emerald-500/20 text-emerald-400 cursor-pointer"
                          >
                            <i class="ri-add-circle-line text-base"></i>
                          </button>
                          <button
                            type="button"
                            (click)="prepararMovimientoRapido(ins, 'SALIDA_POR_TAREA')"
                            title="Descargar consumo por auto/tarea"
                            class="p-1.5 rounded hover:bg-amber-500/20 text-amber-400 cursor-pointer"
                          >
                            <i class="ri-indeterminate-circle-line text-base"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="8" class="px-4 py-10 text-center text-slate-500">
                        No hay insumos que coincidan con el filtro actual.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }

      <!-- VISTA 2: HISTORIAL DE MOVIMIENTOS -->
      @if (vistaTab() === 'movimientos') {
        <div class="space-y-4">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="text-slate-400 font-semibold">Tipo:</span>
            <button
              type="button"
              (click)="filtroMovimiento.set('TODOS')"
              [ngClass]="filtroMovimiento() === 'TODOS' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'"
              class="px-3 py-1.5 rounded-lg cursor-pointer font-semibold transition"
            >
              Todos
            </button>
            <button
              type="button"
              (click)="filtroMovimiento.set('ENTRADA_STOCK')"
              [ngClass]="filtroMovimiento() === 'ENTRADA_STOCK' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'"
              class="px-3 py-1.5 rounded-lg cursor-pointer font-semibold transition"
            >
              Entradas
            </button>
            <button
              type="button"
              (click)="filtroMovimiento.set('SALIDA_POR_TAREA')"
              [ngClass]="filtroMovimiento() === 'SALIDA_POR_TAREA' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'"
              class="px-3 py-1.5 rounded-lg cursor-pointer font-semibold transition"
            >
              Consumos por Tarea
            </button>
            <button
              type="button"
              (click)="filtroMovimiento.set('COMPRA_PINTURA_COLORISTA')"
              [ngClass]="filtroMovimiento() === 'COMPRA_PINTURA_COLORISTA' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'"
              class="px-3 py-1.5 rounded-lg cursor-pointer font-semibold transition"
            >
              Pintura Colorista
            </button>
          </div>

          <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs text-slate-300">
                <thead class="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th class="px-4 py-3">Fecha</th>
                    <th class="px-4 py-3">Tipo</th>
                    <th class="px-4 py-3">Insumo / Pintura</th>
                    <th class="px-4 py-3 text-right">Cantidad</th>
                    <th class="px-4 py-3">Vehículo / Tarea</th>
                    <th class="px-4 py-3 text-right">Costo Total</th>
                    <th class="px-4 py-3 text-center">Respaldo Boleta</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60 font-sans">
                  @for (m of movimientosFiltrados(); track m.id) {
                    <tr
                      [attr.data-focus-ref]="m.id"
                      [ngClass]="
                        state.focusedReferenciaId() === m.id
                          ? 'bg-cyan-950/35 ring-1 ring-inset ring-cyan-400'
                          : 'hover:bg-slate-800/40'
                      "
                      class="transition"
                    >
                      <td class="px-4 py-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {{ state.formatFechaHora(m.fecha) }}
                      </td>
                      <td class="px-4 py-3">
                        @if (m.tipo === 'ENTRADA_STOCK') {
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <i class="ri-arrow-down-line"></i>
                            <span>Entrada</span>
                          </span>
                        } @else if (m.tipo === 'SALIDA_POR_TAREA') {
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <i class="ri-arrow-up-line"></i>
                            <span>Consumo Tarea</span>
                          </span>
                        } @else {
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/35">
                            <i class="ri-palette-line"></i>
                            <span>Pintura Colorista</span>
                          </span>
                        }
                      </td>
                      <td class="px-4 py-3 font-semibold text-white">
                        {{ m.insumoNombre }}
                      </td>
                      <td class="px-4 py-3 text-right font-mono font-bold text-white whitespace-nowrap">
                        {{ m.cantidad }} {{ m.unidad }}
                      </td>
                      <td class="px-4 py-3 text-slate-300 text-xs">
                        @if (m.vehiculoReferencia) {
                          <div class="font-medium text-slate-200">{{ m.vehiculoReferencia }}</div>
                          @if (m.tareaReferencia) {
                            <div class="text-[11px] text-slate-400">{{ m.tareaReferencia }}</div>
                          }
                        } @else {
                          <span class="text-slate-400">{{ m.tareaReferencia || 'Stock General' }}</span>
                        }
                      </td>
                      <td class="px-4 py-3 text-right font-mono font-semibold text-emerald-400 whitespace-nowrap">
                        {{ state.formatMoney(m.costoTotalUsd) }}
                      </td>
                      <td class="px-4 py-3 text-center">
                        @if (m.fotoFacturaWebp) {
                          <button
                            type="button"
                            (click)="
                              abrirLightbox(
                                state.resolveMediaUrl(m.fotoFacturaWebp),
                                'Boleta Colorista: ' + m.insumoNombre,
                                m.descripcionFotoFactura || 'Comprobante de compra de pintura'
                              )
                            "
                            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-950/60 text-indigo-300 hover:text-white transition text-[11px] border border-slate-700 hover:border-indigo-400 cursor-pointer"
                            [title]="m.descripcionFotoFactura || 'Ampliar boleta'"
                          >
                            <img
                              [src]="state.resolveMediaUrl(m.fotoFacturaWebp)"
                              alt="Boleta colorista"
                              class="w-7 h-7 rounded object-cover border border-slate-600"
                            />
                            <span>Ver Boleta</span>
                          </button>
                        } @else {
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 text-[10px] font-medium">
                            Consumo interno OT
                          </span>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="7" class="px-4 py-10 text-center text-slate-500">
                        No hay movimientos registrados para el filtro seleccionado.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }

      <!-- Auditoría Inmutable del Almacén -->
      <app-audit-history-panel defaultModulo="ALMACEN_INSUMOS"></app-audit-history-panel>

      <!-- Lightbox boleta de colorista -->
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
export class AlmacenComponent {
  state = inject(AppStateService);

  feedbackMsg = signal('');
  errorMsg = signal('');
  vistaTab = signal<'catalogo' | 'movimientos'>('catalogo');
  soloBajoStock = signal(false);
  filtroMovimiento = signal<FiltroMovimientos>('TODOS');
  busquedaTexto = signal<string>('');

  mostrarCrearInsumo = signal(false);
  creandoInsumo = signal(false);
  editandoInsumoId = signal<string | null>(null);
  guardandoEdicion = signal(false);

  movimientoActivo = signal<TipoMovimientoAlmacen | null>(null);
  comprimiendoFoto = signal(false);
  procesando = signal(false);
  previewBoletaUrl = signal('');
  compresionBoletaInfo = signal('');
  lightbox = signal<LightboxBoleta | null>(null);

  unidadesCatalogo = [
    'HOJAS',
    'LITRO',
    'LITROS',
    'GALON',
    'KILOS',
    'LATA',
    'KIT',
    'CAJA',
    'PACK',
    'TUBO',
    'BIDON',
    'ROLLO',
    'BOTELLA',
    'CARRETE',
    'UNIDADES',
  ];

  nuevoInsumo = {
    nombre: '',
    unidadMedida: 'LATA',
    stockActual: 0,
    stockMinimoAlerta: 5,
    costoUnitarioUsd: 0,
  };

  editInsumoForm = {
    nombre: '',
    unidadMedida: '',
    stockActual: 0,
    stockMinimoAlerta: 0,
    costoUnitarioUsd: 0,
    motivoEdicion: '',
  };

  movForm = {
    insumoId: '',
    insumoNombre: '',
    cantidad: 1,
    unidad: 'LATA',
    vehiculoId: '',
    vehiculoReferencia: '',
    tareaReferencia: '',
    costoTotalUsd: 0,
    descripcionFotoFactura: '',
  };

  private archivoFacturaWebp: File | null = null;

  constructor() {
    effect(() => {
      const sub = this.state.focusedSubTab();
      const fRef = this.state.focusedReferenciaId();
      const fVeh = this.state.focusedVehiculoId();

      if (sub === 'catalogo' || sub === 'movimientos') {
        this.vistaTab.set(sub);
        this.soloBajoStock.set(false);
        this.filtroMovimiento.set('TODOS');
        this.busquedaTexto.set('');
        if (!fRef) return;
      }

      if (fRef) {
        this.soloBajoStock.set(false);
        this.filtroMovimiento.set('TODOS');
        this.busquedaTexto.set('');
        if (this.state.insumos().some((i) => i.id === fRef)) {
          this.vistaTab.set('catalogo');
        } else if (this.state.movimientosInsumo().some((m) => m.id === fRef)) {
          this.vistaTab.set('movimientos');
        }
      } else if (fVeh) {
        const v = this.state.vehiculos().find((x) => x.id === fVeh);
        if (v) {
          this.vistaTab.set('movimientos');
          this.filtroMovimiento.set('TODOS');
          this.busquedaTexto.set(v.vinChasis || v.marca);
        }
      }
    });
  }

  toNum(v: unknown): number {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  }

  esStockBajo(ins: any): boolean {
    return this.toNum(ins.stockActual) <= this.toNum(ins.stockMinimoAlerta);
  }

  resumenKpis = computed(() => {
    let bajoStock = 0;
    let valorInventarioUsd = 0;
    for (const i of this.state.insumos()) {
      if (this.esStockBajo(i)) bajoStock += 1;
      valorInventarioUsd += this.toNum(i.stockActual) * this.toNum(i.costoUnitarioUsd);
    }

    let salidasCount = 0;
    let totalSalidasUsd = 0;
    let comprasColorista = 0;
    let totalPinturaUsd = 0;

    for (const m of this.state.movimientosInsumo()) {
      if (m.tipo === 'SALIDA_POR_TAREA') {
        salidasCount += 1;
        totalSalidasUsd += this.toNum(m.costoTotalUsd);
      } else if (m.tipo === 'COMPRA_PINTURA_COLORISTA') {
        comprasColorista += 1;
        totalPinturaUsd += this.toNum(m.costoTotalUsd);
      }
    }

    return {
      bajoStock,
      valorInventarioUsd: Math.round(valorInventarioUsd * 100) / 100,
      salidasCount,
      totalSalidasUsd: Math.round(totalSalidasUsd * 100) / 100,
      comprasColorista,
      totalPinturaUsd: Math.round(totalPinturaUsd * 100) / 100,
    };
  });

  insumosFiltrados = computed(() => {
    const q = this.busquedaTexto().trim().toLowerCase();
    const bajo = this.soloBajoStock();
    return this.state.insumos().filter((i) => {
      if (bajo && !this.esStockBajo(i)) return false;
      if (!q) return true;
      return `${i.nombre} ${i.unidadMedida}`.toLowerCase().includes(q);
    });
  });

  movimientosFiltrados = computed(() => {
    const f = this.filtroMovimiento();
    const q = this.busquedaTexto().trim().toLowerCase();
    return this.state.movimientosInsumo().filter((m) => {
      if (f !== 'TODOS' && m.tipo !== f) return false;
      if (!q) return true;
      const texto = `${m.insumoNombre} ${m.vehiculoReferencia || ''} ${m.tareaReferencia || ''} ${m.descripcionFotoFactura || ''}`.toLowerCase();
      return texto.includes(q);
    });
  });

  insumoSeleccionado() {
    if (!this.movForm.insumoId) return null;
    return this.state.insumos().find((i) => i.id === this.movForm.insumoId) || null;
  }

  vehiculoMovimientoSeleccionado() {
    if (!this.movForm.vehiculoId) return null;
    return this.state.vehiculos().find((v) => v.id === this.movForm.vehiculoId) || null;
  }

  aplicarKpiCatalogo(bajoStock: boolean) {
    this.vistaTab.set('catalogo');
    this.soloBajoStock.set(bajoStock);
  }

  aplicarKpiMovimientos(filtro: FiltroMovimientos) {
    this.vistaTab.set('movimientos');
    this.filtroMovimiento.set(filtro);
  }

  limpiarFiltros() {
    this.soloBajoStock.set(false);
    this.filtroMovimiento.set('TODOS');
    this.busquedaTexto.set('');
    this.state.clearNotificationFocus();
  }

  toggleCrearInsumo() {
    this.mostrarCrearInsumo.set(!this.mostrarCrearInsumo());
    this.errorMsg.set('');
  }

  guardarNuevoInsumo() {
    this.errorMsg.set('');
    if (!this.nuevoInsumo.nombre || this.nuevoInsumo.nombre.trim().length < 3) {
      this.errorMsg.set('Indica un nombre descriptivo para el insumo.');
      return;
    }
    this.creandoInsumo.set(true);
    const nombreGuardado = this.nuevoInsumo.nombre.trim();
    this.state.crearInsumoAlmacen(
      {
        nombre: nombreGuardado,
        unidadMedida: this.nuevoInsumo.unidadMedida,
        stockActual: this.toNum(this.nuevoInsumo.stockActual),
        stockMinimoAlerta: this.toNum(this.nuevoInsumo.stockMinimoAlerta),
        costoUnitarioUsd: this.toNum(this.nuevoInsumo.costoUnitarioUsd),
      },
      () => {
        this.creandoInsumo.set(false);
        this.feedbackMsg.set(`Insumo "${nombreGuardado}" dado de alta y auditado en el almacén.`);
        this.nuevoInsumo = {
          nombre: '',
          unidadMedida: 'LATA',
          stockActual: 0,
          stockMinimoAlerta: 5,
          costoUnitarioUsd: 0,
        };
        this.mostrarCrearInsumo.set(false);
      },
      (err) => {
        this.creandoInsumo.set(false);
        this.errorMsg.set(err);
      },
    );
  }

  abrirEdicionInsumo(ins: any) {
    if (this.editandoInsumoId() === ins.id) {
      this.editandoInsumoId.set(null);
      return;
    }
    this.editInsumoForm = {
      nombre: ins.nombre || '',
      unidadMedida: ins.unidadMedida || 'UNIDADES',
      stockActual: this.toNum(ins.stockActual),
      stockMinimoAlerta: this.toNum(ins.stockMinimoAlerta),
      costoUnitarioUsd: this.toNum(ins.costoUnitarioUsd),
      motivoEdicion: '',
    };
    this.editandoInsumoId.set(ins.id);
    this.errorMsg.set('');
  }

  guardarEdicionInsumo() {
    const id = this.editandoInsumoId();
    if (!id) return;
    if (this.editInsumoForm.nombre.trim().length < 3) {
      this.errorMsg.set('El nombre del insumo debe tener al menos 3 caracteres.');
      return;
    }
    if (this.editInsumoForm.motivoEdicion.trim().length < 4) {
      this.errorMsg.set('Ingresa el motivo obligatorio de edición/ajuste (mínimo 4 caracteres).');
      return;
    }

    this.guardandoEdicion.set(true);
    this.errorMsg.set('');
    this.state.editarInsumoAlmacen(
      id,
      {
        nombre: this.editInsumoForm.nombre.trim(),
        unidadMedida: this.editInsumoForm.unidadMedida.trim(),
        stockActual: this.toNum(this.editInsumoForm.stockActual),
        stockMinimoAlerta: this.toNum(this.editInsumoForm.stockMinimoAlerta),
        costoUnitarioUsd: this.toNum(this.editInsumoForm.costoUnitarioUsd),
        motivoEdicion: this.editInsumoForm.motivoEdicion.trim(),
      },
      () => {
        this.guardandoEdicion.set(false);
        this.editandoInsumoId.set(null);
        this.feedbackMsg.set('Insumo actualizado y registrado en el historial.');
      },
      (err) => {
        this.guardandoEdicion.set(false);
        this.errorMsg.set(err);
      },
    );
  }

  abrirModalMovimiento(tipo: TipoMovimientoAlmacen) {
    this.errorMsg.set('');
    this.feedbackMsg.set('');
    this.archivoFacturaWebp = null;
    this.previewBoletaUrl.set('');
    this.compresionBoletaInfo.set('');
    this.movForm = {
      insumoId: '',
      insumoNombre: '',
      cantidad: 1,
      unidad: tipo === 'COMPRA_PINTURA_COLORISTA' ? 'LITROS' : 'LATA',
      vehiculoId: '',
      vehiculoReferencia: '',
      tareaReferencia: '',
      costoTotalUsd: 0,
      descripcionFotoFactura: '',
    };
    this.movimientoActivo.set(tipo);
  }

  prepararMovimientoRapido(insumo: any, tipo: 'ENTRADA_STOCK' | 'SALIDA_POR_TAREA') {
    this.abrirModalMovimiento(tipo);
    this.movForm.insumoId = insumo.id;
    this.movForm.insumoNombre = insumo.nombre;
    this.movForm.unidad = insumo.unidadMedida;
  }

  cerrarMovimiento() {
    this.revocarPreviewBoleta();
    this.movimientoActivo.set(null);
    this.archivoFacturaWebp = null;
    this.compresionBoletaInfo.set('');
  }

  private revocarPreviewBoleta() {
    const url = this.previewBoletaUrl();
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
    this.previewBoletaUrl.set('');
  }

  onVehiculoMovimientoChange(vehiculoId: string) {
    const veh = this.state.vehiculos().find((v) => v.id === vehiculoId);
    this.movForm.vehiculoReferencia = veh
      ? `${veh.marca} ${veh.modelo} (${veh.vinChasis})`
      : '';
    this.movForm.tareaReferencia = '';
  }

  async alSeleccionarFactura(event: Event, input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;

    this.comprimiendoFoto.set(true);
    this.errorMsg.set('');
    try {
      const res = await comprimirImagenNavegadorWebp(file, 1400, 0.82);
      this.revocarPreviewBoleta();
      this.archivoFacturaWebp = res.file;
      this.previewBoletaUrl.set(res.previewUrl);
      this.compresionBoletaInfo.set('Fotografía de boleta lista para guardar');
      input.value = '';
    } catch (err: any) {
      this.errorMsg.set(err?.message || 'No se pudo procesar o comprimir la imagen de la boleta.');
      input.value = '';
    } finally {
      this.comprimiendoFoto.set(false);
    }
  }

  limpiarBoletaSeleccionada(input: HTMLInputElement) {
    this.revocarPreviewBoleta();
    this.archivoFacturaWebp = null;
    this.compresionBoletaInfo.set('');
    input.value = '';
  }

  confirmarMovimiento() {
    const tipo = this.movimientoActivo();
    if (!tipo) return;
    this.errorMsg.set('');

    if (this.toNum(this.movForm.cantidad) <= 0) {
      this.errorMsg.set('La cantidad debe ser mayor a 0.');
      return;
    }

    if (tipo === 'COMPRA_PINTURA_COLORISTA') {
      if (!this.movForm.vehiculoId || !this.movForm.vehiculoReferencia) {
        this.errorMsg.set('Selecciona el vehículo destinatario de la pintura.');
        return;
      }
      if (!this.movForm.insumoNombre || this.movForm.insumoNombre.trim().length < 3) {
        this.errorMsg.set('Indica la descripción o código de la pintura.');
        return;
      }
      if (this.toNum(this.movForm.costoTotalUsd) <= 0) {
        this.errorMsg.set('Indica el costo total de la factura de compra.');
        return;
      }
      if (!this.archivoFacturaWebp) {
        this.errorMsg.set('Adjunta la fotografía de la boleta o factura del colorista.');
        return;
      }
      if (!this.movForm.descripcionFotoFactura || this.movForm.descripcionFotoFactura.trim().length < 5) {
        this.errorMsg.set('Escribe una breve descripción del comprobante de la boleta.');
        return;
      }

      this.procesando.set(true);
      this.state.subirEvidenciaConDetalle(
        this.archivoFacturaWebp,
        {
          moduloOrigen: 'FACTURA_INSUMO_COLORISTA',
          referenciaId: this.movForm.vehiculoId,
          vehiculoReferencia: this.movForm.vehiculoReferencia,
          tituloDetalle: `Boleta Colorista: ${this.movForm.insumoNombre.trim()}`,
          descripcionBreve: this.movForm.descripcionFotoFactura.trim(),
          skipBootstrapReload: true,
        },
        (ev) => {
          this.state.registrarMovimientoAlmacen(
            {
              tipo: 'COMPRA_PINTURA_COLORISTA',
              insumoNombre: this.movForm.insumoNombre.trim(),
              cantidad: this.toNum(this.movForm.cantidad),
              unidad: this.movForm.unidad,
              vehiculoId: this.movForm.vehiculoId,
              vehiculoReferencia: this.movForm.vehiculoReferencia,
              tareaReferencia: this.movForm.tareaReferencia.trim() || undefined,
              costoTotalUsd: this.toNum(this.movForm.costoTotalUsd),
              fotoFacturaUrl: ev.archivoWebpUrl,
              descripcionFotoFactura: this.movForm.descripcionFotoFactura.trim(),
            },
            () => {
              this.procesando.set(false);
              this.cerrarMovimiento();
              this.vistaTab.set('movimientos');
              this.feedbackMsg.set(
                'Compra de pintura registrada con boleta de respaldo e imputada al vehículo.',
              );
            },
            (err) => {
              this.procesando.set(false);
              this.errorMsg.set(err);
            },
          );
        },
        (err) => {
          this.procesando.set(false);
          this.errorMsg.set(err);
        },
      );
      return;
    }

    // ENTRADA o SALIDA regular
    const insumoSel = this.insumoSeleccionado();
    if (!this.movForm.insumoId || !insumoSel) {
      this.errorMsg.set('Selecciona un insumo de la lista del almacén.');
      return;
    }

    if (tipo === 'SALIDA_POR_TAREA') {
      if (!this.movForm.vehiculoId || !this.movForm.vehiculoReferencia) {
        this.errorMsg.set('Indica el vehículo que consume este insumo.');
        return;
      }
      if (!this.movForm.tareaReferencia || this.movForm.tareaReferencia.trim().length < 3) {
        this.errorMsg.set('Indica o selecciona la tarea de la OT que consume el insumo.');
        return;
      }
      if (this.toNum(this.movForm.cantidad) > this.toNum(insumoSel.stockActual)) {
        this.errorMsg.set(
          `Stock insuficiente de ${insumoSel.nombre}: disponible ${insumoSel.stockActual} ${insumoSel.unidadMedida}.`,
        );
        return;
      }
    }

    this.procesando.set(true);
    this.state.registrarMovimientoAlmacen(
      {
        tipo,
        insumoId: this.movForm.insumoId,
        cantidad: this.toNum(this.movForm.cantidad),
        vehiculoId: this.movForm.vehiculoId || undefined,
        vehiculoReferencia: this.movForm.vehiculoReferencia || undefined,
        tareaReferencia: this.movForm.tareaReferencia.trim() || undefined,
        costoTotalUsd: this.toNum(this.movForm.costoTotalUsd),
      },
      () => {
        this.procesando.set(false);
        this.cerrarMovimiento();
        this.feedbackMsg.set(
          tipo === 'ENTRADA_STOCK'
            ? 'Entrada al stock registrada y auditada en el historial.'
            : 'Consumo por auto/tarea descontado del stock y auditado.',
        );
      },
      (err) => {
        this.procesando.set(false);
        this.errorMsg.set(err);
      },
    );
  }

  abrirLightbox(url: string, titulo: string, descripcion: string) {
    this.lightbox.set({ url, titulo, descripcion });
  }
}
