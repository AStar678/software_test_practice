#!/usr/bin/env bash
set -euo pipefail
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME="$BASE_DIR/.runtime"
MYSQLD="${MYSQLD_BIN:-$(command -v mysqld || true)}"
MYSQL="${MYSQL_BIN:-$(command -v mysql || true)}"
MYSQLADMIN="${MYSQLADMIN_BIN:-$(command -v mysqladmin || true)}"
if [[ -z "$MYSQLD" || -z "$MYSQL" || -z "$MYSQLADMIN" ]]; then echo '需要已安装的 MySQL 8.4+（mysqld、mysql、mysqladmin）。' >&2; exit 1; fi
for dependency in "$MYSQLD" "$MYSQL" "$MYSQLADMIN" python3 openssl; do
  if ! command -v "$dependency" >/dev/null 2>&1; then
    echo "缺少启动依赖或路径不可执行：$dependency" >&2; exit 1
  fi
done
# Pass the optional macOS library fallback as env arguments: system shells can strip
# inherited DYLD_* variables before this script or service.py receives them.
MYSQLD_COMMAND=("$MYSQLD")
if [[ -n "${MYSQLD_LIBRARY_PATH:-}" ]]; then
  MYSQLD_COMMAND=(env "DYLD_FALLBACK_LIBRARY_PATH=$MYSQLD_LIBRARY_PATH" "$MYSQLD")
fi
mkdir -p "$RUNTIME"
chmod 700 "$RUNTIME"

# Check clients even when the server is already running: Homebrew can break either side.
for client in "$MYSQL" "$MYSQLADMIN"; do
  echo "检查 MySQL 客户端：$client"
  if ! "$client" --no-defaults --version >"$RUNTIME/mysql-preflight.log" 2>&1; then
    echo "MySQL 客户端无法运行：$client" >&2
    cat "$RUNTIME/mysql-preflight.log" >&2
    echo '请先修复本机 MySQL 及其依赖，再重新启动。' >&2
    exit 1
  fi
done

# Every start re-applies the application account grants. Flyway runs destructive DDL in the
# contract migrations (V25 DROP TABLE ...), so DROP is part of the required privilege set.
# Re-applying is what heals databases created before DROP was added; skipping it leaves an
# existing .runtime on the old grant set and the next DROP migration fails at startup.
ensure_database_and_grants() {
  if [[ ! -f "$RUNTIME/database.env" ]]; then
    umask 077
    DB_PASS="$(openssl rand -hex 24)"
    ROOT_PASS="$(openssl rand -hex 24)"
    "$MYSQL" --no-defaults --protocol=socket --socket="$RUNTIME/mysql.sock" -u root <<SQL
CREATE DATABASE IF NOT EXISTS pandora CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'pandora'@'localhost' IDENTIFIED BY '$DB_PASS';
CREATE USER IF NOT EXISTS 'pandora'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP ON pandora.* TO 'pandora'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP ON pandora.* TO 'pandora'@'127.0.0.1';
ALTER USER 'root'@'localhost' IDENTIFIED BY '$ROOT_PASS';
SQL
    printf 'PANDORA_DB_PASSWORD=%s\nPANDORA_DB_USER=pandora\n' "$DB_PASS" > "$RUNTIME/database.env"
    printf '[client]\nuser=root\npassword=%s\nsocket=%s\n' "$ROOT_PASS" "$RUNTIME/mysql.sock" > "$RUNTIME/mysql-admin.cnf"
    return 0
  fi
  local db_user db_pass
  db_user="$(sed -n 's/^PANDORA_DB_USER=//p' "$RUNTIME/database.env")"
  db_pass="$(sed -n 's/^PANDORA_DB_PASSWORD=//p' "$RUNTIME/database.env")"
  db_user="${db_user:-pandora}"
  "$MYSQL" --defaults-file="$RUNTIME/mysql-admin.cnf" <<SQL
CREATE DATABASE IF NOT EXISTS pandora CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS '$db_user'@'localhost' IDENTIFIED BY '$db_pass';
CREATE USER IF NOT EXISTS '$db_user'@'127.0.0.1' IDENTIFIED BY '$db_pass';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP ON pandora.* TO '$db_user'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP ON pandora.* TO '$db_user'@'127.0.0.1';
SQL
}

