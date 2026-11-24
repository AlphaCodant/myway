import 'package:app_core/app_core.dart';
import 'package:geolocator/geolocator.dart';

class PositionException implements Exception {
  PositionException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// Source de la position du livreur (GPS du téléphone, ou position fixe pour les tests).
abstract class PositionSource {
  Future<LatLngLite> current();
}

class GpsPositionSource implements PositionSource {
  @override
  Future<LatLngLite> current() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw PositionException('Active la localisation (GPS) du téléphone pour recevoir des courses.');
    }
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      throw PositionException('Autorise MyWay Livreur à utiliser ta position pour recevoir des courses.');
    }
    final p = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 20)),
    );
    return LatLngLite(p.latitude, p.longitude);
  }
}

class FixedPositionSource implements PositionSource {
  FixedPositionSource(this.position);
  LatLngLite position;
  @override
  Future<LatLngLite> current() async => position;
}
