import 'package:material_ui/material_ui.dart';

/// Couleurs à fort contraste, lisibles en plein soleil ; gros boutons.
class AppColors {
  static const primary = Color(0xFFE85D04); // orange
  static const secondary = Color(0xFF007A3D); // vert
  static const ink = Color(0xFF1B1B1B);
  static const surface = Color(0xFFFFFFFF);
  static const muted = Color(0xFF5C5C5C);
  static const danger = Color(0xFFB00020);
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.primary,
    primary: AppColors.primary,
    secondary: AppColors.secondary,
    surface: AppColors.surface,
    error: AppColors.danger,
  );
  return ThemeData(
    colorScheme: scheme,
    scaffoldBackgroundColor: const Color(0xFFF6F4F1),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.primary,
      foregroundColor: Colors.white,
      centerTitle: false,
      titleTextStyle: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Colors.white),
    ),
    textTheme: const TextTheme(
      bodyMedium: TextStyle(fontSize: 16, color: AppColors.ink),
      bodyLarge: TextStyle(fontSize: 17, color: AppColors.ink),
      titleMedium: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.ink),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(56),
        textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
        side: const BorderSide(color: AppColors.primary, width: 2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: Color(0xFFE5E1DC))),
    ),
  );
}
