import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { Button } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Button, ConfirmDialog, Toast],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class ShellLayout {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly sidebarOpen = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly title = computed(() => {
    const path = this.url();
    if (path.includes('/users')) return 'Users';
    if (path.includes('/dashboard')) return 'Dashboard';
    if (path.includes('/purchases')) return 'Purchases';
    if (path.includes('/items')) return 'Items';
    if (path.includes('/parties')) return 'Parties';
    if (path.includes('/account-ledger')) return 'Account Ledger';
    if (path.includes('/account-entry')) return 'Account Entry';
    if (path.includes('/distributors')) return 'Distributors';
    if (path.includes('/consumers')) return 'Consumers';
    if (path.includes('/dac-report')) return 'DAC Report';
    return 'DAC Entry';
  });

  readonly subtitle = computed(() => {
    const path = this.url();
    if (path.includes('/users')) return 'Create and deactivate workspace users';
    if (path.includes('/dashboard')) return 'Receivables, recent activity, and quick actions';
    if (path.includes('/purchases')) return 'Stock purchased from distributors · current month by default';
    if (path.includes('/items')) return 'Stock item master';
    if (path.includes('/parties')) return 'People you track money with';
    if (path.includes('/account-ledger')) return 'Party-wise ledger for the current month';
    if (path.includes('/account-entry')) return 'Record debit or credit';
    if (path.includes('/distributors')) return 'Distributor master';
    if (path.includes('/consumers')) return 'Consumer master';
    if (path.includes('/dac-report')) return 'DACs received by date range';
    return 'Book a delivery against a consumer';
  });

  readonly navGroups = computed(() => {
    const groups: NavGroup[] = [
      {
        label: 'Home',
        items: [{ path: '/dashboard', label: 'Dashboard', icon: 'pi pi-home' }],
      },
      {
        label: 'DAC',
        items: [
          { path: '/dac', label: 'DAC Entry', icon: 'pi pi-file-edit' },
          { path: '/dac-report', label: 'DAC Report', icon: 'pi pi-chart-bar' },
        ],
      },
      {
        label: 'Accounts',
        items: [
          { path: '/account-entry', label: 'Account Entry', icon: 'pi pi-wallet' },
          { path: '/account-ledger', label: 'Account Ledger', icon: 'pi pi-book' },
          { path: '/parties', label: 'Parties', icon: 'pi pi-id-card' },
        ],
      },
      {
        label: 'Stock',
        items: [{ path: '/purchases', label: 'Purchases', icon: 'pi pi-shopping-cart' }],
      },
      {
        label: 'Masters',
        items: [
          { path: '/distributors', label: 'Distributors', icon: 'pi pi-truck' },
          { path: '/consumers', label: 'Consumers', icon: 'pi pi-users' },
          { path: '/items', label: 'Items', icon: 'pi pi-box' },
        ],
      },
    ];

    if (this.auth.isAdmin()) {
      groups.push({
        label: 'Admin',
        items: [{ path: '/users', label: 'Users', icon: 'pi pi-shield' }],
      });
    }

    return groups;
  });

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.sidebarOpen.set(false));
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
  }
}
