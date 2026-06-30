'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MAX_TAB_SWITCHES } from '@/lib/constants';

interface AntiCheatState {
  tabSwitchCount: number;
  isFullscreen: boolean;
  showWarning: boolean;
  warningMessage: string;
  shouldAutoSubmit: boolean;
  autoSubmitReason: string;
}

interface AntiCheatContextType extends AntiCheatState {
  dismissWarning: () => void;
  requestFullscreen: () => Promise<void>;
  logViolation: (type: string, description: string) => Promise<void>;
}

const AntiCheatContext = createContext<AntiCheatContextType | null>(null);

export function useAntiCheatContext() {
  const context = useContext(AntiCheatContext);
  if (!context) {
    throw new Error('useAntiCheatContext must be used within AntiCheatProvider');
  }
  return context;
}

interface AntiCheatProviderProps {
  children: React.ReactNode;
  participantId: string;
  roomId: string;
  enabled?: boolean;
}

export function AntiCheatProvider({
  children,
  participantId,
  roomId,
  enabled = true,
}: AntiCheatProviderProps) {
  const supabase = createClient();
  const [state, setState] = useState<AntiCheatState>({
    tabSwitchCount: 0,
    isFullscreen: false,
    showWarning: false,
    warningMessage: '',
    shouldAutoSubmit: false,
    autoSubmitReason: '',
  });

  const tabSwitchRef = useRef(0);

  const logViolation = useCallback(async (type: string, description: string) => {
    try {
      await supabase.from('violations').insert({
        participant_id: participantId,
        room_id: roomId,
        violation_type: type,
        description,
      });
      if (type === 'tab_switch') {
        await supabase.from('activity_logs').insert({
          participant_id: participantId,
          room_id: roomId,
          event_type: 'tab_switch',
          event_data: { description },
        });
      }
    } catch (err) {
      console.error('Failed to log violation:', err);
    }
  }, [supabase, participantId, roomId]);

  const dismissWarning = useCallback(() => {
    setState(prev => ({ ...prev, showWarning: false, warningMessage: '' }));
  }, []);

  const requestFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setState(prev => ({ ...prev, isFullscreen: true }));
    } catch (err) {
      console.error('Failed to enter fullscreen:', err);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Detect touch/mobile devices — many mobile anti-cheat measures
    // cause false positives (keyboard opening fires blur, long-press fires
    // contextmenu, etc.), so we apply a reduced rule-set on mobile.
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      ('ontouchstart' in window) ||
      (navigator.maxTouchPoints > 0);

    // --- Copy/Paste/Cut Protection ---
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      logViolation('copy_attempt', 'Attempted to copy content');
    };
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      logViolation('paste_attempt', 'Attempted to paste content');
    };
    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      logViolation('cut_attempt', 'Attempted to cut content');
    };

    // Right-click (contextmenu) is intentionally NOT blocked.
    // On mobile, long-press fires contextmenu and would cause false violations.
    // On desktop the browser's native context menu is harmless for a quiz.

    // --- Keyboard Restrictions (desktop only, no effect on mobile) ---
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block F12
      if (e.key === 'F12') {
        e.preventDefault();
        logViolation('devtools_attempt', 'Pressed F12');
        return;
      }
      // Block Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
        e.preventDefault();
        logViolation('devtools_attempt', `Pressed Ctrl+Shift+${e.key.toUpperCase()}`);
        return;
      }
      // Block Ctrl+U (View Source)
      if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        logViolation('devtools_attempt', 'Pressed Ctrl+U');
        return;
      }
      // Block Ctrl+C, Ctrl+V, Ctrl+X
      if (e.ctrlKey && ['c', 'C'].includes(e.key)) {
        e.preventDefault();
        logViolation('copy_attempt', 'Pressed Ctrl+C');
        return;
      }
      if (e.ctrlKey && ['v', 'V'].includes(e.key)) {
        e.preventDefault();
        logViolation('paste_attempt', 'Pressed Ctrl+V');
        return;
      }
      if (e.ctrlKey && ['x', 'X'].includes(e.key)) {
        e.preventDefault();
        logViolation('cut_attempt', 'Pressed Ctrl+X');
        return;
      }
    };

    // --- Tab Switch Detection (via visibilitychange only) ---
    // We use ONLY visibilitychange — NOT window blur — to count tab switches.
    // This avoids double-counting (both events fire on desktop tab switch)
    // and avoids false positives on mobile (blur fires when keyboard opens).
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchRef.current += 1;
        const count = tabSwitchRef.current;
        logViolation('tab_switch', `Tab switch #${count}`);

        if (count >= MAX_TAB_SWITCHES) {
          setState(prev => ({
            ...prev,
            tabSwitchCount: count,
            shouldAutoSubmit: true,
            autoSubmitReason: 'auto_submit_tab_switch',
            showWarning: true,
            warningMessage: `You have switched tabs ${MAX_TAB_SWITCHES} times. Your quiz will be auto-submitted.`,
          }));
        } else {
          setState(prev => ({
            ...prev,
            tabSwitchCount: count,
            showWarning: true,
            warningMessage: `Warning: Tab switch detected (${count}/${MAX_TAB_SWITCHES}). After ${MAX_TAB_SWITCHES} switches, your quiz will be auto-submitted!`,
          }));
        }
      }
    };

    // Window blur is only monitored on desktop.
    // On mobile, the soft keyboard, notification shade, app switcher, etc.
    // all trigger blur events that are NOT actual tab switches.
    // We also guard with !document.hidden to avoid double-counting with
    // the visibilitychange handler above.
    const handleWindowBlur = () => {
      if (isMobile) return; // skip entirely on mobile
      if (document.hidden) return; // already counted via visibilitychange

      tabSwitchRef.current += 1;
      const count = tabSwitchRef.current;
      logViolation('focus_loss', `Window lost focus #${count}`);

      if (count >= MAX_TAB_SWITCHES) {
        setState(prev => ({
          ...prev,
          tabSwitchCount: count,
          shouldAutoSubmit: true,
          autoSubmitReason: 'auto_submit_focus_loss',
          showWarning: true,
          warningMessage: `You have lost window focus ${MAX_TAB_SWITCHES} times. Your quiz will be auto-submitted.`,
        }));
      } else {
        setState(prev => ({
          ...prev,
          tabSwitchCount: count,
          showWarning: true,
          warningMessage: `Warning: Window focus lost (${count}/${MAX_TAB_SWITCHES}). Please keep this window active! After ${MAX_TAB_SWITCHES} violations, your quiz will be auto-submitted.`,
        }));
      }
    };

    // --- Fullscreen Detection ---
    // Fullscreen is not applicable on most mobile browsers (they don't
    // support the Fullscreen API), so we skip fullscreen tracking on mobile.
    const handleFullscreenChange = () => {
      if (isMobile) return; // mobile browsers don't support fullscreen properly
      if (!document.fullscreenElement) {
        setState(prev => ({ ...prev, isFullscreen: false }));
      } else {
        setState(prev => ({ ...prev, isFullscreen: true }));
      }
    };

    // Add event listeners
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);
    // contextmenu is intentionally NOT blocked (see comment above)
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('blur', handleWindowBlur);

    // Disable text selection via CSS
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };
  }, [enabled, logViolation]);

  return (
    <AntiCheatContext.Provider
      value={{
        ...state,
        dismissWarning,
        requestFullscreen,
        logViolation,
      }}
    >
      {children}
      {/* Warning Modal */}
      {state.showWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-red-500/30 bg-gradient-to-br from-gray-900 to-gray-800 p-8 shadow-2xl shadow-red-500/20">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
                <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-red-400">⚠️ Warning!</h2>
            </div>
            <p className="mb-6 text-gray-300 leading-relaxed">{state.warningMessage}</p>
            {!state.shouldAutoSubmit && (
              <button
                onClick={() => {
                  dismissWarning();
                }}
                className="w-full rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-red-500/30"
              >
                I Understand — Continue Quiz
              </button>
            )}
            {state.shouldAutoSubmit && (
              <p className="text-center text-sm text-red-400 animate-pulse">
                Auto-submitting your quiz...
              </p>
            )}
          </div>
        </div>
      )}
    </AntiCheatContext.Provider>
  );
}
