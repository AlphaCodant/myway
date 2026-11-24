import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:flutter/foundation.dart';

import 'alert.dart';

/// Commerce du commerçant + commandes en cours, tenues à jour en temps réel
/// (avec un rafraîchissement toutes les 20 s si le temps réel est coupé).
class OrdersState extends ChangeNotifier {
  OrdersState(this.api, this.realtime, this.alert);
  final ApiClient api;
  final Realtime realtime;
  final OrderAlert alert;

  Map<String, dynamic>? shop;
  List<Order> orders = [];
  Object? error;
  bool loading = true;
  final _subs = <StreamSubscription>[];
  Timer? _poll;

  List<Order> get incoming => orders.where((o) => o.status == 'PENDING').toList();
  List<Order> get waitingClient => orders.where((o) => o.status == 'AWAITING_CLIENT').toList();
  List<Order> get inProgress => orders.where((o) => ['CONFIRMED', 'READY', 'PICKED_UP'].contains(o.status)).toList();
  bool get isOpen => shop?['isOpen'] == true;
  bool get validated => shop?['status'] == 'ACTIVE';
  String? get shopId => shop?['id'];

  Future<void> start() async {
    realtime.connect();
    _subs.add(realtime.on('order.new').listen((_) => refresh()));
    _subs.add(realtime.on('order.updated').listen((_) => refresh()));
    _subs.add(realtime.on('order.reminder').listen((_) => alert.start()));
    _poll = Timer.periodic(const Duration(seconds: 20), (_) => refresh());
    await loadShop();
    await refresh();
  }

  Future<void> loadShop() async {
    try {
      shop = await api.get('/merchant/shops/mine', cache: true);
      error = null;
    } catch (e) {
      error = e;
    }
    notifyListeners();
  }

  Future<void> refresh() async {
    try {
      final rows = await api.get('/merchant/orders') as List;
      final previous = orders.map((o) => o.id).toSet();
      orders = rows.map((r) => Order.fromJson(r)).toList();
      final fresh = incoming.where((o) => !previous.contains(o.id));
      if (fresh.isNotEmpty && !loading) alert.start();
      if (loading && incoming.isNotEmpty) alert.start();
      if (incoming.isEmpty) alert.stop();
      error = null;
    } catch (e) {
      error ??= e;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> setOpen(bool open) async {
    shop = await api.post('/merchant/shops/$shopId/open', {'isOpen': open});
    notifyListeners();
  }

  /// Exécute une action sur une commande puis rafraîchit la liste.
  Future<Order> act(String orderId, String action, [Map<String, dynamic>? body]) async {
    final res = await api.post('/merchant/orders/$orderId/$action', body);
    await refresh();
    return Order.fromJson(res);
  }

  Future<Order> actAsDeliverer(String orderId, String action, [Map<String, dynamic>? body]) async {
    final res = await api.post('/orders/$orderId/$action', body);
    await refresh();
    return Order.fromJson(res);
  }

  void silence() => alert.stop();

  @override
  void dispose() {
    for (final s in _subs) {
      s.cancel();
    }
    _poll?.cancel();
    alert.stop();
    super.dispose();
  }
}
