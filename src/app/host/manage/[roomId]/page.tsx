'use client';

import { useEffect, useState, useCallback, useRef, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Square, Copy, Check, Users, UserCheck, Clock,
  Wifi, WifiOff, Send, Megaphone, RefreshCw, GraduationCap,
  Crown, ArrowUpRight, Loader2, X, Home,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import type { Room } from '@/lib/supabase/types';
import { toast } from 'sonner';
import Link from 'next/link';

interface ParticipantRow {
  id: string;
  student_name: string;
  register_no: string;
  department: string;
  section: string;
  has_submitted: boolean;
  score: number;
  percentage: number;
  rank: number | null;
  status: string;
  is_online: boolean;
  submission_time: string | null;
}

interface RoomStats {
  total: number;
  submitted: number;
  online: number;
}

// ── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number | string; icon: React.ElementType; color: string;
}) {
  return (
    <motion.div whileHover={{ y: -2 }} className="glass rounded-2xl p-5">
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </motion.div>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    waiting: { label: 'Waiting', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    active:  { label: 'Active',  cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    ended:   { label: 'Ended',   cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  };
  const s = map[status] || { label: status, cls: 'bg-white/5 text-muted-foreground border-white/10' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${s.cls}`}>
      {status === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
      {s.label}
    </span>
  );
}

// ── Inner Component (needs useSearchParams → must be inside Suspense) ────────

function HostManageInner({ roomId }: { roomId: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [stats, setStats] = useState<RoomStats>({ total: 0, submitted: 0, online: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [hostToken, setHostToken] = useState('');
  const [tokenMissing, setTokenMissing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  // Resolve host token from URL or localStorage
  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    const tokenFromStorage = localStorage.getItem(`host_token_${roomId}`);
    const resolved = tokenFromUrl || tokenFromStorage || '';
    if (!resolved) { setTokenMissing(true); setIsLoading(false); return; }
    setHostToken(resolved);
    if (tokenFromUrl) localStorage.setItem(`host_token_${roomId}`, tokenFromUrl);
  }, [roomId, searchParams]);

  const fetchData = useCallback(async (token: string) => {
    try {
      const res = await fetch(`/api/host/manage?room_id=${roomId}&token=${token}`);
      if (res.status === 401) { setTokenMissing(true); return; }
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      setRoom(data.room);
      setParticipants(data.participants);
      setStats(data.stats);
      setAnnouncement(data.room.announcement || '');
    } catch {
      toast.error('Failed to load room data');
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (hostToken) fetchData(hostToken);
  }, [hostToken, fetchData]);

  // Realtime subscriptions
  useEffect(() => {
    if (!hostToken) return;
    const channel = supabase
      .channel(`host-room-${roomId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => { setRoom(payload.new as Room); }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` },
        () => fetchData(hostToken)
      )
      .subscribe(status => setIsConnected(status === 'SUBSCRIBED'));
    return () => { supabase.removeChannel(channel); };
  }, [supabase, roomId, hostToken, fetchData]);

  const doAction = async (action: 'start' | 'end' | 'announce') => {
    if (!hostToken) return;
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/host/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          token: hostToken,
          action,
          announcement: action === 'announce' ? announcement : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      setRoom(data.room);
      if (action === 'announce') { setShowAnnouncement(false); toast.success('Announcement sent!'); }
      else toast.success(data.message);
    } catch {
      toast.error('Action failed. Please try again.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const copyRoomCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.room_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Room code copied!');
  };

  const copyJoinLink = () => {
    const url = `${window.location.origin}/login?code=${room?.room_code}`;
    navigator.clipboard.writeText(url);
    toast.success('Join link copied!');
  };

  // ── Token missing ──
  if (tokenMissing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="bg-mesh-gradient fixed inset-0 -z-10" />
        <div className="glass max-w-md w-full rounded-2xl p-8 text-center space-y-4">
          <div className="mx-auto h-14 w-14 flex items-center justify-center rounded-full bg-red-500/20">
            <X className="h-7 w-7 text-red-400" />
          </div>
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground text-sm">
            This page requires a valid host token. Use the link you received when creating the room,
            or create a new room.
          </p>
          <Link href="/host">
            <Button className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white">
              Create a New Room
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="bg-mesh-gradient fixed inset-0 -z-10" />
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!room) return null;

  const joinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/login?code=${room.room_code}`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="bg-mesh-gradient fixed inset-0 -z-10" />
      <div className="bg-dot-pattern fixed inset-0 -z-10" />

      {/* Sticky Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between h-16 px-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">{room.room_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Host Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isConnected
              ? <span className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400"><Wifi className="h-3.5 w-3.5" /> Live</span>
              : <span className="hidden sm:flex items-center gap-1.5 text-xs text-red-400"><WifiOff className="h-3.5 w-3.5" /> Reconnecting</span>
            }
            <StatusBadge status={room.status} />
            <Button variant="ghost" size="icon" onClick={() => fetchData(hostToken)} disabled={isActionLoading} className="h-9 w-9 rounded-xl">
              <RefreshCw className={`h-4 w-4 ${isActionLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground text-xs">
                <Home className="h-3.5 w-3.5" /> Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Participants" value={stats.total} icon={Users} color="from-blue-500 to-cyan-500" />
          <StatCard label="Online Now" value={stats.online} icon={Wifi} color="from-emerald-500 to-green-500" />
          <StatCard label="Submitted" value={stats.submitted} icon={UserCheck} color="from-violet-500 to-purple-500" />
          <StatCard label="Duration" value={`${room.duration_minutes} min`} icon={Clock} color="from-amber-500 to-orange-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Room Info + Controls */}
          <div className="space-y-4 lg:col-span-1">

            {/* Room Code */}
            <div className="glass rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-semibold">Room Code</h3>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3">
                <span className="font-mono text-3xl font-extrabold tracking-widest text-blue-400">{room.room_code}</span>
                <button onClick={copyRoomCode} className="text-muted-foreground hover:text-blue-400 transition-colors">
                  {copied ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={copyJoinLink} className="w-full gap-2 rounded-xl border-white/10 text-xs">
                <ArrowUpRight className="h-3.5 w-3.5" /> Copy Join Link
              </Button>
            </div>

            {/* QR Code */}
            <div className="glass rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold">QR Code</h3>
              <div className="flex justify-center rounded-xl bg-white p-4">
                <QRCodeSVG value={joinUrl} size={150} />
              </div>
              <p className="text-xs text-center text-muted-foreground">Students can scan to join instantly</p>
            </div>

            {/* Controls */}
            <div className="glass rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold">Controls</h3>

              {room.status === 'waiting' && (
                <Button
                  onClick={() => doAction('start')}
                  disabled={isActionLoading}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg shadow-emerald-500/20"
                >
                  {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  Start Quiz
                </Button>
              )}

              {room.status === 'active' && (
                <Button
                  onClick={() => doAction('end')}
                  disabled={isActionLoading}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold shadow-lg shadow-red-500/20"
                >
                  {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}
                  End Quiz
                </Button>
              )}

              {room.status === 'ended' && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-center text-sm text-red-400">
                  Quiz has ended
                </div>
              )}

              <Button
                variant="outline"
                onClick={() => setShowAnnouncement(v => !v)}
                className="w-full gap-2 rounded-xl border-white/10"
              >
                <Megaphone className="h-4 w-4" /> Announcement
              </Button>

              <AnimatePresence>
                {showAnnouncement && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <Input
                      value={announcement}
                      onChange={e => setAnnouncement(e.target.value)}
                      placeholder="Broadcast a message to all participants..."
                      className="rounded-xl border-white/10 bg-white/5 text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => doAction('announce')}
                      disabled={isActionLoading}
                      className="w-full gap-2 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30 hover:bg-violet-500/30"
                    >
                      <Send className="h-3.5 w-3.5" /> Send
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right: Participants Table */}
          <div className="lg:col-span-2">
            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <h3 className="font-semibold text-sm">Participants</h3>
                <span className="text-xs text-muted-foreground">{stats.submitted}/{stats.total} submitted</span>
              </div>

              {participants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                  <Users className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No participants yet</p>
                  <p className="text-xs opacity-60">Share the room code or QR code to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-xs text-muted-foreground">
                        <th className="text-left p-3 font-medium pl-4">Name</th>
                        <th className="text-left p-3 font-medium">Dept / Sec</th>
                        <th className="text-center p-3 font-medium">Status</th>
                        <th className="text-center p-3 font-medium">Score</th>
                        <th className="text-center p-3 font-medium pr-4">Rank</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {participants.map((p, i) => (
                          <motion.tr
                            key={p.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.02 }}
                            className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors"
                          >
                            <td className="p-3 pl-4">
                              <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full shrink-0 ${p.is_online ? 'bg-emerald-400' : 'bg-white/20'}`} />
                                <div>
                                  <p className="font-medium leading-none">{p.student_name}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{p.register_no}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-muted-foreground">
                              <span className="text-xs">{p.department}</span>
                              {p.section && <span className="text-xs ml-1 text-muted-foreground/60">· {p.section}</span>}
                            </td>
                            <td className="p-3 text-center">
                              {p.has_submitted ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-xs font-medium">
                                  <UserCheck className="h-3 w-3" /> Submitted
                                </span>
                              ) : (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${
                                  p.is_online
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    : 'bg-white/5 text-muted-foreground border-white/10'
                                }`}>
                                  {p.is_online ? 'In Quiz' : 'Offline'}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {p.has_submitted
                                ? <span className="font-mono font-bold text-emerald-400">{p.score}</span>
                                : <span className="text-muted-foreground/40">—</span>
                              }
                            </td>
                            <td className="p-3 text-center pr-4">
                              {p.rank
                                ? <span className="flex items-center justify-center gap-1 font-bold text-amber-400">
                                    {p.rank === 1 && <Crown className="h-3.5 w-3.5" />}
                                    #{p.rank}
                                  </span>
                                : <span className="text-muted-foreground/40">—</span>
                              }
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Page Export with Suspense ────────────────────────────────────────────────

export default function HostManagePage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="bg-mesh-gradient fixed inset-0 -z-10" />
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    }>
      <HostManageInner roomId={roomId} />
    </Suspense>
  );
}
