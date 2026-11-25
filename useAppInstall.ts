import { useEffect, useRef, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

export function detectInstalledAppMode(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandaloneMedia =
    Boolean(window.matchMedia) &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches);
  const isIosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
    true;
  const isAndroidReferrer =
    typeof document !== 'undefined' &&
    document.referrer.includes('android-app://');

  return isStandaloneMedia || isIosStandalone || isAndroidReferrer;
}

// Module-level capture so early beforeinstallprompt events fired before React mounts are never lost
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let globalIsInstalled: boolean =
  typeof window !== 'undefined' ? detectInstalledAppMode() : false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    globalIsInstalled = true;
    globalDeferredPrompt = null;
    notifyListeners();
  });
}

export function useAppInstall() {
  const [isInstalledMode, setIsInstalledMode] = useState<boolean>(
    () => globalIsInstalled || detectInstalledAppMode()
  );
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(() => globalDeferredPrompt);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installUnsupported, setInstallUnsupported] = useState(false);
  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const syncState = () => {
      const installedNow = globalIsInstalled || detectInstalledAppMode();
      setIsInstalledMode(installedNow);
      setDeferredPrompt(globalDeferredPrompt);
      if (globalDeferredPrompt || installedNow) {
        setInstallUnsupported(false);
      }
    };

    listeners.add(syncState);
    syncState();

    const mediaQuery =
      window.matchMedia && window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        globalIsInstalled = true;
        globalDeferredPrompt = null;
        syncState();
      }
    };

    if (mediaQuery && mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    }

    return () => {
      listeners.delete(syncState);
      if (mediaQuery && mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      }
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const showUnsupportedBrief = () => {
    setInstallUnsupported(true);
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setInstallUnsupported(false);
    }, 5000);
  };

  const installApp = async (): Promise<boolean> => {
    if (isInstalledMode) return false;
    const promptEvent = globalDeferredPrompt || deferredPrompt;

    if (!promptEvent) {
      showUnsupportedBrief();
      return false;
    }

    setInstallUnsupported(false);
    try {
      setIsInstalling(true);
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      globalDeferredPrompt = null;
      if (choice.outcome === 'accepted') {
        globalIsInstalled = true;
        setIsInstalledMode(true);
      }
      notifyListeners();
      return choice.outcome === 'accepted';
    } catch {
      globalDeferredPrompt = null;
      notifyListeners();
      showUnsupportedBrief();
      return false;
    } finally {
      setIsInstalling(false);
    }
  };

  return {
    isInstalledMode,
    hasNativePrompt: Boolean(deferredPrompt),
    isInstalling,
    installUnsupported,
    installApp,
  };
}
