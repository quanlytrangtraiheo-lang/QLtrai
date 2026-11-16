import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpDown,
  Baby,
  Calendar,
  CalendarCheck,
  Check,
  Clock,
  Filter,
  HeartHandshake,
  RotateCcw,
  SearchCheck,
  Sprout,
  Syringe,
  XCircle,
} from 'lucide-react';
import {
  addDays,
  formatDateVi,
  formatNumber,
  SOW_EVENT_LABELS,
  SOW_STATUS_LABELS,
  todayIso,
} from '../utils/farmCalculations';
import type { Sow, SowEvent, SowEventType } from '../types';

interface SowTimelineProps {
  sows: Sow[];
  selectedSowId: string;
  onSelectSow: (sowId: string) => void;
  sowEvents: SowEvent[];
  onCompleteEvent: (ev: SowEvent) => void;
  onRecordBreeding: (sow: Sow) => void;
}

const EVENT_ICON_MAP: Record<SowEventType, React.ComponentType<{ className?: string }>> = {
  breeding: HeartHandshake,
  pregnancy_check: SearchCheck,
  farrowing: Baby,
  weaning: Sprout,
  next_breeding: CalendarCheck,
  vaccination: Syringe,
  health_check: Activity,
};

type EventTypeFilter = 'all' | SowEventType;
type StatusFilter = 'all' | 'completed' | 'pending';

const EVENT_TYPE_FILTER_OPTIONS: { id: EventTypeFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả loại' },
  { id: 'breeding', label: 'Phối giống' },
  { id: 'farrowing', label: 'Đẻ con' },
  { id: 'weaning', label: 'Cai sữa' },
  { id: 'pregnancy_check', label: 'Kiểm tra thai' },
  { id: 'next_breeding', label: 'Phối lần tiếp' },
];

