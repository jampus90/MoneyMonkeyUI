import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { routes } from './app.routes';
import { LoginComponent } from './features/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { TransactionsComponent } from './features/transactions/transactions.component';

describe('app.routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()]
    });
  });

  it('criterio 6: rota raiz (/) renderiza LoginComponent', async () => {
    const harness = await RouterTestingHarness.create();

    const component = await harness.navigateByUrl('/', LoginComponent);

    expect(component).toBeInstanceOf(LoginComponent);
  });

  it('rota /login continua renderizando LoginComponent (mesmo componente da rota raiz)', async () => {
    const harness = await RouterTestingHarness.create();

    const component = await harness.navigateByUrl('/login', LoginComponent);

    expect(component).toBeInstanceOf(LoginComponent);
  });

  it('MVP-7 criterio 1: rota /dashboard renderiza DashboardComponent', async () => {
    const harness = await RouterTestingHarness.create();

    const component = await harness.navigateByUrl('/dashboard', DashboardComponent);

    expect(component).toBeInstanceOf(DashboardComponent);
  });

  it('MVP-7 criterio 4: rota /transactions continua renderizando TransactionsComponent apos a mudanca de destino do login', async () => {
    const harness = await RouterTestingHarness.create();

    const component = await harness.navigateByUrl('/transactions', TransactionsComponent);

    expect(component).toBeInstanceOf(TransactionsComponent);
  });
});
