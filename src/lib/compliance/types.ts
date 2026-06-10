// HERMÈS Compliance Types — LinkedIn rate limits and warmup configs

export interface LinkedInLimits {
  dailyInvitations: number;
  weeklyInvitations: number;
  dailyMessages: number;
  dailyComments: number;
  dailyLikes: number;
  dailyProfileViews: number;
  dailyPosts: number;
  hourlyActions: number;
}

export interface ApiUsageCounters {
  [key: string]: {
    count: number;
    resetAt: Date;
  };
}

export type ComplianceLevel = "strict" | "moderate" | "aggressive";

export interface ComplianceStatus {
  level: ComplianceLevel;
  isWarmupActive: boolean;
  warmupDay: number;
  currentLimits: LinkedInLimits;
  usage: {
    invitationsToday: number;
    messagesToday: number;
    commentsToday: number;
    likesToday: number;
    postsToday: number;
  };
  violations: ComplianceViolation[];
}

export interface ComplianceViolation {
  type: string;
  category: string;
  message: string;
  current: number;
  limit: number;
  timestamp: Date;
}

export interface WarmupDayConfig {
  day: number;
  invitations: number;
  messages: number;
  comments: number;
  likes: number;
  profileViews: number;
  posts: number;
}

export interface MimicryConfig {
  minDelayBetweenActionsMs: number;
  maxDelayBetweenActionsMs: number;
  typingSpeedCharsPerSecond: number;
  readingTimePerPostMs: number;
  sessionDurationMinMs: number;
  sessionDurationMaxMs: number;
}

// Default limits by compliance level
export const DEFAULT_LIMITS: Record<ComplianceLevel, LinkedInLimits> = {
  strict: {
    dailyInvitations: 10,
    weeklyInvitations: 40,
    dailyMessages: 15,
    dailyComments: 8,
    dailyLikes: 20,
    dailyProfileViews: 25,
    dailyPosts: 1,
    hourlyActions: 8,
  },
  moderate: {
    dailyInvitations: 15,
    weeklyInvitations: 60,
    dailyMessages: 25,
    dailyComments: 12,
    dailyLikes: 30,
    dailyProfileViews: 40,
    dailyPosts: 2,
    hourlyActions: 12,
  },
  aggressive: {
    dailyInvitations: 25,
    weeklyInvitations: 100,
    dailyMessages: 40,
    dailyComments: 20,
    dailyLikes: 50,
    dailyProfileViews: 60,
    dailyPosts: 3,
    hourlyActions: 20,
  },
};

// 14-day warmup schedule
export const WARMUP_SCHEDULE: WarmupDayConfig[] = [
  { day: 1, invitations: 3, messages: 2, comments: 2, likes: 5, profileViews: 8, posts: 0 },
  { day: 2, invitations: 4, messages: 3, comments: 3, likes: 7, profileViews: 10, posts: 0 },
  { day: 3, invitations: 5, messages: 4, comments: 3, likes: 8, profileViews: 12, posts: 0 },
  { day: 4, invitations: 6, messages: 5, comments: 4, likes: 10, profileViews: 14, posts: 1 },
  { day: 5, invitations: 7, messages: 6, comments: 5, likes: 12, profileViews: 16, posts: 0 },
  { day: 6, invitations: 8, messages: 7, comments: 5, likes: 13, profileViews: 18, posts: 1 },
  { day: 7, invitations: 9, messages: 8, comments: 6, likes: 15, profileViews: 20, posts: 0 },
  { day: 8, invitations: 10, messages: 10, comments: 7, likes: 17, profileViews: 22, posts: 1 },
  { day: 9, invitations: 11, messages: 11, comments: 8, likes: 18, profileViews: 24, posts: 0 },
  { day: 10, invitations: 12, messages: 12, comments: 8, likes: 20, profileViews: 26, posts: 1 },
  { day: 11, invitations: 13, messages: 13, comments: 9, likes: 22, profileViews: 28, posts: 0 },
  { day: 12, invitations: 14, messages: 14, comments: 10, likes: 24, profileViews: 30, posts: 1 },
  { day: 13, invitations: 15, messages: 15, comments: 10, likes: 26, profileViews: 32, posts: 0 },
  { day: 14, invitations: 15, messages: 16, comments: 11, likes: 28, profileViews: 35, posts: 1 },
];

export const DEFAULT_MIMICRY: MimicryConfig = {
  minDelayBetweenActionsMs: 3000,
  maxDelayBetweenActionsMs: 8000,
  typingSpeedCharsPerSecond: 12,
  readingTimePerPostMs: 4500,
  sessionDurationMinMs: 10 * 60 * 1000,
  sessionDurationMaxMs: 30 * 60 * 1000,
};
