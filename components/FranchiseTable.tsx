import React, { useState, useEffect, useMemo } from 'react';
import { DriverPerformance } from '../types';
import { formatCurrency } from '../utils';
import { ChevronDown, ChevronUp, Users, ShieldAlert } from 'lucide-react';
import { getRawMetrics } from './DriverTable';
import { supabase } from '../lib/supabase';

interface FranchiseTableProps {
  drivers: DriverPerformance[];
}

const FranchiseTable: React.FC<FranchiseTableProps> = ({ drivers }) => {
  const [expandedFranchiseId, setExpandedFranchiseId] = useState<string | null>(null);
  const [isAvgPerWeek, setIsAvgPerWeek] = useState(false);
  const [search, setSearch] = useState('');
  const [divideTpog, setDivideTpog] = useState(false);
  const [fixedExpenses, setFixedExpenses] = useState<any[]>([]);
  const [pnlConfigs, setPnlConfigs] = useState<any[]>([]);

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: expData } = await supabase.from('fixed_expenses').select('*');
      if (expData) setFixedExpenses(expData);
      
      const { fetchPnlConfigs } = await import('../lib/supabase');
      if (fetchPnlConfigs) {
        const configData = await fetchPnlConfigs();
        setPnlConfigs(configData || []);
      }
    };
    fetchInitialData();
  }, []);

  const validDrivers = useMemo(() => {
    const uniqueDates = Array.from(new Set(drivers.map(d => d.payDate).filter(Boolean)));
    const sortedDates = uniqueDates.sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime());
    const allowedDates = new Set(sortedDates.length > 6 ? sortedDates.slice(0, -6) : sortedDates);
    return drivers.filter(d => allowedDates.has(d.payDate));
  }, [drivers]);

  const enrichedMap = useMemo(() => {
    const map = new Map<string, any>();
    ((window as any).__ENRICHED_DRIVERS__ || []).forEach((ed: any) => {
      map.set(`${ed.name}_${ed.payDate}_${ed.contractType}_${ed.companyId}`, ed);
    });
    return map;
  }, [drivers]);

  const franchiseData = useMemo(() => {
    const map = new Map();

    validDrivers.forEach(driver => {
      const isUnassignedName = (!driver.name || String(driver.name).toLowerCase() === 'unknown driver');
      const driverName = isUnassignedName ? 'Unassigned' : driver.name;
      
      let fId = driver.franchiseId;
      if (!fId || String(fId).trim() === '' || String(fId).toLowerCase() === 'unassigned' || String(fId).toLowerCase() === 'null') {
          fId = 'Unassigned';
      }

      if (!map.has(fId)) {
        map.set(fId, {
          id: fId,
          name: fId,
          totalGross: 0,
          margin: 0,
          netPay: 0,
          fuel: 0,
          revCol: 0,
          fuelReb: 0,
          dispPay: 0,
          wklyExp: 0,
          tolls: 0,
          po: 0,
          recruiting: 0,
          sharedIns: 0,
          totalPnL: 0,
          bdLiab: 0,
          bdTruck: 0,
          bdTrailer: 0,
          totalWkCount: 0,
          drivers: new Map()
        });
      }

      const fran = map.get(fId);
      
      if (!fran.drivers.has(driverName)) {
        fran.drivers.set(driverName, { 
            name: driverName, 
            contractType: driver.contractType || 'Unknown', 
            records: [],
            totalGross: 0,
            margin: 0,
            netPay: 0,
            fuel: 0,
            revCol: 0,
            fuelReb: 0,
            dispPay: 0,
            wklyExp: 0,
            tolls: 0,
            po: 0,
            recruiting: 0,
            sharedIns: 0,
            totalPnL: 0,
            bdLiab: 0,
            bdTruck: 0,
            bdTrailer: 0,
            wkCount: 0
        });
      }

      const dData = fran.drivers.get(driverName);
      
      const m = getRawMetrics(driver, fixedExpenses, enrichedMap, pnlConfigs);
      const isTpog = String(driver.contractType || '').toUpperCase().includes('TPOG');
      const factor = (divideTpog && isTpog) ? 0.5 : 1;

      let targetDateStr = driver.payDate || new Date().toISOString().split('T')[0];
      if (targetDateStr.includes('T')) targetDateStr = targetDateStr.split('T')[0];


      const getFranchiseResp = (expName: string) => {
        const rules = fixedExpenses.filter(e => {
            if (e.name !== expName) return false;
            const vFrom = e.valid_from || '2000-01-01';
            const vTo = e.valid_to || '2099-12-31';
            if (targetDateStr < vFrom || targetDateStr > vTo) return false;
            const cId = e.companyId || (e as any).company_id;
            const matchCompany = !cId || cId === 'ALL' || cId === driver.companyId;
            const ct = (e as any).contractType || (e as any).contract_type;
            const matchContract = !ct || ct === 'ALL' || ct === driver.contractType;
            return matchCompany && matchContract;
        });

        let amt = 0;
        const regex = /Franchise\s*Pay\D*?(\d+(?:\.\d+)?)/i;

        rules.forEach(r => {
            const noteKey = expName === 'Truck Price' ? 'truck_reduction_note' : 'trailer_reduction_note';
            const noteText = String((r as any)[noteKey] || r.notes || '').replace(/<[^>]*>?/gm, '');
            const match = noteText.match(regex);

            if (match && match[1]) {
                amt += Number(match[1]);
            } else if (String(r.responsibility || '').toLowerCase() === 'franchise') {
                amt += Number(r.amount || 0);
            }

            if (r.reductions && Array.isArray(r.reductions)) {
                r.reductions.forEach((red: any) => {
                    const redNote = String(red[noteKey] || red.notes || '').replace(/<[^>]*>?/gm, '');
                    const redMatch = redNote.match(regex);
                    if (redMatch && redMatch[1]) {
                        amt += Number(redMatch[1]);
                    } else if (String(red.responsibility || '').toLowerCase() === 'franchise') {
                        amt += Number(red.amount || 0);
                    }
                });
            }
        });
        return amt;
      };

      const effNT = driver.effectiveNonTeams || 0;
      const effTr = (driver as any).effectiveTrailers || 0;

      const ed = enrichedMap.get(`${driver.name}_${driver.payDate}_${driver.contractType}_${driver.companyId}`) || driver as any;
      const baseLiab = Number(ed.fullSharedLiability || 0) - Number(ed.dispSharedLiability || 0);
      const baseTruck = getFranchiseResp('Truck Price') * effNT;
      const baseTrailer = getFranchiseResp('Trailer Price') * effTr;

      const sharedInsCalc = baseLiab + baseTruck + baseTrailer;

      const fGross = Number(driver.grossRevenue || driver.driver_gross || 0);
      const fMargin = Number(driver.marginAmount || 0);
      const fNetPay = Number(driver.netPay || 0);
      const fFuel = Number(m.fuel || 0);
      const fRevCol = Number(m.revCol || 0) * factor;
      const fFuelReb = Number(m.fuelRebate || 0) * factor;
      const fDispPay = Number(m.dispPay || 0) * factor;
      const fWklyExp = -Math.abs(Number(m.wklyExp || 0)) * factor;
      const fTolls = -Math.abs(Number(m.tolls || 0)) * factor;
      const fPo = Number(m.po || 0) * factor; 
      const fRecruiting = -Math.abs(Number(m.recruiting || 0)) * factor;
      const fPnl = Number(m.pnl || 0) * factor;

      const weekAddition = (driver.effectiveDrivers || 0) >= 1 ? 1 : 0;

      dData.totalGross += fGross;
      dData.margin += fMargin;
      dData.netPay += fNetPay;
      dData.fuel += fFuel;
      dData.revCol += fRevCol;
      dData.fuelReb += fFuelReb;
      dData.dispPay += fDispPay;
      dData.wklyExp += fWklyExp;
      dData.tolls += fTolls;
      dData.po += fPo;
      dData.recruiting += fRecruiting;
      dData.sharedIns += sharedInsCalc;
      dData.totalPnL += fPnl;
      dData.bdLiab += baseLiab;
      dData.bdTruck += baseTruck;
      dData.bdTrailer += baseTrailer;
      dData.wkCount += weekAddition;
      dData.records.push(driver);

      fran.totalGross += fGross;
      fran.margin += fMargin;
      fran.netPay += fNetPay;
      fran.fuel += fFuel;
      fran.revCol += fRevCol;
      fran.fuelReb += fFuelReb;
      fran.dispPay += fDispPay;
      fran.wklyExp += fWklyExp;
      fran.tolls += fTolls;
      fran.po += fPo;
      fran.recruiting += fRecruiting;
      fran.sharedIns += sharedInsCalc;
      fran.totalPnL += fPnl;
      fran.bdLiab += baseLiab;
      fran.bdTruck += baseTruck;
      fran.bdTrailer += baseTrailer;
      fran.totalWkCount += weekAddition;
    });

    return Array.from(map.values()).map(f => {
      const uniqueDriverCount = f.drivers.size;
      const fWkCount = f.totalWkCount || 1;
      
      const driverList = Array.from(f.drivers.values()).map((d: any) => {
        const dWk = d.wkCount || 1;
        return {
          ...d,
          avgGross: d.totalGross / dWk,
          avgMargin: d.margin / dWk,
          avgNetPay: d.netPay / dWk,
          avgFuel: d.fuel / dWk,
          avgRevCol: d.revCol / dWk,
          avgFuelReb: d.fuelReb / dWk,
          avgDispPay: d.dispPay / dWk,
          avgWklyExp: d.wklyExp / dWk,
          avgTolls: d.tolls / dWk,
          avgPo: d.po / dWk,
          avgRecruiting: d.recruiting / dWk,
          avgSharedIns: d.sharedIns / dWk,
          avgPnL: d.totalPnL / dWk,
          avgBdLiab: d.bdLiab / dWk,
          avgBdTruck: d.bdTruck / dWk,
          avgBdTrailer: d.bdTrailer / dWk
        };
      }).sort((a: any, b: any) => b.totalPnL - a.totalPnL);

      return {
        ...f,
        uniqueDriverCount,
        avgGross: f.totalGross / fWkCount,
        avgMargin: f.margin / fWkCount,
        avgNetPay: f.netPay / fWkCount,
        avgFuel: f.fuel / fWkCount,
        avgRevCol: f.revCol / fWkCount,
        avgFuelReb: f.fuelReb / fWkCount,
        avgDispPay: f.dispPay / fWkCount,
        avgWklyExp: f.wklyExp / fWkCount,
        avgTolls: f.tolls / fWkCount,
        avgPo: f.po / fWkCount,
        avgRecruiting: f.recruiting / fWkCount,
        avgSharedIns: f.sharedIns / fWkCount,
        avgPnL: f.totalPnL / fWkCount,
        avgBdLiab: f.bdLiab / fWkCount,
        avgBdTruck: f.bdTruck / fWkCount,
        avgBdTrailer: f.bdTrailer / fWkCount,
        driverList
      };
    }).filter(f => f.id !== 'Unassigned' && f.name.toLowerCase().startsWith(search.toLowerCase())).sort((a, b) => b.totalPnL - a.totalPnL);

  }, [validDrivers, fixedExpenses, enrichedMap, pnlConfigs, divideTpog, search]);

  return (
    <div className="space-y-4 h-full flex flex-col relative">
      <div className="flex justify-between items-center mb-2 px-1">
        <input 
          type="text" 
          placeholder="Search franchise..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-[11px] p-1.5 rounded w-64 text-zinc-300 focus:border-emerald-500 focus:outline-none" 
        />
        <div className="flex items-center gap-2">
            <button 
            onClick={() => setDivideTpog(!divideTpog)}
            className={`px-3 py-1.5 rounded text-[10px] font-bold border transition-colors cursor-pointer flex items-center gap-1 ${divideTpog ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'}`}
            >
            <ShieldAlert size={12} />
            HALVE TPOG
            </button>
            <button 
            onClick={() => setIsAvgPerWeek(!isAvgPerWeek)}
            className={`px-3 py-1.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${isAvgPerWeek ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'}`}
            >
            AVERAGE
            </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/50 flex-1">
        <table className="w-full text-left text-[10px]">
          <thead className="bg-zinc-950 text-zinc-500 font-medium uppercase border-b border-zinc-800 sticky top-0 z-20">
            <tr>
              <th className="px-2 py-1.5 w-6"></th>
              <th className="px-2 py-1.5">Franchise Name</th>
              <th className="px-2 py-1.5 text-center">Drv</th>
              <th className="px-2 py-1.5 text-right text-yellow-400">Gross</th>
              <th className="px-2 py-1.5 text-right text-yellow-400">Margin</th>
              <th className="px-2 py-1.5 text-right text-purple-400">Net Pay</th>
              <th className="px-2 py-1.5 text-right text-purple-400">Fuel</th>
              <th className="px-2 py-1.5 text-right text-blue-400">Rev. Col.</th>
              <th className="px-2 py-1.5 text-right text-blue-400">Fuel Reb.</th>
              <th className="px-2 py-1.5 text-right text-blue-400">Disp. Pay</th>
              <th className="px-2 py-1.5 text-right text-rose-400">Wkly Exp.</th>
              <th className="px-2 py-1.5 text-right text-rose-400">Tolls</th>
              <th className="px-2 py-1.5 text-right text-rose-400">PO</th>
              <th className="px-2 py-1.5 text-right text-rose-400">Recruiting</th>
              <th className="px-2 py-1.5 text-right text-purple-400">Shared Exp.</th>
              <th className="px-2 py-1.5 text-right text-emerald-400">Total PnL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50 text-zinc-300 font-mono">
            {franchiseData.map((f) => (
              <React.Fragment key={f.id}>
                <tr onClick={() => setExpandedFranchiseId(expandedFranchiseId === f.id ? null : f.id)} className={`cursor-pointer transition-colors ${expandedFranchiseId === f.id ? 'bg-zinc-800/50' : 'hover:bg-zinc-800/30'}`}>
                  <td className="px-2 py-1 text-zinc-500">
                    {expandedFranchiseId === f.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </td>
                  <td className="px-2 py-1 font-medium font-sans">
                    {f.name}
                  </td>
                  <td className="px-2 py-1 text-center">
                    <div className="flex items-center justify-center gap-1">
                        <Users size={10} className="text-zinc-500" />
                        {f.uniqueDriverCount}
                    </div>
                  </td>
                  <td className="px-2 py-1 text-right text-yellow-400">{formatCurrency(isAvgPerWeek ? f.avgGross : f.totalGross)}</td>
                  <td className="px-2 py-1 text-right text-yellow-400">{formatCurrency(isAvgPerWeek ? f.avgMargin : f.margin)}</td>
                  <td className="px-2 py-1 text-right text-purple-400">{formatCurrency(isAvgPerWeek ? f.avgNetPay : f.netPay)}</td>
                  <td className="px-2 py-1 text-right text-purple-400">{formatCurrency(isAvgPerWeek ? f.avgFuel : f.fuel)}</td>
                  <td className="px-2 py-1 text-right text-blue-400">{formatCurrency(isAvgPerWeek ? f.avgRevCol : f.revCol)}</td>
                  <td className="px-2 py-1 text-right text-blue-400">{formatCurrency(isAvgPerWeek ? f.avgFuelReb : f.fuelReb)}</td>
                  <td className="px-2 py-1 text-right text-blue-400">{formatCurrency(isAvgPerWeek ? f.avgDispPay : f.dispPay)}</td>
                  <td className="px-2 py-1 text-right text-rose-400">{formatCurrency(isAvgPerWeek ? f.avgWklyExp : f.wklyExp)}</td>
                  <td className="px-2 py-1 text-right text-rose-400">{formatCurrency(isAvgPerWeek ? f.avgTolls : f.tolls)}</td>
                  <td className="px-2 py-1 text-right text-rose-400">{formatCurrency(isAvgPerWeek ? f.avgPo : f.po)}</td>
                  <td className="px-2 py-1 text-right text-rose-400">{formatCurrency(isAvgPerWeek ? f.avgRecruiting : f.recruiting)}</td>
                  <td className="px-2 py-1 text-right text-purple-400 relative group cursor-help hover:bg-zinc-800">
                    {formatCurrency(isAvgPerWeek ? f.avgSharedIns : f.sharedIns)}
                    <div className="hidden group-hover:flex absolute z-[100] bg-zinc-800 border border-zinc-600 rounded p-2 flex-col gap-1 text-[10px] right-full top-0 mr-2 shadow-xl w-48 text-left">
                      <div className="text-zinc-400 border-b border-zinc-700 pb-1 mb-1 font-bold">Shared Exp. Breakdown</div>
                      <div className="flex justify-between"><span>Liability:</span><span className="text-zinc-200">{formatCurrency(isAvgPerWeek ? f.avgBdLiab : f.bdLiab)}</span></div>
                      {f.bdTruck !== 0 && <div className="flex justify-between"><span>Truck Franchise:</span><span className="text-emerald-400">+{formatCurrency(isAvgPerWeek ? f.avgBdTruck : f.bdTruck)}</span></div>}
                      {f.bdTrailer !== 0 && <div className="flex justify-between"><span>Trailer Franchise:</span><span className="text-emerald-400">+{formatCurrency(isAvgPerWeek ? f.avgBdTrailer : f.bdTrailer)}</span></div>}
                    </div>
                  </td>
                  <td className={`px-2 py-1 text-right font-bold ${ (isAvgPerWeek ? f.avgPnL : f.totalPnL) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(isAvgPerWeek ? f.avgPnL : f.totalPnL)}
                  </td>
                </tr>
                {expandedFranchiseId === f.id && (
                  <tr className="bg-zinc-950/50">
                    <td colSpan={16} className="p-0 border-b border-zinc-800">
                      <div className="max-h-[280px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-[10px]">
                          <tbody className="divide-y divide-zinc-800/50 text-zinc-400 font-mono">
                            {f.driverList.map((d: any) => (
                              <tr key={d.name} className="hover:bg-zinc-800/30 bg-zinc-900/40">
                                <td className="px-2 py-1 w-6"></td>
                                <td className="px-2 py-1 font-sans">
                                  <div className="flex flex-col">
                                    <span>{d.name}</span>
                                    <span className="text-zinc-500 text-[9px]">{d.contractType}</span>
                                  </div>
                                </td>
                                <td className="px-2 py-1 text-center"></td>
                                <td className="px-2 py-1 text-right text-yellow-400/80">{formatCurrency(isAvgPerWeek ? d.avgGross : d.totalGross)}</td>
                                <td className="px-2 py-1 text-right text-yellow-400/80">{formatCurrency(isAvgPerWeek ? d.avgMargin : d.margin)}</td>
                                <td className="px-2 py-1 text-right text-purple-400/80">{formatCurrency(isAvgPerWeek ? d.avgNetPay : d.netPay)}</td>
                                <td className="px-2 py-1 text-right text-purple-400/80">{formatCurrency(isAvgPerWeek ? d.avgFuel : d.fuel)}</td>
                                <td className="px-2 py-1 text-right text-blue-400/80">{formatCurrency(isAvgPerWeek ? d.avgRevCol : d.revCol)}</td>
                                <td className="px-2 py-1 text-right text-blue-400/80">{formatCurrency(isAvgPerWeek ? d.avgFuelReb : d.fuelReb)}</td>
                                <td className="px-2 py-1 text-right text-blue-400/80">{formatCurrency(isAvgPerWeek ? d.avgDispPay : d.dispPay)}</td>
                                <td className="px-2 py-1 text-right text-rose-400/80">{formatCurrency(isAvgPerWeek ? d.avgWklyExp : d.wklyExp)}</td>
                                <td className="px-2 py-1 text-right text-rose-400/80">{formatCurrency(isAvgPerWeek ? d.avgTolls : d.tolls)}</td>
                                <td className="px-2 py-1 text-right text-rose-400/80">{formatCurrency(isAvgPerWeek ? d.avgPo : d.po)}</td>
                                <td className="px-2 py-1 text-right text-rose-400/80">{formatCurrency(isAvgPerWeek ? d.avgRecruiting : d.recruiting)}</td>
                                <td className="px-2 py-1 text-right text-purple-400/80 relative group cursor-help hover:bg-zinc-800">
                                  {formatCurrency(isAvgPerWeek ? d.avgSharedIns : d.sharedIns)}
                                  <div className="hidden group-hover:flex absolute z-[100] bg-zinc-800 border border-zinc-600 rounded p-2 flex-col gap-1 text-[10px] right-full top-0 mr-2 shadow-xl w-48 text-left">
                                    <div className="text-zinc-400 border-b border-zinc-700 pb-1 mb-1 font-bold">Shared Exp. Breakdown</div>
                                    <div className="flex justify-between"><span>Liability:</span><span className="text-zinc-200">{formatCurrency(isAvgPerWeek ? d.avgBdLiab : d.bdLiab)}</span></div>
                                    {d.bdTruck !== 0 && <div className="flex justify-between"><span>Truck Franchise:</span><span className="text-emerald-400">+{formatCurrency(isAvgPerWeek ? d.avgBdTruck : d.bdTruck)}</span></div>}
                                    {d.bdTrailer !== 0 && <div className="flex justify-between"><span>Trailer Franchise:</span><span className="text-emerald-400">+{formatCurrency(isAvgPerWeek ? d.avgBdTrailer : d.bdTrailer)}</span></div>}
                                  </div>
                                </td>
                                <td className={`px-2 py-1 text-right font-bold ${(isAvgPerWeek ? d.avgPnL : d.totalPnL) >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>{formatCurrency(isAvgPerWeek ? d.avgPnL : d.totalPnL)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
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