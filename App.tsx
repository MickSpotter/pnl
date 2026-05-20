import React, { useState, useMemo, useEffect, ErrorInfo, ReactNode } from 'react';
import {
    Users,
    Settings,
    ChevronDown,
    LogOut,
    Building2,
    PieChart,
    Truck,
    Database,
    ChevronLeft,
    ChevronRight,
    Filter,
    Eye,
    EyeOff
  } from 'lucide-react';
import DriverTable from './components/DriverTable';
import DispatcherTable from './components/DispatcherTable';
import FranchiseTable from './components/FranchiseTable';
import SettingsView from './components/SettingsView';
import PnLView from './components/PnLView';
import { COMPANY_FIXED_EXPENSES, DEFAULT_SIMULATION_CONFIG } from './constants';
import { UserRole, SimulationConfig, DriverPerformance, ExpenseItem, DriverStatus, SupabaseDriverRecord, FinImportRecord, ConfigContract } from './types';
import { supabase, isSupabaseConfigured, fetchFixedExpenses, saveFixedExpenses, fetchConfigContracts } from './lib/supabase';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Simple Error Boundary to catch runtime crashes
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-300 p-4 font-sans">
          <div className="bg-zinc-900 p-6 rounded-lg border border-zinc-800 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-sm text-zinc-500 mb-4">The application encountered an error while rendering.</p>
            <div className="bg-black/50 p-3 rounded text-xs font-mono text-rose-400 mb-6 overflow-auto max-h-32">
              {this.state.error?.message || "Unknown Error"}
            </div>
            <button 
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium transition-colors text-sm"
            >
              Reset App Data & Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const LoadingScreen = ({ progress }: { progress: number }) => {
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayProgress(prev => {
        if (progress === 100) return 100;
        if (prev >= 98) return prev;

        const jump = Math.floor(Math.random() * 20) + 10;
        const next = prev + jump;

        return next >= 98 ? 98 : next;
      });
    }, 400); 

    return () => clearInterval(interval);
  }, [progress]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-900/20 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-48 h-48 mb-8 relative flex items-center justify-center">
          <div className="absolute inset-0 border-t-2 border-emerald-500 rounded-full animate-spin" style={{ animationDuration: '1.5s' }}></div>
          <div className="absolute inset-2 border-r-2 border-blue-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '2s' }}></div>
          <div className="absolute inset-4 border-b-2 border-indigo-500 rounded-full animate-spin" style={{ animationDuration: '3s' }}></div>
          <div className="absolute inset-8 flex items-center justify-center">
            <img src="https://i.postimg.cc/ryjhgvGq/Default-Make-a-logo-for-Profit-and-Loss-application-portal-It-2-a128667d-b54d-44ca-bb4d-32ac1ddb5c95.png" alt="PnL Logo" className="w-full h-full object-contain drop-shadow-2xl" referrerPolicy="no-referrer" />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-emerald-500 font-mono font-bold w-10 text-right">{displayProgress}%</span>
          <span className="text-zinc-400 text-xs font-mono tracking-wider uppercase">Syncing Data</span>
        </div>
      </div>
    </div>
  );
};

const HARDCODED_DISPATCHER_TIERS = [
  { id: '1', tier_name: 'STARTING', min_tpog_percent: 0, max_tpog_percent: 25, dispatcher_share_percent: 0.5, company_share_percent: 0.5, valid_from: '2020-01-01' },
  { id: '2', tier_name: 'MIDDLE', min_tpog_percent: 25, max_tpog_percent: 32, dispatcher_share_percent: 0.75, company_share_percent: 0.25, valid_from: '2020-01-01' },
  { id: '3', tier_name: 'STREAK', min_tpog_percent: 32, max_tpog_percent: 999, dispatcher_share_percent: 1, company_share_percent: 0, valid_from: '2020-01-01' }
];

const HARDCODED_GLOBAL_RULES = [
  { id: '1', dispatcher_base_gross_percent: 2.0, dispatcher_base_margin_percent: 20.0, franchise_split_percent: 50.0, valid_from: '2020-01-01' }
];

