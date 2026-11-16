import React, { useState } from 'react';
import { AppShell } from './components/AppShell';
import { AuthScreen } from './components/AuthScreen';
import { DashboardView } from './components/DashboardView';
import { HealthView } from './components/HealthView';
import { HerdView } from './components/HerdView';
import { InventoryView } from './components/InventoryView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { useFarmData } from './hooks/useFarmData';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useUiPreferences } from './hooks/useUiPreferences';
import type { AppTab } from './types';

export default function App() {
  const isOnline = useOnlineStatus();
  const ui = useUiPreferences();
  const farmData = useFarmData(isOnline);
  const push = usePushNotifications(farmData.reminders);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');

  if (!farmData.authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-sm">
        Đang khởi tạo hệ thống TrạiHeo...
      </div>
    );
  }

  if (!farmData.user) {
    return <AuthScreen onLogin={farmData.loginWithGoogle} />;
  }

  if (farmData.loadingFarms || !farmData.activeFarm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-sm">
        Đang đồng bộ dữ liệu trang trại...
      </div>
    );
  }

  const activeFarm = farmData.activeFarm;

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      farm={activeFarm}
      userEmail={farmData.user.email || ''}
      userName={farmData.user.displayName || 'Chủ trang trại'}
      role={farmData.currentRole}
      isOnline={isOnline}
      hasPendingSync={farmData.hasPendingSync}
      theme={ui.theme}
      onToggleTheme={ui.toggleTheme}
      reminders={farmData.reminders}
      pushPermission={push.permission}
      onRequestPush={push.requestPermission}
      onTriggerPushCheck={push.triggerManualReminderCheck}
      onLogout={farmData.logout}
    >
      {activeTab === 'dashboard' && (
        <DashboardView
          farm={activeFarm}
          userUid={farmData.user.uid}
          userName={farmData.user.displayName || 'Chủ trang trại'}
          role={farmData.currentRole}
          sows={farmData.sows}
          pigLitters={farmData.pigLitters}
          pigGroups={farmData.pigGroups}
          feedTypes={farmData.feedTypes}
          feedRations={farmData.feedRations}
          vaccinationPrograms={farmData.vaccinationPrograms}
          healthLogs={farmData.healthLogs}
          inventoryItems={farmData.inventoryItems}
          transactions={farmData.transactions}
          journalEntries={farmData.journalEntries}
          reminders={farmData.reminders}
          pushPermission={push.permission}
          onRequestPush={push.requestPermission}
          onNavigate={setActiveTab}
          onLoadSampleData={farmData.loadSampleData}
          onSaveSubDoc={farmData.saveSubDoc}
          onDeleteSubDoc={farmData.deleteSubDoc}
        />
      )}

      {activeTab === 'herd' && (
        <HerdView
          farm={activeFarm}
          role={farmData.currentRole}
          barns={farmData.barns}
          breeds={farmData.breeds}
          sows={farmData.sows}
          sowEvents={farmData.sowEvents}
          pigLitters={farmData.pigLitters}
          pigGroups={farmData.pigGroups}
          onCreateSow={farmData.createSow}
          onRecordSowBreeding={farmData.recordSowBreeding}
          onCompleteSowEvent={farmData.completeSowEvent}
          onWeanLitterToGroup={farmData.weanLitterToGroup}
          onSaveSubDoc={farmData.saveSubDoc}
          onDeleteSubDoc={farmData.deleteSubDoc}
          onRecordFinancialTx={farmData.recordFinancialTransaction}
        />
      )}

      {activeTab === 'health' && (
        <HealthView
          role={farmData.currentRole}
          sows={farmData.sows}
          pigGroups={farmData.pigGroups}
          vaccines={farmData.vaccines}
          vaccinationPrograms={farmData.vaccinationPrograms}
          healthLogs={farmData.healthLogs}
          onSaveSubDoc={farmData.saveSubDoc}
          onSaveBatchSubDocs={farmData.saveBatchSubDocs}
          onDeleteSubDoc={farmData.deleteSubDoc}
        />
      )}

      {activeTab === 'inventory' && (
        <InventoryView
          role={farmData.currentRole}
          items={farmData.inventoryItems}
          transactions={farmData.inventoryTx}
          pigGroups={farmData.pigGroups}
          onSaveSubDoc={farmData.saveSubDoc}
          onDeleteSubDoc={farmData.deleteSubDoc}
          onRecordMovement={farmData.recordInventoryMovement}
        />
      )}

      {activeTab === 'reports' && (
        <ReportsView
          farm={activeFarm}
          role={farmData.currentRole}
          transactions={farmData.transactions}
          pigGroups={farmData.pigGroups}
          onRecordTx={farmData.recordFinancialTransaction}
          onDeleteTx={(id) => farmData.deleteSubDoc('transactions', id)}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsView
          userUid={farmData.user.uid}
          farm={activeFarm}
          role={farmData.currentRole}
          staff={farmData.staff}
          barns={farmData.barns}
          breeds={farmData.breeds}
          vaccines={farmData.vaccines}
          feedTypes={farmData.feedTypes}
          feedRations={farmData.feedRations}
          vaccinationPrograms={farmData.vaccinationPrograms}
          backups={farmData.backups}
          theme={ui.theme}
          onToggleTheme={ui.toggleTheme}
          font={ui.font}
          onFontChange={ui.setFont}
          fontScale={ui.fontScale}
          onFontScaleChange={ui.setFontScale}
          pushPermission={push.permission}
          pushEnabled={push.enabled}
          onTogglePush={push.toggleEnabled}
          onRequestPush={push.requestPermission}
          onTriggerPushCheck={push.triggerManualReminderCheck}
          onUpdateFarm={farmData.updateFarmSettings}
          onSaveStaff={farmData.addOrUpdateStaff}
          onSaveSubDoc={farmData.saveSubDoc}
          onSaveBatchSubDocs={farmData.saveBatchSubDocs}
          onDeleteSubDoc={farmData.deleteSubDoc}
          onManualBackup={() => farmData.createCloudBackup('manual')}
          onLoadSampleData={farmData.loadSampleData}
          onResetDatabase={farmData.resetFarmDatabase}
          exportAllSnapshotJson={() => ({
            exportedAt: new Date().toISOString(),
            farm: activeFarm,
            sows: farmData.sows,
            sowEvents: farmData.sowEvents,
            pigLitters: farmData.pigLitters,
            pigGroups: farmData.pigGroups,
            healthLogs: farmData.healthLogs,
            inventoryItems: farmData.inventoryItems,
            inventoryTx: farmData.inventoryTx,
            transactions: farmData.transactions,
            journalEntries: farmData.journalEntries,
            barns: farmData.barns,
            breeds: farmData.breeds,
            vaccines: farmData.vaccines,
            feedTypes: farmData.feedTypes,
            feedRations: farmData.feedRations,
            vaccinationPrograms: farmData.vaccinationPrograms,
          })}
        />
      )}
    </AppShell>
  );
}
