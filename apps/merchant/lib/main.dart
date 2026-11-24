import 'package:app_core/app_core.dart';
import 'package:flutter/foundation.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'screens/agent_home.dart';
import 'screens/merchant_home.dart';
import 'state/alert.dart';
import 'state/orders_state.dart';
import 'state/session.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('fr');
  final prefs = await SharedPreferences.getInstance();
  runApp(MerchantApp(api: ApiClient(prefs: prefs), prefs: prefs));
}

class MerchantApp extends StatelessWidget {
  const MerchantApp({super.key, required this.api, required this.prefs, this.alert});
  final ApiClient api;
  final SharedPreferences prefs;
  final OrderAlert? alert;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider.value(value: api),
        Provider(
          create: (_) => Realtime(api, events: const ['order.new', 'order.updated', 'order.reminder']),
          dispose: (_, r) => r.disconnect(),
        ),
        Provider<OrderAlert>(create: (_) => alert ?? SoundOrderAlert(), dispose: (_, a) => a.dispose()),
        ChangeNotifierProvider(create: (_) => Session(api, prefs)),
      ],
      child: MaterialApp(
        title: 'MyWay Commerçant',
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
        title: 'MyWay Commerçant',
        subtitle: 'Reçois les commandes de ton quartier',
        icon: Icons.storefront,
        requestCode: session.requestCode,
        verify: session.verify,
      );
    }
    if (session.role == 'AGENT') return const AgentHome();
    if (session.role != 'MERCHANT') return const _WrongAccount();
    return ChangeNotifierProvider(
      create: (ctx) => OrdersState(ctx.read<ApiClient>(), ctx.read<Realtime>(), ctx.read<OrderAlert>())..start(),
      child: const MerchantHome(),
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
              const Icon(Icons.storefront, size: 64, color: AppColors.muted),
              const SizedBox(height: 12),
              const Text(
                'Ce numéro n’est pas encore enregistré comme commerçant. Un agent terrain MyWay crée ton compte avec toi : contacte le support.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              OutlinedButton(onPressed: () => context.read<Session>().logout(), child: const Text(CoreText.logout)),
            ]),
          ),
        ),
      );
}
