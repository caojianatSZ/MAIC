/**
 * EduKG适配器
 * 连接EduKG基础教育知识图谱服务平台
 *
 * API 文档：https://edukg.cn/docs
 * 请求格式：application/x-www-form-urlencoded; charset=UTF-8
 * 认证方式：登录获取 id，将 id 作为请求参数
 */

interface EduKGConfig {
  baseUrl?: string;
  timeout?: number;
  phone?: string;
  password?: string;
  ignoreSSL?: boolean;  // 是否忽略 SSL 证书错误（仅开发环境）
}

interface EduKGSession {
  id: string;  // 登录状态码
  expireTime: number;
}

/**
 * 自定义 fetch 函数，支持忽略 SSL 证书错误
 * 注意：仅在开发环境中使用，生产环境不建议禁用 SSL 验证
 */
async function fetchWithIgnoreSSL(
  url: string,
  options: RequestInit & { ignoreSSL?: boolean }
): Promise<Response> {
  const { ignoreSSL, ...fetchOptions } = options;

  if (ignoreSSL && process.env.NODE_ENV !== 'production') {
    // 临时设置环境变量以禁用 SSL 验证
    const originalReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    try {
      const response = await fetch(url, fetchOptions);
      return response;
    } finally {
      // 恢复原始设置
      if (originalReject !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalReject;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }
    }
  }

  // 正常的 fetch 请求
  return fetch(url, fetchOptions);
}

interface EduKGNode {
  uri: string;
  label: string;
  comment?: string;
  level?: string;
}

interface EduKGRelation {
  domain: string;
  range: string;
  relationType: string;
}

interface EduKGResponse {
  knowledge?: EduKGNode[];
  relations?: EduKGRelation[];
}

interface KnowledgeGraph {
  subject: string;
  topic: string;
  source: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: GraphMetadata;
}

export interface GraphNode {
  id: string;
  name: string;
  level: number;
  description: string;
  difficulty: number;
  prerequisites: string[];
}

interface GraphEdge {
  from: string;
  to: string;
  type: string;
  label?: string;
}

interface GraphMetadata {
  totalNodes: number;
  totalEdges: number;
  maxLevel: number;
  eduKGUrl: string;
  lastUpdated: string;
}

/**
 * EduKG适配器类
 */
export class EduKGAdapter {
  private config: EduKGConfig;
  private session: EduKGSession | null = null;

