/// 会话网关：网络层只通过这里取凭证、轮换凭证与判断旧代次 401。
abstract class SessionGateway {
  /// 当前可用凭证；临近过期时由实现串行刷新。无有效会话返回 null。
  Future<String?> authorize();

  /// 发起请求时绑定的凭证代次。
  int get credentialGeneration;

  /// 返回 true 表示“可用当前新凭证重试一次”；false 表示会话已失效。
  Future<bool> handleUnauthorized(int sentGeneration);

  /// 网络层确认会话不可继续时通知会话层。
  void notifyExpired();
}
