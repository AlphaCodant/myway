import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../l10n/fr.dart';
import 'report_screen.dart';

const _steps = ['PENDING', 'CONFIRMED', 'READY', 'PICKED_UP', 'DELIVERED'];

class OrderTrackingScreen extends StatefulWidget {
  const OrderTrackingScreen({super.key, required this.orderId, this.initialPayment});
  final String orderId;
  final Map<String, dynamic>? initialPayment;
  @override
  State<OrderTrackingScreen> createState() => _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends State<OrderTrackingScreen> {
  Order? _order;
  Object? _error;
  bool _busy = false;
  StreamSubscription? _sub;
  Timer? _poll;
  int _shopScore = 0;
  int _courierScore = 0;
  bool _rated = false;

  @override
  void initState() {
    super.initState();
    _load();
    _sub = context.read<Realtime>().orderUpdates.where((u) => u['orderId'] == widget.orderId).listen((_) => _load());
    // Repli si le temps réel est coupé (réseau instable) : rafraîchissement toutes les 30 s.
    _poll = Timer.periodic(const Duration(seconds: 30), (_) => _order?.isActive == true ? _load() : null);
  }

  @override
  void dispose() {
    _sub?.cancel();
    _poll?.cancel();
    super.dispose();
  }

  ApiClient get _api => context.read<ApiClient>();

  Future<void> _load() async {
    try {
      final o = Order.fromJson(await _api.get('/orders/${widget.orderId}'));
      if (mounted) {
        setState(() {
          _order = o;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted && _order == null) setState(() => _error = e);
    }
  }

  Future<void> _action(Future<dynamic> Function() fn, {String? success}) async {
    setState(() => _busy = true);
    try {
      final res = await fn();
      if (res is Map<String, dynamic> && res['reference'] != null) setState(() => _order = Order.fromJson(res));
      if (success != null && mounted) showInfo(context, success);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _call(String target) async {
    await _action(() async {
      final r = await _api.post('/orders/${widget.orderId}/call/$target');
      final uri = Uri(scheme: 'tel', path: r['relayNumber']);
      if (mounted) {
        await showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Appel masqué'),
            content: Text(r['instructions']),
            actions: [
              FilledButton(
                onPressed: () {
                  launchUrl(uri);
                  Navigator.pop(ctx);
                },
                child: const Text('Appeler'),
              ),
            ],
          ),
        );
      }
    });
  }

  Future<void> _cancel() async {
    final o = _order!;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text(T.cancel),
        content: Text(o.canCancelFree ? T.cancelFree : T.cancelPaid),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Retour')),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: AppColors.danger), onPressed: () => Navigator.pop(ctx, true), child: const Text('Annuler')),
        ],
      ),
    );
    if (ok == true) await _action(() => _api.post('/orders/${o.id}/cancel', {}));
  }

