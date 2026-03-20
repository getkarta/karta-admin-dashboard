# KartaWeb

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.0.7.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.





# Karta Admin Dashboard – Frontend Files Explained (Detail)

Yeh document har important file mein **kya kiya hai, kaise kaam karta hai**, aur **code ke saath** explain karta hai.

---

## 1. Entry & bootstrap

### `src/index.html`
- **Kya hai:** Single HTML page jahan Angular app mount hota hai.
- **Kya kiya hai:**
  - `<title>Karta Admin Dashboard</title>` – browser tab title.
  - `<base href="/">` – sab routes is root se resolve hote hain.
  - Favicon, **Inter** font, Material Icons, Handsontable CSS link.
  - `<app-root></app-root>` – yahi pe Angular bootstrap hoke render hota hai.

```html
<body class="mat-typography" style="font-family: 'Inter', sans-serif;">
  <app-root></app-root>
</body>
```

---

### `src/main.ts`
- **Kya hai:** App ka entry point. Angular ko bootstrap karta hai.
- **Kya kiya hai:**
  - `platformBrowserDynamic().bootstrapModule(AppModule)` se **AppModule** load hota hai.
  - `ngZoneEventCoalescing: true` – performance ke liye event coalescing.

```typescript
platformBrowserDynamic().bootstrapModule(AppModule, {
  ngZoneEventCoalescing: true,
})
  .catch(err => console.error(err));
```

---

## 2. App root & module

### `src/app/app.component.ts`
- **Kya hai:** Root component. Sirf app ka container; actual UI routing se aata hai.
- **Kya kiya hai:**
  - `selector: 'app-root'` – index.html mein `<app-root>` yahi component hai.
  - `standalone: false` – module-based app.
  - Koi extra logic nahi; template mein sirf `<router-outlet>` hai.

```typescript
@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'karta-admin-dashboard';
}
```

---

### `src/app/app.component.html`
- **Kya hai:** Root template. Sirf router outlet – yahi se login / layout / clients load hote hain.
- **Kya kiya hai:** Pehle yahan purana sidebar/nav/loader commented tha; ab sirf outlet rakha hai taaki sirf **LayoutComponent** sidebar dikhaye.

```html
<router-outlet></router-outlet>
```

---

### `src/app/app.module.ts`
- **Kya hai:** Main Angular module. Sab components, imports, aur **AuthInterceptor** yahan register hote hain.
- **Kya kiya hai:**
  - **declarations:** AppComponent, LoginComponent, LayoutComponent, ClientsComponent, ClientFormComponent.
  - **imports:** BrowserModule, AppRoutingModule, FormsModule, ReactiveFormsModule, BrowserAnimationsModule, HttpClientModule.
  - **providers:** `HTTP_INTERCEPTORS` → **AuthInterceptor** – har HTTP request pe token lagta hai, 401 pe logout + login redirect.

```typescript
providers: [
  { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
],
bootstrap: [AppComponent],
```

---

## 3. Routing

### `src/app/app-routing.module.ts`
- **Kya hai:** Saari routes yahan define. Kaunsi URL pe kaunsa component chalega.
- **Kya kiya hai:**
  - `''` → redirect `/login`.
  - `login` → **LoginComponent** (bina guard).
  - `''` (layout) → **LayoutComponent** with **authGuard**; andar **children:**
    - `clients` → ClientsComponent
    - `clients/new` → ClientFormComponent (create)
    - `clients/:code/edit` → ClientFormComponent (edit)
  - `**` → redirect `/login`.

```typescript
export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'clients', component: ClientsComponent },
      { path: 'clients/new', component: ClientFormComponent },
      { path: 'clients/:code/edit', component: ClientFormComponent }
    ]
  },
  { path: '**', redirectTo: '/login' }
];
```

---

## 4. Auth guard

### `src/app/guards/auth.guard.ts`
- **Kya hai:** Route guard. Login ke bina protected routes block karta hai.
- **Kya kiya hai:**
  - `CanActivateFn` – Angular 15+ functional guard.
  - `localStorage.getItem('accessToken')` – agar token hai to `true` (route allow).
  - Token nahi to `router.navigate(['/login'])` aur `false` (route block).

```typescript
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('accessToken');
  if (token) return true;
  void router.navigate(['/login']);
  return false;
};
```

---

## 5. Auth interceptor

### `src/app/interceptors/auth.interceptor.ts`
- **Kya hai:** Har HTTP request/response pe run hota hai. Token attach + 401 pe logout.
- **Kya kiya hai:**
  - **Request:** Token mila to `Authorization: Bearer <token>` header clone karke lagaya.
  - **Response (error):** `catchError` – agar status **401** to:
    - `accessToken` / `refreshToken` localStorage se remove.
    - `/login` pe redirect.
  - Baaki errors wapas throw (caller handle karega).

