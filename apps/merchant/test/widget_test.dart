import 'dart:convert';

import 'package:app_core/app_core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:livraison_merchant/main.dart';
import 'package:livraison_merchant/state/alert.dart';
import 'package:livraison_merchant/state/orders_state.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

Map<String, dynamic> _order(String id, String status, {String mode = 'PLATFORM'}) => {
      'id': id,
      'reference': 'GAG-$id',
      'status': status,
      'dispatchStatus': 'NONE',
      'deliveryMode': mode,
      'paymentMethod': 'CASH',
      'paymentStatus': 'PENDING',
      'subtotal': 1900,
      'deliveryFee': 500,
      'total': 2400,
      'cancellationFee': 0,
      'items': [
        {'id': 'i1', 'productId': 'p1', 'name': 'Huile Dinor 1 L', 'unitPrice': 1500, 'quantity': 1, 'status': 'OK'},
        {'id': 'i2', 'productId': 'p2', 'name': 'Eau 1,5 L', 'unitPrice': 400, 'quantity': 1, 'status': 'OK'},
      ],
      'timeline': [],
      'createdAt': DateTime.now().toIso8601String(),
    };

const _shop = {'id': 's1', 'name': 'Boutique Chez Awa', 'status': 'ACTIVE', 'isOpen': true};

void main() {
  setUpAll(() => initializeDateFormatting('fr'));

  test('sonne à l’arrivée d’une nouvelle commande et se tait quand il n’y en a plus', () async {
    var orders = <Map<String, dynamic>>[];
    final api = ApiClient(
      baseUrl: 'http://test',
      httpClient: MockClient((req) async {
        if (req.url.path.endsWith('/merchant/shops/mine')) return http.Response(jsonEncode(_shop), 200);
        return http.Response(jsonEncode(orders), 200);
      }),
    );
    final alert = SilentOrderAlert();
    final state = OrdersState(api, Realtime(api), alert);
    await state.start();
    expect(alert.ringing, isFalse);
    orders = [_order('A', 'PENDING')];
    await state.refresh();
    expect(alert.ringing, isTrue);
    expect(state.incoming, hasLength(1));
    orders = [_order('A', 'CONFIRMED')];
    await state.refresh();
    expect(alert.ringing, isFalse);
    expect(state.inProgress, hasLength(1));
    state.dispose();
  });

  testWidgets('le commerçant se connecte, voit la nouvelle commande et l’accepte', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    var status = 'PENDING';
    final calls = <String>[];
    final api = ApiClient(
      prefs: prefs,
      baseUrl: 'http://test',
      httpClient: MockClient((req) async {
        final p = req.url.path;
        calls.add('${req.method} $p');
        if (p.endsWith('/otp/request')) return http.Response(jsonEncode({'devCode': '111111'}), 200);
        if (p.endsWith('/otp/verify')) {
          return http.Response(jsonEncode({'token': 't', 'user': {'id': 'u', 'role': 'MERCHANT', 'name': 'Awa'}}), 200);
        }
        if (p.endsWith('/merchant/shops/mine')) return http.Response(jsonEncode(_shop), 200);
        if (p.endsWith('/merchant/orders')) return http.Response(jsonEncode([_order('A', status)]), 200);
        if (p.endsWith('/accept')) {
          status = 'CONFIRMED';
          return http.Response(jsonEncode(_order('A', status)), 201);
        }
        if (p.endsWith('/orders/A')) return http.Response(jsonEncode(_order('A', status)), 200);
        return http.Response('[]', 200);
      }),
    );
    final alert = SilentOrderAlert();
    await tester.pumpWidget(MerchantApp(api: api, prefs: prefs, alert: alert));
    await tester.enterText(find.byKey(const Key('phone')), '0701010101');
    await tester.tap(find.text('Recevoir le code'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('code')), '111111');
    await tester.tap(find.text('Valider'));
    await tester.pumpAndSettle();

    expect(find.text('OUVERT : tu reçois les commandes'), findsOneWidget);
    expect(find.text('Nouvelles commandes (1)'), findsOneWidget);
    expect(alert.ringing, isTrue);

    await tester.tap(find.textContaining('GAG-A'));
    await tester.pumpAndSettle();
    expect(alert.ringing, isFalse, reason: 'ouvrir la commande coupe la sonnerie');
    await tester.tap(find.byKey(const Key('accept')));
    await tester.pumpAndSettle();
    expect(calls, contains('POST /api/merchant/orders/A/accept'));
    expect(find.text('Confirmée, en préparation'), findsOneWidget);
    expect(find.byKey(const Key('ready')), findsOneWidget);

    // Arrête les minuteries de rafraîchissement
    await tester.pumpWidget(const SizedBox());
  });
}
