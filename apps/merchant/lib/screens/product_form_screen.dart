import 'package:app_core/app_core.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

/// Ajout / modification d'un produit : photo + nom + prix (+ rayon).
class ProductFormScreen extends StatefulWidget {
  const ProductFormScreen({super.key, required this.shopId, this.product});
  final String shopId;
  final Product? product;
  @override
  State<ProductFormScreen> createState() => _ProductFormScreenState();
}

class _ProductFormScreenState extends State<ProductFormScreen> {
  late final _name = TextEditingController(text: widget.product?.name);
  late final _price = TextEditingController(text: widget.product?.price.toString());
  late final _section = TextEditingController(text: widget.product?.section);
  late String? _photoUrl = widget.product?.photoUrl;
  bool _busy = false;

  ApiClient get _api => context.read<ApiClient>();

  Future<void> _photo(ImageSource source) async {
    // Photo réduite avant l'envoi : objectif < 80 Ko par produit.
    final img = await ImagePicker().pickImage(source: source, maxWidth: 600, imageQuality: 55);
    if (img == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final url = await _api.upload(await img.readAsBytes(), img.name);
      setState(() => _photoUrl = url);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save() async {
    final price = int.tryParse(_price.text.replaceAll(' ', ''));
    if (_name.text.trim().isEmpty || price == null) {
      showError(context, ApiException(400, 'Indique le nom et le prix'));
      return;
    }
    final body = {
      'name': _name.text.trim(),
      'price': price,
      if (_section.text.trim().isNotEmpty) 'section': _section.text.trim(),
      'photoUrl': ?_photoUrl,
    };
    setState(() => _busy = true);
    try {
      if (widget.product == null) {
        await _api.post('/merchant/shops/${widget.shopId}/products', body);
      } else {
        await _api.patch('/merchant/shops/${widget.shopId}/products/${widget.product!.id}', body);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete() async {
    setState(() => _busy = true);
    try {
      await _api.delete('/merchant/shops/${widget.shopId}/products/${widget.product!.id}');
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.product == null ? 'Nouveau produit' : 'Modifier le produit')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Center(child: NetImage(url: _photoUrl == null ? null : _api.fileUrl(_photoUrl), icon: Icons.add_a_photo, size: 140)),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: OutlinedButton.icon(onPressed: _busy ? null : () => _photo(ImageSource.camera), icon: const Icon(Icons.photo_camera), label: const Text('Photo'))),
          const SizedBox(width: 8),
          Expanded(child: OutlinedButton.icon(onPressed: _busy ? null : () => _photo(ImageSource.gallery), icon: const Icon(Icons.photo_library), label: const Text('Galerie'))),
        ]),
        const SizedBox(height: 16),
        TextField(key: const Key('productName'), controller: _name, decoration: const InputDecoration(labelText: 'Nom du produit')),
        const SizedBox(height: 12),
        TextField(
          key: const Key('productPrice'),
          controller: _price,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
          decoration: const InputDecoration(labelText: 'Prix', suffixText: 'FCFA'),
        ),
        const SizedBox(height: 12),
        TextField(controller: _section, decoration: const InputDecoration(labelText: 'Rayon (ex. Boissons, Plats du jour)')),
        const SizedBox(height: 24),
        FilledButton(key: const Key('saveProduct'), onPressed: _busy ? null : _save, child: const Text('Enregistrer')),
        if (widget.product != null)
          TextButton(onPressed: _busy ? null : _delete, child: const Text('Supprimer ce produit', style: TextStyle(color: AppColors.danger))),
      ]),
    );
  }
}