```typescript
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
```

---

## 6. Config

### `src/config/environment.ts`
- **Kya hai:** Environment config. API base URL aur baaki URLs yahan.
- **Kya kiya hai:**
  - `apiUrl: 'http://localhost:3000/'` – backend base (login, user, client APIs isi se banti hain).
  - Baaki URLs (batchApiUrl, callLogsApiUrl, toolsApiUrl, dashboardUrl, livekit) bhi yahan; admin dashboard zyada use `apiUrl` karta hai.

```typescript
export const environment = {
  production: false,
  staging: false,
  development: true,
  apiUrl: 'http://localhost:3000/',
  // ... other URLs
};
```

Har component `environment.apiUrl` use karta hai, trailing slash hata kar: `environment.apiUrl.replace(/\/$/, '')`.

---

## 7. Login

### `src/app/login/login.component.ts`
- **Kya hai:** Login page: email/password, backend login, role check (sirf admin), hero rotation.
- **Kya kiya hai:**
  - **State:** `email`, `password`, `errorMessage`, `isLoading`, `activeHeroIndex`, `heroSections`.
  - **ngOnInit:** Agar pehle se `accessToken` hai to `GET /user` karke role check – **admin** ho to `/clients`, nahi to session clear + “Access denied” + `/login`. Hero rotation start.
  - **onSignIn():**
    - Validation: email/password required.
    - `POST ${apiBase}/user/login` → `accessToken`, `refreshToken` → localStorage.
    - Phir `GET ${apiBase}/user` (Bearer token) → role check → admin → `/clients`; non-admin → clear + “Access denied” + `/login`.
  - **fetchCurrentUser(accessToken):** `GET /user` with `Authorization: Bearer <token>`.
  - **clearSession():** localStorage se dono tokens remove.
  - **Hero:** `startHeroRotation()` – har 5 sec pe `activeHeroIndex` badalta hai; `ngOnDestroy` mein `stopHeroRotation()`.

```typescript
async onSignIn(): Promise<void> {
  // ...
  const loginResponse = await firstValueFrom(
    this.http.post<LoginResponse>(`${this.apiBase}/user/login`, {
      email: this.email.trim(),
      password: this.password
    })
  );
  localStorage.setItem('accessToken', loginResponse.accessToken);
  localStorage.setItem('refreshToken', loginResponse.refreshToken);
  const userResponse = await this.fetchCurrentUser(loginResponse.accessToken);
  if (userResponse.user.role === 'admin') {
    await this.router.navigate(['/clients']);
  } else {
    this.clearSession();
    this.errorMessage = 'Access denied. Admin account required.';
    await this.router.navigate(['/login']);
  }
}
```

---

### `src/app/login/login.component.html`
- **Kya hai:** Login UI: hero (logo + rotating sections) + right side card (form + client logos).
- **Kya kiya hai:**
  - **Hero:** Logo, heading, `heroSections` loop – `activeHeroIndex` se `translateX(-activeHeroIndex * 100%)` se sliding. Privacy/terms links.
  - **Form:** Email/password `[(ngModel)]`, Login button (disabled when `isLoading`), `(keyup.enter)="onSignIn()"`. `errorMessage` agar hai to dikhata hai. Help text + support link.
  - **Trusted by:** Client logos (assets).

```html
<input type="text" [(ngModel)]="email" placeholder="you@getkarta.ai" />
<input type="password" [(ngModel)]="password" placeholder="••••••••" />
<button ... [disabled]="isLoading" (click)="onSignIn()">
  {{ isLoading ? 'Signing in...' : 'Login' }}
</button>
<div *ngIf="errorMessage" class="error-message">{{ errorMessage }}</div>
```

---

### `src/app/login/login.component.scss`
- **Kya hai:** Login page styling: split layout (hero left, form right), card, inputs, button, hero gradient, subtext track, responsive (900px pe column).

---

## 8. Layout (sidebar + outlet)

### `src/app/layout/layout.component.ts`
- **Kya hai:** Logged-in shell: sidebar (brand, nav, logout) + main area jahan child route (clients/form) load hota hai.
- **Kya kiya hai:**
  - Sirf **logout():** tokens remove + `navigate(['/login'])`. Sidebar/nav template mein hai.

```typescript
logout(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  void this.router.navigate(['/login']);
}
```

---

