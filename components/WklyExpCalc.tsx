export const getWeeklyAmountFromExp = (amount: number, exp?: any) => {
  if (!exp) return amount;
  if (exp.valid_from && exp.valid_to) {
    const dFrom = new Date(exp.valid_from);
    const dTo = new Date(exp.valid_to);
    const daysDiff = Math.round((dTo.getTime() - dFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (daysDiff > 0) return amount / (daysDiff / 7);
  }
  if (exp.frequency === 'Annually') return amount / 52;
  if (exp.frequency === 'Monthly') return amount / 4.33;
  return amount;
};

export const getActiveAmount = (expName: string, currentDate: string | null, companyId: string | undefined, activeCompanyCount: number = 1, fixedExpenses: any[]) => {
  const currTime = (currentDate ? new Date(currentDate).getTime() : Date.now()) - (3 * 24 * 60 * 60 * 1000);
  const evaluateExp = (matchedExp: any) => {
      if (matchedExp.threshold_date) {
          const threshTime = new Date(matchedExp.threshold_date).getTime();
          if (currTime < threshTime) {
              return matchedExp.amount_before !== undefined ? matchedExp.amount_before : (matchedExp.amount || 0);
          } else {
              return matchedExp.amount_after !== undefined ? matchedExp.amount_after : (matchedExp.amount || 0);
          }
      }
      const isComplex = ['Liability Insurance (Global)', 'Cargo Insurance', 'Trailer Interchange', 'PD Premium', 'Physical Damage'].includes(matchedExp.name);
      if (isComplex && matchedExp.amount_before !== undefined) return matchedExp.amount_before;
      return matchedExp.amount || 0;
  };

  if (companyId) {
      let exps = fixedExpenses.filter((e: any) => e.name.toLowerCase().includes(expName.toLowerCase()) && e.companyId === companyId);
      if (exps.length > 0) {
          let matchedExp = exps.find((e: any) => {
              const fromTime = e.valid_from ? new Date(e.valid_from).getTime() : -Infinity;
              const toTime = e.valid_to ? new Date(e.valid_to).getTime() : Infinity;
              return currTime >= fromTime && currTime <= toTime;
          }) || exps[0];
          return { amount: evaluateExp(matchedExp), unit: matchedExp.unit || '$', exp: matchedExp };
      } else {
          let allExps = fixedExpenses.filter((e: any) => e.name.toLowerCase().includes(expName.toLowerCase()) && e.companyId === 'ALL');
          if (allExps.length > 0) {
              let matchedExp = allExps.find((e: any) => {
                  const fromTime = e.valid_from ? new Date(e.valid_from).getTime() : -Infinity;
                  const toTime = e.valid_to ? new Date(e.valid_to).getTime() : Infinity;
                  return currTime >= fromTime && currTime <= toTime;
              }) || allExps[0];
              return { amount: evaluateExp(matchedExp), unit: matchedExp.unit || '$', exp: matchedExp };
          }
      }
      return { amount: 0, unit: '$', exp: undefined };
  } else {
      const exps = fixedExpenses.filter((e: any) => e.name.toLowerCase().includes(expName.toLowerCase()));
      if (exps.length === 0) return { amount: 0, unit: '$', exp: undefined };
      let matchedExp = exps.find((e: any) => {
          const fromTime = e.valid_from ? new Date(e.valid_from).getTime() : -Infinity;
          const toTime = e.valid_to ? new Date(e.valid_to).getTime() : Infinity;
          return e.companyId === 'ALL' && currTime >= fromTime && currTime <= toTime;
      });
      if (!matchedExp) {
          matchedExp = exps.find((e: any) => e.companyId === 'ALL') || exps.find((e: any) => {
              const fromTime = e.valid_from ? new Date(e.valid_from).getTime() : -Infinity;
              const toTime = e.valid_to ? new Date(e.valid_to).getTime() : Infinity;
              return currTime >= fromTime && currTime <= toTime;
          }) || exps[0];
      }
      return { amount: evaluateExp(matchedExp), unit: matchedExp?.unit || '$', exp: matchedExp };
  }
};

export const calculateSharedMetrics = (
  initialDrivers: any[],
  fixedExpenses: any[],
  simulationConfig: any,
  finImportByDate: any,
  globalStatsByDate: any,
  companyStatsMap: any,
  configContracts: any[],
  getPnlConfigItems: (contractType: string) => string[],
  isDriverView: boolean = false
) => {
  let rawEffCount = 0;
  let rawEffNonTeams = 0;
  let rawEffTrailers = 0;
  let rawEffNonTeamsNoOO = 0;
  
  initialDrivers.forEach(d => {
      rawEffCount += (d.effectiveDrivers || 0);
      rawEffNonTeams += (d.effectiveNonTeams || 0);
      rawEffTrailers += ((d as any).effectiveTrailers || 0);
      if (d.contractType !== 'OO') rawEffNonTeamsNoOO += (d.effectiveNonTeams || 0);
  });

  const effCount = Number(rawEffCount.toFixed(2));
  const effNonTeamsCount = Number(rawEffNonTeams.toFixed(2));
  const effNonTeams = effNonTeamsCount > 0 ? effNonTeamsCount : 1;
  const effTrailersCount = Number(rawEffTrailers.toFixed(2));
  const effNonTeamsNoOOCount = Number(rawEffNonTeamsNoOO.toFixed(2));

  const currentPayDate = initialDrivers.length > 0 ? initialDrivers[0].payDate : null;

  let numOfTrucks = 0;
  let avgTruckPrice = 0;
  let numOfTrailers = 0;
  let avgTrailerPrice = 0;
  let rawFinImportData: any = null;

  const uniqueDatesInSelection = Array.from(new Set(initialDrivers.map(d => d.payDate))).filter(Boolean) as string[];
  let totalCalculatedTrucks = 0;
  let totalCalculatedTrailers = 0;
  let truckPriceSum = 0;
  let trailerPriceSum = 0;
  let datesWithFinData = 0;
  let totalTruckUtilization = 0;
  let totalTrailerUtilization = 0;

  uniqueDatesInSelection.forEach(payDate => {
      if (finImportByDate[payDate]) {
          const finData = finImportByDate[payDate];
          const matches = finData.matches;
          
          if (matches && matches.length > 0) {
              if (datesWithFinData === 0) {
                  rawFinImportData = finData.rawFinImportData;
              }
              datesWithFinData++;
              truckPriceSum += finData.avgTruckPrice;
              trailerPriceSum += finData.avgTrailerPrice;

              const globalTrucks = finData.globalTrucks;
              const globalTrailers = finData.globalTrailers;
              const currentGlobalStats = globalStatsByDate[payDate];
              const globalNonTeams = currentGlobalStats?.nonTeams || 1;
              const globalEffTrailersStat = currentGlobalStats?.effTrailers || 1;

              const dateDrivers = initialDrivers.filter(d => d.payDate === payDate);
              const uniqueComps = Array.from(new Set(dateDrivers.map(d => d.companyId))).filter(Boolean) as string[];
              let calculatedTrucks = 0;
              let calculatedTrailers = 0;

              const hasAnyCompanyData = matches.some((m:any) => m.company_name && m.company_name.trim() !== '' && (m.amount != null || m.comp_trailers != null));

              if (hasAnyCompanyData) {
                  const totalCompsForDate = Object.keys(companyStatsMap).filter(k => k.startsWith(`${payDate}_`)).length;
                  
                  if (uniqueComps.length === totalCompsForDate || uniqueComps.length === 0) {
                      calculatedTrucks = globalTrucks;
                      calculatedTrailers = globalTrailers;
                  } else {
                      uniqueComps.forEach(compId => {
                          const compMatch = matches.find((m:any) => m.company_name && m.company_name.replace(/\s+/g, '').toLowerCase() === compId.replace(/\s+/g, '').toLowerCase());
                          if (compMatch) {
                              calculatedTrucks += Number(compMatch.amount) || 0;
                              calculatedTrailers += Number(compMatch.comp_trailers) || 0;
                          }
                      });
                  }
              } else {
                  const initialCompsStats: Record<string, {ntNoOO: number, tr: number}> = {};
                  dateDrivers.forEach(d => {
                      if (!d.companyId) return;
                      if (!initialCompsStats[d.companyId]) initialCompsStats[d.companyId] = {ntNoOO: 0, tr: 0};
                      if (d.contractType !== 'OO') initialCompsStats[d.companyId].ntNoOO += (d.effectiveNonTeams || 0);
                      initialCompsStats[d.companyId].tr += ((d as any).effectiveTrailers || 0);
                  });

                  uniqueComps.forEach(compId => {
                      const cSubsetNonTeams = initialCompsStats[compId]?.ntNoOO || 0;
                      const cSubsetTrailers = initialCompsStats[compId]?.tr || 0;
                      calculatedTrucks += globalTrucks * (cSubsetNonTeams / globalNonTeams);
                      calculatedTrailers += globalTrailers * (cSubsetTrailers / globalEffTrailersStat);
                  });

                  const noCompDrivers = dateDrivers.filter(d => !d.companyId || !uniqueComps.includes(d.companyId));
                  if (noCompDrivers.length > 0) {
                      const noCompNT = noCompDrivers.filter(d => d.contractType !== 'OO').reduce((sum, d) => sum + (d.effectiveNonTeams || 0), 0);
                      const noCompTr = noCompDrivers.reduce((sum, d) => sum + ((d as any).effectiveTrailers || 0), 0);
                      calculatedTrucks += globalTrucks * (noCompNT / globalNonTeams);
                      calculatedTrailers += globalTrailers * (noCompTr / globalEffTrailersStat);
                  }
              }
              totalCalculatedTrucks += calculatedTrucks;
              totalCalculatedTrailers += calculatedTrailers;

              let weekEffNTNoOO = 0;
              let weekEffTr = 0;
              dateDrivers.forEach(d => {
                  if (d.contractType !== 'OO') weekEffNTNoOO += (d.effectiveNonTeams || 0);
                  weekEffTr += ((d as any).effectiveTrailers || 0);
              });

              if (calculatedTrucks > 0) totalTruckUtilization += (weekEffNTNoOO / calculatedTrucks) * 100;
              if (calculatedTrailers > 0) totalTrailerUtilization += (weekEffTr / calculatedTrailers) * 100;
          }
      }
  });

  const truckUtilization = datesWithFinData > 0 ? totalTruckUtilization / datesWithFinData : 0;
  const trailerUtilization = datesWithFinData > 0 ? totalTrailerUtilization / datesWithFinData : 0;

  numOfTrucks = uniqueDatesInSelection.length > 0 ? Math.round(totalCalculatedTrucks / uniqueDatesInSelection.length) : Math.round(totalCalculatedTrucks);
  numOfTrailers = uniqueDatesInSelection.length > 0 ? Math.round(totalCalculatedTrailers / uniqueDatesInSelection.length) : Math.round(totalCalculatedTrailers);

  if (datesWithFinData > 0) {
      avgTruckPrice = truckPriceSum / datesWithFinData;
      avgTrailerPrice = trailerPriceSum / datesWithFinData;
  }

  const gross = initialDrivers.reduce((sum, d) => sum + (d.grossRevenue || 0), 0);
  const margin = initialDrivers.reduce((sum, d) => sum + d.marginAmount, 0);
  const fuelSavings = initialDrivers.reduce((sum, d) => sum + (d.fuelSavings || 0), 0);
  const driverPay = initialDrivers.reduce((sum, d) => sum + d.netPay, 0);
  const fuel = initialDrivers.reduce((sum, d) => {
      const ct = d.contractType || '';
      if (ct.includes('TPOG') || ct === 'POG' || ct === 'CPM') {
          return sum - Math.abs(d.fuelCost || 0);
      }
      return sum + Math.abs(d.fuelSavings || 0);
  }, 0);
  const maint = initialDrivers.reduce((sum, d) => sum + d.maintenanceCost, 0);
  const faults = initialDrivers.reduce((sum, d) => sum + d.driverFaultExpenses, 0);
  
  const totalPO = initialDrivers.reduce((sum, d) => sum + (d.poAmount || 0), 0);
  const totalEscrow = initialDrivers.reduce((sum, d) => sum + (d.escrowBalance || 0), 0);
  const totalBalance = initialDrivers.reduce((sum, d) => sum + (d.balanceTotal || 0), 0);
  const fuelRebate = initialDrivers.reduce((sum, d) => sum + ((d as any).fuelRebate || 0), 0);
  const poBreakdown = initialDrivers.reduce((acc: any, d: any) => {
      let pb = d.po_breakdown;
      if (pb && typeof pb === 'object') {
          Object.entries(pb).forEach(([key, val]) => {
              let adjustedVal = Number(val);
              if (adjustedVal !== 0) {
                  if (!acc[key]) acc[key] = 0;
                  acc[key] += adjustedVal;
              }
          });
      }
      return acc;
  }, {});
  const insuranceExp = initialDrivers.reduce((sum, d) => sum + ((d as any).insuranceCost || 0), 0);
  const insLiabAuto = initialDrivers.reduce((sum, d) => sum + ((d as any).insLiabAuto || 0), 0);
  const insLiabGen = initialDrivers.reduce((sum, d) => sum + ((d as any).insLiabGen || 0), 0);
  const insCargo = initialDrivers.reduce((sum, d) => sum + ((d as any).insCargo || 0), 0);
  const insLeaseGapCoverage = initialDrivers.reduce((sum, d) => sum + ((d as any).insLeaseGapCoverage || 0), 0);
  const insTrailerInterchange = initialDrivers.reduce((sum, d) => sum + ((d as any).insTrailerInterchange || 0), 0);
  const insLago = initialDrivers.reduce((sum, d) => sum + ((d as any).insLago || 0), 0);
  const insPhdPremium = initialDrivers.reduce((sum, d) => sum + ((d as any).insPhdPremium || 0), 0);
  const insPhdTruck = initialDrivers.reduce((sum, d) => sum + ((d as any).insPhdTruck || 0), 0);
  const insPhdTrailer = initialDrivers.reduce((sum, d) => sum + ((d as any).insPhdTrailer || 0), 0);
  
  const dispatcherPay = initialDrivers.reduce((sum, d) => sum + (d.dispatcherCommission || 0), 0);
  const dispGrossAmount = initialDrivers.reduce((sum, d) => sum + ((d as any).dispGrossAmount || 0), 0);
  const dispMarginAmount = initialDrivers.reduce((sum, d) => sum + ((d as any).dispMarginAmount || 0), 0);
  const dispSharedLiability = initialDrivers.reduce((sum, d) => sum + ((d as any).dispSharedLiability || 0), 0);
  const dispFixedAmount = initialDrivers.reduce((sum, d) => sum + ((d as any).dispFixedAmount || 0), 0);
  const fullSharedLiability = initialDrivers.reduce((sum, d) => sum + ((d as any).fullSharedLiability || 0), 0);
  const sharedInsBreakdown = initialDrivers.reduce((acc: any, d: any) => {
      let amt = Number(d.fullSharedLiability || 0);
      if (amt !== 0) {
          let comp = d.companyId || 'Unassigned';
          if (!acc[comp]) acc[comp] = 0;
          acc[comp] += amt;
      }
      return acc;
  }, {});

  const dispBreakdown = initialDrivers.reduce((acc: any, d: any) => {
      let amt = Number(d.dispatcherCommission || 0);
      if (amt !== 0 || d.dispSharedLiability) {
          let label = d.appliedDispRuleLabel || 'Company Default';
          if (!acc[label]) acc[label] = { gross: 0, margin: 0, fixed: 0, total: 0 };
          acc[label].gross += Number(d.dispGrossAmount || 0);
          acc[label].margin += Number(d.dispMarginAmount || 0);
          acc[label].fixed += Number(d.dispFixedAmount || 0);
          acc[label].total += amt;
      }
      return acc;
  }, {});

  let companyPay = 0;
  let tolls = 0;
  let totalPOCov = 0;
  let totalRecruiting = 0;
  let baseFixed = 0;
  let adjFixed = 0;
  let pnlCompanyPay = 0;
  let pnlTolls = 0;
  let pnlTotalPOCov = 0;
  let pnlTotalRecruiting = 0;
  let pnlBaseFixed = 0;
  let pnlAdjFixed = 0;
  let pnlFuelRebate = 0;
  let pnlDispGrossAmount = 0;
  let pnlDispMarginAmount = 0;
  
  let fcTruck = 0, fcCpm = 0, fcTrailer = 0, fcPlates = 0, fcTelematics = 0, fcPhone = 0, fcOffice = 0, fcRent = 0, fcBackupMc = 0, fcBoReg = 0, fcBoTech = 0, fcFactoring = 0;

  let pnlRevBase = 0;
  let pnlFranchiseBase = 0;
  let pnlPoDeductions = 0;
  let pnlPoSettle = 0;
  let pnlNegNetPay = 0;
  let pnlStrictNegNetPay = 0;
  let pnlBalanceSettle = 0;
  let pnlBalanceChange = 0;
  let pnlExcludedBalanceChange = 0;
  let pnlIncludedBalanceChange = 0;
  let pnlTruckFloat = 0;
  let pnlTruckWkly = 0;
  let pnlOccIns = 0;
  let pnlEld = 0;
  let pnlIfta = 0;
  let pnlMaintSupport = 0;
  let pnlLiability = 0;
  let pnlTruckPhd = 0;
  let pnlTrailer = 0;
  let pnlTrailerPhd = 0;
  let pnlEscrowAdj = 0;
  let pnlTollsAdj = 0;
  let pnlCashAdv = 0;
  let pnlCpmAdj = 0;
  let pnlFuelAdj = 0;
  let pnlProrated = 0;
  let pnlZeroMiDrop = 0;

  initialDrivers.forEach(d => {
      fcTruck += (d as any).fcTruck || 0;
      fcCpm += (d as any).fcCpm || 0;
      fcTrailer += (d as any).fcTrailer || 0;
      fcPlates += (d as any).fcPlates || 0;
      fcTelematics += (d as any).fcTelematics || 0;
      fcPhone += (d as any).fcPhone || 0;
      fcOffice += (d as any).fcOffice || 0;
      fcRent += (d as any).fcRent || 0;
      fcBackupMc += (d as any).fcBackupMc || 0;
      fcBoReg += (d as any).fcBoReg || 0;
      fcBoTech += (d as any).fcBoTech || 0;
      fcFactoring += (d as any).fcFactoring || 0;

      const activeItems = getPnlConfigItems(d.contractType || '');

      const dFuelRebate = (d as any).fuelRebate || 0;
      if (activeItems.includes('fuel_rebate')) pnlFuelRebate += dFuelRebate;

      const dTollsRaw = Number((d as any).originalDbTolls !== undefined ? (d as any).originalDbTolls : ((d as any).rawTolls !== undefined ? (d as any).rawTolls : ((d as any).tolls || 0)));
      const dTolls = Math.abs((d as any).calculatedTolls !== undefined ? (d as any).calculatedTolls : ((d as any).tolls !== undefined ? (d as any).tolls : (d.tollCost || 0)));
      tolls += dTolls;
      if (activeItems.includes('tolls')) pnlTolls += dTolls;

      const dPOCov = Number(d.poCoverage) || 0;
      totalPOCov += dPOCov;
      if (activeItems.includes('po')) pnlTotalPOCov += dPOCov;

      const dRecruiting = d.recruitingCost || 0;
      totalRecruiting += dRecruiting;
      if (activeItems.includes('recruiting')) pnlTotalRecruiting += dRecruiting;

      if (activeItems.includes('dispatcher_pay')) {
          pnlDispGrossAmount += ((d as any).dispGrossAmount || 0);
          pnlDispMarginAmount += ((d as any).dispMarginAmount || 0);
      }

      const dBaseFixed = (d as any).fixed_costs || 0;
      const dAdjFixed = simulationConfig.globalFixedExpenseAdjustment * (d.effectiveDrivers || 0);
      baseFixed += dBaseFixed;
      adjFixed += dAdjFixed;
      if (activeItems.includes('weekly_expenses')) {
          pnlBaseFixed += dBaseFixed;
          pnlAdjFixed += dAdjFixed;
      }

      let companyTakeMulti = 1;
      if ((d.contractType === 'TPOG WITH FRANCHISE' || (d.contractType === 'TPOG' && d.franchiseId)) && configContracts && configContracts.length > 0) {
          const tpogFranRule = [...configContracts].filter(c => c.contract_type === 'TPOG WITH FRANCHISE').sort((a,b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
          if (tpogFranRule && tpogFranRule.calculation_type === 'TPOG_FRANCHISE') {
              companyTakeMulti = tpogFranRule.mc_gross_percent !== undefined ? Number(tpogFranRule.mc_gross_percent) : 1;
          }
      }

      const isFranchise = d.contractType === 'TPOG' && !!d.franchiseId;
      const effNT = d.effectiveNonTeams || 0;
      const effTr = (d as any).effectiveTrailers || 0;

      const rBase = Number((d as any).revenue_base ?? (d as any).revenueBase ?? 0);
      const poDed = Number((d as any).po_deductions ?? (d as any).poDeductions ?? 0);
      const poSet = Number((d as any).po_settle ?? (d as any).poSettle ?? 0);
      const balSet = Number((d as any).balance_settle ?? (d as any).balanceSettle ?? 0);
      const nPay = Number((d as any).net_pay ?? d.netPay ?? 0);
      const escDed = Number((d as any).escrow_deduction ?? (d as any).escrowDeduct ?? 0);
      
      const tFloat = Number((d as any).truck_float ?? (d as any).truckFloat ?? 0);
      const tWkly = Number((d as any).truck_wkly ?? (d as any).truckWkly ?? 0);
      const oIns = Number((d as any).occ_ins ?? (d as any).occIns ?? 0);
      const dEld = Number((d as any).eld ?? 0);
      const dIfta = Number((d as any).ifta ?? 0);
      const mSup = Number((d as any).maintenance_support ?? (d as any).maintenanceSupport ?? 0);
      const liab = Number((d as any).liability ?? 0);
      const tPhd = Number((d as any).truck_phd ?? (d as any).truckPhd ?? 0);
      const dTrl = Number((d as any).trailer ?? 0);
      const dTrlPhd = Number((d as any).trailer_phd ?? (d as any).trailerPhd ?? 0);
      
      const dCash = Number((d as any).cash_advance_percent ?? (d as any).cashAdvancePercent ?? 0);
      const dRevCpm = Number((d as any).revenue_cpm ?? (d as any).revenueCpm ?? 0);
      const dMiles = Number((d as any).total_miles ?? d.milesDriven ?? 0);
      const fSaved = Number((d as any).fuel_saved ?? d.fuelSavings ?? 0);
      const fSpent = Number((d as any).fuel_spent ?? (d as any).fuelCost ?? 0);

      const revWithoutFuelVal = Number((d as any).rev_without_fuel ?? (d as any).revWithoutFuel ?? 0);
      const mileCapFactor = (revWithoutFuelVal > 0 && dMiles === 0) ? 0 : 1;

      let drvRevBase = 0;
      let drvFranchiseBase = 0;
      let drvPoDeductions = 0;
      let drvPoSettle = 0;
      let drvNegNetPay = 0;
      let drvBalanceSettle = 0;
      let drvBalanceChange = 0;
      let drvTruckFloat = 0;
      let drvTruckWkly = 0;
      let drvOccIns = 0;
      let drvEld = 0;
      let drvIfta = 0;
      let drvMaintSupport = 0;
      let drvLiability = 0;
      let drvTruckPhd = 0;
      let drvTrailer = 0;
      let drvTrailerPhd = 0;
      let drvEscrowAdj = 0;
      let drvTollsAdj = 0;
      let drvCashAdv = 0;
      let drvCpmAdj = 0;
      let drvFuelAdj = 0;
      let drvZeroMiDrop = 0;

      if (isFranchise) {
          const franRevCapped = Number((d as any).franchise_rev_capped_bal ?? (d as any).franchiseRevCappedBal ?? 0);
          const cappedBase = (franRevCapped > 0 && dMiles === 0) ? 0 : franRevCapped;
          drvFranchiseBase = cappedBase;

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
          
          if ((d as any).isFranchiseStub) {
              drvPoDeductions = -poDed;
              drvPoSettle = poSet;
              drvNegNetPay = nPay < 0 ? nPay : 0;
              drvBalanceSettle = balSet;
              drvBalanceChange = drvPoDeductions + drvPoSettle + drvNegNetPay + drvBalanceSettle;
              
              drvEscrowAdj = nPay < 0 ? Math.min(Math.abs(nPay), Math.abs(escDed)) : 0;
              drvCashAdv = dCash;
              drvCpmAdj = dRevCpm * dMiles;
              drvFuelAdj = (d.name === 'Garland Jermaine Norris' ? 0 : -fSpent);
              drvTollsAdj = 0;

              drvRevBase = rBase;
          } else {
              drvPoDeductions = -poDed;
              drvPoSettle = poSet;
              drvNegNetPay = nPay < 0 ? nPay : 0;
              drvBalanceSettle = balSet;
              drvBalanceChange = drvPoDeductions + drvPoSettle + drvNegNetPay + drvBalanceSettle;
              
              drvEscrowAdj = 0;
              drvCashAdv = dCash;
              
              drvCpmAdj = dRevCpm * dMiles;
              drvFuelAdj = (d.name === 'Garland Jermaine Norris' ? 0 : -fSpent);
              drvTollsAdj = 0;

              if (d.name === 'Garland Jermaine Norris') {
                  drvRevBase = (d.grossRevenue || 0) * 0.2;
              } else {
                  drvRevBase = rBase;
              }
          }
      
      }  else {
          if (d.name === 'Garland Jermaine Norris') {
              drvRevBase = (d.grossRevenue || 0) * 0.2;
          } else {
              drvRevBase = rBase;
              const balFactor = d.contractType === 'MCLOO' ? 0.3 : 1;
              drvPoDeductions = -poDed;
              drvPoSettle = poSet;
              drvNegNetPay = nPay < 0 ? nPay : 0;
              drvBalanceSettle = balSet;
              drvBalanceChange = (drvPoDeductions + drvPoSettle + drvNegNetPay + drvBalanceSettle) * balFactor;
              
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

          if (d.contractType !== 'MCLOO') {
              drvEscrowAdj = (nPay < 0 ? Math.min(Math.abs(nPay), Math.abs(escDed)) : 0);
              drvTollsAdj = (['OO', 'LOO', 'LPOO'].includes(d.contractType || '') ? dTollsRaw : 0);
              drvCashAdv = dCash;
              drvCpmAdj = dRevCpm * dMiles;
              drvFuelAdj = (d.name === 'Garland Jermaine Norris' ? 0 : (['MCLOO', 'OO', 'LOO', 'LPOO', 'MCOO'].includes(d.contractType || '') ? fSaved : -fSpent));
          } else {
              drvEscrowAdj = 0;
              drvTollsAdj = Math.abs(dTollsRaw) * 0.3;
              drvCpmAdj = dRevCpm * dMiles;
              drvFuelAdj = fSaved;
          }
      }

      drvRevBase *= mileCapFactor;
      
      drvZeroMiDrop = 0;
      if (dMiles === 0) {
          const prorated = drvTruckFloat + drvTruckWkly + drvOccIns + drvEld + drvIfta + drvMaintSupport + drvLiability + drvTruckPhd + drvTrailer + drvTrailerPhd;
          let effectiveBalChangeForPreDrop = drvBalanceChange;
          if (isFranchise && !(d as any).isFranchiseStub) {
               effectiveBalChangeForPreDrop = 0;
          }
          const stubBase = rBase * mileCapFactor;
          const preDrop = (d as any).isFranchiseStub ? (stubBase + effectiveBalChangeForPreDrop + prorated) : (drvRevBase + effectiveBalChangeForPreDrop + prorated);
          if (preDrop > 0) {
              drvZeroMiDrop = -preDrop;
          }
      }

      pnlRevBase += drvRevBase * companyTakeMulti;
      pnlFranchiseBase += drvFranchiseBase * companyTakeMulti;
      pnlPoDeductions += drvPoDeductions * companyTakeMulti;
      pnlPoSettle += drvPoSettle * companyTakeMulti;
      pnlNegNetPay += drvNegNetPay * companyTakeMulti;
      let drvStrictNegNetPay = 0;
      if (isFranchise) {
          if ((d as any).isFranchiseStub) drvStrictNegNetPay = nPay < 0 ? nPay : 0;
          else drvStrictNegNetPay = 0;
      } else {
          drvStrictNegNetPay = nPay < 0 ? nPay : 0;
      }
      pnlStrictNegNetPay += drvStrictNegNetPay * companyTakeMulti;
      pnlBalanceSettle += drvBalanceSettle * companyTakeMulti;
      pnlBalanceChange += drvBalanceChange * companyTakeMulti;
      
      if (isFranchise && !(d as any).isFranchiseStub) {
          pnlExcludedBalanceChange += drvBalanceChange * companyTakeMulti;
      } else {
          pnlIncludedBalanceChange += drvBalanceChange * companyTakeMulti;
      }
      
      pnlTruckFloat += drvTruckFloat * companyTakeMulti;
      pnlTruckWkly += drvTruckWkly * companyTakeMulti;
      pnlOccIns += drvOccIns * companyTakeMulti;
      pnlEld += drvEld * companyTakeMulti;
      pnlIfta += drvIfta * companyTakeMulti;
      pnlMaintSupport += drvMaintSupport * companyTakeMulti;
      pnlLiability += drvLiability * companyTakeMulti;
      pnlTruckPhd += drvTruckPhd * companyTakeMulti;
      pnlTrailer += drvTrailer * companyTakeMulti;
      pnlTrailerPhd += drvTrailerPhd * companyTakeMulti;
      pnlEscrowAdj += drvEscrowAdj * companyTakeMulti;
      pnlTollsAdj += drvTollsAdj * companyTakeMulti;
      pnlCashAdv += drvCashAdv * companyTakeMulti;
      pnlCpmAdj += drvCpmAdj * companyTakeMulti;
      pnlFuelAdj += drvFuelAdj * companyTakeMulti;
      pnlZeroMiDrop += drvZeroMiDrop * companyTakeMulti;
      
      pnlProrated += (drvTruckFloat + drvTruckWkly + drvOccIns + drvEld + drvIfta + drvMaintSupport + drvLiability + drvTruckPhd + drvTrailer + drvTrailerPhd) * companyTakeMulti;

      let effectiveBalChangeForCompanyPay = drvBalanceChange;
      if (isFranchise && !(d as any).isFranchiseStub) {
           effectiveBalChangeForCompanyPay = 0;
      }

      const calculatedDCompanyPay = (
          drvRevBase + 
          effectiveBalChangeForCompanyPay + 
          drvTruckFloat + drvTruckWkly + drvOccIns + drvEld + drvIfta + drvMaintSupport + drvLiability + drvTruckPhd + drvTrailer + drvTrailerPhd + 
          drvZeroMiDrop + 
          drvEscrowAdj + 
          drvTollsAdj + 
          drvCashAdv + 
          drvCpmAdj + 
          drvFuelAdj
      ) * companyTakeMulti + (d.fullSharedLiability || 0);

      companyPay += calculatedDCompanyPay;
      if (activeItems.includes('revenue_collected')) pnlCompanyPay += calculatedDCompanyPay;
  });

  const cogs = driverPay + fuel + maint + tolls + faults;

  const allocatedFixed = baseFixed + adjFixed;
  const pnlAllocatedFixed = pnlBaseFixed + pnlAdjFixed;
  const totalFixedPerUnit = effCount > 0 ? (allocatedFixed / effCount) : 0;

  const netIncome = pnlCompanyPay + pnlFuelRebate + pnlDispGrossAmount + pnlDispMarginAmount - pnlAllocatedFixed - Math.abs(pnlTotalPOCov) - Math.abs(pnlTotalRecruiting) - Math.abs(pnlTolls);
  const pnlPerDriver = effNonTeams > 0 ? netIncome / effNonTeams : 0;

  return {
    rawEffCount, effCount, effNonTeamsCount, effTrailersCount, gross, margin, fuelSavings, companyPay, cogs, allocatedFixed, baseFixed, adjFixed, netIncome, pnlPerDriver,
    driverPay, fuel, maint, tolls, faults, dispatcherPay, dispGrossAmount, dispMarginAmount, dispSharedLiability, dispFixedAmount, fullSharedLiability, totalFixedPerUnit,
    totalPO, totalPOCov, totalEscrow, totalBalance, totalRecruiting,
    effNonTeams, currentPayDate,
    numOfTrucks, avgTruckPrice, numOfTrailers, avgTrailerPrice, truckUtilization, trailerUtilization, totalCalculatedTrucks, totalCalculatedTrailers,
    rawFinImportData, effNonTeamsForTrucks: effNonTeamsNoOOCount,
    insuranceExp, insLiabAuto, insLiabGen, insCargo, insLeaseGapCoverage, insTrailerInterchange, insLago, insPhdPremium, insPhdTruck, insPhdTrailer, fuelRebate, poBreakdown, sharedInsBreakdown, dispBreakdown,
    fcTruck, fcCpm, fcTrailer, fcPlates, fcTelematics, fcPhone, fcOffice, fcRent, fcBackupMc, fcBoReg, fcBoTech, fcFactoring,
    pnlCompanyPay, pnlFuelRebate, pnlAllocatedFixed, pnlTotalPOCov, pnlTotalRecruiting, pnlTolls, pnlDispGrossAmount, pnlDispMarginAmount,
    pnlRevBase, pnlFranchiseBase, pnlPoDeductions, pnlPoSettle, pnlNegNetPay, pnlStrictNegNetPay, pnlBalanceSettle, pnlBalanceChange, pnlExcludedBalanceChange, pnlIncludedBalanceChange, pnlTruckFloat, pnlTruckWkly, pnlOccIns, pnlEld, pnlIfta, pnlMaintSupport, pnlLiability, pnlTruckPhd, pnlTrailer, pnlTrailerPhd, pnlEscrowAdj, pnlTollsAdj, pnlCashAdv, pnlCpmAdj, pnlFuelAdj, pnlProrated, pnlZeroMiDrop
  };
};
