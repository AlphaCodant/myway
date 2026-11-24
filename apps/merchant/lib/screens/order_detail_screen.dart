import 'package:app_core/app_core.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../state/orders_state.dart';

class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.orderId});
  final String orderId;
  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  Order? _order;
  Object? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
    context.read<OrdersState>().addListener(_load);
  }

  @override
  void dispose() {
    _state.removeListener(_load);
    super.dispose();
  }

  late final OrdersState _state = context.read<OrdersState>();

  Future<void> _load() async {
    try {
      final o = Order.fromJson(await context.read<ApiClient>().get('/orders/${widget.orderId}'));
      if (mounted) setState(() => _order = o);
    } catch (e) {
      if (mounted && _order == null) setState(() => _error = e);
    }
  }

  Future<void> _run(Future<Order> Function() fn, {String? done, bool close = false}) async {
    setState(() => _busy = true);
    try {
      final o = await fn();
      if (!mounted) return;
      setState(() => _order = o);
      if (done != null) showInfo(context, done);
      if (close) Navigator.pop(context);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reject() async {
    final reason = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Refuser la commande ?'),
        content: TextField(controller: reason, decoration: const InputDecoration(labelText: 'Raison (facultatif)')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Retour')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger, minimumSize: const Size(120, 48)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Refuser'),
          ),
        ],
      ),
    );
    if (ok == true) {
      await _run(
        () => _state.act(widget.orderId, 'reject', {if (reason.text.trim().isNotEmpty) 'reason': reason.text.trim()}),
        done: 'Commande refusée',
        close: true,
      );
    }
  }

  Future<void> _substitute() async {
    final products = ((await context.read<ApiClient>().get('/merchant/shops/${_state.shopId}/products')) as List)
        .map((p) => Product.fromJson(p))
        .where((p) => p.available)
        .toList();
    if (!mounted) return;
    final choices = await Navigator.push<Map<String, String?>>(
      context,
      MaterialPageRoute(builder: (_) => _SubstitutionScreen(order: _order!, products: products)),
    );
    if (choices == null || choices.isEmpty) return;
    await _run(
      () => _state.act(widget.orderId, 'substitutions', {
        'substitutions': [
          for (final e in choices.entries) {'itemId': e.key, 'substituteProductId': ?e.value},
        ],
      }),
      done: 'Proposition envoyée au client',
    );
  }

  Future<void> _handOver() async {
    final code = await askHandoverCode(context);
    if (code != null) await _run(() => _state.actAsDeliverer(widget.orderId, 'deliver', {'code': code}), done: 'Commande remise ✔');
  }

  Future<void> _call(String target) => startMaskedCall(context, context.read<ApiClient>(), widget.orderId, target);

  @override
  Widget build(BuildContext context) {
    final o = _order;
    return Scaffold(
      appBar: AppBar(title: Text(o?.reference ?? 'Commande')),
      body: o == null
          ? (_error != null ? ErrorView(error: _error!, onRetry: _load) : const Center(child: CircularProgressIndicator()))
          : ListView(padding: const EdgeInsets.all(16), children: [
              Text(statusLabels[o.status] ?? o.status, key: const Key('status'), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
              Text('${deliveryModeLabels[o.deliveryMode]} · ${paymentLabels[o.paymentMethod]}${o.paymentStatus == 'PAID' ? ' (payé)' : ''}',
                  style: const TextStyle(color: AppColors.muted)),
              const SizedBox(height: 12),
              if (o.deliveryMode == 'PLATFORM' && o.dispatchStatus == 'NO_COURIER' && o.isActive)
                const _Banner(icon: Icons.warning_amber, text: 'Aucun livreur disponible pour le moment. Tu peux livrer toi-même ou attendre.'),
              if (o.deliveryMode == 'PLATFORM' && o.dispatchStatus == 'SEARCHING')
                const _Banner(icon: Icons.search, text: 'Recherche d’un livreur…'),
              if (o.courierName != null)
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.two_wheeler, size: 32),
                    title: Text(o.courierName!),
                    subtitle: const Text('Livreur'),
                    trailing: IconButton.filled(onPressed: () => _call('courier'), icon: const Icon(Icons.call)),
                  ),
                ),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    for (final i in o.items) _itemLine(i),
                    const Divider(),
                    Row(children: [
                      const Expanded(child: Text('Total produits', style: TextStyle(fontWeight: FontWeight.w800))),
                      Text(fcfa(o.subtotal), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                    ]),
                  ]),
                ),
              ),
              if (o.note != null)
                _Banner(icon: Icons.sticky_note_2, text: 'Note du client : ${o.note}'),
              if (o.deliveryMode != 'PICKUP' && o.deliveryLandmark != null)
                _Banner(icon: Icons.place, text: 'Livraison : ${o.deliveryLandmark}${o.distanceMeters != null ? ' (${distance(o.distanceMeters)})' : ''}'),
              const SizedBox(height: 16),
              ..._actions(o),
            ]),
    );
  }

  Widget _itemLine(OrderItem i) {
    final substituted = i.status == 'SUBSTITUTED' || i.status == 'SUBSTITUTION_PROPOSED';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        Text('${i.quantity} ×', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            substituted ? '${i.name} → ${i.substituteName ?? 'retiré'}' : i.name,
            style: TextStyle(fontSize: 17, decoration: i.status == 'REMOVED' ? TextDecoration.lineThrough : null),
          ),
        ),
        Text(fcfa(i.unitPrice * i.quantity)),
      ]),
    );
  }

  List<Widget> _actions(Order o) {
    final gap = const SizedBox(height: 10);
    final canSelfDeliver = o.deliveryMode == 'PLATFORM' && o.courierId == null;
    final iDeliver = o.deliveryMode == 'MERCHANT';
    switch (o.status) {
      case 'PENDING':
        return [
          FilledButton.icon(
            key: const Key('accept'),
            style: FilledButton.styleFrom(backgroundColor: AppColors.secondary, minimumSize: const Size.fromHeight(64)),
            onPressed: _busy ? null : () => _run(() => _state.act(o.id, 'accept'), done: 'Commande acceptée'),
            icon: const Icon(Icons.check_circle, size: 28),
            label: const Text('Accepter', style: TextStyle(fontSize: 22)),
          ),
          gap,
          OutlinedButton.icon(onPressed: _busy ? null : _substitute, icon: const Icon(Icons.swap_horiz), label: const Text('Un produit manque')),
          gap,
          TextButton(onPressed: _busy ? null : _reject, child: const Text('Refuser la commande', style: TextStyle(color: AppColors.danger, fontSize: 16))),
        ];
      case 'CONFIRMED':
      case 'READY':
        return [
          if (o.status == 'CONFIRMED')
            FilledButton.icon(
              key: const Key('ready'),
              onPressed: _busy ? null : () => _run(() => _state.act(o.id, 'ready'), done: 'Commande prête'),
              icon: const Icon(Icons.inventory),
              label: const Text('Commande prête'),
            ),
          if (o.deliveryMode == 'PICKUP') ...[
            gap,
            FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: AppColors.secondary),
              onPressed: _busy ? null : _handOver,
              icon: const Icon(Icons.handshake),
              label: const Text('Remettre au client (code)'),
            ),
          ],
          if (iDeliver) ...[
            gap,
            FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: AppColors.secondary),
              onPressed: _busy ? null : () => _run(() => _state.actAsDeliverer(o.id, 'picked-up'), done: 'Bonne route !'),
              icon: const Icon(Icons.delivery_dining),
              label: const Text('Je pars livrer'),
            ),
          ],
          if (canSelfDeliver) ...[
            gap,
            OutlinedButton.icon(
              key: const Key('selfDeliver'),
              onPressed: _busy ? null : () => _run(() => _state.act(o.id, 'self-deliver'), done: 'Tu livres cette commande'),
              icon: const Icon(Icons.storefront),
              label: const Text('Je livre moi-même'),
            ),
          ],
          if (o.deliveryMode != 'PLATFORM') ...[gap, OutlinedButton.icon(onPressed: () => _call('client'), icon: const Icon(Icons.call), label: const Text('Appeler le client'))],
        ];
      case 'PICKED_UP':
        if (!iDeliver) return [const _Banner(icon: Icons.delivery_dining, text: 'Le livreur est en route vers le client.')];
        return [
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: AppColors.secondary),
            onPressed: _busy ? null : _handOver,
            icon: const Icon(Icons.handshake),
            label: const Text('Remettre au client (code)'),
          ),
          gap,
          OutlinedButton.icon(onPressed: () => _call('client'), icon: const Icon(Icons.call), label: const Text('Appeler le client')),
        ];
      default:
        return [];
    }
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.icon, required this.text});
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.symmetric(vertical: 6),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: const Color(0xFFFFF8E1), borderRadius: BorderRadius.circular(12)),
        child: Row(children: [Icon(icon), const SizedBox(width: 10), Expanded(child: Text(text, style: const TextStyle(fontSize: 16)))]),
      );
}

