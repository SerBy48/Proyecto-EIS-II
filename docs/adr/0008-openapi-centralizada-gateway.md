# ADR-0008: Documentación OpenAPI centralizada en el gateway

**Estado:** Aceptada. Implementada en la Fase 2: 36 rutas publicas (43 operaciones) y 9 internas; `test:openapi` hace 313 comprobaciones.

## Contexto

Los clientes (web, móvil, terceros) solo ven el gateway. Hoy existe `docs/openapi/openapi.yaml`, una especificación **mínima** con 45 rutas, creada para que OWASP ZAP conociera la superficie de la API en el escaneo activo. Le faltan:
- los esquemas de respuesta;
- un sitio donde consultarla;
- una verificación de que no se desalinea del código.

## Decisión

- **Una especificación OpenAPI 3 de la API pública del gateway** en `docs/openapi/openapi.yaml`, dividida con `$ref` en `rutas/*.yaml` y `componentes/*.yaml`. Incluye:
  - el esquema `bearerAuth`;
  - el error uniforme `{ mensaje, codigo }`;
  - la cabecera `Idempotency-Key`;
  - las respuestas 401, 403, 404, 409 y 429.
- **Las rutas internas** (`/precio`, `/validar`, `/reservas`, `/cobros`) van en una especificación aparte, `openapi-interna.yaml`, que no se expone.
- **Swagger UI servido por el gateway** en `GET /api/docs` y `GET /api/docs/openapi.json`. Se agregan a `RUTAS_PUBLICAS`, y la variable `EXPONER_DOCS=false` los apaga en producción.
- **Validación:**
  - `@redocly/cli lint`, que no debe reportar errores;
  - `npm run test:openapi`, que falla si hay rutas de los routers sin documentar o rutas documentadas que no existen.

## Consecuencias

- ✅ Hay un solo punto de consulta para quien integra con la plataforma.
- ✅ La misma especificación alimenta el escaneo de ZAP de la Fase 4.
- ✅ La desalineación entre el código y la documentación se detecta en las pruebas.
- ❌ La especificación se mantiene a mano. Es la alternativa a generarla desde anotaciones, que no se adoptó.

## Alternativas descartadas

- **Una especificación y un Swagger UI por servicio.** Expone la topología interna y repite los componentes comunes.
- **Generarla desde anotaciones JSDoc o decoradores.** Llena los routers de comentarios y depende de una herramienta más; con `test:openapi`, la especificación escrita a mano queda igual de verificada.
