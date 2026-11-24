class LatLngLite {
  final double lat;
  final double lng;
  const LatLngLite(this.lat, this.lng);
  static LatLngLite? fromJson(dynamic j) =>
      j == null ? null : LatLngLite((j['lat'] as num).toDouble(), (j['lng'] as num).toDouble());
  Map<String, dynamic> toJson() => {'lat': lat, 'lng': lng};
}

class Neighborhood {
  final String id;
  final String name;
  final LatLngLite? center;
  Neighborhood({required this.id, required this.name, this.center});
  factory Neighborhood.fromJson(Map<String, dynamic> j) =>
      Neighborhood(id: j['id'], name: j['name'], center: LatLngLite.fromJson(j['center']));
}

class Product {
  final String id;
  final String name;
  final String? description;
  final int price;
  final String? photoUrl;
  final String? section;
  final bool available;
  Product({required this.id, required this.name, this.description, required this.price, this.photoUrl, this.section, required this.available});
  factory Product.fromJson(Map<String, dynamic> j) => Product(
        id: j['id'],
        name: j['name'],
        description: j['description'],
        price: j['price'],
        photoUrl: j['photoUrl'],
        section: j['section'],
        available: j['available'] ?? true,
      );
  Map<String, dynamic> toJson() =>
      {'id': id, 'name': name, 'description': description, 'price': price, 'photoUrl': photoUrl, 'section': section, 'available': available};
}

class Shop {
  final String id;
  final String name;
  final String category;
  final String? description;
  final String neighborhoodId;
  final String? landmarkText;
  final String? photoUrl;
  final bool isOpen;
  final bool selfDelivery;
  final double ratingAvg;
  final int ratingCount;
  final int? distanceMeters;
  final LatLngLite? location;
  final List<Product> products;
  Shop({
    required this.id,
    required this.name,
    required this.category,
    this.description,
    required this.neighborhoodId,
    this.landmarkText,
    this.photoUrl,
    required this.isOpen,
    required this.selfDelivery,
    required this.ratingAvg,
    required this.ratingCount,
    this.distanceMeters,
    this.location,
    this.products = const [],
  });
  factory Shop.fromJson(Map<String, dynamic> j) => Shop(
        id: j['id'],
        name: j['name'],
        category: j['category'],
        description: j['description'],
        neighborhoodId: j['neighborhoodId'],
        landmarkText: j['landmarkText'],
        photoUrl: j['photoUrl'],
        isOpen: j['isOpen'] ?? false,
        selfDelivery: j['selfDelivery'] ?? false,
        ratingAvg: (j['ratingAvg'] as num?)?.toDouble() ?? 0,
        ratingCount: j['ratingCount'] ?? 0,
        distanceMeters: j['distanceMeters'],
        location: LatLngLite.fromJson(j['location']),
        products: ((j['products'] as List?) ?? []).map((p) => Product.fromJson(p)).toList(),
      );
}

class Address {
  final String id;
  final String label;
  final String neighborhoodId;
  final LatLngLite location;
  final String? landmarkText;
  final String? photoUrl;
  Address({required this.id, required this.label, required this.neighborhoodId, required this.location, this.landmarkText, this.photoUrl});
  factory Address.fromJson(Map<String, dynamic> j) => Address(
        id: j['id'],
        label: j['label'] ?? 'Maison',
        neighborhoodId: j['neighborhoodId'],
        location: LatLngLite.fromJson(j['location'])!,
        landmarkText: j['landmarkText'],
        photoUrl: j['photoUrl'],
      );
}

class OrderItem {
  final String id;
  final String productId;
  final String name;
  final int unitPrice;
  final int quantity;
  final String status;
  final String? substituteName;
  final int? substituteUnitPrice;
  OrderItem({
    required this.id,
    this.productId = '',
    required this.name,
    required this.unitPrice,
    required this.quantity,
    required this.status,
    this.substituteName,
    this.substituteUnitPrice,
  });
  factory OrderItem.fromJson(Map<String, dynamic> j) => OrderItem(
        id: j['id'],
        productId: j['productId'] ?? '',
        name: j['name'],
        unitPrice: j['unitPrice'],
        quantity: j['quantity'],
        status: j['status'],
        substituteName: j['substituteName'],
        substituteUnitPrice: j['substituteUnitPrice'],
      );
}

