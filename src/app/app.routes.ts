import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/guards/auth.guard';
import { ShellLayout } from './layout/shell/shell';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    component: ShellLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page/dashboard-page').then(
            (m) => m.DashboardPage,
          ),
      },
      {
        path: 'dac',
        loadComponent: () =>
          import('./features/dac/dac-entry/dac-entry').then((m) => m.DacEntryPage),
      },
      {
        path: 'dac-report',
        loadComponent: () =>
          import('./features/dac/dac-report/dac-report').then((m) => m.DacReportPage),
      },
      {
        path: 'account-entry',
        loadComponent: () =>
          import('./features/accounts/account-entry/account-entry').then(
            (m) => m.AccountEntryPage,
          ),
      },
      {
        path: 'account-ledger',
        loadComponent: () =>
          import('./features/accounts/account-ledger/account-ledger').then(
            (m) => m.AccountLedgerPage,
          ),
      },
      {
        path: 'parties',
        loadComponent: () =>
          import('./features/accounts/parties-page/parties-page').then(
            (m) => m.PartiesPage,
          ),
      },
      {
        path: 'purchases',
        loadComponent: () =>
          import('./features/purchases/purchases-page/purchases-page').then(
            (m) => m.PurchasesPage,
          ),
      },
      {
        path: 'items',
        loadComponent: () =>
          import('./features/items/items-page/items-page').then((m) => m.ItemsPage),
      },
      {
        path: 'distributors',
        loadComponent: () =>
          import('./features/distributors/distributors-page/distributors-page').then(
            (m) => m.DistributorsPage,
          ),
      },
      {
        path: 'consumers',
        loadComponent: () =>
          import('./features/consumers/consumers-page/consumers-page').then(
            (m) => m.ConsumersPage,
          ),
      },
      {
        path: 'users',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/admin/users-page/users-page').then((m) => m.UsersPage),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
