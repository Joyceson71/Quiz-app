'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock, Wifi, WifiOff, MessageSquare, GraduationCap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Room, Participant } from '@/lib/supabase/types';

export default function WaitingRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [room, setRoom] = useState<Room | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [dots, setDots] = useState('');

  // Load participant from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('participant');
    if (stored) {
      setParticipant(JSON.parse(stored));
    } else {
      router.push('/login');
    }
  }, [router]);

  // Fetch initial room data
  const fetchRoom = useCallback(async () => {
    const { data: roomData } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomData) {
      setRoom(roomData);
      if (roomData.status === 'active') {
        router.push(`/quiz/${roomId}`);
      }
    }

    const { count } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);

    setParticipantCount(count || 0);
  }, [supabase, roomId, router]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  // Realtime: Room status changes
  useEffect(() => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          const newRoom = payload.new as Room;
          setRoom(newRoom);
          if (newRoom.status === 'active') {
            router.push(`/quiz/${roomId}`);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` },
        () => {
          // Re-fetch count on any participant change
          supabase
            .from('participants')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', roomId)
            .then(({ count }) => setParticipantCount(count || 0));
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, roomId, router]);

  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="bg-mesh-gradient fixed inset-0 -z-10" />
      <div className="bg-dot-pattern fixed inset-0 -z-10" />

      <div className="w-full max-w-lg text-center">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-2xl shadow-blue-500/30"
        >
          <GraduationCap className="h-10 w-10 text-white" />
        </motion.div>

        {/* Waiting Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-8"
        >
          {/* Connection Status */}
          <div className="mb-6 flex items-center justify-center gap-2">
            {isConnected ? (
              <span className="flex items-center gap-2 text-sm text-emerald-400">
                <Wifi className="h-4 w-4" />
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-2 text-sm text-red-400">
                <WifiOff className="h-4 w-4" /> Reconnecting...
              </span>
            )}
          </div>

          {/* Room Info */}
          <h1 className="text-2xl font-bold">{room?.room_name || 'Loading...'}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            Room Code: <span className="font-semibold text-blue-400">{room?.room_code}</span>
          </p>

          {/* Participant Counter */}
          <motion.div
            className="mx-auto mt-8 flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/20 ring-2 ring-blue-500/30"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <div className="text-center">
              <AnimatePresence mode="wait">
                <motion.span
                  key={participantCount}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="block text-4xl font-bold text-blue-400"
                >
                  {participantCount}
                </motion.span>
              </AnimatePresence>
              <span className="text-xs text-muted-foreground">
                / {room?.max_participants || 300}
              </span>
            </div>
          </motion.div>

          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" /> Participants Joined
          </div>

          {/* Waiting Message */}
          <div className="mt-8">
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="flex items-center justify-center gap-2 text-lg font-medium text-violet-400"
            >
              <Clock className="h-5 w-5" />
              Waiting for admin to start{dots}
            </motion.div>
          </div>

          {/* Student Info */}
          {participant && (
            <div className="mt-6 rounded-xl bg-white/5 p-4 text-left text-sm">
              <p className="text-muted-foreground">
                Welcome, <span className="font-semibold text-foreground">{participant.student_name}</span>
              </p>
              <p className="text-muted-foreground">
                {participant.department} - Section {participant.section}
              </p>
              <p className="font-mono text-xs text-blue-400">
                ID: {participant.participant_code}
              </p>
            </div>
          )}

          {/* Announcement Banner */}
          {room?.announcement && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-6 rounded-xl bg-amber-500/10 border border-amber-500/20 p-4"
            >
              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-200">{room.announcement}</p>
              </div>
            </motion.div>
          )}

          {/* Quiz Details */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/5 p-3 text-center">
              <p className="text-lg font-bold text-blue-400">20</p>
              <p className="text-[10px] text-muted-foreground">Questions</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3 text-center">
              <p className="text-lg font-bold text-violet-400">{room?.duration_minutes || 20}</p>
              <p className="text-[10px] text-muted-foreground">Minutes</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3 text-center">
              <p className="text-lg font-bold text-emerald-400">1</p>
              <p className="text-[10px] text-muted-foreground">Mark Each</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
