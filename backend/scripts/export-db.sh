#!/usr/bin/env bash
# Export application schema and current business data without local login sessions.
set -euo pipefail
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${PANDORA_EXPORT_DATABASE:-pandora}"
CLIENT_CONFIG="${PANDORA_MYSQL_DEFAULTS_FILE:-$BASE_DIR/.runtime/mysql-admin.cnf}"
OUTPUT="${1:-$BASE_DIR/database/pandora.sql}"
MYSQLDUMP="${MYSQLDUMP_BIN:-$(command -v mysqldump || true)}"
if [[ -z "$MYSQLDUMP" || ! -f "$CLIENT_CONFIG" ]]; then
  echo '需要 mysqldump 和项目数据库连接配置，请先运行 scripts/start-db.sh。' >&2
  exit 1
fi
if [[ ! "$DB_NAME" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo '数据库名只能包含字母、数字和下划线。' >&2
  exit 1
fi
mkdir -p "$(dirname "$OUTPUT")"
umask 077
TEMP_FILE="$(mktemp "${OUTPUT}.tmp.XXXXXX")"
trap 'rm -f "$TEMP_FILE"' EXIT
OPTIONS=("--defaults-file=$CLIENT_CONFIG" --default-character-set=utf8mb4
  --single-transaction --no-tablespaces --set-gtid-purged=OFF
  --skip-comments --skip-dump-date --column-statistics=0)
{
  printf '%s\n' '-- Pandora application database snapshot.'
  printf '%s\n' '-- Includes full schema and business data; auth_sessions data is intentionally omitted.'
  printf '%s\n' '-- Import into an empty database. Existing tables with the same names will be replaced.'
  "$MYSQLDUMP" "${OPTIONS[@]}" --no-data --routines --events "$DB_NAME"
  "$MYSQLDUMP" "${OPTIONS[@]}" --no-create-info --skip-triggers --complete-insert \
    --order-by-primary --skip-add-locks --ignore-table="$DB_NAME.auth_sessions" "$DB_NAME"
} > "$TEMP_FILE"
python3 - "$TEMP_FILE" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
path.write_bytes(path.read_bytes().rstrip() + b'\n')
PY
chmod 644 "$TEMP_FILE"
mv "$TEMP_FILE" "$OUTPUT"
echo "数据库备份已生成：$OUTPUT"
