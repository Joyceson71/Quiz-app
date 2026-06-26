'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, DoorOpen, Users, Play, Square, Lock,
  QrCode, Copy, Check, Loader2, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createClient } from '@/lib/supabase/client';
import type { Room } from '@/lib/supabase/types';
import { toast } from 'sonner';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';

export default function AdminRoomsPage() {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [rooms, setRooms] = useState<(Room & { participant_count?: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialogRoom, setQrDialogRoom] = useState<Room | null>(null);
  const [copiedCode, setCopiedCode] = useState('');
  const [newRoom, setNewRoom] = useState<{
    room_name: string;
    duration_minutes: number;
    max_participants: number;
    question_ids: string[];
    allowed_register_nos: string;
  }>({
    room_name: '',
    duration_minutes: 20,
    max_participants: 300,
    question_ids: [],
    allowed_register_nos: '',
  });
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [questionSearch, setQuestionSearch] = useState('');

  const fetchRooms = useCallback(async () => {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      // Get participant counts for each room
      const roomsWithCounts = await Promise.all(
        data.map(async (room) => {
          const { count } = await supabase
            .from('participants')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', room.id);
          return { ...room, participant_count: count || 0 };
        })
      );
      setRooms(roomsWithCounts);
    }
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchRooms();
    
    // Fetch all questions for assignment
    const fetchQuestions = async () => {
      const { data } = await supabase
        .from('questions')
        .select('id, question, category, subject, marks')
        .order('created_at', { ascending: false });
      if (data) setAllQuestions(data);
    };
    fetchQuestions();
  }, [fetchRooms, supabase]);

  const createRoom = async () => {
    if (!newRoom.room_name) {
      toast.error('Room name is required');
      return;
    }

    setIsCreating(true);
    
    // Parse allowed_register_nos
    const parsedAllowed = newRoom.allowed_register_nos
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
      
    const payload = {
      ...newRoom,
      allowed_register_nos: parsedAllowed.length > 0 ? parsedAllowed : null
    };

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(`Room created! Code: ${data.room.room_code}`);
        setDialogOpen(false);
        setNewRoom({ room_name: '', duration_minutes: 20, max_participants: 300, question_ids: [], allowed_register_nos: '' });
        fetchRooms();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error('Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRoomAction = async (roomId: string, action: 'start' | 'end' | 'lock') => {
    try {
      let url = `/api/rooms/${roomId}`;
      let method = 'PATCH';
      let body: Record<string, unknown> = {};

      if (action === 'start') {
        url = `/api/rooms/${roomId}/start`;
        method = 'POST';
      } else if (action === 'end') {
        url = `/api/rooms/${roomId}/end`;
        method = 'POST';
      } else if (action === 'lock') {
        body = { is_locked: true };
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'PATCH' ? JSON.stringify(body) : undefined,
      });

      if (res.ok) {
        toast.success(`Room ${action}ed successfully!`);
        fetchRooms();
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch {
      toast.error(`Failed to ${action} room`);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!window.confirm('Are you sure you want to delete this room? This action cannot be undone.')) return;

    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Room deleted successfully!');
        fetchRooms();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete room');
      }
    } catch {
      toast.error('Failed to delete room');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Room code copied!');
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'active': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'ended': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      default: return '';
    }
  };

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  const filteredQuestions = allQuestions.filter(q => 
    q.question.toLowerCase().includes(questionSearch.toLowerCase()) || 
    (q.subject && q.subject.toLowerCase().includes(questionSearch.toLowerCase()))
  );
  
  const toggleQuestion = (id: string) => {
    setNewRoom(prev => ({
      ...prev,
      question_ids: prev.question_ids.includes(id) 
        ? prev.question_ids.filter(qId => qId !== id)
        : [...prev.question_ids, id]
    }));
  };
  
  const toggleAllFiltered = () => {
    const allFilteredIds = filteredQuestions.map(q => q.id);
    const allSelected = allFilteredIds.every(id => newRoom.question_ids.includes(id));
    
    if (allSelected) {
      setNewRoom(prev => ({
        ...prev,
        question_ids: prev.question_ids.filter(id => !allFilteredIds.includes(id))
      }));
    } else {
      setNewRoom(prev => ({
        ...prev,
        question_ids: Array.from(new Set([...prev.question_ids, ...allFilteredIds]))
      }));
    }
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rooms</h1>
          <p className="text-muted-foreground">Manage quiz competition rooms</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button className="gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white" />}>
            <Plus className="h-4 w-4" /> Create Room
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Room</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Room Name</Label>
                <Input
                  placeholder="e.g., Technical Quiz Round 1"
                  value={newRoom.room_name}
                  onChange={(e) => setNewRoom(prev => ({ ...prev, room_name: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duration (min)</Label>
                  <Input
                    type="number"
                    value={newRoom.duration_minutes}
                    onChange={(e) => setNewRoom(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 20 }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Participants</Label>
                  <Input
                    type="number"
                    value={newRoom.max_participants}
                    onChange={(e) => setNewRoom(prev => ({ ...prev, max_participants: parseInt(e.target.value) || 300 }))}
                    className="rounded-xl"
                  />
                </div>
              </div>
              
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <Label>Assign Questions ({newRoom.question_ids.length} selected)</Label>
                  <Button variant="ghost" size="sm" onClick={toggleAllFiltered} className="h-6 text-xs text-violet-400">
                    Select All Visible
                  </Button>
                </div>
                <Input
                  placeholder="Search by question or subject..."
                  value={questionSearch}
                  onChange={(e) => setQuestionSearch(e.target.value)}
                  className="rounded-xl h-8 text-sm"
                />
                <ScrollArea className="h-[200px] w-full rounded-md border border-white/10 bg-white/5 p-4">
                  {filteredQuestions.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-8">No questions found.</div>
                  ) : (
                    <div className="space-y-3">
                      {filteredQuestions.map((q) => (
                        <div key={q.id} className="flex items-start space-x-2">
                          <Checkbox 
                            id={`q-${q.id}`} 
                            checked={newRoom.question_ids.includes(q.id)}
                            onCheckedChange={() => toggleQuestion(q.id)}
                            className="mt-1"
                          />
                          <label
                            htmlFor={`q-${q.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            <span className="line-clamp-2">{q.question}</span>
                            {q.subject && (
                              <span className="text-[10px] text-violet-400 mt-1 block font-mono bg-violet-500/10 w-fit px-1.5 py-0.5 rounded">
                                {q.subject}
                              </span>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                <p className="text-xs text-muted-foreground">
                  Leave empty to assign all available questions randomly.
                </p>
              </div>
              
              <div className="space-y-2 pt-2 border-t border-white/10">
                <Label>Allowed Registration Numbers (Optional)</Label>
                <div className="text-xs text-muted-foreground mb-2">
                  To restrict access, paste a comma-separated list of allowed registration numbers (e.g., 20BCA101, 20BCA102). Leave empty to allow anyone.
                </div>
                <Input
                  placeholder="e.g. 20BCA101, 20BCA102"
                  value={newRoom.allowed_register_nos}
                  onChange={(e) => setNewRoom(prev => ({ ...prev, allowed_register_nos: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={createRoom}
                disabled={isCreating}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white"
              >
                {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create Room'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          <AnimatePresence>
            {rooms.map((room) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                layout
              >
                <Card className="border-white/5 bg-card/50 backdrop-blur-sm transition-all hover:border-white/10">
                  <CardContent className="p-5">
                    {/* Header */}
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <Link href={`/admin/rooms/${room.id}`}>
                          <h3 className="font-semibold hover:text-violet-400 transition-colors cursor-pointer">
                            {room.room_name}
                          </h3>
                        </Link>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="font-mono text-sm text-blue-400">{room.room_code}</span>
                          <button
                            onClick={() => copyCode(room.room_code)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {copiedCode === room.room_code ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <span className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${getStatusColor(room.status)}`}>
                        {room.status}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="mb-4 grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-white/5 p-2 text-center">
                        <Users className="mx-auto mb-1 h-3.5 w-3.5 text-blue-400" />
                        <p className="text-sm font-bold">{room.participant_count || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Joined</p>
                      </div>
                      <div className="rounded-lg bg-white/5 p-2 text-center">
                        <DoorOpen className="mx-auto mb-1 h-3.5 w-3.5 text-violet-400" />
                        <p className="text-sm font-bold">{room.max_participants}</p>
                        <p className="text-[10px] text-muted-foreground">Max</p>
                      </div>
                      <div className="rounded-lg bg-white/5 p-2 text-center">
                        <Lock className="mx-auto mb-1 h-3.5 w-3.5 text-amber-400" />
                        <p className="text-sm font-bold">{room.is_locked ? 'Yes' : 'No'}</p>
                        <p className="text-[10px] text-muted-foreground">Locked</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {room.status === 'waiting' && (
                        <Button
                          size="sm"
                          onClick={() => handleRoomAction(room.id, 'start')}
                          className="gap-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                        >
                          <Play className="h-3 w-3" /> Start
                        </Button>
                      )}
                      {room.status === 'active' && (
                        <Button
                          size="sm"
                          onClick={() => handleRoomAction(room.id, 'end')}
                          className="gap-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        >
                          <Square className="h-3 w-3" /> End
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setQrDialogRoom(room)}
                        className="gap-1 text-muted-foreground"
                      >
                        <QrCode className="h-3 w-3" /> QR
                      </Button>
                      <Link href={`/admin/rooms/${room.id}`}>
                        <Button size="sm" variant="ghost" className="text-violet-400">
                          View →
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteRoom(room.id)}
                        className="gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          {rooms.length === 0 && (
            <div className="col-span-full py-20 text-center text-muted-foreground">
              <DoorOpen className="mx-auto mb-4 h-12 w-12 opacity-20" />
              <p>No rooms yet. Create your first room to get started!</p>
            </div>
          )}
        </motion.div>
      )}

      {/* QR Code Dialog */}
      <Dialog open={!!qrDialogRoom} onOpenChange={() => setQrDialogRoom(null)}>
        <DialogContent className="text-center sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Room QR Code</DialogTitle>
          </DialogHeader>
          {qrDialogRoom && (
            <div className="space-y-4 py-4">
              <div className="mx-auto flex w-fit rounded-2xl bg-white p-4">
                <QRCodeSVG
                  value={`${appUrl}/login?code=${qrDialogRoom.room_code}`}
                  size={200}
                  level="H"
                />
              </div>
              <div>
                <p className="text-lg font-bold">{qrDialogRoom.room_name}</p>
                <p className="font-mono text-2xl text-blue-400">{qrDialogRoom.room_code}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Students can scan this QR code to join the room
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
