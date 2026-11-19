/** @type {import('tailwindcss').Config} */

/**
 * Paleta de SerByTek con variables CSS (src/index.css): cada color se define
 * una vez para el tema claro y otra para el oscuro, y las clases de siempre
 * (bg-superficie, text-gray-700, border-red-200...) cambian solas al activar
 * el modo oscuro. Los botones solidos usan clases propias (btn-*) con colores
 * fijos, porque un mismo tono no sirve a la vez como texto y como fondo.
 */
const escala = (nombre, pasos = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) =>
  Object.fromEntries(pasos.map((paso) => [paso, `rgb(var(--${nombre}-${paso}) / <alpha-value>)`]));

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk Variable"', '"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        superficie: 'rgb(var(--superficie) / <alpha-value>)',
        marca: escala('marca'),
        gray: escala('gray'),
        red: escala('red'),
        green: escala('green'),
        amber: escala('amber'),
        blue: escala('blue')
      }
    }
  },
  plugins: []
};
