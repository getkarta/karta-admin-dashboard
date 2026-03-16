import { Component, OnInit, OnDestroy, AfterViewInit, AfterViewChecked, ChangeDetectorRef, HostListener, ElementRef, ViewChild } from '@angular/core';
import { DataService } from './services/data.service';
import { Tab, TabItem } from './models/model';
import { ApiService } from './services/api.service';
import { Subscription } from 'rxjs';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { iconConfig } from './icons'; // import the iconConfig
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'; // Import DomSanitizer
import { connectSocket } from '../socketConnection';

// Breadcrumb interface
interface Breadcrumb {
  label: string;
  route?: string;
  isActive?: boolean;
}

interface SidebarStructureEntry {
  key: string;
  children?: string[];
  sectionLabel?: string;
}

interface SidebarNavGroup {
  parent: TabItem;
  children?: TabItem[];
  sectionLabel?: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.component.scss'
})


export class AppComponent implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy {
  title = 'karta-web';

  navs: Tab;
  sidebarNavs: SidebarNavGroup[] = [];
  private readonly alwaysVisibleNavItems = new Set<string>(['Billing', 'settings']);
  private readonly alwaysAccessibleNavItems = new Set<string>([
    'home',
    'subscription',
    'Billing',
    'settings',
  ]);
  isLoggedIn: boolean = false;
  authResolved = false;
  hideNavigation: boolean = false; // Property to control navigation visibility
  hideBreadcrumbs: boolean = false; // Property to control breadcrumb visibility
  private subscription!: Subscription;
  private storageCheckInterval: any; // For periodic localStorage checking
  isRouteLoading: boolean = false;
  private routeLoaderHideTimeout: any;
  hiredAgents:any = [];
  selectedAgent:any;
  agentType:string = "all";
  // Agent mode properties
  currentAgentMode: string = 'All';
  agentModes: string[] = ['All', 'Voice', 'Chat', 'Onboarding'];
  isSidebarCollapsed = false;
  private readonly sidebarCollapsedStorageKey = 'sidebarCollapsed';
  private expandedSidebarParents = new Set<string>();
  @ViewChild('agentNameRef') agentNameRef?: ElementRef<HTMLSpanElement>;
  isAgentNameTruncated = false;
  private agentNameTruncationTimeout: any = null;
  hasActiveAgent: boolean = false;

  private readonly workspaceNavItems = new Set<string>(['settings', 'Billing']);
  private readonly homeNavItems = new Set<string>(['home']);
  private readonly sidebarStructure: SidebarStructureEntry[] = [
    { key: 'home' },
    { key: 'Working Area', sectionLabel: 'Playground', children: ['test'] },

    { key: 'statistics', sectionLabel: 'Statistics', children: ['call-logs', 'conversations'] },
    { key: 'analytics', sectionLabel: 'Analytics', children: ['insights', 'voice-insights'] },
    
    { key: 'batchProcessing', sectionLabel: 'Batch Process', children: ['campaigns', 'batch-upload'] },
    // { key: 'configurations', sectionLabel: 'Configurations', children: ['numbers', 'integration'] },
    { key: 'numbers' },
    { key: 'tools' },
    { key: 'integration' },
    
    // { key: 'agent-compliance', sectionLabel: 'Agent Compliance'},

    // { key: 'users' },
    // { key: 'batch-upload' },
    // { key: 'onboard', sectionLabel: 'Onboard'},
    // { key: 'train'},
    

    // { key: 'conversations'},
    // { key: 'voice-agent', sectionLabel: 'Evaluate' },
    // { key: 'insights'},


    { key: 'Billing', sectionLabel: 'Workspace'  },
    { key: 'settings'}
  ];

  // Breadcrumb properties
  breadcrumbs: Breadcrumb[] = [];

  private readonly breadcrumbHiddenRoutes = new Set([
    '/demo/onboarding',
    '/demo/voice-agent',
    '/demo/agent-onboarding',
    '/agent/voice',
    '/batch-upload',
    '/agent-compliance',
    '/subscription',
    '/audit-agent',
    '/qa-agent-test'
  ]);

