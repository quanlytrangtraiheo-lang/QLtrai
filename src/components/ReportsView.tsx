import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Plus, Trash2 } from 'lucide-react';
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
  aggregateFinancialsByPeriod,
  computeGroupEconomics,
  formatDateVi,
  formatNumber,
  formatVND,
  todayIso,
} from '../utils/farmCalculations';
import { exportReportToPDF, exportToCSV } from '../utils/exportUtils';
import type { Farm, FinancialTx, PigGroup, StaffRole } from '../types';

interface ReportsViewProps {
  farm: Farm;
  role: StaffRole;
  transactions: FinancialTx[];
  pigGroups: PigGroup[];
  onRecordTx: (input: {
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
  onDeleteTx: (id: string) => Promise<void>;
}

const TX_TYPE_LABELS: Record<FinancialTx['txType'], string> = {
  sale_fattening: 'Xuất bán heo thịt',
  sale_breeding: 'Xuất bán heo giống',
  purchase_breeding: 'Nhập heo giống',
  feed_expense: 'Chi phí thức ăn',
  medicine_expense: 'Chi phí thuốc & Vắc xin',
  labor_expense: 'Chi phí nhân công',
  utility_expense: 'Điện, nước, vận hành',
  other_income: 'Thu nhập khác',
  other_expense: 'Chi phí khác',
};

export const ReportsView: React.FC<ReportsViewProps> = ({
  farm,
  role,
  transactions,
  pigGroups,
  onRecordTx,
  onDeleteTx,
}) => {
  const [periodMode, setPeriodMode] = useState<'day' | 'week' | 'month'>('month');
  const [showAddTx, setShowAddTx] = useState(false);

  const [txForm, setTxForm] = useState({
    txType: 'feed_expense' as FinancialTx['txType'],
    direction: 'expense' as 'income' | 'expense',
    date: todayIso(),
    groupId: '',
    headCount: 0,
    amount: 0,
    partnerName: '',
    notes: '',
  });

  const canDelete = role === 'admin' || role === 'manager';

  const periodData = useMemo(
    () => aggregateFinancialsByPeriod(transactions, periodMode),
    [transactions, periodMode]
  );

  const totalIncome = useMemo(
    () => transactions.filter((t) => t.direction === 'income').reduce((a, b) => a + b.amount, 0),
    [transactions]
  );
  const totalExpense = useMemo(
    () => transactions.filter((t) => t.direction === 'expense').reduce((a, b) => a + b.amount, 0),
    [transactions]
  );
  const netProfit = totalIncome - totalExpense;

  const sortedTxs = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)),
    [transactions]
  );

  const handleExportPDF = () => {
    const periodLabel =
      periodMode === 'day' ? 'theo Ngày' : periodMode === 'week' ? 'theo Tuần' : 'theo Tháng';
    exportReportToPDF(
      `Bao_cao_trang_trai_${todayIso()}.pdf`,
      farm.name,
      `Báo cáo Doanh thu, Chi phí & Lợi nhuận (${periodLabel})`,
      `Ngày lập: ${formatDateVi(todayIso())} · Tổng cộng ${transactions.length} giao dịch`,
      [
        { label: 'Tổng doanh thu', value: formatVND(totalIncome) },
        { label: 'Tổng chi phí', value: formatVND(totalExpense) },
        { label: 'Lợi nhuận ròng', value: formatVND(netProfit) },
        { label: 'Số lô heo đang theo dõi', value: `${pigGroups.length} lô` },
      ],
      [
        {
          heading: `1. Tổng hợp tài chính ${periodLabel}`,
          headers: ['Kỳ', 'Doanh thu', 'Chi phí', 'Lợi nhuận'],
          rows: periodData.map((p) => [
            p.label,
            formatVND(p.income),
            formatVND(p.expense),
            formatVND(p.profit),
          ]),
        },
        {
          heading: '2. Năng suất & Lợi nhuận từng lô heo nuôi thịt',
          headers: ['Mã lô', 'Hiện có / Nhập', 'Tổng chi phí', 'Doanh thu', 'Lợi nhuận'],
          rows: pigGroups.map((g) => {
            const eco = computeGroupEconomics(g);
            return [
              `${g.batchCode} (${g.name})`,
              `${g.currentCount}/${g.initialCount} con`,
              formatVND(eco.totalCost),
              formatVND(eco.revenue),
              formatVND(eco.profit),
            ];
          }),
        },
        {
          heading: '3. Chi tiết giao dịch gần đây',
          headers: ['Ngày', 'Loại giao dịch', 'Đối tượng / Lô', 'Số tiền'],
          rows: sortedTxs.slice(0, 30).map((t) => [
            formatDateVi(t.date),
            TX_TYPE_LABELS[t.txType],
            t.groupLabel || t.partnerName || '—',
            `${t.direction === 'income' ? '+' : '-'}${formatVND(t.amount)}`,
          ]),
        },
      ]
    );
  };

  const handleExportCSV = () => {
    exportToCSV(
      `Bao_cao_tai_chinh_${todayIso()}.csv`,
      ['Ngày', 'Loại giao dịch', 'Thu/Chi', 'Nhóm/Lô heo', 'Số lượng (con)', 'Trọng lượng (kg)', 'Số tiền (VND)', 'Đối tác', 'Ghi chú'],
      sortedTxs.map((t) => [
        t.date,
        TX_TYPE_LABELS[t.txType],
        t.direction === 'income' ? 'Thu' : 'Chi',
        t.groupLabel || '',
        t.headCount || '',
        t.totalWeightKg || '',
        t.amount,
        t.partnerName || '',
        t.notes || '',
      ])
    );
  };

  const handleCreateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    const isIncome =
      txForm.txType === 'sale_fattening' ||
      txForm.txType === 'sale_breeding' ||
      txForm.txType === 'other_income';
    await onRecordTx({
      txType: txForm.txType,
      direction: isIncome ? 'income' : 'expense',
      date: txForm.date,
      groupId: txForm.groupId || undefined,
      headCount: txForm.headCount || undefined,
      amount: Number(txForm.amount) || 0,
      partnerName: txForm.partnerName,
      notes: txForm.notes,
    });
    setShowAddTx(false);
    setTxForm({ ...txForm, amount: 0, partnerName: '', notes: '' });
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 self-start">
          {[
            { id: 'day', label: 'Theo ngày' },
            { id: 'week', label: 'Theo tuần' },
            { id: 'month', label: 'Theo tháng' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setPeriodMode(m.id as 'day' | 'week' | 'month')}
              className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                periodMode === m.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span>Xuất CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium whitespace-nowrap"
          >
            <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span>Xuất báo cáo PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddTx(true)}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Ghi thu / chi</span>
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs text-slate-500">Tổng doanh thu</div>
          <div className="mt-1.5 text-2xl font-bold font-mono-tabular text-emerald-700 dark:text-emerald-400">
            {formatVND(totalIncome)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs text-slate-500">Tổng chi phí</div>
          <div className="mt-1.5 text-2xl font-bold font-mono-tabular text-slate-900 dark:text-white">
            {formatVND(totalExpense)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="text-xs text-slate-500">Lợi nhuận ròng</div>
          <div
            className={`mt-1.5 text-2xl font-bold font-mono-tabular ${
              netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatVND(netProfit)}
          </div>
        </div>
      </section>

      {/* Revenue / Expense / Profit Chart */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h2 className="text-base font-semibold mb-4">
          Biểu đồ Doanh thu – Chi phí – Lợi nhuận ({periodMode === 'day' ? 'Theo ngày' : periodMode === 'week' ? 'Theo tuần' : 'Theo tháng'})
        </h2>
        <div className="h-72 w-full">
          {periodData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-500">
              Chưa có dữ liệu giao dịch tài chính để vẽ biểu đồ.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodData} margin={{ top: 10, right: 16, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${Math.round(v / 1000000)}tr`}
                />
                <Tooltip formatter={(v: any) => formatVND(Number(v))} />
                <Legend />
                <Bar dataKey="income" name="Doanh thu" fill="#15803D" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Chi phí" fill="#DC2626" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Lợi nhuận" fill="#0284C7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Group Economics Table */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-semibold">Tự động tính toán Lợi nhuận theo từng nhóm vật nuôi</h2>
          <button
            type="button"
            onClick={() =>
              exportToCSV(
                `Hieu_qua_tung_lo_heo_${todayIso()}.csv`,
                ['Mã lô', 'Tên lô', 'Số nhập', 'Hiện còn', 'Hao hụt %', 'Chi phí giống', 'Chi phí cám', 'Chi phí thuốc', 'Tổng chi phí', 'Doanh thu', 'Lợi nhuận'],
                pigGroups.map((g) => {
                  const eco = computeGroupEconomics(g);
                  return [
                    g.batchCode,
                    g.name,
                    g.initialCount,
                    g.currentCount,
                    eco.mortalityPct.toFixed(1),
                    g.entryCostTotal || 0,
                    g.feedCostTotal || 0,
                    g.medCostTotal || 0,
                    eco.totalCost,
                    eco.revenue,
                    eco.profit,
                  ];
                })
              )
            }
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải bảng CSV</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <th className="text-left py-3 px-4 font-medium">Lô heo</th>
                <th className="text-right py-3 px-4 font-medium">Còn / Nhập</th>
                <th className="text-right py-3 px-4 font-medium">Tổng chi phí</th>
                <th className="text-right py-3 px-4 font-medium">Doanh thu</th>
                <th className="text-right py-3 px-4 font-medium">Lợi nhuận ròng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pigGroups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Chưa có nhóm vật nuôi nào.
                  </td>
                </tr>
              ) : (
                pigGroups.map((g) => {
                  const eco = computeGroupEconomics(g);
                  return (
                    <tr key={g.id}>
                      <td className="py-3 px-4">
                        <div className="font-semibold">{g.name}</div>
                        <div className="text-xs text-slate-500 font-mono-tabular">
                          {g.batchCode} · {eco.ageWeeks} tuần tuổi
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular">
                        {formatNumber(g.currentCount)} / {formatNumber(g.initialCount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular">
                        {formatVND(eco.totalCost)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular">
                        {formatVND(eco.revenue)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono-tabular font-bold ${
                          eco.profit >= 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {formatVND(eco.profit)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Transactions Ledger */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h2 className="text-base font-semibold mb-3">Sổ giao dịch Thu / Chi & Xuất bán</h2>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {sortedTxs.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Chưa có giao dịch nào.</p>
          ) : (
            sortedTxs.slice(0, 25).map((tx) => (
              <div key={tx.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {TX_TYPE_LABELS[tx.txType]}
                    {tx.groupLabel ? ` · ${tx.groupLabel}` : ''}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono-tabular">{formatDateVi(tx.date)}</span>
                    {tx.partnerName ? ` · ${tx.partnerName}` : ''}
                    {tx.notes ? ` · ${tx.notes}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`font-mono-tabular font-bold ${
                      tx.direction === 'income'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {tx.direction === 'income' ? '+' : '-'}
                    {formatVND(tx.amount)}
                  </span>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => void onDeleteTx(tx.id)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600"
                      title="Xóa giao dịch"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* MODAL: Record Financial Transaction */}
      {showAddTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={(e) => void handleCreateTx(e)}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <h3 className="text-lg font-semibold">Ghi nhận giao dịch Thu / Chi</h3>
            <div className="space-y-3 text-sm">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Loại giao dịch</span>
                <select
                  value={txForm.txType}
                  onChange={(e) =>
                    setTxForm({ ...txForm, txType: e.target.value as FinancialTx['txType'] })
                  }
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  {Object.entries(TX_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Gắn với lô heo (tùy chọn)</span>
                <select
                  value={txForm.groupId}
                  onChange={(e) => setTxForm({ ...txForm, groupId: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="">-- Chi phí / Doanh thu chung toàn trại --</option>
                  {pigGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.batchCode})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Số tiền (VND)</span>
                <input
                  type="number"
                  min={0}
                  required
                  value={txForm.amount}
                  onChange={(e) => setTxForm({ ...txForm, amount: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ngày giao dịch</span>
                <input
                  type="date"
                  required
                  value={txForm.date}
                  onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Đối tác / Người giao dịch</span>
                <input
                  value={txForm.partnerName}
                  onChange={(e) => setTxForm({ ...txForm, partnerName: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ghi chú</span>
                <input
                  value={txForm.notes}
                  onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddTx(false)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800"
              >
                Lưu giao dịch
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
