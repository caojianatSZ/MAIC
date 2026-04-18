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
  structuredData?: StructuredData[];  // 结构化数据
}

// TextIn 返回的结构化数据
export interface StructuredData {
  content?: number[] | ContentItem[];  // 字符索引数组或内容项数组
  text?: string;                       // 直接的文本内容（优先使用）
  id: number;
  outline_level: number;
  pos: number[];
  sub_type?: string;
  tags?: string[];
  type: string;
}

export interface ContentItem {
  content: any;
  text?: string;
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
