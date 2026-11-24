import 'package:app_core/app_core.dart';
import 'package:image_picker/image_picker.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../state/courier_state.dart';

const _vehicles = {'MOTO': 'Moto', 'VELO': 'Vélo', 'PIED': 'À pied'};

/// Profil et dossier du livreur : pièces à fournir pour la validation, contact d'urgence, numéro Mobile Money.
class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key});
  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  late final CourierState _state = context.read<CourierState>();
  late final _name = TextEditingController(text: _state.profile?['name'] ?? '');
  late final _emergency = TextEditingController(text: _state.profile?['emergencyContact'] ?? '');
  late final _momo = TextEditingController(text: _state.profile?['mobileMoneyNumber'] ?? '');
  late String _vehicle = _state.profile?['vehicle'] ?? 'MOTO';
  String? _uploading;
  bool _saving = false;

  Future<void> _upload(String field) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(children: [
          ListTile(leading: const Icon(Icons.photo_camera), title: const Text('Prendre une photo'), onTap: () => Navigator.pop(ctx, ImageSource.camera)),
          ListTile(leading: const Icon(Icons.photo_library), title: const Text('Choisir dans la galerie'), onTap: () => Navigator.pop(ctx, ImageSource.gallery)),
        ]),
      ),
    );
    if (source == null) return;
    final img = await ImagePicker().pickImage(source: source, maxWidth: 1200, imageQuality: 65);
    if (img == null) return;
    setState(() => _uploading = field);
    try {
      final url = await _state.api.upload(await img.readAsBytes(), img.name);
      await _state.updateProfile({field: url});
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _uploading = null);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await _state.updateProfile({
        if (_name.text.trim().isNotEmpty) 'name': _name.text.trim(),
        'vehicle': _vehicle,
        'emergencyContact': _emergency.text.trim(),
        'mobileMoneyNumber': _momo.text.trim(),
      });
      if (mounted) showInfo(context, 'Profil enregistré');
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<CourierState>().profile ?? {};
    final docs = <(String, String, bool)>[
      ('idDocumentUrl', 'Pièce d’identité (CNI ou passeport)', true),
      ('photoUrl', 'Photo de toi', true),
      ('licenseUrl', 'Permis de conduire', _vehicle == 'MOTO'),
      ('registrationUrl', 'Carte grise de la moto', _vehicle == 'MOTO'),
    ];
    return ListView(padding: const EdgeInsets.all(16), children: [
      Row(children: [
        NetImage(url: _state.api.fileUrl(p['photoUrl']), icon: Icons.person, size: 64),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(p['phone'] ?? '', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            Text(p['status'] == 'ACTIVE' ? 'Compte validé ✔' : 'En attente de validation',
                style: TextStyle(color: p['status'] == 'ACTIVE' ? AppColors.secondary : AppColors.primary, fontWeight: FontWeight.w700)),
          ]),
        ),
      ]),
      const SizedBox(height: 16),
      TextField(controller: _name, decoration: const InputDecoration(labelText: 'Nom et prénom')),
      const SizedBox(height: 12),
      const Text('Je livre…', style: TextStyle(fontWeight: FontWeight.w700)),
      const SizedBox(height: 6),
      SegmentedButton<String>(
        segments: [for (final e in _vehicles.entries) ButtonSegment(value: e.key, label: Text(e.value))],
        selected: {_vehicle},
        onSelectionChanged: (s) => setState(() => _vehicle = s.first),
      ),
      const SizedBox(height: 12),
      TextField(controller: _emergency, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Contact d’urgence (nom et numéro)')),
      const SizedBox(height: 12),
      TextField(controller: _momo, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Numéro Mobile Money pour mes gains')),
      const SizedBox(height: 12),
      FilledButton(onPressed: _saving ? null : _save, child: const Text('Enregistrer')),
      const SizedBox(height: 20),
      const Text('Mes pièces', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
      for (final (field, label, needed) in docs)
        if (needed)
          Card(
            child: ListTile(
              leading: Icon(
                (p[field] ?? '').toString().isNotEmpty ? Icons.check_circle : Icons.radio_button_unchecked,
                color: (p[field] ?? '').toString().isNotEmpty ? AppColors.secondary : AppColors.muted,
              ),
              title: Text(label),
              trailing: _uploading == field
                  ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 3))
                  : TextButton(
                      onPressed: _uploading == null ? () => _upload(field) : null,
                      child: Text((p[field] ?? '').toString().isNotEmpty ? 'Changer' : 'Envoyer'),
                    ),
            ),
          ),
    ]);
  }
}