  @override
  Widget build(BuildContext context) {
    final o = _order;
    return Scaffold(
      appBar: AppBar(title: Text(o?.reference ?? T.tracking)),
      body: o == null
          ? (_error != null ? ErrorView(error: _error!, onRetry: _load) : const Center(child: CircularProgressIndicator()))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(padding: const EdgeInsets.all(16), children: [
                Text(o.shopName ?? '', style: const TextStyle(fontSize: 16, color: AppColors.muted)),
                Text(clientStatusLabels[o.status] ?? o.status, key: const Key('status'), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
                const SizedBox(height: 16),
                if (o.status == 'AWAITING_PAYMENT') _paymentCard(o),
                if (o.status == 'AWAITING_CLIENT') _substitutionCard(o),
                if (o.isActive && o.dispatchStatus == 'NO_COURIER' && o.deliveryMode == 'PLATFORM') _noCourierCard(o),
                if (o.isActive && o.deliveryCode != null && o.status != 'AWAITING_PAYMENT') _codeCard(o),
                if (!['CANCELLED', 'RETURNED'].contains(o.status)) _stepper(o),
                if (o.courierName != null && o.isActive)
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.two_wheeler, size: 32),
                      title: Text(o.courierName!),
                      subtitle: const Text('Ton livreur'),
                      trailing: IconButton.filled(onPressed: _busy ? null : () => _call('courier'), icon: const Icon(Icons.call)),
                    ),
                  ),
                _summary(o),
                if (o.status == 'DELIVERED' && !_rated) _ratingCard(o),
                const SizedBox(height: 12),
                if (o.isActive)
                  OutlinedButton.icon(onPressed: _busy ? null : () => _call('shop'), icon: const Icon(Icons.call), label: const Text(T.callShop)),
                if (o.canCancel) ...[
                  const SizedBox(height: 8),
                  TextButton(onPressed: _busy ? null : _cancel, child: const Text(T.cancel, style: TextStyle(color: AppColors.danger))),
                ],
                TextButton.icon(
                  onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ReportScreen(orderId: o.id))),
                  icon: const Icon(Icons.flag_outlined),
                  label: const Text(T.report),
                ),
              ]),
            ),
    );
  }

  Widget _codeCard(Order o) => Card(
        color: const Color(0xFFFFF4EC),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            Text(o.deliveryMode == 'PICKUP' ? T.deliveryCodePickup : T.deliveryCode, style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(o.deliveryCode!, key: const Key('deliveryCode'), style: const TextStyle(fontSize: 44, fontWeight: FontWeight.w900, letterSpacing: 10, color: AppColors.primary)),
            if (o.paymentStatus != 'PAID') Text('À payer à la remise : ${fcfa(o.total)}', style: const TextStyle(fontWeight: FontWeight.w700)),
          ]),
        ),
      );

  Widget _stepper(Order o) {
    final current = _steps.indexOf(o.status == 'AWAITING_CLIENT' ? 'PENDING' : o.status);
    final steps = o.deliveryMode == 'PICKUP' ? _steps.where((s) => s != 'PICKED_UP').toList() : _steps;
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(children: [
          for (final s in steps)
            ListTile(
              dense: true,
              leading: Icon(
                _steps.indexOf(s) <= current ? Icons.check_circle : Icons.radio_button_unchecked,
                color: _steps.indexOf(s) <= current ? AppColors.secondary : AppColors.muted,
              ),
              title: Text(clientStatusLabels[s]!, style: TextStyle(fontWeight: _steps.indexOf(s) == current ? FontWeight.w800 : FontWeight.w400)),
            ),
        ]),
      ),
    );
  }

  Widget _paymentCard(Order o) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('${paymentLabels[o.paymentMethod]} · ${fcfa(o.total)}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            const Text(T.waitingPayment),
            if (widget.initialPayment?['checkoutUrl'] != null) ...[
              const SizedBox(height: 12),
              FilledButton(onPressed: () => launchUrl(Uri.parse(widget.initialPayment!['checkoutUrl'])), child: const Text(T.payNow)),
            ],
          ]),
        ),
      );

  Widget _substitutionCard(Order o) {
    final proposed = o.items.where((i) => i.status == 'SUBSTITUTION_PROPOSED');
    return Card(
      color: const Color(0xFFFFF8E1),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text(T.substitutionTitle, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const Text(T.substitutionBody),
          const SizedBox(height: 8),
          for (final i in proposed)
            Text(i.substituteName == null
                ? '• ${i.name} : retiré de la commande'
                : '• ${i.name} → ${i.substituteName} (${fcfa(i.substituteUnitPrice!)})'),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _busy ? null : () => _action(() => _api.post('/orders/${o.id}/substitutions/respond', {'accept': true})),
            child: const Text(T.accept),
          ),
          TextButton(
            onPressed: _busy ? null : () => _action(() => _api.post('/orders/${o.id}/substitutions/respond', {'accept': false})),
            child: const Text(T.refuse),
          ),
        ]),
      ),
    );
  }

  Widget _noCourierCard(Order o) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text(T.noCourier),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: _busy ? null : () => _action(() => _api.post('/orders/${o.id}/pickup-instead')),
              child: const Text(T.pickup),
            ),
          ]),
        ),
      );

  Widget _summary(Order o) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (final i in o.items)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(children: [
                  Expanded(
                    child: Text(
                      '${i.quantity} × ${i.status == 'SUBSTITUTED' ? i.substituteName : i.name}',
                      style: TextStyle(decoration: i.status == 'REMOVED' ? TextDecoration.lineThrough : null),
                    ),
                  ),
                  Text(fcfa((i.status == 'SUBSTITUTED' ? i.substituteUnitPrice! : i.unitPrice) * i.quantity)),
                ]),
              ),
            const Divider(),
            Row(children: [const Expanded(child: Text(T.deliveryFee)), Text(fcfa(o.deliveryFee))]),
            if (o.cancellationFee > 0) Row(children: [const Expanded(child: Text('Frais d’annulation')), Text(fcfa(o.cancellationFee))]),
            Row(children: [
              const Expanded(child: Text(T.total, style: TextStyle(fontWeight: FontWeight.w800))),
              Text(fcfa(o.total), style: const TextStyle(fontWeight: FontWeight.w800)),
            ]),
            Text(paymentLabels[o.paymentMethod] ?? '', style: const TextStyle(color: AppColors.muted)),
          ]),
        ),
      );

  Widget _stars(int value, ValueChanged<int> onChanged) => Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        for (var i = 1; i <= 5; i++)
          IconButton(
            iconSize: 36,
            onPressed: () => setState(() => onChanged(i)),
            icon: Icon(i <= value ? Icons.star : Icons.star_border, color: const Color(0xFFF5A300)),
          ),
      ]);

  Widget _ratingCard(Order o) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            const Text(T.rate, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const Text(T.shopRating),
            _stars(_shopScore, (v) => _shopScore = v),
            if (o.courierName != null) ...[const Text(T.courierRating), _stars(_courierScore, (v) => _courierScore = v)],
            FilledButton(
              onPressed: _shopScore == 0 || _busy
                  ? null
                  : () => _action(() async {
                        await _api.post('/orders/${o.id}/rating', {
                          'shopScore': _shopScore,
                          if (_courierScore > 0) 'courierScore': _courierScore,
                        });
                        setState(() => _rated = true);
                      }, success: T.thanks),
              child: const Text(T.send),
            ),
          ]),
        ),
      );
}
