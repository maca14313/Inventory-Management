/**
 * Prisma-compatible client shim over better-sqlite3.
 *
 * The domain layer (db.ts), permissions.ts, attachments.ts and all API routes
 * keep using the exact same call shapes they used with Prisma:
 *
 *   prisma.user.findMany({ where, include, orderBy, take, skip })
 *   prisma.stock.update({ where: { id }, data: { quantity: { increment: 2 } } })
 *   prisma.userPermission.upsert({ where: { userId_ability: {...} }, create, update })
 *   prisma.$transaction(async (tx) => { ... })
 *
 * Storage conventions are IDENTICAL to what Prisma's SQLite connector produced:
 *   - table & column names = model & field names (PascalCase tables)
 *   - BOOLEAN  → INTEGER 0/1
 *   - DATETIME → INTEGER epoch milliseconds
 * so an existing Prisma-created database file keeps working unchanged.
 *
 * NO Prisma code or packages are used anywhere (hard requirement).
 */

import { prepare as dbPrepare, MODELS, type ModelDef, type FieldDef, type RelationDef } from './sqlite'

// ─── Errors ─────────────────────────────────────────────────

export class PrismaError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

// ─── Value conversion ───────────────────────────────────────

function toDb(field: FieldDef, value: unknown): unknown {
  if (value === undefined) return undefined
  if (value === null) return null
  switch (field.type) {
    case 'bool':
      return value ? 1 : 0
    case 'datetime':
      if (value instanceof Date) return value.getTime()
      if (typeof value === 'number') return value
      if (typeof value === 'string') {
        const t = Date.parse(value)
        return Number.isNaN(t) ? null : t
      }
      return null
    case 'int':
    case 'float':
    case 'string':
      return value
  }
}

function fromDb(field: FieldDef, value: unknown): unknown {
  if (value === null || value === undefined) return null
  switch (field.type) {
    case 'bool':
      return value === 1 || value === true
    case 'datetime': {
      if (typeof value === 'number') return new Date(value)
      if (typeof value === 'string') {
        const t = Date.parse(value)
        return Number.isNaN(t) ? null : new Date(t)
      }
      return value
    }
    default:
      return value
  }
}

function getModel(name: string): ModelDef {
  const m = MODELS[name]
  if (!m) throw new PrismaError('P2021', `Model "${name}" is not defined in the SQLite schema`)
  return m
}

// ─── WHERE compiler ─────────────────────────────────────────

interface Compiled { sql: string; params: unknown[] }

