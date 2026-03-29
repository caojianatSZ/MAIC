'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ShareHeader } from '@/components/share-header';
import { Stage } from '@/components/stage';
import { useStageStore } from '@/lib/store';
import { createLogger } from '@/lib/logger';
import { BrandingThemeProvider } from '@/lib/branding/theme-provider';
// import { ConversionCard } from '@/components/conversion-card';

const log = createLogger('SharePage');

interface Organization {
  id: string;
  name: string;
  logoData: string;
  logoMimeType: string;
  phone?: string;
}

export default function SharePage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [classroomNotFound, setClassroomNotFound] = useState(false);

  const { loadFromStorage } = useStageStore();

  useEffect(() => {
    async function loadSharePage() {
      try {
        const res = await fetch(`/api/organization-classrooms/${token}`);
        if (!res.ok) {
          throw new Error('课程不存在');
        }

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.message || '加载失败');
        }

        const { classroom, organization: orgData, classroomNotFound: notFound } = json;
        setOrganization(orgData);

        // 如果 classroom 不存在，显示提示信息
        if (notFound || !classroom) {
          setClassroomNotFound(true);
          setLoading(false);
          return;
        }

        // Load classroom data into store
        await loadFromStorage(classroom.id);

        // If IndexedDB had no data, try server-side storage
        if (!useStageStore.getState().stage) {
          log.info('No IndexedDB data, loading from server for:', classroom.id);
          const { stage, scenes } = classroom;
          useStageStore.getState().setStage(stage);
          useStageStore.setState({
            scenes,
            currentSceneId: scenes[0]?.id ?? null,
          });
        }
      } catch (err) {
        log.error('Failed to load share page:', err);
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    }

    loadSharePage();
  }, [token, loadFromStorage]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>加载中...</p>
      </div>
    );
  }

  if (classroomNotFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">课程数据不可用</h2>
          <p className="text-gray-600 mb-6">
            该分享链接的课程内容已过期或被删除。
          </p>
          <p className="text-sm text-gray-500">
            请联系 <span className="font-semibold">{organization?.name || '机构'}</span> 获取新的分享链接
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!organization) {
    return null;
  }

  return (
    <BrandingThemeProvider organizationId={organization.id}>
      <div className="h-screen flex flex-col overflow-hidden">
        <ShareHeader organization={organization} />
        <div className="flex-1 overflow-hidden">
          <Stage shareToken={token} />
        </div>

        {/* Conversion card will be added in Task 14 */}
        {/* <ConversionCard
          organizationId={organization.id}
          classroomId={classroomId}
          shareToken={token}
        /> */}
      </div>
    </BrandingThemeProvider>
  );
}
