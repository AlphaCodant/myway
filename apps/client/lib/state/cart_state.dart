import 'package:app_core/app_core.dart';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';


class CartLine {
  final Product product;
  int quantity;
  CartLine(this.product, this.quantity);
  int get total => product.price * quantity;
  Map<String, dynamic> toJson() => {'product': product.toJson(), 'quantity': quantity};
  factory CartLine.fromJson(Map<String, dynamic> j) => CartLine(Product.fromJson(j['product']), j['quantity']);
}

/// Panier d'un seul commerce (règle du MVP), conservé sur le téléphone même sans réseau.
class CartState extends ChangeNotifier {
  CartState(this.prefs) {
    final raw = prefs.getString(_key);
    if (raw != null) {
      try {
        final j = jsonDecode(raw);
        shopId = j['shopId'];
        shopName = j['shopName'];
        shopSelfDelivery = j['shopSelfDelivery'] ?? false;
        lines.addAll((j['lines'] as List).map((l) => CartLine.fromJson(l)));
      } catch (_) {
        prefs.remove(_key);
      }
    }
  }

  static const _key = 'cart.v1';
  final SharedPreferences prefs;
  String? shopId;
  String? shopName;
  bool shopSelfDelivery = false;
  final List<CartLine> lines = [];

  int get count => lines.fold(0, (s, l) => s + l.quantity);
  int get subtotal => lines.fold(0, (s, l) => s + l.total);
  bool get isEmpty => lines.isEmpty;

  int quantityOf(String productId) =>
      lines.where((l) => l.product.id == productId).fold(0, (s, l) => s + l.quantity);

  /// Renvoie false si le produit vient d'un autre commerce (il faut vider le panier).
  bool add(Shop shop, Product p) {
    if (shopId != null && shopId != shop.id && lines.isNotEmpty) return false;
    shopId = shop.id;
    shopName = shop.name;
    shopSelfDelivery = shop.selfDelivery;
    final existing = lines.where((l) => l.product.id == p.id);
    if (existing.isNotEmpty) {
      existing.first.quantity = (existing.first.quantity + 1).clamp(1, 99);
    } else {
      lines.add(CartLine(p, 1));
    }
    _save();
    return true;
  }

  void decrement(String productId) {
    final existing = lines.where((l) => l.product.id == productId).toList();
    if (existing.isEmpty) return;
    existing.first.quantity--;
    if (existing.first.quantity <= 0) lines.remove(existing.first);
    _save();
  }

  void clear() {
    lines.clear();
    shopId = null;
    shopName = null;
    _save();
  }

  List<Map<String, dynamic>> toItems() => lines.map((l) => {'productId': l.product.id, 'quantity': l.quantity}).toList();

  void _save() {
    prefs.setString(
      _key,
      jsonEncode({'shopId': shopId, 'shopName': shopName, 'shopSelfDelivery': shopSelfDelivery, 'lines': lines.map((l) => l.toJson()).toList()}),
    );
    notifyListeners();
  }
}
