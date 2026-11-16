import type {
  CareReminder,
  Farm,
  FeedRation,
  FeedType,
  FinancialTx,
  HealthLog,
  InventoryItem,
  PigGroup,
  PigLitter,
  RationPigCategory,
  Sow,
  SowEvent,
  SowEventType,
  VaccinationProgram,
} from '../types';

export function todayIso(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function addDays(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(base.getTime())) return todayIso();
  base.setDate(base.getDate() + days);
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(base.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function diffDays(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00`).getTime();
  const b = new Date(`${toIso}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function formatDateVi(isoDate?: string): string {
  if (!isoDate) return '—';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Math.round(amount || 0));
}

export function formatNumber(n: number, decimals = 0): string {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n || 0);
}

export function makeId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export const SOW_EVENT_LABELS: Record<SowEventType, string> = {
  breeding: 'Phối giống',
  pregnancy_check: 'Kiểm tra đậu thai (21 ngày)',
  farrowing: 'Đẻ con',
  weaning: 'Cai sữa',
  next_breeding: 'Phối giống lần tiếp theo',
  vaccination: 'Tiêm phòng định kỳ',
  health_check: 'Kiểm tra sức khỏe',
};

export const SOW_STATUS_LABELS: Record<Sow['status'], string> = {
  empty: 'Chờ phối (Hậu bị / Cai sữa)',
  bred: 'Đã phối giống',
  pregnant: 'Đang mang thai',
  farrowing: 'Chuẩn bị đẻ',
  lactating: 'Đang nuôi con',
  culled: 'Loại thải',
  sold: 'Đã xuất bán',
};

export function buildAutoEventsFromBreeding(
  sow: Sow,
  breedingDate: string,
  farm: Farm,
  boarTag?: string
): Array<{
  eventType: SowEventType;
  scheduledDate: string;
  status: 'pending' | 'completed';
  actualDate?: string;
  boarTag?: string;
  notes: string;
}> {
  const gestationDays = farm.gestationDays || 114;
  const weaningDays = farm.weaningDays || 24;
  const estrusDays = farm.postWeaningEstrusDays || 5;

  const checkDate = addDays(breedingDate, 21);
  const farrowDate = addDays(breedingDate, gestationDays);
  const weanDate = addDays(farrowDate, weaningDays);
  const nextBreedDate = addDays(weanDate, estrusDays);

  return [
    {
      eventType: 'breeding',
      scheduledDate: breedingDate,
      actualDate: breedingDate,
      status: 'completed',
      boarTag,
      notes: `Phối giống nái ${sow.earTag}${boarTag ? ` · Đực giống ${boarTag}` : ''}`,
    },
    {
      eventType: 'pregnancy_check',
      scheduledDate: checkDate,
      status: 'pending',
      notes: `Siêu âm / kiểm tra không lên giống lại (+21 ngày sau phối)`,
    },
    {
      eventType: 'farrowing',
      scheduledDate: farrowDate,
      status: 'pending',
      notes: `Dự kiến đẻ con (+${gestationDays} ngày mang thai)`,
    },
    {
      eventType: 'weaning',
      scheduledDate: weanDate,
      status: 'pending',
      notes: `Dự kiến cai sữa heo con (+${weaningDays} ngày sau đẻ)`,
    },
    {
      eventType: 'next_breeding',
      scheduledDate: nextBreedDate,
      status: 'pending',
      notes: `Dự kiến lên giống phối lại (+${estrusDays} ngày sau cai sữa)`,
    },
  ];
}

export interface GroupEconomics {
  totalCost: number;
  revenue: number;
  profit: number;
  marginPct: number;
  costPerHead: number;
  mortalityPct: number;
  ageDays: number;
  ageWeeks: number;
}

export function computeGroupEconomics(group: PigGroup, refDate = todayIso()): GroupEconomics {
  const entry = group.entryCostTotal || 0;
  const feed = group.feedCostTotal || 0;
  const med = group.medCostTotal || 0;
  const other = group.otherCostTotal || 0;
  const totalCost = entry + feed + med + other;
  const revenue = group.revenueTotal || 0;
  const profit = revenue - totalCost;
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : totalCost > 0 ? -100 : 0;
  const headBase = Math.max(group.initialCount || 1, 1);
  const costPerHead = totalCost / headBase;
  const mortalityPct = ((group.mortalityCount || 0) / headBase) * 100;
  const ageDays = Math.max(0, diffDays(group.birthDate || group.entryDate, refDate));
  const ageWeeks = Math.max(1, Math.ceil(ageDays / 7));

  return {
    totalCost,
    revenue,
    profit,
    marginPct,
    costPerHead,
    mortalityPct,
    ageDays,
    ageWeeks,
  };
}

export interface AgeWeekBucket {
  weekLabel: string;
  stageName: string;
  headCount: number;
  groupCount: number;
}

export function computeFatteningAgeForecast(
  groups: PigGroup[],
  refDate = todayIso()
): AgeWeekBucket[] {
  const stages = [
    { key: 'Tuần 1-4', stageName: 'Theo mẹ / Tập ăn', minW: 0, maxW: 4 },
    { key: 'Tuần 5-8', stageName: 'Cai sữa (Starter)', minW: 5, maxW: 8 },
    { key: 'Tuần 9-12', stageName: 'Heo choai (Grower)', minW: 9, maxW: 12 },
    { key: 'Tuần 13-16', stageName: 'Thịt tăng trọng', minW: 13, maxW: 16 },
    { key: 'Tuần 17-20', stageName: 'Vỗ béo (Finisher)', minW: 17, maxW: 20 },
    { key: 'Tuần 21+', stageName: 'Sẵn sàng xuất bán', minW: 21, maxW: 999 },
  ];

  const buckets = stages.map((s) => ({
    weekLabel: s.key,
    stageName: s.stageName,
    headCount: 0,
    groupCount: 0,
  }));

  for (const g of groups) {
    if (g.status !== 'active' || g.currentCount <= 0) continue;
    const ageDays = Math.max(1, diffDays(g.birthDate || g.entryDate, refDate));
    const ageWeeks = Math.ceil(ageDays / 7);
    const idx = stages.findIndex((s) => ageWeeks >= s.minW && ageWeeks <= s.maxW);
    if (idx >= 0) {
      buckets[idx].headCount += g.currentCount;
      buckets[idx].groupCount += 1;
    }
  }

  return buckets;
}

export interface SowGestationBucket {
  weekLabel: string;
  weekNumber: number;
  sowCount: number;
  earTags: string[];
}

export function computeSowGestationForecast(
  sows: Sow[],
  refDate = todayIso()
): SowGestationBucket[] {
  const buckets: SowGestationBucket[] = Array.from({ length: 17 }, (_, i) => ({
    weekLabel: i === 16 ? 'T16+ (Sắp đẻ)' : `Tuần ${i + 1}`,
    weekNumber: i + 1,
    sowCount: 0,
    earTags: [],
  }));

  for (const s of sows) {
    if (!['bred', 'pregnant', 'farrowing'].includes(s.status)) continue;
    if (!s.lastBreedingDate) continue;
    const days = Math.max(0, diffDays(s.lastBreedingDate, refDate));
    const weekIdx = Math.min(16, Math.floor(days / 7));
    buckets[weekIdx].sowCount += 1;
    buckets[weekIdx].earTags.push(s.earTag);
  }

  return buckets;
}

export interface SucklingAgeBucket {
  weekLabel: string;
  stageName: string;
  headCount: number;
  litterCount: number;
  sowTags: string[];
}

export interface SucklingPigletForecast {
  totalSucklingHeads: number;
  totalSucklingLitters: number;
  weaningSoonHeads: number;
  weaningSoonLitters: number;
  expectedNewborn30dHeads: number;
  expectedFarrowingSows30d: number;
  byAgeWeek: SucklingAgeBucket[];
  upcomingTimeline: Array<{
    type: 'weaning' | 'farrowing';
    date: string;
    deltaDays: number;
    sowEarTag: string;
    litterCode?: string;
    estimatedHeads: number;
    barnName?: string;
  }>;
}

export function computeSucklingPigletForecast(
  litters: PigLitter[],
  sows: Sow[],
  farm?: Pick<Farm, 'gestationDays' | 'weaningDays'>,
  avgExpectedLitterSize = 12,
  refDate = todayIso()
): SucklingPigletForecast {
  const weaningDays = farm?.weaningDays || 24;
  const gestationDays = farm?.gestationDays || 114;

  const stages = [
    { key: 'Tuần 1 (1–7n)', stageName: 'Sơ sinh · Giữ ấm & sắt', minD: 0, maxD: 7 },
    { key: 'Tuần 2 (8–14n)', stageName: 'Tập ăn Prestarter', minD: 8, maxD: 14 },
    { key: 'Tuần 3 (15–21n)', stageName: 'Tập ăn tăng cường', minD: 15, maxD: 21 },
    { key: 'Tuần 4+ (≥22n)', stageName: 'Chuẩn bị cai sữa', minD: 22, maxD: 9999 },
  ];

  const byAgeWeek: SucklingAgeBucket[] = stages.map((s) => ({
    weekLabel: s.key,
    stageName: s.stageName,
    headCount: 0,
    litterCount: 0,
    sowTags: [],
  }));

  const activeLitters = litters.filter((l) => l.status === 'suckling' && (l.currentCount || 0) > 0);
  let totalSucklingHeads = 0;
  let weaningSoonHeads = 0;
  let weaningSoonLitters = 0;

  const upcomingTimeline: SucklingPigletForecast['upcomingTimeline'] = [];

  for (const l of activeLitters) {
    const ageDays = Math.max(0, diffDays(l.farrowingDate, refDate));
    totalSucklingHeads += l.currentCount;

    const bucketIdx = stages.findIndex((s) => ageDays >= s.minD && ageDays <= s.maxD);
    if (bucketIdx >= 0) {
      byAgeWeek[bucketIdx].headCount += l.currentCount;
      byAgeWeek[bucketIdx].litterCount += 1;
      byAgeWeek[bucketIdx].sowTags.push(l.sowEarTag);
    }

    const expWean = l.expectedWeaningDate || addDays(l.farrowingDate, weaningDays);
    const deltaWean = diffDays(refDate, expWean);
    if (deltaWean <= 7) {
      weaningSoonHeads += l.currentCount;
      weaningSoonLitters += 1;
    }
    if (deltaWean >= -7 && deltaWean <= 30) {
      upcomingTimeline.push({
        type: 'weaning',
        date: expWean,
        deltaDays: deltaWean,
        sowEarTag: l.sowEarTag,
        litterCode: l.litterCode,
        estimatedHeads: l.currentCount,
        barnName: l.barnName,
      });
    }
  }

  let expectedNewborn30dHeads = 0;
  let expectedFarrowingSows30d = 0;

  for (const s of sows) {
    if (!['bred', 'pregnant', 'farrowing'].includes(s.status)) continue;
    const expFarrow =
      s.expectedFarrowingDate ||
      (s.lastBreedingDate ? addDays(s.lastBreedingDate, gestationDays) : undefined);
    if (!expFarrow) continue;
    const delta = diffDays(refDate, expFarrow);
    if (delta >= 0 && delta <= 30) {
      expectedFarrowingSows30d += 1;
      expectedNewborn30dHeads += avgExpectedLitterSize;
      upcomingTimeline.push({
        type: 'farrowing',
        date: expFarrow,
        deltaDays: delta,
        sowEarTag: s.earTag,
        estimatedHeads: avgExpectedLitterSize,
        barnName: s.barnName,
      });
    }
  }

  upcomingTimeline.sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalSucklingHeads,
    totalSucklingLitters: activeLitters.length,
    weaningSoonHeads,
    weaningSoonLitters,
    expectedNewborn30dHeads,
    expectedFarrowingSows30d,
    byAgeWeek,
    upcomingTimeline,
  };
}

