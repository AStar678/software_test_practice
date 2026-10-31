#!/usr/bin/env python3
"""Run the normal Maven build, excluding pre-existing Finder duplicate '* 2.java' copies only.

The temporary POM stays beside the real POM so resource/source paths are unchanged, then is removed.
"""
from pathlib import Path
import subprocess,tempfile
base=Path(__file__).resolve().parents[1]
source=(base/'pom.xml').read_text()
plugin='<plugin><groupId>org.apache.maven.plugins</groupId><artifactId>maven-compiler-plugin</artifactId><configuration><excludes><exclude>**/* 2.java</exclude></excludes><testExcludes><testExclude>**/* 2.java</testExclude></testExcludes></configuration></plugin>'
with tempfile.NamedTemporaryFile(mode='w',prefix='.refinement-verify-',suffix='.xml',dir=base) as temporary:
    temporary.write(source.replace('<plugins>','<plugins>'+plugin));temporary.flush()
    subprocess.run(['mvn','-f',temporary.name,'-o','-q','-Dmaven.repo.local=.runtime/m2','test','package'],cwd=base,check=True)
