import React from 'react';
import { Plus, Trash2, Info, ChevronDown } from 'lucide-react';
import { ExpenseItem } from '../types';

interface FuelRebateProps {
  localFixedExpenses: ExpenseItem[];
  handleCompanyExpenseChange: (id: string, field: keyof ExpenseItem, newVal: any) => void;
  handleDeleteCompanyExpense: (id: string) => void;
  availableContractTypes: string[];
  companies: string[];
  setLocalFixedExpenses: React.Dispatch<React.SetStateAction<ExpenseItem[]>>;
}

const FuelRebate: React.FC<FuelRebateProps> = ({
  localFixedExpenses,
  handleCompanyExpenseChange,
  handleDeleteCompanyExpense,
  availableContractTypes,
  companies,
  setLocalFixedExpenses
}) => {
  const fuelRebateRules = localFixedExpenses.filter(e => e.name === 'Fuel Rebate');

  return (
    <div className="max-w-5xl mx-auto space-y-2 -mt-4">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/50 mb-2">
        <div className="group relative cursor-help text-zinc-500 hover:text-rose-500 transition-colors ml-auto">
          <Info size={16} />
          <div className="hidden group-hover:block absolute right-0 top-full mt-2 w-64 bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded shadow-xl normal-case font-normal z-50 pointer-events-none text-left border border-zinc-600">
            Configure fuel rebate amount per global, company or contract level.
          </div>
        </div>
      </div>
      <div className="w-full border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/50 p-4">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
              <th className="py-2 pr-2 font-bold w-[25%]">Scope (Contract/Company)</th>
              <th className="py-2 px-1 font-bold w-[20%]">Valid From</th>
              <th className="py-2 px-1 font-bold w-[20%]">Valid To</th>
              <th className="py-2 px-1 font-bold w-[20%]">Amount</th>
              <th className="w-[5%]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/30">
            {fuelRebateRules.map((rule) => {
              const isContract = (rule as any).contractType !== undefined && (rule as any).contractType !== null;
              return (
                <tr key={rule.id} className="hover:bg-zinc-800/30 transition-colors group/row">
                  <td className="py-2 pr-2">
                    {rule.companyId === 'ALL' ? (
                      <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider h-7 flex items-center">Global (ALL)</div>
                    ) : isContract ? (
                      <select value={(rule as any).contractType || ''} onChange={(e) => handleCompanyExpenseChange(rule.id, 'contractType' as any, e.target.value)} className="w-full bg-zinc-950 border border-purple-700/50 rounded px-2 py-1 text-xs text-purple-500 font-bold focus:border-purple-500 outline-none h-7">
                        <option value="" disabled>Select Contract</option>
                        {availableContractTypes.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <select value={rule.companyId || ''} onChange={(e) => handleCompanyExpenseChange(rule.id, 'companyId', e.target.value)} className="w-full bg-zinc-950 border border-amber-700/50 rounded px-2 py-1 text-xs text-amber-500 font-bold focus:border-amber-500 outline-none h-7">
                        <option value="" disabled>Select Company</option>
                        {companies.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="py-2 px-1">
                    <input type="date" value={rule.valid_from || ''} onChange={(e) => handleCompanyExpenseChange(rule.id, 'valid_from', e.target.value)} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-200 focus:border-rose-500 outline-none transition-colors h-7" />
                  </td>
                  <td className="py-2 px-1">
                    <input type="date" value={rule.valid_to || ''} onChange={(e) => handleCompanyExpenseChange(rule.id, 'valid_to', e.target.value)} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-200 focus:border-rose-500 outline-none transition-colors h-7" />
                  </td>
                  <td className="py-2 px-1">
                    <div className="relative flex items-center h-7">
                      <span className="absolute left-2 text-zinc-500 text-[10px] pointer-events-none">$</span>
                      <input type="number" step="0.01" value={(rule.amount !== undefined && rule.amount !== null && rule.amount !== '') ? rule.amount : ''} onChange={(e) => handleCompanyExpenseChange(rule.id, 'amount', e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded py-1 pl-5 pr-2 text-xs text-zinc-200 font-mono focus:border-rose-500 outline-none h-full" />
                    </div>
                  </td>
                  <td className="py-2 pl-2 text-right">
                    <button onClick={() => handleDeleteCompanyExpense(String(rule.id))} className="text-zinc-600 hover:text-rose-500 transition-colors p-1 rounded opacity-0 group-hover/row:opacity-100 flex justify-center items-center w-8 h-7"><Trash2 size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center gap-4 mt-3">
          <button onClick={() => {
            const newExp = {
              id: Math.random().toString(36).substring(2, 11),
              category: 'Fixed',
              name: 'Fuel Rebate',
              companyId: 'ALL',
              amount: 0,
              unit: '$',
              frequency: 'Weekly',
              allocationType: 'divide',
              valid_from: new Date().toISOString().split('T')[0]
            };
            setLocalFixedExpenses(prev => [...prev, newExp as any]);
          }} className="w-max px-4 py-1.5 border border-dashed border-emerald-500/50 bg-emerald-500/5 rounded hover:bg-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"><Plus size={12} /> ADD GLOBAL RULE</button>
          
          <div className="relative group/dropdown">
             <button className="w-max px-4 py-1.5 border border-dashed border-amber-500/50 bg-amber-500/5 rounded hover:bg-amber-500/20 text-amber-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all">
                <Plus size={12} /> Add Rule For <ChevronDown size={10} />
             </button>
             <div className="absolute hidden group-hover/dropdown:flex flex-col top-full left-0 pt-1 w-full z-50">
                <div className="bg-zinc-900 border border-zinc-700 rounded shadow-xl overflow-hidden flex flex-col w-full">
                   <button onClick={() => {
                      const newExp = {
                        id: Math.random().toString(36).substring(2, 11),
                        category: 'Fixed',
                        name: 'Fuel Rebate',
                        companyId: '',
                        contractType: '',
                        amount: 0,
                        unit: '$',
                        frequency: 'Weekly',
                        allocationType: 'divide',
                        valid_from: new Date().toISOString().split('T')[0]
                      };
                      setLocalFixedExpenses(prev => [...prev, newExp as any]);
                   }} className="px-4 py-2 text-left text-[10px] font-bold text-purple-500 hover:bg-zinc-800 transition-colors">Contract</button>
                   <button onClick={() => {
                      const newExp = {
                        id: Math.random().toString(36).substring(2, 11),
                        category: 'Fixed',
                        name: 'Fuel Rebate',
                        companyId: '',
                        amount: 0,
                        unit: '$',
                        frequency: 'Weekly',
                        allocationType: 'divide',
                        valid_from: new Date().toISOString().split('T')[0]
                      };
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

export default FuelRebate;