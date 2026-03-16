  import { NgModule } from '@angular/core';
  import { BrowserModule } from '@angular/platform-browser';
  import { AppRoutingModule } from './app-routing.module';
  import { AppComponent } from './app.component';
  import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
  import { FormsModule, ReactiveFormsModule } from '@angular/forms';
  import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
  import { LoginComponent } from './login/login.component';
  import { ClientsComponent } from './clients/clients.component';
  import { ClientFormComponent } from './client-form/client-form.component';
  import { LayoutComponent } from './layout/layout.component';
  import { AuthInterceptor } from './interceptors/auth.interceptor';

  @NgModule({
    declarations: [
      AppComponent,
      LoginComponent,
      LayoutComponent,
      ClientsComponent,
      ClientFormComponent,
    ],
    imports: [
      BrowserModule,
      AppRoutingModule,
      FormsModule,
      ReactiveFormsModule,
      BrowserAnimationsModule,
      HttpClientModule,
    ],
    providers: [
      { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
    ],
    bootstrap: [AppComponent],
  })
  export class AppModule { }