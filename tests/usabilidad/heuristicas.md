# Evaluación heurística (Nielsen, 1994)

Inspección experta de la web (tienda y panel de administración) contra las **10 heurísticas de Nielsen**. Combina tres fuentes:

- **El recorrido automatizado** ([`recorrido.ts`](recorrido.ts)): las 8 tareas de [`tareas.md`](tareas.md) y 10 estados especiales (error, vacío, sesión, móvil, degradación), con capturas.
- **La lectura del código JSX** de cada pantalla (`clients/web/src/`), para los estados que no se ven a simple vista.
- **El análisis de accesibilidad** con axe-core.

Capturas en [`docs/evidencia/no-funcionales/usabilidad/capturas/`](../../docs/evidencia/no-funcionales/usabilidad/capturas/) y datos crudos en [`recorrido.json`](../../docs/evidencia/no-funcionales/usabilidad/recorrido.json).

**Escala de severidad de Nielsen**, que combina frecuencia, impacto y persistencia:

| Valor | Significado |
|---|---|
| 0 | No es un problema de usabilidad |
| 1 | Cosmético: se corrige si sobra tiempo |
| 2 | Menor: prioridad baja |
| 3 | Mayor: prioridad alta |
| 4 | Catástrofe: debe corregirse antes de publicar |

**Las 10 heurísticas:**
- H1 Visibilidad del estado del sistema
- H2 Coincidencia entre el sistema y el mundo real
- H3 Control y libertad del usuario
- H4 Consistencia y estándares
- H5 Prevención de errores
- H6 Reconocer antes que recordar
- H7 Flexibilidad y eficiencia de uso
- H8 Diseño estético y minimalista
- H9 Ayudar a reconocer, diagnosticar y recuperarse de errores
- H10 Ayuda y documentación

## Hallazgos

> **Estado tras la Fase 3:** U-01, U-02, U-03, U-04 y U-16 están **corregidos y verificados** (ver la sección 10 de [`USABILIDAD.md`](../../docs/calidad/USABILIDAD.md)). No queda ningún hallazgo de severidad 3 o 4. Esta tabla conserva la evaluación original.

