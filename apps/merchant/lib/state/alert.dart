import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/services.dart';

/// Alerte « nouvelle commande ». Le son se répète tant que le commerçant n'a pas réagi.
abstract class OrderAlert {
  Future<void> start();
  Future<void> stop();
  bool get ringing;
  void dispose();
}

class SoundOrderAlert implements OrderAlert {
  final _player = AudioPlayer();
  bool _ringing = false;

  @override
  bool get ringing => _ringing;

  @override
  Future<void> start() async {
    if (_ringing) return;
    _ringing = true;
    HapticFeedback.heavyImpact();
    try {
      await _player.setReleaseMode(ReleaseMode.loop);
      await _player.setVolume(1);
      await _player.play(AssetSource('sounds/nouvelle_commande.wav'));
    } catch (_) {
      // Pas de son possible (navigateur sans interaction, haut-parleur indisponible) : l'écran reste en alerte.
    }
  }

  @override
  Future<void> stop() async {
    _ringing = false;
    try {
      await _player.stop();
    } catch (_) {}
  }

  @override
  void dispose() => _player.dispose();
}

/// Alerte silencieuse pour les tests.
class SilentOrderAlert implements OrderAlert {
  bool _ringing = false;
  int starts = 0;
  @override
  bool get ringing => _ringing;
  @override
  Future<void> start() async {
    _ringing = true;
    starts++;
  }

  @override
  Future<void> stop() async => _ringing = false;
  @override
  void dispose() {}
}
