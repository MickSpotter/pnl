import React, { useState, useEffect } from 'react';
import { User, UserPermissions } from '../types';
import { Trash2, Shield, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SettingsViewProps {
  onDataSync?: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onDataSync }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => { 
    fetchUsers(); 
    
    const channel = supabase
      .channel('users_realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload) => {
        setUsers(prev => prev.map(u => u.id === payload.new.id ? { ...u, ...payload.new } : u));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('email', { ascending: true });
    
    if (error) {
      console.error(error.message);
      return;
    }
    
    if (data) setUsers(data);
  };

  const updateNickname = async (userId: string, nickname: string) => {
    const { error } = await supabase
      .from('users')
      .update({ nickname })
      .eq('id', userId);
    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, nickname } : u));
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure? This will remove the user from the system.')) return;
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (!error) fetchUsers();
  };

  const updatePermissions = async (userId: string, perms: UserPermissions) => {
    const { error } = await supabase
      .from('users')
      .update({ permissions: perms })
      .eq('id', userId);
    if (!error) fetchUsers();
  };

  const togglePermission = (user: User, key: keyof UserPermissions) => {
    const currentPerms = user.permissions || {
      canViewGlobalPnL: false,
      canEditFixedExpenses: false,
      canRunSimulations: false,
      canViewAllDrivers: false,
      canViewDispatcherStats: false,
      canManageUsers: false,
      canViewCompanies: false,
      canViewTeams: false,
      canViewFranchises: false,
      canViewSettings: false
    };
    const newPerms = { ...currentPerms, [key]: !currentPerms[key] };
    updatePermissions(user.id, newPerms);
  };

  const PermissionToggle = ({ user, permKey, label }: { user: User, permKey: keyof UserPermissions, label: string }) => {
    const isEnabled = user.permissions ? user.permissions[permKey] : false;

    return (
      <div className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
        <span className="text-[11px] text-zinc-400">{label}</span>
        <button 
          onClick={() => togglePermission(user, permKey)}
          className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${isEnabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}
        >
          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">System Users</h2>
          <p className="text-xs text-zinc-500">Manage credentials and module access</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
        {users.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <div className="text-zinc-500 text-sm mb-2">No users found in database.</div>
            <div className="text-zinc-600 text-xs max-w-md">Users created in Supabase Auth will appear here automatically via your SQL trigger.</div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {users.map((user) => (
              <div key={user.id} className="flex flex-col">
                <div className="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 font-bold uppercase">
                      {user.nickname ? user.nickname.charAt(0) : (user.email ? user.email.charAt(0) : '?')}
                    </div>
                    <div>
                      <input 
                        type="text" 
                        defaultValue={user.nickname || ''} 
                        onBlur={(e) => updateNickname(user.id, e.target.value)}
                        placeholder="Enter Nickname"
                        className="font-bold text-zinc-200 bg-transparent border-b border-transparent focus:border-emerald-500 outline-none w-48 transition-colors hover:border-zinc-700" 
                      />
                      <div className="text-[10px] text-zinc-500 font-mono">{user.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {user.last_active_at && (Date.now() - new Date(user.last_active_at).getTime() < 300000) ? (
                      <div className="flex items-center gap-2 mr-2">
                        <div className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </div>
                        <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Active now</span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-zinc-500 font-mono mr-2 text-right">
                        <div className="text-zinc-600 mb-0.5 text-[9px] uppercase tracking-wider">Last Active</div>
                        {user.last_active_at ? new Date(user.last_active_at).toLocaleString('en-US', { timeZone: 'America/Chicago', hour12: true, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                      </div>
                    )}
                    <button 
                      onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${expandedUser === user.id ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'}`}
                    >
                      <Shield size={14} /> Permissions
                      <ChevronDown size={14} className={`transition-transform ${expandedUser === user.id ? 'rotate-180' : ''}`} />
                    </button>
                    <button onClick={() => handleDeleteUser(user.id)} className="text-zinc-600 hover:text-rose-500 p-2 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {expandedUser === user.id && (
                  <div className="bg-black/20 border-t border-zinc-800/50 p-6 grid grid-cols-1 md:grid-cols-3 gap-8 animate-in slide-in-from-top-1">
                    <div>
                      <h4 className="text-[10px] uppercase text-zinc-500 font-black mb-3 tracking-widest">Financials</h4>
                      <div className="space-y-1">
                        <PermissionToggle user={user} permKey="canViewGlobalPnL" label="View Global PnL" />
                        <PermissionToggle user={user} permKey="canEditFixedExpenses" label="Manage Expenses" />
                        <PermissionToggle user={user} permKey="canRunSimulations" label="Use Simulator" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] uppercase text-zinc-500 font-black mb-3 tracking-widest">Operations</h4>
                      <div className="space-y-1">
                        <PermissionToggle user={user} permKey="canViewAllDrivers" label="Global Driver View" />
                        <PermissionToggle user={user} permKey="canViewDispatcherStats" label="Dispatcher Margins" />
                        <PermissionToggle user={user} permKey="canManageUsers" label="Manage System Users" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] uppercase text-zinc-500 font-black mb-3 tracking-widest">Modules</h4>
                      <div className="space-y-1">
                        <PermissionToggle user={user} permKey="canViewCompanies" label="View Companies" />
                        <PermissionToggle user={user} permKey="canViewTeams" label="View Teams" />
                        <PermissionToggle user={user} permKey="canViewFranchises" label="View Franchises" />
                        <PermissionToggle user={user} permKey="canViewSettings" label="View Settings" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsView;