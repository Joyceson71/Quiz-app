'use client';

import { useEffect, useState, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Send,
  AlertTriangle,
  CheckCircle2,
  Maximize,
  Volume2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AntiCheatProvider, useAntiCheatContext } from '@/components/providers/anti-cheat-provider';
import { useTimer } from '@/hooks/use-timer';
import { createClient } from '@/lib/supabase/client';
import type { Participant, Room, QuestionSafe } from '@/lib/supabase/types';
import { toast } from 'sonner';

function QuizContent({ roomId }: { roomId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const { shouldAutoSubmit, autoSubmitReason, requestFullscreen } = useAntiCheatContext();

  const [room, setRoom] = useState<Room | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [questions, setQuestions] = useState<QuestionSafe[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const submittedRef = useRef(false);

  // Load data
  useEffect(() => {
    const storedParticipant = localStorage.getItem('participant');
    const storedRoom = localStorage.getItem('room');

    if (!storedParticipant || !storedRoom) {
      router.push('/login');
      return;
    }

    const p = JSON.parse(storedParticipant) as Participant;
    const r = JSON.parse(storedRoom) as Room;
    setParticipant(p);
    setRoom(r);

    // Fetch fresh room data
    supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()
      .then(({ data }) => {
        if (data) setRoom(data);
      });

    // Fetch questions
    fetch(`/api/quiz/questions?room_id=${roomId}&participant_id=${p.id}`)
      .then(res => res.json())
      .then(data => {
        setQuestions(data.questions || []);
        setAnswers(data.existing_answers || {});
        setIsLoaded(true);
      })
      .catch(() => toast.error('Failed to load questions'));

    // Request fullscreen
    requestFullscreen();

    // Log quiz start
    supabase.from('activity_logs').insert({
      participant_id: p.id,
      room_id: roomId,
      event_type: 'quiz_start',
      event_data: {},
    });
  }, [roomId, router, supabase, requestFullscreen]);

  // Submit quiz
  const submitQuiz = useCallback(async (reason?: string) => {
    if (submittedRef.current || isSubmitting || !participant) return;
    submittedRef.current = true;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: participant.id,
          room_id: roomId,
          auto_submit_reason: reason || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Exit fullscreen
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        toast.success(reason ? 'Quiz auto-submitted' : 'Quiz submitted successfully!');
        router.push(`/result/${roomId}`);
      } else {
        toast.error(data.error || 'Submission failed');
        submittedRef.current = false;
      }
    } catch {
      toast.error('Submission failed. Please try again.');
      submittedRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  }, [participant, roomId, router, isSubmitting]);

  // Auto-submit on anti-cheat violation
  useEffect(() => {
    if (shouldAutoSubmit && !submittedRef.current) {
      submitQuiz(autoSubmitReason);
    }
  }, [shouldAutoSubmit, autoSubmitReason, submitQuiz]);

  // Sound ref for warning
  const warningPlayedRef = useRef(false);

  // Timer
  const { formattedTime, isWarning, progress } = useTimer({
    quizStartTime: room?.quiz_start_time || null,
    durationMinutes: room?.duration_minutes || 20,
    onTimeUp: () => submitQuiz('timer_expired'),
    onWarning: () => {
      if (!warningPlayedRef.current) {
        warningPlayedRef.current = true;
        toast.warning('⏰ Only 5 minutes remaining!', { duration: 5000 });
        // Try to play sound
        try {
          const audio = new Audio('/sounds/warning.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch {}
      }
    },
  });

  // Save answer
  const saveAnswer = useCallback(async (questionId: string, answer: string) => {
    if (!participant) return;

    setAnswers(prev => ({ ...prev, [questionId]: answer }));

    try {
      await fetch('/api/quiz/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: participant.id,
          question_id: questionId,
          room_id: roomId,
          selected_answer: answer,
        }),
      });
    } catch {
      console.error('Failed to save answer');
    }
  }, [participant, roomId]);

  // Listen for room end
  useEffect(() => {
    const channel = supabase
      .channel(`quiz-room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          const newRoom = payload.new as Room;
          if (newRoom.status === 'ended' && !submittedRef.current) {
            submitQuiz('room_ended');
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, roomId, submitQuiz]);

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const progressPercent = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="mt-4 text-muted-foreground">Loading quiz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Timer Bar */}
      <div className={`sticky top-0 z-50 border-b border-white/10 backdrop-blur-xl ${isWarning ? 'bg-red-950/80' : 'bg-background/80'}`}>
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          {/* Progress */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">
              {currentIndex + 1}/{questions.length}
            </span>
            <Progress value={progressPercent} className="h-2 w-24" />
            <span className="text-xs text-muted-foreground">
              {answeredCount} answered
            </span>
          </div>

          {/* Timer */}
          <div className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-lg font-bold ${
            isWarning
              ? 'bg-red-500/20 text-red-400 timer-warning'
              : 'bg-blue-500/10 text-blue-400'
          }`}>
            <Clock className="h-4 w-4" />
            {formattedTime}
          </div>

          {/* Submit Button */}
          <Button
            onClick={() => setShowConfirmSubmit(true)}
            disabled={isSubmitting}
            size="sm"
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700"
          >
            <Send className="mr-1 h-3.5 w-3.5" /> Submit
          </Button>
        </div>
      </div>

      {/* Question Content */}
      <div className="mx-auto max-w-3xl px-4 py-8">
        <AnimatePresence mode="wait">
          {currentQuestion && (
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Question Card */}
              <div className="glass rounded-2xl p-6 md:p-8">
                <div className="mb-6">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
                    Question {currentIndex + 1} of {questions.length}
                    <span className="ml-1 text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{currentQuestion.marks} mark</span>
                  </span>
                </div>

                <h2 className="text-xl font-semibold leading-relaxed md:text-2xl">
                  {currentQuestion.question}
                </h2>
              </div>

              {/* Options */}
              <div className="mt-6 space-y-3">
                {[
                  { key: 'A', value: currentQuestion.option_a },
                  { key: 'B', value: currentQuestion.option_b },
                  { key: 'C', value: currentQuestion.option_c },
                  { key: 'D', value: currentQuestion.option_d },
                ].map((option) => {
                  const isSelected = answers[currentQuestion.id] === option.key;
                  return (
                    <motion.button
                      key={option.key}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => saveAnswer(currentQuestion.id, option.key)}
                      className={`quiz-option flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all md:p-5 ${
                        isSelected
                          ? 'selected border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
                          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
                      }`}
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                        isSelected
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/10 text-muted-foreground'
                      }`}>
                        {option.key}
                      </span>
                      <span className={`text-base ${isSelected ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {option.value}
                      </span>
                      {isSelected && (
                        <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-blue-400" />
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Navigation */}
              <div className="mt-8 flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="rounded-xl border-white/10"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                </Button>

                {/* Question dots */}
                <div className="hidden md:flex flex-wrap items-center justify-center gap-1.5 max-w-md">
                  {questions.map((q, i) => (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(i)}
                      className={`h-3 w-3 rounded-full transition-all ${
                        i === currentIndex
                          ? 'bg-blue-500 scale-125'
                          : answers[q.id]
                            ? 'bg-emerald-500/60'
                            : 'bg-white/20'
                      }`}
                    />
                  ))}
                </div>

                <Button
                  variant="outline"
                  onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                  disabled={currentIndex === questions.length - 1}
                  className="rounded-xl border-white/10"
                >
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>

              {/* Question grid (mobile) */}
              <div className="mt-4 md:hidden">
                <div className="grid grid-cols-10 gap-1.5">
                  {questions.map((q, i) => (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(i)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-all ${
                        i === currentIndex
                          ? 'bg-blue-500 text-white'
                          : answers[q.id]
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-white/5 text-muted-foreground'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Confirm Submit Dialog */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass mx-4 w-full max-w-md rounded-2xl p-8"
          >
            <div className="mb-4 flex items-center gap-3 text-amber-400">
              <AlertTriangle className="h-6 w-6" />
              <h2 className="text-xl font-bold">Submit Quiz?</h2>
            </div>
            <p className="mb-2 text-muted-foreground">
              You have answered <span className="font-bold text-foreground">{answeredCount}</span> out of{' '}
              <span className="font-bold text-foreground">{questions.length}</span> questions.
            </p>
            {answeredCount < questions.length && (
              <p className="mb-4 text-sm text-amber-400">
                ⚠️ {questions.length - answeredCount} questions are unanswered and will receive 0 marks.
              </p>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowConfirmSubmit(false)}
                className="flex-1 rounded-xl border-white/10"
              >
                Continue Quiz
              </Button>
              <Button
                onClick={() => {
                  setShowConfirmSubmit(false);
                  submitQuiz();
                }}
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white"
              >
                {isSubmitting ? 'Submitting...' : 'Confirm Submit'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default function QuizPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [participant, setParticipant] = useState<Participant | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('participant');
    if (stored) {
      setParticipant(JSON.parse(stored));
    }
  }, []);

  if (!participant) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <AntiCheatProvider
      participantId={participant.id}
      roomId={roomId}
      enabled={true}
    >
      <QuizContent roomId={roomId} />
    </AntiCheatProvider>
  );
}
