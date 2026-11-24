import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api_client.dart';
import 'widgets.dart';

/// Demande le code à 4 chiffres que le client donne à la remise. Renvoie null si annulé.
Future<String?> askHandoverCode(BuildContext context) async {
  final code = TextEditingController();
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Code du client'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('Demande au client le code à 4 chiffres reçu par SMS.'),
        const SizedBox(height: 8),
        TextField(
          key: const Key('handoverCode'),
          controller: code,
          autofocus: true,
          keyboardType: TextInputType.number,
          maxLength: 4,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 32, letterSpacing: 10, fontWeight: FontWeight.w800),
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        ),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Retour')),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size(120, 48)),
          onPressed: () => Navigator.pop(ctx, true),
          child: const Text('Valider'),
        ),
      ],
    ),
  );
  return ok == true ? code.text : null;
}

/// Appel masqué : l'API donne un numéro relais et un code de session, sans exposer les numéros.
Future<void> startMaskedCall(BuildContext context, ApiClient api, String orderId, String target) async {
  try {
    final r = await api.post('/orders/$orderId/call/$target');
    if (!context.mounted) return;
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Appel masqué'),
        content: Text(r['instructions']),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Fermer')),
          FilledButton(
            onPressed: () {
              launchUrl(Uri(scheme: 'tel', path: r['relayNumber']));
              Navigator.pop(ctx);
            },
            child: const Text('Appeler'),
          ),
        ],
      ),
    );
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}
