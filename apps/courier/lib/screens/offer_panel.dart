import 'package:app_core/app_core.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../state/courier_state.dart';
import '../state/offer.dart';
import 'job_screen.dart';

/// Proposition de course : gros boutons, gain et espèces à encaisser bien visibles, compte à rebours.
class OfferPanel extends StatefulWidget {
  const OfferPanel({super.key, required this.offer});
  final Offer offer;
  @override
  State<OfferPanel> createState() => _OfferPanelState();
}

class _OfferPanelState extends State<OfferPanel> {
  bool _busy = false;

  Future<void> _accept() async {
    final state = context.read<CourierState>();
    final nav = Navigator.of(context);
    setState(() => _busy = true);
    try {
      final order = await state.acceptOffer(widget.offer);
      nav.push(MaterialPageRoute(
        builder: (_) => ChangeNotifierProvider.value(value: state, child: JobScreen(orderId: order.id)),
      ));
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _decline() async {
    setState(() => _busy = true);
    try {
      await context.read<CourierState>().declineOffer(widget.offer);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.offer;
    final left = o.secondsLeft();
    return Container(
      color: const Color(0xFFFFF4EC),
      child: ListView(padding: const EdgeInsets.all(16), children: [
        Row(children: [
          const Icon(Icons.notifications_active, color: AppColors.primary, size: 32),
          const SizedBox(width: 10),
          const Expanded(
            child: Text('Nouvelle course !', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppColors.primary)),
          ),
          SizedBox(
            width: 56,
            height: 56,
            child: Stack(alignment: Alignment.center, children: [
              CircularProgressIndicator(value: left / 30, strokeWidth: 5, color: AppColors.primary),
              Text('$left', key: const Key('offerCountdown'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
            ]),
          ),
        ]),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Tu gagnes', style: TextStyle(color: AppColors.muted)),
              Text(fcfa(o.estimatedEarning),
                  style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w900, color: AppColors.secondary)),
              if (o.distanceMeters != null) Text('Trajet total : ${distance(o.distanceMeters)}', style: const TextStyle(fontSize: 16)),
              const Divider(height: 24),
              _Step(icon: Icons.storefront, title: 'Récupérer chez', text: o.shopName, sub: o.shopLandmark),
              const SizedBox(height: 10),
              _Step(icon: Icons.home, title: 'Livrer à', text: o.dropoffLandmark ?? 'Position GPS du client', sub: null),
              const Divider(height: 24),
              Row(children: [
                Icon(o.cashToCollect > 0 ? Icons.payments : Icons.check_circle, color: o.cashToCollect > 0 ? AppColors.primary : AppColors.secondary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    o.cashToCollect > 0 ? 'Encaisser ${fcfa(o.cashToCollect)} en espèces' : 'Déjà payé : rien à encaisser',
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                  ),
                ),
              ]),
            ]),
          ),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          key: const Key('acceptOffer'),
          style: FilledButton.styleFrom(backgroundColor: AppColors.secondary, minimumSize: const Size.fromHeight(64)),
          onPressed: _busy ? null : _accept,
          icon: const Icon(Icons.check, size: 28),
          label: const Text('Accepter la course', style: TextStyle(fontSize: 20)),
        ),
        const SizedBox(height: 10),
        OutlinedButton(
          key: const Key('declineOffer'),
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(52)),
          onPressed: _busy ? null : _decline,
          child: const Text('Refuser'),
        ),
      ]),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.icon, required this.title, required this.text, this.sub});
  final IconData icon;
  final String title;
  final String text;
  final String? sub;
  @override
  Widget build(BuildContext context) => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, color: AppColors.primary),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(color: AppColors.muted, fontSize: 14)),
            Text(text, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            if (sub != null && sub!.isNotEmpty) Text(sub!, style: const TextStyle(fontSize: 15)),
          ]),
        ),
      ]);
}
