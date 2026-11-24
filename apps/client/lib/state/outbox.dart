import 'package:app_core/app_core.dart';
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';


/// File d'envoi des commandes passées sans réseau. Chaque commande porte un identifiant
/// (clientRequestId) : l'API ne la crée qu'une fois, même si l'envoi est rejoué.
class OrderOutbox extends ChangeNotifier {
  OrderOutbox(this.api, this.prefs) {
    final raw = prefs.getStringList(_key) ?? [];
    pending.addAll(raw.map((e) => jsonDecode(e) as Map<String, dynamic>));
    _timer = Timer.periodic(const Duration(seconds: 20), (_) => flush());
  }

  static const _key = 'outbox.orders';
  final ApiClient api;
  final SharedPreferences prefs;
  final List<Map<String, dynamic>> pending = [];
  Timer? _timer;
  bool _flushing = false;

  /// Commandes envoyées avec succès depuis la file (pour afficher le suivi).
  final StreamController<Map<String, dynamic>> sent = StreamController.broadcast();

  Future<void> enqueue(Map<String, dynamic> body) async {
    pending.add(body);
    await _save();
  }

  Future<void> flush() async {
    if (_flushing || pending.isEmpty || api.token == null) return;
    _flushing = true;
    try {
      for (final body in List.of(pending)) {
        try {
          final res = await api.post('/orders', body);
          pending.remove(body);
          sent.add(res as Map<String, dynamic>);
        } on ApiException catch (e) {
          if (e.isNetwork) break; // toujours pas de réseau
          pending.remove(body); // refus définitif (commerce fermé, rupture…)
          sent.addError(e);
        }
      }
      await _save();
    } finally {
      _flushing = false;
    }
  }

  Future<void> _save() async {
    await prefs.setStringList(_key, pending.map(jsonEncode).toList());
    notifyListeners();
  }

  @override
  void dispose() {
    _timer?.cancel();
    sent.close();
    super.dispose();
  }
}
