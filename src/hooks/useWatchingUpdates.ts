import { getAllPlayRecords, getAllReminders, PlayRecord, Reminder } from '@/lib/db.client';

export interface WatchingUpdateItem {
  title: string;
  source_name: string;
  year: string;
  cover: string;
  sourceKey: string;
  videoId: string;
  currentEpisode: number;
  totalEpisodes: number;
  hasNewEpisode: boolean;
  hasContinueWatching: boolean;
  hasNewRelease: boolean;
  newEpisodes?: number;
  remainingEpisodes?: number;
  latestEpisodes?: number;
  remarks?: string;
  releaseDate?: string;
}

export interface WatchingUpdate {
  hasUpdates: boolean;
  timestamp: number;
  updatedCount: number;
  continueWatchingCount: number;
  newReleasesCount: number;
  updatedSeries: WatchingUpdateItem[];
}

function getTodayInShanghai(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function buildSourceMap(sources: Array<{ key?: string; name?: string }>) {
  const map = new Map<string, string>();
  sources.forEach((source) => {
    if (source.key && source.name) {
      map.set(source.name, source.key);
    }
  });
  return map;
}

async function fetchSourceMap(): Promise<Map<string, string>> {
  try {
    const response = await fetch('/api/sources');
    if (!response.ok) return new Map();
    const sources = await response.json();
    return buildSourceMap(Array.isArray(sources) ? sources : []);
  } catch (error) {
    console.warn('获取资源站映射失败:', error);
    return new Map();
  }
}

async function checkSingleRecordUpdate(
  recordKey: string,
  record: PlayRecord,
  sourceKey: string,
  videoId: string
) {
  try {
    const cacheKey = Math.floor(Date.now() / 600000) * 600000;
    const response = await fetch(
      `/api/detail?source=${sourceKey}&id=${videoId}&_t=${cacheKey}`,
      {
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return null;
    }

    const detailData = await response.json();
    const latestEpisodes = detailData.episodes ? detailData.episodes.length : 0;
    const originalEpisodes =
      record.original_episodes && record.original_episodes > 0
        ? record.original_episodes
        : record.total_episodes;
    const protectedTotalEpisodes = Math.max(
      latestEpisodes,
      originalEpisodes,
      record.total_episodes
    );
    const hasNewEpisode = latestEpisodes > originalEpisodes;
    const newEpisodes = hasNewEpisode ? latestEpisodes - originalEpisodes : 0;
    const hasContinueWatching = record.index < protectedTotalEpisodes;
    const remainingEpisodes = hasContinueWatching
      ? protectedTotalEpisodes - record.index
      : 0;

    return {
      title: record.title,
      source_name: record.source_name,
      year: record.year,
      cover: record.cover,
      sourceKey,
      videoId,
      currentEpisode: record.index,
      totalEpisodes: protectedTotalEpisodes,
      hasNewEpisode,
      hasContinueWatching,
      hasNewRelease: false,
      newEpisodes,
      remainingEpisodes,
      latestEpisodes: protectedTotalEpisodes,
      remarks: record.remarks,
    } as WatchingUpdateItem;
  } catch (error) {
    console.warn(`检查播放记录更新失败: ${record.title}`, error);
    return null;
  }
}

function buildReminderItems(
  reminders: Record<string, Reminder>,
  playRecordKeys: Set<string>
): WatchingUpdateItem[] {
  const today = getTodayInShanghai();

  return Object.entries(reminders)
    .filter(([key, reminder]) => {
      return !!reminder.releaseDate && reminder.releaseDate <= today && !playRecordKeys.has(key);
    })
    .map(([key, reminder]) => {
      const [sourceKey, videoId] = key.split('+');
      return {
        title: reminder.title,
        source_name: reminder.source_name,
        year: reminder.year,
        cover: reminder.cover,
        sourceKey,
        videoId,
        currentEpisode: 0,
        totalEpisodes: reminder.total_episodes,
        hasNewEpisode: false,
        hasContinueWatching: false,
        hasNewRelease: true,
        releaseDate: reminder.releaseDate,
        remarks: reminder.remarks,
      } as WatchingUpdateItem;
    });
}

// 修改点：迁移基础版追更检查逻辑，统一输出用户菜单所需的红点与更新列表
export async function getWatchingUpdates(): Promise<WatchingUpdate> {
  const playRecords = await getAllPlayRecords();
  const reminders = await getAllReminders();
  const sourceMap = await fetchSourceMap();

  const playRecordEntries = Object.entries(playRecords);
  const playRecordKeys = new Set(playRecordEntries.map(([key]) => key));

  const recordResults = await Promise.all(
    playRecordEntries
      .filter(([, record]) => record.total_episodes > 1)
      .map(async ([key, record]) => {
        const [sourceName, videoId] = key.split('+');
        const sourceKey = sourceMap.get(sourceName) || sourceName;
        return checkSingleRecordUpdate(key, record, sourceKey, videoId);
      })
  );

  const validRecordResults = recordResults.filter(
    (item): item is WatchingUpdateItem => !!item
  );
  const reminderResults = buildReminderItems(reminders, playRecordKeys);
  const updatedSeries = [...validRecordResults, ...reminderResults].filter(
    (item) => item.hasNewEpisode || item.hasContinueWatching || item.hasNewRelease
  );

  const updatedCount = updatedSeries.filter((item) => item.hasNewEpisode).length;
  const continueWatchingCount = updatedSeries.filter(
    (item) => item.hasContinueWatching
  ).length;
  const newReleasesCount = updatedSeries.filter((item) => item.hasNewRelease).length;

  return {
    hasUpdates: updatedSeries.length > 0,
    timestamp: Date.now(),
    updatedCount,
    continueWatchingCount,
    newReleasesCount,
    updatedSeries,
  };
}
