// lib/glm/types.ts

export interface QuestionForJudgment {
  id: string;
  content: string;
  type: 'choice' | 'fill_blank' | 'essay';
  options?: string[];
}

export interface JudgmentResult {
  questionId: string;
  studentAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
  analysis: string;
  confidence: number;  // LLM 返回的置信度
}

export interface BatchJudgmentResult {
  questions: JudgmentResult[];
}
