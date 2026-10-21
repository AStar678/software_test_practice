#!/usr/bin/env bash
# Run a check script against a throwaway, freshly seeded database on its own port.
# The project's normal database and running backend are never touched.
#
#   ./scripts/run_check_isolated.sh node scripts/check_task_form.js --base-url {base}
#   ./scripts/run_check_isolated.sh python3 scripts/check_phone_cycle.py --base-url {base}
#
# Environment:
#   PORT              backend port for the scratch instance (default 18130)
#   CHECK_FIXED_TIME  optional ISO instant for the controllable clock
#   KEEP_ISOLATED_DB  set to 1 to keep the scratch database and its log on failure
set -euo pipefail
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME="$BASE_DIR/.runtime"
PORT="${PORT:-18130}"
JAR="$BASE_DIR/target/pandora-backend-0.1.0.jar"
MYSQL="$(command -v mysql || true)"
[[ -n "$MYSQL" ]] || { echo 'need a mysql client on PATH'; exit 1; }
[[ -f "$JAR" ]] || { echo "missing $JAR; run mvn -B -ntp package first"; exit 1; }
[[ -f "$RUNTIME/database.env" ]] || { echo 'missing .runtime/database.env; run start-db.sh first'; exit 1; }

"$BASE_DIR/scripts/start-db.sh" >/dev/null
set -a; # shellcheck disable=SC1090
source "$RUNTIME/database.env"
set +a

if command -v lsof >/dev/null 2>&1 && lsof -ti "tcp:$PORT" >/dev/null 2>&1; then
  echo "port $PORT is already in use; choose another PORT" >&2; exit 1
fi
DB="pandora_check_$(date +%s)_$RANDOM"
LOG="$RUNTIME/check-backend.log"
PID=""

drop_scratch() {
  "$MYSQL" --defaults-file="$RUNTIME/mysql-admin.cnf" -e "DROP DATABASE IF EXISTS \`$DB\`;" >/dev/null 2>&1 || true
}
cleanup() {
  local status=$?
  if [[ -n "$PID" ]] && kill -0 "$PID" >/dev/null 2>&1; then
    kill "$PID" >/dev/null 2>&1 || true
    for _ in {1..50}; do kill -0 "$PID" >/dev/null 2>&1 || break; sleep 0.1; done
    kill -9 "$PID" >/dev/null 2>&1 || true
    wait "$PID" 2>/dev/null || true
  fi
  if [[ $status -eq 0 || "${KEEP_ISOLATED_DB:-0}" != "1" ]]; then drop_scratch; else
    echo "kept scratch database: $DB (log: $LOG)" >&2
  fi
}
trap cleanup EXIT INT TERM

"$MYSQL" --defaults-file="$RUNTIME/mysql-admin.cnf" -e "CREATE DATABASE \`$DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;" >/dev/null
for host in localhost 127.0.0.1; do
  "$MYSQL" --defaults-file="$RUNTIME/mysql-admin.cnf" -e "GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES,DROP ON \`$DB\`.* TO '$PANDORA_DB_USER'@'$host';" >/dev/null
done
"$MYSQL" --defaults-file="$RUNTIME/mysql-admin.cnf" -e "FLUSH PRIVILEGES;" >/dev/null

DB_URL="jdbc:mysql://127.0.0.1:13306/$DB?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&useUnicode=true&characterEncoding=UTF-8&allowPublicKeyRetrieval=true&sslMode=DISABLED"
JAVA_ARGS=()
if [[ -n "${CHECK_FIXED_TIME:-}" ]]; then
  export PANDORA_CLOCK_CONTROLLABLE=true
  JAVA_ARGS+=("-Dpandora.clock.fixed-time=$CHECK_FIXED_TIME")
fi
: > "$LOG"
export PANDORA_DB_URL="$DB_URL"
export PANDORA_DB_USER PANDORA_DB_PASSWORD
WORKER="${CHECK_WORKER:-false}"
export PANDORA_SEED=true PANDORA_WORKER_ENABLED="$WORKER" PANDORA_PORT="$PORT" PANDORA_BIND_ADDRESS=127.0.0.1
java ${JAVA_ARGS[@]+"${JAVA_ARGS[@]}"} -jar "$JAR" --pandora.seed=true --pandora.worker-enabled="$WORKER" >>"$LOG" 2>&1 &
PID=$!
BASE_URL="http://127.0.0.1:$PORT"
for _ in {1..120}; do
  if curl -fsS "$BASE_URL/health" >/dev/null 2>&1; then break; fi
  if ! kill -0 "$PID" >/dev/null 2>&1; then echo 'scratch backend exited early' >&2; tail -40 "$LOG" >&2; exit 1; fi
  sleep 1
done
curl -fsS "$BASE_URL/health" >/dev/null || { echo "scratch backend did not become healthy: $LOG" >&2; exit 1; }
kill -0 "$PID" >/dev/null 2>&1 || { echo "scratch backend stopped during startup: $LOG" >&2; exit 1; }
grep -q "$DB" "$LOG" || { echo "port $PORT is served by another process, not the scratch backend" >&2; exit 1; }
# Tomcat accepts health requests before ApplicationRunners finish. Wait for the seeded users so a
# check never starts against a half-seeded database (and never kills the backend mid-seed).
seeded=0
for _ in {1..120}; do
  count="$("$MYSQL" --defaults-file="$RUNTIME/mysql-admin.cnf" -N -e "SELECT COUNT(*) FROM \`$DB\`.users;" 2>/dev/null || echo 0)"
  if [[ "${count:-0}" -gt 0 ]]; then seeded=1; break; fi
  if ! kill -0 "$PID" >/dev/null 2>&1; then echo 'scratch backend exited during seeding' >&2; tail -40 "$LOG" >&2; exit 1; fi
  sleep 1
done
[[ "$seeded" == "1" ]] || { echo "scratch database was not seeded: $LOG" >&2; exit 1; }
sleep 1
echo "scratch database: $DB"
echo "scratch backend: $BASE_URL"

args=()
for arg in "$@"; do
  arg="${arg//\{base\}/$BASE_URL}"
  arg="${arg//\{db\}/$DB}"
  args+=("$arg")
done
"${args[@]}"
