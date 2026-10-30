#!/usr/bin/env bash
# Start the local demo on 8080 from a reproducible dataset.
#
# Why this script rebuilds the database instead of clearing rows: the demo preparation contract
# (src/main/java/cn/pandora/seed/DemoSeed.java) is explicit and idempotent -- "Never deletes or
# resets existing data", and it refuses to initialize a non-empty database without a matching
# marker. "Same state on every start" is therefore delivered by dropping and recreating the
# dedicated demo database, then running the normal first preparation. Nothing inside a live
# schema is wiped, and the ordinary `pandora` database is never touched.
#
# Usage:
#   ./scripts/start-demo.sh           # rebuild pandora_demo, then serve on 8080
#   ./scripts/start-demo.sh --keep    # reuse the current pandora_demo (keep UI edits)
#
# Env: PANDORA_DEMO_DB (default pandora_demo), PANDORA_DEMO_MARKER (default local-web-v2),
#      PANDORA_PORT (default 8080), PANDORA_SKIP_BUILD=1 to reuse the existing JAR.
set -euo pipefail
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BASE_DIR"
RUNTIME="$BASE_DIR/.runtime"
DEMO_DB="${PANDORA_DEMO_DB:-pandora_demo}"
MARKER="${PANDORA_DEMO_MARKER:-local-web-v2}"
PORT="${PANDORA_PORT:-8080}"
DEMO_PASSWORD="${PANDORA_DEMO_PASSWORD:-Demo@123456}"
KEEP=0
for arg in "$@"; do
  case "$arg" in
    --keep) KEEP=1 ;;
    -h|--help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "未知参数：$arg（可用 --keep 或 --help）"; exit 1 ;;
  esac
done
if [[ ! "$DEMO_DB" =~ ^[A-Za-z0-9_]{1,64}$ ]]; then echo "演示库名不合法：$DEMO_DB"; exit 1; fi
MYSQL="$(command -v mysql || true)"
JAVA_BIN="${JAVA_BIN:-$(command -v java || true)}"
if [[ -z "$MYSQL" || -z "$JAVA_BIN" ]]; then echo '需要 mysql 客户端和 Java 21。'; exit 1; fi

"$BASE_DIR/scripts/start-db.sh"

admin_sql() { "$MYSQL" --defaults-file="$RUNTIME/mysql-admin.cnf" "$@"; }
DB_USER="$(sed -n 's/^PANDORA_DB_USER=//p' "$RUNTIME/database.env")"
DB_USER="${DB_USER:-pandora}"

# The ordinary backend and the demo share port 8080; only project-owned services may be stopped.
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "端口 $PORT 已被占用，尝试停止本项目自己的后端..."
  python3 scripts/service.py stop backend || true
  python3 scripts/service.py stop demo || true
  for _ in {1..20}; do
    lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 || break
    sleep 0.5
  done
  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "端口 $PORT 仍被非本项目进程占用，请先自行释放："
    lsof -nP -iTCP:"$PORT" -sTCP:LISTEN
    exit 1
  fi
fi

if [[ "$KEEP" == "0" ]]; then
  # Grants are name-scoped and survive the drop; re-apply anyway so a fresh install heals too.
  admin_sql -e "DROP DATABASE IF EXISTS \`$DEMO_DB\`;"
fi
admin_sql -e "CREATE DATABASE IF NOT EXISTS \`$DEMO_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
for host in localhost 127.0.0.1; do
  admin_sql -e "GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP ON \`$DEMO_DB\`.* TO '$DB_USER'@'$host';"
done
admin_sql -e "FLUSH PRIVILEGES;"

if [[ "${PANDORA_SKIP_BUILD:-0}" != "1" ]]; then
  echo '构建 JAR...'
  mvn -B -ntp -q -DskipTests -Dmaven.repo.local="$RUNTIME/m2" package
fi

PREP_ARGS=(--database "$DEMO_DB" --demo-marker "$MARKER" --output "$RUNTIME/demo-manifest.json")
[[ "$KEEP" == "1" ]] || PREP_ARGS+=(--initialize)
echo "准备演示数据（${DEMO_DB}，$( [[ "$KEEP" == "1" ]] && echo '保留现有数据' || echo '重建为初始状态' )）..."
python3 scripts/prepare_demo.py "${PREP_ARGS[@]}"

set -a
source "$RUNTIME/database.env"
set +a
export PANDORA_DB_URL="jdbc:mysql://127.0.0.1:13306/${DEMO_DB}?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&allowPublicKeyRetrieval=true&sslMode=DISABLED"
export PANDORA_SEED=false
export PANDORA_PORT="$PORT"
python3 scripts/service.py start demo "$JAVA_BIN" -jar "$BASE_DIR/target/pandora-backend-0.1.0.jar"
for _ in {1..60}; do
  curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break
  sleep 1
done
if ! curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
  echo "演示后端未就绪，请查看 $RUNTIME/demo-console.log"; exit 1
fi

cat <<TXT
演示后端已启动：http://127.0.0.1:$PORT   （PC 管理端 /admin.html）
演示库：$DEMO_DB —— 本次$( [[ "$KEEP" == "1" ]] && echo '沿用上次数据' || echo '已重建为初始状态' )
密码：$DEMO_PASSWORD
员工 Web（手机号）：13800000001 创始人｜13800000002/03 部门负责人｜13800000011/12/21/22 团队负责人｜13800000004/05/06 普通员工
管理端：admin
清单：$RUNTIME/demo-manifest.json
停止：./scripts/stop.sh
TXT
