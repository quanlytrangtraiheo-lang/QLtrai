import React, { useState } from 'react';
import {
  BellRing,
  Check,
  CloudUpload,
  Copy,
  Database,
  Download,
  Edit3,
  Plus,
  RotateCcw,
  Shield,
  Sparkles,
  Syringe,
  Trash2,
  Utensils,
} from 'lucide-react';
import {
  buildDefaultFeedRations,
  buildDefaultVaccinationPrograms,
  formatDateVi,
  formatNumber,
  formatVND,
  makeId,
  RATION_CATEGORY_LABELS,
} from '../utils/farmCalculations';
import type {
  Barn,
  BarnType,
  Breed,
  CloudBackup,
  Farm,
  FeedRation,
  FeedStage,
  FeedType,
  FontOption,
  FontScaleOption,
  RationPigCategory,
  StaffMember,
  StaffRole,
  ThemeMode,
  VaccinationProgram,
  Vaccine,
  VaccineTargetGroup,
} from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsViewProps {
  userUid: string;
  farm: Farm;
  role: StaffRole;
  staff: StaffMember[];
  barns: Barn[];
  breeds: Breed[];
  vaccines: Vaccine[];
  feedTypes: FeedType[];
  feedRations: FeedRation[];
  vaccinationPrograms: VaccinationProgram[];
  backups: CloudBackup[];
  theme: ThemeMode;
  onToggleTheme: () => void;
  font: FontOption;
  onFontChange: (f: FontOption) => void;
  fontScale: FontScaleOption;
  onFontScaleChange: (s: FontScaleOption) => void;
  pushPermission: NotificationPermission;
  pushEnabled: boolean;
  onTogglePush: (next: boolean) => void;
  onRequestPush: () => Promise<unknown>;
  onTriggerPushCheck: () => Promise<unknown>;
  onUpdateFarm: (patch: Partial<Farm>) => Promise<void>;
  onSaveStaff: (input: {
    uid?: string;
    name: string;
    email: string;
    phone?: string;
    role: StaffRole;
    active: boolean;
    existingId?: string;
  }) => Promise<void>;
  onSaveSubDoc: (
    colName: string,
    id: string,
    payload: Record<string, unknown>,
    isEdit?: boolean
  ) => Promise<void>;
  onSaveBatchSubDocs: (
    colName: string,
    items: Array<{ id: string; payload: Record<string, unknown> }>
  ) => Promise<void>;
  onDeleteSubDoc: (colName: string, id: string) => Promise<void>;
  onManualBackup: () => Promise<void>;
  onLoadSampleData: () => Promise<void>;
  onResetDatabase: () => Promise<void>;
  exportAllSnapshotJson: () => Record<string, unknown>;
}

type SettingsSection =
  | 'farm'
  | 'staff'
  | 'barns'
  | 'breeds'
  | 'rations'
  | 'vac_programs'
  | 'vaccines'
  | 'feeds'
  | 'appearance'
  | 'backup';

