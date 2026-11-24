import 'dart:convert';

import 'package:app_core/app_core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:livraison_courier/main.dart';
import 'package:livraison_courier/state/alert.dart';
import 'package:livraison_courier/state/courier_state.dart';
import 'package:livraison_courier/state/position.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

Map<String, dynamic> _offer({int inSeconds = 30}) => {
      'offerId': 'f1',
      'orderId': 'A',
      'reference': 'GAG-A',
      'expiresAt': DateTime.now().add(Duration(seconds: inSeconds)).toUtc().toIso8601String(),
      'distanceMeters': 1800,
      'estimatedEarning': 400,
      'shop': {'name': 'Boutique Chez Awa', 'location': {'lat': 6.13, 'lng': -5.95}, 'landmark': 'Face à la pharmacie'},
      'dropoff': {'location': {'lat': 6.14, 'lng': -5.94}, 'landmark': 'Portail bleu après la mosquée'},
      'cashToCollect': 2400,
    };

Map<String, dynamic> _order(String status) => {
      'id': 'A',
      'reference': 'GAG-A',
      'status': status,
      'dispatchStatus': 'ASSIGNED',
      'deliveryMode': 'PLATFORM',
      'paymentMethod': 'CASH',
      'paymentStatus': 'PENDING',
      'subtotal': 1900,
      'deliveryFee': 500,
      'total': 2400,
      'courierEarning': status == 'DELIVERED' ? 400 : 0,
      'deliveryLandmark': 'Portail bleu après la mosquée',
      'shop': {'id': 's1', 'name': 'Boutique Chez Awa', 'location': {'lat': 6.13, 'lng': -5.95}, 'landmarkText': 'Face à la pharmacie'},
      'deliveryLocation': {'lat': 6.14, 'lng': -5.94},
      'items': [
        {'id': 'i1', 'productId': 'p1', 'name': 'Huile Dinor 1 L', 'unitPrice': 1500, 'quantity': 1, 'status': 'OK'},
      ],
      'timeline': [],
      'createdAt': DateTime.now().toIso8601String(),
    };

Map<String, dynamic> _profile({bool online = false, String status = 'ACTIVE'}) => {
      'userId': 'u',
      'name': 'Koffi Yao',
      'phone': '+2250704040404',
      'status': status,
      'online': online,
      'vehicle': 'MOTO',
      'cashHeld': 0,
    };

const _wallet = {'earningsBalance': 0, 'earnedToday': 0, 'deliveriesToday': 0, 'cashHeld': 0, 'cashCeiling': 50000, 'history': []};

class _NoGps implements PositionSource {
  @override
  Future<LatLngLite> current() async => throw PositionException('Active la localisation');
}

http.Response _json(Object? body, [int status = 200]) =>
    http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json; charset=utf-8'});

