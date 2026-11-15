# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 1 |
| Low | 2 |
| Informational | 3 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Medium | Exceeded High | http://host.docker.internal:8080 | Percentage of responses with status code 4xx | 81 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of responses with status code 2xx | 17 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of responses with status code 5xx | 1 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with content type application/json | 100 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method DELETE | 3 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method GET | 60 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method PATCH | 6 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method POST | 28 % |
| Info | Informational | http://host.docker.internal:8080 | Count of total endpoints | 151    |
| Info | Exceeded Low | http://host.docker.internal:8080 | Percentage of slow responses | 7 % |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| Format String Error | Medium | 5 |
| A Server Error response code was returned by the server | Low | 4 |
| Timestamp Disclosure - Unix | Low | 2 |
| A Client Error response code was returned by the server | Informational | 138 |
| Authentication Request Identified | Informational | 3 |
| Non-Storable Content | Informational | Systemic |




## Alert Detail



### [ Format String Error ](https://www.zaproxy.org/docs/alerts/30002/)



##### Medium (Medium)

### Description

A Format String error occurs when the submitted data of an input string is evaluated as a command by the application.

* URL: http://host.docker.internal:8080/api/clientes
  * Node Name: `http://host.docker.internal:8080/api/clientes ()({nombre,apellido,email,telefono,documento})`
  * Method: `POST`
  * Parameter: `apellido`
  * Attack: `ZAP %1!s%2!s%3!s%4!s%5!s%6!s%7!s%8!s%9!s%10!s%11!s%12!s%13!s%14!s%15!s%16!s%17!s%18!s%19!s%20!s%21!n%22!n%23!n%24!n%25!n%26!n%27!n%28!n%29!n%30!n%31!n%32!n%33!n%34!n%35!n%36!n%37!n%38!n%39!n%40!n
`
  * Evidence: ``
  * Other Info: `Potential Format String Error. The script closed the connection on a Microsoft format string error.`
* URL: http://host.docker.internal:8080/api/clientes
  * Node Name: `http://host.docker.internal:8080/api/clientes ()({nombre,apellido,email,telefono,documento})`
  * Method: `POST`
  * Parameter: `documento`
  * Attack: `ZAP%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s
`
  * Evidence: ``
  * Other Info: `Potential Format String Error. The script closed the connection on a /%s.`
* URL: http://host.docker.internal:8080/api/clientes
  * Node Name: `http://host.docker.internal:8080/api/clientes ()({nombre,apellido,email,telefono,documento})`
  * Method: `POST`
  * Parameter: `email`
  * Attack: `ZAP %1!s%2!s%3!s%4!s%5!s%6!s%7!s%8!s%9!s%10!s%11!s%12!s%13!s%14!s%15!s%16!s%17!s%18!s%19!s%20!s%21!n%22!n%23!n%24!n%25!n%26!n%27!n%28!n%29!n%30!n%31!n%32!n%33!n%34!n%35!n%36!n%37!n%38!n%39!n%40!n
`
  * Evidence: ``
  * Other Info: `Potential Format String Error. The script closed the connection on a Microsoft format string error.`
* URL: http://host.docker.internal:8080/api/clientes
  * Node Name: `http://host.docker.internal:8080/api/clientes ()({nombre,apellido,email,telefono,documento})`
  * Method: `POST`
  * Parameter: `nombre`
  * Attack: `ZAP %1!s%2!s%3!s%4!s%5!s%6!s%7!s%8!s%9!s%10!s%11!s%12!s%13!s%14!s%15!s%16!s%17!s%18!s%19!s%20!s%21!n%22!n%23!n%24!n%25!n%26!n%27!n%28!n%29!n%30!n%31!n%32!n%33!n%34!n%35!n%36!n%37!n%38!n%39!n%40!n
`
  * Evidence: ``
  * Other Info: `Potential Format String Error. The script closed the connection on a Microsoft format string error.`
* URL: http://host.docker.internal:8080/api/clientes
  * Node Name: `http://host.docker.internal:8080/api/clientes ()({nombre,apellido,email,telefono,documento})`
  * Method: `POST`
  * Parameter: `telefono`
  * Attack: `ZAP%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s
`
  * Evidence: ``
  * Other Info: `Potential Format String Error. The script closed the connection on a /%s.`


Instances: 5

### Solution

Rewrite the background program using proper deletion of bad character strings. This will require a recompile of the background executable.

### Reference


