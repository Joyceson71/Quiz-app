'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { GraduationCap, User, Hash, Building2, BookOpen, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { DEPARTMENTS, SECTIONS } from '@/lib/constants';
import { toast } from 'sonner';
import Link from 'next/link';

export default function StudentLoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    register_no: '',
    student_name: '',
    department: '',
    section: '',
    room_code: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.register_no || !formData.student_name || !formData.department || !formData.section || !formData.room_code) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Registration failed');
        setIsLoading(false);
        return;
      }

      // Store participant info in localStorage
      localStorage.setItem('participant', JSON.stringify(data.participant));
      localStorage.setItem('room', JSON.stringify(data.room));
      localStorage.setItem('auth_user_id', data.auth_user_id || '');

      if (data.isRejoining) {
        toast.success('Welcome back! Resuming your session.');
      } else {
        toast.success(`Welcome, ${formData.student_name}! Your code: ${data.participant.participant_code}`);
      }

      // Navigate based on room status
      if (data.room.status === 'active') {
        router.push(`/quiz/${data.room.id}`);
      } else if (data.room.status === 'ended') {
        router.push(`/result/${data.room.id}`);
      } else {
        router.push(`/waiting/${data.room.id}`);
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Background */}
      <div className="bg-mesh-gradient fixed inset-0 -z-10" />
      <div className="bg-dot-pattern fixed inset-0 -z-10" />

      {/* Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Back to home */}
      <div className="fixed top-4 left-4 z-50">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <GraduationCap className="h-4 w-4" /> Home
          </Button>
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-2xl shadow-blue-500/30"
          >
            <GraduationCap className="h-8 w-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold">Join Quiz Competition</h1>
          <p className="mt-1 text-sm text-muted-foreground">CSE & IT Department</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass space-y-4 rounded-2xl p-6">
          {/* Room Code */}
          <div className="space-y-2">
            <Label htmlFor="room_code" className="flex items-center gap-2 text-sm font-medium">
              <Hash className="h-3.5 w-3.5 text-blue-400" /> Room Code
            </Label>
            <Input
              id="room_code"
              placeholder="Enter 6-digit room code"
              value={formData.room_code}
              onChange={(e) => setFormData(prev => ({ ...prev, room_code: e.target.value.toUpperCase() }))}
              className="h-11 rounded-xl border-white/10 bg-white/5 font-mono text-lg tracking-widest uppercase placeholder:text-sm placeholder:tracking-normal placeholder:font-sans"
              maxLength={6}
              required
            />
          </div>

          {/* Register Number */}
          <div className="space-y-2">
            <Label htmlFor="register_no" className="flex items-center gap-2 text-sm font-medium">
              <User className="h-3.5 w-3.5 text-violet-400" /> Register Number
            </Label>
            <Input
              id="register_no"
              placeholder="e.g., 21CSE001"
              value={formData.register_no}
              onChange={(e) => setFormData(prev => ({ ...prev, register_no: e.target.value }))}
              className="h-11 rounded-xl border-white/10 bg-white/5"
              required
            />
          </div>

          {/* Student Name */}
          <div className="space-y-2">
            <Label htmlFor="student_name" className="flex items-center gap-2 text-sm font-medium">
              <User className="h-3.5 w-3.5 text-cyan-400" /> Full Name
            </Label>
            <Input
              id="student_name"
              placeholder="Enter your full name"
              value={formData.student_name}
              onChange={(e) => setFormData(prev => ({ ...prev, student_name: e.target.value }))}
              className="h-11 rounded-xl border-white/10 bg-white/5"
              required
            />
          </div>

          {/* Department & Section Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-3.5 w-3.5 text-emerald-400" /> Department
              </Label>
              <Select
                value={formData.department}
                onValueChange={(val) => val && setFormData(prev => ({ ...prev, department: val }))}
                required
              >
                <SelectTrigger className="h-11 rounded-xl border-white/10 bg-white/5">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <BookOpen className="h-3.5 w-3.5 text-amber-400" /> Section
              </Label>
              <Select
                value={formData.section}
                onValueChange={(val) => val && setFormData(prev => ({ ...prev, section: val }))}
                required
              >
                <SelectTrigger className="h-11 rounded-xl border-white/10 bg-white/5">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {SECTIONS.map(sec => (
                    <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="group mt-2 h-12 w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-base font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 hover:scale-[1.01]"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Joining...
              </>
            ) : (
              <>
                Join Room
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
