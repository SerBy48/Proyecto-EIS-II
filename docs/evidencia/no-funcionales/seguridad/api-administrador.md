# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 1 |
| Low | 3 |
| Informational | 3 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Info | Informational | http://host.docker.internal:8080 | Percentage of responses with status code 2xx | 38 % |
| Info | Exceeded Low | http://host.docker.internal:8080 | Percentage of responses with status code 4xx | 47 % |
| Info | Exceeded Low | http://host.docker.internal:8080 | Percentage of responses with status code 5xx | 14 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with content type application/json | 100 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method DELETE | 3 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method GET | 62 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method PATCH | 5 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method POST | 28 % |
| Info | Informational | http://host.docker.internal:8080 | Count of total endpoints | 128    |
| Info | Exceeded Low | http://host.docker.internal:8080 | Percentage of slow responses | 13 % |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| Format String Error | Medium | 11 |
| A Server Error response code was returned by the server | Low | 20 |
| Application Error Disclosure | Low | 3 |
| Timestamp Disclosure - Unix | Low | 2 |
| A Client Error response code was returned by the server | Informational | 97 |
| Authentication Request Identified | Informational | 3 |
| Non-Storable Content | Informational | Systemic |




## Alert Detail



### [ Format String Error ](https://www.zaproxy.org/docs/alerts/30002/)



##### Medium (Medium)

### Description

A Format String error occurs when the submitted data of an input string is evaluated as a command by the application.

* URL: http://host.docker.internal:8080/api/clientes/1
  * Node Name: `http://host.docker.internal:8080/api/clientes/1 ()({telefono})`
  * Method: `PATCH`
  * Parameter: `telefono`
  * Attack: `ZAP%x%x%x%x%x%x%x%x%x%x
`
  * Evidence: ``
  * Other Info: `Potential Format String Error. The script closed the connection on a /%s and /%x.`
* URL: http://host.docker.internal:8080/api/auth/usuarios
  * Node Name: `http://host.docker.internal:8080/api/auth/usuarios ()({email,password,rol})`
  * Method: `POST`
  * Parameter: `email`
  * Attack: `ZAP %1!s%2!s%3!s%4!s%5!s%6!s%7!s%8!s%9!s%10!s%11!s%12!s%13!s%14!s%15!s%16!s%17!s%18!s%19!s%20!s%21!n%22!n%23!n%24!n%25!n%26!n%27!n%28!n%29!n%30!n%31!n%32!n%33!n%34!n%35!n%36!n%37!n%38!n%39!n%40!n
`
  * Evidence: ``
  * Other Info: `Potential Format String Error. The script closed the connection on a Microsoft format string error.`
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
* URL: http://host.docker.internal:8080/api/clientes/1/direcciones
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/direcciones ()({tipo,etiqueta,linea1,ciudad,departamento,codigo_postal,predeterminada})`
  * Method: `POST`
  * Parameter: `ciudad`
  * Attack: `ZAP %1!s%2!s%3!s%4!s%5!s%6!s%7!s%8!s%9!s%10!s%11!s%12!s%13!s%14!s%15!s%16!s%17!s%18!s%19!s%20!s%21!n%22!n%23!n%24!n%25!n%26!n%27!n%28!n%29!n%30!n%31!n%32!n%33!n%34!n%35!n%36!n%37!n%38!n%39!n%40!n
`
  * Evidence: ``
  * Other Info: `Potential Format String Error. The script closed the connection on a Microsoft format string error.`
* URL: http://host.docker.internal:8080/api/clientes/1/direcciones
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/direcciones ()({tipo,etiqueta,linea1,ciudad,departamento,codigo_postal,predeterminada})`
  * Method: `POST`
  * Parameter: `codigo_postal`
  * Attack: `ZAP%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s
`
  * Evidence: ``
  * Other Info: `Potential Format String Error. The script closed the connection on a /%s.`
