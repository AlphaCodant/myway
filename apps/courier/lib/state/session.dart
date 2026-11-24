import 'package:app_core/app_core.dart';

/// Session du livreur.
class Session extends AuthSession {
  Session(super.api, super.prefs) : super(prefix: 'courier', signupAs: 'COURIER');
}
