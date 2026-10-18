import { count, desc } from 'drizzle-orm';
import { db } from '@/db';
import { qboConnection, invoices, bills, customers, vendors } from '@/db/schema';
import {
  getTotals,
  getRevenueByMonth,
  getAging,
  getStatusSplit,
  getPayables,
  getApAging,
} from '@/lib/metrics';
import { DashboardCharts } from '@/components/DashboardCharts';
import { syncNow } from './actions';

export const dynamic = 'force-dynamic';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = (v: string | number | null) => (v == null ? '—' : usd.format(Number(v)));
const when = (d: Date | null) =>
  d ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'never';

export default async function Home() {
  const [conn] = await db.select().from(qboConnection).limit(1);
  const connected = Boolean(conn);
  const [{ value: invCount }] = await db.select({ value: count() }).from(invoices);

  const [totals, revenue, aging, status, payables, apAging, recent, recentBills, custRows, vendRows] =
    connected
      ? await Promise.all([
          getTotals(),
          getRevenueByMonth(),
          getAging(),
          getStatusSplit(),
          getPayables(),
          getApAging(),
          db.select().from(invoices).orderBy(desc(invoices.txnDate)).limit(12),
          db.select().from(bills).orderBy(desc(bills.txnDate)).limit(12),
          db.select({ id: customers.qboId, name: customers.displayName }).from(customers),
          db.select({ id: vendors.qboId, name: vendors.displayName }).from(vendors),
        ])
      : [null, [], [], [], null, [], [], [], [], []];

  const customerName = new Map(custRows.map((c) => [c.id, c.name]));
  const vendorName = new Map(vendRows.map((v) => [v.id, v.name]));

  const collectionRate =
    totals && totals.invoiced > 0
      ? Math.round(((totals.invoiced - totals.outstanding) / totals.invoiced) * 100)
      : 0;

  return (
    <div className="flex min-h-screen w-full overflow-x-clip">
      <Sidebar env={process.env.QBO_ENV === 'production' ? 'Production' : 'Sandbox'} />

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {/* Topbar */}
        <header className="rise mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="eyebrow mb-1 block md:hidden">QBO Dashboard</span>
            <h1 className="text-2xl font-semibold tracking-tight lg:text-[28px]">Overview</h1>
            <p className="mt-0.5 text-sm text-[var(--ink-2)]">
              {connected ? (
                <>
                  Company <span className="font-mono text-[var(--ink-3)]">{conn.realmId}</span> · synced {when(conn.lastSyncAt)}
                </>
              ) : (
                'Connect a QuickBooks company to begin.'
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-1)] px-3 py-1.5 text-xs font-medium"
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? 'bg-[var(--good)]' : 'bg-[var(--ink-3)]'}`}
                style={connected ? { boxShadow: '0 0 8px var(--good)' } : undefined}
              />
              {connected ? 'Connected' : 'Offline'}
            </span>
            <a
              href="/api/qbo/connect"
              className="rounded-full border border-[var(--border)] px-4 py-1.5 text-xs font-medium text-[var(--ink-2)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--ink)]"
            >
              {connected ? 'Reconnect' : 'Connect QuickBooks'}
            </a>
            {connected && (
              <form action={syncNow}>
                <button
                  type="submit"
                  className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white transition-shadow hover:shadow-[0_0_20px_var(--accent-glow)]"
                >
                  Sync now
                </button>
              </form>
            )}
          </div>
        </header>

        {connected && totals ? (
          <>
            {/* KPI row */}
            <section className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
              <Kpi i={0} label="Total invoiced" value={money(totals.invoiced)} sub={`${totals.count} invoices`} />
              <Kpi i={1} label="Outstanding" value={money(totals.outstanding)} sub="awaiting payment" />
              <Kpi i={2} label="Overdue" value={money(totals.overdue)} sub="past due date" tone="danger" />
              <Kpi i={3} label="Collection rate" value={`${collectionRate}%`} sub="of invoiced collected" tone="good" />
            </section>

            {payables && payables.count > 0 && (
              <section className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
                <Kpi i={0} label="Total billed" value={money(payables.invoiced)} sub={`${payables.count} bills`} />
                <Kpi i={1} label="Payable" value={money(payables.outstanding)} sub="owed to vendors" />
                <Kpi i={2} label="Overdue payable" value={money(payables.overdue)} sub="past due date" tone="danger" />
                <Kpi
                  i={3}
                  label="Net position"
                  value={money(totals.outstanding - payables.outstanding)}
                  sub="receivable − payable"
                  tone={totals.outstanding - payables.outstanding >= 0 ? 'good' : 'danger'}
                />
              </section>
            )}

            {/* Bento charts */}
            <div className="rise" style={{ animationDelay: '120ms' }}>
              <DashboardCharts revenue={revenue} aging={aging} status={status} apAging={apAging} />
            </div>

            {/* Recent invoices */}
            <section id="invoices" className="rise mt-6" style={{ animationDelay: '200ms' }}>
              <div className="panel overflow-hidden">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
                  <h2 className="text-sm font-semibold">Recent invoices</h2>
                  <span className="eyebrow">Latest 12</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[var(--ink-3)]">
                        <th className="px-5 py-3 font-medium">Date</th>
                        <th className="px-5 py-3 font-medium">Invoice</th>
                        <th className="px-5 py-3 font-medium">Customer</th>
                        <th className="px-5 py-3 text-right font-medium">Total</th>
                        <th className="px-5 py-3 text-right font-medium">Balance</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((inv) => {
                        const open = Number(inv.balance ?? 0) > 0;
                        const overdue = open && inv.dueDate != null && new Date(inv.dueDate) < new Date();
                        return (
                          <tr
                            key={inv.qboId}
                            className="border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-1)]"
                          >
                            <td className="px-5 py-3 text-[var(--ink-2)]">{inv.txnDate ?? '—'}</td>
                            <td className="px-5 py-3 font-mono text-[var(--ink-3)]">#{inv.qboId}</td>
                            <td className="px-5 py-3 text-[var(--ink-2)]">{customerName.get(inv.customerId ?? '') ?? inv.customerId ?? '—'}</td>
                            <td className="px-5 py-3 text-right tabular-nums">{money(inv.total)}</td>
                            <td className="px-5 py-3 text-right tabular-nums">{money(inv.balance)}</td>
                            <td className="px-5 py-3">
                              <Badge tone={overdue ? 'danger' : open ? 'warn' : 'good'}>
                                {overdue ? 'Overdue' : open ? 'Open' : 'Paid'}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {recentBills.length > 0 && (
              <section id="bills" className="rise mt-6" style={{ animationDelay: '260ms' }}>
                <div className="panel overflow-hidden">
                  <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
                    <h2 className="text-sm font-semibold">Recent bills</h2>
                    <span className="eyebrow">Latest 12</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[var(--ink-3)]">
                          <th className="px-5 py-3 font-medium">Date</th>
                          <th className="px-5 py-3 font-medium">Bill</th>
                          <th className="px-5 py-3 font-medium">Vendor</th>
                          <th className="px-5 py-3 text-right font-medium">Total</th>
                          <th className="px-5 py-3 text-right font-medium">Balance</th>
                          <th className="px-5 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentBills.map((bill) => {
                          const open = Number(bill.balance ?? 0) > 0;
                          const overdue = open && bill.dueDate != null && new Date(bill.dueDate) < new Date();
                          return (
                            <tr
                              key={bill.qboId}
                              className="border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-1)]"
                            >
                              <td className="px-5 py-3 text-[var(--ink-2)]">{bill.txnDate ?? '—'}</td>
                              <td className="px-5 py-3 font-mono text-[var(--ink-3)]">#{bill.qboId}</td>
                              <td className="px-5 py-3 text-[var(--ink-2)]">{vendorName.get(bill.vendorId ?? '') ?? bill.vendorId ?? '—'}</td>
                              <td className="px-5 py-3 text-right tabular-nums">{money(bill.total)}</td>
                              <td className="px-5 py-3 text-right tabular-nums">{money(bill.balance)}</td>
                              <td className="px-5 py-3">
                                <Badge tone={overdue ? 'danger' : open ? 'warn' : 'good'}>
                                  {overdue ? 'Overdue' : open ? 'Unpaid' : 'Paid'}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </>
        ) : (
          <section className="rise panel flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="text-lg font-medium">No company connected</div>
            <p className="max-w-sm text-sm text-[var(--ink-2)]">
              Authorize a QuickBooks company to pull invoices, revenue, and A/R into the dashboard.
            </p>
            <a
              href="/api/qbo/connect"
              className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white transition-shadow hover:shadow-[0_0_20px_var(--accent-glow)]"
            >
              Connect QuickBooks
            </a>
          </section>
        )}
      </main>
    </div>
  );
}

function Sidebar({ env }: { env: string }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-[var(--border)] px-4 py-6 md:flex">
      <div className="mb-8 px-2">
        <span className="text-sm font-semibold tracking-tight">QBO Dashboard</span>
        <span className="mt-1 block h-px w-8 bg-[var(--accent)]" />
      </div>

      <nav className="flex flex-col gap-1 text-sm">
        <NavItem active href="#" label="Overview" icon="grid" />
        <NavItem href="#invoices" label="Invoices" icon="receipt" />
        <NavItem href="#bills" label="Bills" icon="receipt" />
        <NavItem href="#" label="Reports" icon="chart" muted />
        <NavItem href="#" label="Settings" icon="cog" muted />
      </nav>

      <div className="mt-auto px-2">
        <span className="eyebrow">Environment</span>
        <div className="mt-1 flex items-center gap-2 text-sm">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          {env}
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  label,
  href,
  icon,
  active,
  muted,
}: {
  label: string;
  href: string;
  icon: keyof typeof ICONS;
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <a
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
        active
          ? 'bg-[var(--surface-2)] text-[var(--ink)]'
          : muted
            ? 'text-[var(--ink-3)] hover:text-[var(--ink-2)]'
            : 'text-[var(--ink-2)] hover:bg-[var(--surface-1)] hover:text-[var(--ink)]'
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {ICONS[icon]}
      </svg>
      {label}
    </a>
  );
}

const ICONS = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  receipt: <><path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1z" /><path d="M9 8h6M9 12h6" /></>,
  chart: <><path d="M3 3v18h18" /><path d="M7 14l3-4 3 3 4-6" /></>,
  cog: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.3 1a7 7 0 0 0-1.7-1l-.3-2.5h-4l-.3 2.5a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.6a7 7 0 0 0 .1-1z" /></>,
} as const;

function Kpi({
  label,
  value,
  sub,
  tone,
  i,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'danger' | 'good';
  i: number;
}) {
  const valueColor =
    tone === 'danger' ? 'text-[var(--danger)]' : tone === 'good' ? 'text-[var(--good)]' : 'text-[var(--ink)]';
  return (
    <div className="rise panel panel-hover p-5" style={{ animationDelay: `${i * 60}ms` }}>
      <div className="eyebrow">{label}</div>
      <div className={`mt-2 text-[26px] font-semibold tracking-tight tabular-nums ${valueColor}`}>{value}</div>
      <div className="mt-1 text-xs text-[var(--ink-3)]">{sub}</div>
    </div>
  );
}

function Badge({ tone, children }: { tone: 'danger' | 'warn' | 'good'; children: React.ReactNode }) {
  const map = {
    danger: 'bg-[rgba(240,89,107,0.12)] text-[var(--danger)]',
    warn: 'bg-[rgba(234,161,0,0.12)] text-[#eab308]',
    good: 'bg-[rgba(34,197,94,0.12)] text-[var(--good)]',
  } as const;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${map[tone]}`}>{children}</span>
  );
}
