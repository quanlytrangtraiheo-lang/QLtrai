import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  BookOpen,
  Calculator,
  CheckCircle2,
  CloudRain,
  Database,
  Droplets,
  Keyboard,
  Mic,
  MicOff,
  PackageCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  TrendingUp,
  Utensils,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  compute30DayFinancialForecast,
  computeDailyFeedProjection,
  computeFatteningAgeForecast,
  computeSowGestationForecast,
  computeSucklingPigletForecast,
  formatDateVi,
  formatNumber,
  formatVND,
  makeId,
  todayIso,
} from '../utils/farmCalculations';
import type {
  AppTab,
  CareReminder,
  Farm,
  FeedRation,
  FeedType,
  FinancialTx,
  HealthLog,
  InventoryItem,
  JournalCategory,
  JournalEntry,
  PigGroup,
  PigLitter,
  SeverityLevel,
  Sow,
  StaffRole,
  VaccinationProgram,
} from '../types';

const FEED_SERIES_COLORS = [
  '#15803D',
  '#D97706',
  '#0284C7',
  '#7C3AED',
  '#DC2626',
  '#0D9488',
  '#CA8A04',
];

const JOURNAL_CATEGORY_META: Record<
  JournalCategory,
  { label: string; shortLabel: string }
> = {
  health: { label: 'Heo ốm / Bệnh lý', shortLabel: 'Sức khỏe' },
  weather: { label: 'Thay đổi thời tiết', shortLabel: 'Thời tiết' },
  feed: { label: 'Thức ăn / Nước uống', shortLabel: 'Thức ăn' },
  hygiene: { label: 'Vệ sinh / Sát trùng', shortLabel: 'Vệ sinh' },
  other: { label: 'Sự kiện khác', shortLabel: 'Khác' },
};

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface DashboardViewProps {
  farm: Farm;
  userUid: string;
  userName: string;
  role: StaffRole;
  sows: Sow[];
  pigLitters: PigLitter[];
  pigGroups: PigGroup[];
  feedTypes: FeedType[];
  feedRations: FeedRation[];
  vaccinationPrograms: VaccinationProgram[];
  healthLogs: HealthLog[];
  inventoryItems: InventoryItem[];
  transactions: FinancialTx[];
  journalEntries: JournalEntry[];
  reminders: CareReminder[];
  pushPermission: NotificationPermission;
  onRequestPush: () => Promise<unknown>;
  onNavigate: (tab: AppTab) => void;
  onLoadSampleData: () => Promise<void>;
  onSaveSubDoc: (
    colName: string,
    id: string,
    payload: Record<string, unknown>,
    isEdit?: boolean
  ) => Promise<void>;
  onDeleteSubDoc: (colName: string, id: string) => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  farm,
  userUid,
  userName,
  role,
  sows,
  pigLitters,
  pigGroups,
  feedTypes,
  feedRations,
  vaccinationPrograms,
  healthLogs,
  inventoryItems,
  transactions,
  journalEntries,
  reminders,
  pushPermission,
  onRequestPush,
  onNavigate,
  onLoadSampleData,
  onSaveSubDoc,
  onDeleteSubDoc,
}) => {
  const [seeding, setSeeding] = useState(false);
  const [feedTableMode, setFeedTableMode] = useState<'by_type_7d' | 'by_group_today'>('by_type_7d');
  const [forecastTab, setForecastTab] = useState<'feed' | 'vaccine'>('feed');

  // Farm Journal & Voice Dictation State
  const [journalCategory, setJournalCategory] = useState<JournalCategory>('health');
  const [journalSeverity, setJournalSeverity] = useState<SeverityLevel>('normal');
  const [journalContent, setJournalContent] = useState('');
  const [journalFilter, setJournalFilter] = useState<'all' | JournalCategory>('all');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [usedVoiceInput, setUsedVoiceInput] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [savingJournal, setSavingJournal] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore cleanup stop errors
      }
      recognitionRef.current = null;
    };
  }, []);

  const isEmptyFarm = sows.length === 0 && pigGroups.length === 0 && inventoryItems.length === 0;

  const activeFatteningHeads = useMemo(
    () =>
      pigGroups
        .filter((g) => g.status === 'active')
        .reduce((sum, g) => sum + (g.currentCount || 0), 0),
    [pigGroups]
  );

  const activeSowsCount = useMemo(
    () => sows.filter((s) => s.status !== 'culled' && s.status !== 'sold').length,
    [sows]
  );

  const activeSucklingHeads = useMemo(
    () =>
      pigLitters
        .filter((l) => l.status === 'suckling')
        .reduce((sum, l) => sum + (l.currentCount || 0), 0),
    [pigLitters]
  );

  const totalIncome = useMemo(
    () =>
      transactions
        .filter((t) => t.direction === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0),
    [transactions]
  );

  const totalExpense = useMemo(
    () =>
      transactions
        .filter((t) => t.direction === 'expense')
        .reduce((sum, t) => sum + (t.amount || 0), 0),
    [transactions]
  );

  const netProfit = totalIncome - totalExpense;

  const fatteningByWeek = useMemo(() => computeFatteningAgeForecast(pigGroups), [pigGroups]);
  const sowsByGestation = useMemo(() => computeSowGestationForecast(sows), [sows]);
  const sucklingForecast = useMemo(
    () => computeSucklingPigletForecast(pigLitters, sows, farm),
    [pigLitters, sows, farm]
  );
  const feedProjection = useMemo(
    () => computeDailyFeedProjection(sows, pigGroups, feedTypes, feedRations, farm),
    [sows, pigGroups, feedTypes, feedRations, farm]
  );
  const forecast30Day = useMemo(
    () =>
      compute30DayFinancialForecast(
        sows,
        pigGroups,
        feedTypes,
        feedRations,
        vaccinationPrograms,
        healthLogs,
        inventoryItems,
        farm
      ),
    [sows, pigGroups, feedTypes, feedRations, vaccinationPrograms, healthLogs, inventoryItems, farm]
  );

  const sortedJournalEntries = useMemo(() => {
    const filtered =
      journalFilter === 'all'
        ? journalEntries
        : journalEntries.filter((j) => j.category === journalFilter);
    return [...filtered].sort((a, b) => {
      const aKey = `${a.date}_${a.timeLabel || '00:00'}_${a.id}`;
      const bKey = `${b.date}_${b.timeLabel || '00:00'}_${b.id}`;
      return bKey.localeCompare(aKey);
    });
  }, [journalEntries, journalFilter]);

  const lowStockCount = useMemo(
    () => inventoryItems.filter((i) => i.quantity <= i.minThreshold).length,
    [inventoryItems]
  );

  const canDeleteAnyJournal = role === 'admin' || role === 'manager';

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await onLoadSampleData();
    } finally {
      setSeeding(false);
    }
  };

  const handleToggleVoice = () => {
    setVoiceNotice(null);

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore stop error
      }
      setIsListening(false);
      setInterimTranscript('');
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setVoiceNotice(
        'Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói. Bạn vẫn có thể nhập trực tiếp ghi chú bên dưới.'
      );
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = 'vi-VN';
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (event) => {
        let finalChunk = '';
        let interimChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) {
            finalChunk += text + ' ';
          } else {
            interimChunk += text;
          }
        }
        if (finalChunk.trim()) {
          setJournalContent((prev) => {
            const trimmedPrev = prev.trim();
            return trimmedPrev ? `${trimmedPrev} ${finalChunk.trim()}` : finalChunk.trim();
          });
          setUsedVoiceInput(true);
        }
        setInterimTranscript(interimChunk.trim());
      };

      rec.onerror = (event) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setVoiceNotice(
            'Chưa được cấp quyền micro. Vui lòng cho phép quyền Micro trong trình duyệt để dùng nhập liệu giọng nói.'
          );
        } else if (event.error === 'no-speech') {
          setVoiceNotice('Chưa nghe thấy giọng nói. Hãy thử nói lại gần micro hơn.');
        } else if (event.error !== 'aborted') {
          setVoiceNotice(`Không thể nhận diện giọng nói (${event.error}). Bạn có thể nhập tay trực tiếp.`);
        }
        setIsListening(false);
        setInterimTranscript('');
      };

      rec.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
    } catch {
      setVoiceNotice('Không khởi động được micro trên thiết bị này. Vui lòng nhập ghi chú bằng tay.');
      setIsListening(false);
    }
  };

  const handleSaveJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = `${journalContent} ${interimTranscript}`.trim();
    if (!cleanText) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    setSavingJournal(true);
    try {
      const now = new Date();
      const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;
      await onSaveSubDoc('journalEntries', makeId('jrn'), {
        date: todayIso(),
        timeLabel,
        category: journalCategory,
        severity: journalSeverity,
        inputMethod: usedVoiceInput ? 'voice' : 'text',
        content: cleanText.slice(0, 1000),
        authorName: userName.slice(0, 120),
      });
      setJournalContent('');
      setInterimTranscript('');
      setUsedVoiceInput(false);
      setVoiceNotice(null);
      setJournalSeverity('normal');
    } finally {
      setSavingJournal(false);
    }
  };

  const renderCategoryIcon = (cat: JournalCategory) => {
    switch (cat) {
      case 'health':
        return <Stethoscope className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />;
      case 'weather':
        return <CloudRain className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />;
      case 'feed':
        return <Utensils className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />;
      case 'hygiene':
        return <Droplets className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
      default:
        return <BookOpen className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Onboarding / Empty State for New Users */}
      {isEmptyFarm && (
        <section className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-white dark:bg-slate-900 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Chào mừng đến với trang trại mới của bạn
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
              Bạn có thể bắt đầu nhập đàn nái, lô heo thịt, kho cám ngay hoặc nạp bộ dữ liệu mẫu để xem trước toàn bộ biểu đồ dự báo và báo cáo tài chính.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => void handleSeed()}
              disabled={seeding}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition-colors whitespace-nowrap"
            >
              <Database className="w-4 h-4" />
              <span>{seeding ? 'Đang tạo dữ liệu...' : 'Nạp dữ liệu mẫu'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('herd')}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <span>Tự nhập đàn mới</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* Push Notification Opt-in Banner if not granted yet */}
      {pushPermission === 'default' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
            <BellRing className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span>
              Bật thông báo đẩy để nhận nhắc nhở tự động lịch phối giống, đẻ con, cai sữa và tiêm phòng định kỳ.
            </span>
          </div>
          <button
            type="button"
            onClick={() => void onRequestPush()}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium whitespace-nowrap shrink-0"
          >
            Cho phép thông báo
          </button>
        </div>
      )}

      {/* Top 4 KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Tổng đàn đang nuôi
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-mono-tabular">
            {formatNumber(activeFatteningHeads + activeSowsCount + activeSucklingHeads)} con
          </div>
          <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            {formatNumber(activeSowsCount)} nái · {formatNumber(activeSucklingHeads)} theo mẹ · {formatNumber(activeFatteningHeads)} heo thịt
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Cám dự kiến sử dụng / ngày
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-mono-tabular">
            {formatNumber(feedProjection.totalKgPerDay, 1)} kg
          </div>
          <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            Chi phí ước tính {formatVND(feedProjection.totalCostPerDay)} / ngày
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Lợi nhuận ròng lũy kế
          </div>
          <div
            className={`mt-2 text-2xl sm:text-3xl font-bold font-mono-tabular ${
              netProfit >= 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatVND(netProfit)}
          </div>
          <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            Thu {formatVND(totalIncome)} · Chi {formatVND(totalExpense)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Cảnh báo sức khỏe & Kho
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-mono-tabular">
            {formatNumber(reminders.length)} mục
          </div>
          <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            {lowStockCount} mặt hàng sắp hết · {reminders.filter((r) => r.urgency === 'overdue').length} quá hạn
          </div>
        </div>
      </section>

      {/* Forecast Grid: Fattening by Week of Age & Sows by Gestation Week */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Dự báo số lượng heo thịt theo tuần tuổi
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Phân bổ đàn đang nuôi theo giai đoạn sinh trưởng để chuẩn bị xuất chuồng
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('herd')}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0"
            >
              Xem lô thịt
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fatteningByWeek} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: any) => [`${value} con`, 'Số lượng']}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload;
                    return row ? `${label} (${row.stageName})` : String(label);
                  }}
                />
                <Bar dataKey="headCount" fill="#15803D" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Dự báo heo nái theo tuần mang thai
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Theo dõi số nái từ Tuần 1 đến Tuần 16+ (sắp đẻ) để bố trí ô chuồng đẻ
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('herd')}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0"
            >
              Quản lý nái
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sowsByGestation} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                <XAxis dataKey="weekLabel" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: any) => [`${value} nái`, 'Số lượng']}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload;
                    const tags = row?.earTags?.length ? ` · Tai: ${row.earTags.join(', ')}` : '';
                    return `${label}${tags}`;
                  }}
                />
                <Bar dataKey="sowCount" fill="#0284C7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Suckling Piglets Forecast (placed directly after Sow Gestation Forecast) */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Dự báo heo con theo mẹ
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Phân bổ heo con theo tuần tuổi, ổ sắp cai sữa và dự kiến số con sinh mới từ đàn nái mang thai trong 30 ngày tới
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('herd')}
            className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0"
          >
            Quản lý ổ theo mẹ →
          </button>
        </div>

        {/* 3 Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Đang theo mẹ hiện có</div>
            <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white font-mono-tabular">
              {formatNumber(sucklingForecast.totalSucklingHeads)} con
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular mt-0.5">
              {formatNumber(sucklingForecast.totalSucklingLitters)} ổ đang bú sữa
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Sắp cai sữa (≤ 7 ngày tới)</div>
            <div className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-400 font-mono-tabular">
              {formatNumber(sucklingForecast.weaningSoonHeads)} con
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular mt-0.5">
              {formatNumber(sucklingForecast.weaningSoonLitters)} ổ chuẩn bị chuyển chuồng
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Dự kiến đẻ mới (30 ngày tới)</div>
            <div className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono-tabular">
              +{formatNumber(sucklingForecast.expectedNewborn30dHeads)} con
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular mt-0.5">
              Từ {formatNumber(sucklingForecast.expectedFarrowingSows30d)} nái sắp sinh
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Age Week Distribution Chart */}
          <div className="lg:col-span-6 space-y-2">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Số heo con theo mẹ phân bổ theo tuần tuổi
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sucklingForecast.byAgeWeek}
                  margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: any) => [`${value} con`, 'Theo mẹ']}
                    labelFormatter={(label, payload) => {
                      const row = payload?.[0]?.payload;
                      if (!row) return String(label);
                      const tags = row.sowTags?.length ? ` · Nái: ${row.sowTags.join(', ')}` : '';
                      return `${label} (${row.stageName})${tags}`;
                    }}
                  />
                  <Bar dataKey="headCount" fill="#D97706" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Upcoming 30-day Weaning & Farrowing Timeline */}
          <div className="lg:col-span-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Biến động ổ theo mẹ 30 ngày tới (Đẻ mới & Cai sữa)
              </span>
              <span className="text-xs text-slate-400 font-mono-tabular">
                {sucklingForecast.upcomingTimeline.length} mốc
              </span>
            </div>

            {sucklingForecast.upcomingTimeline.length === 0 ? (
              <div className="h-56 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                Chưa có ổ sắp cai sữa hoặc nái sắp đẻ trong 30 ngày tới.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl max-h-56 overflow-y-auto">
                {sucklingForecast.upcomingTimeline.map((item, idx) => (
                  <div
                    key={`${item.type}_${item.sowEarTag}_${item.date}_${idx}`}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {item.type === 'weaning'
                          ? `Cai sữa ổ ${item.litterCode || item.sowEarTag}`
                          : `Nái ${item.sowEarTag} dự kiến đẻ`}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 font-mono-tabular mt-0.5">
                        {formatDateVi(item.date)}
                        {item.barnName ? ` · ${item.barnName}` : ''}
                        {' · '}
                        {item.deltaDays < 0
                          ? `Quá ${Math.abs(item.deltaDays)} ngày`
                          : item.deltaDays === 0
                          ? 'Hôm nay'
                          : `Còn ${item.deltaDays} ngày`}
                      </div>
                    </div>
                    <span
                      className={`font-mono-tabular font-semibold whitespace-nowrap shrink-0 ${
                        item.type === 'weaning'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {item.type === 'weaning'
                        ? `Cai sữa ${formatNumber(item.estimatedHeads)} con`
                        : `+${formatNumber(item.estimatedHeads)} con`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Daily Feed Consumption Projection (7 Days) + Urgent Reminders */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Dự kiến số lượng cám theo loại cám & ngày (7 ngày tới)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {feedRations.length > 0
                  ? 'Tính theo Khẩu phần ăn từng tuần tuổi heo thịt, mang thai, nuôi con & chờ phối'
                  : 'Tính theo định mức giai đoạn (vào Cài đặt → Khẩu phần ăn để tùy chỉnh từng tuần)'}
              </p>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400 font-mono-tabular">
                {formatNumber(feedProjection.totalKgPerDay, 1)} kg hôm nay · Tổng 7 ngày:{' '}
                {formatNumber(feedProjection.sevenDayTotalKg, 1)} kg
              </div>
              <div className="text-xs text-slate-500 font-mono-tabular">
                ≈ {formatNumber(feedProjection.sevenDayTotalKg / 25, 1)} bao 25kg / 7 ngày ({formatVND(feedProjection.sevenDayTotalCost)})
              </div>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={feedProjection.sevenDayForecast}
                margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: any, name: any) => [`${formatNumber(Number(value), 1)} kg`, String(name)]}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {feedProjection.feedTypeNames.length > 0 ? (
                  feedProjection.feedTypeNames.map((fname, idx) => (
                    <Bar
                      key={fname}
                      dataKey={fname}
                      stackId="feed"
                      fill={FEED_SERIES_COLORS[idx % FEED_SERIES_COLORS.length]}
                      radius={
                        idx === feedProjection.feedTypeNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]
                      }
                    />
                  ))
                ) : (
                  <Bar dataKey="kg" name="Tổng cám" fill="#D97706" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {(feedProjection.feedTypeSummary.length > 0 || feedProjection.breakdown.length > 0) && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setFeedTableMode('by_type_7d')}
                    className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      feedTableMode === 'by_type_7d'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    7 ngày theo loại cám
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedTableMode('by_group_today')}
                    className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      feedTableMode === 'by_group_today'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Chi tiết theo đàn hôm nay
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate('settings')}
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
                >
                  Chỉnh khẩu phần ăn →
                </button>
              </div>

              {feedTableMode === 'by_type_7d' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                        <th className="text-left py-2 pr-2 font-medium whitespace-nowrap">Loại cám</th>
                        {feedProjection.sevenDayForecast.map((d) => (
                          <th key={d.date} className="text-right py-2 px-1.5 font-medium whitespace-nowrap font-mono-tabular">
                            {d.dayLabel}
                          </th>
                        ))}
                        <th className="text-right py-2 pl-2 font-semibold whitespace-nowrap">Tổng 7 ngày</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {feedProjection.feedTypeSummary.map((row, idx) => (
                        <tr key={row.feedName}>
                          <td className="py-2 pr-2 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            <svg
                              className="inline-block w-2.5 h-2.5 mr-1.5 align-middle"
                              viewBox="0 0 10 10"
                              aria-hidden="true"
                            >
                              <circle
                                cx="5"
                                cy="5"
                                r="5"
                                fill={
                                  FEED_SERIES_COLORS[
                                    Math.max(0, feedProjection.feedTypeNames.indexOf(row.feedName)) %
                                      FEED_SERIES_COLORS.length
                                  ] || FEED_SERIES_COLORS[idx % FEED_SERIES_COLORS.length]
                                }
                              />
                            </svg>
                            {row.feedName}
                          </td>
                          {row.dailyKgs.map((kg, dIdx) => (
                            <td key={dIdx} className="py-2 px-1.5 text-right font-mono-tabular text-slate-600 dark:text-slate-300">
                              {formatNumber(kg, 1)}
                            </td>
                          ))}
                          <td className="py-2 pl-2 text-right font-semibold font-mono-tabular text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                            {formatNumber(row.sevenDayKg, 1)} kg
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                        <th className="text-left py-2 font-medium">Nhóm / Tuần</th>
                        <th className="text-left py-2 font-medium">Loại cám</th>
                        <th className="text-right py-2 font-medium">Số con</th>
                        <th className="text-right py-2 font-medium">Định mức/con</th>
                        <th className="text-right py-2 font-medium">Tổng kg/ngày</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {feedProjection.breakdown.map((row) => (
                        <tr key={`${row.stageLabel}_${row.feedName}`}>
                          <td className="py-2 text-slate-800 dark:text-slate-200">{row.stageLabel}</td>
                          <td className="py-2 text-slate-600 dark:text-slate-300">{row.feedName}</td>
                          <td className="py-2 text-right font-mono-tabular">{formatNumber(row.headCount)}</td>
                          <td className="py-2 text-right font-mono-tabular">{formatNumber(row.kgPerHead, 2)} kg</td>
                          <td className="py-2 text-right font-semibold font-mono-tabular">
                            {formatNumber(row.totalKg, 1)} kg
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Care & Health Alerts Panel */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Việc cần làm & Cảnh báo sức khỏe
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ưu tiên xử lý sự kiện quá hạn, tiêm phòng và hàng sắp hết
              </p>
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400 shrink-0" />
          </div>

          <div className="flex-1 divide-y divide-slate-100 dark:divide-slate-800">
            {reminders.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Mọi lịch chăm sóc đang đúng tiến độ
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Không có cảnh báo bệnh lý hoặc thiếu hụt kho vật tư.
                </p>
              </div>
            ) : (
              reminders.slice(0, 7).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.targetTab)}
                  className="w-full text-left py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-start justify-between gap-3 px-1 rounded-lg"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      {item.urgency === 'overdue' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      ) : item.urgency === 'warning' || item.urgency === 'today' ? (
                        <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : null}
                      <span
                        className={`font-semibold ${
                          item.urgency === 'overdue'
                            ? 'text-red-600 dark:text-red-400'
                            : item.urgency === 'warning' || item.urgency === 'today'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {item.urgency === 'overdue'
                          ? 'Quá hạn / Khẩn cấp'
                          : item.urgency === 'today'
                          ? 'Hôm nay'
                          : item.urgency === 'warning'
                          ? 'Cảnh báo'
                          : 'Sắp tới'}
                      </span>
                      {item.dueDate && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-400 font-mono-tabular">{item.dueDate}</span>
                        </>
                      )}
                    </div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                      {item.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {item.subtitle}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 30-Day Financial Forecast Section ("Dự báo tài chính") */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
              <Calculator className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                Dự báo tài chính vật tư (30 ngày tiếp theo)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tổng hợp tự động từ định mức Khẩu phần ăn và Chương trình / Lịch tiêm phòng theo quy mô đàn hiện có
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <PackageCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>Đối chiếu kho vật tư</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
            >
              Cài đặt định mức & tiêm phòng →
            </button>
          </div>
        </div>

        {/* 30-Day Budget Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Tổng dự toán vật tư 30 ngày
            </div>
            <div className="mt-1.5 text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono-tabular">
              {formatVND(forecast30Day.total30DayCost)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Bình quân {formatVND(forecast30Day.total30DayCost / 30)} / ngày
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Dự toán thức ăn (30 ngày)
            </div>
            <div className="mt-1.5 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-mono-tabular">
              {formatVND(forecast30Day.totalFeedCost30d)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {formatNumber(forecast30Day.totalFeedKg30d, 1)} kg (≈{' '}
              {formatNumber(forecast30Day.totalFeedKg30d / 25, 0)} bao 25kg)
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Dự toán vắc xin (30 ngày)
            </div>
            <div className="mt-1.5 text-xl sm:text-2xl font-bold text-sky-700 dark:text-sky-400 font-mono-tabular">
              {formatVND(forecast30Day.totalVaccineCost30d)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {formatNumber(forecast30Day.totalVaccineDoses30d)} liều theo lịch & chương trình
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Cần nhập thêm vào kho
            </div>
            <div
              className={`mt-1.5 text-xl sm:text-2xl font-bold font-mono-tabular ${
                forecast30Day.shortageItemsCount > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {forecast30Day.shortageItemsCount > 0
                ? `${formatNumber(forecast30Day.shortageItemsCount)} mặt hàng`
                : 'Kho đủ dùng'}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {forecast30Day.shortageItemsCount > 0
                ? 'Tồn kho hiện tại chưa đủ cho 30 ngày tới'
                : 'Đủ dự trữ cho toàn bộ nhu cầu 30 ngày'}
            </div>
          </div>
        </div>

        {/* 30-Day Weekly Cost Chart + Breakdown Tables */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-5 space-y-2">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Phân bổ chi phí dự kiến theo tuần (30 ngày tới)
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={forecast30Day.weeklyProjection}
                  margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis dataKey="periodLabel" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      v >= 1000000 ? `${Math.round(v / 1000000)}tr` : `${Math.round(v / 1000)}k`
                    }
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [formatVND(Number(value)), String(name)]}
                    labelFormatter={(label, payload) => {
                      const row = payload?.[0]?.payload;
                      return row ? `${label} (${row.dateRange})` : String(label);
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar
                    dataKey="feedCost"
                    name="Chi phí thức ăn"
                    stackId="budget"
                    fill="#15803D"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="vaccineCost"
                    name="Chi phí vắc xin"
                    stackId="budget"
                    fill="#0284C7"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="xl:col-span-7 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setForecastTab('feed')}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    forecastTab === 'feed'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Thức ăn 30 ngày ({forecast30Day.feedItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setForecastTab('vaccine')}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    forecastTab === 'vaccine'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Vắc xin 30 ngày ({forecast30Day.vaccineItems.length})
                </button>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Đơn giá tham chiếu từ Danh mục cám & Kho vật tư
              </span>
            </div>

            {forecastTab === 'feed' ? (
              forecast30Day.feedItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  Chưa có đàn heo đang nuôi để dự toán thức ăn 30 ngày.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                        <th className="text-left py-2 pr-2 font-medium">Loại cám</th>
                        <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Nhu cầu 30 ngày</th>
                        <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Đơn giá</th>
                        <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Tồn kho</th>
                        <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Cần nhập thêm</th>
                        <th className="text-right py-2 pl-2 font-semibold whitespace-nowrap">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {forecast30Day.feedItems.map((item) => (
                        <tr key={item.feedName}>
                          <td className="py-2.5 pr-2 font-medium text-slate-800 dark:text-slate-200">
                            {item.feedName}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono-tabular whitespace-nowrap">
                            {formatNumber(item.totalKg30d, 1)} kg
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono-tabular text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatVND(item.unitPrice)}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono-tabular whitespace-nowrap">
                            {formatNumber(item.stockKg, 1)} kg
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono-tabular whitespace-nowrap">
                            {item.shortageKg > 0 ? (
                              <span className="font-semibold text-amber-600 dark:text-amber-400">
                                +{formatNumber(item.shortageKg, 1)} kg
                              </span>
                            ) : (
                              <span className="text-emerald-700 dark:text-emerald-400">Đủ</span>
                            )}
                          </td>
                          <td className="py-2.5 pl-2 text-right font-semibold font-mono-tabular text-slate-900 dark:text-white whitespace-nowrap">
                            {formatVND(item.totalCost30d)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : forecast30Day.vaccineItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                Không có mũi tiêm nào đến hạn trong 30 ngày tiếp theo theo Lịch & Chương trình tiêm phòng.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      <th className="text-left py-2 pr-2 font-medium">Vắc xin</th>
                      <th className="text-left py-2 px-2 font-medium">Đàn & Ngày dự kiến</th>
                      <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Tổng liều</th>
                      <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Tồn kho</th>
                      <th className="text-right py-2 pl-2 font-semibold whitespace-nowrap">Dự toán</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {forecast30Day.vaccineItems.map((v) => (
                      <tr key={v.vaccineName}>
                        <td className="py-2.5 pr-2 font-medium text-slate-800 dark:text-slate-200">
                          <div>{v.vaccineName}</div>
                          <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                            {v.source === 'scheduled'
                              ? 'Từ lịch đã lên'
                              : v.source === 'program'
                              ? 'Từ chương trình tiêm'
                              : 'Lịch & chương trình'}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-slate-600 dark:text-slate-300">
                          <div className="line-clamp-2">{v.targetSummary}</div>
                          <div className="text-[11px] text-slate-400 font-mono-tabular mt-0.5">
                            {v.scheduledDates.map((d) => formatDateVi(d).slice(0, 5)).join(', ')}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono-tabular whitespace-nowrap">
                          {formatNumber(v.totalDoses)} liều
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono-tabular whitespace-nowrap">
                          {v.shortageDoses > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              {formatNumber(v.stockDoses)} (thiếu {formatNumber(v.shortageDoses)})
                            </span>
                          ) : (
                            <span className="text-emerald-700 dark:text-emerald-400">
                              {formatNumber(v.stockDoses)} liều
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pl-2 text-right font-semibold font-mono-tabular text-slate-900 dark:text-white whitespace-nowrap">
                          {formatVND(v.totalCost30d)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Daily Farm Journal with Voice Dictation ("Nhật ký chăn nuôi") */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
              <Mic className="w-5 h-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                Nhật ký chăn nuôi hàng ngày
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Nhấn nút Micro để đọc ghi chú nhanh các diễn biến trong ngày (heo ốm, thời tiết, sát trùng, khẩu phần) và đồng bộ ngay
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular shrink-0">
            {formatNumber(journalEntries.length)} ghi chú đã lưu
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5">
          {/* Quick Voice + Manual Entry Composer */}
          <form onSubmit={(e) => void handleSaveJournal(e)} className="lg:col-span-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">
                Phân loại sự kiện
              </label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(JOURNAL_CATEGORY_META) as JournalCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setJournalCategory(cat)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                      journalCategory === cat
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {JOURNAL_CATEGORY_META[cat].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block">
                Mức độ lưu ý
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { key: 'normal', label: 'Bình thường' },
                    { key: 'warning', label: 'Lưu ý' },
                    { key: 'critical', label: 'Khẩn cấp' },
                  ] as const
                ).map((sev) => (
                  <button
                    key={sev.key}
                    type="button"
                    onClick={() => setJournalSeverity(sev.key)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      journalSeverity === sev.key
                        ? sev.key === 'critical'
                          ? 'bg-red-600 text-white border-red-600'
                          : sev.key === 'warning'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800 dark:border-slate-200'
                        : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {sev.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="journal-content-input"
                  className="text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Nội dung ghi chú
                </label>
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  className={`inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                    isListening
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-4 h-4" />
                      <span>Đang ghi âm · Nhấn để dừng</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      <span>Nhập bằng giọng nói</span>
                    </>
                  )}
                </button>
              </div>

              <textarea
                id="journal-content-input"
                rows={4}
                maxLength={1000}
                value={journalContent}
                onChange={(e) => setJournalContent(e.target.value)}
                placeholder="Ví dụ: Sáng nay trời trở lạnh 18°C, chuồng choai B2 có 2 con ho nhẹ đã tách theo dõi..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />

              {interimTranscript && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                  <span className="font-semibold">Đang nghe: </span>
                  <span>{interimTranscript}</span>
                </div>
              )}

              {voiceNotice && (
                <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                  {voiceNotice}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {usedVoiceInput ? 'Đã nhận diện giọng nói · Có thể sửa lại chữ' : 'Hỗ trợ tiếng Việt (vi-VN)'}
              </span>
              <button
                type="submit"
                disabled={savingJournal || (!journalContent.trim() && !interimTranscript.trim())}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-medium transition-colors whitespace-nowrap"
              >
                {savingJournal ? 'Đang lưu...' : 'Lưu nhật ký'}
              </button>
            </div>
          </form>

          {/* Journal Entries History */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setJournalFilter('all')}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    journalFilter === 'all'
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Tất cả ({journalEntries.length})
                </button>
                {(Object.keys(JOURNAL_CATEGORY_META) as JournalCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setJournalFilter(cat)}
                    className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      journalFilter === cat
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {JOURNAL_CATEGORY_META[cat].shortLabel}
                  </button>
                ))}
              </div>
            </div>

            {sortedJournalEntries.length === 0 ? (
              <div className="flex-1 min-h-[220px] rounded-xl border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center p-6 space-y-2">
                <BookOpen className="w-7 h-7 text-slate-400" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Chưa có ghi chú nhật ký nào
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Nhấn "Nhập bằng giọng nói" hoặc gõ trực tiếp bên trái để lưu lại tình trạng đàn heo, thời tiết hay công việc chăm sóc hằng ngày.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[360px] overflow-y-auto pr-1">
                {sortedJournalEntries.map((entry) => (
                  <div key={entry.id} className="py-3.5 first:pt-1 last:pb-1 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5">{renderCategoryIcon(entry.category)}</div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {JOURNAL_CATEGORY_META[entry.category]?.label || 'Ghi chú'}
                          </span>
                          {entry.severity !== 'normal' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span
                                className={`font-semibold ${
                                  entry.severity === 'critical'
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                }`}
                              >
                                {entry.severity === 'critical' ? 'Khẩn cấp' : 'Lưu ý'}
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-500 dark:text-slate-400 font-mono-tabular">
                            {formatDateVi(entry.date)}
                            {entry.timeLabel ? ` ${entry.timeLabel}` : ''}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                            {entry.inputMethod === 'voice' ? (
                              <>
                                <Mic className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span>Giọng nói</span>
                              </>
                            ) : (
                              <>
                                <Keyboard className="w-3 h-3" />
                                <span>Nhập tay</span>
                              </>
                            )}
                          </span>
                          {entry.authorName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-500 dark:text-slate-400">{entry.authorName}</span>
                            </>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {entry.content}
                        </p>
                      </div>
                    </div>

                    {(canDeleteAnyJournal || entry.createdBy === userUid) && (
                      <button
                        type="button"
                        onClick={() => void onDeleteSubDoc('journalEntries', entry.id)}
                        title="Xóa ghi chú"
                        aria-label="Xóa ghi chú nhật ký"
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
