import { Component, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { ApiService } from '../services/api.service';
import { DataService } from '../services/data.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: false,
  
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit, OnDestroy {


  user:any={};
  loggedIn = false;

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

  @ViewChild('eml') emailInput!: ElementRef;
  @ViewChild('pwd') pwdInput!: ElementRef;

  constructor(
    private api: ApiService,
    private dataService: DataService,
    private router: Router
  ) {}

  ngOnInit() {
    this.startHeroRotation();
    // Check if user is already logged in
    const accessToken = localStorage.getItem('accessToken');
    
    if (accessToken) {
      // Verify the token with the server
      this.api.verifyToken().then((res: any) => {
        if (res && res.user) {
          // User is already authenticated, redirect to home
          console.log('User already logged in, redirecting to home');
          this.router.navigate(['/home']);
        }
        // If token is invalid, api.verifyToken() will handle the cleanup
        // and user will stay on login page
      }).catch((err: any) => {
        // Token verification failed, clear invalid token and stay on login page
        console.log('Token verification failed, staying on login page');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      });
    }
  }

  ngOnDestroy(): void {
    this.stopHeroRotation();
  }

  onSignIn() {
    this.isLoading = true;
    this.errorMessage = "";
    
    this.api.verifyLogin(this.email, this.password).then((res: any) => {
      this.isLoading = false;
      if (res && res.accessToken) {
        this.setAgentTypesAndNavigate();
      } else {
        this.errorMessage = "Invalid credentials. Please try again.";
        this.clearInputs();
      }
    }).catch((err: any) => {
      this.isLoading = false;
      console.log(err);
      this.errorMessage = "Login failed. Please check your credentials and try again.";
      this.clearInputs();
    });
  }



  // signInWithGoogle(): void {
  //   this.authService.signIn(GoogleLoginProvider.PROVIDER_ID);
  // }

  // signOut(): void {
  //   this.authService.signOut();
  // }

  private setAgentTypesAndNavigate(): void {
    const returnUrl = localStorage.getItem('returnUrl');
    const navigateTo = returnUrl || '/home';
    if (returnUrl) {
      localStorage.removeItem('returnUrl');
    }
    this.api.getKartaAgents().then((res: any) => {
      this.dataService.agents = res;
      const agentTypes = [...new Set(
        (Array.isArray(res) ? res : [])
          .map((item: any) => item?.type ?? item?.agentType)
          .filter((t: unknown): t is string => !!t && typeof t === 'string')
      )];
      try {
        localStorage.setItem('agentTypes', JSON.stringify(agentTypes));
      } catch (e) {
        console.warn('Failed to store agentTypes in localStorage', e);
      }
    }).catch(() => {}).finally(() => {
      this.router.navigate([navigateTo]);
    });
  }

  clearInputs() {
    this.email = "";
    this.password = "";
    // Optionally, clear the input fields using ViewChild if needed
    // this.emailInput.nativeElement.value = '';
    // this.pwdInput.nativeElement.value = '';
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
