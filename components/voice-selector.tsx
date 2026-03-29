'use client';

import { useState, useEffect } from 'react';
import { Trash2, Check, Plus, Mic } from 'lucide-react';

interface SavedVoice {
  id: string;
  voiceId: string;
  voiceName: string;
  description?: string;
  createdAt: string;
}

interface VoiceSelectorProps {
  selectedVoiceId?: string | null;
  onVoiceSelect: (voiceId: string | null) => void;
  onNewVoice?: () => void;
}

export default function VoiceSelector({
  selectedVoiceId,
  onVoiceSelect,
  onNewVoice,
}: VoiceSelectorProps) {
  const [voices, setVoices] = useState<SavedVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVoices();
  }, []);

  const loadVoices = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/voices');
      const data = await response.json();

      if (data.success) {
        setVoices(data.voices || []);
      }
    } catch (err) {
      setError('加载音色列表失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个音色吗？')) return;

    try {
      const response = await fetch(`/api/voices/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        // 如果删除的是当前选中的音色，清除选择
        if (voices.find(v => v.id === id)?.voiceId === selectedVoiceId) {
          onVoiceSelect(null);
        }
        await loadVoices();
      }
    } catch (err) {
      alert('删除失败');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="ml-2 text-sm text-gray-600">加载音色列表...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 错误提示 */}
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 新建音色按钮 */}
      {onNewVoice && (
        <button
          type="button"
          onClick={onNewVoice}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          克隆新音色
        </button>
      )}

      {/* 音色列表 */}
      {voices.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">
          还没有保存的音色。<br />点击上方按钮克隆您的第一个音色。
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {voices.map((voice) => (
            <div
              key={voice.id}
              className={`p-3 rounded-lg border-2 transition-colors ${
                selectedVoiceId === voice.voiceId
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <button
                  type="button"
                  onClick={() => onVoiceSelect(voice.voiceId)}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <span className="font-medium text-sm">{voice.voiceName}</span>
                    {selectedVoiceId === voice.voiceId && (
                      <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    )}
                  </div>
                  {voice.description && (
                    <p className="text-xs text-gray-600 mt-1">{voice.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(voice.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(voice.id)}
                  className="ml-2 p-1 text-gray-400 hover:text-red-600 transition-colors"
                  title="删除音色"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 清除选择 */}
      {selectedVoiceId && (
        <button
          type="button"
          onClick={() => onVoiceSelect(null)}
          className="w-full text-sm text-gray-600 hover:text-gray-800 underline"
        >
          清除选择（使用默认音色）
        </button>
      )}
    </div>
  );
}