void main() {
  setUpAll(() => initializeDateFormatting('fr'));

  test('sonne pendant une proposition, se tait après un refus', () async {
    final calls = <String>[];
    var offers = <Map<String, dynamic>>[];
    final api = ApiClient(
      baseUrl: 'http://test',
      httpClient: MockClient((req) async {
        final p = req.url.path;
        calls.add('${req.method} $p');
        if (p.endsWith('/courier/profile')) return _json((_profile()), 200);
        if (p.endsWith('/courier/wallet')) return _json((_wallet), 200);
        if (p.endsWith('/courier/offers')) return _json((offers), 200);
        if (p.endsWith('/decline')) return http.Response('{}', 201);
        return http.Response('[]', 200);
      }),
    );
    final alert = SilentOfferAlert();
    final state = CourierState(api, Realtime(api), alert, FixedPositionSource(const LatLngLite(6.13, -5.95)));
    await state.start();
    expect(alert.ringing, isFalse);

    offers = [_offer()];
    await state.refreshOffers();
    expect(alert.ringing, isTrue);
    expect(state.offers.single.cashToCollect, 2400);

    await state.declineOffer(state.offers.single);
    expect(calls, contains('POST /api/courier/offers/f1/decline'));
    expect(alert.ringing, isFalse);

    // Une offre déjà expirée n'est pas affichée.
    offers = [_offer(inSeconds: -1)];
    await state.refreshOffers();
    expect(state.offers, isEmpty);
    state.dispose();
  });

  test('sans GPS, le livreur ne peut pas passer en service', () async {
    final calls = <String>[];
    final api = ApiClient(
      baseUrl: 'http://test',
      httpClient: MockClient((req) async {
        calls.add('${req.method} ${req.url.path}');
        if (req.url.path.endsWith('/courier/profile')) return _json((_profile()), 200);
        return http.Response('[]', 200);
      }),
    );
    final state = CourierState(api, Realtime(api), SilentOfferAlert(), _NoGps());
    await state.start();
    await expectLater(state.setOnline(true), throwsA(isA<PositionException>()));
    expect(calls, isNot(contains('POST /api/courier/online')));
    expect(state.positionError, isNotNull);
    state.dispose();
  });

  testWidgets('le livreur passe en service, accepte une course, la récupère et la remet avec le code', (tester) async {
    // Écran de téléphone (400 × 900).
    tester.view.physicalSize = const Size(1200, 2700);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    var online = false;
    String? status;
    final calls = <String>[];
    Map<String, dynamic>? verifyBody;
    final api = ApiClient(
      prefs: prefs,
      baseUrl: 'http://test',
      httpClient: MockClient((req) async {
        final p = req.url.path;
        calls.add('${req.method} $p');
        if (p.endsWith('/otp/request')) return _json(({'devCode': '111111'}), 200);
        if (p.endsWith('/otp/verify')) {
          verifyBody = jsonDecode(req.body);
          return _json(({'token': 't', 'user': {'id': 'u', 'role': 'COURIER', 'name': 'Koffi Yao'}}), 200);
        }
        if (p.endsWith('/courier/profile')) return _json((_profile(online: online)), 200);
        if (p.endsWith('/courier/wallet')) return _json((_wallet), 200);
        if (p.endsWith('/courier/online')) {
          online = true;
          return _json(({'online': true, 'cashHeld': 0, 'cashCeiling': 50000, 'blocked': false}), 201);
        }
        if (p.endsWith('/courier/position')) return http.Response('{"ok":true}', 201);
        if (p.endsWith('/courier/offers')) return _json((online && status == null ? [_offer()] : []), 200);
        if (p.endsWith('/offers/f1/accept')) {
          status = 'READY';
          return _json((_order(status!)), 201);
        }
        if (p.endsWith('/courier/orders')) return _json((status == null || status == 'DELIVERED' ? [] : [_order(status!)]), 200);
        if (p.endsWith('/orders/A/picked-up')) status = 'PICKED_UP';
        if (p.endsWith('/orders/A/deliver')) {
          if (jsonDecode(req.body)['code'] != '4821') return _json(({'message': 'Code de remise incorrect'}), 400);
          status = 'DELIVERED';
        }
        if (p.endsWith('/orders/A') || p.contains('/orders/A/')) return _json((_order(status ?? 'READY')), 200);
        return http.Response('[]', 200);
      }),
    );
    final alert = SilentOfferAlert();
    await tester.pumpWidget(CourierApp(
      api: api,
      prefs: prefs,
      alert: alert,
      positions: FixedPositionSource(const LatLngLite(6.131, -5.951)),
      showMaps: false,
    ));
    await tester.enterText(find.byKey(const Key('phone')), '0704040404');
    await tester.tap(find.text('Recevoir le code'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('code')), '111111');
    await tester.tap(find.text('Valider'));
    await tester.pumpAndSettle();
    expect(verifyBody?['as'], 'COURIER', reason: 'un nouveau numéro devient un compte livreur');
    expect(find.text('HORS SERVICE'), findsOneWidget);

    await tester.tap(find.byKey(const Key('onlineSwitch')));
    await tester.pumpAndSettle();
    expect(calls, containsAllInOrder(['POST /api/courier/online', 'POST /api/courier/position']));

    // La proposition arrive au rafraîchissement suivant.
    await tester.pump(const Duration(seconds: 15));
    await tester.pumpAndSettle();
    expect(find.text('Nouvelle course !'), findsOneWidget);
    expect(find.text('Encaisser 2 400 F en espèces'), findsOneWidget);
    expect(alert.ringing, isTrue);

    await tester.tap(find.byKey(const Key('acceptOffer')));
    await tester.pumpAndSettle();
    expect(alert.ringing, isFalse);
    expect(find.text('Course GAG-A'), findsOneWidget);

    await tester.tap(find.byKey(const Key('pickedUp')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Oui'));
    await tester.pumpAndSettle();
    expect(calls, contains('POST /api/orders/A/picked-up'));
    expect(find.text('Encaisser 2 400 F en espèces'), findsOneWidget);

    await tester.ensureVisible(find.byKey(const Key('deliver')));
    await tester.tap(find.byKey(const Key('deliver')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('handoverCode')), '4821');
    await tester.tap(find.text('Valider'));
    await tester.pumpAndSettle();
    expect(find.text('Course terminée'), findsOneWidget);
    expect(find.text('+ 400 F sur tes gains'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
  });
}
