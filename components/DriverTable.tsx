import TableFilter, { FilterRule } from './TableFilter';
import React, { useState, useEffect } from 'react';
import DriverStats from './DriverStats';
import { DriverPerformance, DriverStatus, DispatcherTier } from '../types';
import { formatCurrency, formatPercent } from '../utils';
import { AlertCircle, CheckCircle, TrendingUp, UserMinus, ChevronDown, ChevronUp, ChevronRight, AlertTriangle, X, Minus, Filter, Info, Settings, Circle, ArrowRightLeft, BarChart2, LineChart, Eye } from 'lucide-react';
import HistoricalChart from './HistoricalChart';
import DriverSettings from './DriverSettings';
import { supabase } from '../lib/supabase';
import { getActiveAmount, getWeeklyAmountFromExp } from './WklyExpCalc';

const metricsCache = new Map<string, any>();
let lastConfigsHash = '';

export const getRawMetrics = (r: any, fixedExpenses: any[] = [], enrichedMap?: Map<string, any>, pnlConfigs: any[] = [], poRules: any[] = []) => {
  const hash = `${fixedExpenses.length}_${pnlConfigs.length}_${poRules.length}`;
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

  const enriched = enrichedMap ? enrichedMap.get(`${r.name}_${targetDateStr}_${r.contractType}_${r.companyId}`) : (window as any).__ENRICHED_DRIVERS__?.find((ed: any) => {
      let dStr = ed.payDate || ed.week_ending || '';
      if (dStr.includes('T')) dStr = dStr.split('T')[0];
      return ed.name === r.name && dStr === targetDateStr && (ed.contractType === r.contractType || (r.contractType === 'TPOG' && ed.contractType === 'TPOG WITH FRANCHISE') || (r.contractType === 'OO' && ed.contractType === 'OO WITH FRANCHISE')) && ed.companyId === r.companyId;
  });

        const wklyExp = enriched ? Number(enriched.calculatedFixedCost ?? enriched.fixed_costs ?? 0) : Number(r.calculatedFixedCost ?? r.fixed_costs ?? ((tFloat + tWkly + oIns + dEld + dIfta + mSup + liab + tPhd) * effNT + (dTrl + dTrlPhd) * effTr));
        const insExp = enriched ? Number(enriched.insuranceCost ?? 0) : ((oIns + liab + tPhd) * effNT + (dTrlPhd) * effTr);
        const dTollsFinal = r.pnlTolls !== undefined ? Number(r.pnlTolls) : (enriched ? Number(enriched.calculatedTolls ?? enriched.tolls ?? enriched.tollCost ?? 0) : Number(r.calculatedTolls ?? r.tolls ?? r.tollCost ?? r.tolls_amount ?? r.tollsAmount ?? 0));

        const isGarland = r.name === 'Garland Jermaine Norris';
  const spotter = Number(r.spotter_fuel_saved ?? 0);
  const saved2 = Number(r.fuel_saved_2 ?? 0);
  let fuel = 0;
  if (ct.includes('TPOG') || ct === 'POG' || ct === 'CPM') {
      fuel = -Math.abs(fSpent);
  } else {
      fuel = spotter !== 0 ? (spotter + (fSaved - saved2)) : fSaved;
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
      drvFuelAdj = isGarland ? 0 : (['MCLOO', 'OO', 'LOO', 'LPOO', 'MCOO'].includes(ct) ? (spotter !== 0 ? (spotter + (fSaved - saved2)) : fSaved) : -Math.abs(fSpent));
  } else {
      drvEscrowAdj = 0;
      drvTollsAdj = Math.abs(dTollsRaw) * 0.3;
      drvCpmAdj = dRevCpm * dMiles;
      drvFuelAdj = (spotter !== 0 ? (spotter + (fSaved - saved2)) : fSaved);
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

  let fullSharedLiabAmount = 0;
  const curTime = (targetDateStr ? new Date(targetDateStr).getTime() : Date.now()) - (3 * 24 * 60 * 60 * 1000);
  let liabRuleForDisp = fixedExpenses.filter(e => (e.name === 'Liability Insurance (Auto)' || e.name === 'Liability Insurance') && e.companyId === r.companyId && (!e.valid_from || new Date(e.valid_from).getTime() <= curTime) && (!e.valid_to || new Date(e.valid_to).getTime() >= curTime)).sort((a, b) => new Date(b.valid_from || 0).getTime() - new Date(a.valid_from || 0).getTime())[0];
  if (!liabRuleForDisp) {
      liabRuleForDisp = fixedExpenses.filter(e => (e.name === 'Liability Insurance (Auto)' || e.name === 'Liability Insurance') && e.companyId === 'ALL' && (!e.valid_from || new Date(e.valid_from).getTime() <= curTime) && (!e.valid_to || new Date(e.valid_to).getTime() >= curTime)).sort((a, b) => new Date(b.valid_from || 0).getTime() - new Date(a.valid_from || 0).getTime())[0];
  }
  if (liabRuleForDisp) {
      let sharedVal = 0;
      if (liabRuleForDisp.shared_insurance !== undefined && liabRuleForDisp.shared_insurance !== null && String(liabRuleForDisp.shared_insurance).trim() !== '') {
          sharedVal = Number(liabRuleForDisp.shared_insurance);
      } else if (liabRuleForDisp.shared_liability !== undefined && liabRuleForDisp.shared_liability !== null && String(liabRuleForDisp.shared_liability).trim() !== '') {
          sharedVal = Number(liabRuleForDisp.shared_liability);
      }
      fullSharedLiabAmount = sharedVal * effNT;
  }
  
  const actualSharedIns = enriched && enriched.fullSharedLiability !== undefined ? Math.abs(Number(enriched.fullSharedLiability)) : (ct === 'MCLOO' ? Math.abs(fullSharedLiabAmount) : 0);

let sharedInsBreakdown: Record<string, number> = {};
if (actualSharedIns !== 0) {
let comp = r.companyId || 'Unassigned';
sharedInsBreakdown[comp] = actualSharedIns;
}

  const revCol = drvRevBase + effectiveBalChangeForCompanyPay + drvTruckFloat + drvTruckWkly + drvOccIns + drvEld + drvIfta + drvMaintSupport + drvLiability + drvTruckPhd + drvTrailer + drvTrailerPhd + drvZeroMiDrop + drvEscrowAdj + drvTollsAdj + drvCashAdv + drvCpmAdj + drvFuelAdj + actualSharedIns;
        let calcPo = 0;
        let calcFPo = 0;
        if (enriched && enriched.po_breakdown) {
            Object.entries(enriched.po_breakdown).forEach(([k, v]: [string, any]) => {
                let exMain = false; let exFran = false;
                if (poRules.find(ru => ru.contract_type === 'ALL' && ru.category_name === k && ru.status === 'Exclude')) { exMain = true; exFran = true; }
                const relRule = poRules.find(ru => ru.contract_type === (r.contractType || 'Unknown') && ru.category_name === k && ru.status === 'Exclude');
                if (relRule) {
                    if ((r.contractType || 'Unknown') === 'TPOG') {
                        const scope = relRule.tpog || 'Only TPOG with franchises';
                        if (scope === 'ALL TPOG' || (scope === 'Only TPOG with franchises' && r.franchiseId) || (scope === 'Only TPOG without franchises' && !r.franchiseId)) exMain = true;
                    } else exMain = true;
                }
                if (poRules.find(ru => (ru.contract_type === 'TPOG Franchise PnL' || ru.contract_type === 'TPOG (Franchise PnL)') && ru.category_name === k && ru.status === 'Exclude')) exFran = true;
                if (!exMain) calcPo += Number(v);
                if (!exFran && r.contractType === 'TPOG' && r.franchiseId) calcFPo += Number(v);
            });
        }
        const po = r.pnlTotalPOCov !== undefined ? Number(r.pnlTotalPOCov) : (enriched && enriched.po_breakdown ? calcPo : (enriched && enriched.poCoverage !== undefined ? Number(enriched.poCoverage) : -(Math.abs(Number(r.poCoverage ?? r.poAmount ?? 0)))));
        const dispPay = enriched && enriched.dispatcherCommission !== undefined ? Number(enriched.dispatcherCommission) : calcDispPay;
        const recruiting = enriched && enriched.recruitingCost !== undefined ? Math.abs(Number(enriched.recruitingCost)) : Math.abs(Number(r.recruitingCost ?? r.recruiting_cost ?? 0));
        
        const dispGrossAmt = enriched && enriched.dispGrossAmount !== undefined ? Math.abs(Number(enriched.dispGrossAmount)) : (driver_gross * (dispGrossPerc / 100));
        const dispMarginAmt = enriched && enriched.dispMarginAmount !== undefined ? Math.abs(Number(enriched.dispMarginAmount)) : (margin_amt * (dispMarginPerc / 100));
        const dispFixedAmt = enriched && enriched.dispFixedAmount !== undefined ? Math.abs(Number(enriched.dispFixedAmount)) : Math.abs(dispFixedAmount);
        
        let dispSharedAmt = 0;
        if (enriched) {
            if (enriched.dispSharedAmount !== undefined) dispSharedAmt = Math.abs(Number(enriched.dispSharedAmount));
            else if (enriched.dispSharedLiability !== undefined) dispSharedAmt = Math.abs(Number(enriched.dispSharedLiability));
            else dispSharedAmt = Math.abs(Number(dispSharedVal) || 0);
        } else {
            dispSharedAmt = Math.abs(Number(dispSharedVal) || 0);
        }

        let configContract = effContractType;
        const upper = configContract.toUpperCase();
        if (upper.includes('TPOG')) configContract = 'TPOG';
        else if (upper === 'OO' || upper.includes('OO WITH FRANCHISE')) configContract = 'OO';
        
        const config = pnlConfigs.find((c: any) => c.contract_type === configContract);
        const activeItems = config ? config.toggled_items : ['revenue_collected', 'fuel_rebate', 'dispatcher_pay', 'weekly_expenses', 'po', 'tolls', 'recruiting'];

        let pnlRevCol = activeItems.includes('revenue_collected') ? revCol : 0;
        let pnlFuelReb = activeItems.includes('fuel_rebate') ? fuelRebate : 0;
        let pnlDisp = activeItems.includes('dispatcher_pay') ? (dispGrossAmt + dispMarginAmt + dispFixedAmt) : 0;
        let pnlWkly = activeItems.includes('weekly_expenses') ? wklyExp : 0;
        let pnlPo = activeItems.includes('po') ? Math.abs(po) : 0;
        let pnlRecruiting = activeItems.includes('recruiting') ? recruiting : 0;
        let pnlTolls = activeItems.includes('tolls') ? Math.abs(dTollsFinal) : 0;

        let franchisePnl = 0;
        let franchisePnlCalculated = 0;
        let franchiseRevCol = 0;
        let franchiseFuelReb = 0;
        let franchiseDispPay = 0;
        let franchiseWklyExp = 0;
        let franchisePo = 0;
        let franchiseRecruiting = 0;
        let franchiseTolls = 0;
        if (effContractType === 'TPOG WITH FRANCHISE' || (ct === 'TPOG' && r.franchiseId)) {
           let actualFRevCol = revCol + drvBalanceChange;
            let enrichedFWE = enriched && Number(enriched.franchise_fixed_costs_full) ? Number(enriched.franchise_fixed_costs_full) : undefined;
            let dbFWE = Number(r.franchise_fixed_costs_full) ? Number(r.franchise_fixed_costs_full) : undefined;
            let actualFWklyExp = enrichedFWE !== undefined ? enrichedFWE : (dbFWE !== undefined ? dbFWE : wklyExp);
            
            let actualFPo = 0;
            if (enriched && enriched.po_breakdown) {
                actualFPo = calcFPo;
            } else if (enriched && enriched.franchise_po !== undefined) {
                actualFPo = Number(enriched.franchise_po);
            } else if (r.franchise_po !== undefined) {
                actualFPo = Number(r.franchise_po);
                pnlPo = 0;
            } else {
                actualFPo = -(Math.abs(Number(r.pnlTotalPOCov ?? r.poCoverage ?? r.poAmount ?? 0)));
                pnlPo = 0; 
            }
            
            let actualFTolls = Number(r.franchise_tolls) ? Math.abs(Number(r.franchise_tolls)) : Math.abs(dTollsFinal);
            let actualFRecruiting = Number(r.franchise_recruiting) ? Math.abs(Number(r.franchise_recruiting)) : Math.abs(recruiting);
            let actualFDisp = Math.abs(dispPay);

            franchiseRevCol = actualFRevCol;
            franchiseFuelReb = fuelRebate;
            franchiseDispPay = actualFDisp;
            franchiseWklyExp = actualFWklyExp;
            franchisePo = actualFPo;
            franchiseRecruiting = actualFRecruiting;
            franchiseTolls = actualFTolls;

            let calcFRevCol = activeItems.includes('revenue_collected') ? actualFRevCol : 0;
            let calcFFuelReb = activeItems.includes('fuel_rebate') ? fuelRebate : 0;
            let calcFDisp = activeItems.includes('dispatcher_pay') ? actualFDisp : 0;
            let calcFWklyExp = activeItems.includes('weekly_expenses') ? actualFWklyExp : 0;
            let calcFPoToUse = activeItems.includes('po') ? Math.abs(actualFPo) : 0;
            let calcFRecruiting = activeItems.includes('recruiting') ? actualFRecruiting : 0;
            let calcFTolls = activeItems.includes('tolls') ? actualFTolls : 0;
            
            franchisePnl = calcFRevCol + calcFFuelReb - calcFDisp - calcFWklyExp - calcFPoToUse - calcFRecruiting - calcFTolls;
            
            let fBalChange = activeItems.includes('revenue_collected') ? drvBalanceChange : 0;
            let fEscrowAdj = activeItems.includes('revenue_collected') ? drvEscrowAdj : 0;
            franchisePnlCalculated = ((franchisePnl - fBalChange - fEscrowAdj) / 2) + fBalChange + fEscrowAdj;
        }

        let pnl = pnlRevCol + pnlFuelReb - pnlDisp - pnlWkly - pnlPo - pnlRecruiting - pnlTolls;
        if (configContract !== 'TPOG') {
            let pnlDispVal = ct === 'MCLOO' ? (dispGrossAmt + dispMarginAmt + dispFixedAmt) : Math.max(0, Math.abs(dispPay) - dispSharedAmt);
            pnl = revCol + fuelRebate - Math.abs(wklyExp) - Math.abs(po) - Math.abs(dTollsFinal) - pnlDispVal - Math.abs(recruiting);
        }

        const result = { 
          wklyExp, insExp, fuel, fuelRebate, revCol, tolls: Math.abs(dTollsFinal), po, dispPay, pnl, recruiting, 
          franchisePnl, franchisePnlCalculated, franchiseRevCol, franchiseFuelReb, franchiseDispPay, franchiseWklyExp, franchisePo, franchiseRecruiting, franchiseTolls,
          revBase: drvRevBase,
          balChange: effectiveBalChangeForCompanyPay,
          prorated: drvTruckFloat + drvTruckWkly + drvOccIns + drvEld + drvIfta + drvMaintSupport + drvLiability + drvTruckPhd + drvTrailer + drvTrailerPhd,
          zeroMiDrop: drvZeroMiDrop,
          escrowAdj: drvEscrowAdj,
          tollsAdj: drvTollsAdj,
          cashAdv: drvCashAdv,
          cpmAdj: drvCpmAdj,
          fuelAdj: drvFuelAdj,
          fullSharedLiability: actualSharedIns,
          sharedInsBreakdown,
          dispGrossAmt,
          dispMarginAmt,
          dispFixedAmt,
          dispSharedAmt,
          appliedDispRuleLabel: enriched && enriched.appliedDispRuleLabel ? enriched.appliedDispRuleLabel : (dispRule ? (() => {
              const dName = dispRule.dispatcher_name || dispRule.dispatcherName || dispRule.dispatcher_id || dispRule.dispatcherId || dispRule.dispatcher || 'Company Default';
              let parts = [];
              if (dispGrossPerc > 0) parts.push(`${dispGrossPerc}% Gross`);
              if (dispMarginPerc > 0) parts.push(`${dispMarginPerc}% Margin`);
              if (dispFixedAmount > 0) parts.push(`$${dispFixedAmount} Fixed`);
              return parts.length > 0 ? `${dName} (${parts.join(', ')})` : dName;
          })() : 'Company Default')
        };
        metricsCache.set(cacheKey, result);
        return result;
};

interface DriverTableProps {
  drivers: DriverPerformance[];
}

const DriverRow = React.memo(({ driver, isExpanded, onToggle, fleetAverages, settings, fixedExpenses, enrichedMap, pnlConfigs, isAvgPerWeek, tpogMode, isRevColExpanded, isFuelExpanded, isMilesExpanded, poColumns, poRules, selectedPayDate }: { driver: any; isExpanded: boolean; onToggle: (id: string) => void; fleetAverages: any; settings?: any; fixedExpenses: any[]; enrichedMap?: Map<string, any>; pnlConfigs: any[]; isAvgPerWeek: boolean; tpogMode: 'ALL' | 'CALCULATED'; isRevColExpanded: boolean; isFuelExpanded: boolean; isMilesExpanded: boolean; poColumns: string[]; poRules: any[]; selectedPayDate: string }) => {
  const [selectedEntity, setSelectedEntity] = useState<string>('TOTAL');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['pnl']);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const handleTooltipMouseMove = (e: React.MouseEvent) => {
    const parent = e.currentTarget as HTMLElement;
    parent.style.zIndex = '9999999';

    const tooltips = parent.querySelectorAll('.dynamic-tooltip');
    tooltips.forEach((t) => {
        const tooltip = t as HTMLElement;
        const x = e.clientX;
        const y = e.clientY;
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        const percentY = (y / vh) * 100;
        
        tooltip.style.position = 'fixed';
        tooltip.style.top = `${y}px`;
        tooltip.style.bottom = 'auto';
        if (tooltip.classList.contains('tooltip-right')) {
            tooltip.style.left = `${x + 15}px`;
            tooltip.style.right = 'auto';
        } else {
            tooltip.style.left = 'auto';
            tooltip.style.right = `${vw - x + 15}px`;
        }
        tooltip.style.transform = `translateY(-${percentY}%)`;
        tooltip.style.maxHeight = '90vh';
        tooltip.style.overflowY = 'auto';
        tooltip.style.backgroundColor = '#27272a';
        tooltip.style.opacity = '1';
        tooltip.style.zIndex = '2147483647';
    });
  };

  const handleTooltipMouseLeave = (e: React.MouseEvent) => {
    const parent = e.currentTarget as HTMLElement;
    parent.style.zIndex = '';
  };

  const selectedContract = selectedEntity.startsWith('CTR:') ? selectedEntity.split(':')[1] : 'ALL';

  const configContract = React.useMemo(() => {
    let ct = driver.contractType || 'Unassigned';
    const upper = ct.toUpperCase();
    if (upper.includes('TPOG')) return 'TPOG';
    if (upper === 'OO' || upper.includes('OO WITH FRANCHISE')) return 'OO';
    return ct;
  }, [driver.contractType]);

  const activeItems = React.useMemo(() => {
    const config = pnlConfigs.find((c: any) => c.contract_type === configContract);
    return config ? config.toggled_items : ['revenue_collected', 'fuel_rebate', 'dispatcher_pay', 'weekly_expenses', 'po', 'tolls', 'recruiting'];
  }, [pnlConfigs, configContract]);

  const renderDisabled = (itemKey: string, content: React.ReactNode) => {
    const excludedContracts = new Set<string>();
    const includedContracts = new Set<string>();
    let excludedAmount = 0;

    filteredRecords.forEach((r: any) => {
        let ct = r.contractType || 'Unassigned';
        let effCt = ct;
        if (ct === 'TPOG' && r.franchiseId) effCt = 'TPOG WITH FRANCHISE';
        if (ct === 'OO' && r.franchiseId) effCt = 'OO WITH FRANCHISE';

        let configContract = effCt;
        const upper = configContract.toUpperCase();
        if (upper.includes('TPOG')) configContract = 'TPOG';
        else if (upper === 'OO' || upper.includes('OO WITH FRANCHISE')) configContract = 'OO';

        const config = pnlConfigs.find((c: any) => c.contract_type === configContract);
        const activeItemsForRec = config ? config.toggled_items : ['revenue_collected', 'fuel_rebate', 'dispatcher_pay', 'weekly_expenses', 'po', 'tolls', 'recruiting'];

        if (!activeItemsForRec.includes(itemKey)) {
            excludedContracts.add(ct);
            const m = getRawMetrics(r, fixedExpenses, enrichedMap, pnlConfigs, poRules);
            const tpogCalc = tpogMode === 'CALCULATED' ? 1 : 0;
            if (itemKey === 'revenue_collected') excludedAmount += m.revCol - (tpogCalc * (m.franchiseRevCol || 0) / 2);
            else if (itemKey === 'fuel_rebate') excludedAmount += m.fuelRebate - (tpogCalc * (m.franchiseFuelReb || 0) / 2);
            else if (itemKey === 'dispatcher_pay') excludedAmount += m.dispPay - (tpogCalc * (m.franchiseDispPay || 0) / 2);
            else if (itemKey === 'weekly_expenses') excludedAmount += m.wklyExp - (tpogCalc * (m.franchiseWklyExp || 0) / 2);
            else if (itemKey === 'po') excludedAmount += m.po - (tpogCalc * (m.franchisePo || 0) / 2);
            else if (itemKey === 'tolls') excludedAmount += m.tolls - (tpogCalc * (m.franchiseTolls || 0) / 2);
            else if (itemKey === 'recruiting') excludedAmount += m.recruiting - (tpogCalc * (m.franchiseRecruiting || 0) / 2);
        } else {
            includedContracts.add(ct);
        }
    });

    if (excludedContracts.size === 0) return <>{content}</>;

    if (excludedContracts.size > 0 && includedContracts.size > 0) {
        const count = isAvgPerWeek ? Math.max(1, new Set(filteredRecords.map((r: any) => r.payDate || r.week_ending)).size) : 1;
        const displayExclAmount = excludedAmount / count;

        return (
          <span className="relative group/disableditem flex items-center justify-end gap-0.5 cursor-help w-full" onMouseMove={handleTooltipMouseMove} onMouseLeave={handleTooltipMouseLeave}>
              <span>{content}</span>
              <span className="text-rose-500 font-bold text-[14px] shrink-0 leading-none pb-[1px]">!</span>
              <div className="fixed hidden group-hover/disableditem:flex z-[100000] bg-zinc-800 border border-zinc-500 text-rose-300 px-2 py-1.5 rounded shadow-xl text-[10px] whitespace-normal w-max max-w-[200px] text-left pointer-events-none font-normal opacity-100 dynamic-tooltip">
                  Excluded from PnL Calculation for {Array.from(excludedContracts).join(', ')}: {formatCurrency(Math.abs(displayExclAmount))}
              </div>
          </span>
        );
    }

    return (
      <span className="relative group/disableditem inline-block line-through decoration-rose-500 opacity-100 cursor-help" onMouseMove={handleTooltipMouseMove} onMouseLeave={handleTooltipMouseLeave}>
        {content}
        <div className="fixed hidden group-hover/disableditem:flex z-[100000] bg-zinc-800 border border-zinc-500 text-rose-300 px-2 py-1.5 rounded shadow-xl text-[10px] whitespace-nowrap pointer-events-none font-normal opacity-100 dynamic-tooltip">
          Excluded from PnL Calculation
        </div>
      </span>
    );
  };

  const toggleMetric = (metric: string) => {
    setSelectedMetrics(prev => prev.includes(metric) && prev.length > 1 ? prev.filter(m => m !== metric) : prev.includes(metric) ? prev : [...prev, metric]);
  };

  const filteredRecords = React.useMemo(() => {
    let base = driver.records;
    if (selectedEntity !== 'TOTAL') {
      const [type, val] = selectedEntity.split(':');
      base = base.filter((r: any) => {
        if (type === 'CTR') return (r.contractType && r.contractType !== '-' ? r.contractType : 'Unassigned') === val;
        if (type === 'CMP') return (r.companyId && r.companyId !== '-' ? r.companyId : 'Unassigned') === val;
        if (type === 'TEAM') return (r.teamId && r.teamId !== '-' ? r.teamId : 'Unassigned') === val;
        if (type === 'FRA') return (r.franchiseId && r.franchiseId !== '-' ? r.franchiseId : 'Unassigned') === val;
        if (type === 'DISP') return (r.dispatcherId && r.dispatcherId !== '-' ? r.dispatcherId : 'Unassigned') === val;
        return true;
      });
    }
    const recordsByKey = base.reduce((acc: any, r: any) => {
      const key = `${r.payDate || r.week_ending}_${r.contractType}_${r.companyId}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(r);
      return acc;
    }, {});
    return Object.values(recordsByKey).map((group: any) => 
      group.reduce((prev: any, curr: any) => {
        const base = ((curr.grossRevenue || curr.driver_gross || 0) > (prev.grossRevenue || prev.driver_gross || 0)) ? curr : prev;
        return {
          ...base,
          grossRevenue: (prev.grossRevenue || 0) + (curr.grossRevenue || 0),
          driver_gross: (prev.driver_gross || 0) + (curr.driver_gross || 0),
          marginAmount: (prev.marginAmount || 0) + (curr.marginAmount || 0),
          netPay: (prev.netPay || 0) + (curr.netPay || 0),
          milesDriven: (prev.milesDriven || 0) + (curr.milesDriven || 0),
          tolls: (prev.tolls || 0) + (curr.tolls || 0),
          tollCost: (prev.tollCost || 0) + (curr.tollCost || 0),
          originalDbTolls: (prev.originalDbTolls || 0) + (curr.originalDbTolls || 0),
          poCoverage: (prev.poCoverage || 0) + (curr.poCoverage || 0),
          poAmount: (prev.poAmount || 0) + (curr.poAmount || 0),
          pnlTotalPOCov: (prev.pnlTotalPOCov || 0) + (curr.pnlTotalPOCov || 0),
          recruitingCost: (prev.recruitingCost || 0) + (curr.recruitingCost || 0),
          recruiting_cost: (prev.recruiting_cost || 0) + (curr.recruiting_cost || 0),
          fixed_costs: (prev.fixed_costs || 0) + (curr.fixed_costs || 0),
          calculatedFixedCost: (prev.calculatedFixedCost || 0) + (curr.calculatedFixedCost || 0)
        };
      })
    );
  }, [driver.records, selectedEntity]);

  const allFilteredRecords = React.useMemo(() => {
    const baseRecords = driver.allRecords || driver.records;
    let timeFiltered = baseRecords;
    if (selectedPayDate !== 'ALL') {
      timeFiltered = baseRecords.filter((r: any) => (r.payDate || r.week_ending) <= selectedPayDate);
    }
    let base = timeFiltered;
    if (selectedEntity !== 'TOTAL') {
      const [type, val] = selectedEntity.split(':');
      base = base.filter((r: any) => {
        if (type === 'CTR') return (r.contractType && r.contractType !== '-' ? r.contractType : 'Unassigned') === val;
        if (type === 'CMP') return (r.companyId && r.companyId !== '-' ? r.companyId : 'Unassigned') === val;
        if (type === 'TEAM') return (r.teamId && r.teamId !== '-' ? r.teamId : 'Unassigned') === val;
        if (type === 'FRA') return (r.franchiseId && r.franchiseId !== '-' ? r.franchiseId : 'Unassigned') === val;
        if (type === 'DISP') return (r.dispatcherId && r.dispatcherId !== '-' ? r.dispatcherId : 'Unassigned') === val;
        return true;
      });
    }
    const recordsByKey = base.reduce((acc: any, r: any) => {
      const key = `${r.payDate || r.week_ending}_${r.contractType}_${r.companyId}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(r);
      return acc;
    }, {});
    return Object.values(recordsByKey).map((group: any) => 
      group.reduce((prev: any, curr: any) => {
        const base = ((curr.grossRevenue || curr.driver_gross || 0) > (prev.grossRevenue || prev.driver_gross || 0)) ? curr : prev;
        return {
          ...base,
          grossRevenue: (prev.grossRevenue || 0) + (curr.grossRevenue || 0),
          driver_gross: (prev.driver_gross || 0) + (curr.driver_gross || 0),
          marginAmount: (prev.marginAmount || 0) + (curr.marginAmount || 0),
          netPay: (prev.netPay || 0) + (curr.netPay || 0),
          milesDriven: (prev.milesDriven || 0) + (curr.milesDriven || 0),
          tolls: (prev.tolls || 0) + (curr.tolls || 0),
          tollCost: (prev.tollCost || 0) + (curr.tollCost || 0),
          originalDbTolls: (prev.originalDbTolls || 0) + (curr.originalDbTolls || 0),
          poCoverage: (prev.poCoverage || 0) + (curr.poCoverage || 0),
          poAmount: (prev.poAmount || 0) + (curr.poAmount || 0),
          pnlTotalPOCov: (prev.pnlTotalPOCov || 0) + (curr.pnlTotalPOCov || 0),
          recruitingCost: (prev.recruitingCost || 0) + (curr.recruitingCost || 0),
          recruiting_cost: (prev.recruiting_cost || 0) + (curr.recruiting_cost || 0),
          fixed_costs: (prev.fixed_costs || 0) + (curr.fixed_costs || 0),
          calculatedFixedCost: (prev.calculatedFixedCost || 0) + (curr.calculatedFixedCost || 0)
        };
      })
    );
  }, [driver.allRecords, driver.records, selectedEntity, selectedPayDate]);

  const driverStats = React.useMemo(() => {
    const histories: Record<string, { val: string, start: string, end: string | null }[]> = {
      Truck: [],
      Contract: [],
      Company: [],
      Team: [],
      Franchise: [],
      Dispatcher: []
    };

    let currentTruck = '-';
    let currentContract = '-';
    let currentCompany = '-';
    let currentTeam = '-';
    let currentFranchise = '-';
    let currentDispatcher = '-';
    
    const absoluteRecords = driver.allRecords || driver.records;
    const allDates = absoluteRecords.map((r: any) => r.payDate).filter(Boolean).sort();
    let firstPayDate = allDates.length > 0 ? allDates[0] : '-';
    let lastPayDate = allDates.length > 0 ? allDates[allDates.length - 1] : '-';

    if (allFilteredRecords.length > 0) {
        const recordsByDate = allFilteredRecords.reduce((acc: any, r: any) => {
        if (!acc[r.payDate]) acc[r.payDate] = [];
        acc[r.payDate].push(r);
        return acc;
      }, {});
      
      const sortedDates = Object.keys(recordsByDate).sort();

      const updateHistory = (field: string, val: string, date: string) => {
        const hist = histories[field];
        if (hist.length === 0 || hist[hist.length - 1].val !== val) {
          if (hist.length > 0) hist[hist.length - 1].end = date;
          hist.push({ val, start: date, end: null });
        }
      };

      sortedDates.forEach((date: string) => {
        const primary = recordsByDate[date].reduce((prev: any, curr: any) => ((curr.grossRevenue || curr.driver_gross || 0) > (prev.grossRevenue || prev.driver_gross || 0)) ? curr : prev);
        
        const trk = primary.truck || '-';
        const cont = primary.contractType || '-';
        const comp = primary.companyId || '-';
        const team = primary.teamId || '-';
        const fran = primary.franchiseId || '-';
        const disp = primary.dispatcherId || '-';

        updateHistory('Truck', trk, date);
        updateHistory('Contract', cont, date);
        updateHistory('Company', comp, date);
        updateHistory('Team', team, date);
        updateHistory('Franchise', fran, date);
        updateHistory('Dispatcher', disp, date);

        currentTruck = trk;
        currentContract = cont;
        currentCompany = comp;
        currentTeam = team;
        currentFranchise = fran;
        currentDispatcher = disp;
      });
    }

    return { 
      current: { Truck: currentTruck, Contract: currentContract, Company: currentCompany, Team: currentTeam, Franchise: currentFranchise, Dispatcher: currentDispatcher },
      histories,
      firstPayDate,
      lastPayDate
    };
  }, [allFilteredRecords]);

  const rowMetrics = React.useMemo(() => {
    
    

    let totalGross = 0, marginAmount = 0, netPay = 0, insuranceExp = 0, totalFuel = 0;
    let wosFuel = 0, fuelRetailPrice = 0, fuelRetailCount = 0, spotterRetailPrice = 0, spotterRetailCount = 0, fuelDiscountPrice = 0, fuelDiscountCount = 0, fuelQuantity = 0;
    let totalMiles = 0, loadedMiles = 0, dh = 0;
    let fcTruck = 0, fcCpm = 0, fcTrailer = 0, fcPlates = 0, fcTelematics = 0, fcPhone = 0, fcOffice = 0, fcRent = 0, fcBackupMc = 0, fcBoReg = 0, fcBoTech = 0, fcFactoring = 0, adjFixed = 0;
    let insLiabAuto = 0, insLiabGen = 0, insCargo = 0, insLeaseGapCoverage = 0, insTrailerInterchange = 0, insLago = 0, insPhdPremium = 0, insPhdTruck = 0, insPhdTrailer = 0;
    let poBreakdown: Record<string, number> = {};
    let dispBreakdown: Record<string, { gross: number, margin: number, fixed: number, shared: number, total: number }> = {};
    let companyPay = 0, fuelRebate = 0, wklyExp = 0, tollCost = 0, poCoverage = 0;
    let dispatcherPay = 0, recruitingCost = 0, totalPnL = 0;
    let revBase = 0, balChange = 0, prorated = 0, zeroMiDrop = 0, escrowAdj = 0, tollsAdj = 0, cashAdv = 0, cpmAdj = 0, fuelAdj = 0, fullSharedLiability = 0;
    let sharedInsBreakdown: Record<string, number> = {};

    const latestDatesByDriver = new Map<string, string>();
    filteredRecords.forEach((r: any) => {
      if ((r.effectiveDrivers || 0) === 0) return;
      const name = r.name || 'Unknown';
      const dDate = r.payDate || r.week_ending || '';
      if (!latestDatesByDriver.has(name) || dDate > (latestDatesByDriver.get(name) || '')) {
        latestDatesByDriver.set(name, dDate);
      }
    });

    filteredRecords.forEach((r: any) => {
      const m = getRawMetrics(r, fixedExpenses, enrichedMap, pnlConfigs, poRules);
      const isLatest = (r.payDate || r.week_ending || '') === latestDatesByDriver.get(r.name || 'Unknown');
      
      let finalBalChange = isLatest ? (m.balChange || 0) : 0;
      let finalEscrowAdj = isLatest ? (m.escrowAdj || 0) : 0;
      let finalRevCol = m.revCol;
      let finalFranchiseRevCol = m.franchiseRevCol;
      let finalPnl = m.pnl;
      let finalFranchisePnlCalculated = m.franchisePnlCalculated;

      

      const tpogCalc = tpogMode === 'CALCULATED' ? 1 : 0;
      totalGross += (r.grossRevenue || r.driver_gross || 0);
      marginAmount += (r.marginAmount || 0);
      totalMiles += (Number(r.milesDriven) || 0);
      loadedMiles += (Number(r.loaded_miles) || 0);
      dh += (Number(r.dh) || 0);
      netPay += (r.netPay || 0);
      insuranceExp += m.insExp;
      totalFuel += m.fuel;
      
      const ct = r.contractType || '';
      const spotter = Number(r.spotter_fuel_saved ?? 0);
      const saved2 = Number(r.fuel_saved_2 ?? 0);
      const diff = spotter !== 0 ? (spotter - saved2) : 0;
      wosFuel += (ct.includes('TPOG') || ct === 'POG' || ct === 'CPM') ? 0 : (diff > 0 ? -diff : diff);
      
      const frp = Number(r.fuel_retail_price || 0);
      if (frp !== 0) { fuelRetailPrice += frp; fuelRetailCount++; }
      const srp = Number(r.spotter_retail_price || 0);
      if (srp !== 0) { spotterRetailPrice += srp; spotterRetailCount++; }
      const fdp = Number(r.fuel_discount_price || 0);
      if (fdp !== 0) { fuelDiscountPrice += fdp; fuelDiscountCount++; }
      fuelQuantity += Number(r.fuel_quantity ?? r.fuelUsed ?? r.fuel_gallons ?? 0);

      companyPay += finalRevCol - (tpogCalc * finalFranchiseRevCol / 2);
      fuelRebate += m.fuelRebate - (tpogCalc * m.franchiseFuelReb / 2);
      wklyExp += m.wklyExp - (tpogCalc * m.franchiseWklyExp / 2);
      tollCost += -m.tolls + (tpogCalc * m.franchiseTolls / 2);
      poCoverage += m.po - (tpogCalc * m.franchisePo / 2);
      dispatcherPay += m.dispPay - (tpogCalc * m.franchiseDispPay / 2);
      recruitingCost += m.recruiting - (tpogCalc * m.franchiseRecruiting / 2);
      
      revBase += m.revBase || 0;
      balChange += finalBalChange;
      prorated += m.prorated || 0;
      zeroMiDrop += m.zeroMiDrop || 0;
      escrowAdj += finalEscrowAdj;
      tollsAdj += m.tollsAdj || 0;
      cashAdv += m.cashAdv || 0;
      cpmAdj += m.cpmAdj || 0;
      fuelAdj += m.fuelAdj || 0;
      fullSharedLiability += m.fullSharedLiability || 0;
      
      const enrichedR = enrichedMap ? enrichedMap.get(`${r.name}_${r.payDate || r.week_ending}_${r.contractType}_${r.companyId}`) : (window as any).__ENRICHED_DRIVERS__?.find((ed: any) => ed.name === r.name && ed.payDate === (r.payDate || r.week_ending) && ed.contractType === r.contractType && ed.companyId === r.companyId);
      if (enrichedR) {
        fcTruck += Number(enrichedR.fcTruck || 0);
        fcCpm += Number(enrichedR.fcCpm || 0) * (Number(r.milesDriven) || 0);
        fcTrailer += Number(enrichedR.fcTrailer || 0);
        fcPlates += Number(enrichedR.fcPlates || 0);
        fcTelematics += Number(enrichedR.fcTelematics || 0);
        fcPhone += Number(enrichedR.fcPhone || 0);
        fcOffice += Number(enrichedR.fcOffice || 0);
        fcRent += Number(enrichedR.fcRent || 0);
        fcBackupMc += Number(enrichedR.fcBackupMc || 0);
        fcBoReg += Number(enrichedR.fcBoReg || 0);
        fcBoTech += Number(enrichedR.fcBoTech || 0);
        fcFactoring += Number(enrichedR.fcFactoring || 0);
        insLiabAuto += Number(enrichedR.insLiabAuto || 0);
        insLiabGen += Number(enrichedR.insLiabGen || 0);
        insCargo += Number(enrichedR.insCargo || 0);
        insLeaseGapCoverage += Number(enrichedR.insLeaseGapCoverage || 0);
        insTrailerInterchange += Number(enrichedR.insTrailerInterchange || 0);
        insLago += Number(enrichedR.insLago || 0);
        insPhdPremium += Number(enrichedR.insPhdPremium || 0);
        insPhdTruck += Number(enrichedR.insPhdTruck || 0);
        insPhdTrailer += Number(enrichedR.insPhdTrailer || 0);

        if (enrichedR.po_breakdown) {
            Object.entries(enrichedR.po_breakdown).forEach(([k, v]: [string, any]) => {
                let isExcluded = false;
                const allRule = poRules.find(ru => ru.contract_type === 'ALL' && ru.category_name === k && ru.status === 'Exclude');
                if (allRule) isExcluded = true;
                const cType = r.contractType || 'Unknown';
                const relevantRule = poRules.find(ru => ru.contract_type === cType && ru.category_name === k && ru.status === 'Exclude');
                if (relevantRule) {
                    if (cType === 'TPOG') {
                        const tpogScope = relevantRule.tpog || 'Only TPOG with franchises';
                        if (tpogScope === 'ALL TPOG') isExcluded = true;
                        else if (tpogScope === 'Only TPOG with franchises' && !!r.franchiseId) isExcluded = true;
                        else if (tpogScope === 'Only TPOG without franchises' && !r.franchiseId) isExcluded = true;
                    } else {
                        isExcluded = true;
                    }
                }
                const adjVal = isExcluded ? 0 : Number(v);
                if (!poBreakdown[k]) poBreakdown[k] = 0;
                poBreakdown[k] += adjVal;
            });
        }
      }

      if (m.sharedInsBreakdown) {
          Object.entries(m.sharedInsBreakdown).forEach(([k, v]) => {
              if (!sharedInsBreakdown[k]) sharedInsBreakdown[k] = 0;
              sharedInsBreakdown[k] += Number(v);
          });
      }

      const dLabel = m.appliedDispRuleLabel || 'Company Default';
      if (!dispBreakdown[dLabel]) dispBreakdown[dLabel] = { gross: 0, margin: 0, fixed: 0, shared: 0, total: 0 };
      dispBreakdown[dLabel].gross += m.dispGrossAmt || 0;
      dispBreakdown[dLabel].margin += m.dispMarginAmt || 0;
      dispBreakdown[dLabel].fixed += m.dispFixedAmt || 0;
      dispBreakdown[dLabel].shared += m.dispSharedAmt || 0;
      dispBreakdown[dLabel].total += m.dispPay || 0;

      let pnlToAdd = finalPnl;
      if (finalFranchisePnlCalculated) {
          pnlToAdd = pnlToAdd - finalFranchisePnlCalculated;
      }
      totalPnL += pnlToAdd;
    });

    const count = Math.max(1, new Set(filteredRecords.map((r: any) => r.payDate || r.week_ending)).size);
    const div = isAvgPerWeek ? count : 1;

    return {
      totalGross: totalGross / div, marginAmount: marginAmount / div, 
      totalMiles: totalMiles / div, loadedMiles: loadedMiles / div, dh: dh / div,
      netPay: netPay / div,
      insuranceExp: insuranceExp / div, totalFuel: totalFuel / div,
      wosFuel: wosFuel / div, fuelRetailPrice: fuelRetailCount > 0 ? fuelRetailPrice / fuelRetailCount : 0, spotterRetailPrice: spotterRetailCount > 0 ? spotterRetailPrice / spotterRetailCount : 0, fuelDiscountPrice: fuelDiscountCount > 0 ? fuelDiscountPrice / fuelDiscountCount : 0, fuelQuantity: fuelQuantity / div,
      companyPay: companyPay / div,
      fuelRebate: fuelRebate / div, wklyExp: wklyExp / div, tollCost: tollCost / div,
      poCoverage: poCoverage / div, dispatcherPay: dispatcherPay / div,
      recruitingCost: recruitingCost / div, totalPnL: totalPnL / div,
      revBase: revBase / div, balChange: balChange / div, prorated: prorated / div,
      zeroMiDrop: zeroMiDrop / div, escrowAdj: escrowAdj / div, tollsAdj: tollsAdj / div,
      cashAdv: cashAdv / div, cpmAdj: cpmAdj / div, fuelAdj: fuelAdj / div, fullSharedLiability: fullSharedLiability / div,
      sharedInsBreakdown: Object.fromEntries(Object.entries(sharedInsBreakdown).map(([k, v]) => [k, Number(v) / div])),
      poBreakdown: Object.fromEntries(Object.entries(poBreakdown).map(([k, v]) => [k, Number(v) / div])),
      dispBreakdown: Object.fromEntries(Object.entries(dispBreakdown).map(([k, v]) => [k, { gross: v.gross / div, margin: v.margin / div, fixed: v.fixed / div, shared: v.shared / div, total: v.total / div }])),
      fcTruck: fcTruck / div, fcCpm: fcCpm / div, fcTrailer: fcTrailer / div, fcPlates: fcPlates / div, fcTelematics: fcTelematics / div, fcPhone: fcPhone / div, fcOffice: fcOffice / div, fcRent: fcRent / div, fcBackupMc: fcBackupMc / div, fcBoReg: fcBoReg / div, fcBoTech: fcBoTech / div, fcFactoring: fcFactoring / div, adjFixed: adjFixed / div,
      insLiabAuto: insLiabAuto / div, insLiabGen: insLiabGen / div, insCargo: insCargo / div, insLeaseGapCoverage: insLeaseGapCoverage / div, insTrailerInterchange: insTrailerInterchange / div, insLago: insLago / div, insPhdPremium: insPhdPremium / div, insPhdTruck: insPhdTruck / div, insPhdTrailer: insPhdTrailer / div
    };
  }, [filteredRecords, driver, fixedExpenses, enrichedMap, pnlConfigs, selectedEntity, isAvgPerWeek, tpogMode, poRules]);

  const franchiseRowMetrics = React.useMemo(() => {
    let companyPay = 0, fuelRebate = 0, wklyExp = 0, tollCost = 0, poCoverage = 0, dispatcherPay = 0, recruitingCost = 0, totalPnL = 0;
    let revBase = 0, balChange = 0, prorated = 0, zeroMiDrop = 0, escrowAdj = 0, tollsAdj = 0, cashAdv = 0, cpmAdj = 0, fuelAdj = 0, fullSharedLiability = 0;
    let fcTruck = 0, fcCpm = 0, fcTrailer = 0, fcPlates = 0, fcTelematics = 0, fcPhone = 0, fcOffice = 0, fcRent = 0, fcBackupMc = 0, fcBoReg = 0, fcBoTech = 0, fcFactoring = 0;
    let insLiabAuto = 0, insLiabGen = 0, insCargo = 0, insLeaseGapCoverage = 0, insTrailerInterchange = 0, insLago = 0, insPhdPremium = 0, insPhdTruck = 0, insPhdTrailer = 0;
    let totalGross = 0, marginAmount = 0, totalMiles = 0, loadedMiles = 0, dh = 0, netPay = 0, insuranceExp = 0, totalFuel = 0;
    let wosFuel = 0, fuelRetailPrice = 0, fuelRetailCount = 0, spotterRetailPrice = 0, spotterRetailCount = 0, fuelDiscountPrice = 0, fuelDiscountCount = 0, fuelQuantity = 0;
    let poBreakdown: Record<string, number> = {};
    let dispBreakdown: Record<string, { gross: number, margin: number, fixed: number, shared: number, total: number }> = {};
    let hasFranchise = false;

    const latestDatesByDriver = new Map<string, string>();
    filteredRecords.forEach((r: any) => {
      if ((r.effectiveDrivers || 0) === 0) return;
      const name = r.name || 'Unknown';
      const dDate = r.payDate || r.week_ending || '';
      if (!latestDatesByDriver.has(name) || dDate > (latestDatesByDriver.get(name) || '')) {
        latestDatesByDriver.set(name, dDate);
      }
    });

    filteredRecords.forEach((r: any) => {
      const ct = r.contractType || '';
      if (ct === 'TPOG' && r.franchiseId) {
        hasFranchise = true;
        const m = getRawMetrics(r, fixedExpenses, enrichedMap, pnlConfigs, poRules);
        const isLatest = (r.payDate || r.week_ending || '') === latestDatesByDriver.get(r.name || 'Unknown');
        
        let finalBalChange = isLatest ? (m.balChange || 0) : 0;
        let finalEscrowAdj = isLatest ? (m.escrowAdj || 0) : 0;
        let finalFranchiseRevCol = m.franchiseRevCol;
        let finalFranchisePnlCalculated = m.franchisePnlCalculated;

        
        
        totalGross += (r.grossRevenue || r.driver_gross || 0);
        marginAmount += (r.marginAmount || 0);
        totalMiles += (Number(r.milesDriven) || 0);
        loadedMiles += (Number(r.loaded_miles) || 0);
        dh += (Number(r.dh) || 0);
        netPay += (r.netPay || 0);
        insuranceExp += m.insExp;
        totalFuel += m.fuel;
        
        const spotter = Number(r.spotter_fuel_saved ?? 0);
        const saved2 = Number(r.fuel_saved_2 ?? 0);
        const diff = spotter !== 0 ? (spotter - saved2) : 0;
        wosFuel += (ct.includes('TPOG') || ct === 'POG' || ct === 'CPM') ? 0 : (diff > 0 ? -diff : diff);
        
        const frp = Number(r.fuel_retail_price || 0);
        if (frp !== 0) { fuelRetailPrice += frp; fuelRetailCount++; }
        const srp = Number(r.spotter_retail_price || 0);
        if (srp !== 0) { spotterRetailPrice += srp; spotterRetailCount++; }
        const fdp = Number(r.fuel_discount_price || 0);
        if (fdp !== 0) { fuelDiscountPrice += fdp; fuelDiscountCount++; }
        fuelQuantity += Number(r.fuel_quantity ?? r.fuelUsed ?? r.fuel_gallons ?? 0);

        companyPay += finalFranchiseRevCol;
        fuelRebate += m.franchiseFuelReb;
        wklyExp += m.franchiseWklyExp;
        tollCost += -m.franchiseTolls;
        poCoverage += m.franchisePo;
        dispatcherPay += m.franchiseDispPay;
        recruitingCost += m.franchiseRecruiting;
        totalPnL += finalFranchisePnlCalculated;

        revBase += m.revBase || 0;
        balChange += finalBalChange;
        prorated += m.prorated || 0;
        zeroMiDrop += m.zeroMiDrop || 0;
        escrowAdj += finalEscrowAdj;
        tollsAdj += m.tollsAdj || 0;
        cashAdv += m.cashAdv || 0;
        cpmAdj += m.cpmAdj || 0;
        fuelAdj += m.fuelAdj || 0;
        fullSharedLiability += m.fullSharedLiability || 0;

        const dLabel = m.appliedDispRuleLabel || 'Company Default';
        if (!dispBreakdown[dLabel]) dispBreakdown[dLabel] = { gross: 0, margin: 0, fixed: 0, shared: 0, total: 0 };
        dispBreakdown[dLabel].gross += m.dispGrossAmt || 0;
        dispBreakdown[dLabel].margin += m.dispMarginAmt || 0;
        dispBreakdown[dLabel].fixed += m.dispFixedAmt || 0;
        dispBreakdown[dLabel].shared += m.dispSharedAmt || 0;
        dispBreakdown[dLabel].total += m.franchiseDispPay || 0;

        const enrichedR = enrichedMap ? enrichedMap.get(`${r.name}_${r.payDate || r.week_ending}_${r.contractType}_${r.companyId}`) : (window as any).__ENRICHED_DRIVERS__?.find((ed: any) => ed.name === r.name && ed.payDate === (r.payDate || r.week_ending) && ed.contractType === r.contractType && ed.companyId === r.companyId);
        if (enrichedR) {
          fcTruck += Number(enrichedR.franchise_fcTruck !== undefined ? enrichedR.franchise_fcTruck : (enrichedR.fcTruck || 0));
          fcCpm += Number(enrichedR.franchise_fcCpm !== undefined ? enrichedR.franchise_fcCpm : (enrichedR.franchise_fixed_breakdown?.fcCpm !== undefined ? enrichedR.franchise_fixed_breakdown.fcCpm : (enrichedR.fcCpm || 0) * (Number(r.milesDriven) || 0)));
          fcTrailer += Number(enrichedR.franchise_fcTrailer !== undefined ? enrichedR.franchise_fcTrailer : (enrichedR.fcTrailer || 0));
          fcPlates += Number(enrichedR.franchise_fcPlates !== undefined ? enrichedR.franchise_fcPlates : (enrichedR.fcPlates || 0));
          fcTelematics += Number(enrichedR.franchise_fcTelematics !== undefined ? enrichedR.franchise_fcTelematics : (enrichedR.fcTelematics || 0));
          fcPhone += Number(enrichedR.franchise_fcPhone !== undefined ? enrichedR.franchise_fcPhone : (enrichedR.fcPhone || 0));
          fcOffice += Number(enrichedR.franchise_fcOffice !== undefined ? enrichedR.franchise_fcOffice : (enrichedR.fcOffice || 0));
          fcRent += Number(enrichedR.franchise_fcRent !== undefined ? enrichedR.franchise_fcRent : (enrichedR.fcRent || 0));
          fcBackupMc += Number(enrichedR.franchise_fcBackupMc !== undefined ? enrichedR.franchise_fcBackupMc : (enrichedR.fcBackupMc || 0));
          fcBoReg += Number(enrichedR.franchise_fcBoReg !== undefined ? enrichedR.franchise_fcBoReg : (enrichedR.fcBoReg || 0));
          fcBoTech += Number(enrichedR.franchise_fcBoTech !== undefined ? enrichedR.franchise_fcBoTech : (enrichedR.fcBoTech || 0));
          fcFactoring += Number(enrichedR.franchise_fcFactoring !== undefined ? enrichedR.franchise_fcFactoring : (enrichedR.fcFactoring || 0));
          insLiabAuto += Number(enrichedR.franchise_insLiabAuto !== undefined ? enrichedR.franchise_insLiabAuto : (enrichedR.insLiabAuto || 0));
          insLiabGen += Number(enrichedR.franchise_insLiabGen !== undefined ? enrichedR.franchise_insLiabGen : (enrichedR.insLiabGen || 0));
          insCargo += Number(enrichedR.franchise_insCargo !== undefined ? enrichedR.franchise_insCargo : (enrichedR.insCargo || 0));
          insLeaseGapCoverage += Number(enrichedR.franchise_insLeaseGapCoverage !== undefined ? enrichedR.franchise_insLeaseGapCoverage : (enrichedR.insLeaseGapCoverage || 0));
          insTrailerInterchange += Number(enrichedR.franchise_insTrailerInterchange !== undefined ? enrichedR.franchise_insTrailerInterchange : (enrichedR.insTrailerInterchange || 0));
          insLago += Number(enrichedR.franchise_insLago !== undefined ? enrichedR.franchise_insLago : (enrichedR.insLago || 0));
          insPhdPremium += Number(enrichedR.franchise_insPhdPremium !== undefined ? enrichedR.franchise_insPhdPremium : (enrichedR.insPhdPremium || 0));
          insPhdTruck += Number(enrichedR.franchise_insPhdTruck !== undefined ? enrichedR.franchise_insPhdTruck : (enrichedR.insPhdTruck || 0));
          insPhdTrailer += Number(enrichedR.franchise_insPhdTrailer !== undefined ? enrichedR.franchise_insPhdTrailer : (enrichedR.insPhdTrailer || 0));

          if (enrichedR.po_breakdown) {
            Object.entries(enrichedR.po_breakdown).forEach(([k, v]: [string, any]) => {
              let isExcluded = false;
              const allRule = poRules.find(ru => ru.contract_type === 'ALL' && ru.category_name === k && ru.status === 'Exclude');
              if (allRule) isExcluded = true;
              const stubRule = poRules.find(ru => (ru.contract_type === 'TPOG Franchise PnL' || ru.contract_type === 'TPOG (Franchise PnL)') && ru.category_name === k && ru.status === 'Exclude');
              if (stubRule) {
                  isExcluded = true;
              }
              if (!poBreakdown[k]) poBreakdown[k] = 0;
              poBreakdown[k] += isExcluded ? 0 : Number(v);
            });
          }
        }
      }
    });

    const tpogRecords = filteredRecords.filter((r: any) => r.contractType === 'TPOG' && r.franchiseId);
    const count = Math.max(1, new Set(tpogRecords.map((r: any) => r.payDate || r.week_ending)).size);
    const div = isAvgPerWeek ? count : 1;

    return {
      hasFranchise,
      totalGross: totalGross / div, marginAmount: marginAmount / div,
      totalMiles: totalMiles / div, loadedMiles: loadedMiles / div, dh: dh / div,
      netPay: netPay / div, insuranceExp: insuranceExp / div, totalFuel: totalFuel / div,
      wosFuel: wosFuel / div, fuelRetailPrice: fuelRetailCount > 0 ? fuelRetailPrice / fuelRetailCount : 0, spotterRetailPrice: spotterRetailCount > 0 ? spotterRetailPrice / spotterRetailCount : 0, fuelDiscountPrice: fuelDiscountCount > 0 ? fuelDiscountPrice / fuelDiscountCount : 0, fuelQuantity: fuelQuantity / div,
      companyPay: companyPay / div, fuelRebate: fuelRebate / div, wklyExp: wklyExp / div,
      tollCost: tollCost / div, poCoverage: poCoverage / div, dispatcherPay: dispatcherPay / div,
      recruitingCost: recruitingCost / div, totalPnL: totalPnL / div,
      revBase: revBase / div, balChange: balChange / div, prorated: prorated / div,
      zeroMiDrop: zeroMiDrop / div, escrowAdj: escrowAdj / div, tollsAdj: tollsAdj / div,
      cashAdv: cashAdv / div, cpmAdj: cpmAdj / div, fuelAdj: fuelAdj / div, fullSharedLiability: fullSharedLiability / div,
      poBreakdown: Object.fromEntries(Object.entries(poBreakdown).map(([k, v]) => [k, v / div])),
      dispBreakdown: Object.fromEntries(Object.entries(dispBreakdown).map(([k, v]) => [k, { gross: v.gross / div, margin: v.margin / div, fixed: v.fixed / div, shared: v.shared / div, total: v.total / div }])),
      fcTruck: fcTruck / div, fcCpm: fcCpm / div, fcTrailer: fcTrailer / div, fcPlates: fcPlates / div, fcTelematics: fcTelematics / div, fcPhone: fcPhone / div, fcOffice: fcOffice / div, fcRent: fcRent / div, fcBackupMc: fcBackupMc / div, fcBoReg: fcBoReg / div, fcBoTech: fcBoTech / div, fcFactoring: fcFactoring / div,
      insLiabAuto: insLiabAuto / div, insLiabGen: insLiabGen / div, insCargo: insCargo / div, insLeaseGapCoverage: insLeaseGapCoverage / div, insTrailerInterchange: insTrailerInterchange / div, insLago: insLago / div, insPhdPremium: insPhdPremium / div, insPhdTruck: insPhdTruck / div, insPhdTrailer: insPhdTrailer / div
    };
  }, [filteredRecords, fixedExpenses, enrichedMap, pnlConfigs, isAvgPerWeek, poRules]);

  const calcGross = filteredRecords.reduce((s: number, r: any) => s + (r.grossRevenue || r.driver_gross || 0), 0);
  const expFuel = filteredRecords.reduce((s: number, r: any) => s + (r.fuelCost || 0), 0);
  const expMaint = filteredRecords.reduce((s: number, r: any) => s + (r.maintenanceCost || 0), 0);
  const expFaults = filteredRecords.reduce((s: number, r: any) => s + (r.driverFaultExpenses || 0), 0);

  const { issues, perfStats, mainDiagnosis, avgPnL, activeConf } = React.useMemo(() => {
    const iss: any[] = [];
      const count = Math.max(1, new Set(allFilteredRecords.map((r: any) => r.payDate || r.week_ending)).size);
    let targetAvg = fleetAverages['ALL'] || { gross: 0, rev: 0, poCov: 0, pnl: 500 };
    let primaryContract = 'Unassigned';

    if (selectedEntity.startsWith('CTR:')) {
      primaryContract = selectedEntity.split(':')[1];
      if (fleetAverages[primaryContract]) targetAvg = fleetAverages[primaryContract];
    } else if (allFilteredRecords.length > 0) {
      const cCounts: any = {};
      let maxCount = 0;
      allFilteredRecords.forEach((r: any) => {
        const c = r.contractType || 'Unassigned';
        cCounts[c] = (cCounts[c] || 0) + 1;
        if (cCounts[c] > maxCount) {
          maxCount = cCounts[c];
          primaryContract = c;
        }
      });
      if (fleetAverages[primaryContract]) targetAvg = fleetAverages[primaryContract];
    }

    const activeConf = settings?.[selectedEntity] || settings?.[`CTR:${primaryContract}`] || settings?.[`CMP:${driverStats.currentCompany}`] || settings?.['GLOBAL'] || {};

    const latestDatesByDriver = new Map<string, string>();
    allFilteredRecords.forEach((r: any) => {
      if ((r.effectiveDrivers || 0) === 0) return;
      const name = r.name || 'Unknown';
      const dDate = r.payDate || r.week_ending || '';
      if (!latestDatesByDriver.has(name) || dDate > (latestDatesByDriver.get(name) || '')) {
        latestDatesByDriver.set(name, dDate);
      }
    });
    allFilteredRecords.forEach((r: any) => {
      const name = r.name || 'Unknown';
      if (!latestDatesByDriver.has(name)) {
        latestDatesByDriver.set(name, r.payDate || r.week_ending || '');
      }
    });

    const { sGross, sMargin, sNetPay, sDispPay, sInsExp, sMiles, sFuel, sRevCol, sFuelReb, sWklyExp, sTolls, sPO, sRecruiting, sPnL, sBalChange, sEscrowAdj } = allFilteredRecords.reduce((sums: any, r: any) => {
        const rm = getRawMetrics(r, fixedExpenses, enrichedMap, pnlConfigs, poRules);
        const isLatest = (r.payDate || r.week_ending || '') === latestDatesByDriver.get(r.name || 'Unknown');
        let finalRevCol = rm.revCol;
        let finalPnl = rm.pnl;
        let finalFranchisePnlCalculated = rm.franchisePnlCalculated;
        let finalBalChange = isLatest ? (rm.balChange || 0) : 0;
        let finalEscrowAdj = isLatest ? (rm.escrowAdj || 0) : 0;

        

        const tpogCalc = tpogMode === 'CALCULATED' ? 1 : 0;
        sums.sGross += (r.grossRevenue || r.driver_gross || 0);
        sums.sMargin += (r.marginAmount || 0);
        sums.sNetPay += (r.netPay || 0);
        sums.sDispPay += rm.dispPay - (tpogCalc * rm.franchiseDispPay / 2);
        sums.sInsExp += rm.insExp;
        sums.sMiles += (r.milesDriven || 0);
        sums.sFuel += rm.fuel;
        sums.sRevCol += finalRevCol - (tpogCalc * rm.franchiseRevCol / 2);
        sums.sFuelReb += rm.fuelRebate - (tpogCalc * rm.franchiseFuelReb / 2);
        sums.sWklyExp += rm.wklyExp - (tpogCalc * rm.franchiseWklyExp / 2);
        sums.sTolls += rm.tolls - (tpogCalc * rm.franchiseTolls / 2);
        sums.sPO += rm.po - (tpogCalc * rm.franchisePo / 2);
        sums.sRecruiting += rm.recruiting - (tpogCalc * rm.franchiseRecruiting / 2);
        sums.sBalChange += finalBalChange;
        sums.sEscrowAdj += finalEscrowAdj;
        let pnlToAdd = finalPnl;
        if (finalFranchisePnlCalculated) {
            pnlToAdd = pnlToAdd - finalFranchisePnlCalculated;
        }
        sums.sPnL += pnlToAdd;
        return sums;
    }, { sGross: 0, sMargin: 0, sNetPay: 0, sDispPay: 0, sInsExp: 0, sMiles: 0, sFuel: 0, sRevCol: 0, sFuelReb: 0, sWklyExp: 0, sTolls: 0, sPO: 0, sRecruiting: 0, sPnL: 0, sBalChange: 0, sEscrowAdj: 0 });

    if (filteredRecords.length === 0) {
      iss.push({ label: "No records available for calculation", diff: 0, severity: "neutral" });
      const emptyStats = [
        { id: 'gross', name: 'Gross', val: null, total: null, fleet: targetAvg.gross || 0, diff: 0, severity: 'neutral' },
        { id: 'margin', name: 'Margin', val: null, total: null, fleet: targetAvg.margin || 0, diff: 0, severity: 'neutral' },
        { id: 'netPay', name: 'Net Pay', val: null, total: null, fleet: targetAvg.netPay || 0, diff: 0, severity: 'neutral' },
        { id: 'dispPay', name: 'Disp. Pay', val: null, total: null, fleet: targetAvg.dispPay || 0, diff: 0, severity: 'neutral' },
        { id: 'fuel', name: 'Fuel', val: null, total: null, fleet: targetAvg.fuel || 0, diff: 0, severity: 'neutral' },
        { id: 'revCol', name: 'Rev. Col.', val: null, total: null, fleet: targetAvg.rev || 0, diff: 0, severity: 'neutral' },
        { id: 'fuelReb', name: 'Fuel Reb.', val: null, total: null, fleet: targetAvg.fuelRebate || 0, diff: 0, severity: 'neutral' },
        { id: 'wklyExp', name: 'Wkly Exp.', val: null, total: null, fleet: targetAvg.wklyExp || 0, diff: 0, severity: 'neutral' },
        { id: 'tolls', name: 'Tolls', val: null, total: null, fleet: targetAvg.tolls || 0, diff: 0, severity: 'neutral' },
        { id: 'po', name: 'PO', val: null, total: null, fleet: targetAvg.poCov || 0, diff: 0, severity: 'neutral' },
        { id: 'recruiting', name: 'Recruiting', val: null, total: null, fleet: targetAvg.recruiting || 0, diff: 0, severity: 'neutral' },
        { id: 'pnl', name: 'PnL', val: null, total: null, fleet: targetAvg.pnl || 100, diff: 0, severity: 'neutral' }
      ].filter(m => {
         const rules = activeConf[m.id] || settings?.['GLOBAL']?.[m.id];
         const isActive = rules && !(Number(rules.redMax) === 0 && Number(rules.greenMin) === 0 && Number(rules.orangeMax) === 0);
         return isActive || m.id === 'pnl';
      });
      return { issues: iss, perfStats: emptyStats, mainDiagnosis: 'neutral', avgPnL: 0, activeConf };
    }

    if (sMiles === 0) {
      iss.push({ label: "0 miles driven", diff: 0, severity: "neutral" });
    }

    const calcVal = (val: number) => val / count;

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

    const getSeverity = (metricId: string, val: number) => {
        if (sMiles === 0) return 'N/A';
        const rules = activeConf[metricId] || settings?.['GLOBAL']?.[metricId];
        if (!rules || (Number(rules.redMax) === 0 && Number(rules.greenMin) === 0 && Number(rules.orangeMax) === 0)) return 'neutral';
        
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
      { id: 'gross', name: 'Gross', val: avgGross, total: sGross },
      { id: 'margin', name: 'Margin', val: avgMargin, total: sMargin },
      { id: 'netPay', name: 'Net Pay', val: avgNetPay, total: sNetPay },
      { id: 'dispPay', name: 'Disp. Pay', val: avgDispPay, total: sDispPay },
      { id: 'fuel', name: 'Fuel', val: avgFuel, total: sFuel },
      { id: 'revCol', name: 'Rev. Col.', val: avgRev, total: sRevCol },
      { id: 'fuelReb', name: 'Fuel Reb.', val: avgFuelReb, total: sFuelReb },
      { id: 'wklyExp', name: 'Wkly Exp.', val: -avgWklyExp, total: -sWklyExp },
      { id: 'tolls', name: 'Tolls', val: -avgTolls, total: -sTolls },
      { id: 'po', name: 'PO', val: avgPO, total: sPO },
      { id: 'recruiting', name: 'Recruiting', val: avgRecruiting, total: sRecruiting },
      { id: 'pnl', name: 'PnL', val: avgPnL, total: sPnL }
    ];

    const perfStats = metrics.map(m => {
        const rules = activeConf[m.id] || settings?.['GLOBAL']?.[m.id];
        const isActive = rules && !(Number(rules.redMax) === 0 && Number(rules.greenMin) === 0 && Number(rules.orangeMax) === 0);
        
        if (!isActive && m.id !== 'pnl') return null;

        const severity = getSeverity(m.id, m.val);
        if (severity === 'critical') iss.push({ label: `Critical ${m.name} Level`, diff: 0, severity });
        else if (severity === 'warning') iss.push({ label: `Warning ${m.name} Level`, diff: 0, severity });
        return { id: m.id, name: m.name, val: m.val, total: m.total, severity };
    }).filter((x: any) => x !== null);
    
    let mainDiagnosis = getSeverity('pnl', avgPnL);
    if (mainDiagnosis === 'ignored') mainDiagnosis = 'neutral';

    return { issues: iss, perfStats, mainDiagnosis, avgPnL, activeConf };
  }, [allFilteredRecords, fleetAverages, selectedEntity, settings, tpogMode, driverStats.currentCompany]);
  const historyChartData = React.useMemo(() => {
    const baseRecords = driver.allRecords || driver.records;
    const timeFilteredAll = selectedPayDate === 'ALL' ? baseRecords : baseRecords.filter((r: any) => (r.payDate || r.week_ending) <= selectedPayDate);
    const sortedAllRecords = [...timeFilteredAll].sort((a: any, b: any) => new Date(a.payDate).getTime() - new Date(b.payDate).getTime());
    
    const precalculatedData = new Map();
    let runningSums = { pnl: 0, gross: 0, margin: 0, netPay: 0, insExp: 0, fuel: 0, revCol: 0, fuelRebate: 0, wklyExp: 0, tolls: 0, po: 0, dispPay: 0, recruiting: 0 };
    let runningMiles = 0;
    let runningCount = 0;

    const groupedAllRecords = new Map<string, any[]>();
    sortedAllRecords.forEach((r: any) => {
      const d = r.payDate ? r.payDate.split('T')[0] : 'Unknown';
      if (!groupedAllRecords.has(d)) groupedAllRecords.set(d, []);
      groupedAllRecords.get(d)!.push(r);
    });

    Array.from(groupedAllRecords.entries()).forEach(([date, records]) => {
      const tpogCalc = tpogMode === 'CALCULATED' ? 1 : 0;
      records.forEach((r: any) => {
        const rm = getRawMetrics(r, fixedExpenses, enrichedMap, pnlConfigs, poRules);
        let finalPnl = rm.pnl;
        if (rm.franchisePnlCalculated) {
            finalPnl -= rm.franchisePnlCalculated;
        }
        runningSums.pnl += finalPnl;
        runningSums.gross += (r.grossRevenue || r.driver_gross || 0);
        runningSums.margin += (r.marginAmount || 0);
        runningSums.netPay += (r.netPay || 0);
        runningSums.insExp += rm.insExp;
        runningSums.fuel += rm.fuel;
        runningSums.revCol += rm.revCol - (tpogCalc * rm.franchiseRevCol / 2);
        runningSums.fuelRebate += rm.fuelRebate - (tpogCalc * rm.franchiseFuelReb / 2);
        runningSums.wklyExp += rm.wklyExp - (tpogCalc * rm.franchiseWklyExp / 2);
        runningSums.tolls += rm.tolls - (tpogCalc * rm.franchiseTolls / 2);
        runningSums.po += rm.po - (tpogCalc * rm.franchisePo / 2);
        runningSums.dispPay += rm.dispPay - (tpogCalc * rm.franchiseDispPay / 2);
        runningSums.recruiting += rm.recruiting - (tpogCalc * rm.franchiseRecruiting / 2);
        runningMiles += (r.milesDriven || 0);
      });
      runningCount += 1;

      precalculatedData.set(date, {
        count: runningCount || 1,
        runningSums: { ...runningSums },
        runningMiles
      });
    });

    const groupedFilteredRecords = new Map<string, any[]>();
    allFilteredRecords.forEach((r: any) => {
      const d = r.payDate ? r.payDate.split('T')[0] : 'Unknown';
      if (!groupedFilteredRecords.has(d)) groupedFilteredRecords.set(d, []);
      groupedFilteredRecords.get(d)!.push(r);
    });

    return Array.from(groupedFilteredRecords.keys()).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()).map(date => {
      const records = groupedFilteredRecords.get(date)!;
      const data = precalculatedData.get(date);
      if (!data) return { name: date };

      let fPnl = 0, fGross = 0, fMargin = 0, fNetPay = 0, fInsExp = 0, fFuel = 0, fRevCol = 0, fFuelReb = 0, fWklyExp = 0, fTolls = 0, fPo = 0, fDispPay = 0, fRecruiting = 0, fMiles = 0;

      const tpogCalc = tpogMode === 'CALCULATED' ? 1 : 0;
      records.forEach((r: any) => {
        const rm = getRawMetrics(r, fixedExpenses, enrichedMap, pnlConfigs, poRules);
        let finalPnl = rm.pnl;
        if (rm.franchisePnlCalculated) {
            finalPnl = finalPnl - rm.franchisePnlCalculated;
        }
        fPnl += finalPnl;
        fGross += (r.grossRevenue || r.driver_gross || 0);
        fMargin += (r.marginAmount || 0);
        fNetPay += (r.netPay || 0);
        fInsExp += rm.insExp;
        fFuel += rm.fuel;
        fRevCol += rm.revCol - (tpogCalc * rm.franchiseRevCol / 2);
        fFuelReb += rm.fuelRebate - (tpogCalc * rm.franchiseFuelReb / 2);
        fWklyExp += rm.wklyExp - (tpogCalc * rm.franchiseWklyExp / 2);
        fTolls += rm.tolls - (tpogCalc * rm.franchiseTolls / 2);
        fPo += rm.po - (tpogCalc * rm.franchisePo / 2);
        fDispPay += rm.dispPay - (tpogCalc * rm.franchiseDispPay / 2);
        fRecruiting += rm.recruiting - (tpogCalc * rm.franchiseRecruiting / 2);
        fMiles += (r.milesDriven || 0);
      });

      const { count, runningSums: sums, runningMiles: miles } = data;

      const metrics: any = {
        'pnl': fPnl,
        'pnl avg/w': sums.pnl / count,
        'gross': fGross,
        'gross avg/w': sums.gross / count,
        'margin': fMargin,
        'margin avg/w': sums.margin / count,
        'net pay': fNetPay,
        'net pay avg/w': sums.netPay / count,
        'ins. exp.': fInsExp,
        'ins. exp. avg/w': sums.insExp / count,
        'fuel': fFuel,
        'fuel avg/mi': miles > 0 ? sums.fuel / miles : 0,
        'revenue collected': fRevCol,
        'revenue collected avg/w': sums.revCol / count,
        'fuel rebate': fFuelReb,
        'fuel rebate avg/w': sums.fuelRebate / count,
        'wkly exp': fWklyExp,
        'wkly exp avg/w': sums.wklyExp / count,
        'tolls': fTolls,
        'tolls avg/w': sums.tolls / count,
        'po': fPo,
        'po avg/w': sums.po / count,
        'disp. pay': fDispPay,
        'disp. pay avg/w': sums.dispPay / count,
        'recruiting': fRecruiting,
        'recruiting avg/w': sums.recruiting / count
      };

      const point: any = { name: date };
      selectedMetrics.forEach((m: string) => { point[m] = metrics[m]; });
      return point;
    });
  }, [allFilteredRecords, driver.allRecords, driver.records, selectedMetrics, fixedExpenses, enrichedMap, pnlConfigs, tpogMode, selectedPayDate]);

  const activeSeries = React.useMemo(() => {
    const palette = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#f43f5e', '#06b6d4', '#fb923c', '#d946ef', '#a1a1aa'];
    return selectedMetrics.map((m, i) => ({ dataKey: m, name: m.toUpperCase(), color: palette[i % palette.length] }));
  }, [selectedMetrics]);

  return (
    <React.Fragment>
     <tr onClick={() => onToggle(driver.id)} className={`group cursor-pointer transition-colors hover:relative hover:z-[9999999] ${isExpanded ? 'bg-zinc-800 z-[999999] relative [&>td]:border-t-2 [&>td]:border-emerald-500/50' : 'hover:bg-zinc-800/30'}`}>
        <td className={`px-2 py-1 text-zinc-500 sticky left-0 z-10 transition-colors ${isExpanded ? 'bg-zinc-800' : 'bg-zinc-900 group-hover:bg-zinc-800'}`}>{isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</td>
        <td className={`px-2 py-1 font-sans sticky left-[32px] z-10 transition-colors ${isExpanded ? 'bg-zinc-800' : 'bg-zinc-900 group-hover:bg-zinc-800'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${driver.status === DriverStatus.ACTIVE ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="font-semibold text-zinc-200">{driver.name}</span>
            {mainDiagnosis === 'critical' && <AlertTriangle size={10} className="text-rose-500 ml-1" />}
            {mainDiagnosis === 'warning' && <AlertTriangle size={10} className="text-amber-500 ml-1" />}
          </div>
        </td>
        <td className="px-2 py-1 text-zinc-400 truncate max-w-[100px]">{driver.truck || '-'}</td>
        <td className="px-2 py-1 text-zinc-400 truncate max-w-[100px]">{driver.companyId || '-'}</td>
        <td className="px-2 py-1 text-zinc-400 truncate max-w-[80px]">{driver.teamId || '-'}</td>
        <td className="px-2 py-1 text-zinc-400 truncate max-w-[80px]">{driver.franchiseId || '-'}</td>
        <td className="px-2 py-1 text-zinc-400 truncate max-w-[120px]">{driver.dispatcherId || '-'}</td>
        <td className="px-2 py-1 text-zinc-400 truncate max-w-[80px]">{driver.contractType || '-'}</td>
        <td className="px-2 py-1 text-right text-emerald-400">{Number((driver.effectiveDrivers || 0).toFixed(2))}</td>
        <td className="px-2 py-1 text-right text-emerald-400">{Number((driver.effectiveNonTeams || 0).toFixed(2))}</td>
        <td className="px-2 py-1 text-right text-emerald-400">{Number((driver.effectiveTrailers || 0).toFixed(2))}</td>
        <td className="px-2 py-1 text-right text-yellow-400">{formatCurrency(rowMetrics.totalGross)}</td>
        <td className="px-2 py-1 text-right text-yellow-400 font-medium">{formatCurrency(rowMetrics.marginAmount)}</td>
        <td className="px-2 py-1 text-right text-yellow-400 font-medium">{Math.round(rowMetrics.totalMiles).toLocaleString()}</td>
        {isMilesExpanded && (
          <>
            <td className="px-2 py-1 text-right text-yellow-400 opacity-70">{Math.round(rowMetrics.loadedMiles).toLocaleString()}</td>
            <td className="px-2 py-1 text-right text-yellow-400 opacity-70">{Math.round(rowMetrics.dh).toLocaleString()}</td>
          </>
        )}
        <td className="px-2 py-1 text-right text-purple-400">{formatCurrency(rowMetrics.netPay)}</td>
        <td className="px-2 py-1 text-right text-purple-400">-{formatCurrency(Math.abs(rowMetrics.insuranceExp))}</td>
        <td className="px-2 py-1 text-right text-purple-400">{rowMetrics.totalFuel < 0 ? `-${formatCurrency(Math.abs(rowMetrics.totalFuel))}` : formatCurrency(rowMetrics.totalFuel)}</td>
        {isFuelExpanded && (
          <>
            <td className="px-2 py-1 text-right text-purple-400 opacity-70">{rowMetrics.wosFuel < 0 ? `-${formatCurrency(Math.abs(rowMetrics.wosFuel))}` : formatCurrency(rowMetrics.wosFuel)}</td>
            <td className="px-2 py-1 text-right text-purple-400 opacity-70">{formatCurrency(rowMetrics.fuelRetailPrice, 2)}</td>
            <td className="px-2 py-1 text-right text-purple-400 opacity-70">{formatCurrency(rowMetrics.spotterRetailPrice, 2)}</td>
            <td className="px-2 py-1 text-right text-purple-400 opacity-70">{formatCurrency(rowMetrics.fuelDiscountPrice, 2)}</td>
            <td className="px-2 py-1 text-right text-purple-400 opacity-70">{Math.round(rowMetrics.fuelQuantity)}</td>
          </>
        )}
        <td className="px-2 py-1 text-right text-blue-400 !overflow-visible">
          {renderDisabled('revenue_collected', formatCurrency(rowMetrics.companyPay))}
        </td>
        {isRevColExpanded && (
          <>
            <td className="px-2 py-1 text-right text-zinc-400 font-mono">{rowMetrics.revBase < 0 ? '-' : '+'}{formatCurrency(Math.abs(rowMetrics.revBase))}</td>
            <td className="px-2 py-1 text-right text-zinc-400 font-mono">{rowMetrics.balChange < 0 ? '-' : '+'}{formatCurrency(Math.abs(rowMetrics.balChange))}</td>
            <td className="px-2 py-1 text-right text-zinc-400 font-mono">{rowMetrics.prorated < 0 ? '-' : '+'}{formatCurrency(Math.abs(rowMetrics.prorated))}</td>
            <td className="px-2 py-1 text-right text-zinc-400 font-mono">{rowMetrics.zeroMiDrop < 0 ? '-' : (rowMetrics.zeroMiDrop > 0 ? '+' : '')}{formatCurrency(Math.abs(rowMetrics.zeroMiDrop))}</td>
            <td className="px-2 py-1 text-right text-zinc-400 font-mono">{rowMetrics.escrowAdj < 0 ? '-' : '+'}{formatCurrency(Math.abs(rowMetrics.escrowAdj))}</td>
            <td className="px-2 py-1 text-right text-zinc-400 font-mono">+{formatCurrency(Math.abs(rowMetrics.tollsAdj))}</td>
            <td className="px-2 py-1 text-right text-zinc-400 font-mono">{rowMetrics.cashAdv < 0 ? '-' : '+'}{formatCurrency(Math.abs(rowMetrics.cashAdv))}</td>
            <td className="px-2 py-1 text-right text-zinc-400 font-mono">{rowMetrics.cpmAdj < 0 ? '-' : '+'}{formatCurrency(Math.abs(rowMetrics.cpmAdj))}</td>
            <td className="px-2 py-1 text-right text-zinc-400 font-mono">{rowMetrics.fuelAdj < 0 ? '-' : '+'}{formatCurrency(Math.abs(rowMetrics.fuelAdj))}</td>
            <td className="group/sharedins relative hover:z-[99999] px-2 py-1 text-right text-zinc-400 font-mono cursor-help !overflow-visible" onMouseMove={handleTooltipMouseMove} onMouseLeave={handleTooltipMouseLeave}>
  +{formatCurrency(Math.abs(rowMetrics.fullSharedLiability || 0))}
  {rowMetrics.sharedInsBreakdown && Object.keys(rowMetrics.sharedInsBreakdown).length > 0 && (
    <div className="absolute hidden group-hover/sharedins:flex z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] normal-case text-left w-max min-w-[200px] pointer-events-none flex-col gap-1 bottom-full right-0 mb-1">
      <div className="font-bold text-sky-400 border-b border-zinc-600 pb-1 mb-1">Shared Ins Breakdown:</div>
      {Object.entries(rowMetrics.sharedInsBreakdown).map(([comp, amount]: any) => (
         <div key={comp} className="flex justify-between gap-4">
            <span>{comp}:</span>
            <span className="font-mono text-zinc-300">+{formatCurrency(Math.abs(Number(amount)))}</span>
         </div>
      ))}
    </div>
  )}
</td>
          </>
        )}
        <td className="px-2 py-1 text-right text-blue-400 !overflow-visible">
          {renderDisabled('fuel_rebate', formatCurrency(rowMetrics.fuelRebate))}
        </td>
        <td className="group/wklyexp relative hover:z-[99999] px-2 py-1 text-right text-blue-400 cursor-help !overflow-visible" onMouseMove={handleTooltipMouseMove} onMouseLeave={handleTooltipMouseLeave}>
          {renderDisabled('weekly_expenses', `-${formatCurrency(Math.abs(rowMetrics.wklyExp))}`)}
          <div className="fixed hidden group-hover/wklyexp:flex z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] normal-case text-left w-max min-w-[200px] pointer-events-none flex-col gap-1 dynamic-tooltip">
            <div className="font-bold text-sky-400 border-b border-zinc-600 pb-1 mb-1">Wkly Exp Breakdown:</div>
            {rowMetrics.insLiabAuto !== 0 && <div className="flex justify-between gap-4"><span>Liability (Auto):</span><span className="font-mono text-zinc-300">{rowMetrics.insLiabAuto < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.insLiabAuto))}</span></div>}
            {rowMetrics.insLiabGen !== 0 && <div className="flex justify-between gap-4"><span>Liability (Gen):</span><span className="font-mono text-zinc-300">{rowMetrics.insLiabGen < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.insLiabGen))}</span></div>}
            {rowMetrics.insCargo !== 0 && <div className="flex justify-between gap-4"><span>Cargo:</span><span className="font-mono text-zinc-300">{rowMetrics.insCargo < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.insCargo))}</span></div>}
            {rowMetrics.insLeaseGapCoverage !== 0 && <div className="flex justify-between gap-4"><span>Lease Gap:</span><span className="font-mono text-zinc-300">{rowMetrics.insLeaseGapCoverage < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.insLeaseGapCoverage))}</span></div>}
            {rowMetrics.insTrailerInterchange !== 0 && <div className="flex justify-between gap-4"><span>Trailer Int.:</span><span className="font-mono text-zinc-300">{rowMetrics.insTrailerInterchange < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.insTrailerInterchange))}</span></div>}
            {rowMetrics.insLago !== 0 && <div className="flex justify-between gap-4"><span>LAGO:</span><span className="font-mono text-zinc-300">{rowMetrics.insLago < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.insLago))}</span></div>}
            {rowMetrics.insPhdPremium !== 0 && <div className="flex justify-between gap-4"><span>PhD Prem.:</span><span className="font-mono text-zinc-300">{rowMetrics.insPhdPremium < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.insPhdPremium))}</span></div>}
            {rowMetrics.insPhdTruck !== 0 && <div className="flex justify-between gap-4"><span>PhD Truck:</span><span className="font-mono text-zinc-300">{rowMetrics.insPhdTruck < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.insPhdTruck))}</span></div>}
            {rowMetrics.insPhdTrailer !== 0 && <div className="flex justify-between gap-4"><span>PhD Trailer:</span><span className="font-mono text-zinc-300">{rowMetrics.insPhdTrailer < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.insPhdTrailer))}</span></div>}
            {rowMetrics.fcTruck !== 0 && <div className="flex justify-between gap-4"><span>Truck Price:</span><span className="font-mono text-zinc-300">{rowMetrics.fcTruck < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.fcTruck))}</span></div>}
            {rowMetrics.fcCpm !== 0 && <div className="flex justify-between gap-4"><span>CPM:</span><span className="font-mono text-zinc-300">{rowMetrics.fcCpm < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.fcCpm))}</span></div>}
            {rowMetrics.fcTrailer !== 0 && <div className="flex justify-between gap-4"><span>Trailer Price:</span><span className="font-mono text-zinc-300">{rowMetrics.fcTrailer < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.fcTrailer))}</span></div>}
            {rowMetrics.fcPlates !== 0 && <div className="flex justify-between gap-4"><span>Plates:</span><span className="font-mono text-zinc-300">{rowMetrics.fcPlates < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.fcPlates))}</span></div>}
            {rowMetrics.fcTelematics !== 0 && <div className="flex justify-between gap-4"><span>Telematics:</span><span className="font-mono text-zinc-300">{rowMetrics.fcTelematics < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.fcTelematics))}</span></div>}
            {rowMetrics.fcPhone !== 0 && <div className="flex justify-between gap-4"><span>Phone & Int.:</span><span className="font-mono text-zinc-300">{rowMetrics.fcPhone < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.fcPhone))}</span></div>}
            {rowMetrics.fcOffice !== 0 && <div className="flex justify-between gap-4"><span>Office Supp.:</span><span className="font-mono text-zinc-300">{rowMetrics.fcOffice < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.fcOffice))}</span></div>}
            {rowMetrics.fcRent !== 0 && <div className="flex justify-between gap-4"><span>Rent & Pkg.:</span><span className="font-mono text-zinc-300">{rowMetrics.fcRent < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.fcRent))}</span></div>}
            {rowMetrics.fcBackupMc !== 0 && <div className="flex justify-between gap-4"><span>Backup MC:</span><span className="font-mono text-zinc-300">{rowMetrics.fcBackupMc < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.fcBackupMc))}</span></div>}
            {rowMetrics.fcBoReg !== 0 && <div className="flex justify-between gap-4"><span>Back Office Pay:</span><span className="font-mono text-zinc-300">{rowMetrics.fcBoReg < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.fcBoReg))}</span></div>}
            {rowMetrics.fcBoTech !== 0 && <div className="flex justify-between gap-4"><span>Tech Pay:</span><span className="font-mono text-zinc-300">{rowMetrics.fcBoTech < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.fcBoTech))}</span></div>}
            {rowMetrics.fcFactoring !== 0 && <div className="flex justify-between gap-4"><span>Factoring:</span><span className="font-mono text-zinc-300">{rowMetrics.fcFactoring < 0 ? '+' : '-'}{formatCurrency(Math.abs(rowMetrics.fcFactoring))}</span></div>}
          </div>
        </td>
        <td className="px-2 py-1 text-right text-blue-400 !overflow-visible">
          {renderDisabled('tolls', rowMetrics.tollCost === 0 ? formatCurrency(0) : `-${formatCurrency(Math.abs(rowMetrics.tollCost))}`)}
        </td>
        <td className="group/po relative hover:z-[99999] px-2 py-1 text-right text-blue-400 cursor-help !overflow-visible" onMouseMove={handleTooltipMouseMove} onMouseLeave={handleTooltipMouseLeave}>
          {renderDisabled('po', formatCurrency(rowMetrics.poCoverage))}
          {rowMetrics.poBreakdown && Object.keys(rowMetrics.poBreakdown).length > 0 && (
            <div className="fixed hidden group-hover/po:flex z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] normal-case text-left w-max min-w-[200px] pointer-events-none flex-col gap-1 dynamic-tooltip">
              <div className="font-bold text-sky-400 border-b border-zinc-600 pb-1 mb-1">PO Breakdown:</div>
              {poColumns.map(reason => {
                const poVal = rowMetrics.poBreakdown?.[reason] || 0;
                if (poVal === 0) return null;
                return (
                  <div key={reason} className="flex justify-between gap-4">
                    <span>{reason}:</span>
                    <span className="font-mono text-zinc-300">{poVal < 0 ? '-' : ''}{formatCurrency(Math.abs(poVal))}</span>
                  </div>
                );
              })}
            </div>
          )}
        </td>
        <td className="group/disp relative hover:z-[99999] px-2 py-1 text-right text-blue-400 cursor-help !overflow-visible" onMouseMove={handleTooltipMouseMove} onMouseLeave={handleTooltipMouseLeave}>
          {renderDisabled('dispatcher_pay', `${rowMetrics.dispatcherPay > 0 ? '+' : ''}${formatCurrency(rowMetrics.dispatcherPay)}`)}
          {rowMetrics.dispBreakdown && Object.keys(rowMetrics.dispBreakdown).length > 0 && (
            <div className="fixed hidden group-hover/disp:flex z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] normal-case text-left w-max min-w-[340px] max-w-[400px] pointer-events-none flex-col gap-1.5 whitespace-normal dynamic-tooltip">
              <div className="font-bold text-white border-b border-zinc-600 pb-1 mb-1 text-[11px]">Dispatcher Pay Breakdown:</div>
              <div className="mb-2 w-full text-[10px]">
                <div className="grid grid-cols-[1fr_45px_45px_45px_50px] gap-x-2 border-b border-zinc-700 pb-1 mb-1 font-bold text-zinc-400">
                  <div>Name</div>
                  <div className="text-right">Gross</div>
                  <div className="text-right">Margin</div>
                  <div className="text-right">Fixed</div>
                  <div className="text-right text-zinc-300">Total</div>
                </div>
                {Object.keys(rowMetrics.dispBreakdown).sort((a, b) => (a.startsWith('ALL') === b.startsWith('ALL')) ? a.localeCompare(b) : (a.startsWith('ALL') ? -1 : 1)).map((name) => {
                    const vals = rowMetrics.dispBreakdown[name];
                    const rowSubtotal = vals.gross + vals.margin + vals.fixed;
                    return (
                      <div key={name} className="grid grid-cols-[1fr_45px_45px_45px_50px] gap-x-2 py-0.5 items-center">
                        <div className="text-sky-400 truncate" title={name}>{name}</div>
                        <div className="text-right font-mono text-zinc-300">
                          -{formatCurrency(Math.abs(vals.gross))}
                        </div>
                        <div className="text-right font-mono text-zinc-300">
                          -{formatCurrency(Math.abs(vals.margin))}
                        </div>
                        <div className="text-right font-mono text-zinc-300">
                          -{formatCurrency(Math.abs(vals.fixed))}
                        </div>
                        <div className="text-right font-mono font-bold text-zinc-200">
                          -{formatCurrency(Math.abs(rowSubtotal))}
                        </div>
                      </div>
                    )
                  })}
              </div>
              <div className="flex justify-between items-center gap-4 pt-1 border-t border-zinc-700 text-[10px]">
                <span className="font-bold">Shared Liability (Auto):</span>
                <span className="font-mono text-emerald-400">+{formatCurrency(Math.abs(Object.values(rowMetrics.dispBreakdown).reduce((sum, v) => sum + (Number(v.shared) || 0), 0)))}</span>
              </div>
              <div className="text-[9px] text-zinc-400 mt-1 italic leading-tight">
                * Note: Shared liability is included in this total<br />
                but excluded from Total PnL as it is already in Revenue Collected.
              </div>
            </div>
          )}
        </td>
        <td className="px-2 py-1 text-right text-blue-400 !overflow-visible">
          {renderDisabled('recruiting', formatCurrency(rowMetrics.recruitingCost))}
        </td>
        <td className={`px-2 py-1 text-right font-bold sticky right-[56px] w-[80px] min-w-[80px] z-20 transition-colors ${isExpanded ? 'bg-zinc-800' : 'bg-zinc-900 group-hover:bg-zinc-800'} ${rowMetrics.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(rowMetrics.totalPnL)}</td>
        <td className={`px-2 py-1 text-right font-bold sticky right-0 w-[56px] min-w-[56px] z-20 transition-colors ${isExpanded ? 'bg-zinc-800' : 'bg-zinc-900 group-hover:bg-zinc-800'} ${driver.ranking >= 80 ? 'text-emerald-400' : driver.ranking >= 50 ? 'text-yellow-400' : driver.ranking >= 20 ? 'text-amber-500' : 'text-rose-400'}`}>{`${driver.ranking.toFixed(2)}%`}</td>
      </tr>
      {tpogMode === 'ALL' && franchiseRowMetrics.hasFranchise && (
        <tr className="bg-zinc-950/40 hover:relative hover:z-[9999999]">
          <td className={`px-2 py-1 sticky left-0 z-10 ${isExpanded ? 'bg-zinc-800' : 'bg-zinc-950'}`}></td>
          <td className={`px-2 py-1 font-sans sticky left-[32px] z-10 ${isExpanded ? 'bg-zinc-800' : 'bg-zinc-950'}`}>
            <span className="text-amber-400/90 text-[10px] pl-4">└ TPOG (Franchise PnL)</span>
          </td>
          <td className="px-2 py-1 text-zinc-500">-</td>
          <td className="px-2 py-1 text-zinc-500">-</td>
          <td className="px-2 py-1 text-zinc-500">-</td>
          <td className="px-2 py-1 text-zinc-500">-</td>
          <td className="px-2 py-1 text-zinc-500">-</td>
          <td className="px-2 py-1 text-zinc-500">-</td>
          <td className="px-2 py-1 text-right text-emerald-400/70">-</td>
          <td className="px-2 py-1 text-right text-emerald-400/70">-</td>
          <td className="px-2 py-1 text-right text-emerald-400/70">-</td>
          <td className="px-2 py-1 text-right text-amber-400/70">{formatCurrency(franchiseRowMetrics.totalGross)}</td>
          <td className="px-2 py-1 text-right text-amber-400/70 font-medium">{formatCurrency(franchiseRowMetrics.marginAmount)}</td>
          <td className="px-2 py-1 text-right text-amber-400/70 font-medium">{Math.round(franchiseRowMetrics.totalMiles).toLocaleString()}</td>
          {isMilesExpanded && (
            <>
              <td className="px-2 py-1 text-right text-amber-400/50">{Math.round(franchiseRowMetrics.loadedMiles).toLocaleString()}</td>
              <td className="px-2 py-1 text-right text-amber-400/50">{Math.round(franchiseRowMetrics.dh).toLocaleString()}</td>
            </>
          )}
          <td className="px-2 py-1 text-right text-amber-400/70">{formatCurrency(franchiseRowMetrics.netPay)}</td>
          <td className="px-2 py-1 text-right text-amber-400/70">-{formatCurrency(Math.abs(franchiseRowMetrics.insuranceExp))}</td>
          <td className="px-2 py-1 text-right text-amber-400/70">{franchiseRowMetrics.totalFuel < 0 ? `-${formatCurrency(Math.abs(franchiseRowMetrics.totalFuel))}` : formatCurrency(franchiseRowMetrics.totalFuel)}</td>
          {isFuelExpanded && (
            <>
              <td className="px-2 py-1 text-right text-amber-400/50">{franchiseRowMetrics.wosFuel < 0 ? `-${formatCurrency(Math.abs(franchiseRowMetrics.wosFuel))}` : formatCurrency(franchiseRowMetrics.wosFuel)}</td>
              <td className="px-2 py-1 text-right text-amber-400/50">{formatCurrency(franchiseRowMetrics.fuelRetailPrice, 2)}</td>
              <td className="px-2 py-1 text-right text-amber-400/50">{formatCurrency(franchiseRowMetrics.spotterRetailPrice, 2)}</td>
              <td className="px-2 py-1 text-right text-amber-400/50">{formatCurrency(franchiseRowMetrics.fuelDiscountPrice, 2)}</td>
              <td className="px-2 py-1 text-right text-amber-400/50">{Math.round(franchiseRowMetrics.fuelQuantity)}</td>
            </>
          )}
          <td className="px-2 py-1 text-right text-amber-400/90 !overflow-visible">
            {renderDisabled('revenue_collected', formatCurrency(franchiseRowMetrics.companyPay))}
          </td>
          {isRevColExpanded && (
            <>
              <td className="px-2 py-1 text-right text-amber-400/70 font-mono">{franchiseRowMetrics.revBase < 0 ? '-' : '+'}{formatCurrency(Math.abs(franchiseRowMetrics.revBase))}</td>
              <td className="px-2 py-1 text-right text-amber-400/70 font-mono">{franchiseRowMetrics.balChange < 0 ? '-' : '+'}{formatCurrency(Math.abs(franchiseRowMetrics.balChange))}</td>
              <td className="px-2 py-1 text-right text-amber-400/70 font-mono">{franchiseRowMetrics.prorated < 0 ? '-' : '+'}{formatCurrency(Math.abs(franchiseRowMetrics.prorated))}</td>
              <td className="px-2 py-1 text-right text-amber-400/70 font-mono">{franchiseRowMetrics.zeroMiDrop < 0 ? '-' : (franchiseRowMetrics.zeroMiDrop > 0 ? '+' : '')}{formatCurrency(Math.abs(franchiseRowMetrics.zeroMiDrop))}</td>
              <td className="px-2 py-1 text-right text-amber-400/70 font-mono">{franchiseRowMetrics.escrowAdj < 0 ? '-' : '+'}{formatCurrency(Math.abs(franchiseRowMetrics.escrowAdj))}</td>
              <td className="px-2 py-1 text-right text-amber-400/70 font-mono">+{formatCurrency(Math.abs(franchiseRowMetrics.tollsAdj))}</td>
              <td className="px-2 py-1 text-right text-amber-400/70 font-mono">{franchiseRowMetrics.cashAdv < 0 ? '-' : '+'}{formatCurrency(Math.abs(franchiseRowMetrics.cashAdv))}</td>
              <td className="px-2 py-1 text-right text-amber-400/70 font-mono">{franchiseRowMetrics.cpmAdj < 0 ? '-' : '+'}{formatCurrency(Math.abs(franchiseRowMetrics.cpmAdj))}</td>
              <td className="px-2 py-1 text-right text-amber-400/70 font-mono">{franchiseRowMetrics.fuelAdj < 0 ? '-' : '+'}{formatCurrency(Math.abs(franchiseRowMetrics.fuelAdj))}</td>
              <td className="px-2 py-1 text-right text-amber-400/70 font-mono">+{formatCurrency(Math.abs(franchiseRowMetrics.fullSharedLiability || 0))}</td>
            </>
          )}
          <td className="px-2 py-1 text-right text-amber-400/90 !overflow-visible">
            {renderDisabled('fuel_rebate', formatCurrency(franchiseRowMetrics.fuelRebate))}
          </td>
          <td className="group/franwklyexp relative hover:z-[99999] px-2 py-1 text-right text-amber-400/90 cursor-help !overflow-visible" onMouseMove={handleTooltipMouseMove} onMouseLeave={handleTooltipMouseLeave}>
            {renderDisabled('weekly_expenses', `-${formatCurrency(Math.abs(franchiseRowMetrics.wklyExp))}`)}
            <div className="fixed hidden group-hover/franwklyexp:flex z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] normal-case text-left w-max min-w-[200px] pointer-events-none flex-col gap-1 dynamic-tooltip">
              <div className="font-bold text-sky-400 border-b border-zinc-600 pb-1 mb-1">Franchise Wkly Exp Breakdown:</div>
              {franchiseRowMetrics.insLiabAuto !== 0 && <div className="flex justify-between gap-4"><span>Liability (Auto):</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.insLiabAuto < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.insLiabAuto))}</span></div>}
              {franchiseRowMetrics.insLiabGen !== 0 && <div className="flex justify-between gap-4"><span>Liability (Gen):</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.insLiabGen < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.insLiabGen))}</span></div>}
              {franchiseRowMetrics.insCargo !== 0 && <div className="flex justify-between gap-4"><span>Cargo:</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.insCargo < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.insCargo))}</span></div>}
              {franchiseRowMetrics.insLeaseGapCoverage !== 0 && <div className="flex justify-between gap-4"><span>Lease Gap:</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.insLeaseGapCoverage < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.insLeaseGapCoverage))}</span></div>}
              {franchiseRowMetrics.insTrailerInterchange !== 0 && <div className="flex justify-between gap-4"><span>Trailer Int.:</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.insTrailerInterchange < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.insTrailerInterchange))}</span></div>}
              {franchiseRowMetrics.insLago !== 0 && <div className="flex justify-between gap-4"><span>LAGO:</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.insLago < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.insLago))}</span></div>}
              {franchiseRowMetrics.insPhdPremium !== 0 && <div className="flex justify-between gap-4"><span>PhD Prem.:</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.insPhdPremium < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.insPhdPremium))}</span></div>}
              {franchiseRowMetrics.insPhdTruck !== 0 && <div className="flex justify-between gap-4"><span>PhD Truck:</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.insPhdTruck < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.insPhdTruck))}</span></div>}
              {franchiseRowMetrics.insPhdTrailer !== 0 && <div className="flex justify-between gap-4"><span>PhD Trailer:</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.insPhdTrailer < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.insPhdTrailer))}</span></div>}
              {franchiseRowMetrics.fcTruck !== 0 && <div className="flex justify-between gap-4"><span>Truck Price:</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.fcTruck < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.fcTruck))}</span></div>}
              {franchiseRowMetrics.fcCpm !== 0 && <div className="flex justify-between gap-4"><span>CPM:</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.fcCpm < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.fcCpm))}</span></div>}
              {franchiseRowMetrics.fcTrailer !== 0 && <div className="flex justify-between gap-4"><span>Trailer Price:</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.fcTrailer < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.fcTrailer))}</span></div>}
              {franchiseRowMetrics.fcPlates !== 0 && <div className="flex justify-between gap-4"><span>Plates:</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.fcPlates < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.fcPlates))}</span></div>}
              {franchiseRowMetrics.fcTelematics !== 0 && <div className="flex justify-between gap-4"><span>Telematics:</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.fcTelematics < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.fcTelematics))}</span></div>}
              {franchiseRowMetrics.fcPhone !== 0 && <div className="flex justify-between gap-4"><span>Phone & Int.:</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.fcPhone < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.fcPhone))}</span></div>}
              {franchiseRowMetrics.fcOffice !== 0 && <div className="flex justify-between gap-4"><span>Office Supp.:</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.fcOffice < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.fcOffice))}</span></div>}
              {franchiseRowMetrics.fcRent !== 0 && <div className="flex justify-between gap-4"><span>Rent & Pkg.:</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.fcRent < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.fcRent))}</span></div>}
              {franchiseRowMetrics.fcBackupMc !== 0 && <div className="flex justify-between gap-4"><span>Backup MC:</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.fcBackupMc < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.fcBackupMc))}</span></div>}
              {franchiseRowMetrics.fcBoReg !== 0 && <div className="flex justify-between gap-4"><span>Back Office Pay:</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.fcBoReg < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.fcBoReg))}</span></div>}
              {franchiseRowMetrics.fcBoTech !== 0 && <div className="flex justify-between gap-4"><span>Tech Pay:</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.fcBoTech < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.fcBoTech))}</span></div>}
              {franchiseRowMetrics.fcFactoring !== 0 && <div className="flex justify-between gap-4"><span>Factoring:</span><span className="font-mono text-zinc-300">{franchiseRowMetrics.fcFactoring < 0 ? '+' : '-'}{formatCurrency(Math.abs(franchiseRowMetrics.fcFactoring))}</span></div>}
            </div>
          </td>
          <td className="px-2 py-1 text-right text-amber-400/90 !overflow-visible">
            {renderDisabled('tolls', franchiseRowMetrics.tollCost === 0 ? formatCurrency(0) : `-${formatCurrency(Math.abs(franchiseRowMetrics.tollCost))}`)}
          </td>
          <td className="group/franpo relative hover:z-[99999] px-2 py-1 text-right text-amber-400/90 cursor-help !overflow-visible" onMouseMove={handleTooltipMouseMove} onMouseLeave={handleTooltipMouseLeave}>
            {renderDisabled('po', formatCurrency(franchiseRowMetrics.poCoverage))}
            {franchiseRowMetrics.poBreakdown && Object.keys(franchiseRowMetrics.poBreakdown).length > 0 && (
              <div className="fixed hidden group-hover/franpo:flex z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] normal-case text-left w-max min-w-[200px] pointer-events-none flex-col gap-1 dynamic-tooltip">
                <div className="font-bold text-sky-400 border-b border-zinc-600 pb-1 mb-1">Franchise PO Breakdown:</div>
                {poColumns.map(reason => {
                  const poVal = franchiseRowMetrics.poBreakdown?.[reason] || 0;
                  if (poVal === 0) return null;
                  return (
                    <div key={`fran-po-${reason}`} className="flex justify-between gap-4">
                      <span>{reason}:</span>
                      <span className="font-mono text-zinc-300">{poVal < 0 ? '-' : ''}{formatCurrency(Math.abs(poVal))}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </td>
          <td className="group/frandisp relative hover:z-[99999] px-2 py-1 text-right text-amber-400/90 cursor-help !overflow-visible" onMouseMove={handleTooltipMouseMove} onMouseLeave={handleTooltipMouseLeave}>
            {renderDisabled('dispatcher_pay', `${franchiseRowMetrics.dispatcherPay > 0 ? '+' : ''}${formatCurrency(franchiseRowMetrics.dispatcherPay)}`)}
            {franchiseRowMetrics.dispBreakdown && Object.keys(franchiseRowMetrics.dispBreakdown).length > 0 && (
              <div className="fixed hidden group-hover/frandisp:flex z-[100000] bg-zinc-800 border border-zinc-500 text-zinc-200 p-3 rounded-lg shadow-2xl text-[10px] normal-case text-left w-max min-w-[340px] max-w-[400px] pointer-events-none flex-col gap-1.5 whitespace-normal dynamic-tooltip">
                <div className="font-bold text-white border-b border-zinc-600 pb-1 mb-1 text-[11px]">Franchise Dispatcher Pay Breakdown:</div>
                <div className="mb-2 w-full text-[10px]">
                  <div className="grid grid-cols-[1fr_45px_45px_45px_50px] gap-x-2 border-b border-zinc-700 pb-1 mb-1 font-bold text-zinc-400">
                    <div>Name</div>
                    <div className="text-right">Gross</div>
                    <div className="text-right">Margin</div>
                    <div className="text-right">Fixed</div>
                    <div className="text-right text-zinc-300">Total</div>
                  </div>
                  {Object.keys(franchiseRowMetrics.dispBreakdown).sort((a, b) => (a.startsWith('ALL') === b.startsWith('ALL')) ? a.localeCompare(b) : (a.startsWith('ALL') ? -1 : 1)).map((name) => {
                    const vals = franchiseRowMetrics.dispBreakdown[name];
                    const rowSubtotal = vals.gross + vals.margin + vals.fixed;
                    return (
                      <div key={name} className="grid grid-cols-[1fr_45px_45px_45px_50px] gap-x-2 py-0.5 items-center">
                        <div className="text-sky-400 truncate" title={name}>{name}</div>
                        <div className="text-right font-mono text-zinc-300">
                          -{formatCurrency(Math.abs(vals.gross))}
                        </div>
                        <div className="text-right font-mono text-zinc-300">
                          -{formatCurrency(Math.abs(vals.margin))}
                        </div>
                        <div className="text-right font-mono text-zinc-300">
                          -{formatCurrency(Math.abs(vals.fixed))}
                        </div>
                        <div className="text-right font-mono font-bold text-zinc-200">
                          -{formatCurrency(Math.abs(rowSubtotal))}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between items-center gap-4 pt-1 border-t border-zinc-700 text-[10px]">
                  <span className="font-bold">Shared Liability (Auto):</span>
                  <span className="font-mono text-emerald-400">+{formatCurrency(Math.abs(Object.values(franchiseRowMetrics.dispBreakdown).reduce((sum, v) => sum + (Number(v.shared) || 0), 0)))}</span>
                </div>
                <div className="text-[9px] text-zinc-400 mt-1 italic leading-tight">
                  * Note: Shared liability is included in this total<br />
                  but excluded from Total PnL as it is already in Revenue Collected.
                </div>
              </div>
            )}
          </td>
          <td className="px-2 py-1 text-right text-amber-400/90 !overflow-visible">
            {renderDisabled('recruiting', formatCurrency(franchiseRowMetrics.recruitingCost))}
          </td>
          <td className={`px-2 py-1 text-right font-bold sticky right-[56px] w-[80px] min-w-[80px] z-20 ${isExpanded ? 'bg-zinc-800' : 'bg-zinc-950'} ${franchiseRowMetrics.totalPnL >= 0 ? 'text-emerald-400/90' : 'text-rose-400/90'}`}>{formatCurrency(franchiseRowMetrics.totalPnL)}</td>
          <td className={`px-2 py-1 text-right text-zinc-600 sticky right-0 w-[56px] min-w-[56px] z-20 ${isExpanded ? 'bg-zinc-800' : 'bg-zinc-950'}`}>-</td>
        </tr>
      )}
      {isExpanded && (
        <tr className="bg-zinc-950/50 z-50 [&>td]:border-b-2 [&>td]:border-emerald-500/50">
          <td colSpan={(isRevColExpanded ? 10 : 0) + (isMilesExpanded ? 2 : 0) + (isFuelExpanded ? 5 : 0) + 25} className="p-0 border-b border-zinc-800">
           <div className="sticky left-0 z-[60] flex justify-center py-4 box-border overflow-visible" style={{ width: 'var(--visible-width, 100vw)', minWidth: 'var(--visible-width, 100vw)', maxWidth: 'var(--visible-width, 100vw)' }}>
              <div className="w-full max-w-[1400px] px-4 flex-shrink-0">
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
                      <div className="text-[10px] text-zinc-500 uppercase font-bold mb-2 pb-1 border-b border-zinc-800/50">
                        {selectedPayDate === 'ALL' ? 'DRIVER LATEST INFO' : 'DRIVER INFO'}
                      </div>
                      <div className="flex flex-col gap-2">
                        {['Truck', 'Contract', 'Company', 'Team', 'Franchise', 'Dispatcher'].map(field => {
                          const currentVal = driverStats.current[field as keyof typeof driverStats.current];
                          const history = driverStats.histories[field as keyof typeof driverStats.histories];
                          const hasSwapped = history.length > 1;

                          return (
                            <div key={field} className="flex flex-col gap-1 w-full">
                              <div className="flex items-start justify-between w-full">
                                <span className="text-[10px] text-zinc-400 whitespace-nowrap mr-2">{field}:</span>
                                <div className="flex items-start justify-end gap-1.5 flex-1 min-w-0 text-right">
                                  {hasSwapped && (
                                    <div className="relative flex-shrink-0 mt-[2px] group/tooltip" onMouseMove={handleTooltipMouseMove} onMouseLeave={handleTooltipMouseLeave}>
                                      <ArrowRightLeft size={10} className="text-blue-400 cursor-help" />
                                      <div className="hidden group-hover/tooltip:flex fixed w-56 bg-zinc-800 border border-zinc-600 rounded shadow-2xl p-3 z-[100000] flex-col dynamic-tooltip tooltip-right pointer-events-none">
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
                        {Array.from(new Set(driver.records.map((r:any) => r.contractType && r.contractType !== '-' ? r.contractType : 'Unassigned'))).filter((c:any) => c && !['GLOBAL', 'UNRECONCILED'].includes(String(c).toUpperCase())).map(c => <option key={`c-${c}`} value={`CTR:${c as string}`}>Contract: {c as string}</option>)}
                        {Array.from(new Set(driver.records.map((r:any) => r.companyId && r.companyId !== '-' ? r.companyId : 'Unassigned'))).filter((c:any) => c && !['GLOBAL', 'UNRECONCILED'].includes(String(c).toUpperCase())).map(c => <option key={`cmp-${c}`} value={`CMP:${c as string}`}>Company: {c as string}</option>)}
                        {Array.from(new Set(driver.records.map((r:any) => r.teamId && r.teamId !== '-' ? r.teamId : 'Unassigned'))).filter((t:any) => t && !['GLOBAL', 'UNRECONCILED'].includes(String(t).toUpperCase())).map(t => <option key={`team-${t}`} value={`TEAM:${t as string}`}>Team: {t as string}</option>)}
                        {Array.from(new Set(driver.records.map((r:any) => r.franchiseId && r.franchiseId !== '-' ? r.franchiseId : 'Unassigned'))).filter((f:any) => f && !['GLOBAL', 'UNRECONCILED'].includes(String(f).toUpperCase())).map(f => <option key={`fra-${f}`} value={`FRA:${f as string}`}>Franchise: {f as string}</option>)}
                        {Array.from(new Set(driver.records.map((r:any) => r.dispatcherId && r.dispatcherId !== '-' ? r.dispatcherId : 'Unassigned'))).filter((d:any) => d && !['GLOBAL', 'UNRECONCILED'].includes(String(d).toUpperCase())).map(d => <option key={`disp-${d}`} value={`DISP:${d as string}`}>Dispatcher: {d as string}</option>)}
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
                        mainDiagnosis === 'N/A' ? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/50 shadow-[0_0_8px_-2px_rgba(113,113,122,0.4)]' :
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
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-auto pt-2 border-t border-zinc-800 flex flex-col gap-1 w-full">
                   <div className="grid grid-cols-[1fr_60px_60px] gap-2 px-1 text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                     <div>Metric</div>
                     <div className="text-right">Total</div>
                     <div className="text-right">Avg</div>
                   </div>
                   <div className="space-y-1">
                     {perfStats.map((stat: any) => {
                        const getTextColor = (severity: string) => {
                           if (severity === 'good') return 'text-emerald-500';
                           if (severity === 'neutral') return 'text-yellow-400';
                           if (severity === 'warning') return 'text-amber-500';
                           return 'text-rose-500';
                        };
                        
                        const getIcon = (severity: string) => {
                          if (severity === 'N/A') return <Circle size={10} className="text-zinc-600" />;
                          if (severity === 'good') return <CheckCircle size={10} className="text-emerald-500" />;
                          if (severity === 'neutral') return <Info size={10} className="text-yellow-400" />;
                          if (severity === 'warning') return <AlertTriangle size={10} className="text-amber-500" />;
                          return <AlertTriangle size={10} className="text-rose-500" />;
                        };

                        return (
                           <div key={stat.name} className="grid grid-cols-[1fr_60px_60px] gap-2 px-1 items-center text-[10px]">
                              <div className="flex items-center gap-1.5 overflow-hidden">
                                 <div className="flex-shrink-0">{stat.val === null ? <Circle size={10} className="text-zinc-600" /> : getIcon(stat.severity)}</div>
                                 <span className="text-zinc-400 truncate">{stat.name}</span>
                              </div>
                              <div className="text-right font-mono text-zinc-400 opacity-80 truncate">
                                {stat.total === null ? 'N/A' : (stat.name === 'Fuel' ? (stat.total < 0 ? `-$${Math.abs(stat.total).toFixed(2)}` : `$${stat.total.toFixed(2)}`) : formatCurrency(stat.total))}
                              </div>
                              <div className={`text-right font-mono font-bold truncate ${getTextColor(stat.severity)}`}>
                                {stat.val === null ? 'N/A' : (stat.name === 'Fuel' ? (stat.val < 0 ? `-$${Math.abs(stat.val).toFixed(2)}` : `$${stat.val.toFixed(2)}`) : formatCurrency(stat.val))}
                              </div>
                           </div>
                        );
                     })}
                   </div>
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
});

const DriverTable: React.FC<DriverTableProps> = ({ drivers }) => {
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        el.style.setProperty('--visible-width', `${entry.contentRect.width}px`);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const validDrivers = React.useMemo(() => {
    const uniqueDates = Array.from(new Set(drivers.map(d => d.payDate).filter(Boolean)));
    const sortedDates = uniqueDates.sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime());
    const allowedDates = new Set(sortedDates.length > 6 ? sortedDates.slice(0, -6) : sortedDates);
    return drivers.filter(d => allowedDates.has(d.payDate));
  }, [drivers]);

  const enrichedMap = React.useMemo(() => {
    const map = new Map<string, any>();
    ((window as any).__ENRICHED_DRIVERS__ || []).forEach((ed: any) => {
      let dStr = ed.payDate || ed.week_ending || '';
      if (dStr.includes('T')) dStr = dStr.split('T')[0];
      
      const mergeFn = (key: string, curr: any) => {
        if (map.has(key)) {
          const prev = map.get(key);
          const mergedPo = { ...(prev.po_breakdown || {}) };
          Object.entries(curr.po_breakdown || {}).forEach(([k, v]) => {
            mergedPo[k] = (mergedPo[k] || 0) + Number(v);
          });
          map.set(key, {
            ...prev,
            calculatedFixedCost: (prev.calculatedFixedCost || 0) + (curr.calculatedFixedCost || 0),
            fixed_costs: (prev.fixed_costs || 0) + (curr.fixed_costs || 0),
            insuranceCost: (prev.insuranceCost || 0) + (curr.insuranceCost || 0),
            calculatedTolls: (prev.calculatedTolls || 0) + (curr.calculatedTolls || 0),
            tolls: (prev.tolls || 0) + (curr.tolls || 0),
            tollCost: (prev.tollCost || 0) + (curr.tollCost || 0),
            poCoverage: (prev.poCoverage || 0) + (curr.poCoverage || 0),
            pnlTotalPOCov: (prev.pnlTotalPOCov || 0) + (curr.pnlTotalPOCov || 0),
            recruitingCost: (prev.recruitingCost || 0) + (curr.recruitingCost || 0),
            dispatcherCommission: (prev.dispatcherCommission || 0) + (curr.dispatcherCommission || 0),
            dispGrossAmount: (prev.dispGrossAmount || 0) + (curr.dispGrossAmount || 0),
            dispMarginAmount: (prev.dispMarginAmount || 0) + (curr.dispMarginAmount || 0),
            dispFixedAmount: (prev.dispFixedAmount || 0) + (curr.dispFixedAmount || 0),
            po_breakdown: mergedPo
          });
        } else {
          map.set(key, curr);
        }
      };

      mergeFn(`${ed.name}_${dStr}_${ed.contractType}_${ed.companyId}`, ed);
      
      if (ed.contractType === 'TPOG WITH FRANCHISE') {
        mergeFn(`${ed.name}_${dStr}_TPOG_${ed.companyId}`, ed);
      }
      if (ed.contractType === 'OO WITH FRANCHISE') {
        mergeFn(`${ed.name}_${dStr}_OO_${ed.companyId}`, ed);
      }
    });
    return map;
  }, [drivers]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'totalGross', direction: 'desc' });
  const [isAvgPerWeek, setIsAvgPerWeek] = useState(false);
  const [isRevColExpanded, setIsRevColExpanded] = useState(false);
  const [isMilesExpanded, setIsMilesExpanded] = useState(false);
  const [isFuelExpanded, setIsFuelExpanded] = useState(false);
  
  const [tpogMode, setTpogMode] = useState<'ALL' | 'CALCULATED'>('ALL');
  const [search, setSearch] = useState('');
  const [selectedPayDate, setSelectedPayDate] = useState<string>('ALL');
  const [tableFilters, setTableFilters] = useState<FilterRule[]>([{ field: 'Contract', operator: 'status is', value: ['ACTIVE'] }]);
  const [showSettings, setShowSettings] = useState(false);
  const [driverSettings, setDriverSettings] = useState<any>({});
  const [fixedExpenses, setFixedExpenses] = useState<any[]>([]);
  const [pnlConfigs, setPnlConfigs] = useState<any[]>([]);
  const [poRules, setPoRules] = useState<any[]>([]);

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
    const loadPoRules = async () => {
      try {
        const { data } = await supabase.from('po_rules').select('*');
        if (data) setPoRules(data);
      } catch(e) { console.error("Error loading PO rules:", e); }
    };
    loadPnlConfigs();
    loadPoRules();
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
                      const rm = getRawMetrics(r, fixedExpenses, enrichedMap, pnlConfigs, poRules);
                      totalGross += (r.grossRevenue || r.driver_gross || 0);
                      totalMargin += (r.marginAmount || 0);
                      totalNetPay += (r.netPay ?? 0);
                      totalDispPay += rm.dispPay;
                      totalFuel += rm.fuel;
                      totalMiles += (r.milesDriven || 0);
                      totalRevCol += rm.revCol;
                      let finalPnl = rm.pnl;
                      if (rm.franchisePnlCalculated) {
                          finalPnl = finalPnl - rm.franchisePnlCalculated;
                      }
                      totalPnL += finalPnl;
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
              const m = getRawMetrics(d, fixedExpenses, enrichedMap, pnlConfigs, poRules);
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
                  case 'Truck': fieldValue = d.truck; break;
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

              const isCategorical = ['Company', 'Team', 'Franchise', 'Driver', 'Dispatcher', 'Truck'].includes(rule.field);
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
  }, [validDrivers, tableFilters, fixedExpenses, enrichedMap, driverSettings, tpogMode]);


  const aggregatedDrivers = React.useMemo(() => {
    const dates = Array.from(new Set(validDrivers.map(d => d.payDate).filter(Boolean)));
    const sortedDates = dates.sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime());
    const allowedDates = new Set(sortedDates);
    const map = new Map<string, any>();
    const filteredDriverNames = new Set(filteredTableDrivers.map(d => d.name));

    const activeNamesInSelectedDate = new Set(
      selectedPayDate === 'ALL'
        ? validDrivers.map(d => d.name)
        : validDrivers.filter(d => d.payDate === selectedPayDate).map(d => d.name)
    );

    const latestDatesByDriver = new Map<string, string>();
    const globalStatusByDriver = new Map<string, string>();
    const globalRecordsByDriver = new Map<string, any[]>();

    const isDateMatch = (payDate: string) => {
        if (selectedPayDate === 'ALL') return true;
        if (isAvgPerWeek) return payDate <= selectedPayDate;
        return payDate === selectedPayDate;
    };

    validDrivers.forEach(d => {
        if (!allowedDates.has(d.payDate)) return;
        
        const name = d.name || 'Unknown';
        if (!globalRecordsByDriver.has(name)) globalRecordsByDriver.set(name, []);
        globalRecordsByDriver.get(name)!.push(d);

        const dDate = d.payDate || d.week_ending || '';
        const currGlobal = globalStatusByDriver.get(name + '_date') || '';
        if (!currGlobal || dDate > currGlobal || (dDate === currGlobal && String(d.status).toUpperCase() === 'TERMINATED')) {
            globalStatusByDriver.set(name + '_date', dDate);
            globalStatusByDriver.set(name, d.status);
        }

        if (!isDateMatch(d.payDate)) return;
        if (!latestDatesByDriver.has(name) || dDate > (latestDatesByDriver.get(name) || '')) {
            latestDatesByDriver.set(name, dDate);
        }
    });

    const catFilters = tableFilters.filter(f => ['Company', 'Dispatcher', 'Contract', 'Team', 'Franchise'].includes(f.field));
    const isRecordMatch = (d: any) => {
      if (catFilters.length === 0) return true;
      return catFilters.every(rule => {
        let safeVal = 'Unassigned';
        if (rule.field === 'Company') safeVal = String(d.companyId && d.companyId !== '-' ? d.companyId : 'Unassigned');
        if (rule.field === 'Dispatcher') safeVal = String(d.dispatcherId && d.dispatcherId !== '-' ? d.dispatcherId : 'Unassigned');
        if (rule.field === 'Contract') safeVal = String(d.contractType && d.contractType !== '-' ? d.contractType : 'Unassigned');
        if (rule.field === 'Team') safeVal = String(d.teamId && d.teamId !== '-' ? d.teamId : 'Unassigned');
        if (rule.field === 'Franchise') safeVal = String(d.franchiseId && d.franchiseId !== '-' ? d.franchiseId : 'Unassigned');
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
      if (!isRecordMatch(d)) return;
      if (!isDateMatch(d.payDate)) return;

      if (!rankMap.has(d.name)) rankMap.set(d.name, { totalPnL: 0, records: [] });
      const rData = rankMap.get(d.name)!;
      const m = getRawMetrics(d, fixedExpenses, enrichedMap, pnlConfigs, poRules);
      
      const isLatest = (d.payDate || d.week_ending || '') === latestDatesByDriver.get(d.name || 'Unknown');
      let finalPnl = m.pnl;
      let finalFranchisePnlCalculated = m.franchisePnlCalculated;
      
      
      if (finalFranchisePnlCalculated) {
          finalPnl -= finalFranchisePnlCalculated;
      }
      rData.totalPnL += finalPnl;
      rData.records.push(d);
    });

    const rankList = Array.from(rankMap.entries()).map(([name, data]) => {
      const count = Math.max(1, new Set(data.records.map((r: any) => r.payDate || r.week_ending)).size);
      const pnlForRank = isAvgPerWeek ? data.totalPnL / count : data.totalPnL;
      return { name, pnlForRank };
    });

    rankList.sort((a, b) => a.pnlForRank - b.pnlForRank);
    const finalRankMap = new Map<string, number>();
    rankList.forEach((r, i) => {
      finalRankMap.set(r.name, rankList.length > 1 ? (i / (rankList.length - 1)) * 100 : 100);
    });

    validDrivers.forEach(d => {
      if (!filteredDriverNames.has(d.name)) return;
      if (!activeNamesInSelectedDate.has(d.name)) return;
      if (!allowedDates.has(d.payDate)) return;
      const nameLower = (d.name || '').toLowerCase();
      const compLower = (d.companyId || '').toLowerCase();
      if (nameLower.includes('unassigned') || nameLower.includes('unreconciled') || compLower.includes('unassigned') || compLower.includes('unreconciled')) return;
      if (!isRecordMatch(d)) return;
      
      if (search && !nameLower.startsWith(search.toLowerCase())) return;
      if (!isDateMatch(d.payDate)) return;

      if (!map.has(d.name)) {
            map.set(d.name, {
              id: d.name,
              name: d.name,
              status: globalStatusByDriver.get(d.name) || d.status,
              allRecords: globalRecordsByDriver.get(d.name) || [],
              truck: d.truck,
              franchiseId: d.franchiseId,
              companyId: d.companyId,
              teamId: d.teamId,
              dispatcherId: d.dispatcherId,
              contractType: d.contractType,
              effectiveDrivers: 0,
              effectiveNonTeams: 0,
              effectiveTrailers: 0,
              totalGross: 0,
              companyPay: 0,
              totalPnL: 0,
              totalMiles: 0,
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
              revBase: 0,
              balChange: 0,
              prorated: 0,
              zeroMiDrop: 0,
              escrowAdj: 0,
              tollsAdj: 0,
              cashAdv: 0,
              cpmAdj: 0,
              fuelAdj: 0,
              fullSharedLiability: 0,
              sharedInsBreakdown: {} as Record<string, number>,
              tpogPercentages: [],
              contracts: new Set(),
              records: [],
              latestDate: d.payDate,
              latestRealTruckDate: (d.effectiveDrivers || 0) > 0 ? d.payDate : ''
            });
          }
      const agg = map.get(d.name);
      
      const m = getRawMetrics(d, fixedExpenses, enrichedMap, pnlConfigs, poRules);
      const isLatest = (d.payDate || d.week_ending || '') === latestDatesByDriver.get(d.name || 'Unknown');
      
      let finalBalChange = isLatest ? (m.balChange || 0) : 0;
      let finalEscrowAdj = isLatest ? (m.escrowAdj || 0) : 0;
      let finalRevCol = m.revCol;
      let finalFranchiseRevCol = m.franchiseRevCol;
      let finalPnl = m.pnl;
      let finalFranchisePnlCalculated = m.franchisePnlCalculated;

      

      const tpogCalc = tpogMode === 'CALCULATED' ? 1 : 0;
      agg.effectiveDrivers += (d.effectiveDrivers || 0);
      agg.effectiveNonTeams += (d.effectiveNonTeams || 0);
      agg.effectiveTrailers += ((d as any).effectiveTrailers || 0);
      agg.totalGross += (d.grossRevenue || d.driver_gross || 0);
      agg.companyPay += finalRevCol - (tpogCalc * finalFranchiseRevCol / 2);
      let pnlToAdd = finalPnl;
      if (finalFranchisePnlCalculated) {
          pnlToAdd = pnlToAdd - finalFranchisePnlCalculated;
      }
      agg.totalPnL += pnlToAdd;
      agg.totalMiles += (Number(d.milesDriven) || 0);
      agg.marginAmount += (d.marginAmount || 0);
      agg.poCoverage += m.po - (tpogCalc * m.franchisePo / 2);
      agg.fuelCost += (d.fuelCost ? -Math.abs(d.fuelCost) : 0);
      agg.fuelSavings += (d.fuelSavings || 0);
      agg.totalFuel += m.fuel;
      agg.tollCost += -m.tolls + (tpogCalc * m.franchiseTolls / 2);
      agg.maintenanceCost += (d.maintenanceCost || 0);
      agg.driverFaultExpenses += (d.driverFaultExpenses || 0);
      agg.netPay += (d.netPay || 0);
      agg.dispatcherPay += m.dispPay - (tpogCalc * m.franchiseDispPay / 2);
      agg.insuranceExp += m.insExp;
      agg.fuelRebate += m.fuelRebate - (tpogCalc * m.franchiseFuelReb / 2);
      agg.wklyExp += m.wklyExp - (tpogCalc * m.franchiseWklyExp / 2);
      agg.recruitingCost += m.recruiting - (tpogCalc * m.franchiseRecruiting / 2);
      
      agg.revBase += m.revBase || 0;
      agg.balChange += finalBalChange;
      agg.prorated += m.prorated || 0;
      agg.zeroMiDrop += m.zeroMiDrop || 0;
      agg.escrowAdj += finalEscrowAdj;
      agg.tollsAdj += m.tollsAdj || 0;
      agg.cashAdv += m.cashAdv || 0;
      agg.cpmAdj += m.cpmAdj || 0;
      agg.fuelAdj += m.fuelAdj || 0;
      agg.fullSharedLiability += m.fullSharedLiability || 0;
      if (m.sharedInsBreakdown) {
          Object.entries(m.sharedInsBreakdown).forEach(([k, v]) => {
              if (!agg.sharedInsBreakdown[k]) agg.sharedInsBreakdown[k] = 0;
              agg.sharedInsBreakdown[k] += Number(v);
          });
      }

      if (d.tpogPercentage) agg.tpogPercentages.push(d.tpogPercentage);
      if (d.contractType) agg.contracts.add(d.contractType);
      agg.records.push(d);

      if (d.payDate) {
          const dDate = new Date(d.payDate).getTime();
          const aggDate = agg.latestDate ? new Date(agg.latestDate).getTime() : 0;
          if (!agg.latestDate || dDate > aggDate || (dDate === aggDate && String(d.status).toUpperCase() === 'TERMINATED')) {
            agg.latestDate = d.payDate;
            agg.franchiseId = d.franchiseId;
            agg.teamId = d.teamId;
            agg.dispatcherId = d.dispatcherId;
            agg.contractType = d.contractType;
          }

          if ((d.effectiveDrivers || 0) > 0) {
            const trkDate = agg.latestRealTruckDate ? new Date(agg.latestRealTruckDate).getTime() : 0;
            if (!agg.latestRealTruckDate || dDate >= trkDate) {
              agg.latestRealTruckDate = d.payDate;
              agg.truck = d.truck;
            }
          } else if (!agg.latestRealTruckDate) {
            const trkDate = agg.latestDate ? new Date(agg.latestDate).getTime() : 0;
            if (dDate >= trkDate) {
              agg.truck = d.truck;
            }
          }
        }
    });

    let result = Array.from(map.values()).map(agg => {
      const count = Math.max(1, new Set(agg.records.map((r: any) => r.payDate || r.week_ending)).size);
      const div = count;

      if (isAvgPerWeek) {
        return {
          ...agg,
          effectiveDrivers: agg.effectiveDrivers / count,
          effectiveNonTeams: agg.effectiveNonTeams / count,
          effectiveTrailers: agg.effectiveTrailers / count,
          totalGross: agg.totalGross / count,
          totalMiles: agg.totalMiles / count,
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
          revBase: agg.revBase / count,
          balChange: agg.balChange / count,
          prorated: agg.prorated / count,
          zeroMiDrop: agg.zeroMiDrop / count,
          escrowAdj: agg.escrowAdj / count,
          tollsAdj: agg.tollsAdj / count,
          cashAdv: agg.cashAdv / count,
          cpmAdj: agg.cpmAdj / count,
          fuelAdj: agg.fuelAdj / count,
          fullSharedLiability: agg.fullSharedLiability / count,
          sharedInsBreakdown: Object.fromEntries(Object.entries(agg.sharedInsBreakdown || {}).map(([k, v]) => [k, Number(v) / count])),
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
  }, [validDrivers, filteredTableDrivers, isAvgPerWeek, sortConfig, search, selectedPayDate, fixedExpenses, tableFilters, enrichedMap, tpogMode]);

  const poColumns = React.useMemo(() => {
    const cols = new Set<string>();
    aggregatedDrivers.forEach(agg => {
      agg.records.forEach((r: any) => {
        const enriched = enrichedMap.get(`${r.name}_${r.payDate || r.week_ending}_${r.contractType}_${r.companyId}`);
        if (enriched?.po_breakdown) {
          Object.keys(enriched.po_breakdown).forEach(k => cols.add(k));
        }
      });
    });
    return Array.from(cols).sort();
  }, [aggregatedDrivers, enrichedMap]);

  const fleetAverages = React.useMemo(() => {
    const contractAvgs: Record<string, any> = {};
    
    const latestDatesByDriver = new Map<string, string>();
    aggregatedDrivers.forEach(d => {
      d.records.forEach((r: any) => {
        const name = r.name || 'Unknown';
        const dDate = r.payDate || r.week_ending || '';
        if (!latestDatesByDriver.has(name) || dDate > (latestDatesByDriver.get(name) || '')) {
          latestDatesByDriver.set(name, dDate);
        }
      });
    });

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
         
         const m = getRawMetrics(r, fixedExpenses, enrichedMap, pnlConfigs, poRules);
         const isLatest = (r.payDate || r.week_ending || '') === latestDatesByDriver.get(r.name || 'Unknown');
         let finalRevCol = m.revCol;
         let finalPnl = m.pnl;
         let finalFranchisePnlCalculated = m.franchisePnlCalculated;

         

         const poCov = m.po;
         const revCol = finalRevCol;
         const fuelVal = m.fuel;
         const fuelReb = m.fuelRebate;
         const dispPay = m.dispPay;
         const insExp = m.insExp;
         const wklyExp = m.wklyExp;
         const dTollsRaw = m.tolls;
         const recruit = m.recruiting;
         const pnl = finalPnl;

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
         let pnlToAdd = pnl;
         if (finalFranchisePnlCalculated) {
             pnlToAdd = pnlToAdd - finalFranchisePnlCalculated;
         }
         contractAvgs[cType].pnlSum += pnlToAdd;
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
  }, [aggregatedDrivers, fixedExpenses, tpogMode]);

  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'ALL'>(25);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedPayDate, tableFilters, isAvgPerWeek, sortConfig, itemsPerPage]);

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
      <div className="flex justify-between items-center px-1 mb-2 relative z-[9999]">
        <div className="flex items-center gap-2">
         <input 
              type="text" 
              placeholder="Search driver..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-[11px] px-2 py-1 h-[26px] rounded w-64 text-zinc-300 focus:border-emerald-500 focus:outline-none" 
            />
            <select
              value={selectedPayDate}
              onChange={(e) => setSelectedPayDate(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-[11px] px-2 py-1 h-[26px] rounded text-zinc-300 focus:border-emerald-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Dates (Combined)</option>
              {Array.from(new Set(validDrivers.map((d: any) => d.payDate).filter(Boolean))).sort((a: any, b: any) => new Date(b).getTime() - new Date(a).getTime()).map((date: any) => (
                <option key={date} value={date}>{date}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 relative">
            <div className="w-[90px] h-[26px] z-[100] relative [&_.absolute]:!right-0 [&_.absolute]:!left-auto [&>*:first-child]:!text-[9px] [&>*:first-child]:!whitespace-nowrap [&>*:first-child]:!tracking-tight [&_button]:!text-[9px] [&_button]:!whitespace-nowrap">
               <TableFilter
                 filters={tableFilters} 
                 setFilters={setTableFilters}
                 optionsMap={{
                   'Driver': Array.from(new Set(validDrivers.map(d => d.name))).filter(Boolean) as string[],
                   'Contract': Array.from(new Set(validDrivers.map(d => d.contractType && d.contractType !== '-' ? d.contractType : 'Unassigned'))).filter(Boolean) as string[],
                   'Company': Array.from(new Set(validDrivers.map(d => d.companyId && d.companyId !== '-' ? d.companyId : 'Unassigned'))).filter(Boolean) as string[],
                   'Franchise': Array.from(new Set(validDrivers.map(d => d.franchiseId && d.franchiseId !== '-' ? d.franchiseId : 'Unassigned'))).filter(Boolean) as string[],
                   'Dispatcher': Array.from(new Set(validDrivers.map(d => d.dispatcherId && d.dispatcherId !== '-' ? d.dispatcherId : 'Unassigned'))).filter(Boolean) as string[],
                   'Team': Array.from(new Set(validDrivers.map(d => d.teamId && d.teamId !== '-' ? d.teamId : 'Unassigned'))).filter(Boolean) as string[],
                   'Truck': Array.from(new Set(validDrivers.map(d => d.truck && d.truck !== '-' ? d.truck : 'Unassigned'))).filter(Boolean) as string[],
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
              onClick={() => setIsAvgPerWeek(!isAvgPerWeek)}
              className={`rounded text-[10px] font-bold border transition-colors cursor-pointer flex items-center justify-center px-3 h-[26px] gap-1.5 w-[90px] ${isAvgPerWeek ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'}`}
            >
              <Eye size={10} /> {isAvgPerWeek ? 'TOTAL' : 'AVERAGE'}
            </button>
            <div className="flex bg-zinc-950 border border-zinc-800 rounded h-[26px] w-max flex-shrink-0">
              <div className="relative group flex flex-shrink-0">
                <button
                  onClick={() => setTpogMode('ALL')}
                  className={`whitespace-nowrap flex-shrink-0 px-3 py-1 text-[10px] font-bold transition-colors cursor-pointer h-full rounded-l ${tpogMode === 'ALL' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                >
                  TPOG FRANCHISE VIEW
                </button>
                <div className="hidden group-hover:block absolute top-full right-0 mt-2 w-64 bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded-lg shadow-2xl border border-zinc-600 whitespace-normal normal-case z-[110] text-center pointer-events-none">
                  Displays full values for TPOG contracts, including the franchise portion. Franchise PnL can be seen in the sub-row below the driver. Total PnL always shows the final calculated value (Company PnL for TPOG row, Franchise PnL for franchise row).
                </div>
              </div>
              <div className="relative group flex flex-shrink-0">
                <button
                  onClick={() => setTpogMode('CALCULATED')}
                  className={`whitespace-nowrap flex-shrink-0 px-3 py-1 border-l border-zinc-800 text-[10px] font-bold transition-colors cursor-pointer h-full rounded-r ${tpogMode === 'CALCULATED' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                >
                  TPOG FINAL VIEW
                </button>
                <div className="hidden group-hover:block absolute top-full right-0 mt-2 w-64 bg-zinc-800 text-zinc-200 text-[10px] p-2.5 rounded-lg shadow-2xl border border-zinc-600 whitespace-normal normal-case z-[110] text-center pointer-events-none">
                  Displays calculated values for TPOG contracts with the franchise portion already deducted. Total PnL always shows the final calculated value (Company PnL for TPOG row, Franchise PnL for franchise row).
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="rounded text-[10px] font-bold border transition-colors cursor-pointer bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white flex items-center justify-center gap-1 w-[90px] h-[26px]"
            >
              <Settings size={10} /> SETTINGS
            </button>
        </div>
      </div>
      <div className="flex flex-col flex-[7] min-h-0 mb-1">
      <div ref={tableContainerRef} className="overflow-auto border border-zinc-800 rounded-t-lg bg-zinc-900 flex-1 min-h-0">
        <table className="w-full text-left text-[11px] whitespace-nowrap relative">
          <thead className="bg-zinc-800/50 text-zinc-400 font-medium uppercase tracking-wider sticky top-0 z-[100]">
            <tr>
              <th className="px-2 py-1.5 w-[32px] min-w-[32px] max-w-[32px] bg-zinc-900 border-b border-zinc-800 sticky top-0 left-0 z-30"></th>
              <th onClick={() => requestSort('name')} className="px-2 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[10px] cursor-pointer hover:text-white select-none text-left sticky top-0 left-[32px] z-30">Driver</th>
              <th onClick={() => requestSort('truck')} className="px-2 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[10px] cursor-pointer hover:text-white select-none text-left sticky top-0 z-20">Truck</th>
              <th onClick={() => requestSort('companyId')} className="px-2 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[10px] cursor-pointer hover:text-white select-none text-left sticky top-0 z-20">Company</th>
              <th onClick={() => requestSort('teamId')} className="px-2 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[10px] cursor-pointer hover:text-white select-none text-left sticky top-0 z-20">Team</th>
              <th onClick={() => requestSort('franchiseId')} className="px-2 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[10px] cursor-pointer hover:text-white select-none text-left sticky top-0 z-20">Franchise</th>
              <th onClick={() => requestSort('dispatcherId')} className="px-2 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[10px] cursor-pointer hover:text-white select-none text-left sticky top-0 z-20">Dispatcher</th>
              <th onClick={() => requestSort('contractType')} className="px-2 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[10px] cursor-pointer hover:text-white select-none text-left sticky top-0 z-20">Contract</th>
              <th onClick={() => requestSort('effectiveDrivers')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] cursor-pointer hover:text-white select-none sticky top-0 z-20">Eff Drv</th>
              <th onClick={() => requestSort('effectiveNonTeams')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] cursor-pointer hover:text-white select-none sticky top-0 z-20">Eff NonTm</th>
              <th onClick={() => requestSort('effectiveTrailers')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] cursor-pointer hover:text-white select-none sticky top-0 z-20">Eff Trls</th>
              <th onClick={() => requestSort('totalGross')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-yellow-400 cursor-pointer hover:text-white select-none sticky top-0 z-20">Drv. Gross{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('marginAmount')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-yellow-400 cursor-pointer hover:text-white select-none sticky top-0 z-20">Margin{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('totalMiles')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-yellow-400 cursor-pointer hover:text-white select-none sticky top-0 z-20">
                <div className="flex items-center justify-end gap-1">
                  Total Miles{isAvgPerWeek ? ' / wk' : ''}
                  <button onClick={(e) => { e.stopPropagation(); setIsMilesExpanded(!isMilesExpanded); }} className="p-0.5 hover:bg-zinc-800 rounded transition-colors ml-1 cursor-pointer">
                    <ChevronRight size={10} className={`transition-transform ${isMilesExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </th>
              {isMilesExpanded && (
                <>
                  <th className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-yellow-400 opacity-70 sticky top-0 z-20 whitespace-nowrap">Loaded Miles</th>
                  <th className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-yellow-400 opacity-70 sticky top-0 z-20 whitespace-nowrap">DH</th>
                </>
              )}
              <th onClick={() => requestSort('netPay')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-purple-400 cursor-pointer hover:text-white select-none sticky top-0 z-20">Net Pay{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('insuranceExp')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-purple-400 cursor-pointer hover:text-white select-none sticky top-0 z-20">Ins. Exp.{isAvgPerWeek ? ' / wk' : ''}</th>
              <th onClick={() => requestSort('totalFuel')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-purple-400 cursor-pointer hover:text-white select-none sticky top-0 z-20">
                <div className="flex items-center justify-end gap-1">
                  Fuel{isAvgPerWeek ? ' / wk' : ''}
                  <button onClick={(e) => { e.stopPropagation(); setIsFuelExpanded(!isFuelExpanded); }} className="p-0.5 hover:bg-zinc-800 rounded transition-colors ml-1 cursor-pointer">
                    <ChevronRight size={10} className={`transition-transform ${isFuelExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </th>
              {isFuelExpanded && (
                <>
                  <th className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-purple-400 opacity-70 sticky top-0 z-20 whitespace-nowrap">SPOTTER FUEL</th>
                  <th className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-purple-400 opacity-70 sticky top-0 z-20 whitespace-nowrap">Ret. Price</th>
                  <th className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-purple-400 opacity-70 sticky top-0 z-20 whitespace-nowrap">Spotter Ret. Price</th>
                  <th className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-purple-400 opacity-70 sticky top-0 z-20 whitespace-nowrap">Disc Price</th>
                  <th className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-purple-400 opacity-70 sticky top-0 z-20 whitespace-nowrap">Quantity</th>
                </>
              )}
              <th onClick={() => requestSort('companyPay')} className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-blue-400 cursor-pointer hover:text-white select-none sticky top-0 z-20">
                <div className="flex items-center justify-end gap-1">
                  Rev. Col.{isAvgPerWeek ? ' / wk' : ''}
                  <button onClick={(e) => { e.stopPropagation(); setIsRevColExpanded(!isRevColExpanded); }} className="p-0.5 hover:bg-zinc-800 rounded transition-colors ml-1 cursor-pointer">
                    <ChevronRight size={10} className={`transition-transform ${isRevColExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </th>
              {isRevColExpanded && (
                <>
                  <th className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-500 sticky top-0 z-20 whitespace-nowrap">Rev Base</th>
                  <th className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-500 sticky top-0 z-20 whitespace-nowrap">Bal Change</th>
                  <th className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-500 sticky top-0 z-20 whitespace-nowrap">Rev Prorated</th>
                  <th className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-500 sticky top-0 z-20 whitespace-nowrap">0 Mi Cap</th>
                  <th className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-500 sticky top-0 z-20 whitespace-nowrap">Escrow Adj</th>
                  <th className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-500 sticky top-0 z-20 whitespace-nowrap">Tolls Adj</th>
                  <th className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-500 sticky top-0 z-20 whitespace-nowrap">Cash Adv</th>
                  <th className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-500 sticky top-0 z-20 whitespace-nowrap">CPM Adj</th>
                  <th className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-500 sticky top-0 z-20 whitespace-nowrap">Fuel Adj</th>
                  <th className="px-2 py-1.5 text-right bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-500 sticky top-0 z-20 whitespace-nowrap">Shared Ins</th>
                </>
              )}
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
          {aggregatedDrivers.slice((currentPage - 1) * (itemsPerPage === 'ALL' ? aggregatedDrivers.length : itemsPerPage), currentPage * (itemsPerPage === 'ALL' ? aggregatedDrivers.length : itemsPerPage)).map((driver) => (
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
              isAvgPerWeek={isAvgPerWeek}
              tpogMode={tpogMode}
              isRevColExpanded={isRevColExpanded}
              isFuelExpanded={isFuelExpanded}
              isMilesExpanded={isMilesExpanded}
              poColumns={poColumns}
              poRules={poRules}
              selectedPayDate={selectedPayDate}
            />
          ))}
        </tbody>
      </table>
    </div>
    <div className="flex items-center justify-between px-4 py-2 border border-t-0 border-zinc-800 rounded-b-lg bg-zinc-900/50 flex-shrink-0">
      <span className="text-[10px] text-zinc-500">
        Showing {aggregatedDrivers.length === 0 ? 0 : (currentPage - 1) * (itemsPerPage === 'ALL' ? aggregatedDrivers.length : itemsPerPage) + 1} to {itemsPerPage === 'ALL' ? aggregatedDrivers.length : Math.min(currentPage * itemsPerPage, aggregatedDrivers.length)} of {aggregatedDrivers.length} entries
      </span>
      <div className="flex items-center gap-3">
        <select
          value={itemsPerPage}
          onChange={(e) => {
            const val = e.target.value;
            setItemsPerPage(val === 'ALL' ? 'ALL' : Number(val));
          }}
          className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-2 py-0.5 text-[10px] outline-none cursor-pointer focus:border-emerald-500 h-[24px]"
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={75}>75</option>
          <option value={100}>100</option>
          <option value="ALL">ALL</option>
        </select>
        <div className="flex gap-1">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
            disabled={currentPage === 1} 
            className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded text-[10px] disabled:opacity-50 hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            Prev
          </button>
          <button 
            onClick={() => setCurrentPage(p => p + 1)} 
            disabled={itemsPerPage === 'ALL' || currentPage >= Math.ceil(aggregatedDrivers.length / itemsPerPage) || aggregatedDrivers.length === 0} 
            className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded text-[10px] disabled:opacity-50 hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>
    </div>
    </div>
    </div>
  );
  };

  export default DriverTable;