export const SowTimeline: React.FC<SowTimelineProps> = ({
  sows,
  selectedSowId,
  onSelectSow,
  sowEvents,
  onCompleteEvent,
  onRecordBreeding,
}) => {
  const [eventTypeFilter, setEventTypeFilter] = useState<EventTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const selectedSow = useMemo(
    () => sows.find((s) => s.id === selectedSowId) || sows[0] || null,
    [sows, selectedSowId]
  );

  const sowSpecificEvents = useMemo(() => {
    if (!selectedSow) return [];
    return sowEvents.filter((ev) => ev.sowId === selectedSow.id);
  }, [selectedSow, sowEvents]);

  const eventTypeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: sowSpecificEvents.length };
    for (const ev of sowSpecificEvents) {
      counts[ev.eventType] = (counts[ev.eventType] || 0) + 1;
    }
    return counts;
  }, [sowSpecificEvents]);

  const timelineEvents = useMemo(() => {
    if (!selectedSow) return [];
    const today = todayIso();
    return sowSpecificEvents
      .filter((ev) => {
        if (eventTypeFilter !== 'all' && ev.eventType !== eventTypeFilter) {
          return false;
        }
        if (statusFilter === 'completed' && ev.status !== 'completed') return false;
        if (statusFilter === 'pending' && ev.status !== 'pending') return false;

        const effectiveDate = ev.actualDate || ev.scheduledDate || '';
        if (dateFrom && effectiveDate && effectiveDate < dateFrom) return false;
        if (dateTo && effectiveDate && effectiveDate > dateTo) return false;
        if ((dateFrom || dateTo) && !effectiveDate) return false;

        return true;
      })
      .sort((a, b) => {
        const da = a.actualDate || a.scheduledDate || '';
        const db = b.actualDate || b.scheduledDate || '';
        const cmp = da.localeCompare(db);
        if (cmp !== 0) return sortOrder === 'asc' ? cmp : -cmp;
        return sortOrder === 'asc'
          ? a.eventType.localeCompare(b.eventType)
          : b.eventType.localeCompare(a.eventType);
      })
      .map((ev) => {
        const effectiveDate = ev.actualDate || ev.scheduledDate;
        const isOverdue = ev.status === 'pending' && ev.scheduledDate < today;
        const isToday = ev.status === 'pending' && ev.scheduledDate === today;
        return { ev, effectiveDate, isOverdue, isToday };
      });
  }, [selectedSow, sowSpecificEvents, eventTypeFilter, statusFilter, dateFrom, dateTo, sortOrder]);

  if (!selectedSow) return null;

  const today = todayIso();
  const preset30From = addDays(today, -30);
  const preset90From = addDays(today, -90);
  const is30DaysActive = dateFrom === preset30From && dateTo === today;
  const is90DaysActive = dateFrom === preset90From && dateTo === today;

  const hasActiveFilters =
    eventTypeFilter !== 'all' || statusFilter !== 'all' || dateFrom !== '' || dateTo !== '';

  const resetFilters = () => {
    setEventTypeFilter('all');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const completedCount = sowSpecificEvents.filter((e) => e.status === 'completed').length;
  const pendingCount = sowSpecificEvents.filter((e) => e.status === 'pending').length;

  return (
    <section
      id="sow-timeline-panel"
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5"
    >
      {/* Header & Sow Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Dòng thời gian sinh sản cá thể · Lứa {selectedSow.parity} · {SOW_STATUS_LABELS[selectedSow.status]}
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
            Lịch sử sự kiện nái{' '}
            <span className="font-mono-tabular text-emerald-700 dark:text-emerald-400">
              {selectedSow.earTag}
            </span>
            {selectedSow.name ? (
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-2">
                ({selectedSow.name})
              </span>
            ) : null}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Chọn cá thể heo nái xem dòng thời gian"
            value={selectedSow.id}
            onChange={(e) => onSelectSow(e.target.value)}
            className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium"
          >
            {sows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.earTag} {s.name ? `— ${s.name}` : ''} (Lứa {s.parity})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => onRecordBreeding(selectedSow)}
            className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-medium whitespace-nowrap"
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Phối giống mới</span>
          </button>
        </div>
      </div>

      {/* Filter & Date Range Bar */}
      <div
        aria-label="Thanh bộ lọc dòng thời gian"
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 space-y-3"
      >
        {/* Row 1: Event Type Filter Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 mr-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Loại sự kiện:</span>
            </span>

            {EVENT_TYPE_FILTER_OPTIONS.map((opt) => {
              const count = eventTypeCounts[opt.id] || 0;
              const isActive = eventTypeFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setEventTypeFilter(opt.id)}
                  aria-pressed={isActive}
                  className={`inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap border ${
                    isActive
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span
                    className={`font-mono-tabular text-[11px] ${
                      isActive ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    ({count})
                  </span>
                </button>
              );
            })}

            {(eventTypeCounts.vaccination || 0) > 0 && (
              <button
                type="button"
                onClick={() => setEventTypeFilter('vaccination')}
                aria-pressed={eventTypeFilter === 'vaccination'}
                className={`inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap border ${
                  eventTypeFilter === 'vaccination'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>Tiêm phòng</span>
                <span className="font-mono-tabular text-[11px] opacity-75">
                  ({eventTypeCounts.vaccination})
                </span>
              </button>
            )}

            {(eventTypeCounts.health_check || 0) > 0 && (
              <button
                type="button"
                onClick={() => setEventTypeFilter('health_check')}
                aria-pressed={eventTypeFilter === 'health_check'}
                className={`inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap border ${
                  eventTypeFilter === 'health_check'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>Kiểm tra sức khỏe</span>
                <span className="font-mono-tabular text-[11px] opacity-75">
                  ({eventTypeCounts.health_check})
                </span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <select
              aria-label="Lọc theo trạng thái sự kiện"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="all">Mọi trạng thái ({completedCount + pendingCount})</option>
              <option value="completed">Đã thực hiện ({completedCount})</option>
              <option value="pending">Dự kiến ({pendingCount})</option>
            </select>

            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>{sortOrder === 'asc' ? 'Cũ → Mới' : 'Mới → Cũ'}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Date Range Filter & Quick Presets */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-700/70">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 mr-0.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Khoảng thời gian:</span>
            </span>

            <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>Từ</span>
              <input
                type="date"
                aria-label="Lọc từ ngày"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
                className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono-tabular text-slate-800 dark:text-slate-100"
              />
            </label>

            <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>Đến</span>
              <input
                type="date"
                aria-label="Lọc đến ngày"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono-tabular text-slate-800 dark:text-slate-100"
              />
            </label>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setDateFrom(preset30From);
                  setDateTo(today);
                }}
                aria-pressed={is30DaysActive}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${
                  is30DaysActive
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                30 ngày qua
              </button>

              <button
                type="button"
                onClick={() => {
                  setDateFrom(preset90From);
                  setDateTo(today);
                }}
                aria-pressed={is90DaysActive}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${
                  is90DaysActive
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                90 ngày qua
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
              Hiển thị <strong className="text-slate-700 dark:text-slate-200">{timelineEvents.length}</strong> /{' '}
              {sowSpecificEvents.length} sự kiện
            </span>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium text-red-700 dark:text-red-400 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xóa bộ lọc</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chronological Timeline List */}
      {timelineEvents.length === 0 ? (
        <div className="py-8 px-4 text-center space-y-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Không có sự kiện nào phù hợp với bộ lọc hiện tại cho nái {selectedSow.earTag}.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại bộ lọc</span>
            </button>
          )}
        </div>
      ) : (
        <ol className="relative space-y-0">
          {timelineEvents.map(({ ev, effectiveDate, isOverdue, isToday }, idx) => {
            const Icon = EVENT_ICON_MAP[ev.eventType] || CalendarCheck;
            const isLast = idx === timelineEvents.length - 1;
            const isCompleted = ev.status === 'completed';
            const isCancelled = ev.status === 'cancelled';

            const nodeStyles = isCompleted
              ? 'bg-emerald-700 text-white border-emerald-700'
              : isCancelled
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
              : isOverdue
              ? 'bg-red-600 text-white border-red-600'
              : isToday
              ? 'bg-amber-500 text-white border-amber-500'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600';

            return (
              <li key={ev.id} className="relative flex gap-4 pb-6 last:pb-1">
                {/* Vertical connector line */}
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[17px] top-9 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-800"
                  />
                )}

                {/* Node Icon */}
                <div
                  className={`relative z-10 mt-0.5 w-9 h-9 rounded-full border flex items-center justify-center shrink-0 ${nodeStyles}`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {/* Event Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono-tabular font-semibold text-slate-700 dark:text-slate-300">
                          {formatDateVi(effectiveDate)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-semibold ${
                            isCompleted
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : isCancelled
                              ? 'text-slate-400 line-through'
                              : isOverdue
                              ? 'text-red-600 dark:text-red-400'
                              : isToday
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-sky-700 dark:text-sky-400'
                          }`}
                        >
                          {isCompleted
                            ? 'Đã thực hiện'
                            : isCancelled
                            ? 'Đã hủy'
                            : isOverdue
                            ? 'Quá hạn'
                            : isToday
                            ? 'Đến hạn hôm nay'
                            : 'Dự kiến'}
                        </span>
                        {ev.autoGenerated && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Tự động lập lịch</span>
                          </>
                        )}
                      </div>

                      <h3
                        className={`text-sm sm:text-base font-semibold mt-0.5 ${
                          isCancelled
                            ? 'text-slate-400 line-through'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {SOW_EVENT_LABELS[ev.eventType]}
                      </h3>
                    </div>

                    {ev.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => onCompleteEvent(ev)}
                        className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium whitespace-nowrap self-start sm:self-auto shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Xác nhận hoàn thành</span>
                      </button>
                    )}

                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 shrink-0">
                        <Check className="w-3.5 h-3.5" />
                        <span>Hoàn tất</span>
                      </span>
                    )}

                    {isCancelled && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400 shrink-0">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Đã thay thế</span>
                      </span>
                    )}
                  </div>

                  {/* Structured Outcome Metadata (unboxed inline details) */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                    {ev.actualDate && ev.actualDate !== ev.scheduledDate && (
                      <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 font-mono-tabular">
                        <Clock className="w-3 h-3" />
                        Dự kiến ban đầu: {formatDateVi(ev.scheduledDate)}
                      </span>
                    )}
                    {ev.boarTag && (
                      <span>
                        Đực giống: <strong className="font-mono-tabular">{ev.boarTag}</strong>
                      </span>
                    )}
                    {ev.liveBorn !== undefined && (
                      <span className="font-mono-tabular">
                        Sống: <strong>{formatNumber(ev.liveBorn)}</strong> con
                        {ev.stillborn ? ` · Chết lưu: ${formatNumber(ev.stillborn)} con` : ''}
                      </span>
                    )}
                    {ev.weanedCount !== undefined && (
                      <span className="font-mono-tabular">
                        Cai sữa: <strong>{formatNumber(ev.weanedCount)}</strong> con
                        {ev.avgWeightKg
                          ? ` · TB ${formatNumber(ev.avgWeightKg, 1)} kg/con`
                          : ''}
                      </span>
                    )}
                  </div>

                  {ev.notes && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {ev.notes}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};
