import { createClient } from '@supabase/supabase-js';
import { ExpenseItem } from '../types';

// Credentials provided by user
const PROVIDED_URL = 'https://riusfiabohejenwumxqi.supabase.co';
const PROVIDED_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdXNmaWFib2hlamVud3VteHFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0Njg5NDcsImV4cCI6MjA4MTA0NDk0N30.lTYHn6xrvzio-72GVurMXap34mDbjP8e45wHFoB10_g';

// Fallback logic simplified to be robust across environments
let supabaseUrl = PROVIDED_URL;
let supabaseAnonKey = PROVIDED_KEY;

if (typeof process !== 'undefined' && process.env) {
  if (process.env.VITE_SUPABASE_URL) supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (process.env.VITE_SUPABASE_ANON_KEY) supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = () => {
  return supabaseUrl !== '' && supabaseAnonKey !== '';
};

// Helper to expose config to UI for G-Sheet setup
export const getSupabaseConfig = () => ({
  url: supabaseUrl,
  key: supabaseAnonKey,
  tableName: 'driver_records'
});

// -- Fixed Expenses API -

export const fetchFixedExpenses = async (): Promise<ExpenseItem[] | null> => {
  const { data, error } = await supabase
    .from('fixed_expenses')
    .select('*')
    .order('amount', { ascending: false });

  if (error) {
    console.error('Error fetching expenses:', error);
    return null;
  }
  return data.map((d: any) => ({
        ...d,
        companyId: d.company_id,
        allocationType: d.allocationType || 'global'
      })) as ExpenseItem[];
};

export const saveFixedExpenses = async (expenses: ExpenseItem[]): Promise<boolean> => {
  const { data: currentExpenses } = await supabase.from('fixed_expenses').select('id');
  const currentIds = currentExpenses?.map(e => String(e.id)) || [];
  const newIds = expenses.map(e => String(e.id));
  const idsToDelete = currentIds.filter(id => !newIds.includes(id));

  if (idsToDelete.length > 0) {
    await supabase.from('fixed_expenses').delete().in('id', idsToDelete);
  }

  const toUpdate: any[] = [];
  const toInsert: any[] = [];

 expenses.forEach(exp => {
    const { companyId, id, liability_comp_pct, liability_fran_pct, liability_disp_pct, company_perc, franchise_perc, dispatcher_perc, ...rest } = exp as any;
    const out: any = { 
        ...rest, 
        company_id: companyId || rest.company_id,
        company_perc: company_perc !== undefined ? company_perc : (liability_comp_pct !== undefined && liability_comp_pct !== '' ? Number(liability_comp_pct) : null),
        franchise_perc: franchise_perc !== undefined ? franchise_perc : (liability_fran_pct !== undefined && liability_fran_pct !== '' ? Number(liability_fran_pct) : null),
        dispatcher_perc: dispatcher_perc !== undefined ? dispatcher_perc : (liability_disp_pct !== undefined && liability_disp_pct !== '' ? Number(liability_disp_pct) : null)
    };

    Object.keys(out).forEach(key => {
        if (out[key] === '') {
            out[key] = null;
        }
    });

    if (id && currentIds.includes(String(id))) {
                out.id = id;
                toUpdate.push(out);
            } else {
                if (id && String(id) !== 'undefined') out.id = id;
                toInsert.push(out);
            }
  });

  if (toUpdate.length > 0) {
      await supabase.from('fixed_expenses').upsert(toUpdate);
  }
  
  if (toInsert.length > 0) {
      await supabase.from('fixed_expenses').insert(toInsert);
  }

  return true;
};

export const fetchConfigContracts = async () => {
  const { data } = await supabase.from('config_contracts').select('*');
  return data || [];
};

export const saveConfigContracts = async (configs: any[]) => {
  const { data: currentData } = await supabase.from('config_contracts').select('id');
  const currentIds = currentData?.map(c => String(c.id)) || [];
  
  const validIdsToKeep = configs.map(c => String(c.id)).filter(id => currentIds.includes(id));
  const idsToDelete = currentIds.filter(id => !validIdsToKeep.includes(id));

  if (idsToDelete.length > 0) {
    await supabase.from('config_contracts').delete().in('id', idsToDelete);
  }

  const toUpdate: any[] = [];
  const toInsert: any[] = [];

  configs.forEach(c => {
     const { id, ...rest } = c;
     const out: any = { ...rest };

     out.contract_type = out.contract_type || 'NEW';
     out.calculation_type = out.calculation_type || 'PERCENT_TOTAL';
     out.mc_gross_percent = (out.mc_gross_percent === '' || out.mc_gross_percent == null) ? 0 : Number(out.mc_gross_percent);
     out.mc_margin_percent = (out.mc_margin_percent === '' || out.mc_margin_percent == null) ? 0 : Number(out.mc_margin_percent);
     out.dispatcher_gross_percent = (out.dispatcher_gross_percent === '' || out.dispatcher_gross_percent == null) ? 0 : Number(out.dispatcher_gross_percent);
     out.valid_from = out.valid_from || new Date().toISOString().split('T')[0];

     if (out.valid_to === '') out.valid_to = null;

     if (id && currentIds.includes(String(id))) {
         out.id = id;
         toUpdate.push(out);
     } else {
         toInsert.push(out);
     }
  });

  if (toUpdate.length > 0) {
      const { error } = await supabase.from('config_contracts').upsert(toUpdate);
      if (error) console.error("Update config_contracts error:", JSON.stringify(error, null, 2));
  }

  if (toInsert.length > 0) {
      const { error } = await supabase.from('config_contracts').insert(toInsert);
      if (error) console.error("Insert config_contracts error:", JSON.stringify(error, null, 2));
  }
};

export const fetchPnlConfigs = async () => {
  const { data } = await supabase.from('pnl_editor').select('*');
  return data || [];
};

export const savePnlConfigs = async (configs: any[]) => {
  const { data: currentData } = await supabase.from('pnl_editor').select('id');
  const currentIds = currentData?.map(c => String(c.id)) || [];
  
  const validIdsToKeep = configs.map(c => String(c.id)).filter(id => currentIds.includes(id));
  const idsToDelete = currentIds.filter(id => !validIdsToKeep.includes(id));

  if (idsToDelete.length > 0) {
    await supabase.from('pnl_editor').delete().in('id', idsToDelete);
  }

  const toUpdate: any[] = [];
  const toInsert: any[] = [];

  configs.forEach(c => {
     const { id, ...rest } = c;
     const out: any = { ...rest };
     if (id && currentIds.includes(String(id))) {
         out.id = id;
         toUpdate.push(out);
     } else {
         toInsert.push(out);
     }
  });

  if (toUpdate.length > 0) {
      await supabase.from('pnl_editor').upsert(toUpdate);
  }
  if (toInsert.length > 0) {
      await supabase.from('pnl_editor').insert(toInsert);
  }
};