  // Breadcrumb configuration based on routes
  private breadcrumbConfig: { [key: string]: Breadcrumb[] } = {
    'home': [
      { label: 'Agents', route: 'home', isActive: true }
    ],
    'onboard': [
      { label: 'Agents', route: 'home' },
      { label: 'Agent Compliance', route: 'onboard', isActive: true }
    ],
    'agent-compliance': [
      { label: 'Agents', route: 'home' },
      { label: 'Agent Onboard', route: 'agent-compliance', isActive: true }
    ],
    'train': [
      { label: 'Agents', route: 'home' },
      { label: 'Agent Configuration', route: 'train', isActive: true }
    ],
    'qa-agent-test': [
      { label: 'Agents', route: 'home' },
      { label: 'QA Train', route: 'qa-agent-test', isActive: true }
    ],
    'test': [
      { label: 'Agents', route: 'home' },
      { label: 'Agent Testing', route: 'test', isActive: true }
    ],
    'conversations': [
      { label: 'Agents', route: 'home' },
      { label: 'Conversations', route: 'conversations', isActive: true }
    ],
    'integration': [
      { label: 'Agents', route: 'home' },
      { label: 'Integrations', route: 'integration', isActive: true }
    ],
    'insights': [
      { label: 'Agents', route: 'home' },
      { label: 'Insights', route: 'insights', isActive: true }
    ],
    'voice-insights': [
      { label: 'Agents', route: 'home' },
      { label: 'Voice Insights', route: 'voice-insights', isActive: true }
    ],

    'call-logs': [
      { label: 'Agents', route: 'home' },
      { label: 'Call Logs', route: 'call-logs', isActive: true }
    ],
    'demo/voice-agent': [
      { label: 'Agents', route: 'home' },
      { label: 'Voice Agent Demo', route: 'demo/voice-agent', isActive: true }
    ]
  };

  constructor(public dataService: DataService, private cdr: ChangeDetectorRef, private api:ApiService, private router:Router,   private sanitizer: DomSanitizer // Inject DomSanitizer
  ) {
    this.navs = this.dataService.navs;
    this.isSidebarCollapsed = this.getStoredSidebarCollapseState();
    this.currentAgentMode = this.toProperCase(localStorage.getItem('agentType') || 'all');

    this.refreshSidebarNavs();

    this.router.events.subscribe((event:any) => {
      if (event instanceof NavigationStart) {
        this.startRouteLoader();
      }

      const url = this.navs.find((x: TabItem) => x.item === event.url?.slice(1));
      if(url) {
        this.dataService.setActiveTab(url);
      }

      if (event instanceof NavigationEnd) {
        const normalizedUrl = this.normalizeUrl(event.url);

        this.hideNavigation = normalizedUrl === '/login' ||
                               normalizedUrl === '/demo/onboarding' ||
                               normalizedUrl === '/demo/voice-agent' ||
                               normalizedUrl.startsWith('/agent/voice/') ||
                               normalizedUrl.startsWith('/agent/chat/') ||
                               normalizedUrl === '/agent/compliance' ||
                               normalizedUrl.startsWith('/agent/compliance/') ||
                               normalizedUrl === '/agent/audit' ||
                               normalizedUrl.startsWith('/agent/audit/') ||
                               normalizedUrl === '/audit-agent' ||
                               normalizedUrl.startsWith('/audit-agent/');
        this.hideBreadcrumbs = this.shouldHideBreadcrumbs(normalizedUrl);

        this.updateBreadcrumbs(normalizedUrl);

        if (!this.hideNavigation) {
          this.applyAgentTypeNavs();
          this.cdr.detectChanges();
        }

        if (this.shouldLoadAgents() && !this.dataService.agents) {
          this.getKartaAgents();
        }

        this.stopRouteLoader();
      }

      if (event instanceof NavigationCancel || event instanceof NavigationError) {
        this.stopRouteLoader();
      }
    });
    
    // Initialize breadcrumbs based on current route
    const initialUrl = this.normalizeUrl(this.router.url);
    this.hideNavigation = initialUrl === '/login' ||
                          initialUrl === '/demo/onboarding' || 
                          initialUrl === '/demo/voice-agent' ||
                          initialUrl.startsWith('/agent/voice/') ||
                          initialUrl.startsWith('/agent/chat/') ||
                          initialUrl === '/agent/onBoarding' ||
                          initialUrl.startsWith('/agent/onBoarding/') ||
                          initialUrl === '/agent/audit' ||
                          initialUrl.startsWith('/agent/audit/') ||
                          initialUrl === '/audit-agent' ||
                          initialUrl.startsWith('/audit-agent/');
    this.hideBreadcrumbs = this.shouldHideBreadcrumbs(initialUrl);
    this.updateBreadcrumbs(initialUrl);
  }

