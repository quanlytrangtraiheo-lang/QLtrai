import { serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  addDays,
  buildAutoEventsFromBreeding,
  buildDefaultFeedRations,
  buildDefaultVaccinationPrograms,
  makeId,
  todayIso,
} from './farmCalculations';
import type { Farm, FeedType, Sow } from '../types';

export async function seedSampleFarmData(
  farm: Farm,
  userId: string
): Promise<void> {
  const batch = writeBatch(db);
  const today = todayIso();
  const base = {
    farmId: farm.id,
    farmOwnerId: farm.ownerId,
    memberUids: farm.memberUids,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Barns
  const barns = [
    { id: makeId('barn'), code: 'C-DE01', name: 'Chuồng đẻ số 1', barnType: 'farrowing', capacity: 24, notes: 'Sàn nhựa có đèn úm' },
    { id: makeId('barn'), code: 'C-MT01', name: 'Chuồng nái mang thai A', barnType: 'gestation', capacity: 40, notes: 'Chuồng lồng cá thể' },
    { id: makeId('barn'), code: 'C-TH01', name: 'Chuồng thịt khu B1', barnType: 'fattening', capacity: 180, notes: 'Chuồng lạnh tự động' },
    { id: makeId('barn'), code: 'C-CL01', name: 'Khu cách ly thú y', barnType: 'quarantine', capacity: 20, notes: 'Theo dõi heo mới nhập & bệnh lý' },
  ];
  for (const b of barns) {
    batch.set(doc(db, 'farms', farm.id, 'barns', b.id), { ...base, ...b });
  }

  // Breeds
  const breeds = [
    { id: makeId('brd'), name: 'Yorkshire × Landrace (F1)', origin: 'Đan Mạch', avgLitterSize: 13.5, dailyGainGrams: 780, notes: 'Nái sinh sản sai con, nuôi con khéo' },
    { id: makeId('brd'), name: 'Duroc × (Yorkshire × Landrace)', origin: 'Mỹ / Đan Mạch', avgLitterSize: 11.2, dailyGainGrams: 890, notes: 'Heo thịt 3 máu tăng trọng nhanh, FCR tốt' },
    { id: makeId('brd'), name: 'Pietrain', origin: 'Bỉ', avgLitterSize: 10.0, dailyGainGrams: 840, notes: 'Tỷ lệ nạc cao' },
  ];
  for (const br of breeds) {
    batch.set(doc(db, 'farms', farm.id, 'breeds', br.id), { ...base, ...br });
  }

  // Vaccines
  const vaccines = [
    { id: makeId('vac'), name: 'Dịch tả heo (CSF)', targetGroup: 'all', recommendedWeek: 6, dosage: '2 ml/con', notes: 'Nhắc lại định kỳ 6 tháng cho nái' },
    { id: makeId('vac'), name: 'Tai xanh (PRRS)', targetGroup: 'sow', recommendedWeek: 12, dosage: '2 ml/con', notes: 'Tiêm trước phối hoặc định kỳ toàn đàn nái' },
    { id: makeId('vac'), name: 'Lở mồm long móng (FMD)', targetGroup: 'all', recommendedWeek: 8, dosage: '2 ml/con', notes: 'Tiêm bắp cổ' },
    { id: makeId('vac'), name: 'Circovirus (PCV2) + Mycoplasma', targetGroup: 'piglet', recommendedWeek: 3, dosage: '1 ml/con', notes: 'Tiêm lúc 21 ngày tuổi' },
  ];
  for (const v of vaccines) {
    batch.set(doc(db, 'farms', farm.id, 'vaccines', v.id), { ...base, ...v });
  }

  // Feed types
  const feeds = [
    { id: makeId('fd'), name: 'Cám tập ăn heo con (21% đạm)', stage: 'prestarter', proteinPct: 21, kgPerHeadPerDay: 0.45, unitPrice: 22500, notes: 'Dùng cho heo 7-28 ngày tuổi' },
    { id: makeId('fd'), name: 'Cám heo cai sữa 10-25kg', stage: 'starter', proteinPct: 19, kgPerHeadPerDay: 1.2, unitPrice: 16800, notes: 'Giai đoạn 5-8 tuần tuổi' },
    { id: makeId('fd'), name: 'Cám heo choai 25-60kg', stage: 'grower', proteinPct: 17, kgPerHeadPerDay: 2.15, unitPrice: 14200, notes: 'Giai đoạn 9-14 tuần tuổi' },
    { id: makeId('fd'), name: 'Cám vỗ béo 60-105kg', stage: 'finisher', proteinPct: 15.5, kgPerHeadPerDay: 2.95, unitPrice: 13200, notes: 'Giai đoạn xuất chuồng' },
    { id: makeId('fd'), name: 'Cám nái mang thai', stage: 'gestation', proteinPct: 14, kgPerHeadPerDay: 2.4, unitPrice: 13500, notes: 'Kiểm soát thể trạng nái chửa' },
    { id: makeId('fd'), name: 'Cám nái nuôi con', stage: 'lactation', proteinPct: 17.5, kgPerHeadPerDay: 5.4, unitPrice: 14900, notes: 'Tăng tiết sữa' },
  ];
  for (const f of feeds) {
    batch.set(doc(db, 'farms', farm.id, 'feedTypes', f.id), { ...base, ...f });
  }

  // Weekly Feed Rations linked to seeded feedTypes
  const defaultRations = buildDefaultFeedRations(feeds as unknown as FeedType[]);
  for (const r of defaultRations) {
    const rid = makeId('rat');
    batch.set(doc(db, 'farms', farm.id, 'feedRations', rid), { ...base, id: rid, ...r });
  }

  // Standard Vaccination Programs
  const defaultVacPrograms = buildDefaultVaccinationPrograms();
  for (const vp of defaultVacPrograms) {
    const vpid = makeId('vpg');
    batch.set(doc(db, 'farms', farm.id, 'vaccinationPrograms', vpid), {
      ...base,
      id: vpid,
      ...vp,
    });
  }

  // Sows + auto events
  const sowInputs: Array<{
    earTag: string;
    name: string;
    parity: number;
    status: Sow['status'];
    healthStatus: Sow['healthStatus'];
    breedDaysAgo?: number;
    barnName: string;
  }> = [
    { earTag: 'NAI-001', name: 'Nái Đan Mạch 01', parity: 3, status: 'pregnant', healthStatus: 'healthy', breedDaysAgo: 102, barnName: 'Chuồng nái mang thai A' },
    { earTag: 'NAI-002', name: 'Nái Đan Mạch 02', parity: 2, status: 'pregnant', healthStatus: 'healthy', breedDaysAgo: 58, barnName: 'Chuồng nái mang thai A' },
    { earTag: 'NAI-003', name: 'Nái F1 03', parity: 4, status: 'lactating', healthStatus: 'monitoring', breedDaysAgo: 126, barnName: 'Chuồng đẻ số 1' },
    { earTag: 'NAI-004', name: 'Nái F1 04', parity: 1, status: 'bred', healthStatus: 'healthy', breedDaysAgo: 16, barnName: 'Chuồng nái mang thai A' },
    { earTag: 'NAI-005', name: 'Nái Hậu Bị 05', parity: 0, status: 'empty', healthStatus: 'healthy', barnName: 'Chuồng nái mang thai A' },
    { earTag: 'NAI-006', name: 'Nái F1 06', parity: 2, status: 'lactating', healthStatus: 'healthy', breedDaysAgo: 133, barnName: 'Chuồng đẻ số 1' },
  ];

  const createdSows: Sow[] = [];
  for (const s of sowInputs) {
    const sowId = makeId('sow');
    const lastBreedingDate = s.breedDaysAgo !== undefined ? addDays(today, -s.breedDaysAgo) : undefined;
    const expectedFarrowingDate = lastBreedingDate ? addDays(lastBreedingDate, farm.gestationDays) : undefined;
    const lastFarrowingDate = s.status === 'lactating' ? expectedFarrowingDate : undefined;
    const expectedWeaningDate = expectedFarrowingDate ? addDays(expectedFarrowingDate, farm.weaningDays) : undefined;
    const expectedNextBreedingDate = expectedWeaningDate ? addDays(expectedWeaningDate, farm.postWeaningEstrusDays) : undefined;

    const sowObj: Sow = {
      ...base,
      id: sowId,
      earTag: s.earTag,
      name: s.name,
      breedName: 'Yorkshire × Landrace (F1)',
      barnName: s.barnName,
      entryDate: addDays(today, -360),
      parity: s.parity,
      status: s.status,
      healthStatus: s.healthStatus,
      purchaseCost: 9500000,
      ...(lastBreedingDate ? { lastBreedingDate } : {}),
      ...(expectedFarrowingDate ? { expectedFarrowingDate } : {}),
      ...(lastFarrowingDate ? { lastFarrowingDate } : {}),
      ...(expectedWeaningDate ? { expectedWeaningDate } : {}),
      ...(expectedNextBreedingDate ? { expectedNextBreedingDate } : {}),
      notes: s.healthStatus === 'monitoring' ? 'Theo dõi ăn uống sau đẻ' : 'Thể trạng ổn định',
    };
    createdSows.push(sowObj);
    batch.set(doc(db, 'farms', farm.id, 'sows', sowId), sowObj);

    if (lastBreedingDate) {
      const autoEvs = buildAutoEventsFromBreeding(sowObj, lastBreedingDate, farm, 'DUC-88');
      for (const ev of autoEvs) {
        const evId = makeId('ev');
        const isPastFarrow = ev.eventType === 'farrowing' && s.status === 'lactating';
        const isPastCheck = ev.eventType === 'pregnancy_check' && (s.breedDaysAgo || 0) > 25;
        batch.set(doc(db, 'farms', farm.id, 'sowEvents', evId), {
          ...base,
          id: evId,
          sowId,
          sowEarTag: s.earTag,
          eventType: ev.eventType,
          scheduledDate: ev.scheduledDate,
          ...(ev.actualDate || isPastFarrow || isPastCheck
            ? { actualDate: ev.actualDate || ev.scheduledDate }
            : {}),
          status: ev.status === 'completed' || isPastFarrow || isPastCheck ? 'completed' : 'pending',
          autoGenerated: ev.eventType !== 'breeding',
          ...(ev.boarTag ? { boarTag: ev.boarTag } : {}),
          ...(isPastFarrow ? { liveBorn: s.earTag === 'NAI-003' ? 13 : 12, stillborn: 1 } : {}),
          notes: ev.notes,
        });
      }
    }
  }

  // Suckling piglet litters linked to lactating sows
  const lactatingSow3 = createdSows[2];
  const lactatingSow6 = createdSows[5];
  const sampleLitters = [
    {
      id: makeId('lit'),
      sowId: lactatingSow3.id,
      sowEarTag: lactatingSow3.earTag,
      litterCode: 'OC-NAI003-L4',
      parity: lactatingSow3.parity,
      barnName: lactatingSow3.barnName || 'Chuồng đẻ số 1',
      farrowingDate: lactatingSow3.lastFarrowingDate || addDays(today, -12),
      expectedWeaningDate: lactatingSow3.expectedWeaningDate || addDays(today, 12),
      liveBorn: 13,
      currentCount: 12,
      mortalityCount: 1,
      avgWeightKg: 3.8,
      healthStatus: 'healthy',
      status: 'suckling',
      notes: 'Đã tiêm sắt mũi 2, tập ăn cám Prestarter tốt',
    },
    {
      id: makeId('lit'),
      sowId: lactatingSow6.id,
      sowEarTag: lactatingSow6.earTag,
      litterCode: 'OC-NAI006-L2',
      parity: lactatingSow6.parity,
      barnName: lactatingSow6.barnName || 'Chuồng đẻ số 1',
      farrowingDate: lactatingSow6.lastFarrowingDate || addDays(today, -19),
      expectedWeaningDate: lactatingSow6.expectedWeaningDate || addDays(today, 5),
      liveBorn: 12,
      currentCount: 11,
      mortalityCount: 1,
      avgWeightKg: 5.9,
      healthStatus: 'healthy',
      status: 'suckling',
      notes: 'Chuẩn bị cai sữa trong tuần này',
    },
  ];
  for (const lit of sampleLitters) {
    batch.set(doc(db, 'farms', farm.id, 'pigLitters', lit.id), { ...base, ...lit });
  }

  // Pig groups (fattening)
  const groups = [
    {
      id: makeId('grp'),
      batchCode: 'LO-2026-01',
      name: 'Lô thịt B1 (Xuất chuồng)',
      breedName: 'Duroc × (Yorkshire × Landrace)',
      barnName: 'Chuồng thịt khu B1',
      entryDate: addDays(today, -125),
      birthDate: addDays(today, -150),
      initialCount: 60,
      currentCount: 58,
      mortalityCount: 2,
      soldCount: 0,
      avgEntryWeightKg: 8.5,
      currentAvgWeightKg: 98.5,
      entryCostTotal: 78000000,
      feedCostTotal: 152000000,
      medCostTotal: 8400000,
      otherCostTotal: 6200000,
      revenueTotal: 0,
      status: 'active',
      healthStatus: 'healthy',
      notes: 'Dự kiến xuất bán toàn lô tuần tới',
    },
    {
      id: makeId('grp'),
      batchCode: 'LO-2026-02',
      name: 'Lô choai B2',
      breedName: 'Duroc × (Yorkshire × Landrace)',
      barnName: 'Chuồng thịt khu B1',
      entryDate: addDays(today, -58),
      birthDate: addDays(today, -82),
      initialCount: 75,
      currentCount: 74,
      mortalityCount: 1,
      soldCount: 0,
      avgEntryWeightKg: 7.8,
      currentAvgWeightKg: 46.2,
      entryCostTotal: 96000000,
      feedCostTotal: 74500000,
      medCostTotal: 5200000,
      otherCostTotal: 4000000,
      revenueTotal: 0,
      status: 'active',
      healthStatus: 'monitoring',
      notes: 'Có 3 con ho nhẹ đã tách điều trị',
    },
    {
      id: makeId('grp'),
      batchCode: 'LO-2026-03',
      name: 'Lô cai sữa C1',
      breedName: 'Pietrain',
      barnName: 'Chuồng thịt khu B1',
      entryDate: addDays(today, -18),
      birthDate: addDays(today, -44),
      initialCount: 48,
      currentCount: 48,
      mortalityCount: 0,
      soldCount: 0,
      avgEntryWeightKg: 6.9,
      currentAvgWeightKg: 14.5,
      entryCostTotal: 58000000,
      feedCostTotal: 19400000,
      medCostTotal: 2800000,
      otherCostTotal: 1800000,
      revenueTotal: 0,
      status: 'active',
      healthStatus: 'healthy',
      notes: 'Phát triển đồng đều',
    },
    {
      id: makeId('grp'),
      batchCode: 'LO-2026-00',
      name: 'Lô thịt A0 (Đã xuất bán)',
      breedName: 'Duroc × (Yorkshire × Landrace)',
      barnName: 'Chuồng thịt khu B1',
      entryDate: addDays(today, -180),
      birthDate: addDays(today, -205),
      initialCount: 50,
      currentCount: 0,
      mortalityCount: 1,
      soldCount: 49,
      avgEntryWeightKg: 8.2,
      currentAvgWeightKg: 103.0,
      entryCostTotal: 64000000,
      feedCostTotal: 126000000,
      medCostTotal: 6500000,
      otherCostTotal: 5000000,
      revenueTotal: 328000000,
      status: 'sold_out',
      healthStatus: 'healthy',
      notes: 'Đã tất toán toàn bộ lô',
    },
  ];
  for (const g of groups) {
    batch.set(doc(db, 'farms', farm.id, 'pigGroups', g.id), { ...base, ...g });
  }

  // Health Logs
  const healthLogs = [
    {
      id: makeId('hl'),
      targetType: 'sow',
      targetId: createdSows[0].id,
      targetLabel: 'Nái NAI-001',
      logType: 'vaccination',
      title: 'Tiêm phòng E.coli trước đẻ 2 tuần',
      vaccineName: 'Vắc xin E.coli + Clostridium',
      severity: 'normal',
      dosage: '2 ml/con',
      cost: 85000,
      date: today,
      nextDueDate: addDays(today, 180),
      status: 'scheduled',
      notes: 'Nhắc tiêm sáng nay để truyền miễn dịch qua sữa đầu',
    },
    {
      id: makeId('hl'),
      targetType: 'group',
      targetId: groups[1].id,
      targetLabel: 'Lô choai B2',
      logType: 'symptom',
      title: 'Dấu hiệu ho khan rải rác lúc sáng sớm',
      symptoms: '3 cá thể thở bụng nhẹ, ăn giảm 15%, thân nhiệt 39.8°C',
      severity: 'warning',
      medicineUsed: 'Tylosin 20% + Bromhexine',
      dosage: '1 ml / 15 kg thể trọng (3 ngày)',
      cost: 650000,
      date: addDays(today, -1),
      nextDueDate: addDays(today, 2),
      status: 'monitoring',
      notes: 'Đã cách ly sang ô góc cuối chuồng B2',
    },
    {
      id: makeId('hl'),
      targetType: 'group',
      targetId: groups[2].id,
      targetLabel: 'Lô cai sữa C1',
      logType: 'vaccination',
      title: 'Tiêm Dịch tả heo mũi 1',
      vaccineName: 'Dịch tả heo (CSF)',
      severity: 'normal',
      dosage: '2 ml/con',
      cost: 720000,
      date: addDays(today, 2),
      status: 'scheduled',
      notes: 'Chuẩn bị đủ 48 liều trong kho lạnh',
    },
  ];
  for (const hl of healthLogs) {
    batch.set(doc(db, 'farms', farm.id, 'healthLogs', hl.id), { ...base, ...hl });
  }

  // Inventory Items
  const invItems = [
    { id: makeId('inv'), sku: 'CAM-FIN-01', name: 'Cám vỗ béo bao 25kg', category: 'feed', unit: 'kg', quantity: 1850, minThreshold: 600, unitCost: 13200, supplier: 'CP Việt Nam', notes: 'Kho thức ăn số 1' },
    { id: makeId('inv'), sku: 'CAM-GRO-02', name: 'Cám heo choai bao 25kg', category: 'feed', unit: 'kg', quantity: 420, minThreshold: 500, unitCost: 14200, supplier: 'Cargill', notes: 'Sắp hết hàng - cần nhập thêm' },
    { id: makeId('inv'), sku: 'CAM-NAI-03', name: 'Cám nái mang thai & nuôi con', category: 'feed', unit: 'kg', quantity: 950, minThreshold: 400, unitCost: 14000, supplier: 'De Heus', notes: 'Bảo quản nơi khô ráo' },
    { id: makeId('inv'), sku: 'VAC-CSF-01', name: 'Vắc xin Dịch tả heo (10 liều/lọ)', category: 'vaccine', unit: 'liều', quantity: 45, minThreshold: 60, unitCost: 15000, supplier: 'Navetco', expiryDate: addDays(today, 140), notes: 'Bảo quản tủ mát 2-8°C' },
    { id: makeId('inv'), sku: 'THU-AMO-01', name: 'Amoxicillin 15% LA (Chai 100ml)', category: 'medicine', unit: 'chai', quantity: 14, minThreshold: 5, unitCost: 145000, supplier: 'Vemedim', expiryDate: addDays(today, 240), notes: 'Kháng sinh phổ rộng' },
    { id: makeId('inv'), sku: 'VAT-SAT-01', name: 'Thuốc sát trùng chuồng trại Glutaraldehyde', category: 'supply', unit: 'lít', quantity: 8, minThreshold: 10, unitCost: 185000, supplier: 'Bio-Pharmachemie', notes: 'Phun khử trùng 2 lần/tuần' },
  ];
  for (const item of invItems) {
    batch.set(doc(db, 'farms', farm.id, 'inventoryItems', item.id), { ...base, ...item });
  }

  // Financial Transactions (spanning day, week, month)
  const finTxs = [
    { id: makeId('tx'), txType: 'sale_fattening', direction: 'income', date: addDays(today, -35), groupId: groups[3].id, groupLabel: 'Lô thịt A0', headCount: 49, totalWeightKg: 5047, unitPrice: 65000, amount: 328055000, partnerName: 'Thương lái Minh Tuấn', notes: 'Xuất bán lô A0 đạt 103kg/con' },
    { id: makeId('tx'), txType: 'feed_expense', direction: 'expense', date: addDays(today, -28), groupId: groups[0].id, groupLabel: 'Lô thịt B1', amount: 46200000, partnerName: 'Đại lý thức ăn Hòa Phát', notes: 'Nhập 3.5 tấn cám vỗ béo' },
    { id: makeId('tx'), txType: 'purchase_breeding', direction: 'expense', date: addDays(today, -18), groupId: groups[2].id, groupLabel: 'Lô cai sữa C1', headCount: 48, unitPrice: 1208000, amount: 58000000, partnerName: 'Trại giống Quốc tế', notes: 'Nhập 48 heo giống cai sữa' },
    { id: makeId('tx'), txType: 'medicine_expense', direction: 'expense', date: addDays(today, -10), groupId: groups[1].id, groupLabel: 'Lô choai B2', amount: 4850000, partnerName: 'Thú y Gia Bảo', notes: 'Thuốc & vắc xin định kỳ' },
    { id: makeId('tx'), txType: 'sale_breeding', direction: 'income', date: addDays(today, -4), headCount: 4, totalWeightKg: 260, unitPrice: 95000, amount: 24700000, partnerName: 'Hộ chăn nuôi Anh Dũng', notes: 'Xuất bán 4 heo hậu bị chọn lọc' },
    { id: makeId('tx'), txType: 'feed_expense', direction: 'expense', date: addDays(today, -2), groupId: groups[1].id, groupLabel: 'Lô choai B2', amount: 21300000, partnerName: 'Đại lý thức ăn Hòa Phát', notes: 'Nhập 1.5 tấn cám choai' },
    { id: makeId('tx'), txType: 'utility_expense', direction: 'expense', date: today, amount: 6400000, partnerName: 'Điện lực & Nước sạch', notes: 'Tiền điện làm mát chuồng lạnh tháng này' },
  ];
  for (const tx of finTxs) {
    batch.set(doc(db, 'farms', farm.id, 'transactions', tx.id), { ...base, ...tx });
  }

  // Sample Farm Journal Entries
  const journalEntries = [
    {
      id: makeId('jrn'),
      date: today,
      timeLabel: '07:15',
      category: 'health',
      severity: 'warning',
      inputMethod: 'voice',
      content: 'Chuồng choai B2 có 3 con ho khan nhẹ buổi sáng, đã đánh dấu tách ô theo dõi và bổ sung men tiêu hóa.',
      authorName: 'Kỹ thuật viên Trại',
    },
    {
      id: makeId('jrn'),
      date: addDays(today, -1),
      timeLabel: '16:40',
      category: 'weather',
      severity: 'warning',
      inputMethod: 'voice',
      content: 'Gió mùa về trời chuyển lạnh đột ngột xuống 19°C, đã kéo rèm che chuồng đẻ số 1 và bật đèn úm cho heo con.',
      authorName: 'Quản lý trại',
    },
    {
      id: makeId('jrn'),
      date: addDays(today, -2),
      timeLabel: '09:00',
      category: 'hygiene',
      severity: 'normal',
      inputMethod: 'text',
      content: 'Phun sát trùng định kỳ toàn bộ lối đi khu B1 và thay hố vôi khử trùng cổng trại.',
      authorName: 'Nhân viên chuồng trại',
    },
  ];
  for (const jrn of journalEntries) {
    batch.set(doc(db, 'farms', farm.id, 'journalEntries', jrn.id), { ...base, ...jrn });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `farms/${farm.id}`);
  }
}
