

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { DriverPerformance, DriverStatus, SimulationConfig, ExpenseItem, FinImportRecord } from '../types';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils';
import { Sliders, LayoutList, PieChart, DollarSign, TrendingUp, BarChart3, LineChart, Maximize2, X, History, Filter, Info, ChevronDown, ChevronRight, Check, LayoutDashboard, Activity, Truck, Container, AlertTriangle, Eye, EyeOff, AlignLeft, AlignRight, Columns as ColumnsIcon, ArrowRightLeft } from 'lucide-react';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import SimulationModal from './SimulationModal';
import HistoricalChart, { ChartSeries } from './HistoricalChart';
import Simulator from './Simulator';
import TableFilter, { FilterRule } from './TableFilter';
import { ColumnsEditor } from './Columns';
import PnLHistoryCard from './PnLHistoryCard';
import WeekOverWeekCard from './WeekOverWeekCard';


let hasPlayedInitialAnimations = false;

const getWeeklyAmountFromExp = (amount: number, exp?: any) => {
  if (!exp) return amount;
  if (exp.valid_from && exp.valid_to) {
    const isTotalPeriodExp = ['Liability Insurance', 'Liability Insurance (Auto)', 'Liability Insurance (General)', 'Liability Insurance (Global)', 'Cargo Insurance', 'Lease Gap Coverage', 'Trailer Interchange', 'LAGO', 'PD Premium', 'Physical Damage'].includes(exp.name);
    if (isTotalPeriodExp) {
      const dFrom = new Date(exp.valid_from);
      const dTo = new Date(exp.valid_to);
      const daysDiff = Math.round((dTo.getTime() - dFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (daysDiff > 0) return amount / (daysDiff / 7);
    }
  }
  if (exp.frequency === 'Annually') return amount / 52;
  if (exp.frequency === 'Monthly') return amount / 4.33;
  return amount;
};
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
const TdWithTooltip = ({ value, tooltipContent, className, onMouseMove }: any) => {
  return (
    <td className={`group/tdtooltip ${className}`} onMouseMove={onMouseMove}>
      {value}
      <div className="hidden group-hover/tdtooltip:block">
        {tooltipContent()}
      </div>
    </td>
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
  isAverageView?: boolean,
  searchQuery?: string,
  configContracts?: any[],
  tableColumns?: any[]
}> = ({ companyMetrics, drivers, calculateMetrics, totalActiveCount, selectedDate, groupBy, chartData = [], isAverageView = false, searchQuery = '', configContracts = [], tableColumns = [] }) => {
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });
      const [isRevColExpanded, setIsRevColExpanded] = useState(false);
      const [isFuelExpanded, setIsFuelExpanded] = useState(false);
      const [isMilesExpanded, setIsMilesExpanded] = useState(false);
      const [expandedFranchiseRows, setExpandedFranchiseRows] = useState<Record<string, boolean>>({});
      const [isPoModalOpen, setIsPoModalOpen] = useState(false);
      const [isExpModalOpen, setIsExpModalOpen] = useState(false);
      const tableRef = useRef<HTMLTableElement>(null);

      React.useLayoutEffect(() => {
        if (!tableRef.current || !tableColumns.length) return;
        const table = tableRef.current;
        table.style.borderCollapse = 'collapse';
        const headers = Array.from(table.querySelectorAll('thead th'));
        
        const headerMap = new Map();
        const usedIndices = new Set();
        
        const sortedColsForMatching = [...tableColumns].sort((a, b) => b.label.length - a.label.length);
        
        headers.forEach((th, index) => {
           const text = th.textContent?.replace(/[↑↓]/g, '').trim() || '';
           const matchedCol = sortedColsForMatching.find(col => text === col.label || text === col.id || text.startsWith(col.label) || text.startsWith(col.id));
           if (matchedCol && !usedIndices.has(index)) {
               headerMap.set(matchedCol.id, index);
               usedIndices.add(index);
           }
        });
        
        const rows = Array.from(table.querySelectorAll('tr'));
        const originalOrder = new Map();
        const originalStyles = new Map();
        
        rows.forEach(row => {
            const children = Array.from(row.children);
            originalOrder.set(row, children);
            children.forEach((cell: any) => {
                if (!originalStyles.has(cell)) {
                    originalStyles.set(cell, {
                        display: cell.style.display,
                        position: cell.style.position,
                        left: cell.style.left,
                        right: cell.style.right,
                        zIndex: cell.style.zIndex,
                        backgroundColor: cell.style.backgroundColor
                    });
                }
                cell.style.display = '';
                cell.style.position = '';
                cell.style.left = '';
                cell.style.right = '';
                cell.style.zIndex = '';
                cell.style.backgroundColor = '';
            });
        });

        const leftCols = tableColumns.filter(c => c.pinned === 'left' && !c.hidden).sort((a, b) => (a.pinTime || 0) - (b.pinTime || 0));
        const rightCols = tableColumns.filter(c => c.pinned === 'right' && !c.hidden).sort((a, b) => (b.pinTime || 0) - (a.pinTime || 0));
        const midCols = tableColumns.filter(c => !c.pinned && !c.hidden);
        const hiddenCols = tableColumns.filter(c => c.hidden);

        const orderedIndices: number[] = [];
        const addIdx = (colId: string) => {
            if (headerMap.has(colId)) {
                const idx = headerMap.get(colId);
                if (!orderedIndices.includes(idx)) orderedIndices.push(idx);
            }
        };

        leftCols.forEach(c => addIdx(c.id));
        midCols.forEach(c => addIdx(c.id));
        rightCols.forEach(c => addIdx(c.id)); 
        
        headers.forEach((_, idx) => {
            if (!orderedIndices.includes(idx)) {
                let isHidden = false;
                hiddenCols.forEach(hc => {
                    if (headerMap.get(hc.id) === idx) isHidden = true;
                });
                if (!isHidden) orderedIndices.push(idx);
            }
        });

        rows.forEach(row => {
            if (row.children.length !== headers.length) return;
            const cells = originalOrder.get(row);
            orderedIndices.forEach(idx => {
                if (cells[idx]) row.appendChild(cells[idx]);
            });
            hiddenCols.forEach(col => {
                if (headerMap.has(col.id)) {
                    const idx = headerMap.get(col.id);
                    if (cells[idx]) cells[idx].style.display = 'none';
                }
            });
        });

        let currentLeft = 0;
        leftCols.forEach((col, cIdx) => {
            if (headerMap.has(col.id)) {
                const idx = headerMap.get(col.id);
                const headerCell = originalOrder.get(rows[0])[idx] as HTMLElement;
                const colWidth = headerCell ? headerCell.offsetWidth : 0;
                
                rows.forEach(row => {
                    if (row.children.length !== headers.length) return;
                    const cells = originalOrder.get(row);
                    const cell = cells[idx] as HTMLElement;
                    if (cell && cell.style.display !== 'none') {
                        const isHeader = row.parentElement?.tagName.toLowerCase() === 'thead';
                        const isFooter = row.parentElement?.tagName.toLowerCase() === 'tfoot';
                        
                        cell.style.position = 'sticky';
                        cell.style.left = cIdx === 0 ? '0px' : `${currentLeft - cIdx}px`;
                        cell.style.backgroundColor = '#09090b';
                        
                        if (isHeader) {
                            cell.style.zIndex = '70';
                        } else if (isFooter) {
                            cell.style.zIndex = '60';
                        } else {
                            cell.style.zIndex = '40';
                            cell.classList.add('hover:!z-[100]', 'group-hover:bg-zinc-900/60');
                        }
                        
                        if (cIdx === leftCols.length - 1) {
                            cell.classList.add('shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)]');
                        }
                    }
                });
                currentLeft += colWidth;
            }
        });

        let currentRight = 0;
        [...rightCols].reverse().forEach((col, cIdx) => {
            if (headerMap.has(col.id)) {
                const idx = headerMap.get(col.id);
                const headerCell = originalOrder.get(rows[0])[idx] as HTMLElement;
                const colWidth = headerCell ? headerCell.offsetWidth : 0;
                
                rows.forEach(row => {
                    if (row.children.length !== headers.length) return;
                    const cells = originalOrder.get(row);
                    const cell = cells[idx] as HTMLElement;
                    if (cell && cell.style.display !== 'none') {
                        const isHeader = row.parentElement?.tagName.toLowerCase() === 'thead';
                        const isFooter = row.parentElement?.tagName.toLowerCase() === 'tfoot';
                        
                        cell.style.position = 'sticky';
                        cell.style.right = cIdx === 0 ? '0px' : `${currentRight - cIdx}px`;
                        cell.style.backgroundColor = '#09090b';
                        
                        if (isHeader) {
                            cell.style.zIndex = '70';
                        } else if (isFooter) {
                            cell.style.zIndex = '60';
                        } else {
                            cell.style.zIndex = '40';
                            cell.classList.add('hover:!z-[100]', 'group-hover:bg-zinc-900/60');
                        }
                        
                        if (cIdx === rightCols.length - 1) {
                            cell.classList.add('shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.5)]');
                        }
                    }
                });
                currentRight += colWidth;
            }
        });

        return () => {
                        table.style.borderCollapse = '';
                        rows.forEach(row => {
                            const originalCells = originalOrder.get(row);
                            if (originalCells) {
                                const currentChildren = new Set(Array.from(row.children));
                                originalCells.forEach((cell: HTMLElement) => {
                                    const orig = originalStyles.get(cell);
                                    if (orig) {
                                        cell.style.display = orig.display;
                                        cell.style.position = orig.position;
                                        cell.style.left = orig.left;
                                        cell.style.right = orig.right;
                                        cell.style.zIndex = orig.zIndex;
                                        cell.style.backgroundColor = orig.backgroundColor;
                                    }
                                    if (currentChildren.has(cell)) {
                                        row.appendChild(cell);
                                    }
                                });
                            }
                       });
                    };
              }, [tableColumns, isAverageView, isRevColExpanded, isFuelExpanded, isMilesExpanded, selectedDate, drivers, sortConfig, groupBy]);

                  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const handleTooltipMove = (e: React.MouseEvent) => {
    const tooltips = e.currentTarget.querySelectorAll('.dynamic-tooltip');
    tooltips.forEach((t) => {
        const tooltip = t as HTMLElement;
        const x = e.clientX;
        const y = e.clientY;
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        const percentY = (y / vh) * 100;
        tooltip.style.top = `${y}px`;
        tooltip.style.bottom = 'auto';
        tooltip.style.left = 'auto';
        tooltip.style.right = `${vw - x + 15}px`;
        tooltip.style.transform = `translateY(-${percentY}%)`;
        tooltip.style.maxHeight = '90vh';
        tooltip.style.overflowY = 'auto';
    });
  };

  const val = (amount: number, divisor: number) => isAverageView ? (divisor > 0 ? amount / divisor : amount) : amount;

  const renderDisabledVal = (itemKey: string, content: React.ReactNode, isDisabled: boolean, rowDrvs: DriverPerformance[], currentDiv: number, isTotalsRow: boolean = false) => {
      const isMixedGroup = ['Company', 'Franchise', 'Team'].includes(groupBy) && !isTotalsRow;
      
      if (isMixedGroup) {
          const excludedContracts = new Set<string>();
          let excludedAmount = 0;
          const driversByContract = new Map<string, DriverPerformance[]>();
          
          rowDrvs.forEach(d => {
              const c = d.contractType || 'Unknown';
              if (!driversByContract.has(c)) driversByContract.set(c, []);
              driversByContract.get(c)!.push(d);
          });
          
          driversByContract.forEach((drvs, c) => {
              const cm = calculateMetrics(drvs, true);
              if (cm.disabledPnlItems?.includes(itemKey)) {
                  excludedContracts.add(c);
                  if (itemKey === 'revenue_collected') excludedAmount += cm.companyPay;
                  else if (itemKey === 'fuel_rebate') excludedAmount += cm.fuelRebate;
                  else if (itemKey === 'tolls') excludedAmount += cm.tolls;
                  else if (itemKey === 'po') excludedAmount += cm.totalPOCov;
                  else if (itemKey === 'recruiting') excludedAmount += cm.totalRecruiting;
                  else if (itemKey === 'dispatcher_pay') excludedAmount += cm.dispatcherPay;
                  else if (itemKey === 'weekly_expenses') excludedAmount += cm.allocatedFixed;
              }
          });

          if (excludedContracts.size > 0) {
              return (
                  <span className="relative group/disableditem flex items-center justify-end gap-0.5 cursor-help w-full" onMouseMove={handleTooltipMove}>
                      <span>{content}</span>
                      <span className="text-rose-500 font-bold text-[14px] shrink-0 leading-none pb-[1px]">!</span>
                      <div className="fixed hidden group-hover/disableditem:block z-[100000] bg-zinc-800 border border-zinc-500 text-rose-300 px-2 py-1.5 rounded shadow-xl text-[10px] whitespace-normal w-max max-w-[200px] text-left pointer-events-none font-normal opacity-100 dynamic-tooltip">
                          Excluded from PnL Calculation for {Array.from(excludedContracts).join(', ')}: {formatCurrency(Math.abs(val(excludedAmount, currentDiv)))}
                      </div>
                  </span>
              );
          }
          return <>{content}</>;
      }

      if (!isDisabled) return <>{content}</>;
      
      return (
          <span className="relative group/disableditem inline-block line-through decoration-rose-500 opacity-100 cursor-help" onMouseMove={handleTooltipMove}>
              {content}
              <div className="fixed hidden group-hover/disableditem:block z-[100000] bg-zinc-800 border border-zinc-500 text-rose-300 px-2 py-1.5 rounded shadow-xl text-[10px] whitespace-nowrap pointer-events-none font-normal opacity-100 dynamic-tooltip">
                  Excluded from PnL Calculation
              </div>
          </span>
      );
  };

  const getContractRuleForDate = (contractType: string, refDate?: string | null) => {
    const rules = (configContracts || []).filter((c: any) => c.contract_type === contractType);
    const targetTime = refDate && refDate !== 'ALL' && refDate !== 'LATEST' ? new Date(refDate).getTime() : null;

    if (rules.length === 0) return undefined;

    if (targetTime !== null && !Number.isNaN(targetTime)) {
      const activeRule = rules.filter((c: any) => {
        const fromTime = c.valid_from ? new Date(c.valid_from).getTime() : -Infinity;
        const toTime = c.valid_to ? new Date(c.valid_to).getTime() : Infinity;
        return targetTime >= fromTime && targetTime <= toTime;
      }).sort((a: any, b: any) => new Date(b.valid_from || 0).getTime() - new Date(a.valid_from || 0).getTime())[0];

      if (activeRule) return activeRule;

      const latestPastRule = rules.filter((c: any) => {
        return !c.valid_from || new Date(c.valid_from).getTime() <= targetTime;
      }).sort((a: any, b: any) => new Date(b.valid_from || 0).getTime() - new Date(a.valid_from || 0).getTime())[0];

      if (latestPastRule) return latestPastRule;
    }

    return [...rules].sort((a: any, b: any) => new Date(b.valid_from || 0).getTime() - new Date(a.valid_from || 0).getTime())[0];
  };
  const activeDriversForRows = useMemo(() => {
    if (!selectedDate || selectedDate === 'ALL') return drivers;
    let targetDate = selectedDate;
    if (selectedDate === 'LATEST') {
      const dates = Array.from(new Set(drivers.map(d => d.payDate))).filter(Boolean).sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime());
      targetDate = dates[0];
    }
    if (!targetDate) return drivers;
    return drivers.filter(d => d.payDate === targetDate);
  }, [drivers, selectedDate]);

  const uniqueContracts = Array.from(new Set(activeDriversForRows.map(d => d.contractType || 'Unassigned'))).sort().filter(c => !searchQuery || String(c).toLowerCase().startsWith(searchQuery.toLowerCase()));
  const uniqueCompanies = Array.from(new Set(activeDriversForRows.map(d => (d.companyId === 'UNRECONCILED' || !d.companyId) ? 'Unassigned' : d.companyId))).sort().filter(c => !searchQuery || String(c).toLowerCase().startsWith(searchQuery.toLowerCase()));
  const uniqueFranchises = Array.from(new Set(activeDriversForRows.map(d => (d.companyId === 'UNRECONCILED' || (d as any).isStub) ? 'Unassigned' : (d.franchiseId || 'No Franchise')))).sort().filter(c => !searchQuery || String(c).toLowerCase().startsWith(searchQuery.toLowerCase()));
  const uniqueTeams = Array.from(new Set(activeDriversForRows.map(d => (d.companyId === 'UNRECONCILED' || (d as any).isStub) ? 'Unassigned' : (d.teamId || 'No Team')))).sort().filter(c => !searchQuery || String(c).toLowerCase().startsWith(searchQuery.toLowerCase()));
  const uniqueDrivers = Array.from(new Set(activeDriversForRows.map(d => (!d.name || String(d.name).toLowerCase() === 'unknown driver' || String(d.name).toLowerCase() === 'unassigned') ? 'Unassigned' : d.name))).sort().filter(c => !searchQuery || String(c).toLowerCase().startsWith(searchQuery.toLowerCase()));
  const driverRows = [...activeDriversForRows].map(d => {
      const isUnassigned = (!d.name || String(d.name).toLowerCase() === 'unknown driver' || String(d.name).toLowerCase() === 'unassigned');
      const compositeKey = isUnassigned ? 'Unassigned' : `${d.name}|${d.companyId || ''}|${d.teamId || ''}|${d.franchiseId || ''}|${d.dispatcherId || ''}|${d.contractType || ''}`;
      return { ...d, _compositeKey: compositeKey, name: isUnassigned ? 'Unassigned' : d.name };
  }).reduce((acc, d) => {
      if (!acc.some((x: any) => x._compositeKey === d._compositeKey)) {
          acc.push(d);
      }
      return acc;
  }, [] as any[]).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')).filter((d: any) => !searchQuery || String(d.name || 'Unassigned').toLowerCase().startsWith(searchQuery.toLowerCase()));

      const getAggregatedMetrics = (groupDrivers: DriverPerformance[]) => {
          const driversByName = new Map<string, DriverPerformance[]>();
          groupDrivers.forEach(d => {
              const name = d.name || 'Unknown';
              if (!driversByName.has(name)) driversByName.set(name, []);
              driversByName.get(name)!.push(d);
          });
          const t: any = {
            rawEffCount: 0, effCount: 0, effNonTeamsCount: 0, effTrailersCount: 0, gross: 0, companyPay: 0,
            margin: 0, total_miles: 0, loaded_miles: 0, dh: 0, fuelSavings: 0, cogs: 0, dispatcherPay: 0, dispGrossAmount: 0, dispMarginAmount: 0, dispSharedLiability: 0, dispFixedAmount: 0, allocatedFixed: 0, baseFixed: 0, adjFixed: 0, totalPO: 0, totalPOCov: 0,
            totalEscrow: 0, totalBalance: 0, totalRecruiting: 0, netIncome: 0, effNonTeams: 0, pnlPerDriver: 0,
            driverPay: 0, fuel: 0, wosFuel: 0, maint: 0, tolls: 0, faults: 0, insuranceExp: 0, fuelRebate: 0,
        insLiabAuto: 0, insLiabGen: 0, insCargo: 0, insLeaseGapCoverage: 0, insTrailerInterchange: 0, insLago: 0, insPhdPremium: 0, insPhdTruck: 0, insPhdTrailer: 0,
            fcTruck: 0, fcCpm: 0, fcTrailer: 0, fcPlates: 0, fcTelematics: 0, fcPhone: 0, fcOffice: 0, fcRent: 0, fcBackupMc: 0, fcBoReg: 0, fcBoTech: 0, fcFactoring: 0,
            pnlCompanyPay: 0, pnlFuelRebate: 0, pnlAllocatedFixed: 0, pnlTotalPOCov: 0, pnlTotalRecruiting: 0, pnlTolls: 0, pnlDispGrossAmount: 0, pnlDispMarginAmount: 0,
            pnlRevBase: 0, pnlFranchiseBase: 0, pnlPoDeductions: 0, pnlPoSettle: 0, pnlNegNetPay: 0, pnlStrictNegNetPay: 0, pnlBalanceSettle: 0, pnlBalanceChange: 0, pnlExcludedBalanceChange: 0, pnlIncludedBalanceChange: 0, pnlTruckFloat: 0, pnlTruckWkly: 0, pnlOccIns: 0, pnlEld: 0, pnlIfta: 0, pnlMaintSupport: 0, pnlLiability: 0, pnlTruckPhd: 0, pnlTrailer: 0, pnlTrailerPhd: 0, pnlEscrowAdj: 0, pnlTollsAdj: 0, pnlCashAdv: 0, pnlCpmAdj: 0, pnlFuelAdj: 0, pnlProrated: 0, pnlZeroMiDrop: 0,
            excludedPoTotal: 0,
            fuel_retail_price: 0,
            spotter_retail_price: 0,
            fuel_discount_price: 0,
            fuel_quantity: 0,
            recordCount: 0,
            fuel_retail_price_count: 0,
            spotter_retail_price_count: 0,
            fuel_discount_price_count: 0,
            poBreakdown: {},
            sharedInsBreakdown: {},
            dispBreakdown: {},
            disabledPnlItems: null
          };
          driversByName.forEach((drvRecords) => {
            const m = calculateMetrics(drvRecords, true);
            
            if (t.disabledPnlItems === null) {
                t.disabledPnlItems = m.disabledPnlItems || [];
            } else {
                t.disabledPnlItems = t.disabledPnlItems.filter((i: string) => (m.disabledPnlItems || []).includes(i));
            }

            t.rawEffCount += m.rawEffCount;
            t.effCount += m.effCount;
            t.effNonTeamsCount += m.effNonTeamsCount;
            t.effTrailersCount += m.effTrailersCount;
            t.gross += m.gross;
            t.companyPay += m.companyPay;
            t.margin += m.margin;
            t.total_miles += m.total_miles || 0;
            t.loaded_miles += m.loaded_miles || 0;
            t.dh += m.dh || 0;
            t.fuelSavings += m.fuelSavings;
            t.cogs += m.cogs;
            t.dispatcherPay += m.dispatcherPay;
            t.dispGrossAmount += m.dispGrossAmount || 0;
            t.dispMarginAmount += m.dispMarginAmount || 0;
            t.dispSharedLiability += m.dispSharedLiability || 0;
            t.dispFixedAmount = (t.dispFixedAmount || 0) + (m.dispFixedAmount || 0);
            t.fullSharedLiability = (t.fullSharedLiability || 0) + (m.fullSharedLiability || 0);
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
        t.wosFuel += m.wosFuel || 0;
        t.fuelRebate += m.fuelRebate || 0;
        t.fuel_retail_price += m.fuel_retail_price || 0;
        t.fuel_retail_price_count += m.fuel_retail_price_count !== undefined ? m.fuel_retail_price_count : ((m.fuel_retail_price || 0) !== 0 ? 1 : 0);
        t.spotter_retail_price += m.spotter_retail_price || 0;
        t.spotter_retail_price_count += m.spotter_retail_price_count !== undefined ? m.spotter_retail_price_count : ((m.spotter_retail_price || 0) !== 0 ? 1 : 0);
        t.fuel_discount_price += m.fuel_discount_price || 0;
        t.fuel_discount_price_count += m.fuel_discount_price_count !== undefined ? m.fuel_discount_price_count : ((m.fuel_discount_price || 0) !== 0 ? 1 : 0);
        t.fuel_quantity += m.fuel_quantity || 0;
        t.recordCount += m.recordCount || 0;
            t.maint += m.maint || 0;
            t.tolls += m.tolls || 0;
            t.faults += m.faults || 0;
            t.insuranceExp += m.insuranceExp || 0;
            t.insLiabAuto += m.insLiabAuto || 0;
            t.insLiabGen += m.insLiabGen || 0;
            t.insCargo += m.insCargo || 0;
            t.insLeaseGapCoverage += m.insLeaseGapCoverage || 0;
            t.insTrailerInterchange += m.insTrailerInterchange || 0;
            t.insLago += m.insLago || 0;
            t.insPhdPremium += m.insPhdPremium || 0;
            t.insPhdTruck += m.insPhdTruck || 0;
            t.insPhdTrailer += m.insPhdTrailer || 0;
            t.fcTruck += m.fcTruck || 0;
            t.fcCpm += m.fcCpm || 0;
            t.fcTrailer += m.fcTrailer || 0;
            t.fcPlates += m.fcPlates || 0;
            t.fcTelematics += m.fcTelematics || 0;
            t.fcPhone += m.fcPhone || 0;
            t.fcOffice += m.fcOffice || 0;
            t.fcRent += m.fcRent || 0;
            t.fcBackupMc += m.fcBackupMc || 0;
            t.fcBoReg += m.fcBoReg || 0;
            t.fcBoTech += m.fcBoTech || 0;
            t.fcFactoring += m.fcFactoring || 0;
            t.pnlCompanyPay += m.pnlCompanyPay || 0;
            t.pnlFuelRebate += m.pnlFuelRebate || 0;
            t.pnlAllocatedFixed += m.pnlAllocatedFixed || 0;
            t.pnlTotalPOCov += m.pnlTotalPOCov || 0;
            t.pnlTotalRecruiting += m.pnlTotalRecruiting || 0;
            t.pnlTolls += m.pnlTolls || 0;
            t.pnlDispGrossAmount += m.pnlDispGrossAmount || 0;
            t.pnlDispMarginAmount += m.pnlDispMarginAmount || 0;
            t.pnlRevBase += m.pnlRevBase || 0;
            t.pnlFranchiseBase += m.pnlFranchiseBase || 0;
            t.pnlPoDeductions += m.pnlPoDeductions || 0;
            t.pnlPoSettle += m.pnlPoSettle || 0;
            t.pnlNegNetPay += m.pnlNegNetPay || 0;
            t.pnlStrictNegNetPay += m.pnlStrictNegNetPay || 0;
            t.pnlBalanceSettle += m.pnlBalanceSettle || 0;
            t.pnlBalanceChange += m.pnlBalanceChange || 0;
            t.pnlExcludedBalanceChange += m.pnlExcludedBalanceChange || 0;
            t.pnlIncludedBalanceChange += m.pnlIncludedBalanceChange || 0;
            t.pnlTruckFloat += m.pnlTruckFloat || 0;
            t.pnlTruckWkly += m.pnlTruckWkly || 0;
            t.pnlOccIns += m.pnlOccIns || 0;
            t.pnlEld += m.pnlEld || 0;
            t.pnlIfta += m.pnlIfta || 0;
            t.pnlMaintSupport += m.pnlMaintSupport || 0;
            t.pnlLiability += m.pnlLiability || 0;
            t.pnlTruckPhd += m.pnlTruckPhd || 0;
            t.pnlTrailer += m.pnlTrailer || 0;
            t.pnlTrailerPhd += m.pnlTrailerPhd || 0;
            t.pnlEscrowAdj += m.pnlEscrowAdj || 0;
            t.pnlTollsAdj += m.pnlTollsAdj || 0;
            t.pnlCashAdv += m.pnlCashAdv || 0;
            t.pnlCpmAdj += m.pnlCpmAdj || 0;
            t.pnlFuelAdj += m.pnlFuelAdj || 0;
            t.pnlProrated += m.pnlProrated || 0;
            t.pnlZeroMiDrop += m.pnlZeroMiDrop || 0;
            t.excludedPoTotal += m.excludedPoTotal || 0;
            if (m.poBreakdown) {
                Object.entries(m.poBreakdown).forEach(([k, v]) => {
                    if (!t.poBreakdown[k]) t.poBreakdown[k] = 0;
                    t.poBreakdown[k] += Number(v);
                });
            }
            if (m.sharedInsBreakdown) {
                Object.entries(m.sharedInsBreakdown).forEach(([k, v]) => {
                    if (!t.sharedInsBreakdown[k]) t.sharedInsBreakdown[k] = 0;
                    t.sharedInsBreakdown[k] += Number(v);
                });
            }
            if (m.dispBreakdown) {
                Object.entries(m.dispBreakdown).forEach(([k, v]: any) => {
                    if (!t.dispBreakdown[k]) t.dispBreakdown[k] = { gross: 0, margin: 0, fixed: 0, total: 0 };
                    t.dispBreakdown[k].gross += Number(v.gross || 0);
                    t.dispBreakdown[k].margin += Number(v.margin || 0);
                    t.dispBreakdown[k].fixed += Number(v.fixed || 0);
                    t.dispBreakdown[k].total += Number(v.total || 0);
                });
            }
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

      const getAdjustedGroupMetrics = (groupDrivers: DriverPerformance[]) => {
          const metrics = getAggregatedMetrics(groupDrivers);
          const tpogFranchiseDrivers = groupDrivers.filter(d => d.contractType === 'TPOG' && !!d.franchiseId).map(d => ({
              ...d,
              companyPay: Number((d as any).franchise_revenue_collected ?? 0),
              fixed_costs: (d as any).franchise_fixed_costs_full || 0,
              poCoverage: (d as any).franchise_po ? -Math.abs(Number((d as any).franchise_po)) : 0,
              poAmount: (d as any).franchise_po || 0,
              po_breakdown: (d as any).franchise_po_breakdown,
              ...((d as any).franchise_fixed_breakdown || {}),
              isFranchiseStub: true
          }));
          if (tpogFranchiseDrivers.length > 0) {
              const fMetrics: any = getAggregatedMetrics(tpogFranchiseDrivers);
              fMetrics.netIncome = ((fMetrics.netIncome - (fMetrics.pnlBalanceChange || 0) - (fMetrics.pnlEscrowAdj || 0)) + (fMetrics.excludedPoTotal || 0)) / 2 + (fMetrics.pnlBalanceChange || 0) + (fMetrics.pnlEscrowAdj || 0);
              metrics.netIncome -= fMetrics.netIncome;
              metrics.pnlPerDriver = metrics.effNonTeams > 0 ? metrics.netIncome / metrics.effNonTeams : 0;
              metrics.isAdjusted = true;
              metrics.fMetrics = fMetrics;
              metrics.franchiseStubs = tpogFranchiseDrivers;
          }
          return metrics;
      };
  const groupedDrivers = useMemo(() => {
                 const map = new Map<string, DriverPerformance[]>();
                 drivers.forEach(d => {
                    const isUnassigned = (!d.name || String(d.name).toLowerCase() === 'unknown driver' || String(d.name).toLowerCase() === 'unassigned');
                    let key = groupBy === 'Contract' ? (d.contractType || 'Unassigned') :
                                groupBy === 'Company' ? ((d.companyId === 'UNRECONCILED' || !d.companyId) ? 'Unassigned' : d.companyId) :
                                groupBy === 'Franchise' ? ((d.companyId === 'UNRECONCILED' || (d as any).isStub) ? 'Unassigned' : (d.franchiseId || 'No Franchise')) :
                                groupBy === 'Team' ? ((d.companyId === 'UNRECONCILED' || (d as any).isStub) ? 'Unassigned' : (d.teamId || 'No Team')) : 
                                (isUnassigned ? 'Unassigned' : `${d.name}|${d.companyId || ''}|${d.teamId || ''}|${d.franchiseId || ''}|${d.dispatcherId || ''}|${d.contractType || ''}`);
                    if (groupBy === 'Driver' && isUnassigned) key = 'Unassigned';
                    const safeKey = key || 'Unassigned';
        if (!map.has(safeKey)) map.set(safeKey, []);
        map.get(safeKey)!.push(d);
     });
     return map;
  }, [drivers, groupBy, selectedDate]);

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
          rows = driverRows.map(d => {
              const isMergedUnassigned = (!d.name || String(d.name).toLowerCase() === 'unassigned' || String(d.name).toLowerCase() === 'unknown driver');
              return { name: d.name, drivers: groupedDrivers.get(isMergedUnassigned ? 'Unassigned' : (d as any)._compositeKey) || [] };
          });
        }
        const activeDrivers = rows.flatMap(r => r.drivers);
        const t = getAggregatedMetrics(activeDrivers);
        let overallW4 = get4wMetrics('COMPANY');
        
       const tpogFranchiseDrivers = activeDrivers.filter(d => d.contractType === 'TPOG' && !!d.franchiseId).map(d => ({
            ...d,
            companyPay: (d as any).franchise_revenue_collected || 0,
            fixed_costs: (d as any).franchise_fixed_costs_full || 0,
            poCoverage: (d as any).franchise_po ? -Math.abs(Number((d as any).franchise_po)) : 0,
            poAmount: (d as any).franchise_po || 0,
            po_breakdown: (d as any).franchise_po_breakdown,
            ...((d as any).franchise_fixed_breakdown || {}),
            isFranchiseStub: true
        }));
        
        if (tpogFranchiseDrivers.length > 0) {
            const rawF = getAggregatedMetrics(tpogFranchiseDrivers);
            const fMetrics: any = { ...rawF };
            fMetrics.netIncome = ((fMetrics.netIncome - (fMetrics.pnlBalanceChange || 0) - (fMetrics.pnlEscrowAdj || 0)) + (fMetrics.excludedPoTotal || 0)) / 2 + (fMetrics.pnlBalanceChange || 0) + (fMetrics.pnlEscrowAdj || 0);

            t.netIncome -= fMetrics.netIncome;
            t.pnlPerDriver = t.effNonTeams > 0 ? t.netIncome / t.effNonTeams : 0;
            t.isAdjusted = true;
        }

        return { ...t, w4Sum: overallW4.sum, w4Avg: overallW4.avg };
      })();

  const sortedData = useMemo(() => {
     let arr: any[] = [];
     let type = groupBy;
     if (groupBy === 'Company') arr = uniqueCompanies;
     else if (groupBy === 'Contract') arr = uniqueContracts;
     else if (groupBy === 'Franchise') arr = uniqueFranchises;
     else if (groupBy === 'Team') arr = uniqueTeams;
     else if (groupBy === 'Driver') arr = driverRows;

     const computedArr = arr.map(item => {
        let name = type === 'Driver' ? (item.name || 'Unassigned') : (item || 'Unassigned');
        let drvs = type === 'Driver' ? (groupedDrivers.get((!item.name || String(item.name).toLowerCase() === 'unassigned' || String(item.name).toLowerCase() === 'unknown driver') ? 'Unassigned' : item._compositeKey) || []) : (groupedDrivers.get(name) || []);
        const metrics = getAdjustedGroupMetrics(drvs);
        const w4 = get4wMetrics(name);
        const div = Math.max(1, new Set(drvs.map((r: any) => r.payDate || r.week_ending)).size);
        return { original: item, name, drvs, metrics, w4, div };
     });

     if (!sortConfig) return computedArr;

     computedArr.sort((a, b) => {
        let aVal: any = 0; 
        let bVal: any = 0;

        if (sortConfig.key === 'name') { aVal = a.name; bVal = b.name; }
        else if (sortConfig.key === 'companyId') { aVal = a.original.companyId || ''; bVal = b.original.companyId || ''; }
        else if (sortConfig.key === 'teamId') { aVal = a.original.teamId || ''; bVal = b.original.teamId || ''; }
        else if (sortConfig.key === 'franchiseId') { aVal = a.original.franchiseId || ''; bVal = b.original.franchiseId || ''; }
        else if (sortConfig.key === 'dispatcherId') { aVal = a.original.dispatcherId || ''; bVal = b.original.dispatcherId || ''; }
        else if (sortConfig.key === 'contractType') { aVal = a.original.contractType || ''; bVal = b.original.contractType || ''; }
        else if (sortConfig.key === 'w4Sum') { aVal = val(a.w4.sum, a.div); bVal = val(b.w4.sum, b.div); }
        else if (sortConfig.key === 'w4Avg') { aVal = val(a.w4.avg, a.div); bVal = val(b.w4.avg, b.div); }
        else if (['fuel_retail_price', 'spotter_retail_price', 'fuel_discount_price'].includes(sortConfig.key)) { 
            const aCount = a.metrics[`${sortConfig.key}_count`];
            const bCount = b.metrics[`${sortConfig.key}_count`];
            aVal = aCount > 0 ? a.metrics[sortConfig.key] / aCount : 0; 
            bVal = bCount > 0 ? b.metrics[sortConfig.key] / bCount : 0; 
        }
        else { aVal = val((a.metrics as any)[sortConfig.key] || 0, a.div); bVal = val((b.metrics as any)[sortConfig.key] || 0, b.div); }

        if (typeof aVal === 'string') return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
     });

     return computedArr;
  }, [groupBy, uniqueCompanies, uniqueContracts, uniqueFranchises, uniqueTeams, driverRows, sortConfig, groupedDrivers, isAverageView, chartData]);
 const renderRowCells = (metrics: any, w4: any, isStub: boolean = false, rowName?: string, rowDrivers: DriverPerformance[] = []) => {
    const div = Math.max(1, new Set(rowDrivers.map((r: any) => r.payDate || r.week_ending)).size);
    const rowBalChange = metrics.pnlBalanceChange;
    return (
    <>
      {!isAverageView && <td className="px-1 py-0.5 text-right text-white">{groupBy === 'Driver' ? `${Number((metrics.effCount * 7).toFixed(1))}/7` : Number(metrics.effCount.toFixed(1))}</td>}
      {!isAverageView && <td className="px-1 py-0.5 text-right text-white">{groupBy === 'Driver' ? `${Number((metrics.effNonTeamsCount * 7).toFixed(1))}/7` : Number(metrics.effNonTeamsCount.toFixed(1))}</td>}
      {!isAverageView && <td className="px-1 py-0.5 text-right text-white">{groupBy === 'Driver' ? `${Number((metrics.effTrailersCount * 7).toFixed(1))}/7` : Number(metrics.effTrailersCount.toFixed(1))}</td>}
      <td className="px-1 py-0.5 text-right text-yellow-400">{formatCurrency(val(metrics.gross, div))}</td>
      <td className="px-1 py-0.5 text-right text-yellow-400 font-medium">{formatCurrency(val(metrics.margin, div))}</td>
      <td className="px-1 py-0.5 text-right text-yellow-400 font-medium">{Math.round(val(metrics.total_miles, div)).toLocaleString()}</td>
      {isMilesExpanded && (
        <>
           <td className="px-1 py-0.5 text-right text-yellow-400 opacity-70">{Math.round(val(metrics.loaded_miles, div)).toLocaleString()}</td>
           <td className="px-1 py-0.5 text-right text-yellow-400 opacity-70">{Math.round(val(metrics.dh, div)).toLocaleString()}</td>
        </>
      )}
      <td className="px-1 py-0.5 text-right text-purple-400">{formatCurrency(val(metrics.driverPay, div))}</td>
      {groupBy !== 'Driver' && (
        <td className="px-1 py-0.5 text-right text-purple-400 font-medium">
          {(() => {
            const netPays = rowDrivers.filter(d => (rowName === 'TPOG (Franchise PnL)' || !(d as any).isFranchiseStub) && d.companyId !== 'UNRECONCILED' && (d.effectiveDrivers || 0) > 0).map(d => Number(d.netPay ?? 0)).sort((a, b) => a - b);
            if (netPays.length === 0) return formatCurrency(0);
            const mid = Math.floor(netPays.length / 2);
            const med = netPays.length % 2 !== 0 ? netPays[mid] : (netPays[mid - 1] + netPays[mid]) / 2;
            return formatCurrency(med);
          })()}
        </td>
      )}
      <TdWithTooltip
        className="relative hover:z-[99999] px-1 py-0.5 text-right text-purple-400 !overflow-visible cursor-help"
        onMouseMove={handleTooltipMove}
        value={`-${formatCurrency(Math.abs(val(metrics.insuranceExp, div)))}`}
        tooltipContent={() => (
          <div className="fixed block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[220px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
            <div className="font-bold text-white border-b border-zinc-600 pb-1 mb-1 text-[11px]">Insurance Breakdown:</div>
            <div className="flex justify-between gap-4"><span>Liability (Auto):</span><span className="font-mono">-{formatCurrency(Math.abs(val(metrics.insLiabAuto, div)))}</span></div>
            {val(metrics.fullSharedLiability, div) !== 0 && <div className="flex justify-between gap-4"><span>Shared Liability (Auto):</span><span className="font-mono text-emerald-400">+{formatCurrency(Math.abs(val(metrics.fullSharedLiability, div)))}</span></div>}
            <div className="flex justify-between gap-4"><span>Liability (Gen):</span><span className="font-mono">-{formatCurrency(Math.abs(val(metrics.insLiabGen, div)), 2)}</span></div>
            <div className="flex justify-between gap-4"><span>Cargo:</span><span className="font-mono">-{formatCurrency(Math.abs(val(metrics.insCargo, div)))}</span></div>
            <div className="flex justify-between gap-4"><span>Lease Gap Coverage:</span><span className="font-mono">-{formatCurrency(Math.abs(val(metrics.insLeaseGapCoverage, div)))}</span></div>
            <div className="flex justify-between gap-4"><span>Trailer Interchange:</span><span className="font-mono">-{formatCurrency(Math.abs(val(metrics.insTrailerInterchange, div)))}</span></div>
            <div className="flex justify-between gap-4"><span>PhD Premium:</span><span className="font-mono">-{formatCurrency(Math.abs(val(metrics.insPhdPremium, div)))}</span></div>
            <div className="flex justify-between gap-4"><span>PhD Truck:</span><span className="font-mono">-{formatCurrency(Math.abs(val(metrics.insPhdTruck, div)))}</span></div>
           <div className="flex justify-between gap-4"><span>PhD Trailer:</span><span className="font-mono">-{formatCurrency(Math.abs(val(metrics.insPhdTrailer, div)))}</span></div>
      </div>
    )}
  />
   <td className="px-1 py-0.5 text-right text-purple-400">{val(metrics.fuel, div) < 0 ? `-${formatCurrency(Math.abs(val(metrics.fuel, div)))}` : formatCurrency(val(metrics.fuel, div))}</td>
   {isFuelExpanded && (
     <>
       <td className="px-1 py-0.5 text-right text-purple-400 opacity-70">{val(metrics.wosFuel, div) < 0 ? `-${formatCurrency(Math.abs(val(metrics.wosFuel, div)))}` : formatCurrency(val(metrics.wosFuel, div))}</td>
       <td className="px-1 py-0.5 text-right text-purple-400 opacity-70">{formatCurrency(metrics.fuel_retail_price_count > 0 ? metrics.fuel_retail_price / metrics.fuel_retail_price_count : 0, 2)}</td>
       <td className="px-1 py-0.5 text-right text-purple-400 opacity-70">{formatCurrency(metrics.spotter_retail_price_count > 0 ? metrics.spotter_retail_price / metrics.spotter_retail_price_count : 0, 2)}</td>
       <td className="px-1 py-0.5 text-right text-purple-400 opacity-70">{formatCurrency(metrics.fuel_discount_price_count > 0 ? metrics.fuel_discount_price / metrics.fuel_discount_price_count : 0, 2)}</td>
       <td className="px-1 py-0.5 text-right text-purple-400 opacity-70">{Math.round(val(metrics.fuel_quantity, div))}</td>
     </>
   )}
  <td className="px-1 py-0.5 text-right text-blue-400 !overflow-visible">
        {renderDisabledVal('revenue_collected', formatCurrency(val(metrics.companyPay, div)), !!metrics.disabledPnlItems?.includes('revenue_collected'), rowDrivers, div)}
      </td>
{isRevColExpanded && (
          <>
            <TdWithTooltip
              className="relative hover:z-[99999] px-1 py-0.5 text-right text-zinc-400 font-mono cursor-help !overflow-visible"
              onMouseMove={handleTooltipMove}
              value={`${val(metrics.pnlRevBase, div) < 0 ? '-' : '+'}${formatCurrency(Math.abs(val(metrics.pnlRevBase, div)))}`}
              tooltipContent={() => (
                <div className="fixed block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] normal-case text-left w-[280px] pointer-events-none dynamic-tooltip">
                  <div className="font-bold text-white border-b border-zinc-600 pb-1 mb-1 text-[11px]">Revenue Base Calculation:</div>
                  {rowDrivers.length > 0 ? (
                      Array.from(new Set(rowDrivers.map(d => d.contractType || 'Unknown'))).map(cType => {
                          const subset = rowDrivers.filter(d => (d.contractType || 'Unknown') === cType);
                          const ruleDate = subset.find(d => d.payDate)?.payDate || (selectedDate !== 'ALL' && selectedDate !== 'LATEST' ? selectedDate : null);
                          const rule = getContractRuleForDate(cType, ruleDate);
                          const gPerc = rule && rule.mc_gross_percent !== undefined ? Number(rule.mc_gross_percent) * 100 : null;
                          const mPerc = rule && rule.mc_margin_percent !== undefined ? Number(rule.mc_margin_percent) * 100 : null;
                          const dGrossPerc = rule && rule.dispatcher_gross_percent !== undefined ? Number(rule.dispatcher_gross_percent) * 100 : 0;
                          const dMargPerc = rule && (rule as any).dispatcher_margin_percent !== undefined ? Number((rule as any).dispatcher_margin_percent) * 100 : 0;
                          const calcType = rule?.calculation_type || 'STANDARD';
                          const cGross = subset.reduce((sum, d) => sum + (d.grossRevenue || 0), 0);
                          const cMargin = subset.reduce((sum, d) => sum + (d.marginAmount || 0), 0);

                          const cTotal = subset.reduce((sum, d) => {
                              const rBase = Number((d as any).revenue_base ?? (d as any).revenueBase ?? 0);
                              const revWithoutFuelVal = Number((d as any).rev_without_fuel ?? (d as any).revWithoutFuel ?? 0);
                              const dMiles = Number((d as any).total_miles ?? d.milesDriven ?? 0);
                              const mileCapFactor = (revWithoutFuelVal > 0 && dMiles === 0) ? 0 : 1;
                              let companyTakeMulti = 1;
                              if ((d.contractType === 'TPOG WITH FRANCHISE' || (d.contractType === 'TPOG' && d.franchiseId)) && configContracts && configContracts.length > 0) {
                                  const tpogFranRule = getContractRuleForDate('TPOG WITH FRANCHISE', d.payDate || ruleDate);
                                  if (tpogFranRule && tpogFranRule.calculation_type === 'TPOG_FRANCHISE') {
                                      companyTakeMulti = tpogFranRule.mc_gross_percent !== undefined ? Number(tpogFranRule.mc_gross_percent) : 1;
                                  }
                              }
                              if (d.name === 'Garland Jermaine Norris') {
                                  return sum + ((d.grossRevenue || 0) * 0.2) * mileCapFactor * companyTakeMulti;
                              }
                              return sum + rBase * mileCapFactor * companyTakeMulti;
                          }, 0);
                          
                          if (cTotal === 0 && cGross === 0 && cMargin === 0) return null;
                          
                       let formulaStr = '';
                                  if (cType === 'CPM' && subset.some(d => d.name === 'Garland Jermaine Norris')) {
                                      formulaStr = `Gross * 20% (Garland Exception)`;
                                  } else if (calcType === 'MCLOO_STYLE') {
                                      formulaStr = `Gross * ${gPerc ?? 8}% + Margin * ${mPerc ?? 0}%`;
                                  } else if (calcType === 'OO_NONF') {
                                      formulaStr = `Gross * ${gPerc ?? 7.5}% + Margin * ${mPerc ?? 70}%`;
                                  } else if (calcType === 'OO_FRANCHISE') {
                                      formulaStr = `Gross * ${gPerc ?? 4}% + Margin * ${mPerc ?? 35}%`;
                                  } else if (calcType === 'TPOG_NONF' || calcType === 'POG_STYLE' || calcType === 'TPOG_FRANCHISE') {
                                      formulaStr = `Gross * (1 - Drv%) + Margin * ${mPerc ?? 70}%`;
                                  } else if (calcType === 'NEW_FORMULA') {
                                      formulaStr = `(${gPerc ?? 0}% * (Gross + Margin - (Margin * ${mPerc ?? 0}%))) - (Drv% * Gross) - (Gross * ${dGrossPerc ?? 0}% + Margin * ${dMargPerc ?? 0}%)`;
                                  } else if (calcType === 'NEW_CPM_FORMULA') {
                                      formulaStr = `Gross - Gross Pay`;
                                  } else if (calcType === 'CPM_STYLE') {
                                      formulaStr = `(Gross + Margin * ${mPerc ?? 70}%) - Net Pay`;
                                  }else if (gPerc !== null && mPerc !== null) {
                              if (gPerc > 0 && mPerc > 0) formulaStr = `(Gross * ${gPerc}%) + (Margin * ${mPerc}%)`;
                              else if (gPerc > 0) formulaStr = `Gross * ${gPerc}%`;
                              else if (mPerc > 0) formulaStr = `Margin * ${mPerc}%`;
                              else formulaStr = `Custom / Flat`;
                          } else {
                              formulaStr = `Standard Base Formula`;
                          }

                          return (
                              <div key={cType} className="mb-1.5 last:mb-0">
                                  <div className="text-emerald-400 font-bold text-[9px]">{cType}</div>
                                  <div className="flex flex-col gap-0.5 text-[9px] pl-1 border-l border-zinc-700 ml-1">
                                      <div className="text-zinc-300">Gross: {formatCurrency(val(cGross, div))} | Margin: {formatCurrency(val(cMargin, div))}</div>
                                      <div className="text-zinc-400 italic text-[8px]">Formula: {formulaStr}</div>
                                  </div>
                              </div>
                          );
                      })
                  ) : null}
                  <div className="flex justify-between border-t border-zinc-600 mt-1 pt-1 font-bold text-white">
                      <span>Total Rev Base:</span><span className="font-mono">{formatCurrency(val(metrics.pnlRevBase, div))}</span>
                  </div>
                </div>
              )}
            />
          <TdWithTooltip
            className="relative hover:z-[99999] px-1 py-0.5 text-right text-zinc-400 font-mono cursor-help !overflow-visible"
            onMouseMove={handleTooltipMove}
            value={`${val(rowBalChange, div) < 0 ? '-' : '+'}${formatCurrency(Math.abs(val(rowBalChange, div)))}`}
            tooltipContent={() => (
              <div className="fixed block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] normal-case text-left w-[280px] pointer-events-none flex flex-col gap-1 dynamic-tooltip whitespace-normal break-words">
                <div className="font-bold text-sky-400 border-b border-zinc-600 pb-1 mb-1">Balance Change Breakdown:</div>
                <div className="flex justify-between"><span>PO Deductions:</span><span className="font-mono">{formatCurrency(val(metrics.pnlPoDeductions, div))}</span></div>
                <div className="flex justify-between"><span>PO Settle:</span><span className="font-mono">{formatCurrency(val(metrics.pnlPoSettle, div))}</span></div>
                <div className="flex justify-between"><span>Net Pay:</span><span className="font-mono">{val(metrics.pnlNegNetPay, div) < 0 ? '-' : '+'}{formatCurrency(Math.abs(val(metrics.pnlNegNetPay, div)))}</span></div>
                <div className="text-[9px] text-zinc-400 italic mt-0.5 leading-tight">* Shows only negative net pay.</div>
                <div className="flex justify-between mt-0.5"><span>Balance Settle:</span><span className="font-mono">{formatCurrency(val(metrics.pnlBalanceSettle, div))}</span></div>
                <div className="flex justify-between border-t border-zinc-600 mt-1 pt-1 font-bold text-white">
                  <span>Total:</span>
                  <span className="font-mono">{formatCurrency(val(rowBalChange, div))}</span>
                </div>
                {Math.abs(metrics.pnlExcludedBalanceChange || 0) > 0.01 && (
                  <div className="flex justify-between mt-1 font-bold text-sky-300">
                    <span>Calculated Amount (TPOG Non-Franchise):</span>
                    <span className="font-mono">{formatCurrency(val(rowBalChange - metrics.pnlExcludedBalanceChange, div))}</span>
                  </div>
                )}
                {((groupBy === 'Contract' && (rowName === 'TPOG' || rowName === 'TPOG (Franchise PnL)')) ||
                  ((groupBy === 'Company' || groupBy === 'Franchise' || groupBy === 'Team') && rowDrivers.some(d => d.contractType === 'MCLOO' || (d.contractType === 'TPOG' && !!d.franchiseId))) ||
                  (groupBy === 'Driver' && rowDrivers.some(d => d.contractType === 'MCLOO' || (d.contractType === 'TPOG' && !!d.franchiseId)))) && (
                  <div className="flex flex-col gap-1 mt-1 border-t border-zinc-700 pt-1">
                    {groupBy === 'Contract' && rowName === 'TPOG' && (
                        <span className="text-[9px] text-amber-400 italic leading-tight">
                            * Note: Balance Change is calculated only for non-franchise TPOG, but the displayed figure is the full amount (including TPOG with franchise).
                        </span>
                    )}
                    {groupBy === 'Contract' && rowName === 'TPOG (Franchise PnL)' && (
                        <span className="text-[9px] text-emerald-400 italic leading-tight">
                            * Note: The full balance change is calculated here and this income/expense is borne by the franchise.
                        </span>
                    )}
                    {(groupBy === 'Company' || groupBy === 'Franchise' || groupBy === 'Team') && (
                        <>
                            {rowDrivers.some(d => d.contractType === 'MCLOO') && (
                                <span className="text-[9px] text-amber-400 italic leading-tight">
                                    * Note: Values for MCLOO drivers are multiplied by 0.3.
                                </span>
                            )}
                            {rowDrivers.some(d => d.contractType === 'TPOG' && !!d.franchiseId) && (
                                <span className="text-[9px] text-amber-400 italic leading-tight">
                                    * Note: TPOG contracts with a franchise are excluded for the company but included for the franchise.
                                </span>
                            )}
                        </>
                    )}
                    {groupBy === 'Driver' && (
                        <>
                            {rowDrivers.some(d => d.contractType === 'MCLOO') && (
                                <span className="text-[9px] text-amber-400 italic leading-tight">
                                    * Note: Value is multiplied by 0.3.
                                </span>
                            )}
                            {rowDrivers.some(d => d.contractType === 'TPOG' && !!d.franchiseId) && (
                                <span className="text-[9px] text-amber-400 italic leading-tight">
                                    * Note: The full balance change applies to the Franchise PnL but is excluded from the Company Revenue Collected calculation.
                                </span>
                            )}
                        </>
                    )}
                  </div>
                )}
              </div>
            )}
          />
          <TdWithTooltip
            className="relative hover:z-[99999] px-1 py-0.5 text-right text-zinc-400 font-mono cursor-help !overflow-visible"
            onMouseMove={handleTooltipMove}
            value={`${val(metrics.pnlProrated, div) < 0 ? '-' : '+'}${formatCurrency(Math.abs(val(metrics.pnlProrated, div)))}`}
            tooltipContent={() => (
              <div className="fixed block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] normal-case text-left w-[220px] pointer-events-none flex flex-col gap-1 dynamic-tooltip">
                <div className="font-bold text-emerald-300 border-b border-zinc-600 pb-1 mb-1">Prorated Fixed Costs:</div>
                <div className="flex justify-between"><span>Truck Float:</span><span className="font-mono">{formatCurrency(val(metrics.pnlTruckFloat, div))}</span></div>
                <div className="flex justify-between"><span>Truck Weekly:</span><span className="font-mono">{formatCurrency(val(metrics.pnlTruckWkly, div))}</span></div>
                <div className="flex justify-between"><span>Occ Ins:</span><span className="font-mono">{formatCurrency(val(metrics.pnlOccIns, div))}</span></div>
                <div className="flex justify-between"><span>ELD:</span><span className="font-mono">{formatCurrency(val(metrics.pnlEld, div))}</span></div>
                <div className="flex justify-between"><span>IFTA:</span><span className="font-mono">{formatCurrency(val(metrics.pnlIfta, div))}</span></div>
                <div className="flex justify-between"><span>Maint Support:</span><span className="font-mono">{formatCurrency(val(metrics.pnlMaintSupport, div))}</span></div>
                <div className="flex justify-between"><span>Liability:</span><span className="font-mono">{formatCurrency(val(metrics.pnlLiability, div))}</span></div>
                <div className="flex justify-between"><span>Truck PHD:</span><span className="font-mono">{formatCurrency(val(metrics.pnlTruckPhd, div))}</span></div>
                <div className="flex justify-between"><span>Trailer:</span><span className="font-mono">{formatCurrency(val(metrics.pnlTrailer, div))}</span></div>
                <div className="flex justify-between"><span>Trailer PHD:</span><span className="font-mono">{formatCurrency(val(metrics.pnlTrailerPhd, div))}</span></div>
              </div>
            )}
          />
          <TdWithTooltip
            className="relative hover:z-[99999] px-1 py-0.5 text-right text-zinc-400 font-mono cursor-help !overflow-visible"
            onMouseMove={handleTooltipMove}
            value={`${val(metrics.pnlZeroMiDrop, div) < 0 ? '-' : (val(metrics.pnlZeroMiDrop, div) > 0 ? '+' : '')}${formatCurrency(Math.abs(val(metrics.pnlZeroMiDrop, div)))}`}
            tooltipContent={() => {
              let count = 0; let revBase = 0; let balChange = 0; let prorated = 0;
              const uniqueNames = Array.from(new Set((rowDrivers || []).map(d => d.name || 'Unknown')));
              uniqueNames.forEach(dName => {
                  const drvRecords = rowDrivers.filter(d => d.name === dName);
                  const m = calculateMetrics(drvRecords, true);
                  if (m.pnlZeroMiDrop < 0) {
                    count++;
                    drvRecords.forEach(d => {
                        const dMiles = Number((d as any).total_miles ?? d.milesDriven ?? 0);
                        if (dMiles === 0) {
                            const dm = calculateMetrics([d], true);
                            if (dm.pnlZeroMiDrop < 0) {
                              let effectiveBalChange = dm.pnlBalanceChange;
                              if (d.contractType === 'TPOG' && !!d.franchiseId && !(d as any).isFranchiseStub) {
                                  effectiveBalChange = 0;
                              }
                              const originalRevBase = Math.abs(dm.pnlZeroMiDrop) - effectiveBalChange - dm.pnlProrated;
                              revBase += originalRevBase;
                              balChange += effectiveBalChange;
                              prorated += dm.pnlProrated;
                            }
                        }
                    });
                  }
              });
              if (count === 0) return null;
              return (
                <div className="fixed block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] normal-case text-left w-[260px] pointer-events-none flex flex-col gap-1 dynamic-tooltip">
                  <div className="font-bold text-amber-400 border-b border-zinc-600 pb-1 mb-1">0 Mi Cap Drop:</div>
                  {groupBy !== 'Driver' && <div className="flex justify-between"><span>Drivers with 0 miles:</span><span className="font-mono font-bold text-white">{count}</span></div>}
                  <div className="flex justify-between mt-1"><span>Revenue Base:</span><span className="font-mono">-{formatCurrency(val(revBase, div))}</span></div>
                  <div className="flex justify-between"><span>Balance Change:</span><span className="font-mono">{val(balChange, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(balChange, div)))}</span></div>
                  <div className="flex justify-between"><span>Revenue Prorated:</span><span className="font-mono">-{formatCurrency(val(prorated, div))}</span></div>
                  <div className="flex justify-between border-t border-zinc-600 mt-1 pt-1 font-bold text-white">
                    <span>Total Drop:</span>
                    <span className="font-mono">-{formatCurrency(Math.abs(val(metrics.pnlZeroMiDrop, div)))}</span>
                  </div>
                </div>
              );
            }}
          />
          <td className="px-1 py-0.5 text-right text-zinc-400 font-mono">{val(metrics.pnlEscrowAdj, div) < 0 ? '-' : '+'}{formatCurrency(Math.abs(val(metrics.pnlEscrowAdj, div)))}</td>
          <td className="px-1 py-0.5 text-right text-zinc-400 font-mono">+{formatCurrency(Math.abs(val(metrics.pnlTollsAdj, div)))}</td>
          <td className="px-1 py-0.5 text-right text-zinc-400 font-mono">{val(metrics.pnlCashAdv, div) < 0 ? '-' : '+'}{formatCurrency(Math.abs(val(metrics.pnlCashAdv, div)))}</td>
          <td className="px-1 py-0.5 text-right text-zinc-400 font-mono">{val(metrics.pnlCpmAdj, div) < 0 ? '-' : '+'}{formatCurrency(Math.abs(val(metrics.pnlCpmAdj, div)))}</td>
          <td className="px-1 py-0.5 text-right text-zinc-400 font-mono">{val(metrics.pnlFuelAdj, div) < 0 ? '-' : '+'}{formatCurrency(Math.abs(val(metrics.pnlFuelAdj, div)))}</td>
          <td className="group/sharedins relative hover:z-[99999] px-1 py-0.5 text-right text-zinc-400 font-mono cursor-help !overflow-visible" onMouseMove={handleTooltipMove}>
            +{formatCurrency(Math.abs(val(metrics.fullSharedLiability, div)))}
            {metrics.sharedInsBreakdown && Object.keys(metrics.sharedInsBreakdown).length > 0 && (
              <div className="fixed hidden group-hover/sharedins:block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] normal-case text-left w-max min-w-[200px] pointer-events-none flex flex-col gap-1 dynamic-tooltip">
                <div className="font-bold text-sky-400 border-b border-zinc-600 pb-1 mb-1">Shared Ins Breakdown:</div>
                {Object.entries(metrics.sharedInsBreakdown).map(([comp, amount]: any) => (
                   <div key={comp} className="flex justify-between gap-4">
                      <span>{comp}:</span>
                      <span className="font-mono text-zinc-300">+{formatCurrency(Math.abs(val(Number(amount), div)))}</span>
                   </div>
                ))}
              </div>
            )}
          </td>
        </>
      )}
       <td className="px-1 py-0.5 text-right text-blue-400 !overflow-visible">
         {renderDisabledVal('fuel_rebate', formatCurrency(val(metrics.fuelRebate, div)), !!metrics.disabledPnlItems?.includes('fuel_rebate'), rowDrivers, div)}
       </td>
      <td className="group/fixed relative hover:z-[99999] px-1 py-0.5 text-right text-blue-400 !overflow-visible cursor-help" onMouseMove={handleTooltipMove}>
        {renderDisabledVal('weekly_expenses', `-${formatCurrency(Math.abs(val(metrics.allocatedFixed, div)))}`, !!metrics.disabledPnlItems?.includes('weekly_expenses'), rowDrivers, div)}
        <div className="fixed hidden group-hover/fixed:block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[260px] pointer-events-none flex flex-col gap-1 whitespace-normal break-words dynamic-tooltip">
          <div className="font-bold text-white border-b border-zinc-600 pb-1 mb-1 text-[11px]">Weekly Expenses Breakdown:</div>
         {val(metrics.insLiabAuto, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Liability (Auto):</span><span className="font-mono">{val(metrics.insLiabAuto, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.insLiabAuto, div)))}</span></div>}
                        {val(metrics.insLiabGen, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Liability (Gen):</span><span className="font-mono">{val(metrics.insLiabGen, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.insLiabGen, div)))}</span></div>}
                        {val(metrics.insCargo, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Cargo:</span><span className="font-mono">{val(metrics.insCargo, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.insCargo, div)))}</span></div>}
                        {val(metrics.insLeaseGapCoverage, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Lease Gap Coverage:</span><span className="font-mono">{val(metrics.insLeaseGapCoverage, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.insLeaseGapCoverage, div)))}</span></div>}
                        {val(metrics.insTrailerInterchange, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Trailer Interchange:</span><span className="font-mono">{val(metrics.insTrailerInterchange, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.insTrailerInterchange, div)))}</span></div>}
                        {val(metrics.insLago, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>LAGO:</span><span className="font-mono">{val(metrics.insLago, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.insLago, div)))}</span></div>}
                        {val(metrics.insPhdPremium, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>PhD Premium:</span><span className="font-mono">{val(metrics.insPhdPremium, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.insPhdPremium, div)))}</span></div>}
                        {val(metrics.insPhdTruck, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>PhD Truck:</span><span className="font-mono">{val(metrics.insPhdTruck, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.insPhdTruck, div)))}</span></div>}
                        {val(metrics.insPhdTrailer, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>PhD Trailer:</span><span className="font-mono">{val(metrics.insPhdTrailer, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.insPhdTrailer, div)))}</span></div>}
                        {val(metrics.fcTruck, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Truck Price:</span><span className="font-mono">{val(metrics.fcTruck, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.fcTruck, div)))}</span></div>}
                        <div className="flex justify-between gap-2 text-zinc-400"><span>CPM:</span><span className="font-mono">{val(metrics.fcCpm, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.fcCpm, div)))}</span></div>
                        {val(metrics.fcTrailer, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Trailer Price:</span><span className="font-mono">{val(metrics.fcTrailer, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.fcTrailer, div)))}</span></div>}
                        {val(metrics.fcPlates, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Plates:</span><span className="font-mono">{val(metrics.fcPlates, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.fcPlates, div)))}</span></div>}
                        {val(metrics.fcTelematics, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Telematics:</span><span className="font-mono">{val(metrics.fcTelematics, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.fcTelematics, div)))}</span></div>}
                        {val(metrics.fcPhone, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Phone & Internet:</span><span className="font-mono">{val(metrics.fcPhone, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.fcPhone, div)))}</span></div>}
                        {val(metrics.fcOffice, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Office Supplies:</span><span className="font-mono">{val(metrics.fcOffice, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.fcOffice, div)))}</span></div>}
                        {val(metrics.fcRent, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Rent & Parking:</span><span className="font-mono">{val(metrics.fcRent, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.fcRent, div)))}</span></div>}
                        {val(metrics.fcBackupMc, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Backup MC:</span><span className="font-mono">{val(metrics.fcBackupMc, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.fcBackupMc, div)))}</span></div>}
                        {val(metrics.fcBoReg, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Back Office Pay:</span><span className="font-mono">{val(metrics.fcBoReg, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.fcBoReg, div)))}</span></div>}
                        {val(metrics.fcBoTech, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Tech Pay:</span><span className="font-mono">{val(metrics.fcBoTech, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.fcBoTech, div)))}</span></div>}
                        {val(metrics.fcFactoring, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Factoring:</span><span className="font-mono">{val(metrics.fcFactoring, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.fcFactoring, div)))}</span></div>}
          {val(metrics.adjFixed, div) !== 0 && <div className="flex justify-between gap-2"><span>Adjustments:</span><span className="font-mono">{val(metrics.adjFixed, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(metrics.adjFixed, div)))}</span></div>}
          <div className="flex justify-between gap-2 border-t border-zinc-600 pt-1 font-bold text-white"><span>Total Wkly Exp:</span><span className="font-mono">-{formatCurrency(Math.abs(val(metrics.allocatedFixed, div)))}</span></div>
        </div>
      </td>
      <td className="px-1 py-0.5 text-right text-blue-400 !overflow-visible">
        {renderDisabledVal('tolls', val(metrics.tolls, div) === 0 ? formatCurrency(0) : `-${formatCurrency(Math.abs(val(metrics.tolls, div)))}`, !!metrics.disabledPnlItems?.includes('tolls'), rowDrivers, div)}
      </td>
      <td className="group/pobreakdown relative hover:z-[99999] px-1 py-0.5 text-right text-blue-400 cursor-help !overflow-visible" onMouseMove={handleTooltipMove}>
        {renderDisabledVal('po', formatCurrency(val(metrics.totalPOCov, div)), !!metrics.disabledPnlItems?.includes('po'), rowDrivers, div)}
        {metrics.poBreakdown && Object.keys(metrics.poBreakdown).length > 0 && (
          <div className="fixed hidden group-hover/pobreakdown:block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[240px] pointer-events-none flex flex-col gap-1 dynamic-tooltip whitespace-normal break-words">
            <div className="font-bold text-sky-400 border-b border-zinc-600 pb-1 mb-1">PO Breakdown:</div>
            {Object.entries(metrics.poBreakdown).map(([reason, amount]: any) => {
                 let finalAmount = Number(amount);
                 if (rowDrivers.some(d => d.contractType === 'MCLOO')) {
                     finalAmount = finalAmount / 0.3;
                 }
                 return (
                   <div key={reason} className="flex justify-between gap-4">
                     <span className={finalAmount === 0 ? 'text-zinc-500' : ''}>{reason}:</span>
                     <span className={`font-mono shrink-0 ${finalAmount === 0 ? 'text-zinc-500' : 'text-zinc-300'}`}>
                        {finalAmount < 0 ? '-' : ''}{formatCurrency(Math.abs(val(finalAmount, div)))}
                     </span>
                   </div>
                 );
              })}
            {rowDrivers.some(d => d.contractType === 'MCLOO') && (
              <div className="text-[9px] text-amber-400 mt-1 italic border-t border-zinc-700 pt-1 leading-tight">
                * Note: Tooltip displays 100% values. Column calculates 30% for MCLOO.
              </div>
            )}
            
          </div>
        )}
      </td>
      <td className="group/disp relative hover:z-[99999] px-1 py-0.5 text-right text-blue-400 !overflow-visible cursor-help" onMouseMove={handleTooltipMove}>
        {renderDisabledVal('dispatcher_pay', `${val(metrics.dispatcherPay, div) > 0 ? '+' : ''}${formatCurrency(val(metrics.dispatcherPay, div))}`, !!metrics.disabledPnlItems?.includes('dispatcher_pay'), rowDrivers, div)}
        <div className="fixed hidden group-hover/disp:block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[540px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
          <div className="font-bold text-white border-b border-zinc-600 pb-1 mb-1 text-[11px]">Dispatcher Pay Breakdown:</div>
          {metrics.dispBreakdown && Object.keys(metrics.dispBreakdown).length > 0 && (
            <div className="mb-2 w-full text-[10px]">
              <div className="grid grid-cols-[1fr_55px_55px_55px_60px] gap-x-2 border-b border-zinc-700 pb-1 mb-1 font-bold text-zinc-400">
                <div>Name</div>
                <div className="text-right">Gross</div>
                <div className="text-right">Margin</div>
                <div className="text-right">Fixed</div>
                <div className="text-right text-zinc-300">Total</div>
              </div>
              {Object.keys(metrics.dispBreakdown).sort((a, b) => (a.startsWith('ALL') === b.startsWith('ALL')) ? a.localeCompare(b) : (a.startsWith('ALL') ? -1 : 1)).map((name) => {
                const vals = metrics.dispBreakdown[name];
                const rowSubtotal = vals.gross + vals.margin + vals.fixed;
                return (
                  <div key={name} className="grid grid-cols-[1fr_55px_55px_55px_60px] gap-x-2 py-0.5 items-center">
                    <div className="text-sky-400 truncate" title={name}>{name}</div>
                    <div className="text-right font-mono text-zinc-300">
                      {vals.gross < 0 ? '-' : ''}{formatCurrency(Math.abs(val(vals.gross, div)))}
                    </div>
                    <div className="text-right font-mono text-zinc-300">
                      {vals.margin < 0 ? '-' : ''}{formatCurrency(Math.abs(val(vals.margin, div)))}
                    </div>
                    <div className="text-right font-mono text-zinc-300">
                      {vals.fixed < 0 ? '-' : ''}{formatCurrency(Math.abs(val(vals.fixed, div)))}
                    </div>
                    <div className="text-right font-mono font-bold text-zinc-200">
                      {rowSubtotal < 0 ? '-' : ''}{formatCurrency(Math.abs(val(rowSubtotal, div)))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div className="flex justify-between items-center gap-4 pt-1 border-t border-zinc-700 text-[10px]">
            <span className="font-bold">Shared Liability (Auto):</span>
            <span className="font-mono text-emerald-400">+{formatCurrency(Math.abs(val(metrics.dispSharedLiability, div)))}</span>
          </div>
          <div className="text-[9px] text-zinc-400 mt-1 italic leading-tight">* Note: Shared liability is included in this total but excluded from Total PnL as it is already in Revenue Collected.</div>
        </div>
      </td>
       <td className="px-1 py-0.5 text-right text-blue-400 !overflow-visible">
         {renderDisabledVal('recruiting', formatCurrency(val(metrics.totalRecruiting, div)), !!metrics.disabledPnlItems?.includes('recruiting'), rowDrivers, div)}
       </td>
       {show4w && <td className="px-1 py-0.5 text-right font-medium text-orange-300">{isStub ? '-' : formatCurrency(val(w4.sum, div))}</td>}
      {show4w && <td className="px-1 py-0.5 text-right font-bold text-orange-300">{isStub ? '-' : formatCurrency(val(w4.avg, div))}</td>}
      <td className={`px-1 py-0.5 text-right font-medium sticky z-10 hover:z-[100] bg-zinc-950 group-hover:bg-zinc-900 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.5)] w-[80px] min-w-[80px] max-w-[80px] right-0 ${val(metrics.netIncome, div) >= 0 ? 'text-emerald-500' : 'text-rose-500'} ${metrics.isAdjusted ? 'group/tpogpnl relative cursor-help !overflow-visible' : ''}`} onMouseMove={metrics.isAdjusted ? handleTooltipMove : undefined}>
        {formatCurrency(val(metrics.netIncome, div))}
        {metrics.isAdjusted && (
          <div className="fixed hidden group-hover/tpogpnl:block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[250px] pointer-events-none flex flex-col gap-2 whitespace-normal break-words dynamic-tooltip">
            {['Company', 'Team', 'Franchise'].includes(groupBy) && (
              <div className="font-bold text-rose-400 border-b border-zinc-600 pb-1">Warning: This {groupBy} has drivers with TPOG contracts.</div>
            )}
            <div className="font-bold text-emerald-400">TPOG PnL Explanation:</div>
            <div>The columns in this row display the full amount (100%) including the franchise share. However, the Total PnL represents the net PnL for TPOG, calculated as TPOG - TPOG(Franchise PnL)/2.</div>
            <div className="text-amber-400 italic">Note: Balance Change, Escrow Collected, and configured PO amounts are paid in full by the franchise and are not divided by 2.</div>
          </div>
        )}
      </td>
    </>
    );
  };
  
  const driverSwapMap = useMemo(() => {
      const map = new Map<string, any>();
      if (groupBy !== 'Driver') return map;
      const groupedByDateAndName = new Map<string, any[]>();
      drivers.forEach((r: any) => {
          if (r.name && r.companyId !== 'UNRECONCILED' && (r.effectiveDrivers || 0) > 0) {
              const key = `${r.name}|${r.payDate}`;
              if (!groupedByDateAndName.has(key)) groupedByDateAndName.set(key, []);
              groupedByDateAndName.get(key)!.push(r);
          }
      });
      groupedByDateAndName.forEach((recs, key) => {
          if (recs.length > 1) {
              const uniqueContracts = new Set(recs.map((r: any) => {
                  let ct = r.contractType;
                  if (ct === 'TPOG WITH FRANCHISE') ct = 'TPOG';
                  if (ct === 'OO WITH FRANCHISE') ct = 'OO';
                  return ct;
              }));
              const uniqueComps = new Set(recs.map((r: any) => r.companyId));
              if (!(uniqueContracts.size === 1 && uniqueComps.size === 1)) {
                  map.set(key, { oldRec: recs[0], newRec: recs[recs.length - 1] });
              }
          }
      });
      return map;
  }, [drivers, groupBy]);

  const poModalData = useMemo(() => {
      if (!isPoModalOpen) return { columns: [], rows: [] };
      let entities: any[] = [];
      if (groupBy === 'Company') entities = uniqueCompanies.map(c => ({ key: c, label: c }));
      else if (groupBy === 'Contract') entities = uniqueContracts.map(c => ({ key: c, label: c }));
      else if (groupBy === 'Franchise') entities = uniqueFranchises.map(c => ({ key: c, label: c }));
      else if (groupBy === 'Team') entities = uniqueTeams.map(c => ({ key: c, label: c }));
      else if (groupBy === 'Driver') entities = driverRows.map(d => ({ key: (d as any)._compositeKey || 'Unassigned', label: d.name || 'Unassigned' }));

      const allReasons = new Set<string>();
      const rowData: any[] = [];

      entities.forEach((entity: any) => {
          let drvs = groupedDrivers.get(entity.key || 'Unassigned') || [];
          const m = getAdjustedGroupMetrics(drvs);
          const div = Math.max(1, new Set(drvs.map((r: any) => r.payDate || r.week_ending)).size);
          const pb = m.poBreakdown || {};
          Object.keys(pb).forEach(k => allReasons.add(k));
          rowData.push({
              name: entity.label,
              breakdown: pb,
              div: div,
              total: val(m.pnlTotalPOCov !== undefined ? m.pnlTotalPOCov : m.totalPOCov, div)
          });
      });

      if (groupBy === 'Contract') {
          const tpogFranchiseDrivers = drivers.filter(d => d.contractType === 'TPOG' && !!d.franchiseId).map(d => ({
              ...d,
              companyPay: (d as any).franchise_revenue_collected || 0,
              fixed_costs: (d as any).franchise_fixed_costs_full || 0,
              poCoverage: (d as any).franchise_po ? -Math.abs(Number((d as any).franchise_po)) : 0,
              poAmount: (d as any).franchise_po || 0,
              po_breakdown: (d as any).franchise_po_breakdown,
              ...((d as any).franchise_fixed_breakdown || {}),
              isFranchiseStub: true
          }));
         if (tpogFranchiseDrivers.length > 0) {
                  const fMetrics = getAggregatedMetrics(tpogFranchiseDrivers);
                  const pb = fMetrics.poBreakdown || {};
                  const pbDivided: any = {};
                  Object.keys(pb).forEach(k => {
                      pbDivided[k] = Number(pb[k]);
                      allReasons.add(k);
                  });
                  const div = Math.max(1, new Set(tpogFranchiseDrivers.map((r: any) => r.payDate || r.week_ending)).size);
              rowData.push({
                  name: 'TPOG (Franchise PnL)',
                  breakdown: pbDivided,
                  div: div,
                  total: val(fMetrics.pnlTotalPOCov !== undefined ? fMetrics.pnlTotalPOCov : fMetrics.totalPOCov, div)
              });
          }
      }

      const validColumns = Array.from(allReasons).sort().filter((col: string) => {
          return rowData.some((r: any) => {
              const amount = r.breakdown[col] ? Number(r.breakdown[col]) : 0;
              return Math.abs(amount) > 0;
          });
      });

      return {
            columns: validColumns,
            rows: rowData
        };
    }, [isPoModalOpen, groupBy, uniqueCompanies, uniqueContracts, uniqueFranchises, uniqueTeams, driverRows, groupedDrivers, drivers, isAverageView]);

    const expModalData = useMemo(() => {
        if (!isExpModalOpen) return { columns: [], rows: [] };
       let entities: any[] = [];
        if (groupBy === 'Company') entities = uniqueCompanies.map(c => ({ key: c, label: c }));
        else if (groupBy === 'Contract') entities = uniqueContracts.map(c => ({ key: c, label: c }));
        else if (groupBy === 'Franchise') entities = uniqueFranchises.map(c => ({ key: c, label: c }));
        else if (groupBy === 'Team') entities = uniqueTeams.map(c => ({ key: c, label: c }));
        else if (groupBy === 'Driver') entities = driverRows.map(d => ({ key: (d as any)._compositeKey || 'Unassigned', label: d.name || 'Unassigned' }));

        const columns = ['insLiabAuto', 'insLiabGen', 'insCargo', 'insLeaseGapCoverage', 'insTrailerInterchange', 'insLago', 'insPhdPremium', 'insPhdTruck', 'insPhdTrailer', 'fcTruck', 'fcCpm', 'fcTrailer', 'fcPlates', 'fcTelematics', 'fcPhone', 'fcOffice', 'fcRent', 'fcBackupMc', 'fcBoReg', 'fcBoTech', 'fcFactoring', 'adjFixed'];
        const rowData: any[] = [];

        entities.forEach((entity: any) => {
            let drvs = groupedDrivers.get(entity.key || 'Unassigned') || [];
            const m = getAdjustedGroupMetrics(drvs);
            const div = Math.max(1, new Set(drvs.map((r: any) => r.payDate || r.week_ending)).size);
            
            const breakdown: any = {};
            columns.forEach(col => {
                breakdown[col] = m[col] || 0;
            });

            const totalExp = columns.reduce((sum, col) => sum + (m[col] || 0), 0);

            rowData.push({
                name: entity.label,
                breakdown,
                div,
                total: val(totalExp, div)
            });
        });

        if (groupBy === 'Contract') {
            const tpogFranchiseDrivers = drivers.filter(d => d.contractType === 'TPOG' && !!d.franchiseId).map(d => ({
                ...d,
                companyPay: (d as any).franchise_revenue_collected || 0,
                fixed_costs: (d as any).franchise_fixed_costs_full || 0,
                poCoverage: (d as any).franchise_po ? -Math.abs(Number((d as any).franchise_po)) : 0,
                poAmount: (d as any).franchise_po || 0,
                ...((d as any).franchise_fixed_breakdown || {}),
                isFranchiseStub: true
            }));
            if (tpogFranchiseDrivers.length > 0) {
                const fMetrics = getAggregatedMetrics(tpogFranchiseDrivers);
                const breakdown: any = {};
                columns.forEach(col => {
                    breakdown[col] = fMetrics[col] || 0;
                });
                const div = Math.max(1, new Set(tpogFranchiseDrivers.map((r: any) => r.payDate || r.week_ending)).size);
                const totalExp = columns.reduce((sum, col) => sum + (breakdown[col] || 0), 0);
                
                rowData.push({
                    name: 'TPOG (Franchise PnL)',
                    breakdown,
                    div,
                    total: val(totalExp, div)
                });
            }
        }

        return { columns, rows: rowData };
    }, [isExpModalOpen, groupBy, uniqueCompanies, uniqueContracts, uniqueFranchises, uniqueTeams, driverRows, groupedDrivers, isAverageView, drivers]);

   return (
    <div className="overflow-auto flex-1 h-full relative">
      {isPoModalOpen && (
         <div className="fixed inset-0 z-[999999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-8">
           <div className="bg-zinc-950 border border-zinc-800 rounded-lg w-full max-w-[95vw] flex flex-col shadow-2xl max-h-[90vh]">
             <div className="flex justify-between items-center p-4 border-b border-zinc-800">
                <h2 className="text-lg font-bold text-white">PO Breakdown ({groupBy})</h2>
                <button onClick={() => setIsPoModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors"><X size={20} /></button>
             </div>
             <div className="overflow-auto pb-4">
                <table className="w-full text-left text-xs whitespace-nowrap">
                   <thead className="bg-zinc-900 text-zinc-400 sticky top-0 z-50">
                      <tr>
                         <th className="pl-4 pr-2 py-2 border-b border-zinc-800 font-bold text-white sticky left-0 bg-zinc-900 z-[60] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.5)]">Segment</th>
                         {poModalData.columns.map((col: string) => <th key={col} className="px-2 py-2 border-b border-zinc-800 text-right">{col}</th>)}
                         <th className="pr-4 pl-2 py-2 border-b border-zinc-800 text-right font-bold text-sky-400">Total PO</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-zinc-800/50">
                      {poModalData.rows.map((r: any) => (
                         <tr key={r.name} className="group/modalrow hover:bg-zinc-800/30">
                            <td className="pl-4 pr-2 py-2 text-zinc-300 font-bold sticky left-0 bg-zinc-950 group-hover/modalrow:bg-zinc-900 z-40 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.5)]">{r.name}</td>
                            {poModalData.columns.map((col: string) => {
                                const amount = r.breakdown[col] ? Number(r.breakdown[col]) : 0;
                                const displayVal = val(amount, r.div);
                                return (
                                    <td key={col} className="px-2 py-2 text-right text-zinc-400 font-mono">
                                        {displayVal === 0 ? '-' : (displayVal < 0 ? '-' : '') + formatCurrency(Math.abs(displayVal))}
                                    </td>
                                );
                            })}
                            <td className="pr-4 pl-2 py-2 text-right font-mono font-bold text-sky-400">
                                {r.total === 0 ? '-' : (r.total < 0 ? '-' : '') + formatCurrency(Math.abs(r.total))}
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
           </div>
         </div>
      )}

      {isExpModalOpen && (
         <div className="fixed inset-0 z-[999999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-8">
           <div className="bg-zinc-950 border border-zinc-800 rounded-lg w-full max-w-[95vw] flex flex-col shadow-2xl max-h-[90vh]">
             <div className="flex justify-between items-center p-4 border-b border-zinc-800">
                <h2 className="text-lg font-bold text-white">Weekly Expenses Breakdown ({groupBy})</h2>
                <button onClick={() => setIsExpModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors"><X size={20} /></button>
             </div>
             <div className="overflow-auto pb-4">
                <table className="w-full text-left text-xs whitespace-nowrap">
                   <thead className="bg-zinc-900 text-zinc-400 sticky top-0 z-50">
                      <tr>
                         <th className="pl-4 pr-2 py-2 border-b border-zinc-800 font-bold text-white sticky left-0 bg-zinc-900 z-[60] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.5)]">Segment</th>
                         {expModalData.columns.map((col: string) => (
                             <th key={col} className="px-2 py-2 border-b border-zinc-800 text-right">
                                 {col.replace(/^(ins|fc|adj)/, '').replace(/([A-Z])/g, ' $1').trim()}
                             </th>
                         ))}
                         <th className="pr-4 pl-2 py-2 border-b border-zinc-800 text-right font-bold text-amber-400">Total Exp</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-zinc-800/50">
                      {expModalData.rows.map((r: any) => (
                         <tr key={r.name} className="group/modalrow hover:bg-zinc-800/30">
                            <td className="pl-4 pr-2 py-2 text-zinc-300 font-bold sticky left-0 bg-zinc-950 group-hover/modalrow:bg-zinc-900 z-40 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.5)]">{r.name}</td>
                            {expModalData.columns.map((col: string) => {
                                const amount = r.breakdown[col] ? Number(r.breakdown[col]) : 0;
                                const displayVal = val(amount, r.div);
                                return (
                                    <td key={col} className="px-2 py-2 text-right text-zinc-400 font-mono">
                                        {displayVal === 0 ? '-' : (displayVal < 0 ? '-' : '') + formatCurrency(Math.abs(displayVal))}
                                    </td>
                                );
                            })}
                            <td className="pr-4 pl-2 py-2 text-right font-mono font-bold text-amber-400">
                                {r.total === 0 ? '-' : (r.total < 0 ? '-' : '') + formatCurrency(Math.abs(r.total))}
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
           </div>
         </div>
      )}
      <table ref={tableRef} key={`${groupBy}-${isAverageView}-${isRevColExpanded}-${selectedDate}`} className="w-full min-h-full h-full text-left text-[11px] whitespace-nowrap [&_th:not(.text-right)]:w-[1%] [&_td:not(.text-right)]:w-[1%] [&_th.text-right]:w-[75px] [&_th.text-right]:min-w-[75px] [&_td.text-right]:w-[75px] [&_td.text-right]:min-w-[75px] [&_td.text-right]:overflow-hidden [&_td.text-right]:text-ellipsis">
        <thead className="bg-zinc-950 text-zinc-500 font-medium uppercase sticky top-0 z-[60] shadow-sm select-none">
         <tr>
            <th onClick={() => requestSort('name')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-[10px] sticky left-0 z-30 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)] cursor-pointer hover:text-white">Segment {sortConfig?.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
            {groupBy === 'Driver' && (
              <>
                <th onClick={() => requestSort('companyId')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-left text-zinc-400 text-[10px] cursor-pointer hover:text-white">Company {sortConfig?.key === 'companyId' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => requestSort('teamId')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-left text-zinc-400 text-[10px] cursor-pointer hover:text-white">Team {sortConfig?.key === 'teamId' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => requestSort('franchiseId')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-left text-zinc-400 text-[10px] cursor-pointer hover:text-white">Franchise {sortConfig?.key === 'franchiseId' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => requestSort('dispatcherId')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-left text-zinc-400 text-[10px] cursor-pointer hover:text-white">Dispatcher {sortConfig?.key === 'dispatcherId' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
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
           <th onClick={() => requestSort('gross')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-yellow-400 text-[10px] cursor-pointer hover:text-yellow-300 !overflow-visible">
              Drv. Gross {sortConfig?.key === 'gross' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
              <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[200px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                <div className="font-bold text-white mb-0.5">Gross Calculation:</div>
                <div>This represents the Driver Gross.</div>
              </div>
            </th>
            <th onClick={() => requestSort('margin')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-yellow-400 text-[10px] cursor-pointer hover:text-yellow-300 !overflow-visible">
              Margin {sortConfig?.key === 'margin' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
              <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[220px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                <div className="font-bold text-white mb-0.5">Margin:</div>
                <div>This displays the margin taken from the driver.</div>
              </div>
            </th>
            <th onClick={() => requestSort('total_miles')} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-yellow-400 text-[10px] cursor-pointer hover:text-yellow-300">
               <div className="flex items-center justify-end gap-1">
                 Total Miles {sortConfig?.key === 'total_miles' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                 <button onClick={(e) => { e.stopPropagation(); setIsMilesExpanded(!isMilesExpanded); }} className="p-0.5 hover:bg-zinc-800 rounded transition-colors ml-1">
                   <ChevronRight size={10} className={`transition-transform ${isMilesExpanded ? 'rotate-180' : ''}`} />
                 </button>
               </div>
               <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left mt-6 w-[220px] pointer-events-none transform -translate-x-[80%] flex flex-col gap-1.5 whitespace-normal break-words">
                 <div className="font-bold text-white mb-0.5">Total Miles:</div>
                 <div>Total number of driven miles.</div>
               </div>
            </th>
            {isMilesExpanded && (
               <>
               <th onClick={() => requestSort('loaded_miles')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-yellow-400 text-[10px] cursor-pointer hover:text-yellow-300 !overflow-visible">
                 <span className="opacity-70 group-hover:opacity-100 transition-opacity">Loaded Miles {sortConfig?.key === 'loaded_miles' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</span>
                 <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[220px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                   <div className="font-bold text-white mb-0.5">Loaded Miles:</div>
                   <div>Number of miles driven with a load.</div>
                 </div>
               </th>
               <th onClick={() => requestSort('dh')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-yellow-400 text-[10px] cursor-pointer hover:text-yellow-300 !overflow-visible">
                 <span className="opacity-70 group-hover:opacity-100 transition-opacity">DH {sortConfig?.key === 'dh' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</span>
                 <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[220px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                   <div className="font-bold text-white mb-0.5">DH:</div>
                   <div>Deadhead miles, i.e., number of miles driven without a load.</div>
                 </div>
               </th>
               </>
            )}
            <th onClick={() => requestSort('driverPay')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-purple-400 text-[10px] cursor-pointer hover:text-purple-300 !overflow-visible">
              Net Pay {sortConfig?.key === 'driverPay' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
              <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[220px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                <div className="font-bold text-white mb-0.5">Net Pay:</div>
                <div>Represents the actual net earnings paid out to the driver after all deductions and adjustments.</div>
              </div>
            </th>
            {groupBy !== 'Driver' && <th onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-purple-400 text-[10px] cursor-pointer hover:text-purple-300 !overflow-visible">
              Med. Net Pay
              <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[250px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                <div className="font-bold text-white mb-0.5">Median Net Pay:</div>
                <div>The middle value of net earnings across the group, providing a more accurate representation of typical driver pay by eliminating extreme highs or lows.</div>
              </div>
            </th>}
           <th onClick={() => requestSort('insuranceExp')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-purple-400 text-[10px] cursor-pointer hover:text-purple-300 !overflow-visible">
              Ins. Exp. {sortConfig?.key === 'insuranceExp' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
              <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[220px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                <div className="font-bold text-white mb-0.5">Insurance Expenses:</div>
                <div>Shows the company's expenses on insurances.</div>
               
              </div>
           </th>
                 <th onClick={() => requestSort('fuel')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-purple-400 text-[10px] cursor-pointer hover:text-purple-300 !overflow-visible">
               <div className="flex items-center justify-end gap-1">
                 Fuel {sortConfig?.key === 'fuel' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                 <button onClick={(e) => { e.stopPropagation(); setIsFuelExpanded(!isFuelExpanded); }} className="p-0.5 hover:bg-zinc-800 rounded transition-colors ml-1">
                   <ChevronRight size={10} className={`transition-transform ${isFuelExpanded ? 'rotate-180' : ''}`} />
                 </button>
               </div>
               <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[320px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                 <div className="font-bold text-white mb-0.5">Fuel Calculation:</div>
                 <ul className="list-disc pl-4 flex flex-col gap-1">
                   <li><span className="font-semibold text-emerald-400">Positive Values (Fuel Saved):</span> For MCLOO, OO, LOO, LPOO, MCOO contracts. <br/>Calculation: <span className="font-mono text-[9px]">(Retail Price - Discounted Price) * Quantity</span></li>
                   <li><span className="font-semibold text-rose-400">Negative Values (Fuel Spent):</span> For TPOG, POG, CPM &amp; Others. <br/>Calculation: <span className="font-mono text-[9px]">Discounted Price * Quantity</span></li>
                 </ul>
                 <div className="text-[9px] text-zinc-400 mt-1 italic border-t border-zinc-700 pt-1 leading-tight">
                   * Note: If spotter fuel is recorded and greater than 0, it takes precedence and is used instead of the standard fuel value.
                 </div>
               </div>
             </th>
             {isFuelExpanded && (
               <>
               <th onClick={() => requestSort('wosFuel')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-purple-400 text-[10px] cursor-pointer hover:text-purple-300 !overflow-visible">
                 <span className="opacity-70 group-hover:opacity-100 transition-opacity">SPOTTER FUEL {sortConfig?.key === 'wosFuel' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</span>
                 <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[250px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                   <div className="font-bold text-white mb-0.5">Spotter Fuel Difference:</div>
                   <div>Displays the difference in fuel amount resulting from the use of spotter fuel. A negative value indicates a loss compared to regular fuel savings, while a positive value indicates a gain.</div>
                 </div>
               </th>
               <th onClick={() => requestSort('fuel_retail_price')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-purple-400 text-[10px] cursor-pointer hover:text-purple-300 !overflow-visible">
                 <span className="opacity-70 group-hover:opacity-100 transition-opacity">Ret. Price {sortConfig?.key === 'fuel_retail_price' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</span>
                 <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[250px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                   <div className="font-bold text-white mb-0.5">Fuel Retail Price:</div>
                   <div>Displays the average retail price of fuel. This value represents a driver-level average and remains a constant average when viewed across aggregates.</div>
                 </div>
               </th>
               <th onClick={() => requestSort('spotter_retail_price')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-purple-400 text-[10px] cursor-pointer hover:text-purple-300 !overflow-visible">
                 <span className="opacity-70 group-hover:opacity-100 transition-opacity">Spotter Ret. Price {sortConfig?.key === 'spotter_retail_price' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</span>
                 <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[250px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                   <div className="font-bold text-white mb-0.5">Spotter Retail Price:</div>
                   <div>Displays the average retail price of fuel specifically for spotter card transactions.</div>
                 </div>
               </th>
               <th onClick={() => requestSort('fuel_discount_price')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-purple-400 text-[10px] cursor-pointer hover:text-purple-300 !overflow-visible">
                 <span className="opacity-70 group-hover:opacity-100 transition-opacity">Disc Price {sortConfig?.key === 'fuel_discount_price' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</span>
                 <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[250px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                   <div className="font-bold text-white mb-0.5">Discounted Price:</div>
                   <div>Displays the average price of fuel after all available discounts have been applied.</div>
                 </div>
               </th>
               <th onClick={() => requestSort('fuel_quantity')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-purple-400 text-[10px] cursor-pointer hover:text-purple-300 !overflow-visible">
                 <span className="opacity-70 group-hover:opacity-100 transition-opacity">Quantity {sortConfig?.key === 'fuel_quantity' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</span>
                 <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[250px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                   <div className="font-bold text-white mb-0.5">Fuel Quantity:</div>
                   <div>Displays the amount of fuel in gallons.</div>
                 </div>
               </th>
               </>
             )}
             <th onClick={() => requestSort('companyPay')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-blue-400 text-[10px] cursor-pointer hover:text-blue-300 !overflow-visible">
              <div className="flex items-center justify-end gap-1">
                Rev. Col. {sortConfig?.key === 'companyPay' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                <button onClick={(e) => { e.stopPropagation(); setIsRevColExpanded(!isRevColExpanded); }} className="p-0.5 hover:bg-zinc-800 rounded transition-colors ml-1">
                  <ChevronRight size={10} className={`transition-transform ${isRevColExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>
              <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[450px] pointer-events-none flex flex-col gap-2 whitespace-normal break-words dynamic-tooltip">
                <div className="font-bold text-white text-[11px] border-b border-zinc-600 pb-1">Revenue Collected Calculation:</div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-blue-300">Step 1: Revenue Base</span>
                  <div className="pl-2">Formulas are configured in Contract Rules within Structural Settings.</div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-blue-300">Step 2: Balance Change</span>
                  <div className="pl-2">Added to Revenue Base. Balance Change = -PO Deducts + PO Settle + Neg. Net Pay + Bal. Settle.</div>
                  <ul className="list-disc pl-6 text-[9px] flex flex-col gap-0.5">
                    <li><span className="font-semibold text-emerald-400">MCLOO:</span> Multiplied by 0.3.</li>
                    <li><span className="font-semibold text-rose-400">TPOG w/ Franchise:</span> Excluded for Company share, but included for Franchise share.</li>
                  </ul>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-blue-300">Step 3: Add Prorated Fixed Costs</span>
                  <div className="pl-2">Adds: ((Truck Float + Wkly + Occ Ins + ELD + IFTA + Maint + Liab + Trk PHD) * Eff Non-Teams) + ((Trl + Trl PHD) * Eff Trl).</div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-amber-400">Step 4: Zero-Mile Cap</span>
                  <div className="pl-2">If Total Miles = 0 and the sum of Steps 1-3 is &gt; 0, the total so far is reset to 0.</div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-blue-300">Step 5: Post-Cap Adjustments</span>
                  <ul className="list-disc pl-4 text-[9px] flex flex-col gap-0.5">
                    <li><span className="font-semibold text-zinc-300">Escrow:</span> If Net Pay &lt; 0, adds Escrow Deduct to cover debt (Skipped for MCLOO & TPOG w/ Franchise - Company Share).</li>
                    <li><span className="font-semibold text-zinc-300">Tolls:</span> Added 100% for OO, LOO, LPOO. Added 30% for MCLOO.</li>
                    <li><span className="font-semibold text-zinc-300">Cash Advance:</span> Added 100% (Excluded for MCLOO).</li>
                    <li><span className="font-semibold text-zinc-300">Revenue CPM:</span> Added Rev CPM * Total Miles.</li>
                    <li><span className="font-semibold text-zinc-300">Shared Ins:</span> Added Full Shared Liability.</li>
                  </ul>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-blue-300">Step 6: Fuel Adjustments</span>
                  <ul className="list-disc pl-4 text-[9px] flex flex-col gap-0.5">
                    <li><span className="font-semibold text-emerald-400">MCLOO, OO, LOO, LPOO, MCOO:</span> Adds Fuel Saved (Retail - Discount).</li>
                    <li><span className="font-semibold text-rose-400">Others:</span> Subtracts Fuel Spent.</li>
                  </ul>
                </div>
                <div className="mt-2 text-amber-400 font-semibold border-t border-zinc-600 pt-1 flex flex-col gap-0.5">
                  <span>TPOG (Franchise PnL):</span>
                  <span className="text-zinc-300 font-normal text-[9px]">The franchise share row fully applies Steps 1-3 (including all balances), is subjected to the Zero-Mile Cap, and then receives post-cap adjustments.</span>
                </div>
              </div>
            </th>
            {isRevColExpanded && (
              <>
                <th onClick={() => requestSort('pnlRevBase')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-zinc-500 text-[10px] cursor-pointer hover:text-zinc-400">Rev Base {sortConfig?.key === 'pnlRevBase' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => requestSort('pnlBalanceChange')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-zinc-500 text-[10px] cursor-pointer hover:text-zinc-400">Bal Change {sortConfig?.key === 'pnlBalanceChange' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => requestSort('pnlProrated')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-zinc-500 text-[10px] cursor-pointer hover:text-zinc-400">Rev Prorated {sortConfig?.key === 'pnlProrated' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => requestSort('pnlZeroMiDrop')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-zinc-500 text-[10px] cursor-pointer hover:text-zinc-400">0 Mi Cap {sortConfig?.key === 'pnlZeroMiDrop' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => requestSort('pnlEscrowAdj')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-zinc-500 text-[10px] cursor-pointer hover:text-zinc-400">Escrow Adj {sortConfig?.key === 'pnlEscrowAdj' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => requestSort('pnlTollsAdj')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-zinc-500 text-[10px] cursor-pointer hover:text-zinc-400">Tolls Adj {sortConfig?.key === 'pnlTollsAdj' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => requestSort('pnlCashAdv')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-zinc-500 text-[10px] cursor-pointer hover:text-zinc-400">Cash Adv {sortConfig?.key === 'pnlCashAdv' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => requestSort('pnlCpmAdj')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-zinc-500 text-[10px] cursor-pointer hover:text-zinc-400">CPM Adj {sortConfig?.key === 'pnlCpmAdj' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => requestSort('pnlFuelAdj')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-zinc-500 text-[10px] cursor-pointer hover:text-zinc-400">Fuel Adj {sortConfig?.key === 'pnlFuelAdj' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => requestSort('fullSharedLiability')} className="px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-zinc-500 text-[10px] cursor-pointer hover:text-zinc-400">Shared Ins {sortConfig?.key === 'fullSharedLiability' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
              </>
            )}
                 <th onClick={() => requestSort('fuelRebate')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-blue-400 text-[10px] cursor-pointer hover:text-blue-300 !overflow-visible">
                   Fuel Reb. {sortConfig?.key === 'fuelRebate' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                   <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[250px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                                         <div className="font-bold text-white mb-0.5">Fuel Rebate:</div>
                     <div>Company earnings from fuel, calculated by multiplying fuel quantity by the $ amount from Settings.</div>
                     <div className="text-zinc-400 font-mono bg-zinc-900/50 p-2 rounded border border-zinc-700">
                       Fuel Rebate = Fuel Quantity × $ Amount
                     </div>
                     
                   </div>
                 </th>
           <th onClick={() => requestSort('allocatedFixed')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-blue-400 text-[10px] cursor-pointer hover:text-blue-300 !overflow-visible">
              Wkly Exp. {sortConfig?.key === 'allocatedFixed' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
              <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[450px] pointer-events-none flex flex-col gap-2 whitespace-normal break-words dynamic-tooltip">
                <div className="font-bold text-white text-[11px] border-b border-zinc-600 pb-1">Fixed Cost Calculation &amp; Components:</div>
                <div className="text-zinc-300">Base Fixed Costs depend on the contract type:</div>
                <div className="flex flex-col gap-1 pl-2 border-l-2 border-zinc-600">
                  <div><span className="font-semibold text-blue-300">1. Owner Operator (OO):</span> Includes: Liability, Cargo, Telematics, Admin Fees, Factoring, and Trailer costs (if pulling company trailer).</div>
                  <div className="text-[9px] text-zinc-400 pl-4 italic">* Exception: OO does NOT pay for Truck Price, Truck Physical Damage, or Plates.</div>
                  <div className="mt-1"><span className="font-semibold text-blue-300">2. All Other Contracts (CPM, POG, TPOG, MCLOO, LOO, etc.):</span> Includes: Liability, Cargo, Physical Damage (Premium), Truck Physical Damage, Truck Price, Plates, Telematics, Admin Fees, Trailer costs, and Factoring.</div>
                  <div className="text-[9px] text-zinc-400 pl-4 italic">* Admin Fees = Phone/Internet + Office Supplies + Rent/Parking + Backup MC + Backoffice.</div>
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-white">Proration Rule:</span><br/>
                  <div className="pl-2 mt-0.5">Once the Base Fixed Cost is calculated, it is prorated based on the days worked:<br/><span className="text-emerald-400 font-mono">Result = Base Fixed Cost * (Days Worked / 7.0)</span></div>
                </div>
                
              </div>
            
            </th>
           <th onClick={() => requestSort('tolls')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-blue-400 text-[10px] cursor-pointer hover:text-blue-300 !overflow-visible">
                      Tolls {sortConfig?.key === 'tolls' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                      <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[300px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                        <div className="font-bold text-white mb-0.5">Tolls Calculation:</div>
                        <div className="text-zinc-300">Total toll amount incurred during the pay period.</div>
                        <div className="font-semibold text-white mt-1">Calculation Rules:</div>
                        <ul className="list-disc pl-4 flex flex-col gap-1">
                          <li><span className="font-semibold text-blue-300">Exception (MCLOO):</span> Tolls are completely skipped (Result = 0).</li>
                          <li><span className="font-semibold text-blue-300">All Other Contracts:</span> The full toll amount is applied.<br/><span className="text-emerald-400 font-mono text-[9px]">Result = Toll Amount</span></li>
                        </ul>
                       
                      </div>
                    </th>
                   <th onClick={() => requestSort('totalPOCov')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-blue-400 text-[10px] cursor-pointer hover:text-blue-300 !overflow-visible">
                   PO {sortConfig?.key === 'totalPOCov' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                   <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[320px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                     <div className="font-bold text-white text-[11px] border-b border-zinc-600 pb-1">Purchase Orders (Company Coverage)</div>
                     <div className="text-zinc-300">This column displays the calculated PO company coverage. Where a deduction exists, it is applied to determine the final amount covered by the company.</div>
                     <ul className="list-disc pl-4 flex flex-col gap-1 mt-1 text-zinc-300">
                       <li><span className="font-semibold text-white">MCLOO Drivers:</span> The company covers 30% of the calculated PO amount.</li>
                       <li><span className="font-semibold text-white">TPOG Contracts:</span> Displays the portion paid by the Franchise.</li>
                       <li><span className="font-semibold text-white">Exclusions:</span> Certain items are excluded from company coverage based on the contract type. You can manage these exclusions in <span className="text-emerald-400 font-semibold">Structural Settings &rarr; PO Rules</span>.</li>
                     </ul>
                   </div>
                 </th>
                 <th onClick={() => requestSort('dispatcherPay')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-blue-400 text-[10px] cursor-pointer hover:text-blue-300 !overflow-visible">
                   Disp. Pay {sortConfig?.key === 'dispatcherPay' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                   <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[250px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                     <div className="font-bold text-white mb-0.5">Dispatcher Pay:</div>
                     <div>Displays the amount paid to the dispatcher from gross and margin. For MCLOO contracts, it also includes the dispatcher's share of Liability Insurance (Auto).</div>
                     <div className="text-[9px] text-zinc-400 mt-1 italic">* Note: Shared liability is included in this column's total but excluded from the Total PnL calculation as it is already accounted for in Revenue Collected.</div>
                   </div>
                 </th>
                 <th onClick={() => requestSort('totalRecruiting')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-blue-400 text-[10px] cursor-pointer hover:text-blue-300 !overflow-visible">
                   Recruiting {sortConfig?.key === 'totalRecruiting' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[300px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                     <div className="font-bold text-white mb-0.5">Recruiting Cost Calculation:</div>
                     <div>Total recruiting cost from financial import for the specific contract type divided by total effective non-teams for that contract, then multiplied by the individual driver's effective non-teams count.</div>
                    
                   </div>
                 </th>
                 {show4w && <th onClick={() => requestSort('w4Sum')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-orange-300 text-[10px] cursor-pointer hover:text-orange-200 !overflow-visible">
                   PnL 4w {sortConfig?.key === 'w4Sum' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                   <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[250px] pointer-events-none flex flex-col gap-1 whitespace-normal break-words dynamic-tooltip">
                     <div className="font-bold text-white">4-Week PnL Sum:</div>
                     <div>The total combined PnL (Net Income) for the displayed row over the last 4 available weeks in the dataset.</div>
                   </div>
                 </th>}
                 {show4w && <th onClick={() => requestSort('w4Avg')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right text-orange-300 text-[10px] cursor-pointer hover:text-orange-200 !overflow-visible">
                   4w Avg {sortConfig?.key === 'w4Avg' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                   <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[250px] pointer-events-none flex flex-col gap-1 whitespace-normal break-words dynamic-tooltip">
                     <div className="font-bold text-white">4-Week PnL Average:</div>
                     <div>The average weekly PnL (Net Income) for the displayed row calculated over the last 4 available weeks.</div>
                   </div>
                 </th>}
                 <th onClick={() => requestSort('netIncome')} onMouseMove={handleTooltipMove} className="group px-1 py-1 border-b border-zinc-800 bg-zinc-950 text-right font-bold text-white text-[10px] sticky right-0 z-20 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.5)] w-[80px] min-w-[80px] max-w-[80px] cursor-pointer hover:text-emerald-400 !overflow-visible">
                   <div className="flex items-center justify-end gap-1">Total PnL {sortConfig?.key === 'netIncome' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</div>
                   <div className="fixed hidden group-hover:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[320px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                     <div className="font-bold text-white mb-0.5">Total PnL (Net Income) Calculation:</div>
                     <div className="text-emerald-400 font-mono bg-zinc-900/50 p-2 rounded border border-zinc-700">PnL = Revenue Collected + Fuel Rebate - Disp. Pay (Gross, Margin & Fixed) - Fixed - PO Co Cov - Recruiting - Tolls</div>
                     <div className="text-[9px] text-zinc-400 mt-1 italic">* Items included in this formula can be dynamically enabled or disabled per contract in the PNL Calculation settings.</div>
                   </div>
                 </th>
               </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50 font-mono">
          {groupBy === 'Company' && sortedData.map(dataItem => {
            const companyName = dataItem.original;
            if (isAverageView && companyName === 'Unassigned') return null;
            const compDrivers = dataItem.drvs;
            const metrics = dataItem.metrics;
            const w4 = dataItem.w4;
            const isExpanded = expandedFranchiseRows[companyName];
            return (
              <React.Fragment key={companyName}>
                <tr className="group hover:bg-zinc-800/20 transition-colors">
                  <td className="px-1 py-0.5 text-zinc-300 pl-4 font-sans sticky left-0 z-10 bg-zinc-950 group-hover:bg-zinc-900 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center gap-1.5">
                      <span>{companyName}</span>
                      {metrics.fMetrics && (
                        <button onClick={(e) => { e.stopPropagation(); setExpandedFranchiseRows(prev => ({ ...prev, [companyName]: !prev[companyName] })); }} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                          <ChevronRight size={12} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                      )}
                    </div>
                  </td>
                  {renderRowCells(metrics, w4, false, companyName, compDrivers)}
                </tr>
                {metrics.fMetrics && isExpanded && (
                   <tr className="group hover:bg-zinc-800/20 transition-colors">
                     <td className="px-1 py-0.5 font-bold text-amber-400 font-sans sticky left-0 z-10 group-hover:z-[100] !overflow-visible bg-zinc-950 group-hover:bg-zinc-900 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)] pl-4">
                       <div className="flex items-center gap-1.5 ml-4">
                         <span>└ TPOG (Franchise PnL)</span>
                       </div>
                     </td>
                     {renderRowCells(metrics.fMetrics, { sum: 0, avg: 0 }, false, 'TPOG (Franchise PnL)', metrics.franchiseStubs)}
                   </tr>
                )}
              </React.Fragment>
            );
          })}
         {groupBy === 'Contract' && sortedData.map(dataItem => {
            const contractName = dataItem.original;
            if (isAverageView && contractName === 'Unassigned') return null;
            const compDrivers = dataItem.drvs;
            let metrics = dataItem.metrics;
            let w4 = dataItem.w4;
            
            let fMetrics: any = null;
            let franchiseW4: any = null;
            let franchiseStubs: any[] = [];

            if (contractName === 'TPOG') {
               franchiseStubs = compDrivers.filter(d => !!d.franchiseId).map(d => ({
                   ...d,
                   companyPay: (d as any).franchise_revenue_collected || 0,
                   fixed_costs: (d as any).franchise_fixed_costs_full || 0,
                   poCoverage: (d as any).franchise_po ? -Math.abs(Number((d as any).franchise_po)) : 0,
                   poAmount: (d as any).franchise_po || 0,
                   po_breakdown: (d as any).franchise_po_breakdown,
                   ...((d as any).franchise_fixed_breakdown || {}),
                   isFranchiseStub: true
               }));
               
               if (franchiseStubs.length > 0) {
                       const rawMetrics = getAggregatedMetrics(franchiseStubs);
                       fMetrics = { ...rawMetrics };
                       fMetrics.netIncome = ((fMetrics.netIncome - (fMetrics.pnlBalanceChange || 0) - (fMetrics.pnlEscrowAdj || 0)) + (fMetrics.excludedPoTotal || 0)) / 2 + (fMetrics.pnlBalanceChange || 0) + (fMetrics.pnlEscrowAdj || 0);
                   
                   franchiseW4 = get4wMetrics('TPOG (Franchise PnL)');

                   w4 = { sum: w4.sum - franchiseW4.sum, avg: w4.avg - franchiseW4.avg };
               }
            }

            return (
              <React.Fragment key={contractName}>
                <tr className="group hover:bg-zinc-800/20 transition-colors">
                  <td className="px-1 py-0.5 font-bold text-emerald-400 font-sans sticky left-0 z-10 bg-zinc-950 group-hover:bg-zinc-900 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)]">{contractName}</td>
                  {renderRowCells(metrics, w4, false, contractName, compDrivers)}
                </tr>
                {fMetrics && (
                     <tr key="TPOG_FRANCHISE_ROW" className="group hover:bg-zinc-800/20 transition-colors">
                       <td className="px-1 py-0.5 font-bold text-amber-400 font-sans sticky left-0 z-10 group-hover:z-[100] !overflow-visible bg-zinc-950 group-hover:bg-zinc-900 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)] pl-4">
                         <div className="flex items-center gap-1.5">
                           <span>└ TPOG (Franchise PnL)</span>
                           <div className="group/fran_info flex items-center cursor-help">
                             <Info size={12} className="text-amber-500/70 hover:text-amber-400 transition-colors" />
                             <div className="fixed hidden group-hover/fran_info:block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] whitespace-normal w-56 pointer-events-none ml-4 mt-6 font-normal normal-case text-left">
                               This row displays the full amount (100%) of the TPOG contract with franchise, which includes the portion paid and earned by the franchise.
                             </div>
                           </div>
                         </div>
                       </td>
                       {renderRowCells(fMetrics, franchiseW4, false, 'TPOG (Franchise PnL)', franchiseStubs)}
                     </tr>
                )}
              </React.Fragment>
            );
          })}
         {groupBy === 'Franchise' && sortedData.map(dataItem => {
             const franchiseName = dataItem.original;
             if (isAverageView && franchiseName === 'Unassigned') return null;
             const displayLabel = franchiseName;
             const franDrivers = dataItem.drvs;
             const metrics = dataItem.metrics;
             const w4 = dataItem.w4;
             const isExpanded = expandedFranchiseRows[franchiseName];
             return (
              <React.Fragment key={franchiseName}>
                <tr className="group hover:bg-zinc-800/20 transition-colors">
                 <td className="px-1 py-0.5 text-zinc-300 pl-4 font-sans sticky left-0 z-10 bg-zinc-950 group-hover:bg-zinc-900 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center gap-1.5">
                      <span>{displayLabel}</span>
                      {metrics.fMetrics && (
                        <button onClick={(e) => { e.stopPropagation(); setExpandedFranchiseRows(prev => ({ ...prev, [franchiseName]: !prev[franchiseName] })); }} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                          <ChevronRight size={12} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                      )}
                    </div>
                 </td>
                  {renderRowCells(metrics, w4, false, displayLabel, franDrivers)}
                </tr>
                {metrics.fMetrics && isExpanded && (
                   <tr className="group hover:bg-zinc-800/20 transition-colors">
                     <td className="px-1 py-0.5 font-bold text-amber-400 font-sans sticky left-0 z-10 group-hover:z-[100] !overflow-visible bg-zinc-950 group-hover:bg-zinc-900 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)] pl-4">
                       <div className="flex items-center gap-1.5 ml-4">
                         <span>└ TPOG (Franchise PnL)</span>
                       </div>
                     </td>
                     {renderRowCells(metrics.fMetrics, { sum: 0, avg: 0 }, false, 'TPOG (Franchise PnL)', metrics.franchiseStubs)}
                   </tr>
                )}
              </React.Fragment>
             );
          })}
                     
         {groupBy === 'Team' && sortedData.map(dataItem => {
            const teamName = dataItem.original;
            if (isAverageView && teamName === 'Unassigned') return null;
            const displayLabel = teamName;
            const teamDrivers = dataItem.drvs;
            const metrics = dataItem.metrics;
            const w4 = dataItem.w4;
            const isExpanded = expandedFranchiseRows[teamName];
            return (
              <React.Fragment key={teamName}>
                <tr className="group hover:bg-zinc-800/20 transition-colors">
                  <td className="px-1 py-0.5 text-zinc-300 pl-4 font-sans sticky left-0 z-10 bg-zinc-950 group-hover:bg-zinc-900 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center gap-1.5">
                      <span>{displayLabel}</span>
                      {metrics.fMetrics && (
                        <button onClick={(e) => { e.stopPropagation(); setExpandedFranchiseRows(prev => ({ ...prev, [teamName]: !prev[teamName] })); }} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                          <ChevronRight size={12} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                      )}
                    </div>
                
                  </td>
                  {renderRowCells(metrics, w4, false, displayLabel, teamDrivers)}
                </tr>
                {metrics.fMetrics && isExpanded && (
                   <tr className="group hover:bg-zinc-800/20 transition-colors">
                     <td className="px-1 py-0.5 font-bold text-amber-400 font-sans sticky left-0 z-10 group-hover:z-[100] !overflow-visible bg-zinc-950 group-hover:bg-zinc-900 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)] pl-4">
                       <div className="flex items-center gap-1.5 ml-4">
                         <span>└ TPOG (Franchise PnL)</span>
                       </div>
                     </td>
                     {renderRowCells(metrics.fMetrics, { sum: 0, avg: 0 }, false, 'TPOG (Franchise PnL)', metrics.franchiseStubs)}
                   </tr>
                )}
              </React.Fragment>
            );
          })}
          {groupBy === 'Driver' && sortedData.map((dataItem, idx) => {
          const d = dataItem.original;
          const displayLabel = (!d.name || String(d.name).toLowerCase() === 'unassigned' || String(d.name).toLowerCase() === 'unknown driver') ? 'Unassigned' : d.name;
          const drvRecords = dataItem.drvs;
          const isMergedUnassigned = displayLabel === 'Unassigned';
          const metrics = dataItem.metrics;
          const w4 = dataItem.w4;
          
          let isSwap = false;
          let swapData: any = null;
          let isOldSwap = false;
          if (!isMergedUnassigned && selectedDate !== 'ALL') {
              for (const r of drvRecords) {
                  const data = driverSwapMap.get(`${d.name}|${r.payDate}`);
                  if (data) {
                      isSwap = true;
                      swapData = data;
                      if (d.companyId === data.oldRec.companyId && d.contractType === data.oldRec.contractType) {
                          isOldSwap = true;
                      }
                      break;
                  }
              }
          }

          const isStub = metrics.effCount === 0 && (Math.abs(metrics.totalPOCov) > 0 || Math.abs(metrics.totalPO) > 0 || Math.abs(metrics.tolls) > 0);
          const isUnreconciled = d.companyId === 'UNRECONCILED' || isStub;
          
          let unrecReason = "Company missing or unmapped";
          if (isStub) {
              const hasPo = Math.abs(metrics.totalPOCov) > 0 || Math.abs(metrics.totalPO) > 0;
              const hasTolls = Math.abs(metrics.tolls) > 0;
              if (hasPo && hasTolls) unrecReason = "Artificial stub for PO and tolls from previous contract or company";
              else if (hasPo) unrecReason = "Artificial stub for PO cost from previous contract or company";
              else if (hasTolls) unrecReason = "Artificial stub for tolls from previous contract or company";
          } else if (isUnreconciled) {
              unrecReason = "Company missing or unmapped";
          }

            return (
              <React.Fragment key={`${d.id}_${idx}`}>
                <tr className="group hover:bg-zinc-800/20 transition-colors">
                  <td className="px-1 py-0.5 text-zinc-300 pl-4 font-sans sticky left-0 z-10 group-hover:z-[100] bg-zinc-950 group-hover:bg-zinc-900 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center gap-1.5">
                      <span>{displayLabel}</span>
                     {isUnreconciled && !isMergedUnassigned ? (
                        <div className="group/unrec relative flex items-center cursor-help">
                          <AlertTriangle size={12} className="text-yellow-500" />
                          <div className="absolute hidden group-hover/unrec:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-2 rounded-lg shadow-2xl text-[10px] whitespace-nowrap pointer-events-none top-0 left-full ml-2">
                            <span className="font-bold text-yellow-500">{unrecReason}</span>
                          </div>
                        </div>
                      ) : isSwap && !isMergedUnassigned ? (
                        <div className="group/swap relative flex items-center cursor-help">
                          <ArrowRightLeft size={10} className="text-blue-400 cursor-help" />
                          <div className="absolute hidden group-hover/swap:block z-[9999] bg-zinc-800 border border-zinc-500 text-zinc-200 p-2 rounded-lg shadow-2xl text-[10px] whitespace-nowrap pointer-events-none top-0 left-full ml-2">
                            <span className="font-bold text-zinc-300">SWAP: </span>
                            <span className={isOldSwap ? 'text-blue-400 font-bold' : 'text-zinc-400'}>{swapData?.oldRec?.companyId || 'Unknown'} ({swapData?.oldRec?.contractType || 'Unknown'})</span>
                            <span className="text-zinc-500 mx-1">---&gt;</span>
                            <span className={!isOldSwap ? 'text-blue-400 font-bold' : 'text-zinc-400'}>{swapData?.newRec?.companyId || 'Unknown'} ({swapData?.newRec?.contractType || 'Unknown'})</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-1 py-0.5 text-zinc-500 text-left font-sans truncate max-w-[100px]">{isMergedUnassigned ? '-' : (d.companyId === 'UNRECONCILED' ? '-' : (d.companyId || '-'))}</td>
                  <td className="px-1 py-0.5 text-zinc-500 text-left font-sans truncate max-w-[80px]">{isMergedUnassigned ? '-' : (d.teamId || '-')}</td>
                  <td className="px-1 py-0.5 text-zinc-500 text-left font-sans truncate max-w-[120px]">{isMergedUnassigned ? '-' : (d.franchiseId || '-')}</td>
                 <td className="px-1 py-0.5 text-zinc-500 text-left font-sans truncate max-w-[140px]">{isMergedUnassigned ? '-' : (d.dispatcherId || '-')}</td>
                  <td className="px-1 py-0.5 text-zinc-500 text-left font-sans truncate max-w-[80px]">{isMergedUnassigned ? '-' : (d.contractType || '-')}</td>
                  {renderRowCells(metrics, w4, isStub, displayLabel, drvRecords)}
                </tr>
                {metrics.fMetrics && (
                   <tr className="group hover:bg-zinc-800/20 transition-colors">
                     <td className="px-1 py-0.5 font-bold text-amber-400 font-sans sticky left-0 z-10 group-hover:z-[100] !overflow-visible bg-zinc-950 group-hover:bg-zinc-900 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)] pl-4">
                       <div className="flex items-center gap-1.5 ml-4">
                         <span>└ TPOG (Franchise PnL)</span>
                       </div>
                     </td>
                     <td className="px-1 py-0.5 text-zinc-500 text-left font-sans truncate max-w-[100px]">-</td>
                     <td className="px-1 py-0.5 text-zinc-500 text-left font-sans truncate max-w-[80px]">-</td>
                     <td className="px-1 py-0.5 text-zinc-500 text-left font-sans truncate max-w-[80px]">-</td>
                     <td className="px-1 py-0.5 text-zinc-500 text-left font-sans truncate max-w-[80px]">-</td>
                     <td className="px-1 py-0.5 text-zinc-500 text-left font-sans truncate max-w-[80px]">-</td>
                     {renderRowCells(metrics.fMetrics, { sum: 0, avg: 0 }, false, 'TPOG (Franchise PnL)', metrics.franchiseStubs)}
                   </tr>
                )}
              </React.Fragment>
            );
          })}
                     
          <tr className="h-full">
            <td className="p-0 border-0 pointer-events-none sticky left-0 z-10 bg-zinc-950 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)]" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 25px, #27272a 25px, #27272a 26px)', backgroundPosition: 'top left' }}></td>
            {groupBy === 'Driver' && Array.from({ length: 5 }).map((_, i) => (
              <td key={`empty-driver-cols-${i}`} className="p-0 border-0 pointer-events-none bg-transparent" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 25px, #27272a 25px, #27272a 26px)', backgroundPosition: 'top left' }}></td>
            ))}
            {!isAverageView && Array.from({ length: 3 }).map((_, i) => (
          <td key={`empty-counts-${i}`} className="p-0 border-0 pointer-events-none bg-transparent" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 25px, #27272a 25px, #27272a 26px)', backgroundPosition: 'top left' }}></td>
        ))}
        {Array.from({ length: (isRevColExpanded ? (groupBy === 'Driver' ? 22 : 23) : (groupBy === 'Driver' ? 12 : 13)) + (isFuelExpanded ? 5 : 0) + 1 + (isMilesExpanded ? 2 : 0) }).map((_, i) => (
           <td key={`empty-metrics-${i}`} className="p-0 border-0 pointer-events-none bg-transparent" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 25px, #27272a 25px, #27272a 26px)', backgroundPosition: 'top left' }}></td>
         ))}
        {show4w && <td className="p-0 border-0 pointer-events-none bg-transparent" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 25px, #27272a 25px, #27272a 26px)', backgroundPosition: 'top left' }}></td>}
            {show4w && <td className="p-0 border-0 pointer-events-none bg-transparent" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 25px, #27272a 25px, #27272a 26px)', backgroundPosition: 'top left' }}></td>}
            <td className="p-0 border-0 pointer-events-none sticky right-0 z-10 bg-zinc-950 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.5)] w-[80px] min-w-[80px] max-w-[80px]" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 25px, #27272a 25px, #27272a 26px)', backgroundPosition: 'top left' }}></td>
          </tr>
        </tbody>
        <tfoot className="sticky bottom-0 z-40 hover:z-[70] bg-zinc-950 border-t-2 border-zinc-800 shadow-[0_-1px_0_rgba(255,255,255,0.1)]">
          <tr className="font-bold font-mono">
            {(() => {
                const div = Math.max(1, new Set((drivers || []).map((r: any) => r.payDate || r.week_ending)).size);
                const footerBalChange = dynamicTotals.pnlBalanceChange;
                const footerZeroMileDetails = (() => {
                  let count = 0;
                  let revBase = 0;
                  let balChange = 0;
                  let prorated = 0;
                  const uniqueNames = Array.from(new Set((drivers || []).map(d => d.name || 'Unknown')));
                  uniqueNames.forEach(dName => {
                    const drvRecords = drivers.filter(d => d.name === dName);
                    const m = calculateMetrics(drvRecords, true);
                    if (m.pnlZeroMiDrop < 0) {
                      count++;
                      drvRecords.forEach(d => {
                        const dMiles = Number((d as any).total_miles ?? d.milesDriven ?? 0);
                        if (dMiles === 0) {
                          const dm = calculateMetrics([d], true);
                          if (dm.pnlZeroMiDrop < 0) {
                            let effectiveBalChange = dm.pnlBalanceChange;
                            if (d.contractType === 'TPOG' && !!d.franchiseId && !(d as any).isFranchiseStub) {
                                effectiveBalChange = 0;
                            }
                            const originalRevBase = Math.abs(dm.pnlZeroMiDrop) - effectiveBalChange - dm.pnlProrated;
                            revBase += originalRevBase;
                            balChange += effectiveBalChange;
                            prorated += dm.pnlProrated;
                          }
                        }
                      });
                    }
                  });
                  return { count, revBase, balChange, prorated };
                })();
                return (
                  <>
                    <td className="px-1 py-1 text-white font-sans text-[10px] sticky left-0 z-50 bg-zinc-950 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.5)]">TOTAL</td>
                    {groupBy === 'Driver' && (
                      <>
                        <td className="px-1 py-1 bg-zinc-950"></td>
                        <td className="px-1 py-1 bg-zinc-950"></td>
                        <td className="px-1 py-1 bg-zinc-950"></td>
                        <td className="px-1 py-1 bg-zinc-950"></td>
                        <td className="px-1 py-1 bg-zinc-950"></td>
                      </>
                    )}
                    {!isAverageView && <td className="px-1 py-1 text-right text-white">{Number(dynamicTotals.effCount.toFixed(1))}</td>}
                    {!isAverageView && <td className="px-1 py-1 text-right text-white">{Number(dynamicTotals.effNonTeamsCount.toFixed(1))}</td>}
                    {!isAverageView && <td className="px-1 py-1 text-right text-white">{Number(dynamicTotals.effTrailersCount.toFixed(1))}</td>}
                    <td className="px-1 py-1 text-right text-yellow-400">{formatCurrency(val(dynamicTotals.gross, div))}</td>
                    <td className="px-1 py-1 text-right text-yellow-400 font-bold">{formatCurrency(val(dynamicTotals.margin, div))}</td>
                    <td className="px-1 py-1 text-right text-yellow-400 font-bold">{Math.round(val(dynamicTotals.total_miles, div)).toLocaleString()}</td>
                    {isMilesExpanded && (
                      <>
                         <td className="px-1 py-1 text-right text-yellow-400 opacity-70">{Math.round(val(dynamicTotals.loaded_miles, div)).toLocaleString()}</td>
                         <td className="px-1 py-1 text-right text-yellow-400 opacity-70">{Math.round(val(dynamicTotals.dh, div)).toLocaleString()}</td>
                      </>
                    )}
                    <td className="px-1 py-1 text-right text-purple-400 font-bold">{formatCurrency(val(dynamicTotals.driverPay, div))}</td>
                    {groupBy !== 'Driver' && (
                      <td className="px-1 py-1 text-right text-purple-400 font-bold">
                        {(() => {
                          const netPays = drivers.filter(d => !(d as any).isFranchiseStub && d.companyId !== 'UNRECONCILED' && (d.effectiveDrivers || 0) > 0).map(d => Number(d.netPay ?? 0)).sort((a, b) => a - b);
                          if (netPays.length === 0) return formatCurrency(0);
                          const mid = Math.floor(netPays.length / 2);
                          const med = netPays.length % 2 !== 0 ? netPays[mid] : (netPays[mid - 1] + netPays[mid]) / 2;
                          return formatCurrency(med);
                        })()}
                      </td>
                    )}
                    <td className="group/ins relative hover:z-[99999] px-1 py-1 text-right text-purple-400 !overflow-visible cursor-help" onMouseMove={handleTooltipMove}>
                      -{formatCurrency(Math.abs(val(dynamicTotals.insuranceExp, div)))}
                      <div className="fixed hidden group-hover/ins:block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[220px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                                                <div className="font-bold text-white border-b border-zinc-600 pb-1 mb-1 text-[11px]">Insurance Breakdown:</div>
                        <div className="flex justify-between gap-4"><span>Liability (Auto):</span><span className="font-mono">-{formatCurrency(Math.abs(val(dynamicTotals.insLiabAuto, div)))}</span></div>
                        {val(dynamicTotals.fullSharedLiability, div) !== 0 && <div className="flex justify-between gap-4"><span>Shared Liability (Auto):</span><span className="font-mono text-emerald-400">+{formatCurrency(Math.abs(val(dynamicTotals.fullSharedLiability, div)))}</span></div>}
                        <div className="flex justify-between gap-4"><span>Liability (Gen):</span><span className="font-mono">-{formatCurrency(Math.abs(val(dynamicTotals.insLiabGen, div)), 2)}</span></div>
                        <div className="flex justify-between gap-4"><span>Cargo:</span><span className="font-mono">-{formatCurrency(Math.abs(val(dynamicTotals.insCargo, div)))}</span></div>
                        <div className="flex justify-between gap-4"><span>Lease Gap Coverage:</span><span className="font-mono">-{formatCurrency(Math.abs(val(dynamicTotals.insLeaseGapCoverage, div)))}</span></div>
                        <div className="flex justify-between gap-4"><span>Trailer Interchange:</span><span className="font-mono">-{formatCurrency(Math.abs(val(dynamicTotals.insTrailerInterchange, div)))}</span></div>
                        <div className="flex justify-between gap-4"><span>PhD Premium:</span><span className="font-mono">-{formatCurrency(Math.abs(val(dynamicTotals.insPhdPremium, div)))}</span></div>
                        <div className="flex justify-between gap-4"><span>PhD Truck:</span><span className="font-mono">-{formatCurrency(Math.abs(val(dynamicTotals.insPhdTruck, div)))}</span></div>
                        <div className="flex justify-between gap-4"><span>PhD Trailer:</span><span className="font-mono">-{formatCurrency(Math.abs(val(dynamicTotals.insPhdTrailer, div)))}</span></div>
                     </div>
                </td>
                 <td className="px-1 py-1 text-right text-purple-400">{val(dynamicTotals.fuel, div) < 0 ? `-${formatCurrency(Math.abs(val(dynamicTotals.fuel, div)))}` : formatCurrency(val(dynamicTotals.fuel, div))}</td>
                 {isFuelExpanded && (
                   <>
                     <td className="px-1 py-1 text-right text-purple-400 opacity-70">{val(dynamicTotals.wosFuel, div) < 0 ? `-${formatCurrency(Math.abs(val(dynamicTotals.wosFuel, div)))}` : formatCurrency(val(dynamicTotals.wosFuel, div))}</td>
                     <td className="px-1 py-1 text-right text-purple-400 opacity-70">{formatCurrency(dynamicTotals.fuel_retail_price_count > 0 ? dynamicTotals.fuel_retail_price / dynamicTotals.fuel_retail_price_count : 0, 2)}</td>
                     <td className="px-1 py-1 text-right text-purple-400 opacity-70">{formatCurrency(dynamicTotals.spotter_retail_price_count > 0 ? dynamicTotals.spotter_retail_price / dynamicTotals.spotter_retail_price_count : 0, 2)}</td>
                     <td className="px-1 py-1 text-right text-purple-400 opacity-70">{formatCurrency(dynamicTotals.fuel_discount_price_count > 0 ? dynamicTotals.fuel_discount_price / dynamicTotals.fuel_discount_price_count : 0, 2)}</td>
                     <td className="px-1 py-1 text-right text-purple-400 opacity-70">{Math.round(val(dynamicTotals.fuel_quantity, div))}</td>
                   </>
                 )}
                <td className="px-1 py-1 text-right text-blue-400 !overflow-visible">
                      {renderDisabledVal('revenue_collected', formatCurrency(val(dynamicTotals.pnlCompanyPay !== undefined ? dynamicTotals.pnlCompanyPay : dynamicTotals.companyPay, div)), !!dynamicTotals.disabledPnlItems?.includes('revenue_collected'), drivers, div, true)}
                    </td>
                {isRevColExpanded && (
                      <>
                        <td className="group/revbase relative hover:z-[99999] px-1 py-1 text-right text-zinc-400 font-mono cursor-help !overflow-visible" onMouseMove={handleTooltipMove}>
                          {val(dynamicTotals.pnlRevBase, div) < 0 ? '-' : '+'}{formatCurrency(Math.abs(val(dynamicTotals.pnlRevBase, div)))}
                          <div className="fixed hidden group-hover/revbase:block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] normal-case text-left w-[280px] pointer-events-none dynamic-tooltip">
                            <div className="font-bold text-white border-b border-zinc-600 pb-1 mb-1 text-[11px]">Revenue Base Calculation:</div>
                            
                            {drivers.length > 0 ? (
                                Array.from(new Set(drivers.map(d => d.contractType || 'Unknown'))).map(cType => {
                                                                        const subset = drivers.filter(d => (d.contractType || 'Unknown') === cType);
                                    const ruleDate = subset.find(d => d.payDate)?.payDate || (selectedDate !== 'ALL' && selectedDate !== 'LATEST' ? selectedDate : null);
                                    const rule = getContractRuleForDate(cType, ruleDate);
                                    const gPerc = rule && rule.mc_gross_percent !== undefined ? Number(rule.mc_gross_percent) * 100 : null;
                                    const mPerc = rule && rule.mc_margin_percent !== undefined ? Number(rule.mc_margin_percent) * 100 : null;
                                    const dGrossPerc = rule && rule.dispatcher_gross_percent !== undefined ? Number(rule.dispatcher_gross_percent) * 100 : 0;
                                    const dMargPerc = rule && (rule as any).dispatcher_margin_percent !== undefined ? Number((rule as any).dispatcher_margin_percent) * 100 : 0;
                                    const calcType = rule?.calculation_type || 'STANDARD';
                                    const cGross = subset.reduce((sum, d) => sum + (d.grossRevenue || 0), 0);
                                    const cMargin = subset.reduce((sum, d) => sum + (d.marginAmount || 0), 0);

                                    const cTotal = subset.reduce((sum, d) => {
                                        const rBase = Number((d as any).revenue_base ?? (d as any).revenueBase ?? 0);
                                        const revWithoutFuelVal = Number((d as any).rev_without_fuel ?? (d as any).revWithoutFuel ?? 0);
                                        const dMiles = Number((d as any).total_miles ?? d.milesDriven ?? 0);
                                        const mileCapFactor = (revWithoutFuelVal > 0 && dMiles === 0) ? 0 : 1;
                                        let companyTakeMulti = 1;
                                        if ((d.contractType === 'TPOG WITH FRANCHISE' || (d.contractType === 'TPOG' && d.franchiseId)) && configContracts && configContracts.length > 0) {
                                            const tpogFranRule = getContractRuleForDate('TPOG WITH FRANCHISE', d.payDate || ruleDate);
                                            if (tpogFranRule && tpogFranRule.calculation_type === 'TPOG_FRANCHISE') {
                                                companyTakeMulti = tpogFranRule.mc_gross_percent !== undefined ? Number(tpogFranRule.mc_gross_percent) : 1;
                                            }
                                        }
                                        if (d.name === 'Garland Jermaine Norris') {
                                            return sum + ((d.grossRevenue || 0) * 0.2) * mileCapFactor * companyTakeMulti;
                                        }
                                        return sum + rBase * mileCapFactor * companyTakeMulti;
                                    }, 0);
                                    
                                    if (cTotal === 0 && cGross === 0 && cMargin === 0) return null;
                                    
                                  let formulaStr = '';
                                  if (cType === 'CPM' && subset.some(d => d.name === 'Garland Jermaine Norris')) {
                                      formulaStr = `Gross * 20% (Garland Exception)`;
                                  } else if (calcType === 'MCLOO_STYLE') {
                                      formulaStr = `Gross * ${gPerc ?? 8}% + Margin * ${mPerc ?? 0}%`;
                                  } else if (calcType === 'OO_NONF') {
                                      formulaStr = `Gross * ${gPerc ?? 7.5}% + Margin * ${mPerc ?? 70}%`;
                                  } else if (calcType === 'OO_FRANCHISE') {
                                      formulaStr = `Gross * ${gPerc ?? 4}% + Margin * ${mPerc ?? 35}%`;
                                  } else if (calcType === 'TPOG_NONF' || calcType === 'POG_STYLE' || calcType === 'TPOG_FRANCHISE') {
                                      formulaStr = `Gross * (1 - Drv%) + Margin * ${mPerc ?? 70}%`;
                                  } else if (calcType === 'NEW_FORMULA') {
                                      formulaStr = `(${gPerc ?? 0}% * (Gross + Margin - (Margin * ${mPerc ?? 0}%))) - (Drv% * Gross) - (Gross * ${dGrossPerc ?? 0}% + Margin * ${dMargPerc ?? 0}%)`;
                                  } else if (calcType === 'NEW_CPM_FORMULA') {
                                      formulaStr = `Gross - Gross Pay`;
                                  } else if (calcType === 'CPM_STYLE') {
                                      formulaStr = `(Gross + Margin * ${mPerc ?? 70}%) - Net Pay`;
                                  } else if (gPerc !== null && mPerc !== null) {
                                        if (gPerc > 0 && mPerc > 0) formulaStr = `(Gross * ${gPerc}%) + (Margin * ${mPerc}%)`;
                                        else if (gPerc > 0) formulaStr = `Gross * ${gPerc}%`;
                                        else if (mPerc > 0) formulaStr = `Margin * ${mPerc}%`;
                                        else formulaStr = `Custom / Flat`;
                                    } else {
                                        formulaStr = `Standard Base Formula`;
                                    }

                                    return (
                                        <div key={cType} className="mb-1.5 last:mb-0">
                                            <div className="text-emerald-400 font-bold text-[9px]">{cType}</div>
                                            <div className="flex flex-col gap-0.5 text-[9px] pl-1 border-l border-zinc-700 ml-1">
                                                <div className="text-zinc-300">Gross: {formatCurrency(val(cGross, div))} | Margin: {formatCurrency(val(cMargin, div))}</div>
                                                <div className="text-zinc-400 italic text-[8px]">Formula: {formulaStr}</div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : null}
                            <div className="flex justify-between border-t border-zinc-600 mt-1 pt-1 font-bold text-white">
                                <span>Total Rev Base:</span><span className="font-mono">{formatCurrency(val(dynamicTotals.pnlRevBase, div))}</span>
                            </div>
                          </div>
                        </td>
                        <td className="group/balchange relative hover:z-[99999] px-1 py-1 text-right text-zinc-400 font-mono cursor-help !overflow-visible" onMouseMove={handleTooltipMove}>
                          {val(footerBalChange, div) < 0 ? '-' : '+'}{formatCurrency(Math.abs(val(footerBalChange, div)))}
                          <div className="fixed hidden group-hover/balchange:block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] normal-case text-left w-[280px] pointer-events-none flex flex-col gap-1 dynamic-tooltip whitespace-normal break-words">
                            <div className="font-bold text-sky-400 border-b border-zinc-600 pb-1 mb-1">Balance Change Breakdown:</div>
                            <div className="flex justify-between"><span>PO Deductions:</span><span className="font-mono">{formatCurrency(val(dynamicTotals.pnlPoDeductions, div))}</span></div>
                            <div className="flex justify-between"><span>PO Settle:</span><span className="font-mono">{formatCurrency(val(dynamicTotals.pnlPoSettle, div))}</span></div>
                            <div className="flex justify-between"><span>Net Pay:</span><span className="font-mono">{val(dynamicTotals.pnlNegNetPay, div) < 0 ? '-' : '+'}{formatCurrency(Math.abs(val(dynamicTotals.pnlNegNetPay, div)))}</span></div>
                            <div className="text-[9px] text-zinc-400 italic mt-0.5 leading-tight">* Shows only negative net pay.</div>
                            <div className="flex justify-between mt-0.5"><span>Balance Settle:</span><span className="font-mono">{formatCurrency(val(dynamicTotals.pnlBalanceSettle, div))}</span></div>
                            <div className="flex justify-between border-t border-zinc-600 mt-1 pt-1 font-bold text-white">
                              <span>Total:</span>
                              <span className="font-mono">{formatCurrency(val(footerBalChange, div))}</span>
                            </div>
                            {Math.abs(dynamicTotals.pnlExcludedBalanceChange || 0) > 0.01 && (
                              <div className="flex justify-between mt-1 font-bold text-sky-300">
                                <span>Calculated Amount (TPOG Non-Franchise):</span>
                                <span className="font-mono">{formatCurrency(val(footerBalChange - dynamicTotals.pnlExcludedBalanceChange, div))}</span>
                              </div>
                            )}
                            <div className="flex flex-col gap-1 mt-1 border-t border-zinc-700 pt-1">
                                {(drivers || []).some(d => d.contractType === 'MCLOO') && (
                                    <span className="text-[9px] text-amber-400 italic leading-tight">
                                        * Note: MCLOO contract amounts are multiplied by 0.3.
                                    </span>
                                )}
                                {(drivers || []).some(d => d.contractType === 'TPOG' && !!d.franchiseId) && (
                                    <span className="text-[9px] text-amber-400 italic leading-tight">
                                        * Note: TPOG contracts with a franchise are excluded for the company but included for the franchise.
                                    </span>
                                )}
                            </div>
                          </div>
                        </td>
                        <td className="group/prorated relative hover:z-[99999] px-1 py-1 text-right text-zinc-400 font-mono cursor-help !overflow-visible" onMouseMove={handleTooltipMove}>
                          {val(dynamicTotals.pnlProrated, div) < 0 ? '-' : '+'}{formatCurrency(Math.abs(val(dynamicTotals.pnlProrated, div)))}
                          <div className="fixed hidden group-hover/prorated:block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] normal-case text-left w-[220px] pointer-events-none flex flex-col gap-1 dynamic-tooltip">
                            <div className="font-bold text-emerald-300 border-b border-zinc-600 pb-1 mb-1">Prorated Fixed Costs:</div>
                            <div className="flex justify-between"><span>Truck Float:</span><span className="font-mono">{formatCurrency(val(dynamicTotals.pnlTruckFloat, div))}</span></div>
                            <div className="flex justify-between"><span>Truck Weekly:</span><span className="font-mono">{formatCurrency(val(dynamicTotals.pnlTruckWkly, div))}</span></div>
                            <div className="flex justify-between"><span>Occ Ins:</span><span className="font-mono">{formatCurrency(val(dynamicTotals.pnlOccIns, div))}</span></div>
                            <div className="flex justify-between"><span>ELD:</span><span className="font-mono">{formatCurrency(val(dynamicTotals.pnlEld, div))}</span></div>
                            <div className="flex justify-between"><span>IFTA:</span><span className="font-mono">{formatCurrency(val(dynamicTotals.pnlIfta, div))}</span></div>
                            <div className="flex justify-between"><span>Maint Support:</span><span className="font-mono">{formatCurrency(val(dynamicTotals.pnlMaintSupport, div))}</span></div>
                            <div className="flex justify-between"><span>Liability:</span><span className="font-mono">{formatCurrency(val(dynamicTotals.pnlLiability, div))}</span></div>
                            <div className="flex justify-between"><span>Truck PHD:</span><span className="font-mono">{formatCurrency(val(dynamicTotals.pnlTruckPhd, div))}</span></div>
                            <div className="flex justify-between"><span>Trailer:</span><span className="font-mono">{formatCurrency(val(dynamicTotals.pnlTrailer, div))}</span></div>
                            <div className="flex justify-between"><span>Trailer PHD:</span><span className="font-mono">{formatCurrency(val(dynamicTotals.pnlTrailerPhd, div))}</span></div>
                          </div>
                        </td>
                        <td className="group/footerzeromicap relative hover:z-[99999] px-1 py-1 text-right text-zinc-400 font-mono cursor-help !overflow-visible" onMouseMove={handleTooltipMove}>
                          {val(dynamicTotals.pnlZeroMiDrop, div) < 0 ? '-' : (val(dynamicTotals.pnlZeroMiDrop, div) > 0 ? '+' : '')}{formatCurrency(Math.abs(val(dynamicTotals.pnlZeroMiDrop, div)))}
                          {footerZeroMileDetails.count > 0 && (
                            <div className="fixed hidden group-hover/footerzeromicap:block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] normal-case text-left w-[260px] pointer-events-none flex flex-col gap-1 dynamic-tooltip">
                              <div className="font-bold text-amber-400 border-b border-zinc-600 pb-1 mb-1">Total 0 Mi Cap Drop:</div>
                              {groupBy !== 'Driver' && <div className="flex justify-between"><span>Drivers with 0 miles:</span><span className="font-mono font-bold text-white">{footerZeroMileDetails.count}</span></div>}
                              <div className="flex justify-between mt-1"><span>Revenue Base:</span><span className="font-mono">-{formatCurrency(val(footerZeroMileDetails.revBase, div))}</span></div>
                              <div className="flex justify-between"><span>Balance Change:</span><span className="font-mono">{val(footerZeroMileDetails.balChange, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(footerZeroMileDetails.balChange, div)))}</span></div>
                              <div className="flex justify-between"><span>Balance Change:</span><span className="font-mono">{val(footerZeroMileDetails.balChange, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(footerZeroMileDetails.balChange, div)))}</span></div>
                              <div className="flex justify-between"><span>Revenue Prorated:</span><span className="font-mono">-{formatCurrency(val(footerZeroMileDetails.prorated, div))}</span></div>
                              <div className="flex justify-between border-t border-zinc-600 mt-1 pt-1 font-bold text-white">
                                <span>Total Drop:</span>
                                <span className="font-mono">-{formatCurrency(Math.abs(val(dynamicTotals.pnlZeroMiDrop, div)))}</span>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-1 py-1 text-right text-zinc-400 font-mono">{val(dynamicTotals.pnlEscrowAdj, div) < 0 ? '-' : '+'}{formatCurrency(Math.abs(val(dynamicTotals.pnlEscrowAdj, div)))}</td>
                        <td className="px-1 py-1 text-right text-zinc-400 font-mono">+{formatCurrency(Math.abs(val(dynamicTotals.pnlTollsAdj, div)))}</td>
                        <td className="px-1 py-1 text-right text-zinc-400 font-mono">{val(dynamicTotals.pnlCashAdv, div) < 0 ? '-' : '+'}{formatCurrency(Math.abs(val(dynamicTotals.pnlCashAdv, div)))}</td>
                        <td className="px-1 py-1 text-right text-zinc-400 font-mono">{val(dynamicTotals.pnlCpmAdj, div) < 0 ? '-' : '+'}{formatCurrency(Math.abs(val(dynamicTotals.pnlCpmAdj, div)))}</td>
                        <td className="px-1 py-1 text-right text-zinc-400 font-mono">{val(dynamicTotals.pnlFuelAdj, div) < 0 ? '-' : '+'}{formatCurrency(Math.abs(val(dynamicTotals.pnlFuelAdj, div)))}</td>
                        <td className="group/footersharedins relative hover:z-[99999] px-1 py-1 text-right text-zinc-400 font-mono cursor-help !overflow-visible" onMouseMove={handleTooltipMove}>
                          +{formatCurrency(Math.abs(val(dynamicTotals.fullSharedLiability, div)))}
                          {dynamicTotals.sharedInsBreakdown && Object.keys(dynamicTotals.sharedInsBreakdown).length > 0 && (
                            <div className="fixed hidden group-hover/footersharedins:block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] normal-case text-left w-max min-w-[200px] pointer-events-none flex flex-col gap-1 dynamic-tooltip">
                              <div className="font-bold text-sky-400 border-b border-zinc-600 pb-1 mb-1">Total Shared Ins Breakdown:</div>
                              {Object.entries(dynamicTotals.sharedInsBreakdown).map(([comp, amount]: any) => (
                                 <div key={comp} className="flex justify-between gap-4">
                                    <span>{comp}:</span>
                                    <span className="font-mono text-zinc-300">+{formatCurrency(Math.abs(val(Number(amount), div)))}</span>
                                 </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </>
                    )}
                     <td className="px-1 py-1 text-right text-blue-400 !overflow-visible">
                       {renderDisabledVal('fuel_rebate', formatCurrency(val(dynamicTotals.pnlFuelRebate !== undefined ? dynamicTotals.pnlFuelRebate : dynamicTotals.fuelRebate, div)), !!dynamicTotals.disabledPnlItems?.includes('fuel_rebate'), drivers, div, true)}
                     </td>
                    <td onClick={() => setIsExpModalOpen(true)} className="group/fixed relative hover:z-[99999] px-1 py-1 text-right text-blue-400 cursor-pointer !overflow-visible hover:bg-zinc-800/50 transition-colors" onMouseMove={handleTooltipMove}>
                      {renderDisabledVal('weekly_expenses', `-${formatCurrency(Math.abs(val(dynamicTotals.pnlAllocatedFixed !== undefined ? dynamicTotals.pnlAllocatedFixed : dynamicTotals.allocatedFixed, div)))}`, !!dynamicTotals.disabledPnlItems?.includes('weekly_expenses'), drivers, div, true)}
                      <div className="fixed hidden group-hover/fixed:block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[260px] pointer-events-none flex flex-col gap-1 whitespace-normal break-words dynamic-tooltip">
                        <div className="font-bold text-white border-b border-zinc-600 pb-1 mb-1 text-[11px]">Weekly Expenses Breakdown:</div>
                        {val(dynamicTotals.insLiabAuto, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Liability (Auto):</span><span className="font-mono">{val(dynamicTotals.insLiabAuto, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.insLiabAuto, div)))}</span></div>}
                        {val(dynamicTotals.insLiabGen, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Liability (Gen):</span><span className="font-mono">{val(dynamicTotals.insLiabGen, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.insLiabGen, div)))}</span></div>}
                        {val(dynamicTotals.insCargo, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Cargo:</span><span className="font-mono">{val(dynamicTotals.insCargo, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.insCargo, div)))}</span></div>}
                        {val(dynamicTotals.insLeaseGapCoverage, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Lease Gap Coverage:</span><span className="font-mono">{val(dynamicTotals.insLeaseGapCoverage, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.insLeaseGapCoverage, div)))}</span></div>}
                        {val(dynamicTotals.insTrailerInterchange, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Trailer Interchange:</span><span className="font-mono">{val(dynamicTotals.insTrailerInterchange, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.insTrailerInterchange, div)))}</span></div>}
                        {val(dynamicTotals.insLago, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>LAGO:</span><span className="font-mono">{val(dynamicTotals.insLago, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.insLago, div)))}</span></div>}
                        {val(dynamicTotals.insPhdPremium, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>PhD Premium:</span><span className="font-mono">{val(dynamicTotals.insPhdPremium, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.insPhdPremium, div)))}</span></div>}
                        {val(dynamicTotals.insPhdTruck, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>PhD Truck:</span><span className="font-mono">{val(dynamicTotals.insPhdTruck, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.insPhdTruck, div)))}</span></div>}
                        {val(dynamicTotals.insPhdTrailer, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>PhD Trailer:</span><span className="font-mono">{val(dynamicTotals.insPhdTrailer, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.insPhdTrailer, div)))}</span></div>}
                        {val(dynamicTotals.fcTruck, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Truck Price:</span><span className="font-mono">{val(dynamicTotals.fcTruck, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.fcTruck, div)))}</span></div>}
                        <div className="flex justify-between gap-2 text-zinc-400"><span>CPM:</span><span className="font-mono">{val(dynamicTotals.fcCpm, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.fcCpm, div)))}</span></div>
                        {val(dynamicTotals.fcTrailer, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Trailer Price:</span><span className="font-mono">{val(dynamicTotals.fcTrailer, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.fcTrailer, div)))}</span></div>}
                        {val(dynamicTotals.fcPlates, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Plates:</span><span className="font-mono">{val(dynamicTotals.fcPlates, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.fcPlates, div)))}</span></div>}
                        {val(dynamicTotals.fcTelematics, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Telematics:</span><span className="font-mono">{val(dynamicTotals.fcTelematics, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.fcTelematics, div)))}</span></div>}
                        {val(dynamicTotals.fcPhone, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Phone & Internet:</span><span className="font-mono">{val(dynamicTotals.fcPhone, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.fcPhone, div)))}</span></div>}
                        {val(dynamicTotals.fcOffice, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Office Supplies:</span><span className="font-mono">{val(dynamicTotals.fcOffice, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.fcOffice, div)))}</span></div>}
                        {val(dynamicTotals.fcRent, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Rent & Parking:</span><span className="font-mono">{val(dynamicTotals.fcRent, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.fcRent, div)))}</span></div>}
                        {val(dynamicTotals.fcBackupMc, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Backup MC:</span><span className="font-mono">{val(dynamicTotals.fcBackupMc, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.fcBackupMc, div)))}</span></div>}
                        {val(dynamicTotals.fcBoReg, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Back Office Pay:</span><span className="font-mono">{val(dynamicTotals.fcBoReg, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.fcBoReg, div)))}</span></div>}
                        {val(dynamicTotals.fcBoTech, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Tech Pay:</span><span className="font-mono">{val(dynamicTotals.fcBoTech, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.fcBoTech, div)))}</span></div>}
                        {val(dynamicTotals.fcFactoring, div) !== 0 && <div className="flex justify-between gap-2 text-zinc-400"><span>Factoring:</span><span className="font-mono">{val(dynamicTotals.fcFactoring, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.fcFactoring, div)))}</span></div>}
                        {val(dynamicTotals.adjFixed, div) !== 0 && <div className="flex justify-between gap-2"><span>Adjustments:</span><span className="font-mono">{val(dynamicTotals.adjFixed, div) < 0 ? '+' : '-'}{formatCurrency(Math.abs(val(dynamicTotals.adjFixed, div)))}</span></div>}
                        <div className="flex justify-between gap-2 border-t border-zinc-600 pt-1 font-bold text-white"><span>Total Wkly Exp:</span><span className="font-mono">-{formatCurrency(Math.abs(val(dynamicTotals.pnlAllocatedFixed !== undefined ? dynamicTotals.pnlAllocatedFixed : dynamicTotals.allocatedFixed, div)))}</span></div>
                      </div>
                    </td>
                    <td className="px-1 py-1 text-right text-blue-400 !overflow-visible">
                      {renderDisabledVal('tolls', val(dynamicTotals.pnlTolls !== undefined ? dynamicTotals.pnlTolls : dynamicTotals.tolls, div) === 0 ? formatCurrency(0) : `-${formatCurrency(Math.abs(val(dynamicTotals.pnlTolls !== undefined ? dynamicTotals.pnlTolls : dynamicTotals.tolls, div)))}`, !!dynamicTotals.disabledPnlItems?.includes('tolls'), drivers, div, true)}
                    </td>
                    <td onClick={() => setIsPoModalOpen(true)} className="group/footerpobreakdown relative hover:z-[99999] px-1 py-1 text-right text-blue-400 cursor-pointer !overflow-visible hover:bg-zinc-800/50 transition-colors" onMouseMove={handleTooltipMove}>
                      {renderDisabledVal('po', formatCurrency(val(dynamicTotals.pnlTotalPOCov !== undefined ? dynamicTotals.pnlTotalPOCov : dynamicTotals.totalPOCov, div)), !!dynamicTotals.disabledPnlItems?.includes('po'), drivers, div, true)}
                      {dynamicTotals.poBreakdown && Object.keys(dynamicTotals.poBreakdown).length > 0 && (
                        <div className="fixed hidden group-hover/footerpobreakdown:block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-auto min-w-[200px] pointer-events-none flex flex-col gap-1 dynamic-tooltip">
                          <div className="font-bold text-sky-400 border-b border-zinc-600 pb-1 mb-1">Total PO Breakdown:</div>
                          {Object.entries(dynamicTotals.poBreakdown).map(([reason, amount]: any) => {
                             const finalAmount = Number(amount);
                             return (
                               <div key={reason} className="flex justify-between gap-4">
                                 <span className={finalAmount === 0 ? 'text-zinc-500' : ''}>{reason}:</span>
                                 <span className={`font-mono ${finalAmount === 0 ? 'text-zinc-500' : 'text-zinc-300'}`}>
                                    {finalAmount < 0 ? '-' : ''}{formatCurrency(Math.abs(val(finalAmount, div)))}
                                 </span>
                               </div>
                             );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="group/disp relative hover:z-[99999] px-1 py-1 text-right text-blue-400 font-medium !overflow-visible cursor-help" onMouseMove={handleTooltipMove}>
                      {renderDisabledVal('dispatcher_pay', `${val(dynamicTotals.dispatcherPay, div) > 0 ? '+' : ''}${formatCurrency(val(dynamicTotals.dispatcherPay, div))}`, !!dynamicTotals.disabledPnlItems?.includes('dispatcher_pay'), drivers, div, true)}
                      <div className="fixed hidden group-hover/disp:block z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] font-normal normal-case text-left w-[540px] pointer-events-none flex flex-col gap-1.5 whitespace-normal break-words dynamic-tooltip">
                        <div className="font-bold text-white border-b border-zinc-600 pb-1 mb-1 text-[11px]">Dispatcher Pay Breakdown:</div>
                        {dynamicTotals.dispBreakdown && Object.keys(dynamicTotals.dispBreakdown).length > 0 && (
                          <div className="mb-2 w-full text-[10px]">
                            <div className="grid grid-cols-[1fr_55px_55px_55px_60px] gap-x-2 border-b border-zinc-700 pb-1 mb-1 font-bold text-zinc-400">
                              <div>Name</div>
                              <div className="text-right">Gross</div>
                              <div className="text-right">Margin</div>
                              <div className="text-right">Fixed</div>
                              <div className="text-right text-zinc-300">Total</div>
                            </div>
                            {Object.keys(dynamicTotals.dispBreakdown).sort((a, b) => (a.startsWith('ALL') === b.startsWith('ALL')) ? a.localeCompare(b) : (a.startsWith('ALL') ? -1 : 1)).map((name) => {
                              const vals = dynamicTotals.dispBreakdown[name];
                              const rowSubtotal = vals.gross + vals.margin + vals.fixed;
                              return (
                                <div key={name} className="grid grid-cols-[1fr_55px_55px_55px_60px] gap-x-2 py-0.5 items-center">
                                  <div className="text-sky-400 truncate" title={name}>{name}</div>
                                  <div className="text-right font-mono text-zinc-300">
                                    {vals.gross < 0 ? '-' : ''}{formatCurrency(Math.abs(val(vals.gross, div)))}
                                  </div>
                                  <div className="text-right font-mono text-zinc-300">
                                    {vals.margin < 0 ? '-' : ''}{formatCurrency(Math.abs(val(vals.margin, div)))}
                                  </div>
                                  <div className="text-right font-mono text-zinc-300">
                                    {vals.fixed < 0 ? '-' : ''}{formatCurrency(Math.abs(val(vals.fixed, div)))}
                                  </div>
                                  <div className="text-right font-mono font-bold text-zinc-200">
                                    {rowSubtotal < 0 ? '-' : ''}{formatCurrency(Math.abs(val(rowSubtotal, div)))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                        <div className="flex justify-between items-center gap-4 pt-1 border-t border-zinc-700 text-[10px]">
                          <span className="font-bold">Shared Liability (Auto):</span>
                          <span className="font-mono text-emerald-400">+{formatCurrency(Math.abs(val(dynamicTotals.dispSharedLiability, div)))}</span>
                        </div>
                        <div className="text-[9px] text-zinc-400 mt-1 italic leading-tight">* Note: Shared liability is included in this total but excluded from Total PnL as it is already in Revenue Collected.</div>
                      </div>
                    </td>
                     <td className="px-1 py-1 text-right text-blue-400 !overflow-visible">
                       {renderDisabledVal('recruiting', formatCurrency(val(dynamicTotals.pnlTotalRecruiting !== undefined ? dynamicTotals.pnlTotalRecruiting : dynamicTotals.totalRecruiting, div)), !!dynamicTotals.disabledPnlItems?.includes('recruiting'), drivers, div, true)}
                     </td>
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


let globalEnrichedCache: any[] | null = null;
let globalEnrichedCacheKey: string | null = null;
let globalChartCache: any[] | null = null;
let globalChartCacheKey: string | null = null;

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

    return Array.from(new Set(rawOptions)).filter(opt => Boolean(opt) && opt !== 'Unassigned' && opt !== 'UNRECONCILED').sort() as string[];
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
  const [pnlConfigs, setPnlConfigs] = useState<any[]>([]);
  const [poRules, setPoRules] = useState<any[]>([]);
  

  useEffect(() => {
    if (!isModalOpen) {
        const loadPnlConfigs = async () => {
            try {
                const { fetchPnlConfigs } = await import('../lib/supabase');
                if (fetchPnlConfigs) {
                    const data = await fetchPnlConfigs();
                    setPnlConfigs(data || []);
                }
            } catch(e) { console.error("Error loading PNL configs:", e); }
        };
        const loadPoRules = async () => {
            try {
                const { data } = await supabase.from('po_rules').select('*');
                if (data) setPoRules(data);
            } catch(e) { console.error("Error loading PO rules:", e); }
        };
        loadPnlConfigs();
        loadPoRules();
    }
  }, [isModalOpen]);

  const getPnlConfigItems = useCallback((contractType: string) => {
      let effContract = contractType || '';
      const upper = effContract.toUpperCase();
      if (upper.includes('TPOG')) effContract = 'TPOG';
      else if (upper === 'OO' || upper.includes('OO WITH FRANCHISE')) effContract = 'OO';

      const config = pnlConfigs.find(c => c.contract_type === effContract);
           return config ? config.toggled_items : ['revenue_collected', 'fuel_rebate', 'dispatcher_pay', 'weekly_expenses', 'po', 'tolls', 'recruiting'];
  }, [pnlConfigs]);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [groupBy, setGroupBy] = useState<'Contract' | 'Company' | 'Franchise' | 'Team' | 'Driver'>('Contract');
  const [isAverageView, setIsAverageView] = useState(false);
  
  
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [chartWeeksLimit, setChartWeeksLimit] = useState<number | 'ALL'>('ALL');
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);
  const [isEntitiesOpen, setIsEntitiesOpen] = useState(false);
  const [isColsOpenMain, setIsColsOpenMain] = useState(false);
  const [isColsOpenExpanded, setIsColsOpenExpanded] = useState(false);
  const [entitiesSearchQuery, setEntitiesSearchQuery] = useState('');
  const metricsRef = useRef<HTMLDivElement>(null);
  const entitiesRef = useRef<HTMLDivElement>(null);
  const colsMainRef = useRef<HTMLDivElement>(null);
  const colsExpandedRef = useRef<HTMLDivElement>(null);
  const [tableFilters, setTableFilters] = useState<FilterRule[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<string[]>(['COMPANY']);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['netIncome']);
  const [tableColumns, setTableColumns] = useState<any[]>([
    { id: 'Segment', label: 'Segment', pinned: 'left', hidden: false },
    { id: 'Company', label: 'Company', pinned: null, hidden: false },
    { id: 'Team', label: 'Team', pinned: null, hidden: false },
    { id: 'Franchise', label: 'Franchise', pinned: null, hidden: false },
    { id: 'Dispatcher', label: 'Dispatcher', pinned: null, hidden: false },
    { id: 'Contract', label: 'Contract', pinned: null, hidden: false },
    { id: 'Eff Drv', label: 'Eff Drv', pinned: null, hidden: false },
    { id: 'Eff NonTm', label: 'Eff NonTm', pinned: null, hidden: false },
    { id: 'Eff Trls', label: 'Eff Trls', pinned: null, hidden: false },
    { id: 'Gross', label: 'Drv. Gross', pinned: null, hidden: false },
    { id: 'Margin', label: 'Margin', pinned: null, hidden: false },
    { id: 'Total Miles', label: 'Total Miles', pinned: null, hidden: false },
    { id: 'Loaded Miles', label: 'Loaded Miles', pinned: null, hidden: false },
    { id: 'DH', label: 'DH', pinned: null, hidden: false },
    { id: 'Net Pay', label: 'Net Pay', pinned: null, hidden: false },
    { id: 'Med. Net Pay', label: 'Med. Net Pay', pinned: null, hidden: false },
    { id: 'Ins. Exp.', label: 'Ins. Exp.', pinned: null, hidden: false },
{ id: 'Fuel', label: 'Fuel', pinned: null, hidden: false },
    { id: 'SPOTTER FUEL', label: 'SPOTTER FUEL', pinned: null, hidden: false },
    { id: 'Ret. Price', label: 'Ret. Price', pinned: null, hidden: false },
    { id: 'Spotter Ret. Price', label: 'Spotter Ret. Price', pinned: null, hidden: false },
    { id: 'Disc Price', label: 'Disc Price', pinned: null, hidden: false },
    { id: 'Quantity', label: 'Quantity', pinned: null, hidden: false },
    { id: 'Rev. Col.', label: 'Rev. Col.', pinned: null, hidden: false },
    { id: 'Rev Base', label: 'Rev Base', pinned: null, hidden: false },
    { id: 'Bal Change', label: 'Bal Change', pinned: null, hidden: false },
    { id: 'Rev Prorated', label: 'Rev Prorated', pinned: null, hidden: false },
    { id: '0 Mi Cap', label: '0 Mi Cap', pinned: null, hidden: false },
    { id: 'Escrow Adj', label: 'Escrow Adj', pinned: null, hidden: false },
    { id: 'Tolls Adj', label: 'Tolls Adj', pinned: null, hidden: false },
    { id: 'Cash Adv', label: 'Cash Adv', pinned: null, hidden: false },
    { id: 'CPM Adj', label: 'CPM Adj', pinned: null, hidden: false },
    { id: 'Fuel Adj', label: 'Fuel Adj', pinned: null, hidden: false },
    { id: 'Shared Ins', label: 'Shared Ins', pinned: null, hidden: false },
    { id: 'Fuel Reb.', label: 'Fuel Reb.', pinned: null, hidden: false },
    { id: 'Wkly Exp.', label: 'Wkly Exp.', pinned: null, hidden: false },
    { id: 'Tolls', label: 'Tolls', pinned: null, hidden: false },
    { id: 'PO', label: 'PO', pinned: null, hidden: false },
    { id: 'Disp. Pay', label: 'Disp. Pay', pinned: null, hidden: false },
    { id: 'Recruiting', label: 'Recruiting', pinned: null, hidden: false },
    { id: 'PnL 4w', label: 'PnL 4w', pinned: null, hidden: false },
    { id: '4w Avg', label: '4w Avg', pinned: null, hidden: false },
    { id: 'Total PnL', label: 'Total PnL', pinned: 'right', hidden: false }
  ]);

  const uniqueDates = useMemo(() => {
    const dates = Array.from(new Set(drivers.map(d => d.payDate).filter(Boolean)));
    const sortedDates = dates.sort((a, b) => {
       const dateA = new Date(a as string).getTime();
       const dateB = new Date(b as string).getTime();
       return dateB - dateA;
    });
    return sortedDates.length > 6 ? sortedDates.slice(0, -6) : sortedDates;
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
    const currTime = (currentDate ? new Date(currentDate).getTime() : Date.now()) - (3 * 24 * 60 * 60 * 1000);
    
    const evaluateExp = (matchedExp: ExpenseItem) => {
          if (matchedExp.threshold_date) {
              const threshTime = new Date(matchedExp.threshold_date).getTime();
              if (currTime < threshTime) {
                  return matchedExp.amount_before !== undefined ? matchedExp.amount_before : (matchedExp.amount || 0);
              } else {
                  return matchedExp.amount_after !== undefined ? matchedExp.amount_after : (matchedExp.amount || 0);
              }
          }
          const isComplex = ['Liability Insurance (Global)', 'Cargo Insurance', 'Trailer Interchange', 'PD Premium', 'Physical Damage'].includes(matchedExp.name);
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

  const cacheKey = useMemo(() => {
    const configHash = JSON.stringify(configContracts || []);
    const expHash = JSON.stringify(fixedExpenses || []);
    const fcHash = JSON.stringify(fixedCostsData || []);
    const driversHash = (allDrivers || drivers)?.reduce((sum, d) => sum + (d.poCoverage || 0) + (d.poAmount || 0) + (d.tolls || 0) + (d.companyPay || 0) + (d.netPay || 0), 0) || 0;
    return `${(allDrivers || drivers)?.length}-${driversHash}-${finImportData?.length}-${simulationConfig?.globalFixedExpenseAdjustment}-${configHash}-${expHash}-${fcHash}`;
  }, [allDrivers, drivers, fixedExpenses, finImportData, fixedCostsData, simulationConfig, configContracts]);

  const enrichedDrivers = useMemo(() => {
    if (globalEnrichedCache && globalEnrichedCacheKey === cacheKey) {
        return globalEnrichedCache;
    }

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
          truckBaseFixed = getWeeklyAmountFromExp(truckBaseFixed, truckExp);
              baseTruckPrice = -Math.abs(truckBaseFixed);
      }
      
      let trailerBaseFixed = getActiveAmount('Trailer', date).amount;
      let trailerExp = getActiveAmount('Trailer', date).exp;
      let baseTrailerPrice = 0;
      if (trailerBaseFixed === 0 && !trailerExp) {
          baseTrailerPrice = -Math.abs(Number(avgTrailerPrice) || 0);
      } else {
          trailerBaseFixed = getWeeklyAmountFromExp(trailerBaseFixed, trailerExp);
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
                 v_c6 = -getWeeklyAmountFromExp(r_c6, exp_c6);
             } else if (rawFinImportData) {
             v_c6 = globalEffNonTeams > 0 ? -(rawFinImportData.liability_insurance || 0) / globalEffNonTeams : 0;
         }

         let r_c7 = getActiveAmount('Cargo Insurance', date).amount;
         let exp_c7 = getActiveAmount('Cargo Insurance', date).exp;
         let v_c7 = 0;
         if (r_c7 !== 0 || exp_c7) {
                 v_c7 = -getWeeklyAmountFromExp(r_c7, exp_c7);
             } else if (rawFinImportData) {
             v_c7 = globalEffNonTeams > 0 ? -(rawFinImportData.cargo_insurance || 0) / globalEffNonTeams : 0;
         }

         let r_c8 = getActiveAmount('Physical Damage', date).amount;
         let exp_c8 = getActiveAmount('Physical Damage', date).exp;
         let v_c8 = 0;
         if (r_c8 !== 0 || exp_c8) {
                 v_c8 = -getWeeklyAmountFromExp(r_c8, exp_c8);
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
                 val_c25 = -getWeeklyAmountFromExp(telematicsAmt, telematicsExp);
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
                     let perUnit = getWeeklyAmountFromExp(amt, exp);
                     val_c16_c21 -= perUnit;
                 } else if (globalMatch) {
                 const gItem = globalMatch[item.key] || 0;
                 const compItem = gItem * (cTotalNonTeams / globalEffNonTeams);
                 val_c16_c21 -= cTotalNonTeams > 0 ? (compItem / cTotalNonTeams) : 0;
             }
         });

         const customExpenseNames = Array.from(new Set(fixedExpenses.map(e => e.name).filter(n => !['Liability Insurance', 'Liability Insurance (Global)', 'Cargo Insurance', 'Trailer Interchange', 'LAGO', 'PD Premium', 'Physical Damage', 'Plates', 'Factoring'].includes(n))));
         let customFixedPerNT = 0;
         customExpenseNames.forEach(expName => {
             const { amount, exp } = getActiveAmount(expName, date, compId, uniqueCompsInWeek.length);
                 let weeklyAmount = getWeeklyAmountFromExp(amount, exp);
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

      

      weekDrivers.forEach(d => {
        let effContractType = d.contractType || '';
        const isFranchise = d.contractType === 'TPOG' && !!d.franchiseId;
        
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
              let contractCosts = fc.contract_specific_costs;
              if (typeof contractCosts === 'string') {
                  try { contractCosts = JSON.parse(contractCosts); } catch(e) {}
              }
              if (contractCosts && Array.isArray(contractCosts)) {
                  const contractRule = contractCosts.find((el: any) =>
                      (el.contract_type || '').replace(/\s+/g, '').toLowerCase() === effContractType.replace(/\s+/g, '').toLowerCase() &&
                      (el.expense_name || '').toLowerCase().includes(expenseNameKeyword.toLowerCase()) &&
                      (!(el.company_id) || el.company_id === 'ALL' || el.company_id === '' || (el.company_id || '').replace(/\s+/g, '').toLowerCase() === (d.companyId || '').replace(/\s+/g, '').toLowerCase())
                  );
                  if (contractRule && contractRule.amount !== undefined && contractRule.amount !== null) {
                      amount = Math.abs(Number(contractRule.amount));
                  }
              }
              if (amount === null) {
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
              let contractCosts = fc.contract_specific_costs;
              if (typeof contractCosts === 'string') {
                  try { contractCosts = JSON.parse(contractCosts); } catch(e) {}
              }
              if (contractCosts && Array.isArray(contractCosts)) {
                  const contractRule = contractCosts.find((el: any) =>
                      (el.contract_type || '').replace(/\s+/g, '').toLowerCase() === effContractType.replace(/\s+/g, '').toLowerCase() &&
                      (el.expense_name || '').toLowerCase().includes(expenseNameKeyword.toLowerCase()) &&
                      (!(el.company_id) || el.company_id === 'ALL' || el.company_id === '' || (el.company_id || '').replace(/\s+/g, '').toLowerCase() === (d.companyId || '').replace(/\s+/g, '').toLowerCase())
                  );
                  if (contractRule && contractRule.amount !== undefined && contractRule.amount !== null) {
                      cpm = Math.abs(Number(contractRule.amount));
                  }
              }
              if (cpm === null) {
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
                          cpm = Math.abs(Number(compRule.amount));
                      }
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
        let sharedInsLiabActive = getActiveAmount('Shared Insurance Liability', date, d.companyId, uniqueCompsInWeek.length);
        let sharedInsLiab = sharedInsLiabActive.amount !== 0 || sharedInsLiabActive.exp ? Math.abs(getWeeklyAmountFromExp(sharedInsLiabActive.amount, sharedInsLiabActive.exp)) : getFcRule('Shared Insurance Liability', 'shared_insurance_liability_custom', 'shared_insurance_liability');
        
        let liabilityGeneral = getFcRule('Liability Insurance (General)', '', '');
        let liabilityGlobal = getFcRule('Liability Insurance (Global)', '', '');
        let liability = liabilityAuto + liabilityGlobal;
        let sharedLiabilityValue = sharedInsLiab;
        
        let cargoActive = getActiveAmount('Cargo Insurance', date, d.companyId, uniqueCompsInWeek.length);
        let cargo = cargoActive.amount !== 0 || cargoActive.exp ? Math.abs(getWeeklyAmountFromExp(cargoActive.amount, cargoActive.exp)) : getFcRule('Cargo Insurance', 'cargo_insurance_custom', 'cargo_insurance');

        let leaseGapActive = getActiveAmount('Lease Gap Coverage', date, d.companyId, uniqueCompsInWeek.length);
        let leaseGap = leaseGapActive.amount !== 0 || leaseGapActive.exp ? Math.abs(getWeeklyAmountFromExp(leaseGapActive.amount, leaseGapActive.exp)) : getFcRule('Lease Gap Coverage', 'lease_gap_coverage_custom', 'lease_gap_coverage');
        
        let tiActive = getActiveAmount('Trailer Interchange', date, d.companyId, uniqueCompsInWeek.length);
        let trailerInterchange = tiActive.amount !== 0 || tiActive.exp ? Math.abs(getWeeklyAmountFromExp(tiActive.amount, tiActive.exp)) : getFcRule('Trailer Interchange', 'trailer_interchange_custom', 'trailer_interchange');
        
        let lagoActive = getActiveAmount('LAGO', date, d.companyId, uniqueCompsInWeek.length);
        let lago = 0;
        if (lagoActive.amount !== 0 || lagoActive.exp) {
            let weekly = Math.abs(getWeeklyAmountFromExp(lagoActive.amount, lagoActive.exp));
            lago = globalEffNonTeams > 0 ? weekly / globalEffNonTeams : 0;
        } else {
            lago = getFcRule('LAGO', 'lago_custom', 'lago');
        }
        
        let phdPremiumActive = getActiveAmount('PD Premium', date, d.companyId, uniqueCompsInWeek.length);
        let phd_premium = phdPremiumActive.amount !== 0 || phdPremiumActive.exp ? Math.abs(getWeeklyAmountFromExp(phdPremiumActive.amount, phdPremiumActive.exp)) : getFcRule('PD Premium', 'pd_premium_custom', 'pd_premium');
        
        let phdActive = getActiveAmount('Physical Damage', date, d.companyId, uniqueCompsInWeek.length);
        let phd = phdActive.amount !== 0 || phdActive.exp ? Math.abs(getWeeklyAmountFromExp(phdActive.amount, phdActive.exp)) : getFcRule('Physical Damage', 'physical_damage_custom', 'physical_damage');

        if (d.contractType === 'MCLOO') {
            const currTime = (date ? new Date(date).getTime() : Date.now()) - (3 * 24 * 60 * 60 * 1000);
            const isValidVal = (val: any) => val !== undefined && val !== null && String(val).trim() !== '';

            let matchedExp = fixedExpenses.find(e =>
                (e.companyId || '').replace(/\s+/g, '').toLowerCase() === (d.companyId || '').replace(/\s+/g, '').toLowerCase() && 
                (isValidVal((e as any).shared_liability) || isValidVal((e as any).shared_insurance) || isValidVal((e as any).company_base_for_mcloo)) &&
                (!e.valid_from || new Date(e.valid_from).getTime() <= currTime) &&
                (!e.valid_to || new Date(e.valid_to).getTime() >= currTime)
            );
            
            if (!matchedExp) {
                matchedExp = fixedExpenses.find(e => 
                    e.companyId === 'ALL' && 
                    (isValidVal((e as any).shared_liability) || isValidVal((e as any).shared_insurance) || isValidVal((e as any).company_base_for_mcloo)) &&
                    (!e.valid_from || new Date(e.valid_from).getTime() <= currTime) &&
                    (!e.valid_to || new Date(e.valid_to).getTime() >= currTime)
                );
            }

            if (matchedExp) {
                         let totalAmount = liabilityAuto + liabilityGlobal;
                         
                         const checkIncluded = (insName: string) => fixedExpenses.some(e => e.name === `MCLOO_INCLUDE_${insName}` && (e.companyId === d.companyId || e.companyId === 'ALL') && (!e.valid_from || new Date(e.valid_from).getTime() <= currTime) && (!e.valid_to || new Date(e.valid_to).getTime() >= currTime));
                         
                         if (checkIncluded('Liability Insurance (General)')) { totalAmount += liabilityGeneral; liabilityGeneral = 0; }
                         if (checkIncluded('Cargo Insurance')) { totalAmount += cargo; cargo = 0; }
                         if (checkIncluded('Lease Gap Coverage')) { totalAmount += leaseGap; leaseGap = 0; }
                         if (checkIncluded('Trailer Interchange')) { totalAmount += trailerInterchange; trailerInterchange = 0; }
                         if (checkIncluded('LAGO')) { totalAmount += lago; lago = 0; }
                         if (checkIncluded('PD Premium')) { totalAmount += phd_premium; phd_premium = 0; }
                         if (checkIncluded('Physical Damage')) { totalAmount += phd; phd = 0; }

                         const baseLimit = (matchedExp as any).company_base_for_mcloo;
                         if (baseLimit !== undefined && baseLimit !== null && String(baseLimit).trim() !== '') {
                             const limit = Number(baseLimit) || 0;
                             liability = Math.min(totalAmount, limit);
                        } else {
                    liability = totalAmount;
                }
                     } else {
                         liability = liabilityAuto + liabilityGeneral + liabilityGlobal;
                     }
                 } else {
                    liability = liabilityAuto + liabilityGeneral + liabilityGlobal;
                 }

         
         
         
        const plates = getFcRule('Plates', 'plates_custom', 'plates');
        const factoring = getFcRule('Factoring', 'factoring_custom', 'factoring');
        const telematics = getFcRule('Telematics', 'telematics_custom', 'telematics');
        const phone_and_internet = getFcRule('Phone & Internet', 'phone_and_internet_custom', 'phone_and_internet');
        const office_supplies = getFcRule('Office Supplies', 'office_supplies_custom', 'office_supplies');
        const rent_and_parking = getFcRule('Rent & Parking', 'rent_and_parking_custom', 'rent_and_parking');
        const backup_mc = getFcRule('Backup MC', 'backup_mc_custom', 'backup_mc');
        const backoffice_reg = getFcRule('Back Office Pay', 'backoffice_reg_custom', 'backoffice_reg');
        const backoffice_tech = getFcRule('Tech Pay', 'backoffice_tech_custom', 'backoffice_tech');
         const getRed = (eName: string, rKey: string, cId: string, cType: string) => {
             const cTime = (date ? new Date(date).getTime() : Date.now()) - (3 * 24 * 60 * 60 * 1000);
             const rls = fixedExpenses.filter(e => e.name === eName && (e as any)[rKey] && (!e.valid_from || new Date(e.valid_from).getTime() <= cTime) && (!e.valid_to || new Date(e.valid_to).getTime() >= cTime));
             const gls = rls.filter(e => e.companyId === 'ALL' && (!e.contractType || e.contractType === '' || e.contractType === 'ALL'));
             const sps = rls.filter(e => (e.companyId === cId && (!e.contractType || e.contractType === '' || e.contractType === 'ALL')) || (e.contractType === cType && (!e.companyId || e.companyId === 'ALL' || e.companyId === '')) || (e.companyId === cId && e.contractType === cType));
             const gl = gls.length > 0 ? Math.max(...gls.map(e => Number((e as any)[rKey]) || 0)) : 0;
             const sp = sps.length > 0 ? Math.max(...sps.map(e => Number((e as any)[rKey]) || 0)) : 0;
             return gl + sp;
         };
         const truck_weekly = Math.max(0, getFcRule('Truck Price', 'truck_weekly_custom', 'truck_weekly') - getRed('Truck Price', 'truck_reduction', d.companyId || '', effContractType));
         const truck_cpm = getFcRuleCpm('CPM', 'truck_price_cpm', 'truck_price_cpm');
         const trailer_weekly = Math.max(0, getFcRule('Trailer Price', 'trailer_weekly_custom', 'trailer_weekly') - getRed('Trailer Price', 'trailer_reduction', d.companyId || '', effContractType));
         
         const isOO = d.contractType === 'OO';
         const isGarland = d.contractType === 'CPM' && d.name === 'Garland Jermaine Norris';
                  
         const driver_gross = Number(d.grossRevenue || 0);
         const margin_amt = Number(d.marginAmount || 0);
         
         if (d.contractType === 'MCLOO') {
             cargo = cargo === 0 ? 0 : getFcRule('Cargo Insurance', 'cargo_insurance_custom', 'cargo_insurance');
             leaseGap = leaseGap === 0 ? 0 : getFcRule('Lease Gap Coverage', 'lease_gap_coverage_custom', 'lease_gap_coverage');
             trailerInterchange = trailerInterchange === 0 ? 0 : getFcRule('Trailer Interchange', 'trailer_interchange_custom', 'trailer_interchange');
             lago = lago === 0 ? 0 : getFcRule('LAGO', 'lago_custom', 'lago');
             phd_premium = phd_premium === 0 ? 0 : getFcRule('PD Premium', 'pd_premium_custom', 'pd_premium');
             phd = phd === 0 ? 0 : getFcRule('Physical Damage', 'physical_damage_custom', 'physical_damage');
         } else {
             cargo = getFcRule('Cargo Insurance', 'cargo_insurance_custom', 'cargo_insurance');
             leaseGap = getFcRule('Lease Gap Coverage', 'lease_gap_coverage_custom', 'lease_gap_coverage');
             trailerInterchange = getFcRule('Trailer Interchange', 'trailer_interchange_custom', 'trailer_interchange');
             lago = getFcRule('LAGO', 'lago_custom', 'lago');
             phd_premium = getFcRule('PD Premium', 'pd_premium_custom', 'pd_premium');
             phd = getFcRule('Physical Damage', 'physical_damage_custom', 'physical_damage');
         }

         let company_fixed_full = 0;
         let franchise_fixed_full = 0;
         let f_breakdown: any = {};

         const calculateFixedForType = (type: string) => {
             effContractType = type;
             let l_auto = getFcRule('Liability Insurance (Auto)', 'liability_insurance_custom', 'liability_insurance');
             let s_liab_act = getActiveAmount('Shared Insurance Liability', date, d.companyId, uniqueCompsInWeek.length);
             let s_liab = s_liab_act.amount !== 0 || s_liab_act.exp ? Math.abs(getWeeklyAmountFromExp(s_liab_act.amount, s_liab_act.exp)) : getFcRule('Shared Insurance Liability', 'shared_insurance_liability_custom', 'shared_insurance_liability');
             const l_gl = getFcRule('Liability Insurance (Global)', '', '');
             const l_gen = getFcRule('Liability Insurance (General)', '', '');
             const l_total = l_auto + l_gl + l_gen;
             const c_cargo = getFcRule('Cargo Insurance', 'cargo_insurance_custom', 'cargo_insurance');
             const c_lease_gap = getFcRule('Lease Gap Coverage', 'lease_gap_coverage_custom', 'lease_gap_coverage');
             const c_ti = getFcRule('Trailer Interchange', 'trailer_interchange_custom', 'trailer_interchange');
             const c_lago = getFcRule('LAGO', 'lago_custom', 'lago');
             const c_phd_p = getFcRule('PD Premium', 'pd_premium_custom', 'pd_premium');
             const c_phd = getFcRule('Physical Damage', 'physical_damage_custom', 'physical_damage');
             const c_plates = getFcRule('Plates', 'plates_custom', 'plates');
             const c_fact = getFcRule('Factoring', 'factoring_custom', 'factoring');
             const c_tel = getFcRule('Telematics', 'telematics_custom', 'telematics');
             const c_phone = getFcRule('Phone & Internet', 'phone_and_internet_custom', 'phone_and_internet');
             const c_off = getFcRule('Office Supplies', 'office_supplies_custom', 'office_supplies');
             const c_rent = getFcRule('Rent & Parking', 'rent_and_parking_custom', 'rent_and_parking');
             const c_bmc = getFcRule('Backup MC', 'backup_mc_custom', 'backup_mc');
             const c_boreg = getFcRule('Back Office Pay', 'backoffice_reg_custom', 'backoffice_reg');
             const c_botech = getFcRule('Tech Pay', 'backoffice_tech_custom', 'backoffice_tech');
             const c_tw = Math.max(0, getFcRule('Truck Price', 'truck_weekly_custom', 'truck_weekly') - getRed('Truck Price', 'truck_reduction', d.companyId || '', type));
             const c_tcpm = getFcRuleCpm('CPM', 'truck_price_cpm', 'truck_price_cpm');
             const c_trw = Math.max(0, getFcRule('Trailer Price', 'trailer_weekly_custom', 'trailer_weekly') - getRed('Trailer Price', 'trailer_reduction', d.companyId || '', type));

             let total = (effNT * (l_total + c_cargo + c_lease_gap + c_ti + c_lago + c_phd_p + c_phd + c_tw + c_plates + c_tel + c_phone + c_off + c_rent + c_bmc + c_boreg + c_botech)) +
                         (effTr * (c_trw + (c_phd / 4.0))) +
                         ((driver_gross + margin_amt) * (c_fact / 100.0)) +
                         (c_tcpm * (Number(d.milesDriven) || 0));
                         
             return total;
         };

         if (isOO) {
             company_fixed_full = (effNT * (liability + cargo + leaseGap + trailerInterchange + lago + phone_and_internet + office_supplies + rent_and_parking + backup_mc + backoffice_reg + backoffice_tech)) + (effTr * (trailer_weekly + (phd / 4.0))) + ((driver_gross + margin_amt) * (factoring / 100.0)) + (truck_cpm * (Number(d.milesDriven) || 0));
         } else if (d.contractType === 'MCLOO') {
             company_fixed_full = (effNT * (liability + liabilityGeneral + cargo + leaseGap + trailerInterchange + lago + phd_premium + phd + truck_weekly + plates + telematics + phone_and_internet + office_supplies + rent_and_parking + backup_mc + backoffice_reg + backoffice_tech)) + (effTr * (trailer_weekly + (phd / 4.0))) + ((driver_gross + margin_amt) * (factoring / 100.0)) + (truck_cpm * (Number(d.milesDriven) || 0));

             
         } else {
             company_fixed_full = calculateFixedForType(d.contractType || '');
             if (isGarland) company_fixed_full -= effNT * (truck_weekly + phd_premium + phd + plates);
             if (isFranchise) {
                 franchise_fixed_full = calculateFixedForType('TPOG (Franchise PnL)');
                 const prevType = effContractType;
                 effContractType = 'TPOG (Franchise PnL)';
                 f_breakdown.insLiabAuto = getFcRule('Liability Insurance (Auto)', 'liability_insurance_custom', 'liability_insurance') * effNT;
                 f_breakdown.insLiabGen = getFcRule('Liability Insurance (General)', '', '') * effNT;
                 f_breakdown.insCargo = getFcRule('Cargo Insurance', 'cargo_insurance_custom', 'cargo_insurance') * effNT;
                 f_breakdown.insLeaseGapCoverage = getFcRule('Lease Gap Coverage', 'lease_gap_coverage_custom', 'lease_gap_coverage') * effNT;
                 f_breakdown.insTrailerInterchange = getFcRule('Trailer Interchange', 'trailer_interchange_custom', 'trailer_interchange') * effNT;
                 f_breakdown.insLago = getFcRule('LAGO', 'lago_custom', 'lago') * effNT;
                 f_breakdown.insPhdPremium = getFcRule('PD Premium', 'pd_premium_custom', 'pd_premium') * effNT;
                 f_breakdown.insPhdTruck = getFcRule('Physical Damage', 'physical_damage_custom', 'physical_damage') * effNT;
                 f_breakdown.insPhdTrailer = (getFcRule('Physical Damage', 'physical_damage_custom', 'physical_damage') / 4.0) * effTr;
                 f_breakdown.fcTruck = effNT * Math.max(0, getFcRule('Truck Price', 'truck_weekly_custom', 'truck_weekly') - getRed('Truck Price', 'truck_reduction', d.companyId || '', effContractType));
                 f_breakdown.fcCpm = getFcRuleCpm('CPM', 'truck_price_cpm', 'truck_price_cpm') * (Number(d.milesDriven) || 0);
                 f_breakdown.fcTrailer = effTr * Math.max(0, getFcRule('Trailer Price', 'trailer_weekly_custom', 'trailer_weekly') - getRed('Trailer Price', 'trailer_reduction', d.companyId || '', effContractType));
                 f_breakdown.fcPlates = effNT * getFcRule('Plates', 'plates_custom', 'plates');
                 f_breakdown.fcTelematics = effNT * getFcRule('Telematics', 'telematics_custom', 'telematics');
                 f_breakdown.fcPhone = effNT * getFcRule('Phone & Internet', 'phone_and_internet_custom', 'phone_and_internet');
                 f_breakdown.fcOffice = effNT * getFcRule('Office Supplies', 'office_supplies_custom', 'office_supplies');
                 f_breakdown.fcRent = effNT * getFcRule('Rent & Parking', 'rent_and_parking_custom', 'rent_and_parking');
                 f_breakdown.fcBackupMc = effNT * getFcRule('Backup MC', 'backup_mc_custom', 'backup_mc');
                 f_breakdown.fcBoReg = effNT * getFcRule('Back Office Pay', 'backoffice_reg_custom', 'backoffice_reg');
                 f_breakdown.fcBoTech = effNT * getFcRule('Tech Pay', 'backoffice_tech_custom', 'backoffice_tech');
                 f_breakdown.fcFactoring = (driver_gross + margin_amt) * (getFcRule('Factoring', 'factoring_custom', 'factoring') / 100.0);
                 effContractType = prevType;
             }
         }

         let ins_liab_auto = 0;
         let ins_liab_gen = 0;
         let ins_cargo = 0;
         let ins_lease_gap = 0;
         let ins_trailer_interchange = 0;
         let ins_lago = 0;
         let ins_phd_premium = 0;
         let ins_phd_truck = 0;
         let ins_phd_trailer = 0;

         let orig_gen = getFcRule('Liability Insurance (General)', '', '');
         if (isOO || d.contractType === 'MCLOO') {
             if (isOO) {
                 ins_liab_gen = orig_gen * effNT;
                 ins_liab_auto = getFcRule('Liability Insurance (Auto)', 'liability_insurance_custom', 'liability_insurance') * effNT;
             } else {
                 ins_liab_auto = getFcRule('Liability Insurance (Auto)', 'liability_insurance_custom', 'liability_insurance') * effNT;
                 if (liabilityGeneral === 0) {
                    let orig_auto = Math.max(0, getFcRule('Liability Insurance (Auto)', 'liability_insurance_custom', 'liability_insurance') + getFcRule('Liability Insurance (Global)', '', ''));
                    let tot = orig_auto + orig_gen;
                    ins_liab_gen = tot > 0 ? liability * (orig_gen / tot) * effNT : 0;
               } else {
                     ins_liab_gen = liabilityGeneral * effNT;
                 }
             }
             ins_cargo = cargo * effNT;
             ins_lease_gap = leaseGap * effNT;
             ins_trailer_interchange = trailerInterchange * effNT;
             ins_lago = lago * effNT;
             ins_phd_premium = phd_premium * effNT;
             ins_phd_truck = isOO ? 0 : (phd * effNT);
             ins_phd_trailer = (phd / 4.0) * effTr;
         } else {
             effContractType = d.contractType || '';
             let c_l_auto = getFcRule('Liability Insurance (Auto)', 'liability_insurance_custom', 'liability_insurance');
             let c_l_gl = getFcRule('Liability Insurance (Global)', '', '');
             let c_l_gen = getFcRule('Liability Insurance (General)', '', '');
             ins_liab_auto = c_l_auto * effNT;
             ins_liab_gen = c_l_gen * effNT;
             ins_cargo = getFcRule('Cargo Insurance', 'cargo_insurance_custom', 'cargo_insurance') * effNT;
             ins_lease_gap = getFcRule('Lease Gap Coverage', 'lease_gap_coverage_custom', 'lease_gap_coverage') * effNT;
             ins_trailer_interchange = getFcRule('Trailer Interchange', 'trailer_interchange_custom', 'trailer_interchange') * effNT;
             ins_lago = getFcRule('LAGO', 'lago_custom', 'lago') * effNT;
             ins_phd_premium = getFcRule('PD Premium', 'pd_premium_custom', 'pd_premium') * effNT;
             ins_phd_truck = getFcRule('Physical Damage', 'physical_damage_custom', 'physical_damage') * effNT;
             ins_phd_trailer = (getFcRule('Physical Damage', 'physical_damage_custom', 'physical_damage') / 4.0) * effTr;
             
             if (isGarland) {
                 ins_phd_premium = 0;
                 ins_phd_truck = 0;
             }
         }
         let insurance_costs_calc = ins_liab_auto + ins_liab_gen + ins_cargo + ins_lease_gap + ins_trailer_interchange + ins_phd_premium + ins_phd_truck + ins_phd_trailer;
         
      

        let fixed = company_fixed_full || 0;

       let companyTakeMulti = 1;
        if ((d.contractType === 'TPOG WITH FRANCHISE' || (d.contractType === 'TPOG' && d.franchiseId)) && configContracts && configContracts.length > 0) {
            const tpogFranRule = [...configContracts].filter(c => c.contract_type === 'TPOG WITH FRANCHISE').sort((a,b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
            if (tpogFranRule && tpogFranRule.calculation_type === 'TPOG_FRANCHISE') {
                companyTakeMulti = tpogFranRule.mc_gross_percent !== undefined ? Number(tpogFranRule.mc_gross_percent) : 1;
            }
        }
        if ((d as any).isFranchiseStub) {
            companyTakeMulti = 1;
        }

       const orgTolls = (d as any).tolls_amount !== undefined ? (d as any).tolls_amount : ((d as any).tollsAmount !== undefined ? (d as any).tollsAmount : (d.tollCost || 0));
        const multipliedTolls = Number(orgTolls || 0) * companyTakeMulti;

        let dispGrossPerc = 0;
        let dispMarginPerc = 0;
        const curTime = (date ? new Date(date).getTime() : Date.now()) - (3 * 24 * 60 * 60 * 1000);
        const validDispExps = fixedExpenses.filter(e => {
            if (!e.name || !String(e.name).trim().toLowerCase().includes('dispatcher pay')) return false;
            const fromTime = e.valid_from ? new Date(e.valid_from).getTime() : -Infinity;
            const toTime = e.valid_to ? new Date(e.valid_to).getTime() : Infinity;
            return curTime >= fromTime && curTime <= toTime;
        });
        
        const getRuleScore = (e: any, targetDriver: any = d, targetEffCt: string = effContractType) => {
            let score = 0;
            const dispName = e.dispatcher_name || e.dispatcherName || e.dispatcher_id || e.dispatcherId || e.dispatcher;
            if (dispName && String(dispName).trim().toUpperCase() !== 'ALL' && String(dispName).trim() !== '' && String(dispName).trim().toLowerCase() !== 'null') {
                const arr = String(dispName).split(',').map(s => s.trim().toLowerCase());
                if (arr.includes(String(targetDriver.dispatcherId || targetDriver.dispatcherName || targetDriver.dispatcher_name || '').trim().toLowerCase())) score += 1000;
                else return -1;
            }
            const teamName = e.team_name || e.teamName;
            if (teamName && String(teamName).trim().toUpperCase() !== 'ALL' && String(teamName).trim() !== '' && String(teamName).trim().toLowerCase() !== 'null') {
                const arr = String(teamName).split(',').map(s => s.trim().toLowerCase());
                if (arr.includes(String(targetDriver.teamId || targetDriver.teamName || targetDriver.team_name || '').trim().toLowerCase())) score += 100;
                else return -1;
            }
            const comp = e.companyId || e.company_id || e.company;
            if (comp && String(comp).trim().toUpperCase() !== 'ALL' && String(comp).trim() !== '' && String(comp).trim().toLowerCase() !== 'null') {
                const arr = String(comp).split(',').map(s => s.trim().toLowerCase());
                if (arr.includes(String(targetDriver.companyId || targetDriver.company_id || '').trim().toLowerCase())) score += 10;
                else return -1;
            }
            const ct = e.contractType || e.contract_type;
            if (ct && String(ct).trim().toUpperCase() !== 'ALL' && String(ct).trim() !== '' && String(ct).trim().toLowerCase() !== 'null') {
                const arr = String(ct).split(',').map(s => s.trim().toLowerCase());
                if (arr.includes(String(targetEffCt).trim().toLowerCase())) score += 1;
                else return -1;
            }
            return score;
        };

        const scoredRules = validDispExps.map(e => ({ rule: e, score: getRuleScore(e) })).filter(x => x.score >= 0);
        scoredRules.sort((a, b) => b.score - a.score);
        let dispRule = scoredRules.length > 0 ? scoredRules[0].rule : null;
        
        let dispFixedAmount = 0;
        let ruleLabel = 'ALL';
        if (dispRule) {
            const dName = dispRule.dispatcher_name || dispRule.dispatcherName || dispRule.dispatcher_id || dispRule.dispatcherId || dispRule.dispatcher || 'ALL';
            const cName = dispRule.companyId || dispRule.company_id || dispRule.company || 'ALL';
            const tName = dispRule.team_name || dispRule.teamName || 'ALL';
            const ctName = dispRule.contractType || dispRule.contract_type || 'ALL';
            
            let entityType = '';
            let entityName = '';
            
            if (dName !== 'ALL' && dName !== '') { entityType = 'Disp.'; entityName = dName; }
            else if (tName !== 'ALL' && tName !== '') { entityType = 'Team'; entityName = tName; }
            else if (cName !== 'ALL' && cName !== '') { entityType = 'Comp.'; entityName = cName; }
            else if (ctName !== 'ALL' && ctName !== '' && String(ctName).trim().toLowerCase() !== 'null') { entityType = 'Contract'; entityName = ctName; }
            else { entityType = 'ALL'; }
            
            let prefix = entityType === 'ALL' ? 'ALL' : (entityType === 'Contract' ? entityName : `${entityType} ${entityName}`);

            let grossP = Number((dispRule as any).disp_gross_perc || (dispRule as any).dispatcher_gross_percent || (dispRule as any).dispatcherGrossPercent || (dispRule as any).dispGrossPerc || 0);
            let marginP = Number((dispRule as any).disp_margin_perc || (dispRule as any).dispatcher_margin_percent || (dispRule as any).dispatcherMarginPercent || (dispRule as any).dispMarginPerc || 0);
            let rawAmount = Number(dispRule.amount) || 0;

            if (dName !== 'ALL' && dName !== '' && (grossP !== 0 || marginP !== 0)) {
                dispGrossPerc = grossP;
                dispMarginPerc = marginP;
                ruleLabel = `${prefix} (${dispGrossPerc}% Gross, ${dispMarginPerc}% Margin)`;
            } else if (rawAmount !== 0) {
                if (dispRule.unit === '%') {
                    dispGrossPerc = rawAmount;
                    dispMarginPerc = marginP;
                    ruleLabel = `${prefix} (${dispGrossPerc}% Gross, ${dispMarginPerc}% Margin)`;
                } else if (dispRule.unit === '$ total') {
                    let matchingNT = 0;
                    const weekAllDrivers = (allDrivers || drivers).filter(drv => drv.payDate === d.payDate);
                    weekAllDrivers.forEach(drv => {
                        if (getRuleScore(dispRule, drv, drv.contractType || '') >= 0) {
                            matchingNT += (drv.effectiveNonTeams || 0);
                        }
                    });
                    const driverShare = matchingNT > 0 ? (d.effectiveNonTeams || 0) / matchingNT : 0;
                    dispFixedAmount = -(getWeeklyAmountFromExp(rawAmount, dispRule) * driverShare);
                    ruleLabel = `${prefix} ($${rawAmount} total)`;
                } else {
                    dispFixedAmount = -(getWeeklyAmountFromExp(rawAmount, dispRule) * (d.effectiveNonTeams || 0));
                    ruleLabel = `${prefix} ($${rawAmount} per truck)`;
                }
            } else {
                dispGrossPerc = grossP;
                dispMarginPerc = marginP;
                ruleLabel = `${prefix} (${dispGrossPerc}% Gross, ${dispMarginPerc}% Margin)`;
            }
        }
        let fullSharedLiabAmount = 0;
        let actualDispMclooPayAmount = 0;
        if (d.contractType === 'MCLOO') {
            let liabRuleForDisp = fixedExpenses.filter(e => (e.name === 'Liability Insurance (Auto)' || e.name === 'Liability Insurance') && e.companyId === d.companyId && (!e.valid_from || new Date(e.valid_from).getTime() <= curTime) && (!e.valid_to || new Date(e.valid_to).getTime() >= curTime)).sort((a, b) => new Date(b.valid_from || 0).getTime() - new Date(a.valid_from || 0).getTime())[0];
            if (!liabRuleForDisp) {
                liabRuleForDisp = fixedExpenses.filter(e => (e.name === 'Liability Insurance (Auto)' || e.name === 'Liability Insurance') && e.companyId === 'ALL' && (!e.valid_from || new Date(e.valid_from).getTime() <= curTime) && (!e.valid_to || new Date(e.valid_to).getTime() >= curTime)).sort((a, b) => new Date(b.valid_from || 0).getTime() - new Date(a.valid_from || 0).getTime())[0];
            }
            if (liabRuleForDisp) {
                let sharedVal = 0;
                if ((liabRuleForDisp as any).shared_insurance !== undefined && (liabRuleForDisp as any).shared_insurance !== null && String((liabRuleForDisp as any).shared_insurance).trim() !== '') {
                    sharedVal = Number((liabRuleForDisp as any).shared_insurance);
                } else if ((liabRuleForDisp as any).shared_liability !== undefined && (liabRuleForDisp as any).shared_liability !== null && String((liabRuleForDisp as any).shared_liability).trim() !== '') {
                    sharedVal = Number((liabRuleForDisp as any).shared_liability);
                }
                fullSharedLiabAmount = sharedVal * (d.effectiveNonTeams || 0);

                let dispSharedVal = 0;
                if ((liabRuleForDisp as any).disp_mcloo_pay !== undefined && (liabRuleForDisp as any).disp_mcloo_pay !== null && String((liabRuleForDisp as any).disp_mcloo_pay).trim() !== '') {
                    dispSharedVal = Number((liabRuleForDisp as any).disp_mcloo_pay);
                }
                actualDispMclooPayAmount = dispSharedVal * (d.effectiveNonTeams || 0);
            }
        }
        const dispGrossAmount = -(driver_gross * (dispGrossPerc / 100));
        const dispMarginAmount = -(margin_amt * (dispMarginPerc / 100));
        const dispSharedLiab = Math.abs(actualDispMclooPayAmount);
        const fullSharedLiab = Math.abs(fullSharedLiabAmount);
        const calcDispPay = dispGrossAmount + dispMarginAmount + dispSharedLiab + dispFixedAmount;
        const appliedDispName = (dispRule && dispRule.dispatcher_name && dispRule.dispatcher_name !== 'ALL' && dispRule.dispatcher_name !== '') ? dispRule.dispatcher_name : 'Company Default';

        let fc_truck = 0, fc_cpm = 0, fc_trailer = 0, fc_plates = 0, fc_telematics = 0, fc_phone = 0, fc_office = 0, fc_rent = 0, fc_backup_mc = 0, fc_bo_reg = 0, fc_bo_tech = 0, fc_factoring = 0;

        if (isOO) {
            fc_truck = 0;
            fc_cpm = truck_cpm * (Number(d.milesDriven) || 0);
            fc_trailer = trailer_weekly * effTr;
            fc_factoring = (driver_gross + margin_amt) * (factoring / 100.0);
            fc_phone = phone_and_internet * effNT;
            fc_office = office_supplies * effNT;
            fc_rent = rent_and_parking * effNT;
            fc_backup_mc = backup_mc * effNT;
            fc_bo_reg = backoffice_reg * effNT;
            fc_bo_tech = backoffice_tech * effNT;
        } else if (d.contractType === 'MCLOO') {
            fc_truck = (effNT * truck_weekly);
            fc_cpm = (truck_cpm * (Number(d.milesDriven) || 0));
            fc_trailer = trailer_weekly * effTr;
            fc_plates = plates * effNT;
            fc_telematics = telematics * effNT;
            fc_factoring = (driver_gross + margin_amt) * (factoring / 100.0);
            fc_phone = phone_and_internet * effNT;
            fc_office = office_supplies * effNT;
            fc_rent = rent_and_parking * effNT;
            fc_backup_mc = backup_mc * effNT;
            fc_bo_reg = backoffice_reg * effNT;
            fc_bo_tech = backoffice_tech * effNT;
        } else {
            let current_cpm = getFcRuleCpm('CPM', 'truck_price_cpm', 'truck_price_cpm');
            if (isFranchise && (d as any).isFranchiseStub) {
                const prevType = effContractType;
                effContractType = 'TPOG (Franchise PnL)';
                const franchise_cpm = getFcRuleCpm('CPM', 'truck_price_cpm', 'truck_price_cpm');
                effContractType = prevType;
                if (franchise_cpm > 0) current_cpm = franchise_cpm;
            }
            fc_truck = (effNT * truck_weekly);
             fc_cpm = (current_cpm * (Number(d.milesDriven) || 0));
             fc_trailer = effTr * trailer_weekly;
            fc_plates = effNT * getFcRule('Plates', 'plates_custom', 'plates');
            fc_telematics = effNT * getFcRule('Telematics', 'telematics_custom', 'telematics');
            fc_factoring = (driver_gross + margin_amt) * (getFcRule('Factoring', 'factoring_custom', 'factoring') / 100.0);
            fc_phone = effNT * getFcRule('Phone & Internet', 'phone_and_internet_custom', 'phone_and_internet');
            fc_office = effNT * getFcRule('Office Supplies', 'office_supplies_custom', 'office_supplies');
            fc_rent = effNT * getFcRule('Rent & Parking', 'rent_and_parking_custom', 'rent_and_parking');
            fc_backup_mc = effNT * getFcRule('Backup MC', 'backup_mc_custom', 'backup_mc');
            fc_bo_reg = effNT * getFcRule('Back Office Pay', 'backoffice_reg_custom', 'backoffice_reg');
            fc_bo_tech = effNT * getFcRule('Tech Pay', 'backoffice_tech_custom', 'backoffice_tech');
            if (isGarland) {
                fc_truck = 0;
                fc_plates = 0;
            }
        }

        let cTake = isFranchise ? companyTakeMulti : 1;

        result.push({
          ...d,
          fcTruck: fc_truck * cTake,
          fcCpm: fc_cpm * cTake,
          fcTrailer: fc_trailer * cTake,
          fcPlates: fc_plates * cTake,
          fcTelematics: fc_telematics * cTake,
          fcPhone: fc_phone * cTake,
          fcOffice: fc_office * cTake,
          fcRent: fc_rent * cTake,
          fcBackupMc: fc_backup_mc * cTake,
          fcBoReg: fc_bo_reg * cTake,
          fcBoTech: fc_bo_tech * cTake,
          fcFactoring: fc_factoring * cTake,
          ...d,
          dispatcherCommission: calcDispPay,
          dispGrossAmount: dispGrossAmount,
          dispMarginAmount: dispMarginAmount,
          dispSharedLiability: dispSharedLiab,
          dispFixedAmount: dispFixedAmount,
          appliedDispName: appliedDispName,
          appliedDispRuleLabel: ruleLabel,
          fullSharedLiability: fullSharedLiab,
          companyPay: (Number(d.companyPay || 0) * companyTakeMulti) + fullSharedLiab,
          tollCost: multipliedTolls,
          calculatedTolls: multipliedTolls,
          tolls: multipliedTolls,
          originalDbTolls: (d as any).tolls,
          fuelCost: Number(d.fuelCost || 0) * companyTakeMulti,
          fuelSavings: Number(d.fuelSavings || 0) * companyTakeMulti,
          spotter_fuel_saved: Number((d as any).spotter_fuel_saved || 0) * companyTakeMulti,
          fuel_saved: Number((d as any).fuel_saved || 0) * companyTakeMulti,
          fuelRebate: Number(d.fuelUsed || (d as any).fuel_quantity || 0) * (getActiveAmount('Fuel Rebate', date, d.companyId, uniqueCompsInWeek.length).amount || 0),
          recruitingCost: Number(d.recruitingCost || 0) * companyTakeMulti,
          calculatedFixedCost: company_fixed_full * (isFranchise ? companyTakeMulti : 1),
          fixed_costs: company_fixed_full * (isFranchise ? companyTakeMulti : 1),
          franchise_fixed_costs_full: franchise_fixed_full,
          franchise_fixed_breakdown: f_breakdown,
          insuranceCost: insurance_costs_calc,
          insLiabAuto: ins_liab_auto * cTake,
          insLiabGen: ins_liab_gen * cTake,
          insCargo: ins_cargo * cTake,
          insLeaseGapCoverage: ins_lease_gap * cTake,
          insTrailerInterchange: ins_trailer_interchange * cTake,
          insLago: ins_lago * cTake,
          insPhdPremium: ins_phd_premium * cTake,
          insPhdTruck: ins_phd_truck * cTake,
          insPhdTrailer: ins_phd_trailer * cTake,
          driverPoCoverage: d.driverPoCoverage,
          poCoverage: d.poCoverage ? (-Math.abs(Number(d.poCoverage))) * companyTakeMulti : 0,
          po_breakdown: d.po_breakdown ? (() => {
              let pb = d.po_breakdown;
              const adjusted: any = {};
              if (pb && typeof pb === 'object') {
                  Object.entries(pb).forEach(([k, v]: any) => {
                      adjusted[k] = Number(v) * companyTakeMulti;
                  });
              }
              return adjusted;
          })() : null,
        });
      });

      const allExpenseComps = Array.from(new Set(fixedExpenses.map(e => e.companyId))).filter(c => c && c !== 'ALL' && c !== 'UNRECONCILED');
      const orphanComps = allExpenseComps.filter(c => !uniqueCompsInWeek.includes(c));
      const currTimeOrph = (date ? new Date(date).getTime() : Date.now()) - (3 * 24 * 60 * 60 * 1000);

      let agg_o_fixed = 0;
      let agg_o_insCost = 0;
      let agg_o_insLiabAuto = 0;
      let agg_o_insLiabGen = 0;
      let agg_o_insCargo = 0;
      let agg_o_insLeaseGap = 0;
      let agg_o_insTrailerInterchange = 0;
      let agg_o_insLago = 0;
      let agg_o_insPhdPremium = 0;
      let agg_o_insPhdTruck = 0;
      let agg_o_insPhdTrailer = 0;
      let agg_o_fcPlates = 0;
      let agg_o_fcTelematics = 0;
      let agg_o_fcPhone = 0;
      let agg_o_fcOffice = 0;
      let agg_o_fcRent = 0;
      let agg_o_fcBackupMc = 0;
      let agg_o_fcBoReg = 0;
      let agg_o_fcBoTech = 0;

      orphanComps.forEach(compId => {
          const getOrphExp = (n: string) => {
              const exps = fixedExpenses.filter(e => e.name === n && e.companyId === compId && (!e.valid_from || new Date(e.valid_from).getTime() <= currTimeOrph) && (!e.valid_to || new Date(e.valid_to).getTime() >= currTimeOrph));
              if (!exps.length) return 0;
              return getWeeklyAmountFromExp(exps[0].amount || 0, exps[0]);
          };

          const o_insLiabAuto = getOrphExp('Liability Insurance (Auto)') || getOrphExp('Liability Insurance');
          const o_insLiabGen = getOrphExp('Liability Insurance (General)');
          const o_insCargo = getOrphExp('Cargo Insurance');
          const o_insLeaseGap = getOrphExp('Lease Gap Coverage');
          const o_insTrailerInterchange = getOrphExp('Trailer Interchange');
          const o_insLago = getOrphExp('LAGO');
          const o_insPhdPremium = getOrphExp('PD Premium');
          const o_insPhdTruck = getOrphExp('Physical Damage (Truck)') || getOrphExp('Physical Damage');
          const o_insPhdTrailer = getOrphExp('Physical Damage (Trailer)') || (o_insPhdTruck / 4);
          const o_fcPlates = getOrphExp('Plates');
          const o_fcTelematics = getOrphExp('Telematics') || getOrphExp('ELD & Telematics');
          const o_fcPhone = getOrphExp('Phone & Internet');
          const o_fcOffice = getOrphExp('Office Supplies');
          const o_fcRent = getOrphExp('Rent & Parking');
          const o_fcBackupMc = getOrphExp('Backup MC');
          const o_fcBoReg = getOrphExp('Back Office Pay') || getOrphExp('Backoffice Reg');
          const o_fcBoTech = getOrphExp('Tech Pay') || getOrphExp('Backoffice Tech');

          const o_fixed = o_insLiabAuto + o_insLiabGen + o_insCargo + o_insLeaseGap + o_insTrailerInterchange + o_insLago + o_insPhdPremium + o_insPhdTruck + o_insPhdTrailer + o_fcPlates + o_fcTelematics + o_fcPhone + o_fcOffice + o_fcRent + o_fcBackupMc + o_fcBoReg + o_fcBoTech;

          if (o_fixed > 0) {
              agg_o_fixed += o_fixed;
              agg_o_insCost += (o_insLiabAuto + o_insLiabGen + o_insCargo + o_insLeaseGap + o_insTrailerInterchange + o_insLago + o_insPhdPremium + o_insPhdTruck + o_insPhdTrailer);
              agg_o_insLiabAuto += o_insLiabAuto;
              agg_o_insLiabGen += o_insLiabGen;
              agg_o_insCargo += o_insCargo;
              agg_o_insLeaseGap += o_insLeaseGap;
              agg_o_insTrailerInterchange += o_insTrailerInterchange;
              agg_o_insLago += o_insLago;
              agg_o_insPhdPremium += o_insPhdPremium;
              agg_o_insPhdTruck += o_insPhdTruck;
              agg_o_insPhdTrailer += o_insPhdTrailer;
              agg_o_fcPlates += o_fcPlates;
              agg_o_fcTelematics += o_fcTelematics;
              agg_o_fcPhone += o_fcPhone;
              agg_o_fcOffice += o_fcOffice;
              agg_o_fcRent += o_fcRent;
              agg_o_fcBackupMc += o_fcBackupMc;
              agg_o_fcBoReg += o_fcBoReg;
              agg_o_fcBoTech += o_fcBoTech;
          }
      });

      if (agg_o_fixed > 0) {
          result.push({
              id: `orphan_${date}_UNRECONCILED`,
              name: `Unassigned`,
              companyId: 'UNRECONCILED',
              payDate: date,
              contractType: 'Unassigned',
              calculatedFixedCost: agg_o_fixed,
              fixed_costs: agg_o_fixed,
              insuranceCost: agg_o_insCost,
              insLiabAuto: agg_o_insLiabAuto,
              insLiabGen: agg_o_insLiabGen,
              insCargo: agg_o_insCargo,
              insLeaseGapCoverage: agg_o_insLeaseGap,
              insTrailerInterchange: agg_o_insTrailerInterchange,
              insLago: agg_o_insLago,
              insPhdPremium: agg_o_insPhdPremium,
              insPhdTruck: agg_o_insPhdTruck,
              insPhdTrailer: agg_o_insPhdTrailer,
              fcPlates: agg_o_fcPlates,
              fcTelematics: agg_o_fcTelematics,
              fcPhone: agg_o_fcPhone,
              fcOffice: agg_o_fcOffice,
              fcRent: agg_o_fcRent,
              fcBackupMc: agg_o_fcBackupMc,
              fcBoReg: agg_o_fcBoReg,
              fcBoTech: agg_o_fcBoTech,
              effectiveDrivers: 0,
              effectiveNonTeams: 0,
              grossRevenue: 0,
              marginAmount: 0,
              isFranchiseStub: false,
              isStub: true
         } as any);
        }
      });

      globalEnrichedCache = result;
      globalEnrichedCacheKey = cacheKey;
      return result;
    }, [drivers, allDrivers, parsedFinImportData, getActiveAmount, latestPayDate, fixedCostsData, configContracts, cacheKey]);

  useEffect(() => {
    if (enrichedDrivers && enrichedDrivers.length > 0) {
      (window as any).__ENRICHED_DRIVERS__ = enrichedDrivers;
    }
  }, [enrichedDrivers]);

 useEffect(() => {
    if (enrichedDrivers && enrichedDrivers.length > 0) {
      (window as any).__ENRICHED_DRIVERS__ = enrichedDrivers;
    }
  }, [enrichedDrivers]);

  const displayedDrivers = useMemo(() => {
    const validDates = new Set(uniqueDates);
    if (!selectedDate || selectedDate === 'ALL') return enrichedDrivers.filter(d => validDates.has(d.payDate));
    if (selectedDate === 'LATEST') {
      if (isAverageView && latestPayDate) {
        return enrichedDrivers.filter(d => d.payDate <= latestPayDate && validDates.has(d.payDate));
      }
      return latestPayDate ? enrichedDrivers.filter(d => d.payDate === latestPayDate) : enrichedDrivers.filter(d => validDates.has(d.payDate));
    }
    if (isAverageView) {
      return enrichedDrivers.filter(d => d.payDate <= selectedDate && validDates.has(d.payDate));
    }
    return enrichedDrivers.filter(d => d.payDate === selectedDate);
  }, [enrichedDrivers, selectedDate, latestPayDate, uniqueDates, isAverageView]);

  const filteredTableDrivers = useMemo(() => {
      let baseDrivers = displayedDrivers;
      if (isAverageView && selectedDate !== 'ALL') {
          const validDates = new Set(uniqueDates);
          let targetDate = selectedDate === 'LATEST' ? latestPayDate : selectedDate;
          baseDrivers = enrichedDrivers.filter(d => d.payDate <= (targetDate || '') && validDates.has(d.payDate));
      }

      if (!tableFilters || tableFilters.length === 0) return baseDrivers;
      return baseDrivers.filter(d => {
          return tableFilters.every(rule => {
              if (!rule.field || !rule.operator) return true;
              let fieldValue: any;
              switch (rule.field) {
                      case 'Contract': fieldValue = d.contractType; break;
                      case 'Company': fieldValue = d.companyId; break;
                      case 'Team': fieldValue = d.teamId; break;
                      case 'Franchise': fieldValue = d.franchiseId; break;
                      case 'Driver': fieldValue = d.name; break;
                      case 'Dispatcher': fieldValue = d.dispatcherId; break;
                      case 'Eff Drivers': fieldValue = d.effectiveDrivers; break;
                      case 'Eff Non Teams': fieldValue = d.effectiveNonTeams; break;
                      case 'Eff Trailers': fieldValue = (d as any).effectiveTrailers; break;
                      case 'Gross': fieldValue = d.grossRevenue; break;
                      case 'Margin': fieldValue = d.marginAmount; break;
                      case 'Miles': fieldValue = Number(d.milesDriven) || 0; break;
                      case 'Net Pay': fieldValue = d.netPay ?? 0; break;
                      case 'Med Net Pay': fieldValue = d.netPay ?? 0; break;
                      case 'Disp. Pay': fieldValue = d.dispatcherCommission || 0; break;
                      case 'Ins. Exp.': fieldValue = (d as any).insuranceCost || 0; break;
                     case 'Fuel':
        fieldValue = (d.contractType?.includes('TPOG') || d.contractType === 'POG' || d.contractType === 'CPM') ? -Math.abs(d.fuelCost || 0) : (Number((d as any).spotter_fuel_saved ?? 0) !== 0 ? (Number((d as any).spotter_fuel_saved ?? 0) + (Number((d as any).fuel_saved ?? d.fuelSavings ?? 0) - Number((d as any).fuel_saved_2 ?? 0))) : Number((d as any).fuel_saved ?? d.fuelSavings ?? 0));
        break;
                      case 'Rev. Col.': fieldValue = d.companyPay || 0; break;
                      case 'Rev Base': fieldValue = Number((d as any).revenue_base ?? (d as any).revenueBase ?? 0); break;
                      case 'Bal Change': fieldValue = Number((d as any).balance_settle ?? (d as any).balanceSettle ?? 0) + Number((d as any).po_settle ?? (d as any).poSettle ?? 0) - Number((d as any).po_deductions ?? (d as any).poDeductions ?? 0); break;
                      case 'Rev Prorated': fieldValue = 0; break;
                      case '0 Mi Cap': fieldValue = 0; break;
                      case 'Escrow Adj': fieldValue = Number((d as any).escrow_deduction ?? (d as any).escrowDeduct ?? 0); break;
                      case 'Tolls Adj': fieldValue = Math.abs(d.tolls || d.tollCost || 0); break;
                      case 'Cash Adv': fieldValue = Number((d as any).cash_advance_percent ?? (d as any).cashAdvancePercent ?? 0); break;
                      case 'CPM Adj': fieldValue = Number((d as any).revenue_cpm ?? (d as any).revenueCpm ?? 0) * (Number(d.milesDriven) || 0); break;
                     case 'Fuel Adj':
        fieldValue = (d.contractType?.includes('TPOG') || d.contractType === 'POG' || d.contractType === 'CPM') ? -Math.abs(d.fuelCost || 0) : (Number((d as any).spotter_fuel_saved ?? 0) !== 0 ? (Number((d as any).spotter_fuel_saved ?? 0) + (Number((d as any).fuel_saved ?? d.fuelSavings ?? 0) - Number((d as any).fuel_saved_2 ?? 0))) : Number((d as any).fuel_saved ?? d.fuelSavings ?? 0));
        break;
                      case 'Fuel Reb.': fieldValue = (d as any).fuelRebate || 0; break;
                      case 'Wkly Exp.': fieldValue = (d as any).calculatedFixedCost || 0; break;
                      case 'Tolls': fieldValue = Math.abs(d.tolls || d.tollCost || 0); break;
                      case 'PO': fieldValue = Math.abs(d.poCoverage || 0); break;
                      case 'Recruiting': fieldValue = Math.abs(d.recruitingCost || 0); break;
                      case 'PnL 4w': fieldValue = 0; break;
                      case '4w Avg': fieldValue = 0; break;
                      case 'Total PnL': fieldValue = (d.companyPay || 0) + ((d as any).fuelRebate || 0) + ((d as any).dispSharedLiability || 0) - ((d as any).calculatedFixedCost || 0) - Math.abs(d.poCoverage || 0) - Math.abs(d.recruitingCost || 0) - Math.abs(d.tolls || d.tollCost || 0); break;
                      default: return true;
                  }

             const isCategorical = ['Contract', 'Company', 'Team', 'Franchise', 'Driver', 'Dispatcher'].includes(rule.field);
const isEmptyValue = fieldValue === undefined || fieldValue === null || String(fieldValue).trim() === '' || String(fieldValue).trim() === 'Unassigned';

if (rule.operator === 'is empty') return isEmptyValue;
if (rule.operator === 'is not empty') return !isEmptyValue;

if (isCategorical) {
    const safeVal = String(fieldValue || 'Unassigned');
                  const selectedValues = Array.isArray(rule.value) ? rule.value : [];
                  if (rule.operator === 'is one of') return selectedValues.includes(safeVal);
                  if (rule.operator === 'is not one of') return !selectedValues.includes(safeVal);
                  if (rule.operator === 'is') return selectedValues.length > 0 && selectedValues[0] === safeVal;
                  if (rule.operator === 'is not') return selectedValues.length > 0 && selectedValues[0] !== safeVal;
                  return true;
              } else {
                  const numVal = Number(fieldValue) || 0;
                  const filterNum = Number(rule.value) || 0;
                  if (rule.operator === 'is equal') return numVal === filterNum;
                  if (rule.operator === 'is not equal') return numVal !== filterNum;
                  if (rule.operator === 'is less than') return numVal < filterNum;
                  if (rule.operator === 'is more than') return numVal > filterNum;
                  if (rule.operator === 'is less or equal') return numVal <= filterNum;
                  if (rule.operator === 'is more or equal') return numVal >= filterNum;
                  return true;
              }
          });
      });
  }, [displayedDrivers, tableFilters, isAverageView, selectedDate, latestPayDate, enrichedDrivers, uniqueDates]);


  const uniqueTeams = useMemo(() => Array.from(new Set(displayedDrivers.map(d => (d.companyId === 'UNRECONCILED' || (d as any).isStub) ? 'Unassigned' : (d.teamId || 'No Team')))).sort(), [displayedDrivers]);
  const uniqueFranchises = useMemo(() => Array.from(new Set(displayedDrivers.map(d => (d.companyId === 'UNRECONCILED' || (d as any).isStub) ? 'Unassigned' : (d.franchiseId || 'No Franchise')))).sort(), [displayedDrivers]);
  const uniqueContracts = useMemo(() => Array.from(new Set(displayedDrivers.map(d => d.contractType))).filter(Boolean).sort(), [displayedDrivers]);
  const uniqueCompanies = useMemo(() => {
    const companies = Array.from(new Set(displayedDrivers.map(d => (d.companyId === 'UNRECONCILED' || !d.companyId) ? 'Unassigned' : d.companyId)));
    return companies.filter(c => c && c !== 'Unknown').sort() as string[];
  }, [displayedDrivers]);
  const uniqueDrivers = useMemo(() => Array.from(new Set(displayedDrivers.map(d => d.name))).filter(Boolean).sort(), [displayedDrivers]);
  const uniqueDispatchers = useMemo(() => Array.from(new Set(displayedDrivers.map(d => d.dispatcherId))).filter(Boolean).sort(), [displayedDrivers]);

 useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (metricsRef.current && !metricsRef.current.contains(event.target as Node)) {
        setIsMetricsOpen(false);
      }
      if (entitiesRef.current && !entitiesRef.current.contains(event.target as Node)) {
        setIsEntitiesOpen(false);
      }
      if (colsMainRef.current && !colsMainRef.current.contains(event.target as Node)) {
        setIsColsOpenMain(false);
      }
      if (colsExpandedRef.current && !colsExpandedRef.current.contains(event.target as Node)) {
        setIsColsOpenExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);



 

  const calculateMetrics = useCallback((initialDrivers: DriverPerformance[], isDriverView: boolean = false) => {
    const latestDatesByDriver = new Map<string, string>();
    initialDrivers.forEach(d => {
      if ((d.effectiveDrivers || 0) === 0) return;
      const name = d.name || 'Unknown';
      const dDate = d.payDate || (d as any).week_ending || '';
      if (!latestDatesByDriver.has(name) || dDate > (latestDatesByDriver.get(name) || '')) {
        latestDatesByDriver.set(name, dDate);
      }
    });
    initialDrivers.forEach(d => {
      const name = d.name || 'Unknown';
      if (!latestDatesByDriver.has(name)) {
        latestDatesByDriver.set(name, d.payDate || (d as any).week_ending || '');
      }
    });

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
    const total_miles = initialDrivers.reduce((sum, d) => sum + (Number((d as any).total_miles) || Number(d.milesDriven) || 0), 0);
    const loaded_miles = initialDrivers.reduce((sum, d) => sum + (Number((d as any).loaded_miles) || 0), 0);
    const dh = initialDrivers.reduce((sum, d) => sum + (Number((d as any).dh) || 0), 0);
    const fuelSavings = initialDrivers.reduce((sum, d) => sum + (d.fuelSavings || 0), 0);
    const driverPay = initialDrivers.reduce((sum, d) => sum + d.netPay, 0);
 const fuel = initialDrivers.reduce((sum, d) => {
    const ct = d.contractType || '';
    if (ct.includes('TPOG') || ct === 'POG' || ct === 'CPM') {
      return sum - Math.abs(d.fuelCost || 0);
    }
    const spotter = Number((d as any).spotter_fuel_saved ?? 0);
    const saved = Number((d as any).fuel_saved ?? d.fuelSavings ?? 0);
    const saved2 = Number((d as any).fuel_saved_2 ?? 0);
    return sum + (spotter !== 0 ? (spotter + (saved - saved2)) : saved);
  }, 0);
    const fuel_retail_price = initialDrivers.reduce((sum, d) => sum + (Number((d as any).fuel_retail_price) || 0), 0);
    const fuel_retail_price_count = initialDrivers.filter(d => (Number((d as any).fuel_retail_price) || 0) !== 0).length;
    const spotter_retail_price = initialDrivers.reduce((sum, d) => sum + (Number((d as any).spotter_retail_price) || 0), 0);
    const spotter_retail_price_count = initialDrivers.filter(d => (Number((d as any).spotter_retail_price) || 0) !== 0).length;
    const fuel_discount_price = initialDrivers.reduce((sum, d) => sum + (Number((d as any).fuel_discount_price) || 0), 0);
    const fuel_discount_price_count = initialDrivers.filter(d => (Number((d as any).fuel_discount_price) || 0) !== 0).length;
    const fuel_quantity = initialDrivers.reduce((sum, d) => sum + (Number((d as any).fuel_quantity) || 0), 0);
    const recordCount = initialDrivers.length;
 const wosFuel = initialDrivers.reduce((sum, d) => {
      const ct = d.contractType || '';
      if (ct.includes('TPOG') || ct === 'POG' || ct === 'CPM') {
        return sum;
      }
      const spotter = Number((d as any).spotter_fuel_saved ?? 0);
      const saved2 = Number((d as any).fuel_saved_2 ?? 0);
      const diff = spotter !== 0 ? (spotter - saved2) : 0;
      return sum + (diff > 0 ? -diff : diff);
    }, 0);
 const maint = initialDrivers.reduce((sum, d) => sum + d.maintenanceCost, 0);
    const faults = initialDrivers.reduce((sum, d) => sum + d.driverFaultExpenses, 0);
    
    const totalPO = initialDrivers.reduce((sum, d) => sum + (d.poAmount || 0), 0);
    const totalEscrow = initialDrivers.reduce((sum, d) => sum + (d.escrowBalance || 0), 0);
    const totalBalance = initialDrivers.reduce((sum, d) => sum + (d.balanceTotal || 0), 0);
    const fuelRebate = initialDrivers.reduce((sum, d) => sum + ((d as any).fuelRebate || 0), 0);
    let excludedPoTotal = 0;
    const poBreakdown = initialDrivers.reduce((acc: any, d: any) => {
                let pb = d.po_breakdown;
                if (pb && typeof pb === 'object') {
                    const isFranchiseStub = (d as any).isFranchiseStub;
                    Object.entries(pb).forEach(([key, val]) => {
                        let adjustedVal = Number(val);
                        let isExcludedCurrent = false;
                        
                        const allRule = poRules.find(r => r.contract_type === 'ALL' && r.category_name === key && r.status === 'Exclude');
                        if (allRule) isExcludedCurrent = true;

                        if (isFranchiseStub) {
                            const stubRule = poRules.find(r => (r.contract_type === 'TPOG Franchise PnL' || r.contract_type === 'TPOG (Franchise PnL)') && r.category_name === key && r.status === 'Exclude');
                            if (stubRule) {
                                isExcludedCurrent = true;
                            }
                        } else {
                            const cType = d.contractType || 'Unknown';
                            const relevantRule = poRules.find(r => r.contract_type === cType && r.category_name === key && r.status === 'Exclude');
                            if (relevantRule) {
                                if (cType === 'TPOG') {
                                    const tpogScope = relevantRule.tpog || 'Only TPOG with franchises';
                                    if (tpogScope === 'ALL TPOG') isExcludedCurrent = true;
                                    else if (tpogScope === 'Only TPOG with franchises' && !!d.franchiseId) isExcludedCurrent = true;
                                    else if (tpogScope === 'Only TPOG without franchises' && !d.franchiseId) isExcludedCurrent = true;
                                } else {
                                    isExcludedCurrent = true;
                                }
                            }
                        }

                        if (isExcludedCurrent) {
                            adjustedVal = 0;
                        }

                        if (isFranchiseStub) {
                            const tpogRule = poRules.find(r => (r.contract_type === 'TPOG' || r.contract_type === 'ALL') && r.category_name === key && r.status === 'Exclude');
                            let isExcludedForTPOG = false;
                            if (tpogRule) {
                                const tpogScope = tpogRule.tpog || 'Only TPOG with franchises';
                                if (tpogScope === 'ALL TPOG' || tpogScope === 'Only TPOG with franchises') isExcludedForTPOG = true;
                            }
                            if (isExcludedForTPOG && !isExcludedCurrent) {
                                excludedPoTotal += -Math.abs(Number(val));
                            }
                        }

                        if (adjustedVal !== 0 || isExcludedCurrent) {
                            if (!acc[key]) acc[key] = 0;
                            acc[key] += adjustedVal;
                        }
                    });
                }
                return acc;
            }, {});
    const insuranceExp = initialDrivers.reduce((sum, d) => sum + ((d as any).insuranceCost || 0), 0);
    const insLiabAuto = initialDrivers.reduce((sum, d) => sum + ((d as any).insLiabAuto || 0), 0);
    const insLiabGen = initialDrivers.reduce((sum, d) => sum + ((d as any).insLiabGen || 0), 0);
    const insCargo = initialDrivers.reduce((sum, d) => sum + ((d as any).insCargo || 0), 0);
    const insLeaseGapCoverage = initialDrivers.reduce((sum, d) => sum + ((d as any).insLeaseGapCoverage || 0), 0);
    const insTrailerInterchange = initialDrivers.reduce((sum, d) => sum + ((d as any).insTrailerInterchange || 0), 0);
    const insLago = initialDrivers.reduce((sum, d) => sum + ((d as any).insLago || 0), 0);
    const insPhdPremium = initialDrivers.reduce((sum, d) => sum + ((d as any).insPhdPremium || 0), 0);
    const insPhdTruck = initialDrivers.reduce((sum, d) => sum + ((d as any).insPhdTruck || 0), 0);
    const insPhdTrailer = initialDrivers.reduce((sum, d) => sum + ((d as any).insPhdTrailer || 0), 0);
    
    const dispatcherPay = initialDrivers.reduce((sum, d) => sum + (d.dispatcherCommission || 0), 0);
    const dispGrossAmount = initialDrivers.reduce((sum, d) => sum + ((d as any).dispGrossAmount || 0), 0);
    const dispMarginAmount = initialDrivers.reduce((sum, d) => sum + ((d as any).dispMarginAmount || 0), 0);
    const dispSharedLiability = initialDrivers.reduce((sum, d) => sum + ((d as any).dispSharedLiability || 0), 0);
    const dispFixedAmount = initialDrivers.reduce((sum, d) => sum + ((d as any).dispFixedAmount || 0), 0);
    const fullSharedLiability = initialDrivers.reduce((sum, d) => sum + ((d as any).fullSharedLiability || 0), 0);
    const sharedInsBreakdown = initialDrivers.reduce((acc: any, d: any) => {
        let amt = Number(d.fullSharedLiability || 0);
        if (amt !== 0) {
            let comp = d.companyId || 'Unassigned';
            if (!acc[comp]) acc[comp] = 0;
            acc[comp] += amt;
        }
        return acc;
    }, {});

    const dispBreakdown = initialDrivers.reduce((acc: any, d: any) => {
        let amt = Number(d.dispatcherCommission || 0);
        if (amt !== 0 || d.dispSharedLiability) {
            let label = d.appliedDispRuleLabel || 'Company Default';
            if (!acc[label]) acc[label] = { gross: 0, margin: 0, fixed: 0, total: 0 };
            acc[label].gross += Number(d.dispGrossAmount || 0);
            acc[label].margin += Number(d.dispMarginAmount || 0);
            acc[label].fixed += Number(d.dispFixedAmount || 0);
            acc[label].total += amt;
        }
        return acc;
    }, {});

    let companyPay = 0;
    let tolls = 0;
    let totalPOCov = 0;
    let totalRecruiting = 0;
    let baseFixed = 0;
    let adjFixed = 0;
    let pnlCompanyPay = 0;
    let pnlTolls = 0;
    let pnlTotalPOCov = 0;
    let pnlTotalRecruiting = 0;
    let pnlBaseFixed = 0;
    let pnlAdjFixed = 0;
    let pnlFuelRebate = 0;
    let pnlDispGrossAmount = 0;
    let pnlDispMarginAmount = 0;
    let pnlDispFixedAmount = 0;
    
    let fcTruck = 0, fcCpm = 0, fcTrailer = 0, fcPlates = 0, fcTelematics = 0, fcPhone = 0, fcOffice = 0, fcRent = 0, fcBackupMc = 0, fcBoReg = 0, fcBoTech = 0, fcFactoring = 0;

    let pnlRevBase = 0;
    let pnlFranchiseBase = 0;
    let pnlPoDeductions = 0;
    let pnlPoSettle = 0;
    let pnlNegNetPay = 0;
    let pnlStrictNegNetPay = 0;
    let pnlBalanceSettle = 0;
    let pnlBalanceChange = 0;
    let pnlExcludedBalanceChange = 0;
    let pnlIncludedBalanceChange = 0;
    let pnlTruckFloat = 0;
    let pnlTruckWkly = 0;
    let pnlOccIns = 0;
    let pnlEld = 0;
    let pnlIfta = 0;
    let pnlMaintSupport = 0;
    let pnlLiability = 0;
    let pnlTruckPhd = 0;
    let pnlTrailer = 0;
    let pnlTrailerPhd = 0;
    let pnlEscrowAdj = 0;
    let pnlTollsAdj = 0;
    let pnlCashAdv = 0;
    let pnlCpmAdj = 0;
    let pnlFuelAdj = 0;
    let pnlProrated = 0;
        let pnlZeroMiDrop = 0;
        let activeItemsIntersection: string[] | null = null;

        initialDrivers.forEach(d => {
        fcTruck += (d as any).fcTruck || 0;
        fcCpm += (d as any).fcCpm || 0;
        fcTrailer += (d as any).fcTrailer || 0;
        fcPlates += (d as any).fcPlates || 0;
        fcTelematics += (d as any).fcTelematics || 0;
        fcPhone += (d as any).fcPhone || 0;
        fcOffice += (d as any).fcOffice || 0;
        fcRent += (d as any).fcRent || 0;
        fcBackupMc += (d as any).fcBackupMc || 0;
        fcBoReg += (d as any).fcBoReg || 0;
        fcBoTech += (d as any).fcBoTech || 0;
        fcFactoring += (d as any).fcFactoring || 0;

        const activeItems = getPnlConfigItems(d.contractType || '');

        if (activeItemsIntersection === null) {
            activeItemsIntersection = [...activeItems];
        } else {
            activeItemsIntersection = activeItemsIntersection.filter(i => activeItems.includes(i));
        }

        const dFuelRebate = (d as any).fuelRebate || 0;
        if (activeItems.includes('fuel_rebate')) pnlFuelRebate += dFuelRebate;

        const dTollsRaw = Number((d as any).originalDbTolls !== undefined ? (d as any).originalDbTolls : ((d as any).rawTolls !== undefined ? (d as any).rawTolls : ((d as any).tolls || 0)));
        const dTolls = Math.abs((d as any).calculatedTolls !== undefined ? (d as any).calculatedTolls : ((d as any).tolls !== undefined ? (d as any).tolls : (d.tollCost || 0)));
        tolls += dTolls;
        if (activeItems.includes('tolls')) pnlTolls += dTolls;

        let dPOCov = Number(d.poCoverage) || 0;
        if (d.po_breakdown && typeof d.po_breakdown === 'object') {
            let recalcPo = 0;
            const isFranchiseStub = (d as any).isFranchiseStub;
            Object.entries(d.po_breakdown).forEach(([key, val]) => {
                let isExcluded = false;
                const allRule = poRules.find(r => r.contract_type === 'ALL' && r.category_name === key && r.status === 'Exclude');
                if (allRule) isExcluded = true;

                if (isFranchiseStub) {
                    const stubRule = poRules.find(r => (r.contract_type === 'TPOG Franchise PnL' || r.contract_type === 'TPOG (Franchise PnL)') && r.category_name === key && r.status === 'Exclude');
                    if (stubRule) isExcluded = true;
                } else {
                    const cType = d.contractType || 'Unknown';
                    const relevantRule = poRules.find(r => r.contract_type === cType && r.category_name === key && r.status === 'Exclude');
                    if (relevantRule) {
                        if (cType === 'TPOG') {
                            const tpogScope = relevantRule.tpog || 'Only TPOG with franchises';
                            if (tpogScope === 'ALL TPOG') isExcluded = true;
                            else if (tpogScope === 'Only TPOG with franchises' && !!d.franchiseId) isExcluded = true;
                            else if (tpogScope === 'Only TPOG without franchises' && !d.franchiseId) isExcluded = true;
                        } else {
                            isExcluded = true;
                        }
                    }
                }

                if (!isExcluded) {
                    recalcPo += Number(val);
                }
            });
            dPOCov = recalcPo;
        }
        totalPOCov += dPOCov;
        if (activeItems.includes('po')) pnlTotalPOCov += dPOCov;

        const dRecruiting = d.recruitingCost || 0;
        totalRecruiting += dRecruiting;
        if (activeItems.includes('recruiting')) pnlTotalRecruiting += dRecruiting;

        if (activeItems.includes('dispatcher_pay')) {
            pnlDispGrossAmount += ((d as any).dispGrossAmount || 0);
            pnlDispMarginAmount += ((d as any).dispMarginAmount || 0);
            pnlDispFixedAmount += ((d as any).dispFixedAmount || 0);
        }

        const dBaseFixed = (d as any).fixed_costs || 0;
        const dAdjFixed = simulationConfig.globalFixedExpenseAdjustment * (d.effectiveDrivers || 0);
        baseFixed += dBaseFixed;
        adjFixed += dAdjFixed;
        if (activeItems.includes('weekly_expenses')) {
            pnlBaseFixed += dBaseFixed;
            pnlAdjFixed += dAdjFixed;
        }

        let companyTakeMulti = 1;
        if ((d.contractType === 'TPOG WITH FRANCHISE' || (d.contractType === 'TPOG' && d.franchiseId)) && configContracts && configContracts.length > 0) {
            const tpogFranRule = [...configContracts].filter(c => c.contract_type === 'TPOG WITH FRANCHISE').sort((a,b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
            if (tpogFranRule && tpogFranRule.calculation_type === 'TPOG_FRANCHISE') {
                companyTakeMulti = tpogFranRule.mc_gross_percent !== undefined ? Number(tpogFranRule.mc_gross_percent) : 1;
            }
        }

        const isFranchise = d.contractType === 'TPOG' && !!d.franchiseId;
        const effNT = d.effectiveNonTeams || 0;
            const effTr = (d as any).effectiveTrailers || 0;

            const rBase = Number((d as any).revenue_base ?? (d as any).revenueBase ?? 0);
            const poDed = Number((d as any).po_deductions ?? (d as any).poDeductions ?? 0);
            const poSet = Number((d as any).po_settle ?? (d as any).poSettle ?? 0);
            const balSet = Number((d as any).balance_settle ?? (d as any).balanceSettle ?? 0);
            const nPay = Number((d as any).net_pay ?? d.netPay ?? 0);
            const escDed = Number((d as any).escrow_deduction ?? (d as any).escrowDeduct ?? 0);
            
            const tFloat = Number((d as any).truck_float ?? (d as any).truckFloat ?? 0);
        const tWkly = Number((d as any).truck_wkly ?? (d as any).truckWkly ?? 0);
        const oIns = Number((d as any).occ_ins ?? (d as any).occIns ?? 0);
        const dEld = Number((d as any).eld ?? 0);
        const dIfta = Number((d as any).ifta ?? 0);
        const mSup = Number((d as any).maintenance_support ?? (d as any).maintenanceSupport ?? 0);
        const liab = Number((d as any).liability ?? 0);
        const tPhd = Number((d as any).truck_phd ?? (d as any).truckPhd ?? 0);
        const dTrl = Number((d as any).trailer ?? 0);
        const dTrlPhd = Number((d as any).trailer_phd ?? (d as any).trailerPhd ?? 0);
        
        const dCash = Number((d as any).cash_advance_percent ?? (d as any).cashAdvancePercent ?? 0);
    const dRevCpm = Number((d as any).revenue_cpm ?? (d as any).revenueCpm ?? 0);
    const dMiles = Number((d as any).total_miles ?? d.milesDriven ?? 0);
    const spotter = Number((d as any).spotter_fuel_saved ?? 0);
    const saved = Number((d as any).fuel_saved ?? d.fuelSavings ?? 0);
    const saved2 = Number((d as any).fuel_saved_2 ?? 0);
    const fSaved = spotter !== 0 ? (spotter + (saved - saved2)) : saved;
    const fSpent = Number((d as any).fuel_spent ?? (d as any).fuelCost ?? 0);

        const revWithoutFuelVal = Number((d as any).rev_without_fuel ?? (d as any).revWithoutFuel ?? 0);
        const mileCapFactor = (revWithoutFuelVal > 0 && dMiles === 0) ? 0 : 1;

        let drvRevBase = 0;
        let drvFranchiseBase = 0;
        let drvPoDeductions = 0;
        let drvPoSettle = 0;
        let drvNegNetPay = 0;
        let drvBalanceSettle = 0;
        let drvBalanceChange = 0;
        let drvTruckFloat = 0;
        let drvTruckWkly = 0;
        let drvOccIns = 0;
        let drvEld = 0;
        let drvIfta = 0;
        let drvMaintSupport = 0;
        let drvLiability = 0;
        let drvTruckPhd = 0;
        let drvTrailer = 0;
        let drvTrailerPhd = 0;
        let drvEscrowAdj = 0;
        let drvTollsAdj = 0;
        let drvCashAdv = 0;
        let drvCpmAdj = 0;
        let drvFuelAdj = 0;
        let drvZeroMiDrop = 0;

      if (isFranchise) {
            const franRevCapped = Number((d as any).franchise_rev_capped_bal ?? (d as any).franchiseRevCappedBal ?? 0);
            const cappedBase = (franRevCapped > 0 && dMiles === 0) ? 0 : franRevCapped;
            drvFranchiseBase = cappedBase;

            drvTruckFloat = tFloat * effNT;
            drvTruckWkly = tWkly * effNT;
            drvOccIns = oIns * effNT;
            drvEld = dEld * effNT;
            drvIfta = dIfta * effNT;
            drvMaintSupport = mSup * effNT;
            drvLiability = liab * effNT;
            drvTruckPhd = tPhd * effNT;
            drvTrailer = dTrl * effTr;
            drvTrailerPhd = dTrlPhd * effTr;
            
            if ((d as any).isFranchiseStub) {
                drvPoDeductions = -poDed;
                drvPoSettle = poSet;
                drvNegNetPay = nPay < 0 ? nPay : 0;
                drvBalanceSettle = balSet;
                drvBalanceChange = drvPoDeductions + drvPoSettle + drvNegNetPay + drvBalanceSettle;
                
                drvEscrowAdj = nPay < 0 ? Math.min(Math.abs(nPay), Math.abs(escDed)) : 0;
                drvCashAdv = dCash;
                drvCpmAdj = dRevCpm * dMiles;
                drvFuelAdj = (d.name === 'Garland Jermaine Norris' ? 0 : -fSpent);
                drvTollsAdj = 0;

                drvRevBase = rBase;
            } else {
                drvPoDeductions = -poDed;
                drvPoSettle = poSet;
                drvNegNetPay = nPay < 0 ? nPay : 0;
                drvBalanceSettle = balSet;
                drvBalanceChange = drvPoDeductions + drvPoSettle + drvNegNetPay + drvBalanceSettle;
                
                drvEscrowAdj = 0;
                drvCashAdv = dCash;
                
                drvCpmAdj = dRevCpm * dMiles;
                drvFuelAdj = (d.name === 'Garland Jermaine Norris' ? 0 : -fSpent);
                drvTollsAdj = 0;

                if (d.name === 'Garland Jermaine Norris') {
                    drvRevBase = (d.grossRevenue || 0) * 0.2;
                } else {
                    drvRevBase = rBase;
                }
            }
        
        }  else {
            if (d.name === 'Garland Jermaine Norris') {
                drvRevBase = (d.grossRevenue || 0) * 0.2;
            } else {
                drvRevBase = rBase;
                const balFactor = d.contractType === 'MCLOO' ? 0.3 : 1;
                drvPoDeductions = -poDed;
                drvPoSettle = poSet;
                drvNegNetPay = nPay < 0 ? nPay : 0;
                drvBalanceSettle = balSet;
                drvBalanceChange = (drvPoDeductions + drvPoSettle + drvNegNetPay + drvBalanceSettle) * balFactor;
                
                drvTruckFloat = tFloat * effNT;
                drvTruckWkly = tWkly * effNT;
                drvOccIns = oIns * effNT;
                drvEld = dEld * effNT;
                drvIfta = dIfta * effNT;
                drvMaintSupport = mSup * effNT;
                drvLiability = liab * effNT;
                drvTruckPhd = tPhd * effNT;
                drvTrailer = dTrl * effTr;
                drvTrailerPhd = dTrlPhd * effTr;
            }

            if (d.contractType !== 'MCLOO') {
                drvEscrowAdj = (nPay < 0 ? Math.min(Math.abs(nPay), Math.abs(escDed)) : 0);
                drvTollsAdj = (['OO', 'LOO', 'LPOO'].includes(d.contractType || '') ? dTollsRaw : 0);
                drvCashAdv = dCash;
                drvCpmAdj = dRevCpm * dMiles;
                drvFuelAdj = (d.name === 'Garland Jermaine Norris' ? 0 : (['MCLOO', 'OO', 'LOO', 'LPOO', 'MCOO'].includes(d.contractType || '') ? fSaved : -fSpent));
            } else {
                drvEscrowAdj = 0;
                drvTollsAdj = Math.abs(dTollsRaw) * 0.3;
                drvCpmAdj = dRevCpm * dMiles;
                drvFuelAdj = fSaved;
            }
        }

        const origDrvBalanceChange = drvBalanceChange;
        const origDrvEscrowAdj = drvEscrowAdj;

        const isLatest = (d.payDate || (d as any).week_ending || '') === latestDatesByDriver.get(d.name || 'Unknown');
        if (!isLatest) {
            drvBalanceChange = 0;
            drvEscrowAdj = 0;
            drvPoDeductions = 0;
            drvPoSettle = 0;
            drvNegNetPay = 0;
            drvBalanceSettle = 0;
        }

        drvRevBase *= mileCapFactor;
        
        drvZeroMiDrop = 0;
        if (dMiles === 0) {
            const prorated = drvTruckFloat + drvTruckWkly + drvOccIns + drvEld + drvIfta + drvMaintSupport + drvLiability + drvTruckPhd + drvTrailer + drvTrailerPhd;
            let effectiveBalChangeForPreDrop = origDrvBalanceChange;
            if (isFranchise && !(d as any).isFranchiseStub) {
                 effectiveBalChangeForPreDrop = 0;
            }
            const stubBase = rBase * mileCapFactor;
            const preDrop = (d as any).isFranchiseStub ? (stubBase + effectiveBalChangeForPreDrop + prorated) : (drvRevBase + effectiveBalChangeForPreDrop + prorated);
            if (preDrop > 0) {
                drvZeroMiDrop = -preDrop;
            }
        }

        pnlRevBase += drvRevBase * companyTakeMulti;
        pnlFranchiseBase += drvFranchiseBase * companyTakeMulti;
        pnlPoDeductions += drvPoDeductions * companyTakeMulti;
        pnlPoSettle += drvPoSettle * companyTakeMulti;
        pnlNegNetPay += drvNegNetPay * companyTakeMulti;
        let drvStrictNegNetPay = 0;
        if (isFranchise) {
            if ((d as any).isFranchiseStub) drvStrictNegNetPay = nPay < 0 ? nPay : 0;
            else drvStrictNegNetPay = 0;
        } else {
            drvStrictNegNetPay = nPay < 0 ? nPay : 0;
        }
        pnlStrictNegNetPay += drvStrictNegNetPay * companyTakeMulti;
        pnlBalanceSettle += drvBalanceSettle * companyTakeMulti;
        pnlBalanceChange += drvBalanceChange * companyTakeMulti;
        
        if (isFranchise && !(d as any).isFranchiseStub) {
            pnlExcludedBalanceChange += drvBalanceChange * companyTakeMulti;
        } else {
            pnlIncludedBalanceChange += drvBalanceChange * companyTakeMulti;
        }
        
        pnlTruckFloat += drvTruckFloat * companyTakeMulti;
        pnlTruckWkly += drvTruckWkly * companyTakeMulti;
        pnlOccIns += drvOccIns * companyTakeMulti;
        pnlEld += drvEld * companyTakeMulti;
        pnlIfta += drvIfta * companyTakeMulti;
        pnlMaintSupport += drvMaintSupport * companyTakeMulti;
        pnlLiability += drvLiability * companyTakeMulti;
        pnlTruckPhd += drvTruckPhd * companyTakeMulti;
        pnlTrailer += drvTrailer * companyTakeMulti;
        pnlTrailerPhd += drvTrailerPhd * companyTakeMulti;
        pnlEscrowAdj += drvEscrowAdj * companyTakeMulti;
        pnlTollsAdj += drvTollsAdj * companyTakeMulti;
        pnlCashAdv += drvCashAdv * companyTakeMulti;
        pnlCpmAdj += drvCpmAdj * companyTakeMulti;
        pnlFuelAdj += drvFuelAdj * companyTakeMulti;
        pnlZeroMiDrop += drvZeroMiDrop * companyTakeMulti;
        
        pnlProrated += (drvTruckFloat + drvTruckWkly + drvOccIns + drvEld + drvIfta + drvMaintSupport + drvLiability + drvTruckPhd + drvTrailer + drvTrailerPhd) * companyTakeMulti;

        let effectiveBalChangeForCompanyPay = origDrvBalanceChange;
        if (isFranchise && !(d as any).isFranchiseStub) {
             effectiveBalChangeForCompanyPay = 0;
        }

        const calculatedDCompanyPay = (
            drvRevBase + 
            effectiveBalChangeForCompanyPay + 
            drvTruckFloat + drvTruckWkly + drvOccIns + drvEld + drvIfta + drvMaintSupport + drvLiability + drvTruckPhd + drvTrailer + drvTrailerPhd + 
            drvZeroMiDrop + 
            origDrvEscrowAdj + 
            drvTollsAdj + 
            drvCashAdv + 
            drvCpmAdj + 
            drvFuelAdj
        ) * companyTakeMulti + (d.fullSharedLiability || 0);

        companyPay += calculatedDCompanyPay;
        if (activeItems.includes('revenue_collected')) pnlCompanyPay += calculatedDCompanyPay;
    });

    const cogs = driverPay + fuel + maint + tolls + faults;

    const allocatedFixed = baseFixed + adjFixed;
    const pnlAllocatedFixed = pnlBaseFixed + pnlAdjFixed;
    const totalFixedPerUnit = effCount > 0 ? (allocatedFixed / effCount) : 0;

    const netIncome = pnlCompanyPay + pnlFuelRebate + pnlDispGrossAmount + pnlDispMarginAmount + pnlDispFixedAmount - pnlAllocatedFixed - Math.abs(pnlTotalPOCov) - Math.abs(pnlTotalRecruiting) - Math.abs(pnlTolls);
    const pnlPerDriver = effNonTeams > 0 ? netIncome / effNonTeams : 0;

   return {
  rawEffCount, effCount, effNonTeamsCount, effTrailersCount, gross, margin, total_miles, loaded_miles, dh, fuelSavings, companyPay, cogs, allocatedFixed, baseFixed, adjFixed, netIncome, pnlPerDriver,
  driverPay, fuel, wosFuel, maint, tolls, faults, dispatcherPay, dispGrossAmount, dispMarginAmount, dispSharedLiability, dispFixedAmount, fullSharedLiability, totalFixedPerUnit,
      totalPO, totalPOCov, totalEscrow, totalBalance, totalRecruiting,
      effNonTeams, currentPayDate,
      numOfTrucks, avgTruckPrice, numOfTrailers, avgTrailerPrice, truckUtilization, trailerUtilization, totalCalculatedTrucks, totalCalculatedTrailers,
      rawFinImportData, effNonTeamsForTrucks: effNonTeamsNoOOCount,
      fuel_retail_price, spotter_retail_price, fuel_discount_price, fuel_quantity, recordCount,
      fuel_retail_price_count, spotter_retail_price_count, fuel_discount_price_count,
      insuranceExp, insLiabAuto, insLiabGen, insCargo, insLeaseGapCoverage, insTrailerInterchange, insLago, insPhdPremium, insPhdTruck, insPhdTrailer, fuelRebate, poBreakdown, sharedInsBreakdown, dispBreakdown,
      fcTruck, fcCpm, fcTrailer, fcPlates, fcTelematics, fcPhone, fcOffice, fcRent, fcBackupMc, fcBoReg, fcBoTech, fcFactoring,
      pnlCompanyPay, pnlFuelRebate, pnlAllocatedFixed, pnlTotalPOCov, pnlTotalRecruiting, pnlTolls, pnlDispGrossAmount, pnlDispMarginAmount,
      pnlRevBase, pnlFranchiseBase, pnlPoDeductions, pnlPoSettle, pnlNegNetPay, pnlStrictNegNetPay, pnlBalanceSettle, pnlBalanceChange, pnlExcludedBalanceChange, pnlIncludedBalanceChange, pnlTruckFloat, pnlTruckWkly, pnlOccIns, pnlEld, pnlIfta, pnlMaintSupport, pnlLiability, pnlTruckPhd, pnlTrailer, pnlTrailerPhd, pnlEscrowAdj, pnlTollsAdj, pnlCashAdv, pnlCpmAdj, pnlFuelAdj, pnlProrated, pnlZeroMiDrop,
      excludedPoTotal,
      disabledPnlItems: ['revenue_collected', 'fuel_rebate', 'dispatcher_pay', 'weekly_expenses', 'po', 'tolls', 'recruiting'].filter(i => !(activeItemsIntersection || []).includes(i))
    };
  }, [fixedExpenses, simulationConfig, finImportByDate, globalStatsByDate, companyStatsMap, getPnlConfigItems, configContracts, poRules]);

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

     const tpogFranchiseDrivers = displayedDrivers.filter(d => d.contractType === 'TPOG' && !!d.franchiseId).map(d => ({
         ...d,
         companyPay: (d as any).franchise_revenue_collected || 0,
         fixed_costs: (d as any).franchise_fixed_costs_full || 0,
         poCoverage: (d as any).franchise_po ? -Math.abs(Number((d as any).franchise_po)) : 0,
         poAmount: (d as any).franchise_po || 0,
         po_breakdown: (d as any).franchise_po_breakdown,
         ...((d as any).franchise_fixed_breakdown || {}),
         isFranchiseStub: true
     }));

     if (tpogFranchiseDrivers.length > 0) {
         let fNetIncome = 0;
         const fUniqueDriverNames = Array.from(new Set(tpogFranchiseDrivers.map(d => d.name))).filter(Boolean);
         fUniqueDriverNames.forEach(dName => {
             const drvRecords = tpogFranchiseDrivers.filter(drv => drv.name === dName);
             const m = calculateMetrics(drvRecords, true);
             fNetIncome += ((m.netIncome - (m.pnlBalanceChange || 0) - (m.pnlEscrowAdj || 0)) + (m.excludedPoTotal || 0)) / 2 + (m.pnlBalanceChange || 0) + (m.pnlEscrowAdj || 0);
         });
         totalNetIncome -= fNetIncome;
     }

     return { ...rawMetrics, netIncome: totalNetIncome };
  }, [displayedDrivers, groupBy, calculateMetrics]);
  const displayTotalFixed = useMemo(() => {
    let total = 0;
    ['Liability Insurance', 'Cargo Insurance', 'Lease Gap Coverage', 'Trailer Interchange', 'LAGO', 'PD Premium', 'Physical Damage'].forEach(name => {
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
             const finKey = name === 'Liability Insurance' ? 'liability_insurance' : name === 'Cargo Insurance' ? 'cargo_insurance' : name === 'Trailer Interchange' ? 'trailer_interchange' : name === 'LAGO' ? 'lago' : name === 'PD Premium' ? 'physical_damage_premium' : 'physical_damage';
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

  


  const chartData = useMemo(() => {
    const cKey = `${cacheKey}-${selectedDate}-${chartWeeksLimit}-${groupBy}-${selectedEntities.join(',')}`;
    if (globalChartCache && globalChartCacheKey === cKey) return globalChartCache;

    if (enrichedDrivers.length === 0) return [];

    const driversByDate: Record<string, any[]> = {};
    enrichedDrivers.forEach(d => {
      if (!d.payDate) return;
      if (!driversByDate[d.payDate]) driversByDate[d.payDate] = [];
      driversByDate[d.payDate].push(d);
    });

    let allDates = Object.keys(driversByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
allDates = allDates.length > 6 ? allDates.slice(6) : allDates;

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

         const div = Math.max(1, new Set(subset.map((r: any) => r.payDate || r.week_ending)).size);
         const assign = (k: string, v: number) => { row[`${key}_${k}`] = v; row[`${key}_${k}Avg`] = v / div; };
         
         assign('gross', m.gross);
         assign('margin', m.margin);
         assign('total_miles', m.total_miles);
         assign('loaded_miles', m.loaded_miles);
         assign('dh', m.dh);
         assign('driverPay', m.driverPay);
         assign('insuranceExp', m.insuranceExp);
         assign('fuel', m.fuel);
         assign('wosFuel', m.wosFuel);
         assign('companyPay', m.pnlCompanyPay !== undefined ? m.pnlCompanyPay : m.companyPay);
         assign('pnlRevBase', m.pnlRevBase);
         assign('pnlProrated', m.pnlProrated);
         assign('pnlZeroMiDrop', m.pnlZeroMiDrop);
         assign('pnlTollsAdj', m.pnlTollsAdj);
         assign('pnlCashAdv', m.pnlCashAdv);
         assign('pnlCpmAdj', m.pnlCpmAdj);
         assign('pnlFuelAdj', m.pnlFuelAdj);
         assign('fullSharedLiability', m.fullSharedLiability);
         assign('fuelRebate', m.pnlFuelRebate !== undefined ? m.pnlFuelRebate : m.fuelRebate);
         assign('allocatedFixed', m.pnlAllocatedFixed !== undefined ? m.pnlAllocatedFixed : m.allocatedFixed);
         assign('tolls', m.pnlTolls !== undefined ? m.pnlTolls : m.tolls);
         assign('totalPOCov', m.pnlTotalPOCov !== undefined ? m.pnlTotalPOCov : m.totalPOCov);
         assign('dispatcherPay', m.dispatcherPay);
         assign('totalRecruiting', m.pnlTotalRecruiting !== undefined ? m.pnlTotalRecruiting : m.totalRecruiting);
         assign('netIncome', totalNetIncome);

         row[`${key}_pnlPerDriver`] = m.pnlPerDriver; 
         row[`${key}_balance`] = m.totalBalance;
         row[`${key}_effCount`] = m.effCount;
         row[`${key}_effNonTeamsCount`] = m.effNonTeamsCount;
         row[`${key}_effTrailersCount`] = m.effTrailersCount;
         row[`${key}_cogs`] = m.cogs;
         row[`${key}_totalPO`] = m.totalPO;
         row[`${key}_totalEscrow`] = m.totalEscrow;
      };

      const neededEntities = new Set(selectedEntities);
      if (groupBy === 'Contract') uniqueContracts.forEach(c => neededEntities.add(c));
      else if (groupBy === 'Company') uniqueCompanies.forEach(c => neededEntities.add(c));
      else if (groupBy === 'Team') uniqueTeams.forEach(c => neededEntities.add(c));
      else if (groupBy === 'Franchise') uniqueFranchises.forEach(c => neededEntities.add(c));
      else if (groupBy === 'Driver') uniqueDrivers.forEach(c => neededEntities.add(c));

      if (neededEntities.has('COMPANY')) {
          processEntity('COMPANY', dateDrivers);
          const tpogFranchiseDrivers = dateDrivers.filter(d => d.contractType === 'TPOG' && !!d.franchiseId).map(d => ({
              ...d,
              companyPay: (d as any).franchise_revenue_collected || 0,
              fixed_costs: (d as any).franchise_fixed_costs_full || 0,
              poCoverage: (d as any).franchise_po ? -Math.abs(Number((d as any).franchise_po)) : 0,
              poAmount: (d as any).franchise_po || 0,
              ...((d as any).franchise_fixed_breakdown || {}),
              isFranchiseStub: true
          }));
          if (tpogFranchiseDrivers.length > 0) {
              let fNetIncome = 0;
              const driversByName = new Map<string, any[]>();
              tpogFranchiseDrivers.forEach(d => {
                  const name = d.name || 'Unknown';
                  if (!driversByName.has(name)) driversByName.set(name, []);
                  driversByName.get(name)!.push(d);
              });
              driversByName.forEach(drvRecords => {
                  const m = calculateMetrics(drvRecords, true);
                  fNetIncome += ((m.netIncome - (m.pnlBalanceChange || 0) - (m.pnlEscrowAdj || 0)) + (m.excludedPoTotal || 0)) / 2 + (m.pnlBalanceChange || 0) + (m.pnlEscrowAdj || 0);
              });
              row['COMPANY_netIncome'] -= fNetIncome;
              const cDiv = Math.max(1, new Set(dateDrivers.map((r: any) => r.payDate || r.week_ending)).size);
              row['COMPANY_netIncomeAvg'] = row['COMPANY_netIncome'] / cDiv;
          }
      }
      
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
      if (neededEntities.has('TPOG') && byContract['TPOG']) {
        const franDrivers = byContract['TPOG'].filter((d: any) => !!d.franchiseId).map((d: any) => ({
          ...d,
          companyPay: d.franchise_revenue_collected || 0,
          fixed_costs: d.franchise_fixed_costs_full || 0,
          poCoverage: d.franchise_po ? -Math.abs(Number(d.franchise_po)) : 0,
          poAmount: d.franchise_po || 0,
          po_breakdown: d.franchise_po_breakdown,
          ...(d.franchise_fixed_breakdown || {}),
          isFranchiseStub: true
        }));
        if (franDrivers.length > 0) {
          let tNet = 0;
          let fGross = 0, fMargin = 0, fDriverPay = 0, fInsuranceExp = 0, fFuel = 0, fWosFuel = 0;
          let fCompanyPay = 0, fPnlRevBase = 0, fPnlProrated = 0, fPnlZeroMiDrop = 0, fPnlTollsAdj = 0;
          let fPnlCashAdv = 0, fPnlCpmAdj = 0, fPnlFuelAdj = 0, fFullSharedLiability = 0, fFuelRebate = 0;
          let fAllocatedFixed = 0, fTolls = 0, fTotalPOCov = 0, fDispatcherPay = 0, fTotalRecruiting = 0;
          let fEffNT = 0, fEffTr = 0, fEffCt = 0;

          const byName = new Map<string, any[]>();
          franDrivers.forEach((d: any) => {
            const n = d.name || 'Unknown';
            if (!byName.has(n)) byName.set(n, []);
            byName.get(n)!.push(d);
          });
          byName.forEach(recs => {
            const m = calculateMetrics(recs, true);
            fGross += m.gross;
            fMargin += m.margin;
            fDriverPay += m.driverPay;
            fInsuranceExp += m.insuranceExp;
            fFuel += m.fuel;
            fWosFuel += m.wosFuel;
            fCompanyPay += m.pnlCompanyPay !== undefined ? m.pnlCompanyPay : (m.companyPay || 0);
            fPnlRevBase += m.pnlRevBase;
            fPnlProrated += m.pnlProrated;
            fPnlZeroMiDrop += m.pnlZeroMiDrop;
            fPnlTollsAdj += m.pnlTollsAdj;
            fPnlCashAdv += m.pnlCashAdv;
            fPnlCpmAdj += m.pnlCpmAdj;
            fPnlFuelAdj += m.pnlFuelAdj;
            fFullSharedLiability += m.fullSharedLiability;
            fFuelRebate += m.pnlFuelRebate !== undefined ? m.pnlFuelRebate : m.fuelRebate;
            fAllocatedFixed += m.pnlAllocatedFixed !== undefined ? m.pnlAllocatedFixed : (m.allocatedFixed || 0);
            fTolls += Math.abs(m.pnlTolls !== undefined ? m.pnlTolls : (m.tolls || 0));
            fTotalPOCov += Math.abs(m.pnlTotalPOCov !== undefined ? m.pnlTotalPOCov : (m.totalPOCov || 0));
            fDispatcherPay += m.dispatcherPay;
            fTotalRecruiting += Math.abs(m.pnlTotalRecruiting !== undefined ? m.pnlTotalRecruiting : (m.totalRecruiting || 0));
            tNet += ((m.netIncome - (m.pnlBalanceChange || 0) - (m.pnlEscrowAdj || 0)) + (m.excludedPoTotal || 0)) / 2 + (m.pnlBalanceChange || 0) + (m.pnlEscrowAdj || 0);
            fEffNT += m.effNonTeamsCount;
            fEffTr += m.effTrailersCount;
            fEffCt += m.effCount;
          });
          
          const div = Math.max(1, new Set(franDrivers.map((r: any) => r.payDate || r.week_ending)).size);
          const assign = (k: string, v: number) => { row[`TPOG (Franchise PnL)_${k}`] = v; row[`TPOG (Franchise PnL)_${k}Avg`] = v / div; };
          
          assign('gross', fGross); assign('margin', fMargin); assign('driverPay', fDriverPay);
          assign('insuranceExp', fInsuranceExp); assign('fuel', fFuel); assign('wosFuel', fWosFuel);
          assign('companyPay', fCompanyPay); assign('pnlRevBase', fPnlRevBase); assign('pnlProrated', fPnlProrated);
          assign('pnlZeroMiDrop', fPnlZeroMiDrop); assign('pnlTollsAdj', fPnlTollsAdj); assign('pnlCashAdv', fPnlCashAdv);
          assign('pnlCpmAdj', fPnlCpmAdj); assign('pnlFuelAdj', fPnlFuelAdj); assign('fullSharedLiability', fFullSharedLiability);
          assign('fuelRebate', fFuelRebate); assign('allocatedFixed', fAllocatedFixed); assign('tolls', fTolls);
          assign('totalPOCov', fTotalPOCov); assign('dispatcherPay', fDispatcherPay); assign('totalRecruiting', fTotalRecruiting);
          assign('netIncome', tNet);

          row['TPOG (Franchise PnL)_effNonTeamsCount'] = fEffNT;
          row['TPOG (Franchise PnL)_effTrailersCount'] = fEffTr;
          row['TPOG (Franchise PnL)_effCount'] = fEffCt;
        }
      }
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
    globalChartCache = generatedChartData;
    globalChartCacheKey = cKey;
    return generatedChartData;
  }, [enrichedDrivers, uniqueContracts, uniqueCompanies, uniqueTeams, uniqueFranchises, uniqueDrivers, calculateMetrics, selectedDate, latestPayDate, chartWeeksLimit, groupBy, selectedEntities, cacheKey]);

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

      useEffect(() => {
        if (chartData && chartData.length > 0 && !hasPlayedInitialAnimations) {
          const timer = setTimeout(() => {
            hasPlayedInitialAnimations = true;
          }, 1500);
          return () => clearTimeout(timer);
        }
      }, [chartData]);
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
          gross: 'Gross', grossAvg: 'Gross Avg', margin: 'Margin', marginAvg: 'Margin Avg',
          total_miles: 'Total Miles', total_milesAvg: 'Total Miles Avg', loaded_miles: 'Loaded Miles', loaded_milesAvg: 'Loaded Miles Avg', dh: 'DH', dhAvg: 'DH Avg',
          driverPay: 'Net Pay', driverPayAvg: 'Net Pay Avg', insuranceExp: 'Ins. Exp.', insuranceExpAvg: 'Ins. Exp. Avg',
          fuel: 'Fuel', fuelAvg: 'Fuel Avg', wosFuel: 'SPOTTER FUEL', wosFuelAvg: 'SPOTTER FUEL Avg',
          companyPay: 'Rev. Col.', companyPayAvg: 'Rev. Col. Avg', pnlRevBase: 'Rev Base', pnlRevBaseAvg: 'Rev Base Avg',
          pnlProrated: 'Rev Prorated', pnlProratedAvg: 'Rev Prorated Avg', pnlZeroMiDrop: '0 Mi Cap', pnlZeroMiDropAvg: '0 Mi Cap Avg',
          pnlTollsAdj: 'Tolls Adj', pnlTollsAdjAvg: 'Tolls Adj Avg', pnlCashAdv: 'Cash Adv', pnlCashAdvAvg: 'Cash Adv Avg',
          pnlCpmAdj: 'CPM Adj', pnlCpmAdjAvg: 'CPM Adj Avg', pnlFuelAdj: 'Fuel Adj', pnlFuelAdjAvg: 'Fuel Adj Avg',
          fullSharedLiability: 'Shared Ins', fullSharedLiabilityAvg: 'Shared Ins Avg', fuelRebate: 'Fuel Reb.', fuelRebateAvg: 'Fuel Reb. Avg',
          allocatedFixed: 'Wkly Exp.', allocatedFixedAvg: 'Wkly Exp. Avg', tolls: 'Tolls', tollsAvg: 'Tolls Avg',
          totalPOCov: 'PO', totalPOCovAvg: 'PO Avg', dispatcherPay: 'Disp. Pay', dispatcherPayAvg: 'Disp. Pay Avg',
          totalRecruiting: 'Recruiting', totalRecruitingAvg: 'Recruiting Avg', netIncome: 'Total PnL', netIncomeAvg: 'Total PnL Avg'
        };
        const metricColors: any = {
          gross: '#a1a1aa', grossAvg: '#a1a1aa', netIncome: '#ffffff', netIncomeAvg: '#ffffff', margin: '#c084fc', marginAvg: '#c084fc',
          total_miles: '#fcd34d', total_milesAvg: '#fcd34d', loaded_miles: '#fde68a', loaded_milesAvg: '#fde68a', dh: '#fef3c7', dhAvg: '#fef3c7',
          companyPay: '#60a5fa', companyPayAvg: '#60a5fa', allocatedFixed: '#f87171', allocatedFixedAvg: '#f87171',
          totalPOCov: '#4ade80', totalPOCovAvg: '#4ade80', totalRecruiting: '#fb923c', totalRecruitingAvg: '#fb923c', tolls: '#fde047', tollsAvg: '#fde047',
          driverPay: '#d946ef', driverPayAvg: '#d946ef', insuranceExp: '#8b5cf6', insuranceExpAvg: '#8b5cf6',
          fuel: '#0ea5e9', fuelAvg: '#0ea5e9', wosFuel: '#38bdf8', wosFuelAvg: '#38bdf8',
          pnlRevBase: '#94a3b8', pnlRevBaseAvg: '#94a3b8', pnlProrated: '#cbd5e1', pnlProratedAvg: '#cbd5e1',
          pnlZeroMiDrop: '#fca5a5', pnlZeroMiDropAvg: '#fca5a5', pnlTollsAdj: '#fef08a', pnlTollsAdjAvg: '#fef08a',
          pnlCashAdv: '#6ee7b7', pnlCashAdvAvg: '#6ee7b7', pnlCpmAdj: '#93c5fd', pnlCpmAdjAvg: '#93c5fd',
          pnlFuelAdj: '#7dd3fc', pnlFuelAdjAvg: '#7dd3fc', fullSharedLiability: '#d8b4fe', fullSharedLiabilityAvg: '#d8b4fe',
          fuelRebate: '#818cf8', fuelRebateAvg: '#818cf8', dispatcherPay: '#c4b5fd', dispatcherPayAvg: '#c4b5fd'
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

  const sidebarUtilization = useMemo(() => {
      const baseDrivers = allDrivers || drivers;
      const validDates = new Set(uniqueDates);
      
      let utilDrivers = baseDrivers.filter(d => validDates.has(d.payDate));
      let isAllDates = false;
      if (selectedDate !== 'ALL') {
         const targetDate = selectedDate === 'LATEST' ? latestPayDate : selectedDate;
         utilDrivers = utilDrivers.filter(d => d.payDate === targetDate);
      } else {
         isAllDates = true;
      }
      
      const metrics = calculateMetrics(utilDrivers);
      
      let totalTrucks = metrics.numOfTrucks;
      let totalTrailers = metrics.numOfTrailers;
      
      if (isAllDates) {
          totalTrucks = 0;
          totalTrailers = 0;
          Array.from(validDates).forEach(date => {
              const dateDrivers = utilDrivers.filter(d => d.payDate === date);
              if (dateDrivers.length > 0) {
                  const m = calculateMetrics(dateDrivers);
                  totalTrucks += m.numOfTrucks || 0;
                  totalTrailers += m.numOfTrailers || 0;
              }
          });
      }
      
      return {
          trucks: Math.round(totalTrucks || 0),
          trailers: Math.round(totalTrailers || 0),
          nt: Number((metrics.effNonTeamsForTrucks || 0).toFixed(2)),
          tr: Number((metrics.effTrailersCount || 0).toFixed(2))
      };
  }, [allDrivers, drivers, selectedDate, latestPayDate, calculateMetrics, uniqueDates]);

 const activeColIds = useMemo(() => {
const ids = ['Segment', 'Gross', 'Margin', 'Total Miles', 'Loaded Miles', 'DH', 'Net Pay', 'Ins. Exp.', 'Fuel', 'SPOTTER FUEL', 'Ret. Price', 'Spotter Ret. Price', 'Disc Price', 'Quantity', 'Rev. Col.', 'Rev Base', 'Bal Change', 'Rev Prorated', '0 Mi Cap', 'Escrow Adj', 'Tolls Adj', 'Cash Adv', 'CPM Adj', 'Fuel Adj', 'Shared Ins', 'Fuel Reb.', 'Wkly Exp.', 'Tolls', 'PO', 'Disp. Pay', 'Recruiting', 'Total PnL'];
if (groupBy === 'Driver') {
      ids.push('Company', 'Team', 'Franchise', 'Dispatcher', 'Contract');
    }
    if (!isAverageView) {
      ids.push('Eff Drv', 'Eff NonTm', 'Eff Trls');
    }
    if (groupBy !== 'Driver') {
      ids.push('Med. Net Pay');
    }
    if (selectedDate !== 'ALL') {
      ids.push('PnL 4w', '4w Avg');
    }
    return ids;
  }, [isAverageView, groupBy, selectedDate]);

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
        drivers={enrichedDrivers}
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
                 <div className="flex items-center gap-4">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                       <LayoutList size={16} className="text-emerald-500" />
                       Master Operating Statement
                    </h2>
                    <input
                       type="text"
                       placeholder="Search..."
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       className="bg-zinc-950 border border-zinc-800 rounded px-2 text-zinc-300 font-sans text-xs focus:outline-none focus:border-emerald-500 w-[140px] h-[28px] placeholder:text-zinc-600"
                    />
                 </div>
                 <div className="flex items-center gap-2">
                    <div ref={colsExpandedRef} onClick={(e) => { e.stopPropagation(); setIsColsOpenExpanded(!isColsOpenExpanded); }} className={`relative group/col w-[140px] h-[28px] [&>div]:w-full [&>div]:h-full [&_button]:w-full [&_button]:h-full [&_button]:flex [&_button]:items-center [&_button]:justify-start [&_button]:gap-2 [&_button]:text-left [&_button]:bg-zinc-950 [&_button]:border [&_button]:font-sans [&_button]:text-[10px] [&_button]:font-normal [&_button]:px-2 [&_button]:rounded ${isColsOpenExpanded ? '[&_button]:border-zinc-600 [&_button]:text-white' : '[&_button]:border-zinc-800 [&_button]:text-zinc-400'}`}>
                    <ColumnsEditor columns={tableColumns} setColumns={setTableColumns} activeIds={activeColIds} />
                    <ChevronDown size={10} className={`absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none transition-transform ${isColsOpenExpanded ? 'rotate-180' : ''}`} />
                 </div>
                    <div className="w-[140px] h-[28px] [&>div]:w-full [&>div]:h-full [&_button]:w-full [&_button]:h-full">
                       <TableFilter
                         filters={tableFilters} 
                         setFilters={setTableFilters} 
                         optionsMap={{
                         'Contract': uniqueContracts,
                         'Company': uniqueCompanies,
                         'Team': uniqueTeams,
                         'Franchise': uniqueFranchises,
                         'Driver': uniqueDrivers,
                         'Dispatcher': uniqueDispatchers
                       }}
                       />
                    </div>
                   <div className="relative flex items-center">
                     <Eye size={12} className="absolute left-2 text-zinc-500 pointer-events-none" />
                     <select
                       value={groupBy}
                       onChange={(e) => { setGroupBy(e.target.value as any); e.target.blur(); }}
                       className="peer appearance-none bg-zinc-950 border border-zinc-800 rounded pl-6 pr-6 text-zinc-400 focus:text-white font-sans text-[10px] font-normal focus:outline-none focus:border-zinc-600 w-[140px] h-[28px] cursor-pointer"
                     >
                       <option value="Contract">By Contract</option>
                       <option value="Company">By Company</option>
                       <option value="Franchise">By Franchise</option>
                       <option value="Team">By Team</option>
                       <option value="Driver">By Driver</option>
                     </select>
                     <ChevronDown size={10} className="absolute right-2 text-zinc-500 pointer-events-none transition-transform peer-focus:rotate-180" />
                   </div>
                   <button
                     onClick={() => {
                        setIsAverageView(!isAverageView);
                     }}
                     className={`w-[140px] h-[28px] px-2 rounded text-[10px] font-sans font-normal border transition-colors flex justify-start items-center text-left ${isAverageView ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'}`}
                   >
                     AVG / DRV
                   </button>
                   <div className="relative flex items-center">
                     <select 
                       value={selectedDate} 
                       onChange={(e) => { setSelectedDate(e.target.value); e.target.blur(); }}
                       className="peer appearance-none bg-zinc-950 border border-zinc-800 rounded pl-2 pr-6 text-zinc-400 focus:text-white font-sans text-[10px] font-normal focus:outline-none focus:border-zinc-600 h-[28px] cursor-pointer"
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
                     <ChevronDown size={10} className="absolute right-2 text-zinc-500 pointer-events-none transition-transform peer-focus:rotate-180" />
                   </div>
                   <button 
                    onClick={() => setIsTableExpanded(false)}
                    className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors ml-2 flex items-center justify-center h-[28px] w-[28px]"
                   >
                      <X size={18} />
                   </button>
                 </div>
              </div>
              <div className="flex-1 overflow-hidden p-2">
                 <MasterTable 
                    companyMetrics={companyMetrics} 
                    drivers={filteredTableDrivers} 
                    calculateMetrics={calculateMetrics}
                    totalActiveCount={totalActiveCount}
                    selectedDate={selectedDate}
                    groupBy={groupBy}
                    chartData={chartData}
                    isAverageView={isAverageView}
                    searchQuery={searchQuery}
                    configContracts={configContracts}
                    tableColumns={tableColumns}
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
              <div className="flex items-center">
                 <input
                   type="text"
                   placeholder="Search..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="bg-zinc-950 border border-zinc-800 rounded px-2 text-zinc-300 font-sans text-[10px] focus:outline-none focus:border-emerald-500 w-[130px] h-[26px] placeholder:text-zinc-600"
                 />
              </div>
              <div className="flex items-center gap-2">
                 <div ref={colsMainRef} onClick={(e) => { e.stopPropagation(); setIsColsOpenMain(!isColsOpenMain); }} className={`relative group/col w-[130px] h-[26px] [&>div]:w-full [&>div]:h-full [&_button]:w-full [&_button]:h-full [&_button]:flex [&_button]:items-center [&_button]:justify-start [&_button]:gap-2 [&_button]:text-left [&_button]:bg-zinc-950 [&_button]:border [&_button]:font-sans [&_button]:text-[10px] [&_button]:font-normal [&_button]:px-2 [&_button]:rounded ${isColsOpenMain ? '[&_button]:border-zinc-600 [&_button]:text-white' : '[&_button]:border-zinc-800 [&_button]:text-zinc-400'}`}>
                   <ColumnsEditor columns={tableColumns} setColumns={setTableColumns} activeIds={activeColIds} />
                   <ChevronDown size={10} className={`absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none transition-transform ${isColsOpenMain ? 'rotate-180' : ''}`} />
                 </div>
                 <div className="w-[130px] h-[26px] [&>div]:w-full [&>div]:h-full [&_button]:w-full [&_button]:h-full">
                   <TableFilter
                     filters={tableFilters} 
                     setFilters={setTableFilters} 
                     optionsMap={{
                       'Contract': uniqueContracts,
                       'Company': uniqueCompanies,
                       'Team': uniqueTeams,
                       'Franchise': uniqueFranchises,
                       'Driver': uniqueDrivers,
                       'Dispatcher': uniqueDispatchers
                     }}
                   />
                 </div>
                 <div className="relative flex items-center">
                   <Eye size={10} className="absolute left-2 text-zinc-500 pointer-events-none" />
                   <select
                     value={groupBy}
                     onChange={(e) => { setGroupBy(e.target.value as any); e.target.blur(); }}
                     className="peer appearance-none bg-zinc-950 border border-zinc-800 rounded pl-6 pr-6 text-zinc-400 focus:text-white font-sans text-[10px] font-normal focus:outline-none focus:border-zinc-600 w-[130px] h-[26px] cursor-pointer"
                   >
                     <option value="Contract">By Contract</option>
                     <option value="Company">By Company</option>
                     <option value="Franchise">By Franchise</option>
                     <option value="Team">By Team</option>
                     <option value="Driver">By Driver</option>
                   </select>
                   <ChevronDown size={10} className="absolute right-2 text-zinc-500 pointer-events-none transition-transform peer-focus:rotate-180" />
                 </div>
                 <button
                   onClick={() => {
                      setIsAverageView(!isAverageView);
                   }}
                   className={`w-[130px] h-[26px] px-2 rounded text-[10px] font-sans font-normal border transition-colors flex justify-start items-center text-left ${isAverageView ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'}`}
                 >
                   AVG / DRV
                 </button>
                 <button 
                   onClick={() => setIsTableExpanded(true)}
                   className="text-zinc-500 hover:text-emerald-400 transition-colors ml-2 flex items-center justify-center h-[26px] w-[26px]" 
                   title="Expand View"
                 >
                   <Maximize2 size={12} />
                 </button>
              </div>
            </div>
            <MasterTable 
                companyMetrics={companyMetrics} 
                drivers={filteredTableDrivers} 
                calculateMetrics={calculateMetrics}
                totalActiveCount={totalActiveCount}
                selectedDate={selectedDate}
                groupBy={groupBy}
                chartData={chartData}
                isAverageView={isAverageView}
                searchQuery={searchQuery}
                configContracts={configContracts}
                tableColumns={tableColumns}
            />
          </div>
          <div className="flex-1 flex flex-col xl:flex-row gap-2 min-h-0">
             <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col min-h-0 overflow-hidden">
             
             {/* Chart Controls Toolbar */}
             <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-950/30 flex flex-nowrap overflow-x-auto gap-2 justify-between items-center flex-shrink-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                
                <div className="flex items-center gap-3 flex-shrink-0">
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
                            {[
                              'gross', 'grossAvg', 'margin', 'marginAvg', 'total_miles', 'total_milesAvg', 'loaded_miles', 'loaded_milesAvg', 'dh', 'dhAvg', 'driverPay', 'driverPayAvg',
                              'insuranceExp', 'insuranceExpAvg', 'fuel', 'fuelAvg', 'wosFuel', 'wosFuelAvg',
                              'companyPay', 'companyPayAvg', 'pnlRevBase', 'pnlRevBaseAvg', 'pnlProrated', 'pnlProratedAvg',
                              'pnlZeroMiDrop', 'pnlZeroMiDropAvg', 'pnlTollsAdj', 'pnlTollsAdjAvg', 'pnlCashAdv', 'pnlCashAdvAvg',
                              'pnlCpmAdj', 'pnlCpmAdjAvg', 'pnlFuelAdj', 'pnlFuelAdjAvg', 'fullSharedLiability', 'fullSharedLiabilityAvg',
                              'fuelRebate', 'fuelRebateAvg', 'allocatedFixed', 'allocatedFixedAvg', 'tolls', 'tollsAvg',
                              'totalPOCov', 'totalPOCovAvg', 'dispatcherPay', 'dispatcherPayAvg', 'totalRecruiting', 'totalRecruitingAvg',
                              'netIncome', 'netIncomeAvg'
                            ].map(m => {
                              const labels: any = {
                                gross: 'Gross', grossAvg: 'Gross Avg',
                                margin: 'Margin', marginAvg: 'Margin Avg',
                                total_miles: 'Total Miles', total_milesAvg: 'Total Miles Avg',
                                loaded_miles: 'Loaded Miles', loaded_milesAvg: 'Loaded Miles Avg',
                                dh: 'DH', dhAvg: 'DH Avg',
                                driverPay: 'Net Pay', driverPayAvg: 'Net Pay Avg',
                                insuranceExp: 'Ins. Exp.', insuranceExpAvg: 'Ins. Exp. Avg',
                                fuel: 'Fuel', fuelAvg: 'Fuel Avg',
                                wosFuel: 'SPOTTER FUEL', wosFuelAvg: 'SPOTTER FUEL Avg',
                                companyPay: 'Rev. Col.', companyPayAvg: 'Rev. Col. Avg',
                                pnlRevBase: 'Rev Base', pnlRevBaseAvg: 'Rev Base Avg',
                                pnlProrated: 'Rev Prorated', pnlProratedAvg: 'Rev Prorated Avg',
                                pnlZeroMiDrop: '0 Mi Cap', pnlZeroMiDropAvg: '0 Mi Cap Avg',
                                pnlTollsAdj: 'Tolls Adj', pnlTollsAdjAvg: 'Tolls Adj Avg',
                                pnlCashAdv: 'Cash Adv', pnlCashAdvAvg: 'Cash Adv Avg',
                                pnlCpmAdj: 'CPM Adj', pnlCpmAdjAvg: 'CPM Adj Avg',
                                pnlFuelAdj: 'Fuel Adj', pnlFuelAdjAvg: 'Fuel Adj Avg',
                                fullSharedLiability: 'Shared Ins', fullSharedLiabilityAvg: 'Shared Ins Avg',
                                fuelRebate: 'Fuel Reb.', fuelRebateAvg: 'Fuel Reb. Avg',
                                allocatedFixed: 'Wkly Exp.', allocatedFixedAvg: 'Wkly Exp. Avg',
                                tolls: 'Tolls', tollsAvg: 'Tolls Avg',
                                totalPOCov: 'PO', totalPOCovAvg: 'PO Avg',
                                dispatcherPay: 'Disp. Pay', dispatcherPayAvg: 'Disp. Pay Avg',
                                totalRecruiting: 'Recruiting', totalRecruitingAvg: 'Recruiting Avg',
                                netIncome: 'Total PnL', netIncomeAvg: 'Total PnL Avg'
                              };
                              return (
                              <button
                                key={m}
                                onClick={() => toggleSelection(selectedMetrics, m, setSelectedMetrics)}
                                className="w-full flex items-center justify-start gap-2 px-2 py-1.5 text-[10px] rounded hover:bg-zinc-800 text-zinc-300"
                              >
                                <input type="checkbox" checked={selectedMetrics.includes(m)} readOnly className="pointer-events-none rounded bg-zinc-950 border-zinc-700 accent-emerald-500" />
                                <span>{labels[m]}</span>
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
                           
                           <div className="px-1 mb-2">
                             <input
                               type="text"
                               placeholder="Search..."
                               value={entitiesSearchQuery}
                               onChange={(e) => setEntitiesSearchQuery(e.target.value)}
                               className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-300 font-sans text-[10px] focus:outline-none focus:border-emerald-500 placeholder:text-zinc-600"
                             />
                           </div>

                           <button
                              onClick={() => toggleSelection(selectedEntities, 'COMPANY', setSelectedEntities)}
                              className="w-full flex items-center justify-start gap-2 px-2 py-1.5 text-[10px] rounded hover:bg-zinc-800 text-zinc-300"
                           >
                              <input type="checkbox" checked={selectedEntities.includes('COMPANY')} readOnly className="pointer-events-none rounded bg-zinc-950 border-zinc-700 accent-emerald-500" />
                              <span>Total Company</span>
                           </button>

                           <div className="my-1 border-t border-zinc-800/50"></div>

                           {uniqueCompanies.filter(c => !entitiesSearchQuery || String(c).toLowerCase().startsWith(entitiesSearchQuery.toLowerCase())).length > 0 && (
                             <>
                              <div className="text-[9px] font-bold text-zinc-600 px-1 py-1">Companies</div>
                              {uniqueCompanies.filter(c => !entitiesSearchQuery || String(c).toLowerCase().startsWith(entitiesSearchQuery.toLowerCase())).map(company => (
                                <button
                                  key={company}
                                  onClick={() => toggleSelection(selectedEntities, company, setSelectedEntities)}
                                  className="w-full flex items-center justify-start gap-2 px-2 py-1.5 text-[10px] rounded hover:bg-zinc-800 text-zinc-300"
                                >
                                  <input type="checkbox" checked={selectedEntities.includes(company)} readOnly className="pointer-events-none rounded bg-zinc-950 border-zinc-700 accent-emerald-400" />
                                  <span>{company}</span>
                                </button>
                              ))}
                              <div className="my-1 border-t border-zinc-800/50"></div>
                             </>
                           )}

                           {uniqueContracts.filter(c => !entitiesSearchQuery || String(c).toLowerCase().startsWith(entitiesSearchQuery.toLowerCase())).length > 0 && (
                             <>
                              <div className="text-[9px] font-bold text-zinc-600 px-1 py-1">Contracts</div>
                              {uniqueContracts.filter(c => !entitiesSearchQuery || String(c).toLowerCase().startsWith(entitiesSearchQuery.toLowerCase())).map(contract => (
                                <button
                                  key={contract}
                                  onClick={() => toggleSelection(selectedEntities, contract, setSelectedEntities)}
                                  className="w-full flex items-center justify-start gap-2 px-2 py-1.5 text-[10px] rounded hover:bg-zinc-800 text-zinc-300"
                                >
                                  <input type="checkbox" checked={selectedEntities.includes(contract)} readOnly className="pointer-events-none rounded bg-zinc-950 border-zinc-700 accent-purple-400" />
                                  <span>{contract}</span>
                                </button>
                              ))}
                              <div className="my-1 border-t border-zinc-800/50"></div>
                             </>
                           )}
                           
                           {uniqueTeams.filter(c => !entitiesSearchQuery || String(c).toLowerCase().startsWith(entitiesSearchQuery.toLowerCase())).length > 0 && (
                             <>
                              <div className="text-[9px] font-bold text-zinc-600 px-1 py-1">Teams</div>
                              {uniqueTeams.filter(c => !entitiesSearchQuery || String(c).toLowerCase().startsWith(entitiesSearchQuery.toLowerCase())).map(team => (
                                <button
                                  key={team}
                                  onClick={() => toggleSelection(selectedEntities, team, setSelectedEntities)}
                                  className="w-full flex items-center justify-start gap-2 px-2 py-1.5 text-[10px] rounded hover:bg-zinc-800 text-zinc-300"
                                >
                                  <input type="checkbox" checked={selectedEntities.includes(team)} readOnly className="pointer-events-none rounded bg-zinc-950 border-zinc-700 accent-blue-500" />
                                  <span>{team}</span>
                                </button>
                              ))}
                              <div className="my-1 border-t border-zinc-800/50"></div>
                             </>
                           )}

                           {uniqueFranchises.filter(c => !entitiesSearchQuery || String(c).toLowerCase().startsWith(entitiesSearchQuery.toLowerCase())).length > 0 && (
                             <>
                              <div className="text-[9px] font-bold text-zinc-600 px-1 py-1">Franchises</div>
                              {uniqueFranchises.filter(c => !entitiesSearchQuery || String(c).toLowerCase().startsWith(entitiesSearchQuery.toLowerCase())).map(fran => (
                                <button
                                  key={fran}
                                  onClick={() => toggleSelection(selectedEntities, fran, setSelectedEntities)}
                                  className="w-full flex items-center justify-start gap-2 px-2 py-1.5 text-[10px] rounded hover:bg-zinc-800 text-zinc-300"
                                >
                                  <input type="checkbox" checked={selectedEntities.includes(fran)} readOnly className="pointer-events-none rounded bg-zinc-950 border-zinc-700 accent-amber-500" />
                                  <span>{fran}</span>
                                </button>
                              ))}
                              <div className="my-1 border-t border-zinc-800/50"></div>
                             </>
                           )}

                           {uniqueDrivers.filter(c => !entitiesSearchQuery || String(c).toLowerCase().startsWith(entitiesSearchQuery.toLowerCase())).length > 0 && (
                             <>
                              <div className="text-[9px] font-bold text-zinc-600 px-1 py-1">Drivers</div>
                              {uniqueDrivers.filter(c => !entitiesSearchQuery || String(c).toLowerCase().startsWith(entitiesSearchQuery.toLowerCase())).map(driver => (
                                <button
                                  key={driver}
                                  onClick={() => toggleSelection(selectedEntities, driver, setSelectedEntities)}
                                  className="w-full flex items-center justify-start gap-2 px-2 py-1.5 text-[10px] rounded hover:bg-zinc-800 text-zinc-300"
                                >
                                  <input type="checkbox" checked={selectedEntities.includes(driver)} readOnly className="pointer-events-none rounded bg-zinc-950 border-zinc-700 accent-rose-400" />
                                  <span>{driver}</span>
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

                <div className="flex bg-zinc-950 rounded border border-zinc-800 p-0.5 flex-shrink-0">
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
         <WeekOverWeekCard enrichedDrivers={enrichedDrivers} calculateMetrics={calculateMetrics} selectedDate={selectedDate} tableFilters={tableFilters} />
        </div>

        </div>

        {/* RIGHT COLUMN: Sidebar (Fixed Costs) */}
        <div className="w-full xl:w-80 flex flex-col gap-2 flex-shrink-0">
          
          {/* Fixed Expenses Card (New Format) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex-1 overflow-hidden flex flex-col min-h-[250px]">
             <div className="flex justify-between items-center mb-2 border-b border-zinc-800 pb-2 flex-shrink-0">
               <h4 className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                 <DollarSign size={12} className="text-emerald-500" /> Weekly Expenses
               </h4>
             </div>
             
             <div className="flex justify-between items-center gap-2 mb-3 bg-zinc-950/50 p-2 rounded border border-zinc-800/50 flex-shrink-0">
               <div className="flex items-center justify-center gap-2 w-1/2 border-r border-zinc-800/50 pr-2">
                  <Truck size={14} className="text-emerald-500" />
                  <span className="text-[11px] font-mono font-bold text-zinc-300">{Math.round(sidebarUtilization.nt)} / {sidebarUtilization.trucks}</span>
                  <span className="text-[10px] font-bold text-emerald-400">({formatPercentage(sidebarUtilization.trucks > 0 ? Math.min(100, (sidebarUtilization.nt / sidebarUtilization.trucks) * 100) : 0)})</span>
               </div>
               <div className="flex items-center justify-center gap-2 w-1/2 pl-2">
                  <Container size={14} className="text-emerald-500" />
                  <span className="text-[11px] font-mono font-bold text-zinc-300">{Math.round(sidebarUtilization.tr)} / {sidebarUtilization.trailers}</span>
                  <span className="text-[10px] font-bold text-emerald-400">({formatPercentage(sidebarUtilization.trailers > 0 ? Math.min(100, (sidebarUtilization.tr / sidebarUtilization.trailers) * 100) : 0)})</span>
               </div>
             </div>

             <div className="flex items-center px-1.5 mb-1 text-[9px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800/50 pb-1 flex-shrink-0">
               <div className="w-[50%] text-left">Name</div>
               <div className="w-[25%] text-center">Per Unit</div>
               <div className="w-[25%] text-right">Total</div>
             </div>

             <div className="overflow-y-auto flex-1 pr-1 space-y-1.5 pb-4">
                 
                 {(() => {
                    const sidebarTargetDate = selectedDate === 'ALL' || selectedDate === 'LATEST' ? latestPayDate : selectedDate;
                    const validFcRecordsSidebar = (fixedCostsData || []).filter(r => r.pay_date <= sidebarTargetDate).sort((a: any, b: any) => new Date(b.pay_date).getTime() - new Date(a.pay_date).getTime());
                    const fcSidebar = validFcRecordsSidebar.length > 0 ? validFcRecordsSidebar[0] : {};
                    
                    const validDatesSet = new Set(uniqueDates);
                    const weekAllDrivers = (allDrivers || drivers).filter(d => selectedDate === 'ALL' ? validDatesSet.has(d.payDate) : d.payDate === sidebarTargetDate);
                    
                    const globalNT = (() => {
                        let totalNt = 0;
                        const dates = selectedDate === 'ALL' ? Array.from(validDatesSet) : [sidebarTargetDate];
                        dates.forEach(dDate => {
                            const dateDrivers = weekAllDrivers.filter(d => d.payDate === dDate);
                            const map = new Map<string, { nt: number, count: number }>();
                            dateDrivers.forEach(d => {
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
                            totalNt += nt;
                        });
                        return totalNt || 1;
                    })();

                    const globalTr = (() => {
                        let totalTr = 0;
                        const dates = selectedDate === 'ALL' ? Array.from(validDatesSet) : [sidebarTargetDate];
                        dates.forEach(dDate => {
                            const dateDrivers = weekAllDrivers.filter(d => d.payDate === dDate);
                            const map = new Map<string, { tr: number, count: number }>();
                            dateDrivers.forEach(d => {
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
                            totalTr += tr;
                        });
                        return totalTr || 1;
                    })();

                    const filteredWeekDrivers = weekAllDrivers;

                    const sidebarGross = filteredWeekDrivers.reduce((sum, d) => sum + (d.grossRevenue || 0) + (d.marginAmount || 0), 0);
                    const sidebarAvgTruckPrice = sidebarTargetDate && finImportByDate[sidebarTargetDate as string] ? finImportByDate[sidebarTargetDate as string].avgTruckPrice : 0;

                    const filteredNT = filteredWeekDrivers.reduce((sum, d) => sum + (d.effectiveNonTeams || 0), 0);

                    const filteredTr = filteredWeekDrivers.reduce((sum, d) => sum + ((d as any).effectiveTrailers || 0), 0);
                    
                    const filteredTruckNT = filteredWeekDrivers.filter(d => d.contractType !== 'OO').reduce((sum, d) => sum + (d.effectiveNonTeams || 0), 0);

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

                    const handleTooltipMove = (e: React.MouseEvent) => {
                        const tooltip = e.currentTarget.querySelector('.dynamic-tooltip') as HTMLElement;
                        if (tooltip) {
                            const x = e.clientX;
                            const y = e.clientY;
                            const vh = window.innerHeight;
                            const vw = window.innerWidth;
                            const percentY = (y / vh) * 100;
                            tooltip.style.top = `${y}px`;
                            tooltip.style.bottom = 'auto';
                            tooltip.style.left = 'auto';
                            tooltip.style.right = `${vw - x + 15}px`;
                            tooltip.style.transform = `translateY(-${percentY}%)`;
                            tooltip.style.maxHeight = '90vh';
                            tooltip.style.overflowY = 'auto';
                        }
                    };
                    const renderRow = (label: string, globalKey: string, customKey?: string, isPercent: boolean = false, multiplier: number = filteredNT, valTooltip?: any, totalTooltip?: any, customVal?: number, customTotal?: number) => {
    const val = customVal !== undefined ? customVal : getSidebarVal(globalKey, customKey);
    if (val === 0) return null;
    
    let total = customTotal !== undefined ? customTotal : 0;
    if (customTotal === undefined) {
        if (isPercent) {
            total = sidebarGross * (val / 100);
        } else {
            total = val * multiplier;
        }
    }

    const isProfit = val < 0;
    const isTotalProfit = total < 0;

    return (
        <div key={label} className="flex items-center p-1.5 hover:bg-zinc-800/20 transition-colors relative">
           <div className="w-[50%] text-left pr-2">
             <span className="text-[10px] text-zinc-300 block truncate">{label}</span>
           </div>
        <div className="w-[25%] text-center">
                         <div className="relative group/tooltip inline-block" onMouseMove={handleTooltipMove}>
                            <span className={`text-[10px] font-mono font-bold transition-colors duration-200 ${valTooltip ? 'cursor-help text-sky-400/80 hover:text-sky-300' : 'text-sky-400/80'}`}>
                              {isPercent 
                                  ? `${isProfit ? '+' : '-'}${Math.abs(val)}%` 
                                  : `${isProfit ? '+' : '-'}${label.includes('General') ? `$${Math.abs(val).toFixed(2)}` : ((label.includes('Trailer Interchange') || label === 'LAGO') && Math.abs(val) < 1 ? `$${Math.abs(val).toFixed(2)}` : formatCurrency(Math.abs(val)))}`}
                            </span>
                            {valTooltip && (
                               <div className="hidden group-hover/tooltip:block fixed z-[9999] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl normal-case font-normal border border-zinc-700 pointer-events-none dynamic-tooltip w-max">
                                  {valTooltip}
                               </div>
                            )}
                         </div>
                       </div>
               <div className="w-[25%] text-right">
                         <div className="relative group/tooltip inline-block" onMouseMove={handleTooltipMove}>
                            <span className={`text-[10px] font-mono font-bold transition-colors duration-200 ${totalTooltip ? 'cursor-help text-zinc-400 hover:text-zinc-300' : 'text-zinc-400'}`}>
                              {isTotalProfit ? `+${formatCurrency(Math.abs(total))}` : `-${formatCurrency(Math.abs(total))}`}
                            </span>
                            {totalTooltip && (
                           <div className="hidden group-hover/tooltip:block fixed z-[9999] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl normal-case font-normal border border-zinc-700 pointer-events-none dynamic-tooltip w-max">
                              {totalTooltip}
                           </div>
                        )}
                     </div>
           </div>
        </div>
    );
};

                    const getRowTotal = (globalKey: string, customKey?: string, isPercent: boolean = false, multiplier: number = filteredNT) => {
                        const val = getSidebarVal(globalKey, customKey);
                        if (val === 0) return 0;
                        if (isPercent) return sidebarGross * (val / 100);
                        return val * multiplier;
                    };

                   let specCosts = fcSidebar.company_specific_costs;
                    if (typeof specCosts === 'string') {
                        try { specCosts = JSON.parse(specCosts); } catch(e) { specCosts = []; }
                    }
                    if (!Array.isArray(specCosts)) specCosts = [];

                    const uniqueCompsInWeek = Array.from(new Set(weekAllDrivers.map(d => d.companyId))).filter(c => c && c !== 'Unassigned' && c !== 'UNRECONCILED') as string[];
                    const activeCompsInWeek = Array.from(new Set(filteredWeekDrivers.map(d => d.companyId))).filter(c => c && c !== 'Unassigned' && c !== 'UNRECONCILED') as string[];

                    const getDetailedExpenseTotal = (expName: string, fallbackExpName?: string) => {
                                            let weeklySum = 0;
                                            const breakdown: { company: string, literal: number, frequency: string, weekly: number }[] = [];

                                            const currTimeForComps = (sidebarTargetDate ? new Date(sidebarTargetDate as string).getTime() : Date.now()) - (3 * 24 * 60 * 60 * 1000);
                                            const specificExps = fixedExpenses.filter(e =>
                                                (e.name.toLowerCase().includes(expName.toLowerCase()) || (fallbackExpName && e.name.toLowerCase().includes(fallbackExpName.toLowerCase()))) && 
                                                e.companyId && e.companyId !== 'ALL' && e.companyId !== 'UNRECONCILED' &&
                                                (!e.valid_from || new Date(e.valid_from).getTime() <= currTimeForComps) &&
                                                (!e.valid_to || new Date(e.valid_to).getTime() >= currTimeForComps)
                                            );
                                            const specCostsComps = Array.isArray(specCosts) ? specCosts.filter((el: any) => el.company_id && ((el.expense_name || '').toLowerCase().includes(expName.toLowerCase()) || (fallbackExpName && (el.expense_name || '').toLowerCase().includes(fallbackExpName.toLowerCase())))).map((el: any) => el.company_id) : [];
                                            const compsForThisExp = Array.from(new Set([...activeCompsInWeek, ...specificExps.map(e => e.companyId), ...specCostsComps])) as string[];

                                            compsForThisExp.forEach(compId => {
                                                const nt = filteredWeekDrivers.filter(d => d.companyId === compId).reduce((sum, d) => sum + (d.effectiveNonTeams || 0), 0);
                                                const tr = filteredWeekDrivers.filter(d => d.companyId === compId).reduce((sum, d) => sum + ((d as any).effectiveTrailers || 0), 0);
                                                const hasDrivers = nt > 0 || tr > 0;
                                                const hasSpecificExp = specificExps.some(e => e.companyId === compId) || specCostsComps.includes(compId);
                                                
                                                if (!hasDrivers && !hasSpecificExp) return;

                                                let { amount, exp } = getActiveAmount(expName, sidebarTargetDate as string | null, compId, uniqueCompsInWeek.length);
                                                if (amount === 0 && !exp && fallbackExpName) {
                                                    const fallback = getActiveAmount(fallbackExpName, sidebarTargetDate as string | null, compId, uniqueCompsInWeek.length);
                                                    amount = fallback.amount;
                                                    exp = fallback.exp;
                                                }

                                                let weekly = amount;
                                                if (exp?.valid_from && exp?.valid_to) {
                                                    const dFrom = new Date(exp.valid_from);
                                                    const dTo = new Date(exp.valid_to);
                                                    const daysDiff = ((dTo.getTime() - dFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                                    if (daysDiff > 0) weekly = amount / (daysDiff / 7);
                                                } else if (exp?.frequency === 'Annually') {
                                                    weekly = amount / 52;
                                                } else if (exp?.frequency === 'Monthly') {
                                                    weekly = amount / 4.33;
                                                }

                                                if (amount > 0 || hasSpecificExp) {
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
                    const getDetailedExpensePerUnit = (expNameKeyword: string, globalAmt: number = 0) => {
                        let sumPerUnit = 0;
                        const breakdown: { company: string, perUnit: number }[] = [];

                        const currTimeForComps = (sidebarTargetDate ? new Date(sidebarTargetDate as string).getTime() : Date.now()) - (3 * 24 * 60 * 60 * 1000);
                        
                        const globalExpRule = fixedExpenses.find(e => 
                            e.name.toLowerCase().includes(expNameKeyword.toLowerCase()) && 
                            e.companyId === 'ALL' &&
                            (!e.valid_from || new Date(e.valid_from).getTime() <= currTimeForComps) &&
                            (!e.valid_to || new Date(e.valid_to).getTime() >= currTimeForComps)
                        );

                        let resolvedGlobalAmt = globalAmt;
                        if (globalExpRule && globalExpRule.amount !== undefined) {
                            let weekly = globalExpRule.amount;
                            if (globalExpRule.valid_from && globalExpRule.valid_to) {
                                const dFrom = new Date(globalExpRule.valid_from);
                                const dTo = new Date(globalExpRule.valid_to);
                                const daysDiff = ((dTo.getTime() - dFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                if (daysDiff > 0) weekly = globalExpRule.amount / (daysDiff / 7);
                            } else if (globalExpRule.frequency === 'Annually') {
                                weekly = globalExpRule.amount / 52;
                            } else if (globalExpRule.frequency === 'Monthly') {
                                weekly = globalExpRule.amount / 4.33;
                            }
                            resolvedGlobalAmt = Math.abs(weekly);
                        }

                        const specificExps = fixedExpenses.filter(e =>
                            e.name.toLowerCase().includes(expNameKeyword.toLowerCase()) && 
                            e.companyId && e.companyId !== 'ALL' && e.companyId !== 'UNRECONCILED' &&
                            (!e.valid_from || new Date(e.valid_from).getTime() <= currTimeForComps) &&
                            (!e.valid_to || new Date(e.valid_to).getTime() >= currTimeForComps)
                        );

                        const specComps = Array.isArray(specCosts) ? specCosts.filter((el: any) => el.company_id && (el.expense_name || '').toLowerCase().includes(expNameKeyword.toLowerCase())).map((el: any) => el.company_id) : [];
                        const compsToCheck = Array.from(new Set([...activeCompsInWeek, ...specComps, ...specificExps.map(e => e.companyId)])) as string[];

                        compsToCheck.forEach(compId => {
                            let amt = resolvedGlobalAmt;
                            let hasSpecific = false;
                            if (specCosts && Array.isArray(specCosts)) {
                                const compRule = specCosts.find((el: any) =>
                                    (el.company_id || '').replace(/\s+/g, '').toLowerCase() === compId.replace(/\s+/g, '').toLowerCase() &&
                                    (el.expense_name || '').toLowerCase().includes(expNameKeyword.toLowerCase())
                                );
                                if (compRule && compRule.amount !== undefined && compRule.amount !== null && String(compRule.amount).trim() !== '') {
                                    amt = Math.abs(Number(compRule.amount));
                                    hasSpecific = true;
                                }
                            }
                            const expRule = specificExps.find(e => e.companyId === compId);
                            if (!hasSpecific && expRule && expRule.amount !== undefined) {
                                let weekly = expRule.amount;
                                if (expRule.valid_from && expRule.valid_to) {
                                    const dFrom = new Date(expRule.valid_from);
                                    const dTo = new Date(expRule.valid_to);
                                    const daysDiff = ((dTo.getTime() - dFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                    if (daysDiff > 0) weekly = expRule.amount / (daysDiff / 7);
                                } else if (expRule.frequency === 'Annually') {
                                    weekly = expRule.amount / 52;
                                } else if (expRule.frequency === 'Monthly') {
                                    weekly = expRule.amount / 4.33;
                                }
                                amt = Math.abs(weekly);
                                hasSpecific = true;
                            }

                            const hasDrivers = activeCompsInWeek.includes(compId);
                            if (amt > 0 && (hasDrivers || hasSpecific)) {
                                if (hasDrivers) sumPerUnit += amt;
                                breakdown.push({ company: compId, perUnit: amt });
                            }
                        });

                        const averagePerUnit = activeCompsInWeek.length > 0 ? sumPerUnit / activeCompsInWeek.length : 0;
                        return { averagePerUnit, breakdown };
                    };
                    const buildPerUnitTooltip = (title: string, rawBreakdown: any[], showDecimals: boolean = false) => {
    const breakdown = rawBreakdown.filter(b => {
        if (!b.company || b.company === 'Unassigned' || b.company === 'UNRECONCILED') return false;
        const unitVal = b.tr !== undefined ? b.tr : b.nt;
        if (unitVal !== undefined && unitVal < 0.14) return false;
        return b.perUnit !== 0;
    });
    if (breakdown.length === 0) return null;
    const hasUnit = breakdown.some(b => b.nt !== undefined || b.tr !== undefined);
    const hasGross = breakdown.some(b => b.gross !== undefined);
    const unitName = breakdown.some(b => b.tr !== undefined) ? 'Eff Trailers' : 'Eff Non-Teams';
    return (
        <div className="flex flex-col w-max min-w-[290px] text-left">
            <div className="text-emerald-400 font-bold mb-1 border-b border-zinc-700 pb-0.5">{title}</div>
            <div className="text-[9px] text-zinc-400 mb-2 leading-tight">Average amounts:</div>
            
            {(hasUnit || hasGross) && (
                <div className={`grid ${hasGross ? 'grid-cols-[1fr_75px_85px_70px]' : (hasUnit ? 'grid-cols-[1fr_85px_70px]' : 'grid-cols-[1fr_70px]')} gap-2 items-center mb-1 border-b border-zinc-700/50 pb-1`}>
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider whitespace-nowrap">Name</span>
                    {hasGross && <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider text-right whitespace-nowrap">Total Gross</span>}
                    {hasUnit && <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider text-right whitespace-nowrap">{unitName}</span>}
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider text-right whitespace-nowrap">Amount</span>
                </div>
            )}
            <div className="flex flex-col gap-1">
                {breakdown.map((b: any, i: number) => {
                    const unitVal = b.tr !== undefined ? b.tr : b.nt;
                    return (
                        <div key={i} className={`grid ${hasGross ? 'grid-cols-[1fr_75px_85px_70px]' : (hasUnit ? 'grid-cols-[1fr_85px_70px]' : 'grid-cols-[1fr_70px]')} gap-2 items-center`}>
                            <span className="text-[10px] text-zinc-300 truncate">{b.company}</span>
                            {hasGross && <span className="text-[10px] text-zinc-400 font-mono tabular-nums text-right">{formatCurrency(b.gross)}</span>}
                            {hasUnit && <span className="text-[10px] text-zinc-400 font-mono tabular-nums text-right">{unitVal !== undefined ? unitVal.toFixed(1) : ''}</span>}
                            <span className="text-[10px] text-zinc-200 font-bold font-mono tabular-nums text-right">
                                {unitVal < 0.14 ? '' : (b.perUnit < 0 ? '+' : '-')}{showDecimals ? `$${Math.abs(unitVal < 0.14 ? 0 : b.perUnit).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}` : ((title.includes('Trailer Interchange') || title === 'LAGO') && Math.abs(unitVal < 0.14 ? 0 : b.perUnit) < 1 ? `$${Math.abs(unitVal < 0.14 ? 0 : b.perUnit).toFixed(2)}` : formatCurrency(Math.abs(unitVal < 0.14 ? 0 : b.perUnit)))}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const buildTotalTooltip = (title: string, rawBreakdown: any[]) => {
    const breakdown = rawBreakdown.filter(b => b.company && b.company !== 'Unassigned' && b.company !== 'UNRECONCILED' && b.weekly !== 0);
    if (breakdown.length === 0) return null;
    return (
        <div className="flex flex-col w-max min-w-[160px] text-left">
            <div className="text-sky-400 font-bold mb-1 border-b border-zinc-700 pb-0.5">{title}</div>
            <div className="text-[9px] text-zinc-400 mb-2 leading-tight">Total weekly expenses:</div>
            
            <div className="grid grid-cols-[1fr_70px] gap-2 items-center mb-1 border-b border-zinc-700/50 pb-1">
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider whitespace-nowrap">Name</span>
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider text-right whitespace-nowrap">Total</span>
            </div>
            
            <div className="flex flex-col gap-1">
                {breakdown.map((b: any, i: number) => {
                    return (
                        <div key={i} className="grid grid-cols-[1fr_70px] gap-2 items-center">
                            <span className="text-[10px] text-zinc-300 truncate">{b.company}</span>
                            <span className="text-[10px] text-zinc-200 font-bold font-mono tabular-nums text-right">
                                {b.weekly < 0 ? '+' : '-'}{formatCurrency(Math.abs(b.weekly))}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

                    const getLiabilityAutoBreakdown = () => {
                                                  const puBreakdown: { company: string, perUnit: number }[] = [];
                                                  const totalBreakdown: { company: string, literal: number, frequency: string, weekly: number }[] = [];
                                                  let totalWeekly = 0;
                                                  let totalNTAllComps = 0;

                                                  const parseDateSafelyLocal = (dStr: string) => {
                                                       if (!dStr) return 0;
                                                       const dt = new Date(dStr);
                                                       return dt.getTime();
                                                  };
                                                  const cTime = (sidebarTargetDate ? parseDateSafelyLocal(sidebarTargetDate as string) : Date.now()) - (3 * 24 * 60 * 60 * 1000);
                                                  const specInsComps = Array.isArray(specCosts) ? specCosts.filter((el: any) => el.company_id && (el.expense_name || '').toLowerCase().includes('liability insurance (auto)')).map((el: any) => el.company_id) : [];
                                                  const insuranceActiveComps = Array.from(new Set([
                                                      ...activeCompsInWeek,
                                                      ...specInsComps,
                                                      ...fixedExpenses.filter(e => 
                                                          (e.name.toLowerCase().includes('insurance') || e.name.toLowerCase().includes('pd premium')) && 
                                                          e.companyId !== 'ALL' &&
                                                          (!e.valid_from || new Date(e.valid_from).getTime() <= cTime) && 
                                                          (!e.valid_to || new Date(e.valid_to).getTime() >= cTime)
                                                      ).map(e => e.companyId)
                                                  ])).filter(c => c && c !== 'ALL' && c !== 'Unassigned' && c !== 'UNRECONCILED');

                                                  insuranceActiveComps.forEach(compId => {
                                                      const compDrivers = filteredWeekDrivers.filter(d => d.companyId === compId);
                                                  
                                                  let totalCompanyLiability = 0;
                                                  let totalCompNT = 0;
                                                  
                                                  let amount: number | null = null;
                                                  if (specCosts && Array.isArray(specCosts)) {
                                                      const compRule = specCosts.find((el: any) =>
                                                          (el.company_id || '').replace(/\s+/g, '').toLowerCase() === (compId || '').replace(/\s+/g, '').toLowerCase() &&
                                                          (el.expense_name || '').toLowerCase().includes('liability insurance (auto)')
                                                      );
                                                      if (compRule && compRule.amount !== undefined && compRule.amount !== null && String(compRule.amount).trim() !== '') {
                                                          amount = Math.abs(Number(compRule.amount));
                                                      }
                                                  }
                                                  if (amount === null) {
                                                      const currentCompTime = (sidebarTargetDate ? new Date(sidebarTargetDate as string).getTime() : Date.now()) - (3 * 24 * 60 * 60 * 1000);
                                                      const expRule = fixedExpenses.find(e => (e.name === 'Liability Insurance (Auto)' || e.name === 'Liability Insurance') && e.companyId === compId && (!e.valid_from || new Date(e.valid_from).getTime() <= currentCompTime) && (!e.valid_to || new Date(e.valid_to).getTime() >= currentCompTime));
                                                      if (expRule && expRule.amount !== undefined) {
                                                          let weekly = expRule.amount;
                                                          if (expRule.frequency === 'Annually') weekly = expRule.amount / 52;
                                                          else if (expRule.frequency === 'Monthly') weekly = expRule.amount / 4.33;
                                                          amount = Math.abs(weekly);
                                                      }
                                                  }
                                                  if (amount === null && fcSidebar['liability_insurance_custom'] !== undefined && fcSidebar['liability_insurance_custom'] !== null && String(fcSidebar['liability_insurance_custom']).trim() !== '') {
                                                      amount = Math.abs(Number(fcSidebar['liability_insurance_custom']));
                                                  }
                                                  if (amount === null && fcSidebar['liability_insurance'] !== undefined && fcSidebar['liability_insurance'] !== null && String(fcSidebar['liability_insurance']).trim() !== '') {
                                                      amount = Math.abs(Number(fcSidebar['liability_insurance']));
                                                  }
                                                  const baseLiabilityAuto = amount || 0;
                                                  
                                                  const parseDateSafely = (dStr: string) => {
                                                       if (!dStr) return 0;
                                                       const dt = new Date(dStr);
                                                       return dt.getTime();
                                                  };
                                                  const currTime = (sidebarTargetDate ? parseDateSafely(sidebarTargetDate as string) : Date.now()) - (3 * 24 * 60 * 60 * 1000);
                                                  
                                                  compDrivers.forEach(d => {
                                                      const effNT = d.effectiveNonTeams || 0;
                                                      if (effNT <= 0) return;
                                                      
                                                      totalCompNT += effNT;
                                                      totalCompanyLiability += baseLiabilityAuto * effNT;
                                                  });
                                                  
                                                  if (baseLiabilityAuto === 0) return;

                                                  const parseDateSafelyLocal2 = (dStr: string) => {
                                                       if (!dStr) return 0;
                                                       const dt = new Date(dStr);
                                                       return dt.getTime();
                                                  };
                                                  const targetCTime = (sidebarTargetDate ? parseDateSafelyLocal2(sidebarTargetDate as string) : Date.now()) - (3 * 24 * 60 * 60 * 1000);
                                                  
                                                  let weeksDivider = 52;
                                                  const expRule = fixedExpenses.find(e => e.name.includes('Liability Insurance') && (e.companyId === compId || e.companyId === 'ALL') && (!e.valid_from || new Date(e.valid_from).getTime() <= targetCTime) && (!e.valid_to || new Date(e.valid_to).getTime() >= targetCTime));
                                                  if (expRule && expRule.valid_from && expRule.valid_to) {
                                                      const dFrom = new Date(expRule.valid_from);
                                                      const dTo = new Date(expRule.valid_to);
                                                      const daysDiff = ((dTo.getTime() - dFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                                      if (daysDiff > 0) weeksDivider = daysDiff / 7;
                                                  }

                                                  let effPerUnit = 0;
                                                  let finalWeekly = 0;

                                                  if (totalCompNT >= 0.14) {
                                                      effPerUnit = totalCompanyLiability / totalCompNT;
                                                      finalWeekly = totalCompanyLiability;
                                                  } else {
                                                      effPerUnit = 0;
                                                      finalWeekly = baseLiabilityAuto / weeksDivider;
                                                  }

                                                  puBreakdown.push({ company: compId, perUnit: effPerUnit });
                                                  totalBreakdown.push({ company: compId, literal: baseLiabilityAuto, frequency: 'Weekly', weekly: finalWeekly });
                                                  totalWeekly += finalWeekly;
                                                  totalNTAllComps += totalCompNT;
                                              });
                                              
                                              const tooltipSum = puBreakdown.reduce((sum, b) => sum + b.perUnit, 0);
                                              return {
                                                  averagePerUnit: activeCompsInWeek.length > 0 ? tooltipSum / activeCompsInWeek.length : 0,
                                                  totalWeekly,
                                                  puBreakdown,
                                                  totalBreakdown
                                              };
                                         };

                                         const liabAutoStats = getLiabilityAutoBreakdown();
                                         const liabAutoData = { weeklySum: liabAutoStats.totalWeekly, breakdown: liabAutoStats.totalBreakdown };
                                         const liabAutoPU = { averagePerUnit: liabAutoStats.averagePerUnit, breakdown: liabAutoStats.puBreakdown };
                                         
                                         const liabGenData = getDetailedExpenseTotal('Liability Insurance (General)');
                                         const liabGenPU = getDetailedExpensePerUnit('Liability Insurance (General)', 0);
                                         
                                         const cargoData = getDetailedExpenseTotal('Cargo Insurance');
                                         const cargoPU = getDetailedExpensePerUnit('Cargo Insurance', getSidebarVal('cargo_insurance', 'cargo_insurance_custom'));
                                         
                                         const trailerInterchangeData = getDetailedExpenseTotal('Trailer Interchange');
                                         const trailerInterchangePU = getDetailedExpensePerUnit('Trailer Interchange', getSidebarVal('trailer_interchange', 'trailer_interchange_custom'));
                                         
                                         const lagoData = getDetailedExpenseTotal('LAGO');
                                         const lagoPU = getDetailedExpensePerUnit('LAGO', getSidebarVal('lago', 'lago_custom'));
                                         
                                         const pdPremiumData = getDetailedExpenseTotal('PD Premium');
                                   const pdPremiumPU = getDetailedExpensePerUnit('PD Premium', getSidebarVal('pd_premium', 'pd_premium_custom'));

                                   const pdData = getDetailedExpenseTotal('Physical Damage');
                                         const pdPU = getDetailedExpensePerUnit('Physical Damage', getSidebarVal('physical_damage', 'physical_damage_custom'));

                                         const getCompNT = (compId: string) => filteredWeekDrivers.filter(d => d.companyId === compId).reduce((sum, d) => sum + (d.effectiveNonTeams || 0), 0);
                    const getCompTruckNT = (compId: string) => filteredWeekDrivers.filter(d => d.companyId === compId && d.contractType !== 'OO').reduce((sum, d) => sum + (d.effectiveNonTeams || 0), 0);
                    const getCompTr = (compId: string) => filteredWeekDrivers.filter(d => d.companyId === compId).reduce((sum, d) => sum + ((d as any).effectiveTrailers || 0), 0);

                    const liabAutoPUBreakdown = liabAutoPU.breakdown.map(b => ({ company: b.company, perUnit: b.perUnit, nt: getCompNT(b.company) }));
                    const liabAutoPUTooltip = buildPerUnitTooltip('Liability Insurance (Auto)', liabAutoPUBreakdown);
                    const liabAutoTotalBreakdown = liabAutoData.breakdown.map((b: any) => ({ company: b.company, weekly: b.weekly, nt: getCompNT(b.company) }));
                    const liabAutoTotalTooltip = buildTotalTooltip('Liability Insurance (Auto)', liabAutoTotalBreakdown);

                    const liabGenPUBreakdown = liabGenPU.breakdown.map(b => ({ company: b.company, perUnit: b.perUnit, nt: getCompNT(b.company) }));
                    const liabGenPUTooltip = buildPerUnitTooltip('Liability Insurance (General)', liabGenPUBreakdown, true);
                    const liabGenTotalBreakdown = liabGenPU.breakdown.map(b => { const nt = getCompNT(b.company); return { company: b.company, weekly: nt >= 0.14 ? b.perUnit * nt : b.perUnit, nt }; });
                    const liabGenTotalTooltip = buildTotalTooltip('Liability Insurance (General)', liabGenTotalBreakdown);

                    const cargoPUBreakdown = cargoPU.breakdown.map(b => ({ company: b.company, perUnit: b.perUnit, nt: getCompNT(b.company) }));
                    const cargoPUTooltip = buildPerUnitTooltip('Cargo Insurance', cargoPUBreakdown);
                    const cargoTotalBreakdown = cargoPU.breakdown.map(b => {
    const nt = getCompNT(b.company);
    return { company: b.company, weekly: nt >= 0.14 ? b.perUnit * nt : b.perUnit, nt };
});
const cargoTotalTooltip = buildTotalTooltip('Cargo Insurance', cargoTotalBreakdown);

const leaseGapPU = getDetailedExpensePerUnit('Lease Gap Coverage', getSidebarVal('lease_gap_coverage', 'lease_gap_coverage_custom'));
const leaseGapPUBreakdown = leaseGapPU.breakdown.map(b => ({ company: b.company, perUnit: b.perUnit, nt: getCompNT(b.company) }));
const leaseGapPUTooltip = buildPerUnitTooltip('Lease Gap Coverage', leaseGapPUBreakdown);
const leaseGapTotalBreakdown = leaseGapPU.breakdown.map(b => {
    const nt = getCompNT(b.company);
    return { company: b.company, weekly: nt >= 0.14 ? b.perUnit * nt : b.perUnit, nt };
});
const leaseGapTotalTooltip = buildTotalTooltip('Lease Gap Coverage', leaseGapTotalBreakdown);

const trailerInterchangePUBreakdown = trailerInterchangePU.breakdown.map(b => ({ company: b.company, perUnit: b.perUnit, nt: getCompNT(b.company) }));
                    const trailerInterchangePUTooltip = buildPerUnitTooltip('Trailer Interchange', trailerInterchangePUBreakdown);
                    const trailerInterchangeTotalBreakdown = trailerInterchangePU.breakdown.map(b => { const nt = getCompNT(b.company); return { company: b.company, weekly: nt >= 0.14 ? b.perUnit * nt : b.perUnit, nt }; });
                    const trailerInterchangeTotalTooltip = buildTotalTooltip('Trailer Interchange', trailerInterchangeTotalBreakdown);

                    const lagoPUBreakdown = lagoPU.breakdown.map(b => { const nt = getCompNT(b.company); return { company: b.company, perUnit: filteredNT > 0 ? b.perUnit / filteredNT : 0, nt }; });
                    const lagoPUTooltip = buildPerUnitTooltip('LAGO', lagoPUBreakdown);
                    const lagoTotalBreakdown = lagoPU.breakdown.map(b => { const nt = getCompNT(b.company); return { company: b.company, weekly: filteredNT > 0 ? b.perUnit * (nt / filteredNT) : 0, nt }; });
                    const lagoTotalTooltip = buildTotalTooltip('LAGO', lagoTotalBreakdown);

                    const pdPremiumPUBreakdown = pdPremiumPU.breakdown.map(b => ({ company: b.company, perUnit: b.perUnit, nt: getCompNT(b.company) }));
                    const pdPremiumPUTooltip = buildPerUnitTooltip('PD Premium', pdPremiumPUBreakdown);
                    const pdPremiumTotalBreakdown = pdPremiumPU.breakdown.map(b => { const nt = getCompNT(b.company); return { company: b.company, weekly: nt >= 0.14 ? b.perUnit * nt : b.perUnit, nt }; });
                    const pdPremiumTotalTooltip = buildTotalTooltip('PD Premium', pdPremiumTotalBreakdown);

                    const pdTruckPUBreakdown = pdPU.breakdown.map(b => ({ company: b.company, perUnit: b.perUnit, nt: getCompTruckNT(b.company) }));
                    const pdTruckPUTooltip = buildPerUnitTooltip('Physical Damage (Truck)', pdTruckPUBreakdown);
                    const pdTruckTotalBreakdown = pdPU.breakdown.map(b => { const nt = getCompTruckNT(b.company); return { company: b.company, weekly: nt >= 0.14 ? b.perUnit * nt : b.perUnit, nt }; });
                    const pdTruckTotalTooltip = buildTotalTooltip('Physical Damage (Truck)', pdTruckTotalBreakdown);

                    const pdTrailerPUBreakdown = pdPU.breakdown.map(b => ({ company: b.company, perUnit: b.perUnit / 4, tr: getCompTr(b.company) }));
                    const pdTrailerTotalBreakdown = pdTrailerPUBreakdown.map(b => { const tr = getCompTr(b.company); return { company: b.company, weekly: tr >= 0.14 ? b.perUnit * tr : b.perUnit, tr }; });
                    const pdTrailerPUTooltip = buildPerUnitTooltip('Physical Damage (Trailer)', pdTrailerPUBreakdown);
                    const pdTrailerTotalTooltip = buildTotalTooltip('Physical Damage (Trailer)', pdTrailerTotalBreakdown);

                    let finalLiabAutoTotal = liabAutoTotalBreakdown.reduce((sum, b) => sum + b.weekly, 0);
                    let finalLiabAutoPerUnit = filteredNT > 0 ? finalLiabAutoTotal / filteredNT : 0;

                    const finalLiabGenTotal = liabGenTotalBreakdown.reduce((sum, b) => sum + b.weekly, 0);
                    const finalLiabGenPerUnit = filteredNT > 0 ? finalLiabGenTotal / filteredNT : 0;

                    const finalCargoTotal = cargoTotalBreakdown.reduce((sum, b) => sum + b.weekly, 0);
const finalCargoPerUnit = filteredNT > 0 ? finalCargoTotal / filteredNT : 0;

const finalLeaseGapTotal = leaseGapTotalBreakdown.reduce((sum, b) => sum + b.weekly, 0);
const finalLeaseGapPerUnit = filteredNT > 0 ? finalLeaseGapTotal / filteredNT : 0;

const finalTrailerInterchangeTotal = trailerInterchangeTotalBreakdown.reduce((sum, b) => sum + b.weekly, 0);
const finalTrailerInterchangePerUnit = filteredNT > 0 ? finalTrailerInterchangeTotal / filteredNT : 0;

                    const finalLagoTotal = lagoTotalBreakdown.reduce((sum, b) => sum + b.weekly, 0);
                    const finalLagoPerUnit = filteredNT > 0 ? finalLagoTotal / filteredNT : 0;

                    const finalPdPremiumTotal = pdPremiumTotalBreakdown.reduce((sum, b) => sum + b.weekly, 0);
                    const finalPdPremiumPerUnit = filteredNT > 0 ? finalPdPremiumTotal / filteredNT : 0;

                    const finalPdTruckTotal = pdTruckTotalBreakdown.reduce((sum, b) => sum + b.weekly, 0);
                    const finalPdTruckPerUnit = filteredTruckNT > 0 ? finalPdTruckTotal / filteredTruckNT : 0;

                    const finalPdTrailerTotal = pdTrailerTotalBreakdown.reduce((sum, b) => sum + b.weekly, 0);
                    const finalPdTrailerPerUnit = filteredTr > 0 ? finalPdTrailerTotal / filteredTr : 0;

                    const insPerUnitTotal = finalLiabAutoPerUnit + finalLiabGenPerUnit + finalCargoPerUnit + finalLeaseGapPerUnit + finalTrailerInterchangePerUnit + finalPdPremiumPerUnit + finalPdTruckPerUnit + finalPdTrailerPerUnit;
                    const insTotal = finalLiabAutoTotal + finalLiabGenTotal + finalCargoTotal + finalLeaseGapTotal + finalTrailerInterchangeTotal + finalPdPremiumTotal + finalPdTruckTotal + finalPdTrailerTotal;
                    
                    const otherPerUnitTotal = finalLagoPerUnit;
                    const otherTotal = finalLagoTotal;
                    
                    const adminItems = [
                       { label: 'Phone & Internet', keyword: 'Phone & Internet', gk: 'phone_and_internet', ck: 'phone_and_internet_custom' },
                       { label: 'Office Supplies', keyword: 'Office Supplies', gk: 'office_supplies', ck: 'office_supplies_custom' },
                       { label: 'Telematics', keyword: 'Telematics', gk: 'telematics', ck: 'telematics_custom' },
                       { label: 'Rent & Parking', keyword: 'Rent & Parking', gk: 'rent_and_parking', ck: 'rent_and_parking_custom' },
                       { label: 'Backup MCs', keyword: 'Backup MC', gk: 'backup_mc', ck: 'backup_mc_custom' },
                       { label: 'Back Office Pay', keyword: 'Back Office Pay', gk: 'backoffice_reg', ck: 'backoffice_reg_custom' },
                       { label: 'Tech Pay', keyword: 'Tech Pay', gk: 'backoffice_tech', ck: 'backoffice_tech_custom' }
                    ].map(item => {
                       const isTelematics = item.label === 'Telematics';
                       const currentNT = isTelematics ? filteredTruckNT : filteredNT;
                       const ntGetter = isTelematics ? getCompTruckNT : getCompNT;

                       const globalAmt = getSidebarVal(item.gk, item.ck);
                       const detailedPU = getDetailedExpensePerUnit(item.keyword, globalAmt);
                       const val = detailedPU.averagePerUnit;
                       const total = val * currentNT;
                       
                       const tooltipBreakdown = detailedPU.breakdown.map(b => ({ ...b, nt: ntGetter(b.company) }));
                       let valTooltip = null;
                       let totalTooltip = null;
                       
                       if (val > 0) {
                           valTooltip = buildPerUnitTooltip(item.label, tooltipBreakdown);
                           const totalBd = tooltipBreakdown.map(b => { 
                               const nt = ntGetter(b.company);
                               return { company: b.company, weekly: nt >= 0.14 ? b.perUnit * nt : b.perUnit }; 
                           });
                           totalTooltip = buildTotalTooltip(item.label, totalBd);
                       }
                       return {
                           ...item,
                           val,
                           total,
                           valTooltip,
                           totalTooltip,
                           multiplier: currentNT
                       };
                    }).filter(item => item.val > 0).sort((a, b) => b.total - a.total);

                    const adminTotal = adminItems.reduce((sum, item) => sum + item.val, 0);
                                         
                                         let totalTruckCpmCost = 0;
                                         let totalTruckWeeklyCost = 0;
                                         const truckWeeklyBreakdown: { company: string, perUnit: number, weekly: number, nt: number }[] = [];
                                             
                                             const currTimeTruck = (sidebarTargetDate ? new Date(sidebarTargetDate as string).getTime() : Date.now()) - (3 * 24 * 60 * 60 * 1000);
                                             const validTruckRules = fixedExpenses.filter(e => {
                                             if (e.name !== 'Truck Price') return false;
                                             const fromTime = e.valid_from ? new Date(e.valid_from).getTime() : -Infinity;
                                             const toTime = e.valid_to ? new Date(e.valid_to).getTime() : Infinity;
                                             return currTimeTruck >= fromTime && currTimeTruck <= toTime;
                                         });

                                         const contractStats: Record<string, { nt: number, miles: number }> = {};
                                         
                                         filteredWeekDrivers.forEach(d => {
                                             let effContractType = d.contractType || '';
                                             if (d.contractType === 'TPOG' && d.franchiseId) {
                                                 effContractType = 'TPOG (Franchise PnL)';
                                             }

                                             if (effContractType === 'OO') return; 

                                             if (!contractStats[effContractType]) {
                                                 contractStats[effContractType] = { nt: 0, miles: 0 };
                                             }
                                             contractStats[effContractType].nt += (d.effectiveNonTeams || 0);
                                             contractStats[effContractType].miles += (Number(d.milesDriven) || 0);
                                         });

                                         let totalTruckCpmNT = 0;
                                         const truckCpmBreakdown: { company: string, perUnit: number, weekly: number, nt: number }[] = [];

                                         Object.entries(contractStats).forEach(([cType, stats]) => {
                                             let amount: number | null = null;
                                             let cpm: number | null = null;

                                             if (cType.replace(/\s+/g, '').toUpperCase() === 'TPOG(FRANCHISEPNL)') {
                                                 let cCosts = fcSidebar.contract_specific_costs;
                                                 if (typeof cCosts === 'string') { try { cCosts = JSON.parse(cCosts); } catch(e) {} }
                                                 if (cCosts && Array.isArray(cCosts)) {
                                                     const legacyRule = cCosts.find((el: any) =>
                                                         (el.contract_type || '').trim().toLowerCase() === cType.trim().toLowerCase() &&
                                                         (el.expense_name || '').toLowerCase().includes('truck price')
                                                     );
                                                     if (legacyRule) {
                                                         if (legacyRule.amount !== undefined && legacyRule.amount !== null && String(legacyRule.amount).trim() !== '') amount = Math.abs(Number(legacyRule.amount));
                                                         if (legacyRule.cpm !== undefined && legacyRule.cpm !== null && String(legacyRule.cpm).trim() !== '') cpm = Math.abs(Number(legacyRule.cpm));
                                                     }
                                                 }
                                             }

                                             if (cpm === null && fcSidebar['truck_price_cpm'] !== undefined && fcSidebar['truck_price_cpm'] !== null) {
                                                 cpm = Math.abs(Number(fcSidebar['truck_price_cpm']));
                                             }
                                             if (amount === null && fcSidebar['truck_weekly'] !== undefined && fcSidebar['truck_weekly'] !== null && String(fcSidebar['truck_weekly']).trim() !== '') {
                                                 amount = Math.abs(Number(fcSidebar['truck_weekly']));
                                             }
                                             if (amount === null && sidebarAvgTruckPrice) {
                                                 amount = Math.abs(Number(sidebarAvgTruckPrice));
                                             }

                                             const cTimeTr = (sidebarTargetDate ? new Date(sidebarTargetDate as string).getTime() : Date.now()) - (3 * 24 * 60 * 60 * 1000);
                                             const rlsTr = fixedExpenses.filter(e => e.name === 'Truck Price' && (e as any).truck_reduction && (!e.valid_from || new Date(e.valid_from).getTime() <= cTimeTr) && (!e.valid_to || new Date(e.valid_to).getTime() >= cTimeTr));
                                             const glsTr = rlsTr.filter(e => e.companyId === 'ALL' && (!e.contractType || e.contractType === '' || e.contractType === 'ALL'));
                                             const spsTr = rlsTr.filter(e => (e.contractType === cType && (!e.companyId || e.companyId === 'ALL' || e.companyId === '')));
                                             const glTr = glsTr.length > 0 ? Math.max(...glsTr.map(e => Number((e as any).truck_reduction) || 0)) : 0;
                                             const spTr = spsTr.length > 0 ? Math.max(...spsTr.map(e => Number((e as any).truck_reduction) || 0)) : 0;
                                             amount = Math.max(0, (amount || 0) - glTr - spTr);

                                             totalTruckWeeklyCost += (amount || 0) * stats.nt;
                                             truckWeeklyBreakdown.push({
                                                 company: cType,
                                                 perUnit: amount || 0,
                                                 weekly: (amount || 0) * stats.nt,
                                                 nt: stats.nt
                                             });
                                             
                                             const currentCpmCost = (cpm || 0) * stats.miles;
                                             totalTruckCpmCost += currentCpmCost;
                                             totalTruckCpmNT += stats.nt;

                                             const currentPerUnit = stats.nt > 0 ? currentCpmCost / stats.nt : 0;
                                             truckCpmBreakdown.push({
                                                 company: cType,
                                                 perUnit: currentPerUnit,
                                                 weekly: currentCpmCost,
                                                 nt: stats.nt
                                             });
                                        });

                                         const groupTpogContracts = (arr: any[]) => {
                                             const res: any[] = [];
                                             let tpogNt = 0;
                                             let tpogWeekly = 0;
                                             arr.forEach(b => {
                                                 if (b.company === 'TPOG' || b.company === 'TPOG WITH FRANCHISE' || b.company === 'TPOG (Franchise PnL)') {
                                                     tpogNt += b.nt;
                                                     tpogWeekly += b.weekly;
                                                 } else {
                                                     res.push(b);
                                                 }
                                             });
                                             if (tpogNt > 0) {
                                                 res.push({ company: 'TPOG', nt: tpogNt, weekly: tpogWeekly, perUnit: tpogWeekly / tpogNt });
                                             }
                                             return res;
                                         };

                                         const truckCpmPUTooltip = buildPerUnitTooltip('Truck CPM', groupTpogContracts(truckCpmBreakdown));
                                         const truckCpmTotalTooltip = buildTotalTooltip('Truck CPM', groupTpogContracts(truckCpmBreakdown));

                                         const truckWeeklyPUTooltip = buildPerUnitTooltip('Truck Price', groupTpogContracts(truckWeeklyBreakdown));
                                         const truckWeeklyTotalTooltip = buildTotalTooltip('Truck Price Total', groupTpogContracts(truckWeeklyBreakdown));

                                         const tCpmPerUnit = totalTruckCpmNT > 0 ? totalTruckCpmCost / totalTruckCpmNT : 0;
                                         const tWeeklyPerUnit = filteredTruckNT > 0 ? totalTruckWeeklyCost / filteredTruckNT : 0;

                                         const trPU = getDetailedExpensePerUnit('Trailer Price', getSidebarVal('trailer_weekly', 'trailer_weekly_custom'));
                                         const trPUBreakdown = trPU.breakdown.map(b => ({ company: b.company, perUnit: b.perUnit, tr: getCompTr(b.company) }));
                                         const trPUTooltip = buildPerUnitTooltip('Avg Trailer Price', trPUBreakdown);
                                         const trTotalBreakdown = trPUBreakdown.map(b => ({ company: b.company, weekly: b.perUnit * getCompTr(b.company), tr: getCompTr(b.company) }));
                                         const trTotalTooltip = buildTotalTooltip('Avg Trailer Price Total', trTotalBreakdown);

                                         const equipTotal = tWeeklyPerUnit + getSidebarVal('trailer_weekly') + tCpmPerUnit;
                                         
                                         const factoringTotalAmount = sidebarGross * (getSidebarVal('factoring', 'factoring_custom') / 100);
                    const factoringPerUnitValue = filteredNT > 0 ? factoringTotalAmount / filteredNT : 0;
                    const opTotal = getSidebarVal('plates', 'plates_custom') + factoringPerUnitValue;
                    const equipTotalWeekly = totalTruckWeeklyCost + getRowTotal('trailer_weekly', undefined, false, filteredTr) + totalTruckCpmCost;
                    const opTotalWeekly = getRowTotal('plates', 'plates_custom', false, Math.round(filteredTruckNT)) + factoringTotalAmount;
                    const adminTotalWeekly = adminItems.reduce((sum, item) => sum + item.total, 0);

                    return (
                        <>
                             <div className="mb-1.5">
                             <div className="flex items-center mb-0.5 px-1.5 w-full">
                                  <div className="w-[50%] text-left">
                                     <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">Equipment</span>
                                  </div>
                                  <div className="w-[25%] text-center">
                                     <span className="text-[9px] font-bold text-zinc-500">-{formatCurrency(equipTotal)}</span>
                                  </div>
                                  <div className="w-[25%] text-right">
                                     <span className="text-[9px] font-bold text-zinc-400">-{formatCurrency(equipTotalWeekly)}</span>
                                  </div>
                               </div>
                               <div className="bg-zinc-950/40 rounded border border-zinc-800/30 divide-y divide-zinc-800/30">
                                   {(() => {
                                       const tVal = tWeeklyPerUnit;
                                       const tTotal = totalTruckWeeklyCost;
                                       
                                       const trVal = getSidebarVal('trailer_weekly');
                                       const trTotal = getRowTotal('trailer_weekly', undefined, false, filteredTr);
                                       return (
                                           <>
                                               {tVal > 0 && (
                                               <div className="flex items-center p-1.5 hover:bg-zinc-800/10 transition-colors relative">
                                                  <div className="w-[50%] text-left pr-2">
                                                    <span className="text-[10px] text-zinc-300 block truncate">Avg Truck Price</span>
                                                  </div>
                                                  <div className="w-[25%] text-center">
                                                     <div className="relative group/tooltip inline-block" onMouseMove={handleTooltipMove}>
                                                        <span className="text-[10px] font-mono font-bold transition-colors duration-200 cursor-help text-sky-400/80 hover:text-sky-300">
                                                          -{formatCurrency(tVal)}
                                                        </span>
                                                        <div className="hidden group-hover/tooltip:block fixed z-[9999] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl normal-case font-normal border border-zinc-700 pointer-events-none dynamic-tooltip w-max">
                                                           {truckWeeklyPUTooltip}
                                                        </div>
                                                     </div>
                                                  </div>
                                                  <div className="w-[25%] text-right">
                                                     <div className="relative group/tooltip inline-block" onMouseMove={handleTooltipMove}>
                                                        <span className="text-[10px] font-mono font-bold transition-colors duration-200 cursor-help text-zinc-400 hover:text-zinc-300">
                                                          -{formatCurrency(tTotal)}
                                                        </span>
                                                        <div className="hidden group-hover/tooltip:block fixed z-[9999] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl normal-case font-normal border border-zinc-700 pointer-events-none dynamic-tooltip w-max">
                                                           <div className="mb-1">{truckWeeklyTotalTooltip}</div>
                                                           <div className="text-[9px] text-zinc-500 border-t border-zinc-700 pt-1 mt-1">Without OO drivers</div>
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
                                                      <div className="relative group/tooltip inline-block" onMouseMove={handleTooltipMove}>
                                                         <span className="text-[10px] font-mono font-bold transition-colors duration-200 cursor-help text-sky-400/80 hover:text-sky-300">
                                                           -{formatCurrency(trVal)}
                                                         </span>
                                                         <div className="hidden group-hover/tooltip:block fixed z-[9999] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl normal-case font-normal border border-zinc-700 pointer-events-none dynamic-tooltip w-max">
                                                            {trPUTooltip}
                                                         </div>
                                                      </div>
                                                   </div>
                                                   <div className="w-[25%] text-right">
                                                      <div className="relative group/tooltip inline-block" onMouseMove={handleTooltipMove}>
                                                         <span className="text-[10px] font-mono font-bold transition-colors duration-200 cursor-help text-zinc-400 hover:text-zinc-300">
                                                           -{formatCurrency(trTotal)}
                                                         </span>
                                                         <div className="hidden group-hover/tooltip:block fixed z-[9999] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl normal-case font-normal border border-zinc-700 pointer-events-none dynamic-tooltip w-max">
                                                            {trTotalTooltip}
                                                         </div>
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
                                                      <div className="relative group/tooltip inline-block" onMouseMove={handleTooltipMove}>
                                                         <span className="text-[10px] font-mono font-bold transition-colors duration-200 cursor-help text-sky-400/80 hover:text-sky-300">
                                                           -{formatCurrency(tCpmPerUnit)}
                                                         </span>
                                                         <div className="hidden group-hover/tooltip:block fixed z-[9999] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl normal-case font-normal border border-zinc-700 pointer-events-none dynamic-tooltip w-max">
                                                            {truckCpmPUTooltip}
                                                         </div>
                                                      </div>
                                                   </div>
                                                   <div className="w-[25%] text-right">
                                                      <div className="relative group/tooltip inline-block" onMouseMove={handleTooltipMove}>
                                                         <span className="text-[10px] font-mono font-bold transition-colors duration-200 cursor-help text-zinc-400 hover:text-zinc-300">
                                                           -{formatCurrency(totalTruckCpmCost)}
                                                         </span>
                                                         <div className="hidden group-hover/tooltip:block fixed z-[9999] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl normal-case font-normal border border-zinc-700 pointer-events-none dynamic-tooltip w-max">
                                                            {truckCpmTotalTooltip}
                                                         </div>
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
                               <div className="flex items-center mb-0.5 px-1.5 w-full">
                                  <div className="w-[50%] text-left">
                                     <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">Operational</span>
                                  </div>
                                  <div className="w-[25%] text-center">
                                     <div className="relative group/tooltip inline-block" onMouseMove={handleTooltipMove}>
                                        <span className="text-[9px] font-bold transition-colors duration-200 cursor-help text-zinc-500 hover:text-zinc-400">-{formatCurrency(opTotal)}</span>
                                        <div className="hidden group-hover/tooltip:block fixed z-[9999] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl normal-case font-normal border border-zinc-700 pointer-events-none dynamic-tooltip w-max">
                                           average total gross + plates per unit
                                        </div>
                                     </div>
                                  </div>
                                  <div className="w-[25%] text-right">
                                     <span className="text-[9px] font-bold text-zinc-400">-{formatCurrency(opTotalWeekly)}</span>
                                  </div>
                               </div>
                               <div className="bg-zinc-950/40 rounded border border-zinc-800/30 divide-y divide-zinc-800/30">
                                  {(() => {
                                      const platesPU = getDetailedExpensePerUnit('Plates', getSidebarVal('plates', 'plates_custom'));
                                      const platesPUBreakdown = platesPU.breakdown.map(b => ({ company: b.company, perUnit: b.perUnit, nt: getCompTruckNT(b.company) })).filter(b => b.nt > 0);
                                      const platesTotalBreakdown = platesPU.breakdown.map(b => ({ company: b.company, weekly: b.perUnit * getCompTruckNT(b.company), nt: getCompTruckNT(b.company) })).filter(b => b.nt > 0);
                                      const platesTotalSum = platesTotalBreakdown.reduce((sum, b) => sum + b.weekly, 0);
                                      return renderRow('Plates', 'plates', 'plates_custom', false, Math.round(filteredTruckNT), buildPerUnitTooltip('Plates', platesPUBreakdown), buildTotalTooltip('Plates Total', platesTotalBreakdown), platesPU.averagePerUnit, platesTotalSum);
                                  })()}
                                  {(() => {
                                      const factBreakdown = activeCompsInWeek.map(compId => {
                                          const compDrivers = filteredWeekDrivers.filter(d => d.companyId === compId);
                                          const gross = compDrivers.reduce((sum, d) => sum + (d.grossRevenue || 0) + (d.marginAmount || 0), 0);
                                          const nt = getCompNT(compId);
                                          let val = getSidebarVal('factoring', 'factoring_custom');
                                          if (specCosts && Array.isArray(specCosts)) {
                                              const compRule = specCosts.find((el: any) =>
                                                  (el.company_id || '').replace(/\s+/g, '').toLowerCase() === compId.replace(/\s+/g, '').toLowerCase() &&
                                                  (el.expense_name || '').toLowerCase().includes('factoring')
                                              );
                                              if (compRule && compRule.amount !== undefined && compRule.amount !== null && String(compRule.amount).trim() !== '') {
                                                  val = Math.abs(Number(compRule.amount));
                                              }
                                          }
                                          const weekly = gross * (val / 100);
                                          const perUnit = nt > 0 ? weekly / nt : 0;
                                          return { company: compId, gross, nt, perUnit, weekly };
                                      });
                                      return renderRow('Factoring', 'factoring', 'factoring_custom', true, 1, buildPerUnitTooltip('Factoring', factBreakdown), buildTotalTooltip('Factoring Total', factBreakdown));
                                  })()}
                               </div>
                             </div>

                           <div className="mb-1.5">
                               <div className="flex items-center mb-0.5 px-1.5 w-full">
                                  <div className="w-[50%] text-left">
                                     <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">Insurance</span>
                                  </div>
                                  <div className="w-[25%] text-center">
                                     <span className="text-[9px] font-bold text-zinc-500">-{formatCurrency(insPerUnitTotal)}</span>
                                  </div>
                                  <div className="w-[25%] text-right">
                                     <span className="text-[9px] font-bold text-zinc-400">-{formatCurrency(insTotal)}</span>
                                  </div>
                               </div>
                               <div className="bg-zinc-950/40 rounded border border-zinc-800/30 divide-y divide-zinc-800/30">
                                 {renderRow('Liability Insurance (Auto)', 'liability_insurance', 'liability_insurance_custom', false, 1, liabAutoPUTooltip, liabAutoTotalTooltip, finalLiabAutoPerUnit, finalLiabAutoTotal)}
                                 {renderRow('Liability Insurance (General)', '', '', false, 1, liabGenPUTooltip, liabGenTotalTooltip, finalLiabGenPerUnit, finalLiabGenTotal)}
{renderRow('Cargo Insurance', 'cargo_insurance', 'cargo_insurance_custom', false, 1, cargoPUTooltip, cargoTotalTooltip, finalCargoPerUnit, finalCargoTotal)}
{renderRow('Lease Gap Coverage', 'lease_gap_coverage', 'lease_gap_coverage_custom', false, 1, leaseGapPUTooltip, leaseGapTotalTooltip, finalLeaseGapPerUnit, finalLeaseGapTotal)}
{renderRow('Trailer Interchange', 'trailer_interchange', 'trailer_interchange_custom', false, 1, trailerInterchangePUTooltip, trailerInterchangeTotalTooltip, finalTrailerInterchangePerUnit, finalTrailerInterchangeTotal)}
                         {renderRow('PD Premium', 'pd_premium', 'pd_premium_custom', false, 1, pdPremiumPUTooltip, pdPremiumTotalTooltip, finalPdPremiumPerUnit, finalPdPremiumTotal)}
                         {renderRow('Physical Damage (Truck)', 'physical_damage', 'physical_damage_custom', false, 1, pdTruckPUTooltip, pdTruckTotalTooltip, finalPdTruckPerUnit, finalPdTruckTotal)}
                                 {renderRow('Physical Damage (Trailer)', 'physical_damage', 'physical_damage_custom', false, 1, pdTrailerPUTooltip, pdTrailerTotalTooltip, finalPdTrailerPerUnit, finalPdTrailerTotal)}
                              </div>
                             </div>

                            <div className="mb-1.5">
                               <div className="flex items-center mb-0.5 px-1.5 w-full">
                                  <div className="w-[50%] text-left">
                                     <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">Admin & Technology</span>
                                  </div>
                                  <div className="w-[25%] text-center">
                                     <span className="text-[9px] font-bold text-zinc-500">-{formatCurrency(adminTotal)}</span>
                                  </div>
                                  <div className="w-[25%] text-right">
                                     <span className="text-[9px] font-bold text-zinc-400">-{formatCurrency(adminTotalWeekly)}</span>
                                  </div>
                               </div>
                               <div className="bg-zinc-950/40 rounded border border-zinc-800/30 divide-y divide-zinc-800/30">
                                  {adminItems.map(item => renderRow(item.label, item.gk, item.ck, false, item.multiplier, item.valTooltip, item.totalTooltip, item.val, item.total))}
                               </div>
                             </div>

                             <div className="mb-1.5">
                               <div className="flex items-center mb-0.5 px-1.5 w-full">
                                  <div className="w-[50%] text-left">
                                     <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">Other</span>
                                  </div>
                                  <div className="w-[25%] text-center">
                                     <span className="text-[9px] font-bold text-zinc-500">-{formatCurrency(otherPerUnitTotal)}</span>
                                  </div>
                                  <div className="w-[25%] text-right">
                                     <span className="text-[9px] font-bold text-zinc-400">-{formatCurrency(otherTotal)}</span>
                                  </div>
                               </div>
                               <div className="bg-zinc-950/40 rounded border border-zinc-800/30 divide-y divide-zinc-800/30">
                                 {renderRow('LAGO', 'lago', 'lago_custom', false, 1, lagoPUTooltip, lagoTotalTooltip, finalLagoPerUnit, finalLagoTotal)}
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
                      <span className="text-[10px] font-mono text-zinc-400">{formatCurrency(simulationConfig.globalFixedExpenseAdjustment * (allDrivers || drivers).filter(d => d.payDate === companyMetrics.currentPayDate).reduce((sum, d) => sum + (d.effectiveDrivers || 0), 0), 1)}</span>
                    </div>
                 </div>
               )}
             </div>
          </div>

        </div>

        {/* FAR RIGHT COLUMN: Capacity & PNL History */}
        <div className="w-full xl:w-40 flex flex-col gap-2 flex-shrink-0 h-full overflow-hidden">
            
          
  

          {/* PNL History */}
          <PnLHistoryCard 
            enrichedDrivers={enrichedDrivers} 
            calculateMetrics={calculateMetrics} 
          />
        </div>

      </div>
    </div>
  );
};

export default PnLView;