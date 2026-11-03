#!/usr/bin/env python3
"""Check startup diagnostics in isolated copies with fake tools; never starts a real database."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


SCRIPTS = Path(__file__).resolve().parent


class StartupDiagnostics(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='pandora-startup-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.scripts = self.base / 'scripts'
        self.scripts.mkdir()
        for name in ('start-db.sh', 'start-demo.sh', 'service.py'):
            shutil.copy2(SCRIPTS / name, self.scripts / name)
        self.runtime = self.base / '.runtime'
        (self.runtime / 'mysql/mysql').mkdir(parents=True)
        self.bin = self.base / 'bin'
        self.bin.mkdir()
        self.env = dict(os.environ)
        for key in ('MYSQLD_BIN', 'MYSQL_BIN', 'MYSQLADMIN_BIN', 'MYSQLD_LIBRARY_PATH'):
            self.env.pop(key, None)
        self.env['PATH'] = os.pathsep.join((str(self.bin), str(Path(sys.executable).parent), os.defpath))
        self.env['PANDORA_SKIP_BUILD'] = '1'
        for name in ('mysql', 'mysqladmin', 'mysqld'):
            self.tool(name, 'case "$*" in *--version*) exit 0;; esac\nexit 1\n')
        for name in ('curl', 'lsof'):
            self.tool(name, 'exit 1\n')

    def tool(self, name, body):
        path = self.bin / name
        path.write_text('#!/bin/sh\n' + body)
        path.chmod(0o700)
        return path

    def run_script(self, name='start-db.sh', *args):
        return subprocess.run(['/bin/bash', str(self.scripts / name), *args],
                              env=self.env, capture_output=True, text=True, timeout=8)

    def test_missing_mysql_binary_is_named(self):
        self.env['MYSQL_BIN'] = str(self.bin / 'missing-mysql')
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('缺少启动依赖', result.stderr)
        self.assertIn('missing-mysql', result.stderr)

    def test_broken_mysql_client_shows_loader_error(self):
        self.tool('mysql', "echo 'Library not loaded: client-dependency.dylib' >&2\nexit 127\n")
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('MySQL 客户端无法运行', result.stderr)
        self.assertIn('client-dependency.dylib', result.stderr)

    def test_broken_mysqladmin_shows_loader_error(self):
        self.tool('mysqladmin', "echo 'Library not loaded: admin-dependency.dylib' >&2\nexit 127\n")
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('admin-dependency.dylib', result.stderr)

    def test_broken_mysqld_shows_loader_error_without_waiting(self):
        self.tool('mysqld', "echo 'Library not loaded: libabsl_missing.dylib' >&2\nexit 127\n")
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('MySQL 服务端无法运行', result.stderr)
        self.assertIn('libabsl_missing.dylib', result.stderr)

    def test_server_exit_shows_only_current_attempt(self):
        (self.runtime / 'mysql-console.log').write_text('OLD UNRELATED ERROR\n')
        self.tool('mysqld', 'case "$*" in *--version*) exit 0;; esac\n'
                  "echo 'unknown variable: rejected-option' >&2\nexit 2\n")
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('启动进程已退出', result.stderr)
        self.assertIn('rejected-option', result.stderr)
        self.assertNotIn('OLD UNRELATED ERROR', result.stderr)

    def test_initialization_failure_shows_error_log(self):
        (self.runtime / 'mysql/mysql').rmdir()
        self.tool('mysqld', 'case "$*" in *--version*) exit 0;; esac\n'
                  'for arg in "$@"; do case "$arg" in --log-error=*) '
                  'echo "initialization permission failure" > "${arg#--log-error=}";; esac; done\nexit 1\n')
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('MySQL 初始化失败', result.stderr)
        self.assertIn('initialization permission failure', result.stderr)

    def test_readiness_timeout_shows_progress_and_logs(self):
        # Avoid a real detached process and sixty real sleeps for the timeout case.
        (self.scripts / 'service.py').write_text('print("fake server launched")\n')
        (self.runtime / 'mysql.log').write_text('database startup detail\n')
        self.tool('sleep', 'exit 0\n')
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('第 10/60 次检查', result.stdout)
        self.assertIn('第 60/60 次检查', result.stdout)
        self.assertIn('database startup detail', result.stderr)

    def test_broken_java_stops_before_database_work(self):
        self.env['JAVA_BIN'] = str(self.tool('java', "echo 'Java runtime dependency missing' >&2\nexit 1\n"))
        (self.scripts / 'start-db.sh').write_text('echo DATABASE_TOUCHED\n')
        result = self.run_script('start-demo.sh', '--keep')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Java runtime dependency missing', result.stderr)
        self.assertNotIn('DATABASE_TOUCHED', result.stdout)


if __name__ == '__main__':
    unittest.main(verbosity=2)
