import React, { useState, useRef, useEffect } from 'react';
import { AlignLeft, AlignRight, EyeOff, Eye, Columns as ColumnsIcon } from 'lucide-react';

export const ColumnsEditor = ({ columns, setColumns, activeIds }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const togglePin = (id: string, dir: 'left' | 'right') => {
    setColumns(columns.map((c: any) => c.id === id ? { ...c, pinned: c.pinned === dir ? null : dir, pinTime: Date.now() } : c));
  };

  const toggleHide = (id: string) => {
    setColumns(columns.map((c: any) => c.id === id ? { ...c, hidden: !c.hidden } : c));
  };

  return (
    <div className="relative w-full h-full" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-zinc-950 border border-zinc-800 rounded px-2 text-zinc-300 font-sans text-[10px] focus:outline-none focus:border-emerald-500 w-full h-full hover:bg-zinc-900 transition-colors flex items-center justify-center gap-1.5"
      >
        <ColumnsIcon size={12} />
        <span className="whitespace-nowrap">Edit Columns</span>
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-[280px] bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl z-[999999] flex flex-col overflow-hidden max-h-96">
          <div className="overflow-y-auto">
              <table className="w-full text-left text-[10px]">
                <thead className="bg-zinc-900 text-zinc-400 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-1.5 font-medium border-b border-zinc-800">Name</th>
                    <th className="px-1 py-1.5 font-medium text-center border-b border-zinc-800">Pin L</th>
                    <th className="px-1 py-1.5 font-medium text-center border-b border-zinc-800">Pin R</th>
                    <th className="px-2 py-1.5 font-medium text-center border-b border-zinc-800">Hide</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {columns.filter((c: any) => !activeIds || activeIds.includes(c.id)).map((col: any) => (
                    <tr key={col.id} className="hover:bg-zinc-800/50">
                      <td className="px-2 py-1.5 text-zinc-300 truncate max-w-[130px] font-medium">{col.label}</td>
                      <td className="px-1 py-1.5 text-center">
                        <button onClick={() => togglePin(col.id, 'left')} className={`p-1 rounded transition-colors ${col.pinned === 'left' ? 'text-white bg-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}>
                          <AlignLeft size={12} />
                        </button>
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <button onClick={() => togglePin(col.id, 'right')} className={`p-1 rounded transition-colors ${col.pinned === 'right' ? 'text-white bg-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}>
                          <AlignRight size={12} />
                        </button>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => toggleHide(col.id)} className={`p-1 rounded transition-colors ${col.hidden ? 'text-rose-400 bg-rose-400/10' : 'text-zinc-500 hover:text-zinc-300'}`}>
                          {col.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        </div>
      )}
    </div>
  );
};