  import { NgModule } from '@angular/core';
  import { BrowserModule } from '@angular/platform-browser';
  import { AppRoutingModule } from './app-routing.module';
  import { AppComponent } from './app.component';
  import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
  import { FormsModule, ReactiveFormsModule } from '@angular/forms';
  import { HttpClientModule } from '@angular/common/http';
  import { MatIconModule } from '@angular/material/icon';
  import { MatTooltipModule } from '@angular/material/tooltip';
  import { LoginComponent } from './login/login.component';
  import { ClientsComponent } from './clients/clients.component';
  import { ClientFormComponent } from './client-form/client-form.component';


  @NgModule({
    declarations: [
      AppComponent,
      LoginComponent,
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
      MatIconModule,
      MatTooltipModule,
  ],
    providers: [],
    bootstrap: [AppComponent],
  })
  export class AppModule { }