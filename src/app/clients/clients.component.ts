import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { ApiService } from '../services/api.service';

export interface BillingInfo {
  tier?: string;
  allowNegativeBalance?: boolean;
  customPricing?: Record<string, Record<string, { creditPerUnit: number; unit?: string; rounding?: string; intervalSeconds?: number; minimumSeconds?: number }>>;
  /** e.g. `{ prompt_builder: true }` — whether base credits apply for that product surface */
  baseCreditUsage?: Record<string, boolean>;
}

export interface ClientRow {
  clientName: string;
  clientCode: string;
  enabledAgents: string[];
  status: 'Active' | 'Draft' | 'Archived';
  owner: string;
  createdOn: string;
  billing?: BillingInfo;
  /** Carried from API for PUT /clients/:code (e.g. unarchive). */
  dataResidency?: string;
  voiceConcurrency?: number;
  /** Optional; from list API when provided. */
  userCount?: number;
}

@Component({
  selector: 'app-clients',
  standalone: false,
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss'
})
export class ClientsComponent implements OnInit {
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
  /**
   * Client list: GET {apiBase}/clients?includeArchived=true
   * (see also GET …/clients and GET …/clients?archivedOnly=true).
   */
  private readonly locallyArchivedClients = new Map<string, ClientRow>();
  private static readonly ARCHIVED_STORAGE_KEY = 'kartaAdminArchivedClientRows';
  /** Shown in the action banner after redirect from create when client code is missing from POST response. */
  private pendingListRouteFlash = '';
  constructor(
    private api: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    const nav = this.router.getCurrentNavigation();
    const flash = nav?.extras?.state?.['listFlashMessage'];
    if (typeof flash === 'string' && flash.trim()) {
      this.pendingListRouteFlash = flash.trim();
    }
  }

  ngOnInit(): void {
    this.hydrateLocallyArchivedFromStorage();
    void this.loadClients();
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

  /** Clickable client name for non-archived rows (opens Update Client). */
  showClientNameLink(client: ClientRow): boolean {
    return client.status !== 'Archived';
  }

  userCountFor(client: ClientRow): number {
    const n = client.userCount;
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) {
      return Math.floor(n);
    }
    return 0;
  }

  /** Full-page User information (directory-style list + add user). */
  goToClientUsers(client: ClientRow): void {
    void this.router.navigate(['/clients', client.clientCode, 'users'], {
      state: { clientName: client.clientName }
    });
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

  /** Full Update Client page (same as row **View** and client name). */
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

    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).catch(() => {
        this.fallbackCopyTextToClipboard(text);
      });
      return;
    }
    this.fallbackCopyTextToClipboard(text);
  }

  private fallbackCopyTextToClipboard(text: string): void {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
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

    try {
      const body = await this.api.putClientArchiveState(
        client.clientCode,
        false,
        accessToken
      );
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

    try {
      const archiveBody = await this.api.putClientArchiveState(
        client.clientCode,
        true,
        accessToken
      );
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
      const response = await this.api.getClientsList(accessToken);

      const rows = this.extractClientRows(response);
      this.clients = this.mergeApiRowsWithLocallyArchived(rows);
      this.clampPageIndex();
      await this.hydrateUserCountsFromApi();
      if (this.pendingListRouteFlash) {
        this.actionMessage = this.pendingListRouteFlash;
        this.pendingListRouteFlash = '';
      } else {
        this.actionMessage = this.clients.length
          ? 'Clients loaded successfully.'
          : 'No clients found yet. Add Client flow will be the next page we create.';
      }
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
      billing: client?.billing ?? client?.bi,
      dataResidency: this.extractDataResidency(client),
      voiceConcurrency: this.extractVoiceConcurrency(client),
      userCount: this.extractUserCount(client)
    }));
  }

  private extractDataResidency(client: any): string | undefined {
    const dr = client?.dataResidency ?? client?.data_residency;
    return typeof dr === 'string' && dr.trim() ? dr.trim() : undefined;
  }

  private extractUserCount(client: any): number | undefined {
    const direct =
      client?.userCount ??
      client?.usersCount ??
      client?.user_count ??
      client?.memberCount ??
      client?.membersCount ??
      client?.numUsers;
    const n = typeof direct === 'number' ? direct : Number(direct);
    if (Number.isFinite(n) && n >= 0) {
      return Math.floor(n);
    }
    const users = client?.users;
    if (Array.isArray(users)) {
      return users.length;
    }
    return undefined;
  }

  /**
   * List clients often omits user counts — fetch `GET …/clients/:code/users` per client
   * (batched) so the Users column shows real totals.
   */
  private async hydrateUserCountsFromApi(): Promise<void> {
    const token = localStorage.getItem('accessToken');
    if (!token || !this.clients.length) {
      return;
    }

    const codes = [
      ...new Set(
        this.clients
          .map((c) => (c.clientCode || '').trim())
          .filter((c) => c && c !== 'N/A')
      )
    ];
    if (!codes.length) {
      return;
    }

    const counts = new Map<string, number>();
    const batchSize = 8;

    for (let i = 0; i < codes.length; i += batchSize) {
      const slice = codes.slice(i, i + batchSize);
      await Promise.all(
        slice.map(async (code) => {
          try {
            const res = await this.api.getClientUsers(code, token);
            counts.set(code, Array.isArray(res.users) ? res.users.length : 0);
          } catch {
            // keep list-derived count if any; otherwise unchanged
          }
        })
      );
    }

    if (!counts.size) {
      return;
    }

    this.clients = this.clients.map((row) => {
      const code = (row.clientCode || '').trim();
      if (code && counts.has(code)) {
        return { ...row, userCount: counts.get(code)! };
      }
      return row;
    });
  }

  private extractVoiceConcurrency(client: any): number | undefined {
    const v = client?.voiceConcurrency ?? client?.voice_concurrency;
    const n = Number(v);
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 1) {
      return n;
    }
    return undefined;
  }

  private normalizeStatus(client: any): 'Active' | 'Draft' | 'Archived' {
    const rawStatus = (client?.status || '').toString().toLowerCase();
    const archiveStatus = (client?.archiveStatus || client?.lifecycle || '')
      .toString()
      .toLowerCase();

    const explicitlyUnarchived =
      client?.archived === false || client?.isArchived === false;

    const isArchived =
      rawStatus === 'archived' ||
      rawStatus === 'inactive' ||
      archiveStatus === 'archived' ||
      client?.archived === true ||
      client?.isArchived === true ||
      client?.deletedAt != null ||
      /* Keep historical archivedAt only when API does not say “not archived”. */
      (client?.archivedAt != null && !explicitlyUnarchived);

    if (isArchived) {
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
