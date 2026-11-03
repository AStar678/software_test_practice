#!/usr/bin/env bash
set -euo pipefail
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BASE_DIR"
for dependency in python3 curl mvn java; do
  if ! command -v "$dependency" >/dev/null 2>&1; then echo "缺少启动依赖：$dependency" >&2; exit 1; fi
done
./scripts/start-db.sh
set -a
source .runtime/database.env
[[ ! -f .env ]] || source .env
set +a
if curl --connect-timeout 1 --max-time 2 -fsS "http://127.0.0.1:${PANDORA_PORT:-8080}/health" >/dev/null 2>&1; then
  echo '后端已运行：http://127.0.0.1:8080';exit 0
fi
if [[ -z "${JAVA_HOME:-}" && -x /usr/libexec/java_home ]]; then export JAVA_HOME="$(/usr/libexec/java_home -v 21)";fi
mvn -B -ntp -Dmaven.repo.local="$BASE_DIR/.runtime/m2" package
export PANDORA_SEED="${PANDORA_SEED:-false}"
python3 scripts/service.py start backend "${JAVA_HOME:+$JAVA_HOME/bin/}java" -jar "$BASE_DIR/target/pandora-backend-0.1.0.jar"
echo "等待后端就绪，日志：$BASE_DIR/.runtime/backend-console.log"
for i in {1..60}; do
  if curl --connect-timeout 1 --max-time 2 -fsS "http://127.0.0.1:${PANDORA_PORT:-8080}/health" >/dev/null 2>&1; then
    echo "后端已启动：http://127.0.0.1:${PANDORA_PORT:-8080}（原项目首页）"
    exit 0
  fi
  if (( i % 10 == 0 )); then echo "等待后端就绪（第 $i/60 次检查）..."; fi
  sleep 1
done
echo '后端未就绪，请查看 backend/.runtime/backend-console.log' >&2
tail -n 30 .runtime/backend-console.log >&2
exit 1