export const RATION_CATEGORY_LABELS: Record<RationPigCategory, string> = {
  fattening: 'Heo thịt (theo tuần tuổi)',
  sow_gestation: 'Heo nái mang thai (theo tuần thai)',
  sow_lactation: 'Heo nái nuôi con (theo tuần nuôi con)',
  sow_waiting: 'Heo nái chờ phối (1 định mức)',
};

export function buildDefaultFeedRations(
  feedTypes: FeedType[]
): Array<{
  pigCategory: RationPigCategory;
  weekNumber: number;
  feedTypeId?: string;
  feedName: string;
  kgPerHeadPerDay: number;
  notes: string;
}> {
  const pickFeed = (stage: FeedType['stage'], fallbackName: string) => {
    const match = feedTypes.find((f) => f.stage === stage);
    return {
      feedTypeId: match?.id,
      feedName: match?.name || fallbackName,
    };
  };

  const pre = pickFeed('prestarter', 'Cám tập ăn heo con (21% đạm)');
  const start = pickFeed('starter', 'Cám heo cai sữa 10-25kg');
  const grow = pickFeed('grower', 'Cám heo choai 25-60kg');
  const fin = pickFeed('finisher', 'Cám vỗ béo 60-105kg');
  const gest = pickFeed('gestation', 'Cám nái mang thai');
  const lact = pickFeed('lactation', 'Cám nái nuôi con');

  const fatteningWeeks: Array<{ w: number; kg: number; feed: typeof pre; notes: string }> = [
    { w: 1, kg: 0.1, feed: pre, notes: 'Làm quen cám tập ăn' },
    { w: 2, kg: 0.25, feed: pre, notes: 'Tập ăn theo mẹ' },
    { w: 3, kg: 0.45, feed: pre, notes: 'Giai đoạn theo mẹ' },
    { w: 4, kg: 0.65, feed: pre, notes: 'Chuẩn bị cai sữa' },
    { w: 5, kg: 0.85, feed: start, notes: 'Tuần đầu sau cai sữa' },
    { w: 6, kg: 1.05, feed: start, notes: 'Heo cai sữa' },
    { w: 7, kg: 1.25, feed: start, notes: 'Heo cai sữa tăng tốc' },
    { w: 8, kg: 1.45, feed: start, notes: 'Chuyển tiếp lên cám choai' },
    { w: 9, kg: 1.7, feed: grow, notes: 'Đầu giai đoạn heo choai' },
    { w: 10, kg: 1.85, feed: grow, notes: 'Heo choai' },
    { w: 11, kg: 2.05, feed: grow, notes: 'Heo choai' },
    { w: 12, kg: 2.2, feed: grow, notes: 'Heo choai' },
    { w: 13, kg: 2.35, feed: grow, notes: 'Heo choai cuối kỳ' },
    { w: 14, kg: 2.5, feed: grow, notes: 'Chuyển tiếp vỗ béo' },
    { w: 15, kg: 2.65, feed: fin, notes: 'Bắt đầu vỗ béo' },
    { w: 16, kg: 2.8, feed: fin, notes: 'Vỗ béo' },
    { w: 17, kg: 2.95, feed: fin, notes: 'Vỗ béo' },
    { w: 18, kg: 3.1, feed: fin, notes: 'Vỗ béo' },
    { w: 19, kg: 3.2, feed: fin, notes: 'Vỗ béo tăng trọng cao' },
    { w: 20, kg: 3.25, feed: fin, notes: 'Giai đoạn hoàn thiện' },
    { w: 21, kg: 3.3, feed: fin, notes: 'Chuẩn bị xuất bán' },
    { w: 22, kg: 3.3, feed: fin, notes: 'Sẵn sàng xuất chuồng' },
  ];

  const rows: Array<{
    pigCategory: RationPigCategory;
    weekNumber: number;
    feedTypeId?: string;
    feedName: string;
    kgPerHeadPerDay: number;
    notes: string;
  }> = [];

  for (const item of fatteningWeeks) {
    rows.push({
      pigCategory: 'fattening',
      weekNumber: item.w,
      feedTypeId: item.feed.feedTypeId,
      feedName: item.feed.feedName,
      kgPerHeadPerDay: item.kg,
      notes: item.notes,
    });
  }

  // Gestation weeks 1-17
  for (let w = 1; w <= 17; w++) {
    const kg = w <= 4 ? 2.2 : w <= 12 ? 2.4 : w <= 16 ? 2.9 : 2.5;
    const notes =
      w <= 4
        ? 'Ổn định phôi thai đầu kỳ'
        : w <= 12
        ? 'Duy trì thể trạng mang thai'
        : w <= 16
        ? 'Tăng cường dưỡng chất nuôi thai cuối kỳ'
        : 'Giảm nhẹ cám sát ngày đẻ';
    rows.push({
      pigCategory: 'sow_gestation',
      weekNumber: w,
      feedTypeId: gest.feedTypeId,
      feedName: gest.feedName,
      kgPerHeadPerDay: kg,
      notes,
    });
  }

  // Lactation weeks 1-4
  const lactKgs = [4.2, 5.2, 6.0, 5.5];
  lactKgs.forEach((kg, idx) => {
    rows.push({
      pigCategory: 'sow_lactation',
      weekNumber: idx + 1,
      feedTypeId: lact.feedTypeId,
      feedName: lact.feedName,
      kgPerHeadPerDay: kg,
      notes: `Nuôi con tuần ${idx + 1} (tăng tiết sữa)`,
    });
  });

  // Waiting sow (1 single rate)
  rows.push({
    pigCategory: 'sow_waiting',
    weekNumber: 0,
    feedTypeId: gest.feedTypeId,
    feedName: gest.feedName,
    kgPerHeadPerDay: 2.3,
    notes: 'Định mức cố định cho heo nái chờ phối / hậu bị',
  });

  return rows;
}

