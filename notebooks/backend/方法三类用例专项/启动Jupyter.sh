#!/usr/bin/env bash
set -euo pipefail
TASK_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$TASK_DIR/.venv"
if [[ ! -x "$VENV_DIR/bin/python" ]]; then python3 -m venv "$VENV_DIR"; fi
"$VENV_DIR/bin/python" -m pip install -r "$TASK_DIR/requirements.txt"
exec "$VENV_DIR/bin/python" -m jupyterlab --notebook-dir="$TASK_DIR" "$TASK_DIR/测试报告.ipynb"
