import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../core/services/app-state.service';
import { AuditHistoryPanelComponent } from '../../shared/components/audit-history-panel/audit-history-panel.component';
import {
  InformeFinalPdfInput,
  generarYDescargarInformePdf,
} from '../../core/utils/pdf-report-generator';

type FiltroReporte = 'TODOS' | 'FINALIZADO' | 'EN_PROCESO' | 'CON_UTILIDAD' | 'CON_PERDIDA';

@Component({
  selector: 'app-reportes-financieros',
  standalone: true,
  imports: [CommonModule, FormsModule, AuditHistoryPanelComponent],
  template: `
    @if (!state.puedeVerReportes()) {
      <div class="no-print max-w-2xl mx-auto mt-10 p-8 bg-rose-950/30 border border-rose-500/40 rounded-2xl text-center space-y-3">
        <div class="w-14 h-14 mx-auto rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
          <i class="ri-shield-keyhole-line text-3xl"></i>
        </div>
        <h3 class="text-lg font-bold text-rose-200">Acceso Restringido — Módulo Financiero Privado (Bolivia)</h3>
        <p class="text-sm text-rose-300/80 leading-relaxed">
          Por seguridad empresarial, el cálculo de costos de mano de obra interna, costos de importación, prorrateo de gastos fijos
          y márgenes reales está oculto para perfiles de sede Chile.
        </p>
      </div>
    } @else {
      <div class="no-print space-y-6 animate-fade-in">
        <!-- Encabezado y Acciones Principales -->
        <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div class="space-y-1">
            <div class="flex items-center gap-2.5 flex-wrap">
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <i class="ri-bar-chart-box-line text-cyan-400"></i>
                <span>Cierre Financiero, Costeo Real y Reporte Final</span>
              </h2>
              <span class="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                Exclusivo Bolivia
              </span>
            </div>
            <p class="text-xs text-slate-400 leading-relaxed">
              Prorrateo de gastos fijos:
              <strong class="text-slate-200">{{ state.formatMoney(gastosFijosActuales()) }}/mes</strong>
              ÷
              <strong class="text-slate-200">{{ totalProductivos() }} unidades activas</strong>
              • T/C:
              <strong class="text-cyan-300">{{ tasaCambioActual() }} CLP/USD</strong>
              • Multa atraso:
              <strong class="text-amber-300">{{ state.formatMoney(multaAtrasoActual()) }}/día</strong>
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              (click)="exportarCsvCosteo()"
              [disabled]="!vehiculosFiltrados().length"
              class="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i class="ri-file-excel-2-line text-sm"></i>
              <span>Exportar CSV Costeo</span>
            </button>

            <button
              type="button"
              (click)="cargarDatosFinancieros()"
              [disabled]="cargando()"
              class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer disabled:opacity-60"
            >
              <i class="ri-refresh-line text-sm" [class.animate-spin]="cargando()"></i>
              <span>{{ cargando() ? 'Calculando...' : 'Recalcular Costeo' }}</span>
            </button>
          </div>
        </div>

        <!-- Mensajes de Feedback / Error -->
        @if (errorMsg()) {
          <div class="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <i class="ri-error-warning-line text-base text-rose-400"></i>
              <span>{{ errorMsg() }}</span>
            </div>
            <button type="button" (click)="errorMsg.set(null)" class="text-rose-300 hover:text-white cursor-pointer">
              <i class="ri-close-line text-base"></i>
            </button>
          </div>
        }

        @if (actionMsg()) {
          <div class="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-xs text-emerald-200 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <i class="ri-checkbox-circle-line text-base text-emerald-400"></i>
              <span>{{ actionMsg() }}</span>
            </div>
            <button type="button" (click)="actionMsg.set(null)" class="text-emerald-300 hover:text-white cursor-pointer">
              <i class="ri-close-line text-base"></i>
            </button>
          </div>
        }

        <!-- KPIs Globales Clickables -->
        @if (reporteData(); as rep) {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              type="button"
              (click)="toggleFiltro('TODOS')"
              class="text-left glass-card rounded-2xl p-4 border transition cursor-pointer"
              [ngClass]="
                filtroActivo() === 'TODOS'
                  ? 'border-cyan-400 ring-1 ring-cyan-400/50 bg-cyan-950/20'
                  : 'border-slate-800 hover:border-slate-700'
              "
            >
              <div class="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Ingresos Facturados (Cliente)</span>
                <i class="ri-wallet-3-line text-slate-300 text-base"></i>
              </div>
              <div class="text-xl font-bold text-white font-mono">
                {{ state.formatMoney(rep.totalesGlobales?.ingresosTotalesUsd || 0) }}
              </div>
              <div class="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span>{{ rep.totalVehiculos }} unidades totales</span>
                <span class="text-cyan-400 font-semibold">{{ rep.totalVehiculosProductivos }} activas</span>
              </div>
            </button>

            <button
              type="button"
              (click)="toggleFiltro('FINALIZADO')"
              class="text-left glass-card rounded-2xl p-4 border transition cursor-pointer"
              [ngClass]="
                filtroActivo() === 'FINALIZADO'
                  ? 'border-emerald-400 ring-1 ring-emerald-400/50 bg-emerald-950/20'
                  : 'border-amber-500/30 hover:border-amber-400/50'
              "
            >
              <div class="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Costos Directos Operativos</span>
                <i class="ri-tools-line text-amber-400 text-base"></i>
              </div>
              <div class="text-xl font-bold text-amber-300 font-mono">
                {{ state.formatMoney(rep.totalesGlobales?.costosDirectosTotalesUsd || 0) }}
              </div>
              <div class="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span>MO + Rep. + Pintura + Almacén + Grúa</span>
                <span class="text-emerald-300 font-semibold">{{ conteoEstado().finalizados }} listos</span>
              </div>
            </button>

            <button
              type="button"
              (click)="toggleFiltro('EN_PROCESO')"
              class="text-left glass-card rounded-2xl p-4 border transition cursor-pointer"
              [ngClass]="
                filtroActivo() === 'EN_PROCESO'
                  ? 'border-purple-400 ring-1 ring-purple-400/50 bg-purple-950/20'
                  : 'border-purple-500/30 hover:border-purple-400/50'
              "
            >
              <div class="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Costos Totales + Prorrateo Fijo</span>
                <i class="ri-building-2-line text-purple-400 text-base"></i>
              </div>
              <div class="text-xl font-bold text-purple-300 font-mono">
                {{ state.formatMoney(rep.totalesGlobales?.costosTotalesConGastosFijosUsd || 0) }}
              </div>
              <div class="text-[11px] text-purple-300/80 mt-1 flex items-center justify-between">
                <span>Prorrateo: {{ state.formatMoney(rep.prorrateoPorVehiculoUsd || 0) }}/auto</span>
                <span>{{ conteoEstado().enProceso }} en taller</span>
              </div>
            </button>

            <button
              type="button"
              (click)="toggleFiltro('CON_PERDIDA')"
              class="text-left glass-card rounded-2xl p-4 border transition cursor-pointer"
              [ngClass]="
                filtroActivo() === 'CON_PERDIDA'
                  ? 'border-rose-400 ring-1 ring-rose-400/50 bg-rose-950/20'
                  : (rep.totalesGlobales?.utilidadNetaGlobalUsd || 0) >= 0
                    ? 'border-emerald-500/40 bg-emerald-950/10 hover:border-emerald-400/60'
                    : 'border-rose-500/40 bg-rose-950/10 hover:border-rose-400/60'
              "
            >
              <div class="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Utilidad Neta Real (Global)</span>
                <i
                  class="ri-line-chart-line text-base"
                  [ngClass]="(rep.totalesGlobales?.utilidadNetaGlobalUsd || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'"
                ></i>
              </div>
              <div
                class="text-xl font-bold font-mono"
                [ngClass]="(rep.totalesGlobales?.utilidadNetaGlobalUsd || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'"
              >
                {{ state.formatMoney(rep.totalesGlobales?.utilidadNetaGlobalUsd || 0) }}
              </div>
              <div
                class="text-[11px] mt-1 font-semibold flex items-center justify-between"
                [ngClass]="(rep.totalesGlobales?.utilidadNetaGlobalUsd || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'"
              >
                <span>Margen global: {{ rep.totalesGlobales?.margenGlobalPorcentaje || 0 }}%</span>
                <span class="text-rose-300" *ngIf="conteoEstado().conPerdida > 0">
                  {{ conteoEstado().conPerdida }} en pérdida
                </span>
              </div>
            </button>
          </div>
        }

        <!-- Barra de Búsqueda + Filtros -->
        <div class="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div class="relative flex-1 max-w-md">
            <i class="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input
              type="text"
              [(ngModel)]="busquedaTexto"
              (ngModelChange)="onBusquedaChange($event)"
              placeholder="Buscar por VIN, placa/lote, marca, modelo o cliente..."
              class="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div class="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              (click)="filtroActivo.set('TODOS')"
              class="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer border"
              [ngClass]="
                filtroActivo() === 'TODOS'
                  ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/60'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              "
            >
              Todos ({{ conteoEstado().todos }})
            </button>
            <button
              type="button"
              (click)="filtroActivo.set('FINALIZADO')"
              class="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer border"
              [ngClass]="
                filtroActivo() === 'FINALIZADO'
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/60'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              "
            >
              Finalizados ({{ conteoEstado().finalizados }})
            </button>
            <button
              type="button"
              (click)="filtroActivo.set('EN_PROCESO')"
              class="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer border"
              [ngClass]="
                filtroActivo() === 'EN_PROCESO'
                  ? 'bg-amber-500/20 text-amber-200 border-amber-400/60'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              "
            >
              En Proceso ({{ conteoEstado().enProceso }})
            </button>
            <button
              type="button"
              (click)="filtroActivo.set('CON_UTILIDAD')"
              class="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer border"
              [ngClass]="
                filtroActivo() === 'CON_UTILIDAD'
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/60'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              "
            >
              Rentables ({{ conteoEstado().conUtilidad }})
            </button>
            <button
              type="button"
              (click)="filtroActivo.set('CON_PERDIDA')"
              class="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer border"
              [ngClass]="
                filtroActivo() === 'CON_PERDIDA'
                  ? 'bg-rose-500/20 text-rose-200 border-rose-400/60'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              "
            >
              En Pérdida ({{ conteoEstado().conPerdida }})
            </button>

            @if (hayFiltrosActivos()) {
              <button
                type="button"
                (click)="limpiarFiltros()"
                class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 font-semibold transition cursor-pointer flex items-center gap-1"
              >
                <i class="ri-filter-off-line"></i>
                <span>Limpiar filtros</span>
              </button>
            }
          </div>
        </div>

        <!-- Tabla Maestra de Costeo por Vehículo -->
        <div class="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          <div class="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900/60">
            <div>
              <h3 class="text-sm font-bold text-white flex items-center gap-2">
                <i class="ri-table-line text-cyan-400"></i>
                <span>Desglose de Costeo Completo por Vehículo (incluye Grúa/Naviera y Prorrateo)</span>
              </h3>
              <p class="text-[11px] text-slate-400">
                Mostrando <strong class="text-slate-200">{{ vehiculosFiltrados().length }}</strong> de {{ totalVehiculosBase() }} vehículos registrados.
              </p>
            </div>
            <span class="text-[11px] text-slate-400">
              Prorrateo activo: <strong class="text-purple-300 font-mono">{{ state.formatMoney(reporteData()?.prorrateoPorVehiculoUsd || 0) }}</strong> / unidad
            </span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th class="px-4 py-3 font-semibold min-w-[230px]">Vehículo / Evidencias</th>
                  <th class="px-3 py-3 font-semibold text-right whitespace-nowrap">Cobrado</th>
                  <th class="px-3 py-3 font-semibold text-right whitespace-nowrap">Mano Obra</th>
                  <th class="px-3 py-3 font-semibold text-right whitespace-nowrap">Repuestos</th>
                  <th class="px-3 py-3 font-semibold text-right whitespace-nowrap">Almacén</th>
                  <th class="px-3 py-3 font-semibold text-right whitespace-nowrap">Colorista</th>
                  <th class="px-3 py-3 font-semibold text-right whitespace-nowrap">Grúa/Nav.</th>
                  <th class="px-3 py-3 font-semibold text-right whitespace-nowrap">Prorrateo</th>
                  <th class="px-3 py-3 font-semibold text-right whitespace-nowrap">Costo Real</th>
                  <th class="px-3 py-3 font-semibold text-right whitespace-nowrap">Utilidad / %</th>
                  <th class="px-4 py-3 font-semibold text-center whitespace-nowrap">Informe Cliente</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/80">
                @for (v of vehiculosFiltrados(); track v.vehiculoId) {
                  <tr
                    [attr.data-focus-vehiculo]="v.vehiculoId"
                    class="transition"
                    [ngClass]="
                      state.focusedVehiculoId() === v.vehiculoId
                        ? 'bg-cyan-950/35 ring-1 ring-inset ring-cyan-400/70'
                        : 'hover:bg-slate-800/35'
                    "
                  >
                    <td class="px-4 py-3 align-top">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-bold text-white">{{ v.marca }} {{ v.modelo }}</span>
                        @if (v.anio) {
                          <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">{{ v.anio }}</span>
                        }
                        <span
                          class="text-[10px] px-2 py-0.5 rounded-full font-semibold border"
                          [ngClass]="estadoBadgeClass(v.estado)"
                        >
                          {{ etiquetaEstado(v.estado) }}
                        </span>
                      </div>
                      <div class="text-[11px] text-slate-400 font-mono mt-0.5">
                        {{ v.vinChasis }} • {{ v.placaOLote }} ({{ v.color }})
                      </div>
                      <div class="text-[10px] text-slate-400 mt-0.5">
                        Cliente: <strong class="text-slate-300">{{ v.nombreCliente }}</strong>
                      </div>
                      <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span
                          class="text-[10px] px-1.5 py-0.5 rounded border font-medium"
                          [ngClass]="
                            v.fotosAntesCount > 0 && v.fotosDespuesCount > 0
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                          "
                        >
                          Fotos A:{{ v.fotosAntesCount }} / D:{{ v.fotosDespuesCount }}
                        </span>
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300">
                          OT {{ v.tareasCompletadasCount }}/{{ v.totalTareasOt }}
                        </span>
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300">
                          Rep {{ v.totalRepuestos }}
                        </span>
                      </div>
                    </td>

                    <td class="px-3 py-3 text-right font-mono font-semibold text-white whitespace-nowrap">
                      {{ state.formatMoney(v.precioCobradoClienteUsd) }}
                    </td>

                    <td class="px-3 py-3 text-right font-mono text-slate-200 whitespace-nowrap">
                      <div>{{ state.formatMoney(v.costoManoObraUsd) }}</div>
                      @if (v.multasAplicadasUsd > 0) {
                        <div class="text-[10px] text-amber-400">
                          -{{ state.formatMoney(v.multasAplicadasUsd) }} multa
                        </div>
                      }
                    </td>

                    <td class="px-3 py-3 text-right font-mono text-slate-300 whitespace-nowrap">
                      {{ state.formatMoney(v.costoRepuestosUsd) }}
                    </td>

                    <td class="px-3 py-3 text-right font-mono text-slate-300 whitespace-nowrap">
                      {{ state.formatMoney(v.costoInsumosAlmacenUsd) }}
                    </td>

                    <td class="px-3 py-3 text-right font-mono text-amber-300 whitespace-nowrap">
                      {{ state.formatMoney(v.costoPinturaColoristaUsd) }}
                    </td>

                    <td class="px-3 py-3 text-right font-mono text-cyan-300 whitespace-nowrap">
                      {{ state.formatMoney(v.costoGruaNavieraUsd || 0) }}
                    </td>

                    <td class="px-3 py-3 text-right font-mono whitespace-nowrap">
                      @if (v.estado === 'RETIRADO_SIN_REPARAR') {
                        <span class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">Exento</span>
                      } @else {
                        <span class="text-purple-300">{{ state.formatMoney(v.prorrateoGastosFijosUsd) }}</span>
                      }
                    </td>

                    <td class="px-3 py-3 text-right font-mono font-semibold text-slate-200 whitespace-nowrap">
                      <div>{{ state.formatMoney(v.costoTotalRealUsd) }}</div>
                      <div class="text-[10px] text-slate-500">Dir: {{ state.formatMoney(v.costoDirectoTotalUsd) }}</div>
                    </td>

                    <td
                      class="px-3 py-3 text-right font-mono font-bold whitespace-nowrap"
                      [ngClass]="v.utilidadNetaUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'"
                    >
                      <div>{{ state.formatMoney(v.utilidadNetaUsd) }}</div>
                      <div class="text-[10px] font-semibold">{{ v.margenPorcentaje }}%</div>
                    </td>

                    <td class="px-4 py-3 text-center whitespace-nowrap">
                      <div class="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          (click)="abrirModalInformePdf(v.vehiculoId)"
                          [disabled]="cargandoInformeId() === v.vehiculoId"
                          class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                          title="Abrir vista previa del informe cliente"
                        >
                          <i class="ri-eye-line text-cyan-400"></i>
                          <span>Ver Informe</span>
                        </button>

                        <button
                          type="button"
                          (click)="descargarPdfDirectoFila(v.vehiculoId)"
                          [disabled]="generandoPdfId() === v.vehiculoId"
                          class="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/40 text-rose-200 text-[11px] font-semibold inline-flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                          title="Descargar Informe Final PDF con fotos Antes/Después"
                        >
                          <i
                            class="text-rose-300"
                            [ngClass]="generandoPdfId() === v.vehiculoId ? 'ri-loader-4-line animate-spin' : 'ri-file-pdf-2-line'"
                          ></i>
                          <span>{{ generandoPdfId() === v.vehiculoId ? 'PDF...' : 'PDF' }}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="11" class="px-4 py-10 text-center text-slate-400">
                      @if (cargando()) {
                        <span>Calculando costeo financiero del taller...</span>
                      } @else {
                        <span>No hay vehículos que coincidan con el filtro seleccionado.</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>

              @if (vehiculosFiltrados().length > 0) {
                <tfoot class="bg-slate-950/80 border-t-2 border-slate-700 text-xs font-mono">
                  <tr>
                    <td class="px-4 py-3 font-sans font-bold text-slate-200">
                      Totales Vista ({{ vehiculosFiltrados().length }} unid.)
                    </td>
                    <td class="px-3 py-3 text-right font-bold text-white whitespace-nowrap">
                      {{ state.formatMoney(totalesFiltrados().cobrado) }}
                    </td>
                    <td class="px-3 py-3 text-right font-semibold text-slate-200 whitespace-nowrap">
                      {{ state.formatMoney(totalesFiltrados().manoObra) }}
                    </td>
                    <td class="px-3 py-3 text-right font-semibold text-slate-300 whitespace-nowrap">
                      {{ state.formatMoney(totalesFiltrados().repuestos) }}
                    </td>
                    <td class="px-3 py-3 text-right font-semibold text-slate-300 whitespace-nowrap">
                      {{ state.formatMoney(totalesFiltrados().almacen) }}
                    </td>
                    <td class="px-3 py-3 text-right font-semibold text-amber-300 whitespace-nowrap">
                      {{ state.formatMoney(totalesFiltrados().colorista) }}
                    </td>
                    <td class="px-3 py-3 text-right font-semibold text-cyan-300 whitespace-nowrap">
                      {{ state.formatMoney(totalesFiltrados().grua) }}
                    </td>
                    <td class="px-3 py-3 text-right font-semibold text-purple-300 whitespace-nowrap">
                      {{ state.formatMoney(totalesFiltrados().prorrateo) }}
                    </td>
                    <td class="px-3 py-3 text-right font-bold text-slate-100 whitespace-nowrap">
                      {{ state.formatMoney(totalesFiltrados().costoReal) }}
                    </td>
                    <td
                      class="px-3 py-3 text-right font-bold whitespace-nowrap"
                      [ngClass]="totalesFiltrados().utilidad >= 0 ? 'text-emerald-400' : 'text-rose-400'"
                    >
                      {{ state.formatMoney(totalesFiltrados().utilidad) }}
                    </td>
                    <td class="px-4 py-3"></td>
                  </tr>
                </tfoot>
              }
            </table>
          </div>
        </div>

        <!-- Bitácora de Auditoría -->
        <app-audit-history-panel defaultModulo="CONFIGURACION"></app-audit-history-panel>
      </div>

      <!-- Modal Informe Final para el Cliente (PDF Automático + Impresión A4 Limpia) -->
      @if (informeCliente(); as inf) {
        <div class="print-modal-wrapper fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 overflow-y-auto py-6 px-4 flex justify-center items-start">
          <div class="print-modal-sheet max-w-4xl w-full bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden my-auto">
            <!-- Barra superior de acciones (Oculta al imprimir) -->
            <div class="no-print bg-slate-900 text-white px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="flex items-center gap-2 text-xs">
                <i class="ri-file-shield-2-line text-cyan-400 text-lg"></i>
                <div>
                  <div class="font-bold">Informe Final de Calidad y Garantía para el Cliente</div>
                  @if (pdfFeedback()) {
                    <div class="text-[11px] text-emerald-300">{{ pdfFeedback() }}</div>
                  }
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  (click)="descargarPdfModal(inf)"
                  [disabled]="generandoPdfModal()"
                  class="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                >
                  <i [ngClass]="generandoPdfModal() ? 'ri-loader-4-line animate-spin' : 'ri-download-2-line'"></i>
                  <span>{{ generandoPdfModal() ? 'Generando PDF...' : 'Descargar PDF Automático' }}</span>
                </button>

                <button
                  type="button"
                  (click)="imprimirInforme()"
                  class="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <i class="ri-printer-line"></i>
                  <span>Imprimir / Vista PDF</span>
                </button>

                <button
                  type="button"
                  (click)="cerrarModalInforme()"
                  class="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold transition cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <!-- Hoja Imprimible A4 / Letter (SIN costos ni pagos internos) -->
            <div id="hoja-informe-cliente" class="p-8 space-y-6 bg-white text-slate-900">
              <!-- Membrete Taller -->
              <div class="print-avoid-break flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
                <div>
                  <h1 class="text-2xl font-black tracking-tight text-slate-900 uppercase">
                    {{ inf.taller.nombre }}
                  </h1>
                  <p class="text-xs text-slate-600 font-semibold mt-0.5">
                    {{ inf.taller.sedeOperativa }}
                  </p>
                  <p class="text-[11px] text-slate-500 mt-1">
                    {{ inf.taller.administracion }} • {{ inf.taller.contacto }}
                  </p>
                </div>
                <div class="sm:text-right">
                  <span class="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded uppercase">
                    Certificado Nº {{ inf.garantia.certificadoId }}
                  </span>
                  <p class="text-xs text-slate-500 mt-2">
                    Fecha de Emisión: <strong class="text-slate-800">{{ inf.garantia.fechaEmision }}</strong>
                  </p>
                </div>
              </div>

              <!-- Ficha del Vehículo y Propietario -->
              <div class="print-avoid-break grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span class="text-slate-500 block text-[10px] uppercase font-semibold">Vehículo</span>
                  <strong class="text-slate-900 font-bold">
                    {{ inf.vehiculo.marca }} {{ inf.vehiculo.modelo }}
                    @if (inf.vehiculo.anio) {
                      ({{ inf.vehiculo.anio }})
                    }
                  </strong>
                </div>
                <div>
                  <span class="text-slate-500 block text-[10px] uppercase font-semibold">Color</span>
                  <strong class="text-slate-900 font-bold">{{ inf.vehiculo.color }}</strong>
                </div>
                <div>
                  <span class="text-slate-500 block text-[10px] uppercase font-semibold">VIN / Chasis</span>
                  <strong class="text-slate-900 font-mono">{{ inf.vehiculo.vinChasis }}</strong>
                </div>
                <div>
                  <span class="text-slate-500 block text-[10px] uppercase font-semibold">Lote / Placa</span>
                  <strong class="text-slate-900 font-bold">{{ inf.vehiculo.placaOLote }}</strong>
                </div>
                <div>
                  <span class="text-slate-500 block text-[10px] uppercase font-semibold">Propietario / Importadora</span>
                  <strong class="text-slate-900 font-bold">{{ inf.vehiculo.nombreCliente }}</strong>
                </div>
                <div>
                  <span class="text-slate-500 block text-[10px] uppercase font-semibold">Contacto</span>
                  <strong class="text-slate-900">{{ inf.vehiculo.telefonoCliente || 'Registrado en taller' }}</strong>
                </div>
                <div>
                  <span class="text-slate-500 block text-[10px] uppercase font-semibold">Fecha Ingreso</span>
                  <strong class="text-slate-900">{{ formatFechaCorta(inf.vehiculo.fechaIngreso) }}</strong>
                </div>
                <div>
                  <span class="text-slate-500 block text-[10px] uppercase font-semibold">Estado Final</span>
                  <strong class="text-emerald-700 font-bold">{{ etiquetaEstado(inf.vehiculo.estado) }}</strong>
                </div>
              </div>

              <!-- Inventario Check-In de Ingreso -->
              <div class="print-avoid-break space-y-2.5">
                <h2 class="text-sm font-bold text-slate-900 uppercase border-b border-slate-200 pb-1.5 flex items-center gap-2">
                  <i class="ri-clipboard-check-line text-slate-700"></i>
                  <span>Inventario Físico Verificado en Recepción (Check-In)</span>
                </h2>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span class="text-slate-600">Llanta de Auxilio</span>
                    <strong [ngClass]="inf.checkIn?.inventarioAccesorios?.llantaAuxilio ? 'text-emerald-700' : 'text-rose-700'">
                      {{ inf.checkIn?.inventarioAccesorios?.llantaAuxilio ? 'Presente' : 'Faltante' }}
                    </strong>
                  </div>
                  <div class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span class="text-slate-600">Gata y Llave de Rueda</span>
                    <strong [ngClass]="inf.checkIn?.inventarioAccesorios?.gataYrench ? 'text-emerald-700' : 'text-rose-700'">
                      {{ inf.checkIn?.inventarioAccesorios?.gataYrench ? 'Presente' : 'Faltante' }}
                    </strong>
                  </div>
                  <div class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span class="text-slate-600">Pisos Completos</span>
                    <strong [ngClass]="inf.checkIn?.inventarioAccesorios?.pisosCompletos ? 'text-emerald-700' : 'text-rose-700'">
                      {{ inf.checkIn?.inventarioAccesorios?.pisosCompletos ? 'Completos' : 'Incompletos' }}
                    </strong>
                  </div>
                  <div class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span class="text-slate-600">Radio / Pantalla Original</span>
                    <strong [ngClass]="inf.checkIn?.inventarioAccesorios?.radioOriginal ? 'text-emerald-700' : 'text-rose-700'">
                      {{ inf.checkIn?.inventarioAccesorios?.radioOriginal ? 'Presente' : 'Faltante' }}
                    </strong>
                  </div>
                  <div class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span class="text-slate-600">Airbags</span>
                    <strong [ngClass]="inf.checkIn?.inventarioAccesorios?.airbagsReventados ? 'text-rose-700' : 'text-emerald-700'">
                      {{ inf.checkIn?.inventarioAccesorios?.airbagsReventados ? 'Detonados al ingreso' : 'Íntegros' }}
                    </strong>
                  </div>
                  <div class="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span class="text-slate-600">Estado Faroles</span>
                    <strong class="text-slate-900">{{ inf.checkIn?.inventarioAccesorios?.estadoFaroles || 'Normal' }}</strong>
                  </div>
                </div>
                @if (inf.checkIn?.observaciones) {
                  <p class="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <strong class="text-slate-800">Observaciones de ingreso:</strong> {{ inf.checkIn?.observaciones }}
                  </p>
                }
              </div>

              <!-- Trabajos Ejecutados y Control de Calidad (Sin montos internos) -->
              <div class="print-avoid-break grid grid-cols-1 md:grid-cols-2 gap-5">
                <div class="space-y-2">
                  <h2 class="text-sm font-bold text-slate-900 uppercase border-b border-slate-200 pb-1.5 flex items-center gap-2">
                    <i class="ri-tools-fill text-slate-700"></i>
                    <span>Trabajos Aprobados en Cotización</span>
                  </h2>
                  <div class="space-y-1.5">
                    @for (t of inf.trabajosRealizados || []; track $index) {
                      <div class="flex items-center justify-between text-xs p-2 rounded bg-slate-50 border border-slate-100">
                        <div>
                          <span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px] mr-1.5 uppercase">
                            {{ t.categoria }}
                          </span>
                          <span class="font-semibold text-slate-800">{{ t.piezaZona }}</span>
                          @if (t.esAdendaDesarme) {
                            <span class="ml-1.5 text-[10px] text-amber-700 font-semibold">(Adenda desarme)</span>
                          }
                        </div>
                        <span class="text-[11px] text-slate-500 shrink-0">{{ t.gradoDanio || 'Terminado' }}</span>
                      </div>
                    } @empty {
                      <p class="text-xs text-slate-500 italic">Trabajos detallados según orden de servicio aprobada.</p>
                    }
                  </div>
                </div>

                <div class="space-y-2">
                  <h2 class="text-sm font-bold text-slate-900 uppercase border-b border-slate-200 pb-1.5 flex items-center gap-2">
                    <i class="ri-checkbox-multiple-line text-slate-700"></i>
                    <span>Operaciones Ejecutadas en Taller (OT)</span>
                  </h2>
                  <div class="space-y-1.5">
                    @for (op of inf.tareasCompletadasResumen || []; track $index) {
                      <div class="flex items-center justify-between text-xs p-2 rounded bg-slate-50 border border-slate-100">
                        <div class="flex items-center gap-2 min-w-0">
                          <i
                            class="text-sm shrink-0"
                            [ngClass]="op.completada ? 'ri-checkbox-circle-fill text-emerald-600' : 'ri-time-line text-amber-600'"
                          ></i>
                          <span class="font-semibold text-slate-800 truncate">{{ op.titulo }}</span>
                        </div>
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 uppercase font-semibold shrink-0">
                          {{ op.tipo }}
                        </span>
                      </div>
                    } @empty {
                      <p class="text-xs text-slate-500 italic">Tareas operativas ejecutadas bajo supervisión de control de calidad.</p>
                    }
                  </div>
                </div>
              </div>

              <!-- Comparativa Fotográfica ANTES vs DESPUÉS -->
              <div class="print-avoid-break space-y-3">
                <h2 class="text-sm font-bold text-slate-900 uppercase border-b border-slate-200 pb-1.5 flex items-center gap-2">
                  <i class="ri-image-2-line text-slate-700"></i>
                  <span>Registro Fotográfico Comparativo (Antes vs. Después)</span>
                </h2>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <!-- Columna ANTES -->
                  <div class="space-y-2">
                    <h3 class="text-xs font-bold uppercase text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 text-center">
                      ANTES DEL TRABAJO (Recepción / Desarme)
                    </h3>
                    <div class="grid grid-cols-1 gap-3">
                      @for (fa of inf.comparativaFotos?.fotosAntes || []; track $index) {
                        <div class="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                          <img
                            [src]="state.resolveMediaUrl(fa.url)"
                            (click)="lightboxUrl.set(state.resolveMediaUrl(fa.url))"
                            class="w-full h-44 object-cover cursor-zoom-in"
                            [alt]="fa.titulo || 'Evidencia antes de reparación'"
                          />
                          <div class="p-2 text-[11px]">
                            <div class="font-bold text-slate-800">{{ fa.titulo }}</div>
                            @if (fa.descripcion) {
                              <div class="text-slate-500">{{ fa.descripcion }}</div>
                            }
                          </div>
                        </div>
                      } @empty {
                        <div class="p-8 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400">
                          Sin fotografías previas registradas.
                        </div>
                      }
                    </div>
                  </div>

                  <!-- Columna DESPUÉS -->
                  <div class="space-y-2">
                    <h3 class="text-xs font-bold uppercase text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 text-center">
                      DESPUÉS DE PINTURA Y ARMADO (Entrega Final)
                    </h3>
                    <div class="grid grid-cols-1 gap-3">
                      @for (fd of inf.comparativaFotos?.fotosDespues || []; track $index) {
                        <div class="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                          <img
                            [src]="state.resolveMediaUrl(fd.url)"
                            (click)="lightboxUrl.set(state.resolveMediaUrl(fd.url))"
                            class="w-full h-44 object-cover cursor-zoom-in"
                            [alt]="fd.titulo || 'Evidencia después de reparación'"
                          />
                          <div class="p-2 text-[11px]">
                            <div class="font-bold text-slate-800">{{ fd.titulo }}</div>
                            @if (fd.descripcion) {
                              <div class="text-slate-500">{{ fd.descripcion }}</div>
                            }
                          </div>
                        </div>
                      } @empty {
                        <div class="p-8 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400">
                          Pendiente adjuntar fotografía de entrega final en Órdenes de Trabajo.
                        </div>
                      }
                    </div>
                  </div>
                </div>
              </div>

              <!-- Garantía y Firmas -->
              <div class="print-avoid-break pt-4 border-t-2 border-slate-200 space-y-5">
                <div class="bg-slate-900 text-white p-4 rounded-xl flex items-start gap-3">
                  <i class="ri-verified-badge-fill text-2xl text-emerald-400 shrink-0 mt-0.5"></i>
                  <div class="text-xs leading-relaxed">
                    <strong class="block text-emerald-300 uppercase mb-1">Certificado de Garantía y Calidad</strong>
                    {{ inf.garantia.cobertura }}
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-8 pt-6 text-center text-xs">
                  <div class="border-t border-slate-400 pt-2">
                    <div class="font-bold text-slate-900">Jefatura de Taller / Control de Calidad</div>
                    <div class="text-slate-500">{{ inf.taller.sedeOperativa }}</div>
                  </div>
                  <div class="border-t border-slate-400 pt-2">
                    <div class="font-bold text-slate-900">Recepción Conforme del Cliente</div>
                    <div class="text-slate-500">{{ inf.vehiculo.nombreCliente }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Lightbox de Fotografía (Solo Pantalla) -->
      @if (lightboxUrl(); as url) {
        <div
          class="no-print fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
          (click)="lightboxUrl.set(null)"
        >
          <button
            type="button"
            (click)="lightboxUrl.set(null)"
            class="absolute top-4 right-4 w-10 h-10 rounded-full bg-slate-800/80 text-white flex items-center justify-center hover:bg-slate-700 cursor-pointer"
          >
            <i class="ri-close-line text-xl"></i>
          </button>
          <img
            [src]="url"
            (click)="$event.stopPropagation()"
            class="max-w-full max-h-[88vh] rounded-xl shadow-2xl object-contain"
            alt="Ampliación evidencia fotográfica"
          />
        </div>
      }
    }
  `,
})
export class ReportesFinancierosComponent implements OnInit {
  state = inject(AppStateService);

