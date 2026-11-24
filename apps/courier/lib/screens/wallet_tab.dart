import 'package:app_core/app_core.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../state/courier_state.dart';

const _kindLabels = {
  'DELIVERY_EARNING': 'Course',
  'PAYOUT': 'Retrait Mobile Money',
  'CANCELLATION_FEE': 'Frais d’annulation',
  'REFUND': 'Remboursement',
};

/// Gains du livreur, espèces à reverser et retrait Mobile Money.
class WalletTab extends StatelessWidget {
  const WalletTab({super.key});

  Future<void> _withdraw(BuildContext context, CourierState state, int balance) async {
    final ctrl = TextEditingController(text: '$balance');
    final amount = await showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Retirer mes gains'),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Envoi sur ${state.profile?['mobileMoneyNumber'] ?? 'ton numéro Mobile Money'}'),
          const SizedBox(height: 8),
          TextField(
            key: const Key('withdrawAmount'),
            controller: ctrl,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: const InputDecoration(suffixText: 'F', helperText: 'Minimum 500 F'),
          ),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
          FilledButton(onPressed: () => Navigator.pop(ctx, int.tryParse(ctrl.text)), child: const Text('Demander')),
        ],
      ),
    );
    if (amount == null || !context.mounted) return;
    try {
      await state.withdraw(amount);
      if (context.mounted) showInfo(context, 'Demande envoyée : tu recevras ${fcfa(amount)} sous 24 h.');
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<CourierState>();
    final w = state.wallet;
    if (w == null) return const Center(child: CircularProgressIndicator());
    final balance = w['earningsBalance'] as int? ?? 0;
    final history = (w['history'] as List? ?? []).cast<Map<String, dynamic>>();
    final dateFmt = DateFormat('d MMM HH:mm', 'fr');
    return RefreshIndicator(
      onRefresh: state.refreshWallet,
      child: ListView(padding: const EdgeInsets.all(16), children: [
        Row(children: [
          Expanded(child: _Stat(label: 'Gagné aujourd’hui', value: fcfa(w['earnedToday'] ?? 0))),
          const SizedBox(width: 10),
          Expanded(child: _Stat(label: 'Courses du jour', value: '${w['deliveriesToday'] ?? 0}')),
        ]),
        const SizedBox(height: 10),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Mes gains disponibles', style: TextStyle(color: AppColors.muted)),
              Text(fcfa(balance), key: const Key('earningsBalance'),
                  style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: AppColors.secondary)),
              const SizedBox(height: 8),
              FilledButton.icon(
                onPressed: balance >= 500 ? () => _withdraw(context, state, balance) : null,
                icon: const Icon(Icons.phone_android),
                label: const Text('Retirer sur Mobile Money'),
              ),
            ]),
          ),
        ),
        Card(
          color: state.blocked ? const Color(0xFFFFE0D6) : null,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Espèces à reverser', style: TextStyle(color: AppColors.muted)),
              Text(fcfa(state.cashHeld), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900)),
              const SizedBox(height: 6),
              LinearProgressIndicator(
                value: (state.cashHeld / state.cashCeiling).clamp(0, 1).toDouble(),
                minHeight: 8,
                color: state.blocked ? AppColors.danger : AppColors.primary,
                borderRadius: BorderRadius.circular(4),
              ),
              const SizedBox(height: 6),
              Text('Plafond : ${fcfa(state.cashCeiling)}. Au-delà, tu ne reçois plus de courses. '
                  'Reverse les espèces encaissées à un agent MyWay.'),
            ]),
          ),
        ),
        const SizedBox(height: 8),
        const Text('Historique', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        if (history.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('Pas encore de mouvement.')),
        for (final e in history)
          ListTile(
            dense: true,
            leading: Icon((e['amount'] as int) >= 0 ? Icons.add_circle : Icons.remove_circle,
                color: (e['amount'] as int) >= 0 ? AppColors.secondary : AppColors.danger),
            title: Text(e['note'] ?? _kindLabels[e['kind']] ?? e['kind']),
            subtitle: Text(dateFmt.format(DateTime.parse(e['createdAt']).toLocal())),
            trailing: Text(fcfa(e['amount']), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          ),
      ]),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Card(
        margin: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(color: AppColors.muted)),
            Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
          ]),
        ),
      );
}
