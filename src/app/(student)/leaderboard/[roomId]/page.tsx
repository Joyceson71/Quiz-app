'use client';

import { useEffect, useState, useCallback, useRef, use } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ArrowLeft, Users, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import type { LeaderboardEntry } from '@/lib/supabase/types';
import { getRankEmoji, formatDate } from '@/lib/utils';
import Link from 'next/link';

export default function LeaderboardPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [roomName, setRoomName] = useState('');
  const [roomStartTime, setRoomStartTime] = useState<string | null>(null);
  const [currentParticipantId, setCurrentParticipantId] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    const { data } = await supabase.rpc('get_leaderboard', {
      target_room_id: roomId,
    });
    if (data) {
      setEntries(data as LeaderboardEntry[]);
    }

    const { data: room } = await supabase
      .from('rooms')
      .select('room_name, quiz_start_time')
      .eq('id', roomId)
      .single();
    if (room) {
      setRoomName(room.room_name);
      setRoomStartTime(room.quiz_start_time);
    }

    setIsLoading(false);
  }, [supabase, roomId]);

  useEffect(() => {
    const stored = localStorage.getItem('participant');
    if (stored) {
      const p = JSON.parse(stored);
      setCurrentParticipantId(p.id);
    }
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`leaderboard-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, roomId, fetchLeaderboard]);

  const getRankBadgeClass = (rank: number) => {
    if (rank === 1) return 'rank-gold';
    if (rank === 2) return 'rank-silver';
    if (rank === 3) return 'rank-bronze';
    return 'bg-white/10';
  };

  return (
    <div className="relative min-h-screen bg-background p-4">
      <div className="bg-mesh-gradient fixed inset-0 -z-10" />

      <div className="mx-auto max-w-3xl pt-4">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link href={`/result/${roomId}`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <div className="text-center">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Trophy className="h-6 w-6 text-amber-400" /> Leaderboard
            </h1>
            <p className="text-sm text-muted-foreground">{roomName}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchLeaderboard} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {entries.length} submissions
          <span className="ml-2 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400">Live</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
        ) : (
          /* Leaderboard List */
          <div className="space-y-2">
            <AnimatePresence>
              {entries.map((entry, index) => {
                const isCurrentUser = entry.participant_id === currentParticipantId;
                const isTop3 = entry.rank <= 3;

                return (
                  <motion.div
                    key={entry.participant_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.03 }}
                    layout
                    className={`glass flex items-center gap-4 rounded-xl p-4 transition-all ${
                      isCurrentUser ? 'ring-2 ring-blue-500/50 bg-blue-500/5' : ''
                    } ${isTop3 ? 'border-amber-500/20' : ''}`}
                  >
                    {/* Rank */}
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${getRankBadgeClass(entry.rank)}`}>
                      {isTop3 ? getRankEmoji(entry.rank) : entry.rank}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">
                          {entry.student_name}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-blue-400">(You)</span>
                          )}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {entry.department} • {entry.register_no}
                      </p>
                    </div>

                    {/* Score */}
                    <div className="text-right flex flex-col items-end gap-1">
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-lg font-bold text-blue-400">{entry.score}/20</p>
                          <p className="text-xs font-medium text-emerald-400">{entry.percentage}% Accuracy</p>
                        </div>
                      </div>
                      {roomStartTime && entry.submission_time && (
                        <p className="text-[10px] text-muted-foreground mt-1 bg-white/5 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Math.max(1, Math.round((new Date(entry.submission_time).getTime() - new Date(roomStartTime).getTime()) / 60000))} mins
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {entries.length === 0 && !isLoading && (
          <div className="py-20 text-center text-muted-foreground">
            <Trophy className="mx-auto mb-4 h-12 w-12 opacity-20" />
            <p>No submissions yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
