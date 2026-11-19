import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../core/services/app-state.service';
import { comprimirImagenNavegadorWebp } from '../../core/utils/webp-compressor';
import { AuditHistoryPanelComponent } from '../../shared/components/audit-history-panel/audit-history-panel.component';

type FiltroTecnicos = 'TODOS' | 'HABILITADOS' | 'BLOQUEADOS';
type FiltroHerramientas = 'TODAS' | 'ACTIVA' | 'DADA_DE_BAJA' | 'COMPRA_SOLICITADA';

interface LightboxHerramienta {
  url: string;
  titulo: string;
  descripcion: string;
}

@Component({
  selector: 'app-herramientas-personal',
  standalone: true,
  imports: [CommonModule, FormsModule, AuditHistoryPanelComponent],
  template: `
    <div class="space-y-6">
      <!-- Encabezado del Módulo -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div class="space-y-1 max-w-3xl">
          <div class="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <i class="ri-hammer-line text-sm"></i>
            <span>Personal Especializado e Inventario de Herramientas</span>
          </div>
          <h1 class="text-lg sm:text-xl font-bold text-white">
            Directorio de Técnicos / Contratistas y Bajas de Herramientas con Respaldo Fotográfico
          </h1>
          <p class="text-xs text-slate-400">
            Directorio de especialistas, calificaciones, control de herramientas y bajas con fotografía.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs">
          @if (pestanaActiva() === 'tecnicos') {
            <button
              type="button"
              (click)="errorMsg.set(''); mostrarCrearTecnico.set(true)"
              class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-600/20"
            >
              <i class="ri-user-add-line"></i>
              <span>Nuevo especialista</span>
            </button>
          } @else {
            <button
              type="button"
              (click)="errorMsg.set(''); mostrarCrearHerramienta.set(true)"
              class="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-600/20"
            >
              <i class="ri-add-line"></i>
              <span>Alta / Solicitud herramienta</span>
            </button>
          }
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

      <!-- Pestañas internas y buscador -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div class="flex items-center gap-6 text-xs font-semibold">
          <button
            type="button"
            (click)="pestanaActiva.set('tecnicos')"
            [ngClass]="pestanaActiva() === 'tecnicos' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'"
            class="pb-2 border-b-2 transition flex items-center gap-2 cursor-pointer"
          >
            <i class="ri-team-line text-sm"></i>
            <span>Personal y Especialistas ({{ state.tecnicos().length }})</span>
          </button>

          <button
            type="button"
            (click)="pestanaActiva.set('herramientas')"
            [ngClass]="pestanaActiva() === 'herramientas' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'"
            class="pb-2 border-b-2 transition flex items-center gap-2 cursor-pointer"
          >
            <i class="ri-tools-line text-sm"></i>
            <span>Inventario de Herramientas ({{ state.herramientas().length }})</span>
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs">
          <div class="relative w-full sm:w-72">
            <i class="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              [ngModel]="busquedaTexto()"
              (ngModelChange)="busquedaTexto.set($event)"
              [placeholder]="pestanaActiva() === 'tecnicos' ? 'Buscar técnico u oficio...' : 'Buscar herramienta o responsable...'"
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

          @if (filtroTecnicos() !== 'TODOS' || filtroHerramientas() !== 'TODAS' || busquedaTexto().trim() || state.focusedReferenciaId()) {
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

      <!-- ========================================== -->
      <!-- PESTAÑA 1: PERSONAL Y ESPECIALISTAS (7A)   -->
      <!-- ========================================== -->
      @if (pestanaActiva() === 'tecnicos') {
        <!-- KPIs clicables de personal -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <button
            type="button"
            (click)="filtroTecnicos.set('TODOS')"
            [ngClass]="filtroTecnicos() === 'TODOS' ? 'border-blue-500 bg-blue-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
            class="p-4 rounded-xl border text-left transition cursor-pointer"
          >
            <div class="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5">
              <i class="ri-user-star-line text-blue-400"></i>
              <span>Directorio Completo</span>
            </div>
            <div class="text-2xl font-black text-white font-mono mt-1">{{ state.tecnicos().length }}</div>
            <div class="text-[10px] text-slate-500 mt-0.5">Fijos y contratistas por pieza</div>
          </button>

          <button
            type="button"
            (click)="filtroTecnicos.set('HABILITADOS')"
            [ngClass]="filtroTecnicos() === 'HABILITADOS' ? 'border-emerald-400 bg-emerald-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
            class="p-4 rounded-xl border text-left transition cursor-pointer"
          >
            <div class="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
              <i class="ri-checkbox-circle-line"></i>
              <span>Especialistas Habilitados</span>
            </div>
            <div class="text-2xl font-black text-emerald-400 font-mono mt-1">{{ resumenTecnicos().activos }}</div>
            <div class="text-[10px] text-slate-500 mt-0.5">Disponibles para asignar en OT</div>
          </button>

          <button
            type="button"
            (click)="filtroTecnicos.set('BLOQUEADOS')"
            [ngClass]="filtroTecnicos() === 'BLOQUEADOS' ? 'border-rose-400 bg-rose-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
            class="p-4 rounded-xl border text-left transition cursor-pointer"
          >
            <div class="text-[11px] text-rose-400 font-semibold flex items-center gap-1.5">
              <i class="ri-forbid-line"></i>
              <span>Bloqueados por Calidad</span>
            </div>
            <div
              [ngClass]="resumenTecnicos().bloqueados > 0 ? 'text-rose-400' : 'text-slate-400'"
              class="text-2xl font-black font-mono mt-1"
            >
              {{ resumenTecnicos().bloqueados }}
            </div>
            <div class="text-[10px] text-slate-500 mt-0.5">Excluidos de asignación OT</div>
          </button>

          <div class="p-4 rounded-xl border border-slate-800 bg-slate-900/80 text-left">
            <div class="text-[11px] text-amber-400 font-semibold flex items-center gap-1.5">
              <i class="ri-star-fill"></i>
              <span>Calidad y Nómina Fija</span>
            </div>
            <div class="text-xl font-black text-amber-300 font-mono mt-1">
              {{ resumenTecnicos().promedioEstrellas }} ★ • {{ state.formatMoney(resumenTecnicos().nominaFijaUsd) }}
            </div>
            <div class="text-[10px] text-slate-500 mt-0.5">Sueldos fijos mensuales activos</div>
          </div>
        </div>

        <!-- Modal Alta Técnico -->
        @if (mostrarCrearTecnico()) {
          <div
            (click)="mostrarCrearTecnico.set(false)"
            class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              (click)="$event.stopPropagation()"
              class="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden text-xs shadow-2xl"
            >
              <div class="px-5 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 shrink-0">
                <div>
                  <div class="font-bold text-sm text-white flex items-center gap-2">
                    <i class="ri-user-add-line text-blue-400 text-base"></i>
                    <span>Registrar Nuevo Especialista o Contratista</span>
                  </div>
                  <span class="text-[11px] text-slate-400">Queda registrado en el historial de cambios.</span>
                </div>
                <button
                  type="button"
                  (click)="mostrarCrearTecnico.set(false)"
                  class="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                >
                  <i class="ri-close-line text-lg"></i>
                </button>
              </div>

              <div class="p-5 space-y-4 overflow-y-auto flex-1">

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="lg:col-span-2">
                <label class="block text-slate-300 font-semibold mb-1">Nombre completo o razón social *</label>
                <input
                  type="text"
                  [(ngModel)]="nuevoTecnico.nombre"
                  placeholder="Ej: Marcelo Ramos, Taller Soldaduras del Norte..."
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label class="block text-slate-300 font-semibold mb-1">Especialidad *</label>
                <select
                  [(ngModel)]="nuevoTecnico.especialidad"
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="CHAPERO">CHAPERO (DESABOLLADOR)</option>
                  <option value="PINTOR">PINTOR (PREPARADOR Y HORNO)</option>
                  <option value="MECANICO_PLANTA">MECÁNICO DE PLANTA</option>
                  <option value="ELECTRICO_EXTERNO">ELÉCTRICO EXTERNO</option>
                  <option value="AIRBAG_PLASTICOS_EXTERNO">AIRBAG / PLÁSTICOS EXTERNO</option>
                  <option value="SOLDADOR_EXTERNO">SOLDADOR EXTERNO</option>
                </select>
              </div>

              <div>
                <label class="block text-slate-300 font-semibold mb-1">Modalidad de pago *</label>
                <select
                  [(ngModel)]="nuevoTecnico.modalidad"
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="CONTRATO_PIEZA">CONTRATO POR PIEZA / TAREA</option>
                  <option value="SUELDO_FIJO">SUELDO FIJO MENSUAL</option>
                  <option value="TERCERO_EXTERNO">TALLER TERCERO EXTERNO</option>
                </select>
              </div>

              @if (nuevoTecnico.modalidad === 'SUELDO_FIJO') {
                <div>
                  <label class="block text-slate-300 font-semibold mb-1">Sueldo fijo mensual (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    [(ngModel)]="nuevoTecnico.sueldoFijoMensualUsd"
                    class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              }

              <div [ngClass]="nuevoTecnico.modalidad === 'SUELDO_FIJO' ? 'lg:col-span-3' : 'lg:col-span-4'">
                <label class="block text-slate-300 font-semibold mb-1">Observación inicial / experiencia</label>
                <input
                  type="text"
                  [(ngModel)]="nuevoTecnico.observacionDesempeno"
                  placeholder="Ej: Especialista en desabollado pesado con bancada, 10 años de experiencia..."
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
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
                  (click)="mostrarCrearTecnico.set(false)"
                  class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  [disabled]="creandoTecnico()"
                  (click)="guardarNuevoTecnico()"
                  class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <i [class]="creandoTecnico() ? 'ri-loader-4-line animate-spin' : 'ri-check-line'"></i>
                  <span>{{ creandoTecnico() ? 'Guardando...' : 'Guardar especialista' }}</span>
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Panel inline de edición de especialista -->
        @if (editandoTecnicoId()) {
          <div class="bg-slate-900 border border-cyan-500/40 rounded-2xl p-5 space-y-4 text-xs shadow-2xl">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div class="font-bold text-cyan-300 flex items-center gap-2">
                <i class="ri-user-settings-line text-base"></i>
                <span>Editar Datos / Sueldo de Especialista (Queda en Auditoría)</span>
              </div>
              <button type="button" (click)="editandoTecnicoId.set(null)" class="text-slate-400 hover:text-white cursor-pointer">
                <i class="ri-close-line text-base"></i>
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div class="lg:col-span-2">
                <label class="block text-slate-300 font-semibold mb-1">Nombre completo *</label>
                <input
                  type="text"
                  [(ngModel)]="editTecnicoForm.nombre"
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Especialidad</label>
                <select
                  [(ngModel)]="editTecnicoForm.especialidad"
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="CHAPERO">CHAPERO</option>
                  <option value="PINTOR">PINTOR</option>
                  <option value="MECANICO_PLANTA">MECÁNICO DE PLANTA</option>
                  <option value="ELECTRICO_EXTERNO">ELÉCTRICO EXTERNO</option>
                  <option value="AIRBAG_PLASTICOS_EXTERNO">AIRBAG / PLÁSTICOS EXTERNO</option>
                  <option value="SOLDADOR_EXTERNO">SOLDADOR EXTERNO</option>
                </select>
              </div>
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Modalidad</label>
                <select
                  [(ngModel)]="editTecnicoForm.modalidad"
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="CONTRATO_PIEZA">CONTRATO POR PIEZA</option>
                  <option value="SUELDO_FIJO">SUELDO FIJO MENSUAL</option>
                  <option value="TERCERO_EXTERNO">TERCERO EXTERNO</option>
                </select>
              </div>

              @if (editTecnicoForm.modalidad === 'SUELDO_FIJO') {
                <div>
                  <label class="block text-slate-300 font-semibold mb-1">Sueldo fijo (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    [(ngModel)]="editTecnicoForm.sueldoFijoMensualUsd"
                    class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-mono"
                  />
                </div>
              }

              <div [ngClass]="editTecnicoForm.modalidad === 'SUELDO_FIJO' ? 'lg:col-span-3' : 'lg:col-span-4'">
                <label class="block text-slate-300 font-semibold mb-1">Observación de desempeño</label>
                <input
                  type="text"
                  [(ngModel)]="editTecnicoForm.observacionDesempeno"
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div class="sm:col-span-2 lg:col-span-4">
                <label class="block text-slate-300 font-semibold mb-1">Motivo obligatorio de edición *</label>
                <input
                  type="text"
                  [(ngModel)]="editTecnicoForm.motivoEdicion"
                  placeholder="Ej: Ajuste de sueldo fijo acordado por rendimiento"
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-cyan-500/40 text-white"
                />
              </div>
            </div>

            <div class="flex justify-end gap-2">
              <button
                type="button"
                (click)="editandoTecnicoId.set(null)"
                class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                [disabled]="guardandoEdicionTec()"
                (click)="guardarEdicionTecnico()"
                class="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-bold flex items-center gap-2 cursor-pointer"
              >
                <i [class]="guardandoEdicionTec() ? 'ri-loader-4-line animate-spin' : 'ri-save-3-line'"></i>
                <span>{{ guardandoEdicionTec() ? 'Guardando...' : 'Guardar cambios' }}</span>
              </button>
            </div>
          </div>
        }

        <!-- Tabla de Especialistas -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-300">
              <thead class="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th class="px-4 py-3">Especialista</th>
                  <th class="px-4 py-3">Oficio</th>
                  <th class="px-4 py-3">Modalidad / Nómina</th>
                  <th class="px-4 py-3 text-center">Ranking</th>
                  <th class="px-4 py-3 text-center">Completados</th>
                  <th class="px-4 py-3 text-center">Estado</th>
                  <th class="px-4 py-3 text-right">Gestión</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60 font-sans">
                @for (tec of tecnicosFiltrados(); track tec.id) {
                  <tr
                    [attr.data-focus-ref]="tec.id"
                    [ngClass]="
                      state.focusedReferenciaId() === tec.id
                        ? 'bg-cyan-950/35 ring-1 ring-inset ring-cyan-400'
                        : 'hover:bg-slate-800/40'
                    "
                    class="transition"
                  >
                    <td class="px-4 py-3">
                      <div class="font-bold text-white text-xs">{{ tec.nombre }}</div>
                      @if (tec.observacionDesempeno) {
                        <div class="text-[11px] text-slate-400 max-w-xs">{{ tec.observacionDesempeno }}</div>
                      }
                    </td>
                    <td class="px-4 py-3">
                      <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                        {{ formatEspecialidad(tec.especialidad) }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-slate-400 font-mono text-[11px]">
                      @if (tec.modalidad === 'SUELDO_FIJO') {
                        <span class="text-indigo-300 font-semibold">
                          Fijo ({{ state.formatMoney(tec.sueldoFijoMensualUsd) }}/mes)
                        </span>
                      } @else if (tec.modalidad === 'CONTRATO_PIEZA') {
                        <span>Contrato por pieza</span>
                      } @else {
                        <span>Taller tercero externo</span>
                      }
                    </td>
                    <td class="px-4 py-3 text-center">
                      <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono font-bold text-xs">
                        <i class="ri-star-fill text-[11px]"></i>
                        <span>{{ tec.promedioEstrellas }}</span>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-center font-mono font-bold text-slate-200">
                      {{ tec.trabajosCompletados }}
                    </td>
                    <td class="px-4 py-3 text-center">
                      @if (tec.bloqueadoPorMalTrabajo) {
                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/35">
                          <i class="ri-forbid-line"></i>
                          <span>BLOQUEADO</span>
                        </span>
                      } @else {
                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <i class="ri-checkbox-circle-line"></i>
                          <span>HABILITADO</span>
                        </span>
                      }
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          (click)="abrirEdicionTecnico(tec)"
                          class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          (click)="abrirModalBloqueo(tec)"
                          [ngClass]="
                            tec.bloqueadoPorMalTrabajo
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'bg-rose-600 hover:bg-rose-500 text-white'
                          "
                          class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                        >
                          {{ tec.bloqueadoPorMalTrabajo ? 'Habilitar' : 'Bloquear' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="px-4 py-10 text-center text-slate-500">
                      No hay especialistas que coincidan con el filtro seleccionado.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Auditoría Personal / Configuración -->
        <app-audit-history-panel defaultModulo="CONFIGURACION"></app-audit-history-panel>
      }

      <!-- ========================================== -->
      <!-- PESTAÑA 2: INVENTARIO DE HERRAMIENTAS (7B) -->
      <!-- ========================================== -->
      @if (pestanaActiva() === 'herramientas') {
        <!-- KPIs clicables de herramientas -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <button
            type="button"
            (click)="filtroHerramientas.set('TODAS')"
            [ngClass]="filtroHerramientas() === 'TODAS' ? 'border-blue-500 bg-blue-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
            class="p-4 rounded-xl border text-left transition cursor-pointer"
          >
            <div class="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5">
              <i class="ri-tools-line text-amber-400"></i>
              <span>Inventario Total</span>
            </div>
            <div class="text-2xl font-black text-white font-mono mt-1">{{ state.herramientas().length }}</div>
            <div class="text-[10px] text-slate-500 mt-0.5">Equipos registrados</div>
          </button>

          <button
            type="button"
            (click)="filtroHerramientas.set('ACTIVA')"
            [ngClass]="filtroHerramientas() === 'ACTIVA' ? 'border-emerald-400 bg-emerald-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
            class="p-4 rounded-xl border text-left transition cursor-pointer"
          >
            <div class="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
              <i class="ri-checkbox-circle-line"></i>
              <span>Activas en Taller</span>
            </div>
            <div class="text-xl font-black text-emerald-400 font-mono mt-1">
              {{ resumenHerramientas().activas }} ({{ state.formatMoney(resumenHerramientas().valorActivoUsd) }})
            </div>
            <div class="text-[10px] text-slate-500 mt-0.5">Capital operativo vigente</div>
          </button>

          <button
            type="button"
            (click)="filtroHerramientas.set('DADA_DE_BAJA')"
            [ngClass]="filtroHerramientas() === 'DADA_DE_BAJA' ? 'border-rose-400 bg-rose-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
            class="p-4 rounded-xl border text-left transition cursor-pointer"
          >
            <div class="text-[11px] text-rose-400 font-semibold flex items-center gap-1.5">
              <i class="ri-delete-bin-line"></i>
              <span>Dadas de Baja (Con Foto)</span>
            </div>
            <div class="text-xl font-black text-rose-400 font-mono mt-1">
              {{ resumenHerramientas().bajas }} ({{ state.formatMoney(resumenHerramientas().valorBajaUsd) }})
            </div>
            <div class="text-[10px] text-slate-500 mt-0.5">Pérdidas auditadas</div>
          </button>

          <button
            type="button"
            (click)="filtroHerramientas.set('COMPRA_SOLICITADA')"
            [ngClass]="filtroHerramientas() === 'COMPRA_SOLICITADA' ? 'border-cyan-400 bg-cyan-950/35' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'"
            class="p-4 rounded-xl border text-left transition cursor-pointer"
          >
            <div class="text-[11px] text-cyan-300 font-semibold flex items-center gap-1.5">
              <i class="ri-shopping-bag-line"></i>
              <span>Compras Solicitadas</span>
            </div>
            <div class="text-2xl font-black text-cyan-300 font-mono mt-1">{{ resumenHerramientas().compras }}</div>
            <div class="text-[10px] text-slate-500 mt-0.5">Pendientes de ingreso</div>
          </button>
        </div>

        <!-- Modal Alta / Solicitud de Compra de Herramienta -->
        @if (mostrarCrearHerramienta()) {
          <div
            (click)="mostrarCrearHerramienta.set(false)"
            class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              (click)="$event.stopPropagation()"
              class="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden text-xs shadow-2xl"
            >
              <div class="px-5 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 shrink-0">
                <div>
                  <div class="font-bold text-sm text-white flex items-center gap-2">
                    <i class="ri-add-circle-line text-amber-400 text-base"></i>
                    <span>Ingresar Herramienta Activa o Solicitar Compra de Reposición</span>
                  </div>
                  <span class="text-[11px] text-slate-400">Si es solicitud de compra notifica directamente a Bolivia.</span>
                </div>
                <button
                  type="button"
                  (click)="mostrarCrearHerramienta.set(false)"
                  class="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                >
                  <i class="ri-close-line text-lg"></i>
                </button>
              </div>

              <div class="p-5 space-y-4 overflow-y-auto flex-1">

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="lg:col-span-2">
                <label class="block text-slate-300 font-semibold mb-1">Nombre del equipo / herramienta *</label>
                <input
                  type="text"
                  [(ngModel)]="nuevaHerramienta.nombre"
                  placeholder="Ej: Pistola de calor DeWalt, Esmeril Makita 4 1/2..."
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label class="block text-slate-300 font-semibold mb-1">Tipo de registro *</label>
                <select
                  [(ngModel)]="nuevaHerramienta.estado"
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="ACTIVA">ACTIVA EN TALLER (YA EXISTE)</option>
                  <option value="COMPRA_SOLICITADA">SOLICITAR COMPRA / REPOSICIÓN</option>
                </select>
              </div>

              <div>
                <label class="block text-slate-300 font-semibold mb-1">Costo compra / estimado (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  [(ngModel)]="nuevaHerramienta.costoCompraUsd"
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div class="sm:col-span-2 lg:col-span-4">
                <label class="block text-slate-300 font-semibold mb-1">Justificación / Nota de inventario (opcional)</label>
                <input
                  type="text"
                  [(ngModel)]="nuevaHerramienta.detalleBaja"
                  placeholder="Ej: Reposición necesaria tras baja de unidad dañada en turno B"
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
                  (click)="mostrarCrearHerramienta.set(false)"
                  class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  [disabled]="creandoHerramienta()"
                  (click)="guardarNuevaHerramienta()"
                  class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <i [class]="creandoHerramienta() ? 'ri-loader-4-line animate-spin' : 'ri-check-line'"></i>
                  <span>
                    {{ creandoHerramienta() ? 'Registrando...' : nuevaHerramienta.estado === 'COMPRA_SOLICITADA' ? 'Enviar solicitud' : 'Registrar activa' }}
                  </span>
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Panel inline edición de herramienta -->
        @if (editandoHerramientaId()) {
          <div class="bg-slate-900 border border-cyan-500/40 rounded-2xl p-5 space-y-4 text-xs shadow-2xl">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div class="font-bold text-cyan-300 flex items-center gap-2">
                <i class="ri-edit-box-line text-base"></i>
                <span>Editar Herramienta (Auditado en Historial)</span>
              </div>
              <button type="button" (click)="editandoHerramientaId.set(null)" class="text-slate-400 hover:text-white cursor-pointer">
                <i class="ri-close-line text-base"></i>
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div class="lg:col-span-2">
                <label class="block text-slate-300 font-semibold mb-1">Nombre del equipo *</label>
                <input
                  type="text"
                  [(ngModel)]="editHerramientaForm.nombre"
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Costo (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  [(ngModel)]="editHerramientaForm.costoCompraUsd"
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-amber-300 font-mono"
                />
              </div>
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Motivo obligatorio *</label>
                <input
                  type="text"
                  [(ngModel)]="editHerramientaForm.motivoEdicion"
                  placeholder="Ej: Corrección con boleta real"
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-cyan-500/40 text-white"
                />
              </div>
            </div>

            <div class="flex justify-end gap-2">
              <button
                type="button"
                (click)="editandoHerramientaId.set(null)"
                class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                [disabled]="guardandoEdicionHer()"
                (click)="guardarEdicionHerramienta()"
                class="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-bold flex items-center gap-2 cursor-pointer"
              >
                <i [class]="guardandoEdicionHer() ? 'ri-loader-4-line animate-spin' : 'ri-save-3-line'"></i>
                <span>{{ guardandoEdicionHer() ? 'Guardando...' : 'Guardar edición' }}</span>
              </button>
            </div>
          </div>
        }

        <!-- Panel inline Confirmar Ingreso de Compra Solicitada -->
        @if (herramientaParaActivar(); as ha) {
          <div class="bg-slate-900 border border-emerald-500/50 rounded-2xl p-5 space-y-4 text-xs shadow-2xl">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div class="font-bold text-emerald-300 flex items-center gap-2">
                <i class="ri-checkbox-circle-line text-base"></i>
                <span>Confirmar Recepción Física en Taller: {{ ha.nombre }}</span>
              </div>
              <button type="button" (click)="herramientaParaActivar.set(null)" class="text-slate-400 hover:text-white cursor-pointer">
                <i class="ri-close-line text-base"></i>
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Costo final pagado (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  [(ngModel)]="activarForm.costoCompraUsd"
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-mono"
                />
              </div>
              <div class="sm:col-span-2">
                <label class="block text-slate-300 font-semibold mb-1">Nota de entrega / factura (opcional)</label>
                <input
                  type="text"
                  [(ngModel)]="activarForm.motivo"
                  placeholder="Ej: Recibido conforme en bodega, proveedor Ferretería Central"
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
            </div>

            <div class="flex justify-end gap-2">
              <button
                type="button"
                (click)="herramientaParaActivar.set(null)"
                class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                [disabled]="activandoHerramienta()"
                (click)="confirmarIngresoCompra()"
                class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold flex items-center gap-2 cursor-pointer"
              >
                <i [class]="activandoHerramienta() ? 'ri-loader-4-line animate-spin' : 'ri-check-double-line'"></i>
                <span>{{ activandoHerramienta() ? 'Activando...' : 'Ingresar como ACTIVA' }}</span>
              </button>
            </div>
          </div>
        }

        <!-- Panel inline DAR DE BAJA CON FOTO OBLIGATORIA (.webp) -->
        @if (herramientaParaBaja(); as hb) {
          <div class="bg-slate-900 border border-rose-500/50 rounded-2xl p-5 space-y-4 text-xs shadow-2xl">
            <div class="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <div class="font-bold text-sm text-rose-300 flex items-center gap-2">
                <i class="ri-alarm-warning-line text-rose-400 text-base"></i>
                <span>Dar de Baja Herramienta: {{ hb.nombre }}</span>
              </div>
              <button type="button" (click)="cerrarBaja()" class="text-slate-400 hover:text-white cursor-pointer">
                <i class="ri-close-line text-base"></i>
              </button>
            </div>

            <div class="p-3 rounded-xl bg-rose-950/40 border border-rose-500/35 text-xs text-rose-200 flex items-center gap-2">
              <i class="ri-information-line text-rose-400 text-base shrink-0"></i>
              <span>
                Regla de auditoría: Toda herramienta dada de baja por mal uso o desgaste exige fotografía de respaldo y responsable identificado para evaluar cobro desde Bolivia.
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Tipo de causa *</label>
                <select
                  [(ngModel)]="bajaForm.tipoCausaBaja"
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="MAL_USO_COBRAR">MAL USO / NEGLIGENCIA (COBRAR)</option>
                  <option value="DESGASTE_NORMAL">DESGASTE NORMAL / VIDA ÚTIL</option>
                </select>
              </div>

              <div>
                <label class="block text-slate-300 font-semibold mb-1">Responsable asignado *</label>
                <input
                  type="text"
                  [(ngModel)]="bajaForm.responsableBaja"
                  placeholder="Ej: Marcelo Ramos, Ayudante Turno B..."
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div class="sm:col-span-2">
                <label class="block text-slate-300 font-semibold mb-1">Detalle del daño o incidente *</label>
                <input
                  type="text"
                  [(ngModel)]="bajaForm.detalleBaja"
                  placeholder="Ej: Pistón doblado por apoyo lateral indebido o motor quemado..."
                  class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              @if (state.tecnicos().length > 0) {
                <div class="lg:col-span-4 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span class="text-slate-400 mr-1">Selección rápida de técnico:</span>
                  @for (t of state.tecnicos(); track t.id) {
                    <button
                      type="button"
                      (click)="bajaForm.responsableBaja = t.nombre"
                      [ngClass]="
                        bajaForm.responsableBaja === t.nombre
                          ? 'bg-rose-600 text-white border-rose-400'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700'
                      "
                      class="px-2 py-0.5 rounded border cursor-pointer"
                    >
                      {{ t.nombre }}
                    </button>
                  }
                </div>
              }

              <!-- Foto de evidencia con compresión WebP y vista previa -->
              <div class="lg:col-span-4 p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div>
                  <label class="block text-slate-300 font-semibold mb-1">Fotografía herramienta dañada *</label>
                  <input
                    #fileInputBaja
                    type="file"
                    accept="image/*"
                    (change)="alSeleccionarFotoBaja($event, fileInputBaja)"
                    class="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-rose-600 file:text-white hover:file:bg-rose-500 cursor-pointer"
                  />
                  @if (comprimiendoFotoBaja()) {
                    <div class="mt-1.5 text-[11px] text-amber-300 flex items-center gap-1.5">
                      <i class="ri-loader-4-line animate-spin"></i>
                      <span>Procesando fotografía...</span>
                    </div>
                  } @else if (compresionBajaInfo()) {
                    <div class="mt-1.5 text-[11px] text-emerald-400">
                      {{ compresionBajaInfo() }}
                    </div>
                  }
                </div>

                <div>
                  <label class="block text-slate-300 font-semibold mb-1">Descripción breve de la foto *</label>
                  <input
                    type="text"
                    [(ngModel)]="bajaForm.descripcionFotoBaja"
                    placeholder="Ej: Vista cercana del inducido quemado"
                    class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div class="flex items-center justify-end gap-2">
                  @if (previewBajaUrl()) {
                    <img
                      [src]="previewBajaUrl()"
                      alt="Vista previa evidencia"
                      class="w-24 h-16 rounded-lg object-cover border border-rose-500/50"
                    />
                    <button
                      type="button"
                      (click)="limpiarFotoBaja(fileInputBaja)"
                      class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-white cursor-pointer"
                      title="Quitar fotografía"
                    >
                      <i class="ri-delete-bin-line"></i>
                    </button>
                  } @else {
                    <span class="text-[11px] text-slate-500 italic">Vista previa pendiente</span>
                  }
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                (click)="cerrarBaja()"
                [disabled]="procesandoBaja()"
                class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="confirmarBajaHerramienta()"
                [disabled]="procesandoBaja() || comprimiendoFotoBaja()"
                class="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                @if (procesandoBaja()) {
                  <i class="ri-loader-4-line animate-spin"></i>
                  <span>Subiendo foto y auditando...</span>
                } @else {
                  <i class="ri-delete-bin-line"></i>
                  <span>Confirmar baja</span>
                }
              </button>
            </div>
          </div>
        }

        <!-- Tabla de Inventario de Herramientas -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-300">
              <thead class="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th class="px-4 py-3">Herramienta / Equipo</th>
                  <th class="px-4 py-3">Estado</th>
                  <th class="px-4 py-3 text-right">Costo Compra</th>
                  <th class="px-4 py-3">Causa / Detalle / Responsable</th>
                  <th class="px-4 py-3 text-center">Evidencia Fotográfica</th>
                  <th class="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60 font-sans">
                @for (her of herramientasFiltradas(); track her.id) {
                  <tr
                    [attr.data-focus-ref]="her.id"
                    [ngClass]="
                      state.focusedReferenciaId() === her.id
                        ? 'bg-cyan-950/35 ring-1 ring-inset ring-cyan-400'
                        : 'hover:bg-slate-800/40'
                    "
                    class="transition"
                  >
                    <td class="px-4 py-3 font-semibold text-white">
                      <div>{{ her.nombre }}</div>
                      @if (her.actualizadoEn) {
                        <div class="text-[10px] font-normal text-slate-500 font-mono mt-0.5">
                          {{ state.formatFechaHora(her.actualizadoEn) }}
                        </div>
                      }
                    </td>
                    <td class="px-4 py-3">
                      @if (her.estado === 'ACTIVA') {
                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <i class="ri-checkbox-circle-line"></i>
                          <span>ACTIVA EN TALLER</span>
                        </span>
                      } @else if (her.estado === 'DADA_DE_BAJA') {
                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/35">
                          <i class="ri-close-circle-line"></i>
                          <span>DADA DE BAJA</span>
                        </span>
                      } @else {
                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/35">
                          <i class="ri-time-line"></i>
                          <span>COMPRA SOLICITADA</span>
                        </span>
                      }
                    </td>
                    <td class="px-4 py-3 text-right font-mono text-amber-300 whitespace-nowrap">
                      {{ state.formatMoney(her.costoCompraUsd) }}
                    </td>
                    <td class="px-4 py-3 text-slate-400">
                      @if (her.estado === 'DADA_DE_BAJA') {
                        <div>
                          <span
                            [ngClass]="her.tipoCausaBaja === 'MAL_USO_COBRAR' ? 'text-rose-400' : 'text-amber-400'"
                            class="font-semibold"
                          >
                            {{ her.tipoCausaBaja === 'MAL_USO_COBRAR' ? 'Mal uso (cobro)' : 'Desgaste' }}
                          </span>
                          — {{ her.responsableBaja }}
                        </div>
                        <div class="text-[11px] text-slate-500 max-w-xs">{{ her.detalleBaja }}</div>
                      } @else if (her.detalleBaja) {
                        <div class="text-[11px] text-slate-400 max-w-xs">{{ her.detalleBaja }}</div>
                      } @else {
                        <span class="text-slate-300 text-[11px]">Operativa en taller • Mantenimiento al día</span>
                      }
                    </td>
                    <td class="px-4 py-3 text-center">
                      @if (her.fotoHerramientaRotaWebp) {
                        <button
                          type="button"
                          (click)="
                            abrirLightbox(
                              state.resolveMediaUrl(her.fotoHerramientaRotaWebp),
                              'Evidencia Baja: ' + her.nombre,
                              her.descripcionFotoBaja || her.detalleBaja || 'Foto de respaldo de herramienta'
                            )
                          "
                          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-rose-300 hover:text-white transition text-[11px] border border-slate-700 hover:border-rose-400 cursor-pointer"
                          [title]="her.descripcionFotoBaja || 'Ampliar fotografía'"
                        >
                          <img
                            [src]="state.resolveMediaUrl(her.fotoHerramientaRotaWebp)"
                            [alt]="her.nombre"
                            class="w-7 h-7 rounded object-cover border border-slate-600"
                          />
                          <span>Ver Foto</span>
                        </button>
                      } @else {
                        @if (her.estado === 'COMPRA_SOLICITADA') {
                          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-950/50 border border-cyan-500/30 text-cyan-300 text-[10px] font-medium">En compra</span>
                        } @else {
                          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/25 text-emerald-300 text-[10px] font-medium">Operativa</span>
                        }
                      }
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          type="button"
                          (click)="abrirEdicionHerramienta(her)"
                          class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer"
                        >
                          Editar
                        </button>

                        @if (her.estado === 'ACTIVA') {
                          <button
                            type="button"
                            (click)="abrirModalBaja(her)"
                            class="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 hover:text-white transition cursor-pointer"
                          >
                            Dar de baja
                          </button>
                        } @else if (her.estado === 'COMPRA_SOLICITADA') {
                          <button
                            type="button"
                            (click)="abrirModalActivar(her)"
                            class="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
                          >
                            Confirmar ingreso
                          </button>
                        } @else {
                          <button
                            type="button"
                            (click)="solicitarReemplazoBaja(her)"
                            class="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-950/60 hover:bg-blue-900 border border-blue-500/40 text-blue-300 hover:text-white transition cursor-pointer"
                          >
                            Pedir reemplazo
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="px-4 py-10 text-center text-slate-500">
                      No hay herramientas registradas en este filtro.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Auditoría Herramientas -->
        <app-audit-history-panel defaultModulo="HERRAMIENTAS"></app-audit-history-panel>
      }

      <!-- Modal Bloqueo / Desbloqueo de Especialista -->
      @if (tecnicoSeleccionado(); as ts) {
        <div
          (click)="tecnicoSeleccionado.set(null)"
          class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            (click)="$event.stopPropagation()"
            class="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 text-xs shadow-2xl"
          >
            <div class="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <div class="font-bold text-sm text-white flex items-center gap-2">
                <i class="ri-user-settings-line text-blue-400"></i>
                <span>{{ ts.bloqueadoPorMalTrabajo ? 'Habilitar especialista' : 'Bloquear especialista' }}</span>
              </div>
              <button type="button" (click)="tecnicoSeleccionado.set(null)" class="text-slate-400 hover:text-white cursor-pointer">
                <i class="ri-close-line text-base"></i>
              </button>
            </div>

            <p class="text-slate-300">
              Vas a cambiar el estado operativo de <strong class="text-white">{{ ts.nombre }}</strong>.
              @if (!ts.bloqueadoPorMalTrabajo) {
                Al bloquearlo, quedará excluido de nuevas órdenes de trabajo de chapería o pintura.
              } @else {
                Al habilitarlo, volverá a estar disponible para asignación de tareas.
              }
            </p>

            @if (modalBloqueoError()) {
              <div class="p-2.5 rounded-lg bg-rose-950/70 border border-rose-500/50 text-rose-200 text-[11px]">
                {{ modalBloqueoError() }}
              </div>
            }

            <div>
              <label class="block text-slate-300 font-semibold mb-1">Motivo (mín. 5 caracteres) *</label>
              <textarea
                [(ngModel)]="motivoBloqueo"
                rows="3"
                placeholder="Escribe la razón detallada de la decisión..."
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
              ></textarea>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                (click)="tecnicoSeleccionado.set(null)"
                class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                [disabled]="guardandoBloqueo()"
                (click)="confirmarToggleBloqueo()"
                [ngClass]="
                  ts.bloqueadoPorMalTrabajo
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                "
                class="px-4 py-2 rounded-lg font-bold cursor-pointer text-white disabled:opacity-60 flex items-center gap-1.5"
              >
                <i [class]="guardandoBloqueo() ? 'ri-loader-4-line animate-spin' : 'ri-check-line'"></i>
                <span>{{ guardandoBloqueo() ? 'Guardando...' : 'Confirmar' }}</span>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Lightbox Evidencia de Herramienta -->
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
export class HerramientasPersonalComponent {
  state = inject(AppStateService);

  feedbackMsg = signal('');
  errorMsg = signal('');
  pestanaActiva = signal<'tecnicos' | 'herramientas'>('tecnicos');
  filtroTecnicos = signal<FiltroTecnicos>('TODOS');
  filtroHerramientas = signal<FiltroHerramientas>('TODAS');
  busquedaTexto = signal<string>('');

  mostrarCrearTecnico = signal(false);
  creandoTecnico = signal(false);
  editandoTecnicoId = signal<string | null>(null);
  guardandoEdicionTec = signal(false);

  tecnicoSeleccionado = signal<any | null>(null);
  motivoBloqueo = '';
  modalBloqueoError = signal('');
  guardandoBloqueo = signal(false);

  mostrarCrearHerramienta = signal(false);
  creandoHerramienta = signal(false);
  editandoHerramientaId = signal<string | null>(null);
  guardandoEdicionHer = signal(false);

  herramientaParaActivar = signal<any | null>(null);
  activandoHerramienta = signal(false);
  activarForm = { costoCompraUsd: 0, motivo: '' };

  herramientaParaBaja = signal<any | null>(null);
  comprimiendoFotoBaja = signal(false);
  procesandoBaja = signal(false);
  previewBajaUrl = signal('');
  compresionBajaInfo = signal('');
  private archivoFotoBajaWebp: File | null = null;

  lightbox = signal<LightboxHerramienta | null>(null);

  nuevoTecnico = {
    nombre: '',
    especialidad: 'CHAPERO',
    modalidad: 'CONTRATO_PIEZA',
    sueldoFijoMensualUsd: 0,
    observacionDesempeno: '',
  };

  editTecnicoForm = {
    nombre: '',
    especialidad: 'CHAPERO',
    modalidad: 'CONTRATO_PIEZA',
    sueldoFijoMensualUsd: 0,
    observacionDesempeno: '',
    motivoEdicion: '',
  };

  nuevaHerramienta = {
    nombre: '',
    costoCompraUsd: 0,
    estado: 'ACTIVA' as 'ACTIVA' | 'COMPRA_SOLICITADA',
    detalleBaja: '',
  };

  editHerramientaForm = {
    nombre: '',
    costoCompraUsd: 0,
    motivoEdicion: '',
  };

  bajaForm = {
    tipoCausaBaja: 'MAL_USO_COBRAR' as 'MAL_USO_COBRAR' | 'DESGASTE_NORMAL',
    responsableBaja: '',
    detalleBaja: '',
    descripcionFotoBaja: '',
  };

  constructor() {
    effect(() => {
      const sub = this.state.focusedSubTab();
      const fRef = this.state.focusedReferenciaId();

      if (sub === 'tecnicos' || sub === 'herramientas') {
        this.pestanaActiva.set(sub);
        this.filtroTecnicos.set('TODOS');
        this.filtroHerramientas.set('TODAS');
        this.busquedaTexto.set('');
        if (!fRef) return;
      }

      if (fRef) {
        this.filtroTecnicos.set('TODOS');
        this.filtroHerramientas.set('TODAS');
        this.busquedaTexto.set('');
        if (this.state.herramientas().some((h) => h.id === fRef)) {
          this.pestanaActiva.set('herramientas');
        } else if (this.state.tecnicos().some((t) => t.id === fRef)) {
          this.pestanaActiva.set('tecnicos');
        }
      }
    });
  }

  toNum(v: unknown): number {
    const n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  }

  resumenTecnicos = computed(() => {
    const list = this.state.tecnicos();
    let activos = 0;
    let bloqueados = 0;
    let sumaEstrellas = 0;
    let nominaFijaUsd = 0;

    for (const t of list) {
      if (t.bloqueadoPorMalTrabajo) bloqueados += 1;
      else {
        activos += 1;
        if (t.modalidad === 'SUELDO_FIJO') {
          nominaFijaUsd += this.toNum(t.sueldoFijoMensualUsd);
        }
      }
      sumaEstrellas += this.toNum(t.promedioEstrellas || 5);
    }

    return {
      activos,
      bloqueados,
      promedioEstrellas: list.length ? (sumaEstrellas / list.length).toFixed(1) : '5.0',
      nominaFijaUsd: Math.round(nominaFijaUsd * 100) / 100,
    };
  });

  resumenHerramientas = computed(() => {
    let activas = 0;
    let bajas = 0;
    let compras = 0;
    let valorActivoUsd = 0;
    let valorBajaUsd = 0;

    for (const h of this.state.herramientas()) {
      const costo = this.toNum(h.costoCompraUsd);
      if (h.estado === 'ACTIVA') {
        activas += 1;
        valorActivoUsd += costo;
      } else if (h.estado === 'DADA_DE_BAJA') {
        bajas += 1;
        valorBajaUsd += costo;
      } else {
        compras += 1;
      }
    }

    return {
      activas,
      bajas,
      compras,
      valorActivoUsd: Math.round(valorActivoUsd * 100) / 100,
      valorBajaUsd: Math.round(valorBajaUsd * 100) / 100,
    };
  });

  tecnicosFiltrados = computed(() => {
    const f = this.filtroTecnicos();
    const q = this.busquedaTexto().trim().toLowerCase();
    return this.state.tecnicos().filter((t) => {
      if (f === 'HABILITADOS' && t.bloqueadoPorMalTrabajo) return false;
      if (f === 'BLOQUEADOS' && !t.bloqueadoPorMalTrabajo) return false;
      if (!q) return true;
      return `${t.nombre} ${t.especialidad} ${t.observacionDesempeno || ''}`.toLowerCase().includes(q);
    });
  });

  herramientasFiltradas = computed(() => {
    const f = this.filtroHerramientas();
    const q = this.busquedaTexto().trim().toLowerCase();
    return this.state.herramientas().filter((h) => {
      if (f !== 'TODAS' && h.estado !== f) return false;
      if (!q) return true;
      return `${h.nombre} ${h.responsableBaja || ''} ${h.detalleBaja || ''}`.toLowerCase().includes(q);
    });
  });

  limpiarFiltros() {
    this.filtroTecnicos.set('TODOS');
    this.filtroHerramientas.set('TODAS');
    this.busquedaTexto.set('');
    this.state.clearNotificationFocus();
  }

  formatEspecialidad(esp: string): string {
    const m: Record<string, string> = {
      CHAPERO: 'Chapería (Desabollador)',
      PINTOR: 'Pintura y Horno',
      MECANICO_PLANTA: 'Mecánico de Planta',
      ELECTRICO_EXTERNO: 'Eléctrico Externo',
      AIRBAG_PLASTICOS_EXTERNO: 'Airbag / Plásticos',
      SOLDADOR_EXTERNO: 'Soldador Especializado',
    };
    return m[esp] || esp;
  }

  toggleCrearTecnico() {
    this.mostrarCrearTecnico.set(!this.mostrarCrearTecnico());
    this.errorMsg.set('');
  }

  guardarNuevoTecnico() {
    this.errorMsg.set('');
    if (!this.nuevoTecnico.nombre || this.nuevoTecnico.nombre.trim().length < 3) {
      this.errorMsg.set('Indica el nombre completo del técnico o contratista.');
      return;
    }
    this.creandoTecnico.set(true);
    const nombreGuardado = this.nuevoTecnico.nombre.trim();
    this.state.crearTecnico(
      {
        nombre: nombreGuardado,
        especialidad: this.nuevoTecnico.especialidad,
        modalidad: this.nuevoTecnico.modalidad,
        sueldoFijoMensualUsd: this.toNum(this.nuevoTecnico.sueldoFijoMensualUsd),
        observacionDesempeno: this.nuevoTecnico.observacionDesempeno.trim() || undefined,
      },
      () => {
        this.creandoTecnico.set(false);
        this.feedbackMsg.set(`Especialista "${nombreGuardado}" registrado y auditado.`);
        this.nuevoTecnico = {
          nombre: '',
          especialidad: 'CHAPERO',
          modalidad: 'CONTRATO_PIEZA',
          sueldoFijoMensualUsd: 0,
          observacionDesempeno: '',
        };
        this.mostrarCrearTecnico.set(false);
      },
      (err) => {
        this.creandoTecnico.set(false);
        this.errorMsg.set(err);
      },
    );
  }

  abrirEdicionTecnico(tec: any) {
    if (this.editandoTecnicoId() === tec.id) {
      this.editandoTecnicoId.set(null);
      return;
    }
    this.editTecnicoForm = {
      nombre: tec.nombre || '',
      especialidad: tec.especialidad || 'CHAPERO',
      modalidad: tec.modalidad || 'CONTRATO_PIEZA',
      sueldoFijoMensualUsd: this.toNum(tec.sueldoFijoMensualUsd),
      observacionDesempeno: tec.observacionDesempeno || '',
      motivoEdicion: '',
    };
    this.editandoTecnicoId.set(tec.id);
    this.errorMsg.set('');
  }

  guardarEdicionTecnico() {
    const id = this.editandoTecnicoId();
    if (!id) return;
    if (this.editTecnicoForm.nombre.trim().length < 3) {
      this.errorMsg.set('El nombre completo debe tener al menos 3 caracteres.');
      return;
    }
    if (this.editTecnicoForm.motivoEdicion.trim().length < 4) {
      this.errorMsg.set('Ingresa el motivo obligatorio de edición (mínimo 4 caracteres).');
      return;
    }

    this.guardandoEdicionTec.set(true);
    this.errorMsg.set('');
    this.state.editarTecnico(
      id,
      {
        nombre: this.editTecnicoForm.nombre.trim(),
        especialidad: this.editTecnicoForm.especialidad,
        modalidad: this.editTecnicoForm.modalidad,
        sueldoFijoMensualUsd: this.toNum(this.editTecnicoForm.sueldoFijoMensualUsd),
        observacionDesempeno: this.editTecnicoForm.observacionDesempeno.trim(),
        motivoEdicion: this.editTecnicoForm.motivoEdicion.trim(),
      },
      () => {
        this.guardandoEdicionTec.set(false);
        this.editandoTecnicoId.set(null);
        this.feedbackMsg.set('Datos del especialista actualizados en el directorio y auditoría.');
      },
      (err) => {
        this.guardandoEdicionTec.set(false);
        this.errorMsg.set(err);
      },
    );
  }

  abrirModalBloqueo(t: any) {
    this.tecnicoSeleccionado.set(t);
    this.motivoBloqueo = '';
    this.modalBloqueoError.set('');
  }

  confirmarToggleBloqueo() {
    const t = this.tecnicoSeleccionado();
    if (!t) return;
    if (!this.motivoBloqueo || this.motivoBloqueo.trim().length < 5) {
      this.modalBloqueoError.set('Debes escribir un motivo justificado de al menos 5 caracteres.');
      return;
    }
    this.modalBloqueoError.set('');
    this.guardandoBloqueo.set(true);
    this.state.toggleBloqueoTecnico(
      t.id,
      this.motivoBloqueo.trim(),
      () => {
        this.guardandoBloqueo.set(false);
        this.feedbackMsg.set(
          `Estado de ${t.nombre} actualizado (${!t.bloqueadoPorMalTrabajo ? 'Bloqueado' : 'Habilitado'}).`,
        );
        this.tecnicoSeleccionado.set(null);
      },
      (err) => {
        this.guardandoBloqueo.set(false);
        this.modalBloqueoError.set(err);
      },
    );
  }

  toggleCrearHerramienta() {
    this.mostrarCrearHerramienta.set(!this.mostrarCrearHerramienta());
    this.errorMsg.set('');
  }

  solicitarReemplazoBaja(her: any) {
    this.nuevaHerramienta = {
      nombre: `${her.nombre} (Reposición)`,
      costoCompraUsd: this.toNum(her.costoCompraUsd),
      estado: 'COMPRA_SOLICITADA',
      detalleBaja: `Reposición solicitada tras baja previa por ${her.tipoCausaBaja || 'daño'}.`,
    };
    this.mostrarCrearHerramienta.set(true);
    this.errorMsg.set('');
  }

  guardarNuevaHerramienta() {
    this.errorMsg.set('');
    if (!this.nuevaHerramienta.nombre || this.nuevaHerramienta.nombre.trim().length < 3) {
      this.errorMsg.set('Indica el nombre de la herramienta o equipo.');
      return;
    }
    this.creandoHerramienta.set(true);
    const nombreGuardado = this.nuevaHerramienta.nombre.trim();
    const esSolicitud = this.nuevaHerramienta.estado === 'COMPRA_SOLICITADA';
    this.state.crearHerramienta(
      {
        nombre: nombreGuardado,
        costoCompraUsd: this.toNum(this.nuevaHerramienta.costoCompraUsd),
        estado: this.nuevaHerramienta.estado,
        detalleBaja: this.nuevaHerramienta.detalleBaja.trim() || undefined,
      },
      () => {
        this.creandoHerramienta.set(false);
        this.feedbackMsg.set(
          esSolicitud
            ? `Solicitud de compra "${nombreGuardado}" enviada a Bolivia.`
            : `Herramienta "${nombreGuardado}" ingresada al inventario activo.`,
        );
        this.nuevaHerramienta = {
          nombre: '',
          costoCompraUsd: 0,
          estado: 'ACTIVA',
          detalleBaja: '',
        };
        this.mostrarCrearHerramienta.set(false);
      },
      (err) => {
        this.creandoHerramienta.set(false);
        this.errorMsg.set(err);
      },
    );
  }

  abrirEdicionHerramienta(her: any) {
    if (this.editandoHerramientaId() === her.id) {
      this.editandoHerramientaId.set(null);
      return;
    }
    this.editHerramientaForm = {
      nombre: her.nombre || '',
      costoCompraUsd: this.toNum(her.costoCompraUsd),
      motivoEdicion: '',
    };
    this.editandoHerramientaId.set(her.id);
    this.errorMsg.set('');
  }

  guardarEdicionHerramienta() {
    const id = this.editandoHerramientaId();
    if (!id) return;
    if (this.editHerramientaForm.nombre.trim().length < 3) {
      this.errorMsg.set('El nombre debe tener al menos 3 caracteres.');
      return;
    }
    if (this.editHerramientaForm.motivoEdicion.trim().length < 4) {
      this.errorMsg.set('Ingresa el motivo obligatorio de edición (mínimo 4 caracteres).');
      return;
    }

    this.guardandoEdicionHer.set(true);
    this.errorMsg.set('');
    this.state.editarHerramienta(
      id,
      {
        nombre: this.editHerramientaForm.nombre.trim(),
        costoCompraUsd: this.toNum(this.editHerramientaForm.costoCompraUsd),
        motivoEdicion: this.editHerramientaForm.motivoEdicion.trim(),
      },
      () => {
        this.guardandoEdicionHer.set(false);
        this.editandoHerramientaId.set(null);
        this.feedbackMsg.set('Herramienta actualizada y registrada en auditoría.');
      },
      (err) => {
        this.guardandoEdicionHer.set(false);
        this.errorMsg.set(err);
      },
    );
  }

  abrirModalActivar(her: any) {
    this.herramientaParaActivar.set(her);
    this.activarForm = {
      costoCompraUsd: this.toNum(her.costoCompraUsd),
      motivo: '',
    };
    this.errorMsg.set('');
  }

  confirmarIngresoCompra() {
    const ha = this.herramientaParaActivar();
    if (!ha) return;
    this.activandoHerramienta.set(true);
    this.state.activarHerramientaCompra(
      ha.id,
      {
        costoCompraUsd: this.toNum(this.activarForm.costoCompraUsd),
        motivo: this.activarForm.motivo.trim() || undefined,
      },
      () => {
        this.activandoHerramienta.set(false);
        this.herramientaParaActivar.set(null);
        this.feedbackMsg.set(`"${ha.nombre}" pasó a estado ACTIVA EN TALLER.`);
      },
      (err) => {
        this.activandoHerramienta.set(false);
        this.errorMsg.set(err);
      },
    );
  }

  abrirModalBaja(her: any) {
    this.herramientaParaBaja.set(her);
    this.archivoFotoBajaWebp = null;
    this.previewBajaUrl.set('');
    this.compresionBajaInfo.set('');
    this.bajaForm = {
      tipoCausaBaja: 'MAL_USO_COBRAR',
      responsableBaja: '',
      detalleBaja: '',
      descripcionFotoBaja: `Evidencia rotura/daño: ${her.nombre}`,
    };
    this.errorMsg.set('');
  }

  cerrarBaja() {
    this.revocarPreviewBaja();
    this.herramientaParaBaja.set(null);
    this.archivoFotoBajaWebp = null;
    this.compresionBajaInfo.set('');
  }

  private revocarPreviewBaja() {
    const url = this.previewBajaUrl();
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
    this.previewBajaUrl.set('');
  }

  async alSeleccionarFotoBaja(event: Event, input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;

    this.comprimiendoFotoBaja.set(true);
    this.errorMsg.set('');
    try {
      const res = await comprimirImagenNavegadorWebp(file, 1400, 0.82);
      this.revocarPreviewBaja();
      this.archivoFotoBajaWebp = res.file;
      this.previewBajaUrl.set(res.previewUrl);
      this.compresionBajaInfo.set('Fotografía lista para registrar baja');
      input.value = '';
    } catch (err: any) {
      this.errorMsg.set(err?.message || 'No se pudo procesar o comprimir la imagen.');
      input.value = '';
    } finally {
      this.comprimiendoFotoBaja.set(false);
    }
  }

  limpiarFotoBaja(input: HTMLInputElement) {
    this.revocarPreviewBaja();
    this.archivoFotoBajaWebp = null;
    this.compresionBajaInfo.set('');
    input.value = '';
  }

  confirmarBajaHerramienta() {
    const her = this.herramientaParaBaja();
    if (!her) return;
    this.errorMsg.set('');

    if (!this.bajaForm.responsableBaja || this.bajaForm.responsableBaja.trim().length < 3) {
      this.errorMsg.set('Indica la persona o técnico responsable.');
      return;
    }
    if (!this.bajaForm.detalleBaja || this.bajaForm.detalleBaja.trim().length < 5) {
      this.errorMsg.set('Describe las circunstancias o motivo del daño.');
      return;
    }
    if (!this.archivoFotoBajaWebp) {
      this.errorMsg.set('Adjunta la fotografía obligatoria de la herramienta dañada.');
      return;
    }
    if (!this.bajaForm.descripcionFotoBaja || this.bajaForm.descripcionFotoBaja.trim().length < 5) {
      this.errorMsg.set('Escribe una descripción para la fotografía de respaldo.');
      return;
    }

    this.procesandoBaja.set(true);
    this.state.subirEvidenciaConDetalle(
      this.archivoFotoBajaWebp,
      {
        moduloOrigen: 'BAJA_HERRAMIENTA',
        referenciaId: her.id,
        vehiculoReferencia: `Herramienta Taller: ${her.nombre}`,
        tituloDetalle: `Baja Herramienta: ${her.nombre}`,
        descripcionBreve: this.bajaForm.descripcionFotoBaja.trim(),
        skipBootstrapReload: true,
      },
      (ev) => {
        this.state.darDeBajaHerramienta(
          her.id,
          {
            tipoCausaBaja: this.bajaForm.tipoCausaBaja,
            responsableBaja: this.bajaForm.responsableBaja.trim(),
            detalleBaja: this.bajaForm.detalleBaja.trim(),
            fotoHerramientaRotaWebp: ev.archivoWebpUrl,
            descripcionFotoBaja: this.bajaForm.descripcionFotoBaja.trim(),
          },
          () => {
            this.procesandoBaja.set(false);
            this.cerrarBaja();
            this.feedbackMsg.set(
              `Baja de "${her.nombre}" registrada con respaldo fotográfico e historial de auditoría.`,
            );
          },
          (err) => {
            this.procesandoBaja.set(false);
            this.errorMsg.set(err);
          },
        );
      },
      (err) => {
        this.procesandoBaja.set(false);
        this.errorMsg.set(err);
      },
    );
  }

  abrirLightbox(url: string, titulo: string, descripcion: string) {
    this.lightbox.set({ url, titulo, descripcion });
  }
}
