import { Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../core/services/app-state.service';
import { AuditHistoryPanelComponent } from '../../shared/components/audit-history-panel/audit-history-panel.component';
import { ModuloEvidencia, RolSistema } from '../../core/models/system.models';

interface LightboxPreview {
  url: string;
  titulo: string;
  descripcion?: string;
  meta?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, AuditHistoryPanelComponent],
  template: `
    <div class="space-y-6">
      <!-- HERO OPERATIVO CON IMAGEN REAL DEL TALLER Y ACCIONES GERENCIALES -->
      <section class="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
        <img
          [src]="state.resolveMediaUrl('/images/taller_hero.webp')"
          alt="Taller Chapería y Pintura"
          class="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div class="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-900/75"></div>

        <div class="relative z-10 p-5 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div class="space-y-2 max-w-2xl">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border"
                [ngClass]="
                  state.currentUser()?.pais === 'CHILE'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                "
              >
                {{ etiquetaRol(state.currentUser()?.rol) }}
              </span>
            </div>

            <h1 class="text-xl sm:text-2xl font-black text-white tracking-tight">
              Bienvenido, {{ state.currentUser()?.nombreCompleto }}
            </h1>
            <p class="text-xs text-slate-400">
              Resumen operativo de unidades, alertas pendientes y evidencias del taller.
            </p>
          </div>

          <!-- Acciones rápidas -->
          <div class="flex flex-wrap items-center gap-2 shrink-0">
            @if (state.puedeVerReportes()) {
              <button
                type="button"
                (click)="abrirModalConfiguracion()"
                class="px-3.5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                <i class="ri-settings-3-line text-cyan-400"></i>
                <span>Configuración Taller</span>
              </button>

              <button
                type="button"
                (click)="abrirModalUsuarios()"
                class="px-3.5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                <i class="ri-team-line text-emerald-400"></i>
                <span>Usuarios</span>
              </button>
            }

            <button
              type="button"
              (click)="abrirModalPassword()"
              class="px-3.5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <i class="ri-key-2-line text-amber-400"></i>
              <span>Mi Contraseña</span>
            </button>
          </div>
        </div>
      </section>

      <!-- KPIs CLICABLES (Llevan al módulo correspondiente) -->
      <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          (click)="state.selectModuleTab('recepcion')"
          class="text-left p-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-blue-500/50 transition cursor-pointer group shadow-lg"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-slate-400">Vehículos Registrados</span>
            <span class="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <i class="ri-car-line"></i>
            </span>
          </div>
          <div class="text-2xl font-black text-white">{{ state.totalVehiculosTaller() }}</div>
          <div class="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>{{ vehiculosEnTallerCount() }} en proceso • {{ vehiculosFinalizadosCount() }} finalizados</span>
            <span class="text-blue-400 group-hover:translate-x-0.5 transition">→</span>
          </div>
        </button>

        <button
          type="button"
          (click)="state.selectModuleTab('ordenes')"
          class="text-left p-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-rose-500/50 transition cursor-pointer group shadow-lg"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-slate-400">Órdenes con Atraso</span>
            <span class="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center">
              <i class="ri-alarm-warning-line"></i>
            </span>
          </div>
          <div class="text-2xl font-black" [class.text-rose-400]="state.tareasAtrasadasCount() > 0" [class.text-white]="state.tareasAtrasadasCount() === 0">
            {{ state.tareasAtrasadasCount() }}
          </div>
          <div class="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Multa vigente: {{ state.formatMoney(state.configuracion().multaPorDiaRetrasoUsd) }}/día</span>
            <span class="text-rose-400 group-hover:translate-x-0.5 transition">→</span>
          </div>
        </button>

        <button
          type="button"
          (click)="state.selectModuleTab('cotizacion')"
          class="text-left p-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/50 transition cursor-pointer group shadow-lg"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-slate-400">Cotizaciones en Amarillo</span>
            <span class="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <i class="ri-file-list-3-line"></i>
            </span>
          </div>
          <div class="text-2xl font-black text-amber-300">{{ state.cotizacionesEnAmarilloCount() }}</div>
          <div class="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Pendientes de confirmación Chile → Verde</span>
            <span class="text-amber-400 group-hover:translate-x-0.5 transition">→</span>
          </div>
        </button>

        <button
          type="button"
          (click)="state.selectModuleTab('repuestos')"
          class="text-left p-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer group shadow-lg"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-slate-400">Repuestos / Insumos Alerta</span>
            <span class="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <i class="ri-settings-5-line"></i>
            </span>
          </div>
          <div class="text-2xl font-black text-white">{{ repuestosPendientesCount() }}</div>
          <div class="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>{{ insumosBajoStockCount() }} insumos en stock mínimo</span>
            <span class="text-emerald-400 group-hover:translate-x-0.5 transition">→</span>
          </div>
        </button>
      </section>

      <!-- FLOTA DE VEHÍCULOS CON MINIATURAS REALES Y ACCESOS DIRECTOS -->
      <section class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 class="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
              <i class="ri-roadster-line text-blue-400"></i>
              <span>Vehículos Activos y Recién Finalizados ({{ state.vehiculosFiltrados().length }})</span>
            </h2>
            <p class="text-[11px] text-slate-400">
              Haz clic en cualquier fotografía para ampliar o salta directo a su Check-In, Cotización u Órdenes de Trabajo.
            </p>
          </div>
          <button
            type="button"
            (click)="state.selectModuleTab('recepcion')"
            class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer transition self-start sm:self-auto"
          >
            + Nuevo Vehículo
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          @for (v of state.vehiculosFiltrados(); track v.id) {
            <div class="rounded-2xl bg-slate-950/90 border border-slate-800 overflow-hidden flex flex-col justify-between shadow-md hover:border-slate-700 transition">
              <div>
                <!-- Foto principal del vehículo -->
                <div class="relative h-44 bg-slate-900 overflow-hidden group">
                  @if (obtenerFotoPrincipalVehiculo(v); as fotoUrl) {
                    <img
                      [src]="fotoUrl"
                      [alt]="v.marca + ' ' + v.modelo"
                      (click)="abrirLightbox(fotoUrl, v.marca + ' ' + v.modelo + ' (' + v.placaOLote + ')', v.checkIn?.observacionesIngreso)"
                      class="w-full h-full object-cover group-hover:scale-105 transition duration-300 cursor-pointer"
                    />
                  } @else {
                    <div class="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-1 px-4 text-center">
                      <i class="ri-car-line text-3xl text-slate-600"></i>
                      <span>{{ etiquetaSinFotoVehiculo(v.estado) }}</span>
                    </div>
                  }

                  <div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    <span
                      class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase shadow backdrop-blur-md border"
                      [ngClass]="obtenerEstilosEstadoVehiculo(v.estado)"
                    >
                      {{ etiquetaEstadoVehiculo(v.estado) }}
                    </span>
                    <span
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md border"
                      [ngClass]="
                        v.prioridadCola === 'ALTA_15_DIAS'
                          ? 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                          : 'bg-slate-900/80 border-slate-700 text-slate-300'
                      "
                    >
                      {{ v.prioridadCola === 'ALTA_15_DIAS' ? 'Prioridad 15d' : 'Cola 30d' }}
                    </span>
                  </div>

                  @if (v.ordenTraspasoPdfUrl) {
                    <a
                      [href]="state.resolveMediaUrl(v.ordenTraspasoPdfUrl)"
                      target="_blank"
                      rel="noopener"
                      class="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-slate-950/85 hover:bg-blue-600 border border-slate-700 text-[10px] font-bold text-slate-200 hover:text-white flex items-center gap-1 transition"
                      title="Abrir Orden de Traspaso PDF"
                    >
                      <i class="ri-file-pdf-2-line text-rose-400"></i>
                      <span>PDF Traspaso</span>
                    </a>
                  }
                </div>

                <div class="p-4 space-y-3">
                  <div>
                    <div class="flex items-start justify-between gap-2">
                      <h3 class="font-extrabold text-sm text-white leading-tight">
                        {{ v.marca }} {{ v.modelo }} {{ v.anio }}
                      </h3>
                      <span class="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 shrink-0">
                        {{ v.placaOLote }}
                      </span>
                    </div>
                    <p class="text-[11px] text-slate-400 mt-0.5 truncate">
                      {{ v.nombreCliente }} • VIN: <span class="font-mono text-slate-300">{{ v.vinChasis }}</span>
                    </p>
                  </div>

                  <!-- Cotización & Progreso OT -->
                  <div class="grid grid-cols-2 gap-2 text-xs">
                    <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                      <span class="text-[10px] text-slate-500 block">Acuerdo Cotización</span>
                      @if (obtenerUltimaCotizacion(v); as cot) {
                        <strong
                          class="font-mono text-xs"
                          [ngClass]="{
                            'text-emerald-400': cot.estadoAprobacion === 'VERDE_ACEPTADA_POR_CHILE',
                            'text-amber-300': cot.estadoAprobacion === 'AMARILLO_EDITADA_POR_BOLIVIA',
                            'text-cyan-300': cot.estadoAprobacion === 'PENDIENTE_REVISION_BOLIVIA',
                            'text-rose-400': cot.estadoAprobacion === 'RECHAZADA_CLIENTE'
                          }"
                        >
                          {{
                            cot.estadoAprobacion === 'RECHAZADA_CLIENTE' && Number(cot.montoAcordadoUsd || 0) === 0
                              ? 'Sin ejecución'
                              : state.formatMoney(cot.montoAcordadoUsd)
                          }}
                        </strong>
                        <span
                          class="text-[9px] block font-bold mt-0.5"
                          [ngClass]="{
                            'text-emerald-300': cot.estadoAprobacion === 'VERDE_ACEPTADA_POR_CHILE',
                            'text-amber-300': cot.estadoAprobacion === 'AMARILLO_EDITADA_POR_BOLIVIA',
                            'text-cyan-300': cot.estadoAprobacion === 'PENDIENTE_REVISION_BOLIVIA',
                            'text-rose-300': cot.estadoAprobacion === 'RECHAZADA_CLIENTE'
                          }"
                        >
                          {{ etiquetaEstadoCotizacion(cot.estadoAprobacion) }}
                        </span>
                      } @else {
                        <span class="text-[11px] text-slate-500">Sin cotizar</span>
                      }
                    </div>

                    <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                      <span class="text-[10px] text-slate-500 block">Avance Órdenes OT</span>
                      <strong class="text-white font-mono text-xs">
                        {{ contarOtsCompletadas(v) }} / {{ (v.tareasOt || []).length }}
                      </strong>
                      <div class="w-full h-1.5 rounded-full bg-slate-800 mt-1.5 overflow-hidden">
                        <div
                          class="h-full bg-blue-500 rounded-full transition-all"
                          [style.width.%]="calcularPorcentajeOt(v)"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer de accesos rápidos -->
              <div class="px-4 py-2.5 border-t border-slate-800/80 bg-slate-900/50 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  (click)="irAVehiculoEnModulo(v.id, 'recepcion')"
                  class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200 cursor-pointer transition"
                >
                  Check-In
                </button>
                <button
                  type="button"
                  (click)="irAVehiculoEnModulo(v.id, 'cotizacion')"
                  class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200 cursor-pointer transition"
                >
                  Cotización
                </button>
                <button
                  type="button"
                  (click)="irAVehiculoEnModulo(v.id, 'ordenes')"
                  class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200 cursor-pointer transition"
                >
                  OTs
                </button>
                @if (v.estado === 'FINALIZADO' && state.puedeVerReportes()) {
                  <button
                    type="button"
                    (click)="irAVehiculoEnModulo(v.id, 'reportes')"
                    class="ml-auto px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 hover:text-white cursor-pointer transition flex items-center gap-1"
                  >
                    <i class="ri-file-pdf-2-line"></i>
                    <span>Informe PDF</span>
                  </button>
                }
              </div>
            </div>
          } @empty {
            <div class="col-span-full p-8 text-center text-xs text-slate-500">
              No hay vehículos que coincidan con tu búsqueda actual.
            </div>
          }
        </div>
      </section>

      <!-- GALERÍA CENTRAL DE EVIDENCIAS FOTOGRÁFICAS .WEBP CON FILTROS Y LIGHTBOX -->
      <section class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
              <i class="ri-gallery-line text-cyan-400"></i>
              <span>Galería de Evidencias Fotográficas ({{ evidenciasFiltradas().length }})</span>
            </h2>
            <p class="text-[11px] text-slate-400">
              Todas las imágenes de recepción, desarme, repuestos, colorista, bajas y entrega final en un solo lugar.
            </p>
          </div>
        </div>

        <!-- Filtros de galería -->
        <div class="flex flex-wrap gap-1.5">
          @for (tab of filtrosGaleria; track tab.id) {
            <button
              type="button"
              (click)="state.evidenciasModuloFilter.set(tab.id)"
              class="px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer border"
              [class.bg-blue-600]="state.evidenciasModuloFilter() === tab.id"
              [class.border-blue-500]="state.evidenciasModuloFilter() === tab.id"
              [class.text-white]="state.evidenciasModuloFilter() === tab.id"
              [class.bg-slate-950]="state.evidenciasModuloFilter() !== tab.id"
              [class.border-slate-800]="state.evidenciasModuloFilter() !== tab.id"
              [class.text-slate-400]="state.evidenciasModuloFilter() !== tab.id"
            >
              {{ tab.label }}
            </button>
          }
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          @for (ev of evidenciasFiltradas(); track ev.id) {
            <div
              (click)="
                esArchivoPdf(ev.archivoWebpUrl)
                  ? abrirDocumentoEnPestana(ev.archivoWebpUrl)
                  : abrirLightbox(state.resolveMediaUrl(ev.archivoWebpUrl), ev.tituloDetalle, ev.descripcionBreve, ev.vehiculoReferencia)
              "
              class="group rounded-2xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 overflow-hidden cursor-pointer transition flex flex-col justify-between shadow-md"
            >
              <div class="relative h-40 bg-slate-900 overflow-hidden">
                @if (esArchivoPdf(ev.archivoWebpUrl)) {
                  <div class="w-full h-full flex flex-col items-center justify-center gap-2 text-rose-300 bg-rose-950/20">
                    <i class="ri-file-pdf-2-line text-4xl"></i>
                    <span class="text-[11px] font-bold">Documento PDF Adjunto</span>
                  </div>
                } @else {
                  <img
                    [src]="state.resolveMediaUrl(ev.archivoWebpUrl)"
                    [alt]="ev.tituloDetalle"
                    class="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                }
                <span class="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-slate-950/85 border border-slate-700 text-[9px] text-cyan-300 font-bold">
                  {{ etiquetaModuloEvidencia(ev.moduloOrigen) }}
                </span>
              </div>

              <div class="p-3.5 space-y-1.5">
                <p class="font-bold text-xs text-white line-clamp-1">{{ ev.tituloDetalle }}</p>
                <p class="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{{ ev.descripcionBreve }}</p>
                <div class="pt-1 flex items-center justify-between gap-2 text-[10px] text-slate-500 border-t border-slate-800/80">
                  <span class="truncate">{{ ev.vehiculoReferencia }}</span>
                  <span class="shrink-0 font-mono text-slate-400">
                    {{ ev.creadoEn ? state.formatFechaHoraCorta(ev.creadoEn) : ev.paisOrigen }}
                  </span>
                </div>
              </div>
            </div>
          } @empty {
            <div class="col-span-full p-8 text-center text-xs text-slate-500">
              No hay fotografías registradas para esta categoría.
            </div>
          }
        </div>
      </section>

      <!-- PANEL DE AUDITORÍA INMUTABLE -->
      <app-audit-history-panel></app-audit-history-panel>
    </div>

    <!-- MODAL 1: LIGHTBOX DE VISTA AMPLIADA -->
    @if (lightbox(); as lb) {
      <div
        (click)="lightbox.set(null)"
        class="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
      >
        <div
          (click)="$event.stopPropagation()"
          class="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl"
        >
          <div class="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
            <div class="min-w-0 pr-4">
              <h3 class="font-bold text-sm text-white truncate">{{ lb.titulo }}</h3>
              @if (lb.meta) {
                <p class="text-[11px] text-cyan-400 font-mono truncate">{{ lb.meta }}</p>
              }
            </div>
            <button
              type="button"
              (click)="lightbox.set(null)"
              class="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
            >
              <i class="ri-close-line text-lg"></i>
            </button>
          </div>
          <div class="p-4 bg-slate-950 flex justify-center">
            <img [src]="lb.url" [alt]="lb.titulo" class="max-h-[72vh] w-auto object-contain rounded-xl" />
          </div>
          @if (lb.descripcion) {
            <div class="px-5 py-3 border-t border-slate-800 text-xs text-slate-300 bg-slate-900">
              {{ lb.descripcion }}
            </div>
          }
        </div>
      </div>
    }

    <!-- MODAL 2: CONFIGURACIÓN GLOBAL DEL TALLER (BOLIVIA) -->
    @if (modalConfigOpen()) {
      <div class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
            <h3 class="font-bold text-sm text-white flex items-center gap-2">
              <i class="ri-settings-3-line text-cyan-400"></i>
              <span>Configuración Financiera Global (Bolivia)</span>
            </h3>
            <button type="button" (click)="modalConfigOpen.set(false)" class="text-slate-400 hover:text-white cursor-pointer">
              <i class="ri-close-line text-lg"></i>
            </button>
          </div>

          <div class="p-5 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="space-y-1">
                <label class="text-[11px] font-bold text-slate-300 block">Tasa 1 USD → CLP</label>
                <input
                  [(ngModel)]="cfgTasa"
                  type="number"
                  min="1"
                  class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                />
              </div>
              <div class="space-y-1">
                <label class="text-[11px] font-bold text-slate-300 block">Multa Atraso (USD/d)</label>
                <input
                  [(ngModel)]="cfgMulta"
                  type="number"
                  min="0"
                  class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                />
              </div>
              <div class="space-y-1">
                <label class="text-[11px] font-bold text-slate-300 block">Gasto Fijo Mes (USD)</label>
                <input
                  [(ngModel)]="cfgGastosFijos"
                  type="number"
                  min="0"
                  class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-300 block">Motivo del Cambio (Auditado)</label>
              <input
                [(ngModel)]="cfgMotivo"
                type="text"
                placeholder="Ej. Ajuste mensual tipo de cambio paralelo Chile"
                class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              />
            </div>

            @if (modalError()) {
              <p class="text-xs text-rose-400">{{ modalError() }}</p>
            }
            @if (modalFeedback()) {
              <p class="text-xs text-emerald-400">{{ modalFeedback() }}</p>
            }
          </div>

          <div class="px-5 py-3.5 border-t border-slate-800 bg-slate-950/70 flex justify-end gap-2">
            <button type="button" (click)="modalConfigOpen.set(false)" class="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 cursor-pointer">
              Cerrar
            </button>
            <button
              type="button"
              (click)="guardarConfiguracion()"
              [disabled]="modalProcesando()"
              class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
            >
              {{ modalProcesando() ? 'Guardando...' : 'Guardar Cambios' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- MODAL 3: GESTIÓN DE USUARIOS (BOLIVIA) -->
    @if (modalUsersOpen()) {
      <div class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
          <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
            <h3 class="font-bold text-sm text-white flex items-center gap-2">
              <i class="ri-team-line text-emerald-400"></i>
              <span>Control de Accesos y Cuentas del Sistema</span>
            </h3>
            <button type="button" (click)="modalUsersOpen.set(false)" class="text-slate-400 hover:text-white cursor-pointer">
              <i class="ri-close-line text-lg"></i>
            </button>
          </div>

          <div class="p-5 space-y-5 overflow-y-auto">
            <div class="space-y-2">
              @for (u of state.usuariosSistema(); track u.id) {
                <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-xs text-white">{{ u.nombreCompleto }}</span>
                      <span
                        class="px-2 py-0.5 rounded text-[10px] font-bold"
                        [ngClass]="u.activo ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'"
                      >
                        {{ u.activo ? 'ACTIVO' : 'INACTIVO' }}
                      </span>
                    </div>
                    <div class="text-[11px] text-slate-400">
                      <span class="font-mono">{{ u.email }}</span> • {{ etiquetaRol(u.rol) }}
                    </div>
                  </div>

                  @if (state.currentUser()?.rol === 'SUPERADMIN_BOLIVIA' && u.id !== state.currentUser()?.id) {
                    <button
                      type="button"
                      (click)="toggleEstadoUsuario(u.id)"
                      class="px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition border self-start sm:self-auto"
                      [ngClass]="
                        u.activo
                          ? 'bg-rose-950/50 border-rose-500/50 text-rose-300 hover:bg-rose-600 hover:text-white'
                          : 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300 hover:bg-emerald-600 hover:text-white'
                      "
                    >
                      {{ u.activo ? 'Suspender Acceso' : 'Reactivar' }}
                    </button>
                  }
                </div>
              }
            </div>

            @if (state.currentUser()?.rol === 'SUPERADMIN_BOLIVIA') {
              <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <h4 class="text-xs font-bold text-cyan-300">+ Crear Nuevo Usuario Autorizado</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    [(ngModel)]="newUserName"
                    type="text"
                    placeholder="Nombre completo"
                    class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                  <input
                    [(ngModel)]="newUserEmail"
                    type="email"
                    placeholder="correo@empresa.com"
                    class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                  <input
                    [(ngModel)]="newUserPass"
                    type="password"
                    placeholder="Contraseña inicial (min 6)"
                    class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                  <select
                    [(ngModel)]="newUserRol"
                    class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  >
                    <option value="ENCARGADO_CHILE">Encargado Taller • Chile (Iquique)</option>
                    <option value="ADMIN_BOLIVIA">Administración • Bolivia</option>
                    <option value="SUPERADMIN_BOLIVIA">Gerencia General • Bolivia</option>
                  </select>
                </div>
                <button
                  type="button"
                  (click)="crearUsuario()"
                  [disabled]="modalProcesando()"
                  class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer"
                >
                  Registrar Usuario
                </button>
              </div>
            }

            @if (modalError()) {
              <p class="text-xs text-rose-400">{{ modalError() }}</p>
            }
            @if (modalFeedback()) {
              <p class="text-xs text-emerald-400">{{ modalFeedback() }}</p>
            }
          </div>
        </div>
      </div>
    }

    <!-- MODAL 4: CAMBIAR MI CONTRASEÑA -->
    @if (modalPasswordOpen()) {
      <div class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
            <h3 class="font-bold text-sm text-white flex items-center gap-2">
              <i class="ri-key-2-line text-amber-400"></i>
              <span>Actualizar Mi Contraseña</span>
            </h3>
            <button type="button" (click)="modalPasswordOpen.set(false)" class="text-slate-400 hover:text-white cursor-pointer">
              <i class="ri-close-line text-lg"></i>
            </button>
          </div>

          <div class="p-5 space-y-3">
            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-300 block">Contraseña Actual</label>
              <input
                [(ngModel)]="pwdCurrent"
                type="password"
                class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              />
            </div>
            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-300 block">Nueva Contraseña (mínimo 6 caracteres)</label>
              <input
                [(ngModel)]="pwdNew"
                type="password"
                class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              />
            </div>
            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-300 block">Confirmar Nueva Contraseña</label>
              <input
                [(ngModel)]="pwdConfirm"
                type="password"
                class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              />
            </div>

            @if (modalError()) {
              <p class="text-xs text-rose-400">{{ modalError() }}</p>
            }
            @if (modalFeedback()) {
              <p class="text-xs text-emerald-400">{{ modalFeedback() }}</p>
            }
          </div>

          <div class="px-5 py-3.5 border-t border-slate-800 bg-slate-950/70 flex justify-end gap-2">
            <button type="button" (click)="modalPasswordOpen.set(false)" class="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 cursor-pointer">
              Cerrar
            </button>
            <button
              type="button"
              (click)="guardarPassword()"
              [disabled]="modalProcesando()"
              class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white cursor-pointer"
            >
              Actualizar Clave
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class DashboardComponent {
  state = inject(AppStateService);
  @Output() openPhotoModal = new EventEmitter<void>();

  lightbox = signal<LightboxPreview | null>(null);

  modalConfigOpen = signal(false);
  modalUsersOpen = signal(false);
  modalPasswordOpen = signal(false);
  modalProcesando = signal(false);
  modalError = signal('');
  modalFeedback = signal('');

  cfgTasa = 980;
  cfgMulta = 20;
  cfgGastosFijos = 2400;
  cfgMotivo = '';

  newUserName = '';
  newUserEmail = '';
  newUserPass = '';
  newUserRol: RolSistema = 'ENCARGADO_CHILE';

  pwdCurrent = '';
  pwdNew = '';
  pwdConfirm = '';

  readonly filtrosGaleria: { id: ModuloEvidencia | 'TODAS'; label: string }[] = [
    { id: 'TODAS', label: 'Todas' },
    { id: 'CHECKIN_RECEPCION', label: 'Recepción (Antes)' },
    { id: 'ENTREGA_FINAL', label: 'Entrega Final (Después)' },
    { id: 'DESARME_COTIZACION', label: 'Desarme Oculto' },
    { id: 'REPUESTOS_CUENTAGOTAS', label: 'Repuestos' },
    { id: 'FACTURA_INSUMO_COLORISTA', label: 'Colorista / Facturas' },
    { id: 'BAJA_HERRAMIENTA', label: 'Herramientas' },
    { id: 'TRASPASO_NAVIERA', label: 'Traspaso Naviera' },
  ];

  evidenciasFiltradas = computed(() => {
    const f = this.state.evidenciasModuloFilter();
    const list = this.state.evidenciasFotograficas();
    if (f === 'TODAS') return list;
    return list.filter((e) => e.moduloOrigen === f);
  });

  vehiculosEnTallerCount = computed(
    () =>
      this.state
        .vehiculos()
        .filter((v) => v.estado !== 'FINALIZADO' && v.estado !== 'RETIRADO_SIN_REPARAR').length,
  );

  vehiculosFinalizadosCount = computed(
    () => this.state.vehiculos().filter((v) => v.estado === 'FINALIZADO').length,
  );

  protected readonly Number = Number;

  etiquetaRol(rol?: string): string {
    const mapa: Record<string, string> = {
      SUPERADMIN_BOLIVIA: 'Gerencia General • Bolivia',
      ADMIN_BOLIVIA: 'Administración • Bolivia',
      ENCARGADO_CHILE: 'Encargado Taller • Chile',
    };
    return (rol && mapa[rol]) || 'Equipo Operativo';
  }

  etiquetaEstadoVehiculo(estado: string): string {
    const mapa: Record<string, string> = {
      EN_PUERTO_NAVIERA: 'En Puerto / Naviera',
      EN_GRUA: 'En Grúa',
      RECEPCIONADO: 'Recepcionado',
      COTIZADO: 'Cotizado',
      EN_TALLER: 'En Taller',
      FINALIZADO: 'Finalizado',
      RETIRADO_SIN_REPARAR: 'Retirado (Sin reparar)',
    };
    return mapa[estado] || estado;
  }

  etiquetaSinFotoVehiculo(estado: string): string {
    if (estado === 'EN_GRUA') return 'En traslado en grúa hacia taller';
    if (estado === 'EN_PUERTO_NAVIERA') return 'Pendiente liberación naviera en puerto';
    if (estado === 'RETIRADO_SIN_REPARAR') return 'Unidad retirada sin ejecución';
    return 'Pendiente fotografía de ingreso';
  }

  etiquetaEstadoCotizacion(estado: string): string {
    const mapa: Record<string, string> = {
      VERDE_ACEPTADA_POR_CHILE: 'VERDE · Aceptada',
      AMARILLO_EDITADA_POR_BOLIVIA: 'AMARILLO · Por aceptar',
      PENDIENTE_REVISION_BOLIVIA: 'En revisión Bolivia',
      RECHAZADA_CLIENTE: 'Rechazada por cliente',
    };
    return mapa[estado] || estado;
  }

  etiquetaModuloEvidencia(modulo: ModuloEvidencia): string {
    const mapa: Record<ModuloEvidencia, string> = {
      CHECKIN_RECEPCION: 'Recepción (Antes)',
      DESARME_COTIZACION: 'Desarme Oculto',
      REPUESTOS_CUENTAGOTAS: 'Repuestos',
      FACTURA_INSUMO_COLORISTA: 'Boleta Colorista',
      BAJA_HERRAMIENTA: 'Baja Herramienta',
      TRASPASO_NAVIERA: 'Traspaso Naviera',
      ENTREGA_FINAL: 'Entrega Final',
    };
    return mapa[modulo] || modulo;
  }

  esArchivoPdf(url?: string | null): boolean {
    return Boolean(url && url.toLowerCase().endsWith('.pdf'));
  }

  abrirDocumentoEnPestana(url: string) {
    if (typeof window !== 'undefined') {
      window.open(this.state.resolveMediaUrl(url), '_blank', 'noopener');
    }
  }

  repuestosPendientesCount = computed(() => {
    let count = 0;
    for (const v of this.state.vehiculos()) {
      for (const r of v.repuestos || []) {
        if (r.estado === 'SOLICITADO' || r.estado === 'OBSERVADO_NO_COMPATIBLE') count++;
      }
    }
    return count;
  });

  insumosBajoStockCount = computed(
    () =>
      this.state
        .insumos()
        .filter((i) => Number(i.stockActual) <= Number(i.stockMinimoAlerta)).length,
  );

  obtenerFotoPrincipalVehiculo(v: any): string {
    const first = v?.checkIn?.fotosIngresoWebp?.[0]?.url;
    return first ? this.state.resolveMediaUrl(first) : '';
  }

  obtenerUltimaCotizacion(v: any): any | null {
    const list = v?.cotizaciones || [];
    if (list.length === 0) return null;
    return [...list].sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0];
  }

  contarOtsCompletadas(v: any): number {
    return (v?.tareasOt || []).filter((t: any) => t.completada).length;
  }

  calcularPorcentajeOt(v: any): number {
    const total = (v?.tareasOt || []).length;
    if (total === 0) return 0;
    return Math.round((this.contarOtsCompletadas(v) / total) * 100);
  }

  obtenerEstilosEstadoVehiculo(estado: string): string {
    if (estado === 'FINALIZADO') return 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300';
    if (estado === 'EN_TALLER') return 'bg-blue-950/90 border-blue-500/60 text-blue-300';
    if (estado === 'COTIZADO') return 'bg-amber-950/90 border-amber-500/60 text-amber-300';
    if (estado === 'EN_GRUA' || estado === 'EN_PUERTO_NAVIERA') {
      return 'bg-cyan-950/90 border-cyan-500/60 text-cyan-300';
    }
    if (estado === 'RETIRADO_SIN_REPARAR') {
      return 'bg-rose-950/90 border-rose-500/60 text-rose-300';
    }
    return 'bg-indigo-950/90 border-indigo-500/60 text-indigo-200';
  }

  irAVehiculoEnModulo(vehiculoId: string, modulo: string) {
    this.state.irAVehiculoEnModulo(vehiculoId, modulo);
  }

  abrirLightbox(url: string, titulo: string, descripcion?: string, meta?: string) {
    this.lightbox.set({ url, titulo, descripcion, meta });
  }

  abrirModalConfiguracion() {
    const cfg = this.state.configuracion();
    this.cfgTasa = Number(cfg.tasaUsdAClp || 980);
    this.cfgMulta = Number(cfg.multaPorDiaRetrasoUsd || 20);
    this.cfgGastosFijos = Number(cfg.gastosFijosMensualesTallerUsd || 2400);
    this.cfgMotivo = '';
    this.modalError.set('');
    this.modalFeedback.set('');
    this.modalConfigOpen.set(true);
  }

  guardarConfiguracion() {
    this.modalError.set('');
    this.modalFeedback.set('');
    this.modalProcesando.set(true);
    this.state.actualizarConfiguracionGlobal(
      {
        tasaUsdAClp: Number(this.cfgTasa),
        multaPorDiaRetrasoUsd: Number(this.cfgMulta),
        gastosFijosMensualesTallerUsd: Number(this.cfgGastosFijos),
        motivo: this.cfgMotivo.trim() || undefined,
      },
      () => {
        this.modalProcesando.set(false);
        this.modalFeedback.set('Configuración guardada y registrada en auditoría.');
      },
      (err) => {
        this.modalProcesando.set(false);
        this.modalError.set(err);
      },
    );
  }

  abrirModalUsuarios() {
    this.modalError.set('');
    this.modalFeedback.set('');
    this.state.cargarUsuariosSistema((err) => this.modalError.set(err));
    this.modalUsersOpen.set(true);
  }

  crearUsuario() {
    this.modalError.set('');
    this.modalFeedback.set('');
    if (!this.newUserName.trim() || !this.newUserEmail.trim() || this.newUserPass.length < 6) {
      this.modalError.set('Completa nombre, correo y una contraseña de al menos 6 caracteres.');
      return;
    }
    this.modalProcesando.set(true);
    this.state.crearUsuarioSistema(
      {
        nombreCompleto: this.newUserName.trim(),
        email: this.newUserEmail.trim(),
        password: this.newUserPass,
        rol: this.newUserRol,
      },
      () => {
        this.modalProcesando.set(false);
        this.modalFeedback.set('Usuario creado correctamente.');
        this.newUserName = '';
        this.newUserEmail = '';
        this.newUserPass = '';
      },
      (err) => {
        this.modalProcesando.set(false);
        this.modalError.set(err);
      },
    );
  }

  toggleEstadoUsuario(id: string) {
    this.modalError.set('');
    this.state.toggleUsuarioActivo(id, undefined, (err) => this.modalError.set(err));
  }

  abrirModalPassword() {
    this.pwdCurrent = '';
    this.pwdNew = '';
    this.pwdConfirm = '';
    this.modalError.set('');
    this.modalFeedback.set('');
    this.modalPasswordOpen.set(true);
  }

  guardarPassword() {
    this.modalError.set('');
    this.modalFeedback.set('');
    if (!this.pwdCurrent || this.pwdNew.length < 6) {
      this.modalError.set('Ingresa tu clave actual y una nueva clave de al menos 6 caracteres.');
      return;
    }
    if (this.pwdNew !== this.pwdConfirm) {
      this.modalError.set('Las contraseñas nuevas no coinciden.');
      return;
    }
    this.modalProcesando.set(true);
    this.state.cambiarMiPassword(
      { currentPassword: this.pwdCurrent, newPassword: this.pwdNew },
      () => {
        this.modalProcesando.set(false);
        this.modalFeedback.set('Contraseña actualizada correctamente.');
        this.pwdCurrent = '';
        this.pwdNew = '';
        this.pwdConfirm = '';
      },
      (err) => {
        this.modalProcesando.set(false);
        this.modalError.set(err);
      },
    );
  }
}
