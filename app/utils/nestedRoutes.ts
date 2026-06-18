import fs from 'node:fs'
import path from 'node:path'
import { type RouteConfigEntry, route, index, layout, prefix } from '@react-router/dev/routes'

const ROUTE_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js'])
const IGNORED_PATTERNS = [/\.server\./, /\.client\./, /\.test\./, /\.spec\./]

interface NestedRoutesOptions {
  rootDirectory?: string
}

function isRouteFile(name: string): boolean {
  if (name.startsWith('.')) return false
  const ext = path.extname(name)
  if (!ROUTE_EXTENSIONS.has(ext)) return false
  if (IGNORED_PATTERNS.some((pattern) => pattern.test(name))) return false
  return true
}

function baseName(filename: string): string {
  return path.basename(filename, path.extname(filename))
}

function fileToSegment(filename: string): string {
  const name = baseName(filename)
  if (name === '$') return '*'
  if (name.startsWith('$')) return `:${name.slice(1)}`
  return name
}

function dirToSegment(dirname: string): string {
  if (dirname.startsWith('$')) return `:${dirname.slice(1)}`
  return dirname
}

function buildRoutes(absDir: string, filePrefix: string): RouteConfigEntry[] {
  const entries = fs.readdirSync(absDir, { withFileTypes: true })
  const files = entries.filter((entry) => entry.isFile() && isRouteFile(entry.name))
  const dirs = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
  const indexFile = files.find((file) => baseName(file.name) === 'index')
  const routeFiles = files.filter((file) => !['layout', 'index'].includes(baseName(file.name)))
  const result: RouteConfigEntry[] = []

  if (indexFile) {
    result.push(index(`${filePrefix}/${indexFile.name}`))
  }

  for (const file of routeFiles) {
    result.push(route(fileToSegment(file.name), `${filePrefix}/${file.name}`))
  }

  for (const dir of dirs) {
    const subAbsDir = path.join(absDir, dir.name)
    const subFilePrefix = `${filePrefix}/${dir.name}`
    const subChildren = buildRoutes(subAbsDir, subFilePrefix)

    if (subChildren.length === 0) continue

    const subEntries = fs.readdirSync(subAbsDir, { withFileTypes: true })
    const layoutEntry = subEntries.find(
      (entry) => entry.isFile() && baseName(entry.name) === 'layout' && ROUTE_EXTENSIONS.has(path.extname(entry.name))
    )
    const layoutPath = layoutEntry ? `${subFilePrefix}/${layoutEntry.name}` : undefined
    const isPathless = dir.name.startsWith('_')

    if (isPathless) {
      result.push(...(layoutPath ? [layout(layoutPath, subChildren)] : subChildren))
    } else {
      const segment = dirToSegment(dir.name)
      if (layoutPath) {
        result.push(route(segment, layoutPath, subChildren))
      } else {
        result.push(...prefix(segment, subChildren))
      }
    }
  }

  return result
}

export function nestedRoutes(options: NestedRoutesOptions = {}): RouteConfigEntry[] {
  const { rootDirectory = 'pages' } = options
  const appDir = path.resolve(process.cwd(), 'app')
  const pagesDir = path.join(appDir, rootDirectory)

  return buildRoutes(pagesDir, rootDirectory)
}
