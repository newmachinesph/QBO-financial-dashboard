import { eq } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { invoices, bills, customers, vendors, qboConnection } from '@/db/schema';
import { qboQuery } from './qbo';

const PAGE = 1000; // QBO max page size

const lastUpdated = (r: any) =>
  r.MetaData?.LastUpdatedTime ? new Date(r.MetaData.LastUpdatedTime) : null;

function mapInvoice(inv: any) {
  return {
    qboId: String(inv.Id),
    txnDate: inv.TxnDate ?? null,
    customerId: inv.CustomerRef?.value ?? null,
    total: inv.TotalAmt != null ? String(inv.TotalAmt) : null,
    balance: inv.Balance != null ? String(inv.Balance) : null,
    dueDate: inv.DueDate ?? null,
    updatedAt: lastUpdated(inv),
    raw: inv,
  };
}

function mapBill(b: any) {
  return {
    qboId: String(b.Id),
    txnDate: b.TxnDate ?? null,
    vendorId: b.VendorRef?.value ?? null,
    total: b.TotalAmt != null ? String(b.TotalAmt) : null,
    balance: b.Balance != null ? String(b.Balance) : null,
    dueDate: b.DueDate ?? null,
    updatedAt: lastUpdated(b),
    raw: b,
  };
}

function mapName(r: any) {
  return {
    qboId: String(r.Id),
    displayName: r.DisplayName ?? null,
    active: r.Active ?? null,
    updatedAt: lastUpdated(r),
    raw: r,
  };
}

// One QBO entity: incremental pull by last-modified, paginate until a short page, upsert each row.
// ponytail: one upsert per row — plenty for daily volume. Batch if a full history reload drags.
async function syncEntity(
  entity: string,
  table: PgTable & { qboId: any },
  map: (r: any) => Record<string, unknown>,
  since?: string,
): Promise<number> {
  const where = since ? ` WHERE Metadata.LastUpdatedTime > '${since}'` : '';
  let pos = 1;
  let total = 0;
  for (;;) {
    const rows = await qboQuery<any>(
      `SELECT * FROM ${entity}${where} STARTPOSITION ${pos} MAXRESULTS ${PAGE}`,
    );
    if (rows.length === 0) break;
    for (const r of rows) {
      const values = map(r);
      await db.insert(table).values(values).onConflictDoUpdate({ target: table.qboId, set: values });
    }
    total += rows.length;
    if (rows.length < PAGE) break;
    pos += PAGE;
  }
  return total;
}

// One sync run: pull everything changed since the watermark, then advance it.
// Watermark is set to run-start so rows changed mid-sync are caught next time.
export async function runSync() {
  const [conn] = await db.select().from(qboConnection).limit(1);
  if (!conn) throw new Error('No QBO connection. Visit /api/qbo/connect first.');

  const startedAt = new Date();
  const since = conn.lastSyncAt?.toISOString();

  // Names first so joins resolve; QBO has no cross-entity FK ordering requirement, but it reads cleaner.
  const counts = {
    customers: await syncEntity('Customer', customers, mapName, since),
    vendors: await syncEntity('Vendor', vendors, mapName, since),
    invoices: await syncEntity('Invoice', invoices, mapInvoice, since),
    bills: await syncEntity('Bill', bills, mapBill, since),
  };

  await db
    .update(qboConnection)
    .set({ lastSyncAt: startedAt })
    .where(eq(qboConnection.realmId, conn.realmId));

  return { count: Object.values(counts).reduce((a, b) => a + b, 0), counts };
}
