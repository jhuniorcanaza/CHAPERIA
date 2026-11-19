import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../../core/services/app-state.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Mobile Backdrop Drawer Overlay -->
    @if (state.sidebarMobileOpen()) {
      <div
        class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity duration-300"
        (click)="state.sidebarMobileOpen.set(false)"
      ></div>
    }

    <!-- Sidebar Container (Drawer on mobile, Sticky sidebar on desktop) -->
    <aside
      class="no-print fixed lg:sticky top-0 left-0 z-50 lg:z-30 h-screen w-72 bg-slate-950/95 lg:bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between shrink-0 transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none backdrop-blur-xl"
      [class.translate-x-0]="state.sidebarMobileOpen()"
      [class.-translate-x-full]="!state.sidebarMobileOpen()"
      [class.lg:translate-x-0]="true"
    >
      <!-- Top Section: Brand & Nav Links -->
      <div class="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        <!-- Brand Header -->
        <div class="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-sky-400 p-0.5 shadow-lg shadow-blue-500/25 flex items-center justify-center">
              <div class="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-blue-400">
                <i class="ri-roadster-fill text-xl"></i>
              </div>
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="font-extrabold text-sm tracking-tight text-white font-display">CHAPERÍA</span>
                <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-gradient-to-r from-blue-600 to-indigo-600 text-white uppercase tracking-wider">PRO</span>
              </div>
              <span class="text-[11px] text-slate-400 font-medium block">Taller Chile · Gestión Bolivia</span>
            </div>
          </div>

          <!-- Close drawer on mobile -->
          <button
            type="button"
            (click)="state.sidebarMobileOpen.set(false)"
            class="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <i class="ri-close-line text-lg"></i>
          </button>
        </div>

        <!-- Active User Profile Card -->
        <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/90 shadow-sm space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>En Línea</span>
            </span>
            <span
              class="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider border"
              [ngClass]="state.currentUser()?.pais === 'CHILE'
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'"
            >
              {{ state.currentUser()?.pais }}
            </span>
          </div>

          <div>
            <div class="font-bold text-xs text-white truncate">{{ state.currentUser()?.nombreCompleto }}</div>
            <div class="text-[11px] font-medium mt-0.5">
              @if (state.puedeVerReportes()) {
                <span class="text-emerald-400 flex items-center gap-1">
                  <i class="ri-shield-check-line text-xs"></i>
                  <span>Acceso Total + Reportes</span>
                </span>
              } @else {
                <span class="text-amber-400 flex items-center gap-1">
                  <i class="ri-tools-line text-xs"></i>
                  <span>Operaciones Taller Chile</span>
                </span>
              }
            </div>
          </div>
        </div>

        <!-- Module Navigation Links -->
        <div class="space-y-1.5">
          <div class="px-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Áreas de Gestión
          </div>

          @for (item of state.visibleMenuModules(); track item.id) {
            <button
              type="button"
              (click)="state.selectModuleTab(item.id)"
              class="w-full text-left p-2.5 rounded-xl flex items-center gap-3 transition-all duration-200 cursor-pointer group text-xs"
              [class]="state.activeTab() === item.id
                ? 'bg-gradient-to-r from-blue-600/90 via-blue-600/70 to-indigo-600/80 text-white shadow-lg shadow-blue-600/20 border-l-4 border-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/80'"
            >
              <div
                class="w-8 h-8 rounded-lg flex items-center justify-center transition shrink-0"
                [class]="state.activeTab() === item.id
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-blue-400 group-hover:border-slate-700'"
              >
                <i [class]="item.icono + ' text-base'"></i>
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-xs truncate" [class.text-white]="state.activeTab() === item.id">
                    {{ item.titulo }}
                  </span>
                </div>
                <div
                  class="text-[10px] truncate"
                  [class.text-blue-100]="state.activeTab() === item.id"
                  [class.text-slate-500]="state.activeTab() !== item.id"
                >
                  {{ item.subtitulo }}
                </div>
              </div>
            </button>
          }
        </div>
      </div>

      <!-- Bottom Section: Logout -->
      <div class="p-4 border-t border-slate-800/80 space-y-3 bg-slate-950/80">
        <button
          type="button"
          (click)="state.logout()"
          class="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/70 border border-slate-800 hover:border-rose-500/50 text-slate-400 hover:text-rose-300 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          <i class="ri-logout-box-r-line"></i>
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  state = inject(AppStateService);
}
