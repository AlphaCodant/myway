import 'package:app_core/app_core.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../l10n/fr.dart';
import '../state/auth_state.dart';

class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.read<AuthState>();
    return PhoneLoginScreen(
      title: T.appName,
      subtitle: T.tagline,
      icon: Icons.delivery_dining,
      requestCode: auth.requestCode,
      verify: auth.verify,
    );
  }
}