export function buildDefaultVaccinationPrograms(): Array<{
  pigCategory: RationPigCategory;
  weekNumber: number;
  vaccineName: string;
  diseaseTarget: string;
  dosage: string;
  notes: string;
}> {
  return [
    {
      pigCategory: 'fattening',
      weekNumber: 2,
      vaccineName: 'Mycoplasma (Mũi 1)',
      diseaseTarget: 'Viêm phổi địa phương (Suyễn heo)',
      dosage: '1 ml/con',
      notes: 'Tiêm lúc 14 ngày tuổi',
    },
    {
      pigCategory: 'fattening',
      weekNumber: 3,
      vaccineName: 'Circovirus (PCV2)',
      diseaseTarget: 'Hội chứng còi cọc sau cai sữa',
      dosage: '1 ml/con',
      notes: 'Tiêm lúc 21 ngày tuổi',
    },
    {
      pigCategory: 'fattening',
      weekNumber: 5,
      vaccineName: 'Mycoplasma (Mũi 2)',
      diseaseTarget: 'Viêm phổi địa phương',
      dosage: '1 ml/con',
      notes: 'Nhắc lại sau cai sữa',
    },
    {
      pigCategory: 'fattening',
      weekNumber: 6,
      vaccineName: 'Dịch tả heo (CSF)',
      diseaseTarget: 'Dịch tả heo cổ điển',
      dosage: '2 ml/con',
      notes: 'Tiêm bắp cổ',
    },
    {
      pigCategory: 'fattening',
      weekNumber: 8,
      vaccineName: 'Lở mồm long móng (FMD)',
      diseaseTarget: 'Bệnh Lở mồm long móng',
      dosage: '2 ml/con',
      notes: 'Tiêm phòng định kỳ cho heo thịt',
    },
    {
      pigCategory: 'fattening',
      weekNumber: 10,
      vaccineName: 'Tụ huyết trùng & Phó thương hàn',
      diseaseTarget: 'Tụ huyết trùng, Phó thương hàn',
      dosage: '2 ml/con',
      notes: 'Phòng bệnh hô hấp & tiêu hóa giai đoạn choai',
    },
    {
      pigCategory: 'sow_gestation',
      weekNumber: 10,
      vaccineName: 'Tai xanh (PRRS)',
      diseaseTarget: 'Rối loạn sinh sản & hô hấp',
      dosage: '2 ml/con',
      notes: 'Tiêm nhắc lại định kỳ tuần 10 thai kỳ',
    },
    {
      pigCategory: 'sow_gestation',
      weekNumber: 12,
      vaccineName: 'Dịch tả heo (CSF)',
      diseaseTarget: 'Dịch tả heo cổ điển',
      dosage: '2 ml/con',
      notes: 'Tiêm bắp cho nái mang thai tuần 12',
    },
    {
      pigCategory: 'sow_gestation',
      weekNumber: 14,
      vaccineName: 'E.coli + Clostridium',
      diseaseTarget: 'Tiêu chảy phân trắng ở heo con sơ sinh',
      dosage: '2 ml/con',
      notes: 'Tiêm trước đẻ 2 tuần để truyền kháng thể qua sữa đầu',
    },
    {
      pigCategory: 'sow_lactation',
      weekNumber: 2,
      vaccineName: 'Lở mồm long móng (FMD)',
      diseaseTarget: 'Lở mồm long móng',
      dosage: '2 ml/con',
      notes: 'Tiêm cho nái đang nuôi con tuần 2',
    },
    {
      pigCategory: 'sow_waiting',
      weekNumber: 0,
      vaccineName: 'Parvovirus + Leptospirosis',
      diseaseTarget: 'Khô thai, sảy thai truyền nhiễm',
      dosage: '2 ml/con',
      notes: 'Tiêm trước khi phối giống 2 tuần',
    },
  ];
}

