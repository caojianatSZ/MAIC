import { NextRequest, NextResponse } from 'next/server';

// 智谱AI OCR接口配置
const ZHIPU_OCR_URL = 'https://open.bigmodel.cn/api/paas/v4/files/ocr';
const ZHIPU_API_KEY = process.env.GLM_API_KEY;

/**
 * OCR图片识别接口
 * POST /api/ocr
 *
 * Request body (multipart/form-data):
 * - file: 图片文件 (PNG/JPG/JPEG/BMP, 最大8M)
 * - language_type?: 语言类型 (可选，默认 "CHN_ENG")
 * - probability?: 是否返回置信度 (可选，默认 false)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     task_id: string,
 *     message: string,
 *     status: string,
 *     words_result_num: number,
 *     words_result: Array<{
 *       location: { left: number, top: number, width: number, height: number },
 *       words: string,
 *       probability?: { average: number, variance: number, min: number }
 *     }>
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // 检查API密钥
    if (!ZHIPU_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OCR服务未配置，请联系管理员' },
        { status: 500 }
      );
    }

    // 解析表单数据
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const languageType = (formData.get('language_type') as string) || 'CHN_ENG';
    const probability = formData.get('probability') === 'true';

    // 验证文件
    if (!file) {
      return NextResponse.json(
        { success: false, error: '请上传图片文件' },
        { status: 400 }
      );
    }

    // 检查文件大小 (8MB限制)
    const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: '图片文件大小不能超过8MB' },
        { status: 400 }
      );
    }

    // 检查文件类型
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: '仅支持 PNG、JPG、JPEG、BMP 格式的图片' },
        { status: 400 }
      );
    }

    // 准备发送给智谱AI的数据
    const ocrFormData = new FormData();
    ocrFormData.append('file', file);
    ocrFormData.append('tool_type', 'hand_write');
    ocrFormData.append('language_type', languageType);
    ocrFormData.append('probability', String(probability));

    console.log('发送OCR请求到智谱AI:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      languageType,
      probability
    });

    // 调用智谱AI OCR接口
    const response = await fetch(ZHIPU_OCR_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ZHIPU_API_KEY}`,
      },
      body: ocrFormData,
    });

    // 检查响应状态
    if (!response.ok) {
      const errorText = await response.text();
      console.error('智谱AI OCR请求失败:', response.status, errorText);

      return NextResponse.json(
        {
          success: false,
          error: `OCR识别失败: ${response.status} ${response.statusText}`
        },
        { status: response.status }
      );
    }

    // 解析响应
    const result = await response.json();
    console.log('智谱AI OCR响应:', {
      taskId: result.task_id,
      status: result.status,
      wordsResultNum: result.words_result_num
    });

    // 检查OCR状态
    if (result.status !== 'succeeded') {
      return NextResponse.json(
        {
          success: false,
          error: result.message || 'OCR识别失败'
        },
        { status: 500 }
      );
    }

    // 提取识别的文本
    const recognizedText = result.words_result
      ?.map((item: any) => item.words)
      .filter((text: string) => text && text.trim())
      .join('\n') || '';

    // 返回结果
    return NextResponse.json({
      success: true,
      data: {
        task_id: result.task_id,
        message: result.message,
        status: result.status,
        words_result_num: result.words_result_num,
        words_result: result.words_result,
        text: recognizedText, // 提供纯文本版本，方便使用
      }
    });

  } catch (error) {
    console.error('OCR处理出错:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'OCR识别失败'
      },
      { status: 500 }
    );
  }
}

/**
 * GET请求说明
 */
export async function GET() {
  return NextResponse.json({
    message: 'OCR图片识别接口',
    method: 'POST',
    contentType: 'multipart/form-data',
    parameters: {
      file: '图片文件 (必需, PNG/JPG/JPEG/BMP, 最大8M)',
      language_type: '语言类型 (可选, 默认CHN_ENG, 支持AUTO/ENG/JAP/KOR等)',
      probability: '是否返回置信度 (可选, 默认false)'
    },
    example: {
      curl: `curl -X POST https://your-domain.com/api/ocr \\
  -F "file=@example.jpg" \\
  -F "language_type=CHN_ENG" \\
  -F "probability=true"`
    }
  });
}