  private buildSidebarNavs(navItems: Tab): SidebarNavGroup[] {
    if (!navItems) {
      return [];
    }

    const navMap = new Map(navItems.map((item: TabItem) => [item.item, item]));
    const consumedChildren = new Set<string>();
    const groups: SidebarNavGroup[] = [];
    const parentKeys = new Set(this.sidebarStructure.map(entry => entry.key));

    for (const entry of this.sidebarStructure) {
      const parent = navMap.get(entry.key);
      if (!parent) {
        continue;
      }

      const children: TabItem[] = [];
      entry.children?.forEach(childKey => {
        const child = navMap.get(childKey);
        if (child) {
          children.push(child);
          consumedChildren.add(childKey);
        }
      });

      groups.push({
        parent,
        children: children.length ? children : undefined,
        sectionLabel: entry.sectionLabel
      });
    }

    navItems.forEach((item: TabItem) => {
      if (parentKeys.has(item.item) || consumedChildren.has(item.item)) {
        return;
      }
      groups.push({ parent: item });
    });

    return groups;
  }

  private refreshSidebarNavs(): void {
    this.sidebarNavs = this.buildSidebarNavs(this.navs);
    // Keep only previously expanded parents that still exist; default collapsed on load
    const validExpandableParents = new Set(
      this.sidebarNavs
        .filter(group => group.children && group.children.length > 0)
        .map(group => group.parent.item)
    );
    this.expandedSidebarParents = new Set(
      Array.from(this.expandedSidebarParents).filter(parent =>
        validExpandableParents.has(parent)
      )
    );
  }

  private applyAgentTypeNavs(_agentType?: string): void {
    this.navs = [...this.dataService.navs];
    this.ensureAlwaysVisibleNavs();
    this.refreshSidebarNavs();
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    this.persistSidebarCollapseState();
  }

  handleCollapsedNavClick(event: MouseEvent): void {
    if (!this.isSidebarCollapsed) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    if (target.closest('.nav-item') || target.closest('.collapse-button')) {
      return;
    }

    this.isSidebarCollapsed = false;
    this.persistSidebarCollapseState();
  }

  toggleSubmenu(nav: TabItem, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (!nav) {
      return;
    }

    if (this.expandedSidebarParents.has(nav.item)) {
      this.expandedSidebarParents.delete(nav.item);
    } else {
      this.expandedSidebarParents.add(nav.item);
    }
  }

  isSidebarItemActive(nav: TabItem, children?: TabItem[]): boolean {
    const activeItem = this.dataService.getActiveTab()?.item;
    if (!activeItem) {
      return false;
    }

    return nav.item === activeItem || !!children?.some(child => child.item === activeItem);
  }

  isNavExpanded(nav: TabItem, children?: TabItem[]): boolean {
    if (!children || children.length === 0) {
      return false;
    }

    const activeItem = this.dataService.getActiveTab()?.item;
    if (children.some(child => child.item === activeItem)) {
      return true;
    }

    return this.expandedSidebarParents.has(nav.item);
  }

  trackSidebarNav(index: number, group: SidebarNavGroup): string | number {
    return group.parent?.item || index;
  }

  trackChildNav(index: number, item: TabItem): string | number {
    return item.item || index;
  }

  private scheduleAgentNameTruncationCheck(): void {
    if (this.agentNameTruncationTimeout) {
      clearTimeout(this.agentNameTruncationTimeout);
    }
    this.agentNameTruncationTimeout = setTimeout(() => {
      this.agentNameTruncationTimeout = null;
      this.updateAgentNameTruncation();
    }, 0);
  }

  private updateAgentNameTruncation(): void {
    const element = this.agentNameRef?.nativeElement;
    const isTruncated = !!element && element.scrollWidth > element.clientWidth;
    if (this.isAgentNameTruncated !== isTruncated) {
      this.isAgentNameTruncated = isTruncated;
      this.cdr.detectChanges();
    }
  }

  private getStoredSidebarCollapseState(): boolean {
    try {
      return localStorage.getItem(this.sidebarCollapsedStorageKey) === 'true';
    } catch {
      return false;
    }
  }

  private persistSidebarCollapseState(): void {
    try {
      localStorage.setItem(this.sidebarCollapsedStorageKey, String(this.isSidebarCollapsed));
    } catch {
      // Non-critical if localStorage is unavailable
    }
  }

  getPrimarySidebarNavs(): SidebarNavGroup[] {
    return this.sidebarNavs.filter(group => !this.isWorkspaceGroup(group));
  }

  getWorkspaceSidebarNavs(): SidebarNavGroup[] {
    return this.sidebarNavs.filter(group => this.isWorkspaceGroup(group));
  }

  private isWorkspaceGroup(group: SidebarNavGroup): boolean {
    const key = group.parent?.item;
    return !!key && this.workspaceNavItems.has(key);
  }

  // Method to update breadcrumbs based on current route
  private updateBreadcrumbs(url: string): void {
    if (this.shouldHideBreadcrumbs(url)) {
      this.breadcrumbs = [];
      return;
    }

    const route = url.slice(1) || 'home'; // Remove leading slash, default to 'home'

    // Special case: no breadcrumbs for numbers route
    if (route === 'numbers') {
      this.breadcrumbs = [];
      return;
    }
    if (route === 'call-logs') {
      this.breadcrumbs = [];
      return;
    }
    if (route === 'batch-upload') {
      this.breadcrumbs = [];
      return;
    }
    if (route === 'campaigns') {
      this.breadcrumbs = [];
      return;
    }
    if (route === 'agent-compliance') {
      this.breadcrumbs = [];
      return;
    }
    if (route === 'subscription') {
      this.breadcrumbs = [];
      return;
    }
    if (route === 'voice-agent' || route.startsWith('agent/voice/')) {
      this.breadcrumbs = [];
      return;
    }
    if (route === 'audit-agent' || route.startsWith('audit-agent/')) {
      this.breadcrumbs = [];
      return;
    }
    if (route === 'qa-agent-test') {
      this.breadcrumbs = [];
      return;
    }
    if (route === 'settings') {
      this.breadcrumbs = [];
      return;
    }

    this.breadcrumbs = this.breadcrumbConfig[route] || [];
  }

  private shouldHideBreadcrumbs(url: string): boolean {
    if (url === '/login') {
      return true;
    }

    if (this.breadcrumbHiddenRoutes.has(url)) {
      return true;
    }

    // Handle dynamic voice-agent routes (e.g., /voice-agent/:clientCode)
    if (url.startsWith('/agent/voice/')) {
      return true;
    }

    if (url.startsWith('/insights')) {
      return true;
    }

    if (url.startsWith('/voice-insights')) {
      return true;
    }

    if (url.startsWith('/conversations')) {
      return true;
    }

    // Hide for quality-agent detail pages (e.g., /quality-agent/:agentId)
    if (url.startsWith('/audit-agent/')) {
      return true;
    }

    if (url.startsWith('/test')) {
      return false;
    }

    return false;
  }

  private normalizeUrl(url: string): string {
    const [path] = url.split('?');
    return path;
  }

  private startRouteLoader(): void {
    if (this.routeLoaderHideTimeout) {
      clearTimeout(this.routeLoaderHideTimeout);
      this.routeLoaderHideTimeout = null;
    }
    this.isRouteLoading = true;
  }

  private stopRouteLoader(): void {
    if (this.routeLoaderHideTimeout) {
      clearTimeout(this.routeLoaderHideTimeout);
    }

    this.routeLoaderHideTimeout = setTimeout(() => {
      this.isRouteLoading = false;
      this.routeLoaderHideTimeout = null;
    }, 200);
  }

