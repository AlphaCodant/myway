import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../config.dart';
import '../l10n/fr.dart';
import '../state/auth_state.dart';
import '../widgets/common.dart';

class NeighborhoodScreen extends StatefulWidget {
  const NeighborhoodScreen({super.key, this.popOnSelect = false});
  final bool popOnSelect;
  @override
  State<NeighborhoodScreen> createState() => _NeighborhoodScreenState();
}

class _NeighborhoodScreenState extends State<NeighborhoodScreen> {
  late Future<List<Neighborhood>> _future = _load();

  Future<List<Neighborhood>> _load() async {
    final rows = await context.read<ApiClient>().get('/cities/${AppConfig.citySlug}/neighborhoods', cache: true) as List;
    return rows.map((r) => Neighborhood.fromJson(r)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(T.chooseNeighborhood)),
      body: FutureBuilder<List<Neighborhood>>(
        future: _future,
        builder: (context, snap) {
          if (snap.hasError) return ErrorView(error: snap.error!, onRetry: () => setState(() => _future = _load()));
          if (!snap.hasData) return const Center(child: CircularProgressIndicator());
          return ListView(
            padding: const EdgeInsets.symmetric(vertical: 12),
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Text('Gagnoa', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
              ),
              for (final n in snap.data!)
                Card(
                  child: ListTile(
                    minTileHeight: 64,
                    leading: const Icon(Icons.location_city, size: 32),
                    title: Text(n.name, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w600)),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () async {
                      await context.read<AuthState>().setNeighborhood(n);
                      if (widget.popOnSelect && context.mounted) Navigator.pop(context);
                    },
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
