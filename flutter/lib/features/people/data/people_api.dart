import '../../../core/net/api_client.dart';
import '../domain/report_person.dart';

class PeopleApi {
  const PeopleApi({required this.client});

  final ApiClient client;

  Future<List<ReportPerson>> reports() async {
    final result = await client.get<List<ReportPerson>>(
      '/me/reports',
      decode: (json) {
        final map = asJsonMap(json);
        return [
          for (final value in asJsonList(map['items']))
            if (value is Map)
              ReportPerson.fromJson(Map<String, Object?>.from(value)),
        ];
      },
    );
    return result.data;
  }
}
