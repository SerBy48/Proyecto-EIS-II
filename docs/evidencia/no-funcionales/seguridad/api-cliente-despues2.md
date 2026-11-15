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
| Medium | Exceeded High | http://host.docker.internal:8080 | Percentage of responses with status code 4xx | 82 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of responses with status code 2xx | 17 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with content type application/json | 100 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method DELETE | 3 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method GET | 60 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method PATCH | 6 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method POST | 28 % |
| Info | Informational | http://host.docker.internal:8080 | Count of total endpoints | 151    |
| Info | Informational | http://host.docker.internal:8080 | Percentage of slow responses | 1 % |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| Timestamp Disclosure - Unix | Low | 2 |
| A Client Error response code was returned by the server | Informational | 141 |
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
  * Evidence: `1794775859`
  * Other Info: `1794775859, which evaluates to: 2026-11-15 20:50:59.`
* URL: http://host.docker.internal:8080/api/auth/verificar
  * Node Name: `http://host.docker.internal:8080/api/auth/verificar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `1794776759`
  * Other Info: `1794776759, which evaluates to: 2026-11-15 21:05:59.`


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

* URL: http://host.docker.internal:8080/api/carrito/1
  * Node Name: `http://host.docker.internal:8080/api/carrito/1`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/cupon
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/cupon`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/cupon/
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/cupon/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/items/SKU-TEC-001
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/items/SKU-TEC-001`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/items/SKU-TEC-001/
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/items/SKU-TEC-001/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/3213890735874738308
  * Node Name: `http://host.docker.internal:8080/3213890735874738308`
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
* URL: http://host.docker.internal:8080/api/6633944231848642339
  * Node Name: `http://host.docker.internal:8080/api/6633944231848642339`
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
* URL: http://host.docker.internal:8080/api/auth/5182422781045514764
  * Node Name: `http://host.docker.internal:8080/api/auth/5182422781045514764`
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
* URL: http://host.docker.internal:8080/api/carrito/1
  * Node Name: `http://host.docker.internal:8080/api/carrito/1`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/1539399469197114962
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/1539399469197114962`
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
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/checkout/
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/checkout/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
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
* URL: http://host.docker.internal:8080/api/carrito/1/items/5400452386420076268
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/items/5400452386420076268`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1009350469976475118
  * Node Name: `http://host.docker.internal:8080/api/carrito/1009350469976475118`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
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
* URL: http://host.docker.internal:8080/api/catalogo/5628199410224121272
  * Node Name: `http://host.docker.internal:8080/api/catalogo/5628199410224121272`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/productos/2976081710052801845
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos/2976081710052801845`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/productos/SKU-TEC-001/7957555133899980378
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos/SKU-TEC-001/7957555133899980378`
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
* URL: http://host.docker.internal:8080/api/catalogo/promociones/1966859847020842488
  * Node Name: `http://host.docker.internal:8080/api/catalogo/promociones/1966859847020842488`
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
* URL: http://host.docker.internal:8080/api/clientes/1
  * Node Name: `http://host.docker.internal:8080/api/clientes/1`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1/
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1/8174945088266078048
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/8174945088266078048`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1/direcciones
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/direcciones`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1/direcciones/
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/direcciones/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1/historial
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/historial`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1/historial/
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/historial/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1/validar%3Fdireccion_id=1
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/validar (direccion_id)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1/validar/
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/validar/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1576321246187518660
  * Node Name: `http://host.docker.internal:8080/api/clientes/1576321246187518660`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
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
* URL: http://host.docker.internal:8080/api/inventario/9073450156088947945
  * Node Name: `http://host.docker.internal:8080/api/inventario/9073450156088947945`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/alertas
  * Node Name: `http://host.docker.internal:8080/api/inventario/alertas`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/alertas/
  * Node Name: `http://host.docker.internal:8080/api/inventario/alertas/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
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
* URL: http://host.docker.internal:8080/api/inventario/movimientos/4263040238591275093
  * Node Name: `http://host.docker.internal:8080/api/inventario/movimientos/4263040238591275093`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/movimientos/SKU-TEC-001
  * Node Name: `http://host.docker.internal:8080/api/inventario/movimientos/SKU-TEC-001`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/movimientos/SKU-TEC-001/
  * Node Name: `http://host.docker.internal:8080/api/inventario/movimientos/SKU-TEC-001/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
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
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/166831907789942430
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/166831907789942430`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/950287110160633469
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/950287110160633469`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
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
* URL: http://host.docker.internal:8080/api/inventario/stock/5565480745267887635
  * Node Name: `http://host.docker.internal:8080/api/inventario/stock/5565480745267887635`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/stock/SKU-TEC-001/5925055490986353144
  * Node Name: `http://host.docker.internal:8080/api/inventario/stock/SKU-TEC-001/5925055490986353144`
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
* URL: http://host.docker.internal:8080/api/notificaciones/5538572928299622954
  * Node Name: `http://host.docker.internal:8080/api/notificaciones/5538572928299622954`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/notificaciones/plantillas
  * Node Name: `http://host.docker.internal:8080/api/notificaciones/plantillas`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/notificaciones/plantillas/
  * Node Name: `http://host.docker.internal:8080/api/notificaciones/plantillas/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/notificaciones/plantillas/3789106539259409344
  * Node Name: `http://host.docker.internal:8080/api/notificaciones/plantillas/3789106539259409344`
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
* URL: http://host.docker.internal:8080/api/pagos/943283931314954380
  * Node Name: `http://host.docker.internal:8080/api/pagos/943283931314954380`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/transacciones/2892595308264878960
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/2892595308264878960`
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
* URL: http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001/2446270918363669988
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001/2446270918363669988`
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
* URL: http://host.docker.internal:8080/api/pedidos/1/7339666459729884892
  * Node Name: `http://host.docker.internal:8080/api/pedidos/1/7339666459729884892`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/1/saga
  * Node Name: `http://host.docker.internal:8080/api/pedidos/1/saga`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/1/saga/
  * Node Name: `http://host.docker.internal:8080/api/pedidos/1/saga/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/3188720821285991255
  * Node Name: `http://host.docker.internal:8080/api/pedidos/3188720821285991255`
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
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/items/SKU-TEC-001/
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/items/SKU-TEC-001/ ()({cantidad})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/productos/SKU-TEC-001
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos/SKU-TEC-001 ()({descuento_porcentaje})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/productos/SKU-TEC-001/
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos/SKU-TEC-001/ ()({descuento_porcentaje})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1
  * Node Name: `http://host.docker.internal:8080/api/clientes/1 ()({telefono})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1/
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/ ()({telefono})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/notificaciones/plantillas/pedido.confirmado
  * Node Name: `http://host.docker.internal:8080/api/notificaciones/plantillas/pedido.confirmado ()({asunto})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/notificaciones/plantillas/pedido.confirmado/
  * Node Name: `http://host.docker.internal:8080/api/notificaciones/plantillas/pedido.confirmado/ ()({asunto})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/1/estado
  * Node Name: `http://host.docker.internal:8080/api/pedidos/1/estado ()({estado})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/1/estado/
  * Node Name: `http://host.docker.internal:8080/api/pedidos/1/estado/ ()({estado})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/login
  * Node Name: `http://host.docker.internal:8080/api/auth/login ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/login/
  * Node Name: `http://host.docker.internal:8080/api/auth/login/ ()({email,password})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
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
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/usuarios/
  * Node Name: `http://host.docker.internal:8080/api/auth/usuarios/ ()({email,password,rol})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/cupon
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/cupon ()({codigo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/cupon/
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/cupon/ ()({codigo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/items
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/items ()({sku,cantidad})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/items/
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/items/ ()({sku,cantidad})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/productos
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos ()({sku,nombre,descripcion,categoria,marca,precio,descuento_porcentaje,imagenes:[],atributos})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/productos/
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos/ ()({sku,nombre,descripcion,categoria,marca,precio,descuento_porcentaje,imagenes:[],atributos})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
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
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1/direcciones/
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/direcciones/ ()({tipo,etiqueta,linea1,ciudad,departamento,codigo_postal,predeterminada})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas ()({sku,cantidad,pedido_id})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/ ()({sku,cantidad,pedido_id})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/confirmar
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/confirmar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/confirmar/
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/confirmar/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/liberar
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/liberar ()({motivo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/liberar/
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/liberar/ ()({motivo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/stock/SKU-TEC-001/entrada
  * Node Name: `http://host.docker.internal:8080/api/inventario/stock/SKU-TEC-001/entrada ()({cantidad,bodega_id})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/stock/SKU-TEC-001/entrada/
  * Node Name: `http://host.docker.internal:8080/api/inventario/stock/SKU-TEC-001/entrada/ ()({cantidad,bodega_id})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/cobros
  * Node Name: `http://host.docker.internal:8080/api/pagos/cobros ()({pedido_id,numero_pedido,cliente_id,monto,medio_pago,token_medio_pago})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/cobros/
  * Node Name: `http://host.docker.internal:8080/api/pagos/cobros/ ()({pedido_id,numero_pedido,cliente_id,monto,medio_pago,token_medio_pago})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001/reembolsar
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001/reembolsar ()({motivo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001/reembolsar/
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001/reembolsar/ ()({motivo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
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


Instances: 141

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

* URL: http://host.docker.internal:8080/api/health
  * Node Name: `http://host.docker.internal:8080/api/health`
  * Method: `GET`
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
* URL: http://host.docker.internal:8080/api/auth/registro
  * Node Name: `http://host.docker.internal:8080/api/auth/registro ()({email,password,cliente_id})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `authorization:`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/renovar
  * Node Name: `http://host.docker.internal:8080/api/auth/renovar ()({refresh_token})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `authorization:`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/usuarios
  * Node Name: `http://host.docker.internal:8080/api/auth/usuarios ()({email,password,rol})`
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


