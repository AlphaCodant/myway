import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../l10n/fr.dart';
import '../theme.dart';
import '../utils/format.dart';
import '../widgets/common.dart';
import 'order_tracking_screen.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  late Future<List<Order>> _future = _load();
  final _date = DateFormat('d MMM, HH:mm', 'fr');

  Future<List<Order>> _load() async {
    final rows = await context.read<ApiClient>().get('/orders/mine', cache: true) as List;
    return rows.map((r) => Order.fromJson(r)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(T.myOrders)),
      body: FutureBuilder<List<Order>>(
        future: _future,
        builder: (context, snap) {
          if (snap.hasError) return ErrorView(error: snap.error!, onRetry: () => setState(() => _future = _load()));
          if (!snap.hasData) return const Center(child: CircularProgressIndicator());
          if (snap.data!.isEmpty) return const Center(child: Text(T.noOrders));
          return ListView(children: [
            for (final o in snap.data!)
              Card(
                child: ListTile(
                  title: Text(o.shopName ?? o.reference, style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text('${_date.format(o.createdAt.toLocal())} · ${statusLabels[o.status]}'),
                  trailing: Text(fcfa(o.total), style: TextStyle(fontWeight: FontWeight.w800, color: o.isActive ? AppColors.primary : AppColors.ink)),
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => OrderTrackingScreen(orderId: o.id))),
                ),
              ),
          ]);
        },
      ),
    );
  }
}
