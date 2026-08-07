// Helper for Browser Web Push Notifications & Audio Alerts

export interface NotificationSettings {
  enableBrowserPush: boolean;
  enableAudioAlert: boolean;
}

export function getNotificationSettings(): NotificationSettings {
  try {
    const push = localStorage.getItem("enable_browser_push");
    const audio = localStorage.getItem("enable_audio_alert");
    return {
      enableBrowserPush: push === null ? true : push === "true",
      enableAudioAlert: audio === null ? true : audio === "true",
    };
  } catch {
    return { enableBrowserPush: true, enableAudioAlert: true };
  }
}

export function saveNotificationSettings(settings: NotificationSettings) {
  try {
    localStorage.setItem("enable_browser_push", String(settings.enableBrowserPush));
    localStorage.setItem("enable_audio_alert", String(settings.enableAudioAlert));
  } catch (err) {
    console.warn("Failed to save notification settings", err);
  }
}

// Web Audio API Synthesizer Chime for instant audio feedback without external audio files
export function playNotificationSound() {
  try {
    const settings = getNotificationSettings();
    if (!settings.enableAudioAlert) return;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    // Subtle two-tone chime (E5 -> B5)
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

      gain.gain.setValueAtTime(0.15, ctx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };

    playTone(659.25, 0, 0.15); // E5
    playTone(880.0, 0.12, 0.25); // A5
  } catch (e) {
    console.warn("Audio chime play error:", e);
  }
}

// Request Browser Web Push Notification Permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    return "denied";
  }
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch (e) {
    console.warn("Notification request error:", e);
    return "denied";
  }
}

// Send Web Push / Desktop Notification
export function triggerDesktopNotification(title: string, body: string, tag?: string) {
  const settings = getNotificationSettings();
  if (!settings.enableBrowserPush) return;

  if ("Notification" in window && Notification.permission === "granted") {
    try {
      const n = new Notification(title, {
        body,
        icon: "/icon.png",
        tag: tag || "marine-quote-mention",
      });

      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (e) {
      console.warn("Desktop notification trigger failed:", e);
    }
  }

  // Always play audio sound if enabled
  playNotificationSound();
}