function compileCondition(model: string, field: string, cond: unknown, out: Compiled): void {
  const def = getModel(model)
  const f = def.fields[field]
  const col = `"${field}"`

  // Relation filters: { some: {...} }, { every: {...} } (every approximated as some+count check is
  // not used in this codebase — only `some` is; every/none throw for clarity).
  if (!f) {
    const rel = def.relations[field]
    if (rel && cond && typeof cond === 'object' && !Array.isArray(cond)) {
      const c = cond as Record<string, unknown>
      if ('some' in c) {
        const sub = compileWhere(rel.relatedModel!, c.some as Record<string, unknown>)
        if (rel.kind === 'toMany') {
          out.sql += ` EXISTS (SELECT 1 FROM "${rel.relatedModel}" AS _sub WHERE _sub."${rel.relatedFk}" = "${model}"."id" AND ${sub.sql})`
          out.params.push(...sub.params)
        } else {
          const sub2 = compileWhere(rel.relatedModel!, c.some as Record<string, unknown>)
          out.sql += ` EXISTS (SELECT 1 FROM "${rel.relatedModel}" AS _sub WHERE _sub."id" = "${model}"."${rel.fk}" AND ${sub2.sql})`
          out.params.push(...sub2.params)
        }
        return
      }
      if ('none' in c) {
        const sub = compileWhere(rel.relatedModel!, c.none as Record<string, unknown>)
        if (rel.kind === 'toMany') {
          out.sql += ` NOT EXISTS (SELECT 1 FROM "${rel.relatedModel}" AS _sub WHERE _sub."${rel.relatedFk}" = "${model}"."id" AND ${sub.sql})`
        } else {
          out.sql += ` NOT EXISTS (SELECT 1 FROM "${rel.relatedModel}" AS _sub WHERE _sub."id" = "${model}"."${rel.fk}" AND ${sub.sql})`
        }
        out.params.push(...sub.params)
        return
      }
      if ('every' in c) {
        const sub = compileWhere(rel.relatedModel!, c.every as Record<string, unknown>)
        if (rel.kind === 'toMany') {
          out.sql += ` (SELECT count(*) FROM "${rel.relatedModel}" AS _sub WHERE _sub."${rel.relatedFk}" = "${model}"."id") = 0 OR (SELECT count(*) FROM "${rel.relatedModel}" AS _sub WHERE _sub."${rel.relatedFk}" = "${model}"."id" AND NOT (${sub.sql})) = 0`
        } else {
          out.sql += ` 1=1`
        }
        out.params.push(...sub.params)
        out.params.push(...sub.params)
        return
      }
      if ('is' in c) {
        // explicit to-one filter: { relation: { is: {...} } }
        const sub = compileWhere(rel.relatedModel!, (c.is as Record<string, unknown>) ?? {})
        if (rel.kind === 'toOne') {
          out.sql += ` EXISTS (SELECT 1 FROM "${rel.relatedModel}" AS _sub WHERE _sub."id" = "${model}"."${rel.fk}" AND ${sub.sql})`
        } else {
          out.sql += ` EXISTS (SELECT 1 FROM "${rel.relatedModel}" AS _sub WHERE _sub."${rel.relatedFk}" = "${model}"."id" AND ${sub.sql})`
        }
        out.params.push(...sub.params)
        return
      }
      // Plain object on a relation → Prisma's IMPLIED filter:
      //   toOne:  { attachment: { branchId: 5 } }  → related row matches sub-where
      //   toMany: { relation: { ... } } is invalid in Prisma (needs some/every/none)
      if (rel.kind === 'toOne') {
        const sub = compileWhere(rel.relatedModel!, c)
        out.sql += ` EXISTS (SELECT 1 FROM "${rel.relatedModel}" AS _sub WHERE _sub."id" = "${model}"."${rel.fk}" AND ${sub.sql})`
        out.params.push(...sub.params)
        return
      }
    }
    throw new PrismaError('P2009', `Unknown field "${field}" on model "${model}"`)
  }

  // Direct value (equality / null)
  if (cond === null || typeof cond !== 'object' || cond instanceof Date) {
    if (cond === null) { out.sql += `${col} IS NULL`; return }
    if (cond instanceof Date) { out.sql += `${col} = ?`; out.params.push(toDb(f, cond)); return }
    out.sql += `${col} = ?`; out.params.push(toDb(f, cond)); return
  }

  const c = cond as Record<string, unknown>
  const ops = Object.keys(c)
  const parts: string[] = []
  const params: unknown[] = []

  for (const op of ops) {
    switch (op) {
      case 'equals': {
        if (c[op] === null) parts.push(`${col} IS NULL`)
        else { parts.push(`${col} = ?`); params.push(toDb(f, c[op])) }
        break
      }
      case 'in': {
        const arr = (c[op] as unknown[]) ?? []
        if (arr.length === 0) { parts.push('1=0'); break }
        const hasNull = arr.includes(null)
        const nonNull = arr.filter(v => v !== null)
        if (nonNull.length === 0) parts.push(`${col} IS NULL`)
        else {
          parts.push(`${col} IN (${nonNull.map(() => '?').join(', ')})${hasNull ? ` OR ${col} IS NULL` : ''}`)
          for (const v of nonNull) params.push(toDb(f, v))
        }
        break
      }
      case 'notIn': {
        const arr = (c[op] as unknown[]) ?? []
        if (arr.length === 0) break
        const hasNull = arr.includes(null)
        const nonNull = arr.filter(v => v !== null)
        if (nonNull.length > 0) {
          parts.push(`${col} NOT IN (${nonNull.map(() => '?').join(', ')})`)
          for (const v of nonNull) params.push(toDb(f, v))
        }
        if (hasNull) parts.push(`${col} IS NOT NULL`)
        break
      }
      case 'contains': {
        // Prisma SQLite `contains` is case-SENSITIVE → instr() (not LIKE).
        parts.push(`instr(CAST(${col} AS TEXT), CAST(? AS TEXT)) > 0`)
        params.push(String(c[op]))
        break
      }
      case 'containsInsensitive': {
        parts.push(`lower(CAST(${col} AS TEXT)) LIKE lower(CAST('%' || ? || '%' AS TEXT))`)
        params.push(String(c[op]))
        break
      }
      case 'startsWith': {
        parts.push(`${col} LIKE ?`)
        params.push(`${String(c[op])}%`)
        break
      }
      case 'endsWith': {
        parts.push(`${col} LIKE ?`)
        params.push(`%${String(c[op])}`)
        break
      }
      case 'gt': case 'gte': case 'lt': case 'lte': {
        const sym = { gt: '>', gte: '>=', lt: '<', lte: '<=' }[op]
        parts.push(`${col} ${sym} ?`)
        params.push(toDb(f, c[op]))
        break
      }
      case 'not': {
        const v = c[op]
        if (v === null) parts.push(`${col} IS NOT NULL`)
        else if (typeof v === 'object' && !(v instanceof Date)) {
          const sub = compileCondition(model, field, v, { sql: '', params: [] })
          parts.push(`NOT (${sub.sql})`)
          for (let i = 0; i < sub.params.length; i++) params.push(undefined) // placeholder consumed below
          params.length -= sub.params.length
          params.push(...sub.params)
        } else { parts.push(`${col} <> ?`); params.push(toDb(f, v)) }
        break
      }
      case 'isSet': {
        parts.push(c[op] ? `${col} IS NOT NULL` : `${col} IS NULL`)
        break
      }
      case 'mode':
        break // handled by contains choice above (default sensitive)
      default:
        throw new PrismaError('P2009', `Unsupported operator "${op}" on ${model}.${field}`)
    }
  }
  out.sql += parts.length ? `(${parts.join(' AND ')})` : '1=1'
  out.params.push(...params)
}

