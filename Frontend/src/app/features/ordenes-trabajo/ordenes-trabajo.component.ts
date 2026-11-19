import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../core/services/app-state.service';
import {
  ESPECIALIDADES_POR_TIPO_TAREA,
  ETIQUETA_TIPO_TAREA,
} from '../../core/models/system.models';
import { comprimirImagenNavegadorWebp } from '../../core/utils/webp-compressor';
import { AuditHistoryPanelComponent } from '../../shared/components/audit-history-panel/audit-history-panel.component';

type TipoPanel = 'completar' | 'reabrir' | 'prorroga' | 'multa' | 'reasignar';
type FiltroOt = 'TODOS' | 'EN_PROCESO' | 'ATRASO' | 'MASILLA' | 'FINALIZADOS';

interface LightboxEntrega {
  url: string;
  titulo: string;
  descripcion: string;
}

function fechaOffsetIso(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-ordenes-trabajo',
  standalone: true,
  imports: [CommonModule, FormsModule, AuditHistoryPanelComponent],
  template: `
    <div class="space-y-6">
      <!-- Encabezado -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div class="space-y-1 max-w-3xl">
          <div class="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
            <i class="ri-tools-line text-sm"></i>
            <span>Órdenes de Trabajo, Prórrogas, Multas y Entrega Final</span>
          </div>
          <h1 class="text-lg sm:text-xl font-bold text-white">
            Seguimiento Operativo, Plazos, Control de Masilla y Fotos de Entrega
          </h1>
          <p class="text-xs text-slate-400">
            Asignación de tareas a especialistas, control de avance, calidad y entrega final.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            [disabled]="revisandoPlazos()"
            (click)="revisarPlazos()"
            class="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-60 border border-slate-700 text-slate-200 font-semibold flex items-center gap-2 cursor-pointer"
          >
            <i [class]="revisandoPlazos() ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'"></i>
            <span>{{ revisandoPlazos() ? 'Revisando...' : 'Revisar plazos ahora' }}</span>
          </button>
          <button
            type="button"
            (click)="errorMsg.set(''); mostrarNuevaTarea.set(true)"
            class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            <i class="ri-add-line"></i>
            <span>Agregar tarea a OT</span>
          </button>
        </div>
      </div>

      <!-- KPIs interactivos -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
        <button
          type="button"
          (click)="filtroEstado.set('TODOS')"
          [ngClass]="filtroEstado() === 'TODOS' ? 'border-blue-500 bg-blue-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
          class="p-3.5 rounded-xl border text-left transition cursor-pointer"
        >
          <div class="text-[11px] text-slate-400 font-semibold">Tareas totales</div>
          <div class="text-2xl font-black text-white font-mono mt-1">{{ resumenKpis().totalTareas }}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">{{ resumenKpis().completadas }} completadas</div>
        </button>

        <button
          type="button"
          (click)="filtroEstado.set('EN_PROCESO')"
          [ngClass]="filtroEstado() === 'EN_PROCESO' ? 'border-cyan-400 bg-cyan-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
          class="p-3.5 rounded-xl border text-left transition cursor-pointer"
        >
          <div class="text-[11px] text-cyan-300 font-semibold">Unidades en proceso</div>
          <div class="text-2xl font-black text-cyan-300 font-mono mt-1">{{ resumenKpis().enProceso }}</div>
        </button>

        <button
          type="button"
          (click)="filtroEstado.set('ATRASO')"
          [ngClass]="filtroEstado() === 'ATRASO' ? 'border-rose-400 bg-rose-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
          class="p-3.5 rounded-xl border text-left transition cursor-pointer"
        >
          <div class="text-[11px] text-rose-400 font-semibold">Tareas con atraso</div>
          <div class="text-2xl font-black text-rose-400 font-mono mt-1">{{ state.tareasAtrasadasCount() }}</div>
        </button>

        <button
          type="button"
          (click)="filtroEstado.set('MASILLA')"
          [ngClass]="filtroEstado() === 'MASILLA' ? 'border-amber-400 bg-amber-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
          class="p-3.5 rounded-xl border text-left transition cursor-pointer"
        >
          <div class="text-[11px] text-amber-300 font-semibold">Exceso de masilla</div>
          <div class="text-2xl font-black text-amber-300 font-mono mt-1">{{ resumenKpis().excesoMasilla }}</div>
        </button>

        <button
          type="button"
          (click)="filtroEstado.set('FINALIZADOS')"
          [ngClass]="filtroEstado() === 'FINALIZADOS' ? 'border-emerald-400 bg-emerald-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
          class="p-3.5 rounded-xl border text-left transition cursor-pointer col-span-2 sm:col-span-1"
        >
          <div class="text-[11px] text-emerald-400 font-semibold">Al 100% / Finalizados</div>
          <div class="text-lg font-black text-emerald-400 font-mono mt-1">{{ resumenKpis().finalizados }} ({{ state.formatMoney(resumenKpis().totalLiquido) }})</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Pago líquido total</div>
        </button>
      </div>

      <!-- Buscador y vehículos sin tareas -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 text-xs">
        <div class="relative flex-1 max-w-md">
          <i class="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input
            type="text"
            [ngModel]="busquedaTexto()"
            (ngModelChange)="busquedaTexto.set($event)"
            placeholder="Buscar vehículo por marca, modelo, VIN, lote o técnico..."
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
          <span>Mostrando <strong class="text-white">{{ vehiculosFiltradosOt().length }}</strong> orden(es) de trabajo</span>
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

      @if (vehiculosSinOt().length > 0) {
        <div class="p-4 rounded-xl bg-amber-950/20 border border-amber-500/35 space-y-2 text-xs">
          <div class="font-bold text-amber-300 flex items-center gap-2">
            <i class="ri-car-line text-base"></i>
            <span>Unidades sin tareas registradas en OT ({{ vehiculosSinOt().length }})</span>
          </div>
          <div class="flex flex-wrap gap-2">
            @for (vs of vehiculosSinOt(); track vs.id) {
              <button
                type="button"
                (click)="iniciarNuevaTareaPara(vs.id)"
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

      <!-- Modal de nueva tarea -->
      @if (mostrarNuevaTarea()) {
        <div
          (click)="mostrarNuevaTarea.set(false)"
          class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            (click)="$event.stopPropagation()"
            class="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden text-xs shadow-2xl"
          >
            <div class="px-5 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 shrink-0">
              <div>
                <div class="font-bold text-sm text-white flex items-center gap-2">
                  <i class="ri-task-line text-blue-400 text-base"></i>
                  <span>Nueva tarea de orden de trabajo</span>
                </div>
                <span class="text-[11px] text-slate-400">Los técnicos bloqueados quedan automáticamente excluidos.</span>
              </div>
              <button
                type="button"
                (click)="mostrarNuevaTarea.set(false)"
                class="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <i class="ri-close-line text-lg"></i>
              </button>
            </div>

            <div class="p-5 space-y-4 overflow-y-auto flex-1">

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="lg:col-span-2">
              <label class="block text-slate-300 font-semibold mb-1">Vehículo *</label>
              <select
                [(ngModel)]="nt.vehiculoId"
                (ngModelChange)="nt.tecnicoAsignadoId = ''"
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
              >
                <option value="">Selecciona un vehículo</option>
                @for (v of state.vehiculos(); track v.id) {
                  <option [value]="v.id">{{ v.marca }} {{ v.modelo }} ({{ v.placaOLote }}) — {{ v.vinChasis }}</option>
                }
              </select>
            </div>
            <div class="lg:col-span-2">
              <label class="block text-slate-300 font-semibold mb-1">Descripción de la tarea *</label>
              <input
                type="text"
                [(ngModel)]="nt.titulo"
                placeholder="Ej: Enderezado de puerta trasera izquierda"
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
              />
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">Tipo *</label>
              <select
                [(ngModel)]="nt.tipo"
                (ngModelChange)="nt.tecnicoAsignadoId = ''"
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
              >
                @for (t of tiposTarea; track t) {
                  <option [value]="t">{{ etiquetaTipo(t) }}</option>
                }
              </select>
            </div>
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Técnico responsable *</label>
              <select
                [(ngModel)]="nt.tecnicoAsignadoId"
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
              >
                <option value="">Selecciona</option>
                @for (t of tecnicosParaTipo(nt.tipo, nt.vehiculoId); track t.id) {
                  <option [value]="t.id">
                    {{ t.nombre }} ({{ t.promedioEstrellas }}★ • {{ t.modalidad === 'SUELDO_FIJO' ? 'Fijo' : 'Por pieza' }})
                  </option>
                }
              </select>
            </div>
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Pago acordado (USD)</label>
              <input
                type="number"
                min="0"
                step="1"
                [(ngModel)]="nt.pagoAcordadoUsd"
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 font-mono"
              />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Inicio *</label>
                <input
                  type="date"
                  [(ngModel)]="nt.fechaInicio"
                  class="w-full px-2 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Límite *</label>
                <input
                  type="date"
                  [(ngModel)]="nt.fechaLimite"
                  class="w-full px-2 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
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
                (click)="mostrarNuevaTarea.set(false)"
                class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                [disabled]="creandoTarea()"
                (click)="crearTarea()"
                class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold flex items-center gap-2 cursor-pointer"
              >
                <i [class]="creandoTarea() ? 'ri-loader-4-line animate-spin' : 'ri-save-3-line'"></i>
                <span>{{ creandoTarea() ? 'Guardando...' : 'Guardar tarea' }}</span>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Órdenes de trabajo por vehículo -->
      @for (v of vehiculosFiltradosOt(); track v.id) {
        <div
          [attr.data-focus-vehiculo]="v.id"
          [ngClass]="
            state.focusedVehiculoId() === v.id
              ? 'ring-2 ring-cyan-400 border-cyan-500/70'
              : 'border-slate-800'
          "
          class="bg-slate-900 border rounded-2xl p-5 space-y-4 transition shadow-lg"
        >
          <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="font-bold text-base text-white">{{ v.marca }} {{ v.modelo }} ({{ v.anio }})</h3>
                <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">{{ v.prioridadCola }}</span>
                <span
                  [ngClass]="
                    v.estado === 'FINALIZADO'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                  "
                  class="px-2.5 py-0.5 rounded border text-[11px] font-semibold"
                >
                  {{ v.estado }}
                </span>
              </div>
              <div class="text-xs text-slate-400 font-mono">
                {{ v.placaOLote }} • VIN: {{ v.vinChasis }} • {{ v.nombreCliente }}
              </div>
              <div class="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                <button
                  type="button"
                  (click)="irAModulo(v.id, 'cotizacion')"
                  class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Cotización
                </button>
                <button
                  type="button"
                  (click)="irAModulo(v.id, 'repuestos')"
                  class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Repuestos ({{ (v.repuestos || []).length }})
                </button>
                <button
                  type="button"
                  (click)="iniciarNuevaTareaPara(v.id)"
                  class="px-2.5 py-1 rounded-lg bg-blue-950/60 hover:bg-blue-900 border border-blue-500/40 text-blue-300 font-semibold cursor-pointer"
                >
                  + Agregar tarea
                </button>
                @if (state.puedeVerReportes() && v.estado === 'FINALIZADO') {
                  <button
                    type="button"
                    (click)="irAModulo(v.id, 'reportes')"
                    class="px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-bold cursor-pointer"
                  >
                    Ver Informe PDF →
                  </button>
                }
              </div>
            </div>

            <div class="w-full sm:w-72 bg-slate-950 border border-slate-800 rounded-xl p-3">
              <div class="flex justify-between text-xs font-semibold mb-1.5">
                <span class="text-slate-300">Avance real</span>
                <span class="text-emerald-400 font-mono font-bold">{{ progreso(v) }}%</span>
              </div>
              <div class="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div class="bg-emerald-500 h-full transition-all duration-300" [style.width.%]="progreso(v)"></div>
              </div>
              <div class="text-[11px] text-slate-400 mt-1.5 flex items-center justify-between">
                <span>{{ completadas(v) }} de {{ (v.tareasOt || []).length }} tareas</span>
                <span>Líquido OT: <strong class="text-amber-300 font-mono">{{ state.formatMoney(liquidoVehiculo(v)) }}</strong></span>
              </div>
            </div>
          </div>

          <!-- Tareas de la OT -->
          <div class="space-y-3 text-xs">
            @for (t of tareasOrdenadas(v); track t.id) {
              <div
                [attr.data-focus-ref]="t.id"
                [ngClass]="
                  state.focusedReferenciaId() === t.id
                    ? 'ring-2 ring-cyan-400 bg-cyan-950/20 border-cyan-500/70'
                    : t.diasAtraso > 0 && !t.completada
                      ? 'bg-rose-950/20 border-rose-500/50'
                      : 'bg-slate-950 border-slate-800'
                "
                class="p-4 rounded-xl border space-y-3 transition"
              >
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="space-y-1 min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-bold text-white">{{ t.orden }}. {{ t.titulo }}</span>
                      <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold text-[10px]">
                        {{ etiquetaTipo(t.tipo) }}
                      </span>
                      @if (t.completada) {
                        <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold text-[10px] flex items-center gap-1">
                          <i class="ri-checkbox-circle-fill"></i>
                          <span>Completada @if (t.calificacionEstrellas) { ({{ t.calificacionEstrellas }}/5★) }</span>
                        </span>
                      }
                      @if (t.diasAtraso > 0 && !t.completada) {
                        <span class="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px]">
                          {{ t.diasAtraso }} día(s) de atraso
                        </span>
                      }
                      @if (t.diasProrrogaOtorgados > 0) {
                        <span class="px-2 py-0.5 rounded bg-blue-600 text-white font-semibold text-[10px]">
                          +{{ t.diasProrrogaOtorgados }} día(s) prórroga
                        </span>
                      }
                    </div>
                    <div class="text-slate-400">
                      Responsable: <strong class="text-slate-200">{{ t.tecnicoAsignadoNombre }}</strong>
                      @if (t.fechaInicio) {
                        <span> • Inicio: <strong class="text-slate-300">{{ t.fechaInicio }}</strong></span>
                      }
                      @if (t.fechaLimite) {
                        <span> • Límite: <strong class="text-slate-200">{{ t.fechaLimite }}</strong></span>
                      }
                      @if (t.completada && t.fechaCompletada) {
                        <span> • Cerrada: <strong class="text-emerald-300 font-mono">{{ state.formatFechaHora(t.fechaCompletada) }}</strong></span>
                      }
                    </div>
                    @if (t.motivoProrroga) {
                      <div class="text-blue-300 text-[11px]">Prórroga: {{ t.motivoProrroga }}</div>
                    }
                    @if (t.notaReasignacion) {
                      <div class="text-amber-300 text-[11px]">Reasignación: {{ t.notaReasignacion }}</div>
                    }
                    @if (t.controlCalidadMasilla) {
                      <div
                        [ngClass]="
                          t.controlCalidadMasilla === 'EXCESO_MASILLA'
                            ? 'text-rose-300 bg-rose-950/40 border border-rose-500/30 px-2.5 py-1 rounded-lg inline-block'
                            : 'text-emerald-300'
                        "
                        class="text-[11px] font-medium"
                      >
                        Control calidad masilla:
                        <strong>{{ t.controlCalidadMasilla === 'APROBADA' ? 'Aprobado (sin exceso)' : 'EXCESO DE MASILLA REPORTADO' }}</strong>
                        @if (t.observacionCalidad) {
                          <span> — {{ t.observacionCalidad }}</span>
                        }
                      </div>
                    }
                  </div>

                  <div class="text-right text-[11px] text-slate-400 space-y-0.5 shrink-0">
                    <div>Acordado: <strong class="text-white font-mono">{{ state.formatMoney(t.pagoAcordadoUsd) }}</strong></div>
                    @if (t.descuentoMultaUsd > 0) {
                      <div>Multa: <strong class="text-rose-400 font-mono">-{{ state.formatMoney(t.descuentoMultaUsd) }}</strong></div>
                    }
                    <div>Líquido: <strong class="text-emerald-400 font-mono">{{ state.formatMoney(t.pagoLiquidoFinalUsd) }}</strong></div>
                  </div>
                </div>

                <!-- Acciones -->
                <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                  @if (!t.completada) {
                    <button
                      type="button"
                      (click)="abrirPanel(t, 'completar')"
                      class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <i class="ri-check-line"></i><span>Completar</span>
                    </button>
                    <button
                      type="button"
                      (click)="abrirPanel(t, 'prorroga')"
                      class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <i class="ri-calendar-event-line"></i><span>Prórroga justificada</span>
                    </button>
                    <button
                      type="button"
                      [disabled]="!(t.pagoAcordadoUsd > 0)"
                      [title]="t.pagoAcordadoUsd > 0 ? 'Descontar mora del pago al contratista' : 'No aplica multa económica a personal de sueldo fijo ($0 por pieza)'"
                      (click)="abrirPanel(t, 'multa')"
                      class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-rose-300 font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <i class="ri-money-dollar-circle-line"></i><span>Aplicar multa</span>
                    </button>
                    <button
                      type="button"
                      (click)="abrirPanel(t, 'reasignar')"
                      class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <i class="ri-user-shared-line"></i><span>Reasignar técnico</span>
                    </button>
                  } @else {
                    <button
                      type="button"
                      (click)="abrirPanel(t, 'reabrir')"
                      class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <i class="ri-restart-line"></i><span>Reabrir tarea</span>
                    </button>
                  }
                </div>

                <!-- Panel contextual -->
                @if (panel()?.id === t.id) {
                  <div class="p-4 rounded-xl bg-slate-900 border border-slate-700 space-y-3">
                    @switch (panel()?.tipo) {
                      @case ('completar') {
                        <div class="font-bold text-white">Cerrar tarea y calificar al responsable</div>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label class="block text-slate-400 mb-1">Calificación (1 a 5) *</label>
                            <select [(ngModel)]="form.estrellas" class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white">
                              <option [ngValue]="5">5 ★ - Excelente</option>
                              <option [ngValue]="4">4 ★ - Bueno</option>
                              <option [ngValue]="3">3 ★ - Regular</option>
                              <option [ngValue]="2">2 ★ - Deficiente</option>
                              <option [ngValue]="1">1 ★ - Muy deficiente</option>
                            </select>
                          </div>
                          @if (t.tipo === 'PINTURA') {
                            <div>
                              <label class="block text-slate-400 mb-1">Control de masilla en chapería *</label>
                              <select [(ngModel)]="form.controlMasilla" class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white">
                                <option value="APROBADA">Aprobada: sin exceso de masilla</option>
                                <option value="EXCESO_MASILLA">Exceso de masilla detectado</option>
                              </select>
                            </div>
                            <div>
                              <label class="block text-slate-400 mb-1">Observación de calidad</label>
                              <input
                                type="text"
                                [(ngModel)]="form.obsCalidad"
                                placeholder="Obligatoria si hay exceso"
                                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                              />
                            </div>
                          }
                        </div>
                        <div class="flex justify-end gap-2">
                          <button type="button" (click)="panel.set(null)" class="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold cursor-pointer">
                            Cancelar
                          </button>
                          <button
                            type="button"
                            [disabled]="guardandoAccion()"
                            (click)="completar(t)"
                            class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <i [class]="guardandoAccion() ? 'ri-loader-4-line animate-spin' : 'ri-check-line'"></i>
                            <span>{{ guardandoAccion() ? 'Cerrando...' : 'Confirmar cierre' }}</span>
                          </button>
                        </div>
                      }
                      @case ('reabrir') {
                        <div class="font-bold text-white">Reabrir tarea completada (se revierte la calificación y queda auditado)</div>
                        <input
                          type="text"
                          [(ngModel)]="form.motivo"
                          placeholder="Motivo de la reapertura (mín. 4 caracteres) *"
                          class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                        />
                        <div class="flex justify-end gap-2">
                          <button type="button" (click)="panel.set(null)" class="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold cursor-pointer">
                            Cancelar
                          </button>
                          <button
                            type="button"
                            [disabled]="guardandoAccion()"
                            (click)="reabrir(t)"
                            class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold cursor-pointer"
                          >
                            {{ guardandoAccion() ? 'Reabriendo...' : 'Reabrir' }}
                          </button>
                        </div>
                      }
                      @case ('prorroga') {
                        <div class="font-bold text-white">Prórroga justificada (sin multa)</div>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label class="block text-slate-400 mb-1">Días adicionales *</label>
                            <input
                              type="number"
                              min="1"
                              max="30"
                              [(ngModel)]="form.prorrogaDias"
                              class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                            />
                          </div>
                          <div>
                            <label class="block text-slate-400 mb-1">Causa *</label>
                            <select [(ngModel)]="form.prorrogaCausa" class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white">
                              <option>Lluvia o clima</option>
                              <option>Falta de oxígeno o gas</option>
                              <option>Falta de pintura</option>
                              <option>Falta de repuesto</option>
                              <option>Otra causa justificada</option>
                            </select>
                          </div>
                          <div>
                            <label class="block text-slate-400 mb-1">Detalle *</label>
                            <input
                              type="text"
                              [(ngModel)]="form.prorrogaMotivo"
                              placeholder="Explica la situación"
                              class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                            />
                          </div>
                        </div>
                        <div class="flex justify-end gap-2">
                          <button type="button" (click)="panel.set(null)" class="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold cursor-pointer">
                            Cancelar
                          </button>
                          <button
                            type="button"
                            [disabled]="guardandoAccion()"
                            (click)="prorroga(t)"
                            class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold cursor-pointer"
                          >
                            {{ guardandoAccion() ? 'Aplicando...' : 'Otorgar prórroga' }}
                          </button>
                        </div>
                      }
                      @case ('multa') {
                        <div class="font-bold text-white">Aplicar multa por mora al contratista</div>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                          <div>
                            <label class="block text-slate-400 mb-1">Días de mora *</label>
                            <input
                              type="number"
                              min="1"
                              [(ngModel)]="form.multaDias"
                              class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                            />
                          </div>
                          <div class="sm:col-span-2">
                            <label class="block text-slate-400 mb-1">Observación / Nota contractual (opcional)</label>
                            <input
                              type="text"
                              [(ngModel)]="form.multaMotivo"
                              placeholder="Ej: Descuento acordado por retraso en tablero SRS"
                              class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                            />
                          </div>
                        </div>
                        <div class="text-slate-300">
                          Tarifa configurada: <strong class="font-mono">{{ state.formatMoney(state.configuracion().multaPorDiaRetrasoUsd) }}</strong>/día •
                          Descuento real (tope pago acordado):
                          <strong class="text-rose-400 font-mono">
                            -{{ state.formatMoney(calcularDescuentoMultaEstimado(t)) }}
                          </strong>
                        </div>
                        <div class="flex justify-end gap-2">
                          <button type="button" (click)="panel.set(null)" class="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold cursor-pointer">
                            Cancelar
                          </button>
                          <button
                            type="button"
                            [disabled]="guardandoAccion()"
                            (click)="multa(t)"
                            class="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold cursor-pointer"
                          >
                            {{ guardandoAccion() ? 'Aplicando...' : 'Aplicar multa' }}
                          </button>
                        </div>
                      }
                      @case ('reasignar') {
                        <div class="font-bold text-white">Reasignar a otro técnico compatible</div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label class="block text-slate-400 mb-1">Nuevo responsable *</label>
                            <select [(ngModel)]="form.nuevoTecnicoId" class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white">
                              <option value="">Selecciona otro especialista</option>
                              @for (tec of tecnicosReasignables(t, v.id); track tec.id) {
                                <option [value]="tec.id">{{ tec.nombre }} ({{ tec.promedioEstrellas }}★)</option>
                              }
                            </select>
                          </div>
                          <div>
                            <label class="block text-slate-400 mb-1">Motivo *</label>
                            <input
                              type="text"
                              [(ngModel)]="form.motivo"
                              placeholder="Ej: demora excesiva del anterior"
                              class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                            />
                          </div>
                        </div>
                        <div class="flex justify-end gap-2">
                          <button type="button" (click)="panel.set(null)" class="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold cursor-pointer">
                            Cancelar
                          </button>
                          <button
                            type="button"
                            [disabled]="guardandoAccion()"
                            (click)="reasignar(t)"
                            class="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold cursor-pointer"
                          >
                            {{ guardandoAccion() ? 'Reasignando...' : 'Reasignar' }}
                          </button>
                        </div>
                      }
                    }
                  </div>
                }
              </div>
            }
          </div>

          <!-- Evidencia Fotográfica de Entrega Final ("DESPUÉS" para Informe PDF) -->
          <div class="p-4 rounded-xl bg-slate-950 border border-emerald-500/25 space-y-3 text-xs">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div class="font-bold text-emerald-300 flex items-center gap-1.5">
                  <i class="ri-camera-3-line"></i>
                  <span>Fotografías de Entrega Final / Pulido ("DESPUÉS" para Informe PDF)</span>
                </div>
                <p class="text-[11px] text-slate-400">
                  Las fotos aquí adjuntadas aparecen automáticamente en la comparativa Antes/Después del Informe Final PDF.
                </p>
              </div>
              <button
                type="button"
                (click)="toggleUploadEntrega(v.id)"
                class="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-300 hover:text-white font-semibold transition cursor-pointer"
              >
                {{ entregaUploadVehiculoId() === v.id ? 'Cerrar subida' : '+ Subir Foto Entrega' }}
              </button>
            </div>

            @if (entregaUploadVehiculoId() === v.id) {
              <div class="p-3 rounded-xl bg-slate-900 border border-emerald-500/30 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label class="block text-slate-400 mb-1">Título / Detalle *</label>
                  <input
                    type="text"
                    [(ngModel)]="entregaTitulo"
                    placeholder="Ej: DESPUÉS: Acabado cabina y pulido espejo"
                    class="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label class="block text-slate-400 mb-1">Descripción Breve *</label>
                  <input
                    type="text"
                    [(ngModel)]="entregaDescripcion"
                    placeholder="Ej: Vehículo terminado y verificado bajo luz de inspección"
                    class="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label class="block text-slate-400 mb-1">Archivo de imagen *</label>
                  <input
                    type="file"
                    accept="image/*"
                    [disabled]="subiendoFotoEntrega()"
                    (change)="subirFotoEntrega($event, v)"
                    class="block w-full text-[11px] text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white cursor-pointer"
                  />
                </div>
              </div>
            }

            @if (fotosEntregaVehiculo(v).length > 0) {
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                @for (foto of fotosEntregaVehiculo(v); track foto.id) {
                  <button
                    type="button"
                    (click)="abrirLightbox(state.resolveMediaUrl(foto.archivoWebpUrl), foto.tituloDetalle, foto.descripcionBreve)"
                    class="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center gap-2.5 text-left transition cursor-pointer group"
                  >
                    <img
                      [src]="state.resolveMediaUrl(foto.archivoWebpUrl)"
                      [alt]="foto.tituloDetalle"
                      class="w-14 h-12 rounded-lg object-cover border border-slate-700 shrink-0"
                    />
                    <div class="min-w-0">
                      <div class="font-semibold text-white group-hover:text-emerald-300 truncate">{{ foto.tituloDetalle }}</div>
                      <div class="text-[11px] text-slate-400 truncate">{{ foto.descripcionBreve }}</div>
                      <div class="text-[10px] text-emerald-400 mt-0.5">
                        Entrega Final • {{ foto.creadoEn ? state.formatFechaHoraCorta(foto.creadoEn) : 'Informe PDF' }}
                      </div>
                    </div>
                  </button>
                }
              </div>
            } @else if (v.estado === 'FINALIZADO') {
              <div class="text-[11px] text-amber-300/90 italic">
                Unidad finalizada • Pendiente adjuntar registro fotográfico de entrega final.
              </div>
            } @else {
              <div class="text-[11px] text-slate-400 italic">
                Unidad en proceso • Las fotografías de entrega final se adjuntan al concluir la reparación.
              </div>
            }
          </div>
        </div>
      } @empty {
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-2 text-xs text-slate-400">
          <i class="ri-clipboard-line text-3xl text-slate-600"></i>
          <p class="text-sm font-bold text-slate-200">No hay órdenes de trabajo en este filtro</p>
          <p>
            Las tareas se crean automáticamente al aprobar una cotización en Verde, o puedes agregar una manualmente.
          </p>
        </div>
      }

      <!-- Auditoría Inmutable OT -->
      <app-audit-history-panel defaultModulo="ORDEN_TRABAJO"></app-audit-history-panel>

      <!-- Lightbox Entrega Final -->
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
export class OrdenesTrabajoComponent {
  state = inject(AppStateService);

  feedbackMsg = signal('');
  errorMsg = signal('');
  mostrarNuevaTarea = signal(false);
  filtroEstado = signal<FiltroOt>('TODOS');
  busquedaTexto = signal<string>('');

  panel = signal<{ id: string; tipo: TipoPanel } | null>(null);
  creandoTarea = signal(false);
  guardandoAccion = signal(false);
  revisandoPlazos = signal(false);
  entregaUploadVehiculoId = signal<string | null>(null);
  subiendoFotoEntrega = signal(false);
  lightbox = signal<LightboxEntrega | null>(null);

  entregaTitulo = '';
  entregaDescripcion = '';

  tiposTarea = ['CHAPERIA', 'PINTURA', 'MECANICA', 'SERVICIO_EXTERNO', 'CONTROL_FINAL'];

  nt = {
    vehiculoId: '',
    titulo: '',
    tipo: 'CHAPERIA',
    tecnicoAsignadoId: '',
    pagoAcordadoUsd: 0,
    fechaInicio: fechaOffsetIso(0),
    fechaLimite: fechaOffsetIso(5),
  };

  form = {
    estrellas: 5,
    controlMasilla: 'APROBADA' as 'APROBADA' | 'EXCESO_MASILLA',
    obsCalidad: '',
    motivo: '',
    prorrogaDias: 2,
    prorrogaCausa: 'Lluvia o clima',
    prorrogaMotivo: '',
    multaDias: 1,
    multaMotivo: '',
    nuevoTecnicoId: '',
  };

  constructor() {
    effect(() => {
      const fVehiculo = this.state.focusedVehiculoId();
      const fRef = this.state.focusedReferenciaId();
      if (!fVehiculo && !fRef) return;
      this.filtroEstado.set('TODOS');
      this.busquedaTexto.set('');
      this.mostrarNuevaTarea.set(false);
    });
  }

  etiquetaTipo(tipo: string): string {
    return ETIQUETA_TIPO_TAREA[tipo] || tipo;
  }

  private tecnicosOpuestosEnVehiculo(tipo: string, vehiculoId?: string): Set<string> {
    const bloqueados = new Set<string>();
    if (!vehiculoId || (tipo !== 'PINTURA' && tipo !== 'CHAPERIA')) return bloqueados;
    const opuesto = tipo === 'PINTURA' ? 'CHAPERIA' : 'PINTURA';
    const veh = this.state.vehiculos().find((v) => v.id === vehiculoId);
    for (const t of veh?.tareasOt || []) {
      if (t.tipo === opuesto && t.tecnicoAsignadoId) {
        bloqueados.add(t.tecnicoAsignadoId);
      }
    }
    return bloqueados;
  }

  tecnicosParaTipo(tipo: string, vehiculoId?: string): any[] {
    const permitidas = ESPECIALIDADES_POR_TIPO_TAREA[tipo] || [];
    const opuestos = this.tecnicosOpuestosEnVehiculo(tipo, vehiculoId);
    return this.state
      .tecnicos()
      .filter(
        (t) =>
          permitidas.includes(t.especialidad) &&
          !t.bloqueadoPorMalTrabajo &&
          !opuestos.has(t.id),
      );
  }

  tecnicosReasignables(tarea: any, vehiculoId: string): any[] {
    return this.tecnicosParaTipo(tarea.tipo, vehiculoId).filter(
      (tec) => tec.id !== tarea.tecnicoAsignadoId,
    );
  }

  resumenKpis = computed(() => {
    let totalTareas = 0;
    let completadas = 0;
    let excesoMasilla = 0;
    let totalLiquido = 0;
    let enProceso = 0;
    let finalizados = 0;

    for (const v of this.state.vehiculosFiltrados()) {
      const tareas = v.tareasOt || [];
      if (tareas.length === 0) continue;
      totalTareas += tareas.length;
      const hechas = tareas.filter((t: any) => t.completada).length;
      completadas += hechas;
      if (hechas === tareas.length) finalizados += 1;
      else enProceso += 1;

      for (const t of tareas) {
        totalLiquido += Number(t.pagoLiquidoFinalUsd || 0);
        if (t.controlCalidadMasilla === 'EXCESO_MASILLA') excesoMasilla += 1;
      }
    }
    return {
      totalTareas,
      completadas,
      excesoMasilla,
      totalLiquido: Math.round(totalLiquido * 100) / 100,
      enProceso,
      finalizados,
    };
  });

  vehiculosSinOt = computed(() =>
    this.state
      .vehiculosFiltrados()
      .filter(
        (v) =>
          !(v.tareasOt || []).length &&
          v.estado !== 'RETIRADO_SIN_REPARAR' &&
          v.estado !== 'FINALIZADO',
      ),
  );

  vehiculosFiltradosOt = computed(() => {
    const q = this.busquedaTexto().trim().toLowerCase();
    const filtro = this.filtroEstado();
    const fVeh = this.state.focusedVehiculoId();

    const list = this.state.vehiculosFiltrados().filter((v) => {
      const tareas = v.tareasOt || [];
      if (tareas.length === 0) return false;

      if (q) {
        const nombresTecnicos = tareas.map((t: any) => t.tecnicoAsignadoNombre || '').join(' ');
        const texto = `${v.marca} ${v.modelo} ${v.vinChasis} ${v.placaOLote} ${v.nombreCliente} ${nombresTecnicos}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }

      if (filtro === 'EN_PROCESO') {
        return tareas.some((t: any) => !t.completada);
      }
      if (filtro === 'ATRASO') {
        return tareas.some((t: any) => !t.completada && Number(t.diasAtraso || 0) > 0);
      }
      if (filtro === 'MASILLA') {
        return tareas.some((t: any) => t.controlCalidadMasilla === 'EXCESO_MASILLA');
      }
      if (filtro === 'FINALIZADOS') {
        return v.estado === 'FINALIZADO' || tareas.every((t: any) => t.completada);
      }
      return true;
    });

    if (!fVeh) return list;
    return [...list].sort((a, b) => (a.id === fVeh ? 0 : 1) - (b.id === fVeh ? 0 : 1));
  });

  limpiarFiltros() {
    this.filtroEstado.set('TODOS');
    this.busquedaTexto.set('');
    this.state.clearNotificationFocus();
  }

  iniciarNuevaTareaPara(vehiculoId: string) {
    this.nt = {
      vehiculoId,
      titulo: '',
      tipo: 'CHAPERIA',
      tecnicoAsignadoId: '',
      pagoAcordadoUsd: 0,
      fechaInicio: fechaOffsetIso(0),
      fechaLimite: fechaOffsetIso(5),
    };
    this.mostrarNuevaTarea.set(true);
    this.errorMsg.set('');
  }

  tareasOrdenadas(v: any): any[] {
    return [...(v.tareasOt || [])].sort((a, b) => a.orden - b.orden);
  }

  completadas(v: any): number {
    return (v.tareasOt || []).filter((t: any) => t.completada).length;
  }

  progreso(v: any): number {
    const total = (v.tareasOt || []).length;
    return total ? Math.round((this.completadas(v) / total) * 100) : 0;
  }

  liquidoVehiculo(v: any): number {
    return (v.tareasOt || []).reduce(
      (acc: number, t: any) => acc + Number(t.pagoLiquidoFinalUsd || 0),
      0,
    );
  }

  fotosEntregaVehiculo(v: any) {
    const vin = (v.vinChasis || '').toLowerCase();
    const marca = `${v.marca} ${v.modelo}`.toLowerCase();
    return this.state.evidenciasFotograficas().filter((ev) => {
      if (ev.moduloOrigen !== 'ENTREGA_FINAL') return false;
      if (ev.referenciaId === v.id) return true;
      const ref = (ev.vehiculoReferencia || '').toLowerCase();
      return Boolean(vin && ref.includes(vin)) || Boolean(marca && ref.includes(marca));
    });
  }

  toggleUploadEntrega(vehiculoId: string) {
    this.errorMsg.set('');
    if (this.entregaUploadVehiculoId() === vehiculoId) {
      this.entregaUploadVehiculoId.set(null);
      return;
    }
    this.entregaTitulo = 'DESPUÉS: Acabado final y pulido';
    this.entregaDescripcion = 'Unidad terminada y verificada bajo luz de inspección para entrega.';
    this.entregaUploadVehiculoId.set(vehiculoId);
  }

  async subirFotoEntrega(event: Event, vehiculo: any) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    if (this.entregaTitulo.trim().length < 3 || this.entregaDescripcion.trim().length < 5) {
      this.errorMsg.set(
        'Completa Título (mín. 3 chars) y Descripción Breve (mín. 5 chars) antes de subir la foto de entrega.',
      );
      input.value = '';
      return;
    }

    let file = input.files[0];
    let originalKb: number | undefined;
    this.errorMsg.set('');
    this.subiendoFotoEntrega.set(true);

    try {
      const comp = await comprimirImagenNavegadorWebp(file);
      file = comp.file;
      originalKb = comp.originalKb;
      if (comp.previewUrl.startsWith('blob:')) URL.revokeObjectURL(comp.previewUrl);
    } catch {
      // Fallback al servidor con Sharp
    }

    this.state.subirEvidenciaConDetalle(
      file,
      {
        moduloOrigen: 'ENTREGA_FINAL',
        referenciaId: vehiculo.id,
        vehiculoReferencia: `${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.vinChasis})`,
        tituloDetalle: this.entregaTitulo.trim(),
        descripcionBreve: this.entregaDescripcion.trim(),
        pesoOriginalClienteKb: originalKb,
      },
      (ev) => {
        this.subiendoFotoEntrega.set(false);
        this.entregaUploadVehiculoId.set(null);
        input.value = '';
        this.feedbackMsg.set(
          'Fotografía de entrega guardada y vinculada al Informe Final PDF.',
        );
      },
      (err) => {
        this.subiendoFotoEntrega.set(false);
        input.value = '';
        this.errorMsg.set(err);
      },
    );
  }

  calcularDescuentoMultaEstimado(t: any): number {
    const tarifa = Number(this.state.configuracion().multaPorDiaRetrasoUsd || 20);
    const dias = Math.max(0, Number(this.form.multaDias || 0));
    return Math.min(dias * tarifa, Number(t.pagoAcordadoUsd || 0));
  }

  private ok(msg: string) {
    this.errorMsg.set('');
    this.feedbackMsg.set(msg);
    this.panel.set(null);
  }

  private fail(msg: string) {
    this.feedbackMsg.set('');
    this.errorMsg.set(msg);
  }

  abrirPanel(t: any, tipo: TipoPanel) {
    this.errorMsg.set('');
    if (this.panel()?.id === t.id && this.panel()?.tipo === tipo) {
      this.panel.set(null);
      return;
    }
    this.form = {
      ...this.form,
      estrellas: 5,
      controlMasilla: 'APROBADA',
      obsCalidad: '',
      motivo: '',
      prorrogaDias: 2,
      prorrogaMotivo: '',
      multaDias: Math.max(1, Number(t.diasAtraso || 1)),
      multaMotivo: '',
      nuevoTecnicoId: '',
    };
    this.panel.set({ id: t.id, tipo });
  }

  revisarPlazos() {
    this.revisandoPlazos.set(true);
    this.state.recalcularAtrasos(
      (res) => {
        this.revisandoPlazos.set(false);
        this.ok(
          `Revisión terminada: ${res.revisadas} tarea(s) pendientes, ${res.conAtraso} con atraso, ${res.nuevasAlertas} alerta(s) nueva(s).`,
        );
      },
      (e) => {
        this.revisandoPlazos.set(false);
        this.fail(e);
      },
    );
  }

  crearTarea() {
    if (!this.nt.vehiculoId || !this.nt.titulo.trim() || !this.nt.tecnicoAsignadoId) {
      this.fail('Completa vehículo, descripción de la tarea y técnico responsable.');
      return;
    }
    this.creandoTarea.set(true);
    this.state.crearTareaOt(
      { ...this.nt, titulo: this.nt.titulo.trim(), pagoAcordadoUsd: Number(this.nt.pagoAcordadoUsd || 0) },
      () => {
        this.creandoTarea.set(false);
        this.ok('Tarea agregada a la orden de trabajo y registrada en el historial.');
        this.nt.titulo = '';
        this.nt.tecnicoAsignadoId = '';
        this.mostrarNuevaTarea.set(false);
      },
      (e) => {
        this.creandoTarea.set(false);
        this.fail(e);
      },
    );
  }

  completar(t: any) {
    this.guardandoAccion.set(true);
    this.state.cambiarEstadoTarea(
      t.id,
      {
        completada: true,
        calificacionEstrellas: Number(this.form.estrellas),
        controlCalidadMasilla: t.tipo === 'PINTURA' ? this.form.controlMasilla : undefined,
        observacionCalidad: t.tipo === 'PINTURA' ? this.form.obsCalidad : undefined,
      },
      () => {
        this.guardandoAccion.set(false);
        this.ok('Tarea completada y calificada.');
      },
      (e) => {
        this.guardandoAccion.set(false);
        this.fail(e);
      },
    );
  }

  reabrir(t: any) {
    this.guardandoAccion.set(true);
    this.state.cambiarEstadoTarea(
      t.id,
      { completada: false, motivo: this.form.motivo },
      () => {
        this.guardandoAccion.set(false);
        this.ok('Tarea reabierta. El motivo quedó registrado en el historial.');
      },
      (e) => {
        this.guardandoAccion.set(false);
        this.fail(e);
      },
    );
  }

  prorroga(t: any) {
    this.guardandoAccion.set(true);
    this.state.darProrroga(
      t.id,
      {
        dias: Number(this.form.prorrogaDias),
        causa: this.form.prorrogaCausa,
        motivo: this.form.prorrogaMotivo,
      },
      () => {
        this.guardandoAccion.set(false);
        this.ok('Prórroga otorgada y registrada en el historial.');
      },
      (e) => {
        this.guardandoAccion.set(false);
        this.fail(e);
      },
    );
  }

  multa(t: any) {
    this.guardandoAccion.set(true);
    this.state.aplicarMulta(
      t.id,
      Number(this.form.multaDias),
      () => {
        this.guardandoAccion.set(false);
        this.ok('Multa aplicada al pago del contratista y registrada en el historial.');
      },
      (e) => {
        this.guardandoAccion.set(false);
        this.fail(e);
      },
      this.form.multaMotivo,
    );
  }

  reasignar(t: any) {
    this.guardandoAccion.set(true);
    this.state.reasignarTecnico(
      t.id,
      this.form.nuevoTecnicoId,
      this.form.motivo,
      () => {
        this.guardandoAccion.set(false);
        this.ok('Tarea reasignada y registrada en el historial.');
      },
      (e) => {
        this.guardandoAccion.set(false);
        this.fail(e);
      },
    );
  }

  irAModulo(vehiculoId: string, modulo: 'cotizacion' | 'repuestos' | 'reportes') {
    this.state.irAVehiculoEnModulo(vehiculoId, modulo);
  }

  abrirLightbox(url: string, titulo: string, descripcion: string) {
    this.lightbox.set({ url, titulo, descripcion });
  }
}
