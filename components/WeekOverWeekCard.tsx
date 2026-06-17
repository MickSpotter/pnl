import React, { useMemo } from 'react';
import { 
    TrendingUp, 
    DollarSign, 
    Coins, 
    Fuel, 
    CreditCard, 
    ClipboardList, 
    Ticket, 
    Headset, 
    UserPlus,
    Info
} from 'lucide-react';
import { formatCurrency } from '../utils';

const WeekOverWeekCard = ({ enrichedDrivers, calculateMetrics, selectedDate, tableFilters = [] }: any) => {
    const data = useMemo(() => {
        const allowedFilters = ['Company', 'Team', 'Franchise', 'Contract'];
        const activeFilters = tableFilters.filter((f: any) => allowedFilters.includes(f.field));
        
        let filteredDrivers = enrichedDrivers;
        if (activeFilters.length > 0) {
            filteredDrivers = enrichedDrivers.filter((d: any) => {
                return activeFilters.every((rule: any) => {
                    if (!rule.field || !rule.operator) return true;
                    
                    const isNoValueOp = rule.operator === 'is empty' || rule.operator === 'is not empty';
                    const hasNoValue = rule.value === undefined || rule.value === null || rule.value === '' || (Array.isArray(rule.value) && rule.value.length === 0);
                    
                    if (!isNoValueOp && hasNoValue) return true;

                    let fieldValue: any;
                    switch (rule.field) {
                        case 'Contract': fieldValue = d.contractType; break;
                        case 'Company': fieldValue = d.companyId; break;
                        case 'Team': fieldValue = d.teamId; break;
                        case 'Franchise': fieldValue = d.franchiseId; break;
                        default: return true;
                    }
                    const isEmptyValue = fieldValue === undefined || fieldValue === null || String(fieldValue).trim() === '' || String(fieldValue).trim() === 'Unassigned';
                    if (rule.operator === 'is empty') return isEmptyValue;
                    if (rule.operator === 'is not empty') return !isEmptyValue;
                    
                    const safeVal = String(fieldValue || 'Unassigned');
                    const selectedValues = Array.isArray(rule.value) ? rule.value : [rule.value];
                    if (rule.operator === 'is one of') return selectedValues.includes(safeVal);
                    if (rule.operator === 'is not one of') return !selectedValues.includes(safeVal);
                    if (rule.operator === 'is') return selectedValues.length > 0 && selectedValues[0] === safeVal;
                    if (rule.operator === 'is not') return selectedValues.length > 0 && selectedValues[0] !== safeVal;
                return true;
                });
            });
        }

        const uniqueDates = Array.from(new Set(filteredDrivers.map((d: any) => d.payDate))).filter(Boolean).sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime());
        
        let targetDate = selectedDate;
        if (targetDate === 'ALL' || targetDate === 'LATEST') {
            targetDate = uniqueDates[0];
        }
        
        const targetIndex = uniqueDates.indexOf(targetDate);
        const currDate = targetIndex >= 0 ? uniqueDates[targetIndex] : null;
        const prevDate = targetIndex >= 0 && targetIndex + 1 < uniqueDates.length ? uniqueDates[targetIndex + 1] : null;

        const getCompanyMetricsForDate = (date: string) => {
            const dateDrivers = filteredDrivers.filter((d: any) => d.payDate === date);
            if (!dateDrivers.length) return null;
            
            const rawMetrics = calculateMetrics(dateDrivers, false);
            
            let netIncome = rawMetrics.netIncome;
            const franchiseDrivers = dateDrivers.filter((d: any) => d.contractType === 'TPOG' && !!d.franchiseId).map((d: any) => ({
                 ...d,
                 companyPay: d.franchise_revenue_collected || 0,
                 fixed_costs: d.franchise_fixed_costs_full || 0,
                 poCoverage: d.franchise_po ? -Math.abs(Number(d.franchise_po)) : 0,
                 poAmount: d.franchise_po || 0,
                 po_breakdown: d.franchise_po_breakdown,
                 ...(d.franchise_fixed_breakdown || {}),
                 isFranchiseStub: true
             }));
             
             if (franchiseDrivers.length > 0) {
                 let fNet = 0;
                 const fNames = Array.from(new Set(franchiseDrivers.map((d: any) => d.name))).filter(Boolean);
                 fNames.forEach((n: any) => {
                     const drvs = franchiseDrivers.filter((d: any) => d.name === n);
                     const m = calculateMetrics(drvs, true);
                     fNet += ((m.netIncome - (m.pnlBalanceChange || 0) - (m.pnlEscrowAdj || 0)) + (m.excludedPoTotal || 0)) / 2 + (m.pnlBalanceChange || 0) + (m.pnlEscrowAdj || 0);
                 });
                 netIncome -= fNet;
             }
             
             return {
                 netIncome,
                 revCollected: rawMetrics.pnlCompanyPay !== undefined ? rawMetrics.pnlCompanyPay : rawMetrics.companyPay,
                 fuel: rawMetrics.pnlFuel !== undefined ? rawMetrics.pnlFuel : rawMetrics.fuel,
                 spotterFuel: rawMetrics.wosFuel !== undefined ? rawMetrics.wosFuel : 0,
                 weeklyExpenses: rawMetrics.pnlAllocatedFixed !== undefined ? rawMetrics.pnlAllocatedFixed : rawMetrics.allocatedFixed,
                 po: rawMetrics.pnlTotalPOCov !== undefined ? rawMetrics.pnlTotalPOCov : rawMetrics.totalPOCov,
                 tolls: rawMetrics.pnlTolls !== undefined ? rawMetrics.pnlTolls : rawMetrics.tolls,
                 dispatcherPay: rawMetrics.dispatcherPay,
                 recruiting: rawMetrics.pnlTotalRecruiting !== undefined ? rawMetrics.pnlTotalRecruiting : rawMetrics.totalRecruiting
             };
        };

        const currMetrics = currDate ? getCompanyMetricsForDate(currDate as string) : null;
        const prevMetrics = prevDate ? getCompanyMetricsForDate(prevDate as string) : null;

        return { currDate, currMetrics, prevMetrics };
    }, [enrichedDrivers, calculateMetrics, selectedDate, tableFilters]);

    if (!data.currMetrics) return null;

    const formatDateObj = (dateStr: string) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
        return dateStr;
    };

    const dateSuffix = data.currDate ? ` (${formatDateObj(data.currDate as string)})` : '';

    const items = [
        { key: 'revCollected', label: 'Revenue Collected', isExpense: false, icon: Coins },
        { key: 'fuel', label: 'Fuel', isExpense: true, icon: Fuel },
        { key: 'spotterFuel', label: 'P/L with Spotter Fuel', isExpense: true, icon: Fuel },
        { key: 'weeklyExpenses', label: 'Weekly Expenses', isExpense: true, icon: CreditCard },
        { key: 'po', label: 'PO', isExpense: true, icon: ClipboardList },
        { key: 'tolls', label: 'Tolls', isExpense: true, icon: Ticket },
        { key: 'dispatcherPay', label: 'Dispatcher Pay', isExpense: true, icon: Headset },
        { key: 'recruiting', label: 'Recruiting', isExpense: true, icon: UserPlus }
    ];

    return (
        <div className="w-full xl:w-[220px] bg-zinc-900 border border-zinc-800 rounded-lg px-2 pb-2 flex flex-col gap-2 overflow-y-auto min-h-0 flex-shrink-0">
           <div className="flex items-center justify-between mb-1 sticky top-0 bg-zinc-900 z-10 pt-2 pb-1 border-b border-zinc-800/50">
               <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-100 uppercase tracking-wider">
                   <TrendingUp size={12} className="text-amber-500" />
                   Week-over-Week
               </div>
               <div className="group/wowinfo relative flex items-center cursor-help">
                   <Info size={12} className="text-zinc-500 hover:text-zinc-300 transition-colors" />
                   <div className="absolute hidden group-hover/wowinfo:block z-[99999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-2 rounded-lg shadow-2xl text-[10px] normal-case text-left w-[200px] pointer-events-none top-full right-0 mt-1 whitespace-normal break-words font-normal">
                       This card shows week-over-week financial dynamics. It dynamically adjusts when you filter the master table by Company, Franchise, Team, or Contract.
                   </div>
               </div>
           </div>
           <div className="flex flex-col gap-2">
               {items.map(item => {
                   const currVal = Math.abs(data.currMetrics[item.key] || 0);
                   const prevVal = data.prevMetrics ? Math.abs(data.prevMetrics[item.key] || 0) : 0;
                   
                   const diff = currVal - prevVal;
                   const diffPct = prevVal !== 0 ? (diff / prevVal) * 100 : 0;
                   
                   const isUp = diff >= 0;
                   const arrow = isUp ? '↗' : '↘';
                   const pctStr = `${Math.abs(diffPct).toFixed(1)}%`;
                   const diffStr = diff >= 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff);
                   
                   let colorClass = 'text-zinc-500';
                   if (diff !== 0) {
                      const isGood = item.isExpense ? diff < 0 : diff > 0;
                      colorClass = isGood ? 'text-emerald-600' : 'text-rose-600';
                   }

                   return (
                       <div key={item.key} className="flex items-start gap-1.5 border-b border-zinc-800/50 pb-1.5 last:border-0 last:pb-0">
                          <div className="text-zinc-400 mt-[1px] flex-shrink-0">
                              <item.icon size={12} />
                          </div>
                          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                             <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold truncate mb-1">
                                 {item.label}
                             </div>
                            <div className="flex items-center justify-between w-full">
                                 <div className="text-[11px] font-bold text-white font-mono leading-none">
                                     {formatCurrency(currVal)}
                                 </div>
                                 <div className={`flex items-center text-[9px] font-medium font-mono ${colorClass} leading-none`}>
                                     <div className="w-[45px] text-right">{arrow} {pctStr}</div>
                                     <div className="w-[65px] text-right text-zinc-500">({diffStr})</div>
                                 </div>
                             </div>
                          </div>
                       </div>
                   );
               })}
           </div>
        </div>
    );
};

export default WeekOverWeekCard;