* URL: http://host.docker.internal:8080/api/clientes/1/direcciones
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/direcciones ()({tipo,etiqueta,linea1,ciudad,departamento,codigo_postal,predeterminada})`
  * Method: `POST`
  * Parameter: `departamento`
  * Attack: `ZAP %1!s%2!s%3!s%4!s%5!s%6!s%7!s%8!s%9!s%10!s%11!s%12!s%13!s%14!s%15!s%16!s%17!s%18!s%19!s%20!s%21!n%22!n%23!n%24!n%25!n%26!n%27!n%28!n%29!n%30!n%31!n%32!n%33!n%34!n%35!n%36!n%37!n%38!n%39!n%40!n
`
  * Evidence: ``
  * Other Info: `Potential Format String Error. The script closed the connection on a Microsoft format string error.`
* URL: http://host.docker.internal:8080/api/clientes/1/direcciones
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/direcciones ()({tipo,etiqueta,linea1,ciudad,departamento,codigo_postal,predeterminada})`
  * Method: `POST`
  * Parameter: `etiqueta`
  * Attack: `ZAP%x%x%x%x%x%x%x%x%x%x
`
  * Evidence: ``
  * Other Info: `Potential Format String Error. The script closed the connection on a /%s and /%x.`


Instances: 11

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