  reporteData = signal<any | null>(null);
  informeCliente = signal<InformeFinalPdfInput | null>(null);
  cargando = signal<boolean>(false);
  cargandoInformeId = signal<string | null>(null);
  generandoPdfId = signal<string | null>(null);
  generandoPdfModal = signal<boolean>(false);
  pdfFeedback = signal<string | null>(null);

  errorMsg = signal<string | null>(null);
  actionMsg = signal<string | null>(null);
  lightboxUrl = signal<string | null>(null);

  filtroActivo = signal<FiltroReporte>('TODOS');
  busquedaTexto = '';
  busquedaSignal = signal<string>('');

  gastosFijosActuales = computed(() =>
    Number(
      this.reporteData()?.gastosFijosMensualesTallerUsd ??
        this.state.configuracion().gastosFijosMensualesTallerUsd ??
        2400,
    ),
  );

  tasaCambioActual = computed(() =>
    Number(this.reporteData()?.tasaUsdAClp ?? this.state.configuracion().tasaUsdAClp ?? 980),
  );

  multaAtrasoActual = computed(() =>
    Number(
      this.reporteData()?.multaPorDiaRetrasoUsd ??
        this.state.configuracion().multaPorDiaRetrasoUsd ??
        20,
    ),
  );

  totalProductivos = computed(() =>
    Number(this.reporteData()?.totalVehiculosProductivos ?? this.reporteData()?.totalVehiculos ?? 1),
  );

