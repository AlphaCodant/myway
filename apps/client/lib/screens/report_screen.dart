import 'package:app_core/app_core.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../l10n/fr.dart';

const _subjects = ['Produit manquant ou abîmé', 'Retard de livraison', 'Problème de paiement', 'Comportement du livreur', 'Autre'];

class ReportScreen extends StatefulWidget {
  const ReportScreen({super.key, this.orderId});
  final String? orderId;
  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  String _subject = _subjects.first;
  final _message = TextEditingController();
  bool _busy = false;

  Future<void> _send() async {
    setState(() => _busy = true);
    try {
      await context.read<ApiClient>().post('/tickets', {
        'orderId': ?widget.orderId,
        'subject': _subject,
        'message': _message.text.trim(),
      });
      if (!mounted) return;
      showInfo(context, T.reportSent);
      Navigator.pop(context);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(T.report)),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        const Text(T.problemSubject, style: TextStyle(fontWeight: FontWeight.w700)),
        RadioGroup<String>(
          groupValue: _subject,
          onChanged: (v) => setState(() => _subject = v!),
          child: Column(children: [for (final s in _subjects) RadioListTile(value: s, title: Text(s))]),
        ),
        TextField(controller: _message, maxLines: 4, decoration: const InputDecoration(labelText: T.problemMessage)),
        const SizedBox(height: 16),
        FilledButton(onPressed: _busy ? null : _send, child: const Text(T.send)),
      ]),
    );
  }
}