  // Method to handle breadcrumb navigation
  navigateToBreadcrumb(breadcrumb: Breadcrumb): void {
    if (breadcrumb.route && !breadcrumb.isActive) {
      this.router.navigate([breadcrumb.route]);
    }
  }

  // Method to update breadcrumb configuration dynamically
  setBreadcrumbs(breadcrumbs: Breadcrumb[]): void {
    this.breadcrumbs = breadcrumbs;
  }

  ngOnInit() {
    const token = localStorage.getItem('accessToken');
    this.dataService.agentID = this.api.getAgentID();

    this.selectedAgent = localStorage.getItem("ativeAgent") ? JSON.parse(localStorage.getItem("ativeAgent") || '{}') : null;
    const storedAgentType = localStorage.getItem('agentType');
    const derivedAgentType = this.selectedAgent?.type || this.selectedAgent?.agentType || storedAgentType;
    this.hasActiveAgent = this.hasActiveAgentValue(localStorage.getItem('ativeAgent'));
    this.agentType = this.normalizeAgentType(derivedAgentType);
    this.applyAgentTypeNavs(this.agentType);
    this.currentAgentMode = this.toProperCase(this.agentType);
    this.dataService.setAgentMode(this.agentType);

    // Subscribe to dynamic breadcrumb updates
    this.dataService.breadcrumbs$.subscribe((breadcrumbs: Breadcrumb[]) => {
      if (breadcrumbs.length > 0) {
        this.breadcrumbs = breadcrumbs;
        this.cdr.detectChanges();
      }
    });

    // Initialize agent mode from localStorage or default to 'Voice'
   // this.initializeAgentMode();

    // Start monitoring localStorage changes
    this.startStorageMonitoring();

    this.dataService.showLoader(true);
    this.api.verifyToken()
      .then((res:any)=> {
        if(res && res.user) {
          this.dataService.setIsLoggedIn(true);
          this.dataService.setUser(res.user);
          this.hiredAgents = res.user.agents;
          this.dataService.categories = res.user.client?.sopCategories ? Array.from(Object.values(res.user.client.sopCategories)) : [];
          this.dataService.categoriesWithCodes = res.user.client?.sopCategories ? Object.entries(res.user.client.sopCategories) : [];
          
          // Only fetch agents for routes that need them
          if (this.shouldLoadAgents()) {
            this.getKartaAgents();
          }
          // this.router.navigate(['/home']);  
          if(token){
            // connectElevelLabsSocket();
           connectSocket(token);
            
          }

        }
      })
      .catch((err: unknown) => {
        console.error('Token verification failed', err);
        this.dataService.setIsLoggedIn(false);
      })
      .finally(() => {
        this.authResolved = true;
        this.dataService.showLoader(false);
      });

    this.subscription = this.dataService.getIsLoggedIn().subscribe((value: boolean) => {
      this.isLoggedIn = value;
    });
  }

  // Monitor localStorage changes periodically
  private startStorageMonitoring() {
    this.storageCheckInterval = setInterval(() => {
      this.checkAndUpdateAgentMode();
    }, 500); // Check every 500ms
  }

  // Check if localStorage agentType has changed and update accordingly
  private checkAndUpdateAgentMode() {
    const savedMode = localStorage.getItem('agentType');
    if (savedMode) {
      const properCaseMode = this.toProperCase(savedMode);
      if (this.agentModes.includes(properCaseMode) && this.currentAgentMode !== properCaseMode) {
        this.currentAgentMode = properCaseMode;
        this.agentType = this.normalizeAgentType(savedMode);
        this.dataService.setAgentMode(this.agentType);
        this.applyAgentTypeNavs(this.agentType);
        this.cdr.detectChanges();
        console.log(`Agent mode updated from localStorage: ${properCaseMode}`);
      }
    } else {
      // If no saved mode, default to 'All'
      if (this.currentAgentMode !== 'All') {
        this.currentAgentMode = 'All';
        this.agentType = 'all';
        localStorage.setItem('agentType', 'all');
        this.dataService.setAgentMode(this.agentType);
        this.applyAgentTypeNavs(this.agentType);
        this.cdr.detectChanges();
        console.log('No saved mode found, defaulting to All');
      }
    }

    const activeAgentRaw = localStorage.getItem('ativeAgent');
    const parsedAgent = this.parseStoredAgent(activeAgentRaw);
    const hasAgent = !!parsedAgent;

    const selectionChanged =
      this.hasActiveAgent !== hasAgent ||
      (parsedAgent && this.selectedAgent?.agentCode !== parsedAgent?.agentCode);

    this.selectedAgent = parsedAgent;

    if (selectionChanged) {
      this.hasActiveAgent = hasAgent;
      this.applyAgentTypeNavs(this.agentType);
      this.cdr.detectChanges();
      this.scheduleAgentNameTruncationCheck();
    }
  }

