import { defineConfig } from 'vitest/config';

/**
 * Pruebas unitarias (npm run test:unit). No necesitan Docker ni servicios en
 * marcha: prueban la logica en aislamiento. Las pruebas de integracion
 * (test:http, test:e2e, test:concurrencia) siguen siendo el contrato del sistema.
 */
export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'services/*/test/**/*.test.ts', 'clients/web/test/**/*.test.ts'],
    setupFiles: ['tests/unitarias/preparacion.ts'],
    environment: 'node',
    // Los logs de los modulos probados no aportan a la salida de las pruebas.
    silent: 'passed-only',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'docs/evidencia/cobertura',
      include: [
        'packages/shared/src/**/*.ts',
        'services/carrito-service/src/totales.ts',
        'services/notificaciones-service/src/plantillas.ts',
        'services/notificaciones-service/src/canales.ts'
      ]
    }
  }
});
