import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_URL } from './api.config';
import { AuthService } from './auth.service';

// Endpoints que no deben disparar la renovación automática del token
const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

function withAuth(req: HttpRequest<unknown>, token: string | null) {
  return req.clone({
    // La cookie httpOnly de refresh viaja con las peticiones a la API
    withCredentials: true,
    setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_URL)) return next(req);

  const auth = inject(AuthService);

  return next(withAuth(req, auth.token())).pipe(
    catchError((err: HttpErrorResponse) => {
      const skip = NO_REFRESH.some((path) => req.url.includes(path));
      if (err.status !== 401 || skip) return throwError(() => err);

      // Access token caducado: se renueva una vez y se repite la petición original
      return auth.refresh().pipe(
        catchError((refreshErr) => {
          auth.logout();
          return throwError(() => refreshErr);
        }),
        switchMap((token) => next(withAuth(req, token))),
      );
    }),
  );
};
