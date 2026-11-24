import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../config.dart';

class AuthState extends ChangeNotifier {
  AuthState(this.api, this.prefs) {
    api.token = prefs.getString(_kToken);
    _neighborhoodId = prefs.getString(_kNb);
    _neighborhoodName = prefs.getString(_kNbName);
    name = prefs.getString(_kName);
  }

  static const _kToken = 'auth.token';
  static const _kNb = 'auth.neighborhoodId';
  static const _kNbName = 'auth.neighborhoodName';
  static const _kName = 'auth.name';

  final ApiClient api;
  final SharedPreferences prefs;
  String? name;
  String? _neighborhoodId;
  String? _neighborhoodName;

  bool get isLoggedIn => api.token != null;
  String? get neighborhoodId => _neighborhoodId;
  String? get neighborhoodName => _neighborhoodName;

  /// Renvoie le code en mode développement (sinon null : il arrive par SMS).
  Future<String?> requestCode(String phone) async {
    final res = await api.post('/auth/otp/request', {'phone': phone});
    return res['devCode'] as String?;
  }

  Future<void> verify(String phone, String code) async {
    final res = await api.post('/auth/otp/verify', {'phone': phone, 'code': code});
    api.token = res['token'];
    await prefs.setString(_kToken, api.token!);
    final user = res['user'] as Map<String, dynamic>;
    name = user['name'];
    if (name != null) await prefs.setString(_kName, name!);
    if (user['neighborhoodId'] != null && _neighborhoodId == null) {
      // Quartier déjà choisi sur un autre téléphone : on récupère aussi son nom.
      try {
        final rows = await api.get('/cities/${AppConfig.citySlug}/neighborhoods', cache: true) as List;
        final match = rows.where((r) => r['id'] == user['neighborhoodId']);
        if (match.isNotEmpty) await setNeighborhood(Neighborhood.fromJson(match.first));
      } catch (_) {
        // sans réseau : le client choisira son quartier à l'écran suivant
      }
    }
    notifyListeners();
  }

  Future<void> setNeighborhood(Neighborhood n) async {
    _neighborhoodId = n.id;
    _neighborhoodName = n.name;
    await prefs.setString(_kNb, n.id);
    await prefs.setString(_kNbName, n.name);
    notifyListeners();
    try {
      await api.patch('/auth/me', {'neighborhoodId': n.id});
    } catch (_) {
      // sans réseau : le choix reste enregistré sur le téléphone
    }
  }

  Future<void> setName(String value) async {
    name = value;
    await prefs.setString(_kName, value);
    notifyListeners();
    await api.patch('/auth/me', {'name': value});
  }

  Future<void> logout() async {
    api.token = null;
    await prefs.remove(_kToken);
    notifyListeners();
  }
}
