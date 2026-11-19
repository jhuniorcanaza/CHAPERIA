import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../../core/services/app-state.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      <!-- Glow sutil de fondo -->
      <div class="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-600/15 blur-3xl"></div>
      <div class="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl"></div>

      <div class="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden border border-slate-800/90 bg-slate-900/95 shadow-2xl">
        <!-- Panel Izquierdo: Showcase Visual del Taller -->
        <div class="lg:col-span-7 relative min-h-[280px] lg:min-h-[540px] flex flex-col justify-between p-6 sm:p-9 overflow-hidden bg-slate-950">
          <img
            [src]="state.resolveMediaUrl('/images/taller_hero.webp')"
            alt="Taller Automotriz Iquique"
            class="absolute inset-0 w-full h-full object-cover object-center opacity-75 scale-105"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/35"></div>

          <div class="relative z-10 flex items-center gap-3">
            <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-900/40 border border-blue-400/30">
              <i class="ri-car-washing-line text-xl text-white"></i>
            </div>
            <div>
              <span class="text-base font-black tracking-tight text-white block">Chapería & Pintura Pro</span>
              <span class="text-[11px] font-semibold uppercase tracking-widest text-blue-300">
                Puerto Iquique · Bolivia
              </span>
            </div>
          </div>

          <div class="relative z-10 mt-auto space-y-4">
            <div class="space-y-1.5 max-w-md">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-950/70 border border-slate-700/80 text-[10px] font-bold uppercase tracking-wider text-blue-300 backdrop-blur-sm">
                <i class="ri-map-pin-2-line text-blue-400"></i>
                <span>Taller Automotriz Iquique</span>
              </span>
              <h1 class="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight drop-shadow">
                Gestión Interna de Taller y Unidades
              </h1>
              <p class="text-xs sm:text-sm text-slate-200/90 leading-relaxed drop-shadow-sm">
                Recepción, reparación de carrocería, repuestos y seguimiento entre Chile y Bolivia.
              </p>
            </div>

            <div class="pt-3 flex items-center justify-between text-[11px] text-slate-300/90 border-t border-slate-700/60">
              <span>Sede Operativa Iquique</span>
              <span>Administración Bolivia</span>
            </div>
          </div>
        </div>

        <!-- Panel Derecho: Formulario de Autenticación -->
        <div class="lg:col-span-5 p-6 sm:p-9 flex flex-col justify-center bg-slate-900/95 space-y-6">
          <div class="space-y-1">
            <h2 class="text-xl sm:text-2xl font-extrabold text-white tracking-tight">Iniciar Sesión</h2>
            <p class="text-xs text-slate-400">
              Ingresa con tu correo y contraseña.
            </p>
          </div>

          @if (state.loginNoticeBanner()) {
            <div class="p-3 rounded-xl bg-amber-950/60 border border-amber-500/60 text-xs text-amber-200 flex items-center gap-2">
              <i class="ri-time-line text-amber-400 text-base shrink-0"></i>
              <span>{{ state.loginNoticeBanner() }}</span>
            </div>
          }

          <form (ngSubmit)="submitLogin()" class="space-y-4">
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-slate-300 block">Correo Electrónico</label>
              <div class="relative">
                <i class="ri-mail-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
                <input
                  [(ngModel)]="email"
                  name="email"
                  type="email"
                  required
                  autocomplete="email"
                  placeholder="usuario@empresa.com"
                  class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-slate-300 block">Contraseña</label>
              <div class="relative">
                <i class="ri-lock-password-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
                <input
                  [(ngModel)]="password"
                  name="password"
                  [type]="mostrarPassword() ? 'text' : 'password'"
                  required
                  autocomplete="current-password"
                  placeholder="••••••••"
                  class="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
                <button
                  type="button"
                  (click)="mostrarPassword.set(!mostrarPassword())"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Mostrar u ocultar contraseña"
                >
                  <i [class]="mostrarPassword() ? 'ri-eye-off-line' : 'ri-eye-line'"></i>
                </button>
              </div>
            </div>

            @if (errorMsg()) {
              <div class="p-3 rounded-xl bg-rose-950/60 border border-rose-500/70 text-xs text-rose-200 flex items-center gap-2">
                <i class="ri-error-warning-line text-rose-400 shrink-0"></i>
                <span>{{ errorMsg() }}</span>
              </div>
            }

            <button
              type="submit"
              [disabled]="cargando()"
              class="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-blue-900/30 transition cursor-pointer flex items-center justify-center gap-2"
            >
              @if (cargando()) {
                <i class="ri-loader-4-line animate-spin text-base"></i>
                <span>Verificando credenciales...</span>
              } @else {
                <i class="ri-login-circle-line text-base"></i>
                <span>Ingresar al Sistema</span>
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  state = inject(AppStateService);

  email = '';
  password = '';
  mostrarPassword = signal(false);
  cargando = signal(false);
  errorMsg = signal('');

  submitLogin() {
    this.errorMsg.set('');
    if (!this.email.trim() || !this.password) {
      this.errorMsg.set('Ingresa tu correo y contraseña.');
      return;
    }
    this.cargando.set(true);
    this.state.login(
      this.email.trim(),
      this.password,
      () => {
        this.cargando.set(false);
      },
      (msg) => {
        this.cargando.set(false);
        this.errorMsg.set(msg);
      },
    );
  }
}
