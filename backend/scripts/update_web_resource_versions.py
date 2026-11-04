#!/usr/bin/env python3
"""Refresh the employee page's content-hash resource query parameters."""
import hashlib
from pathlib import Path
import re


ROOT=Path(__file__).resolve().parents[2]
PAGE=ROOT/'潘多拉-交互原型.html'
REFERENCE=re.compile(r'(?P<prefix>(?:src|href)=")(?P<name>[^"?]+)\?v=[0-9a-f]+(?P<suffix>")')


def main():
    page=PAGE.read_text(encoding='utf-8')
    def refresh(match):
        source=ROOT/match.group('name')
        if not source.is_file():
            return match.group(0)
        digest=hashlib.sha256(source.read_bytes()).hexdigest()[:12]
        return match.group('prefix')+match.group('name')+'?v='+digest+match.group('suffix')
    updated=REFERENCE.sub(refresh,page)
    if updated!=page:
        PAGE.write_text(updated,encoding='utf-8')
    print('resource hashes current')


if __name__=='__main__':main()