  constructor(config: EduKGConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || process.env.EDUKG_BASE_URL || 'https://edukg.cn/openapi/graph',
      timeout: config.timeout || 10000,
      phone: config.phone || process.env.EDUKG_PHONE || '',
      password: config.password || process.env.EDUKG_PASSWORD || '',
      ignoreSSL: config.ignoreSSL ?? (process.env.NODE_ENV !== 'production'),  // 默认开发环境忽略 SSL
    };
  }

  /**
   * 登录 EduKG 获取会话 ID
   */
  private async login(): Promise<string> {
    try {
      console.log('[EduKG] 开始登录认证...');

      // 检查是否配置了认证信息
      if (!this.config.phone || !this.config.password) {
        console.warn('[EduKG] 未配置 phone 和 password，使用 Mock 模式');
        return 'mock_id';
      }

      // 构建登录请求参数
      const params = new URLSearchParams();
      params.append('phone', this.config.phone);
      params.append('password', this.config.password);

      // EduKG 登录接口（正确的接口地址）
      const loginUrl = 'https://edukg.cn/openapi/user/login';

      const timeout = this.config.timeout || 10000;

      console.log(`[EduKG] 登录URL: ${loginUrl}`);
      console.log(`[EduKG] 手机号: ${this.config.phone}`);
      console.log(`[EduKG] 忽略SSL: ${this.config.ignoreSSL ? '是（开发环境）' : '否'}`);

      // POST 请求，参数在 body 中
      const response = await fetchWithIgnoreSSL(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: params.toString(),
        signal: AbortSignal.timeout(timeout),
        ignoreSSL: this.config.ignoreSSL,
      });

      if (!response.ok) {
        throw new Error(`登录失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[EduKG] 登录响应:', JSON.stringify(data, null, 2));

      // 根据官方文档，响应格式为：
      // {
      //   "code": "0",
      //   "data": "登录成功",
      //   "msg": "成功",
      //   "id": ""  // 登录状态码
      // }
      const sessionId = data.id;

      if (!sessionId) {
        console.error('[EduKG] 登录响应格式:', data);
        throw new Error('登录响应中未找到 id（登录状态码）');
      }

      // 检查响应状态码
      if (data.code !== '0') {
        throw new Error(`登录失败: ${data.msg || data.data || '未知错误'}`);
      }

      // 缓存会话（假设有效期24小时）
      this.session = {
        id: sessionId,
        expireTime: Date.now() + 23 * 60 * 60 * 1000, // 提前1小时过期
      };

      console.log('[EduKG] 登录成功，会话ID已缓存:', sessionId);
      return sessionId;
    } catch (error) {
      console.error('[EduKG] 登录失败:', error);
      throw new Error(`EduKG认证失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 获取有效的会话 ID
   */
  private async getSessionId(): Promise<string> {
    // 如果没有配置认证信息，返回 mock id
    if (!this.config.phone || !this.config.password) {
      return 'mock_id';
    }

    // 检查缓存的会话是否有效
    if (this.session && this.session.expireTime > Date.now()) {
      return this.session.id;
    }

    // 会话过期或不存在，重新登录
    return await this.login();
  }

  /**
   * 获取知识图谱
   * @param subject 学科（如"数学"、"英语"）
   * @param topic 主题（如"二次函数"）
   */
  async getKnowledgeGraph(subject: string, topic: string): Promise<KnowledgeGraph> {
    try {
      console.log(`[EduKG] 获取知识图谱: ${subject} - ${topic}`);

      // 检查是否配置了认证信息
      const hasAuth = this.config.phone && this.config.password;

      if (!hasAuth) {
        console.log('[EduKG] 未配置认证信息，使用 Mock 数据');
        const mockData = this.getMockKnowledgeGraph(subject, topic);
        console.log(`[EduKG] Mock数据: ${mockData.nodes.length} 个节点`);
        return mockData;
      }

      try {
        // 调用真实的 EduKG API
        const sessionId = await this.getSessionId();

        if (sessionId === 'mock_id') {
          console.log('[EduKG] 使用 Mock 模式');
          const mockData = this.getMockKnowledgeGraph(subject, topic);
          return mockData;
        }

        // 使用实体搜索接口搜索知识点
        // POST https://edukg.cn/openapi/common/totalSearch
        const searchUrl = 'https://edukg.cn/openapi/common/totalSearch';

        // 构建搜索词（优先使用主题，如果主题太长则使用关键词）
        let searchText = topic || subject;
        if (searchText.length > 10) {
          // 如果主题太长，尝试提取关键词
          searchText = topic.split(/[，、和与及]/)[0]; // 取第一个词
        }

        // 构建请求参数
        const params = new URLSearchParams();
        params.append('searchText', searchText);
        params.append('id', sessionId);  // 登录状态码

        const timeout = this.config.timeout || 10000;

        console.log(`[EduKG] 搜索URL: ${searchUrl}`);
        console.log(`[EduKG] 搜索词: ${searchText}`);
        console.log(`[EduKG] 会话ID: ${sessionId}`);

        const response = await fetchWithIgnoreSSL(searchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          },
          body: params.toString(),
          signal: AbortSignal.timeout(timeout),
          ignoreSSL: this.config.ignoreSSL,
        });

        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('[EduKG] API响应:', JSON.stringify(data, null, 2));

        // 解析搜索结果并构建知识图谱
        const kg = await this.buildKnowledgeGraphFromSearch(data, subject, topic);

        console.log(`[EduKG] 成功构建知识图谱: ${kg.nodes.length} 个节点, ${kg.edges.length} 条边`);
        return kg;
      } catch (apiError) {
        console.warn('[EduKG] API调用失败，回退到Mock数据:', apiError);
        const mockData = this.getMockKnowledgeGraph(subject, topic);
        console.log(`[EduKG] Mock数据: ${mockData.nodes.length} 个节点`);
        return mockData;
      }
    } catch (error) {
      console.error('[EduKG] 获取知识图谱失败:', error);
      throw new Error(`获取知识图谱失败: ${error}`);
    }
  }

  /**
   * 从搜索结果构建知识图谱
   */
  private async buildKnowledgeGraphFromSearch(
    searchData: any,
    subject: string,
    topic: string
  ): Promise<KnowledgeGraph> {
    console.log('[EduKG] 开始构建知识图谱...');

    // 检查响应状态（code 可能是字符串 "0" 或数字 0）
    if (searchData.code !== '0' && searchData.code !== 0) {
      throw new Error(`搜索失败: ${searchData.msg || searchData.message || '未知错误'}`);
    }

    // 响应格式：data 对象直接包含 instanceInfo, instanceList 等
    const data = searchData.data;
    if (!data) {
      throw new Error('响应数据格式错误：缺少 data 字段');
    }

    console.log('[EduKG] 搜索响应结构:', {
      hasInstanceInfo: !!data.instanceInfo,
      hasInstanceList: !!data.instanceList && data.instanceList.length > 0,
      instanceListLength: data.instanceList?.length || 0,
    });

    // 构建节点列表
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeMap = new Map<string, GraphNode>();

    // 处理主实体
    if (data.instanceInfo && typeof data.instanceInfo === 'object') {
      // 如果 instanceInfo 是对象（而非数组）
      const instanceInfo = Array.isArray(data.instanceInfo) ? data.instanceInfo[0] : data.instanceInfo;

      if (instanceInfo && instanceInfo.uri && instanceInfo.name) {
        const node: GraphNode = {
          id: instanceInfo.uri,
          name: instanceInfo.name,
          level: 0,
          description: instanceInfo.abstractMessage || '',
          difficulty: 1,
          prerequisites: [],
        };

        nodes.push(node);
        nodeMap.set(instanceInfo.uri, node);

        // 提取关系
        if (instanceInfo.relation && Array.isArray(instanceInfo.relation)) {
          for (const rel of instanceInfo.relation) {
            if (rel.subjectUrl && rel.objectUrl) {
              edges.push({
                from: rel.subjectUrl,
                to: rel.objectUrl,
                type: rel.predicate,
                label: rel.predicateName,
              });

              // 如果是前置关系，添加到 prerequisites
              if (rel.predicateName?.includes('前置') || rel.predicateName?.includes('依赖')) {
                if (node.prerequisites.indexOf(rel.objectUrl) === -1) {
                  node.prerequisites.push(rel.objectUrl);
                }
              }
            }
          }
        }

        // 获取实体详情以获取更多关系
        try {
          console.log(`[EduKG] 获取主实体详情: ${instanceInfo.uri}`);
          const detail = await this.getInstanceDetail(instanceInfo.uri);

          if (detail && detail.relation) {
            console.log(`[EduKG] 实体详情包含 ${detail.relation.length} 个关系`);
            // 处理详情中的关系
            for (const rel of detail.relation) {
              if (rel.subjectUrl && rel.objectUrl) {
                // 避免重复添加边
                const edgeExists = edges.some(e =>
                  e.from === rel.subjectUrl && e.to === rel.objectUrl
                );

                if (!edgeExists) {
                  edges.push({
                    from: rel.subjectUrl,
                    to: rel.objectUrl,
                    type: rel.predicate,
                    label: rel.predicateName || this.getRelationLabel(rel.predicate),
                  });
                }

                // 如果是前置关系
                if (rel.predicateName?.includes('前置') ||
                    rel.predicateName?.includes('依赖') ||
                    rel.predicate?.includes('prerequisite')) {
                  if (node.prerequisites.indexOf(rel.objectUrl) === -1) {
                    node.prerequisites.push(rel.objectUrl);
                  }
                }

                // 如果目标节点不存在，创建一个占位节点
                if (!nodeMap.has(rel.objectUrl)) {
                  const objectNode: GraphNode = {
                    id: rel.objectUrl,
                    name: rel.object || rel.objectUrl.split('/').pop() || '未知实体',
                    level: 1,
                    description: '',
                    difficulty: 1,
                    prerequisites: [],
                  };
                  nodes.push(objectNode);
                  nodeMap.set(rel.objectUrl, objectNode);
                }
              }
            }
          }
        } catch (error) {
          console.warn('[EduKG] 获取实体详情失败，跳过:', error);
        }
      }
    }

    // 处理相关实体列表
    if (data.instanceList && Array.isArray(data.instanceList)) {
      console.log(`[EduKG] 处理 ${data.instanceList.length} 个相关实体`);
      const processedUris = new Set<string>();

      for (const related of data.instanceList) {
        if (!related.uri || !related.name) continue;

        if (!nodeMap.has(related.uri)) {
          const relatedNode: GraphNode = {
            id: related.uri,
            name: related.name,
            level: 1,
            description: related.abstractMessage || related.abstractMsg || '',
            difficulty: 1,
            prerequisites: [],
          };
          nodes.push(relatedNode);
          nodeMap.set(related.uri, relatedNode);
        }

        // 添加关联边（从主实体到相关实体）
        if (data.instanceInfo && typeof data.instanceInfo === 'object') {
          const mainUri = Array.isArray(data.instanceInfo)
            ? data.instanceInfo[0]?.uri
            : data.instanceInfo?.uri;

          if (mainUri && mainUri !== related.uri) {
            const edgeExists = edges.some(e => e.from === mainUri && e.to === related.uri);
            if (!edgeExists) {
              edges.push({
                from: mainUri,
                to: related.uri,
                type: 'related',
                label: '相关知识',
              });
            }
          }
        }

        processedUris.add(related.uri);
      }

      // 对前几个相关实体获取详情（限制数量以避免过多请求）
      const detailLimit = Math.min(data.instanceList.length, 5);
      for (let i = 0; i < detailLimit; i++) {
        const related = data.instanceList[i];
        if (!related.uri) continue;

        try {
          console.log(`[EduKG] 获取相关实体详情 (${i + 1}/${detailLimit}): ${related.uri}`);
          const detail = await this.getInstanceDetail(related.uri);

          if (detail && detail.relation) {
            for (const rel of detail.relation) {
              if (rel.subjectUrl && rel.objectUrl) {
                // 添加边
                const edgeExists = edges.some(e =>
                  e.from === rel.subjectUrl && e.to === rel.objectUrl
                );

                if (!edgeExists) {
                  edges.push({
                    from: rel.subjectUrl,
                    to: rel.objectUrl,
                    type: rel.predicate,
                    label: rel.predicateName || this.getRelationLabel(rel.predicate),
                  });
                }

                // 如果目标节点不存在，创建一个占位节点
                if (!nodeMap.has(rel.objectUrl)) {
                  const objectNode: GraphNode = {
                    id: rel.objectUrl,
                    name: rel.object || rel.objectUrl.split('/').pop() || '未知实体',
                    level: 2,
                    description: '',
                    difficulty: 1,
                    prerequisites: [],
                  };
                  nodes.push(objectNode);
                  nodeMap.set(rel.objectUrl, objectNode);
                }

                // 更新前置依赖
                const subjectNode = nodeMap.get(rel.subjectUrl);
                if (subjectNode && (rel.predicateName?.includes('前置') ||
                    rel.predicateName?.includes('依赖') ||
                    rel.predicate?.includes('prerequisite'))) {
                  if (subjectNode.prerequisites.indexOf(rel.objectUrl) === -1) {
                    subjectNode.prerequisites.push(rel.objectUrl);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.warn(`[EduKG] 获取相关实体详情失败: ${related.uri}`, error);
        }
      }
    }

    // 如果没有找到任何节点，返回空图谱
    if (nodes.length === 0) {
      console.warn('[EduKG] 搜索未返回任何实体，可能需要调整搜索词');
    }

    // 计算节点等级（基于前置依赖）
    this.calculateNodeLevels(nodes, edges);

    // 构建元数据
    const metadata: GraphMetadata = {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      maxLevel: Math.max(...nodes.map(n => n.level), 0),
      eduKGUrl: 'https://edukg.cn',
      lastUpdated: new Date().toISOString(),
    };

    console.log(`[EduKG] 知识图谱构建完成: ${nodes.length} 个节点, ${edges.length} 条边`);

    return {
      subject,
      topic,
      source: 'EduKG基础教育知识图谱服务平台',
      nodes,
      edges,
      metadata,
    };
  }

  /**
   * 计算节点等级（基于拓扑排序）
   */
  private calculateNodeLevels(nodes: GraphNode[], edges: GraphEdge[]): void {
    // 构建邻接表
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const node of nodes) {
      adjacency.set(node.id, []);
      inDegree.set(node.id, 0);
    }

    for (const edge of edges) {
      if (edge.type === 'prerequisite' || edge.label?.includes('前置')) {
        adjacency.get(edge.from)?.push(edge.to);
        inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
      }
    }

    // 拓扑排序计算等级
    const levelMap = new Map<string, number>();
    const queue: string[] = [];

    // 找到所有入度为0的节点
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
        levelMap.set(nodeId, 0);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLevel = levelMap.get(current)!;

      const neighbors = adjacency.get(current) || [];
      for (const neighbor of neighbors) {
        const newLevel = currentLevel + 1;
        if (!levelMap.has(neighbor) || levelMap.get(neighbor)! < newLevel) {
          levelMap.set(neighbor, newLevel);
        }
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    // 更新节点等级
    for (const node of nodes) {
      node.level = levelMap.get(node.id) || 0;
    }
  }

  /**
   * 获取知识点详情
   * @param uri 知识点URI
   */
  async getKnowledgePointDetail(uri: string): Promise<any> {
    try {
      console.log(`[EduKG] 获取知识点详情: ${uri}`);

      // TODO: 实际调用EduKG API
      // const response = await fetch(`${this.config.baseUrl}/instance`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ uri }),
      //   signal: AbortSignal.timeout(this.config.timeout),
      // });
      // return await response.json();

      return {};
    } catch (error) {
      console.error('[EduKG] 获取知识点详情失败:', error);
      throw new Error(`获取知识点详情失败: ${error}`);
    }
  }

  /**
   * 搜索知识点
   * @param keyword 关键词
   * @param subject 学科
   */
  async searchKnowledgePoints(keyword: string, subject?: string): Promise<any[]> {
    try {
      console.log(`[EduKG] 搜索知识点: ${keyword} in ${subject || 'all'}`);

      const sessionId = await this.getSessionId();
      if (sessionId === 'mock_id') {
        // Mock 模式返回空
        return [];
      }

      // 使用实体搜索接口
      const searchUrl = 'https://edukg.cn/openapi/common/totalSearch';

      // 构建请求参数
      const params = new URLSearchParams();
      params.append('searchText', keyword);
      params.append('id', sessionId);

      const response = await fetchWithIgnoreSSL(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: params.toString(),
        signal: AbortSignal.timeout(this.config.timeout || 10000),
        ignoreSSL: this.config.ignoreSSL,
      });

      if (!response.ok) {
        console.warn(`[EduKG] 搜索失败: ${response.status}`);
        return [];
      }

      const data = await response.json();

      // 检查响应状态
      if (data.code !== '0' && data.code !== 0) {
        console.warn(`[EduKG] 搜索返回错误: ${data.msg || data.message}`);
        return [];
      }

      // 提取知识点列表
      const results: any[] = [];
      const instanceList = data.data?.instanceList || [];

      for (const instance of instanceList) {
        results.push({
          id: instance.instanceId,
          uri: instance.instanceUri,
          label: instance.instanceLabel || instance.instanceName,
          name: instance.instanceName,
          type: instance.instanceType,
          category: instance.category
        });
      }

      // 同时包含主实体
      if (data.data?.instanceInfo) {
        const mainInfo = Array.isArray(data.data.instanceInfo)
          ? data.data.instanceInfo[0]
          : data.data.instanceInfo;
        if (mainInfo) {
          results.unshift({
            id: mainInfo.instanceId,
            uri: mainInfo.instanceUri,
            label: mainInfo.instanceLabel || mainInfo.instanceName,
            name: mainInfo.instanceName,
            type: mainInfo.instanceType,
            category: mainInfo.category
          });
        }
      }

      console.log(`[EduKG] 搜索到 ${results.length} 个知识点`);
      return results;

    } catch (error) {
      console.error('[EduKG] 搜索知识点失败:', error);
      return [];
    }
  }

  /**
   * 转换EduKG数据为内部格式
   */
  private adaptEduKGToInternal(
    edukgData: EduKGResponse,
    subject: string,
    topic: string
  ): KnowledgeGraph {
    const nodes: GraphNode[] = (edukgData.knowledge || []).map((kp, index) => ({
      id: kp.uri,
      name: kp.label,
      level: this.parseLevel(kp.level || '1'),
      description: kp.comment || '',
      difficulty: index + 1, // 临时难度，后续可以优化
      prerequisites: [], // 从relations中提取
    }));

    const edges: GraphEdge[] = (edukgData.relations || []).map(rel => ({
      from: rel.domain,
      to: rel.range,
      type: rel.relationType,
      label: this.getRelationLabel(rel.relationType),
    }));

    // 提取前置依赖
    edges.forEach(edge => {
      if (edge.type === 'prerequisite') {
        const targetNode = nodes.find(n => n.id === edge.to);
        if (targetNode && !targetNode.prerequisites.includes(edge.from)) {
          targetNode.prerequisites.push(edge.from);
        }
      }
    });

    const metadata: GraphMetadata = {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      maxLevel: Math.max(...nodes.map(n => n.level), 0),
      eduKGUrl: 'https://edukg.cn',
      lastUpdated: new Date().toISOString(),
    };

    return {
      subject,
      topic,
      source: 'EduKG基础教育知识图谱服务平台',
      nodes,
      edges,
      metadata,
    };
  }

  /**
   * 解析难度等级
   */
  private parseLevel(levelStr: string): number {
    const levelMap: Record<string, number> = {
      '1': 0,
      '2': 1,
      '3': 2,
      '4': 3,
      '5': 4,
      '初级': 0,
      '中级': 2,
      '高级': 4,
    };
    return levelMap[levelStr] || 0;
  }

  /**
   * 知识链接接口 - 识别文本中的知识点
   * @param text 输入文本（题目内容）
   * @returns 识别到的知识点列表
   *
   * API 文档：POST /openapi/graph/instanceLinking
   * 输入：searchText（文本）
   * 输出：实体列表，包含 uri, name, classList, where（位置）
   */
  async extractKnowledgePointsFromText(text: string): Promise<{
    uri: string;
    name: string;
    classList: Array<{ id: string; label: string }>;
    abstractMessage?: string;
    where?: number[][];
  }[]> {
    try {
      console.log('[EduKG] 知识链接接口 - 识别文本中的知识点');

      const sessionId = await this.getSessionId();
      if (sessionId === 'mock_id') {
        console.log('[EduKG] Mock 模式，返回空');
        return [];
      }

      // 构建请求参数
      const params = new URLSearchParams();
      params.append('searchText', text);
      params.append('id', sessionId);

      // 知识链接接口
      const linkingUrl = 'https://edukg.cn/openapi/graph/instanceLinking';

      const timeout = this.config.timeout || 10000;

      console.log(`[EduKG] 调用知识链接接口，文本长度: ${text.length}`);

      const response = await fetchWithIgnoreSSL(linkingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: params.toString(),
        signal: AbortSignal.timeout(timeout),
        ignoreSSL: this.config.ignoreSSL,
      });

      if (!response.ok) {
        throw new Error(`知识链接接口失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[EduKG] 知识链接响应:', JSON.stringify(data, null, 2));

      // 检查响应状态
      if (data.code !== '0' && data.code !== 0) {
        throw new Error(`知识链接失败: ${data.msg || data.message || '未知错误'}`);
      }

      // 解析知识点列表
      const knowledgePoints = data.data || [];
      console.log(`[EduKG] 识别到 ${knowledgePoints.length} 个知识点`);

      return knowledgePoints;
    } catch (error) {
      console.error('[EduKG] 知识链接接口调用失败:', error);
      return [];
    }
  }

  /**
   * 获取实体详情（包括关系和属性）
   * @param uri 实体URI
   */
  async getInstanceDetail(uri: string): Promise<any> {
    try {
      const sessionId = await this.getSessionId();
      if (sessionId === 'mock_id') {
        return null;
      }

      // 构建请求参数
      const params = new URLSearchParams();
      params.append('uri', uri);
      params.append('id', sessionId);

      // 实体详情接口
      const detailUrl = 'https://edukg.cn/openapi/graph/getInstanceInfo';

      const timeout = this.config.timeout || 10000;

      console.log(`[EduKG] 获取实体详情: ${uri}`);

      const response = await fetchWithIgnoreSSL(`${detailUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        signal: AbortSignal.timeout(timeout),
        ignoreSSL: this.config.ignoreSSL,
      });

      if (!response.ok) {
        throw new Error(`获取实体详情失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[EduKG] 实体详情响应:`, JSON.stringify(data, null, 2));

      // 检查响应状态
      if (data.code !== '0' && data.code !== 0) {
        throw new Error(`获取实体详情失败: ${data.msg || data.message || '未知错误'}`);
      }

      return data.data;
    } catch (error) {
      console.error('[EduKG] 获取实体详情失败:', error);
      return null;
    }
  }

  /**
   * 获取习题
   * @param searchText 搜索关键词（知识点名称）
   * @param options 选项
   */
  async getQuestions(
    searchText: string,
    options: {
      type?: string;  // 题目类型
      pageNo?: number;
      pageSize?: number;
    } = {}
  ): Promise<any[]> {
    try {
      const { type = '选择题', pageNo = 1, pageSize = 10 } = options;

      // 检查是否配置了认证信息
      if (!this.config.phone || !this.config.password) {
        console.warn('[EduKG] 未配置认证信息，无法获取真实习题');
        return [];
      }

      const sessionId = await this.getSessionId();
      if (sessionId === 'mock_id') {
        return [];
      }

      // 构建请求参数
      const params = new URLSearchParams();
      params.append('searchText', searchText);
      params.append('type', type);
      params.append('pageNo', pageNo.toString());
      params.append('pageSize', pageSize.toString());
      params.append('id', sessionId);

      // 习题接口
      const questionUrl = 'https://edukg.cn/openapi/resource/findQuestion';

      const timeout = this.config.timeout || 10000;

      console.log(`[EduKG] 获取习题: ${searchText}, 类型: ${type}`);

      const response = await fetchWithIgnoreSSL(`${questionUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        signal: AbortSignal.timeout(timeout),
        ignoreSSL: this.config.ignoreSSL,
      });

      if (!response.ok) {
        throw new Error(`获取习题失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[EduKG] 习题响应:', JSON.stringify(data, null, 2));

      // 检查响应状态
      if (data.code !== '0' && data.code !== 0) {
        throw new Error(`获取习题失败: ${data.msg || data.message || '未知错误'}`);
      }

      // 解析习题数据
      const questions = this.parseQuestionData(data.data);
      console.log(`[EduKG] 成功获取 ${questions.length} 道习题`);

      return questions;
    } catch (error) {
      console.error('[EduKG] 获取习题失败:', error);
      return [];
    }
  }

  /**
   * 解析习题数据
   */
  private parseQuestionData(data: any): any[] {
    const questions: any[] = [];

    if (!data) return questions;

    // 习题可能在 data.data 数组中
    const questionArray = data.data?.data || data.data || [];

    if (Array.isArray(questionArray)) {
      for (const item of questionArray) {
        const questionData = item.questionData || item;

        // 提取题目信息
        const question = {
          id: item.questionId || questionData.ID || `q_${Date.now()}_${Math.random()}`,
          question: item.questionInfo || questionData.Content || questionData.Questions?.[0]?.Question || '',
          type: questionData.QuestionType || '选择题',
          options: this.parseChoices(questionData.Questions?.[0]?.Choices || questionData.Choices || []),
          answer: questionData.Answer || '',
          analysis: questionData.Analysis || '',
          keyPoint: questionData.KeyPoint || [],
          subject: questionData.Subject || '',
          grade: questionData.Grade || '',
          source: questionData.SourceLink || '',
          knowledgePoint: '',  // 稍后填充
          difficulty: 1,  // 默认难度
        };

        if (question.question) {
          questions.push(question);
        }
      }
    }

    return questions;
  }

  /**
   * 解析选项
   */
  private parseChoices(choices: any): string[] {
    if (!choices) return [];

    if (Array.isArray(choices)) {
      return choices.map(c => {
        if (typeof c === 'string') return c;
        if (typeof c === 'object') return c.Content || c.text || c.option || JSON.stringify(c);
        return String(c);
      });
    }

    return [];
  }

  /**
   * 获取关系标签
   */
  private getRelationLabel(relationType: string): string {
    const labels: Record<string, string> = {
      'prerequisite': '前置知识',
      'related': '相关知识',
      'contains': '包含',
      'belongs_to': '属于',
    };
    return labels[relationType] || relationType;
  }

  /**
   * 获取Mock知识图谱（用于开发测试）
   */
  private getMockKnowledgeGraph(subject: string, topic: string): KnowledgeGraph {
    return {
      subject,
      topic,
      source: 'EduKG基础教育知识图谱服务平台',
      nodes: [
        {
          id: 'kf_001',
          name: '二次函数定义',
          level: 0,
          description: '形如y=ax²+bx+c（a≠0）的函数称为二次函数，其中a、b、c是常数，a≠0',
          difficulty: 1,
          prerequisites: [],
        },
        {
          id: 'kf_002',
          name: '二次函数图像',
          level: 1,
          description: '二次函数的图像是一条抛物线。当a>0时，开口向上；当a<0时，开口向下',
          difficulty: 2,
          prerequisites: ['kf_001'],
        },
        {
          id: 'kf_003',
          name: '配方法求顶点',
          level: 1,
          description: '通过配方法将二次函数化为顶点式y=a(x-h)²+k，其中(h,k)是顶点坐标',
          difficulty: 3,
          prerequisites: ['kf_001'],
        },
        {
          id: 'kf_004',
          name: '图像平移变换',
          level: 2,
          description: '二次函数图像的平移规律：左右平移改变x，上下平移改变常数项',
          difficulty: 3,
          prerequisites: ['kf_002'],
        },
        {
          id: 'kf_005',
          name: '实际应用题',
          level: 2,
          description: '利用二次函数解决实际生活中的最值问题，如面积最大、利润最大等',
          difficulty: 4,
          prerequisites: ['kf_002', 'kf_003'],
        },
      ],
      edges: [
        { from: 'kf_001', to: 'kf_002', type: 'prerequisite', label: '前置知识' },
        { from: 'kf_001', to: 'kf_003', type: 'prerequisite', label: '前置知识' },
        { from: 'kf_002', to: 'kf_004', type: 'prerequisite', label: '前置知识' },
        { from: 'kf_002', to: 'kf_005', type: 'prerequisite', label: '前置知识' },
        { from: 'kf_003', to: 'kf_005', type: 'prerequisite', label: '前置知识' },
      ],
      metadata: {
        totalNodes: 5,
        totalEdges: 5,
        maxLevel: 2,
        eduKGUrl: 'https://edukg.cn',
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

// 导出单例
export const edukgAdapter = new EduKGAdapter();
