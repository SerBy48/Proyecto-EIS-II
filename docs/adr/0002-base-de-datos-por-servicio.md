# ADR-0002: Base de datos por servicio y motor por necesidad

**Estado:** Aceptada.

## Contexto

Con una base compartida, cualquier servicio puede escribir el stock, y la sobreventa vuelve. Además, un cambio de esquema obliga a coordinar despliegues (pregunta 3 del análisis).

Los datos tienen formas distintas:
- transacciones con bloqueos: stock, pedidos y pagos;
- documentos con atributos variables: productos y plantillas;
- datos efímeros: carritos.

## Decisión

- **Cada servicio es dueño exclusivo de sus datos.** Los demás acceden solo por su API. Inventario es el único que escribe el stock (invariante 3).
- **Cada servicio tiene su propio usuario de base de datos.** Por ejemplo, `auth_user` solo puede conectarse a `auth_db` (`infra/postgres/00-bases.sql`, `infra/mongo/init-mongo.js`). Así el aislamiento lo garantiza el motor, no la disciplina de cada equipo.
- **El motor se elige según la necesidad:**
  - PostgreSQL para auth, clientes, inventario, pedidos y pagos;
  - MongoDB para catálogo, notificaciones y el asistente;
  - Redis con TTL para el carrito.
- En el laboratorio, las 5 bases PostgreSQL comparten una instancia, y las de Mongo otra. En producción pueden separarse sin tocar código, porque cada servicio solo conoce su cadena de conexión.

## Consecuencias

- ✅ No hay acceso cruzado entre bases; `test:http` lo verifica en sus casos de aislamiento de las bases.
- ✅ Cada esquema evoluciona con su servicio.
- ❌ No hay JOIN entre servicios. El historial de clientes se alimenta por eventos (consistencia eventual), y el pedido guarda una copia del precio y del nombre del producto.
- ❌ Hay más motores que operar y respaldar.

## Alternativas descartadas

- **Una base compartida con un esquema por servicio.** El aislamiento dependería de los permisos de cada esquema y del cuidado de cada equipo, y los despliegues seguirían acoplados.
- **Todo en PostgreSQL.** Es viable con JSONB, pero el carrito es más simple en Redis, que trae el TTL nativo, y el catálogo es más simple en un motor documental.
