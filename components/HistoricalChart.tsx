import React from 'react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  Line,
  LineChart,
  ComposedChart,
  Cell
} from 'recharts';
import { formatCurrency } from '../utils';

export interface ChartSeries {
  dataKey: string;
  name: string;
  color: string;
}

interface HistoricalChartProps {
  data: any[];
  series: ChartSeries[];
  type: 'line' | 'bar';
  animate?: boolean;
}

const CustomTooltip = ({ active, payload, label, series }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700/50 p-3.5 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.4)] text-[11px] min-w-[170px] z-50">
        <p className="font-semibold text-zinc-400 mb-3 tracking-wide">{label}</p>
        <div className="flex flex-col gap-2.5">
          {payload.map((entry: any, index: number) => {
            const dataKeyStr = typeof entry.dataKey === 'string' ? entry.dataKey : (series ? series.find((s: any) => s.name === entry.name)?.dataKey || '' : '');
            const isCount = dataKeyStr && (dataKeyStr.includes('effCount') || dataKeyStr.includes('effNonTeamsCount') || dataKeyStr.includes('effTrailersCount'));
            const valNum = Number(entry.value) || 0;
            const isNegative = valNum < 0;
            
            let valColor = 'text-emerald-400';
                if (isCount) {
                  valColor = 'text-zinc-200';
                } else if (isNegative) {
                  valColor = 'text-rose-500';
                }

                const seriesDef = series ? series.find((s: any) => s.dataKey === dataKeyStr) : null;
                const baseColor = seriesDef ? seriesDef.color : entry.color;
                let dotColor = baseColor;
                
                let isNetIncome = /netIncome|pnl/i.test(dataKeyStr);
                let showSplitDot = isNetIncome && series && series.length === 1;
                
                if (series && series.length === 1 && !isCount) {
                  dotColor = isNegative ? '#f43f5e' : '#10b981';
                }

                return (
                <div key={index} className="flex items-center justify-between gap-5">
                  <div className="flex items-center gap-2">
                    {showSplitDot ? (
                  <div 
                    className="rounded-full shadow-sm" 
                    style={{ background: 'linear-gradient(90deg, #10b981 50%, #f43f5e 50%)', height: '8px', width: '8px', borderRadius: '50%' }} 
                  />
                ) : (
                  <div 
                    className="rounded-full shadow-sm" 
                    style={{ backgroundColor: dotColor, height: '8px', width: '8px', boxShadow: `0 0 10px ${dotColor}` }} 
                  />
                )}
                <span className="text-zinc-200 font-medium">{entry.name}</span>
              </div>
              <span className={`font-mono font-bold ${valColor}`}>
                {isCount ? entry.value : formatCurrency(entry.value)}
              </span>
            </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

const HistoricalChart: React.FC<HistoricalChartProps> = ({ data, series, type, animate = false }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-full w-full bg-zinc-900/50 rounded-lg p-2 border border-zinc-800/50 flex items-center justify-center">
        <span className="text-xs text-zinc-600">No chart data available</span>
      </div>
    );
  }

  return (
    <div className="h-full w-full min-h-[150px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="split-color" x1="0" y1="0" x2="1" y2="0">
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#f43f5e" />
            </linearGradient>
            {series.map((s) => {
              const isExpense = /allocatedFixed|tolls|totalPOCov|totalRecruiting|cogs|totalPO|totalEscrow|dispatcherPay/i.test(s.dataKey);
              const values = data.map(i => {
                let v = i[s.dataKey] || 0;
                return (isExpense && v > 0) ? -v : v;
              });
              const dataMax = Math.max(...values);
              const dataMin = Math.min(...values);
              let offset = 0;
              if (dataMax <= 0) offset = 0;
              else if (dataMin >= 0) offset = 1;
              else offset = dataMax / (dataMax - dataMin);

              let customColor = s.color;
              const isNetIncome = /netIncome/i.test(s.dataKey);
              const positiveColor = series.length === 1 ? '#10b981' : customColor;
              const negativeColor = series.length === 1 ? '#f43f5e' : (isNetIncome ? '#f43f5e' : customColor);

              return (
                <React.Fragment key={s.dataKey}>
                  <linearGradient id={`fill-${s.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={positiveColor} stopOpacity={0.35}/>
                    <stop offset={`${Math.max(0, offset - 0.1) * 100}%`} stopColor={positiveColor} stopOpacity={0.05}/>
                    <stop offset={`${offset * 100}%`} stopColor={positiveColor} stopOpacity={0}/>
                    <stop offset={`${offset * 100}%`} stopColor={negativeColor} stopOpacity={0}/>
                    <stop offset={`${Math.min(1, offset + 0.1) * 100}%`} stopColor={negativeColor} stopOpacity={0.05}/>
                    <stop offset="100%" stopColor={negativeColor} stopOpacity={0.35}/>
                  </linearGradient>
                  <linearGradient id={`stroke-${s.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset={`${offset * 100}%`} stopColor={positiveColor} stopOpacity={1}/>
                    <stop offset={`${offset * 100}%`} stopColor={negativeColor} stopOpacity={1}/>
                  </linearGradient>
                </React.Fragment>
              );
            })}
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#3f3f46" 
            vertical={false} 
            strokeOpacity={0.4}
          />
          <XAxis 
            dataKey="name" 
            stroke="#71717a" 
            fontSize={10} 
            tickLine={false} 
            axisLine={false} 
            tickMargin={12}
            fontWeight={500}
          />
          <YAxis 
            stroke="#71717a" 
            fontSize={10} 
            tickLine={false} 
            axisLine={false} 
            tickMargin={12}
            width={90}
            tickFormatter={(val) => val < 0 ? `-$${Math.abs(val)/1000}k` : `$${val/1000}k`} 
          />
          <Tooltip 
            content={<CustomTooltip series={series} data={data} />} 
            cursor={{ fill: '#ffffff', fillOpacity: 0.02, strokeDasharray: '3 3', stroke: '#52525b', strokeWidth: 1 }} 
            isAnimationActive={true}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '16px', fontSize: '10px', fontWeight: 500 }} 
            iconType="circle" 
            iconSize={8}
            payload={series.map((s: any) => {
              let displayColor = s.color;
              if (series.length === 1) {
                if (/netIncome|pnl/i.test(s.dataKey)) {
                  displayColor = 'url(#split-color)';
                } else {
                  const isExpense = /allocatedFixed|tolls|totalPOCov|totalRecruiting|cogs|totalPO|totalEscrow|dispatcherPay/i.test(s.dataKey);
                  let lastVal = data.length > 0 ? (data[data.length - 1][s.dataKey] || 0) : 0;
                  if (isExpense && lastVal > 0) lastVal = -lastVal;
                  displayColor = lastVal < 0 ? '#f43f5e' : '#10b981';
                }
              }
              return {
                id: s.dataKey,
                type: 'circle',
                value: s.name,
                color: displayColor
              };
            })}
            formatter={(value, entry: any) => {
              const textColor = entry.color === 'url(#split-color)' ? '#ffffff' : entry.color;
              return <span style={{ color: textColor }}>{value}</span>;
            }}
          />
          
         {series.map((s) => {
            const isExpense = /allocatedFixed|tolls|totalPOCov|totalRecruiting|cogs|totalPO|totalEscrow|dispatcherPay/i.test(s.dataKey);
            const getVal = (entry: any) => {
              let v = entry[s.dataKey] || 0;
              return (isExpense && v > 0) ? -v : v;
            };

            return type === 'bar' ? (
              <Bar 
                key={s.dataKey}
                dataKey={getVal}
                name={s.name}
                isAnimationActive={animate}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={series.length === 1 ? (getVal(entry) < 0 ? '#f43f5e' : '#10b981') : s.color} />
                ))}
              </Bar>
            ) : (
              <Area 
                key={s.dataKey}
                type="monotone" 
                dataKey={getVal} 
                name={s.name}
                stroke={series.length === 1 ? `url(#stroke-${s.dataKey})` : s.color} 
                fill={series.length === 1 ? `url(#fill-${s.dataKey})` : "none"} 
                strokeWidth={3}
                fillOpacity={1}
                dot={false}
                activeDot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const isNeg = Number(getVal(payload)) < 0;
                  const dotColor = (series.length === 1 && isNeg) ? '#f43f5e' : s.color;
                  return <circle cx={cx} cy={cy} r={6} stroke={dotColor} strokeWidth={3} fill="#18181b" />;
                }}
                isAnimationActive={animate}
              />
            )
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HistoricalChart;