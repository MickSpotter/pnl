

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { DriverPerformance, DriverStatus, SimulationConfig, ExpenseItem, FinImportRecord } from '../types';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils';
import { Sliders, LayoutList, PieChart, DollarSign, TrendingUp, BarChart3, LineChart, Maximize2, X, History, Filter, Info, ChevronDown, Check, LayoutDashboard, Activity, Truck, Container } from 'lucide-react';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import SimulationModal from './SimulationModal';
import HistoricalChart, { ChartSeries } from './HistoricalChart';
import Simulator from './Simulator';

let hasPlayedInitialAnimations = false;

interface PnLViewProps {
  allDrivers?: DriverPerformance[];
  drivers: DriverPerformance[];
  simulationConfig: SimulationConfig;
  setSimulationConfig: (config: SimulationConfig) => void;
  fixedExpenses: ExpenseItem[];
  setFixedExpenses: (expenses: ExpenseItem[]) => void;
  onSaveExpenses?: (expenses: ExpenseItem[]) => Promise<void> | void;
  finImportData: FinImportRecord[];
  fixedCostsData?: any[];
  configContracts?: any[];
  onReady?: () => void;
  onDataSync?: () => void;
  globalFilter?: any;
  setGlobalFilter?: (val: any) => void;
  currentRole?: string;
}

