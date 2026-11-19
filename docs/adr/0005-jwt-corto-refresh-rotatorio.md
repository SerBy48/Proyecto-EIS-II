# ADR-0005: JWT de vida corta + refresh token rotatorio

**Estado:** Aceptada. Revisada después de la evaluación de seguridad: los secretos pasaron a ser obligatorios (hallazgo S-02).

## Contexto

Con microservicios, consultar una sesión central en cada petición convierte a auth en un cuello de botella. Pero un token sin estado no se puede revocar antes de que expire.

## Decisión

- **Access token JWT de 15 minutos**, firmado con `JWT_SECRET`. El gateway lo valida una sola vez y escribe `x-usuario-id`, `x-usuario-rol` y `x-cliente-id` para los servicios.
- **Refresh token de 7 días, rotatorio.** Cada uso emite uno nuevo y revoca el anterior. Se guarda en `auth_db`, así que el cierre de sesión revoca la sesión de verdad.
- **Secretos obligatorios, sin valor por defecto** (`verificarSecretos()`, invariante 13). Deben tener al menos 32 caracteres y no pueden coincidir con ningún valor que haya estado publicado.
- **Autorización por rol** con `requiereRol`, y **a nivel de dato**: el `cliente_id` sale del token (invariante 1).

## Consecuencias

- ✅ El gateway valida el token sin llamar a auth en cada petición.
- ✅ Un token robado sirve como máximo 15 minutos.
- ❌ Un cambio de rol tarda hasta 15 minutos en reflejarse.
- ❌ **Riesgo aceptado S-09.** En la web, el token vive en `localStorage`. Lo mitiga la CSP estricta ([`SEGURIDAD.md`](../calidad/SEGURIDAD.md), sección 9.4).

## Alternativas descartadas

- **Sesiones en el servidor (Redis).** La revocación es inmediata, pero cada petición tiene que consultar el almacén de sesiones.
- **JWT de larga duración sin refresh.** No se puede revocar.
- **OAuth2/OIDC con un proveedor externo (Keycloak).** Es lo correcto en una empresa grande, pero desproporcionado para el laboratorio.
