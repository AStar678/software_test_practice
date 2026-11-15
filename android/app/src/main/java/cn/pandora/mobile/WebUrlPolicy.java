package cn.pandora.mobile;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Validates configured web addresses without decoding or re-encoding signed URL components. */
public final class WebUrlPolicy {
  private static final Pattern SCHEME = Pattern.compile("^([A-Za-z][A-Za-z0-9+.-]*):");

  private WebUrlPolicy() {}

  /**
   * Returns an absolute web URL with a lower-case scheme and host. A bare hostname defaults to
   * HTTPS. HTTP must be explicitly enabled by the caller; credentials in an address are forbidden.
   */
  public static String normalize(String input, boolean allowHttp) {
    URI uri = parse(input, allowHttp, true);
    String host = uri.getHost();
    String portSuffix = uri.getRawAuthority().substring(host.length());
    StringBuilder result =
        new StringBuilder()
            .append(uri.getScheme().toLowerCase(Locale.ROOT))
            .append("://")
            .append(host.toLowerCase(Locale.ROOT))
            .append(portSuffix);
    // The multi-argument URI constructors quote '%' again. Copy raw components instead, so
    // signatures, escaped slashes, query ordering, '+' and empty query/fragment markers survive.
    result.append(uri.getRawPath());
    if (uri.getRawQuery() != null) result.append('?').append(uri.getRawQuery());
    if (uri.getRawFragment() != null) result.append('#').append(uri.getRawFragment());
    return result.toString();
  }

  /**
   * Invalid or relative addresses never share an origin. Paths, queries and fragments do not count.
   */
  public static boolean sameOrigin(String a, String b) {
    try {
      URI first = parse(a, true, false);
      URI second = parse(b, true, false);
      return first.getScheme().equalsIgnoreCase(second.getScheme())
          && first.getHost().equalsIgnoreCase(second.getHost())
          && effectivePort(first) == effectivePort(second);
    } catch (IllegalArgumentException ignored) {
      return false;
    }
  }

  /** Recognizes valid absolute HTTP and HTTPS addresses, without allowing bare hostnames. */
  public static boolean isWebUrl(String url) {
    try {
      parse(url, true, false);
      return true;
    } catch (IllegalArgumentException ignored) {
      return false;
    }
  }

  private static URI parse(String input, boolean allowHttp, boolean allowBareHost) {
    if (input == null) throw invalid("请输入网页地址");
    // Check before trimming: browsers may silently remove tabs/newlines inside an authority.
    for (int i = 0; i < input.length(); i++) {
      if (Character.isISOControl(input.charAt(i))) throw invalid("地址不能包含控制字符");
    }
    String value = input.trim();
    if (value.isEmpty()) throw invalid("请输入网页地址");
    // Browsers treat a backslash as a slash for HTTP(S), while java.net.URI does not.
    if (value.indexOf('\\') >= 0) throw invalid("地址不能包含反斜线");
    if (value.startsWith("//")) throw invalid("请填写完整地址或域名");

    Matcher scheme = SCHEME.matcher(value);
    if (scheme.find()) {
      String name = scheme.group(1);
      if (!name.equalsIgnoreCase("https") && !name.equalsIgnoreCase("http")) {
        if (allowBareHost && bareHostWithPort(value, name)) {
          value = "https://" + value;
        } else {
          throw invalid("仅支持 HTTP 或 HTTPS 地址");
        }
      }
    } else if (allowBareHost) {
      value = "https://" + value;
    } else {
      throw invalid("请输入完整的 HTTP 或 HTTPS 地址");
    }

    final URI uri;
    try {
      uri = new URI(value).parseServerAuthority();
    } catch (URISyntaxException exception) {
      throw invalid("网页地址格式不正确");
    }
    String protocol = uri.getScheme();
    if (!"https".equalsIgnoreCase(protocol) && !"http".equalsIgnoreCase(protocol)) {
      throw invalid("仅支持 HTTP 或 HTTPS 地址");
    }
    if ("http".equalsIgnoreCase(protocol) && !allowHttp) {
      throw invalid("请使用 HTTPS 地址，或先允许 HTTP");
    }
    if (uri.isOpaque() || uri.getRawAuthority() == null || uri.getHost() == null) {
      throw invalid("地址必须包含有效主机名");
    }
    if (uri.getRawUserInfo() != null) throw invalid("地址不能包含用户名或密码");

    String host = uri.getHost();
    String authority = uri.getRawAuthority();
    // Percent-escaped hosts and scoped IPv6 addresses have inconsistent browser handling.
    if (host.isEmpty() || host.indexOf('%') >= 0 || !authority.startsWith(host)) {
      throw invalid("主机名格式不正确");
    }
    String portSuffix = authority.substring(host.length());
    if (!portSuffix.isEmpty()) {
      if (!portSuffix.matches(":[0-9]+") || uri.getPort() < 1 || uri.getPort() > 65535) {
        throw invalid("端口必须为 1 至 65535");
      }
    }
    return uri;
  }

  private static boolean bareHostWithPort(String value, String possibleHost) {
    // A dotted domain or localhost followed by a numeric port is an unambiguous configuration
    // shortcut. Other scheme-like inputs (including file:123 and javascript:123) stay forbidden.
    if (!possibleHost.contains(".") && !possibleHost.equalsIgnoreCase("localhost")) return false;
    int start = possibleHost.length() + 1;
    int end = start;
    while (end < value.length() && value.charAt(end) >= '0' && value.charAt(end) <= '9') end++;
    return end > start
        && (end == value.length()
            || value.charAt(end) == '/'
            || value.charAt(end) == '?'
            || value.charAt(end) == '#');
  }

  private static int effectivePort(URI uri) {
    return uri.getPort() >= 0
        ? uri.getPort()
        : "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
  }

  private static IllegalArgumentException invalid(String message) {
    return new IllegalArgumentException(message);
  }
}
