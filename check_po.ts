import { createClient } from '@supabase/supabase-js';

const PROVIDED_URL = 'https://riusfiabohejenwumxqi.supabase.co';
const PROVIDED_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdXNmaWFib2hlamVud3VteHFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0Njg5NDcsImV4cCI6MjA4MTA0NDk0N30.lTYHn6xrvzio-72GVurMXap34mDbjP8e45wHFoB10_g';

const supabase = createClient(PROVIDED_URL, PROVIDED_KEY);

async function check() {
  const { data: anyPoHist } = await supabase.from('po_hist').select('*').limit(20);
  console.log('po_hist sample:', anyPoHist.map(r => ({ driver: r.driver, pay_date: r.pay_date, id: r.paydate_contract_id })));

  const { data: summary } = await supabase.from('v_paydate_contract_summary').select('*').limit(5);
  console.log('summary:', summary);
}

check();
