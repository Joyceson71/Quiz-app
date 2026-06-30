'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Brain, Shield, Trophy, Clock, Users, Zap, ArrowRight, GraduationCap, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/shared/theme-toggle';

const features = [
  {
    icon: Brain,
    title: '20 MCQ Questions',
    description: 'Curated questions',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Clock,
    title: '20 Min Timer',
    description: 'Server-synced countdown with auto-submit',
    color: 'from-violet-500 to-purple-500',
  },
  {
    icon: Shield,
    title: 'Anti-Cheat System',
    description: 'Tab detection, fullscreen lock & more',
    color: 'from-red-500 to-orange-500',
  },
  {
    icon: Trophy,
    title: 'Live Leaderboard',
    description: 'Real-time rankings updated instantly',
    color: 'from-amber-500 to-yellow-500',
  },
  {
    icon: Users,
    title: '300 Participants',
    description: 'Support for large-scale competitions',
    color: 'from-emerald-500 to-green-500',
  },
  {
    icon: Zap,
    title: 'Instant Results',
    description: 'Scores, ranks & certificates immediately',
    color: 'from-pink-500 to-rose-500',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Background Effects */}
      <div className="bg-mesh-gradient fixed inset-0 -z-10" />
      <div className="bg-dot-pattern fixed inset-0 -z-10" />

      {/* Floating Orbs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              QuizArena
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <ThemeToggle />
            <Link href="/admin/login">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Admin
              </Button>
            </Link>
          </motion.div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10">
        <section className="mx-auto max-w-7xl px-6 pt-16 pb-24 md:pt-24 lg:pt-32">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-6"
            >
              <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-blue-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Quiz Platform
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
            >
              <span className="bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent dark:from-white dark:via-white dark:to-white/60">
                Technical
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
                Quiz Competition
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl"
            >
              Test your technical knowledge with curated MCQ challenges.
              20 questions, 20 minutes — compete with up to 300 participants in real-time!
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row flex-wrap"
            >
              <Link href="/login">
                <Button
                  size="lg"
                  className="group relative h-14 min-w-[180px] overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-8 text-lg font-semibold text-white shadow-2xl shadow-blue-500/25 transition-all hover:shadow-blue-500/40 hover:scale-[1.02]"
                >
                  Join Quiz
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/host">
                <Button
                  size="lg"
                  className="group relative h-14 min-w-[180px] overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-8 text-lg font-semibold text-white shadow-2xl shadow-violet-500/25 transition-all hover:shadow-violet-500/40 hover:scale-[1.02]"
                >
                  <Tv className="mr-2 h-5 w-5" />
                  Host a Quiz
                </Button>
              </Link>
              <Link href="/admin/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 min-w-[180px] rounded-2xl border-white/10 px-8 text-lg font-semibold backdrop-blur-sm transition-all hover:bg-white/5 hover:scale-[1.02]"
                >
                  Admin Panel
                </Button>
              </Link>
            </motion.div>
          </div>

          {/* Features Grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="mx-auto mt-24 grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((feature, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="glass group rounded-2xl p-6 transition-all hover:border-white/20"
              >
                <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.color} shadow-lg`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 py-8">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Quiz Competition. Built with ❤️ By Daniel
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
