import React, { useState, useEffect, useMemo } from 'react';
import { X, LayoutDashboard, Plus, Activity, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
const hasMclooFranchise = (drivers: any[], franchiseId: string) => {
  return drivers.some(d => d.contractType === 'MCLOO' && d.franchiseId === franchiseId);
};

interface SimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  drivers: any[];
  MasterTableComponent: React.FC<any>;
  calculateMetrics: any;
  companyMetrics: any;
  totalActiveCount: number;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  groupBy: any;
  setGroupBy: (groupBy: any) => void;
  chartData: any[];
  configContracts?: any[];
}

const Simulator: React.FC<SimulatorProps> = ({
  isOpen,
  onClose,
  drivers,
  MasterTableComponent,
  calculateMetrics,
  companyMetrics,
  totalActiveCount,
  selectedDate,
  setSelectedDate,
  groupBy,
  setGroupBy,
  chartData,
  configContracts
}) => {
  const driverWithEffectiveContracts = useMemo(() => {
    return drivers.map(d => {
      let effContract = d.contractType;
      if (d.contractType === 'TPOG' && d.franchiseId) {
        effContract = 'TPOG WITH FRANCHISE';
      } else if (d.contractType === 'OO' && d.franchiseId && hasMclooFranchise(drivers, d.franchiseId)) {
        effContract = 'OO WITH FRANCHISE';
      }
      return { ...d, contractType: effContract, originalContractType: d.contractType };
    });
  }, [drivers]);
  const [lockedDataRecords, setLockedDataRecords] = useState<any[]>([]);
  const [activeSimulator, setActiveSimulator] = useState<string>('revenueSplits');
  const [hasModified, setHasModified] = useState<boolean>(false);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'}>({ key: 'activeOldPercent', direction: 'asc' });
  const [selectedContractSim, setSelectedContractSim] = useState<string>('TPOG');
  const [tableContractFilter, setTableContractFilter] = useState<string>('TPOG');
  
  // DRŽIMO STATE ZA SVA 3 PROCENTA
  const [simCompanyTake, setSimCompanyTake] = useState<number>(0);
  const [simMarginTake, setSimMarginTake] = useState<number>(0);
  const [simDispatcherTake, setSimDispatcherTake] = useState<number>(0);
  const [simDispatcherMarginTake, setSimDispatcherMarginTake] = useState<number>(0);
  
  const availableContracts = useMemo(() => {
    const baseContracts = Array.from(new Set(driverWithEffectiveContracts.map(d => d.contractType))).filter(Boolean) as string[];
    if (configContracts) {
      const tpogRule = [...configContracts].filter(c => c.contract_type === 'TPOG').sort((a,b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
      const franRule = [...configContracts].filter(c => c.contract_type === 'TPOG WITH FRANCHISE').sort((a,b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
      const areRulesSame = tpogRule && franRule && 
                           tpogRule.calculation_type === franRule.calculation_type &&
                           tpogRule.mc_gross_percent === franRule.mc_gross_percent &&
                           tpogRule.mc_margin_percent === franRule.mc_margin_percent &&
                           tpogRule.dispatcher_gross_percent === franRule.dispatcher_gross_percent &&
                           (tpogRule as any).dispatcher_margin_percent === (franRule as any).dispatcher_margin_percent;
      if (areRulesSame) {
        return baseContracts.filter(c => c !== 'TPOG WITH FRANCHISE').sort();
      }
    }
    return baseContracts.sort();
  }, [driverWithEffectiveContracts, configContracts]);

  useEffect(() => {
    if (availableContracts.length > 0 && !availableContracts.includes(selectedContractSim)) {
      setSelectedContractSim(availableContracts.includes('TPOG') ? 'TPOG' : availableContracts[0]);
    }
  }, [availableContracts, selectedContractSim]);

  useEffect(() => {
    setTableContractFilter(selectedContractSim);
  }, [selectedContractSim]);
  
  useEffect(() => {
    if (configContracts) {
      const latestConf = [...configContracts]
        .filter(c => c.contract_type === selectedContractSim)
        .sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
      if (latestConf) {
        setSimCompanyTake(Number(((latestConf.mc_gross_percent || 0) * 100).toFixed(2)));
        setSimMarginTake(Number(((latestConf.mc_margin_percent || 0) * 100).toFixed(2)));
        setSimDispatcherTake(Number(((latestConf.dispatcher_gross_percent || 0) * 100).toFixed(2)));
        setSimDispatcherMarginTake(Number((((latestConf as any).dispatcher_margin_percent || 0) * 100).toFixed(2)));
      } else {
        setSimCompanyTake(0);
        setSimMarginTake(0);
        setSimDispatcherTake(0);
        setSimDispatcherMarginTake(0);
      }
    }
  }, [selectedContractSim, configContracts]);
  
  useEffect(() => {
    if (selectedContractSim !== 'TPOG' && activeSimulator !== 'revenueSplits') {
      setActiveSimulator('revenueSplits');
    }
  }, [selectedContractSim, activeSimulator]);
  
  const [baseRate, setBaseRate] = useState<number>(0);
  
  const [enableWeeksOut, setEnableWeeksOut] = useState<boolean>(true);
  const [weeksOutTiers, setWeeksOutTiers] = useState<any[]>([]);
  const [weeksOutWeeklyMileage, setWeeksOutWeeklyMileage] = useState<number>(3000);
  
  const [enableSafety, setEnableSafety] = useState<boolean>(true);
  const [safetyScoreBonus, setSafetyScoreBonus] = useState<number>(2);
  const [safetyScoreThreshold, setSafetyScoreThreshold] = useState<number>(90);
  const [safetyScoreMileageThreshold, setSafetyScoreMileageThreshold] = useState<number>(2000);
  const [safetyBonusForfeitedOnSpeeding, setSafetyBonusForfeitedOnSpeeding] = useState<boolean>(true);
  
  const [enableSpeeding, setEnableSpeeding] = useState<boolean>(true);
  const [speedingRangeTiers, setSpeedingRangeTiers] = useState<any[]>([]);
  
  const [enableGrossTarget, setEnableGrossTarget] = useState<boolean>(false);
  const [grossTargetTiers, setGrossTargetTiers] = useState<any[]>([]);
  
  const [enableTenure, setEnableTenure] = useState<boolean>(true);
  const [tenureMilestones, setTenureMilestones] = useState<any[]>([]);

  const [enableFuel, setEnableFuel] = useState<boolean>(true);
  const [fuelMpgRules, setFuelMpgRules] = useState<any[]>([]);
  useEffect(() => {
    if (isOpen) {
      const fetchLockedData = async () => {
        let allData: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase.from('locked_data').select('*').order('pay_date', { ascending: false }).range(from, from + 999);
          if (error || !data || data.length === 0) break;
          allData.push(...data);
          if (data.length < 1000) break;
          from += 1000;
        }
        setLockedDataRecords(allData);
      };
      fetchLockedData();
    }
  }, [isOpen]);

  useEffect(() => {
    const dates = Array.from(new Set(lockedDataRecords.map(r => String(r.pay_date).split('T')[0]).filter(Boolean))).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const actualDate = (selectedDate === 'ALL' || selectedDate === 'LATEST') && dates.length > 0 ? dates[0] : selectedDate;
    if (lockedDataRecords.length > 0 && isOpen && actualDate && actualDate !== 'ALL' && actualDate !== 'LATEST') {
      const recordsForDate = lockedDataRecords.filter(r => String(r.pay_date).startsWith(String(actualDate).split('T')[0]));
      let settings = null;
      for (const r of recordsForDate) {
        let j = null;
        try { j = r.locked_data ? (typeof r.locked_data === 'string' ? JSON.parse(r.locked_data) : r.locked_data) : r; } catch(e) { j = r; }
        if (Array.isArray(j)) {
          const d = j.find((x: any) => x.contract_type === 'TPOG' && x.lockedSettings);
          if (d) { settings = d.lockedSettings; break; }
        } else if (j && j.contract_type === 'TPOG' && j.lockedSettings) {
          settings = j.lockedSettings; break;
        }
      }
      if (settings) {
          setBaseRate(settings.baseRate ?? 0);
          
          if (settings.enabledMetrics) {
            setEnableGrossTarget(settings.enabledMetrics.grossTarget ?? false);
            setEnableWeeksOut(settings.enabledMetrics.weeksOut ?? true);
            setEnableSafety(settings.enabledMetrics.safety ?? true);
            setEnableSpeeding(settings.enabledMetrics.speeding ?? true);
          setEnableTenure(settings.enabledMetrics.tenure ?? true);
          setEnableFuel(settings.enabledMetrics.fuel ?? true);
        }

        if (settings.weeksOutTiers) setWeeksOutTiers(settings.weeksOutTiers);
          setWeeksOutWeeklyMileage(settings.weeksOutWeeklyMileage ?? 3000);
          
          if (settings.safetyScoreBonus !== undefined) setSafetyScoreBonus(settings.safetyScoreBonus);
          setSafetyScoreThreshold(settings.safetyScoreThreshold ?? 90);
          setSafetyScoreMileageThreshold(settings.safetyScoreMileageThreshold ?? 2000);
          setSafetyBonusForfeitedOnSpeeding(settings.safetyBonusForfeitedOnSpeeding ?? true);
          
          if (settings.speedingRangeTiers) setSpeedingRangeTiers(settings.speedingRangeTiers);
          if (settings.grossTargetTiers) setGrossTargetTiers(settings.grossTargetTiers);
          if (settings.tenureMilestones) setTenureMilestones(settings.tenureMilestones);
          if (settings.mpgPercentileTiers) {
             const tiers = settings.mpgPercentileTiers;
             const newRules = tiers.map((tier: any, idx: number) => {
                const nextTier = tiers[idx + 1];
                return {
                    id: String(idx),
                    min: tier.threshold,
                    max: nextTier ? nextTier.threshold - 0.01 : 100,
                    percent: tier.bonus
                };
             });
             setFuelMpgRules(newRules);
          }
          
          setHasModified(false);
        }
      }
  }, [selectedDate, lockedDataRecords, isOpen]);

  const handleChange = (setter: any, value: any) => {
    setHasModified(true);
    if (typeof value === 'boolean') {
      setter(value);
    } else {
      const numValue = value === '' ? 0 : parseFloat(value);
      if (!isNaN(numValue)) {
        setter(numValue);
      }
    }
  };

  const handleUpdateTier = (setter: any, index: number, field: string, value: string) => {
    setHasModified(true);
    const numValue = value === '' ? 0 : parseFloat(value);
    if (!isNaN(numValue)) {
      setter((prev: any[]) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: numValue };
        return next;
      });
    }
  };

  const uniqueDates = useMemo(() => {
    const dates = new Set([
      ...lockedDataRecords.map(r => String(r.pay_date).split('T')[0]),
      ...drivers.map(d => String(d.payDate || '').split('T')[0])
    ].filter(Boolean));
    return Array.from(dates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [lockedDataRecords, drivers]);

  const targetDate = (selectedDate === 'ALL' || selectedDate === 'LATEST') && uniqueDates.length > 0 ? uniqueDates[0] : selectedDate;

  const activeDrivers = useMemo(() => {
    const dateFiltered = driverWithEffectiveContracts.filter(d => String(d.payDate || '').startsWith(String(targetDate).split('T')[0]));
    if (tableContractFilter === 'ALL') return dateFiltered;
    
    if (tableContractFilter === 'TPOG' && configContracts) {
         const tpogRule = [...configContracts].filter(c => c.contract_type === 'TPOG').sort((a,b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
         const franRule = [...configContracts].filter(c => c.contract_type === 'TPOG WITH FRANCHISE').sort((a,b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
         const areRulesSame = tpogRule && franRule && 
                              tpogRule.calculation_type === franRule.calculation_type &&
                              tpogRule.mc_gross_percent === franRule.mc_gross_percent &&
                              tpogRule.mc_margin_percent === franRule.mc_margin_percent &&
                              tpogRule.dispatcher_gross_percent === franRule.dispatcher_gross_percent &&
                              (tpogRule as any).dispatcher_margin_percent === (franRule as any).dispatcher_margin_percent;
         if (areRulesSame || !franRule) {
             return dateFiltered.filter(d => d.contractType === 'TPOG' || d.contractType === 'TPOG WITH FRANCHISE');
         }
    }
    return dateFiltered.filter(d => d.contractType === tableContractFilter);
  }, [driverWithEffectiveContracts, targetDate, tableContractFilter, configContracts]);

  const targetDateRecords = useMemo(() => {
    if (!targetDate) return [];
    const records = lockedDataRecords
      .filter(r => String(r.pay_date).startsWith(String(targetDate).split('T')[0]))
      .flatMap(r => {
        let parsed = null;
        try { parsed = r.locked_data ? (typeof r.locked_data === 'string' ? JSON.parse(r.locked_data) : r.locked_data) : r; } catch(e) { parsed = r; }
        if (Array.isArray(parsed)) {
          return parsed.map((item: any) => ({ ...r, json: item }));
        }
        return [{ ...r, json: parsed }];
      })
      .filter(r => r.json && r.json.contract_type === 'TPOG');

    if (records.length === 0) {
      return activeDrivers.filter(d => d.contractType === 'TPOG').map(d => ({
        driver_name: d.name,
        pay_date: d.payDate,
        json: {
          name: d.name,
          contract_type: 'TPOG',
          gross: d.totalGross || d.grossRevenue || 0,
          milesWeek: d.milesDriven || 0,
          distance: d.milesDriven || 0,
          weeksOut: d.streakWeeks || 0,
          safetyScore: 100,
          speedingAlerts: 0,
          tenure: d.weeksActive || 0,
          mpgPercentile: 50,
          baseRate: 0,
          lockedSettings: {
            baseRate: 0,
            enabledMetrics: {
              grossTarget: true,
              weeksOut: true,
              safety: true,
              tenure: true,
              fuel: true
            },
            weeksOutTiers: [],
            weeksOutWeeklyMileage: 3000,
            safetyScoreBonus: 2,
            safetyScoreThreshold: 90,
            safetyScoreMileageThreshold: 2000,
            safetyBonusForfeitedOnSpeeding: true,
            speedingRangeTiers: [],
            grossTargetTiers: [],
            tenureMilestones: []
          },
          bonuses: []
        }
      }));
    }
    return records;
  }, [lockedDataRecords, targetDate, activeDrivers]);

  const processedData = useMemo(() => {
    if (selectedContractSim === 'ALL') return [];
    const currentConfig = [...(configContracts || [])]
      .filter(c => c.contract_type === selectedContractSim)
      .sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
      
    const calcType = currentConfig?.calculation_type || 'MCLOO_STYLE';
    const oldCompTake = currentConfig ? (currentConfig.mc_gross_percent || 0) * 100 : 0;
    const oldMargTake = currentConfig ? (currentConfig.mc_margin_percent || 0) * 100 : 0;
    const oldDispTake = currentConfig ? (currentConfig.dispatcher_gross_percent || 0) * 100 : 0;
    const oldDispMargTake = currentConfig ? ((currentConfig as any).dispatcher_margin_percent || 0) * 100 : 0;

    return activeDrivers.filter(d => {
        if (selectedContractSim === 'TPOG' || selectedContractSim === 'TPOG WITH FRANCHISE') {
             const tpogRule = currentConfig;
             const otherContract = selectedContractSim === 'TPOG' ? 'TPOG WITH FRANCHISE' : 'TPOG';
             const otherRule = [...(configContracts || [])].filter(c => c.contract_type === otherContract).sort((a,b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
             const areRulesSame = tpogRule && otherRule && 
                                  tpogRule.calculation_type === otherRule.calculation_type &&
                                  tpogRule.mc_gross_percent === otherRule.mc_gross_percent &&
                                  tpogRule.mc_margin_percent === otherRule.mc_margin_percent &&
                                  tpogRule.dispatcher_gross_percent === otherRule.dispatcher_gross_percent &&
                                  (tpogRule as any).dispatcher_margin_percent === (otherRule as any).dispatcher_margin_percent;
             if (areRulesSame || !otherRule) {
                 return d.contractType === 'TPOG' || d.contractType === 'TPOG WITH FRANCHISE';
             }
        }
        return d.contractType === selectedContractSim;
    }).map(driver => {
      const gross = driver.totalGross || driver.grossRevenue || 0;
      const margin = driver.marginAmount || 0;
      const netPay = driver.netPay || 0;
      
      const rawDriverPct = driver.driverPercentage || driver.contract || 0;
      const driverPct = rawDriverPct > 1 ? rawDriverPct / 100 : rawDriverPct; // Normalizacija u 0.xx

      let totalDiffDollars = 0;
      let activeOldPercent: number | string = 0;
      let activeNewPercent: number | string = 0;
      let activeOldDollars = 0;
      let activeNewDollars = 0;
      let activePnlImpact = 0;
      
      if (activeSimulator === 'revenueSplits') {
        const newC = hasModified ? simCompanyTake : oldCompTake;
        const newM = hasModified ? simMarginTake : oldMargTake;
        const newD = hasModified ? simDispatcherTake : oldDispTake;
        const newDM = hasModified ? simDispatcherMarginTake : oldDispMargTake;

        // Određujemo koja polja formula zaista koristi za prikaz u tabeli
        const needsComp = ['MCLOO_STYLE', 'OO_NONF', 'OO_FRANCHISE', 'TPOG_FRANCHISE', 'NEW_FORMULA'].includes(calcType);
        const needsMarg = ['MCLOO_STYLE', 'OO_NONF', 'OO_FRANCHISE', 'TPOG_NONF', 'TPOG_FRANCHISE', 'CPM_STYLE', 'POG_STYLE', 'NEW_FORMULA'].includes(calcType);
        const needsDisp = ['TPOG_NONF', 'TPOG_FRANCHISE', 'POG_STYLE', 'NEW_FORMULA'].includes(calcType);
        const needsDispMarg = ['NEW_FORMULA'].includes(calcType);

        let oldStr = []; let newStr = [];
        if (needsComp) { oldStr.push(`${Number(oldCompTake).toFixed(1)}%`); newStr.push(`${Number(newC).toFixed(1)}%`); }
        if (needsMarg) { oldStr.push(`${Number(oldMargTake).toFixed(1)}%`); newStr.push(`${Number(newM).toFixed(1)}%`); }
        if (needsDisp) { oldStr.push(`${Number(oldDispTake).toFixed(1)}%`); newStr.push(`${Number(newD).toFixed(1)}%`); }
        if (needsDispMarg) { oldStr.push(`${Number(oldDispMargTake).toFixed(1)}%`); newStr.push(`${Number(newDM).toFixed(1)}%`); }

        activeOldPercent = oldStr.length > 0 ? oldStr.join(' / ') : 'N/A';
        activeNewPercent = newStr.length > 0 ? newStr.join(' / ') : 'N/A';

        const calculateFormula = (type: string, g: number, m: number, nP: number, dP: number, cP: number, mP: number, dispP: number, dispMP: number) => {
           const cpDec = (cP || 0) / 100;
           const mpDec = (mP || 0) / 100;
           const dispDec = (dispP || 0) / 100;
           const dispMargDec = (dispMP || 0) / 100;
           const safeDp = dP || 0;
           switch(type) {
             case 'MCLOO_STYLE': return (g * cpDec) + (m * mpDec);
             case 'OO_NONF':
             case 'OO_FRANCHISE': return (g * cpDec) + (m * mpDec);
             case 'TPOG_NONF': return ((g * ((1 - safeDp) - dispDec)) + (m * mpDec)) * 1.0; 
             case 'TPOG_FRANCHISE': return ((g * ((1 - safeDp) - dispDec)) + (m * mpDec)) * cpDec;
             case 'POG_STYLE': return ((g * ((1 - safeDp) - dispDec)) + (m * mpDec)) * 1.0;
             case 'CPM_STYLE': return (g + (m * mpDec)) - nP;
             case 'NEW_FORMULA': return (cpDec * (g + m - (m * mpDec))) - (safeDp * g) - ((dispDec * g) + (m * dispMargDec));
             default: return (g * cpDec) + (m * mpDec);
           }
        };

        activeOldDollars = calculateFormula(calcType, gross, margin, netPay, driverPct, oldCompTake, oldMargTake, oldDispTake, oldDispMargTake);
        activeNewDollars = calculateFormula(calcType, gross, margin, netPay, driverPct, newC, newM, newD, newDM);
        
        activePnlImpact = activeNewDollars - activeOldDollars;
        totalDiffDollars = -activePnlImpact;
        
      } else if (selectedContractSim === 'TPOG') {
        const record = targetDateRecords.find(r => (r.json?.name || r.driver_name) === driver.name);
        if (!record) return null;
        const json = record.json;
        const settings = json.lockedSettings;
        if (!settings) return null;
        const milesWeek = Number(json.milesWeek) || Number(json.distanceSource === 'milesWeek' ? json.milesWeek : json.distance) || Number(json.distance) || Number(json.metrics?.milesWeek) || Number(json.metrics?.distance) || 0;
        const weeksOut = Number(json.weeksOut) || Number(json.metrics?.weeksOut) || 0;
        const safetyScore = Number(json.safetyScore) || Number(json.metrics?.safetyScore) || 0;
        const speedingAlerts = Number(json.speedingAlerts) || Number(json.metrics?.speedingAlerts) || 0;
        const tenure = Number(json.tenure) || Number(json.metrics?.tenure) || 0;
        const mpgPercentile = Number(json.mpgPercentile) || Number(json.metrics?.mpgPercentile) || 0;
        const oldB = Number(json.baseRate) || Number(json.base_rate) || Number(settings.baseRate) || 0;
        const extractPercent = (source: any, exactName: string, fallbacks: string[]) => {
          if (!source || typeof source !== 'object') return 0;
          if (source[exactName] && source[exactName].bonus !== undefined) return Number(source[exactName].bonus);
          const keys = [exactName, ...fallbacks];
          if (Array.isArray(source)) {
            const found = source.find((b:any) => keys.some(k => String(b.name || '').toLowerCase().includes(k.toLowerCase())));
            if (found) {
              if (found.percent !== undefined) return Number(found.percent);
              if (found.bonus !== undefined) return Number(found.bonus);
              if (found.penalty !== undefined) return Number(found.penalty);
            }
          } else {
            for (const sourceKey of Object.keys(source)) {
              if (keys.some(k => sourceKey.toLowerCase().includes(k.toLowerCase()))) {
                const val = source[sourceKey];
                if (typeof val === 'object' && val !== null) {
                  if (val.percent !== undefined) return Number(val.percent);
                  if (val.bonus !== undefined) return Number(val.bonus);
                  if (val.penalty !== undefined) return Number(val.penalty);
                  if (val.amount !== undefined && gross > 0) return (Number(val.amount) / gross) * 100;
                } else {
                  return Number(val) || 0;
                }
              }
            }
          }
          return 0;
        };
        const bonusesObj = json.bonuses || {};
        let oldW = extractPercent(bonusesObj, 'Weeks Out', ['Retention', 'WeeksOut']);
        let oldSa = extractPercent(bonusesObj, 'Safety Score', ['Safety']);
        let oldG = extractPercent(bonusesObj, 'Gross Target', ['Gross Bonus', 'Gross']);
        let oldT = extractPercent(bonusesObj, 'Tenure', ['Longevity']);
        let oldF = extractPercent(bonusesObj, 'Fuel Efficiency', ['Fuel', 'MPG']);
        let oldSp = extractPercent(bonusesObj, 'Speeding Penalty', ['Speeding']);
        if (oldSp === 0) oldSp = extractPercent(json.penalties || {}, 'Speeding Penalty', ['Speeding']);
        if (oldSp === 0) oldSp = extractPercent(json.deductions || {}, 'Speeding Penalty', ['Speeding']);
        let expW = 0;
        if (settings.enabledMetrics?.weeksOut !== false && milesWeek >= (settings.weeksOutWeeklyMileage || 0)) {
          const tier = [...(settings.weeksOutTiers || [])].sort((a:any, b:any) => b.threshold - a.threshold).find((t:any) => weeksOut >= t.threshold);
          if (tier) expW = tier.bonus;
        }
        const isWIgnored = Math.abs(oldW - expW) > 0.01;
        let expSa = 0;
        let expSp = 0;
        if (settings.enabledMetrics?.safety !== false) {
          if (safetyScore >= (settings.safetyScoreThreshold || 0) && milesWeek >= (settings.safetyScoreMileageThreshold || 0)) {
            if (settings.safetyBonusForfeitedOnSpeeding === false || speedingAlerts === 0) {
              expSa = settings.safetyScoreBonus || 0;
            }
          }
          const tier = (settings.speedingRangeTiers || []).find((t:any) => speedingAlerts >= t.from && (t.to === null || speedingAlerts <= (t.to || 9999)));
          if (tier) expSp = tier.penalty;
        }
        const isSaIgnored = Math.abs(oldSa - expSa) > 0.01;
        const isSpIgnored = Math.abs(oldSp - expSp) > 0.01;
        let expG = 0;
        if (settings.enabledMetrics?.grossTarget !== false) {
          const tier = (settings.grossTargetTiers || []).find((t:any) => gross >= t.from && (t.to === null || gross <= (t.to || 999999)));
          if (tier) expG = tier.bonus;
        }
        const isGIgnored = Math.abs(oldG - expG) > 0.01;
        let expT = 0;
        if (settings.enabledMetrics?.tenure !== false) {
          (settings.tenureMilestones || []).forEach((t:any) => {
            if (tenure >= t.threshold) expT += t.bonus;
          });
        }
        const isTIgnored = Math.abs(oldT - expT) > 0.01;
        let expF = 0;
        if (settings.enabledMetrics?.fuel !== false) {
          const mpgTiers = settings.mpgPercentileTiers || [];
          const sorted = [...mpgTiers].sort((a:any, b:any) => b.threshold - a.threshold);
          const t = sorted.find((t:any) => mpgPercentile >= t.threshold);
          if (t) expF = t.bonus;
        }
        const isFIgnored = Math.abs(oldF - expF) > 0.01;
        let newB = oldB, newW = oldW, newSa = oldSa, newSp = oldSp, newG = oldG, newT = oldT, newF = oldF;
        if (hasModified) {
          newB = baseRate;
          if (!isWIgnored) {
            newW = 0;
            if (enableWeeksOut && milesWeek >= weeksOutWeeklyMileage) {
              const tier = [...weeksOutTiers].sort((a:any, b:any) => b.threshold - a.threshold).find((t:any) => weeksOut >= t.threshold);
              if (tier) newW = tier.bonus;
            }
          }
          if (!isSaIgnored) {
            newSa = 0;
            if (enableSafety && safetyScore >= safetyScoreThreshold && milesWeek >= safetyScoreMileageThreshold) {
              if (!safetyBonusForfeitedOnSpeeding || speedingAlerts === 0) {
                newSa = safetyScoreBonus;
              }
            }
          }
          if (!isSpIgnored) {
            newSp = 0;
            if (enableSpeeding) {
              const tier = speedingRangeTiers.find((t:any) => speedingAlerts >= t.from && (t.to === null || speedingAlerts <= (t.to || 9999)));
              if (tier) newSp = tier.penalty;
            }
          }
          if (!isGIgnored) {
            newG = 0;
            if (enableGrossTarget) {
              const tier = grossTargetTiers.find((t:any) => gross >= t.from && (t.to === null || gross <= (t.to || 999999)));
              if (tier) newG = tier.bonus;
            }
          }
          if (!isTIgnored) {
            newT = 0;
            if (enableTenure) {
              tenureMilestones.forEach((t:any) => {
                if (tenure >= t.threshold) newT += t.bonus;
              });
            }
          }
          if (!isFIgnored) {
            newF = 0;
            if (enableFuel) {
              const rule = fuelMpgRules.find((r:any) => mpgPercentile >= Number(r.min) && mpgPercentile <= Number(r.max));
              if (rule) newF = Number(rule.percent) || 0;
            }
          }
        }
        const totalDiffPercent = hasModified ? ((newB - oldB) + (newW - oldW) + (newSa - oldSa) + (newSp - oldSp) + (newG - oldG) + (newT - oldT) + (newF - oldF)) : 0;
        totalDiffDollars = gross * (totalDiffPercent / 100);
        if (activeSimulator === 'baseRate') { activeOldPercent = oldB; activeNewPercent = hasModified ? newB : oldB; }
        else if (activeSimulator === 'weeksOut') { activeOldPercent = oldW; activeNewPercent = hasModified ? newW : oldW; }
        else if (activeSimulator === 'safety') { activeOldPercent = oldSa; activeNewPercent = hasModified ? newSa : oldSa; }
        else if (activeSimulator === 'speeding') { activeOldPercent = oldSp; activeNewPercent = hasModified ? newSp : oldSp; }
        else if (activeSimulator === 'grossTarget') { activeOldPercent = oldG; activeNewPercent = hasModified ? newG : oldG; }
        else if (activeSimulator === 'tenure') { activeOldPercent = oldT; activeNewPercent = hasModified ? newT : oldT; }
        else if (activeSimulator === 'fuel') { activeOldPercent = oldF; activeNewPercent = hasModified ? newF : oldF; }
        activeOldDollars = gross * (activeOldPercent / 100);
        activeNewDollars = gross * (activeNewPercent / 100);
        activePnlImpact = activeOldDollars - activeNewDollars;
      }
      const currentRevenue = driver.companyPay || 0;
      const potentialRevenue = currentRevenue + activePnlImpact;
      return { driverName: driver.name, currentRevenue, potentialRevenue, totalDiffDollars, activeOldPercent, activeNewPercent, activeOldDollars, activeNewDollars, activePnlImpact, hasImpact: Math.abs(activeOldDollars - activeNewDollars) > 0.001 };
    }).filter(Boolean) as any[];
  }, [activeDrivers, targetDateRecords, hasModified, activeSimulator, baseRate, enableWeeksOut, weeksOutTiers, weeksOutWeeklyMileage, enableSafety, safetyScoreBonus, safetyScoreThreshold, safetyScoreMileageThreshold, safetyBonusForfeitedOnSpeeding, enableSpeeding, speedingRangeTiers, enableGrossTarget, grossTargetTiers, enableTenure, tenureMilestones, enableFuel, fuelMpgRules, selectedContractSim, simCompanyTake, simMarginTake, simDispatcherTake, simDispatcherMarginTake, configContracts]);

  const simulatedDrivers = useMemo(() => {
    const applied = new Set();
    return activeDrivers.map(driver => {
      let isTarget = driver.contractType === selectedContractSim;
      if (selectedContractSim === 'TPOG' && driver.contractType === 'TPOG WITH FRANCHISE') {
         const tpogRule = [...(configContracts || [])].filter(c => c.contract_type === 'TPOG').sort((a,b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
         const franRule = [...(configContracts || [])].filter(c => c.contract_type === 'TPOG WITH FRANCHISE').sort((a,b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
         const areRulesSame = tpogRule && franRule && 
                              tpogRule.calculation_type === franRule.calculation_type &&
                              tpogRule.mc_gross_percent === franRule.mc_gross_percent &&
                              tpogRule.mc_margin_percent === franRule.mc_margin_percent &&
                              tpogRule.dispatcher_gross_percent === franRule.dispatcher_gross_percent &&
                              (tpogRule as any).dispatcher_margin_percent === (franRule as any).dispatcher_margin_percent;
         if (areRulesSame || !franRule) isTarget = true;
      }

      if (!isTarget) return driver;

      const p = processedData.find(d => d.driverName === driver.name);
      if (p && !applied.has(driver.name)) {
        applied.add(driver.name);
        return {
          ...driver,
          netPay: driver.netPay + p.totalDiffDollars,
          companyPay: driver.companyPay - p.totalDiffDollars
        };
      }
      return driver;
    });
  }, [activeDrivers, processedData, selectedContractSim, configContracts]);

  const totalModuleImpact = useMemo(() => processedData.reduce((sum, d) => sum + d.activePnlImpact, 0), [processedData]);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedData = useMemo(() => {
    return [...processedData].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [processedData, sortConfig]);

  const formatMoney = (val: number) => {
    return val < 0 ? `-$${Math.abs(val).toFixed(2)}` : `$${val.toFixed(2)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex bg-black/80 backdrop-blur-md">
      <div className="flex-1 flex flex-col p-6 gap-6 overflow-hidden">
        <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col overflow-hidden shadow-2xl relative">
          <div className="p-3 border-b border-zinc-800 bg-zinc-900/80 flex justify-between items-center absolute top-0 left-0 right-0 z-10">
            <div className="flex items-center gap-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Original Data</h3>
              <select value={tableContractFilter} onChange={e => setTableContractFilter(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-purple-500 cursor-pointer">
                <option value="ALL">ALL</option>
                {availableContracts.filter(c => c !== 'UNRECONCILED' && c !== 'Unassigned').map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Pay Date:</span>
                <select value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setHasModified(false); }} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-purple-500 cursor-pointer">
                  {uniqueDates.map(d => <option key={d} value={d}>{d}</option>)}
                  {!uniqueDates.includes(selectedDate) && <option value={selectedDate}>{selectedDate}</option>}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Group By:</span>
                <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)} className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-purple-500 cursor-pointer">
                  <option value="Contract">Contract</option>
                  <option value="Company">Company</option>
                  <option value="Franchise">Franchise</option>
                  <option value="Team">Team</option>
                  <option value="Driver">Driver</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-auto pt-12 p-2">
            <MasterTableComponent
              companyMetrics={companyMetrics}
              drivers={activeDrivers}
              calculateMetrics={calculateMetrics}
              totalActiveCount={totalActiveCount}
              selectedDate={selectedDate}
              groupBy={groupBy}
              chartData={chartData}
            />
          </div>
        </div>
        <div className="flex-1 bg-zinc-950 border border-purple-900/50 rounded-lg flex flex-col overflow-hidden shadow-2xl relative">
          <div className="p-3 border-b border-purple-900/50 bg-purple-950/20 flex justify-between items-center absolute top-0 left-0 right-0 z-10">
            <h3 className="text-xs font-bold text-purple-500 uppercase tracking-wider">Simulated Data</h3>
          </div>
          <div className="flex-1 overflow-auto pt-12 p-2">
            <MasterTableComponent
              companyMetrics={companyMetrics}
              drivers={simulatedDrivers}
              calculateMetrics={calculateMetrics}
              totalActiveCount={totalActiveCount}
              selectedDate={selectedDate}
              groupBy={groupBy}
              chartData={chartData}
            />
          </div>
        </div>
      </div>
      <div className="w-[500px] bg-zinc-900 border-l border-zinc-700 flex flex-col shadow-2xl shrink-0 overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-950 shrink-0">
          <div className="flex items-center gap-2 text-purple-400">
            <LayoutDashboard size={18} />
            <h2 className="text-sm font-bold uppercase tracking-wider">Simulator</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-3 border-b border-zinc-800 bg-zinc-900/50 shrink-0 space-y-3">
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1.5">Select Contract</label>
            <select 
              value={selectedContractSim} 
              onChange={e => { setSelectedContractSim(e.target.value); setHasModified(false); }} 
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-purple-500 cursor-pointer"
            >
              {availableContracts.filter(c => c !== 'UNRECONCILED' && c !== 'Unassigned').map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1.5">Select Simulator Module</label>
            <select 
              value={activeSimulator} 
              onChange={e => setActiveSimulator(e.target.value)} 
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="revenueSplits">Revenue Splits</option>
              {selectedContractSim === 'TPOG' && (
                <>
                  <option value="weeksOut">Retention & Streak (Weeks Out)</option>
                  <option value="safety">Safety Score Bonus</option>
                  <option value="speeding">Speeding Penalties</option>
                  <option value="grossTarget">Gross Target Bonus</option>
                  <option value="tenure">Tenure Milestones</option>
                  <option value="fuel">Fuel Efficiency (MPG)</option>
                </>
              )}
            </select>
          </div>
        </div>

        <div className="bg-zinc-950 p-3 border-b border-zinc-800 flex justify-between items-center shrink-0">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">PnL Impact</span>
          <span className={`font-mono text-xl font-bold ${totalModuleImpact > 0 ? 'text-emerald-400' : totalModuleImpact < 0 ? 'text-rose-400' : 'text-zinc-500'}`}>
            {totalModuleImpact > 0 ? '+' : ''}{totalModuleImpact === 0 ? '$0.00' : formatMoney(totalModuleImpact)}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col custom-scrollbar">
          <div className="space-y-3 shrink-0">
            
            {activeSimulator === 'revenueSplits' && (() => {
                const currentRules = (configContracts || []).filter(c => c.contract_type === selectedContractSim).sort((a,b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime());
                const calcType = currentRules[0]?.calculation_type || 'MCLOO_STYLE';
                
                const needsComp = ['MCLOO_STYLE', 'OO_NONF', 'OO_FRANCHISE', 'TPOG_FRANCHISE', 'NEW_FORMULA'].includes(calcType);
                const needsMarg = ['MCLOO_STYLE', 'OO_NONF', 'OO_FRANCHISE', 'TPOG_NONF', 'TPOG_FRANCHISE', 'CPM_STYLE', 'POG_STYLE', 'NEW_FORMULA'].includes(calcType);
                const needsDisp = ['TPOG_NONF', 'TPOG_FRANCHISE', 'POG_STYLE', 'NEW_FORMULA'].includes(calcType);
                const needsDispMarg = ['NEW_FORMULA'].includes(calcType);

                return (
                  <div className="bg-zinc-950 border border-zinc-800 rounded p-3 space-y-2">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-1.5 flex items-center gap-1.5">
                      <span>Revenue Splits</span>
                      <div className="group relative cursor-help flex items-center">
                        <Info size={12} className="text-zinc-500 hover:text-purple-400 transition-colors" />
                        <div className="hidden group-hover:block absolute left-8 mt-12 w-64 bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded shadow-xl normal-case font-normal z-[9999] pointer-events-none text-left border border-zinc-600 whitespace-pre-wrap">
                          Adjust parameters to simulate how revenue rules affect PnL. Only variables applicable to the current contract's formula will be shown.
                        </div>
                      </div>
                    </h4>
                    
                    {needsComp && (
                      <div className="flex items-center gap-4 pt-1">
                        <label className="text-xs text-zinc-400 flex-1">{calcType === 'TPOG_FRANCHISE' ? 'Company Take %' : 'Company Gross %'}</label>
                        <input type="number" step="0.1" value={simCompanyTake} onChange={e => handleChange(setSimCompanyTake, e.target.value)} className="w-20 min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-purple-500 text-right" />
                      </div>
                    )}
                    {needsMarg && (
                      <div className="flex items-center gap-4 pt-1">
                        <label className="text-xs text-zinc-400 flex-1">Company Margin %</label>
                        <input type="number" step="0.1" value={simMarginTake} onChange={e => handleChange(setSimMarginTake, e.target.value)} className="w-20 min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-amber-500 text-right" />
                      </div>
                    )}
                    {needsDisp && (
                      <div className="flex items-center gap-4 pt-1">
                        <label className="text-xs text-zinc-400 flex-1">Dispatcher Gross %</label>
                        <input type="number" step="0.1" value={simDispatcherTake} onChange={e => handleChange(setSimDispatcherTake, e.target.value)} className="w-20 min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-rose-500 text-right" />
                      </div>
                    )}
                    {needsDispMarg && (
                      <div className="flex items-center gap-4 pt-1">
                        <label className="text-xs text-zinc-400 flex-1">Dispatcher Margin %</label>
                        <input type="number" step="0.1" value={simDispatcherMarginTake} onChange={e => handleChange(setSimDispatcherMarginTake, e.target.value)} className="w-20 min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500 text-right" />
                      </div>
                    )}
                  </div>
                );
            })()}

            {activeSimulator === 'baseRate' && (
              <div className="bg-zinc-950 border border-zinc-800 rounded p-3 space-y-2">
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-1.5 flex items-center gap-1.5">
                  <span>Base Rate</span>
                  <div className="group relative cursor-help flex items-center">
                    <Info size={12} className="text-zinc-500 hover:text-purple-400 transition-colors" />
                    <div className="hidden group-hover:block absolute left-8 mt-12 w-64 bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded shadow-xl normal-case font-normal z-[9999] pointer-events-none text-left border border-zinc-600 whitespace-pre-wrap">
                      Adjusts the core percentage of gross revenue paid to the driver. This acts as the starting point before any bonuses or penalties are applied.
                    </div>
                  </div>
                </h4>
                <div className="flex items-center gap-4 pt-1">
                  <label className="text-xs text-zinc-400 flex-1">Base Rate %</label>
                  <input type="number" step="0.1" value={baseRate} onChange={e => handleChange(setBaseRate, e.target.value)} className="w-20 min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-purple-500 text-right" />
                </div>
              </div>
            )}

            {activeSimulator === 'weeksOut' && (
              <div className="space-y-3">
                <div className="bg-zinc-950 border border-zinc-800 rounded p-3 space-y-2">
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span>Global Constraints</span>
                      <div className="group relative cursor-help flex items-center">
                        <Info size={12} className="text-zinc-500 hover:text-purple-400 transition-colors" />
                        <div className="hidden group-hover:block absolute left-8 mt-12 w-64 bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded shadow-xl normal-case font-normal z-[9999] pointer-events-none text-left border border-zinc-600 whitespace-pre-wrap">
                          Rewards drivers who stay on the road consistently. Bonuses are applied based on consecutive weeks driven, provided they meet the minimum weekly mileage constraint.
                        </div>
                      </div>
                    </div>
                    <input type="checkbox" checked={enableWeeksOut} onChange={e => handleChange(setEnableWeeksOut, e.target.checked)} className="accent-purple-500 w-3 h-3 cursor-pointer" />
                  </h4>
                  <div className={`transition-opacity ${enableWeeksOut ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <div className="flex items-center gap-4 pt-1">
                      <label className="text-xs text-zinc-400 flex-1">Min. Weekly Mileage for Bonus</label>
                      <input type="number" value={weeksOutWeeklyMileage} onChange={e => handleChange(setWeeksOutWeeklyMileage, Number(e.target.value))} className="w-20 min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-purple-500 text-right" />
                    </div>
                  </div>
                </div>
                <div className={`bg-zinc-950 border border-zinc-800 rounded p-3 space-y-2 transition-opacity ${enableWeeksOut ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-1.5">Weeks Out Tiers</h4>
                  <div className="space-y-1.5 pt-1">
                    <div className="flex gap-2 text-[10px] font-bold text-zinc-500 uppercase">
                      <div className="flex-1 text-center">Weeks &ge;</div>
                      <div className="flex-1 text-center">Bonus %</div>
                    </div>
                    {weeksOutTiers.map((tier, i) => (
                      <div key={i} className="flex gap-2">
                        <input type="number" value={tier.threshold} onChange={e => handleUpdateTier(setWeeksOutTiers, i, 'threshold', e.target.value)} className="flex-1 w-full min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none text-center focus:border-purple-500" />
                        <input type="number" step="0.1" value={tier.bonus} onChange={e => handleUpdateTier(setWeeksOutTiers, i, 'bonus', e.target.value)} className="flex-1 w-full min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none text-center focus:border-purple-500" />
                      </div>
                    
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSimulator === 'safety' && (
              <div className="bg-zinc-950 border border-zinc-800 rounded p-3 space-y-2">
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span>Safety Score Settings</span>
                    <div className="group relative cursor-help flex items-center">
                      <Info size={12} className="text-zinc-500 hover:text-purple-400 transition-colors" />
                      <div className="hidden group-hover:block absolute left-8 mt-12 w-64 bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded shadow-xl normal-case font-normal z-[9999] pointer-events-none text-left border border-zinc-600 whitespace-pre-wrap">
                        Grants a bonus to drivers who maintain a high safety score and meet the minimum weekly mileage. You can also configure whether a single speeding ticket forfeits this bonus entirely.
                      </div>
                    </div>
                  </div>
                  <input type="checkbox" checked={enableSafety} onChange={e => handleChange(setEnableSafety, e.target.checked)} className="accent-purple-500 w-3 h-3 cursor-pointer" />
                </h4>
                <div className={`space-y-2 pt-1 transition-opacity ${enableSafety ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <div className="flex items-center gap-4">
                    <label className="text-xs text-zinc-400 flex-1">Min. Score</label>
                    <input type="number" value={safetyScoreThreshold} onChange={e => handleChange(setSafetyScoreThreshold, Number(e.target.value))} className="w-20 min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-purple-500 text-right" />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-xs text-zinc-400 flex-1">Min. Weekly Mileage</label>
                    <input type="number" value={safetyScoreMileageThreshold} onChange={e => handleChange(setSafetyScoreMileageThreshold, Number(e.target.value))} className="w-20 min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-purple-500 text-right" />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-xs text-zinc-400 flex-1">Bonus %</label>
                    <input type="number" step="0.1" value={safetyScoreBonus} onChange={e => handleChange(setSafetyScoreBonus, Number(e.target.value))} className="w-20 min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-purple-500 text-right" />
                  </div>
                  <div className="flex items-center justify-between border-t border-zinc-800 pt-2 mt-1">
                    <span className="text-xs text-zinc-400">Forfeit Bonus if Speeding Ticket?</span>
                    <input type="checkbox" checked={safetyBonusForfeitedOnSpeeding} onChange={e => handleChange(setSafetyBonusForfeitedOnSpeeding, e.target.checked)} className="accent-purple-500 w-3 h-3 cursor-pointer" />
                  </div>
                </div>
              </div>
            )}

            {activeSimulator === 'speeding' && (
              <div className="bg-zinc-950 border border-zinc-800 rounded p-3 space-y-2">
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span>Speeding Penalties</span>
                    <div className="group relative cursor-help flex items-center">
                      <Info size={12} className="text-zinc-500 hover:text-purple-400 transition-colors" />
                      <div className="hidden group-hover:block absolute left-8 mt-12 w-64 bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded shadow-xl normal-case font-normal z-[9999] pointer-events-none text-left border border-zinc-600 whitespace-pre-wrap">
                        Deducts a specific percentage from the driver's pay based on the number of speeding alerts or violations recorded during the pay period.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button onClick={() => { setHasModified(true); setSpeedingRangeTiers([...speedingRangeTiers, { from: 0, to: null, penalty: 0 }]); }} className="text-amber-500 flex items-center gap-1 hover:text-amber-400 text-[10px]"><Plus size={10}/> Add rule</button>
                    <input type="checkbox" checked={enableSpeeding} onChange={e => handleChange(setEnableSpeeding, e.target.checked)} className="accent-purple-500 w-3 h-3 cursor-pointer" />
                  </div>
                </h4>
                <div className={`space-y-1.5 pt-1 transition-opacity ${enableSpeeding ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <div className="flex gap-2 text-[10px] font-bold text-zinc-500 uppercase">
                    <div className="flex-1 text-center">From Events</div>
                    <div className="flex-1 text-center">To (empty=any)</div>
                    <div className="flex-1 text-center">Penalty %</div>
                    <div className="w-5"></div>
                  </div>
                  {speedingRangeTiers.map((tier, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="number" value={tier.from} onChange={e => handleUpdateTier(setSpeedingRangeTiers, i, 'from', Number(e.target.value))} className="flex-1 w-full min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none text-center focus:border-purple-500" />
                      <input type="text" value={tier.to === null ? '' : tier.to} onChange={e => handleUpdateTier(setSpeedingRangeTiers, i, 'to', e.target.value === '' ? null : Number(e.target.value))} placeholder="Any" className="flex-1 w-full min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none text-center focus:border-purple-500" />
                      <input type="number" step="0.1" value={tier.penalty} onChange={e => handleUpdateTier(setSpeedingRangeTiers, i, 'penalty', Number(e.target.value))} className="flex-1 w-full min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none text-center focus:border-purple-500" />
                      <button onClick={() => { setHasModified(true); setSpeedingRangeTiers(speedingRangeTiers.filter((_, idx) => idx !== i)); }} className="text-zinc-600 hover:text-rose-500 w-5 flex justify-center items-center"><X size={12}/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSimulator === 'grossTarget' && (
              <div className="bg-zinc-950 border border-zinc-800 rounded p-3 space-y-2">
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span>Gross Target Status</span>
                    <div className="group relative cursor-help flex items-center">
                      <Info size={12} className="text-zinc-500 hover:text-purple-400 transition-colors" />
                      <div className="hidden group-hover:block absolute left-8 mt-12 w-64 bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded shadow-xl normal-case font-normal z-[9999] pointer-events-none text-left border border-zinc-600 whitespace-pre-wrap">
                        Incentivizes high revenue generation. Drivers receive a percentage bonus if their gross revenue for the week falls within the specified tiers.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button onClick={() => { setHasModified(true); setGrossTargetTiers([...grossTargetTiers, { from: 0, to: null, bonus: 0 }]); }} className="text-amber-500 flex items-center gap-1 hover:text-amber-400 text-[10px]"><Plus size={10}/> Add rule</button>
                    <input type="checkbox" checked={enableGrossTarget} onChange={e => handleChange(setEnableGrossTarget, e.target.checked)} className="accent-purple-500 w-3 h-3 cursor-pointer" />
                  </div>
                </h4>
                <div className={`transition-opacity ${enableGrossTarget ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <div className="space-y-1.5 pt-1">
                    <div className="flex gap-2 text-[10px] font-bold text-zinc-500 uppercase">
                      <div className="flex-1 text-center">From $</div>
                      <div className="flex-1 text-center">To $</div>
                      <div className="flex-1 text-center">Bonus %</div>
                      <div className="w-5"></div>
                    </div>
                    {grossTargetTiers.map((tier, i) => (
                      <div key={i} className="flex gap-2">
                        <input type="number" value={tier.from} onChange={e => handleUpdateTier(setGrossTargetTiers, i, 'from', Number(e.target.value))} className="flex-1 w-full min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none text-center focus:border-purple-500" />
                        <input type="text" value={tier.to === null ? '' : tier.to} onChange={e => handleUpdateTier(setGrossTargetTiers, i, 'to', e.target.value === '' ? null : Number(e.target.value))} placeholder="Any" className="flex-1 w-full min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none text-center focus:border-purple-500" />
                        <input type="number" step="0.1" value={tier.bonus} onChange={e => handleUpdateTier(setGrossTargetTiers, i, 'bonus', Number(e.target.value))} className="flex-1 w-full min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none text-center focus:border-purple-500" />
                        <button onClick={() => { setHasModified(true); setGrossTargetTiers(grossTargetTiers.filter((_, idx) => idx !== i)); }} className="text-zinc-600 hover:text-rose-500 w-5 flex justify-center items-center"><X size={12}/></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSimulator === 'tenure' && (
              <div className="bg-zinc-950 border border-zinc-800 rounded p-3 space-y-2">
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span>Tenure Milestones</span>
                    <div className="group relative cursor-help flex items-center">
                      <Info size={12} className="text-zinc-500 hover:text-purple-400 transition-colors" />
                      <div className="hidden group-hover:block absolute left-8 mt-12 w-64 bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded shadow-xl normal-case font-normal z-[9999] pointer-events-none text-left border border-zinc-600 whitespace-pre-wrap">
                        Rewards loyalty and longevity. Drivers receive cumulative bonuses based on the total number of weeks they have been active with the company.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button onClick={() => { setHasModified(true); setTenureMilestones([...tenureMilestones, { threshold: 0, bonus: 0 }]); }} className="text-amber-500 flex items-center gap-1 hover:text-amber-400 text-[10px]"><Plus size={10}/> Add rule</button>
                    <input type="checkbox" checked={enableTenure} onChange={e => handleChange(setEnableTenure, e.target.checked)} className="accent-purple-500 w-3 h-3 cursor-pointer" />
                  </div>
                </h4>
                <div className={`space-y-1.5 pt-1 transition-opacity ${enableTenure ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <div className="flex gap-2 text-[10px] font-bold text-zinc-500 uppercase">
                    <div className="flex-1 text-center">Weeks &ge;</div>
                    <div className="flex-1 text-center">Bonus %</div>
                    <div className="w-5"></div>
                  </div>
                  {tenureMilestones.map((tier, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="number" value={tier.threshold} onChange={e => handleUpdateTier(setTenureMilestones, i, 'threshold', Number(e.target.value))} className="flex-1 w-full min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none text-center focus:border-purple-500" />
                      <input type="number" step="0.1" value={tier.bonus} onChange={e => handleUpdateTier(setTenureMilestones, i, 'bonus', Number(e.target.value))} className="flex-1 w-full min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none text-center focus:border-purple-500" />
                      <button onClick={() => { setHasModified(true); setTenureMilestones(tenureMilestones.filter((_, idx) => idx !== i)); }} className="text-zinc-600 hover:text-rose-500 w-5 flex justify-center items-center"><X size={12}/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSimulator === 'fuel' && (
              <div className="bg-zinc-950 border border-zinc-800 rounded p-3 space-y-2">
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span>Fuel Efficiency (MPG) Rules</span>
                    <div className="group relative cursor-help flex items-center">
                      <Info size={12} className="text-zinc-500 hover:text-purple-400 transition-colors" />
                      <div className="hidden group-hover:block absolute right-8 mt-12 w-64 bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded shadow-xl normal-case font-normal z-[9999] pointer-events-none text-left border border-zinc-600 whitespace-pre-wrap">
                        Encourages fuel efficiency. Drivers receive bonuses or penalties based on their MPG performance percentile compared to the fleet.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button onClick={() => { setHasModified(true); setFuelMpgRules([...fuelMpgRules, { id: Math.random().toString(), min: '', max: '', percent: '' }]); }} className="text-amber-500 flex items-center gap-1 hover:text-amber-400 text-[10px]"><Plus size={10}/> Add rule</button>
                    <input type="checkbox" checked={enableFuel} onChange={e => handleChange(setEnableFuel, e.target.checked)} className="accent-purple-500 w-3 h-3 cursor-pointer" />
                  </div>
                </h4>
                <div className={`space-y-1.5 pt-1 transition-opacity ${enableFuel ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <div className="flex gap-2 text-[10px] font-bold text-zinc-500 uppercase">
                    <div className="flex-1 text-center">Min %</div>
                    <div className="flex-1 text-center">Max %</div>
                    <div className="flex-1 text-center">Bonus/Penalty %</div>
                    <div className="w-5"></div>
                  </div>
                  {fuelMpgRules.map((rule, i) => (
                    <div key={rule.id || i} className="flex gap-2">
                      <input type="number" step="0.1" value={rule.min} onChange={e => { setHasModified(true); const n = [...fuelMpgRules]; n[i] = {...n[i], min: e.target.value}; setFuelMpgRules(n); }} className="flex-1 w-full min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none text-center focus:border-purple-500" />
                      <input type="number" step="0.1" value={rule.max} onChange={e => { setHasModified(true); const n = [...fuelMpgRules]; n[i] = {...n[i], max: e.target.value}; setFuelMpgRules(n); }} className="flex-1 w-full min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none text-center focus:border-purple-500" />
                      <input type="number" step="0.1" value={rule.percent} onChange={e => { setHasModified(true); const n = [...fuelMpgRules]; n[i] = {...n[i], percent: e.target.value}; setFuelMpgRules(n); }} className="flex-1 w-full min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none text-center focus:border-purple-500" />
                      <button onClick={() => { setHasModified(true); setFuelMpgRules(fuelMpgRules.filter((_, idx) => idx !== i)); }} className="text-zinc-600 hover:text-rose-500 w-5 flex justify-center items-center"><X size={12}/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded p-3 flex flex-col mt-4 flex-1 min-h-[300px]">
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 pb-1.5 mb-1.5 flex justify-between items-center shrink-0">
              <span>Simulated Drivers</span>
              <span className="bg-purple-900/50 text-purple-400 px-2 py-0.5 rounded-full">{processedData.length}</span>
            </h4>
            <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
              <table className="w-full text-left text-[10px] text-zinc-400">
                <thead className="sticky top-0 bg-zinc-950/90 backdrop-blur uppercase tracking-wider text-zinc-500 z-10 border-b border-zinc-800">
                  <tr>
                    <th className="py-2 px-1 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('driverName')}>Driver {sortConfig.key === 'driverName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                    {activeSimulator === 'revenueSplits' ? (
                      <>
                        <th className="py-2 px-1 font-medium text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('currentRevenue')}>
                          Current Rev. {sortConfig.key === 'currentRevenue' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="py-2 px-1 font-medium text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('potentialRevenue')}>
                          Potential Rev. {sortConfig.key === 'potentialRevenue' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="py-2 px-1 font-medium text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('activeOldPercent')}>
                          OLD B/P {sortConfig.key === 'activeOldPercent' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="py-2 px-1 font-medium text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('activeNewPercent')}>
                          NEW B/P {sortConfig.key === 'activeNewPercent' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                      </>
                    )}
                    <th className="py-2 px-1 font-medium text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('activePnlImpact')}>PnL Impact {sortConfig.key === 'activePnlImpact' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {sortedData.map((d, i) => (
                    <tr key={i} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="py-2 px-1 truncate max-w-[100px] text-zinc-300" title={d.driverName}>{d.driverName}</td>
                      {activeSimulator === 'revenueSplits' ? (
                        <>
                          <td className="py-2 px-1 text-right font-mono whitespace-nowrap text-zinc-400">
                            {formatMoney(d.currentRevenue)}
                          </td>
                          <td className="py-2 px-1 text-right font-mono whitespace-nowrap text-zinc-300 font-bold">
                            {formatMoney(d.potentialRevenue)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 px-1 text-right font-mono whitespace-nowrap">
                            <span className={Number(d.activeOldPercent) > 0 ? 'text-emerald-400' : Number(d.activeOldPercent) < 0 ? 'text-rose-400' : 'text-zinc-500'}>
                              {Number(d.activeOldPercent) > 0 ? '+' : ''}{Number(d.activeOldPercent).toFixed(1)}%
                            </span>
                            <span className="text-zinc-500 ml-1">({formatMoney(d.activeOldDollars)})</span>
                          </td>
                          <td className="py-2 px-1 text-right font-mono whitespace-nowrap">
                            <span className={Number(d.activeNewPercent) > 0 ? 'text-emerald-400' : Number(d.activeNewPercent) < 0 ? 'text-rose-400' : 'text-zinc-500'}>
                              {Number(d.activeNewPercent) > 0 ? '+' : ''}{Number(d.activeNewPercent).toFixed(1)}%
                            </span>
                            <span className="text-zinc-500 ml-1">({formatMoney(d.activeNewDollars)})</span>
                          </td>
                        </>
                      )}
                      <td className={`py-2 px-1 text-right font-mono font-bold ${Math.abs(d.activePnlImpact) < 0.01 ? 'text-zinc-500' : d.activePnlImpact > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {Math.abs(d.activePnlImpact) < 0.01 ? '$0.00' : `${d.activePnlImpact > 0 ? '+' : ''}${formatMoney(d.activePnlImpact)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Simulator;