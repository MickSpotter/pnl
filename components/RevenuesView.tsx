import React, { useState, useMemo } from 'react';
import { DriverPerformance, ExpenseItem } from '../types';
import { formatCurrency } from '../utils';
import {
  DollarSign,
  Fuel,
  TrendingUp,
  Building2,
  Layers,
  Truck,
  Gauge,
  Percent,
  Droplets,
  Wallet,
  Users,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
  PieChart as PieIcon,
  Activity
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line
} from 'recharts';

interface RevenuesViewProps {
  drivers: DriverPerformance[];
  fixedExpenses: ExpenseItem[];
}

const REV_COLOR = '#10b981';
const REB_COLOR = '#818cf8';
const TOTAL_COLOR = '#c4b5fd';
const ACCENT_COLOR = '#3b82f6';

const DONUT_COLORS = ['#10b981', '#3b82f6', '#818cf8', '#f59e0b', '#f43f5e', '#22d3ee', '#a78bfa', '#34d399', '#fb7185', '#60a5fa', '#facc15', '#2dd4bf'];

const formatNum = (n: number, digits: number = 0) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const formatCompact = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
};

const formatPct = (n: number, digits: number = 1) => `${(n || 0).toFixed(digits)}%`;

const shortDate = (d: string) => {
  if (!d) return '';
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return d;
  return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
};

const resolveExpenseAmount = (
  fixedExpenses: ExpenseItem[],
  expName: string,
  currentDate: string | null,
  companyId?: string
): number => {
  const currTime = (currentDate ? new Date(currentDate).getTime() : Date.now()) - (3 * 24 * 60 * 60 * 1000);

  const evaluateExp = (matchedExp: ExpenseItem): number => {
    if ((matchedExp as any).threshold_date) {
      const threshTime = new Date((matchedExp as any).threshold_date).getTime();
      if (currTime < threshTime) {
        return (matchedExp as any).amount_before !== undefined ? (matchedExp as any).amount_before : (matchedExp.amount || 0);
      }
      return (matchedExp as any).amount_after !== undefined ? (matchedExp as any).amount_after : (matchedExp.amount || 0);
    }
    const isComplex = ['Liability Insurance (Global)', 'Cargo Insurance', 'Trailer Interchange', 'PD Premium', 'Physical Damage'].includes(matchedExp.name);
    if (isComplex && (matchedExp as any).amount_before !== undefined) {
      return (matchedExp as any).amount_before;
    }
    return matchedExp.amount || 0;
  };

  if (companyId) {
    const exps = fixedExpenses.filter(e => e.name.toLowerCase().includes(expName.toLowerCase()) && e.companyId === companyId);
    if (exps.length > 0) {
      const matchedExp = exps.find(e => {
        const fromTime = e.valid_from ? new Date(e.valid_from).getTime() : -Infinity;
        const toTime = e.valid_to ? new Date(e.valid_to).getTime() : Infinity;
        return currTime >= fromTime && currTime <= toTime;
      }) || exps[0];
      return evaluateExp(matchedExp);
    }
    const allExps = fixedExpenses.filter(e => e.name.toLowerCase().includes(expName.toLowerCase()) && e.companyId === 'ALL');
    if (allExps.length > 0) {
      const matchedExp = allExps.find(e => {
        const fromTime = e.valid_from ? new Date(e.valid_from).getTime() : -Infinity;
        const toTime = e.valid_to ? new Date(e.valid_to).getTime() : Infinity;
        return currTime >= fromTime && currTime <= toTime;
      }) || allExps[0];
      return evaluateExp(matchedExp);
    }
    return 0;
  }

  const exps = fixedExpenses.filter(e => e.name.toLowerCase().includes(expName.toLowerCase()));
  if (exps.length === 0) return 0;
  let matchedExp = exps.find(e => {
    const fromTime = e.valid_from ? new Date(e.valid_from).getTime() : -Infinity;
    const toTime = e.valid_to ? new Date(e.valid_to).getTime() : Infinity;
    return e.companyId === 'ALL' && currTime >= fromTime && currTime <= toTime;
  });
  if (!matchedExp) {
    matchedExp = exps.find(e => e.companyId === 'ALL') || exps.find(e => {
      const fromTime = e.valid_from ? new Date(e.valid_from).getTime() : -Infinity;
      const toTime = e.valid_to ? new Date(e.valid_to).getTime() : Infinity;
      return currTime >= fromTime && currTime <= toTime;
    }) || exps[0];
  }
  return evaluateExp(matchedExp as ExpenseItem);
};