function normalizeViText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

function matchInventoryItemByName(
  items: InventoryItem[],
  categories: InventoryItem['category'][],
  targetName: string
): InventoryItem | undefined {
  const normTarget = normalizeViText(targetName);
  const candidates = items.filter((i) => categories.includes(i.category));
  if (candidates.length === 0) return undefined;

  // 1. Exact or direct substring match
  const exact = candidates.find((c) => {
    const cn = normalizeViText(c.name);
    return cn === normTarget || cn.includes(normTarget) || normTarget.includes(cn);
  });
  if (exact) return exact;

  // 2. Domain keyword matching for Vietnamese pig farm feeds & vaccines
  const keywordGroups = [
    ['vo beo', 'finisher'],
    ['choai', 'grower'],
    ['cai sua', 'starter'],
    ['tap an', 'prestarter'],
    ['mang thai', 'nuoi con', 'nai'],
    ['dich ta', 'csf'],
    ['tai xanh', 'prrs'],
    ['lo mom', 'fmd'],
    ['circo', 'pcv2'],
    ['mycoplasma', 'suyen'],
    ['e.coli', 'ecoli'],
    ['parvo', 'lepto'],
    ['tu huyet trung', 'pho thuong han'],
  ];

  for (const kwList of keywordGroups) {
    const targetHasKw = kwList.some((kw) => normTarget.includes(kw));
    if (targetHasKw) {
      const matched = candidates.find((c) => {
        const cn = normalizeViText(c.name);
        return kwList.some((kw) => cn.includes(kw));
      });
      if (matched) return matched;
    }
  }

  return undefined;
}

function createFeedRateResolver(
  feedTypes: FeedType[],
  feedRations: FeedRation[],
  farm?: Pick<Farm, 'gestationDays' | 'weaningDays'>,
  inventoryItems: InventoryItem[] = []
) {
  const gestationDays = farm?.gestationDays || 114;
  const weaningDays = farm?.weaningDays || 24;

  const findFallbackStage = (
    stage: FeedType['stage'],
    fallbackName: string,
    fallbackKg: number,
    fallbackPrice: number
  ) => {
    const match = feedTypes.find((f) => f.stage === stage);
    const name = match?.name || fallbackName;
    const invMatch = match ? undefined : matchInventoryItemByName(inventoryItems, ['feed'], name);
    return {
      feedName: name,
      kg: match?.kgPerHeadPerDay ?? fallbackKg,
      unitPrice: match?.unitPrice ?? invMatch?.unitCost ?? fallbackPrice,
    };
  };

  const resolveUnitPrice = (feedName: string, feedTypeId?: string, defaultPrice = 14000) => {
    if (feedTypeId) {
      const byId = feedTypes.find((f) => f.id === feedTypeId);
      if (byId) return byId.unitPrice;
    }
    const norm = feedName.trim().toLowerCase();
    const byName = feedTypes.find((f) => f.name.trim().toLowerCase() === norm);
    if (byName) return byName.unitPrice;
    const byInv = matchInventoryItemByName(inventoryItems, ['feed'], feedName);
    if (byInv && byInv.unitCost > 0) return byInv.unitCost;
    return defaultPrice;
  };

  const resolveRationFromList = (
    category: RationPigCategory,
    weekNumber: number
  ): FeedRation | null => {
    const candidates = feedRations.filter((r) => r.pigCategory === category);
    if (candidates.length === 0) return null;
    if (category === 'sow_waiting') {
      return candidates[0];
    }
    const exact = candidates.find((r) => r.weekNumber === weekNumber);
    if (exact) return exact;
    const sorted = [...candidates].sort((a, b) => a.weekNumber - b.weekNumber);
    let best = sorted[0];
    for (const r of sorted) {
      if (r.weekNumber <= weekNumber) best = r;
    }
    return best;
  };

  const getFatteningRateForWeek = (ageWeek: number) => {
    const fallback =
      ageWeek <= 4
        ? findFallbackStage('prestarter', 'Cám tập ăn heo con (21% đạm)', 0.45, 22000)
        : ageWeek <= 8
        ? findFallbackStage('starter', 'Cám heo cai sữa 10-25kg', 1.15, 16500)
        : ageWeek <= 14
        ? findFallbackStage('grower', 'Cám heo choai 25-60kg', 2.1, 14200)
        : findFallbackStage('finisher', 'Cám vỗ béo 60-105kg', 2.95, 13200);

    const ration = resolveRationFromList('fattening', ageWeek);
    if (ration) {
      return {
        feedName: ration.feedName,
        kg: ration.kgPerHeadPerDay,
        unitPrice: resolveUnitPrice(ration.feedName, ration.feedTypeId, fallback.unitPrice),
      };
    }
    return fallback;
  };

  const getSowRateForDay = (sow: Sow, dateIso: string) => {
    const gestFallback = findFallbackStage('gestation', 'Cám nái mang thai', 2.4, 13500);
    const lactFallback = findFallbackStage('lactation', 'Cám nái nuôi con', 5.2, 14800);

    if (sow.status === 'lactating') {
      if (sow.expectedWeaningDate && dateIso > sow.expectedWeaningDate) {
        const waitRation = resolveRationFromList('sow_waiting', 0);
        return {
          stageGroupLabel: 'Nái chờ phối',
          feedName: waitRation?.feedName || gestFallback.feedName,
          kg: waitRation?.kgPerHeadPerDay ?? gestFallback.kg,
          unitPrice: waitRation
            ? resolveUnitPrice(waitRation.feedName, waitRation.feedTypeId, gestFallback.unitPrice)
            : gestFallback.unitPrice,
        };
      }
      const lactDays = sow.lastFarrowingDate
        ? Math.max(1, diffDays(sow.lastFarrowingDate, dateIso))
        : 7;
      const lactWeek = Math.min(8, Math.max(1, Math.ceil(lactDays / 7)));
      const ration = resolveRationFromList('sow_lactation', lactWeek);
      return {
        stageGroupLabel: `Nái nuôi con (Tuần ${lactWeek})`,
        feedName: ration?.feedName || lactFallback.feedName,
        kg: ration?.kgPerHeadPerDay ?? lactFallback.kg,
        unitPrice: ration
          ? resolveUnitPrice(ration.feedName, ration.feedTypeId, lactFallback.unitPrice)
          : lactFallback.unitPrice,
      };
    }

    if (['bred', 'pregnant', 'farrowing'].includes(sow.status)) {
      if (sow.lastBreedingDate) {
        const gestDays = Math.max(0, diffDays(sow.lastBreedingDate, dateIso));
        if (gestDays > gestationDays && gestDays <= gestationDays + weaningDays) {
          const lactWeek = Math.min(8, Math.max(1, Math.ceil((gestDays - gestationDays) / 7)));
          const ration = resolveRationFromList('sow_lactation', lactWeek);
          return {
            stageGroupLabel: `Nái nuôi con (Tuần ${lactWeek})`,
            feedName: ration?.feedName || lactFallback.feedName,
            kg: ration?.kgPerHeadPerDay ?? lactFallback.kg,
            unitPrice: ration
              ? resolveUnitPrice(ration.feedName, ration.feedTypeId, lactFallback.unitPrice)
              : lactFallback.unitPrice,
          };
        }
        if (gestDays > gestationDays + weaningDays) {
          const waitRation = resolveRationFromList('sow_waiting', 0);
          return {
            stageGroupLabel: 'Nái chờ phối',
            feedName: waitRation?.feedName || gestFallback.feedName,
            kg: waitRation?.kgPerHeadPerDay ?? gestFallback.kg,
            unitPrice: waitRation
              ? resolveUnitPrice(waitRation.feedName, waitRation.feedTypeId, gestFallback.unitPrice)
              : gestFallback.unitPrice,
          };
        }
        const gestWeek = Math.min(17, Math.max(1, Math.floor(gestDays / 7) + 1));
        const ration = resolveRationFromList('sow_gestation', gestWeek);
        return {
          stageGroupLabel: `Nái mang thai (Tuần ${gestWeek})`,
          feedName: ration?.feedName || gestFallback.feedName,
          kg: ration?.kgPerHeadPerDay ?? gestFallback.kg,
          unitPrice: ration
            ? resolveUnitPrice(ration.feedName, ration.feedTypeId, gestFallback.unitPrice)
            : gestFallback.unitPrice,
        };
      }
      const ration = resolveRationFromList('sow_gestation', 1);
      return {
        stageGroupLabel: 'Nái mang thai (Tuần 1)',
        feedName: ration?.feedName || gestFallback.feedName,
        kg: ration?.kgPerHeadPerDay ?? gestFallback.kg,
        unitPrice: ration
          ? resolveUnitPrice(ration.feedName, ration.feedTypeId, gestFallback.unitPrice)
          : gestFallback.unitPrice,
      };
    }

    const waitRation = resolveRationFromList('sow_waiting', 0);
    return {
      stageGroupLabel: 'Nái chờ phối',
      feedName: waitRation?.feedName || gestFallback.feedName,
      kg: waitRation?.kgPerHeadPerDay ?? gestFallback.kg,
      unitPrice: waitRation
        ? resolveUnitPrice(waitRation.feedName, waitRation.feedTypeId, gestFallback.unitPrice)
        : gestFallback.unitPrice,
    };
  };

  return { getFatteningRateForWeek, getSowRateForDay };
}