  // // Initialize agent mode from localStorage
  // private initializeAgentMode() {
  //   const savedMode = localStorage.getItem('agentType');
  //   if (savedMode) {
  //     // Convert saved mode to proper case format
  //     const properCaseMode = savedMode.charAt(0).toUpperCase() + savedMode.slice(1).toLowerCase();
  //     if (this.agentModes.includes(properCaseMode)) {
  //       this.currentAgentMode = properCaseMode;
  //       console.log(`Loaded agent mode from localStorage: ${properCaseMode}`);
  //     } 
  //   } else {
  //     // Default to 'Voice' if no saved mode
  //     this.currentAgentMode = 'Voice';
  //    // localStorage.setItem('agentType', 'voice');
  //     console.log('No saved mode found, defaulting to Voice');
  //   }
  // }

  private ensureAlwaysVisibleNavs(): void {
    const order = new Map<string, number>();
    this.dataService.navs.forEach((nav: TabItem, index: number) => {
      order.set(nav.item, index);
    });

    const additions = Array.from(this.alwaysVisibleNavItems)
      .filter((item) => !this.navs.some((nav: TabItem) => nav.item === item))
      .map((item) => this.dataService.navs.find((nav: TabItem) => nav.item === item))
      .filter((nav): nav is TabItem => Boolean(nav));

    if (additions.length === 0) {
      return;
    }

    this.navs = [...this.navs, ...additions].sort((a, b) => {
      const orderA = order.get(a.item) ?? Number.MAX_SAFE_INTEGER;
      const orderB = order.get(b.item) ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });
  }

  // Toggle between Voice and Chat modes
  toggleAgentMode() {

    let activeAgent = localStorage.getItem("ativeAgent");
    if(activeAgent){
     const [agentCode, agentData] = activeAgent
     this.dataService.agentID = this.api.getAgentID();
    }




    const currentIndex = this.agentModes.indexOf(this.currentAgentMode);
    const nextIndex = (currentIndex + 1) % this.agentModes.length;
    this.currentAgentMode = this.agentModes[nextIndex];
    
    localStorage.setItem('agentType', this.currentAgentMode.toLowerCase());
     const users = this.dataService.getUser();
    
    Object.entries(users.agents).forEach((data:any)=> {
      localStorage.setItem("agentType",  this.currentAgentMode);
      localStorage.setItem("ativeAgent", JSON.stringify(data[1]));
    });

    this.dataService.setAgentMode(this.currentAgentMode.toLowerCase());
    //  console.log(`Agent  switched to: ${this.currentAgentMode}`);
    
    // Reload the application to change context
    window.location.reload();
  }

  logoutHandler(){
    // Clear all localStorage data for security
    localStorage.removeItem('agentTypes');
    localStorage.clear();
    this.cdr.detectChanges();
    window.location.href = '/login';
  }

  routeNavs(nav:TabItem, children?: TabItem[]) {
    // Handle collapsed sidebar behavior
    if (this.isSidebarCollapsed) {
      // If item has children, expand the sidebar
      if (children && children.length > 0) {
        this.isSidebarCollapsed = false;
        this.persistSidebarCollapseState();
        // Ensure the submenu is expanded after sidebar opens
        if (!this.expandedSidebarParents.has(nav.item)) {
          this.expandedSidebarParents.add(nav.item);
        }
        return;
      }
      // If item has no children, navigate directly
      if (nav.item === 'home') {
        this.resetAgentSelection();
      }
      this.router.navigate([nav.item]);
      this.dataService.setActiveTab(nav);
      return;
    }

    // Normal behavior when sidebar is expanded
    // Toggle expandable groups instead of navigating
    if (children && children.length > 0) {
      this.toggleSubmenu(nav);
      return;
    }
    
    // Check if navigation should be disabled (except for home)
    if (this.shouldDisableNavItem(nav.item)) {
      return; // Prevent navigation if item is disabled
    }
    if (nav.item === 'home') {
      this.resetAgentSelection();
    }
    this.router.navigate([nav.item]);
    this.dataService.setActiveTab(nav);
  }

