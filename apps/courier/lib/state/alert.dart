import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/services.dart';

/// Sonnerie « nouvelle course » : elle se répète tant que le livreur n'a pas répondu à la proposition.
abstract class OfferAlert {
  Future<void> start();
  Future<void> stop();
  bool get ringing;
  void dispose();
}

class SoundOfferAlert implements OfferAlert {
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
      await _player.play(AssetSource('sounds/nouvelle_course.wav'));
    } catch (_) {
      // Pas de son possible : la proposition reste affichée en grand à l'écran.
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
class SilentOfferAlert implements OfferAlert {
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
