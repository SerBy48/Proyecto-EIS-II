import 'package:flutter/material.dart';
import '../config.dart';
import '../servicios/api_service.dart';
import 'catalogo_pantalla.dart';

class LoginPantalla extends StatefulWidget {
  const LoginPantalla({super.key});

  @override
  State<LoginPantalla> createState() => _LoginPantallaState();
}

class _LoginPantallaState extends State<LoginPantalla> {
  final _emailCtrl = TextEditingController(text: 'ana@correo.co');
  final _passCtrl = TextEditingController(text: 'Password123');
  bool _cargando = false;
  String? _error;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _ingresar() async {
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      await ApiService.login(_emailCtrl.text.trim(), _passCtrl.text);
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const CatalogoPantalla()),
      );
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.storefront, size: 64, color: Colors.indigo),
                const SizedBox(height: 8),
                const Text('Tienda en linea',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                const Text('Conectado a ${Config.gateway}',
                    style: TextStyle(fontSize: 11, color: Colors.grey)),
                const SizedBox(height: 28),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(_error!,
                        style: const TextStyle(color: Colors.red), textAlign: TextAlign.center),
                  ),
                TextField(
                  controller: _emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Correo',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _passCtrl,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Contrasena',
                    border: OutlineInputBorder(),
                  ),
                  onSubmitted: (_) => _ingresar(),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _cargando ? null : _ingresar,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.indigo,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: Text(_cargando ? 'Verificando...' : 'Ingresar'),
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Cuentas de prueba (contrasena Password123):\n'
                  'ana@correo.co · bruno@correo.co',
                  style: TextStyle(fontSize: 11, color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
