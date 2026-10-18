'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AgingBucket, MonthPoint, StatusSlice } from '@/lib/metrics';

// dataviz validated palette
const BLUE = '#2a78d6';
const GREEN = '#008300';
const INK_MUTED = '#898781';
const GRID = 'rgba(137,135,129,0.22)'; // reads on light + dark
// aging severity ramp: benign -> critical
const AGING_COLOR: Record<string, string> = {
  Current: BLUE,
  '1-30': '#eda100',
  '31-60': '#eb6834',
  '61-90': '#e34948',
  '90+': '#d03b3b',
};

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const money = (v: number) => usd.format(v);
const monthLabel = (m: string) => {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1).toLocaleString('en-US', { month: 'short', year: '2-digit' });
};

const tooltipStyle = {
  background: '#141417',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  fontSize: 12,
  color: '#f4f4f5',
  padding: '8px 12px',
  boxShadow: '0 12px 30px -12px rgba(0,0,0,0.8)',
} as const;

const axisProps = {
  stroke: INK_MUTED,
  tick: { fill: INK_MUTED, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel panel-hover min-w-0 p-5">
      <h3 className="eyebrow mb-4">{title}</h3>
      {children}
    </div>
  );
}

function AgingChart({ data }: { data: AgingBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <XAxis dataKey="bucket" {...axisProps} />
        <YAxis tickFormatter={money} width={70} {...axisProps} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: GRID }}
          formatter={(v) => [money(Number(v)), 'Balance']}
        />
        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
          {data.map((a) => (
            <Cell key={a.bucket} fill={AGING_COLOR[a.bucket] ?? BLUE} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DashboardCharts({
  revenue,
  aging,
  status,
  apAging,
}: {
  revenue: MonthPoint[];
  aging: AgingBucket[];
  status: StatusSlice[];
  apAging: AgingBucket[];
}) {
  const hasApAging = apAging.some((a) => a.amount > 0);
  const hasRevenue = revenue.some((r) => r.revenue > 0);
  const hasAging = aging.some((a) => a.amount > 0);
  const statusData = status.filter((s) => s.total > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="min-w-0 lg:col-span-2">
        <Card title="Revenue by month">
          {hasRevenue ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={revenue} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BLUE} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={BLUE} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tickFormatter={monthLabel} minTickGap={20} {...axisProps} />
                <YAxis tickFormatter={money} width={64} {...axisProps} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(label) => monthLabel(String(label))}
                  formatter={(v) => [money(Number(v)), 'Revenue']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={BLUE}
                  strokeWidth={2}
                  fill="url(#revFill)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </Card>
      </div>

      <Card title="A/R aging (receivable)">{hasAging ? <AgingChart data={aging} /> : <Empty />}</Card>

      <Card title="A/P aging (payable)">{hasApAging ? <AgingChart data={apAging} /> : <Empty />}</Card>

      <div className="min-w-0 lg:col-span-2">
      <Card title="Invoice status (by amount)">
        {statusData.length > 0 ? (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
            <div className="h-[200px] w-full sm:w-3/5">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v))} />
                <Pie
                  data={statusData}
                  dataKey="total"
                  nameKey="status"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  stroke="none"
                >
                  {statusData.map((s) => (
                    <Cell key={s.status} fill={s.status === 'Paid' ? GREEN : BLUE} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            </div>
            <ul className="w-full space-y-2 text-sm sm:w-auto">
              {statusData.map((s) => (
                <li key={s.status} className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ background: s.status === 'Paid' ? GREEN : BLUE }}
                  />
                  <span className="text-[var(--ink-2)]">{s.status}</span>
                  <span className="font-medium tabular-nums">{money(s.total)}</span>
                  <span className="text-[var(--ink-3)]">({s.n})</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Empty />
        )}
      </Card>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-[var(--ink-3)]">
      No data yet — run a sync.
    </div>
  );
}
