# Rutas de la API

<!-- Generado por scripts/informes/generar-trabajo-final.ts: no editar a mano. -->

Tabla: Rutas públicas del gateway (75 operaciones)

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/api/health` | pública | Salud agregada de todos los servicios |
| POST | `/api/auth/registro` | pública | Registrar una cuenta de cliente |
| POST | `/api/auth/login` | pública | Iniciar sesion |
| POST | `/api/auth/renovar` | pública | Renovar la sesion con el refresh token |
| POST | `/api/auth/recuperar` | pública | Pedir un enlace para restablecer la contrasena (RF-54) |
| POST | `/api/auth/restablecer` | pública | Crear la contrasena nueva con el enlace del correo (RF-54) |
| POST | `/api/auth/logout` | sesion | Cerrar sesion |
| GET | `/api/auth/perfil` | sesion | Perfil del usuario autenticado |
| POST | `/api/auth/verificar` | sesion | Verificar el token actual |
| GET | `/api/auth/usuarios` | administrador | Listar usuarios |
| POST | `/api/auth/usuarios` | administrador | Crear un usuario interno |
| PATCH | `/api/auth/usuarios/{id}` | administrador | Cambiar el rol o desactivar un usuario |
| DELETE | `/api/auth/cuenta` | cliente | Eliminar la propia cuenta |
| POST | `/api/clientes` | pública | Crear el perfil de cliente |
| GET | `/api/clientes/{id}` | sesion | Consultar un perfil |
| PATCH | `/api/clientes/{id}` | sesion | Actualizar los datos personales (nombre, apellido, telefono, documento) |
| GET | `/api/clientes/departamentos` | pública | Departamentos de Colombia |
| GET | `/api/clientes/{id}/direcciones` | sesion | Listar direcciones |
| POST | `/api/clientes/{id}/direcciones` | sesion | Agregar una direccion |
| PATCH | `/api/clientes/{id}/direcciones/{direccionId}` | sesion | Editar una direccion o marcarla como predeterminada |
| DELETE | `/api/clientes/{id}/direcciones/{direccionId}` | sesion | Eliminar una direccion |
| GET | `/api/clientes/{id}/historial` | sesion | Historial de compras |
| GET | `/api/catalogo/productos` | pública | Buscar y filtrar productos |
| POST | `/api/catalogo/productos` | administrador, vendedor | Crear un producto |
| GET | `/api/catalogo/productos/{sku}` | pública | Detalle de un producto |
| PATCH | `/api/catalogo/productos/{sku}` | administrador, vendedor | Actualizar un producto |
| GET | `/api/catalogo/categorias` | pública | Categorias con su conteo y precio minimo |
| GET | `/api/catalogo/promociones/{codigo}` | sesion | Consultar un cupon |
| GET | `/api/catalogo/productos/{sku}/historial-precios` | administrador, vendedor | Historial de cambios de precio y oferta de un producto |
| POST | `/api/catalogo/productos/{sku}/imagenes` | administrador, vendedor | Subir una foto del producto |
| DELETE | `/api/catalogo/productos/{sku}/imagenes/{id}` | administrador, vendedor | Quitar una foto subida |
| GET | `/api/catalogo/imagenes/{nombre}` | pública | Foto de un producto |
| GET | `/api/inventario/disponibilidad` | sesion | Disponibilidad de varios SKU |
| GET | `/api/inventario/stock/{sku}` | sesion | Stock de un SKU por bodega |
| POST | `/api/inventario/stock/{sku}/entrada` | administrador, vendedor | Registrar una entrada de mercancia |
| GET | `/api/inventario/movimientos/{sku}` | administrador, vendedor | Libro de movimientos de un SKU |
| GET | `/api/inventario/alertas` | administrador, vendedor | SKU por debajo del stock minimo |
| GET | `/api/inventario/entradas` | administrador, vendedor | Historial de entradas de mercancia |
| GET | `/api/inventario/proveedores` | administrador, vendedor | Proveedores |
| POST | `/api/inventario/proveedores` | administrador, vendedor | Crear un proveedor |
| PATCH | `/api/inventario/proveedores/{id}` | administrador, vendedor | Editar o desactivar un proveedor |
| GET | `/api/carrito/{clienteId}` | sesion | Ver el carrito con sus totales |
| DELETE | `/api/carrito/{clienteId}` | sesion | Vaciar el carrito |
| POST | `/api/carrito/{clienteId}/items` | sesion | Agregar un producto |
| PATCH | `/api/carrito/{clienteId}/items/{sku}` | sesion | Cambiar la cantidad de un producto |
| DELETE | `/api/carrito/{clienteId}/items/{sku}` | sesion | Quitar un producto |
| POST | `/api/carrito/{clienteId}/cupon` | sesion | Aplicar un cupon |
| DELETE | `/api/carrito/{clienteId}/cupon` | sesion | Quitar el cupon |
| POST | `/api/pedidos/checkout` | cliente, administrador, vendedor | Comprar el carrito (saga de checkout) |
| GET | `/api/pedidos` | sesion | Listar pedidos |
| GET | `/api/pedidos/limites` | cliente, administrador, vendedor | Cuanto puede llevar el cliente de cada producto |
| GET | `/api/pedidos/{id}` | sesion | Detalle de un pedido |
| GET | `/api/pedidos/{id}/saga` | administrador | Bitacora de la saga de un pedido |
| POST | `/api/pedidos/{id}/cancelar` | sesion | Cancelar un pedido |
| PATCH | `/api/pedidos/{id}/estado` | administrador, vendedor | Cambiar el estado de un pedido |
| PATCH | `/api/pedidos/{id}/direccion` | cliente | Cambiar la direccion de envio de un pedido |
| GET | `/api/pagos/transacciones` | sesion | Listar transacciones |
| GET | `/api/pagos/transacciones/{referencia}` | sesion | Detalle de una transaccion |
| GET | `/api/notificaciones/mensajes` | sesion | Notificaciones enviadas |
| GET | `/api/notificaciones/bandeja` | sesion | Bandeja de la campana de la web |
| POST | `/api/notificaciones/bandeja/leidas` | sesion | Marcar notificaciones como leidas |
| GET | `/api/notificaciones/plantillas` | administrador | Plantillas de notificacion |
| PATCH | `/api/notificaciones/plantillas/{clave}` | administrador | Editar una plantilla |
| POST | `/api/asistente/mensajes` | pública | Enviar un mensaje al asistente |
| GET | `/api/asistente/conversaciones/{id}` | sesion | Consultar una conversacion |
| GET | `/api/asistente/tickets` | administrador, vendedor | Tickets de las consultas al vendedor (desde F5e el visitante no crea tickets, primero inicia sesion) |
| POST | `/api/asistente/consultas` | cliente | Enviar una consulta al vendedor |
| GET | `/api/asistente/consultas` | cliente, administrador, vendedor | Consultas al vendedor |
| GET | `/api/asistente/consultas/{numero}` | cliente, administrador, vendedor | Una consulta con su hilo |
| PATCH | `/api/asistente/consultas/{numero}` | administrador, vendedor | Cerrar o reabrir una consulta |
| POST | `/api/asistente/consultas/{numero}/mensajes` | cliente, administrador, vendedor | Responder en el hilo de una consulta |
| GET | `/api/asistente/intenciones` | administrador | Intenciones del motor de reglas |
| PATCH | `/api/asistente/intenciones/{clave}` | administrador | Editar una intencion (sin desplegar) |
| GET | `/api/asistente/faq` | administrador | Respuestas a preguntas frecuentes |
| PATCH | `/api/asistente/faq/{clave}` | administrador | Editar una respuesta frecuente (sin desplegar) |
