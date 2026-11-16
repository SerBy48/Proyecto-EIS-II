import 'dart:math';
import 'package:flutter/material.dart';
import '../servicios/api_service.dart';
import 'catalogo_pantalla.dart' show moneda;

/// Carrito y checkout.
///
/// Muestra los tres desenlaces posibles de la saga de compra de forma
/// diferenciada, porque para el usuario NO significan lo mismo:
///   - confirmada      -> hay pedido y hubo cobro
///   - pago rechazado  -> hay pedido cancelado y NO hubo cobro
///   - stock agotado   -> no paso nada; el carrito se conserva
class CarritoPantalla extends StatefulWidget {
  const CarritoPantalla({super.key});

  @override
  State<CarritoPantalla> createState() => _CarritoPantallaState();
}

class _CarritoPantallaState extends State<CarritoPantalla> {
  Map<String, dynamic>? _carrito;
  bool _cargando = true;
  bool _procesando = false;
  String? _error;

  String _medioPago = 'tarjeta_credito';
  String _tokenTarjeta = 'tok_ok_4242';
  late String _claveIdempotencia;

  @override
  void initState() {
    super.initState();
    _claveIdempotencia = _nuevaClave();
    _cargar();
  }

  String _nuevaClave() {
    final aleatorio = Random().nextInt(1 << 32).toRadixString(36);
    return 'movil-${DateTime.now().millisecondsSinceEpoch}-$aleatorio';
  }

  Future<void> _cargar() async {
    setState(() => _cargando = true);
    try {
      final carrito = await ApiService.carrito();
      if (!mounted) return;
      setState(() {
        _carrito = carrito;
        _cargando = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _cargando = false;
      });
    }
  }

  Future<void> _cambiar(String sku, int cantidad) async {
    try {
      final carrito = cantidad <= 0
          ? await ApiService.quitarDelCarrito(sku)
          : await ApiService.cambiarCantidad(sku, cantidad);
      if (!mounted) return;
      setState(() => _carrito = carrito);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    }
  }

  Future<void> _pagar() async {
    setState(() {
      _procesando = true;
      _error = null;
    });

    try {
      final resultado = await ApiService.checkout(
        medioPago: _medioPago,
        tokenMedioPago: _tokenTarjeta,
        claveIdempotencia: _claveIdempotencia,
      );

      _claveIdempotencia = _nuevaClave();
      if (!mounted) return;

      final pedido = (resultado['pedido'] ?? resultado) as Map<String, dynamic>;
      await _mostrarExito(pedido);
      await _cargar();
    } on ErrorApi catch (e) {
      _claveIdempotencia = _nuevaClave();
      if (!mounted) return;

      if (e.codigo == 'PAGO_RECHAZADO') {
        await _mostrarRechazo(e);
        await _cargar();
      } else if (e.codigo == 'STOCK_INSUFICIENTE') {
        final sku = (e.detalle is Map) ? e.detalle['sku'] : '';
        setState(() => _error =
            'Se agoto $sku mientras completabas la compra. Ajusta la cantidad e intenta de nuevo.');
        await _cargar();
      } else {
        setState(() => _error = e.mensaje);
      }
    } finally {
      if (mounted) setState(() => _procesando = false);
    }
  }

