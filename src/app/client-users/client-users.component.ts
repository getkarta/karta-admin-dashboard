import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../config/environment';

export type ClientUserRow = {
  email: string;
  role: string;
  createdAt?: string;
};

@Component({
  selector: 'app-client-users',
  standalone: false,
  templateUrl: './client-users.component.html',
  styleUrl: './client-users.component.scss'
})
export class ClientUsersComponent implements OnInit, OnDestroy {
  clientCode = '';
  clientName = '';
  userRows: ClientUserRow[] = [];
  loading = false;
  loadError = '';
  actionMessage = '';

  searchQuery = '';
  pageIndex = 0;
  pageSize = 25;
  readonly pageSizeOptions: number[] = [10, 25, 50, 100];

  addDialogOpen = false;
  addEmail = '';
  addPassword = '';
  passwordVisible = false;
  addError = '';
  addingUser = false;

  private readonly apiBase = environment.apiUrl.replace(/\/$/, '');
  private routeSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(() => {
      const code = this.route.snapshot.paramMap.get('code')?.trim() ?? '';
      this.clientCode = code;
      const navState =
        typeof history !== 'undefined' ? (history.state as { clientName?: string } | null) : null;
      const fromState = (navState?.clientName ?? '').trim();
      this.clientName = fromState || code;
      this.pageIndex = 0;
      this.searchQuery = '';
      this.actionMessage = '';
      void this.loadUsers();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  get visibleUsers(): ClientUserRow[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      return this.userRows;
    }
    return this.userRows.filter((u) => {
      const hay = [u.email, u.role, u.createdAt ?? ''].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  get pagedUsers(): ClientUserRow[] {
    const list = this.visibleUsers;
    const start = this.pageIndex * this.pageSize;
    return list.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    const n = this.visibleUsers.length;
    return Math.max(1, Math.ceil(n / this.pageSize));
  }

  get pageRangeStart(): number {
    if (!this.visibleUsers.length) {
      return 0;
    }
    return this.pageIndex * this.pageSize + 1;
  }

  get pageRangeEnd(): number {
    return Math.min((this.pageIndex + 1) * this.pageSize, this.visibleUsers.length);
  }

  get emptyHint(): string {
    if (this.loading || this.loadError) {
      return '';
    }
    if (!this.userRows.length) {
      return 'No users listed for this client.';
    }
    if (!this.visibleUsers.length) {
      return 'No users match your search.';
    }
    return '';
  }

  onSearchChange(): void {
    this.pageIndex = 0;
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

  backToClients(): void {
    void this.router.navigate(['/clients']);
  }

  openAddDialog(): void {
    this.addDialogOpen = true;
    this.addError = '';
    this.addEmail = '';
    this.addPassword = '';
    this.passwordVisible = false;
    this.actionMessage = '';
  }

  closeAddDialog(): void {
    this.addDialogOpen = false;
    this.addEmail = '';
    this.addPassword = '';
    this.passwordVisible = false;
    this.addError = '';
    this.addingUser = false;
  }

  togglePasswordVisible(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  private clampPageIndex(): void {
    const maxIdx = Math.max(0, this.totalPages - 1);
    if (this.pageIndex > maxIdx) {
      this.pageIndex = maxIdx;
    }
  }

  async loadUsers(): Promise<void> {
    const code = (this.clientCode ?? '').trim();
    if (!code) {
      return;
    }
    this.loading = true;
    this.loadError = '';

    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      this.loading = false;
      this.loadError = 'Session expired. Please log in again.';
      return;
    }

    const enc = encodeURIComponent(code);
    try {
      const res = await firstValueFrom(
        this.http.get<{
          users?: Array<{
            email?: string;
            role?: string;
            createdAt?: string;
          }>;
        }>(`${this.apiBase}/clients/${enc}/users`, {
          headers: new HttpHeaders({ Authorization: `Bearer ${accessToken}` })
        })
      );
      const raw = res.users ?? [];
      this.userRows = raw.map((u) => ({
        email: (u.email ?? '').trim() || '—',
        role: (u.role ?? '').trim() || '—',
        createdAt: u.createdAt
      }));
    } catch (error) {
      console.error(error);
      this.loadError = 'Unable to load users for this client.';
      this.userRows = [];
    } finally {
      this.loading = false;
      this.clampPageIndex();
      this.cdr.markForCheck();
    }
  }

  async submitAddUser(): Promise<void> {
    const email = this.addEmail.trim();
    const password = this.addPassword;
    if (!email || !password.trim()) {
      this.addError = 'Email and password are required.';
      return;
    }
    if (password.trim().length < 6) {
      this.addError = 'Password must be at least 6 characters long.';
      return;
    }

    const clientCode = (this.clientCode ?? '').trim();
    if (!clientCode) {
      this.addError = 'Missing client code.';
      return;
    }

    this.addingUser = true;
    this.addError = '';

    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        this.addError = 'Session expired. Please log in again.';
        return;
      }

      await firstValueFrom(
        this.http.post(
          `${this.apiBase}/users`,
          {
            email,
            password: password.trim(),
            clientCode
          },
          {
            headers: new HttpHeaders({
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            })
          }
        )
      );

      this.closeAddDialog();
      this.actionMessage = 'User added successfully.';
      await this.loadUsers();
    } catch (error) {
      console.error(error);
      this.addError =
        (error as { error?: { message?: string } })?.error?.message ??
        'Unable to add user right now.';
    } finally {
      this.addingUser = false;
      this.cdr.markForCheck();
    }
  }
}