if [[ -f "$RUNTIME/mysql-admin.cnf" ]] && "$MYSQLADMIN" --defaults-file="$RUNTIME/mysql-admin.cnf" --connect-timeout=2 ping >/dev/null 2>&1; then
  ensure_database_and_grants
  echo '项目 MySQL 已启动（127.0.0.1:13306）。'
  exit 0
fi
# Report loader/dependency failures before detaching the server and waiting for readiness.
# These failures reach stderr, before mysqld can open mysql.log.
echo '检查 MySQL 服务端...'
if ! "${MYSQLD_COMMAND[@]}" --no-defaults --version >"$RUNTIME/mysql-preflight.log" 2>&1; then
  echo "MySQL 服务端无法运行：$MYSQLD" >&2
  cat "$RUNTIME/mysql-preflight.log" >&2
  echo '请先修复本机 MySQL 及其依赖，再重新启动。' >&2
  exit 1
fi
if [[ ! -d "$RUNTIME/mysql/mysql" ]]; then
  echo '初始化项目 MySQL 数据目录...'
  mkdir -p "$RUNTIME/mysql"
  if ! "${MYSQLD_COMMAND[@]}" --no-defaults --initialize-insecure --datadir="$RUNTIME/mysql" --log-error="$RUNTIME/mysql-init.log"; then
    echo "MySQL 初始化失败，请查看 $RUNTIME/mysql-init.log" >&2
    [[ ! -f "$RUNTIME/mysql-init.log" ]] || tail -n 20 "$RUNTIME/mysql-init.log" >&2
    exit 1
  fi
fi
echo "启动项目 MySQL（127.0.0.1:13306），日志：$RUNTIME/mysql-console.log、$RUNTIME/mysql.log"
python3 "$BASE_DIR/scripts/service.py" start mysql "${MYSQLD_COMMAND[@]}" --no-defaults --datadir="$RUNTIME/mysql" --socket="$RUNTIME/mysql.sock" --pid-file="$RUNTIME/mysql.pid" --port=13306 --bind-address=127.0.0.1 --mysqlx=0 --skip-log-bin --default-time-zone='+00:00' --log-error="$RUNTIME/mysql.log"
for i in {1..60}; do
  if [[ -f "$RUNTIME/mysql-admin.cnf" ]]; then
    "$MYSQLADMIN" --defaults-file="$RUNTIME/mysql-admin.cnf" --connect-timeout=2 ping >/dev/null 2>&1 && break
  else
    "$MYSQLADMIN" --no-defaults --socket="$RUNTIME/mysql.sock" --connect-timeout=2 -u root ping >/dev/null 2>&1 && break
  fi
  if (( i % 10 == 0 )); then echo "等待 MySQL 就绪（第 $i/60 次检查）..."; fi
  sleep 1
done
if ! "$MYSQLADMIN" --defaults-file="$RUNTIME/mysql-admin.cnf" --connect-timeout=2 ping >/dev/null 2>&1 && ! "$MYSQLADMIN" --no-defaults --socket="$RUNTIME/mysql.sock" --connect-timeout=2 -u root ping >/dev/null 2>&1; then
  echo "MySQL 启动失败，请查看 $RUNTIME/mysql-console.log 和 $RUNTIME/mysql.log" >&2
  for log in "$RUNTIME/mysql-console.log" "$RUNTIME/mysql.log"; do
    if [[ -f "$log" ]]; then echo "最近日志：$log" >&2; tail -n 20 "$log" >&2; fi
  done
  exit 1
fi
ensure_database_and_grants
echo '项目 MySQL 已启动（127.0.0.1:13306），数据保存于 backend/.runtime/mysql。'
