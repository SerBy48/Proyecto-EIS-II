/**
 * Comprobacion rapida de salud de todo el sistema.
 *
 * Es lo primero que conviene ejecutar tras levantar la infraestructura: dice en
 * diez segundos si los diez servicios y sus motores de datos estan en
 * pie, y cual falla si algo no arranco.
 *
 * Uso: npm run test:salud
 */

const GATEWAY = process.env.URL_GATEWAY || 'http://localhost:8080';

const VERDE = '\u001b[32m';
const ROJO = '\u001b[31m';
const AMARILLO = '\u001b[33m';
const AZUL = '\u001b[36m';
const GRIS = '\u001b[90m';
const FIN = '\u001b[0m';

interface Dependencia {
  nombre: string;
  ok: boolean;
  critica: boolean;
}

interface EstadoServicio {
  servicio: string;
  ok: boolean;
  estado: string;
  dependencias?: Dependencia[];
}

const principal = async (): Promise<void> => {
  console.log(`\n${AZUL}Salud del sistema${FIN}  ${GRIS}${GATEWAY}${FIN}\n`);

  let respuesta: Response;
  try {
    respuesta = await fetch(`${GATEWAY}/api/health`, {
      signal: AbortSignal.timeout(15000)
    });
  } catch (error) {
    console.error(`${ROJO}El API Gateway no responde en ${GATEWAY}.${FIN}`);
    console.error(`${GRIS}${error instanceof Error ? error.message : error}${FIN}\n`);
    console.error('Levante el sistema con:');
    console.error('  npm run infra:up     (postgres, mongo, redis, rabbitmq)');
    console.error('  npm run dev          (los diez servicios)\n');
    process.exitCode = 1;
    return;
  }

  const datos = (await respuesta.json()) as {
    servicios: EstadoServicio[];
    servicios_caidos: string[];
  };

  const ancho = Math.max(...datos.servicios.map((s) => s.servicio.length)) + 2;

  for (const servicio of datos.servicios) {
    const marca = servicio.ok ? `${VERDE}OK  ${FIN}` : `${ROJO}CAIDO${FIN}`;
    console.log(`  ${marca} ${servicio.servicio.padEnd(ancho)} ${GRIS}${servicio.estado}${FIN}`);

    for (const dependencia of servicio.dependencias ?? []) {
      const estado = dependencia.ok
        ? `${VERDE}conectado${FIN}`
        : dependencia.critica
          ? `${ROJO}sin conexion${FIN}`
          : `${AMARILLO}sin conexion (no critica)${FIN}`;
      console.log(`         ${GRIS}└─ ${dependencia.nombre.padEnd(ancho + 4)}${FIN} ${estado}`);
    }
  }

  console.log('');

  if (datos.servicios_caidos.length === 0) {
    console.log(`${VERDE}Los ${datos.servicios.length + 1} servicios (gateway incluido) responden. El sistema esta listo.${FIN}`);
    console.log(`${GRIS}Siguiente paso: npm run test:e2e${FIN}\n`);
    return;
  }

  console.log(`${ROJO}Servicios con problemas: ${datos.servicios_caidos.join(', ')}${FIN}`);
  console.log(`${GRIS}Revise los registros con: docker compose logs -f <servicio>${FIN}\n`);
  process.exitCode = 1;
};

void principal();
