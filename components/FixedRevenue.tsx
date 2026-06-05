import React from 'react';
import { ChevronDown, Plus, Trash2, Info, Filter, X } from 'lucide-react';
import { FixedRevenueItem } from '../types';

interface FixedRevenueProps {
  availableContractTypes: string[];
  companies: string[];
  franchises?: string[];
  drivers?: any[];
  localRevenues: FixedRevenueItem[];
  setLocalRevenues: React.Dispatch<React.SetStateAction<FixedRevenueItem[]>>;
  allDates?: string[];
}

const FixedRevenue: React.FC<FixedRevenueProps> = ({
  availableContractTypes,
  companies,
  franchises,
  drivers,
  localRevenues,
  setLocalRevenues,
  allDates
}) => {
  const [selectedItemName, setSelectedItemName] = React.useState('');
  const [isFilterVisible, setIsFilterVisible] = React.useState(false);
  const [revenueFilter, setRevenueFilter] = React.useState({ company: '', contract: '', date: '', sort: 'A-Z' });

  const revenueItems = [
    'Truck Float',
    'Truck Weekly',
    'Occ Ins',
    'ELD',
    'IFTA',
    'Maint Support',
    'Liability',
    'Truck PHD',
    'Trailer',
    'Trailer PHD'
  ];

  const itemNameToKey: Record<string, string> = {
    'Truck Float': 'truck_float',
    'Truck Weekly': 'truck_wkly',
    'Occ Ins': 'occ_ins',
    'ELD': 'eld',
    'IFTA': 'ifta',
    'Maint Support': 'maintenance_support',
    'Liability': 'liability',
    'Truck PHD': 'truck_phd',
    'Trailer': 'trailer',
    'Trailer PHD': 'trailer_phd'
  };

  const uniqueDates = React.useMemo(() => {
    const dates = new Set<string>();
    if (allDates) {
      allDates.forEach(d => dates.add(d));
    }
    if (drivers) {
      drivers.forEach(d => {
        const date = d.payDate || d.week_ending;
        if (date) dates.add(date);
      });
    }
    localRevenues.forEach(r => {
           if ((r.contractType || r.companyId === 'ALL') && r.valid_from && r.valid_to) {
        const time = new Date(r.valid_to).getTime();
        if (!isNaN(time)) {
          const dBase = new Date(time - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          dates.add(dBase);
        }
      }
    });
    const sortedDates = Array.from(dates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const seenPeriods = new Set<string>();
    return sortedDates.filter(dateStr => {
      const dBase = new Date(dateStr);
      const day = dBase.getUTCDay();
      const diffToMonday = day === 4 ? -3 : (day === 0 ? 1 : (1 - day));
      const vTObj = new Date(dBase.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
      const periodKey = vTObj.toISOString().split('T')[0];
      if (seenPeriods.has(periodKey)) return false;
      seenPeriods.add(periodKey);
      return true;
    });
  }, [drivers, localRevenues, allDates]);

  const getDefaultsForDate = (itemName: string, dateStr: string) => {
    const key = itemNameToKey[itemName];
    if (!key || !drivers) return [];
    const matches = drivers;
    const distinctMap = new Map<string, number>();
    matches.forEach(m => {
      const amt = Math.abs(Number(m[key]) || 0);
      const ct = m.contractType || 'Unknown';
      if (amt > 0) {
          distinctMap.set(ct, Math.max(distinctMap.get(ct) || 0, amt));
      }
    });
    const distinct: { contractType: string, amount: number }[] = [];
    distinctMap.forEach((amount, contractType) => {
        distinct.push({ contractType, amount });
    });
    return distinct.sort((a, b) => a.contractType.localeCompare(b.contractType));
  };

  const handleAddRule = (itemName: string, scopeType: 'ALL' | 'COMPANY' | 'CONTRACT' | 'FRANCHISE', specificDate?: string) => {
    const newRule: FixedRevenueItem = {
      id: Math.random().toString(36).substring(2, 11),
      name: itemName,
      companyId: scopeType === 'COMPANY' ? '' : (scopeType === 'ALL' ? 'ALL' : undefined),
      contractType: scopeType === 'CONTRACT' ? '' : undefined,
      franchiseId: scopeType === 'FRANCHISE' ? '' : undefined,
      amount: 0,
      valid_from: specificDate || new Date().toISOString().split('T')[0],
      valid_to: specificDate || '',
      is_standalone: specificDate ? false : true
    };
    setLocalRevenues(prev => [newRule, ...prev]);
  };

  const handleChange = (id: string, field: keyof FixedRevenueItem, value: any) => {
    setLocalRevenues(prev => prev.map(r => String(r.id) === String(id) ? { ...r, [field]: value } : r));
  };

  const handleDelete = (id: string) => {
    setLocalRevenues(prev => prev.filter(r => String(r.id) !== String(id)));
  };

  return (
    <div className="max-w-6xl mx-auto mt-4">
      <div className="w-full border border-zinc-800 rounded-lg bg-zinc-950/50">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-[-24px] z-[50]">
            <tr className="bg-zinc-900 border-b border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              <th className="p-2 font-bold flex items-center justify-between rounded-t-lg bg-zinc-900 shadow-md relative">
                <div className="flex items-center gap-2">
                  <span>Revenue Item</span>
                  <div className="group relative cursor-help text-zinc-500 hover:text-indigo-500 transition-colors">
                    <Info size={14} />
                    <div className="hidden group-hover:block absolute left-0 top-full mt-2 w-72 bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded shadow-xl normal-case font-normal z-[100] pointer-events-none text-left border border-zinc-600 leading-relaxed">
                      Fixed revenue settings. Values entered here will overwrite the default calculations for Revenue Collected, and these items are prorated based on the active period.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 font-normal normal-case">
                  {isFilterVisible && (
                    <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded px-2 py-1">
                      <select value={revenueFilter.company} onChange={(e) => setRevenueFilter({...revenueFilter, company: e.target.value})} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-300 outline-none">
                        <option value="">All Companies</option>
                        {companies.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select value={revenueFilter.contract} onChange={(e) => setRevenueFilter({...revenueFilter, contract: e.target.value})} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-300 outline-none">
                        <option value="">All Contracts</option>
                        {availableContractTypes.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
                      </select>
                      <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-700 rounded px-2 py-1">
                        <span className="text-[9px] text-zinc-500 font-bold uppercase">Pay Date:</span>
                        <input type="date" value={revenueFilter.date} onChange={(e) => {
                          let val = e.target.value;
                          if (val) {
                            const d = new Date(val);
                            const day = d.getUTCDay();
                            const diff = 4 - day;
                            d.setUTCDate(d.getUTCDate() + (diff > 3 ? diff - 7 : (diff < -3 ? diff + 7 : diff)));
                            val = d.toISOString().split('T')[0];
                          }
                          setRevenueFilter({...revenueFilter, date: val});
                        }} style={{ colorScheme: 'dark' }} className="bg-transparent text-[10px] text-zinc-300 outline-none" />
                      </div>
                      <select value={revenueFilter.sort} onChange={(e) => setRevenueFilter({...revenueFilter, sort: e.target.value})} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-300 outline-none">
                        <option value="A-Z">Sort: A-Z</option>
                        <option value="Z-A">Sort: Z-A</option>
                      </select>
                      <button onClick={() => setRevenueFilter({ company: '', contract: '', date: '', sort: 'A-Z' })} className="text-zinc-500 hover:text-rose-500 ml-1" title="Clear Filters"><X size={14}/></button>
                    </div>
                  )}
                  <button onClick={() => setIsFilterVisible(!isFilterVisible)} className={`flex items-center gap-1.5 px-3 py-1.5 border rounded text-[10px] font-bold uppercase transition-colors ${isFilterVisible || revenueFilter.company || revenueFilter.contract || revenueFilter.date || revenueFilter.sort !== 'A-Z' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:bg-zinc-800'}`}>
                    <Filter size={14} />
                    Filter
                  </button>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {revenueItems.map(itemName => {
              const isExpanded = selectedItemName === itemName;
              const allRules = localRevenues.filter(r => r.name === itemName);
              const defaultPeriodSet = new Set(uniqueDates.map(dateStr => {
                  const dBase = new Date(dateStr);
                  const day = dBase.getUTCDay();
                  const diffToMonday = day === 4 ? -3 : (day === 0 ? 1 : (1 - day));
                  const vTObj = new Date(dBase.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
                  const vF = new Date(vTObj.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                  const vT = vTObj.toISOString().split('T')[0];
                  return `${vF}_${vT}`;
              }));
              const standaloneRules = allRules.filter(r => !(r.contractType && r.valid_from && r.valid_to && defaultPeriodSet.has(`${r.valid_from}_${r.valid_to}`)));

              return (
                <React.Fragment key={itemName}>
                  <tr onClick={() => setSelectedItemName(isExpanded ? '' : itemName)} className="cursor-pointer hover:bg-zinc-800/30 transition-colors group">
                    <td className="p-3 text-sm font-bold text-indigo-400 flex items-center gap-2">
                      <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : '-rotate-90'}`} />
                      <span>{itemName}</span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={1} className="p-0">
                        <div className="p-4 bg-zinc-900/30 border-t border-zinc-800">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Rules History</h4>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleAddRule(itemName, 'ALL')} className="px-3 py-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30 rounded text-[10px] font-bold uppercase transition-colors whitespace-nowrap flex items-center gap-1">
                                <Plus size={12} /> ADD GLOBAL RULE
                              </button>
                              <div className="relative group/dropdown">
                                <button className="px-3 py-1 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 border border-indigo-500/30 rounded text-[10px] font-bold uppercase transition-colors whitespace-nowrap flex items-center gap-1">
                                  <Plus size={12} /> Add Rule For <ChevronDown size={10} />
                                </button>
                                <div className="absolute hidden group-hover/dropdown:flex flex-col top-full right-0 pt-1 w-max min-w-full z-50">
                                  <div className="bg-zinc-900 border border-zinc-700 rounded shadow-xl overflow-hidden flex flex-col w-full">
                                    <button onClick={() => handleAddRule(itemName, 'CONTRACT')} className="px-4 py-2 text-left text-[10px] font-bold text-purple-500 hover:bg-zinc-800 transition-colors">Contract</button>
                                    <button onClick={() => handleAddRule(itemName, 'COMPANY')} className="px-4 py-2 text-left text-[10px] font-bold text-amber-500 hover:bg-zinc-800 transition-colors">Company</button>
                                    <button onClick={() => handleAddRule(itemName, 'FRANCHISE')} className="px-4 py-2 text-left text-[10px] font-bold text-indigo-500 hover:bg-zinc-800 transition-colors">Franchise</button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="border border-zinc-800 rounded max-h-[300px] overflow-y-auto">
                            <table className="w-full text-left border-collapse">
                              <thead className="sticky top-0 bg-zinc-900 z-[20]">
                                <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                                  <th className="py-2 px-3 font-bold w-[15%]">Valid From</th>
                                  <th className="py-2 px-3 font-bold w-[15%]">Valid To</th>
                                  <th className="py-2 px-3 font-bold w-[25%]">Type / Scope</th>
                                  <th className="py-2 px-3 font-bold">Amount</th>
                                  <th className="py-2 px-3 font-bold text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-800/30">
                                {(() => {
                                  let filtered = [...standaloneRules];
                                  if (revenueFilter.company) filtered = filtered.filter(r => r.companyId === revenueFilter.company || r.companyId === 'ALL');
                                  if (revenueFilter.contract) filtered = filtered.filter(r => r.contractType === revenueFilter.contract);
                                  if (revenueFilter.date) {
                                    const pDate = new Date(revenueFilter.date);
                                    const tDate = new Date(pDate); tDate.setUTCDate(pDate.getUTCDate() - 3);
                                    const filterTo = tDate.toISOString().split('T')[0];
                                    const fDate = new Date(pDate); fDate.setUTCDate(pDate.getUTCDate() - 9);
                                    const filterFrom = fDate.toISOString().split('T')[0];
                                    filtered = filtered.filter(r => {
                                      const f = r.valid_from || '2000-01-01';
                                      const t = r.valid_to || '2099-12-31';
                                      return filterFrom <= t && filterTo >= f;
                                    });
                                  }
                                  filtered.sort((a, b) => {
                                    const nameA = String(a.companyId || a.contractType || a.franchiseId || 'zz').trim().toLowerCase();
                                    const nameB = String(b.companyId || b.contractType || b.franchiseId || 'zz').trim().toLowerCase();
                                    if (revenueFilter.sort === 'A-Z') return nameA.localeCompare(nameB);
                                    if (revenueFilter.sort === 'Z-A') return nameB.localeCompare(nameA);
                                    return 0;
                                  });
                                  return filtered.map(rule => (
                                  <tr key={rule.id} className="bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
                                    <td className="py-1.5 px-3">
                                      <input type="date" value={rule.valid_from || ''} onChange={(e) => handleChange(rule.id, 'valid_from', e.target.value)} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 outline-none transition-colors h-7" />
                                    </td>
                                    <td className="py-1.5 px-3">
                                      <input type="date" value={rule.valid_to || ''} onChange={(e) => handleChange(rule.id, 'valid_to', e.target.value)} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 outline-none transition-colors h-7" />
                                    </td>
                                    <td className="py-1.5 px-3">
                                      {rule.companyId === 'ALL' ? (
                                        <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider h-7 flex items-center px-2">Global (ALL)</div>
                                      ) : rule.contractType !== undefined && rule.contractType !== null ? (
                                        <select value={rule.contractType} onChange={(e) => handleChange(rule.id, 'contractType', e.target.value)} className="w-full bg-zinc-950 border border-purple-700/50 rounded px-2 py-1 text-xs text-purple-500 font-bold focus:border-purple-500 outline-none h-7">
                                          <option value="" disabled>Select Contract</option>
                                          {availableContractTypes.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                      ) : rule.franchiseId !== undefined && rule.franchiseId !== null ? (
                                        <select value={rule.franchiseId} onChange={(e) => handleChange(rule.id, 'franchiseId', e.target.value)} className="w-full bg-zinc-950 border border-indigo-700/50 rounded px-2 py-1 text-xs text-indigo-500 font-bold focus:border-indigo-500 outline-none h-7">
                                          <option value="" disabled>Select Franchise</option>
                                          {(franchises || companies).map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                      ) : (
                                        <select value={rule.companyId || ''} onChange={(e) => handleChange(rule.id, 'companyId', e.target.value)} className="w-full bg-zinc-950 border border-amber-700/50 rounded px-2 py-1 text-xs text-amber-500 font-bold focus:border-amber-500 outline-none h-7">
                                          <option value="" disabled>Select Company</option>
                                          {companies.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                      )}
                                    </td>
                                    <td className="py-1.5 px-3">
                                      <div className="relative flex items-center h-7 w-32">
                                        <span className="absolute left-2 text-amber-500/50 text-xs pointer-events-none">$</span>
                                        <input type="number" value={rule.amount || ''} onChange={(e) => handleChange(rule.id, 'amount', Number(e.target.value))} className="w-full bg-zinc-950 border border-amber-700/50 rounded py-1 pl-5 pr-2 text-xs text-zinc-200 font-mono focus:border-indigo-500 outline-none h-full" />
                                      </div>
                                    </td>
                                    <td className="py-1.5 px-3 text-right">
                                      <button onClick={() => handleDelete(rule.id)} className="text-zinc-500 hover:text-rose-500 p-1 rounded transition-colors inline-flex justify-center items-center">
                                        <Trash2 size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                  ));
                                })()}

                                {uniqueDates.filter(dateStr => {
                                  if (revenueFilter.date) {
                                    const pDate = new Date(revenueFilter.date);
                                    const tDate = new Date(pDate); tDate.setUTCDate(pDate.getUTCDate() - 3);
                                    const filterTo = tDate.toISOString().split('T')[0];
                                    const fDate = new Date(pDate); fDate.setUTCDate(pDate.getUTCDate() - 9);
                                    const filterFrom = fDate.toISOString().split('T')[0];
                                    const dDate = new Date(dateStr);
                                    const vfObj = new Date(dDate); vfObj.setUTCDate(dDate.getUTCDate() - 5);
                                    const vfStr = vfObj.toISOString().split('T')[0];
                                    if (filterFrom > dateStr || filterTo < vfStr) return false;
                                  }
                                  return true;
                                }).flatMap(dateStr => {
                                  const dBase = new Date(dateStr);
                                  const day = dBase.getUTCDay();
                                  const diffToMonday = day === 4 ? -3 : (day === 0 ? 1 : (1 - day));
                                  const vTObj = new Date(dBase.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
                                  const vFromStr = new Date(vTObj.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                                  const vToStr = vTObj.toISOString().split('T')[0];

                                  const defaults = getDefaultsForDate(itemName, dateStr);
                                  const customRulesForDate = allRules.filter(r => r.contractType && r.valid_from === vFromStr && r.valid_to === vToStr);
                                  
                                  let contractsToRender = Array.from(new Set([
                                      ...defaults.map(d => d.contractType),
                                      ...customRulesForDate.map(c => c.contractType || '')
                                  ])).filter(Boolean);

                                  if (revenueFilter.contract) {
                                      contractsToRender = contractsToRender.filter(ct => ct === revenueFilter.contract);
                                  }

                                  return contractsToRender.map((ct, idx) => {
                                    const def = defaults.find(d => d.contractType === ct) || { amount: 0 };
                                    const customRule = customRulesForDate.find(r => r.contractType === ct);
                                    const isCustom = !!customRule;
                                    const displayVal = isCustom ? customRule.amount : def.amount;

                                    return (
                                      <tr key={`${dateStr}-${ct}-${idx}`} className="hover:bg-zinc-800/30 transition-colors">
                                        <td className="py-1.5 px-3">
                                          <input type="date" value={vFromStr} disabled className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-500 cursor-not-allowed h-7" />
                                        </td>
                                        <td className="py-1.5 px-3">
                                          <input type="date" value={vToStr} disabled className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-500 cursor-not-allowed h-7" />
                                        </td>
                                        <td className="py-2 px-3 text-xs text-zinc-500 font-bold uppercase tracking-wider">
                                          Contract: {ct}
                                        </td>
                                        <td className="py-2 px-3">
                                          <div className="flex items-center gap-4">
                                            <div className={`relative flex items-center justify-start bg-zinc-950 border border-zinc-700 rounded h-7 focus-within:border-indigo-500 transition-colors overflow-hidden ${!isCustom ? 'opacity-50' : ''}`}>
                                              <span className="pl-2 text-zinc-500 text-xs pointer-events-none flex-shrink-0">$</span>
                                              <input type="number" value={displayVal || ''} disabled={!isCustom} onChange={(e) => {
                                                if (customRule) {
                                                  handleChange(customRule.id, 'amount', Number(e.target.value));
                                                }
                                              }} className="w-20 pr-1 text-zinc-200 bg-transparent border-none outline-none py-1 pl-1 text-xs font-mono h-full" />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                              <label className="flex items-center gap-1 text-[9px] text-zinc-400 cursor-pointer hover:text-zinc-200">
                                                <input type="checkbox" checked={!isCustom} onChange={() => {
                                                  if (customRule) handleDelete(customRule.id);
                                                }} className="accent-indigo-500" /> Default Value
                                              </label>
                                              <label className="flex items-center gap-1 text-[9px] text-zinc-400 cursor-pointer hover:text-zinc-200">
                                                <input type="checkbox" checked={isCustom} onChange={() => {
                                                  if (!isCustom) {
                                                    const newId = Math.random().toString(36).substring(2, 11);
                                                    const newRule: FixedRevenueItem = {
                                                      id: newId,
                                                      name: itemName,
                                                      contractType: ct,
                                                      amount: def.amount,
                                                      valid_from: vFromStr,
                                                      valid_to: vToStr,
                                                      is_standalone: false
                                                    };
                                                    setLocalRevenues(prev => [newRule, ...prev]);
                                                  }
                                                }} className="accent-indigo-500" /> Custom Value
                                              </label>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-1.5 px-3 text-right">
                                          {isCustom && (
                                            <button onClick={() => handleDelete(customRule.id)} className="p-1 text-zinc-600 hover:text-rose-500 transition-colors">
                                              <Trash2 size={14} />
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  });
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FixedRevenue;