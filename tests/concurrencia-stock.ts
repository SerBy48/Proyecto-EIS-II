/**
 * Prueba de concurrencia sobre el inventario.
 *
 * Verifica la pregunta 5 del analisis del documento: que dos clientes NO puedan
 * comprar simultaneamente la ultima unidad disponible.
 *
 * Ataca directamente la funcion reservar_stock de PostgreSQL, sin pasar por la
 * API, para aislar el mecanismo de concurrencia del resto del sistema. Si esta
 * prueba pasa, la sobreventa es imposible por construccion: no depende de que
 * el codigo de aplicacion recuerde comprobar algo.
 *
 * Escenarios:
 *   1. Dos compradores, una unidad      -> exactamente uno gana
 *   2. Veinte compradores, cinco unidades -> exactamente cinco ganan
 *   3. Reintento con la misma clave     -> no descuenta dos veces (idempotencia)
 *   4. Reserva liberada                 -> la unidad vuelve a estar disponible
 *   5. Reserva confirmada               -> el descuento es definitivo
 *
 * Uso: npm run test:concurrencia
 */
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL_INVENTARIO ||
    `postgresql://inventario_user:inventario_pass@localhost:${process.env.POSTGRES_PUERTO_HOST || 5432}/inventario_db`,
  max: 30
});

const VERDE = '\u001b[32m';
const ROJO = '\u001b[31m';
const AZUL = '\u001b[36m';
const GRIS = '\u001b[90m';
const FIN = '\u001b[0m';

let fallos = 0;

const afirmar = (condicion: boolean, descripcion: string, detalle?: unknown): void => {
  if (condicion) {
    console.log(`  ${VERDE}PASA${FIN}  ${descripcion}`);
  } else {
    fallos += 1;
    console.log(`  ${ROJO}FALLA${FIN} ${descripcion}`);
    if (detalle !== undefined) console.log(`        ${GRIS}${JSON.stringify(detalle)}${FIN}`);
  }
};

const titulo = (texto: string): void => {
  console.log(`\n${AZUL}${texto}${FIN}`);
  console.log(GRIS + '-'.repeat(texto.length) + FIN);
};

/** Deja un SKU con la cantidad exacta que la prueba necesita. */
const prepararStock = async (sku: string, cantidad: number): Promise<void> => {
  await pool.query(
    `UPDATE stock SET cantidad_disponible = $2, cantidad_reservada = 0, version = version + 1
      WHERE sku = $1`,
    [sku, cantidad]
  );
  await pool.query(`DELETE FROM reservas WHERE sku = $1`, [sku]);
};

const disponible = async (sku: string): Promise<number> => {
  const { rows } = await pool.query(
    `SELECT SUM(cantidad_disponible)::INT AS d FROM stock WHERE sku = $1`,
    [sku]
  );
  return rows[0]?.d ?? 0;
};

const reservado = async (sku: string): Promise<number> => {
  const { rows } = await pool.query(
    `SELECT SUM(cantidad_reservada)::INT AS r FROM stock WHERE sku = $1`,
    [sku]
  );
  return rows[0]?.r ?? 0;
};

interface Resultado {
  resultado: string;
  reserva_id: string | null;
  disponible: number;
}

const intentarReserva = async (
  sku: string,
  cantidad: number,
  clave: string
): Promise<Resultado> => {
  const { rows } = await pool.query<Resultado>(
    `SELECT * FROM reservar_stock($1, $2, $3, $4, 15, 'prueba-concurrencia')`,
    [sku, cantidad, clave, `pedido-${clave.slice(0, 8)}`]
  );
  return rows[0];
};

// ===========================================================================

const escenario1 = async (): Promise<void> => {
  titulo('Escenario 1: dos compradores, una sola unidad');

  const SKU = 'SKU-TEC-004';
  await prepararStock(SKU, 1);

  console.log(`  ${GRIS}Stock inicial de ${SKU}: 1 unidad${FIN}`);
  console.log(`  ${GRIS}Ana y Bruno pulsan "Comprar" en el mismo instante...${FIN}`);

  // Promise.all lanza ambas consultas sin esperar la primera: llegan al motor
  // practicamente a la vez, que es lo que se quiere reproducir.
  const [ana, bruno] = await Promise.all([
    intentarReserva(SKU, 1, `ana-${randomUUID()}`),
    intentarReserva(SKU, 1, `bruno-${randomUUID()}`)
  ]);

  const ganadores = [ana, bruno].filter((r) => r.resultado === 'reservado');
  const perdedores = [ana, bruno].filter((r) => r.resultado === 'sin_stock');

  console.log(`  ${GRIS}Ana:   ${ana.resultado}${FIN}`);
  console.log(`  ${GRIS}Bruno: ${bruno.resultado}${FIN}`);

  afirmar(ganadores.length === 1, 'Exactamente un comprador obtiene la unidad', {
    ana: ana.resultado,
    bruno: bruno.resultado
  });
  afirmar(perdedores.length === 1, 'El otro comprador recibe sin_stock');
  afirmar((await disponible(SKU)) === 0, 'El stock disponible queda en 0, nunca negativo');
  afirmar((await reservado(SKU)) === 1, 'Hay exactamente 1 unidad reservada');

  const { rows } = await pool.query(
    `SELECT COUNT(*)::INT AS n FROM reservas WHERE sku = $1 AND estado = 'activa'`,
    [SKU]
  );
  afirmar(rows[0].n === 1, 'Se creo una sola reserva activa', rows[0]);
};

