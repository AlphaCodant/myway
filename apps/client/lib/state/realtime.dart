import 'dart:async';

import 'package:socket_io_client/socket_io_client.dart' as io;

import '../api/api_client.dart';

/// Mises à jour en temps réel des commandes (statut, livreur…).
/// En cas de coupure, l'écran de suivi se rafraîchit aussi périodiquement.
class Realtime {
  Realtime(this.api);
  final ApiClient api;
  io.Socket? _socket;
  final _updates = StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get orderUpdates => _updates.stream;

  void connect() {
    if (_socket != null || api.token == null) return;
    _socket = io.io(
      '${api.baseUrl}/realtime',
      io.OptionBuilder().setTransports(['websocket']).setAuth({'token': api.token}).enableReconnection().build(),
    );
    _socket!.on('order.updated', (data) {
      if (data is Map) _updates.add(Map<String, dynamic>.from(data));
    });
  }

  void disconnect() {
    _socket?.dispose();
    _socket = null;
  }
}
