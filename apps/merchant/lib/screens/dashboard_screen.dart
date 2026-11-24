import 'package:app_core/app_core.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

const _kindLabels = {
  'SALE': 'Vente',
  'COMMISSION': 'Commission MyWay',
  'DELIVERY_FEE': 'Frais de livraison',
  'CASH_COLLECTED': 'Espèces encaissées par toi',
  'CANCELLATION_FEE': 'Frais d’annulation',
  'REFUND': 'Remboursement',
  'PAYOUT': 'Reversement Mobile Money',
};

/// Ventes du jour et de la semaine, commissions, solde et reversements.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _data;
  Object? _error;
  final _date = DateFormat('d MMM HH:mm', 'fr');

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await context.read<ApiClient>().get('/merchant/dashboard', cache: true);
      setState(() {
        _data = d;
        _error = null;
      });
    } catch (e) {
      setState(() => _error = e);
    }
  }

  Future<void> _payout() async {
    final balance = _data!['balance'] as int;
    final amount = TextEditingController(text: '$balance');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Demander un reversement'),
        content: TextField(
          controller: amount,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Montant', suffixText: 'FCFA'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Retour')),
          FilledButton(style: FilledButton.styleFrom(minimumSize: const Size(120, 48)), onPressed: () => Navigator.pop(ctx, true), child: const Text('Demander')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await context.read<ApiClient>().post('/merchant/payouts', {'amount': int.parse(amount.text)});
      if (mounted) showInfo(context, 'Demande envoyée : tu recevras l’argent sur ton Mobile Money.');
      await _load();
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = _data;
    if (d == null) return _error != null ? ErrorView(error: _error!, onRetry: _load) : const Center(child: CircularProgressIndicator());
    final balance = d['balance'] as int;
    final freeUntil = d['commissionFreeUntil'] == null ? null : DateTime.parse(d['commissionFreeUntil']);
    final free = freeUntil != null && freeUntil.isAfter(DateTime.now());
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(padding: const EdgeInsets.all(12), children: [
        Row(children: [
          Expanded(child: _StatCard(title: 'Aujourd’hui', stats: d['today'])),
          const SizedBox(width: 8),
          Expanded(child: _StatCard(title: 'Cette semaine', stats: d['week'])),
        ]),
        const SizedBox(height: 8),
        Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Ton solde MyWay', style: TextStyle(color: AppColors.muted)),
              Text(fcfa(balance), key: const Key('balance'), style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: balance >= 0 ? AppColors.secondary : AppColors.danger)),
              Text(
                balance >= 0
                    ? 'Montant que MyWay te doit (ventes payées en ligne ou encaissées par les livreurs).'
                    : 'Commissions dues sur les ventes que tu as encaissées toi-même.',
                style: const TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 8),
              Text(free ? 'Commission offerte jusqu’au ${DateFormat('d MMMM y', 'fr').format(freeUntil)}' : 'Commission : ${d['commissionPercent']} %',
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              FilledButton.icon(onPressed: balance >= 500 ? _payout : null, icon: const Icon(Icons.phone_android), label: const Text('Recevoir sur Mobile Money')),
            ]),
          ),
        ),
        if ((d['payouts'] as List).isNotEmpty) ...[
          const Padding(padding: EdgeInsets.fromLTRB(4, 16, 4, 4), child: Text('Reversements', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
          for (final p in d['payouts'] as List)
            ListTile(
              dense: true,
              title: Text(fcfa(p['amount'])),
              subtitle: Text(_date.format(DateTime.parse(p['createdAt']).toLocal())),
              trailing: Text({'REQUESTED': 'Demandé', 'PAID': 'Payé', 'REJECTED': 'Refusé'}[p['status']] ?? p['status']),
            ),
        ],
        const Padding(padding: EdgeInsets.fromLTRB(4, 16, 4, 4), child: Text('Mouvements', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
        for (final e in d['history'] as List)
          ListTile(
            dense: true,
            title: Text(_kindLabels[e['kind']] ?? e['kind']),
            subtitle: Text(_date.format(DateTime.parse(e['createdAt']).toLocal())),
            trailing: Text(
              '${(e['amount'] as int) > 0 ? '+' : ''}${fcfa(e['amount'])}',
              style: TextStyle(fontWeight: FontWeight.w700, color: (e['amount'] as int) >= 0 ? AppColors.secondary : AppColors.danger),
            ),
          ),
      ]),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.title, required this.stats});
  final String title;
  final Map<String, dynamic> stats;
  @override
  Widget build(BuildContext context) => Card(
        margin: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(color: AppColors.muted)),
            Text(fcfa(stats['sales']), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
            Text('${stats['delivered']} livrée(s) · ${stats['cancelled']} annulée(s)'),
            Text('Commission : ${fcfa(stats['commission'])}', style: const TextStyle(color: AppColors.muted)),
          ]),
        ),
      );
}
