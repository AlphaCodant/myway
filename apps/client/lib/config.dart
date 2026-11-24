import 'package:flutter/foundation.dart';

/// Adresse de l'API. À fournir au build :
///   flutter run --dart-define=API_URL=https://api.exemple.ci
/// Par défaut : l'émulateur Android joint la machine hôte via 10.0.2.2.
class AppConfig {
  static const String _fromEnv = String.fromEnvironment('API_URL');

  static String get apiUrl {
    if (_fromEnv.isNotEmpty) return _fromEnv;
    return kIsWeb ? 'http://localhost:3000' : 'http://10.0.2.2:3000';
  }

  static const String citySlug = 'gagnoa';
}