export interface DailyFeedProjection {
  totalKgPerDay: number;
  totalCostPerDay: number;
  sevenDayTotalKg: number;
  sevenDayTotalCost: number;
  feedTypeNames: string[];
  breakdown: Array<{
    stageLabel: string;
    feedName: string;
    headCount: number;
    kgPerHead: number;
    totalKg: number;
    estimatedCost: number;
  }>;
  sevenDayForecast: Array<{
    dayLabel: string;
    date: string;
    kg: number;
    estimatedCost: number;
    byFeedType: Record<string, number>;
    [feedKey: string]: string | number | Record<string, number>;
  }>;
  feedTypeSummary: Array<{
    feedName: string;
    todayKg: number;
    sevenDayKg: number;
    estimatedSevenDayCost: number;
    dailyKgs: number[];
  }>;
}

export function computeDailyFeedProjection(
  sows: Sow[],
  groups: PigGroup[],
  feedTypes: FeedType[],
  feedRations: FeedRation[] = [],
  farm?: Pick<Farm, 'gestationDays' | 'weaningDays'>,
  refDate = todayIso()
): DailyFeedProjection {
  const { getFatteningRateForWeek, getSowRateForDay } = createFeedRateResolver(
    feedTypes,
    feedRations,
    farm
  );

  const activeSows = sows.filter((s) => s.status !== 'culled' && s.status !== 'sold');
  const activeGroups = groups.filter((g) => g.status === 'active' && g.currentCount > 0);

  // Day 0 breakdown rows (aggregated by stage label + feedName + kgPerHead)
  const breakdownMap = new Map<
    string,
    {
      stageLabel: string;
      feedName: string;
      headCount: number;
      kgPerHead: number;
      totalKg: number;
      estimatedCost: number;
    }
  >();

  for (const s of activeSows) {
    const rate = getSowRateForDay(s, refDate);
    const key = `${rate.stageGroupLabel}__${rate.feedName}__${rate.kg}`;
    const curr = breakdownMap.get(key) || {
      stageLabel: rate.stageGroupLabel,
      feedName: rate.feedName,
      headCount: 0,
      kgPerHead: rate.kg,
      totalKg: 0,
      estimatedCost: 0,
    };
    curr.headCount += 1;
    curr.totalKg += rate.kg;
    curr.estimatedCost += rate.kg * rate.unitPrice;
    breakdownMap.set(key, curr);
  }

  for (const g of activeGroups) {
    const ageDays = Math.max(1, diffDays(g.birthDate || g.entryDate, refDate));
    const ageWeek = Math.ceil(ageDays / 7);
    const rate = getFatteningRateForWeek(ageWeek);
    const label = `${g.name} (Tuần ${ageWeek})`;
    const key = `grp_${g.id}`;
    breakdownMap.set(key, {
      stageLabel: label,
      feedName: rate.feedName,
      headCount: g.currentCount,
      kgPerHead: rate.kg,
      totalKg: g.currentCount * rate.kg,
      estimatedCost: g.currentCount * rate.kg * rate.unitPrice,
    });
  }

  const breakdown = Array.from(breakdownMap.values());
  const totalKgPerDay = breakdown.reduce((acc, r) => acc + r.totalKg, 0);
  const totalCostPerDay = breakdown.reduce((acc, r) => acc + r.estimatedCost, 0);

  // 7-day projection per feedType per day
  const allFeedNamesSet = new Set<string>();
  const feedCostMap = new Map<string, number>();

  const sevenDayForecast = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(refDate, i);
    const byFeedType: Record<string, number> = {};
    let dayKg = 0;
    let dayCost = 0;

    for (const s of activeSows) {
      const rate = getSowRateForDay(s, d);
      allFeedNamesSet.add(rate.feedName);
      byFeedType[rate.feedName] = (byFeedType[rate.feedName] || 0) + rate.kg;
      dayKg += rate.kg;
      dayCost += rate.kg * rate.unitPrice;
      feedCostMap.set(rate.feedName, (feedCostMap.get(rate.feedName) || 0) + rate.kg * rate.unitPrice);
    }

    for (const g of activeGroups) {
      const ageDays = Math.max(1, diffDays(g.birthDate || g.entryDate, d));
      const ageWeek = Math.ceil(ageDays / 7);
      const rate = getFatteningRateForWeek(ageWeek);
      const grpKg = g.currentCount * rate.kg;
      allFeedNamesSet.add(rate.feedName);
      byFeedType[rate.feedName] = (byFeedType[rate.feedName] || 0) + grpKg;
      dayKg += grpKg;
      dayCost += grpKg * rate.unitPrice;
      feedCostMap.set(rate.feedName, (feedCostMap.get(rate.feedName) || 0) + grpKg * rate.unitPrice);
    }

    const roundedByFeed: Record<string, number> = {};
    const flatFields: Record<string, number> = {};
    for (const [fname, val] of Object.entries(byFeedType)) {
      const rounded = Math.round(val * 10) / 10;
      roundedByFeed[fname] = rounded;
      flatFields[fname] = rounded;
    }

    return {
      dayLabel: i === 0 ? 'Hôm nay' : formatDateVi(d).slice(0, 5),
      date: d,
      kg: Math.round(dayKg * 10) / 10,
      estimatedCost: Math.round(dayCost),
      byFeedType: roundedByFeed,
      ...flatFields,
    };
  });

  const feedTypeNames = Array.from(allFeedNamesSet);
  const feedTypeSummary = feedTypeNames
    .map((feedName) => {
      const dailyKgs = sevenDayForecast.map((day) => day.byFeedType[feedName] || 0);
      const sevenDayKg = Math.round(dailyKgs.reduce((a, b) => a + b, 0) * 10) / 10;
      return {
        feedName,
        todayKg: dailyKgs[0] || 0,
        sevenDayKg,
        estimatedSevenDayCost: Math.round(feedCostMap.get(feedName) || 0),
        dailyKgs,
      };
    })
    .sort((a, b) => b.sevenDayKg - a.sevenDayKg);

  const sevenDayTotalKg = Math.round(sevenDayForecast.reduce((a, b) => a + b.kg, 0) * 10) / 10;
  const sevenDayTotalCost = sevenDayForecast.reduce((a, b) => a + b.estimatedCost, 0);

  return {
    totalKgPerDay: Math.round(totalKgPerDay * 10) / 10,
    totalCostPerDay: Math.round(totalCostPerDay),
    sevenDayTotalKg,
    sevenDayTotalCost,
    feedTypeNames,
    breakdown,
    sevenDayForecast,
    feedTypeSummary,
  };
}

