package cn.pandora.mobile;

import static cn.pandora.mobile.Json.*;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.*;

/** Native JSON client. No browser, HTML, JavaScript, cookie or website session is involved. */
final class ApiClient {
  volatile String token = "";
  volatile int epoch;
  private final String origin;
  private final Map<String, String[]> retries = new HashMap<>();

  ApiClient(String base) {
    URI u = URI.create(WebUrlPolicy.normalize(base, BuildConfig.ALLOW_HTTP));
    origin = u.getScheme() + "://" + u.getRawAuthority() + "/api/v1";
  }

  static String q(String value) {
    try {
      return URLEncoder.encode(value, "UTF-8");
    } catch (UnsupportedEncodingException impossible) {
      throw new AssertionError(impossible);
    }
  }

  static final class Failure extends IOException {
    final int status;
    final String code;
    final JSONObject data;

    Failure(int status, JSONObject data) {
      super(
          status == 412
              ? "这条记录已被更新，请返回后重新打开。"
              : s(data, "message").isEmpty() ? "请求失败（" + status + "）" : s(data, "message"));
      this.status = status;
      this.code = s(data, "code");
      this.data = data;
    }
  }

  JSONObject get(String path) throws Exception {
    return request("GET", path, null, null, null);
  }

  JSONObject post(String path, JSONObject data) throws Exception {
    return request("POST", path, data, null, null);
  }

  JSONObject mutate(String slot, String method, String path, JSONObject data, String etag)
      throws Exception {
    String signature = method + path + String.valueOf(data) + etag;
    String[] old = retries.get(slot);
    if (old == null || !old[0].equals(signature)) {
      old = new String[] {signature, UUID.randomUUID().toString()};
      retries.put(slot, old);
    }
    return request(method, path, data, etag, old[1]);
  }

  JSONObject request(String method, String path, JSONObject data, String etag, String key)
      throws Exception {
    int session = epoch;
    HttpURLConnection c = (HttpURLConnection) new URL(origin + path).openConnection();
    c.setConnectTimeout(20000);
    c.setReadTimeout(20000);
    c.setInstanceFollowRedirects(false);
    c.setUseCaches(false);
    c.setRequestMethod(method);
    c.setRequestProperty("Accept", "application/json");
    if (!token.isEmpty()) c.setRequestProperty("Authorization", "Bearer " + token);
    if (etag != null) c.setRequestProperty("If-Match", etag);
    if (key != null) c.setRequestProperty("Idempotency-Key", key);
    try {
      if (data != null) {
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        byte[] bytes = data.toString().getBytes(StandardCharsets.UTF_8);
        c.setFixedLengthStreamingMode(bytes.length);
        try (OutputStream out = c.getOutputStream()) {
          out.write(bytes);
        }
      }
      int status = c.getResponseCode();
      String text = "";
      InputStream stream = status >= 400 ? c.getErrorStream() : c.getInputStream();
      if (stream != null)
        try (InputStream in = stream;
            ByteArrayOutputStream out = new ByteArrayOutputStream()) {
          byte[] b = new byte[8192];
          int n;
          while ((n = in.read(b)) != -1) {
            out.write(b, 0, n);
            if (out.size() > 16 * 1024 * 1024) throw new IOException("服务器响应过大");
          }
          text = out.toString(StandardCharsets.UTF_8.name());
        }
      if (session != epoch) throw new IOException("账号已切换，请重新操作。");
      JSONObject result;
      try {
        result = text.isBlank() ? new JSONObject() : new JSONObject(text);
      } catch (JSONException invalid) {
        throw new IOException("服务器返回了无法识别的数据（" + status + "）");
      }
      if (status < 200 || status >= 300) throw new Failure(status, result);
      String responseTag = c.getHeaderField("ETag");
      if (responseTag != null) result.put("__etag", responseTag);
      return result;
    } catch (SocketTimeoutException e) {
      throw new IOException("连接超时，请重试；相同操作将使用同一个提交编号。", e);
    } finally {
      c.disconnect();
    }
  }

  JSONArray all(String path) throws Exception {
    JSONArray out = new JSONArray();
    int offset = 0;
    for (; ; ) {
      JSONObject page = get(path + (path.contains("?") ? "&" : "?") + "limit=100&offset=" + offset);
      for (JSONObject row : rows(arr(page, "items"))) out.put(row);
      Object next = page.opt("nextOffset");
      if (next == null || next == JSONObject.NULL) next = page.opt("nextCursor");
      if (next == null || next == JSONObject.NULL) return out;
      int value = Integer.parseInt(next.toString());
      if (value <= offset) throw new IOException("分页数据异常，请重试。");
      offset = value;
    }
  }

  void clear() {
    epoch++;
    token = "";
    retries.clear();
  }
}
