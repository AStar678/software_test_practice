package cn.pandora.calendar;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Bounded HTTP adapter for the fixed annual holiday-data source.
 *
 * <p>Only the configured URL template is used; the year is substituted server-side. The adapter
 * enforces a connect timeout, a total request timeout, a response-body cap, a small retry count and
 * no automatic trust of redirects to arbitrary hosts (the HTTP client follows redirects, so the
 * final URI is checked against http/https before reading). Parsing/validation is delegated to
 * {@link HolidayPayload}, so a failed fetch or invalid payload never reaches the cache writer.</p>
 */
@Component
public class HttpHolidaySource implements HolidaySource {
    private final ObjectMapper mapper;
    private final String template;
    private final String sourceName;
    private final int maxBytes;
    private final int retries;
    private final HttpClient client;
    private final Duration requestTimeout;

    public HttpHolidaySource(
            ObjectMapper mapper,
            @Value("${pandora.holiday.source-url-template:https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/{year}.json}") String template,
            @Value("${pandora.holiday.source-name:NateScarlet/holiday-cn}") String sourceName,
            @Value("${pandora.holiday.connect-timeout-ms:3000}") long connectTimeoutMs,
            @Value("${pandora.holiday.request-timeout-ms:10000}") long requestTimeoutMs,
            @Value("${pandora.holiday.max-bytes:1048576}") int maxBytes,
            @Value("${pandora.holiday.retries:1}") int retries) {
        this.mapper = mapper;
        this.template = template;
        this.sourceName = sourceName;
        this.maxBytes = Math.max(1024, maxBytes);
        this.retries = Math.max(0, Math.min(3, retries));
        this.requestTimeout = Duration.ofMillis(Math.max(500, requestTimeoutMs));
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(Math.max(200, connectTimeoutMs)))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    @Override
    public String sourceName() {
        return sourceName;
    }

    @Override
    public HolidayPayload.Year fetch(int year) {
        URI uri = uri(year);
        HolidaySourceException last = null;
        for (int attempt = 0; attempt <= retries; attempt++) {
            try {
                return fetchOnce(uri, year);
            } catch (HolidaySourceException exception) {
                last = exception;
                // 4xx responses are definitive; repeating them only multiplies upstream requests.
                if (!retryable(exception)) break;
            }
        }
        throw last == null
                ? new HolidaySourceException("HOLIDAY_SOURCE_UNAVAILABLE", "节假日数据源不可用")
                : last;
    }

    private boolean retryable(HolidaySourceException exception) {
        return switch (exception.safeCode()) {
            case "HOLIDAY_SOURCE_TIMEOUT", "HOLIDAY_SOURCE_IO", "HOLIDAY_SOURCE_HTTP" -> true;
            default -> false;
        };
    }

    private URI uri(int year) {
        String value = template.replace("{year}", Integer.toString(year));
        URI uri;
        try {
            uri = URI.create(value);
        } catch (IllegalArgumentException exception) {
            throw new HolidaySourceException("HOLIDAY_SOURCE_CONFIGURATION", "节假日数据源地址配置无效", exception);
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if (!("http".equals(scheme) || "https".equals(scheme)) || uri.getHost() == null) {
            throw new HolidaySourceException("HOLIDAY_SOURCE_CONFIGURATION", "节假日数据源地址必须是固定 HTTP(S) 地址");
        }
        return uri;
    }

    private HolidayPayload.Year fetchOnce(URI uri, int year) {
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(requestTimeout)
                .header("Accept", "application/json")
                .header("User-Agent", "PandoraHoliday/1.0")
                .GET()
                .build();
        HttpResponse<InputStream> response;
        try {
            response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
        } catch (java.net.http.HttpTimeoutException exception) {
            throw new HolidaySourceException("HOLIDAY_SOURCE_TIMEOUT", "节假日数据源请求超时", exception);
        } catch (IOException exception) {
            throw new HolidaySourceException("HOLIDAY_SOURCE_IO", "节假日数据源连接失败", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new HolidaySourceException("HOLIDAY_SOURCE_IO", "节假日数据源请求被中断", exception);
        }
        try (InputStream stream = response.body()) {
            int status = response.statusCode();
            if (status == 404 || status == 410) {
                throw new HolidaySourceException("HOLIDAY_YEAR_NOT_PUBLISHED", "该年度节假日安排尚未公布");
            }
            if (status < 200 || status >= 300) {
                throw new HolidaySourceException("HOLIDAY_SOURCE_HTTP", "节假日数据源返回非成功状态");
            }
            byte[] body = readBounded(stream);
            return HolidayPayload.parse(body, year, mapper);
        } catch (IOException exception) {
            throw new HolidaySourceException("HOLIDAY_SOURCE_IO", "读取节假日数据源失败", exception);
        }
    }

    private byte[] readBounded(InputStream stream) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(Math.min(maxBytes, 65536));
        byte[] buffer = new byte[8192];
        int total = 0;
        int read;
        while ((read = stream.read(buffer)) != -1) {
            total += read;
            if (total > maxBytes) {
                throw new HolidaySourceException("HOLIDAY_SOURCE_TOO_LARGE", "节假日数据源响应体超出上限");
            }
            out.write(buffer, 0, read);
        }
        return out.toByteArray();
    }
}
