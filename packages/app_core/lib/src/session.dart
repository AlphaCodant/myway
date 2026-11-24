import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';

/// Session OTP commune aux applications métier (commerçant, agent, livreur).
/// Le jeton et le rôle sont gardés sur le téléphone sous le préfixe [prefix].
class AuthSession extends ChangeNotifier {
  AuthSession(this.api, this.prefs, {required this.prefix, this.signupAs}) {
    api.token = prefs.getString(_kToken);
    role = prefs.getString(_kRole);
    name = prefs.getString(_kName);
  }

  final ApiClient api;
  final SharedPreferences prefs;
  final String prefix;

  /// Rôle demandé si le numéro n'a pas encore de compte (ex. « COURIER » : le compte est créé en attente de validation).
  final String? signupAs;
  String? role;
  String? name;

  String get _kToken => '$prefix.token';
  String get _kRole => '$prefix.role';
  String get _kName => '$prefix.name';

  bool get isLoggedIn => api.token != null;

  /// Demande le code SMS. En développement, l'API renvoie le code pour faciliter les essais.
  Future<String?> requestCode(String phone) async {
    final res = await api.post('/auth/otp/request', {'phone': phone});
    return res['devCode'] as String?;
  }

  Future<void> verify(String phone, String code) async {
    final res = await api.post('/auth/otp/verify', {'phone': phone, 'code': code, 'as': ?signupAs});
    api.token = res['token'];
    role = res['user']['role'];
    name = res['user']['name'];
    await prefs.setString(_kToken, api.token!);
    await prefs.setString(_kRole, role!);
    if (name != null) await prefs.setString(_kName, name!);
    notifyListeners();
  }

  Future<void> setName(String value) async {
    name = value;
    await prefs.setString(_kName, value);
    notifyListeners();
  }

  Future<void> logout() async {
    api.token = null;
    role = null;
    name = null;
    await prefs.remove(_kToken);
    await prefs.remove(_kRole);
    await prefs.remove(_kName);
    notifyListeners();
  }
}
