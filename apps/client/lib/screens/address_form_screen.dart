import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../l10n/fr.dart';
import '../state/auth_state.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// Adresse informelle : point GPS placé sur la carte + repère texte + photo du portail.
class AddressFormScreen extends StatefulWidget {
  const AddressFormScreen({super.key});
  @override
  State<AddressFormScreen> createState() => _AddressFormScreenState();
}

class _AddressFormScreenState extends State<AddressFormScreen> {
  static const _gagnoa = LatLng(6.1319, -5.9506);
  final _map = MapController();
  final _label = TextEditingController(text: 'Maison');
  final _landmark = TextEditingController();
  LatLng? _point;
  String? _photoUrl;
  bool _busy = false;

  Future<void> _locate() async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return;
      final pos = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high));
      setState(() => _point = LatLng(pos.latitude, pos.longitude));
      _map.move(_point!, 17);
    } catch (_) {
      if (mounted) showInfo(context, 'Position introuvable : place le point à la main sur la carte.');
    }
  }

  Future<void> _pickPhoto() async {
    final img = await ImagePicker().pickImage(source: ImageSource.camera, maxWidth: 800, imageQuality: 60);
    if (img == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final url = await context.read<ApiClient>().upload(await img.readAsBytes(), img.name);
      setState(() => _photoUrl = url);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save() async {
    final auth = context.read<AuthState>();
    setState(() => _busy = true);
    try {
      final res = await context.read<ApiClient>().post('/me/addresses', {
        'label': _label.text.trim().isEmpty ? 'Maison' : _label.text.trim(),
        'neighborhoodId': auth.neighborhoodId,
        'lat': _point!.latitude,
        'lng': _point!.longitude,
        if (_landmark.text.trim().isNotEmpty) 'landmarkText': _landmark.text.trim(),
        'photoUrl': ?_photoUrl,
      });
      if (mounted) Navigator.pop(context, Address.fromJson(res));
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(T.newAddress)),
      body: ListView(children: [
        SizedBox(
          height: 300,
          child: Stack(children: [
            FlutterMap(
              mapController: _map,
              options: MapOptions(
                initialCenter: _gagnoa,
                initialZoom: 15,
                onTap: (_, p) => setState(() => _point = p),
              ),
              children: [
                TileLayer(urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', userAgentPackageName: 'ci.livraisonquartier.client'),
                if (_point != null)
                  MarkerLayer(markers: [
                    Marker(point: _point!, width: 48, height: 48, child: const Icon(Icons.home_filled, size: 44, color: AppColors.primary)),
                  ]),
              ],
            ),
            Positioned(
              right: 12,
              bottom: 12,
              child: FloatingActionButton.extended(
                heroTag: 'locate',
                onPressed: _locate,
                icon: const Icon(Icons.my_location),
                label: const Text(T.useMyPosition),
              ),
            ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(_point == null ? T.placePin : 'Point placé ✔', style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            TextField(controller: _label, decoration: const InputDecoration(labelText: T.addressLabel)),
            const SizedBox(height: 12),
            TextField(key: const Key('landmark'), controller: _landmark, maxLines: 2, decoration: const InputDecoration(labelText: T.landmark)),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _busy ? null : _pickPhoto,
              icon: Icon(_photoUrl == null ? Icons.photo_camera : Icons.check_circle),
              label: Text(_photoUrl == null ? T.gatePhoto : 'Photo ajoutée'),
            ),
            const SizedBox(height: 20),
            FilledButton(key: const Key('saveAddress'), onPressed: _point == null || _busy ? null : _save, child: const Text(T.save)),
          ]),
        ),
      ]),
    );
  }
}
