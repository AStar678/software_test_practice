import '../../../core/net/api_client.dart';
import '../../../core/net/version_registry.dart';
import '../../tasks/data/tasks_api.dart';
import '../domain/approval_request.dart';

class ApprovalPage {
  const ApprovalPage({required this.items, required this.total, this.nextOffset});

  final List<ApprovalRequest> items;
  final int total;
  final int? nextOffset;
}

/// 申请与审核端点：列表用 offset 分页；裁决使用申请自身 ETag，绝不套任务版本。
class ApprovalsApi {
  // ignore: prefer_initializing_formals
  ApprovalsApi({required ApiClient client}) : _client = client;

  final ApiClient _client;

  Future<ApprovalPage> list({required String mine, int limit = 20, int offset = 0}) async {
    final result = await _client.get<ApprovalPage>(
      '/approval-requests',
      query: {'mine': mine, 'limit': limit, 'offset': offset},
      decode: (json) {
        final map = asJsonMap(json);
        final items = <ApprovalRequest>[
          for (final raw in asJsonList(map['items']))
            if (raw is Map) ApprovalRequest.fromJson(Map<String, Object?>.from(raw)),
        ];
        return ApprovalPage(
          items: items,
          total: (map['total'] as num?)?.toInt() ?? items.length,
          nextOffset: (map['nextOffset'] as num?)?.toInt(),
        );
      },
    );
    return result.data;
  }

  Future<ApprovalRequest> detail(String requestId) async {
    final result = await _client.get<ApprovalRequest>(
      '/approval-requests/$requestId',
      versionKey: VersionRegistry.approvalRequest(requestId),
      decode: (json) => ApprovalRequest.fromJson(asJsonMap(json)),
    );
    return result.data;
  }

  /// 批准/拒绝/撤销。拒绝必须带意见；成功后刷新关联任务与申请。
  Future<ApprovalDecisionResult> decide({
    required String requestId,
    required String decision,
    required String idempotencyKey,
    String? comment,
  }) async {
    final result = await _client.write<ApprovalDecisionResult>(
      method: 'PATCH',
      path: '/approval-requests/$requestId',
      body: {
        'decision': decision,
        if (comment != null && comment.trim().isNotEmpty) 'comment': comment.trim(),
      },
      idempotencyKey: idempotencyKey,
      versionKey: VersionRegistry.approvalRequest(requestId),
      requireVersion: true,
      decode: (json) => ApprovalDecisionResult.fromJson(asJsonMap(json)),
    );
    return result.data;
  }
}
