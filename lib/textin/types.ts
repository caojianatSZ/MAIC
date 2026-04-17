// lib/textin/types.ts

export interface TextinResponse {
  code: number;
  message: string;
  result?: TextinResult;
}

export interface TextinResult {
  markdown: string;
  confidence?: number;  // 整体识别置信度
  formula_blocks?: Array<{
    latex: string;
    bbox: { x: number; y: number; width: number; height: number };
    confidence?: number;  // 公式识别置信度
  }>;
  text_blocks?: Array<{
    text: string;
    bbox: { x: number; y: number; width: number; height: number };
    type: 'question' | 'option' | 'answer' | 'question_number';
    confidence?: number;  // 文本块识别置信度
    question_number?: string;  // 题号
  }>;
}

export interface TextinError {
  code: number;
  message: string;
}

// 后处理校验结果
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  filteredBlocks?: TextinResult['text_blocks'];
}

export interface ValidationError {
  type: 'missing_question_number' | 'empty_answer_area' | 'abnormal_text_length' | 'gap_in_sequence';
  blockIndex?: number;
  questionNumber?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  type: 'low_confidence' | 'question_number_mismatch' | 'abnormal_text_length';
  blockIndex?: number;
  confidence?: number;
  message: string;
}
