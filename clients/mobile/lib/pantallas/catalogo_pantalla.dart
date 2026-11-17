import 'package:flutter/material.dart';
import '../servicios/api_service.dart';
import 'carrito_pantalla.dart';
import 'pedidos_pantalla.dart';

String moneda(dynamic valor) {
  final numero = double.tryParse(valor?.toString() ?? '0') ?? 0;
  final entero = numero.round().toString();
  final conSeparadores = entero.replaceAllMapped(
    RegExp(r'(\d)(?=(\d{3})+$)'),
    (m) => '${m[1]}.',
  );
  return '\$$conSeparadores';
}

/// Catalogo de productos.
///
/// El indicador de disponibilidad distingue tres casos: disponible, agotado y
/// "no verificada" (cuando el servicio de inventario no respondio). Ese tercer
/// estado es la degradacion elegante: la app no afirma que hay stock si no
/// pudo comprobarlo.
class CatalogoPantalla extends StatefulWidget {
  const CatalogoPantalla({super.key});

  @override
  State<CatalogoPantalla> createState() => _CatalogoPantallaState();
}

class _CatalogoPantallaState extends State<CatalogoPantalla> {
  final _busquedaCtrl = TextEditingController();
  List<dynamic> _productos = [];
  List<dynamic> _categorias = [];
  String? _categoriaSeleccionada;
  bool _cargando = true;
  String? _error;
  int _itemsCarrito = 0;

  @override
  void initState() {
    super.initState();
    _cargar();
    _actualizarCarrito();
  }

  @override
  void dispose() {
    _busquedaCtrl.dispose();
    super.dispose();
  }

  Future<void> _cargar() async {
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      final productos = await ApiService.productos(
        busqueda: _busquedaCtrl.text,
        subcategoria: _categoriaSeleccionada,
      );
      final categorias = _categorias.isEmpty ? await ApiService.categorias() : _categorias;
      if (!mounted) return;
      setState(() {
        _productos = productos;
        _categorias = categorias;
        _cargando = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _cargando = false;
      });
    }
  }

  Future<void> _actualizarCarrito() async {
    if (!ApiService.autenticado) return;
    try {
      final carrito = await ApiService.carrito();
      if (!mounted) return;
      setState(() => _itemsCarrito = (carrito['cantidad_items'] as num?)?.toInt() ?? 0);
    } catch (_) {
      // El contador del carrito no es critico.
    }
  }

  Future<void> _agregar(String sku) async {
    try {
      await ApiService.agregarAlCarrito(sku);
      await _actualizarCarrito();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$sku agregado al carrito'), duration: const Duration(seconds: 2)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red.shade700),
      );
    }
  }

  Widget _indicadorStock(Map<String, dynamic> p) {
    final hayStock = p['hay_stock'];
    final disponible = p['disponible'];

    if (hayStock == null) {
      return const Text('Disponibilidad no verificada',
          style: TextStyle(fontSize: 11, color: Colors.grey));
    }
    if (hayStock == false) {
      return Text('Agotado',
          style: TextStyle(fontSize: 11, color: Colors.red.shade700, fontWeight: FontWeight.bold));
    }
    if (disponible is int && disponible <= 3) {
      return Text('Ultimas $disponible unidades',
          style: TextStyle(fontSize: 11, color: Colors.orange.shade800, fontWeight: FontWeight.bold));
    }
    return Text('Disponible',
        style: TextStyle(fontSize: 11, color: Colors.green.shade700, fontWeight: FontWeight.bold));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('SerByTek'),
        backgroundColor: const Color(0xFF047857),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.receipt_long),
            tooltip: 'Mis pedidos',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const PedidosPantalla()),
            ),
          ),
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.shopping_cart),
                tooltip: 'Carrito',
                onPressed: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const CarritoPantalla()),
                  );
                  await _actualizarCarrito();
                  await _cargar();
                },
              ),
              if (_itemsCarrito > 0)
                Positioned(
                  right: 6,
                  top: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(
                      color: Colors.red,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text('$_itemsCarrito',
                        style: const TextStyle(color: Colors.white, fontSize: 10)),
                  ),
                ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Salir',
            onPressed: () async {
              await ApiService.cerrarSesion();
              if (context.mounted) Navigator.of(context).pushReplacementNamed('/');
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                TextField(
                  controller: _busquedaCtrl,
                  decoration: InputDecoration(
                    hintText: 'Buscar productos...',
                    prefixIcon: const Icon(Icons.search),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    isDense: true,
                  ),
                  onSubmitted: (_) => _cargar(),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 36,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      _chip('Todas', null),
                      ..._categorias.map(
                        (c) => _chip(c['nombre'] as String, c['slug'] as String),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(child: _cuerpo()),
        ],
      ),
    );
  }

  Widget _chip(String etiqueta, String? valor) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: ChoiceChip(
          label: Text(etiqueta),
          selected: _categoriaSeleccionada == valor,
          onSelected: (_) {
            setState(() => _categoriaSeleccionada = valor);
            _cargar();
          },
        ),
      );

  Widget _cuerpo() {
    if (_cargando) return const Center(child: CircularProgressIndicator());

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.cloud_off, size: 48, color: Colors.grey),
              const SizedBox(height: 12),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: _cargar, child: const Text('Reintentar')),
            ],
          ),
        ),
      );
    }

    if (_productos.isEmpty) {
      return const Center(child: Text('No se encontraron productos.'));
    }

    return RefreshIndicator(
      onRefresh: _cargar,
      child: ListView.builder(
        itemCount: _productos.length,
        itemBuilder: (context, i) {
          final p = _productos[i] as Map<String, dynamic>;
          final agotado = p['hay_stock'] == false;
          final descuento = (p['descuento_porcentaje'] as num?)?.toInt() ?? 0;

          return Card(
            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: Colors.green.shade50,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.inventory_2_outlined, color: Color(0xFF047857)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(p['marca']?.toString().toUpperCase() ?? '',
                            style: const TextStyle(fontSize: 10, color: Colors.grey)),
                        Text(p['nombre'] as String,
                            style: const TextStyle(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Text(moneda(p['precio_final']),
                                style: const TextStyle(
                                    fontSize: 16, fontWeight: FontWeight.bold)),
                            if (descuento > 0) ...[
                              const SizedBox(width: 6),
                              Text(
                                moneda(p['precio']),
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey,
                                  decoration: TextDecoration.lineThrough,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Container(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                decoration: BoxDecoration(
                                  color: Colors.red.shade100,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text('-$descuento%',
                                    style: TextStyle(
                                        fontSize: 10,
                                        color: Colors.red.shade800,
                                        fontWeight: FontWeight.bold)),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 4),
                        _indicadorStock(p),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.add_shopping_cart),
                    color: const Color(0xFF047857),
                    onPressed: agotado ? null : () => _agregar(p['sku'] as String),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
