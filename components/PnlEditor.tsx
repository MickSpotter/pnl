import React from 'react';
import { PnlConfig } from '../types';

interface PnlEditorProps {
  pnlConfigs: PnlConfig[];
  setPnlConfigs: React.Dispatch<React.SetStateAction<PnlConfig[]>>;
  availableContractTypes: string[];
}

const PNL_ITEMS = [
  { id: 'revenue_collected', label: 'Revenue Collected' },
  { id: 'fuel_rebate', label: 'Fuel Rebate' },
  { id: 'dispatcher_pay', label: 'Disp. Pay' },
  { id: 'weekly_expenses', label: 'Weekly Expenses' },
  { id: 'po', label: 'PO' },
  { id: 'tolls', label: 'Tolls' },
  { id: 'recruiting', label: 'Recruiting' }
];

const PnlEditor: React.FC<PnlEditorProps> = ({ pnlConfigs, setPnlConfigs, availableContractTypes }) => {
   const toggleItem = (contractType: string, itemId: string) => {
      const existingIndex = pnlConfigs.findIndex(c => c.contract_type === contractType);
      let currentItems = existingIndex !== -1 ? [...pnlConfigs[existingIndex].toggled_items] : PNL_ITEMS.map(i => i.id);

      if (currentItems.includes(itemId)) {
          currentItems = currentItems.filter(i => i !== itemId);
      } else {
          currentItems.push(itemId);
      }

      if (existingIndex !== -1) {
          const newConfigs = [...pnlConfigs];
          newConfigs[existingIndex] = { ...newConfigs[existingIndex], toggled_items: currentItems };
          setPnlConfigs(newConfigs);
      } else {
          setPnlConfigs([...pnlConfigs, { id: Math.random().toString(36).substring(7), contract_type: contractType, toggled_items: currentItems }]);
      }
   };

   const getConfigItems = (contractType: string) => {
      const config = pnlConfigs.find(c => c.contract_type === contractType);
      return config ? config.toggled_items : PNL_ITEMS.map(i => i.id);
   };

   const getGroupedContract = (c: string) => {
      const upper = c.toUpperCase();
      if (upper.includes('TPOG')) return 'TPOG';
      if (upper === 'OO' || upper.includes('OO WITH FRANCHISE')) return 'OO';
      return c;
   };

   const groupedContracts = Array.from(new Set(availableContractTypes.map(getGroupedContract)));

   return (
      <div className="max-w-5xl mx-auto -mt-4">
         <div className="w-full border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/50">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-zinc-900 border-b border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                     <th className="p-2 pl-3 font-bold w-[15%]">Contract Type</th>
                     <th className="p-2 font-bold">PNL Calculation</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-zinc-800/50">
                  {groupedContracts.map(contract => {
                     const activeItems = getConfigItems(contract);
                     return (
                        <tr key={contract} className="hover:bg-zinc-800/30 transition-colors">
                           <td className="p-3 pl-3 text-xs font-bold text-zinc-300 align-middle">
                              {contract}
                           </td>
                           <td className="p-3 align-middle">
                              <div className="flex flex-wrap items-center gap-1.5">
                                 <span className="text-[11px] font-black text-emerald-500 mr-1">PNL =</span>
                                 {PNL_ITEMS.map((item, index) => {
                                    const isActive = activeItems.includes(item.id);
                                    return (
                                       <React.Fragment key={item.id}>
                                          <button
                                             onClick={() => toggleItem(contract, item.id)}
                                             className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border ${isActive ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-zinc-900 text-zinc-600 border-zinc-800 hover:text-zinc-400 hover:bg-zinc-800 line-through decoration-zinc-600'}`}
                                          >
                                             {item.label}
                                          </button>
                                          {index < PNL_ITEMS.length - 1 && (
                                             <span className="text-zinc-600 font-bold text-[10px]">{PNL_ITEMS[index + 1].id === 'fuel_rebate' ? '+' : '-'}</span>
                                          )}
                                       </React.Fragment>
                                    );
                                 })}
                              </div>
                           </td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>
      </div>
   );
};

export default PnlEditor;