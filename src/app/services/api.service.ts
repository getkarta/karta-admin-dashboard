import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../config/environment';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly apiBase = environment.apiUrl.replace(/\/$/, '');

  constructor(private http: HttpClient) {}

  verifyToken(): Promise<{ user?: unknown }> {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      return Promise.resolve({});
    }
    return firstValueFrom(
      this.http.get<{ user?: unknown }>(`${this.apiBase}/user`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    ).catch(() => ({}));
  }

  getAgentID(): string {
    try {
      const raw = localStorage.getItem('ativeAgent');
      const data = raw ? JSON.parse(raw) : null;
      return data?.agentCode ?? data?.id ?? '';
    } catch {
      return '';
    }
  }

  getKartaAgents(): Promise<unknown> {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      return Promise.resolve([]);
    }
    return firstValueFrom(
      this.http.get<unknown>(`${this.apiBase}/agents`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    ).catch(() => []);
  }
}
