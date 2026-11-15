/**
 * Perfiles de carga (Paso 2.1.2). Se eligen con -e PERFIL=humo|carga|estres|pico.
 *
 *   humo    1-2 VU, 30 s        el script funciona; linea base sin carga
 *   carga   0->50 VU en 1 min, 3 min sostenido, 30 s de bajada   hora pico esperada
 *   estres  escalones 50->100->200->300 VU, 2 min cada uno        punto de quiebre
 *   pico    10 -> 300 VU en 10 s, 1 min, y bajada                 "dia sin IVA"
 *
 * Modelo cerrado (ramping-vus): cada VU es un usuario que espera 1 s entre
 * acciones. La duracion de los escalones se puede acortar con ESCALON (p. ej.
 * ESCALON=1m) sin tocar el script.
 */
const escalon = __ENV.ESCALON || '2m';

export const PERFILES = {
  humo: {
    executor: 'constant-vus',
    vus: 2,
    duration: __ENV.DURACION || '30s'
  },
  carga: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 50 },
      { duration: '3m', target: 50 },
      { duration: '30s', target: 0 }
    ],
    gracefulRampDown: '10s'
  },
  estres: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '20s', target: 50 },
      { duration: escalon, target: 50 },
      { duration: '20s', target: 100 },
      { duration: escalon, target: 100 },
      { duration: '20s', target: 200 },
      { duration: escalon, target: 200 },
      { duration: '20s', target: 300 },
      { duration: escalon, target: 300 },
      { duration: '30s', target: 0 }
    ],
    gracefulRampDown: '15s'
  },
  pico: {
    executor: 'ramping-vus',
    startVUs: 10,
    stages: [
      { duration: '20s', target: 10 },
      { duration: '10s', target: 300 },
      { duration: '1m', target: 300 },
      { duration: '10s', target: 10 },
      { duration: '30s', target: 10 },
      { duration: '10s', target: 0 }
    ],
    gracefulRampDown: '15s'
  }
};

export const perfilActual = () => {
  const nombre = __ENV.PERFIL || 'humo';
  const perfil = PERFILES[nombre];
  if (!perfil) throw new Error(`PERFIL desconocido: ${nombre}. Use ${Object.keys(PERFILES).join(', ')}`);
  return { nombre, perfil };
};

/**
 * Opciones comunes. Los umbrales son los criterios de aceptacion del plan;
 * cada escenario agrega el de latencia de su endpoint. En estres y pico se
 * espera que algun umbral falle (es lo que se busca): k6 termina con codigo 99
 * pero el resumen se exporta igual.
 */
export const opciones = (umbralesExtra = {}) => {
  const { nombre, perfil } = perfilActual();
  return {
    scenarios: { [nombre]: perfil },
    thresholds: {
      http_req_failed: ['rate<0.01'],
      checks: ['rate>0.99'],
      ...umbralesExtra
    },
    summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
    discardResponseBodies: false,
    tags: { perfil: nombre }
  };
};
