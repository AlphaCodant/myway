import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'config.dart';
import 'strings.dart';

class ApiException implements Exception {
  final int status;
  final String message;
  ApiException(this.status, this.message);
  bool get isNetwork => status == 0;
  @override
  String toString() => message;
}

/// Client HTTP de l'API, avec cache local des lectures pour le mode hors ligne partiel.
class ApiClient {
  ApiClient({http.Client? httpClient, SharedPreferences? prefs, String? baseUrl})
      : _http = httpClient ?? http.Client(),
        _prefs = prefs, // ignore: prefer_initializing_formals
        baseUrl = baseUrl ?? AppConfig.apiUrl;

  final http.Client _http;
  final SharedPreferences? _prefs;
  final String baseUrl;
  String? token;

  /// Vrai si la dernière lecture a été servie depuis le cache faute de réseau.
  bool servedFromCache = false;

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final params = <String, String>{
      for (final e in (query ?? const <String, dynamic>{}).entries)
        if (e.value != null) e.key: '${e.value}',
    };
    return Uri.parse('$baseUrl/api$path').replace(queryParameters: params.isEmpty ? null : params);
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  String fileUrl(String? path) => path == null ? '' : (path.startsWith('http') ? path : '$baseUrl$path');

  Future<dynamic> get(String path, {Map<String, dynamic>? query, bool cache = false}) async {
    final uri = _uri(path, query);
    final key = 'cache:${uri.toString()}';
    try {
      final http.Response res;
      try {
        res = await _http.get(uri, headers: _headers).timeout(const Duration(seconds: 15));
      } catch (_) {
        throw ApiException(0, CoreText.networkError);
      }
      final body = _decode(res);
      servedFromCache = false;
      if (cache) await _prefs?.setString(key, res.body);
      return body;
    } on ApiException catch (e) {
      if (e.isNetwork && cache && _prefs?.getString(key) != null) {
        servedFromCache = true;
        return jsonDecode(_prefs!.getString(key)!);
      }
      rethrow;
    }
  }

  Future<dynamic> post(String path, [Map<String, dynamic>? body]) => _send('POST', path, body);
  Future<dynamic> patch(String path, [Map<String, dynamic>? body]) => _send('PATCH', path, body);
  Future<dynamic> delete(String path) => _send('DELETE', path, null);

  Future<dynamic> _send(String method, String path, Map<String, dynamic>? body) async {
    final req = http.Request(method, _uri(path))
      ..headers.addAll(_headers)
      ..body = jsonEncode(body ?? {});
    try {
      final streamed = await _http.send(req).timeout(const Duration(seconds: 20));
      return _decode(await http.Response.fromStream(streamed));
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException(0, CoreText.networkError);
    }
  }

  /// Envoi d'un fichier (photo du portail, note vocale…). Renvoie l'URL relative.
  Future<String> upload(List<int> bytes, String filename) async {
    final req = http.MultipartRequest('POST', _uri('/uploads'))
      ..headers.addAll({if (token != null) 'Authorization': 'Bearer $token'})
      ..files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename));
    try {
      final res = await http.Response.fromStream(await _http.send(req).timeout(const Duration(seconds: 60)));
      return _decode(res)['url'] as String;
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException(0, CoreText.networkError);
    }
  }

  dynamic _decode(http.Response res) {
    final text = utf8.decode(res.bodyBytes);
    final data = text.isEmpty ? null : jsonDecode(text);
    if (res.statusCode >= 200 && res.statusCode < 300) return data;
    var message = CoreText.errorGeneric;
    if (data is Map && data['message'] != null) {
      final m = data['message'];
      message = m is List ? m.join('\n') : '$m';
    }
    throw ApiException(res.statusCode, message);
  }
}