| ID | Heurística | Pantalla | Problema | Sev. | Evidencia | Recomendación |
|---|---|---|---|---|---|---|
| **U-01** | H2, H4 | Inicio de sesión | El "correo" es un **desplegable con 4 cuentas de prueba** y la contraseña viene escrita. Ningún otro usuario puede entrar: ni Carla (cliente 3) ni las 300 cuentas de carga. Tampoco hay forma de registrarse. Es un atajo de demostración, pero en una tienda real nadie podría comprar | **4** | [`T1-formulario.png`](../../docs/evidencia/no-funcionales/usabilidad/capturas/T1-formulario.png) | Campo de correo (`type="email"`, `autocomplete="username"`) y contraseña vacía; las cuentas de prueba, como texto de ayuda |
| **U-02** | H6, H7 | Catálogo | Se muestran **20 de 71 productos** y no hay paginación ni "ver más": **51 productos solo se encuentran si se conoce su nombre** | **3** | E3, [`E3-catalogo-completo.png`](../../docs/evidencia/no-funcionales/usabilidad/capturas/E3-catalogo-completo.png) | Paginación o "Cargar más", con el total de resultados |
| **U-03** | H5 | Mis pedidos (detalle) | **Cancelar un pedido**, que es irreversible, se hace con **un solo clic** y sin confirmación. Al terminar, el modal se cierra sin un mensaje que confirme lo ocurrido | **3** | T6, [`T6-detalle.png`](../../docs/evidencia/no-funcionales/usabilidad/capturas/T6-detalle.png) | Paso de confirmación ("¿Cancelar el pedido PED-…? Esta acción no se puede deshacer") y aviso de éxito |
| **U-04** | H9, H1 | Mis pedidos (detalle) | Si la cancelación falla (por ejemplo, porque el pedido ya se despachó), **el mensaje de error queda detrás del velo del modal**, que sigue abierto con el mismo botón. El usuario cree que no pasó nada | **3** | E8, [`E8-error-tapado.png`](../../docs/evidencia/no-funcionales/usabilidad/capturas/E8-error-tapado.png): `elementFromPoint` sobre el mensaje devuelve el velo | Mostrar el error dentro del diálogo y actualizar el detalle con el estado real |
| **U-05** | H9, H3 | Carrito (cupón) | Un cupón inválido muestra "Cupon no encontrado." **arriba de la lista de productos, a 710 px del campo**. Un cupón válido no muestra confirmación: solo aparece una línea en el resumen. Y **no hay forma de quitar un cupón** aplicado, aunque la API lo permite | 2 | E5 y T4, [`E5-cupon-invalido.png`](../../docs/evidencia/no-funcionales/usabilidad/capturas/E5-cupon-invalido.png) | Mensaje junto al campo (`aria-describedby`), confirmación visible y botón "Quitar cupón" |
| **U-06** | H1, H9 | Toda la web | Cuando la sesión vence sin posibilidad de renovarse, aparece "La sesion expiro. Inicie sesion de nuevo." pero **la cabecera sigue mostrando la sesión abierta** con el botón Salir, y no se lleva al usuario al inicio de sesión | 2 | E7, [`E7-sesion-vencida.png`](../../docs/evidencia/no-funcionales/usabilidad/capturas/E7-sesion-vencida.png) | Ante `SESION_EXPIRADA`, limpiar el estado de React y mostrar el formulario de ingreso |
| **U-07** | H1, H2 | Catálogo | El aviso de "agregado" dice "**SKU-TEC-111 agregado al carrito**": muestra el código interno y no el nombre. Además aparece arriba de la página, fuera de la vista si el usuario bajó en la lista (la cuenta del carrito en la cabecera sí se actualiza) | 2 | T3, [`T3-aviso-agregado.png`](../../docs/evidencia/no-funcionales/usabilidad/capturas/T3-aviso-agregado.png) | "Portátil Volta Pro agregado al carrito" en un aviso flotante visible |
| **U-08** | H8, H2 | Carrito (pago) | El cliente ve controles de prueba: **"Token de la pasarela (pruebas)"** con opciones como "provoca timeout" o "falla la pasarela", y un texto técnico sobre la saga ("se reserva el stock, se cobra y solo entonces se descuenta el inventario") | 2 | [`T3-carrito.png`](../../docs/evidencia/no-funcionales/usabilidad/capturas/T3-carrito.png) | Mostrar el selector de token solo en modo de pruebas (`import.meta.env.DEV`) y explicar el pago en lenguaje de cliente |
| **U-09** | H3, H4 | Compra confirmada | "**Seguir comprando**" no lleva al catálogo: deja al usuario en el carrito, ahora vacío (`Carrito.jsx`, línea 118: `setResultado(null)`) | 2 | Código | Navegar al catálogo |
| **U-10** | H5, H1 | Carrito | Los botones − y + no se deshabilitan mientras se procesa el cambio. Cada clic calcula la cantidad a partir de un valor que puede estar desactualizado: dos clics rápidos en + dejan 2 en lugar de 3. El − con cantidad 1 elimina el producto sin aviso (su `aria-label` sí dice "Quitar") | 2 | Código (`Carrito.jsx`, líneas 191 a 210) | Deshabilitar durante la petición y confirmar o permitir deshacer al quitar |
| **U-11** | H2 | Catálogo | No hay vista de detalle del producto: la **descripción** que guarda el catálogo nunca se muestra, y para comparar solo hay nombre, marca y precio | 2 | Código (`Catalogo.jsx`) | Página o panel de detalle |
| **U-12** | H2, H5 | Administración (pedidos) | La tabla muestra el **id numérico** del cliente y no su nombre. "Marcar en preparación / enviado / entregado" cambia el estado sin confirmación y no se puede deshacer | 2 | T8, [`T8-pedido-en-preparacion.png`](../../docs/evidencia/no-funcionales/usabilidad/capturas/T8-pedido-en-preparacion.png) | Nombre del cliente y confirmación en las transiciones |
| **U-13** | H4 | Toda la web | Los textos de la interfaz están **sin tildes ni eñes**: "Contrasena", "Catalogo", "Iniciar sesion", "Envio", "Cupon", "Ultimas", "Que ocurrio". Afecta la credibilidad y la pronunciación de los lectores de pantalla ("contrasena") | 1 | Todas las capturas | Ortografía correcta en los textos visibles. La convención sin tildes es para los identificadores del código, no para la interfaz |
| **U-14** | H9, H3 | Catálogo y carrito | La búsqueda sin resultados no ofrece "limpiar filtros" ni sugerencias, y el carrito vacío no tiene un enlace al catálogo | 1 | E2 y E4 | Acción para salir del estado vacío |
| **U-15** | H1 | Carrito | Mientras se carga el carrito se muestra "Tu carrito esta vacio" en lugar de un indicador de carga (`carrito` es `null` hasta que responde la API) | 1 | Código (`Carrito.jsx`, línea 171) | Estado de carga |
| **U-16** | H1 | Catálogo | La búsqueda no indica cuántos resultados hay | 1 | T2 | "3 productos para «portátil»" |
| **U-17** | H8 | Catálogo | El producto "**Producto de evidencia inventario**" (SKU-EV-INV-001), que crea la suite `test:http`, aparece entre los productos que ve el cliente | 1 | [`E8-error-tapado.png`](../../docs/evidencia/no-funcionales/usabilidad/capturas/E8-error-tapado.png) | Que la suite lo desactive al terminar, como ya hace `test:seguridad` con sus productos |