export interface FinancialForecast30Day {
  total30DayCost: number;
  totalFeedCost30d: number;
  totalVaccineCost30d: number;
  totalFeedKg30d: number;
  totalVaccineDoses30d: number;
  shortageItemsCount: number;
  weeklyProjection: Array<{
    periodLabel: string;
    dateRange: string;
    feedCost: number;
    vaccineCost: number;
    totalCost: number;
    feedKg: number;
    vaccineDoses: number;
  }>;
  feedItems: Array<{
    feedName: string;
    totalKg30d: number;
    unitPrice: number;
    totalCost30d: number;
    stockKg: number;
    shortageKg: number;
  }>;
  vaccineItems: Array<{
    vaccineName: string;
    targetSummary: string;
    scheduledDates: string[];
    totalDoses: number;
    unitPrice: number;
    totalCost30d: number;
    stockDoses: number;
    shortageDoses: number;
    source: 'program' | 'scheduled' | 'mixed';
  }>;
}

export function compute30DayFinancialForecast(
  sows: Sow[],
  groups: PigGroup[],
  feedTypes: FeedType[],
  feedRations: FeedRation[],
  vaccinationPrograms: VaccinationProgram[],
  healthLogs: HealthLog[],
  inventoryItems: InventoryItem[],
  farm?: Pick<Farm, 'gestationDays' | 'weaningDays'>,
  refDate = todayIso()
): FinancialForecast30Day {
  const { getFatteningRateForWeek, getSowRateForDay } = createFeedRateResolver(
    feedTypes,
    feedRations,
    farm,
    inventoryItems
  );

  const activeSows = sows.filter((s) => s.status !== 'culled' && s.status !== 'sold');
  const activeGroups = groups.filter((g) => g.status === 'active' && g.currentCount > 0);

  const weekBuckets = [
    { periodLabel: 'Tuần 1 (1–7 ngày)', startIdx: 0, endIdx: 6, feedCost: 0, vaccineCost: 0, feedKg: 0, vaccineDoses: 0 },
    { periodLabel: 'Tuần 2 (8–14 ngày)', startIdx: 7, endIdx: 13, feedCost: 0, vaccineCost: 0, feedKg: 0, vaccineDoses: 0 },
    { periodLabel: 'Tuần 3 (15–21 ngày)', startIdx: 14, endIdx: 20, feedCost: 0, vaccineCost: 0, feedKg: 0, vaccineDoses: 0 },
    { periodLabel: 'Tuần 4+ (22–30 ngày)', startIdx: 21, endIdx: 29, feedCost: 0, vaccineCost: 0, feedKg: 0, vaccineDoses: 0 },
  ];

  const feedAggMap = new Map<string, { totalKg: number; totalCost: number; unitPrice: number }>();

  for (let i = 0; i < 30; i++) {
    const d = addDays(refDate, i);
    const bucket = weekBuckets.find((b) => i >= b.startIdx && i <= b.endIdx) || weekBuckets[3];

    for (const s of activeSows) {
      const rate = getSowRateForDay(s, d);
      const cost = rate.kg * rate.unitPrice;
      bucket.feedKg += rate.kg;
      bucket.feedCost += cost;
      const prev = feedAggMap.get(rate.feedName) || { totalKg: 0, totalCost: 0, unitPrice: rate.unitPrice };
      prev.totalKg += rate.kg;
      prev.totalCost += cost;
      prev.unitPrice = rate.unitPrice;
      feedAggMap.set(rate.feedName, prev);
    }

    for (const g of activeGroups) {
      const ageDays = Math.max(1, diffDays(g.birthDate || g.entryDate, d));
      const ageWeek = Math.ceil(ageDays / 7);
      const rate = getFatteningRateForWeek(ageWeek);
      const grpKg = g.currentCount * rate.kg;
      const grpCost = grpKg * rate.unitPrice;
      bucket.feedKg += grpKg;
      bucket.feedCost += grpCost;
      const prev = feedAggMap.get(rate.feedName) || { totalKg: 0, totalCost: 0, unitPrice: rate.unitPrice };
      prev.totalKg += grpKg;
      prev.totalCost += grpCost;
      prev.unitPrice = rate.unitPrice;
      feedAggMap.set(rate.feedName, prev);
    }
  }

  // Gather vaccination events in the next 30 days (both already-scheduled HealthLogs & upcoming VaccinationPrograms)
  const DEFAULT_VACCINE_UNIT_COST = 15000;
  const vacAggMap = new Map<
    string,
    {
      vaccineName: string;
      targets: Set<string>;
      dates: Set<string>;
      totalDoses: number;
      totalCost: number;
      fromProgram: boolean;
      fromScheduled: boolean;
    }
  >();

  const pushVaccineForecast = (
    vaccineName: string,
    targetLabel: string,
    dateIso: string,
    deltaDays: number,
    doses: number,
    explicitTotalCost: number | undefined,
    source: 'program' | 'scheduled'
  ) => {
    const invItem = matchInventoryItemByName(inventoryItems, ['vaccine', 'medicine'], vaccineName);
    const estUnitPrice = invItem && invItem.unitCost > 0 ? invItem.unitCost : DEFAULT_VACCINE_UNIT_COST;
    const totalCost =
      explicitTotalCost && explicitTotalCost > 0 ? explicitTotalCost : doses * estUnitPrice;

    const bucketIdx = Math.min(3, Math.floor(Math.max(0, deltaDays) / 7));
    weekBuckets[bucketIdx].vaccineCost += totalCost;
    weekBuckets[bucketIdx].vaccineDoses += doses;

    const normKey = normalizeViText(vaccineName);
    const curr = vacAggMap.get(normKey) || {
      vaccineName,
      targets: new Set<string>(),
      dates: new Set<string>(),
      totalDoses: 0,
      totalCost: 0,
      fromProgram: false,
      fromScheduled: false,
    };
    curr.targets.add(`${targetLabel} (${doses} liều)`);
    curr.dates.add(dateIso);
    curr.totalDoses += doses;
    curr.totalCost += totalCost;
    if (source === 'program') curr.fromProgram = true;
    else curr.fromScheduled = true;
    vacAggMap.set(normKey, curr);
  };

  // 1. Scheduled pending HealthLogs within 0..29 days
  for (const hl of healthLogs) {
    if (hl.logType !== 'vaccination' || hl.status !== 'scheduled' || !hl.date) continue;
    const delta = diffDays(refDate, hl.date);
    if (delta < 0 || delta > 29) continue;
    const doses =
      hl.targetType === 'group'
        ? Math.max(1, groups.find((g) => g.id === hl.targetId)?.currentCount || 1)
        : 1;
    const vacName = hl.vaccineName || hl.title;
    pushVaccineForecast(vacName, hl.targetLabel, hl.date, delta, doses, hl.cost, 'scheduled');
  }

  // 2. Program recommendations not yet converted into scheduled logs within 0..29 days
  const recs = buildVaccinationRecommendations(
    sows,
    groups,
    vaccinationPrograms,
    healthLogs,
    refDate
  );
  for (const rec of recs) {
    if (rec.deltaDays < 0 || rec.deltaDays > 29) continue;
    const doses =
      rec.targetType === 'group'
        ? Math.max(1, groups.find((g) => g.id === rec.targetId)?.currentCount || 1)
        : 1;
    pushVaccineForecast(
      rec.vaccineName,
      rec.targetLabel,
      rec.scheduledDate,
      rec.deltaDays,
      doses,
      undefined,
      'program'
    );
  }

  const feedItems = Array.from(feedAggMap.entries())
    .map(([feedName, stats]) => {
      const invItem = matchInventoryItemByName(inventoryItems, ['feed'], feedName);
      const stockKg = invItem ? invItem.quantity : 0;
      const totalKgRounded = Math.round(stats.totalKg * 10) / 10;
      const shortageKg = Math.max(0, Math.round((totalKgRounded - stockKg) * 10) / 10);
      return {
        feedName,
        totalKg30d: totalKgRounded,
        unitPrice: Math.round(stats.unitPrice),
        totalCost30d: Math.round(stats.totalCost),
        stockKg: Math.round(stockKg * 10) / 10,
        shortageKg,
      };
    })
    .sort((a, b) => b.totalCost30d - a.totalCost30d);

  const vaccineItems = Array.from(vacAggMap.values())
    .map((v) => {
      const invItem = matchInventoryItemByName(inventoryItems, ['vaccine', 'medicine'], v.vaccineName);
      const stockDoses = invItem ? invItem.quantity : 0;
      const shortageDoses = Math.max(0, v.totalDoses - stockDoses);
      const unitPrice = v.totalDoses > 0 ? Math.round(v.totalCost / v.totalDoses) : DEFAULT_VACCINE_UNIT_COST;
      return {
        vaccineName: v.vaccineName,
        targetSummary: Array.from(v.targets).join(', '),
        scheduledDates: Array.from(v.dates).sort(),
        totalDoses: v.totalDoses,
        unitPrice,
        totalCost30d: Math.round(v.totalCost),
        stockDoses,
        shortageDoses,
        source: (v.fromProgram && v.fromScheduled
          ? 'mixed'
          : v.fromProgram
          ? 'program'
          : 'scheduled') as 'program' | 'scheduled' | 'mixed',
      };
    })
    .sort((a, b) => b.totalCost30d - a.totalCost30d);

  const weeklyProjection = weekBuckets.map((b) => ({
    periodLabel: b.periodLabel,
    dateRange: `${formatDateVi(addDays(refDate, b.startIdx)).slice(0, 5)} – ${formatDateVi(
      addDays(refDate, b.endIdx)
    ).slice(0, 5)}`,
    feedCost: Math.round(b.feedCost),
    vaccineCost: Math.round(b.vaccineCost),
    totalCost: Math.round(b.feedCost + b.vaccineCost),
    feedKg: Math.round(b.feedKg * 10) / 10,
    vaccineDoses: b.vaccineDoses,
  }));

  const totalFeedCost30d = feedItems.reduce((sum, i) => sum + i.totalCost30d, 0);
  const totalVaccineCost30d = vaccineItems.reduce((sum, i) => sum + i.totalCost30d, 0);
  const totalFeedKg30d = Math.round(feedItems.reduce((sum, i) => sum + i.totalKg30d, 0) * 10) / 10;
  const totalVaccineDoses30d = vaccineItems.reduce((sum, i) => sum + i.totalDoses, 0);
  const shortageItemsCount =
    feedItems.filter((f) => f.shortageKg > 0).length +
    vaccineItems.filter((v) => v.shortageDoses > 0).length;

  return {
    total30DayCost: totalFeedCost30d + totalVaccineCost30d,
    totalFeedCost30d,
    totalVaccineCost30d,
    totalFeedKg30d,
    totalVaccineDoses30d,
    shortageItemsCount,
    weeklyProjection,
    feedItems,
    vaccineItems,
  };
}

