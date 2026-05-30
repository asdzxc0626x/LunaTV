/* eslint-disable @next/next/no-img-element */
'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import ContinueWatchingGrid from './ContinueWatchingGrid';

interface ContinueWatchingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// 修改点：继续观看弹窗组件，使用网格布局版本的 ContinueWatchingGrid 组件
export const ContinueWatchingModal: React.FC<ContinueWatchingModalProps> = ({
  isOpen,
  onClose,
}) => {
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

  // 修改点：监听点击事件，点击卡片时关闭弹窗
  useEffect(() => {
    if (!isOpen) return;

    const handleCardClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 检查是否点击了视频卡片或其子元素
      const videoCard = target.closest('[data-video-card]');
      if (videoCard) {
        // 延迟关闭弹窗，确保路由跳转先执行
        setTimeout(() => {
          onClose();
        }, 100);
      }
    };

    document.addEventListener('click', handleCardClick);
    return () => {
      document.removeEventListener('click', handleCardClick);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className='fixed inset-0 z-[9999] flex items-center justify-center'>
      {/* 修改点：遮罩层 */}
      <div
        className='absolute inset-0 bg-black/50 backdrop-blur-sm'
        onClick={onClose}
      />

      {/* 修改点：弹窗内容 */}
      <div className='relative z-10 w-full max-w-6xl max-h-[85vh] mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col'>
        {/* 修改点：标题栏 */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800'>
          <h2 className='text-xl font-bold text-gray-900 dark:text-white'>
            继续观看
          </h2>
          <button
            onClick={onClose}
            className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
          >
            <X className='w-5 h-5 text-gray-500 dark:text-gray-400' />
          </button>
        </div>

        {/* 修改点：内容区域 - 使用网格布局版本的 ContinueWatchingGrid 组件 */}
        <div className='flex-1 overflow-y-auto px-6 py-4'>
          <ContinueWatchingGrid />
        </div>
      </div>
    </div>,
    document.body
  );
};
