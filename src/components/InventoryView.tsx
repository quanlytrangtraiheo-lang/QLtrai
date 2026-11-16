import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Trash2,
} from 'lucide-react';
import { formatDateVi, formatNumber, formatVND, makeId, todayIso } from '../utils/farmCalculations';
import type {
  InventoryCategory,
  InventoryItem,
  InventoryTx,
  PigGroup,
  StaffRole,
} from '../types';

interface InventoryViewProps {
  role: StaffRole;
  items: InventoryItem[];
  transactions: InventoryTx[];
  pigGroups: PigGroup[];
  onSaveSubDoc: (
    colName: string,
    id: string,
    payload: Record<string, unknown>,
    isEdit?: boolean
  ) => Promise<void>;
  onDeleteSubDoc: (colName: string, id: string) => Promise<void>;
  onRecordMovement: (input: {
    item: InventoryItem;
    txType: 'in' | 'out';
    quantity: number;
    unitCost: number;
    targetGroupId?: string;
    date: string;
    notes?: string;
  }) => Promise<void>;
}

const CAT_LABELS: Record<InventoryCategory, string> = {
  feed: 'Thức ăn',
  medicine: 'Thuốc thú y',
  vaccine: 'Vắc xin',
  supply: 'Vật tư / Sát trùng',
};

