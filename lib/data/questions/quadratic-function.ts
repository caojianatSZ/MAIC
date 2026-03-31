/**
 * 二次函数题库
 * 包含诊断题和练习题
 */

export interface Question {
  id: string;
  type: 'single' | 'multiple' | 'text';
  question: string;
  options?: string[];
  correctAnswer: number | string;
  knowledgePoints: string[];
  difficulty: number; // 1-5
  explanation?: string;
  tags?: string[];
}

export interface PracticeQuestion extends Question {
  knowledgePoint: string;
  solution?: string;
  commonMistakes?: string[];
}

/**
 * 诊断题库（15道）
 */
export const diagnosisQuestions: Question[] = [
  // 基础概念（3题）
  {
    id: 'dq_001',
    type: 'single',
    question: '下列函数中，哪个是二次函数？',
    options: ['y = 2x + 1', 'y = x²', 'y = 1/x', 'y = √x'],
    correctAnswer: 1,
    knowledgePoints: ['kf_001'],
    difficulty: 1,
    explanation: '二次函数的定义是形如y = ax² + bx + c（a≠0）的函数',
  },
  {
    id: 'dq_002',
    type: 'single',
    question: '二次函数 y = -3x² + 2x - 1 中，二次项系数是？',
    options: ['3', '-3', '2', '-1'],
    correctAnswer: 1,
    knowledgePoints: ['kf_001'],
    difficulty: 1,
    explanation: '二次项系数是x²项的系数，这里是-3',
  },
  {
    id: 'dq_003',
    type: 'single',
    question: '二次函数的一般式是？',
    options: [
      'y = ax² + bx + c',
      'y = a(x-h)² + k',
      'y = a(x-x₁)(x-x₂)',
      '以上都是二次函数的表达形式'
    ],
    correctAnswer: 3,
    knowledgePoints: ['kf_001'],
    difficulty: 1,
    explanation: '二次函数有三种表达形式：一般式、顶点式、交点式',
  },

  // 图像性质（4题）
  {
    id: 'dq_004',
    type: 'single',
    question: '二次函数 y = ax² + bx + c 中，当a > 0时，图像开口方向是？',
    options: ['向上', '向下', '向左', '向右'],
    correctAnswer: 0,
    knowledgePoints: ['kf_002'],
    difficulty: 1,
    explanation: '当a > 0时，抛物线开口向上；当a < 0时，开口向下',
  },
  {
    id: 'dq_005',
    type: 'single',
    question: '二次函数 y = x² - 4x + 3 的对称轴是？',
    options: ['x = 2', 'x = -2', 'x = 4', 'x = -4'],
    correctAnswer: 0,
    knowledgePoints: ['kf_002'],
    difficulty: 2,
    explanation: '对称轴公式：x = -b/2a = -(-4)/2 = 2',
  },
  {
    id: 'dq_006',
    type: 'single',
    question: '抛物线 y = -2(x-1)² + 3 的顶点坐标是？',
    options: ['(1, 3)', '(-1, 3)', '(1, -3)', '(-1, -3)'],
    correctAnswer: 0,
    knowledgePoints: ['kf_002', 'kf_003'],
    difficulty: 2,
    explanation: '顶点式y = a(x-h)² + k的顶点坐标是(h, k)，所以是(1, 3)',
  },
  {
    id: 'dq_007',
    type: 'single',
    question: '二次函数 y = x² + 2x + 3 的最小值是？',
    options: ['2', '3', '4', '5'],
    correctAnswer: 0,
    knowledgePoints: ['kf_002', 'kf_003'],
    difficulty: 3,
    explanation: '配方得y = (x+1)² + 2，当x=-1时，y最小值=2',
  },

  // 配方法（3题）
  {
    id: 'dq_008',
    type: 'single',
    question: '用配方法将 y = x² + 6x + 5 化为顶点式，结果是？',
    options: [
      'y = (x+3)² - 4',
      'y = (x-3)² + 4',
      'y = (x+3)² + 4',
      'y = (x-3)² - 4'
    ],
    correctAnswer: 0,
    knowledgePoints: ['kf_003'],
    difficulty: 3,
    explanation: 'y = x² + 6x + 5 = (x² + 6x + 9) - 4 = (x+3)² - 4',
  },
  {
    id: 'dq_009',
    type: 'single',
    question: '二次函数 y = 2x² - 4x + 1 的顶点坐标是？',
    options: ['(1, -1)', '(-1, -1)', '(1, 1)', '(-1, 1)'],
    correctAnswer: 0,
    knowledgePoints: ['kf_003'],
    difficulty: 3,
    explanation: 'x = -b/2a = 4/4 = 1，y = 2-4+1 = -1，顶点(1, -1)',
  },
  {
    id: 'dq_010',
    type: 'single',
    question: '配方法的主要步骤是？',
    options: [
      '提取二次项系数、配方、整理',
      '配方、提取、整理',
      '提取、整理、配方',
      '整理、提取、配方'
    ],
    correctAnswer: 0,
    knowledgePoints: ['kf_003'],
    difficulty: 2,
    explanation: '配方法步骤：①提取二次项系数 ②加减一次项系数一半的平方 ③整理',
  },

  // 图像变换（3题）
  {
    id: 'dq_011',
    type: 'single',
    question: '将抛物线 y = x² 向右平移2个单位，再向下平移1个单位，得到的函数解析式是？',
    options: [
      'y = (x-2)² - 1',
      'y = (x+2)² - 1',
      'y = (x-2)² + 1',
      'y = (x+2)² + 1'
    ],
    correctAnswer: 0,
    knowledgePoints: ['kf_004'],
    difficulty: 2,
    explanation: '右移2个单位：x→x-2，下移1个单位：-1，得y=(x-2)²-1',
  },
  {
    id: 'dq_012',
    type: 'single',
    question: '抛物线 y = -2(x+1)² + 3 是由 y = -2x² 怎样变换得到的？',
    options: [
      '左移1个单位，上移3个单位',
      '右移1个单位，上移3个单位',
      '左移1个单位，下移3个单位',
      '右移1个单位，下移3个单位'
    ],
    correctAnswer: 0,
    knowledgePoints: ['kf_004'],
    difficulty: 3,
    explanation: 'y = a(x-h)² + k，h=-1表示左移1个单位，k=3表示上移3个单位',
  },
  {
    id: 'dq_013',
    type: 'single',
    question: '两个抛物线 y = a₁(x-h₁)² + k₁ 和 y = a₂(x-h₂)² + k₂ 形状相同、开口方向相反的条件是？',
    options: [
      'a₁ = -a₂',
      'a₁ = a₂',
      'h₁ = h₂ 且 k₁ = k₂',
      'h₁ ≠ h₂'
    ],
    correctAnswer: 0,
    knowledgePoints: ['kf_004'],
    difficulty: 4,
    explanation: '抛物线的形状和开口方向由二次项系数a决定，a₁ = -a₂时形状相同、方向相反',
  },

  // 实际应用（2题）
  {
    id: 'dq_014',
    type: 'single',
    question: '某果园有100棵苹果树，每棵树平均结600个苹果。现准备多种一些苹果树以提高产量，但是每多种一棵树，每棵树的产量就会减少5个。问：多种多少棵苹果树可以使总产量最大？',
    options: ['10棵', '15棵', '20棵', '25棵'],
    correctAnswer: 0,
    knowledgePoints: ['kf_005'],
    difficulty: 4,
    explanation: '设多种x棵，总产量y=(100+x)(600-5x)=-5x²+100x+60000，当x=10时，y最大',
  },
  {
    id: 'dq_015',
    type: 'single',
    question: '用长为20米的篱笆围成一个矩形菜园，菜园面积最大是多少平方米？',
    options: ['20', '25', '50', '100'],
    correctAnswer: 3,
    knowledgePoints: ['kf_005'],
    difficulty: 3,
    explanation: '设长为x，宽为(10-x)，面积S=x(10-x)=-x²+10x，当x=5时，S最大=25',
  },
];

