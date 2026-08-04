import { Routes } from '@angular/router';

import { LoginComponent } from './features/login/login.component';
import { TransactionsComponent } from './features/transactions/transactions.component';
import { CategoriesComponent } from './features/categories/categories.component';
import { CreditCardsComponent } from './features/credit-cards/credit-cards.component';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'login', component: LoginComponent },
  { path: 'transactions', component: TransactionsComponent },
  { path: 'categories', component: CategoriesComponent },
  { path: 'credit-cards', component: CreditCardsComponent }
];
