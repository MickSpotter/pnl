import React, { useState, useEffect } from 'react';
import { DriverPerformance, DispatcherTier } from '../types';
import { formatCurrency, formatPercent } from '../utils';
import { Users, ChevronDown, ChevronUp, AlertCircle, DollarSign, Filter, Search } from 'lucide-react';
import { getRawMetrics } from './DriverTable';
import { supabase } from '../lib/supabase';
import TableFilter, { FilterRule } from './TableFilter';

interface DispatcherTableProps {
  drivers: DriverPerformance[];
}

const DispatcherTable: React.FC<DispatcherTableProps> = ({ drivers }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'totalMargin', direction: 'desc' });
  const [expandedDispId, setExpandedDispId] = useState<string | null>(null);
  const [tableFilters, setTableFilters] = useState<FilterRule[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<any[]>([]);
  const [pnlConfigs, setPnlConfigs] = useState<any[]>([]);
  const [driverSettings, setDriverSettings] = useState<any>({});

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
    loadPnlConfigs();
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
    return drivers.filter(d => allowedDates.has(d.payDate));
  }, [drivers]);

  const enrichedMap = React.useMemo(() => {
    const map = new Map<string, any>();
    ((window as any).__ENRICHED_DRIVERS__ || []).forEach((ed: any) => {
      map.set(`${ed.name}_${ed.payDate}_${ed.contractType}_${ed.companyId}`, ed);
    });
    return map;
  }, [drivers]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
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
        const m = getRawMetrics(d, fixedExpenses, enrichedMap, pnlConfigs);
        const stats = globalDriverStats.get(d.name);
      stats.gross += (d.grossRevenue || d.driver_gross || 0);
      stats.margin += (d.marginAmount || 0);
      stats.pnl += m.pnl;
      stats.count += 1;
      stats.effNonTeams += (d.effectiveNonTeams || 0);
      stats.effDrivers += (d.effectiveDrivers || 0);
    });

    const rankedDrivers = Array.from(globalDriverStats.entries()).map(([name, s]) => {
      const divisor = s.effNonTeams > 0 ? s.effNonTeams : (s.effDrivers > 0 ? s.effDrivers : (s.count > 0 ? s.count : 1));
      return { name, avgPnL: s.pnl / divisor };
    }).sort((a, b) => a.avgPnL - b.avgPnL);

    const driverRanks = new Map();
    rankedDrivers.forEach((d, i) => {
      driverRanks.set(d.name, rankedDrivers.length > 1 ? (i / (rankedDrivers.length - 1)) * 100 : 100);
    });

    const teamMap = new Map();

    validDrivers.forEach(driver => {
              const nameLower = (driver.name || '').toLowerCase();
              const compLower = (driver.companyId || '').toLowerCase();
              if (nameLower.includes('unassigned') || nameLower.includes('unreconciled') || compLower.includes('unassigned') || compLower.includes('unreconciled')) return;
              
              const m = getRawMetrics(driver, fixedExpenses, enrichedMap, pnlConfigs);
              const isStub = (driver as any).isStub || ((driver.effectiveDrivers || 0) === 0 && (Math.abs(m.totalPOCov || 0) > 0 || Math.abs(m.totalPO || 0) > 0 || Math.abs(driver.tolls || driver.tollCost || 0) > 0));

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
                  uniqueDrivers: new Set(),
                  grossRecordCount: 0,
                  marginRecordCount: 0,
                  payDates: new Set(),
                  driverStats: new Map()
                });
              }

              const disp = team.dispatchers.get(dispatcherId);

      const pnl = m.pnl;
      const gross = driver.grossRevenue || (driver as any).driver_gross || 0;
      const margin = driver.marginAmount || 0;

      team.totalMargin += margin;
      team.totalPnL += pnl;

      disp.totalMargin += margin;
      disp.grossRevenue += gross;
      disp.totalPnL += pnl;
      disp.uniqueDrivers.add(driver.name);

      if (!disp.driverStats.has(driver.name)) {
        disp.driverStats.set(driver.name, { gross: 0, margin: 0, pnl: 0, count: 0, effNonTeams: 0, effDrivers: 0, latestDate: driver.payDate || '1970-01-01', status: driver.status });
      }
      const stats = disp.driverStats.get(driver.name);
      stats.gross += gross;
      stats.margin += margin;
      stats.pnl += pnl;
      stats.count += 1;
      stats.effNonTeams += (driver.effectiveNonTeams || 0);
      stats.effDrivers += (driver.effectiveDrivers || 0);
      const dDate = new Date(driver.payDate || '1970-01-01').getTime();
      const aggDate = new Date(stats.latestDate).getTime();
      if (dDate > aggDate || (dDate === aggDate && String(driver.status).toUpperCase() === 'TERMINATED')) {
         stats.latestDate = driver.payDate || '1970-01-01';
         stats.status = driver.status;
      }

      if (gross !== 0) disp.grossRecordCount += 1;
      if (margin !== 0) disp.marginRecordCount += 1;
      
      if (driver.payDate) {
        disp.payDates.add(driver.payDate);
      }
    });

    const allRawDisps = Array.from(teamMap.values()).flatMap(team => 
      Array.from(team.dispatchers.values()).map((disp: any) => {
        let activeCount = disp.uniqueDrivers.size;
        let avgGrossPerDriver = 0;
        let avgMarginPerDriver = 0;
        let avgPnLPerDriver = 0;

        if (activeCount > 0 && disp.driverStats) {
          let totalDriverGrossAvgs = 0;
          let totalDriverMarginAvgs = 0;
          let totalDriverPnLAvgs = 0;

          Array.from(disp.driverStats.values()).forEach((s: any) => {
            const effNonTeamsCount = s.effNonTeams;
            const effCount = s.effDrivers;
            const divisor = effNonTeamsCount > 0 ? effNonTeamsCount : (effCount > 0 ? effCount : (s.count > 0 ? s.count : 1));
            
            totalDriverGrossAvgs += s.gross / divisor;
            totalDriverMarginAvgs += s.margin / divisor;
            totalDriverPnLAvgs += s.pnl / divisor;
          });

          avgGrossPerDriver = totalDriverGrossAvgs / activeCount;
          avgMarginPerDriver = totalDriverMarginAvgs / activeCount;
          avgPnLPerDriver = totalDriverPnLAvgs / activeCount;
        }

        return {
          ...disp,
          activeCount,
          avgGrossPerDriver,
          avgMarginPerDriver,
          avgPnLPerDriver,
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
  }, [validDrivers, fixedExpenses, enrichedMap, pnlConfigs]);

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
        switch (rule.field) {
          case 'Dispatcher': fieldValue = disp.name; break;
          case 'Team': fieldValue = disp.teamName; break;
          case 'Total Drivers': fieldValue = disp.activeCount; break;
          case 'Gross Rev': fieldValue = disp.grossRevenue; break;
          case 'Avg Gross/Dr': fieldValue = disp.avgGrossPerDriver; break;
          case 'Margin Taken': fieldValue = disp.totalMargin; break;
          case 'Avg Margin/Dr': fieldValue = disp.avgMarginPerDriver; break;
          case 'Total PnL': fieldValue = disp.totalPnL; break;
          case 'Avg PnL/Dr': fieldValue = disp.avgPnLPerDriver; break;
          case 'Healthy %': fieldValue = disp.avgRank; break;
          default: return true;
        }

        const isCategorical = ['Dispatcher', 'Team'].includes(rule.field);
        
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

  let totalGross = 0;
  let totalMargin = 0;
  let totalPnL = 0;
  let totalDrivers = 0;

  filteredDispatchers.forEach((disp: any) => {
    totalGross += disp.grossRevenue;
    totalMargin += disp.totalMargin;
    totalPnL += disp.totalPnL;
    totalDrivers += disp.activeCount;
  });

  const totalAvgGross = totalDrivers > 0 ? totalGross / totalDrivers : 0;
  const totalAvgMargin = totalDrivers > 0 ? totalMargin / totalDrivers : 0;
  const totalAvgPnL = totalDrivers > 0 ? totalPnL / totalDrivers : 0;

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
      
      <div className="overflow-auto border border-zinc-800 rounded-lg bg-zinc-900 flex-1">
        <table className="w-full text-left text-[11px] whitespace-nowrap relative">
          <thead className="bg-zinc-800 text-zinc-400 font-medium uppercase tracking-wider sticky top-0 z-20">
            <tr>
              <th onClick={() => requestSort('name')} className="px-2 py-1.5 cursor-pointer hover:text-white select-none border-b border-zinc-800">Dispatcher Name</th>
              <th onClick={() => requestSort('teamName')} className="px-2 py-1.5 cursor-pointer hover:text-white select-none border-b border-zinc-800">Team</th>
              <th onClick={() => requestSort('activeCount')} className="px-2 py-1.5 text-center cursor-pointer hover:text-white select-none border-b border-zinc-800">Total Drivers</th>
              <th onClick={() => requestSort('grossRevenue')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Gross Rev</th>
              <th onClick={() => requestSort('avgGrossPerDriver')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Avg Gross/Dr</th>
              <th onClick={() => requestSort('totalMargin')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Margin Taken</th>
              <th onClick={() => requestSort('avgMarginPerDriver')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Avg Margin/Dr</th>
              <th onClick={() => requestSort('totalPnL')} className="px-2 py-1.5 text-right cursor-pointer hover:text-emerald-400 select-none border-b border-zinc-800 font-bold">Total PnL</th>
              <th onClick={() => requestSort('avgPnLPerDriver')} className="px-2 py-1.5 text-right cursor-pointer hover:text-emerald-400 select-none border-b border-zinc-800 font-bold">Avg PnL/Dr</th>
              <th onClick={() => requestSort('avgRank')} className="px-2 py-1.5 text-right cursor-pointer hover:text-white select-none border-b border-zinc-800">Healthy %</th>
              <th className="px-2 py-1.5 text-center border-b border-zinc-800">Diagnosis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 font-mono text-zinc-300">
            {sortedDispatchers.map((disp: any) => {
              const avgGrossPerDriver = disp.avgGrossPerDriver || 0;
              const avgMarginPerDriver = disp.avgMarginPerDriver || 0;
              const avgPnLPerDriver = disp.avgPnLPerDriver || 0;
              const avgRank = disp.avgRank || 0;

              const severity = getSeverity(avgPnLPerDriver);
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
                    className={`hover:bg-zinc-900/50 cursor-pointer transition-colors ${expandedDispId === disp.id ? 'bg-zinc-800' : ''}`}
                    onClick={() => setExpandedDispId(prev => prev === disp.id ? null : disp.id)}
                  >
                    <td className="px-2 py-1 font-sans flex items-center gap-2 text-zinc-200">
                      {expandedDispId === disp.id ? <ChevronUp size={12} className="text-zinc-500" /> : <ChevronDown size={12} className="text-zinc-500" />}
                      <span className="font-semibold text-zinc-200">{disp.name}</span>
                    </td>
                    <td className="px-2 py-1 font-sans text-zinc-400">
                      {disp.teamName}
                    </td>
                    <td className="px-2 py-1 text-center">{disp.activeCount}</td>
                    <td className="px-2 py-1 text-right text-yellow-400">{formatCurrency(disp.grossRevenue)}</td>
                    <td className="px-2 py-1 text-right text-yellow-400 opacity-80">
                      {formatCurrency(avgGrossPerDriver)}
                    </td>
                    <td className="px-2 py-1 text-right text-purple-400">{formatCurrency(disp.totalMargin)}</td>
                    <td className="px-2 py-1 text-right text-purple-400 opacity-80">
                      {formatCurrency(avgMarginPerDriver)}
                    </td>
                    <td className={`px-2 py-1 text-right font-bold ${disp.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(disp.totalPnL)}</td>
                    <td className={`px-2 py-1 text-right font-bold ${avgPnLPerDriver >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(avgPnLPerDriver)}</td>
                    <td className={`px-2 py-1 text-right font-bold ${avgRank >= 80 ? 'text-emerald-400' : avgRank >= 50 ? 'text-yellow-400' : avgRank >= 20 ? 'text-amber-500' : 'text-rose-400'}`}>
                      {avgRank.toFixed(2)}%
                    </td>
                    <td className="px-2 py-1 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${diagColor}`}>
                        {diagnosis}
                      </span>
                    </td>
                  </tr>
                  {expandedDispId === disp.id && Array.from(disp.driverStats.entries()).map(([dName, s]: [string, any]) => {
                    const divisor = s.effNonTeams > 0 ? s.effNonTeams : (s.effDrivers > 0 ? s.effDrivers : (s.count > 0 ? s.count : 1));
                    const drvGross = s.gross;
                    const drvAvgGross = s.gross / divisor;
                    const drvMargin = s.margin;
                    const drvAvgMargin = s.margin / divisor;
                    const drvPnL = s.pnl;
                    const drvAvgPnL = s.pnl / divisor;
                    const drvRank = driverRanks.get(dName) || 0;

                    const drvSeverity = getSeverity(drvAvgPnL);
                    let drvDiagnosis = "Critical";
                    let drvDiagColor = "bg-rose-500/10 text-rose-500";
                    if (drvSeverity === 'good') {
                      drvDiagnosis = "Good";
                      drvDiagColor = "bg-emerald-500/10 text-emerald-500";
                    } else if (drvSeverity === 'neutral') {
                      drvDiagnosis = "Neutral";
                      drvDiagColor = "bg-yellow-400/10 text-yellow-400";
                    } else if (drvSeverity === 'warning') {
                      drvDiagnosis = "Warning";
                      drvDiagColor = "bg-amber-500/10 text-amber-500";
                    }

                    const isTerminated = String(s.status).toUpperCase() === 'TERMINATED';
                    return (
                      <tr key={dName} className="bg-zinc-950/40 hover:bg-zinc-900/40">
                        <td className="px-2 py-1 pl-8 font-sans text-zinc-400">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isTerminated ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                            <span>{dName}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1 font-sans text-zinc-500">{disp.teamName}</td>
                        <td className="px-2 py-1 text-center text-zinc-500">-</td>
                        <td className="px-2 py-1 text-right text-yellow-400/70">{formatCurrency(drvGross)}</td>
                        <td className="px-2 py-1 text-right text-yellow-400/50">{formatCurrency(drvAvgGross)}</td>
                        <td className="px-2 py-1 text-right text-purple-400/70">{formatCurrency(drvMargin)}</td>
                        <td className="px-2 py-1 text-right text-purple-400/50">{formatCurrency(drvAvgMargin)}</td>
                        <td className={`px-2 py-1 text-right font-bold ${drvPnL >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>{formatCurrency(drvPnL)}</td>
                        <td className={`px-2 py-1 text-right font-bold ${drvAvgPnL >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>{formatCurrency(drvAvgPnL)}</td>
                        <td className="px-2 py-1 text-right font-bold"></td>
                        <td className="px-2 py-1 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${drvDiagColor}`}>
                            {drvDiagnosis}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-[-1px] bg-zinc-900 text-zinc-200 border-t border-zinc-700 font-sans">
            <tr>
              <td className="px-2 py-1.5 font-bold uppercase">Total</td>
              <td className="px-2 py-1.5"></td>
              <td className="px-2 py-1.5 text-center font-bold">{totalDrivers}</td>
              <td className="px-2 py-1.5 text-right font-bold text-yellow-400">{formatCurrency(totalGross)}</td>
              <td className="px-2 py-1.5 text-right font-bold text-yellow-400/80">{formatCurrency(totalAvgGross)}</td>
              <td className="px-2 py-1.5 text-right font-bold text-purple-400">{formatCurrency(totalMargin)}</td>
              <td className="px-2 py-1.5 text-right font-bold text-purple-400/80">{formatCurrency(totalAvgMargin)}</td>
              <td className={`px-2 py-1.5 text-right font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(totalPnL)}</td>
              <td className={`px-2 py-1.5 text-right font-bold ${totalAvgPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(totalAvgPnL)}</td>
              <td className="px-2 py-1.5"></td>
              <td className="px-2 py-1.5"></td>
            </tr>
          </tfoot>
                  </table>
      </div>
    </div>
  );
};

export default DispatcherTable;