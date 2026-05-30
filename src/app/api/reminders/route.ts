/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { Reminder } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * GET /api/reminders
 *
 * 支持两种调用方式：
 * 1. 不带 query，返回全部提醒列表（Record<string, Reminder>）。
 * 2. 带 key=source+id，返回单条提醒（Reminder | null）。
 */
export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getConfig();
    if (authInfo.username !== process.env.USERNAME) {
      const user = config.UserConfig.Users.find(
        (u) => u.username === authInfo.username
      );
      if (!user) {
        return NextResponse.json({ error: '用户不存在' }, { status: 401 });
      }
      if (user.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (key) {
      const [source, id] = key.split('+');
      if (!source || !id) {
        return NextResponse.json({ error: 'Invalid key format' }, { status: 400 });
      }
      const reminder = await db.getReminder(authInfo.username, source, id);
      return NextResponse.json(reminder, { status: 200 });
    }

    const reminders = await db.getAllReminders(authInfo.username);

    // 修改点：读取旧数据时补齐可选字段，避免迁移阶段前端因缺字段崩溃
    const upgradedReminders: Record<string, Reminder> = {};
    for (const [reminderKey, reminder] of Object.entries(reminders)) {
      upgradedReminders[reminderKey] = {
        ...reminder,
        search_title: reminder.search_title || reminder.title,
        origin: reminder.origin || 'vod',
        type: reminder.type || undefined,
        releaseDate: reminder.releaseDate || '',
        remarks: reminder.remarks || undefined,
      };
    }

    return NextResponse.json(upgradedReminders, { status: 200 });
  } catch (err) {
    console.error('获取提醒失败', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reminders
 * body: { key: string; reminder: Reminder }
 */
export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getConfig();
    if (authInfo.username !== process.env.USERNAME) {
      const user = config.UserConfig.Users.find(
        (u) => u.username === authInfo.username
      );
      if (!user) {
        return NextResponse.json({ error: '用户不存在' }, { status: 401 });
      }
      if (user.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }
    }

    const body = await request.json();
    const { key, reminder }: { key: string; reminder: Reminder } = body;

    if (!key || !reminder) {
      return NextResponse.json(
        { error: 'Missing key or reminder' },
        { status: 400 }
      );
    }

    // 修改点：上映提醒必须依赖 title/source_name/releaseDate 才能正常工作
    if (!reminder.title || !reminder.source_name || !reminder.releaseDate) {
      return NextResponse.json(
        { error: 'Invalid reminder data' },
        { status: 400 }
      );
    }

    const [source, id] = key.split('+');
    if (!source || !id) {
      return NextResponse.json({ error: 'Invalid key format' }, { status: 400 });
    }

    const finalReminder: Reminder = {
      ...reminder,
      search_title: reminder.search_title || reminder.title,
      save_time: reminder.save_time ?? Date.now(),
      origin: reminder.origin || 'vod',
    };

    await db.saveReminder(authInfo.username, source, id, finalReminder);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('保存提醒失败', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reminders
 *
 * 1. 不带 query -> 清空全部提醒
 * 2. 带 key=source+id -> 删除单条提醒
 */
export async function DELETE(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getConfig();
    if (authInfo.username !== process.env.USERNAME) {
      const user = config.UserConfig.Users.find(
        (u) => u.username === authInfo.username
      );
      if (!user) {
        return NextResponse.json({ error: '用户不存在' }, { status: 401 });
      }
      if (user.banned) {
        return NextResponse.json({ error: '用户已被封禁' }, { status: 401 });
      }
    }

    const username = authInfo.username;
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (key) {
      const [source, id] = key.split('+');
      if (!source || !id) {
        return NextResponse.json({ error: 'Invalid key format' }, { status: 400 });
      }
      await db.deleteReminder(username, source, id);
    } else {
      await db.deleteAllReminders(username);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('删除提醒失败', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
