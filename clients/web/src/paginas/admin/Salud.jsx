import React, { useEffect, useState } from 'react';
import { BASE } from '../../servicios/api';

/**
 * Salud del sistema (solo administrador). Responde la pregunta 4 del analisis:
 * que servicio esta caido, que sigue funcionando y que hacer. Para cada
 * servicio dice que hace, que pasa en la tienda si cae y los pasos para
 * recuperarlo; para cada dependencia (bases, broker, correo), lo mismo.
 *
 * Los comandos son los del despliegue con Docker Compose del proyecto (los
 * nombres de servicio de docker-compose.yml).
 */

const SERVICIOS = {
  auth: {
    nombre: 'Autenticación',
    contenedor: 'auth-service',
    funcion: 'Inicio de sesión, registro, renovación de sesiones, recuperación de contraseña y cuentas internas.',
    impacto: 'Nadie puede iniciar sesión ni registrarse. Quien ya tiene sesión sigue comprando hasta que su token venza (15 min).'
  },
  clientes: {
    nombre: 'Clientes',
    contenedor: 'clientes-service',
    funcion: 'Perfiles y direcciones de envío.',
    impacto: 'No se pueden registrar clientes ni editar direcciones; el checkout falla porque no lee la dirección de envío.'
  },
  catalogo: {
    nombre: 'Catálogo',
    contenedor: 'catalogo-service',
    funcion: 'Productos, precios, ofertas, fotos y búsqueda.',
    impacto: 'La tienda no muestra productos. El carrito y el checkout usan la última respuesta conocida o fallan rápido (circuit breaker).'
  },
  inventario: {
    nombre: 'Inventario',
    contenedor: 'inventario-service',
    funcion: 'Stock por bodega, reservas, entradas de mercancía y proveedores.',
    impacto: 'No se pueden confirmar compras: sin reserva de stock la saga rechaza el checkout. El catálogo muestra "disponibilidad no verificada".'
  },
  carrito: {
    nombre: 'Carrito',
    contenedor: 'carrito-service',
    funcion: 'Carritos de compra en Redis, totales con IVA, envío y cupones.',
    impacto: 'Los clientes no pueden agregar productos ni pagar.'
  },
  pedidos: {
    nombre: 'Pedidos',
    contenedor: 'pedidos-service',
    funcion: 'Checkout (saga), ciclo de vida de los pedidos y límites de compra.',
    impacto: 'No hay ventas nuevas ni se pueden avanzar los pedidos. El asistente responde sin datos de pedidos.'
  },
  pagos: {
    nombre: 'Pagos',
    contenedor: 'pagos-service',
    funcion: 'Cobros y reembolsos contra la pasarela.',
    impacto: 'El checkout falla en el cobro y la saga libera las reservas: no se pierde stock ni se cobra dos veces.'
  },
  notificaciones: {
    nombre: 'Notificaciones',
    contenedor: 'notificaciones-service',
    funcion: 'Correos y campana, a partir de los eventos del broker.',
    impacto: 'La venta sigue. Los correos y avisos se acumulan en la cola y salen cuando el servicio vuelve.'
  },
  asistente: {
    nombre: 'Asistente virtual',
    contenedor: 'asistente-service',
    funcion: 'Chat de ayuda y consultas de los clientes al vendedor.',
    impacto: 'El chat y las consultas no responden; la compra no se ve afectada.'
  }
};

/** Dependencias: por prefijo del nombre que reporta /health. */
const DEPENDENCIAS = [
  {
    prefijo: 'postgres',
    nombre: 'PostgreSQL',
    contenedor: 'postgres',
    accion: 'Revisa que el contenedor postgres esté en ejecución y tenga espacio en disco; luego reinicia el servicio afectado.'
  },
  {
    prefijo: 'mongo',
    nombre: 'MongoDB',
    contenedor: 'mongo',
    accion: 'Revisa el contenedor mongo (memoria y disco). Bajo carga puede tardar en responder el chequeo y recuperarse solo.'
  },
  {
    prefijo: 'redis',
    nombre: 'Redis',
    contenedor: 'redis',
    accion: 'Reinicia redis. Los carritos viven en memoria: si el volumen se perdió, los clientes los arman de nuevo.'
  },
  {
    prefijo: 'rabbitmq',
    nombre: 'RabbitMQ (message broker)',
    contenedor: 'rabbitmq',
    accion: 'Reinicia rabbitmq; los servicios se reconectan solos. Revisa la consola (puerto 15672) por mensajes en las colas DLQ.'
  },
  {
    prefijo: 'correo',
    nombre: 'Servidor de correo (SMTP)',
    contenedor: 'mailpit',
    accion: 'Reinicia mailpit. Los envíos fallidos se reintentan desde la cola; los que agotan intentos quedan en la DLQ.'
  }
];