const driverFuelRebate = (d: DriverPerformance, fixedExpenses: ExpenseItem[]): number => {
  const qty = Number((d as any).fuelUsed || (d as any).fuel_quantity || 0);
  const amount = resolveExpenseAmount(fixedExpenses, 'Fuel Rebate', d.payDate || null, d.companyId);
  return qty * amount;
};

const ChartTooltip = ({ active, payload, label, money = true }: any) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-zinc-800 border border-zinc-600 rounded-lg shadow-2xl px-3 py-2 text-[10px]">
      {label !== undefined && <div className="text-zinc-400 font-mono mb-1.5 uppercase tracking-wide">{label}</div>}
      <div className="flex flex-col gap-1">
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <span className="w-2 h-2 rounded-sm" style={{ background: p.color || p.fill }} />
              {p.name}
            </span>
            <span className="font-mono font-semibold text-white">
              {money ? formatCurrency(p.value) : formatNum(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
}> = ({ label, value, sub, icon, accent }) => (
  <div className="relative bg-zinc-900/70 border border-zinc-800 rounded-xl p-3.5 overflow-hidden hover:border-zinc-700 transition-colors group">
    <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity" style={{ background: accent }} />
    <div className="flex items-center justify-between mb-2 relative">
      <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</span>
      <span style={{ color: accent }}>{icon}</span>
    </div>
    <div className="text-lg font-bold text-white font-mono leading-none relative">{value}</div>
    {sub && <div className="text-[9px] text-zinc-500 mt-1.5 relative">{sub}</div>}
  </div>
);

const Delta: React.FC<{ current: number; previous: number; money?: boolean }> = ({ current, previous, money = true }) => {
  if (previous === 0 && current === 0) {
    return <span className="inline-flex items-center gap-1 text-zinc-500"><Minus size={11} /> 0%</span>;
  }
  const diff = current - previous;
  const pct = previous !== 0 ? (diff / Math.abs(previous)) * 100 : 100;
  const up = diff >= 0;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {formatPct(Math.abs(pct))}
      <span className="text-zinc-500 font-normal">({up ? '+' : '-'}{money ? formatCurrency(Math.abs(diff)) : formatNum(Math.abs(diff))})</span>
    </span>
  );
};

