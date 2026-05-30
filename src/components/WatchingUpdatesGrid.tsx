/* eslint-disable no-console */
'use client';

import { WatchingUpdateItem } from '@/hooks/useWatchingUpdates';

import VideoCard from '@/components/VideoCard';

interface WatchingUpdatesGridProps {
  updates: WatchingUpdateItem[];
  className?: string;
}

// 修改点：网格布局版本的追更提醒组件，复用 VideoCard 组件
export default function WatchingUpdatesGrid({
  updates,
  className,
}: WatchingUpdatesGridProps) {
  // 修改点：只显示有新集更新的剧集
  const newEpisodeItems = updates.filter((item) => item.hasNewEpisode);

  if (newEpisodeItems.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400'>
        <p className='text-lg'>暂无更新</p>
      </div>
    );
  }

  return (
    <section className={className || ''}>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
          有新集更新
          {/* 修改点：显示实际卡片数量 */}
          <span className='ml-2 text-sm font-normal text-gray-500 dark:text-gray-400'>
            ({newEpisodeItems.length})
          </span>
        </h2>
      </div>
      {/* 修改点：使用响应式网格布局，小屏2列，中屏3-4列，大屏最多6列 */}
      <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4'>
        {newEpisodeItems.map((item, index) => (
          <div key={`new-${index}`} className='w-full'>
            <VideoCard
              id={item.videoId}
              title={item.title}
              poster={item.cover}
              year={item.year}
              source={item.sourceKey}
              source_name={item.source_name}
              episodes={item.latestEpisodes}
              currentEpisode={item.currentEpisode}
              newEpisodes={item.newEpisodes}
              query={item.title}
              from='playrecord'
              type={item.totalEpisodes > 1 ? 'tv' : ''}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
