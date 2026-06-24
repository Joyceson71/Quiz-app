// ============================================
// Database Types
// CSE & IT Quiz Competition Platform
// ============================================

export type RoomStatus = 'waiting' | 'active' | 'ended';
export type ParticipantStatus = 'joined' | 'in_quiz' | 'submitted' | 'disqualified';
export type ViolationType =
  | 'tab_switch'
  | 'fullscreen_exit'
  | 'copy_attempt'
  | 'paste_attempt'
  | 'cut_attempt'
  | 'right_click'
  | 'devtools_attempt'
  | 'auto_submit_tab_switch'
  | 'auto_submit_fullscreen';

export type EventType =
  | 'login'
  | 'join_room'
  | 'quiz_start'
  | 'answer_saved'
  | 'quiz_submit'
  | 'tab_switch'
  | 'fullscreen_exit'
  | 'fullscreen_enter'
  | 'page_refresh'
  | 'disconnected'
  | 'reconnected';

export interface Admin {
  id: string;
  auth_user_id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Room {
  id: string;
  room_code: string;
  room_name: string;
  created_by: string | null;
  status: RoomStatus;
  quiz_start_time: string | null;
  quiz_end_time: string | null;
  duration_minutes: number;
  max_participants: number;
  is_locked: boolean;
  announcement: string | null;
  created_at: string;
}

export interface Participant {
  id: string;
  room_id: string;
  auth_user_id: string | null;
  register_no: string;
  student_name: string;
  department: string;
  section: string;
  participant_code: string;
  score: number;
  total_marks: number;
  percentage: number;
  rank: number | null;
  submission_time: string | null;
  has_submitted: boolean;
  status: ParticipantStatus;
  question_order: number[] | null;
  created_at: string;
}

export interface Question {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  marks: number;
  question_order: number;
  created_at: string;
}

export interface QuestionSafe {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  marks: number;
  question_order: number;
}

export interface RoomQuestion {
  id: string;
  room_id: string;
  question_id: string;
  display_order: number;
  created_at: string;
}

export interface Answer {
  id: string;
  participant_id: string;
  question_id: string;
  room_id: string;
  selected_answer: string | null;
  is_correct: boolean;
  answered_at: string;
}

export interface Violation {
  id: string;
  participant_id: string;
  room_id: string;
  violation_type: ViolationType;
  description: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  participant_id: string;
  room_id: string;
  event_type: EventType;
  event_data: Record<string, unknown> | null;
  created_at: string;
}

// API Response types
export interface LeaderboardEntry {
  participant_id: string;
  student_name: string;
  department: string;
  section: string;
  score: number;
  percentage: number;
  rank: number;
  submission_time: string;
  register_no: string;
}

export interface RoomStats {
  total_participants: number;
  active_participants: number;
  submitted_participants: number;
  disqualified_participants: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
}

export interface QuestionAccuracy {
  question_id: string;
  question_text: string;
  total_attempts: number;
  correct_attempts: number;
  accuracy_percentage: number;
}

export interface DepartmentScore {
  department: string;
  participant_count: number;
  average_score: number;
  highest_score: number;
  average_percentage: number;
}

export interface QuizSubmitResult {
  final_score: number;
  final_percentage: number;
  final_rank: number;
  total_questions: number;
  correct_count: number;
}
