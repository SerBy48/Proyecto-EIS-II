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
| Medium | Exceeded High | http://host.docker.internal:8080 | Percentage of responses with status code 4xx | 79 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of responses with status code 2xx | 20 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with content type application/json | 100 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method DELETE | 3 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method GET | 62 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method PATCH | 12 % |
| Info | Informational | http://host.docker.internal:8080 | Percentage of endpoints with method POST | 21 % |
| Info | Informational | http://host.docker.internal:8080 | Count of total endpoints | 172    |
| Info | Exceeded Low | http://host.docker.internal:8080 | Percentage of slow responses | 12 % |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| Timestamp Disclosure - Unix | Low | 2 |
| A Client Error response code was returned by the server | Informational | 162 |
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
  * Evidence: `1794814792`
  * Other Info: `1794814792, which evaluates to: 2026-11-16 07:39:52.`
* URL: http://host.docker.internal:8080/api/auth/verificar
  * Node Name: `http://host.docker.internal:8080/api/auth/verificar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `1794815692`
  * Other Info: `1794815692, which evaluates to: 2026-11-16 07:54:52.`


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

A response code of 400 was returned by the server.
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
* URL: http://host.docker.internal:8080/886719661750147818
  * Node Name: `http://host.docker.internal:8080/886719661750147818`
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
* URL: http://host.docker.internal:8080/api/5067147193499405789
  * Node Name: `http://host.docker.internal:8080/api/5067147193499405789`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente
  * Node Name: `http://host.docker.internal:8080/api/asistente`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/
  * Node Name: `http://host.docker.internal:8080/api/asistente/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/4865331945910850969
  * Node Name: `http://host.docker.internal:8080/api/asistente/4865331945910850969`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/conversaciones
  * Node Name: `http://host.docker.internal:8080/api/asistente/conversaciones`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/conversaciones/
  * Node Name: `http://host.docker.internal:8080/api/asistente/conversaciones/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/conversaciones/4583722235716080889
  * Node Name: `http://host.docker.internal:8080/api/asistente/conversaciones/4583722235716080889`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/conversaciones/id
  * Node Name: `http://host.docker.internal:8080/api/asistente/conversaciones/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/conversaciones/id/
  * Node Name: `http://host.docker.internal:8080/api/asistente/conversaciones/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/faq
  * Node Name: `http://host.docker.internal:8080/api/asistente/faq`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/faq/
  * Node Name: `http://host.docker.internal:8080/api/asistente/faq/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/faq/5494472637009514987
  * Node Name: `http://host.docker.internal:8080/api/asistente/faq/5494472637009514987`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/faq/actuator/health
  * Node Name: `http://host.docker.internal:8080/api/asistente/faq/actuator/health`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/intenciones
  * Node Name: `http://host.docker.internal:8080/api/asistente/intenciones`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/intenciones/
  * Node Name: `http://host.docker.internal:8080/api/asistente/intenciones/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/intenciones/594443357410624748
  * Node Name: `http://host.docker.internal:8080/api/asistente/intenciones/594443357410624748`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/tickets%3Festado=abierto
  * Node Name: `http://host.docker.internal:8080/api/asistente/tickets (estado)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/tickets/
  * Node Name: `http://host.docker.internal:8080/api/asistente/tickets/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
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
* URL: http://host.docker.internal:8080/api/auth/1629513513736329424
  * Node Name: `http://host.docker.internal:8080/api/auth/1629513513736329424`
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
* URL: http://host.docker.internal:8080/api/carrito/1/3733875464048242970
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/3733875464048242970`
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
* URL: http://host.docker.internal:8080/api/carrito/1/items/6148929284835267780
  * Node Name: `http://host.docker.internal:8080/api/carrito/1/items/6148929284835267780`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/carrito/6237077592984769812
  * Node Name: `http://host.docker.internal:8080/api/carrito/6237077592984769812`
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
* URL: http://host.docker.internal:8080/api/catalogo/8707109289185521589
  * Node Name: `http://host.docker.internal:8080/api/catalogo/8707109289185521589`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/productos/349784453231792602
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos/349784453231792602`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/productos/SKU-TEC-001/255197538892387403
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos/SKU-TEC-001/255197538892387403`
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
* URL: http://host.docker.internal:8080/api/catalogo/promociones/3475946218372792706
  * Node Name: `http://host.docker.internal:8080/api/catalogo/promociones/3475946218372792706`
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
* URL: http://host.docker.internal:8080/api/clientes/1/6074231321276413811
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/6074231321276413811`
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
* URL: http://host.docker.internal:8080/api/clientes/1490500465301674675
  * Node Name: `http://host.docker.internal:8080/api/clientes/1490500465301674675`
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
* URL: http://host.docker.internal:8080/api/inventario/3971368711760050963
  * Node Name: `http://host.docker.internal:8080/api/inventario/3971368711760050963`
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
* URL: http://host.docker.internal:8080/api/inventario/movimientos/4670611663565840445
  * Node Name: `http://host.docker.internal:8080/api/inventario/movimientos/4670611663565840445`
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
* URL: http://host.docker.internal:8080/api/inventario/reservas/5395141737360343366
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/5395141737360343366`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/%257Bid%257D
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/{id}`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/%257Bid%257D/
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/{id}/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/%257Bid%257D/574031925571561897
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/{id}/574031925571561897`
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
* URL: http://host.docker.internal:8080/api/inventario/stock/5728174911902274378
  * Node Name: `http://host.docker.internal:8080/api/inventario/stock/5728174911902274378`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/stock/SKU-TEC-001/6528860383452252435
  * Node Name: `http://host.docker.internal:8080/api/inventario/stock/SKU-TEC-001/6528860383452252435`
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
* URL: http://host.docker.internal:8080/api/notificaciones/745764502328993620
  * Node Name: `http://host.docker.internal:8080/api/notificaciones/745764502328993620`
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
* URL: http://host.docker.internal:8080/api/notificaciones/plantillas/18431783798925101
  * Node Name: `http://host.docker.internal:8080/api/notificaciones/plantillas/18431783798925101`
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
* URL: http://host.docker.internal:8080/api/pagos/8956553058959159515
  * Node Name: `http://host.docker.internal:8080/api/pagos/8956553058959159515`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/transacciones/4926249283759385545
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/4926249283759385545`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/transacciones/TRX-4B2CB23F-814
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/TRX-4B2CB23F-814`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/transacciones/TRX-4B2CB23F-814/
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/TRX-4B2CB23F-814/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/transacciones/TRX-4B2CB23F-814/3151410901882879422
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/TRX-4B2CB23F-814/3151410901882879422`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos%3Fcliente_id=1&estado=%2500
  * Node Name: `http://host.docker.internal:8080/api/pedidos (cliente_id,estado)`
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
* URL: http://host.docker.internal:8080/api/pedidos/1/6278475347862209995
  * Node Name: `http://host.docker.internal:8080/api/pedidos/1/6278475347862209995`
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
* URL: http://host.docker.internal:8080/api/pedidos/3193428053145995411
  * Node Name: `http://host.docker.internal:8080/api/pedidos/3193428053145995411`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/faq/faq_horario
  * Node Name: `http://host.docker.internal:8080/api/asistente/faq/faq_horario ()({respuesta})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/faq/faq_horario/
  * Node Name: `http://host.docker.internal:8080/api/asistente/faq/faq_horario/ ()({respuesta})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/intenciones/faq_envio
  * Node Name: `http://host.docker.internal:8080/api/asistente/intenciones/faq_envio ()({terminos:[{texto,peso}],prioridad,descripcion})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/intenciones/faq_envio/
  * Node Name: `http://host.docker.internal:8080/api/asistente/intenciones/faq_envio/ ()({terminos:[{texto,peso}],prioridad,descripcion})`
  * Method: `PATCH`
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
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos/SKU-TEC-001 ()({nombre,marca,descripcion,precio,descuento_porcentaje,imagenes:[],atributos:{},activo})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/productos/SKU-TEC-001/
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos/SKU-TEC-001/ ()({nombre,marca,descripcion,precio,descuento_porcentaje,imagenes:[],atributos:{},activo})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1
  * Node Name: `http://host.docker.internal:8080/api/clientes/1 ()({nombre,apellido,telefono})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1/
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/ ()({nombre,apellido,telefono})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/notificaciones/plantillas/pedido.confirmado
  * Node Name: `http://host.docker.internal:8080/api/notificaciones/plantillas/pedido.confirmado ()({canal,asunto,cuerpo,activo})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/notificaciones/plantillas/pedido.confirmado/
  * Node Name: `http://host.docker.internal:8080/api/notificaciones/plantillas/pedido.confirmado/ ()({canal,asunto,cuerpo,activo})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/1/estado
  * Node Name: `http://host.docker.internal:8080/api/pedidos/1/estado ()({estado,motivo})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pedidos/1/estado/
  * Node Name: `http://host.docker.internal:8080/api/pedidos/1/estado/ ()({estado,motivo})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/computeMetadata/v1/
  * Node Name: `http://host.docker.internal:8080/computeMetadata/v1/ ()({respuesta})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/latest/meta-data/
  * Node Name: `http://host.docker.internal:8080/latest/meta-data/ ()({respuesta})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/metadata/instance
  * Node Name: `http://host.docker.internal:8080/metadata/instance ()({respuesta})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/metadata/v1
  * Node Name: `http://host.docker.internal:8080/metadata/v1 ()({respuesta})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/opc/v1/instance/
  * Node Name: `http://host.docker.internal:8080/opc/v1/instance/ ()({respuesta})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/opc/v2/instance/
  * Node Name: `http://host.docker.internal:8080/opc/v2/instance/ ()({respuesta})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/openstack/latest/meta_data.json
  * Node Name: `http://host.docker.internal:8080/openstack/latest/meta_data.json ()({respuesta})`
  * Method: `PATCH`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/asistente/mensajes
  * Node Name: `http://host.docker.internal:8080/api/asistente/mensajes ()({texto,conversacion_id})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
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
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos ()({sku,nombre,descripcion,categoria,marca,precio,descuento_porcentaje,imagenes:[],atributos:{}})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/catalogo/productos/
  * Node Name: `http://host.docker.internal:8080/api/catalogo/productos/ ()({sku,nombre,descripcion,categoria,marca,precio,descuento_porcentaje,imagenes:[],atributos:{}})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes
  * Node Name: `http://host.docker.internal:8080/api/clientes ()({nombre,apellido,email,telefono,documento,tipo_documento})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `400`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes
  * Node Name: `http://host.docker.internal:8080/api/clientes ()({nombre,apellido,email,telefono,documento,tipo_documento})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `409`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/
  * Node Name: `http://host.docker.internal:8080/api/clientes/ ()({nombre,apellido,email,telefono,documento,tipo_documento})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `409`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1/direcciones
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/direcciones ()({tipo,etiqueta,linea1,linea2,ciudad,departamento,pais,codigo_postal,predeterminada})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/clientes/1/direcciones/
  * Node Name: `http://host.docker.internal:8080/api/clientes/1/direcciones/ ()({tipo,etiqueta,linea1,linea2,ciudad,departamento,pais,codigo_postal,predeterminada})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas ()({sku,cantidad,pedido_id,minutos_vigencia})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/ ()({sku,cantidad,pedido_id,minutos_vigencia})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/%257Bid%257D/confirmar
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/{id}/confirmar`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/%257Bid%257D/confirmar/
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/{id}/confirmar/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/%257Bid%257D/liberar
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/{id}/liberar ()({motivo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/inventario/reservas/%257Bid%257D/liberar/
  * Node Name: `http://host.docker.internal:8080/api/inventario/reservas/{id}/liberar/ ()({motivo})`
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
* URL: http://host.docker.internal:8080/api/pagos/transacciones/TRX-4B2CB23F-814/reembolsar
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/TRX-4B2CB23F-814/reembolsar ()({motivo})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `403`
  * Other Info: ``
* URL: http://host.docker.internal:8080/api/pagos/transacciones/TRX-4B2CB23F-814/reembolsar/
  * Node Name: `http://host.docker.internal:8080/api/pagos/transacciones/TRX-4B2CB23F-814/reembolsar/ ()({motivo})`
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


Instances: 162

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


