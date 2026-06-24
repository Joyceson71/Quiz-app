'use client';

import { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Trophy, Award, Target, Clock, BarChart3, Download,
  GraduationCap, CheckCircle2, XCircle, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import type { Participant } from '@/lib/supabase/types';
import { getRankEmoji, formatDate } from '@/lib/utils';
import Link from 'next/link';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function ResultPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const certRef = useRef<HTMLDivElement>(null);

  const [participant, setParticipant] = useState<Participant | null>(null);
  const [room, setRoom] = useState<{ room_name: string; room_code: string } | null>(null);
  const [isGeneratingCert, setIsGeneratingCert] = useState(false);

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
  }, [supabase, roomId, router]);

  const downloadCertificate = async () => {
    if (!certRef.current || !participant) return;
    setIsGeneratingCert(true);

    try {
      const canvas = await html2canvas(certRef.current, {
        useCORS: true,
        background: '#0a0a0a',
      } as Parameters<typeof html2canvas>[1]);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`certificate_${participant.student_name.replace(/\s+/g, '_')}.pdf`);
    } catch {
      console.error('Certificate generation failed');
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
                {isGeneratingCert ? 'Generating...' : 'Download Certificate'}
              </Button>
            )}
          </div>
        </motion.div>
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
                CSE & IT Quiz Competition
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
