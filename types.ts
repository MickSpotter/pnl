

export enum UserRole {
  ADMIN = 'Company Admin',
  FRANCHISE = 'Franchise Owner',
  DISPATCHER = 'Dispatcher',
}

export enum DriverStatus {
  ACTIVE = 'Active',
  TERMINATED = 'Terminated',
  ONBOARDING = 'Onboarding',
}

export enum DispatcherTier {
  STARTING = 'Starting (<25%)',
  MIDDLE = 'Middle (25-32%)',
  STREAK = 'Streak (>32%)',
}

export interface FinImportRecord {
  week_ending: string;
  num_of_trucks: number;
  avg_truck_price: number;
  num_of_trailers: number;
  avg_trailer_price: number;
  phone_and_internet?: number;
  office_supplies?: number;
  telematics?: number;
  rent_and_parking?: number;
  backup_mcs?: number;
  back_office_pay?: number;
  tech_pay?: number;
  liability_insurance?: number;
  cargo_insurance?: number;
  physical_damage?: number;
}



export interface ExpenseItem {
  id: string;
  category: 'Fixed' | 'Variable' | 'OneTime';
  name: string;
  companyId?: string;
  amount: number;
  cpm?: number;
  frequency: 'Weekly' | 'Monthly' | 'PerMile';
  allocationType: 'global' | 'per_unit';
  description?: string;
  threshold_date?: string;
  valid_from?: string;
  valid_to?: string;
  amount_before?: number;
  amount_after?: number;
      eff_count?: number;
      per_count_before?: number;
      per_count_after?: number;
      unit?: '$' | '%';
      shared_insurance?: number;
      company_base_for_mcloo?: number;
      mcloo_base_mode?: boolean;
}



export interface DriverPerformance {
  id: string;
  name: string;
  companyId: string;
  contractType: string;
  franchiseId: string;
  dispatcherId: string;
  teamId: string;
  status: DriverStatus;
  weeksActive: number;
  streakWeeks: number;
  
  // Weekly Metrics
    payDate?: string; // Added field for date filtering
    milesDriven: number;
    grossRevenue: number;
    totalGross?: number;
    grossPay: number; // Driver Pay before expenses
  companyPay: number; 
  marginAmount: number;
  fuelSavings: number;
  
  // Base Expenses (Raw inputs)
  baseFuelCost: number;
  baseTollCost: number;
  baseMaintenanceCost: number;
  baseDriverFaultExpenses: number;
  baseNetPay: number;
  fuelUsed: number;
  fuelCost: number;
  tollCost: number;
  maintenanceCost: number;
  driverFaultExpenses: number;
  
  netPay: number; 
  dispatcherCommission: number; 
  tpogPercentage: number; 
  contract_calc?: number;
  calculatedFixedCost?: number;
  fixed_costs?: number;
  
  // Balances
  escrowBalance: number;
  negativeBalance: number;
  
  poAmount: number;
  poCoverage: number;
  driverPoCoverage?: number;
  balanceTotal: number;
  effectiveDrivers: number;
  recruitingCost?: number;
  effectiveNonTeams: number;
  effectiveTrailers: number;
  numOfTrucks: number;
  avgTruckPrice: number;
  pnl4wSum?: number;
  pnl4wAvg?: number;
}

export interface SimulationConfig {
  maintenancePerMile: number;
  fuelSurchargePercent: number;
  driverFaultMultiplier: number;
  globalFixedExpenseAdjustment: number;
  dispatcherBaseGrossPercent: number;
  dispatcherBaseMarginPercent: number;
  franchiseSplitPercent: number;
}

export interface UserPermissions {
  canViewGlobalPnL: boolean;
  canEditFixedExpenses: boolean;
  canRunSimulations: boolean;
  canViewAllDrivers: boolean;
  canViewDispatcherStats: boolean;
  canManageUsers: boolean;
  canViewCompanies: boolean;
  canViewTeams: boolean;
  canViewFranchises: boolean;
  canViewSettings: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: UserPermissions;

}


export interface ConfigContract {
  id?: string;
  contract_type: string;
  calculation_type: string;
  mc_gross_percent: number;
  mc_margin_percent: number;
  dispatcher_gross_percent?: number;
  valid_from: string;
  valid_to?: string;
}




export interface ConfigGlobalRule {
  id?: string;
  dispatcher_base_gross_percent: number;
  dispatcher_base_margin_percent: number;
  franchise_split_percent: number;
  valid_from: string;
  valid_to?: string;
}