### `src/app/layout/layout.component.html`
- **Kya hai:** Shell structure.
- **Kya kiya hai:**
  - **Sidebar:** “Admin Dashboard” brand, **Clients** button with `routerLink="/clients"` and `routerLinkActive="shell__nav-item--active"`, footer mein **Logout** button.
  - **Main:** `<router-outlet></router-outlet>` – yahan `/clients`, `/clients/new`, `/clients/:code/edit` load hote hain.

```html
<aside class="shell__sidebar">
  <div class="shell__brand"><span class="shell__brand-text">Admin Dashboard</span></div>
  <nav class="shell__nav">
    <button type="button" class="shell__nav-item" routerLink="/clients" routerLinkActive="shell__nav-item--active">
      Clients
    </button>
  </nav>
  <div class="shell__footer">
    <button type="button" class="shell__logout" (click)="logout()">Logout</button>
  </div>
</aside>
<main class="shell__main">
  <router-outlet></router-outlet>
</main>
```

---

### `src/app/layout/layout.component.scss`
- **Kya hai:** Shell styling: flex layout, sidebar width, brand, nav items (hover/active), logout button, main area padding. Variables `src/styles/_variables.scss` se.

---

## 9. Clients list

### `src/app/clients/clients.component.ts`
- **Kya hai:** Client list page: API se list, filter tabs (All/Active/Draft/Archived), Add Client, Edit, Archive.
- **Kya kiya hai:**
  - **Interfaces:** `BillingInfo`, `ClientRow` (clientName, clientCode, enabledAgents, status, owner, createdOn, billing).
  - **State:** `clients`, `selectedTab`, `actionMessage`, `isLoading`, `loadError`. `apiBase` from environment.
  - **ngOnInit:** `loadClients()`.
  - **Getters:** `activeClients`, `draftClients`, `archivedClients`, `visibleClients` (selectedTab ke hisaab se filter).
  - **setTab(tab):** Filter change.
  - **addClient():** `navigate(['/clients/new'])`.
  - **editClient(client):** `navigate(['/clients', client.clientCode, 'edit'], { state: { client } })` – client object state mein pass (edit form prefill).
  - **archiveClient(client):** Confirm → `DELETE ${apiBase}/client/${client.clientCode}` (Bearer) → phir `loadClients()`.
  - **loadClients():** `GET ${apiBase}/client/list` (Bearer) → `extractClientRows(response)` → `clients` set. Response array ya `response.clients` ya `response.data` handle karta hai.
  - **extractClientRows:** Backend shape flexible; har item ko `ClientRow` shape mein map (name/code/agents/status/owner/createdOn/billing). `normalizeStatus()` (archived/draft/active), `formatDate()` (en-GB short date).

```typescript
async loadClients(): Promise<void> {
  const response = await firstValueFrom(
    this.http.get<any>(`${this.apiBase}/client/list`, {
      headers: new HttpHeaders({ Authorization: `Bearer ${accessToken}` })
    })
  );
  const rows = this.extractClientRows(response);
  this.clients = rows;
}
```

---

### `src/app/clients/clients.component.html`
- **Kya hai:** Clients UI: heading, summary cards (Active/Draft/Archived count), Client Directory card, filter tabs, message/loading/error, table (client name link → edit, code, agents, status pill, owner, created, Edit/Archive buttons), empty state.
- **Kya kiya hai:**
  - Summary: `activeClients`, `draftClients`, `archivedClients`.
  - Tabs: `[class.active]="selectedTab === 'all'"` etc., `(click)="setTab('all')"` etc.
  - Table: `*ngFor="let client of visibleClients"`, client name pe `(click)="editClient(client)"`, status pe `ngClass` (status-pill--active/draft/archived), row actions Edit / Archive.

---

### `src/app/clients/clients.component.scss`
- **Kya hai:** Page layout, summary grid, table, status pills, buttons, responsive (e.g. 992px pe grid columns change).

---

## 10. Client form (create / edit)

