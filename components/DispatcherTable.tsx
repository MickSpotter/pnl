import React, { useState } from 'react';
import { DriverPerformance, DispatcherTier } from '../types';
import { formatCurrency, formatPercent } from '../utils';
import { Users, ChevronDown, ChevronUp, AlertCircle, DollarSign } from 'lucide-react';

interface DispatcherTableProps {
  drivers: DriverPerformance[];
}

const DispatcherTable: React.FC<DispatcherTableProps> = ({ drivers }) => {
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedTeamId(prev => prev === id ? null : id);
  };

  const driverLatestData = new Map();
  drivers.forEach(d => {
    if ((d as any).isSnapshot) return;
    const dDate = d.payDate ? new Date(d.payDate).getTime() : 0;
    const currentLatest = driverLatestData.get(d.name);
    if (!currentLatest || dDate > currentLatest.time) {
      driverLatestData.set(d.name, {
        time: dDate,
        status: d.status,
        dispatcherId: d.dispatcherId || 'Unassigned Dispatcher',
        teamId: d.teamId || 'Unassigned Team'
      });
    }
  });

  const teamMap = new Map();

  drivers.forEach(driver => {
    const teamId = driver.teamId || 'Unassigned Team';
    const dispatcherId = driver.dispatcherId || 'Unassigned Dispatcher';

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
        id: dispatcherId,
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

    const pnl = (driver.companyPay || 0) - Math.abs(driver.calculatedFixedCost || 0) - Math.abs(driver.poCoverage || 0) - Math.abs(driver.recruitingCost || 0) - Math.abs(driver.tollCost || 0);

    team.totalMargin += driver.marginAmount || 0;
    team.totalPnL += pnl;

    const gross = driver.grossRevenue || driver.totalGross || 0;
    const margin = driver.marginAmount || 0;

    disp.totalMargin += margin;
    disp.grossRevenue += gross;
    disp.totalPnL += pnl;
    disp.uniqueDrivers.add(driver.name);

    if (!disp.driverStats.has(driver.name)) {
      disp.driverStats.set(driver.name, { gross: 0, margin: 0, pnl: 0, count: 0 });
    }
    const stats = disp.driverStats.get(driver.name);
    stats.gross += gross;
    stats.margin += margin;
    stats.pnl += pnl;
    stats.count += 1;

    if (gross !== 0) disp.grossRecordCount += 1;
    if (margin !== 0) disp.marginRecordCount += 1;
    
    if (driver.payDate) {
      disp.payDates.add(driver.payDate);
    }
  });

  const teams = Array.from(teamMap.values()).map(team => {
    const dispatchersList = Array.from(team.dispatchers.values()).map((disp: any) => {
      let activeCount = disp.uniqueDrivers.size;

      let avgGrossPerDriver = 0;
      let avgMarginPerDriver = 0;
      let avgPnLPerDriver = 0;

      if (activeCount > 0 && disp.driverStats) {
        let totalDriverGrossAvgs = 0;
        let totalDriverMarginAvgs = 0;
        let totalDriverPnLAvgs = 0;

        Array.from(disp.driverStats.values()).forEach((s: any) => {
          const weeks = s.count > 0 ? s.count : 1;
          totalDriverGrossAvgs += s.gross / weeks;
          totalDriverMarginAvgs += s.margin / weeks;
          totalDriverPnLAvgs += s.pnl / weeks;
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
        avgPnLPerDriver
      };
    }).sort((a: any, b: any) => b.totalMargin - a.totalMargin);

    let teamActiveDrivers = 0;
    dispatchersList.forEach((disp: any) => {
      teamActiveDrivers += disp.activeCount;
    });

    return {
      ...team,
      activeDispatchers: dispatchersList.length,
      activeDrivers: teamActiveDrivers,
      dispatchersList
    };
  }).sort((a, b) => b.totalMargin - a.totalMargin);

  const filteredTeams = teams.filter(team => team.name.toLowerCase().startsWith(searchTerm.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="mb-2">
         <input 
           type="text" 
           placeholder="Search teams..." 
           value={searchTerm}
           onChange={(e) => setSearchTerm(e.target.value)}
           className="bg-zinc-900 border border-zinc-800 text-[11px] p-2 rounded w-64 text-zinc-300 focus:border-emerald-500 focus:outline-none" 
         />
      </div>
      {filteredTeams.map((team) => {
        const isExpanded = expandedTeamId === team.id;
        
        return (
          <div key={team.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden transition-all">
            <div 
              onClick={() => toggleExpand(team.id)}
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-full ${isExpanded ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">{team.name}</h3>
                  <div className="flex gap-3 text-xs text-zinc-500 mt-1">
                    <span className="flex items-center gap-1"><Users size={12}/> {team.activeDispatchers} Dispatchers</span>
                    <span className="flex items-center gap-1">({team.activeDrivers} Total Drivers)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8 text-right">
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase font-bold">Team Margin</div>
                  <div className="text-emerald-400 font-bold font-mono text-base">{formatCurrency(team.totalMargin)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase font-bold">Team PnL</div>
                  <div className={`font-bold font-mono text-base ${team.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(team.totalPnL)}</div>
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-zinc-800 bg-zinc-950/30 p-4">
                <h4 className="text-xs font-bold text-zinc-500 uppercase mb-3 ml-1">Performance by Dispatcher</h4>
                <div className="overflow-x-auto rounded border border-zinc-800/50">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900 text-zinc-500 font-medium uppercase">
                      <tr>
                        <th className="px-3 py-2">Dispatcher Name</th>
                        <th className="px-3 py-2 text-center">Total Drivers</th>
                        <th className="px-3 py-2 text-right">Gross Rev</th>
                        <th className="px-3 py-2 text-right">Avg Gross/Dr</th>
                        <th className="px-3 py-2 text-right">Margin Taken</th>
                        <th className="px-3 py-2 text-right">Avg Margin/Dr</th>
                        <th className="px-3 py-2 text-right">Total PnL</th>
                        <th className="px-3 py-2 text-right">Avg PnL/Dr</th>
                        <th className="px-3 py-2 text-center">Diagnosis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800 text-zinc-300">
                      {team.dispatchersList.map((disp: any) => {
                        const avgGrossPerDriver = disp.avgGrossPerDriver || 0;
                        const avgMarginPerDriver = disp.avgMarginPerDriver || 0;
                        const avgPnLPerDriver = disp.avgPnLPerDriver || 0;
                        
                        const isLowGross = disp.grossRecordCount > 0 && avgGrossPerDriver < 4000;
                        const isLowMargin = disp.marginRecordCount > 0 && avgMarginPerDriver < (avgGrossPerDriver * 0.04);

                        let diagnosis = "Healthy";
                        if (isLowGross && isLowMargin) diagnosis = "Low Gross & Margin";
                        else if (isLowGross) diagnosis = "Low Gross";
                        else if (isLowMargin) diagnosis = "Low Margin";

                        return (
                          <tr key={disp.id} className="hover:bg-zinc-900/50">
                            <td className="px-3 py-2 font-medium flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              {disp.name}
                            </td>
                            <td className="px-3 py-2 text-center font-mono">{disp.activeCount}</td>
                            <td className="px-3 py-2 text-right font-mono">{formatCurrency(disp.grossRevenue)}</td>
                            <td className={`px-3 py-2 text-right font-mono ${isLowGross ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {formatCurrency(avgGrossPerDriver)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-zinc-400">{formatCurrency(disp.totalMargin)}</td>
                            <td className={`px-3 py-2 text-right font-mono ${isLowMargin ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {formatCurrency(avgMarginPerDriver)}
                            </td>
                            <td className={`px-3 py-2 text-right font-mono font-bold ${disp.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {formatCurrency(disp.totalPnL)}
                            </td>
                            <td className={`px-3 py-2 text-right font-mono font-bold ${avgPnLPerDriver >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {formatCurrency(avgPnLPerDriver)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                diagnosis === "Healthy" ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                              }`}>
                                {diagnosis}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DispatcherTable;