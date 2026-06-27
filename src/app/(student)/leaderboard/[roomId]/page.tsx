'use client';

import { useEffect, useState, useCallback, useRef, use } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ArrowLeft, Users, RefreshCw, Clock, ArrowUp, ArrowDown } from 'lucide-react';
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
  const [prevRanks, setPrevRanks] = useState<Record<string, number>>({});
  const [recentUpdate, setRecentUpdate] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    const { data } = await supabase.rpc('get_leaderboard', {
      target_room_id: roomId,
    });
    if (data) {
      setEntries(prev => {
        if (prev.length > 0) {
          const ranks: Record<string, number> = {};
          prev.forEach(e => { ranks[e.participant_id] = e.rank; });
          setPrevRanks(ranks);
        }
        return data as LeaderboardEntry[];
      });
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
        (payload) => {
          const updatedRow = payload.new as { id?: string };
          if (updatedRow && updatedRow.id) {
            setRecentUpdate(updatedRow.id);
            setTimeout(() => setRecentUpdate(null), 3000);
          }
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
              {entries.map((entry) => {
                const isCurrentUser = entry.participant_id === currentParticipantId;
                const isTop3 = entry.rank <= 3;
                const prevRank = prevRanks[entry.participant_id];
                const rankDiff = prevRank ? prevRank - entry.rank : 0;
                const isRecentlyUpdated = recentUpdate === entry.participant_id;

                let rowClasses = `glass flex items-center gap-4 rounded-xl p-4 transition-colors relative overflow-hidden`;
                if (isRecentlyUpdated) {
                  rowClasses += ` ring-2 ring-emerald-500 bg-emerald-500/20 z-10`;
                } else if (isCurrentUser) {
                  rowClasses += ` ring-1 ring-blue-500/50 bg-blue-500/10`;
                } else if (isTop3) {
                  rowClasses += ` border-amber-500/20`;
                }

                return (
                  <motion.div
                    key={entry.participant_id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ 
                      opacity: 1, 
                      x: 0,
                      scale: isRecentlyUpdated ? 1.02 : 1
                    }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{
                      layout: { type: "spring", bounce: 0.5, duration: 1 },
                      scale: { duration: 0.3 }
                    }}
                    style={{ zIndex: isRecentlyUpdated ? 10 : 1 }}
                    className={rowClasses}
                  >
                    {/* Animated shine effect for updates */}
                    {isRecentlyUpdated && (
                      <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: '200%' }}
                        transition={{ duration: 1, ease: "easeInOut" }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent -skew-x-12"
                      />
                    )}
                    {/* Rank */}
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${getRankBadgeClass(entry.rank)}`}>
                      {isTop3 ? getRankEmoji(entry.rank) : entry.rank}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`truncate font-bold ${isRecentlyUpdated ? 'text-emerald-50' : ''}`}>
                          {entry.student_name}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-blue-400">(You)</span>
                          )}
                        </p>
                        {rankDiff > 0 && (
                          <motion.span 
                            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} 
                            className="flex items-center text-xs font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full"
                          >
                            <ArrowUp className="h-3 w-3 mr-0.5" /> {rankDiff}
                          </motion.span>
                        )}
                        {rankDiff < 0 && (
                          <motion.span 
                            initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} 
                            className="flex items-center text-xs font-bold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full"
                          >
                            <ArrowDown className="h-3 w-3 mr-0.5" /> {Math.abs(rankDiff)}
                          </motion.span>
                        )}
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
