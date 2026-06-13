import React, { useState, useMemo } from 'react';
import { formatCurrency } from '../utils';
import { History, Maximize2, X, Eye, ChevronDown } from 'lucide-react';

interface PnLHistoryCardProps {
  enrichedDrivers: any[];
  calculateMetrics: (drivers: any[], isDriverView?: boolean) => any;
}

const PnLHistoryCard: React.FC<PnLHistoryCardProps> = ({ enrichedDrivers, calculateMetrics }) => {
  const [isPnlHistoryExpanded, setIsPnlHistoryExpanded] = useState(false);
  const [pnlHistoryGroupBy, setPnlHistoryGroupBy] = useState<'Company' | 'Contract' | 'Franchise' | 'Team'>('Contract');
  const [pnlHistoryFilterValue, setPnlHistoryFilterValue] = useState<string>('');
  const [isPnlHistoryAverageView, setIsPnlHistoryAverageView] = useState(false);

  const pnlHistoryOptions = useMemo(() => {
    const options = new Set<string>();
    let hasTpogFranchise = false;
    enrichedDrivers.forEach(d => {
      if (pnlHistoryGroupBy === 'Company' && d.companyId) options.add(d.companyId);
      if (pnlHistoryGroupBy === 'Contract' && d.contractType) {
          options.add(d.contractType);
          if (d.contractType === 'TPOG' && d.franchiseId) hasTpogFranchise = true;
      }
      if (pnlHistoryGroupBy === 'Franchise' && d.franchiseId) options.add(d.franchiseId);
      if (pnlHistoryGroupBy === 'Team' && d.teamId) options.add(d.teamId);
    });
    const arr = Array.from(options).filter(opt => {
       if (opt === 'UNRECONCILED' || opt === 'Unassigned') return false;
       if (pnlHistoryGroupBy === 'Contract' && ['TCPML', 'MCLPOO', 'CPML'].includes(opt)) return false;
       return true;
    }).sort();
    if (pnlHistoryGroupBy === 'Contract' && hasTpogFranchise) {
        arr.push('TPOG (Franchise PnL)');
    }
    return arr;
  }, [enrichedDrivers, pnlHistoryGroupBy]);

  const resolvedPnlFilter = useMemo(() => {
     if (pnlHistoryOptions.includes(pnlHistoryFilterValue)) return pnlHistoryFilterValue;
     return pnlHistoryOptions.length > 0 ? pnlHistoryOptions[0] : '';
  }, [pnlHistoryGroupBy, pnlHistoryFilterValue, pnlHistoryOptions]);

  const pnlHistory = useMemo(() => {
    const groups: { [date: string]: any[] } = {};
    enrichedDrivers.forEach(d => {
      if (!d.payDate) return;
      if (!groups[d.payDate]) groups[d.payDate] = [];
      groups[d.payDate].push(d);
    });

    const calcAggregated = (groupDrivers: any[]) => {
        const driversByName = new Map<string, any[]>();
        groupDrivers.forEach(d => {
            const name = d.name || 'Unknown';
            if (!driversByName.has(name)) driversByName.set(name, []);
            driversByName.get(name)!.push(d);
        });
        let netIncome = 0;
        let nt = 0;
        driversByName.forEach(drvRecords => {
            const m = calculateMetrics(drvRecords, true);
            netIncome += m.netIncome;
            nt += m.effNonTeamsCount > 0 ? m.effNonTeamsCount : m.effCount;
        });
        return { netIncome, nt };
    };

    const history = Object.keys(groups).map(date => {
              const weekDrivers = groups[date];
              
              const totalMetrics = calcAggregated(weekDrivers);
              let totalNetIncome = totalMetrics.netIncome;
              const totalNT = totalMetrics.nt;

              const tpogFranchiseDrivers = weekDrivers.filter(d => d.contractType === 'TPOG' && !!d.franchiseId).map(d => ({
                  ...d,
                  companyPay: (d as any).franchise_revenue_collected || 0,
                  fixed_costs: (d as any).franchise_fixed_costs_full || 0,
                  poCoverage: (d as any).franchise_po ? -Math.abs(Number((d as any).franchise_po)) : 0,
                  poAmount: (d as any).franchise_po || 0,
                  ...((d as any).franchise_fixed_breakdown || {}),
                  isFranchiseStub: true
              }));

              let fNetIncome = 0;
              let fNt = 0;
              if (tpogFranchiseDrivers.length > 0) {
                  const driversByName = new Map<string, any[]>();
                  tpogFranchiseDrivers.forEach(d => {
                      const name = d.name || 'Unknown';
                      if (!driversByName.has(name)) driversByName.set(name, []);
                      driversByName.get(name)!.push(d);
                  });
                  driversByName.forEach(drvRecords => {
                      const m = calculateMetrics(drvRecords, true);
                      fNetIncome += (m.netIncome + (m.excludedPoTotal || 0)) / 2;
                      fNt += (m.effNonTeamsCount > 0 ? m.effNonTeamsCount : m.effCount) / 2;
                  });
                  totalNetIncome -= fNetIncome;
              }
              
              const entityData: Record<string, { amount: number, nt: number }> = {};
      pnlHistoryOptions.forEach(opt => entityData[opt] = { amount: 0, nt: 0 });

      const groupedByEntity = new Map<string, any[]>();
      weekDrivers.forEach(d => {
           let groupKey = 'Unknown';
           if (pnlHistoryGroupBy === 'Company') groupKey = d.companyId || 'Unknown';
           else if (pnlHistoryGroupBy === 'Contract') groupKey = d.contractType || 'Unknown';
           else if (pnlHistoryGroupBy === 'Franchise') groupKey = d.franchiseId || 'Unknown';
           else if (pnlHistoryGroupBy === 'Team') groupKey = d.teamId || 'Unknown';
           
           if (!groupedByEntity.has(groupKey)) groupedByEntity.set(groupKey, []);
           groupedByEntity.get(groupKey)!.push(d);
      });

      groupedByEntity.forEach((records, entityKey) => {
          if (entityData[entityKey] !== undefined) {
              const m = calcAggregated(records);
              entityData[entityKey] = { amount: m.netIncome, nt: m.nt };
          }
      });
      
      if (pnlHistoryGroupBy === 'Contract' && entityData['TPOG'] !== undefined) {
          entityData['TPOG'].amount -= fNetIncome;
      }
      
      if (pnlHistoryGroupBy === 'Contract' && entityData['TPOG (Franchise PnL)'] !== undefined) {
          entityData['TPOG (Franchise PnL)'].amount = fNetIncome;
          entityData['TPOG (Franchise PnL)'].nt = fNt;
      }

      return { 
         date,
         totalAmount: totalNetIncome,
         totalNT,
         entityData
      };
    });

    const sortedHistory = history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
return sortedHistory.length > 6 ? sortedHistory.slice(0, -6) : sortedHistory;
  }, [enrichedDrivers, calculateMetrics, pnlHistoryGroupBy, pnlHistoryOptions]);

  return (
    <>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-0 flex flex-col flex-1 min-h-0 overflow-hidden relative">
        <div className="p-3 border-b border-zinc-800 bg-zinc-950/30 flex justify-between items-center flex-shrink-0">
           <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
             <History size={12} className="text-emerald-500" /> PNL History
           </h4>
           <button 
             onClick={() => setIsPnlHistoryExpanded(true)}
             className="text-zinc-500 hover:text-emerald-400 transition-colors" 
           >
             <Maximize2 size={12} />
           </button>
        </div>
        <div className="flex-1 overflow-y-auto">
           <table className="w-full text-[10px]">
             <thead className="bg-zinc-900 text-zinc-500 sticky top-0">
                <tr>
                   <th className="px-2 py-1 text-left font-medium">Pay Date</th>
                   <th className="px-2 py-1 text-right font-medium">Total PnL</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-zinc-800/50">
                {pnlHistory.length > 0 ? (
                  pnlHistory.map((item, idx) => (
                     <tr key={idx} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-2 py-0.5 text-zinc-400 font-mono">
                           {(() => {
                              const d = new Date(item.date);
                              return `${d.getUTCFullYear().toString().slice(-2)}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
                           })()}
                        </td>
                        <td className={`px-2 py-0.5 text-right font-mono font-bold ${item.totalAmount >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                           {item.totalAmount < 0 ? '-' : ''}{formatCurrency(Math.abs(item.totalAmount))}
                        </td>
                     </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-3 py-4 text-center text-zinc-600">No data available</td>
                  </tr>
               )}
             </tbody>
           </table>
        </div>
      </div>

      {isPnlHistoryExpanded && (
         <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
           <div className="bg-zinc-950 border border-zinc-800 rounded-lg w-full h-full max-w-7xl flex flex-col shadow-2xl overflow-hidden">
             <div className="flex justify-between items-center p-3 border-b border-zinc-800 bg-zinc-900/50">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                   <History size={16} className="text-emerald-500" />
                   Detailed PNL History
                </h2>
                <div className="flex items-center gap-3">
                   <div className="relative flex items-center">
                     <Eye size={12} className="absolute left-2 text-zinc-500 pointer-events-none" />
                     <select
                           value={pnlHistoryGroupBy}
                           onChange={(e) => {
                               setPnlHistoryGroupBy(e.target.value as any);
                               e.target.blur();
                           }}
                           className="peer appearance-none bg-zinc-950 border border-zinc-800 rounded pl-6 pr-6 py-1 text-zinc-400 focus:text-white font-sans text-[10px] font-normal focus:outline-none focus:border-zinc-600 w-32 cursor-pointer"
                         >
                           <option value="Contract">By Contract</option>
                           <option value="Company">By Company</option>
                           <option value="Franchise">By Franchise</option>
                           <option value="Team">By Team</option>
                         </select>
                     <ChevronDown size={10} className="absolute right-2 text-zinc-500 pointer-events-none transition-transform peer-focus:rotate-180" />
                   </div>
                   <button
                     onClick={() => setIsPnlHistoryAverageView(!isPnlHistoryAverageView)}
                     className={`px-2 py-1 rounded text-[10px] font-sans font-normal border transition-colors flex justify-start items-center text-left ${isPnlHistoryAverageView ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'}`}
                   >
                     AVG / DRV
                   </button>
                   <button 
                    onClick={() => {
                        setIsPnlHistoryExpanded(false);
                        setPnlHistoryGroupBy('Contract');
                        setIsPnlHistoryAverageView(false);
                    }}
                    className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors ml-2"
                   >
                      <X size={18} />
                   </button>
                </div>
             </div>
             
             <div className="flex-1 overflow-auto">
                 {pnlHistory.length > 0 ? (
                    <table className="w-full text-xs border-collapse relative">
                       <thead className="sticky top-0 z-20 shadow-md">
                          <tr>
                             <th className="bg-zinc-900 px-2 py-1 text-left font-medium uppercase tracking-wider border-b border-zinc-800 text-zinc-400 whitespace-nowrap">Pay Date</th>
                             <th className="bg-zinc-900 px-2 py-1 text-right font-medium uppercase tracking-wider border-b border-zinc-800 text-zinc-400 whitespace-nowrap">Total PnL</th>
                             {pnlHistoryOptions.map(opt => (
                                 <th key={opt} className="bg-zinc-900 px-2 py-1 text-right font-medium uppercase tracking-wider border-b border-zinc-800 text-zinc-400 whitespace-nowrap">{opt}</th>
                             ))}
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-zinc-800/50">
                          {pnlHistory.map((item, idx) => {
                             const d = new Date(item.date);
                             const formattedDate = `${d.getUTCFullYear().toString().slice(-2)}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
                             
                             return (
                                <tr key={idx} className="bg-zinc-900/40 hover:bg-zinc-800/40 transition-colors whitespace-nowrap">
                                   <td className="px-2 py-0.5 font-bold text-zinc-200">{formattedDate}</td>
                                   <td className={`px-2 py-0.5 text-right font-mono font-bold ${item.totalAmount >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                      {(() => {
                                          const val = isPnlHistoryAverageView ? (item.totalNT > 0 ? item.totalAmount / item.totalNT : item.totalAmount) : item.totalAmount;
                                          return (val < 0 ? '-' : '') + formatCurrency(Math.abs(val));
                                      })()}
                                   </td>
                                   {pnlHistoryOptions.map(opt => {
                                       const data = item.entityData[opt] || { amount: 0, nt: 0 };
                                       const val = isPnlHistoryAverageView ? (data.nt > 0 ? data.amount / data.nt : data.amount) : data.amount;
                                       return (
                                           <td key={opt} className={`px-2 py-0.5 text-right font-mono font-medium ${val >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                                              {val < 0 ? '-' : ''}{formatCurrency(Math.abs(val))}
                                           </td>
                                       );
                                   })}
                                </tr>
                             );
                          })}
                       </tbody>
                    </table>
                 ) : (
                    <div className="flex justify-center items-center h-full text-zinc-500">No history data available.</div>
                 )}
             </div>
           </div>
         </div>
      )}
    </>
  );
};

export default PnLHistoryCard;