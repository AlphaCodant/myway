import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:material_ui/material_ui.dart';
import 'package:app_core/app_core.dart';
import 'package:livraison_client/main.dart';
import 'package:livraison_client/state/cart_state.dart';
import 'package:shared_preferences/shared_preferences.dart';

Shop _shop(String id) => Shop(
      id: id, name: 'Boutique $id', category: 'ALIMENTATION', neighborhoodId: 'n1',
      isOpen: true, selfDelivery: false, ratingAvg: 0, ratingCount: 0,
    );
Product _product(String id, int price) => Product(id: id, name: 'Produit $id', price: price, available: true);

void main() {
  setUpAll(() => initializeDateFormatting('fr'));

  test('format FCFA', () {
    expect(fcfa(12500), '12 500 F');
    expect(distance(850), '850 m');
    expect(distance(2300), '2,3 km');
  });

  group('Panier', () {
    late SharedPreferences prefs;
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      prefs = await SharedPreferences.getInstance();
    });

    test('additionne les quantités et se conserve sur le téléphone', () {
      final cart = CartState(prefs);
      final shop = _shop('A');
      cart.add(shop, _product('p1', 1000));
      cart.add(shop, _product('p1', 1000));
      cart.add(shop, _product('p2', 500));
      expect(cart.count, 3);
      expect(cart.subtotal, 2500);
      final reloaded = CartState(prefs);
      expect(reloaded.subtotal, 2500);
      expect(reloaded.shopId, 'A');
    });

    test('refuse un produit d’un autre commerce (une commande = un commerce)', () {
      final cart = CartState(prefs);
      expect(cart.add(_shop('A'), _product('p1', 1000)), isTrue);
      expect(cart.add(_shop('B'), _product('p9', 1000)), isFalse);
      cart.decrement('p1');
      expect(cart.isEmpty, isTrue);
      expect(cart.add(_shop('B'), _product('p9', 1000)), isTrue);
    });
  });

  test('sert le catalogue depuis le cache quand le réseau est coupé', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    var online = true;
    final client = MockClient((req) async {
      if (!online) throw http.ClientException('pas de réseau');
      return http.Response(jsonEncode([{'id': 's1', 'name': 'Chez Awa'}]), 200);
    });
    final api = ApiClient(httpClient: client, prefs: prefs, baseUrl: 'http://test');
    await api.get('/shops', cache: true);
    expect(api.servedFromCache, isFalse);
    online = false;
    final cached = await api.get('/shops', cache: true) as List;
    expect(cached.first['name'], 'Chez Awa');
    expect(api.servedFromCache, isTrue);
    expect(() => api.get('/autre'), throwsA(isA<ApiException>().having((e) => e.isNetwork, 'réseau', isTrue)));
  });

  test('traduit les erreurs de l’API en message lisible', () async {
    final client = MockClient((req) async => http.Response(jsonEncode({'message': 'Code incorrect'}), 400));
    final api = ApiClient(httpClient: client, baseUrl: 'http://test');
    expect(() => api.post('/auth/otp/verify', {}), throwsA(isA<ApiException>().having((e) => e.message, 'message', 'Code incorrect')));
  });

  testWidgets('connexion par numéro de téléphone et code SMS', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final client = MockClient((req) async {
      if (req.url.path.endsWith('/otp/request')) return http.Response(jsonEncode({'phone': '+2250701020304', 'devCode': '123456'}), 200);
      if (req.url.path.endsWith('/otp/verify')) {
        return http.Response(jsonEncode({'token': 't', 'user': {'id': 'u', 'name': null}, 'isNew': true}), 200);
      }
      if (req.url.path.endsWith('/neighborhoods')) {
        return http.Response(jsonEncode([{'id': 'n1', 'name': 'Commerce', 'center': null}]), 200);
      }
      return http.Response('[]', 200);
    });
    final api = ApiClient(httpClient: client, prefs: prefs, baseUrl: 'http://test');
    await tester.pumpWidget(ClientApp(api: api, prefs: prefs));
    expect(find.text('Recevoir le code'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('phone')), '07 01 02 03 04');
    await tester.tap(find.text('Recevoir le code'));
    await tester.pumpAndSettle();
    expect(find.text('Mode développement : code 123456'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('code')), '123456');
    await tester.tap(find.text('Valider'));
    await tester.pumpAndSettle();
    expect(find.text('Choisis ton quartier'), findsOneWidget);
    expect(find.text('Commerce'), findsOneWidget);
  });
}
