'use client';

/**
 * Telegram Mini App Provider
 *
 * React context that wraps Telegram Mini App SDK integration.
 * Detects if running inside Telegram, initializes the SDK,
 * provides Telegram user info, and exposes MainButton/BackButton/HapticFeedback.
 * Falls back gracefully when running outside Telegram (normal web mode).
 */

import {
  type BackButton,
  backButton,
  type HapticFeedback,
  hapticFeedback,
  type InitData,
  init,
  initData,
  type MainButton,
  type MiniApp,
  mainButton,
  miniApp,
  type ThemeParams,
  themeParams,
} from '@telegram-apps/sdk';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// ─── Types ─────────────────────────────────────────────────────────────

export interface TelegramContextValue {
  /** Whether the Telegram SDK has been initialized */
  ready: boolean;
  /** Whether the app is running inside Telegram */
  isTelegram: boolean;
  /** Whether the app is running as a standalone web app (outside Telegram) */
  isStandalone: boolean;
  /** Telegram init data (user, authDate, hash, etc.) */
  initData: InitData | undefined;
  /** Telegram user info (if available) */
  user: InitData['user'] | undefined;
  /** Current Telegram theme params */
  theme: ThemeParams | undefined;
  /** Mini App API */
  miniApp: MiniApp | undefined;
  /** MainButton API */
  mainButton: MainButton | undefined;
  /** BackButton API */
  backButton: BackButton | undefined;
  /** HapticFeedback API */
  hapticFeedback: HapticFeedback | undefined;
  /** Show a toast/notification (works in both Telegram and standalone modes) */
  showNotification: (text: string) => void;
  /** Close the Mini App */
  closeApp: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────

const TelegramContext = createContext<TelegramContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [isTelegram, setIsTelegram] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [data, setData] = useState<InitData | undefined>(undefined);
  const [miniAppApi, setMiniAppApi] = useState<MiniApp | undefined>(undefined);
  const [mainButtonApi, setMainButtonApi] = useState<MainButton | undefined>(undefined);
  const [backButtonApi, setBackButtonApi] = useState<BackButton | undefined>(undefined);
  const [hapticFeedbackApi, setHapticFeedbackApi] = useState<HapticFeedback | undefined>(undefined);

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      // Initialize Telegram Mini App SDK
      init();

      if (!miniApp.ready.isAvailable()) {
        // Not running inside Telegram — standalone mode
        setIsStandalone(true);
        setIsTelegram(false);
        setReady(true);
        return;
      }

      // Signal Telegram that the Mini App is ready
      miniApp.ready();
      setMiniAppApi(miniApp);
      setIsTelegram(true);
      setIsStandalone(false);

      // Get init data (contains user, start params, etc.)
      const iData = initData();
      setData(iData);

      // Expose MainButton
      if (mainButton.isSupported()) {
        setMainButtonApi(mainButton);
      }

      // Expose BackButton
      if (backButton.isSupported()) {
        setBackButtonApi(backButton);
      }

      // Expose HapticFeedback
      if (hapticFeedback.isSupported()) {
        setHapticFeedbackApi(hapticFeedback);
      }

      // Bind Telegram theme params as CSS variables
      if (themeParams.bindCssVars.isAvailable()) {
        themeParams.bindCssVars();
      }

      setReady(true);
    } catch (err) {
      console.warn('[TelegramProvider] Failed to initialize Telegram SDK:', err);
      setIsStandalone(true);
      setIsTelegram(false);
      setReady(true);
    }
  }, []);

  const showNotification = useCallback(
    (text: string) => {
      if (miniAppApi) {
        // In Telegram, show a popup
        try {
          miniAppApi.showPopup({ message: text, buttons: [{ type: 'ok' }] });
          return;
        } catch {
          // fall through to alert
        }
      }
      // Fallback for standalone
      if (typeof window !== 'undefined') {
        alert(text);
      }
    },
    [miniAppApi],
  );

  const closeApp = useCallback(() => {
    if (miniAppApi) {
      miniAppApi.close();
    } else {
      // Fallback — try window.close
      window.close();
    }
  }, [miniAppApi]);

  const value = useMemo<TelegramContextValue>(
    () => ({
      ready,
      isTelegram,
      isStandalone,
      initData: data,
      user: data?.user,
      theme: themeParams,
      miniApp: miniAppApi,
      mainButton: mainButtonApi,
      backButton: backButtonApi,
      hapticFeedback: hapticFeedbackApi,
      showNotification,
      closeApp,
    }),
    [
      ready,
      isTelegram,
      isStandalone,
      data,
      miniAppApi,
      mainButtonApi,
      backButtonApi,
      hapticFeedbackApi,
      showNotification,
      closeApp,
    ],
  );

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useTelegram(): TelegramContextValue {
  const ctx = useContext(TelegramContext);
  if (!ctx) {
    throw new Error('useTelegram must be used within a TelegramProvider');
  }
  return ctx;
}

export function useIsTelegram(): boolean {
  const ctx = useContext(TelegramContext);
  return ctx?.isTelegram ?? false;
}