  totalVehiculosBase = computed(() => (this.reporteData()?.reportePorVehiculo || []).length);

  conteoEstado = computed(() => {
    const lista: any[] = this.reporteData()?.reportePorVehiculo || [];
    let finalizados = 0;
    let enProceso = 0;
    let conUtilidad = 0;
    let conPerdida = 0;

    for (const v of lista) {
      if (v.estado === 'FINALIZADO') {
        finalizados += 1;
      } else if (v.estado !== 'RETIRADO_SIN_REPARAR') {
        enProceso += 1;
      }
      if (Number(v.utilidadNetaUsd || 0) >= 0) {
        conUtilidad += 1;
      } else {
        conPerdida += 1;
      }
    }

    return {
      todos: lista.length,
      finalizados,
      enProceso,
      conUtilidad,
      conPerdida,
    };
  });

  vehiculosFiltrados = computed(() => {
    const lista: any[] = this.reporteData()?.reportePorVehiculo || [];
    const filtro = this.filtroActivo();
    const q = this.busquedaSignal().trim().toLowerCase();

    return lista.filter((v) => {
      if (filtro === 'FINALIZADO') {
        if (v.estado !== 'FINALIZADO') return false;
      } else if (filtro === 'EN_PROCESO') {
        if (v.estado === 'FINALIZADO' || v.estado === 'RETIRADO_SIN_REPARAR') {
          return false;
        }
      } else if (filtro === 'CON_UTILIDAD') {
        if (Number(v.utilidadNetaUsd || 0) < 0) return false;
      } else if (filtro === 'CON_PERDIDA') {
        if (Number(v.utilidadNetaUsd || 0) >= 0) return false;
      }

      if (!q) return true;
      const texto = `${v.marca || ''} ${v.modelo || ''} ${v.anio || ''} ${v.vinChasis || ''} ${
        v.placaOLote || ''
      } ${v.nombreCliente || ''} ${v.color || ''}`.toLowerCase();
      return texto.includes(q);
    });
  });

