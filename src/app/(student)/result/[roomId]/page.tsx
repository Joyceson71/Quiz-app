'use client';

import { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Trophy, Award, Target, Clock, BarChart3, Download,
  GraduationCap, CheckCircle2, XCircle, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import type { Participant } from '@/lib/supabase/types';
import { getRankEmoji, formatDate } from '@/lib/utils';
import Link from 'next/link';
import jsPDF from 'jspdf';
import * as htmlToImage from 'html-to-image';

export default function ResultPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const certRef = useRef<HTMLDivElement>(null);

  const [participant, setParticipant] = useState<Participant | null>(null);
  const [room, setRoom] = useState<{ room_name: string; room_code: string } | null>(null);
  const [isGeneratingCert, setIsGeneratingCert] = useState(false);
  const [reviewData, setReviewData] = useState<any[]>([]);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('participant');
    if (!stored) {
      router.push('/login');
      return;
    }
    const p = JSON.parse(stored) as Participant;

    // Fetch fresh participant data with score
    supabase
      .from('participants')
      .select('*')
      .eq('id', p.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setParticipant(data);
          localStorage.setItem('participant', JSON.stringify(data));
        }
      });

    supabase
      .from('rooms')
      .select('room_name, room_code')
      .eq('id', roomId)
      .single()
      .then(({ data }) => {
        if (data) setRoom(data);
      });

    // Fetch review data
    fetch(`/api/quiz/review?room_id=${roomId}&participant_id=${p.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.review) setReviewData(data.review);
      });
  }, [supabase, roomId, router]);

  const downloadCertificate = async () => {
    if (!certRef.current || !participant) return;
    setIsGeneratingCert(true);

    try {
      // Handle Next.js / Turbopack CJS/ESM interop for jsPDF
      // @ts-ignore
      const JsPDF = typeof jsPDF === 'function' ? jsPDF : jsPDF.jsPDF || window.jspdf?.jsPDF;
      const pdf = new JsPDF('landscape', 'mm', 'a4');
      
      const width = pdf.internal.pageSize.getWidth();
      const height = pdf.internal.pageSize.getHeight();
      
      // Background
      pdf.setFillColor(15, 23, 42); // Slate 900
      pdf.rect(0, 0, width, height, 'F');
      
      // Border
      pdf.setDrawColor(56, 189, 248); // Sky 400
      pdf.setLineWidth(2);
      pdf.rect(10, 10, width - 20, height - 20);
      
      // Title
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.text('CERTIFICATE OF ACHIEVEMENT', width / 2, 50, { align: 'center' });
      
      // Subtitle
      pdf.setTextColor(148, 163, 184); // Slate 400
      pdf.setFontSize(16);
      pdf.text('Technical Quiz Competition', width / 2, 65, { align: 'center' });
      
      // Presented to
      pdf.setFontSize(14);
      pdf.text('This certificate is proudly presented to', width / 2, 90, { align: 'center' });
      
      // Student Name
      pdf.setTextColor(250, 204, 21); // Yellow 400
      pdf.setFontSize(36);
      pdf.text(participant.student_name, width / 2, 115, { align: 'center' });
      
      // Details
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.text(`${participant.register_no} • ${participant.department} • Section ${participant.section}`, width / 2, 130, { align: 'center' });
      
      // Score
      pdf.setFontSize(16);
      pdf.text(`For achieving Rank #${participant.rank} with a score of ${participant.score}/${participant.total_marks} (${participant.percentage}%)`, width / 2, 150, { align: 'center' });
      
      // Footer
      pdf.setTextColor(100, 116, 139); // Slate 500
      pdf.setFontSize(10);
      pdf.text(`${room?.room_name || 'Quiz'} • ${new Date().toLocaleDateString()}`, width / 2, 180, { align: 'center' });
      
      pdf.save(`certificate_${participant.student_name.replace(/\s+/g, '_')}.pdf`);
    } catch (e) {
      console.error('Certificate generation failed:', e);
    } finally {
      setIsGeneratingCert(false);
    }
  };

  if (!participant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  const isTopThree = participant.rank !== null && participant.rank <= 3;
  const scoreColor = participant.percentage >= 80
    ? 'text-emerald-400'
    : participant.percentage >= 50
      ? 'text-amber-400'
      : 'text-red-400';

  return (
    <div className="relative min-h-screen bg-background p-4 pb-20">
      <div className="bg-mesh-gradient fixed inset-0 -z-10" />

      <div className="mx-auto max-w-2xl pt-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.3 }}
            className="mx-auto mb-4 text-6xl"
          >
            {participant.rank === 1 ? '🏆' : participant.rank === 2 ? '🥈' : participant.rank === 3 ? '🥉' : '🎯'}
          </motion.div>
          <h1 className="text-3xl font-bold">Quiz Completed!</h1>
          <p className="mt-1 text-muted-foreground">{room?.room_name}</p>
        </motion.div>

        {/* Score Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-3xl p-8"
        >
          {/* Score Circle */}
          <div className="mb-8 flex justify-center">
            <div className="relative flex h-40 w-40 items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                <motion.circle
                  cx="50" cy="50" r="45" fill="none"
                  stroke={participant.percentage >= 80 ? '#10b981' : participant.percentage >= 50 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${participant.percentage * 2.83} 283`}
                  initial={{ strokeDasharray: '0 283' }}
                  animate={{ strokeDasharray: `${participant.percentage * 2.83} 283` }}
                  transition={{ duration: 1.5, delay: 0.5, ease: 'easeOut' }}
                />
              </svg>
              <div className="text-center">
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className={`block text-4xl font-bold ${scoreColor}`}
                >
                  {participant.score}
                </motion.span>
                <span className="text-sm text-muted-foreground">/ {participant.total_marks}</span>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-white/5 p-4 text-center">
              <Trophy className="mx-auto mb-2 h-5 w-5 text-amber-400" />
              <p className="text-2xl font-bold">{participant.rank ? getRankEmoji(participant.rank) : 'N/A'}</p>
              <p className="text-xs text-muted-foreground">Rank</p>
            </div>
            <div className="rounded-xl bg-white/5 p-4 text-center">
              <Target className="mx-auto mb-2 h-5 w-5 text-blue-400" />
              <p className={`text-2xl font-bold ${scoreColor}`}>{participant.percentage}%</p>
              <p className="text-xs text-muted-foreground">Percentage</p>
            </div>
            <div className="rounded-xl bg-white/5 p-4 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-emerald-400" />
              <p className="text-2xl font-bold text-emerald-400">{participant.score}</p>
              <p className="text-xs text-muted-foreground">Correct</p>
            </div>
            <div className="rounded-xl bg-white/5 p-4 text-center">
              <XCircle className="mx-auto mb-2 h-5 w-5 text-red-400" />
              <p className="text-2xl font-bold text-red-400">{participant.total_marks - participant.score}</p>
              <p className="text-xs text-muted-foreground">Wrong</p>
            </div>
          </div>

          {/* Student Info */}
          <div className="mt-6 rounded-xl bg-white/5 p-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{participant.student_name}</span></div>
              <div><span className="text-muted-foreground">Register:</span> <span className="font-medium">{participant.register_no}</span></div>
              <div><span className="text-muted-foreground">Department:</span> <span className="font-medium">{participant.department}</span></div>
              <div><span className="text-muted-foreground">Section:</span> <span className="font-medium">{participant.section}</span></div>
              {participant.submission_time && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Submitted:</span>{' '}
                  <span className="font-medium">{formatDate(participant.submission_time)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href={`/leaderboard/${roomId}`} className="flex-1">
              <Button className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white">
                <BarChart3 className="mr-2 h-4 w-4" /> View Leaderboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            {isTopThree && (
              <Button
                onClick={downloadCertificate}
                disabled={isGeneratingCert}
                variant="outline"
                className="rounded-xl border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              >
                <Download className="mr-2 h-4 w-4" />
                {isGeneratingCert ? 'Generating...' : 'Certificate'}
              </Button>
            )}
            {reviewData.length > 0 && (
              <Button
                onClick={() => setShowReview(!showReview)}
                variant="outline"
                className="rounded-xl border-white/10 flex-1"
              >
                {showReview ? 'Hide Review' : 'Detailed Review'}
              </Button>
            )}
          </div>
        </motion.div>

        {/* Detailed Review Section */}
        {showReview && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 space-y-4"
          >
            <h2 className="text-xl font-bold mb-4">Detailed Review</h2>
            {reviewData.map((q: any, i: number) => (
              <div key={q.id} className="glass rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-sm font-medium text-muted-foreground">Question {i + 1}</span>
                  {q.is_correct ? (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Correct
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                      <XCircle className="mr-1 h-3 w-3" /> Incorrect
                    </Badge>
                  )}
                </div>
                <p className="font-medium mb-4">{q.question}</p>
                <div className="space-y-2">
                  {['A', 'B', 'C', 'D'].map((opt) => {
                    const isSelected = q.selected_answer === opt;
                    const isCorrect = q.correct_answer === opt;
                    let bgClass = 'bg-white/5 border-white/5';
                    let textClass = 'text-muted-foreground';
                    
                    if (isCorrect) {
                      bgClass = 'bg-emerald-500/20 border-emerald-500/30';
                      textClass = 'text-emerald-400 font-medium';
                    } else if (isSelected && !isCorrect) {
                      bgClass = 'bg-red-500/20 border-red-500/30';
                      textClass = 'text-red-400';
                    }

                    return (
                      <div key={opt} className={`p-3 rounded-lg border ${bgClass} flex items-center gap-3`}>
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${isCorrect ? 'bg-emerald-500 text-white' : isSelected ? 'bg-red-500 text-white' : 'bg-white/10'}`}>
                          {opt}
                        </div>
                        <span className={`text-sm ${textClass}`}>
                          {q[`option_${opt.toLowerCase()}`]}
                        </span>
                        {isSelected && !isCorrect && <XCircle className="ml-auto h-4 w-4 text-red-400" />}
                        {isCorrect && <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-400" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Hidden Certificate Template */}
      {isTopThree && (
        <div className="fixed -left-[9999px]">
          <div
            ref={certRef}
            style={{
              width: '1122px',
              height: '794px',
              background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
              padding: '40px',
              fontFamily: 'Inter, sans-serif',
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Decorative elements */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
              background: 'linear-gradient(90deg, #2563eb, #7c3aed, #06b6d4, #10b981)',
            }} />
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px',
              background: 'linear-gradient(90deg, #10b981, #06b6d4, #7c3aed, #2563eb)',
            }} />

            <div style={{ textAlign: 'center', paddingTop: '40px' }}>
              <div style={{ fontSize: '14px', color: '#94a3b8', letterSpacing: '4px', textTransform: 'uppercase' }}>
                Certificate of Achievement
              </div>
              <div style={{ fontSize: '42px', fontWeight: 'bold', marginTop: '20px', background: 'linear-gradient(to right, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Technical Quiz Competition
              </div>
              <div style={{ fontSize: '16px', color: '#94a3b8', marginTop: '8px' }}>
                This certificate is proudly presented to
              </div>
              <div style={{ fontSize: '36px', fontWeight: 'bold', marginTop: '30px', color: '#fbbf24' }}>
                {participant.student_name}
              </div>
              <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '8px' }}>
                {participant.register_no} • {participant.department} • Section {participant.section}
              </div>
              <div style={{ marginTop: '30px', fontSize: '20px' }}>
                for achieving <span style={{ color: '#10b981', fontWeight: 'bold' }}>Rank #{participant.rank}</span> with a score of{' '}
                <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{participant.score}/{participant.total_marks}</span> ({participant.percentage}%)
              </div>
              <div style={{ fontSize: '60px', marginTop: '20px' }}>
                {participant.rank === 1 ? '🏆' : participant.rank === 2 ? '🥈' : '🥉'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '40px' }}>
                {room?.room_name} • {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