* URL: http://host.docker.internal:8080/api/clientes/1/validar%3Fdireccion_id=http%253A%252F%252Fwww.google.com%252F
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/validar (direccion_id)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/9135908023979880882
  * Node Name: `http://host.docker.internal:8080/api/clientes/9135908023979880882`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/disponibilidad%3Fskus=%2500
  * Node Name: `http://host.docker.internal:8080/api/inventario/disponibilidad (skus)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1947138841234361229
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1947138841234361229`
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
* URL: http://host.docker.internal:8080/api/pedidos/7320667447113753161
  * Node Name: `http://host.docker.internal:8080/api/pedidos/7320667447113753161`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1
  * Node Name: `http://host.docker.internal:8080/api/clientes/1 ()({telefono})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/auth/usuarios
  * Node Name: `http://host.docker.internal:8080/api/auth/usuarios ()({email,password,rol})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/cupon
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/cupon ()({codigo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `503`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/1/items
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/items ()({sku,cantidad})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `503`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes
  * Node Name: `http://host.docker.internal:8080/api/clientes ()({nombre,apellido,email,telefono,documento})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1/direcciones
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/direcciones ()({tipo,etiqueta,linea1,ciudad,departamento,codigo_postal,predeterminada})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas ()({sku,cantidad,pedido_id})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/confirmar
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/confirmar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/confirmar/
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/confirmar/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/liberar
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/liberar ()({motivo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/liberar/
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/liberar/ ()({motivo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `500`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/checkout
  * Node Name: `http://host.docker.internal:8080/api/pedidos/checkout ()({medio_pago,token_medio_pago,direccion_id,cliente_id})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `503`
  * Other Info: ``


Instances: 20

### Solution



### Reference



#### CWE Id: [ 388 ](https://cwe.mitre.org/data/definitions/388.html)


#### WASC Id: 20

#### Source ID: 4

### [ Application Error Disclosure ](https://www.zaproxy.org/docs/alerts/90022/)



##### Low (Medium)

### Description

This page contains an error/warning message that may disclose sensitive information like the location of the file that produced the unhandled exception. This information can be used to launch further attacks against the web application. The alert could be a false positive if the error message is found inside a documentation page.

* URL: http://host.docker.internal:8080/api/inventario/reservas/1
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `HTTP/1.1 500 Internal Server Error`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/confirmar
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/confirmar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `HTTP/1.1 500 Internal Server Error`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/liberar
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/liberar ()({motivo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `HTTP/1.1 500 Internal Server Error`
  * Other Info: ``


Instances: 3

### Solution

Review the source code of this page. Implement custom error pages. Consider implementing a mechanism to provide a unique error reference/identifier to the client (browser) while logging the details on the server side and not exposing them to the user.

### Reference



#### CWE Id: [ 550 ](https://cwe.mitre.org/data/definitions/550.html)


#### WASC Id: 13

#### Source ID: 3

### [ Timestamp Disclosure - Unix ](https://www.zaproxy.org/docs/alerts/10096/)



##### Low (Low)

### Description

A timestamp was disclosed by the application/web server. - Unix

* URL: http://host.docker.internal:8080/api/auth/verificar
  * Node Name: `http://host.docker.internal:8080/api/auth/verificar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `1794772061`
  * Other Info: `1794772061, which evaluates to: 2026-11-15 19:47:41.`
* URL: http://host.docker.internal:8080/api/auth/verificar
  * Node Name: `http://host.docker.internal:8080/api/auth/verificar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `1794772961`
  * Other Info: `1794772961, which evaluates to: 2026-11-15 20:02:41.`


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

A response code of 429 was returned by the server.
This may indicate that the application is failing to handle unexpected input correctly.
Raised by the 'Alert on HTTP Response Code Error' script

* URL: http://host.docker.internal:8080/api/carrito/1/items/SKU-TEC-001/
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/items/SKU-TEC-001/`
  * Method: `DELETE`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/3355270919325509334
  * Node Name: `http://host.docker.internal:8080/3355270919325509334`
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
* URL: http://host.docker.internal:8080/api/4121075097765337610
  * Node Name: `http://host.docker.internal:8080/api/4121075097765337610`
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
* URL: http://host.docker.internal:8080/api/auth/5584697422004841168
  * Node Name: `http://host.docker.internal:8080/api/auth/5584697422004841168`
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
* URL: http://host.docker.internal:8080/api/carrito/1/4941322793090208103
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/4941322793090208103`
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
* URL: http://host.docker.internal:8080/api/carrito/1/items/1548895438246934148
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/items/1548895438246934148`
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
* URL: http://host.docker.internal:8080/api/catalogo/7525360743924591620
  * Node Name: `http://host.docker.internal:8080/api/catalogo/7525360743924591620`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/productos/3149929275912107284
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos/3149929275912107284`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/productos/SKU-TEC-001/8450181287997842930
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos/SKU-TEC-001/8450181287997842930`
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
* URL: http://host.docker.internal:8080/api/catalogo/promociones/621038936588355852
  * Node Name: `http://host.docker.internal:8080/api/catalogo/promociones/621038936588355852`
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
* URL: http://host.docker.internal:8080/api/clientes/1/7853422840826040393
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/7853422840826040393`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
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
* URL: http://host.docker.internal:8080/api/inventario/4556831114166641232
  * Node Name: `http://host.docker.internal:8080/api/inventario/4556831114166641232`
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
* URL: http://host.docker.internal:8080/api/inventario/reservas/1/6276928755807644395
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/1/6276928755807644395`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
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
* URL: http://host.docker.internal:8080/api/inventario/stock/4584455964295602409
  * Node Name: `http://host.docker.internal:8080/api/inventario/stock/4584455964295602409`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/stock/SKU-TEC-001/2505785390909816398
  * Node Name: `http://host.docker.internal:8080/api/inventario/stock/SKU-TEC-001/2505785390909816398`
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
* URL: http://host.docker.internal:8080/api/notificaciones/8164707804076531529
  * Node Name: `http://host.docker.internal:8080/api/notificaciones/8164707804076531529`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/notificaciones/plantillas/3722451152636583810
  * Node Name: `http://host.docker.internal:8080/api/notificaciones/plantillas/3722451152636583810`
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
* URL: http://host.docker.internal:8080/api/pagos/318944527187740786
  * Node Name: `http://host.docker.internal:8080/api/pagos/318944527187740786`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/transacciones/5532663286105021872
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/5532663286105021872`
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
* URL: http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001/6895162986636357322
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/TRX-000001/6895162986636357322`
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
* URL: http://host.docker.internal:8080/api/pedidos/1/268067432048194187
  * Node Name: `http://host.docker.internal:8080/api/pedidos/1/268067432048194187`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
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
  * Evidence: `409`
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
  * Evidence: `409`
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


Instances: 97

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


