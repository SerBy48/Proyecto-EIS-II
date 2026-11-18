import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';

/// Excepcion que conserva el codigo de negocio devuelto por la API, para que
/// la interfaz pueda distinguir un stock agotado de un pago rechazado.
class ErrorApi implements Exception {
  final int estado;
  final String mensaje;
  final String? codigo;
  final dynamic detalle;

  ErrorApi(this.estado, this.mensaje, {this.codigo, this.detalle});

  @override
  String toString() => mensaje;
}

/// Cliente de la API contra el API Gateway.
///
/// Gestiona el token de acceso y su renovacion automatica: el token vive
/// quince minutos, asi que sin esto la sesion se caeria a mitad de una compra.
class ApiService {
  static String? _token;
  static String? _refreshToken;
  static Map<String, dynamic>? _usuario;

  static Map<String, dynamic>? get usuario => _usuario;
  static bool get autenticado => _token != null;

  // ---------------------------------------------------------------- sesion --

  static Future<void> cargarSesion() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');
    _refreshToken = prefs.getString('refresh_token');
    final guardado = prefs.getString('usuario');
    if (guardado != null) _usuario = json.decode(guardado) as Map<String, dynamic>;
  }

  static Future<void> _guardarSesion(Map<String, dynamic> datos) async {
    final prefs = await SharedPreferences.getInstance();
    if (datos['token'] != null) {
      _token = datos['token'] as String;
      await prefs.setString('token', _token!);
    }
    if (datos['refresh_token'] != null) {
      _refreshToken = datos['refresh_token'] as String;
      await prefs.setString('refresh_token', _refreshToken!);
    }
    if (datos['usuario'] != null) {
      _usuario = datos['usuario'] as Map<String, dynamic>;
      await prefs.setString('usuario', json.encode(_usuario));
    }
  }

  static Future<void> cerrarSesion() async {
    try {
      await _peticion('POST', '/auth/logout');
    } catch (_) {
      // Cerrar sesion localmente debe funcionar aunque el servidor no responda.
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('refresh_token');
    await prefs.remove('usuario');
    _token = null;
    _refreshToken = null;
    _usuario = null;
  }

  static Future<Map<String, dynamic>> login(String email, String password) async {
    final datos = await _peticion('POST', '/auth/login',
        cuerpo: {'email': email, 'password': password}, conToken: false);
    await _guardarSesion(datos as Map<String, dynamic>);
    return _usuario!;
  }

  /// Cambia el refresh token por un token de acceso nuevo.
  static Future<bool> _renovar() async {
    if (_refreshToken == null) return false;
    try {
      final respuesta = await http.post(
        Uri.parse('${Config.api}/auth/renovar'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'refresh_token': _refreshToken}),
      );
      if (respuesta.statusCode != 200) return false;
      await _guardarSesion(json.decode(respuesta.body) as Map<String, dynamic>);
      return true;
    } catch (_) {
      return false;
    }
  }

  // -------------------------------------------------------------- peticion --

  static Future<dynamic> _peticion(
    String metodo,
    String ruta, {
    Object? cuerpo,
    bool conToken = true,
    String? claveIdempotencia,
    bool esReintento = false,
  }) async {
    final url = Uri.parse('${Config.api}$ruta');
    final cabeceras = <String, String>{'Content-Type': 'application/json'};
    if (conToken && _token != null) cabeceras['Authorization'] = 'Bearer $_token';
    if (claveIdempotencia != null) cabeceras['Idempotency-Key'] = claveIdempotencia;

    final cuerpoJson = cuerpo == null ? null : json.encode(cuerpo);

    late http.Response respuesta;
    try {
      switch (metodo) {
        case 'POST':
          respuesta = await http
              .post(url, headers: cabeceras, body: cuerpoJson)
              .timeout(const Duration(seconds: 20));
          break;
        case 'PATCH':
          respuesta = await http
              .patch(url, headers: cabeceras, body: cuerpoJson)
              .timeout(const Duration(seconds: 15));
          break;
        case 'DELETE':
          respuesta = await http
              .delete(url, headers: cabeceras, body: cuerpoJson)
              .timeout(const Duration(seconds: 15));
          break;
        default:
          respuesta =
              await http.get(url, headers: cabeceras).timeout(const Duration(seconds: 15));
      }
    } catch (e) {
      throw ErrorApi(0, 'No fue posible conectar con el servidor. Revise su conexion.\n$e');
    }

    final datos = respuesta.body.isEmpty ? null : json.decode(respuesta.body);

    // Token expirado: se renueva y se repite la peticion una sola vez.
    if (respuesta.statusCode == 401 &&
        datos is Map &&
        datos['codigo'] == 'TOKEN_EXPIRADO' &&
        !esReintento) {
      if (await _renovar()) {
        return _peticion(metodo, ruta,
            cuerpo: cuerpo,
            conToken: conToken,
            claveIdempotencia: claveIdempotencia,
            esReintento: true);
      }
    }

    if (respuesta.statusCode >= 400) {
      throw ErrorApi(
        respuesta.statusCode,
        (datos is Map ? datos['mensaje'] as String? : null) ??
            'El servidor respondio ${respuesta.statusCode}',
        codigo: datos is Map ? datos['codigo'] as String? : null,
        detalle: datos is Map ? datos['detalle'] : null,
      );
    }

    return datos;
  }

  // -------------------------------------------------------------- catalogo --

  static Future<List<dynamic>> productos({String? busqueda, String? subcategoria}) async {
    final parametros = <String, String>{};
    if (busqueda != null && busqueda.isNotEmpty) parametros['q'] = busqueda;
    if (subcategoria != null && subcategoria.isNotEmpty) parametros['subcategoria'] = subcategoria;

    final consulta = parametros.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');

    final datos = await _peticion('GET', '/catalogo/productos?$consulta', conToken: false);
    return (datos as Map<String, dynamic>)['productos'] as List<dynamic>;
  }

  /// Secciones del catalogo de SerByTek: las subcategorias de cada categoria.
  static Future<List<dynamic>> categorias() async {
    final categorias = await _peticion('GET', '/catalogo/categorias', conToken: false) as List<dynamic>;
    return categorias
        .expand((c) => ((c as Map<String, dynamic>)['subcategorias'] as List<dynamic>? ?? const []))
        .toList();
  }

  // --------------------------------------------------------------- carrito --

  static int get _clienteId => _usuario?['cliente_id'] as int? ?? 0;

  /// Cuanto puede llevar el cliente de cada producto (RF-47: deja 5 para los demas).
  static Future<Map<String, Map<String, dynamic>>> limites(List<String> skus) async {
    if (skus.isEmpty) return {};
    final datos = await _peticion('GET', '/pedidos/limites?skus=${Uri.encodeComponent(skus.join(','))}') as Map<String, dynamic>;
    return {
      for (final l in (datos['limites'] as List<dynamic>? ?? []))
        (l as Map<String, dynamic>)['sku'] as String: l,
    };
  }

  static Future<Map<String, dynamic>> carrito() async =>
      await _peticion('GET', '/carrito/$_clienteId') as Map<String, dynamic>;

  static Future<Map<String, dynamic>> agregarAlCarrito(String sku, {int cantidad = 1}) async =>
      await _peticion('POST', '/carrito/$_clienteId/items',
          cuerpo: {'sku': sku, 'cantidad': cantidad}) as Map<String, dynamic>;

  static Future<Map<String, dynamic>> cambiarCantidad(String sku, int cantidad) async =>
      await _peticion('PATCH', '/carrito/$_clienteId/items/$sku',
          cuerpo: {'cantidad': cantidad}) as Map<String, dynamic>;

  static Future<Map<String, dynamic>> quitarDelCarrito(String sku) async =>
      await _peticion('DELETE', '/carrito/$_clienteId/items/$sku') as Map<String, dynamic>;

  // --------------------------------------------------------------- pedidos --

  /// Checkout. La clave de idempotencia la genera el cliente para que un
  /// reintento por mala conexion no produzca dos pedidos.
  static Future<Map<String, dynamic>> checkout({
    required String medioPago,
    required String tokenMedioPago,
    required String claveIdempotencia,
  }) async {
    return await _peticion(
      'POST',
      '/pedidos/checkout',
      cuerpo: {'medio_pago': medioPago, 'token_medio_pago': tokenMedioPago},
      claveIdempotencia: claveIdempotencia,
    ) as Map<String, dynamic>;
  }

  static Future<List<dynamic>> pedidos() async =>
      await _peticion('GET', '/pedidos') as List<dynamic>;

  static Future<Map<String, dynamic>> pedido(int id) async =>
      await _peticion('GET', '/pedidos/$id') as Map<String, dynamic>;

  static Future<Map<String, dynamic>> cancelarPedido(int id, String motivo) async =>
      await _peticion('POST', '/pedidos/$id/cancelar', cuerpo: {'motivo': motivo})
          as Map<String, dynamic>;
}
