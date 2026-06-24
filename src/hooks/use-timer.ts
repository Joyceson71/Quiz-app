'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TIMER_WARNING_SECONDS } from '@/lib/constants';

interface UseTimerProps {
  quizStartTime: string | null;
  durationMinutes: number;
  onTimeUp: () => void;
  onWarning?: () => void;
}

interface UseTimerReturn {
  remainingSeconds: number;
  isWarning: boolean;
  isExpired: boolean;
  formattedTime: string;
  progress: number;
}

export function useTimer({
  quizStartTime,
  durationMinutes,
  onTimeUp,
  onWarning,
}: UseTimerProps): UseTimerReturn {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(durationMinutes * 60);
  const [isWarning, setIsWarning] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const warningFiredRef = useRef(false);
  const expiredFiredRef = useRef(false);
  const totalSeconds = durationMinutes * 60;

  const calculateRemaining = useCallback(() => {
    if (!quizStartTime) return totalSeconds;

    const startTime = new Date(quizStartTime).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - startTime) / 1000);
    const remaining = Math.max(0, totalSeconds - elapsed);

    return remaining;
  }, [quizStartTime, totalSeconds]);

  // Sync timer with server on mount
  useEffect(() => {
    if (!quizStartTime) return;

    const syncWithServer = async () => {
      try {
        const supabase = createClient();
        // Use Supabase's server time by querying
        const { data } = await supabase.rpc('get_server_time' as never);
        if (data) {
          const serverTime = new Date(data as string).getTime();
          const startTime = new Date(quizStartTime).getTime();
          const elapsed = Math.floor((serverTime - startTime) / 1000);
          const remaining = Math.max(0, totalSeconds - elapsed);
          setRemainingSeconds(remaining);
        }
      } catch {
        // Fallback to client time
        setRemainingSeconds(calculateRemaining());
      }
    };

    syncWithServer();
  }, [quizStartTime, totalSeconds, calculateRemaining]);

  // Countdown tick
  useEffect(() => {
    if (!quizStartTime) return;

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setRemainingSeconds(remaining);

      // Warning at 5 minutes
      if (remaining <= TIMER_WARNING_SECONDS && !warningFiredRef.current) {
        warningFiredRef.current = true;
        setIsWarning(true);
        onWarning?.();
      }

      // Time's up
      if (remaining <= 0 && !expiredFiredRef.current) {
        expiredFiredRef.current = true;
        setIsExpired(true);
        clearInterval(interval);
        onTimeUp();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [quizStartTime, calculateRemaining, onTimeUp, onWarning]);

  // Format time
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Progress (1 = full, 0 = done)
  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;

  return {
    remainingSeconds,
    isWarning,
    isExpired,
    formattedTime,
    progress,
  };
}
