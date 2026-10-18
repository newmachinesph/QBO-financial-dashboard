import { sql } from 'drizzle-orm';
import { db } from '@/db';

// neon-http returns { rows }; normalize to a plain array.
async function rows<T = Record<string, unknown>>(q: ReturnType<typeof sql>): Promise<T[]> {
  const res = (await db.execute(q)) as unknown as { rows?: T[] } | T[];
  return Array.isArray(res) ? res : (res.rows ?? []);
}

export type Totals = {
  invoiced: number;
  outstanding: number;
  overdue: number;
  count: number;
};

export type MonthPoint = { month: string; revenue: number };
export type AgingBucket = { bucket: string; amount: number };
export type StatusSlice = { status: string; total: number; n: number };

export async function getTotals(): Promise<Totals> {
  const [r] = await rows<Totals>(sql`
    select
      coalesce(sum(total), 0)::float8      as invoiced,
      coalesce(sum(balance), 0)::float8    as outstanding,
      coalesce(sum(case when balance > 0 and due_date < current_date then balance else 0 end), 0)::float8 as overdue,
      count(*)::int                        as count
    from invoices
  `);
  return r ?? { invoiced: 0, outstanding: 0, overdue: 0, count: 0 };
}

export async function getRevenueByMonth(): Promise<MonthPoint[]> {
  return rows<MonthPoint>(sql`
    select to_char(txn_date, 'YYYY-MM') as month, sum(total)::float8 as revenue
    from invoices
    where txn_date is not null
    group by 1
    order by 1
  `);
}

// Aging buckets ordered by age. Only open balances.
const AGING_ORDER = ['Current', '1-30', '31-60', '61-90', '90+'];
export async function getAging(): Promise<AgingBucket[]> {
  const raw = await rows<AgingBucket>(sql`
    select
      case
        when due_date is null or due_date >= current_date then 'Current'
        when current_date - due_date <= 30 then '1-30'
        when current_date - due_date <= 60 then '31-60'
        when current_date - due_date <= 90 then '61-90'
        else '90+'
      end as bucket,
      sum(balance)::float8 as amount
    from invoices
    where balance > 0
    group by 1
  `);
  const byBucket = new Map(raw.map((r) => [r.bucket, Number(r.amount)]));
  return AGING_ORDER.map((bucket) => ({ bucket, amount: byBucket.get(bucket) ?? 0 }));
}

export async function getStatusSplit(): Promise<StatusSlice[]> {
  return rows<StatusSlice>(sql`
    select
      case when balance > 0 then 'Open' else 'Paid' end as status,
      sum(total)::float8 as total,
      count(*)::int      as n
    from invoices
    group by 1
  `);
}

// Accounts payable — mirror of getTotals over bills.
export async function getPayables(): Promise<Totals> {
  const [r] = await rows<Totals>(sql`
    select
      coalesce(sum(total), 0)::float8      as invoiced,
      coalesce(sum(balance), 0)::float8    as outstanding,
      coalesce(sum(case when balance > 0 and due_date < current_date then balance else 0 end), 0)::float8 as overdue,
      count(*)::int                        as count
    from bills
  `);
  return r ?? { invoiced: 0, outstanding: 0, overdue: 0, count: 0 };
}

// AP aging — mirror of getAging over bills.
export async function getApAging(): Promise<AgingBucket[]> {
  const raw = await rows<AgingBucket>(sql`
    select
      case
        when due_date is null or due_date >= current_date then 'Current'
        when current_date - due_date <= 30 then '1-30'
        when current_date - due_date <= 60 then '31-60'
        when current_date - due_date <= 90 then '61-90'
        else '90+'
      end as bucket,
      sum(balance)::float8 as amount
    from bills
    where balance > 0
    group by 1
  `);
  const byBucket = new Map(raw.map((r) => [r.bucket, Number(r.amount)]));
  return AGING_ORDER.map((bucket) => ({ bucket, amount: byBucket.get(bucket) ?? 0 }));
}
