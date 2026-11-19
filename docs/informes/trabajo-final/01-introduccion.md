# 1. Introducción

## 1.1 Objetivo general

Diseñar, construir, asegurar la calidad y desplegar una plataforma de comercio electrónico de alta concurrencia con arquitectura de microservicios, que incluya un asistente virtual, y validarla con pruebas automáticas y criterios de aceptación medibles.

## 1.2 Objetivos específicos por fase

Tabla: Fases del Trabajo Final y sus entregables

| Fase | Objetivo | Entregables |
|---|---|---|
| 1. Análisis y diseño arquitectónico | Modelar el escenario, los requisitos y la arquitectura | Especificación, modelo C4, 10 decisiones de arquitectura (ADR) |
| 2. Construcción del núcleo | Implementar los servicios con patrones limpios, ORM, JWT e integraciones externas | MVP, especificación OpenAPI con Swagger UI, scripts de base de datos, pruebas unitarias |
| 3. Asistente virtual | Agregar un asistente que atienda a los clientes sin exponer datos ajenos | asistente-service, chat en la web, métricas de acierto |
| 4. Aseguramiento de calidad | Medir rendimiento, seguridad y usabilidad, y corregir lo encontrado | Informe con métricas, gráficas, matriz de calidad y correcciones verificadas |
| 5. Despliegue y validación final | Contenerizar, automatizar las pruebas y validar con el usuario | Perfiles de despliegue, CI, criterios de aceptación con E2E de interfaz, manuales |

## 1.3 Alcance

- Tienda de una sola empresa (SerByTek): el vendedor es personal interno, no un comerciante externo.
- Catálogo de 60 productos de tecnología de marcas reales en 10 secciones, con fotos, ofertas con fecha de fin y límite de compra por cliente.
- Tres roles: cliente, vendedor y administrador; además, el visitante sin sesión.
- Pasarela de pagos **simulada** con resultados deterministas (aprobado, rechazado, error técnico y respuesta lenta). La plataforma nunca recibe ni guarda datos de tarjeta.
- Correo real por SMTP: Mailpit en el laboratorio y Gmail en producción.

## 1.4 Limitaciones

- **Un solo equipo de medición.** Las pruebas de carga generan la carga en la misma máquina que corre los contenedores: las cifras absolutas son cotas conservadoras, válidas para comparar escenarios y para el antes y el después. El escalado horizontal (RNF-06) no se midió.
- **Sin evaluadores externos.** El cuestionario SUS y la prueba con usuarios pensando en voz alta están preparados (`tests/usabilidad/`), pero no se aplicaron. La usabilidad se evaluó con inspección experta: recorrido cognitivo, KLM, heurísticas de Nielsen y accesibilidad automatizada. No se simuló ningún dato humano.
- **Despliegue en la nube sin URL.** La configuración está lista y verificada en local (capítulo 6). No se pudo abrir la cuenta del proveedor a tiempo. La tienda se publica con un túnel de Cloudflare durante la demostración.

## 1.5 Metodología

- **Repositorio.** Monorepo con npm workspaces en GitHub (<https://github.com/SerBy48/Proyecto-EIS-II>).
- **Ramas.** Cada fase o ajuste se desarrolló en una rama `feature/…` que sale de `develop`, con un pull request revisado por el equipo; `main` recibe las versiones estables.
- **Regresión.** Antes de cada pull request se corrió la regresión completa desde volúmenes vacíos, con su evidencia en `docs/evidencia/`. El anexo A lista los 21 pull requests.
- **Decisiones.** Las de arquitectura se registraron como ADR. Las de alcance las tomó el equipo antes de implementar.
- **Fuente única.** Los documentos del repositorio (especificación, calidad, aceptación y manuales) son la fuente de este informe: se generó a partir de ellos (`npm run informe:trabajo-final`).
