/**
 * Client-safe shared constants (importable from both browser and server code).
 * Kept free of any server-only imports (no sqlite/prisma chain).
 */

export const MEASUREMENTS = [
  'piece', 'kg', 'g', 'liter', 'ml', 'box', 'pack', 'meter', 'cm', 'roll', 'bottle', 'carton',
] as const

export type Measurement = typeof MEASUREMENTS[number]