export function compileWhere(model: string, where?: Record<string, unknown>): Compiled {
  if (!where || Object.keys(where).length === 0) return { sql: '1=1', params: [] }
  const parts: string[] = []
  const params: unknown[] = []
  for (const [key, value] of Object.entries(where)) {
    if (key === 'AND' || key === 'OR' || key === 'NOT') {
      const subCompiled = (value as Record<string, unknown>[]).map(sub => compileWhere(model, sub))
      if (key === 'AND') {
        if (subCompiled.length === 0) continue
        parts.push(`(${subCompiled.map(s => s.sql).join(' AND ')})`)
        for (const s of subCompiled) params.push(...s.params)
      } else if (key === 'OR') {
        if (subCompiled.length === 0) { parts.push('1=1'); continue }
        parts.push(`(${subCompiled.map(s => s.sql).join(' OR ')})`)
        for (const s of subCompiled) params.push(...s.params)
      } else {
        if (subCompiled.length === 0) continue
        parts.push(`NOT (${subCompiled.map(s => s.sql).join(' AND ')})`)
        for (const s of subCompiled) params.push(...s.params)
      }
      continue
    }
    const out: Compiled = { sql: '', params: [] }
    compileCondition(model, key, value, out)
    if (out.sql) { parts.push(out.sql); params.push(...out.params) }
  }
  return { sql: parts.length ? parts.join(' AND ') : '1=1', params }
}

// ─── Row mapping / shaping ──────────────────────────────────