export interface VaccinationRecommendation {
  key: string;
  programId: string;
  targetType: 'sow' | 'group';
  targetId: string;
  targetLabel: string;
  pigCategory: RationPigCategory;
  weekNumber: number;
  vaccineName: string;
  diseaseTarget?: string;
  dosage?: string;
  scheduledDate: string;
  deltaDays: number;
  notes?: string;
}

export function buildVaccinationRecommendations(
  sows: Sow[],
  groups: PigGroup[],
  programs: VaccinationProgram[],
  healthLogs: HealthLog[],
  refDate = todayIso()
): VaccinationRecommendation[] {
  if (programs.length === 0) return [];
  const recs: VaccinationRecommendation[] = [];

  const hasExistingSchedule = (
    targetId: string,
    vaccineName: string,
    scheduledDate: string
  ) => {
    const normVac = vaccineName.trim().toLowerCase();
    return healthLogs.some((hl) => {
      if (hl.logType !== 'vaccination' || hl.targetId !== targetId) return false;
      const loggedVac = (hl.vaccineName || hl.title || '').trim().toLowerCase();
      if (!loggedVac.includes(normVac) && !normVac.includes(loggedVac)) return false;
      return Math.abs(diffDays(hl.date, scheduledDate)) <= 21;
    });
  };

  // Fattening pig groups
  const fatteningProgs = programs.filter((p) => p.pigCategory === 'fattening');
  for (const g of groups) {
    if (g.status !== 'active' || g.currentCount <= 0) continue;
    const baseDate = g.birthDate || g.entryDate;
    for (const prog of fatteningProgs) {
      const scheduledDate = addDays(baseDate, prog.weekNumber * 7);
      const deltaDays = diffDays(refDate, scheduledDate);
      if (deltaDays < -14 || deltaDays > 45) continue;
      if (hasExistingSchedule(g.id, prog.vaccineName, scheduledDate)) continue;
      recs.push({
        key: `${g.id}_${prog.id}`,
        programId: prog.id,
        targetType: 'group',
        targetId: g.id,
        targetLabel: g.name,
        pigCategory: prog.pigCategory,
        weekNumber: prog.weekNumber,
        vaccineName: prog.vaccineName,
        diseaseTarget: prog.diseaseTarget,
        dosage: prog.dosage,
        scheduledDate,
        deltaDays,
        notes: prog.notes,
      });
    }
  }

  // Sows
  for (const s of sows) {
    if (s.status === 'culled' || s.status === 'sold') continue;
    for (const prog of programs) {
      let baseDate: string | undefined;
      if (
        prog.pigCategory === 'sow_gestation' &&
        ['bred', 'pregnant', 'farrowing'].includes(s.status) &&
        s.lastBreedingDate
      ) {
        baseDate = s.lastBreedingDate;
      } else if (
        prog.pigCategory === 'sow_lactation' &&
        s.status === 'lactating' &&
        (s.lastFarrowingDate || s.expectedFarrowingDate)
      ) {
        baseDate = s.lastFarrowingDate || s.expectedFarrowingDate;
      } else if (prog.pigCategory === 'sow_waiting' && s.status === 'empty') {
        baseDate = s.expectedNextBreedingDate || refDate;
      }

      if (!baseDate) continue;
      const scheduledDate = addDays(baseDate, prog.weekNumber * 7);
      const deltaDays = diffDays(refDate, scheduledDate);
      if (deltaDays < -14 || deltaDays > 45) continue;
      if (hasExistingSchedule(s.id, prog.vaccineName, scheduledDate)) continue;

      recs.push({
        key: `${s.id}_${prog.id}`,
        programId: prog.id,
        targetType: 'sow',
        targetId: s.id,
        targetLabel: `Nái ${s.earTag}`,
        pigCategory: prog.pigCategory,
        weekNumber: prog.weekNumber,
        vaccineName: prog.vaccineName,
        diseaseTarget: prog.diseaseTarget,
        dosage: prog.dosage,
        scheduledDate,
        deltaDays,
        notes: prog.notes,
      });
    }
  }

  return recs.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
}

