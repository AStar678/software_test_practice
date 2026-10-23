package cn.pandora.mobile;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

public class WebUrlPolicyTest {
    @Test
    public void normalizesConfiguredHostnameWithoutChangingItsRoute() {
        assertEquals("https://example.com/pandora?tenant=One#login",
                WebUrlPolicy.normalize("  EXAMPLE.COM/pandora?tenant=One#login  ", false));
        assertEquals("https://example.com:8443/app",
                WebUrlPolicy.normalize("Example.COM:8443/app", false));
        assertEquals("https://example.com", WebUrlPolicy.normalize("HTTPS://EXAMPLE.COM", false));
    }

    @Test
    public void localServerAddressesCanBeConfiguredExplicitly() {
        assertEquals("http://localhost:8080/app",
                WebUrlPolicy.normalize("HTTP://LOCALHOST:8080/app", true));
        assertEquals("https://localhost:8443/app",
                WebUrlPolicy.normalize("localhost:8443/app", false));
        assertEquals("https://192.168.1.10:8443/",
                WebUrlPolicy.normalize("192.168.1.10:8443/", false));
        assertEquals("https://[2001:db8::1]:8443/app",
                WebUrlPolicy.normalize("[2001:DB8::1]:8443/app", false));
    }

    @Test
    public void cleartextNeedsAnExplicitOptIn() {
        assertRejected("http://example.com", false);
        assertRejected("HTTP://example.com:80/app", false);
        assertEquals("http://example.com:80/app",
                WebUrlPolicy.normalize("HTTP://EXAMPLE.COM:80/app", true));
        assertEquals("https://example.com", WebUrlPolicy.normalize("example.com", true));
    }

    @Test
    public void signedAddressKeepsRawEncodingAndQueryOrder() {
        String suffix = "/objects/a%2fb%2Fc%252F+name?key=a%2Fb&key=a+b&sig=%2f%2B%3D#part%2f1";
        String expected = "https://example.com:0443" + suffix;
        assertEquals(expected, WebUrlPolicy.normalize("HTTPS://EXAMPLE.COM:0443" + suffix, false));
        assertEquals(expected, WebUrlPolicy.normalize(expected, false));
    }

    @Test
    public void doesNotResolvePathsOrDropEmptyQueryAndFragment() {
        assertEquals("https://example.com/a/../b//c?#",
                WebUrlPolicy.normalize("https://EXAMPLE.COM/a/../b//c?#", false));
        assertEquals("https://example.com?", WebUrlPolicy.normalize("example.com?", false));
        assertEquals("https://example.com#", WebUrlPolicy.normalize("example.com#", false));
    }

    @Test
    public void rejectsExplicitNonWebSchemesIncludingNumericPayloads() {
        for (String value : new String[]{
                "file:///etc/passwd", "file:443", "javascript:alert(1)", "javascript:123",
                "intent://example.com", "intent:443", "data:text/html,hello",
                "content://provider/page", "ftp://example.com", "mailto:user@example.com"
        }) {
            assertRejected(value, true);
            assertFalse(value, WebUrlPolicy.isWebUrl(value));
        }
    }

    @Test
    public void rejectsCredentialsEvenWhenTheVisiblePrefixLooksTrusted() {
        for (String value : new String[]{
                "https://user:password@example.com", "https://@example.com",
                "https://example.com@evil.test", "https://example.com:443@evil.test",
                "user@example.com", "https://user%40trusted.test@example.com"
        }) {
            assertRejected(value, true);
        }
    }

    @Test
    public void rejectsMissingOrAmbiguousAuthorities() {
        for (String value : new String[]{
                "", "  ", "/relative/path", "//example.com/path", "https:///path", "https://",
                "https:example.com", "https:/example.com", "https://example..com",
                "https://example.com:443:80", "https://[::1]suffix", "https://%65xample.com",
                "https://[fe80::1%25eth0]", "https://example.com\\@evil.test",
                "https://example.com/a\\b", "https://example.com/a b", "https://example.com/%zz"
        }) {
            assertRejected(value, true);
            assertFalse(value, WebUrlPolicy.isWebUrl(value));
        }
        assertRejected(null, true);
        assertFalse(WebUrlPolicy.isWebUrl(null));
    }

