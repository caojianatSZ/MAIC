/**
 * EduKG智能推荐模块
 * 基于年级和科目推荐热门知识点主题
 */

export interface Recommendation {
  topic: string
  knowledgePointId: string
  difficulty: '基础' | '重点' | '难点'
  estimatedDuration: number // 秒
  relatedTopics: string[]
  popularity: number // 0-100推荐分数
}

// 预定义推荐数据（基于EduKG知识图谱）
// 实际实施时可从EduKG API动态获取
const RECOMMENDATION_DB: Record<string, Record<string, Recommendation[]>> = {
  '初三': {
    '数学': [
      {
        topic: '二次函数最值',
        knowledgePointId: 'kp_quadratic_max_min',
        difficulty: '重点',
        estimatedDuration: 600,
        relatedTopics: ['配方法', '顶点式', '函数图像'],
        popularity: 95
      },
      {
        topic: '一元二次方程解法',
        knowledgePointId: 'kp_quadratic_equation',
        difficulty: '基础',
        estimatedDuration: 480,
        relatedTopics: ['因式分解', '公式法', '求根公式'],
        popularity: 90
      },
      {
        topic: '相似三角形判定',
        knowledgePointId: 'kp_similar_triangles',
        difficulty: '重点',
        estimatedDuration: 720,
        relatedTopics: ['全等三角形', '相似比', '判定定理'],
        popularity: 88
      },
      {
        topic: '圆的性质与切线',
        knowledgePointId: 'kp_circle_properties',
        difficulty: '难点',
        estimatedDuration: 900,
        relatedTopics: ['圆心角', '圆周角', '切线性质'],
        popularity: 85
      },
      {
        topic: '二次函数应用题',
        knowledgePointId: 'kp_quadratic_applications',
        difficulty: '难点',
        estimatedDuration: 600,
        relatedTopics: ['最值问题', '建模', '实际应用'],
        popularity: 92
      },
      {
        topic: '概率计算方法',
        knowledgePointId: 'kp_probability',
        difficulty: '基础',
        estimatedDuration: 360,
        relatedTopics: ['古典概型', '频率', '树状图'],
        popularity: 80
      }
    ],
    '物理': [
      {
        topic: '欧姆定律',
        knowledgePointId: 'kp_ohms_law',
        difficulty: '重点',
        estimatedDuration: 600,
        relatedTopics: ['电流', '电压', '电阻'],
        popularity: 95
      },
      {
        topic: '串联并联电路',
        knowledgePointId: 'kp_circuits',
        difficulty: '基础',
        estimatedDuration: 540,
        relatedTopics: ['电流规律', '电压规律', '电路分析'],
        popularity: 90
      }
    ],
    '语文': [
      {
        topic: '议论文写作方法',
        knowledgePointId: 'kp_argumentative_essay',
        difficulty: '重点',
        estimatedDuration: 720,
        relatedTopics: ['论点', '论据', '论证方法'],
        popularity: 88
      },
      {
        topic: '古诗词鉴赏',
        knowledgePointId: 'kp_poetry_appreciation',
        difficulty: '难点',
        estimatedDuration: 600,
        relatedTopics: ['意象', '意境', '表现手法'],
        popularity: 85
      }
    ]
  },
  '高一': {
    '数学': [
      {
        topic: '集合与函数',
        knowledgePointId: 'kp_sets_functions',
        difficulty: '基础',
        estimatedDuration: 540,
        relatedTopics: ['集合运算', '函数定义', '函数性质'],
        popularity: 90
      },
      {
        topic: '三角函数',
        knowledgePointId: 'kp_trigonometric_functions',
        difficulty: '重点',
        estimatedDuration: 720,
        relatedTopics: ['正弦', '余弦', '正切'],
        popularity: 92
      }
    ],
    '物理': [
      {
        topic: '力的分解与合成',
        knowledgePointId: 'kp_force_decomposition',
        difficulty: '重点',
        estimatedDuration: 600,
        relatedTopics: ['矢量', '平行四边形定则', '三角形定则'],
        popularity: 95
      },
      {
        topic: '牛顿运动定律',
        knowledgePointId: 'kp_newton_laws',
        difficulty: '重点',
        estimatedDuration: 720,
        relatedTopics: ['惯性', '加速度', '受力分析'],
        popularity: 93
      }
    ]
  }
}

/**
 * 获取推荐主题
 */
export async function getRecommendations(
  grade: string,
  subject: string,
  limit: number = 8
): Promise<Recommendation[]> {
  // 从预定义数据库中获取
  const recommendations = RECOMMENDATION_DB[grade]?.[subject] || []

  // 如果没有预定义数据，返回通用推荐
  if (recommendations.length === 0) {
    return getGenericRecommendations(subject, limit)
  }

  // 按popularity排序并限制数量
  return recommendations
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit)
}

/**
 * 获取通用推荐（当没有特定年级数据时）
 */
function getGenericRecommendations(subject: string, limit: number): Recommendation[] {
  const genericTopics: Record<string, string[]> = {
    '数学': ['函数基础', '方程求解', '几何证明', '统计分析'],
    '物理': ['力学基础', '电学基础', '光学现象', '能量转换'],
    '化学': ['元素周期表', '化学反应', '酸碱中和', '氧化还原'],
    '生物': ['细胞结构', '遗传规律', '生态系统', '光合作用'],
    '语文': ['阅读理解', '作文技巧', '古诗词', '文言文'],
    '英语': ['语法基础', '阅读技巧', '写作方法', '词汇积累']
  }

  const topics = genericTopics[subject] || ['基础知识', '重点难点', '实际应用']

  return topics.slice(0, limit).map((topic, index) => ({
    topic,
    knowledgePointId: `kp_generic_${index}`,
    difficulty: index < 2 ? '基础' : '重点',
    estimatedDuration: 600,
    relatedTopics: [],
    popularity: 70 - index * 5
  }))
}
