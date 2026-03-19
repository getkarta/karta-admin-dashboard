import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TabItem, Tab } from '../models/model';

export interface Breadcrumb {
  label: string;
  route?: string;
  isActive?: boolean;
}

const DEFAULT_NAVS: Tab = [
  { item: 'home', label: 'Agents', title: 'Agents', description: 'Agents' },
  { item: 'test', label: 'Agent Testing', title: 'Agent Testing', description: 'Test' },
  { item: 'call-logs', label: 'Call Logs', title: 'Call Logs', description: 'Call Logs' },
  { item: 'conversations', label: 'Conversations', title: 'Conversations', description: 'Conversations' },
  { item: 'insights', label: 'Insights', title: 'Insights', description: 'Insights' },
  { item: 'voice-insights', label: 'Voice Insights', title: 'Voice Insights', description: 'Voice Insights' },
  { item: 'campaigns', label: 'Campaigns', title: 'Campaigns', description: 'Campaigns' },
  { item: 'batch-upload', label: 'Batch Upload', title: 'Batch Upload', description: 'Batch Upload' },
  { item: 'numbers', label: 'Numbers', title: 'Numbers', description: 'Numbers' },
  { item: 'tools', label: 'Tools', title: 'Tools', description: 'Tools' },
  { item: 'integration', label: 'Integration', title: 'Integration', description: 'Integration' },
  { item: 'Billing', label: 'Billing', title: 'Billing', description: 'Billing' },
  { item: 'settings', label: 'Settings', title: 'Settings', description: 'Settings' },
];

@Injectable({ providedIn: 'root' })
export class DataService {
  navs: Tab = [...DEFAULT_NAVS];
  private activeTab$ = new BehaviorSubject<TabItem | undefined>(DEFAULT_NAVS[0]);
  breadcrumbs$ = new BehaviorSubject<Breadcrumb[]>([]);
  private isLoggedIn$ = new BehaviorSubject<boolean>(false);
  isLoading$ = new BehaviorSubject<boolean>(false);
  private user: unknown = null;
  categories: unknown[] = [];
  categoriesWithCodes: [string, unknown][] = [];
  agents: unknown = null;
  agentID = '';

  setActiveTab(tab: TabItem): void {
    this.activeTab$.next(tab);
  }

  getActiveTab(): TabItem | undefined {
    return this.activeTab$.getValue();
  }

  setIsLoggedIn(value: boolean): void {
    this.isLoggedIn$.next(value);
  }

  getIsLoggedIn(): Observable<boolean> {
    return this.isLoggedIn$.asObservable();
  }

  setUser(user: unknown): void {
    this.user = user;
  }

  getUser(): { agents: Record<string, unknown> } {
    return (this.user as { agents: Record<string, unknown> }) ?? { agents: {} };
  }

  showLoader(show: boolean): void {
    this.isLoading$.next(show);
  }

  setAgentMode(_mode: string): void {
    // Optional: persist agent mode if needed
  }
}