/**
 * 练习题库（每个知识点5-10道）
 */
export const practiceQuestions: Record<string, PracticeQuestion[]> = {
  // 二次函数定义
  'kf_001': [
    {
      id: 'pq_001_001',
      type: 'single',
      question: '下列各式中，y是x的二次函数的是？',
      options: ['y = 2x²', 'y = x + 2', 'y = 3/x', 'y = √x'],
      correctAnswer: 0,
      knowledgePoint: 'kf_001',
      knowledgePoints: ['kf_001'],
      difficulty: 1,
      explanation: '二次函数的定义是形如y = ax² + bx + c（a≠0）的函数',
      solution: '判断二次函数的关键：①是整式函数 ②最高次数是2 ③二次项系数不为0',
      commonMistakes: ['误认为y = x + 2是二次函数', '忽略a≠0的条件'],
    },
    {
      id: 'pq_001_002',
      type: 'single',
      question: '对于二次函数 y = (m-2)x² + 3x，m的取值范围是？',
      options: ['m ≠ 2', 'm > 2', 'm < 2', 'm = 2'],
      correctAnswer: 0,
      knowledgePoint: 'kf_001',
      knowledgePoints: ['kf_001'],
      difficulty: 2,
      explanation: '二次项系数不能为0，所以m-2 ≠ 0，即m ≠ 2',
    },
    {
      id: 'pq_001_003',
      type: 'text',
      question: '已知函数 y = (m²-m)x² + mx + (m+1)，当m为何值时，它是二次函数？',
      correctAnswer: 'm²-m ≠ 0，即m ≠ 0且m ≠ 1',
      knowledgePoint: 'kf_001',
      knowledgePoints: ['kf_001'],
      difficulty: 2,
      explanation: '要使函数为二次函数，需满足m²-m ≠ 0，解得m ≠ 0且m ≠ 1',
    },
    {
      id: 'pq_001_004',
      type: 'single',
      question: '二次函数 y = ax² + bx + c 中，常数项c表示？',
      options: [
        '图像与y轴的交点纵坐标',
        '图像的对称轴',
        '图像的开口方向',
        '图像的顶点纵坐标'
      ],
      correctAnswer: 0,
      knowledgePoint: 'kf_001',
      knowledgePoints: ['kf_001'],
      difficulty: 1,
      explanation: '当x=0时，y=c，所以(0, c)是图像与y轴的交点',
    },
    {
      id: 'pq_001_005',
      type: 'single',
      question: '下列说法正确的是？',
      options: [
        '二次函数的自变量取值范围是全体实数',
        '二次函数的图像都是抛物线',
        '二次函数都有最值',
        '以上说法都正确'
      ],
      correctAnswer: 3,
      knowledgePoint: 'kf_001',
      knowledgePoints: ['kf_001'],
      difficulty: 2,
      explanation: '二次函数的定义域是R，图像是抛物线，当a>0时有最小值，a<0时有最大值',
    },
  ],

  // 二次函数图像
  'kf_002': [
    {
      id: 'pq_002_001',
      type: 'single',
      question: '抛物线 y = -2x² + 4x - 1 的开口方向、对称轴分别是？',
      options: [
        '向上，x = 1',
        '向下，x = 1',
        '向上，x = -1',
        '向下，x = -1'
      ],
      correctAnswer: 1,
      knowledgePoint: 'kf_002',
      knowledgePoints: ['kf_002'],
      difficulty: 2,
      explanation: 'a=-2<0，开口向下；对称轴x=-b/2a=-4/(-4)=1',
    },
    {
      id: 'pq_002_002',
      type: 'single',
      question: '抛物线 y = x² - 2x + 3 与 y轴的交点是？',
      options: ['(0, 3)', '(0, -3)', '(3, 0)', '(-3, 0)'],
      correctAnswer: 0,
      knowledgePoint: 'kf_002',
      knowledgePoints: ['kf_002'],
      difficulty: 1,
      explanation: '与y轴交点横坐标x=0，纵坐标y=3，所以交点为(0, 3)',
    },
    {
      id: 'pq_002_003',
      type: 'single',
      question: '二次函数 y = ax² + bx + c 的对称轴是直线 x = 2，且经过点(0, 1)，则c = ？',
      options: ['1', '-1', '2', '-2'],
      correctAnswer: 0,
      knowledgePoint: 'kf_002',
      knowledgePoints: ['kf_002'],
      difficulty: 3,
      explanation: '点(0, 1)在图像上，所以当x=0时，y=c=1',
    },
    {
      id: 'pq_002_004',
      type: 'single',
      question: '抛物线 y = 2(x-1)² + 3 的顶点坐标和对称轴分别是？',
      options: [
        '(1, 3)，x = 1',
        '(-1, 3)，x = -1',
        '(1, 3)，x = -1',
        '(-1, 3)，x = 1'
      ],
      correctAnswer: 0,
      knowledgePoint: 'kf_002',
      knowledgePoints: ['kf_002'],
      difficulty: 2,
      explanation: '顶点式y = a(x-h)² + k的顶点是(h, k)，对称轴是x = h',
    },
    {
      id: 'pq_002_005',
      type: 'single',
      question: '将抛物线 y = x² 先向左平移1个单位，再向下平移2个单位，得到的解析式是？',
      options: [
        'y = (x+1)² - 2',
        'y = (x-1)² - 2',
        'y = (x+1)² + 2',
        'y = (x-1)² + 2'
      ],
      correctAnswer: 0,
      knowledgePoint: 'kf_002',
      knowledgePoints: ['kf_002', 'kf_004'],
      difficulty: 3,
      explanation: '左移1个单位：x→x+1，下移2个单位：-2，得y=(x+1)²-2',
    },
  ],

  // 配方法求顶点
  'kf_003': [
    {
      id: 'pq_003_001',
      type: 'text',
      question: '用配方法将 y = x² - 4x + 2 化为顶点式',
      correctAnswer: 'y = (x-2)² - 2',
      knowledgePoint: 'kf_003',
      knowledgePoints: ['kf_003'],
      difficulty: 3,
      explanation: 'y = (x²-4x+4) - 2 = (x-2)² - 2',
      solution: '配方法步骤：①配方：加减一次项系数一半的平方 ②整理为完全平方式',
    },
    {
      id: 'pq_003_002',
      type: 'single',
      question: '二次函数 y = 2x² - 8x + 5 的最小值是？',
      options: ['-3', '-5', '3', '5'],
      correctAnswer: 0,
      knowledgePoint: 'kf_003',
      knowledgePoints: ['kf_003'],
      difficulty: 3,
      explanation: '配方得y = 2(x-2)² - 3，最小值为-3',
    },
    {
      id: 'pq_003_003',
      type: 'text',
      question: '用配方法求 y = -x² + 6x - 8 的最大值',
      correctAnswer: '最大值为1',
      knowledgePoint: 'kf_003',
      knowledgePoints: ['kf_003'],
      difficulty: 3,
      explanation: 'y = -(x²-6x+9) + 1 = -(x-3)² + 1，最大值为1',
    },
    {
      id: 'pq_003_004',
      type: 'single',
      question: '二次函数 y = ax² + bx + c 经过配方后得 y = a(x-h)² + k，其中h = ？',
      options: ['-b/2a', 'b/2a', '-b/a', 'b/a'],
      correctAnswer: 0,
      knowledgePoint: 'kf_003',
      knowledgePoints: ['kf_003'],
      difficulty: 2,
      explanation: '对称轴公式x = -b/2a，所以h = -b/2a',
    },
    {
      id: 'pq_003_005',
      type: 'text',
      question: '已知二次函数 y = x² + 4x + c 的顶点纵坐标是1，求c的值',
      correctAnswer: 'c = 5',
      knowledgePoint: 'kf_003',
      knowledgePoints: ['kf_003'],
      difficulty: 3,
      explanation: '配方得y = (x+2)² + c - 4，顶点纵坐标是c-4=1，所以c=5',
    },
  ],

  // 图像平移变换
  'kf_004': [
    {
      id: 'pq_004_001',
      type: 'single',
      question: '抛物线 y = 2x² 向右平移3个单位后，解析式为？',
      options: [
        'y = 2(x-3)²',
        'y = 2(x+3)²',
        'y = 2x² - 3',
        'y = 2x² + 3'
      ],
      correctAnswer: 0,
      knowledgePoint: 'kf_004',
      knowledgePoints: ['kf_004'],
      difficulty: 2,
      explanation: '右移3个单位：x→x-3，得y = 2(x-3)²',
    },
    {
      id: 'pq_004_002',
      type: 'single',
      question: '将抛物线 y = (x+1)² - 2 先向右平移2个单位，再向上平移3个单位，得到的解析式是？',
      options: [
        'y = (x-1)² + 1',
        'y = (x+3)² + 1',
        'y = (x-1)² + 5',
        'y = (x+3)² + 5'
      ],
      correctAnswer: 0,
      knowledgePoint: 'kf_004',
      knowledgePoints: ['kf_004'],
      difficulty: 3,
      explanation: '原式为y=(x+1)²-2，右移2个单位：(x-1)²-2，上移3个单位：(x-1)²+1',
    },
    {
      id: 'pq_004_003',
      type: 'single',
      question: '抛物线 y = -2(x-1)² + 3 是由 y = -2x² 经过怎样变换得到的？',
      options: [
        '右移1个单位，上移3个单位',
        '左移1个单位，上移3个单位',
        '右移1个单位，下移3个单位',
        '左移1个单位，下移3个单位'
      ],
      correctAnswer: 0,
      knowledgePoint: 'kf_004',
      knowledgePoints: ['kf_004'],
      difficulty: 2,
      explanation: '顶点式y=a(x-h)²+k中，h=1表示右移1个单位，k=3表示上移3个单位',
    },
    {
      id: 'pq_004_004',
      type: 'single',
      question: '两个抛物线 y = a₁(x-h₁)² + k₁ 和 y = a₂(x-h₂)² + k₂ 的形状和大小完全相同，则必有？',
      options: [
        '|a₁| = |a₂|',
        'a₁ = a₂',
        'h₁ = h₂',
        'k₁ = k₂'
      ],
      correctAnswer: 0,
      knowledgePoint: 'kf_004',
      knowledgePoints: ['kf_004'],
      difficulty: 3,
      explanation: '抛物线的形状和大小由|a|决定，|a|相同则形状和大小相同',
    },
    {
      id: 'pq_004_005',
      type: 'single',
      question: '将抛物线 y = x² 沿x轴翻折，得到的解析式是？',
      options: [
        'y = -x²',
        'y = (-x)²',
        'y = x²',
        'y = |x|²'
      ],
      correctAnswer: 0,
      knowledgePoint: 'kf_004',
      knowledgePoints: ['kf_004'],
      difficulty: 3,
      explanation: '沿x轴翻折相当于开口方向相反，即a变号，得y = -x²',
    },
  ],

  // 实际应用题
  'kf_005': [
    {
      id: 'pq_005_001',
      type: 'text',
      question: '一个矩形周长为20cm，求矩形面积的最大值',
      correctAnswer: '最大面积为25cm²',
      knowledgePoint: 'kf_005',
      knowledgePoints: ['kf_005'],
      difficulty: 3,
      explanation: '设长为x，宽为(10-x)，面积S=x(10-x)=-x²+10x，当x=5时，S最大=25',
      solution: '实际问题转化为二次函数最值问题的步骤：①设变量 ②列函数 ③求最值',
    },
    {
      id: 'pq_005_002',
      type: 'single',
      question: '某商品现在的售价是每件60元，每星期可卖出300件。市场调查反映：如调整价格，每涨价1元，每星期要少卖出10件；每降价1元，每星期可多卖出20件。如何定价才能使每星期的销售额最大？',
      options: [
        '定价为75元',
        '定价为70元',
        '定价为65元',
        '定价为60元'
      ],
      correctAnswer: 0,
      knowledgePoint: 'kf_005',
      knowledgePoints: ['kf_005'],
      difficulty: 5,
      explanation: '设涨价x元，销售额y=(60+x)(300-10x)=-10x²+300x+18000，当x=15时，y最大，定价75元',
    },
    {
      id: 'pq_005_003',
      type: 'text',
      question: '用长为30米的篱笆围成一个靠墙的矩形菜园，菜园面积最大是多少平方米？',
      correctAnswer: '最大面积为112.5平方米',
      knowledgePoint: 'kf_005',
      knowledgePoints: ['kf_005'],
      difficulty: 4,
      explanation: '设垂直于墙的边长为x，则平行于墙的边长为30-2x，面积S=x(30-2x)=-2x²+30x，当x=7.5时，S最大=112.5',
    },
    {
      id: 'pq_005_004',
      type: 'single',
      question: '某水果批发商场经销一种高档水果，如果每千克盈利10元，每天可卖出500千克。经市场调查发现，在进价不变的情况下，若每千克涨价1元，日销售量将减少20千克。若该商场要在保本的前提下每天盈利6000元，同时又要让顾客得到实惠，那么每千克应涨价多少元？',
      options: ['5元', '10元', '15元', '20元'],
      correctAnswer: 0,
      knowledgePoint: 'kf_005',
      knowledgePoints: ['kf_005'],
      difficulty: 5,
      explanation: '设涨价x元，利润y=(10+x)(500-20x)=-20x²+300x+5000，解方程-20x²+300x+5000=6000得x=5或x=10，取较小的x=5让顾客得到实惠',
    },
    {
      id: 'pq_005_005',
      type: 'single',
      question: '如图，一位运动员在距篮下4米处跳起投篮，球运行的路线是抛物线，当球运行的水平距离为2.5米时，达到最大高度3.5米，然后准确落入篮筐。已知篮筐中心到地面的距离为3.05米，该运动员身高1.8米，在这次跳投中，球在头顶上方0.25米处出手，问：球出手时，他跳离地面的高度是多少？',
      options: ['0.2米', '0.25米', '0.3米', '0.35米'],
      correctAnswer: 0,
      knowledgePoint: 'kf_005',
      knowledgePoints: ['kf_005'],
      difficulty: 5,
      explanation: '这是一个二次函数建模问题，需要根据题意建立坐标系，求出抛物线解析式，然后计算',
    },
  ],
};

/**
 * 根据知识点获取练习题
 */
export function getPracticeQuestions(knowledgePointId: string): PracticeQuestion[] {
  return practiceQuestions[knowledgePointId] || [];
}

/**
 * 根据难度获取练习题
 */
export function getQuestionsByDifficulty(
  knowledgePointId: string,
  minDifficulty: number,
  maxDifficulty: number
): PracticeQuestion[] {
  const questions = practiceQuestions[knowledgePointId] || [];
  return questions.filter(
    q => q.difficulty >= minDifficulty && q.difficulty <= maxDifficulty
  );
}

/**
 * 随机获取练习题
 */
export function getRandomQuestions(
  knowledgePointId: string,
  count: number
): PracticeQuestion[] {
  const questions = practiceQuestions[knowledgePointId] || [];
  const shuffled = [...questions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
