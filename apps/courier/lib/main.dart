import 'package:app_core/app_core.dart';
import 'package:flutter/foundation.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'screens/home_screen.dart';
import 'state/alert.dart';
import 'state/courier_state.dart';
import 'state/position.dart';
import 'state/session.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('fr');
  final prefs = await SharedPreferences.getInstance();
  runApp(CourierApp(api: ApiClient(prefs: prefs), prefs: prefs));
}

class CourierApp extends StatelessWidget {
  const CourierApp({super.key, required this.api, required this.prefs, this.alert, this.positions, this.showMaps = true});
  final ApiClient api;
  final SharedPreferences prefs;
  final OfferAlert? alert;
  final PositionSource? positions;
  final bool showMaps;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider.value(value: api),
        Provider(
          create: (_) => Realtime(api, events: const ['offer.new', 'offer.cancelled', 'order.updated', 'order.assigned', 'order.unassigned']),
          dispose: (_, r) => r.disconnect(),
        ),
        Provider<OfferAlert>(create: (_) => alert ?? SoundOfferAlert(), dispose: (_, a) => a.dispose()),
        Provider<PositionSource>.value(value: positions ?? GpsPositionSource()),
        Provider<bool>.value(value: showMaps),
        ChangeNotifierProvider(create: (_) => Session(api, prefs)),
      ],
      child: MaterialApp(
        title: 'MyWay Livreur',
        debugShowCheckedModeBanner: kDebugMode,
        theme: buildTheme(),
        locale: const Locale('fr'),
        home: const RootGate(),
      ),
    );
  }
}

class RootGate extends StatelessWidget {
  const RootGate({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    if (!session.isLoggedIn) {
      return PhoneLoginScreen(
        title: 'MyWay Livreur',
        subtitle: 'Livre dans ton quartier et gagne de l’argent',
        icon: Icons.delivery_dining,
        requestCode: session.requestCode,
        verify: session.verify,
      );
    }
    if (session.role != 'COURIER') return const _WrongAccount();
    return ChangeNotifierProvider(
      create: (ctx) => CourierState(
        ctx.read<ApiClient>(),
        ctx.read<Realtime>(),
        ctx.read<OfferAlert>(),
        ctx.read<PositionSource>(),
        showMaps: ctx.read<bool>(),
      )..start(),
      child: const HomeScreen(),
    );
  }
}

class _WrongAccount extends StatelessWidget {
  const _WrongAccount();
  @override
  Widget build(BuildContext context) => Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.delivery_dining, size: 64, color: AppColors.muted),
              const SizedBox(height: 12),
              const Text(
                'Ce numéro est déjà utilisé par un compte client ou commerçant. Utilise un autre numéro pour devenir livreur, ou contacte le support.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              OutlinedButton(onPressed: () => context.read<Session>().logout(), child: const Text(CoreText.logout)),
            ]),
          ),
        ),
      );
}
