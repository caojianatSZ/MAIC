/**
 * EduKG知识图谱集成服务
 *
 * EduKG是清华大学开源的K-12教育领域知识图谱
 * 官网：http://edukg.openkg.cn/
 * 文档：https://github.com/Unkn0wnCat/EduKG-API-doc
 */

interface EduKGConfig {
  apiKey: string;
  baseUrl: string;
}

interface EduKGInstance {
  uri: string; // 实体URI，如 "http://edukg.knowledge.com/数学#有理数"
  label: string; // 实体名称，如 "有理数"
  category: string; // 分类：数学、语文、英语、物理、化学、生物、历史、地理、政治
  type?: string; // 类型：概念、公式、定理、例题等
  description?: string; // 描述
  aliases?: string[]; // 别名
}

interface EduKGRelation {
  subject: string; // 主体URI
  subjectLabel: string; // 主体名称
  predicate: string; // 谓词/关系类型
  object: string; // 客体URI
  objectLabel: string; // 客体名称
}

interface EduKGSearchResponse {
  status: number;
  data: EduKGInstance[];
}

interface EduKGInstanceResponse {
  status: number;
  data: EduKGInstance;
}

interface EduKGRelationsResponse {
  status: number;
  data: EduKGRelation[];
}

class EduKGService {
  private config: EduKGConfig;

  constructor(config?: Partial<EduKGConfig>) {
    this.config = {
      apiKey: config?.apiKey || process.env.EDUKG_API_KEY || '',
      baseUrl: config?.baseUrl || process.env.EDUKG_BASE_URL || 'https://api.edukg.cn',
    };
  }

