import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  BellRing,
  LayoutDashboard,
  LogOut,
  Moon,
  Package,
  PiggyBank,
  RefreshCw,
  Settings,
  Sun,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import type { AppTab, CareReminder, Farm, StaffRole, ThemeMode } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface AppShellProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  farm: Farm | null;
  userEmail: string;
  userName: string;
  role: StaffRole;
  isOnline: boolean;
  hasPendingSync: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
  reminders: CareReminder[];
  pushPermission: NotificationPermission;
  onRequestPush: () => Promise<unknown>;
  onTriggerPushCheck: () => Promise<unknown>;
  onLogout: () => Promise<void>;
  children: React.ReactNode;
}

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Chủ trại / Quản trị',
  manager: 'Quản lý trại',
  vet: 'Bác sĩ thú y',
  worker: 'Nhân viên chuồng',
};

const NAV_ITEMS: Array<{ id: AppTab; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Tổng quan & Dự báo', shortLabel: 'Tổng quan', icon: LayoutDashboard },
  { id: 'herd', label: 'Đàn nái & Heo thịt', shortLabel: 'Đàn heo', icon: PiggyBank },
  { id: 'health', label: 'Sức khỏe & Tiêm phòng', shortLabel: 'Thú y', icon: Activity },
  { id: 'inventory', label: 'Kho cám & Vật tư', shortLabel: 'Kho', icon: Package },
  { id: 'reports', label: 'Báo cáo & Lợi nhuận', shortLabel: 'Báo cáo', icon: BarChart3 },
  { id: 'settings', label: 'Cài đặt hệ thống', shortLabel: 'Cài đặt', icon: Settings },
];

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onTabChange,
  farm,
  userEmail,
  userName,
  role,
  isOnline,
  hasPendingSync,
  theme,
  onToggleTheme,
  reminders,
  pushPermission,
  onRequestPush,
  onTriggerPushCheck,
  onLogout,
  children,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);

  const urgentCount = reminders.filter(
    (r) => r.urgency === 'overdue' || r.urgency === 'today' || r.urgency === 'warning'
  ).length;

  const activeNav = NAV_ITEMS.find((n) => n.id === activeTab) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-30">
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <span className="text-xl font-bold tracking-tight text-emerald-800 dark:text-emerald-400 whitespace-nowrap shrink-0">
            TrạiHeo
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
          </span>
        </div>

        <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {farm?.name || 'Đang tải trang trại...'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {ROLE_LABELS[role]} · {userName}
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Điều hướng chính">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <PWAInstallButton />
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span className="truncate">{userEmail}</span>
            <button
              type="button"
              onClick={() => void onLogout()}
              className="min-h-[36px] px-2 inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 whitespace-nowrap shrink-0"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
              <span>Thoát</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar (Compact 56px) */}
        <header className="sticky top-0 z-20 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="lg:hidden text-base font-bold text-emerald-800 dark:text-emerald-400 whitespace-nowrap shrink-0">
              TrạiHeo
            </span>
            <span className="lg:hidden text-slate-300 dark:text-slate-700">/</span>
            <h1 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
              {activeNav.label}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Sync / Offline Indicator */}
            <div
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300"
              title={isOnline ? 'Đang đồng bộ đám mây' : 'Đang ghi chép ngoại tuyến'}
            >
              {!isOnline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Ngoại tuyến</span>
                </>
              ) : hasPendingSync ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                  <span>Đang đồng bộ</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Đã đồng bộ</span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={onToggleTheme}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang chế độ tối'}
              title={theme === 'dark' ? 'Giao diện sáng' : 'Chế độ tối'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Mở trung tâm nhắc nhở"
            >
              <Bell className="w-5 h-5" />
              {urgentCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] font-semibold flex items-center justify-center tabular-nums">
                  {urgentCount > 9 ? '9+' : urgentCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Offline Banner (only shown when offline) */}
        {!isOnline && (
          <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 px-4 lg:px-8 py-2 text-xs sm:text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              Đang hoạt động ở chế độ ngoại tuyến. Mọi ghi chép vẫn được lưu an toàn trên thiết bị và tự động đồng bộ lên đám mây khi có kết nối mạng.
            </span>
          </div>
        )}

        {/* Viewport Content */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (5 primary tabs, <= 64px high for <= 15% cap) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-6 items-center px-1"
        aria-label="Menu di động"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors ${
                active
                  ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] leading-tight whitespace-nowrap">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Notification & Push Reminder Drawer */}
      {notifOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full border-l border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Nhắc nhở chăm sóc định kỳ
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Lịch nái sinh sản, tiêm phòng & cảnh báo tồn kho
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNotifOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Đóng thông báo"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-600 dark:text-slate-300">
                Thông báo đẩy:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {pushPermission === 'granted'
                    ? 'Đang bật'
                    : pushPermission === 'denied'
                    ? 'Bị chặn bởi trình duyệt'
                    : 'Chưa cấp quyền'}
                </strong>
              </div>
              <div className="flex items-center gap-2">
                {pushPermission !== 'granted' ? (
                  <button
                    type="button"
                    onClick={() => void onRequestPush()}
                    className="min-h-[40px] px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 whitespace-nowrap"
                  >
                    Bật thông báo đẩy
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void onTriggerPushCheck()}
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    <BellRing className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>Gửi nhắc nhở ngay</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {reminders.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Chưa có cảnh báo hay lịch chăm sóc nào sắp đến hạn.
                </div>
              ) : (
                reminders.map((rem) => (
                  <button
                    key={rem.id}
                    type="button"
                    onClick={() => {
                      onTabChange(rem.targetTab);
                      setNotifOpen(false);
                    }}
                    className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span
                        className={`font-semibold ${
                          rem.urgency === 'overdue'
                            ? 'text-red-600 dark:text-red-400'
                            : rem.urgency === 'today' || rem.urgency === 'warning'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {rem.urgency === 'overdue'
                          ? 'Khẩn cấp / Quá hạn'
                          : rem.urgency === 'today'
                          ? 'Hôm nay'
                          : rem.urgency === 'warning'
                          ? 'Cảnh báo'
                          : 'Sắp tới'}
                      </span>
                      {rem.dueDate && (
                        <span className="text-slate-400 font-mono-tabular">{rem.dueDate}</span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1">
                      {rem.title}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {rem.subtitle}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
