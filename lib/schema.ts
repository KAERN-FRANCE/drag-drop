/**
 * Schéma Drizzle ORM — Railway PostgreSQL
 *
 * Tables Better Auth  : user, session, account, verification
 * Tables métier       : companies, user_companies, drivers, analyses, infractions
 */
import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ══════════════════════════════════════════════════════
// TABLES BETTER AUTH (ne pas renommer)
// ══════════════════════════════════════════════════════

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ══════════════════════════════════════════════════════
// TABLES MÉTIER
// ══════════════════════════════════════════════════════

export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  siret: text('siret'),
  driverCount: text('driver_count'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const userCompanies = pgTable(
  'user_companies',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['admin', 'manager', 'driver'] }).notNull().default('driver'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [uniqueIndex('user_companies_user_company_idx').on(t.userId, t.companyId)]
)

export const drivers = pgTable('drivers', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  initials: text('initials').notNull(),
  email: text('email'),
  phone: text('phone'),
  score: integer('score').notNull().default(100),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const analyses = pgTable('analyses', {
  id: serial('id').primaryKey(),
  driverId: integer('driver_id').references(() => drivers.id, { onDelete: 'cascade' }),
  companyId: integer('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  uploadDate: timestamp('upload_date').defaultNow(),
  score: integer('score').notNull(),
  status: text('status', { enum: ['completed', 'processing', 'failed'] })
    .notNull()
    .default('completed'),
  createdAt: timestamp('created_at').defaultNow(),
})

export interface InfractionDetails {
  code?: string
  detail?: string
  valeur_constatee?: number
  limite_reglementaire?: number
  gravite?: string
  amende_min?: number
  amende_max?: number
  article_loi?: string
}

export const infractions = pgTable('infractions', {
  id: serial('id').primaryKey(),
  driverId: integer('driver_id').references(() => drivers.id, { onDelete: 'cascade' }),
  companyId: integer('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  analysisId: integer('analysis_id').references(() => analyses.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  severity: text('severity', { enum: ['low', 'medium', 'high', 'critical'] }).notNull(),
  date: date('date').notNull(),
  details: jsonb('details').$type<InfractionDetails>(),
  createdAt: timestamp('created_at').defaultNow(),
})

// ══════════════════════════════════════════════════════
// RELATIONS (pour les requêtes Drizzle avec .with())
// ══════════════════════════════════════════════════════

export const companyRelations = relations(companies, ({ many }) => ({
  userCompanies: many(userCompanies),
  drivers: many(drivers),
  analyses: many(analyses),
  infractions: many(infractions),
}))

export const userCompanyRelations = relations(userCompanies, ({ one }) => ({
  user: one(user, { fields: [userCompanies.userId], references: [user.id] }),
  company: one(companies, { fields: [userCompanies.companyId], references: [companies.id] }),
}))

export const driverRelations = relations(drivers, ({ one, many }) => ({
  company: one(companies, { fields: [drivers.companyId], references: [companies.id] }),
  analyses: many(analyses),
  infractions: many(infractions),
}))

export const analysisRelations = relations(analyses, ({ one, many }) => ({
  driver: one(drivers, { fields: [analyses.driverId], references: [drivers.id] }),
  company: one(companies, { fields: [analyses.companyId], references: [companies.id] }),
  infractions: many(infractions),
}))

export const infractionRelations = relations(infractions, ({ one }) => ({
  driver: one(drivers, { fields: [infractions.driverId], references: [drivers.id] }),
  analysis: one(analyses, { fields: [infractions.analysisId], references: [analyses.id] }),
}))

// Types inférés
export type User = typeof user.$inferSelect
export type Company = typeof companies.$inferSelect
export type UserCompany = typeof userCompanies.$inferSelect
export type Driver = typeof drivers.$inferSelect
export type Analysis = typeof analyses.$inferSelect
export type Infraction = typeof infractions.$inferSelect
