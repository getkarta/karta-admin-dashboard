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

/** POST …/billing/credits */
export interface PostBillingCreditsRequest {
  clientCode: string;
  amount: number;
  sourceRef: string;
  kind: string;
  expiresAt?: string;
  featureCode?: string;
  isBackfill: boolean;
  customTimestamp: string | null;
}

export interface PostBillingCreditsResponse {
  ok: boolean;
  remaining?: number;
  bucketId?: string;
  featureCode?: string;
  alreadyApplied?: boolean;
  ledgerEntryId?: string | null;
  expiresAt?: string | null;
  sourceRef?: string;
  idempotencyKey?: string;
}

export interface VoiceConcurrencyResponse {
  client_id: string;
  maxConcurrentDials: number;
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

  private voiceAdminHeaders(
    token: string,
    requestId: string,
    includeContentType = false
  ): HttpHeaders {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'X-Request-ID': requestId
    };
    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }
    return new HttpHeaders(headers);
  }

  private createVoiceConcurrencyRequestId(action: 'read' | 'update'): string {
    const random = Math.random().toString(36).slice(2, 10);
    return `admin-concurrency-${action}-${Date.now().toString(36)}-${random}`;
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
      enabledAgents: string[];
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

  /** GET …/v1/voice/clients/:clientId/concurrency */
  getClientVoiceConcurrency(
    clientId: string,
    accessToken: string
  ): Promise<VoiceConcurrencyResponse> {
    const enc = encodeURIComponent(clientId);
    return firstValueFrom(
      this.http.get<VoiceConcurrencyResponse>(
        `${this.apiBase}/v1/voice/clients/${enc}/concurrency`,
        {
          headers: this.voiceAdminHeaders(
            accessToken,
            this.createVoiceConcurrencyRequestId('read')
          )
        }
      )
    );
  }

  /** PUT …/v1/voice/clients/:clientId/concurrency */
  putClientVoiceConcurrency(
    clientId: string,
    maxConcurrentDials: number,
    accessToken: string
  ): Promise<VoiceConcurrencyResponse> {
    const enc = encodeURIComponent(clientId);
    return firstValueFrom(
      this.http.put<VoiceConcurrencyResponse>(
        `${this.apiBase}/v1/voice/clients/${enc}/concurrency`,
        { maxConcurrentDials },
        {
          headers: this.voiceAdminHeaders(
            accessToken,
            this.createVoiceConcurrencyRequestId('update'),
            true
          )
        }
      )
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

  /** POST …/billing/credits — add credits to a client bucket */
  postBillingCredits(
    body: PostBillingCreditsRequest,
    accessToken: string
  ): Promise<PostBillingCreditsResponse> {
    return firstValueFrom(
      this.http.post<PostBillingCreditsResponse>(
        `${this.apiBase}/billing/credits`,
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