    @Test
    public void rejectsInvalidPortsButAcceptsTheValidBoundaries() {
        for (String port : new String[]{"", "0", "-1", "+443", "65536", "2147483648", "abc", "443x"}) {
            assertRejected("https://example.com:" + port + "/app", true);
        }
        assertEquals("https://example.com:1", WebUrlPolicy.normalize("https://example.com:1", false));
        assertEquals("https://example.com:65535", WebUrlPolicy.normalize("https://example.com:65535", false));
    }

    @Test
    public void rejectsControlCharactersBeforeAnyWhitespaceTrimming() {
        for (String value : new String[]{
                "\nhttps://example.com", "https://example.com\r", "https://exa\tmple.com",
                "https://example.com/\u0000", "https://example.com/\u007f", "https://example.com/\u0085"
        }) {
            assertRejected(value, true);
            assertFalse(value, WebUrlPolicy.isWebUrl(value));
        }
        // Encoded bytes belong to the URL payload and must not be decoded by configuration parsing.
        assertEquals("https://example.com/a%0Ab", WebUrlPolicy.normalize("https://example.com/a%0Ab", false));
    }

    @Test
    public void originComparisonUsesSchemeHostAndEffectivePort() {
        assertTrue(WebUrlPolicy.sameOrigin("https://EXAMPLE.COM/login", "HTTPS://example.com:443/app?a=1#x"));
        assertTrue(WebUrlPolicy.sameOrigin("http://example.com", "http://example.com:80/"));
        assertTrue(WebUrlPolicy.sameOrigin("https://example.com:0443", "https://example.com"));
        assertTrue(WebUrlPolicy.sameOrigin("https://[2001:DB8::1]:8443/a", "https://[2001:db8::1]:8443/b"));
        assertFalse(WebUrlPolicy.sameOrigin("https://example.com", "http://example.com"));
        assertFalse(WebUrlPolicy.sameOrigin("https://example.com", "https://example.com:8443"));
        assertFalse(WebUrlPolicy.sameOrigin("http://example.com:443", "https://example.com:443"));
    }

    @Test
    public void originComparisonRejectsSuffixCredentialsAndRelativeAddressBypasses() {
        String trusted = "https://example.com";
        for (String other : new String[]{
                "https://example.com.evil.test", "https://evil-example.com", "https://www.example.com",
                "https://example.com@evil.test", "https://evil.test@example.com",
                "https://example.com:443@evil.test", "https://example.com\\@evil.test",
                "example.com", "//example.com", "/login", "javascript:alert(1)",
                "https://example.com:", "https://example.com:65536", null
        }) {
            assertFalse(String.valueOf(other), WebUrlPolicy.sameOrigin(trusted, other));
            assertFalse(String.valueOf(other), WebUrlPolicy.sameOrigin(other, trusted));
        }
        assertFalse(WebUrlPolicy.sameOrigin(null, null));
    }

    @Test
    public void webUrlRecognitionRequiresAnAbsoluteAddressButAllowsHttp() {
        assertTrue(WebUrlPolicy.isWebUrl("https://example.com/app"));
        assertTrue(WebUrlPolicy.isWebUrl("http://localhost:8080/app"));
        assertTrue(WebUrlPolicy.isWebUrl("https://[::1]:8443/app"));
        assertFalse(WebUrlPolicy.isWebUrl("example.com"));
        assertFalse(WebUrlPolicy.isWebUrl("localhost:8080"));
        assertFalse(WebUrlPolicy.isWebUrl("https://user@example.com"));
    }

    private static void assertRejected(String value, boolean allowHttp) {
        try {
            WebUrlPolicy.normalize(value, allowHttp);
            fail("Should reject: " + value);
        } catch (IllegalArgumentException expected) {
            assertNotNull(expected.getMessage());
            assertFalse(expected.getMessage().isBlank());
        }
    }
}
