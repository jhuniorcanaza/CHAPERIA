import { Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../../core/services/app-state.service';
import { EvidenciaFotograficaItem, ModuloEvidencia } from '../../../core/models/system.models';
import { comprimirImagenNavegadorWebp } from '../../../core/utils/webp-compressor';

@Component({
  selector: 'app-photo-evidence-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (isOpen) {
      <div class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
          <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <i class="ri-image-add-line text-base"></i>
              </div>
              <div>
                <h3 class="font-bold text-white text-sm">Anexar Fotografía al Vehículo</h3>
                <p class="text-[11px] text-slate-400">Respaldo visual para expediente e Informe Final</p>
              </div>
            </div>
            <button
              type="button"
              (click)="cerrar()"
              class="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <i class="ri-close-line"></i>
            </button>
          </div>

          <div class="p-5 space-y-4 overflow-y-auto">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[11px] font-bold text-slate-300 block">Tipo de Evidencia</label>
                <select
                  [(ngModel)]="moduloOrigen"
                  class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="CHECKIN_RECEPCION">Ingreso / Check-In (Antes)</option>
                  <option value="DESARME_COTIZACION">Hallazgo en Desarme (Antes / Adenda)</option>
                  <option value="ENTREGA_FINAL">Entrega Final y Pulido (Después)</option>
                </select>
              </div>

              <div class="space-y-1">
                <label class="text-[11px] font-bold text-slate-300 block">Vehículo Destino</label>
                <select
                  [(ngModel)]="vehiculoSelectId"
                  class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  @for (v of state.vehiculos(); track v.id) {
                    <option [value]="v.id">{{ v.marca }} {{ v.modelo }} ({{ v.placaOLote }})</option>
                  }
                  @if (state.vehiculos().length === 0) {
                    <option value="GENERAL">Sin vehículos registrados (General)</option>
                  }
                </select>
              </div>
            </div>

            <div class="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span class="text-slate-400">¿Necesitas subir con costo, serie o PDF? Ir directo a:</span>
              <div class="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  (click)="irModuloEspecifico('recepcion')"
                  class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold cursor-pointer"
                >
                  Traspaso PDF
                </button>
                <button
                  type="button"
                  (click)="irModuloEspecifico('repuestos')"
                  class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 font-semibold cursor-pointer"
                >
                  Repuestos
                </button>
                <button
                  type="button"
                  (click)="irModuloEspecifico('almacen')"
                  class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold cursor-pointer"
                >
                  Boleta Colorista
                </button>
                <button
                  type="button"
                  (click)="irModuloEspecifico('herramientas')"
                  class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 font-semibold cursor-pointer"
                >
                  Baja Herramienta
                </button>
              </div>
            </div>

            @if (vehiculoSelectId === 'GENERAL' || state.vehiculos().length === 0) {
              <div class="space-y-1">
                <label class="text-[11px] font-bold text-slate-300 block">Referencia personalizada</label>
                <input
                  [(ngModel)]="vehiculoManual"
                  type="text"
                  placeholder="Ej. Taller Iquique - Cabina de Pintura"
                  class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            }

            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-300 block">Título / Detalle de la Evidencia *</label>
              <input
                [(ngModel)]="tituloDetalle"
                type="text"
                placeholder="Ej. Puerta derecha terminada tras pulido en cabina"
                class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-300 block">Descripción Breve (Visible en Reporte PDF) *</label>
              <textarea
                [(ngModel)]="descripcionBreve"
                rows="2"
                placeholder="Describe qué muestra exactamente la fotografía para respaldo de Gerencia..."
                class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
              ></textarea>
            </div>

            <div class="space-y-2">
              <label class="text-[11px] font-bold text-slate-300 block">Archivo Fotográfico</label>
              <label class="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-950/70 cursor-pointer transition text-center gap-2">
                @if (previewDataUrl()) {
                  <img
                    [src]="previewDataUrl()"
                    alt="Vista previa evidencia"
                    class="max-h-40 rounded-lg object-contain border border-slate-800 shadow"
                  />
                } @else {
                  <i class="ri-upload-cloud-2-line text-2xl text-blue-400"></i>
                }
                <span class="text-xs font-semibold text-slate-300">
                  {{ nombreArchivoLabel() || 'Haz clic para seleccionar o tomar fotografía' }}
                </span>
                @if (compresionClienteMsg()) {
                  <span class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-mono">
                    {{ compresionClienteMsg() }}
                  </span>
                }
                <input type="file" accept="image/*" (change)="onFileChange($event)" class="hidden" />
              </label>
            </div>

            @if (errorMsg()) {
              <div class="p-3 rounded-xl bg-rose-950/60 border border-rose-500/70 text-xs text-rose-200 flex items-center gap-2">
                <i class="ri-error-warning-line text-rose-400"></i>
                <span>{{ errorMsg() }}</span>
              </div>
            }

            @if (successResult()) {
              <div class="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/60 text-xs text-emerald-200 space-y-1">
                <p class="font-bold flex items-center gap-1.5">
                  <i class="ri-checkbox-circle-fill text-emerald-400"></i>
                  <span>¡Fotografía guardada y vinculada al vehículo!</span>
                </p>
                <p class="text-[11px] text-emerald-100/90">
                  {{ successResult()?.tituloDetalle }} — Ya disponible en el expediente e Informe Final.
                </p>
              </div>
            }
          </div>

          <div class="px-5 py-3.5 border-t border-slate-800 bg-slate-950/60 flex justify-end gap-2">
            <button
              type="button"
              (click)="cerrar()"
              class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              (click)="subir()"
              [disabled]="subiendo() || comprimiendo()"
              class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white cursor-pointer flex items-center gap-1.5"
            >
              <i class="ri-upload-2-line"></i>
              <span>
                {{ comprimiendo() ? 'Procesando foto...' : subiendo() ? 'Guardando...' : 'Guardar Fotografía' }}
              </span>
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class PhotoEvidenceModalComponent implements OnChanges {
  state = inject(AppStateService);
  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();

  moduloOrigen: ModuloEvidencia = 'CHECKIN_RECEPCION';
  vehiculoSelectId = '';
  vehiculoManual = 'Taller General Iquique';
  tituloDetalle = '';
  descripcionBreve = '';

  selectedFile: File | null = null;
  selectedOriginalKb: number | undefined;
  previewDataUrl = signal<string | null>(null);
  nombreArchivoLabel = signal<string>('');
  compresionClienteMsg = signal<string>('');
  comprimiendo = signal(false);
  subiendo = signal(false);
  errorMsg = signal('');
  successResult = signal<EvidenciaFotograficaItem | null>(null);

  ngOnChanges() {
    if (this.isOpen) {
      const lista = this.state.vehiculos();
      const existeActual = lista.some((v) => v.id === this.vehiculoSelectId);
      if ((!this.vehiculoSelectId || this.vehiculoSelectId === 'GENERAL' || !existeActual) && lista.length > 0) {
        this.vehiculoSelectId = lista[0].id;
      } else if (lista.length === 0) {
        this.vehiculoSelectId = 'GENERAL';
      }
    }
  }

  private revocarPreview() {
    const current = this.previewDataUrl();
    if (current && current.startsWith('blob:')) {
      URL.revokeObjectURL(current);
    }
    this.previewDataUrl.set(null);
  }

  irModuloEspecifico(tab: 'recepcion' | 'repuestos' | 'almacen' | 'herramientas') {
    this.cerrar();
    this.state.selectModuleTab(tab);
  }

  async onFileChange(event: any) {
    const file: File | undefined = event?.target?.files?.[0];
    if (!file) return;

    this.errorMsg.set('');
    this.successResult.set(null);
    this.comprimiendo.set(true);

    const originalKb = Math.max(1, Math.round(file.size / 1024));
    this.selectedOriginalKb = originalKb;
    this.nombreArchivoLabel.set(file.name);

    try {
      const optimized = await comprimirImagenNavegadorWebp(file);
      this.revocarPreview();
      this.selectedFile = optimized.file;
      this.previewDataUrl.set(optimized.previewUrl);
      this.compresionClienteMsg.set('Fotografía lista para guardar');
    } catch {
      this.revocarPreview();
      this.selectedFile = file;
      this.previewDataUrl.set(URL.createObjectURL(file));
      this.compresionClienteMsg.set('Imagen seleccionada lista para subir');
    } finally {
      this.comprimiendo.set(false);
    }
  }

  subir() {
    this.errorMsg.set('');
    this.successResult.set(null);

    if (!this.selectedFile) {
      this.errorMsg.set('Debes seleccionar una fotografía antes de subir.');
      return;
    }
    if (!this.tituloDetalle.trim() || !this.descripcionBreve.trim()) {
      this.errorMsg.set('El título y la descripción breve son obligatorios por normativa de auditoría.');
      return;
    }

    const vehiculoElegido = this.state.vehiculos().find((v) => v.id === this.vehiculoSelectId);
    const vehiculoReferencia = vehiculoElegido
      ? `${vehiculoElegido.marca} ${vehiculoElegido.modelo} ${vehiculoElegido.anio} (${vehiculoElegido.placaOLote})`
      : this.vehiculoManual.trim() || 'Taller General';

    this.subiendo.set(true);
    this.state.subirEvidenciaConDetalle(
      this.selectedFile,
      {
        moduloOrigen: this.moduloOrigen,
        referenciaId: vehiculoElegido ? vehiculoElegido.id : undefined,
        vehiculoReferencia,
        tituloDetalle: this.tituloDetalle.trim(),
        descripcionBreve: this.descripcionBreve.trim(),
        pesoOriginalClienteKb: this.selectedOriginalKb,
      },
      (res) => {
        this.subiendo.set(false);
        this.successResult.set(res);
        this.tituloDetalle = '';
        this.descripcionBreve = '';
        this.selectedFile = null;
        this.selectedOriginalKb = undefined;
        this.revocarPreview();
        this.nombreArchivoLabel.set('');
        this.compresionClienteMsg.set('');
      },
      (err) => {
        this.subiendo.set(false);
        this.errorMsg.set(err);
      },
    );
  }

  cerrar() {
    this.revocarPreview();
    this.selectedFile = null;
    this.selectedOriginalKb = undefined;
    this.nombreArchivoLabel.set('');
    this.compresionClienteMsg.set('');
    this.errorMsg.set('');
    this.successResult.set(null);
    this.closeModal.emit();
  }
}