  /**
   * 获取知识点实例详情
   * @param uri 知识点URI，如 "http://edukg.knowledge.com/数学#有理数"
   * @returns 知识点实例信息
   */
  async getInstanceInfo(uri: string): Promise<EduKGInstance | null> {
    try {
      // 简化URI（去除完整路径，只保留分类和名称）
      const simplifiedUri = this.simplifyUri(uri);

      const response = await fetch(
        `${this.config.baseUrl}/kdkg/entityInstance?uri=${encodeURIComponent(simplifiedUri)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.warn(`EduKG API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const result: EduKGInstanceResponse = await response.json();

      if (result.status !== 0) {
        console.warn(`EduKG API returned error status: ${result.status}`);
        return null;
      }

      return {
        uri: result.data.uri || simplifiedUri,
        label: result.data.label,
        category: result.data.category,
        type: result.data.type,
        description: result.data.description,
        aliases: result.data.aliases,
      };
    } catch (error) {
      console.error('EduKG getInstanceInfo error:', error);
      return null;
    }
  }

  /**
   * 搜索知识点实例
   * @param keyword 搜索关键词
   * @param category 分类（可选）：数学、语文、英语、物理、化学、生物、历史、地理、政治
   * @returns 匹配的知识点列表
   */
  async searchInstances(
    keyword: string,
    category?: string
  ): Promise<EduKGInstance[]> {
    try {
      const params = new URLSearchParams({
        keyword: keyword.trim(),
      });

      if (category) {
        params.append('category', category);
      }

      const response = await fetch(
        `${this.config.baseUrl}/kdkg/searchInstance?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.warn(`EduKG API error: ${response.status} ${response.statusText}`);
        return [];
      }

      const result: EduKGSearchResponse = await response.json();

      if (result.status !== 0) {
        console.warn(`EduKG API returned error status: ${result.status}`);
        return [];
      }

      return result.data.map((item) => ({
        uri: item.uri,
        label: item.label,
        category: item.category,
        type: item.type,
        description: item.description,
        aliases: item.aliases,
      }));
    } catch (error) {
      console.error('EduKG searchInstances error:', error);
      return [];
    }
  }

  /**
   * 获取子知识点
   * @param parentUri 父知识点URI
   * @returns 子知识点列表
   */
  async getChildNodes(parentUri: string): Promise<EduKGInstance[]> {
    try {
      const simplifiedUri = this.simplifyUri(parentUri);

      const response = await fetch(
        `${this.config.baseUrl}/kdkg/getChildNodes?uri=${encodeURIComponent(simplifiedUri)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.warn(`EduKG API error: ${response.status} ${response.statusText}`);
        return [];
      }

      const result: EduKGSearchResponse = await response.json();

      if (result.status !== 0) {
        console.warn(`EduKG API returned error status: ${result.status}`);
        return [];
      }

      return result.data.map((item) => ({
        uri: item.uri,
        label: item.label,
        category: item.category,
        type: item.type,
        description: item.description,
        aliases: item.aliases,
      }));
    } catch (error) {
      console.error('EduKG getChildNodes error:', error);
      return [];
    }
  }

  /**
   * 获取知识点关系
   * @param uri 知识点URI
   * @returns 关系列表
   */
  async getRelations(uri: string): Promise<EduKGRelation[]> {
    try {
      const simplifiedUri = this.simplifyUri(uri);

      const response = await fetch(
        `${this.config.baseUrl}/kdkg/getRelated?uri=${encodeURIComponent(simplifiedUri)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.warn(`EduKG API error: ${response.status} ${response.statusText}`);
        return [];
      }

      const result: EduKGRelationsResponse = await response.json();

      if (result.status !== 0) {
        console.warn(`EduKG API returned error status: ${result.status}`);
        return [];
      }

      return result.data;
    } catch (error) {
      console.error('EduKG getRelations error:', error);
      return [];
    }
  }

  /**
   * 简化URI（保留分类和名称部分）
   * @param uri 原始URI
   * @returns 简化的URI
   *
   * 示例：
   * Input: "http://edukg.knowledge.com/数学#有理数"
   * Output: "数学#有理数"
   */
  private simplifyUri(uri: string): string {
    // 移除协议和域名
    const withoutProtocol = uri.replace(/^https?:\/\//, '');
    const parts = withoutProtocol.split('/');

    // 如果包含域名，移除域名部分
    if (parts.length > 1 && parts[0].includes('.')) {
      return parts.slice(1).join('/');
    }

    return uri;
  }

  /**
   * 从URI提取知识点名称
   * @param uri 知识点URI
   * @returns 知识点名称
   *
   * 示例：
   * Input: "数学#有理数"
   * Output: "有理数"
   */
  extractKnowledgePointName(uri: string): string {
    const parts = uri.split('#');
    return parts[parts.length - 1] || uri;
  }

  /**
   * 从URI提取分类
   * @param uri 知识点URI
   * @returns 分类（数学、语文等）
   *
   * 示例：
   * Input: "数学#有理数"
   * Output: "数学"
   */
  extractCategory(uri: string): string {
    const parts = uri.split('#');
    if (parts.length > 1) {
      return parts[0];
    }
    return '';
  }

  /**
   * AI辅助识别知识点
   * 使用关键词匹配和语义相似度找到最相关的知识点
   * @param text 题目或描述文本
   * @param category 可选的分类限制
   * @returns 匹配的知识点列表（按相关性排序）
   */
  async recognizeKnowledgePoints(
    text: string,
    category?: string
  ): Promise<EduKGInstance[]> {
    // 1. 提取关键词（简单实现：分词并过滤停用词）
    const keywords = this.extractKeywords(text);

    if (keywords.length === 0) {
      return [];
    }

    // 2. 对每个关键词进行搜索
    const searchResults = await Promise.all(
      keywords.slice(0, 3).map((keyword) => // 限制搜索前3个关键词
        this.searchInstances(keyword, category)
      )
    );

    // 3. 合并结果并去重
    const allInstances = searchResults.flat();
    const uniqueInstances = this.deduplicateInstances(allInstances);

    // 4. 计算相关性得分并排序
    const scoredInstances = uniqueInstances.map((instance) => ({
      instance,
      score: this.calculateRelevanceScore(text, instance, keywords),
    }));

    scoredInstances.sort((a, b) => b.score - a.score);

    // 5. 返回得分最高的结果
    return scoredInstances
      .filter((item) => item.score > 0.3) // 只返回相关性>30%的结果
      .slice(0, 5) // 最多返回5个结果
      .map((item) => item.instance);
  }

  /**
   * 提取文本中的关键词（简单实现）
   * TODO: 可以集成更好的分词工具（如jieba）
   */
  private extractKeywords(text: string): string[] {
    // 移除标点符号和特殊字符
    const cleanText = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ');

    // 简单分词（按空格和常见标点）
    const words = cleanText.split(/\s+/).filter((word) => word.length > 1);

    // 去重
    return Array.from(new Set(words));
  }

  /**
   * 去重知识点实例
   */
  private deduplicateInstances(instances: EduKGInstance[]): EduKGInstance[] {
    const seen = new Set<string>();
    return instances.filter((instance) => {
      if (seen.has(instance.uri)) {
        return false;
      }
      seen.add(instance.uri);
      return true;
    });
  }

  /**
   * 计算文本与知识点实例的相关性得分
   */
  private calculateRelevanceScore(
    text: string,
    instance: EduKGInstance,
    keywords: string[]
  ): number {
    let score = 0;

    // 1. 精确匹配（知识点名称出现在文本中）
    if (text.includes(instance.label)) {
      score += 0.8;
    }

    // 2. 关键词匹配
    const matchedKeywords = keywords.filter((keyword) =>
      instance.label.includes(keyword) ||
      (instance.aliases && instance.aliases.some((alias) => alias.includes(keyword)))
    );
    score += (matchedKeywords.length / keywords.length) * 0.5;

    // 3. 描述匹配（如果有描述）
    if (instance.description) {
      const descMatch = keywords.filter((keyword) =>
        instance.description!.includes(keyword)
      ).length;
      score += (descMatch / keywords.length) * 0.3;
    }

    return Math.min(score, 1.0); // 最高得分为1.0
  }
}

// 单例模式
let edukgService: EduKGService | null = null;

export function getEduKGService(): EduKGService {
  if (!edukgService) {
    edukgService = new EduKGService();
  }
  return edukgService;
}

export type { EduKGInstance, EduKGRelation };
