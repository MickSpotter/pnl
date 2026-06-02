import React from 'react';
import { Info, Trash2, Plus, CornerDownRight } from 'lucide-react';

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
  
  const toggleDispMclooRule = (id: string) => setExpandedDispMclooRules(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="max-w-5xl mx-auto space-y-2 -mt-4">
       <div className="flex items-center justify-between pb-2 border-b border-zinc-800/50 mb-2">
          <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-zinc-800">
             <button onClick={() => setDispPayTab('gross_margin')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${dispPayTab === 'gross_margin' ? 'bg-purple-500 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>Gross/Margin %</button>
             <button onClick={() => setDispPayTab('shared_responsibility')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${dispPayTab === 'shared_responsibility' ? 'bg-purple-500 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>Shared Insurance</button>
          </div>
          <div className="group relative cursor-help text-zinc-500 hover:text-purple-500 transition-colors ml-auto">
             <Info size={16} />
             <div className="hidden group-hover:block absolute right-0 top-full mt-2 w-64 bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded shadow-xl normal-case font-normal z-50 pointer-events-none text-left border border-zinc-600">
                Configure percentages for Dispatcher Gross % and Dispatcher Margin %.
             </div>
          </div>
       </div>
       <div className="w-full border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/50 p-4">
          {dispPayTab === 'gross_margin' ? (
             <>
                <table className="w-full text-left border-collapse table-fixed">
                   <thead>
                      <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                         <th className="py-2 pr-1 font-bold w-[10%]">Contract</th>
                         <th className="py-2 px-1 font-bold w-[12%]">Company</th>
                         <th className="py-2 px-1 font-bold w-[12%]">Team</th>
                         <th className="py-2 px-1 font-bold w-[12%]">Dispatcher</th>
                         <th className="py-2 px-1 font-bold w-[11%]">Valid From</th>
                         <th className="py-2 px-1 font-bold w-[11%]">Valid To</th>
                         <th className="py-2 px-1 font-bold w-[8%]">Type</th>
                         <th className="py-2 px-1 font-bold w-[19%]">Values</th>
                         <th className="w-[5%]"></th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-zinc-800/30">
                      {localFixedExpenses.filter(e => e.name === 'Dispatcher Pay').map((rule) => (
                         <tr key={rule.id} className="hover:bg-zinc-800/30 transition-colors group/row">
                            <td className="py-2 pr-1">
                               <select value={(rule as any).contractType || ''} onChange={(e) => handleCompanyExpenseChange(rule.id, 'contractType' as any, e.target.value)} className="w-full bg-zinc-950 border border-purple-700/50 rounded px-1 py-1 text-xs text-purple-500 font-bold focus:border-purple-500 outline-none h-7">
                                  <option value="">ALL</option>
                                  {availableContractTypes.map(c => <option key={c as string} value={c as string}>{c}</option>)}
                               </select>
                            </td>
                            <td className="py-2 px-1">
                               <select value={rule.companyId || ''} onChange={(e) => handleCompanyExpenseChange(rule.id, 'companyId', e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-1 py-1 text-xs text-zinc-300 focus:border-purple-500 outline-none h-7">
                                  <option value="">ALL</option>
                                  {allCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                               </select>
                            </td>
                                                        <td className="py-2 px-1">
                               <select value={(rule as any).team_name || ''} onChange={(e) => handleCompanyExpenseChange(rule.id, 'team_name' as any, e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-1 py-1 text-xs text-zinc-300 focus:border-purple-500 outline-none h-7">
                                  <option value="">ALL</option>
                                  {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
                               </select>
                            </td>
                            <td className="py-2 px-1">
                               <select value={(rule as any).dispatcher_name || ''} onChange={(e) => handleCompanyExpenseChange(rule.id, 'dispatcher_name', e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded px-1 py-1 text-xs text-zinc-300 focus:border-purple-500 outline-none h-7">
                                  <option value="">ALL</option>
                                  {allDispatchers.map(d => <option key={d} value={d}>{d}</option>)}
                               </select>
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
                                  <option value="$">$</option>
                                </select>
                            </td>
                            <td className="py-2 px-1">
                               {rule.unit === '$' ? (
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