  totalesFiltrados = computed(() => {
    const lista = this.vehiculosFiltrados();
    let cobrado = 0;
    let manoObra = 0;
    let repuestos = 0;
    let almacen = 0;
    let colorista = 0;
    let grua = 0;
    let prorrateo = 0;
    let costoReal = 0;
    let utilidad = 0;

    for (const v of lista) {
      cobrado += Number(v.precioCobradoClienteUsd || 0);
      manoObra += Number(v.costoManoObraUsd || 0);
      repuestos += Number(v.costoRepuestosUsd || 0);
      almacen += Number(v.costoInsumosAlmacenUsd || 0);
      colorista += Number(v.costoPinturaColoristaUsd || 0);
      grua += Number(v.costoGruaNavieraUsd || 0);
      prorrateo += Number(v.prorrateoGastosFijosUsd || 0);
      costoReal += Number(v.costoTotalRealUsd || 0);
      utilidad += Number(v.utilidadNetaUsd || 0);
    }

    return {
      cobrado,
      manoObra,
      repuestos,
      almacen,
      colorista,
      grua,
      prorrateo,
      costoReal,
      utilidad,
    };
  });

  hayFiltrosActivos = computed(
    () =>
      this.filtroActivo() !== 'TODOS' ||
      this.busquedaSignal().trim().length > 0 ||
      Boolean(this.state.focusedVehiculoId()),
  );

