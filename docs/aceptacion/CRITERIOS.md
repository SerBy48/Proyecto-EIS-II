# Criterios de aceptación

Trabajo Final, Fase 5 (CA-01 a CA-12) y ajustes de SerByTek, F5b (CA-13 a CA-18). Un criterio por historia principal, en formato **Dado / Cuando / Entonces**, derivado de los requisitos de [`01-escenario-requisitos.md`](../especificacion/01-escenario-requisitos.md).

Cada criterio se verifica en dos capas que se complementan:
- **E2E de interfaz**: `npm run test:e2e:ui`, que usa Playwright contra la web en contenedor.
- **E2E de API**: `npm run test:e2e`, más las suites `test:http` y `test:asistente`.

La [matriz de trazabilidad](TRAZABILIDAD.md) une cada requisito con su criterio, su caso de prueba y su resultado.

| ID | Historia | Dado | Cuando | Entonces |
|---|---|---|---|---|
| **CA-01** | Registro | un visitante sin cuenta | crea una cuenta con nombre, correo, contraseña y dirección con departamento y ciudad | queda con la sesión iniciada (su correo aparece en la cabecera) y puede comprar sin agregar nada más |
| **CA-02** | Inicio de sesión | un cliente registrado | inicia sesión con una contraseña incorrecta y luego con la correcta | ve «Credenciales invalidas.» la primera vez y entra la segunda |
| **CA-03** | Búsqueda y filtro | el catálogo de tecnología con 10 secciones | busca «portátil» y elige la sección Computadores | solo ve productos de Computadores relacionados con la búsqueda |
| **CA-04** | Carrito y cupón | un cliente con sesión | agrega un producto y aplica el cupón BIENVENIDA10 | el resumen muestra la línea de descuento y el total baja |
| **CA-05** | Compra aprobada | un carrito con productos y una tarjeta que la pasarela aprueba | paga | ve «Compra confirmada» con un número de pedido, el carrito queda vacío y el pedido aparece pagado en «Mis pedidos» |
| **CA-06** | Compra rechazada con compensación | un carrito y una tarjeta que la pasarela rechaza | paga | ve que no se hizo ningún cobro, el pedido queda cancelado y **el stock del producto vuelve a su valor anterior** |
| **CA-07** | Última unidad | un producto con una sola unidad en el carrito de dos clientes | los dos pagan, uno detrás del otro | el primero compra; el segundo recibe un mensaje de stock insuficiente y no se le cobra |
| **CA-08** | Cancelación | un pedido pagado del cliente | lo cancela desde «Mis pedidos» y confirma | el pedido pasa a cancelado y se informa el reembolso |
| **CA-09** | Correo de confirmación | una compra aprobada | el sistema procesa el evento `pedido.confirmado` | llega al buzón del cliente (Mailpit) un correo con el número del pedido |
| **CA-10** | Asistente | un visitante y luego un cliente con sesión | preguntan por el costo del envío y «¿Hay audífonos disponibles?», piden el estado de su pedido y el de un pedido ajeno | el envío se responde con la cifra configurada; la pregunta compuesta responde «Sí, tenemos N productos en Audio» con sus tarjetas; el cliente ve **su** pedido y, del ajeno, «No encontré el pedido» |
| **CA-11** | Vendedor: entrada de stock | un vendedor con sesión | registra 10 unidades de un SKU | ve la confirmación y el stock del SKU aumenta en 10 |
| **CA-12** | Administrador: estado y bitácora | un administrador con sesión y un pedido pagado | lo marca en preparación y abre su bitácora | el pedido queda en preparación y la bitácora muestra los pasos de la saga, de `validar_cliente` a `confirmar_reserva` |
| **CA-13** | Perfil y direcciones | un cliente con sesión | cambia su teléfono, agrega una dirección en Bogotá D.C. y la marca como predeterminada | ve la confirmación de cada paso y la API devuelve el teléfono nuevo y la dirección nueva como predeterminada |
| **CA-14** | Dirección al pagar y después | un cliente con un producto en el carrito | agrega una dirección en Cali desde el carrito, paga y luego cambia dos veces la dirección del pedido | el pedido sale con la dirección de Cali; tras dos cambios la web dice «Ya usaste los 2 cambios» y un tercer cambio por la API recibe 409 |
| **CA-15** | Eliminar la cuenta | un cliente con un pedido pagado | abre «Mi perfil»; luego cancela el pedido y elimina la cuenta con su contraseña | primero ve el botón bloqueado con el número del pedido; después la cuenta se elimina, la sesión se cierra, el correo ya no inicia sesión y el perfil queda anonimizado |
| **CA-16** | Modo oscuro y contraseña visible | un visitante | activa el modo oscuro, recarga, y en el inicio de sesión pulsa el ojo | el tema oscuro sigue tras recargar; la contraseña aparece en claro y el botón cambia a «Ocultar contraseña» |
| **CA-17** | Administrador: usuarios | un administrador con sesión | crea un vendedor desde «Usuarios» y luego lo desactiva | el vendedor nuevo inicia sesión con su rol; una vez desactivado, ya no puede |
| **CA-18** | Sesión vencida (H-F5-02) | un navegador con una sesión que el servidor ya no acepta | abre la tienda y usa el chat | ve «Tu sesión expiró», el botón «Iniciar sesión» y el chat le responde como visitante, sin «no está disponible» |

## Notas

- **CA-07 en la interfaz es secuencial.** La disputa simultánea de 20 compradores por 5 unidades la prueba `test:concurrencia` contra la función `reservar_stock`, y la de dos clientes por la última unidad de `SKU-TEC-004`, el escenario C de `test:e2e`.
- **Los datos de los criterios se preparan por la API**, a través del mismo origen de la web: stock, pedidos pagados y carritos vacíos. Así cada criterio empieza en un estado conocido y la interfaz se usa solo para la acción que se acepta.
