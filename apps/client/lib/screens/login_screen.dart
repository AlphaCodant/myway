import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../l10n/fr.dart';
import '../state/auth_state.dart';
import '../theme.dart';
import '../widgets/common.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  bool _codeSent = false;
  bool _busy = false;
  String? _devCode;

  Future<void> _request() async {
    setState(() => _busy = true);
    try {
      final dev = await context.read<AuthState>().requestCode(_phone.text);
      setState(() {
        _codeSent = true;
        _devCode = dev;
      });
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    setState(() => _busy = true);
    try {
      await context.read<AuthState>().verify(_phone.text, _code.text.trim());
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
            const Icon(Icons.delivery_dining, size: 72, color: AppColors.primary),
            const SizedBox(height: 8),
            const Text(T.appName, textAlign: TextAlign.center, style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800)),
            const Text(T.tagline, textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted)),
            const SizedBox(height: 40),
            if (!_codeSent) ...[
              const Text(T.phoneTitle, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              TextField(
                key: const Key('phone'),
                controller: _phone,
                keyboardType: TextInputType.phone,
                style: const TextStyle(fontSize: 22, letterSpacing: 1),
                decoration: const InputDecoration(prefixText: '+225  ', hintText: T.phoneHint),
                inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9 ]'))],
              ),
              const SizedBox(height: 8),
              const Text(T.phoneHelp, style: TextStyle(color: AppColors.muted)),
              const SizedBox(height: 24),
              FilledButton(onPressed: _busy ? null : _request, child: const Text(T.receiveCode)),
            ] else ...[
              const Text(T.codeTitle, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
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
              FilledButton(onPressed: _busy ? null : _verify, child: const Text(T.validate)),
              TextButton(onPressed: _busy ? null : _request, child: const Text(T.resend)),
              TextButton(onPressed: () => setState(() => _codeSent = false), child: const Text(T.changeNumber)),
            ],
          ],
        ),
      ),
    );
  }
}
