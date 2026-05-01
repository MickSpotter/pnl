import React, { useState } from 'react';
import { DriverPerformance, DriverStatus, DispatcherTier } from '../types';
import { formatCurrency, formatPercent } from '../utils';
import { AlertCircle, CheckCircle, TrendingUp, UserMinus, ChevronDown, ChevronUp, AlertTriangle, X, Minus, Filter, Info } from 'lucide-react';
import HistoricalChart from './HistoricalChart';

interface DriverTableProps {
  drivers: DriverPerformance[];
}

const DriverRow = React.memo(({ driver, isExpanded, onToggle, fleetAverages }: { driver: any; isExpanded: boolean; onToggle: (id: string) => void; fleetAverages: any }) => {
  const [selectedEntity, setSelectedEntity] = useState<string>('TOTAL');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['pnl']);
  const [showSwaps, setShowSwaps] = useState(false);

  const selectedContract = selectedEntity.startsWith('CTR:') ? selectedEntity.split(':')[1] : 'ALL';

  const toggleMetric = (metric: string) => {
    setSelectedMetrics(prev => prev.includes(metric) && prev.length > 1 ? prev.filter(m => m !== metric) : prev.includes(metric) ? prev : [...prev, metric]);
  };

  const filteredRecords = React.useMemo(() => {
    if (selectedEntity === 'TOTAL') return driver.records;
    const [type, val] = selectedEntity.split(':');
    return driver.records.filter((r: any) => type === 'CTR' ? r.contractType === val : r.companyId === val);
  }, [driver.records, selectedEntity]);

  const driverStats = React.useMemo(() => {
    const contracts = Array.from(new Set(driver.records.map((r: any) => r.contractType)));
    const companies = Array.from(new Set(driver.records.map((r: any) => r.companyId)));
    const franchise = driver.records[driver.records.length - 1]?.franchiseId || '-';
    
    const longevities = contracts.map(c => {
      const weeks = driver.records.filter((r: any) => r.contractType === c).length;
      return { type: c as string, weeks };
    });

    const swapHistory: string[] = [];
    if (driver.records.length > 0) {
      // Group all records for a given payDate
      const recordsByDate = driver.records.reduce((acc: any, r: any) => {
        if (!acc[r.payDate]) acc[r.payDate] = [];
        acc[r.payDate].push(r);
        return acc;
      }, {});
      
      const sortedDates = Object.keys(recordsByDate).sort();
      let lastComp = '';
      let lastCont = '';

      if (sortedDates.length > 0) {
        // Find the primary record for the very first date to establish the baseline
        const firstPrimary = recordsByDate[sortedDates[0]].reduce((prev: any, curr: any) => ((curr.totalGross || 0) > (prev.totalGross || 0)) ? curr : prev);
        lastComp = firstPrimary.companyId;
        lastCont = firstPrimary.contractType;

        sortedDates.forEach((date: string) => {
          // For the current date, find the record with the highest gross
          const primaryForDate = recordsByDate[date].reduce((prev: any, curr: any) => ((curr.totalGross || 0) > (prev.totalGross || 0)) ? curr : prev);
          
          if (primaryForDate.companyId !== lastComp || primaryForDate.contractType !== lastCont) {
            let changes = [];
            if (lastComp !== primaryForDate.companyId) changes.push(`${lastComp || 'Unknown'} ➔ ${primaryForDate.companyId || 'Unknown'}`);
            if (lastCont !== primaryForDate.contractType) changes.push(`${lastCont || 'Unknown'} ➔ ${primaryForDate.contractType || 'Unknown'}`);
            swapHistory.push(`${date}: ${changes.join(' | ')}`);
            lastComp = primaryForDate.companyId;
            lastCont = primaryForDate.contractType;
          }
        });
      }
    }

    return { longevities, currentCompany: companies[companies.length - 1] as string, franchise: franchise as string, hasSwapped: swapHistory.length > 0, swapHistory };
  }, [driver.records]);

  const calcGross = filteredRecords.reduce((s: number, r: any) => s + (r.totalGross || r.grossRevenue || 0), 0);
  const expFuel = filteredRecords.reduce((s: number, r: any) => s + (r.fuelCost || 0), 0);
  const expMaint = filteredRecords.reduce((s: number, r: any) => s + (r.maintenanceCost || 0), 0);
  const expFaults = filteredRecords.reduce((s: number, r: any) => s + (r.driverFaultExpenses || 0), 0);

  const { issues, perfStats } = React.useMemo(() => {
    const iss: any[] = [];
    const fullWeeks = filteredRecords.filter((r: any) => (r.effectiveDrivers || 0) >= 1);
    const count = fullWeeks.length;

    let targetAvg = fleetAverages['ALL'] || { gross: 0, rev: 0, poCov: 0, pnl: 500 };
    let primaryContract = 'Unassigned';

    if (selectedEntity.startsWith('CTR:')) {
      primaryContract = selectedEntity.split(':')[1];
      if (fleetAverages[primaryContract]) targetAvg = fleetAverages[primaryContract];
    } else if (filteredRecords.length > 0) {
      const cCounts: any = {};
      let maxCount = 0;
      filteredRecords.forEach((r: any) => {
        const c = r.contractType || 'Unassigned';
        cCounts[c] = (cCounts[c] || 0) + 1;
        if (cCounts[c] > maxCount) {
          maxCount = cCounts[c];
          primaryContract = c;
        }
      });
      if (fleetAverages[primaryContract]) targetAvg = fleetAverages[primaryContract];
    }

    if (count === 0) {
      iss.push({ label: "Driver has less than 7 working days (average calculation unavailable)", diff: 0, severity: "neutral" });
      const emptyStats = [
        { name: 'Gross', val: null, fleet: targetAvg.gross || 0, diff: 0, severity: 'neutral' },
        { name: 'Revenue', val: null, fleet: targetAvg.rev || 0, diff: 0, severity: 'neutral' }
      ];
      if (primaryContract !== 'MCLOO') {
        emptyStats.push({ name: 'PO Co Cov', val: null, fleet: targetAvg.poCov || 0, diff: 0, severity: 'neutral' });
      }
      emptyStats.push({ name: 'Fuel', val: null, fleet: targetAvg.fuel || 0, diff: 0, severity: 'neutral' });
      emptyStats.push({ name: 'PnL', val: null, fleet: targetAvg.pnl || 500, diff: 0, severity: 'neutral' });

      return { issues: iss, perfStats: emptyStats };
    }

    const grossRecs = fullWeeks.filter((r: any) => (r.totalGross || 0) !== 0);
    const avgGross = grossRecs.length > 0 ? grossRecs.reduce((s: number, r: any) => s + (r.totalGross || 0), 0) / grossRecs.length : 0;
    
    const revRecs = fullWeeks.filter((r: any) => (r.companyPay || 0) !== 0);
    const avgRev = revRecs.length > 0 ? revRecs.reduce((s: number, r: any) => s + (r.companyPay || 0), 0) / revRecs.length : 0;
    
    const poRecs = fullWeeks.filter((r: any) => (r.poCoverage ? -Math.abs(r.poCoverage) : 0) !== 0);
    const avgPOCov = poRecs.length > 0 ? poRecs.reduce((s: number, r: any) => s + (r.poCoverage ? -Math.abs(r.poCoverage) : 0), 0) / poRecs.length : 0;
    
    const pnlRecs = fullWeeks.filter((r: any) => ((r.companyPay || 0) - Math.abs(r.fixed_costs || 0) - Math.abs(r.poCoverage || 0) - Math.abs(r.recruitingCost || 0) - Math.abs(r.tollCost || 0)) !== 0);
    const avgPnL = pnlRecs.length > 0 ? pnlRecs.reduce((s: number, r: any) => s + ((r.companyPay || 0) - Math.abs(r.fixed_costs || 0) - Math.abs(r.poCoverage || 0) - Math.abs(r.recruitingCost || 0) - Math.abs(r.tollCost || 0)), 0) / pnlRecs.length : 0;

    const sumMiles = filteredRecords.reduce((s: number, r: any) => s + (r.milesDriven || 0), 0);
    const totalFuelSpend = filteredRecords.reduce((s: number, r: any) => s + ((r.fuelCost ? -Math.abs(r.fuelCost) : 0) + (r.fuelSavings || 0)), 0);
    const avgFuel = sumMiles > 0 ? totalFuelSpend / sumMiles : 0;

    const tGross = 4000;
    const tRev = targetAvg.rev || 400;
    const tPoCov = targetAvg.poCov || 0;
    const tFuel = targetAvg.fuel || -0.50;
    const tPnL = 100;

    const diffGross = tGross > 0 ? ((avgGross - tGross) / Math.abs(tGross)) * 100 : 0;
    const diffRev = tRev > 0 ? ((avgRev - tRev) / Math.abs(tRev)) * 100 : 0;
    const diffPOCov = tPoCov !== 0 ? ((avgPOCov - tPoCov) / Math.abs(tPoCov)) * 100 : (avgPOCov < -50 ? ((avgPOCov - (-50)) / 50) * 100 : 0);
    const diffFuel = tFuel !== 0 ? ((avgFuel - tFuel) / Math.abs(tFuel)) * 100 : (avgFuel < -0.5 ? ((avgFuel - (-0.5)) / 0.5) * 100 : 0);
    const diffPnL = tPnL > 0 ? ((avgPnL - tPnL) / Math.abs(tPnL)) * 100 : 0;

    const getSeverity = (diff: number) => {
      if (diff >= 5) return 'good';
      if (diff >= -5) return 'neutral';
      if (diff >= -15) return 'warning';
      return 'critical';
    };

    const sGross = getSeverity(diffGross);
    const sRev = avgRev < 0 ? 'critical' : (avgRev <= 50 ? 'warning' : (avgRev <= 200 ? 'neutral' : 'good'));
    const sPOCov = getSeverity(diffPOCov);
    const sFuel = diffFuel <= -50 ? 'critical' : (diffFuel <= -30 ? 'warning' : (diffFuel >= 5 ? 'good' : 'neutral'));
    const sPnL = getSeverity(diffPnL);

    if (sRev === 'critical') iss.push({ label: "Low Rev Coll. Avg", diff: diffRev, severity: "critical" });
    else if (sRev === 'warning') iss.push({ label: "Slightly Low Rev Coll. Avg", diff: diffRev, severity: "warning" });

    if (sGross === 'critical') iss.push({ label: "Low Gross Avg", diff: diffGross, severity: "critical" });
    else if (sGross === 'warning') iss.push({ label: "Slightly Low Gross Avg", diff: diffGross, severity: "warning" });

    if (primaryContract !== 'MCLOO') {
      if (sPOCov === 'critical') iss.push({ label: "Low PO Co Cov", diff: diffPOCov, severity: "critical" });
      else if (sPOCov === 'warning') iss.push({ label: "Slightly Low PO Co Cov", diff: diffPOCov, severity: "warning" });
    }

    if (sFuel === 'critical') iss.push({ label: "Low Fuel Avg", diff: diffFuel, severity: "critical" });
    else if (sFuel === 'warning') iss.push({ label: "Slightly Low Fuel Avg", diff: diffFuel, severity: "warning" });

    if (sPnL === 'critical') iss.push({ label: "Low PnL Avg", diff: diffPnL, severity: "critical" });
    else if (sPnL === 'warning') iss.push({ label: "Slightly Low PnL Avg", diff: diffPnL, severity: "warning" });
    
    const perfStats = [
      { name: 'Gross', val: avgGross, fleet: tGross, diff: diffGross, severity: sGross },
      { name: 'Revenue', val: avgRev, fleet: tRev, diff: diffRev, severity: sRev },
    ];
    if (primaryContract !== 'MCLOO') {
      perfStats.push({ name: 'PO Co Cov', val: avgPOCov, fleet: tPoCov, diff: diffPOCov, severity: sPOCov });
    }
    perfStats.push({ name: 'Fuel', val: avgFuel, fleet: tFuel, diff: diffFuel, severity: sFuel });
    perfStats.push({ name: 'PnL', val: avgPnL, fleet: tPnL, diff: diffPnL, severity: sPnL });

    return { issues: iss, perfStats };
  }, [filteredRecords, fleetAverages, selectedEntity]);
  const historyChartData = React.useMemo(() => {
    return filteredRecords.map((r: any) => {
      const pnlVal = (r.companyPay || 0) - (r.fixed_costs || 0) - Math.abs(r.poCoverage || 0) - Math.abs(r.recruitingCost || 0) - Math.abs(r.tollCost || 0);
      const fullWeeksSoFar = driver.records.filter((rec: any) => (rec.effectiveDrivers || 0) >= 1 && new Date(rec.payDate) <= new Date(r.payDate));
      const count = fullWeeksSoFar.length || 1;

      const recordsSoFar = driver.records.filter((rec: any) => new Date(rec.payDate) <= new Date(r.payDate));
          const milesSoFar = recordsSoFar.reduce((s: number, x: any) => s + (x.milesDriven || 0), 0);

          const metrics: any = {
            'revenue collected': r.companyPay,
            'revenue collected avg/w': recordsSoFar.reduce((s:number, x:any) => s + (x.companyPay || 0), 0) / count,
            'gross': r.totalGross,
            'gross avg/w': recordsSoFar.reduce((s:number, x:any) => s + (x.totalGross || 0), 0) / count,
            'margin': r.marginAmount,
            'margin avg/w': recordsSoFar.reduce((s:number, x:any) => s + (x.marginAmount || 0), 0) / count,
            'pnl': pnlVal,
           'pnl avg/w': recordsSoFar.reduce((s:number, x:any) => s + ((x.companyPay || 0) - (x.fixed_costs || 0) - Math.abs(x.poCoverage || 0) - Math.abs(x.recruitingCost || 0) - Math.abs(x.tollCost || 0)), 0) / count,
            'po': r.poCoverage ? -Math.abs(r.poCoverage) : 0,
            'po avg/w': recordsSoFar.reduce((s:number, x:any) => s + (x.poCoverage ? -Math.abs(x.poCoverage) : 0), 0) / count,
            'fuel': (r.fuelCost ? -Math.abs(r.fuelCost) : 0) + (r.fuelSavings || 0),
            'fuel avg/mi': milesSoFar > 0 ? recordsSoFar.reduce((s:number, x:any) => s + ((x.fuelCost ? -Math.abs(x.fuelCost) : 0) + (x.fuelSavings || 0)), 0) / milesSoFar : 0
          };
      const point: any = { name: r.payDate };
      selectedMetrics.forEach(m => { point[m] = metrics[m]; });
      return point;
    });
  }, [filteredRecords, selectedMetrics, driver.records]);

  const activeSeries = React.useMemo(() => {
    const palette = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#f43f5e', '#06b6d4', '#fb923c', '#d946ef', '#a1a1aa'];
    return selectedMetrics.map((m, i) => ({ dataKey: m, name: m.toUpperCase(), color: palette[i % palette.length] }));
  }, [selectedMetrics]);

  return (
    <React.Fragment>
      <tr onClick={() => onToggle(driver.id)} className={`cursor-pointer transition-colors ${isExpanded ? 'bg-zinc-800/50' : 'hover:bg-zinc-800/30'}`}>
        <td className="px-2 py-1 text-zinc-500">{isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</td>
        <td className="px-2 py-1 font-sans">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${driver.status === DriverStatus.ACTIVE ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="font-semibold text-zinc-200">{driver.name}</span>
            {issues.some((iss: any) => iss.severity === 'critical') && <AlertTriangle size={10} className="text-rose-500 ml-1" />}
          </div>
        </td>
        <td className="px-2 py-1 text-right text-zinc-300">{formatCurrency(driver.totalGross)}</td>
       <td className="px-2 py-1 text-right text-zinc-400">{formatCurrency(driver.marginAmount)}</td>
        <td className="px-2 py-1 text-right text-blue-400">{formatCurrency(driver.companyPay)}</td>
        <td className="px-2 py-1 text-right text-blue-400">{formatCurrency(driver.poCoverage)}</td>
        <td className="px-2 py-1 text-right text-zinc-400">
          {driver.totalFuel < 0 ? `-$${Math.abs(driver.totalFuel).toFixed(2)}` : `$${driver.totalFuel.toFixed(2)}`}
        </td>
        <td className={`px-2 py-1 text-right font-bold ${driver.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(driver.totalPnL)}</td>
      </tr>
      {isExpanded && (
        <tr className="bg-zinc-950/50">
          <td colSpan={8} className="p-4 border-b border-zinc-800">
            <div className="flex flex-wrap items-center justify-between bg-zinc-900/40 border border-zinc-800 p-2 rounded mb-3 gap-4">
              <div className="flex items-center gap-6">
                 <div>
                   <div className="text-[9px] text-zinc-500 uppercase font-bold">Longevity</div>
                   <div className="text-[11px] text-zinc-300">{driverStats.longevities.map(l => `${l.type}: ${l.weeks}w`).join(' | ')}</div>
                 </div>
                 <div>
                   <div className="text-[9px] text-zinc-500 uppercase font-bold">Status</div>
                   <div className="text-[11px]">
                     {driver.status === DriverStatus.TERMINATED ? (
                       <span className="text-rose-500 font-bold uppercase">Terminated</span>
                     ) : (
                       <span className="text-emerald-500 font-bold uppercase">Active</span>
                     )}
                   </div>
                 </div>
                 <div>
                   <div className="text-[9px] text-zinc-500 uppercase font-bold">Current Info</div>
                   <div className="text-[11px] text-zinc-300">{driverStats.currentCompany} ({driverStats.franchise})</div>
                 </div>
                 <div className="relative">
                   <div className="text-[9px] text-zinc-500 uppercase font-bold">Swap Status</div>
                   {driverStats.hasSwapped ? (
                     <button onClick={(e) => { e.stopPropagation(); setShowSwaps(!showSwaps); }} className="text-[10px] bg-blue-950 text-blue-400 px-2 py-0.5 rounded border border-blue-900 font-bold uppercase hover:bg-blue-900 transition-colors cursor-pointer relative z-10">
                       View Swaps ({driverStats.swapHistory.length})
                     </button>
                   ) : <span className="text-[10px] text-zinc-600 uppercase">Consistent</span>}
                   {showSwaps && (
                     <div className="absolute top-full mt-2 left-0 z-50 w-[280px] bg-zinc-800 border border-zinc-600 rounded shadow-2xl p-2 cursor-default" onClick={e => e.stopPropagation()}>
                       <div className="flex justify-between items-center mb-2 pb-1 border-b border-zinc-700">
                         <span className="text-[10px] font-bold text-zinc-300 uppercase">Swap History</span>
                         <button onClick={(e) => { e.stopPropagation(); setShowSwaps(false); }} className="text-zinc-400 hover:text-white cursor-pointer px-1">✕</button>
                       </div>
                       <div className="max-h-[120px] overflow-y-auto space-y-1">
                         {driverStats.swapHistory.map((sh, idx) => <div key={idx} className="text-[10px] text-zinc-300 font-mono">{sh}</div>)}
                       </div>
                     </div>
                   )}
                 </div>
              </div>
              <div className="flex items-center gap-3">
                <select value={selectedEntity} onChange={(e) => setSelectedEntity(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-300 outline-none focus:border-emerald-500 w-[140px] cursor-pointer">
                  <option value="TOTAL">View: Total History</option>
                  {Array.from(new Set(driver.records.map((r:any) => r.contractType))).map(c => <option key={`c-${c}`} value={`CTR:${c as string}`}>Contract: {c as string}</option>)}
                  {Array.from(new Set(driver.records.map((r:any) => r.companyId))).map(c => <option key={`cmp-${c}`} value={`CMP:${c as string}`}>Company: {c as string}</option>)}
                </select>
                <details className="relative group">
                  <summary className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-400 outline-none hover:border-emerald-500 cursor-pointer list-none flex items-center gap-2">
                    <Filter size={10} /> Metrics ({selectedMetrics.length}) <ChevronDown size={10} />
                  </summary>
                  <div className="absolute top-full right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded shadow-2xl z-[100] w-48 p-1 flex flex-col gap-0.5">
                    {['pnl', 'pnl avg/w', 'gross', 'gross avg/w', 'revenue collected', 'revenue collected avg/w', 'margin', 'margin avg/w', 'po', 'po avg/w', 'fuel', 'fuel avg/mi'].map(m => (
                      <label key={m} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800 rounded cursor-pointer text-[10px] text-zinc-300 capitalize" onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="accent-emerald-500" 
                          checked={selectedMetrics.includes(m)} 
                          onChange={() => toggleMetric(m)} 
                        />
                        {m.replace('revenue collected', 'rev')}
                      </label>
                    ))}
                  </div>
                </details>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 h-48">
                 <HistoricalChart 
                   data={historyChartData} 
                   series={activeSeries} 
                   type="line" 
                 />
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded p-2 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase">Diagnosis {selectedContract !== 'ALL' && `(${selectedContract})`}</h4>
                  <div className="group relative cursor-help text-zinc-500 hover:text-emerald-500 transition-colors">
                    <Info size={14} />
                    <div className="hidden group-hover:block absolute right-0 top-full mt-2 w-80 bg-zinc-800 text-zinc-200 text-[10px] p-3 rounded shadow-xl normal-case font-normal z-[100] pointer-events-none text-left border border-zinc-600 whitespace-normal break-words leading-tight">
                      <div className="font-bold text-emerald-400 mb-2">Performance Metrics</div>
                      
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <div>
                          <div className="font-bold text-zinc-300 mb-1 border-b border-zinc-700 pb-0.5">Standard (Gross, PnL)</div>
                          <ul className="space-y-1 ml-1">
                            <li><span className="text-emerald-500 font-bold">Good:</span> ≥ +5%</li>
                            <li><span className="text-yellow-400 font-bold">Neutral:</span> ±5%</li>
                            <li><span className="text-amber-500 font-bold">Warning:</span> -15% to -5%</li>
                            <li><span className="text-rose-500 font-bold">Critical:</span> &lt; -15%</li>
                          </ul>
                        </div>
                        <div>
                          <div className="font-bold text-zinc-300 mb-1 border-b border-zinc-700 pb-0.5">Fuel Variance</div>
                          <ul className="space-y-1 ml-1">
                            <li><span className="text-emerald-500 font-bold">Good:</span> ≥ +5%</li>
                            <li><span className="text-yellow-400 font-bold">Neutral:</span> -30% to +5%</li>
                            <li><span className="text-amber-500 font-bold">Warning:</span> -50% to -30%</li>
                            <li><span className="text-rose-500 font-bold">Critical:</span> ≤ -50%</li>
                          </ul>
                        </div>
                      </div>

                      <div className="mb-2">
                        <div className="font-bold text-zinc-300 mb-1 border-b border-zinc-700 pb-0.5">Revenue Collected (Absolute)</div>
                        <ul className="grid grid-cols-2 gap-x-2 space-y-0.5 ml-1">
                          <li><span className="text-emerald-500 font-bold">Good:</span> &gt; $200/wk</li>
                          <li><span className="text-yellow-400 font-bold">Neutral:</span> $50 to $200/wk</li>
                          <li><span className="text-amber-500 font-bold">Warning:</span> $0 to $50/wk</li>
                          <li><span className="text-rose-500 font-bold">Critical:</span> &lt; $0/wk</li>
                        </ul>
                      </div>

                      <div className="mt-2 text-[9px] text-zinc-400 italic">
                        *Base Targets: Gross: $4000/wk, PnL: $100/wk, Rev: $400/wk, Fuel: $0.50/mi (Varies by contract).
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto mb-2">
                  {issues.length === 0 ? (
                    <div className="flex items-center text-emerald-500 text-xs gap-2">
                      <CheckCircle size={14} /><span>Optimal Performance</span>
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {issues.map((issue, idx) => (
                        <li key={idx} className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1.5">
                            {issue.severity === 'critical' ? (
                              <X size={10} className="text-rose-500" />
                            ) : (
                              <AlertCircle size={10} className="text-amber-500" />
                            )}
                            <span className="text-zinc-300">{issue.label}</span>
                          </div>
                          <span className={issue.severity === 'critical' ? 'text-rose-500 font-bold' : 'text-amber-500 font-bold'}>
                            {issue.diff < 0 ? `${issue.diff.toFixed(1)}%` : `+${issue.diff.toFixed(1)}%`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-auto pt-2 border-t border-zinc-800 space-y-1">
                   {perfStats.map(stat => {
                      const getTextColor = (severity: string) => {
                         if (severity === 'good') return 'text-emerald-500';
                         if (severity === 'neutral') return 'text-yellow-400';
                         if (severity === 'warning') return 'text-amber-500';
                         return 'text-rose-500';
                      };
                      
                      const getIcon = (severity: string) => {
                        if (severity === 'good') return <CheckCircle size={10} className="text-emerald-500" />;
                        if (severity === 'neutral') return <Minus size={10} className="text-yellow-400" />;
                        if (severity === 'warning') return <AlertCircle size={10} className="text-amber-500" />;
                        return <X size={10} className="text-rose-500" />;
                      };

                      return (
                         <div key={stat.name} className="flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-1.5">
                               {stat.val === null ? <Minus size={10} className="text-zinc-600" /> : getIcon(stat.severity)}
                               <span className="text-zinc-500">{stat.name} Avg</span>
                            </div>
                            <div className="flex items-center gap-2">
                               <span className="text-zinc-300">
                                 {stat.val === null ? 'N/A' : (stat.name === 'Fuel' ? (stat.val < 0 ? `-$${Math.abs(stat.val).toFixed(2)}` : `$${stat.val.toFixed(2)}`) : formatCurrency(stat.val))}
                               </span>
                               {stat.val !== null && (
                                 <span className={`font-bold w-12 text-right ${getTextColor(stat.severity)}`}>
                                    {stat.diff > 0 ? '+' : ''}{stat.diff.toFixed(1)}%
                                 </span>
                               )}
                            </div>
                         </div>
                      );
                   })}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
});

const DriverTable: React.FC<DriverTableProps> = ({ drivers }) => {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'totalGross', direction: 'desc' });
  const [isAvgPerWeek, setIsAvgPerWeek] = useState(false);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterComp, setFilterComp] = useState<string[]>([]);
  const [filterCont, setFilterCont] = useState<string[]>([]);
  const [filterFran, setFilterFran] = useState<string[]>([]);

  const aggregatedDrivers = React.useMemo(() => {
    const map = new Map<string, any>();
    drivers.forEach(d => {
      const nameLower = (d.name || '').toLowerCase();
      const compLower = (d.companyId || '').toLowerCase();
      if (nameLower.includes('unassigned') || nameLower.includes('unreconciled') || compLower.includes('unassigned') || compLower.includes('unreconciled')) return;
      
      if (search && !nameLower.startsWith(search.toLowerCase())) return;
      if (filterComp.length > 0 && !filterComp.includes(d.companyId || '')) return;
      if (filterCont.length > 0 && !filterCont.includes(d.contractType || '')) return;
      if (filterFran.length > 0 && !filterFran.includes(d.franchiseId || '')) return;

      if (!map.has(d.name)) {
        map.set(d.name, {
          id: d.name,
          name: d.name,
          status: d.status,
          franchiseId: d.franchiseId,
          totalGross: 0,
          companyPay: 0,
          totalPnL: 0,
          marginAmount: 0,
          poCoverage: 0,
          fuelCost: 0,
          fuelSavings: 0,
          totalFuel: 0,
          tollCost: 0,
          maintenanceCost: 0,
          driverFaultExpenses: 0,
          tpogPercentages: [],
          contracts: new Set(),
          records: [],
          latestDate: d.payDate
        });
      }
      const agg = map.get(d.name);
      const pnl = (d.companyPay || 0) - (d.fixed_costs || 0) - Math.abs(d.poCoverage || 0) - Math.abs(d.recruitingCost || 0) - Math.abs(d.tollCost || 0);

      agg.totalGross += (d.totalGross || d.grossRevenue || 0);
      agg.companyPay += (d.companyPay || 0);
      agg.totalPnL += pnl;
      agg.marginAmount += (d.marginAmount || 0);
      agg.poCoverage += d.poCoverage ? -Math.abs(d.poCoverage) : 0;
      agg.fuelCost += d.fuelCost ? -Math.abs(d.fuelCost) : 0;
      agg.fuelSavings += (d.fuelSavings || 0);
      agg.totalFuel = agg.fuelCost + agg.fuelSavings;
      agg.tollCost += d.tollCost ? -Math.abs(d.tollCost) : 0;
      agg.maintenanceCost += (d.maintenanceCost || 0);
      agg.driverFaultExpenses += (d.driverFaultExpenses || 0);
      
      if (d.tpogPercentage) agg.tpogPercentages.push(d.tpogPercentage);
      if (d.contractType) agg.contracts.add(d.contractType);
      agg.records.push(d);

      if (d.payDate && (!agg.latestDate || new Date(d.payDate) > new Date(agg.latestDate))) {
        agg.latestDate = d.payDate;
        agg.status = d.status;
        agg.franchiseId = d.franchiseId;
      }
    });

    let result = Array.from(map.values()).map(agg => {
      if (isAvgPerWeek) {
        const fullWeeks = agg.records.filter((r: any) => (r.effectiveDrivers || 0) >= 1);
        const count = fullWeeks.length || 1;
        
        const grossRecs = fullWeeks.filter((r: any) => (r.totalGross || r.grossRevenue || 0) !== 0);
        const cGross = grossRecs.length || 1;
        const sumGross = grossRecs.reduce((s: number, r: any) => s + (r.totalGross || r.grossRevenue || 0), 0);
        
        const marginRecs = fullWeeks.filter((r: any) => (r.marginAmount || 0) !== 0);
        const cMargin = marginRecs.length || 1;
        const sumMargin = marginRecs.reduce((s: number, r: any) => s + (r.marginAmount || 0), 0);
        
        const poRecs = fullWeeks.filter((r: any) => (r.poCoverage ? -Math.abs(r.poCoverage) : 0) !== 0);
        const cPOCov = poRecs.length || 1;
        const sumPOCov = poRecs.reduce((s: number, r: any) => s + (r.poCoverage ? -Math.abs(r.poCoverage) : 0), 0);
        
        const compRecs = fullWeeks.filter((r: any) => (r.companyPay || 0) !== 0);
        const cCompPay = compRecs.length || 1;
        const sumCompPay = compRecs.reduce((s: number, r: any) => s + (r.companyPay || 0), 0);
        
        const fuelAggRecords = agg.records.filter((r: any) => ((r.fuelCost ? -Math.abs(r.fuelCost) : 0) + (r.fuelSavings || 0)) !== 0);
        const sumFuel = fuelAggRecords.reduce((s: number, r: any) => s + (r.fuelCost ? -Math.abs(r.fuelCost) : 0), 0);
        const sumFuelSavings = fuelAggRecords.reduce((s: number, r: any) => s + (r.fuelSavings || 0), 0);
        const sumFuelMiles = fuelAggRecords.reduce((s: number, r: any) => s + (r.milesDriven || 0), 0);
        
        const tollRecs = fullWeeks.filter((r: any) => (r.tollCost || 0) !== 0);
        const cTolls = tollRecs.length || 1;
        const sumTolls = tollRecs.reduce((s: number, r: any) => s + (r.tollCost || 0), 0);
        
        const maintRecs = fullWeeks.filter((r: any) => (r.maintenanceCost || 0) !== 0);
        const cMaint = maintRecs.length || 1;
        const sumMaint = maintRecs.reduce((s: number, r: any) => s + (r.maintenanceCost || 0), 0);
        
        const faultRecs = fullWeeks.filter((r: any) => (r.driverFaultExpenses || 0) !== 0);
        const cFaults = faultRecs.length || 1;
        const sumFaults = faultRecs.reduce((s: number, r: any) => s + (r.driverFaultExpenses || 0), 0);
        
        const pnlRecs = fullWeeks.filter((r: any) => ((r.companyPay || 0) - (r.fixed_costs || 0) - Math.abs(r.poCoverage || 0) - Math.abs(r.recruitingCost || 0) - Math.abs(r.tollCost || 0)) !== 0);
        const cPnL = pnlRecs.length || 1;
        const sumPnL = pnlRecs.reduce((s: number, r: any) => s + ((r.companyPay || 0) - (r.fixed_costs || 0) - Math.abs(r.poCoverage || 0) - Math.abs(r.recruitingCost || 0) - Math.abs(r.tollCost || 0)), 0);
        
        const tpogRecs = fullWeeks.filter((r: any) => (r.tpogPercentage || 0) !== 0);
        const cTpog = tpogRecs.length || 1;
        const sumTpog = tpogRecs.reduce((s: number, r: any) => s + (r.tpogPercentage || 0), 0);

        return {
          ...agg,
          totalGross: sumGross / cGross,
          marginAmount: sumMargin / cMargin,
          poCoverage: sumPOCov / cPOCov,
          companyPay: sumCompPay / cCompPay,
          fuelCost: sumFuelMiles > 0 ? sumFuel / sumFuelMiles : 0,
          fuelSavings: sumFuelMiles > 0 ? sumFuelSavings / sumFuelMiles : 0,
          totalFuel: sumFuelMiles > 0 ? (sumFuel + sumFuelSavings) / sumFuelMiles : 0,
          tollCost: sumTolls / cTolls,
          maintenanceCost: sumMaint / cMaint,
          driverFaultExpenses: sumFaults / cFaults,
          totalPnL: sumPnL / cPnL,
          tpogPercentage: sumTpog / cTpog,
          contracts: Array.from(agg.contracts),
          records: agg.records.sort((a: any, b: any) => new Date(a.payDate).getTime() - new Date(b.payDate).getTime())
        };
      }
      
      const avgTpog = agg.tpogPercentages.length > 0 ? agg.tpogPercentages.reduce((a: number, b: number) => a + b, 0) / agg.tpogPercentages.length : 0;
      return {
        ...agg,
        tpogPercentage: avgTpog,
        contracts: Array.from(agg.contracts),
        records: agg.records.sort((a: any, b: any) => new Date(a.payDate).getTime() - new Date(b.payDate).getTime())
      };
    });

    return result.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (sortConfig.direction === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }, [drivers, isAvgPerWeek, sortConfig, search, filterComp, filterCont, filterFran]);

  const fleetAverages = React.useMemo(() => {
    const contractAvgs: Record<string, any> = {};
    
    aggregatedDrivers.forEach(d => {
      const fullWeeks = d.records.filter((r: any) => (r.effectiveDrivers || 0) >= 1);
      fullWeeks.forEach((r: any) => {
         const cType = r.contractType || 'Unassigned';
         if (!contractAvgs[cType]) {
            contractAvgs[cType] = { 
               grossSum: 0, grossCount: 0,
               revSum: 0, revCount: 0,
               marginSum: 0, marginCount: 0,
               poCovSum: 0, poCovCount: 0,
               fuelSum: 0, fuelMilesSum: 0
            };
         }
         
         const gross = r.totalGross || 0;
         if (gross !== 0) { contractAvgs[cType].grossSum += gross; contractAvgs[cType].grossCount += 1; }
         
         const rev = r.companyPay || 0;
         if (rev !== 0) { contractAvgs[cType].revSum += rev; contractAvgs[cType].revCount += 1; }
         
         const margin = r.marginAmount || 0;
         if (margin !== 0) { contractAvgs[cType].marginSum += margin; contractAvgs[cType].marginCount += 1; }
         
         const poCov = r.poCoverage ? -Math.abs(r.poCoverage) : 0;
         if (poCov !== 0) { contractAvgs[cType].poCovSum += poCov; contractAvgs[cType].poCovCount += 1; }
         
         const fuelAmt = (r.fuelCost ? -Math.abs(r.fuelCost) : 0) + (r.fuelSavings || 0);
         if (fuelAmt !== 0) {
             contractAvgs[cType].fuelSum += fuelAmt;
             contractAvgs[cType].fuelMilesSum += (r.milesDriven || 0);
         }
      });
    });

    const result: Record<string, any> = {
      'ALL': { gross: 0, rev: 0, margin: 0, poCov: 0, fuel: 0, pnl: 100 }
    };
    
    let tGrossSum = 0, tGrossCount = 0;
    let tRevSum = 0, tRevCount = 0;
    let tMarginSum = 0, tMarginCount = 0;
    let tPoCovSum = 0, tPoCovCount = 0;
    let tFuelSum = 0, tFuelMilesSum = 0;

    Object.keys(contractAvgs).forEach(k => {
       const a = contractAvgs[k];
       
       tGrossSum += a.grossSum; tGrossCount += a.grossCount;
       tRevSum += a.revSum; tRevCount += a.revCount;
       tMarginSum += a.marginSum; tMarginCount += a.marginCount;
       tPoCovSum += a.poCovSum; tPoCovCount += a.poCovCount;
       tFuelSum += a.fuelSum; tFuelMilesSum += a.fuelMilesSum;

       result[k] = {
          gross: a.grossCount > 0 ? a.grossSum / a.grossCount : 0,
          rev: a.revCount > 0 ? a.revSum / a.revCount : 0,
          margin: a.marginCount > 0 ? a.marginSum / a.marginCount : 0,
          poCov: a.poCovCount > 0 ? a.poCovSum / a.poCovCount : 0,
          fuel: a.fuelMilesSum > 0 ? a.fuelSum / a.fuelMilesSum : 0,
          pnl: 100
       };
    });
    
    result['ALL'] = {
        gross: tGrossCount > 0 ? tGrossSum / tGrossCount : 0,
        rev: tRevCount > 0 ? tRevSum / tRevCount : 0,
        margin: tMarginCount > 0 ? tMarginSum / tMarginCount : 0,
        poCov: tPoCovCount > 0 ? tPoCovSum / tPoCovCount : 0,
        fuel: tFuelMilesSum > 0 ? tFuelSum / tFuelMilesSum : 0,
        pnl: 100
    };

    return result;
  }, [aggregatedDrivers]);

  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };
  const [visibleCount, setVisibleCount] = useState(50);

  React.useEffect(() => {
    setVisibleCount(50);
  }, [aggregatedDrivers]);

  const handleToggle = React.useCallback((id: string) => {
    setExpandedDriverId(prev => prev === id ? null : id);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const bottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop <= e.currentTarget.clientHeight + 400;
    if (bottom && visibleCount < aggregatedDrivers.length) {
      setVisibleCount(prev => prev + 50);
    }
  };

  return (
    <div className="flex flex-col h-full gap-2 relative">
      <div className="flex justify-between items-center px-1 mb-2">
        <input 
          type="text" 
          placeholder="Search driver..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-[11px] p-1.5 rounded w-64 text-zinc-300 focus:border-emerald-500 focus:outline-none" 
        />
        <div className="flex items-center gap-2">
          <div className="relative">
            <button 
              onClick={() => setShowFilters(!showFilters)} 
              className={`px-3 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${filterComp.length || filterCont.length || filterFran.length ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'}`}
            >
              FILTERS {(filterComp.length + filterCont.length + filterFran.length) > 0 ? `(${filterComp.length + filterCont.length + filterFran.length})` : ''}
            </button>
            {showFilters && (
              <div className="absolute top-full mt-2 right-0 z-50 w-[280px] bg-zinc-800 border border-zinc-600 rounded shadow-2xl p-3 flex flex-col gap-3">
                <div>
                  <div className="text-[10px] text-zinc-400 font-bold uppercase mb-1">Company</div>
                  <details className="w-full relative group">
                    <summary className="bg-zinc-950 border border-zinc-700 rounded p-1.5 text-[10px] text-zinc-300 focus:outline-none focus:border-emerald-500 cursor-pointer list-none flex justify-between items-center">
                      {filterComp.length > 0 ? `${filterComp.length} selected` : 'Select Companies...'} <ChevronDown size={10} />
                    </summary>
                    <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-950 border border-zinc-700 rounded shadow-xl z-50 max-h-32 overflow-y-auto p-1 flex flex-col gap-1">
                      {Array.from(new Set(drivers.map(d => d.companyId))).filter(Boolean).map(c => (
                        <label key={`comp-${c}`} className="flex items-center gap-2 text-[10px] text-zinc-300 cursor-pointer hover:bg-zinc-800 p-1.5 rounded">
                          <input type="checkbox" className="accent-emerald-500" checked={filterComp.includes(c as string)} onChange={(e) => {
                            if (e.target.checked) setFilterComp([...filterComp, c as string]);
                            else setFilterComp(filterComp.filter(x => x !== c));
                          }} /> {c as string}
                        </label>
                      ))}
                    </div>
                  </details>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400 font-bold uppercase mb-1">Contract</div>
                  <details className="w-full relative group">
                    <summary className="bg-zinc-950 border border-zinc-700 rounded p-1.5 text-[10px] text-zinc-300 focus:outline-none focus:border-emerald-500 cursor-pointer list-none flex justify-between items-center">
                      {filterCont.length > 0 ? `${filterCont.length} selected` : 'Select Contracts...'} <ChevronDown size={10} />
                    </summary>
                    <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-950 border border-zinc-700 rounded shadow-xl z-50 max-h-32 overflow-y-auto p-1 flex flex-col gap-1">
                      {Array.from(new Set(drivers.map(d => d.contractType))).filter(Boolean).map(c => (
                        <label key={`cont-${c}`} className="flex items-center gap-2 text-[10px] text-zinc-300 cursor-pointer hover:bg-zinc-800 p-1.5 rounded">
                          <input type="checkbox" className="accent-emerald-500" checked={filterCont.includes(c as string)} onChange={(e) => {
                            if (e.target.checked) setFilterCont([...filterCont, c as string]);
                            else setFilterCont(filterCont.filter(x => x !== c));
                          }} /> {c as string}
                        </label>
                      ))}
                    </div>
                  </details>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400 font-bold uppercase mb-1">Franchise</div>
                  <details className="w-full relative group">
                    <summary className="bg-zinc-950 border border-zinc-700 rounded p-1.5 text-[10px] text-zinc-300 focus:outline-none focus:border-emerald-500 cursor-pointer list-none flex justify-between items-center">
                      {filterFran.length > 0 ? `${filterFran.length} selected` : 'Select Franchises...'} <ChevronDown size={10} />
                    </summary>
                    <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-950 border border-zinc-700 rounded shadow-xl z-50 max-h-32 overflow-y-auto p-1 flex flex-col gap-1">
                      {Array.from(new Set(drivers.map(d => d.franchiseId))).filter(Boolean).map(c => (
                        <label key={`fran-${c}`} className="flex items-center gap-2 text-[10px] text-zinc-300 cursor-pointer hover:bg-zinc-800 p-1.5 rounded">
                          <input type="checkbox" className="accent-emerald-500" checked={filterFran.includes(c as string)} onChange={(e) => {
                            if (e.target.checked) setFilterFran([...filterFran, c as string]);
                            else setFilterFran(filterFran.filter(x => x !== c));
                          }} /> {c as string}
                        </label>
                      ))}
                    </div>
                  </details>
                </div>
                <div className="flex gap-2 mt-2 pt-2 border-t border-zinc-700">
                  <button onClick={() => { setFilterComp([]); setFilterCont([]); setFilterFran([]); }} className="w-full bg-zinc-700 hover:bg-zinc-600 text-white rounded py-1.5 text-[10px] font-bold uppercase transition-colors cursor-pointer">Clear All</button>
                </div>
              </div>
            )}
          </div>
         <button 
          onClick={() => setIsAvgPerWeek(!isAvgPerWeek)}
          className={`px-3 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${isAvgPerWeek ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'}`}
        >
          AVERAGE
        </button>
        </div>
      </div>
      <div className="overflow-auto border border-zinc-800 rounded-lg bg-zinc-900 h-full" onScroll={handleScroll}>
        <table className="w-full text-left text-[11px] whitespace-nowrap relative">
          <thead className="bg-zinc-800/50 text-zinc-400 font-medium uppercase tracking-wider sticky top-0 z-10">
            <tr>
              <th className="px-2 py-1.5 w-6 bg-zinc-900 border-b border-zinc-800"></th>
              <th onClick={() => requestSort('name')} className="px-2 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[10px] cursor-pointer hover:text-white select-none text-left">Driver</th>
              <th onClick={() => requestSort('totalGross')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] cursor-pointer hover:text-white select-none">Gross{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('marginAmount')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] cursor-pointer hover:text-white select-none">Margin{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('companyPay')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-blue-400 cursor-pointer hover:text-white select-none">Rev. Collected{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('poCoverage')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-blue-400 cursor-pointer hover:text-white select-none">PO Co Cov{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('totalFuel')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-500 cursor-pointer hover:text-white select-none">Fuel{isAvgPerWeek ? ' / mi' : ''}</th>
              <th onClick={() => requestSort('totalPnL')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] font-bold text-white cursor-pointer hover:text-emerald-400 select-none">Total PnL{isAvgPerWeek ? ' / wk' : ''}</th>
            </tr>
          </thead>
        <tbody className="divide-y divide-zinc-800 font-mono">
          {aggregatedDrivers.slice(0, visibleCount).map((driver) => (
            <DriverRow 
              key={driver.id} 
              driver={driver} 
              isExpanded={expandedDriverId === driver.id} 
              onToggle={handleToggle}
              fleetAverages={fleetAverages}
            />
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
};

export default DriverTable;