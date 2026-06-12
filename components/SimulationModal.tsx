import React from 'react';
import { X, Save, Sliders, Plus, Trash2, ChevronDown, Settings, Edit2, Info, CornerDownRight, Eye, EyeOff, FileText, Bold, Italic, Underline, List, ListOrdered, Palette, Filter, PlayCircle } from 'lucide-react';
import { formatCurrency } from '../utils';
import { supabase } from '../lib/supabase';
import RevenueCpm from './RevenueCpm';
import PnlEditor from './PnlEditor';
import FuelRebate from './FuelRebate';
import DispatcherPay from './DispatcherPay';
import TutorialModal from './ExpensesTutorial';
import FixedRevenue from './FixedRevenue';
import { SimulationConfig, ExpenseItem, ConfigContract, PnlConfig, FixedRevenueItem } from '../types';

interface SimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  simulationConfig: SimulationConfig;
  setSimulationConfig: (config: SimulationConfig) => void;
  fixedExpenses: ExpenseItem[];
  setFixedExpenses: (expenses: ExpenseItem[]) => void;
  onSaveExpenses?: (expenses: ExpenseItem[]) => Promise<void> | void;
  companies: string[];
  configContracts?: ConfigContract[];
  setConfigContracts?: (contracts: ConfigContract[]) => void;
  drivers?: any[];
  currentNetIncome?: number;
  onDataSync?: () => void;
  fixedCostsData?: any[];
}

