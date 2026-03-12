import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ClientsComponent } from './clients/clients.component';
import { ClientFormComponent } from './client-form/client-form.component';

export const routes: Routes = [
 
  {
      path: 'login',
      component: LoginComponent
  },

  {
    path: 'clients',
    component: ClientsComponent
  },
  {
    path: 'clients/new',
    component: ClientFormComponent
  },
  {
    path: 'clients/:code/edit',
    component: ClientFormComponent
  },
  
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
