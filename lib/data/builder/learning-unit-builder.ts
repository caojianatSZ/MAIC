/**
 * 学习单元构建器
 * 用于组装完整的学习单元数据
 */

import { diagnosisQuestions } from '../questions/quadratic-function';
import { quadraticFunctionLessons, sampleScenes } from '../lessons/lessons';
import { edukgAdapter, type GraphNode } from '@/lib/edukg/adapter';

export interface LearningUnit {
  unit: {
    id: string;
    title: string;
    description: string;
    subject: string;
    topic: string;
    estimatedDuration: number;
    difficulty: string;
  };
  diagnosisQuiz: any;
  knowledgeGraph: any;
  learningPath: any;
  lessons: any[];
  practiceQuestions: any[];
  metadata: any;
}

/**
 * 构建完整的学习单元
 */
export async function buildLearningUnit(
  subject: string,
  topic: string,
  options?: {
    questionCount?: number;
    lessonIds?: string[];
    includeScenes?: boolean;
  }
): Promise<LearningUnit> {
  const {
    questionCount = 5,
    lessonIds,
    includeScenes = false
  } = options || {};

  // 1. 生成诊断题
  const diagnosisQuiz = buildDiagnosisQuiz(subject, topic, questionCount);

  // 2. 获取知识图谱
  const knowledgeGraph = await edukgAdapter.getKnowledgeGraph(subject, topic);

  // 3. 生成学习路径
  const learningPath = buildLearningPath(knowledgeGraph);

  // 4. 获取课程
  const lessons = buildLessons(lessonIds, includeScenes);

  // 5. 生成练习题
  const practiceQuestions = buildPracticeQuestions(knowledgeGraph);

  const unit: LearningUnit = {
    unit: {
      id: `${topic}_${Date.now()}`,
      title: `${topic}自适应学习`,
      description: `通过诊断发现你的薄弱点，然后针对性学习${topic}相关知识`,
      subject,
      topic,
      estimatedDuration: learningPath.totalEstimatedDuration,
      difficulty: 'intermediate'
    },
    diagnosisQuiz,
    knowledgeGraph,
    learningPath,
    lessons,
    practiceQuestions,
    metadata: {
      version: '1.0',
      createdAt: new Date().toISOString(),
      author: 'OpenMAIC',
      source: 'EduKG基础教育知识图谱服务平台'
    }
  };

  return unit;
}

/**
 * 构建诊断测验
 */
function buildDiagnosisQuiz(subject: string, topic: string, count: number) {
  // 随机选择题目
  const selectedQuestions = getRandomQuestions(diagnosisQuestions, count);

  return {
    quizId: `quiz_${topic}_${Date.now()}`,
    subject,
    topic,
    questions: selectedQuestions,
    estimatedDuration: Math.ceil(count * 1.5)
  };
}

/**
 * 构建学习路径
 */
function buildLearningPath(knowledgeGraph: any) {
  const nodes = knowledgeGraph.nodes || [];
  const edges = knowledgeGraph.edges || [];

  // 按level排序节点
  const sortedNodes = [...nodes].sort((a, b) => a.level - b.level);

  // 生成学习路径
  const path = sortedNodes.map((node, index) => {
    // 获取该知识点的推荐课程
    const recommendedLessons = quadraticFunctionLessons
      .filter(lesson => lesson.knowledgePoints.includes(node.id))
      .slice(0, 2)
      .map(lesson => lesson.id);

    return {
      step: index + 1,
      knowledgePointId: node.id,
      knowledgePointName: node.name,
      description: node.description,
      difficulty: node.difficulty,
      prerequisites: node.prerequisites,
      recommendedLessons,
      estimatedDuration: Math.ceil(node.difficulty * 1.5), // 基于难度估算时长
      status: 'pending'
    };
  });

  const totalEstimatedDuration = path.reduce((sum, step) => sum + step.estimatedDuration, 0);

  return {
    subject: knowledgeGraph.subject,
    targetKnowledgePoints: nodes.map((n: GraphNode) => n.id),
    path,
    totalEstimatedDuration,
    totalSteps: path.length,
    metadata: {
      generatedAt: new Date().toISOString(),
      algorithm: 'topological_sort_with_difficulty',
      source: knowledgeGraph.source
    }
  };
}

/**
 * 构建课程列表
 */
function buildLessons(lessonIds?: string[], includeScenes = false) {
  let lessons = lessonIds
    ? lessonIds.map(id => quadraticFunctionLessons.find(l => l.id === id)).filter(Boolean)
    : quadraticFunctionLessons;

  lessons = lessons.map((lesson) => {
    if (!lesson) return null;

    const lessonData: any = { ...lesson };

    if (includeScenes && sampleScenes[lesson.id]) {
      lessonData.scenes = sampleScenes[lesson.id];
    }

    return lessonData;
  }).filter(Boolean);

  return lessons;
}

/**
 * 构建练习题
 */
function buildPracticeQuestions(knowledgeGraph: any) {
  const nodes = knowledgeGraph.nodes || [];
  const questions: any[] = [];

  // 为每个知识点添加练习题
  // TODO: 从题库中获取实际练习题
  nodes.forEach((node: GraphNode) => {
    const kpQuestions = {
      id: `practice_${node.id}_001`,
      question: `关于${node.name}的练习题`,
      type: 'single',
      knowledgePoint: node.id,
      answer: 0,
      explanation: `这是${node.name}的练习题解析`,
      difficulty: node.difficulty
    };

    questions.push(kpQuestions);
  });

  return questions;
}

/**
 * 随机选择题目
 */
function getRandomQuestions(questions: any[], count: number) {
  const shuffled = [...questions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, questions.length));
}

/**
 * 构建Demo学习单元
 */
export async function buildDemoLearningUnit(): Promise<LearningUnit> {
  return buildLearningUnit('math', 'quadratic_function', {
    questionCount: 5,
    lessonIds: ['lesson_001', 'lesson_002', 'lesson_003', 'lesson_004', 'lesson_005'],
    includeScenes: false
  });
}
