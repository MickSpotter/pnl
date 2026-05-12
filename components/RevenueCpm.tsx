import React from 'react';
import { Info, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { ExpenseItem } from '../types';

interface RevenueCpmProps {
  localFixedExpenses: ExpenseItem[];
  handleCompanyExpenseChange: (id: string, field: any, newVal: any) => void;
  handleDeleteCompanyExpense: (id: string) => void;
  availableContractTypes: string[];
  companies: string[];
  setLocalFixedExpenses: React.Dispatch<React.SetStateAction<ExpenseItem[]>>;
}

const RevenueCpm: React.FC<RevenueCpmProps> = ({
  localFixedExpenses,
  handleCompanyExpenseChange,
  handleDeleteCompanyExpense,
  availableContractTypes,
  companies,
  setLocalFixedExpenses
}) => {
  const [companyPrompt, setCompanyPrompt] = React.useState<{ isOpen: boolean, callback: (name: string) => void } | null>(null);
  const [companyPromptValue, setCompanyPromptValue] = React.useState('');

  return (
    <div className="max-w-5xl mx-auto space-y-2 -mt-4">
       {companyPrompt?.isOpen && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-lg shadow-2xl w-96 flex flex-col gap-4">
                    <h3 className="text-emerald-500 font-bold text-lg">Add New Company</h3>
                    <input 
                        type="text" 
                        value={companyPromptValue} 
                        onChange={(e) => setCompanyPromptValue(e.target.value)} 
                        placeholder="Enter company name..." 
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500 outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                companyPrompt.callback(companyPromptValue);
                                setCompanyPrompt(null);
                            }
                        }}
                    />
                    <div className="flex justify-end gap-2 mt-2">
                        <button onClick={() => setCompanyPrompt(null)} className="px-4 py-2 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-bold text-xs transition-colors">Cancel</button>
                        <button onClick={() => { companyPrompt.callback(companyPromptValue); setCompanyPrompt(null); }} className="px-4 py-2 rounded bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 font-bold text-xs transition-colors">Confirm</button>
                    </div>
                </div>
            </div>
        )}
       <div className="flex items-center justify-between pb-2 border-b border-zinc-800/50 mb-2">
          <div className="group relative cursor-help text-zinc-500 hover:text-pink-500 transition-colors ml-auto">
             <Info size={16} />
             <div className="hidden group-hover:block absolute right-0 top-full mt-2 w-64 bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded shadow-xl normal-case font-normal z-50 pointer-events-none text-left border border-zinc-600">
                CPM stands for Cost Per Mile. Enter the number that represents the driver's earnings per mile.
             </div>
          </div>
       </div>
       <div className="w-full border border-zinc-800 rounded-lg bg-zinc-950/50 p-4">
          <table className="w-full text-left border-collapse table-fixed">
             <thead>
                <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                   <th className="py-2 pr-2 font-bold w-[30%]">Type / Target</th>
                   <th className="py-2 px-1 font-bold w-[25%]">Valid From</th>
                   <th className="py-2 px-1 font-bold w-[25%]">Valid To</th>
                   <th className="py-2 px-1 font-bold w-[15%]">CPM Amount</th>
                   <th className="w-[5%]"></th>
                </tr>
             </thead>
             <tbody className="divide-y divide-zinc-800/30">
                {localFixedExpenses.filter(e => e.name === 'Revenue CPM').map((rule) => (
                   <tr key={rule.id} className="hover:bg-zinc-800/30 transition-colors group/row">
                      <td className="py-2 pr-2">
                         {rule.companyId === 'ALL' ? (
                            <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider h-7 flex items-center px-2">Global (ALL)</div>
                         ) : (rule as any).contractType !== undefined ? (
                            <select value={(rule as any).contractType || ''} onChange={(e) => handleCompanyExpenseChange(rule.id, 'contractType' as any, e.target.value)} className="w-full bg-zinc-950 border border-purple-700/50 rounded px-2 py-1 text-xs text-purple-500 font-bold focus:border-purple-500 outline-none h-7">
                               <option value="" disabled>Select Contract</option>
                               {availableContractTypes.map(c => <option key={c as string} value={c as string}>{c}</option>)}
                            </select>
                        ) : (
                            <select value={rule.companyId || ''} onChange={(e) => {
                               if (e.target.value === 'NEW_COMPANY') {
                                  setCompanyPromptValue('');
                                  setCompanyPrompt({
                                      isOpen: true,
                                      callback: (newComp) => {
                                          if (newComp && newComp.trim() !== '') {
                                              handleCompanyExpenseChange(rule.id, 'companyId', newComp.trim());
                                          }
                                      }
                                  });
                               } else {
                                  handleCompanyExpenseChange(rule.id, 'companyId', e.target.value);
                               }
                            }} className="w-full bg-zinc-950 border border-amber-700/50 rounded px-2 py-1 text-xs text-amber-500 font-bold focus:border-amber-500 outline-none h-7">
                               <option value="" disabled>Select Company</option>
                               <option value="NEW_COMPANY" className="text-emerald-500 font-bold">+ Add new company</option>
                               {companies.filter(c => c && !['GLOBAL', 'UNRECONCILED', 'UNASSIGNED', 'ALL', 'NEW_COMPANY'].includes(String(c).toUpperCase())).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                         )}
                      </td>
                     <td className="py-2 px-1">
                                   <input type="date" value={rule.valid_from || ''} onChange={(e) => handleCompanyExpenseChange(rule.id, 'valid_from', e.target.value)} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-200 focus:border-pink-500 outline-none transition-colors h-7" />
                                </td>
                                <td className="py-2 px-1">
                                   <input type="date" value={rule.valid_to || ''} onChange={(e) => handleCompanyExpenseChange(rule.id, 'valid_to', e.target.value)} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-200 focus:border-pink-500 outline-none transition-colors h-7" />
                                </td>
                                <td className="py-2 px-1">
                                   <div className="relative flex items-center h-7">
                                      <span className="absolute left-2 text-zinc-500 text-[10px] pointer-events-none">$</span>
                                      <input type="number" step="0.01" value={(rule as any).revenue_cpm ?? ''} onChange={(e) => handleCompanyExpenseChange(rule.id, 'revenue_cpm' as any, e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded py-1 pl-5 pr-2 text-xs text-zinc-200 font-mono focus:border-pink-500 outline-none h-full" />
                                   </div>
                                </td>
                      <td className="py-2 pl-2 text-right">
                         <button onClick={() => handleDeleteCompanyExpense(String(rule.id))} className="text-zinc-600 hover:text-rose-500 transition-colors p-1 rounded opacity-0 group-hover/row:opacity-100 flex justify-center items-center w-8 h-7"><Trash2 size={14} /></button>
                      </td>
                   </tr>
                ))}
             </tbody>
          </table>
          <div className="flex items-center gap-4 mt-3">
             <button onClick={() => {
                const newExp = { id: Math.random().toString(36).substring(2, 11), category: 'Fixed', name: 'Revenue CPM', companyId: 'ALL', revenue_cpm: 0, frequency: 'Weekly', allocationType: 'divide', valid_from: new Date().toISOString().split('T')[0] };
                setLocalFixedExpenses(prev => [...prev, newExp as any]);
             }} className="w-max px-4 py-1.5 border border-dashed border-emerald-500/30 bg-emerald-500/5 rounded hover:bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"><Plus size={12} /> ADD GLOBAL RULE</button>
             <div className="relative group/dropdown">
                          <button className="w-max px-4 py-1.5 border border-dashed border-pink-500/30 bg-pink-500/5 rounded hover:bg-pink-500/10 text-pink-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all">
                             <Plus size={12} /> Add Rule For <ChevronDown size={10} />
                          </button>
                          <div className="absolute hidden group-hover/dropdown:flex flex-col top-full left-0 pt-1 min-w-[140px] z-[9999]">
                   <div className="bg-zinc-900 border border-zinc-700 rounded shadow-xl overflow-hidden flex flex-col w-full">
                      <button onClick={() => {
                         const newExp = { id: Math.random().toString(36).substring(2, 11), category: 'Fixed', name: 'Revenue CPM', companyId: '', contractType: '', revenue_cpm: 0, frequency: 'Weekly', allocationType: 'divide', valid_from: new Date().toISOString().split('T')[0] };
                         setLocalFixedExpenses(prev => [...prev, newExp as any]);
                      }} className="px-4 py-2 text-left text-[10px] font-bold text-purple-500 hover:bg-zinc-800 transition-colors">Contract</button>
                      <button onClick={() => {
                         const newExp = { id: Math.random().toString(36).substring(2, 11), category: 'Fixed', name: 'Revenue CPM', companyId: '', revenue_cpm: 0, frequency: 'Weekly', allocationType: 'divide', valid_from: new Date().toISOString().split('T')[0] };
                         setLocalFixedExpenses(prev => [...prev, newExp as any]);
                      }} className="px-4 py-2 text-left text-[10px] font-bold text-amber-500 hover:bg-zinc-800 transition-colors">Company</button>
                   </div>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

export default RevenueCpm;