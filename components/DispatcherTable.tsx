import React, { useState, useEffect } from 'react';
import { DriverPerformance, DispatcherTier } from '../types';
import { formatCurrency, formatPercent } from '../utils';
import { Users, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, AlertCircle, DollarSign, Filter, Search, Eye, EyeOff, Activity, List, CheckCircle, AlertTriangle, Info, Circle, BarChart2, LineChart as LineChartIcon } from 'lucide-react';
import { getRawMetrics } from './DriverTable';
import HistoricalChart from './HistoricalChart';
import { supabase } from '../lib/supabase';
import TableFilter, { FilterRule } from './TableFilter';

interface DispatcherTableProps {
  drivers: DriverPerformance[];
}

const DispatcherTable: React.FC<DispatcherTableProps> = ({ drivers }) => {
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        el.style.setProperty('--visible-width', `${entry.contentRect.width}px`);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'totalMargin', direction: 'desc' });
  const [expandedDispId, setExpandedDispId] = useState<string | null>(null);
  const [expandedTab, setExpandedTab] = useState<'chart' | 'list'>('chart');
  const [chartFilter, setChartFilter] = useState<string>('all');
  const [tableFilters, setTableFilters] = useState<FilterRule[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['pnl']);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [expandedSubDriverId, setExpandedSubDriverId] = useState<string | null>(null);
  const [excludeZeroGross, setExcludeZeroGross] = useState(false);
  const [fixedExpenses, setFixedExpenses] = useState<any[]>([]);
  const [showAverages, setShowAverages] = useState(false);
  const [pnlConfigs, setPnlConfigs] = useState<any[]>([]);
  const [driverSettings, setDriverSettings] = useState<any>({});
  const [footerAggType, setFooterAggType] = useState<'total' | 'median' | 'average'>('total');
  const [isDispPayExpanded, setIsDispPayExpanded] = useState(false);
  const [poRules, setPoRules] = useState<any[]>([]);

  useEffect(() => {
    const loadPnlConfigs = async () => {
      try {
        const { fetchPnlConfigs } = await import('../lib/supabase');
        if (fetchPnlConfigs) {
          const data = await fetchPnlConfigs();
          setPnlConfigs(data || []);
        }
      } catch(e) { }
    };
    const loadPoRules = async () => {
      try {
        const { data } = await supabase.from('po_rules').select('*');
        if (data) setPoRules(data);
      } catch(e) { }
    };
    loadPnlConfigs();
    loadPoRules();
  }, []);

  useEffect(() => {
    const fetchFixedExps = async () => {
      const { data } = await supabase.from('fixed_expenses').select('*');
      if (data) setFixedExpenses(data);
    };
    fetchFixedExps();
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase.from('driver_settings').select('*');
      if (!error && data) {
        const formatted: any = {};
        data.forEach((row: any) => {
          const key = row.entity_type === 'GLOBAL' ? 'GLOBAL' : `${row.entity_type === 'CONTRACT' ? 'CTR' : 'CMP'}:${row.entity_value}`;
          formatted[key] = row.settings;
        });
        setDriverSettings(formatted);
      }
    };
    fetchSettings();
  }, []);

  const getSeverity = (val: number, specificConf: any = driverSettings?.['GLOBAL'] || {}) => {
    const rules = specificConf['pnl'] || driverSettings?.['GLOBAL']?.['pnl'];
    if (!rules || (Number(rules.redMax) === 0 && Number(rules.greenMin) === 0 && Number(rules.orangeMax) === 0)) return 'neutral';
    const rMax = Number(rules.redMax); const gMin = Number(rules.greenMin); const oMax = Number(rules.orangeMax); const oMin = Number(rules.orangeMin);
    if (gMin >= rMax) {
        if (val <= rMax) return 'critical';
        if (val >= gMin) return 'good';
        if (val > rMax && val <= oMax) return 'warning';
        return 'neutral';
    } else {
        if (val >= rMax) return 'critical';
        if (val <= gMin) return 'good';
        if (val < rMax && val >= oMin) return 'warning';
        return 'neutral';
    }
  };

  const validDrivers = React.useMemo(() => {
    const uniqueDates = Array.from(new Set(drivers.map(d => d.payDate).filter(Boolean)));
    const sortedDates = uniqueDates.sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime());
    const allowedDates = new Set(sortedDates.length > 6 ? sortedDates.slice(0, -6) : sortedDates);
    const baseDrivers = drivers.filter(d => allowedDates.has(d.payDate));
    const term = searchTerm ? searchTerm.toLowerCase() : '';
    const driverFilters = tableFilters.filter(f => f.field === 'Driver');
    
    if (!term && driverFilters.length === 0) return baseDrivers;
    
    return baseDrivers.filter(driver => {
      const d = driver as any;
      const dId = String(d.stub_dispatcher || d.dispatcherId || d.dispatcherName || d.dispatcher_name || d.dispatcher_id || d.dispatcher || '').toLowerCase();
      const tId = String(d.stub_team || d.teamId || d.teamName || d.team_name || d.team || '').toLowerCase();
      const dName = String(d.name || '').toLowerCase();
      
      if (term) {
        if (!dId.includes(term) && !tId.includes(term) && !dName.includes(term)) {
          return false;
        }
      }
      
      if (driverFilters.length > 0) {
        const passesDriverFilter = driverFilters.every(rule => {
          const vals = Array.isArray(rule.value) ? rule.value : [];
          if (vals.length === 0) return true;
          const hasDriver = vals.includes(driver.name);
          if (rule.operator === 'is one of') return hasDriver;
          if (rule.operator === 'is not one of') return !hasDriver;
          if (rule.operator === 'is') return hasDriver;
          if (rule.operator === 'is not') return !hasDriver;
          return true;
        });
        if (!passesDriverFilter) return false;
      }
      
      return true;
    });
  }, [drivers, searchTerm, tableFilters]);

  const enrichedMap = React.useMemo(() => {
    const map = new Map<string, any>();
    ((window as any).__ENRICHED_DRIVERS__ || []).forEach((ed: any) => {
      map.set(`${ed.name}_${ed.payDate}_${ed.contractType}_${ed.companyId}`, ed);
    });
    return map;
  }, [drivers]);

  const requestSort = (key: string) => {
    const getChartData = (dispName: string, teamName: string) => {
    const dataMap = new Map();
    validDrivers.forEach(d => {
      const m = getRawMetrics(d, fixedExpenses, enrichedMap, pnlConfigs, poRules);
      const tId = d.teamId || d.teamName || d.team_name || d.team || 'Unassigned Team';
      const dId = d.dispatcherId || d.dispatcherName || d.dispatcher_name || d.dispatcher_id || d.dispatcher || 'Unassigned Dispatcher';
      
      if (dId === dispName && tId === teamName) {
        const isTerminated = String(d.status).toUpperCase() === 'TERMINATED';
        if (chartFilter === 'active' && isTerminated) return;
        if (chartFilter === 'terminated' && !isTerminated) return;
        if (chartFilter !== 'all' && chartFilter !== 'active' && chartFilter !== 'terminated' && d.name !== chartFilter) return;

        const payD = d.payDate || 'Unknown';
        if (!dataMap.has(payD)) {
          dataMap.set(payD, { payDate: payD, gross: 0, margin: 0, pnl: 0 });
        }
        const cd = dataMap.get(payD);
        cd.gross += (d.grossRevenue || d.driver_gross || 0);
        cd.margin += (d.marginAmount || 0);
        let finalPnl = m.pnl;
        if (m.franchisePnlCalculated) {
            finalPnl -= m.franchisePnlCalculated;
        }
        cd.pnl += finalPnl;
      }
    });
    return Array.from(dataMap.values()).sort((a, b) => new Date(a.payDate).getTime() - new Date(b.payDate).getTime());
  };
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  

  const toggleMetric = (metric: string) => {
    setSelectedMetrics(prev => prev.includes(metric) && prev.length > 1 ? prev.filter(m => m !== metric) : prev.includes(metric) ? prev : [...prev, metric]);
  };

  const activeSeries = React.useMemo(() => {
    const palette = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#f43f5e', '#06b6d4', '#fb923c', '#d946ef', '#a1a1aa'];
    return selectedMetrics.map((m, i) => ({ dataKey: m, name: m.toUpperCase(), color: palette[i % palette.length] }));
  }, [selectedMetrics]);

  const getChartData = React.useCallback((dispName: string, teamName: string) => {
    const dataMap = new Map();
    validDrivers.forEach(d => {
      const m = getRawMetrics(d, fixedExpenses, enrichedMap, pnlConfigs, poRules);
      const tId = d.teamId || d.teamName || d.team_name || d.team || 'Unassigned Team';
      const dId = d.dispatcherId || d.dispatcherName || d.dispatcher_name || d.dispatcher_id || d.dispatcher || 'Unassigned Dispatcher';
      
      if (dId === dispName && tId === teamName) {
        const isTerminated = String(d.status).toUpperCase() === 'TERMINATED';
        if (chartFilter === 'active' && isTerminated) return;
        if (chartFilter === 'terminated' && !isTerminated) return;
        if (chartFilter !== 'all' && chartFilter !== 'active' && chartFilter !== 'terminated') {
            if (chartFilter.startsWith('CTR:')) {
                if (d.contractType !== chartFilter.substring(4)) return;
            } else if (chartFilter.startsWith('CMP:')) {
                if (d.companyId !== chartFilter.substring(4)) return;
            } else if (chartFilter.startsWith('FRA:')) {
                if (d.franchiseId !== chartFilter.substring(4)) return;
            } else {
                if (d.name !== chartFilter) return;
            }
        }

        const payD = d.payDate ? d.payDate.split('T')[0] : 'Unknown';
        if (!dataMap.has(payD)) {
          dataMap.set(payD, { name: payD, pnl: 0, margin: 0, gross: 0, 'disp. pay': 0, 'wkly exp': 0, 'revenue collected': 0, tolls: 0, fuel: 0, po: 0, recruiting: 0, count: 0, effNonTeams: 0, effDrivers: 0 });
        }
        const cd = dataMap.get(payD);
        cd.gross += (d.grossRevenue || d.driver_gross || 0);
        cd.margin += (d.marginAmount || 0);
        let finalPnl = m.pnl;
        if (m.franchisePnlCalculated) {
            finalPnl -= m.franchisePnlCalculated;
        }
        cd.pnl += finalPnl;
        cd['disp. pay'] += m.dispPay;
        cd['wkly exp'] += m.wklyExp;
        cd['revenue collected'] += m.revCol;
        cd.tolls += m.tolls;
        cd.fuel += m.fuel;
        cd.po += m.po;
        cd.recruiting += m.recruiting;
        cd.count += 1;
        cd.effNonTeams += (d.effectiveNonTeams || 0);
        cd.effDrivers += (d.effectiveDrivers || 0);
      }
    });
    
    return Array.from(dataMap.values()).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime()).map(point => {
       const divisor = point.effNonTeams > 0 ? point.effNonTeams : (point.effDrivers > 0 ? point.effDrivers : (point.count > 0 ? point.count : 1));
       const res: any = { name: point.name };
       selectedMetrics.forEach(m => {
           if (m.endsWith(' avg/w')) {
               const baseM = m.replace(' avg/w', '');
               res[m] = point[baseM as keyof typeof point] / divisor;
           } else {
               res[m] = point[m as keyof typeof point];
           }
       });
       return res;
    });
  }, [validDrivers, fixedExpenses, enrichedMap, pnlConfigs, poRules, chartFilter, selectedMetrics]);

  const getSeverityForMetric = (metricId: string, val: number, specificConf: any = driverSettings?.['GLOBAL'] || {}) => {
      const rules = specificConf[metricId] || driverSettings?.['GLOBAL']?.[metricId];
      if (!rules || (Number(rules.redMax) === 0 && Number(rules.greenMin) === 0 && Number(rules.orangeMax) === 0)) return 'ignored';
      const rMax = Number(rules.redMax); const gMin = Number(rules.greenMin); const oMax = Number(rules.orangeMax); const oMin = Number(rules.orangeMin);
      if (gMin >= rMax) {
          if (val <= rMax) return 'critical';
          if (val >= gMin) return 'good';
          if (val > rMax && val <= oMax) return 'warning';
          return 'neutral';
      } else {
          if (val >= rMax) return 'critical';
          if (val <= gMin) return 'good';
          if (val < rMax && val >= oMin) return 'warning';
          return 'neutral';
      }
  };

  const { allDispatchers, driverRanks } = React.useMemo(() => {
    const globalDriverStats = new Map();
    validDrivers.forEach(d => {
      const nameLower = (d.name || '').toLowerCase();
      const compLower = (d.companyId || '').toLowerCase();
      if (nameLower.includes('unassigned') || nameLower.includes('unreconciled') || compLower.includes('unassigned') || compLower.includes('unreconciled')) return;
      if (!globalDriverStats.has(d.name)) {
          globalDriverStats.set(d.name, { gross: 0, margin: 0, pnl: 0, count: 0, effNonTeams: 0, effDrivers: 0 });
        }
        const m = getRawMetrics(d, fixedExpenses, enrichedMap, pnlConfigs, poRules);
        const stats = globalDriverStats.get(d.name);
      stats.gross += (d.grossRevenue || d.driver_gross || 0);
      stats.margin += (d.marginAmount || 0);
      let finalPnl = m.pnl;
      if (m.franchisePnlCalculated) {
          finalPnl -= m.franchisePnlCalculated;
      }
      stats.pnl += finalPnl;
      stats.count += 1;
      stats.effNonTeams += (d.effectiveNonTeams || 0);
      stats.effDrivers += (d.effectiveDrivers || 0);
    });

    const rankedDrivers = Array.from(globalDriverStats.entries())
      .filter(([name, s]) => !(excludeZeroGross && s.gross === 0))
      .map(([name, s]) => {
      const divisor = s.effNonTeams > 0 ? s.effNonTeams : (s.effDrivers > 0 ? s.effDrivers : (s.count > 0 ? s.count : 1));
      return { name, avgPnL: s.pnl / divisor };
    }).sort((a, b) => a.avgPnL - b.avgPnL);

    const driverRanks = new Map();
    rankedDrivers.forEach((d, i) => {
      driverRanks.set(d.name, rankedDrivers.length > 1 ? (i / (rankedDrivers.length - 1)) * 100 : 100);
    });

    const dispatcherContractCounts = new Map<string, number>();
    const dispatcherTotalCounts = new Map<string, number>();
    
    validDrivers.forEach(d => {
        const nameLower = (d.name || '').toLowerCase();
        const compLower = (d.companyId || '').toLowerCase();
        if (nameLower.includes('unassigned') || nameLower.includes('unreconciled') || compLower.includes('unassigned') || compLower.includes('unreconciled')) return;
        
        const m = getRawMetrics(d, fixedExpenses, enrichedMap, pnlConfigs, poRules);
        const isStub = (d as any).isStub || ((d.effectiveDrivers || 0) === 0 && (Math.abs(m.po || 0) > 0 || Math.abs(d.tolls || d.tollCost || 0) > 0));
        let dispatcherId = isStub ? (d.stub_dispatcher || 'Unassigned Dispatcher') : (d.dispatcherId || d.dispatcherName || d.dispatcher_name || d.dispatcher_id || d.dispatcher || 'Unassigned Dispatcher');
        if (!dispatcherId || String(dispatcherId).trim().toLowerCase() === 'unassigned' || String(dispatcherId).trim().toLowerCase() === 'null') dispatcherId = 'Unassigned Dispatcher';
        
        const ct = d.contractType || 'ALL';
        const payDate = d.payDate || 'Unknown';
        const driverWeight = d.effectiveNonTeams > 0 ? d.effectiveNonTeams : (d.effectiveDrivers > 0 ? d.effectiveDrivers : 1);
        
        const ctKey = `${dispatcherId}_${payDate}_${ct}`;
        dispatcherContractCounts.set(ctKey, (dispatcherContractCounts.get(ctKey) || 0) + driverWeight);
        
        const totalKey = `${dispatcherId}_${payDate}`;
        dispatcherTotalCounts.set(totalKey, (dispatcherTotalCounts.get(totalKey) || 0) + driverWeight);
    });

    const teamMap = new Map();

    validDrivers.forEach(driver => {
              const nameLower = (driver.name || '').toLowerCase();
              const compLower = (driver.companyId || '').toLowerCase();
              if (nameLower.includes('unassigned') || nameLower.includes('unreconciled') || compLower.includes('unassigned') || compLower.includes('unreconciled')) return;
              
              const m = getRawMetrics(driver, fixedExpenses, enrichedMap, pnlConfigs, poRules);
              const isStub = (driver as any).isStub || ((driver.effectiveDrivers || 0) === 0 && (Math.abs(m.po || 0) > 0 || Math.abs(driver.tolls || driver.tollCost || 0) > 0));

              let teamId = 'Unassigned Team';
              let dispatcherId = 'Unassigned Dispatcher';

              if (isStub) {
                  teamId = driver.stub_team || 'Unassigned Team';
                  dispatcherId = driver.stub_dispatcher || 'Unassigned Dispatcher';
              } else {
                  teamId = driver.teamId || driver.teamName || driver.team_name || driver.team || 'Unassigned Team';
                  dispatcherId = driver.dispatcherId || driver.dispatcherName || driver.dispatcher_name || driver.dispatcher_id || driver.dispatcher || 'Unassigned Dispatcher';
              }

              if (!teamId || String(teamId).trim().toLowerCase() === 'unassigned' || String(teamId).trim().toLowerCase() === 'null') teamId = 'Unassigned Team';
              if (!dispatcherId || String(dispatcherId).trim().toLowerCase() === 'unassigned' || String(dispatcherId).trim().toLowerCase() === 'null') dispatcherId = 'Unassigned Dispatcher';

              if (!teamMap.has(teamId)) {
                teamMap.set(teamId, {
                  id: teamId,
                  name: teamId,
                  totalMargin: 0,
                  totalPnL: 0,
                  dispatchers: new Map()
                });
              }

              const team = teamMap.get(teamId);
              
              if (!team.dispatchers.has(dispatcherId)) {
                team.dispatchers.set(dispatcherId, {
                  id: `${teamId}_${dispatcherId}`,
                  name: dispatcherId,
                  totalMargin: 0,
                  grossRevenue: 0,
                  totalPnL: 0,
                  revColl: 0,
                  fuelRebate: 0,
                  wklyExp: 0,
                  po: 0,
                  tolls: 0,
                  dispPay: 0,
                  dispGrossPay: 0,
                  dispMarginPay: 0,
                  dispFixedPay: 0,
                  dispSharedIns: 0,
                  recruiting: 0,
                  uniqueDrivers: new Set(),
                  grossRecordCount: 0,
                  marginRecordCount: 0,
                  payDates: new Set(),
                  driverStats: new Map()
                });
              }

              const disp = team.dispatchers.get(dispatcherId);

      let finalPnl = m.pnl;
      if (m.franchisePnlCalculated) {
          finalPnl -= m.franchisePnlCalculated;
      }
      const pnl = finalPnl;
      const gross = driver.grossRevenue || (driver as any).driver_gross || 0;
      const margin = driver.marginAmount || 0;
      const revColl = m.revCol;
      const fuelRebate = m.fuelRebate;
      const wklyExp = m.wklyExp;
      const po = m.po;
      const tolls = m.tolls;
      const dispPay = m.dispPay;
      const recruiting = m.recruiting;

      const dispGrossPay = m.dispGrossAmt || 0;
      const dispMarginPay = m.dispMarginAmt || 0;
      const dispFixedPay = m.dispFixedAmt || 0;
      const dispSharedIns = m.dispSharedAmt || 0;

      team.totalMargin += margin;
      team.totalPnL += pnl;

      disp.totalMargin += margin;
      disp.grossRevenue += gross;
      disp.totalPnL += pnl;
      disp.revColl += revColl;
      disp.fuelRebate += fuelRebate;
      disp.wklyExp += wklyExp;
      disp.po += po;
      disp.tolls += tolls;
      disp.dispPay += dispPay;
      disp.dispGrossPay += dispGrossPay;
      disp.dispMarginPay += dispMarginPay;
      disp.dispFixedPay += dispFixedPay;
      disp.dispSharedIns += dispSharedIns;
      disp.recruiting += recruiting;
      disp.uniqueDrivers.add(driver.name);

      if (!disp.driverStats.has(driver.name)) {
        disp.driverStats.set(driver.name, { gross: 0, margin: 0, pnl: 0, revColl: 0, fuelRebate: 0, wklyExp: 0, po: 0, tolls: 0, dispPay: 0, dispGrossPay: 0, dispMarginPay: 0, dispFixedPay: 0, dispSharedIns: 0, recruiting: 0, count: 0, effNonTeams: 0, effDrivers: 0, latestDate: driver.payDate || '1970-01-01', status: driver.status, companyId: driver.companyId, contractType: driver.contractType, franchiseId: driver.franchiseId, subStats: new Map() });
      }
      const stats = disp.driverStats.get(driver.name);
      stats.gross += gross;
      stats.margin += margin;
      stats.pnl += pnl;
      stats.revColl += revColl;
      stats.fuelRebate += fuelRebate;
      stats.wklyExp += wklyExp;
      stats.po += po;
      stats.tolls += tolls;
      stats.dispPay += dispPay;
      stats.dispGrossPay += dispGrossPay;
      stats.dispMarginPay += dispMarginPay;
      stats.dispFixedPay += dispFixedPay;
      stats.dispSharedIns += dispSharedIns;
      stats.recruiting += recruiting;
      stats.count += 1;
      stats.effNonTeams += (driver.effectiveNonTeams || 0);
      stats.effDrivers += (driver.effectiveDrivers || 0);
      const dDate = new Date(driver.payDate || '1970-01-01').getTime();
      const aggDate = new Date(stats.latestDate).getTime();
      if (dDate > aggDate || (dDate === aggDate && String(driver.status).toUpperCase() === 'TERMINATED')) {
         stats.latestDate = driver.payDate || '1970-01-01';
         stats.status = driver.status;
         stats.companyId = driver.companyId;
         stats.contractType = driver.contractType;
         stats.franchiseId = driver.franchiseId;
      }

      const subKey = `${driver.contractType || 'Unassigned'}_${driver.companyId || 'Unassigned'}_${driver.franchiseId || 'Unassigned'}`;
      if (!stats.subStats.has(subKey)) {
          stats.subStats.set(subKey, {
              contractType: driver.contractType || 'Unassigned',
              companyId: driver.companyId || 'Unassigned',
              franchiseId: driver.franchiseId || 'Unassigned',
              gross: 0, margin: 0, pnl: 0, revColl: 0, fuelRebate: 0, wklyExp: 0, po: 0, tolls: 0, dispPay: 0, dispGrossPay: 0, dispMarginPay: 0, dispFixedPay: 0, dispSharedIns: 0, recruiting: 0, count: 0, effNonTeams: 0, effDrivers: 0
          });
      }
      const sub = stats.subStats.get(subKey);
      sub.gross += gross;
      sub.margin += margin;
      sub.pnl += pnl;
      sub.revColl += revColl;
      sub.fuelRebate += fuelRebate;
      sub.wklyExp += wklyExp;
      sub.po += po;
      sub.tolls += tolls;
      sub.dispPay += dispPay;
      sub.dispGrossPay += dispGrossPay;
      sub.dispMarginPay += dispMarginPay;
      sub.dispFixedPay += dispFixedPay;
      sub.dispSharedIns += dispSharedIns;
      sub.recruiting += recruiting;
      sub.count += 1;
      sub.effNonTeams += (driver.effectiveNonTeams || 0);
      sub.effDrivers += (driver.effectiveDrivers || 0);

      if (gross !== 0) disp.grossRecordCount += 1;
      if (margin !== 0) disp.marginRecordCount += 1;
      
      if (driver.payDate) {
        disp.payDates.add(driver.payDate);
      }
    });

    const allRawDisps = Array.from(teamMap.values()).flatMap(team => 
      Array.from(team.dispatchers.values()).map((disp: any) => {
        let activeCount = 0;
        let dispTotalGross = 0;
        let dispTotalMargin = 0;
        let dispTotalPnL = 0;
        let avgGrossPerDriver = 0;
        let avgMarginPerDriver = 0;
        let avgPnLPerDriver = 0;
        let dispTotalRevColl = 0;
        let dispTotalFuelRebate = 0;
        let dispTotalWklyExp = 0;
        let dispTotalPO = 0;
        let dispTotalTolls = 0;
        let dispTotalDispPay = 0;
        let dispTotalDispGrossPay = 0;
        let dispTotalDispMarginPay = 0;
        let dispTotalDispFixedPay = 0;
        let dispTotalDispSharedIns = 0;
        let dispTotalRecruiting = 0;

        let avgRevCollPerDriver = 0;
        let avgFuelRebatePerDriver = 0;
        let avgWklyExpPerDriver = 0;
        let avgPOPerDriver = 0;
        let avgTollsPerDriver = 0;
        let avgDispPayPerDriver = 0;
        let avgDispGrossPayPerDriver = 0;
        let avgDispMarginPayPerDriver = 0;
        let avgDispFixedPayPerDriver = 0;
        let avgDispSharedInsPerDriver = 0;
        let avgRecruitingPerDriver = 0;

        if (disp.driverStats) {
          let totalDriverGrossAvgs = 0;
          let totalDriverMarginAvgs = 0;
          let totalDriverPnLAvgs = 0;
          let totalDriverRevCollAvgs = 0;
          let totalDriverFuelRebateAvgs = 0;
          let totalDriverWklyExpAvgs = 0;
          let totalDriverPOAvgs = 0;
          let totalDriverTollsAvgs = 0;
          let totalDriverDispPayAvgs = 0;
          let totalDriverDispGrossPayAvgs = 0;
          let totalDriverDispMarginPayAvgs = 0;
          let totalDriverDispFixedPayAvgs = 0;
          let totalDriverDispSharedInsAvgs = 0;
          let totalDriverRecruitingAvgs = 0;

          Array.from(disp.driverStats.values()).forEach((s: any) => {
            const isExcluded = excludeZeroGross && s.gross === 0;
            s.isExcluded = isExcluded;

            if (!isExcluded) {
                activeCount++;
                dispTotalGross += s.gross;
                dispTotalMargin += s.margin;
                dispTotalPnL += s.pnl;
                dispTotalRevColl += s.revColl;
                dispTotalFuelRebate += s.fuelRebate;
                dispTotalWklyExp += s.wklyExp;
                dispTotalPO += s.po;
                dispTotalTolls += s.tolls;
                dispTotalDispPay += s.dispPay;
                dispTotalDispGrossPay += s.dispGrossPay;
                dispTotalDispMarginPay += s.dispMarginPay;
                dispTotalDispFixedPay += s.dispFixedPay;
                dispTotalDispSharedIns += s.dispSharedIns;
                dispTotalRecruiting += s.recruiting;

                const effNonTeamsCount = s.effNonTeams;
                const effCount = s.effDrivers;
                const divisor = effNonTeamsCount > 0 ? effNonTeamsCount : (effCount > 0 ? effCount : (s.count > 0 ? s.count : 1));
                
                totalDriverGrossAvgs += s.gross / divisor;
                totalDriverMarginAvgs += s.margin / divisor;
                totalDriverPnLAvgs += s.pnl / divisor;
                totalDriverRevCollAvgs += s.revColl / divisor;
                totalDriverFuelRebateAvgs += s.fuelRebate / divisor;
                totalDriverWklyExpAvgs += s.wklyExp / divisor;
                totalDriverPOAvgs += s.po / divisor;
                totalDriverTollsAvgs += s.tolls / divisor;
                totalDriverDispPayAvgs += s.dispPay / divisor;
                totalDriverDispGrossPayAvgs += s.dispGrossPay / divisor;
                totalDriverDispMarginPayAvgs += s.dispMarginPay / divisor;
                totalDriverDispFixedPayAvgs += s.dispFixedPay / divisor;
                totalDriverDispSharedInsAvgs += s.dispSharedIns / divisor;
                totalDriverRecruitingAvgs += s.recruiting / divisor;
            }
          });

          if (activeCount > 0) {
              avgGrossPerDriver = totalDriverGrossAvgs / activeCount;
              avgMarginPerDriver = totalDriverMarginAvgs / activeCount;
              avgPnLPerDriver = totalDriverPnLAvgs / activeCount;
              avgRevCollPerDriver = totalDriverRevCollAvgs / activeCount;
              avgFuelRebatePerDriver = totalDriverFuelRebateAvgs / activeCount;
              avgWklyExpPerDriver = totalDriverWklyExpAvgs / activeCount;
              avgPOPerDriver = totalDriverPOAvgs / activeCount;
              avgTollsPerDriver = totalDriverTollsAvgs / activeCount;
              avgDispPayPerDriver = totalDriverDispPayAvgs / activeCount;
              avgDispGrossPayPerDriver = totalDriverDispGrossPayAvgs / activeCount;
              avgDispMarginPayPerDriver = totalDriverDispMarginPayAvgs / activeCount;
              avgDispFixedPayPerDriver = totalDriverDispFixedPayAvgs / activeCount;
              avgDispSharedInsPerDriver = totalDriverDispSharedInsAvgs / activeCount;
              avgRecruitingPerDriver = totalDriverRecruitingAvgs / activeCount;
          }
        }

        return {
          ...disp,
          activeCount,
          grossRevenue: dispTotalGross,
          totalMargin: dispTotalMargin,
          totalPnL: dispTotalPnL,
          revColl: dispTotalRevColl,
          fuelRebate: dispTotalFuelRebate,
          wklyExp: dispTotalWklyExp,
          po: dispTotalPO,
          tolls: dispTotalTolls,
          dispPay: dispTotalDispPay,
          dispGrossPay: dispTotalDispGrossPay,
          dispMarginPay: dispTotalDispMarginPay,
          dispFixedPay: dispTotalDispFixedPay,
          dispSharedIns: dispTotalDispSharedIns,
          recruiting: dispTotalRecruiting,
          avgGrossPerDriver,
          avgMarginPerDriver,
          avgPnLPerDriver,
          avgRevCollPerDriver,
          avgFuelRebatePerDriver,
          avgWklyExpPerDriver,
          avgPOPerDriver,
          avgTollsPerDriver,
          avgDispPayPerDriver,
          avgDispGrossPayPerDriver,
          avgDispMarginPayPerDriver,
          avgDispFixedPayPerDriver,
          avgDispSharedInsPerDriver,
          avgRecruitingPerDriver,
          teamName: team.name
        };
      })
    );

    const sortedForRank = [...allRawDisps].sort((a, b) => a.avgPnLPerDriver - b.avgPnLPerDriver);
    const dispRanks = new Map();
    sortedForRank.forEach((d, i) => {
      dispRanks.set(d.id, sortedForRank.length > 1 ? (i / (sortedForRank.length - 1)) * 100 : 100);
    });

    const allDispatchersResult = allRawDisps
      .filter((disp: any) => disp.name !== 'Disp Two' && disp.name !== 'disp here')
      .map((disp: any) => ({
        ...disp,
        avgRank: dispRanks.get(disp.id) || 0
      }));
      
    return { allDispatchers: allDispatchersResult, driverRanks };
  }, [validDrivers, fixedExpenses, enrichedMap, pnlConfigs, poRules, excludeZeroGross]);

  const filteredDispatchers = allDispatchers.filter(disp => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchDisp = disp.name.toLowerCase().includes(term);
      const matchTeam = disp.teamName.toLowerCase().includes(term);
      const matchDriver = Array.from(disp.uniqueDrivers).some((dName: any) => String(dName).toLowerCase().includes(term));
      if (!matchDisp && !matchTeam && !matchDriver) return false;
    }
    
    if (tableFilters.length > 0) {
      return tableFilters.every(rule => {
        if (!rule.field || !rule.operator) return true;

        if (rule.field === 'Driver') {
          const vals = Array.isArray(rule.value) ? rule.value : [];
          if (vals.length === 0) return true;
          const hasDriver = vals.some(v => disp.uniqueDrivers.has(v));
          if (rule.operator === 'is one of') return hasDriver;
          if (rule.operator === 'is not one of') return !hasDriver;
          if (rule.operator === 'is') return disp.uniqueDrivers.has(vals[0]);
          if (rule.operator === 'is not') return !disp.uniqueDrivers.has(vals[0]);
          return true;
        }
        
        let fieldValue: any;
        const fieldName = (rule.field || '').toLowerCase();
        
        if (fieldName.includes('dispatcher')) fieldValue = disp.name;
        else if (fieldName.includes('team')) fieldValue = disp.teamName;
        else if (fieldName.includes('total drivers') || fieldName === 'drivers') fieldValue = disp.activeCount;
        else if (fieldName.includes('avg gross')) fieldValue = disp.avgGrossPerDriver;
        else if (fieldName.includes('gross')) fieldValue = disp.grossRevenue;
        else if (fieldName.includes('avg margin')) fieldValue = disp.avgMarginPerDriver;
        else if (fieldName.includes('margin')) fieldValue = disp.totalMargin;
        else if (fieldName.includes('avg pnl')) fieldValue = disp.avgPnLPerDriver;
        else if (fieldName.includes('pnl')) fieldValue = disp.totalPnL;
        else if (fieldName.includes('health') || fieldName.includes('rank') || fieldName.includes('%')) fieldValue = disp.avgRank;
        else return true;

        const isCategorical = fieldName.includes('dispatcher') || fieldName.includes('team');
        
        if (rule.operator === 'is empty') return !fieldValue;
        if (rule.operator === 'is not empty') return !!fieldValue;

        if (isCategorical) {
          const safeVal = String(fieldValue || '');
          const selectedValues = Array.isArray(rule.value) ? rule.value : [];
          if (rule.operator === 'is one of') return selectedValues.includes(safeVal);
          if (rule.operator === 'is not one of') return !selectedValues.includes(safeVal);
          if (rule.operator === 'is') return selectedValues.length > 0 && selectedValues[0] === safeVal;
          if (rule.operator === 'is not') return selectedValues.length > 0 && selectedValues[0] !== safeVal;
        } else {
          const numVal = Number(fieldValue) || 0;
          const filterNum = Number(rule.value) || 0;
          if (rule.operator === 'is equal') return numVal === filterNum;
          if (rule.operator === 'is not equal') return numVal !== filterNum;
          if (rule.operator === 'is less than') return numVal < filterNum;
          if (rule.operator === 'is more than') return numVal > filterNum;
          if (rule.operator === 'is less or equal') return numVal <= filterNum;
          if (rule.operator === 'is more or equal') return numVal >= filterNum;
        }
        return true;
      });
    }
    return true;
  });

  const sortedDispatchers = [...filteredDispatchers].sort((a: any, b: any) => {
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    if (sortConfig.direction === 'asc') return aVal > bVal ? 1 : -1;
    return aVal < bVal ? 1 : -1;
  });

  const getFooterValue = (keyTotal: string, keyAvg: string) => {
    const values = filteredDispatchers.map((disp: any) => showAverages ? disp[keyAvg] : disp[keyTotal]);
    if (values.length === 0) return 0;
    if (footerAggType === 'total') {
      return values.reduce((sum, v) => sum + v, 0);
    } else if (footerAggType === 'average') {
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    } else {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
  };

  const getFooterDrivers = () => {
    const values = filteredDispatchers.map((disp: any) => disp.activeCount);
    if (values.length === 0) return 0;
    if (footerAggType === 'total') return values.reduce((sum, v) => sum + v, 0);
    if (footerAggType === 'average') return values.reduce((sum, v) => sum + v, 0) / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const footerDrivers = getFooterDrivers();
  const footerGross = getFooterValue('grossRevenue', 'avgGrossPerDriver');
  const footerRevColl = getFooterValue('revColl', 'avgRevCollPerDriver');
  const footerFuelRebate = getFooterValue('fuelRebate', 'avgFuelRebatePerDriver');
  const footerWklyExp = getFooterValue('wklyExp', 'avgWklyExpPerDriver');
  const footerPO = getFooterValue('po', 'avgPOPerDriver');
  const footerTolls = getFooterValue('tolls', 'avgTollsPerDriver');
  const footerDispPay = getFooterValue('dispPay', 'avgDispPayPerDriver');
  const footerDispGrossPay = getFooterValue('dispGrossPay', 'avgDispGrossPayPerDriver');
  const footerDispMarginPay = getFooterValue('dispMarginPay', 'avgDispMarginPayPerDriver');
  const footerDispFixedPay = getFooterValue('dispFixedPay', 'avgDispFixedPayPerDriver');
  const footerDispSharedIns = getFooterValue('dispSharedIns', 'avgDispSharedInsPerDriver');
  const footerRecruiting = getFooterValue('recruiting', 'avgRecruitingPerDriver');
  const footerMargin = getFooterValue('totalMargin', 'avgMarginPerDriver');
  const footerPnL = getFooterValue('totalPnL', 'avgPnLPerDriver');

  return (
    <div className="flex flex-col h-full gap-2 relative">
      <div className="flex justify-between items-center px-1 mb-2">
        <div className="flex items-center gap-2">
           <div className="relative">
             <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
             <input 
               type="text" 
               placeholder="Search dispatchers, teams or drivers..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="bg-zinc-900 border border-zinc-800 text-[11px] pl-7 pr-2 py-1 h-[26px] rounded w-64 text-zinc-300 focus:border-emerald-500 focus:outline-none" 
             />
           </div>
        </div>
        <div className="flex items-center gap-2 relative">
            <button 
                onClick={() => setShowAverages(!showAverages)}
                title={showAverages ? "Show Total Values" : "Show Average Values"}
                className={`flex items-center gap-1.5 px-2.5 h-[26px] border rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${showAverages ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200'}`}
            >
                <span>Average</span>
            </button>
            <button 
                onClick={() => setExcludeZeroGross(!excludeZeroGross)}
                title={excludeZeroGross ? "Include drivers with 0 Miles" : "Exclude drivers with 0 Miles"}
                className={`flex items-center gap-1.5 px-2.5 h-[26px] border rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${excludeZeroGross ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 hover:bg-rose-500/20' : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200'}`}
            >
                {excludeZeroGross ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>0 Miles</span>
            </button>
            <div className="w-[90px] h-[26px] z-50 relative [&_.absolute]:!right-0 [&_.absolute]:!left-auto [&>*:first-child]:!text-[9px] [&>*:first-child]:!whitespace-nowrap [&>*:first-child]:!tracking-tight [&_button]:!text-[9px] [&_button]:!whitespace-nowrap">
               <TableFilter
                 filters={tableFilters} 
                 setFilters={setTableFilters}
                 optionsMap={{
                   'Dispatcher': Array.from(new Set(allDispatchers.map((d: any) => d.name))).filter(Boolean) as string[],
                   'Team': Array.from(new Set(allDispatchers.map((d: any) => d.teamName))).filter(Boolean) as string[],
                   'Driver': Array.from(new Set(allDispatchers.flatMap((d: any) => Array.from(d.uniqueDrivers)))).filter(Boolean) as string[]
                 }}
               />
            </div>
        </div>
      </div>
      
      <div ref={tableContainerRef} className="overflow-auto border border-zinc-800 rounded-lg bg-zinc-900 flex-1">
        <table className="w-full text-left text-[11px] whitespace-nowrap relative">
          <thead className="bg-zinc-800 text-zinc-400 font-medium uppercase tracking-wider sticky top-0 z-20">
            <tr>
              <th onClick={() => requestSort('name')} className="px-2 py-1.5 cursor-pointer hover:text-white select-none border-b border-zinc-800 sticky left-0 bg-zinc-800 z-30">Dispatcher Name</th>
              <th onClick={() => requestSort('teamName')} className="px-2 py-1.5 cursor-pointer hover:text-white select-none border-b border-zinc-800">Team</th>
              <th onClick={() => requestSort('activeCount')} className="px-2 py-1.5 text-center cursor-pointer hover:text-white select-none border-b border-zinc-800">Total Drivers</th>
              {showAverages ? (
                <>
                  <th onClick={() => requestSort('avgGrossPerDriver')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Avg Driver Gross</th>
                  <th onClick={() => requestSort('avgMarginPerDriver')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Avg Margin</th>
                  <th onClick={() => requestSort('avgRevCollPerDriver')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Avg Rev. Coll.</th>
                  <th onClick={() => requestSort('avgFuelRebatePerDriver')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Avg Fuel Rebate</th>
                  <th onClick={() => requestSort('avgWklyExpPerDriver')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Avg Wkly Exp</th>
                  <th onClick={() => requestSort('avgPOPerDriver')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Avg PO</th>
                  <th onClick={() => requestSort('avgTollsPerDriver')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Avg Tolls</th>
                  <th onClick={() => setIsDispPayExpanded(!isDispPayExpanded)} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800 flex items-center justify-end gap-1">Avg Disp Pay {isDispPayExpanded ? <ChevronLeft size={10}/> : <ChevronRight size={10}/>}</th>
                  {isDispPayExpanded && <th onClick={() => requestSort('avgDispGrossPayPerDriver')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800 bg-zinc-700/50 text-zinc-300">Gross Pay</th>}
                  {isDispPayExpanded && <th onClick={() => requestSort('avgDispMarginPayPerDriver')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800 bg-zinc-700/50 text-zinc-300">Margin Pay</th>}
                  {isDispPayExpanded && <th onClick={() => requestSort('avgDispFixedPayPerDriver')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800 bg-zinc-700/50 text-zinc-300">Fixed Pay</th>}
                  {isDispPayExpanded && <th onClick={() => requestSort('avgDispSharedInsPerDriver')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800 bg-zinc-700/50 text-zinc-300">Shared Ins.</th>}
                  <th onClick={() => requestSort('avgRecruitingPerDriver')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Avg Recruiting</th>
                  <th onClick={() => requestSort('avgPnLPerDriver')} className="px-2 py-1.5 text-right cursor-pointer hover:text-emerald-400 select-none border-b border-zinc-800 font-bold sticky right-[160px] bg-zinc-800 z-30 w-[90px] min-w-[90px]">Avg PnL</th>
                </>
              ) : (
                <>
                  <th onClick={() => requestSort('grossRevenue')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Driver Gross</th>
                  <th onClick={() => requestSort('totalMargin')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Margin Taken</th>
                  <th onClick={() => requestSort('revColl')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Rev. Coll.</th>
                  <th onClick={() => requestSort('fuelRebate')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Fuel Rebate</th>
                  <th onClick={() => requestSort('wklyExp')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Wkly Exp</th>
                  <th onClick={() => requestSort('po')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">PO</th>
                  <th onClick={() => requestSort('tolls')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Tolls</th>
                  <th onClick={() => setIsDispPayExpanded(!isDispPayExpanded)} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800 flex items-center justify-end gap-1">Disp Pay {isDispPayExpanded ? <ChevronLeft size={10}/> : <ChevronRight size={10}/>}</th>
                  {isDispPayExpanded && <th onClick={() => requestSort('dispGrossPay')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800 bg-zinc-700/50 text-zinc-300">Gross Pay</th>}
                  {isDispPayExpanded && <th onClick={() => requestSort('dispMarginPay')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800 bg-zinc-700/50 text-zinc-300">Margin Pay</th>}
                  {isDispPayExpanded && <th onClick={() => requestSort('dispFixedPay')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800 bg-zinc-700/50 text-zinc-300">Fixed Pay</th>}
                  {isDispPayExpanded && <th onClick={() => requestSort('dispSharedIns')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800 bg-zinc-700/50 text-zinc-300">Shared Ins.</th>}
                  <th onClick={() => requestSort('recruiting')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Recruiting</th>
                  <th onClick={() => requestSort('totalPnL')} className="px-2 py-1.5 text-right cursor-pointer hover:text-emerald-400 select-none border-b border-zinc-800 font-bold sticky right-[160px] bg-zinc-800 z-30 w-[90px] min-w-[90px]">Total PnL</th>
                </>
              )}
              <th onClick={() => requestSort('avgRank')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800 sticky right-[80px] bg-zinc-800 z-30">Rank</th>
              <th className="px-2 py-1.5 text-center border-b border-zinc-800 sticky right-0 bg-zinc-800 z-30 w-[80px] min-w-[80px]">Diagnosis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 font-mono text-zinc-300">
            {sortedDispatchers.map((disp: any) => {
              const isExpanded = expandedDispId === disp.id;
              
              let displayGross = disp.grossRevenue;
              let displayMargin = disp.totalMargin;
              let displayRevColl = disp.revColl;
              let displayFuelRebate = disp.fuelRebate;
              let displayWklyExp = disp.wklyExp;
              let displayPO = disp.po;
              let displayTolls = disp.tolls;
              let displayDispPay = disp.dispPay;
              let displayDispGrossPay = disp.dispGrossPay;
              let displayDispMarginPay = disp.dispMarginPay;
              let displayDispFixedPay = disp.dispFixedPay;
              let displayDispSharedIns = disp.dispSharedIns;
              let displayRecruiting = disp.recruiting;
              let displayPnL = disp.totalPnL;

              let displayAvgGross = disp.avgGrossPerDriver || 0;
              let displayAvgMargin = disp.avgMarginPerDriver || 0;
              let displayAvgRevColl = disp.avgRevCollPerDriver || 0;
              let displayAvgFuelRebate = disp.avgFuelRebatePerDriver || 0;
              let displayAvgWklyExp = disp.avgWklyExpPerDriver || 0;
              let displayAvgPO = disp.avgPOPerDriver || 0;
              let displayAvgTolls = disp.avgTollsPerDriver || 0;
              let displayAvgDispPay = disp.avgDispPayPerDriver || 0;
              let displayAvgDispGrossPay = disp.avgDispGrossPayPerDriver || 0;
              let displayAvgDispMarginPay = disp.avgDispMarginPayPerDriver || 0;
              let displayAvgDispFixedPay = disp.avgDispFixedPayPerDriver || 0;
              let displayAvgDispSharedIns = disp.avgDispSharedInsPerDriver || 0;
              let displayAvgRecruiting = disp.avgRecruitingPerDriver || 0;
              let displayAvgPnL = disp.avgPnLPerDriver || 0;

              let displayActiveCount = disp.activeCount;

              let filteredDriversForStats: any[] = [];
              let activeTotal = 0;
              let terminatedTotal = 0;
              const contractDriverCounts = new Map<string, Set<string>>();
              const allUniqueContracts = new Set<string>();

              if (isExpanded) {
                  Array.from(disp.driverStats.entries()).forEach(([dName, s]: [string, any]) => {
                      const isTerminated = String(s.status).toUpperCase() === 'TERMINATED';
                      if (chartFilter === 'active' && isTerminated) return;
                      if (chartFilter === 'terminated' && !isTerminated) return;
                      if (chartFilter !== 'all' && chartFilter !== 'active' && chartFilter !== 'terminated' && !chartFilter.includes(':') && dName !== chartFilter) return;

                      let includedSubStats = [];
                      if (s.subStats && chartFilter.includes(':')) {
                          const [fType, fVal] = chartFilter.split(':');
                          includedSubStats = Array.from(s.subStats.values()).filter((sub: any) => {
                              if (fType === 'CTR') return sub.contractType === fVal;
                              if (fType === 'CMP') return sub.companyId === fVal;
                              if (fType === 'FRA') return sub.franchiseId === fVal;
                              return true;
                          });
                          if (includedSubStats.length === 0) return;
                      } else {
                          includedSubStats = s.subStats ? Array.from(s.subStats.values()) : [];
                      }

                      if (chartFilter.includes(':') && includedSubStats.length > 0) {
                          let fgross = 0, fmargin = 0, fpnl = 0, frevColl = 0, ffuelRebate = 0, fwklyExp = 0, fpo = 0, ftolls = 0, fdispPay = 0, fdispGrossPay = 0, fdispMarginPay = 0, fdispFixedPay = 0, fdispSharedIns = 0, frecruiting = 0;
                          let fcount = 0, feffNonTeams = 0, feffDrivers = 0;
                          includedSubStats.forEach((sub: any) => {
                              fgross += sub.gross; fmargin += sub.margin; fpnl += sub.pnl; frevColl += sub.revColl; ffuelRebate += sub.fuelRebate; fwklyExp += sub.wklyExp; fpo += sub.po; ftolls += sub.tolls; fdispPay += sub.dispPay; fdispGrossPay += sub.dispGrossPay; fdispMarginPay += sub.dispMarginPay; fdispFixedPay += sub.dispFixedPay; fdispSharedIns += sub.dispSharedIns; frecruiting += sub.recruiting;
                              fcount += sub.count; feffNonTeams += sub.effNonTeams; feffDrivers += sub.effDrivers;
                          });
                          
                          filteredDriversForStats.push([dName, {
                              ...s,
                              gross: fgross, margin: fmargin, pnl: fpnl, revColl: frevColl, fuelRebate: ffuelRebate, wklyExp: fwklyExp, po: fpo, tolls: ftolls, dispPay: fdispPay, dispGrossPay: fdispGrossPay, dispMarginPay: fdispMarginPay, dispFixedPay: fdispFixedPay, dispSharedIns: fdispSharedIns, recruiting: frecruiting,
                              count: fcount, effNonTeams: feffNonTeams, effDrivers: feffDrivers,
                              subStats: new Map(includedSubStats.map((sub: any, i) => [i, sub]))
                          }]);
                      } else {
                          filteredDriversForStats.push([dName, s]);
                      }
                  });

                  let validDivisors = 0;
                  let fTotGross = 0, fTotMargin = 0, fTotPnL = 0, fTotRevColl = 0, fTotFuelRebate = 0, fTotWklyExp = 0, fTotPO = 0, fTotTolls = 0, fTotDispPay = 0, fTotDispGrossPay = 0, fTotDispMarginPay = 0, fTotDispFixedPay = 0, fTotDispSharedIns = 0, fTotRecruiting = 0;
                  let fAvgGross = 0, fAvgMargin = 0, fAvgPnL = 0, fAvgRevColl = 0, fAvgFuelRebate = 0, fAvgWklyExp = 0, fAvgPO = 0, fAvgTolls = 0, fAvgDispPay = 0, fAvgDispGrossPay = 0, fAvgDispMarginPay = 0, fAvgDispFixedPay = 0, fAvgDispSharedIns = 0, fAvgRecruiting = 0;

                  filteredDriversForStats.forEach(([dName, s]: [string, any]) => {
                      if (String(s.status).toUpperCase() !== 'TERMINATED') activeTotal++;
                      else terminatedTotal++;

                      if (s.subStats) {
                          Array.from(s.subStats.values()).forEach((sub: any) => {
                              const c = sub.contractType || 'Unassigned';
                              allUniqueContracts.add(c);
                              if (!contractDriverCounts.has(c)) contractDriverCounts.set(c, new Set());
                              contractDriverCounts.get(c)!.add(dName);
                          });
                      } else {
                          const c = s.contractType || 'Unassigned';
                          allUniqueContracts.add(c);
                          if (!contractDriverCounts.has(c)) contractDriverCounts.set(c, new Set());
                          contractDriverCounts.get(c)!.add(dName);
                      }

                      const divisor = s.effNonTeams > 0 ? s.effNonTeams : (s.effDrivers > 0 ? s.effDrivers : (s.count > 0 ? s.count : 1));
                      validDivisors += 1;
                      
                      fTotGross += s.gross;
                      fTotMargin += s.margin;
                      fTotPnL += s.pnl;
                      fTotRevColl += s.revColl;
                      fTotFuelRebate += s.fuelRebate;
                      fTotWklyExp += s.wklyExp;
                      fTotPO += s.po;
                      fTotTolls += s.tolls;
                      fTotDispPay += s.dispPay;
                      fTotDispGrossPay += s.dispGrossPay;
                      fTotDispMarginPay += s.dispMarginPay;
                      fTotDispFixedPay += s.dispFixedPay;
                      fTotDispSharedIns += s.dispSharedIns;
                      fTotRecruiting += s.recruiting;

                      fAvgGross += (s.gross / divisor);
                      fAvgMargin += (s.margin / divisor);
                      fAvgPnL += (s.pnl / divisor);
                      fAvgRevColl += (s.revColl / divisor);
                      fAvgFuelRebate += (s.fuelRebate / divisor);
                      fAvgWklyExp += (s.wklyExp / divisor);
                      fAvgPO += (s.po / divisor);
                      fAvgTolls += (s.tolls / divisor);
                      fAvgDispPay += (s.dispPay / divisor);
                      fAvgDispGrossPay += (s.dispGrossPay / divisor);
                      fAvgDispMarginPay += (s.dispMarginPay / divisor);
                      fAvgDispFixedPay += (s.dispFixedPay / divisor);
                      fAvgDispSharedIns += (s.dispSharedIns / divisor);
                      fAvgRecruiting += (s.recruiting / divisor);
                  });

                  displayGross = fTotGross;
                  displayMargin = fTotMargin;
                  displayPnL = fTotPnL;
                  displayRevColl = fTotRevColl;
                  displayFuelRebate = fTotFuelRebate;
                  displayWklyExp = fTotWklyExp;
                  displayPO = fTotPO;
                  displayTolls = fTotTolls;
                  displayDispPay = fTotDispPay;
                  displayDispGrossPay = fTotDispGrossPay;
                  displayDispMarginPay = fTotDispMarginPay;
                  displayDispFixedPay = fTotDispFixedPay;
                  displayDispSharedIns = fTotDispSharedIns;
                  displayRecruiting = fTotRecruiting;

                  if (validDivisors > 0) {
                      displayAvgGross = fAvgGross / validDivisors;
                      displayAvgMargin = fAvgMargin / validDivisors;
                      displayAvgPnL = fAvgPnL / validDivisors;
                      displayAvgRevColl = fAvgRevColl / validDivisors;
                      displayAvgFuelRebate = fAvgFuelRebate / validDivisors;
                      displayAvgWklyExp = fAvgWklyExp / validDivisors;
                      displayAvgPO = fAvgPO / validDivisors;
                      displayAvgTolls = fAvgTolls / validDivisors;
                      displayAvgDispPay = fAvgDispPay / validDivisors;
                      displayAvgDispGrossPay = fAvgDispGrossPay / validDivisors;
                      displayAvgDispMarginPay = fAvgDispMarginPay / validDivisors;
                      displayAvgDispFixedPay = fAvgDispFixedPay / validDivisors;
                      displayAvgDispSharedIns = fAvgDispSharedIns / validDivisors;
                      displayAvgRecruiting = fAvgRecruiting / validDivisors;
                  } else {
                      displayAvgGross = 0; displayAvgMargin = 0; displayAvgPnL = 0; displayAvgRevColl = 0; displayAvgFuelRebate = 0; displayAvgWklyExp = 0; displayAvgPO = 0; displayAvgTolls = 0; displayAvgDispPay = 0; displayAvgDispGrossPay = 0; displayAvgDispMarginPay = 0; displayAvgDispFixedPay = 0; displayAvgDispSharedIns = 0; displayAvgRecruiting = 0;
                  }

                  displayActiveCount = filteredDriversForStats.length;
              }

              const avgRank = disp.avgRank || 0;

              const severity = getSeverity(displayAvgPnL);
              let diagnosis = "Critical";
              let diagColor = "bg-rose-500/10 text-rose-500";
              
              if (severity === 'good') {
                diagnosis = "Good";
                diagColor = "bg-emerald-500/10 text-emerald-500";
              } else if (severity === 'neutral') {
                diagnosis = "Neutral";
                diagColor = "bg-yellow-400/10 text-yellow-400";
              } else if (severity === 'warning') {
                diagnosis = "Warning";
                diagColor = "bg-amber-500/10 text-amber-500";
              }

              return (
                <React.Fragment key={disp.id}>
                  <tr 
                    className={`hover:bg-zinc-900/50 cursor-pointer transition-colors ${expandedDispId === disp.id ? 'bg-zinc-800 z-20 relative [&>td]:border-t-2 [&>td]:border-emerald-500/50 [&>td:first-child]:border-l-2 [&>td:first-child]:border-emerald-500/50 [&>td:last-child]:border-r-2 [&>td:last-child]:border-emerald-500/50' : ''}`}
                    onClick={() => {
                      if (expandedDispId !== disp.id) { setExpandedTab('chart'); setChartFilter('all'); }
                      setExpandedDispId(prev => prev === disp.id ? null : disp.id);
                    }}
                  >
                    <td className={`px-2 py-1 font-sans flex items-center gap-2 text-zinc-200 sticky left-0 z-10 ${expandedDispId === disp.id ? 'bg-zinc-800' : 'bg-zinc-900'}`}>
                      {expandedDispId === disp.id ? <ChevronUp size={12} className="text-zinc-500" /> : <ChevronDown size={12} className="text-zinc-500" />}
                      <span className="font-semibold text-zinc-200">{disp.name}</span>
                    </td>
                    <td className="px-2 py-1 font-sans text-zinc-400">
                      {disp.teamName}
                    </td>
                    <td className="px-2 py-1 text-center">{displayActiveCount}</td>
                    {showAverages ? (
                      <>
                        <td className="px-2 py-1 text-right text-yellow-400 font-bold">{formatCurrency(displayAvgGross)}</td>
                        <td className="px-2 py-1 text-right text-yellow-400 font-bold">{formatCurrency(displayAvgMargin)}</td>
                        <td className="px-2 py-1 text-right text-purple-400">{formatCurrency(displayAvgRevColl)}</td>
                        <td className="px-2 py-1 text-right text-purple-400">{formatCurrency(displayAvgFuelRebate)}</td>
                        <td className="px-2 py-1 text-right text-purple-400">{formatCurrency(displayAvgWklyExp)}</td>
                        <td className="px-2 py-1 text-right text-purple-400">{formatCurrency(displayAvgPO)}</td>
                        <td className="px-2 py-1 text-right text-purple-400">{formatCurrency(displayAvgTolls)}</td>
                        <td onClick={(e) => { e.stopPropagation(); setIsDispPayExpanded(!isDispPayExpanded); }} className="px-2 py-1 text-right text-purple-400 cursor-pointer hover:bg-zinc-800 transition-colors">{formatCurrency(displayAvgDispPay)}</td>
                        {isDispPayExpanded && <td className="px-2 py-1 text-right text-zinc-400 bg-zinc-700/30">{formatCurrency(displayAvgDispGrossPay)}</td>}
                        {isDispPayExpanded && <td className="px-2 py-1 text-right text-zinc-400 bg-zinc-700/30">{formatCurrency(displayAvgDispMarginPay)}</td>}
                        {isDispPayExpanded && <td className="px-2 py-1 text-right text-zinc-400 bg-zinc-700/30">{formatCurrency(displayAvgDispFixedPay)}</td>}
                        {isDispPayExpanded && <td className="px-2 py-1 text-right text-zinc-400 bg-zinc-700/30">{formatCurrency(displayAvgDispSharedIns)}</td>}
                        <td className="px-2 py-1 text-right text-purple-400">{formatCurrency(displayAvgRecruiting)}</td>
                        <td className={`px-2 py-1 text-right font-bold sticky right-[160px] z-10 w-[90px] min-w-[90px] ${isExpanded ? 'bg-zinc-800' : 'bg-zinc-900'} ${displayAvgPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(displayAvgPnL)}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-1 text-right text-yellow-400">{formatCurrency(displayGross)}</td>
                        <td className="px-2 py-1 text-right text-yellow-400">{formatCurrency(displayMargin)}</td>
                        <td className="px-2 py-1 text-right text-purple-400">{formatCurrency(displayRevColl)}</td>
                        <td className="px-2 py-1 text-right text-purple-400">{formatCurrency(displayFuelRebate)}</td>
                        <td className="px-2 py-1 text-right text-purple-400">{formatCurrency(displayWklyExp)}</td>
                        <td className="px-2 py-1 text-right text-purple-400">{formatCurrency(displayPO)}</td>
                        <td className="px-2 py-1 text-right text-purple-400">{formatCurrency(displayTolls)}</td>
                        <td onClick={(e) => { e.stopPropagation(); setIsDispPayExpanded(!isDispPayExpanded); }} className="px-2 py-1 text-right text-purple-400 cursor-pointer hover:bg-zinc-800 transition-colors">{formatCurrency(displayDispPay)}</td>
                        {isDispPayExpanded && <td className="px-2 py-1 text-right text-zinc-400 bg-zinc-700/30">{formatCurrency(displayDispGrossPay)}</td>}
                        {isDispPayExpanded && <td className="px-2 py-1 text-right text-zinc-400 bg-zinc-700/30">{formatCurrency(displayDispMarginPay)}</td>}
                        {isDispPayExpanded && <td className="px-2 py-1 text-right text-zinc-400 bg-zinc-700/30">{formatCurrency(displayDispFixedPay)}</td>}
                        {isDispPayExpanded && <td className="px-2 py-1 text-right text-zinc-400 bg-zinc-700/30">{formatCurrency(displayDispSharedIns)}</td>}
                        <td className="px-2 py-1 text-right text-purple-400">{formatCurrency(displayRecruiting)}</td>
                        <td className={`px-2 py-1 text-right font-bold sticky right-[160px] z-10 w-[90px] min-w-[90px] ${isExpanded ? 'bg-zinc-800' : 'bg-zinc-900'} ${displayPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(displayPnL)}</td>
                      </>
                    )}
                    <td className={`px-2 py-1 text-right font-bold sticky right-[80px] z-10 w-[80px] min-w-[80px] ${expandedDispId === disp.id ? 'bg-zinc-800' : 'bg-zinc-900'} ${avgRank >= 80 ? 'text-emerald-400' : avgRank >= 50 ? 'text-yellow-400' : avgRank >= 20 ? 'text-amber-500' : 'text-rose-400'}`}>
                      {avgRank.toFixed(2)}%
                    </td>
                    <td className={`px-2 py-1 text-center sticky right-0 z-10 w-[80px] min-w-[80px] ${expandedDispId === disp.id ? 'bg-zinc-800' : 'bg-zinc-900'}`}>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${diagColor}`}>
                        {diagnosis}
                      </span>
                    </td>
                  </tr>
                  {isExpanded && (() => {
                    const activeConf = driverSettings?.['GLOBAL'] || {};
                    
                    const dispContracts = new Set<string>();
                    const dispCompanies = new Set<string>();
                    const dispFranchises = new Set<string>();
                    
                    Array.from(disp.driverStats.values()).forEach((s: any) => {
                        if (s.subStats) {
                            Array.from(s.subStats.values()).forEach((sub: any) => {
                                if (sub.contractType && sub.contractType !== 'Unassigned') dispContracts.add(sub.contractType);
                                if (sub.companyId && sub.companyId !== 'Unassigned') dispCompanies.add(sub.companyId);
                                if (sub.franchiseId && sub.franchiseId !== 'Unassigned') dispFranchises.add(sub.franchiseId);
                            });
                        }
                    });

                    const dynamicDiagnosis = getSeverityForMetric('pnl', displayAvgPnL, activeConf);
                    let diagLabel = "Critical";
                    if (dynamicDiagnosis === 'good') diagLabel = "Good";
                    else if (dynamicDiagnosis === 'neutral') diagLabel = "Neutral";
                    else if (dynamicDiagnosis === 'warning') diagLabel = "Warning";
                    
                    const getPayRulesTexts = () => {
                        const ruleGroups = new Map<string, string[]>();
                        allUniqueContracts.forEach(ct => {
                            let rule = fixedExpenses.find(e => String(e.name).trim().toLowerCase().includes('dispatcher pay') && (e.dispatcher_name === disp.name || e.dispatcherName === disp.name || e.dispatcher_id === disp.name) && (e.contract_type === ct || e.contractType === ct));
                            
                            if (!rule) rule = fixedExpenses.find(e => String(e.name).trim().toLowerCase().includes('dispatcher pay') && (e.dispatcher_name === disp.name || e.dispatcherName === disp.name || e.dispatcher_id === disp.name) && (!e.contract_type || e.contract_type === 'ALL' || e.contractType === 'ALL'));
                            
                            if (!rule) rule = fixedExpenses.find(e => String(e.name).trim().toLowerCase().includes('dispatcher pay') && (!e.dispatcher_name || e.dispatcher_name === 'ALL') && (e.contract_type === ct || e.contractType === ct));
                            
                            if (!rule) rule = fixedExpenses.find(e => String(e.name).trim().toLowerCase().includes('dispatcher pay') && (!e.dispatcher_name || e.dispatcher_name === 'ALL') && (!e.contract_type || e.contract_type === 'ALL' || e.contractType === 'ALL'));
                            
                            let ruleDesc = 'Standard Rule';
                            if (rule) {
                                const g = rule.disp_gross_perc || rule.dispatcher_gross_percent || rule.dispGrossPerc || 0;
                                const m = rule.disp_margin_perc || rule.dispatcher_margin_percent || rule.dispMarginPerc || 0;
                                const a = rule.amount || 0;
                                if (g || m) ruleDesc = `${g}% Gross, ${m}% Margin`;
                                else if (a) ruleDesc = `$${a} Fixed`;
                                else ruleDesc = 'Custom Rule';
                            }
                            
                            const existing = ruleGroups.get(ruleDesc) || [];
                            existing.push(ct);
                            ruleGroups.set(ruleDesc, existing);
                        });
                        
                        const result: string[] = [];
                        Array.from(ruleGroups.entries()).forEach(([desc, contracts]) => {
                            if (contracts.length === allUniqueContracts.size && allUniqueContracts.size > 0) {
                                result.push(`All Contracts: ${desc}`);
                            } else if (contracts.length >= 3) {
                                result.push(`Base/Others: ${desc}`);
                            } else {
                                result.push(`${contracts.join(', ')}: ${desc}`);
                            }
                        });
                        return result;
                    };
                    const payRules = getPayRulesTexts();

                    const dispPerfStats = [
                      { name: 'Gross', val: displayAvgGross, severity: getSeverityForMetric('gross', displayAvgGross, activeConf) },
                      { name: 'Margin', val: displayAvgMargin, severity: getSeverityForMetric('margin', displayAvgMargin, activeConf) },
                      { name: 'Rev. Col.', val: displayAvgRevColl, severity: getSeverityForMetric('revCol', displayAvgRevColl, activeConf) },
                      { name: 'Fuel Reb.', val: displayAvgFuelRebate, severity: getSeverityForMetric('fuelReb', displayAvgFuelRebate, activeConf) },
                      { name: 'Wkly Exp.', val: -displayAvgWklyExp, severity: getSeverityForMetric('wklyExp', -displayAvgWklyExp, activeConf) },
                      { name: 'Tolls', val: -displayAvgTolls, severity: getSeverityForMetric('tolls', -displayAvgTolls, activeConf) },
                      { name: 'PO', val: displayAvgPO, severity: getSeverityForMetric('po', displayAvgPO, activeConf) },
                      { name: 'Disp. Pay', val: displayAvgDispPay, severity: getSeverityForMetric('dispPay', displayAvgDispPay, activeConf) },
                      { name: 'Recruiting', val: displayAvgRecruiting, severity: getSeverityForMetric('recruiting', displayAvgRecruiting, activeConf) }
                    ].filter(x => x.severity !== 'ignored');

                    const dispIssues: any[] = [];
                    dispPerfStats.forEach(m => {
                      if (m.severity === 'critical') dispIssues.push({ label: `Critical ${m.name} Level`, severity: m.severity });
                      else if (m.severity === 'warning') dispIssues.push({ label: `Warning ${m.name} Level`, severity: m.severity });
                    });

                    return (
                      <tr className="bg-zinc-950/50 relative z-50 [&>td]:border-b-2 [&>td]:border-l-2 [&>td]:border-r-2 [&>td]:border-emerald-500/50">
                        <td colSpan={isDispPayExpanded ? 19 : 15} className="p-0 border-b border-zinc-800 relative z-50 overflow-visible">
                          <div className="sticky left-0 p-4 z-50 overflow-visible" style={{ width: 'var(--visible-width, calc(100vw - 40px))' }}>
                            <div className={`grid grid-cols-1 ${expandedTab === 'list' ? 'md:grid-cols-1' : 'md:grid-cols-3'} gap-4 h-[260px] items-stretch`}>
                              
                              <div className={`${expandedTab === 'list' ? '' : 'md:col-span-2'} flex gap-4 h-full min-h-0`}>
                                <div className="w-[220px] flex-shrink-0 flex flex-col h-full min-h-0">
                                  
                                  <div className="bg-zinc-900/40 border border-zinc-800 p-3 rounded flex flex-col gap-2 flex-1 overflow-y-auto">
                                    <div className="text-[10px] text-zinc-500 uppercase font-bold border-b border-zinc-800/50 pb-1.5 mb-0.5 flex-shrink-0">Info & Rules</div>
                                    
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-zinc-400 font-semibold">Active Drivers:</span>
                                        <span className="text-[11px] font-bold text-emerald-500">{activeTotal}</span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-zinc-400 font-semibold">Terminated:</span>
                                        <span className="text-[11px] font-bold text-rose-500">{terminatedTotal}</span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex flex-col gap-1 mt-1 pt-2 border-t border-zinc-800/50">
                                      <span className="text-[9px] text-zinc-500 font-bold uppercase mb-0.5">Historical Contracts</span>
                                      {Array.from(contractDriverCounts.entries()).map(([cName, dSet]) => (
                                          <div key={cName} className="flex items-center justify-between pl-1 py-0.5">
                                              <span className="text-[10px] text-zinc-400">{cName}:</span>
                                              <span className="text-[11px] font-bold text-zinc-300">{dSet.size} <span className="text-[9px] text-zinc-500 font-normal">drv.</span></span>
                                          </div>
                                      ))}
                                    </div>

                                    <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-zinc-800/50">
                                      <span className="text-[10px] text-zinc-400 font-semibold mb-1">Dispatcher Pay Rules:</span>
                                      <div className="flex flex-col gap-1.5">
                                        {payRules.map((rule, idx) => (
                                          <span key={idx} className="text-[9px] text-emerald-400 font-bold break-words leading-tight bg-zinc-800/50 p-1.5 rounded border border-zinc-700/50 text-left">
                                            {rule}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex-1 flex flex-col min-w-0 h-full min-h-0">
                                  <div className="flex justify-between items-center gap-3 mb-2 flex-shrink-0">
                                      <div className="flex items-center gap-3">
                                          <div className="flex bg-zinc-900 rounded border border-zinc-700 p-0.5 w-max">
                                            <button onClick={() => setExpandedTab('chart')} className={`px-4 py-1.5 text-[11px] font-bold rounded flex items-center justify-center gap-1.5 transition-colors ${expandedTab === 'chart' ? 'bg-zinc-800 text-emerald-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}><Activity size={12}/> Chart</button>
                                            <button onClick={() => setExpandedTab('list')} className={`px-4 py-1.5 text-[11px] font-bold rounded flex items-center justify-center gap-1.5 transition-colors ${expandedTab === 'list' ? 'bg-zinc-800 text-emerald-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}><List size={12}/> Drivers List</button>
                                          </div>
                                          <select value={chartFilter} onChange={(e) => setChartFilter(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-300 outline-none focus:border-emerald-500 w-[140px] cursor-pointer h-[27px]">
                                            <option value="all">View: All</option>
                                            <option value="active">Active Only</option>
                                            <option value="terminated">Terminated Only</option>
                                            {dispContracts.size > 0 && <optgroup label="Contracts">
                                                {Array.from(dispContracts).map(c => <option key={`ctr_${c}`} value={`CTR:${c}`}>Contract: {c}</option>)}
                                            </optgroup>}
                                            {dispCompanies.size > 0 && <optgroup label="Companies">
                                                {Array.from(dispCompanies).map(c => <option key={`cmp_${c}`} value={`CMP:${c}`}>Company: {c}</option>)}
                                            </optgroup>}
                                            {dispFranchises.size > 0 && <optgroup label="Franchises">
                                                {Array.from(dispFranchises).map(c => <option key={`fra_${c}`} value={`FRA:${c}`}>Franchise: {c}</option>)}
                                            </optgroup>}
                                            <optgroup label="Drivers">
                                                {Array.from(disp.uniqueDrivers).map((dName: any) => <option key={dName} value={dName}>{dName}</option>)}
                                            </optgroup>
                                          </select>
                                      </div>
                                      
                                      {expandedTab === 'chart' && (
                                        <div className="flex items-center gap-2">
                                          <details className="relative group">
                                            <summary className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-400 outline-none hover:border-emerald-500 cursor-pointer list-none flex items-center gap-2">
                                              <Filter size={10} /> Metrics ({selectedMetrics.length}) <ChevronDown size={10} />
                                            </summary>
                                            <div className="absolute top-full right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded shadow-2xl z-[100] w-56 p-1 flex flex-col gap-0.5 max-h-[240px] overflow-y-auto">
                                              {['gross', 'gross avg/w', 'margin', 'margin avg/w', 'disp. pay', 'disp. pay avg/w', 'wkly exp', 'wkly exp avg/w', 'revenue collected', 'revenue collected avg/w', 'tolls', 'tolls avg/w', 'po', 'po avg/w', 'recruiting', 'recruiting avg/w', 'pnl', 'pnl avg/w'].map(m => (
                                                <label key={m} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800 rounded cursor-pointer text-[10px] text-zinc-300 capitalize" onClick={e => e.stopPropagation()}>
                                                  <input type="checkbox" className="accent-emerald-500" checked={selectedMetrics.includes(m)} onChange={() => toggleMetric(m)} />
                                                  {m.replace('revenue collected', 'rev. col.')}
                                                </label>
                                              ))}
                                            </div>
                                          </details>
                                          <div className="flex bg-zinc-950 border border-zinc-800 rounded overflow-hidden">
                                            <button onClick={() => setChartType('line')} className={`px-2 py-1 flex items-center justify-center transition-colors cursor-pointer ${chartType === 'line' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}>
                                              <LineChartIcon size={12} />
                                            </button>
                                            <button onClick={() => setChartType('bar')} className={`px-2 py-1 border-l border-zinc-800 flex items-center justify-center transition-colors cursor-pointer ${chartType === 'bar' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}>
                                              <BarChart2 size={12} />
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                  </div>
                                  
                                  {expandedTab === 'chart' && (
                                    <div className="flex-1 min-h-0 bg-zinc-900/10 rounded border border-zinc-800">
                                      <HistoricalChart 
                                        data={getChartData(disp.name, disp.teamName)} 
                                        series={activeSeries} 
                                        type={chartType} 
                                      />
                                    </div>
                                  )}

                                  {expandedTab === 'list' && (
                                    <div className="flex-1 min-h-0 h-full overflow-y-auto overflow-x-auto border border-zinc-800 rounded bg-zinc-900 relative">
                                      <table className="w-full text-left text-[11px] whitespace-nowrap relative h-max">
                                        <thead className="bg-zinc-800 text-zinc-400 font-medium uppercase tracking-wider sticky top-0 z-20 shadow-md">
                                          <tr>
                                            <th className="px-2 py-1.5 border-b border-zinc-700 sticky left-0 bg-zinc-800 z-30">Driver Name</th>
                                            <th className="px-2 py-1.5 border-b border-zinc-700">Company</th>
                                            <th className="px-2 py-1.5 border-b border-zinc-700">Contract</th>
                                            <th className="px-2 py-1.5 border-b border-zinc-700">Franchise</th>
                                            <th className="px-2 py-1.5 text-right border-b border-zinc-700">Gross</th>
                                            <th className="px-2 py-1.5 text-right border-b border-zinc-700">Margin</th>
                                            <th className="px-2 py-1.5 text-right border-b border-zinc-700">Rev. Coll.</th>
                                            <th className="px-2 py-1.5 text-right border-b border-zinc-700">Fuel Reb.</th>
                                            <th className="px-2 py-1.5 text-right border-b border-zinc-700">Wkly Exp</th>
                                            <th className="px-2 py-1.5 text-right border-b border-zinc-700">PO</th>
                                            <th className="px-2 py-1.5 text-right border-b border-zinc-700">Tolls</th>
                                            <th onClick={() => setIsDispPayExpanded(!isDispPayExpanded)} className="px-2 py-1.5 text-right border-b border-zinc-700 cursor-pointer hover:text-white flex items-center justify-end gap-1">Disp Pay {isDispPayExpanded ? <ChevronLeft size={10}/> : <ChevronRight size={10}/>}</th>
                                            {isDispPayExpanded && <th className="px-2 py-1.5 text-right border-b border-zinc-700 bg-zinc-700/50 text-zinc-300">Gross Pay</th>}
                                            {isDispPayExpanded && <th className="px-2 py-1.5 text-right border-b border-zinc-700 bg-zinc-700/50 text-zinc-300">Margin Pay</th>}
                                            {isDispPayExpanded && <th className="px-2 py-1.5 text-right border-b border-zinc-700 bg-zinc-700/50 text-zinc-300">Fixed Pay</th>}
                                            {isDispPayExpanded && <th className="px-2 py-1.5 text-right border-b border-zinc-700 bg-zinc-700/50 text-zinc-300">Shared Ins.</th>}
                                            <th className="px-2 py-1.5 text-right border-b border-zinc-700">Recruiting</th>
                                            <th className="px-2 py-1.5 text-right border-b border-zinc-700 font-bold text-emerald-400 sticky right-[80px] bg-zinc-800 z-30">PnL</th>
                                            <th className="px-2 py-1.5 text-center border-b border-zinc-700 sticky right-0 bg-zinc-800 z-30 w-[80px] min-w-[80px]">Diagnosis</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800/50">
                                          {filteredDriversForStats.sort((a:any, b:any) => b[1].pnl - a[1].pnl).map(([dName, s]: [string, any]) => {
                                            const divisor = s.effNonTeams > 0 ? s.effNonTeams : (s.effDrivers > 0 ? s.effDrivers : (s.count > 0 ? s.count : 1));
                                            const drvAvgPnL = s.pnl / divisor;
                                            const drvSeverity = getSeverityForMetric('pnl', drvAvgPnL, activeConf);
                                            let drvDiagnosis = "Critical";
                                            let drvDiagColor = "bg-rose-500/10 text-rose-500";
                                            if (drvSeverity === 'good') { drvDiagnosis = "Good"; drvDiagColor = "bg-emerald-500/10 text-emerald-500"; }
                                            else if (drvSeverity === 'neutral') { drvDiagnosis = "Neutral"; drvDiagColor = "bg-yellow-400/10 text-yellow-400"; }
                                            else if (drvSeverity === 'warning') { drvDiagnosis = "Warning"; drvDiagColor = "bg-amber-500/10 text-amber-500"; }

                                            const uniqueCompanies = new Set(s.subStats ? Array.from(s.subStats.values()).map((sub: any) => sub.companyId) : [s.companyId]);
                                            const uniqueContracts = new Set(s.subStats ? Array.from(s.subStats.values()).map((sub: any) => sub.contractType) : [s.contractType]);
                                            const uniqueFranchises = new Set(s.subStats ? Array.from(s.subStats.values()).map((sub: any) => sub.franchiseId) : [s.franchiseId]);
                                            
                                            const hasMultipleCompanies = uniqueCompanies.size > 1;
                                            const hasMultipleContracts = uniqueContracts.size > 1;
                                            const hasMultipleFranchises = uniqueFranchises.size > 1;

                                            const getPrimary = (set: Set<any>, fallback: any) => Array.from(set).find(x => x && x !== 'Unassigned') || fallback || '-';

                                            const hasMultiple = s.subStats && s.subStats.size > 1;
                                            const isSubExpanded = expandedSubDriverId === `${disp.id}_${dName}`;

                                            return (
                                              <React.Fragment key={dName}>
                                                <tr className={s.isExcluded ? 'opacity-40' : `hover:bg-zinc-800/50 ${hasMultiple ? 'cursor-pointer' : ''}`} onClick={() => hasMultiple && setExpandedSubDriverId(prev => prev === `${disp.id}_${dName}` ? null : `${disp.id}_${dName}`)}>
                                                  <td className="px-2 py-1 text-zinc-300 flex items-center gap-1.5 sticky left-0 bg-zinc-900 z-10 border-r border-zinc-800/30">
                                                    {hasMultiple ? (isSubExpanded ? <ChevronUp size={12} className="text-zinc-500 hover:text-emerald-400"/> : <ChevronDown size={12} className="text-zinc-500 hover:text-emerald-400"/>) : <span className="w-[12px] shrink-0" />}
                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${String(s.status).toUpperCase() === 'TERMINATED' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                                    <span className="truncate">{dName}</span>
                                                  </td>
                                                  <td className="px-2 py-1 text-zinc-400">{hasMultipleCompanies ? <span className="text-[9px] uppercase px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded shadow-sm border border-zinc-700/50">Multiple</span> : getPrimary(uniqueCompanies, s.companyId)}</td>
                                                  <td className="px-2 py-1 text-zinc-400">{hasMultipleContracts ? <span className="text-[9px] uppercase px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded shadow-sm border border-zinc-700/50">Multiple</span> : getPrimary(uniqueContracts, s.contractType)}</td>
                                                  <td className="px-2 py-1 text-zinc-400">{hasMultipleFranchises ? <span className="text-[9px] uppercase px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded shadow-sm border border-zinc-700/50">Multiple</span> : getPrimary(uniqueFranchises, s.franchiseId)}</td>
                                                  <td className="px-2 py-1 text-right text-yellow-400/70">{formatCurrency(showAverages ? s.gross/divisor : s.gross)}</td>
                                                  <td className="px-2 py-1 text-right text-yellow-400/70">{formatCurrency(showAverages ? s.margin/divisor : s.margin)}</td>
                                                  <td className="px-2 py-1 text-right text-purple-400/70">{formatCurrency(showAverages ? s.revColl/divisor : s.revColl)}</td>
                                                  <td className="px-2 py-1 text-right text-purple-400/70">{formatCurrency(showAverages ? s.fuelRebate/divisor : s.fuelRebate)}</td>
                                                  <td className="px-2 py-1 text-right text-purple-400/70">{formatCurrency(showAverages ? s.wklyExp/divisor : s.wklyExp)}</td>
                                                  <td className="px-2 py-1 text-right text-purple-400/70">{formatCurrency(showAverages ? s.po/divisor : s.po)}</td>
                                                  <td className="px-2 py-1 text-right text-purple-400/70">{formatCurrency(showAverages ? s.tolls/divisor : s.tolls)}</td>
                                                  <td onClick={(e) => { e.stopPropagation(); setIsDispPayExpanded(!isDispPayExpanded); }} className="px-2 py-1 text-right text-purple-400/70 cursor-pointer hover:bg-zinc-800 transition-colors">{formatCurrency(showAverages ? s.dispPay/divisor : s.dispPay)}</td>
                                                  {isDispPayExpanded && <td className="px-2 py-1 text-right text-zinc-400/80 bg-zinc-700/30">{formatCurrency(showAverages ? s.dispGrossPay/divisor : s.dispGrossPay)}</td>}
                                                  {isDispPayExpanded && <td className="px-2 py-1 text-right text-zinc-400/80 bg-zinc-700/30">{formatCurrency(showAverages ? s.dispMarginPay/divisor : s.dispMarginPay)}</td>}
                                                  {isDispPayExpanded && <td className="px-2 py-1 text-right text-zinc-400/80 bg-zinc-700/30">{formatCurrency(showAverages ? s.dispFixedPay/divisor : s.dispFixedPay)}</td>}
                                                  {isDispPayExpanded && <td className="px-2 py-1 text-right text-zinc-400/80 bg-zinc-700/30">{formatCurrency(showAverages ? s.dispSharedIns/divisor : s.dispSharedIns)}</td>}
                                                  <td className="px-2 py-1 text-right text-purple-400/70">{formatCurrency(showAverages ? s.recruiting/divisor : s.recruiting)}</td>
                                                  <td className={`px-2 py-1 text-right font-bold sticky right-[80px] bg-zinc-900 z-10 ${drvAvgPnL >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>{formatCurrency(showAverages ? drvAvgPnL : s.pnl)}</td>
                                                  <td className="px-2 py-1 text-center sticky right-0 bg-zinc-900 z-10 w-[80px] min-w-[80px]"><span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${drvDiagColor}`}>{drvDiagnosis}</span></td>
                                                </tr>
                                                {isSubExpanded && s.subStats && Array.from(s.subStats.values()).map((sub: any, idx: number) => {
                                                  const subDivisor = sub.effNonTeams > 0 ? sub.effNonTeams : (sub.effDrivers > 0 ? sub.effDrivers : (sub.count > 0 ? sub.count : 1));
                                                  const subAvgPnL = sub.pnl / subDivisor;
                                                  return (
                                                    <tr key={`${dName}_sub_${idx}`} className="bg-zinc-950/60 hover:bg-zinc-900/60">
                                                      <td className="px-2 py-1 text-zinc-500 flex items-center pl-6 sticky left-0 bg-zinc-950/60 z-10 border-r border-zinc-800/30 text-[10px]">
                                                        <div className="w-3 h-3 border-l border-b border-zinc-600 rounded-bl mr-2 -mt-2"></div>
                                                        Period Split
                                                      </td>
                                                      <td className="px-2 py-1 text-zinc-500">{sub.companyId || '-'}</td>
                                                      <td className="px-2 py-1 text-zinc-500">{sub.contractType || '-'}</td>
                                                      <td className="px-2 py-1 text-zinc-500">{sub.franchiseId || '-'}</td>
                                                      <td className="px-2 py-1 text-right text-yellow-400/40">{formatCurrency(showAverages ? sub.gross/subDivisor : sub.gross)}</td>
                                                      <td className="px-2 py-1 text-right text-yellow-400/40">{formatCurrency(showAverages ? sub.margin/subDivisor : sub.margin)}</td>
                                                      <td className="px-2 py-1 text-right text-purple-400/40">{formatCurrency(showAverages ? sub.revColl/subDivisor : sub.revColl)}</td>
                                                      <td className="px-2 py-1 text-right text-purple-400/40">{formatCurrency(showAverages ? sub.fuelRebate/subDivisor : sub.fuelRebate)}</td>
                                                      <td className="px-2 py-1 text-right text-purple-400/40">{formatCurrency(showAverages ? sub.wklyExp/subDivisor : sub.wklyExp)}</td>
                                                      <td className="px-2 py-1 text-right text-purple-400/40">{formatCurrency(showAverages ? sub.po/subDivisor : sub.po)}</td>
                                                      <td className="px-2 py-1 text-right text-purple-400/40">{formatCurrency(showAverages ? sub.tolls/subDivisor : sub.tolls)}</td>
                                                      <td className="px-2 py-1 text-right text-purple-400/40">{formatCurrency(showAverages ? sub.dispPay/subDivisor : sub.dispPay)}</td>
                                                      {isDispPayExpanded && <td className="px-2 py-1 text-right text-zinc-500 bg-zinc-700/20">{formatCurrency(showAverages ? sub.dispGrossPay/subDivisor : sub.dispGrossPay)}</td>}
                                                      {isDispPayExpanded && <td className="px-2 py-1 text-right text-zinc-500 bg-zinc-700/20">{formatCurrency(showAverages ? sub.dispMarginPay/subDivisor : sub.dispMarginPay)}</td>}
                                                      {isDispPayExpanded && <td className="px-2 py-1 text-right text-zinc-500 bg-zinc-700/20">{formatCurrency(showAverages ? sub.dispFixedPay/subDivisor : sub.dispFixedPay)}</td>}
                                                      {isDispPayExpanded && <td className="px-2 py-1 text-right text-zinc-500 bg-zinc-700/20">{formatCurrency(showAverages ? sub.dispSharedIns/subDivisor : sub.dispSharedIns)}</td>}
                                                      <td className="px-2 py-1 text-right text-purple-400/40">{formatCurrency(showAverages ? sub.recruiting/subDivisor : sub.recruiting)}</td>
                                                      <td className={`px-2 py-1 text-right font-bold sticky right-[80px] bg-zinc-950/60 z-10 ${subAvgPnL >= 0 ? 'text-emerald-500/40' : 'text-rose-500/40'}`}>{formatCurrency(showAverages ? subAvgPnL : sub.pnl)}</td>
                                                      <td className="px-2 py-1 sticky right-0 bg-zinc-950/60 z-10 w-[80px] min-w-[80px]"></td>
                                                    </tr>
                                                  )
                                                })}
                                              </React.Fragment>
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {expandedTab === 'chart' && (
                                <div className="bg-zinc-900 border border-zinc-800 rounded p-3 flex flex-col h-full relative z-20">
                                <div className="flex items-center justify-between mb-3 bg-zinc-950/80 p-2.5 rounded-md border border-zinc-800/80 shadow-md">
                                  <div className="flex items-center gap-3">
                                   <h4 className="text-xs font-black text-zinc-100 uppercase tracking-wider">
                                      PnL Diagnosis
                                      <span className={`ml-2 font-mono ${diagLabel === 'Good' ? 'text-emerald-400' : diagLabel === 'Neutral' ? 'text-yellow-400' : diagLabel === 'Warning' ? 'text-amber-500' : 'text-rose-500'}`}>Avg: {formatCurrency(displayAvgPnL)}</span>
                                    </h4>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${
                                      diagLabel === 'Good' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_8px_-2px_rgba(16,185,129,0.4)]' :
                                      diagLabel === 'Neutral' ? 'bg-yellow-400/20 text-yellow-400 border-yellow-400/50 shadow-[0_0_8px_-2px_rgba(250,204,21,0.4)]' :
                                      diagLabel === 'Warning' ? 'bg-amber-500/20 text-amber-500 border-amber-500/50 shadow-[0_0_8px_-2px_rgba(245,158,11,0.4)]' :
                                      'bg-rose-500/20 text-rose-500 border-rose-500/50 shadow-[0_0_8px_-2px_rgba(244,63,94,0.4)]'
                                    }`}>{diagLabel}</span>
                                  </div>
                                  <div className="group relative cursor-help text-zinc-400 hover:text-emerald-400 transition-colors">
                                    <Info size={14} />
                                    <div className="hidden group-hover:block absolute right-0 top-full mt-2 w-80 bg-zinc-800 text-zinc-200 text-[10px] p-3 rounded shadow-xl normal-case font-normal z-[100] pointer-events-none text-left border border-zinc-600 whitespace-normal break-words leading-tight">
                                      <div className="font-bold text-emerald-400 mb-2">Active Diagnosis Settings</div>
                                      <div className="grid grid-cols-2 gap-2">
                                        {['pnl', 'gross', 'margin', 'netPay', 'dispPay', 'fuel', 'revCol', 'fuelReb', 'wklyExp', 'tolls', 'po', 'recruiting'].map(mId => {
                                           const rule = activeConf?.[mId];
                                           if (!rule || (Number(rule.redMax) === 0 && Number(rule.greenMin) === 0 && Number(rule.orangeMax) === 0)) return null;
                                           const isRev = Number(rule.greenMin) >= Number(rule.redMax);
                                           return (
                                             <div key={mId} className="mb-1">
                                               <div className="font-bold text-zinc-300 border-b border-zinc-700 pb-0.5 capitalize">{mId.replace(/([A-Z])/g, ' $1').trim()}</div>
                                               <ul className="space-y-0.5 ml-1 mt-0.5 text-[9px]">
                                                 <li><span className="text-emerald-500 font-bold">Good:</span> {isRev ? '≥' : '≤'} {rule.greenMin}</li>
                                                 <li><span className="text-yellow-400 font-bold">Neutral:</span> {rule.yellowMin} to {rule.yellowMax}</li>
                                                 <li><span className="text-amber-500 font-bold">Warn:</span> {rule.orangeMin} to {rule.orangeMax}</li>
                                                 <li><span className="text-rose-500 font-bold">Crit:</span> {isRev ? '≤' : '≥'} {rule.redMax}</li>
                                               </ul>
                                             </div>
                                           );
                                        })}
                                      </div>
                                    </div>
                                 </div>
                                </div>

                                <div className="flex-1 mb-2">
                                  {dispIssues.length === 0 ? (
                                    <div className="flex items-center text-emerald-500 text-xs gap-2">
                                      <CheckCircle size={14} /><span>Optimal Performance</span>
                                    </div>
                                  ) : (
                                    <ul className="space-y-1">
                                      {dispIssues.map((issue, idx) => (
                                        <li key={idx} className="flex items-center justify-between text-[10px]">
                                          <div className="flex items-center gap-1.5">
                                            {issue.severity === 'critical' ? (
                                              <AlertTriangle size={10} className="text-rose-500" />
                                            ) : (
                                              <AlertTriangle size={10} className="text-amber-500" />
                                            )}
                                            <span className="text-zinc-300">{issue.label}</span>
                                          </div>
                                          <span className={issue.severity === 'critical' ? 'text-rose-500 font-bold' : 'text-amber-500 font-bold'}>
                                            {issue.severity === 'critical' ? 'Alert' : 'Warning'}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                                <div className="mt-auto pt-2 border-t border-zinc-800 space-y-1">
                                   {dispPerfStats.map(stat => {
                                      const getTextColor = (severity: string) => {
                                         if (severity === 'good') return 'text-emerald-500';
                                         if (severity === 'neutral') return 'text-yellow-400';
                                         if (severity === 'warning') return 'text-amber-500';
                                         return 'text-rose-500';
                                      };
                                      
                                      const getIcon = (severity: string) => {
                                        if (severity === 'good') return <CheckCircle size={10} className="text-emerald-500" />;
                                        if (severity === 'neutral') return <Info size={10} className="text-yellow-400" />;
                                        if (severity === 'warning') return <AlertTriangle size={10} className="text-amber-500" />;
                                        return <AlertTriangle size={10} className="text-rose-500" />;
                                      };

                                      return (
                                         <div key={stat.name} className="flex items-center justify-between text-[10px]">
                                            <div className="flex items-center gap-1.5">
                                               {stat.val === null ? <Circle size={10} className="text-zinc-600" /> : getIcon(stat.severity)}
                                               <span className="text-zinc-500">{stat.name} Avg</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                               <span className={`font-bold text-right ${getTextColor(stat.severity)}`}>
                                                 {stat.val === null ? 'N/A' : (stat.name === 'Fuel' ? (stat.val < 0 ? `-$${Math.abs(stat.val).toFixed(2)}` : `$${stat.val.toFixed(2)}`) : formatCurrency(stat.val))}
                                               </span>
                                            </div>
                                         </div>
                                      );
                                   })}
                                </div>
                              </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })()}
                </React.Fragment>
              );
            })}
          </tbody>
          
                  </table>
      </div>
    </div>
  );
};

export default DispatcherTable;