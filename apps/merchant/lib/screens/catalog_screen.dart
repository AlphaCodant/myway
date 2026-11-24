import 'package:app_core/app_core.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import 'product_form_screen.dart';

/// Catalogue d'un commerce : rupture en un clic, ajout et modification de produits.
/// Utilisé par le commerçant (onglet) et par l'agent terrain (écran).
class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key, required this.shopId, this.embedded = false, this.title});
  final String shopId;
  final bool embedded;
  final String? title;
  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  List<Product>? _products;
  Object? _error;

  ApiClient get _api => context.read<ApiClient>();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final rows = await _api.get('/merchant/shops/${widget.shopId}/products', cache: true) as List;
      setState(() {
        _products = rows.map((r) => Product.fromJson(r)).toList();
        _error = null;
      });
    } catch (e) {
      setState(() => _error = e);
    }
  }

  Future<void> _toggle(Product p, bool available) async {
    try {
      await _api.post('/merchant/shops/${widget.shopId}/products/${p.id}/availability', {'available': available});
      await _load();
      if (mounted) showInfo(context, available ? '${p.name} : disponible' : '${p.name} : en rupture');
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Future<void> _edit([Product? p]) async {
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => ProductFormScreen(shopId: widget.shopId, product: p)),
    );
    if (saved == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final body = _products == null
        ? (_error != null ? ErrorView(error: _error!, onRetry: _load) : const Center(child: CircularProgressIndicator()))
        : RefreshIndicator(
            onRefresh: _load,
            child: ListView(padding: const EdgeInsets.only(bottom: 96), children: [
              if (_products!.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(32),
                  child: Text('Aucun produit. Ajoute tes produits avec une photo et un prix.', textAlign: TextAlign.center),
                ),
              for (final p in _products!)
                Card(
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    leading: NetImage(url: p.photoUrl == null ? null : _api.fileUrl(p.photoUrl), icon: Icons.inventory_2, size: 52),
                    title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text(
                      '${fcfa(p.price)}${p.section != null ? ' · ${p.section}' : ''}\n${p.available ? 'Disponible' : 'EN RUPTURE'}',
                      style: TextStyle(color: p.available ? null : AppColors.danger),
                    ),
                    isThreeLine: true,
                    onTap: () => _edit(p),
                    trailing: Switch(key: Key('avail-${p.id}'), value: p.available, onChanged: (v) => _toggle(p, v)),
                  ),
                ),
            ]),
          );
    final fab = FloatingActionButton.extended(
      key: const Key('addProduct'),
      onPressed: () => _edit(),
      icon: const Icon(Icons.add_a_photo),
      label: const Text('Ajouter un produit'),
    );
    if (widget.embedded) return Scaffold(body: body, floatingActionButton: fab);
    return Scaffold(appBar: AppBar(title: Text(widget.title ?? 'Catalogue')), body: body, floatingActionButton: fab);
  }
}