  Future<void> _mostrarExito(Map<String, dynamic> pedido) => showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          icon: Icon(Icons.check_circle, color: Colors.green.shade600, size: 48),
          title: const Text('Compra confirmada'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Pedido ${pedido['numero']}',
                  style: const TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 6),
              Text(moneda(pedido['total']), style: const TextStyle(fontSize: 20)),
              const SizedBox(height: 12),
              const Text(
                'Recibiras la confirmacion por correo. El envio es asincrono, '
                'asi que puede tardar unos segundos.',
                style: TextStyle(fontSize: 12, color: Colors.grey),
                textAlign: TextAlign.center,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Entendido'),
            ),
          ],
        ),
      );

  Future<void> _mostrarRechazo(ErrorApi e) => showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          icon: Icon(Icons.warning_amber_rounded, color: Colors.orange.shade700, size: 48),
          title: const Text('No pudimos procesar el pago'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(e.mensaje),
              const SizedBox(height: 12),
              const Text('Que paso con tu compra:',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              const SizedBox(height: 6),
              const Text(
                '· El pedido quedo registrado como cancelado.\n'
                '· No se realizo ningun cobro.\n'
                '· Los productos volvieron a estar disponibles.\n'
                '· Tu carrito se conserva: prueba con otro medio de pago.',
                style: TextStyle(fontSize: 12),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Volver')),
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    final items = (_carrito?['items'] as List<dynamic>?) ?? [];
    final totales = (_carrito?['totales'] as Map<String, dynamic>?) ?? {};

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mi carrito'),
        backgroundColor: const Color(0xFF047857),
        foregroundColor: Colors.white,
      ),
      body: _cargando
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                if (_error != null)
                  Container(
                    width: double.infinity,
                    color: Colors.red.shade50,
                    padding: const EdgeInsets.all(12),
                    child: Text(_error!, style: TextStyle(color: Colors.red.shade900)),
                  ),
                Expanded(
                  child: items.isEmpty
                      ? const Center(child: Text('Tu carrito esta vacio.'))
                      : ListView.builder(
                          itemCount: items.length,
                          itemBuilder: (context, i) {
                            final item = items[i] as Map<String, dynamic>;
                            final cantidad = (item['cantidad'] as num).toInt();
                            return Card(
                              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              child: ListTile(
                                title: Text(item['nombre'] as String,
                                    style: const TextStyle(fontWeight: FontWeight.bold)),
                                subtitle: Text(
                                    '${item['sku']} · ${moneda(item['precio_unitario'])} c/u'),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.remove_circle_outline),
                                      onPressed: () =>
                                          _cambiar(item['sku'] as String, cantidad - 1),
                                    ),
                                    Text('$cantidad',
                                        style: const TextStyle(fontWeight: FontWeight.bold)),
                                    IconButton(
                                      icon: const Icon(Icons.add_circle_outline),
                                      onPressed: () =>
                                          _cambiar(item['sku'] as String, cantidad + 1),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                ),
                if (items.isNotEmpty) _resumen(totales),
              ],
            ),
    );
  }

  Widget _resumen(Map<String, dynamic> totales) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 8)],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _linea('Subtotal', moneda(totales['subtotal'])),
            if ((totales['descuento'] as num? ?? 0) > 0)
              _linea('Descuento', '-${moneda(totales['descuento'])}', color: Colors.green),
            _linea('IVA (19%)', moneda(totales['impuestos'])),
            _linea('Envio',
                (totales['envio'] as num? ?? 0) == 0 ? 'Gratis' : moneda(totales['envio'])),
            const Divider(),
            _linea('Total', moneda(totales['total']), negrita: true),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _medioPago,
              decoration: const InputDecoration(
                labelText: 'Medio de pago',
                border: OutlineInputBorder(),
                isDense: true,
              ),
              items: const [
                DropdownMenuItem(value: 'tarjeta_credito', child: Text('Tarjeta de credito')),
                DropdownMenuItem(value: 'tarjeta_debito', child: Text('Tarjeta debito')),
                DropdownMenuItem(value: 'pse', child: Text('PSE')),
                DropdownMenuItem(value: 'efecty', child: Text('Efecty')),
              ],
              onChanged: (v) => setState(() => _medioPago = v!),
            ),
            const SizedBox(height: 8),
            // En produccion este token lo genera la pasarela. Aqui se expone
            // para poder probar los distintos desenlaces del pago.
            DropdownButtonFormField<String>(
              initialValue: _tokenTarjeta,
              decoration: const InputDecoration(
                labelText: 'Token de la pasarela (pruebas)',
                border: OutlineInputBorder(),
                isDense: true,
              ),
              items: const [
                DropdownMenuItem(value: 'tok_ok_4242', child: Text('tok_ok_4242 (aprueba)')),
                DropdownMenuItem(
                    value: 'tok_rechazo_1111', child: Text('tok_rechazo_1111 (rechaza)')),
                DropdownMenuItem(
                    value: 'tok_error_9999', child: Text('tok_error_9999 (falla)')),
              ],
              onChanged: (v) => setState(() => _tokenTarjeta = v!),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _procesando ? null : _pagar,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF047857),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: Text(_procesando
                    ? 'Procesando la compra...'
                    : 'Pagar ${moneda(totales['total'])}'),
              ),
            ),
          ],
        ),
      );

  Widget _linea(String etiqueta, String valor, {bool negrita = false, Color? color}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(etiqueta,
                style: TextStyle(
                    fontWeight: negrita ? FontWeight.bold : FontWeight.normal, color: color)),
            Text(valor,
                style: TextStyle(
                    fontWeight: negrita ? FontWeight.bold : FontWeight.normal,
                    fontSize: negrita ? 16 : 14,
                    color: color)),
          ],
        ),
      );
}
