// ============================================
// App Constants
// Technical Quiz Competition Platform
// ============================================

export const APP_NAME = 'Technical Quiz Competition';
export const APP_DESCRIPTION = 'Technical Quiz Competition Platform';

// Quiz settings
export const QUIZ_DURATION_MINUTES = 20;
export const TOTAL_QUESTIONS = 20;
export const MARKS_PER_QUESTION = 1;
export const MAX_PARTICIPANTS = 300;

// Anti-cheat settings
export const MAX_TAB_SWITCHES = 3;
export const MAX_FULLSCREEN_EXITS = 3;
export const WARNING_TIME_MINUTES = 5;

// Timer warning threshold (seconds)
export const TIMER_WARNING_SECONDS = 5 * 60; // 5 minutes

// Departments
export const DEPARTMENTS = [
  'Computer Science',
  'Information Technology',
  'Electronics',
  'Electrical',
  'Mech',
  'Civil',
  'Data Science',
  'AIML',
  'BME',
  'RAA',
  'AIDS',
  'Other',
] as const;

// Sections
export const SECTIONS = ['A', 'B', 'C', 'D', 'E'] as const;

// College Years
export const COLLEGE_YEARS = ['Year 1', 'Year 2', 'Year 3', 'Year 4'] as const;

// Color palette
export const COLORS = {
  primary: '#2563EB',
  secondary: '#7C3AED',
  accent: '#06B6D4',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
} as const;
