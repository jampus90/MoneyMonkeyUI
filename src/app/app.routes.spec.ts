import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { routes } from './app.routes';
import { LoginComponent } from './features/login/login.component';

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
});
