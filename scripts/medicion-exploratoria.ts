/**
 * Medicion exploratoria del Paso 1.2: latencia SIN concurrencia de los
 * endpoints candidatos a criticos, para confirmarlos o descartarlos con datos
 * antes de disenar la carga (la caracterizacion bajo carga es el Modulo 1, k6).
 *
 * 30 peticiones secuenciales por endpoint, con el sistema ya poblado
 * (npm run sembrar:carga). Usa cuentas carga061..carga090 para no tocar el
 * historial de las que tienen pedidos sembrados.
 *
 * Uso: npx tsx scripts/medicion-exploratoria.ts
 */

const API = `${process.env.URL_GATEWAY || 'http://localhost:8080'}/api`;
const N = 30;

const llamar = async (ruta: string, init: RequestInit = {}) => {
  const inicio = performance.now();
  const r = await fetch(`${API}${ruta}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) }
  });
  const cuerpo = await r.json().catch(() => null);
  return { ms: performance.now() - inicio, estado: r.status, cuerpo: cuerpo as any };
};

const percentil = (v: number[], p: number) => {
  const o = [...v].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.ceil((p / 100) * o.length) - 1)];
};

const resumir = (nombre: string, muestras: Array<{ ms: number; estado: number }>) => {
  const ms = muestras.map((m) => m.ms);
  const estados = muestras.reduce<Record<number, number>>((a, m) => ((a[m.estado] = (a[m.estado] ?? 0) + 1), a), {});
  const r = (x: number) => x.toFixed(1).padStart(7);
  return `${nombre.padEnd(44)} n=${String(ms.length).padEnd(3)} prom=${r(ms.reduce((a, b) => a + b, 0) / ms.length)}  p50=${r(percentil(ms, 50))}  p95=${r(percentil(ms, 95))}  max=${r(Math.max(...ms))} ms  estados=${JSON.stringify(estados)}`;
};

const correo = (i: number) => `carga${String(61 + (i % 30)).padStart(3, '0')}@correo.co`;
const terminos = ['portatil', 'cafetera', 'bicicleta', 'monitor', 'licuadora', 'mancuernas'];

const principal = async () => {
  const lineas: string[] = [];
  const medir = async (nombre: string, fn: (i: number) => Promise<{ ms: number; estado: number }>) => {
    await fn(0); // calentamiento: la primera llamada incluye conexiones y JIT
    const muestras = [];
    for (let i = 0; i < N; i++) muestras.push(await fn(i));
    lineas.push(resumir(nombre, muestras));
  };

  await medir('GET  /catalogo/productos (sin filtro)', () => llamar('/catalogo/productos'));
  await medir('GET  /catalogo/productos?q=<termino>', (i) => llamar(`/catalogo/productos?q=${terminos[i % terminos.length]}`));
  await medir('GET  /catalogo/productos/:sku', () => llamar('/catalogo/productos/SKU-TEC-001'));
  await medir('GET  /catalogo/categorias', () => llamar('/catalogo/categorias'));
  await medir('POST /auth/login (bcrypt)', (i) =>
    llamar('/auth/login', { method: 'POST', body: JSON.stringify({ email: correo(i), password: 'Password123' }) })
  );

  // Sesiones para las rutas autenticadas.
  const sesiones = [];
  for (let i = 0; i < N; i++) {
    const s = await llamar('/auth/login', { method: 'POST', body: JSON.stringify({ email: correo(i), password: 'Password123' }) });
    sesiones.push({ token: s.cuerpo.token as string, cliente: s.cuerpo.usuario.cliente_id as number });
  }
  const auth = (i: number) => ({ Authorization: `Bearer ${sesiones[i].token}` });

  await medir('GET  /pedidos (cliente)', (i) => llamar('/pedidos', { headers: auth(i) }));
  await medir('POST /carrito/:id/items', (i) =>
    llamar(`/carrito/${sesiones[i].cliente}/items`, { method: 'POST', headers: auth(i), body: JSON.stringify({ sku: 'SKU-TEC-001', cantidad: 1 }) })
  );
  await medir('GET  /carrito/:id', (i) => llamar(`/carrito/${sesiones[i].cliente}`, { headers: auth(i) }));

  // Checkout: cada iteracion compra con su propia sesion y su propio carrito.
  const muestrasCheckout = [];
  for (let i = 0; i < N; i++) {
    await llamar(`/carrito/${sesiones[i].cliente}/items`, {
      method: 'POST', headers: auth(i), body: JSON.stringify({ sku: 'SKU-HOG-001', cantidad: 1 })
    });
    muestrasCheckout.push(
      await llamar('/pedidos/checkout', {
        method: 'POST',
        headers: { ...auth(i), 'Idempotency-Key': `exploratoria-${Date.now()}-${i}` },
        body: JSON.stringify({ medio_pago: 'tarjeta_credito', token_medio_pago: 'tok_ok_1234' })
      })
    );
  }
  lineas.push(resumir('POST /pedidos/checkout (saga, tok_ok)', muestrasCheckout));

  console.log(`Medicion exploratoria sin concurrencia - ${new Date().toISOString()} - ${API}`);
  console.log(`${N} peticiones secuenciales por endpoint, tras 1 de calentamiento. Tiempos de extremo a extremo vistos por el cliente.\n`);
  for (const l of lineas) console.log(l);
};

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
