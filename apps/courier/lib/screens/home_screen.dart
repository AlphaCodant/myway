import 'package:app_core/app_core.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../state/courier_state.dart';
import '../state/position.dart';
import '../state/session.dart';
import 'jobs_tab.dart';
import 'offer_panel.dart';
import 'profile_tab.dart';
import 'wallet_tab.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;
  int _walletVersion = 0;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<CourierState>();
    if (state.profile == null) {
      return Scaffold(
        body: state.error != null
            ? ErrorView(error: state.error!, onRetry: state.loadProfile)
            : const Center(child: CircularProgressIndicator()),
      );
    }
    final name = state.profile!['name'] as String?;
    return Scaffold(
      appBar: AppBar(
        title: Text(name == null || name.isEmpty ? 'MyWay Livreur' : name),
        actions: [
          PopupMenuButton<String>(
            onSelected: (v) => v == 'logout' ? context.read<Session>().logout() : null,
            itemBuilder: (_) => [const PopupMenuItem(value: 'logout', child: Text(CoreText.logout))],
          ),
        ],
        bottom: PreferredSize(preferredSize: const Size.fromHeight(64), child: OnlineSwitch(state: state)),
      ),
      body: Column(children: [
        if (state.positionError != null) _PositionWarning(message: state.positionError!),
        Expanded(
          // Une proposition de course passe devant tout le reste, quel que soit l'onglet.
          child: state.offers.isNotEmpty
              ? OfferPanel(offer: state.offers.first)
              : IndexedStack(index: _tab, children: [
                  JobsTab(onOpenProfile: () => setState(() => _tab = 2)),
                  WalletTab(key: ValueKey(_walletVersion)),
                  const ProfileTab(),
                ]),
        ),
      ]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() {
          _tab = i;
          if (i == 1) {
            _walletVersion++;
            state.refreshWallet();
          }
        }),
        destinations: [
          NavigationDestination(
            icon: Badge(isLabelVisible: state.jobs.isNotEmpty, label: Text('${state.jobs.length}'), child: const Icon(Icons.route)),
            label: 'Courses',
          ),
          const NavigationDestination(icon: Icon(Icons.account_balance_wallet), label: 'Gains'),
          const NavigationDestination(icon: Icon(Icons.badge), label: 'Profil'),
        ],
      ),
    );
  }
}

/// Gros interrupteur « en service / hors service », visible en permanence.
class OnlineSwitch extends StatelessWidget {
  const OnlineSwitch({super.key, required this.state});
  final CourierState state;

  @override
  Widget build(BuildContext context) {
    final on = state.online;
    final String label;
    if (!state.validated) {
      label = 'Compte en attente de validation';
    } else if (state.blocked) {
      label = 'Bloqué : reverse tes espèces';
    } else if (on) {
      label = state.busy ? 'EN SERVICE : course en cours' : 'EN SERVICE : tu reçois des courses';
    } else {
      label = 'HORS SERVICE';
    }
    return Container(
      color: !state.validated || state.blocked
          ? const Color(0xFF6D4C41)
          : on
              ? AppColors.secondary
              : const Color(0xFF424242),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(children: [
        Icon(on ? Icons.delivery_dining : Icons.bedtime, color: Colors.white),
        const SizedBox(width: 10),
        Expanded(
          child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
        ),
        Transform.scale(
          scale: 1.3,
          child: Switch(
            key: const Key('onlineSwitch'),
            value: on,
            activeThumbColor: Colors.white,
            onChanged: !state.validated
                ? null
                : (v) async {
                    try {
                      await state.setOnline(v);
                    } on PositionException catch (e) {
                      if (context.mounted) showInfo(context, e.message);
                    } catch (e) {
                      if (context.mounted) showError(context, e);
                    }
                  },
          ),
        ),
      ]),
    );
  }
}

class _PositionWarning extends StatelessWidget {
  const _PositionWarning({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        color: const Color(0xFFFFF3CD),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(children: [
          const Icon(Icons.location_off),
          const SizedBox(width: 8),
          Expanded(child: Text(message)),
        ]),
      );
}
