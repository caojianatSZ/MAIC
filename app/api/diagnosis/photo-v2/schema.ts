// app/api/diagnosis/photo-v2/schema.ts

/**
 * 拍照诊断 V2 API 请求类型
 */
export interface PhotoDiagnosisV2Request {
  /** 图片 Base64 编码（可选，与 imageUrl 二选一） */
  imageBase64?: string;
  /** 图片 URL（可选，与 imageBase64 二选一） */
  imageUrl?: string;
  /** 批改模式：auto=自动检测, single=单题, batch=整卷 */
  mode?: 'single' | 'batch' | 'auto';
  /** 学科 */
  subject: 'math' | 'physics' | 'chemistry' | 'chinese' | 'english';
  /** 年级 */
  grade: string;
  /** 用户 ID */
  userId: string;
}

/**
 * 题目批改结果
 */
export interface QuestionJudgment {
  /** 题目 ID */
  id: string;
  /** 题目内容 */
  content: string;
  /** 题目类型 */
  type: 'choice' | 'fill_blank' | 'essay';
  /** 选项（仅选择题） */
  options?: string[];
  /** 学生答案 */
  studentAnswer?: string;
  /** 批改结果 */
  judgment: {
    /** 是否正确 */
    isCorrect: boolean;
    /** 正确答案 */
    correctAnswer: string;
    /** 解析 */
    analysis: string;
    /** 置信度（0-1） */
    confidence: number;
    /** 原始 LLM 置信度 */
    originalConfidence: number;
    /** 是否需要复核 */
    needsReview: boolean;
    /** 复核原因 */
    reviewReason?: string;
    /** 警告信息 */
    warnings: string[];
  };
  /** 关联的知识点 */
  knowledgePoints: Array<{
    /** 知识点 ID */
    id: string;
    /** 知识点名称 */
    name: string;
    /** 掌握程度 */
    masteryLevel: 'mastered' | 'partial' | 'weak';
  }>;
}

/**
 * OCR 校验结果
 */
export interface OcrValidation {
  /** 是否通过校验 */
  isValid: boolean;
  /** 整体置信度 */
  confidence: number;
  /** 警告信息 */
  warnings: string[];
  /** 错误信息 */
  errors: string[];
}

/**
 * 拍照诊断 V2 API 响应类型
 */
export interface PhotoDiagnosisV2Response {
  /** 实际使用的模式 */
  mode: 'single' | 'batch';
  /** 完整的 markdown（TextIn 原始输出，保留 Unicode 下标等格式） */
  fullMarkdown?: string;
  /** 题目列表 */
  questions: QuestionJudgment[];
  /** 总结信息 */
  summary: {
    /** 总题数 */
    totalQuestions: number;
    /** 正确题数 */
    correctCount: number;
    /** 分数（0-100） */
    score: number;
    /** 薄弱知识点 */
    weakKnowledgePoints: string[];
    /** 低置信度题目数量 */
    lowConfidenceCount: number;
    /** 是否需要复核 */
    needsReview: boolean;
    /** 复核原因 */
    reviewReason?: string;
  };
  /** OCR 校验结果 */
  ocrValidation: OcrValidation;
}
