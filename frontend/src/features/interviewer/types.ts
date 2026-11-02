export interface Criterion {
  id: number;
  title: string;
  maxScore: number;
  weight: number;
}

export interface RoundInfo {
  id: number;
  campaignId: number;
  roundName: string;
  orderIndex: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'LOCKED';
  totalWeight: number;
  criteria: Criterion[];
}

export interface MyEvaluation {
  id: number;
  totalScore: number;
  submittedAt: string;
  generalNotes: string | null;
  details: Array<{ criterionId: number; score: number; comment: string | null }>;
}

export interface RoundCandidate {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  trackingCode: string;
  aiMatchScore: number | null;
  aiParsedSkills: {
    skills?: string[];
    totalYearsExperience?: number | null;
    educationLevel?: string | null;
  } | null;
  currentRoundId: number | null;
  finalStatus: 'PENDING' | 'PASSED' | 'REJECTED';
  myEvaluation: MyEvaluation | null;
}

export interface RoundCandidatesResponse {
  round: RoundInfo;
  candidates: RoundCandidate[];
}

export interface CopilotResponse {
  questions: string[];
  llmUsed: boolean;
  fallbackUsed: boolean;
  missingSkills: string[];
}