  constructor() {
    effect(() => {
      const fVeh = this.state.focusedVehiculoId();
      if (!fVeh) return;
      this.filtroActivo.set('TODOS');
      this.busquedaTexto = '';
      this.busquedaSignal.set('');
    });
  }

  ngOnInit(): void {
    if (this.state.puedeVerReportes()) {
      this.cargarDatosFinancieros();
    }
  }

  onBusquedaChange(valor: string) {
    this.busquedaSignal.set(valor);
  }

  toggleFiltro(target: FiltroReporte) {
    this.filtroActivo.set(this.filtroActivo() === target ? 'TODOS' : target);
  }

  limpiarFiltros() {
    this.filtroActivo.set('TODOS');
    this.busquedaTexto = '';
    this.busquedaSignal.set('');
    if (this.state.focusedVehiculoId()) {
      this.state.clearNotificationFocus();
    }
  }

  cargarDatosFinancieros() {
    this.errorMsg.set(null);
    this.cargando.set(true);
    this.state.obtenerReporteFinanciero(
      (data) => {
        this.reporteData.set(data);
        this.cargando.set(false);
      },
      (err) => {
        this.cargando.set(false);
        this.errorMsg.set(err);
      },
    );
  }

  abrirModalInformePdf(vehiculoId: string) {
    this.errorMsg.set(null);
    this.pdfFeedback.set(null);
    this.cargandoInformeId.set(vehiculoId);
    this.state.obtenerInformeFinalPdfData(
      vehiculoId,
      (data) => {
        this.cargandoInformeId.set(null);
        this.informeCliente.set(data as InformeFinalPdfInput);
      },
      (err) => {
        this.cargandoInformeId.set(null);
        this.errorMsg.set(err);
      },
    );
  }

