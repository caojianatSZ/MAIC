/**
 * 模板降级模块
 * 当AI生成失败时使用预定义模板
 */

export interface TemplateOptions {
  type: string
  subject: string
  topic: string
}

export function getTemplateScene(options: TemplateOptions): any {
  const { type, subject, topic } = options

  const templates: Record<string, any> = {
    'slide': {
      type: 'slide',
      title: `${topic} - 概念讲解`,
      content: {
        type: 'explanation',
        text: `关于${topic}的核心知识点讲解。这是AI生成时的降级模板，实际使用时会由AI生成更丰富的内容。`,
        keyPoints: [
          `${topic}的基本概念`,
          `${topic}的重要性质`,
          `${topic}的应用方法`
        ]
      },
      duration: 120
    },
    'quiz': {
      type: 'quiz',
      title: `${topic} - 练习测试`,
      content: {
        type: 'quiz',
        questions: [
          {
            question: `关于${topic}，以下说法正确的是？`,
            options: [
              '选项A：这是降级模板的选项A',
              '选项B：这是降级模板的选项B',
              '选项C：这是降级模板的选项C',
              '选项D：这是降级模板的选项D'
            ],
            correctAnswer: 0,
            explanation: '这是AI生成时的降级解释'
          }
        ]
      },
      duration: 180
    },
    'interactive': {
      type: 'interactive',
      title: `${topic} - 互动探索`,
      content: {
        type: 'interactive_simulation',
        description: `探索${topic}的相关概念和性质`,
        interactiveElements: ['slider', 'stepByStep']
      },
      duration: 150
    }
  }

  return templates[type] || templates['slide']
}
