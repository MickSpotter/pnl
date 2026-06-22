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

const CATEGORICAL_FIELDS = ['Contract', 'Company', 'Team', 'Franchise', 'Driver', 'Dispatcher', 'Truck'];
const NUMERIC_FIELDS = ['Eff Drivers', 'Eff Non Teams', 'Eff Trailers', 'Gross', 'Margin', 'Miles', 'Net Pay', 'Net Pay Med', 'Disp. Pay', 'Ins. Exp.', 'Fuel', 'Rev. Col.', 'Rev Base', 'Bal Change', 'Rev Prorated', '0 Mi Cap', 'Escrow Adj', 'Tolls Adj', 'Cash Adv', 'CPM Adj', 'Fuel Adj', 'Fuel Reb.', 'Wkly Exp.', 'Tolls', 'PO', 'Recruiting', 'PnL 4w', '4w Avg', 'Total PnL'];
const ALL_FIELDS = [...CATEGORICAL_FIELDS, ...NUMERIC_FIELDS];

const CAT_OPERATORS = ['is one of', 'is not one of', 'is', 'is not', 'is not empty', 'is empty', 'status is', 'status is not'];
const NUM_OPERATORS = ['is equal', 'is not equal', 'is less than', 'is more than', 'is less or equal', 'is more or equal', 'is not empty', 'is empty'];