  async descargarPdfDirectoFila(vehiculoId: string) {
    this.errorMsg.set(null);
    this.actionMsg.set(null);
    this.generandoPdfId.set(vehiculoId);

    this.state.obtenerInformeFinalPdfData(
      vehiculoId,
      async (data) => {
        try {
          const res = await generarYDescargarInformePdf(
            data as InformeFinalPdfInput,
            (raw) => this.state.resolveMediaUrl(raw),
          );
          this.generandoPdfId.set(null);
          this.actionMsg.set(
            `PDF "${res.filename}" descargado con éxito (${res.fotosIncluidas} fotografía(s) incrustadas).`,
          );
        } catch (err: any) {
          this.generandoPdfId.set(null);
          this.errorMsg.set(
            err?.message || 'No se pudo generar automáticamente el archivo PDF. Usa "Ver Informe" e "Imprimir / Vista PDF".',
          );
        }
      },
      (err) => {
        this.generandoPdfId.set(null);
        this.errorMsg.set(err);
      },
    );
  }

  async descargarPdfModal(inf: InformeFinalPdfInput) {
    this.errorMsg.set(null);
    this.pdfFeedback.set(null);
    this.generandoPdfModal.set(true);

    try {
      const res = await generarYDescargarInformePdf(inf, (raw) => this.state.resolveMediaUrl(raw));
      this.generandoPdfModal.set(false);
      this.pdfFeedback.set(
        `Descargado: ${res.filename} (${res.fotosIncluidas} fotografía(s) Antes/Después incrustadas)`,
      );
    } catch (err: any) {
      this.generandoPdfModal.set(false);
      this.errorMsg.set(
        err?.message || 'No se pudo generar automáticamente el archivo PDF. Usa "Imprimir / Vista PDF".',
      );
    }
  }

