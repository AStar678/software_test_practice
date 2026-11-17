#!/usr/bin/env bash
# Optional production release path. Course delivery uses build_demo.sh instead.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${PANDORA_KEY_PROPERTIES:?请设置外置签名配置文件 PANDORA_KEY_PROPERTIES}"
: "${PANDORA_RELEASE_API_URL:?请设置使用系统可信证书的 HTTPS API 地址（含 /api/v1）}"
if [[ ! -f "$PANDORA_KEY_PROPERTIES" ]]; then
  echo '签名配置文件不存在。' >&2
  exit 1
fi
python3 - "$PANDORA_RELEASE_API_URL" <<'PY'
import sys
from urllib.parse import urlparse
url = urlparse(sys.argv[1])
if url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment or url.path.rstrip('/') != '/api/v1':
    sys.exit('发布 API 地址必须为 https://主机[:端口]/api/v1，不含凭证、查询或片段。')
PY
"${PANDORA_FLUTTER_BIN:-flutter}" build apk --release \
  --dart-define="RELEASE_API_BASE_URL=$PANDORA_RELEASE_API_URL" "$@"