* [ https://owasp.org/www-community/attacks/Format_string_attack ](https://owasp.org/www-community/attacks/Format_string_attack)


#### CWE Id: [ 134 ](https://cwe.mitre.org/data/definitions/134.html)


#### WASC Id: 6

#### Source ID: 1

### [ A Server Error response code was returned by the server ](https://www.zaproxy.org/docs/alerts/100000/)



##### Low (High)

### Description

A response code of 500 was returned by the server.
This may indicate that the application is failing to handle unexpected input correctly.
Raised by the 'Alert on HTTP Response Code Error' script

* URL: http://host.docker.internal:8080/api/inventario/disponibilidad%3Fskus=%2500
  * Node Name: `http://host.docker.internal:8080/api/inventario/disponibilidad (skus)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos%3Festado=%2500
  * Node Name: `http://host.docker.internal:8080/api/pedidos (estado)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/7852138276428415367
  * Node Name: `http://host.docker.internal:8080/api/pedidos/7852138276428415367`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes
  * Node Name: `http://host.docker.internal:8080/api/clientes ()({nombre,apellido,email,telefono,documento})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``


Instances: 4

### Solution



### Reference



#### CWE Id: [ 388 ](https://cwe.mitre.org/data/definitions/388.html)


#### WASC Id: 20

#### Source ID: 4

### [ Timestamp Disclosure - Unix ](https://www.zaproxy.org/docs/alerts/10096/)



##### Low (Low)

### Description

A timestamp was disclosed by the application/web server. - Unix

* URL: http://host.docker.internal:8080/api/auth/verificar
  * Node Name: `http://host.docker.internal:8080/api/auth/verificar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `1794774110`
  * Other Info: `1794774110, which evaluates to: 2026-11-15 20:21:50.`
* URL: http://host.docker.internal:8080/api/auth/verificar
  * Node Name: `http://host.docker.internal:8080/api/auth/verificar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `1794775010`
  * Other Info: `1794775010, which evaluates to: 2026-11-15 20:36:50.`


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
* URL: http://host.docker.internal:8080/2603117227380458063
  * Node Name: `http://host.docker.internal:8080/2603117227380458063`
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
* URL: http://host.docker.internal:8080/api/1647229183878481714
  * Node Name: `http://host.docker.internal:8080/api/1647229183878481714`
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
* URL: http://host.docker.internal:8080/api/auth/4673855614655772201
  * Node Name: `http://host.docker.internal:8080/api/auth/4673855614655772201`
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
* URL: http://host.docker.internal:8080/api/carrito/1/4789116610509756604
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/4789116610509756604`
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
* URL: http://host.docker.internal:8080/api/carrito/1/items/835470935560202670
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/items/835470935560202670`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/6183696507228052365
  * Node Name: `http://host.docker.internal:8080/api/carrito/6183696507228052365`
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
* URL: http://host.docker.internal:8080/api/catalogo/3087011088666778783
  * Node Name: `http://host.docker.internal:8080/api/catalogo/3087011088666778783`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/productos/209543287977563648
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos/209543287977563648`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/productos/SKU-TEC-001/4347625581863155199
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos/SKU-TEC-001/4347625581863155199`
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
* URL: http://host.docker.internal:8080/api/catalogo/promociones/2541925755723406060
  * Node Name: `http://host.docker.internal:8080/api/catalogo/promociones/2541925755723406060`
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
* URL: http://host.docker.internal:8080/api/clientes/1/5538771317002779371
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/5538771317002779371`
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
* URL: http://host.docker.internal:8080/api/clientes/1527901337283652800
  * Node Name: `http://host.docker.internal:8080/api/clientes/1527901337283652800`
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
* URL: http://host.docker.internal:8080/api/inventario/3326310596335342798
  * Node Name: `http://host.docker.internal:8080/api/inventario/3326310596335342798`
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
* URL: http://host.docker.internal:8080/api/inventario/movimientos/7039920054066749022
  * Node Name: `http://host.docker.internal:8080/api/inventario/movimientos/7039920054066749022`
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
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/4567353877150408534
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/4567353877150408534`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/2387871389459601439
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/2387871389459601439`
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
* URL: http://host.docker.internal:8080/api/inventario/stock/2564199952401812514
  * Node Name: `http://host.docker.internal:8080/api/inventario/stock/2564199952401812514`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/stock/SKU-TEC-001/9158020144765673375
  * Node Name: `http://host.docker.internal:8080/api/inventario/stock/SKU-TEC-001/9158020144765673375`
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
* URL: http://host.docker.internal:8080/api/notificaciones/952032905449073283
  * Node Name: `http://host.docker.internal:8080/api/notificaciones/952032905449073283`
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
* URL: http://host.docker.internal:8080/api/notificaciones/plantillas/5660419967109135525
  * Node Name: `http://host.docker.internal:8080/api/notificaciones/plantillas/5660419967109135525`
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
* URL: http://host.docker.internal:8080/api/pagos/7676903357196671702
  * Node Name: `http://host.docker.internal:8080/api/pagos/7676903357196671702`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/transacciones/3642552595054634469
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/3642552595054634469`
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
* URL: http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001/1537311048191555887
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001/1537311048191555887`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
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
* URL: http://host.docker.internal:8080/api/pedidos/1/4344117487000283082
  * Node Name: `http://host.docker.internal:8080/api/pedidos/1/4344117487000283082`
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


Instances: 138

### Solution



### Reference



#### CWE Id: [ 388 ](https://cwe.mitre.org/data/definitions/388.html)


#### WASC Id: 20

#### Source ID: 4

### [ Authentication Request Identified ](https://www.zaproxy.org/docs/alerts/10111/)



##### Informational (High)

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
* URL: http://host.docker.internal:8080/api/auth/registro
  * Node Name: `http://host.docker.internal:8080/api/auth/registro ()({email,password,cliente_id})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `authorization:`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/verificar
  * Node Name: `http://host.docker.internal:8080/api/auth/verificar`
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


