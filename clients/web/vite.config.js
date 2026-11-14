import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * El frontend habla UNICAMENTE con el API Gateway (puerto 8080).
 * No conoce los puertos de los microservicios, ni cuantos son: esa es
 * precisamente la ventaja del punto unico de entrada.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.URL_GATEWAY || 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
});
