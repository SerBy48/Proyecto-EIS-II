# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 0 |
| Low | 1 |
| Informational | 3 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Medium | Exceeded High | http://host.docker.internal:8080 | Percentage of responses with status code 4xx | 62 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of responses with status code 2xx | 37 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with content type application/json | 100 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method DELETE | 2 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method GET | 62 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method PATCH | 5 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method POST | 29 % |
| Info | Informational | http://host.docker.internal:8080 | Count of total endpoints | 127    |
| Info | Informational | http://host.docker.internal:8080 | Percentage of slow responses | 1 % |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| Timestamp Disclosure - Unix | Low | 2 |
| A Client Error response code was returned by the server | Informational | 110 |
| Authentication Request Identified | Informational | 3 |
| Non-Storable Content | Informational | Systemic |




## Alert Detail



### [ Timestamp Disclosure - Unix ](https://www.zaproxy.org/docs/alerts/10096/)



##### Low (Low)

### Description

A timestamp was disclosed by the application/web server. - Unix

* URL: http://host.docker.internal:8080/api/auth/verificar
  * Node Name: `http://host.docker.internal:8080/api/auth/verificar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `1794775924`
  * Other Info: `1794775924, which evaluates to: 2026-11-15 20:52:04.`
* URL: http://host.docker.internal:8080/api/auth/verificar
  * Node Name: `http://host.docker.internal:8080/api/auth/verificar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `1794776824`
  * Other Info: `1794776824, which evaluates to: 2026-11-15 21:07:04.`


Instances: 2

### Solution

Manually confirm that the timestamp data is not sensitive, and that the data cannot be aggregated to disclose exploitable patterns.

### Reference