export function buildCareReminders(
  sowEvents: SowEvent[],
  healthLogs: HealthLog[],
  inventory: InventoryItem[],
  refDate = todayIso()
): CareReminder[] {
  const reminders: CareReminder[] = [];

  for (const ev of sowEvents) {
    if (ev.status !== 'pending') continue;
    const delta = diffDays(refDate, ev.scheduledDate);
    if (delta <= 5) {
      reminders.push({
        id: `ev_${ev.id}`,
        category: 'sow_event',
        urgency: delta < 0 ? 'overdue' : delta === 0 ? 'today' : 'upcoming',
        title: `Nái ${ev.sowEarTag}: ${SOW_EVENT_LABELS[ev.eventType]}`,
        subtitle:
          delta < 0
            ? `Quá hạn ${Math.abs(delta)} ngày (${formatDateVi(ev.scheduledDate)})`
            : delta === 0
            ? 'Đến hạn thực hiện hôm nay'
            : `Còn ${delta} ngày (${formatDateVi(ev.scheduledDate)})`,
        dueDate: ev.scheduledDate,
        targetTab: 'herd',
      });
    }
  }

  for (const log of healthLogs) {
    if (log.status === 'scheduled' && log.date) {
      const delta = diffDays(refDate, log.date);
      if (delta <= 5) {
        reminders.push({
          id: `hl_${log.id}`,
          category: 'health',
          urgency: delta < 0 ? 'overdue' : delta === 0 ? 'today' : 'upcoming',
          title: `${log.title} — ${log.targetLabel}`,
          subtitle:
            delta < 0
              ? `Lịch tiêm/khám quá hạn ${Math.abs(delta)} ngày`
              : delta === 0
              ? 'Lịch tiêm/chăm sóc hôm nay'
              : `Sắp đến lịch (${formatDateVi(log.date)})`,
          dueDate: log.date,
          targetTab: 'health',
        });
      }
    } else if (log.status === 'monitoring' && log.severity !== 'normal') {
      reminders.push({
        id: `sym_${log.id}`,
        category: 'health',
        urgency: log.severity === 'critical' ? 'overdue' : 'warning',
        title: `Cảnh báo bệnh lý: ${log.targetLabel}`,
        subtitle: log.symptoms || log.title,
        dueDate: log.date,
        targetTab: 'health',
      });
    }
  }

  for (const item of inventory) {
    if (item.quantity <= item.minThreshold) {
      reminders.push({
        id: `inv_${item.id}`,
        category: 'inventory',
        urgency: item.quantity === 0 ? 'overdue' : 'warning',
        title: `Kho sắp hết: ${item.name}`,
        subtitle: `Tồn ${formatNumber(item.quantity, 1)} ${item.unit} (mức tối thiểu ${formatNumber(
          item.minThreshold,
          1
        )} ${item.unit})`,
        targetTab: 'inventory',
      });
    }
  }

  const order = { overdue: 0, today: 1, warning: 2, upcoming: 3 };
  return reminders.sort((a, b) => order[a.urgency] - order[b.urgency]);
}

export interface PeriodAggregate {
  periodKey: string;
  label: string;
  income: number;
  expense: number;
  profit: number;
}

export function aggregateFinancialsByPeriod(
  txs: FinancialTx[],
  mode: 'day' | 'week' | 'month'
): PeriodAggregate[] {
  const map = new Map<string, PeriodAggregate>();

  const getWeekKey = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  for (const tx of txs) {
    if (!tx.date) continue;
    let key = tx.date;
    let label = formatDateVi(tx.date).slice(0, 5);
    if (mode === 'week') {
      key = getWeekKey(tx.date);
      label = `Tuần ${formatDateVi(key).slice(0, 5)}`;
    } else if (mode === 'month') {
      key = tx.date.slice(0, 7);
      const [y, m] = key.split('-');
      label = `T${m}/${y}`;
    }

    const curr = map.get(key) || { periodKey: key, label, income: 0, expense: 0, profit: 0 };
    if (tx.direction === 'income') curr.income += tx.amount || 0;
    else curr.expense += tx.amount || 0;
    curr.profit = curr.income - curr.expense;
    map.set(key, curr);
  }

  return Array.from(map.values()).sort((a, b) => a.periodKey.localeCompare(b.periodKey));
}