class Order {
  final String id;
  final String reference;
  final String status;
  final String dispatchStatus;
  final String deliveryMode;
  final String paymentMethod;
  final String paymentStatus;
  final int subtotal;
  final int deliveryFee;
  final int total;
  final int cancellationFee;
  final String? deliveryCode;
  final String? shopName;
  final String? courierId;
  final String? courierName;
  final LatLngLite? courierLocation;
  final String? note;
  final String? deliveryLandmark;
  final int? distanceMeters;
  final int commission;
  final int courierEarning;
  final int clientCallAttempts;
  final LatLngLite? shopLocation;
  final String? shopLandmark;
  final LatLngLite? deliveryLocation;
  final String? deliveryPhotoUrl;
  final String? deliveryVoiceNoteUrl;
  final List<OrderItem> items;
  final List<String> timeline;
  final DateTime createdAt;
  Order({
    required this.id,
    required this.reference,
    required this.status,
    required this.dispatchStatus,
    required this.deliveryMode,
    required this.paymentMethod,
    required this.paymentStatus,
    required this.subtotal,
    required this.deliveryFee,
    required this.total,
    required this.cancellationFee,
    this.deliveryCode,
    this.shopName,
    this.courierId,
    this.courierName,
    this.courierLocation,
    this.note,
    this.deliveryLandmark,
    this.distanceMeters,
    this.commission = 0,
    this.courierEarning = 0,
    this.clientCallAttempts = 0,
    this.shopLocation,
    this.shopLandmark,
    this.deliveryLocation,
    this.deliveryPhotoUrl,
    this.deliveryVoiceNoteUrl,
    required this.items,
    required this.timeline,
    required this.createdAt,
  });
  factory Order.fromJson(Map<String, dynamic> j) => Order(
        id: j['id'],
        reference: j['reference'],
        status: j['status'],
        dispatchStatus: j['dispatchStatus'] ?? 'NONE',
        deliveryMode: j['deliveryMode'],
        paymentMethod: j['paymentMethod'],
        paymentStatus: j['paymentStatus'],
        subtotal: j['subtotal'],
        deliveryFee: j['deliveryFee'],
        total: j['total'],
        cancellationFee: j['cancellationFee'] ?? 0,
        deliveryCode: j['deliveryCode'],
        shopName: j['shop']?['name'],
        courierId: j['courierId'],
        courierName: j['courier']?['name'],
        note: j['note'],
        deliveryLandmark: j['deliveryLandmark'],
        distanceMeters: j['distanceMeters'],
        commission: j['commission'] ?? 0,
        courierEarning: j['courierEarning'] ?? 0,
        clientCallAttempts: j['clientCallAttempts'] ?? 0,
        shopLocation: LatLngLite.fromJson(j['shop']?['location']),
        shopLandmark: j['shop']?['landmarkText'],
        deliveryLocation: LatLngLite.fromJson(j['deliveryLocation']),
        deliveryPhotoUrl: j['deliveryPhotoUrl'],
        deliveryVoiceNoteUrl: j['deliveryVoiceNoteUrl'],
        courierLocation: LatLngLite.fromJson(j['courier']?['location']),
        items: ((j['items'] as List?) ?? []).map((i) => OrderItem.fromJson(i)).toList(),
        timeline: ((j['timeline'] as List?) ?? []).map((e) => e['type'] as String).toList(),
        createdAt: DateTime.parse(j['createdAt']),
      );

  bool get isActive => !['DELIVERED', 'CANCELLED', 'RETURNED'].contains(status);
  bool get canCancelFree => ['AWAITING_PAYMENT', 'PENDING', 'AWAITING_CLIENT'].contains(status);
  /// Montant en espèces que le livreur encaisse à la remise.
  int get cashToCollect => paymentStatus == 'PAID' ? 0 : total;
  bool get canCancel => canCancelFree || ['CONFIRMED', 'READY'].contains(status);
}
