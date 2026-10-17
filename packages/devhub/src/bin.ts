#!/usr/bin/env node
import { run } from './cli/run'

process.exitCode = await run(process.argv.slice(2))