function mapRow(model: string, row: Record<string, unknown>): Record<string, unknown> {
  const def = getModel(model)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    const f = def.fields[k]
    out[k] = f ? fromDb(f, v) : v
  }
  return out
}

type Shape = Record<string, unknown>

function applyShape(model: string, row: Record<string, unknown>, select?: Shape, include?: Shape, depth = 0): Record<string, unknown> {
  const def = getModel(model)
  let result = row

  // scalar select
  if (select) {
    const picked: Record<string, unknown> = {}
    for (const key of Object.keys(select)) {
      if (row[key] !== undefined) picked[key] = row[key]
    }
    result = picked
  }

  const relations = select ?? include
  if (!relations || depth > 6) return result

  for (const [relName, relSpec] of Object.entries(relations as Shape)) {
    const rel = def.relations[relName]
    if (!rel) continue
    const spec = (relSpec && typeof relSpec === 'object') ? relSpec as Shape : undefined
    const nestedSelect = spec?.select as Shape | undefined
    const nestedInclude = spec?.include as Shape | undefined
    if (rel.kind === 'toOne' && rel.relatedModel) {
      const fkVal = row[rel.fk!]
      if (fkVal === null || fkVal === undefined) {
        result[relName] = null
      } else {
        const related = dbPrepare(`SELECT * FROM "${rel.relatedModel}" WHERE "id" = ?`).get(fkVal) as Record<string, unknown> | undefined
        result[relName] = related
          ? applyShape(rel.relatedModel, mapRow(rel.relatedModel, related), nestedSelect, nestedInclude, depth + 1)
          : null
      }
    } else if (rel.kind === 'ToMany' && rel.relatedModel) {
      const rows = dbPrepare(`SELECT * FROM "${rel.relatedModel}" WHERE "${rel.relatedFk}" = ? ORDER BY "id" ASC`).all(row.id) as Record<string, unknown>[]
      result[relName] = rows.map(r => applyShape(rel.relatedModel, mapRow(rel.relatedModel, r), nestedSelect, nestedInclude, depth + 1))
    }
  }
  return result
}

// ─── Model client ───────────────────────────────────────────

interface FindArgs {
  where?: Record<string, unknown>
  select?: Shape
  include?: Shape
  orderBy?: Record<string, 'asc' | 'desc'> | Array<Record<string, 'asc' | 'desc'>>
  skip?: number
  take?: number
  distinct?: string[]
}
interface CreateArgs { data: Record<string, unknown>; select?: Shape; include?: Shape }
interface UpdateArgs { where: Record<string, unknown>; data: Record<string, unknown>; select?: Shape; include?: Shape }
interface DeleteArgs { where: Record<string, unknown>; select?: Shape }
interface UpsertArgs { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown>; select?: Shape; include?: Shape }
interface CountArgs { where?: Record<string, unknown> }
interface GroupByArgs { by: string[]; where?: Record<string, unknown>; _count?: Record<string, boolean>; _sum?: Record<string, boolean> }
interface CreateManyArgs { data: Record<string, unknown>[]; skipDuplicates?: boolean }
interface UpdateManyArgs { where: Record<string, unknown>; data: Record<string, unknown> }

function uniqueWhereToFind(model: string, where: Record<string, unknown>): Record<string, unknown> {
  const def = getModel(model)
  const keys = Object.keys(where)
  if (keys.length === 1) {
    const k = keys[0]
    const v = where[k]
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      // compound unique like userId_ability: { userId, ability }
      return { ...(v as Record<string, unknown>) }
    }
    return { [k]: v }
  }
  // multiple plain fields → treat as AND
  return { ...where }
}

function orderClause(model: string, orderBy?: FindArgs['orderBy']): string {
  if (!orderBy) return ''
  const arr = Array.isArray(orderBy) ? orderBy : [orderBy]
  const def = getModel(model)
  const clauses = arr
    .map(ob => Object.entries(ob).map(([f, dir]) => (def.fields[f] ? `"${f}" ${dir === 'desc' ? 'DESC' : 'ASC'}` : '')).filter(Boolean))
    .flat()
  return clauses.length ? ` ORDER BY ${clauses.join(', ')}` : ''
}

