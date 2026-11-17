/**
 * Tema claro u oscuro. La eleccion del usuario se recuerda en este navegador;
 * sin eleccion se sigue la preferencia del sistema operativo. Las variables de
 * color estan en src/index.css (:root y .dark).
 */
const CLAVE = 'tema';

const leer = () => {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === 'oscuro' || valor === 'claro' ? valor : null;
  } catch {
    return null;
  }
};

const delSistema = () => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro');

export const temaInicial = () => leer() ?? delSistema();

export const aplicarTema = (tema) => {
  document.documentElement.classList.toggle('dark', tema === 'oscuro');
};

export const guardarTema = (tema) => {
  aplicarTema(tema);
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    /* modo privado: el tema dura lo que la pestana */
  }
};