const MultiSelectDropdown = ({ label, options, selected, onChange }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  return (
    <div className="relative" ref={wrapperRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded px-2 py-1.5 text-zinc-300 font-sans text-[10px] w-full text-left flex justify-between items-center transition-colors">
        <span className="truncate">{selected?.length > 0 ? `${label} (${selected.length})` : label}</span>
        <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-[10000] max-h-48 overflow-y-auto p-1 flex flex-col gap-0.5">
          <button onClick={() => { onChange([]); setIsOpen(false); }} className="text-left px-2 py-1 text-[9px] text-rose-400 hover:bg-zinc-800 rounded font-bold">Clear All</button>
          {options.map((opt: string) => (
            <label key={opt} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800 rounded cursor-pointer text-[10px] text-zinc-300">
              <input type="checkbox" checked={selected?.includes(opt)} onChange={(e) => {
                if (e.target.checked) onChange([...(selected || []), opt]);
                else onChange((selected || []).filter((x: string) => x !== opt));
              }} className="rounded bg-zinc-950 border-zinc-700 accent-emerald-500" />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

// Sub-component for the Master Table to handle reuse in Modal
const MasterTable: React.FC<{
   companyMetrics: any,
   drivers: DriverPerformance[],
   calculateMetrics: (d: DriverPerformance[], isDriverView?: boolean) => any,
  totalActiveCount: number,
  selectedDate?: string,
  groupBy: 'Contract' | 'Company' | 'Franchise' | 'Team' | 'Driver',
  chartData?: any[],
  isAverageView?: boolean
}> = ({ companyMetrics, drivers, calculateMetrics, totalActiveCount, selectedDate, groupBy, chartData = [], isAverageView = false }) => {
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'netIncome', direction: 'desc' });
  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const val = (amount: number, divisor: number) => isAverageView ? (divisor > 0 ? amount / divisor : 0) : amount;
  const uniqueContracts = Array.from(new Set(drivers.map(d => d.contractType || 'Unassigned'))).sort();
  const uniqueCompanies = Array.from(new Set(drivers.map(d => d.companyId || 'Unassigned'))).filter(c => c !== 'Unassigned' && !/^Company\s*\d*$/i.test(String(c))).sort();
  const uniqueFranchises = Array.from(new Set(drivers.map(d => d.franchiseId || 'Unassigned'))).sort();
  const uniqueTeams = Array.from(new Set(drivers.map(d => d.teamId || 'Unassigned'))).sort();
  const uniqueDrivers = Array.from(new Set(drivers.map(d => d.name || 'Unassigned'))).sort();
  const driverRows = [...drivers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      const getAggregatedMetrics = (groupDrivers: DriverPerformance[]) => {
          const driversByName = new Map<string, DriverPerformance[]>();
          groupDrivers.forEach(d => {
              const name = d.name || 'Unknown';
              if (!driversByName.has(name)) driversByName.set(name, []);
              driversByName.get(name)!.push(d);
          });
          const t = {
            rawEffCount: 0, effCount: 0, effNonTeamsCount: 0, effTrailersCount: 0, gross: 0, companyPay: 0,
            margin: 0, fuelSavings: 0, cogs: 0, dispatcherPay: 0, allocatedFixed: 0, baseFixed: 0, adjFixed: 0, totalPO: 0, totalPOCov: 0,
            totalEscrow: 0, totalBalance: 0, totalRecruiting: 0, netIncome: 0, effNonTeams: 0, pnlPerDriver: 0,
            driverPay: 0, fuel: 0, maint: 0, tolls: 0, faults: 0
          };
          driversByName.forEach((drvRecords) => {
            const m = calculateMetrics(drvRecords, true);
            
            t.rawEffCount += m.rawEffCount;
            t.effCount += m.effCount;
            t.effNonTeamsCount += m.effNonTeamsCount;
            t.effTrailersCount += m.effTrailersCount;
            t.gross += m.gross;
            t.companyPay += m.companyPay;
            t.margin += m.margin;
            t.fuelSavings += m.fuelSavings;
            t.cogs += m.cogs;
            t.dispatcherPay += m.dispatcherPay;
            t.allocatedFixed += m.allocatedFixed;
            t.baseFixed += m.baseFixed || 0;
            t.adjFixed += m.adjFixed || 0;
            t.totalPO += m.totalPO;
            t.totalPOCov += m.totalPOCov;
            t.totalEscrow += m.totalEscrow;
            t.totalBalance += m.totalBalance;
            t.totalRecruiting += m.totalRecruiting;
            t.netIncome += m.netIncome;
            t.effNonTeams += m.effNonTeams;
            t.driverPay += m.driverPay || 0;
            t.fuel += m.fuel || 0;
            t.maint += m.maint || 0;
            t.tolls += m.tolls || 0;
            t.faults += m.faults || 0;
          });
          t.pnlPerDriver = t.effNonTeams > 0 ? t.netIncome / t.effNonTeams : 0;
          return t;
        };

      const show4w = selectedDate !== 'ALL';
      const get4wMetrics = (entityName: string) => {
        if (!chartData || chartData.length === 0) return { sum: 0, avg: 0 };
        const last4 = chartData.slice(-4);
        let sum = 0;
        last4.forEach(row => {
          const key = `${entityName}_netIncome`;
          if (row[key] !== undefined) {
            sum += row[key];
          }
        });
        return { sum, avg: sum / 4 };
      };

  const groupedDrivers = useMemo(() => {
                 const map = new Map<string, DriverPerformance[]>();
                 drivers.forEach(d => {
                    const key = groupBy === 'Contract' ? d.contractType :
                                groupBy === 'Company' ? d.companyId :
                                groupBy === 'Franchise' ? d.franchiseId :
                                groupBy === 'Team' ? d.teamId : d.name;
                    const safeKey = key || 'Unassigned';
        if (!map.has(safeKey)) map.set(safeKey, []);
        map.get(safeKey)!.push(d);
     });
     return map;
  }, [drivers, groupBy]);

  const dynamicTotals = (() => {
        let rows: { name: string, drivers: DriverPerformance[] }[] = [];
        if (groupBy === 'Company') {
          rows = uniqueCompanies.map(name => ({ name, drivers: groupedDrivers.get(name || 'Unassigned') || [] }));
        } else if (groupBy === 'Contract') {
          rows = uniqueContracts.map(name => ({ name, drivers: groupedDrivers.get(name || 'Unassigned') || [] }));
        } else if (groupBy === 'Franchise') {
          rows = uniqueFranchises.map(name => ({ name, drivers: groupedDrivers.get(name || 'Unassigned') || [] }));
        } else if (groupBy === 'Team') {
          rows = uniqueTeams.map(name => ({ name, drivers: groupedDrivers.get(name || 'Unassigned') || [] }));
        } else if (groupBy === 'Driver') {
          rows = driverRows.map(d => ({ name: d.name, drivers: [d] }));
        }
        const t = getAggregatedMetrics(drivers);
        const overallW4 = get4wMetrics('COMPANY');
        return { ...t, w4Sum: overallW4.sum, w4Avg: overallW4.avg };
      })();

  const sortArray = (arr: any[], type: string) => {
     if (!sortConfig) return arr;

     const computedArr = arr.map(item => {
        let name = type === 'Driver' ? (item.name || 'Unassigned') : (item || 'Unassigned');
        let drvs = type === 'Driver' ? [item] : (groupedDrivers.get(name) || []);
        const metrics = getAggregatedMetrics(drvs);
        const w4 = get4wMetrics(name);
        const div = metrics.effNonTeamsCount > 0 ? metrics.effNonTeamsCount : metrics.effCount;
        return { original: item, name, drvs, metrics, w4, div };
     });

     computedArr.sort((a, b) => {
        let aVal: any = 0; 
        let bVal: any = 0;

        if (sortConfig.key === 'name') { 
            aVal = a.name; 
            bVal = b.name; 
        }
        else if (sortConfig.key === 'companyId') { 
            aVal = a.original.companyId || ''; 
            bVal = b.original.companyId || ''; 
        }
        else if (sortConfig.key === 'teamId') { 
            aVal = a.original.teamId || ''; 
            bVal = b.original.teamId || ''; 
        }
        else if (sortConfig.key === 'franchiseId') { 
            aVal = a.original.franchiseId || ''; 
            bVal = b.original.franchiseId || ''; 
        }
        else if (sortConfig.key === 'contractType') { 
            aVal = a.original.contractType || ''; 
            bVal = b.original.contractType || ''; 
        }
        else if (sortConfig.key === 'w4Sum') { 
            aVal = val(a.w4.sum, a.div); 
            bVal = val(b.w4.sum, b.div); 
        }
        else if (sortConfig.key === 'w4Avg') { 
            aVal = val(a.w4.avg, a.div); 
            bVal = val(b.w4.avg, b.div); 
        }
        else { 
            aVal = val((a.metrics as any)[sortConfig.key] || 0, a.div); 
            bVal = val((b.metrics as any)[sortConfig.key] || 0, b.div); 
        }

        if (typeof aVal === 'string') return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
     });

     return computedArr.map(item => item.original);
  };
  const renderRowCells = (metrics: any, w4: any) => {
    const div = metrics.effNonTeamsCount > 0 ? metrics.effNonTeamsCount : metrics.effCount;
    return (
    <>
      {!isAverageView && <td className="px-1 py-0.5 text-right text-white">{groupBy === 'Driver' ? `${Math.round(metrics.effCount * 7)}/7` : Math.round(metrics.effCount)}</td>}
      {!isAverageView && <td className="px-1 py-0.5 text-right text-white">{Math.round(metrics.effNonTeamsCount)}</td>}
      {!isAverageView && <td className="px-1 py-0.5 text-right text-white">{Math.round(metrics.effTrailersCount)}</td>}
      <td className="px-1 py-0.5 text-right text-yellow-400">{formatCurrency(val(metrics.gross, div))}</td>
      <td className="px-1 py-0.5 text-right text-yellow-400 font-medium">{formatCurrency(val(metrics.margin, div))}</td>
      <td className="px-1 py-0.5 text-right text-blue-400">{formatCurrency(val(metrics.companyPay, div))}</td>
      <td className="px-1 py-0.5 text-right text-blue-400">-{formatCurrency(Math.abs(val(metrics.allocatedFixed, div)))}</td>
      <td className="px-1 py-0.5 text-right text-blue-400">{val(metrics.tolls, div) === 0 ? formatCurrency(0) : `-${formatCurrency(Math.abs(val(metrics.tolls, div)))}`}</td>
      <td className="px-1 py-0.5 text-right text-blue-400">{formatCurrency(val(metrics.totalPOCov, div))}</td>
       <td className="px-1 py-0.5 text-right text-blue-400">{formatCurrency(val(metrics.totalRecruiting, div))}</td>
       <td className="px-1 py-0.5 text-right text-blue-400">{val(metrics.fuel, div) < 0 ? `-${formatCurrency(Math.abs(val(metrics.fuel, div)))}` : formatCurrency(val(metrics.fuel, div))}</td>
       {show4w && <td className="px-1 py-0.5 text-right font-medium text-orange-300">{formatCurrency(val(w4.sum, div))}</td>}
      {show4w && <td className="px-1 py-0.5 text-right font-bold text-orange-300">{formatCurrency(val(w4.avg, div))}</td>}
      <td className={`px-1 py-0.5 text-right font-medium sticky z-10 bg-zinc-950 group-hover:bg-zinc-900 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.5)] w-[80px] min-w-[80px] max-w-[80px] right-0 ${val(metrics.netIncome, div) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
        {formatCurrency(val(metrics.netIncome, div))}
      </td>
    </>
    );
  };
  
  return (
    <div className="overflow-auto flex-1 h-full relative">
      <table className="w-full min-h-full h-full text-left text-[11px] whitespace-nowrap">
        <thead className="bg-zinc-950 text-zinc-500 font-medium uppercase sticky top-0 z-[60] shadow-sm select-none">
         <tr>
            <th onClick={() => requestSort('name')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-[10px] sticky left-0 z-30 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)] cursor-pointer hover:text-white">Segment {sortConfig?.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
            {!isAverageView && groupBy === 'Driver' && (
              <>
                <th onClick={() => requestSort('companyId')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-left text-zinc-400 text-[10px] cursor-pointer hover:text-white">Company {sortConfig?.key === 'companyId' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => requestSort('teamId')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-left text-zinc-400 text-[10px] cursor-pointer hover:text-white">Team {sortConfig?.key === 'teamId' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => requestSort('franchiseId')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-left text-zinc-400 text-[10px] cursor-pointer hover:text-white">Franchise {sortConfig?.key === 'franchiseId' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => requestSort('contractType')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-left text-zinc-400 text-[10px] cursor-pointer hover:text-white">Contract {sortConfig?.key === 'contractType' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
              </>
            )}
            {!isAverageView && <th onClick={() => requestSort('effCount')} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-white text-[10px] cursor-pointer hover:text-emerald-400">
              Eff Drv {sortConfig?.key === 'effCount' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
              <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left mt-6 w-[280px] pointer-events-none transform -translate-x-1/2 flex flex-col gap-1.5 whitespace-normal break-words">
                <div><span className="font-bold text-white">Effective Drivers Calculation:</span><br/>Result = Days Worked / 7.0</div>
                <div><span className="font-bold text-white">Days Worked Formula:</span><br/>(Pay End Date - Pay Start Date) + 1</div>
              </div>
            </th>}
            {!isAverageView && <th onClick={() => requestSort('effNonTeamsCount')} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-white text-[10px] cursor-pointer hover:text-emerald-400">
              Eff NonTm {sortConfig?.key === 'effNonTeamsCount' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
              <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left mt-6 w-[320px] pointer-events-none transform -translate-x-1/2 flex flex-col gap-2 whitespace-normal break-words">
                <div><span className="font-bold text-white">Effective Non Teams Calculation:</span><br/>Result = Eligible Days / 7.0</div>
                <div><span className="font-bold text-white">Eligible Days:</span></div>
                <ul className="list-disc pl-4 flex flex-col gap-1">
                  <li><span className="font-semibold text-zinc-300">If Contract is NOT POG or TPOG:</span><br/>Days Worked * 1 (if ANY of these &gt; 0: ELD, IFTA, Maintenance Support, Trailer, Trailer PHD, Truck Weekly + Truck Float, Truck PHD) Otherwise 0.</li>
                  <li><span className="font-semibold text-zinc-300">If Contract IS POG or TPOG:</span><br/>Equals Days Worked.</li>
                </ul>
              </div>
            </th>}
            {!isAverageView && <th onClick={() => requestSort('effTrailersCount')} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-white text-[10px] cursor-pointer hover:text-emerald-400">
              Eff Trls {sortConfig?.key === 'effTrailersCount' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
              <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left mt-6 w-[300px] pointer-events-none transform -translate-x-1/2 flex flex-col gap-1.5 whitespace-normal break-words">
                <div className="font-bold text-white mb-0.5">Effective Trailers Calculation:</div>
                <ul className="list-disc pl-4 flex flex-col gap-1">
                  <li><span className="font-semibold text-zinc-300">For TCPML, TPOG, CPM:</span> Matches Effective Non Teams value.</li>
                  <li><span className="font-semibold text-zinc-300">Others:</span> If Trailer &gt; 0 OR Contract Type = 'POG' -&gt; Days Worked / 7.0 Otherwise 0.</li>
                </ul>
              </div>
            </th>}
           <th onClick={() => requestSort('gross')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-yellow-400 text-[10px] cursor-pointer hover:text-yellow-300">
              Gross {sortConfig?.key === 'gross' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => requestSort('margin')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-yellow-400 text-[10px] cursor-pointer hover:text-yellow-300">Margin {sortConfig?.key === 'margin' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                         
            <th onClick={() => requestSort('companyPay')} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-blue-400 text-[10px] cursor-pointer hover:text-blue-300">
              <div className="flex items-center justify-end gap-1">
                Rev Coll. {sortConfig?.key === 'companyPay' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
              </div>
              <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left mt-6 w-[450px] pointer-events-none transform -translate-x-[80%] flex flex-col gap-2 whitespace-normal break-words">
                <div className="font-bold text-white text-[11px] border-b border-zinc-600 pb-1">Revenue Collected Calculation:</div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-blue-300">Step 1: Revenue Base</span>
                  <div className="pl-2">Formulas are configured in Contract Rules within Structural Settings.</div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-blue-300">Step 2: Balance Change</span>
                  <div className="pl-2">If Balance Change &lt; 0, adds it to Revenue Base. Balance Change = -PO Deducts + PO Settle + Neg. Net Pay + Bal. Settle.</div>
                  <ul className="list-disc pl-6 text-[9px] flex flex-col gap-0.5">
                    <li><span className="font-semibold text-zinc-300">MCLOO:</span> Multiplied by 0.3.</li>
                  </ul>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-blue-300">Step 3: Add Prorated Fixed Costs</span>
                  <div className="pl-2">Adds: ((Truck Float + Truck Weekly + Occ Ins + ELD + IFTA + Maintenance Support + Liability + Truck PHD) * Effective Non Teams) + ((Trailer + Trailer PHD) * Effective Trailers).</div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-blue-300">Step 4: Fuel Adjustments</span>
                  <ul className="list-disc pl-4 text-[9px] flex flex-col gap-0.5">
                    <li><span className="font-semibold text-zinc-300">MCLOO, OO, LOO, LPOO, MCOO:</span> Adds Fuel Saved. Fuel Saved is calculated by taking (Retail Price - Discounted Price) * Quantity.</li>
                    <li><span className="font-semibold text-zinc-300">TPOG, POG, CPM &amp; Others:</span> Subtracts Fuel Spent. Fuel Spent is calculated by taking Discounted Price * Quantity.</li>
                  </ul>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-blue-300">Step 5: Zero-Mile Cap</span>
                  <div className="pl-2">If Total Miles = 0 and previous result &gt; 0, it is set to 0.</div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-blue-300">Step 6: Escrow Addition (Skipped for MCLOO)</span>
                  <div className="pl-2">Covers negative driver pay using their escrow deduction. Triggers ONLY if Net Pay is less than 0. Adds the negative Net Pay amount OR the Escrow Deduct amount, whichever is smaller (covers the debt up to the escrow limit).</div>
                </div>
              </div>
            </th>
           <th onClick={() => requestSort('allocatedFixed')} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-blue-400 text-[10px] cursor-pointer hover:text-blue-300">
              Fixed {sortConfig?.key === 'allocatedFixed' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
              <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left mt-6 w-[450px] pointer-events-none transform -translate-x-[80%] flex flex-col gap-2 whitespace-normal break-words">
                <div className="font-bold text-white text-[11px] border-b border-zinc-600 pb-1">Fixed Cost Calculation &amp; Components:</div>
                <div className="text-zinc-300">Base Fixed Costs depend on the contract type:</div>
                <div className="flex flex-col gap-1 pl-2 border-l-2 border-zinc-600">
                  <div><span className="font-semibold text-blue-300">1. Owner Operator (OO):</span> Includes: Liability, Cargo, Telematics, Admin Fees, Factoring, and Trailer costs (if pulling company trailer).</div>
                  <div className="text-[9px] text-zinc-400 pl-4 italic">* Exception: OO does NOT pay for Truck Price, Truck Physical Damage, or Plates.</div>
                  <div className="mt-1"><span className="font-semibold text-blue-300">2. All Other Contracts (CPM, POG, TPOG, MCLOO, LOO, etc.):</span> Includes: Liability, Cargo, Truck Physical Damage, Truck Price, Plates, Telematics, Admin Fees, Trailer costs, and Factoring.</div>
                  <div className="text-[9px] text-zinc-400 pl-4 italic">* Admin Fees = Phone/Internet + Office Supplies + Rent/Parking + Backup MC + Backoffice.</div>
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-white">Proration Rule:</span><br/>
                  <div className="pl-2 mt-0.5">Once the Base Fixed Cost is calculated, it is prorated based on the days worked:<br/><span className="text-emerald-400 font-mono">Result = Base Fixed Cost * (Days Worked / 7.0)</span></div>
                </div>
                <div>
                  <span className="font-semibold text-rose-300">Special Exception:</span> For 'TPOG with Franchise' contracts, the final prorated amount is divided by 2.0 (split 50/50).
                </div>
              </div>
            </th>
           <th onClick={() => requestSort('tolls')} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-blue-400 text-[10px] cursor-pointer hover:text-blue-300">
                      Tolls {sortConfig?.key === 'tolls' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                      <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left mt-6 w-[300px] pointer-events-none transform -translate-x-[80%] flex flex-col gap-1.5 whitespace-normal break-words">
                        <div className="font-bold text-white mb-0.5">Tolls Calculation:</div>
                        <div className="text-zinc-300">Total toll amount incurred during the pay period.</div>
                        <div className="font-semibold text-white mt-1">Calculation Rules:</div>
                        <ul className="list-disc pl-4 flex flex-col gap-1">
                          <li><span className="font-semibold text-blue-300">Exception (MCLOO):</span> Tolls are completely skipped (Result = 0).</li>
                          <li><span className="font-semibold text-blue-300">All Other Contracts:</span> The full toll amount is applied.<br/><span className="text-emerald-400 font-mono text-[9px]">Result = Toll Amount</span></li>
                        </ul>
                      </div>
                    </th>
                   <th onClick={() => requestSort('totalPOCov')} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-blue-400 text-[10px] cursor-pointer hover:text-blue-300">
                   PO Co Cov {sortConfig?.key === 'totalPOCov' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                   <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left mt-6 w-[450px] pointer-events-none transform -translate-x-[80%] flex flex-col gap-1.5 whitespace-normal break-words">
                     <div className="font-bold text-white text-[11px] border-b border-zinc-600 pb-1">PO Company Coverage (PO Co Cov) Calculation:</div>
                     <div className="text-zinc-300">This column shows the total Purchase Order amount covered by the company. Note: Execution priority goes from top to bottom.</div>
                     <div className="font-semibold text-white mt-1">Calculation Rules:</div>
                     <ul className="list-none flex flex-col gap-1.5">
                       <li className="pl-2 border-l-2 border-rose-500"><span className="font-semibold text-rose-300">1. TPOG with Franchise:</span><br/>If expense reason includes 'Hotel' or 'Flights/Car' &rarr; <span className="text-emerald-400 font-mono text-[9px]">Result = 0</span> (Not a company cost)<br/>Otherwise &rarr; <span className="text-emerald-400 font-mono text-[9px]">Result = PO Amount - Deduction Amount</span></li>
                       <li className="pl-2 border-l-2 border-purple-500"><span className="font-semibold text-purple-300">2. MCLOO Contract:</span><br/><span className="text-emerald-400 font-mono text-[9px]">Result = (PO Amount - Deduction Amount) * 0.3</span></li>
                       <li className="pl-2 border-l-2 border-blue-500"><span className="font-semibold text-blue-300">3. 'Company Pay' &amp; Fuel Charges:</span><br/>If charge category is 'Company Pay', 'Deduction to MC', or Fuel costs ('CADV', 'SCLE'):<br/><span className="text-emerald-400 font-mono text-[9px]">Result = Full PO Amount</span></li>
                       <li className="pl-2 border-l-2 border-zinc-500"><span className="font-semibold text-zinc-300">4. Standard Calculation (All Others):</span><br/><span className="text-emerald-400 font-mono text-[9px]">Result = PO Amount - Deduction Amount</span></li>
                     </ul>
                   </div>
                 </th>
                 <th onClick={() => requestSort('totalRecruiting')} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-blue-400 text-[10px] cursor-pointer hover:text-blue-300">
                   Recruiting {sortConfig?.key === 'totalRecruiting' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                   <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left mt-6 w-[300px] pointer-events-none transform -translate-x-[80%] flex flex-col gap-1.5 whitespace-normal break-words">
                     <div className="font-bold text-white mb-0.5">Recruiting Cost Calculation:</div>
                     <div>Total recruiting cost from financial import for the specific contract type (CPM, MCLOO, OO, POG) divided by total effective non-teams for that contract, then multiplied by the individual driver's effective non-teams count.</div>
                   </div>
                 </th>
                 <th onClick={() => requestSort('fuel')} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-blue-400 text-[10px] cursor-pointer hover:text-blue-300">
                   Fuel {sortConfig?.key === 'fuel' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                   <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left mt-6 w-[320px] pointer-events-none transform -translate-x-[80%] flex flex-col gap-1.5 whitespace-normal break-words">
                     <div className="font-bold text-white mb-0.5">Fuel Calculation:</div>
                     <ul className="list-disc pl-4 flex flex-col gap-1">
                       <li><span className="font-semibold text-emerald-400">Positive Values (Fuel Saved):</span> For MCLOO, OO, LOO, LPOO, MCOO contracts. <br/>Calculation: <span className="font-mono text-[9px]">(Retail Price - Discounted Price) * Quantity</span></li>
                       <li><span className="font-semibold text-rose-400">Negative Values (Fuel Spent):</span> For TPOG, POG, CPM &amp; Others. <br/>Calculation: <span className="font-mono text-[9px]">Discounted Price * Quantity</span></li>
                     </ul>
                   </div>
                 </th>
                 {show4w && <th onClick={() => requestSort('w4Sum')} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-orange-300 text-[10px] cursor-pointer hover:text-orange-200">
                   PnL 4w {sortConfig?.key === 'w4Sum' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                   <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left mt-6 w-[250px] pointer-events-none transform -translate-x-1/2 flex flex-col gap-1 whitespace-normal break-words">
                     <div className="font-bold text-white">4-Week PnL Sum:</div>
                     <div>The total combined PnL (Net Income) for the displayed row over the last 4 available weeks in the dataset.</div>
                   </div>
                 </th>}
                 {show4w && <th onClick={() => requestSort('w4Avg')} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-orange-300 text-[10px] cursor-pointer hover:text-orange-200">
                   4w Avg {sortConfig?.key === 'w4Avg' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                   <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left mt-6 w-[250px] pointer-events-none transform -translate-x-[90%] flex flex-col gap-1 whitespace-normal break-words">
                     <div className="font-bold text-white">4-Week PnL Average:</div>
                     <div>The average weekly PnL (Net Income) for the displayed row calculated over the last 4 available weeks.</div>
                   </div>
                 </th>}
                 <th onClick={() => requestSort('netIncome')} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right font-bold text-white text-[10px] sticky right-0 z-20 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.5)] w-[80px] min-w-[80px] max-w-[80px] cursor-pointer hover:text-emerald-400">
                   Total PnL {sortConfig?.key === 'netIncome' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                   <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left mt-6 w-[320px] pointer-events-none transform -translate-x-[90%] flex flex-col gap-1.5 whitespace-normal break-words">
                     <div className="font-bold text-white mb-0.5">Total PnL (Net Income) Calculation:</div>
                     <div className="text-emerald-400 font-mono bg-zinc-900/50 p-2 rounded border border-zinc-700">PnL = Revenue Collected - Fixed - PO Co Cov - Recruiting - Tolls</div>
                   </div>
                 </th>
               </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50 font-mono">
          {groupBy === 'Company' && sortArray(uniqueCompanies, 'Company').map(companyName => {
            const compDrivers = groupedDrivers.get(companyName || 'Unassigned') || [];
            const metrics = getAggregatedMetrics(compDrivers);
            const w4 = get4wMetrics(companyName);
            return (
              <tr key={companyName} className="group hover:bg-zinc-800/20 transition-colors">
                <td className="px-1 py-0.5 text-zinc-300 pl-4 font-sans sticky left-0 z-10 bg-zinc-950 group-hover:bg-zinc-900 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)]">{companyName}</td>
                {renderRowCells(metrics, w4)}
              </tr>
            );
          })}
         {groupBy === 'Contract' && sortArray(uniqueContracts, 'Contract').map(contractName => {
            const compDrivers = groupedDrivers.get(contractName || 'Unassigned') || [];
            const metrics = getAggregatedMetrics(compDrivers);
            const w4 = get4wMetrics(contractName);
            return (
              <tr key={contractName} className="group hover:bg-zinc-800/20 transition-colors">
                <td className="px-1 py-0.5 font-bold text-emerald-400 font-sans sticky left-0 z-10 bg-zinc-950 group-hover:bg-zinc-900 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)]">{contractName}</td>
                {renderRowCells(metrics, w4)}
              </tr>
            );
          })}
         {groupBy === 'Franchise' && sortArray(uniqueFranchises, 'Franchise').map(franchiseName => {
             const displayLabel = (!franchiseName || franchiseName === 'Unassigned') ? 'No Franchise' : franchiseName;
             const franDrivers = groupedDrivers.get(franchiseName || 'Unassigned') || [];
             const metrics = getAggregatedMetrics(franDrivers);
             const w4 = get4wMetrics(franchiseName);
             return (
              <tr key={franchiseName} className="group hover:bg-zinc-800/20 transition-colors">
                <td className="px-1 py-0.5 text-zinc-300 pl-4 font-sans sticky left-0 z-10 bg-zinc-950 group-hover:bg-zinc-900 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)]">{displayLabel}</td>
                {renderRowCells(metrics, w4)}
              </tr>
             );
          })}
                     
         {groupBy === 'Team' && sortArray(uniqueTeams, 'Team').map(teamName => {
            const displayLabel = (!teamName || teamName === 'Unassigned') ? 'No Team' : teamName;
            const teamDrivers = groupedDrivers.get(teamName || 'Unassigned') || [];
            const metrics = getAggregatedMetrics(teamDrivers);
            const w4 = get4wMetrics(teamName);
            return (
              <tr key={teamName} className="group hover:bg-zinc-800/20 transition-colors">
                <td className="px-1 py-0.5 text-zinc-300 pl-4 font-sans sticky left-0 z-10 bg-zinc-950 group-hover:bg-zinc-900 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)]">{displayLabel}</td>
                {renderRowCells(metrics, w4)}
              </tr>
            );
          })}
          {!isAverageView && groupBy === 'Driver' && sortArray(driverRows, 'Driver').map((d, idx) => {
          const displayLabel = (!d.name || d.name === 'Unassigned') ? 'Unknown Driver' : d.name;
          const drvRecords = groupedDrivers.get(d.name || 'Unassigned') || [];
          const metrics = getAggregatedMetrics([d]);
          const w4 = get4wMetrics(d.name);
          const isSwap = drvRecords.length > 1;
            return (
              <tr key={`${d.id}_${idx}`} className="group hover:bg-zinc-800/20 transition-colors">
                <td className="px-1 py-0.5 text-zinc-300 pl-4 font-sans sticky left-0 z-10 group-hover:z-[100] bg-zinc-950 group-hover:bg-zinc-900 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center gap-1.5">
                    <span>{displayLabel}</span>
                    {isSwap && (
                      <div className="group/swap relative flex items-center cursor-help">
                        <Info size={12} className="text-blue-400" />
                        <div className="absolute hidden group-hover/swap:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-2 rounded-lg shadow-2xl text-[10px] whitespace-nowrap pointer-events-none top-0 left-full ml-2">
                          <span className="font-bold text-blue-400">SWAP:</span> {d.companyId || 'Unknown'} ({d.contractType || 'Unknown'})
                        </div>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-1 py-0.5 text-zinc-500 text-left font-sans truncate max-w-[100px]">{d.companyId || '-'}</td>
                <td className="px-1 py-0.5 text-zinc-500 text-left font-sans truncate max-w-[80px]">{d.teamId || '-'}</td>
                <td className="px-1 py-0.5 text-zinc-500 text-left font-sans truncate max-w-[80px]">{d.franchiseId || '-'}</td>
                <td className="px-1 py-0.5 text-zinc-500 text-left font-sans truncate max-w-[80px]">{d.contractType || '-'}</td>
                {renderRowCells(metrics, w4)}
              </tr>
            );
          })}
                     
          <tr className="h-full">
            <td className="p-0 border-0 pointer-events-none sticky left-0 z-10 bg-zinc-950 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)]" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 25px, #27272a 25px, #27272a 26px)', backgroundPosition: 'top left' }}></td>
            {!isAverageView && groupBy === 'Driver' && Array.from({ length: 4 }).map((_, i) => (
              <td key={`empty-driver-cols-${i}`} className="p-0 border-0 pointer-events-none bg-transparent" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 25px, #27272a 25px, #27272a 26px)', backgroundPosition: 'top left' }}></td>
            ))}
            {!isAverageView && Array.from({ length: 3 }).map((_, i) => (
              <td key={`empty-counts-${i}`} className="p-0 border-0 pointer-events-none bg-transparent" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 25px, #27272a 25px, #27272a 26px)', backgroundPosition: 'top left' }}></td>
            ))}
            {Array.from({ length: 8 }).map((_, i) => (
               <td key={`empty-metrics-${i}`} className="p-0 border-0 pointer-events-none bg-transparent" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 25px, #27272a 25px, #27272a 26px)', backgroundPosition: 'top left' }}></td>
             ))}
            {show4w && <td className="p-0 border-0 pointer-events-none bg-transparent" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 25px, #27272a 25px, #27272a 26px)', backgroundPosition: 'top left' }}></td>}
            {show4w && <td className="p-0 border-0 pointer-events-none bg-transparent" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 25px, #27272a 25px, #27272a 26px)', backgroundPosition: 'top left' }}></td>}
            <td className="p-0 border-0 pointer-events-none sticky right-0 z-10 bg-zinc-950 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.5)] w-[80px] min-w-[80px] max-w-[80px]" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 25px, #27272a 25px, #27272a 26px)', backgroundPosition: 'top left' }}></td>
          </tr>
        </tbody>
        <tfoot className="sticky bottom-0 z-40 bg-zinc-950 border-t-2 border-zinc-800 shadow-[0_-1px_0_rgba(255,255,255,0.1)]">
          <tr className="font-bold font-mono">
            {(() => {
                const div = dynamicTotals.effNonTeamsCount > 0 ? dynamicTotals.effNonTeamsCount : dynamicTotals.effCount;
                return (
                  <>
                    <td className="px-1 py-1 text-white font-sans text-[10px] sticky left-0 z-50 bg-zinc-950 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)]">TOTAL</td>
                    {!isAverageView && groupBy === 'Driver' && (
                      <>
                        <td className="px-1 py-1 bg-zinc-950"></td>
                        <td className="px-1 py-1 bg-zinc-950"></td>
                        <td className="px-1 py-1 bg-zinc-950"></td>
                        <td className="px-1 py-1 bg-zinc-950"></td>
                      </>
                    )}
                    {!isAverageView && <td className="px-1 py-1 text-right text-white">{Math.round(dynamicTotals.effCount)}</td>}
                    {!isAverageView && <td className="px-1 py-1 text-right text-white">{Math.round(dynamicTotals.effNonTeamsCount)}</td>}
                    {!isAverageView && <td className="px-1 py-1 text-right text-white">{Math.round(dynamicTotals.effTrailersCount)}</td>}
                    <td className="px-1 py-1 text-right text-yellow-400">{formatCurrency(val(dynamicTotals.gross, div))}</td>
                    <td className="px-1 py-1 text-right text-yellow-400 font-bold">{formatCurrency(val(dynamicTotals.margin, div))}</td>
                    <td className="px-1 py-1 text-right text-blue-400">{formatCurrency(val(dynamicTotals.companyPay, div))}</td>
                    <td className="px-1 py-1 text-right text-blue-400">-{formatCurrency(Math.abs(val(dynamicTotals.allocatedFixed, div)))}</td>
                    <td className="px-1 py-1 text-right text-blue-400">{val(dynamicTotals.tolls, div) === 0 ? formatCurrency(0) : `-${formatCurrency(Math.abs(val(dynamicTotals.tolls, div)))}`}</td>
                    <td className="px-1 py-1 text-right text-blue-400">{formatCurrency(val(dynamicTotals.totalPOCov, div))}</td>
                     <td className="px-1 py-1 text-right text-blue-400">{formatCurrency(val(dynamicTotals.totalRecruiting, div))}</td>
                     <td className="px-1 py-1 text-right text-blue-400">{val(dynamicTotals.fuel, div) < 0 ? `-${formatCurrency(Math.abs(val(dynamicTotals.fuel, div)))}` : formatCurrency(val(dynamicTotals.fuel, div))}</td>
                     {show4w && <td className="px-1 py-1 text-right font-medium text-orange-300">{formatCurrency(val(dynamicTotals.w4Sum, div))}</td>}
                    {show4w && <td className="px-1 py-1 text-right text-xs font-bold text-orange-300">{formatCurrency(val(dynamicTotals.w4Avg, div))}</td>}
                    <td className={`px-1 py-1 text-right text-xs sticky z-20 bg-zinc-950 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.5)] w-[80px] min-w-[80px] max-w-[80px] right-0 ${val(dynamicTotals.netIncome, div) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {formatCurrency(val(dynamicTotals.netIncome, div))}
                    </td>
                  </>
                );
            })()}
          </tr>
        </tfoot>
      </table>
    </div>
  );
};


// Main Component
const PnLView: React.FC<PnLViewProps> = ({ 
  allDrivers,
  drivers, 
  simulationConfig, 
  setSimulationConfig,
  fixedExpenses,
  setFixedExpenses,
  onSaveExpenses,
  finImportData,
  fixedCostsData,
  configContracts,
  onReady,
  onDataSync,
  globalFilter,
  setGlobalFilter,
  currentRole
}) => {
  const allUniqueCompanies = useMemo(() => {
    const companies = Array.from(new Set((allDrivers || drivers).map(d => d.companyId)));
    return companies.filter(c => c && c !== 'Unknown').sort() as string[];
  }, [allDrivers, drivers]);
  const allUniqueFranchises = useMemo(() => Array.from(new Set((allDrivers || drivers).map(d => d.franchiseId))).filter(Boolean).sort() as string[], [allDrivers, drivers]);
  const allUniqueTeams = useMemo(() => Array.from(new Set((allDrivers || drivers).map(d => d.teamId))).filter(Boolean).sort() as string[], [allDrivers, drivers]);
  const driverWithEffectiveContractsGlobal = useMemo(() => {
      const src = allDrivers || drivers;
      return src.map(d => {
          let effContract = d.contractType;
          if (d.contractType === 'TPOG' && d.franchiseId) {
              effContract = 'TPOG WITH FRANCHISE';
          } else if (d.contractType === 'OO' && d.franchiseId && src.some(m => m.contractType === 'MCLOO' && m.franchiseId === d.franchiseId)) {
              effContract = 'OO WITH FRANCHISE';
          }
          return { ...d, contractType: effContract };
      });
  }, [allDrivers, drivers]);

  const allUniqueContracts = useMemo(() => Array.from(new Set(driverWithEffectiveContractsGlobal.map(d => d.contractType))).filter(Boolean).sort() as string[], [driverWithEffectiveContractsGlobal]);
 const allUniqueDrivers = useMemo(() => Array.from(new Set((allDrivers || drivers).map(d => d.name))).filter(Boolean).sort() as string[], [allDrivers, drivers]);
  
  const getDependentOptions = useCallback((category: string) => {
    let subset = allDrivers || [];
    const gf = globalFilter || {};
    if (category !== 'contracts' && gf.contracts?.length > 0) subset = subset.filter(d => gf.contracts.includes(d.contractType));
    if (category !== 'franchises' && gf.franchises?.length > 0) subset = subset.filter(d => gf.franchises.includes(d.franchiseId));
    if (category !== 'companies' && gf.companies?.length > 0) subset = subset.filter(d => gf.companies.includes(d.companyId));
    if (category !== 'teams' && gf.teams?.length > 0) subset = subset.filter(d => gf.teams.includes(d.teamId));
    if (category !== 'drivers' && gf.drivers?.length > 0) subset = subset.filter(d => gf.drivers.includes(d.name));

    let rawOptions: string[] = [];
    if (category === 'contracts') rawOptions = subset.map(d => d.contractType || '');
    if (category === 'franchises') rawOptions = subset.map(d => d.franchiseId || '');
    if (category === 'companies') rawOptions = subset.map(d => d.companyId || '');
    if (category === 'teams') rawOptions = subset.map(d => d.teamId || '');
    if (category === 'drivers') rawOptions = subset.map(d => d.name || '');

    return Array.from(new Set(rawOptions)).filter(Boolean).sort() as string[];
  }, [allDrivers, globalFilter]);

  const updateGlobalFilter = (category: string, selected: string[]) => {
    if (setGlobalFilter) {
      setGlobalFilter({ ...(globalFilter || {}), [category]: selected });
    }
  };

  const clearAllFilters = () => {
    if (setGlobalFilter) {
      setGlobalFilter({ contracts: [], franchises: [], companies: [], teams: [], drivers: [] });
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [groupBy, setGroupBy] = useState<'Contract' | 'Company' | 'Franchise' | 'Team' | 'Driver'>('Contract');
  const [isAverageView, setIsAverageView] = useState(false);
  
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [chartWeeksLimit, setChartWeeksLimit] = useState<number | 'ALL'>('ALL');
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);
  const [isEntitiesOpen, setIsEntitiesOpen] = useState(false);
  const metricsRef = useRef<HTMLDivElement>(null);
  const entitiesRef = useRef<HTMLDivElement>(null);
  const [isMainTableFilterOpen, setIsMainTableFilterOpen] = useState(false);
  const mainTableFilterRef = useRef<HTMLDivElement>(null);
  const [isExpandedTableFilterOpen, setIsExpandedTableFilterOpen] = useState(false);
  const expandedTableFilterRef = useRef<HTMLDivElement>(null);
  const [selectedEntities, setSelectedEntities] = useState<string[]>(['COMPANY']);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['netIncome']);

  const uniqueDates = useMemo(() => {
    const dates = Array.from(new Set(drivers.map(d => d.payDate).filter(Boolean)));
    const sortedDates = dates.sort((a, b) => {
       const dateA = new Date(a as string).getTime();
       const dateB = new Date(b as string).getTime();
       return dateB - dateA;
    });
    return sortedDates.length > 1 ? sortedDates.slice(0, -1) : sortedDates;
  }, [drivers]);

  const [selectedDate, setSelectedDate] = useState<string>('LATEST');

  // Auto-select latest date when data loads
  useEffect(() => {
    if (uniqueDates.length > 0 && selectedDate === 'LATEST') {
      setSelectedDate(uniqueDates[0] as string);
    } else if (uniqueDates.length > 0 && selectedDate !== 'ALL' && !uniqueDates.includes(selectedDate)) {
      // If selected date no longer exists in current filtered set (rare but possible), reset
      setSelectedDate(uniqueDates[0] as string);
    }
  }, [uniqueDates, selectedDate]);

  const latestPayDate = useMemo(() => {
    if (uniqueDates.length > 0) return uniqueDates[0];
    return null;
  }, [uniqueDates]);

  const parsedFinImportData = useMemo(() => {
    return (finImportData || []).map(record => {
      if (!record.week_ending) return { ...record, _weTime: 0 };
      const weD = new Date(record.week_ending);
      weD.setUTCHours(0,0,0,0);
      return { ...record, _weTime: weD.getTime() };
    });
  }, [finImportData]);

  const finImportByDate = useMemo(() => {
    const map: Record<string, any> = {};
    uniqueDates.forEach(date => {
      if (!date) return;
      const payD = new Date(date as string);
      payD.setUTCHours(0,0,0,0);
      
      let matches = parsedFinImportData.filter(record => {
        if (!record._weTime) return false;
        const diffDays = Math.round((payD.getTime() - record._weTime) / (1000 * 60 * 60 * 24));
        return diffDays >= 1 && diffDays <= 6;
      });

      if (matches.length === 0 || Math.max(...matches.map((m: any) => m.num_of_trucks || 0)) === 0) {
          const pastRecords = parsedFinImportData.filter(r => r._weTime && r._weTime <= payD.getTime() && (r.num_of_trucks > 0 || r.num_of_trailers > 0)).sort((a, b) => b._weTime - a._weTime);
          if (pastRecords.length > 0) {
              const closestTime = pastRecords[0]._weTime;
              matches = parsedFinImportData.filter(record => record._weTime === closestTime);
          }
      }
      
      let avgTruckPrice = 0;
      let avgTrailerPrice = 0;
      let rawFinImportData = null;
      let globalTrucks = 0;
      let globalTrailers = 0;

      if (matches.length > 0) {
         const globalMatch = matches.find((m: any) => m.num_of_trucks > 0) || matches[0];
         avgTruckPrice = globalMatch.avg_truck_price || 0;
         avgTrailerPrice = globalMatch.avg_trailer_price || 0;
         rawFinImportData = globalMatch;
         globalTrucks = Math.max(...matches.map((m: any) => m.num_of_trucks || 0));
         globalTrailers = Math.max(...matches.map((m: any) => m.num_of_trailers || 0));
      }
      map[date as string] = { matches, avgTruckPrice, avgTrailerPrice, rawFinImportData, globalTrucks, globalTrailers };
    });
    return map;
  }, [parsedFinImportData, uniqueDates]);

  const getActiveAmount = useCallback((expName: string, currentDate: string | null, companyId?: string, activeCompanyCount: number = 1) => {
    const currTime = currentDate ? new Date(currentDate).getTime() : Date.now();
    
    const evaluateExp = (matchedExp: ExpenseItem) => {
          if (matchedExp.threshold_date) {
              const threshTime = new Date(matchedExp.threshold_date).getTime();
              if (currTime < threshTime) {
                  return matchedExp.amount_before !== undefined ? matchedExp.amount_before : (matchedExp.amount || 0);
              } else {
                  return matchedExp.amount_after !== undefined ? matchedExp.amount_after : (matchedExp.amount || 0);
              }
          }
          const isComplex = ['Liability Insurance (Global)', 'Cargo Insurance', 'Physical Damage'].includes(matchedExp.name);
          if (isComplex && matchedExp.amount_before !== undefined) {
              return matchedExp.amount_before;
          }
          return matchedExp.amount || 0;
      };

    if (companyId) {
        let exps = fixedExpenses.filter(e => e.name.toLowerCase().includes(expName.toLowerCase()) && e.companyId === companyId);
        
        if (exps.length > 0) {
            let matchedExp = exps.find(e => {
                const fromTime = e.valid_from ? new Date(e.valid_from).getTime() : -Infinity;
                const toTime = e.valid_to ? new Date(e.valid_to).getTime() : Infinity;
                return currTime >= fromTime && currTime <= toTime;
            }) || exps[0];
            return { amount: evaluateExp(matchedExp), unit: matchedExp.unit || '$', exp: matchedExp };
        } else {
            let allExps = fixedExpenses.filter(e => e.name.toLowerCase().includes(expName.toLowerCase()) && e.companyId === 'ALL');
            if (allExps.length > 0) {
                let matchedExp = allExps.find(e => {
                    const fromTime = e.valid_from ? new Date(e.valid_from).getTime() : -Infinity;
                    const toTime = e.valid_to ? new Date(e.valid_to).getTime() : Infinity;
                    return currTime >= fromTime && currTime <= toTime;
                }) || allExps[0];
                
                let val = evaluateExp(matchedExp);
                
                return { amount: val, unit: matchedExp.unit || '$', exp: matchedExp };
            }
        }
        return { amount: 0, unit: '$', exp: undefined };
    } else {
        const exps = fixedExpenses.filter(e => e.name.toLowerCase().includes(expName.toLowerCase()));
        if (exps.length === 0) return { amount: 0, unit: '$', exp: undefined };
        
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
        
        return { amount: evaluateExp(matchedExp as any), unit: matchedExp?.unit || '$', exp: matchedExp };
    }
  }, [fixedExpenses]);

  const globalStatsByDate = useMemo(() => {
    const stats: Record<string, { nonTeams: number, effTrailers: number, totalDrivers: number }> = {};
    const sourceDrivers = allDrivers && allDrivers.length > 0 ? allDrivers : drivers;
    if (!sourceDrivers) return stats;
    sourceDrivers.forEach(d => {
      if (!d.payDate) return;
      if (!stats[d.payDate]) stats[d.payDate] = { nonTeams: 0, effTrailers: 0, totalDrivers: 0 };
      stats[d.payDate].totalDrivers += 1;
      if (d.contractType !== 'OO') {
        stats[d.payDate].nonTeams += (d.effectiveNonTeams || 0);
      }
      stats[d.payDate].effTrailers += ((d as any).effectiveTrailers || 0);
    });
    return stats;
  }, [allDrivers, drivers]);

  const companyStatsMap = useMemo(() => {
    const stats: Record<string, { nonTeamsNoOO: number, effTrailers: number, nonTeams: number }> = {};
    const sourceDrivers = allDrivers && allDrivers.length > 0 ? allDrivers : drivers;
    if (!sourceDrivers) return stats;
    sourceDrivers.forEach(d => {
      if (!d.payDate || !d.companyId) return;
      const key = `${d.payDate}_${d.companyId}`;
      if (!stats[key]) stats[key] = { nonTeamsNoOO: 0, effTrailers: 0, nonTeams: 0 };
      stats[key].nonTeams += (d.effectiveNonTeams || 0);
      if (d.contractType !== 'OO') {
        stats[key].nonTeamsNoOO += (d.effectiveNonTeams || 0);
      }
      stats[key].effTrailers += ((d as any).effectiveTrailers || 0);
    });
    return stats;
  }, [allDrivers, drivers]);

  const enrichedDrivers = useMemo(() => {
    const groups: { [date: string]: DriverPerformance[] } = {};
    drivers.forEach(d => {
      if (!d.payDate) return;
      if (!groups[d.payDate]) groups[d.payDate] = [];
      groups[d.payDate].push(d);
    });

    const allGroups: { [date: string]: DriverPerformance[] } = {};
    (allDrivers || drivers).forEach(d => {
      if (!d.payDate) return;
      if (!allGroups[d.payDate]) allGroups[d.payDate] = [];
      allGroups[d.payDate].push(d);
    });

    const result: any[] = [];

    Object.keys(groups).forEach(date => {
      const weekDrivers = groups[date];
      const totalWeekDrivers = allGroups[date] || weekDrivers;
      
      const dedupGlobal = (() => {
          let nt = 0, ntNoOO = 0, tr = 0;
          totalWeekDrivers.forEach(d => {
              nt += (d.effectiveNonTeams || 0);
              if (d.contractType !== 'OO') ntNoOO += (d.effectiveNonTeams || 0);
              tr += ((d as any).effectiveTrailers || 0);
          });
          return { nt, ntNoOO, tr };
      })();

      const globalEffNonTeams = dedupGlobal.nt || 1;
      const globalEffNonTeamsNoOO = dedupGlobal.ntNoOO || 1;
      const globalEffTrailers = dedupGlobal.tr || 1;
      
      let numOfTrucks = 0;
      let avgTruckPrice = 0;
      let numOfTrailers = 0;
      let avgTrailerPrice = 0;
      let rawFinImportData: any = null;

      let matches: any[] = [];
      let globalMatch: any = null;

      if (finImportByDate[date]) {
         const fData = finImportByDate[date];
         matches = fData.matches;
         globalMatch = fData.rawFinImportData;
         avgTruckPrice = fData.avgTruckPrice;
         avgTrailerPrice = fData.avgTrailerPrice;
         rawFinImportData = fData.rawFinImportData;
         numOfTrucks = fData.globalTrucks;
         numOfTrailers = fData.globalTrailers;
      }

      let truckBaseFixed = getActiveAmount('Truck', date).amount;
      let truckExp = getActiveAmount('Truck', date).exp;
      let baseTruckPrice = 0;
      if (truckBaseFixed === 0 && !truckExp) {
          baseTruckPrice = -Math.abs(Number(avgTruckPrice) || 0);
      } else {
          if (truckExp?.frequency === 'Annually') truckBaseFixed = truckBaseFixed / 52;
          else if (truckExp?.frequency === 'Monthly') truckBaseFixed = truckBaseFixed / 4.33;
          baseTruckPrice = -Math.abs(truckBaseFixed);
      }
      
      let trailerBaseFixed = getActiveAmount('Trailer', date).amount;
      let trailerExp = getActiveAmount('Trailer', date).exp;
      let baseTrailerPrice = 0;
      if (trailerBaseFixed === 0 && !trailerExp) {
          baseTrailerPrice = -Math.abs(Number(avgTrailerPrice) || 0);
      } else {
          if (trailerExp?.frequency === 'Annually') trailerBaseFixed = trailerBaseFixed / 52;
          else if (trailerExp?.frequency === 'Monthly') trailerBaseFixed = trailerBaseFixed / 4.33;
          baseTrailerPrice = -Math.abs(trailerBaseFixed);
      }
      
      

      const companyMetricsMap: Record<string, { v_c6: number, v_c7: number, v_c8: number, val_c11: number, val_c13: number, val_c25: number, val_c16_c21: number, customFixedPerNT: number }> = {};
      const uniqueCompsInWeek = Array.from(new Set(weekDrivers.map(d => d.companyId))).filter(Boolean) as string[];

      const globalPhysDamDivisor = globalEffNonTeams + (globalEffTrailers / 4);

      uniqueCompsInWeek.forEach(compId => {
         const cDrivers = weekDrivers.filter(d => d.companyId === compId);
         const cEffNT = cDrivers.reduce((sum, d) => sum + (d.effectiveNonTeams || 0), 0);

         let r_c6 = getActiveAmount('Liability Insurance', date).amount;
         let exp_c6 = getActiveAmount('Liability Insurance', date).exp;
         if (r_c6 === 0 && !exp_c6) {
             r_c6 = getActiveAmount('Liability Insurance (Global)', date).amount;
             exp_c6 = getActiveAmount('Liability Insurance (Global)', date).exp;
         }
         let v_c6 = 0;
         if (r_c6 !== 0 || exp_c6) {
             v_c6 = -(exp_c6?.frequency === 'Annually' ? r_c6 / 52 : exp_c6?.frequency === 'Monthly' ? r_c6 / 4.33 : r_c6);
         } else if (rawFinImportData) {
             v_c6 = globalEffNonTeams > 0 ? -(rawFinImportData.liability_insurance || 0) / globalEffNonTeams : 0;
         }

         let r_c7 = getActiveAmount('Cargo Insurance', date).amount;
         let exp_c7 = getActiveAmount('Cargo Insurance', date).exp;
         let v_c7 = 0;
         if (r_c7 !== 0 || exp_c7) {
             v_c7 = -(exp_c7?.frequency === 'Annually' ? r_c7 / 52 : exp_c7?.frequency === 'Monthly' ? r_c7 / 4.33 : r_c7);
         } else if (rawFinImportData) {
             v_c7 = globalEffNonTeams > 0 ? -(rawFinImportData.cargo_insurance || 0) / globalEffNonTeams : 0;
         }

         let r_c8 = getActiveAmount('Physical Damage', date).amount;
         let exp_c8 = getActiveAmount('Physical Damage', date).exp;
         let v_c8 = 0;
         if (r_c8 !== 0 || exp_c8) {
             v_c8 = -(exp_c8?.frequency === 'Annually' ? r_c8 / 52 : exp_c8?.frequency === 'Monthly' ? r_c8 / 4.33 : r_c8);
         } else if (rawFinImportData) {
             v_c8 = globalEffNonTeams > 0 ? -(rawFinImportData.physical_damage || 0) / globalEffNonTeams : 0;
         }
         
         const compMatch = matches.find(m => m.company_name && m.company_name.replace(/\s+/g, '').toLowerCase() === compId.replace(/\s+/g, '').toLowerCase());
         
         const cStats = companyStatsMap[`${date}_${compId}`];
         const cTotalNonTeamsNoOO = cStats?.nonTeamsNoOO || 1;
         const cTotalEffTrailers = cStats?.effTrailers || 1;
         const cTotalNonTeams = cStats?.nonTeams || 1;

         const gTrucks = globalMatch ? (globalMatch.num_of_trucks || 0) : 0;
         const gTrailers = globalMatch ? (globalMatch.num_of_trailers || 0) : 0;

         const compTrucks = gTrucks * (cTotalNonTeamsNoOO / globalEffNonTeamsNoOO);
         const compTrailers = gTrailers * (cTotalEffTrailers / globalEffTrailers);

         const val_c11 = cTotalNonTeamsNoOO > 0 ? baseTruckPrice * (compTrucks / cTotalNonTeamsNoOO) : 0;
         const val_c13 = cTotalEffTrailers > 0 ? baseTrailerPrice * (compTrailers / cTotalEffTrailers) : 0;
         
         let val_c25 = 0;
         const telematicsAmt = getActiveAmount('Telematics', date).amount || getActiveAmount('ELD & Telematics', date).amount;
         const telematicsExp = getActiveAmount('Telematics', date).exp || getActiveAmount('ELD & Telematics', date).exp;
         if (telematicsAmt !== 0 || telematicsExp) {
             val_c25 = -(telematicsExp?.frequency === 'Annually' ? telematicsAmt / 52 : telematicsExp?.frequency === 'Monthly' ? telematicsAmt / 4.33 : telematicsAmt);
         } else if (globalMatch) {
             const gTelematics = globalMatch.telematics || 0;
             const compTelematics = gTelematics * (cTotalNonTeams / globalEffNonTeams);
             val_c25 = cTotalNonTeams > 0 ? -(compTelematics / cTotalNonTeams) : 0;
         }

         let val_c16_c21 = 0;
         [
           { label: 'Phone & Internet', key: 'phone_and_internet' },
           { label: 'Office Supplies', key: 'office_supplies', alt: 'Office Supplies & SaaS' },
           { label: 'Rent & Parking', key: 'rent_and_parking' },
           { label: 'Backup MCs', key: 'backup_mcs' },
           { label: 'Back Office Pay', key: 'back_office_pay', alt: 'Backoffice Reg' },
           { label: 'Tech Pay', key: 'tech_pay', alt: 'Backoffice Tech' }
         ].forEach(item => {
             let amt = getActiveAmount(item.label, date).amount;
             let exp = getActiveAmount(item.label, date).exp;
             if (amt === 0 && !exp && item.alt) {
                 amt = getActiveAmount(item.alt, date).amount;
                 exp = getActiveAmount(item.alt, date).exp;
             }
             if (amt !== 0 || exp) {
                 let perUnit = amt;
                 if (exp?.frequency === 'Annually') perUnit = amt / 52;
                 else if (exp?.frequency === 'Monthly') perUnit = amt / 4.33;
                 val_c16_c21 -= perUnit;
             } else if (globalMatch) {
                 const gItem = globalMatch[item.key] || 0;
                 const compItem = gItem * (cTotalNonTeams / globalEffNonTeams);
                 val_c16_c21 -= cTotalNonTeams > 0 ? (compItem / cTotalNonTeams) : 0;
             }
         });

         const customExpenseNames = Array.from(new Set(fixedExpenses.map(e => e.name).filter(n => !['Liability Insurance', 'Liability Insurance (Global)', 'Cargo Insurance', 'Physical Damage', 'Plates', 'Factoring'].includes(n))));
         let customFixedPerNT = 0;
         customExpenseNames.forEach(expName => {
             const { amount, exp } = getActiveAmount(expName, date, compId, uniqueCompsInWeek.length);
             let weeklyAmount = amount;
             if (exp?.frequency === 'Annually') weeklyAmount = amount / 52;
             if (exp?.frequency === 'Monthly') weeklyAmount = amount / 4.33;
             const isDivide = exp?.allocationType === 'divide' || exp?.allocationType === 'global' || !exp?.allocationType;
             if (isDivide) {
                 customFixedPerNT += cTotalNonTeams > 0 ? -(weeklyAmount / cTotalNonTeams) : 0;
             } else {
                 customFixedPerNT -= weeklyAmount;
             }
         });

         companyMetricsMap[compId] = { v_c6, v_c7, v_c8, val_c11, val_c13, val_c25, val_c16_c21, customFixedPerNT };
      });

        const factoringData = getActiveAmount('Factoring', date);

      const loggedMclooCompanies = new Set<string>();

      weekDrivers.forEach(d => {
        const effNT = d.effectiveNonTeams || 0;
        const effTr = (d as any).effectiveTrailers || 0;
        const gross = d.totalGross || ((d.grossRevenue || 0) + (d.marginAmount || 0));

        const compMetrics = companyMetricsMap[d.companyId || ''] || { v_c6: 0, v_c7: 0, v_c8: 0, val_c11: 0, val_c13: 0, val_c25: 0, val_c16_c21: 0 };
        const val_c6 = compMetrics.v_c6;
        const val_c7 = compMetrics.v_c7;
        const val_c8 = Number(compMetrics.v_c8.toFixed(2));
        const val_c9 = val_c8 / 4;
        const truck_wu = globalEffNonTeamsNoOO > 0 ? baseTruckPrice * (numOfTrucks / globalEffNonTeamsNoOO) : 0;
        const trailer_wu = globalEffTrailers > 0 ? baseTrailerPrice * (numOfTrailers / globalEffTrailers) : 0;
        const val_c11 = truck_wu;
        const val_c13 = trailer_wu;
        const val_c25 = compMetrics.val_c25;
        const val_c16_c21 = compMetrics.val_c16_c21;
        const val_custom = compMetrics.customFixedPerNT || 0;
        const val_c24 = -(getActiveAmount('Plates', date, d.companyId, uniqueCompsInWeek.length).amount);


        const fAmount = Number(factoringData.amount) || 0;
        const factoringPercent = factoringData.unit === '%' ? (-Math.abs(fAmount) / 100) : 0;

        const validFcRecords = (fixedCostsData || []).filter(r => r.pay_date <= date).sort((a: any, b: any) => new Date(b.pay_date).getTime() - new Date(a.pay_date).getTime());
        const fc = validFcRecords.length > 0 ? validFcRecords[0] : {};

        const getFcRule = (expenseNameKeyword: string, fieldCustom: string, fieldGlobal: string) => {
             let amount: number | null = null;
             let specCosts = fc.company_specific_costs;
             if (typeof specCosts === 'string') {
                 try { specCosts = JSON.parse(specCosts); } catch(e) {}
             }
             if (specCosts && Array.isArray(specCosts)) {
                 const compRule = specCosts.find((el: any) =>
                     (el.company_id || '').replace(/\s+/g, '').toLowerCase() === (d.companyId || '').replace(/\s+/g, '').toLowerCase() &&
                     (el.expense_name || '').toLowerCase().includes(expenseNameKeyword.toLowerCase())
                 );
                 if (compRule && compRule.amount !== undefined && compRule.amount !== null) {
                     amount = Math.abs(Number(compRule.amount));
                 }
             }
             if (amount === null && fc[fieldCustom] !== undefined && fc[fieldCustom] !== null) {
                 amount = Math.abs(Number(fc[fieldCustom]));
             }
             if (amount === null && fc[fieldGlobal] !== undefined && fc[fieldGlobal] !== null) {
                 amount = Math.abs(Number(fc[fieldGlobal]));
             }
             return amount || 0;
         };

         const getFcRuleCpm = (expenseNameKeyword: string, fieldCustom: string, fieldGlobal: string) => {
             let cpm: number | null = null;
             let specCosts = fc.company_specific_costs;
             if (typeof specCosts === 'string') {
                 try { specCosts = JSON.parse(specCosts); } catch(e) {}
             }
             if (specCosts && Array.isArray(specCosts)) {
                 const compRule = specCosts.find((el: any) =>
                     (el.company_id || '').replace(/\s+/g, '').toLowerCase() === (d.companyId || '').replace(/\s+/g, '').toLowerCase() &&
                     (el.expense_name || '').toLowerCase().includes(expenseNameKeyword.toLowerCase())
                 );
                 if (compRule && compRule.cpm !== undefined && compRule.cpm !== null) {
                     cpm = Math.abs(Number(compRule.cpm));
                 }
             }
             if (cpm === null && fc[fieldCustom] !== undefined && fc[fieldCustom] !== null) {
                 cpm = Math.abs(Number(fc[fieldCustom]));
             }
             if (cpm === null && fc[fieldGlobal] !== undefined && fc[fieldGlobal] !== null) {
                 cpm = Math.abs(Number(fc[fieldGlobal]));
             }
             return cpm || 0;
         };

        let liabilityAuto = getFcRule('Liability Insurance (Auto)', 'liability_insurance_custom', 'liability_insurance');
        let liabilityGeneral = getFcRule('Liability Insurance (General)', '', '');
        let liabilityGlobal = getFcRule('Liability Insurance (Global)', '', '');
        let liability = liabilityAuto + liabilityGeneral + liabilityGlobal;
        let sharedLiabilityValue = 0;
        
        if (d.contractType === 'MCLOO') {
            const currTime = date ? new Date(date).getTime() : Date.now();
            const isValidVal = (val: any) => val !== undefined && val !== null && String(val).trim() !== '';

            let matchedExp = fixedExpenses.find(e => 
                (e.companyId || '').replace(/\s+/g, '').toLowerCase() === (d.companyId || '').replace(/\s+/g, '').toLowerCase() && 
                (isValidVal((e as any).shared_liability) || isValidVal((e as any).shared_insurance)) &&
                (!e.valid_from || new Date(e.valid_from).getTime() <= currTime) &&
                (!e.valid_to || new Date(e.valid_to).getTime() >= currTime)
            );
            
            if (!matchedExp) {
                matchedExp = fixedExpenses.find(e => 
                    e.companyId === 'ALL' && 
                    (isValidVal((e as any).shared_liability) || isValidVal((e as any).shared_insurance)) &&
                    (!e.valid_from || new Date(e.valid_from).getTime() <= currTime) &&
                    (!e.valid_to || new Date(e.valid_to).getTime() >= currTime)
                );
            }

            if (matchedExp) {
                sharedLiabilityValue = Number((matchedExp as any).shared_liability ?? (matchedExp as any).shared_insurance) || 0;
            }
            liability = liability - sharedLiabilityValue;
        }
        
        const cargo = getFcRule('Cargo Insurance', 'cargo_insurance_custom', 'cargo_insurance');
        const phd = getFcRule('Physical Damage', 'physical_damage_custom', 'physical_damage');
        const plates = getFcRule('Plates', 'plates_custom', 'plates');
        const factoring = getFcRule('Factoring', 'factoring_custom', 'factoring');
        const telematics = getFcRule('Telematics', 'telematics_custom', 'telematics');
        const phone_and_internet = getFcRule('Phone & Internet', 'phone_and_internet_custom', 'phone_and_internet');
        const office_supplies = getFcRule('Office Supplies', 'office_supplies_custom', 'office_supplies');
        const rent_and_parking = getFcRule('Rent & Parking', 'rent_and_parking_custom', 'rent_and_parking');
        const backup_mc = getFcRule('Backup MC', 'backup_mc_custom', 'backup_mc');
        const backoffice_reg = getFcRule('Back Office Pay', 'backoffice_reg_custom', 'backoffice_reg');
        const backoffice_tech = getFcRule('Tech Pay', 'backoffice_tech_custom', 'backoffice_tech');
         const truck_weekly = getFcRule('Truck Price', 'truck_weekly_custom', 'truck_weekly');
         const truck_cpm = getFcRuleCpm('Truck Price', 'truck_price_cpm', 'truck_price_cpm');
         const trailer_weekly = getFcRule('Trailer Price', 'trailer_weekly_custom', 'trailer_weekly');
         
         const isOO = d.contractType === 'OO';
         const isGarland = d.contractType === 'CPM' && d.name === 'Garland Jermaine Norris';
                  
         const driver_gross = Number(d.grossRevenue || 0);
         const margin_amt = Number(d.marginAmount || 0);
         
         let fixed_costs_calc = 0;
         if (isOO) {
             fixed_costs_calc =
                 (effNT * (liability + cargo + phone_and_internet + office_supplies + rent_and_parking + backup_mc + backoffice_reg + backoffice_tech)) +
                 (effTr * (trailer_weekly + (phd / 4.0))) +
                 ((driver_gross + margin_amt) * (factoring / 100.0));
         } else {
             fixed_costs_calc =
                 (effNT * (liability + cargo + phd + truck_weekly + plates + telematics + phone_and_internet + office_supplies + rent_and_parking + backup_mc + backoffice_reg + backoffice_tech)) +
                 (effTr * (trailer_weekly + (phd / 4.0))) +
                 ((driver_gross + margin_amt) * (factoring / 100.0)) +
                 (truck_cpm * (Number(d.milesDriven) || 0));
             if (isGarland) {
                 fixed_costs_calc -= effNT * (truck_weekly + phd + plates);
             }
         }
         
       if (d.contractType === 'MCLOO' && String(d.payDate).includes('04-30') && !loggedMclooCompanies.has(d.companyId || '')) {
           loggedMclooCompanies.add(d.companyId || '');
           console.log('--- MCLOO DEBUG | DRIVER:', d.name, ' | COMPANY:', d.companyId, ' | PAY DATE:', d.payDate, '---');
           console.log('FIXED TOTAL:', fixed_costs_calc);
           console.log('effNT:', effNT);
           console.log('effTr:', effTr);
           console.log('liability (after shared deduct):', liability);
           console.log('sharedLiabilityValue:', sharedLiabilityValue);
           console.log('cargo:', cargo);
           console.log('phd:', phd);
           console.log('truck_weekly:', truck_weekly);
           console.log('plates:', plates);
           console.log('telematics:', telematics);
           console.log('phone_and_internet:', phone_and_internet);
           console.log('office_supplies:', office_supplies);
           console.log('rent_and_parking:', rent_and_parking);
           console.log('backup_mc:', backup_mc);
           console.log('backoffice_reg:', backoffice_reg);
           console.log('backoffice_tech:', backoffice_tech);
           console.log('truck_cpm:', truck_cpm);
           console.log('milesDriven:', d.milesDriven);
           console.log('trailer_weekly:', trailer_weekly);
           console.log('driver_gross:', driver_gross);
           console.log('margin_amt:', margin_amt);
           console.log('factoring (%):', factoring);
       }

        let fixed = fixed_costs_calc || 0;

        result.push({
          ...d,
          calculatedFixedCost: fixed,
          fixed_costs: fixed,
          driverPoCoverage: d.driverPoCoverage,
          poCoverage: d.poCoverage ? -Math.abs(d.poCoverage) : 0,
        });
      });
    });

    return result;
  }, [drivers, allDrivers, parsedFinImportData, getActiveAmount, latestPayDate, fixedCostsData]);

  

  const displayedDrivers = useMemo(() => {
    if (!selectedDate || selectedDate === 'ALL') return enrichedDrivers;
    if (selectedDate === 'LATEST') {
      return latestPayDate ? enrichedDrivers.filter(d => d.payDate === latestPayDate) : enrichedDrivers;
    }
    return enrichedDrivers.filter(d => d.payDate === selectedDate);
  }, [enrichedDrivers, selectedDate, latestPayDate]);


  const uniqueTeams = useMemo(() => Array.from(new Set(displayedDrivers.map(d => d.teamId))).filter(Boolean).sort(), [displayedDrivers]);
  const uniqueFranchises = useMemo(() => Array.from(new Set(displayedDrivers.map(d => d.franchiseId))).filter(Boolean).sort(), [displayedDrivers]);
  const uniqueContracts = useMemo(() => Array.from(new Set(displayedDrivers.map(d => d.contractType))).filter(Boolean).sort(), [displayedDrivers]);
  const uniqueCompanies = useMemo(() => {
    const companies = Array.from(new Set(displayedDrivers.map(d => d.companyId)));
    return companies.filter(c => c && c !== 'Unknown' && !/^Company\s*\d*$/i.test(String(c))).sort() as string[];
  }, [displayedDrivers]);
  const uniqueDrivers = useMemo(() => Array.from(new Set(displayedDrivers.map(d => d.name))).filter(Boolean).sort(), [displayedDrivers]);

 useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (metricsRef.current && !metricsRef.current.contains(event.target as Node)) {
        setIsMetricsOpen(false);
      }
      if (entitiesRef.current && !entitiesRef.current.contains(event.target as Node)) {
        setIsEntitiesOpen(false);
      }
      if (mainTableFilterRef.current && !mainTableFilterRef.current.contains(event.target as Node)) {
        setIsMainTableFilterOpen(false);
      }
      if (expandedTableFilterRef.current && !expandedTableFilterRef.current.contains(event.target as Node)) {
        setIsExpandedTableFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);



 

  const calculateMetrics = useCallback((initialDrivers: DriverPerformance[], isDriverView: boolean = false) => {
    let rawEffCount = 0;
    let rawEffNonTeams = 0;
    let rawEffTrailers = 0;
    let rawEffNonTeamsNoOO = 0;
    
    initialDrivers.forEach(d => {
        rawEffCount += (d.effectiveDrivers || 0);
        rawEffNonTeams += (d.effectiveNonTeams || 0);
        rawEffTrailers += ((d as any).effectiveTrailers || 0);
        if (d.contractType !== 'OO') rawEffNonTeamsNoOO += (d.effectiveNonTeams || 0);
    });

    const effCount = Number(rawEffCount.toFixed(2));
    const effNonTeamsCount = Number(rawEffNonTeams.toFixed(2));
    const effNonTeams = effNonTeamsCount > 0 ? effNonTeamsCount : 1;
    const effTrailersCount = Number(rawEffTrailers.toFixed(2));
    const effNonTeamsNoOOCount = Number(rawEffNonTeamsNoOO.toFixed(2));

    const currentPayDate = initialDrivers.length > 0 ? initialDrivers[0].payDate : null;

    let numOfTrucks = 0;
    let avgTruckPrice = 0;
    let numOfTrailers = 0;
    let avgTrailerPrice = 0;
    let rawFinImportData: any = null;

    const uniqueDatesInSelection = Array.from(new Set(initialDrivers.map(d => d.payDate))).filter(Boolean) as string[];
    let totalCalculatedTrucks = 0;
    let totalCalculatedTrailers = 0;
    let truckPriceSum = 0;
    let trailerPriceSum = 0;
    let datesWithFinData = 0;
    let totalTruckUtilization = 0;
    let totalTrailerUtilization = 0;

    uniqueDatesInSelection.forEach(payDate => {
        if (finImportByDate[payDate]) {
            const finData = finImportByDate[payDate];
            const matches = finData.matches;
            
            if (matches && matches.length > 0) {
                if (datesWithFinData === 0) {
                    rawFinImportData = finData.rawFinImportData;
                }
                datesWithFinData++;
                truckPriceSum += finData.avgTruckPrice;
                trailerPriceSum += finData.avgTrailerPrice;

                const globalTrucks = finData.globalTrucks;
                const globalTrailers = finData.globalTrailers;
                const currentGlobalStats = globalStatsByDate[payDate];
                const globalNonTeams = currentGlobalStats?.nonTeams || 1;
                const globalEffTrailersStat = currentGlobalStats?.effTrailers || 1;

                const dateDrivers = initialDrivers.filter(d => d.payDate === payDate);
                const uniqueComps = Array.from(new Set(dateDrivers.map(d => d.companyId))).filter(Boolean) as string[];
                let calculatedTrucks = 0;
                let calculatedTrailers = 0;

                const hasAnyCompanyData = matches.some((m:any) => m.company_name && m.company_name.trim() !== '' && (m.amount != null || m.comp_trailers != null));

                if (hasAnyCompanyData) {
                    const totalCompsForDate = Object.keys(companyStatsMap).filter(k => k.startsWith(`${payDate}_`)).length;
                    
                    if (uniqueComps.length === totalCompsForDate || uniqueComps.length === 0) {
                        calculatedTrucks = globalTrucks;
                        calculatedTrailers = globalTrailers;
                    } else {
                        uniqueComps.forEach(compId => {
                            const compMatch = matches.find((m:any) => m.company_name && m.company_name.replace(/\s+/g, '').toLowerCase() === compId.replace(/\s+/g, '').toLowerCase());
                            if (compMatch) {
                                calculatedTrucks += Number(compMatch.amount) || 0;
                                calculatedTrailers += Number(compMatch.comp_trailers) || 0;
                            }
                        });
                    }
                } else {
                    const initialCompsStats: Record<string, {ntNoOO: number, tr: number}> = {};
                    dateDrivers.forEach(d => {
                        if (!d.companyId) return;
                        if (!initialCompsStats[d.companyId]) initialCompsStats[d.companyId] = {ntNoOO: 0, tr: 0};
                        if (d.contractType !== 'OO') initialCompsStats[d.companyId].ntNoOO += (d.effectiveNonTeams || 0);
                        initialCompsStats[d.companyId].tr += ((d as any).effectiveTrailers || 0);
                    });

                    uniqueComps.forEach(compId => {
                        const cSubsetNonTeams = initialCompsStats[compId]?.ntNoOO || 0;
                        const cSubsetTrailers = initialCompsStats[compId]?.tr || 0;
                        calculatedTrucks += globalTrucks * (cSubsetNonTeams / globalNonTeams);
                        calculatedTrailers += globalTrailers * (cSubsetTrailers / globalEffTrailersStat);
                    });

                    const noCompDrivers = dateDrivers.filter(d => !d.companyId || !uniqueComps.includes(d.companyId));
                    if (noCompDrivers.length > 0) {
                        const noCompNT = noCompDrivers.filter(d => d.contractType !== 'OO').reduce((sum, d) => sum + (d.effectiveNonTeams || 0), 0);
                        const noCompTr = noCompDrivers.reduce((sum, d) => sum + ((d as any).effectiveTrailers || 0), 0);
                        calculatedTrucks += globalTrucks * (noCompNT / globalNonTeams);
                        calculatedTrailers += globalTrailers * (noCompTr / globalEffTrailersStat);
                    }
                }
                totalCalculatedTrucks += calculatedTrucks;
                totalCalculatedTrailers += calculatedTrailers;

                let weekEffNTNoOO = 0;
                let weekEffTr = 0;
                dateDrivers.forEach(d => {
                    if (d.contractType !== 'OO') weekEffNTNoOO += (d.effectiveNonTeams || 0);
                    weekEffTr += ((d as any).effectiveTrailers || 0);
                });

                if (calculatedTrucks > 0) totalTruckUtilization += (weekEffNTNoOO / calculatedTrucks) * 100;
                if (calculatedTrailers > 0) totalTrailerUtilization += (weekEffTr / calculatedTrailers) * 100;
            }
        }
    });

    const truckUtilization = datesWithFinData > 0 ? totalTruckUtilization / datesWithFinData : 0;
    const trailerUtilization = datesWithFinData > 0 ? totalTrailerUtilization / datesWithFinData : 0;

    numOfTrucks = uniqueDatesInSelection.length > 0 ? Math.round(totalCalculatedTrucks / uniqueDatesInSelection.length) : Math.round(totalCalculatedTrucks);
    numOfTrailers = uniqueDatesInSelection.length > 0 ? Math.round(totalCalculatedTrailers / uniqueDatesInSelection.length) : Math.round(totalCalculatedTrailers);

    if (datesWithFinData > 0) {
        avgTruckPrice = truckPriceSum / datesWithFinData;
        avgTrailerPrice = trailerPriceSum / datesWithFinData;
    }

    const gross = initialDrivers.reduce((sum, d) => sum + (d.grossRevenue || 0), 0);
    const margin = initialDrivers.reduce((sum, d) => sum + d.marginAmount, 0);
    const fuelSavings = initialDrivers.reduce((sum, d) => sum + (d.fuelSavings || 0), 0);
    const companyPay = initialDrivers.reduce((sum, d) => sum + d.companyPay, 0);
    
    const driverPay = initialDrivers.reduce((sum, d) => sum + d.netPay, 0);
     const fuel = initialDrivers.reduce((sum, d) => {
         const ct = d.contractType || '';
         if (ct.includes('TPOG') || ct === 'POG' || ct === 'CPM') {
             return sum - Math.abs(d.fuelCost || 0);
         }
         return sum + Math.abs(d.fuelSavings || 0);
     }, 0);
     const maint = initialDrivers.reduce((sum, d) => sum + d.maintenanceCost, 0);
    const tolls = initialDrivers.reduce((sum, d) => sum + Math.abs(d.tollCost || 0), 0);
    const faults = initialDrivers.reduce((sum, d) => sum + d.driverFaultExpenses, 0);
    
    const totalPO = initialDrivers.reduce((sum, d) => sum + (d.poAmount || 0), 0);
    const totalPOCov = initialDrivers.reduce((sum, d) => sum + (Number(d.poCoverage) || 0), 0);
    const totalEscrow = initialDrivers.reduce((sum, d) => sum + (d.escrowBalance || 0), 0);
    const totalBalance = initialDrivers.reduce((sum, d) => sum + (d.balanceTotal || 0), 0);
    const totalRecruiting = initialDrivers.reduce((sum, d) => sum + (d.recruitingCost || 0), 0);
    
    const dispatcherPay = initialDrivers.reduce((sum, d) => sum + (d.dispatcherCommission || 0), 0);

    const cogs = driverPay + fuel + maint + tolls + faults;

    const baseFixed = initialDrivers.reduce((sum, d) => sum + ((d as any).fixed_costs || 0), 0);
    const adjFixed = simulationConfig.globalFixedExpenseAdjustment * effCount;
    const allocatedFixed = baseFixed + adjFixed;
    const totalFixedPerUnit = effCount > 0 ? (allocatedFixed / effCount) : 0;

    const netIncome = companyPay - allocatedFixed - Math.abs(totalPOCov) - Math.abs(totalRecruiting) - Math.abs(tolls);
    const pnlPerDriver = netIncome / effNonTeams;

    return {
      rawEffCount, effCount, effNonTeamsCount, effTrailersCount, gross, margin, fuelSavings, companyPay, cogs, allocatedFixed, baseFixed, adjFixed, netIncome, pnlPerDriver,
      driverPay, fuel, maint, tolls, faults, dispatcherPay, totalFixedPerUnit,
      totalPO, totalPOCov, totalEscrow, totalBalance, totalRecruiting,
      effNonTeams, currentPayDate,
      numOfTrucks, avgTruckPrice, numOfTrailers, avgTrailerPrice, truckUtilization, trailerUtilization,
      rawFinImportData, effNonTeamsForTrucks: effNonTeamsNoOOCount
    };
  }, [fixedExpenses, simulationConfig, finImportByDate, globalStatsByDate, companyStatsMap]);

  const rawTotalActive = displayedDrivers.reduce((sum, d) => sum + (d.effectiveDrivers || 0), 0);
  const totalActiveCount = Number(rawTotalActive.toFixed(2));
  
  const companyMetrics = useMemo(() => {
     const rawMetrics = calculateMetrics(displayedDrivers, groupBy === 'Driver');
     const uniqueDriverNames = Array.from(new Set(displayedDrivers.map(d => d.name))).filter(Boolean);
     let totalNetIncome = 0;
     uniqueDriverNames.forEach(dName => {
       const drvRecords = displayedDrivers.filter(drv => drv.name === dName);
       const m = calculateMetrics(drvRecords, true);
       totalNetIncome += m.netIncome;
     });
     return { ...rawMetrics, netIncome: totalNetIncome };
  }, [displayedDrivers, groupBy, calculateMetrics]);
  const displayTotalFixed = useMemo(() => {
     let total = 0;
     ['Liability Insurance', 'Cargo Insurance', 'Physical Damage'].forEach(name => {
         let amt = getActiveAmount(name, companyMetrics.currentPayDate).amount;
         let exp = getActiveAmount(name, companyMetrics.currentPayDate).exp;
         if (amt === 0 && !exp) {
             const fallbackName = name === 'Liability Insurance' ? 'Liability Insurance (Global)' : name;
             amt = getActiveAmount(fallbackName, companyMetrics.currentPayDate).amount;
             exp = getActiveAmount(fallbackName, companyMetrics.currentPayDate).exp;
         }
         if (amt !== 0 || exp) {
             let perUnit = amt;
             if (exp?.frequency === 'Annually') perUnit = amt / 52;
             else if (exp?.frequency === 'Monthly') perUnit = amt / 4.33;
             total += perUnit * companyMetrics.effNonTeams;
         } else if (companyMetrics.rawFinImportData) {
             const finKey = name === 'Liability Insurance' ? 'liability_insurance' : name === 'Cargo Insurance' ? 'cargo_insurance' : 'physical_damage';
             total += (companyMetrics.rawFinImportData[finKey] || 0);
         }
     });

     [
       { label: 'Phone & Internet', key: 'phone_and_internet' },
       { label: 'Office Supplies', key: 'office_supplies', alt: 'Office Supplies & SaaS' },
       { label: 'Telematics', key: 'telematics', alt: 'ELD & Telematics' },
       { label: 'Rent & Parking', key: 'rent_and_parking' },
       { label: 'Backup MCs', key: 'backup_mcs' },
       { label: 'Back Office Pay', key: 'back_office_pay', alt: 'Backoffice Reg' },
       { label: 'Tech Pay', key: 'tech_pay', alt: 'Backoffice Tech' }
     ].forEach(item => {
         let amt = getActiveAmount(item.label, companyMetrics.currentPayDate).amount;
         let exp = getActiveAmount(item.label, companyMetrics.currentPayDate).exp;
         if (amt === 0 && !exp && item.alt) {
             amt = getActiveAmount(item.alt, companyMetrics.currentPayDate).amount;
             exp = getActiveAmount(item.alt, companyMetrics.currentPayDate).exp;
         }
         if (amt !== 0 || exp) {
             let perUnit = amt;
             if (exp?.frequency === 'Annually') perUnit = amt / 52;
             else if (exp?.frequency === 'Monthly') perUnit = amt / 4.33;
             total += perUnit * companyMetrics.effNonTeams;
         } else if (companyMetrics.rawFinImportData) {
             total += (companyMetrics.rawFinImportData[item.key] || 0);
         }
     });

     Array.from(new Set(fixedExpenses.filter(e => ['Plates', 'Factoring'].includes(e.name)).map(e => e.name))).forEach(expName => {
         const exp = fixedExpenses.find(e => e.name === expName);
         if (!exp) return;
         if (exp.unit === '%') {
             total += companyMetrics.gross * ((exp.amount || 0) / 100);
         } else {
             let perUnit = exp.amount || 0;
             if (exp.frequency === 'Annually') perUnit = perUnit / 52;
             else if (exp.frequency === 'Monthly') perUnit = perUnit / 4.33;
             total += perUnit * companyMetrics.effNonTeams;
         }
     });
     return total;
  }, [companyMetrics, fixedExpenses, getActiveAmount]);

  // -- PNL HISTORY CALCULATION (Dynamic) --
  const pnlHistory = useMemo(() => {
    const groups: { [date: string]: any[] } = {};
    enrichedDrivers.forEach(d => {
      if (!d.payDate) return;
      if (!groups[d.payDate]) groups[d.payDate] = [];
      groups[d.payDate].push(d);
    });

    const history = Object.keys(groups).map(date => {
      const weekDrivers = groups[date];
      const uniqueDriverNames = Array.from(new Set(weekDrivers.map(d => d.name))).filter(Boolean);
      let totalNetIncome = 0;
      
      uniqueDriverNames.forEach(dName => {
        const drvRecords = weekDrivers.filter(drv => drv.name === dName);
        const m = calculateMetrics(drvRecords, true);
        totalNetIncome += m.netIncome;
      });

      return { date, amount: totalNetIncome };
    });

    const sortedHistory = history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sortedHistory.length > 1 ? sortedHistory.slice(0, -1) : sortedHistory;
  }, [enrichedDrivers, calculateMetrics]);


  const chartData = useMemo(() => {
    if (enrichedDrivers.length === 0) return [];

    const driversByDate: Record<string, any[]> = {};
    enrichedDrivers.forEach(d => {
      if (!d.payDate) return;
      if (!driversByDate[d.payDate]) driversByDate[d.payDate] = [];
      driversByDate[d.payDate].push(d);
    });

    let allDates = Object.keys(driversByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    allDates = allDates.length > 1 ? allDates.slice(1) : allDates;

    if (selectedDate !== 'ALL' && selectedDate !== 'LATEST') {
      const targetTime = new Date(selectedDate).getTime();
      allDates = allDates.filter(date => new Date(date).getTime() <= targetTime);
    } else if (selectedDate === 'LATEST' && latestPayDate) {
       const targetTime = new Date(latestPayDate).getTime();
       allDates = allDates.filter(date => new Date(date).getTime() <= targetTime);
    }

    if (chartWeeksLimit !== 'ALL') {
      allDates = allDates.slice(-chartWeeksLimit);
    }

    const generatedChartData = allDates.map(date => {
      const dateDrivers = driversByDate[date];
      const row: any = { name: date }; 

      const processEntity = (key: string, subset: any[]) => {
         if (subset.length === 0) return;
         const m = calculateMetrics(subset);
         
         let totalNetIncome = 0;
         const drvByName = new Map<string, any[]>();
         subset.forEach(d => {
            const n = d.name || 'Unknown';
            if (!drvByName.has(n)) drvByName.set(n, []);
            drvByName.get(n)!.push(d);
         });
         
         drvByName.forEach(drvRecords => {
            const drvM = calculateMetrics(drvRecords, true);
            totalNetIncome += drvM.netIncome;
         });

         row[`${key}_gross`] = m.gross;
         row[`${key}_netIncome`] = totalNetIncome;
         row[`${key}_margin`] = m.margin;
         row[`${key}_pnlPerDriver`] = m.pnlPerDriver; 
         row[`${key}_balance`] = m.totalBalance;
         row[`${key}_effCount`] = m.effCount;
         row[`${key}_effNonTeamsCount`] = m.effNonTeamsCount;
         row[`${key}_effTrailersCount`] = m.effTrailersCount;
         row[`${key}_companyPay`] = m.companyPay;
         row[`${key}_cogs`] = m.cogs;
         row[`${key}_dispatcherPay`] = m.dispatcherPay;
         row[`${key}_allocatedFixed`] = m.allocatedFixed;
         row[`${key}_tolls`] = m.tolls;
         row[`${key}_totalPO`] = m.totalPO;
         row[`${key}_totalPOCov`] = m.totalPOCov;
         row[`${key}_totalEscrow`] = m.totalEscrow;
         row[`${key}_totalRecruiting`] = m.totalRecruiting;
      };

      const neededEntities = new Set(selectedEntities);
      if (groupBy === 'Contract') uniqueContracts.forEach(c => neededEntities.add(c));
      else if (groupBy === 'Company') uniqueCompanies.forEach(c => neededEntities.add(c));
      else if (groupBy === 'Team') uniqueTeams.forEach(c => neededEntities.add(c));
      else if (groupBy === 'Franchise') uniqueFranchises.forEach(c => neededEntities.add(c));
      else if (groupBy === 'Driver') uniqueDrivers.forEach(c => neededEntities.add(c));

      if (neededEntities.has('COMPANY')) processEntity('COMPANY', dateDrivers);
      
      const byContract: Record<string, any[]> = {};
      const byCompany: Record<string, any[]> = {};
      const byTeam: Record<string, any[]> = {};
      const byFranchise: Record<string, any[]> = {};
      const byDriver: Record<string, any[]> = {};

      dateDrivers.forEach(d => {
          if (d.contractType) {
              if (!byContract[d.contractType]) byContract[d.contractType] = [];
              byContract[d.contractType].push(d);
          }
          if (d.companyId) {
              if (!byCompany[d.companyId]) byCompany[d.companyId] = [];
              byCompany[d.companyId].push(d);
          }
          if (d.teamId) {
              if (!byTeam[d.teamId]) byTeam[d.teamId] = [];
              byTeam[d.teamId].push(d);
          }
          if (d.franchiseId) {
              if (!byFranchise[d.franchiseId]) byFranchise[d.franchiseId] = [];
              byFranchise[d.franchiseId].push(d);
          }
          if (d.name) {
              if (!byDriver[d.name]) byDriver[d.name] = [];
              byDriver[d.name].push(d);
          }
      });

      uniqueContracts.forEach(contractId => {
        if (neededEntities.has(contractId) && byContract[contractId]) processEntity(contractId, byContract[contractId]);
      });
      uniqueCompanies.forEach(cId => {
        if (neededEntities.has(cId) && byCompany[cId]) processEntity(cId, byCompany[cId]);
      });
      uniqueTeams.forEach(teamId => {
        if (neededEntities.has(teamId) && byTeam[teamId]) processEntity(teamId, byTeam[teamId]);
      });
      uniqueFranchises.forEach(fId => {
        if (neededEntities.has(fId) && byFranchise[fId]) processEntity(fId, byFranchise[fId]);
      });
      uniqueDrivers.forEach(dName => {
        if (neededEntities.has(dName) && byDriver[dName]) processEntity(dName, byDriver[dName]);
      });

      return row;
    });
    return generatedChartData;
  }, [enrichedDrivers, uniqueContracts, uniqueCompanies, uniqueTeams, uniqueFranchises, uniqueDrivers, calculateMetrics, selectedDate, latestPayDate, chartWeeksLimit, groupBy, selectedEntities]);

  useEffect(() => {
    if (onReady) {
      if (chartData && chartData.length > 0) {
        const timer = setTimeout(() => {
          onReady();
        }, 100);
        return () => clearTimeout(timer);
      } else if (allDrivers && allDrivers.length > 0) {
        onReady();
      }
    }
  }, [chartData, allDrivers]);
  const chartSeries: ChartSeries[] = useMemo(() => {
    const series: ChartSeries[] = [];
    const distinctColors = ['#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#14b8a6', '#f43f5e', '#84cc16', '#0ea5e9', '#6366f1', '#d946ef', '#eab308', '#06b6d4', '#f97316'];
    let colorIndex = 0;

    selectedEntities.forEach(entityId => {
      let name = '';
      let colorBase = '';

      if (entityId === 'COMPANY') { 
        name = 'Total'; 
        colorBase = '#10b981'; 
      } else {
        name = entityId;
        colorBase = distinctColors[colorIndex % distinctColors.length];
        colorIndex++;
      }

      selectedMetrics.forEach(metric => {
        let metricName = '';
        let color = colorBase;

        const metricLabels: any = {
          gross: 'Gross', netIncome: 'Total PnL', margin: 'Margin',
          companyPay: 'Rev Coll.', allocatedFixed: 'Fixed',
          totalPOCov: 'PO Co Cov', totalRecruiting: 'Recruiting', tolls: 'Tolls'
        };
        const metricColors: any = {
          gross: '#a1a1aa', netIncome: '#ffffff', margin: '#c084fc',
          companyPay: '#60a5fa', allocatedFixed: '#f87171',
          totalPOCov: '#4ade80', totalRecruiting: '#fb923c', tolls: '#fde047'
        };

        if (selectedMetrics.length > 1 && metricColors[metric]) {
          color = metricColors[metric];
        }
        
        const isMultiEntity = selectedEntities.length > 1;
        const isMultiMetric = selectedMetrics.length > 1;
        
        let finalName = name;
        if (isMultiEntity && isMultiMetric) {
            finalName = `${name} - ${metricLabels[metric]}`;
        } else if (isMultiEntity) {
            finalName = `${name} - ${metricLabels[metric]}`;
        } else {
            finalName = metricLabels[metric];
        }

        series.push({
          dataKey: `${entityId}_${metric}`,
          name: finalName,
          color: color
        
        });
      });
    });
    return series;
  }, [selectedEntities, selectedMetrics, uniqueCompanies, uniqueTeams, uniqueFranchises, uniqueContracts]);


  

  const toggleSelection = (list: string[], item: string, setList: any) => {
    if (list.includes(item)) {
      if (list.length > 1) setList(list.filter((i: string) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const getPerCountValue = (expName: string, currentDate: string | null) => {
     const { amount } = getActiveAmount(expName, currentDate);
     return companyMetrics.effNonTeams > 0 ? (amount / 52) / companyMetrics.effNonTeams : 0;
  };

  const formatPercentage = (val: number) => `${Math.round(val)}%`;

  return (
    <div className="flex flex-col h-full gap-2">
      <SimulationModal 
         isOpen={isModalOpen} 
         onClose={() => setIsModalOpen(false)}
        simulationConfig={simulationConfig}
        setSimulationConfig={setSimulationConfig}
        fixedExpenses={fixedExpenses}
        setFixedExpenses={setFixedExpenses}
        onSaveExpenses={onSaveExpenses}
        companies={allUniqueCompanies}
        configContracts={configContracts}
        drivers={displayedDrivers}
        currentNetIncome={companyMetrics.netIncome}
        onDataSync={onDataSync}
        fixedCostsData={fixedCostsData}
      />
            
      <Simulator
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        drivers={enrichedDrivers}
        MasterTableComponent={MasterTable}
        calculateMetrics={calculateMetrics}
        companyMetrics={companyMetrics}
        totalActiveCount={totalActiveCount}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        chartData={chartData}
        configContracts={configContracts}
      />

      {isTableExpanded && (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
           <div className="bg-zinc-950 border border-zinc-800 rounded-lg w-full h-full max-w-7xl flex flex-col shadow-2xl">
              <div className="flex justify-between items-center p-3 border-b border-zinc-800 bg-zinc-900/50">
                 <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <LayoutList size={16} className="text-emerald-500" />
                    Master Operating Statement
                 </h2>
                 <div className="flex items-center gap-3">
                   {currentRole === 'Company Admin' && setGlobalFilter && (
                     <div className="relative" ref={expandedTableFilterRef}>
                       <button
                         onClick={() => setIsExpandedTableFilterOpen(!isExpandedTableFilterOpen)}
                         className={`flex items-center gap-2 bg-zinc-950 border ${isExpandedTableFilterOpen ? 'border-zinc-600 text-white' : 'border-zinc-800 text-zinc-400'} rounded px-2 py-1 text-xs hover:bg-zinc-900 transition-colors`}
                       >
                         <Filter size={12} />
                         <span>Filter</span>
                         <ChevronDown size={12} className={`transition-transform ${isExpandedTableFilterOpen ? 'rotate-180' : ''}`} />
                       </button>
                       {isExpandedTableFilterOpen && (
                         <div className="absolute top-full right-0 mt-1 w-56 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl z-[9999] p-2 flex flex-col gap-2">
                           <div className="flex justify-between items-center px-1 mb-1 border-b border-zinc-800 pb-1">
                             <span className="text-[10px] font-bold text-zinc-500 uppercase">Filters</span>
                             <button onClick={clearAllFilters} className="text-[9px] text-rose-400 hover:text-rose-300 font-bold">Clear Filters</button>
                           </div>
                           <MultiSelectDropdown label="Contract" options={getDependentOptions('contracts')} selected={globalFilter?.contracts || []} onChange={(val: string[]) => updateGlobalFilter('contracts', val)} />
                           <MultiSelectDropdown label="Franchise" options={getDependentOptions('franchises')} selected={globalFilter?.franchises || []} onChange={(val: string[]) => updateGlobalFilter('franchises', val)} />
                           <MultiSelectDropdown label="Company" options={getDependentOptions('companies')} selected={globalFilter?.companies || []} onChange={(val: string[]) => updateGlobalFilter('companies', val)} />
                           <MultiSelectDropdown label="Team" options={getDependentOptions('teams')} selected={globalFilter?.teams || []} onChange={(val: string[]) => updateGlobalFilter('teams', val)} />
                           <MultiSelectDropdown label="Driver" options={getDependentOptions('drivers')} selected={globalFilter?.drivers || []} onChange={(val: string[]) => updateGlobalFilter('drivers', val)} />
                         </div>
                       )}
                     </div>
                   )}
                   <select
                     value={groupBy}
                     onChange={(e) => setGroupBy(e.target.value as any)}
                     className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-300 font-sans text-xs focus:outline-none focus:border-emerald-500 w-40"
                   >
                     <option value="Contract">By Contract</option>
                     <option value="Company">By Company</option>
                     <option value="Franchise">By Franchise</option>
                     <option value="Team">By Team</option>
                     {!isAverageView && <option value="Driver">By Driver</option>}
                   </select>
                   <button
                     onClick={() => {
                        setIsAverageView(!isAverageView);
                        if (!isAverageView && groupBy === 'Driver') setGroupBy('Contract');
                     }}
                     className={`px-3 py-1 rounded text-[10px] font-bold border transition-colors ${isAverageView ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'}`}
                   >
                     AVG / DRV
                   </button>
                   <button 
                    onClick={() => setIsTableExpanded(false)}
                    className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
                   >
                      <X size={18} />
                   </button>
                 </div>
              </div>
              <div className="flex-1 overflow-hidden p-2">
                 <MasterTable 
                    companyMetrics={companyMetrics} 
                    drivers={displayedDrivers} 
                    calculateMetrics={calculateMetrics}
                    totalActiveCount={totalActiveCount}
                    selectedDate={selectedDate}
                    groupBy={groupBy}
                    chartData={chartData}
                    isAverageView={isAverageView}
                 />
              </div>
           </div>
        </div>
      )}

      {/* Top Bar - Compact */}
      <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-1.5 px-3 rounded-lg flex-shrink-0">
        <h2 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
          <LayoutList size={14} className="text-emerald-500" />
          Financial Control Center
        </h2>
        <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-zinc-500">Pay Date:</span>
                    
                    {/* Date Selection Dropdown */}
                    <div className="relative">
                       <select 
                         value={selectedDate} 
                         onChange={(e) => setSelectedDate(e.target.value)}
                         className="bg-zinc-950 border border-zinc-800 rounded px-2 py-0.5 text-zinc-300 font-mono focus:outline-none appearance-none pr-6 cursor-pointer hover:border-zinc-700 transition-colors"
                       >
                          <option value="ALL">All Dates (Combined)</option>
                          {uniqueDates.length > 0 ? (
                            uniqueDates.map(date => (
                              <option key={String(date)} value={String(date)}>{String(date)}</option>
                            ))
                          ) : (
                            <option value="LATEST">No Dates</option>
                          )}
                       </select>
                       <ChevronDown size={10} className="absolute right-1.5 top-1.5 text-zinc-500 pointer-events-none"/>
                    </div>
                 </div>
           <button onClick={() => setIsSimulatorOpen(true)} className="text-purple-400 hover:text-purple-300 transition-colors p-1 ml-2">
            <LayoutDashboard size={14} />
          </button>
           <button onClick={() => setIsModalOpen(true)} className="text-zinc-400 hover:text-white transition-colors p-1">
            <Sliders size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-2 h-full min-h-0">
        
        {/* LEFT COLUMN: Table (Top) + Charts (Bottom) */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col min-h-0 relative z-20">
            <div className="p-2 border-b border-zinc-800 bg-zinc-950/30 flex justify-between items-center">
              <div className="flex items-center gap-3 text-[10px] font-mono"></div>
               <div className="flex items-center gap-2">
                   {currentRole === 'Company Admin' && setGlobalFilter && (
                     <div className="relative" ref={mainTableFilterRef}>
                       <button
                         onClick={() => setIsMainTableFilterOpen(!isMainTableFilterOpen)}
                         className={`flex items-center gap-2 bg-zinc-950 border ${isMainTableFilterOpen ? 'border-zinc-600 text-white' : 'border-zinc-800 text-zinc-400'} rounded px-2 py-0.5 text-[10px] hover:bg-zinc-900 transition-colors`}
                       >
                         <Filter size={10} />
                         <span>Filter</span>
                         <ChevronDown size={10} className={`transition-transform ${isMainTableFilterOpen ? 'rotate-180' : ''}`} />
                       </button>
                       {isMainTableFilterOpen && (
                         <div className="absolute top-full right-0 mt-1 w-48 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl z-[9999] p-2 flex flex-col gap-2">
                           <div className="flex justify-between items-center px-1 mb-1 border-b border-zinc-800 pb-1">
                             <span className="text-[10px] font-bold text-zinc-500 uppercase">Filters</span>
                             <button onClick={clearAllFilters} className="text-[9px] text-rose-400 hover:text-rose-300 font-bold">Clear Filters</button>
                           </div>
                           <MultiSelectDropdown label="Contract" options={getDependentOptions('contracts')} selected={globalFilter?.contracts || []} onChange={(val: string[]) => updateGlobalFilter('contracts', val)} />
                           <MultiSelectDropdown label="Franchise" options={getDependentOptions('franchises')} selected={globalFilter?.franchises || []} onChange={(val: string[]) => updateGlobalFilter('franchises', val)} />
                           <MultiSelectDropdown label="Company" options={getDependentOptions('companies')} selected={globalFilter?.companies || []} onChange={(val: string[]) => updateGlobalFilter('companies', val)} />
                           <MultiSelectDropdown label="Team" options={getDependentOptions('teams')} selected={globalFilter?.teams || []} onChange={(val: string[]) => updateGlobalFilter('teams', val)} />
                           <MultiSelectDropdown label="Driver" options={getDependentOptions('drivers')} selected={globalFilter?.drivers || []} onChange={(val: string[]) => updateGlobalFilter('drivers', val)} />
                         </div>
                       )}
                     </div>
                   )}
                   <select
                     value={groupBy}
                     onChange={(e) => setGroupBy(e.target.value as any)}
                     className="bg-zinc-950 border border-zinc-800 rounded px-2 py-0.5 text-zinc-300 font-sans text-[10px] focus:outline-none focus:border-emerald-500 w-32"
                   >
                     <option value="Contract">By Contract</option>
                     <option value="Company">By Company</option>
                     <option value="Franchise">By Franchise</option>
                     <option value="Team">By Team</option>
                     {!isAverageView && <option value="Driver">By Driver</option>}
                   </select>
                   <button
                     onClick={() => {
                        setIsAverageView(!isAverageView);
                        if (!isAverageView && groupBy === 'Driver') setGroupBy('Contract');
                     }}
                     className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${isAverageView ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'}`}
                   >
                     AVG / DRV
                   </button>
                   <button 
                     onClick={() => setIsTableExpanded(true)}
                     className="text-zinc-500 hover:text-emerald-400 transition-colors" 
                     title="Expand View"
                   >
                     <Maximize2 size={12} />
                   </button>
                 </div>
            </div>
            <MasterTable 
                companyMetrics={companyMetrics} 
                drivers={displayedDrivers} 
                calculateMetrics={calculateMetrics}
                totalActiveCount={totalActiveCount}
                selectedDate={selectedDate}
                groupBy={groupBy}
                chartData={chartData}
                isAverageView={isAverageView}
            />
          </div>
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col min-h-0 overflow-hidden">
             
             {/* Chart Controls Toolbar */}
             <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-950/30 flex flex-wrap gap-2 justify-between items-center flex-shrink-0">
                
                <div className="flex items-center gap-3">
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mr-2">
                    <TrendingUp size={12} className="text-emerald-500"/> Trends
                  </h4>
                  
                  {/* METRICS DROPDOWN */}
                  <div className="relative" ref={metricsRef}>
                    <button 
                      onClick={() => setIsMetricsOpen(!isMetricsOpen)}
                      className={`flex items-center gap-2 bg-zinc-950 border ${isMetricsOpen ? 'border-zinc-600 text-white' : 'border-zinc-800 text-zinc-400'} rounded px-2 py-1 text-[10px] hover:bg-zinc-900 transition-colors`}
                    >
                       <Filter size={10} /> 
                       <span>Chart Options</span>
                       <ChevronDown size={10} className={`transition-transform ${isMetricsOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isMetricsOpen && (
                      <div className="absolute top-full left-0 mt-1 w-56 bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden max-h-56">
                        <div className="p-2 bg-zinc-900/50">
                          <h5 className="text-[9px] font-bold text-zinc-500 uppercase mb-1.5 px-1">Metrics</h5>
                          <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
                            <button
                              onClick={() => setSelectedMetrics([])}
                              className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] rounded hover:bg-zinc-800 text-rose-400 font-bold mb-1"
                            >
                              <span>Clear All</span>
                            </button>
                            {['netIncome', 'totalRecruiting', 'totalPOCov', 'tolls', 'allocatedFixed', 'companyPay', 'margin', 'gross'].map(m => {
                              const labels: any = {
                                gross: 'Gross', companyPay: 'Rev Coll.', margin: 'Margin',
                                allocatedFixed: 'Fixed', tolls: 'Tolls', totalPOCov: 'PO Co Cov',
                                totalRecruiting: 'Recruiting', netIncome: 'Total PnL'
                              };
                              return (
                              <button
                                key={m}
                                onClick={() => toggleSelection(selectedMetrics, m, setSelectedMetrics)}
                                className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] rounded hover:bg-zinc-800 text-zinc-300"
                              >
                                <span>{labels[m]}</span>
                                {selectedMetrics.includes(m) && <Check size={10} className="text-emerald-500" />}
                              </button>
                            )})}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ENTITIES DROPDOWN */}
                  <div className="relative" ref={entitiesRef}>
                    <button 
                      onClick={() => setIsEntitiesOpen(!isEntitiesOpen)}
                      className={`flex items-center gap-2 bg-zinc-950 border ${isEntitiesOpen ? 'border-zinc-600 text-white' : 'border-zinc-800 text-zinc-400'} rounded px-2 py-1 text-[10px] hover:bg-zinc-900 transition-colors`}
                    >
                       <Filter size={10} /> 
                       <span>Compare Entities</span>
                       <ChevronDown size={10} className={`transition-transform ${isEntitiesOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isEntitiesOpen && (
                      <div className="absolute top-full left-0 mt-1 w-56 bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden max-h-56">
                        <div className="p-2 overflow-y-auto">
                           <h5 className="text-[9px] font-bold text-zinc-500 uppercase mb-1.5 px-1">Comparison View</h5>
                           
                           <button
                              onClick={() => toggleSelection(selectedEntities, 'COMPANY', setSelectedEntities)}
                              className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] rounded hover:bg-zinc-800 text-zinc-300"
                           >
                              <span>Total Company</span>
                              {selectedEntities.includes('COMPANY') && <Check size={10} className="text-emerald-500" />}
                           </button>

                           <div className="my-1 border-t border-zinc-800/50"></div>

                           {uniqueCompanies.length > 0 && (
                             <>
                              <div className="text-[9px] font-bold text-zinc-600 px-1 py-1">Companies</div>
                              {uniqueCompanies.map(company => (
                                <button
                                  key={company}
                                  onClick={() => toggleSelection(selectedEntities, company, setSelectedEntities)}
                                  className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] rounded hover:bg-zinc-800 text-zinc-300"
                                >
                                  <span>{company}</span>
                                  {selectedEntities.includes(company) && <Check size={10} className="text-emerald-400" />}
                                </button>
                              ))}
                              <div className="my-1 border-t border-zinc-800/50"></div>
                             </>
                           )}

                           {uniqueContracts.length > 0 && (
                             <>
                              <div className="text-[9px] font-bold text-zinc-600 px-1 py-1">Contracts</div>
                              {uniqueContracts.map(contract => (
                                <button
                                  key={contract}
                                  onClick={() => toggleSelection(selectedEntities, contract, setSelectedEntities)}
                                  className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] rounded hover:bg-zinc-800 text-zinc-300"
                                >
                                  <span>{contract}</span>
                                  {selectedEntities.includes(contract) && <Check size={10} className="text-purple-400" />}
                                </button>
                              ))}
                              <div className="my-1 border-t border-zinc-800/50"></div>
                             </>
                           )}
                           
                           {uniqueTeams.length > 0 && (
                             <>
                              <div className="text-[9px] font-bold text-zinc-600 px-1 py-1">Teams</div>
                              {uniqueTeams.map(team => (
                                <button
                                  key={team}
                                  onClick={() => toggleSelection(selectedEntities, team, setSelectedEntities)}
                                  className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] rounded hover:bg-zinc-800 text-zinc-300"
                                >
                                  <span>{team}</span>
                                  {selectedEntities.includes(team) && <Check size={10} className="text-blue-500" />}
                                </button>
                              ))}
                              <div className="my-1 border-t border-zinc-800/50"></div>
                             </>
                           )}

                           {uniqueFranchises.length > 0 && (
                             <>
                              <div className="text-[9px] font-bold text-zinc-600 px-1 py-1">Franchises</div>
                              {uniqueFranchises.map(fran => (
                                <button
                                  key={fran}
                                  onClick={() => toggleSelection(selectedEntities, fran, setSelectedEntities)}
                                  className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] rounded hover:bg-zinc-800 text-zinc-300"
                                >
                                  <span>{fran}</span>
                                  {selectedEntities.includes(fran) && <Check size={10} className="text-amber-500" />}
                                </button>
                              ))}
                              <div className="my-1 border-t border-zinc-800/50"></div>
                             </>
                           )}

                           {uniqueDrivers.length > 0 && (
                             <>
                              <div className="text-[9px] font-bold text-zinc-600 px-1 py-1">Drivers</div>
                              {uniqueDrivers.map(driver => (
                                <button
                                  key={driver}
                                  onClick={() => toggleSelection(selectedEntities, driver, setSelectedEntities)}
                                  className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] rounded hover:bg-zinc-800 text-zinc-300"
                                >
                                  <span>{driver}</span>
                                  {selectedEntities.includes(driver) && <Check size={10} className="text-rose-400" />}
                                </button>
                              ))}
                             </>
                           )}
                        </div>
                      </div>
                    
                    )}
                  </div>
                  
                  <div className="w-px h-4 bg-zinc-800 mx-1"></div>
                  
                  <div className="relative">
                    <select 
                      value={chartWeeksLimit}
                      onChange={(e) => setChartWeeksLimit(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                      className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-400 focus:outline-none focus:border-emerald-500 appearance-none pr-5 hover:bg-zinc-900 transition-colors cursor-pointer"
                    >
                      <option value="ALL">All Weeks</option>
                      <option value="4">Last 4 Weeks</option>
                      <option value="8">Last 8 Weeks</option>
                      <option value="12">Last 12 Weeks</option>
                      <option value="16">Last 16 Weeks</option>
                      <option value="20">Last 20 Weeks</option>
                      <option value="24">Last 24 Weeks</option>
                    </select>
                    <ChevronDown size={10} className="absolute right-1.5 top-1.5 text-zinc-500 pointer-events-none" />
                  </div>

                </div>

                <div className="flex bg-zinc-950 rounded border border-zinc-800 p-0.5">
                   <button 
                    onClick={() => setChartType('line')} 
                    className={`p-1 rounded transition-colors ${chartType === 'line' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'}`}
                   >
                     <LineChart size={12}/>
                   </button>
                   <button 
                    onClick={() => setChartType('bar')} 
                    className={`p-1 rounded transition-colors ${chartType === 'bar' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'}`}
                   >
                     <BarChart3 size={12}/>
                   </button>
                </div>
             </div>

             <div className="flex-1 min-h-0 p-3 bg-zinc-900/50">
               <HistoricalChart 
                data={chartData} 
                series={chartSeries} 
                type={chartType} 
                animate={!hasPlayedInitialAnimations}
              />
             </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Sidebar (Fixed Costs) */}
        <div className="w-full xl:w-80 flex flex-col gap-2 flex-shrink-0">
          
          {/* Fixed Expenses Card (New Format) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex-1 overflow-hidden flex flex-col min-h-[250px]">
             <div className="flex justify-between items-center mb-2 border-b border-zinc-800 pb-2 flex-shrink-0">
               <h4 className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                 <DollarSign size={12} className="text-emerald-500" /> Fixed Expenses
               </h4>
             </div>
             
             <div className="flex justify-between items-center gap-2 mb-3 bg-zinc-950/50 p-2 rounded border border-zinc-800/50 flex-shrink-0">
               <div className="flex items-center justify-center gap-2 w-1/2 border-r border-zinc-800/50 pr-2">
                  <Truck size={14} className="text-emerald-500" />
                  <span className="text-[11px] font-mono font-bold text-zinc-300">{Math.round(companyMetrics.effNonTeamsForTrucks)} / {companyMetrics.numOfTrucks}</span>
                  <span className="text-[10px] font-bold text-emerald-400">({formatPercentage(companyMetrics.numOfTrucks > 0 ? Math.min(100, (companyMetrics.effNonTeamsForTrucks / companyMetrics.numOfTrucks) * 100) : 0)})</span>
               </div>
               <div className="flex items-center justify-center gap-2 w-1/2 pl-2">
                  <Container size={14} className="text-emerald-500" />
                  <span className="text-[11px] font-mono font-bold text-zinc-300">{Math.round(companyMetrics.effTrailersCount)} / {companyMetrics.numOfTrailers}</span>
                  <span className="text-[10px] font-bold text-emerald-400">({formatPercentage(companyMetrics.numOfTrailers > 0 ? Math.min(100, (companyMetrics.effTrailersCount / companyMetrics.numOfTrailers) * 100) : 0)})</span>
               </div>
             </div>

             <div className="flex items-center px-1.5 mb-1 text-[9px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800/50 pb-1 flex-shrink-0">
               <div className="w-[50%] text-left">Name</div>
               <div className="w-[25%] text-center">Per Unit</div>
               <div className="w-[25%] text-right">Total</div>
             </div>

             <div className="overflow-y-auto flex-1 pr-1 space-y-1.5 pb-4">
                 
                 {(() => {
                    const validFcRecordsSidebar = (fixedCostsData || []).filter(r => r.pay_date <= companyMetrics.currentPayDate).sort((a: any, b: any) => new Date(b.pay_date).getTime() - new Date(a.pay_date).getTime());
                    const fcSidebar = validFcRecordsSidebar.length > 0 ? validFcRecordsSidebar[0] : {};
                    
                    const weekAllDrivers = (allDrivers || drivers).filter(d => d.payDate === companyMetrics.currentPayDate);
                    
                    const globalNT = (() => {
                        const map = new Map<string, { nt: number, count: number }>();
                        weekAllDrivers.forEach(d => {
                            const n = d.name || 'Unknown';
                            if (!map.has(n)) map.set(n, { nt: 0, count: 0 });
                            const m = map.get(n)!;
                            m.nt += (d.effectiveNonTeams || 0);
                            m.count += 1;
                        });
                        let nt = 0;
                        map.forEach(m => {
                            if (m.count > 1 && m.nt >= (8/7)) nt += (m.nt / 2);
                            else nt += m.nt;
                        });
                        return nt || 1;
                    })();

                    const globalTr = (() => {
                        const map = new Map<string, { tr: number, count: number }>();
                        weekAllDrivers.forEach(d => {
                            const n = d.name || 'Unknown';
                            if (!map.has(n)) map.set(n, { tr: 0, count: 0 });
                            const m = map.get(n)!;
                            m.tr += ((d as any).effectiveTrailers || 0);
                            m.count += 1;
                        });
                        let tr = 0;
                        map.forEach(m => {
                            if (m.count > 1 && m.tr >= (8/7)) tr += (m.tr / 2);
                            else tr += m.tr;
                        });
                        return tr || 1;
                    })();

                    const getSidebarVal = (globalKey: string, customKey?: string) => {
                        let amount: number | null = null;
                        if (customKey && fcSidebar[customKey] !== undefined && fcSidebar[customKey] !== null && fcSidebar[customKey] !== '') {
                            amount = Math.abs(Number(fcSidebar[customKey]));
                        }
                        if (amount === null && fcSidebar[globalKey] !== undefined && fcSidebar[globalKey] !== null && fcSidebar[globalKey] !== '') {
                            amount = Math.abs(Number(fcSidebar[globalKey]));
                        }
                        return amount || 0;
                    };

                    const renderRow = (label: string, globalKey: string, customKey?: string, isPercent: boolean = false, multiplier: number = globalNT, valTooltip?: any, totalTooltip?: any, customVal?: number, customTotal?: number) => {
                        const val = customVal !== undefined ? customVal : getSidebarVal(globalKey, customKey);
                        if (val === 0) return null;
                        
                        let total = customTotal !== undefined ? customTotal : 0;
                        if (customTotal === undefined) {
                            if (isPercent) {
                                total = (companyMetrics.gross + companyMetrics.margin) * (val / 100);
                            } else {
                                total = val * multiplier;
                            }
                        }
                        return (
                            <div key={label} className="flex items-center p-1.5 hover:bg-zinc-800/20 transition-colors relative">
                               <div className="w-[50%] text-left pr-2">
                                 <span className="text-[10px] text-zinc-300 block truncate">{label}</span>
                               </div>
                               <div className="w-[25%] text-center">
                                 <div className="relative group/tooltip inline-block">
                                    <span className={`text-[10px] font-mono font-bold transition-colors duration-200 ${valTooltip ? 'cursor-help text-zinc-400 hover:text-emerald-300' : 'text-zinc-400'}`}>
                                      {isPercent ? `-${val}%` : `-${formatCurrency(val)}`}
                                    </span>
                                    {valTooltip && (
                                       <div className="hidden group-hover/tooltip:block fixed z-[9999] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl normal-case font-normal border border-zinc-700 pointer-events-none transform -translate-x-[105%] -translate-y-1/2">
                                          {valTooltip}
                                       </div>
                                    )}
                                 </div>
                               </div>
                               <div className="w-[25%] text-right">
                                 <div className="relative group/tooltip inline-block">
                                    <span className={`text-[10px] font-mono font-bold transition-colors duration-200 ${totalTooltip ? 'cursor-help text-sky-400/80 hover:text-sky-300' : 'text-sky-400/80'}`}>
                                      -{formatCurrency(total)}
                                    </span>
                                    {totalTooltip && (
                                       <div className="hidden group-hover/tooltip:block fixed z-[9999] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl normal-case font-normal border border-zinc-700 pointer-events-none transform -translate-x-[105%] -translate-y-1/2">
                                          {totalTooltip}
                                       </div>
                                    )}
                                 </div>
                               </div>
                            </div>
                        );
                    };

                    const getRowTotal = (globalKey: string, customKey?: string, isPercent: boolean = false, multiplier: number = globalNT) => {
                        const val = getSidebarVal(globalKey, customKey);
                        if (val === 0) return 0;
                        if (isPercent) return (companyMetrics.gross + companyMetrics.margin) * (val / 100);
                        return val * multiplier;
                    };

                   let specCosts = fcSidebar.company_specific_costs;
                    if (typeof specCosts === 'string') {
                        try { specCosts = JSON.parse(specCosts); } catch(e) { specCosts = []; }
                    }
                    if (!Array.isArray(specCosts)) specCosts = [];

                    const uniqueCompsInWeek = Array.from(new Set(weekAllDrivers.map(d => d.companyId))).filter(Boolean) as string[];

                    const getDetailedExpenseTotal = (expName: string, fallbackExpName?: string) => {
                        let weeklySum = 0;
                        const breakdown: { company: string, literal: number, frequency: string, weekly: number }[] = [];

                        uniqueCompsInWeek.forEach(compId => {
                            let { amount, exp } = getActiveAmount(expName, companyMetrics.currentPayDate, compId, uniqueCompsInWeek.length);
                            if (amount === 0 && !exp && fallbackExpName) {
                                const fallback = getActiveAmount(fallbackExpName, companyMetrics.currentPayDate, compId, uniqueCompsInWeek.length);
                                amount = fallback.amount;
                                exp = fallback.exp;
                            }

                            let weekly = amount;
                            if (exp?.frequency === 'Annually') weekly = amount / 52;
                            else if (exp?.frequency === 'Monthly') weekly = amount / 4.33;

                            if (amount > 0) {
                                weeklySum += weekly;
                                breakdown.push({ 
                                    company: compId, 
                                    literal: amount, 
                                    frequency: exp?.frequency || 'Weekly',
                                    weekly: weekly
                                });
                            }
                        });
                        return { weeklySum, breakdown };
                    };

                    const getDetailedExpensePerUnit = (expNameKeyword: string) => {
                        let sumPerUnit = 0;
                        let count = 0;
                        const breakdown: { company: string, perUnit: number }[] = [];

                        specCosts.forEach((el: any) => {
                            if ((el.expense_name || '').toLowerCase().includes(expNameKeyword.toLowerCase())) {
                                const amt = Math.abs(Number(el.amount) || 0);
                                if (amt > 0) {
                                    sumPerUnit += amt;
                                    count++;
                                    breakdown.push({ company: el.company_id || 'Unknown', perUnit: amt });
                                }
                            }
                        });
                        const averagePerUnit = count > 0 ? sumPerUnit / count : 0;
                        return { averagePerUnit, breakdown };
                    };

                    const buildPerUnitTooltip = (title: string, breakdown: any[]) => {
                        if (breakdown.length === 0) return null;
                        return (
                            <div className="flex flex-col gap-1 w-full text-left min-w-[200px]">
                                <div className="text-emerald-400 font-bold mb-1 border-b border-zinc-700 pb-0.5">{title}</div>
                                <div className="text-[9px] text-zinc-400 mb-1.5 leading-tight">This value represents the Average. Below are the exact amounts per company:</div>
                                {breakdown.map((b: any, i: number) => (
                                    <div key={i} className="flex justify-between gap-4">
                                        <span className="text-zinc-400">{b.company}</span>
                                        <span className="text-zinc-200 font-bold">{formatCurrency(b.perUnit)}</span>
                                    </div>
                                ))}
                            </div>
                        );
                    };

                    const buildTotalTooltip = (title: string, breakdown: any[]) => {
                        if (breakdown.length === 0) return null;
                        return (
                            <div className="flex flex-col gap-1 w-full text-left min-w-[200px]">
                                <div className="text-sky-400 font-bold mb-1 border-b border-zinc-700 pb-0.5">{title}</div>
                                <div className="text-[9px] text-zinc-400 mb-1.5 leading-tight">This value represents the Total sum of all companies. Below are the yearly expenses per company:</div>
                                {breakdown.map((b: any, i: number) => (
                                    <div key={i} className="flex justify-between gap-4">
                                        <span className="text-zinc-400">{b.company}</span>
                                        <span className="text-zinc-200 font-bold">{formatCurrency(b.literal)}</span>
                                    </div>
                                ))}
                            </div>
                        );
                    };

                    const liabAutoData = getDetailedExpenseTotal('Liability Insurance (Auto)', 'Liability Insurance (Global)');
                    const liabAutoPU = getDetailedExpensePerUnit('Liability Insurance (Auto)');
                    
                    const liabGenData = getDetailedExpenseTotal('Liability Insurance (General)');
                    const liabGenPU = getDetailedExpensePerUnit('Liability Insurance (General)');
                    
                    const cargoData = getDetailedExpenseTotal('Cargo Insurance');
                    const cargoPU = getDetailedExpensePerUnit('Cargo Insurance');
                    
                    const pdData = getDetailedExpenseTotal('Physical Damage');
                    const pdPU = getDetailedExpensePerUnit('Physical Damage');

                    const finalLiabAutoPerUnit = liabAutoPU.averagePerUnit > 0 ? liabAutoPU.averagePerUnit : getSidebarVal('liability_insurance', 'liability_insurance_custom');
                    const finalLiabAutoTotal = liabAutoData.weeklySum > 0 ? liabAutoData.weeklySum : (finalLiabAutoPerUnit * globalNT);

                    const finalLiabGenPerUnit = liabGenPU.averagePerUnit;
                    const finalLiabGenTotal = liabGenData.weeklySum;

                    const finalCargoPerUnit = cargoPU.averagePerUnit > 0 ? cargoPU.averagePerUnit : getSidebarVal('cargo_insurance', 'cargo_insurance_custom');
                    const finalCargoTotal = cargoData.weeklySum > 0 ? cargoData.weeklySum : (finalCargoPerUnit * globalNT);

                    const finalPdTruckPerUnit = pdPU.averagePerUnit > 0 ? pdPU.averagePerUnit : getSidebarVal('physical_damage', 'physical_damage_custom');
                    const finalPdTruckTotal = pdData.weeklySum > 0 ? pdData.weeklySum : (finalPdTruckPerUnit * companyMetrics.effNonTeamsForTrucks);
                    
                    const finalPdTrailerPerUnit = finalPdTruckPerUnit / 4;
                    const finalPdTrailerTotal = finalPdTruckTotal / 4;

                    const insTotal = finalLiabAutoTotal + finalLiabGenTotal + finalCargoTotal + finalPdTruckTotal + finalPdTrailerTotal;

                    const liabAutoPUTooltip = buildPerUnitTooltip('Liability Insurance (Auto)', liabAutoPU.breakdown);
                    const liabAutoTotalTooltip = buildTotalTooltip('Liability Insurance (Auto)', liabAutoData.breakdown);

                    const liabGenPUTooltip = buildPerUnitTooltip('Liability Insurance (General)', liabGenPU.breakdown);
                    const liabGenTotalTooltip = buildTotalTooltip('Liability Insurance (General)', liabGenData.breakdown);

                    const cargoPUTooltip = buildPerUnitTooltip('Cargo Insurance', cargoPU.breakdown);
                    const cargoTotalTooltip = buildTotalTooltip('Cargo Insurance', cargoData.breakdown);

                    const pdTruckPUTooltip = buildPerUnitTooltip('Physical Damage (Truck)', pdPU.breakdown);
                    const pdTruckTotalTooltip = buildTotalTooltip('Physical Damage (Truck)', pdData.breakdown);

                    const pdTrailerPUBreakdown = pdPU.breakdown.map(b => ({ company: b.company, perUnit: b.perUnit / 4 }));
                    const pdTrailerTotalBreakdown = pdData.breakdown.map(b => ({ ...b, literal: b.literal / 4, weekly: b.weekly / 4 }));
                    const pdTrailerPUTooltip = buildPerUnitTooltip('Physical Damage (Trailer)', pdTrailerPUBreakdown);
                    const pdTrailerTotalTooltip = buildTotalTooltip('Physical Damage (Trailer)', pdTrailerTotalBreakdown);
                    
                    const adminItems = [
                       { label: 'Phone & Internet', gk: 'phone_and_internet', ck: 'phone_and_internet_custom' },
                       { label: 'Office Supplies', gk: 'office_supplies', ck: 'office_supplies_custom' },
                       { label: 'Telematics', gk: 'telematics', ck: 'telematics_custom' },
                       { label: 'Rent & Parking', gk: 'rent_and_parking', ck: 'rent_and_parking_custom' },
                       { label: 'Backup MCs', gk: 'backup_mc', ck: 'backup_mc_custom' },
                       { label: 'Back Office Pay', gk: 'backoffice_reg', ck: 'backoffice_reg_custom' },
                       { label: 'Tech Pay', gk: 'backoffice_tech', ck: 'backoffice_tech_custom' }
                    ].map(item => ({
                       ...item,
                       val: getSidebarVal(item.gk, item.ck),
                       total: getRowTotal(item.gk, item.ck)
                    })).filter(item => item.val > 0).sort((a, b) => b.total - a.total);

                    const adminTotal = adminItems.reduce((sum, item) => sum + item.val, 0);
                                         
                                         let totalTruckCpmCost = 0;
                                         weekAllDrivers.forEach(d => {
                                             const isOO = d.contractType === 'OO';
                                             const isGarland = d.contractType === 'CPM' && d.name === 'Garland Jermaine Norris';
                                             if (isOO || isGarland) return;

                                             let cpm: number | null = null;
                                             let sCosts = fcSidebar.company_specific_costs;
                                             if (typeof sCosts === 'string') {
                                                 try { sCosts = JSON.parse(sCosts); } catch(e) {}
                                             }
                                             if (sCosts && Array.isArray(sCosts)) {
                                                 const compRule = sCosts.find((el: any) =>
                                                     (el.company_id || '').trim().toLowerCase() === (d.companyId || '').trim().toLowerCase() &&
                                                     (el.expense_name || '').toLowerCase().includes('truck price')
                                                 );
                                                 if (compRule && compRule.cpm !== undefined && compRule.cpm !== null) {
                                                     cpm = Math.abs(Number(compRule.cpm));
                                                 }
                                             }
                                             if (cpm === null && fcSidebar['truck_price_cpm'] !== undefined && fcSidebar['truck_price_cpm'] !== null) {
                                                 cpm = Math.abs(Number(fcSidebar['truck_price_cpm']));
                                             }
                                             totalTruckCpmCost += (cpm || 0) * (Number(d.milesDriven) || 0);
                                         });
                                         const tCpmPerUnit = globalNT > 0 ? totalTruckCpmCost / globalNT : 0;

                                         const equipTotal = getSidebarVal('truck_weekly') + getSidebarVal('trailer_weekly') + tCpmPerUnit;
                                         
                                         const factoringTotalAmount = (companyMetrics.gross + companyMetrics.margin) * (getSidebarVal('factoring', 'factoring_custom') / 100);
                    const factoringPerUnitValue = globalNT > 0 ? factoringTotalAmount / globalNT : 0;
                    const opTotal = getSidebarVal('plates', 'plates_custom') + factoringPerUnitValue;

                    return (
                        <>
                             <div className="mb-1.5">
                               <div className="flex justify-between items-center mb-0.5 px-1">
                                  <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">Equipment</span>
                                  <span className="text-[9px] font-bold text-zinc-500">(-{formatCurrency(equipTotal)})</span>
                               </div>
                               <div className="bg-zinc-950/40 rounded border border-zinc-800/30 divide-y divide-zinc-800/30">
                                   {(() => {
                                       const tVal = getSidebarVal('truck_weekly');
                                       const tTotal = tVal * companyMetrics.effNonTeamsForTrucks;
                                       
                                       const trVal = getSidebarVal('trailer_weekly');
                                       const trTotal = getRowTotal('trailer_weekly', undefined, false, globalTr);
                                       return (
                                           <>
                                               {tVal > 0 && (
                                               <div className="flex items-center p-1.5 hover:bg-zinc-800/10 transition-colors relative">
                                                  <div className="w-[50%] text-left pr-2">
                                                    <span className="text-[10px] text-zinc-300 block truncate">Avg Truck Price</span>
                                                  </div>
                                                  <div className="w-[25%] text-center">
                                                    <span className="text-[10px] font-mono font-bold text-zinc-400">-{formatCurrency(tVal)}</span>
                                                  </div>
                                                  <div className="w-[25%] text-right">
                                                     <div className="relative group/tooltip inline-block">
                                                        <span className="text-[10px] font-mono font-bold transition-colors duration-200 cursor-help text-sky-400/80 hover:text-sky-300">
                                                          -{formatCurrency(tTotal)}
                                                        </span>
                                                        <div className="hidden group-hover/tooltip:block fixed z-[9999] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl normal-case font-normal border border-zinc-700 pointer-events-none transform -translate-x-[105%] -translate-y-1/2">
                                                           Without OO drivers
                                                        </div>
                                                     </div>
                                                  </div>
                                               </div>
                                               )}
                                               {trVal > 0 && (
                                                <div className="flex items-center p-1.5 hover:bg-zinc-800/10 transition-colors relative">
                                                   <div className="w-[50%] text-left pr-2">
                                                     <span className="text-[10px] text-zinc-300 block truncate">Avg Trailer Price</span>
                                                   </div>
                                                   <div className="w-[25%] text-center">
                                                     <span className="text-[10px] font-mono font-bold text-zinc-400">-{formatCurrency(trVal)}</span>
                                                   </div>
                                                   <div className="w-[25%] text-right">
                                                      <div className="relative group/tooltip inline-block">
                                                         <span className="text-[10px] font-mono font-bold transition-colors duration-200 text-sky-400/80 hover:text-sky-300">
                                                           -{formatCurrency(trTotal)}
                                                         </span>
                                                      </div>
                                                   </div>
                                                </div>
                                                )}
                                                {totalTruckCpmCost > 0 && (
                                                <div className="flex items-center p-1.5 hover:bg-zinc-800/10 transition-colors relative">
                                                   <div className="w-[50%] text-left pr-2">
                                                     <span className="text-[10px] text-zinc-300 block truncate">Truck CPM</span>
                                                   </div>
                                                   <div className="w-[25%] text-center">
                                                      <div className="relative group/tooltip inline-block">
                                                         <span className="text-[10px] font-mono font-bold transition-colors duration-200 cursor-help text-zinc-400 hover:text-emerald-300">
                                                           -{formatCurrency(tCpmPerUnit)}
                                                         </span>
                                                         <div className="hidden group-hover/tooltip:block fixed z-[9999] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl normal-case font-normal border border-zinc-700 pointer-events-none transform -translate-x-[105%] -translate-y-1/2">
                                                            Average per truck
                                                         </div>
                                                      </div>
                                                   </div>
                                                   <div className="w-[25%] text-right">
                                                      <div className="relative group/tooltip inline-block">
                                                         <span className="text-[10px] font-mono font-bold transition-colors duration-200 text-sky-400/80 hover:text-sky-300">
                                                           -{formatCurrency(totalTruckCpmCost)}
                                                         </span>
                                                      </div>
                                                   </div>
                                                </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                 </div>
                             </div>

                            <div className="mb-1.5">
                                <div className="flex justify-between items-center mb-0.5 px-1">
                                   <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">Operational</span>
                                   <div className="relative group/tooltip inline-block">
                                      <span className="text-[9px] font-bold transition-colors duration-200 cursor-help text-zinc-500 hover:text-zinc-400">(-{formatCurrency(opTotal)})</span>
                                      <div className="hidden group-hover/tooltip:block fixed z-[9999] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl normal-case font-normal border border-zinc-700 pointer-events-none transform -translate-x-[105%] -translate-y-1/2">
                                         average total gross + plates per unit
                                      </div>
                                   </div>
                                </div>
                               <div className="bg-zinc-950/40 rounded border border-zinc-800/30 divide-y divide-zinc-800/30">
                                  {renderRow('Plates', 'plates', 'plates_custom', false, Math.round(companyMetrics.effNonTeamsForTrucks), undefined, 'Without OO drivers')}
                                  {renderRow('Factoring', 'factoring', 'factoring_custom', true, 1, '% of Total Gross', '% of Total Gross')}
                               </div>
                             </div>

                             <div className="mb-1.5">
                               <div className="flex justify-between items-center mb-0.5 px-1">
                                  <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">Insurance</span>
                                  <span className="text-[9px] font-bold text-zinc-500">(-{formatCurrency(insTotal)})</span>
                               </div>
                               <div className="bg-zinc-950/40 rounded border border-zinc-800/30 divide-y divide-zinc-800/30">
                                 {renderRow('Liability Insurance (Auto)', 'liability_insurance', 'liability_insurance_custom', false, 1, liabAutoPUTooltip, liabAutoTotalTooltip, finalLiabAutoPerUnit, finalLiabAutoTotal)}
                                 {renderRow('Liability Insurance (General)', '', '', false, 1, liabGenPUTooltip, liabGenTotalTooltip, finalLiabGenPerUnit, finalLiabGenTotal)}
                                 {renderRow('Cargo Insurance', 'cargo_insurance', 'cargo_insurance_custom', false, 1, cargoPUTooltip, cargoTotalTooltip, finalCargoPerUnit, finalCargoTotal)}
                                 {renderRow('Physical Damage (Truck)', 'physical_damage', 'physical_damage_custom', false, 1, pdTruckPUTooltip, pdTruckTotalTooltip, finalPdTruckPerUnit, finalPdTruckTotal)}
                                 {renderRow('Physical Damage (Trailer)', 'physical_damage', 'physical_damage_custom', false, 1, pdTrailerPUTooltip, pdTrailerTotalTooltip, finalPdTrailerPerUnit, finalPdTrailerTotal)}
                              </div>
                             </div>

                             <div className="mb-1.5">
                               <div className="flex justify-between items-center mb-0.5 px-1">
                                  <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">Admin & Technology</span>
                                  <span className="text-[9px] font-bold text-zinc-500">(-{formatCurrency(adminTotal)})</span>
                               </div>
                               <div className="bg-zinc-950/40 rounded border border-zinc-800/30 divide-y divide-zinc-800/30">
                                  {adminItems.map(item => renderRow(item.label, item.gk, item.ck))}
                               </div>
                             </div>
                        </>
                    );
                 })()}

               {simulationConfig.globalFixedExpenseAdjustment !== 0 && (
                 <div className="flex items-center py-1 border-b border-dashed border-zinc-700 px-1.5 rounded bg-zinc-800/20 mt-2">
                    <div className="w-[75%] text-left">
                      <span className="text-[10px] text-zinc-400 italic">Adjustment</span>
                    </div>
                    <div className="w-[25%] text-right">
                      <span className="text-[10px] font-mono text-zinc-400">{formatCurrency(simulationConfig.globalFixedExpenseAdjustment * companyMetrics.effCount, 1)}</span>
                    </div>
                 </div>
               )}
             </div>
          </div>

        </div>

        {/* FAR RIGHT COLUMN: Capacity & PNL History */}
        <div className="w-full xl:w-40 flex flex-col gap-2 flex-shrink-0 h-full overflow-hidden">
            
          
  

          {/* PNL History */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="p-3 border-b border-zinc-800 bg-zinc-950/30 flex justify-between items-center flex-shrink-0">
               <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
  <History size={12} className="text-emerald-500" /> PNL History
</h4>
            </div>
            <div className="flex-1 overflow-y-auto">
               <table className="w-full text-[10px]">
                 <thead className="bg-zinc-900 text-zinc-500 sticky top-0">
                    <tr>
                       <th className="px-3 py-1.5 text-left font-medium">Pay Date</th>
                       <th className="px-3 py-1.5 text-right font-medium">PNL</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-zinc-800/50">
                    {pnlHistory.length > 0 ? (
                      pnlHistory.map((item, idx) => (
                         <tr key={idx} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-3 py-1 text-zinc-400 font-mono">
   {(() => {
      const d = new Date(item.date);
      // Koristi UTC metode da izbegneš ofset vremenske zone
      return `${d.getUTCFullYear().toString().slice(-2)}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
   })()}
</td>
                            <td className={`px-3 py-1 text-right font-mono font-bold ${item.amount >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                               {item.amount < 0 ? '-' : ''}{formatCurrency(Math.abs(item.amount))}
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
        </div>

      </div>
    </div>
  );
};

export default PnLView;