  redirectToPath(path:string) {
    if (path === 'home') {
      this.resetAgentSelection();
    }
    this.router.navigate([path]);
  }

  // Check if a navigation item should be disabled
  shouldDisableNavItem(navItem: string): boolean {
    return false;
  }

  // Check if navigation item should appear disabled (for styling)
  isNavItemDisabled(navItem: string): boolean {
    return this.shouldDisableNavItem(navItem);
  }

  // Check if current route needs agents data
  private shouldLoadAgents(): boolean {
    const currentRoute = this.router.url.slice(1) || 'home'; // Remove leading slash, default to 'home'
    
    // Routes that need agents data
    const routesNeedingAgents = [
      'home',
      'onboard', 
      'train',
      'agent/voice',
      'test',
      'conversations',
      'insights',
      'voice-insights'
    ];
    
    return routesNeedingAgents.includes(currentRoute);
  }

  private normalizeAgentType(type: any): string {
    if (!type || typeof type !== 'string') {
      return 'all';
    }
    const normalized = type.toLowerCase();
    if (normalized === 'text') {
      return 'chat';
    }
    return normalized || 'all';
  }

  private hasActiveAgentValue(value: string | null): boolean {
    return !!(value && value.trim() !== '');
  }

  private parseStoredAgent(value: string | null): any | null {
    if (!this.hasActiveAgentValue(value)) {
      return null;
    }
    try {
      return JSON.parse(value || '{}');
    } catch (err) {
      console.warn('Failed to parse stored agent', err);
      return null;
    }
  }

