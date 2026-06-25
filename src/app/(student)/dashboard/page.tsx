"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  GraduationCap,
  LogOut,
  Loader2,
  Hash,
  ArrowRight,
  History,
  Building2,
  BookOpen,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { DEPARTMENTS, SECTIONS } from "@/lib/constants";
import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Profile Form State
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [formData, setFormData] = useState({
    register_no: "",
    department: "",
    section: "",
  });

  // Join Room State
  const [roomCode, setRoomCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  // History State
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUser(session.user);

      // Fetch Profile
      const { data: profileData } = await supabase
        .from("student_profiles")
        .select("*")
        .eq("auth_user_id", session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        // Fetch History
        const { data: historyData } = await supabase
          .from("participants")
          .select("*, rooms(room_name, room_code, status)")
          .eq("auth_user_id", session.user.id)
          .order("created_at", { ascending: false });

        if (historyData) setHistory(historyData);
      }

      setIsLoading(false);
    }
    loadData();
  }, [router, supabase]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.register_no || !formData.department || !formData.section) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSavingProfile(true);
    try {
      const { data, error } = await supabase
        .from("student_profiles")
        .insert([
          {
            auth_user_id: user.id,
            student_name:
              user.user_metadata.full_name ||
              user.email?.split("@")[0] ||
              "Student",
            register_no: formData.register_no,
            department: formData.department,
            section: formData.section,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      setProfile(data);
      toast.success("Profile saved successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to save profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode) {
      toast.error("Please enter a room code");
      return;
    }

    setIsJoining(true);
    try {
      const res = await fetch("/api/quiz/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_code: roomCode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join room");

      // Store locally for page restoration
      localStorage.setItem("participant", JSON.stringify(data.participant));
      localStorage.setItem("room", JSON.stringify(data.room));

      toast.success("Joined successfully!");

      if (data.room.status === "active") {
        router.push(`/quiz/${data.room.id}`);
      } else if (data.room.status === "ended") {
        router.push(`/result/${data.room.id}`);
      } else {
        router.push(`/waiting/${data.room.id}`);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("participant");
    localStorage.removeItem("room");
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      {/* Backgrounds */}
      <div className="bg-mesh-gradient fixed inset-0 -z-10" />
      <div className="bg-dot-pattern fixed inset-0 -z-10 opacity-50" />

      {/* Navbar */}
      <header className="glass sticky top-0 z-50 border-b border-white/10">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/20">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400">
              QuizPlatform
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2 text-muted-foreground hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold">
            Welcome, {user.user_metadata.full_name || "Student"}!
          </h1>
          <p className="mt-2 text-muted-foreground">
            Manage your profile and join quizzes from your dashboard.
          </p>
        </motion.div>

        {!profile ? (
          /* Profile Completion Form */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-6 md:p-8"
          >
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
                <User className="h-8 w-8 text-blue-500" />
              </div>
              <h2 className="text-2xl font-bold">Complete Your Profile</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Please provide your details to start taking quizzes.
              </p>
            </div>

            <form
              onSubmit={handleSaveProfile}
              className="space-y-4 max-w-md mx-auto"
            >
              <div className="space-y-2">
                <Label>Register Number</Label>
                <Input
                  placeholder="e.g., STU001"
                  value={formData.register_no}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      register_no: e.target.value,
                    }))
                  }
                  className="bg-white/5 border-white/10 h-11"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={formData.department}
                    onValueChange={(val) =>
                      setFormData((prev) => ({ ...prev, department: val || "" }))
                    }
                    required
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 h-11">
                      <SelectValue placeholder="Dept" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Section</Label>
                  <Select
                    value={formData.section}
                    onValueChange={(val) =>
                      setFormData((prev) => ({ ...prev, section: val || "" }))
                    }
                    required
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 h-11">
                      <SelectValue placeholder="Sec" />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTIONS.map((sec) => (
                        <SelectItem key={sec} value={sec}>
                          {sec}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                type="submit"
                disabled={isSavingProfile}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-violet-600"
              >
                {isSavingProfile ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Save Profile"
                )}
              </Button>
            </form>
          </motion.div>
        ) : (
          /* Dashboard Main Content */
          <div className="grid gap-8 md:grid-cols-2">
            {/* Join Room Section */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass rounded-2xl p-6"
            >
              <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                <Hash className="h-5 w-5 text-blue-400" />
                Join a Quiz
              </h2>
              <form onSubmit={handleJoinRoom} className="space-y-4">
                <div className="space-y-2">
                  <Label>Room Code</Label>
                  <Input
                    placeholder="Enter 6-digit code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    className="font-mono text-lg tracking-widest uppercase h-14 bg-white/5 border-white/10 text-center"
                    maxLength={6}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isJoining}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-violet-600"
                >
                  {isJoining ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="h-5 w-5 mr-2" />
                  )}
                  Join Room
                </Button>
              </form>
            </motion.div>

            {/* Profile Info Summary */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass rounded-2xl p-6 flex flex-col justify-center"
            >
              <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                <User className="h-5 w-5 text-violet-400" />
                Your Profile
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" /> Name
                  </span>
                  <span className="font-medium">{profile.student_name}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Hash className="h-4 w-4" /> Register No
                  </span>
                  <span className="font-mono">{profile.register_no}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Dept & Sec
                  </span>
                  <span className="font-medium">
                    {profile.department} - {profile.section}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* History Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-6 md:col-span-2"
            >
              <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
                <History className="h-5 w-5 text-emerald-400" />
                Past Quizzes
              </h2>
              {history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground bg-white/5 rounded-xl border border-white/10 border-dashed">
                  You haven't participated in any quizzes yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((record) => (
                    <div
                      key={record.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    >
                      <div>
                        <h3 className="font-bold text-lg">
                          {record.rooms?.room_name || "Unknown Room"}
                        </h3>
                        <p className="text-sm text-muted-foreground font-mono mt-1">
                          Code: {record.rooms?.room_code}
                        </p>
                      </div>
                      <div className="mt-4 sm:mt-0 flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Score</p>
                          <p className="font-bold text-lg text-emerald-400">
                            {record.score}/{record.total_marks}
                          </p>
                        </div>
                        <Link href={`/result/${record.room_id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg border-white/20"
                          >
                            View Result
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}
