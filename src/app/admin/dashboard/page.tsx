'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Users, UserCheck, FileCheck, BarChart3,
  TrendingUp, Activity, DoorOpen,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Room } from '@/lib/supabase/types';

interface DashboardStats {
  totalRooms: number;
  activeRooms: number;
  totalParticipants: number;
  totalSubmitted: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export default function AdminDashboard() {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [stats, setStats] = useState<DashboardStats>({
    totalRooms: 0,
    activeRooms: 0,
    totalParticipants: 0,
    totalSubmitted: 0,
  });
  const [recentRooms, setRecentRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    // Get rooms
    const { data: rooms } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (rooms) {
      setRecentRooms(rooms);
      setStats(prev => ({
        ...prev,
        totalRooms: rooms.length,
        activeRooms: rooms.filter(r => r.status === 'active').length,
      }));
    }

    // Get all rooms count
    const { count: roomCount } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true });

    // Get participant counts
    const { count: totalP } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true });

    const { count: submittedP } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('has_submitted', true);

    setStats({
      totalRooms: roomCount || 0,
      activeRooms: rooms?.filter(r => r.status === 'active').length || 0,
      totalParticipants: totalP || 0,
      totalSubmitted: submittedP || 0,
    });

    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchStats();

    const roomsChannel = supabase.channel('dashboard-rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, fetchStats)
      .subscribe();

    const participantsChannel = supabase.channel('dashboard-participants')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, fetchStats)
      .subscribe();

    const interval = setInterval(fetchStats, 30000);

    return () => {
      supabase.removeChannel(roomsChannel);
      supabase.removeChannel(participantsChannel);
      clearInterval(interval);
    };
  }, [fetchStats, supabase]);

  const statCards = [
    {
      title: 'Total Rooms',
      value: stats.totalRooms,
      icon: DoorOpen,
      color: 'from-blue-500 to-blue-600',
      textColor: 'text-blue-400',
    },
    {
      title: 'Total Students',
      value: stats.totalParticipants,
      icon: Users,
      color: 'from-violet-500 to-purple-600',
      textColor: 'text-violet-400',
    },
    {
      title: 'Submitted',
      value: stats.totalSubmitted,
      icon: FileCheck,
      color: 'from-emerald-500 to-green-600',
      textColor: 'text-emerald-400',
    },
    {
      title: 'Active Rooms',
      value: stats.activeRooms,
      icon: Activity,
      color: 'from-amber-500 to-orange-600',
      textColor: 'text-amber-400',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'waiting': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'active': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'ended': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      default: return '';
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Quiz Competition Overview</p>
      </div>

      {/* Stats Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {statCards.map((stat, i) => (
          <motion.div key={i} variants={itemVariants}>
            <Card className="border-white/5 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className={`mt-1 text-3xl font-bold ${stat.textColor}`}>{stat.value}</p>
                  </div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color}`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Recent Rooms */}
      <Card className="border-white/5 bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Rooms</CardTitle>
          <Link href="/admin/rooms">
            <Button variant="ghost" size="sm" className="gap-1 text-violet-400">
              View All <TrendingUp className="h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentRooms.map((room) => (
              <Link key={room.id} href={`/admin/rooms/${room.id}`}>
                <div className="flex items-center justify-between rounded-xl border border-white/5 p-4 transition-all hover:bg-white/5">
                  <div>
                    <p className="font-medium">{room.room_name}</p>
                    <p className="text-xs font-mono text-muted-foreground">Code: {room.room_code}</p>
                  </div>
                  <span className={`rounded-lg border px-3 py-1 text-xs font-medium ${getStatusBadge(room.status)}`}>
                    {room.status}
                  </span>
                </div>
              </Link>
            ))}
            {recentRooms.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">No rooms yet. Create your first room!</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
