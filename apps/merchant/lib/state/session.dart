import 'package:app_core/app_core.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Session du commerçant (ou de l'agent terrain).
class Session extends ChangeNotifier {
  Session(this.api, this.prefs) {
    api.token = prefs.getString(_kToken);
    role = prefs.getString(_kRole);
    name = prefs.getString(_kName);
  }

  static const _kToken = 'merchant.token';
  static const _kRole = 'merchant.role';
  static const _kName = 'merchant.name';
  final ApiClient api;
  final SharedPreferences prefs;
  String? role;
  String? name;

  bool get isLoggedIn => api.token != null;

  Future<String?> requestCode(String phone) async {
    final res = await api.post('/auth/otp/request', {'phone': phone});
    return res['devCode'] as String?;
  }

  Future<void> verify(String phone, String code) async {
    final res = await api.post('/auth/otp/verify', {'phone': phone, 'code': code});
    api.token = res['token'];
    role = res['user']['role'];
    name = res['user']['name'];
    await prefs.setString(_kToken, api.token!);
    await prefs.setString(_kRole, role!);
    if (name != null) await prefs.setString(_kName, name!);
    notifyListeners();
  }

  Future<void> logout() async {
    api.token = null;
    role = null;
    await prefs.remove(_kToken);
    await prefs.remove(_kRole);
    notifyListeners();
  }
}
