import React from 'react';

interface DashboardCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'primary' | 'accent' | 'danger' | 'warning';
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, subtitle, trend, trendValue, color = 'primary' }) => {
  const getColorClass = () => {
    switch (color) {
      case 'primary': return 'text-emerald-400';
      case 'accent': return 'text-blue-400';
      case 'danger': return 'text-rose-400';
      case 'warning': return 'text-amber-400';
      default: return 'text-zinc-200';
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 hover:border-zinc-700 transition-colors">
      <div className="flex justify-between items-start mb-1">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{title}</span>
        {trend && (
          <div className={`flex items-center text-xs ${trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-rose-500' : 'text-zinc-500'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '•'} {trendValue}
          </div>
        )}
      </div>
      <div className={`text-2xl font-bold font-mono tracking-tight ${getColorClass()}`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-zinc-500 mt-1 truncate">
          {subtitle}
        </div>
      )}
    </div>
  );
};

export default DashboardCard;