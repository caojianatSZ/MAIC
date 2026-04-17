// lib/textin/types.ts

export interface TextinResponse {
  code: number;
  message: string;
  result?: TextinResult;
  x_request_id?: string;
}

export interface TextinResult {
  markdown: string;
  confidence?: number;  // 整体识别置信度 (0-1)
}

// 后处理校验结果
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  type: string;
  message: string;
}