const escenario2 = async (): Promise<void> => {
  titulo('Escenario 2: veinte compradores, cinco unidades');

  const SKU = 'SKU-TEC-002';
  const UNIDADES = 5;
  const COMPRADORES = 20;
  await prepararStock(SKU, UNIDADES);

  console.log(`  ${GRIS}Stock inicial: ${UNIDADES} unidades. Compradores simultaneos: ${COMPRADORES}${FIN}`);

  const resultados = await Promise.all(
    Array.from({ length: COMPRADORES }, (_, i) =>
      intentarReserva(SKU, 1, `comprador-${i}-${randomUUID()}`)
    )
  );

  const exitosos = resultados.filter((r) => r.resultado === 'reservado').length;
  const rechazados = resultados.filter((r) => r.resultado === 'sin_stock').length;

  console.log(`  ${GRIS}Reservas concedidas: ${exitosos} | rechazadas: ${rechazados}${FIN}`);

  afirmar(exitosos === UNIDADES, `Se conceden exactamente ${UNIDADES} reservas`, { exitosos });
  afirmar(rechazados === COMPRADORES - UNIDADES, 'El resto se rechaza por falta de stock', { rechazados });
  afirmar((await disponible(SKU)) === 0, 'El stock disponible queda en 0');
  afirmar((await reservado(SKU)) === UNIDADES, `Quedan ${UNIDADES} unidades reservadas`);
};

const escenario3 = async (): Promise<void> => {
  titulo('Escenario 3: idempotencia ante un reintento');

  const SKU = 'SKU-TEC-006';
  await prepararStock(SKU, 10);

  const clave = `reintento-${randomUUID()}`;

  const primera = await intentarReserva(SKU, 3, clave);
  const tras1 = await disponible(SKU);

  // Mismo caso que un timeout de red: pedidos no recibio la respuesta y
  // reintenta con la misma clave de idempotencia.
  const segunda = await intentarReserva(SKU, 3, clave);
  const tras2 = await disponible(SKU);

  console.log(`  ${GRIS}Primera llamada: ${primera.resultado} (disponible: ${tras1})${FIN}`);
  console.log(`  ${GRIS}Reintento:       ${segunda.resultado} (disponible: ${tras2})${FIN}`);

  afirmar(primera.resultado === 'reservado', 'La primera llamada reserva');
  afirmar(segunda.resultado === 'idempotente', 'El reintento se reconoce como idempotente');
  afirmar(primera.reserva_id === segunda.reserva_id, 'Devuelve la MISMA reserva, no una nueva');
  afirmar(tras1 === 7 && tras2 === 7, 'El stock se descuenta una sola vez (10 -> 7)', { tras1, tras2 });

  const { rows } = await pool.query(
    `SELECT COUNT(*)::INT AS n FROM reservas WHERE clave_idempotencia = $1`,
    [clave]
  );
  afirmar(rows[0].n === 1, 'Existe una sola fila de reserva para esa clave');
};

const escenario4 = async (): Promise<void> => {
  titulo('Escenario 4: compensacion de la saga (pago rechazado)');

  const SKU = 'SKU-TEC-004';
  await prepararStock(SKU, 1);

  console.log(`  ${GRIS}Stock: 1 unidad. Ana reserva, pero su pago es rechazado.${FIN}`);

  const reserva = await intentarReserva(SKU, 1, `ana-rechazo-${randomUUID()}`);
  afirmar(reserva.resultado === 'reservado', 'Ana reserva la ultima unidad');
  afirmar((await disponible(SKU)) === 0, 'Mientras paga, el producto figura agotado');

  // Un segundo comprador no puede llevarsela durante la reserva.
  const bruno = await intentarReserva(SKU, 1, `bruno-espera-${randomUUID()}`);
  afirmar(bruno.resultado === 'sin_stock', 'Bruno no puede comprarla mientras esta reservada');

  // El pago falla: la saga ejecuta la compensacion.
  const { rows } = await pool.query(`SELECT liberar_reserva($1, 'saga_compensada') AS r`, [
    reserva.reserva_id
  ]);
  console.log(`  ${GRIS}Compensacion: ${rows[0].r}${FIN}`);

  afirmar(rows[0].r === 'liberada', 'La reserva se libera');
  afirmar((await disponible(SKU)) === 1, 'La unidad vuelve a estar disponible', {
    disponible: await disponible(SKU)
  });
  afirmar((await reservado(SKU)) === 0, 'No queda nada reservado');

  // Ahora Bruno si puede comprarla.
  const brunoSegundoIntento = await intentarReserva(SKU, 1, `bruno-ok-${randomUUID()}`);
  afirmar(
    brunoSegundoIntento.resultado === 'reservado',
    'Bruno ya puede comprar la unidad liberada'
  );

  // La compensacion es idempotente: reintentarla no duplica unidades.
  const doble = await pool.query(`SELECT liberar_reserva($1, 'saga_compensada') AS r`, [
    reserva.reserva_id
  ]);
  afirmar(doble.rows[0].r === 'ya_liberada', 'Liberar dos veces no devuelve stock de mas');
};

