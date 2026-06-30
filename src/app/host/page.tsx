'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, ArrowLeft, Plus, Trash2, Upload, CheckCircle2,
  GraduationCap, Clock, Users, Loader2, FileText, Sparkles,
  ChevronDown, ChevronUp, Home,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Link from 'next/link';

// ─── Types ──────────────────────────────────────────────────────────────────

interface QuestionDraft {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  marks: number;
}

const EMPTY_QUESTION = (): QuestionDraft => ({
  id: Math.random().toString(36).slice(2),
  question: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct_answer: 'A',
  marks: 1,
});

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const steps = ['Room Setup', 'Add Questions', 'Launch'];
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {steps.map((label, i) => {
        const num = i + 1;
        const isActive = step === num;
        const isDone = step > num;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all ${
                isDone ? 'bg-emerald-500 text-white' :
                isActive ? 'bg-blue-500 text-white ring-4 ring-blue-500/20' :
                'bg-white/10 text-muted-foreground'
              }`}>
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : num}
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-16 h-0.5 mb-4 mx-1 ${isDone ? 'bg-emerald-500' : 'bg-white/10'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Question Card ───────────────────────────────────────────────────────────

function QuestionCard({
  q, index, onChange, onRemove, isOnlyOne,
}: {
  q: QuestionDraft;
  index: number;
  onChange: (id: string, field: keyof QuestionDraft, value: string | number) => void;
  onRemove: (id: string) => void;
  isOnlyOne: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const optionLabels: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
  const optionColors = ['text-blue-400', 'text-violet-400', 'text-emerald-400', 'text-orange-400'];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 text-sm font-bold">{index + 1}</span>
          <span className="text-sm font-medium truncate max-w-[200px] sm:max-w-xs text-muted-foreground">
            {q.question || 'Untitled question'}
          </span>
          {q.correct_answer && (
            <span className="hidden sm:inline text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5">
              Ans: {q.correct_answer}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed(c => !c)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          {!isOnlyOne && (
            <button
              type="button"
              onClick={() => onRemove(q.id)}
              className="text-muted-foreground hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="p-4 space-y-4"
          >
            {/* Question text */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Question *</Label>
              <textarea
                value={q.question}
                onChange={e => onChange(q.id, 'question', e.target.value)}
                placeholder="Type your question here..."
                rows={2}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
              />
            </div>

            {/* Options grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {optionLabels.map((letter, oi) => {
                const fieldKey = `option_${letter.toLowerCase()}` as keyof QuestionDraft;
                const isCorrect = q.correct_answer === letter;
                return (
                  <div key={letter} className="space-y-1">
                    <Label className={`text-xs font-semibold ${optionColors[oi]}`}>Option {letter} {isCorrect ? '✓' : ''}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={q[fieldKey] as string}
                        onChange={e => onChange(q.id, fieldKey, e.target.value)}
                        placeholder={`Option ${letter}`}
                        className={`h-9 rounded-xl border-white/10 bg-white/5 text-sm transition-all ${isCorrect ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => onChange(q.id, 'correct_answer', letter)}
                        className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-bold transition-all ${
                          isCorrect
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-white/10 bg-white/5 text-muted-foreground hover:border-emerald-500/50'
                        }`}
                        title={`Set ${letter} as correct answer`}
                      >
                        {letter}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Marks */}
            <div className="flex items-center gap-3">
              <Label className="text-xs text-muted-foreground">Marks</Label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 5].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onChange(q.id, 'marks', m)}
                    className={`h-8 w-10 rounded-lg border text-xs font-semibold transition-all ${
                      q.marks === m
                        ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                        : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── CSV Parser ──────────────────────────────────────────────────────────────

function parseCSV(text: string): QuestionDraft[] {
  const lines = text.trim().split('\n').filter(l => l.trim());
  // Skip header if it looks like one
  const startIdx = lines[0]?.toLowerCase().includes('question') ? 1 : 0;
  const results: QuestionDraft[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    // Expected: question, option_a, option_b, option_c, option_d, correct_answer, [marks]
    if (cols.length < 6) continue;
    const [question, option_a, option_b, option_c, option_d, correct_answer, marksStr] = cols;
    const ca = correct_answer?.toUpperCase() as 'A' | 'B' | 'C' | 'D';
    if (!['A', 'B', 'C', 'D'].includes(ca)) continue;
    results.push({
      id: Math.random().toString(36).slice(2),
      question, option_a, option_b, option_c, option_d,
      correct_answer: ca,
      marks: parseInt(marksStr) || 1,
    });
  }
  return results;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function HostPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1 state
  const [roomName, setRoomName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [maxParticipants, setMaxParticipants] = useState(100);

  // Step 2 state
  const [questions, setQuestions] = useState<QuestionDraft[]>([EMPTY_QUESTION()]);

  // Step 3 state — result
  const [createdRoom, setCreatedRoom] = useState<{ id: string; room_code: string; room_name: string } | null>(null);
  const [hostToken, setHostToken] = useState('');

  // ── Handlers ──

  const updateQuestion = useCallback((id: string, field: keyof QuestionDraft, value: string | number) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  }, []);

  const addQuestion = () => {
    if (questions.length >= 50) { toast.error('Maximum 50 questions allowed'); return; }
    setQuestions(prev => [...prev, EMPTY_QUESTION()]);
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
  };

  const removeQuestion = useCallback((id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  }, []);

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (!parsed.length) {
        toast.error('No valid questions found. Check the CSV format.');
        return;
      }
      setQuestions(prev => {
        // Replace blank questions, keep ones with content
        const hasContent = prev.filter(q => q.question.trim());
        return [...hasContent, ...parsed].slice(0, 50);
      });
      toast.success(`Imported ${parsed.length} questions from CSV`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const validateStep1 = () => {
    if (!roomName.trim()) { toast.error('Room name is required'); return false; }
    if (durationMinutes < 1 || durationMinutes > 180) { toast.error('Duration must be 1–180 minutes'); return false; }
    if (maxParticipants < 1 || maxParticipants > 1000) { toast.error('Max participants must be 1–1000'); return false; }
    return true;
  };

  const validateStep2 = () => {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) { toast.error(`Question ${i + 1}: question text is required`); return false; }
      if (!q.option_a.trim() || !q.option_b.trim() || !q.option_c.trim() || !q.option_d.trim()) {
        toast.error(`Question ${i + 1}: all four options are required`); return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/host/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_name: roomName.trim(),
          duration_minutes: durationMinutes,
          max_participants: maxParticipants,
          questions: questions.map(({ id: _id, ...q }) => q),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to create room'); return; }

      setCreatedRoom(data.room);
      setHostToken(data.host_token);

      // Persist host token so the manage page can read it
      localStorage.setItem(`host_token_${data.room.id}`, data.host_token);

      setStep(3);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ──

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Backgrounds */}
      <div className="bg-mesh-gradient fixed inset-0 -z-10" />
      <div className="bg-dot-pattern fixed inset-0 -z-10" />
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      {/* Back to home */}
      <div className="fixed top-4 left-4 z-50">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <Home className="h-4 w-4" /> Home
          </Button>
        </Link>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-16 pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-2xl shadow-violet-500/30">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold">Host a Quiz</h1>
          <p className="mt-2 text-muted-foreground">Create a custom quiz room in minutes — no account needed.</p>
        </motion.div>

        <StepIndicator step={step} />

        <AnimatePresence mode="wait">

          {/* ── STEP 1: Room Setup ─────────────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass rounded-2xl p-6 space-y-6"
            >
              <div className="space-y-1">
                <h2 className="text-lg font-bold">Room Details</h2>
                <p className="text-sm text-muted-foreground">Configure your quiz room settings.</p>
              </div>

              {/* Room Name */}
              <div className="space-y-2">
                <Label htmlFor="room_name" className="flex items-center gap-2 text-sm font-medium">
                  <GraduationCap className="h-3.5 w-3.5 text-violet-400" /> Room Name *
                </Label>
                <Input
                  id="room_name"
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  placeholder="e.g. Computer Science Quiz — Batch 2024"
                  className="h-11 rounded-xl border-white/10 bg-white/5"
                  maxLength={80}
                />
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-3.5 w-3.5 text-blue-400" /> Duration (minutes)
                </Label>
                <div className="flex items-center gap-3">
                  {[10, 15, 20, 30, 45, 60].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDurationMinutes(d)}
                      className={`flex-1 h-10 rounded-xl border text-sm font-semibold transition-all ${
                        durationMinutes === d
                          ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                          : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Custom:</span>
                  <Input
                    type="number"
                    value={durationMinutes}
                    onChange={e => setDurationMinutes(Number(e.target.value))}
                    className="h-9 w-24 rounded-xl border-white/10 bg-white/5 text-sm"
                    min={1}
                    max={180}
                  />
                  <span className="text-xs text-muted-foreground">min</span>
                </div>
              </div>

              {/* Max Participants */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-3.5 w-3.5 text-emerald-400" /> Max Participants
                </Label>
                <div className="flex items-center gap-3">
                  {[30, 60, 100, 200, 300].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMaxParticipants(n)}
                      className={`flex-1 h-10 rounded-xl border text-sm font-semibold transition-all ${
                        maxParticipants === n
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                          : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => { if (validateStep1()) setStep(2); }}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold text-base shadow-lg shadow-violet-500/25"
              >
                Next: Add Questions <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {/* ── STEP 2: Questions ──────────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Toolbar */}
              <div className="glass rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex-1">
                  <h2 className="font-bold">Questions <span className="text-muted-foreground text-sm">({questions.length}/50)</span></h2>
                  <p className="text-xs text-muted-foreground">Click the letter buttons to mark the correct answer.</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCSVUpload} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2 rounded-xl border-white/10 text-xs"
                  >
                    <Upload className="h-3.5 w-3.5" /> Import CSV
                  </Button>
                  <Button
                    size="sm"
                    onClick={addQuestion}
                    className="gap-2 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30 hover:bg-violet-500/30 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Question
                  </Button>
                </div>
              </div>

              {/* CSV Format hint */}
              <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-3 text-xs text-muted-foreground">
                <span className="text-blue-400 font-semibold flex items-center gap-1.5 mb-1">
                  <FileText className="h-3.5 w-3.5" /> CSV Format
                </span>
                <code className="block font-mono opacity-70">question, option_a, option_b, option_c, option_d, correct_answer, [marks]</code>
              </div>

              {/* Questions list */}
              <AnimatePresence>
                {questions.map((q, i) => (
                  <QuestionCard
                    key={q.id}
                    q={q}
                    index={i}
                    onChange={updateQuestion}
                    onRemove={removeQuestion}
                    isOnlyOne={questions.length === 1}
                  />
                ))}
              </AnimatePresence>

              {/* Add button */}
              <button
                type="button"
                onClick={addQuestion}
                className="w-full rounded-2xl border border-dashed border-white/20 py-4 text-sm text-muted-foreground hover:border-violet-500/40 hover:text-violet-400 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> Add another question
              </button>

              {/* Navigation */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-xl border-white/10 h-12"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg shadow-emerald-500/20"
                >
                  {isSubmitting
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
                    : <><CheckCircle2 className="mr-2 h-4 w-4" /> Create Room</>
                  }
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: Success ────────────────────────────────────────── */}
          {step === 3 && createdRoom && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-2xl p-8 text-center space-y-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-green-600 shadow-2xl shadow-emerald-500/30"
              >
                <CheckCircle2 className="h-10 w-10 text-white" />
              </motion.div>

              <div>
                <h2 className="text-2xl font-extrabold text-emerald-400">Room Created! 🎉</h2>
                <p className="mt-1 text-muted-foreground">{createdRoom.room_name}</p>
              </div>

              {/* Room Code */}
              <div className="rounded-2xl bg-blue-500/10 border border-blue-500/20 p-4">
                <p className="text-xs text-muted-foreground mb-2">Share this code with participants</p>
                <p className="text-5xl font-extrabold font-mono tracking-widest text-blue-400">{createdRoom.room_code}</p>
                <p className="text-xs text-muted-foreground mt-2">at <span className="text-blue-400 font-mono">{typeof window !== 'undefined' ? window.location.origin : ''}/login</span></p>
              </div>

              {/* Warning about token */}
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-left">
                <p className="text-xs font-semibold text-amber-400 mb-1">⚠️ Save your Host Link</p>
                <p className="text-xs text-muted-foreground">
                  This is the only way to manage your room. It is saved in this browser, but copy it to be safe.
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => router.push(`/host/manage/${createdRoom.id}`)}
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold shadow-lg"
                >
                  Open Host Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const url = `${window.location.origin}/host/manage/${createdRoom.id}?token=${hostToken}`;
                    navigator.clipboard.writeText(url);
                    toast.success('Host link copied!');
                  }}
                  className="rounded-xl border-white/10"
                >
                  Copy Host Link
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
