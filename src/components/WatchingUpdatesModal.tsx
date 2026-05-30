/* eslint-disable @next/next/no-img-element */
'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { WatchingUpdateItem } from '@/hooks/useWatchingUpdates';

interface WatchingUpdatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  updates: WatchingUpdateItem[];
}

// 修改点：追更提醒弹窗组件，展示有更新的剧集列表
export const WatchingUpdatesModal: React.FC<WatchingUpdatesModalProps> = ({
  isOpen,
  onClose,
  updates,
}) => {
  const router = useRouter();

  // 修改点：锁定 body 滚动
  useEffect(() => {
    if (isOpen) {
      const body = document.body;
      const html = document.documentElement;
      const originalBodyOverflow = body.style.overflow;
      const originalHtmlOverflow = html.style.overflow;

      body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';

      return () => {
        body.style.overflow = originalBodyOverflow;
        html.style.overflow = originalHtmlOverflow;
      };
    }
  }, [isOpen]);

  // 修改点：处理点击剧集卡片，跳转到播放页
  const handleItemClick = (item: WatchingUpdateItem) => {
    const playUrl = `/play?source=${item.sourceKey}&id=${item.videoId}&index=${
      item.currentEpisode + 1
    }`;
    router.push(playUrl);
    onClose();
  };

  if (!isOpen) return null;

  // 修改点：只显示有新集更新的剧集
  const newEpisodeItems = updates.filter((item) => item.hasNewEpisode);

  return createPortal(
    <div className='fixed inset-0 z-[9999] flex items-center justify-center'>
      {/* 修改点：遮罩层 */}
      <div
        className='absolute inset-0 bg-black/50 backdrop-blur-sm'
        onClick={onClose}
      />

      {/* 修改点：弹窗内容 */}
      <div className='relative z-10 w-full max-w-4xl max-h-[85vh] mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col'>
        {/* 修改点：标题栏 */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800'>
          <h2 className='text-xl font-bold text-gray-900 dark:text-white'>
            追更提醒
          </h2>
          <button
            onClick={onClose}
            className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
          >
            <X className='w-5 h-5 text-gray-500 dark:text-gray-400' />
          </button>
        </div>

        {/* 修改点：内容区域 */}
        <div className='flex-1 overflow-y-auto px-6 py-4'>
          {newEpisodeItems.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400'>
              <p className='text-lg'>暂无更新</p>
            </div>
          ) : (
            <div className='space-y-6'>
              {/* 修改点：有新集更新的剧集 */}
              <div>
                <h3 className='text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2'>
                  <span className='inline-block w-1 h-4 bg-red-500 rounded-full'></span>
                  有新集更新 ({newEpisodeItems.length})
                </h3>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                  {newEpisodeItems.map((item, index) => (
                    <div
                      key={`new-${index}`}
                      onClick={() => handleItemClick(item)}
                      className='group cursor-pointer bg-gray-50 dark:bg-gray-800/50 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 hover:scale-[1.02]'
                    >
                      <div className='relative aspect-[3/4] overflow-hidden'>
                        <img
                          src={item.cover}
                          alt={item.title}
                          className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
                        />
                        {/* 修改点：新集数徽章 */}
                        <div className='absolute top-2 right-2 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg'>
                          +{item.newEpisodes}集
                        </div>
                      </div>
                      <div className='p-3'>
                        <h4 className='font-medium text-sm text-gray-900 dark:text-white line-clamp-1 mb-1'>
                          {item.title}
                        </h4>
                        <p className='text-xs text-gray-500 dark:text-gray-400 mb-1'>
                          {item.source_name} · {item.year}
                        </p>
                        <p className='text-xs text-gray-600 dark:text-gray-300'>
                          看到第 {item.currentEpisode} 集 → 已更新至第{' '}
                          {item.latestEpisodes} 集
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