const RevenuesView: React.FC<RevenuesViewProps> = ({ drivers, fixedExpenses }) => {
  const payDates = useMemo(() => {
    return Array.from(new Set((drivers || []).map(d => d.payDate).filter(Boolean)))
      .sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime()) as string[];
  }, [drivers]);

  const [selectedWeek, setSelectedWeek] = useState<string>('ALL');

  const scopedDrivers = useMemo(() => {
    if (selectedWeek === 'ALL') return drivers || [];
    return (drivers || []).filter(d => d.payDate === selectedWeek);
  }, [drivers, selectedWeek]);

  const stats = useMemo(() => {
    const list = scopedDrivers;

    let revenue = 0;
    let rebate = 0;
    let miles = 0;
    let fuelQty = 0;
    let effNonTeams = 0;
    let effDrivers = 0;
    let trucks = 0;

    const byCompany: Record<string, { revenue: number; rebate: number; drivers: number }> = {};
    const byFranchise: Record<string, { revenue: number; rebate: number }> = {};
    const byContract: Record<string, { revenue: number; rebate: number }> = {};
    const driverNames = new Set<string>();

    list.forEach(d => {
      const rev = Number(d.companyPay || 0);
      const reb = driverFuelRebate(d, fixedExpenses);
      const qty = Number((d as any).fuelUsed || (d as any).fuel_quantity || 0);

      revenue += rev;
      rebate += reb;
      fuelQty += qty;
      miles += Number((d as any).milesDriven || (d as any).total_miles || 0);
      effNonTeams += Number(d.effectiveNonTeams || 0);
      effDrivers += Number(d.effectiveDrivers || 0);
      trucks += Number((d as any).numOfTrucks || 0);
      if (d.name) driverNames.add(d.name);

      const comp = d.companyId || 'Unassigned';
      if (!byCompany[comp]) byCompany[comp] = { revenue: 0, rebate: 0, drivers: 0 };
      byCompany[comp].revenue += rev;
      byCompany[comp].rebate += reb;
      byCompany[comp].drivers += Number(d.effectiveNonTeams || 0);

      if (d.franchiseId) {
        if (!byFranchise[d.franchiseId]) byFranchise[d.franchiseId] = { revenue: 0, rebate: 0 };
        byFranchise[d.franchiseId].revenue += rev;
        byFranchise[d.franchiseId].rebate += reb;
      }

      const ct = d.contractType || 'Unassigned';
      if (!byContract[ct]) byContract[ct] = { revenue: 0, rebate: 0 };
      byContract[ct].revenue += rev;
      byContract[ct].rebate += reb;
    });

    const companyArr = Object.entries(byCompany)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue);
    const franchiseArr = Object.entries(byFranchise)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue);
    const contractArr = Object.entries(byContract)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue);

    const total = revenue + rebate;

    return {
      revenue,
      rebate,
      total,
      miles,
      fuelQty,
      effNonTeams,
      effDrivers,
      trucks,
      uniqueDrivers: driverNames.size,
      companyArr,
      franchiseArr,
      contractArr,
      rebatePctOfRev: revenue !== 0 ? (rebate / revenue) * 100 : 0,
      revPerMile: miles > 0 ? revenue / miles : 0,
      revPerDriver: effNonTeams > 0 ? revenue / effNonTeams : 0,
      rebatePerGallon: fuelQty > 0 ? rebate / fuelQty : 0,
      totalInflowPerDriver: effNonTeams > 0 ? total / effNonTeams : 0
    };
  }, [scopedDrivers, fixedExpenses]);

  const weekly = useMemo(() => {
    const map: Record<string, { revenue: number; rebate: number; drivers: number }> = {};
    (drivers || []).forEach(d => {
      const key = d.payDate;
      if (!key) return;
      if (!map[key]) map[key] = { revenue: 0, rebate: 0, drivers: 0 };
      map[key].revenue += Number(d.companyPay || 0);
      map[key].rebate += driverFuelRebate(d, fixedExpenses);
      map[key].drivers += Number(d.effectiveNonTeams || 0);
    });
    return Object.entries(map)
      .map(([date, v]) => ({
        date,
        label: shortDate(date),
        revenue: Math.round(v.revenue),
        rebate: Math.round(v.rebate),
        total: Math.round(v.revenue + v.rebate),
        perDriver: v.drivers > 0 ? Math.round(v.revenue / v.drivers) : 0
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [drivers, fixedExpenses]);

  const wow = useMemo(() => {
    if (weekly.length < 2) return null;
    const latest = weekly[weekly.length - 1];
    const prev = weekly[weekly.length - 2];
    return { latest, prev };
  }, [weekly]);

  const companyChart = useMemo(() => stats.companyArr.slice(0, 8).map(c => ({
    name: c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name,
    fullName: c.name,
    revenue: Math.round(c.revenue),
    rebate: Math.round(c.rebate)
  })), [stats.companyArr]);

  const contractDonut = useMemo(() =>
    stats.contractArr.filter(c => c.revenue > 0).map(c => ({ name: c.name, value: Math.round(c.revenue) })),
  [stats.contractArr]);

  const franchiseDonut = useMemo(() =>
    stats.franchiseArr.filter(c => c.revenue > 0).slice(0, 12).map(c => ({ name: c.name, value: Math.round(c.revenue) })),
  [stats.franchiseArr]);

  const topCompany = stats.companyArr[0];
  const topFranchise = stats.franchiseArr[0];
  const topContract = stats.contractArr[0];

  const hero = [
    {
      label: 'Revenue Collected',
      value: formatCurrency(stats.revenue),
      icon: <DollarSign size={18} />,
      gradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
      ring: 'ring-emerald-500/30',
      text: 'text-emerald-400',
      glow: REV_COLOR,
      sub: `${formatNum(stats.uniqueDrivers)} drivers · ${formatNum(stats.companyArr.length)} companies`
    },
    {
      label: 'Fuel Rebate',
      value: formatCurrency(stats.rebate),
      icon: <Fuel size={18} />,
      gradient: 'from-indigo-500/20 via-indigo-500/5 to-transparent',
      ring: 'ring-indigo-400/30',
      text: 'text-indigo-300',
      glow: REB_COLOR,
      sub: `${formatNum(stats.fuelQty)} gal · ${formatCurrency(stats.rebatePerGallon)}/gal avg`
    },
    {
      label: 'Total Inflow',
      value: formatCurrency(stats.total),
      icon: <Wallet size={18} />,
      gradient: 'from-violet-500/20 via-violet-500/5 to-transparent',
      ring: 'ring-violet-400/30',
      text: 'text-violet-300',
      glow: TOTAL_COLOR,
      sub: `Revenue + Rebate combined`
    },
    {
      label: 'Rebate / Revenue',
      value: formatPct(stats.rebatePctOfRev, 2),
      icon: <Percent size={18} />,
      gradient: 'from-amber-500/20 via-amber-500/5 to-transparent',
      ring: 'ring-amber-400/30',
      text: 'text-amber-300',
      glow: '#f59e0b',
      sub: `Rebate as share of collected revenue`
    }
  ];

  if (!drivers || drivers.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-600">
        <Activity size={32} className="mb-3 opacity-40" />
        <div className="text-sm font-medium text-zinc-500">No revenue data available</div>
        <div className="text-[11px] text-zinc-600 mt-1">Adjust the global filter or sync data to view statistics.</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto pb-12 no-scrollbar">
      <div className="max-w-[1600px] mx-auto px-1">

        <div className="flex flex-wrap items-end justify-between gap-3 mb-4 pt-1">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-center">
                <TrendingUp size={16} className="text-emerald-400" />
              </div>
              <h1 className="text-lg font-bold text-white tracking-tight">Revenues</h1>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1 ml-10">
              Revenue Collected & Fuel Rebate statistics across {formatNum(payDates.length)} pay {payDates.length === 1 ? 'period' : 'periods'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Calendar size={13} className="text-zinc-500" />
            <select
              value={selectedWeek}
              onChange={e => setSelectedWeek(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 text-[11px] rounded-lg px-3 py-1.5 outline-none focus:border-emerald-500/50 transition-colors cursor-pointer"
            >
              <option value="ALL">All Pay Periods</option>
              {payDates.map(d => (
                <option key={d} value={d}>{new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          {hero.map((h, i) => (
            <div key={i} className={`relative bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 overflow-hidden ring-1 ${h.ring}`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${h.gradient} pointer-events-none`} />
              <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-3xl opacity-20" style={{ background: h.glow }} />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">{h.label}</span>
                  <span className={h.text}>{h.icon}</span>
                </div>
                <div className="text-2xl font-bold text-white font-mono tracking-tight">{h.value}</div>
                <div className="text-[10px] text-zinc-500 mt-2">{h.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <StatCard label="Avg Rev / Driver" value={formatCurrency(stats.revPerDriver)} sub="per effective non-team" icon={<Users size={14} />} accent={REV_COLOR} />
          <StatCard label="Revenue / Mile" value={formatCurrency(stats.revPerMile)} sub={`${formatCompact(stats.miles)} total miles`} icon={<Gauge size={14} />} accent={ACCENT_COLOR} />
          <StatCard label="Inflow / Driver" value={formatCurrency(stats.totalInflowPerDriver)} sub="rev + rebate per driver" icon={<Wallet size={14} />} accent={TOTAL_COLOR} />
          <StatCard label="Fuel Quantity" value={`${formatNum(stats.fuelQty)}`} sub="gallons rebated" icon={<Droplets size={14} />} accent={REB_COLOR} />
          <StatCard label="Rebate / Gallon" value={formatCurrency(stats.rebatePerGallon)} sub="effective rebate rate" icon={<Fuel size={14} />} accent={REB_COLOR} />
          <StatCard label="Active Drivers" value={formatNum(stats.effNonTeams, 1)} sub={`${formatNum(stats.uniqueDrivers)} unique names`} icon={<Truck size={14} />} accent="#f59e0b" />
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-emerald-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">Weekly Revenue & Rebate Trend</h2>
            </div>
            <div className="flex items-center gap-4 text-[10px]">
              <span className="flex items-center gap-1.5 text-zinc-400"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: REV_COLOR }} /> Revenue Collected</span>
              <span className="flex items-center gap-1.5 text-zinc-400"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: REB_COLOR }} /> Fuel Rebate</span>
            </div>
          </div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekly} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={REV_COLOR} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={REV_COLOR} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gReb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={REB_COLOR} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={REB_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="label" stroke="#52525b" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#27272a' }} />
                <YAxis stroke="#52525b" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${formatCompact(v)}`} width={52} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="revenue" name="Revenue Collected" stroke={REV_COLOR} strokeWidth={2} fill="url(#gRev)" />
                <Area type="monotone" dataKey="rebate" name="Fuel Rebate" stroke={REB_COLOR} strokeWidth={2} fill="url(#gReb)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
          <div className="lg:col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={14} className="text-emerald-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">Revenue by Company</h2>
              <span className="text-[10px] text-zinc-500">top {companyChart.length}</span>
            </div>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={companyChart} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                  <XAxis type="number" stroke="#52525b" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${formatCompact(v)}`} />
                  <YAxis type="category" dataKey="name" stroke="#a1a1aa" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={92} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: '#ffffff08' }} />
                  <Bar dataKey="revenue" name="Revenue Collected" fill={REV_COLOR} radius={[0, 4, 4, 0]} barSize={16} />
                  <Bar dataKey="rebate" name="Fuel Rebate" fill={REB_COLOR} radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <PieIcon size={14} className="text-emerald-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">Revenue by Contract</h2>
            </div>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={contractDonut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={88} paddingAngle={2} stroke="#18181b" strokeWidth={2}>
                    {contractDonut.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-1.5 mt-2 max-h-[60px] overflow-auto no-scrollbar">
              {contractDonut.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <span className="w-2 h-2 rounded-sm" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    {c.name}
                  </span>
                  <span className="font-mono text-zinc-300">{formatCurrency(c.value)} · {formatPct(stats.revenue ? (c.value / stats.revenue) * 100 : 0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
          <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <PieIcon size={14} className="text-indigo-300" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">Revenue by Franchise</h2>
            </div>
            {franchiseDonut.length > 0 ? (
              <>
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={franchiseDonut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={88} paddingAngle={2} stroke="#18181b" strokeWidth={2}>
                        {franchiseDonut.map((_, i) => <Cell key={i} fill={DONUT_COLORS[(i + 2) % DONUT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-1.5 mt-2 max-h-[60px] overflow-auto no-scrollbar">
                  {franchiseDonut.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <span className="flex items-center gap-1.5 text-zinc-400">
                        <span className="w-2 h-2 rounded-sm" style={{ background: DONUT_COLORS[(i + 2) % DONUT_COLORS.length] }} />
                        {c.name}
                      </span>
                      <span className="font-mono text-zinc-300">{formatCurrency(c.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-zinc-600 text-[11px]">No franchise revenue in this scope</div>
            )}
          </div>

          <div className="lg:col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Fuel size={14} className="text-indigo-300" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">Fuel Rebate by Company</h2>
            </div>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={companyChart} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="name" stroke="#a1a1aa" tick={{ fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#27272a' }} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis stroke="#52525b" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${formatCompact(v)}`} width={52} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: '#ffffff08' }} />
                  <Bar dataKey="rebate" name="Fuel Rebate" fill={REB_COLOR} radius={[4, 4, 0, 0]} barSize={26} />
                  <Line type="monotone" dataKey="revenue" name="Revenue Collected" stroke={REV_COLOR} strokeWidth={2} dot={{ r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/40 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
              <Building2 size={13} className="text-emerald-400" /> Top Company
            </div>
            {topCompany ? (
              <>
                <div className="text-sm font-bold text-white truncate">{topCompany.name}</div>
                <div className="text-xl font-mono font-bold text-emerald-400 mt-1">{formatCurrency(topCompany.revenue)}</div>
                <div className="text-[10px] text-zinc-500 mt-1">{formatPct(stats.revenue ? (topCompany.revenue / stats.revenue) * 100 : 0)} of revenue · {formatCurrency(topCompany.rebate)} rebate</div>
              </>
            ) : <div className="text-zinc-600 text-xs">—</div>}
          </div>

          <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/40 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
              <Layers size={13} className="text-indigo-300" /> Top Franchise
            </div>
            {topFranchise ? (
              <>
                <div className="text-sm font-bold text-white truncate">{topFranchise.name}</div>
                <div className="text-xl font-mono font-bold text-indigo-300 mt-1">{formatCurrency(topFranchise.revenue)}</div>
                <div className="text-[10px] text-zinc-500 mt-1">{formatCurrency(topFranchise.rebate)} fuel rebate</div>
              </>
            ) : <div className="text-zinc-600 text-xs">No franchise data</div>}
          </div>

          <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/40 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
              <PieIcon size={13} className="text-violet-300" /> Leading Contract
            </div>
            {topContract ? (
              <>
                <div className="text-sm font-bold text-white truncate">{topContract.name}</div>
                <div className="text-xl font-mono font-bold text-violet-300 mt-1">{formatCurrency(topContract.revenue)}</div>
                <div className="text-[10px] text-zinc-500 mt-1">{formatPct(stats.revenue ? (topContract.revenue / stats.revenue) * 100 : 0)} of revenue</div>
              </>
            ) : <div className="text-zinc-600 text-xs">—</div>}
          </div>

          <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/40 border border-zinc-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
              <TrendingUp size={13} className="text-amber-300" /> Week over Week
            </div>
            {wow ? (
              <div className="flex flex-col gap-2 mt-1">
                <div>
                  <div className="text-[9px] text-zinc-500 uppercase">Revenue ({wow.latest.label})</div>
                  <div className="text-sm font-mono font-bold text-white">{formatCurrency(wow.latest.revenue)}</div>
                  <div className="text-[10px] mt-0.5"><Delta current={wow.latest.revenue} previous={wow.prev.revenue} /></div>
                </div>
                <div className="border-t border-zinc-800 pt-2">
                  <div className="text-[9px] text-zinc-500 uppercase">Fuel Rebate</div>
                  <div className="text-sm font-mono font-bold text-white">{formatCurrency(wow.latest.rebate)}</div>
                  <div className="text-[10px] mt-0.5"><Delta current={wow.latest.rebate} previous={wow.prev.rebate} /></div>
                </div>
              </div>
            ) : <div className="text-zinc-600 text-xs">Need 2+ pay periods</div>}
          </div>
        </div>

      </div>
    </div>
  );
};

export default RevenuesView;
