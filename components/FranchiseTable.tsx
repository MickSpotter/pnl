import React, { useState } from 'react';
import { DriverPerformance } from '../types';
import { formatCurrency } from '../utils';
import { Building2, ChevronDown, ChevronUp } from 'lucide-react';

interface FranchiseTableProps {
  drivers: DriverPerformance[];
}

const FranchiseTable: React.FC<FranchiseTableProps> = ({ drivers }) => {
  const [expandedFranchiseId, setExpandedFranchiseId] = useState<string | null>(null);
  const [isAvgPerWeek, setIsAvgPerWeek] = useState(false);
  const [search, setSearch] = useState('');

  const franchiseMap = new Map();

  drivers.forEach(driver => {
    if ((driver as any).isSnapshot) return;

    const fId = driver.franchiseId;
    
    if (!fId || fId.trim() === '' || fId.toLowerCase() === 'unassigned') return;

    if (!franchiseMap.has(fId)) {
      franchiseMap.set(fId, {
        id: fId,
        name: fId,
        drivers: new Map()
      });
    }

    const fData = franchiseMap.get(fId);

    if (!fData.drivers.has(driver.name)) {
        fData.drivers.set(driver.name, { name: driver.name, contractType: driver.contractType, records: [] });
    }
    fData.drivers.get(driver.name).records.push(driver);
    if (driver.contractType) fData.drivers.get(driver.name).contractType = driver.contractType;
  });

  const franchises = Array.from(franchiseMap.values()).map(f => {
    const uniqueDriverCount = f.drivers.size;
    
    let fTotalGross = 0;
    let fTotalRev = 0;
    let fTotalPO = 0;
    let fTotalPnL = 0;
    let fTotalWkCount = 0;

    const driverList = Array.from(f.drivers.values()).map((d: any) => {
        const fullWeeks = d.records.filter((r: any) => (r.effectiveDrivers || 0) >= 1);
        const wkCount = fullWeeks.length || 1;
        
        let totalGross = 0;
        let totalRev = 0;
        let totalPO = 0;
        let totalPnL = 0;
        
        d.records.forEach((r: any) => {
            totalGross += (r.grossRevenue || r.totalGross || 0);
            totalRev += (r.companyPay || 0);
            totalPO += r.poCoverage ? -Math.abs(r.poCoverage) : 0;
            totalPnL += ((r.companyPay || 0) - Math.abs(r.calculatedFixedCost || 0) - Math.abs(r.poCoverage || 0) - Math.abs(r.recruitingCost || 0) - Math.abs(r.tollCost || 0));
        });
        
        fTotalGross += totalGross;
        fTotalRev += totalRev;
        fTotalPO += totalPO;
        fTotalPnL += totalPnL;
        fTotalWkCount += fullWeeks.length;
        
        return {
            name: d.name,
            contractType: d.contractType || 'Unknown',
            rev: totalRev,
            po: totalPO,
            pnl: totalPnL,
            revAvg: totalRev / wkCount,
            poAvg: totalPO / wkCount,
            pnlAvg: totalPnL / wkCount
        };
    }).sort((a, b) => b.pnl - a.pnl);

    const fWkCount = fTotalWkCount || 1;

    return {
      ...f,
      uniqueDriverCount,
      totalGross: fTotalGross,
      totalRev: fTotalRev,
      totalPO: fTotalPO,
      totalPnL: fTotalPnL,
      avgGross: fTotalGross / fWkCount,
      avgRev: fTotalRev / fWkCount,
      avgPO: fTotalPO / fWkCount,
      avgPnL: fTotalPnL / fWkCount,
      driverList
    };
  }).filter(f => f.name.toLowerCase().startsWith(search.toLowerCase())).sort((a, b) => b.totalPnL - a.totalPnL);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <input 
          type="text" 
          placeholder="Search franchise..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-[11px] p-1.5 rounded w-64 text-zinc-300 focus:border-emerald-500 focus:outline-none" 
        />
        <button 
          onClick={() => setIsAvgPerWeek(!isAvgPerWeek)}
          className={`px-3 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${isAvgPerWeek ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'}`}
        >
          AVERAGE
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/50">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-950 text-zinc-500 font-medium uppercase border-b border-zinc-800">
            <tr>
              <th className="px-3 py-3 w-8"></th>
              <th className="px-4 py-3">Franchise Name</th>
              <th className="px-4 py-3 text-center">Drivers</th>
              <th className="px-4 py-3 text-right">Gross{isAvgPerWeek ? ' / wk' : ''}</th>
              <th className="px-4 py-3 text-right text-blue-400">Revenue{isAvgPerWeek ? ' / wk' : ''}</th>
              <th className="px-4 py-3 text-right text-rose-400">PO Cov{isAvgPerWeek ? ' / wk' : ''}</th>
              <th className="px-4 py-3 text-right text-emerald-400">PnL{isAvgPerWeek ? ' / wk' : ''}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50 text-zinc-300 font-mono">
            {franchises.map((f) => (
              <React.Fragment key={f.id}>
                <tr onClick={() => setExpandedFranchiseId(expandedFranchiseId === f.id ? null : f.id)} className={`cursor-pointer transition-colors ${expandedFranchiseId === f.id ? 'bg-zinc-800/50' : 'hover:bg-zinc-800/30'}`}>
                  <td className="px-3 py-3 text-zinc-500">
                    {expandedFranchiseId === f.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </td>
                  <td className="px-4 py-3 font-medium font-sans flex items-center gap-2">
                    <Building2 size={14} className="text-blue-500" />
                    {f.name}
                  </td>
                  <td className="px-4 py-3 text-center">{f.uniqueDriverCount}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(isAvgPerWeek ? f.avgGross : f.totalGross)}</td>
                  <td className="px-4 py-3 text-right text-blue-400">{formatCurrency(isAvgPerWeek ? f.avgRev : f.totalRev)}</td>
                  <td className="px-4 py-3 text-right text-rose-400">{formatCurrency(isAvgPerWeek ? f.avgPO : f.totalPO)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${ (isAvgPerWeek ? f.avgPnL : f.totalPnL) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(isAvgPerWeek ? f.avgPnL : f.totalPnL)}
                  </td>
                </tr>
                {expandedFranchiseId === f.id && (
                  <tr className="bg-zinc-950/50">
                    <td colSpan={7} className="p-4 border-b border-zinc-800">
                      <table className="w-full text-left text-xs bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                        <thead className="bg-zinc-950 text-zinc-500 font-medium uppercase border-b border-zinc-800">
                          <tr>
                            <th className="px-4 py-2">Driver</th>
                            <th className="px-4 py-2 text-right text-blue-400">Revenue{isAvgPerWeek ? ' / wk' : ''}</th>
                            <th className="px-4 py-2 text-right text-rose-400">PO Cov{isAvgPerWeek ? ' / wk' : ''}</th>
                            <th className="px-4 py-2 text-right text-emerald-400">PnL{isAvgPerWeek ? ' / wk' : ''}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50 text-zinc-300 font-mono">
                          {f.driverList.map((d: any) => (
                            <tr key={d.name} className="hover:bg-zinc-800/30">
                              <td className="px-4 py-2 font-sans">{d.name} <span className="text-zinc-500 text-[10px] ml-1">({d.contractType})</span></td>
                              <td className="px-4 py-2 text-right text-blue-400">{formatCurrency(isAvgPerWeek ? d.revAvg : d.rev)}</td>
                              <td className="px-4 py-2 text-right text-rose-400">{formatCurrency(isAvgPerWeek ? d.poAvg : d.po)}</td>
                              <td className={`px-4 py-2 text-right font-bold ${(isAvgPerWeek ? d.pnlAvg : d.pnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(isAvgPerWeek ? d.pnlAvg : d.pnl)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FranchiseTable;