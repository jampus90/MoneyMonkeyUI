import { Routes } from '@angular/router';

import { LoginComponent } from './features/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { TransactionsComponent } from './features/transactions/transactions.component';
import { CategoriesComponent } from './features/categories/categories.component';
import { CreditCardsComponent } from './features/credit-cards/credit-cards.component';
import { CreditCardDetailComponent } from './features/credit-cards/credit-card-detail.component';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'transactions', component: TransactionsComponent },
  { path: 'categories', component: CategoriesComponent },
  { path: 'credit-cards', component: CreditCardsComponent },
  { path: 'credit-cards/:creditCardId', component: CreditCardDetailComponent }
];
