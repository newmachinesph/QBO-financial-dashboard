import { pgTable, text, numeric, date, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

// Single QBO company. Stores the OAuth tokens + sync watermark.
export const qboConnection = pgTable('qbo_connection', {
  realmId: text('realm_id').primaryKey(),
  refreshToken: text('refresh_token').notNull(), // AES-256-GCM encrypted, rotates each refresh
  accessToken: text('access_token'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Every entity table follows the same shape: typed columns for common queries + full raw jsonb.
export const invoices = pgTable('invoices', {
  qboId: text('qbo_id').primaryKey(),
  txnDate: date('txn_date'),
  customerId: text('customer_id'),
  total: numeric('total'),
  balance: numeric('balance'),
  dueDate: date('due_date'),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  raw: jsonb('raw').notNull(),
});

// Accounts payable — mirror of invoices.
export const bills = pgTable('bills', {
  qboId: text('qbo_id').primaryKey(),
  txnDate: date('txn_date'),
  vendorId: text('vendor_id'),
  total: numeric('total'),
  balance: numeric('balance'),
  dueDate: date('due_date'),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  raw: jsonb('raw').notNull(),
});

export const customers = pgTable('customers', {
  qboId: text('qbo_id').primaryKey(),
  displayName: text('display_name'),
  active: boolean('active'),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  raw: jsonb('raw').notNull(),
});

export const vendors = pgTable('vendors', {
  qboId: text('qbo_id').primaryKey(),
  displayName: text('display_name'),
  active: boolean('active'),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  raw: jsonb('raw').notNull(),
});
