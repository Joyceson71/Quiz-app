import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export function usePresence(roomId: string, participantId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  useEffect(() => {
    if (!roomId || !participantId) return;

    const channel = supabase.channel(`room_presence_${roomId}`, {
      config: {
        presence: {
          key: participantId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        // state is an object where keys are the presence keys (participantIds)
        const online = Object.keys(state);
        setOnlineUsers(online);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ 
            online_at: new Date().toISOString(),
            participant_id: participantId
          });
          
          // Also update DB status to online (best effort)
          supabase.from('participants').update({
            is_online: true,
            last_heartbeat: new Date().toISOString()
          }).eq('id', participantId).then(() => {});
        }
      });

    // Handle heartbeat update every minute
    const heartbeatInterval = setInterval(() => {
      supabase.from('participants').update({
        last_heartbeat: new Date().toISOString()
      }).eq('id', participantId).then(() => {});
    }, 60000);

    return () => {
      clearInterval(heartbeatInterval);
      
      // Update DB status to offline (best effort)
      supabase.from('participants').update({
        is_online: false,
        last_heartbeat: new Date().toISOString()
      }).eq('id', participantId).then(() => {});
      
      supabase.removeChannel(channel);
    };
  }, [roomId, participantId, supabase]);

  return { onlineUsers };
}
