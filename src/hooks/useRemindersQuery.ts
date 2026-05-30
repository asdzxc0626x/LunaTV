import { getAllReminders } from '@/lib/db.client';

// 修改点：统一 reminders 查询 key，供用户菜单和想看列表复用
export const remindersQueryKey = ['reminders'] as const;

export async function remindersQueryOptions() {
  return {
    queryKey: remindersQueryKey,
    queryFn: getAllReminders,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  };
}

export async function getRemindersArray() {
  const reminders = await getAllReminders();
  return Object.entries(reminders).map(([key, reminder]) => ({
    key,
    ...reminder,
  }));
}

export async function getReminderStatus(source: string, id: string) {
  const reminders = await getAllReminders();
  return !!reminders[`${source}+${id}`];
}
