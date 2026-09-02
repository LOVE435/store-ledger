import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { Clipboard } from '@capacitor/clipboard';

export type WechatJumpResult =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'no-handler' | 'error' };

export async function openWechatChat(wechatId: string): Promise<WechatJumpResult> {
  if (!wechatId.trim()) return { ok: false, reason: 'missing' };
  const url = `weixin://dl/chat?username=${encodeURIComponent(wechatId.trim())}`;
  try {
    if (Capacitor.isNativePlatform()) {
      const can = await AppLauncher.canOpenUrl({ url });
      if (!can.value) return { ok: false, reason: 'no-handler' };
      await AppLauncher.openUrl({ url });
      return { ok: true };
    }
    window.location.href = url;
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function copyAndOpenWechat(text: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Clipboard.write({ string: text });
      const can = await AppLauncher.canOpenUrl({ url: 'weixin://' });
      if (can.value) {
        await AppLauncher.openUrl({ url: 'weixin://' });
        return true;
      }
    } else {
      await navigator.clipboard.writeText(text);
      window.location.href = 'weixin://';
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
