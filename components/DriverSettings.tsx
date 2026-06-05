import React, { useState } from 'react';
import { X, Save } from 'lucide-react';

const METRICS = [
  { id: 'gross', label: 'Gross' },
  { id: 'margin', label: 'Margin' },
  { id: 'netPay', label: 'Net Pay' },
  { id: 'dispPay', label: 'Dispatcher Pay' },
  { id: 'insExp', label: 'Insurance Expense' },
  { id: 'fuel', label: 'Fuel Efficiency' },
  { id: 'revCol', label: 'Revenue Collected' },
  { id: 'fuelReb', label: 'Fuel Rebate' },
  { id: 'wklyExp', label: 'Weekly Expenses' },
  { id: 'tolls', label: 'Tolls' },
  { id: 'po', label: 'PO Coverage' },
  { id: 'recruiting', label: 'Recruiting' },
  { id: 'pnl', label: 'PnL' }
];

export default function DriverSettings({ onClose, settings, onSave, contracts = [], companies = [] }: any) {
  const [localSettings, setLocalSettings] = useState(settings || {});
  const [selectedEntity, setSelectedEntity] = useState('GLOBAL');

  const updateMetric = (metricId: string, field: string, val: number) => {
    const currentEntityMetric = localSettings[selectedEntity]?.[metricId] || localSettings['GLOBAL']?.[metricId] || { redMax: 0, orangeMin: 0, orangeMax: 0, yellowMin: 0, yellowMax: 0, greenMin: 0 };
    
    setLocalSettings((prev: any) => ({
      ...prev,
      [selectedEntity]: {
        ...(prev[selectedEntity] || {}),
        [metricId]: {
          ...currentEntityMetric,
          [field]: val
        }
      }
    }));
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <h2 className="text-lg font-bold text-zinc-200">Diagnosis Custom Rules</h2>
          <div className="flex items-center gap-4">
            <select 
              value={selectedEntity} 
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-emerald-500 font-bold"
            >
              <option value="GLOBAL" className="font-bold">Global Rules (ALL)</option>
              <optgroup label="Contracts">
                {contracts.map((c: string) => <option key={`CTR:${c}`} value={`CTR:${c}`}>{c}</option>)}
              </optgroup>
              <optgroup label="Companies">
                {companies.map((c: string) => <option key={`CMP:${c}`} value={`CMP:${c}`}>{c}</option>)}
              </optgroup>
            </select>
            <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
          </div>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 bg-zinc-950">
          {METRICS.map(metric => {
            const rule = localSettings[selectedEntity]?.[metric.id] || localSettings['GLOBAL']?.[metric.id] || { redMax: 0, orangeMin: 0, orangeMax: 0, yellowMin: 0, yellowMax: 0, greenMin: 0 };
            
            return (
              <div key={metric.id} className="p-4 border border-zinc-800 rounded bg-zinc-900/40 flex flex-col gap-3">
                <h3 className="text-xs font-bold text-zinc-300 border-b border-zinc-800 pb-2 uppercase tracking-wider">{metric.label}</h3>
                <div className="flex flex-col gap-3">
                  
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[11px] font-bold text-rose-500 uppercase w-16">Critical</span>
                    <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded flex-1">
                      <span className="text-[10px] text-zinc-500 px-3 py-1.5 border-r border-zinc-800 bg-zinc-900 min-w-[45px] text-center">To</span>
                      <input type="number" value={rule.redMax} onChange={(e) => updateMetric(metric.id, 'redMax', Number(e.target.value))} className="w-full bg-transparent px-3 py-1.5 text-sm text-zinc-300 outline-none" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[11px] font-bold text-amber-500 uppercase w-16">Warning</span>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded flex-1">
                        <span className="text-[10px] text-zinc-500 px-3 py-1.5 border-r border-zinc-800 bg-zinc-900 min-w-[45px] text-center">From</span>
                        <input type="number" value={rule.orangeMin} onChange={(e) => updateMetric(metric.id, 'orangeMin', Number(e.target.value))} className="w-full bg-transparent px-3 py-1.5 text-sm text-zinc-300 outline-none" />
                      </div>
                      <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded flex-1">
                        <span className="text-[10px] text-zinc-500 px-3 py-1.5 border-r border-zinc-800 bg-zinc-900 min-w-[45px] text-center">To</span>
                        <input type="number" value={rule.orangeMax} onChange={(e) => updateMetric(metric.id, 'orangeMax', Number(e.target.value))} className="w-full bg-transparent px-3 py-1.5 text-sm text-zinc-300 outline-none" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[11px] font-bold text-yellow-400 uppercase w-16">Neutral</span>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded flex-1">
                        <span className="text-[10px] text-zinc-500 px-3 py-1.5 border-r border-zinc-800 bg-zinc-900 min-w-[45px] text-center">From</span>
                        <input type="number" value={rule.yellowMin} onChange={(e) => updateMetric(metric.id, 'yellowMin', Number(e.target.value))} className="w-full bg-transparent px-3 py-1.5 text-sm text-zinc-300 outline-none" />
                      </div>
                      <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded flex-1">
                        <span className="text-[10px] text-zinc-500 px-3 py-1.5 border-r border-zinc-800 bg-zinc-900 min-w-[45px] text-center">To</span>
                        <input type="number" value={rule.yellowMax} onChange={(e) => updateMetric(metric.id, 'yellowMax', Number(e.target.value))} className="w-full bg-transparent px-3 py-1.5 text-sm text-zinc-300 outline-none" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[11px] font-bold text-emerald-500 uppercase w-16">Good</span>
                    <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded flex-1">
                      <span className="text-[10px] text-zinc-500 px-3 py-1.5 border-r border-zinc-800 bg-zinc-900 min-w-[45px] text-center">From</span>
                      <input type="number" value={rule.greenMin} onChange={(e) => updateMetric(metric.id, 'greenMin', Number(e.target.value))} className="w-full bg-transparent px-3 py-1.5 text-sm text-zinc-300 outline-none" />
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
        
        <div className="p-4 border-t border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <span className="text-xs text-zinc-500">Modifying rules for: <span className="text-zinc-300 font-bold">{selectedEntity}</span></span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors">Cancel</button>
            <button onClick={handleSave} className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors flex items-center gap-2">
              <Save size={14} /> Save Rules
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}