import 'package:flutter/material.dart';
import '../servicios/api_service.dart';
import 'catalogo_pantalla.dart' show moneda;

/// Historial de pedidos del cliente con su ciclo de vida.
class PedidosPantalla extends StatefulWidget {
  const PedidosPantalla({super.key});

  @override
  State<PedidosPantalla> createState() => _PedidosPantallaState();
}

class _PedidosPantallaState extends State<PedidosPantalla> {
  List<dynamic> _pedidos = [];
  bool _cargando = true;
  String? _error;

  static const _colores = {
    'creado': Colors.grey,
    'pagado': Colors.blue,
    'en_preparacion': Colors.orange,
    'enviado': Colors.indigo,
    'entregado': Colors.green,
    'cancelado': Colors.red,
  };

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    setState(() => _cargando = true);
    try {
      final pedidos = await ApiService.pedidos();
      if (!mounted) return;
      setState(() {
        _pedidos = pedidos;
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

  Future<void> _verDetalle(int id) async {
    try {
      final pedido = await ApiService.pedido(id);
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        builder: (_) => _DetallePedido(pedido: pedido, alCancelar: () async {
          await ApiService.cancelarPedido(id, 'Cancelado desde la app movil');
          if (mounted) Navigator.pop(context);
          await _cargar();
        }),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mis pedidos'),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _cargar)],
      ),
      body: _cargando
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!)))
              : _pedidos.isEmpty
                  ? const Center(child: Text('Aun no tienes pedidos.'))
                  : RefreshIndicator(
                      onRefresh: _cargar,
                      child: ListView.builder(
                        itemCount: _pedidos.length,
                        itemBuilder: (context, i) {
                          final p = _pedidos[i] as Map<String, dynamic>;
                          final estado = p['estado'] as String;
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            child: ListTile(
                              title: Text(p['numero'] as String,
                                  style: const TextStyle(fontWeight: FontWeight.bold)),
                              subtitle: Text(
                                '${p['cantidad_items']} producto(s) · ${moneda(p['total'])}',
                              ),
                              trailing: Chip(
                                label: Text(estado.replaceAll('_', ' '),
                                    style: const TextStyle(fontSize: 11, color: Colors.white)),
                                backgroundColor: _colores[estado] ?? Colors.grey,
                                padding: EdgeInsets.zero,
                              ),
                              onTap: () => _verDetalle((p['id'] as num).toInt()),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}

class _DetallePedido extends StatelessWidget {
  final Map<String, dynamic> pedido;
  final Future<void> Function() alCancelar;

  const _DetallePedido({required this.pedido, required this.alCancelar});

  @override
  Widget build(BuildContext context) {
    final items = (pedido['items'] as List<dynamic>?) ?? [];
    final historial = (pedido['historial'] as List<dynamic>?) ?? [];
    final cancelable = ['creado', 'pagado'].contains(pedido['estado']);

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      builder: (_, controlador) => ListView(
        controller: controlador,
        padding: const EdgeInsets.all(20),
        children: [
          Text(pedido['numero'] as String,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          Text('Estado: ${pedido['estado']}', style: const TextStyle(color: Colors.grey)),
          const Divider(height: 24),
          ...items.map((i) {
            final item = i as Map<String, dynamic>;
            return ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              title: Text(item['nombre'] as String),
              subtitle: Text('${item['cantidad']} x ${moneda(item['precio_unitario'])}'),
              trailing: Text(moneda(item['subtotal']),
                  style: const TextStyle(fontWeight: FontWeight.bold)),
            );
          }),
          const Divider(),
          _linea('Subtotal', moneda(pedido['subtotal'])),
          _linea('IVA', moneda(pedido['impuestos'])),
          _linea('Envio', moneda(pedido['envio'])),
          _linea('Total', moneda(pedido['total']), negrita: true),
          if (historial.isNotEmpty) ...[
            const Divider(height: 24),
            const Text('Historial', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...historial.map((h) {
              final paso = h as Map<String, dynamic>;
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Text(
                  '${paso['estado_anterior'] ?? ''} → ${paso['estado_nuevo']}'
                  '${paso['motivo'] != null ? ' · ${paso['motivo']}' : ''}',
                  style: const TextStyle(fontSize: 12),
                ),
              );
            }),
          ],
          if (cancelable) ...[
            const SizedBox(height: 20),
            OutlinedButton(
              onPressed: alCancelar,
              style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
              child: const Text('Cancelar pedido'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _linea(String etiqueta, String valor, {bool negrita = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(etiqueta,
                style: TextStyle(fontWeight: negrita ? FontWeight.bold : FontWeight.normal)),
            Text(valor,
                style: TextStyle(fontWeight: negrita ? FontWeight.bold : FontWeight.normal)),
          ],
        ),
      );
}