const escenario5 = async (): Promise<void> => {
  titulo('Escenario 5: confirmacion tras un pago aprobado');

  const SKU = 'SKU-TEC-009';
  await prepararStock(SKU, 4);

  const reserva = await intentarReserva(SKU, 2, `confirma-${randomUUID()}`);
  afirmar(reserva.resultado === 'reservado', 'Se reservan 2 de 4 unidades');
  afirmar((await disponible(SKU)) === 2, 'Quedan 2 disponibles');
  afirmar((await reservado(SKU)) === 2, 'Hay 2 reservadas');

  const { rows } = await pool.query(`SELECT confirmar_reserva($1) AS r`, [reserva.reserva_id]);
  console.log(`  ${GRIS}Confirmacion: ${rows[0].r}${FIN}`);

  afirmar(rows[0].r === 'confirmada', 'La reserva se confirma');
  afirmar((await disponible(SKU)) === 2, 'El disponible NO cambia al confirmar (ya se habia descontado)');
  afirmar((await reservado(SKU)) === 0, 'Las unidades salen de reservado: descuento definitivo');

  const movimientos = await pool.query(
    `SELECT tipo FROM movimientos WHERE sku = $1 ORDER BY id DESC LIMIT 2`,
    [SKU]
  );
  const tipos = movimientos.rows.map((m) => m.tipo);
  afirmar(tipos.includes('salida'), 'Se registro un movimiento de salida', tipos);

  const doble = await pool.query(`SELECT confirmar_reserva($1) AS r`, [reserva.reserva_id]);
  afirmar(doble.rows[0].r === 'ya_confirmada', 'Confirmar dos veces es idempotente');
};

const escenario6 = async (): Promise<void> => {
  titulo('Escenario 6: el stock nunca puede quedar negativo');

  const SKU = 'SKU-TEC-008';
  await prepararStock(SKU, 2);

  // Se pide mas de lo que hay: debe rechazarse limpiamente, no dejar -3.
  const excesiva = await intentarReserva(SKU, 5, `excesiva-${randomUUID()}`);
  afirmar(excesiva.resultado === 'sin_stock', 'Una reserva mayor al stock se rechaza');
  afirmar((await disponible(SKU)) === 2, 'El stock permanece intacto tras el rechazo');

  // Aunque alguien intentara forzar el UPDATE, el CHECK de la tabla lo impide.
  let violado = false;
  try {
    await pool.query(
      `UPDATE stock SET cantidad_disponible = -1 WHERE sku = $1`,
      [SKU]
    );
  } catch {
    violado = true;
  }
  afirmar(violado, 'La restriccion CHECK de la base impide un stock negativo directo');
};

// ===========================================================================

const principal = async (): Promise<void> => {
  console.log(`${AZUL}=======================================================${FIN}`);
  console.log(`${AZUL} Prueba de concurrencia del servicio de inventario${FIN}`);
  console.log(`${AZUL} Pregunta 5 del analisis: evitar la sobreventa${FIN}`);
  console.log(`${AZUL}=======================================================${FIN}`);

  try {
    await pool.query('SELECT 1');
  } catch (error) {
    console.error(
      `\n${ROJO}No fue posible conectar a inventario_db.${FIN}\n` +
        `Levante la infraestructura con: npm run infra:up\n` +
        `Detalle: ${error instanceof Error ? error.message : error}\n`
    );
    process.exit(1);
  }

  await escenario1();
  await escenario2();
  await escenario3();
  await escenario4();
  await escenario5();
  await escenario6();

  console.log('');
  if (fallos === 0) {
    console.log(`${VERDE}Todas las comprobaciones pasaron: la sobreventa es imposible.${FIN}\n`);
  } else {
    console.log(`${ROJO}${fallos} comprobacion(es) fallaron.${FIN}\n`);
  }

  await pool.end();
  process.exit(fallos === 0 ? 0 : 1);
};

void principal();