  private toProperCase(value: string): string {
    if (!value) {
      return 'All';
    }
    const normalized = value.toLowerCase();
    if (normalized === 'all') {
      return 'All';
    }
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  getKartaAgents() {
    this.api.getKartaAgents().then((res: any) => {
      this.dataService.agents = res;
      const agentTypes = [...new Set(
        (Array.isArray(res) ? res : [])
          .map((item: any) => item?.type ?? item?.agentType)
          .filter((t): t is string => !!t && typeof t === 'string')
      )];
      try {
        localStorage.setItem('agentTypes', JSON.stringify(agentTypes));
      } catch (e) {
        console.warn('Failed to store agentTypes in localStorage', e);
      }
    });
  }

  ngAfterViewInit(): void {
    this.scheduleAgentNameTruncationCheck();
  }

  ngAfterViewChecked(): void {
    this.scheduleAgentNameTruncationCheck();
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    
    // Clear the storage monitoring interval
    if (this.storageCheckInterval) {
      clearInterval(this.storageCheckInterval);
    }

    if (this.routeLoaderHideTimeout) {
      clearTimeout(this.routeLoaderHideTimeout);
      this.routeLoaderHideTimeout = null;
    }

    if (this.agentNameTruncationTimeout) {
      clearTimeout(this.agentNameTruncationTimeout);
      this.agentNameTruncationTimeout = null;
    }
  }

  getLoggedIn() {
    return this.dataService.getIsLoggedIn();
  }

  getActiveTab() {
    return this.dataService.getActiveTab();
  }

  getActiveTabLabel() {
    return this.dataService.getActiveTab()?.label ?? '';
  }

  getActiveTabTitle() {
    return this.dataService.getActiveTab()?.title ?? '';
  }

  isToolsNavActive(): boolean {
    return this.dataService.getActiveTab()?.item === 'tools';
  }

  getActiveTabDescription() {
    return this.dataService.getActiveTab()?.description ?? '';
  }

  isVoiceAgentRoute(): boolean {
    const currentUrl = this.normalizeUrl(this.router.url);
    return currentUrl === '/agent/voice' ||
      currentUrl.startsWith('/agent/voice/') ||
      currentUrl === '/agent-compliance' ||
      currentUrl === '/audit-agent' ||
      currentUrl.startsWith('/audit-agent/');
  }

  isSubscriptionRoute(): boolean {
    return this.router.url === '/subscription';
  }

  isQaAgentTestRoute(): boolean {
    return this.normalizeUrl(this.router.url) === '/qa-agent-test';
  }

  isAgentTestRoute(): boolean {
    return this.normalizeUrl(this.router.url) === '/test';
  }

  isConversationsRoute(): boolean {
    return this.normalizeUrl(this.router.url) === '/conversations';
  }

  isInsightsRoute(): boolean {
    return this.normalizeUrl(this.router.url) === '/insights';
  }

  isTrainRoute(): boolean {
    const normalized = this.normalizeUrl(this.router.url);
    return normalized === '/agent/chat/' || normalized.startsWith('/agent/chat/');
  }

  isAgentOnboardingRoute(): boolean {
    const normalized = this.normalizeUrl(this.router.url);
    return normalized === '/agent/compliance' || normalized.startsWith('/agent/compliance/');
  }

  isAgentAuditRoute(): boolean {
    const normalized = this.normalizeUrl(this.router.url);
    return normalized === '/agent/audit' || normalized.startsWith('/agent/audit/');
  }

  isSettingsRoute(): boolean {
    return this.normalizeUrl(this.router.url) === '/settings';
  }

  isHomeRoute(): boolean {
    return this.router.url === '/home' || this.router.url === '/';
  }

  getIconForNav(navItem: string): SafeHtml {
    const svg = iconConfig[navItem];
    return this.sanitizer.bypassSecurityTrustHtml(svg || ''); // Bypass Angular's sanitization
  }

  getNavLabel(nav: TabItem): string {
    return nav.displayLabel || nav.label;
  }

  getNavBadge(nav: TabItem): string | null {
    return nav.badgeLabel || null;
  }

  getNavIconPath(navItem: string, isActive: boolean): string {
    const iconKey = navItem === 'statistics' ? 'call-logs' : navItem;
    const suffix = isActive ? '-filled' : '';
    return `assets/images/${iconKey}${suffix}.svg`;
  }

  setActiveTab(val:TabItem) {
    this.dataService.setActiveTab(val);
  }

  getActiveAgentName(): string {
    if (!this.selectedAgent) {
      return '';
    }
    return (
      this.selectedAgent.displayName ||
      this.selectedAgent.name ||
      this.selectedAgent.agentName ||
      this.selectedAgent.description?.title ||
      'Selected Agent'
    );
  }

  getActiveAgentTypeLabel(): string {
    if (!this.selectedAgent) {
      return '';
    }
    const type =
      this.selectedAgent.type ||
      this.selectedAgent.agentType ||
      this.selectedAgent.baseAgent?.type ||
      '';
    return type ? this.toProperCase(type) : 'Agent';
  }

  getActiveAgentSummary(): string {
    if (!this.selectedAgent) {
      return '';
    }
    const name = this.getActiveAgentName();
    const type = this.getActiveAgentTypeLabel();
    return `${name} - {${type}}`;
  }

  getActiveAgentInitials(): string {
    if (!this.selectedAgent) {
      return '';
    }
    const name = this.getActiveAgentName().trim();
    if (!name) {
      return '';
    }
    const parts = name.split(/\s+/);
    const first = parts[0]?.charAt(0) || '';
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (first + last).toUpperCase();
  }

  private resetAgentSelection(): void {
    localStorage.removeItem('ativeAgent');
    localStorage.setItem('agentType', 'all');
    this.selectedAgent = null;
    this.hasActiveAgent = false;
    this.agentType = 'all';
    this.currentAgentMode = 'All';
    this.dataService.setAgentMode(this.agentType);
    this.applyAgentTypeNavs(this.agentType);
    this.dataService.setActiveTab(this.dataService.navs.find((nav: TabItem) => nav.item === 'home') || this.dataService.navs[0]);
    this.cdr.detectChanges();
    this.scheduleAgentNameTruncationCheck();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.scheduleAgentNameTruncationCheck();
  }
}