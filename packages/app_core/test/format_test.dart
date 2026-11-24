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
}