* [ https://cwe.mitre.org/data/definitions/200.html ](https://cwe.mitre.org/data/definitions/200.html)


#### CWE Id: [ 497 ](https://cwe.mitre.org/data/definitions/497.html)


#### WASC Id: 13

#### Source ID: 3

### [ A Client Error response code was returned by the server ](https://www.zaproxy.org/docs/alerts/100000/)



##### Informational (High)

### Description

A response code of 401 was returned by the server.
This may indicate that the application is failing to handle unexpected input correctly.
Raised by the 'Alert on HTTP Response Code Error' script

* URL: http://host.docker.internal:8080/3023652083057555212
  * Node Name: `http://host.docker.internal:8080/3023652083057555212`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api
  * Node Name: `http://host.docker.internal:8080/api`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/
  * Node Name: `http://host.docker.internal:8080/api/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/2926023330872586613
  * Node Name: `http://host.docker.internal:8080/api/2926023330872586613`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth
  * Node Name: `http://host.docker.internal:8080/api/auth`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/
  * Node Name: `http://host.docker.internal:8080/api/auth/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/3155005913552963184
  * Node Name: `http://host.docker.internal:8080/api/auth/3155005913552963184`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/actuator/health
  * Node Name: `http://host.docker.internal:8080/api/auth/actuator/health`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito
  * Node Name: `http://host.docker.internal:8080/api/carrito`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/
  * Node Name: `http://host.docker.internal:8080/api/carrito/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/3809119653344960517
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/3809119653344960517`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/checkout
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/checkout`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/items
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/items`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/items/
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/items/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/items/6493986140101510993
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/items/6493986140101510993`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo
  * Node Name: `http://host.docker.internal:8080/api/catalogo`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/
  * Node Name: `http://host.docker.internal:8080/api/catalogo/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/7456823840956434125
  * Node Name: `http://host.docker.internal:8080/api/catalogo/7456823840956434125`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/productos/4684824055522424228
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos/4684824055522424228`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/productos/SKU-TEC-001/7698759799948565512
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos/SKU-TEC-001/7698759799948565512`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/promociones
  * Node Name: `http://host.docker.internal:8080/api/catalogo/promociones`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/promociones/
  * Node Name: `http://host.docker.internal:8080/api/catalogo/promociones/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/promociones/8201617337669397778
  * Node Name: `http://host.docker.internal:8080/api/catalogo/promociones/8201617337669397778`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes
  * Node Name: `http://host.docker.internal:8080/api/clientes`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/
  * Node Name: `http://host.docker.internal:8080/api/clientes/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1/4244765340486275471
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/4244765340486275471`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1/validar%3Fdireccion_id=http%253A%252F%252Fwww.google.com%252F
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/validar (direccion_id)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/326166899638608641
  * Node Name: `http://host.docker.internal:8080/api/clientes/326166899638608641`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario
  * Node Name: `http://host.docker.internal:8080/api/inventario`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/
  * Node Name: `http://host.docker.internal:8080/api/inventario/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/4629253703785592915
  * Node Name: `http://host.docker.internal:8080/api/inventario/4629253703785592915`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/disponibilidad%3F=
  * Node Name: `http://host.docker.internal:8080/api/inventario/disponibilidad`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/disponibilidad%3Fskus=
  * Node Name: `http://host.docker.internal:8080/api/inventario/disponibilidad (skus)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/disponibilidad/
  * Node Name: `http://host.docker.internal:8080/api/inventario/disponibilidad/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/movimientos
  * Node Name: `http://host.docker.internal:8080/api/inventario/movimientos`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/movimientos/
  * Node Name: `http://host.docker.internal:8080/api/inventario/movimientos/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/8867411597638474445
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/8867411597638474445`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/7151186284106852975
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/7151186284106852975`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/stock
  * Node Name: `http://host.docker.internal:8080/api/inventario/stock`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/stock/
  * Node Name: `http://host.docker.internal:8080/api/inventario/stock/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/stock/3032019985555500815
  * Node Name: `http://host.docker.internal:8080/api/inventario/stock/3032019985555500815`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/stock/SKU-TEC-001/5537068806316672706
  * Node Name: `http://host.docker.internal:8080/api/inventario/stock/SKU-TEC-001/5537068806316672706`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/notificaciones
  * Node Name: `http://host.docker.internal:8080/api/notificaciones`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/notificaciones/
  * Node Name: `http://host.docker.internal:8080/api/notificaciones/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/notificaciones/1148948767439312273
  * Node Name: `http://host.docker.internal:8080/api/notificaciones/1148948767439312273`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/notificaciones/plantillas/2035054609537037436
  * Node Name: `http://host.docker.internal:8080/api/notificaciones/plantillas/2035054609537037436`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos
  * Node Name: `http://host.docker.internal:8080/api/pagos`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/
  * Node Name: `http://host.docker.internal:8080/api/pagos/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/4594684819019574613
  * Node Name: `http://host.docker.internal:8080/api/pagos/4594684819019574613`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/transacciones/5386178495694031305
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/5386178495694031305`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001/
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001/6640749849790535878
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001/6640749849790535878`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos%3Festado=%2500
  * Node Name: `http://host.docker.internal:8080/api/pedidos (estado)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/1
  * Node Name: `http://host.docker.internal:8080/api/pedidos/1`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/1/
  * Node Name: `http://host.docker.internal:8080/api/pedidos/1/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/1/7173451378245018947
  * Node Name: `http://host.docker.internal:8080/api/pedidos/1/7173451378245018947`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/1321024558607549327
  * Node Name: `http://host.docker.internal:8080/api/pedidos/1321024558607549327`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/items/SKU-TEC-001
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/items/SKU-TEC-001 ()({cantidad})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/items/SKU-TEC-001
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/items/SKU-TEC-001 ()({cantidad})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/items/SKU-TEC-001/
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/items/SKU-TEC-001/ ()({cantidad})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1
  * Node Name: `http://host.docker.internal:8080/api/clientes/1 ()({telefono})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/1/estado
  * Node Name: `http://host.docker.internal:8080/api/pedidos/1/estado ()({estado})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/1/estado
  * Node Name: `http://host.docker.internal:8080/api/pedidos/1/estado ()({estado})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/1/estado/
  * Node Name: `http://host.docker.internal:8080/api/pedidos/1/estado/ ()({estado})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/login
  * Node Name: `http://host.docker.internal:8080/api/auth/login ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/login
  * Node Name: `http://host.docker.internal:8080/api/auth/login ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/login/
  * Node Name: `http://host.docker.internal:8080/api/auth/login/ ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `429`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/registro
  * Node Name: `http://host.docker.internal:8080/api/auth/registro ()({email,password,cliente_id})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/registro
  * Node Name: `http://host.docker.internal:8080/api/auth/registro ()({email,password,cliente_id})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/registro/
  * Node Name: `http://host.docker.internal:8080/api/auth/registro/ ()({email,password,cliente_id})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/renovar
  * Node Name: `http://host.docker.internal:8080/api/auth/renovar ()({refresh_token})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/renovar/
  * Node Name: `http://host.docker.internal:8080/api/auth/renovar/ ()({refresh_token})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/usuarios
  * Node Name: `http://host.docker.internal:8080/api/auth/usuarios ()({email,password,rol})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/usuarios
  * Node Name: `http://host.docker.internal:8080/api/auth/usuarios ()({email,password,rol})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `409`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/usuarios/
  * Node Name: `http://host.docker.internal:8080/api/auth/usuarios/ ()({email,password,rol})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/cupon
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/cupon ()({codigo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/cupon
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/cupon ()({codigo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/items
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/items ()({sku,cantidad})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/items
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/items ()({sku,cantidad})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/productos
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos ()({sku,nombre,descripcion,categoria,marca,precio,descuento_porcentaje,imagenes:[],atributos})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `409`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/productos/
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos/ ()({sku,nombre,descripcion,categoria,marca,precio,descuento_porcentaje,imagenes:[],atributos})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `409`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes
  * Node Name: `http://host.docker.internal:8080/api/clientes ()({nombre,apellido,email,telefono,documento})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes
  * Node Name: `http://host.docker.internal:8080/api/clientes ()({nombre,apellido,email,telefono,documento})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `409`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/
  * Node Name: `http://host.docker.internal:8080/api/clientes/ ()({nombre,apellido,email,telefono,documento})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `409`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1/direcciones
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/direcciones ()({tipo,etiqueta,linea1,ciudad,departamento,codigo_postal,predeterminada})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas ()({sku,cantidad,pedido_id})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/confirmar
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/confirmar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/confirmar/
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/confirmar/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/liberar
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/liberar ()({motivo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/liberar/
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/liberar/ ()({motivo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/stock/SKU-TEC-001/entrada
  * Node Name: `http://host.docker.internal:8080/api/inventario/stock/SKU-TEC-001/entrada ()({cantidad,bodega_id})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/cobros
  * Node Name: `http://host.docker.internal:8080/api/pagos/cobros ()({pedido_id,numero_pedido,cliente_id,monto,medio_pago,token_medio_pago})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001/reembolsar
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001/reembolsar ()({motivo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001/reembolsar/
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001/reembolsar/ ()({motivo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/1/cancelar
  * Node Name: `http://host.docker.internal:8080/api/pedidos/1/cancelar ()({motivo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/1/cancelar/
  * Node Name: `http://host.docker.internal:8080/api/pedidos/1/cancelar/ ()({motivo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/checkout
  * Node Name: `http://host.docker.internal:8080/api/pedidos/checkout ()({medio_pago,token_medio_pago,direccion_id,cliente_id})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/checkout/
  * Node Name: `http://host.docker.internal:8080/api/pedidos/checkout/ ()({medio_pago,token_medio_pago,direccion_id,cliente_id})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/computeMetadata/v1/
  * Node Name: `http://host.docker.internal:8080/computeMetadata/v1/ ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/latest/meta-data/
  * Node Name: `http://host.docker.internal:8080/latest/meta-data/ ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/metadata/instance
  * Node Name: `http://host.docker.internal:8080/metadata/instance ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/metadata/v1
  * Node Name: `http://host.docker.internal:8080/metadata/v1 ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/opc/v1/instance/
  * Node Name: `http://host.docker.internal:8080/opc/v1/instance/ ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/opc/v2/instance/
  * Node Name: `http://host.docker.internal:8080/opc/v2/instance/ ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/openstack/latest/meta_data.json
  * Node Name: `http://host.docker.internal:8080/openstack/latest/meta_data.json ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``


Instances: 110

### Solution



### Reference



#### CWE Id: [ 388 ](https://cwe.mitre.org/data/definitions/388.html)


#### WASC Id: 20

#### Source ID: 4

### [ Authentication Request Identified ](https://www.zaproxy.org/docs/alerts/10111/)



##### Informational (Low)

### Description

The given request has been identified as an authentication request. The 'Other Info' field contains a set of key=value lines which identify any relevant fields. If the request is in a context which has an Authentication Method set to "Auto-Detect" then this rule will change the authentication to match the request identified.

* URL: http://host.docker.internal:8080/api/auth/registro
  * Node Name: `http://host.docker.internal:8080/api/auth/registro ()({email,password,cliente_id})`
  * Method: `POST`
  * Parameter: `email`
  * Attack: ``
  * Evidence: `password`
  * Other Info: `userParam=email
userValue=zaproxy@example.com
passwordParam=password`
* URL: http://host.docker.internal:8080/api/auth/usuarios
  * Node Name: `http://host.docker.internal:8080/api/auth/usuarios ()({email,password,rol})`
  * Method: `POST`
  * Parameter: `email`
  * Attack: ``
  * Evidence: `password`
  * Other Info: `userParam=email
userValue=zaproxy@example.com
passwordParam=password`
* URL: http://host.docker.internal:8080/api/auth/login
  * Node Name: `http://host.docker.internal:8080/api/auth/login ()({email,password})`
  * Method: `POST`
  * Parameter: `email`
  * Attack: ``
  * Evidence: `password`
  * Other Info: `userParam=email
userValue=zaproxy@example.com
passwordParam=password`


Instances: 3

### Solution

This is an informational alert rather than a vulnerability and so there is nothing to fix.

### Reference


* [ https://www.zaproxy.org/docs/desktop/addons/authentication-helper/auth-req-id/ ](https://www.zaproxy.org/docs/desktop/addons/authentication-helper/auth-req-id/)



#### Source ID: 3

### [ Non-Storable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are not storable by caching components such as proxy servers. If the response does not contain sensitive, personal or user-specific information, it may benefit from being stored and cached, to improve performance.

* URL: http://host.docker.internal:8080/api/auth/perfil
  * Node Name: `http://host.docker.internal:8080/api/auth/perfil`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `authorization:`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/health
  * Node Name: `http://host.docker.internal:8080/api/health`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `authorization:`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/login
  * Node Name: `http://host.docker.internal:8080/api/auth/login ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `authorization:`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/logout
  * Node Name: `http://host.docker.internal:8080/api/auth/logout`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `authorization:`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes
  * Node Name: `http://host.docker.internal:8080/api/clientes ()({nombre,apellido,email,telefono,documento})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `authorization:`
  * Other Info: ``

Instances: Systemic


### Solution

The content may be marked as storable by ensuring that the following conditions are satisfied:
The request method must be understood by the cache and defined as being cacheable ("GET", "HEAD", and "POST" are currently defined as cacheable)
The response status code must be understood by the cache (one of the 1XX, 2XX, 3XX, 4XX, or 5XX response classes are generally understood)
The "no-store" cache directive must not appear in the request or response header fields
For caching by "shared" caches such as "proxy" caches, the "private" response directive must not appear in the response
For caching by "shared" caches such as "proxy" caches, the "Authorization" header field must not appear in the request, unless the response explicitly allows it (using one of the "must-revalidate", "public", or "s-maxage" Cache-Control response directives)
In addition to the conditions above, at least one of the following conditions must also be satisfied by the response:
It must contain an "Expires" header field
It must contain a "max-age" response directive
For "shared" caches such as "proxy" caches, it must contain a "s-maxage" response directive
It must contain a "Cache Control Extension" that allows it to be cached
It must have a status code that is defined as cacheable by default (200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501).

### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3


