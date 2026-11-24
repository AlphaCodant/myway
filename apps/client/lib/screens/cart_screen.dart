import 'dart:math';

import 'package:app_core/app_core.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../l10n/fr.dart';
import '../state/cart_state.dart';
import '../state/outbox.dart';
import 'address_form_screen.dart';
import 'order_tracking_screen.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});
  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  String _mode = 'PLATFORM';
  String _payment = 'CASH';
  String? _addressId;
  List<Address> _addresses = [];
  Map<String, dynamic>? _quote;
  String? _quoteError;
  bool _busy = false;
  final _note = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadAddresses();
  }

  Future<void> _loadAddresses() async {
    try {
      final rows = await context.read<ApiClient>().get('/me/addresses', cache: true) as List;
      setState(() {
        _addresses = rows.map((r) => Address.fromJson(r)).toList();
        _addressId ??= _addresses.isNotEmpty ? _addresses.first.id : null;
      });
    } catch (_) {}
    _refreshQuote();
  }

  Map<String, dynamic> _body() {
    final cart = context.read<CartState>();
    return {
      'shopId': cart.shopId,
      'items': cart.toItems(),
      'deliveryMode': _mode,
      if (_mode != 'PICKUP' && _addressId != null) 'addressId': _addressId,
    };
  }

  Future<void> _refreshQuote() async {
    final cart = context.read<CartState>();
    if (cart.isEmpty || (_mode != 'PICKUP' && _addressId == null)) {
      setState(() => _quote = null);
      return;
    }
    try {
      final q = await context.read<ApiClient>().post('/orders/quote', _body());
      setState(() {
        _quote = q;
        _quoteError = null;
      });
    } on ApiException catch (e) {
      setState(() {
        _quote = null;
        _quoteError = e.isNetwork ? null : e.message;
      });
    }
  }

  Future<void> _order() async {
    final cart = context.read<CartState>();
    final body = {
      ..._body(),
      'paymentMethod': _payment,
      if (_note.text.trim().isNotEmpty) 'note': _note.text.trim(),
      'clientRequestId': '${DateTime.now().millisecondsSinceEpoch}-${Random().nextInt(1 << 30)}',
    };
    setState(() => _busy = true);
    try {
      final res = await context.read<ApiClient>().post('/orders', body);
      cart.clear();
      if (!mounted) return;
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => OrderTrackingScreen(orderId: res['id'], initialPayment: res['payment'])));
    } on ApiException catch (e) {
      if (e.isNetwork) {
        // Pas de réseau : la commande part dès que la connexion revient.
        await context.read<OrderOutbox>().enqueue(body);
        cart.clear();
        if (!mounted) return;
        showInfo(context, T.orderQueued);
        Navigator.pop(context);
      } else if (mounted) {
        showError(context, e);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartState>();
    if (cart.isEmpty) {
      return Scaffold(appBar: AppBar(title: const Text(T.cart)), body: const Center(child: Text(T.emptyCart)));
    }
    final needsAddress = _mode != 'PICKUP';
    final canOrder = !_busy && (!needsAddress || _addressId != null) && _quoteError == null;
    return Scaffold(
      appBar: AppBar(title: Text(cart.shopName ?? T.cart)),
      body: ListView(padding: const EdgeInsets.only(bottom: 24), children: [
        for (final l in cart.lines)
          ListTile(
            title: Text(l.product.name, style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(fcfa(l.product.price)),
            trailing: Row(mainAxisSize: MainAxisSize.min, children: [
              IconButton(onPressed: () {
                cart.decrement(l.product.id);
                _refreshQuote();
              }, icon: const Icon(Icons.remove_circle_outline)),
              Text('${l.quantity}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(width: 12),
              SizedBox(width: 84, child: Text(fcfa(l.total), textAlign: TextAlign.right, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
            ]),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: TextField(controller: _note, maxLines: 2, decoration: const InputDecoration(labelText: T.noteForShop)),
        ),
        _section(T.delivery),
        RadioGroup<String>(
          groupValue: _mode,
          onChanged: (v) {
            setState(() => _mode = v!);
            _refreshQuote();
          },
          child: Column(children: [
            const RadioListTile(value: 'PLATFORM', title: Text('Livraison par un livreur'), secondary: Icon(Icons.two_wheeler)),
            if (cart.shopSelfDelivery) const RadioListTile(value: 'MERCHANT', title: Text(T.merchantDelivers), secondary: Icon(Icons.storefront)),
            const RadioListTile(value: 'PICKUP', title: Text(T.pickup), secondary: Icon(Icons.directions_walk)),
          ]),
        ),
        if (needsAddress) ...[
          _section(T.deliveryAddress),
          RadioGroup<String>(
            groupValue: _addressId,
            onChanged: (v) {
              setState(() => _addressId = v);
              _refreshQuote();
            },
            child: Column(children: [
              for (final a in _addresses)
                RadioListTile(value: a.id, title: Text(a.label), subtitle: a.landmarkText == null ? null : Text(a.landmarkText!)),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: OutlinedButton.icon(
              key: const Key('addAddress'),
              icon: const Icon(Icons.add_location_alt),
              label: const Text(T.addAddress),
              onPressed: () async {
                final created = await Navigator.push<Address>(context, MaterialPageRoute(builder: (_) => const AddressFormScreen()));
                if (created != null) {
                  _addressId = created.id;
                  await _loadAddresses();
                }
              },
            ),
          ),
        ],
        _section(T.payment),
        RadioGroup<String>(
          groupValue: _payment,
          onChanged: (v) => setState(() => _payment = v!),
          child: Column(children: [
            for (final e in paymentLabels.entries)
              RadioListTile(value: e.key, title: Text(e.value), secondary: Icon(e.key == 'CASH' ? Icons.payments : Icons.phone_android)),
          ]),
        ),
        const Divider(height: 32),
        if (_quoteError != null)
          Padding(padding: const EdgeInsets.all(16), child: Text(_quoteError!, style: const TextStyle(color: AppColors.danger))),
        _line(T.subtotal, fcfa(_quote?['subtotal'] ?? cart.subtotal)),
        if (needsAddress) _line(T.deliveryFee, _quote == null ? '…' : fcfa(_quote!['deliveryFee'])),
        _line(T.total, _quote == null ? fcfa(cart.subtotal) : fcfa(_quote!['total']), bold: true),
        Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton(key: const Key('order'), onPressed: canOrder ? _order : null, child: Text(_busy ? '…' : T.order)),
        ),
      ]),
    );
  }

  Widget _section(String title) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
        child: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
      );

  Widget _line(String label, String value, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: Row(children: [
          Expanded(child: Text(label, style: TextStyle(fontSize: bold ? 20 : 16, fontWeight: bold ? FontWeight.w800 : FontWeight.w400))),
          Text(value, style: TextStyle(fontSize: bold ? 20 : 16, fontWeight: bold ? FontWeight.w800 : FontWeight.w600)),
        ]),
      );
}
