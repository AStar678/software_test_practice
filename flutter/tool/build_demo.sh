#!/usr/bin/env bash
# Course APK: cached dependencies only; no TLS certificate or release key required.
set -euo pipefail
cd "$(dirname "$0")/.."
demo_api_url="${PANDORA_DEMO_API_URL:-http://10.0.2.2:8080/api/v1}"
demo_defines="$(python3 - "$demo_api_url" <<'PY'
import base64
import sys
from urllib.parse import urlparse

value = sys.argv[1].strip().rstrip('/')
url = urlparse(value)
try:
    port = url.port
except ValueError:
    sys.exit('API 端口不合法。')
if (url.scheme not in ('http', 'https') or not url.hostname or
        url.username is not None or url.password is not None or
        url.query or url.fragment or url.path != '/api/v1' or
        any(c.isspace() for c in value)):
    sys.exit('API 地址必须为 http(s)://主机[:端口]/api/v1，不含凭证、查询或片段。')
print(base64.b64encode(('API_BASE_URL=' + value).encode()).decode())
PY
)"
cd android
exec ./gradlew --offline -Pandroid.builder.sdkDownload=false \
  "-Ptarget-platform=${PANDORA_DEMO_TARGET_PLATFORMS:-android-arm64}" \
  -Ptarget=lib/main.dart "-Pdart-defines=$demo_defines" assembleDebug "$@"
