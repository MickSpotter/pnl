import React, { useState, useEffect } from 'react';
import { Info } from 'lucide-react';

export interface PORule {
    id?: string;
    contract_type: string;
    category_name: string;
    status: 'Include' | 'Exclude';
    tpog?: 'Only TPOG with franchises' | 'Only TPOG without franchises' | 'ALL TPOG';
}

interface PORulesProps {
    availableCategories: string[];
    poRules: PORule[];
    setPoRules: (rules: PORule[]) => void;
}

export const PORules: React.FC<PORulesProps> = ({ availableCategories, poRules, setPoRules }) => {
    const [selectedContract, setSelectedContract] = useState<string>('MCLOO');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const contracts = ['MCLOO', 'OO', 'LOO', 'POG', 'TPOG', 'TPOG Franchise PnL', 'CPM'];

    const handleStatusChange = (category_name: string, status: 'Include' | 'Exclude') => {
        const existingRule = poRules.find(r => r.contract_type === selectedContract && r.category_name === category_name);
        
        if (status === 'Include') {
            setPoRules(poRules.filter(r => !(r.contract_type === selectedContract && r.category_name === category_name)));
        } else {
            if (existingRule) {
                setPoRules(poRules.map(r => r === existingRule ? { ...r, status } : r));
            } else {
                setPoRules([...poRules, { id: `new_${Math.random().toString(36).substring(7)}`, contract_type: selectedContract, category_name, status, tpog: 'ALL TPOG' }]);
            }
        }
    };

    const getStatusForCategory = (category_name: string): 'Include' | 'Exclude' => {
        const rule = poRules.find(r => r.contract_type === selectedContract && r.category_name === category_name);
        return rule ? rule.status : 'Include';
    };

    const getTpogForCategory = (category_name: string) => {
        const rule = poRules.find(r => r.contract_type === selectedContract && r.category_name === category_name);
        return rule && rule.tpog ? rule.tpog : 'ALL TPOG';
    };

    const handleTpogChange = (category_name: string, tpog: string) => {
        const existingRule = poRules.find(r => r.contract_type === selectedContract && r.category_name === category_name);
        if (existingRule) {
            setPoRules(poRules.map(r => r === existingRule ? { ...r, tpog: tpog as any } : r));
        } else {
            setPoRules([...poRules, { id: `new_${Math.random().toString(36).substring(7)}`, contract_type: selectedContract, category_name, status: 'Exclude', tpog: tpog as any }]);
        }
    };

    const allCombinedCategories = Array.from(new Set([...availableCategories, ...poRules.map(r => r.category_name)])).sort();
    const filteredCategories = allCombinedCategories.filter(category =>
        category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="bg-zinc-950/50 p-6 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-4 sticky top-[-24px] z-50 bg-zinc-950 p-4 -mx-6 -mt-6 mb-6 border-b border-zinc-800 rounded-t-lg shadow-md">
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full md:w-1/3 p-2 bg-zinc-900 border border-zinc-700 rounded-md text-zinc-200 focus:border-emerald-500 outline-none"
                />
                <select
                    value={selectedContract}
                    onChange={(e) => setSelectedContract(e.target.value)}
                    className="w-full md:w-1/3 p-2 bg-zinc-900 border border-zinc-700 rounded-md text-zinc-200 focus:border-emerald-500 outline-none"
                >
                    {contracts.map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
                <div className="group relative cursor-help text-zinc-500 hover:text-orange-500 transition-colors ml-auto">
                    <Info size={20} />
                    <div className="hidden group-hover:block absolute right-0 top-full mt-2 w-72 bg-zinc-800 text-zinc-200 text-xs p-3 rounded shadow-xl normal-case font-normal z-50 pointer-events-none text-left border border-zinc-600">
                        <p className="font-bold text-orange-400 mb-1">PO Rules</p>
                        <p className="mb-2">Determine which Purchase Order categories are included or excluded from calculations for each contract type.</p>
                        <p className="font-bold text-orange-400 mb-1">TPOG Scope</p>
                        <p className="mb-2">When excluding a category for TPOG, specify if the exclusion applies to all TPOG, only TPOG with franchises, or only TPOG without franchises.</p>
                        <p className="font-bold text-orange-400 mb-1">TPOG Franchise PnL</p>
                        <p>This determines the PO categories included or excluded specifically when calculating the Franchise's side of the Profit and Loss statement.</p>
                    </div>
                </div>
            </div>
            
            <div className="flex flex-col">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800 font-medium text-zinc-400">
                    <div>Category</div>
                    <div className="flex items-center justify-end gap-8">
                        {selectedContract === 'TPOG' && <div>TPOG Scope</div>}
                        <div className="w-28 text-right">Action</div>
                    </div>
                </div>
                {filteredCategories.length === 0 && (
                    <div className="text-zinc-500 text-sm italic mt-4">No matching PO categories.</div>
                )}
                {filteredCategories.map(category => {
                    const status = getStatusForCategory(category);
                    const tpogValue = getTpogForCategory(category);
                    return (
                        <div key={category} className="flex items-center justify-between py-3 border-b border-zinc-800/50 last:border-0">
                            <div className="text-zinc-300 font-medium">{category}</div>
                            <div className="flex items-center justify-end gap-8">
                                {selectedContract === 'TPOG' && (
                                    <div>
                                        {status === 'Exclude' && (
                                            <select
                                                value={tpogValue}
                                                onChange={(e) => handleTpogChange(category, e.target.value)}
                                                className="p-2 w-max border rounded-md shadow-sm outline-none font-semibold bg-zinc-900 border-zinc-700 text-zinc-300 focus:border-emerald-500"
                                            >
                                                <option value="Only TPOG with franchises">Only TPOG with franchises</option>
                                                <option value="Only TPOG without franchises">Only TPOG without franchises</option>
                                                <option value="ALL TPOG">ALL TPOG</option>
                                            </select>
                                        )}
                                    </div>
                                )}
                                <div className="w-28 flex justify-end">
                                    <select
                                        value={status}
                                        onChange={(e) => handleStatusChange(category, e.target.value as 'Include' | 'Exclude')}
                                        className={`p-2 border rounded-md shadow-sm outline-none font-semibold w-full text-center ${
                                            status === 'Include' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                                        }`}
                                    >
                                        <option value="Include">Included</option>
                                        <option value="Exclude">Excluded</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};