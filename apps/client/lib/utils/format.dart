import 'package:intl/intl.dart';

final _fcfa = NumberFormat.decimalPattern('fr');

String fcfa(num amount) => '${_fcfa.format(amount).replaceAll(' ', ' ').replaceAll(' ', ' ')} F';

String distance(int? meters) {
  if (meters == null) return '';
  if (meters < 1000) return '$meters m';
  return '${(meters / 1000).toStringAsFixed(1).replaceAll('.', ',')} km';
}
