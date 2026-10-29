#!/usr/bin/env node
"use strict";
// Compatibility for the command name only. The replacement owns a current-contract fixture.
// Evidence/coverage: backend/docs/current-checks.md. External fixture arguments are retired.
const {spawnSync}=require("node:child_process");
const path=require("node:path");
if(process.argv.length>2){
  if(process.argv.slice(2).join(" ")==="--help"){console.log("Run without arguments; current suite: check_calendar_drawer.py");process.exit(0);}
  throw new Error("Run without external fixture arguments; see backend/docs/current-checks.md");
}
const result=spawnSync("python3",[path.join(__dirname,"check_calendar_drawer.py")],{stdio:"inherit"});
if(result.error)throw result.error;
process.exit(result.status===null?1:result.status);