const dependencia = (nombre) => DEPENDENCIAS.find((d) => nombre.startsWith(d.prefijo));

const Comando = ({ children }) => (
  <code className="block mt-1 px-2 py-1 rounded bg-gray-100 text-gray-800 text-xs font-mono break-all">{children}</code>
);

export default function Salud() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [abierto, setAbierto] = useState(null);

  const cargar = async () => {
    try {
      // /api/health responde 503 cuando algo esta caido: eso no es un fallo de
      // la consulta, es la informacion que se busca. Se lee el cuerpo igual.
      const respuesta = await fetch(`${BASE}/health`);
      setDatos(await respuesta.json());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 10000);
    return () => clearInterval(intervalo);
  }, []);

  if (error) {
    return (
      <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
        <p className="font-semibold">No se pudo consultar la salud del sistema: {error}</p>
        <p className="mt-2">
          Si esto pasa, el que no responde es el API Gateway (o la red hasta él): sin gateway la tienda entera está fuera de línea. Revisa el contenedor
          y sus registros:
        </p>
        <Comando>docker compose ps api-gateway</Comando>
        <Comando>docker compose logs --tail 100 api-gateway</Comando>
        <Comando>docker compose restart api-gateway</Comando>
      </div>
    );
  }
  if (!datos) return <p role="status" className="text-gray-500">Consultando...</p>;

  const servicios = datos.servicios ?? [];
  const caidos = servicios.filter((s) => !s.ok);
  const degradados = servicios.filter((s) => s.ok && s.dependencias?.some((d) => !d.ok));

  const resumen = caidos.length
    ? { clase: 'bg-red-50 border-red-200 text-red-900', titulo: `${caidos.length} servicio(s) fuera de línea`, texto: 'Abre la tarjeta de cada uno para ver el impacto y los pasos de recuperación.' }
    : degradados.length
      ? { clase: 'bg-amber-50 border-amber-200 text-amber-900', titulo: 'Funcionando con avisos', texto: 'Algún servicio perdió una dependencia no crítica: la venta sigue, pero hay funciones en espera.' }
      : { clase: 'bg-green-50 border-green-200 text-green-900', titulo: 'Todo operativo', texto: `Los ${servicios.length} servicios y sus dependencias responden.` };

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Salud del sistema</h2>

      <div className={`rounded-xl border p-4 ${resumen.clase}`} role="status" aria-live="polite">
        <p className="font-bold">{resumen.titulo}</p>
        <p className="text-sm mt-1">{resumen.texto}</p>
        <p className="text-xs mt-2 opacity-80">
          Última verificación: {new Date(datos.hora).toLocaleTimeString('es-CO')} · se actualiza cada 10 s · el API Gateway responde
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {servicios.map((s) => {
          const info = SERVICIOS[s.servicio] ?? { nombre: s.servicio, contenedor: `${s.servicio}-service`, funcion: '', impacto: '' };
          const fallidas = (s.dependencias ?? []).filter((d) => !d.ok);
          const estado = !s.ok ? 'caido' : fallidas.length ? 'aviso' : 'ok';
          const colores = {
            ok: 'bg-green-50 border-green-200',
            aviso: 'bg-amber-50 border-amber-200',
            caido: 'bg-red-50 border-red-200'
          }[estado];
          const verDetalle = abierto === s.servicio || estado !== 'ok';
          return (
            <article key={s.servicio} className={`rounded-xl border p-4 flex flex-col ${colores}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{info.nombre}</h3>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    estado === 'ok' ? 'bg-green-100 text-green-900' : estado === 'aviso' ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900'
                  }`}
                >
                  {estado === 'ok' ? 'Operativo' : estado === 'aviso' ? 'Con avisos' : 'Fuera de línea'}
                </span>
              </div>
              <p className="text-xs text-gray-700 mt-1">{info.funcion}</p>

              {s.dependencias?.length > 0 && (
                <ul className="mt-3 space-y-1" aria-label={`Dependencias de ${info.nombre}`}>
                  {s.dependencias.map((d) => (
                    <li key={d.nombre} className="text-xs flex items-center gap-1.5 text-gray-700">
                      <span aria-hidden="true" className={d.ok ? 'text-green-700' : d.critica ? 'text-red-700' : 'text-amber-700'}>
                        {d.ok ? '●' : '○'}
                      </span>
                      <span className="truncate">{d.nombre}</span>
                      <span className={d.ok ? 'sr-only' : 'font-semibold'}>{d.ok ? ': conectada' : d.critica ? '(caída, crítica)' : '(caída, no crítica)'}</span>
                    </li>
                  ))}
                </ul>
              )}

              {verDetalle && (
                <div className="mt-3 pt-3 border-t border-black/10 text-xs text-gray-800 space-y-2">
                  {estado !== 'ok' && (
                    <p>
                      <span className="font-semibold">Impacto en la tienda: </span>
                      {estado === 'caido' ? info.impacto : 'La venta sigue; las funciones que usan la dependencia caída quedan en espera.'}
                    </p>
                  )}
                  <div>
                    <p className="font-semibold">Qué hacer</p>
                    <ol className="list-decimal ml-4 space-y-1 mt-1">
                      {fallidas.map((d) => (
                        <li key={d.nombre}>
                          {dependencia(d.nombre)?.accion ?? `Revisa la dependencia ${d.nombre}.`}
                          {dependencia(d.nombre) && <Comando>docker compose restart {dependencia(d.nombre).contenedor}</Comando>}
                        </li>
                      ))}
                      <li>
                        Revisa los registros del servicio:
                        <Comando>docker compose logs --tail 100 {info.contenedor}</Comando>
                      </li>
                      <li>
                        Si no se recupera solo, reinícialo:
                        <Comando>docker compose restart {info.contenedor}</Comando>
                      </li>
                      <li>Vuelve a esta vista: el estado se actualiza en 10 s. Si sigue caído, escala al equipo técnico con la hora y los registros.</li>
                    </ol>
                  </div>
                </div>
              )}

              {estado === 'ok' && (
                <button
                  onClick={() => setAbierto(abierto === s.servicio ? null : s.servicio)}
                  aria-expanded={abierto === s.servicio}
                  className="mt-3 self-start text-xs font-semibold text-marca-700 hover:underline"
                >
                  {abierto === s.servicio ? 'Ocultar' : 'Qué hacer si falla'}
                  <span className="sr-only"> {info.nombre}</span>
                </button>
              )}
            </article>
          );
        })}
      </div>

      <section aria-labelledby="salud-guia" className="bg-superficie border border-gray-200 rounded-xl p-5 text-sm text-gray-700 space-y-3">
        <h3 id="salud-guia" className="font-bold text-gray-900">
          Cómo leer esta vista
        </h3>
        <ul className="space-y-2">
          <li>
            <span className="font-semibold text-green-800">Operativo:</span> el servicio responde y todas sus dependencias están conectadas.
          </li>
          <li>
            <span className="font-semibold text-amber-800">Con avisos:</span> responde, pero perdió una dependencia no crítica (por ejemplo el
            message broker). La venta sigue; los eventos quedan pendientes y se procesan cuando se restablece.
          </li>
          <li>
            <span className="font-semibold text-red-800">Fuera de línea:</span> no responde o perdió su base de datos. Las funciones que dependen de él
            fallan rápido (circuit breaker) en lugar de dejar la página esperando.
          </li>
        </ul>
        <h3 className="font-bold text-gray-900 pt-2">Medidas generales</h3>
        <ol className="list-decimal ml-5 space-y-2">
          <li>
            Ver qué contenedores están arriba y cuáles se reiniciaron:
            <Comando>docker compose ps</Comando>
          </li>
          <li>
            Varios servicios caídos a la vez suelen ser una base de datos o el broker: revisa primero las dependencias que se repiten en las tarjetas.
          </li>
          <li>
            Correos que no llegan: revisa las colas en la consola de RabbitMQ (puerto 15672) y el buzón de Mailpit (puerto 8025). Los mensajes que agotaron
            sus intentos quedan en la DLQ y no se pierden.
          </li>
          <li>
            Levantar todo de nuevo sin borrar datos:
            <Comando>docker compose up -d</Comando>
          </li>
        </ol>
        <p className="text-xs text-gray-500">
          Detalle de la arquitectura y de la recuperación en el manual técnico (docs/manuales/MANUAL-TECNICO.md).
        </p>
      </section>
    </div>
  );
}