/// Choix des remplacements : pour chaque article manquant, un produit similaire ou « retirer ».
class _SubstitutionScreen extends StatefulWidget {
  const _SubstitutionScreen({required this.order, required this.products});
  final Order order;
  final List<Product> products;
  @override
  State<_SubstitutionScreen> createState() => _SubstitutionScreenState();
}

class _SubstitutionScreenState extends State<_SubstitutionScreen> {
  /// itemId → produit de remplacement (null = retirer). Absent = article disponible.
  final Map<String, String?> _choices = {};

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Produits manquants')),
      body: ListView(padding: const EdgeInsets.all(12), children: [
        const Text('Coche les articles manquants et choisis un remplaçant. Le client devra accepter.', style: TextStyle(color: AppColors.muted)),
        for (final i in widget.order.items)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                CheckboxListTile(
                  value: _choices.containsKey(i.id),
                  title: Text('${i.quantity} × ${i.name}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: const Text('Manquant'),
                  onChanged: (v) => setState(() => v == true ? _choices[i.id] = null : _choices.remove(i.id)),
                ),
                if (_choices.containsKey(i.id))
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: DropdownButtonFormField<String?>(
                      initialValue: _choices[i.id],
                      decoration: const InputDecoration(labelText: 'Remplacer par'),
                      items: [
                        const DropdownMenuItem(value: null, child: Text('Rien (retirer l’article)')),
                        for (final p in widget.products.where((p) => p.id != i.productId))
                          DropdownMenuItem(value: p.id, child: Text('${p.name} · ${fcfa(p.price)}')),
                      ],
                      onChanged: (v) => setState(() => _choices[i.id] = v),
                    ),
                  ),
              ]),
            ),
          ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: _choices.isEmpty ? null : () => Navigator.pop(context, _choices),
          child: const Text('Envoyer au client'),
        ),
      ]),
    );
  }
}
