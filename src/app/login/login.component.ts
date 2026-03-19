import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../config/environment';


interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

interface CurrentUserResponse {
  user: {
    email: string;
    role: string;
  };
}

@Component({
  selector: 'app-login',
  standalone: false,
  
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit, OnDestroy {


  email:string = "";
  password:string = "";
  errorMessage: string = '';
  isLoading: boolean = false;
  activeHeroIndex = 0;
  heroSections = [
    {
      title: 'Specialised Agents',
      items: [
        'Voice AI Customer support Agents',
        'Chat, email Customer support Agents',
        'Specialised Onboarding, KYC Agents for BFSI',
        'Outbound Voice AI sales Agents'
      ]
    },
    {
      title: 'Success rate',
      items: [
        '75%+ deflection',
        '4.3 avg CSAT rating',
        '40%+ more conversions',
        '60%+ human time saved',
        '95%+ accuracy in KYC verification'
      ]
    },
    {
      title: 'Top grade security',
      items: [
        'SOC 2',
        'ISO 27001',
        'Data residency',
        'PII masking'
      ]
    }
  ];
  private rotationIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly apiBase = environment.apiUrl.replace(/\/$/, '');


  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.startHeroRotation();

    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      return;
    }

    try {
      const userResponse = await this.fetchCurrentUser(accessToken);

      if (userResponse.user.role === 'admin') {
        await this.router.navigate(['/clients']);
      } else {
        this.clearSession();
        this.errorMessage = 'Access denied. Admin account required.';
        await this.router.navigate(['/login']);
      }
    } catch (error) {
      this.clearSession();
    }
  }

  ngOnDestroy(): void {
    this.stopHeroRotation();
  }

  async onSignIn(): Promise<void> {
    if (!this.email.trim() || !this.password.trim()) {
      this.errorMessage = 'Email and password are required.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      const loginResponse = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.apiBase}/user/login`, {
          email: this.email.trim(),
          password: this.password
        })
      );

      if (!loginResponse?.accessToken || !loginResponse?.refreshToken) {
        this.errorMessage = 'Invalid credentials. Please try again.';
        this.clearInputs();
        return;
      }
      localStorage.setItem('accessToken', loginResponse.accessToken);
      localStorage.setItem('refreshToken', loginResponse.refreshToken);

      const userResponse = await this.fetchCurrentUser(loginResponse.accessToken);

      if (userResponse.user.role === 'member') {
        await this.router.navigate(['/clients']);
      } else {
        this.clearSession();
        this.errorMessage = 'Access denied. Admin account required.';
        await this.router.navigate(['/login']);
      }
    } catch (error) {
      console.error(error);
      this.errorMessage = 'Login failed. Please check your credentials and try again.';
      this.clearInputs();
      this.clearSession();
    } finally {
      this.isLoading = false;
    }
  }

  private fetchCurrentUser(accessToken: string): Promise<CurrentUserResponse> {
    return firstValueFrom(
      this.http.get<CurrentUserResponse>(`${this.apiBase}/user`, {
        headers: new HttpHeaders({
          Authorization: `Bearer ${accessToken}`
        })
      })
    );
  }
  private clearSession(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  clearInputs() {
    this.email = "";
    this.password = "";
  }

  private startHeroRotation() {
    if (this.heroSections.length <= 1 || this.rotationIntervalId) {
      return;
    }

    this.rotationIntervalId = setInterval(() => {
      this.activeHeroIndex =
        (this.activeHeroIndex + 1) % this.heroSections.length;
    }, 5000);
  }

  private stopHeroRotation() {
    if (this.rotationIntervalId) {
      clearInterval(this.rotationIntervalId);
      this.rotationIntervalId = null;
    }
  }
}
