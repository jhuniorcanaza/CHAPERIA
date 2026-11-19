import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../../core/services/app-state.service';
import { ModuloAuditoria } from '../../../core/models/system.models';

@Component({
  selector: 'app-audit-history-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div class="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60">
        <div>
          <h3 class="font-bold text-white text-sm flex items-center gap-2">
            <i class="ri-history-line text-amber-400 text-base"></i>
            <span>Historial de Cambios y Auditoría</span>
          </h3>
          <p class="text-[11px] text-slate-400 mt-0.5">
            Registro de modificaciones con fecha, usuario y motivo.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <select
            [(ngModel)]="moduloFiltro"
            class="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="TODOS">Todos ({{ state.historialEdiciones().length }})</option>
            <option value="RECEPCION">Recepción y Check-In</option>
            <option value="COTIZACION">Cotizaciones</option>
            <option value="ORDEN_TRABAJO">Órdenes de Trabajo</option>
            <option value="REPUESTOS">Repuestos</option>
            <option value="ALMACEN_INSUMOS">Almacén e Insumos</option>
            <option value="HERRAMIENTAS">Herramientas</option>
            <option value="CONFIGURACION">Configuración</option>
          </select>

          <button
            type="button"
            (click)="mostrarForm.set(!mostrarForm())"
            class="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 border border-blue-500/40 text-xs font-bold text-blue-300 hover:text-white transition cursor-pointer flex items-center gap-1"
          >
            <i class="ri-edit-line"></i>
            <span>{{ mostrarForm() ? 'Ocultar' : '+ Agregar Nota' }}</span>
          </button>
        </div>
      </div>

      @if (mostrarForm()) {
        <div class="p-4 sm:p-5 bg-slate-950/70 border-b border-slate-800 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-blue-400">
              Registrar Nota de Auditoría ({{ state.currentUser()?.nombreCompleto }})
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              [(ngModel)]="nuevoModulo"
              class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            >
              <option value="RECEPCION">Recepción y Check-In</option>
              <option value="COTIZACION">Cotización</option>
              <option value="ORDEN_TRABAJO">Orden de Trabajo</option>
              <option value="REPUESTOS">Repuestos</option>
              <option value="ALMACEN_INSUMOS">Almacén</option>
              <option value="HERRAMIENTAS">Herramientas</option>
              <option value="CONFIGURACION">Configuración</option>
            </select>
            <input
              [(ngModel)]="entidadReferencia"
              type="text"
              placeholder="Vehículo o Entidad (Ej. Ford Ranger LOTE-88412)"
              class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
            <input
              [(ngModel)]="tipoAccion"
              type="text"
              placeholder="Tipo de Cambio (Ej. AJUSTE_ACORDADO)"
              class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              [(ngModel)]="valorAnterior"
              type="text"
              placeholder="Valor Anterior (Ej. $1,180 USD)"
              class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
            <input
              [(ngModel)]="valorNuevo"
              type="text"
              placeholder="Nuevo Valor (Ej. $1,380 USD)"
              class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
            <input
              [(ngModel)]="aprobadoPor"
              type="text"
              placeholder="Aprobado por (Ej. Carlos Mendoza Bolivia)"
              class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-2">
            <input
              [(ngModel)]="motivoEdicion"
              type="text"
              placeholder="Motivo obligatorio de auditoría..."
              class="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
            <button
              type="button"
              (click)="guardarEdicion()"
              class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer"
            >
              Guardar Nota
            </button>
          </div>
          @if (formError()) {
            <p class="text-xs text-rose-400">{{ formError() }}</p>
          }
        </div>
      }

      <div class="divide-y divide-slate-800/70">
        @for (h of historialFiltrado(); track h.id) {
          <div class="p-4 sm:px-5 hover:bg-slate-800/30 transition space-y-2.5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] text-amber-300 font-bold">
                  {{ etiquetaModulo(h.modulo) }}
                </span>
                <span class="font-bold text-xs text-white">{{ h.entidadReferencia }}</span>
                <span class="text-[11px] text-slate-400">({{ h.tipoAccion }})</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[11px] text-slate-400 font-mono">{{ state.formatFechaHora(h.fechaRegistro) }}</span>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
              <div class="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/90 text-slate-400">
                <span class="text-[10px] uppercase tracking-wider text-slate-500 block font-bold mb-0.5">Valor Anterior</span>
                <span class="text-slate-300">{{ h.valorAnterior }}</span>
              </div>
              <div class="p-2.5 rounded-xl bg-emerald-950/25 border border-emerald-500/25 text-emerald-200">
                <span class="text-[10px] uppercase tracking-wider text-emerald-400 block font-bold mb-0.5">Nuevo Valor Aplicado</span>
                <span class="font-semibold">{{ h.valorNuevo }}</span>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
              <div>
                <span class="text-slate-500">Motivo:</span>
                <span class="text-slate-200 ml-1">{{ h.motivoEdicion }}</span>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <span>Editó: <strong class="text-slate-200">{{ h.editadoPor }}</strong></span>
                @if (h.aprobadoPor) {
                  <span>• Aprobó: <strong class="text-emerald-400">{{ h.aprobadoPor }}</strong></span>
                }
              </div>
            </div>

            @if (h.evidenciaFotoUrl) {
              <button
                type="button"
                (click)="lightboxUrl.set(state.resolveMediaUrl(h.evidenciaFotoUrl))"
                class="inline-flex items-center gap-2.5 p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-left transition cursor-pointer group"
              >
                <img
                  [src]="state.resolveMediaUrl(h.evidenciaFotoUrl)"
                  [alt]="h.evidenciaDescripcion || 'Evidencia auditoría'"
                  class="w-12 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                />
                <div class="text-[11px] pr-2">
                  <span class="text-blue-400 font-bold group-hover:underline block">Ver fotografía de respaldo</span>
                  @if (h.evidenciaDescripcion) {
                    <span class="text-slate-400">{{ h.evidenciaDescripcion }}</span>
                  }
                </div>
              </button>
            }
          </div>
        } @empty {
          <div class="p-8 text-center text-xs text-slate-500">
            No existen registros en el filtro seleccionado.
          </div>
        }
      </div>
    </div>

    @if (lightboxUrl()) {
      <div
        (click)="lightboxUrl.set(null)"
        class="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
      >
        <div (click)="$event.stopPropagation()" class="relative max-w-3xl w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl">
          <button
            type="button"
            (click)="lightboxUrl.set(null)"
            class="absolute top-4 right-4 w-9 h-9 rounded-xl bg-slate-950/80 border border-slate-700 text-white hover:bg-slate-800 flex items-center justify-center cursor-pointer"
          >
            <i class="ri-close-line text-lg"></i>
          </button>
          <img [src]="lightboxUrl()" alt="Evidencia ampliada" class="w-full max-h-[78vh] object-contain rounded-xl" />
        </div>
      </div>
    }
  `,
})
export class AuditHistoryPanelComponent implements OnInit {
  @Input() defaultModulo?: 'TODOS' | ModuloAuditoria;

  state = inject(AppStateService);

  moduloFiltro = 'TODOS';
  mostrarForm = signal(false);
  formError = signal('');
  lightboxUrl = signal<string | null>(null);

  ngOnInit() {
    if (this.defaultModulo) {
      this.moduloFiltro = this.defaultModulo;
    }
  }

  nuevoModulo: ModuloAuditoria = 'COTIZACION';
  entidadReferencia = '';
  tipoAccion = 'MODIFICACION_CON_ACUERDO';
  valorAnterior = '';
  valorNuevo = '';
  motivoEdicion = '';
  aprobadoPor = 'Carlos Mendoza (Gerencia Bolivia)';

  historialFiltrado() {
    const list = this.state.historialEdiciones();
    if (this.moduloFiltro === 'TODOS') return list;
    return list.filter((x) => x.modulo === this.moduloFiltro);
  }

  etiquetaModulo(modulo: ModuloAuditoria): string {
    const mapa: Record<ModuloAuditoria, string> = {
      RECEPCION: 'Recepción',
      COTIZACION: 'Cotización',
      ORDEN_TRABAJO: 'Orden de Trabajo',
      REPUESTOS: 'Repuestos',
      ALMACEN_INSUMOS: 'Almacén',
      HERRAMIENTAS: 'Herramientas',
      CONFIGURACION: 'Configuración',
    };
    return mapa[modulo] || modulo;
  }

  guardarEdicion() {
    this.formError.set('');
    if (!this.entidadReferencia || !this.valorAnterior || !this.valorNuevo || !this.motivoEdicion) {
      this.formError.set('Todos los campos de valor anterior, nuevo valor y motivo son obligatorios.');
      return;
    }
    this.state.registrarEdicionManual(
      {
        modulo: this.nuevoModulo,
        entidadReferencia: this.entidadReferencia,
        tipoAccion: this.tipoAccion,
        valorAnterior: this.valorAnterior,
        valorNuevo: this.valorNuevo,
        motivoEdicion: this.motivoEdicion,
        aprobadoPor: this.aprobadoPor,
      },
      () => {
        this.mostrarForm.set(false);
        this.entidadReferencia = '';
        this.valorAnterior = '';
        this.valorNuevo = '';
        this.motivoEdicion = '';
      },
      (msg) => this.formError.set(msg),
    );
  }
}
