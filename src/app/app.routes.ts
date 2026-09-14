import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/guards/auth.guard';
import { ShellLayout } from './layout/shell/shell';
import { LoginPage } from './features/auth/login/login';
import { AccountEntryPage } from './features/accounts/account-entry/account-entry';
import { AccountLedgerPage } from './features/accounts/account-ledger/account-ledger';
import { PartiesPage } from './features/accounts/parties-page/parties-page';
import { DacEntryPage } from './features/dac/dac-entry/dac-entry';
import { DacReportPage } from './features/dac/dac-report/dac-report';
import { DistributorsPage } from './features/distributors/distributors-page/distributors-page';
import { ConsumersPage } from './features/consumers/consumers-page/consumers-page';
import { PurchasesPage } from './features/purchases/purchases-page/purchases-page';
import { ItemsPage } from './features/items/items-page/items-page';
import { DashboardPage } from './features/dashboard/dashboard-page/dashboard-page';
import { UsersPage } from './features/admin/users-page/users-page';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    component: LoginPage,
  },
  {
    path: '',
    canActivate: [authGuard],
    component: ShellLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardPage },
      { path: 'dac', component: DacEntryPage },
      { path: 'dac-report', component: DacReportPage },
      { path: 'account-entry', component: AccountEntryPage },
      { path: 'account-ledger', component: AccountLedgerPage },
      { path: 'parties', component: PartiesPage },
      { path: 'purchases', component: PurchasesPage },
      { path: 'items', component: ItemsPage },
      { path: 'distributors', component: DistributorsPage },
      { path: 'consumers', component: ConsumersPage },
      { path: 'users', canActivate: [adminGuard], component: UsersPage },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
