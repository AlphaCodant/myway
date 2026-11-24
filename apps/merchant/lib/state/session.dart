import 'package:app_core/app_core.dart';

/// Session du commerçant (ou de l'agent terrain).
class Session extends AuthSession {
  Session(super.api, super.prefs) : super(prefix: 'merchant');
}