const DropdownMultiSelect = ({ options, selected, onChange, placeholder }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
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

  const filteredOptions = options.filter((opt: string) => opt.toLowerCase().startsWith(search.toLowerCase()));

  return (
    <div className="relative w-full h-[26px] min-h-[26px]" ref={wrapperRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="bg-zinc-950 border border-zinc-800 rounded px-2 text-zinc-300 font-sans text-[10px] w-full text-left flex justify-between items-center h-[26px]"
      >
        <span className="truncate">{selected.length > 0 ? `${selected.length} selected` : placeholder}</span>
        <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-950 border border-zinc-700 rounded-lg shadow-xl z-[10000] max-h-48 flex flex-col gap-0.5 min-w-max p-1">
          <div className="px-1 mb-1 shrink-0">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-300 font-sans text-[10px] focus:outline-none focus:border-emerald-500 placeholder:text-zinc-600"
            />
          </div>
          <div className="overflow-y-auto flex flex-col gap-0.5">
            {selected.length > 0 && (
              <div 
                onClick={() => onChange([])}
                className="px-2 py-1.5 hover:bg-zinc-800 rounded cursor-pointer text-[10px] text-rose-400 font-bold shrink-0 border-b border-zinc-800/50 mb-0.5"
              >
                Clear all
              </div>
            )}
            {filteredOptions.map((opt: string) => (
              <label key={opt} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800 rounded cursor-pointer text-[10px] text-zinc-300 shrink-0">
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
        </div>
      )}
    </div>
  );
};

const DropdownSingleSelect = ({ options, selected, onChange, placeholder }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
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

  const filteredOptions = options.filter((opt: string) => opt.toLowerCase().startsWith(search.toLowerCase()));

  return (
    <div className="relative w-full h-[26px] min-h-[26px]" ref={wrapperRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-zinc-950 border border-zinc-800 rounded px-2 text-zinc-300 font-sans text-[10px] w-full text-left flex justify-between items-center h-[26px]"
      >
        <span className="truncate">{selected.length > 0 ? selected[0] : placeholder}</span>
        <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-950 border border-zinc-700 rounded-lg shadow-xl z-[10000] max-h-48 flex flex-col gap-0.5 min-w-max p-1">
          <div className="px-1 mb-1 shrink-0">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-300 font-sans text-[10px] focus:outline-none focus:border-emerald-500 placeholder:text-zinc-600"
            />
          </div>
          <div className="overflow-y-auto flex flex-col gap-0.5">
            {selected.length > 0 && placeholder !== 'Select field...' && (
              <div 
                onClick={() => { onChange([]); setIsOpen(false); setSearch(''); }}
                className="px-2 py-1.5 hover:bg-zinc-800 rounded cursor-pointer text-[10px] text-rose-400 font-bold shrink-0 border-b border-zinc-800/50 mb-0.5"
              >
                Clear all
              </div>
            )}
            {filteredOptions.map((opt: string) => (
              <div
                key={opt}
                onClick={() => { onChange([opt]); setIsOpen(false); setSearch(''); }}
                className="px-2 py-1.5 hover:bg-zinc-800 rounded cursor-pointer text-[10px] text-zinc-300 truncate shrink-0"
              >
                {opt}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
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
  if (['is not empty', 'is empty'].includes(val)) {
    updated.value = CATEGORICAL_FIELDS.includes(f.field) ? [] : '';
  } else if (['is', 'is not'].includes(val) && Array.isArray(f.value) && f.value.length > 1) {
    updated.value = [f.value[0]];
  } else if (['diagnosis is', 'diagnosis is not', 'status is', 'status is not'].includes(val) && !Array.isArray(f.value)) {
    updated.value = [];
  } else if (!['diagnosis is', 'diagnosis is not', 'status is', 'status is not', 'is one of', 'is not one of'].includes(val) && Array.isArray(f.value)) {
    updated.value = '';
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
        className={`flex items-center gap-2 bg-zinc-950 border ${isOpen || filters.length > 0 ? 'border-zinc-600 text-white' : 'border-zinc-800 text-zinc-400'} rounded px-2 text-xs hover:bg-zinc-900 transition-colors h-[26px] justify-between w-full`}
      >
        <div className="flex items-center gap-2">
          <Filter size={12} />
          <span>Filter {filters.length > 0 ? `(${filters.length})` : ''}</span>
        </div>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-zinc-950 border border-zinc-700 rounded-lg shadow-2xl z-[9999] p-3 flex flex-col gap-3 min-w-[550px] w-full">
          <div className="flex items-center border-b border-zinc-800 pb-2 w-full">
            <span className="text-xs font-bold text-zinc-300 whitespace-nowrap">Advanced Master Table Filter</span>
            <button onClick={clearAll} className="text-[10px] text-rose-400 hover:text-rose-300 font-bold ml-auto text-right">Clear All</button>
          </div>

          <div className="flex flex-col gap-2 w-full">
            {filters.map(filter => {
              const isCat = CATEGORICAL_FIELDS.includes(filter.field);
              const fieldOpts = optionsMap[filter.field] || [];
              const isDiagnosisCapable = fieldOpts.includes('good') || fieldOpts.includes('critical');
              const operators = isCat ? CAT_OPERATORS : (isDiagnosisCapable ? [...NUM_OPERATORS, 'diagnosis is', 'diagnosis is not'] : NUM_OPERATORS);

              return (
                <div key={filter.id} className={`grid ${['is not empty', 'is empty'].includes(filter.operator) ? 'grid-cols-[1fr_1fr_auto]' : 'grid-cols-[1fr_1fr_minmax(0,1fr)_auto]'} gap-2 items-center bg-zinc-900/50 p-1.5 rounded border border-zinc-800 w-full min-h-[38px]`}>
                  <div className="w-full h-[26px] min-h-[26px] flex items-stretch">
                    <DropdownSingleSelect
                      options={ALL_FIELDS}
                      selected={[filter.field]}
                      onChange={(val: any) => updateFilter(filter.id, 'field', val[0])}
                      placeholder="Select field..."
                    />
                  </div>

                  <select
                    value={filter.operator}
                    onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded px-2 text-zinc-300 font-sans text-[10px] focus:outline-none focus:border-emerald-500 w-full h-[26px]"
                  >
                    {operators.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>

                  {!['is not empty', 'is empty'].includes(filter.operator) && (
  <div className="w-full h-[26px] min-h-[26px] flex items-stretch">
    {isCat || ['diagnosis is', 'diagnosis is not'].includes(filter.operator) ? (
      ['is one of', 'is not one of', 'diagnosis is', 'diagnosis is not', 'status is', 'status is not'].includes(filter.operator) ? (
        <DropdownMultiSelect
          options={['status is', 'status is not'].includes(filter.operator) ? ['ACTIVE', 'TERMINATED'] : fieldOpts}
          selected={Array.isArray(filter.value) ? filter.value : []}
          onChange={(val: any) => updateFilter(filter.id, 'value', val)}
          placeholder="Select options..."
        />
      ) : (
        <DropdownSingleSelect
          options={['status is', 'status is not'].includes(filter.operator) ? ['ACTIVE', 'TERMINATED'] : fieldOpts}
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
        className="bg-zinc-950 border border-zinc-800 rounded px-2 text-zinc-300 font-sans text-[10px] focus:outline-none focus:border-emerald-500 w-full h-[26px] min-h-[26px] placeholder:text-zinc-600"
      />
    )}
  </div>
)}

                  <button onClick={() => removeFilter(filter.id)} className="w-[20px] h-[26px] flex items-center justify-center hover:bg-zinc-800 rounded text-zinc-500 hover:text-rose-400 transition-colors">
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