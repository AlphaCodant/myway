import 'package:app_core/app_core.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../state/courier_state.dart';

/// Déroulé d'une course : aller au commerce → récupérer → aller chez le client → remettre contre le code.
class JobScreen extends StatefulWidget {
  const JobScreen({super.key, required this.orderId});
  final String orderId;
  @override
  State<JobScreen> createState() => _JobScreenState();
}

class _JobScreenState extends State<JobScreen> {
  Order? _order;
  Object? _error;
  bool _busy = false;
  late final CourierState _state = context.read<CourierState>();

  @override
  void initState() {
    super.initState();
    _load();
    _state.addListener(_onState);
  }

  @override
  void dispose() {
    _state.removeListener(_onState);
    super.dispose();
  }

  int _jobsSeen = -1;
  void _onState() {
    // On recharge la course quand la liste des courses change (mise à jour temps réel).
    final key = Object.hashAll(_state.jobs.map((j) => '${j.id}:${j.status}'));
    if (key != _jobsSeen) {
      _jobsSeen = key;
      _load();
    }
  }

  Future<void> _load() async {
    try {
      final o = Order.fromJson(await _state.api.get('/orders/${widget.orderId}'));
      if (mounted) setState(() => _order = o);
    } catch (e) {
      if (mounted && _order == null) setState(() => _error = e);
    }
  }

