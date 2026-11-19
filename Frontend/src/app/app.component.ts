import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from './core/services/app-state.service';
import { LoginComponent } from './features/auth/login/login.component';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { PhotoEvidenceModalComponent } from './shared/components/photo-evidence-modal/photo-evidence-modal.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { RecepcionCheckinComponent } from './features/recepcion/recepcion-checkin.component';
import { CotizacionesComponent } from './features/cotizaciones/cotizaciones.component';
import { OrdenesTrabajoComponent } from './features/ordenes-trabajo/ordenes-trabajo.component';
import { RepuestosComponent } from './features/repuestos/repuestos.component';
import { AlmacenComponent } from './features/almacen/almacen.component';
import { HerramientasPersonalComponent } from './features/herramientas-personal/herramientas-personal.component';
import { ReportesFinancierosComponent } from './features/reportes-financieros/reportes-financieros.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    LoginComponent,
    SidebarComponent,
    NavbarComponent,
    PhotoEvidenceModalComponent,
    DashboardComponent,
    RecepcionCheckinComponent,
    CotizacionesComponent,
    OrdenesTrabajoComponent,
    RepuestosComponent,
    AlmacenComponent,
    HerramientasPersonalComponent,
    ReportesFinancierosComponent,
  ],
  template: `
    @if (!state.currentUser()) {
      <app-login></app-login>
    } @else {
      <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
        <app-sidebar></app-sidebar>

        <div class="flex-1 flex flex-col min-w-0">
          <app-navbar (openPhotoModal)="photoModalOpen.set(true)"></app-navbar>

          <!-- Toast en Tiempo Real Clicable (lleva al módulo y marca como leída) -->
          @if (state.liveToast(); as toast) {
            <div
              role="button"
              tabindex="0"
              (click)="state.abrirNotificacion(toast)"
              (keydown.enter)="state.abrirNotificacion(toast)"
              class="no-print fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 sm:max-w-md bg-slate-900/95 backdrop-blur-xl border border-blue-500/80 hover:border-cyan-400 rounded-2xl p-4 shadow-2xl cursor-pointer transition group"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="space-y-1.5 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-600 text-white tracking-wider uppercase">
                      Nueva Alerta
                    </span>
                    <span class="text-[10px] font-semibold text-cyan-300 group-hover:underline">
                      Clic para ir al detalle →
                    </span>
                  </div>
                  <p class="font-bold text-sm text-white leading-snug">{{ toast.titulo }}</p>
                  <p class="text-xs text-slate-300 leading-relaxed">{{ toast.mensaje }}</p>
                </div>
                <button
                  type="button"
                  (click)="$event.stopPropagation(); state.dismissToast()"
                  class="w-7 h-7 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
                  aria-label="Cerrar aviso"
                >
                  <i class="ri-close-line"></i>
                </button>
              </div>
            </div>
          }

          <app-photo-evidence-modal
            [isOpen]="photoModalOpen()"
            (closeModal)="photoModalOpen.set(false)"
          ></app-photo-evidence-modal>

          <main class="flex-1 p-4 sm:p-6 space-y-5 max-w-7xl w-full mx-auto">
            @if (state.securityAlertBanner()) {
              <div class="no-print p-4 rounded-xl bg-rose-950/60 border border-rose-500 text-xs text-rose-200 font-semibold flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <i class="ri-shield-keyhole-line text-base text-rose-400"></i>
                  <span>{{ state.securityAlertBanner() }}</span>
                </div>
                <button (click)="state.securityAlertBanner.set(null)" class="cursor-pointer shrink-0">
                  <i class="ri-close-line"></i>
                </button>
              </div>
            }

            @if (state.notificationHighlightBanner()) {
              <div class="no-print px-4 py-2.5 rounded-xl bg-cyan-950/50 border border-cyan-500/40 text-xs text-cyan-200 flex items-center justify-between gap-3 shadow-sm">
                <div class="flex items-center gap-2 min-w-0">
                  <i class="ri-focus-3-line text-cyan-400 text-sm shrink-0"></i>
                  <span class="truncate font-medium">{{ state.notificationHighlightBanner() }}</span>
                </div>
                <button
                  type="button"
                  (click)="state.clearNotificationFocus()"
                  class="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-[11px] font-bold text-cyan-200 transition cursor-pointer shrink-0"
                >
                  Limpiar enfoque
                </button>
              </div>
            }

            <!-- ETAPA 1: MÓDULO 1 (DASHBOARD CENTRAL, FOTOS .WEBP Y AUDITORÍA INMUTABLE) -->
            @if (state.activeTab() === 'dashboard') {
              <app-dashboard (openPhotoModal)="photoModalOpen.set(true)"></app-dashboard>
            }

            <!-- ETAPA 2: MÓDULO 2 (RECEPCIÓN, ORDEN DE TRASPASO NAVIERA Y CHECK-IN) -->
            @if (state.activeTab() === 'recepcion') {
              <app-recepcion-checkin></app-recepcion-checkin>
            }

            <!-- ETAPA 2: MÓDULO 3 (COTIZACIONES LEVE/FUERTE, DESARME Y FLUJO AMARILLO -> VERDE) -->
            @if (state.activeTab() === 'cotizacion') {
              <app-cotizaciones></app-cotizaciones>
            }

            <!-- ETAPA 3: MÓDULO 4 (ÓRDENES DE TRABAJO, MORA, CONTROL DE MASILLA Y TÉCNICOS) -->
            @if (state.activeTab() === 'ordenes') {
              <app-ordenes-trabajo></app-ordenes-trabajo>
            }

            <!-- ETAPA 3: MÓDULO 5 (REPUESTOS EN CUENTAGOTAS, CÓDIGO DE SERIE Y FOTO CON OBSERVACIÓN) -->
            @if (state.activeTab() === 'repuestos') {
              <app-repuestos></app-repuestos>
            }

            <!-- ETAPA 3: MÓDULO 6 (ALMACÉN DE INSUMOS RECURRENTES Y COMPRA DIRECTA A COLORISTA) -->
            @if (state.activeTab() === 'almacen') {
              <app-almacen></app-almacen>
            }

            <!-- ETAPA 4: MÓDULO 7 (DIRECTORIO DE PERSONAL Y CONTROL FÍSICO DE HERRAMIENTAS) -->
            @if (state.activeTab() === 'herramientas') {
              <app-herramientas-personal></app-herramientas-personal>
            }

            <!-- ETAPA 4: MÓDULO 8 (COSTEO INTEGRAL, GASTOS FIJOS E INFORME FINAL PDF EXCLUSIVO BOLIVIA) -->
            @if (state.activeTab() === 'reportes') {
              <app-reportes-financieros></app-reportes-financieros>
            }
          </main>
        </div>
      </div>
    }
  `,
})
export class AppComponent {
  state = inject(AppStateService);
  photoModalOpen = signal<boolean>(false);
}
