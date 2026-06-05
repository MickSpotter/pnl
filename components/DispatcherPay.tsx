import React from 'react';
import { Info, Trash2, Plus, CornerDownRight, Filter, X, ChevronUp, ChevronDown } from 'lucide-react';

interface DispatcherPayProps {
  localFixedExpenses: any[];
  setLocalFixedExpenses: React.Dispatch<React.SetStateAction<any[]>>;
  handleCompanyExpenseChange: (id: string, field: string, newVal: any) => void;
  handleDeleteCompanyExpense: (id: string) => void;
  availableContractTypes: string[];
  aallCompanies: string[];
  allDispatchers: string[];
  allTeams: string[];
}

const MultiSelectDropdown = ({ options, selectedValue, onChange, placeholder = "ALL", colorClass = "text-zinc-300 font-normal", borderClass = "border-zinc-700" }: { options: string[], selectedValue: string, onChange: (val: string) => void, placeholder?: string, colorClass?: string, borderClass?: string }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedArray = selectedValue ? selectedValue.split(',') : [];

  const handleToggle = (opt: string) => {
    if (opt === '') {
       onChange('');
       setIsOpen(false);
       return;
    }
    let current = [...selectedArray];
    if (current.includes(opt)) {
      current = current.filter(v => v !== opt);
    } else {
      current.push(opt);
    }
    onChange(current.join(','));
  };

  const displayText = selectedArray.length === 0 ? placeholder : selectedArray.join(', ');

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button type="button" onClick={() => setIsOpen(!isOpen)} className={`w-full bg-zinc-950 border ${borderClass} rounded px-2 py-1 text-xs focus:border-purple-500 outline-none h-7 flex items-center justify-between transition-colors ${colorClass}`}>
         <span className="truncate text-left flex-1" title={displayText}>{displayText}</span>
         <ChevronDown size={14} className="opacity-70 ml-1 flex-shrink-0" />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-full w-max bg-zinc-900 border border-zinc-700 rounded-md shadow-xl z-[100] max-h-48 overflow-y-auto p-1 flex flex-col gap-0.5 custom-scrollbar">
          <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800 rounded cursor-pointer text-xs text-zinc-300 font-bold">
             <input type="checkbox" checked={selectedArray.length === 0} onChange={() => handleToggle('')} className="rounded bg-zinc-950 border-zinc-700 accent-purple-500" />
             <span className="truncate">ALL</span>
          </label>
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800 rounded cursor-pointer text-xs text-zinc-300">
              <input type="checkbox" checked={selectedArray.includes(opt)} onChange={() => handleToggle(opt)} className="rounded bg-zinc-950 border-zinc-700 accent-purple-500" />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

const DispatcherPay: React.FC<DispatcherPayProps> = ({
  localFixedExpenses,
  setLocalFixedExpenses,
  handleCompanyExpenseChange,
  handleDeleteCompanyExpense,
  availableContractTypes,
  allCompanies,
  allDispatchers,
  allTeams
}) => {
  const [dispPayTab, setDispPayTab] = React.useState<'gross_margin' | 'shared_responsibility'>('gross_margin');
  const [expandedDispMclooRules, setExpandedDispMclooRules] = React.useState<string[]>([]);
  const [expenseFilter, setExpenseFilter] = React.useState({ company: '', contract: '', dispatcher: '', date: '', viewBy: 'all' });
  const [isFilterVisible, setIsFilterVisible] = React.useState(false);
  const [sortConfig, setSortConfig] = React.useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  
  const toggleDispMclooRule = (id: string) => setExpandedDispMclooRules(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSort = (key: string) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  const filteredAndSortedRules = localFixedExpenses
    .filter(e => e.name === 'Dispatcher Pay')
    .filter(e => {
       let match = true;
       if (expenseFilter.company && !(e.companyId || '').split(',').includes(expenseFilter.company) && e.companyId !== 'ALL' && e.companyId !== '') match = false;
       if (expenseFilter.contract && !((e as any).contractType || '').split(',').includes(expenseFilter.contract) && (e as any).contractType !== 'ALL' && (e as any).contractType !== '') match = false;
       if (expenseFilter.dispatcher && !((e as any).dispatcher_name || '').split(',').includes(expenseFilter.dispatcher) && (e as any).dispatcher_name !== 'ALL' && (e as any).dispatcher_name !== '') match = false;
       if (expenseFilter.date) {
           const f = e.valid_from || '2000-01-01';
           const t = e.valid_to || '2099-12-31';
           if (expenseFilter.date < f || expenseFilter.date > t) match = false;
       }
       if (expenseFilter.viewBy !== 'all') {
          if (expenseFilter.viewBy === 'dispatcher' && !e.dispatcher_name) match = false;
          if (expenseFilter.viewBy === 'team' && (!e.team_name || e.dispatcher_name)) match = false;
          if (expenseFilter.viewBy === 'company' && (!e.companyId || e.team_name || e.dispatcher_name)) match = false;
          if (expenseFilter.viewBy === 'contract' && (!e.contractType || e.companyId || e.team_name || e.dispatcher_name)) match = false;
       }
       return match;
    })
    .sort((a, b) => {
       if (!sortConfig) {
          const aAll = (!a.companyId || a.companyId === 'ALL') && (!(a as any).contractType || (a as any).contractType === 'ALL') && (!(a as any).team_name || (a as any).team_name === 'ALL') && (!(a as any).dispatcher_name || (a as any).dispatcher_name === 'ALL');
          const bAll = (!b.companyId || b.companyId === 'ALL') && (!(b as any).contractType || (b as any).contractType === 'ALL') && (!(b as any).team_name || (b as any).team_name === 'ALL') && (!(b as any).dispatcher_name || (b as any).dispatcher_name === 'ALL');
          if (aAll && !bAll) return -1;
          if (!aAll && bAll) return 1;
          return 0;
       }
       let aVal: any = '';
       let bVal: any = '';
       
       switch (sortConfig.key) {
           case 'contract':
               aVal = ((a as any).contractType || 'ALL').toLowerCase();
               bVal = ((b as any).contractType || 'ALL').toLowerCase();
               break;
           case 'company':
               aVal = (a.companyId || 'ALL').toLowerCase();
               bVal = (b.companyId || 'ALL').toLowerCase();
               break;
           case 'team':
               aVal = ((a as any).team_name || 'ALL').toLowerCase();
               bVal = ((b as any).team_name || 'ALL').toLowerCase();
               break;
           case 'dispatcher':
               aVal = ((a as any).dispatcher_name || 'ALL').toLowerCase();
               bVal = ((b as any).dispatcher_name || 'ALL').toLowerCase();
               break;
           case 'valid_from':
               aVal = a.valid_from ? new Date(a.valid_from).getTime() : 0;
               bVal = b.valid_from ? new Date(b.valid_from).getTime() : 0;
               break;
           case 'valid_to':
               aVal = a.valid_to ? new Date(a.valid_to).getTime() : Infinity;
               bVal = b.valid_to ? new Date(b.valid_to).getTime() : Infinity;
               break;
       }

       if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
       if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
       return 0;
    });

  return (
    <div className="max-w-5xl mx-auto space-y-2 -mt-4">
       <div className="sticky top-[-24px] z-[50] flex items-center justify-between pb-3 pt-6 border-b border-zinc-800/50 mb-2 bg-zinc-950/95 backdrop-blur-sm -mx-2 px-2 rounded-b-lg">
          <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
             <button onClick={() => setDispPayTab('gross_margin')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${dispPayTab === 'gross_margin' ? 'bg-purple-500 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>Gross/Margin %</button>
             <button onClick={() => setDispPayTab('shared_responsibility')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${dispPayTab === 'shared_responsibility' ? 'bg-purple-500 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>Shared Insurance</button>
          </div>
          <div className="flex items-center gap-3 ml-auto relative">
             <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500 font-bold uppercase whitespace-nowrap">View by:</span>
                <select value={expenseFilter.viewBy} onChange={(e) => setExpenseFilter({...expenseFilter, viewBy: e.target.value})} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-300 outline-none h-8 font-bold uppercase cursor-pointer">
                   <option value="all">All</option>
                   <option value="contract">Rule for Contract</option>
                   <option value="company">Rule for Company</option>
                   <option value="team">Rule for Team</option>
                   <option value="dispatcher">Rule for Dispatcher</option>
                </select>
             </div>
             <div className="relative">
                 <button onClick={() => setIsFilterVisible(!isFilterVisible)} className={`flex items-center gap-1.5 px-3 py-1.5 border rounded text-[10px] font-bold uppercase transition-colors ${isFilterVisible || expenseFilter.company || expenseFilter.contract || expenseFilter.dispatcher || expenseFilter.date || expenseFilter.viewBy !== 'all' ? 'bg-purple-500/10 text-purple-500 border-purple-500/30 hover:bg-purple-500/20' : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:bg-zinc-800'}`}>
                    <Filter size={14} />
                    Filter
                 </button>
                 {isFilterVisible && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-3 flex flex-col gap-3 z-[100]">
                       <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Filter Rules</span>
                          <button onClick={() => setExpenseFilter({ company: '', contract: '', dispatcher: '', date: '', viewBy: 'all' })} className="text-zinc-500 hover:text-rose-500 transition-colors" title="Clear Filters"><X size={14}/></button>
                       </div>
                       <div className="flex flex-col gap-2">
                          <select value={expenseFilter.company} onChange={(e) => setExpenseFilter({...expenseFilter, company: e.target.value})} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-[10px] text-zinc-300 outline-none">
                             <option value="">All Companies</option>
                             {allCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <select value={expenseFilter.contract} onChange={(e) => setExpenseFilter({...expenseFilter, contract: e.target.value})} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-[10px] text-zinc-300 outline-none">
                             <option value="">All Contracts</option>
                             {availableContractTypes.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
                          </select>
                          <select value={expenseFilter.dispatcher} onChange={(e) => setExpenseFilter({...expenseFilter, dispatcher: e.target.value})} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-[10px] text-zinc-300 outline-none">
                             <option value="">All Dispatchers</option>
                             {allDispatchers.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5">
                             <span className="text-[9px] text-zinc-500 font-bold uppercase w-12">Date:</span>
                             <input type="date" value={expenseFilter.date} onChange={(e) => setExpenseFilter({...expenseFilter, date: e.target.value})} style={{ colorScheme: 'dark' }} className="flex-1 bg-transparent text-[10px] text-zinc-300 outline-none w-full" />
                          </div>
                       </div>
                    </div>
                 )}
             </div>
             <div className="group relative cursor-help text-zinc-500 hover:text-purple-500 transition-colors">
                <Info size={16} />
                <div className="hidden group-hover:block absolute right-0 top-full mt-2 w-64 bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded shadow-xl normal-case font-normal z-[100] pointer-events-none text-left border border-zinc-600">
                   Configure percentages for Dispatcher Gross % and Dispatcher Margin %, or enter a fixed Amount.
                </div>
             </div>
          </div>
       </div>
       <div className="w-full border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/50 p-4">
          {dispPayTab === 'gross_margin' ? (
             <>
                <table className="w-full text-left border-collapse table-fixed">
                   <thead>
                      <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                         <th className="py-2 pr-1 font-bold w-[10%] cursor-pointer hover:text-zinc-200 transition-colors" onClick={() => handleSort('contract')}>
                            <div className="flex items-center gap-1">Contract {sortConfig?.key === 'contract' && (sortConfig.direction === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>)}</div>
                         </th>
                         <th className="py-2 px-1 font-bold w-[12%] cursor-pointer hover:text-zinc-200 transition-colors" onClick={() => handleSort('company')}>
                            <div className="flex items-center gap-1">Company {sortConfig?.key === 'company' && (sortConfig.direction === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>)}</div>
                         </th>
                         <th className="py-2 px-1 font-bold w-[12%] cursor-pointer hover:text-zinc-200 transition-colors" onClick={() => handleSort('team')}>
                            <div className="flex items-center gap-1">Team {sortConfig?.key === 'team' && (sortConfig.direction === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>)}</div>
                         </th>
                         <th className="py-2 px-1 font-bold w-[12%] cursor-pointer hover:text-zinc-200 transition-colors" onClick={() => handleSort('dispatcher')}>
                            <div className="flex items-center gap-1">Dispatcher {sortConfig?.key === 'dispatcher' && (sortConfig.direction === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>)}</div>
                         </th>
                         <th className="py-2 px-1 font-bold w-[11%] cursor-pointer hover:text-zinc-200 transition-colors" onClick={() => handleSort('valid_from')}>
                            <div className="flex items-center gap-1">Valid From {sortConfig?.key === 'valid_from' && (sortConfig.direction === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>)}</div>
                         </th>
                         <th className="py-2 px-1 font-bold w-[11%] cursor-pointer hover:text-zinc-200 transition-colors" onClick={() => handleSort('valid_to')}>
                            <div className="flex items-center gap-1">Valid To {sortConfig?.key === 'valid_to' && (sortConfig.direction === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>)}</div>
                         </th>
                         <th className="py-2 px-1 font-bold w-[8%]">Type</th>
                         <th className="py-2 px-1 font-bold w-[19%]">Values</th>
                         <th className="w-[5%]"></th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-zinc-800/30">
                      {filteredAndSortedRules.map((rule) => (
                         <tr key={rule.id} className="hover:bg-zinc-800/30 transition-colors group/row">
                            <td className="py-2 pr-1">
                               <MultiSelectDropdown options={availableContractTypes as string[]} selectedValue={(rule as any).contractType || ''} onChange={(val) => handleCompanyExpenseChange(rule.id, 'contractType' as any, val)} colorClass="text-purple-500 font-bold" borderClass="border-purple-700/50" />
                            </td>
                            <td className="py-2 px-1">
                               <MultiSelectDropdown options={allCompanies} selectedValue={rule.companyId || ''} onChange={(val) => handleCompanyExpenseChange(rule.id, 'companyId', val)} />
                            </td>
                            <td className="py-2 px-1">
                               <MultiSelectDropdown options={allTeams} selectedValue={(rule as any).team_name || ''} onChange={(val) => handleCompanyExpenseChange(rule.id, 'team_name' as any, val)} />
                            </td>
                            <td className="py-2 px-1">
                               <MultiSelectDropdown options={allDispatchers} selectedValue={(rule as any).dispatcher_name || ''} onChange={(val) => handleCompanyExpenseChange(rule.id, 'dispatcher_name', val)} />
                            </td>
                            <td className="py-2 px-1">
                               <input type="date" value={rule.valid_from || ''} onChange={(e) => handleCompanyExpenseChange(rule.id, 'valid_from', e.target.value)} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-1 py-1 text-[10px] text-zinc-200 focus:border-purple-500 outline-none transition-colors h-7" />
                            </td>
                            <td className="py-2 px-1">
                               <input type="date" value={rule.valid_to || ''} onChange={(e) => handleCompanyExpenseChange(rule.id, 'valid_to', e.target.value)} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-1 py-1 text-[10px] text-zinc-200 focus:border-purple-500 outline-none transition-colors h-7" />
                            </td>
                            <td className="py-2 px-1">
                               <select value={rule.unit || '%'} onChange={(e) => handleCompanyExpenseChange(rule.id, 'unit', e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-1 py-1 text-xs text-zinc-300 focus:border-purple-500 outline-none h-7">
                                  <option value="%">%</option>
                                  <option value="$ per truck">$ per truck</option>
                                  <option value="$ total">$ total</option>
                                </select>
                            </td>
                            <td className="py-2 px-1">
                               {rule.unit === '$ per truck' || rule.unit === '$ total' || rule.unit === '$' ? (
                                  <div className="relative flex items-center h-7">
                                     <span className="absolute left-2 text-zinc-500 text-[10px] pointer-events-none">$</span>
                                     <input type="number" value={rule.amount === 0 || rule.amount == null ? '' : rule.amount} onChange={(e) => handleCompanyExpenseChange(rule.id, 'amount', e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded py-1 pl-5 pr-2 text-xs text-zinc-200 font-mono focus:border-purple-500 outline-none h-full" />
                                  </div>
                               ) : (
                                  <div className="flex gap-1 h-7">
                                     <div className="relative flex items-center flex-1 h-full">
                                        <input type="number" step="0.1" value={(rule as any).disp_gross_perc === 0 || (rule as any).disp_gross_perc == null ? '' : (rule as any).disp_gross_perc} onChange={(e) => handleCompanyExpenseChange(rule.id, 'disp_gross_perc' as any, e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded py-1 pl-1 pr-4 text-[11px] text-zinc-200 font-mono focus:border-purple-500 outline-none h-full" placeholder="Gross" />
                                        <span className="absolute right-1 text-zinc-500 text-[9px] pointer-events-none">%</span>
                                     </div>
                                     <div className="relative flex items-center flex-1 h-full">
                                        <input type="number" step="0.1" value={(rule as any).disp_margin_perc === 0 || (rule as any).disp_margin_perc == null ? '' : (rule as any).disp_margin_perc} onChange={(e) => handleCompanyExpenseChange(rule.id, 'disp_margin_perc' as any, e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded py-1 pl-1 pr-4 text-[11px] text-zinc-200 font-mono focus:border-purple-500 outline-none h-full" placeholder="Margin" />
                                        <span className="absolute right-1 text-zinc-500 text-[9px] pointer-events-none">%</span>
                                     </div>
                                  </div>
                               )}
                            </td>
                            <td className="py-2 pl-2 text-right">
                               <button onClick={() => handleDeleteCompanyExpense(String(rule.id))} className="text-zinc-600 hover:text-rose-500 transition-colors p-1 rounded flex justify-center items-center w-8 h-7"><Trash2 size={14} /></button>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
                <button onClick={() => {
                   const newExp = {
                      id: Math.random().toString(36).substring(2, 11),
                      category: 'Fixed',
                      name: 'Dispatcher Pay',
                      companyId: '',
                      contractType: '',
                      dispatcher_name: '',
                      team_name: '',
                      disp_gross_perc: 0,
                      disp_margin_perc: 0,
                      amount: 0,
                      unit: '%',
                      frequency: 'Weekly',
                      allocationType: 'divide',
                      valid_from: new Date().toISOString().split('T')[0]
                   };
                   setLocalFixedExpenses(prev => [...prev, newExp as any]);
                }} className="w-max px-4 py-1.5 border border-dashed border-purple-500/30 bg-purple-500/5 rounded hover:bg-purple-500/10 text-purple-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all mt-3"><Plus size={12} /> ADD RULE</button>
             </>
          ) : (
             <div className="flex flex-col gap-3 w-full">
                {allCompanies.map(company => {
                   const findMatch = (cId: string) => {
                      const exps = localFixedExpenses.filter(e => e.name === 'Liability Insurance (Auto)' && e.companyId === cId);
                      return exps.sort((a, b) => new Date(b.valid_from || 0).getTime() - new Date(a.valid_from || 0).getTime())[0];
                   };

                   const companyMatch = findMatch(company);
                   if (!companyMatch) return null;

                   const sharedAmt = companyMatch.shared_insurance || 0;
                   const currentVal = (companyMatch as any).disp_mcloo_pay || '';

                   return (
                      <div key={company} className="flex items-center gap-4 py-1.5">
                         <div className="w-32 text-xs font-bold text-zinc-300 truncate" title={company}>{company}</div>
                         <div className="w-32 text-xs text-amber-500 font-mono">Shared: ${sharedAmt}</div>
                         <div className="flex items-center gap-2">
                            <label className="text-[10px] text-purple-500/70 font-bold uppercase">DISPATCHER PAYS:</label>
                            <div className="relative h-7 w-24">
                               <span className="absolute left-2 top-1.5 text-purple-500/50 text-[10px] pointer-events-none">$</span>
                               <input 
                                  type="number" 
                                  value={currentVal} 
                                  onChange={(e) => {
                                     handleCompanyExpenseChange(String(companyMatch.id), 'disp_mcloo_pay' as any, e.target.value);
                                  }}
                                  className="w-full bg-zinc-900 border border-purple-700/50 rounded py-0 pl-6 pr-2 text-xs text-zinc-200 focus:border-purple-500 outline-none h-full"
                               />
                            </div>
                         </div>
                      </div>
                   );
                })}
             </div>
          )}
       </div>
    </div>
  );
};

export default DispatcherPay;