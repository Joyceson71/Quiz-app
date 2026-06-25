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
  Bookmark,
  Flag,
  Menu,
  X,
  LayoutDashboard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AntiCheatProvider, useAntiCheatContext } from '@/components/providers/anti-cheat-provider';
import { useTimer } from '@/hooks/use-timer';
import { usePresence } from '@/hooks/use-presence';
import { createClient } from '@/lib/supabase/client';
import type { Participant, Room, QuestionSafe } from '@/lib/supabase/types';
import { toast } from 'sonner';

function QuizContent({ roomId }: { roomId: string }) {
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const { shouldAutoSubmit, autoSubmitReason, requestFullscreen } = useAntiCheatContext();

  const [room, setRoom] = useState<Room | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [questions, setQuestions] = useState<QuestionSafe[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [reviewLater, setReviewLater] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const submittedRef = useRef(false);

  // Initialize presence tracking for this participant
  usePresence(roomId, participant?.id || null);

  // Load data and restore session
  useEffect(() => {
    const init = async () => {
      // Restore auth session
      const storedSession = localStorage.getItem('quiz_session');
      if (storedSession) {
        try {
          const session = JSON.parse(storedSession);
          if (session.access_token && session.refresh_token) {
            await supabase.auth.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            });
          }
        } catch (e) {
          console.error('Session restore failed:', e);
        }
      }

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
      const { data: freshRoom } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (freshRoom) setRoom(freshRoom);

      // Fetch questions
      try {
        const res = await fetch(`/api/quiz/questions?room_id=${roomId}&participant_id=${p.id}`);
        const data = await res.json();
        setQuestions(data.questions || []);
        setAnswers(data.existing_answers || {});
        setIsLoaded(true);
      } catch {
        toast.error('Failed to load questions');
      }

      // Request fullscreen
      requestFullscreen();

      try {
        await supabase.from('activity_logs').insert({
          participant_id: p.id,
          room_id: roomId,
          event_type: 'quiz_start',
          event_data: {},
        });
      } catch (e) {
        // ignore
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

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

  const toggleReviewLater = (questionId: string) => {
    setReviewLater(prev => ({ ...prev, [questionId]: !prev[questionId] }));
  };

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
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-72 shrink-0 border-r border-white/5 bg-card/50 backdrop-blur-xl md:flex flex-col">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
            <LayoutDashboard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold">{room?.room_name}</h2>
            <p className="text-xs text-muted-foreground">{participant?.student_name}</p>
          </div>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Question Navigator</h3>
            <span className="text-xs text-muted-foreground">{answeredCount}/{questions.length}</span>
          </div>
          
          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, i) => {
              const isAnswered = !!answers[q.id];
              const isReview = reviewLater[q.id];
              const isCurrent = i === currentIndex;
              
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(i)}
                  className={`relative flex h-10 w-full items-center justify-center rounded-lg text-sm font-medium transition-all ${
                    isCurrent 
                      ? 'bg-blue-500 text-white ring-2 ring-blue-500/50 ring-offset-2 ring-offset-background'
                      : isReview
                        ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                        : isAnswered
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                  }`}
                >
                  {i + 1}
                  {isReview && <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500 border-2 border-background" />}
                </button>
              );
            })}
          </div>
          
          <div className="mt-8 space-y-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-sm bg-emerald-500/20 border border-emerald-500/30" /> Answered</div>
            <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-sm bg-amber-500/20 border border-amber-500/30" /> Review Later</div>
            <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-sm bg-white/5" /> Not Visited</div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className={`sticky top-0 z-40 border-b border-white/5 backdrop-blur-xl ${isWarning ? 'bg-red-950/80' : 'bg-background/80'}`}>
          <div className="flex h-16 items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileMenuOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <Progress value={progressPercent} className="hidden md:block h-2 w-32" />
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

            <Button
              onClick={() => setShowConfirmSubmit(true)}
              disabled={isSubmitting}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700 shadow-lg shadow-emerald-500/20"
            >
              <Send className="mr-2 h-4 w-4" /> Submit Quiz
            </Button>
          </div>
        </header>

        {/* Question Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-3xl">
            <AnimatePresence mode="wait">
              {currentQuestion && (
                <motion.div
                  key={currentQuestion.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Question Card */}
                  <div className="glass rounded-2xl p-6 md:p-8 shadow-xl shadow-black/5">
                    <div className="mb-6 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-1.5 text-sm font-medium text-blue-400">
                        Question {currentIndex + 1} of {questions.length}
                        <span className="ml-1 text-muted-foreground">•</span>
                        <span className="text-muted-foreground">{currentQuestion.marks} Marks</span>
                      </span>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleReviewLater(currentQuestion.id)}
                        className={`gap-2 ${reviewLater[currentQuestion.id] ? 'text-amber-400 bg-amber-500/10' : 'text-muted-foreground'}`}
                      >
                        <Flag className={`h-4 w-4 ${reviewLater[currentQuestion.id] ? 'fill-current' : ''}`} />
                        <span className="hidden sm:inline">Review Later</span>
                      </Button>
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
                          className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all md:p-5 ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30'
                              : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                          }`}
                        >
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold shadow-sm ${
                            isSelected
                              ? 'bg-blue-500 text-white shadow-blue-500/20'
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
                  <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentIndex === 0}
                      className="rounded-xl border-white/10 h-12 px-6"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                    </Button>

                    <Button
                      onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                      disabled={currentIndex === questions.length - 1}
                      className="rounded-xl bg-white/10 hover:bg-white/20 text-foreground h-12 px-6"
                    >
                      Next <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-3/4 max-w-sm border-r border-white/10 bg-background md:hidden flex flex-col"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <span className="font-bold">Questions</span>
                <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, i) => {
                    const isAnswered = !!answers[q.id];
                    const isReview = reviewLater[q.id];
                    const isCurrent = i === currentIndex;
                    
                    return (
                      <button
                        key={q.id}
                        onClick={() => {
                          setCurrentIndex(i);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`relative flex h-10 w-full items-center justify-center rounded-lg text-sm font-medium transition-all ${
                          isCurrent 
                            ? 'bg-blue-500 text-white ring-2 ring-blue-500/50'
                            : isReview
                              ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                              : isAnswered
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-white/5 text-muted-foreground'
                        }`}
                      >
                        {i + 1}
                        {isReview && <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500 border-2 border-background" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
