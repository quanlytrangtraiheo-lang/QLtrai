import React, { useMemo, useState } from 'react';
import {
  Baby,
  CalendarCheck,
  Check,
  DollarSign,
  Edit3,
  History,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { SowTimeline } from './SowTimeline';
import {
  addDays,
  computeGroupEconomics,
  diffDays,
  formatDateVi,
  formatNumber,
  formatVND,
  makeId,
  SOW_EVENT_LABELS,
  SOW_STATUS_LABELS,
  todayIso,
} from '../utils/farmCalculations';
import type {
  Barn,
  Breed,
  Farm,
  FinancialTx,
  PigGroup,
  PigLitter,
  Sow,
  SowEvent,
  StaffRole,
} from '../types';

interface HerdViewProps {
  farm: Farm;
  role: StaffRole;
  barns: Barn[];
  breeds: Breed[];
  sows: Sow[];
  sowEvents: SowEvent[];
  pigLitters: PigLitter[];
  pigGroups: PigGroup[];
  onCreateSow: (input: {
    earTag: string;
    name?: string;
    breedName?: string;
    barnName?: string;
    entryDate?: string;
    parity: number;
    status: Sow['status'];
    healthStatus: Sow['healthStatus'];
    lastBreedingDate?: string;
    boarTag?: string;
    purchaseCost?: number;
    notes?: string;
  }) => Promise<void>;
  onRecordSowBreeding: (
    sow: Sow,
    breedingDate: string,
    boarTag?: string,
    notes?: string
  ) => Promise<void>;
  onCompleteSowEvent: (
    ev: SowEvent,
    details: {
      actualDate: string;
      liveBorn?: number;
      stillborn?: number;
      weanedCount?: number;
      avgWeightKg?: number;
      boarTag?: string;
      notes?: string;
    }
  ) => Promise<void>;
  onWeanLitterToGroup: (
    litter: PigLitter,
    input: {
      weanedDate: string;
      weanedCount: number;
      avgWeightKg: number;
      createGroup: boolean;
      batchCode?: string;
      groupName?: string;
      targetBarnName?: string;
      notes?: string;
    }
  ) => Promise<void>;
  onSaveSubDoc: (
    colName: string,
    id: string,
    payload: Record<string, unknown>,
    isEdit?: boolean
  ) => Promise<void>;
  onDeleteSubDoc: (colName: string, id: string) => Promise<void>;
  onRecordFinancialTx: (input: {
    txType: FinancialTx['txType'];
    direction: 'income' | 'expense';
    date: string;
    groupId?: string;
    headCount?: number;
    totalWeightKg?: number;
    unitPrice?: number;
    amount: number;
    partnerName?: string;
    notes?: string;
  }) => Promise<void>;
}

export const HerdView: React.FC<HerdViewProps> = ({
  farm,
  role,
  barns,
  breeds,
  sows,
  sowEvents,
  pigLitters,
  pigGroups,
  onCreateSow,
  onRecordSowBreeding,
  onCompleteSowEvent,
  onWeanLitterToGroup,
  onSaveSubDoc,
  onDeleteSubDoc,
  onRecordFinancialTx,
}) => {
  const [subTab, setSubTab] = useState<'sows' | 'litters' | 'groups'>('sows');
  const [search, setSearch] = useState('');
  const [litterStatusFilter, setLitterStatusFilter] = useState<'suckling' | 'weaned' | 'all'>('suckling');
  const [litterSowFilter, setLitterSowFilter] = useState<string>('all');

  // Modal states
  const [showAddSow, setShowAddSow] = useState(false);
  const [selectedSowForBreed, setSelectedSowForBreed] = useState<Sow | null>(null);
  const [selectedEventToComplete, setSelectedEventToComplete] = useState<SowEvent | null>(null);
  const [selectedTimelineSowId, setSelectedTimelineSowId] = useState<string>('');
  const [showAddLitter, setShowAddLitter] = useState(false);
  const [editingLitter, setEditingLitter] = useState<PigLitter | null>(null);
  const [weaningTargetLitter, setWeaningTargetLitter] = useState<PigLitter | null>(null);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [saleTargetGroup, setSaleTargetGroup] = useState<PigGroup | null>(null);
  const [weightEditGroup, setWeightEditGroup] = useState<PigGroup | null>(null);

  // Add Sow form
  const [sowForm, setSowForm] = useState({
    earTag: '',
    name: '',
    breedName: breeds[0]?.name || 'Yorkshire × Landrace (F1)',
    barnName: barns[0]?.name || '',
    entryDate: todayIso(),
    parity: 0,
    status: 'empty' as Sow['status'],
    lastBreedingDate: todayIso(),
    boarTag: '',
    purchaseCost: 9000000,
    notes: '',
  });

  // Breeding modal form
  const [breedForm, setBreedForm] = useState({
    date: todayIso(),
    boarTag: '',
    notes: '',
  });

  // Complete Sow Event form
  const [evForm, setEvForm] = useState({
    actualDate: todayIso(),
    liveBorn: 12,
    stillborn: 0,
    weanedCount: 11,
    avgWeightKg: 6.8,
    boarTag: '',
    notes: '',
  });

  // Add PigGroup form
  const [groupForm, setGroupForm] = useState({
    batchCode: '',
    name: '',
    breedName: breeds[1]?.name || breeds[0]?.name || 'Duroc × (Yorkshire × Landrace)',
    barnName: barns.find((b) => b.barnType === 'fattening')?.name || barns[0]?.name || '',
    entryDate: todayIso(),
    birthDate: todayIso(),
    initialCount: 50,
    avgEntryWeightKg: 7.5,
    entryCostTotal: 60000000,
    notes: '',
  });

  // Sale PigGroup form
  const [saleForm, setSaleForm] = useState({
    date: todayIso(),
    headCount: 10,
    totalWeightKg: 1000,
    unitPrice: 65000,
    partnerName: '',
    notes: '',
  });

  // Group Weight/Mortality update form
  const [perfForm, setPerfForm] = useState({
    currentAvgWeightKg: 50,
    mortalityAdd: 0,
    otherCostAdd: 0,
    healthStatus: 'healthy' as PigGroup['healthStatus'],
    notes: '',
  });

  // Add PigLitter form
  const [litterForm, setLitterForm] = useState({
    sowId: '',
    litterCode: '',
    parity: 1,
    barnName: '',
    farrowingDate: todayIso(),
    expectedWeaningDate: addDays(todayIso(), farm.weaningDays || 24),
    liveBorn: 12,
    currentCount: 12,
    avgWeightKg: 1.5,
    notes: '',
  });

  // Update PigLitter form
  const [litterEditForm, setLitterEditForm] = useState({
    barnName: '',
    expectedWeaningDate: '',
    currentCount: 12,
    mortalityCount: 0,
    avgWeightKg: 3.5,
    healthStatus: 'healthy' as PigLitter['healthStatus'],
    notes: '',
  });

  // Wean PigLitter form
  const [weanLitterForm, setWeanLitterForm] = useState({
    weanedDate: todayIso(),
    weanedCount: 11,
    avgWeightKg: 6.8,
    createGroup: true,
    batchCode: '',
    groupName: '',
    targetBarnName: barns.find((b) => b.barnType === 'fattening')?.name || barns[0]?.name || '',
    notes: '',
  });

  const canDelete = role === 'admin' || role === 'manager';

  const filteredSows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sows.filter(
      (s) =>
        !q ||
        s.earTag.toLowerCase().includes(q) ||
        (s.name || '').toLowerCase().includes(q) ||
        (s.barnName || '').toLowerCase().includes(q)
    );
  }, [sows, search]);

  const activeSucklingLitters = useMemo(
    () => pigLitters.filter((l) => l.status === 'suckling'),
    [pigLitters]
  );

  const activeLitterBySowId = useMemo(() => {
    const map = new Map<string, PigLitter>();
    for (const l of activeSucklingLitters) {
      if (!map.has(l.sowId)) {
        map.set(l.sowId, l);
      }
    }
    return map;
  }, [activeSucklingLitters]);

  const litterStats = useMemo(() => {
    const today = todayIso();
    const suckling = pigLitters.filter((l) => l.status === 'suckling');
    const weaned = pigLitters.filter((l) => l.status === 'weaned');
    const totalHeads = suckling.reduce((sum, l) => sum + (l.currentCount || 0), 0);
    const weaningSoon = suckling.filter((l) => {
      const exp = l.expectedWeaningDate || addDays(l.farrowingDate, farm.weaningDays || 24);
      return diffDays(today, exp) <= 5;
    });
    const weaningSoonHeads = weaningSoon.reduce((sum, l) => sum + (l.currentCount || 0), 0);
    return {
      sucklingCount: suckling.length,
      weanedCount: weaned.length,
      totalHeads,
      avgPerLitter: suckling.length > 0 ? totalHeads / suckling.length : 0,
      weaningSoonCount: weaningSoon.length,
      weaningSoonHeads,
    };
  }, [pigLitters, farm.weaningDays]);

  const filteredLitters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...pigLitters]
      .filter((l) => {
        if (litterStatusFilter !== 'all' && l.status !== litterStatusFilter) return false;
        if (litterSowFilter !== 'all' && l.sowId !== litterSowFilter) return false;
        if (!q) return true;
        return (
          l.sowEarTag.toLowerCase().includes(q) ||
          l.litterCode.toLowerCase().includes(q) ||
          (l.barnName || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.farrowingDate.localeCompare(a.farrowingDate));
  }, [pigLitters, litterStatusFilter, litterSowFilter, search]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pigGroups.filter(
      (g) =>
        !q ||
        g.batchCode.toLowerCase().includes(q) ||
        g.name.toLowerCase().includes(q) ||
        (g.barnName || '').toLowerCase().includes(q)
    );
  }, [pigGroups, search]);

  const pendingSowEvents = useMemo(
    () =>
      sowEvents
        .filter((e) => e.status === 'pending')
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
    [sowEvents]
  );

  const activeTimelineSowId = useMemo(() => {
    if (selectedTimelineSowId && sows.some((s) => s.id === selectedTimelineSowId)) {
      return selectedTimelineSowId;
    }
    return sows[0]?.id || '';
  }, [selectedTimelineSowId, sows]);

  const handleOpenEventComplete = (ev: SowEvent) => {
    setSelectedEventToComplete(ev);
    setEvForm({
      actualDate: todayIso(),
      liveBorn: 12,
      stillborn: 0,
      weanedCount: 11,
      avgWeightKg: 6.8,
      boarTag: '',
      notes: '',
    });
  };

  const handleCreateSow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sowForm.earTag.trim()) return;
    await onCreateSow({
      earTag: sowForm.earTag,
      name: sowForm.name,
      breedName: sowForm.breedName,
      barnName: sowForm.barnName,
      entryDate: sowForm.entryDate,
      parity: Number(sowForm.parity) || 0,
      status: sowForm.status,
      healthStatus: 'healthy',
      lastBreedingDate:
        sowForm.status === 'bred' || sowForm.status === 'pregnant'
          ? sowForm.lastBreedingDate
          : undefined,
      boarTag: sowForm.boarTag,
      purchaseCost: Number(sowForm.purchaseCost) || 0,
      notes: sowForm.notes,
    });
    if (Number(sowForm.purchaseCost) > 0) {
      await onRecordFinancialTx({
        txType: 'purchase_breeding',
        direction: 'expense',
        date: sowForm.entryDate,
        headCount: 1,
        amount: Number(sowForm.purchaseCost),
        notes: `Nhập heo nái giống ${sowForm.earTag}`,
      });
    }
    setShowAddSow(false);
    setSowForm({ ...sowForm, earTag: '', name: '', boarTag: '', notes: '' });
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm.batchCode.trim() || !groupForm.name.trim()) return;
    const id = makeId('grp');
    const count = Math.max(1, Number(groupForm.initialCount) || 1);
    const entryCost = Math.max(0, Number(groupForm.entryCostTotal) || 0);
    await onSaveSubDoc('pigGroups', id, {
      batchCode: groupForm.batchCode.trim(),
      name: groupForm.name.trim(),
      breedName: groupForm.breedName,
      barnName: groupForm.barnName,
      entryDate: groupForm.entryDate,
      birthDate: groupForm.birthDate,
      initialCount: count,
      currentCount: count,
      mortalityCount: 0,
      soldCount: 0,
      avgEntryWeightKg: Number(groupForm.avgEntryWeightKg) || 0,
      currentAvgWeightKg: Number(groupForm.avgEntryWeightKg) || 0,
      entryCostTotal: entryCost,
      feedCostTotal: 0,
      medCostTotal: 0,
      otherCostTotal: 0,
      revenueTotal: 0,
      status: 'active',
      healthStatus: 'healthy',
      notes: groupForm.notes,
    });
    if (entryCost > 0) {
      await onRecordFinancialTx({
        txType: 'purchase_breeding',
        direction: 'expense',
        date: groupForm.entryDate,
        groupId: id,
        headCount: count,
        amount: entryCost,
        notes: `Nhập heo giống lô ${groupForm.batchCode} (${count} con)`,
      });
    }
    setShowAddGroup(false);
    setGroupForm({ ...groupForm, batchCode: '', name: '', notes: '' });
  };

  const handleSellGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleTargetGroup) return;
    const amount = Math.round(
      (Number(saleForm.totalWeightKg) || 0) * (Number(saleForm.unitPrice) || 0)
    );
    await onRecordFinancialTx({
      txType: 'sale_fattening',
      direction: 'income',
      date: saleForm.date,
      groupId: saleTargetGroup.id,
      headCount: Number(saleForm.headCount) || 0,
      totalWeightKg: Number(saleForm.totalWeightKg) || 0,
      unitPrice: Number(saleForm.unitPrice) || 0,
      amount,
      partnerName: saleForm.partnerName,
      notes: saleForm.notes || `Xuất bán ${saleForm.headCount} con từ ${saleTargetGroup.name}`,
    });
    setSaleTargetGroup(null);
  };

  const handleUpdateGroupPerf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weightEditGroup) return;
    const mortAdd = Math.max(0, Number(perfForm.mortalityAdd) || 0);
    const nextCurrent = Math.max(0, weightEditGroup.currentCount - mortAdd);
    await onSaveSubDoc(
      'pigGroups',
      weightEditGroup.id,
      {
        currentAvgWeightKg: Number(perfForm.currentAvgWeightKg) || weightEditGroup.currentAvgWeightKg,
        mortalityCount: (weightEditGroup.mortalityCount || 0) + mortAdd,
        currentCount: nextCurrent,
        otherCostTotal:
          (weightEditGroup.otherCostTotal || 0) + (Number(perfForm.otherCostAdd) || 0),
        healthStatus: perfForm.healthStatus,
        notes: perfForm.notes,
      },
      true
    );
    setWeightEditGroup(null);
  };

  const handleOpenAddLitter = (preselectSow?: Sow) => {
    const defaultSow =
      preselectSow ||
      sows.find((s) => s.status === 'lactating') ||
      sows.find((s) => s.status !== 'culled' && s.status !== 'sold') ||
      sows[0];
    const farrowDate = defaultSow?.lastFarrowingDate || todayIso();
    const nextParity = Math.max(1, defaultSow?.parity || 1);
    setLitterForm({
      sowId: defaultSow?.id || '',
      litterCode: defaultSow ? `OC-${defaultSow.earTag}-L${nextParity}` : 'OC-01',
      parity: nextParity,
      barnName: defaultSow?.barnName || barns[0]?.name || '',
      farrowingDate: farrowDate,
      expectedWeaningDate: addDays(farrowDate, farm.weaningDays || 24),
      liveBorn: 12,
      currentCount: 12,
      avgWeightKg: 1.5,
      notes: '',
    });
    setShowAddLitter(true);
  };

  const handleCreateLitter = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetSow = sows.find((s) => s.id === litterForm.sowId);
    if (!targetSow || !litterForm.litterCode.trim()) return;
    const liveBorn = Math.max(0, Math.min(40, Number(litterForm.liveBorn) || 0));
    const currentCount = Math.max(0, Math.min(liveBorn, Number(litterForm.currentCount) || 0));
    const mortalityCount = Math.max(0, liveBorn - currentCount);
    const id = makeId('lit');
    await onSaveSubDoc('pigLitters', id, {
      sowId: targetSow.id,
      sowEarTag: targetSow.earTag,
      litterCode: litterForm.litterCode.trim().slice(0, 60),
      parity: Math.max(0, Math.min(30, Number(litterForm.parity) || 1)),
      barnName: litterForm.barnName.trim() || targetSow.barnName || undefined,
      farrowingDate: litterForm.farrowingDate,
      expectedWeaningDate:
        litterForm.expectedWeaningDate || addDays(litterForm.farrowingDate, farm.weaningDays || 24),
      liveBorn,
      currentCount,
      mortalityCount,
      avgWeightKg: Math.max(0, Math.min(100, Number(litterForm.avgWeightKg) || 0)),
      healthStatus: 'healthy',
      status: 'suckling',
      notes: litterForm.notes.trim() || undefined,
    });
    setShowAddLitter(false);
  };

  const handleOpenEditLitter = (litter: PigLitter) => {
    setEditingLitter(litter);
    setLitterEditForm({
      barnName: litter.barnName || '',
      expectedWeaningDate:
        litter.expectedWeaningDate || addDays(litter.farrowingDate, farm.weaningDays || 24),
      currentCount: litter.currentCount,
      mortalityCount: litter.mortalityCount || Math.max(0, litter.liveBorn - litter.currentCount),
      avgWeightKg: litter.avgWeightKg || 1.5,
      healthStatus: litter.healthStatus,
      notes: litter.notes || '',
    });
  };

  const handleSaveEditLitter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLitter) return;
    const currentCount = Math.max(0, Math.min(40, Number(litterEditForm.currentCount) || 0));
    const mortalityCount = Math.max(0, Math.min(40, Number(litterEditForm.mortalityCount) || 0));
    await onSaveSubDoc(
      'pigLitters',
      editingLitter.id,
      {
        barnName: litterEditForm.barnName.trim() || undefined,
        expectedWeaningDate: litterEditForm.expectedWeaningDate || undefined,
        currentCount,
        mortalityCount,
        avgWeightKg: Math.max(0, Math.min(100, Number(litterEditForm.avgWeightKg) || 0)),
        healthStatus: litterEditForm.healthStatus,
        notes: litterEditForm.notes.trim() || undefined,
      },
      true
    );
    setEditingLitter(null);
  };

  const handleOpenWeanLitter = (litter: PigLitter) => {
    const today = todayIso();
    setWeaningTargetLitter(litter);
    setWeanLitterForm({
      weanedDate: today,
      weanedCount: litter.currentCount,
      avgWeightKg: Math.max(4, litter.avgWeightKg || 6.8),
      createGroup: true,
      batchCode: `CS-${litter.sowEarTag}-L${litter.parity}`.slice(0, 40),
      groupName: `Cai sữa ${litter.sowEarTag} Lứa ${litter.parity}`,
      targetBarnName: barns.find((b) => b.barnType === 'fattening')?.name || barns[0]?.name || '',
      notes: '',
    });
  };

  const handleSubmitWeanLitter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weaningTargetLitter) return;
    await onWeanLitterToGroup(weaningTargetLitter, {
      weanedDate: weanLitterForm.weanedDate,
      weanedCount: Number(weanLitterForm.weanedCount) || 0,
      avgWeightKg: Number(weanLitterForm.avgWeightKg) || 0,
      createGroup: weanLitterForm.createGroup,
      batchCode: weanLitterForm.batchCode,
      groupName: weanLitterForm.groupName,
      targetBarnName: weanLitterForm.targetBarnName,
      notes: weanLitterForm.notes,
    });
    setWeaningTargetLitter(null);
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 self-start">
          <button
            type="button"
            onClick={() => setSubTab('sows')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              subTab === 'sows'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Heo nái ({sows.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('litters')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              subTab === 'litters'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Heo con theo mẹ ({litterStats.sucklingCount} ổ)
          </button>
          <button
            type="button"
            onClick={() => setSubTab('groups')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              subTab === 'groups'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Nhóm heo thịt ({pigGroups.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                subTab === 'sows'
                  ? 'Tìm số tai, chuồng nái...'
                  : subTab === 'litters'
                  ? 'Tìm số tai nái, mã ổ...'
                  : 'Tìm mã lô, tên lô...'
              }
              className="w-full min-h-[44px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {subTab === 'sows' ? (
            <button
              type="button"
              onClick={() => setShowAddSow(true)}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Nhập heo nái</span>
            </button>
          ) : subTab === 'litters' ? (
            <button
              type="button"
              onClick={() => handleOpenAddLitter()}
              disabled={sows.length === 0}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-medium whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm ổ theo mẹ</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddGroup(true)}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Nhập lô heo mới</span>
            </button>
          )}
        </div>
      </div>

      {/* SOWS TAB */}
      {subTab === 'sows' && (
        <div className="space-y-6">
          {/* Auto-generated Upcoming Sow Workflow Events */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Luồng sự kiện tự động heo nái (Phối → Đẻ → Cai sữa → Phối lại)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tự động tạo theo thông số trại: Mang thai {farm.gestationDays} ngày · Cai sữa {farm.weaningDays} ngày · Lên giống lại {farm.postWeaningEstrusDays} ngày
                </p>
              </div>
              <span className="text-xs font-medium text-slate-500 font-mono-tabular">
                {pendingSowEvents.length} sự kiện đang chờ
              </span>
            </div>

            {pendingSowEvents.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Chưa có sự kiện sinh sản nào đang chờ. Nhấn &ldquo;Phối giống&rdquo; trên từng cá thể heo nái để hệ thống tự động lập lịch toàn chu kỳ.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-2.5 px-2 font-medium">Số tai nái</th>
                      <th className="text-left py-2.5 px-2 font-medium">Sự kiện tiếp theo</th>
                      <th className="text-left py-2.5 px-2 font-medium">Ngày dự kiến</th>
                      <th className="text-left py-2.5 px-2 font-medium">Ghi chú</th>
                      <th className="text-right py-2.5 px-2 font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {pendingSowEvents.slice(0, 12).map((ev) => {
                      const isOverdue = ev.scheduledDate < todayIso();
                      const isToday = ev.scheduledDate === todayIso();
                      return (
                        <tr key={ev.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-2 font-semibold font-mono-tabular">
                            {ev.sowEarTag}
                          </td>
                          <td className="py-2.5 px-2">{SOW_EVENT_LABELS[ev.eventType]}</td>
                          <td
                            className={`py-2.5 px-2 font-mono-tabular ${
                              isOverdue
                                ? 'text-red-600 dark:text-red-400 font-semibold'
                                : isToday
                                ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {formatDateVi(ev.scheduledDate)}
                            {isOverdue ? ' (Quá hạn)' : isToday ? ' (Hôm nay)' : ''}
                          </td>
                          <td className="py-2.5 px-2 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                            {ev.notes || '—'}
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEventToComplete(ev);
                                setEvForm({
                                  actualDate: todayIso(),
                                  liveBorn: 12,
                                  stillborn: 0,
                                  weanedCount: 11,
                                  avgWeightKg: 6.8,
                                  boarTag: '',
                                  notes: '',
                                });
                              }}
                              className="inline-flex items-center gap-1 min-h-[36px] px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium whitespace-nowrap"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Xác nhận hoàn thành</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Visual Chronological Timeline for Selected Sow */}
          {sows.length > 0 && activeTimelineSowId && (
            <SowTimeline
              sows={sows}
              selectedSowId={activeTimelineSowId}
              onSelectSow={setSelectedTimelineSowId}
              sowEvents={sowEvents}
              onCompleteEvent={handleOpenEventComplete}
              onRecordBreeding={(sow) => {
                setSelectedSowForBreed(sow);
                setBreedForm({ date: todayIso(), boarTag: '', notes: '' });
              }}
            />
          )}

          {/* Individual Sows List */}
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSows.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Chưa có cá thể heo nái nào khớp tìm kiếm.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddSow(true)}
                  className="mt-3 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 text-white text-sm font-medium"
                >
                  Thêm heo nái đầu tiên
                </button>
              </div>
            ) : (
              filteredSows.map((sow) => {
                const isSelectedForTimeline = sow.id === activeTimelineSowId;
                return (
                <div
                  key={sow.id}
                  className={`rounded-2xl border bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4 transition-colors ${
                    isSelectedForTimeline
                      ? 'border-emerald-600 dark:border-emerald-500'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {sow.barnName || 'Chưa phân chuồng'} · Lứa {sow.parity}
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono-tabular mt-0.5">
                          {sow.earTag}
                          {sow.name ? (
                            <span className="font-sans font-medium text-sm text-slate-600 dark:text-slate-300 ml-2">
                              {sow.name}
                            </span>
                          ) : null}
                        </h3>
                      </div>
                      <span
                        className={`text-xs font-semibold whitespace-nowrap ${
                          sow.healthStatus === 'sick'
                            ? 'text-red-600 dark:text-red-400'
                            : sow.healthStatus === 'monitoring'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {sow.healthStatus === 'healthy'
                          ? 'Khỏe mạnh'
                          : sow.healthStatus === 'monitoring'
                          ? 'Đang theo dõi'
                          : sow.healthStatus === 'sick'
                          ? 'Đang điều trị'
                          : 'Cách ly'}
                      </span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Trạng thái:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {SOW_STATUS_LABELS[sow.status]}
                        </span>
                      </div>
                      {sow.lastBreedingDate && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Ngày phối gần nhất:</span>
                          <span className="font-mono-tabular">{formatDateVi(sow.lastBreedingDate)}</span>
                        </div>
                      )}
                      {sow.expectedFarrowingDate && ['bred', 'pregnant', 'farrowing'].includes(sow.status) && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Dự kiến đẻ:</span>
                          <span className="font-mono-tabular font-semibold text-emerald-700 dark:text-emerald-400">
                            {formatDateVi(sow.expectedFarrowingDate)}
                          </span>
                        </div>
                      )}
                      {sow.expectedWeaningDate && sow.status === 'lactating' && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Dự kiến cai sữa:</span>
                          <span className="font-mono-tabular font-semibold text-amber-600 dark:text-amber-400">
                            {formatDateVi(sow.expectedWeaningDate)}
                          </span>
                        </div>
                      )}
                      {(() => {
                        const activeLitter = activeLitterBySowId.get(sow.id);
                        if (!activeLitter) return null;
                        const ageDays = Math.max(0, diffDays(activeLitter.farrowingDate, todayIso()));
                        return (
                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                            <span className="text-slate-600 dark:text-slate-300 font-medium">
                              Ổ theo mẹ: <strong className="font-mono-tabular">{activeLitter.currentCount} con</strong> · {ageDays}n
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setLitterSowFilter(sow.id);
                                setLitterStatusFilter('suckling');
                                setSubTab('litters');
                              }}
                              className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline whitespace-nowrap"
                            >
                              Theo dõi ổ →
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSowForBreed(sow);
                          setBreedForm({ date: todayIso(), boarTag: '', notes: '' });
                        }}
                        className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-700 hover:text-white text-slate-800 dark:text-slate-200 text-xs font-medium transition-colors whitespace-nowrap"
                      >
                        <CalendarCheck className="w-3.5 h-3.5" />
                        <span>Phối giống</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTimelineSowId(sow.id);
                          document
                            .getElementById('sow-timeline-panel')
                            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                          isSelectedForTimeline
                            ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Dòng thời gian</span>
                      </button>
                    </div>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void onDeleteSubDoc('sows', sow.id)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="Xóa heo nái"
                        aria-label={`Xóa nái ${sow.earTag}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                );
              })
            )}
          </section>
        </div>
      )}

      {/* SUCKLING PIGLET LITTERS PER SOW TAB */}
      {subTab === 'litters' && (
        <div className="space-y-5">
          {/* Summary KPI strip */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Số ổ đang theo mẹ
              </div>
              <div className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white font-mono-tabular">
                {formatNumber(litterStats.sucklingCount)} ổ
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                Đã cai sữa: {formatNumber(litterStats.weanedCount)} ổ
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Tổng heo con theo mẹ hiện có
              </div>
              <div className="mt-1.5 text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono-tabular">
                {formatNumber(litterStats.totalHeads)} con
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                Bình quân {formatNumber(litterStats.avgPerLitter, 1)} con / ổ
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Ổ sắp cai sữa (≤ 5 ngày tới)
              </div>
              <div className="mt-1.5 text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono-tabular">
                {formatNumber(litterStats.weaningSoonCount)} ổ
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                Dự kiến cai sữa {formatNumber(litterStats.weaningSoonHeads)} con
              </div>
            </div>
          </section>

          {/* Filter controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 self-start">
              <button
                type="button"
                onClick={() => setLitterStatusFilter('suckling')}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  litterStatusFilter === 'suckling'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Đang theo mẹ ({litterStats.sucklingCount})
              </button>
              <button
                type="button"
                onClick={() => setLitterStatusFilter('weaned')}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  litterStatusFilter === 'weaned'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Đã cai sữa ({litterStats.weanedCount})
              </button>
              <button
                type="button"
                onClick={() => setLitterStatusFilter('all')}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  litterStatusFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Tất cả ({pigLitters.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Lọc theo nái:
              </label>
              <select
                value={litterSowFilter}
                onChange={(e) => setLitterSowFilter(e.target.value)}
                className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
              >
                <option value="all">Tất cả heo nái</option>
                {sows.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.earTag} {s.name ? `· ${s.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Litter Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredLitters.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
                <Baby className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Chưa có ổ heo con theo mẹ nào khớp bộ lọc.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Hệ thống tự động tạo ổ heo con khi xác nhận sự kiện &ldquo;Đẻ con&rdquo; của heo nái, hoặc bạn có thể thêm thủ công bên dưới.
                </p>
                {sows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleOpenAddLitter()}
                    className="mt-4 min-h-[42px] px-4 py-2 rounded-xl bg-emerald-700 text-white text-sm font-medium"
                  >
                    Thêm ổ heo con theo mẹ
                  </button>
                )}
              </div>
            ) : (
              filteredLitters.map((lit) => {
                const today = todayIso();
                const ageDays = Math.max(0, diffDays(lit.farrowingDate, lit.weanedDate || today));
                const ageWeeks = Math.max(1, Math.ceil((ageDays + 1) / 7));
                const expWean = lit.expectedWeaningDate || addDays(lit.farrowingDate, farm.weaningDays || 24);
                const daysToWean = diffDays(today, expWean);

                return (
                  <div
                    key={lit.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono-tabular font-semibold text-slate-700 dark:text-slate-200">
                              Nái {lit.sowEarTag}
                            </span>
                            <span> · Lứa {lit.parity} · </span>
                            <span>{lit.barnName || 'Chuồng đẻ'}</span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono-tabular mt-0.5">
                            {lit.litterCode}
                          </h3>
                        </div>
                        <span
                          className={`text-xs font-semibold whitespace-nowrap ${
                            lit.status === 'weaned'
                              ? 'text-slate-500 dark:text-slate-400'
                              : lit.healthStatus === 'sick'
                              ? 'text-red-600 dark:text-red-400'
                              : lit.healthStatus === 'monitoring'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {lit.status === 'weaned'
                            ? 'Đã cai sữa'
                            : lit.healthStatus === 'healthy'
                            ? 'Ổ khỏe mạnh'
                            : lit.healthStatus === 'monitoring'
                            ? 'Đang theo dõi'
                            : 'Cảnh báo bệnh'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-100 dark:border-slate-800 text-xs">
                        <div>
                          <div className="text-slate-500">Còn nuôi / Đẻ sống</div>
                          <div className="text-sm font-bold font-mono-tabular mt-0.5">
                            {lit.status === 'weaned'
                              ? `${formatNumber(lit.weanedCount ?? lit.currentCount)} / ${formatNumber(lit.liveBorn)} con`
                              : `${formatNumber(lit.currentCount)} / ${formatNumber(lit.liveBorn)} con`}
                          </div>
                          {(lit.mortalityCount || 0) > 0 && (
                            <div className="text-[11px] text-red-600 dark:text-red-400 font-mono-tabular">
                              Hao hụt: {lit.mortalityCount} con
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-slate-500">Tuổi heo con</div>
                          <div className="text-sm font-bold font-mono-tabular mt-0.5">
                            {ageDays} ngày
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono-tabular">
                            Tuần {ageWeeks}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">TL bình quân</div>
                          <div className="text-sm font-bold font-mono-tabular mt-0.5">
                            {formatNumber(lit.avgWeightKg || 0, 1)} kg/con
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Ngày đẻ:</span>
                          <span className="font-mono-tabular">{formatDateVi(lit.farrowingDate)}</span>
                        </div>
                        {lit.status === 'suckling' ? (
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500">Dự kiến cai sữa:</span>
                            <span
                              className={`font-mono-tabular font-semibold ${
                                daysToWean < 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : daysToWean <= 5
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-emerald-700 dark:text-emerald-400'
                              }`}
                            >
                              {formatDateVi(expWean)}
                              {daysToWean < 0
                                ? ` (Quá ${Math.abs(daysToWean)} ngày)`
                                : daysToWean === 0
                                ? ' (Hôm nay)'
                                : ` (Còn ${daysToWean} ngày)`}
                            </span>
                          </div>
                        ) : (
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500">Ngày cai sữa thực tế:</span>
                            <span className="font-mono-tabular font-medium text-slate-800 dark:text-slate-200">
                              {lit.weanedDate ? formatDateVi(lit.weanedDate) : '—'}
                            </span>
                          </div>
                        )}
                        {lit.notes && (
                          <div className="text-slate-500 dark:text-slate-400 pt-0.5">
                            Ghi chú: {lit.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex flex-wrap items-center gap-2">
                        {lit.status === 'suckling' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenWeanLitter(lit)}
                              className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium whitespace-nowrap"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Cai sữa & Chuyển lô</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditLitter(lit)}
                              className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium whitespace-nowrap"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Cập nhật ổ</span>
                            </button>
                          </>
                        ) : (
                          <>
                            {lit.weanedGroupId && (
                              <button
                                type="button"
                                onClick={() => setSubTab('groups')}
                                className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap"
                              >
                                Xem nhóm thịt →
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditLitter(lit)}
                                className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium whitespace-nowrap"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Sửa</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void onDeleteSubDoc('pigLitters', lit.id)}
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="Xóa ổ heo con"
                          aria-label={`Xóa ổ ${lit.litterCode}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* FATTENING PIG GROUPS TAB */}
      {subTab === 'groups' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredGroups.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Chưa có nhóm heo nuôi thịt nào.
              </p>
              <button
                type="button"
                onClick={() => setShowAddGroup(true)}
                className="mt-3 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 text-white text-sm font-medium"
              >
                Tạo lô heo nuôi thịt mới
              </button>
            </div>
          ) : (
            filteredGroups.map((grp) => {
              const eco = computeGroupEconomics(grp);
              return (
                <div
                  key={grp.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono-tabular">{grp.batchCode}</span>
                        <span> · </span>
                        <span>{grp.barnName || 'Chuồng thịt'}</span>
                        <span> · </span>
                        <span>{eco.ageWeeks} tuần tuổi</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                        {grp.name}
                      </h3>
                    </div>
                    <span
                      className={`text-xs font-semibold whitespace-nowrap ${
                        grp.status === 'sold_out'
                          ? 'text-slate-500'
                          : grp.healthStatus === 'sick'
                          ? 'text-red-600 dark:text-red-400'
                          : grp.healthStatus === 'monitoring'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {grp.status === 'sold_out'
                        ? 'Đã xuất hết'
                        : grp.healthStatus === 'healthy'
                        ? 'Đàn khỏe'
                        : grp.healthStatus === 'monitoring'
                        ? 'Theo dõi'
                        : 'Cảnh báo bệnh'}
                    </span>
                  </div>

                  {/* Productivity Metrics */}
                  <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <div className="text-slate-500">Số lượng hiện tại</div>
                      <div className="text-sm font-bold font-mono-tabular mt-0.5">
                        {formatNumber(grp.currentCount)} / {formatNumber(grp.initialCount)} con
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Trọng lượng TB</div>
                      <div className="text-sm font-bold font-mono-tabular mt-0.5">
                        {formatNumber(grp.currentAvgWeightKg || 0, 1)} kg/con
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Tỷ lệ hao hụt</div>
                      <div className="text-sm font-bold font-mono-tabular mt-0.5">
                        {formatNumber(eco.mortalityPct, 1)}% ({grp.mortalityCount || 0} con)
                      </div>
                    </div>
                  </div>

                  {/* Automatic Cost & Profit Breakdown */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Con giống + Thức ăn + Thuốc + Khác:</span>
                      <span className="font-mono-tabular font-medium text-slate-800 dark:text-slate-200">
                        {formatVND(eco.totalCost)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 font-mono-tabular">
                      <span>
                        Giống {formatVND(grp.entryCostTotal || 0)} · Cám {formatVND(grp.feedCostTotal || 0)} · Thuốc {formatVND(grp.medCostTotal || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500">Doanh thu xuất bán:</span>
                      <span className="font-mono-tabular font-semibold text-slate-900 dark:text-white">
                        {formatVND(eco.revenue)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        Lợi nhuận ước tính / thực tế:
                      </span>
                      <span
                        className={`font-mono-tabular font-bold ${
                          eco.profit >= 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {formatVND(eco.profit)}
                      </span>
                    </div>
                  </div>

                  {/* Group Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      {grp.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSaleTargetGroup(grp);
                            setSaleForm({
                              date: todayIso(),
                              headCount: grp.currentCount,
                              totalWeightKg: Math.round(
                                grp.currentCount * (grp.currentAvgWeightKg || 95)
                              ),
                              unitPrice: 65000,
                              partnerName: '',
                              notes: '',
                            });
                          }}
                          className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium whitespace-nowrap"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Xuất bán heo</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setWeightEditGroup(grp);
                          setPerfForm({
                            currentAvgWeightKg: grp.currentAvgWeightKg || 0,
                            mortalityAdd: 0,
                            otherCostAdd: 0,
                            healthStatus: grp.healthStatus,
                            notes: grp.notes || '',
                          });
                        }}
                        className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium whitespace-nowrap"
                      >
                        Cập nhật cân nặng / hao hụt
                      </button>
                    </div>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void onDeleteSubDoc('pigGroups', grp.id)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600"
                        title="Xóa lô heo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL: Add Sow */}
      {showAddSow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={(e) => void handleCreateSow(e)}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-semibold">Nhập cá thể heo nái mới</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Số tai (bắt buộc)</span>
                <input
                  required
                  value={sowForm.earTag}
                  onChange={(e) => setSowForm({ ...sowForm, earTag: e.target.value })}
                  placeholder="VD: NAI-006"
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Tên gọi / Ghi nhớ</span>
                <input
                  value={sowForm.name}
                  onChange={(e) => setSowForm({ ...sowForm, name: e.target.value })}
                  placeholder="VD: Nái F1 06"
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Giống heo</span>
                <input
                  value={sowForm.breedName}
                  onChange={(e) => setSowForm({ ...sowForm, breedName: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Chuồng nuôi</span>
                <input
                  value={sowForm.barnName}
                  onChange={(e) => setSowForm({ ...sowForm, barnName: e.target.value })}
                  placeholder="VD: Chuồng nái A"
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Trạng thái ban đầu</span>
                <select
                  value={sowForm.status}
                  onChange={(e) => setSowForm({ ...sowForm, status: e.target.value as Sow['status'] })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="empty">Chờ phối (Hậu bị)</option>
                  <option value="bred">Đã phối giống</option>
                  <option value="pregnant">Đang mang thai</option>
                  <option value="lactating">Đang nuôi con</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Lứa đẻ hiện tại</span>
                <input
                  type="number"
                  min={0}
                  value={sowForm.parity}
                  onChange={(e) => setSowForm({ ...sowForm, parity: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              {(sowForm.status === 'bred' || sowForm.status === 'pregnant') && (
                <>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ngày phối giống</span>
                    <input
                      type="date"
                      value={sowForm.lastBreedingDate}
                      onChange={(e) => setSowForm({ ...sowForm, lastBreedingDate: e.target.value })}
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Số tai đực phối</span>
                    <input
                      value={sowForm.boarTag}
                      onChange={(e) => setSowForm({ ...sowForm, boarTag: e.target.value })}
                      placeholder="VD: DUC-02"
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                    />
                  </label>
                </>
              )}
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Giá nhập giống (VND)</span>
                <input
                  type="number"
                  min={0}
                  value={sowForm.purchaseCost}
                  onChange={(e) => setSowForm({ ...sowForm, purchaseCost: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ngày nhập</span>
                <input
                  type="date"
                  value={sowForm.entryDate}
                  onChange={(e) => setSowForm({ ...sowForm, entryDate: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddSow(false)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800"
              >
                Lưu heo nái
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Record Sow Breeding */}
      {selectedSowForBreed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onRecordSowBreeding(
                selectedSowForBreed,
                breedForm.date,
                breedForm.boarTag,
                breedForm.notes
              ).then(() => setSelectedSowForBreed(null));
            }}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <h3 className="text-lg font-semibold">
              Ghi nhận phối giống · {selectedSowForBreed.earTag}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Hệ thống sẽ tự động tạo lịch kiểm tra đậu thai (+21 ngày), dự kiến đẻ (+{farm.gestationDays} ngày), cai sữa (+{farm.weaningDays} ngày) và phối lại.
            </p>
            <div className="space-y-3 text-sm">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ngày phối giống</span>
                <input
                  type="date"
                  required
                  value={breedForm.date}
                  onChange={(e) => setBreedForm({ ...breedForm, date: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Mã đực giống / Tinh</span>
                <input
                  value={breedForm.boarTag}
                  onChange={(e) => setBreedForm({ ...breedForm, boarTag: e.target.value })}
                  placeholder="VD: DUROC-09"
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ghi chú</span>
                <input
                  value={breedForm.notes}
                  onChange={(e) => setBreedForm({ ...breedForm, notes: e.target.value })}
                  placeholder="Phối 2 liều sáng/chiều"
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedSowForBreed(null)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800"
              >
                Xác nhận & Tạo lịch tự động
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Complete Sow Event */}
      {selectedEventToComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onCompleteSowEvent(selectedEventToComplete, evForm).then(() =>
                setSelectedEventToComplete(null)
              );
            }}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <h3 className="text-lg font-semibold">
              Hoàn thành: {SOW_EVENT_LABELS[selectedEventToComplete.eventType]} ({selectedEventToComplete.sowEarTag})
            </h3>
            <div className="space-y-3 text-sm">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ngày thực hiện thực tế</span>
                <input
                  type="date"
                  required
                  value={evForm.actualDate}
                  onChange={(e) => setEvForm({ ...evForm, actualDate: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>

              {selectedEventToComplete.eventType === 'farrowing' && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Số con sống</span>
                    <input
                      type="number"
                      min={0}
                      value={evForm.liveBorn}
                      onChange={(e) => setEvForm({ ...evForm, liveBorn: Number(e.target.value) })}
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Chết lưu / Còi</span>
                    <input
                      type="number"
                      min={0}
                      value={evForm.stillborn}
                      onChange={(e) => setEvForm({ ...evForm, stillborn: Number(e.target.value) })}
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                    />
                  </label>
                </div>
              )}

              {selectedEventToComplete.eventType === 'weaning' && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Số con cai sữa</span>
                    <input
                      type="number"
                      min={0}
                      value={evForm.weanedCount}
                      onChange={(e) => setEvForm({ ...evForm, weanedCount: Number(e.target.value) })}
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">TL bình quân (kg)</span>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={evForm.avgWeightKg}
                      onChange={(e) => setEvForm({ ...evForm, avgWeightKg: Number(e.target.value) })}
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                    />
                  </label>
                </div>
              )}

              {selectedEventToComplete.eventType === 'next_breeding' && (
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Mã đực giống phối mới</span>
                  <input
                    value={evForm.boarTag}
                    onChange={(e) => setEvForm({ ...evForm, boarTag: e.target.value })}
                    placeholder="VD: DUC-02"
                    className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                  />
                </label>
              )}

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ghi chú</span>
                <input
                  value={evForm.notes}
                  onChange={(e) => setEvForm({ ...evForm, notes: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedEventToComplete(null)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800"
              >
                Lưu & Cập nhật chu kỳ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Add Pig Group */}
      {showAddGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={(e) => void handleCreateGroup(e)}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-semibold">Nhập lô heo nuôi thịt / heo giống mới</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Mã lô (bắt buộc)</span>
                <input
                  required
                  value={groupForm.batchCode}
                  onChange={(e) => setGroupForm({ ...groupForm, batchCode: e.target.value })}
                  placeholder="VD: LO-2026-04"
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Tên nhóm heo</span>
                <input
                  required
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder="VD: Lô thịt khu C2"
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Số lượng nhập (con)</span>
                <input
                  type="number"
                  min={1}
                  required
                  value={groupForm.initialCount}
                  onChange={(e) => setGroupForm({ ...groupForm, initialCount: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Trọng lượng nhập TB (kg)</span>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={groupForm.avgEntryWeightKg}
                  onChange={(e) => setGroupForm({ ...groupForm, avgEntryWeightKg: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ngày sinh ước tính</span>
                <input
                  type="date"
                  required
                  value={groupForm.birthDate}
                  onChange={(e) => setGroupForm({ ...groupForm, birthDate: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ngày nhập chuồng</span>
                <input
                  type="date"
                  required
                  value={groupForm.entryDate}
                  onChange={(e) => setGroupForm({ ...groupForm, entryDate: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Tổng tiền giống (VND)</span>
                <input
                  type="number"
                  min={0}
                  value={groupForm.entryCostTotal}
                  onChange={(e) => setGroupForm({ ...groupForm, entryCostTotal: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Chuồng nuôi</span>
                <input
                  value={groupForm.barnName}
                  onChange={(e) => setGroupForm({ ...groupForm, barnName: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddGroup(false)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800"
              >
                Tạo lô heo
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Sell Fattening Pigs */}
      {saleTargetGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={(e) => void handleSellGroup(e)}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <h3 className="text-lg font-semibold">Xuất bán heo · {saleTargetGroup.name}</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Số con xuất bán</span>
                <input
                  type="number"
                  min={1}
                  max={saleTargetGroup.currentCount}
                  required
                  value={saleForm.headCount}
                  onChange={(e) => setSaleForm({ ...saleForm, headCount: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Tổng cân hơi (kg)</span>
                <input
                  type="number"
                  min={1}
                  required
                  value={saleForm.totalWeightKg}
                  onChange={(e) => setSaleForm({ ...saleForm, totalWeightKg: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Đơn giá (VND/kg)</span>
                <input
                  type="number"
                  min={0}
                  required
                  value={saleForm.unitPrice}
                  onChange={(e) => setSaleForm({ ...saleForm, unitPrice: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ngày xuất</span>
                <input
                  type="date"
                  required
                  value={saleForm.date}
                  onChange={(e) => setSaleForm({ ...saleForm, date: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="col-span-2 space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Thương lái / Khách mua</span>
                <input
                  value={saleForm.partnerName}
                  onChange={(e) => setSaleForm({ ...saleForm, partnerName: e.target.value })}
                  placeholder="VD: Lò mổ Anh Tuấn"
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-sm flex justify-between font-semibold">
              <span>Thành tiền doanh thu:</span>
              <span className="font-mono-tabular text-emerald-700 dark:text-emerald-400">
                {formatVND((Number(saleForm.totalWeightKg) || 0) * (Number(saleForm.unitPrice) || 0))}
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSaleTargetGroup(null)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800"
              >
                Xác nhận xuất bán
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Update Group Performance */}
      {weightEditGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={(e) => void handleUpdateGroupPerf(e)}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <h3 className="text-lg font-semibold">Cập nhật năng suất · {weightEditGroup.name}</h3>
            <div className="space-y-3 text-sm">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Trọng lượng trung bình hiện tại (kg/con)</span>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={perfForm.currentAvgWeightKg}
                  onChange={(e) => setPerfForm({ ...perfForm, currentAvgWeightKg: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Số con hao hụt phát sinh thêm</span>
                <input
                  type="number"
                  min={0}
                  max={weightEditGroup.currentCount}
                  value={perfForm.mortalityAdd}
                  onChange={(e) => setPerfForm({ ...perfForm, mortalityAdd: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Chi phí khác phát sinh (điện, nước, công...)</span>
                <input
                  type="number"
                  min={0}
                  value={perfForm.otherCostAdd}
                  onChange={(e) => setPerfForm({ ...perfForm, otherCostAdd: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Tình trạng sức khỏe lô</span>
                <select
                  value={perfForm.healthStatus}
                  onChange={(e) =>
                    setPerfForm({ ...perfForm, healthStatus: e.target.value as PigGroup['healthStatus'] })
                  }
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="healthy">Đàn khỏe</option>
                  <option value="monitoring">Theo dõi</option>
                  <option value="sick">Đang điều trị bệnh</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setWeightEditGroup(null)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800"
              >
                Lưu cập nhật
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Add Suckling Litter per Sow */}
      {showAddLitter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={(e) => void handleCreateLitter(e)}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-semibold">Thêm ổ heo con theo mẹ</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label className="sm:col-span-2 space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Chọn heo nái mẹ (bắt buộc)
                </span>
                <select
                  required
                  value={litterForm.sowId}
                  onChange={(e) => {
                    const sow = sows.find((s) => s.id === e.target.value);
                    const parity = Math.max(1, sow?.parity || 1);
                    setLitterForm({
                      ...litterForm,
                      sowId: e.target.value,
                      parity,
                      barnName: sow?.barnName || litterForm.barnName,
                      litterCode: sow ? `OC-${sow.earTag}-L${parity}` : litterForm.litterCode,
                    });
                  }}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  {sows.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.earTag} {s.name ? `· ${s.name}` : ''} ({SOW_STATUS_LABELS[s.status]})
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Mã ổ heo con</span>
                <input
                  required
                  value={litterForm.litterCode}
                  onChange={(e) => setLitterForm({ ...litterForm, litterCode: e.target.value })}
                  placeholder="VD: OC-NAI003-L4"
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Lứa đẻ</span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  required
                  value={litterForm.parity}
                  onChange={(e) => setLitterForm({ ...litterForm, parity: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ngày đẻ</span>
                <input
                  type="date"
                  required
                  value={litterForm.farrowingDate}
                  onChange={(e) => {
                    const nextFarrow = e.target.value;
                    setLitterForm({
                      ...litterForm,
                      farrowingDate: nextFarrow,
                      expectedWeaningDate: addDays(nextFarrow, farm.weaningDays || 24),
                    });
                  }}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Dự kiến cai sữa</span>
                <input
                  type="date"
                  value={litterForm.expectedWeaningDate}
                  onChange={(e) => setLitterForm({ ...litterForm, expectedWeaningDate: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Số con đẻ sống</span>
                <input
                  type="number"
                  min={0}
                  max={40}
                  required
                  value={litterForm.liveBorn}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setLitterForm({ ...litterForm, liveBorn: val, currentCount: val });
                  }}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Số con hiện còn</span>
                <input
                  type="number"
                  min={0}
                  max={40}
                  required
                  value={litterForm.currentCount}
                  onChange={(e) => setLitterForm({ ...litterForm, currentCount: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">TL bình quân (kg)</span>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  value={litterForm.avgWeightKg}
                  onChange={(e) => setLitterForm({ ...litterForm, avgWeightKg: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ô / Chuồng đẻ</span>
                <input
                  value={litterForm.barnName}
                  onChange={(e) => setLitterForm({ ...litterForm, barnName: e.target.value })}
                  placeholder="VD: Chuồng đẻ B1"
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>

              <label className="sm:col-span-2 space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ghi chú chăm sóc</span>
                <input
                  value={litterForm.notes}
                  onChange={(e) => setLitterForm({ ...litterForm, notes: e.target.value })}
                  placeholder="VD: Đã bấm nanh, tiêm sắt ngày 3..."
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddLitter(false)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800"
              >
                Lưu ổ heo con
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Update Suckling Litter */}
      {editingLitter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={(e) => void handleSaveEditLitter(e)}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <h3 className="text-lg font-semibold">
              Cập nhật ổ {editingLitter.litterCode} (Nái {editingLitter.sowEarTag})
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Số con hiện còn</span>
                <input
                  type="number"
                  min={0}
                  max={40}
                  required
                  value={litterEditForm.currentCount}
                  onChange={(e) =>
                    setLitterEditForm({ ...litterEditForm, currentCount: Number(e.target.value) })
                  }
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Tổng hao hụt (con)</span>
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={litterEditForm.mortalityCount}
                  onChange={(e) =>
                    setLitterEditForm({ ...litterEditForm, mortalityCount: Number(e.target.value) })
                  }
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">TL bình quân (kg)</span>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  value={litterEditForm.avgWeightKg}
                  onChange={(e) =>
                    setLitterEditForm({ ...litterEditForm, avgWeightKg: Number(e.target.value) })
                  }
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Sức khỏe ổ</span>
                <select
                  value={litterEditForm.healthStatus}
                  onChange={(e) =>
                    setLitterEditForm({
                      ...litterEditForm,
                      healthStatus: e.target.value as PigLitter['healthStatus'],
                    })
                  }
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="healthy">Ổ khỏe mạnh</option>
                  <option value="monitoring">Đang theo dõi</option>
                  <option value="sick">Cảnh báo bệnh</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Dự kiến cai sữa</span>
                <input
                  type="date"
                  value={litterEditForm.expectedWeaningDate}
                  onChange={(e) =>
                    setLitterEditForm({ ...litterEditForm, expectedWeaningDate: e.target.value })
                  }
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Chuồng đẻ</span>
                <input
                  value={litterEditForm.barnName}
                  onChange={(e) =>
                    setLitterEditForm({ ...litterEditForm, barnName: e.target.value })
                  }
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="col-span-2 space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ghi chú</span>
                <input
                  value={litterEditForm.notes}
                  onChange={(e) => setLitterEditForm({ ...litterEditForm, notes: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingLitter(null)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800"
              >
                Lưu thay đổi
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Wean Suckling Litter & Transfer to Fattening Group */}
      {weaningTargetLitter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={(e) => void handleSubmitWeanLitter(e)}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-semibold">
              Cai sữa ổ {weaningTargetLitter.litterCode} (Nái {weaningTargetLitter.sowEarTag})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Hoàn tất cai sữa sẽ tự động chuyển trạng thái nái mẹ sang &ldquo;Chờ phối&rdquo; và cập nhật ngày lên giống tiếp theo.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ngày cai sữa</span>
                <input
                  type="date"
                  required
                  value={weanLitterForm.weanedDate}
                  onChange={(e) =>
                    setWeanLitterForm({ ...weanLitterForm, weanedDate: e.target.value })
                  }
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Số con cai sữa</span>
                <input
                  type="number"
                  min={0}
                  max={40}
                  required
                  value={weanLitterForm.weanedCount}
                  onChange={(e) =>
                    setWeanLitterForm({ ...weanLitterForm, weanedCount: Number(e.target.value) })
                  }
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">TL bình quân cai sữa (kg)</span>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  required
                  value={weanLitterForm.avgWeightKg}
                  onChange={(e) =>
                    setWeanLitterForm({ ...weanLitterForm, avgWeightKg: Number(e.target.value) })
                  }
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <div className="flex items-end pb-2">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={weanLitterForm.createGroup}
                    onChange={(e) =>
                      setWeanLitterForm({ ...weanLitterForm, createGroup: e.target.checked })
                    }
                    className="w-4 h-4 accent-emerald-700 rounded"
                  />
                  <span>Tạo lô mới trong Nhóm heo thịt</span>
                </label>
              </div>

              {weanLitterForm.createGroup && (
                <>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Mã lô heo thịt mới</span>
                    <input
                      required
                      value={weanLitterForm.batchCode}
                      onChange={(e) =>
                        setWeanLitterForm({ ...weanLitterForm, batchCode: e.target.value })
                      }
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Chuồng chuyển đến</span>
                    <input
                      value={weanLitterForm.targetBarnName}
                      onChange={(e) =>
                        setWeanLitterForm({ ...weanLitterForm, targetBarnName: e.target.value })
                      }
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                    />
                  </label>
                  <label className="sm:col-span-2 space-y-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Tên nhóm heo cai sữa</span>
                    <input
                      required
                      value={weanLitterForm.groupName}
                      onChange={(e) =>
                        setWeanLitterForm({ ...weanLitterForm, groupName: e.target.value })
                      }
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                    />
                  </label>
                </>
              )}

              <label className="sm:col-span-2 space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ghi chú</span>
                <input
                  value={weanLitterForm.notes}
                  onChange={(e) => setWeanLitterForm({ ...weanLitterForm, notes: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWeaningTargetLitter(null)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800"
              >
                Xác nhận cai sữa
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