### `src/app/client-form/client-form.component.ts`
- **Kya hai:** Create client (`/clients/new`) ya Edit client (`/clients/:code/edit`). Basic info + (edit only) Enabled agents, Add User, Pricing & Billing.
- **Kya kiya hai:**
  - **Route:** `ActivatedRoute` se `code` – agar `code` hai to **edit mode**, nahi to create. Edit mode mein `history.state.client` se prefill (clients list se pass).
  - **Form:** `FormGroup` – `clientName` (required, minLength 3), `enabledAgents` (array). Edit mode mein `patchValue` from state client; billing `applyBillingFromClient(client)` se (tier, allowNegativeBalance, customPricing → pricingRules array).
  - **onSubmit():**
    - Create: `POST ${apiBase}/client` body `{ clientName }`.
    - Edit: `PUT ${apiBase}/client/${clientCode}` body `{ clientName, enabledAgents }`. Edit mode mein at least one enabled agent required.
    - Success pe `navigate(['/clients'])`.
  - **addUser():** Edit mode only. Email/password (min 6) validate → `POST ${apiBase}/user/register` body `{ email, password, clientCode }`. Token interceptor add karta hai. Success pe message + clear fields.
  - **Pricing:** `billingTier`, `allowNegativeBalance`, `pricingRules` (array of featureCode, unitType, creditPerUnit, rounding, intervalSeconds, minimumSeconds). `addPricingRule()` / `removePricingRule(i)`. **savePricing():** rules ko `customPricing[featureCode][unitType]` shape mein build karke `PUT ${apiBase}/client/${clientCode}` body `{ billing: { tier, allowNegativeBalance, customPricing } }`.
  - **goBack():** `navigate(['/clients'])`.
  - Constants: BILLING_TIERS, FEATURE_CODES, UNIT_TYPES, ROUNDING_TYPES, availableAgents – dropdowns ke liye.

```typescript
this.clientForm = this.fb.group({
  clientName: ['', [Validators.required, Validators.minLength(3)]],
  enabledAgents: this.fb.nonNullable.control<string[]>([])
});
// Edit: from history.state.client
this.clientForm.patchValue({
  clientName: client.clientName,
  enabledAgents: client.enabledAgents || []
});
this.applyBillingFromClient(client);
```

---

### `src/app/client-form/client-form.component.html`
- **Kya hai:** Form UI: back link, title (Create/Update), description, client code badge (edit), 3 sections – Basic info, Add User (edit only), Pricing & Billing (edit only).
- **Kya kiya hai:**
  - **Basic:** `[formGroup]="clientForm"`, `formControlName="clientName"`, validation error `clientForm.controls['clientName'].touched && invalid`. Edit mode mein multi-select `enabledAgents`. Cancel / Submit (Create Client / Update Client). Error/success messages.
  - **Add User:** ngModel `newUserEmail`, `newUserPassword`, Add User button, error/success messages.
  - **Pricing:** Billing tier select, Allow negative balance checkbox. Custom pricing: header row + `*ngFor="let rule of pricingRules"` – feature, unit type, credits, rounding, interval, min, Remove. “+ Add rule” → `addPricingRule()`. Save pricing button, messages.

```html
<form [formGroup]="clientForm" (ngSubmit)="onSubmit()">
  <input formControlName="clientName" ... />
  <small *ngIf="clientForm.controls['clientName'].touched && clientForm.controls['clientName'].invalid">
    Client name must be at least 3 characters long.
  </small>
  <select formControlName="enabledAgents" multiple *ngIf="isEditMode">...</select>
  ...
</form>
```

---

### `src/app/client-form/client-form.component.scss`
- **Kya hai:** Form layout, cards, labels, inputs, pricing grid (header + rows), responsive (e.g. 900px/600px pe grid/layout change).

---

## 11. Styles

### `src/styles/_variables.scss`
- **Kya hai:** Global SCSS variables: colors (primary, white, muted, border, success, bg, etc.), font, radius, shadow. Components `@use '../../styles/variables' as *;` se use karte hain.

### `src/styles.scss`
- **Kya hai:** Global styles: Tailwind, scrollbar hide, body font, Material theme vars, buttons, form overrides, toasts, etc. (admin dashboard specifically layout/login/client-form ke liye zyada use; baaki shared/legacy bhi hai.)

---

## 12. Flow summary (ek line mein)

1. **index.html** → **main.ts** → **AppModule** → **AppComponent** → `<router-outlet>`.
2. **Route ''** → `/login` redirect → **LoginComponent** (login form + hero). Login success + admin → `/clients`.
3. **Route '' + authGuard** → token check → **LayoutComponent** (sidebar + outlet). **Route clients** → **ClientsComponent** (list, tabs, add/edit/archive). **Route clients/new** → **ClientFormComponent** (create). **Route clients/:code/edit** → **ClientFormComponent** (edit, state se client + billing prefill).
4. **AuthInterceptor** har request pe Bearer token lagata hai; 401 aane pe tokens clear + `/login` redirect.
5. **environment.apiUrl** se sab API calls (user/login, user, user/register, client/list, client, client/:code).

---

Is document mein frontend mein **jo jo kiya hai** – file-by-file, code ke saath – sab explain hai. Sir ko yeh dekh ke pura flow aur implementation clear ho jana chahiye.

