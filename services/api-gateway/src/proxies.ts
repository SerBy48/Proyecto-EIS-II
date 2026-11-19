/**
 * Cuantos proxies hay delante del gateway (PROXIES_CONFIANZA):
 *
 *   1  nginx de la web (laboratorio y npm run prod:up)
 *   2  Caddy o el tunel de Cloudflare delante de nginx (despliegue en la nube,
 *      docker-compose.nube.yml)
 *
 * Express toma como IP del cliente la que esta ese numero de saltos atras en
 * X-Forwarded-For. Con 1 detras de Caddy, todas las personas compartirian la
 * IP de Caddy y un solo limite de inicios de sesion (10 por minuto para toda
 * la tienda). Con un numero mayor que los proxies reales, el cliente elegiria
 * su IP escribiendo X-Forwarded-For y se saltaria el limite: por eso solo se
 * aceptan enteros de 1 a 3 y cualquier otra cosa vuelve a 1.
 */
export const proxiesDeConfianza = (valor: string | undefined = process.env.PROXIES_CONFIANZA): number => {
  const n = Number(valor ?? 1);
  return Number.isInteger(n) && n >= 1 && n <= 3 ? n : 1;
};
