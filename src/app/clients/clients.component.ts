import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../config/environment';

export interface BillingInfo {
  tier?: string;
  allowNegativeBalance?: boolean;
  customPricing?: Record<string, Record<string, { creditPerUnit: number; unit?: string; rounding?: string; intervalSeconds?: number; minimumSeconds?: number }>>;
}

export interface ClientRow {
  clientName: string;
  clientCode: string;
  enabledAgents: string[];
  status: 'Active' | 'Draft' | 'Archived';
  owner: string;
  createdOn: string;
  billing?: BillingInfo;
}

@Component({
  selector: 'app-clients',
  standalone: false,
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss'
})
export class ClientsComponent implements OnInit, OnDestroy {
  clients: ClientRow[] = [];

  selectedTab: 'all' | 'active' | 'archived' = 'active';
  /** Filters the current tab’s rows by name, code, agents, status. */
  searchQuery = '';
  actionMessage = 'Loading clients from the backend.';
  isLoading = false;
  loadError = '';
  pageIndex = 0;
  pageSize = 10;
  readonly pageSizeOptions: number[] = [5, 10, 25, 50];
  private readonly apiBase = environment.apiUrl.replace(/\/$/, '');
  /** GET /clients often omits archived rows; we keep them here so the Archived tab still works. */
  private readonly locallyArchivedClients = new Map<string, ClientRow>();
  private static readonly ARCHIVED_STORAGE_KEY = 'kartaAdminArchivedClientRows';
  /** Brief “Copied” hint next to the client code that was copied */
  copiedClientCode: string | null = null;
  private copyFeedbackClearId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.hydrateLocallyArchivedFromStorage();
    void this.loadClients();
  }

  ngOnDestroy(): void {
    if (this.copyFeedbackClearId != null) {
      clearTimeout(this.copyFeedbackClearId);
    }
  }

  get totalClients(): number {
    return this.clients.length;
  }

  get activeClients(): number {
    return this.clients.filter((client) => client.status === 'Active').length;
  }

  get archivedClients(): number {
    return this.clients.filter((client) => client.status === 'Archived').length;
  }

  /** Rows after tab filter only (ignores search). */
  private clientsForCurrentTab(): ClientRow[] {
    if (this.selectedTab === 'all') {
      return this.clients;
    }
    return this.clients.filter(
      (client) => client.status.toLowerCase() === this.selectedTab
    );
  }

  /** Rows after tab + search filter (used by the table and pagination). */
  get visibleClients(): ClientRow[] {
    const byTab = this.clientsForCurrentTab();
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      return byTab;
    }
    return byTab.filter((client) => this.clientMatchesSearch(client, q));
  }

  get emptyDirectoryHint(): string {
    if (this.clientsForCurrentTab().length === 0) {
      return 'No clients available for the selected filter.';
    }
    if (this.visibleClients.length === 0) {
      return 'No clients match your search.';
    }
    return '';
  }

  get pagedClients(): ClientRow[] {
    const list = this.visibleClients;
    const start = this.pageIndex * this.pageSize;
    return list.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    const n = this.visibleClients.length;
    return Math.max(1, Math.ceil(n / this.pageSize));
  }

  get pageRangeStart(): number {
    if (!this.visibleClients.length) {
      return 0;
    }
    return this.pageIndex * this.pageSize + 1;
  }

  get pageRangeEnd(): number {
    return Math.min((this.pageIndex + 1) * this.pageSize, this.visibleClients.length);
  }

  setTab(tab: 'all' | 'active' | 'archived'): void {
    this.selectedTab = tab;
    this.pageIndex = 0;
  }

  onSearchQueryChange(): void {
    this.pageIndex = 0;
  }

  private clientMatchesSearch(client: ClientRow, q: string): boolean {
    const haystack = [
      client.clientName,
      client.clientCode,
      client.status,
      ...client.enabledAgents
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  }

  onPageSizeChange(size: number): void {
    this.pageSize = Number(size);
    this.pageIndex = 0;
  }

  prevPage(): void {
    this.pageIndex = Math.max(0, this.pageIndex - 1);
  }

  nextPage(): void {
    this.pageIndex = Math.min(this.totalPages - 1, this.pageIndex + 1);
  }

  private clampPageIndex(): void {
    const maxIdx = Math.max(0, this.totalPages - 1);
    if (this.pageIndex > maxIdx) {
      this.pageIndex = maxIdx;
    }
  }

  addClient(): void {
    void this.router.navigate(['/clients/new']);
  }

  editClient(client: ClientRow): void {
    void this.router.navigate(
      ['/clients', client.clientCode, 'edit'],
      { state: { client } }
    );
  }

  copyClientCode(code: string): void {
    const text = (code || '').trim();
    if (!text) {
      return;
    }

    const done = (): void => {
      this.copiedClientCode = text;
      this.cdr.markForCheck();
      if (this.copyFeedbackClearId != null) {
        clearTimeout(this.copyFeedbackClearId);
      }
      this.copyFeedbackClearId = setTimeout(() => {
        this.copiedClientCode = null;
        this.copyFeedbackClearId = null;
        this.cdr.markForCheck();
      }, 2000);
    };

    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).then(done).catch(() => {
        this.fallbackCopyTextToClipboard(text, done);
      });
      return;
    }
    this.fallbackCopyTextToClipboard(text, done);
  }

  private fallbackCopyTextToClipboard(text: string, onDone: () => void): void {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      onDone();
    } catch {
      this.actionMessage = 'Could not copy client code.';
    }
    document.body.removeChild(ta);
  }

  async unarchiveClient(client: ClientRow): Promise<void> {
    const confirmed = window.confirm(
      `Restore ${client.clientName} to the active client list?`
    );
    if (!confirmed) {
      return;
    }

    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      this.loadError = 'Session expired. Please log in again.';
      this.actionMessage = this.loadError;
      return;
    }

    const headers = new HttpHeaders({ Authorization: `Bearer ${accessToken}` });
    const url = `${this.apiBase}/clients/${encodeURIComponent(client.clientCode)}`;

    try {
      const body = await this.unarchiveClientRequest(url, headers, client);
      this.loadError = '';
      this.actionMessage =
        body?.message?.trim() ||
        `${client.clientName} restored successfully.`;
      this.locallyArchivedClients.delete(client.clientCode);
      this.persistLocallyArchivedToStorage();
      await this.loadClients();
    } catch (error) {
      console.error('Failed to unarchive client', error);
      this.loadError = '';
      this.actionMessage = this.describeUnarchiveError(error);
    }
  }

  /**
   * Backend restore/update requires at least one of: clientName, enabledAgents, voiceConcurrency.
   */
  private restoreClientPayload(client: ClientRow): Record<string, unknown> {
    const agents =
      client.enabledAgents?.length > 0
        ? [...client.enabledAgents]
        : ['chat'];
    return {
      archived: false,
      clientName: client.clientName,
      enabledAgents: agents
    };
  }

  private async unarchiveClientRequest(
    url: string,
    headers: HttpHeaders,
    client: ClientRow
  ): Promise<{ message?: string } | null> {
    type Msg = { message?: string } | null;
    const p = this.restoreClientPayload(client);
    const code = client.clientCode;

    const patch = (body: Record<string, unknown>): Promise<Msg> =>
      firstValueFrom(
        this.http.patch<Msg>(url, body, { headers, observe: 'response' })
      ).then((r) => r.body);

    const put = (body: Record<string, unknown>): Promise<Msg> =>
      firstValueFrom(
        this.http.put<Msg>(url, body, { headers, observe: 'response' })
      ).then((r) => r.body);

    const postSuffix = (path: string, body: unknown): Promise<Msg> =>
      firstValueFrom(
        this.http.post<Msg>(`${url}${path}`, body, {
          headers,
          observe: 'response'
        })
      ).then((r) => r.body);

    const postCollection = (
      path: string,
      body: Record<string, unknown>
    ): Promise<Msg> =>
      firstValueFrom(
        this.http.post<Msg>(`${this.apiBase}/clients${path}`, body, {
          headers,
          observe: 'response'
        })
      ).then((r) => r.body);

    /* Archived rows often 404 on PATCH /clients/:code — restore is usually a collection POST. */
    const bodyWithCode: Record<string, unknown> = {
      clientCode: code,
      ...p,
      status: 'Active'
    };

    const attempts: Array<() => Promise<Msg>> = [
      () => postCollection('/reactivate', bodyWithCode),
      () => postCollection('/unarchive', bodyWithCode),
      () => postCollection('/restore', bodyWithCode),
      () => postSuffix('/unarchive', bodyWithCode),
      () => postSuffix('/restore', bodyWithCode),
      () => patch({ ...p, status: 'Active' }),
      () => patch({ ...p, status: 'active' }),
      () => patch(p),
      () => put(bodyWithCode),
      () => put(p)
    ];

    let lastErr: unknown;
    for (const run of attempts) {
      try {
        return await run();
      } catch (e) {
        lastErr = e;
        const st = (e as HttpErrorResponse).status;
        if (st === 404 || st === 405 || st === 501) {
          continue;
        }
        throw e;
      }
    }
    throw lastErr;
  }

  private describeUnarchiveError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error;
      const fromApi =
        body &&
        typeof body === 'object' &&
        'message' in body &&
        typeof (body as { message: unknown }).message === 'string'
          ? (body as { message: string }).message
          : null;
      const detail = fromApi || error.statusText || 'Unknown error';
      return `Unable to restore client (${error.status}): ${detail}`;
    }
    return 'Unable to restore client right now.';
  }

  async archiveClient(client: ClientRow): Promise<void> {
    const confirmed = window.confirm(
      `Are you sure you want to archive ${client.clientName}?`
    );

    if (!confirmed) {
      return;
    }

    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      this.loadError = 'Session expired. Please log in again.';
      this.actionMessage = this.loadError;
      return;
    }

    const headers = new HttpHeaders({ Authorization: `Bearer ${accessToken}` });
    const url = `${this.apiBase}/clients/${encodeURIComponent(client.clientCode)}`;

    try {
      const archiveBody = await this.archiveClientRequest(url, headers);
      this.loadError = '';
      this.actionMessage =
        archiveBody?.message?.trim() ||
        `${client.clientName} archived successfully.`;
      this.locallyArchivedClients.set(client.clientCode, {
        ...client,
        status: 'Archived'
      });
      this.persistLocallyArchivedToStorage();
      await this.loadClients();
    } catch (error) {
      console.error('Failed to archive client', error);
      this.loadError = '';
      this.actionMessage = this.describeArchiveError(error);
    }
  }

  /**
   * Backend may use DELETE (hard/soft remove) or PATCH (soft archive).
   * Adjust here if your API uses e.g. POST …/archive only.
   */
  private async archiveClientRequest(
    url: string,
    headers: HttpHeaders
  ): Promise<{ message?: string } | null> {
    try {
      const res = await firstValueFrom(
        this.http.delete<{ message?: string }>(url, {
          headers,
          observe: 'response'
        })
      );
      return res.body;
    } catch (first) {
      const err = first as HttpErrorResponse;
      if (err.status === 405 || err.status === 501) {
        const res = await firstValueFrom(
          this.http.patch<{ message?: string }>(url, { archived: true }, {
            headers,
            observe: 'response'
          })
        );
        return res.body;
      }
      throw first;
    }
  }

  private describeArchiveError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error;
      const fromApi =
        body &&
        typeof body === 'object' &&
        'message' in body &&
        typeof (body as { message: unknown }).message === 'string'
          ? (body as { message: string }).message
          : null;
      const detail = fromApi || error.statusText || 'Unknown error';
      return `Unable to archive client (${error.status}): ${detail}`;
    }
    return 'Unable to archive client right now.';
  }

  async loadClients(): Promise<void> {
    const accessToken = localStorage.getItem('accessToken');

    if (!accessToken) {
      this.loadError = 'Session expired. Please log in again.';
      this.actionMessage = this.loadError;
      return;
    }

    this.isLoading = true;
    this.loadError = '';

    try {
      const response = await firstValueFrom(
        this.http.get<any>(`${this.apiBase}/clients`, {
          headers: new HttpHeaders({
            Authorization: `Bearer ${accessToken}`
          })
        })
      );

      const rows = this.extractClientRows(response);
      this.clients = this.mergeApiRowsWithLocallyArchived(rows);
      this.clampPageIndex();
      this.actionMessage = this.clients.length
        ? 'Clients loaded successfully from GET /admin/clients.'
        : 'No clients found yet. Add Client flow will be the next page we create.';
    } catch (error) {
      console.error('Failed to load clients', error);
      this.clients = [];
      this.pageIndex = 0;
      this.loadError = 'Unable to load client list right now.';
      this.actionMessage = '';
    } finally {
      this.isLoading = false;
    }
  }

  logout(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    void this.router.navigate(['/login']);
  }

  private hydrateLocallyArchivedFromStorage(): void {
    try {
      const raw = sessionStorage.getItem(
        ClientsComponent.ARCHIVED_STORAGE_KEY
      );
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return;
      }
      this.locallyArchivedClients.clear();
      for (const item of parsed) {
        const row = item as ClientRow;
        if (row?.clientCode) {
          this.locallyArchivedClients.set(row.clientCode, {
            ...row,
            status: 'Archived'
          });
        }
      }
    } catch {
      // ignore corrupt storage
    }
  }

  private persistLocallyArchivedToStorage(): void {
    try {
      sessionStorage.setItem(
        ClientsComponent.ARCHIVED_STORAGE_KEY,
        JSON.stringify([...this.locallyArchivedClients.values()])
      );
    } catch {
      // quota / private mode
    }
  }

  /**
   * API list is usually “active only”. Re-inject archived rows we know about, and
   * drop local copies once the API lists them as Archived.
   */
  private mergeApiRowsWithLocallyArchived(fromApi: ClientRow[]): ClientRow[] {
    const uniqueFromApi = this.dedupeClientRowsByCode(fromApi);

    for (const row of uniqueFromApi) {
      if (
        row.status === 'Archived' &&
        this.locallyArchivedClients.has(row.clientCode)
      ) {
        this.locallyArchivedClients.delete(row.clientCode);
      }
    }
    this.persistLocallyArchivedToStorage();

    const merged = uniqueFromApi.map((r) =>
      this.locallyArchivedClients.has(r.clientCode)
        ? { ...r, status: 'Archived' as const }
        : { ...r }
    );
    const codes = new Set(merged.map((r) => r.clientCode));
    for (const [code, snapshot] of this.locallyArchivedClients) {
      if (!codes.has(code)) {
        merged.push({ ...snapshot, status: 'Archived' });
      }
    }
    return merged;
  }

  private dedupeClientRowsByCode(rows: ClientRow[]): ClientRow[] {
    const map = new Map<string, ClientRow>();
    for (const r of rows) {
      if (!r?.clientCode) {
        continue;
      }
      const existing = map.get(r.clientCode);
      if (!existing) {
        map.set(r.clientCode, r);
        continue;
      }
      const prefer =
        r.status === 'Archived' || existing.status !== 'Archived' ? r : existing;
      map.set(r.clientCode, prefer);
    }
    return [...map.values()];
  }

  private extractClientRows(response: any): ClientRow[] {
    const list = Array.isArray(response)
      ? response
      : Array.isArray(response?.clients)
        ? response.clients
        : Array.isArray(response?.data)
          ? response.data
          : [];

    return list.map((client: any) => ({
      clientName: client?.clientName || client?.name || 'Unnamed Client',
      clientCode: client?.clientCode || 'N/A',
      enabledAgents: Array.isArray(client?.enabledAgents) ? client.enabledAgents : [],
      status: this.normalizeStatus(client),
      owner: client?.owner || client?.createdBy || client?.email || 'Admin',
      createdOn: this.formatDate(client?.createdAt || client?.updatedAt),
      billing: client?.billing ?? client?.bi
    }));
  }

  private normalizeStatus(client: any): 'Active' | 'Draft' | 'Archived' {
    const rawStatus = (client?.status || '').toString().toLowerCase();
    const archiveStatus = (client?.archiveStatus || client?.lifecycle || '')
      .toString()
      .toLowerCase();

    if (
      rawStatus === 'archived' ||
      rawStatus === 'inactive' ||
      archiveStatus === 'archived' ||
      client?.archived === true ||
      client?.isArchived === true ||
      client?.deletedAt != null ||
      client?.archivedAt != null
    ) {
      return 'Archived';
    }

    if (rawStatus === 'draft' || client?.enabledAgents?.length === 0) {
      return 'Draft';
    }

    return 'Active';
  }

  private formatDate(value: string | undefined): string {
    if (!value) {
      return 'N/A';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }
}
