#!/usr/bin/env bash
set -euo pipefail
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME="$BASE_DIR/.runtime"
MYSQLD="${MYSQLD_BIN:-$(command -v mysqld || true)}"
MYSQL="${MYSQL_BIN:-$(command -v mysql || true)}"
if [[ -z "$MYSQLD" || -z "$MYSQL" ]]; then echo '需要已安装的 MySQL 8.4+（mysqld、mysql）。'; exit 1; fi
mkdir -p "$RUNTIME"
chmod 700 "$RUNTIME"
if [[ -f "$RUNTIME/mysql-admin.cnf" ]] && mysqladmin --defaults-file="$RUNTIME/mysql-admin.cnf" ping >/dev/null 2>&1; then
  echo '项目 MySQL 已启动（127.0.0.1:13306）。'; exit 0
fi
if [[ ! -d "$RUNTIME/mysql/mysql" ]]; then
  mkdir -p "$RUNTIME/mysql"
  "$MYSQLD" --no-defaults --initialize-insecure --datadir="$RUNTIME/mysql" --log-error="$RUNTIME/mysql-init.log"
fi
python3 "$BASE_DIR/scripts/service.py" start mysql "$MYSQLD" --no-defaults --datadir="$RUNTIME/mysql" --socket="$RUNTIME/mysql.sock" --pid-file="$RUNTIME/mysql.pid" --port=13306 --bind-address=127.0.0.1 --mysqlx=0 --skip-log-bin --default-time-zone='+00:00' --log-error="$RUNTIME/mysql.log"
for i in {1..60}; do
  if [[ -f "$RUNTIME/mysql-admin.cnf" ]]; then
    mysqladmin --defaults-file="$RUNTIME/mysql-admin.cnf" ping >/dev/null 2>&1 && break
  else
    mysqladmin --no-defaults --socket="$RUNTIME/mysql.sock" -u root ping >/dev/null 2>&1 && break
  fi
  sleep 1
done
if ! mysqladmin --defaults-file="$RUNTIME/mysql-admin.cnf" ping >/dev/null 2>&1 && ! mysqladmin --no-defaults --socket="$RUNTIME/mysql.sock" -u root ping >/dev/null 2>&1; then echo "MySQL 启动失败，请查看 $RUNTIME/mysql.log";exit 1;fi
if [[ ! -f "$RUNTIME/database.env" ]]; then
  umask 077
  DB_PASS="$(openssl rand -hex 24)"
  ROOT_PASS="$(openssl rand -hex 24)"
  "$MYSQL" --no-defaults --protocol=socket --socket="$RUNTIME/mysql.sock" -u root <<SQL
CREATE DATABASE IF NOT EXISTS pandora CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'pandora'@'localhost' IDENTIFIED BY '$DB_PASS';
CREATE USER IF NOT EXISTS 'pandora'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON pandora.* TO 'pandora'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON pandora.* TO 'pandora'@'127.0.0.1';
ALTER USER 'root'@'localhost' IDENTIFIED BY '$ROOT_PASS';
SQL
  printf 'PANDORA_DB_PASSWORD=%s\nPANDORA_DB_USER=pandora\n' "$DB_PASS" > "$RUNTIME/database.env"
  printf '[client]\nuser=root\npassword=%s\nsocket=%s\n' "$ROOT_PASS" "$RUNTIME/mysql.sock" > "$RUNTIME/mysql-admin.cnf"
fi
echo '项目 MySQL 已启动（127.0.0.1:13306），数据保存于 backend/.runtime/mysql。'
