import {
  clearAllReminders,
  deleteReminder,
  generateStorageKey,
  getAllReminders,
  Reminder,
  saveReminder,
} from '@/lib/db.client';

// 修改点：提供不依赖 React Query 的提醒 mutation 封装，适配当前 LunaTV 未全局接入 QueryProvider 的结构
export async function addReminderMutation(
  source: string,
  id: string,
  reminder: Reminder
) {
  await saveReminder(source, id, reminder);
  return getAllReminders();
}

export async function removeReminderMutation(source: string, id: string) {
  await deleteReminder(source, id);
  return getAllReminders();
}

export async function clearRemindersMutation() {
  await clearAllReminders();
  return {};
}

export async function toggleReminderMutation(
  source: string,
  id: string,
  reminder: Reminder
) {
  const key = generateStorageKey(source, id);
  const reminders = await getAllReminders();

  if (reminders[key]) {
    await deleteReminder(source, id);
    return false;
  }

  await saveReminder(source, id, reminder);
  return true;
}
