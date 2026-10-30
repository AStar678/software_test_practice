#!/usr/bin/env bash
set -euo pipefail
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
python3 "$BASE_DIR/scripts/service.py" stop demo
python3 "$BASE_DIR/scripts/service.py" stop backend
python3 "$BASE_DIR/scripts/service.py" stop mysql
echo '项目后端和项目 MySQL 已停止，数据仍保留。'
