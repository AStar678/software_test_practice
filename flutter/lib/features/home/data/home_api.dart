import '../../../core/company/workspace_clock.dart';
import '../../../core/net/api_client.dart';
import '../domain/home_data.dart';

class HomeApi {
  HomeApi({required ApiClient client, required WorkspaceClock clock})
      // ignore: prefer_initializing_formals
      : _client = client,
        // ignore: prefer_initializing_formals
        _clock = clock;

  final ApiClient _client;
  final WorkspaceClock _clock;

  Future<HomeData> load() async {
    final result = await _client.get<HomeData>(
      '/home',
      decode: (json) {
        final map = asJsonMap(json);
        _clock.updateBusinessDate(map['businessDate']?.toString());
        return HomeData.fromJson(map);
      },
    );
    return result.data;
  }
}
