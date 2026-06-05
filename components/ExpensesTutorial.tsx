import React from 'react';
import { X, Sliders, ChevronDown, Plus, Info, Save, Trash2, ChevronLeft, ChevronRight, Settings, CornerDownRight, Bold, Italic, Underline, List, ListOrdered, Palette, FileText, Calendar } from 'lucide-react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  tutorialType?: 'rules' | 'reductions' | null;
}

const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose, activeTab, tutorialType = 'rules' }) => {
  const [step, setStep] = React.useState(0);
  const [reductionModalOpen, setReductionModalOpen] = React.useState(false);
  const [message, setMessage] = React.useState({ title: '', text: '', visible: false, x: 50, y: 50 });
  const [localTab, setLocalTab] = React.useState(activeTab);
  const [focusArea, setFocusArea] = React.useState<string | null>(null);
  
  const [expExpanded, setExpExpanded] = React.useState(false);
  const [expRows, setExpRows] = React.useState<{id: string, type: 'global'|'company'|'contract', target: string, amount: string, validFrom?: string}[]>([]);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [compSelectOpen, setCompSelectOpen] = React.useState(false);
  const [mclooOpen, setMclooOpen] = React.useState(false);
  const [mclooMode, setMclooMode] = React.useState<'shared'|'base'>('shared');
  const [includeDropdownOpen, setIncludeDropdownOpen] = React.useState(false);
  
  const [conExpanded, setConExpanded] = React.useState(false);
  const [conNewRule, setConNewRule] = React.useState(false);
  const [conGross, setConGross] = React.useState('');
  const [conMargin, setConMargin] = React.useState('');
  const [conValidFrom, setConValidFrom] = React.useState('');
  const [conValidTo, setConValidTo] = React.useState('');
  const [conTypeOpen, setConTypeOpen] = React.useState(false);

  const [dispExpanded, setDispExpanded] = React.useState(false);
  const [dispPayTab, setDispPayTab] = React.useState<'gross_margin' | 'shared_responsibility'>('gross_margin');
  const [dispContract, setDispContract] = React.useState('');
  const [dispCompany, setDispCompany] = React.useState('');
  const [dispTeam, setDispTeam] = React.useState('');
  const [dispDispatcher, setDispDispatcher] = React.useState('');
  const [dispType, setDispType] = React.useState('%');
  const [dispValidFrom, setDispValidFrom] = React.useState('');
  const [dispValidTo, setDispValidTo] = React.useState('');
  const [dispGross, setDispGross] = React.useState('');
  const [dispMargin, setDispMargin] = React.useState('');
  const [dispAmount, setDispAmount] = React.useState('');
  const [dispMclooPay, setDispMclooPay] = React.useState('');

     const [cpmExpanded, setCpmExpanded] = React.useState(false);
  const [cpmRows, setCpmRows] = React.useState<{id: string, type: 'global'|'company'|'contract', target: string, amount: string, validFrom?: string, validTo?: string}[]>([]);
  const [cpmAddDropdownOpen, setCpmAddDropdownOpen] = React.useState(false);
  const [cpmTargetOpen, setCpmTargetOpen] = React.useState(false);
  const [pnlExpanded, setPnlExpanded] = React.useState(false);
  const [pnlChecked, setPnlChecked] = React.useState(false);
  const [frRows, setFrRows] = React.useState<{id: string, type: 'global'|'company'|'contract', target: string, amount: string, validFrom?: string, validTo?: string}[]>([]);
  const [frAddDropdownOpen, setFrAddDropdownOpen] = React.useState(false);
  const [frTargetOpen, setFrTargetOpen] = React.useState(false);

  const [fixRevExpanded, setFixRevExpanded] = React.useState(false);
  const [fixRevRows, setFixRevRows] = React.useState<{id: string, type: 'global'|'company'|'contract'|'franchise', target: string, amount: string, validFrom?: string, validTo?: string}[]>([]);
  const [fixRevDropdownOpen, setFixRevDropdownOpen] = React.useState(false);
  const [fixRevTargetOpen, setFixRevTargetOpen] = React.useState(false);

      const contractSteps = [
      { title: 'Tutorial Overview', text: "Let's learn how to configure Contract Rules step by step.", focus: null, x: 50, y: 35, setup: () => { setConExpanded(false); setConNewRule(false); setConGross(''); setConMargin(''); setConValidFrom(''); setConValidTo(''); setConTypeOpen(false); } },
      { title: 'Step 1: Expand Contract', text: "First, open the contract type so you can see its rule history and formula rows.", focus: 'conChevron', x: 45, y: 45, setup: () => { setConExpanded(false); setConNewRule(false); setConGross(''); setConMargin(''); setConValidFrom(''); setConValidTo(''); setConTypeOpen(false); } },
      { title: 'Step 2: Add Rule', text: "Click ADD RULE to create a new formula row for this contract type.", focus: 'addContractRule', x: 42, y: 70, setup: () => { setConExpanded(true); setConNewRule(false); setConGross(''); setConMargin(''); setConValidFrom(''); setConValidTo(''); setConTypeOpen(false); } },
      { title: 'Step 3: Contract Formula Type', text: "Click here to open the dropdown and select the formula type. For this example, we'll leave it as 'TPOG'.", focus: 'conFormulaType', x: 35, y: 55, setup: () => { setConExpanded(true); setConNewRule(true); setConGross(''); setConMargin(''); setConValidFrom(''); setConValidTo(''); setConTypeOpen(true); } },
      { title: 'Step 4: Set Dates', text: "Select when this contract rule starts and ends. You can leave the 'Valid To' field empty if the rule applies indefinitely.", focus: 'conDateInput', x: 50, y: 75, setup: () => { setConExpanded(true); setConNewRule(true); setConGross(''); setConMargin(''); setConValidFrom('2026-05-26'); setConValidTo(''); setConTypeOpen(false); } },
      { title: 'Step 5: Company Gross', text: "Enter the percentage of Gross that belongs to the company in this contract formula.", focus: 'conGrossInput', x: 48, y: 55, setup: () => { setConExpanded(true); setConNewRule(true); setConGross('3'); setConMargin(''); setConValidFrom('2026-05-26'); setConValidTo(''); setConTypeOpen(false); } },
      { title: 'Step 6: Company Margin', text: "Enter the company margin percentage. This works together with Gross to calculate the final contract result.", focus: 'conMarginInput', x: 63, y: 55, setup: () => { setConExpanded(true); setConNewRule(true); setConGross('3'); setConMargin('70'); setConValidFrom('2026-05-26'); setConValidTo(''); setConTypeOpen(false); } },
      { title: 'Step 7: Save Changes', text: "Click Save and Close to apply the Contract Rules setup.", focus: 'saveBtn', x: 50, y: 50, setup: () => { setConExpanded(true); setConNewRule(true); setConGross('3'); setConMargin('70'); setConValidFrom('2026-05-26'); setConValidTo(''); setConTypeOpen(false); } },
      { title: 'Done!', text: "You now know exactly how to configure Contract Rules.", focus: null, x: 50, y: 50, setup: () => { setConExpanded(true); setConNewRule(true); setConGross('3'); setConMargin('70'); setConValidFrom('2026-05-26'); setConValidTo(''); setConTypeOpen(false); } }
  ];

  const dispatcherSteps = [
      { title: 'Tutorial Overview', text: "Let's learn how to configure Dispatcher Pay rules step by step.", focus: null, x: 50, y: 50, setup: () => { setDispExpanded(false); setDispPayTab('gross_margin'); setDispContract(''); setDispCompany(''); setDispTeam(''); setDispDispatcher(''); setDispValidFrom(''); setDispValidTo(''); setDispType('%'); setDispGross(''); setDispMargin(''); setDispMclooPay(''); } },
      { title: 'Step 1: Gross/Margin Tab', text: "By default, you manage standard percentage or flat pay rules here.", focus: 'dispTabGross', x: 50, y: 70, setup: () => { setDispExpanded(false); setDispPayTab('gross_margin'); } },
      { title: 'Step 2: Add Rule', text: "Click ADD RULE to create a new dispatcher pay configuration.", focus: 'dispChevron', x: 50, y: 25, setup: () => { setDispExpanded(false); } },
      { title: 'Step 3: New Rule Added', text: "A new rule appears. You can narrow it down by Contract, Company, Team, or specific Dispatcher.", focus: 'dispRow', x: 50, y: 80, setup: () => { setDispExpanded(true); } },
      { title: 'Step 4: Select Contract', text: "Leave it as ALL to apply to all contracts.", focus: 'dispContractInput', x: 50, y: 80, setup: () => { setDispExpanded(true); setDispContract(''); } },
      { title: 'Step 5: Set Dates', text: "Define when this rule starts taking effect.", focus: 'dispValidFromInput', x: 50, y: 80, setup: () => { setDispExpanded(true); setDispValidFrom('2026-05-26'); } },
      { title: 'Step 6: Pay Type', text: "Select whether the pay is a percentage, per truck flat rate, or total flat amount.", focus: 'dispTypeInput', x: 50, y: 80, setup: () => { setDispExpanded(true); setDispType('%'); } },
      { title: 'Step 7: Enter Gross %', text: "Set the percentage of gross the dispatcher receives.", focus: 'dispGrossInput', x: 50, y: 80, setup: () => { setDispExpanded(true); setDispGross('3'); } },
      { title: 'Step 8: Enter Margin %', text: "Set the margin percentage, if applicable.", focus: 'dispMarginInput', x: 50, y: 80, setup: () => { setDispExpanded(true); setDispGross('3'); setDispMargin('30'); } },
      { title: 'Step 9: Shared Insurance Tab', text: "Now click on 'Shared Insurance' to manage how dispatchers cover liability.", focus: 'dispTabShared', x: 50, y: 70, setup: () => { setDispExpanded(true); setDispGross('3'); setDispMargin('30'); setDispPayTab('shared_responsibility'); } },
      { title: 'Step 10: Set Dispatcher Pay', text: "Enter how much of the shared cost the dispatcher is responsible to pay.", focus: 'dispMclooInput', x: 50, y: 25, setup: () => { setDispExpanded(true); setDispPayTab('shared_responsibility'); setDispMclooPay('50'); } },
      { title: 'Step 11: Save Changes', text: "Click Save and Close to apply the configuration.", focus: 'saveBtn', x: 50, y: 25, setup: () => { setDispExpanded(true); setDispPayTab('shared_responsibility'); setDispMclooPay('50'); } },
      { title: 'Done!', text: "You now know exactly how to configure Dispatcher Pay.", focus: null, x: 50, y: 50, setup: () => { setDispExpanded(true); setDispPayTab('shared_responsibility'); setDispMclooPay('50'); } }
  ];

    const cpmSteps = [
      { title: 'Tutorial Overview', text: "Let's learn how to configure CPM Revenue rules step by step.", focus: null, x: 50, y: 40, setup: () => { setCpmRows([]); setCpmAddDropdownOpen(false); setCpmTargetOpen(false); } },
      { title: 'Step 1: Add Global Rule', text: "Click ADD GLOBAL RULE to set a default CPM amount.", focus: 'cpmAddGlobal', x: 25, y: 65, setup: () => { setCpmRows([]); setCpmAddDropdownOpen(false); setCpmTargetOpen(false); } },
      { title: 'Step 2: Set Valid From', text: "Select the date when this global CPM rule becomes active.", focus: 'cpmValidFromGlobal', x: 45, y: 65, setup: () => { setCpmRows([{ id: 'c1', type: 'global', target: 'ALL', amount: '', validFrom: '05/27/2026', validTo: '' }]); setCpmAddDropdownOpen(false); setCpmTargetOpen(false); } },
      { title: 'Step 3: Set Valid To', text: "Set the end date. You can leave this blank if the rule applies indefinitely.", focus: 'cpmValidToGlobal', x: 60, y: 65, setup: () => { setCpmRows([{ id: 'c1', type: 'global', target: 'ALL', amount: '', validFrom: '05/27/2026', validTo: '' }]); setCpmAddDropdownOpen(false); setCpmTargetOpen(false); } },
      { title: 'Step 4: Set Amount', text: "Enter the CPM value here.", focus: 'cpmAmountGlobal', x: 80, y: 65, setup: () => { setCpmRows([{ id: 'c1', type: 'global', target: 'ALL', amount: '0.65', validFrom: '05/27/2026', validTo: '' }]); setCpmAddDropdownOpen(false); setCpmTargetOpen(false); } },
      { title: 'Step 5: Add Exception', text: "To set a specific CPM for a contract or company, click 'ADD RULE FOR'.", focus: 'cpmAddDropdown', x: 75, y: 65, setup: () => { setCpmRows([{ id: 'c1', type: 'global', target: 'ALL', amount: '0.65', validFrom: '05/27/2026', validTo: '' }]); setCpmAddDropdownOpen(true); setCpmTargetOpen(false); } },
      { title: 'Step 6: Select Contract', text: "Choose 'Contract' to apply a specific CPM to a contract type.", focus: 'cpmAddContractItem', x: 65, y: 75, setup: () => { setCpmRows([{ id: 'c2', type: 'contract', target: 'Select Contract', amount: '', validFrom: '05/27/2026', validTo: '' }, { id: 'c1', type: 'global', target: 'ALL', amount: '0.65', validFrom: '05/27/2026', validTo: '' }]); setCpmAddDropdownOpen(true); setCpmTargetOpen(false); } },
      { title: 'Step 7: Target Contract', text: "Select the target contract from the dropdown.", focus: 'cpmSelectTarget', x: 35, y: 15, setup: () => { setCpmRows([{ id: 'c2', type: 'contract', target: 'Select Contract', amount: '', validFrom: '05/27/2026', validTo: '' }, { id: 'c1', type: 'global', target: 'ALL', amount: '0.65', validFrom: '05/27/2026', validTo: '' }]); setCpmAddDropdownOpen(false); setCpmTargetOpen(true); } },
      { title: 'Step 8: Fill Specific Rule', text: "Set dates and the overridden CPM amount for this contract.", focus: 'cpmAmountSpecific', x: 55, y: 15, setup: () => { setCpmRows([{ id: 'c2', type: 'contract', target: 'TPOG', amount: '0.70', validFrom: '06/01/2026', validTo: '' }, { id: 'c1', type: 'global', target: 'ALL', amount: '0.65', validFrom: '05/27/2026', validTo: '' }]); setCpmAddDropdownOpen(false); setCpmTargetOpen(false); } },
      { title: 'Step 9: Add Company Rule', text: "We can do the same for a specific company. Open the dropdown again.", focus: 'cpmAddDropdown', x: 75, y: 65, setup: () => { setCpmRows([{ id: 'c2', type: 'contract', target: 'TPOG', amount: '0.70', validFrom: '06/01/2026', validTo: '' }, { id: 'c1', type: 'global', target: 'ALL', amount: '0.65', validFrom: '05/27/2026', validTo: '' }]); setCpmAddDropdownOpen(true); setCpmTargetOpen(false); } },
      { title: 'Step 10: Select Company', text: "Click 'Company' to add an exception for a specific fleet.", focus: 'cpmAddCompanyItem', x: 65, y: 85, setup: () => { setCpmRows([{ id: 'c3', type: 'company', target: 'Select Company', amount: '', validFrom: '05/27/2026', validTo: '' }, { id: 'c2', type: 'contract', target: 'TPOG', amount: '0.70', validFrom: '06/01/2026', validTo: '' }, { id: 'c1', type: 'global', target: 'ALL', amount: '0.65', validFrom: '05/27/2026', validTo: '' }]); setCpmAddDropdownOpen(true); setCpmTargetOpen(false); } },
      { title: 'Step 11: Target Company', text: "Select the specific company from the dropdown list.", focus: 'cpmSelectTargetCompany', x: 35, y: 15, setup: () => { setCpmRows([{ id: 'c3', type: 'company', target: 'Select Company', amount: '', validFrom: '05/27/2026', validTo: '' }, { id: 'c2', type: 'contract', target: 'TPOG', amount: '0.70', validFrom: '06/01/2026', validTo: '' }, { id: 'c1', type: 'global', target: 'ALL', amount: '0.65', validFrom: '05/27/2026', validTo: '' }]); setCpmAddDropdownOpen(false); setCpmTargetOpen(true); } },
      { title: 'Step 12: Set Company Amount', text: "Enter the overridden CPM amount for this company.", focus: 'cpmAmountSpecificCompany', x: 55, y: 15, setup: () => { setCpmRows([{ id: 'c3', type: 'company', target: 'Test Company', amount: '0.80', validFrom: '06/01/2026', validTo: '' }, { id: 'c2', type: 'contract', target: 'TPOG', amount: '0.70', validFrom: '06/01/2026', validTo: '' }, { id: 'c1', type: 'global', target: 'ALL', amount: '0.65', validFrom: '05/27/2026', validTo: '' }]); setCpmAddDropdownOpen(false); setCpmTargetOpen(false); } },
      { title: 'Step 13: Save Changes', text: "Click Save and Close to apply your changes.", focus: 'saveBtn', x: 50, y: 40, setup: () => { setCpmRows([{ id: 'c3', type: 'company', target: 'Test Company', amount: '0.80', validFrom: '06/01/2026', validTo: '' }, { id: 'c2', type: 'contract', target: 'TPOG', amount: '0.70', validFrom: '06/01/2026', validTo: '' }, { id: 'c1', type: 'global', target: 'ALL', amount: '0.65', validFrom: '05/27/2026', validTo: '' }]); setCpmAddDropdownOpen(false); setCpmTargetOpen(false); } },
      { title: 'Done!', text: "You now know exactly how to manage CPM Revenue rules.", focus: null, x: 50, y: 40, setup: () => { setCpmRows([{ id: 'c3', type: 'company', target: 'Test Company', amount: '0.80', validFrom: '06/01/2026', validTo: '' }, { id: 'c2', type: 'contract', target: 'TPOG', amount: '0.70', validFrom: '06/01/2026', validTo: '' }, { id: 'c1', type: 'global', target: 'ALL', amount: '0.65', validFrom: '05/27/2026', validTo: '' }]); setCpmAddDropdownOpen(false); setCpmTargetOpen(false); } }
    ];

  const pnlSteps = [
      { title: 'Tutorial Overview', text: "Let's learn how to configure PNL Calculation rules.", focus: null, x: 50, y: 40, setup: () => { setPnlExpanded(false); } },
      { title: 'Step 1: Toggle Category', text: "Click on any item in the formula to include or exclude it from the PNL calculation for that contract type. Try clicking 'RECRUITING'.", focus: 'pnlChevron', x: 50, y: 35, setup: () => { setPnlExpanded(false); } },
      { title: 'Step 2: Save Changes', text: "Once you have configured the formulas, click Save and Close to apply the PNL settings.", focus: 'saveBtn', x: 50, y: 50, setup: () => { setPnlExpanded(true); } },
      { title: 'Done!', text: "You now know how to manage PNL Calculation.", focus: null, x: 50, y: 50, setup: () => { setPnlExpanded(true); } }
  ];

      const fuelRebateSteps = [
      { title: 'Tutorial Overview', text: "Let's learn how to configure Fuel Rebate rules step by step.", focus: null, x: 50, y: 40, setup: () => { setFrRows([]); setFrAddDropdownOpen(false); setFrTargetOpen(false); } },
      { title: 'Step 1: Add Global Rule', text: "Click ADD GLOBAL RULE to set a default Fuel Rebate amount.", focus: 'frAddGlobal', x: 25, y: 65, setup: () => { setFrRows([]); setFrAddDropdownOpen(false); setFrTargetOpen(false); } },
      { title: 'Step 2: Set Valid From', text: "Select the date when this global Fuel Rebate rule becomes active.", focus: 'frValidFromGlobal', x: 45, y: 65, setup: () => { setFrRows([{ id: 'f1', type: 'global', target: 'ALL', amount: '', validFrom: '05/27/2026', validTo: '' }]); setFrAddDropdownOpen(false); setFrTargetOpen(false); } },
      { title: 'Step 3: Set Valid To', text: "Set the end date. You can leave this blank if the rule applies indefinitely.", focus: 'frValidToGlobal', x: 60, y: 65, setup: () => { setFrRows([{ id: 'f1', type: 'global', target: 'ALL', amount: '', validFrom: '05/27/2026', validTo: '' }]); setFrAddDropdownOpen(false); setFrTargetOpen(false); } },
      { title: 'Step 4: Set Amount', text: "Enter the Fuel Rebate value here.", focus: 'frAmountGlobal', x: 80, y: 65, setup: () => { setFrRows([{ id: 'f1', type: 'global', target: 'ALL', amount: '0.20', validFrom: '05/27/2026', validTo: '' }]); setFrAddDropdownOpen(false); setFrTargetOpen(false); } },
      { title: 'Step 5: Add Exception', text: "To set a specific Fuel Rebate for a contract or company, click 'ADD RULE FOR'.", focus: 'frAddDropdown', x: 75, y: 65, setup: () => { setFrRows([{ id: 'f1', type: 'global', target: 'ALL', amount: '0.20', validFrom: '05/27/2026', validTo: '' }]); setFrAddDropdownOpen(true); setFrTargetOpen(false); } },
      { title: 'Step 6: Select Contract', text: "Choose 'Contract' to apply a specific Fuel Rebate to a contract type.", focus: 'frAddContractItem', x: 65, y: 75, setup: () => { setFrRows([{ id: 'f2', type: 'contract', target: 'Select Contract', amount: '', validFrom: '05/27/2026', validTo: '' }, { id: 'f1', type: 'global', target: 'ALL', amount: '0.20', validFrom: '05/27/2026', validTo: '' }]); setFrAddDropdownOpen(true); setFrTargetOpen(false); } },
      { title: 'Step 7: Target Contract', text: "Select the target contract from the dropdown.", focus: 'frSelectTarget', x: 35, y: 15, setup: () => { setFrRows([{ id: 'f2', type: 'contract', target: 'Select Contract', amount: '', validFrom: '05/27/2026', validTo: '' }, { id: 'f1', type: 'global', target: 'ALL', amount: '0.20', validFrom: '05/27/2026', validTo: '' }]); setFrAddDropdownOpen(false); setFrTargetOpen(true); } },
      { title: 'Step 8: Fill Specific Rule', text: "Set dates and the overridden Fuel Rebate amount for this contract.", focus: 'frAmountSpecific', x: 55, y: 15, setup: () => { setFrRows([{ id: 'f2', type: 'contract', target: 'TPOG', amount: '0.25', validFrom: '06/01/2026', validTo: '' }, { id: 'f1', type: 'global', target: 'ALL', amount: '0.20', validFrom: '05/27/2026', validTo: '' }]); setFrAddDropdownOpen(false); setFrTargetOpen(false); } },
      { title: 'Step 9: Add Company Rule', text: "We can do the same for a specific company. Open the dropdown again.", focus: 'frAddDropdown', x: 75, y: 65, setup: () => { setFrRows([{ id: 'f2', type: 'contract', target: 'TPOG', amount: '0.25', validFrom: '06/01/2026', validTo: '' }, { id: 'f1', type: 'global', target: 'ALL', amount: '0.20', validFrom: '05/27/2026', validTo: '' }]); setFrAddDropdownOpen(true); setFrTargetOpen(false); } },
      { title: 'Step 10: Select Company', text: "Click 'Company' to add an exception for a specific fleet.", focus: 'frAddCompanyItem', x: 65, y: 85, setup: () => { setFrRows([{ id: 'f3', type: 'company', target: 'Select Company', amount: '', validFrom: '05/27/2026', validTo: '' }, { id: 'f2', type: 'contract', target: 'TPOG', amount: '0.25', validFrom: '06/01/2026', validTo: '' }, { id: 'f1', type: 'global', target: 'ALL', amount: '0.20', validFrom: '05/27/2026', validTo: '' }]); setFrAddDropdownOpen(true); setFrTargetOpen(false); } },
      { title: 'Step 11: Target Company', text: "Select the specific company from the dropdown list.", focus: 'frSelectTargetCompany', x: 35, y: 15, setup: () => { setFrRows([{ id: 'f3', type: 'company', target: 'Select Company', amount: '', validFrom: '05/27/2026', validTo: '' }, { id: 'f2', type: 'contract', target: 'TPOG', amount: '0.25', validFrom: '06/01/2026', validTo: '' }, { id: 'f1', type: 'global', target: 'ALL', amount: '0.20', validFrom: '05/27/2026', validTo: '' }]); setFrAddDropdownOpen(false); setFrTargetOpen(true); } },
      { title: 'Step 12: Set Company Amount', text: "Enter the overridden Fuel Rebate amount for this company.", focus: 'frAmountSpecificCompany', x: 55, y: 15, setup: () => { setFrRows([{ id: 'f3', type: 'company', target: 'Test Company', amount: '0.30', validFrom: '06/01/2026', validTo: '' }, { id: 'f2', type: 'contract', target: 'TPOG', amount: '0.25', validFrom: '06/01/2026', validTo: '' }, { id: 'f1', type: 'global', target: 'ALL', amount: '0.20', validFrom: '05/27/2026', validTo: '' }]); setFrAddDropdownOpen(false); setFrTargetOpen(false); } },
      { title: 'Step 13: Save Changes', text: "Click Save and Close to apply your changes.", focus: 'saveBtn', x: 50, y: 40, setup: () => { setFrRows([{ id: 'f3', type: 'company', target: 'Test Company', amount: '0.30', validFrom: '06/01/2026', validTo: '' }, { id: 'f2', type: 'contract', target: 'TPOG', amount: '0.25', validFrom: '06/01/2026', validTo: '' }, { id: 'f1', type: 'global', target: 'ALL', amount: '0.20', validFrom: '05/27/2026', validTo: '' }]); setFrAddDropdownOpen(false); setFrTargetOpen(false); } },
      { title: 'Done!', text: "You now know exactly how to manage Fuel Rebate rules.", focus: null, x: 50, y: 40, setup: () => { setFrRows([{ id: 'f3', type: 'company', target: 'Test Company', amount: '0.30', validFrom: '06/01/2026', validTo: '' }, { id: 'f2', type: 'contract', target: 'TPOG', amount: '0.25', validFrom: '06/01/2026', validTo: '' }, { id: 'f1', type: 'global', target: 'ALL', amount: '0.20', validFrom: '05/27/2026', validTo: '' }]); setFrAddDropdownOpen(false); setFrTargetOpen(false); } }
  ];

  const fixedRevenueSteps = [
    { title: 'Tutorial Overview', text: "Let's learn how to configure Fixed Revenue rules step by step.", focus: null, x: 50, y: 40, setup: () => { setFixRevExpanded(false); setFixRevRows([]); setFixRevDropdownOpen(false); setFixRevTargetOpen(false); } },
    { title: 'Step 1: Expand Item', text: "Click on a revenue item like 'Truck Weekly' to expand it.", focus: 'fixRevChevron', x: 50, y: 45, setup: () => { setFixRevExpanded(true); setFixRevRows([{ id: 'default_tpog', type: 'contract', target: 'TPOG', amount: '150.00', validFrom: '2026-05-20', validTo: '2026-05-26' }]); setFixRevDropdownOpen(false); setFixRevTargetOpen(false); } },
    { title: 'Step 2: Modify Default', text: "If there's an existing Default rule here, you can click 'Custom Value' to override its amount.", focus: 'fixRevCustomCheckbox', x: 50, y: 70, setup: () => { setFixRevExpanded(true); setFixRevRows([{ id: 'default_tpog', type: 'contract', target: 'TPOG', amount: '150.00', validFrom: '2026-05-20', validTo: '2026-05-26' }]); setFixRevDropdownOpen(false); setFixRevTargetOpen(false); } },
    { title: 'Step 3: Add Global Rule', text: "Click ADD GLOBAL RULE to set a default revenue amount.", focus: 'fixRevAddGlobal', x: 25, y: 65, setup: () => { setFixRevExpanded(true); setFixRevRows([{ id: 'default_tpog', type: 'contract', target: 'TPOG', amount: '150.00', validFrom: '2026-05-20', validTo: '2026-05-26' }]); setFixRevDropdownOpen(false); setFixRevTargetOpen(false); } },
    { title: 'Step 4: Set Valid From', text: "Select the start date.", focus: 'fixRevValidFromGlobal', x: 45, y: 65, setup: () => { setFixRevExpanded(true); setFixRevRows([{ id: 'rev1', type: 'global', target: 'ALL', amount: '', validFrom: '05/27/2026', validTo: '' }, { id: 'default_tpog', type: 'contract', target: 'TPOG', amount: '150.00', validFrom: '2026-05-20', validTo: '2026-05-26' }]); setFixRevDropdownOpen(false); setFixRevTargetOpen(false); } },
    { title: 'Step 5: Set Valid To', text: "Set the end date. You can leave this blank if it applies indefinitely.", focus: 'fixRevValidToGlobal', x: 60, y: 65, setup: () => { setFixRevExpanded(true); setFixRevRows([{ id: 'rev1', type: 'global', target: 'ALL', amount: '', validFrom: '05/27/2026', validTo: '' }, { id: 'default_tpog', type: 'contract', target: 'TPOG', amount: '150.00', validFrom: '2026-05-20', validTo: '2026-05-26' }]); setFixRevDropdownOpen(false); setFixRevTargetOpen(false); } },
    { title: 'Step 6: Set Amount', text: "Enter the revenue amount.", focus: 'fixRevAmountGlobal', x: 80, y: 65, setup: () => { setFixRevExpanded(true); setFixRevRows([{ id: 'rev1', type: 'global', target: 'ALL', amount: '250.00', validFrom: '05/27/2026', validTo: '' }, { id: 'default_tpog', type: 'contract', target: 'TPOG', amount: '150.00', validFrom: '2026-05-20', validTo: '2026-05-26' }]); setFixRevDropdownOpen(false); setFixRevTargetOpen(false); } },
    { title: 'Step 7: Add Exception', text: "To set specific revenue for a contract, company, or franchise, click 'Add Rule For'.", focus: 'fixRevAddDropdown', x: 75, y: 65, setup: () => { setFixRevExpanded(true); setFixRevRows([{ id: 'rev1', type: 'global', target: 'ALL', amount: '250.00', validFrom: '05/27/2026', validTo: '' }, { id: 'default_tpog', type: 'contract', target: 'TPOG', amount: '150.00', validFrom: '2026-05-20', validTo: '2026-05-26' }]); setFixRevDropdownOpen(true); setFixRevTargetOpen(false); } },
    { title: 'Step 8: Select Scope', text: "Choose 'Contract' to apply a specific revenue rule to a contract type.", focus: 'fixRevAddContractItem', x: 65, y: 75, setup: () => { setFixRevExpanded(true); setFixRevRows([{ id: 'rev2', type: 'contract', target: 'Select Contract', amount: '', validFrom: '05/27/2026', validTo: '' }, { id: 'rev1', type: 'global', target: 'ALL', amount: '250.00', validFrom: '05/27/2026', validTo: '' }, { id: 'default_tpog', type: 'contract', target: 'TPOG', amount: '150.00', validFrom: '2026-05-20', validTo: '2026-05-26' }]); setFixRevDropdownOpen(true); setFixRevTargetOpen(false); } },
    { title: 'Step 9: Target Contract', text: "Select the target contract from the dropdown.", focus: 'fixRevSelectTarget', x: 35, y: 15, setup: () => { setFixRevExpanded(true); setFixRevRows([{ id: 'rev2', type: 'contract', target: 'Select Contract', amount: '', validFrom: '05/27/2026', validTo: '' }, { id: 'rev1', type: 'global', target: 'ALL', amount: '250.00', validFrom: '05/27/2026', validTo: '' }, { id: 'default_tpog', type: 'contract', target: 'TPOG', amount: '150.00', validFrom: '2026-05-20', validTo: '2026-05-26' }]); setFixRevDropdownOpen(false); setFixRevTargetOpen(true); } },
    { title: 'Step 10: Set Custom Amount', text: "Set the custom amount for this specific contract.", focus: 'fixRevAmountSpecific', x: 55, y: 15, setup: () => { setFixRevExpanded(true); setFixRevRows([{ id: 'rev2', type: 'contract', target: 'MCLOO', amount: '300.00', validFrom: '05/27/2026', validTo: '' }, { id: 'rev1', type: 'global', target: 'ALL', amount: '250.00', validFrom: '05/27/2026', validTo: '' }, { id: 'default_tpog', type: 'contract', target: 'TPOG', amount: '150.00', validFrom: '2026-05-20', validTo: '2026-05-26' }]); setFixRevDropdownOpen(false); setFixRevTargetOpen(false); } },
    { title: 'Done!', text: "You now know how to manage Fixed Revenue rules.", focus: null, x: 50, y: 50, setup: () => { setFixRevExpanded(true); setFixRevRows([{ id: 'rev2', type: 'contract', target: 'MCLOO', amount: '300.00', validFrom: '05/27/2026', validTo: '' }, { id: 'rev1', type: 'global', target: 'ALL', amount: '250.00', validFrom: '05/27/2026', validTo: '' }, { id: 'default_tpog', type: 'contract', target: 'TPOG', amount: '150.00', validFrom: '2026-05-20', validTo: '2026-05-26' }]); setFixRevDropdownOpen(false); setFixRevTargetOpen(false); } }
  ];

      const fixedSteps = tutorialType === 'rules' ? [
      { title: 'Tutorial Overview', text: "Let's learn how to configure Global rules and specific exceptions safely.", focus: null, x: 50, y: 40, setup: () => { setExpExpanded(false); setExpRows([]); setDropdownOpen(false); setCompSelectOpen(false); setMclooOpen(false); setMclooMode('shared'); setReductionModalOpen(false); setIncludeDropdownOpen(false); } },
      { title: 'Step 1: Expand Category', text: "First, we view the rules for this expense.", focus: 'expChevron', x: 55, y: 45, setup: () => { setExpExpanded(true); setExpRows([]); setDropdownOpen(false); setCompSelectOpen(false); setMclooOpen(false); setMclooMode('shared'); } },
      { title: 'Step 2: Base Rule', text: "Click 'ADD GLOBAL RULE' to set a default amount for all companies.", focus: 'addGlobal', x: 35, y: 45, setup: () => { setExpExpanded(true); setExpRows([{ id: 'r1', type: 'global', target: 'ALL', amount: '', validFrom: '' }]); setDropdownOpen(false); setCompSelectOpen(false); setMclooOpen(false); setMclooMode('shared'); } },
      { title: 'Step 3: Set Dates', text: "Select when this global rule starts and ends. You can leave the 'Valid To' date empty to make it active indefinitely.", focus: 'datesGlobal', x: 65, y: 45, setup: () => { setExpExpanded(true); setExpRows([{ id: 'r1', type: 'global', target: 'ALL', amount: '', validFrom: '2026-05-26' }]); setDropdownOpen(false); setCompSelectOpen(false); setMclooOpen(false); setMclooMode('shared'); } },
      { title: 'Step 4: Set Amount', text: "Enter the base value here.", focus: 'amountGlobal', x: 30, y: 45, setup: () => { setExpExpanded(true); setExpRows([{ id: 'r1', type: 'global', target: 'ALL', amount: '350.50', validFrom: '2026-05-26' }]); setDropdownOpen(false); setCompSelectOpen(false); setMclooOpen(false); setMclooMode('shared'); } },
      { title: 'Step 5: Add Exception', text: "To override the global rule, click 'ADD RULE FOR'. Here you can choose between adding a 'Company' exception or a 'Contract' rule depending on your needs.", focus: 'addDropdown', x: 40, y: 45, setup: () => { setExpExpanded(true); setExpRows([{ id: 'r1', type: 'global', target: 'ALL', amount: '350.50', validFrom: '2026-05-26' }]); setDropdownOpen(true); setCompSelectOpen(false); setMclooOpen(false); setMclooMode('shared'); } },
      { title: 'Step 6: Select Type', text: "Choose 'Company' to make an exception for a specific fleet.", focus: 'addCompanyItem', x: 40, y: 45, setup: () => { setExpExpanded(true); setExpRows([{ id: 'r2', type: 'company', target: '', amount: '', validFrom: '' }, { id: 'r1', type: 'global', target: 'ALL', amount: '350.50', validFrom: '2026-05-26' }]); setDropdownOpen(true); setCompSelectOpen(false); setMclooOpen(false); setMclooMode('shared'); } },
      { title: 'Step 7: Target Company', text: "Click on the dropdown to view the list of existing fleets and choose the target company.", focus: 'selectCompany', x: 65, y: 55, setup: () => { setExpExpanded(true); setExpRows([{ id: 'r2', type: 'company', target: '', amount: '', validFrom: '' }, { id: 'r1', type: 'global', target: 'ALL', amount: '350.50', validFrom: '2026-05-26' }]); setDropdownOpen(false); setCompSelectOpen(true); setMclooOpen(false); setMclooMode('shared'); } },
      { title: 'Step 8: Add New Company', text: "If the company isn't listed, select the '+ Add new company' option from the dropdown. This will open an interactive prompt allowing you to type and create a new company on the fly.", focus: 'selectCompany', x: 65, y: 65, setup: () => { setExpExpanded(true); setExpRows([{ id: 'r2', type: 'company', target: '', amount: '', validFrom: '' }, { id: 'r1', type: 'global', target: 'ALL', amount: '350.50', validFrom: '2026-05-26' }]); setDropdownOpen(false); setCompSelectOpen(true); setMclooOpen(false); setMclooMode('shared'); } },
      { title: 'Step 9: Effective Dates', text: "Set when this specific override starts and ends. Just like before, 'Valid To' can be left empty.", focus: 'datesCompany', x: 65, y: 55, setup: () => { setExpExpanded(true); setExpRows([{ id: 'r2', type: 'company', target: 'Test Company', amount: '', validFrom: '2026-06-01' }, { id: 'r1', type: 'global', target: 'ALL', amount: '350.50', validFrom: '2026-05-26' }]); setDropdownOpen(false); setCompSelectOpen(false); setMclooOpen(false); setMclooMode('shared'); } },
      { title: 'Step 10: Override Amount', text: "Enter the new amount just for this company.", focus: 'amountCompany', x: 30, y: 55, setup: () => { setExpExpanded(true); setExpRows([{ id: 'r2', type: 'company', target: 'Test Company', amount: '400.00', validFrom: '2026-06-01' }, { id: 'r1', type: 'global', target: 'ALL', amount: '350.50', validFrom: '2026-05-26' }]); setDropdownOpen(false); setCompSelectOpen(false); setMclooOpen(false); setMclooMode('shared'); } },
      { title: 'Step 11: Edit MCLOO Rule', text: "If this expense is Liability Insurance, you can configure shared responsibility by clicking 'Edit MCLOO Rule'.", focus: 'editMcloo', x: 30, y: 65, setup: () => { setExpExpanded(true); setExpRows([{ id: 'r2', type: 'company', target: 'Test Company', amount: '400.00', validFrom: '2026-06-01' }, { id: 'r1', type: 'global', target: 'ALL', amount: '350.50', validFrom: '2026-05-26' }]); setDropdownOpen(false); setCompSelectOpen(false); setMclooOpen(false); setMclooMode('shared'); } },
      { title: 'Step 12: MCLOO Panel', text: "The MCLOO panel opens, allowing you to configure shared responsibility for this specific rule.", focus: 'mclooPanel', x: 50, y: 25, setup: () => { setExpExpanded(true); setExpRows([{ id: 'r2', type: 'company', target: 'Test Company', amount: '400.00', validFrom: '2026-06-01' }, { id: 'r1', type: 'global', target: 'ALL', amount: '350.50', validFrom: '2026-05-26' }]); setDropdownOpen(false); setCompSelectOpen(false); setMclooOpen(true); setMclooMode('shared'); } },
      { title: 'Step 13: Save Changes', text: "Always remember to click Save and Close to apply your structural changes.", focus: 'saveBtn', x: 50, y: 50, setup: () => { setExpExpanded(true); setExpRows([{ id: 'r2', type: 'company', target: 'Test Company', amount: '400.00', validFrom: '2026-06-01' }, { id: 'r1', type: 'global', target: 'ALL', amount: '350.50', validFrom: '2026-05-26' }]); setDropdownOpen(false); setCompSelectOpen(false); setMclooOpen(true); setMclooMode('shared'); } },
      { title: 'Done!', text: "You now know exactly how to manage hierarchical rules.", focus: null, x: 50, y: 50, setup: () => { setExpExpanded(true); setExpRows([{ id: 'r2', type: 'company', target: 'Test Company', amount: '400.00', validFrom: '2026-06-01' }, { id: 'r1', type: 'global', target: 'ALL', amount: '350.50', validFrom: '2026-05-26' }]); setDropdownOpen(false); setCompSelectOpen(false); setMclooOpen(true); setMclooMode('shared'); } }
  ] : [
      { title: 'Tutorial Overview', text: "Learn how to apply custom reductions to Truck or Trailer prices, and how they combine.", focus: null, x: 50, y: 20, setup: () => { setExpExpanded(false); setExpRows([]); setReductionModalOpen(false); setDropdownOpen(false); setIncludeDropdownOpen(false); } },
      { title: 'Step 1: Expand Category', text: "Expand the category to see the base rules.", focus: 'expChevron', x: 50, y: 20, setup: () => { setExpExpanded(true); setReductionModalOpen(false); } },
      { title: 'Step 2: Open Reductions', text: "Click MANAGE REDUCTIONS to open the configuration panel.", focus: 'manageReductions', x: 70, y: 20, setup: () => { setExpExpanded(true); setReductionModalOpen(false); } },
      { title: 'Step 3: Apply To', text: "First, select whether this applies globally, or to a specific company/contract.", focus: 'redApplyTo', x: 30, y: 75, setup: () => { setExpExpanded(true); setReductionModalOpen(true); } },
      { title: 'Step 4: Set Dates', text: "Set the start and end dates. You can leave 'Valid To' blank, and the reduction will apply indefinitely to all future dates.", focus: 'redDates', x: 60, y: 75, setup: () => { setExpExpanded(true); setReductionModalOpen(true); } },
      { title: 'Step 5: Amount', text: "Enter the reduction amount here.", focus: 'redAmount', x: 85, y: 75, setup: () => { setExpExpanded(true); setReductionModalOpen(true); } },
      { title: 'Step 6: Note', text: "You can write a detailed, formatted note explaining why this reduction exists.", focus: 'redNote', x: 50, y: 25, setup: () => { setExpExpanded(true); setReductionModalOpen(true); } },
      { title: 'Step 7: Apply', text: "Click Apply Reduction to save it.", focus: 'redApplyBtn', x: 80, y: 85, setup: () => { setExpExpanded(true); setReductionModalOpen(true); } },
      { title: 'Step 8: Base Subtraction', text: "The original price ($1000) is crossed out. The active price is now $800 after the $200 global reduction.", focus: 'redCrossedOut', x: 50, y: 25, setup: () => { setExpExpanded(true); setReductionModalOpen(false); } },
      { title: 'Step 9: Contract Reductions', text: "A Contract-specific reduction (e.g., $50 for TPOG) appears below. TPOG drivers get this extra discount ($750 final).", focus: 'redAttached', x: 50, y: 35, setup: () => { setExpExpanded(true); setReductionModalOpen(false); } },
      { title: 'Step 10: Company Combination', text: "When a Company rule ($1200) exists, it's FIRST reduced by the global $200 (making it $1000). The contract reduction ($50) then applies on top ($950 final).", focus: 'redCombined', x: 50, y: 65, setup: () => { setExpExpanded(true); setReductionModalOpen(false); } },
           { title: 'Done!', text: "You now understand how truck and trailer price reductions work.", focus: null, x: 50, y: 50, setup: () => { setExpExpanded(true); setReductionModalOpen(false); } }
  ];

  const steps = localTab === 'contracts' ? contractSteps : (localTab === 'dispatcher' ? dispatcherSteps : (localTab === 'fixed_revenue' ? fixedRevenueSteps : (localTab === 'cpm' ? cpmSteps : (localTab === 'pnl' ? pnlSteps : (localTab === 'fuel_rebate' ? fuelRebateSteps : fixedSteps)))));

  React.useEffect(() => {
    if (!isOpen) {
      setStep(0);
      setFocusArea(null);
      setExpExpanded(false);
      setExpRows([]);
      setDropdownOpen(false);
      setCompSelectOpen(false);
      setMclooOpen(false);
      setMclooMode('shared');
      setIncludeDropdownOpen(false);
           setConExpanded(false);
      setConNewRule(false);
      setConGross('');
      setConMargin('');
      setConValidFrom('');
      setConValidTo('');
      setConTypeOpen(false);
      setDispExpanded(false);
      setDispPayTab('gross_margin');
      setDispContract('');
      setDispCompany('');
      setDispTeam('');
      setDispDispatcher('');
      setDispType('%');
      setDispValidFrom('');
      setDispValidTo('');
      setDispGross('');
      setDispMargin('');
      setDispAmount('');
      setDispMclooPay('');
      setCpmRows([]);
      setCpmAddDropdownOpen(false);
      setCpmTargetOpen(false);
      setPnlExpanded(false);
      setPnlChecked(false);
      setFrRows([]);
      setFrAddDropdownOpen(false);
      setFrTargetOpen(false);
      setFixRevExpanded(false);
      setFixRevRows([]);
      setFixRevDropdownOpen(false);
      setFixRevTargetOpen(false);
      setReductionModalOpen(false);
      setMessage({ title: '', text: '', visible: false, x: 50, y: 50 });
      return;
    }
    setLocalTab(activeTab);
  }, [isOpen, activeTab]);

    React.useEffect(() => {
      if (isOpen) {
          const current = steps[step];
          if (current) {
              setFocusArea(current.focus);
              current.setup();
          }
      } else {
          setFocusArea(null);
      }
  }, [step, isOpen, localTab, tutorialType]);

  const nextStep = () => { if (step < steps.length - 1) setStep(step + 1); };
  const prevStep = () => { if (step > 0) setStep(step - 1); };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/30 backdrop-blur-sm pointer-events-auto">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-5xl h-[85vh] max-h-[750px] flex flex-col shadow-2xl relative overflow-hidden pointer-events-none">
        {focusArea && !reductionModalOpen && <div className="absolute inset-0 z-[9998] bg-black/20 pointer-events-none transition-all duration-300"></div>}
        
        
                              {(localTab === 'fixed' || localTab === 'contracts' || localTab === 'dispatcher' || localTab === 'fixed_revenue' || localTab === 'cpm' || localTab === 'pnl' || localTab === 'fuel_rebate') && (
          <div
            className="absolute z-[10000] transition-all duration-500 ease-in-out bg-zinc-900 border border-emerald-500 shadow-[0_10px_40px_rgba(16,185,129,0.4)] p-4 rounded-lg w-[320px] pointer-events-auto flex flex-col gap-3"
            style={{ left: `${steps[step]?.x || 50}%`, top: `${steps[step]?.y || 50}%`, transform: 'translate(-50%, -50%)' }}
          >
            <div>
               <h4 className="text-emerald-500 font-bold text-sm mb-1">{steps[step]?.title}</h4>
               <p className="text-zinc-300 text-xs leading-relaxed">{steps[step]?.text}</p>
            </div>
            <div className="flex items-center justify-between mt-1 pt-3 border-t border-zinc-800">
               <button onClick={prevStep} disabled={step === 0} className="flex items-center gap-1 text-[10px] font-bold uppercase px-3 py-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={14}/> Prev</button>
               <span className="text-[10px] text-zinc-500 font-mono font-bold">{step + 1} / {steps.length}</span>
               <button onClick={nextStep} disabled={step === steps.length - 1} className="flex items-center gap-1 text-[10px] font-bold uppercase px-3 py-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30">Next <ChevronRight size={14}/></button>
            </div>
          </div>
        )}
                {(localTab !== 'fixed' && localTab !== 'contracts' && localTab !== 'dispatcher' && localTab !== 'fixed_revenue' && localTab !== 'cpm' && localTab !== 'pnl' && localTab !== 'fuel_rebate') && (
           <div className="absolute z-[10000] transition-all duration-500 ease-out bg-zinc-900 border border-emerald-500 p-4 rounded-lg shadow-[0_10px_40px_rgba(16,185,129,0.4)] min-w-[280px] max-w-sm pointer-events-none" style={{ left: '50%', top: '40%', transform: 'translate(-50%, -50%)' }}>
            <h4 className="text-emerald-500 font-bold text-sm mb-1">{localTab.toUpperCase()}</h4>
            <p className="text-zinc-300 text-xs leading-relaxed">Explore the structure mirroring exactly what you'll see in the live app.</p>
          </div>
        )}

        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950 rounded-t-lg relative flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/10 rounded text-emerald-500">
              <Sliders size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Structural Settings (Tutorial Mode)</h2>
              <p className="text-xs text-zinc-500">Follow the cursor and explanations to learn exactly how the system operates.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-rose-400 pointer-events-auto hover:text-rose-300 transition-colors bg-rose-500/10 border border-rose-500/30 p-2 rounded-lg flex items-center gap-2 shadow-[0_0_15px_rgba(244,63,94,0.3)] z-[10000] relative">
            <span className="text-xs font-bold uppercase">End Tutorial</span>
            <X size={16} />
          </button>
        </div>

        <div className="flex px-6 pt-2 border-b border-zinc-800 gap-2 bg-zinc-950 overflow-x-auto flex-shrink-0 relative">
            <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 whitespace-nowrap ${localTab === 'fixed' ? 'border-blue-500 text-blue-500' : 'border-transparent text-zinc-500'}`}>Expenses</div>
            <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 whitespace-nowrap ${localTab === 'contracts' ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-zinc-500'}`}>Contract Rules</div>
            <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 whitespace-nowrap ${localTab === 'dispatcher' ? 'border-purple-500 text-purple-500' : 'border-transparent text-zinc-500'}`}>Dispatcher Pay</div>
            <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 whitespace-nowrap ${localTab === 'fixed_revenue' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-zinc-500'}`}>Fixed Revenue</div>
            <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 whitespace-nowrap ${localTab === 'cpm' ? 'border-pink-500 text-pink-500' : 'border-transparent text-zinc-500'}`}>CPM REVENUE</div>
            <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 whitespace-nowrap ${localTab === 'pnl' ? 'border-cyan-500 text-cyan-500' : 'border-transparent text-zinc-500'}`}>PNL CALCULATION</div>
            <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 whitespace-nowrap ${localTab === 'fuel_rebate' ? 'border-rose-500 text-rose-500' : 'border-transparent text-zinc-500'}`}>FUEL REBATE</div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-zinc-950/30">
          <div className="max-w-6xl mx-auto">
            
            {localTab === 'fixed' && (
              <div className="w-full relative">
                <div className="w-full border border-zinc-800 rounded-lg overflow-visible bg-zinc-950/50">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-900 border-b border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        <th className="p-2 font-bold px-4">Expense Name</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      <tr>
                        <td className={`p-3 px-4 text-sm font-bold flex items-center gap-2 ${expExpanded ? 'text-blue-400 bg-zinc-800/30' : 'text-blue-400'} ${focusArea === 'expChevron' ? 'relative z-[9999] ring-2 ring-emerald-500 bg-zinc-900 shadow-[0_0_15px_rgba(16,185,129,0.3)] rounded' : 'transition-colors'}`}>
                          <ChevronDown size={14} className={`transition-transform ${expExpanded ? 'rotate-180' : '-rotate-90'}`} />
                          <span>{tutorialType === 'reductions' ? 'Truck Price' : 'Liability Insurance'}</span>
                        </td>
                      </tr>
                      {expExpanded && (
                        <tr>
                          <td colSpan={1} className="p-0">
                            <div className="p-4 bg-[#0a0a0a] border-t border-zinc-800">
                               <div className="flex items-center justify-between mb-4">
                                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Rules History</h4>
                                  <div className="flex items-center gap-3">
                                      <div className={`px-3 py-1.5 border border-emerald-500/30 text-emerald-500 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${focusArea === 'addGlobal' ? 'relative z-[9999] ring-2 ring-emerald-500 bg-zinc-900 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : ''}`}>
                                          <Plus size={12} /> ADD GLOBAL RULE
                                      </div>
                                      <div className="relative">
                                         <div className={`px-3 py-1.5 border border-amber-500/30 text-amber-500 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${focusArea === 'addDropdown' ? 'relative z-[9999] ring-2 ring-amber-500 bg-zinc-900 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : ''}`}>
                                            <Plus size={12} /> ADD RULE FOR <ChevronDown size={10} />
                                         </div>
                                         {dropdownOpen && (
                                            <div className="absolute flex flex-col top-full right-0 mt-1 w-full z-[9999]">
                                               <div className="bg-zinc-900 border border-zinc-700 rounded shadow-xl overflow-hidden flex flex-col w-full">
                                                  <div className="px-4 py-2 text-left text-[10px] font-bold text-purple-500 hover:bg-zinc-800 transition-colors border-b border-zinc-800">Contract</div>
                                                  <div className={`px-4 py-2 text-left text-[10px] font-bold text-amber-500 hover:bg-zinc-800 transition-colors ${focusArea === 'addCompanyItem' ? 'ring-2 ring-inset ring-emerald-500 bg-zinc-800' : ''}`}>Company</div>
                                               </div>
                                            </div>
                                         )}
                                      </div>
                                      {tutorialType === 'reductions' && (
                                          <div className={`px-3 py-1.5 border border-rose-500/30 text-rose-500 bg-rose-500/10 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ml-2 ${focusArea === 'manageReductions' ? 'relative z-[9999] ring-2 ring-rose-500 bg-zinc-900 shadow-[0_0_15px_rgba(244,63,94,0.5)]' : ''}`}>
                                              <Settings size={12} /> MANAGE REDUCTIONS
                                          </div>
                                      )}
                                  </div>
                               </div>
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                                    <th className="py-2 px-3 font-bold w-[15%]">Valid From</th>
                                    <th className="py-2 px-3 font-bold w-[15%]">Valid To</th>
                                    <th className="py-2 px-3 font-bold w-[30%]">Type / Company</th>
                                    {tutorialType === 'reductions' && <th className="py-2 px-3 font-bold w-[10%]">Reduction</th>}
                                    <th className="py-2 px-3 font-bold w-[25%]">Amount</th>
                                    <th className="py-2 px-3 font-bold text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/30">
                                  {tutorialType === 'reductions' ? (
                                      <>
                                          <tr className="bg-zinc-800/30 transition-colors">
                                             <td className="py-2 px-3">
                                                <div className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 h-7 flex items-center gap-2"><Calendar size={12} className="text-zinc-500"/><span>2026-05-26</span></div>
                                             </td>
                                             <td className="py-2 px-3">
                                                <div className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-500 h-7 flex items-center gap-2 opacity-50"><Calendar size={12} className="text-zinc-500"/><span>mm/dd/yyyy</span></div>
                                             </td>
                                             <td className="py-2 px-3">
                                                <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider h-7 flex items-center">Global (ALL)</div>
                                             </td>
                                             <td className="py-2 px-3">
                                                <div className="text-xs text-zinc-400 font-mono font-bold flex items-center gap-1.5">
                                                    {step >= 8 ? (
                                                        <>
                                                            <span>-$200</span>
                                                            <div className="relative group/note flex items-center">
                                                                <FileText size={12} className="text-emerald-500/70 hover:text-emerald-500 cursor-help" />
                                                                <div className="hidden group-hover/note:block absolute left-full ml-2 z-[100] w-max max-w-[200px] bg-zinc-800 text-zinc-200 text-[10px] p-2 rounded shadow-xl border border-zinc-700 whitespace-normal font-sans">Test Note</div>
                                                            </div>
                                                        </>
                                                    ) : '-'}
                                                </div>
                                             </td>
                                             <td className="py-2 px-3">
                                                <div className={`relative flex items-center justify-start w-32 bg-zinc-950 border border-zinc-700 rounded h-7 overflow-hidden ${focusArea === 'redCrossedOut' ? 'relative z-[9999] ring-2 ring-emerald-500 bg-zinc-900 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : ''}`}>
                                                   <span className="pl-2 text-zinc-500 text-xs pointer-events-none flex-shrink-0">$</span>
                                                   {step >= 8 ? (
                                                       <>
                                                          <input type="number" value="1000" readOnly className="flex-none pr-1 line-through text-zinc-500 bg-transparent border-none outline-none py-1 pl-1 text-xs font-mono h-full w-16" />
                                                          <div className="flex items-center gap-0.5 whitespace-nowrap pointer-events-none">
                                                              <span className="text-xs text-zinc-200 font-mono pl-1">800</span>
                                                          </div>
                                                       </>
                                                   ) : (
                                                       <input type="number" value="1000" readOnly className="w-16 pr-1 text-zinc-200 bg-transparent border-none outline-none py-1 pl-1 text-xs font-mono h-full" />
                                                   )}
                                                </div>
                                             </td>
                                             <td className="py-2 px-3 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <button className="text-zinc-500 hover:text-rose-500 transition-colors p-1 rounded flex justify-center items-center"><Trash2 size={14}/></button>
                                                </div>
                                             </td>
                                          </tr>
                                          {step >= 9 && (
                                              <tr className={`bg-rose-500/5 transition-colors ${focusArea === 'redAttached' ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-rose-900/20' : ''}`}>
                                                  <td className="py-1.5 px-3"></td>
                                                  <td className="py-1.5 px-3 relative">
                                                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500/50">
                                                          <CornerDownRight size={16} />
                                                      </div>
                                                  </td>
                                                  <td className="py-1.5 px-3">
                                                      <div className="flex items-center border-l-2 border-rose-500/30 pl-2">
                                                          <span className="text-xs text-zinc-300 font-bold">Contract: TPOG</span>
                                                      </div>
                                                  </td>
                                                  <td className="py-1.5 px-3">
                                                      <div className="text-xs text-zinc-400 font-mono font-bold flex items-center gap-1.5">
                                                          <span>-$50</span>
                                                      </div>
                                                  </td>
                                                  <td className="py-1.5 px-3">
                                                      <div className="flex items-center h-7">
                                                          <span className="pl-2 text-zinc-500 text-xs pointer-events-none flex-shrink-0">$</span>
                                                          <span className="text-xs text-zinc-200 font-mono font-bold pl-1">750</span>
                                                      </div>
                                                  </td>
                                                  <td className="py-1.5 px-3 text-right"></td>
                                              </tr>
                                          )}
                                          {step >= 10 && (
                                              <>
                                                  <tr className={`bg-amber-500/5 transition-colors mt-2 border-t border-zinc-800/50 ${focusArea === 'redCombined' ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-amber-900/20' : ''}`}>
                                                     <td className="py-2 px-3">
                                                        <div className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 h-7 flex items-center gap-2"><Calendar size={12} className="text-zinc-500"/><span>2026-06-01</span></div>
                                                     </td>
                                                     <td className="py-2 px-3">
                                                        <div className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-500 h-7 flex items-center gap-2 opacity-50"><Calendar size={12} className="text-zinc-500"/><span>mm/dd/yyyy</span></div>
                                                     </td>
                                                     <td className="py-2 px-3">
                                                        <div className="w-full">
                                                            <select value="Test Company" readOnly className="w-full bg-zinc-950 border border-amber-700/50 rounded px-2 py-1 text-xs text-amber-500 font-bold outline-none h-7 appearance-none">
                                                               <option value="Test Company">Test Company</option>
                                                            </select>
                                                        </div>
                                                     </td>
                                                     <td className="py-2 px-3">
                                                        <div className="text-xs text-zinc-400 font-mono font-bold flex items-center gap-1.5">-</div>
                                                     </td>
                                                     <td className="py-2 px-3">
                                                        <div className="relative flex items-center justify-start w-32 bg-zinc-950 border border-amber-700/50 rounded h-7 overflow-hidden">
                                                           <span className="pl-2 text-zinc-500 text-xs pointer-events-none flex-shrink-0">$</span>
                                                           <input type="number" value="1200" readOnly className="flex-none pr-1 line-through text-zinc-500 bg-transparent border-none outline-none py-1 pl-1 text-xs font-mono h-full w-16" />
                                                           <div className="flex items-center gap-0.5 whitespace-nowrap pointer-events-none">
                                                               <span className="text-xs text-zinc-200 font-mono pl-1">1000</span>
                                                           </div>
                                                        </div>
                                                     </td>
                                                     <td className="py-2 px-3 text-right">
                                                        <div className="flex items-center justify-end gap-3">
                                                            <button className="text-zinc-500 hover:text-rose-500 transition-colors p-1 rounded flex justify-center items-center"><Trash2 size={14}/></button>
                                                        </div>
                                                     </td>
                                                  </tr>
                                                  <tr className={`bg-rose-500/5 transition-colors ${focusArea === 'redCombined' ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-rose-900/20' : ''}`}>
                                                      <td className="py-1.5 px-3"></td>
                                                      <td className="py-1.5 px-3 relative">
                                                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500/50">
                                                              <CornerDownRight size={16} />
                                                          </div>
                                                      </td>
                                                      <td className="py-1.5 px-3">
                                                          <div className="flex items-center border-l-2 border-rose-500/30 pl-2">
                                                              <span className="text-xs text-zinc-300 font-bold">Contract: TPOG</span>
                                                          </div>
                                                      </td>
                                                      <td className="py-1.5 px-3">
                                                          <div className="text-xs text-zinc-400 font-mono font-bold flex items-center gap-1.5">
                                                              <span>-$50</span>
                                                          </div>
                                                      </td>
                                                      <td className="py-1.5 px-3">
                                                          <div className="flex items-center h-7">
                                                              <span className="pl-2 text-zinc-500 text-xs pointer-events-none flex-shrink-0">$</span>
                                                              <span className="text-xs text-zinc-200 font-mono font-bold pl-1">950</span>
                                                          </div>
                                                      </td>
                                                      <td className="py-1.5 px-3 text-right"></td>
                                                  </tr>
                                              </>
                                          )}
                                      </>
                                  ) : expRows.map(row => (
                                    <React.Fragment key={row.id}>
                                      <tr className={`transition-colors ${row.type === 'global' ? 'hover:bg-zinc-800/30' : 'bg-amber-500/5 hover:bg-amber-500/10'}`}>
                                        <td className="py-2 px-3">
                                          <div className={`w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 h-7 flex items-center justify-between ${(row.id === 'r1' && focusArea === 'datesGlobal') || (row.id === 'r2' && focusArea === 'datesCompany') ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-zinc-900' : ''}`}>
                                            <span>{row.validFrom || 'mm/dd/yyyy'}</span>
                                          </div>
                                        </td>
                                        <td className="py-2 px-3">
                                          <div className={`w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-500 h-7 flex items-center justify-between ${(row.id === 'r1' && focusArea === 'datesGlobal') || (row.id === 'r2' && focusArea === 'datesCompany') ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-zinc-900 opacity-100' : 'opacity-50'}`}>
                                              <span>mm/dd/yyyy</span>
                                          </div>
                                        </td>
                                        <td className="py-2 px-3">
                                          {row.type === 'global' ? (
                                            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider h-7 flex items-center">Global Rule</div>
                                          ) : (
                                            <div className={`w-full relative ${row.id === 'r2' && focusArea === 'selectCompany' ? 'relative z-[9999] ring-2 ring-emerald-500 bg-zinc-950 rounded shadow-[0_0_15px_rgba(16,185,129,0.3)]' : ''}`}>
                                                <select value={row.target} readOnly className="w-full bg-zinc-950 border border-amber-700/50 rounded px-2 py-1 text-xs text-amber-500 font-bold focus:border-amber-500 outline-none h-7 appearance-none">
                                                   <option value="" disabled>Select Company</option>
                                                   <option value="NEW_COMPANY" className="text-emerald-500 font-bold">+ Add new company</option>
                                                   <option value="Test Company">Test Company</option>
                                                </select>
                                                {compSelectOpen && (
                                                   <div className="absolute flex flex-col top-full left-0 mt-1 w-full z-[9999]">
                                                      <div className="bg-zinc-900 border border-zinc-700 rounded shadow-xl overflow-hidden flex flex-col w-full">
                                                         <div className={`px-4 py-2 text-left text-[10px] font-bold text-emerald-500 hover:bg-zinc-800 transition-colors border-b border-zinc-800 ${step === 8 ? 'ring-2 ring-inset ring-emerald-500 bg-zinc-800' : ''}`}>+ Add new company</div>
                                                         <div className={`px-4 py-2 text-left text-[10px] font-bold text-amber-500 hover:bg-zinc-800 transition-colors ${step === 7 ? 'ring-2 ring-inset ring-emerald-500 bg-zinc-800' : ''}`}>Test Company</div>
                                                      </div>
                                                   </div>
                                                )}
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-2 px-3">
                                          <div className={`relative flex items-center h-7 w-32 bg-zinc-950 border ${row.type === 'global' ? 'border-zinc-700' : 'border-amber-700/50'} rounded ${(row.id === 'r1' && focusArea === 'amountGlobal') || (row.id === 'r2' && focusArea === 'amountCompany') ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-zinc-900' : ''}`}>
                                            <span className={`absolute left-2 text-xs pointer-events-none ${row.type === 'global' ? 'text-zinc-500' : 'text-amber-500/50'}`}>$</span>
                                            <div className="w-full bg-transparent py-1 text-xs text-zinc-200 font-mono h-full pl-5 pr-8 flex items-center">{row.amount}</div>
                                            <Info size={12} className={`absolute right-2 ${row.type === 'global' ? 'text-zinc-500' : 'text-amber-500/70'}`} />
                                          </div>
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                           <div className="flex items-center justify-end gap-3">
                                               {tutorialType === 'rules' && (
                                                  <div className={`px-2 py-0.5 bg-amber-950 text-amber-500/70 text-[10px] rounded border border-amber-900/50 transition-colors h-max whitespace-nowrap cursor-pointer ${focusArea === 'editMcloo' && row.id === 'r2' ? 'relative z-[9999] ring-2 ring-emerald-500 bg-zinc-900 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : ''}`}>Edit MCLOO Rule</div>
                                               )}
                                               <button className="text-zinc-500 hover:text-rose-500 transition-colors p-1 rounded flex justify-center items-center"><Trash2 size={14}/></button>
                                           </div>
                                        </td>
                                      </tr>
                                      {mclooOpen && row.id === 'r2' && (
                                        <tr className="bg-amber-500/5">
                                          <td colSpan={5} className="px-3 pb-3 pt-0 border-t-0">
                                            <div className={`flex flex-col gap-3 bg-zinc-950/50 p-3 rounded-lg border border-amber-500/20 w-full relative ml-4 mt-2 transition-all ${focusArea === 'mclooPanel' ? 'relative z-[9999] ring-2 ring-emerald-500 bg-zinc-900 shadow-[0_0_20px_rgba(16,185,129,0.4)]' : ''}`}>
                                              <div className="absolute -top-2.5 -left-3 text-amber-500/30">
                                                  <CornerDownRight size={16} />
                                              </div>
                                              <div className="flex items-center gap-4 pl-4">
                                                <div className="flex flex-col gap-1 w-full">
                                                  <div className="flex items-center gap-1">
                                                    <label className="text-[8px] text-amber-500/70 font-bold uppercase tracking-wider">Shared Insurance (Per Unit)</label>
                                                    <div className="relative group/mcloo-tooltip flex items-center justify-center">
                                                      <Info size={12} className="text-amber-500/70 hover:text-amber-500 cursor-help transition-colors" />
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center gap-3">
                                                    <div className="relative h-7 w-32">
                                                      <span className="absolute left-2 top-1.5 text-amber-500/50 text-[10px] pointer-events-none">$</span>
                                                      <input type="number" value="250" readOnly className="w-full bg-zinc-900 border border-amber-700/50 rounded py-0 pl-6 pr-2 text-xs text-zinc-200 outline-none h-full" />
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {localTab === 'contracts' && (
              <div className="w-full border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/50">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-900 border-b border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      <th className="p-2 font-bold">Contract Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    <tr>
                      <td className={`p-3 text-sm font-bold flex items-center gap-2 ${conExpanded ? 'text-emerald-500 bg-zinc-800/30' : 'text-emerald-500'} ${focusArea === 'conChevron' ? 'relative z-[9999] ring-2 ring-emerald-500 bg-zinc-900 shadow-[0_0_15px_rgba(16,185,129,0.3)] rounded' : 'transition-colors'}`}>
                        <ChevronDown size={14} className={`transition-transform ${conExpanded ? 'rotate-180' : '-rotate-90'}`} />
                        <span>TPOG</span>
                      </td>
                    </tr>
                    {conExpanded && (
                      <tr>
                        <td className="p-0">
                          <div className="p-4 bg-zinc-900/30 border-t border-zinc-800">
                            <table className="w-full text-left border-collapse table-fixed">
                              <thead>
                                <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                                  <th className="py-2 pr-2 font-bold w-[70%]">Formula</th>
                                  <th className="py-2 px-1 font-bold w-[12%]">Valid From</th>
                                  <th className="py-2 px-1 font-bold w-[12%]">Valid To</th>
                                  <th className="w-[6%]"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-800/30">
                                {conNewRule && (
                                  <tr className="hover:bg-zinc-800/30 transition-colors group/row">
                                    <td className="py-2 pr-2">
                                      <div className="flex flex-col gap-2 w-full">
                                          <div className="relative w-max">
                                             <div className={`w-max bg-zinc-950 border border-zinc-700 rounded py-1 px-2 text-[10px] text-zinc-300 h-7 flex items-center justify-between gap-2 cursor-pointer ${focusArea === 'conFormulaType' ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : ''}`}>
                                                <span>TPOG</span>
                                                <ChevronDown size={12} className="text-zinc-500" />
                                             </div>
                                             {conTypeOpen && (
                                                <div className="absolute top-full left-0 mt-1 w-36 bg-zinc-900 border border-zinc-700 rounded shadow-xl overflow-hidden flex flex-col z-[10000]">
                                                   <div className="px-2 py-1.5 text-[10px] text-zinc-300 hover:bg-zinc-800 cursor-pointer bg-zinc-800">TPOG</div>
                                                   <div className="px-2 py-1.5 text-[10px] text-zinc-300 hover:bg-zinc-800 cursor-pointer">New TPOG Formula</div>
                                                </div>
                                             )}
                                          </div>
                                         <div className={`flex items-center whitespace-nowrap text-[11px] text-zinc-300 font-mono bg-zinc-900/50 px-2 pt-4 pb-1.5 rounded border border-zinc-800 w-max relative ${focusArea === 'conFormulaRow' ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : ''}`}>
                                             Gross * ((1 - Drv%) - 
                                             <div className="relative inline-flex items-center h-6 mx-1 w-20 mt-3">
                                                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] text-zinc-500 font-bold uppercase tracking-tighter">Comp Gross</span>
                                                <div className={`w-full bg-zinc-950 border border-zinc-700 rounded py-0.5 pl-2 pr-4 text-[10px] font-mono text-right text-emerald-400 h-full flex items-center justify-end ${focusArea === 'conGrossInput' ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : ''}`}>{conGross}</div>
                                                <span className="absolute right-1 text-zinc-500 text-[9px]">%</span>
                                             </div>
                                             ) + Margin * <div className="relative inline-flex items-center h-6 mx-1 w-20 mt-3">
                                                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] text-zinc-500 font-bold uppercase tracking-tighter">Comp Margin</span>
                                                <div className={`w-full bg-zinc-950 border border-zinc-700 rounded py-0.5 pl-2 pr-4 text-[10px] font-mono text-right text-amber-400 h-full flex items-center justify-end ${focusArea === 'conMarginInput' ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : ''}`}>{conMargin}</div>
                                                <span className="absolute right-1 text-zinc-500 text-[9px]">%</span>
                                             </div>
                                          </div>
                                      </div>
                                    </td>
                                    <td className="py-2 px-1 align-top pt-3">
                                      <div className={`w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-200 h-7 flex items-center gap-2 ${focusArea === 'conDateInput' ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : ''}`}>
                                         <Calendar size={12} className="text-zinc-500 flex-shrink-0" />
                                         <span>{conValidFrom || 'mm/dd/yyyy'}</span>
                                      </div>
                                    </td>
                                    <td className="py-2 px-1 align-top pt-3">
                                      <div className={`w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-200 h-7 flex items-center gap-2 opacity-50 ${focusArea === 'conDateInput' ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] opacity-100' : ''}`}>
                                         <Calendar size={12} className="text-zinc-500 flex-shrink-0" />
                                         <span>{conValidTo || 'mm/dd/yyyy'}</span>
                                      </div>
                                    </td>
                                    <td className="py-2 pl-2 text-right align-top pt-3">
                                        <button className="text-zinc-600 hover:text-rose-500 transition-colors p-1 rounded opacity-0 group-hover/row:opacity-100 flex justify-center items-center w-8 h-7"><Trash2 size={14} /></button>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                            <div className={`w-max px-4 py-1.5 border border-dashed border-emerald-500 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 mt-3 shadow-[0_0_15px_rgba(16,185,129,0.2)] ${focusArea === 'addContractRule' ? 'relative z-[9999] ring-2 ring-emerald-500 bg-zinc-900 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'transition-colors'}`}>
                              <Plus size={12} /> ADD RULE
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {localTab === 'dispatcher' && (
              <div className="w-full relative">
                 <div className="sticky top-[-24px] z-[50] flex items-center justify-between pb-3 pt-6 border-b border-zinc-800/50 mb-2 bg-zinc-950/95 backdrop-blur-sm -mx-2 px-2 rounded-b-lg">
                    <div className={`flex bg-zinc-900/50 p-1 rounded-lg border border-zinc-800 transition-all ${focusArea === 'dispTabGross' || focusArea === 'dispTabShared' ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : ''}`}>
                       <button className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${dispPayTab === 'gross_margin' ? 'bg-purple-500 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>Gross/Margin %</button>
                       <button className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${dispPayTab === 'shared_responsibility' ? 'bg-purple-500 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>Shared Insurance</button>
                    </div>
                 </div>
                 <div className="w-full border border-zinc-800 rounded-lg overflow-visible bg-zinc-950/50 p-4 relative">
                    {dispPayTab === 'gross_margin' ? (
                       <>
                          <table className="w-full text-left border-collapse table-fixed">
                             <thead>
                                <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                                   <th className="py-2 pr-1 font-bold w-[10%]">Contract</th>
                                   <th className="py-2 px-1 font-bold w-[12%]">Company</th>
                                   <th className="py-2 px-1 font-bold w-[12%]">Team</th>
                                   <th className="py-2 px-1 font-bold w-[12%]">Dispatcher</th>
                                   <th className="py-2 px-1 font-bold w-[11%]">Valid From</th>
                                   <th className="py-2 px-1 font-bold w-[11%]">Valid To</th>
                                   <th className="py-2 px-1 font-bold w-[8%]">Type</th>
                                   <th className="py-2 px-1 font-bold w-[19%]">Values</th>
                                   <th className="w-[5%]"></th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-zinc-800/30">
                                {dispExpanded && (
                                   <tr className={`hover:bg-zinc-800/30 transition-colors group/row ${focusArea === 'dispRow' ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-zinc-900' : ''}`}>
                                      <td className="py-2 pr-1">
                                         <select value={dispContract} readOnly className={`w-full bg-zinc-950 border border-purple-700/50 rounded px-1 py-1 text-xs text-purple-500 font-bold outline-none h-7 ${focusArea === 'dispContractInput' ? 'ring-2 ring-emerald-500' : ''}`}>
                                            <option value="">ALL</option>
                                         </select>
                                      </td>
                                      <td className="py-2 px-1">
                                         <select value={dispCompany} readOnly className="w-full bg-zinc-950 border border-zinc-700 rounded px-1 py-1 text-xs text-zinc-300 outline-none h-7">
                                            <option value="">ALL</option>
                                         </select>
                                      </td>
                                      <td className="py-2 px-1">
                                         <select value={dispTeam} readOnly className="w-full bg-zinc-950 border border-zinc-700 rounded px-1 py-1 text-xs text-zinc-300 outline-none h-7">
                                            <option value="">ALL</option>
                                         </select>
                                      </td>
                                      <td className="py-2 px-1">
                                         <select value={dispDispatcher} readOnly className="w-full bg-zinc-950 border border-zinc-700 rounded px-1 py-1 text-xs text-zinc-300 outline-none h-7">
                                            <option value="">ALL</option>
                                         </select>
                                      </td>
                                      <td className="py-2 px-1">
                                         <input type="date" value={dispValidFrom} readOnly style={{ colorScheme: 'dark' }} className={`w-full bg-zinc-950 border border-zinc-700 rounded px-1 py-1 text-[10px] text-zinc-200 outline-none h-7 ${focusArea === 'dispValidFromInput' ? 'ring-2 ring-emerald-500' : ''}`} />
                                      </td>
                                      <td className="py-2 px-1">
                                         <input type="date" value={dispValidTo} readOnly style={{ colorScheme: 'dark' }} className="w-full bg-zinc-950 border border-zinc-700 rounded px-1 py-1 text-[10px] text-zinc-200 outline-none h-7" />
                                      </td>
                                      <td className="py-2 px-1">
                                         <select value={dispType} readOnly className={`w-full bg-zinc-950 border border-zinc-700 rounded px-1 py-1 text-xs text-zinc-300 outline-none h-7 ${focusArea === 'dispTypeInput' ? 'ring-2 ring-emerald-500' : ''}`}>
                                            <option value="%">%</option>
                                         </select>
                                      </td>
                                      <td className="py-2 px-1">
                                         <div className="flex gap-1 h-7">
                                            <div className={`relative flex items-center flex-1 h-full ${focusArea === 'dispGrossInput' ? 'ring-2 ring-emerald-500 rounded' : ''}`}>
                                               <input type="number" value={dispGross} readOnly className="w-full bg-zinc-950 border border-zinc-700 rounded py-1 pl-1 pr-4 text-[11px] text-zinc-200 font-mono outline-none h-full" placeholder="Gross" />
                                               <span className="absolute right-1 text-zinc-500 text-[9px] pointer-events-none">%</span>
                                            </div>
                                            <div className={`relative flex items-center flex-1 h-full ${focusArea === 'dispMarginInput' ? 'ring-2 ring-emerald-500 rounded' : ''}`}>
                                               <input type="number" value={dispMargin} readOnly className="w-full bg-zinc-950 border border-zinc-700 rounded py-1 pl-1 pr-4 text-[11px] text-zinc-200 font-mono outline-none h-full" placeholder="Margin" />
                                               <span className="absolute right-1 text-zinc-500 text-[9px] pointer-events-none">%</span>
                                            </div>
                                         </div>
                                      </td>
                                      <td className="py-2 pl-2 text-right">
                                         <button className="text-zinc-600 p-1 rounded flex justify-center items-center w-8 h-7"><Trash2 size={14} /></button>
                                      </td>
                                   </tr>
                                )}
                             </tbody>
                          </table>
                          <div className={`w-max px-4 py-1.5 border border-dashed border-purple-500/30 bg-purple-500/5 text-purple-500 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 mt-3 ${focusArea === 'dispChevron' ? 'relative z-[9999] ring-2 ring-emerald-500 bg-zinc-900 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'transition-colors'}`}>
                            <Plus size={12} /> ADD RULE
                          </div>
                       </>
                    ) : (
                       <div className="flex flex-col gap-3 w-full">
                          <div className="flex items-center gap-4 py-1.5">
                             <div className="w-32 text-xs font-bold text-zinc-300 truncate">Test Company</div>
                             <div className="w-32 text-xs text-amber-500 font-mono">Shared: $250.00</div>
                             <div className="flex items-center gap-2">
                                <label className="text-[10px] text-purple-500/70 font-bold uppercase">DISPATCHER PAYS:</label>
                                <div className={`relative h-7 w-24 ${focusArea === 'dispMclooInput' ? 'relative z-[9999] ring-2 ring-emerald-500 rounded shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-zinc-900' : ''}`}>
                                   <span className="absolute left-2 top-1.5 text-purple-500/50 text-[10px] pointer-events-none">$</span>
                                   <input type="number" value={dispMclooPay} readOnly className="w-full bg-zinc-900 border border-purple-700/50 rounded py-0 pl-6 pr-2 text-xs text-zinc-200 outline-none h-full" />
                                </div>
                             </div>
                          </div>
                       </div>
                    )}
                 </div>
              </div>
            )}

            {localTab === 'fixed_revenue' && (
              <div className="w-full relative">
                <div className="w-full border border-zinc-800 rounded-lg overflow-visible bg-zinc-950/50">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-900 border-b border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        <th className="p-2 font-bold px-4">Revenue Item</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      <tr>
                        <td className={`p-3 px-4 text-sm font-bold flex items-center gap-2 ${fixRevExpanded ? 'text-indigo-400 bg-zinc-800/30' : 'text-indigo-400'} ${focusArea === 'fixRevChevron' ? 'relative z-[9999] ring-2 ring-emerald-500 bg-zinc-900 shadow-[0_0_15px_rgba(16,185,129,0.3)] rounded' : 'transition-colors'}`}>
                          <ChevronDown size={14} className={`transition-transform ${fixRevExpanded ? 'rotate-180' : '-rotate-90'}`} />
                          <span>Truck Weekly</span>
                        </td>
                      </tr>
                      {fixRevExpanded && (
                        <tr>
                          <td colSpan={1} className="p-0">
                            <div className="p-4 bg-zinc-900/30 border-t border-zinc-800">
                               <div className="flex items-center justify-between mb-4">
                                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Rules History</h4>
                                  <div className="flex items-center gap-3">
                                      <div className={`px-3 py-1.5 border border-emerald-500/30 text-emerald-500 bg-emerald-500/10 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${focusArea === 'fixRevAddGlobal' ? 'relative z-[9999] ring-2 ring-emerald-500 bg-zinc-900 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : ''}`}>
                                          <Plus size={12} /> ADD GLOBAL RULE
                                      </div>
                                      <div className="relative">
                                         <div className={`px-3 py-1.5 border border-indigo-500/30 text-indigo-500 bg-indigo-500/10 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${focusArea === 'fixRevAddDropdown' ? 'relative z-[9999] ring-2 ring-indigo-500 bg-zinc-900 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : ''}`}>
                                            <Plus size={12} /> Add Rule For <ChevronDown size={10} />
                                         </div>
                                         {fixRevDropdownOpen && (
                                            <div className="absolute flex flex-col top-full right-0 mt-1 w-32 z-[9999]">
                                               <div className="bg-zinc-900 border border-zinc-700 rounded shadow-xl overflow-hidden flex flex-col w-full">
                                                  <div className={`px-4 py-2 text-left text-[10px] font-bold text-purple-500 hover:bg-zinc-800 transition-colors border-b border-zinc-800 ${focusArea === 'fixRevAddContractItem' ? 'ring-2 ring-inset ring-emerald-500 bg-zinc-800' : ''}`}>Contract</div>
                                                  <div className="px-4 py-2 text-left text-[10px] font-bold text-amber-500 hover:bg-zinc-800 transition-colors border-b border-zinc-800">Company</div>
                                                  <div className="px-4 py-2 text-left text-[10px] font-bold text-indigo-500 hover:bg-zinc-800 transition-colors">Franchise</div>
                                               </div>
                                            </div>
                                         )}
                                      </div>
                                  </div>
                               </div>
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                                    <th className="py-2 px-3 font-bold w-[15%]">Valid From</th>
                                    <th className="py-2 px-3 font-bold w-[15%]">Valid To</th>
                                    <th className="py-2 px-3 font-bold w-[25%]">Type / Scope</th>
                                    <th className="py-2 px-3 font-bold">Amount</th>
                                    <th className="py-2 px-3 font-bold text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/30">
                                  {step >= 1 && step <= 11 && (
                                      <tr className={`hover:bg-zinc-800/30 transition-colors ${focusArea === 'fixRevCustomCheckbox' ? 'relative z-[9999] ring-2 ring-emerald-500 bg-zinc-900 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : ''}`}>
                                        <td className="py-1.5 px-3">
                                          <input type="date" value="2026-05-20" disabled className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-500 cursor-not-allowed h-7" />
                                        </td>
                                        <td className="py-1.5 px-3">
                                          <input type="date" value="2026-05-26" disabled className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-500 cursor-not-allowed h-7" />
                                        </td>
                                        <td className="py-2 px-3 text-xs text-zinc-500 font-bold uppercase tracking-wider">
                                          Contract: TPOG
                                        </td>
                                        <td className="py-2 px-3">
                                          <div className="flex items-center gap-4">
                                            <div className={`relative flex items-center justify-start bg-zinc-950 border border-zinc-700 rounded h-7 overflow-hidden ${step === 2 ? '' : 'opacity-50'}`}>
                                              <span className="pl-2 text-zinc-500 text-xs pointer-events-none flex-shrink-0">$</span>
                                              <input type="number" value="150" readOnly className="w-20 pr-1 text-zinc-200 bg-transparent border-none outline-none py-1 pl-1 text-xs font-mono h-full" />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                              <label className="flex items-center gap-1 text-[9px] text-zinc-400 cursor-pointer hover:text-zinc-200">
                                                <input type="checkbox" checked={step !== 2} readOnly className="accent-indigo-500" /> Default Value
                                              </label>
                                              <label className="flex items-center gap-1 text-[9px] text-zinc-400 cursor-pointer hover:text-zinc-200">
                                                <input type="checkbox" checked={step === 2} readOnly className="accent-indigo-500" /> Custom Value
                                              </label>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-1.5 px-3 text-right">
                                        </td>
                                      </tr>
                                  )}
                                  {fixRevRows.map((row) => (
                                      <tr key={row.id} className="transition-colors bg-amber-500/5 hover:bg-amber-500/10">
                                        <td className="py-2 px-3">
                                          <div className={`w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 h-7 flex items-center justify-between ${(row.type === 'global' && focusArea === 'fixRevValidFromGlobal') ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-zinc-900' : ''}`}>
                                            <span>{row.validFrom || 'mm/dd/yyyy'}</span>
                                          </div>
                                        </td>
                                        <td className="py-2 px-3">
                                          <div className={`w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-500 h-7 flex items-center justify-between ${(row.type === 'global' && focusArea === 'fixRevValidToGlobal') ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-zinc-900 opacity-100' : 'opacity-50'}`}>
                                              <span>{row.validTo || 'mm/dd/yyyy'}</span>
                                          </div>
                                        </td>
                                        <td className="py-2 px-3">
                                          {row.type === 'global' ? (
                                            <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider h-7 flex items-center px-2">Global (ALL)</div>
                                          ) : (
                                            <div className={`w-full relative ${row.type === 'contract' && focusArea === 'fixRevSelectTarget' && row.id !== 'default_tpog' ? 'relative z-[9999] ring-2 ring-emerald-500 bg-zinc-950 rounded shadow-[0_0_15px_rgba(16,185,129,0.3)]' : ''}`}>
                                                <select value={row.target} readOnly className="w-full bg-zinc-950 border border-purple-700/50 rounded px-2 py-1 text-xs text-purple-500 font-bold outline-none h-7 appearance-none">
                                                   <option value="" disabled>Select Contract</option>
                                                   <option value="TPOG">TPOG</option>
                                                   <option value="MCLOO">MCLOO</option>
                                                </select>
                                                {fixRevTargetOpen && row.id !== 'default_tpog' && (
                                                   <div className="absolute flex flex-col top-full left-0 mt-1 w-full z-[9999]">
                                                      <div className="bg-zinc-900 border border-zinc-700 rounded shadow-xl overflow-hidden flex flex-col w-full">
                                                         <div className={`px-4 py-2 text-left text-[10px] font-bold text-purple-500 hover:bg-zinc-800 transition-colors`}>MCLOO</div>
                                                      </div>
                                                   </div>
                                                )}
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-2 px-3">
                                          {row.id === 'default_tpog' ? (
                                            <div className={`flex items-center gap-4 ${focusArea === 'fixRevCustomCheckbox' ? 'relative z-[9999] ring-2 ring-emerald-500 bg-zinc-900 shadow-[0_0_15px_rgba(16,185,129,0.3)] p-1 rounded' : ''}`}>
                                              <div className={`relative flex items-center justify-start bg-zinc-950 border border-zinc-700 rounded h-7 overflow-hidden ${step === 2 ? '' : 'opacity-50'}`}>
                                                <span className="pl-2 text-zinc-500 text-xs pointer-events-none flex-shrink-0">$</span>
                                                <input type="number" value="150" readOnly className="w-20 pr-1 text-zinc-200 bg-transparent border-none outline-none py-1 pl-1 text-xs font-mono h-full" />
                                              </div>
                                              <div className="flex flex-col gap-1">
                                                <label className="flex items-center gap-1 text-[9px] text-zinc-400 cursor-pointer hover:text-zinc-200">
                                                  <input type="checkbox" checked={step !== 2} readOnly className="accent-indigo-500" /> Default Value
                                                </label>
                                                <label className="flex items-center gap-1 text-[9px] text-zinc-400 cursor-pointer hover:text-zinc-200">
                                                  <input type="checkbox" checked={step === 2} readOnly className="accent-indigo-500" /> Custom Value
                                                </label>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className={`relative flex items-center h-7 w-32 bg-zinc-950 border border-amber-700/50 rounded ${(row.type === 'global' && focusArea === 'fixRevAmountGlobal') || (row.type === 'contract' && focusArea === 'fixRevAmountSpecific') ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-zinc-900' : ''}`}>
                                              <span className={`absolute left-2 text-xs pointer-events-none text-amber-500/50`}>$</span>
                                              <div className="w-full bg-transparent py-1 text-xs text-zinc-200 font-mono h-full pl-5 pr-8 flex items-center">{row.amount}</div>
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                           <button className="text-zinc-500 hover:text-rose-500 transition-colors p-1 rounded flex justify-center items-center"><Trash2 size={14}/></button>
                                        </td>
                                      </tr>
                                  ))}
                                  {step >= 9 && (
                                      <tr className={`hover:bg-zinc-800/30 transition-colors ${focusArea === 'fixRevCustomCheckbox' ? 'relative z-[9999] ring-2 ring-emerald-500 bg-zinc-900 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : ''}`}>
                                        <td className="py-1.5 px-3">
                                          <input type="date" value="2026-05-20" disabled className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-500 cursor-not-allowed h-7" />
                                        </td>
                                        <td className="py-1.5 px-3">
                                          <input type="date" value="2026-05-26" disabled className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-500 cursor-not-allowed h-7" />
                                        </td>
                                        <td className="py-2 px-3 text-xs text-zinc-500 font-bold uppercase tracking-wider">
                                          Contract: TPOG
                                        </td>
                                        <td className="py-2 px-3">
                                          <div className="flex items-center gap-4">
                                            <div className="relative flex items-center justify-start bg-zinc-950 border border-zinc-700 rounded h-7 overflow-hidden">
                                              <span className="pl-2 text-zinc-500 text-xs pointer-events-none flex-shrink-0">$</span>
                                              <input type="number" value="150" readOnly className="w-20 pr-1 text-zinc-200 bg-transparent border-none outline-none py-1 pl-1 text-xs font-mono h-full" />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                              <label className="flex items-center gap-1 text-[9px] text-zinc-400 cursor-pointer hover:text-zinc-200">
                                                <input type="checkbox" checked={false} readOnly className="accent-indigo-500" /> Default Value
                                              </label>
                                              <label className="flex items-center gap-1 text-[9px] text-zinc-400 cursor-pointer hover:text-zinc-200">
                                                <input type="checkbox" checked={true} readOnly className="accent-indigo-500" /> Custom Value
                                              </label>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-1.5 px-3 text-right">
                                            <button className="p-1 text-zinc-600 hover:text-rose-500 transition-colors">
                                              <Trash2 size={14} />
                                            </button>
                                        </td>
                                      </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {localTab === 'cpm' && (
              <div className="w-full border border-zinc-800 rounded-lg overflow-visible bg-zinc-950/50 p-4">
                <table className="w-full text-left border-collapse table-fixed overflow-visible">
                  <thead>
                    <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                      <th className="py-2 pr-2 font-bold w-[35%]">Type / Target</th>
                      <th className="py-2 px-1 font-bold w-[25%]">Valid From</th>
                      <th className="py-2 px-1 font-bold w-[25%]">Valid To</th>
                      <th className="py-2 px-1 font-bold w-[15%]">CPM Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {cpmRows.map((row) => (
                      <tr key={row.id} className="transition-colors group/row">
                        <td className="py-2 pr-2">
                          {row.type === 'global' ? (
                            <div className="w-full text-xs font-bold text-emerald-500 uppercase tracking-wider h-7 flex items-center">
                              Global (ALL)
                            </div>
                          ) : (
                            <div className={`relative ${(row.type === 'contract' && focusArea === 'cpmSelectTarget') || (row.type === 'company' && focusArea === 'cpmSelectTargetCompany') ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] rounded' : ''}`}>
                              <div className={`w-full bg-zinc-950 border rounded px-2 py-1 text-xs font-bold h-7 flex items-center justify-between cursor-pointer ${row.type === 'contract' ? 'border-purple-700/50 text-purple-500' : 'border-amber-700/50 text-amber-500'}`}>
                                <span>{row.target}</span>
                                <ChevronDown size={12} className="text-zinc-500" />
                              </div>
                              {cpmTargetOpen && row.type === 'contract' && row.id === 'c2' && focusArea === 'cpmSelectTarget' && (
                                <div className="absolute top-full left-0 mt-1 w-full bg-zinc-900 border border-zinc-700 rounded shadow-xl overflow-hidden flex flex-col z-[10000]">
                                  <div className="px-2 py-1.5 text-xs font-bold text-purple-500 hover:bg-zinc-800 cursor-pointer">TPOG</div>
                                </div>
                              )}
                              {cpmTargetOpen && row.type === 'company' && row.id === 'c3' && focusArea === 'cpmSelectTargetCompany' && (
                                <div className="absolute top-full left-0 mt-1 w-full bg-zinc-900 border border-zinc-700 rounded shadow-xl overflow-hidden flex flex-col z-[10000]">
                                  <div className="px-2 py-1.5 text-xs font-bold text-amber-500 hover:bg-zinc-800 cursor-pointer">Test Company</div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-1">
                          <div className={`w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 h-7 flex items-center justify-between ${(row.type === 'global' && focusArea === 'cpmValidFromGlobal') || (row.type === 'contract' && focusArea === 'cpmValidFromSpecific') || (row.type === 'company' && focusArea === 'cpmValidFromCompany') ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : ''}`}>
                            <span>{row.validFrom || 'mm/dd/yyyy'}</span>
                            <Calendar size={12} className="text-zinc-500" />
                          </div>
                        </td>
                        <td className="py-2 px-1">
                          <div className={`w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 h-7 flex items-center justify-between opacity-50 ${(row.type === 'global' && focusArea === 'cpmValidToGlobal') || (row.type === 'contract' && focusArea === 'cpmValidToSpecific') || (row.type === 'company' && focusArea === 'cpmValidToCompany') ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] opacity-100' : ''}`}>
                            <span>{row.validTo || 'mm/dd/yyyy'}</span>
                            <Calendar size={12} className="text-zinc-500" />
                          </div>
                        </td>
                        <td className="py-2 px-1">
                          <div className={`relative flex items-center h-7 ${(row.type === 'global' && focusArea === 'cpmAmountGlobal') || (row.type === 'contract' && focusArea === 'cpmAmountSpecific') || (row.type === 'company' && focusArea === 'cpmAmountSpecificCompany') ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] rounded' : ''}`}>
                            <span className="absolute left-2 text-zinc-500 text-xs font-mono">$</span>
                            <div className="w-full bg-zinc-950 border border-zinc-700 rounded py-1 pl-6 pr-2 text-xs text-zinc-200 font-mono h-full flex items-center">{row.amount}</div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center gap-3 mt-3">
                  <div className={`w-max px-3 py-1.5 border border-dashed border-emerald-500/50 text-emerald-500 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${focusArea === 'cpmAddGlobal' ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] bg-zinc-900' : ''}`}>
                    <Plus size={12} /> ADD GLOBAL RULE
                  </div>
                  <div className="relative">
                    <div className={`w-max px-3 py-1.5 border border-dashed border-pink-500/50 text-pink-500 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${focusArea === 'cpmAddDropdown' ? 'relative z-[9999] ring-2 ring-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.5)] bg-zinc-900' : ''}`}>
                      <Plus size={12} /> ADD RULE FOR <ChevronDown size={10} />
                    </div>
                    {cpmAddDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-40 bg-zinc-900 border border-zinc-700 rounded shadow-xl overflow-hidden flex flex-col z-[10000]">
                        <div className={`px-3 py-2 text-left text-[10px] font-bold text-purple-500 hover:bg-zinc-800 transition-colors ${focusArea === 'cpmAddContractItem' ? 'ring-2 ring-inset ring-emerald-500 bg-zinc-800' : ''}`}>Contract</div>
                        <div className={`px-3 py-2 text-left text-[10px] font-bold text-amber-500 hover:bg-zinc-800 transition-colors ${focusArea === 'cpmAddCompanyItem' ? 'ring-2 ring-inset ring-emerald-500 bg-zinc-800' : ''}`}>Company</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {localTab === 'pnl' && (
              <div className="w-full border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/50 relative">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-900 border-b border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      <th className="py-3 px-4 font-bold w-[20%]">Contract Type</th>
                      <th className="py-3 px-4 font-bold w-[80%]">PNL Calculation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {['MCLOO', 'LOO', 'LPOO', 'OO', 'MCOO', 'POG', 'TPOG', 'CPM'].map((contract) => (
                      <tr key={contract} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-4 text-xs font-bold text-zinc-200">
                          {contract}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                            <span className="text-emerald-500 font-mono mr-1">PNL =</span>
                            <div className="px-2 py-1 rounded border border-emerald-500/30 text-emerald-500 bg-emerald-500/10 cursor-pointer">REVENUE COLLECTED</div>
                            <span className="text-zinc-500">+</span>
                            <div className="px-2 py-1 rounded border border-emerald-500/30 text-emerald-500 bg-emerald-500/10 cursor-pointer">FUEL REBATE</div>
                            <span className="text-zinc-500">-</span>
                            <div className="px-2 py-1 rounded border border-emerald-500/30 text-emerald-500 bg-emerald-500/10 cursor-pointer">WEEKLY EXPENSES</div>
                            <span className="text-zinc-500">-</span>
                            <div className="px-2 py-1 rounded border border-emerald-500/30 text-emerald-500 bg-emerald-500/10 cursor-pointer">PO</div>
                            <span className="text-zinc-500">-</span>
                            <div className="px-2 py-1 rounded border border-emerald-500/30 text-emerald-500 bg-emerald-500/10 cursor-pointer">TOLLS</div>
                            <span className="text-zinc-500">-</span>
                            <div 
                              className={`px-2 py-1 rounded border cursor-pointer transition-colors ${
                                contract === 'MCLOO' && focusArea === 'pnlChevron'
                                  ? 'relative z-[9999] ring-2 ring-emerald-500 bg-zinc-900 shadow-[0_0_15px_rgba(16,185,129,0.5)] border-emerald-500/30 text-emerald-500'
                                  : (contract === 'TPOG' || contract === 'POG' || (contract === 'MCLOO' && pnlExpanded))
                                    ? 'border-zinc-700 text-zinc-600 bg-zinc-900/50'
                                    : 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'
                              }`}
                              onClick={() => { if(contract === 'MCLOO') setPnlExpanded(!pnlExpanded) }}
                            >
                              RECRUITING
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {localTab === 'fuel_rebate' && (
              <div className="w-full border border-zinc-800 rounded-lg overflow-visible bg-zinc-950/50 p-4">
                <table className="w-full text-left border-collapse table-fixed overflow-visible">
                  <thead>
                    <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                      <th className="py-2 pr-2 font-bold w-[35%]">Type / Target</th>
                      <th className="py-2 px-1 font-bold w-[25%]">Valid From</th>
                      <th className="py-2 px-1 font-bold w-[25%]">Valid To</th>
                      <th className="py-2 px-1 font-bold w-[15%]">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {frRows.map((row) => (
                      <tr key={row.id} className="transition-colors group/row">
                        <td className="py-2 pr-2">
                          {row.type === 'global' ? (
                            <div className="w-full text-xs font-bold text-emerald-500 uppercase tracking-wider h-7 flex items-center">
                              Global (ALL)
                            </div>
                          ) : (
                            <div className={`relative ${(row.type === 'contract' && focusArea === 'frSelectTarget') || (row.type === 'company' && focusArea === 'frSelectTargetCompany') ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] rounded' : ''}`}>
                              <div className={`w-full bg-zinc-950 border rounded px-2 py-1 text-xs font-bold h-7 flex items-center justify-between cursor-pointer ${row.type === 'contract' ? 'border-purple-700/50 text-purple-500' : 'border-amber-700/50 text-amber-500'}`}>
                                <span>{row.target}</span>
                                <ChevronDown size={12} className="text-zinc-500" />
                              </div>
                              {frTargetOpen && row.type === 'contract' && row.id === 'f2' && focusArea === 'frSelectTarget' && (
                                <div className="absolute top-full left-0 mt-1 w-full bg-zinc-900 border border-zinc-700 rounded shadow-xl overflow-hidden flex flex-col z-[10000]">
                                  <div className="px-2 py-1.5 text-xs font-bold text-purple-500 hover:bg-zinc-800 cursor-pointer">TPOG</div>
                                </div>
                              )}
                              {frTargetOpen && row.type === 'company' && row.id === 'f3' && focusArea === 'frSelectTargetCompany' && (
                                <div className="absolute top-full left-0 mt-1 w-full bg-zinc-900 border border-zinc-700 rounded shadow-xl overflow-hidden flex flex-col z-[10000]">
                                  <div className="px-2 py-1.5 text-xs font-bold text-amber-500 hover:bg-zinc-800 cursor-pointer">Test Company</div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-1">
                          <div className={`w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 h-7 flex items-center justify-between ${(row.type === 'global' && focusArea === 'frValidFromGlobal') || (row.type === 'contract' && focusArea === 'frValidFromSpecific') || (row.type === 'company' && focusArea === 'frValidFromCompany') ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : ''}`}>
                            <span>{row.validFrom || 'mm/dd/yyyy'}</span>
                            <Calendar size={12} className="text-zinc-500" />
                          </div>
                        </td>
                        <td className="py-2 px-1">
                          <div className={`w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 h-7 flex items-center justify-between opacity-50 ${(row.type === 'global' && focusArea === 'frValidToGlobal') || (row.type === 'contract' && focusArea === 'frValidToSpecific') || (row.type === 'company' && focusArea === 'frValidToCompany') ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] opacity-100' : ''}`}>
                            <span>{row.validTo || 'mm/dd/yyyy'}</span>
                            <Calendar size={12} className="text-zinc-500" />
                          </div>
                        </td>
                        <td className="py-2 px-1">
                          <div className={`relative flex items-center h-7 ${(row.type === 'global' && focusArea === 'frAmountGlobal') || (row.type === 'contract' && focusArea === 'frAmountSpecific') || (row.type === 'company' && focusArea === 'frAmountSpecificCompany') ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] rounded' : ''}`}>
                            <span className="absolute left-2 text-zinc-500 text-xs font-mono">$</span>
                            <div className="w-full bg-zinc-950 border border-zinc-700 rounded py-1 pl-6 pr-2 text-xs text-zinc-200 font-mono h-full flex items-center">{row.amount}</div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center gap-3 mt-3">
                  <div className={`w-max px-3 py-1.5 border border-dashed border-emerald-500/50 text-emerald-500 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${focusArea === 'frAddGlobal' ? 'relative z-[9999] ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] bg-zinc-900' : ''}`}>
                    <Plus size={12} /> ADD GLOBAL RULE
                  </div>
                  <div className="relative">
                    <div className={`w-max px-3 py-1.5 border border-dashed border-amber-500/50 text-amber-500 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${focusArea === 'frAddDropdown' ? 'relative z-[9999] ring-2 ring-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] bg-zinc-900' : ''}`}>
                      <Plus size={12} /> ADD RULE FOR <ChevronDown size={10} />
                    </div>
                    {frAddDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-40 bg-zinc-900 border border-zinc-700 rounded shadow-xl overflow-hidden flex flex-col z-[10000]">
                        <div className={`px-3 py-2 text-left text-[10px] font-bold text-purple-500 hover:bg-zinc-800 transition-colors ${focusArea === 'frAddContractItem' ? 'ring-2 ring-inset ring-emerald-500 bg-zinc-800' : ''}`}>Contract</div>
                        <div className={`px-3 py-2 text-left text-[10px] font-bold text-amber-500 hover:bg-zinc-800 transition-colors ${focusArea === 'frAddCompanyItem' ? 'ring-2 ring-inset ring-emerald-500 bg-zinc-800' : ''}`}>Company</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {reductionModalOpen && tutorialType === 'reductions' && (
            <>
            <div className="absolute inset-0 z-[9996] bg-black/60 pointer-events-none rounded-lg"></div>
            <div className="absolute z-[9997] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden transition-all">
                {focusArea && <div className="absolute inset-0 z-[9998] bg-black/20 pointer-events-none transition-all duration-300"></div>}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950 relative z-[9999]">
                    <div className="flex items-center gap-2 text-rose-500">
                        <Settings size={20} />
                        <h3 className="font-bold text-sm uppercase tracking-wider">Manage Truck Price Reductions</h3>
                    </div>
                </div>
                <div className="p-4 flex items-end gap-3">
                    <div className={`flex flex-col gap-1.5 w-32 shrink-0 ${focusArea === 'redApplyTo' ? 'relative z-[9999] ring-2 ring-rose-500 rounded bg-zinc-900 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : ''}`}>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Apply To</label>
                        <select className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 outline-none h-8">
                            <option>For ALL (Global)</option>
                        </select>
                    </div>
                    <div className={`flex flex-col gap-1.5 flex-1 min-w-[100px] ${focusArea === 'redDates' ? 'relative z-[9999] ring-2 ring-rose-500 rounded bg-zinc-900 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : ''}`}>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Valid From</label>
                        <input type="date" value="2026-05-26" readOnly className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 outline-none h-8 opacity-50" />
                    </div>
                    <div className={`flex flex-col gap-1.5 flex-1 min-w-[100px] ${focusArea === 'redDates' ? 'relative z-[9999] ring-2 ring-rose-500 rounded bg-zinc-900 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : ''}`}>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Valid To</label>
                        <input type="date" value="" readOnly className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 outline-none h-8" />
                    </div>
                    <div className={`flex flex-col gap-1.5 w-24 shrink-0 ${focusArea === 'redAmount' ? 'relative z-[9999] ring-2 ring-rose-500 rounded bg-zinc-900 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : ''}`}>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Amount</label>
                        <div className="relative">
                            <span className="absolute left-2 top-1.5 text-zinc-500 text-xs pointer-events-none">$</span>
                            <input type="number" value={step >= 5 ? "200" : ""} placeholder="e.g. 200" readOnly className="w-full bg-zinc-950 border border-zinc-700 rounded py-1 pl-5 pr-2 text-xs text-zinc-200 outline-none font-mono h-8" />
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex justify-between items-start gap-4">
                    <div className={`flex flex-col gap-1.5 flex-1 max-w-md ${focusArea === 'redNote' ? 'relative z-[9999] ring-2 ring-rose-500 rounded bg-zinc-900 p-2 shadow-[0_0_15px_rgba(244,63,94,0.3)] -ml-2 -mt-2' : ''}`}>
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Note (Optional)</label>
                            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5">
                                <button className="p-1 text-zinc-400" title="Bold"><Bold size={12}/></button>
                                <button className="p-1 text-zinc-400" title="Italic"><Italic size={12}/></button>
                                <button className="p-1 text-zinc-400" title="Underline"><Underline size={12}/></button>
                                <div className="w-[1px] h-3 bg-zinc-700 mx-0.5"></div>
                                <button className="p-1 text-zinc-400" title="Bullet List"><List size={12}/></button>
                                <button className="p-1 text-zinc-400" title="Numbered List"><ListOrdered size={12}/></button>
                                <div className="w-[1px] h-3 bg-zinc-700 mx-0.5"></div>
                                <label className="p-1 text-zinc-400 relative overflow-hidden" title="Text Color">
                                    <Palette size={12}/></label>
                            </div>
                        </div>
                        <div className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-zinc-200 outline-none min-h-[60px] max-h-[200px] overflow-y-auto">
                            {step >= 6 ? 'Test Note' : ''}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 mt-6">
                        <button className="px-4 py-2 rounded bg-zinc-800 text-zinc-400 font-bold text-xs">Cancel</button>
                        <button className={`px-6 py-2 rounded bg-rose-500/20 text-rose-500 font-bold text-xs transition-all ${focusArea === 'redApplyBtn' ? 'relative z-[9999] ring-2 ring-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]' : ''}`}>Apply Reduction</button>
                    </div>
                </div>
            </div>
            </>
        )}

        {/* Save and Close Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 rounded-b-lg flex justify-end items-center flex-shrink-0 relative">
          <button 
            className={`flex items-center gap-2 bg-emerald-600 text-white px-6 py-2 rounded font-medium text-sm transition-all ${focusArea === 'saveBtn' ? 'relative z-[9999] ring-4 ring-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.6)]' : ''}`}
          >
            <Save size={16} /> Save and Close
         </button>
        </div>

      </div>
    </div>
  );
};

export default TutorialModal;