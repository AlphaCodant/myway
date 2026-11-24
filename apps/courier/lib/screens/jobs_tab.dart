import 'package:app_core/app_core.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../state/courier_state.dart';
import 'job_screen.dart';

class JobsTab extends StatelessWidget {
  const JobsTab({super.key, required this.onOpenProfile});
  final VoidCallback onOpenProfile;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<CourierState>();
    return RefreshIndicator(
      onRefresh: state.refresh,
      child: ListView(padding: const EdgeInsets.all(16), children: [
        if (state.api.servedFromCache) const OfflineBanner(),
        if (!state.validated) _ValidationCard(state: state, onOpenProfile: onOpenProfile),
        if (state.validated && state.blocked)
          _InfoCard(
            icon: Icons.lock,
            color: const Color(0xFFFFE0D6),
            title: 'Plafond d’espèces atteint',
            text: 'Tu as ${fcfa(state.cashHeld)} d’espèces sur toi (plafond ${fcfa(state.cashCeiling)}). '
                'Reverse-les à un agent MyWay pour recevoir de nouvelles courses.',
          ),
        if (state.jobs.isNotEmpty) ...[
          const Text('Course en cours', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          for (final o in state.jobs) _JobTile(order: o),
        ] else if (state.validated && !state.blocked)
          _InfoCard(
            icon: state.online ? Icons.radar : Icons.bedtime,
            color: Colors.white,
            title: state.online ? 'En attente d’une course' : 'Tu es hors service',
            text: state.online
                ? 'Reste près des commerces de ton quartier. Ton téléphone sonnera dès qu’une course est proche de toi.'
                : 'Active « En service » en haut de l’écran pour recevoir des courses.',
          ),
        if (state.validated && state.cashHeld > 0 && !state.blocked) ...[
          const SizedBox(height: 8),
          Text('Espèces sur toi : ${fcfa(state.cashHeld)} / ${fcfa(state.cashCeiling)}', style: const TextStyle(color: AppColors.muted)),
          const SizedBox(height: 4),
          LinearProgressIndicator(value: state.cashHeld / state.cashCeiling, minHeight: 8, borderRadius: BorderRadius.circular(4)),
        ],
      ]),
    );
  }
}

class _JobTile extends StatelessWidget {
  const _JobTile({required this.order});
  final Order order;
  @override
  Widget build(BuildContext context) {
    final state = context.read<CourierState>();
    final pickedUp = order.status == 'PICKED_UP';
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: pickedUp ? AppColors.secondary : AppColors.primary,
          child: Icon(pickedUp ? Icons.home : Icons.storefront, color: Colors.white),
        ),
        title: Text(pickedUp ? 'Livrer : ${order.deliveryLandmark ?? 'client'}' : 'Récupérer chez ${order.shopName ?? ''}',
            style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text('${order.reference} · ${statusLabels[order.status] ?? order.status}'
            '${order.cashToCollect > 0 ? '\nEncaisser ${fcfa(order.cashToCollect)}' : ''}'),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => ChangeNotifierProvider.value(value: state, child: JobScreen(orderId: order.id))),
        ),
      ),
    );
  }
}

class _ValidationCard extends StatelessWidget {
  const _ValidationCard({required this.state, required this.onOpenProfile});
  final CourierState state;
  final VoidCallback onOpenProfile;
  @override
  Widget build(BuildContext context) {
    final complete = state.documentsComplete;
    return Card(
      color: const Color(0xFFFFF8E1),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(complete ? Icons.hourglass_top : Icons.assignment, color: AppColors.primary),
            const SizedBox(width: 8),
            Expanded(
              child: Text(complete ? 'Dossier envoyé' : 'Complète ton dossier',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            ),
          ]),
          const SizedBox(height: 8),
          Text(complete
              ? 'L’équipe MyWay vérifie tes pièces. Tu pourras prendre des courses dès que ton compte est validé.'
              : 'Pour devenir livreur, envoie ta pièce d’identité, ta photo, un contact d’urgence, et pour une moto ton permis et ta carte grise.'),
          if (!complete) ...[
            const SizedBox(height: 12),
            FilledButton.icon(onPressed: onOpenProfile, icon: const Icon(Icons.upload_file), label: const Text('Envoyer mes pièces')),
          ],
        ]),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.icon, required this.color, required this.title, required this.text});
  final IconData icon;
  final Color color;
  final String title;
  final String text;
  @override
  Widget build(BuildContext context) => Card(
        color: color,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(children: [
            Icon(icon, size: 48, color: AppColors.primary),
            const SizedBox(height: 8),
            Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800), textAlign: TextAlign.center),
            const SizedBox(height: 6),
            Text(text, textAlign: TextAlign.center),
          ]),
        ),
      );
}
