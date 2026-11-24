import 'dart:async';

import 'package:socket_io_client/socket_io_client.dart' as io;

import 'api_client.dart';

class RealtimeEvent {
  final String name;
  final Map<String, dynamic> data;
  RealtimeEvent(this.name, this.data);
}

/// Événements temps réel de l'API (Socket.IO, namespace /realtime).
/// En cas de coupure, les écrans se rafraîchissent aussi périodiquement.
class Realtime {
  Realtime(this.api, {this.events = const ['order.updated']});
  final ApiClient api;
  final List<String> events;
  io.Socket? _socket;
  final _controller = StreamController<RealtimeEvent>.broadcast();

  Stream<RealtimeEvent> get stream => _controller.stream;
  Stream<Map<String, dynamic>> on(String event) => stream.where((e) => e.name == event).map((e) => e.data);
  Stream<Map<String, dynamic>> get orderUpdates => on('order.updated');

  void connect() {
    if (_socket != null || api.token == null) return;
    _socket = io.io(
      '${api.baseUrl}/realtime',
      io.OptionBuilder().setTransports(['websocket']).setAuth({'token': api.token}).enableReconnection().build(),
    );
    for (final name in events) {
      _socket!.on(name, (data) {
        if (data is Map) _controller.add(RealtimeEvent(name, Map<String, dynamic>.from(data)));
      });
    }
  }

  void disconnect() {
    _socket?.dispose();
    _socket = null;
  }
}