  cerrarModalInforme() {
    this.lightboxUrl.set(null);
    this.pdfFeedback.set(null);
    this.informeCliente.set(null);
  }

  imprimirInforme() {
    window.print();
  }

  exportarCsvCosteo() {
    const lista = this.vehiculosFiltrados();
    if (!lista.length) return;

    const sanitizeText = (raw: unknown): string => {
      const s = String(raw ?? '').replace(/\r?\n/g, ' ').trim();
      const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return `"${safe.replace(/"/g, '""')}"`;
    };

    const headers = [
      'Vehiculo',
      'Anio',
      'VIN',
      'Lote_Placa',
      'Color',
      'Cliente',
      'Tipo_Cliente',
      'Estado',
      'Cobrado_USD',
      'Mano_Obra_USD',
      'Multas_Atraso_USD',
      'Repuestos_USD',
      'Almacen_USD',
      'Colorista_USD',
      'Grua_Naviera_USD',
      'Costo_Directo_USD',
      'Prorrateo_Fijo_USD',
      'Costo_Total_Real_USD',
      'Utilidad_Neta_USD',
      'Margen_%',
    ];

    const rows = lista.map((v) =>
      [
        sanitizeText(`${v.marca || ''} ${v.modelo || ''}`),
        Number(v.anio || 0) || '',
        sanitizeText(v.vinChasis),
        sanitizeText(v.placaOLote),
        sanitizeText(v.color),
        sanitizeText(v.nombreCliente),
        sanitizeText(v.tipoCliente),
        sanitizeText(v.estado),
        Number(v.precioCobradoClienteUsd || 0).toFixed(2),
        Number(v.costoManoObraUsd || 0).toFixed(2),
        Number(v.multasAplicadasUsd || 0).toFixed(2),
        Number(v.costoRepuestosUsd || 0).toFixed(2),
        Number(v.costoInsumosAlmacenUsd || 0).toFixed(2),
        Number(v.costoPinturaColoristaUsd || 0).toFixed(2),
        Number(v.costoGruaNavieraUsd || 0).toFixed(2),
        Number(v.costoDirectoTotalUsd || 0).toFixed(2),
        Number(v.prorrateoGastosFijosUsd || 0).toFixed(2),
        Number(v.costoTotalRealUsd || 0).toFixed(2),
        Number(v.utilidadNetaUsd || 0).toFixed(2),
        Number(v.margenPorcentaje || 0).toFixed(1),
      ].join(';'),
    );

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Costeo_Financiero_Taller_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);

