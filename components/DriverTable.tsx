import TableFilter, { FilterRule } from './TableFilter';
import React, { useState, useEffect } from 'react';
import { DriverPerformance, DriverStatus, DispatcherTier } from '../types';
import { formatCurrency, formatPercent } from '../utils';
import { AlertCircle, CheckCircle, TrendingUp, UserMinus, ChevronDown, ChevronUp, AlertTriangle, X, Minus, Filter, Info, Settings, Circle, ArrowRightLeft, BarChart2, LineChart } from 'lucide-react';
import HistoricalChart from './HistoricalChart';
import DriverSettings from './DriverSettings';
import { supabase } from '../lib/supabase';
import { getActiveAmount, getWeeklyAmountFromExp } from './WklyExpCalc';

const metricsCache = new Map<string, any>();
let lastConfigsHash = '';

export const getRawMetrics = (r: any, fixedExpenses: any[] = [], enrichedMap?: Map<string, any>, pnlConfigs: any[] = []) => {
  const hash = `${fixedExpenses.length}_${pnlConfigs.length}`;
  if (hash !== lastConfigsHash) {
    metricsCache.clear();
    lastConfigsHash = hash;
  }
  const cacheKey = `${r.id || ''}_${r.name}_${r.payDate || r.week_ending}_${r.contractType}_${r.companyId}`;
  if (metricsCache.has(cacheKey)) return metricsCache.get(cacheKey);

  const ct = r.contractType || '';
  let effContractType = ct;
  if (ct === 'TPOG' && r.franchiseId) effContractType = 'TPOG WITH FRANCHISE';
  if (ct === 'OO' && r.franchiseId) effContractType = 'OO WITH FRANCHISE';

  let targetDateStr = r.payDate || r.week_ending;
  if (!targetDateStr) {
      targetDateStr = new Date().toISOString().split('T')[0];
  } else if (targetDateStr.includes('T')) {
      targetDateStr = targetDateStr.split('T')[0];
  }

  const getRuleScore = (e: any, targetDriver: any, targetEffCt: string) => {
    let score = 0;
    const dispName = e.dispatcher_name || e.dispatcherName || e.dispatcher_id || e.dispatcherId || e.dispatcher;
    if (dispName && String(dispName).trim().toUpperCase() !== 'ALL' && String(dispName).trim() !== '' && String(dispName).trim().toLowerCase() !== 'null') {
      const arr = String(dispName).split(',').map((s: string) => s.trim().toLowerCase());
      if (arr.includes(String(targetDriver.dispatcherId || targetDriver.dispatcherName || targetDriver.dispatcher_name || '').trim().toLowerCase())) score += 1000;
      else return -1;
    }
    const teamName = e.team_name || e.teamName;
    if (teamName && String(teamName).trim().toUpperCase() !== 'ALL' && String(teamName).trim() !== '' && String(teamName).trim().toLowerCase() !== 'null') {
      const arr = String(teamName).split(',').map((s: string) => s.trim().toLowerCase());
      if (arr.includes(String(targetDriver.teamId || targetDriver.team_name || '').trim().toLowerCase())) score += 100;
      else return -1;
    }
    const comp = e.companyId || e.company_id || e.company;
    if (comp && String(comp).trim().toUpperCase() !== 'ALL' && String(comp).trim() !== '' && String(comp).trim().toLowerCase() !== 'null') {
      const arr = String(comp).split(',').map((s: string) => s.trim().toLowerCase());
      if (arr.includes(String(targetDriver.companyId || targetDriver.company_id || '').trim().toLowerCase())) score += 10;
      else return -1;
    }
    const ctc = e.contractType || e.contract_type;
    if (ctc && String(ctc).trim().toUpperCase() !== 'ALL' && String(ctc).trim() !== '' && String(ctc).trim().toLowerCase() !== 'null') {
      const arr = String(ctc).split(',').map((s: string) => s.trim().toLowerCase());
      if (arr.includes(String(targetEffCt).trim().toLowerCase())) score += 1;
      else return -1;
    }
    return score;
  };

  const validDispExps = fixedExpenses.filter(e => {
    if (!e.name || !String(e.name).trim().toLowerCase().includes('dispatcher pay')) return false;
    const fromStr = e.valid_from || '2000-01-01';
    const toStr = e.valid_to || '2099-12-31';
    return targetDateStr >= fromStr && targetDateStr <= toStr;
  });
  const scoredDispRules = validDispExps.map(e => ({ rule: e, score: getRuleScore(e, r, effContractType) })).filter(x => x.score >= 0);
  scoredDispRules.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const dA = new Date(a.rule.valid_from || '2000-01-01').getTime();
      const dB = new Date(b.rule.valid_from || '2000-01-01').getTime();
      return dB - dA;
  });
  let dispRule = scoredDispRules.length > 0 ? scoredDispRules[0].rule : null;

  let dispGrossPerc = 0;
  let dispMarginPerc = 0;
  let dispFixedAmount = 0;
  let dispSharedVal = 0;

  if (dispRule) {
      let grossP = Number(dispRule.disp_gross_perc || dispRule.dispatcher_gross_percent || dispRule.dispatcherGrossPercent || dispRule.dispGrossPerc || 0);
      let marginP = Number(dispRule.disp_margin_perc || dispRule.dispatcher_margin_percent || dispRule.dispatcherMarginPercent || dispRule.dispMarginPerc || 0);
      let rawAmount = Number(dispRule.amount) || 0;
      
      const dName = dispRule.dispatcher_name || dispRule.dispatcherName || dispRule.dispatcher_id || dispRule.dispatcherId || dispRule.dispatcher || 'ALL';
      
      if (dName !== 'ALL' && dName !== '' && (grossP !== 0 || marginP !== 0)) {
          dispGrossPerc = grossP;
          dispMarginPerc = marginP;
      } else if (rawAmount !== 0) {
          if (dispRule.unit === '%') {
              dispGrossPerc = rawAmount;
              dispMarginPerc = marginP;
          } else if (dispRule.unit === '$ total') {
              dispFixedAmount = rawAmount; 
          } else {
              dispFixedAmount = rawAmount * (r.effectiveNonTeams || 0);
          }
      } else {
          dispGrossPerc = grossP;
          dispMarginPerc = marginP;
      }
  }

  if (ct === 'MCLOO') {
      let liabRuleForDisp = fixedExpenses.filter(e => (e.name === 'Liability Insurance (Auto)' || e.name === 'Liability Insurance') && e.companyId === r.companyId && targetDateStr >= (e.valid_from || '2000-01-01') && targetDateStr <= (e.valid_to || '2099-12-31')).sort((a, b) => new Date(b.valid_from || 0).getTime() - new Date(a.valid_from || 0).getTime())[0];
      if (!liabRuleForDisp) {
          liabRuleForDisp = fixedExpenses.filter(e => (e.name === 'Liability Insurance (Auto)' || e.name === 'Liability Insurance') && e.companyId === 'ALL' && targetDateStr >= (e.valid_from || '2000-01-01') && targetDateStr <= (e.valid_to || '2099-12-31')).sort((a, b) => new Date(b.valid_from || 0).getTime() - new Date(a.valid_from || 0).getTime())[0];
      }
      if (liabRuleForDisp) {
          if (liabRuleForDisp.disp_mcloo_pay !== undefined && liabRuleForDisp.disp_mcloo_pay !== null && String(liabRuleForDisp.disp_mcloo_pay).trim() !== '') {
              dispSharedVal = Number(liabRuleForDisp.disp_mcloo_pay);
          }
      }
  }

  const driver_gross = r.grossRevenue || r.driver_gross || 0;
  const margin_amt = r.marginAmount || 0;
  const actualDispMclooPayAmount = dispSharedVal * (r.effectiveNonTeams || 0);

  let calcDispPay = 0;
  if (dispRule) {
      calcDispPay = (driver_gross * (dispGrossPerc / 100)) + (margin_amt * (dispMarginPerc / 100)) + Math.abs(actualDispMclooPayAmount) + dispFixedAmount;
  } else {
      calcDispPay = Number(r.dispatcherCommission ?? r.dispatcher_pay ?? 0);
  }

  let calcFuelRebate = 0;
  const fuelQty = Number(r.fuel_quantity ?? r.fuelUsed ?? r.fuel_gallons ?? 0);
  
  if (fuelQty > 0) {
      const validRules = fixedExpenses.filter(e => 
          e.name === 'Fuel Rebate' && 
          targetDateStr >= (e.valid_from || '2000-01-01') && 
          targetDateStr <= (e.valid_to || '2099-12-31')
      ).sort((a, b) => new Date(b.valid_from || 0).getTime() - new Date(a.valid_from || 0).getTime());
      
      const specificRule = validRules.find(e => {
          const ruleComp = String(e.companyId || e.company_id || 'ALL').toUpperCase();
          const ruleCt = String(e.contract_type || e.contractType || 'ALL').toUpperCase();
          const recComp = String(r.companyId || r.company_id || '').toUpperCase();
          const recCt = String(r.contract_type || effContractType || '').toUpperCase();
          return ruleComp !== 'ALL' && ruleComp === recComp && ruleCt !== 'ALL' && ruleCt === recCt;
      });

      const fallbackRule = validRules.find(e => {
          const ruleComp = String(e.companyId || e.company_id || 'ALL').toUpperCase();
          const ruleCt = String(e.contract_type || e.contractType || 'ALL').toUpperCase();
          const recComp = String(r.companyId || r.company_id || '').toUpperCase();
          const recCt = String(r.contract_type || effContractType || '').toUpperCase();
          return (ruleComp === 'ALL' || ruleComp === recComp) && (ruleCt === 'ALL' || ruleCt === recCt);
      });

      const fuelRule = specificRule || fallbackRule;
      
      if (fuelRule) {
          calcFuelRebate = fuelQty * Number(fuelRule.amount || 0);
      }
  }

  const rBase = Number(r.revenue_base ?? r.revenueBase ?? 0);
  const poDed = Number(r.po_deductions ?? r.poDeductions ?? 0);
  const poSet = Number(r.po_settle ?? r.poSettle ?? 0);
  const balSet = Number(r.balance_settle ?? r.balanceSettle ?? 0);
  const nPay = Number(r.net_pay ?? r.netPay ?? 0);
  const escDed = Number(r.escrow_deduction ?? r.escrowDeduct ?? 0);
  const tFloat = Number(r.truck_float ?? r.truckFloat ?? 0);
  const tWkly = Number(r.truck_wkly ?? r.truckWkly ?? 0);
  const oIns = Number(r.occ_ins ?? r.occIns ?? 0);
  const dEld = Number(r.eld ?? 0);
  const dIfta = Number(r.ifta ?? 0);
  const mSup = Number(r.maintenance_support ?? r.maintenanceSupport ?? 0);
  const liab = Number(r.liability ?? 0);
  const tPhd = Number(r.truck_phd ?? r.truckPhd ?? 0);
  const dTrl = Number(r.trailer ?? 0);
  const dTrlPhd = Number(r.trailer_phd ?? r.trailerPhd ?? 0);
  const dCash = Number(r.cash_advance_percent ?? r.cashAdvancePercent ?? 0);
  const dRevCpm = Number(r.revenue_cpm ?? r.revenueCpm ?? 0);
  const dMiles = Number(r.total_miles ?? r.milesDriven ?? 0);
  const fSaved = Number(r.fuel_saved ?? r.fuelSavings ?? 0);
  const fSpent = Number(r.fuel_spent ?? r.fuelCost ?? 0);
  const dTollsRaw = Number(r.originalDbTolls ?? r.rawTolls ?? r.tolls ?? r.tollCost ?? 0);
  
  const mileCapFactor = (Number(r.rev_without_fuel ?? r.revWithoutFuel ?? 0) > 0 && dMiles === 0) ? 0 : 1;
  const effNT = r.effectiveNonTeams || 0;
  const effTr = r.effectiveTrailers || 0;

  const enriched = enrichedMap ? enrichedMap.get(`${r.name}_${r.payDate || r.week_ending}_${r.contractType}_${r.companyId}`) : (window as any).__ENRICHED_DRIVERS__?.find((ed: any) => ed.name === r.name && ed.payDate === (r.payDate || r.week_ending) && ed.contractType === r.contractType && ed.companyId === r.companyId);

        const wklyExp = enriched ? Number(enriched.calculatedFixedCost ?? enriched.fixed_costs ?? 0) : Number(r.calculatedFixedCost ?? r.fixed_costs ?? ((tFloat + tWkly + oIns + dEld + dIfta + mSup + liab + tPhd) * effNT + (dTrl + dTrlPhd) * effTr));
        const insExp = enriched ? Number(enriched.insuranceCost ?? 0) : ((oIns + liab + tPhd) * effNT + (dTrlPhd) * effTr);
        const dTollsFinal = enriched ? Number(enriched.calculatedTolls ?? enriched.tolls ?? enriched.tollCost ?? 0) : Number(r.calculatedTolls ?? r.tolls ?? r.tollCost ?? r.tolls_amount ?? r.tollsAmount ?? 0);

  const isGarland = r.name === 'Garland Jermaine Norris';
  let fuel = 0;
  if (!isGarland) {
      fuel = ['MCLOO', 'OO', 'LOO', 'LPOO', 'MCOO'].includes(ct) ? fSaved : -Math.abs(fSpent);
  }

  const fuelRebate = calcFuelRebate;

  let drvRevBase = 0;
  let drvBalanceChange = 0;
  let drvEscrowAdj = 0;
  let drvTollsAdj = 0;
  let drvCashAdv = 0;
  let drvCpmAdj = 0;
  let drvFuelAdj = 0;
  
  let drvTruckFloat = 0, drvTruckWkly = 0, drvOccIns = 0, drvEld = 0, drvIfta = 0, drvMaintSupport = 0, drvLiability = 0, drvTruckPhd = 0, drvTrailer = 0, drvTrailerPhd = 0;

  if (isGarland) {
      drvRevBase = (r.grossRevenue || 0) * 0.2;
  } else {
      drvRevBase = rBase;
      const balFactor = ct === 'MCLOO' ? 0.3 : 1;
      drvBalanceChange = (-poDed + poSet + (nPay < 0 ? nPay : 0) + balSet) * balFactor;
      
      drvTruckFloat = tFloat * effNT;
      drvTruckWkly = tWkly * effNT;
      drvOccIns = oIns * effNT;
      drvEld = dEld * effNT;
      drvIfta = dIfta * effNT;
      drvMaintSupport = mSup * effNT;
      drvLiability = liab * effNT;
      drvTruckPhd = tPhd * effNT;
      drvTrailer = dTrl * effTr;
      drvTrailerPhd = dTrlPhd * effTr;
  }

  if (ct !== 'MCLOO') {
      drvEscrowAdj = nPay < 0 ? Math.min(Math.abs(nPay), Math.abs(escDed)) : 0;
      drvTollsAdj = ['OO', 'LOO', 'LPOO'].includes(ct) ? dTollsRaw : 0;
      drvCashAdv = dCash;
      drvCpmAdj = dRevCpm * dMiles;
      drvFuelAdj = isGarland ? 0 : (['MCLOO', 'OO', 'LOO', 'LPOO', 'MCOO'].includes(ct) ? fSaved : -Math.abs(fSpent));
  } else {
      drvEscrowAdj = 0;
      drvTollsAdj = Math.abs(dTollsRaw) * 0.3;
      drvCpmAdj = dRevCpm * dMiles;
      drvFuelAdj = fSaved;
  }

  drvRevBase *= mileCapFactor;

  let drvZeroMiDrop = 0;
  if (dMiles === 0) {
      const prorated = drvTruckFloat + drvTruckWkly + drvOccIns + drvEld + drvIfta + drvMaintSupport + drvLiability + drvTruckPhd + drvTrailer + drvTrailerPhd;
      let effectiveBalChangeForPreDrop = drvBalanceChange;
      if (effContractType === 'TPOG WITH FRANCHISE') effectiveBalChangeForPreDrop = 0;
      
      const preDrop = drvRevBase + effectiveBalChangeForPreDrop + prorated;
      if (preDrop > 0) drvZeroMiDrop = -preDrop;
  }

  let effectiveBalChangeForCompanyPay = drvBalanceChange;
  if (effContractType === 'TPOG WITH FRANCHISE') effectiveBalChangeForCompanyPay = 0;

  let fullSharedLiabAmount = enriched && enriched.fullSharedLiability !== undefined ? Number(enriched.fullSharedLiability) : Number(r.fullSharedLiability || 0);
  if (!fullSharedLiabAmount) {
      let liabRuleForDisp = fixedExpenses.filter(e => (e.name === 'Liability Insurance (Auto)' || e.name === 'Liability Insurance') && e.companyId === r.companyId && targetDateStr >= (e.valid_from || '2000-01-01') && targetDateStr <= (e.valid_to || '2099-12-31')).sort((a, b) => new Date(b.valid_from || 0).getTime() - new Date(a.valid_from || 0).getTime())[0];
      if (!liabRuleForDisp) liabRuleForDisp = fixedExpenses.filter(e => (e.name === 'Liability Insurance (Auto)' || e.name === 'Liability Insurance') && e.companyId === 'ALL' && targetDateStr >= (e.valid_from || '2000-01-01') && targetDateStr <= (e.valid_to || '2099-12-31')).sort((a, b) => new Date(b.valid_from || 0).getTime() - new Date(a.valid_from || 0).getTime())[0];
      
      if (liabRuleForDisp) {
          let sharedVal = 0;
          if (liabRuleForDisp.shared_insurance !== undefined && liabRuleForDisp.shared_insurance !== null && String(liabRuleForDisp.shared_insurance).trim() !== '') sharedVal = Number(liabRuleForDisp.shared_insurance);
          else if (liabRuleForDisp.shared_liability !== undefined && liabRuleForDisp.shared_liability !== null && String(liabRuleForDisp.shared_liability).trim() !== '') sharedVal = Number(liabRuleForDisp.shared_liability);
          fullSharedLiabAmount = sharedVal * effNT;
      }

  }

  const revCol = drvRevBase + effectiveBalChangeForCompanyPay + drvTruckFloat + drvTruckWkly + drvOccIns + drvEld + drvIfta + drvMaintSupport + drvLiability + drvTruckPhd + drvTrailer + drvTrailerPhd + drvZeroMiDrop + drvEscrowAdj + drvTollsAdj + drvCashAdv + drvCpmAdj + drvFuelAdj + Math.abs(fullSharedLiabAmount);
        const po = enriched && enriched.poCoverage !== undefined ? Number(enriched.poCoverage) : -(Math.abs(Number(r.poCoverage ?? r.poAmount ?? 0)));
        const dispPay = enriched && enriched.dispatcherCommission !== undefined ? Number(enriched.dispatcherCommission) : calcDispPay;
        const recruiting = enriched && enriched.recruitingCost !== undefined ? Math.abs(Number(enriched.recruitingCost)) : Math.abs(Number(r.recruitingCost ?? r.recruiting_cost ?? 0));
        
        const dispGrossAmt = enriched && enriched.dispGrossAmount !== undefined ? Math.abs(Number(enriched.dispGrossAmount)) : (driver_gross * (dispGrossPerc / 100));
        const dispMarginAmt = enriched && enriched.dispMarginAmount !== undefined ? Math.abs(Number(enriched.dispMarginAmount)) : (margin_amt * (dispMarginPerc / 100));

        let configContract = effContractType;
        const upper = configContract.toUpperCase();
        if (upper.includes('TPOG')) configContract = 'TPOG';
        else if (upper === 'OO' || upper.includes('OO WITH FRANCHISE')) configContract = 'OO';
        
        const config = pnlConfigs.find((c: any) => c.contract_type === configContract);
        const activeItems = config ? config.toggled_items : ['revenue_collected', 'fuel_rebate', 'dispatcher_pay', 'weekly_expenses', 'po', 'tolls', 'recruiting'];

        let pnlRevCol = activeItems.includes('revenue_collected') ? revCol : 0;
        let pnlFuelReb = activeItems.includes('fuel_rebate') ? fuelRebate : 0;
        let pnlDisp = activeItems.includes('dispatcher_pay') ? (dispGrossAmt + dispMarginAmt) : 0;
        let pnlWkly = activeItems.includes('weekly_expenses') ? wklyExp : 0;
        let pnlPo = activeItems.includes('po') ? Math.abs(po) : 0;
        let pnlRecruiting = activeItems.includes('recruiting') ? recruiting : 0;
        let pnlTolls = activeItems.includes('tolls') ? Math.abs(dTollsFinal) : 0;

        const pnl = pnlRevCol + pnlFuelReb - pnlDisp - pnlWkly - pnlPo - pnlRecruiting - pnlTolls;

        const result = { wklyExp, insExp, fuel, fuelRebate, revCol, tolls: Math.abs(dTollsFinal), po, dispPay, pnl, recruiting };
        metricsCache.set(cacheKey, result);
        return result;
};