export const InventoryView: React.FC<InventoryViewProps> = ({
  role,
  items,
  transactions,
  pigGroups,
  onSaveSubDoc,
  onDeleteSubDoc,
  onRecordMovement,
}) => {
  const [catFilter, setCatFilter] = useState<'all' | InventoryCategory>('all');
  const [showAddItem, setShowAddItem] = useState(false);
  const [moveModal, setMoveModal] = useState<{ item: InventoryItem; type: 'in' | 'out' } | null>(
    null
  );

  const [itemForm, setItemForm] = useState({
    sku: '',
    name: '',
    category: 'feed' as InventoryCategory,
    unit: 'kg',
    quantity: 0,
    minThreshold: 100,
    unitCost: 14000,
    supplier: '',
    expiryDate: '',
  });

  const [moveForm, setMoveForm] = useState({
    quantity: 25,
    unitCost: 0,
    targetGroupId: '',
    date: todayIso(),
    notes: '',
  });

  const canDelete = role === 'admin' || role === 'manager';

  const lowStockItems = useMemo(
    () => items.filter((i) => i.quantity <= i.minThreshold),
    [items]
  );

  const filteredItems = useMemo(
    () => items.filter((i) => catFilter === 'all' || i.category === catFilter),
    [items, catFilter]
  );

  const totalInventoryValue = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0),
    [items]
  );

  const sortedTx = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)),
    [transactions]
  );

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name.trim()) return;
    const id = makeId('inv');
    await onSaveSubDoc('inventoryItems', id, {
      sku: itemForm.sku.trim() || undefined,
      name: itemForm.name.trim(),
      category: itemForm.category,
      unit: itemForm.unit.trim() || 'đơn vị',
      quantity: Math.max(0, Number(itemForm.quantity) || 0),
      minThreshold: Math.max(0, Number(itemForm.minThreshold) || 0),
      unitCost: Math.max(0, Number(itemForm.unitCost) || 0),
      supplier: itemForm.supplier.trim() || undefined,
      expiryDate: itemForm.expiryDate || undefined,
    });
    setShowAddItem(false);
    setItemForm({ ...itemForm, sku: '', name: '', supplier: '', expiryDate: '' });
  };

  const handleMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveModal) return;
    await onRecordMovement({
      item: moveModal.item,
      txType: moveModal.type,
      quantity: Number(moveForm.quantity) || 0,
      unitCost: Number(moveForm.unitCost) || moveModal.item.unitCost,
      targetGroupId: moveForm.targetGroupId || undefined,
      date: moveForm.date,
      notes: moveForm.notes,
    });
    setMoveModal(null);
  };

  return (
    <div className="space-y-6">
      {/* Low Stock Alert Banner */}
      {lowStockItems.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 dark:text-amber-200">
            <strong>Cảnh báo sắp hết hàng ({lowStockItems.length} mặt hàng):</strong>{' '}
            {lowStockItems
              .map((i) => `${i.name} (còn ${formatNumber(i.quantity, 1)} ${i.unit})`)
              .join(' · ')}
          </div>
        </div>
      )}

      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 self-start">
          {[
            { id: 'all', label: `Tất cả (${items.length})` },
            { id: 'feed', label: 'Thức ăn' },
            { id: 'medicine', label: 'Thuốc' },
            { id: 'vaccine', label: 'Vắc xin' },
            { id: 'supply', label: 'Vật tư' },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCatFilter(c.id as typeof catFilter)}
              className={`min-h-[38px] px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                catFilter === c.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-slate-500">Tổng giá trị tồn kho</div>
            <div className="text-sm font-bold font-mono-tabular">{formatVND(totalInventoryValue)}</div>
          </div>
          <button
            type="button"
            onClick={() => setShowAddItem(true)}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm mặt hàng mới</span>
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <th className="text-left py-3 px-4 font-medium">Mặt hàng</th>
                <th className="text-left py-3 px-4 font-medium">Phân loại</th>
                <th className="text-right py-3 px-4 font-medium">Tồn kho</th>
                <th className="text-right py-3 px-4 font-medium">Mức tối thiểu</th>
                <th className="text-right py-3 px-4 font-medium">Đơn giá</th>
                <th className="text-right py-3 px-4 font-medium">Nhập / Xuất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    Kho chưa có mặt hàng nào trong nhóm này.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isLow = item.quantity <= item.minThreshold;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{item.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {item.sku ? <span className="font-mono-tabular">{item.sku} · </span> : null}
                          {item.supplier || 'Không rõ NCC'}
                          {item.expiryDate ? ` · HSD ${formatDateVi(item.expiryDate)}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                        {CAT_LABELS[item.category]}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono-tabular font-bold ${
                          isLow ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {formatNumber(item.quantity, 1)} {item.unit}
                        {isLow && <div className="text-[11px] font-medium">Sắp hết hàng</div>}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-slate-500">
                        {formatNumber(item.minThreshold, 1)} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular">
                        {formatVND(item.unitCost)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setMoveModal({ item, type: 'in' });
                              setMoveForm({
                                quantity: 50,
                                unitCost: item.unitCost,
                                targetGroupId: '',
                                date: todayIso(),
                                notes: '',
                              });
                            }}
                            className="inline-flex items-center gap-1 min-h-[36px] px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-medium whitespace-nowrap"
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            <span>Nhập</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMoveModal({ item, type: 'out' });
                              setMoveForm({
                                quantity: 25,
                                unitCost: item.unitCost,
                                targetGroupId: pigGroups.find((g) => g.status === 'active')?.id || '',
                                date: todayIso(),
                                notes: '',
                              });
                            }}
                            className="inline-flex items-center gap-1 min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 text-xs font-medium whitespace-nowrap"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>Xuất</span>
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => void onDeleteSubDoc('inventoryItems', item.id)}
                              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600"
                              title="Xóa mặt hàng"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Inventory Movements */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h2 className="text-base font-semibold mb-3">Lịch sử Xuất – Nhập kho gần đây</h2>
        {sortedTx.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có phiếu nhập/xuất kho nào.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {sortedTx.slice(0, 12).map((tx) => (
              <div key={tx.id} className="py-2.5 flex items-center justify-between gap-4 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                    {tx.txType === 'in' ? 'Nhập kho' : 'Xuất kho'}: {tx.itemName}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono-tabular">{formatDateVi(tx.date)}</span>
                    {tx.targetLabel ? ` · Cho: ${tx.targetLabel}` : ''}
                    {tx.notes ? ` · ${tx.notes}` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`font-mono-tabular font-semibold ${
                      tx.txType === 'in'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {tx.txType === 'in' ? '+' : '-'}
                    {formatNumber(tx.quantity, 1)}
                  </div>
                  <div className="text-xs text-slate-500 font-mono-tabular">
                    {formatVND(tx.totalCost)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODAL: Add Inventory Item */}
      {showAddItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={(e) => void handleAddItem(e)}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-semibold">Thêm mặt hàng vào kho</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label className="col-span-full space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Tên hàng hóa / Cám / Thuốc</span>
                <input
                  required
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="VD: Cám heo choai 25kg"
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Phân loại</span>
                <select
                  value={itemForm.category}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, category: e.target.value as InventoryCategory })
                  }
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="feed">Thức ăn chăn nuôi</option>
                  <option value="medicine">Thuốc thú y</option>
                  <option value="vaccine">Vắc xin</option>
                  <option value="supply">Vật tư / Sát trùng</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Đơn vị tính</span>
                <input
                  required
                  value={itemForm.unit}
                  onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                  placeholder="kg, bao, chai, liều..."
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Tồn kho ban đầu</span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm({ ...itemForm, quantity: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ngưỡng cảnh báo sắp hết</span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={itemForm.minThreshold}
                  onChange={(e) => setItemForm({ ...itemForm, minThreshold: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Đơn giá nhập (VND)</span>
                <input
                  type="number"
                  min={0}
                  value={itemForm.unitCost}
                  onChange={(e) => setItemForm({ ...itemForm, unitCost: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Nhà cung cấp</span>
                <input
                  value={itemForm.supplier}
                  onChange={(e) => setItemForm({ ...itemForm, supplier: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddItem(false)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800"
              >
                Lưu vào kho
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Stock In / Out */}
      {moveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={(e) => void handleMovement(e)}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <h3 className="text-lg font-semibold">
              {moveModal.type === 'in' ? 'Nhập kho' : 'Xuất kho'}: {moveModal.item.name}
            </h3>
            <div className="space-y-3 text-sm">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Số lượng ({moveModal.item.unit})
                </span>
                <input
                  type="number"
                  min={0.1}
                  step="0.1"
                  required
                  value={moveForm.quantity}
                  onChange={(e) => setMoveForm({ ...moveForm, quantity: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Đơn giá (VND)</span>
                <input
                  type="number"
                  min={0}
                  value={moveForm.unitCost}
                  onChange={(e) => setMoveForm({ ...moveForm, unitCost: Number(e.target.value) })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              {moveModal.type === 'out' && pigGroups.length > 0 && (
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Xuất cho lô heo (tự động cộng chi phí vào lô)
                  </span>
                  <select
                    value={moveForm.targetGroupId}
                    onChange={(e) => setMoveForm({ ...moveForm, targetGroupId: e.target.value })}
                    className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="">-- Không gắn lô cụ thể --</option>
                    {pigGroups
                      .filter((g) => g.status === 'active')
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.batchCode})
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ngày</span>
                <input
                  type="date"
                  required
                  value={moveForm.date}
                  onChange={(e) => setMoveForm({ ...moveForm, date: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ghi chú</span>
                <input
                  value={moveForm.notes}
                  onChange={(e) => setMoveForm({ ...moveForm, notes: e.target.value })}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMoveModal(null)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800"
              >
                Xác nhận {moveModal.type === 'in' ? 'nhập kho' : 'xuất kho'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
