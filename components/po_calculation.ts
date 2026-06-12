export interface PORule {
    id?: string;
    contract_type: string;
    category_name: string;
    status: 'Include' | 'Exclude';
}

export const applyPORules = (
    po_breakdown: Record<string, number> | null,
    total_po: number,
    contract_type: string,
    rules: PORule[],
    has_franchise?: boolean
): number => {
    if (!po_breakdown || !rules || rules.length === 0) return total_po || 0;
    
    let adjustedPO = total_po || 0;
    const effectiveContracts = contract_type === 'TPOG' && has_franchise ? ['TPOG', 'TPOG Franchise PnL'] : [contract_type];
    const applicableRules = rules.filter(r => effectiveContracts.includes(r.contract_type) || r.contract_type === 'ALL');
    
    const excludedCategories = new Set<string>();
    applicableRules.forEach(rule => {
        if (rule.status === 'Exclude' && po_breakdown[rule.category_name] && !excludedCategories.has(rule.category_name)) {
            let exclude = true;
            if (contract_type === 'TPOG' && rule.contract_type === 'TPOG') {
                const tpogScope = (rule as any).tpog || 'Only TPOG with franchises';
                if (tpogScope === 'Only TPOG with franchises' && !has_franchise) exclude = false;
                if (tpogScope === 'Only TPOG without franchises' && has_franchise) exclude = false;
            }
            
            if (exclude) {
                adjustedPO -= po_breakdown[rule.category_name];
                excludedCategories.add(rule.category_name);
            }
        }
    });
    
    return adjustedPO;
};