**Resumen por severidad:** 1 catástrofe (4), 3 mayores (3), 8 menores (2) y 5 cosméticos (1).

| Heurística | Hallazgos |
|---|---|
| H1 Visibilidad del estado | U-04, U-06, U-07, U-10, U-15, U-16 |
| H2 Coincidencia con el mundo real | U-01, U-07, U-08, U-11, U-12 |
| H3 Control y libertad | U-05, U-09, U-14 |
| H4 Consistencia y estándares | U-01, U-09, U-13 |
| H5 Prevención de errores | U-03, U-10, U-12 |
| H6 Reconocer antes que recordar | U-02 |
| H7 Flexibilidad y eficiencia | U-02 |
| H8 Diseño minimalista | U-08, U-17 |
| H9 Recuperación de errores | U-04, U-05, U-06, U-14 |
| H10 Ayuda y documentación | Sin hallazgos propios. La tienda no tiene ayuda, pero las tareas no la necesitaron salvo en el caso del cupón (U-05) |

## Lo que la web hace bien

No todo son problemas. Estos puntos cumplen las heurísticas y conviene conservarlos:

- **El pago rechazado** (H9) es el mejor mensaje de error de la tienda: dice qué pasó, que **no hubo cobro**, que el pedido quedó cancelado, que el stock se liberó y que el carrito se conserva ([`T7-pago-rechazado.png`](../../docs/evidencia/no-funcionales/usabilidad/capturas/T7-pago-rechazado.png)).
- **La disponibilidad tiene tres estados** (H1, H2): "Disponible", "Últimas N unidades", "Agotado" (con el botón deshabilitado) y, si inventario cae, "Disponibilidad no verificada". La tienda no miente sobre el stock ([`E10-inventario-caido.png`](../../docs/evidencia/no-funcionales/usabilidad/capturas/E10-inventario-caido.png)).
- **Hay estados de carga** (H1): esqueletos en el catálogo, "Procesando la compra..." en el botón de pago y "Verificando..." en el login.
- **La compra confirmada** muestra el número de pedido y el total, y avisa que el correo puede tardar.
- **La accesibilidad está trabajada**: enlace "Saltar al contenido", región `aria-live`, etiquetas en todos los campos, textos alternativos para lectores de pantalla en los botones de cada producto, y foco gestionado en el modal (se cierra con Escape). axe no encontró ninguna regla WCAG 2.2 AA incumplida en 13 pantallas.
- **Es adaptable**: en 390 px la grilla pasa a una columna, sin desplazamiento horizontal ([`E9-movil-catalogo.png`](../../docs/evidencia/no-funcionales/usabilidad/capturas/E9-movil-catalogo.png)).
- **El doble clic en Pagar no duplica pedidos**, gracias a la clave de idempotencia (H5).
