// lib/validation/types.ts

export interface JudgmentValidationResult {
  isValid: boolean;
  needsReview: boolean;
  reviewReason: ReviewReason;
  adjustedConfidence: number;
  warnings: string[];
}

export interface AnswerValidation {
  isReasonable: boolean;
  confidence: number;
  issues: string[];
}

export const REVIEW_REASONS = {
  LOW_CONFIDENCE: 'low_confidence',
  ANSWER_TOO_LONG: 'answer_too_long',
  ANSWER_MISMATCH: 'answer_mismatch',
  NO_ANSWER_DETECTED: 'no_answer_detected',
  CALCULATION_VERIFICATION_FAILED: 'calculation_failed',
  OCR_VALIDATION_FAILED: 'ocr_validation_failed'
} as const;

export type ReviewReason = typeof REVIEW_REASONS[keyof typeof REVIEW_REASONS];