function buildData(model: string, data: Record<string, unknown>): { cols: string[]; vals: unknown[] } {
  const def = getModel(model)
  const cols: string[] = []
  const vals: unknown[] = []
  const now = Date.now()
  for (const [k, v] of Object.entries(data)) {
    const f = def.fields[k]
    if (!f || v === undefined) continue
    cols.push(`"${k}"`)
    vals.push(toDb(f, v))
  }
  return { cols, vals }
}

function makeModelClient(model: string) {
  const def = getModel(model)

  function findRows(args: FindArgs): { rows: Record<string, unknown>[]; whereSql: string } {
    const w = compileWhere(model, args.where)
    const order = orderClause(model, args.orderBy)
    const limit = args.take !== undefined ? ` LIMIT ${Math.max(0, args.take)}` : ''
    const offset = args.skip !== undefined ? ` OFFSET ${Math.max(0, args.skip)}` : ''
    const rows = dbPrepare(`SELECT * FROM "${model}" WHERE ${w.sql}${order}${limit}${offset}`).all(...w.params) as Record<string, unknown>[]
    return { rows, whereSql: w.sql }
  }

  function applyDistinct(rows: Record<string, unknown>[], distinct?: string[]): Record<string, unknown>[] {
    if (!distinct || distinct.length === 0) return rows
    const seen = new Set<string>()
    const out: Record<string, unknown>[] = []
    for (const r of rows) {
      const key = distinct.map(d => String(r[d])).join('\u0000')
      if (!seen.has(key)) { seen.add(key); out.push(r) }
    }
    return out
  }

  return {
    findUnique: (args: { where: Record<string, unknown>; select?: Shape; include?: Shape }) => {
      const findWhere = uniqueWhereToFind(model, args.where)
      const w = compileWhere(model, findWhere)
      const row = dbPrepare(`SELECT * FROM "${model}" WHERE ${w.sql} LIMIT 1`).get(...w.params) as Record<string, unknown> | undefined
      if (!row) return null
      return applyShape(model, mapRow(model, row), args.select, args.include)
    },
    findFirst: (args: FindArgs = {}) => {
      const { rows } = findRows({ ...args, take: 1 })
      if (rows.length === 0) return null
      return applyShape(model, mapRow(model, rows[0]), args.select, args.include)
    },
    findMany: (args: FindArgs = {}) => {
      const { rows } = findRows(args)
      return applyDistinct(rows, args.distinct).map(r => applyShape(model, mapRow(model, r), args.select, args.include))
    },
    create: (args: CreateArgs) => {
      const { cols, vals } = buildData(model, args.data)
      const now = Date.now()
      if (def.fields.updatedAt && !cols.includes('"updatedAt"')) { cols.push('"updatedAt"'); vals.push(now) }
      if (def.fields.createdAt && !cols.includes('"createdAt"')) { cols.push('"createdAt"'); vals.push(now) }
      // fill remaining defaults (Prisma client-side defaults)
      for (const [fname, fdef] of Object.entries(def.fields)) {
        if (fname === 'id') continue
        if (cols.includes(`"${fname}"`)) continue
        if (fdef.default !== undefined) { cols.push(`"${fname}"`); vals.push(toDb(fdef, fdef.default)) }
      }
      const ph = cols.map(() => '?').join(', ')
      const sql = `INSERT INTO "${model}" (${cols.join(', ')}) VALUES (${ph})`
      const info = dbPrepare(sql).run(...vals)
      const id = info.lastInsertRowid as number
      const row = dbPrepare(`SELECT * FROM "${model}" WHERE "id" = ?`).get(id) as Record<string, unknown>
      return applyShape(model, mapRow(model, row), args.select, args.include)
    },
    createMany: (args: CreateManyArgs) => {
      let n = 0
      runInTransaction(() => {
        for (const d of args.data) {
          const { cols, vals } = buildData(model, d)
          const now = Date.now()
          if (def.fields.updatedAt && !cols.includes('"updatedAt"')) { cols.push('"updatedAt"'); vals.push(now) }
          if (def.fields.createdAt && !cols.includes('"createdAt"')) { cols.push('"createdAt"'); vals.push(now) }
          for (const [fname, fdef] of Object.entries(def.fields)) {
            if (fname === 'id') continue
            if (cols.includes(`"${fname}"`)) continue
            if (fdef.default !== undefined) { cols.push(`"${fname}"`); vals.push(toDb(fdef, fdef.default)) }
          }
          const ph = cols.map(() => '?').join(', ')
          try {
            dbPrepare(`INSERT ${args.skipDuplicates ? 'OR IGNORE' : ''} INTO "${model}" (${cols.join(', ')}) VALUES (${ph})`).run(...vals)
            n++
          } catch (err) {
            if (args.skipDuplicates && err instanceof Error && /UNIQUE constraint/.test(err.message)) continue
            throw err
          }
        }
      })
      return { count: n }
    },
    update: (args: UpdateArgs) => {
      const findWhere = uniqueWhereToFind(model, args.where)
      const w = compileWhere(model, findWhere)
      const existing = dbPrepare(`SELECT * FROM "${model}" WHERE ${w.sql} LIMIT 1`).get(...w.params) as Record<string, unknown> | undefined
      if (!existing) throw new PrismaError('P2025', `An operation failed because it depends on one or more records that were required but not found (${model})`)
      const sets: string[] = []
      const params: unknown[] = []
      for (const [k, v] of Object.entries(args.data)) {
        const f = def.fields[k]
        if (!f || v === undefined) continue
        if (v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
          const op = Object.keys(v as Record<string, unknown>)[0]
          const amount = (v as Record<string, number>)[op]
          if (op === 'increment') { sets.push(`"${k}" = "${k}" + ?`); params.push(amount); continue }
          if (op === 'decrement') { sets.push(`"${k}" = "${k}" - ?`); params.push(amount); continue }
          if (op === 'multiply') { sets.push(`"${k}" = "${k}" * ?`); params.push(amount); continue }
          if (op === 'set') { sets.push(`"${k}" = ?`); params.push(toDb(f, (v as Record<string, unknown>).set)); continue }
        }
        sets.push(`"${k}" = ?`)
        params.push(toDb(f, v))
      }
      if (def.fields.updatedAt) { sets.push('"updatedAt" = ?'); params.push(Date.now()) }
      params.push(existing.id)
      dbPrepare(`UPDATE "${model}" SET ${sets.join(', ')} WHERE "id" = ?`).run(...params)
      const row = dbPrepare(`SELECT * FROM "${model}" WHERE "id" = ?`).get(existing.id) as Record<string, unknown>
      return applyShape(model, mapRow(model, row), args.select, args.include)
    },
    updateMany: (args: UpdateManyArgs) => {
      const w = compileWhere(model, args.where)
      const sets: string[] = []
      const params: unknown[] = []
      for (const [k, v] of Object.entries(args.data)) {
        const f = def.fields[k]
        if (!f || v === undefined) continue
        if (v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
          const op = Object.keys(v as Record<string, unknown>)[0]
          const amount = (v as Record<string, number>)[op]
          if (op === 'increment') { sets.push(`"${k}" = "${k}" + ?`); params.push(amount); continue }
          if (op === 'decrement') { sets.push(`"${k}" = "${k}" - ?`); params.push(amount); continue }
        }
        sets.push(`"${k}" = ?`)
        params.push(toDb(f, v))
      }
      if (def.fields.updatedAt) { sets.push('"updatedAt" = ?'); params.push(Date.now()) }
      const info = dbPrepare(`UPDATE "${model}" SET ${sets.join(', ')} WHERE ${w.sql}`).run(...params, ...w.params)
      return { count: info.changes }
    },
    delete: (args: DeleteArgs) => {
      const findWhere = uniqueWhereToFind(model, args.where)
      const w = compileWhere(model, findWhere)
      const existing = dbPrepare(`SELECT * FROM "${model}" WHERE ${w.sql} LIMIT 1`).get(...w.params) as Record<string, unknown> | undefined
      if (!existing) throw new PrismaError('P2025', `An operation failed because it depends on one or more records that were required but not found (${model})`)
      dbPrepare(`DELETE FROM "${model}" WHERE "id" = ?`).run(existing.id)
      return mapRow(model, existing)
    },
    deleteMany: (args: { where?: Record<string, unknown> } = {}) => {
      const w = compileWhere(model, args.where)
      const info = dbPrepare(`DELETE FROM "${model}" WHERE ${w.sql}`).run(...w.params)
      return { count: info.changes }
    },
    upsert: (args: UpsertArgs) => {
      const findWhere = uniqueWhereToFind(model, args.where)
      const w = compileWhere(model, findWhere)
      const existing = dbPrepare(`SELECT * FROM "${model}" WHERE ${w.sql} LIMIT 1`).get(...w.params) as Record<string, unknown> | undefined
      if (existing) {
        return makeModelClient(model).update({ where: { id: existing.id }, data: args.update, select: args.select, include: args.include })
      }
      return makeModelClient(model).create({ data: args.create, select: args.select, include: args.include })
    },
    count: (args: CountArgs = {}) => {
      const w = compileWhere(model, args.where)
      const row = dbPrepare(`SELECT count(*) AS c FROM "${model}" WHERE ${w.sql}`).get(...w.params) as { c: number }
      return row.c
    },
    groupBy: (args: GroupByArgs) => {
      const w = compileWhere(model, args.where)
      const byCols = args.by.map(b => `"${b}"`).join(', ')
      const countCols = args._count ? Object.keys(args._count).map(c => `count("${c}") AS "_count_${c}"`).join(', ') : ''
      const sql = `SELECT ${byCols}${countCols ? ', ' + countCols : ''} FROM "${model}" WHERE ${w.sql} GROUP BY ${byCols}`
      const rows = dbPrepare(sql).all(...w.params) as Record<string, unknown>[]
      return rows.map(r => {
        const out: Record<string, unknown> = {}
        for (const b of args.by) {
          const f = def.fields[b]
          out[b] = f ? fromDb(f, r[b]) : r[b]
        }
        if (args._count) {
          const cnt: Record<string, number> = {}
          for (const c of Object.keys(args._count)) cnt[c] = (r[`_count_${c}`] as number) ?? 0
          out._count = cnt
        }
        return out
      })
    },
    aggregate: (args: { where?: Record<string, unknown>; _sum?: Record<string, boolean>; _avg?: Record<string, boolean>; _min?: Record<string, boolean>; _max?: Record<string, boolean>; _count?: boolean | Record<string, boolean> }) => {
      const w = compileWhere(model, args.where)
      const sel: string[] = []
      const map: Record<string, string> = {}
      if (args._sum) for (const f of Object.keys(args._sum)) { sel.push(`sum("${f}") AS "sum_${f}"`); map[f] = 'sum' }
      if (args._avg) for (const f of Object.keys(args._avg)) { sel.push(`avg("${f}") AS "avg_${f}"`); map[f] = 'avg' }
      if (args._min) for (const f of Object.keys(args._min)) { sel.push(`min("${f}") AS "min_${f}"`); map[f] = 'min' }
      if (args._max) for (const f of Object.keys(args._max)) { sel.push(`max("${f}") AS "max_${f}"`); map[f] = 'max' }
      if (args._count) sel.push(`count(*) AS "count_all"`)
      const row = dbPrepare(`SELECT ${sel.join(', ')} FROM "${model}" WHERE ${w.sql}`).get(...w.params) as Record<string, unknown>
      const out: Record<string, unknown> = {}
      for (const prefix of ['sum', 'avg', 'min', 'max']) {
        const key = `_${prefix}` as '_sum' | '_avg' | '_min' | '_max'
        const wanted = args[key]
        if (wanted) {
          out[key] = {}
          for (const f of Object.keys(wanted)) (out[key] as Record<string, unknown>)[f] = row[`${prefix}_${f}`] ?? null
        }
      }
      if (args._count) out._count = typeof args._count === 'object' ? { all: row.count_all } : row.count_all
      return out
    },
  }
}

