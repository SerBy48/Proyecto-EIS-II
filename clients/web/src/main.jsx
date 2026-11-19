import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { aplicarTema, temaInicial } from './servicios/tema';
// Space Grotesk (OFL 1.1), empaquetada con la web: la CSP solo admite fuentes del propio sitio.
import '@fontsource-variable/space-grotesk';
import './index.css';

// El tema se aplica antes del primer render para que la pagina no parpadee.
aplicarTema(temaInicial());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
