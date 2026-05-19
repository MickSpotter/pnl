import React, { useState, useRef, useEffect } from 'react';
import { Filter, ChevronDown, Plus, X, Check } from 'lucide-react';

export interface FilterRule {
  id: string;
  field: string;
  operator: string;
  value: any;
}

interface TableFilterProps {
  filters: FilterRule[];
  setFilters: (filters: FilterRule[]) => void;
  optionsMap: Record<string, string[]>;
}

const CATEGORICAL_FIELDS = ['Contract', 'Company', 'Team', 'Franchise', 'Driver'];
const NUMERIC_FIELDS = ['Eff Drivers', 'Eff Non Teams', 'Eff Trailers', 'Gross', 'Margin', 'Miles', 'Disp. Pay', 'Ins. Exp.', 'Fuel', 'Rev. Col.', 'Rev Base', 'Bal Change', 'Rev Prorated', '0 Mi Cap', 'Escrow Adj', 'Tolls Adj', 'Cash Adv', 'CPM Adj', 'Fuel Adj', 'Fuel Reb.', 'Wkly Exp.', 'Tolls', 'PO', 'Recruiting', 'PnL 4w', '4w Avg', 'Total PnL'];
const ALL_FIELDS = [...CATEGORICAL_FIELDS, ...NUMERIC_FIELDS];

const CAT_OPERATORS = ['is one of', 'is not one of', 'is', 'is not'];
const NUM_OPERATORS = ['is equal', 'is not equal', 'is less than', 'is more than', 'is less or equal', 'is more or equal'];

const DropdownMultiSelect = ({ options, selected, onChange, placeholder }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-48" ref={wrapperRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-300 font-sans text-[10px] w-full text-left flex justify-between items-center h-[26px]"
      >
        <span className="truncate">{selected.length > 0 ? `${selected.length} selected` : placeholder}</span>
        <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-950 border border-zinc-700 rounded-lg shadow-xl z-[10000] max-h-48 overflow-y-auto p-1 flex flex-col gap-0.5 min-w-max">
          {options.map((opt: string) => (
            <label key={opt} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800 rounded cursor-pointer text-[10px] text-zinc-300">
              <input 
                type="checkbox" 
                checked={selected.includes(opt)} 
                onChange={(e) => {
                  if (e.target.checked) onChange([...selected, opt]);
                  else onChange(selected.filter((x: string) => x !== opt));
                }} 
                className="rounded bg-zinc-950 border-zinc-700 accent-emerald-500" 
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

const DropdownSingleSelect = ({ options, selected, onChange, placeholder }: any) => {
  return (
    <select
      value={selected.length > 0 ? selected[0] : ''}
      onChange={(e) => onChange([e.target.value])}
      className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-300 font-sans text-[10px] w-48 focus:outline-none focus:border-emerald-500 h-[26px]"
    >
      <option value="" disabled>{placeholder}</option>
      {options.map((opt: string) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
};

const TableFilter: React.FC<TableFilterProps> = ({ filters, setFilters, optionsMap }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addFilter = () => {
    const newFilter: FilterRule = {
      id: Math.random().toString(36).substr(2, 9),
      field: 'Contract',
      operator: 'is one of',
      value: []
    };
    setFilters([...filters, newFilter]);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, key: keyof FilterRule, val: any) => {
    setFilters(filters.map(f => {
      if (f.id !== id) return f;
      const updated = { ...f, [key]: val };

      if (key === 'field') {
        const isNowCat = CATEGORICAL_FIELDS.includes(val);
        const wasCat = CATEGORICAL_FIELDS.includes(f.field);
        
        if (isNowCat && !wasCat) {
          updated.operator = 'is one of';
          updated.value = [];
        } else if (!isNowCat && wasCat) {
          updated.operator = 'is equal';
          updated.value = '';
        } else if (isNowCat) {
          updated.value = [];
        } else if (!isNowCat) {
          updated.value = '';
        }
      }

      if (key === 'operator') {
        if (['is', 'is not'].includes(val) && Array.isArray(f.value) && f.value.length > 1) {
          updated.value = [f.value[0]];
        }
      }

      return updated;
    }));
  };

  const clearAll = () => {
    setFilters([]);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 bg-zinc-950 border ${isOpen || filters.length > 0 ? 'border-zinc-600 text-white' : 'border-zinc-800 text-zinc-400'} rounded px-2 py-1 text-xs hover:bg-zinc-900 transition-colors h-[26px]`}
      >
        <Filter size={12} />
        <span>Filter {filters.length > 0 ? `(${filters.length})` : ''}</span>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-zinc-950 border border-zinc-700 rounded-lg shadow-2xl z-[9999] p-3 flex flex-col gap-3 min-w-[540px]">
          <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
            <span className="text-xs font-bold text-zinc-300">Advanced Master Table Filter</span>
            <button onClick={clearAll} className="text-[10px] text-rose-400 hover:text-rose-300 font-bold">Clear All</button>
          </div>

          <div className="flex flex-col gap-2">
            {filters.map(filter => {
              const isCat = CATEGORICAL_FIELDS.includes(filter.field);
              const operators = isCat ? CAT_OPERATORS : NUM_OPERATORS;
              const fieldOpts = optionsMap[filter.field] || [];

              return (
                <div key={filter.id} className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded border border-zinc-800">
                  <select
                    value={filter.field}
                    onChange={(e) => updateFilter(filter.id, 'field', e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-300 font-sans text-[10px] focus:outline-none focus:border-emerald-500 w-32 h-[26px]"
                  >
                    {ALL_FIELDS.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>

                  <select
                    value={filter.operator}
                    onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-300 font-sans text-[10px] focus:outline-none focus:border-emerald-500 w-28 h-[26px]"
                  >
                    {operators.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>

                  <div className="w-48">
                    {isCat ? (
                      ['is one of', 'is not one of'].includes(filter.operator) ? (
                        <DropdownMultiSelect
                          options={fieldOpts}
                          selected={Array.isArray(filter.value) ? filter.value : []}
                          onChange={(val: any) => updateFilter(filter.id, 'value', val)}
                          placeholder="Select options..."
                        />
                      ) : (
                        <DropdownSingleSelect
                          options={fieldOpts}
                          selected={Array.isArray(filter.value) ? filter.value : []}
                          onChange={(val: any) => updateFilter(filter.id, 'value', val)}
                          placeholder="Select one..."
                        />
                      )
                    ) : (
                      <input
                        type="number"
                        value={filter.value}
                        onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                        placeholder="Enter value..."
                        className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-300 font-sans text-[10px] focus:outline-none focus:border-emerald-500 w-full h-[26px] placeholder:text-zinc-600"
                      />
                    )}
                  </div>

                  <button onClick={() => removeFilter(filter.id)} className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-rose-400 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          <button
            onClick={addFilter}
            className="flex items-center justify-center gap-1.5 w-full bg-zinc-900 border border-dashed border-zinc-700 hover:border-emerald-500/50 hover:bg-zinc-800/50 text-zinc-400 hover:text-emerald-400 rounded py-1.5 text-[10px] transition-colors"
          >
            <Plus size={12} /> Add Rule
          </button>
        </div>
      )}
    </div>
  );
};

export default TableFilter;