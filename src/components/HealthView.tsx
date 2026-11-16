import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  CheckCircle2,
  Plus,
  Syringe,
  Trash2,
} from 'lucide-react';
import {
  buildVaccinationRecommendations,
  formatDateVi,
  formatVND,
  makeId,
  RATION_CATEGORY_LABELS,
  todayIso,
} from '../utils/farmCalculations';
import type {
  HealthLog,
  HealthLogStatus,
  HealthLogType,
  PigGroup,
  SeverityLevel,
  Sow,
  StaffRole,
  VaccinationProgram,
  Vaccine,
} from '../types';

interface HealthViewProps {
  role: StaffRole;
  sows: Sow[];
  pigGroups: PigGroup[];
  vaccines: Vaccine[];
  vaccinationPrograms: VaccinationProgram[];
  healthLogs: HealthLog[];
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
}

export const HealthView: React.FC<HealthViewProps> = ({
  role,
  sows,
  pigGroups,
  vaccines,
  vaccinationPrograms,
  healthLogs,
  onSaveSubDoc,
  onSaveBatchSubDocs,
  onDeleteSubDoc,
}) => {
  const [filterType, setFilterType] = useState<'all' | HealthLogType>('all');
  const [showModal, setShowModal] = useState(false);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [progTargetFilter, setProgTargetFilter] = useState<'all' | 'sow' | 'group'>('all');
  const [selectedRecKeys, setSelectedRecKeys] = useState<string[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState('');

  const [form, setForm] = useState({
    targetType: (sows.length > 0 ? 'sow' : 'group') as 'sow' | 'group',
    targetId: sows[0]?.id || pigGroups[0]?.id || '',
    logType: 'vaccination' as HealthLogType,
    title: '',
    vaccineName: vaccines[0]?.name || vaccinationPrograms[0]?.vaccineName || '',
    symptoms: '',
    severity: 'normal' as SeverityLevel,
    medicineUsed: '',
    dosage: '',
    cost: 0,
    date: todayIso(),
    nextDueDate: '',
    status: 'scheduled' as HealthLogStatus,
    notes: '',
  });

  const recommendations = useMemo(
    () => buildVaccinationRecommendations(sows, pigGroups, vaccinationPrograms, healthLogs),
    [sows, pigGroups, vaccinationPrograms, healthLogs]
  );

  const visibleRecommendations = useMemo(
    () =>
      recommendations.filter((r) => progTargetFilter === 'all' || r.targetType === progTargetFilter),
    [recommendations, progTargetFilter]
  );

  const canDelete = role === 'admin' || role === 'manager' || role === 'vet';

  const targetOptions = useMemo(() => {
    if (form.targetType === 'sow') {
      return sows.map((s) => ({ id: s.id, label: `Nái ${s.earTag}` }));
    }
    return pigGroups.map((g) => ({ id: g.id, label: g.name }));
  }, [form.targetType, sows, pigGroups]);

  const filteredLogs = useMemo(() => {
    return [...healthLogs]
      .filter((l) => filterType === 'all' || l.logType === filterType)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [healthLogs, filterType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetMatch = targetOptions.find((t) => t.id === form.targetId) || targetOptions[0];
    if (!targetMatch) return;
    const id = makeId('hl');
    await onSaveSubDoc('healthLogs', id, {
      targetType: form.targetType,
      targetId: targetMatch.id,
      targetLabel: targetMatch.label,
      logType: form.logType,
      title:
        form.title.trim() ||
        (form.logType === 'vaccination'
          ? `Tiêm phòng ${form.vaccineName || 'định kỳ'}`
          : 'Ghi nhận dấu hiệu bệnh lý'),
      vaccineName: form.vaccineName || undefined,
      symptoms: form.symptoms || undefined,
      severity: form.severity,
      medicineUsed: form.medicineUsed || undefined,
      dosage: form.dosage || undefined,
      cost: Number(form.cost) || 0,
      date: form.date,
      nextDueDate: form.nextDueDate || undefined,
      status: form.status,
      notes: form.notes || undefined,
    });

    // If abnormal symptom is warning/critical, update target healthStatus automatically
    if (form.logType === 'symptom' && form.severity !== 'normal') {
      const targetCol = form.targetType === 'sow' ? 'sows' : 'pigGroups';
      await onSaveSubDoc(
        targetCol,
        targetMatch.id,
        { healthStatus: form.severity === 'critical' ? 'sick' : 'monitoring' },
        true
      );
    }

    setShowModal(false);
    setForm({ ...form, title: '', symptoms: '', medicineUsed: '', dosage: '', notes: '' });
  };

  const handleMarkDone = async (log: HealthLog) => {
    const nextStatus: HealthLogStatus = log.logType === 'symptom' ? 'resolved' : 'completed';
    await onSaveSubDoc('healthLogs', log.id, { status: nextStatus }, true);
    if (log.logType === 'symptom') {
      const targetCol = log.targetType === 'sow' ? 'sows' : 'pigGroups';
      await onSaveSubDoc(targetCol, log.targetId, { healthStatus: 'healthy' }, true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 self-start">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'vaccination', label: 'Lịch tiêm phòng' },
            { id: 'symptom', label: 'Dấu hiệu bệnh lý' },
            { id: 'treatment', label: 'Điều trị' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id as typeof filterType)}
              className={`min-h-[38px] px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                filterType === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setSelectedRecKeys(recommendations.map((r) => r.key));
              setShowProgramModal(true);
            }}
            disabled={sows.length === 0 && pigGroups.length === 0}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>
              Lập lịch từ chương trình tiêm
              {recommendations.length > 0 ? ` (${recommendations.length})` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedProgramId('');
              setForm((prev) => ({
                ...prev,
                targetType: sows.length > 0 ? 'sow' : 'group',
                targetId: sows[0]?.id || pigGroups[0]?.id || '',
              }));
              setShowModal(true);
            }}
            disabled={sows.length === 0 && pigGroups.length === 0}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-medium whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Ghi lịch tiêm / Bệnh lý</span>
          </button>
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200">
            Có <strong className="font-mono-tabular text-emerald-700 dark:text-emerald-400">{recommendations.length}</strong> mũi tiêm đề xuất theo Chương trình tiêm phòng cho các nhóm heo nái và heo thịt chưa được lên lịch.
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedRecKeys(recommendations.map((r) => r.key));
              setShowProgramModal(true);
            }}
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium whitespace-nowrap self-start sm:self-auto"
          >
            Xem &amp; Lên lịch hàng loạt
          </button>
        </div>
      )}

      {/* Health & Vaccination Feed */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
        {filteredLogs.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Chưa có hồ sơ tiêm phòng hoặc ghi chú bệnh lý nào. Hãy thêm heo nái hoặc lô heo trước khi lập lịch thú y.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                    {log.logType === 'vaccination' ? (
                      <Syringe className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    ) : log.severity !== 'normal' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    ) : null}
                    {log.targetLabel}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">{formatDateVi(log.date)}</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`font-semibold ${
                      log.status === 'completed' || log.status === 'resolved'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : log.severity === 'critical'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {log.status === 'scheduled'
                      ? 'Chờ thực hiện'
                      : log.status === 'monitoring'
                      ? 'Đang theo dõi bệnh lý'
                      : log.status === 'resolved'
                      ? 'Đã khỏi / Khép lại'
                      : 'Đã hoàn thành'}
                  </span>
                </div>

                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {log.title}
                </h3>

                {log.symptoms && (
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    Dấu hiệu bất thường: {log.symptoms}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  {log.vaccineName && <span>Vắc xin: {log.vaccineName}</span>}
                  {log.medicineUsed && <span>Thuốc: {log.medicineUsed}</span>}
                  {log.dosage && <span>Liều dùng: {log.dosage}</span>}
                  {log.cost ? (
                    <span className="font-mono-tabular">Chi phí: {formatVND(log.cost)}</span>
                  ) : null}
                  {log.nextDueDate && (
                    <span className="font-mono-tabular">
                      Nhắc lại: {formatDateVi(log.nextDueDate)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {(log.status === 'scheduled' || log.status === 'monitoring') && (
                  <button
                    type="button"
                    onClick={() => void handleMarkDone(log)}
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{log.logType === 'symptom' ? 'Đánh dấu đã khỏi' : 'Đã tiêm xong'}</span>
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => void onDeleteSubDoc('healthLogs', log.id)}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600"
                    title="Xóa hồ sơ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Health / Vaccination Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-semibold">Ghi lịch tiêm phòng / Theo dõi bệnh lý</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Loại ghi nhận</span>
                <select
                  value={form.logType}
                  onChange={(e) => {
                    const nextType = e.target.value as HealthLogType;
                    setForm({
                      ...form,
                      logType: nextType,
                      status: nextType === 'symptom' ? 'monitoring' : 'scheduled',
                      severity: nextType === 'symptom' ? 'warning' : 'normal',
                    });
                  }}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="vaccination">Lịch tiêm phòng vắc xin</option>
                  <option value="symptom">Ghi chú dấu hiệu bệnh lý bất thường</option>
                  <option value="treatment">Phác đồ điều trị</option>
                  <option value="checkup">Khám sức khỏe định kỳ</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Đối tượng</span>
                <select
                  value={form.targetType}
                  onChange={(e) => {
                    const tt = e.target.value as 'sow' | 'group';
                    const firstId = tt === 'sow' ? sows[0]?.id || '' : pigGroups[0]?.id || '';
                    setForm({ ...form, targetType: tt, targetId: firstId });
                  }}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="sow">Cá thể heo nái</option>
                  <option value="group">Nhóm heo nuôi thịt</option>
                </select>
              </label>

              <label className="col-span-full space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Chọn heo nái / lô heo</span>
                <select
                  value={form.targetId}
                  onChange={(e) => setForm({ ...form, targetId: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  {targetOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="col-span-full space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Tiêu đề sự kiện</span>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={
                    form.logType === 'vaccination'
                      ? 'VD: Tiêm phòng Dịch tả heo mũi 2'
                      : 'VD: Sốt cao, bỏ ăn, ho khan'
                  }
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>

              {form.logType === 'vaccination' && (
                <>
                  {vaccinationPrograms.length > 0 && (
                    <label className="col-span-full space-y-1">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Chọn nhanh từ Chương trình tiêm phòng (tùy chọn)
                      </span>
                      <select
                        value={selectedProgramId}
                        onChange={(e) => {
                          const pid = e.target.value;
                          setSelectedProgramId(pid);
                          const prog = vaccinationPrograms.find((p) => p.id === pid);
                          if (prog) {
                            setForm((prev) => ({
                              ...prev,
                              vaccineName: prog.vaccineName,
                              dosage: prog.dosage || prev.dosage,
                              medicineUsed: prog.dosage || prev.medicineUsed,
                              title: `Tiêm phòng ${prog.vaccineName} (${
                                prog.pigCategory === 'sow_waiting'
                                  ? 'Trước phối'
                                  : `Tuần ${prog.weekNumber}`
                              })`,
                              notes: prog.notes || prev.notes,
                            }));
                          }
                        }}
                        className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      >
                        <option value="">-- Tự nhập hoặc chọn mũi từ chương trình --</option>
                        {vaccinationPrograms
                          .slice()
                          .sort((a, b) =>
                            a.pigCategory.localeCompare(b.pigCategory) || a.weekNumber - b.weekNumber
                          )
                          .map((vp) => (
                            <option key={vp.id} value={vp.id}>
                              {RATION_CATEGORY_LABELS[vp.pigCategory]} ·{' '}
                              {vp.pigCategory === 'sow_waiting'
                                ? 'Trước phối'
                                : `Tuần ${vp.weekNumber}`}{' '}
                              — {vp.vaccineName}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}

                  <label className="space-y-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Tên vắc xin</span>
                    <input
                      value={form.vaccineName}
                      onChange={(e) => setForm({ ...form, vaccineName: e.target.value })}
                      placeholder="VD: PRRS / CSF / FMD"
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                    />
                  </label>
                </>
              )}

              {form.logType === 'symptom' && (
                <>
                  <label className="col-span-full space-y-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Mô tả dấu hiệu bệnh lý bất thường</span>
                    <textarea
                      rows={2}
                      value={form.symptoms}
                      onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
                      placeholder="VD: Thân nhiệt 40.5°C, bỏ ăn, tiêu chảy phân trắng..."
                      className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Mức độ cảnh báo</span>
                    <select
                      value={form.severity}
                      onChange={(e) =>
                        setForm({ ...form, severity: e.target.value as SeverityLevel })
                      }
                      className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      <option value="normal">Bình thường</option>
                      <option value="warning">Cần theo dõi</option>
                      <option value="critical">Khẩn cấp / Nguy cơ lây lan</option>
                    </select>
                  </label>
                </>
              )}

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Thuốc / Liều dùng</span>
                <input
                  value={form.medicineUsed}
                  onChange={(e) => setForm({ ...form, medicineUsed: e.target.value })}
                  placeholder="VD: Amoxicillin 2ml"
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ngày thực hiện / Dự kiến</span>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ngày nhắc lại (nếu có)</span>
                <input
                  type="date"
                  value={form.nextDueDate}
                  onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Chi phí (VND)</span>
                <input
                  type="number"
                  min={0}
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800"
              >
                Lưu hồ sơ thú y
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Schedule from Vaccination Program Modal */}
      {showProgramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Lên lịch tiêm theo Chương trình tiêm phòng
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tự động tính ngày tiêm dự kiến theo tuần tuổi của lô heo thịt và tuần thai / nuôi con / chờ phối của đàn nái.
                </p>
              </div>
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start">
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'sow', label: 'Nhóm heo nái' },
                  { id: 'group', label: 'Nhóm heo thịt' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setProgTargetFilter(t.id as typeof progTargetFilter)}
                    className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${
                      progTargetFilter === t.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {vaccinationPrograms.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                Chưa có Chương trình tiêm phòng nào trong Cài đặt hệ thống. Vào Cài đặt → Chương trình tiêm phòng để thiết lập hoặc nạp mẫu chuẩn.
              </div>
            ) : visibleRecommendations.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                Tất cả các mũi tiêm đến hạn trong thời gian tới cho nhóm đối tượng này đã được lên lịch.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                {visibleRecommendations.map((rec) => {
                  const checked = selectedRecKeys.includes(rec.key);
                  return (
                    <label
                      key={rec.key}
                      className="flex items-start gap-3 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedRecKeys((prev) =>
                            e.target.checked
                              ? [...prev, rec.key]
                              : prev.filter((k) => k !== rec.key)
                          );
                        }}
                        className="mt-1 w-4 h-4 accent-emerald-700"
                      />
                      <div className="flex-1 min-w-0 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {rec.targetLabel} · {rec.vaccineName}
                          </span>
                          <span
                            className={`text-xs font-mono-tabular font-semibold ${
                              rec.deltaDays < 0
                                ? 'text-red-600 dark:text-red-400'
                                : rec.deltaDays === 0
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {formatDateVi(rec.scheduledDate)} (
                            {rec.deltaDays < 0
                              ? `Trễ ${Math.abs(rec.deltaDays)} ngày`
                              : rec.deltaDays === 0
                              ? 'Hôm nay'
                              : `Còn ${rec.deltaDays} ngày`}
                            )
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {RATION_CATEGORY_LABELS[rec.pigCategory]} ·{' '}
                          {rec.pigCategory === 'sow_waiting'
                            ? 'Trước phối'
                            : `Tuần ${rec.weekNumber}`}
                          {rec.dosage ? ` · Liều: ${rec.dosage}` : ''}
                          {rec.diseaseTarget ? ` · Phòng: ${rec.diseaseTarget}` : ''}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {visibleRecommendations.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    const visKeys = visibleRecommendations.map((r) => r.key);
                    const allSelected = visKeys.every((k) => selectedRecKeys.includes(k));
                    setSelectedRecKeys((prev) =>
                      allSelected
                        ? prev.filter((k) => !visKeys.includes(k))
                        : Array.from(new Set([...prev, ...visKeys]))
                    );
                  }}
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  {visibleRecommendations.every((r) => selectedRecKeys.includes(r.key))
                    ? 'Bỏ chọn tất cả mục đang hiển thị'
                    : 'Chọn tất cả mục đang hiển thị'}
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowProgramModal(false)}
                  className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
                >
                  Đóng
                </button>
                {visibleRecommendations.length > 0 && (
                  <button
                    type="button"
                    disabled={batchBusy || selectedRecKeys.length === 0}
                    onClick={async () => {
                      const chosen = recommendations.filter((r) => selectedRecKeys.includes(r.key));
                      if (chosen.length === 0) return;
                      setBatchBusy(true);
                      try {
                        await onSaveBatchSubDocs(
                          'healthLogs',
                          chosen.map((rec) => ({
                            id: makeId('hl'),
                            payload: {
                              targetType: rec.targetType,
                              targetId: rec.targetId,
                              targetLabel: rec.targetLabel,
                              logType: 'vaccination',
                              title: `Tiêm phòng ${rec.vaccineName} (${
                                rec.pigCategory === 'sow_waiting'
                                  ? 'Trước phối'
                                  : `Tuần ${rec.weekNumber}`
                              })`,
                              vaccineName: rec.vaccineName,
                              severity: 'normal',
                              dosage: rec.dosage || undefined,
                              cost: 0,
                              date: rec.scheduledDate,
                              status: 'scheduled',
                              notes:
                                rec.notes ||
                                (rec.diseaseTarget
                                  ? `Phòng bệnh: ${rec.diseaseTarget}`
                                  : 'Tạo tự động từ Chương trình tiêm phòng'),
                            },
                          }))
                        );
                        setShowProgramModal(false);
                      } finally {
                        setBatchBusy(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 min-h-[42px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-medium"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {batchBusy
                        ? 'Đang lên lịch...'
                        : `Tạo ${
                            recommendations.filter((r) => selectedRecKeys.includes(r.key)).length
                          } lịch tiêm`}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
