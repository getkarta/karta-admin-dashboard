import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
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
export class ClientsComponent implements OnInit {
  clients: ClientRow[] = [];

  selectedTab: 'all' | 'active' | 'draft' | 'archived' = 'all';
  actionMessage = 'Loading clients from the backend.';
  isLoading = false;
  loadError = '';
  private readonly apiBase = environment.apiUrl.replace(/\/$/, '');

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    void this.loadClients();
  }

  get totalClients(): number {
    return this.clients.length;
  }

  get activeClients(): number {
    return this.clients.filter((client) => client.status === 'Active').length;
  }

  get draftClients(): number {
    return this.clients.filter((client) => client.status === 'Draft').length;
  }

  get archivedClients(): number {
    return this.clients.filter((client) => client.status === 'Archived').length;
  }

  get visibleClients(): ClientRow[] {
    if (this.selectedTab === 'all') {
      return this.clients;
    }

    return this.clients.filter(
      (client) => client.status.toLowerCase() === this.selectedTab
    );
  }

  setTab(tab: 'all' | 'active' | 'draft' | 'archived'): void {
    this.selectedTab = tab;
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
      await firstValueFrom(
        this.http.delete(`${this.apiBase}/clients/${client.clientCode}`, {
          headers: new HttpHeaders({
            Authorization: `Bearer ${accessToken}`
          })
        })
      );

      this.actionMessage = `${client.clientName} archived successfully.`;
      await this.loadClients();
    } catch (error) {
      console.error('Failed to archive client', error);
      this.loadError = 'Unable to archive client right now.';
      this.actionMessage = this.loadError;
    }
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
      this.clients = rows;
      this.actionMessage = rows.length
        ? 'Clients loaded successfully from GET /admin/clients.'
        : 'No clients found yet. Add Client flow will be the next page we create.';
    } catch (error) {
      console.error('Failed to load clients', error);
      this.clients = [];
      this.loadError = 'Unable to load client list right now.';
      this.actionMessage = this.loadError;
    } finally {
      this.isLoading = false;
    }
  }

  logout(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    void this.router.navigate(['/login']);
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

    if (rawStatus === 'archived' || client?.archived === true || client?.isArchived === true) {
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
