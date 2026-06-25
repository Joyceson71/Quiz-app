'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Activity, Users, Clock, AlertTriangle, UserCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function MonitoringPage() {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  
  const [rooms, setRooms] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMonitoringData = async () => {
    // Fetch active and waiting rooms
    const { data: roomsData } = await supabase
      .from('rooms')
      .select('*')
      .in('status', ['active', 'waiting'])
      .order('created_at', { ascending: false });

    if (roomsData) {
      setRooms(roomsData);
      
      // Fetch participants for these rooms
      const roomIds = roomsData.map(r => r.id);
      if (roomIds.length > 0) {
        const { data: participantsData } = await supabase
          .from('participants')
          .select('*')
          .in('room_id', roomIds);
          
        if (participantsData) {
          setParticipants(participantsData);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMonitoringData();

    // Set up realtime subscriptions
    const roomsChannel = supabase.channel('monitoring-rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, fetchMonitoringData)
      .subscribe();

    const participantsChannel = supabase.channel('monitoring-participants')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, fetchMonitoringData)
      .subscribe();

    const interval = setInterval(fetchMonitoringData, 15000); // refresh every 15s

    return () => {
      supabase.removeChannel(roomsChannel);
      supabase.removeChannel(participantsChannel);
      clearInterval(interval);
    };
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8 text-blue-500" />
            Live Monitoring
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time view of all active and waiting quizzes.
          </p>
        </div>
      </div>

      {rooms.length === 0 ? (
        <Card className="border-white/5 bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <h2 className="text-xl font-semibold">No Active Quizzes</h2>
            <p className="text-muted-foreground mt-2">
              There are currently no active or waiting rooms to monitor.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map(room => {
            const roomParticipants = participants.filter(p => p.room_id === room.id);
            const onlineCount = roomParticipants.filter(p => p.is_online).length;
            const submittedCount = roomParticipants.filter(p => p.has_submitted).length;
            const violationsCount = roomParticipants.filter(p => (p.tab_switches || 0) > 0).length;

            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Link href={`/admin/rooms/${room.id}`}>
                  <Card className={`border-white/10 transition-all hover:bg-white/5 hover:border-white/20 overflow-hidden relative cursor-pointer ${
                    room.status === 'active' ? 'bg-blue-500/5' : 'bg-amber-500/5'
                  }`}>
                    {/* Status indicator line */}
                    <div className={`absolute top-0 left-0 w-full h-1 ${
                      room.status === 'active' ? 'bg-blue-500' : 'bg-amber-500'
                    }`} />
                    
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between">
                        <span className="truncate pr-2">{room.room_name}</span>
                        <span className={`text-xs px-2 py-1 rounded-full border ${
                          room.status === 'active' 
                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}>
                          {room.status.toUpperCase()}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="font-mono text-sm text-muted-foreground mb-4">
                        Code: <span className="text-foreground">{room.room_code}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" /> Total Joined
                          </span>
                          <p className="text-xl font-bold">{roomParticipants.length}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <UserCheck className="h-3 w-3 text-emerald-400" /> Online
                          </span>
                          <p className="text-xl font-bold text-emerald-400">{onlineCount}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Submitted
                          </span>
                          <p className="text-xl font-bold">{submittedCount}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-red-400" /> Violations
                          </span>
                          <p className="text-xl font-bold text-red-400">{violationsCount}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
