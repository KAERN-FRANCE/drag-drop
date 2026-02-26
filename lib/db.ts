/**
 * Connexion Drizzle ORM → Railway PostgreSQL
 * Remplace le client Supabase pour les requêtes base de données.
 */
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

// Pool de connexions PostgreSQL (Railway)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
})

export const db = drizzle(pool, { schema })

export type DB = typeof db
