// Copies the llms.txt of the package into static/, so the site serves it at
// /devhub/llms.txt. scripts/build-llms.mjs makes that file from the build,
// so the site keeps no hand-written copy that can disagree with it.
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const docsDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const source = path.join(docsDir, '..', 'packages', 'devhub', 'llms.txt')
const target = path.join(docsDir, 'static', 'llms.txt')

await mkdir(path.dirname(target), { recursive: true })
await copyFile(source, target)
