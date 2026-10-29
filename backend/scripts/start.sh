#!/usr/bin/env bash
set -euo pipefail
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BASE_DIR"
./scripts/start-db.sh
set -a
source .runtime/database.env
[[ ! -f .env ]] || source .env
set +a
if curl -fsS "http://127.0.0.1:${PANDORA_PORT:-8080}/health" >/dev/null 2>&1; then
  echo '后端已运行：http://127.0.0.1:8080';exit 0
fi
if [[ -z "${JAVA_HOME:-}" && -x /usr/libexec/java_home ]]; then export JAVA_HOME="$(/usr/libexec/java_home -v 21)";fi
mvn -B -ntp -Dmaven.repo.local="$BASE_DIR/.runtime/m2" package
export PANDORA_SEED="${PANDORA_SEED:-false}"
python3 scripts/service.py start backend "${JAVA_HOME:+$JAVA_HOME/bin/}java" -jar "$BASE_DIR/target/pandora-backend-0.1.0.jar"
for i in {1..60}; do
  if curl -fsS "http://127.0.0.1:${PANDORA_PORT:-8080}/health" >/dev/null 2>&1; then
    echo "后端已启动：http://127.0.0.1:${PANDORA_PORT:-8080}（原项目首页）"
    exit 0
  fi
  sleep 1
done
echo '后端未就绪，请查看 backend/.runtime/backend-console.log';exit 1
