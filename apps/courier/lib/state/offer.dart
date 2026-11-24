import 'package:app_core/app_core.dart';

/// Proposition de course envoyée au livreur le plus proche (30 s pour répondre).
class Offer {
  final String id;
  final String orderId;
  final String reference;
  final DateTime expiresAt;
  final int? distanceMeters;
  final int estimatedEarning;
  final String shopName;
  final LatLngLite? shopLocation;
  final String? shopLandmark;
  final LatLngLite? dropoffLocation;
  final String? dropoffLandmark;
  final int cashToCollect;

  Offer({
    required this.id,
    required this.orderId,
    required this.reference,
    required this.expiresAt,
    this.distanceMeters,
    required this.estimatedEarning,
    required this.shopName,
    this.shopLocation,
    this.shopLandmark,
    this.dropoffLocation,
    this.dropoffLandmark,
    required this.cashToCollect,
  });

  factory Offer.fromJson(Map<String, dynamic> j) => Offer(
        id: j['offerId'],
        orderId: j['orderId'],
        reference: j['reference'],
        expiresAt: DateTime.parse(j['expiresAt']).toLocal(),
        distanceMeters: j['distanceMeters'],
        estimatedEarning: j['estimatedEarning'] ?? 0,
        shopName: j['shop']?['name'] ?? '',
        shopLocation: LatLngLite.fromJson(j['shop']?['location']),
        shopLandmark: j['shop']?['landmark'],
        dropoffLocation: LatLngLite.fromJson(j['dropoff']?['location']),
        dropoffLandmark: j['dropoff']?['landmark'],
        cashToCollect: j['cashToCollect'] ?? 0,
      );

  int secondsLeft([DateTime? now]) {
    final s = expiresAt.difference(now ?? DateTime.now()).inSeconds;
    return s < 0 ? 0 : s;
  }

  bool get expired => secondsLeft() <= 0;
}
