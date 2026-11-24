import 'package:material_ui/material_ui.dart';

import '../api/api_client.dart';
import '../l10n/fr.dart';
import '../theme.dart';

void showError(BuildContext context, Object e) {
  final msg = e is ApiException ? e.message : T.errorGeneric;
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: AppColors.danger));
}

void showInfo(BuildContext context, String msg) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.wifi_off, size: 56, color: AppColors.muted),
          const SizedBox(height: 12),
          Text(error is ApiException ? (error as ApiException).message : T.errorGeneric, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text(T.retry)),
        ]),
      ),
    );
  }
}

class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: const Color(0xFFFFF3CD),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: const Row(children: [
        Icon(Icons.cloud_off, size: 18),
        SizedBox(width: 8),
        Expanded(child: Text(T.offline, style: TextStyle(fontSize: 14))),
      ]),
    );
  }
}

/// Image réseau légère avec repli sur une icône (pas de photo, pas de réseau).
class NetImage extends StatelessWidget {
  const NetImage({super.key, required this.url, required this.icon, this.size = 64});
  final String? url;
  final IconData icon;
  final double size;

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: const Color(0xFFFCE8DA), borderRadius: BorderRadius.circular(10)),
      child: Icon(icon, color: AppColors.primary, size: size * 0.5),
    );
    if (url == null || url!.isEmpty) return placeholder;
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: Image.network(
        url!,
        width: size,
        height: size,
        fit: BoxFit.cover,
        cacheWidth: (size * 2).round(),
        errorBuilder: (_, _, _) => placeholder,
      ),
    );
  }
}

IconData categoryIcon(String category) => switch (category) {
      'ALIMENTATION' => Icons.shopping_basket,
      'RESTAURANT' => Icons.restaurant,
      'PHARMACIE' => Icons.local_pharmacy,
      'QUINCAILLERIE' => Icons.handyman,
      'MARCHE' => Icons.storefront,
      'SUPERMARCHE' => Icons.local_grocery_store,
      _ => Icons.store,
    };
