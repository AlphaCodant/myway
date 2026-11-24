import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import 'theme.dart';
import 'widgets.dart';

/// Écran de connexion commun : numéro de téléphone puis code SMS à 6 chiffres.
class PhoneLoginScreen extends StatefulWidget {
  const PhoneLoginScreen({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.requestCode,
    required this.verify,
  });
  final String title;
  final String subtitle;
  final IconData icon;

  /// Renvoie le code en mode développement (sinon null : il arrive par SMS).
  final Future<String?> Function(String phone) requestCode;
  final Future<void> Function(String phone, String code) verify;

  @override
  State<PhoneLoginScreen> createState() => _PhoneLoginScreenState();
}

class _PhoneLoginScreenState extends State<PhoneLoginScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  bool _codeSent = false;
  bool _busy = false;
  String? _devCode;

  Future<void> _run(Future<void> Function() fn) async {
    setState(() => _busy = true);
    try {
      await fn();
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 32),
            Icon(widget.icon, size: 72, color: AppColors.primary),
            const SizedBox(height: 8),
            Text(widget.title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800)),
            Text(widget.subtitle, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted)),
            const SizedBox(height: 40),
            if (!_codeSent) ...[
              const Text('Ton numéro de téléphone', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              TextField(
                key: const Key('phone'),
                controller: _phone,
                keyboardType: TextInputType.phone,
                style: const TextStyle(fontSize: 22, letterSpacing: 1),
                decoration: const InputDecoration(prefixText: '+225  ', hintText: '07 01 02 03 04'),
                inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9 ]'))],
              ),
              const SizedBox(height: 8),
              const Text('On t’envoie un code par SMS. Pas besoin d’email.', style: TextStyle(color: AppColors.muted)),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _busy
                    ? null
                    : () => _run(() async {
                          final dev = await widget.requestCode(_phone.text);
                          setState(() {
                            _codeSent = true;
                            _devCode = dev;
                          });
                        }),
                child: const Text('Recevoir le code'),
              ),
            ] else ...[
              const Text('Entre le code reçu par SMS', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              TextField(
                key: const Key('code'),
                controller: _code,
                keyboardType: TextInputType.number,
                maxLength: 6,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 28, letterSpacing: 8, fontWeight: FontWeight.w700),
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                autofillHints: const [AutofillHints.oneTimeCode],
              ),
              if (_devCode != null)
                Text('Mode développement : code $_devCode', textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted)),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _busy ? null : () => _run(() => widget.verify(_phone.text, _code.text.trim())),
                child: const Text('Valider'),
              ),
              TextButton(
                onPressed: _busy ? null : () => _run(() async => _devCode = await widget.requestCode(_phone.text)),
                child: const Text('Renvoyer le code'),
              ),
              TextButton(onPressed: () => setState(() => _codeSent = false), child: const Text('Changer de numéro')),
            ],
          ],
        ),
      ),
    );
  }
}
