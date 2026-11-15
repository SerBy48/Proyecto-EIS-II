import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { CABECERAS_BASICAS, CABECERAS_PRODUCCION } from './cabeceras-seguridad.js';

/**
 * El frontend habla UNICAMENTE con el API Gateway (puerto 8080).
 * No conoce los puertos de los microservicios, ni cuantos son: esa es
 * precisamente la ventaja del punto unico de entrada.
 */
export default defineConfig({
  plugins: [react()],
  // Build de produccion servido con `vite preview`: cabeceras de seguridad
  // completas, incluida la CSP (hallazgo S-08).
  preview: {
    headers: CABECERAS_PRODUCCION
  },
  server: {
    port: 5173,
    // En desarrollo, sin CSP: el plugin de React y la recarga en caliente
    // inyectan scripts en linea y usan WebSocket.
    headers: CABECERAS_BASICAS,
    proxy: {
      '/api': {
        target: process.env.URL_GATEWAY || 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
});
