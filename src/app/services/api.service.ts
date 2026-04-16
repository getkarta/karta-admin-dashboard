import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../../config/environment';
import { firstValueFrom } from 'rxjs';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface CurrentUserResponse {
  user: {
    email: string;
    role: string;
  };
}

export interface ClientUsersApiResponse {
  users?: Array<{
    email?: string;
    role?: string;
    createdAt?: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly apiBase = environment.apiUrl.replace(/\/$/, '');

  constructor(private http: HttpClient) {}

  private bearerHeaders(token: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private jsonAuthHeaders(token: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  postLogin(email: string, password: string): Promise<LoginResponse> {
    return firstValueFrom(
      this.http.post<LoginResponse>(`${this.apiBase}/user/login`, {
        email,
        password
      })
    );
  }

  getAuthenticatedUser(accessToken: string): Promise<CurrentUserResponse> {
    return firstValueFrom(
      this.http.get<CurrentUserResponse>(`${this.apiBase}/user`, {
        headers: this.bearerHeaders(accessToken)
      })
    );
  }

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

  /** GET …/clients?includeArchived=true */
  getClientsList(accessToken: string): Promise<unknown> {
    const params = new HttpParams().set('includeArchived', 'true');
    return firstValueFrom(
      this.http.get<unknown>(`${this.apiBase}/clients`, {
        headers: this.bearerHeaders(accessToken),
        params
      })
    );
  }

  /** PUT …/clients/:code — archive / unarchive */
  putClientArchiveState(
    clientCode: string,
    isArchived: boolean,
    accessToken: string
  ): Promise<{ message?: string; client?: unknown } | null> {
    const url = `${this.apiBase}/clients/${encodeURIComponent(clientCode)}`;
    return firstValueFrom(
      this.http.put<{ message?: string; client?: unknown }>(
        url,
        { isArchived },
        {
          headers: this.jsonAuthHeaders(accessToken),
          observe: 'response'
        }
      )
    ).then((res) => res.body);
  }

  /** GET …/clients/:code/users */
  getClientUsers(
    clientCode: string,
    accessToken: string
  ): Promise<ClientUsersApiResponse> {
    const enc = encodeURIComponent(clientCode);
    return firstValueFrom(
      this.http.get<ClientUsersApiResponse>(`${this.apiBase}/clients/${enc}/users`, {
        headers: this.bearerHeaders(accessToken)
      })
    );
  }

  /** POST …/users */
  createUser(
    payload: { email: string; password: string; clientCode: string },
    accessToken: string
  ): Promise<unknown> {
    return firstValueFrom(
      this.http.post<unknown>(`${this.apiBase}/users`, payload, {
        headers: this.jsonAuthHeaders(accessToken)
      })
    );
  }

  /** GET …/clients/:code (single client) */
  getClientByCode(clientCode: string, accessToken: string): Promise<unknown> {
    const enc = encodeURIComponent(clientCode);
    return firstValueFrom(
      this.http.get<unknown>(`${this.apiBase}/clients/${enc}`, {
        headers: this.bearerHeaders(accessToken)
      })
    );
  }

  /** POST …/clients (create) */
  createClient(
    body: {
      clientName: string;
      dataResidency: string;
      voiceConcurrency: number;
    },
    accessToken: string
  ): Promise<unknown> {
    return firstValueFrom(
      this.http.post<unknown>(`${this.apiBase}/clients`, body, {
        headers: this.jsonAuthHeaders(accessToken)
      })
    );
  }

  /** PUT …/clients/:code (update client fields) */
  updateClient(
    clientCode: string,
    body: {
      clientName: string;
      enabledAgents: string[];
      dataResidency: string;
      voiceConcurrency: number;
    },
    accessToken: string
  ): Promise<unknown> {
    const enc = encodeURIComponent(clientCode);
    return firstValueFrom(
      this.http.put<unknown>(`${this.apiBase}/clients/${enc}`, body, {
        headers: this.jsonAuthHeaders(accessToken)
      })
    );
  }

  /** PUT …/billing/billing */
  putBillingBilling(
    body: Record<string, unknown>,
    accessToken: string
  ): Promise<{ message?: string; billing?: Record<string, unknown> }> {
    return firstValueFrom(
      this.http.put<{ message?: string; billing?: Record<string, unknown> }>(
        `${this.apiBase}/billing/billing`,
        body,
        { headers: this.jsonAuthHeaders(accessToken) }
      )
    );
  }

  /** GET …/clients/settings-meta */
  getClientSettingsMeta(accessToken: string): Promise<unknown> {
    return firstValueFrom(
      this.http.get<unknown>(`${this.apiBase}/clients/settings-meta`, {
        headers: this.bearerHeaders(accessToken)
      })
    );
  }
}
