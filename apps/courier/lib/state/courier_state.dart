import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:flutter/foundation.dart';

import 'alert.dart';
import 'offer.dart';
import 'position.dart';

/// État du livreur : profil, disponibilité, position partagée, propositions et courses en cours.
/// Tenu à jour en temps réel, avec un rafraîchissement toutes les 15 s si le temps réel est coupé.
class CourierState extends ChangeNotifier {
  CourierState(this.api, this.realtime, this.alert, this.positions, {this.positionEvery = const Duration(seconds: 20), this.showMaps = true});
  final ApiClient api;
  final Realtime realtime;
  final OfferAlert alert;
  final PositionSource positions;
  final Duration positionEvery;

  /// Cartes OpenStreetMap (désactivées dans les tests, qui n'ont pas de réseau).
  final bool showMaps;

  Map<String, dynamic>? profile;
  Map<String, dynamic>? wallet;
  List<Offer> offers = [];
  List<Order> jobs = [];
  Object? error;
  String? positionError;
  LatLngLite? lastPosition;
  bool loading = true;

  final _subs = <StreamSubscription>[];
  Timer? _poll;
  Timer? _positionTimer;
  Timer? _ticker;

  bool get online => profile?['online'] == true;
  bool get validated => profile?['status'] == 'ACTIVE';
  int get cashHeld => (wallet?['cashHeld'] ?? profile?['cashHeld'] ?? 0) as int;
  int get cashCeiling => (wallet?['cashCeiling'] ?? 50000) as int;
  bool get blocked => cashHeld >= cashCeiling;
  bool get busy => jobs.isNotEmpty;

  /// Pièces demandées avant validation du compte.
  bool get documentsComplete =>
      profile != null &&
      ['idDocumentUrl', 'photoUrl', 'emergencyContact'].every((k) => (profile![k] ?? '').toString().isNotEmpty) &&
      (profile!['vehicle'] != 'MOTO' || ['licenseUrl', 'registrationUrl'].every((k) => (profile![k] ?? '').toString().isNotEmpty));

  Future<void> start() async {
    realtime.connect();
    _subs.add(realtime.on('offer.new').listen(_onOffer));
    _subs.add(realtime.on('offer.cancelled').listen((d) => _removeOffer(d['offerId'])));
    for (final e in ['order.updated', 'order.assigned', 'order.unassigned']) {
      _subs.add(realtime.on(e).listen((_) => refreshJobs()));
    }
    _poll = Timer.periodic(const Duration(seconds: 15), (_) => refresh());
    await loadProfile();
    await refresh();
    if (online) _startSharingPosition();
  }

  Future<void> loadProfile() async {
    try {
      profile = await api.get('/courier/profile', cache: true);
      error = null;
    } catch (e) {
      error = e;
    }
    notifyListeners();
  }

  Future<void> refresh() async {
    await Future.wait([refreshOffers(), refreshJobs(), refreshWallet()]);
    loading = false;
    notifyListeners();
  }

  Future<void> refreshOffers() async {
    try {
      final rows = await api.get('/courier/offers') as List;
      offers = rows.map((r) => Offer.fromJson(r)).where((o) => !o.expired).toList();
      _syncAlert();
    } catch (_) {}
  }

  Future<void> refreshJobs() async {
    try {
      final rows = await api.get('/courier/orders', cache: true) as List;
      jobs = rows.map((r) => Order.fromJson(r)).toList();
      error = null;
    } catch (e) {
      error ??= e;
    }
    notifyListeners();
  }

  Future<void> refreshWallet() async {
    try {
      wallet = await api.get('/courier/wallet', cache: true);
    } catch (_) {}
    notifyListeners();
  }

  Future<List<Order>> history() async {
    final rows = await api.get('/courier/orders', query: {'active': 'false'}) as List;
    return rows.map((r) => Order.fromJson(r)).where((o) => !o.isActive).toList();
  }

  void _onOffer(Map<String, dynamic> data) {
    final offer = Offer.fromJson(data);
    if (offer.expired || offers.any((o) => o.id == offer.id)) return;
    offers = [...offers, offer];
    _syncAlert();
    notifyListeners();
  }

  void _removeOffer(String? id) {
    offers = offers.where((o) => o.id != id).toList();
    _syncAlert();
    notifyListeners();
  }

  /// La sonnerie tourne tant qu'une proposition attend une réponse ; un compte à rebours retire les offres expirées.
  void _syncAlert() {
    if (offers.isEmpty) {
      alert.stop();
      _ticker?.cancel();
      _ticker = null;
      return;
    }
    alert.start();
    _ticker ??= Timer.periodic(const Duration(seconds: 1), (_) {
      final before = offers.length;
      offers = offers.where((o) => !o.expired).toList();
      if (offers.length != before) _syncAlert();
      notifyListeners();
    });
  }

  // ───────────── Disponibilité et position ─────────────

  Future<void> setOnline(bool value) async {
    if (value) {
      // On vérifie la position avant de passer en service : sans GPS, aucune course ne peut être proposée.
      try {
        lastPosition = await positions.current();
        positionError = null;
      } on PositionException catch (e) {
        positionError = e.message;
        notifyListeners();
        rethrow;
      }
    }
    final res = await api.post('/courier/online', {'online': value});
    profile = {...?profile, 'online': res['online'], 'cashHeld': res['cashHeld']};
    if (value) {
      await _sendPosition();
      _startSharingPosition();
    } else {
      _positionTimer?.cancel();
      _positionTimer = null;
    }
    await refreshWallet();
    notifyListeners();
  }

  void _startSharingPosition() {
    _positionTimer?.cancel();
    _positionTimer = Timer.periodic(positionEvery, (_) => _sendPosition());
  }

  Future<void> _sendPosition() async {
    try {
      final p = await positions.current();
      lastPosition = p;
      await api.post('/courier/position', p.toJson());
      positionError = null;
    } on PositionException catch (e) {
      positionError = e.message;
    } catch (_) {
      // Réseau coupé : on réessaie au prochain envoi.
    }
    notifyListeners();
  }

  Future<LatLngLite> currentPosition() => positions.current();

  // ───────────── Propositions et courses ─────────────

  Future<Order> acceptOffer(Offer offer) async {
    try {
      final res = await api.post('/courier/offers/${offer.id}/accept');
      return Order.fromJson(res);
    } finally {
      _removeOffer(offer.id);
      await refreshJobs();
    }
  }

  Future<void> declineOffer(Offer offer) async {
    try {
      await api.post('/courier/offers/${offer.id}/decline');
    } finally {
      _removeOffer(offer.id);
    }
  }

  /// Action sur une course : picked-up, call-attempt, deliver, return, correct-location.
  Future<Order?> act(String orderId, String action, [Map<String, dynamic>? body]) async {
    final res = await api.post('/orders/$orderId/$action', body);
    await refreshJobs();
    if (['deliver', 'return'].contains(action)) await refreshWallet();
    return res is Map<String, dynamic> && res['reference'] != null ? Order.fromJson(res) : null;
  }

  // ───────────── Profil et portefeuille ─────────────

  Future<void> updateProfile(Map<String, dynamic> changes) async {
    profile = await api.patch('/courier/profile', changes);
    notifyListeners();
  }

  Future<void> withdraw(int amount) async {
    await api.post('/courier/withdraw', {'amount': amount});
    await refreshWallet();
  }

  @override
  void dispose() {
    for (final s in _subs) {
      s.cancel();
    }
    _poll?.cancel();
    _positionTimer?.cancel();
    _ticker?.cancel();
    alert.stop();
    super.dispose();
  }
}
