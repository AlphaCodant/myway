import 'package:app_core/app_core.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../state/session.dart';
import 'catalog_screen.dart';
import 'onboard_screen.dart';

/// Mode agent terrain : inscrire des commerçants et remplir leur catalogue.
class AgentHome extends StatefulWidget {
  const AgentHome({super.key});
  @override
  State<AgentHome> createState() => _AgentHomeState();
}

class _AgentHomeState extends State<AgentHome> {
  late Future<List<Shop>> _future = _load();

  Future<List<Shop>> _load() async {
    final rows = await context.read<ApiClient>().get('/agent/shops', cache: true) as List;
    return rows.map((r) => Shop.fromJson(r)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Agent terrain'),
        actions: [IconButton(tooltip: CoreText.logout, onPressed: () => context.read<Session>().logout(), icon: const Icon(Icons.logout))],
      ),
      body: FutureBuilder<List<Shop>>(
        future: _future,
        builder: (context, snap) {
          if (snap.hasError) return ErrorView(error: snap.error!, onRetry: () => setState(() => _future = _load()));
          if (!snap.hasData) return const Center(child: CircularProgressIndicator());
          final shops = snap.data!;
          return ListView(padding: const EdgeInsets.only(bottom: 96), children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text('Commerces que tu as inscrits', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            ),
            if (shops.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text('Aucun pour le moment.')),
            for (final s in shops)
              Card(
                child: ListTile(
                  leading: Icon(categoryIcon(s.category), size: 32),
                  title: Text(s.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text(categoryLabels[s.category] ?? ''),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => CatalogScreen(shopId: s.id, title: 'Catalogue · ${s.name}')),
                  ),
                ),
              ),
          ]);
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        key: const Key('onboard'),
        onPressed: () async {
          final created = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => const OnboardScreen()));
          if (created == true) setState(() => _future = _load());
        },
        icon: const Icon(Icons.add_business),
        label: const Text('Inscrire un commerçant'),
      ),
    );
  }
}
