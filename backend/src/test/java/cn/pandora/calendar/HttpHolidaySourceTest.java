package cn.pandora.calendar;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class HttpHolidaySourceTest {
    private HttpServer server;
    private int port;
    private final AtomicInteger requests = new AtomicInteger();
    private volatile int status = 200;
    private volatile String body = "";
    private volatile long delayMs = 0;

    @BeforeEach void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        port = server.getAddress().getPort();
        server.createContext("/", exchange -> {
            requests.incrementAndGet();
            if (delayMs > 0) {
                try { Thread.sleep(delayMs); } catch (InterruptedException exception) { Thread.currentThread().interrupt(); }
            }
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            try (var out = exchange.getResponseBody()) { out.write(bytes); }
        });
        server.start();
    }

    @AfterEach void stop() {
        if (server != null) server.stop(0);
    }

    private void respond(int status, String body) {
        this.status = status;
        this.body = body;
    }

    private HttpHolidaySource source(int maxBytes, int timeoutMs, int retries) {
        return new HttpHolidaySource(new ObjectMapper(), "http://127.0.0.1:" + port + "/{year}.json",
                "test-source", 500, timeoutMs, maxBytes, retries);
    }

    private static String payload(int year) {
        return "{\"year\":" + year + ",\"papers\":[\"https://www.gov.cn/notice\"],\"days\":["
                + "{\"name\":\"元旦\",\"date\":\"" + year + "-01-01\",\"isOffDay\":true},"
                + "{\"name\":\"元旦\",\"date\":\"" + year + "-01-04\",\"isOffDay\":false}]}";
    }

    @Test void fetchesAndValidatesTheFixedYearFile() {
        respond(200, payload(2026));
        var year = source(8192, 2000, 1).fetch(2026);
        assertEquals(2026, year.year());
        assertEquals(2, year.days().size());
        assertEquals("test-source", source(8192, 2000, 1).sourceName());
        assertEquals(1, requests.get());
    }

    @Test void mapsMissingYearAndInvalidPayloadToSafeCodes() {
        respond(404, "{}");
        assertEquals("HOLIDAY_YEAR_NOT_PUBLISHED",
                assertThrows(HolidaySourceException.class, () -> source(8192, 2000, 0).fetch(2099)).safeCode());
        respond(200, "{\"year\":2026,\"papers\":[\"https://www.gov.cn/notice\"],\"days\":[{\"name\":\"x\",\"date\":\"2025-01-01\",\"isOffDay\":true}]}");
        assertEquals("HOLIDAY_DATE_OUT_OF_YEAR",
                assertThrows(HolidaySourceException.class, () -> source(8192, 2000, 0).fetch(2026)).safeCode());
    }

    @Test void boundsTheResponseBody() {
        respond(200, "{\"padding\":\"" + "a".repeat(3000) + "\"}");
        assertEquals("HOLIDAY_SOURCE_TOO_LARGE",
                assertThrows(HolidaySourceException.class, () -> source(1024, 2000, 0).fetch(2026)).safeCode());
    }

    @Test void timesOutAndDoesNotRetryAConfigurationError() {
        respond(200, "");
        delayMs = 1500;
        assertEquals("HOLIDAY_SOURCE_TIMEOUT",
                assertThrows(HolidaySourceException.class, () -> source(8192, 250, 0).fetch(2026)).safeCode());

        var bad = new HttpHolidaySource(new ObjectMapper(), "file:///tmp/{year}.json", "test", 500, 1000, 1024, 0);
        assertEquals("HOLIDAY_SOURCE_CONFIGURATION",
                assertThrows(HolidaySourceException.class, () -> bad.fetch(2026)).safeCode());
    }
}