    this.actionMsg.set(`CSV exportado con ${lista.length} vehículo(s).`);
  }

  etiquetaEstado(estado?: string): string {
    switch (estado) {
      case 'EN_PUERTO_NAVIERA':
        return 'En Puerto / Naviera';
      case 'EN_GRUA':
        return 'En Grúa';
      case 'RECEPCIONADO':
        return 'Recepcionado';
      case 'COTIZADO':
        return 'Cotizado';
      case 'EN_TALLER':
        return 'En Taller';
      case 'FINALIZADO':
        return 'Finalizado Listo';
      case 'RETIRADO_SIN_REPARAR':
        return 'Retirado s/ Reparar';
      default:
        return estado || 'En Taller';
    }
  }

  estadoBadgeClass(estado?: string): string {
    switch (estado) {
      case 'FINALIZADO':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35';
      case 'RETIRADO_SIN_REPARAR':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      case 'EN_PUERTO_NAVIERA':
      case 'EN_GRUA':
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35';
      case 'COTIZADO':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/35';
      default:
        return 'bg-amber-500/15 text-amber-300 border-amber-500/35';
    }
  }

  formatFechaCorta(fecha?: string): string {
    if (!fecha) return 'Registrado en taller';
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return String(fecha);
    return d.toLocaleDateString('es-BO', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  }
}
