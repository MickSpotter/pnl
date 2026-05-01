

import { ExpenseItem, DriverPerformance, DriverStatus, User, UserRole } from './types';

export const DEFAULT_SIMULATION_CONFIG = {
  maintenancePerMile: 0.15,
  fuelSurchargePercent: 0,
  driverFaultMultiplier: 1.0,
  globalFixedExpenseAdjustment: 0,
  dispatcherBaseGrossPercent: 2.0,
  dispatcherBaseMarginPercent: 20.0,
  franchiseSplitPercent: 50.0,
};

// Updated Default Values based on user feedback
export const COMPANY_FIXED_EXPENSES: ExpenseItem[] = [
  { id: '3', category: 'Fixed', name: 'Physical Damage', amount: 0, frequency: 'Weekly', allocationType: 'per_unit' },
  { id: '2', category: 'Fixed', name: 'Cargo Insurance', amount: 0, frequency: 'Weekly', allocationType: 'per_unit' },
  { id: '10', category: 'Fixed', name: 'Plates', amount: 0, frequency: 'Weekly', allocationType: 'per_unit' },
  { id: '11', category: 'Fixed', name: 'ELD & Telematics', amount: 0, frequency: 'Weekly', allocationType: 'per_unit' },
  { id: '1', category: 'Fixed', name: 'Liability Insurance (Global)', amount: 0, frequency: 'Weekly', allocationType: 'global' },
  { id: '4', category: 'Fixed', name: 'Phone & Internet', amount: 0, frequency: 'Weekly', allocationType: 'global' }, 
  { id: '5', category: 'Fixed', name: 'Office Supplies & SaaS', amount: 0, frequency: 'Weekly', allocationType: 'global' },
  { id: '6', category: 'Fixed', name: 'Rent & Parking', amount: 0, frequency: 'Weekly', allocationType: 'global' },
  { id: '7', category: 'Fixed', name: 'Backup MCs', amount: 0, frequency: 'Weekly', allocationType: 'global' },
  { id: '8', category: 'Fixed', name: 'Backoffice Reg', amount: 0, frequency: 'Weekly', allocationType: 'global' },
  { id: '9', category: 'Fixed', name: 'Backoffice Tech', amount: 0, frequency: 'Weekly', allocationType: 'global' },
];

export const TOTAL_FIXED_WEEKLY = 0; // Calculated dynamically now