const AppContent: React.FC<{ session: any }> = ({ session }) => {
  const [currentRole, setCurrentRole] = useState<UserRole>(UserRole.ADMIN);
  const [activeTab, setActiveTab] = useState<'financials' | 'drivers' | 'dispatchers' | 'franchises' | 'settings'>('financials');
  
  // Unified Filter State: "ALL" | "CMP:id" | "FR:id" | "TM:id"
  const [globalFilter, setGlobalFilter] = useState<any>({ contracts: [], franchises: [], companies: [], teams: [], drivers: [] });
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // -- STATE MANAGEMENT --
  
  // 1. Simulation Config (Safe Load)
  const [simulationConfig, setSimulationConfig] = useState<SimulationConfig>(() => {
    try {
      const saved = localStorage.getItem('tpog_sim_config');
      return saved ? JSON.parse(saved) : DEFAULT_SIMULATION_CONFIG;
    } catch (e) {
      return DEFAULT_SIMULATION_CONFIG;
    }
  });

  // 2. Fixed Expenses (Init with constants, then fetch from DB)
  const [fixedExpenses, setFixedExpenses] = useState<ExpenseItem[]>(COMPANY_FIXED_EXPENSES);
  
  const [configContracts, setConfigContracts] = useState<ConfigContract[]>([]);
 

  const [rawDrivers, setRawDrivers] = useState<Partial<DriverPerformance>[]>([]);
  const [finImportData, setFinImportData] = useState<FinImportRecord[]>([]);
  const [fixedCostsData, setFixedCostsData] = useState<any[]>([]);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isDashboardReady, setIsDashboardReady] = useState(false);

  // -- EFFECTS --
  
  useEffect(() => {
    localStorage.setItem('tpog_sim_config', JSON.stringify(simulationConfig));
  }, [simulationConfig]);

  

  // Save handler passed down to Modal
  const handleSaveExpenses = async (newExpenses: ExpenseItem[]) => {
    setFixedExpenses(newExpenses);
    if (isSupabaseConfigured()) {
      await saveFixedExpenses(newExpenses);
    }
  };

  const fetchLock = React.useRef(false);

  const fetchData = async () => {
    if (fetchLock.current) return;
    
    if (!isSupabaseConfigured()) {
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

    fetchLock.current = true;
    setIsLoading(true);
    setLoadingProgress(5);
    try {
      let allData: any[] = [];
      const limit = 10000;
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from('pnl_table')
          .select('*')
          .order('pay_date', { ascending: false })
          .order('driver_name', { ascending: true })
          .range(from, from + limit - 1);

        if (error) {
          break;
        }

        if (data && data.length > 0) {
          allData.push(...data);
          if (data.length < limit) break;
          from += limit;
          setLoadingProgress(Math.min(95, Math.round((allData.length / 5000) * 95)));
        } else {
          break;
        }
      }

      const confContractsPromise = fetchConfigContracts();
      const fixedExpensesPromise = fetchFixedExpenses();
      const finResPromise = supabase.from('finImport').select('*').limit(1000);
      
      const fixedCostsPromise = supabase.from('fixed_costs').select('*').order('pay_date', { ascending: false });

      const [finRes, confC, dbExpenses, fixedCostsRes] = await Promise.all([
        finResPromise,
        confContractsPromise,
        fixedExpensesPromise,
        fixedCostsPromise
      ]);
      
      if (fixedCostsRes && fixedCostsRes.data) {
        setFixedCostsData(fixedCostsRes.data);
      }

      setConfigContracts(confC);
      if (dbExpenses && dbExpenses.length > 0) {
         setFixedExpenses(dbExpenses);
      }

      if (finRes.data) {
        setFinImportData(finRes.data as FinImportRecord[]);
      }
      
      setLoadingProgress(100);
      await new Promise(resolve => setTimeout(resolve, 500));

      if (allData.length > 0) {
        setIsConnected(true);
        
        const mappedDrivers: Partial<DriverPerformance>[] = allData.map((row: any) => {
          const dbCalculatedFixed = 0;
          
          return {
            id: row.contract_id || String(Math.random()),
            name: row.driver_name,
            companyId: row.company_name || 'UNRECONCILED',
            contractType: row.contract_type || 'Unassigned',
            contract_calc: row.contract_calc,
            franchiseId: row.franchise_name,
            dispatcherId: row.stub_dispatcher,
            teamId: row.stub_team,
            status: String(row.status || '').toLowerCase().trim().includes('term') ? DriverStatus.TERMINATED : DriverStatus.ACTIVE,
            weeksActive: 1,
            streakWeeks: 0,
            payDate: row.pay_date,
            milesDriven: Number(row.total_miles) > 0 ? Number(row.total_miles) : 0,
            grossRevenue: Number(row.driver_gross || 0),
            totalGross: Number(row.driver_gross || 0) + Number(row.margin || 0),
            grossPay: 0,
            companyPay: Number(row.revenue_collected || 0),
            marginAmount: Number(row.margin || 0),
            calculatedFixedCost: dbCalculatedFixed,
             fixed_costs: Number(row.fixed_costs || 0),
              fuelSavings: Number(row.fuel_saved || 0),
              franchise_revenue_collected: Number(row.franchise_revenue || 0),
              franchise_po: Number(row.franchise_po || 0),
              baseFuelCost: 0,
            tollCost: Number(row.tolls_amount || 0) !== 0 ? -Math.abs(Number(row.tolls_amount || 0)) : 0,
             baseMaintenanceCost: 0,
             baseDriverFaultExpenses: 0,
             netPay: Number(row.net_pay || 0),
             fuelUsed: 0,
             fuel_quantity: row.fuel_quantity ? Number(String(row.fuel_quantity).replace(/,/g, '')) : 0,
             fuelCost: Number(row.fuel_spent || 0),
            tollCost: Number(row.tolls_amount || 0) !== 0 ? -Math.abs(Number(row.tolls_amount || 0)) : 0,
            maintenanceCost: 0,
            driverFaultExpenses: 0,
            escrowBalance: Number(row.escrow_needed || 0),
            negativeBalance: Number(row.balance || 0) < 0 ? Number(row.balance) : 0,
            poAmount: 0,
            poCoverage: Number(row.total_po_comp_covered || 0),
            driverPoCoverage: Number(row.total_po_comp_covered || 0),
            po_breakdown: typeof row.po_breakdown === 'string' ? (()=>{try{return JSON.parse(row.po_breakdown);}catch(e){return {};}})() : (row.po_breakdown || {}),
            franchise_po_breakdown: typeof row.franchise_po_breakdown === 'string' ? (()=>{try{return JSON.parse(row.franchise_po_breakdown);}catch(e){return {};}})() : (row.franchise_po_breakdown || {}),
            balanceTotal: Number(row.balance || 0),
            recruitingCost: Number(row.recruiting || 0),
            effectiveDrivers: Number(row.effective_drivers || 0),
            effectiveNonTeams: Number(row.eff_non_teams || 0),
            effectiveTrailers: Number(row.eff_trailers || 0),
            numOfTrucks: Number(row.num_of_trucks || 0),
            avgTruckPrice: Number(row.avg_truck_price || 0),
            pnl4wSum: Number(row.pnl_4w_sum || 0),
            pnl4wAvg: Number(row.pnl_4w_avg || 0),
            revenue_base: Number(row.revenue_base || 0),
            po_deductions: Number(row.po_deductions || 0),
            po_settle: Number(row.po_settle || 0),
            balance_settle: Number(row.balance_settle || 0),
            truck_float: Number(row.truck_float || 0),
            truck_wkly: Number(row.truck_wkly || 0),
            occ_ins: Number(row.occ_ins || 0),
            eld: Number(row.eld || 0),
            ifta: Number(row.ifta || 0),
            maintenance_support: Number(row.maintenance_support || 0),
            liability: Number(row.liability || 0),
            truck_phd: Number(row.truck_phd || 0),
            trailer: Number(row.trailer || 0),
            trailer_phd: Number(row.trailer_phd || 0),
            escrowDeduct: Number(row.escrow_deduct || 0),
            tolls: Number(row.tolls || 0),
            cashAdvancePercent: Number(row.cash_advance_percent || 0),
            revenueCpm: Number(row.revenue_cpm || 0),
            revWithoutFuel: Number(row.rev_without_fuel || 0),
            franchiseRevCappedBal: Number(row.franchise_rev_capped_bal || 0)
          };
        });

        const validDates = new Set();
        mappedDrivers.forEach(d => {
          if (d.companyPay && Math.abs(d.companyPay) > 0) {
            validDates.add(d.payDate);
          }
        });
        
        setRawDrivers(mappedDrivers.filter(d => validDates.has(d.payDate)));
      } else {
        setIsConnected(false);
      }
    } catch (err) {
      setIsConnected(false);
    } finally {
      setIsLoading(false);
      setLastUpdated(new Date());
      fetchLock.current = false;
    }
  };
  useEffect(() => {
    fetchData();

    if (!isSupabaseConfigured()) return;

    const realtimeChannel = supabase
      .channel('app-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pnl_table' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finImport' }, () => {
        fetchData();
      })

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, []);

  const simulatedDrivers = useMemo(() => {
    return rawDrivers as DriverPerformance[];
  }, [rawDrivers]);

  // Extract unique lists for Dropdown
  

  const uniqueFranchises = useMemo(() => 
    Array.from(new Set(simulatedDrivers.map(d => d.franchiseId))).filter(Boolean).sort(),
  [simulatedDrivers]);

  const uniqueCompanies = useMemo(() => 
    Array.from(new Set(simulatedDrivers.map(d => d.companyId))).filter(Boolean).sort(),
  [simulatedDrivers]);

  const uniqueTeams = useMemo(() => 
    Array.from(new Set(simulatedDrivers.map(d => d.teamId))).filter(Boolean).sort(),
  [simulatedDrivers]);

  // 2. Filter Logic
  const filteredDrivers = useMemo(() => {
    let drivers = simulatedDrivers;

    if (globalFilter?.contracts?.length > 0) {
      drivers = drivers.filter(d => d.contractType && globalFilter.contracts.includes(d.contractType));
    }
    if (globalFilter?.franchises?.length > 0) {
      drivers = drivers.filter(d => d.franchiseId && globalFilter.franchises.includes(d.franchiseId));
    }
    if (globalFilter?.companies?.length > 0) {
      drivers = drivers.filter(d => d.companyId && globalFilter.companies.includes(d.companyId));
    }
    if (globalFilter?.teams?.length > 0) {
      drivers = drivers.filter(d => d.teamId && globalFilter.teams.includes(d.teamId));
    }
    if (globalFilter?.drivers?.length > 0) {
      drivers = drivers.filter(d => d.name && globalFilter.drivers.includes(d.name));
    }

    if (currentRole === UserRole.FRANCHISE) {
      drivers = drivers.filter(d => d.franchiseId === 'FR-01'); 
    }
    return drivers;
  }, [globalFilter, currentRole, simulatedDrivers]);

  const latestPayDate = useMemo(() => {
    const dates = Array.from(new Set(simulatedDrivers.map(d => d.payDate).filter(Boolean)));
    return dates.sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0] || null;
  }, [simulatedDrivers]);

  const currentWeekDrivers = useMemo(() => {
    if (!latestPayDate) return filteredDrivers;
    return filteredDrivers.filter(d => d.payDate === latestPayDate);
  }, [filteredDrivers, latestPayDate]);

  const showLoading = isLoading || (activeTab === 'financials' && !isDashboardReady && rawDrivers.length > 0);

  return (
    <>
      {showLoading && <LoadingScreen progress={isLoading ? loadingProgress : 100} />}
      <div className={`flex h-screen bg-zinc-950 text-zinc-300 font-sans overflow-hidden text-xs ${showLoading ? 'opacity-0 absolute inset-0 pointer-events-none' : ''}`}>
      
      {/* Sidebar - Collapsible */}
      <aside 
        className={`${isSidebarCollapsed ? 'w-20' : 'w-60'} border-r border-zinc-800 flex flex-col justify-between transition-all duration-300 flex-shrink-0 bg-zinc-950`}
      >
        <div>
          <div className={`h-20 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-start px-4'} border-b border-zinc-800 relative`}>
            <div className="flex items-center">
              <img src="https://i.postimg.cc/ryjhgvGq/Default-Make-a-logo-for-Profit-and-Loss-application-portal-It-2-a128667d-b54d-44ca-bb4d-32ac1ddb5c95.png" alt="PnL Logo" className="w-16 h-16 object-contain drop-shadow-lg" referrerPolicy="no-referrer" />
            </div>
            
            <button 
              onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
              className={`text-zinc-500 hover:text-white transition-colors absolute right-3 ${isSidebarCollapsed ? 'hidden' : 'block'}`}
            >
              {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          <nav className="p-2 space-y-0.5">
             {/* Mobile/Collapsed Toggle Button if needed at top */}
             {isSidebarCollapsed && (
               <button 
                onClick={() => setSidebarCollapsed(false)}
                className="w-full flex items-center justify-center p-2 mb-2 text-zinc-500 hover:text-white"
               >
                 <ChevronRight size={14} />
               </button>
             )}

            {currentRole !== UserRole.DISPATCHER && (
              <button 
                onClick={() => setActiveTab('financials')}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-2' : 'p-2 px-3'} rounded transition-all ${activeTab === 'financials' ? 'bg-zinc-800 text-white shadow-inner' : 'hover:bg-zinc-900/50 text-zinc-500'}`}
                title="Financials"
              >
                <PieChart size={16} />
                {!isSidebarCollapsed && <span className="ml-3 font-medium">Financials</span>}
              </button>
            )}

            <button 
              onClick={() => setActiveTab('drivers')}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-2' : 'p-2 px-3'} rounded transition-all ${activeTab === 'drivers' ? 'bg-zinc-800 text-white shadow-inner' : 'hover:bg-zinc-900/50 text-zinc-500'}`}
              title="Drivers"
            >
              <Truck size={16} />
              {!isSidebarCollapsed && <span className="ml-3 font-medium">Drivers</span>}
            </button>
            
            <button 
              onClick={() => setActiveTab('dispatchers')}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-2' : 'p-2 px-3'} rounded transition-all ${activeTab === 'dispatchers' ? 'bg-zinc-800 text-white shadow-inner' : 'hover:bg-zinc-900/50 text-zinc-500'}`}
              title="Dispatchers"
            >
              <Users size={16} />
              {!isSidebarCollapsed && <span className="ml-3 font-medium">Dispatchers</span>}
            </button>
            
            <button 
              onClick={() => setActiveTab('franchises')}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-2' : 'p-2 px-3'} rounded transition-all ${activeTab === 'franchises' ? 'bg-zinc-800 text-white shadow-inner' : 'hover:bg-zinc-900/50 text-zinc-500'}`}
              title="Franchises"
            >
              <Building2 size={16} />
              {!isSidebarCollapsed && <span className="ml-3 font-medium">Franchises</span>}
            </button>

            <button 
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-2' : 'p-2 px-3'} rounded transition-all ${activeTab === 'settings' ? 'bg-zinc-800 text-white shadow-inner' : 'hover:bg-zinc-900/50 text-zinc-500'}`}
              title="Settings"
            >
              <Settings size={16} />
              {!isSidebarCollapsed && <span className="ml-3 font-medium">Settings</span>}
            </button>
          </nav>
        </div>

        <div className="mt-auto border-t border-zinc-800 bg-zinc-950/50">
          <div className={`p-3 ${isSidebarCollapsed ? 'flex justify-center' : ''}`}>
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-3 mb-3">
                <div className="overflow-hidden">
                  <div className="text-[11px] font-bold text-zinc-200 truncate">
                    {session?.user?.email?.split('@')[0]}
                  </div>
                  <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-tight">
                    {currentRole}
                  </div>
                </div>
              </div>
            )}
            
            <button 
              onClick={() => supabase.auth.signOut()} 
              className={`flex items-center text-zinc-500 hover:text-rose-400 transition-colors w-full ${isSidebarCollapsed ? 'justify-center py-2' : 'gap-2 text-[10px] py-1'}`}
            >
              <LogOut size={14} />
              {!isSidebarCollapsed && <span className="font-bold uppercase tracking-wider">Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {activeTab !== 'financials' && (
          <header className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-950/50 backdrop-blur-sm z-10 sticky top-0">
            <div className="flex items-center gap-3">
               <h1 className="text-sm font-semibold text-white capitalize">
                 {activeTab}
               </h1>
               {simulationConfig.fuelSurchargePercent > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-950 border border-blue-900 text-[10px] text-blue-400 font-mono">
                     Sim Active
                  </span>
               )}
            </div>
            <div className="flex items-center gap-3">
            </div>
          </header>
        )}

        {/* Content Body - Minimal Padding */}
        <div className="flex-1 overflow-auto p-2 lg:p-3 relative">
          <div className="w-full h-full">
            
           {activeTab === 'financials' && (
              <PnLView 
                  allDrivers={simulatedDrivers}
                  drivers={filteredDrivers} 
                  simulationConfig={simulationConfig}
                  setSimulationConfig={setSimulationConfig}
                  fixedExpenses={fixedExpenses}
                  setFixedExpenses={setFixedExpenses}
                  onSaveExpenses={handleSaveExpenses} 
                  finImportData={finImportData}
                  fixedCostsData={fixedCostsData}
                  configContracts={configContracts}
                  setConfigContracts={setConfigContracts}
                  onReady={() => setIsDashboardReady(true)}
                  onDataSync={fetchData}
                  globalFilter={globalFilter}
                  setGlobalFilter={setGlobalFilter}
                  currentRole={currentRole}
                />
            )}

            {activeTab === 'drivers' && (
              <div className="flex flex-col h-full">
                <DriverTable drivers={filteredDrivers} />
              </div>
            )}

            {activeTab === 'dispatchers' && (
              <DispatcherTable drivers={filteredDrivers} />
            )}

            {activeTab === 'franchises' && (
              <FranchiseTable drivers={filteredDrivers} simulationConfig={simulationConfig} />
            )}

            {activeTab === 'settings' && (
              <SettingsView onDataSync={fetchData} />
            )}
            
          </div>
        </div>
      </main>
    </div>
    </>
  );
};

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError(error.message);
    setLoading(false);
  };

  if (authChecking) {
    return <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-300">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-900/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 mb-6 relative flex items-center justify-center">
              <div className="absolute inset-0 border-t-2 border-emerald-500/50 rounded-full animate-spin" style={{ animationDuration: '3s' }}></div>
              <img src="https://i.postimg.cc/ryjhgvGq/Default-Make-a-logo-for-Profit-and-Loss-application-portal-It-2-a128667d-b54d-44ca-bb4d-32ac1ddb5c95.png" alt="Logo" className="w-16 h-16 object-contain drop-shadow-2xl" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Access Portal</h1>
            <p className="text-sm text-zinc-500 mt-2">Enter your credentials to continue</p>
          </div>
          <form onSubmit={handleLogin} className="bg-zinc-900/80 backdrop-blur-xl p-8 rounded-2xl border border-zinc-800/80 shadow-2xl">
            <div className="space-y-5">
              {loginError && (
                <div className="text-rose-500 text-sm font-bold text-center">
                  {loginError}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-sm text-white rounded-lg px-4 py-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all placeholder:text-zinc-600" placeholder="admin@tpog.com" required />
              </div>
             <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Password</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-sm text-white rounded-lg px-4 py-3 pr-10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all placeholder:text-zinc-600" placeholder=" " required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold py-3 rounded-lg transition-all disabled:opacity-50 mt-4 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)]">
                {loading ? 'Authenticating...' : 'Secure Sign In'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

 return (
    <ErrorBoundary>
      <AppContent session={session} />
    </ErrorBoundary>
  );
};

export default App;