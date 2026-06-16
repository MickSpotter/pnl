import React, { useMemo, useState } from 'react';
import { formatCurrency } from '../utils';
import { PieChart, BarChart3 } from 'lucide-react';

const METRIC_OPTIONS = [
  { id: 'totalPnL', label: 'TOTAL PNL' },
  { id: 'totalGross', label: 'TOTAL GROSS' },
  { id: 'marginAmount', label: 'MARGIN' },
  { id: 'netPay', label: 'NET PAY' },
  { id: 'companyPay', label: 'COMPANY PAY' },
  { id: 'fuelRebate', label: 'FUEL REBATE' },
  { id: 'dispatcherPay', label: 'DISPATCHER PAY' },
  { id: 'wklyExp', label: 'WEEKLY EXPENSES' },
  { id: 'tollCost', label: 'TOLLS' },
  { id: 'poCoverage', label: 'PO COVERAGE' },
  { id: 'recruitingCost', label: 'RECRUITING' }
];

export default function DriverStats({ drivers }: any) {
  const [selectedMetric, setSelectedMetric] = useState('totalPnL');
  const [hoveredContract, setHoveredContract] = useState<string | null>(null);

  const stats = useMemo(() => {
    if (!drivers || drivers.length === 0) return null;

    let totalGross = 0;
    let totalMargin = 0;
    let totalEarnings = 0;
    let totalPnL = 0;

    const contractMap = new Map();
    const companyMap = new Map();

    drivers.forEach((d: any) => {
      totalGross += d.totalGross || 0;
      totalMargin += d.marginAmount || 0;
      totalPnL += d.totalPnL || 0;
      let dEarnings = 0;

      if (d.records) {
          d.records.forEach((r: any) => {
              dEarnings += (Number(r.revenue_base ?? r.revenueBase ?? 0)) / 2;
          });
      }
      totalEarnings += dEarnings;

      const metricValue = d[selectedMetric] || 0;

      const primaryContract = (d.contracts && d.contracts[0]) ? d.contracts[0] : 'Unassigned';
      if (!contractMap.has(primaryContract)) {
          contractMap.set(primaryContract, 0);
      }
      contractMap.set(primaryContract, contractMap.get(primaryContract) + metricValue);

      const primaryCompany = (d.records && d.records[0]?.companyId) ? d.records[0].companyId : 'Unassigned';
      if (!companyMap.has(primaryCompany)) {
          companyMap.set(primaryCompany, 0);
      }
      companyMap.set(primaryCompany, companyMap.get(primaryCompany) + metricValue);
    });

    const palette = ['#f59e0b', '#a855f7', '#3b82f6', '#10b981', '#ec4899', '#06b6d4', '#f43f5e', '#84cc16'];

    const contractData = Array.from(contractMap.entries())
      .map(([name, value], idx) => ({
          name: String(name),
          value,
          color: palette[idx % palette.length]
      }))
      .sort((a, b) => b.value - a.value);

    const companyData = Array.from(companyMap.entries())
      .map(([name, value]) => ({ name: String(name), value }))
      .sort((a, b) => b.value - a.value);

    return { totalGross, totalMargin, totalEarnings, totalPnL, contractData, companyData };
  }, [drivers, selectedMetric]);

  if (!stats) return null;

  const totalAbsoluteMetric = stats.contractData.reduce((sum, c) => sum + Math.abs(c.value), 0);
  
  let currentAngle = 0;
  const pieSlices = stats.contractData.map((item) => {
      const val = Math.abs(item.value);
      if (val <= 0) return null;
      const percentage = totalAbsoluteMetric > 0 ? val / totalAbsoluteMetric : 0;
      
      const startAngle = currentAngle;
      const endAngle = currentAngle + (percentage * 2 * Math.PI);
      currentAngle = endAngle;

      const startX = 60 + 60 * Math.cos(startAngle);
      const startY = 60 + 60 * Math.sin(startAngle);
      const endX = 60 + 60 * Math.cos(endAngle);
      const endY = 60 + 60 * Math.sin(endAngle);
      
      const largeArcFlag = percentage > 0.5 ? 1 : 0;
      
      const pathData = percentage === 1 
          ? `M 120 60 A 60 60 0 1 1 0 60 A 60 60 0 1 1 120 60 Z`
          : `M 60 60 L ${startX} ${startY} A 60 60 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;

      return { ...item, pathData, percentage };
  }).filter(Boolean);

  const maxCompanyMetric = Math.max(...stats.companyData.map(c => Math.abs(c.value)), 1);

  return (
    <div className="w-full h-full flex gap-4 p-0 rounded-lg min-h-0 bg-transparent">
      
      <div className="flex-1 bg-zinc-950/60 border border-zinc-800/60 rounded-xl p-4 flex flex-col h-full shadow-2xl min-h-0 relative overflow-hidden backdrop-blur-md">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none"></div>
          <div className="flex items-center justify-between mb-4 shrink-0 relative z-10">
              <div className="flex items-center gap-2">
                  <PieChart size={15} className="text-emerald-500" />
                  <span className="text-[11px] font-black text-zinc-300 uppercase tracking-widest">Contracts</span>
              </div>
              <div className="relative">
                  <select 
                      value={selectedMetric} 
                      onChange={(e) => setSelectedMetric(e.target.value)}
                      className="appearance-none bg-zinc-900 border border-zinc-700/60 rounded px-3 py-1.5 pr-8 text-[10px] font-black uppercase tracking-wider text-zinc-300 outline-none hover:border-emerald-500/50 cursor-pointer transition-colors shadow-inner"
                  >
                      {METRIC_OPTIONS.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                     <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
              </div>
          </div>
          
          <div className="flex items-center gap-8 flex-1 min-h-0 relative z-10">
              <div className="w-44 h-44 relative flex-shrink-0 flex items-center justify-center drop-shadow-[0_10px_35px_rgba(0,0,0,0.8)]">
                  <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90 relative z-10 overflow-visible">
                      <defs>
                          {pieSlices.map((item: any, idx: number) => (
                              <linearGradient key={`grad-${idx}`} id={`grad-${item.name.replace(/\W/g, '-')}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" stopColor={item.color} stopOpacity="1" />
                                  <stop offset="100%" stopColor={item.color} stopOpacity="0.2" />
                              </linearGradient>
                          ))}
                      </defs>
                      <circle cx="60" cy="60" r="60" fill="#18181b" className="opacity-40" />
                      {pieSlices.map((item: any) => {
                          const isHovered = hoveredContract === item.name;
                          const isDimmed = hoveredContract !== null && !isHovered;
                          
                          return (
                              <path
                                  key={item.name}
                                  d={item.pathData}
                                  fill={`url(#grad-${item.name.replace(/\W/g, '-')})`}
                                  stroke="#09090b"
                                  strokeWidth="2.5"
                                  strokeLinejoin="round"
                                  className={`transition-all duration-500 ease-out cursor-pointer ${isDimmed ? 'opacity-10' : 'opacity-100'}`}
                                  style={{
                                      transformOrigin: '60px 60px',
                                      transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                                      filter: isHovered ? `drop-shadow(0 0 20px ${item.color})` : `drop-shadow(0 0 8px ${item.color}40)`
                                  }}
                                  onMouseEnter={() => setHoveredContract(item.name)}
                                  onMouseLeave={() => setHoveredContract(null)}
                              />
                          );
                      })}
                  </svg>
              </div>
              
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto h-full pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                  {stats.contractData.map((c: any) => (
                      <div 
                          key={c.name} 
                          className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-300 cursor-pointer ${hoveredContract === c.name ? 'bg-zinc-800/80 border-zinc-600 shadow-md scale-[1.02]' : 'bg-zinc-900/40 border-zinc-800/40 hover:bg-zinc-800/60'}`}
                          onMouseEnter={() => setHoveredContract(c.name)}
                          onMouseLeave={() => setHoveredContract(null)}
                      >
                          <div className="flex items-center gap-3">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color, boxShadow: hoveredContract === c.name ? `0 0 12px ${c.color}` : 'none' }}></div>
                              <span className={`font-bold text-[11px] tracking-wide uppercase transition-colors ${hoveredContract === c.name ? 'text-white' : 'text-zinc-400'}`}>{c.name}</span>
                          </div>
                          <div className={`font-black text-[12px] tracking-tight ${c.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {formatCurrency(c.value)}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      <div className="flex-1 bg-[#121215] border border-zinc-800/80 rounded-xl p-4 flex flex-col h-full shadow-[0_4px_20px_rgba(0,0,0,0.5)] min-h-0 relative">
          <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-2">
                  <BarChart3 size={15} className="text-blue-500" />
                  <span className="text-[11px] font-black text-zinc-300 uppercase tracking-widest">Companies</span>
              </div>
              <div className="relative">
                  <select 
                      value={selectedMetric} 
                      onChange={(e) => setSelectedMetric(e.target.value)}
                      className="appearance-none bg-[#1a1a1f] border border-zinc-700/60 rounded px-3 py-1.5 pr-8 text-[10px] font-black uppercase tracking-wider text-zinc-300 outline-none hover:border-zinc-500 cursor-pointer transition-colors shadow-inner"
                  >
                      {METRIC_OPTIONS.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                     <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
              </div>
          </div>
          
          <div className="flex flex-col gap-5 w-full flex-1 overflow-y-auto h-full pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent pt-2">
              {stats.companyData.map((c: any) => {
                  const widthPct = (Math.abs(c.value) / maxCompanyMetric) * 100;
                  return (
                      <div key={c.name} className="flex flex-col gap-1.5 w-full group">
                          <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wide group-hover:text-white transition-colors">{c.name}</span>
                              <span className={`text-[12px] font-black tracking-tight ${c.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {formatCurrency(c.value)}
                              </span>
                          </div>
                          <div className="w-full bg-[#1a1a1f] h-1.5 rounded-full overflow-hidden border border-zinc-800/50">
                              <div 
                                  className={`h-full rounded-full transition-all duration-1000 ease-out ${c.value >= 0 ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'}`} 
                                  style={{ width: `${Math.max(1, widthPct)}%` }}
                              ></div>
                          </div>
                      </div>
                  );
              })}
          </div>
      </div>
    </div>
  );
}