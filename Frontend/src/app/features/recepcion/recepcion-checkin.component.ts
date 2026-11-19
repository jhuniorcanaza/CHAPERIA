import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../core/services/app-state.service';
import { comprimirImagenNavegadorWebp } from '../../core/utils/webp-compressor';

type FiltroRecepcion =
  | 'TODOS'
  | 'INTERNO_IMPORTADORA'
  | 'EXTERNO_CALLE'
  | 'EN_TRANSITO'
  | 'NAVIERA_PENDIENTE'
  | 'SIN_PDF';

interface LightboxFoto {
  url: string;
  titulo: string;
  descripcion?: string;
  meta?: string;
}

@Component({
  selector: 'app-recepcion-checkin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <!-- ENCABEZADO DEL ÁREA -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xl">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
            <i class="ri-car-line text-sm"></i>
            <span>Recepción y Orden de Traspaso</span>
          </div>
          <h1 class="text-lg sm:text-xl font-black text-white tracking-tight">
            Recepción de Unidades, Liberación Naviera y Check-In Físico
          </h1>
          <p class="text-xs text-slate-400 max-w-3xl leading-relaxed">
            Registro de vehículos de importadora (naviera, traspaso PDF y grúa), clientes externos e inventario físico de ingreso.
          </p>
        </div>

        <button
          type="button"
          (click)="errorMsg.set(''); mostrarFormularioNuevo.set(true)"
          class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition cursor-pointer shrink-0"
        >
          <i class="ri-add-circle-line text-base"></i>
          <span>+ Registrar Vehículo en Taller</span>
        </button>
      </div>

      <!-- KPIs / RESUMEN OPERATIVO DE RECEPCIÓN -->
      <section class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <button
          type="button"
          (click)="filtroActivo.set('TODOS')"
          class="text-left p-3.5 rounded-2xl border transition cursor-pointer"
          [ngClass]="filtroActivo() === 'TODOS' ? 'bg-blue-950/50 border-blue-500' : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'"
        >
          <span class="text-[11px] font-semibold text-slate-400 block">Total Flota</span>
          <strong class="text-xl font-black text-white">{{ state.vehiculosFiltrados().length }}</strong>
        </button>

        <button
          type="button"
          (click)="filtroActivo.set('INTERNO_IMPORTADORA')"
          class="text-left p-3.5 rounded-2xl border transition cursor-pointer"
          [ngClass]="filtroActivo() === 'INTERNO_IMPORTADORA' ? 'bg-blue-950/50 border-blue-500' : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'"
        >
          <span class="text-[11px] font-semibold text-slate-400 block">Importadora</span>
          <strong class="text-xl font-black text-blue-300">{{ conteoImportadora() }}</strong>
        </button>

        <button
          type="button"
          (click)="filtroActivo.set('EXTERNO_CALLE')"
          class="text-left p-3.5 rounded-2xl border transition cursor-pointer"
          [ngClass]="filtroActivo() === 'EXTERNO_CALLE' ? 'bg-emerald-950/50 border-emerald-500' : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'"
        >
          <span class="text-[11px] font-semibold text-slate-400 block">Clientes Calle</span>
          <strong class="text-xl font-black text-emerald-300">{{ conteoExterno() }}</strong>
        </button>

        <button
          type="button"
          (click)="filtroActivo.set('EN_TRANSITO')"
          class="text-left p-3.5 rounded-2xl border transition cursor-pointer"
          [ngClass]="filtroActivo() === 'EN_TRANSITO' ? 'bg-cyan-950/50 border-cyan-500' : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'"
        >
          <span class="text-[11px] font-semibold text-slate-400 block">En Puerto / Grúa</span>
          <strong class="text-xl font-black text-cyan-300">{{ conteoEnTransito() }}</strong>
        </button>

        <button
          type="button"
          (click)="filtroActivo.set('NAVIERA_PENDIENTE')"
          class="text-left p-3.5 rounded-2xl border transition cursor-pointer"
          [ngClass]="filtroActivo() === 'NAVIERA_PENDIENTE' ? 'bg-rose-950/50 border-rose-500' : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'"
        >
          <span class="text-[11px] font-semibold text-slate-400 block">Naviera Pendiente</span>
          <strong class="text-xl font-black" [class.text-rose-400]="conteoNavieraPendiente() > 0" [class.text-white]="conteoNavieraPendiente() === 0">
            {{ conteoNavieraPendiente() }}
          </strong>
        </button>

        <button
          type="button"
          (click)="filtroActivo.set('SIN_PDF')"
          class="text-left p-3.5 rounded-2xl border transition cursor-pointer"
          [ngClass]="filtroActivo() === 'SIN_PDF' ? 'bg-amber-950/50 border-amber-500' : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'"
        >
          <span class="text-[11px] font-semibold text-slate-400 block">Sin PDF Traspaso</span>
          <strong class="text-xl font-black" [class.text-amber-300]="conteoSinPdf() > 0" [class.text-white]="conteoSinPdf() === 0">
            {{ conteoSinPdf() }}
          </strong>
        </button>
      </section>

      <!-- MENSAJES DE RETROALIMENTACIÓN -->
      @if (feedbackMsg()) {
        <div class="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-xs text-emerald-200 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <i class="ri-checkbox-circle-line text-emerald-400 text-base shrink-0"></i>
            <span>{{ feedbackMsg() }}</span>
          </div>
          <button type="button" (click)="feedbackMsg.set('')" class="text-emerald-300 hover:text-white cursor-pointer">
            <i class="ri-close-line"></i>
          </button>
        </div>
      }

      @if (errorMsg()) {
        <div class="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <i class="ri-error-warning-line text-rose-400 text-base shrink-0"></i>
            <span>{{ errorMsg() }}</span>
          </div>
          <button type="button" (click)="errorMsg.set('')" class="text-rose-300 hover:text-white cursor-pointer">
            <i class="ri-close-line"></i>
          </button>
        </div>
      }

      <!-- ====================================================================
           MODAL: FORMULARIO COMPLETO DE RECEPCIÓN Y CHECK-IN
           ==================================================================== -->
      @if (mostrarFormularioNuevo()) {
        <div
          (click)="mostrarFormularioNuevo.set(false)"
          class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            (click)="$event.stopPropagation()"
            class="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-xs shadow-2xl"
          >
            <div class="px-5 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h2 class="font-bold text-sm text-white flex items-center gap-2">
                  <i class="ri-file-add-line text-blue-400 text-base"></i>
                  <span>Ficha de Ingreso de Vehículo al Taller (Chile)</span>
                </h2>
                <span class="text-[11px] text-slate-400">
                  Registrado por: <strong class="text-slate-200">{{ state.currentUser()?.nombreCompleto }}</strong>
                </span>
              </div>
              <button
                type="button"
                (click)="mostrarFormularioNuevo.set(false)"
                class="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <i class="ri-close-line text-lg"></i>
              </button>
            </div>

            <div class="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">

          <!-- 1. SELECTOR DE MODALIDAD DE CLIENTE -->
          <div class="space-y-2">
            <label class="block text-slate-300 font-bold">1. Origen de la Unidad *</label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                (click)="seleccionarTipoCliente('INTERNO_IMPORTADORA')"
                [ngClass]="tipoCliente === 'INTERNO_IMPORTADORA'
                  ? 'p-3.5 rounded-xl bg-blue-600/15 border-2 border-blue-500 text-left space-y-1 cursor-pointer'
                  : 'p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-1 hover:border-slate-700 cursor-pointer'"
              >
                <div class="flex items-center justify-between">
                  <span class="font-bold text-white flex items-center gap-2">
                    <i class="ri-ship-line text-blue-400 text-sm"></i>
                    <span>Cliente Interno (Importadora / Subasta)</span>
                  </span>
                  @if (tipoCliente === 'INTERNO_IMPORTADORA') {
                    <i class="ri-check-double-line text-blue-400"></i>
                  }
                </div>
                <p class="text-[11px] text-slate-400">
                  Habilita control de Naviera/Grúa, Pago a Naviera, PDF de Orden de Traspaso y Costo de Traslado.
                </p>
              </button>

              <button
                type="button"
                (click)="seleccionarTipoCliente('EXTERNO_CALLE')"
                [ngClass]="tipoCliente === 'EXTERNO_CALLE'
                  ? 'p-3.5 rounded-xl bg-emerald-600/15 border-2 border-emerald-500 text-left space-y-1 cursor-pointer'
                  : 'p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-1 hover:border-slate-700 cursor-pointer'"
              >
                <div class="flex items-center justify-between">
                  <span class="font-bold text-white flex items-center gap-2">
                    <i class="ri-user-follow-line text-emerald-400 text-sm"></i>
                    <span>Cliente Externo (Calle / Otra Importadora)</span>
                  </span>
                  @if (tipoCliente === 'EXTERNO_CALLE') {
                    <i class="ri-check-double-line text-emerald-400"></i>
                  }
                </div>
                <p class="text-[11px] text-slate-400">
                  Ingreso directo en taller sin trámite de naviera. Registra datos del propietario o cliente particular.
                </p>
              </button>
            </div>
          </div>

          <!-- 2. DATOS TÉCNICOS DEL VEHÍCULO -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label class="block text-slate-300 font-semibold mb-1">VIN / Número de Chasis *</label>
              <input
                type="text"
                [(ngModel)]="vinChasis"
                placeholder="Ej: 1FTER4FH8NLA99102"
                class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono uppercase focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">N° de Lote o Placa *</label>
              <input
                type="text"
                [(ngModel)]="placaOLote"
                placeholder="Ej: LOTE-88420 o CL-KJ-1120"
                class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono uppercase focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">Marca *</label>
              <input
                type="text"
                [(ngModel)]="marca"
                placeholder="Ej: Toyota, Ford, Hyundai..."
                class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">Modelo *</label>
              <input
                type="text"
                [(ngModel)]="modelo"
                placeholder="Ej: Tacoma TRD, Rav4..."
                class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">Año</label>
              <input
                type="number"
                [(ngModel)]="anio"
                min="1960"
                max="2035"
                class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">Color</label>
              <input
                type="text"
                [(ngModel)]="color"
                placeholder="Ej: Gris Metálico"
                class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">Nombre Propietario / Importadora *</label>
              <input
                type="text"
                [(ngModel)]="nombreCliente"
                placeholder="Nombre del cliente o importadora"
                class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label class="block text-slate-300 font-semibold mb-1">Teléfono y Prioridad</label>
              <div class="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  [(ngModel)]="telefonoCliente"
                  placeholder="+56 9 / +591"
                  class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
                <select
                  [(ngModel)]="prioridadCola"
                  class="w-full px-2 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="ALTA_15_DIAS">Alta (15 días)</option>
                  <option value="COLA_30_DIAS">Cola (30 días)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- 3. LIBERACIÓN NAVIERA Y ORDEN DE TRASPASO PDF (SOLO CLIENTE INTERNO) -->
          @if (tipoCliente === 'INTERNO_IMPORTADORA') {
            <div class="p-4 rounded-xl bg-slate-950 border border-blue-500/30 space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="font-bold text-blue-400 flex items-center gap-2">
                  <i class="ri-anchor-line"></i>
                  <span>Liberación Naviera, Orden de Traspaso (PDF) y Grúa Puerto → Taller</span>
                </span>
                <span class="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 text-[10px] font-semibold">
                  UNIDADES PROPIAS IMPORTADORA
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                <div>
                  <label class="block text-slate-400 mb-1">Estado Inicial</label>
                  <select
                    [(ngModel)]="estadoInicial"
                    class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  >
                    <option value="RECEPCIONADO">Recepcionado en Taller</option>
                    <option value="EN_PUERTO_NAVIERA">En Puerto / Naviera</option>
                    <option value="EN_GRUA">En Grúa hacia Taller</option>
                  </select>
                </div>

                <div>
                  <label class="block text-slate-400 mb-1">Empresa Naviera</label>
                  <input
                    type="text"
                    [(ngModel)]="navieraNombre"
                    placeholder="Ej: MSC / Hyundai Glovis"
                    class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  />
                </div>

                <div>
                  <label class="block text-slate-400 mb-1">Costo Grúa (USD)</label>
                  <input
                    type="number"
                    min="0"
                    [(ngModel)]="costoGruaImportadoraUsd"
                    class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono"
                  />
                </div>

                <div>
                  <label class="block text-slate-400 mb-1">PDF Orden de Traspaso</label>
                  <input
                    type="file"
                    accept=".pdf,application/pdf,image/*"
                    (change)="subirPdfOrdenTraspasoNuevo($event)"
                    class="block w-full text-[11px] text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                  />
                  @if (ordenTraspasoPdfUrl) {
                    <div class="flex items-center justify-between gap-2 mt-1">
                      <a
                        [href]="state.resolveMediaUrl(ordenTraspasoPdfUrl)"
                        target="_blank"
                        rel="noopener"
                        class="text-[10px] text-emerald-400 hover:underline truncate"
                      >
                        Ver PDF cargado →
                      </a>
                      <button
                        type="button"
                        (click)="ordenTraspasoPdfUrl = ''"
                        class="text-[10px] text-rose-400 hover:underline cursor-pointer"
                      >
                        Quitar
                      </button>
                    </div>
                  }
                </div>

                <label class="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="navieraPagada" class="w-4 h-4 accent-emerald-500" />
                  <span class="font-semibold text-white">Pago Naviera OK</span>
                </label>
              </div>
            </div>
          }

          <!-- 4. CHECKLIST DE ACCESORIOS -->
          <div class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div class="font-bold text-white flex items-center gap-2">
              <i class="ri-list-check-2 text-emerald-400 text-sm"></i>
              <span>2. Checklist Físico de Accesorios en Recepción</span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <label class="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input type="checkbox" [(ngModel)]="tieneLlantaAuxilio" class="w-4 h-4 accent-emerald-500" />
                <span class="text-slate-200 font-medium">Llanta Auxilio</span>
              </label>

              <label class="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input type="checkbox" [(ngModel)]="tieneGataYrench" class="w-4 h-4 accent-emerald-500" />
                <span class="text-slate-200 font-medium">Gata y Llave</span>
              </label>

              <label class="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input type="checkbox" [(ngModel)]="tienePisosCompletos" class="w-4 h-4 accent-emerald-500" />
                <span class="text-slate-200 font-medium">Pisos / Alfombras</span>
              </label>

              <label class="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input type="checkbox" [(ngModel)]="tieneRadioOriginal" class="w-4 h-4 accent-emerald-500" />
                <span class="text-slate-200 font-medium">Radio Original</span>
              </label>

              <label class="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-rose-500/30 cursor-pointer">
                <input type="checkbox" [(ngModel)]="airbagsReventados" class="w-4 h-4 accent-rose-500" />
                <span class="text-rose-300 font-medium">Airbags Reventados</span>
              </label>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label class="block text-slate-400 mb-1">Estado de Faroles, Micas y Parachoques *</label>
                <input
                  type="text"
                  [(ngModel)]="estadoFaroles"
                  placeholder="Ej: Farol derecho roto de puerto, izquierdo intacto"
                  class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label class="block text-slate-400 mb-1">Observaciones Generales del Check-In</label>
                <input
                  type="text"
                  [(ngModel)]="observacionesIngreso"
                  placeholder="Ej: Llegó en grúa sin alfombras traseras, llave única..."
                  class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                />
              </div>
            </div>
          </div>

          <!-- 5. FOTOS DE CHECK-IN (.WEBP CON PRE-COMPRESIÓN EN NAVEGADOR) -->
          <div class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="font-bold text-white flex items-center gap-2">
                <i class="ri-camera-lens-line text-emerald-400 text-sm"></i>
                <span>3. Fotografías de Ingreso con Título y Descripción</span>
              </div>
              <span class="text-[11px] text-slate-400">
                Adjuntadas: <strong class="text-emerald-400">{{ fotosNuevasCheckin().length }}</strong>
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label class="block text-slate-400 mb-1">Título / Detalle *</label>
                <input
                  type="text"
                  [(ngModel)]="fotoCheckinTitulo"
                  placeholder="Ej: Frente chocado y farol derecho roto"
                  class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                />
              </div>

              <div>
                <label class="block text-slate-400 mb-1">Descripción Breve *</label>
                <input
                  type="text"
                  [(ngModel)]="fotoCheckinDescripcion"
                  placeholder="Ej: Estado exacto al bajar de la grúa en taller"
                  class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                />
              </div>

              <div>
                <label class="block text-slate-400 mb-1">Fotografía *</label>
                <input
                  type="file"
                  accept="image/*"
                  [disabled]="subiendoArchivo()"
                  (change)="subirFotoParaNuevoCheckin($event)"
                  class="block w-full text-[11px] text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            @if (fotosNuevasCheckin().length > 0) {
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                @for (f of fotosNuevasCheckin(); track f.url) {
                  <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2.5">
                    <img
                      [src]="state.resolveMediaUrl(f.url)"
                      [alt]="f.titulo"
                      (click)="abrirLightbox(state.resolveMediaUrl(f.url), f.titulo, f.descripcionBreve, 'Ingreso a Taller')"
                      class="w-14 h-12 rounded-lg object-cover border border-slate-700 shrink-0 cursor-pointer"
                    />
                    <div class="min-w-0 flex-1">
                      <div class="font-semibold text-white truncate">{{ f.titulo }}</div>
                      <div class="text-[11px] text-slate-400 truncate">{{ f.descripcionBreve }}</div>
                      <div class="text-[10px] text-emerald-400 mt-0.5">Lista para expediente</div>
                    </div>
                    <button
                      type="button"
                      (click)="quitarFotoNuevaCheckin(f.url)"
                      class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 flex items-center justify-center cursor-pointer shrink-0"
                      title="Quitar foto"
                    >
                      <i class="ri-delete-bin-line text-xs"></i>
                    </button>
                  </div>
                }
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

            <div class="px-5 py-3.5 border-t border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                (click)="mostrarFormularioNuevo.set(false)"
                class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="guardarNuevoVehiculo()"
                [disabled]="guardandoVehiculo() || subiendoArchivo()"
                class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold flex items-center gap-2 cursor-pointer"
              >
                @if (guardandoVehiculo()) {
                  <i class="ri-loader-4-line animate-spin"></i>
                  <span>Guardando Recepción...</span>
                } @else {
                  <i class="ri-save-3-line text-sm"></i>
                  <span>Registrar Recepción y Check-In</span>
                }
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ====================================================================
           LISTADO DE UNIDADES RECEPCIONADAS CON EXPEDIENTE Y EDICIÓN COMPLETA
           ==================================================================== -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        @for (v of vehiculosFiltradosLista(); track v.id) {
          <div
            [attr.data-focus-vehiculo]="v.id"
            [class.ring-2]="state.focusedVehiculoId() === v.id"
            [class.ring-cyan-400]="state.focusedVehiculoId() === v.id"
            class="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-xl transition"
          >
            <div class="space-y-4">
              <!-- Cabecera -->
              <div class="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-extrabold text-base text-white">
                      {{ v.marca }} {{ v.modelo }} ({{ v.anio }})
                    </span>
                    <span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-[11px]">
                      {{ v.color }}
                    </span>
                  </div>
                  <div class="font-mono text-slate-400 mt-0.5 text-[11px]">
                    VIN: <strong class="text-white">{{ v.vinChasis }}</strong> • Lote/Placa:
                    <strong class="text-slate-200">{{ v.placaOLote }}</strong>
                  </div>
                </div>

                <div class="flex flex-col items-end gap-1.5">
                  <div class="flex items-center gap-1.5 flex-wrap justify-end">
                    <span
                      class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border"
                      [ngClass]="obtenerClasesEstadoVehiculo(v.estado)"
                    >
                      {{ etiquetaEstadoVehiculo(v.estado) }}
                    </span>
                    <span
                      [ngClass]="v.tipoCliente === 'INTERNO_IMPORTADORA'
                        ? 'px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold text-[10px]'
                        : 'px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold text-[10px]'"
                    >
                      {{ v.tipoCliente === 'INTERNO_IMPORTADORA' ? 'Importadora' : 'Externo Calle' }}
                    </span>
                  </div>
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
                    <span>
                      Prioridad: <strong class="text-slate-200">{{ v.prioridadCola === 'ALTA_15_DIAS' ? 'Alta (15 días)' : 'Cola (30 días)' }}</strong>
                    </span>
                    @if (v.fechaIngreso) {
                      <span>
                        • Ingreso: <strong class="text-slate-300 font-mono">{{ state.formatFechaHora(v.fechaIngreso) }}</strong>
                      </span>
                    }
                    @if (v.fechaFinalizado) {
                      <span>
                        • Entregado: <strong class="text-emerald-300 font-mono">{{ state.formatFechaHora(v.fechaFinalizado) }}</strong>
                      </span>
                    }
                  </div>
                </div>
              </div>

              <!-- Cliente & Fase 0 Naviera / Traspaso -->
              <div class="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="text-slate-400">
                    Cliente: <strong class="text-white">{{ v.nombreCliente }}</strong>
                    @if (v.telefonoCliente) {
                      <span class="text-slate-400"> ({{ v.telefonoCliente }})</span>
                    }
                  </span>
                  @if (v.tipoCliente === 'INTERNO_IMPORTADORA') {
                    <span
                      [ngClass]="v.navieraPagada
                        ? 'px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]'
                        : 'px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 font-bold text-[10px]'"
                    >
                      {{ v.navieraPagada ? 'Naviera Pagada' : 'Pago Naviera Pendiente' }}
                    </span>
                  }
                </div>

                @if (v.tipoCliente === 'INTERNO_IMPORTADORA') {
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/80 text-[11px]">
                    <div>
                      <span class="text-slate-500 block">Naviera:</span>
                      <strong class="text-slate-200">{{ v.navieraNombre || 'No especificada' }}</strong>
                    </div>
                    <div>
                      <span class="text-slate-500 block">Orden Traspaso PDF:</span>
                      @if (v.ordenTraspasoPdfUrl) {
                        <a
                          [href]="state.resolveMediaUrl(v.ordenTraspasoPdfUrl)"
                          target="_blank"
                          rel="noopener"
                          class="inline-flex items-center gap-1.5 px-2.5 py-1 mt-0.5 rounded-lg bg-blue-950/60 hover:bg-blue-600 border border-blue-500/40 text-blue-300 hover:text-white font-semibold transition"
                        >
                          <i class="ri-file-pdf-2-line text-rose-400"></i>
                          <span>Abrir Orden PDF</span>
                        </a>
                      } @else {
                        <button
                          type="button"
                          (click)="abrirModalEdicion(v)"
                          class="inline-flex items-center gap-1 px-2 py-0.5 mt-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 font-semibold cursor-pointer"
                        >
                          <i class="ri-upload-2-line"></i>
                          <span>Adjuntar PDF</span>
                        </button>
                      }
                    </div>
                    <div>
                      <span class="text-slate-500 block">Costo Grúa a Taller:</span>
                      <strong class="text-amber-400 font-mono">
                        {{ state.formatMoney(v.costoGruaImportadoraUsd) }}
                      </strong>
                    </div>
                  </div>
                }
              </div>

              <!-- Matriz Check-In de Accesorios -->
              @if (v.checkIn) {
                <div class="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-slate-200 flex items-center gap-1.5">
                      <i class="ri-shield-check-line text-emerald-400"></i>
                      <span>Inventario Físico de Recepción (Check-In)</span>
                    </span>
                  </div>

                  <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    <div class="p-2 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                      <span class="text-slate-400">Llanta Auxilio:</span>
                      <strong [class]="v.checkIn.tieneLlantaAuxilio ? 'text-emerald-400' : 'text-rose-400'">
                        {{ v.checkIn.tieneLlantaAuxilio ? 'Sí tiene' : 'No tiene' }}
                      </strong>
                    </div>
                    <div class="p-2 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                      <span class="text-slate-400">Gata Hidráulica:</span>
                      <strong [class]="v.checkIn.tieneGataYrench ? 'text-emerald-400' : 'text-rose-400'">
                        {{ v.checkIn.tieneGataYrench ? 'Sí tiene' : 'No tiene' }}
                      </strong>
                    </div>
                    <div class="p-2 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                      <span class="text-slate-400">Pisos:</span>
                      <strong [class]="v.checkIn.tienePisosCompletos ? 'text-emerald-400' : 'text-rose-400'">
                        {{ v.checkIn.tienePisosCompletos ? 'Completos' : 'Faltan' }}
                      </strong>
                    </div>
                    <div class="p-2 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                      <span class="text-slate-400">Radio Original:</span>
                      <strong [class]="v.checkIn.tieneRadioOriginal ? 'text-emerald-400' : 'text-rose-400'">
                        {{ v.checkIn.tieneRadioOriginal ? 'Sí tiene' : 'No tiene' }}
                      </strong>
                    </div>
                    <div class="p-2 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                      <span class="text-slate-400">Airbags:</span>
                      <strong [class]="v.checkIn.airbagsReventados ? 'text-rose-400' : 'text-emerald-400'">
                        {{ v.checkIn.airbagsReventados ? 'Reventados' : 'Intactos' }}
                      </strong>
                    </div>
                    <div class="p-2 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                      <span class="text-slate-400">Fotos:</span>
                      <strong class="text-blue-400 font-mono">
                        {{ (v.checkIn.fotosIngresoWebp || []).length }} adjunta(s)
                      </strong>
                    </div>
                  </div>

                  <div class="text-[11px] text-slate-300 space-y-1">
                    <div>
                      <span class="text-slate-500">Estado Faroles:</span>
                      <strong class="text-amber-300 ml-1">{{ v.checkIn.estadoFaroles }}</strong>
                    </div>
                    @if (v.checkIn.observacionesIngreso) {
                      <div>
                        <span class="text-slate-500">Observación:</span>
                        <span class="text-slate-300 ml-1">{{ v.checkIn.observacionesIngreso }}</span>
                      </div>
                    }
                  </div>

                  <!-- Galería de Fotos Check-In con Lightbox -->
                  @if ((v.checkIn.fotosIngresoWebp || []).length > 0) {
                    <div class="pt-2 border-t border-slate-800 space-y-2">
                      <div class="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                        Fotografías de Ingreso — Clic para ampliar:
                      </div>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        @for (foto of v.checkIn.fotosIngresoWebp; track foto.url) {
                          <div
                            (click)="abrirLightbox(state.resolveMediaUrl(foto.url), foto.titulo, foto.descripcionBreve, v.marca + ' ' + v.modelo)"
                            class="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 flex items-center gap-2.5 text-[11px] transition group cursor-pointer"
                          >
                            <img
                              [src]="state.resolveMediaUrl(foto.url)"
                              [alt]="foto.titulo"
                              class="w-14 h-11 rounded-lg object-cover border border-slate-700 shrink-0"
                            />
                            <div class="min-w-0 flex-1">
                              <div class="font-semibold text-white group-hover:text-cyan-300 truncate">{{ foto.titulo }}</div>
                              @if (foto.descripcionBreve) {
                                <div class="text-slate-400 truncate text-[10px]">{{ foto.descripcionBreve }}</div>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              }

              <!-- Formulario Rápido Anexar Nueva Foto -->
              @if (vehiculoActivoParaFoto() === v.id) {
                <div class="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-2.5">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-emerald-400">
                      Anexar Fotografía de Check-In
                    </span>
                    <button type="button" (click)="vehiculoActivoParaFoto.set(null)" class="text-slate-400 hover:text-white cursor-pointer">
                      <i class="ri-close-line"></i>
                    </button>
                  </div>
                  <input
                    type="text"
                    [(ngModel)]="extraFotoTitulo"
                    placeholder="Título / Detalle (Ej: Maletero y llanta auxilio)"
                    class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                  />
                  <input
                    type="text"
                    [(ngModel)]="extraFotoDescripcion"
                    placeholder="Descripción breve obligatoria (mínimo 5 caracteres)..."
                    class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                  />
                  <div class="flex items-center justify-between gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      [disabled]="subiendoArchivo()"
                      (change)="subirFotoExtraCheckin($event, v)"
                      class="block w-full text-[11px] text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white cursor-pointer"
                    />
                    @if (subiendoArchivo()) {
                      <i class="ri-loader-4-line animate-spin text-emerald-400 text-base shrink-0"></i>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Botones de Acción de la Tarjeta -->
            <div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
              <div class="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  (click)="abrirModalEdicion(v)"
                  class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer transition"
                >
                  <i class="ri-edit-2-line text-cyan-400"></i>
                  <span>Editar Ficha y Check-In</span>
                </button>

                <button
                  type="button"
                  (click)="vehiculoActivoParaFoto.set(vehiculoActivoParaFoto() === v.id ? null : v.id)"
                  class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer transition"
                >
                  <i class="ri-camera-line text-emerald-400"></i>
                  <span>Anexar Fotografía</span>
                </button>
              </div>

              <button
                type="button"
                (click)="irACotizacion(v.id)"
                class="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                <span>Ir a Cotización</span>
                <i class="ri-arrow-right-line"></i>
              </button>
            </div>
          </div>
        } @empty {
          <div class="col-span-full p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2 text-slate-400">
            <i class="ri-car-line text-3xl text-slate-600 block"></i>
            <p class="font-semibold text-white">No hay vehículos que coincidan con el filtro seleccionado.</p>
            <button
              type="button"
              (click)="filtroActivo.set('TODOS')"
              class="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-cyan-300 cursor-pointer"
            >
              Ver todos los vehículos
            </button>
          </div>
        }
      </div>
    </div>

    <!-- MODAL DE EDICIÓN DE RECEPCIÓN, TRASPASO Y CHECK-IN (AUDITADO) -->
    @if (vehiculoEditando(); as ve) {
      <div class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
          <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
            <div>
              <h3 class="font-bold text-sm text-white flex items-center gap-2">
                <i class="ri-edit-2-line text-cyan-400"></i>
                <span>Editar Recepción / Traspaso / Check-In: {{ ve.marca }} {{ ve.modelo }}</span>
              </h3>
              <p class="text-[11px] text-slate-400 font-mono">VIN: {{ ve.vinChasis }}</p>
            </div>
            <button type="button" (click)="vehiculoEditando.set(null)" class="text-slate-400 hover:text-white cursor-pointer">
              <i class="ri-close-line text-lg"></i>
            </button>
          </div>

          <div class="p-5 space-y-4 overflow-y-auto text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-slate-400 mb-1">Estado del Vehículo</label>
                <select
                  [(ngModel)]="editForm.estado"
                  class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="EN_PUERTO_NAVIERA">En Puerto / Naviera</option>
                  <option value="EN_GRUA">En Grúa hacia Taller</option>
                  <option value="RECEPCIONADO">Recepcionado en Taller</option>
                  <option value="COTIZADO">Cotizado</option>
                  <option value="EN_TALLER">En Taller (Reparación)</option>
                  <option value="RETIRADO_SIN_REPARAR">Retirado sin Reparar</option>
                </select>
              </div>
              <div>
                <label class="block text-slate-400 mb-1">Prioridad de Cola</label>
                <select
                  [(ngModel)]="editForm.prioridadCola"
                  class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="ALTA_15_DIAS">Alta (15 días)</option>
                  <option value="COLA_30_DIAS">Cola (30 días)</option>
                </select>
              </div>
              <div>
                <label class="block text-slate-400 mb-1">Placa o Lote</label>
                <input
                  [(ngModel)]="editForm.placaOLote"
                  type="text"
                  class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono uppercase"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-400 mb-1">Color</label>
                <input
                  [(ngModel)]="editForm.color"
                  type="text"
                  class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label class="block text-slate-400 mb-1">Teléfono Contacto</label>
                <input
                  [(ngModel)]="editForm.telefonoCliente"
                  type="text"
                  class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
            </div>

            @if (ve.tipoCliente === 'INTERNO_IMPORTADORA') {
              <div class="p-3.5 rounded-xl bg-slate-950 border border-blue-500/30 space-y-3">
                <span class="font-bold text-blue-400 block">Naviera, Grúa y Orden de Traspaso PDF</span>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-slate-400 mb-1">Empresa Naviera</label>
                    <input
                      [(ngModel)]="editForm.navieraNombre"
                      type="text"
                      class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                    />
                  </div>
                  <div>
                    <label class="block text-slate-400 mb-1">Costo Grúa (USD)</label>
                    <input
                      [(ngModel)]="editForm.costoGruaImportadoraUsd"
                      type="number"
                      min="0"
                      class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono"
                    />
                  </div>
                </div>

                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" [(ngModel)]="editForm.navieraPagada" class="w-4 h-4 accent-emerald-500" />
                    <span class="font-semibold text-white">Pago a Naviera Verificado</span>
                  </label>

                  <div class="flex-1">
                    <input
                      type="file"
                      accept=".pdf,application/pdf,image/*"
                      (change)="subirPdfEnEdicion($event, ve)"
                      class="block w-full text-[11px] text-slate-300 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white cursor-pointer"
                    />
                    @if (editForm.ordenTraspasoPdfUrl) {
                      <a
                        [href]="state.resolveMediaUrl(editForm.ordenTraspasoPdfUrl)"
                        target="_blank"
                        rel="noopener"
                        class="text-[10px] text-emerald-400 hover:underline inline-block mt-1"
                      >
                        PDF actual listo →
                      </a>
                    }
                  </div>
                </div>
              </div>
            }

            <div class="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <span class="font-bold text-emerald-400 block">Checklist de Accesorios</span>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <label class="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="editForm.tieneLlantaAuxilio" class="w-4 h-4 accent-emerald-500" />
                  <span>Llanta Auxilio</span>
                </label>
                <label class="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="editForm.tieneGataYrench" class="w-4 h-4 accent-emerald-500" />
                  <span>Gata y Llave</span>
                </label>
                <label class="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="editForm.tienePisosCompletos" class="w-4 h-4 accent-emerald-500" />
                  <span>Pisos Completos</span>
                </label>
                <label class="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="editForm.tieneRadioOriginal" class="w-4 h-4 accent-emerald-500" />
                  <span>Radio Original</span>
                </label>
                <label class="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-rose-500/30 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="editForm.airbagsReventados" class="w-4 h-4 accent-rose-500" />
                  <span class="text-rose-300">Airbags Reventados</span>
                </label>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-slate-400 mb-1">Estado Faroles</label>
                  <input
                    [(ngModel)]="editForm.estadoFaroles"
                    type="text"
                    class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label class="block text-slate-400 mb-1">Observaciones Ingreso</label>
                  <input
                    [(ngModel)]="editForm.observacionesIngreso"
                    type="text"
                    class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <label class="block text-amber-300 font-bold mb-1">Motivo de la actualización *</label>
              <input
                [(ngModel)]="editForm.motivoEdicion"
                type="text"
                placeholder="Ej. Naviera liberada con PDF adjunto y unidad ingresada en grúa"
                class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-white"
              />
            </div>

            @if (modalError()) {
              <p class="text-xs text-rose-400 font-semibold">{{ modalError() }}</p>
            }
          </div>

          <div class="px-5 py-3.5 border-t border-slate-800 bg-slate-950/70 flex justify-end gap-2">
            <button
              type="button"
              (click)="vehiculoEditando.set(null)"
              class="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="guardarEdicionCheckin()"
              [disabled]="guardandoEdicion() || subiendoArchivo()"
              class="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
            >
              {{ guardandoEdicion() ? 'Guardando...' : 'Guardar Cambios Auditados' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- MODAL LIGHTBOX PARA AMPLIAR FOTOS .WEBP -->
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
  `,
})
export class RecepcionCheckinComponent {
  state = inject(AppStateService);

  mostrarFormularioNuevo = signal<boolean>(false);
  filtroActivo = signal<FiltroRecepcion>('TODOS');
  feedbackMsg = signal<string>('');
  errorMsg = signal<string>('');
  modalError = signal<string>('');
  subiendoArchivo = signal<boolean>(false);
  guardandoVehiculo = signal<boolean>(false);
  guardandoEdicion = signal<boolean>(false);

  lightbox = signal<LightboxFoto | null>(null);
  vehiculoEditando = signal<any | null>(null);

  constructor() {
    effect(() => {
      const fVeh = this.state.focusedVehiculoId();
      const fRef = this.state.focusedReferenciaId();
      if (!fVeh && !fRef) return;
      this.filtroActivo.set('TODOS');
      this.mostrarFormularioNuevo.set(false);
    });
  }

  // Campos del Formulario de Nueva Recepción
  tipoCliente: 'INTERNO_IMPORTADORA' | 'EXTERNO_CALLE' = 'INTERNO_IMPORTADORA';
  estadoInicial: 'EN_PUERTO_NAVIERA' | 'EN_GRUA' | 'RECEPCIONADO' = 'RECEPCIONADO';
  vinChasis = '';
  placaOLote = '';
  marca = '';
  modelo = '';
  anio = 2024;
  color = 'Blanco';
  nombreCliente = 'Importadora Propia (Mercado Bolivia)';
  telefonoCliente = '+591 70012345';
  prioridadCola: 'ALTA_15_DIAS' | 'COLA_30_DIAS' = 'ALTA_15_DIAS';

  // Fase 0 Naviera
  navieraNombre = 'MSC Mediterranean Shipping';
  navieraPagada = true;
  ordenTraspasoPdfUrl = '';
  costoGruaImportadoraUsd = 85;

  // Checklist Interior
  tieneLlantaAuxilio = true;
  tieneGataYrench = true;
  tienePisosCompletos = true;
  tieneRadioOriginal = true;
  airbagsReventados = false;
  estadoFaroles = 'Farol delantero derecho roto en puerto';
  observacionesIngreso = '';

  // Fotos nuevas
  fotoCheckinTitulo = '';
  fotoCheckinDescripcion = '';
  fotosNuevasCheckin = signal<
    Array<{ titulo: string; descripcionBreve: string; url: string; pesoKb: number }>
  >([]);

  // Anexar foto extra
  vehiculoActivoParaFoto = signal<string | null>(null);
  extraFotoTitulo = '';
  extraFotoDescripcion = '';

  // Formulario de edición modal
  editForm: any = {
    estado: 'RECEPCIONADO',
    prioridadCola: 'ALTA_15_DIAS',
    placaOLote: '',
    color: '',
    telefonoCliente: '',
    navieraNombre: '',
    navieraPagada: false,
    ordenTraspasoPdfUrl: '',
    costoGruaImportadoraUsd: 0,
    tieneLlantaAuxilio: true,
    tieneGataYrench: true,
    tienePisosCompletos: true,
    tieneRadioOriginal: true,
    airbagsReventados: false,
    estadoFaroles: '',
    observacionesIngreso: '',
    motivoEdicion: '',
  };

  conteoImportadora = computed(
    () => this.state.vehiculosFiltrados().filter((v) => v.tipoCliente === 'INTERNO_IMPORTADORA').length,
  );
  conteoExterno = computed(
    () => this.state.vehiculosFiltrados().filter((v) => v.tipoCliente === 'EXTERNO_CALLE').length,
  );
  conteoEnTransito = computed(
    () =>
      this.state
        .vehiculosFiltrados()
        .filter((v) => v.estado === 'EN_PUERTO_NAVIERA' || v.estado === 'EN_GRUA').length,
  );
  conteoNavieraPendiente = computed(
    () =>
      this.state
        .vehiculosFiltrados()
        .filter((v) => v.tipoCliente === 'INTERNO_IMPORTADORA' && !v.navieraPagada).length,
  );
  conteoSinPdf = computed(
    () =>
      this.state
        .vehiculosFiltrados()
        .filter((v) => v.tipoCliente === 'INTERNO_IMPORTADORA' && !v.ordenTraspasoPdfUrl).length,
  );

  vehiculosFiltradosLista = computed(() => {
    const base = this.state.vehiculosFiltrados();
    const fVeh = this.state.focusedVehiculoId();
    let filtrados = base;
    switch (this.filtroActivo()) {
      case 'INTERNO_IMPORTADORA':
        filtrados = base.filter((v) => v.tipoCliente === 'INTERNO_IMPORTADORA');
        break;
      case 'EXTERNO_CALLE':
        filtrados = base.filter((v) => v.tipoCliente === 'EXTERNO_CALLE');
        break;
      case 'EN_TRANSITO':
        filtrados = base.filter((v) => v.estado === 'EN_PUERTO_NAVIERA' || v.estado === 'EN_GRUA');
        break;
      case 'NAVIERA_PENDIENTE':
        filtrados = base.filter((v) => v.tipoCliente === 'INTERNO_IMPORTADORA' && !v.navieraPagada);
        break;
      case 'SIN_PDF':
        filtrados = base.filter((v) => v.tipoCliente === 'INTERNO_IMPORTADORA' && !v.ordenTraspasoPdfUrl);
        break;
      default:
        filtrados = base;
    }
    if (!fVeh) return filtrados;
    return [...filtrados].sort((a, b) => (a.id === fVeh ? 0 : 1) - (b.id === fVeh ? 0 : 1));
  });

  seleccionarTipoCliente(tipo: 'INTERNO_IMPORTADORA' | 'EXTERNO_CALLE') {
    this.tipoCliente = tipo;
    if (tipo === 'INTERNO_IMPORTADORA') {
      this.nombreCliente = 'Importadora Propia (Mercado Bolivia)';
    } else {
      this.nombreCliente = '';
      this.estadoInicial = 'RECEPCIONADO';
    }
  }

  etiquetaEstadoVehiculo(estado: string): string {
    const mapa: Record<string, string> = {
      EN_PUERTO_NAVIERA: 'En Puerto',
      EN_GRUA: 'En Grúa',
      RECEPCIONADO: 'Recepcionado',
      COTIZADO: 'Cotizado',
      EN_TALLER: 'En Taller',
      FINALIZADO: 'Finalizado',
      RETIRADO_SIN_REPARAR: 'Retirado',
    };
    return mapa[estado] || estado;
  }

  obtenerClasesEstadoVehiculo(estado: string): string {
    if (estado === 'FINALIZADO') return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
    if (estado === 'EN_TALLER') return 'bg-blue-500/15 border-blue-500/40 text-blue-300';
    if (estado === 'EN_PUERTO_NAVIERA' || estado === 'EN_GRUA') {
      return 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300';
    }
    if (estado === 'RETIRADO_SIN_REPARAR') return 'bg-rose-500/15 border-rose-500/40 text-rose-300';
    return 'bg-amber-500/15 border-amber-500/40 text-amber-300';
  }

  abrirLightbox(url: string, titulo: string, descripcion?: string, meta?: string) {
    this.lightbox.set({ url, titulo, descripcion, meta });
  }

  irACotizacion(vehiculoId: string) {
    this.state.irAVehiculoEnModulo(vehiculoId, 'cotizacion');
  }

  subirPdfOrdenTraspasoNuevo(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    this.subiendoArchivo.set(true);
    this.errorMsg.set('');

    this.state.subirEvidenciaConDetalle(
      file,
      {
        moduloOrigen: 'TRASPASO_NAVIERA',
        vehiculoReferencia: `${this.marca || 'Unidad'} ${this.modelo || ''} (${this.vinChasis || 'Nuevo Ingreso'})`,
        tituloDetalle: `Orden de Traspaso Naviera - ${this.navieraNombre || 'Puerto'}`,
        descripcionBreve: 'Documento de liberación naviera adjuntado durante recepción de unidad.',
      },
      (ev) => {
        this.subiendoArchivo.set(false);
        this.ordenTraspasoPdfUrl = ev.archivoWebpUrl;
        input.value = '';
        this.feedbackMsg.set(`Orden de Traspaso cargada (${ev.nombreArchivo}).`);
      },
      (err) => {
        this.subiendoArchivo.set(false);
        input.value = '';
        this.errorMsg.set(err);
      },
    );
  }

  async subirFotoParaNuevoCheckin(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    if (!this.fotoCheckinTitulo.trim() || this.fotoCheckinTitulo.trim().length < 3) {
      this.errorMsg.set('Antes de seleccionar la foto, escribe su Título / Detalle puntual.');
      input.value = '';
      return;
    }
    if (!this.fotoCheckinDescripcion.trim() || this.fotoCheckinDescripcion.trim().length < 5) {
      this.errorMsg.set('Antes de seleccionar la foto, escribe su Descripción Breve obligatoria.');
      input.value = '';
      return;
    }

    let file = input.files[0];
    let originalKb: number | undefined;
    this.errorMsg.set('');
    this.subiendoArchivo.set(true);

    try {
      const comp = await comprimirImagenNavegadorWebp(file);
      file = comp.file;
      originalKb = comp.originalKb;
      if (comp.previewUrl.startsWith('blob:')) URL.revokeObjectURL(comp.previewUrl);
    } catch {
      // Fallback al archivo original para que Sharp lo procese en servidor
    }

    this.state.subirEvidenciaConDetalle(
      file,
      {
        moduloOrigen: 'CHECKIN_RECEPCION',
        vehiculoReferencia: `${this.marca || 'Vehículo'} ${this.modelo || ''} (VIN: ${this.vinChasis || 'En Recepción'})`,
        tituloDetalle: this.fotoCheckinTitulo.trim(),
        descripcionBreve: this.fotoCheckinDescripcion.trim(),
        pesoOriginalClienteKb: originalKb,
      },
      (ev) => {
        this.subiendoArchivo.set(false);
        this.fotosNuevasCheckin.update((prev) => [
          ...prev,
          {
            titulo: ev.tituloDetalle,
            descripcionBreve: ev.descripcionBreve,
            url: ev.archivoWebpUrl,
            pesoKb: ev.pesoWebpKb,
          },
        ]);
        this.fotoCheckinTitulo = '';
        this.fotoCheckinDescripcion = '';
        input.value = '';
        this.feedbackMsg.set('Fotografía anexada al Check-In del vehículo.');
      },
      (err) => {
        this.subiendoArchivo.set(false);
        this.errorMsg.set(err);
      },
    );
  }

  quitarFotoNuevaCheckin(url: string) {
    this.fotosNuevasCheckin.update((prev) => prev.filter((item) => item.url !== url));
  }

  guardarNuevoVehiculo() {
    this.errorMsg.set('');
    this.feedbackMsg.set('');

    if (!this.vinChasis.trim() || !this.marca.trim() || !this.modelo.trim() || !this.nombreCliente.trim()) {
      this.errorMsg.set('Completa obligatoriamente VIN/Chasis, Marca, Modelo y Nombre del Cliente.');
      return;
    }

    this.guardandoVehiculo.set(true);
    this.state.crearVehiculoConCheckIn(
      {
        vinChasis: this.vinChasis,
        placaOLote: this.placaOLote || 'SIN-LOTE',
        marca: this.marca,
        modelo: this.modelo,
        anio: this.anio,
        color: this.color,
        tipoCliente: this.tipoCliente,
        estado: this.tipoCliente === 'INTERNO_IMPORTADORA' ? this.estadoInicial : 'RECEPCIONADO',
        nombreCliente: this.nombreCliente,
        telefonoCliente: this.telefonoCliente,
        prioridadCola: this.prioridadCola,
        navieraNombre: this.navieraNombre,
        navieraPagada: this.navieraPagada,
        ordenTraspasoPdfUrl: this.ordenTraspasoPdfUrl,
        costoGruaImportadoraUsd: this.costoGruaImportadoraUsd,
        tieneLlantaAuxilio: this.tieneLlantaAuxilio,
        tieneGataYrench: this.tieneGataYrench,
        tienePisosCompletos: this.tienePisosCompletos,
        tieneRadioOriginal: this.tieneRadioOriginal,
        airbagsReventados: this.airbagsReventados,
        estadoFaroles: this.estadoFaroles,
        observacionesIngreso: this.observacionesIngreso,
        fotosIngresoWebp: this.fotosNuevasCheckin(),
      },
      (vehiculoCreado) => {
        this.guardandoVehiculo.set(false);
        this.feedbackMsg.set(
          `Unidad ${vehiculoCreado.marca} ${vehiculoCreado.modelo} (VIN: ${vehiculoCreado.vinChasis}) recepcionada exitosamente.`,
        );
        this.vinChasis = '';
        this.placaOLote = '';
        this.marca = '';
        this.modelo = '';
        this.ordenTraspasoPdfUrl = '';
        this.observacionesIngreso = '';
        this.fotosNuevasCheckin.set([]);
        this.mostrarFormularioNuevo.set(false);
      },
      (err) => {
        this.guardandoVehiculo.set(false);
        this.errorMsg.set(err);
      },
    );
  }

  async subirFotoExtraCheckin(event: Event, vehiculo: any) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    if (!this.extraFotoTitulo.trim() || this.extraFotoDescripcion.trim().length < 5) {
      this.errorMsg.set(
        'Debes completar el título y una descripción breve (mín. 5 caracteres) antes de subir la foto.',
      );
      input.value = '';
      return;
    }

    let file = input.files[0];
    let originalKb: number | undefined;
    this.errorMsg.set('');
    this.subiendoArchivo.set(true);

    try {
      const comp = await comprimirImagenNavegadorWebp(file);
      file = comp.file;
      originalKb = comp.originalKb;
      if (comp.previewUrl.startsWith('blob:')) URL.revokeObjectURL(comp.previewUrl);
    } catch {
      // Fallback al servidor
    }

    this.state.subirEvidenciaConDetalle(
      file,
      {
        moduloOrigen: 'CHECKIN_RECEPCION',
        referenciaId: vehiculo.id,
        vehiculoReferencia: `${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio} (${vehiculo.placaOLote})`,
        tituloDetalle: this.extraFotoTitulo.trim(),
        descripcionBreve: this.extraFotoDescripcion.trim(),
        pesoOriginalClienteKb: originalKb,
        skipBootstrapReload: true,
      },
      (ev) => {
        this.state.agregarFotoAlCheckIn(
          vehiculo.id,
          {
            titulo: ev.tituloDetalle,
            descripcionBreve: ev.descripcionBreve,
            url: ev.archivoWebpUrl,
            pesoKb: ev.pesoWebpKb,
          },
          () => {
            this.subiendoArchivo.set(false);
            this.extraFotoTitulo = '';
            this.extraFotoDescripcion = '';
            this.vehiculoActivoParaFoto.set(null);
            input.value = '';
            this.feedbackMsg.set('Fotografía anexada al Check-In del vehículo.');
          },
          (err) => {
            this.subiendoArchivo.set(false);
            this.errorMsg.set(err);
          },
        );
      },
      (err) => {
        this.subiendoArchivo.set(false);
        this.errorMsg.set(err);
      },
    );
  }

  abrirModalEdicion(v: any) {
    this.modalError.set('');
    this.editForm = {
      estado: v.estado || 'RECEPCIONADO',
      prioridadCola: v.prioridadCola || 'ALTA_15_DIAS',
      placaOLote: v.placaOLote || '',
      color: v.color || '',
      telefonoCliente: v.telefonoCliente || '',
      navieraNombre: v.navieraNombre || '',
      navieraPagada: Boolean(v.navieraPagada),
      ordenTraspasoPdfUrl: v.ordenTraspasoPdfUrl || '',
      costoGruaImportadoraUsd: Number(v.costoGruaImportadoraUsd || 0),
      tieneLlantaAuxilio: Boolean(v.checkIn?.tieneLlantaAuxilio),
      tieneGataYrench: Boolean(v.checkIn?.tieneGataYrench),
      tienePisosCompletos: Boolean(v.checkIn?.tienePisosCompletos),
      tieneRadioOriginal: Boolean(v.checkIn?.tieneRadioOriginal),
      airbagsReventados: Boolean(v.checkIn?.airbagsReventados),
      estadoFaroles: v.checkIn?.estadoFaroles || '',
      observacionesIngreso: v.checkIn?.observacionesIngreso || '',
      motivoEdicion: '',
    };
    this.vehiculoEditando.set(v);
  }

  subirPdfEnEdicion(event: Event, vehiculo: any) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    this.subiendoArchivo.set(true);
    this.modalError.set('');

    this.state.subirEvidenciaConDetalle(
      file,
      {
        moduloOrigen: 'TRASPASO_NAVIERA',
        referenciaId: vehiculo.id,
        vehiculoReferencia: `${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio} (${vehiculo.placaOLote})`,
        tituloDetalle: `Orden de Traspaso PDF - ${vehiculo.placaOLote}`,
        descripcionBreve: `Documento de traspaso naviera actualizado en recepción (${this.editForm.navieraNombre || 'Puerto'}).`,
      },
      (ev) => {
        this.subiendoArchivo.set(false);
        this.editForm.ordenTraspasoPdfUrl = ev.archivoWebpUrl;
        input.value = '';
      },
      (err) => {
        this.subiendoArchivo.set(false);
        input.value = '';
        this.modalError.set(err);
      },
    );
  }

  guardarEdicionCheckin() {
    const v = this.vehiculoEditando();
    if (!v) return;
    this.modalError.set('');

    if (!this.editForm.motivoEdicion || this.editForm.motivoEdicion.trim().length < 3) {
      this.modalError.set('El motivo de la actualización es obligatorio para auditoría.');
      return;
    }

    this.guardandoEdicion.set(true);
    this.state.actualizarCheckInVehiculo(
      v.id,
      {
        ...this.editForm,
        motivoEdicion: this.editForm.motivoEdicion.trim(),
      },
      () => {
        this.guardandoEdicion.set(false);
        this.vehiculoEditando.set(null);
        this.feedbackMsg.set(
          `Recepción y Check-In de ${v.marca} ${v.modelo} actualizados y sellados en auditoría.`,
        );
      },
      (err) => {
        this.guardandoEdicion.set(false);
        this.modalError.set(err);
      },
    );
  }
}