// ─── Validate relation metadata at load time ────────────────
// All toOne relations declare an explicit relatedModel in sqlite.ts — verify.
for (const [modelName, mdef] of Object.entries(MODELS)) {
  for (const [relName, rel] of Object.entries(mdef.relations)) {
    if (rel.kind === 'toOne' && !rel.relatedModel) {
      throw new Error(`SQLite schema: toOne relation ${modelName}.${relName} is missing relatedModel`)
    }
    if (rel.kind === 'toMany' && !rel.relatedModel) {
      throw new Error(`SQLite schema: toMany relation ${modelName}.${relName} is missing relatedModel`)
    }
  }
}

// ─── Serialization lock (prevents cross-request interleaving) ─

let lock: Promise<unknown> = Promise.resolve()
function serialize<T>(fn: () => T): Promise<T> {
  const p = lock.then(fn, fn) as Promise<T>
  lock = p.then(() => undefined, () => undefined)
  return p
}

/** Synchronous transaction via raw BEGIN/COMMIT (avoids better-sqlite3 native
 *  Transaction objects, which register cleanup hooks like statements). */
let txDepth = 0
function runInTransaction<T>(fn: () => T): T {
  if (txDepth > 0) return fn() // nested → already inside a transaction
  dbPrepare('BEGIN IMMEDIATE').run()
  txDepth++
  try {
    const result = fn()
    dbPrepare('COMMIT').run()
    return result
  } catch (err) {
    try { dbPrepare('ROLLBACK').run() } catch { /* already rolled back */ }
    throw err
  } finally {
    txDepth--
  }
}