const ROLE_NAMES: Record<StaffRole, string> = {
  admin: 'Chủ trại / Quản trị viên',
  manager: 'Quản lý trang trại',
  vet: 'Bác sĩ thú y',
  worker: 'Nhân viên chuồng trại',
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  userUid,
  farm,
  role,
  staff,
  barns,
  breeds,
  vaccines,
  feedTypes,
  feedRations,
  vaccinationPrograms,
  backups,
  theme,
  onToggleTheme,
  font,
  onFontChange,
  fontScale,
  onFontScaleChange,
  pushPermission,
  pushEnabled,
  onTogglePush,
  onRequestPush,
  onTriggerPushCheck,
  onUpdateFarm,
  onSaveStaff,
  onSaveSubDoc,
  onSaveBatchSubDocs,
  onDeleteSubDoc,
  onManualBackup,
  onLoadSampleData,
  onResetDatabase,
  exportAllSnapshotJson,
}) => {
  const [section, setSection] = useState<SettingsSection>('farm');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);

  // Farm form
  const [farmForm, setFarmForm] = useState({
    name: farm.name,
    address: farm.address || '',
    phone: farm.phone || '',
    capacity: farm.capacity || 500,
    biosecurityLevel: farm.biosecurityLevel || 'Cấp 1 (An toàn sinh học)',
    gestationDays: farm.gestationDays || 114,
    weaningDays: farm.weaningDays || 24,
    postWeaningEstrusDays: farm.postWeaningEstrusDays || 5,
    lowStockThresholdPct: farm.lowStockThresholdPct || 20,
    autoBackupEnabled: farm.autoBackupEnabled !== false,
  });

  // Staff form
  const [staffForm, setStaffForm] = useState({
    uid: '',
    name: '',
    email: '',
    phone: '',
    role: 'worker' as StaffRole,
  });

  // Barn form
  const [barnForm, setBarnForm] = useState({
    code: '',
    name: '',
    barnType: 'fattening' as BarnType,
    capacity: 100,
    notes: '',
  });

  // Breed form
  const [breedForm, setBreedForm] = useState({
    name: '',
    origin: '',
    avgLitterSize: 12,
    dailyGainGrams: 820,
  });

  // Vaccine form
  const [vacForm, setVacForm] = useState({
    name: '',
    targetGroup: 'all' as VaccineTargetGroup,
    recommendedWeek: 6,
    dosage: '2 ml/con',
  });

  // Feed form
  const [feedForm, setFeedForm] = useState({
    name: '',
    stage: 'grower' as FeedStage,
    proteinPct: 17,
    kgPerHeadPerDay: 2.1,
    unitPrice: 14200,
  });

  // Feed Rations (Khẩu phần ăn) state
  const [rationCategory, setRationCategory] = useState<RationPigCategory>('fattening');
  const [editingRationId, setEditingRationId] = useState<string | null>(null);
  const [rationForm, setRationForm] = useState({
    weekNumber: 1,
    feedTypeId: '',
    feedName: '',
    kgPerHeadPerDay: 1.5,
    notes: '',
  });
  const waitingRation = feedRations.find((r) => r.pigCategory === 'sow_waiting');
  const [waitingForm, setWaitingForm] = useState({
    feedTypeId: waitingRation?.feedTypeId || '',
    feedName: waitingRation?.feedName || feedTypes.find((f) => f.stage === 'gestation')?.name || 'Cám nái chờ phối',
    kgPerHeadPerDay: waitingRation?.kgPerHeadPerDay ?? 2.3,
    notes: waitingRation?.notes || 'Định mức cố định cho heo nái chờ phối / hậu bị',
  });

  // Vaccination Programs (Chương trình tiêm phòng) state
  const [vacProgFilterCat, setVacProgFilterCat] = useState<'all' | RationPigCategory>('all');
  const [editingVacProgId, setEditingVacProgId] = useState<string | null>(null);
  const [vacProgForm, setVacProgForm] = useState({
    pigCategory: 'fattening' as RationPigCategory,
    weekNumber: 3,
    vaccineName: '',
    diseaseTarget: '',
    dosage: '2 ml/con',
    notes: '',
  });

  // Reset confirmation
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  const isManagerOrAdmin = role === 'admin' || role === 'manager';

  const flashNotice = (msg: string) => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleSaveFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onUpdateFarm(farmForm);
      flashNotice('Đã lưu thông tin & thông số kỹ thuật trang trại.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadJsonBackup = () => {
    const data = exportAllSnapshotJson();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sao_luu_${farm.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetConfirmText.trim().toUpperCase() !== 'XOA DU LIEU') return;
    setBusy(true);
    try {
      await onResetDatabase();
      setShowResetModal(false);
      setResetConfirmText('');
      flashNotice('Đã xóa toàn bộ dữ liệu cũ. Trang trại sẵn sàng nhập mới.');
    } finally {
      setBusy(false);
    }
  };

  const sections: Array<{ id: SettingsSection; label: string }> = [
    { id: 'farm', label: 'Trang trại & Thông số' },
    { id: 'rations', label: 'Khẩu phần ăn' },
    { id: 'vac_programs', label: 'Chương trình tiêm phòng' },
    { id: 'staff', label: 'Nhân viên & Phân quyền' },
    { id: 'barns', label: 'Chuồng nuôi' },
    { id: 'breeds', label: 'Giống heo' },
    { id: 'vaccines', label: 'Danh mục Vắc xin' },
    { id: 'feeds', label: 'Loại thức ăn' },
    { id: 'appearance', label: 'Phông chữ & Giao diện' },
    { id: 'backup', label: 'Sao lưu & Reset trại' },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-navigation Pills/Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              section === s.id
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {savedNotice && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* 1. FARM & TECHNICAL PARAMS */}
      {section === 'farm' && (
        <form
          onSubmit={(e) => void handleSaveFarm(e)}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
        >
          <div>
            <h2 className="text-base font-semibold">Thông tin trang trại & Thông số kỹ thuật</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cấu hình chuẩn chu kỳ sinh sản heo nái để hệ thống tự động tạo lịch chính xác.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Tên trang trại</span>
              <input
                required
                disabled={!isManagerOrAdmin}
                value={farmForm.name}
                onChange={(e) => setFarmForm({ ...farmForm, name: e.target.value })}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Địa chỉ</span>
              <input
                disabled={!isManagerOrAdmin}
                value={farmForm.address}
                onChange={(e) => setFarmForm({ ...farmForm, address: e.target.value })}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Số điện thoại liên hệ</span>
              <input
                disabled={!isManagerOrAdmin}
                value={farmForm.phone}
                onChange={(e) => setFarmForm({ ...farmForm, phone: e.target.value })}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Quy mô thiết kế (con)</span>
              <input
                type="number"
                min={0}
                disabled={!isManagerOrAdmin}
                value={farmForm.capacity}
                onChange={(e) => setFarmForm({ ...farmForm, capacity: Number(e.target.value) })}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Số ngày mang thai chuẩn</span>
              <input
                type="number"
                min={100}
                max={130}
                disabled={!isManagerOrAdmin}
                value={farmForm.gestationDays}
                onChange={(e) => setFarmForm({ ...farmForm, gestationDays: Number(e.target.value) })}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Số ngày nuôi con (cai sữa)</span>
              <input
                type="number"
                min={10}
                max={60}
                disabled={!isManagerOrAdmin}
                value={farmForm.weaningDays}
                onChange={(e) => setFarmForm({ ...farmForm, weaningDays: Number(e.target.value) })}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Số ngày lên giống sau cai sữa</span>
              <input
                type="number"
                min={1}
                max={30}
                disabled={!isManagerOrAdmin}
                value={farmForm.postWeaningEstrusDays}
                onChange={(e) =>
                  setFarmForm({ ...farmForm, postWeaningEstrusDays: Number(e.target.value) })
                }
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Tiêu chuẩn an toàn sinh học</span>
              <input
                disabled={!isManagerOrAdmin}
                value={farmForm.biosecurityLevel}
                onChange={(e) => setFarmForm({ ...farmForm, biosecurityLevel: e.target.value })}
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
              />
            </label>
          </div>

          {isManagerOrAdmin && (
            <div className="pt-2">
              <button
                type="submit"
                disabled={busy}
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium"
              >
                {busy ? 'Đang lưu...' : 'Lưu cài đặt trang trại'}
              </button>
            </div>
          )}
        </form>
      )}

      {/* 2. STAFF & RBAC */}
      {section === 'staff' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs space-y-1">
              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>Mã UID tài khoản của bạn (chia sẻ cho chủ trại để cấp quyền):</span>
              </div>
              <div className="font-mono-tabular text-slate-600 dark:text-slate-400 break-all">
                {userUid}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(userUid);
                setCopiedUid(true);
                setTimeout(() => setCopiedUid(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium whitespace-nowrap shrink-0"
            >
              {copiedUid ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUid ? 'Đã sao chép' : 'Sao chép UID'}</span>
            </button>
          </div>

          {isManagerOrAdmin && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!staffForm.name.trim()) return;
                void onSaveStaff({
                  uid: staffForm.uid.trim() || undefined,
                  name: staffForm.name.trim(),
                  email: staffForm.email.trim(),
                  phone: staffForm.phone.trim(),
                  role: staffForm.role,
                  active: true,
                }).then(() => {
                  setStaffForm({ uid: '', name: '', email: '', phone: '', role: 'worker' });
                  flashNotice('Đã thêm nhân viên và phân quyền truy cập.');
                });
              }}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
            >
              <h3 className="text-base font-semibold">Thêm nhân viên & Phân quyền</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
                <input
                  required
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  placeholder="Họ tên nhân viên"
                  className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
                <input
                  required
                  type="email"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  placeholder="Email Google"
                  className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
                <input
                  value={staffForm.uid}
                  onChange={(e) => setStaffForm({ ...staffForm, uid: e.target.value })}
                  placeholder="UID (để đồng bộ đám mây)"
                  className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
                <select
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as StaffRole })}
                  className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="worker">Nhân viên chuồng</option>
                  <option value="vet">Bác sĩ thú y</option>
                  <option value="manager">Quản lý trại</option>
                  <option value="admin">Chủ trại / Quản trị</option>
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 min-h-[42px] px-4 rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cấp quyền</span>
                </button>
              </div>
            </form>
          )}

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
            {staff.map((st) => (
              <div key={st.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {st.name} · <span className="text-emerald-700 dark:text-emerald-400">{ROLE_NAMES[st.role]}</span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono-tabular">
                    {st.email} {st.uid ? `· UID: ${st.uid}` : ''}
                  </div>
                </div>
                {isManagerOrAdmin && st.uid !== farm.ownerId && (
                  <button
                    type="button"
                    onClick={() => void onDeleteSubDoc('staff', st.id)}
                    className="min-h-[38px] px-3 rounded-lg text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    Thu hồi quyền
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. BARNS */}
      {section === 'barns' && (
        <div className="space-y-4">
          {isManagerOrAdmin && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!barnForm.code.trim() || !barnForm.name.trim()) return;
                void onSaveSubDoc('barns', makeId('barn'), barnForm).then(() => {
                  setBarnForm({ code: '', name: '', barnType: 'fattening', capacity: 100, notes: '' });
                  flashNotice('Đã thêm chuồng nuôi mới.');
                });
              }}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 text-sm"
            >
              <input
                required
                value={barnForm.code}
                onChange={(e) => setBarnForm({ ...barnForm, code: e.target.value })}
                placeholder="Mã chuồng (VD: C-TH02)"
                className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
              />
              <input
                required
                value={barnForm.name}
                onChange={(e) => setBarnForm({ ...barnForm, name: e.target.value })}
                placeholder="Tên chuồng nuôi"
                className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
              />
              <select
                value={barnForm.barnType}
                onChange={(e) => setBarnForm({ ...barnForm, barnType: e.target.value as BarnType })}
                className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="farrowing">Chuồng đẻ</option>
                <option value="gestation">Chuồng mang thai</option>
                <option value="nursery">Chuồng cai sữa</option>
                <option value="fattening">Chuồng nuôi thịt</option>
                <option value="quarantine">Khu cách ly</option>
              </select>
              <input
                type="number"
                min={1}
                value={barnForm.capacity}
                onChange={(e) => setBarnForm({ ...barnForm, capacity: Number(e.target.value) })}
                placeholder="Sức chứa"
                className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
              />
              <button
                type="submit"
                className="min-h-[42px] px-4 rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800"
              >
                Thêm chuồng
              </button>
            </form>
          )}

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
            {barns.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">Chưa có chuồng nuôi nào.</div>
            ) : (
              barns.map((b) => (
                <div key={b.id} className="p-4 flex items-center justify-between gap-4 text-sm">
                  <div>
                    <div className="font-semibold">
                      <span className="font-mono-tabular">{b.code}</span> · {b.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      Loại: {b.barnType} · Sức chứa: {b.capacity} con {b.notes ? `· ${b.notes}` : ''}
                    </div>
                  </div>
                  {isManagerOrAdmin && (
                    <button
                      type="button"
                      onClick={() => void onDeleteSubDoc('barns', b.id)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. BREEDS */}
      {section === 'breeds' && (
        <div className="space-y-4">
          {isManagerOrAdmin && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!breedForm.name.trim()) return;
                void onSaveSubDoc('breeds', makeId('brd'), breedForm).then(() => {
                  setBreedForm({ name: '', origin: '', avgLitterSize: 12, dailyGainGrams: 820 });
                  flashNotice('Đã thêm giống heo mới.');
                });
              }}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 text-sm"
            >
              <input
                required
                value={breedForm.name}
                onChange={(e) => setBreedForm({ ...breedForm, name: e.target.value })}
                placeholder="Tên giống heo"
                className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
              />
              <input
                value={breedForm.origin}
                onChange={(e) => setBreedForm({ ...breedForm, origin: e.target.value })}
                placeholder="Nguồn gốc"
                className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
              />
              <input
                type="number"
                step="0.1"
                value={breedForm.avgLitterSize}
                onChange={(e) => setBreedForm({ ...breedForm, avgLitterSize: Number(e.target.value) })}
                placeholder="Số con/lứa TB"
                className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
              />
              <input
                type="number"
                value={breedForm.dailyGainGrams}
                onChange={(e) => setBreedForm({ ...breedForm, dailyGainGrams: Number(e.target.value) })}
                placeholder="ADG (g/ngày)"
                className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
              />
              <button
                type="submit"
                className="min-h-[42px] px-4 rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800"
              >
                Thêm giống
              </button>
            </form>
          )}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
            {breeds.map((br) => (
              <div key={br.id} className="p-4 flex items-center justify-between gap-4 text-sm">
                <div>
                  <div className="font-semibold">{br.name}</div>
                  <div className="text-xs text-slate-500">
                    {br.origin || '—'} · Đẻ TB {br.avgLitterSize} con/lứa · Tăng trọng {br.dailyGainGrams} g/ngày
                  </div>
                </div>
                {isManagerOrAdmin && (
                  <button
                    type="button"
                    onClick={() => void onDeleteSubDoc('breeds', br.id)}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. VACCINES */}
      {section === 'vaccines' && (
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!vacForm.name.trim()) return;
              void onSaveSubDoc('vaccines', makeId('vac'), vacForm).then(() => {
                setVacForm({ name: '', targetGroup: 'all', recommendedWeek: 6, dosage: '2 ml/con' });
                flashNotice('Đã thêm phác đồ vắc xin.');
              });
            }}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 text-sm"
          >
            <input
              required
              value={vacForm.name}
              onChange={(e) => setVacForm({ ...vacForm, name: e.target.value })}
              placeholder="Tên vắc xin"
              className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
            />
            <select
              value={vacForm.targetGroup}
              onChange={(e) =>
                setVacForm({ ...vacForm, targetGroup: e.target.value as VaccineTargetGroup })
              }
              className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <option value="all">Toàn đàn</option>
              <option value="sow">Heo nái</option>
              <option value="piglet">Heo con</option>
              <option value="fattening">Heo thịt</option>
            </select>
            <input
              type="number"
              min={0}
              value={vacForm.recommendedWeek}
              onChange={(e) => setVacForm({ ...vacForm, recommendedWeek: Number(e.target.value) })}
              placeholder="Tuần tuổi tiêm"
              className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
            />
            <input
              value={vacForm.dosage}
              onChange={(e) => setVacForm({ ...vacForm, dosage: e.target.value })}
              placeholder="Liều lượng"
              className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
            />
            <button
              type="submit"
              className="min-h-[42px] px-4 rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800"
            >
              Thêm vắc xin
            </button>
          </form>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
            {vaccines.map((v) => (
              <div key={v.id} className="p-4 flex items-center justify-between gap-4 text-sm">
                <div>
                  <div className="font-semibold">{v.name}</div>
                  <div className="text-xs text-slate-500">
                    Đối tượng: {v.targetGroup} · Tuần khuyến nghị: {v.recommendedWeek} · Liều: {v.dosage || '—'}
                  </div>
                </div>
                {isManagerOrAdmin && (
                  <button
                    type="button"
                    onClick={() => void onDeleteSubDoc('vaccines', v.id)}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. FEED TYPES */}
      {section === 'feeds' && (
        <div className="space-y-4">
          {isManagerOrAdmin && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!feedForm.name.trim()) return;
                void onSaveSubDoc('feedTypes', makeId('fd'), feedForm).then(() => {
                  setFeedForm({ name: '', stage: 'grower', proteinPct: 17, kgPerHeadPerDay: 2.1, unitPrice: 14200 });
                  flashNotice('Đã thêm loại thức ăn & định mức khẩu phần.');
                });
              }}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 text-sm"
            >
              <input
                required
                value={feedForm.name}
                onChange={(e) => setFeedForm({ ...feedForm, name: e.target.value })}
                placeholder="Tên loại cám"
                className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
              />
              <select
                value={feedForm.stage}
                onChange={(e) => setFeedForm({ ...feedForm, stage: e.target.value as FeedStage })}
                className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="prestarter">Tập ăn</option>
                <option value="starter">Cai sữa</option>
                <option value="grower">Heo choai</option>
                <option value="finisher">Vỗ béo</option>
                <option value="gestation">Nái mang thai</option>
                <option value="lactation">Nái nuôi con</option>
              </select>
              <input
                type="number"
                step="0.05"
                min={0}
                value={feedForm.kgPerHeadPerDay}
                onChange={(e) => setFeedForm({ ...feedForm, kgPerHeadPerDay: Number(e.target.value) })}
                placeholder="kg/con/ngày"
                className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
              />
              <input
                type="number"
                min={0}
                value={feedForm.unitPrice}
                onChange={(e) => setFeedForm({ ...feedForm, unitPrice: Number(e.target.value) })}
                placeholder="Đơn giá (VND/kg)"
                className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
              />
              <button
                type="submit"
                className="min-h-[42px] px-4 rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800"
              >
                Thêm thức ăn
              </button>
            </form>
          )}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
            {feedTypes.map((f) => (
              <div key={f.id} className="p-4 flex items-center justify-between gap-4 text-sm">
                <div>
                  <div className="font-semibold">{f.name}</div>
                  <div className="text-xs text-slate-500 font-mono-tabular">
                    Giai đoạn: {f.stage} · {formatNumber(f.kgPerHeadPerDay, 2)} kg/con/ngày · {formatVND(f.unitPrice)}/kg
                  </div>
                </div>
                {isManagerOrAdmin && (
                  <button
                    type="button"
                    onClick={() => void onDeleteSubDoc('feedTypes', f.id)}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6B. KHẨU PHẦN ĂN (WEEKLY FEED RATIONS) */}
      {section === 'rations' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                <Utensils className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>Cài đặt Khẩu phần ăn theo tuần & đối tượng</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Các định mức và loại cám cài đặt tại đây được dùng trực tiếp để tính dự kiến lượng cám sử dụng theo từng loại trong 7 ngày tới ở mục Tổng quan.
              </p>
            </div>
            {isManagerOrAdmin && (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const defaults = buildDefaultFeedRations(feedTypes);
                    const toCreate = defaults.filter(
                      (d) =>
                        !feedRations.some(
                          (existing) =>
                            existing.pigCategory === d.pigCategory &&
                            (d.pigCategory === 'sow_waiting' || existing.weekNumber === d.weekNumber)
                        )
                    );
                    if (toCreate.length === 0) {
                      flashNotice('Khẩu phần chuẩn các tuần đã có đầy đủ.');
                      return;
                    }
                    await onSaveBatchSubDocs(
                      'feedRations',
                      toCreate.map((d) => ({ id: makeId('rat'), payload: d }))
                    );
                    flashNotice(`Đã nạp ${toCreate.length} định mức khẩu phần chuẩn.`);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 min-h-[42px] px-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-950/60 whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                <span>Nạp khẩu phần chuẩn gợi ý</span>
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            {(
              ['fattening', 'sow_gestation', 'sow_lactation', 'sow_waiting'] as RationPigCategory[]
            ).map((cat) => {
              const count = feedRations.filter((r) => r.pigCategory === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setRationCategory(cat);
                    setEditingRationId(null);
                    if (cat === 'sow_waiting' && waitingRation) {
                      setWaitingForm({
                        feedTypeId: waitingRation.feedTypeId || '',
                        feedName: waitingRation.feedName,
                        kgPerHeadPerDay: waitingRation.kgPerHeadPerDay,
                        notes: waitingRation.notes || '',
                      });
                    }
                  }}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    rationCategory === cat
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {RATION_CATEGORY_LABELS[cat]} <span className="font-mono-tabular opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          {rationCategory === 'sow_waiting' ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const selectedFeed = feedTypes.find((f) => f.id === waitingForm.feedTypeId);
                const resolvedName = selectedFeed?.name || waitingForm.feedName.trim();
                if (!resolvedName) return;
                setBusy(true);
                try {
                  const targetId = waitingRation?.id || makeId('rat');
                  await onSaveSubDoc(
                    'feedRations',
                    targetId,
                    {
                      pigCategory: 'sow_waiting',
                      weekNumber: 0,
                      feedTypeId: selectedFeed?.id || waitingForm.feedTypeId || undefined,
                      feedName: resolvedName,
                      kgPerHeadPerDay: Number(waitingForm.kgPerHeadPerDay) || 0,
                      notes: waitingForm.notes.trim() || undefined,
                    },
                    Boolean(waitingRation)
                  );
                  flashNotice('Đã lưu định mức khẩu phần cho heo nái chờ phối.');
                } finally {
                  setBusy(false);
                }
              }}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
            >
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Định mức thức ăn Heo nái chờ phối (1 giá trị áp dụng chung)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Áp dụng cho toàn bộ heo nái hậu bị / sau cai sữa đang chờ phối giống.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Chọn từ loại thức ăn đã cài
                  </span>
                  <select
                    disabled={!isManagerOrAdmin}
                    value={waitingForm.feedTypeId}
                    onChange={(e) => {
                      const fd = feedTypes.find((f) => f.id === e.target.value);
                      setWaitingForm({
                        ...waitingForm,
                        feedTypeId: e.target.value,
                        feedName: fd ? fd.name : waitingForm.feedName,
                      });
                    }}
                    className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="">-- Nhập tên cám thủ công --</option>
                    {feedTypes.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Tên loại thức ăn áp dụng
                  </span>
                  <input
                    required
                    disabled={!isManagerOrAdmin}
                    value={waitingForm.feedName}
                    onChange={(e) => setWaitingForm({ ...waitingForm, feedName: e.target.value })}
                    placeholder="VD: Cám nái chờ phối / mang thai"
                    className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Định mức (kg / con / ngày)
                  </span>
                  <input
                    type="number"
                    required
                    step="0.05"
                    min={0}
                    max={20}
                    disabled={!isManagerOrAdmin}
                    value={waitingForm.kgPerHeadPerDay}
                    onChange={(e) =>
                      setWaitingForm({ ...waitingForm, kgPerHeadPerDay: Number(e.target.value) })
                    }
                    className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent font-mono-tabular"
                  />
                </label>
              </div>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ghi chú</span>
                <input
                  disabled={!isManagerOrAdmin}
                  value={waitingForm.notes}
                  onChange={(e) => setWaitingForm({ ...waitingForm, notes: e.target.value })}
                  placeholder="Ghi chú khẩu phần chờ phối"
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              {isManagerOrAdmin && (
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[44px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium"
                >
                  {waitingRation ? 'Cập nhật định mức chờ phối' : 'Lưu định mức chờ phối'}
                </button>
              )}
            </form>
          ) : (
            <div className="space-y-4">
              {isManagerOrAdmin && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const selectedFeed = feedTypes.find((f) => f.id === rationForm.feedTypeId);
                    const resolvedName = selectedFeed?.name || rationForm.feedName.trim();
                    if (!resolvedName) return;
                    const wk = Math.max(1, Math.round(Number(rationForm.weekNumber) || 1));
                    const existingSameWeek = feedRations.find(
                      (r) => r.pigCategory === rationCategory && r.weekNumber === wk
                    );
                    const targetId = editingRationId || existingSameWeek?.id || makeId('rat');
                    const isUpdate = Boolean(editingRationId || existingSameWeek);
                    setBusy(true);
                    try {
                      await onSaveSubDoc(
                        'feedRations',
                        targetId,
                        {
                          pigCategory: rationCategory,
                          weekNumber: wk,
                          feedTypeId: selectedFeed?.id || rationForm.feedTypeId || undefined,
                          feedName: resolvedName,
                          kgPerHeadPerDay: Number(rationForm.kgPerHeadPerDay) || 0,
                          notes: rationForm.notes.trim() || undefined,
                        },
                        isUpdate
                      );
                      setEditingRationId(null);
                      setRationForm({
                        weekNumber: wk + 1,
                        feedTypeId: rationForm.feedTypeId,
                        feedName: resolvedName,
                        kgPerHeadPerDay: rationForm.kgPerHeadPerDay,
                        notes: '',
                      });
                      flashNotice(
                        isUpdate
                          ? `Đã cập nhật khẩu phần Tuần ${wk}.`
                          : `Đã thêm khẩu phần Tuần ${wk}.`
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {editingRationId
                        ? `Chỉnh sửa khẩu phần Tuần ${rationForm.weekNumber}`
                        : `Thêm / Cập nhật khẩu phần ${RATION_CATEGORY_LABELS[rationCategory]}`}
                    </h3>
                    {editingRationId && (
                      <button
                        type="button"
                        onClick={() => setEditingRationId(null)}
                        className="text-xs text-slate-500 hover:underline"
                      >
                        Hủy sửa
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                    <label className="space-y-1">
                      <span className="text-xs text-slate-500">
                        {rationCategory === 'fattening'
                          ? 'Tuần tuổi'
                          : rationCategory === 'sow_gestation'
                          ? 'Tuần mang thai'
                          : 'Tuần nuôi con'}
                      </span>
                      <input
                        type="number"
                        required
                        min={1}
                        max={rationCategory === 'sow_gestation' ? 18 : rationCategory === 'sow_lactation' ? 10 : 40}
                        value={rationForm.weekNumber}
                        onChange={(e) =>
                          setRationForm({ ...rationForm, weekNumber: Number(e.target.value) })
                        }
                        className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent font-mono-tabular"
                      />
                    </label>

                    <label className="space-y-1 lg:col-span-2">
                      <span className="text-xs text-slate-500">Loại thức ăn (chọn hoặc tự nhập)</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={rationForm.feedTypeId}
                          onChange={(e) => {
                            const fd = feedTypes.find((f) => f.id === e.target.value);
                            setRationForm({
                              ...rationForm,
                              feedTypeId: e.target.value,
                              feedName: fd ? fd.name : rationForm.feedName,
                              kgPerHeadPerDay: fd ? fd.kgPerHeadPerDay : rationForm.kgPerHeadPerDay,
                            });
                          }}
                          className="min-h-[42px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        >
                          <option value="">-- Chọn loại cám --</option>
                          {feedTypes.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                        <input
                          required
                          value={rationForm.feedName}
                          onChange={(e) =>
                            setRationForm({ ...rationForm, feedName: e.target.value })
                          }
                          placeholder="Tên loại thức ăn"
                          className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                        />
                      </div>
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-500">Định mức (kg/con/ngày)</span>
                      <input
                        type="number"
                        required
                        step="0.05"
                        min={0}
                        max={20}
                        value={rationForm.kgPerHeadPerDay}
                        onChange={(e) =>
                          setRationForm({ ...rationForm, kgPerHeadPerDay: Number(e.target.value) })
                        }
                        className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent font-mono-tabular"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-500">Ghi chú</span>
                      <input
                        value={rationForm.notes}
                        onChange={(e) => setRationForm({ ...rationForm, notes: e.target.value })}
                        placeholder="Ghi chú giai đoạn"
                        className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                      />
                    </label>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full min-h-[42px] px-4 rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800 whitespace-nowrap"
                      >
                        {editingRationId ? 'Lưu cập nhật' : 'Lưu tuần'}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      <th className="text-left py-3 px-4 font-medium">Tuần</th>
                      <th className="text-left py-3 px-4 font-medium">Loại thức ăn</th>
                      <th className="text-right py-3 px-4 font-medium">Định mức (kg/con/ngày)</th>
                      <th className="text-left py-3 px-4 font-medium">Ghi chú</th>
                      {isManagerOrAdmin && <th className="text-right py-3 px-4 font-medium">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {feedRations
                      .filter((r) => r.pigCategory === rationCategory)
                      .sort((a, b) => a.weekNumber - b.weekNumber)
                      .map((r) => (
                        <tr key={r.id}>
                          <td className="py-3 px-4 font-mono-tabular font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                            Tuần {r.weekNumber}
                          </td>
                          <td className="py-3 px-4 text-slate-800 dark:text-slate-200">{r.feedName}</td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-emerald-700 dark:text-emerald-400">
                            {formatNumber(r.kgPerHeadPerDay, 2)} kg
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                            {r.notes || '—'}
                          </td>
                          {isManagerOrAdmin && (
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRationId(r.id);
                                    setRationForm({
                                      weekNumber: r.weekNumber,
                                      feedTypeId: r.feedTypeId || '',
                                      feedName: r.feedName,
                                      kgPerHeadPerDay: r.kgPerHeadPerDay,
                                      notes: r.notes || '',
                                    });
                                  }}
                                  className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-emerald-700"
                                  title="Chỉnh sửa"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onDeleteSubDoc('feedRations', r.id)}
                                  className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600"
                                  title="Xóa"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    {feedRations.filter((r) => r.pigCategory === rationCategory).length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                          Chưa có khẩu phần nào cho mục này. Nhập từng tuần ở trên hoặc bấm &ldquo;Nạp khẩu phần chuẩn gợi ý&rdquo;.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6C. CHƯƠNG TRÌNH TIÊM PHÒNG (VACCINATION PROGRAMS BY PIG TYPE & WEEK) */}
      {section === 'vac_programs' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                <Syringe className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>Chương trình tiêm phòng chuẩn theo loại heo & tuần tuổi</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Các mũi tiêm cấu hình tại đây sẽ tự động liên kết sang mục Sức khỏe & Tiêm phòng để đề xuất và lên lịch tiêm hàng loạt cho các lô heo thịt và cá thể heo nái.
              </p>
            </div>

            {isManagerOrAdmin && (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const defaults = buildDefaultVaccinationPrograms();
                    const toCreate = defaults.filter(
                      (d) =>
                        !vaccinationPrograms.some(
                          (ex) =>
                            ex.pigCategory === d.pigCategory &&
                            ex.weekNumber === d.weekNumber &&
                            ex.vaccineName.toLowerCase() === d.vaccineName.toLowerCase()
                        )
                    );
                    if (toCreate.length === 0) {
                      flashNotice('Chương trình tiêm phòng chuẩn đã đầy đủ.');
                      return;
                    }
                    await onSaveBatchSubDocs(
                      'vaccinationPrograms',
                      toCreate.map((d) => ({ id: makeId('vpg'), payload: d }))
                    );
                    flashNotice(`Đã nạp ${toCreate.length} mũi tiêm trong chương trình chuẩn.`);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 min-h-[42px] px-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-950/60 whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                <span>Nạp chương trình tiêm chuẩn</span>
              </button>
            )}
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!vacProgForm.vaccineName.trim()) return;
              const targetId = editingVacProgId || makeId('vpg');
              const isUpdate = Boolean(editingVacProgId);
              setBusy(true);
              try {
                await onSaveSubDoc(
                  'vaccinationPrograms',
                  targetId,
                  {
                    pigCategory: vacProgForm.pigCategory,
                    weekNumber:
                      vacProgForm.pigCategory === 'sow_waiting'
                        ? 0
                        : Math.max(0, Math.round(Number(vacProgForm.weekNumber) || 0)),
                    vaccineName: vacProgForm.vaccineName.trim(),
                    diseaseTarget: vacProgForm.diseaseTarget.trim() || undefined,
                    dosage: vacProgForm.dosage.trim() || undefined,
                    notes: vacProgForm.notes.trim() || undefined,
                  },
                  isUpdate
                );
                setEditingVacProgId(null);
                setVacProgForm({
                  pigCategory: vacProgForm.pigCategory,
                  weekNumber: vacProgForm.weekNumber,
                  vaccineName: '',
                  diseaseTarget: '',
                  dosage: '2 ml/con',
                  notes: '',
                });
                flashNotice(isUpdate ? 'Đã cập nhật lịch trình vắc xin.' : 'Đã thêm mũi tiêm vào chương trình.');
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {editingVacProgId ? 'Chỉnh sửa mũi tiêm trong chương trình' : 'Thêm mũi tiêm vào chương trình'}
              </h3>
              {editingVacProgId && (
                <button
                  type="button"
                  onClick={() => setEditingVacProgId(null)}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Hủy sửa
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Loại heo</span>
                <select
                  value={vacProgForm.pigCategory}
                  onChange={(e) =>
                    setVacProgForm({
                      ...vacProgForm,
                      pigCategory: e.target.value as RationPigCategory,
                    })
                  }
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="fattening">Heo thịt (tuần tuổi)</option>
                  <option value="sow_gestation">Nái mang thai (tuần thai)</option>
                  <option value="sow_lactation">Nái nuôi con (tuần nuôi con)</option>
                  <option value="sow_waiting">Nái chờ phối</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs text-slate-500">
                  {vacProgForm.pigCategory === 'sow_waiting' ? 'Giai đoạn' : 'Tuần tuổi / Tuần'}
                </span>
                {vacProgForm.pigCategory === 'sow_waiting' ? (
                  <div className="min-h-[42px] px-3 flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-500">
                    Trước phối giống
                  </div>
                ) : (
                  <input
                    type="number"
                    required
                    min={1}
                    max={40}
                    value={vacProgForm.weekNumber}
                    onChange={(e) =>
                      setVacProgForm({ ...vacProgForm, weekNumber: Number(e.target.value) })
                    }
                    className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent font-mono-tabular"
                  />
                )}
              </label>

              <label className="space-y-1">
                <span className="text-xs text-slate-500">Tên vắc xin</span>
                <input
                  required
                  list="vaccine-catalog-list"
                  value={vacProgForm.vaccineName}
                  onChange={(e) => {
                    const matched = vaccines.find((v) => v.name === e.target.value);
                    setVacProgForm({
                      ...vacProgForm,
                      vaccineName: e.target.value,
                      dosage: matched?.dosage || vacProgForm.dosage,
                    });
                  }}
                  placeholder="VD: Dịch tả heo (CSF)"
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
                <datalist id="vaccine-catalog-list">
                  {vaccines.map((v) => (
                    <option key={v.id} value={v.name} />
                  ))}
                </datalist>
              </label>

              <label className="space-y-1">
                <span className="text-xs text-slate-500">Bệnh phòng ngừa</span>
                <input
                  value={vacProgForm.diseaseTarget}
                  onChange={(e) =>
                    setVacProgForm({ ...vacProgForm, diseaseTarget: e.target.value })
                  }
                  placeholder="VD: Dịch tả cổ điển"
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs text-slate-500">Liều lượng</span>
                <input
                  value={vacProgForm.dosage}
                  onChange={(e) => setVacProgForm({ ...vacProgForm, dosage: e.target.value })}
                  placeholder="2 ml/con"
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[42px] px-4 rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800 whitespace-nowrap"
                >
                  {editingVacProgId ? 'Cập nhật' : 'Thêm mũi tiêm'}
                </button>
              </div>
            </div>
            <label className="block space-y-1">
              <span className="text-xs text-slate-500">Ghi chú kỹ thuật</span>
              <input
                value={vacProgForm.notes}
                onChange={(e) => setVacProgForm({ ...vacProgForm, notes: e.target.value })}
                placeholder="VD: Tiêm bắp cổ, bảo quản lạnh 2-8°C"
                className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
              />
            </label>
          </form>

          {/* Filter by Pig Category */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'Tất cả loại heo' },
              { id: 'fattening', label: 'Heo thịt' },
              { id: 'sow_gestation', label: 'Nái mang thai' },
              { id: 'sow_lactation', label: 'Nái nuôi con' },
              { id: 'sow_waiting', label: 'Nái chờ phối' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setVacProgFilterCat(tab.id as typeof vacProgFilterCat)}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                  vacProgFilterCat === tab.id
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left py-3 px-4 font-medium">Loại heo</th>
                  <th className="text-left py-3 px-4 font-medium">Thời điểm (Tuần)</th>
                  <th className="text-left py-3 px-4 font-medium">Vắc xin</th>
                  <th className="text-left py-3 px-4 font-medium">Phòng bệnh</th>
                  <th className="text-left py-3 px-4 font-medium">Liều lượng</th>
                  <th className="text-right py-3 px-4 font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {vaccinationPrograms
                  .filter((p) => vacProgFilterCat === 'all' || p.pigCategory === vacProgFilterCat)
                  .sort((a, b) => {
                    const catCompare = a.pigCategory.localeCompare(b.pigCategory);
                    if (catCompare !== 0) return catCompare;
                    return a.weekNumber - b.weekNumber;
                  })
                  .map((vp) => (
                    <tr key={vp.id}>
                      <td className="py-3 px-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {RATION_CATEGORY_LABELS[vp.pigCategory]}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        {vp.pigCategory === 'sow_waiting' ? 'Trước phối' : `Tuần ${vp.weekNumber}`}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        <div>{vp.vaccineName}</div>
                        {vp.notes && (
                          <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                            {vp.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                        {vp.diseaseTarget || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono-tabular text-slate-700 dark:text-slate-300">
                        {vp.dosage || '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingVacProgId(vp.id);
                              setVacProgForm({
                                pigCategory: vp.pigCategory,
                                weekNumber: vp.weekNumber,
                                vaccineName: vp.vaccineName,
                                diseaseTarget: vp.diseaseTarget || '',
                                dosage: vp.dosage || '',
                                notes: vp.notes || '',
                              });
                            }}
                            className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-emerald-700"
                            title="Sửa"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {isManagerOrAdmin && (
                            <button
                              type="button"
                              onClick={() => void onDeleteSubDoc('vaccinationPrograms', vp.id)}
                              className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                {vaccinationPrograms.filter(
                  (p) => vacProgFilterCat === 'all' || p.pigCategory === vacProgFilterCat
                ).length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                      Chưa có chương trình tiêm phòng nào. Thêm mới ở trên hoặc bấm &ldquo;Nạp chương trình tiêm chuẩn&rdquo;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. APPEARANCE, FONTS, TEXT SIZE, PUSH & PWA */}
      {section === 'appearance' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold">Tùy chỉnh phông chữ, kích thước văn bản & Chế độ tối</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cài đặt được lưu tự động trên thiết bị để tối ưu đọc ngoài chuồng trại hoặc ban đêm.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Chế độ hiển thị</div>
              <button
                type="button"
                onClick={onToggleTheme}
                className="w-full min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm font-medium"
              >
                <span>{theme === 'dark' ? 'Chế độ tối (Dark Mode)' : 'Chế độ sáng (Light Mode)'}</span>
                <span className="text-emerald-700 dark:text-emerald-400">Đổi</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Phông chữ</div>
              <select
                value={font}
                onChange={(e) => onFontChange(e.target.value as FontOption)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              >
                <option value="jakarta">Plus Jakarta Sans (Mặc định)</option>
                <option value="vietnam">Be Vietnam Pro (Rõ nét)</option>
                <option value="manrope">Manrope (Hiện đại)</option>
                <option value="lora">Lora (Chữ có chân)</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Kích thước chữ</div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'sm', label: 'Nhỏ' },
                  { id: 'md', label: 'Vừa' },
                  { id: 'lg', label: 'Lớn' },
                  { id: 'xl', label: 'Rất lớn' },
                ].map((sz) => (
                  <button
                    key={sz.id}
                    type="button"
                    onClick={() => onFontScaleChange(sz.id as FontScaleOption)}
                    className={`min-h-[44px] rounded-xl text-xs font-medium border transition-colors ${
                      fontScale === sz.id
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Thông báo đẩy nhắc lịch chăm sóc định kỳ</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Trạng thái quyền trình duyệt: {pushPermission === 'granted' ? 'Đã cấp quyền' : pushPermission}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {pushPermission !== 'granted' ? (
                <button
                  type="button"
                  onClick={() => void onRequestPush()}
                  className="min-h-[42px] px-4 rounded-xl bg-emerald-700 text-white text-xs font-medium"
                >
                  Cấp quyền thông báo
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onTogglePush(!pushEnabled)}
                    className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  >
                    {pushEnabled ? 'Đang bật nhắc tự động' : 'Đang tắt nhắc tự động'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onTriggerPushCheck()}
                    className="inline-flex items-center gap-1.5 min-h-[42px] px-4 rounded-xl bg-emerald-700 text-white text-xs font-medium"
                  >
                    <BellRing className="w-3.5 h-3.5" />
                    <span>Kiểm tra thông báo</span>
                  </button>
                </>
              )}
              <PWAInstallButton />
            </div>
          </div>
        </div>
      )}

      {/* 8. CLOUD BACKUP & RESET DATABASE */}
      {section === 'backup' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Sao lưu đám mây tự động mỗi ngày</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Lần sao lưu gần nhất: {farm.lastBackupDate ? formatDateVi(farm.lastBackupDate) : 'Chưa có'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    void onManualBackup().then(() => flashNotice('Đã tạo bản sao lưu đám mây mới.'))
                  }
                  className="inline-flex items-center gap-2 min-h-[42px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium"
                >
                  <CloudUpload className="w-4 h-4" />
                  <span>Sao lưu lên đám mây ngay</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadJsonBackup}
                  className="inline-flex items-center gap-2 min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải file sao lưu (.JSON)</span>
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-2">
              {backups.length === 0 ? (
                <p className="py-4 text-xs text-slate-500">Chưa có bản sao lưu nào trên đám mây.</p>
              ) : (
                [...backups]
                  .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
                  .slice(0, 10)
                  .map((bk) => (
                    <div key={bk.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold font-mono-tabular">{formatDateVi(bk.dateKey)}</span>
                        <span className="text-slate-500 ml-2">
                          ({bk.backupType === 'auto_daily' ? 'Tự động hàng ngày' : 'Thủ công'})
                        </span>
                      </div>
                      <div className="text-slate-500 font-mono-tabular">
                        {bk.summaryCounts?.sows || 0} nái · {bk.summaryCounts?.pigGroups || 0} lô · {bk.summaryCounts?.transactions || 0} GD
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Sample Data + Reset Database */}
          <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 p-6 space-y-4">
            <h2 className="text-base font-semibold text-red-700 dark:text-red-400">
              Dữ liệu mẫu & Đặt lại cơ sở dữ liệu (Reset)
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Nếu bạn muốn làm sạch toàn bộ dữ liệu hiện tại để nhập thông tin cho một trang trại mới, sử dụng nút Đặt lại cơ sở dữ liệu. Hành động này không thể hoàn tác.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  void onLoadSampleData().then(() => flashNotice('Đã nạp thêm dữ liệu mẫu trang trại.'))
                }
                className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Database className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>Nạp dữ liệu mẫu tham khảo</span>
              </button>

              {isManagerOrAdmin && (
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Xóa dữ liệu & Reset Database</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reset Database Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={(e) => void handleConfirmReset(e)}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
              Xác nhận xóa toàn bộ dữ liệu trang trại
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Toàn bộ heo nái, lô heo thịt, lịch sử tiêm phòng, kho vật tư, giao dịch thu chi và cài đặt chuồng/giống sẽ bị xóa để bạn nhập cho trang trại mới.
            </p>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Nhập chính xác cụm từ <strong>XOA DU LIEU</strong> để xác nhận:
              </span>
              <input
                required
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="XOA DU LIEU"
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent font-mono-tabular"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(false);
                  setResetConfirmText('');
                }}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={busy || resetConfirmText.trim().toUpperCase() !== 'XOA DU LIEU'}
                className="min-h-[44px] px-5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium"
              >
                {busy ? 'Đang xóa...' : 'Xác nhận Reset'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
