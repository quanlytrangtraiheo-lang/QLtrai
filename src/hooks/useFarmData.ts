import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  cleanStr,
  clampNum,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  stripUndefined,
  testFirestoreConnection,
} from '../firebase';
import {
  addDays,
  buildAutoEventsFromBreeding,
  buildCareReminders,
  makeId,
  todayIso,
} from '../utils/farmCalculations';
import { seedSampleFarmData } from '../utils/sampleData';
import type {
  Barn,
  Breed,
  CloudBackup,
  Farm,
  FeedRation,
  FeedType,
  FinancialTx,
  HealthLog,
  InventoryItem,
  InventoryTx,
  JournalEntry,
  PigGroup,
  PigLitter,
  Sow,
  SowEvent,
  StaffMember,
  StaffRole,
  VaccinationProgram,
  Vaccine,
} from '../types';

export function useFarmData(isOnline: boolean) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null);
  const [loadingFarms, setLoadingFarms] = useState(true);
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [barns, setBarns] = useState<Barn[]>([]);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [feedTypes, setFeedTypes] = useState<FeedType[]>([]);
  const [feedRations, setFeedRations] = useState<FeedRation[]>([]);
  const [vaccinationPrograms, setVaccinationPrograms] = useState<VaccinationProgram[]>([]);
  const [sows, setSows] = useState<Sow[]>([]);
  const [sowEvents, setSowEvents] = useState<SowEvent[]>([]);
  const [pigGroups, setPigGroups] = useState<PigGroup[]>([]);
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryTx, setInventoryTx] = useState<InventoryTx[]>([]);
  const [transactions, setTransactions] = useState<FinancialTx[]>([]);
  const [backups, setBackups] = useState<CloudBackup[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [pigLitters, setPigLitters] = useState<PigLitter[]>([]);

  const autoBackupAttemptedRef = useRef<string | null>(null);

  useEffect(() => {
    void testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        setFarms([]);
        setActiveFarmId(null);
        setLoadingFarms(false);
        return;
      }

      // Ensure user profile exists
      try {
        const userRef = doc(db, 'users', u.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, {
            uid: u.uid,
            email: (u.email || '').slice(0, 254),
            displayName: (u.displayName || u.email || 'Chủ trang trại').slice(0, 120),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const data = snap.data();
          if (data?.activeFarmId) {
            setActiveFarmId(String(data.activeFarmId));
          }
        }
      } catch (err) {
        console.warn('User profile sync notice:', err);
      }
    });
    return () => unsub();
  }, []);

  // Listen to farms user owns or is a member of
  useEffect(() => {
    if (!authReady || !user) return;
    setLoadingFarms(true);
    const q = query(
      collection(db, 'farms'),
      where('memberUids', 'array-contains', user.uid)
    );
    const unsub = onSnapshot(
      q,
      { includeMetadataChanges: true },
      async (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Farm));
        setFarms(list);
        setHasPendingSync(snapshot.metadata.hasPendingWrites);

        if (list.length === 0 && !snapshot.metadata.fromCache) {
          // Auto-create initial farm for new user
          const farmId = makeId('farm');
          const defaultFarm: Farm = {
            id: farmId,
            name: 'Trang trại Heo Thịnh Vượng',
            address: 'Việt Nam',
            phone: '',
            ownerId: user.uid,
            ownerEmail: user.email || '',
            memberUids: [user.uid],
            capacity: 500,
            biosecurityLevel: 'Cấp 1 (An toàn sinh học)',
            gestationDays: 114,
            weaningDays: 24,
            postWeaningEstrusDays: 5,
            lowStockThresholdPct: 20,
            autoBackupEnabled: true,
            lastBackupDate: '',
          };
          try {
            await setDoc(doc(db, 'farms', farmId), {
              ...defaultFarm,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            await setDoc(doc(db, 'farms', farmId, 'staff', user.uid), {
              id: user.uid,
              farmId,
              farmOwnerId: user.uid,
              memberUids: [user.uid],
              uid: user.uid,
              name: (user.displayName || 'Chủ trang trại').slice(0, 120),
              email: (user.email || '').slice(0, 254),
              role: 'admin',
              active: true,
              createdBy: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            await updateDoc(doc(db, 'users', user.uid), {
              activeFarmId: farmId,
              updatedAt: serverTimestamp(),
            });
            setActiveFarmId(farmId);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `farms/${farmId}`);
          }
        } else if (list.length > 0) {
          setActiveFarmId((curr) =>
            curr && list.some((f) => f.id === curr) ? curr : list[0].id
          );
        }
        setLoadingFarms(false);
      },
      (err) => {
        setLoadingFarms(false);
        handleFirestoreError(err, OperationType.LIST, 'farms');
      }
    );
    return () => unsub();
  }, [authReady, user]);

  const activeFarm = useMemo(
    () => farms.find((f) => f.id === activeFarmId) || farms[0] || null,
    [farms, activeFarmId]
  );

  // Determine current user's RBAC role on activeFarm
  const currentRole: StaffRole = useMemo(() => {
    if (!user || !activeFarm) return 'worker';
    if (activeFarm.ownerId === user.uid) return 'admin';
    const match = staff.find((s) => s.uid === user.uid || s.id === user.uid);
    return match?.active ? match.role : 'worker';
  }, [user, activeFarm, staff]);

  // Subscribe to all subcollections of activeFarm
  useEffect(() => {
    if (!authReady || !user || !activeFarm) {
      setStaff([]);
      setBarns([]);
      setBreeds([]);
      setVaccines([]);
      setFeedTypes([]);
      setFeedRations([]);
      setVaccinationPrograms([]);
      setSows([]);
      setSowEvents([]);
      setPigGroups([]);
      setHealthLogs([]);
      setInventoryItems([]);
      setInventoryTx([]);
      setTransactions([]);
      setBackups([]);
      setJournalEntries([]);
      setPigLitters([]);
      return;
    }

    const farmId = activeFarm.id;
    const subConfigs: Array<{
      name: string;
      setter: (items: any[]) => void;
    }> = [
      { name: 'staff', setter: setStaff },
      { name: 'barns', setter: setBarns },
      { name: 'breeds', setter: setBreeds },
      { name: 'vaccines', setter: setVaccines },
      { name: 'feedTypes', setter: setFeedTypes },
      { name: 'feedRations', setter: setFeedRations },
      { name: 'vaccinationPrograms', setter: setVaccinationPrograms },
      { name: 'sows', setter: setSows },
      { name: 'sowEvents', setter: setSowEvents },
      { name: 'pigGroups', setter: setPigGroups },
      { name: 'pigLitters', setter: setPigLitters },
      { name: 'healthLogs', setter: setHealthLogs },
      { name: 'inventoryItems', setter: setInventoryItems },
      { name: 'inventoryTx', setter: setInventoryTx },
      { name: 'transactions', setter: setTransactions },
      { name: 'backups', setter: setBackups },
      { name: 'journalEntries', setter: setJournalEntries },
    ];

    const unsubs = subConfigs.map(({ name, setter }) => {
      const path = `farms/${farmId}/${name}`;
      const q = query(
        collection(db, 'farms', farmId, name),
        where('memberUids', 'array-contains', user.uid)
      );
      return onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setter(items);
          if (snap.metadata.hasPendingWrites) {
            setHasPendingSync(true);
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, path);
        }
      );
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, user, activeFarm?.id]);

  // Automatic Daily Cloud Backup
  const createCloudBackup = useCallback(
    async (backupType: 'auto_daily' | 'manual') => {
      if (!user || !activeFarm) return;
      const dateKey = todayIso();
      const backupId =
        backupType === 'auto_daily' ? `auto_${dateKey}` : makeId('bk');

      const summaryCounts = {
        sows: sows.length,
        sowEvents: sowEvents.length,
        pigGroups: pigGroups.length,
        healthLogs: healthLogs.length,
        inventoryItems: inventoryItems.length,
        transactions: transactions.length,
      };

      const snapshot = {
        farmName: activeFarm.name,
        gestationDays: activeFarm.gestationDays,
        weaningDays: activeFarm.weaningDays,
        sowTags: sows.slice(0, 50).map((s) => s.earTag),
        groupCodes: pigGroups.slice(0, 50).map((g) => g.batchCode),
        inventoryNames: inventoryItems.slice(0, 50).map((i) => `${i.name}:${i.quantity}`),
        totalIncome: transactions
          .filter((t) => t.direction === 'income')
          .reduce((a, b) => a + b.amount, 0),
        totalExpense: transactions
          .filter((t) => t.direction === 'expense')
          .reduce((a, b) => a + b.amount, 0),
      };

      const path = `farms/${activeFarm.id}/backups/${backupId}`;
      try {
        await setDoc(doc(db, 'farms', activeFarm.id, 'backups', backupId), {
          id: backupId,
          farmId: activeFarm.id,
          farmOwnerId: activeFarm.ownerId,
          memberUids: activeFarm.memberUids,
          dateKey,
          backupType,
          summaryCounts,
          snapshot,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        });
        if (activeFarm.ownerId === user.uid) {
          await updateDoc(doc(db, 'farms', activeFarm.id), {
            lastBackupDate: dateKey,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        if (backupType === 'manual') {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
    },
    [user, activeFarm, sows, sowEvents, pigGroups, healthLogs, inventoryItems, transactions]
  );

  useEffect(() => {
    if (!user || !activeFarm || !isOnline) return;
    if (activeFarm.autoBackupEnabled === false) return;
    const today = todayIso();
    if (activeFarm.lastBackupDate === today) return;
    if (autoBackupAttemptedRef.current === `${activeFarm.id}_${today}`) return;
    // Wait until initial collections are loaded and there is at least some data or farm is ready
    if (sows.length + pigGroups.length + inventoryItems.length + transactions.length === 0) return;

    autoBackupAttemptedRef.current = `${activeFarm.id}_${today}`;
    void createCloudBackup('auto_daily');
  }, [
    user,
    activeFarm,
    isOnline,
    sows.length,
    pigGroups.length,
    inventoryItems.length,
    transactions.length,
    createCloudBackup,
  ]);

  const reminders = useMemo(
    () => buildCareReminders(sowEvents, healthLogs, inventoryItems),
    [sowEvents, healthLogs, inventoryItems]
  );

  // Auth Actions
  const loginWithGoogle = async () => {
    setErrorBanner(null);
    await signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  // Generic base fields builder
  const makeBase = useCallback(
    (id: string) => {
      if (!user || !activeFarm) throw new Error('Chưa đăng nhập hoặc chưa có trang trại.');
      return {
        id,
        farmId: activeFarm.id,
        farmOwnerId: activeFarm.ownerId,
        memberUids: activeFarm.memberUids,
        createdBy: user.uid,
      };
    },
    [user, activeFarm]
  );

  // Farm settings update
  const updateFarmSettings = async (patch: Partial<Farm>) => {
    if (!activeFarm) return;
    const path = `farms/${activeFarm.id}`;
    try {
      const sanitized = stripUndefined({
        name: patch.name !== undefined ? cleanStr(patch.name, 160) : undefined,
        address: patch.address !== undefined ? cleanStr(patch.address, 300) || '' : undefined,
        phone: patch.phone !== undefined ? cleanStr(patch.phone, 40) || '' : undefined,
        capacity: patch.capacity !== undefined ? clampNum(patch.capacity, 0, 1000000) : undefined,
        biosecurityLevel:
          patch.biosecurityLevel !== undefined ? cleanStr(patch.biosecurityLevel, 60) || '' : undefined,
        gestationDays:
          patch.gestationDays !== undefined ? clampNum(patch.gestationDays, 100, 130) : undefined,
        weaningDays:
          patch.weaningDays !== undefined ? clampNum(patch.weaningDays, 10, 60) : undefined,
        postWeaningEstrusDays:
          patch.postWeaningEstrusDays !== undefined
            ? clampNum(patch.postWeaningEstrusDays, 1, 30)
            : undefined,
        lowStockThresholdPct:
          patch.lowStockThresholdPct !== undefined
            ? clampNum(patch.lowStockThresholdPct, 1, 100)
            : undefined,
        autoBackupEnabled: patch.autoBackupEnabled,
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'farms', activeFarm.id), sanitized);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  // Staff RBAC management
  const addOrUpdateStaff = async (input: {
    uid?: string;
    name: string;
    email: string;
    phone?: string;
    role: StaffRole;
    active: boolean;
    existingId?: string;
  }) => {
    if (!user || !activeFarm) return;
    const targetUid = cleanStr(input.uid, 128);
    const id = input.existingId || targetUid || makeId('staff');
    const path = `farms/${activeFarm.id}/staff/${id}`;
    const nextMembers =
      targetUid && input.active && !activeFarm.memberUids.includes(targetUid)
        ? [...activeFarm.memberUids, targetUid].slice(0, 30)
        : activeFarm.memberUids;

    try {
      if (targetUid && input.active && !activeFarm.memberUids.includes(targetUid)) {
        await updateDoc(doc(db, 'farms', activeFarm.id), {
          memberUids: nextMembers,
          updatedAt: serverTimestamp(),
        });
      }

      if (input.existingId) {
        await updateDoc(doc(db, 'farms', activeFarm.id, 'staff', id), {
          name: cleanStr(input.name, 120) || 'Nhân viên',
          email: cleanStr(input.email, 254) || '',
          phone: cleanStr(input.phone, 40) || '',
          role: input.role,
          active: input.active,
          ...(targetUid ? { uid: targetUid } : {}),
          memberUids: nextMembers,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(
          doc(db, 'farms', activeFarm.id, 'staff', id),
          stripUndefined({
            id,
            farmId: activeFarm.id,
            farmOwnerId: activeFarm.ownerId,
            memberUids: nextMembers,
            uid: targetUid,
            name: cleanStr(input.name, 120) || 'Nhân viên',
            email: cleanStr(input.email, 254) || '',
            phone: cleanStr(input.phone, 40),
            role: input.role,
            active: input.active,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Generic subcollection add/delete
  const saveSubDoc = async (
    colName: string,
    id: string,
    payload: Record<string, unknown>,
    isEdit = false
  ) => {
    if (!activeFarm) return;
    const path = `farms/${activeFarm.id}/${colName}/${id}`;
    try {
      if (isEdit) {
        await updateDoc(
          doc(db, 'farms', activeFarm.id, colName, id),
          stripUndefined({
            ...payload,
            updatedAt: serverTimestamp(),
          })
        );
      } else {
        await setDoc(
          doc(db, 'farms', activeFarm.id, colName, id),
          stripUndefined({
            ...makeBase(id),
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }
    } catch (err) {
      handleFirestoreError(err, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const deleteSubDoc = async (colName: string, id: string) => {
    if (!activeFarm) return;
    const path = `farms/${activeFarm.id}/${colName}/${id}`;
    try {
      await deleteDoc(doc(db, 'farms', activeFarm.id, colName, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const saveBatchSubDocs = async (
    colName: string,
    items: Array<{ id: string; payload: Record<string, unknown> }>
  ) => {
    if (!activeFarm || items.length === 0) return;
    for (let i = 0; i < items.length; i += 400) {
      const chunk = items.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const item of chunk) {
        batch.set(
          doc(db, 'farms', activeFarm.id, colName, item.id),
          stripUndefined({
            ...makeBase(item.id),
            ...item.payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `farms/${activeFarm.id}/${colName}`);
      }
    }
  };

  // Sow Creation + optional Breeding Auto-Events
  const createSow = async (input: {
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
  }) => {
    if (!user || !activeFarm) return;
    const sowId = makeId('sow');
    const gestationDays = activeFarm.gestationDays || 114;
    const weaningDays = activeFarm.weaningDays || 24;
    const estrusDays = activeFarm.postWeaningEstrusDays || 5;

    const breedDate = input.lastBreedingDate;
    const expectedFarrowingDate = breedDate ? addDays(breedDate, gestationDays) : undefined;
    const expectedWeaningDate = expectedFarrowingDate
      ? addDays(expectedFarrowingDate, weaningDays)
      : undefined;
    const expectedNextBreedingDate = expectedWeaningDate
      ? addDays(expectedWeaningDate, estrusDays)
      : undefined;

    const sowDoc: Sow = {
      ...makeBase(sowId),
      earTag: cleanStr(input.earTag, 60) || 'NAI',
      name: cleanStr(input.name, 120),
      breedName: cleanStr(input.breedName, 100),
      barnName: cleanStr(input.barnName, 100),
      entryDate: input.entryDate || todayIso(),
      parity: clampNum(input.parity, 0, 30),
      status: input.status,
      healthStatus: input.healthStatus,
      lastBreedingDate: breedDate,
      expectedFarrowingDate,
      expectedWeaningDate,
      expectedNextBreedingDate,
      purchaseCost: clampNum(input.purchaseCost, 0, 1e10),
      notes: cleanStr(input.notes, 1000),
    };

    const batch = writeBatch(db);
    batch.set(
      doc(db, 'farms', activeFarm.id, 'sows', sowId),
      stripUndefined({
        ...sowDoc,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    if (breedDate && ['bred', 'pregnant', 'farrowing'].includes(input.status)) {
      const autoEvs = buildAutoEventsFromBreeding(sowDoc, breedDate, activeFarm, input.boarTag);
      for (const ev of autoEvs) {
        const evId = makeId('ev');
        batch.set(
          doc(db, 'farms', activeFarm.id, 'sowEvents', evId),
          stripUndefined({
            ...makeBase(evId),
            sowId,
            sowEarTag: sowDoc.earTag,
            eventType: ev.eventType,
            scheduledDate: ev.scheduledDate,
            actualDate: ev.actualDate,
            status: ev.status,
            autoGenerated: ev.eventType !== 'breeding',
            boarTag: ev.boarTag,
            notes: ev.notes,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `farms/${activeFarm.id}/sows/${sowId}`);
    }
  };

  // Sow Lifecycle Transition (Phối giống -> Đẻ con -> Cai sữa -> Phối giống lần tiếp theo)
  const recordSowBreeding = async (sow: Sow, breedingDate: string, boarTag?: string, notes?: string) => {
    if (!activeFarm) return;
    const gestationDays = activeFarm.gestationDays || 114;
    const weaningDays = activeFarm.weaningDays || 24;
    const estrusDays = activeFarm.postWeaningEstrusDays || 5;

    const expectedFarrowingDate = addDays(breedingDate, gestationDays);
    const expectedWeaningDate = addDays(expectedFarrowingDate, weaningDays);
    const expectedNextBreedingDate = addDays(expectedWeaningDate, estrusDays);

    const batch = writeBatch(db);

    // Cancel older pending lifecycle events for this sow
    for (const ev of sowEvents) {
      if (
        ev.sowId === sow.id &&
        ev.status === 'pending' &&
        ['pregnancy_check', 'farrowing', 'weaning', 'next_breeding'].includes(ev.eventType)
      ) {
        batch.update(doc(db, 'farms', activeFarm.id, 'sowEvents', ev.id), {
          status: 'cancelled',
          updatedAt: serverTimestamp(),
        });
      }
    }

    batch.update(doc(db, 'farms', activeFarm.id, 'sows', sow.id), {
      status: 'bred',
      lastBreedingDate: breedingDate,
      expectedFarrowingDate,
      expectedWeaningDate,
      expectedNextBreedingDate,
      updatedAt: serverTimestamp(),
    });

    const autoEvs = buildAutoEventsFromBreeding(sow, breedingDate, activeFarm, boarTag);
    for (const ev of autoEvs) {
      const evId = makeId('ev');
      batch.set(
        doc(db, 'farms', activeFarm.id, 'sowEvents', evId),
        stripUndefined({
          ...makeBase(evId),
          sowId: sow.id,
          sowEarTag: sow.earTag,
          eventType: ev.eventType,
          scheduledDate: ev.scheduledDate,
          actualDate: ev.actualDate,
          status: ev.status,
          autoGenerated: ev.eventType !== 'breeding',
          boarTag: ev.boarTag,
          notes: notes && ev.eventType === 'breeding' ? cleanStr(notes, 800) : ev.notes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `farms/${activeFarm.id}/sows/${sow.id}`);
    }
  };

  const completeSowEvent = async (
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
  ) => {
    if (!activeFarm) return;
    const sow = sows.find((s) => s.id === ev.sowId);
    if (!sow) return;

    const batch = writeBatch(db);
    const actualDate = details.actualDate || todayIso();

    batch.update(
      doc(db, 'farms', activeFarm.id, 'sowEvents', ev.id),
      stripUndefined({
        status: 'completed',
        actualDate,
        liveBorn: details.liveBorn !== undefined ? clampNum(details.liveBorn, 0, 40) : undefined,
        stillborn: details.stillborn !== undefined ? clampNum(details.stillborn, 0, 40) : undefined,
        weanedCount: details.weanedCount !== undefined ? clampNum(details.weanedCount, 0, 40) : undefined,
        avgWeightKg: details.avgWeightKg !== undefined ? clampNum(details.avgWeightKg, 0, 500) : undefined,
        boarTag: cleanStr(details.boarTag, 60),
        notes: cleanStr(details.notes, 800) || ev.notes,
        updatedAt: serverTimestamp(),
      })
    );

    const weaningDays = activeFarm.weaningDays || 24;
    const estrusDays = activeFarm.postWeaningEstrusDays || 5;

    if (ev.eventType === 'pregnancy_check') {
      batch.update(doc(db, 'farms', activeFarm.id, 'sows', sow.id), {
        status: 'pregnant',
        updatedAt: serverTimestamp(),
      });
    } else if (ev.eventType === 'farrowing') {
      const nextWeaning = addDays(actualDate, weaningDays);
      const nextBreeding = addDays(nextWeaning, estrusDays);
      const nextParity = (sow.parity || 0) + 1;
      batch.update(doc(db, 'farms', activeFarm.id, 'sows', sow.id), {
        status: 'lactating',
        parity: nextParity,
        lastFarrowingDate: actualDate,
        expectedWeaningDate: nextWeaning,
        expectedNextBreedingDate: nextBreeding,
        updatedAt: serverTimestamp(),
      });
      // Update pending weaning & next_breeding scheduled dates to match actual farrowing
      for (const other of sowEvents) {
        if (other.sowId === sow.id && other.status === 'pending') {
          if (other.eventType === 'weaning') {
            batch.update(doc(db, 'farms', activeFarm.id, 'sowEvents', other.id), {
              scheduledDate: nextWeaning,
              updatedAt: serverTimestamp(),
            });
          } else if (other.eventType === 'next_breeding') {
            batch.update(doc(db, 'farms', activeFarm.id, 'sowEvents', other.id), {
              scheduledDate: nextBreeding,
              updatedAt: serverTimestamp(),
            });
          }
        }
      }
      // Auto-create suckling litter record linked to this sow
      const liveBorn = clampNum(details.liveBorn ?? 10, 0, 40);
      if (liveBorn > 0) {
        const litterId = makeId('lit');
        batch.set(
          doc(db, 'farms', activeFarm.id, 'pigLitters', litterId),
          stripUndefined({
            ...makeBase(litterId),
            sowId: sow.id,
            sowEarTag: sow.earTag,
            litterCode: `OC-${sow.earTag}-L${nextParity}`.slice(0, 60),
            parity: nextParity,
            barnName: sow.barnName,
            farrowingDate: actualDate,
            expectedWeaningDate: nextWeaning,
            liveBorn,
            currentCount: liveBorn,
            mortalityCount: 0,
            avgWeightKg: 1.5,
            healthStatus: 'healthy',
            status: 'suckling',
            notes: cleanStr(details.notes, 800) || `Đẻ lứa ${nextParity} của nái ${sow.earTag}`,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }
    } else if (ev.eventType === 'weaning') {
      const nextBreeding = addDays(actualDate, estrusDays);
      batch.update(doc(db, 'farms', activeFarm.id, 'sows', sow.id), {
        status: 'empty',
        expectedNextBreedingDate: nextBreeding,
        updatedAt: serverTimestamp(),
      });
      for (const other of sowEvents) {
        if (other.sowId === sow.id && other.status === 'pending' && other.eventType === 'next_breeding') {
          batch.update(doc(db, 'farms', activeFarm.id, 'sowEvents', other.id), {
            scheduledDate: nextBreeding,
            updatedAt: serverTimestamp(),
          });
        }
      }
      // Also mark active suckling litter(s) for this sow as weaned
      for (const lit of pigLitters) {
        if (lit.sowId === sow.id && lit.status === 'suckling') {
          batch.update(
            doc(db, 'farms', activeFarm.id, 'pigLitters', lit.id),
            stripUndefined({
              status: 'weaned',
              weanedDate: actualDate,
              weanedCount:
                details.weanedCount !== undefined
                  ? clampNum(details.weanedCount, 0, 40)
                  : lit.currentCount,
              avgWeightKg:
                details.avgWeightKg !== undefined
                  ? clampNum(details.avgWeightKg, 0, 100)
                  : lit.avgWeightKg,
              updatedAt: serverTimestamp(),
            })
          );
        }
      }
    } else if (ev.eventType === 'next_breeding') {
      // Commit first then trigger full new cycle
      await batch.commit();
      await recordSowBreeding(sow, actualDate, details.boarTag, details.notes);
      return;
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `farms/${activeFarm.id}/sowEvents/${ev.id}`);
    }
  };

  // Wean suckling litter & optionally transfer to fattening pigGroup
  const weanLitterToGroup = async (
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
  ) => {
    if (!activeFarm) return;
    const batch = writeBatch(db);
    const weanedDate = input.weanedDate || todayIso();
    const weanedCount = clampNum(input.weanedCount, 0, 40);
    const avgWeightKg = clampNum(input.avgWeightKg, 0, 100);
    let createdGroupId: string | undefined;

    if (input.createGroup && weanedCount > 0) {
      const grpId = makeId('grp');
      createdGroupId = grpId;
      const linkedSow = sows.find((s) => s.id === litter.sowId);
      batch.set(
        doc(db, 'farms', activeFarm.id, 'pigGroups', grpId),
        stripUndefined({
          ...makeBase(grpId),
          batchCode: cleanStr(input.batchCode || `CS-${litter.sowEarTag}`, 60) || 'LO-CS',
          name:
            cleanStr(input.groupName || `Lô cai sữa (${litter.litterCode})`, 140) ||
            'Lô cai sữa mới',
          breedName: linkedSow?.breedName,
          barnName: cleanStr(input.targetBarnName, 100) || litter.barnName,
          entryDate: weanedDate,
          birthDate: litter.farrowingDate,
          initialCount: weanedCount,
          currentCount: weanedCount,
          mortalityCount: 0,
          soldCount: 0,
          avgEntryWeightKg: avgWeightKg,
          currentAvgWeightKg: avgWeightKg,
          entryCostTotal: 0,
          feedCostTotal: 0,
          medCostTotal: 0,
          otherCostTotal: 0,
          revenueTotal: 0,
          status: 'active',
          healthStatus: litter.healthStatus,
          notes:
            cleanStr(input.notes, 1000) ||
            `Chuyển từ ổ theo mẹ ${litter.litterCode} (Nái ${litter.sowEarTag})`,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }

    batch.update(
      doc(db, 'farms', activeFarm.id, 'pigLitters', litter.id),
      stripUndefined({
        status: 'weaned',
        weanedDate,
        weanedCount,
        avgWeightKg,
        weanedGroupId: createdGroupId,
        notes: cleanStr(input.notes, 800) || litter.notes,
        updatedAt: serverTimestamp(),
      })
    );

    // Sync sow & pending weaning event if applicable
    const sow = sows.find((s) => s.id === litter.sowId);
    if (sow && sow.status === 'lactating') {
      const estrusDays = activeFarm.postWeaningEstrusDays || 5;
      const nextBreeding = addDays(weanedDate, estrusDays);
      batch.update(doc(db, 'farms', activeFarm.id, 'sows', sow.id), {
        status: 'empty',
        expectedNextBreedingDate: nextBreeding,
        updatedAt: serverTimestamp(),
      });
      for (const ev of sowEvents) {
        if (ev.sowId === sow.id && ev.status === 'pending') {
          if (ev.eventType === 'weaning') {
            batch.update(doc(db, 'farms', activeFarm.id, 'sowEvents', ev.id), {
              status: 'completed',
              actualDate: weanedDate,
              weanedCount,
              avgWeightKg,
              updatedAt: serverTimestamp(),
            });
          } else if (ev.eventType === 'next_breeding') {
            batch.update(doc(db, 'farms', activeFarm.id, 'sowEvents', ev.id), {
              scheduledDate: nextBreeding,
              updatedAt: serverTimestamp(),
            });
          }
        }
      }
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `farms/${activeFarm.id}/pigLitters/${litter.id}`);
    }
  };

  // Inventory stock-in / stock-out + link costs to PigGroup
  const recordInventoryMovement = async (input: {
    item: InventoryItem;
    txType: 'in' | 'out';
    quantity: number;
    unitCost: number;
    targetGroupId?: string;
    date: string;
    notes?: string;
  }) => {
    if (!activeFarm) return;
    const qty = clampNum(input.quantity, 0.01, 1e8);
    const unitCost = clampNum(input.unitCost, 0, 1e9);
    const totalCost = Math.round(qty * unitCost);
    const nextQty =
      input.txType === 'in'
        ? input.item.quantity + qty
        : Math.max(0, input.item.quantity - qty);

    const targetGroup = input.targetGroupId
      ? pigGroups.find((g) => g.id === input.targetGroupId)
      : undefined;

    const txId = makeId('itx');
    const batch = writeBatch(db);

    batch.update(doc(db, 'farms', activeFarm.id, 'inventoryItems', input.item.id), {
      quantity: nextQty,
      unitCost: input.txType === 'in' ? unitCost : input.item.unitCost,
      updatedAt: serverTimestamp(),
    });

    batch.set(
      doc(db, 'farms', activeFarm.id, 'inventoryTx', txId),
      stripUndefined({
        ...makeBase(txId),
        itemId: input.item.id,
        itemName: input.item.name,
        category: input.item.category,
        txType: input.txType,
        quantity: qty,
        unitCost,
        totalCost,
        targetGroupId: targetGroup?.id,
        targetLabel: targetGroup?.name,
        date: input.date || todayIso(),
        notes: cleanStr(input.notes, 500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // If issuing feed/medicine to a pig group, auto-accumulate group cost!
    if (input.txType === 'out' && targetGroup) {
      if (input.item.category === 'feed') {
        batch.update(doc(db, 'farms', activeFarm.id, 'pigGroups', targetGroup.id), {
          feedCostTotal: (targetGroup.feedCostTotal || 0) + totalCost,
          updatedAt: serverTimestamp(),
        });
      } else if (input.item.category === 'medicine' || input.item.category === 'vaccine') {
        batch.update(doc(db, 'farms', activeFarm.id, 'pigGroups', targetGroup.id), {
          medCostTotal: (targetGroup.medCostTotal || 0) + totalCost,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.update(doc(db, 'farms', activeFarm.id, 'pigGroups', targetGroup.id), {
          otherCostTotal: (targetGroup.otherCostTotal || 0) + totalCost,
          updatedAt: serverTimestamp(),
        });
      }
    }

    // If buying stock in, optionally log financial expense
    if (input.txType === 'in' && totalCost > 0) {
      const ftxId = makeId('tx');
      const finType =
        input.item.category === 'feed'
          ? 'feed_expense'
          : input.item.category === 'medicine' || input.item.category === 'vaccine'
          ? 'medicine_expense'
          : 'other_expense';
      batch.set(
        doc(db, 'farms', activeFarm.id, 'transactions', ftxId),
        stripUndefined({
          ...makeBase(ftxId),
          txType: finType,
          direction: 'expense',
          date: input.date || todayIso(),
          amount: totalCost,
          partnerName: input.item.supplier,
          notes: `Nhập kho ${qty} ${input.item.unit} ${input.item.name}`,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `farms/${activeFarm.id}/inventoryTx/${txId}`);
    }
  };

  // Financial transaction + automatic update to linked PigGroup revenue/counts
  const recordFinancialTransaction = async (input: {
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
  }) => {
    if (!activeFarm) return;
    const txId = makeId('tx');
    const group = input.groupId ? pigGroups.find((g) => g.id === input.groupId) : undefined;
    const batch = writeBatch(db);

    batch.set(
      doc(db, 'farms', activeFarm.id, 'transactions', txId),
      stripUndefined({
        ...makeBase(txId),
        txType: input.txType,
        direction: input.direction,
        date: input.date || todayIso(),
        groupId: group?.id,
        groupLabel: group?.name,
        headCount: input.headCount !== undefined ? clampNum(input.headCount, 0, 100000) : undefined,
        totalWeightKg:
          input.totalWeightKg !== undefined ? clampNum(input.totalWeightKg, 0, 1e7) : undefined,
        unitPrice: input.unitPrice !== undefined ? clampNum(input.unitPrice, 0, 1e10) : undefined,
        amount: clampNum(input.amount, 0, 1e12),
        partnerName: cleanStr(input.partnerName, 160),
        notes: cleanStr(input.notes, 600),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    if (group) {
      if (input.direction === 'income') {
        const soldDelta = input.headCount || 0;
        const nextCurrent = Math.max(0, group.currentCount - soldDelta);
        batch.update(doc(db, 'farms', activeFarm.id, 'pigGroups', group.id), {
          revenueTotal: (group.revenueTotal || 0) + clampNum(input.amount, 0, 1e12),
          soldCount: (group.soldCount || 0) + soldDelta,
          currentCount: nextCurrent,
          status: nextCurrent === 0 ? 'sold_out' : 'active',
          updatedAt: serverTimestamp(),
        });
      } else {
        const field =
          input.txType === 'feed_expense'
            ? 'feedCostTotal'
            : input.txType === 'medicine_expense'
            ? 'medCostTotal'
            : input.txType === 'purchase_breeding'
            ? 'entryCostTotal'
            : 'otherCostTotal';
        batch.update(doc(db, 'farms', activeFarm.id, 'pigGroups', group.id), {
          [field]: ((group[field] as number) || 0) + clampNum(input.amount, 0, 1e12),
          updatedAt: serverTimestamp(),
        });
      }
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `farms/${activeFarm.id}/transactions/${txId}`);
    }
  };

  // Load sample data
  const loadSampleData = async () => {
    if (!user || !activeFarm) return;
    await seedSampleFarmData(activeFarm, user.uid);
  };

  // Reset entire farm database (delete all farm subcollection records except admin staff)
  const resetFarmDatabase = async () => {
    if (!user || !activeFarm) return;
    const collectionsToClear: Array<{ name: string; docs: Array<{ id: string }> }> = [
      { name: 'sowEvents', docs: sowEvents },
      { name: 'sows', docs: sows },
      { name: 'pigGroups', docs: pigGroups },
      { name: 'pigLitters', docs: pigLitters },
      { name: 'healthLogs', docs: healthLogs },
      { name: 'inventoryTx', docs: inventoryTx },
      { name: 'inventoryItems', docs: inventoryItems },
      { name: 'transactions', docs: transactions },
      { name: 'barns', docs: barns },
      { name: 'breeds', docs: breeds },
      { name: 'vaccines', docs: vaccines },
      { name: 'feedTypes', docs: feedTypes },
      { name: 'feedRations', docs: feedRations },
      { name: 'vaccinationPrograms', docs: vaccinationPrograms },
      { name: 'backups', docs: backups },
      { name: 'journalEntries', docs: journalEntries },
    ];

    const allRefs: ReturnType<typeof doc>[] = [];
    for (const col of collectionsToClear) {
      for (const item of col.docs) {
        allRefs.push(doc(db, 'farms', activeFarm.id, col.name, item.id));
      }
    }

    // Commit in chunks of 400
    for (let i = 0; i < allRefs.length; i += 400) {
      const chunk = allRefs.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const ref of chunk) {
        batch.delete(ref);
      }
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `farms/${activeFarm.id}`);
      }
    }
  };

  return {
    user,
    authReady,
    loadingFarms,
    farms,
    activeFarm,
    setActiveFarmId,
    currentRole,
    hasPendingSync,
    errorBanner,
    setErrorBanner,
    staff,
    barns,
    breeds,
    vaccines,
    feedTypes,
    feedRations,
    vaccinationPrograms,
    sows,
    sowEvents,
    pigGroups,
    pigLitters,
    healthLogs,
    inventoryItems,
    inventoryTx,
    transactions,
    backups,
    journalEntries,
    reminders,
    loginWithGoogle,
    logout,
    makeBase,
    updateFarmSettings,
    addOrUpdateStaff,
    saveSubDoc,
    saveBatchSubDocs,
    deleteSubDoc,
    createSow,
    recordSowBreeding,
    completeSowEvent,
    weanLitterToGroup,
    recordInventoryMovement,
    recordFinancialTransaction,
    createCloudBackup,
    loadSampleData,
    resetFarmDatabase,
  };
}