  Future<void> _run(String action, {Map<String, dynamic>? body, String? done}) async {
    setState(() => _busy = true);
    try {
      await _state.act(widget.orderId, action, body);
      await _load();
      if (mounted && done != null) showInfo(context, done);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _deliver() async {
    final code = await askHandoverCode(context);
    if (code != null) await _run('deliver', body: {'code': code}, done: 'Course terminée ✔');
  }

  Future<void> _confirm(String title, String text, String action, {String? done}) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(text),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Non')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Oui')),
        ],
      ),
    );
    if (ok == true) await _run(action, done: done);
  }

  Future<void> _correctLocation() async {
    setState(() => _busy = true);
    try {
      final p = await _state.currentPosition();
      await _state.act(widget.orderId, 'correct-location', p.toJson());
      if (mounted) showInfo(context, 'Merci ! La position du client est corrigée pour les prochaines livraisons.');
    } catch (e) {
      if (mounted) showInfo(context, e is ApiException ? e.message : '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _navigate(LatLngLite? to) {
    if (to == null) return;
    launchUrl(
      Uri.parse('https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=driving'),
      mode: LaunchMode.externalApplication,
    );
  }

  @override
  Widget build(BuildContext context) {
    final o = _order;
    return Scaffold(
      appBar: AppBar(title: Text(o == null ? 'Course' : 'Course ${o.reference}')),
      body: o == null
          ? (_error != null ? ErrorView(error: _error!, onRetry: _load) : const Center(child: CircularProgressIndicator()))
          : ListView(padding: const EdgeInsets.only(bottom: 24), children: [
              if (_state.showMaps) _JobMap(order: o, me: _state.lastPosition),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  _Progress(status: o.status),
                  const SizedBox(height: 12),
                  ..._body(o),
                ]),
              ),
            ]),
    );
  }

  List<Widget> _body(Order o) {
    const gap = SizedBox(height: 10);
    final api = _state.api;
    switch (o.status) {
      case 'CONFIRMED':
      case 'READY':
        return [
          _Panel(
            icon: Icons.storefront,
            title: o.shopName ?? 'Commerce',
            lines: [
              if (o.shopLandmark != null) o.shopLandmark!,
              o.status == 'READY' ? 'La commande est prête : passe la récupérer.' : 'Le commerçant prépare la commande.',
              '${o.items.fold<int>(0, (s, i) => s + i.quantity)} article(s) · réf. ${o.reference}',
            ],
          ),
          gap,
          OutlinedButton.icon(onPressed: () => _navigate(o.shopLocation), icon: const Icon(Icons.navigation), label: const Text('Itinéraire vers le commerce')),
          gap,
          OutlinedButton.icon(
            onPressed: () => startMaskedCall(context, api, o.id, 'shop'),
            icon: const Icon(Icons.call),
            label: const Text('Appeler le commerçant'),
          ),
          gap,
          FilledButton.icon(
            key: const Key('pickedUp'),
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(60)),
            onPressed: _busy ? null : () => _confirm('Colis récupéré ?', 'Vérifie que tu as bien tous les articles de la commande ${o.reference}.', 'picked-up', done: 'En route vers le client'),
            icon: const Icon(Icons.inventory),
            label: const Text('J’ai récupéré le colis', style: TextStyle(fontSize: 18)),
          ),
        ];
      case 'PICKED_UP':
        return [
          _CashBanner(amount: o.cashToCollect),
          gap,
          _Panel(
            icon: Icons.home,
            title: 'Chez le client',
            lines: [
              o.deliveryLandmark ?? 'Suis la position GPS sur la carte.',
              if (o.note != null) 'Note : ${o.note}',
            ],
          ),
          if (o.deliveryPhotoUrl != null) ...[
            gap,
            const Text('Photo du portail', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Center(child: NetImage(url: api.fileUrl(o.deliveryPhotoUrl), icon: Icons.door_front_door, size: 200)),
          ],
          if (o.deliveryVoiceNoteUrl != null) ...[
            gap,
            OutlinedButton.icon(
              onPressed: () => launchUrl(Uri.parse(api.fileUrl(o.deliveryVoiceNoteUrl))),
              icon: const Icon(Icons.play_circle),
              label: const Text('Écouter l’indication vocale'),
            ),
          ],
          gap,
          OutlinedButton.icon(onPressed: () => _navigate(o.deliveryLocation), icon: const Icon(Icons.navigation), label: const Text('Itinéraire vers le client')),
          gap,
          OutlinedButton.icon(
            onPressed: () => startMaskedCall(context, api, o.id, 'client'),
            icon: const Icon(Icons.call),
            label: const Text('Appeler le client'),
          ),
          gap,
          FilledButton.icon(
            key: const Key('deliver'),
            style: FilledButton.styleFrom(backgroundColor: AppColors.secondary, minimumSize: const Size.fromHeight(60)),
            onPressed: _busy ? null : _deliver,
            icon: const Icon(Icons.handshake),
            label: const Text('Remettre au client (code)', style: TextStyle(fontSize: 18)),
          ),
          const SizedBox(height: 20),
          const Divider(),
          Text('Client injoignable ? Appels notés : ${o.clientCallAttempts}', style: const TextStyle(color: AppColors.muted)),
          const SizedBox(height: 6),
          Row(children: [
            Expanded(
              child: TextButton(
                onPressed: _busy ? null : () => _run('call-attempt', done: 'Appel sans réponse noté'),
                child: const Text('Le client ne répond pas'),
              ),
            ),
            Expanded(
              child: TextButton(
                style: TextButton.styleFrom(foregroundColor: AppColors.danger),
                onPressed: _busy
                    ? null
                    : () => _confirm(
                          'Retourner le colis ?',
                          'Rapporte le colis au commerce. Ta course reste payée.',
                          'return',
                          done: 'Colis à retourner au commerce',
                        ),
                child: const Text('Retourner au commerce'),
              ),
            ),
          ]),
        ];
      case 'DELIVERED':
        return [
          Card(
            color: const Color(0xFFE6F4EA),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(children: [
                const Icon(Icons.check_circle, size: 64, color: AppColors.secondary),
                const Text('Course terminée', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
                const SizedBox(height: 6),
                Text('+ ${fcfa(o.courierEarning)} sur tes gains', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                if (o.paymentMethod == 'CASH')
                  Text('${fcfa(o.total)} d’espèces à reverser à MyWay', style: const TextStyle(color: AppColors.muted)),
              ]),
            ),
          ),
          gap,
          OutlinedButton.icon(
            onPressed: _busy ? null : _correctLocation,
            icon: const Icon(Icons.edit_location_alt),
            label: const Text('Le point GPS était faux : enregistrer ma position'),
          ),
          gap,
          FilledButton(onPressed: () => Navigator.pop(context), child: const Text('Retour aux courses')),
        ];
      default:
        return [
          _Panel(icon: Icons.info, title: statusLabels[o.status] ?? o.status, lines: const ['Cette course n’est plus active.']),
          gap,
          FilledButton(onPressed: () => Navigator.pop(context), child: const Text('Retour aux courses')),
        ];
    }
  }
}

