import React from 'react';
import { X, Save, Sliders, Plus, Trash2, ChevronDown, Settings, Edit2, Info, CornerDownRight, Eye, EyeOff } from 'lucide-react';
import { formatCurrency } from '../utils';
import { supabase } from '../lib/supabase';
import RevenueCpm from './RevenueCpm';
import PnlEditor from './PnlEditor';
import { SimulationConfig, ExpenseItem, ConfigContract, PnlConfig } from '../types';

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
  fixedCostsData
}) => {
  const [localSimConfig, setLocalSimConfig] = React.useState<SimulationConfig>(simulationConfig);
  const [localFixedExpenses, setLocalFixedExpenses] = React.useState<ExpenseItem[]>(fixedExpenses);
  const [localConfigContracts, setLocalConfigContracts] = React.useState<ConfigContract[]>(configContracts || []);
  const [isSaving, setIsSaving] = React.useState(false);
  const [loadingMessage, setLoadingMessage] = React.useState('Saving...');
  const [activeTab, setActiveTab] = React.useState<'fixed' | 'contracts' | 'dispatcher' | 'cpm' | 'pnl'>('fixed');
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

  const [finImportData, setFinImportData] = React.useState<any[]>([]);
  const [finImportPerUnitData, setFinImportPerUnitData] = React.useState<any[]>([]);
  const [modifiedFinImportIds, setModifiedFinImportIds] = React.useState<string[]>([]);
  const [newFinDates, setNewFinDates] = React.useState<Record<string, string>>({});
  const [newFinToDates, setNewFinToDates] = React.useState<Record<string, string>>({});
  const [expandedMclooRules, setExpandedMclooRules] = React.useState<string[]>([]);
  const [mclooEditModes, setMclooEditModes] = React.useState<Record<string, 'shared' | 'base'>>({});
  const [expandedDphRules, setExpandedDphRules] = React.useState<string[]>([]);
  const [mclooSelectedDates, setMclooSelectedDates] = React.useState<Record<string, string>>({});
  const [hideOverriddenRules, setHideOverriddenRules] = React.useState(true);
  const [customAlert, setCustomAlert] = React.useState<{ isOpen: boolean, message: string, title: string } | null>(null);
  const toggleMclooRule = (id: string) => setExpandedMclooRules(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleDphRule = (id: string) => setExpandedDphRules(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const finImportKeys = [
{ name: 'Liability Insurance (Auto)', key: 'liability_insurance', puKey: 'liability' },
{ name: 'Liability Insurance (General)', key: 'liability_insurance_general', puKey: 'liability_general' },
{ name: 'Cargo Insurance', key: 'cargo_insurance', puKey: 'cargo_w_per_unit' },
{ name: 'Trailer Interchange', key: 'trailer_interchange', puKey: 'trailer_interchange_w_per_unit' },
{ name: 'LAGO', key: 'lago', puKey: 'lago_w_per_unit' },
{ name: 'PD Premium', key: 'physical_damage_premium', puKey: 'phd_premium_w_per_unit' },
{ name: 'Physical Damage', key: 'physical_damage', puKey: 'phd_w_per_unit' },
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

const availableContractTypes = Array.from(new Set(['MCLOO', 'LOO', 'LPOO', 'OO', 'MCOO', 'POG', 'TPOG', 'CPM', 'TPOG WITH FRANCHISE', ...localConfigContracts.map(c => c.contract_type)])).filter(Boolean);

const fixedExpenseNames = Array.from(new Set([
'Plates', 'Factoring', 
...localFixedExpenses.map(e => e.name), 
...customExpenseNames
])).filter(Boolean);

  const filteredFixedNames = fixedExpenseNames.filter(name => !finImportKeys.some(fi => fi.name === name) && name !== 'Liability Insurance (Global)' && name !== 'Dispatcher Pay' && name !== 'Revenue CPM');

  const unifiedExpenses = [
    ...filteredFixedNames.map(name => ({ type: 'FIXED', name, key: '', puKey: '' })),
    ...finImportKeys.map(fi => ({ type: 'FINIMPORT', name: fi.name, key: fi.key, puKey: fi.puKey }))
  ];

  React.useEffect(() => {
        if (isOpen) {
          setLocalSimConfig(simulationConfig);
          setLocalFixedExpenses([...fixedExpenses].map(e => {
              const mapped: any = { ...e, original_valid_from: e.valid_from };
              if (mapped.name === 'Liability Insurance') mapped.name = 'Liability Insurance (Auto)';
              if (mapped.contract_type) {
                  mapped.contractType = mapped.contract_type;
              }
              return mapped;
          }).sort((a, b) => {
              if (a.companyId === 'ALL' && b.companyId !== 'ALL') return -1;
              if (a.companyId !== 'ALL' && b.companyId === 'ALL') return 1;
              const dateA = a.valid_from ? new Date(a.valid_from).getTime() : 0;
              const dateB = b.valid_from ? new Date(b.valid_from).getTime() : 0;
              return dateB - dateA;
          }));
          setLocalConfigContracts(configContracts || []);

          const fetchFinData = async () => {
             const { data: importData } = await supabase.from('finImport').select('*').order('week_ending', { ascending: false });
             const { data: perUnitData } = await supabase.from('fin_import_per_unit_view').select('*').order('week_ending', { ascending: false });
             
             if (importData) {
                setFinImportData(importData);
             }
             if (perUnitData) {
                setFinImportPerUnitData(perUnitData);
             }
             
             const { fetchPnlConfigs } = await import('../lib/supabase');
             const loadedPnlConfigs = await fetchPnlConfigs();
             setPnlConfigs(loadedPnlConfigs);
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
     setLocalFixedExpenses(prev => prev.filter(e => String(e.id) !== String(id)));
  };

  const handleResetFinImportCustom = (recordId: string, expenseKey: string, expenseName: string) => {
       setFinImportData(prev => prev.map(d => d.id === recordId ? {
            ...d,
            [`is_custom_${expenseKey}`]: false,
            [`custom_cpm_${expenseKey}`]: undefined,
            [expenseKey]: d[`original_${expenseKey}`] !== undefined ? d[`original_${expenseKey}`] : d[expenseKey]
        } : d));
      if (!modifiedFinImportIds.includes(String(recordId))) setModifiedFinImportIds(prev => [...prev, String(recordId)]);
      
      const dObj = finImportData.find(d => d.id === recordId);
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
              let finalVal = val;
              if (key !== 'franchise_charge' && key !== 'shared_insurance') {
                  finalVal = parseFloat(val) || 0;
              }
              return { ...d, [key]: finalVal };
          }
          return d;
      }));
      if (!modifiedFinImportIds.includes(String(id))) {
          setModifiedFinImportIds(prev => [...prev, String(id)]);
      }
  };

  const handleAddFinImportDate = async (expName: string) => {
          const fromDateStr = newFinDates[expName];
          if (!fromDateStr) {
              setCustomAlert({
                  isOpen: true,
                  title: 'Missing Date',
                  message: 'Please select a "Valid From" date before adding a rule.'
              });
              return;
          }

          const toDateStr = newFinToDates[expName] || '';

          const fromTime = new Date(fromDateStr).getTime();
          const toTime = toDateStr ? new Date(toDateStr).getTime() : Infinity;
          
          const hasOverlap = localFixedExpenses.some(e => {
              if (e.name !== expName || e.companyId !== 'ALL') return false;
              const eFrom = e.valid_from ? new Date(e.valid_from).getTime() : -Infinity;
              const eTo = e.valid_to ? new Date(e.valid_to).getTime() : Infinity;
              
              return Math.max(fromTime, eFrom) <= Math.min(toTime, eTo);
          });

          if (hasOverlap) {
              setCustomAlert({
                  isOpen: true,
                  title: 'Warning',
                  message: `A global expense for "${expName}" covering the selected dates already exists. Please modify the existing one or choose different dates.`
              });
              setNewFinDates(prev => ({ ...prev, [expName]: '' }));
              setNewFinToDates(prev => ({ ...prev, [expName]: '' }));
              return;
          }

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

          setNewFinDates(prev => ({ ...prev, [expName]: '' }));
          setNewFinToDates(prev => ({ ...prev, [expName]: '' }));
      };

  const handleSaveAndClose = async () => {
    setIsSaving(true);
    setLoadingMessage("Clearing old data...");
    
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      setLoadingMessage("Recalculating and syncing...");

      let rawFinalExpenses: ExpenseItem[] = [...localFixedExpenses];

          finImportData.forEach(d => {
              finImportKeys.forEach(fi => {
                  const hasCustomAmount = (d as any)[`is_custom_${fi.key}`] === true;
                  const hasCustomPercentages = (fi.key === 'liability_insurance' && (d as any).shared_insurance !== undefined) || 
                                               (fi.key === 'avg_truck_price' && (d as any).franchise_charge !== undefined);

                  if (hasCustomAmount || hasCustomPercentages) {
                       const customVal = hasCustomAmount ? (Number((d as any)[`custom_val_${fi.key}`]) || 0) : Number((d as any)[fi.key] || 0);
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
                           if (fi.key === 'liability_insurance') {
                               if ((d as any).shared_insurance !== undefined) newExp.shared_insurance = (d as any).shared_insurance;
                           }
                           if (fi.key === 'avg_truck_price') {
                               if ((d as any).franchise_charge !== undefined) newExp.franchise_charge = (d as any).franchise_charge;
                           }
                           if (!hasCustomAmount && fi.key === 'avg_truck_price') newExp.is_dummy = true;
                          rawFinalExpenses.push(newExp);
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
          if (!(exp as any).is_dummy) {
              expandedFinalExpenses.push(exp);
          }
      
      });
      
      const deletedIds = fixedExpenses
        .filter(oe => !expandedFinalExpenses.some(fe => String(fe.id) === String(oe.id)))
        .map(oe => oe.id);

      if (deletedIds.length > 0) {
        await supabase.from('fixed_expenses').delete().in('id', deletedIds);
      }

      const expensesToSave = expandedFinalExpenses.map(exp => ({
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
              shared_insurance: ((exp as any).shared_insurance !== undefined && (exp as any).shared_insurance !== null && String((exp as any).shared_insurance).trim() !== '') ? Number((exp as any).shared_insurance) : null,
              company_base_for_mcloo: ((exp as any).company_base_for_mcloo !== undefined && (exp as any).company_base_for_mcloo !== null && String((exp as any).company_base_for_mcloo).trim() !== '') ? Number((exp as any).company_base_for_mcloo) : null,
              franchise_charge: (exp as any).franchise_charge !== undefined && (exp as any).franchise_charge !== null ? Number((exp as any).franchise_charge) : null,
              revenue_cpm: (exp as any).revenue_cpm !== undefined && (exp as any).revenue_cpm !== null && String((exp as any).revenue_cpm).trim() !== '' ? Number((exp as any).revenue_cpm) : null
          }));
      if (expensesToSave.length > 0) {
          const { error } = await supabase.from('fixed_expenses').upsert(expensesToSave, { onConflict: 'id' });
          if (error) {
              console.error("Error saving fixed expenses:", error);
          }
      }

      if (onSaveExpenses) {
        await onSaveExpenses(expandedFinalExpenses);
      }

      const { saveConfigContracts, savePnlConfigs } = await import('../lib/supabase');
      const cleanContracts = localConfigContracts.map(c => ({
          ...c,
          valid_from: c.valid_from && String(c.valid_from).trim() !== '' ? c.valid_from : null,
          valid_to: c.valid_to && String(c.valid_to).trim() !== '' ? c.valid_to : null
      }));
      await saveConfigContracts(cleanContracts);
      await savePnlConfigs(pnlConfigs);

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
      setFixedExpenses(expandedFinalExpenses);
      if (setConfigContracts) {
          setConfigContracts(localConfigContracts);
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
          <button onClick={onClose} disabled={isSaving} className="text-zinc-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <X size={24} />
          </button>
        </div>

        <div className="flex px-6 pt-2 border-b border-zinc-800 gap-2 bg-zinc-950 overflow-x-auto flex-shrink-0">
            <button onClick={() => setActiveTab('fixed')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'fixed' ? 'border-blue-500 text-blue-500' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>Expenses</button>
            <button onClick={() => setActiveTab('contracts')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'contracts' ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>Contract Rules</button>
            <button onClick={() => setActiveTab('dispatcher')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'dispatcher' ? 'border-purple-500 text-purple-500' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>Dispatcher Pay</button>
            <button onClick={() => setActiveTab('cpm')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'cpm' ? 'border-pink-500 text-pink-500' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>CPM REVENUE</button>
            <button onClick={() => setActiveTab('pnl')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${activeTab === 'pnl' ? 'border-cyan-500 text-cyan-500' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>PNL CALCULATION</button>
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
                                                                  if (ct === 'TPOG' || ct === 'TPOG WITH FRANCHISE') {
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
                                                                              <option value="TPOG_NONF">Classic TPOG</option>
                                                                              <option value="TPOG_FRANCHISE">TPOG With Franchise Formula</option>
                                                                              <option value="NEW_FORMULA">New TPOG Formula</option>
                                                                           </select>
                                                                           <div className="flex items-center whitespace-nowrap text-[11px] text-zinc-300 font-mono bg-zinc-900/50 pl-3 pr-6 pt-4 pb-1.5 rounded border border-zinc-800 w-max relative z-10">
                                                                              {calcType === 'NEW_FORMULA' ? (
                                                                                  <>({mcGrossInput} * (Gross + Margin - (Margin * {mcMarginInput}))) - (Drv% * Gross) - (Gross * {dispGrossInput} + Margin * {dispMarginInput})</>
                                                                               ) : calcType === 'TPOG_FRANCHISE' ? (
                                                                                 <>
                                                                                    <div className="mt-0.5">(Gross * ((1 - Drv%) - {dispGrossInput}) + Margin * {mcMarginInput})</div>
                                                                                    {splitBlock}
                                                                                 </>
                                                                              ) : (
                                                                                 <>Gross * ((1 - Drv%) - {dispGrossInput}) + Margin * {mcMarginInput}</>
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
                                                                                 <>Gross - Gross Pay - (Gross * {mcGrossInput})</>
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
                                                                  else if (calcType === 'POG_STYLE') content = <>Gross * ((1 - Drv%) - {dispGrossInput}) + Margin * {mcMarginInput}</>;
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
                                                               const defaultCalcType = lastRule ? lastRule.calculation_type : (ct === 'TPOG' ? 'TPOG_NONF' : (ct === 'TPOG WITH FRANCHISE' ? 'TPOG_FRANCHISE' : (ct === 'CPM' ? 'CPM_STYLE' : 'MCLOO_STYLE')));
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
              <div className="max-w-5xl mx-auto space-y-2 -mt-4">
                 <div className="flex items-center justify-between pb-2 border-b border-zinc-800/50 mb-2">
                    <div className="group relative cursor-help text-zinc-500 hover:text-purple-500 transition-colors ml-auto">
                       <Info size={16} />
                       <div className="hidden group-hover:block absolute right-0 top-full mt-2 w-64 bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded shadow-xl normal-case font-normal z-50 pointer-events-none text-left border border-zinc-600">
                          Configure percentages for Dispatcher Gross % and Dispatcher Margin %.
                       </div>
                    </div>
                 </div>
                 <div className="w-full border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/50 p-4">
                    <table className="w-full text-left border-collapse table-fixed">
                       <thead>
                          <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                             <th className="py-2 pr-2 font-bold w-[25%]">Contract</th>
                             <th className="py-2 px-1 font-bold w-[20%]">Valid From</th>
                             <th className="py-2 px-1 font-bold w-[20%]">Valid To</th>
                             <th className="py-2 px-1 font-bold w-[15%]">Gross %</th>
                             <th className="py-2 px-1 font-bold w-[15%]">Margin %</th>
                             <th className="w-[5%]"></th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-zinc-800/30">
                          {localFixedExpenses.filter(e => e.name === 'Dispatcher Pay').map((rule) => (
                             <tr key={rule.id} className="hover:bg-zinc-800/30 transition-colors group/row">
                                <td className="py-2 pr-2">
                                   <select value={(rule as any).contractType || ''} onChange={(e) => handleCompanyExpenseChange(rule.id, 'contractType' as any, e.target.value)} className="w-full bg-zinc-950 border border-purple-700/50 rounded px-2 py-1 text-xs text-purple-500 font-bold focus:border-purple-500 outline-none h-7">
                                      <option value="" disabled>Select Contract</option>
                                      <option value="ALL">ALL</option>
                                      {availableContractTypes.map(c => <option key={c as string} value={c as string}>{c}</option>)}
                                   </select>
                                </td>
                                <td className="py-2 px-1">
                                   <input type="date" value={rule.valid_from || ''} onChange={(e) => handleCompanyExpenseChange(rule.id, 'valid_from', e.target.value)} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-200 focus:border-purple-500 outline-none transition-colors h-7" />
                                </td>
                                <td className="py-2 px-1">
                                   <input type="date" value={rule.valid_to || ''} onChange={(e) => handleCompanyExpenseChange(rule.id, 'valid_to', e.target.value)} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-200 focus:border-purple-500 outline-none transition-colors h-7" />
                                </td>
                                <td className="py-2 px-1">
                                   <div className="relative flex items-center h-7">
                                      <input type="number" step="0.1" value={(rule as any).disp_gross_perc === 0 || (rule as any).disp_gross_perc == null ? '' : (rule as any).disp_gross_perc} onChange={(e) => handleCompanyExpenseChange(rule.id, 'disp_gross_perc' as any, e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded py-1 pl-2 pr-5 text-xs text-zinc-200 font-mono focus:border-purple-500 outline-none h-full" />
                                      <span className="absolute right-2 text-zinc-500 text-[10px] pointer-events-none">%</span>
                                   </div>
                                </td>
                                <td className="py-2 px-1">
                                   <div className="relative flex items-center h-7">
                                      <input type="number" step="0.1" value={(rule as any).disp_margin_perc === 0 || (rule as any).disp_margin_perc == null ? '' : (rule as any).disp_margin_perc} onChange={(e) => handleCompanyExpenseChange(rule.id, 'disp_margin_perc' as any, e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded py-1 pl-2 pr-5 text-xs text-zinc-200 font-mono focus:border-purple-500 outline-none h-full" />
                                      <span className="absolute right-2 text-zinc-500 text-[10px] pointer-events-none">%</span>
                                   </div>
                                </td>
                                <td className="py-2 pl-2 text-right">
                                   <button onClick={() => handleDeleteCompanyExpense(String(rule.id))} className="text-zinc-600 hover:text-rose-500 transition-colors p-1 rounded opacity-0 group-hover/row:opacity-100 flex justify-center items-center w-8 h-7"><Trash2 size={14} /></button>
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
                          disp_gross_perc: 0,
                          disp_margin_perc: 0,
                          unit: '%',
                          frequency: 'Weekly',
                          allocationType: 'divide',
                          valid_from: new Date().toISOString().split('T')[0]
                       };
                       setLocalFixedExpenses(prev => [...prev, newExp as any]);
                    }} className="w-max px-4 py-1.5 border border-dashed border-purple-500/30 bg-purple-500/5 rounded hover:bg-purple-500/10 text-purple-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all mt-3"><Plus size={12} /> ADD RULE</button>
                 </div>
              </div>
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
              <PnlEditor 
                 pnlConfigs={pnlConfigs} 
                 setPnlConfigs={setPnlConfigs} 
                 availableContractTypes={availableContractTypes} 
              />
           </div>

           <div className={activeTab === 'fixed' ? 'block' : 'hidden'}>
           <div className="max-w-6xl mx-auto -mt-4">
              <div className="flex justify-end mb-2">
                 <button onClick={() => setHideOverriddenRules(!hideOverriddenRules)} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded text-[10px] font-bold uppercase transition-colors" title={hideOverriddenRules ? "View default overrides" : "Hide default overrides"}>
                    {hideOverriddenRules ? <EyeOff size={14} /> : <Eye size={14} />}
                    {hideOverriddenRules ? 'Show Overrides' : 'Hide Overrides'}
                 </button>
              </div>
              <div className="w-full border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/50">
                    <table className="w-full text-left border-collapse">
                       <thead>
                                          <tr className="bg-zinc-900 border-b border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                              <th className="p-2 font-bold">Expense Name</th>
                                           </tr>
                                       </thead>
                       <tbody className="divide-y divide-zinc-800">
                          {unifiedExpenses.map(exp => {
                             const isExpanded = selectedExpenseName === exp.name;
                             
                             if (exp.type === 'FIXED') {
                                 const rules = localFixedExpenses.filter(e => e.name === exp.name);
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
                                 
                                 const defaultCols = ['Plates', 'Factoring'].includes(exp.name) ? ['valid_from', 'valid_to', 'amount'] : ['valid_from', 'valid_to', 'amount', 'unit'];
                                 const activeColumns = (expenseColumns[exp.name] || defaultCols).filter(c => !(['Plates', 'Factoring'].includes(exp.name) && c === 'unit'));

                                 return (
                                    <React.Fragment key={exp.name}>
                                       <tr onClick={() => setSelectedExpenseName(isExpanded ? '' : exp.name)} className="cursor-pointer hover:bg-zinc-800/30 transition-colors group">
                                          <td className={`p-3 text-sm font-bold flex items-center gap-2 ${['Plates', 'Factoring'].includes(exp.name) ? 'text-blue-400' : 'text-emerald-500'}`}>
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
                                                         {rules.map(expObj => {
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
                                                                        <input type="number" value={(expObj.amount_before !== undefined && expObj.amount_before !== null && expObj.amount_before !== '') ? Number(expObj.amount_before) : ''} onChange={(e) => handleCompanyExpenseChange(expObj.id, 'amount_before', e.target.value)} className={`w-full bg-zinc-950 border border-zinc-700 rounded py-1 text-xs text-zinc-200 font-mono focus:border-emerald-500 outline-none transition-colors h-full pl-5 pr-2`} />
                                                                     </div>
                                                                  </td>
                                                               )}
                                                               {activeColumns.includes('amount_after') && (
                                                                  <td className="py-1.5 px-2">
                                                                     <div className="relative flex items-center h-7">
                                                                        <span className="absolute left-2 text-zinc-500 text-xs pointer-events-none">{expObj.unit === '%' ? '%' : '$'}</span>
                                                                        <input type="number" value={(expObj.amount_after !== undefined && expObj.amount_after !== null && expObj.amount_after !== '') ? Number(expObj.amount_after) : ''} onChange={(e) => handleCompanyExpenseChange(expObj.id, 'amount_after', e.target.value)} className={`w-full bg-zinc-950 border border-zinc-700 rounded py-1 text-xs text-zinc-200 font-mono focus:border-emerald-500 outline-none transition-colors h-full pl-5 pr-2`} />
                                                                     </div>
                                                                  </td>
                                                               )}
                                                               
                                                               {activeColumns.includes('amount') && (
                                                                  <td className="py-1.5 px-2">
                                                                     <div className="relative flex items-center h-7 w-32">
                                                                        <span className="absolute left-2 text-zinc-500 text-xs pointer-events-none">{expObj.unit === '%' ? '%' : '$'}</span>
                                                                        <input type="number" value={(expObj.amount !== undefined && expObj.amount !== null && expObj.amount !== '') ? Number(expObj.amount) : ''} onChange={(e) => handleCompanyExpenseChange(expObj.id, 'amount', e.target.value)} className={`w-full bg-zinc-950 border border-zinc-700 rounded py-1 text-xs text-zinc-200 font-mono focus:border-emerald-500 outline-none transition-colors h-full pl-5 pr-2`} />
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
                                 const exceptionRules = localFixedExpenses.filter(e => e.name === exp.name && !(e.contractType && e.franchise_charge !== undefined && e.franchise_charge !== null && !e.amount && !e.cpm));
                                 const globalRules = [...finImportData];

                                 const uniqueDates = Array.from(new Set([
                                     ...globalRules.map(d => d.week_ending),
                                     ...exceptionRules.filter(e => e.companyId === 'ALL' && !globalRules.some(gr => {
                                         const d = new Date(gr.week_ending);
                                         const vf = new Date(d); vf.setUTCDate(d.getUTCDate() - 5);
                                         return (e.original_valid_from || e.valid_from) === vf.toISOString().split('T')[0];
                                     })).map(e => {
                                         const targetDate = e.original_valid_from || e.valid_from;
                                         if (!targetDate) return null;
                                         const d = new Date(targetDate);
                                         d.setUTCDate(d.getUTCDate() + 5);
                                         return d.toISOString().split('T')[0];
                                     }).filter(Boolean)
                                 ])).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).filter(dateStr => {
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
                                 const globalOverrides = localFixedExpenses.filter(e => e.name === exp.name && e.companyId === 'ALL' && !(e.contractType && e.franchise_charge !== undefined && e.franchise_charge !== null && !e.amount && !e.cpm));
                                 
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
                                         const isComplex = ['Liability Insurance (Auto)', 'Liability Insurance (General)', 'Liability Insurance (Global)', 'Cargo Insurance', 'Trailer Interchange', 'LAGO', 'PD Premium', 'Physical Damage'].includes(matchedExp.name);
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
                                                          <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1">
                                                              <span className="text-[9px] text-zinc-500 uppercase font-bold">From:</span>
                                                              <input 
                                                                  type="date" 
                                                                  value={newFinDates[exp.name] || ''} 
                                                                  onChange={(e) => setNewFinDates(prev => ({ ...prev, [exp.name]: e.target.value }))} 
                                                                  style={{ colorScheme: 'dark' }} 
                                                                  className="bg-transparent border-0 text-xs text-zinc-200 focus:outline-none w-28" 
                                                              />
                                                          </div>
                                                          <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1">
                                                              <span className="text-[9px] text-zinc-500 uppercase font-bold">To:</span>
                                                              <input 
                                                                  type="date" 
                                                                  value={newFinToDates[exp.name] || ''} 
                                                                  onChange={(e) => setNewFinToDates(prev => ({ ...prev, [exp.name]: e.target.value }))} 
                                                                  style={{ colorScheme: 'dark' }} 
                                                                  className="bg-transparent border-0 text-xs text-zinc-200 focus:outline-none w-28" 
                                                              />
                                                          </div>
                                                          <button onClick={() => {
                                                              if (!newFinDates[exp.name]) { alert('Please select a From date first.'); return; }
                                                              handleAddFinImportDate(exp.name);
                                                          }} className="px-3 py-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30 rounded text-[10px] font-bold uppercase transition-colors whitespace-nowrap flex items-center gap-1">
                                                              <Plus size={12}/> ADD GLOBAL RULE
                                                          </button>
                                                          <div className="relative group/dropdown">
                                                             <button className="px-3 py-1 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30 rounded text-[10px] font-bold uppercase transition-colors whitespace-nowrap flex items-center gap-1">
                                                                 <Plus size={12}/> Add Rule For <ChevronDown size={10} />
                                                             </button>
                                                             <div className="absolute hidden group-hover/dropdown:flex flex-col top-full right-0 pt-1 w-max min-w-full z-50">
                                                                <div className="bg-zinc-900 border border-zinc-700 rounded shadow-xl overflow-hidden flex flex-col w-full">
                                                                   <button onClick={() => {
                                                                       if (!newFinDates[exp.name]) { alert('Please select a From date first.'); return; }
                                                                       handleAddFinImportContractException(exp.name, newFinDates[exp.name], newFinToDates[exp.name] || '', 0);
                                                                   }} className="px-4 py-2 text-left text-[10px] font-bold text-purple-500 hover:bg-zinc-800 transition-colors">Contract</button>
                                                                   <button onClick={() => {
                                                                       if (!newFinDates[exp.name]) { alert('Please select a From date first.'); return; }
                                                                       handleAddFinImportException(exp.name, '', newFinDates[exp.name], newFinToDates[exp.name] || '', 0);
                                                                   }} className="px-4 py-2 text-left text-[10px] font-bold text-amber-500 hover:bg-zinc-800 transition-colors">Company</button>
                                                                </div>
                                                             </div>
                                                          </div>
                                                      </div>
                                                   </div>
                                                   <div className="max-h-[400px] overflow-y-auto border border-zinc-800 rounded">
                                                       <table className="w-full text-left border-collapse">
                                                          <thead className="sticky top-0 bg-zinc-900 z-10">
                                                             <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                                                                <th className="py-2 px-3 font-bold w-[12%]">Valid From</th>
                                                                <th className="py-2 px-3 font-bold w-[12%]">Valid To</th>
                                                                <th className="py-2 px-3 font-bold w-[24%]">Type / Company</th>
                                                                <th className="py-2 px-3 font-bold">Amount</th>
                                                                <th className="py-2 px-3 font-bold text-right">Actions</th>
                                                             </tr>
                                                          </thead>
                                                         <tbody className="divide-y divide-zinc-800/30">
                                                     {exceptionRules.filter(e => e.companyId !== 'ALL' && (e.is_standalone || !uniqueDates.some(ds => {
                                                         const dBase = new Date(ds);
                                                         const vfStr = new Date(dBase.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                                                         return (e.original_valid_from || e.valid_from) === vfStr;
                                                     }))).map(cRule => (
                                                          <React.Fragment key={`standalone_${cRule.id}`}>
                                                              <tr className="bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
                                                                  <td className="py-1.5 px-3">
                                                                     <input type="date" value={cRule.valid_from || ''} onChange={(e) => handleCompanyExpenseChange(cRule.id, 'valid_from', e.target.value)} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 outline-none transition-colors h-7" />
                                                                  </td>
                                                                  <td className="py-1.5 px-3">
                                                                     <input type="date" value={cRule.valid_to || ''} onChange={(e) => handleCompanyExpenseChange(cRule.id, 'valid_to', e.target.value)} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 outline-none transition-colors h-7" />
                                                                  </td>
                                                                  <td className="py-1.5 px-3 flex items-center gap-2">
                                                                     {cRule.contractType !== undefined && cRule.contractType !== null ? (
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
                                                                 <td className="py-1.5 px-3">
                                                                       <div className="flex flex-col gap-2">
                                                                          <div className="flex items-start gap-4">
                                                                             <div className="flex items-center gap-2 mt-1">
                                                                                <div className="flex flex-col gap-1 w-32">
                                                                                   <div className="relative flex items-center h-7">
                                                                                      <span className="absolute left-2 text-amber-500/50 text-xs pointer-events-none">$</span>
                                                                                      <input type="number" value={(cRule.amount !== undefined && cRule.amount !== null && cRule.amount !== '') ? Math.round(Number(cRule.amount)) : ((cRule.amount_after !== undefined && cRule.amount_after !== null && cRule.amount_after !== '') ? Math.round(Number(cRule.amount_after)) : '')} onChange={(e) => { handleCompanyExpenseChange(cRule.id, 'amount', e.target.value); handleCompanyExpenseChange(cRule.id, 'amount_after', e.target.value); }} className="w-full bg-zinc-950 border border-amber-700/50 rounded py-1 pl-5 pr-8 text-xs text-zinc-200 font-mono focus:border-amber-500 outline-none h-full" />
                                                                                      {!['liability_insurance', 'liability_insurance_general', 'cargo_insurance', 'trailer_interchange', 'lago', 'physical_damage_premium', 'physical_damage'].includes(exp.key) ? (
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
                                                                                {exp.key === 'avg_truck_price' && (
                                                                                             <>
                                                                                                <span className="text-zinc-500 font-bold text-xs mt-1">+</span>
                                                                                                <div className="relative flex items-center h-7 w-24 mt-1">
                                                                                                   <span className="absolute left-2 text-emerald-500/50 text-xs pointer-events-none">$</span>
                                                                                                   <input type="number" step="0.01" value={cRule.cpm ?? ''} onChange={(e) => handleCompanyExpenseChange(cRule.id, 'cpm', e.target.value)} placeholder="CPM" className="w-full bg-zinc-950 border border-amber-700/50 rounded py-1 pl-5 pr-2 text-xs text-zinc-200 font-mono focus:border-amber-500 outline-none h-full" />
                                                                                                </div>
                                                                                                <button onClick={() => {
                                                                                                    if (!expandedDphRules.includes(String(cRule.id))) {
                                                                                                        let fcArr = (cRule as any).franchise_charge;
                                                                                                        if (fcArr === undefined) {
                                                                                                            const separatedRules = localFixedExpenses.filter(e => e.name === exp.name && e.valid_from === cRule.valid_from && e.companyId === cRule.companyId && e.contractType && e.franchise_charge !== undefined && e.franchise_charge !== null && !e.amount && !e.cpm);
                                                                                                            if (separatedRules.length > 0) {
                                                                                                                fcArr = separatedRules.map(e => ({ contract: e.contractType, amount: e.franchise_charge, dph: (e as any).dph }));
                                                                                                            } else {
                                                                                                                fcArr = [];
                                                                                                            }
                                                                                                        }
                                                                                                        if (typeof fcArr === 'string') { try { fcArr = JSON.parse(fcArr); } catch(e){ fcArr = []; } }
                                                                                                        if (!Array.isArray(fcArr)) fcArr = [];
                                                                                                        if (fcArr.length === 0) {
                                                                                                            handleCompanyExpenseChange(cRule.id, 'franchise_charge' as any, [{ contract: '', amount: '' }]);
                                                                                                        } else {
                                                                                                            handleCompanyExpenseChange(cRule.id, 'franchise_charge' as any, fcArr);
                                                                                                        }
                                                                                                    }
                                                                                                    toggleDphRule(String(cRule.id));
                                                                                                }} className="px-2 py-0.5 bg-amber-950 hover:bg-amber-900 text-amber-500/70 text-[10px] rounded border border-amber-900/50 transition-colors h-max whitespace-nowrap mt-1">
                                                                                                   {expandedDphRules.includes(String(cRule.id)) ? 'Hide dph rule' : 'Edit dph rule'}
                                                                                                </button>
                                                                                             </>
                                                                                          )}
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
                                                                                        <div className="flex flex-col gap-1">
                                                                                              <label className="text-[8px] text-amber-500/70 font-bold uppercase tracking-wider">Edit Mode</label>
                                                                                              <div className="flex items-center gap-3 h-7">
                                                                                                 <label className="flex items-center gap-1.5 cursor-pointer">
                                                                                                    <input type="checkbox" checked={mclooEditModes[cRule.id] ? mclooEditModes[cRule.id] === 'shared' : !((cRule as any).company_base_for_mcloo !== undefined && (cRule as any).company_base_for_mcloo !== null && String((cRule as any).company_base_for_mcloo).trim() !== '')} onChange={() => { setMclooEditModes({...mclooEditModes, [cRule.id]: 'shared'}); handleCompanyExpenseChange(cRule.id, 'company_base_for_mcloo' as any, null); }} className="w-3 h-3 accent-emerald-500" />
                                                                                                    <span className="text-[10px] text-zinc-300">Shared</span>
                                                                                                 </label>
                                                                                                 <label className="flex items-center gap-1.5 cursor-pointer">
                                                                                                    <input type="checkbox" checked={mclooEditModes[cRule.id] ? mclooEditModes[cRule.id] === 'base' : ((cRule as any).company_base_for_mcloo !== undefined && (cRule as any).company_base_for_mcloo !== null && String((cRule as any).company_base_for_mcloo).trim() !== '')} onChange={() => setMclooEditModes({...mclooEditModes, [cRule.id]: 'base'})} className="w-3 h-3 accent-emerald-500" />
                                                                                                    <span className="text-[10px] text-zinc-300">Base</span>
                                                                                                 </label>
                                                                                              </div>
                                                                                           </div>
                                                                                        <div className="flex flex-col gap-1 w-64">
                                                                                           <label className="text-[8px] text-amber-500/70 font-bold uppercase tracking-wider">{(mclooEditModes[cRule.id] ? mclooEditModes[cRule.id] === 'base' : ((cRule as any).company_base_for_mcloo !== undefined && (cRule as any).company_base_for_mcloo !== null && String((cRule as any).company_base_for_mcloo).trim() !== '')) ? 'Max Base Amount (Company Pay)' : 'Max Shared Insurance Resp. (Per Unit)'}</label>
                                                                                           <div className="relative h-7 w-32">
                                                                                              <span className="absolute left-2 top-1.5 text-amber-500/50 text-[10px] pointer-events-none">$</span>
                                                                                              {(mclooEditModes[cRule.id] ? mclooEditModes[cRule.id] === 'base' : ((cRule as any).company_base_for_mcloo !== undefined && (cRule as any).company_base_for_mcloo !== null && String((cRule as any).company_base_for_mcloo).trim() !== '')) ? (
                                                                                                 <input type="number" value={(cRule as any).company_base_for_mcloo ?? ''} onChange={(e) => handleCompanyExpenseChange(cRule.id, 'company_base_for_mcloo' as any, e.target.value)} className="w-full bg-zinc-900 border border-amber-700/50 rounded py-0 pl-6 pr-2 text-xs text-zinc-200 focus:border-amber-500 outline-none h-full" />
                                                                                              ) : (
                                                                                                 <input type="number" value={(cRule as any).shared_insurance ?? ''} onChange={(e) => handleCompanyExpenseChange(cRule.id, 'shared_insurance' as any, e.target.value)} className="w-full bg-zinc-900 border border-amber-700/50 rounded py-0 pl-6 pr-2 text-xs text-zinc-200 focus:border-amber-500 outline-none h-full" />
                                                                                              )}
                                                                                           </div>
                                                                                        </div>
                                                                                     </div>
                                                                             <div className="flex flex-col gap-1 pl-4">
                                                                                {(() => {
                                                                                   const rawAvailRecords = finImportData.filter(d => d.week_ending >= (cRule.valid_from || '2000-01-01') && (!cRule.valid_to || d.week_ending <= cRule.valid_to)).sort((a, b) => new Date(b.week_ending).getTime() - new Date(a.week_ending).getTime());
                                                                                   const availRecords = rawAvailRecords.filter(record => {
                                                                                       const targetDateStr = record.week_ending;
                                                                                       let effNT = 0;
                                                                                       const validFcRecords = (fixedCostsData || []).filter(r => (r.week_ending || '').startsWith(targetDateStr));
                                                                                       if (validFcRecords.length > 0) {
                                                                                          let nts = validFcRecords[0].company_eff_non_teams;
                                                                                          if (typeof nts === 'string') { try { nts = JSON.parse(nts); } catch(e){} }
                                                                                          if (nts) {
                                                                                             if (Array.isArray(nts)) {
                                                                                                const match = nts.find((x:any) => String(x.company_id || x.company || '').trim().toLowerCase() === String(cRule.companyId || '').trim().toLowerCase());
                                                                                                if (match) effNT = Number(match.eff_non_teams_total || match.eff_non_teams || match.value || match.amount || 0);
                                                                                             } else {
                                                                                                const companyKey = Object.keys(nts).find(k => String(k).trim().toLowerCase() === String(cRule.companyId || '').trim().toLowerCase());
                                                                                                if (companyKey) effNT = Number(nts[companyKey] || 0);
                                                                                             }
                                                                                          }
                                                                                       }
                                                                                       if (effNT <= 0 && (!cRule.companyId || cRule.companyId === 'ALL')) {
                                                                                          const puData = finImportPerUnitData.find(d => (d.week_ending || '').startsWith(targetDateStr));
                                                                                          effNT = puData ? (Number(puData.eff_non_teams_total) || 0) : 0;
                                                                                       }
                                                                                       return true;
                                                                                   });

                                                                                   const seenDates1 = new Set<string>();
                                                                                   const rows = availRecords.map(record => {
                                                                                      const targetDateStr = record.week_ending;
                                                                                      let effNT = 0;
                                                                                      const validFcRecords = (fixedCostsData || []).filter(r => (r.week_ending || '').startsWith(targetDateStr));
                                                                                      if (validFcRecords.length > 0) {
                                                                                         let nts = validFcRecords[0].company_eff_non_teams;
                                                                                         if (typeof nts === 'string') { try { nts = JSON.parse(nts); } catch(e){} }
                                                                                         if (nts) {
                                                                                            if (Array.isArray(nts)) {
                                                                                               const match = nts.find((x:any) => String(x.company_id || x.company || '').trim().toLowerCase() === String(cRule.companyId || '').trim().toLowerCase());
                                                                                               if (match) effNT = Number(match.eff_non_teams_total || match.eff_non_teams || match.value || match.amount || 0);
                                                                                            } else {
                                                                                               const companyKey = Object.keys(nts).find(k => String(k).trim().toLowerCase() === String(cRule.companyId || '').trim().toLowerCase());
                                                                                               if (companyKey) effNT = Number(nts[companyKey] || 0);
                                                                                            }
                                                                                         }
                                                                                      }
                                                                                      if (effNT <= 0 && (!cRule.companyId || cRule.companyId === 'ALL')) {
                                                                                         const puData = finImportPerUnitData.find(d => (d.week_ending || '').startsWith(targetDateStr));
                                                                                         effNT = puData ? (Number(puData.eff_non_teams_total) || 0) : 0;
                                                                                      }
                                                                                      
                                                                                      const dObj = new Date(targetDateStr);
                                                                                      while(dObj.getUTCDay() !== 4) {
                                                                                          dObj.setUTCDate(dObj.getUTCDate() + 1);
                                                                                      }
                                                                                      const payDateStr = dObj.toISOString().split('T')[0];
                                                                                      
                                                                                      if (seenDates1.has(payDateStr)) return null;
                                                                                      seenDates1.add(payDateStr);

                                                                                      if (payDateStr < '2026-02-19') return null;

                                                                                      let weeksDivider = 52;
                                                                                      if (cRule.valid_from && cRule.valid_to) {
                                                                                         const dFrom = new Date(cRule.valid_from);
                                                                                         const dTo = new Date(cRule.valid_to);
                                                                                         if (!isNaN(dFrom.getTime()) && !isNaN(dTo.getTime())) {
                                                                                            const daysDiff = (dTo.getTime() - dFrom.getTime()) / (1000 * 60 * 60 * 24);
                                                                                            if (daysDiff > 0) weeksDivider = daysDiff / 7;
                                                                                         }
                                                                                      }

                                                                                      const baseAmt = Number(cRule.amount || cRule.amount_after || 0);
                                                                                      const weeklyAmt = baseAmt / weeksDivider;
                                                                                      const perUnitAmt = effNT > 0 ? weeklyAmt / effNT : 0;
                                                                                      let sharedResp = 0;
                                                                                      let compPay = 0;
                                                                                      if (effNT <= 0) {
                                                                                          compPay = weeklyAmt;
                                                                                          sharedResp = 0;
                                                                                      } else if ((mclooEditModes[cRule.id] ? mclooEditModes[cRule.id] === 'base' : ((cRule as any).company_base_for_mcloo !== undefined && (cRule as any).company_base_for_mcloo !== null && String((cRule as any).company_base_for_mcloo).trim() !== ''))) {
                                                                                          const baseLimit = Number((cRule as any).company_base_for_mcloo || 0);
                                                                                          compPay = Math.min(perUnitAmt, baseLimit);
                                                                                          sharedResp = Math.max(0, perUnitAmt - baseLimit);
                                                                                      } else {
                                                                                          const sharedVal = Number((cRule as any).shared_insurance || 0);
                                                                                          compPay = perUnitAmt <= sharedVal ? perUnitAmt : perUnitAmt - sharedVal;
                                                                                          sharedResp = perUnitAmt <= sharedVal ? 0 : sharedVal;
                                                                                      }
                                                                                      const compPayColor = compPay > 0 ? 'text-rose-500' : compPay < 0 ? 'text-emerald-500' : 'text-zinc-400';
                                                                                      const sharedRespColor = 'text-amber-500';
                                                                                      return (
                                                                                         <div key={targetDateStr} className="flex items-center gap-6 py-1 border-b border-amber-900/10 last:border-0">
                                                                                            <div className="w-24 text-[10px] text-zinc-300 font-mono">{payDateStr}</div>
                                                                                            <div className="w-28 text-[10px] text-zinc-300 font-mono">{effNT > 0 ? `Total (PU): ${perUnitAmt.toFixed(2)}` : `Weekly: ${weeklyAmt.toFixed(2)}`}</div>
                                                                                            <div className={`w-32 text-[10px] font-mono font-bold ${compPayColor}`}>Comp Pay: {compPay.toFixed(2)}</div>
                                                                                            <div className={`w-40 text-[10px] font-mono font-bold ${sharedRespColor}`}>Shared Resp: {sharedResp.toFixed(2)}</div>
                                                                                         </div>
                                                                                      );
                                                                                   });
                                                                                   const validRows = rows.filter(Boolean);
                                                                                   if (validRows.length === 0) return <div className="text-[10px] text-zinc-500 italic">No valid dates found.</div>;
                                                                                                                     return validRows;
                                                                                                                  })()}
                                                                                                               </div>
                                                                                                            </div>
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                )}
                                                                                                {exp.key === 'avg_truck_price' && expandedDphRules.includes(String(cRule.id)) && (
                                                                                                    <tr className="bg-amber-500/5">
                                                                                                        <td colSpan={5} className="px-3 pb-3 pt-0 border-t-0">
                                                                                                            <div className="flex flex-col gap-3 bg-zinc-950/50 p-3 rounded-lg border border-amber-500/20 w-full relative ml-4">
                                                                                                                <div className="absolute -top-2.5 -left-3 text-amber-500/30">
                                                                                                                    <CornerDownRight size={16} />
                                                                                                                </div>
                                                                                                                {(() => {
                                                                                                                    let curFc = (cRule as any).franchise_charge;
                                                                                                                    if (curFc === undefined) {
                                                                                                                        const separatedRules = localFixedExpenses.filter(e => e.name === exp.name && e.valid_from === cRule.valid_from && e.companyId === cRule.companyId && e.contractType && e.franchise_charge !== undefined && e.franchise_charge !== null && !e.amount && !e.cpm);
                                                                                                                        if (separatedRules.length > 0) {
                                                                                                                            curFc = separatedRules.map(e => ({ contract: e.contractType, amount: e.franchise_charge, dph: (e as any).dph }));
                                                                                                                        } else {
                                                                                                                            curFc = [];
                                                                                                                        }
                                                                                                                    }
                                                                                                                    if (typeof curFc === 'string') { try { curFc = JSON.parse(curFc); } catch(e){ curFc = []; } }
                                                                                                                    if (!Array.isArray(curFc)) curFc = [];
                                                                                                                    if (curFc.length === 0) curFc = [{ contract: '', amount: '' }];
                                                                                                                    return (
                                                                                                                        <>
                                                                                                                            {curFc.map((fc: any, i: number) => (
                                                                                                                                <div key={i} className="flex items-center gap-4">
                                                                                                                                    <div className="flex flex-col gap-1 w-48">
                                                                                                                                        <label className="text-[8px] text-amber-500/70 font-bold uppercase tracking-wider">Contract</label>
                                                                                                                                        <select value={fc.contract} onChange={(e) => { const newFc = curFc.map((item: any, idx: number) => idx === i ? { ...item, contract: e.target.value } : item); handleCompanyExpenseChange(cRule.id, 'franchise_charge' as any, newFc); }} className="w-full bg-zinc-900 border border-amber-700/50 rounded py-1 px-2 text-xs text-zinc-200 focus:border-amber-500 outline-none">
                                                                                                                                            <option value="" disabled>Select Contract</option>
                                                                                                                                            {availableContractTypes.map(c => <option key={c as string} value={c as string}>{c}</option>)}
                                                                                                                                        </select>
                                                                                                                                    </div>
                                                                                                                                   
                                                                                                                                   <div className="flex flex-col gap-1 w-32">
                                                                                                                                        <label className="text-[8px] text-amber-500/70 font-bold uppercase tracking-wider">Charge to franchise</label>
                                                                                                                                        <div className="relative h-7 w-full">
                                                                                                                                            <span className="absolute left-2 top-1.5 text-amber-500/50 text-[10px] pointer-events-none">$</span>
                                                                                                                                            <input type="number" value={fc.amount} onChange={(e) => { const newFc = curFc.map((item: any, idx: number) => idx === i ? { ...item, amount: e.target.value } : item); handleCompanyExpenseChange(cRule.id, 'franchise_charge' as any, newFc); }} className="w-full bg-zinc-900 border border-amber-700/50 rounded py-0 pl-6 pr-2 text-xs text-zinc-200 focus:border-amber-500 outline-none h-full" />
                                                                                                                                        </div>
                                                                                                                                    </div>
                                                                                                                                    <div className="flex flex-col gap-1 mt-4">
                                                                                                                                        <span className="text-[10px] text-amber-500 font-mono font-bold whitespace-nowrap">
                                                                                                                                            New Amount: {Number(cRule.amount || cRule.amount_after || 0) - Number(fc.amount || 0)}
                                                                                                                                        </span>
                                                                                                                                    </div>
                                                                                                                                    <button onClick={() => { const newFc = curFc.filter((_: any, idx: number) => idx !== i); handleCompanyExpenseChange(cRule.id, 'franchise_charge' as any, newFc); }} className="mt-4 text-zinc-500 hover:text-rose-500"><Trash2 size={14}/></button>
                                                                                                                                </div>
                                                                                                                            ))}
                                                                                                                            <button onClick={() => { const newFc = [...curFc, { contract: '', amount: '' }]; handleCompanyExpenseChange(cRule.id, 'franchise_charge' as any, newFc); }} className="text-amber-500 text-[10px] font-bold uppercase w-max hover:text-amber-400 mt-2 flex items-center gap-1"><Plus size={10}/> Add Rule</button>
                                                                                                                        </>
                                                                                                                    );
                                                                                                                })()}
                                                                                                            </div>
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                )}
                                                                                          </React.Fragment>
                                                                                      ))}
                                                                                     {uniqueDates.flatMap(dateStr => {
                                                        let gRule = globalRules.find(d => d.week_ending === dateStr);
                                                        const dBase = new Date(dateStr);
                                                        const vFromStr = new Date(dBase.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                                                        const vToStr = new Date(dBase.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                                                        
                                                        if (!gRule && globalOverrides.some(go => go.valid_from === vFromStr)) {
                                                            gRule = { id: `dummy_${dateStr}`, week_ending: dateStr } as any;
                                                        }

                                                        const cRules = exceptionRules.filter(e => {
                                                            return e.companyId !== 'ALL' && !e.is_standalone && (e.original_valid_from || e.valid_from) === vFromStr;
                                                        });

                                                        if (!gRule && cRules.length === 0) return null;

                                                        const isOverridden = globalOverrides.some(go => {
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
                                                         const showGRule = gRule && (puValTemp > 0 || gValTemp > 0 || hasCustomOverrideTemp);
                                                      const fragmentRows = [];
                                                      if (showGRule && !(isOverridden && hideOverriddenRules)) {
                                                          fragmentRows.push(
                                                                     <tr key={`g_${gRule.id}_${dateStr}`} className={`transition-colors ${isOverridden ? 'opacity-20 grayscale pointer-events-none' : 'hover:bg-zinc-800/30'}`}>
                                                                          <td className="py-2 px-3 text-xs text-zinc-300 font-mono align-top">
                                                                                 {vFromStr}
                                                                                 {gRule && String(gRule.id).startsWith('new_') && <span className="mt-1 block w-max text-[9px] text-emerald-500 uppercase font-bold px-1.5 py-0.5 bg-emerald-500/10 rounded">New</span>}
                                                                              </td>
                                                                           <td className="py-2 px-3 text-xs text-zinc-300 font-mono align-top">
                                                                             {(() => { 
                                                                                if (gRule && String(gRule.id).startsWith('new_')) {
                                                                                    return (gRule as any).valid_to || '';
                                                                                }
                                                                                const go = globalOverrides.find(g => g.valid_from === vFromStr); 
                                                                                if (go && go.valid_to) return go.valid_to;
                                                                                return go && !go.valid_to ? '' : vToStr; 
                                                                             })()}
                                                                          </td>
                                                                          <td className="py-2 px-3 text-xs text-zinc-500 font-bold uppercase tracking-wider align-top">
                                                                             Global Rule
                                                                          </td>
                                                                               <td className="py-2 px-3">
                                                                                   <div className="flex flex-col gap-2">
                                                                                      <div className="flex items-start gap-4">
                                                                                         <div className="flex items-center gap-2 mt-1">
                                                                                            <div className="flex flex-col gap-1 w-32">
                                                                                               <div className="relative flex items-center h-7">
                                                                                                  <span className="absolute left-2 text-zinc-500 text-xs pointer-events-none">$</span>
                                                                                                {(() => {
                                                                                                      const puData = finImportPerUnitData.find(d => d.week_ending === dateStr);
                                                                                                      const puVal = puData ? Math.abs(puData[(exp as any).puKey] || 0) : 0;
                                                                                                      const dObj = new Date(dateStr);
                                                                                                      const vfObj = new Date(dObj); vfObj.setUTCDate(dObj.getUTCDate() - 5);
                                                                                                      const savedOverride = globalOverrides.find(go => go.valid_from === vfObj.toISOString().split('T')[0]);
                                                                                                      const hasStateCustom = gRule && (gRule as any)[`is_custom_${exp.key}`] !== undefined;
                                                                                                      const isCustom = hasStateCustom ? !!(gRule as any)[`is_custom_${exp.key}`] : !!savedOverride;
                                                                                                      
                                                                                                      let customVal: any = '';
                                                                                                      if (gRule && (gRule as any)[`custom_val_${exp.key}`] !== undefined) {
                                                                                                          customVal = (gRule as any)[`custom_val_${exp.key}`];
                                                                                                      } else if (savedOverride && savedOverride.amount !== undefined && savedOverride.amount !== null) {
                                                                                                          customVal = savedOverride.amount;
                                                                                                      }

                                                                                                      const displayVal = isCustom ? customVal : puVal;
                                                                                                      let multiplier = 0;
                                                                                                      if (puData) {
                                                                                                         if (exp.key === 'avg_trailer_price') multiplier = puData.eff_trailers_total || 0;
                                                                                                         else if (exp.key === 'avg_truck_price') multiplier = puData.total_neff_teams_w_oo || 0;
                                                                                                         else multiplier = puData.eff_non_teams_total || 0;
                                                                                                      }
                                                                                                      return (
                                                                                                         <input type="number" value={displayVal === '' ? '' : (displayVal === 0 && !isCustom ? '' : (isCustom ? displayVal : Math.round(Number(displayVal))))} onChange={(e) => {
                                                                                                            if (isCustom) {
                                                                                                               const val = e.target.value;
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
                                                                                                         }} disabled={!isCustom} className={`w-full bg-zinc-950 border border-zinc-700 rounded py-1 pl-5 pr-8 text-xs text-zinc-200 font-mono focus:border-emerald-500 outline-none transition-colors h-full ${!isCustom ? 'opacity-50 cursor-not-allowed' : ''}`} />
                                                                                                      );
                                                                                                   })()}
                                                                                                                       {!['liability_insurance', 'cargo_insurance', 'trailer_interchange', 'lago', 'physical_damage_premium', 'physical_damage'].includes(exp.key) ? (
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
                                                                                            {exp.key === 'avg_truck_price' && (
                                                                                                                            <div className="flex items-center gap-2">
                                                                                                                               <span className="text-zinc-500 font-bold text-xs mt-1">+</span>
                                                                                                                               <div className="relative flex items-center h-7 w-24 mt-1">
                                                                                                                                  <span className="absolute left-2 text-emerald-500/50 text-xs pointer-events-none">$</span>
                                                                                                                                  {(() => {
                                                                                                                                     const dObj = new Date(dateStr);
                                                                                                                                     const vfObj = new Date(dObj); vfObj.setUTCDate(dObj.getUTCDate() - 5);
                                                                                                                                     const savedOverride = globalOverrides.find(go => go.valid_from === vfObj.toISOString().split('T')[0]);
                                                                                                                                     const hasStateCustom = (gRule as any)[`is_custom_${exp.key}`] !== undefined;
                                                                                                                                     const isCustom = hasStateCustom ? !!(gRule as any)[`is_custom_${exp.key}`] : !!savedOverride;
                                                                                                                                     const cpmVal = hasStateCustom ? ((gRule as any)[`custom_cpm_${exp.key}`] ?? '') : (savedOverride ? (savedOverride.cpm ?? '') : '');
                                                                                                                                   return (
                                                                                                                                      <input type="number" step="0.01" value={cpmVal} onChange={(e) => {
                                                                                                                                         if (isCustom) {
                                                                                                                                            const val = e.target.value;
                                                                                                                                            setFinImportData(prev => prev.map(d => d.id === gRule.id ? { ...d, [`is_custom_${exp.key}`]: true, [`custom_cpm_${exp.key}`]: val } : d));
                                                                                                                                            if (!modifiedFinImportIds.includes(String(gRule.id))) setModifiedFinImportIds(prev => [...prev, String(gRule.id)]);
                                                                                                                                         }
                                                                                                                                      }} disabled={!isCustom} placeholder="CPM" className={`w-full bg-zinc-950 border border-zinc-700 rounded py-1 pl-5 pr-2 text-xs text-zinc-200 font-mono focus:border-emerald-500 outline-none transition-colors h-full ${!isCustom ? 'opacity-50 cursor-not-allowed' : ''}`} />
                                                                                                                                   );
                                                                                                                                  })()}
                                                                                                                               </div>
                                                                                                                               <button onClick={() => {
                                                                                                                                   if (!expandedDphRules.includes(gRule.id)) {
                                                                                                                                       let fcArr = (gRule as any).franchise_charge;
                                                                                                                                       if (fcArr === undefined) {
                                                                                                                                           const dObj = new Date(dateStr);
                                                                                                                                           const vfObj = new Date(dObj); vfObj.setUTCDate(dObj.getUTCDate() - 5);
                                                                                                                                           const vfStr = vfObj.toISOString().split('T')[0];
                                                                                                                                           const separatedRules = localFixedExpenses.filter(e => e.name === exp.name && e.valid_from === vfStr && e.companyId === 'ALL' && e.contractType && e.franchise_charge !== undefined && e.franchise_charge !== null && !e.amount && !e.cpm);
                                                                                                                                           if (separatedRules.length > 0) {
                                                                                                                                               fcArr = separatedRules.map(e => ({ contract: e.contractType, amount: e.franchise_charge, dph: (e as any).dph }));
                                                                                                                                           } else {
                                                                                                                                               fcArr = [];
                                                                                                                                           }
                                                                                                                                       }
                                                                                                                                       if (typeof fcArr === 'string') { try { fcArr = JSON.parse(fcArr); } catch(e){ fcArr = []; } }
                                                                                                                                       if (!Array.isArray(fcArr)) fcArr = [];
                                                                                                                                       if (fcArr.length === 0) {
                                                                                                                                           handleFinImportChange(gRule.id, 'franchise_charge', [{ contract: '', amount: '' }] as any);
                                                                                                                                       } else {
                                                                                                                                           handleFinImportChange(gRule.id, 'franchise_charge', fcArr as any);
                                                                                                                                       }
                                                                                                                                   }
                                                                                                                                   toggleDphRule(gRule.id);
                                                                                                                               }} className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] rounded border border-zinc-700 transition-colors h-max whitespace-nowrap mt-1">
                                                                                                                                  {expandedDphRules.includes(gRule.id) ? 'Hide dph rule' : 'Edit dph rule'}
                                                                                                                               </button>
                                                                                                                            </div>
                                                                                                                         )}
                                                                                         </div>
                                                                                        {(() => {
                                                                                                                      const dObj = new Date(dateStr);
                                                                                                                      const vfObj = new Date(dObj); vfObj.setUTCDate(dObj.getUTCDate() - 5);
                                                                                                                      const savedOverride = globalOverrides.find(go => go.valid_from === vfObj.toISOString().split('T')[0]);
                                                                                                                      const hasStateCustom = (gRule as any)[`is_custom_${exp.key}`] !== undefined;
                                                                                                                      const isCustomLocal = hasStateCustom ? !!(gRule as any)[`is_custom_${exp.key}`] : !!savedOverride;
                                                                                                                      
                                                                                                                      return (
                                                                                                                         <div className="flex flex-col gap-1 mt-1">
                                                                                                                            <label title="Value from finImport" className="flex items-center gap-1 text-[9px] text-zinc-400 cursor-pointer w-max hover:text-zinc-200">
                                                                                                                               <input type="checkbox" checked={!isCustomLocal} onChange={() => { 
                                                                                                                                  setFinImportData(prev => prev.map(d => d.id === gRule.id ? { ...d, [`is_custom_${exp.key}`]: false, [exp.key]: d[`original_${exp.key}`] !== undefined ? d[`original_${exp.key}`] : d[exp.key] } : d));
                                                                                                                                  if (!modifiedFinImportIds.includes(String(gRule.id))) setModifiedFinImportIds(prev => [...prev, String(gRule.id)]); 
                                                                                                                                  if (savedOverride) setLocalFixedExpenses(prev => prev.filter(e => e.id !== savedOverride.id));
                                                                                                                               }} className="accent-emerald-500" /> Default Value
                                                                                                                            </label>
                                                                                                                            <label className="flex items-center gap-1 text-[9px] text-zinc-400 cursor-pointer w-max hover:text-zinc-200">
                                                                                                                               <input type="checkbox" checked={isCustomLocal} onChange={() => { 
                                                                                                                                  setFinImportData(prev => prev.map(d => d.id === gRule.id ? { ...d, [`is_custom_${exp.key}`]: true, [`original_${exp.key}`]: d[`original_${exp.key}`] !== undefined ? d[`original_${exp.key}`] : d[exp.key], [exp.key]: 0, [`custom_val_${exp.key}`]: savedOverride ? savedOverride.amount : '' } : d));
                                                                                                                                  if (!modifiedFinImportIds.includes(String(gRule.id))) setModifiedFinImportIds(prev => [...prev, String(gRule.id)]); 
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
                                                                                              const puData = finImportPerUnitData.find(d => d.week_ending === dateStr);
                                                                                              const multiplier = puData?.eff_non_teams_total || 0;
                                                                                              const puVal = puData ? Math.abs(puData[(exp as any).puKey] || 0) : 0;
                                                                                              const dObj = new Date(dateStr);
                                                                                              const vfObj = new Date(dObj); vfObj.setUTCDate(dObj.getUTCDate() - 5);
                                                                                              const savedOverride = globalOverrides.find(go => go.valid_from === vfObj.toISOString().split('T')[0]);
                                                                                              const hasStateCustom = (gRule as any)[`is_custom_${exp.key}`] !== undefined;
                                                                                              const isCustom = hasStateCustom ? !!(gRule as any)[`is_custom_${exp.key}`] : !!savedOverride;
                                                                                              const customVal = hasStateCustom ? ((gRule as any)[`custom_val_${exp.key}`] || '') : (savedOverride ? savedOverride.amount : '');
                                                                                              const currentPu = isCustom ? Number(customVal) : puVal;
                                                                                              const currentTotal = currentPu * multiplier;
                                                                                             let weeksDivider = 52;
                                                                                               if (savedOverride && savedOverride.valid_from && savedOverride.valid_to) {
                                                                                                  const dFrom = new Date(savedOverride.valid_from);
                                                                                                  const dTo = new Date(savedOverride.valid_to);
                                                                                                  if (!isNaN(dFrom.getTime()) && !isNaN(dTo.getTime())) {
                                                                                                     const daysDiff = (dTo.getTime() - dFrom.getTime()) / (1000 * 60 * 60 * 24);
                                                                                                     if (daysDiff > 0) weeksDivider = daysDiff / 7;
                                                                                                  }
                                                                                               }

                                                                                               const baseAmt = isCustom ? Number(customVal) : (gRule[exp.key] || 0);
                                                                                               const weeklyAmt = baseAmt / weeksDivider;
                                                                                               const effNT = puData ? (Number(puData.eff_non_teams_total) || 0) : 0;
                                                                                               const perUnitAmt = effNT > 0 ? weeklyAmt / effNT : 0;
                                                                                               let sharedResp = 0;
                                                                                               let compPay = 0;
                                                                                               if (effNT <= 0) {
                                                                                                   compPay = weeklyAmt;
                                                                                                   sharedResp = 0;
                                                                                               } else if ((mclooEditModes[gRule.id] ? mclooEditModes[gRule.id] === 'base' : (((gRule as any).company_base_for_mcloo !== undefined && (gRule as any).company_base_for_mcloo !== null && String((gRule as any).company_base_for_mcloo).trim() !== '') || ((savedOverride as any)?.company_base_for_mcloo !== undefined && (savedOverride as any)?.company_base_for_mcloo !== null && String((savedOverride as any)?.company_base_for_mcloo).trim() !== '')))) {
                                                                                                   const baseLimit = Number((gRule as any).company_base_for_mcloo ?? (savedOverride as any)?.company_base_for_mcloo ?? 0);
                                                                                                   compPay = Math.min(perUnitAmt, baseLimit);
                                                                                                   sharedResp = Math.max(0, perUnitAmt - baseLimit);
                                                                                               } else {
                                                                                                   const sharedVal = Number((gRule as any).shared_insurance ?? (savedOverride as any)?.shared_insurance ?? 0);
                                                                                                   compPay = perUnitAmt <= sharedVal ? perUnitAmt : perUnitAmt - sharedVal;
                                                                                                   sharedResp = perUnitAmt <= sharedVal ? 0 : sharedVal;
                                                                                               }
                                                                                               const compPayColor = compPay > 0 ? 'text-rose-500' : compPay < 0 ? 'text-emerald-500' : 'text-zinc-400';
                                                                                               const sharedRespColor = 'text-amber-500';
                                                                                               return (
                                                                                                  <div className="flex items-center gap-4">
                                                                                                     <div className="flex flex-col gap-0.5 border-r border-zinc-800 pr-4">
                                                                                                        <label className="text-[8px] text-zinc-400 font-bold uppercase">Edit Mode</label>
                                                                                                        <div className="flex items-center gap-2 h-5">
                                                                                                           <label className="flex items-center gap-1 cursor-pointer">
                                                                                                              <input type="checkbox" checked={!mclooEditModes[gRule.id] || mclooEditModes[gRule.id] === 'shared'} onChange={() => setMclooEditModes({...mclooEditModes, [gRule.id]: 'shared'})} className="w-2.5 h-2.5 accent-emerald-500" />
                                                                                                              <span className="text-[9px] text-zinc-300">Shared</span>
                                                                                                           </label>
                                                                                                           <label className="flex items-center gap-1 cursor-pointer">
                                                                                                              <input type="checkbox" checked={mclooEditModes[gRule.id] === 'base'} onChange={() => setMclooEditModes({...mclooEditModes, [gRule.id]: 'base'})} className="w-2.5 h-2.5 accent-emerald-500" />
                                                                                                              <span className="text-[9px] text-zinc-300">Base</span>
                                                                                                           </label>
                                                                                                        </div>
                                                                                                     </div>
                                                                                                     <div className="flex flex-col gap-0.5 w-28">
                                                                                                        <label className="text-[8px] text-zinc-400 font-bold uppercase">{effNT > 0 ? 'Amount (Per Unit)' : 'Weekly Amount'}</label>
                                                                                                        <div className="text-[10px] text-zinc-300 font-mono font-bold h-5 flex items-center">{effNT > 0 ? perUnitAmt.toFixed(2) : weeklyAmt.toFixed(2)}</div>
                                                                                                     </div>
                                                                                                     <div className="flex flex-col gap-0.5 border-l border-zinc-800 pl-4">
                                                                                                        <label className="text-[8px] text-zinc-400 font-bold uppercase">{((mclooEditModes[gRule.id] ? mclooEditModes[gRule.id] === 'base' : (((gRule as any).company_base_for_mcloo !== undefined && (gRule as any).company_base_for_mcloo !== null && String((gRule as any).company_base_for_mcloo).trim() !== '') || ((savedOverride as any)?.company_base_for_mcloo !== undefined && (savedOverride as any)?.company_base_for_mcloo !== null && String((savedOverride as any)?.company_base_for_mcloo).trim() !== '')))) ? 'Max Base Amount (Company Pay)' : 'Max Shared Insurance Resp. (Per Unit)'}</label>
                                                                                                        <div className="relative h-5 w-24">
                                                                                                           <span className="absolute left-1.5 top-0.5 text-zinc-500 text-[9px] pointer-events-none">$</span>
                                                                                                           {((mclooEditModes[gRule.id] ? mclooEditModes[gRule.id] === 'base' : (((gRule as any).company_base_for_mcloo !== undefined && (gRule as any).company_base_for_mcloo !== null && String((gRule as any).company_base_for_mcloo).trim() !== '') || ((savedOverride as any)?.company_base_for_mcloo !== undefined && (savedOverride as any)?.company_base_for_mcloo !== null && String((savedOverride as any)?.company_base_for_mcloo).trim() !== '')))) ? (
                                                                                                              <input type="number" value={(gRule as any).company_base_for_mcloo ?? (savedOverride as any)?.company_base_for_mcloo ?? ''} onChange={(e) => { const v = e.target.value ? Number(e.target.value) : undefined; handleFinImportChange(gRule.id, 'company_base_for_mcloo', v as any); }} className="w-full bg-zinc-950 border border-zinc-700 rounded py-0 pl-4 pr-1 text-[9px] text-zinc-200 focus:border-emerald-500 outline-none h-full" />
                                                                                                           ) : (
                                                                                                              <input type="number" value={(gRule as any).shared_insurance ?? (savedOverride as any)?.shared_insurance ?? ''} onChange={(e) => { const v = e.target.value ? Number(e.target.value) : undefined; handleFinImportChange(gRule.id, 'shared_insurance', v as any); }} className="w-full bg-zinc-950 border border-zinc-700 rounded py-0 pl-4 pr-1 text-[9px] text-zinc-200 focus:border-emerald-500 outline-none h-full" />
                                                                                                           )}
                                                                                                        </div>
                                                                                                     </div>
                                                                                                     <div className="flex flex-col gap-0.5 border-l border-zinc-800 pl-4">
                                                                                                        <label className="text-[8px] text-zinc-400 font-bold uppercase">Comp Pay (PU)</label>
                                                                                                        <div className={`text-[10px] font-mono font-bold h-5 flex items-center ${compPayColor}`}>{compPay.toFixed(2)}</div>
                                                                                                     </div>
                                                                                                     <div className="flex flex-col gap-0.5 border-l border-zinc-800 pl-4">
                                                                                                        <label className="text-[8px] text-zinc-400 font-bold uppercase">Shared Resp (PU)</label>
                                                                                                        <div className={`text-[10px] font-mono font-bold h-5 flex items-center ${sharedRespColor}`}>{sharedResp.toFixed(2)}</div>
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
                                                                         setFinImportData(prev => prev.filter(d => d.id !== gRule.id));
                                                                         setLocalFixedExpenses(prev => prev.filter(x => !(x.name === exp.name && x.valid_from === vFromStr && x.companyId === 'ALL')));
                                                                     } else if (String(gRule.id).startsWith('dummy_')) {
                                                                         setLocalFixedExpenses(prev => prev.filter(x => !(x.name === exp.name && x.valid_from === vFromStr && x.companyId === 'ALL')));
                                                                     } else {
                                                                         handleResetFinImportCustom(gRule.id, exp.key, exp.name);
                                                                     }
                                                                 }} className="p-1 text-zinc-600 hover:text-rose-500 transition-colors">
                                                                    <Trash2 size={14} />
                                                                 </button>
                                                                              </div>
                                                                          </td>
                                                                     </tr>
                                                             );
                                                         }
                                                         
                                                         cRules.forEach(cRule => {
                                                             fragmentRows.push(
                                                                     <tr key={cRule.id} className="bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
                                                                         <td className="py-1.5 px-3">
                                                                            <input type="date" value={cRule.valid_from || ''} onChange={(e) => handleCompanyExpenseChange(cRule.id, 'valid_from', e.target.value)} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 outline-none transition-colors h-7" />
                                                                         </td>
                                                                         <td className="py-1.5 px-3">
                                                                            <input type="date" value={cRule.valid_to || ''} onChange={(e) => handleCompanyExpenseChange(cRule.id, 'valid_to', e.target.value)} style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 outline-none transition-colors h-7" />
                                                                         </td>
                                                                         <td className="py-1.5 px-3 flex items-center gap-2">
                                                                            {cRule.contractType !== undefined && cRule.contractType !== null ? (
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
                                                                         <td className="py-1.5 px-3">
                                                                                    <div className="flex flex-col gap-2">
                                                                                       <div className="flex items-start gap-4">
                                                                                          <div className="flex flex-col gap-1 w-32 mt-1">
                                                                                             <div className="relative flex items-center h-7">
                                                                                                <span className="absolute left-2 text-amber-500/50 text-xs pointer-events-none">$</span>
                                                                                                <input type="number" value={(cRule.amount !== undefined && cRule.amount !== null && cRule.amount !== '') ? Math.round(Number(cRule.amount)) : ((cRule.amount_after !== undefined && cRule.amount_after !== null && cRule.amount_after !== '') ? Math.round(Number(cRule.amount_after)) : '')} onChange={(e) => { handleCompanyExpenseChange(cRule.id, 'amount', e.target.value); handleCompanyExpenseChange(cRule.id, 'amount_after', e.target.value); }} className="w-full bg-zinc-950 border border-amber-700/50 rounded py-1 pl-5 pr-8 text-xs text-zinc-200 font-mono focus:border-amber-500 outline-none h-full" />
                                                                                                {!['liability_insurance', 'liability_insurance_general', 'cargo_insurance', 'trailer_interchange', 'lago', 'physical_damage_premium', 'physical_damage'].includes(exp.key) ? (
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
                                                                                          {exp.key === 'avg_truck_price' && (
                                                                                             <div className="flex items-center gap-2">
                                                                                                <span className="text-zinc-500 font-bold text-xs mt-1">+</span>
                                                                                                <div className="relative flex items-center h-7 w-24 mt-1">
                                                                                                   <span className="absolute left-2 text-emerald-500/50 text-xs pointer-events-none">$</span>
                                                                                                   <input type="number" step="0.01" value={cRule.cpm ?? ''} onChange={(e) => handleCompanyExpenseChange(cRule.id, 'cpm', e.target.value)} placeholder="CPM" className="w-full bg-zinc-950 border border-amber-700/50 rounded py-1 pl-5 pr-2 text-xs text-zinc-200 font-mono focus:border-amber-500 outline-none h-full" />
                                                                                                </div>
                                                                                                <button onClick={() => {
                                                                                                    if (!expandedDphRules.includes(String(cRule.id))) {
                                                                                                        let fcArr = (cRule as any).franchise_charge;
                                                                                                        if (typeof fcArr === 'string') { try { fcArr = JSON.parse(fcArr); } catch(e){ fcArr = []; } }
                                                                                                        if (!Array.isArray(fcArr)) fcArr = [];
                                                                                                        if (fcArr.length === 0) handleCompanyExpenseChange(cRule.id, 'franchise_charge' as any, [{ contract: '', amount: '' }]);
                                                                                                    }
                                                                                                    toggleDphRule(String(cRule.id));
                                                                                                }} className="px-2 py-0.5 bg-amber-950 hover:bg-amber-900 text-amber-500/70 text-[10px] rounded border border-amber-900/50 transition-colors h-max whitespace-nowrap mt-1">
                                                                                                   {expandedDphRules.includes(String(cRule.id)) ? 'Hide dph rule' : 'Edit dph rule'}
                                                                                                </button>
                                                                                             </div>
                                                                                          )}
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
                                                                                        <div className="flex flex-col gap-1">
                                                                                              <label className="text-[8px] text-amber-500/70 font-bold uppercase tracking-wider">Edit Mode</label>
                                                                                              <div className="flex items-center gap-2 h-5">
                                                                                                           <label className="flex items-center gap-1 cursor-pointer">
   <input type="checkbox" checked={mclooEditModes[cRule.id] ? mclooEditModes[cRule.id] === 'shared' : !((cRule as any).company_base_for_mcloo !== undefined && (cRule as any).company_base_for_mcloo !== null && String((cRule as any).company_base_for_mcloo).trim() !== '')} onChange={() => { setMclooEditModes({...mclooEditModes, [cRule.id]: 'shared'}); handleCompanyExpenseChange(cRule.id, 'company_base_for_mcloo' as any, null); }} className="w-2.5 h-2.5 accent-emerald-500" />
   <span className="text-[9px] text-zinc-300">Shared</span>
</label>
<label className="flex items-center gap-1 cursor-pointer">
   <input type="checkbox" checked={mclooEditModes[cRule.id] ? mclooEditModes[cRule.id] === 'base' : ((cRule as any).company_base_for_mcloo !== undefined && (cRule as any).company_base_for_mcloo !== null && String((cRule as any).company_base_for_mcloo).trim() !== '')} onChange={() => setMclooEditModes({...mclooEditModes, [cRule.id]: 'base'})} className="w-2.5 h-2.5 accent-emerald-500" />
   <span className="text-[9px] text-zinc-300">Base</span>
</label>
                                                                                                        </div>
                                                                                           </div>
                                                                                        <div className="flex flex-col gap-1 w-64">
                                                                                           <label className="text-[8px] text-amber-500/70 font-bold uppercase tracking-wider">{(mclooEditModes[cRule.id] ? mclooEditModes[cRule.id] === 'base' : ((cRule as any).company_base_for_mcloo !== undefined && (cRule as any).company_base_for_mcloo !== null && String((cRule as any).company_base_for_mcloo).trim() !== '')) ? 'Max Base Amount (Company Pay)' : 'Max Shared Insurance Resp. (Per Unit)'}</label>
                                                                                           <div className="relative h-7 w-32">
                                                                                              <span className="absolute left-2 top-1.5 text-amber-500/50 text-[10px] pointer-events-none">$</span>
                                                                                              {(mclooEditModes[cRule.id] ? mclooEditModes[cRule.id] === 'base' : ((cRule as any).company_base_for_mcloo !== undefined && (cRule as any).company_base_for_mcloo !== null && String((cRule as any).company_base_for_mcloo).trim() !== '')) ? (
                                                                                                 <input type="number" value={(cRule as any).company_base_for_mcloo ?? ''} onChange={(e) => handleCompanyExpenseChange(cRule.id, 'company_base_for_mcloo' as any, e.target.value)} className="w-full bg-zinc-900 border border-amber-700/50 rounded py-0 pl-6 pr-2 text-xs text-zinc-200 focus:border-amber-500 outline-none h-full" />
                                                                                              ) : (
                                                                                                 <input type="number" value={(cRule as any).shared_insurance ?? ''} onChange={(e) => handleCompanyExpenseChange(cRule.id, 'shared_insurance' as any, e.target.value)} className="w-full bg-zinc-900 border border-amber-700/50 rounded py-0 pl-6 pr-2 text-xs text-zinc-200 focus:border-amber-500 outline-none h-full" />
                                                                                              )}
                                                                                           </div>
                                                                                        </div>
                                                                                     </div>
                                                                                <div className="flex flex-col gap-1 pl-4">
                                                                                   {(() => {
                                                                                      const rawAvailRecords = finImportData.filter(d => d.week_ending >= (cRule.valid_from || '2000-01-01') && (!cRule.valid_to || d.week_ending <= cRule.valid_to)).sort((a, b) => new Date(b.week_ending).getTime() - new Date(a.week_ending).getTime());
                                                                                      const availRecords = rawAvailRecords.filter(record => {
                                                                                          const targetDateStr = record.week_ending;
                                                                                          let effNT = 0;
                                                                                          const validFcRecords = (fixedCostsData || []).filter(r => (r.week_ending || '').startsWith(targetDateStr));
                                                                                          if (validFcRecords.length > 0) {
                                                                                             let nts = validFcRecords[0].company_eff_non_teams;
                                                                                             if (typeof nts === 'string') { try { nts = JSON.parse(nts); } catch(e){} }
                                                                                             if (nts) {
                                                                                                if (Array.isArray(nts)) {
                                                                                                   const match = nts.find((x:any) => String(x.company_id || x.company || '').trim().toLowerCase() === String(cRule.companyId || '').trim().toLowerCase());
                                                                                                   if (match) effNT = Number(match.eff_non_teams_total || match.eff_non_teams || match.value || match.amount || 0);
                                                                                                } else {
                                                                                                   const companyKey = Object.keys(nts).find(k => String(k).trim().toLowerCase() === String(cRule.companyId || '').trim().toLowerCase());
                                                                                                   if (companyKey) effNT = Number(nts[companyKey] || 0);
                                                                                                }
                                                                                             }
                                                                                          }
                                                                                          if (effNT <= 0 && (!cRule.companyId || cRule.companyId === 'ALL')) {
                                                                                             const puData = finImportPerUnitData.find(d => (d.week_ending || '').startsWith(targetDateStr));
                                                                                             effNT = puData ? (Number(puData.eff_non_teams_total) || 0) : 0;
                                                                                          }
                                                                                          return true;
                                                                                      });

                                                                                      const seenDates2 = new Set<string>();
                                                                                         const rows = availRecords.map((record, index) => {
                                                                                            const targetDateStr = record.week_ending;
                                                                                            let effNT = 0;
                                                                                            const validFcRecords = (fixedCostsData || []).filter(r => (r.week_ending || '').startsWith(targetDateStr));
                                                                                            if (validFcRecords.length > 0) {
                                                                                               let nts = validFcRecords[0].company_eff_non_teams;
                                                                                               if (typeof nts === 'string') { try { nts = JSON.parse(nts); } catch(e){} }
                                                                                               if (nts) {
                                                                                                  if (Array.isArray(nts)) {
                                                                                                     const match = nts.find((x:any) => String(x.company_id || x.company || '').trim().toLowerCase() === String(cRule.companyId || '').trim().toLowerCase());
                                                                                                     if (match) effNT = Number(match.eff_non_teams_total || match.eff_non_teams || match.value || match.amount || 0);
                                                                                                  } else {
                                                                                                     const companyKey = Object.keys(nts).find(k => String(k).trim().toLowerCase() === String(cRule.companyId || '').trim().toLowerCase());
                                                                                                     if (companyKey) effNT = Number(nts[companyKey] || 0);
                                                                                                  }
                                                                                               }
                                                                                            }
                                                                                            if (effNT <= 0 && (!cRule.companyId || cRule.companyId === 'ALL')) {
                                                                                               const puData = finImportPerUnitData.find(d => (d.week_ending || '').startsWith(targetDateStr));
                                                                                               effNT = puData ? (Number(puData.eff_non_teams_total) || 0) : 0;
                                                                                            }
                                                                                            
                                                                                            const dObj = new Date(targetDateStr);
                                                                                            while(dObj.getUTCDay() !== 4) {
                                                                                                dObj.setUTCDate(dObj.getUTCDate() + 1);
                                                                                            }
                                                                                            const payDateStr = dObj.toISOString().split('T')[0];
                                                                                            
                                                                                            if (seenDates2.has(payDateStr)) return null;
                                                                                            seenDates2.add(payDateStr);

                                                                                            if (payDateStr < '2026-02-19') return null;

                                                                                            let weeksDivider = 52;
                                                                                            if (cRule.valid_from && cRule.valid_to) {
                                                                                               const dFrom = new Date(cRule.valid_from);
                                                                                               const dTo = new Date(cRule.valid_to);
                                                                                               if (!isNaN(dFrom.getTime()) && !isNaN(dTo.getTime())) {
                                                                                                  const daysDiff = (dTo.getTime() - dFrom.getTime()) / (1000 * 60 * 60 * 24);
                                                                                                  if (daysDiff > 0) weeksDivider = daysDiff / 7;
                                                                                               }
                                                                                            }

                                                                                            const baseAmt = Number(cRule.amount || cRule.amount_after || 0);
                                                                                            const weeklyAmt = baseAmt / weeksDivider;
                                                                                            const perUnitAmt = effNT > 0 ? weeklyAmt / effNT : 0;
                                                                                            let sharedResp = 0;
                                                                                            let compPay = 0;
                                                                                            if (effNT <= 0) {
                                                                                                compPay = weeklyAmt;
                                                                                                sharedResp = 0;
                                                                                            } else if ((mclooEditModes[cRule.id] ? mclooEditModes[cRule.id] === 'base' : ((cRule as any).company_base_for_mcloo !== undefined && (cRule as any).company_base_for_mcloo !== null && String((cRule as any).company_base_for_mcloo).trim() !== ''))) {
                                                                                                const baseLimit = Number((cRule as any).company_base_for_mcloo || 0);
                                                                                                compPay = Math.min(perUnitAmt, baseLimit);
                                                                                                sharedResp = Math.max(0, perUnitAmt - baseLimit);
                                                                                            } else {
                                                                                                const sharedVal = Number((cRule as any).shared_insurance || 0);
                                                                                                compPay = perUnitAmt <= sharedVal ? perUnitAmt : perUnitAmt - sharedVal;
                                                                                                sharedResp = perUnitAmt <= sharedVal ? 0 : sharedVal;
                                                                                            }
                                                                                            const compPayColor = compPay > 0 ? 'text-rose-500' : compPay < 0 ? 'text-emerald-500' : 'text-zinc-400';
                                                                                            const sharedRespColor = 'text-amber-500';
                                                                                            return (
                                                                                               <div key={`${targetDateStr}_${index}`} className="flex items-center gap-6 py-1 border-b border-amber-900/10 last:border-0">
                                                                                                <div className="w-24 text-[10px] text-zinc-300 font-mono">{payDateStr}</div>
                                                                                                <div className="w-28 text-[10px] text-zinc-300 font-mono">{effNT > 0 ? `Total (PU): ${perUnitAmt.toFixed(2)}` : `Weekly: ${weeklyAmt.toFixed(2)}`}</div>
                                                                                                <div className={`w-32 text-[10px] font-mono font-bold ${compPayColor}`}>Comp Pay: {compPay.toFixed(2)}</div>
                                                                                                <div className={`w-40 text-[10px] font-mono font-bold ${sharedRespColor}`}>Shared Resp: {sharedResp.toFixed(2)}</div>
                                                                                             </div>
                                                                                            );
                                                                                         });
                                                                                      const validRows = rows.filter(Boolean);
                                                                                      if (validRows.length === 0) return <div className="text-[10px] text-zinc-500 italic">No valid dates found.</div>;
                                                                                                                     return validRows;
                                                                                                                  })()}
                                                                                                               </div>
                                                                                                            </div>
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                );
                                                                                            }

                                                                                            if (exp.key === 'avg_truck_price' && expandedDphRules.includes(String(cRule.id))) {
                                                                                                fragmentRows.push(
                                                                                                    <tr key={`${cRule.id}_expanded_dph_c`} className="bg-amber-500/5">
                                                                                                        <td colSpan={5} className="px-3 pb-3 pt-0 border-t-0">
                                                                                                            <div className="flex flex-col gap-3 bg-zinc-950/50 p-3 rounded-lg border border-amber-500/20 w-full relative ml-4">
                                                                                                                <div className="absolute -top-2.5 -left-3 text-amber-500/30">
                                                                                                                    <CornerDownRight size={16} />
                                                                                                                </div>
                                                                                                                {(() => {
                                                                                                                    let curFc = (cRule as any).franchise_charge;
                                                                                                                    if (typeof curFc === 'string') { try { curFc = JSON.parse(curFc); } catch(e){ curFc = []; } }
                                                                                                                    if (!Array.isArray(curFc)) curFc = [];
                                                                                                                    if (curFc.length === 0) curFc = [{ contract: '', amount: '' }];
                                                                                                                    return (
                                                                                                                        <>
                                                                                                                            {curFc.map((fc: any, i: number) => (
                                                                                                                                <div key={i} className="flex items-center gap-4">
                                                                                                                                    <div className="flex flex-col gap-1 w-48">
                                                                                                                                        <label className="text-[8px] text-amber-500/70 font-bold uppercase tracking-wider">Contract</label>
                                                                                                                                        <select value={fc.contract} onChange={(e) => { const newFc = curFc.map((item: any, idx: number) => idx === i ? { ...item, contract: e.target.value } : item); handleCompanyExpenseChange(cRule.id, 'franchise_charge' as any, newFc); }} className="w-full bg-zinc-900 border border-amber-700/50 rounded py-1 px-2 text-xs text-zinc-200 focus:border-amber-500 outline-none">
                                                                                                                                            <option value="" disabled>Select Contract</option>
                                                                                                                                            {availableContractTypes.map(c => <option key={c as string} value={c as string}>{c}</option>)}
                                                                                                                                        </select>
                                                                                                                                    </div>
                                                                                                                                   
                                                                                                                                   
                                                                                           
                                                                                                                                    <button onClick={() => { const newFc = curFc.filter((_: any, idx: number) => idx !== i); handleCompanyExpenseChange(cRule.id, 'franchise_charge' as any, newFc); }} className="mt-4 text-zinc-500 hover:text-rose-500"><Trash2 size={14}/></button>
                                                                                                                                </div>
                                                                                                                            ))}
                                                                                                                            <button onClick={() => { const newFc = [...curFc, { contract: '', amount: '' }]; handleCompanyExpenseChange(cRule.id, 'franchise_charge' as any, newFc); }} className="text-amber-500 text-[10px] font-bold uppercase w-max hover:text-amber-400 mt-2 flex items-center gap-1"><Plus size={10}/> Add Rule</button>
                                                                                                                        </>
                                                                                                                    );
                                                                                                                })()}
                                                                                                            </div>
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                );
                                                                                            }
                                                                                        });

                                                                                        if (exp.key === 'avg_truck_price' && gRule && expandedDphRules.includes(gRule.id)) {
                                                                                            const dObj = new Date(dateStr);
                                                                                            const vfObj = new Date(dObj); vfObj.setUTCDate(dObj.getUTCDate() - 5);
                                                                                            const vfStr = vfObj.toISOString().split('T')[0];
                                                                                           const savedOverride = globalOverrides.find(go => go.valid_from === vfStr);
                                                                                            const separatedRules = localFixedExpenses.filter(e => e.name === exp.name && e.valid_from === vfStr && e.companyId === 'ALL' && e.contractType && e.franchise_charge !== undefined && e.franchise_charge !== null && !e.amount && !e.cpm);
                                                                                            let currentFranchiseCharge = (gRule as any).franchise_charge;
if (currentFranchiseCharge === undefined) {
    if (separatedRules.length > 0) {
        currentFranchiseCharge = separatedRules.map(e => ({ contract: e.contractType, amount: e.franchise_charge, dph: (e as any).dph }));
    } else {
        currentFranchiseCharge = (savedOverride as any)?.franchise_charge ?? [];
    }
}
                                                                                            if (typeof currentFranchiseCharge === 'string') { try { currentFranchiseCharge = JSON.parse(currentFranchiseCharge); } catch(e) { currentFranchiseCharge = []; } }
                                                                                            if (!Array.isArray(currentFranchiseCharge)) currentFranchiseCharge = [];
                                                                                            if (currentFranchiseCharge.length === 0) currentFranchiseCharge = [{ contract: '', amount: '' }];

                                                                                            
                                                                                            fragmentRows.push(
                                                                                                <tr key={`${gRule.id}_expanded_dph`} className="bg-zinc-900/50">
                                                                                                    <td colSpan={5} className="px-3 pb-3 pt-0 border-t-0">
                                                                                                        <div className="flex flex-col gap-3 bg-zinc-950/50 p-3 rounded-lg border border-zinc-700 w-full relative ml-4 mt-2">
                                                                                                            <div className="absolute -top-2.5 -left-3 text-zinc-600">
                                                                                                                <CornerDownRight size={16} />
                                                                                                            </div>
                                                                                                            {currentFranchiseCharge.map((fc: any, i: number) => (
                                                                                                                <div key={i} className="flex items-center gap-4">
                                                                                                                    <div className="flex flex-col gap-1 w-48">
                                                                                                                        <label className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">Contract</label>
                                                                                                                        <select value={fc.contract} onChange={(e) => { const newFc = currentFranchiseCharge.map((item: any, idx: number) => idx === i ? { ...item, contract: e.target.value } : item); handleFinImportChange(gRule.id, 'franchise_charge', newFc as any); }} className="w-full bg-zinc-950 border border-zinc-700 rounded py-1 px-2 text-xs text-zinc-200 focus:border-emerald-500 outline-none">
                                                                                                                            <option value="" disabled>Select Contract</option>
                                                                                                                            {availableContractTypes.map(c => <option key={c as string} value={c as string}>{c}</option>)}
                                                                                                                        </select>
                                                                                                                    </div>
                                                                                                                    
                                                                                                                           <div className="flex flex-col gap-1 w-32">
                                                                                                                                <label className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">Charge to franchise</label>
                                                                                                                                <div className="relative h-7 w-full">
                                                                                                                                    <span className="absolute left-2 top-1.5 text-zinc-500 text-[10px] pointer-events-none">$</span>
                                                                                                                                    <input type="number" value={fc.amount} onChange={(e) => { const newFc = currentFranchiseCharge.map((item: any, idx: number) => idx === i ? { ...item, amount: e.target.value } : item); handleFinImportChange(gRule.id, 'franchise_charge', newFc as any); }} className="w-full bg-zinc-950 border border-zinc-700 rounded py-0 pl-6 pr-2 text-xs text-zinc-200 focus:border-emerald-500 outline-none h-full" />
                                                                                                                                </div>
                                                                                                                            </div>
                                                                                                                            <div className="flex flex-col gap-1 mt-4">
                                                                                                                                <span className="text-[10px] text-emerald-500 font-mono font-bold whitespace-nowrap">
                                                                                                                                    New Amount: {(() => {
                                                                                                                                        const puData = finImportPerUnitData.find(d => d.week_ending === dateStr);
                                                                                                                                        const puVal = puData ? Math.abs(puData[(exp as any).puKey] || 0) : 0;
                                                                                                                                        const hasStateCustom = (gRule as any)[`is_custom_${exp.key}`] !== undefined;
                                                                                                                                        const isCustom = hasStateCustom ? !!(gRule as any)[`is_custom_${exp.key}`] : !!savedOverride;
                                                                                                                                        const customVal = hasStateCustom ? ((gRule as any)[`custom_val_${exp.key}`] || '') : (savedOverride ? savedOverride.amount : '');
                                                                                                                                        const mainAmount = Number(isCustom ? customVal : puVal) || 0;
                                                                                                                                        return mainAmount - Number(fc.amount || 0);
                                                                                                                                    })()}
                                                                                                                                </span>
                                                                                                                            </div>
                                                                                                                    <button onClick={() => { const newFc = currentFranchiseCharge.filter((_: any, idx: number) => idx !== i); handleFinImportChange(gRule.id, 'franchise_charge', newFc as any); }} className="mt-4 text-zinc-500 hover:text-rose-500"><Trash2 size={14}/></button>
                                                                                                                </div>
                                                                                                            ))}
                                                                                                            <button onClick={() => { const newFc = [...currentFranchiseCharge, { contract: '', amount: '' }]; handleFinImportChange(gRule.id, 'franchise_charge', newFc as any); }} className="text-zinc-400 text-[10px] font-bold uppercase w-max hover:text-white mt-2 flex items-center gap-1"><Plus size={10}/> Add Rule</button>
                                                                                                        </div>
                                                                                                    </td>
                                                                                                </tr>
                                                                                            );
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
                                      const defaultCols = ['Plates', 'Factoring'].includes(en) ? ['valid_from', 'valid_to', 'amount'] : ['valid_from', 'valid_to', 'amount', 'unit'];
                                      const activeColumns = (expenseColumns[en] || defaultCols).filter(c => !(['Plates', 'Factoring'].includes(en) && c === 'unit'));
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
                                         ...(['Plates', 'Factoring'].includes(en) ? [] : [{ id: 'unit', label: 'Unit' }])
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
      </div>
    </div>
  );
};

export default SimulationModal;