// ─── The client ─────────────────────────────────────────────

function buildClient(direct: boolean): Record<string, unknown> {
  const client: Record<string, unknown> = {}
  for (const model of Object.keys(MODELS)) {
    const raw = makeModelClient(model)
    if (direct) {
      client[model.charAt(0).toLowerCase() + model.slice(1)] = raw
    } else {
      // wrap each method so it executes inside the global async lock
      const wrapped: Record<string, unknown> = {}
      for (const [method, fn] of Object.entries(raw)) {
        wrapped[method] = (...args: unknown[]) => serialize(() => (fn as (...a: unknown[]) => unknown)(...args))
      }
      client[model.charAt(0).toLowerCase() + model.slice(1)] = wrapped
    }
  }
  return client
}

const directClient = buildClient(true)
const lockedClient = buildClient(false)

export type SqliteClient = typeof lockedClient & {
  $transaction: <T>(fn: (tx: typeof directClient) => Promise<T>) => Promise<T>
  $disconnect: () => void
}

export const prisma = {
  ...(lockedClient as Record<string, unknown>),
  $transaction: (<T>(fn: (tx: typeof directClient) => Promise<T>): Promise<T> => {
    return serialize(async () => {
      dbPrepare('BEGIN IMMEDIATE').run()
      try {
        const result = await fn(directClient as unknown as typeof directClient)
        dbPrepare('COMMIT').run()
        return result
      } catch (err) {
        try { dbPrepare('ROLLBACK').run() } catch { /* already rolled back */ }
        throw err
      }
    })
  }) as SqliteClient['$transaction'],
  $disconnect: () => { /* connection is process-lifetime and shared via globalThis */ },
} as unknown as SqliteClient

export default prisma
