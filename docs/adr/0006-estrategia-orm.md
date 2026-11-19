# ADR-0006: ORM parcial con Drizzle; SQL nativo donde hay concurrencia

**Estado:** Aceptada por el equipo el 2026-11-15, opción (a) del plan. Implementada en la Fase 2: `esquema.ts` y `repositorio.ts` en auth y clientes, y `errorDePostgres()` en shared, porque Drizzle envuelve los errores del driver.

## Contexto

El enunciado del Trabajo Final evalúa el "uso de ORM". El proyecto usa los drivers `pg` y `mongodb` directamente, con SQL parametrizado (invariante 8).

La protección contra la sobreventa vive en la función de PostgreSQL `reservar_stock` (`infra/postgres/03-inventario.sql`). Esa función combina:
- un descuento condicional;
- una columna `version`;
- `pg_advisory_xact_lock` por SKU;
- idempotencia.

Un ORM ocultaría esos bloqueos o los haría ineficientes.

Además, los servicios corren con `tsx` sin paso de compilación, y la imagen `infra/Dockerfile.servicio` es mínima.

## Decisión

**Se adopta Drizzle ORM de forma parcial, eligiendo la herramienta adecuada para cada contexto:**

- **Drizzle en `auth-service` y `clientes-service`**, que son CRUD simple: usuarios, refresh tokens, perfiles, direcciones e historial.
  - Drizzle se monta sobre el `Pool` que ya crea `crearPool()`.
  - El esquema tipado vive en `src/esquema.ts` y **refleja** el SQL de `01-auth.sql` y `02-clientes.sql`.
  - Los controladores dejan el SQL embebido y llaman a un `src/repositorio.ts` (patrón *Repository*).
- **Los scripts SQL de `infra/` siguen siendo la única fuente del esquema.** No se usa `drizzle-kit push`, para no tener dos fuentes que puedan divergir.
- **Inventario, pedidos y pagos se quedan con SQL nativo parametrizado.** Ahí están las operaciones de concurrencia y la saga.
- **MongoDB** (catálogo, notificaciones, asistente) sigue con el driver nativo, sin Mongoose.

## Consecuencias

- ✅ Hay consultas tipadas y patrón *Repository* en los servicios donde el ORM aporta, sin tocar la lógica anti-sobreventa verificada por `test:concurrencia`.
- ✅ Drizzle es TypeScript puro: no genera código ni trae binarios de motor, así que encaja con `tsx` y con `Dockerfile.servicio`.
- ✅ El contrato se conserva: mismos códigos HTTP y mismas formas de respuesta, con `test:http` como verificación.
- ❌ Conviven dos estilos de acceso a datos. Queda documentado aquí y en el manual técnico.
- ❌ El esquema de Drizzle debe mantenerse sincronizado a mano con el SQL. Lo cubren las pruebas de integración y las unitarias de los repositorios.

## Alternativas descartadas

- **(b) ORM en los cinco servicios PostgreSQL, salvo `reservar_stock`.** Más trabajo y más riesgo de regresión en la saga y los pagos, sin una ganancia proporcional: esas operaciones son pocas, críticas y ya están probadas.
- **(c) Sin ORM, solo con justificación.** Es técnicamente defendible, pero deja sin cubrir un criterio explícito de la rúbrica.
- **Prisma.** Genera código y trae un binario del motor de consultas, lo que choca con la ejecución vía `tsx` y complica la imagen.
- **TypeORM.** Se apoya en decoradores y metadatos, y su gestión de transacciones con bloqueos explícitos es menos transparente.
