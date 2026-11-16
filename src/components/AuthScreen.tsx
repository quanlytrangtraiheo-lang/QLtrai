import React, { useState } from 'react';
import {
  BellRing,
  CloudCog,
  FileSpreadsheet,
  LogIn,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface AuthScreenProps {
  onLogin: () => Promise<void>;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await onLogin();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Không thể đăng nhập lúc này. Vui lòng thử lại.'
      );
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: CloudCog,
      title: 'Đồng bộ đám mây & Sao lưu mỗi ngày',
      desc: 'Tự động đồng bộ nhiều thiết bị và lưu bản sao lưu hàng ngày lên hệ thống bảo mật.',
    },
    {
      icon: WifiOff,
      title: 'Ghi chép ngoại tuyến liên tục',
      desc: 'Hoạt động ngay cả trong chuồng trại mất sóng Wi-Fi/4G và tự đồng bộ khi có mạng.',
    },
    {
      icon: BellRing,
      title: 'Nhắc lịch phối, đẻ, cai sữa & tiêm phòng',
      desc: 'Tự động sinh luồng sự kiện heo nái 114 ngày và gửi thông báo đẩy đúng hạn.',
    },
    {
      icon: FileSpreadsheet,
      title: 'Tính lãi lỗ từng lô & Xuất PDF/CSV',
      desc: 'Theo dõi chi phí thức ăn, thuốc thú y, con giống và xuất báo cáo định kỳ.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8 border-b border-slate-200 dark:border-slate-800">
        <span className="text-xl font-bold tracking-tight text-emerald-800 dark:text-emerald-400 whitespace-nowrap shrink-0">
          TrạiHeo
        </span>
        <div className="flex items-center gap-3 shrink-0">
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={() => void handleSignIn()}
            disabled={loading}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
          >
            {loading ? 'Đang kết nối...' : 'Đăng nhập Google'}
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-10 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
          <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Hệ thống quản lý trang trại chăn nuôi heo toàn diện
          </div>

          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight"
            style={{ textWrap: 'balance' }}
          >
            Kiểm soát năng suất, chi phí và sức khỏe đàn heo chính xác mỗi ngày
          </h1>

          <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
            Theo dõi từng cá thể heo nái theo luồng Phối giống – Đẻ con – Cai sữa, quản lý
            từng lô heo nuôi thịt, tồn kho thức ăn thuốc thú y và dự báo lượng cám sử dụng.
          </p>

          {errorMsg && (
            <div className="p-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => void handleSignIn()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2.5 min-h-[48px] px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-semibold text-base transition-colors whitespace-nowrap"
            >
              <LogIn className="w-5 h-5" />
              <span>{loading ? 'Đang xác thực...' : 'Đăng nhập bằng tài khoản Google'}</span>
            </button>
            <div className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>Mã hóa & phân quyền truy cập theo từng trang trại</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-slate-200 dark:border-slate-800">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <Icon className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>{f.title}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-6 flex">
          <div className="relative w-full min-h-[300px] lg:h-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
            {!imgFailed ? (
              <img
                src="/src/assets/images/farm_welcome_banner_1794842989815.jpg"
                alt="Trang trại chăn nuôi heo hiện đại an toàn sinh học"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-900 to-slate-900 text-white p-8 text-center">
                <div>
                  <p className="text-lg font-semibold">TrạiHeo — An toàn sinh học</p>
                  <p className="text-sm text-emerald-200 mt-1">
                    Nền tảng số hóa quy trình chăn nuôi heo chuyên nghiệp
                  </p>
                </div>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent text-white">
              <p className="text-sm font-semibold">
                Sẵn sàng dùng ngay cho chủ trại, bác sĩ thú y và công nhân chuồng
              </p>
              <p className="text-xs text-slate-200 mt-1">
                Hỗ trợ cài đặt trực tiếp lên màn hình điện thoại iOS & Android
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
