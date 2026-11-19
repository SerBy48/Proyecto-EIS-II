# 7. Conclusiones, lecciones aprendidas y trabajo futuro

## 7.1 Conclusiones

1. **La arquitectura resuelve los tres problemas del escenario y lo demuestra con mediciones:**
   - **Sobreventa:** no la hay, ni con 20 compradores simultáneos por las últimas 5 unidades.
   - **Despliegues acoplados:** cada servicio tiene su base y su ciclo de despliegue.
   - **Saturación global:** un servicio caído no tumba a los demás. Con inventario detenido el catálogo siguió respondiendo, y con notificaciones detenido no se perdió ni una compra ni un evento.
2. **La corrección no depende de un solo mecanismo, sino de reglas que se cumplen en todas partes:**
   - el inventario es el único dueño del stock;
   - el precio lo pone el catálogo;
   - el `cliente_id` sale del token;
   - la idempotencia es obligatoria;
   - un pago aprobado nunca se compensa hacia atrás.

   Están escritas como invariantes y cada una tiene su prueba.
3. **La calidad se midió y se corrigió con la misma prueba que encontró cada problema.** No queda ningún hallazgo crítico abierto. Los que quedan son de capacidad (auth y el checkout desde 100 usuarios, que cumplen en el límite) y de acabado de la interfaz.
4. **El asistente virtual agrega valor sin agregar riesgo.** Es el endpoint más barato del sistema (p95 de 36 ms). Acierta el 91,7 % de las intenciones en el conjunto de evaluación y el 100 % en las frases de la tienda. Nunca muestra datos ajenos, porque consulta con la identidad del usuario.
5. **El sistema es reproducible.** Se levanta con un comando, el CI lo verifica completo en cada cambio y los 29 criterios de aceptación pasan en la interfaz real. El despliegue en la nube queda listo para una máquina virtual, a falta solo de la cuenta del proveedor.

## 7.2 Lecciones aprendidas

- **Medir antes de optimizar.** El cuello de botella del login no era la base de datos ni el ORM, sino bcrypt en el hilo principal de Node. Un pool de hilos con cola acotada multiplicó su capacidad por 2,5; ninguna intuición lo habría señalado.
- **Las pruebas con fallos inyectados ven lo que la carga normal no ve.** El circuit breaker en semiabierto dejaba pasar todas las peticiones (R7). Solo apareció al detener inventario en plena carga.
- **Un valor por defecto es una vulnerabilidad.** El hallazgo más grave (CVSS 9,8) no estaba en el código de negocio, sino en un secreto de respaldo publicado en el repositorio.
- **Las pruebas automáticas no reemplazan al usuario.** Las revisiones del equipo encontraron problemas que ninguna suite buscaba:
  - un filtro que pasaba de una cuenta a otra;
  - una consulta al vendedor sin nadie a quien responder;
  - un formulario que aceptaba letras en el teléfono.

  Cada hallazgo se convirtió en un criterio de aceptación.
- **La documentación como código envejece mejor.** La especificación, los diagramas, la OpenAPI y los manuales viven en el repositorio, y pruebas como `test:openapi` o la de paridad de validaciones fallan si se desalinean con el código. Este mismo informe se genera a partir de ellos.

## 7.3 Trabajo futuro

Tabla: Trabajo futuro, en orden de valor

| Mejora | Motivo |
|---|---|
| Crear la máquina virtual y publicar la tienda con su dominio | Todo está preparado (capítulo 6.3 y manual técnico, capítulo 16) |
| Escalar horizontalmente auth y pedidos | El login y el checkout desde 100 usuarios están en el límite de su meta |
| Refresh token en cookie `HttpOnly` con protección CSRF | Cierra el riesgo aceptado S-09 |
| Aplicar el SUS y la prueba con evaluadores | Falta la voz de los usuarios reales |
| *Transactional outbox* para los eventos | Hoy un evento publicado con RabbitMQ caído se registra pero no se reenvía |
| Métricas para Prometheus, trazas distribuidas y alertas | Hoy hay `request_id` propagado y salud agregada, que es el mínimo |
| Migraciones versionadas de las bases | Hoy cambiar un esquema exige recrear los volúmenes |
| Caché del catálogo en Redis y paginación por cursor | Reducir la carga en MongoDB y los listados largos |
| Pasarela de pagos real (Wompi o Stripe) | Solo cambia el adaptador `pasarela.ts` |
| Separar el panel de administración de la tienda | Despliegue y permisos independientes si crecen |

# Referencias

- Brown, S. *The C4 model for visualising software architecture*. <https://c4model.com>
- Richardson, C. (2018). *Microservices Patterns*. Manning. Catálogo de patrones en <https://microservices.io>
- Garcia-Molina, H. y Salem, K. (1987). Sagas. *Proceedings of the ACM SIGMOD International Conference on Management of Data*, 249–259.
- Nygard, M. (2011). *Documenting Architecture Decisions*. <https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions>
- Nygard, M. (2018). *Release It! Design and Deploy Production-Ready Software* (2.ª ed.). Pragmatic Bookshelf. (Circuit breaker y tiempos máximos.)
- OWASP Foundation (2025). *OWASP Top 10:2025*. <https://owasp.org/Top10/>
- FIRST (2019). *Common Vulnerability Scoring System v3.1: Specification Document*. <https://www.first.org/cvss/v3.1/specification-document>
- PCI Security Standards Council (2022). *Payment Card Industry Data Security Standard v4.0*.
- Grafana Labs. *k6 documentation*. <https://grafana.com/docs/k6/latest/>
- OWASP. *Zed Attack Proxy (ZAP)*. <https://www.zaproxy.org/docs/>
- Nielsen, J. (1994). *Usability Engineering*. Morgan Kaufmann. (Heurísticas y escala de severidad.)
- Wharton, C., Rieman, J., Lewis, C. y Polson, P. (1994). The cognitive walkthrough method: a practitioner's guide. En J. Nielsen y R. Mack (eds.), *Usability Inspection Methods*. Wiley.
- Card, S., Moran, T. y Newell, A. (1983). *The Psychology of Human-Computer Interaction*. Lawrence Erlbaum. (Keystroke-Level Model.)
- Brooke, J. (1996). SUS: a "quick and dirty" usability scale. En *Usability Evaluation in Industry*. Taylor & Francis.
- W3C (2023). *Web Content Accessibility Guidelines (WCAG) 2.2*. <https://www.w3.org/TR/WCAG22/>
- Documentación oficial de las tecnologías: Node.js, Express, TypeScript, Drizzle ORM, PostgreSQL, MongoDB, Redis, RabbitMQ, React, Vite, Docker Compose, Caddy, Playwright y Vitest.