/// Étapes de la course : commerce → en route → livrée.
class _Progress extends StatelessWidget {
  const _Progress({required this.status});
  final String status;
  @override
  Widget build(BuildContext context) {
    final step = switch (status) { 'PICKED_UP' => 1, 'DELIVERED' => 2, _ => 0 };
    const labels = ['Commerce', 'En route', 'Livrée'];
    return Row(children: [
      for (var i = 0; i < 3; i++) ...[
        Expanded(
          child: Column(children: [
            CircleAvatar(
              radius: 14,
              backgroundColor: i <= step ? AppColors.secondary : const Color(0xFFDDDDDD),
              child: Text('${i + 1}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
            ),
            const SizedBox(height: 4),
            Text(labels[i], style: TextStyle(fontWeight: i == step ? FontWeight.w800 : FontWeight.w400)),
          ]),
        ),
      ],
    ]);
  }
}

class _CashBanner extends StatelessWidget {
  const _CashBanner({required this.amount});
  final int amount;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: amount > 0 ? const Color(0xFFFFE0B2) : const Color(0xFFE6F4EA),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(children: [
          Icon(amount > 0 ? Icons.payments : Icons.verified, size: 32),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              amount > 0 ? 'Encaisser ${fcfa(amount)} en espèces' : 'Déjà payé par Mobile Money : rien à encaisser',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
          ),
        ]),
      );
}

class _Panel extends StatelessWidget {
  const _Panel({required this.icon, required this.title, required this.lines});
  final IconData icon;
  final String title;
  final List<String> lines;
  @override
  Widget build(BuildContext context) => Card(
        margin: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, color: AppColors.primary, size: 30),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                for (final l in lines) Padding(padding: const EdgeInsets.only(top: 4), child: Text(l)),
              ]),
            ),
          ]),
        ),
      );
}

/// Carte OpenStreetMap : commerce, client et position du livreur.
class _JobMap extends StatelessWidget {
  const _JobMap({required this.order, required this.me});
  final Order order;
  final LatLngLite? me;

  @override
  Widget build(BuildContext context) {
    LatLng? ll(LatLngLite? p) => p == null ? null : LatLng(p.lat, p.lng);
    final shop = ll(order.shopLocation);
    final client = ll(order.deliveryLocation);
    final mine = ll(me);
    final points = [?shop, ?client, ?mine];
    if (points.isEmpty) return const SizedBox.shrink();
    final target = order.status == 'PICKED_UP' ? client : shop;
    Marker pin(LatLng p, IconData icon, Color color) => Marker(
          point: p,
          width: 44,
          height: 44,
          child: Container(
            decoration: BoxDecoration(color: color, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 3)),
            child: Icon(icon, color: Colors.white, size: 22),
          ),
        );
    return SizedBox(
      height: 240,
      child: FlutterMap(
        options: points.length > 1
            ? MapOptions(
                initialCameraFit: CameraFit.coordinates(coordinates: points, padding: const EdgeInsets.all(48), maxZoom: 17),
              )
            : MapOptions(initialCenter: points.first, initialZoom: 16),
        children: [
          TileLayer(urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', userAgentPackageName: 'ci.livraisonquartier.courier'),
          if (mine != null && target != null)
            PolylineLayer(polylines: [Polyline(points: [mine, target], color: AppColors.primary, strokeWidth: 4, pattern: const StrokePattern.dotted())]),
          MarkerLayer(markers: [
            if (shop != null) pin(shop, Icons.storefront, AppColors.primary),
            if (client != null) pin(client, Icons.home, AppColors.secondary),
            if (mine != null) pin(mine, Icons.delivery_dining, const Color(0xFF1565C0)),
          ]),
        ],
      ),
    );
  }
}