interface DriverTableProps {
  drivers: DriverPerformance[];
}

const DriverRow = React.memo(({ driver, isExpanded, onToggle, fleetAverages, settings, fixedExpenses, enrichedMap, pnlConfigs }: { driver: any; isExpanded: boolean; onToggle: (id: string) => void; fleetAverages: any; settings?: any; fixedExpenses: any[]; enrichedMap?: Map<string, any>; pnlConfigs: any[] }) => {
  const [selectedEntity, setSelectedEntity] = useState<string>('TOTAL');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['pnl']);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  const selectedContract = selectedEntity.startsWith('CTR:') ? selectedEntity.split(':')[1] : 'ALL';

  const toggleMetric = (metric: string) => {
    setSelectedMetrics(prev => prev.includes(metric) && prev.length > 1 ? prev.filter(m => m !== metric) : prev.includes(metric) ? prev : [...prev, metric]);
  };

  const filteredRecords = React.useMemo(() => {
    if (selectedEntity === 'TOTAL') return driver.records;
    const [type, val] = selectedEntity.split(':');
    return driver.records.filter((r: any) => {
      if (type === 'CTR') return r.contractType === val;
      if (type === 'CMP') return r.companyId === val;
      if (type === 'TEAM') return r.teamId === val;
      if (type === 'FRA') return r.franchiseId === val;
      if (type === 'DISP') return r.dispatcherId === val;
      return true;
    });
  }, [driver.records, selectedEntity]);

  const driverStats = React.useMemo(() => {
    const histories: Record<string, { val: string, start: string, end: string | null }[]> = {
      Contract: [],
      Company: [],
      Team: [],
      Franchise: [],
      Dispatcher: []
    };

    let currentContract = '-';
    let currentCompany = '-';
    let currentTeam = '-';
    let currentFranchise = '-';
    let currentDispatcher = '-';
    let firstPayDate = '-';
    let lastPayDate = '-';

    if (driver.records.length > 0) {
      const recordsByDate = driver.records.reduce((acc: any, r: any) => {
        if (!acc[r.payDate]) acc[r.payDate] = [];
        acc[r.payDate].push(r);
        return acc;
      }, {});
      
      const sortedDates = Object.keys(recordsByDate).sort();

      if (sortedDates.length > 0) {
        firstPayDate = sortedDates[0];
        lastPayDate = sortedDates[sortedDates.length - 1];
      }

      const updateHistory = (field: string, val: string, date: string) => {
        const hist = histories[field];
        if (hist.length === 0 || hist[hist.length - 1].val !== val) {
          if (hist.length > 0) hist[hist.length - 1].end = date;
          hist.push({ val, start: date, end: null });
        }
      };

      sortedDates.forEach((date: string) => {
        const primary = recordsByDate[date].reduce((prev: any, curr: any) => ((curr.grossRevenue || curr.driver_gross || 0) > (prev.grossRevenue || prev.driver_gross || 0)) ? curr : prev);
        
        const cont = primary.contractType || '-';
        const comp = primary.companyId || '-';
        const team = primary.teamId || '-';
        const fran = primary.franchiseId || '-';
        const disp = primary.dispatcherId || '-';

        updateHistory('Contract', cont, date);
        updateHistory('Company', comp, date);
        updateHistory('Team', team, date);
        updateHistory('Franchise', fran, date);
        updateHistory('Dispatcher', disp, date);

        currentContract = cont;
        currentCompany = comp;
        currentTeam = team;
        currentFranchise = fran;
        currentDispatcher = disp;
      });
    }

    return { 
      current: { Contract: currentContract, Company: currentCompany, Team: currentTeam, Franchise: currentFranchise, Dispatcher: currentDispatcher },
      histories,
      firstPayDate,
      lastPayDate
    };
  }, [driver.records]);

  const calcGross = filteredRecords.reduce((s: number, r: any) => s + (r.grossRevenue || r.driver_gross || 0), 0);
  const expFuel = filteredRecords.reduce((s: number, r: any) => s + (r.fuelCost || 0), 0);
  const expMaint = filteredRecords.reduce((s: number, r: any) => s + (r.maintenanceCost || 0), 0);
  const expFaults = filteredRecords.reduce((s: number, r: any) => s + (r.driverFaultExpenses || 0), 0);

  const { issues, perfStats, mainDiagnosis, avgPnL, activeConf } = React.useMemo(() => {
    const iss: any[] = [];
      const effNonTeamsCount = filteredRecords.reduce((s: number, r: any) => s + (r.effectiveNonTeams || 0), 0);
      const effCount = filteredRecords.reduce((s: number, r: any) => s + (r.effectiveDrivers || 0), 0);
      const count = effNonTeamsCount > 0 ? effNonTeamsCount : (effCount > 0 ? effCount : 1);
    let targetAvg = fleetAverages['ALL'] || { gross: 0, rev: 0, poCov: 0, pnl: 500 };
    let primaryContract = 'Unassigned';

    if (selectedEntity.startsWith('CTR:')) {
      primaryContract = selectedEntity.split(':')[1];
      if (fleetAverages[primaryContract]) targetAvg = fleetAverages[primaryContract];
    } else if (filteredRecords.length > 0) {
      const cCounts: any = {};
      let maxCount = 0;
      filteredRecords.forEach((r: any) => {
        const c = r.contractType || 'Unassigned';
        cCounts[c] = (cCounts[c] || 0) + 1;
        if (cCounts[c] > maxCount) {
          maxCount = cCounts[c];
          primaryContract = c;
        }
      });
      if (fleetAverages[primaryContract]) targetAvg = fleetAverages[primaryContract];
    }

    if (filteredRecords.length === 0) {
      iss.push({ label: "No records available for calculation", diff: 0, severity: "neutral" });
      const emptyStats = [
        { name: 'Gross', val: null, fleet: targetAvg.gross || 0, diff: 0, severity: 'neutral' },
        { name: 'Margin', val: null, fleet: targetAvg.margin || 0, diff: 0, severity: 'neutral' },
        { name: 'Net Pay', val: null, fleet: targetAvg.netPay || 0, diff: 0, severity: 'neutral' },
        { name: 'Disp. Pay', val: null, fleet: targetAvg.dispPay || 0, diff: 0, severity: 'neutral' },
        { name: 'Fuel', val: null, fleet: targetAvg.fuel || 0, diff: 0, severity: 'neutral' },
        { name: 'Rev. Col.', val: null, fleet: targetAvg.rev || 0, diff: 0, severity: 'neutral' },
        { name: 'Fuel Reb.', val: null, fleet: targetAvg.fuelRebate || 0, diff: 0, severity: 'neutral' },
        { name: 'Wkly Exp.', val: null, fleet: targetAvg.wklyExp || 0, diff: 0, severity: 'neutral' },
        { name: 'Tolls', val: null, fleet: targetAvg.tolls || 0, diff: 0, severity: 'neutral' },
        { name: 'PO', val: null, fleet: targetAvg.poCov || 0, diff: 0, severity: 'neutral' },
        { name: 'Recruiting', val: null, fleet: targetAvg.recruiting || 0, diff: 0, severity: 'neutral' },
        { name: 'PnL', val: null, fleet: targetAvg.pnl || 100, diff: 0, severity: 'neutral' }
      ];
      return { issues: iss, perfStats: emptyStats, mainDiagnosis: 'neutral', avgPnL: 0, activeConf: {} };
    }

    const calcVal = (val: number) => val / count;

    const { sGross, sMargin, sNetPay, sDispPay, sInsExp, sMiles, sFuel, sRevCol, sFuelReb, sWklyExp, sTolls, sPO, sRecruiting, sPnL } = filteredRecords.reduce((sums: any, r: any) => {
        const rm = getRawMetrics(r, fixedExpenses, enrichedMap, pnlConfigs);
        sums.sGross += (r.grossRevenue || r.driver_gross || 0);
        sums.sMargin += (r.marginAmount || 0);
        sums.sNetPay += (r.netPay || 0);
        sums.sDispPay += rm.dispPay;
        sums.sInsExp += rm.insExp;
        sums.sMiles += (r.milesDriven || 0);
        sums.sFuel += rm.fuel;
        sums.sRevCol += rm.revCol;
        sums.sFuelReb += rm.fuelRebate;
        sums.sWklyExp += rm.wklyExp;
        sums.sTolls += rm.tolls;
        sums.sPO += rm.po;
        sums.sRecruiting += rm.recruiting;
        sums.sPnL += rm.pnl;
        return sums;
    }, { sGross: 0, sMargin: 0, sNetPay: 0, sDispPay: 0, sInsExp: 0, sMiles: 0, sFuel: 0, sRevCol: 0, sFuelReb: 0, sWklyExp: 0, sTolls: 0, sPO: 0, sRecruiting: 0, sPnL: 0 });

    const avgGross = calcVal(sGross);
    const avgMargin = calcVal(sMargin);
    const avgNetPay = calcVal(sNetPay);
    const avgDispPay = calcVal(sDispPay);
    const avgInsExp = calcVal(sInsExp);
    const sumMiles = sMiles;
    const avgFuel = sumMiles > 0 ? sFuel / sumMiles : 0;
    const avgRev = calcVal(sRevCol);
    const avgFuelReb = calcVal(sFuelReb);
    const avgWklyExp = calcVal(sWklyExp);
    const avgTolls = calcVal(sTolls);
    const avgPO = calcVal(sPO);
    const avgRecruiting = calcVal(sRecruiting);
    const avgPnL = calcVal(sPnL);

    const activeConf = settings?.[selectedEntity] || settings?.[`CTR:${primaryContract}`] || settings?.[`CMP:${driverStats.currentCompany}`] || settings?.['GLOBAL'] || {};
    
    const getSeverity = (metricId: string, val: number) => {
        const rules = activeConf[metricId] || settings?.['GLOBAL']?.[metricId];
        if (!rules || (Number(rules.redMax) === 0 && Number(rules.greenMin) === 0 && Number(rules.orangeMax) === 0)) return 'ignored';
        
        const rMax = Number(rules.redMax);
        const gMin = Number(rules.greenMin);
        const oMax = Number(rules.orangeMax);
        const oMin = Number(rules.orangeMin);

        if (gMin >= rMax) {
            if (val <= rMax) return 'critical';
            if (val >= gMin) return 'good';
            if (val > rMax && val <= oMax) return 'warning';
            if (val > oMax && val < gMin) return 'neutral';
        } else {
            if (val >= rMax) return 'critical';
            if (val <= gMin) return 'good';
            if (val < rMax && val >= oMin) return 'warning';
            if (val < oMin && val > gMin) return 'neutral';
        }
        return 'neutral';
    };

    const metrics = [
      { id: 'gross', name: 'Gross', val: avgGross },
      { id: 'margin', name: 'Margin', val: avgMargin },
      { id: 'netPay', name: 'Net Pay', val: avgNetPay },
      { id: 'dispPay', name: 'Disp. Pay', val: avgDispPay },
      { id: 'fuel', name: 'Fuel', val: avgFuel },
      { id: 'revCol', name: 'Rev. Col.', val: avgRev },
      { id: 'fuelReb', name: 'Fuel Reb.', val: avgFuelReb },
      { id: 'wklyExp', name: 'Wkly Exp.', val: -avgWklyExp },
      { id: 'tolls', name: 'Tolls', val: -avgTolls },
      { id: 'po', name: 'PO', val: avgPO },
      { id: 'recruiting', name: 'Recruiting', val: avgRecruiting },
      { id: 'pnl', name: 'PnL', val: avgPnL }
    ];

    const perfStats = metrics.map(m => {
        const severity = getSeverity(m.id, m.val);
        if (severity === 'ignored') return null;
        if (severity === 'critical') iss.push({ label: `Critical ${m.name} Level`, diff: 0, severity });
        else if (severity === 'warning') iss.push({ label: `Warning ${m.name} Level`, diff: 0, severity });
        return { name: m.name, val: m.val, severity };
    }).filter((x: any) => x !== null);

    let mainDiagnosis = getSeverity('pnl', avgPnL);
    if (mainDiagnosis === 'ignored') mainDiagnosis = 'neutral';

    return { issues: iss, perfStats, mainDiagnosis, avgPnL, activeConf };
  }, [filteredRecords, fleetAverages, selectedEntity, settings]);
  const historyChartData = React.useMemo(() => {
    const sortedAllRecords = [...driver.records].sort((a: any, b: any) => new Date(a.payDate).getTime() - new Date(b.payDate).getTime());
    
    const precalculatedData = new Map();
    let runningSums = { pnl: 0, gross: 0, margin: 0, netPay: 0, insExp: 0, fuel: 0, revCol: 0, fuelRebate: 0, wklyExp: 0, tolls: 0, po: 0, dispPay: 0, recruiting: 0 };
    let runningMiles = 0;
    let runningCount = 0;

    sortedAllRecords.forEach((r: any) => {
      const rm = getRawMetrics(r, fixedExpenses, enrichedMap, pnlConfigs);
      if ((r.effectiveDrivers || 0) >= 1) runningCount += 1;
      const count = runningCount || 1;
      
      runningSums.pnl += rm.pnl;
      runningSums.gross += (r.grossRevenue || r.driver_gross || 0);
      runningSums.margin += (r.marginAmount || 0);
      runningSums.netPay += (r.netPay || 0);
      runningSums.insExp += rm.insExp;
      runningSums.fuel += rm.fuel;
      runningSums.revCol += rm.revCol;
      runningSums.fuelRebate += rm.fuelRebate;
      runningSums.wklyExp += rm.wklyExp;
      runningSums.tolls += rm.tolls;
      runningSums.po += rm.po;
      runningSums.dispPay += rm.dispPay;
      runningSums.recruiting += rm.recruiting;
      runningMiles += (r.milesDriven || 0);

      precalculatedData.set(r.payDate, {
        rm,
        count,
        runningSums: { ...runningSums },
        runningMiles
      });
    });

    return filteredRecords.map((r: any) => {
      const data = precalculatedData.get(r.payDate);
      if (!data) return { name: r.payDate };

      const { rm, count, runningSums: sums, runningMiles: miles } = data;

      const metrics: any = {
        'pnl': rm.pnl,
        'pnl avg/w': sums.pnl / count,
        'gross': r.grossRevenue || r.driver_gross || 0,
        'gross avg/w': sums.gross / count,
        'margin': r.marginAmount || 0,
        'margin avg/w': sums.margin / count,
        'net pay': r.netPay || 0,
        'net pay avg/w': sums.netPay / count,
        'ins. exp.': rm.insExp,
        'ins. exp. avg/w': sums.insExp / count,
        'fuel': rm.fuel,
        'fuel avg/mi': miles > 0 ? sums.fuel / miles : 0,
        'revenue collected': rm.revCol,
        'revenue collected avg/w': sums.revCol / count,
        'fuel rebate': rm.fuelRebate,
        'fuel rebate avg/w': sums.fuelRebate / count,
        'wkly exp': rm.wklyExp,
        'wkly exp avg/w': sums.wklyExp / count,
        'tolls': rm.tolls,
        'tolls avg/w': sums.tolls / count,
        'po': rm.po,
        'po avg/w': sums.po / count,
        'disp. pay': rm.dispPay,
        'disp. pay avg/w': sums.dispPay / count,
        'recruiting': rm.recruiting,
        'recruiting avg/w': sums.recruiting / count
      };

      const point: any = { name: r.payDate };
      selectedMetrics.forEach((m: string) => { point[m] = metrics[m]; });
      return point;
    });
  }, [filteredRecords, driver.records, selectedMetrics, fixedExpenses, enrichedMap, pnlConfigs]);

  const activeSeries = React.useMemo(() => {
    const palette = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#f43f5e', '#06b6d4', '#fb923c', '#d946ef', '#a1a1aa'];
    return selectedMetrics.map((m, i) => ({ dataKey: m, name: m.toUpperCase(), color: palette[i % palette.length] }));
  }, [selectedMetrics]);

  return (
    <React.Fragment>
      <tr onClick={() => onToggle(driver.id)} className={`group cursor-pointer transition-colors ${isExpanded ? 'bg-zinc-800/50' : 'hover:bg-zinc-800/30'}`}>
        <td className={`px-2 py-1 text-zinc-500 sticky left-0 z-10 transition-colors ${isExpanded ? 'bg-zinc-800' : 'bg-zinc-900 group-hover:bg-zinc-800'}`}>{isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</td>
        <td className={`px-2 py-1 font-sans sticky left-[32px] z-10 transition-colors ${isExpanded ? 'bg-zinc-800' : 'bg-zinc-900 group-hover:bg-zinc-800'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${driver.status === DriverStatus.ACTIVE ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="font-semibold text-zinc-200">{driver.name}</span>
            {mainDiagnosis === 'critical' && <AlertTriangle size={10} className="text-rose-500 ml-1" />}
            {mainDiagnosis === 'warning' && <AlertTriangle size={10} className="text-amber-500 ml-1" />}
          </div>
        </td>
        <td className="px-2 py-1 text-right text-yellow-400">{formatCurrency(driver.totalGross)}</td>
        <td className="px-2 py-1 text-right text-yellow-400 font-medium">{formatCurrency(driver.marginAmount)}</td>
        <td className="px-2 py-1 text-right text-purple-400">{formatCurrency(driver.netPay)}</td>
        <td className="px-2 py-1 text-right text-purple-400">-{formatCurrency(Math.abs(driver.insuranceExp))}</td>
        <td className="px-2 py-1 text-right text-purple-400">{driver.totalFuel < 0 ? `-$${Math.abs(driver.totalFuel).toFixed(0)}` : `$${driver.totalFuel.toFixed(0)}`}</td>
        <td className="px-2 py-1 text-right text-blue-400">{formatCurrency(driver.companyPay)}</td>
        <td className="px-2 py-1 text-right text-blue-400">{formatCurrency(driver.fuelRebate)}</td>
        <td className="px-2 py-1 text-right text-blue-400">-{formatCurrency(Math.abs(driver.wklyExp))}</td>
        <td className="px-2 py-1 text-right text-blue-400">{driver.tollCost === 0 ? formatCurrency(0) : `-${formatCurrency(Math.abs(driver.tollCost))}`}</td>
        <td className="px-2 py-1 text-right text-blue-400">{formatCurrency(driver.poCoverage)}</td>
        <td className="px-2 py-1 text-right text-blue-400"><span>{driver.dispatcherPay > 0 ? '+' : ''}{formatCurrency(driver.dispatcherPay)}</span></td>
        <td className="px-2 py-1 text-right text-blue-400">{formatCurrency(driver.recruitingCost)}</td>
        <td className={`px-2 py-1 text-right font-bold sticky right-[56px] w-[80px] min-w-[80px] z-20 transition-colors ${isExpanded ? 'bg-zinc-800' : 'bg-zinc-900 group-hover:bg-zinc-800'} ${driver.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(driver.totalPnL)}</td>
        <td className={`px-2 py-1 text-right font-bold sticky right-0 w-[56px] min-w-[56px] z-20 transition-colors ${isExpanded ? 'bg-zinc-800' : 'bg-zinc-900 group-hover:bg-zinc-800'} ${driver.ranking >= 80 ? 'text-emerald-400' : driver.ranking >= 50 ? 'text-yellow-400' : driver.ranking >= 20 ? 'text-amber-500' : 'text-rose-400'}`}>{driver.ranking.toFixed(2)}%</td>
      </tr>
      {isExpanded && (
        <tr className="bg-zinc-950/50 relative z-50">
          <td colSpan={16} className="p-0 border-b border-zinc-800 relative z-50 overflow-visible">
           <div className="sticky left-0 p-4 w-[calc(100vw-262px)] z-50 overflow-visible">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[260px] items-stretch">
                <div className="md:col-span-2 flex gap-4 h-full">
                  <div className="w-[220px] flex-shrink-0 bg-zinc-900/40 border border-zinc-800 p-3 rounded flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold">Status</span>
                        <div className="text-[11px]">
                          {driver.status === DriverStatus.TERMINATED ? (
                            <span className="text-rose-500 font-bold uppercase">Terminated</span>
                          ) : (
                            <span className="text-emerald-500 font-bold uppercase">Active</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-bold">First Pay</span>
                        <span className="text-[11px] text-zinc-300">{driverStats.firstPayDate !== '-' ? driverStats.firstPayDate.split('T')[0] : '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-bold">Last Pay</span>
                        <span className="text-[11px] text-zinc-300">{driverStats.lastPayDate !== '-' ? driverStats.lastPayDate.split('T')[0] : '-'}</span>
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="text-[10px] text-zinc-500 uppercase font-bold mb-2 pb-1 border-b border-zinc-800/50">LATEST INFO</div>
                      <div className="flex flex-col gap-2">
                        {['Contract', 'Company', 'Team', 'Franchise', 'Dispatcher'].map(field => {
                          const currentVal = driverStats.current[field as keyof typeof driverStats.current];
                          const history = driverStats.histories[field as keyof typeof driverStats.histories];
                          const hasSwapped = history.length > 1;

                          return (
                            <div key={field} className="flex flex-col gap-1 w-full">
                              <div className="flex items-start justify-between w-full">
                                <span className="text-[10px] text-zinc-400 whitespace-nowrap mr-2">{field}:</span>
                                <div className="flex items-start justify-end gap-1.5 flex-1 min-w-0 text-right">
                                  {hasSwapped && (
                                    <div className="relative flex-shrink-0 mt-[2px] group/tooltip">
                                      <ArrowRightLeft size={10} className="text-blue-400 cursor-help" />
                                      <div className="hidden group-hover/tooltip:flex absolute left-full top-0 ml-2 w-56 bg-zinc-800 border border-zinc-600 rounded shadow-2xl p-3 z-[99999] flex-col">
                                        <div className="text-[9px] font-bold text-zinc-400 uppercase mb-2 border-b border-zinc-700 pb-1 text-left">{field} History</div>
                                        <div className="flex flex-col gap-2">
                                          {history.map((h, i) => {
                                            const startStr = h.start.split('T')[0];
                                            const endStr = h.end ? h.end.split('T')[0] : 'Present';
                                            return (
                                              <div key={i} className="text-[9px] flex flex-col bg-zinc-900/50 p-1.5 rounded text-left">
                                                <span className="text-emerald-400 font-bold mb-0.5">{startStr} - {endStr}</span>
                                                <span className="text-zinc-200 break-words">{h.val}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  <span className="text-[11px] text-zinc-200 break-words leading-tight" style={{ wordBreak: 'break-word' }}>{currentVal}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex justify-end items-center gap-3 mb-2">
                      <select value={selectedEntity} onChange={(e) => setSelectedEntity(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-300 outline-none focus:border-emerald-500 w-[140px] cursor-pointer">
                        <option value="TOTAL">View: Total History</option>
                        {Array.from(new Set(driver.records.map((r:any) => r.contractType))).filter((c:any) => c && !['GLOBAL', 'UNASSIGNED', 'UNRECONCILED', '-'].includes(c.toUpperCase())).map(c => <option key={`c-${c}`} value={`CTR:${c as string}`}>Contract: {c as string}</option>)}
                        {Array.from(new Set(driver.records.map((r:any) => r.companyId))).filter((c:any) => c && !['GLOBAL', 'UNASSIGNED', 'UNRECONCILED', '-'].includes(c.toUpperCase())).map(c => <option key={`cmp-${c}`} value={`CMP:${c as string}`}>Company: {c as string}</option>)}
                        {Array.from(new Set(driver.records.map((r:any) => r.teamId))).filter((t:any) => t && !['GLOBAL', 'UNASSIGNED', 'UNRECONCILED', '-'].includes(t.toUpperCase())).map(t => <option key={`team-${t}`} value={`TEAM:${t as string}`}>Team: {t as string}</option>)}
                        {Array.from(new Set(driver.records.map((r:any) => r.franchiseId))).filter((f:any) => f && !['GLOBAL', 'UNASSIGNED', 'UNRECONCILED', '-'].includes(f.toUpperCase())).map(f => <option key={`fra-${f}`} value={`FRA:${f as string}`}>Franchise: {f as string}</option>)}
                        {Array.from(new Set(driver.records.map((r:any) => r.dispatcherId))).filter((d:any) => d && !['GLOBAL', 'UNASSIGNED', 'UNRECONCILED', '-'].includes(d.toUpperCase())).map(d => <option key={`disp-${d}`} value={`DISP:${d as string}`}>Dispatcher: {d as string}</option>)}
                      </select>
                      <details className="relative group">
                        <summary className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-400 outline-none hover:border-emerald-500 cursor-pointer list-none flex items-center gap-2">
                          <Filter size={10} /> Metrics ({selectedMetrics.length}) <ChevronDown size={10} />
                        </summary>
                        <div className="absolute top-full right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded shadow-2xl z-[100] w-48 p-1 flex flex-col gap-0.5 max-h-[240px] overflow-y-auto">
                          {['gross', 'gross avg/w', 'margin', 'margin avg/w', 'net pay', 'net pay avg/w', 'ins. exp.', 'ins. exp. avg/w', 'fuel', 'fuel avg/mi', 'revenue collected', 'revenue collected avg/w', 'fuel rebate', 'fuel rebate avg/w', 'wkly exp', 'wkly exp avg/w', 'tolls', 'tolls avg/w', 'po', 'po avg/w', 'disp. pay', 'disp. pay avg/w', 'recruiting', 'recruiting avg/w', 'pnl', 'pnl avg/w'].map(m => (
                            <label key={m} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800 rounded cursor-pointer text-[10px] text-zinc-300 capitalize" onClick={e => e.stopPropagation()}>
                              <input type="checkbox" className="accent-emerald-500" checked={selectedMetrics.includes(m)} onChange={() => toggleMetric(m)} />
                              {m.replace('revenue collected', 'rev. col.').replace('fuel rebate', 'fuel reb.').replace('ins. exp.', 'ins. exp')}
                            </label>
                          ))}
                        </div>
                      </details>
                      <div className="flex bg-zinc-950 border border-zinc-800 rounded overflow-hidden">
                        <button onClick={() => setChartType('line')} className={`px-2 py-1 flex items-center justify-center transition-colors cursor-pointer ${chartType === 'line' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}>
                          <LineChart size={12} />
                        </button>
                        <button onClick={() => setChartType('bar')} className={`px-2 py-1 border-l border-zinc-800 flex items-center justify-center transition-colors cursor-pointer ${chartType === 'bar' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}>
                          <BarChart2 size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 bg-zinc-900/10 rounded">
                      <HistoricalChart 
                        data={historyChartData} 
                        series={activeSeries} 
                        type={chartType} 
                      />
                    </div>
                  </div>
                </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded p-3 flex flex-col h-full relative z-20">
                <div className="flex items-center justify-between mb-3 bg-zinc-950/80 p-2.5 rounded-md border border-zinc-800/80 shadow-md">
                  <div className="flex items-center gap-3">
                   <h4 className="text-xs font-black text-zinc-100 uppercase tracking-wider">
                      PnL Diagnosis
                      {selectedContract !== 'ALL' && <span className="text-zinc-500 font-medium ml-1">({selectedContract})</span>}
                      <span className={`ml-2 font-mono ${mainDiagnosis === 'good' ? 'text-emerald-400' : mainDiagnosis === 'neutral' ? 'text-yellow-400' : mainDiagnosis === 'warning' ? 'text-amber-500' : 'text-rose-500'}`}>Avg: {formatCurrency(avgPnL)}</span>
                    </h4>
                    {perfStats.length > 0 && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${
                        mainDiagnosis === 'good' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_8px_-2px_rgba(16,185,129,0.4)]' :
                        mainDiagnosis === 'neutral' ? 'bg-yellow-400/20 text-yellow-400 border-yellow-400/50 shadow-[0_0_8px_-2px_rgba(250,204,21,0.4)]' :
                        mainDiagnosis === 'warning' ? 'bg-amber-500/20 text-amber-500 border-amber-500/50 shadow-[0_0_8px_-2px_rgba(245,158,11,0.4)]' :
                        'bg-rose-500/20 text-rose-500 border-rose-500/50 shadow-[0_0_8px_-2px_rgba(244,63,94,0.4)]'
                      }`}>{mainDiagnosis}</span>
                    )}
                  </div>
                  <div className="group relative cursor-help text-zinc-400 hover:text-emerald-400 transition-colors">
                    <Info size={14} />
                    <div className="hidden group-hover:block absolute right-0 top-full mt-2 w-80 bg-zinc-800 text-zinc-200 text-[10px] p-3 rounded shadow-xl normal-case font-normal z-[100] pointer-events-none text-left border border-zinc-600 whitespace-normal break-words leading-tight">
                      <div className="font-bold text-emerald-400 mb-2">Active Diagnosis Settings</div>
                      <div className="grid grid-cols-2 gap-2">
                        {['pnl', 'gross', 'margin', 'netPay', 'dispPay', 'fuel', 'revCol', 'fuelReb', 'wklyExp', 'tolls', 'po', 'recruiting'].map(mId => {
                           const rule = activeConf?.[mId] || settings?.['GLOBAL']?.[mId];
                           if (!rule || (Number(rule.redMax) === 0 && Number(rule.greenMin) === 0 && Number(rule.orangeMax) === 0)) return null;
                           const isRev = Number(rule.greenMin) >= Number(rule.redMax);
                           return (
                             <div key={mId} className="mb-1">
                               <div className="font-bold text-zinc-300 border-b border-zinc-700 pb-0.5 capitalize">{mId.replace(/([A-Z])/g, ' $1').trim()}</div>
                               <ul className="space-y-0.5 ml-1 mt-0.5 text-[9px]">
                                 <li><span className="text-emerald-500 font-bold">Good:</span> {isRev ? '≥' : '≤'} {rule.greenMin}</li>
                                 <li><span className="text-yellow-400 font-bold">Neutral:</span> {rule.yellowMin} to {rule.yellowMax}</li>
                                 <li><span className="text-amber-500 font-bold">Warn:</span> {rule.orangeMin} to {rule.orangeMax}</li>
                                 <li><span className="text-rose-500 font-bold">Crit:</span> {isRev ? '≤' : '≥'} {rule.redMax}</li>
                               </ul>
                             </div>
                           );
                        })}
                      </div>
                    </div>
                 </div>
                </div>
                <div className="flex-1 mb-2">
                  {issues.length === 0 ? (
                    <div className="flex items-center text-emerald-500 text-xs gap-2">
                      <CheckCircle size={14} /><span>Optimal Performance</span>
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {issues.map((issue, idx) => (
                        <li key={idx} className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1.5">
                            {issue.severity === 'critical' ? (
                              <AlertTriangle size={10} className="text-rose-500" />
                            ) : (
                              <AlertTriangle size={10} className="text-amber-500" />
                            )}
                            <span className="text-zinc-300">{issue.label}</span>
                          </div>
                          <span className={issue.severity === 'critical' ? 'text-rose-500 font-bold' : 'text-amber-500 font-bold'}>
                            {issue.severity === 'critical' ? 'Alert' : 'Warning'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-auto pt-2 border-t border-zinc-800 space-y-1">
                   {perfStats.filter(stat => stat.name !== 'PnL').map(stat => {
                      const getTextColor = (severity: string) => {
                         if (severity === 'good') return 'text-emerald-500';
                         if (severity === 'neutral') return 'text-yellow-400';
                         if (severity === 'warning') return 'text-amber-500';
                         return 'text-rose-500';
                      };
                      
                      const getIcon = (severity: string) => {
                        if (severity === 'good') return <CheckCircle size={10} className="text-emerald-500" />;
                        if (severity === 'neutral') return <Info size={10} className="text-yellow-400" />;
                        if (severity === 'warning') return <AlertTriangle size={10} className="text-amber-500" />;
                        return <AlertTriangle size={10} className="text-rose-500" />;
                      };

                      return (
                         <div key={stat.name} className="flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-1.5">
                               {stat.val === null ? <Circle size={10} className="text-zinc-600" /> : getIcon(stat.severity)}
                               <span className="text-zinc-500">{stat.name} Avg</span>
                            </div>
                            <div className="flex items-center gap-2">
                               <span className={`font-bold text-right ${getTextColor(stat.severity)}`}>
                                 {stat.val === null ? 'N/A' : (stat.name === 'Fuel' ? (stat.val < 0 ? `-$${Math.abs(stat.val).toFixed(2)}` : `$${stat.val.toFixed(2)}`) : formatCurrency(stat.val))}
                               </span>
                            </div>
                         </div>
                      );
                   })}
                </div>
              </div>
            </div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
});

const DriverTable: React.FC<DriverTableProps> = ({ drivers }) => {
  const validDrivers = React.useMemo(() => {
    const uniqueDates = Array.from(new Set(drivers.map(d => d.payDate).filter(Boolean)));
    const sortedDates = uniqueDates.sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime());
    const allowedDates = new Set(sortedDates.length > 6 ? sortedDates.slice(0, -6) : sortedDates);
    return drivers.filter(d => allowedDates.has(d.payDate));
  }, [drivers]);

  const enrichedMap = React.useMemo(() => {
    const map = new Map<string, any>();
    ((window as any).__ENRICHED_DRIVERS__ || []).forEach((ed: any) => {
      map.set(`${ed.name}_${ed.payDate}_${ed.contractType}_${ed.companyId}`, ed);
    });
    return map;
  }, [drivers]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'totalGross', direction: 'desc' });
  const [isAvgPerWeek, setIsAvgPerWeek] = useState(false);
  const [search, setSearch] = useState('');
  const [tableFilters, setTableFilters] = useState<FilterRule[]>([{ field: 'Contract', operator: 'status is', value: ['ACTIVE'] }]);
  const [showSettings, setShowSettings] = useState(false);
  const [driverSettings, setDriverSettings] = useState<any>({});
  const [fixedExpenses, setFixedExpenses] = useState<any[]>([]);
  const [pnlConfigs, setPnlConfigs] = useState<any[]>([]);

  useEffect(() => {
    const loadPnlConfigs = async () => {
      try {
        const { fetchPnlConfigs } = await import('../lib/supabase');
        if (fetchPnlConfigs) {
          const data = await fetchPnlConfigs();
          setPnlConfigs(data || []);
        }
      } catch(e) { console.error("Error loading PNL configs:", e); }
    };
    loadPnlConfigs();
  }, []);

  useEffect(() => {
    const fetchFixedExps = async () => {
      const { data } = await supabase.from('fixed_expenses').select('*');
      if (data) setFixedExpenses(data);
    };
    fetchFixedExps();
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase.from('driver_settings').select('*');
      if (!error && data) {
        const formatted: any = {};
        data.forEach((row: any) => {
          const key = row.entity_type === 'GLOBAL' ? 'GLOBAL' : `${row.entity_type === 'CONTRACT' ? 'CTR' : 'CMP'}:${row.entity_value}`;
          formatted[key] = row.settings;
        });
        setDriverSettings(formatted);
      }
    };
    fetchSettings();
  }, []);

  const handleSaveSettings = async (newSettings: any) => {
    setDriverSettings(newSettings);
    for (const key of Object.keys(newSettings)) {
      let entity_type = 'GLOBAL';
      let entity_value = 'ALL';
      if (key.startsWith('CTR:')) {
        entity_type = 'CONTRACT';
        entity_value = key.split(':')[1];
      } else if (key.startsWith('CMP:')) {
        entity_type = 'COMPANY';
        entity_value = key.split(':')[1];
      }
      await supabase.from('driver_settings').upsert({
        entity_type,
        entity_value,
        settings: newSettings[key]
      }, { onConflict: 'entity_type,entity_value' });
    }
  };

  const filteredTableDrivers = React.useMemo(() => {
          if (!tableFilters || tableFilters.length === 0) return validDrivers;

          const driverLatestInfo = new Map<string, any>();
          if (tableFilters.some(f => f.operator === 'status is' || f.operator === 'status is not')) {
              validDrivers.forEach(r => {
                  const curr = driverLatestInfo.get(r.name);
                  const currDate = curr ? new Date(curr.date).getTime() : 0;
                  const rDate = r.payDate ? new Date(r.payDate).getTime() : 0;
                  if (!curr || rDate > currDate || (rDate === currDate && String(r.status).toUpperCase() === 'TERMINATED')) {
                      driverLatestInfo.set(r.name, { status: r.status, date: r.payDate || '1970-01-01' });
                  }
              });
          }

          const driverAvgs = new Map<string, any>();
          if (tableFilters.some(f => f.operator === 'diagnosis is' || f.operator === 'diagnosis is not')) {
              const driverRecordsMap = new Map<string, any[]>();
              validDrivers.forEach(r => {
                  if (!driverRecordsMap.has(r.name)) driverRecordsMap.set(r.name, []);
                  driverRecordsMap.get(r.name)!.push(r);
              });
              
              driverRecordsMap.forEach((records, name) => {
                  let totalGross = 0, totalMargin = 0, totalNetPay = 0, totalDispPay = 0, totalFuel = 0, totalRevCol = 0, totalPnL = 0, totalPO = 0, totalMiles = 0;
                  const count = Math.max(1, new Set(records.map(r => r.payDate)).size);
                  
                  let primaryContract = 'Unassigned';
                  let primaryCompany = 'Unassigned';
                  const cCounts: any = {};
                  let maxCount = 0;
                  
                  records.forEach(r => {
                      const rm = getRawMetrics(r, fixedExpenses, enrichedMap, pnlConfigs);
                      totalGross += (r.grossRevenue || r.driver_gross || 0);
                      totalMargin += (r.marginAmount || 0);
                      totalNetPay += (r.netPay ?? 0);
                      totalDispPay += rm.dispPay;
                      totalFuel += rm.fuel;
                      totalMiles += (r.milesDriven || 0);
                      totalRevCol += rm.revCol;
                      totalPnL += rm.pnl;
                      totalPO += rm.po;
                      
                      const c = r.contractType || 'Unassigned';
                      cCounts[c] = (cCounts[c] || 0) + 1;
                      if (cCounts[c] > maxCount) {
                          maxCount = cCounts[c];
                          primaryContract = c;
                          primaryCompany = r.companyId || 'Unassigned';
                      }
                  });
                  
                  driverAvgs.set(name, {
                      gross: totalGross / count,
                      margin: totalMargin / count,
                      netPay: totalNetPay / count,
                      dispPay: totalDispPay / count,
                      fuel: totalMiles > 0 ? totalFuel / totalMiles : 0,
                      revCol: totalRevCol / count,
                      pnl: totalPnL / count,
                      po: totalPO / count,
                      primaryContract,
                      primaryCompany
                  });
              });
          }

          return validDrivers.filter(d => {
              const m = getRawMetrics(d, fixedExpenses, enrichedMap, pnlConfigs);
              return tableFilters.every(rule => {
                  if (!rule.field || !rule.operator) return true;
                  const conf = driverSettings?.[`CTR:${d.contractType}`] || driverSettings?.[`CMP:${d.companyId}`] || driverSettings?.['GLOBAL'] || {};
              const getSev = (mId: string, val: number, specificConf: any = conf) => {
                  const rules = specificConf[mId] || driverSettings?.['GLOBAL']?.[mId];
                  if (!rules || (Number(rules.redMax) === 0 && Number(rules.greenMin) === 0 && Number(rules.orangeMax) === 0)) return 'neutral';
                  const rMax = Number(rules.redMax); const gMin = Number(rules.greenMin); const oMax = Number(rules.orangeMax); const oMin = Number(rules.orangeMin);
                  if (gMin >= rMax) {
                      if (val <= rMax) return 'critical';
                      if (val >= gMin) return 'good';
                      if (val > rMax && val <= oMax) return 'warning';
                      return 'neutral';
                  } else {
                      if (val >= rMax) return 'critical';
                      if (val <= gMin) return 'good';
                      if (val < rMax && val >= oMin) return 'warning';
                      return 'neutral';
                  }
              };

              if (rule.operator === 'status is' || rule.operator === 'status is not') {
                  const selectedValues = Array.isArray(rule.value) ? rule.value : [rule.value];
                  if (selectedValues.length === 0) return true;
                  
                  const latest = driverLatestInfo.get(d.name);
                  const actualStatus = latest ? latest.status : d.status;
                  const driverStatus = (actualStatus === DriverStatus.ACTIVE || String(actualStatus).toUpperCase() === 'ACTIVE') ? 'ACTIVE' : 'TERMINATED';
                  
                  const isMatch = selectedValues.includes(driverStatus);
                  return rule.operator === 'status is' ? isMatch : !isMatch;
              }

              if (rule.field === 'Contract') {
                  const vals = Array.isArray(rule.value) ? rule.value : [];
                  if (vals.length === 0) return true;
                  const checkMatch = (v: string) => d.contractType === v;
                  if (rule.operator === 'is one of') return vals.some(checkMatch);
                  if (rule.operator === 'is not one of') return !vals.some(checkMatch);
                  if (rule.operator === 'is') return checkMatch(vals[0]);
                  if (rule.operator === 'is not') return !checkMatch(vals[0]);
                  return true;
              }

              if (rule.operator === 'diagnosis is' || rule.operator === 'diagnosis is not') {
                  let mId = '';
                  switch (rule.field) {
                      case 'Gross': mId = 'gross'; break;
                      case 'Margin': mId = 'margin'; break;
                      case 'Net Pay': mId = 'netPay'; break;
                      case 'Disp. Pay': mId = 'dispPay'; break;
                      case 'Fuel': mId = 'fuel'; break;
                      case 'Rev. Col.': mId = 'revCol'; break;
                      case 'Total PnL': mId = 'pnl'; break;
                      case 'PO': mId = 'po'; break;
                  }
                  if (mId) {
                      const avgData = driverAvgs.get(d.name);
                      if (!avgData) return true;
                      
                      const activeConf = driverSettings?.[`CTR:${avgData.primaryContract}`] || driverSettings?.[`CMP:${avgData.primaryCompany}`] || driverSettings?.['GLOBAL'] || {};
                      const val = avgData[mId];
                      const sev = getSev(mId, val, activeConf);
                      
                      const selectedValues = Array.isArray(rule.value) ? rule.value : [rule.value];
                      const isMatch = selectedValues.includes(sev);
                      return rule.operator === 'diagnosis is' ? isMatch : !isMatch;
                  }
              }

              let fieldValue: any;
              switch (rule.field) {
                  case 'Company': fieldValue = d.companyId; break;
                  case 'Team': fieldValue = d.teamId; break;
                  case 'Franchise': fieldValue = d.franchiseId; break;
                  case 'Driver': fieldValue = d.name; break;
                  case 'Dispatcher': fieldValue = d.dispatcherId; break;
                  case 'Eff Drivers': fieldValue = d.effectiveDrivers; break;
                  case 'Eff Non Teams': fieldValue = d.effectiveNonTeams; break;
                  case 'Eff Trailers': fieldValue = (d as any).effectiveTrailers; break;
                  case 'Gross': fieldValue = d.grossRevenue || d.driver_gross || 0; break;
                  case 'Margin': fieldValue = d.marginAmount || 0; break;
                  case 'Miles': fieldValue = Number(d.milesDriven) || 0; break;
                  case 'Net Pay': fieldValue = d.netPay ?? 0; break;
                  case 'Med Net Pay': fieldValue = d.netPay ?? 0; break;
                  case 'Disp. Pay': fieldValue = m.dispPay; break;
                  case 'Ins. Exp.': fieldValue = m.insExp; break;
                  case 'Fuel': fieldValue = m.fuel; break;
                  case 'Rev. Col.': fieldValue = m.revCol; break;
                  case 'Rev Base': fieldValue = Number((d as any).revenue_base ?? (d as any).revenueBase ?? 0); break;
                  case 'Bal Change': fieldValue = Number((d as any).balance_settle ?? (d as any).balanceSettle ?? 0) + Number((d as any).po_settle ?? (d as any).poSettle ?? 0) - Number((d as any).po_deductions ?? (d as any).poDeductions ?? 0); break;
                  case 'Rev Prorated': fieldValue = 0; break;
                  case '0 Mi Cap': fieldValue = 0; break;
                  case 'Escrow Adj': fieldValue = Number((d as any).escrow_deduction ?? (d as any).escrowDeduct ?? 0); break;
                  case 'Tolls Adj': fieldValue = Math.abs(d.tolls || d.tollCost || 0); break;
                  case 'Cash Adv': fieldValue = Number((d as any).cash_advance_percent ?? (d as any).cashAdvancePercent ?? 0); break;
                  case 'CPM Adj': fieldValue = Number((d as any).revenue_cpm ?? (d as any).revenueCpm ?? 0) * (Number(d.milesDriven) || 0); break;
                  case 'Fuel Adj': fieldValue = m.fuel; break;
                  case 'Fuel Reb.': fieldValue = m.fuelRebate; break;
                  case 'Wkly Exp.': fieldValue = m.wklyExp; break;
                  case 'Tolls': fieldValue = m.tolls; break;
                  case 'PO': fieldValue = m.po; break;
                  case 'Recruiting': fieldValue = m.recruiting; break;
                  case 'PnL 4w': fieldValue = 0; break;
                  case '4w Avg': fieldValue = 0; break;
                  case 'Total PnL': fieldValue = m.pnl; break;
                  default: return true;
              }

              const isCategorical = ['Company', 'Team', 'Franchise', 'Driver', 'Dispatcher'].includes(rule.field);
              const isEmptyValue = fieldValue === undefined || fieldValue === null || String(fieldValue).trim() === '' || String(fieldValue).trim() === 'Unassigned';

              if (rule.operator === 'is empty') return isEmptyValue;
              if (rule.operator === 'is not empty') return !isEmptyValue;

              if (isCategorical) {
                  const safeVal = String(fieldValue || 'Unassigned');
                  const selectedValues = Array.isArray(rule.value) ? rule.value : [];
                  if (rule.operator === 'is one of') return selectedValues.includes(safeVal);
                  if (rule.operator === 'is not one of') return !selectedValues.includes(safeVal);
                  if (rule.operator === 'is') return selectedValues.length > 0 && selectedValues[0] === safeVal;
                  if (rule.operator === 'is not') return selectedValues.length > 0 && selectedValues[0] !== safeVal;
                  return true;
              } else {
                  const numVal = Number(fieldValue) || 0;
                  const filterNum = Number(rule.value) || 0;
                  if (rule.operator === 'is equal') return numVal === filterNum;
                  if (rule.operator === 'is not equal') return numVal !== filterNum;
                  if (rule.operator === 'is less than') return numVal < filterNum;
                  if (rule.operator === 'is more than') return numVal > filterNum;
                  if (rule.operator === 'is less or equal') return numVal <= filterNum;
                  if (rule.operator === 'is more or equal') return numVal >= filterNum;
                  return true;
              }
          });
      });
  }, [validDrivers, tableFilters, fixedExpenses, enrichedMap, driverSettings]);


  const aggregatedDrivers = React.useMemo(() => {
    const dates = Array.from(new Set(validDrivers.map(d => d.payDate).filter(Boolean)));
    const sortedDates = dates.sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime());
    const allowedDates = new Set(sortedDates);
    const map = new Map<string, any>();
    const filteredDriverNames = new Set(filteredTableDrivers.map(d => d.name));

    const companyFilters = tableFilters.filter(f => f.field === 'Company');
    const isCompanyMatch = (d: any) => {
      if (companyFilters.length === 0) return true;
      return companyFilters.every(rule => {
        const safeVal = String(d.companyId || 'Unassigned');
        const selectedValues = Array.isArray(rule.value) ? rule.value : [];
        if (rule.operator === 'is one of') return selectedValues.includes(safeVal);
        if (rule.operator === 'is not one of') return !selectedValues.includes(safeVal);
        if (rule.operator === 'is') return selectedValues.length > 0 && selectedValues[0] === safeVal;
        if (rule.operator === 'is not') return selectedValues.length > 0 && selectedValues[0] !== safeVal;
        return true;
      });
    };

    const rankMap = new Map<string, { totalPnL: number, records: any[] }>();
    validDrivers.forEach(d => {
      if (!allowedDates.has(d.payDate)) return;
      const nameLower = (d.name || '').toLowerCase();
      const compLower = (d.companyId || '').toLowerCase();
      if (nameLower.includes('unassigned') || nameLower.includes('unreconciled') || compLower.includes('unassigned') || compLower.includes('unreconciled')) return;
      if (!isCompanyMatch(d)) return;

      if (!rankMap.has(d.name)) rankMap.set(d.name, { totalPnL: 0, records: [] });
      const rData = rankMap.get(d.name)!;
      const m = getRawMetrics(d, fixedExpenses, enrichedMap, pnlConfigs);
      rData.totalPnL += m.pnl;
      rData.records.push(d);
    });

    const rankList = Array.from(rankMap.entries()).map(([name, data]) => {
      const effNonTeamsCount = data.records.reduce((s: number, r: any) => s + (r.effectiveNonTeams || 0), 0);
      const effCount = data.records.reduce((s: number, r: any) => s + (r.effectiveDrivers || 0), 0);
      const count = effNonTeamsCount > 0 ? effNonTeamsCount : (effCount > 0 ? effCount : 1);
      return { name, avgPnLForRank: data.totalPnL / count };
    });

    rankList.sort((a, b) => a.avgPnLForRank - b.avgPnLForRank);
    const finalRankMap = new Map<string, number>();
    rankList.forEach((r, i) => {
      finalRankMap.set(r.name, rankList.length > 1 ? (i / (rankList.length - 1)) * 100 : 100);
    });

    validDrivers.forEach(d => {
      if (!filteredDriverNames.has(d.name)) return;
      if (!allowedDates.has(d.payDate)) return;
      const nameLower = (d.name || '').toLowerCase();
      const compLower = (d.companyId || '').toLowerCase();
      if (nameLower.includes('unassigned') || nameLower.includes('unreconciled') || compLower.includes('unassigned') || compLower.includes('unreconciled')) return;
      
      if (search && !nameLower.startsWith(search.toLowerCase())) return;

      if (!map.has(d.name)) {
        map.set(d.name, {
          id: d.name,
          name: d.name,
          status: d.status,
          franchiseId: d.franchiseId,
          totalGross: 0,
          companyPay: 0,
          totalPnL: 0,
          marginAmount: 0,
          poCoverage: 0,
          fuelCost: 0,
          fuelSavings: 0,
          totalFuel: 0,
          tollCost: 0,
          maintenanceCost: 0,
          driverFaultExpenses: 0,
          netPay: 0,
          dispatcherPay: 0,
          insuranceExp: 0,
          fuelRebate: 0,
          wklyExp: 0,
          recruitingCost: 0,
          tpogPercentages: [],
          contracts: new Set(),
          records: [],
          latestDate: d.payDate
        });
      }
      const agg = map.get(d.name);
      
      const m = getRawMetrics(d, fixedExpenses, enrichedMap, pnlConfigs);

      agg.totalGross += (d.grossRevenue || d.driver_gross || 0);
      agg.companyPay += m.revCol;
      agg.totalPnL += m.pnl;
      agg.marginAmount += (d.marginAmount || 0);
      agg.poCoverage += m.po;
      agg.fuelCost += (d.fuelCost ? -Math.abs(d.fuelCost) : 0);
      agg.fuelSavings += (d.fuelSavings || 0);
      agg.totalFuel += m.fuel;
      agg.tollCost += -m.tolls;
      agg.maintenanceCost += (d.maintenanceCost || 0);
      agg.driverFaultExpenses += (d.driverFaultExpenses || 0);
      agg.netPay += (d.netPay || 0);
      agg.dispatcherPay += m.dispPay;
      agg.insuranceExp += m.insExp;
      agg.fuelRebate += m.fuelRebate;
      agg.wklyExp += m.wklyExp;
      agg.recruitingCost += m.recruiting;
      
      if (d.tpogPercentage) agg.tpogPercentages.push(d.tpogPercentage);
      if (d.contractType) agg.contracts.add(d.contractType);
      agg.records.push(d);

      if (d.payDate) {
        const dDate = new Date(d.payDate).getTime();
        const aggDate = agg.latestDate ? new Date(agg.latestDate).getTime() : 0;
        if (!agg.latestDate || dDate > aggDate || (dDate === aggDate && String(d.status).toUpperCase() === 'TERMINATED')) {
          agg.latestDate = d.payDate;
          agg.status = d.status;
          agg.franchiseId = d.franchiseId;
        }
      }
    });

    let result = Array.from(map.values()).map(agg => {
      const effNonTeamsCount = agg.records.reduce((s: number, r: any) => s + (r.effectiveNonTeams || 0), 0);
      const effCount = agg.records.reduce((s: number, r: any) => s + (r.effectiveDrivers || 0), 0);
      const count = effNonTeamsCount > 0 ? effNonTeamsCount : (effCount > 0 ? effCount : 1);
      const div = count;

      if (isAvgPerWeek) {
        return {
          ...agg,
          totalGross: agg.totalGross / count,
          marginAmount: agg.marginAmount / count,
          poCoverage: agg.poCoverage / count,
          companyPay: agg.companyPay / count,
          fuelCost: agg.fuelCost / count,
          fuelSavings: agg.fuelSavings / count,
          totalFuel: agg.totalFuel / count,
          tollCost: agg.tollCost / count,
          maintenanceCost: agg.maintenanceCost / count,
          driverFaultExpenses: agg.driverFaultExpenses / count,
          totalPnL: agg.totalPnL / count,
          tpogPercentage: agg.tpogPercentages.length > 0 ? agg.tpogPercentages.reduce((a: number, b: number) => a + b, 0) / agg.tpogPercentages.length : 0,
          netPay: agg.netPay / count,
          dispatcherPay: agg.dispatcherPay / div,
          insuranceExp: agg.insuranceExp / count,
          fuelRebate: agg.fuelRebate / count,
          wklyExp: agg.wklyExp / div,
          recruitingCost: agg.recruitingCost / count,
          contracts: Array.from(agg.contracts),
          records: agg.records.sort((a: any, b: any) => new Date(a.payDate).getTime() - new Date(b.payDate).getTime()),
          ranking: finalRankMap.get(agg.name) ?? 100
        };
      }
      
      const avgTpog = agg.tpogPercentages.length > 0 ? agg.tpogPercentages.reduce((a: number, b: number) => a + b, 0) / agg.tpogPercentages.length : 0;
      return {
        ...agg,
        tpogPercentage: avgTpog,
        contracts: Array.from(agg.contracts),
        records: agg.records.sort((a: any, b: any) => new Date(a.payDate).getTime() - new Date(b.payDate).getTime()),
        ranking: finalRankMap.get(agg.name) ?? 100
      };
    });

    return result.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (sortConfig.direction === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }, [validDrivers, filteredTableDrivers, isAvgPerWeek, sortConfig, search, fixedExpenses, tableFilters, enrichedMap]);

  const fleetAverages = React.useMemo(() => {
    const contractAvgs: Record<string, any> = {};
    
    aggregatedDrivers.forEach(d => {
      const fullWeeks = d.records.filter((r: any) => (r.effectiveDrivers || 0) >= 1);
      fullWeeks.forEach((r: any) => {
         const cType = r.contractType || 'Unassigned';
         if (!contractAvgs[cType]) {
            contractAvgs[cType] = { 
               grossSum: 0, grossCount: 0, revSum: 0, revCount: 0, marginSum: 0, marginCount: 0,
               poCovSum: 0, poCovCount: 0, fuelSum: 0, fuelMilesSum: 0, netPaySum: 0, dispPaySum: 0,
               insExpSum: 0, fuelRebateSum: 0, wklyExpSum: 0, tollsSum: 0, recruitingSum: 0, pnlSum: 0, pnlCount: 0
            };
         }
         
         const m = getRawMetrics(r, fixedExpenses, enrichedMap, pnlConfigs);
         const poCov = m.po;
         const revCol = m.revCol;
         const fuelVal = m.fuel;
         const fuelReb = m.fuelRebate;
         const dispPay = m.dispPay;
         const insExp = m.insExp;
         const wklyExp = m.wklyExp;
         const dTollsRaw = m.tolls;
         const recruit = m.recruiting;
         const pnl = m.pnl;

         if (r.grossRevenue || r.driver_gross) { contractAvgs[cType].grossSum += (r.grossRevenue || r.driver_gross); contractAvgs[cType].grossCount++; }
         contractAvgs[cType].revSum += revCol; contractAvgs[cType].revCount++;
         if (r.marginAmount) { contractAvgs[cType].marginSum += r.marginAmount; contractAvgs[cType].marginCount++; }
         if (poCov) { contractAvgs[cType].poCovSum += poCov; contractAvgs[cType].poCovCount++; }
         if (r.fuelCost !== undefined || r.fuelSavings !== undefined) { contractAvgs[cType].fuelSum += fuelVal; contractAvgs[cType].fuelMilesSum += (r.milesDriven || 0); }
         if (r.netPay) { contractAvgs[cType].netPaySum += r.netPay; }
         if (dispPay) { contractAvgs[cType].dispPaySum += dispPay; }
         contractAvgs[cType].insExpSum += insExp;
         if (fuelReb) { contractAvgs[cType].fuelRebateSum += fuelReb; }
         if (wklyExp) { contractAvgs[cType].wklyExpSum += wklyExp; }
         if (dTollsRaw) { contractAvgs[cType].tollsSum += Math.abs(dTollsRaw); }
         if (recruit) { contractAvgs[cType].recruitingSum += recruit; }
         contractAvgs[cType].pnlSum += pnl;
         contractAvgs[cType].pnlCount++;
      });
    });

    const result: Record<string, any> = { 'ALL': {} };
    let totals: any = { grossSum: 0, grossCount: 0, revSum: 0, revCount: 0, marginSum: 0, marginCount: 0, poCovSum: 0, poCovCount: 0, fuelSum: 0, fuelMilesSum: 0, netPaySum: 0, dispPaySum: 0, insExpSum: 0, fuelRebateSum: 0, wklyExpSum: 0, tollsSum: 0, recruitingSum: 0, pnlSum: 0, pnlCount: 0 };

    Object.keys(contractAvgs).forEach(k => {
       const a = contractAvgs[k];
       Object.keys(totals).forEach(tk => totals[tk] += a[tk] || 0);
       result[k] = {
          gross: a.grossCount > 0 ? a.grossSum / a.grossCount : 0,
          rev: a.revCount > 0 ? a.revSum / a.revCount : 0,
          margin: a.marginCount > 0 ? a.marginSum / a.marginCount : 0,
          poCov: a.poCovCount > 0 ? a.poCovSum / a.poCovCount : 0,
          fuel: a.fuelMilesSum > 0 ? a.fuelSum / a.fuelMilesSum : 0,
          netPay: a.grossCount > 0 ? a.netPaySum / a.grossCount : 0,
          dispPay: a.grossCount > 0 ? a.dispPaySum / a.grossCount : 0,
          insExp: a.grossCount > 0 ? a.insExpSum / a.grossCount : 0,
          fuelRebate: a.grossCount > 0 ? a.fuelRebateSum / a.grossCount : 0,
          wklyExp: a.grossCount > 0 ? a.wklyExpSum / a.grossCount : 0,
          tolls: a.grossCount > 0 ? a.tollsSum / a.grossCount : 0,
          recruiting: a.grossCount > 0 ? a.recruitingSum / a.grossCount : 0,
          pnl: a.pnlCount > 0 ? a.pnlSum / a.pnlCount : 100
       };
    });
    
    result['ALL'] = {
        gross: totals.grossCount > 0 ? totals.grossSum / totals.grossCount : 0,
        rev: totals.revCount > 0 ? totals.revSum / totals.revCount : 0,
        margin: totals.marginCount > 0 ? totals.marginSum / totals.marginCount : 0,
        poCov: totals.poCovCount > 0 ? totals.poCovSum / totals.poCovCount : 0,
        fuel: totals.fuelMilesSum > 0 ? totals.fuelSum / totals.fuelMilesSum : 0,
        netPay: totals.grossCount > 0 ? totals.netPaySum / totals.grossCount : 0,
        dispPay: totals.grossCount > 0 ? totals.dispPaySum / totals.grossCount : 0,
        insExp: totals.grossCount > 0 ? totals.insExpSum / totals.grossCount : 0,
        fuelRebate: totals.grossCount > 0 ? totals.fuelRebateSum / totals.grossCount : 0,
        wklyExp: totals.grossCount > 0 ? totals.wklyExpSum / totals.grossCount : 0,
        tolls: totals.grossCount > 0 ? totals.tollsSum / totals.grossCount : 0,
        recruiting: totals.grossCount > 0 ? totals.recruitingSum / totals.grossCount : 0,
        pnl: totals.pnlCount > 0 ? totals.pnlSum / totals.pnlCount : 100
    };

    return result;
  }, [aggregatedDrivers, fixedExpenses]);

  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, tableFilters, isAvgPerWeek, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };
  const handleToggle = React.useCallback((id: string) => {
    setExpandedDriverId(prev => prev === id ? null : id);
  }, []);

  return (
    <div className="flex flex-col h-full gap-2 relative">
      {showSettings && (
        <DriverSettings 
          onClose={() => setShowSettings(false)} 
          settings={driverSettings} 
          onSave={handleSaveSettings}
          contracts={Array.from(new Set(validDrivers.map(d => d.contractType))).filter(c => c && !['GLOBAL', 'UNASSIGNED', 'UNRECONCILED'].includes(c?.toUpperCase()))}
          companies={Array.from(new Set(validDrivers.map(d => d.companyId))).filter(c => c && !['GLOBAL', 'UNASSIGNED', 'UNRECONCILED'].includes(c?.toUpperCase()))}
        />
      )}
      <div className="flex justify-between items-center px-1 mb-2">
        <div className="flex items-center gap-2">
          <input 
            type="text" 
            placeholder="Search driver..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-[11px] px-2 py-1 h-[26px] rounded w-64 text-zinc-300 focus:border-emerald-500 focus:outline-none" 
          />
        </div>
        <div className="flex items-center gap-2 relative">
            <div className="w-[90px] h-[26px] z-50 relative [&_.absolute]:!right-0 [&_.absolute]:!left-auto [&>*:first-child]:!text-[9px] [&>*:first-child]:!whitespace-nowrap [&>*:first-child]:!tracking-tight [&_button]:!text-[9px] [&_button]:!whitespace-nowrap">
               <TableFilter
                 filters={tableFilters} 
                 setFilters={setTableFilters}
                 optionsMap={{
                   'Driver': Array.from(new Set(validDrivers.map(d => d.name))).filter(Boolean) as string[],
                   'Contract': Array.from(new Set(validDrivers.map(d => d.contractType))).filter(Boolean) as string[],
                   'Company': Array.from(new Set(validDrivers.map(d => d.companyId))).filter(Boolean) as string[],
                   'Franchise': Array.from(new Set(validDrivers.map(d => d.franchiseId))).filter(Boolean) as string[],
                   'Gross': ['good', 'neutral', 'warning', 'critical'],
                   'Margin': ['good', 'neutral', 'warning', 'critical'],
                   'Net Pay': ['good', 'neutral', 'warning', 'critical'],
                   'Disp. Pay': ['good', 'neutral', 'warning', 'critical'],
                   'Fuel': ['good', 'neutral', 'warning', 'critical'],
                   'Rev. Col.': ['good', 'neutral', 'warning', 'critical'],
                   'Total PnL': ['good', 'neutral', 'warning', 'critical'],
                   'PO': ['good', 'neutral', 'warning', 'critical']
                 }}
               />
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="rounded text-[10px] font-bold border transition-colors cursor-pointer bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white flex items-center justify-center gap-1 w-[90px] h-[26px]"
            >
              <Settings size={10} /> SETTINGS
            </button>
            <button 
              onClick={() => setIsAvgPerWeek(!isAvgPerWeek)}
              className={`rounded text-[10px] font-bold border transition-colors cursor-pointer flex items-center justify-center px-3 h-[26px] ${isAvgPerWeek ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'}`}
            >
              AVERAGE
            </button>
        </div>
      </div>
      <div className="overflow-auto border border-zinc-800 rounded-t-lg bg-zinc-900 flex-1">
        <table className="w-full text-left text-[11px] whitespace-nowrap relative">
          <thead className="bg-zinc-800/50 text-zinc-400 font-medium uppercase tracking-wider sticky top-0 z-10">
            <tr>
              <th className="px-2 py-1.5 w-[32px] min-w-[32px] max-w-[32px] bg-zinc-900 border-b border-zinc-800 sticky top-0 left-0 z-30"></th>
              <th onClick={() => requestSort('name')} className="px-2 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[10px] cursor-pointer hover:text-white select-none text-left sticky top-0 left-[32px] z-30">Driver</th>
              <th onClick={() => requestSort('totalGross')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-yellow-400 cursor-pointer hover:text-white select-none sticky top-0 z-20">Drv. Gross{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('marginAmount')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-yellow-400 cursor-pointer hover:text-white select-none sticky top-0 z-20">Margin{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('netPay')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-purple-400 cursor-pointer hover:text-white select-none sticky top-0 z-20">Net Pay{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('insuranceExp')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-purple-400 cursor-pointer hover:text-white select-none sticky top-0 z-20">Ins. Exp.{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('totalFuel')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-purple-400 cursor-pointer hover:text-white select-none sticky top-0 z-20">Fuel{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('companyPay')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-blue-400 cursor-pointer hover:text-white select-none sticky top-0 z-20">Rev. Col.{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('fuelRebate')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-blue-400 cursor-pointer hover:text-white select-none sticky top-0 z-20">Fuel Reb.{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('wklyExp')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-blue-400 cursor-pointer hover:text-white select-none sticky top-0 z-20">Wkly Exp.{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('tollCost')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-blue-400 cursor-pointer hover:text-white select-none sticky top-0 z-20">Tolls{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('poCoverage')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-blue-400 cursor-pointer hover:text-white select-none sticky top-0 z-20">PO{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('dispatcherPay')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-blue-400 cursor-pointer hover:text-white select-none sticky top-0 z-20">Disp. Pay{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('recruitingCost')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-blue-400 cursor-pointer hover:text-white select-none sticky top-0 z-20">Recruiting{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('totalPnL')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] font-bold text-white cursor-pointer hover:text-emerald-400 select-none sticky top-0 right-[56px] z-40 w-[80px] min-w-[80px]">Total PnL{isAvgPerWeek ? ' / wk' : ''}</th>
              <th className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] font-bold text-white select-none sticky top-0 right-0 z-40 w-[56px] min-w-[56px]">Rank</th>
            </tr>
          </thead>
        <tbody className="divide-y divide-zinc-800 font-mono">
          {aggregatedDrivers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((driver) => (
            <DriverRow 
              key={driver.id}
              driver={driver} 
              isExpanded={expandedDriverId === driver.id} 
              onToggle={handleToggle}
              fleetAverages={fleetAverages}
              settings={driverSettings}
              fixedExpenses={fixedExpenses}
              enrichedMap={enrichedMap}
              pnlConfigs={pnlConfigs}
            />
          ))}
        </tbody>
      </table>
    </div>
    <div className="flex items-center justify-between px-4 py-2 border border-t-0 border-zinc-800 rounded-b-lg bg-zinc-900/50 flex-shrink-0">
      <span className="text-[10px] text-zinc-500">
        Showing {Math.min((currentPage - 1) * itemsPerPage + 1, aggregatedDrivers.length)} to {Math.min(currentPage * itemsPerPage, aggregatedDrivers.length)} of {aggregatedDrivers.length} entries
      </span>
      <div className="flex gap-1">
        <button 
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
          disabled={currentPage === 1} 
          className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded text-[10px] disabled:opacity-50 hover:bg-zinc-700 transition-colors cursor-pointer"
        >
          Prev
        </button>
        <button 
          onClick={() => setCurrentPage(p => Math.min(Math.ceil(aggregatedDrivers.length / itemsPerPage), p + 1))} 
          disabled={currentPage === Math.ceil(aggregatedDrivers.length / itemsPerPage) || aggregatedDrivers.length === 0} 
          className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded text-[10px] disabled:opacity-50 hover:bg-zinc-700 transition-colors cursor-pointer"
        >
          Next
        </button>
      </div>
    </div>
    </div>
  );
};

export default DriverTable;