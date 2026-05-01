
export const formatCurrency = (amount: number | undefined | null, decimals: number = 0) => {
  const safeAmount = amount || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safeAmount);
};

export const formatPercent = (val: number | undefined | null) => {
  const safeVal = val || 0;
  return `${safeVal.toFixed(1)}%`;
};

