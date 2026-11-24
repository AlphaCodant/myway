import 'package:app_core/app_core.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

/// Inscription assistée : l'agent crée le compte du commerçant sur place.
/// Le commerce reste en attente jusqu'à la validation par l'équipe MyWay.
class OnboardScreen extends StatefulWidget {
  const OnboardScreen({super.key});
  @override
  State<OnboardScreen> createState() => _OnboardScreenState();
}

class _OnboardScreenState extends State<OnboardScreen> {
  final _ownerName = TextEditingController();
  final _ownerPhone = TextEditingController();
  final _shopName = TextEditingController();
  final _landmark = TextEditingController();
  final _momo = TextEditingController();
  String _category = 'ALIMENTATION';
  String? _neighborhoodId;
  List<Neighborhood> _neighborhoods = [];
  LatLngLite? _position;
  String? _shopPhoto;
  String? _idPhoto;
  bool _selfDelivery = false;
  bool _busy = false;

  ApiClient get _api => context.read<ApiClient>();

  @override
  void initState() {
    super.initState();
    _api.get('/cities/${AppConfig.citySlug}/neighborhoods', cache: true).then((rows) {
      if (mounted) setState(() => _neighborhoods = (rows as List).map((r) => Neighborhood.fromJson(r)).toList());
    }).catchError((_) {});
  }

  Future<void> _locate() async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      final pos = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high));
      setState(() => _position = LatLngLite(pos.latitude, pos.longitude));
    } catch (_) {
      if (mounted) showError(context, ApiException(0, 'Position GPS introuvable. Active la localisation et réessaie devant la boutique.'));
    }
  }

  Future<String?> _photo() async {
    final img = await ImagePicker().pickImage(source: ImageSource.camera, maxWidth: 1000, imageQuality: 60);
    if (img == null) return null;
    return _api.upload(await img.readAsBytes(), img.name);
  }

  Future<void> _submit() async {
    if (_ownerName.text.trim().isEmpty || _ownerPhone.text.trim().isEmpty || _shopName.text.trim().isEmpty || _neighborhoodId == null || _position == null) {
      showError(context, ApiException(400, 'Remplis le nom, le téléphone, le commerce, le quartier et la position GPS.'));
      return;
    }
    setState(() => _busy = true);
    try {
      await _api.post('/agent/merchants', {
        'ownerName': _ownerName.text.trim(),
        'ownerPhone': _ownerPhone.text.trim(),
        'name': _shopName.text.trim(),
        'category': _category,
        'neighborhoodId': _neighborhoodId,
        'lat': _position!.lat,
        'lng': _position!.lng,
        if (_landmark.text.trim().isNotEmpty) 'landmarkText': _landmark.text.trim(),
        if (_momo.text.trim().isNotEmpty) 'mobileMoneyNumber': _momo.text.trim(),
        'photoUrl': ?_shopPhoto,
        'idDocumentUrl': ?_idPhoto,
        'selfDelivery': _selfDelivery,
      });
      if (!mounted) return;
      showInfo(context, 'Commerce inscrit. Il sera visible après validation par MyWay.');
      Navigator.pop(context, true);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _photoButton(String label, String? url, Future<void> Function(String) onDone) => OutlinedButton.icon(
        onPressed: _busy
            ? null
            : () async {
                try {
                  final u = await _photo();
                  if (u != null) await onDone(u);
                } catch (e) {
                  if (mounted) showError(context, e);
                }
              },
        icon: Icon(url == null ? Icons.photo_camera : Icons.check_circle),
        label: Text(url == null ? label : '$label ✔'),
      );

  @override
  Widget build(BuildContext context) {
    const gap = SizedBox(height: 12);
    return Scaffold(
      appBar: AppBar(title: const Text('Inscrire un commerçant')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        const Text('Le commerçant', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        gap,
        TextField(controller: _ownerName, decoration: const InputDecoration(labelText: 'Nom et prénom')),
        gap,
        TextField(controller: _ownerPhone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Téléphone (il se connectera avec)')),
        gap,
        TextField(controller: _momo, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Numéro Mobile Money pour les reversements')),
        gap,
        _photoButton('Photo de la pièce d’identité', _idPhoto, (u) async => setState(() => _idPhoto = u)),
        const SizedBox(height: 24),
        const Text('Le commerce', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        gap,
        TextField(controller: _shopName, decoration: const InputDecoration(labelText: 'Nom du commerce')),
        gap,
        DropdownButtonFormField<String>(
          initialValue: _category,
          decoration: const InputDecoration(labelText: 'Catégorie'),
          items: [for (final e in categoryLabels.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
          onChanged: (v) => setState(() => _category = v!),
        ),
        gap,
        DropdownButtonFormField<String>(
          initialValue: _neighborhoodId,
          decoration: const InputDecoration(labelText: 'Quartier'),
          items: [for (final n in _neighborhoods) DropdownMenuItem(value: n.id, child: Text(n.name))],
          onChanged: (v) => setState(() => _neighborhoodId = v),
        ),
        gap,
        TextField(controller: _landmark, decoration: const InputDecoration(labelText: 'Repère (ex. face au grand marché)')),
        gap,
        OutlinedButton.icon(
          onPressed: _busy ? null : _locate,
          icon: Icon(_position == null ? Icons.my_location : Icons.check_circle),
          label: Text(_position == null
              ? 'Enregistrer la position (devant la boutique)'
              : 'Position : ${_position!.lat.toStringAsFixed(5)}, ${_position!.lng.toStringAsFixed(5)}'),
        ),
        gap,
        _photoButton('Photo de la boutique', _shopPhoto, (u) async => setState(() => _shopPhoto = u)),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _selfDelivery,
          onChanged: (v) => setState(() => _selfDelivery = v),
          title: const Text('Le commerçant peut livrer lui-même'),
        ),
        const SizedBox(height: 16),
        FilledButton(onPressed: _busy ? null : _submit, child: const Text('Inscrire')),
      ]),
    );
  }
}
