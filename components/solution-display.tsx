'use client';

/**
 * 标准答案与解析展示组件
 *
 * 特性：
 * - 折叠/展开显示
 * - 按需加载解析
 * - Markdown 渲染（支持 LaTeX 公式）
 * - 响应式设计
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, BookOpen, Lightbulb, FileText, CheckCircle } from 'lucide-react';

interface SolutionDisplayProps {
  questionId: string;
  questionContent?: string;
  subject: string;
  grade: string;
  imageUrl?: string;
  initialData?: {
    examPoints?: string;
    methodGuide?: string;
    detailedAnalysis?: string;
    standardAnswer?: string;
  };
}

interface SolutionData {
  examPoints: string;
  methodGuide: string;
  detailedAnalysis: string;
  standardAnswer: string;
}

export function SolutionDisplay({
  questionId,
  questionContent,
  subject,
  grade,
  imageUrl,
  initialData
}: SolutionDisplayProps) {
  // 将初始数据转换为完整格式
  const getInitialData = (): SolutionData | null => {
    if (!initialData) return null;
    return {
      examPoints: initialData.examPoints || '',
      methodGuide: initialData.methodGuide || '',
      detailedAnalysis: initialData.detailedAnalysis || '',
      standardAnswer: initialData.standardAnswer || ''
    };
  };

  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SolutionData | null>(getInitialData());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // 折叠部分
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // 加载解析
  const loadSolution = async () => {
    if (data) {
      // 已有数据，直接展开
      setExpanded(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/solution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          questionContent,
          subject,
          grade,
          imageUrl
        })
      });

      const result = await response.json();

      if (result.success) {
        setData({
          examPoints: result.examPoints || '',
          methodGuide: result.methodGuide || '',
          detailedAnalysis: result.detailedAnalysis || '',
          standardAnswer: result.standardAnswer || ''
        });
        setExpanded(true);

        // 默认展开考点分析和最终答案
        if (result.examPoints) {
          setExpandedSections(new Set(['examPoints', 'standardAnswer']));
        }
      } else {
        setError(result.error || '加载解析失败');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 渲染 Markdown 内容（简化版，可后续集成完整的 Markdown 渲染器）
  const renderMarkdown = (text: string) => {
    if (!text) return null;

    // 简单的 Markdown 处理
    return text.split('\n').map((line, i) => {
      // 标题
      if (line.startsWith('####')) {
        const content = line.replace(/#{4,}\s*/, '');
        return <h4 key={i} className="font-semibold mt-3 mb-1 text-sm">{content}</h4>;
      }
      if (line.startsWith('###')) {
        const content = line.replace(/#{3,}\s*/, '');
        return <h3 key={i} className="font-semibold mt-4 mb-2">{content}</h3>;
      }

      // 粗体
      let processedLine = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

      // LaTeX 公式（简单处理，可后续使用 KaTeX）
      processedLine = processedLine.replace(/\$\$([^$]+)\$\$/g, '<span className="font-mono bg-gray-100 px-1 rounded">$1</span>');
      processedLine = processedLine.replace(/\$([^$]+)\$/g, '<span className="font-mono bg-gray-100 px-1 rounded">$1</span>');

      // 列表
      if (line.trim().match(/^\d+\./)) {
        return <li key={i} className="ml-4 my-1" dangerouslySetInnerHTML={{ __html: processedLine }} />;
      }
      if (line.trim().startsWith('-')) {
        return <li key={i} className="ml-4 my-1" dangerouslySetInnerHTML={{ __html: processedLine }} />;
      }

      // 空行
      if (!line.trim()) {
        return <br key={i} />;
      }

      // 普通文本
      return <p key={i} className="my-1" dangerouslySetInnerHTML={{ __html: processedLine }} />;
    });
  };

  return (
    <div className="solution-display bg-gray-50 rounded-lg overflow-hidden">
      {/* 折叠标题 */}
      <button
        onClick={() => { if (!expanded) loadSolution(); else setExpanded(false); }}
        className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500" />
          )}
          <BookOpen className="w-5 h-5 text-blue-500" />
          <span className="font-medium">
            {loading ? '加载中...' : '查看标准答案和解析'}
          </span>
        </div>
        {loading && (
          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
        )}
      </button>

      {/* 解析内容 */}
      {expanded && data && (
        <div className="p-4 space-y-3">
          {/* 考点分析 */}
          {data.examPoints && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleSection('examPoints')}
                className="w-full flex items-center gap-2 p-2 bg-amber-50 hover:bg-amber-100 transition-colors"
              >
                {expandedSections.has('examPoints') ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <FileText className="w-4 h-4 text-amber-600" />
                <span className="font-medium text-sm">考点分析</span>
              </button>
              {expandedSections.has('examPoints') && (
                <div className="p-3 text-sm text-gray-700">
                  {renderMarkdown(data.examPoints)}
                </div>
              )}
            </div>
          )}

          {/* 方法点拨 */}
          {data.methodGuide && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleSection('methodGuide')}
                className="w-full flex items-center gap-2 p-2 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                {expandedSections.has('methodGuide') ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <Lightbulb className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-sm">方法点拨</span>
              </button>
              {expandedSections.has('methodGuide') && (
                <div className="p-3 text-sm text-gray-700">
                  {renderMarkdown(data.methodGuide)}
                </div>
              )}
            </div>
          )}

          {/* 详细解析 */}
          {data.detailedAnalysis && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleSection('detailedAnalysis')}
                className="w-full flex items-center gap-2 p-2 bg-purple-50 hover:bg-purple-100 transition-colors"
              >
                {expandedSections.has('detailedAnalysis') ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <FileText className="w-4 h-4 text-purple-600" />
                <span className="font-medium text-sm">详细解析</span>
              </button>
              {expandedSections.has('detailedAnalysis') && (
                <div className="p-3 text-sm text-gray-700 max-h-60 overflow-y-auto">
                  {renderMarkdown(data.detailedAnalysis)}
                </div>
              )}
            </div>
          )}

          {/* 最终答案 */}
          {data.standardAnswer && (
            <div className="bg-green-50 rounded-lg border border-green-200 p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="font-medium text-sm text-green-800">最终答案</span>
              </div>
              <div className="text-sm text-gray-800 font-medium">
                {renderMarkdown(data.standardAnswer)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50">
          {error}
          <button
            onClick={() => { setError(null); loadSolution(); }}
            className="ml-2 underline hover:text-red-800"
          >
            重试
          </button>
        </div>
      )}
    </div>
  );
}
