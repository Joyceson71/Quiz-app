'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MAX_TAB_SWITCHES, MAX_FULLSCREEN_EXITS } from '@/lib/constants';

interface AntiCheatState {
  tabSwitchCount: number;
  fullscreenExitCount: number;
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
    fullscreenExitCount: 0,
    isFullscreen: false,
    showWarning: false,
    warningMessage: '',
    shouldAutoSubmit: false,
    autoSubmitReason: '',
  });

  const tabSwitchRef = useRef(0);
  const fullscreenExitRef = useRef(0);

  const logViolation = useCallback(async (type: string, description: string) => {
    try {
      await supabase.from('violations').insert({
        participant_id: participantId,
        room_id: roomId,
        violation_type: type,
        description,
      });
      await supabase.from('activity_logs').insert({
        participant_id: participantId,
        room_id: roomId,
        event_type: type === 'tab_switch' ? 'tab_switch' : 'fullscreen_exit',
        event_data: { description },
      });
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

    // --- Right Click Protection ---
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logViolation('right_click', 'Attempted right-click');
    };

    // --- Keyboard Restrictions ---
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

    // --- Tab Switch Detection ---
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

    const handleWindowBlur = () => {
      // Also triggers on window blur alongside visibilitychange
    };

    // --- Fullscreen Detection ---
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        fullscreenExitRef.current += 1;
        const count = fullscreenExitRef.current;
        logViolation('fullscreen_exit', `Fullscreen exit #${count}`);

        if (count >= MAX_FULLSCREEN_EXITS) {
          setState(prev => ({
            ...prev,
            fullscreenExitCount: count,
            isFullscreen: false,
            shouldAutoSubmit: true,
            autoSubmitReason: 'auto_submit_fullscreen',
            showWarning: true,
            warningMessage: `You have exited fullscreen ${MAX_FULLSCREEN_EXITS} times. Your quiz will be auto-submitted.`,
          }));
        } else {
          setState(prev => ({
            ...prev,
            fullscreenExitCount: count,
            isFullscreen: false,
            showWarning: true,
            warningMessage: `Warning: Fullscreen exit detected (${count}/${MAX_FULLSCREEN_EXITS}). After ${MAX_FULLSCREEN_EXITS} exits, your quiz will be auto-submitted! Click "Continue" to return to fullscreen.`,
          }));
          // Try to re-enter fullscreen after a brief delay
          setTimeout(() => {
            document.documentElement.requestFullscreen().catch(() => {});
          }, 1000);
        }
      } else {
        setState(prev => ({ ...prev, isFullscreen: true }));
      }
    };

    // Add event listeners
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);
    document.addEventListener('contextmenu', handleContextMenu);
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
      document.removeEventListener('contextmenu', handleContextMenu);
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
                  requestFullscreen();
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