const SimulationModal: React.FC<SimulationModalProps> = ({
  isOpen, 
  onClose, 
  simulationConfig, 
  setSimulationConfig,
  fixedExpenses,
  setFixedExpenses,
  onSaveExpenses,
  companies,
  configContracts = [],
  setConfigContracts,
  onDataSync,
  fixedCostsData,
  drivers
}) => {
  const [localSimConfig, setLocalSimConfig] = React.useState<SimulationConfig>(simulationConfig);
  const [localFixedExpenses, setLocalFixedExpenses] = React.useState<ExpenseItem[]>(fixedExpenses);
  const [localConfigContracts, setLocalConfigContracts] = React.useState<ConfigContract[]>(configContracts || []);
  const [localRevenues, setLocalRevenues] = React.useState<FixedRevenueItem[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [loadingMessage, setLoadingMessage] = React.useState('Saving...');
  const [activeTab, setActiveTab] = React.useState<'fixed' | 'contracts' | 'dispatcher' | 'fixed_revenue' | 'cpm' | 'pnl' | 'fuel_rebate'>('fixed');
  const [selectedContractType, setSelectedContractType] = React.useState('');
  const [pnlConfigs, setPnlConfigs] = React.useState<PnlConfig[]>([]);
  const [selectedExpenseName, setSelectedExpenseName] = React.useState('');
  const [expenseColumns, setExpenseColumns] = React.useState<Record<string, string[]>>({});
  const [isExpenseManagerOpen, setIsExpenseManagerOpen] = React.useState(false);
  const [customExpenseNames, setCustomExpenseNames] = React.useState<string[]>([]);
  const [managerNewExpense, setManagerNewExpense] = React.useState('');
  const [editingExpense, setEditingExpense] = React.useState<string | null>(null);
  const [editingExpenseValue, setEditingExpenseValue] = React.useState('');
  const [companyPrompt, setCompanyPrompt] = React.useState<{ isOpen: boolean, callback: (name: string) => void } | null>(null);
  const [companyPromptValue, setCompanyPromptValue] = React.useState('');
  const [customCompanies, setCustomCompanies] = React.useState<string[]>([]);
  const allCompanies = Array.from(new Set([
      ...companies, 
      ...customCompanies, 
      ...localFixedExpenses.map(e => e.companyId)
  ])).filter(c => c && !['GLOBAL', 'UNRECONCILED', 'UNASSIGNED', 'ALL', 'NEW_COMPANY'].includes(String(c).toUpperCase()));

   const allDispatchers = Array.from(new Set(drivers?.map(d => d.dispatcherId).filter(Boolean))).sort() as string[];
  const uniqueTeams = Array.from(new Set([
      ...(drivers?.map(d => d.teamId).filter(Boolean) || []),
      ...localFixedExpenses.map(e => (e as any).team_name).filter(Boolean)
  ])).sort() as string[];

  const [finImportData, setFinImportData] = React.useState<any[]>([]);
  const [finImportPerUnitData, setFinImportPerUnitData] = React.useState<any[]>([]);
  const [modifiedFinImportIds, setModifiedFinImportIds] = React.useState<string[]>([]);
  const [newFinDates, setNewFinDates] = React.useState<Record<string, string>>({});
  const [newFinToDates, setNewFinToDates] = React.useState<Record<string, string>>({});
  const [expandedMclooRules, setExpandedMclooRules] = React.useState<string[]>([]);
  const [mclooEditModes, setMclooEditModes] = React.useState<Record<string, 'shared' | 'base'>>({});
  const [mclooSelectedDates, setMclooSelectedDates] = React.useState<Record<string, string>>({});
  const [hideOverriddenRules, setHideOverriddenRules] = React.useState(true);
  const [customAlert, setCustomAlert] = React.useState<{ isOpen: boolean, message: string, title: string } | null>(null);
      const [reductionModal, setReductionModal] = React.useState<{ isOpen: boolean, expenseKey: string, expenseName: string } | null>(null);
      const [reductionForm, setReductionForm] = React.useState({ type: 'ALL', target: '', validFrom: '', validTo: '', amount: '', note: '' });
      const [editingReduction, setEditingReduction] = React.useState<{ source: 'fixed' | 'fin', groupIds: string[] } | null>(null);
    const [expenseFilter, setExpenseFilter] = React.useState({ company: '', contract: '', date: '', sort: 'A-Z' });
  const [isFilterVisible, setIsFilterVisible] = React.useState(false);
  const [tutorialState, setTutorialState] = React.useState<{ isOpen: boolean, type: 'rules' | 'reductions' | null }>({ isOpen: false, type: null });
  const [isTopTutorialDropdownOpen, setIsTopTutorialDropdownOpen] = React.useState(false);
  const [isTabTutorialDropdownOpen, setIsTabTutorialDropdownOpen] = React.useState(false);

  const reductionNoteRef = React.useRef<HTMLDivElement>(null);
      const [isBoldActive, setIsBoldActive] = React.useState(false);
      const [isItalicActive, setIsItalicActive] = React.useState(false);
      const [isUnderlineActive, setIsUnderlineActive] = React.useState(false);

      const enforceDayOfWeek = (dateString: string, targetDay: number) => {
          if (!dateString) return dateString;
          const d = new Date(dateString);
          const currentDay = d.getUTCDay();
          if (currentDay !== targetDay) {
              const diff = targetDay - currentDay;
              d.setUTCDate(d.getUTCDate() + (diff > 3 ? diff - 7 : (diff < -3 ? diff + 7 : diff)));
              return d.toISOString().split('T')[0];
          }
          return dateString;
      };
      
      const handleApplyReduction = () => {
          if (!reductionModal || !reductionForm.validFrom || !reductionForm.amount) return;
          if (reductionForm.type !== 'ALL' && !reductionForm.target) {
              setCustomAlert({ isOpen: true, title: 'Error', message: 'Please select a company or contract.' });
              return;
          }
          const note = reductionNoteRef.current ? reductionNoteRef.current.innerHTML : reductionForm.note;
          const { type, target, validFrom, validTo, amount } = reductionForm;
          const reductionNum = Number(amount) || 0;
          const isTruck = reductionModal.expenseKey === 'avg_truck_price';
          const reductionKey = isTruck ? 'truck_reduction' : 'trailer_reduction';
          const reductionNoteKey = isTruck ? 'truck_reduction_note' : 'trailer_reduction_note';
          const rTo = validTo || '2099-12-31';

          let currentFixed = [...localFixedExpenses];
          let currentFin = [...finImportData];
          let currentModifiedFin = [...modifiedFinImportIds];

          if (editingReduction) {
              if (editingReduction.source === 'fixed') {
                      const oldDummies = currentFixed.filter(e => editingReduction.groupIds.includes(String(e.id)));
                      currentFixed = currentFixed.map(e => editingReduction.groupIds.includes(String(e.id)) ? { ...e, [reductionKey]: null } : e).filter(e => {
                          if (editingReduction.groupIds.includes(String(e.id)) && ((e as any).is_dummy || Number(e.amount || 0) === 0)) return false;
                          return true;
                      });
                      
                      oldDummies.forEach(oldD => {
                      if (oldD.companyId === 'ALL') {
                          const oFrom = oldD.valid_from || '2000-01-01';
                          const oTo = oldD.valid_to || '2099-12-31';
                          currentFin = currentFin.map(d => {
                              const dDate = new Date(d.week_ending);
                              const vfObj = new Date(dDate); vfObj.setUTCDate(dDate.getUTCDate() - 5);
                              const vfStr = vfObj.toISOString().split('T')[0];
                              const vtStr = (d as any).valid_to || d.week_ending;
                              if (vfStr <= oTo && vtStr >= oFrom && (d as any)[reductionKey] === Number((oldD as any)[reductionKey])) {
                                  currentModifiedFin.push(String(d.id));
                                  return { ...d, [reductionKey]: null };
                              }
                              return d;
                          });
                      }
                  });
              } else if (editingReduction.source === 'fin') {
                  currentFin = currentFin.map(d => editingReduction.groupIds.includes(String(d.id)) ? { ...d, [reductionKey]: null } : d);
                  currentModifiedFin = Array.from(new Set([...currentModifiedFin, ...editingReduction.groupIds]));
              }
          }

          let appliedToExisting = false;
          const nextFixed = currentFixed.map(e => {
              if (e.name !== reductionModal.expenseName) return e;
              if (type === 'COMPANY' && (e.companyId !== target || e.companyId === 'ALL')) return e;
              if (type === 'CONTRACT' && ((e as any).contractType !== target || e.companyId === 'ALL')) return e;
              if (type === 'ALL' && e.companyId !== 'ALL') return e;
              
              const eFrom = e.valid_from || (e as any).original_valid_from || '2000-01-01';
              const eTo = e.valid_to || '2099-12-31';
              const targetTo = validTo || '2099-12-31';
              
              if (eFrom === validFrom && (e.valid_to === validTo || eTo === targetTo)) {
                  appliedToExisting = true;
                  return { ...e, [reductionKey]: reductionNum, [reductionNoteKey]: note };
              }
              return e;
          });

          if (!appliedToExisting) {
              nextFixed.push({
                  id: (editingReduction && editingReduction.source === 'fixed' && editingReduction.groupIds.length === 1) ? editingReduction.groupIds[0] : Math.random().toString(36).substring(2, 11),
                  category: 'Fixed',
                  name: reductionModal.expenseName,
                  companyId: type === 'ALL' ? 'ALL' : (type === 'COMPANY' ? target : ''),
                  contractType: type === 'CONTRACT' ? target : '',
                  amount: 0,
                  frequency: 'Weekly',
                  allocationType: 'divide',
                  unit: '$',
                  valid_from: validFrom,
                  valid_to: validTo || '',
                  [reductionKey]: reductionNum,
                  [reductionNoteKey]: note,
                  is_dummy: true,
                  is_standalone: false
              } as any);
          }
          setLocalFixedExpenses(nextFixed);

          if (type === 'ALL') {
              currentFin = currentFin.map(d => {
                  const dDate = new Date(d.week_ending);
                  const vfObj = new Date(dDate); vfObj.setUTCDate(dDate.getUTCDate() - 5);
                  const vfStr = vfObj.toISOString().split('T')[0];
                  const vtStr = (d as any).valid_to || d.week_ending;
                  if (vfStr <= rTo && vtStr >= validFrom) {
                      currentModifiedFin.push(String(d.id));
                      return { ...d, [reductionKey]: reductionNum };
                  }
                  return d;
              });
          }
          
          setFinImportData(currentFin);
          setModifiedFinImportIds(Array.from(new Set(currentModifiedFin)));
          
          setReductionForm({ type: 'ALL', target: '', validFrom: '', validTo: '', amount: '', note: '' });
          setEditingReduction(null);
          if (reductionNoteRef.current) reductionNoteRef.current.innerHTML = '';
      };

      const toggleMclooRule = (id: string) => setExpandedMclooRules(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  

  const finImportKeys = [
{ name: 'Liability Insurance (Auto)', key: 'liability_insurance', puKey: 'liability_insurance_auto_custom' },
{ name: 'Liability Insurance (General)', key: 'liability_insurance_general', puKey: 'liability_insurance_general_custom' },
{ name: 'Cargo Insurance', key: 'cargo_insurance', puKey: 'cargo_insurance_custom' },
{ name: 'Lease Gap Coverage', key: 'lease_gap_coverage', puKey: 'lease_gap_coverage_custom' },
{ name: 'Trailer Interchange', key: 'trailer_interchange', puKey: 'trailer_interchange_custom' },
{ name: 'LAGO', key: 'lago', puKey: 'lago_custom' },
{ name: 'PD Premium', key: 'physical_damage_premium', puKey: 'pd_premium_custom' },
{ name: 'Physical Damage', key: 'physical_damage', puKey: 'physical_damage_custom' },
{ name: 'Truck Price', key: 'avg_truck_price', puKey: 'truck_price' },
{ name: 'Trailer Price', key: 'avg_trailer_price', puKey: 'trailer_price' },
{ name: 'Phone & Internet', key: 'phone_and_internet', puKey: 'phone_and_internet' },
{ name: 'Office Supplies', key: 'office_supplies', puKey: 'office_supplies' },
{ name: 'Telematics', key: 'telematics', puKey: 'telematics' },
{ name: 'Rent & Parking', key: 'rent_and_parking', puKey: 'rent_and_parking' },
{ name: 'Backup MCs', key: 'backup_mcs', puKey: 'backup_mc' },
{ name: 'Back Office Pay', key: 'back_office_pay', puKey: 'backoffice_reg' },
{ name: 'Tech Pay', key: 'tech_pay', puKey: 'backoffice_tech' }
];

const availableContractTypes = Array.from(new Set(['MCLOO', 'LOO', 'LPOO', 'OO', 'MCOO', 'POG', 'TPOG', 'CPM', ...localConfigContracts.map(c => (c.contract_type === 'TPOG WITH FRANCHISE' || c.contract_type === 'OO WITH FRANCHISE') ? c.contract_type.replace(' WITH FRANCHISE', '') : c.contract_type)])).filter(Boolean);

const fixedExpenseNames = Array.from(new Set([
'CPM', 'Plates', 'Factoring', 
...localFixedExpenses.map(e => e.name), 
...customExpenseNames
])).filter(Boolean);

  const filteredFixedNames = fixedExpenseNames.filter(name => !finImportKeys.some(fi => fi.name === name) && name !== 'Liability Insurance (Global)' && name !== 'Dispatcher Pay' && name !== 'Revenue CPM' && name !== 'Fuel Rebate' && !name.startsWith('MCLOO_INCLUDE_'));

  const unifiedExpenses = [
    ...filteredFixedNames.map(name => ({ type: 'FIXED', name, key: '', puKey: '' })),
    ...finImportKeys.map(fi => ({ type: 'FINIMPORT', name: fi.name, key: fi.key, puKey: fi.puKey }))
  ];

 React.useEffect(() => {
        if (isOpen) {
          setLocalSimConfig(simulationConfig);
          setLocalFixedExpenses([...fixedExpenses].filter(e => e.contract_type !== 'TPOG WITH FRANCHISE' && (e as any).contractType !== 'TPOG WITH FRANCHISE' && e.contract_type !== 'OO WITH FRANCHISE' && (e as any).contractType !== 'OO WITH FRANCHISE').map(e => {
              const mapped: any = { ...e, original_valid_from: e.valid_from };
              if (mapped.name === 'Liability Insurance') mapped.name = 'Liability Insurance (Auto)';
              if (mapped.contract_type) {
                  mapped.contractType = mapped.contract_type;
              }
              if (Number(mapped.amount || 0) === 0 && (mapped.truck_reduction || mapped.trailer_reduction)) {
                  mapped.is_dummy = true;
              }
              return mapped;
          }).sort((a, b) => {
              if (a.companyId === 'ALL' && b.companyId !== 'ALL') return -1;
              if (a.companyId !== 'ALL' && b.companyId === 'ALL') return 1;
              const dateA = a.valid_from ? new Date(a.valid_from).getTime() : 0;
              const dateB = b.valid_from ? new Date(b.valid_from).getTime() : 0;
              return dateB - dateA;
          }));
          setLocalConfigContracts((configContracts || []).filter(c => c.contract_type !== 'TPOG WITH FRANCHISE' && c.contract_type !== 'OO WITH FRANCHISE'));

          const fetchFinData = async () => {
             const { data: importData } = await supabase.from('finImport').select('*').order('week_ending', { ascending: false });
             const { data: perUnitData } = await supabase.from('fixed_costs').select('*').order('week_ending', { ascending: false });
             
             if (importData) {
                setFinImportData(importData);
             }
             if (perUnitData) {
                setFinImportPerUnitData(perUnitData);
             }
             
             const { fetchPnlConfigs } = await import('../lib/supabase');
             const loadedPnlConfigs = await fetchPnlConfigs();
             setPnlConfigs(loadedPnlConfigs.filter((c: any) => c.contract_type !== 'TPOG WITH FRANCHISE' && c.contract_type !== 'OO WITH FRANCHISE'));
             const { data: revData } = await supabase.from('custom_fixed_revenue').select('*');
             if (revData) {
                setLocalRevenues(revData.map((r: any) => ({
                    ...r,
                    companyId: r.company_id,
                    contractType: r.contract_type,
                    franchiseId: r.franchise_id,
                    is_standalone: true
                })));
             }
          };
          fetchFinData();
    }
  }, [isOpen, simulationConfig, fixedExpenses, configContracts]);

  if (!isOpen) return null;

  const handleCompanyExpenseChange = (id: string, field: keyof ExpenseItem, newVal: any) => {
     setLocalFixedExpenses(prev => {
        let next = prev.map(e => String(e.id) === String(id) ? { ...e, [field]: newVal } : e);
        if (field === 'valid_from') {
           const updatedExp = next.find(e => String(e.id) === String(id));
           if (updatedExp && updatedExp.companyId === 'ALL' && newVal) {
              const globals = next.filter(e => e.name === updatedExp.name && e.companyId === 'ALL' && e.valid_from)
                                  .sort((a, b) => new Date(a.valid_from!).getTime() - new Date(b.valid_from!).getTime());
              for (let i = 0; i < globals.length - 1; i++) {
                 const current = globals[i];
                 const nextRule = globals[i + 1];
                 const d = new Date(nextRule.valid_from!);
                 d.setUTCDate(d.getUTCDate() - 1);
                 const newValidTo = d.toISOString().split('T')[0];
                 if (current.valid_to !== newValidTo) {
                    next = next.map(e => e.id === current.id ? { ...e, valid_to: newValidTo } : e);
                 }
              }
           }
        }
        return next;
     });
  };

  const handleAddCompanyExpense = (expName: string, company: string) => {
     const newExp: ExpenseItem = {
        id: Math.random().toString(36).substring(2, 11),
        category: 'Fixed' as const,
        name: expName,
        companyId: company === 'ALL' ? 'ALL' : company,
        amount: 0,
        amount_before: 0,
        amount_after: 0,
        frequency: 'Weekly' as const,
        allocationType: 'divide' as const,
                unit: expName === 'Factoring' ? '%' : '$',
                   valid_from: new Date().toISOString().split('T')[0],
                   is_standalone: true
                } as any;
        setLocalFixedExpenses(prev => [newExp, ...prev]);
     };

  const handleAddContractExpense = (expName: string) => {
     const newExp: any = {
        id: Math.random().toString(36).substring(2, 11),
        category: 'Fixed',
        name: expName,
        companyId: '',
        contractType: '',
        amount: 0,
        amount_before: 0,
        amount_after: 0,
        frequency: 'Weekly',
        allocationType: 'divide',
                unit: expName === 'Factoring' ? '%' : '$',
                   valid_from: new Date().toISOString().split('T')[0],
                   is_standalone: true
                };
        setLocalFixedExpenses(prev => [newExp, ...prev]);
     };

  const handleAddFinImportException = (expName: string, companyId: string, dateFrom: string, dateTo: string, defaultAmount: number = 0, isExtension: boolean = false) => {
     const newExp: any = {
         id: Math.random().toString(36).substring(2, 11),
         category: 'Fixed',
         name: expName,
         companyId: companyId, 
         amount: defaultAmount,
         amount_before: defaultAmount,
         amount_after: defaultAmount,
         frequency: 'Weekly',
         allocationType: 'divide',
         unit: expName === 'Factoring' ? '%' : '$',
         valid_from: dateFrom || '',
         valid_to: dateTo || '',
            is_extension: isExtension,
            is_standalone: !isExtension
        };
        setLocalFixedExpenses(prev => [newExp, ...prev]);
     };

  const handleAddFinImportContractException = (expName: string, dateFrom: string, dateTo: string, defaultAmount: number = 0, isExtension: boolean = false) => {
     const newExp: any = {
         id: Math.random().toString(36).substring(2, 11),
         category: 'Fixed',
         name: expName,
         companyId: '',
         contractType: '', 
         amount: defaultAmount,
         amount_before: defaultAmount,
         amount_after: defaultAmount,
         frequency: 'Weekly',
         allocationType: 'divide',
         unit: expName === 'Factoring' ? '%' : '$',
         valid_from: dateFrom || '',
         valid_to: dateTo || '',
            is_extension: isExtension,
            is_standalone: !isExtension
        };
        setLocalFixedExpenses(prev => [newExp, ...prev]);
     };

  const handleDeleteCompanyExpense = (id: string) => {
     setLocalFixedExpenses(prev => {
         const ruleToDel = prev.find(e => String(e.id) === String(id));
         if (!ruleToDel) return prev.filter(e => String(e.id) !== String(id));
         return prev.filter(e => {
             if (String(e.id) === String(id)) return false;
             if (e.name === ruleToDel.name && e.valid_from === ruleToDel.valid_from && ((e as any).is_dummy || Number(e.amount || 0) === 0)) {
                 if (ruleToDel.companyId && ruleToDel.companyId !== 'ALL' && e.companyId === ruleToDel.companyId) return false;
                 if ((!ruleToDel.companyId || ruleToDel.companyId === '') && (ruleToDel as any).contractType && (e as any).contractType === (ruleToDel as any).contractType) return false;
             }
             return true;
         });
     });
  };

  const handleResetFinImportCustom = (recordId: string, expenseKey: string, expenseName: string) => {
       setFinImportData(prev => prev.map(d => String(d.id) === String(recordId) ? {
            ...d,
            [`is_custom_${expenseKey}`]: false,
            [`custom_cpm_${expenseKey}`]: undefined,
            [expenseKey]: d[`original_${expenseKey}`] !== undefined ? d[`original_${expenseKey}`] : d[expenseKey]
        } : d));
      if (!modifiedFinImportIds.includes(String(recordId))) setModifiedFinImportIds(prev => [...prev, String(recordId)]);
      
      const dObj = finImportData.find(d => String(d.id) === String(recordId));
      if (dObj) {
          const dDate = new Date(dObj.week_ending);
          const vfObj = new Date(dDate); vfObj.setUTCDate(dDate.getUTCDate() - 5);
          const vfStr = vfObj.toISOString().split('T')[0];
          setLocalFixedExpenses(prev => prev.filter(e => !(e.name === expenseName && e.valid_from === vfStr && e.companyId === 'ALL')));
      }
  };

  const handleFinImportChange = (id: string | number, key: string, val: any) => {
                 setFinImportData(prev => prev.map(d => {
                     if (d.id === id) {
                         return { ...d, [key]: val };
                     }
                     return d;
                 }));
                 if (!modifiedFinImportIds.includes(String(id))) {
                     setModifiedFinImportIds(prev => [...prev, String(id)]);
                 }
             };

  const handleAddFinImportDate = async (expName: string) => {
          const fromDateStr = new Date().toISOString().split('T')[0];
          const toDateStr = '';

          const dObj = new Date(fromDateStr);
          dObj.setUTCDate(dObj.getUTCDate() + 5);
          const weekEndingStr = dObj.toISOString().split('T')[0];
          
          const expKey = finImportKeys.find(k => k.name === expName)?.key;

          setLocalFixedExpenses(prev => {
              const existingIndex = prev.findIndex(e => e.name === expName && e.companyId === 'ALL' && e.valid_from === fromDateStr);
              if (existingIndex !== -1) {
                  const next = [...prev];
                  next[existingIndex] = { ...next[existingIndex], valid_to: toDateStr };
                  return next;
              }
              const newExp: any = {
                  id: Math.random().toString(36).substring(2, 11),
                  category: 'Fixed',
                  name: expName,
                  companyId: 'ALL',
                  amount: 0,
                  frequency: 'Weekly',
                  allocationType: 'divide',
                  unit: expName === 'Factoring' ? '%' : '$',
                  valid_from: fromDateStr,
                  valid_to: toDateStr,
                  is_extension: false,
                  is_standalone: true
              };
              return [...prev, newExp];
          });

          const exists = finImportData.find(d => d.week_ending === weekEndingStr);
          if (exists) {
              if (expKey) {
                  setFinImportData(prev => prev.map(d => d.week_ending === weekEndingStr ? { ...d, [`is_custom_${expKey}`]: true, valid_to: toDateStr } : d));
                  if (!modifiedFinImportIds.includes(String(exists.id))) setModifiedFinImportIds(prev => [...prev, String(exists.id)]);
              }
          } else {
              const newRecord: any = {
                  id: `new_${Math.random().toString(36).substring(2, 11)}`,
                  week_ending: weekEndingStr,
                  valid_to: toDateStr,
                  num_of_trucks: 0,
                  avg_truck_price: 0,
                  num_of_trailers: 0,
                  avg_trailer_price: 0,
                  phone_and_internet: 0,
                  office_supplies: 0,
                  telematics: 0,
                  rent_and_parking: 0,
                  backup_mcs: 0,
                  back_office_pay: 0,
                  tech_pay: 0
              };
              
              if (expKey) {
                  newRecord[`is_custom_${expKey}`] = true;
              }

              setFinImportData(prev => [newRecord, ...prev].sort((a,b) => new Date(b.week_ending).getTime() - new Date(a.week_ending).getTime()));
              setModifiedFinImportIds(prev => [...prev, newRecord.id]);
          }
      };

  const handleSaveAndClose = async () => {
    setIsSaving(true);
    setLoadingMessage("Clearing old data...");
    
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      setLoadingMessage("Recalculating and syncing...");

      if (activeTab === 'fixed_revenue') {
        const { data: currentRevs } = await supabase.from('custom_fixed_revenue').select('id');
        const currentRevIds = currentRevs?.map(r => String(r.id)) || [];
        const newRevIds = localRevenues.map(r => String(r.id));
        const revsToDelete = currentRevIds.filter(id => !newRevIds.includes(id));
        
        if (revsToDelete.length > 0) {
            await supabase.from('custom_fixed_revenue').delete().in('id', revsToDelete);
        }
        
        const toUpdateRev: any[] = [];
        const toInsertRev: any[] = [];
        localRevenues.forEach(r => {
            const out: any = {
                name: r.name,
                amount: Number(r.amount) || 0,
                company_id: r.companyId || null,
                contract_type: r.contractType || null,
                franchise_id: r.franchiseId || null,
                valid_from: r.valid_from || null,
                valid_to: r.valid_to || null
            };
            if (r.id && currentRevIds.includes(String(r.id))) {
                out.id = r.id;
                toUpdateRev.push(out);
            } else {
                toInsertRev.push(out);
            }
        });
        
        if (toUpdateRev.length > 0) {
            await supabase.from('custom_fixed_revenue').upsert(toUpdateRev);
        }
        if (toInsertRev.length > 0) {
            await supabase.from('custom_fixed_revenue').insert(toInsertRev);
        }

        if (onDataSync) await onDataSync();
        setIsSaving(false);
        onClose();
        return;
      }

      let rawFinalExpenses: ExpenseItem[] = [...localFixedExpenses];

          finImportData.forEach(d => {
              finImportKeys.forEach(fi => {
                  const hasCustomAmount = (d as any)[`is_custom_${fi.key}`] === true;
                  const hasCustomPercentages = (fi.key === 'liability_insurance' && (d as any).shared_insurance !== undefined) || 
                                               (fi.key === 'avg_truck_price' && (d as any).franchise_charge !== undefined);

                  if (hasCustomAmount || hasCustomPercentages) {
                       const customVal = hasCustomAmount ? (Number((d as any)[`custom_val_${fi.key}`]) || 0) : ((fi.key === 'avg_truck_price' || fi.key === 'avg_trailer_price') ? 0 : Number((d as any)[fi.key] || 0));
                       const customCpm = (fi.key === 'avg_truck_price' && hasCustomAmount) ? (Number((d as any)[`custom_cpm_${fi.key}`]) || 0) : undefined;
                       const dDate = new Date(d.week_ending);
                       const vFromDate = new Date(dDate); vFromDate.setUTCDate(dDate.getUTCDate() - 5);
                       const vToDate = new Date(dDate); vToDate.setUTCDate(dDate.getUTCDate() + 1);
                       const vFromStr = vFromDate.toISOString().split('T')[0];
                       const vToStr = vToDate.toISOString().split('T')[0];
                       
                       if (fi.key === 'avg_truck_price' && (d as any).franchise_charge !== undefined) {
                           rawFinalExpenses = rawFinalExpenses.filter(e => !(e.name === fi.name && e.valid_from === vFromStr && (e as any).contractType && (e as any).franchise_charge !== undefined && (e as any).franchise_charge !== null && !e.amount && !e.cpm));
                       }

                       const existsIndex = rawFinalExpenses.findIndex(e => e.name === fi.name && e.valid_from === vFromStr && e.companyId === 'ALL');
                       if (existsIndex !== -1) {
                           if (hasCustomAmount) {
                               rawFinalExpenses[existsIndex].amount = customVal;
                               if (customCpm !== undefined) rawFinalExpenses[existsIndex].cpm = customCpm;
                           }
                           if ((d as any).truck_reduction !== undefined) (rawFinalExpenses[existsIndex] as any).truck_reduction = (d as any).truck_reduction;
                           if ((d as any).trailer_reduction !== undefined) (rawFinalExpenses[existsIndex] as any).trailer_reduction = (d as any).trailer_reduction;
                           if (fi.key === 'liability_insurance') {
                               if ((d as any).shared_insurance !== undefined) (rawFinalExpenses[existsIndex] as any).shared_insurance = (d as any).shared_insurance;
                               if ((d as any).company_base_for_mcloo !== undefined) (rawFinalExpenses[existsIndex] as any).company_base_for_mcloo = (d as any).company_base_for_mcloo;
                               if ((d as any).mcloo_base_mode !== undefined) (rawFinalExpenses[existsIndex] as any).mcloo_base_mode = (d as any).mcloo_base_mode;
                           }
                           if (fi.key === 'avg_truck_price') {
                               if ((d as any).franchise_charge !== undefined) (rawFinalExpenses[existsIndex] as any).franchise_charge = (d as any).franchise_charge;
                           }
                     } else {
                           const newExp: any = {
                               id: Math.random().toString(36).substring(2, 11),
                               category: 'Fixed',
                               name: fi.name,
                               companyId: 'ALL',
                               amount: customVal,
                               frequency: 'Weekly',
                               allocationType: 'divide',
                               unit: '$',
                               valid_from: vFromStr,
                               valid_to: String(d.id).startsWith('new_') ? ((d as any).valid_to || '') : vToStr
                           };
                           if (customCpm !== undefined) newExp.cpm = customCpm;
                           if ((d as any).truck_reduction !== undefined) newExp.truck_reduction = (d as any).truck_reduction;
                           if ((d as any).trailer_reduction !== undefined) newExp.trailer_reduction = (d as any).trailer_reduction;
                           if (fi.key === 'liability_insurance') {
                               if ((d as any).shared_insurance !== undefined) newExp.shared_insurance = (d as any).shared_insurance;
                           }
                           if (fi.key === 'avg_truck_price') {
                               if ((d as any).franchise_charge !== undefined) newExp.franchise_charge = (d as any).franchise_charge;
                           }
                           if (!hasCustomAmount && (fi.key === 'avg_truck_price' || fi.key === 'avg_trailer_price')) newExp.is_dummy = true;
                          rawFinalExpenses.push(newExp);
                      }
                  } else if ((d as any).truck_reduction !== undefined || (d as any).trailer_reduction !== undefined) {
                       const dDate = new Date(d.week_ending);
                       const vFromDate = new Date(dDate); vFromDate.setUTCDate(dDate.getUTCDate() - 5);
                       const vFromStr = vFromDate.toISOString().split('T')[0];
                       const existsIndex = rawFinalExpenses.findIndex(e => e.name === fi.name && e.valid_from === vFromStr && e.companyId === 'ALL');
                       if (existsIndex !== -1) {
                           if ((d as any).truck_reduction !== undefined && fi.key === 'avg_truck_price') (rawFinalExpenses[existsIndex] as any).truck_reduction = (d as any).truck_reduction;
                           if ((d as any).trailer_reduction !== undefined && fi.key === 'avg_trailer_price') (rawFinalExpenses[existsIndex] as any).trailer_reduction = (d as any).trailer_reduction;
                       } else {
                           if (fi.key === 'avg_truck_price' && (d as any).truck_reduction !== undefined) {
                               rawFinalExpenses.push({ id: Math.random().toString(36).substring(2, 11), category: 'Fixed', name: fi.name, companyId: 'ALL', amount: 0, frequency: 'Weekly', allocationType: 'divide', unit: '$', valid_from: vFromStr, valid_to: d.week_ending, truck_reduction: (d as any).truck_reduction, is_dummy: true } as any);
                           }
                           if (fi.key === 'avg_trailer_price' && (d as any).trailer_reduction !== undefined) {
                               rawFinalExpenses.push({ id: Math.random().toString(36).substring(2, 11), category: 'Fixed', name: fi.name, companyId: 'ALL', amount: 0, frequency: 'Weekly', allocationType: 'divide', unit: '$', valid_from: vFromStr, valid_to: d.week_ending, trailer_reduction: (d as any).trailer_reduction, is_dummy: true } as any);
                           }
                       }
                  }
              });
          });

      const finalExpenses = rawFinalExpenses.filter(exp => {
          if ((exp as any).contractType && (exp as any).franchise_charge !== undefined && (exp as any).franchise_charge !== null && !exp.amount && !exp.cpm) {
              const parent = rawFinalExpenses.find(p => p.name === exp.name && p.valid_from === exp.valid_from && p.companyId === exp.companyId && Array.isArray((p as any).franchise_charge));
              if (parent) return false;
          }
          return (exp as any).is_custom !== false;
      });

      const expandedFinalExpenses: any[] = [];
      finalExpenses.forEach(exp => {
          if (Array.isArray((exp as any).franchise_charge)) {
              const fcArray = (exp as any).franchise_charge;
              fcArray.forEach((fc: any) => {
                  if (fc.contract && String(fc.amount).trim() !== '') {
                      expandedFinalExpenses.push({
                          id: Math.random().toString(36).substring(2, 11),
                          category: 'Fixed',
                          name: exp.name,
                          companyId: exp.companyId || '',
                          contractType: fc.contract,
                          amount: 0,
                          cpm: null,
                          franchise_charge: Number(fc.amount),
                          dph: fc.dph !== undefined && fc.dph !== '' ? Number(fc.dph) : null,
                          frequency: 'Weekly',
                          allocationType: 'divide',
                          unit: '$',
                          valid_from: exp.valid_from,
                          valid_to: exp.valid_to
                      });
                  }
              });
              delete (exp as any).franchise_charge;
          }
          if (!(exp as any).is_dummy || (exp as any).truck_reduction !== undefined || (exp as any).trailer_reduction !== undefined) {
              expandedFinalExpenses.push(exp);
          }
      
      });
      
      let processedExpandedExpenses = expandedFinalExpenses.filter(e => (e as any).contractType !== 'TPOG WITH FRANCHISE' && (e as any).contractType !== 'OO WITH FRANCHISE');
      const tpogExps = processedExpandedExpenses.filter(e => (e as any).contractType === 'TPOG');
      tpogExps.forEach(e => {
          processedExpandedExpenses.push({ ...e, id: Math.random().toString(36).substring(2, 11), contractType: 'TPOG WITH FRANCHISE' } as any);
      });
      const ooExps = processedExpandedExpenses.filter(e => (e as any).contractType === 'OO');
      ooExps.forEach(e => {
          processedExpandedExpenses.push({ ...e, id: Math.random().toString(36).substring(2, 11), contractType: 'OO WITH FRANCHISE' } as any);
      });

      

      processedExpandedExpenses = processedExpandedExpenses.filter(exp => {
          if ((exp.name === 'Truck Price' || exp.name === 'Trailer Price') && exp.companyId !== 'ALL' && ((exp as any).truck_reduction || (exp as any).trailer_reduction) && Number(exp.amount || 0) > 0) {
              if ((exp as any).is_standalone) return true;
              const eFrom = exp.valid_from || '2000-01-01';
              const hasGlobalCustom = processedExpandedExpenses.some(g => {
                  if (g.name !== exp.name || g.companyId !== 'ALL' || Number(g.amount || 0) <= 0) return false;
                  const gFrom = g.valid_from || '2000-01-01';
                  const gTo = g.valid_to || '2099-12-31';
                  return eFrom >= gFrom && eFrom <= gTo;
              });
              return hasGlobalCustom;
          }
          return true;
      });

      const newCustomReductionRows: any[] = [];
      const idsToRemove = new Set<string>();
      processedExpandedExpenses.forEach(exp => {
          if ((exp.name === 'Truck Price' || exp.name === 'Trailer Price') && ((exp as any).truck_reduction || (exp as any).trailer_reduction) && Number(exp.amount || 0) === 0) {
              const eFrom = exp.valid_from ? new Date(exp.valid_from).getTime() : -Infinity;
              const eTo = exp.valid_to ? new Date(exp.valid_to).getTime() : Infinity;
              
              processedExpandedExpenses.forEach(g => {
                  if (g.name === exp.name && Number(g.amount || 0) > 0) {
                      const gFrom = g.valid_from ? new Date(g.valid_from).getTime() : 0;
                      if (gFrom >= eFrom && gFrom <= eTo) {
                          let targetCompany = '';
                          let targetContract = '';
                          let shouldCreate = false;

                          if (g.companyId === 'ALL' && exp.companyId !== 'ALL') {
                              targetCompany = exp.companyId || '';
                              targetContract = (exp as any).contractType || '';
                              shouldCreate = true;
                          } else if (g.companyId !== 'ALL' && (!(g as any).contractType || (g as any).contractType === '' || (g as any).contractType === 'ALL') && (exp as any).contractType && (exp as any).contractType !== 'ALL') {
                              if (!exp.companyId || exp.companyId === 'ALL' || exp.companyId === g.companyId) {
                                  targetCompany = g.companyId || '';
                                  targetContract = (exp as any).contractType;
                                  shouldCreate = true;
                                  idsToRemove.add(String(g.id));
                              }
                          }

                          if (shouldCreate) {
                              const alreadyExists = processedExpandedExpenses.some(x => x.name === exp.name && x.companyId === targetCompany && (x as any).contractType === targetContract && x.valid_from === g.valid_from && Number(x.amount || 0) > 0 && !idsToRemove.has(String(x.id)));
                              if (!alreadyExists) {
                                  newCustomReductionRows.push({
                                      ...exp,
                                      id: Math.random().toString(36).substring(2, 11),
                                      companyId: targetCompany,
                                      contractType: targetContract,
                                      amount: g.amount,
                                      cpm: g.cpm,
                                      valid_from: g.valid_from,
                                      valid_to: g.valid_to
                                  });
                              }
                          }
                      }
                  }
              });
          }
      });
      processedExpandedExpenses = processedExpandedExpenses.filter(e => !idsToRemove.has(String(e.id)));
      processedExpandedExpenses = [...processedExpandedExpenses, ...newCustomReductionRows];

      const deletedIds = fixedExpenses
        .filter(oe => !processedExpandedExpenses.some(fe => String(fe.id) === String(oe.id)))
        .map(oe => oe.id);

      if (deletedIds.length > 0) {
        await supabase.from('fixed_expenses').delete().in('id', deletedIds);
      }

      const expensesToSave = processedExpandedExpenses.map(exp => ({
               id: String(exp.id),
               name: exp.name,
               amount: Number(exp.amount) || 0,
               cpm: exp.cpm !== undefined ? Number(exp.cpm) : null,
               company_id: exp.companyId === 'ALL' ? 'ALL' : (exp.companyId || null),
               contract_type: (exp as any).contractType ? (exp as any).contractType : (exp.companyId === 'ALL' ? 'ALL' : null),
              unit: exp.unit || '$',
              valid_from: exp.valid_from && String(exp.valid_from).trim() !== '' ? exp.valid_from : null,
              valid_to: exp.valid_to && String(exp.valid_to).trim() !== '' ? exp.valid_to : null,
              disp_gross_perc: (exp as any).disp_gross_perc !== undefined && (exp as any).disp_gross_perc !== null && String((exp as any).disp_gross_perc).trim() !== '' ? Number((exp as any).disp_gross_perc) : null,
              disp_margin_perc: (exp as any).disp_margin_perc !== undefined && (exp as any).disp_margin_perc !== null && String((exp as any).disp_margin_perc).trim() !== '' ? Number((exp as any).disp_margin_perc) : null,
              dispatcher_name: (exp as any).dispatcher_name && String((exp as any).dispatcher_name).trim() !== '' ? String((exp as any).dispatcher_name).trim() : null,
              team_name: (exp as any).team_name && String((exp as any).team_name).trim() !== '' ? String((exp as any).team_name).trim() : null,
              shared_insurance: ((exp as any).shared_insurance !== undefined && (exp as any).shared_insurance !== null && String((exp as any).shared_insurance).trim() !== '') ? Number((exp as any).shared_insurance) : null,
              company_base_for_mcloo: ((exp as any).company_base_for_mcloo !== undefined && (exp as any).company_base_for_mcloo !== null && String((exp as any).company_base_for_mcloo).trim() !== '') ? Number((exp as any).company_base_for_mcloo) : null,
              franchise_charge: (exp as any).franchise_charge !== undefined && (exp as any).franchise_charge !== null ? Number((exp as any).franchise_charge) : null,
              revenue_cpm: (exp as any).revenue_cpm !== undefined && (exp as any).revenue_cpm !== null && String((exp as any).revenue_cpm).trim() !== '' ? Number((exp as any).revenue_cpm) : null,
              disp_mcloo_pay: (exp as any).disp_mcloo_pay ? (typeof (exp as any).disp_mcloo_pay === 'string' ? (exp as any).disp_mcloo_pay : JSON.stringify((exp as any).disp_mcloo_pay)) : null,
              truck_reduction: (exp as any).truck_reduction !== undefined && (exp as any).truck_reduction !== null ? Number((exp as any).truck_reduction) : null,
              trailer_reduction: (exp as any).trailer_reduction !== undefined && (exp as any).trailer_reduction !== null ? Number((exp as any).trailer_reduction) : null,
              truck_reduction_note: (exp as any).truck_reduction_note || null,
              trailer_reduction_note: (exp as any).trailer_reduction_note || null
          }));
      if (expensesToSave.length > 0) {
          const { error } = await supabase.from('fixed_expenses').upsert(expensesToSave, { onConflict: 'id' });
          if (error) {
              console.error("Error saving fixed expenses:", error);
          }
      }
      

      if (onSaveExpenses) {
        await onSaveExpenses(processedExpandedExpenses);
      }

      const { saveConfigContracts, savePnlConfigs } = await import('../lib/supabase');
      let cleanContracts = localConfigContracts.map(c => ({
          ...c,
          valid_from: c.valid_from && String(c.valid_from).trim() !== '' ? c.valid_from : null,
          valid_to: c.valid_to && String(c.valid_to).trim() !== '' ? c.valid_to : null
      })).filter(c => c.contract_type !== 'TPOG WITH FRANCHISE' && c.contract_type !== 'OO WITH FRANCHISE');
      
      const tpogContracts = cleanContracts.filter(c => c.contract_type === 'TPOG');
      tpogContracts.forEach(c => {
          cleanContracts.push({ ...c, id: Math.random().toString(36).substring(7), contract_type: 'TPOG WITH FRANCHISE' });
      });
      const ooContracts = cleanContracts.filter(c => c.contract_type === 'OO');
      ooContracts.forEach(c => {
          cleanContracts.push({ ...c, id: Math.random().toString(36).substring(7), contract_type: 'OO WITH FRANCHISE' });
      });
      await saveConfigContracts(cleanContracts);

      let finalPnlConfigs = pnlConfigs.filter(c => c.contract_type !== 'TPOG WITH FRANCHISE' && c.contract_type !== 'OO WITH FRANCHISE');
      const tpogPnl = finalPnlConfigs.filter(c => c.contract_type === 'TPOG');
      tpogPnl.forEach(c => {
          finalPnlConfigs.push({ ...c, id: Math.random().toString(36).substring(7), contract_type: 'TPOG WITH FRANCHISE' });
      });
      const ooPnl = finalPnlConfigs.filter(c => c.contract_type === 'OO');
      ooPnl.forEach(c => {
          finalPnlConfigs.push({ ...c, id: Math.random().toString(36).substring(7), contract_type: 'OO WITH FRANCHISE' });
      });
      await savePnlConfigs(finalPnlConfigs);

      if (modifiedFinImportIds.length > 0) {
          const cleanData = (dataArray: any[]) => dataArray.map(item => {
              const cleaned = { ...item };
              Object.keys(cleaned).forEach(key => {
                  if (key.startsWith('original_') && cleaned[key] !== undefined) {
                      const baseKey = key.replace('original_', '');
                      cleaned[baseKey] = cleaned[key];
                  }
              });
              Object.keys(cleaned).forEach(key => {
                  if (key.startsWith('is_custom_') || key.startsWith('original_') || key.startsWith('custom_val_')) {
                      delete cleaned[key];
                  }
              });
              return cleaned;
          });

          const toUpdate = cleanData(finImportData.filter(d => modifiedFinImportIds.includes(String(d.id)) && !String(d.id).startsWith('new_')));
          const toInsert = cleanData(finImportData.filter(d => modifiedFinImportIds.includes(String(d.id)) && String(d.id).startsWith('new_')).map(({id, ...rest}) => rest));
          
          for (const rec of toUpdate) {
              await supabase.from('finImport').update(rec).eq('id', rec.id);
          }
          if (toInsert.length > 0) {
              await supabase.from('finImport').insert(toInsert);
          }
      }

      setSimulationConfig(localSimConfig);
      setFixedExpenses(processedExpandedExpenses);
      if (setConfigContracts) {
          setConfigContracts(cleanContracts);
      }

      await new Promise(resolve => setTimeout(resolve, 1500));

      if (onDataSync) {
        setLoadingMessage("Fetching updated data...");
        await onDataSync();
      } else {
        await new Promise(resolve => setTimeout(resolve, 3500));
      }

      setLoadingMessage("Success!");
      await new Promise(resolve => setTimeout(resolve, 500));

      setIsSaving(false);
      onClose();
    } catch (error) {
      setIsSaving(false);
      onClose();
    }
  };
  
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950 rounded-t-lg flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/10 rounded text-emerald-500">
               <Sliders size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Structural Settings</h2>
              <p className="text-xs text-zinc-500">Adjust parameters, contracts and fixed expenses.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="relative">
                             <button onClick={() => {
                if (activeTab === 'fixed') {
                   setIsTopTutorialDropdownOpen(!isTopTutorialDropdownOpen);
                } else {
                   setIsTopTutorialDropdownOpen(false);
                   setTutorialState({ isOpen: true, type: null });
                }
             }} className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-500 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors">
                <PlayCircle size={16} />
                Tutorial <ChevronDown size={14} className={activeTab === 'fixed' ? 'opacity-100' : 'opacity-0'} />
             </button>
                 {activeTab === 'fixed' && isTopTutorialDropdownOpen && (
                   <div className="absolute top-full right-0 mt-1 w-56 bg-zinc-900 border border-zinc-700 rounded shadow-xl overflow-hidden flex flex-col z-[100]">
                      <button onClick={() => { setTutorialState({ isOpen: true, type: 'rules' }); setIsTopTutorialDropdownOpen(false); }} className="px-4 py-3 text-left text-[11px] font-bold text-zinc-300 hover:bg-zinc-800 transition-colors border-b border-zinc-800">Add expense rules</button>
                      <button onClick={() => { setTutorialState({ isOpen: true, type: 'reductions' }); setIsTopTutorialDropdownOpen(false); }} className="px-4 py-3 text-left text-[11px] font-bold text-zinc-300 hover:bg-zinc-800 transition-colors">Truck/Trailer Price Reductions</button>
                   </div>
                 )}
             </div>
             <button onClick={onClose} disabled={isSaving} className="text-zinc-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <X size={24} />
             </button>
          </div>
        </div>

        <div className="flex px-6 pt-2 border-b border-zinc-800 gap-2 bg-zinc-950 overflow-x-auto flex-shrink-0">
            <button onClick={() => setActiveTab('fixed')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'fixed' ? 'border-blue-500 text-blue-500' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>Expenses</button>
            <button onClick={() => setActiveTab('contracts')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'contracts' ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>Contract Rules</button>
            <button onClick={() => setActiveTab('dispatcher')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'dispatcher' ? 'border-purple-500 text-purple-500' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>Dispatcher Pay</button>
            <button onClick={() => setActiveTab('fixed_revenue')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'fixed_revenue' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>Fixed Revenue</button>
            <button onClick={() => setActiveTab('cpm')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'cpm' ? 'border-pink-500 text-pink-500' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>CPM REVENUE</button>
            <button onClick={() => setActiveTab('pnl')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'pnl' ? 'border-cyan-500 text-cyan-500' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>PNL CALCULATION</button>
            <button onClick={() => setActiveTab('fuel_rebate')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'fuel_rebate' ? 'border-rose-500 text-rose-500' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>FUEL REBATE</button>
        </div>

        <div className="h-[600px] overflow-y-auto p-6 bg-zinc-950/30">
           
           <div className={activeTab === 'contracts' ? 'block' : 'hidden'}>
              <div className="max-w-5xl mx-auto space-y-2 -mt-4">
                 <div className="flex items-center justify-between pb-2 border-b border-zinc-800/50 mb-2">
                    <div className="group relative cursor-help text-zinc-500 hover:text-emerald-500 transition-colors ml-auto">
                       <Info size={16} />
                       <div className="hidden group-hover:block absolute right-0 top-full mt-2 w-64 bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded shadow-xl normal-case font-normal z-50 pointer-events-none text-left border border-zinc-600">
                          Configure basic revenue distribution, margins and dispatcher share for different contract types.
                       </div>
                    </div>
                 </div>
                 <div className="w-full border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/50">
                    <table className="w-full text-left border-collapse">
                       <thead>
                          <tr className="bg-zinc-900 border-b border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                             <th className="p-2 font-bold">Contract Type</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-zinc-800">
                          {availableContractTypes.map(ct => {
                             const currentRules = localConfigContracts.filter(c => c.contract_type === ct);
                             const isExpanded = selectedContractType === ct;
                             return (
                                <React.Fragment key={ct as string}>
                                   <tr onClick={() => setSelectedContractType(isExpanded ? '' : (ct as string))} className="cursor-pointer hover:bg-zinc-800/30 transition-colors group">
                                      <td className="p-3 text-sm font-bold text-emerald-500 flex items-center gap-2">
                                            <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : '-rotate-90'}`} />
                                            {ct as string}
                                         </td>
                                   </tr>
                                   {isExpanded && (
                                      <tr>
                                         <td colSpan={1} className="p-0">
                                            <div className="p-4 bg-zinc-900/30 border-t border-zinc-800">
                                              {(() => {
                                                   return (
                                                      <table className="w-full text-left border-collapse table-fixed">
                                                         <thead>
                                                            <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                                                               <th className="py-2 pr-2 font-bold w-[70%]">Formula</th>
                                                               <th className="py-2 px-1 font-bold w-[12%]">Valid From</th>
                                                               <th className="py-2 px-1 font-bold w-[12%]">Valid To</th>
                                                               <th className="w-[6%]"></th>
                                                            </tr>
                                                         </thead>
                                                         <tbody className="divide-y divide-zinc-800/30">
                                                            {currentRules.map((conf, idx) => {
                                                               const calcType = conf.calculation_type || (String(ct).trim().toUpperCase() === 'CPM' ? 'CPM_STYLE' : 'MCLOO_STYLE');
                                                                                 
                                                                                 const renderInputField = (label: string, value: number, onChange: any, colorClass: string) => (
                                                                  <div className="relative inline-flex items-center h-6 mx-1 w-20 mt-3 flex-shrink-0">
                                                                     <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] text-zinc-500 font-bold uppercase tracking-tighter">{label}</span>
                                                                     <input type="number" step="0.1" value={value} onChange={onChange} className={`w-full bg-zinc-950 border border-zinc-700 rounded py-0.5 pl-2 pr-4 text-[10px] font-mono text-right outline-none transition-colors focus:border-emerald-500 h-full ${colorClass}`} />
                                                                     <span className="absolute right-1 text-zinc-500 text-[9px] pointer-events-none">%</span>
                                                                  </div>
                                                               );

                                                               const handleUpdate = (field: string, val: string) => {
                                                                  const newConf = [...localConfigContracts];
                                                                  const targetIndex = localConfigContracts.findIndex(x => x.id === conf.id);
                                                                  if (targetIndex !== -1) {
                                                                     (newConf[targetIndex] as any)[field] = (parseFloat(val) || 0) / 100;
                                                                     setLocalConfigContracts(newConf);
                                                                  }
                                                               };

                                                               const mcGrossLabel = calcType === 'TPOG_FRANCHISE' ? "Company Take" : "Comp Gross";
                                                               const mcGrossInput = renderInputField(mcGrossLabel, Number(((conf as any).mc_gross_percent * 100).toFixed(2)), (e: any) => handleUpdate('mc_gross_percent', e.target.value), "text-emerald-400");
                                                               const mcMarginInput = renderInputField("Comp Margin", Number(((conf as any).mc_margin_percent * 100).toFixed(2)), (e: any) => handleUpdate('mc_margin_percent', e.target.value), "text-amber-400");
                                                               const dispGrossInput = renderInputField("Disp Gross", Number((((conf as any).dispatcher_gross_percent || 0) * 100).toFixed(2)), (e: any) => handleUpdate('dispatcher_gross_percent', e.target.value), "text-purple-400");
                                                               const dispMarginInput = renderInputField("Disp Margin", Number((((conf as any).dispatcher_margin_percent || 0) * 100).toFixed(2)), (e: any) => handleUpdate('dispatcher_margin_percent', e.target.value), "text-purple-400");

                                                               const renderFormula = () => {
                                                                  if (ct === 'TPOG') {
                                                                     const mcGrossVal = Number(((conf as any).mc_gross_percent * 100).toFixed(2));
                                                                     const franchiseVal = Number((100 - mcGrossVal).toFixed(2));

                                                                     const splitBlock = (
                                                                        <div className="flex flex-col ml-8 pl-6 border-l border-zinc-700/50 justify-center">
                                                                           <div className="flex items-center justify-center gap-1.5 mb-1.5 -mt-4">
                                                                              <div className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Company/Franchise Split</div>
                                                                              <div className="relative group/split-tooltip inline-flex items-center justify-center">
                                                                                 <div className="text-zinc-500 hover:text-emerald-400 cursor-help border border-zinc-600 hover:border-emerald-400 rounded-full w-3 h-3 flex items-center justify-center text-[8px] font-bold transition-colors">?</div>
                                                                                 <div className="hidden group-hover/split-tooltip:block absolute z-[9999] bg-zinc-800 text-zinc-300 text-[10px] p-2.5 rounded shadow-xl border border-zinc-700 pointer-events-none transform -translate-x-1/2 left-1/2 bottom-full mb-1.5 w-[220px] whitespace-normal normal-case font-sans text-left tracking-normal leading-relaxed">
                                                                                    The Company percentage multiplies the total Revenue Collected, as well as all expenses such as PO, Tolls, Recruiting, Weekly Expenses...
                                                                                 </div>
                                                                              </div>
                                                                           </div>
                                                                           <div className="flex items-center gap-2 justify-center">
                                                                              <div className="relative inline-flex items-center h-6 w-20 mt-3 flex-shrink-0">
                                                                                 <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] text-zinc-500 font-bold uppercase tracking-tighter">Company</span>
                                                                                 <input type="number" step="0.1" value={mcGrossVal} onChange={(e: any) => handleUpdate('mc_gross_percent', e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded py-0.5 pl-2 pr-4 text-[10px] font-mono text-right outline-none transition-colors focus:border-emerald-500 h-full text-emerald-400" />
                                                                                 <span className="absolute right-1 text-zinc-500 text-[9px] pointer-events-none">%</span>
                                                                              </div>
                                                                              <span className="text-zinc-600 font-bold text-[10px] mt-3">:</span>
                                                                              <div className="relative inline-flex items-center h-6 w-20 mt-3 flex-shrink-0 opacity-80">
                                                                                 <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] text-zinc-500 font-bold uppercase tracking-tighter">Franchise</span>
                                                                                 <input type="number" value={franchiseVal} disabled className="w-full bg-zinc-900 border border-zinc-800 rounded py-0.5 pl-2 pr-4 text-[10px] font-mono text-right outline-none h-full text-amber-400 cursor-not-allowed" />
                                                                                 <span className="absolute right-1 text-zinc-500 text-[9px] pointer-events-none">%</span>
                                                                              </div>
                                                                           </div>
                                                                        </div>
                                                                     );

                                                                     return (
                                                                        <div className="flex flex-col gap-2 w-full">
                                                                           <select value={calcType} onChange={(e) => { const newConf = [...localConfigContracts]; const targetIndex = localConfigContracts.findIndex(x => x.id === conf.id); if(targetIndex !== -1) { newConf[targetIndex].calculation_type = e.target.value; setLocalConfigContracts(newConf); } }} className="w-max bg-zinc-950 border border-zinc-700 rounded py-1 px-2 text-[10px] text-zinc-300 focus:border-emerald-500 outline-none transition-colors h-7">
                                                                              <option value="TPOG_NONF">TPOG</option>
                                                                              <option value="NEW_FORMULA">New TPOG Formula</option>
                                                                           </select>
                                                                           <div className="flex items-center whitespace-nowrap text-[11px] text-zinc-300 font-mono bg-zinc-900/50 pl-3 pr-6 pt-4 pb-1.5 rounded border border-zinc-800 w-max relative z-10">
                                                                              {calcType === 'NEW_FORMULA' ? (
                                                                                  <>({mcGrossInput} * (Gross + Margin - (Margin * {mcMarginInput}))) - (Drv% * Gross) - (Gross * {dispGrossInput} + Margin * {dispMarginInput})</>
                                                                               ) : calcType === 'TPOG_FRANCHISE' ? (
                                                                                 <>
                                                                                    <div className="mt-0.5">(Gross * (1 - Drv%) + Margin * {mcMarginInput})</div>
                                                                                    {splitBlock}
                                                                                 </>
                                                                              ) : (
                                                                                 <>Gross * (1 - Drv%) + Margin * {mcMarginInput}</>
                                                                              )}
                                                                           </div>
                                                                        </div>
                                                                     );
                                                                  } else if (ct === 'CPM') {
                                                                     return (
                                                                        <div className="flex flex-col gap-2 w-full">
                                                                           <select value={calcType} onChange={(e) => { const newConf = [...localConfigContracts]; const targetIndex = localConfigContracts.findIndex(x => x.id === conf.id); if(targetIndex !== -1) { newConf[targetIndex].calculation_type = e.target.value; setLocalConfigContracts(newConf); } }} className="w-max bg-zinc-950 border border-zinc-700 rounded py-1 px-2 text-[10px] text-zinc-300 focus:border-emerald-500 outline-none transition-colors h-7">
                                                                              <option value="CPM_STYLE">Classic CPM</option>
                                                                              <option value="NEW_CPM_FORMULA">New CPM Formula</option>
                                                                           </select>
                                                                           <div className="flex items-center whitespace-nowrap text-[11px] text-zinc-300 font-mono bg-zinc-900/50 px-2 pt-4 pb-1.5 rounded border border-zinc-800 w-max relative z-10">
                                                                              {calcType === 'NEW_CPM_FORMULA' ? (
                                                                                 <>Gross - Gross Pay</>
                                                                              ) : (
                                                                                 <>(Gross + Margin * {mcMarginInput}) - Net Pay</>
                                                                              )}
                                                                           </div>
                                                                        </div>
                                                                     );
                                                                  }
                                                                  
                                                                  let content = null;
                                                                  if (calcType === 'MCLOO_STYLE') content = <>Gross * {mcGrossInput} + Margin * {mcMarginInput}</>;
                                                                  else if (calcType === 'OO_NONF') content = <>Gross * {mcGrossInput} + Margin * {mcMarginInput}</>;
                                                                  else if (calcType === 'OO_FRANCHISE') content = <>Gross * {mcGrossInput} + Margin * {mcMarginInput}</>;
                                                                  else if (calcType === 'CPM_STYLE') content = <>(Gross + Margin * {mcMarginInput}) - Net Pay</>;
                                                                  else if (calcType === 'POG_STYLE') content = <>Gross * (1 - Drv%) + Margin * {mcMarginInput}</>;
                                                                  else content = <>Gross * {mcGrossInput} + Margin * {mcMarginInput}</>;

                                                                  return (
                                                                     <div className="flex items-center whitespace-nowrap text-[11px] text-zinc-300 font-mono bg-zinc-900/50 px-2 pt-4 pb-1.5 rounded border border-zinc-800 w-max relative z-10">
                                                                        {content}
                                                                     </div>
                                                                  );
                                                               };

                                                               return (
                                                                  <tr key={conf.id || idx} className="hover:bg-zinc-800/30 transition-colors group/row">
                                                                     <td className="py-2 pr-2">
                                                                        {renderFormula()}
                                                                     </td>
                                                                     <td className="py-2 px-1 align-top pt-3">
                                                                        <input type="date" value={conf.valid_from} onChange={(e) => { const newConf = [...localConfigContracts]; const targetIndex = localConfigContracts.findIndex(x => x.id === conf.id); if(targetIndex !== -1) { newConf[targetIndex].valid_from = e.target.value; setLocalConfigContracts(newConf); } }} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-200 focus:border-emerald-500 outline-none transition-colors h-7" />
                                                                     </td>
                                                                     <td className="py-2 px-1 align-top pt-3">
                                                                        <input type="date" value={conf.valid_to || ''} onChange={(e) => { const newConf = [...localConfigContracts]; const targetIndex = localConfigContracts.findIndex(x => x.id === conf.id); if(targetIndex !== -1) { newConf[targetIndex].valid_to = e.target.value; setLocalConfigContracts(newConf); } }} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-200 focus:border-emerald-500 outline-none transition-colors h-7" />
                                                                     </td>
                                                                     <td className="py-2 pl-2 text-right align-top pt-3">
                                                                        <button onClick={() => setLocalConfigContracts(localConfigContracts.filter(x => x.id !== conf.id))} className="text-zinc-600 hover:text-rose-500 transition-colors p-1 rounded opacity-0 group-hover/row:opacity-100 flex justify-center items-center w-8 h-7"><Trash2 size={14} /></button>
                                                                     </td>
                                                                  </tr>
                                                               );
                                                            })}
                                                         </tbody>
                                                      </table>
                                                   );
                                                })()}
                                               <button onClick={() => {
                                                   const lastRule = currentRules[currentRules.length - 1];
                                                               const defaultCalcType = lastRule ? lastRule.calculation_type : (ct === 'TPOG' ? 'TPOG_NONF' : (ct === 'CPM' ? 'CPM_STYLE' : 'MCLOO_STYLE'));
                                                               setLocalConfigContracts([...localConfigContracts, {
                                                      id: Math.random().toString(36).substring(7), 
                                                      contract_type: ct as string, 
                                                      calculation_type: defaultCalcType, 
                                                      mc_gross_percent: lastRule ? lastRule.mc_gross_percent : 0, 
                                                      mc_margin_percent: lastRule ? lastRule.mc_margin_percent : 0, 
                                                      dispatcher_gross_percent: lastRule ? (lastRule as any).dispatcher_gross_percent : 0, 
                                                      dispatcher_margin_percent: lastRule ? (lastRule as any).dispatcher_margin_percent : 0, 
                                                      valid_from: new Date().toISOString().split('T')[0] 
                                                   } as any]);
                                                }} className="w-max px-4 py-1.5 border border-dashed border-emerald-500/30 bg-emerald-500/5 rounded hover:bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all mt-3"><Plus size={12} /> ADD RULE</button>
                                            </div>
                                         </td>
                                      </tr>
                                   )}
                                </React.Fragment>
                             );
                          })}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>

           <div className={activeTab === 'dispatcher' ? 'block' : 'hidden'}>
              <DispatcherPay 
                localFixedExpenses={localFixedExpenses}
                handleCompanyExpenseChange={handleCompanyExpenseChange}
                handleDeleteCompanyExpense={handleDeleteCompanyExpense}
                availableContractTypes={availableContractTypes}
                               allCompanies={allCompanies}
                allDispatchers={allDispatchers}
                allTeams={uniqueTeams}
                setLocalFixedExpenses={setLocalFixedExpenses}
              />
           </div>

           <div className={activeTab === 'fixed_revenue' ? 'block' : 'hidden'}>
              <FixedRevenue 
                availableContractTypes={availableContractTypes}
                companies={allCompanies}
                drivers={drivers}
                localRevenues={localRevenues}
                setLocalRevenues={setLocalRevenues}
                allDates={Array.from(new Set(finImportData.map(d => d.week_ending)))}
              />
           </div>

           <div className={activeTab === 'cpm' ? 'block' : 'hidden'}>
              <RevenueCpm 
                localFixedExpenses={localFixedExpenses}
                handleCompanyExpenseChange={handleCompanyExpenseChange}
                handleDeleteCompanyExpense={handleDeleteCompanyExpense}
                availableContractTypes={availableContractTypes}
                companies={allCompanies}
                setLocalFixedExpenses={setLocalFixedExpenses}
              />
           </div>

                      <div className={activeTab === 'pnl' ? 'block' : 'hidden'}>
              <div className="max-w-5xl mx-auto space-y-2 -mt-4">
                 <div className="flex items-center justify-between pb-2 border-b border-zinc-800/50 mb-2">
                    <div className="group relative cursor-help text-zinc-500 hover:text-cyan-500 transition-colors ml-auto">
                       <Info size={16} />
                       <div className="hidden group-hover:block absolute right-0 top-full mt-2 w-[420px] bg-zinc-800 text-zinc-200 text-[10px] p-3 rounded shadow-xl normal-case font-normal z-50 pointer-events-none text-left border border-zinc-600 leading-relaxed">
                          <div className="font-bold text-cyan-400 uppercase tracking-wider mb-1.5">PNL Calculation</div>
                          <div className="space-y-1.5">
                             <p>This section controls how PNL is calculated for each contract type.</p>
                             <p>For every contract, you define which income and expense components are included in the final PNL formula.</p>
                             <p>The selected setup is used later when the system calculates profitability, margins and net result by contract.</p>
                             <p>Use this section when a contract needs a different PNL logic than the default calculation.</p>
                          </div>
                       </div>
                    </div>
                 </div>
                 <PnlEditor 
                    pnlConfigs={pnlConfigs} 
                    setPnlConfigs={setPnlConfigs} 
                    availableContractTypes={availableContractTypes} 
                 />
              </div>
           </div>

           <div className={activeTab === 'fuel_rebate' ? 'block' : 'hidden'}>
              <FuelRebate
                 localFixedExpenses={localFixedExpenses}
                 handleCompanyExpenseChange={handleCompanyExpenseChange}
                 handleDeleteCompanyExpense={handleDeleteCompanyExpense}
                 availableContractTypes={availableContractTypes}
                 companies={allCompanies}
                 setLocalFixedExpenses={setLocalFixedExpenses}
              />
           </div>

           <div className={activeTab === 'fixed' ? 'block' : 'hidden'}>
           <div className="max-w-6xl mx-auto -mt-4">
              <div className="w-full border border-zinc-800 rounded-lg bg-zinc-950/50 mt-4">
                    <table className="w-full text-left border-collapse">
                       <thead className="sticky top-[-24px] z-[50]">
                                          <tr className="bg-zinc-900 border-b border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                              <th className="p-2 font-bold flex items-center justify-between rounded-t-lg bg-zinc-900 shadow-md">
                                                 <span>Expense Name</span>
                                                 <div className="flex items-center gap-2 font-normal normal-case">
                                                    {isFilterVisible && (
                                                       <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded px-2 py-1">
                                                          <select value={expenseFilter.company} onChange={(e) => setExpenseFilter({...expenseFilter, company: e.target.value})} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-300 outline-none">
                                                             <option value="">All Companies</option>
                                                             {allCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                                                          </select>
                                                          <select value={expenseFilter.contract} onChange={(e) => setExpenseFilter({...expenseFilter, contract: e.target.value})} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-300 outline-none">
                                                             <option value="">All Contracts</option>
                                                             {availableContractTypes.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
                                                          </select>
                                                          <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-700 rounded px-2 py-1">
                                                             <span className="text-[9px] text-zinc-500 font-bold uppercase">Pay Date:</span>
                                                             <input type="date" value={expenseFilter.date} onChange={(e) => {
                                                                let val = e.target.value;
                                                                if (val) {
                                                                   const d = new Date(val);
                                                                   const day = d.getUTCDay();
                                                                   const diff = 4 - day;
                                                                   d.setUTCDate(d.getUTCDate() + (diff > 3 ? diff - 7 : (diff < -3 ? diff + 7 : diff)));
                                                                   val = d.toISOString().split('T')[0];
                                                                }
                                                                setExpenseFilter({...expenseFilter, date: val});
                                                             }} style={{ colorScheme: 'dark' }} className="bg-transparent text-[10px] text-zinc-300 outline-none" />
                                                          </div>
                                                          <select value={expenseFilter.sort} onChange={(e) => setExpenseFilter({...expenseFilter, sort: e.target.value})} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-300 outline-none">
                                                             <option value="A-Z">Sort: A-Z</option>
                                                             <option value="Z-A">Sort: Z-A</option>
                                                          </select>
                                                          <button onClick={() => setExpenseFilter({ company: '', contract: '', date: '', sort: 'A-Z' })} className="text-zinc-500 hover:text-rose-500 ml-1" title="Clear Filters"><X size={14}/></button>
                                                       </div>
                                                    )}
                                                    <button onClick={() => setIsFilterVisible(!isFilterVisible)} className={`flex items-center gap-1.5 px-3 py-1.5 border rounded text-[10px] font-bold uppercase transition-colors ${isFilterVisible || expenseFilter.company || expenseFilter.contract || expenseFilter.date || expenseFilter.sort !== 'A-Z' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:bg-zinc-800'}`}>
                                                       <Filter size={14} />
                                                       Filter
                                                    </button>
                                                    <button onClick={() => setHideOverriddenRules(!hideOverriddenRules)} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded text-[10px] font-bold uppercase transition-colors" title={hideOverriddenRules ? "View default overrides" : "Hide default overrides"}>
                                                       {hideOverriddenRules ? <EyeOff size={14} /> : <Eye size={14} />}
                                                       {hideOverriddenRules ? 'Show Overrides' : 'Hide Overrides'}
                                                    </button>
                                                 </div>
                                              </th>
                                           </tr>
                                       </thead>
                       <tbody className="divide-y divide-zinc-800">
                          {unifiedExpenses.map(exp => {
                             if (expenseFilter.company || expenseFilter.contract || expenseFilter.date) {
                                 let filterFrom = '';
                                 let filterTo = '';
                                 if (expenseFilter.date) {
                                     const pDate = new Date(expenseFilter.date);
                                     const tDate = new Date(pDate); tDate.setUTCDate(pDate.getUTCDate() - 3);
                                     filterTo = tDate.toISOString().split('T')[0];
                                     const fDate = new Date(pDate); fDate.setUTCDate(pDate.getUTCDate() - 9);
                                     filterFrom = fDate.toISOString().split('T')[0];
                                 }

                                 const hasMatch = localFixedExpenses.some(e => {
                                     if (e.name !== exp.name) return false;
                                     let match = true;
                                     if (expenseFilter.company && e.companyId !== expenseFilter.company) match = false;
                                     if (expenseFilter.contract && (e as any).contractType !== expenseFilter.contract) match = false;
                                     if (expenseFilter.date) {
                                         const f = e.original_valid_from || e.valid_from || '2000-01-01';
                                         const t = e.valid_to || '2099-12-31';
                                         if (filterFrom > t || filterTo < f) match = false;
                                     }
                                     return match;
                                 });
                                 let finImportMatch = false;
                                 if (exp.type === 'FINIMPORT' && expenseFilter.date && !expenseFilter.company && !expenseFilter.contract) {
                                     finImportMatch = finImportData.some(d => {
                                         const dDate = new Date(d.week_ending);
                                         const vfObj = new Date(dDate); vfObj.setUTCDate(dDate.getUTCDate() - 5);
                                         const vfStr = vfObj.toISOString().split('T')[0];
                                         const vtStr = (d as any).valid_to || d.week_ending;
                                         return filterFrom <= vtStr && filterTo >= vfStr;
                                     });
                                 }
                                 if (!hasMatch && !finImportMatch) return null;
                             }

                             const isExpanded = selectedExpenseName === exp.name;
                             
                             if (exp.type === 'FIXED') {
                                 let rules = localFixedExpenses.filter(e => e.name === exp.name);
                                 if (expenseFilter.company) rules = rules.filter(e => e.companyId === expenseFilter.company || e.companyId === 'ALL');
                                 if (expenseFilter.contract) rules = rules.filter(e => (e as any).contractType === expenseFilter.contract || e.companyId === 'ALL');
                                 if (expenseFilter.date) {
                                     const pDate = new Date(expenseFilter.date);
                                     const tDate = new Date(pDate); tDate.setUTCDate(pDate.getUTCDate() - 3);
                                     const filterTo = tDate.toISOString().split('T')[0];
                                     const fDate = new Date(pDate); fDate.setUTCDate(pDate.getUTCDate() - 9);
                                     const filterFrom = fDate.toISOString().split('T')[0];
                                     rules = rules.filter(e => {
                                         const f = e.valid_from || '2000-01-01';
                                         const t = e.valid_to || '2099-12-31';
                                         return filterFrom <= t && filterTo >= f;
                                     });
                                 }
                                 if (rules.length === 0) return null;

                                 const sortedRules = [...rules].sort((a,b) => new Date(b.valid_from || '1970-01-01').getTime() - new Date(a.valid_from || '1970-01-01').getTime());
                                 const latestRule = sortedRules[0];
                                 
                                 const currTime = Date.now();
                                 let matchedExp = rules.find(e => {
                                     const fromTime = e.valid_from ? new Date(e.valid_from).getTime() : -Infinity;
                                     const toTime = e.valid_to ? new Date(e.valid_to).getTime() : Infinity;
                                     return e.companyId === 'ALL' && currTime >= fromTime && currTime <= toTime;
                                 });

                                 if (!matchedExp) {
                                     matchedExp = rules.find(e => e.companyId === 'ALL');
                                 }

                                 let activeAmount = 0;
                                 if (matchedExp) {
                                    if (matchedExp.threshold_date) {
                                       const threshTime = new Date(matchedExp.threshold_date).getTime();
                                       if (currTime < threshTime) {
                                           activeAmount = matchedExp.amount_before !== undefined ? matchedExp.amount_before : (matchedExp.amount || 0);
                                       } else {
                                           activeAmount = matchedExp.amount_after !== undefined ? matchedExp.amount_after : (matchedExp.amount || 0);
                                       }
                                    } else {
                                        activeAmount = matchedExp.amount || 0;
                                    }
                                 }

                                 const latestVal = matchedExp ? activeAmount : 0;
                                 const latestUnit = matchedExp ? (matchedExp.unit || '$') : '$';
                                 
                                 const defaultCols = ['CPM', 'Plates', 'Factoring'].includes(exp.name) ? ['valid_from', 'valid_to', 'amount'] : ['valid_from', 'valid_to', 'amount', 'unit'];
                                 const activeColumns = (expenseColumns[exp.name] || defaultCols).filter(c => !(['CPM', 'Plates', 'Factoring'].includes(exp.name) && c === 'unit'));

                                 return (
                                    <React.Fragment key={exp.name}>
                                       <tr onClick={() => setSelectedExpenseName(isExpanded ? '' : exp.name)} className="cursor-pointer hover:bg-zinc-800/30 transition-colors group">
                                          <td className={`p-3 text-sm font-bold flex items-center gap-2 ${['CPM', 'Plates', 'Factoring'].includes(exp.name) ? 'text-blue-400' : 'text-emerald-500'}`}>
                                             <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : '-rotate-90'}`} />
                                             <span>{exp.name}</span>
                                          </td>
                                          </tr>
                                        {isExpanded && (
                                           <tr>
                                              <td colSpan={1} className="p-0">
                                                <div className="p-4 bg-zinc-900/30 border-t border-zinc-800">
                                                   <table className="w-full text-left border-collapse">
                                                      <thead>
                                                         <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                                                            <th className="py-2 pr-2 font-bold">Scope</th>
                                                            {activeColumns.includes('valid_from') && <th className="py-2 px-2 font-bold">Valid From</th>}
                                                            {activeColumns.includes('valid_to') && <th className="py-2 px-2 font-bold">Valid To</th>}
                                                            {activeColumns.includes('amount_before') && <th className="py-2 px-2 font-bold">Amount Before</th>}
                                                            {activeColumns.includes('amount_after') && <th className="py-2 px-2 font-bold">Amount After</th>}
                                                            {activeColumns.includes('amount') && <th className="py-2 px-2 font-bold">Amount</th>}
                                                            {activeColumns.includes('unit') && <th className="py-2 px-2 font-bold">Unit</th>}
                                                            <th className="w-8"></th>
                                                         </tr>
                                                      </thead>
                                                      <tbody className="divide-y divide-zinc-800/30">
                                                         {[...rules].sort((a, b) => {
                                                             const nameA = a.companyId === 'ALL' ? ' ' : String(a.companyId || (a as any).contractType || 'zz').trim().toLowerCase();
                                                             const nameB = b.companyId === 'ALL' ? ' ' : String(b.companyId || (b as any).contractType || 'zz').trim().toLowerCase();
                                                             if (expenseFilter.sort === 'A-Z') {
                                                                 return nameA.localeCompare(nameB) || new Date(b.valid_from || '1970-01-01').getTime() - new Date(a.valid_from || '1970-01-01').getTime();
                                                             }
                                                             if (expenseFilter.sort === 'Z-A') {
                                                                 return nameB.localeCompare(nameA) || new Date(b.valid_from || '1970-01-01').getTime() - new Date(a.valid_from || '1970-01-01').getTime();
                                                             }
                                                             return 0;
                                                         }).map(expObj => {
                                                            const isPast = expObj.companyId === 'ALL' && expObj.valid_to && new Date(expObj.valid_to).getTime() < Date.now();
                                                            return (
                                                            <tr key={expObj.id} className={`transition-colors group/row ${isPast ? 'opacity-40 bg-zinc-900/50' : 'hover:bg-zinc-800/30'}`}>
                                                              <td className="py-1.5 pr-2">
                                                                   {expObj.companyId === 'ALL' ? (
                                                                  <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider h-7 flex items-center">Global (ALL)</div>
                                                               ) : ((expObj as any).contractType !== undefined && (expObj as any).contractType !== null) ? (
                                                              <select
                                                                  value={(expObj as any).contractType}
                                                                     onChange={(e) => handleCompanyExpenseChange(expObj.id, 'contractType' as any, e.target.value)}
                                                                     className="w-full bg-zinc-950 border border-purple-700/50 rounded px-2 py-1 text-xs text-purple-500 font-bold focus:border-purple-500 outline-none transition-colors h-7"
                                                                  >
                                                                     <option value="" disabled>Select Contract</option>
                                                                     {availableContractTypes.map(c => <option key={c as string} value={c as string}>{c}</option>)}
                                                                     {exp.name === 'CPM' && <option value="TPOG (Franchise PnL)">TPOG (Franchise PnL)</option>}
                                                                  </select>
                                                               ) : (
                                                                  <select
                                                                     value={expObj.companyId}
                                                                     onChange={(e) => {
                                                                        if (e.target.value === 'NEW_COMPANY') {
                                                                           setCompanyPromptValue('');
                                                                           setCompanyPrompt({
                                                                               isOpen: true,
                                                                               callback: (newComp) => {
                                                                                   if (newComp && newComp.trim() !== '') {
                                                                                       setCustomCompanies(prev => [...prev, newComp.trim()]);
                                                                                       handleCompanyExpenseChange(expObj.id, 'companyId', newComp.trim());
                                                                                   }
                                                                               }
                                                                           });
                                                                        } else {
                                                                           handleCompanyExpenseChange(expObj.id, 'companyId', e.target.value);
                                                                        }
                                                                     }}
                                                                     className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-amber-500 font-bold focus:border-amber-500 outline-none transition-colors h-7"
                                                                  >
                                                                     <option value="" disabled>Select Company</option>
                                                                     <option value="NEW_COMPANY" className="text-emerald-500 font-bold">+ Add new company</option>
                                                                     {allCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                                                                  </select>
                                                               )}
                                                                </td>
                                                               {activeColumns.includes('valid_from') && (
                                                                  <td className="py-1.5 px-2">
                                                                     <input type="date" value={expObj.valid_from || ''} onChange={(e) => handleCompanyExpenseChange(expObj.id, 'valid_from', e.target.value)} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 outline-none transition-colors h-7" />
                                                                  </td>
                                                               )}
                                                               {activeColumns.includes('valid_to') && (
                                                                  <td className="py-1.5 px-2">
                                                                     <input type="date" value={expObj.valid_to || ''} onChange={(e) => handleCompanyExpenseChange(expObj.id, 'valid_to', e.target.value)} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 outline-none transition-colors h-7" />
                                                                  </td>
                                                               )}
                                                               {activeColumns.includes('amount_before') && (
                                                                  <td className="py-1.5 px-2">
                                                                     <div className="relative flex items-center h-7">
                                                                        <span className="absolute left-2 text-zinc-500 text-xs pointer-events-none">{expObj.unit === '%' ? '%' : '$'}</span>
                                                                        <input type="number" value={(expObj.amount_before !== undefined && expObj.amount_before !== null && expObj.amount_before !== '') ? expObj.amount_before : ''} onChange={(e) => handleCompanyExpenseChange(expObj.id, 'amount_before', e.target.value)} className={`w-full bg-zinc-950 border border-zinc-700 rounded py-1 text-xs text-zinc-200 font-mono focus:border-emerald-500 outline-none transition-colors h-full pl-5 pr-2`} />
                                                                     </div>
                                                                  </td>
                                                               )}
                                                               {activeColumns.includes('amount_after') && (
                                                                  <td className="py-1.5 px-2">
                                                                     <div className="relative flex items-center h-7">
                                                                        <span className="absolute left-2 text-zinc-500 text-xs pointer-events-none">{expObj.unit === '%' ? '%' : '$'}</span>
                                                                        <input type="number" value={(expObj.amount_after !== undefined && expObj.amount_after !== null && expObj.amount_after !== '') ? expObj.amount_after : ''} onChange={(e) => handleCompanyExpenseChange(expObj.id, 'amount_after', e.target.value)} className={`w-full bg-zinc-950 border border-zinc-700 rounded py-1 text-xs text-zinc-200 font-mono focus:border-emerald-500 outline-none transition-colors h-full pl-5 pr-2`} />
                                                                     </div>
                                                                  </td>
                                                               )}
                                                               
                                                               {activeColumns.includes('amount') && (
                                                                  <td className="py-1.5 px-2">
                                                                     <div className="relative flex items-center h-7 w-32">
                                                                        <span className="absolute left-2 text-zinc-500 text-xs pointer-events-none">{expObj.unit === '%' ? '%' : '$'}</span>
                                                                        <input type="number" value={(expObj.amount !== undefined && expObj.amount !== null && expObj.amount !== '') ? expObj.amount : ''} onChange={(e) => handleCompanyExpenseChange(expObj.id, 'amount', e.target.value)} className={`w-full bg-zinc-950 border border-zinc-700 rounded py-1 text-xs text-zinc-200 font-mono focus:border-emerald-500 outline-none transition-colors h-full pl-5 pr-2`} />
                                                                     </div>
                                                                  </td>
                                                               )}
                                                               
                                                               {activeColumns.includes('unit') && (
                                                                  <td className="py-1.5 px-2">
                                                                     {exp.name === 'Factoring' || expObj.unit === '%' ? (
                                                                        <div className="w-full text-xs text-zinc-500 font-bold px-2 py-1 bg-zinc-900/50 border border-zinc-800 rounded h-7 flex items-center justify-center font-mono">%</div>
                                                                     ) : (
                                                                        <button type="button" onClick={() => handleCompanyExpenseChange(expObj.id, 'unit', expObj.unit === '%' ? '$' : '%')} className="w-full text-xs text-zinc-400 hover:text-emerald-400 font-bold px-2 py-1 bg-zinc-900 border border-zinc-700 rounded transition-colors h-7 font-mono">
                                                                           {expObj.unit || '$'}
                                                                        </button>
                                                                     )}
                                                                  </td>
                                                               )}
                                                               <td className="py-1.5 pl-2 text-right">
                                                                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteCompanyExpense(String(expObj.id)); }} className="text-zinc-600 hover:text-rose-500 transition-colors p-1 rounded opacity-0 group-hover/row:opacity-100 flex justify-center items-center w-8 h-7">
                                                                     <Trash2 size={14} />
                                                                  </button>
                                                               </td>
                                                            </tr>
                                                         );})}
                                                      </tbody>
                                                   </table>
                                                   <div className="flex items-center gap-4 mt-3">
                                                      <button onClick={() => handleAddCompanyExpense(exp.name, 'ALL')} className="w-max px-4 py-1.5 border border-dashed border-emerald-500/50 bg-emerald-500/5 rounded hover:bg-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"><Plus size={12} /> ADD GLOBAL RULE</button>
                                                      <div className="relative group/dropdown">
                                                         <button className="w-max px-4 py-1.5 border border-dashed border-amber-500/50 bg-amber-500/5 rounded hover:bg-amber-500/20 text-amber-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all">
                                                            <Plus size={12} /> Add Rule For <ChevronDown size={10} />
                                                         </button>
                                                         <div className="absolute hidden group-hover/dropdown:flex flex-col top-full left-0 pt-1 w-full z-50">
                                                            <div className="bg-zinc-900 border border-zinc-700 rounded shadow-xl overflow-hidden flex flex-col w-full">
                                                               <button onClick={() => handleAddContractExpense(exp.name)} className="px-4 py-2 text-left text-[10px] font-bold text-purple-500 hover:bg-zinc-800 transition-colors">Contract</button>
                                                               <button onClick={() => handleAddCompanyExpense(exp.name, '')} className="px-4 py-2 text-left text-[10px] font-bold text-amber-500 hover:bg-zinc-800 transition-colors">Company</button>
                                                            </div>
                                                         </div>
                                                      </div>
                                                   </div>
                                                </div>
                                             </td>
                                          </tr>
                                       )}
                                    </React.Fragment>
                                 );
                             } else {
                                 let exceptionRules = localFixedExpenses.filter(e => e.name === exp.name && !(e.contractType && e.franchise_charge !== undefined && e.franchise_charge !== null && !e.amount && !e.cpm));
                                 let globalRules = [...finImportData];
                                 let globalOverrides = localFixedExpenses.filter(e => e.name === exp.name && e.companyId === 'ALL' && !(e.contractType && e.franchise_charge !== undefined && e.franchise_charge !== null && !e.amount && !e.cpm));

                                 if (expenseFilter.company) exceptionRules = exceptionRules.filter(e => e.companyId === expenseFilter.company || e.companyId === 'ALL');
                                 if (expenseFilter.contract) exceptionRules = exceptionRules.filter(e => (e as any).contractType === expenseFilter.contract || e.companyId === 'ALL');
                                 if (expenseFilter.date) {
                                     const pDate = new Date(expenseFilter.date);
                                     const tDate = new Date(pDate); tDate.setUTCDate(pDate.getUTCDate() - 3);
                                     const filterTo = tDate.toISOString().split('T')[0];
                                     const fDate = new Date(pDate); fDate.setUTCDate(pDate.getUTCDate() - 9);
                                     const filterFrom = fDate.toISOString().split('T')[0];

                                     exceptionRules = exceptionRules.filter(e => {
                                         const f = e.original_valid_from || e.valid_from || '2000-01-01';
                                         const t = e.valid_to || '2099-12-31';
                                         return filterFrom <= t && filterTo >= f;
                                     });
                                     globalOverrides = globalOverrides.filter(e => {
                                         const f = e.valid_from || '2000-01-01';
                                         const t = e.valid_to || '2099-12-31';
                                         return filterFrom <= t && filterTo >= f;
                                     });
                                     globalRules = globalRules.filter(d => {
                                         const dDate = new Date(d.week_ending);
                                         const vfObj = new Date(dDate); vfObj.setUTCDate(dDate.getUTCDate() - 5);
                                         const vfStr = vfObj.toISOString().split('T')[0];
                                         const vtStr = (d as any).valid_to || d.week_ending;
                                         return filterFrom <= vtStr && filterTo >= vfStr;
                                     });
                                 }

                                 const uniqueDates = Array.from(new Set([
                                     ...globalRules.map(d => d.week_ending),
                                     ...exceptionRules.filter(e => {
                                         const hasRed = ((e as any).truck_reduction || (e as any).trailer_reduction);
                                         const vfStrExp = e.original_valid_from || e.valid_from;
                                         const matchesGlobal = globalOverrides.some(go => go.valid_from === vfStrExp && Number(go.amount) === Number(e.amount)) || finImportData.some(fd => {
                                             const d = new Date(fd.week_ending);
                                             const vf = new Date(d); vf.setUTCDate(d.getUTCDate() - 5);
                                             return vf.toISOString().split('T')[0] === vfStrExp && (fd as any)[`is_custom_${exp.key}`] && Number((fd as any)[`custom_val_${exp.key}`]) === Number(e.amount);
                                         });
                                         const isRedOnly = hasRed && ((e as any).is_dummy || Number(e.amount || 0) === 0 || matchesGlobal);
                                         return e.companyId === 'ALL' && !isRedOnly && !globalRules.some(gr => {
                                             const d = new Date(gr.week_ending);
                                             const vf = new Date(d); vf.setUTCDate(d.getUTCDate() - 5);
                                             return vfStrExp === vf.toISOString().split('T')[0];
                                         });
                                     }).map(e => {
                                         const targetDate = e.original_valid_from || e.valid_from;
                                         if (!targetDate) return null;
                                         const d = new Date(targetDate);
                                         d.setUTCDate(d.getUTCDate() + 5);
                                         return d.toISOString().split('T')[0];
                                     }).filter(Boolean)
                                 ])).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).filter(dateStr => {
                                     if (expenseFilter.date) {
                                         const pDate = new Date(expenseFilter.date);
                                         const tDate = new Date(pDate); tDate.setUTCDate(pDate.getUTCDate() - 3);
                                         const filterTo = tDate.toISOString().split('T')[0];
                                         const fDate = new Date(pDate); fDate.setUTCDate(pDate.getUTCDate() - 9);
                                         const filterFrom = fDate.toISOString().split('T')[0];
                                         const dDate = new Date(dateStr);
                                         const vfObj = new Date(dDate); vfObj.setUTCDate(dDate.getUTCDate() - 5);
                                         const vfStr = vfObj.toISOString().split('T')[0];
                                         if (filterFrom > dateStr || filterTo < vfStr) return false;
                                     }
                                     const puData = finImportPerUnitData.find(d => d.week_ending === dateStr);
                                     const gRule = globalRules.find(d => d.week_ending === dateStr);
                                     const puVal = puData && (exp as any).puKey ? Math.abs(puData[(exp as any).puKey] || 0) : 0;
                                     const gVal = gRule && exp.key ? Math.abs((gRule as any)[exp.key] || 0) : 0;
                                     if (puVal > 0 || gVal > 0) return true;
                                     const dBase = new Date(dateStr);
                                     const vfObj = new Date(dBase); vfObj.setUTCDate(dBase.getUTCDate() - 5);
                                     const vfStr = vfObj.toISOString().split('T')[0];
                                     const hasException = exceptionRules.some(e => (e.original_valid_from || e.valid_from) === vfStr);
                                     if (hasException) return true;
                                     const hasOverride = localFixedExpenses.some(e => e.name === exp.name && (e.original_valid_from || e.valid_from) === vfStr && e.companyId === 'ALL');
                                     if (hasOverride) return true;
                                     if (gRule && (gRule as any)[`is_custom_${exp.key}`]) return true;
                                     if (gRule && String(gRule.id).startsWith('new_') && (gRule as any)[`is_custom_${exp.key}`]) return true;
                                     return false;
                                 });

                                 const latestGlobalRecord = globalRules.sort((a,b) => new Date(b.week_ending).getTime() - new Date(a.week_ending).getTime()).find(d => d.num_of_trucks > 0) || globalRules[0];
                                 const latestPuRecord = finImportPerUnitData.find(d => d.week_ending === latestGlobalRecord?.week_ending) || finImportPerUnitData[0];
                                 
                                 const currTime = Date.now();
                                 let matchedExp = globalOverrides.find(e => {
                                     const fromTime = e.valid_from ? new Date(e.valid_from).getTime() : -Infinity;
                                     const toTime = e.valid_to ? new Date(e.valid_to).getTime() : Infinity;
                                     return currTime >= fromTime && currTime <= toTime;
                                 });

                                 

                                 let activeAmount = 0;
                                 if (matchedExp) {
                                    if (matchedExp.threshold_date) {
                                       const threshTime = new Date(matchedExp.threshold_date).getTime();
                                       if (currTime < threshTime) {
                                           activeAmount = matchedExp.amount_before !== undefined ? matchedExp.amount_before : (matchedExp.amount || 0);
                                       } else {
                                           activeAmount = matchedExp.amount_after !== undefined ? matchedExp.amount_after : (matchedExp.amount || 0);
                                       }
                                    } else {
                                         const isComplex = ['Liability Insurance (Auto)', 'Liability Insurance (General)', 'Liability Insurance (Global)', 'Cargo Insurance', 'Lease Gap Coverage', 'Trailer Interchange', 'LAGO', 'PD Premium', 'Physical Damage'].includes(matchedExp.name);
                                         if (isComplex && matchedExp.amount_before !== undefined) {
                                            activeAmount = matchedExp.amount_before;
                                        } else {
                                            activeAmount = matchedExp.amount || 0;
                                        }
                                    }
                                 }
                                 
                                 const currentGlobalVal = matchedExp ? activeAmount : (latestPuRecord && exp.puKey ? Math.abs(latestPuRecord[exp.puKey] || 0) : (latestGlobalRecord ? latestGlobalRecord[exp.key] : 0));
                                 
                                 return (
                                    <React.Fragment key={exp.name}>
                                       <tr onClick={() => setSelectedExpenseName(isExpanded ? '' : exp.name)} className="cursor-pointer hover:bg-zinc-800/30 transition-colors group">
                                          <td className="p-3 text-sm font-bold text-blue-400 flex items-center gap-2">
                                             <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : '-rotate-90'}`} />
                                             {exp.name}
                                          </td>
                                          </tr>
                                        {isExpanded && (
                                           <tr>
                                              <td colSpan={1} className="p-0">
                                                <div className="p-4 bg-zinc-900/30 border-t border-zinc-800">
                                                   <div className="flex items-center justify-between mb-3">
                                                      <div className="flex items-center gap-2">
                                                         <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Rules History</h4>
                                                         {exp.key === 'avg_truck_price' && (
                                                            <div className="relative group/main-tooltip flex items-center justify-center">
                                                               <Info size={14} className="text-zinc-500 hover:text-emerald-500 transition-colors cursor-help" />
                                                               <div className="hidden group-hover/main-tooltip:block absolute left-full ml-2 top-1/2 -translate-y-1/2 w-56 bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded shadow-xl normal-case font-normal z-[50] text-left border border-zinc-700 pointer-events-none">
                                                                  All displayed values are without calculated underutilization.
                                                               </div>
                                                            </div>
                                                         )}
                                                      </div>
                                                      <div className="flex items-center gap-2">
                                                          <button onClick={() => handleAddFinImportDate(exp.name)} className="px-3 py-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30 rounded text-[10px] font-bold uppercase transition-colors whitespace-nowrap flex items-center gap-1">
                                                              <Plus size={12}/> ADD GLOBAL RULE
                                                          </button>
                                                          <div className="relative group/dropdown">
                                                             <button className="px-3 py-1 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30 rounded text-[10px] font-bold uppercase transition-colors whitespace-nowrap flex items-center gap-1">
                                                                 <Plus size={12}/> Add Rule For <ChevronDown size={10} />
                                                             </button>
                                                             <div className="absolute hidden group-hover/dropdown:flex flex-col top-full right-0 pt-1 w-max min-w-full z-50">
                                                                <div className="bg-zinc-900 border border-zinc-700 rounded shadow-xl overflow-hidden flex flex-col w-full">
                                                                   <button onClick={() => handleAddFinImportContractException(exp.name, new Date().toISOString().split('T')[0], '', 0)} className="px-4 py-2 text-left text-[10px] font-bold text-purple-500 hover:bg-zinc-800 transition-colors">Contract</button>
                                                                   <button onClick={() => handleAddFinImportException(exp.name, '', new Date().toISOString().split('T')[0], '', 0)} className="px-4 py-2 text-left text-[10px] font-bold text-amber-500 hover:bg-zinc-800 transition-colors">Company</button>
                                                                </div>
                                                             </div>
                                                          </div>
                                                          {(exp.key === 'avg_truck_price' || exp.key === 'avg_trailer_price') && (
                                                              <button onClick={() => setReductionModal({ isOpen: true, expenseKey: exp.key, expenseName: exp.name })} className="px-3 py-1 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/30 rounded text-[10px] font-bold uppercase transition-colors whitespace-nowrap flex items-center gap-1 ml-2">
                                                                  <Settings size={12}/> MANAGE REDUCTIONS
                                                              </button>
                                                          )}
                                                      </div>
                                                   </div>
                                                   <div className="border border-zinc-800 rounded max-h-[300px] overflow-y-auto">
                                                       <table className="w-full text-left border-collapse">
                                                          <thead className="sticky top-0 bg-zinc-900 z-[20]">
                                                             <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                                                                <th className="py-2 px-3 font-bold w-[12%]">Valid From</th>
                                                                <th className="py-2 px-3 font-bold w-[12%]">Valid To</th>
                                                                <th className="py-2 px-3 font-bold w-[24%]">Type / Company</th>
                                                                {(exp.key === 'avg_truck_price' || exp.key === 'avg_trailer_price') && (
                                                                   <th className="py-2 px-3 font-bold w-[10%]">Reduction</th>
                                                                )}
                                                                <th className="py-2 px-3 font-bold">Amount</th>
                                                                <th className="py-2 px-3 font-bold text-right">Actions</th>
                                                             </tr>
                                                          </thead>
                                                         <tbody className="divide-y divide-zinc-800/30">
                                                     {exceptionRules.filter(e => {
                                                         if (e.companyId === 'ALL') return false;
                                                         const hasRed = ((e as any).truck_reduction || (e as any).trailer_reduction);
                                                         const vfStrExp = e.original_valid_from || e.valid_from;
                                                         const matchesGlobal = globalOverrides.some(go => go.valid_from === vfStrExp && Number(go.amount) === Number(e.amount)) || finImportData.some(fd => {
                                                             const d = new Date(fd.week_ending);
                                                             const vf = new Date(d); vf.setUTCDate(d.getUTCDate() - 5);
                                                             return vf.toISOString().split('T')[0] === vfStrExp && (fd as any)[`is_custom_${exp.key}`] && Number((fd as any)[`custom_val_${exp.key}`]) === Number(e.amount);
                                                         });
                                                         const isRedOnly = hasRed && ((e as any).is_dummy || Number(e.amount || 0) === 0 || matchesGlobal);
                                                         if (isRedOnly) return false;
                                                         return true;
                                                     }).sort((a, b) => {
                                                         const nameA = a.companyId === 'ALL' ? ' ' : String(a.companyId || (a as any).contractType || 'zz').trim().toLowerCase();
                                                         const nameB = b.companyId === 'ALL' ? ' ' : String(b.companyId || (b as any).contractType || 'zz').trim().toLowerCase();
                                                         if (expenseFilter.sort === 'A-Z') {
                                                             return nameA.localeCompare(nameB) || new Date(b.valid_from || '1970-01-01').getTime() - new Date(a.valid_from || '1970-01-01').getTime();
                                                         }
                                                         if (expenseFilter.sort === 'Z-A') {
                                                             return nameB.localeCompare(nameA) || new Date(b.valid_from || '1970-01-01').getTime() - new Date(a.valid_from || '1970-01-01').getTime();
                                                         }
                                                         return 0;
                                                     }).map(cRule => (
                                                          <React.Fragment key={`standalone_${cRule.id}`}>
                                                              <tr className="bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
                                                                  <td className="py-1.5 px-3">
                                                                     <input type="date" value={cRule.valid_from || ''} onChange={(e) => {
                                                                         let val = e.target.value;
                                                                         if (exp.name === 'Truck Price' || exp.name === 'Trailer Price') val = enforceDayOfWeek(val, 2);
                                                                         handleCompanyExpenseChange(cRule.id, 'valid_from', val);
                                                                     }} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 outline-none transition-colors h-7" />
                                                                  </td>
                                                                  <td className="py-1.5 px-3">
                                                                     <input type="date" value={cRule.valid_to || ''} onChange={(e) => {
                                                                         let val = e.target.value;
                                                                         if (exp.name === 'Truck Price' || exp.name === 'Trailer Price') val = enforceDayOfWeek(val, 1);
                                                                         handleCompanyExpenseChange(cRule.id, 'valid_to', val);
                                                                     }} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 outline-none transition-colors h-7" />
                                                                  </td>
                                                                  <td className="py-1.5 px-3 flex items-center gap-2">
                                                                            {(cRule.contractType !== undefined && cRule.contractType !== null) && (!cRule.companyId || cRule.companyId === '') ? (
                                                                               <select value={cRule.contractType} onChange={(e) => handleCompanyExpenseChange(cRule.id, 'contractType' as any, e.target.value)} className="w-full bg-zinc-950 border border-purple-700/50 rounded px-2 py-1 text-xs text-purple-500 font-bold focus:border-purple-500 outline-none h-7">
                                                                           <option value="" disabled>Select Contract</option>
                                                                           {availableContractTypes.map(c => <option key={c as string} value={c as string}>{c}</option>)}
                                                                        </select>
                                                                     ) : (
                                                                        <select value={cRule.companyId} onChange={(e) => {
                                                                           if (e.target.value === 'NEW_COMPANY') {
                                                                              setCompanyPromptValue('');
                                                                              setCompanyPrompt({
                                                                                  isOpen: true,
                                                                                  callback: (newComp) => {
                                                                                      if (newComp && newComp.trim() !== '') {
                                                                                          setCustomCompanies(prev => [...prev, newComp.trim()]);
                                                                                          handleCompanyExpenseChange(cRule.id, 'companyId', newComp.trim());
                                                                                      }
                                                                                  }
                                                                              });
                                                                           } else {
                                                                           handleCompanyExpenseChange(cRule.id, 'companyId', e.target.value);
                                                                           }
                                                                        }} className="w-full bg-zinc-950 border border-amber-700/50 rounded px-2 py-1 text-xs text-amber-500 font-bold focus:border-amber-500 outline-none h-7">
                                                                           <option value="" disabled>Select Company</option>
                                                                           <option value="NEW_COMPANY" className="text-emerald-500 font-bold">+ Add new company</option>
                                                                           {allCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                                                                        </select>
                                                                     )}
                                                                  </td>
                                                                  {(exp.key === 'avg_truck_price' || exp.key === 'avg_trailer_price') && (
                                                                      <td className="py-1.5 px-3">
                                                                          <div className="text-xs text-zinc-400 font-mono font-bold flex items-center gap-1.5">
                                                                              {(() => {
                                                                                  const reductionKey = exp.key === 'avg_truck_price' ? 'truck_reduction' : 'trailer_reduction';
                                                                                  const reductionAmount = Number((cRule as any)[reductionKey]) || 0;
                                                                                  const note = (cRule as any)[`${reductionKey}_note`];
                                                                                  if (reductionAmount <= 0) return '-';
                                                                                  return (
                                                                                      <>
                                                                                          <span>-${Math.round(reductionAmount)}</span>
                                                                                         {note && (
                                                                                                                             <div className="relative group/note flex items-center">
                                                                                                                                 <FileText size={12} className="text-emerald-500/70 hover:text-emerald-500 cursor-help" />
                                                                                                                                 <div className="hidden group-hover/note:block absolute left-full ml-2 z-[100] w-max max-w-[200px] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl border border-zinc-700 whitespace-normal font-sans [&_ul]:list-disc [&_ul]:pl-5 [&_ul_ul]:list-[circle] [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: note }} />
                                                                                                                             </div>
                                                                                                                         )}
                                                                                      </>
                                                                                  );
                                                                              })()}
                                                                          </div>
                                                                      </td>
                                                                  )}
                                                                 <td className="py-1.5 px-3">
                                                                       <div className="flex flex-col gap-2">
                                                                          <div className="flex items-start gap-4">
                                                                             <div className="flex items-center gap-2 mt-1">
                                                                                <div className="flex flex-col gap-1 w-32">
                                                                                  <div className="relative flex items-center h-7">
                                                                                                <span className="absolute left-2 text-amber-500/50 text-xs pointer-events-none">$</span>
                                                                                                <input type="number" value={(cRule.amount !== undefined && cRule.amount !== null && cRule.amount !== '') ? cRule.amount : ((cRule.amount_after !== undefined && cRule.amount_after !== null && cRule.amount_after !== '') ? cRule.amount_after : '')} onChange={(e) => { handleCompanyExpenseChange(cRule.id, 'amount', e.target.value); handleCompanyExpenseChange(cRule.id, 'amount_after', e.target.value); }} className="w-full bg-zinc-950 border border-amber-700/50 rounded py-1 pl-5 pr-8 text-xs text-zinc-200 font-mono focus:border-amber-500 outline-none h-full" />
                                                                                                {!['liability_insurance', 'liability_insurance_general', 'cargo_insurance', 'lease_gap_coverage', 'trailer_interchange', 'lago', 'physical_damage_premium', 'physical_damage'].includes(exp.key) ? (
                                                                                         <span className="absolute right-2 text-amber-500/50 text-[9px] pointer-events-none">/ pu</span>
                                                                                      ) : (
                                                                                         <div className="absolute right-2 group/tooltip flex items-center justify-center">
                                                                                            <Info size={12} className="text-amber-500/70 hover:text-amber-500 transition-colors cursor-help" />
                                                                                            <div className="hidden group-hover/tooltip:block absolute right-0 bottom-full mb-1 w-48 bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl normal-case font-normal z-[100] text-center border border-zinc-700 pointer-events-none">
                                                                                               Enter the total amount for the entire period, not per driver.
                                                                                            </div>
                                                                                         </div>
                                                                                      )}
                                                                                   </div>
                                                                                </div>
                                                                                
                                                                             </div>
                                                                            {exp.key === 'liability_insurance' && (
                                                                               <div className="flex flex-col items-start gap-1 mt-1">
                                                                                  <button onClick={() => toggleMclooRule(String(cRule.id))} className="px-2 py-0.5 bg-amber-950 hover:bg-amber-900 text-amber-500/70 text-[10px] rounded border border-amber-900/50 transition-colors h-max whitespace-nowrap">
                                                                                     {expandedMclooRules.includes(String(cRule.id)) ? 'Hide MCLOO Rule' : 'Edit MCLOO Rule'}
                                                                                  </button>
                                                                               </div>
                                                                            )}
                                                                         </div>
                                                                     </div>
                                                                  </td>
                                                                  <td className="py-1.5 px-3 text-right">
                                                                     <button onClick={(e) => { e.stopPropagation(); handleDeleteCompanyExpense(String(cRule.id)); }} className="text-zinc-500 hover:text-rose-500 p-1 rounded transition-colors inline-flex justify-center items-center">
                                                                        <Trash2 size={14}/>
                                                                     </button>
                                                                  </td>
                                                              </tr>
                                                              {exp.key === 'liability_insurance' && expandedMclooRules.includes(String(cRule.id)) && (
                                                                                                     <tr className="bg-amber-500/5">
                                                                                                         <td colSpan={5} className="px-3 pb-3 pt-0 border-t-0">
                                                                                                             <div className="flex flex-col gap-3 bg-zinc-950/50 p-3 rounded-lg border border-amber-500/20 w-full relative ml-4">
                                                                                                                <div className="absolute -top-2.5 -left-3 text-amber-500/30">
                                                                                                                    <CornerDownRight size={16} />
                                                                                                                </div>
                                                                                                                <div className="flex items-center gap-4 pl-4">
                                                                                                                   <div className="flex flex-col gap-1 w-full">
                                                                                                                      <div className="flex items-center gap-1">
                                                                                                                         <label className="text-[8px] text-amber-500/70 font-bold uppercase tracking-wider">Shared Insurance (Per Unit)</label>
                                                                                                                         <div className="relative group/mcloo-tooltip flex items-center justify-center">
                                                                                                                            <Info size={12} className="text-amber-500/70 hover:text-amber-500 cursor-help transition-colors" />
                                                                                                                            <div className="hidden group-hover/mcloo-tooltip:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-[100] w-[200px] bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded shadow-xl border border-zinc-700 whitespace-normal font-sans normal-case tracking-normal text-center">
                                                                                                                               Enter the shared liability insurance amount here. This specific value is used directly in the calculation of Revenue Collected.
                                                                                                                            </div>
                                                                                                                         </div>
                                                                                                                      </div>
                                                                                                                      <div className="flex items-center gap-3">
                                                                                                                         <div className="relative h-7 w-32">
                                                                                                                            <span className="absolute left-2 top-1.5 text-amber-500/50 text-[10px] pointer-events-none">$</span>
                                                                                                                            <input type="number" value={(cRule as any).shared_insurance ?? ''} onChange={(e) => handleCompanyExpenseChange(cRule.id, 'shared_insurance' as any, e.target.value)} className="w-full bg-zinc-900 border border-amber-700/50 rounded py-0 pl-6 pr-2 text-xs text-zinc-200 focus:border-amber-500 outline-none h-full" />
                                                                                                                         </div>
                                                                                                                      </div>
                                                                                                                   </div>
                                                                                                                </div>
                                                                                                             </div>
                                                                                                         </td>
                                                                                                     </tr>
                                                                                                 )}
                                                                                                {(exp.key === 'avg_truck_price' || exp.key === 'avg_trailer_price') && (() => {
                                                                                                    const reductionKey = exp.key === 'avg_truck_price' ? 'truck_reduction' : 'trailer_reduction';
                                                                                                    const cRuleFrom = cRule.original_valid_from || cRule.valid_from || '2000-01-01';
                                                                                                    const oppositeReductions = localFixedExpenses.filter(r => {
                                                                                                        if (r.name !== exp.name || !(r as any)[reductionKey]) return false;
                                                                                                        const rFrom = r.original_valid_from || r.valid_from || '2000-01-01';
                                                                                                        const rTo = r.valid_to || '2099-12-31';
                                                                                                        if (cRuleFrom < rFrom || cRuleFrom > rTo) return false;
                                                                                                        if (cRule.companyId && cRule.companyId !== 'ALL' && (!cRule.contractType || cRule.contractType === '')) {
                                                                                                            return r.contractType && r.contractType !== '' && r.contractType !== 'ALL' && (!r.companyId || r.companyId === 'ALL' || r.companyId === '' || r.companyId === cRule.companyId);
                                                                                                        }
                                                                                                        if (cRule.contractType && cRule.contractType !== '' && (!cRule.companyId || cRule.companyId === 'ALL' || cRule.companyId === '')) {
                                                                                                            return r.contractType === cRule.contractType && r.companyId && r.companyId !== 'ALL';
                                                                                                        }
                                                                                                        return false;
                                                                                                    });

                                                                                                    const uniqueAttached: any[] = [];
          const seenAttachedSigs = new Set();
          oppositeReductions.forEach(r => {
              const rA = Number((r as any)[reductionKey]) || 0;
              const sigContract = r.contractType === cRule.contractType ? '' : (r.contractType || '');
              const sigCompany = r.companyId === cRule.companyId ? '' : (r.companyId || '');
              const sig = `${sigContract}_${sigCompany}_${rA}`;
              if (!seenAttachedSigs.has(sig)) {
                  seenAttachedSigs.add(sig);
                  uniqueAttached.push(r);
              }
          });

                                                                                                    return uniqueAttached.map(rRule => {
                                                                                                        const rAmount = Number((rRule as any)[reductionKey]) || 0;
                                                                                                        const rawVal = (cRule.amount !== undefined && cRule.amount !== null && cRule.amount !== '') ? cRule.amount : ((cRule.amount_after !== undefined && cRule.amount_after !== null && cRule.amount_after !== '') ? cRule.amount_after : '');
                                                                                                        const finalVal = rawVal === '' ? '' : Math.max(0, Number(rawVal) - rAmount);
                                                                                                        return (
                                                                                                            <tr key={`${rRule.id}_${cRule.id}_attached_reduction`} className="bg-rose-500/5 hover:bg-rose-500/10 transition-colors">
                                                                                                                <td className="py-1.5 px-3"></td>
                                                                                                                <td className="py-1.5 px-3 relative">
                                                                                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500/50">
                                                                                                                        <CornerDownRight size={16} />
                                                                                                                    </div>
                                                                                                                </td>
                                                                                                                <td className="py-1.5 px-3">
                                                                                                                    <div className="flex items-center border-l-2 border-rose-500/30 pl-2">
                                                                                                                        <span className="text-xs text-zinc-300 font-bold">{rRule.contractType ? `Contract: ${rRule.contractType}` : `Company: ${rRule.companyId || 'Unknown'}`}</span>
                                                                                                                    </div>
                                                                                                                </td>
                                                                                                                <td className="py-1.5 px-3">
                                                                                                                    <div className="text-xs text-zinc-400 font-mono font-bold flex items-center gap-1.5">
                                                                                                                        <span>-${Math.round(rAmount)}</span>
                                                                                                                        {(rRule as any)[`${reductionKey}_note`] && (
                                                                                                                            <div className="relative group/note flex items-center">
                                                                                                                                <FileText size={12} className="text-emerald-500/70 hover:text-emerald-500 cursor-help" />
                                                                                                                                <div className="hidden group-hover/note:block absolute left-full ml-2 z-[100] w-max max-w-[200px] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl border border-zinc-700 whitespace-normal font-sans [&_ul]:list-disc [&_ul]:pl-5 [&_ul_ul]:list-[circle] [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: (rRule as any)[`${reductionKey}_note`] }} />
                                                                                                                            </div>
                                                                                                                        )}
                                                                                                                    </div>
                                                                                                                </td>
                                                                                                                <td className="py-1.5 px-3">
                                                                                                                    <div className="flex items-center h-7">
                                                                                                                        <span className="pl-2 text-zinc-500 text-xs pointer-events-none flex-shrink-0">$</span>
                                                                                                                        <span className="text-xs text-zinc-200 font-mono font-bold pl-1">{finalVal !== '' ? Math.round(Number(finalVal)) : ''}</span>
                                                                                                                    </div>
                                                                                                                </td>
                                                                                                                <td className="py-1.5 px-3 text-right"></td>
                                                                                                            </tr>
                                                                                                        );
                                                                                                    });
                                                                                                })()}
                                                                                          </React.Fragment>
                                                                                      ))}
                                                                                     {uniqueDates.flatMap(dateStr => {
                                                        let gRule = globalRules.find(d => d.week_ending === dateStr);
                                                        const dBase = new Date(dateStr);
                                                        const vFromStr = new Date(dBase.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                                                        const vToStr = new Date(dBase.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                                                        
                                                        const reductionKey = exp.key === 'avg_truck_price' ? 'truck_reduction' : 'trailer_reduction';
                                                        const allCRules = exceptionRules.filter(e => {
                                                            const hasRed = ((e as any).truck_reduction || (e as any).trailer_reduction);
                                                            const vfStrExp = e.original_valid_from || e.valid_from;
                                                            const matchesGlobal = globalOverrides.some(go => go.valid_from === vfStrExp && Number(go.amount) === Number(e.amount)) || finImportData.some(fd => {
                                                                const d = new Date(fd.week_ending);
                                                                const vf = new Date(d); vf.setUTCDate(d.getUTCDate() - 5);
                                                                return vf.toISOString().split('T')[0] === vfStrExp && (fd as any)[`is_custom_${exp.key}`] && Number((fd as any)[`custom_val_${exp.key}`]) === Number(e.amount);
                                                            });
                                                            const isRedOnly = hasRed && ((e as any).is_dummy || Number(e.amount || 0) === 0 || matchesGlobal);
                                                        if (isRedOnly) {
                                                            return e.companyId !== 'ALL' && (e.original_valid_from || e.valid_from) === vFromStr;
                                                        }
                                                        return false;
                                                        });
                                                        
                                                        const reductionsForDate = allCRules.filter(c => {
                                                            const hasRed = (c as any)[reductionKey];
                                                            const vfStrExp = c.original_valid_from || c.valid_from;
                                                            const matchesGlobal = globalOverrides.some(go => go.valid_from === vfStrExp && Number(go.amount) === Number(c.amount)) || finImportData.some(fd => {
                                                                const d = new Date(fd.week_ending);
                                                                const vf = new Date(d); vf.setUTCDate(d.getUTCDate() - 5);
                                                                return vf.toISOString().split('T')[0] === vfStrExp && (fd as any)[`is_custom_${exp.key}`] && Number((fd as any)[`custom_val_${exp.key}`]) === Number(c.amount);
                                                            });
                                                            return hasRed && ((c as any).is_dummy || Number(c.amount || 0) === 0 || matchesGlobal);
                                                        });
                                                        const cRules = allCRules.filter(c => !reductionsForDate.includes(c));

                                                        if (!gRule && (globalOverrides.some(go => go.valid_from === vFromStr) || reductionsForDate.length > 0)) {
                                                            gRule = { id: `dummy_${dateStr}`, week_ending: dateStr } as any;
                                                        }

                                                        if (!gRule && cRules.length === 0 && reductionsForDate.length === 0) return null;

                                                        const isOverridden = globalOverrides.some(go => {
                                                             if ((go as any).is_dummy || (Number(go.amount || 0) === 0 && ((go as any).truck_reduction || (go as any).trailer_reduction))) return false;
                                                             if (!go.valid_from) return false;
                                                             const d = new Date(dateStr);
                                                             const vf = new Date(d); vf.setUTCDate(d.getUTCDate() - 5);
                                                             const currVfStr = vf.toISOString().split('T')[0];
                                                             if (go.valid_from === currVfStr) return false;
                                                             const afterFrom = currVfStr > go.valid_from;
                                                             const beforeTo = !go.valid_to || currVfStr <= go.valid_to;
                                                             return afterFrom && beforeTo;
                                                         }) || finImportData.some(fd => {
                                                             const isCustom = (fd as any)[`is_custom_${exp.key}`];
                                                             if (!isCustom) return false;
                                                             const fdDate = new Date(fd.week_ending);
                                                             const fdVf = new Date(fdDate); fdVf.setUTCDate(fdDate.getUTCDate() - 5);
                                                             const fdVfStr = fdVf.toISOString().split('T')[0];
                                                             const d = new Date(dateStr);
                                                             const currVf = new Date(d); currVf.setUTCDate(d.getUTCDate() - 5);
                                                             const currVfStr = currVf.toISOString().split('T')[0];
                                                             if (fdVfStr === currVfStr) return false;
                                                             const fdToObj = new Date(fdDate); fdToObj.setUTCDate(fdDate.getUTCDate() + 1);
                                                             const fdTo = String(fd.id).startsWith('new_') ? ((fd as any).valid_to || '') : fdToObj.toISOString().split('T')[0];
                                                             const afterFrom = currVfStr > fdVfStr;
                                                             const beforeTo = !fdTo || currVfStr <= fdTo;
                                                             return afterFrom && beforeTo;
                                                         });

                                                         const puDataTemp = finImportPerUnitData.find(d => d.week_ending === dateStr);
                                                         const puValTemp = puDataTemp && (exp as any).puKey ? Math.abs(puDataTemp[(exp as any).puKey] || 0) : 0;
                                                         const gValTemp = gRule && exp.key ? Math.abs((gRule as any)[exp.key] || 0) : 0;
                                                         const hasCustomOverrideTemp = gRule && ((gRule as any)[`is_custom_${exp.key}`] || globalOverrides.some(go => go.valid_from === vFromStr));
                                                         const showGRule = gRule && (puValTemp > 0 || gValTemp > 0 || hasCustomOverrideTemp || reductionsForDate.length > 0);
                                                      const fragmentRows = [];
                                                      if (showGRule && (!(isOverridden && hideOverriddenRules) || reductionsForDate.length > 0)) {
                                                          fragmentRows.push(
                                                                     <tr key={`g_${gRule.id}_${dateStr}`} className={`transition-colors ${isOverridden ? 'opacity-20 grayscale pointer-events-none' : 'hover:bg-zinc-800/30'}`}>
                                                                          <td className="py-1.5 px-3 align-top">
                                                                             <div className="flex flex-col gap-1">
                                                                                <input type="date" value={vFromStr || ''} onChange={(e) => {
                                                                                    let newFrom = e.target.value;
                                                                                    if (exp.name === 'Truck Price' || exp.name === 'Trailer Price') newFrom = enforceDayOfWeek(newFrom, 2);
                                                                                    if (gRule && !String(gRule.id).startsWith('dummy_')) {
                                                                                        const dObj = new Date(newFrom);
                                                                                        dObj.setUTCDate(dObj.getUTCDate() + 5);
                                                                                        const newWeekEnding = dObj.toISOString().split('T')[0];
                                                                                        setFinImportData(prev => prev.map(d => d.id === gRule.id ? { ...d, week_ending: newWeekEnding } : d));
                                                                                        if (!modifiedFinImportIds.includes(String(gRule.id))) setModifiedFinImportIds(prev => [...prev, String(gRule.id)]);
                                                                                    }
                                                                                    const go = globalOverrides.find(g => g.valid_from === vFromStr && !(g as any).is_dummy);
                                                                                    if (go) {
                                                                                        setLocalFixedExpenses(prev => prev.map(x => x.id === go.id ? { ...x, valid_from: newFrom } : x));
                                                                                    }
                                                                                }} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 outline-none transition-colors h-7" />
                                                                                {gRule && String(gRule.id).startsWith('new_') && <span className="w-max text-[9px] text-emerald-500 uppercase font-bold px-1.5 py-0.5 bg-emerald-500/10 rounded">New</span>}
                                                                             </div>
                                                                          </td>
                                                                          <td className="py-1.5 px-3 align-top">
                                                                             <input type="date" value={(() => { 
                                                                                if (gRule && String(gRule.id).startsWith('new_')) {
                                                                                    return (gRule as any).valid_to || '';
                                                                                }
                                                                                const go = globalOverrides.find(g => g.valid_from === vFromStr && !(g as any).is_dummy); 
                                                                                if (go && go.valid_to) return go.valid_to;
                                                                                return go && !go.valid_to ? '' : vToStr; 
                                                                             })()} onChange={(e) => {
                                                                                 let newTo = e.target.value;
                                                                                 if (exp.name === 'Truck Price' || exp.name === 'Trailer Price') newTo = enforceDayOfWeek(newTo, 1);
                                                                                 if (gRule && !String(gRule.id).startsWith('dummy_')) {
                                                                                     setFinImportData(prev => prev.map(d => d.id === gRule.id ? { ...d, valid_to: newTo } : d));
                                                                                     if (!modifiedFinImportIds.includes(String(gRule.id))) setModifiedFinImportIds(prev => [...prev, String(gRule.id)]);
                                                                                 }
                                                                                 const go = globalOverrides.find(g => g.valid_from === vFromStr && !(g as any).is_dummy);
                                                                                 if (go) {
                                                                                     setLocalFixedExpenses(prev => prev.map(x => x.id === go.id ? { ...x, valid_to: newTo } : x));
                                                                                 }
                                                                             }} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 outline-none transition-colors h-7" />
                                                                          </td>
                                                                          <td className="py-2 px-3 text-xs text-zinc-500 font-bold uppercase tracking-wider align-top">
                                                                             Global Rule
                                                                          </td>
                                                                          {(exp.key === 'avg_truck_price' || exp.key === 'avg_trailer_price') && (
                                                                              <td className="py-2 px-3 align-top pt-3">
                                                                                  <div className="text-xs text-zinc-400 font-mono font-bold flex items-center gap-1.5">
                                                                                      {(() => {
                                                                                          const dObj = new Date(dateStr);
                                                                                          const vfObj = new Date(dObj); vfObj.setUTCDate(dObj.getUTCDate() - 5);
                                                                                          const vfStr = vfObj.toISOString().split('T')[0];
                                                                                          const reductionKey = exp.key === 'avg_truck_price' ? 'truck_reduction' : 'trailer_reduction';
                                                                                          const activeReductionRule = localFixedExpenses.find(e => e.name === exp.name && e.companyId === 'ALL' && vfStr >= (e.valid_from || '2000-01-01') && vfStr <= (e.valid_to || '2099-12-31') && (e as any)[reductionKey]);
                                                                                          const reductionAmount = activeReductionRule ? Number((activeReductionRule as any)[reductionKey]) : 0;
                                                                                          const note = activeReductionRule ? (activeReductionRule as any)[`${reductionKey}_note`] : '';
                                                                                          if (reductionAmount <= 0) return '-';
                                                                                          return (
                                                                                              <>
                                                                                                  <span>-${Math.round(reductionAmount)}</span>
                                                                                                 {note && (
                                                                                                                             <div className="relative group/note flex items-center">
                                                                                                                                 <FileText size={12} className="text-emerald-500/70 hover:text-emerald-500 cursor-help" />
                                                                                                                                 <div className="hidden group-hover/note:block absolute left-full ml-2 z-[100] w-max max-w-[200px] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl border border-zinc-700 whitespace-normal font-sans [&_ul]:list-disc [&_ul]:pl-5 [&_ul_ul]:list-[circle] [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: note }} />
                                                                                                                             </div>
                                                                                                                         )}
                                                                                              </>
                                                                                          );
                                                                                      })()}
                                                                                  </div>
                                                                              </td>
                                                                          )}
                                                                               <td className="py-2 px-3">
                                                                                   <div className="flex flex-col gap-2">
                                                                                      <div className="flex items-start gap-4">
                                                                                         <div className="flex items-center gap-2 mt-1">
                                                                                            <div className="flex flex-col gap-1 w-32">
                                                                                              <div className="relative flex items-center h-7 w-full">
                                                                                                 {(() => {
                                                                                                      const puData = finImportPerUnitData.find(d => d.week_ending === dateStr);
                                                                                                       const puVal = puData ? Math.abs(puData[(exp as any).puKey] || 0) : 0;
                                                                                                       const dObj = new Date(dateStr);
                                                                                                       const vfObj = new Date(dObj); vfObj.setUTCDate(dObj.getUTCDate() - 5);
                                                                                                       const savedOverride = globalOverrides.find(go => go.valid_from === vfObj.toISOString().split('T')[0] && !((go as any).is_dummy || (Number(go.amount || 0) === 0 && ((go as any).truck_reduction || (go as any).trailer_reduction))));
                                                                                                       const hasStateCustom = gRule && (gRule as any)[`is_custom_${exp.key}`] !== undefined;
                                                                                                       const isCustom = hasStateCustom ? !!(gRule as any)[`is_custom_${exp.key}`] : !!savedOverride;
                                                                                                       
                                                                                                       let customVal: any = '';
                                                                                                       if (gRule && (gRule as any)[`custom_val_${exp.key}`] !== undefined) {
                                                                                                           customVal = (gRule as any)[`custom_val_${exp.key}`];
                                                                                                       } else if (savedOverride && savedOverride.amount !== undefined && savedOverride.amount !== null) {
                                                                                                           customVal = savedOverride.amount;
                                                                                                       }

                                                                                                       const baseVal = isCustom ? customVal : puVal;
                                                                                                       const reductionKey = exp.key === 'avg_truck_price' ? 'truck_reduction' : 'trailer_reduction';
                                                                                                       const activeReductionRule = localFixedExpenses.find(e => e.name === exp.name && e.companyId === 'ALL' && vfObj.toISOString().split('T')[0] >= (e.valid_from || '2000-01-01') && vfObj.toISOString().split('T')[0] <= (e.valid_to || '2099-12-31') && (e as any)[reductionKey]);
                                                                                                       const reductionAmount = activeReductionRule ? Number((activeReductionRule as any)[reductionKey]) : 0;
                                                                                                       const finalVal = baseVal === '' ? '' : Math.max(0, Number(baseVal) - reductionAmount);

                                                                                                       let multiplier = 0;
                                                                                                       if (puData) {
                                                                                                          if (exp.key === 'avg_trailer_price') multiplier = puData.eff_trailers_total || 0;
                                                                                                          else if (exp.key === 'avg_truck_price') multiplier = puData.total_neff_teams_w_oo || 0;
                                                                                                          else multiplier = puData.eff_non_teams_total || 0;
                                                                                                       }
                                                                                                     return (
                                                                                                          <div className={`relative flex items-center justify-start w-full bg-zinc-950 border border-zinc-700 rounded h-7 focus-within:border-emerald-500 transition-colors overflow-hidden ${!isCustom ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                                                                              <span className="pl-2 text-zinc-500 text-xs pointer-events-none flex-shrink-0">$</span>
                                                                                                              <input type="number" value={baseVal === '' ? '' : (baseVal === 0 && !isCustom ? '' : (isCustom ? baseVal : Math.round(Number(baseVal))))} onChange={(e) => {
                                                                                                                     if (isCustom) {
                                                                                                                        const val = e.target.value === '' ? '' : Number(e.target.value);
                                                                                                                        const isTotalField = ['liability_insurance', 'liability_insurance_general', 'cargo_insurance', 'trailer_interchange', 'lago', 'physical_damage_premium', 'physical_damage'].includes(exp.key);
                                                                                                                        const total = isTotalField ? (Number(val) || 0) : (Number(val) || 0) * multiplier;
                                                                                                                        
                                                                                                                        if (gRule && !String(gRule.id).startsWith('dummy_')) {
                                                                                                                            setFinImportData(prev => prev.map(d => d.id === gRule.id ? { ...d, [`is_custom_${exp.key}`]: true, [`custom_val_${exp.key}`]: val, [exp.key]: total } : d));
                                                                                                                            if (!modifiedFinImportIds.includes(String(gRule.id))) setModifiedFinImportIds(prev => [...prev, String(gRule.id)]);
                                                                                                                        }
                                                                                                                        
                                                                                                                        if (savedOverride) {
                                                                                                                            setLocalFixedExpenses(prev => prev.map(o => o.id === savedOverride.id ? { ...o, amount: val === '' ? '' : Number(val) } : o));
                                                                                                                        }
                                                                                                                      }
                                                                                                                  }} disabled={!isCustom} style={reductionAmount > 0 ? { width: `${Math.max(String(baseVal).length, 2) + 3.5}ch` } : {}} className={`${reductionAmount > 0 ? 'flex-none pr-1 line-through text-zinc-500' : 'w-14 pr-1 text-zinc-200'} bg-transparent border-none outline-none py-1 pl-1 text-xs font-mono h-full transition-colors [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} />
                                                                                                              {reductionAmount > 0 && (
                                                                                                                  <div className="flex items-center gap-0.5 whitespace-nowrap pointer-events-none">
                                                                                                                      <span className="text-xs text-zinc-200 font-mono pl-1">{finalVal !== '' ? Math.round(Number(finalVal)) : ''}</span>
                                                                                                                  </div>
                                                                                                              )}
                                                                                                          </div>
                                                                                                      
                                                                                                       );
                                                                                                    })()}
                                                                                                                       {!['liability_insurance', 'cargo_insurance', 'lease_gap_coverage', 'trailer_interchange', 'lago', 'physical_damage_premium', 'physical_damage'].includes(exp.key) ? (
                                                                                                                          <span className="absolute right-2 text-zinc-500 text-[9px] pointer-events-none">/ pu</span>
                                                                                                                       ) : (
                                                                                                                          <div className="absolute right-2 group/tooltip flex items-center justify-center">
                                                                                                                             <Info size={12} className="text-zinc-500 hover:text-emerald-500 transition-colors cursor-help" />
                                                                                                                             <div className="hidden group-hover/tooltip:block absolute right-0 bottom-full mb-1 w-48 bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl normal-case font-normal z-[100] text-center border border-zinc-700 pointer-events-none">
                                                                                                                                Enter the total amount for the entire period, not per driver.
                                                                                                                             </div>
                                                                                                                          </div>
                                                                                                                       )}
                                                                                               </div>
                                                                                            </div>
                                                                                            
                                                                                         </div>
                                                                                        {(() => {
                                                                                                                      const dObj = new Date(dateStr);
                                                                                                                      const vfObj = new Date(dObj); vfObj.setUTCDate(dObj.getUTCDate() - 5);
                                                                                                                      const savedOverride = globalOverrides.find(go => go.valid_from === vfObj.toISOString().split('T')[0] && !(go as any).is_dummy);
                                                                                                                      const hasStateCustom = (gRule as any)[`is_custom_${exp.key}`] !== undefined;
const isCustomLocal = hasStateCustom ? !!(gRule as any)[`is_custom_${exp.key}`] : !!savedOverride;
const isTotalField = ['liability_insurance', 'liability_insurance_general', 'cargo_insurance', 'lease_gap_coverage', 'trailer_interchange', 'lago', 'physical_damage_premium', 'physical_damage'].includes(exp.key);
if (isTotalField) return null;
                                                                                                                      
                                                                                                                      return (
                                                                                                                         <div className="flex flex-col gap-1 mt-1">
                                                                                                                            <label title="Value from finImport" className="flex items-center gap-1 text-[9px] text-zinc-400 cursor-pointer w-max hover:text-zinc-200">
                                                                                                                               <input type="checkbox" checked={!isCustomLocal} onChange={() => { 
                                                                                                                                  if (!String(gRule.id).startsWith('dummy_')) {
                                                                                                                                      setFinImportData(prev => prev.map(d => d.id === gRule.id ? { ...d, [`is_custom_${exp.key}`]: false, [exp.key]: d[`original_${exp.key}`] !== undefined ? d[`original_${exp.key}`] : d[exp.key] } : d));
                                                                                                                                      if (!modifiedFinImportIds.includes(String(gRule.id))) setModifiedFinImportIds(prev => [...prev, String(gRule.id)]); 
                                                                                                                                  }
                                                                                                                                  if (savedOverride) setLocalFixedExpenses(prev => prev.filter(e => e.id !== savedOverride.id));
                                                                                                                                  
                                                                                                                                  const dObj = new Date(dateStr);
                                                                                                                                  const vfObj = new Date(dObj); vfObj.setUTCDate(dObj.getUTCDate() - 5);
                                                                                                                                  const vfStr = vfObj.toISOString().split('T')[0];
                                                                                                                                  const customVal = (gRule as any)[`custom_val_${exp.key}`] !== undefined ? (gRule as any)[`custom_val_${exp.key}`] : (savedOverride ? savedOverride.amount : '');
                                                                                                                                  
                                                                                                                                  setLocalFixedExpenses(prev => prev.map(e => {
                                                                                                                                      if (e.name === exp.name && (e.original_valid_from || e.valid_from) === vfStr && e.companyId !== 'ALL' && ((e as any).truck_reduction || (e as any).trailer_reduction) && Number(e.amount) === Number(customVal)) {
                                                                                                                                          return { ...e, amount: 0, amount_before: 0, amount_after: 0, is_dummy: true };
                                                                                                                                      }
                                                                                                                                      return e;
                                                                                                                                  }));
                                                                                                                               }} className="accent-emerald-500" /> Default Value
                                                                                                                            </label>
                                                                                                                            <label className="flex items-center gap-1 text-[9px] text-zinc-400 cursor-pointer w-max hover:text-zinc-200">
                                                                                                                               <input type="checkbox" checked={isCustomLocal} onChange={() => { 
                                                                                                                                  if (String(gRule.id).startsWith('dummy_')) {
                                                                                                                                      const newId = `new_${Math.random().toString(36).substring(2, 11)}`;
                                                                                                                                      const newRecord = { id: newId, week_ending: dateStr, [`is_custom_${exp.key}`]: true, [`custom_val_${exp.key}`]: savedOverride ? savedOverride.amount : '' };
                                                                                                                                      setFinImportData(prev => [newRecord as any, ...prev].sort((a,b) => new Date(b.week_ending).getTime() - new Date(a.week_ending).getTime()));
                                                                                                                                      setModifiedFinImportIds(prev => [...prev, newId]);
                                                                                                                                  } else {
                                                                                                                                      setFinImportData(prev => prev.map(d => d.id === gRule.id ? { ...d, [`is_custom_${exp.key}`]: true, [`original_${exp.key}`]: d[`original_${exp.key}`] !== undefined ? d[`original_${exp.key}`] : d[exp.key], [exp.key]: 0, [`custom_val_${exp.key}`]: savedOverride ? savedOverride.amount : '' } : d));
                                                                                                                                      if (!modifiedFinImportIds.includes(String(gRule.id))) setModifiedFinImportIds(prev => [...prev, String(gRule.id)]); 
                                                                                                                                  }
                                                                                                                               }} className="accent-emerald-500" /> Custom Value
                                                                                                                            </label>
                                                                                                                         </div>
                                                                                                                      );
                                                                                                                  })()}
                                                                                        {exp.key === 'liability_insurance' && (
                                                                                           <div className="flex flex-col items-start gap-1 mt-1">
                                                                                              <button onClick={() => toggleMclooRule(gRule.id)} className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] rounded border border-zinc-700 transition-colors h-max whitespace-nowrap">
                                                                                                 {expandedMclooRules.includes(gRule.id) ? 'Hide MCLOO Rule' : 'Edit MCLOO Rule'}
                                                                                              </button>
                                                                                           </div>
                                                                                        )}
                                                                                     </div>
                                                                                     {exp.key === 'liability_insurance' && expandedMclooRules.includes(gRule.id) && (
                                                                                        <div className="flex items-start gap-4 bg-zinc-900/50 p-2 rounded border border-zinc-800/50 w-max">
                                                                                           {(() => {
                                                                                              const dObj = new Date(dateStr);
                                                                                              const vfObj = new Date(dObj); vfObj.setUTCDate(dObj.getUTCDate() - 5);
                                                                                              const savedOverride = globalOverrides.find(go => go.valid_from === vfObj.toISOString().split('T')[0] && !(go as any).is_dummy);
                                                                                              
                                                                                              return (
                                                                                                 <div className="flex items-center gap-4">
                                                                                                    <div className="flex flex-col gap-0.5 pl-2">
                                                                                                       <div className="flex items-center gap-1">
                                                                                                          <label className="text-[8px] text-zinc-400 font-bold uppercase">Shared Insurance (Per Unit)</label>
                                                                                                          <div className="relative group/mcloo-tooltip flex items-center justify-center">
                                                                                                             <Info size={12} className="text-zinc-400 hover:text-zinc-200 cursor-help transition-colors" />
                                                                                                             <div className="hidden group-hover/mcloo-tooltip:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-[100] w-[200px] bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded shadow-xl border border-zinc-700 whitespace-normal font-sans normal-case tracking-normal text-center">
                                                                                                                Enter the shared liability insurance amount here. This specific value is used directly in the calculation of Revenue Collected.
                                                                                                             </div>
                                                                                                          </div>
                                                                                                       </div>
                                                                                                       <div className="flex items-center gap-2">
                                                                                                          <div className="relative h-5 w-24">
                                                                                                             <span className="absolute left-1.5 top-0.5 text-zinc-500 text-[9px] pointer-events-none">$</span>
                                                                                                             <input type="number" value={(gRule as any).shared_insurance ?? (savedOverride as any)?.shared_insurance ?? ''} onChange={(e) => { handleFinImportChange(gRule.id, 'shared_insurance', e.target.value as any); }} className="w-full bg-zinc-950 border border-zinc-700 rounded py-0 pl-4 pr-1 text-[9px] text-zinc-200 focus:border-emerald-500 outline-none h-full" />
                                                                                                          </div>
                                                                                                       </div>
                                                                                                    </div>
                                                                                                 </div>
                                                                                              );
                                                                                           })()}
                                                                                        </div>
                                                                                     )}
                                                                                  </div>
                                                                               </td>
                                                                               <td className="py-2 px-3 text-right">
                                                                                <div className="flex items-center justify-end gap-2">
                                                                                    
                                                                 <button onClick={(e) => { 
                                                                     e.stopPropagation(); 
                                                                     if (String(gRule.id).startsWith('new_')) {
                                                                         setFinImportData(prev => prev.filter(d => String(d.id) !== String(gRule.id)));
                                                                         setLocalFixedExpenses(prev => prev.filter(x => !(x.name === exp.name && (x.original_valid_from || x.valid_from) === vFromStr)));
                                                                     } else if (String(gRule.id).startsWith('dummy_')) {
                                                                         setLocalFixedExpenses(prev => prev.filter(x => !(x.name === exp.name && (x.original_valid_from || x.valid_from) === vFromStr)));
                                                                     } else {
                                                                         handleResetFinImportCustom(String(gRule.id), exp.key, exp.name);
                                                                         setLocalFixedExpenses(prev => prev.filter(x => !(x.name === exp.name && (x.original_valid_from || x.valid_from) === vFromStr && x.companyId !== 'ALL')));
                                                                     }
                                                                 }} className="p-1 text-zinc-600 hover:text-rose-500 transition-colors">
                                                                    <Trash2 size={14} />
                                                                 </button>
                                                                              </div>
                                                                          </td>
                                                                     </tr>
                                                             );

                                                             if (exp.key === 'avg_truck_price' || exp.key === 'avg_trailer_price') {
                                                                 const reductionKey = exp.key === 'avg_truck_price' ? 'truck_reduction' : 'trailer_reduction';
                                                                 const globalAttachedReductions = localFixedExpenses.filter(r => {
                                                                     if (r.name !== exp.name || !(r as any)[reductionKey]) return false;
                                                                     const rFrom = r.original_valid_from || r.valid_from || '2000-01-01';
                                                                     const rTo = r.valid_to || '2099-12-31';
                                                                     if (vFromStr < rFrom || vFromStr > rTo) return false;
                                                                     return r.contractType && r.contractType !== '' && r.contractType !== 'ALL' && (!r.companyId || r.companyId === 'ALL' || r.companyId === '');
                                                                 });

                                                                 const uniqueGlobalAttached: any[] = [];
                                                                 const seenGlobalSigs = new Set();
                                                                 globalAttachedReductions.forEach(r => {
                                                                     const rA = Number((r as any)[reductionKey]) || 0;
                                                                     const sig = `${r.contractType || ''}_${r.companyId || ''}_${rA}`;
                                                                     if (!seenGlobalSigs.has(sig)) {
                                                                         seenGlobalSigs.add(sig);
                                                                         uniqueGlobalAttached.push(r);
                                                                     }
                                                                 });

                                                                 uniqueGlobalAttached.forEach(rRule => {
                                                                     const rAmount = Number((rRule as any)[reductionKey]) || 0;
                                                                     
                                                                     const puDataTemp = finImportPerUnitData.find(d => d.week_ending === dateStr);
                                                                     const puValTemp = puDataTemp && (exp as any).puKey ? Math.abs(puDataTemp[(exp as any).puKey] || 0) : 0;
                                                                     const savedOverride = globalOverrides.find(go => go.valid_from === vFromStr && !((go as any).is_dummy || (Number(go.amount || 0) === 0 && ((go as any).truck_reduction || (go as any).trailer_reduction))));
                                                                     const hasStateCustom = gRule && (gRule as any)[`is_custom_${exp.key}`] !== undefined;
                                                                     const isCustom = hasStateCustom ? !!(gRule as any)[`is_custom_${exp.key}`] : !!savedOverride;
                                                                     
                                                                     let customVal: any = '';
                                                                     if (gRule && (gRule as any)[`custom_val_${exp.key}`] !== undefined) {
                                                                         customVal = (gRule as any)[`custom_val_${exp.key}`];
                                                                     } else if (savedOverride && savedOverride.amount !== undefined && savedOverride.amount !== null) {
                                                                         customVal = savedOverride.amount;
                                                                     }
                                                                     const baseVal = isCustom ? Number(customVal) : puValTemp;
                                                                                                     const globalReds = localFixedExpenses.filter(e => e.name === exp.name && e.companyId === 'ALL' && (!e.contractType || e.contractType === '' || e.contractType === 'ALL') && vFromStr >= (e.valid_from || '2000-01-01') && vFromStr <= (e.valid_to || '2099-12-31') && (e as any)[reductionKey]);
                                                                                                     const globalReductionAmount = globalReds.length > 0 ? Math.max(...globalReds.map(e => Number((e as any)[reductionKey]) || 0)) : 0;
                                                                                                     const finalVal = (baseVal === 0 && !isCustom) ? '' : Math.max(0, baseVal - globalReductionAmount - rAmount);

                                                                                                     fragmentRows.push(
                                                                         <tr key={`${rRule.id}_${dateStr}_global_attached_reduction`} className="bg-rose-500/5 hover:bg-rose-500/10 transition-colors">
                                             <td className="py-1.5 px-3"></td>
                                                                             <td className="py-1.5 px-3 relative">
                                                                                 <div className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500/50">
                                                                                     <CornerDownRight size={16} />
                                                                                 </div>
                                                                             </td>
                                                                             <td className="py-1.5 px-3">
                                                                                 <div className="flex items-center border-l-2 border-rose-500/30 pl-2">
                                                                                     <span className="text-xs text-zinc-300 font-bold">Contract: {rRule.contractType}</span>
                                                                                 </div>
                                                                             </td>
                                                                             <td className="py-1.5 px-3">
                                                                                 <div className="text-xs text-zinc-400 font-mono font-bold flex items-center gap-1.5">
                                                                                     <span>-${Math.round(rAmount)}</span>
                                                                                     {(rRule as any)[`${reductionKey}_note`] && (
                                                                                         <div className="relative group/note flex items-center">
                                                                                             <FileText size={12} className="text-emerald-500/70 hover:text-emerald-500 cursor-help" />
                                                                                             <div className="hidden group-hover/note:block absolute left-full ml-2 z-[100] w-max max-w-[200px] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl border border-zinc-700 whitespace-normal font-sans [&_ul]:list-disc [&_ul]:pl-5 [&_ul_ul]:list-[circle] [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: (rRule as any)[`${reductionKey}_note`] }} />
                                                                                         </div>
                                                                                     )}
                                                                                 </div>
                                                                             </td>
                                                                             <td className="py-1.5 px-3">
                                                                                 <div className="flex items-center h-7">
                                                                                     <span className="pl-2 text-zinc-500 text-xs pointer-events-none flex-shrink-0">$</span>
                                                                                     <span className="text-xs text-zinc-200 font-mono font-bold pl-1">{finalVal !== '' ? Math.round(Number(finalVal)) : ''}</span>
                                                                                 </div>
                                                                             </td>
                                                                             <td className="py-1.5 px-3 text-right"></td>
                                                                         </tr>
                                                                     );
                                                                 });
                                                             }
                                                         }
                                                         
                                                         [...cRules].sort((a, b) => {
                                                             const nameA = a.companyId === 'ALL' ? ' ' : String(a.companyId || (a as any).contractType || 'zz').trim().toLowerCase();
                                                             const nameB = b.companyId === 'ALL' ? ' ' : String(b.companyId || (b as any).contractType || 'zz').trim().toLowerCase();
                                                             if (expenseFilter.sort === 'A-Z') {
                                                                 return nameA.localeCompare(nameB) || new Date(b.valid_from || '1970-01-01').getTime() - new Date(a.valid_from || '1970-01-01').getTime();
                                                             }
                                                             if (expenseFilter.sort === 'Z-A') {
                                                                 return nameB.localeCompare(nameA) || new Date(b.valid_from || '1970-01-01').getTime() - new Date(a.valid_from || '1970-01-01').getTime();
                                                             }
                                                             return 0;
                                                         }).forEach(cRule => {
                                                             fragmentRows.push(
                                                                     <tr key={cRule.id} className="bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
                                                                        <td className="py-1.5 px-3">
                                                                                                            <input type="date" value={cRule.valid_from || ''} onChange={(e) => {
                                                                                                                let val = e.target.value;
                                                                                                                if (exp.name === 'Truck Price' || exp.name === 'Trailer Price') val = enforceDayOfWeek(val, 2);
                                                                                                                handleCompanyExpenseChange(cRule.id, 'valid_from', val);
                                                                                                            }} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 outline-none transition-colors h-7" />
                                                                                                         </td>
                                                                                                         <td className="py-1.5 px-3">
                                                                                                            <input type="date" value={cRule.valid_to || ''} onChange={(e) => {
                                                                                                                let val = e.target.value;
                                                                                                                if (exp.name === 'Truck Price' || exp.name === 'Trailer Price') val = enforceDayOfWeek(val, 1);
                                                                                                                handleCompanyExpenseChange(cRule.id, 'valid_to', val);
                                                                                                            }} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 outline-none transition-colors h-7" />
                                                                                                         </td>
                                                                         <td className="py-1.5 px-3 flex items-center gap-2">
                                                                            {(cRule.contractType !== undefined && cRule.contractType !== null) && (!cRule.companyId || cRule.companyId === '') ? (
                                                                               <select value={cRule.contractType} onChange={(e) => handleCompanyExpenseChange(cRule.id, 'contractType' as any, e.target.value)} className="w-full bg-zinc-950 border border-purple-700/50 rounded px-2 py-1 text-xs text-purple-500 font-bold focus:border-purple-500 outline-none h-7">
                                                                                  <option value="" disabled>Select Contract</option>
                                                                                  {availableContractTypes.map(c => <option key={c as string} value={c as string}>{c}</option>)}
                                                                               </select>
                                                                            ) : (
                                                                               <select
                                                                                 value={cRule.companyId}
                                                                                 onChange={(e) => {
                                                                                    if (e.target.value === 'NEW_COMPANY') {
                                                                                       setCompanyPromptValue('');
                                                                                       setCompanyPrompt({
                                                                                           isOpen: true,
                                                                                           callback: (newComp) => {
                                                                                               if (newComp && newComp.trim() !== '') {
                                                                                                   setCustomCompanies(prev => [...prev, newComp.trim()]);
                                                                                                   handleCompanyExpenseChange(cRule.id, 'companyId', newComp.trim());
                                                                                               }
                                                                                           }
                                                                                       });
                                                                                    } else {
                                                                                       handleCompanyExpenseChange(cRule.id, 'companyId', e.target.value);
                                                                                    }
                                                                                 }}
                                                                                 className="w-full bg-zinc-950 border border-amber-700/50 rounded px-2 py-1 text-xs text-amber-500 font-bold focus:border-amber-500 outline-none h-7"
                                                                               >
                                                                                  <option value="" disabled>Select Company</option>
                                                                                  <option value="NEW_COMPANY" className="text-emerald-500 font-bold">+ Add new company</option>
                                                                                  {allCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                                                                               </select>
                                                                            )}
                                                                         </td>
                                                                         {(exp.key === 'avg_truck_price' || exp.key === 'avg_trailer_price') && (
                                                                             <td className="py-1.5 px-3">
                                                                                 <div className="text-xs text-zinc-400 font-mono font-bold flex items-center gap-1.5">
                                                                                     {(() => {
                                                                                         const reductionKey = exp.key === 'avg_truck_price' ? 'truck_reduction' : 'trailer_reduction';
                                                                                         const isCombinedRule = cRule.companyId && cRule.companyId !== 'ALL' && cRule.contractType && cRule.contractType !== '';
                                                                                         const reductionAmount = Number((cRule as any)[reductionKey]) || 0;
                                                                                         const note = (cRule as any)[`${reductionKey}_note`];
                                                                                         if (reductionAmount <= 0 || isCombinedRule) return '-';
                                                                                         return (
                                                                                             <>
                                                                                                 <span>-${Math.round(reductionAmount)}</span>
                                                                                                {note && (
                                                                                                                             <div className="relative group/note flex items-center">
                                                                                                                                 <FileText size={12} className="text-emerald-500/70 hover:text-emerald-500 cursor-help" />
                                                                                                                                 <div className="hidden group-hover/note:block absolute left-full ml-2 z-[100] w-max max-w-[200px] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl border border-zinc-700 whitespace-normal font-sans [&_ul]:list-disc [&_ul]:pl-5 [&_ul_ul]:list-[circle] [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: note }} />
                                                                                                                             </div>
                                                                                                                         )}
                                                                                             </>
                                                                                         );
                                                                                     })()}
                                                                                 </div>
                                                                             </td>
                                                                         )}
                                                                         <td className="py-1.5 px-3">
                                                                                    <div className="flex flex-col gap-2">
                                                                                       <div className="flex items-start gap-4">
                                                                                          <div className="flex flex-col gap-1 w-32 mt-1">
                                                                                            <div className="relative flex items-center h-7 w-full">
                                                                                                {(() => {
                                                                                                    const reductionKey = exp.key === 'avg_truck_price' ? 'truck_reduction' : 'trailer_reduction';
                                                                                                    const isCombinedRule = cRule.companyId && cRule.companyId !== 'ALL' && cRule.contractType && cRule.contractType !== '';
                                                                                                    const reductionAmount = isCombinedRule ? 0 : (Number((cRule as any)[reductionKey]) || 0);
                                                                                                    const rawVal = (cRule.amount !== undefined && cRule.amount !== null && cRule.amount !== '') ? cRule.amount : ((cRule.amount_after !== undefined && cRule.amount_after !== null && cRule.amount_after !== '') ? cRule.amount_after : '');
                                                                                                    const finalVal = rawVal === '' ? '' : Math.max(0, Number(rawVal) - reductionAmount);
                                                                                                 return (
                                                                                                        <div className="relative flex items-center justify-start w-full bg-zinc-950 border border-amber-700/50 rounded h-7 focus-within:border-amber-500 transition-colors overflow-hidden">
                                                                                                            <span className="pl-2 text-amber-500/50 text-xs pointer-events-none flex-shrink-0">$</span>
                                                                                                            <input type="number" value={rawVal} onChange={(e) => { 
                                                                                                                const val = e.target.value;
                                                                                                                handleCompanyExpenseChange(cRule.id, 'amount', val); 
                                                                                                                handleCompanyExpenseChange(cRule.id, 'amount_after', val); 
                                                                                                            }} style={reductionAmount > 0 ? { width: `${Math.max(String(rawVal).length, 2) + 3.5}ch` } : {}} className={`${reductionAmount > 0 ? 'flex-none pr-1 line-through text-amber-500/50' : 'w-14 pr-1 text-zinc-200'} bg-transparent border-none outline-none py-1 pl-1 text-xs font-mono h-full transition-colors [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} />
                                                                                                            {reductionAmount > 0 && (
                                                                                                                <div className="flex items-center gap-0.5 whitespace-nowrap pointer-events-none">
                                                                                                                    <span className="text-xs text-zinc-200 font-mono pl-1">{finalVal !== '' ? Math.round(Number(finalVal)) : ''}</span>
                                                                                                                </div>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    );
                                                                                                })()}
{!['liability_insurance', 'liability_insurance_general', 'cargo_insurance', 'lease_gap_coverage', 'trailer_interchange', 'lago', 'physical_damage_premium', 'physical_damage'].includes(exp.key) ? (
    <span className="absolute right-2 text-amber-500/50 text-[9px] pointer-events-none">/ pu</span>
) : (
                                                                                                   <div className="absolute right-2 group/tooltip flex items-center justify-center">
                                                                                                      <Info size={12} className="text-amber-500/70 hover:text-amber-500 transition-colors cursor-help" />
                                                                                                      <div className="hidden group-hover/tooltip:block absolute right-0 bottom-full mb-1 w-48 bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl normal-case font-normal z-[100] text-center border border-zinc-700 pointer-events-none">
                                                                                                         Enter the total amount for the entire period, not per driver.
                                                                                                      </div>
                                                                                                   </div>
                                                                                                )}
                                                                                             </div>
                                                                                          </div>
                                                                                          
                                                                                          {exp.key === 'liability_insurance' && (
                                                                                             <div className="flex flex-col items-start gap-1 mt-1">
                                                                                                <button onClick={() => toggleMclooRule(String(cRule.id))} className="px-2 py-0.5 bg-amber-950 hover:bg-amber-900 text-amber-500/70 text-[10px] rounded border border-amber-900/50 transition-colors h-max whitespace-nowrap">
                                                                                                   {expandedMclooRules.includes(String(cRule.id)) ? 'Hide MCLOO Rule' : 'Edit MCLOO Rule'}
                                                                                                </button>
                                                                                             </div>
                                                                                          )}
                                                                                       </div>
                                                                                       
                                                                                    </div>
                                                                                 </td>
                                                                                <td className="py-1.5 px-3 text-right">
                                                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteCompanyExpense(String(cRule.id)); }} className="text-zinc-500 hover:text-rose-500 p-1 rounded transition-colors inline-flex justify-center items-center">
                                                                               <Trash2 size={14}/>
                                                                            </button>
                                                                         </td>
                                                                     </tr>
                                                             );

                                                             if (exp.key === 'liability_insurance' && expandedMclooRules.includes(String(cRule.id))) {
                                                                                                 fragmentRows.push(
                                                                                                     <tr key={`${cRule.id}_expanded`} className="bg-amber-500/5">
                                                                                                         <td colSpan={5} className="px-3 pb-3 pt-0 border-t-0">
                                                                                                             <div className="flex flex-col gap-3 bg-zinc-950/50 p-3 rounded-lg border border-amber-500/20 w-full relative ml-4">
                                                                                                                <div className="absolute -top-2.5 -left-3 text-amber-500/30">
                                                                                                                    <CornerDownRight size={16} />
                                                                                                                </div>
                                                                                                                <div className="flex items-center gap-4 pl-4">
                                                                                                                   <div className="flex flex-col gap-1 w-full">
                                                                                                                      <div className="flex items-center gap-1">
                                                                                                                         <label className="text-[8px] text-amber-500/70 font-bold uppercase tracking-wider">Shared Insurance (Per Unit)</label>
                                                                                                                         <div className="relative group/mcloo-tooltip flex items-center justify-center">
                                                                                                                            <Info size={12} className="text-amber-500/70 hover:text-amber-500 cursor-help transition-colors" />
                                                                                                                            <div className="hidden group-hover/mcloo-tooltip:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-[100] w-[200px] bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded shadow-xl border border-zinc-700 whitespace-normal font-sans normal-case tracking-normal text-center">
                                                                                                                               Enter the shared liability insurance amount here. This specific value is used directly in the calculation of Revenue Collected.
                                                                                                                            </div>
                                                                                                                         </div>
                                                                                                                      </div>
                                                                                                                      <div className="flex items-center gap-3">
                                                                                                                         <div className="relative h-7 w-32">
                                                                                                                            <span className="absolute left-2 top-1.5 text-amber-500/50 text-[10px] pointer-events-none">$</span>
                                                                                                                            <input type="number" value={(cRule as any).shared_insurance ?? ''} onChange={(e) => handleCompanyExpenseChange(cRule.id, 'shared_insurance' as any, e.target.value)} className="w-full bg-zinc-900 border border-amber-700/50 rounded py-0 pl-6 pr-2 text-xs text-zinc-200 focus:border-amber-500 outline-none h-full" />
                                                                                                                         </div>
                                                                                                                      </div>
                                                                                                                   </div>
                                                                                                                </div>
                                                                                                             </div>
                                                                                                         </td>
                                                                                                     </tr>
                                                                                                 );
                                                                                             }
                                                                                            
                                                                                            if (exp.key === 'avg_truck_price' || exp.key === 'avg_trailer_price') {
                                                                                                const reductionKey = exp.key === 'avg_truck_price' ? 'truck_reduction' : 'trailer_reduction';
                                                                                                const cRuleFrom = cRule.original_valid_from || cRule.valid_from;
                                                                                                const isCombinedRule = cRule.companyId && cRule.companyId !== 'ALL' && cRule.contractType && cRule.contractType !== '';
                                                                                                const attachedReductions = [];
                                                                                                
                                                                                                if (isCombinedRule && Number((cRule as any)[reductionKey]) > 0) {
                                                                                                    attachedReductions.push(cRule);
                                                                                                } else {
                                                                                                    const oppositeReductions = localFixedExpenses.filter(r => {
                                                                                                        if (r.name !== exp.name || !(r as any)[reductionKey]) return false;
                                                                                                        const rFrom = r.original_valid_from || r.valid_from || '2000-01-01';
                                                                                                        const rTo = r.valid_to || '2099-12-31';
                                                                                                        if (vFromStr < rFrom || vFromStr > rTo) return false;
                                                                                                        if (cRule.companyId && cRule.companyId !== 'ALL' && (!cRule.contractType || cRule.contractType === '')) {
                                                                                                            return r.contractType && r.contractType !== '' && r.contractType !== 'ALL' && (!r.companyId || r.companyId === 'ALL' || r.companyId === '' || r.companyId === cRule.companyId);
                                                                                                        }
                                                                                                        if (cRule.contractType && cRule.contractType !== '' && (!cRule.companyId || cRule.companyId === 'ALL' || cRule.companyId === '')) {
                                                                                                            return r.contractType === cRule.contractType && r.companyId && r.companyId !== 'ALL';
                                                                                                        }
                                                                                                        return false;
                                                                                                    });
                                                                                                    attachedReductions.push(...oppositeReductions);
                                                                                                }

                                                                                                const uniqueAttached: any[] = [];
          const seenAttachedSigs = new Set();
          attachedReductions.forEach(r => {
              const rA = Number((r as any)[reductionKey]) || 0;
              const sigContract = r.contractType === cRule.contractType ? '' : (r.contractType || '');
              const sigCompany = r.companyId === cRule.companyId ? '' : (r.companyId || '');
              const sig = `${sigContract}_${sigCompany}_${rA}`;
              if (!seenAttachedSigs.has(sig)) {
                  seenAttachedSigs.add(sig);
                  uniqueAttached.push(r);
              }
          });

                                                                                                uniqueAttached.forEach(rRule => {
                                                                                                    const rAmount = Number((rRule as any)[reductionKey]) || 0;
                                                                                                    const rawVal = (cRule.amount !== undefined && cRule.amount !== null && cRule.amount !== '') ? cRule.amount : ((cRule.amount_after !== undefined && cRule.amount_after !== null && cRule.amount_after !== '') ? cRule.amount_after : '');
                                                                                                    const finalVal = rawVal === '' ? '' : Math.max(0, Number(rawVal) - rAmount);
                                                                                                    fragmentRows.push(
                                                                                                        <tr key={`${rRule.id}_${cRule.id}_attached_reduction`} className="bg-rose-500/5 hover:bg-rose-500/10 transition-colors">
                                                                                                            <td className="py-1.5 px-3"></td>
                                                                                                            <td className="py-1.5 px-3 relative">
                                                                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500/50">
                                                                                                                    <CornerDownRight size={16} />
                                                                                                                </div>
                                                                                                            </td>
                                                                                                            <td className="py-1.5 px-3">
                                                                                                                <div className="flex items-center border-l-2 border-rose-500/30 pl-2">
                                                                                                                    <span className="text-xs text-zinc-300 font-bold">{rRule.contractType ? `Contract: ${rRule.contractType}` : `Company: ${rRule.companyId || 'Unknown'}`}</span>
                                                                                                                </div>
                                                                                                            </td>
                                                                                                            <td className="py-1.5 px-3">
                                                                                                                <div className="text-xs text-zinc-400 font-mono font-bold flex items-center gap-1.5">
                                                                                                                    <span>-${Math.round(rAmount)}</span>
                                                                                                                    {(rRule as any)[`${reductionKey}_note`] && (
                                                                                                                        <div className="relative group/note flex items-center">
                                                                                                                            <FileText size={12} className="text-emerald-500/70 hover:text-emerald-500 cursor-help" />
                                                                                                                            <div className="hidden group-hover/note:block absolute left-full ml-2 z-[100] w-max max-w-[200px] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl border border-zinc-700 whitespace-normal font-sans [&_ul]:list-disc [&_ul]:pl-5 [&_ul_ul]:list-[circle] [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: (rRule as any)[`${reductionKey}_note`] }} />
                                                                                                                        </div>
                                                                                                                    )}
                                                                                                                </div>
                                                                                                            </td>
                                                                                                            <td className="py-1.5 px-3">
                                                                                                                <div className="flex items-center h-7">
                                                                                                                    <span className="pl-2 text-zinc-500 text-xs pointer-events-none flex-shrink-0">$</span>
                                                                                                                    <span className="text-xs text-zinc-200 font-mono font-bold pl-1">{finalVal !== '' ? Math.round(Number(finalVal)) : ''}</span>
                                                                                                                </div>
                                                                                                            </td>
                                                                                                            <td className="py-1.5 px-3 text-right"></td>
                                                                                                        </tr>
                                                                                                    );
                                                                                                });
                                                                                            }
                                                                                        });

                                                                                        

                                                                                            if (reductionsForDate.length > 0 && (exp.key === 'avg_truck_price' || exp.key === 'avg_trailer_price')) {
                                                                                                const uniqueReductions: any[] = [];
                                                                                                const seenSigs = new Set();
                                                                                                reductionsForDate.forEach((r: any) => {
                                                                                                    const rK = exp.key === 'avg_truck_price' ? 'truck_reduction' : 'trailer_reduction';
                                                                                                    const rA = Number(r[rK]) || 0;
                                                                                                    const sig = `${r.contractType || ''}_${r.companyId || ''}_${rA}`;
                                                                                                    if (!seenSigs.has(sig)) {
                                                                                                        seenSigs.add(sig);
                                                                                                        uniqueReductions.push(r);
                                                                                                    }
                                                                                                });
                                                                                                uniqueReductions.forEach((rRule: any) => {
                                                                                                    const rKey = exp.key === 'avg_truck_price' ? 'truck_reduction' : 'trailer_reduction';
                                                                                                    const rAmount = Number(rRule[rKey]) || 0;
                                                                                                    
                                                                                                    const puDataTemp = finImportPerUnitData.find(d => d.week_ending === dateStr);
                                                                                                    const puValTemp = puDataTemp && (exp as any).puKey ? Math.abs(puDataTemp[(exp as any).puKey] || 0) : 0;
                                                                                                    const dObj = new Date(dateStr);
                                                                                                    const vfObj = new Date(dObj); vfObj.setUTCDate(dObj.getUTCDate() - 5);
                                                                                                    const savedOverride = globalOverrides.find(go => go.valid_from === vfObj.toISOString().split('T')[0] && !((go as any).is_dummy || (Number(go.amount || 0) === 0 && ((go as any).truck_reduction || (go as any).trailer_reduction))));
                                                                                                    const hasStateCustom = gRule && (gRule as any)[`is_custom_${exp.key}`] !== undefined;
                                                                                                    if (rRule.contractType && rRule.contractType !== '') {
                                                                                                        if (!rRule.companyId || rRule.companyId === 'ALL') return;
                                                                                                        if (cRules.some((c: any) => c.companyId === rRule.companyId)) return;
                                                                                                    }
                                                                                                    const isCustom = hasStateCustom ? !!(gRule as any)[`is_custom_${exp.key}`] : !!savedOverride;
                                                                                                    
                                                                                                    let customVal: any = '';
                                                                                                    if (gRule && (gRule as any)[`custom_val_${exp.key}`] !== undefined) {
                                                                                                        customVal = (gRule as any)[`custom_val_${exp.key}`];
                                                                                                    } else if (savedOverride && savedOverride.amount !== undefined && savedOverride.amount !== null) {
                                                                                                        customVal = savedOverride.amount;
                                                                                                    }
                                                                                                    const baseVal = isCustom ? Number(customVal) : puValTemp;
                                                                                                    const globalReds = localFixedExpenses.filter(e => e.name === exp.name && e.companyId === 'ALL' && (!e.contractType || e.contractType === '' || e.contractType === 'ALL') && vfObj.toISOString().split('T')[0] >= (e.valid_from || '2000-01-01') && vfObj.toISOString().split('T')[0] <= (e.valid_to || '2099-12-31') && (e as any)[rKey]);
                                                                                                    const globalReductionAmount = globalReds.length > 0 ? Math.max(...globalReds.map(e => Number((e as any)[rKey]) || 0)) : 0;
                                                                                                    const finalVal = (baseVal === 0 && !isCustom) ? '' : Math.max(0, baseVal - globalReductionAmount - rAmount);

                                                                                                    fragmentRows.push(
                                                                         <tr key={`${rRule.id}_${dateStr}_global_attached_reduction`} className="bg-rose-500/5 hover:bg-rose-500/10 transition-colors">
                                                                            <td className="py-1.5 px-3"></td>
                                                                                                            <td className="py-1.5 px-3 relative">
                                                                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500/50">
                                                                                                                    <CornerDownRight size={16} />
                                                                                                                </div>
                                                                                                            </td>
                                                                                                            <td className="py-1.5 px-3">
                                                                                                                <div className="flex items-center border-l-2 border-rose-500/30 pl-2">
                                                                                                                    <span className="text-xs text-zinc-300 font-bold">{rRule.contractType ? `Contract: ${rRule.contractType}` : `Company: ${rRule.companyId || 'Unknown'}`}</span>
                                                                                                                </div>
                                                                                                            </td>
                                                                                                            {(exp.key === 'avg_truck_price' || exp.key === 'avg_trailer_price') && (
                                                                                                                <td className="py-1.5 px-3">
                                                                                                                    <div className="text-xs text-zinc-400 font-mono font-bold flex items-center gap-1.5">
                                                                                                                        <span>-${Math.round(rAmount)}</span>
                                                                                                                        {rRule[`${exp.key === 'avg_truck_price' ? 'truck_reduction' : 'trailer_reduction'}_note`] && (
                                                                                                                            <div className="relative group/note flex items-center">
                                                                                                                                <FileText size={12} className="text-emerald-500/70 hover:text-emerald-500 cursor-help" />
                                                                                                                                <div className="hidden group-hover/note:block absolute left-full ml-2 z-[100] w-max max-w-[200px] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl border border-zinc-700 whitespace-normal font-sans [&_ul]:list-disc [&_ul]:pl-5 [&_ul_ul]:list-[circle] [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: rRule[`${exp.key === 'avg_truck_price' ? 'truck_reduction' : 'trailer_reduction'}_note`] }} />
                                                                                                                            </div>
                                                                                                                        )}
                                                                                                                    </div>
                                                                                                                </td>
                                                                                                            )}
                                                                                                            <td className="py-1.5 px-3">
                                                                                                                <div className="flex items-center h-7">
                                                                                                                    <span className="pl-2 text-zinc-500 text-xs pointer-events-none flex-shrink-0">$</span>
                                                                                                                    <span className="text-xs text-zinc-200 font-mono font-bold pl-1">{finalVal !== '' ? Math.round(Number(finalVal)) : ''}</span>
                                                                                                                </div>
                                                                                                            </td>
                                                                                                            <td className="py-1.5 px-3 text-right">
                                                                                                            </td>
                                                                                                        </tr>
                                                                                                    );
                                                                                                });
                                                                                            }

                                                                                        return fragmentRows;
                                                                                    })}
                                                  </tbody>
                                                       </table>
                                                   </div>
                                                </div>
                                             </td>
                                          </tr>
                                       )}
                                    </React.Fragment>
                                 );
                             }
                          })}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-950 rounded-b-lg flex justify-between items-center flex-shrink-0">
          <div className="text-sm font-medium text-emerald-500 animate-pulse">
            {isSaving && loadingMessage}
          </div>
          <button 
            onClick={handleSaveAndClose}
            disabled={isSaving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px] justify-center"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} /> Save and Close
              </>
            )}
         </button>
        </div>

        {isExpenseManagerOpen && (
           <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 rounded-lg backdrop-blur-sm p-6">
              <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-2xl flex flex-col shadow-2xl max-h-full">
                 <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950 rounded-t-lg">
                    <div className="flex items-center gap-2 text-emerald-500">
                       <Settings size={20} />
                       <h3 className="text-sm font-bold text-white uppercase tracking-wider">Expense Management</h3>
                    </div>
                    <button onClick={() => setIsExpenseManagerOpen(false)} className="text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>
                 </div>
                 <div className="p-6 overflow-y-auto space-y-6">
                    <div className="space-y-0">
                       {fixedExpenseNames.map(en => (
                          <div key={en} className="py-3 border-b border-zinc-800/50 last:border-0 flex flex-col gap-2">
                             <div className="flex items-center justify-between">
                                {editingExpense === en ? (
                                   <div className="flex items-center gap-2 flex-1 mr-4">
                                      <input type="text" value={editingExpenseValue} onChange={(e) => setEditingExpenseValue(e.target.value)} className="flex-1 bg-zinc-900 border border-emerald-500 rounded px-2 py-1 text-xs text-white outline-none" />
                                      <button onClick={() => { 
                                         if(editingExpenseValue.trim() && editingExpenseValue !== en) {
                                            const newVal = editingExpenseValue.trim();
                                            setLocalFixedExpenses(localFixedExpenses.map(e => e.name === en ? { ...e, name: newVal } : e));
                                            setCustomExpenseNames(customExpenseNames.map(n => n === en ? newVal : n));
                                            if (selectedExpenseName === en) setSelectedExpenseName(newVal);
                                            const oldCols = expenseColumns[en];
                                            if (oldCols) {
                                               const newCols = {...expenseColumns};
                                               newCols[newVal] = oldCols;
                                               delete newCols[en];
                                               setExpenseColumns(newCols);
                                            }
                                         }
                                         setEditingExpense(null);
                                      }} className="px-3 py-1 bg-emerald-500/20 text-emerald-500 rounded text-[10px] font-bold uppercase hover:bg-emerald-500/30">Save</button>
                                      <button onClick={() => setEditingExpense(null)} className="px-3 py-1 bg-zinc-800 text-zinc-400 rounded text-[10px] font-bold uppercase hover:bg-zinc-700">Cancel</button>
                                   </div>
                                ) : (
                                   <div className="text-sm font-bold text-zinc-200">{en}</div>
                                )}
                                {!editingExpense && (
                                   <div className="flex items-center gap-2">
                                      <button onClick={() => { setEditingExpense(en); setEditingExpenseValue(en); }} className="text-zinc-500 hover:text-sky-500 transition-colors p-1.5 hover:bg-sky-500/10 rounded"><Edit2 size={14} /></button>
                                      <button onClick={() => {
                                         setLocalFixedExpenses(localFixedExpenses.filter(e => e.name !== en));
                                         setCustomExpenseNames(customExpenseNames.filter(n => n !== en));
                                         if (selectedExpenseName === en) setSelectedExpenseName(fixedExpenseNames.filter(n => n !== en)[0] || '');
                                      }} className="text-zinc-500 hover:text-rose-500 transition-colors p-1.5 hover:bg-rose-500/10 rounded"><Trash2 size={14} /></button>
                                   </div>
                                )}
                             </div>
                             {editingExpense === en && (
                                <div className="flex flex-wrap items-center gap-4 mt-2 pt-2 border-t border-zinc-800/30">
                                   <span className="text-[10px] font-bold text-zinc-500 uppercase">Visible columns:</span>
                                   {(() => {
                                      const defaultCols = ['CPM', 'Plates', 'Factoring'].includes(en) ? ['valid_from', 'valid_to', 'amount'] : ['valid_from', 'valid_to', 'amount', 'unit'];
                                      const activeColumns = (expenseColumns[en] || defaultCols).filter(c => !(['CPM', 'Plates', 'Factoring'].includes(en) && c === 'unit'));
                                      const toggleColumn = (col: string) => {
                                          if (activeColumns.includes(col)) {
                                              setExpenseColumns({...expenseColumns, [en]: activeColumns.filter(c => c !== col)});
                                          } else {
                                              setExpenseColumns({...expenseColumns, [en]: [...activeColumns, col]});
                                          }
                                      };
                                      const allPossibleCols = [
                                         { id: 'valid_from', label: 'Valid From' },
                                         { id: 'valid_to', label: 'Valid To' },
                                         { id: 'amount_before', label: 'Amount Before' },
                                         { id: 'amount_after', label: 'Amount After' },
                                         { id: 'amount', label: 'Amount' },
                                         ...(['CPM', 'Plates', 'Factoring'].includes(en) ? [] : [{ id: 'unit', label: 'Unit' }])
                                      ];
                                      return allPossibleCols.map(col => (
                                          <label key={col.id} className="flex items-center gap-1.5 cursor-pointer">
                                                  <input type="checkbox" checked={activeColumns.includes(col.id)} onChange={() => toggleColumn(col.id)} className="w-3 h-3 accent-emerald-500" />
                                                  <span className="text-[10px] text-zinc-400 select-none">{col.label}</span>
                                              </label>
                                          ));
                                       })()}
                                       
                                    </div>
                                 )}
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
       )}
        
        {reductionModal?.isOpen && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950">
                        <div className="flex items-center gap-2 text-rose-500">
                            <Settings size={20} />
                            <h3 className="font-bold text-sm uppercase tracking-wider">Manage {reductionModal.expenseName} Reductions</h3>
                        </div>
                        <button onClick={() => { setReductionModal(null); setEditingReduction(null); }} className="text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>
                    </div>
                    <div className="p-4 flex items-end gap-3">
                        <div className="flex flex-col gap-1.5 w-32 shrink-0">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Apply To</label>
                            <select value={reductionForm.type} onChange={(e) => setReductionForm({...reductionForm, type: e.target.value, target: ''})} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-rose-500 outline-none h-8">
                                <option value="ALL">For ALL (Global)</option>
                                <option value="COMPANY">For Company</option>
                                <option value="CONTRACT">For Contract</option>
                            </select>
                        </div>
                        {reductionForm.type === 'COMPANY' && (
                            <div className="flex flex-col gap-1.5 w-32 shrink-0">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Select Company</label>
                                <select value={reductionForm.target} onChange={(e) => setReductionForm({...reductionForm, target: e.target.value})} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-amber-500 focus:border-rose-500 outline-none h-8">
                                    <option value="" disabled>Select...</option>
                                    {allCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        )}
                        {reductionForm.type === 'CONTRACT' && (
                            <div className="flex flex-col gap-1.5 w-32 shrink-0">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Select Contract</label>
                                <select value={reductionForm.target} onChange={(e) => setReductionForm({...reductionForm, target: e.target.value})} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-purple-500 focus:border-rose-500 outline-none h-8">
                                    <option value="" disabled>Select...</option>
                                    {availableContractTypes.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="flex flex-col gap-1.5 flex-1 min-w-[100px]">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Valid From</label>
                            <input type="date" value={reductionForm.validFrom} onChange={(e) => setReductionForm({...reductionForm, validFrom: enforceDayOfWeek(e.target.value, 2)})} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-rose-500 outline-none h-8" />
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1 min-w-[100px]">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Valid To</label>
                            <input type="date" value={reductionForm.validTo} onChange={(e) => setReductionForm({...reductionForm, validTo: enforceDayOfWeek(e.target.value, 1)})} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-rose-500 outline-none h-8" />
                        </div>
                        <div className="flex flex-col gap-1.5 w-24 shrink-0">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Amount</label>
                            <div className="relative">
                                <span className="absolute left-2 top-1.5 text-zinc-500 text-xs pointer-events-none">$</span>
                                <input type="number" value={reductionForm.amount} onChange={(e) => setReductionForm({...reductionForm, amount: e.target.value})} placeholder="e.g. 200" className="w-full bg-zinc-950 border border-zinc-700 rounded py-1 pl-5 pr-2 text-xs text-zinc-200 focus:border-rose-500 outline-none font-mono h-8" />
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex justify-between items-start gap-4">
                        <div className="flex flex-col gap-1.5 flex-1 max-w-md">
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Note (Optional)</label>
                                <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5">
                                    <button onClick={() => { document.execCommand('bold'); setIsBoldActive(document.queryCommandState('bold')); }} className={`p-1 rounded transition-colors ${isBoldActive ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-700 hover:text-white'}`} title="Bold"><Bold size={12}/></button>
                                    <button onClick={() => { document.execCommand('italic'); setIsItalicActive(document.queryCommandState('italic')); }} className={`p-1 rounded transition-colors ${isItalicActive ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-700 hover:text-white'}`} title="Italic"><Italic size={12}/></button>
                                    <button onClick={() => { document.execCommand('underline'); setIsUnderlineActive(document.queryCommandState('underline')); }} className={`p-1 rounded transition-colors ${isUnderlineActive ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-700 hover:text-white'}`} title="Underline"><Underline size={12}/></button>
                                    <div className="w-[1px] h-3 bg-zinc-700 mx-0.5"></div>
                                    <button onClick={() => { document.execCommand('insertUnorderedList'); reductionNoteRef.current?.focus(); }} className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors" title="Bullet List"><List size={12}/></button>
                                    <button onClick={() => { document.execCommand('insertOrderedList'); reductionNoteRef.current?.focus(); }} className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors" title="Numbered List"><ListOrdered size={12}/></button>
                                    <div className="w-[1px] h-3 bg-zinc-700 mx-0.5"></div>
                                    <label className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white cursor-pointer relative overflow-hidden transition-colors" title="Text Color">
                                        <Palette size={12}/>
                                        <input type="color" onBlur={(e) => document.execCommand('foreColor', false, e.target.value)} className="absolute opacity-0 w-full h-full cursor-pointer top-0 left-0" />
                                    </label>
                                </div>
                            </div>
                            <div 
                                ref={reductionNoteRef}
                                contentEditable
                                suppressContentEditableWarning={true}
                                onMouseUp={() => {
                                    setIsBoldActive(document.queryCommandState('bold'));
                                    setIsItalicActive(document.queryCommandState('italic'));
                                    setIsUnderlineActive(document.queryCommandState('underline'));
                                }}
                                onKeyUp={(e) => {
                                    setIsBoldActive(document.queryCommandState('bold'));
                                    setIsItalicActive(document.queryCommandState('italic'));
                                    setIsUnderlineActive(document.queryCommandState('underline'));
                                    const sel = window.getSelection();
                                    if (sel && sel.rangeCount > 0) {
                                        const node = sel.focusNode;
                                        if (node && node.nodeType === 3 && node.textContent === '- ') {
                                            node.textContent = '';
                                            document.execCommand('insertUnorderedList');
                                        }
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Tab') {
                                        e.preventDefault();
                                        document.execCommand('indent');
                                    }
                                }}
                                className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-zinc-200 focus:border-rose-500 outline-none min-h-[60px] max-h-[200px] overflow-y-auto [&_ul]:list-disc [&_ul]:pl-5 [&_ul_ul]:list-[circle] [&_ol]:list-decimal [&_ol]:pl-5"
                                style={{ resize: 'vertical' }}
                            />
                        </div>
                        <div className="flex items-center gap-2 mt-6">
                            <button onClick={() => { setReductionModal(null); setEditingReduction(null); if (reductionNoteRef.current) reductionNoteRef.current.innerHTML = ''; }} className="px-4 py-2 rounded bg-zinc-800 text-zinc-400 hover:text-white font-bold text-xs transition-colors">Cancel</button>
                            <button onClick={handleApplyReduction} className="px-6 py-2 rounded bg-rose-500/20 text-rose-500 hover:bg-rose-500/30 font-bold text-xs transition-colors whitespace-nowrap">{editingReduction ? 'Save Changes' : 'Apply Reduction'}</button>
                        </div>
                    </div>
                    <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Active Reductions</h4>
                        <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
                            {(() => {
                                if (!reductionModal) return null;
                                const rKey = reductionModal.expenseKey === 'avg_truck_price' ? 'truck_reduction' : 'trailer_reduction';
                                const activeReductions: { groupIds?: string[], source: 'fixed' | 'fin', label: string, date: string, amount: number, raw: any }[] = [];
                                
                                const fixedReductions = localFixedExpenses.filter(e => e.name === reductionModal.expenseName && (e as any)[rKey]);
                                const groupedFixed: Record<string, any[]> = {};
                                fixedReductions.forEach(e => {
                                    const type = e.companyId === 'ALL' ? 'ALL' : ((e as any).contractType ? 'CONTRACT' : 'COMPANY');
                                    const target = e.companyId === 'ALL' ? 'ALL' : ((e as any).contractType ? (e as any).contractType : e.companyId);
                                    const amt = Number((e as any)[rKey]);
                                    const key = `${type}_${target}_${amt}`;
                                    if (!groupedFixed[key]) groupedFixed[key] = [];
                                    groupedFixed[key].push(e);
                                });

                                Object.keys(groupedFixed).forEach(key => {
                                    const list = groupedFixed[key].sort((a, b) => new Date(a.valid_from || 0).getTime() - new Date(b.valid_from || 0).getTime());
                                    let currentGroup: any = null;
                                    list.forEach(e => {
                                        if (!currentGroup) {
                                            currentGroup = { ...e, ids: [String(e.id)] };
                                        } else {
                                            const eFrom = new Date(e.valid_from).getTime();
                                            const prevTo = currentGroup.valid_to ? new Date(currentGroup.valid_to).getTime() : eFrom;
                                            const daysDiff = Math.abs(Math.round((eFrom - prevTo) / (1000 * 3600 * 24)));
                                            if (daysDiff <= 15) {
                                                currentGroup.valid_to = e.valid_to || currentGroup.valid_to;
                                                currentGroup.ids.push(String(e.id));
                                            } else {
                                                const typeLabel = currentGroup.companyId === 'ALL' ? 'Global' : ((currentGroup as any).contractType ? `Contract: ${(currentGroup as any).contractType}` : `Company: ${currentGroup.companyId}`);
                                                const type = currentGroup.companyId === 'ALL' ? 'ALL' : ((currentGroup as any).contractType ? 'CONTRACT' : 'COMPANY');
                                                const target = currentGroup.companyId === 'ALL' ? '' : ((currentGroup as any).contractType ? (currentGroup as any).contractType : currentGroup.companyId);
                                                activeReductions.push({ groupIds: currentGroup.ids, source: 'fixed', label: typeLabel, date: `${currentGroup.valid_from} - ${!currentGroup.valid_to || currentGroup.valid_to === '2099-12-31' ? 'Now' : currentGroup.valid_to}`, amount: Number((currentGroup as any)[rKey]), raw: { type, target, validFrom: currentGroup.valid_from, validTo: currentGroup.valid_to || '', note: (currentGroup as any)[`${rKey}_note`] || '' } });
                                                currentGroup = { ...e, ids: [String(e.id)] };
                                            }
                                        }
                                    });
                                    if (currentGroup) {
                                        const typeLabel = currentGroup.companyId === 'ALL' ? 'Global' : ((currentGroup as any).contractType ? `Contract: ${(currentGroup as any).contractType}` : `Company: ${currentGroup.companyId}`);
                                        const type = currentGroup.companyId === 'ALL' ? 'ALL' : ((currentGroup as any).contractType ? 'CONTRACT' : 'COMPANY');
                                        const target = currentGroup.companyId === 'ALL' ? '' : ((currentGroup as any).contractType ? (currentGroup as any).contractType : currentGroup.companyId);
                                        activeReductions.push({ groupIds: currentGroup.ids, source: 'fixed', label: typeLabel, date: `${currentGroup.valid_from} - ${!currentGroup.valid_to || currentGroup.valid_to === '2099-12-31' ? 'Now' : currentGroup.valid_to}`, amount: Number((currentGroup as any)[rKey]), raw: { type, target, validFrom: currentGroup.valid_from, validTo: currentGroup.valid_to || '', note: (currentGroup as any)[`${rKey}_note`] || '' } });
                                    }
                                });

                                const finReductions = finImportData.filter(d => {
                                    if (!(d as any)[rKey]) return false;
                                    const dDate = new Date(d.week_ending);
                                    const vfObj = new Date(dDate); vfObj.setUTCDate(dDate.getUTCDate() - 5);
                                    const vfStr = vfObj.toISOString().split('T')[0];
                                    const vtStr = (d as any).valid_to || d.week_ending;
                                    const isCovered = localFixedExpenses.some(e => {
                                        if (e.name !== reductionModal.expenseName) return false;
                                        if (e.companyId !== 'ALL') return false;
                                        if (!(e as any)[rKey]) return false;
                                        const eFrom = e.valid_from || '2000-01-01';
                                        const eTo = e.valid_to || '2099-12-31';
                                        return eFrom <= vtStr && eTo >= vfStr && Number((e as any)[rKey]) === Number((d as any)[rKey]);
                                    });
                                    return !isCovered;
                                }).sort((a, b) => {
                                    const dateA = a.week_ending.split('T')[0];
                                    const dateB = b.week_ending.split('T')[0];
                                    return new Date(dateA).getTime() - new Date(dateB).getTime();
                                });
                                let currentFinGroup: any = null;
                                finReductions.forEach(d => {
                                    const amt = Number((d as any)[rKey]);
                                    const dDateStr = d.week_ending.split('T')[0];
                                    if (!currentFinGroup) {
                                        currentFinGroup = { amount: amt, start: dDateStr, end: dDateStr, ids: [String(d.id)] };
                                    } else {
                                        const dDate = new Date(dDateStr).getTime();
                                        const prevDate = new Date(currentFinGroup.end).getTime();
                                        const daysDiff = Math.abs(Math.round((dDate - prevDate) / (1000 * 3600 * 24)));
                                        if (currentFinGroup.amount === amt && daysDiff <= 15) {
                                            currentFinGroup.end = dDateStr;
                                            currentFinGroup.ids.push(String(d.id));
                                        } else {
                                            const startObj = new Date(currentFinGroup.start);
                                            startObj.setUTCDate(startObj.getUTCDate() - 5);
                                            const startStr = startObj.toISOString().split('T')[0];
                                            activeReductions.push({ groupIds: currentFinGroup.ids, source: 'fin', label: 'Global (Unsaved)', date: `${startStr} - ${!currentFinGroup.end || currentFinGroup.end === '2099-12-31' ? 'Now' : currentFinGroup.end}`, amount: currentFinGroup.amount, raw: { type: 'ALL', target: '', validFrom: startStr, validTo: currentFinGroup.end, note: '' } });
                                            currentFinGroup = { amount: amt, start: dDateStr, end: dDateStr, ids: [String(d.id)] };
                                        }
                                    }
                                });
                                if (currentFinGroup) {
                                    const startObj = new Date(currentFinGroup.start);
                                    startObj.setUTCDate(startObj.getUTCDate() - 5);
                                    const startStr = startObj.toISOString().split('T')[0];
                                    activeReductions.push({ groupIds: currentFinGroup.ids, source: 'fin', label: 'Global (Unsaved)', date: `${startStr} - ${!currentFinGroup.end || currentFinGroup.end === '2099-12-31' ? 'Now' : currentFinGroup.end}`, amount: currentFinGroup.amount, raw: { type: 'ALL', target: '', validFrom: startStr, validTo: currentFinGroup.end, note: '' } });
                                }

                                if (activeReductions.length === 0) return <div className="text-[10px] text-zinc-500 italic">No active reductions found.</div>;

                                return activeReductions.map((r, i) => (
                                    <div key={i} className={`flex items-center justify-between bg-zinc-950 border ${editingReduction?.groupIds.join(',') === r.groupIds?.join(',') ? 'border-sky-500/50' : 'border-zinc-800'} rounded p-2 transition-colors`}>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] font-bold text-zinc-300">{r.label}</span>
                                            <span className="text-[9px] text-zinc-500">{r.date}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold font-mono text-zinc-400 mr-2">-${Math.round(r.amount)}</span>
                                            <button onClick={() => {
                                                setReductionForm({ type: r.raw.type, target: r.raw.target, validFrom: r.raw.validFrom, validTo: r.raw.validTo, amount: String(r.amount), note: r.raw.note || '' });
                                                setEditingReduction({ source: r.source as 'fixed' | 'fin', groupIds: r.groupIds! });
                                                if (reductionNoteRef.current) reductionNoteRef.current.innerHTML = r.raw.note || '';
                                            }} className={`p-1 transition-colors ${editingReduction?.groupIds.join(',') === r.groupIds?.join(',') ? 'text-sky-500 bg-sky-500/10 rounded' : 'text-zinc-500 hover:text-sky-500'}`}><Edit2 size={14}/></button>
                                            <button onClick={() => {
                                                if (r.source === 'fixed' && r.groupIds) {
                                                    setLocalFixedExpenses(prev => {
                                                        const next = prev.map(e => r.groupIds!.includes(String(e.id)) ? { ...e, [rKey]: null } : e);
                                                        return next.filter(e => !(r.groupIds!.includes(String(e.id)) && ((e as any).is_dummy || Number(e.amount || 0) === 0)));
                                                    });
                                                    if (r.raw.type === 'ALL') {
                                                        setFinImportData(prev => {
                                                            let modIds: string[] = [];
                                                            const newData = prev.map(d => {
                                                                const dDate = new Date(d.week_ending);
                                                                const vfObj = new Date(dDate); vfObj.setUTCDate(dDate.getUTCDate() - 5);
                                                                const vfStr = vfObj.toISOString().split('T')[0];
                                                                const vtStr = (d as any).valid_to || d.week_ending;
                                                                const rTo = r.raw.validTo || '2099-12-31';
                                                                if (vfStr <= rTo && vtStr >= r.raw.validFrom && (d as any)[rKey] === r.amount) {
                                                                    modIds.push(String(d.id));
                                                                    return { ...d, [rKey]: null };
                                                                }
                                                                return d;
                                                            });
                                                            if (modIds.length > 0) setModifiedFinImportIds(m => Array.from(new Set([...m, ...modIds])));
                                                            return newData;
                                                        });
                                                    }
                                                } else if (r.source === 'fin' && r.groupIds) {
                                                    setFinImportData(prev => prev.map(d => r.groupIds!.includes(String(d.id)) ? { ...d, [rKey]: null } : d));
                                                    setModifiedFinImportIds(prev => Array.from(new Set([...prev, ...r.groupIds!])));
                                                }
                                                if (editingReduction?.groupIds.join(',') === r.groupIds?.join(',')) setEditingReduction(null);
                                            }} className="text-zinc-500 hover:text-rose-500 transition-colors p-1"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {customAlert?.isOpen && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-lg shadow-2xl w-96 flex flex-col gap-4">
                    <div className="flex items-center gap-3 text-rose-500">
                        <Info size={24} />
                        <h3 className="font-bold text-lg">{customAlert.title}</h3>
                    </div>
                    <p className="text-zinc-300 text-sm">{customAlert.message}</p>
                    <div className="flex justify-end mt-2">
                        <button onClick={() => setCustomAlert(null)} className="px-4 py-2 rounded bg-zinc-800 text-zinc-300 hover:text-white font-bold text-xs transition-colors">Close</button>
                    </div>
                </div>
            </div>
        )}
        
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
        <TutorialModal isOpen={tutorialState.isOpen} onClose={() => setTutorialState({ isOpen: false, type: null })} activeTab={activeTab} tutorialType={tutorialState.type} />
      </div>
    </div>
  );
};

export default SimulationModal;