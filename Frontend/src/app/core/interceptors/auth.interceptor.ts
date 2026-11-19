import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const AUTH_TOKEN_STORAGE_KEY = 'chaperia_token';
export const AUTH_USER_STORAGE_KEY = 'chaperia_user';
export const UNAUTHORIZED_SESSION_EVENT = 'chaperia:unauthorized';

function readStoredToken(): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isApiRequest = req.url.startsWith('/api') || req.url.includes('/api/');
  const isLoginRequest = req.url.includes('/auth/login');
  const token = readStoredToken();

  const authReq =
    isApiRequest && token && !isLoginRequest
      ? req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        })
      : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isApiRequest &&
        !isLoginRequest &&
        typeof window !== 'undefined'
      ) {
        try {
          window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
          window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
        } catch {
          // noop
        }
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_SESSION_EVENT));
      }
      return throwError(() => error);
    }),
  );
};
