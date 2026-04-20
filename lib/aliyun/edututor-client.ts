/**
 * 阿里云EduTutor - CutQuestions API客户端（调试认证）
 *
 * 尝试多种认证方式
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('AliyunEduTutor');

// 测试不同的认证方式
export async function testAuthentication(imageUrl: string) {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  const workspaceId = process.env.ALIYUN_WORKSPACE_ID;

  log.info('开始测试阿里云API认证', {
    accessKeyId,
    workspaceId,
    imageUrl
  });

  // 方式1: 直接使用Access Key ID作为Bearer token
  log.info('测试方式1: Access Key ID作为Bearer token');
  try {
    const response1 = await fetch(
      `https://edututor-cn-beijing.aliyuncs.com/service/cutApi?workspaceId=${workspaceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessKeyId}`,
          'X-DashScope-DataInspection': 'enable'
        },
        body: JSON.stringify({
          image: imageUrl,
          parameters: {
            struct: true,
            extract_images: true
          }
        })
      }
    );

    const result1 = await response1.json();
    log.info('方式1结果', {
      status: response1.status,
      success: result1.success,
      code: result1.code,
      message: result1.message
    });

    if (response1.ok && result1.success) {
      log.info('✅ 方式1成功！Access Key ID可以直接用作Bearer token');
      return result1;
    }
  } catch (error) {
    log.error('方式1失败', { error });
  }

  // 方式2: 使用完整的Access Key (ID:Secret格式)
  log.info('测试方式2: Access Key ID:Secret格式');
  try {
    const response2 = await fetch(
      `https://edututor-cn-beijing.aliyuncs.com/service/cutApi?workspaceId=${workspaceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessKeyId}:${accessKeySecret}`,
          'X-DashScope-DataInspection': 'enable'
        },
        body: JSON.stringify({
          image: imageUrl,
          parameters: {
            struct: true,
            extract_images: true
          }
        })
      }
    );

    const result2 = await response2.json();
    log.info('方式2结果', {
      status: response2.status,
      success: result2.success,
      code: result2.code,
      message: result2.message
    });

    if (response2.ok && result2.success) {
      log.info('✅ 方式2成功！Access Key ID:Secret格式有效');
      return result2;
    }
  } catch (error) {
    log.error('方式2失败', { error });
  }

  // 方式3: 不使用Bearer，直接使用Access Key ID
  log.info('测试方式3: 直接使用Access Key ID（无Bearer）');
  try {
    const response3 = await fetch(
      `https://edututor-cn-beijing.aliyuncs.com/service/cutApi?workspaceId=${workspaceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-acs-access-key-id': accessKeyId,
          'x-acs-access-key-secret': accessKeySecret,
          'X-DashScope-DataInspection': 'enable'
        },
        body: JSON.stringify({
          image: imageUrl,
          parameters: {
            struct: true,
            extract_images: true
          }
        })
      }
    );

    const result3 = await response3.json();
    log.info('方式3结果', {
      status: response3.status,
      success: result3.success,
      code: result3.code,
      message: result3.message
    });

    if (response3.ok && result3.success) {
      log.info('✅ 方式3成功！直接使用Access Key headers有效');
      return result3;
    }
  } catch (error) {
    log.error('方式3失败', { error });
  }

  throw new Error('所有认证方式都失败了');
}
