import 'package:flutter/material.dart';
import 'pantallas/catalogo_pantalla.dart';
import 'pantallas/login_pantalla.dart';
import 'servicios/api_service.dart';

/// App movil de la plataforma de comercio electronico.
///
/// Consume exactamente la misma API RESTful que el cliente web, a traves del
/// mismo API Gateway. Es la demostracion practica del punto unico de entrada:
/// dos clientes muy distintos, un solo contrato.
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Se restaura la sesion guardada para no pedir el login en cada apertura.
  await ApiService.cargarSesion();
  runApp(const TiendaApp());
}

class TiendaApp extends StatelessWidget {
  const TiendaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Tienda en linea',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
        useMaterial3: true,
      ),
      routes: {'/': (_) => const LoginPantalla()},
      home: ApiService.autenticado ? const CatalogoPantalla() : const LoginPantalla(),
    );
  }
}
