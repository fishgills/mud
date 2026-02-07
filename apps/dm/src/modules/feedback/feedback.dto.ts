export class SubmitFeedbackDto {
  playerId?: number;
  teamId?: string;
  userId?: string;
  type!: 'bug' | 'suggestion' | 'general';
  content!: string;
}

export interface FeedbackValidationResult {
  isValid: boolean;
  rejectionReason: string | null;
  category: 'bug' | 'feature' | 'balance' | 'ux' | 'question' | 'praise';
  priority: 'low' | 'medium' | 'high';
  summary: string;
  tags: string[];
}

export interface SubmitFeedbackResponse {
  success: boolean;
  feedbackId?: number;
  githubIssueUrl?: string;
  rejectionReason?: string;
  ignored?: boolean;
}

export interface FeedbackHistoryItem {
  id: number;
  type: string;
  summary: string | null;
  status: string;
  githubIssueUrl: string | null;
  createdAt: Date;
}

export interface FeedbackHistoryResponse {
  feedbacks: FeedbackHistoryItem[];
}
