import 'package:app_core/app_core.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('format FCFA et distances', () {
    expect(fcfa(1500), '1 500 F');
    expect(distance(419), '419 m');
    expect(distance(1250), '1,3 km');
  });

  test('lit une commande de l’API', () {
    final o = Order.fromJson({
      'id': 'o1', 'reference': 'GAG-AB123', 'status': 'PENDING', 'deliveryMode': 'PICKUP', 'paymentMethod': 'CASH',
      'paymentStatus': 'PENDING', 'subtotal': 1000, 'deliveryFee': 0, 'total': 1000, 'note': 'Vite',
      'items': [{'id': 'i1', 'productId': 'p1', 'name': 'Pain', 'unitPrice': 500, 'quantity': 2, 'status': 'OK'}],
      'createdAt': '2026-11-24T10:00:00Z',
    });
    expect(o.items.single.productId, 'p1');
    expect(o.note, 'Vite');
    expect(o.canCancelFree, isTrue);
  });

  test('lit les informations utiles au livreur', () {
    final o = Order.fromJson({
      'id': 'o2', 'reference': 'GAG-CD456', 'status': 'PICKED_UP', 'deliveryMode': 'PLATFORM', 'paymentMethod': 'CASH',
      'paymentStatus': 'PENDING', 'subtotal': 1900, 'deliveryFee': 500, 'total': 2400, 'courierEarning': 400,
      'clientCallAttempts': 2, 'deliveryLocation': {'lat': 6.14, 'lng': -5.94}, 'deliveryPhotoUrl': '/uploads/portail.jpg',
      'shop': {'name': 'Chez Awa', 'location': {'lat': 6.13, 'lng': -5.95}, 'landmarkText': 'Face au marché'},
      'items': [], 'createdAt': '2026-11-24T10:00:00Z',
    });
    expect(o.cashToCollect, 2400);
    expect(o.shopLocation?.lat, 6.13);
    expect(o.shopLandmark, 'Face au marché');
    expect(o.deliveryLocation?.lng, -5.94);
    expect(o.clientCallAttempts, 2);
    expect(o.courierEarning, 400);
  });
}
