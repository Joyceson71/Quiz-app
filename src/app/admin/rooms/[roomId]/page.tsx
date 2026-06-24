"use client";

import { useEffect, useState, useCallback, use } from "react";
import { motion } from "framer-motion";
import {
  Users,
  UserCheck,
  FileCheck,
  BarChart3,
  Play,
  Square,
  Lock,
  Download,
  Trophy,
  AlertTriangle,
  RefreshCw,
  QrCode,
  Copy,
  Check,
  Clock,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type {
  Room,
  Participant,
  RoomStats,
  DepartmentScore,
  QuestionAccuracy,
  LeaderboardEntry,
  Violation,
} from "@/lib/supabase/types";
import { formatDate, getRankEmoji } from "@/lib/utils";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const CHART_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
];

export default function AdminRoomDetailPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const supabase = createClient();

  const [room, setRoom] = useState<Room | null>(null);
  const [stats, setStats] = useState<RoomStats | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [deptScores, setDeptScores] = useState<DepartmentScore[]>([]);
  const [questionAcc, setQuestionAcc] = useState<QuestionAccuracy[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const fetchData = useCallback(async () => {
    // Room
    const { data: roomData } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();
    if (roomData) {
      setRoom(roomData);
      setAnnouncement(roomData.announcement || "");
    }

    // Stats
    const { data: statsData } = await supabase.rpc("get_room_stats", {
      target_room_id: roomId,
    });
    if (statsData?.[0]) setStats(statsData[0]);

    // Participants
    const { data: partData } = await supabase
      .from("participants")
      .select("*")
      .eq("room_id", roomId)
      .order("rank", { ascending: true, nullsFirst: false });
    if (partData) setParticipants(partData);

    // Leaderboard
    const { data: lbData } = await supabase.rpc("get_leaderboard", {
      target_room_id: roomId,
    });
    if (lbData) setLeaderboard(lbData);

    // Department scores
    const { data: deptData } = await supabase.rpc("get_department_scores", {
      target_room_id: roomId,
    });
    if (deptData) setDeptScores(deptData);

    // Question accuracy
    const { data: qaData } = await supabase.rpc("get_question_accuracy", {
      target_room_id: roomId,
    });
    if (qaData) setQuestionAcc(qaData);

    // Violations
    const { data: violData } = await supabase
      .from("violations")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (violData) setViolations(violData);

    setIsLoading(false);
  }, [supabase, roomId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`admin-room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `room_id=eq.${roomId}`,
        },
        () => fetchData(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "violations",
          filter: `room_id=eq.${roomId}`,
        },
        () => fetchData(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => setRoom(payload.new as Room),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, roomId, fetchData]);

  const handleAction = async (action: "start" | "end") => {
    const res = await fetch(`/api/rooms/${roomId}/${action}`, {
      method: "POST",
    });
    if (res.ok) {
      toast.success(`Quiz ${action}ed!`);
      fetchData();
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  };

  const updateAnnouncement = async () => {
    await supabase.from("rooms").update({ announcement }).eq("id", roomId);
    toast.success("Announcement updated!");
  };

  const exportData = async (format: "csv" | "excel") => {
    const url = `/api/export/${format}?room_id=${roomId}`;
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `quiz_results_${room?.room_code || roomId}.${format === "csv" ? "csv" : "xlsx"}`;
    a.click();
    toast.success(`${format.toUpperCase()} exported!`);
  };

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (!room)
    return (
      <div className="text-center py-20 text-muted-foreground">
        Room not found
      </div>
    );

  const getStatusColor = (s: string) => {
    switch (s) {
      case "waiting":
        return "bg-amber-500/10 text-amber-400";
      case "active":
        return "bg-emerald-500/10 text-emerald-400";
      case "ended":
        return "bg-gray-500/10 text-gray-400";
      default:
        return "";
    }
  };

  const submissionTimeline = participants
    .filter((p) => p.submission_time)
    .sort(
      (a, b) =>
        new Date(a.submission_time!).getTime() -
        new Date(b.submission_time!).getTime(),
    )
    .map((p, i) => ({
      index: i + 1,
      name: p.student_name.split(" ")[0],
      score: p.score,
      time: new Date(p.submission_time!).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{room.room_name}</h1>
            <Badge className={`${getStatusColor(room.status)}`}>
              {room.status}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="font-mono text-blue-400">{room.room_code}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(room.room_code);
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 2000);
              }}
            >
              {copiedCode ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
            <span>•</span>
            <span>{room.duration_minutes} min</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {room.status === "waiting" && (
            <Button
              onClick={() => handleAction("start")}
              className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl"
            >
              <Play className="h-4 w-4" /> Start Quiz
            </Button>
          )}
          {room.status === "active" && (
            <Button
              onClick={() => handleAction("end")}
              className="gap-2 bg-red-600 text-white hover:bg-red-700 rounded-xl"
            >
              <Square className="h-4 w-4" /> End Quiz
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowQR(true)}
            className="gap-2 rounded-xl"
          >
            <QrCode className="h-4 w-4" /> QR Code
          </Button>
          <Button
            variant="outline"
            onClick={() => exportData("csv")}
            className="gap-2 rounded-xl"
          >
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => exportData("excel")}
            className="gap-2 rounded-xl"
          >
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button
            variant="ghost"
            onClick={fetchData}
            size="icon"
            className="rounded-xl"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total Students",
            value: stats?.total_participants || 0,
            icon: Users,
            color: "text-blue-400",
          },
          {
            label: "Active",
            value: stats?.active_participants || 0,
            icon: UserCheck,
            color: "text-emerald-400",
          },
          {
            label: "Submitted",
            value: stats?.submitted_participants || 0,
            icon: FileCheck,
            color: "text-violet-400",
          },
          {
            label: "Avg Score",
            value: stats?.average_score?.toFixed(1) || "0",
            icon: Target,
            color: "text-amber-400",
          },
        ].map((s, i) => (
          <Card key={i} className="border-white/5 bg-card/50">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Announcement */}
      <Card className="mb-6 border-white/5 bg-card/50">
        <CardContent className="flex gap-3 p-4">
          <Input
            placeholder="Type an announcement for students..."
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            className="rounded-xl"
          />
          <Button onClick={updateAnnouncement} className="rounded-xl">
            Send
          </Button>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="participants" className="space-y-4">
        <TabsList className="bg-white/5">
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="charts">Analytics</TabsTrigger>
          <TabsTrigger value="violations">Violations</TabsTrigger>
        </TabsList>

        {/* Participants Tab */}
        <TabsContent value="participants">
          <Card className="border-white/5 bg-card/50">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Register No
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Dept
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Section
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Score
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Rank
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-white/5 hover:bg-white/5"
                      >
                        <td className="px-4 py-3 font-mono text-xs">
                          {p.register_no}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {p.student_name}
                        </td>
                        <td className="px-4 py-3">{p.department}</td>
                        <td className="px-4 py-3">{p.section}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                              p.has_submitted
                                ? "bg-emerald-500/10 text-emerald-400"
                                : p.status === "in_quiz"
                                  ? "bg-blue-500/10 text-blue-400"
                                  : p.status === "disqualified"
                                    ? "bg-red-500/10 text-red-400"
                                    : "bg-amber-500/10 text-amber-400"
                            }`}
                          >
                            {p.has_submitted ? "submitted" : p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold">
                          {p.has_submitted ? `${p.score}/20` : "-"}
                        </td>
                        <td className="px-4 py-3">
                          {p.rank ? getRankEmoji(p.rank) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {participants.length === 0 && (
                <p className="py-12 text-center text-muted-foreground">
                  No participants yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard">
          <Card className="border-white/5 bg-card/50">
            <CardContent className="p-4">
              <div className="space-y-2">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.participant_id}
                    className="flex items-center gap-4 rounded-xl bg-white/5 p-3"
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
                        entry.rank <= 3
                          ? entry.rank === 1
                            ? "rank-gold"
                            : entry.rank === 2
                              ? "rank-silver"
                              : "rank-bronze"
                          : "bg-white/10"
                      }`}
                    >
                      {entry.rank <= 3 ? getRankEmoji(entry.rank) : entry.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">
                        {entry.student_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.department} • {entry.register_no}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-400">
                        {entry.score}/20
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.percentage}%
                      </p>
                    </div>
                  </div>
                ))}
                {leaderboard.length === 0 && (
                  <p className="py-12 text-center text-muted-foreground">
                    No submissions yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="charts">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Department-wise Scores */}
            <Card className="border-white/5 bg-card/50">
              <CardHeader>
                <CardTitle className="text-base">
                  Department-wise Average Scores
                </CardTitle>
              </CardHeader>
              <CardContent>
                {deptScores.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={deptScores}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.05)"
                      />
                      <XAxis dataKey="department" stroke="#888" fontSize={12} />
                      <YAxis stroke="#888" fontSize={12} />
                      <RechartsTooltip
                        contentStyle={{
                          background: "#1a1a2e",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar
                        dataKey="average_score"
                        fill="#2563eb"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-12 text-center text-muted-foreground">
                    No data yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Question Accuracy */}
            <Card className="border-white/5 bg-card/50">
              <CardHeader>
                <CardTitle className="text-base">
                  Question-wise Accuracy
                </CardTitle>
              </CardHeader>
              <CardContent>
                {questionAcc.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={questionAcc.map((q, i) => ({
                        ...q,
                        name: `Q${i + 1}`,
                      }))}
                      layout="vertical"
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.05)"
                      />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        stroke="#888"
                        fontSize={12}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        stroke="#888"
                        fontSize={12}
                        width={40}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          background: "#1a1a2e",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar
                        dataKey="accuracy_percentage"
                        fill="#10b981"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-12 text-center text-muted-foreground">
                    No data yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Submission Timeline */}
            <Card className="border-white/5 bg-card/50 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Submission Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                {submissionTimeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={submissionTimeline}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.05)"
                      />
                      <XAxis
                        dataKey="index"
                        stroke="#888"
                        fontSize={12}
                        label={{
                          value: "Submission #",
                          position: "insideBottom",
                          offset: -5,
                        }}
                      />
                      <YAxis stroke="#888" fontSize={12} domain={[0, 20]} />
                      <RechartsTooltip
                        contentStyle={{
                          background: "#1a1a2e",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "8px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#7c3aed"
                        strokeWidth={2}
                        dot={{ fill: "#7c3aed" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-12 text-center text-muted-foreground">
                    No submissions yet
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Violations Tab */}
        <TabsContent value="violations">
          <Card className="border-white/5 bg-card/50">
            <CardContent className="p-4">
              <div className="space-y-2">
                {violations.map((v) => {
                  const participant = participants.find(
                    (p) => p.id === v.participant_id,
                  );
                  return (
                    <div
                      key={v.id}
                      className="flex items-center gap-3 rounded-xl bg-white/5 p-3"
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {participant?.student_name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {v.violation_type} • {v.description}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(v.created_at)}
                      </span>
                    </div>
                  );
                })}
                {violations.length === 0 && (
                  <p className="py-12 text-center text-muted-foreground">
                    No violations recorded
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* QR Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="text-center sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Room QR Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="mx-auto flex w-fit rounded-2xl bg-white p-4">
              <QRCodeSVG
                value={`${appUrl}/login?code=${room.room_code}`}
                size={200}
                level="H"
              />
            </div>
            <p className="font-mono text-2xl text-blue-400">{room.room_code}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
