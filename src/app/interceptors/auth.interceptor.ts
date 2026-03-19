import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpErrorResponse
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export class AuthInterceptor implements HttpInterceptor {
  private router = inject(Router);

  intercept(req: HttpRequest<unknown>, next: HttpHandler) {
    const token = localStorage.getItem('accessToken');
    const cloned = token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;
    return next.handle(cloned).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          void this.router.navigate(['/login']);
        }
        return throwError(() => err);
      })
    );
  }
}
