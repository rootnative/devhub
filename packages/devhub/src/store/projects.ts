import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { isRecord, readJsonFile, writeJsonAtomic } from './files'

export const PROJECTS_SCHEMA_VERSION = 1

type ProjectsFile = {
  schemaVersion: typeof PROJECTS_SCHEMA_VERSION
  projects: { path: string }[]
}

export function projectsFile(home: string): string {
  return path.join(home, 'projects.json')
}

/** Returns the project folders that `devhub sync` saw, in the order seen. */
export async function readProjects(home: string): Promise<string[]> {
  const file = projectsFile(home)
  let value: unknown
  try {
    value = await readJsonFile(file)
  } catch (error) {
    throw invalidFile(file, error)
  }
  if (value === undefined) {
    return []
  }
  if (
    !isRecord(value) ||
    value.schemaVersion !== PROJECTS_SCHEMA_VERSION ||
    !Array.isArray(value.projects)
  ) {
    throw invalidFile(file)
  }
  const projects: string[] = []
  for (const entry of value.projects) {
    if (!isRecord(entry) || typeof entry.path !== 'string') {
      throw invalidFile(file)
    }
    projects.push(entry.path)
  }
  return projects
}

/** Adds a project folder. Call it only with the sync lock. */
export async function addProject(
  home: string,
  projectDir: string,
): Promise<void> {
  const projects = await readProjects(home)
  if (projects.includes(projectDir)) {
    return
  }
  const content: ProjectsFile = {
    schemaVersion: PROJECTS_SCHEMA_VERSION,
    projects: [...projects, projectDir].map((project) => ({ path: project })),
  }
  await mkdir(home, { recursive: true })
  await writeJsonAtomic(projectsFile(home), content)
}

function invalidFile(file: string, cause?: unknown): Error {
  const detail = cause instanceof Error ? ` ${cause.message}` : ''
  return new Error(
    `${file} is not a valid DevHub projects file.${detail} Correct the file, or delete it and run devhub sync in each project folder again.`,
  )
}
