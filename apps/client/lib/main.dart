import 'package:flutter/foundation.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api/api_client.dart';
import 'l10n/fr.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/neighborhood_screen.dart';
import 'state/auth_state.dart';
import 'state/cart_state.dart';
import 'state/outbox.dart';
import 'state/realtime.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('fr');
  final prefs = await SharedPreferences.getInstance();
  final api = ApiClient(prefs: prefs);
  runApp(ClientApp(api: api, prefs: prefs));
}

class ClientApp extends StatelessWidget {
  const ClientApp({super.key, required this.api, required this.prefs});
  final ApiClient api;
  final SharedPreferences prefs;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider.value(value: api),
        Provider(create: (_) => Realtime(api), dispose: (_, r) => r.disconnect()),
        ChangeNotifierProvider(create: (_) => AuthState(api, prefs)),
        ChangeNotifierProvider(create: (_) => CartState(prefs)),
        ChangeNotifierProvider(create: (_) => OrderOutbox(api, prefs)),
      ],
      child: MaterialApp(
        title: T.appName,
        debugShowCheckedModeBanner: kDebugMode,
        theme: buildTheme(),
        locale: const Locale('fr'),
        home: const RootGate(),
      ),
    );
  }
}

/// Aiguillage : connexion → choix du quartier → accueil.
class RootGate extends StatelessWidget {
  const RootGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    if (!auth.isLoggedIn) return const LoginScreen();
    context.read<Realtime>().connect();
    if (auth.neighborhoodId == null) return const NeighborhoodScreen();
    return const HomeScreen();
  }
}
