'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Upload, Trash2, AlertCircle, Volume2, FileAudio, Save } from 'lucide-react';

interface VoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob, audioUrl: string) => void;
  onUploadComplete?: (voiceId: string, fileName: string) => void;
  maxDuration?: number;
  className?: string;
}

export default function VoiceRecorder({
  onRecordingComplete,
  onUploadComplete,
  maxDuration = 3,
  className = '',
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [useFileUpload, setUseFileUpload] = useState(false);
  const [useVoiceId, setUseVoiceId] = useState(false);
  const [voiceIdInput, setVoiceIdInput] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [showVoiceNameInput, setShowVoiceNameInput] = useState(false);
  const [voiceNameInput, setVoiceNameInput] = useState('');
  const [savingVoice, setSavingVoice] = useState(false);
  const [currentClonedVoiceId, setCurrentClonedVoiceId] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<'idle' | 'starting' | 'recording' | 'stopping'>('idle');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 当 audioUrl 更新时，更新音频元素的 src
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      console.log('设置音频 URL:', audioUrl);
      audioRef.current.src = audioUrl;
    } else if (!audioUrl && audioRef.current) {
      console.log('清空音频 URL');
      audioRef.current.src = '';
    }
  }, [audioUrl]);

  // 播放录音
  const playRecording = async () => {
    if (!audioRef.current || !audioUrl) {
      console.log('播放失败: audioRef 或 audioUrl 不存在', { audioRef: !!audioRef.current, audioUrl });
      return;
    }

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.volume = 1.0;
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('播放失败:', err);
      setError(`播放失败: ${err instanceof Error ? err.message : '未知错误'}`);
      setIsPlaying(false);
    }
  };

  // 音频播放结束
  const handleAudioEnded = () => {
    console.log('音频播放结束');
    setIsPlaying(false);
  };

  // 音频加载完成
  const handleAudioLoaded = () => {
    console.log('音频加载完成');
  };

  // 音频播放开始
  const handleAudioPlay = () => {
    console.log('音频开始播放');
    setIsPlaying(true);
  };

  // 音频暂停
  const handleAudioPause = () => {
    console.log('音频暂停');
    setIsPlaying(false);
  };

  // 音频错误
  const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    console.error('音频元素错误:', e);
    setError('音频加载失败');
  };

  // 删除录音
  const deleteRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.load();
    }

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setAudioUrl(null);
    setAudioBlob(null);
    setRecordingTime(0);
    setError(null);
    setUploadSuccess(false);
    setIsPlaying(false);
  };

  // 上传音频
  const uploadAudio = async () => {
    if (!audioBlob) return;

    setIsUploading(true);
    setError(null);

    try {
      const mimeType = audioBlob.type;
      let fileExt = 'webm';

      if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
        fileExt = 'm4a';
      } else if (mimeType.includes('ogg')) {
        fileExt = 'ogg';
      } else if (mimeType.includes('wav')) {
        fileExt = 'wav';
      } else if (mimeType.includes('webm')) {
        fileExt = 'webm';
      }

      console.log('准备上传文件:', {
        name: `voice-sample.${fileExt}`,
        type: mimeType,
        size: audioBlob.size
      });

      const file = new File([audioBlob], `voice-sample.${fileExt}`, { type: mimeType });

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/audio', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '上传失败');
      }

      const data = await response.json();

      if (data.success) {
        // 上传成功，现在调用克隆API
        await cloneVoice(data.fileId);
      } else {
        throw new Error('上传失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  // 克隆语音
  const cloneVoice = async (fileId: string) => {
    setIsCloning(true);
    setError(null);

    try {
      console.log('=== 开始语音克隆 ===');
      console.log('File ID:', fileId);
      console.log('File ID 长度:', fileId.length);
      console.log('File ID 前10个字符:', fileId.substring(0, 10));

      const response = await fetch('/api/voice/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });

      console.log('克隆响应状态:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('克隆失败，错误详情:', errorData);

        // 调用调试端点获取更多信息
        console.log('=== 调用调试端点 ===');
        const debugResponse = await fetch('/api/debug/test-voice-clone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId }),
        });
        const debugData = await debugResponse.json();
        console.log('调试信息:', debugData);

        throw new Error(errorData.error || '语音克隆失败');
      }

      const data = await response.json();

      if (data.success) {
        const voiceId = data.voiceId;

        // 显示名称输入框
        setShowVoiceNameInput(true);
        setCurrentClonedVoiceId(voiceId);
        console.log('语音克隆成功，请输入音色名称:', voiceId);
      } else {
        throw new Error('语音克隆失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '语音克隆失败');
    } finally {
      setIsCloning(false);
    }
  };

  // 直接使用 voice_id
  const useProvidedVoiceId = async () => {
    const voiceId = voiceIdInput.trim();

    if (!voiceId) {
      setError('请输入 voice_id');
      return;
    }

    if (!voiceId.startsWith('voice-')) {
      setError('voice_id 格式不正确，应该以 "voice-" 开头');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // 直接使用提供的 voice_id
      setUploadSuccess(true);
      onUploadComplete?.(voiceId, '');
      console.log('使用提供的 voice_id:', voiceId);
    } finally {
      setIsUploading(false);
    }
  };

  // 下载音频测试
  const downloadAudio = () => {
    if (!audioBlob || !audioUrl) return;

    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `voice-test-${Date.now()}.${audioBlob.type.includes('mp4') ? 'm4a' : 'webm'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    console.log('音频已下载，请用播放器测试是否能播放');
  };

  // 保存音色到数据库
  const saveVoice = async () => {
    const voiceName = voiceNameInput.trim();

    if (!voiceName) {
      setError('请输入音色名称');
      return;
    }

    if (!currentClonedVoiceId) {
      setError('音色ID不存在，请重新克隆');
      return;
    }

    setSavingVoice(true);
    setError(null);

    try {
      // 先检查名称是否重复
      const checkResponse = await fetch('/api/voices');
      const checkData = await checkResponse.json();

      if (checkData.success && checkData.voices) {
        const existing = checkData.voices.find((v: any) => v.voiceName === voiceName);
        if (existing) {
          setError(`音色名称"${voiceName}"已存在，请使用其他名称`);
          setSavingVoice(false);
          return;
        }
      }

      // 保存音色
      const saveResponse = await fetch('/api/voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: currentClonedVoiceId,
          voiceName: voiceName,
          description: `克隆于 ${new Date().toLocaleDateString('zh-CN')}`,
        }),
      });

      const saveData = await saveResponse.json();

      if (saveData.success) {
        setUploadSuccess(true);
        setShowVoiceNameInput(false);
        setVoiceNameInput('');
        onUploadComplete?.(currentClonedVoiceId, '');
        console.log('音色保存成功:', saveData.voice);
      } else {
        throw new Error('保存音色失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存音色失败');
    } finally {
      setSavingVoice(false);
    }
  };

  // 处理文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件扩展名，GLM只支持 .mp3 和 .wav
    const fileName = file.name.toLowerCase();
    const allowedExtensions = ['.mp3', '.wav'];
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!hasValidExtension) {
      setError(`GLM只支持 MP3 和 WAV 格式。请上传 .mp3 或 .wav 文件。`);
      return;
    }

    if (!file.type.startsWith('audio/')) {
      setError('请选择音频文件');
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('音频文件大小不能超过 10MB');
      return;
    }

    setError(null);

    const url = URL.createObjectURL(file);
    setAudioBlob(file);
    setAudioUrl(url);
    console.log('文件已选择:', {
      name: file.name,
      size: file.size,
      type: file.type
    });
  };

  // 开始录音
  const startRecording = async () => {
    setRecordingState('starting');
    setError(null);

    try {
      console.log('请求麦克风权限...');

      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          channelCount: 1
        }
      });

      console.log('麦克风权限已获得');

      // 保存流引用，用于后续停止
      streamRef.current = stream;

      // 检查支持的MIME类型
      let mimeType = 'audio/webm';
      const types = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg'
      ];

      for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          console.log('使用的MIME类型:', mimeType);
          break;
        }
      }

      // 创建MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      // 收集音频数据
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log('收到音频数据:', event.data.size, 'bytes');
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('录音已停止');
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });

        console.log('音频Blob创建完成:', {
          type: audioBlob.type,
          size: audioBlob.size
        });

        // 创建音频URL
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(audioUrl);
        setAudioBlob(audioBlob);
        setIsRecording(false);
        setRecordingState('idle');

        // 清理流
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      // 开始录音
      mediaRecorder.start();
      console.log('开始录音');
      setIsRecording(true);
      setRecordingState('recording');

      // 设置计时器
      let seconds = 0;
      setRecordingTime(seconds);

      timerRef.current = setInterval(() => {
        seconds++;
        setRecordingTime(seconds);

        // 达到最大时长自动停止
        if (seconds >= maxDuration) {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        }
      }, 1000);

    } catch (err) {
      console.error('录音失败:', err);
      setRecordingState('idle');
      setIsRecording(false);

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('无法访问麦克风，请允许浏览器访问麦克风权限');
        } else if (err.name === 'NotFoundError') {
          setError('未找到麦克风设备，请检查设备连接');
        } else if (err.name === 'NotReadableError') {
          setError('麦克风被其他应用占用，请关闭其他使用麦克风的应用');
        } else {
          setError(`录音失败: ${err.message}`);
        }
      } else {
        setError('录音失败，请尝试使用"上传文件"模式');
      }
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      setRecordingState('stopping');
      console.log('停止录音...');
      mediaRecorderRef.current.stop();

      // 清理计时器
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // 格式化时间显示
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 录音区域 */}
      <div className="flex flex-col items-center gap-4">
        {!audioUrl ? (
          <>
            {/* 模式切换按钮 */}
            {!isRecording && (
              <div className="flex flex-wrap justify-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setUseFileUpload(false)}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    !useFileUpload && !useVoiceId
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <Mic className="w-4 h-4 inline mr-1" />
                  录音
                </button>
                <button
                  type="button"
                  onClick={() => setUseFileUpload(true)}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    useFileUpload
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <FileAudio className="w-4 h-4 inline mr-1" />
                  上传文件
                </button>
                <button
                  type="button"
                  onClick={() => setUseVoiceId(true)}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    useVoiceId
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  🔗 输入 Voice ID
                </button>
              </div>
            )}

            {/* 文件上传模式 */}
            {useFileUpload ? (
              <div className="w-full">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.wav,audio/mpeg,audio/wav"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-colors"
                >
                  <FileAudio className="w-5 h-5" />
                  选择音频文件
                </button>
                <p className="text-xs text-gray-600 text-center mt-2">
                  ⚠️ 仅支持 MP3 和 WAV 格式，建议时长 3-5 秒
                </p>
              </div>
            ) : useVoiceId ? (
              <>
                {/* Voice ID 输入模式 */}
                <div className="w-full max-w-md">
                  <div className="mb-3">
                    <label htmlFor="voiceIdInput" className="block text-sm font-medium text-gray-700 mb-2">
                      直接输入 Voice ID
                    </label>
                    <input
                      id="voiceIdInput"
                      type="text"
                      value={voiceIdInput}
                      onChange={(e) => setVoiceIdInput(e.target.value)}
                      placeholder="voice-xxxxxxxxxxx"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      如果您已经有 GLM 克隆的 Voice ID，可以直接输入使用
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={useProvidedVoiceId}
                    disabled={isUploading || !voiceIdInput.trim()}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? (
                      <>
                        <Upload className="w-5 h-5 animate-pulse" />
                        处理中...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        使用此 Voice ID
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* 录音按钮 */}
                <button
                  type="button"
                  onClick={() => {
                    if (isRecording) {
                      stopRecording();
                    } else {
                      startRecording();
                    }
                  }}
                  disabled={isRecording || recordingState === 'starting' || recordingState === 'stopping'}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRecording ? (
                    <>
                      <Square className="w-5 h-5 animate-pulse" />
                      停止录音
                    </>
                  ) : recordingState === 'starting' ? (
                    <>
                      <Mic className="w-5 h-5 animate-pulse" />
                      启动中...
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5" />
                      开始录音（{maxDuration}秒）
                    </>
                  )}
                </button>

                {/* 录音时间显示 */}
                {isRecording && (
                  <div className="text-center">
                    <div className="text-2xl font-mono font-bold text-red-600">
                      {formatTime(recordingTime)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      录音中...
                    </div>
                  </div>
                )}

                {/* 录音提示 */}
                <p className="text-xs text-gray-600 text-center">
                  💡 请确保在安静环境中录音，说话清晰，时长3-5秒为佳
                </p>
              </>
            )}
          </>
        ) : (
          <>
            {/* 录音完成后的操作按钮 */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={playRecording}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  {isPlaying ? (
                    <>
                      <Square className="w-4 h-4" />
                      暂停
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      播放
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={deleteRecording}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  重录
                </button>

                {!uploadSuccess && (
                  <button
                    type="button"
                    onClick={uploadAudio}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? (
                      <>
                        <Upload className="w-4 h-4 animate-pulse" />
                        上传中...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        上传
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* 调试工具：下载音频文件 */}
              <button
                type="button"
                onClick={downloadAudio}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                下载音频文件测试播放（调试）
              </button>
            </div>
          </>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 音色名称输入框 */}
      {showVoiceNameInput && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
          <div>
            <label htmlFor="voiceNameInput" className="block text-sm font-medium text-gray-700 mb-2">
              为您的音色起个名字
            </label>
            <input
              id="voiceNameInput"
              type="text"
              value={voiceNameInput}
              onChange={(e) => setVoiceNameInput(e.target.value)}
              placeholder="例如：温柔女声、激昂男声"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={50}
              disabled={savingVoice}
            />
            <p className="text-xs text-gray-600 mt-1">
              建议：使用描述性的名称，如"温柔女声"、"专业男声"等，方便后续识别
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveVoice}
              disabled={savingVoice || !voiceNameInput.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingVoice ? (
                <>
                  <Upload className="w-4 h-4 animate-pulse" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  保存音色
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowVoiceNameInput(false);
                setVoiceNameInput('');
                setError(null);
              }}
              disabled={savingVoice}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 成功提示 */}
      {uploadSuccess && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-600 font-medium">✅ 音色复刻成功！</p>
          <p className="text-xs text-green-700 mt-1">您可以使用此音色生成课程语音了。</p>
        </div>
      )}

      {/* 音频元素（隐藏） */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={handleAudioEnded}
          onLoadedData={handleAudioLoaded}
          onPlay={handleAudioPlay}
          onPause={handleAudioPause}
          onError={handleAudioError}
          preload="auto"
          style={{ display: 'none' }}
        />
      )}

      {/* 调试：显示音频信息 */}
      {audioUrl && audioBlob && (
        <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
          <p className="font-mono">
            音频信息: {audioBlob.type} | 大小: {(audioBlob.size / 1024).toFixed(2)} KB
          </p>
        </div>
      )}

      {/* 提示文本 */}
      {!audioUrl && !isRecording && (
        <p className="text-sm text-gray-600 text-center">
          {useFileUpload
            ? '点击"选择音频文件"上传 MP3 或 WAV 格式的音频（3-5秒）'
            : `点击"开始录音"按钮，录制 ${maxDuration} 秒音频样本，或切换到"上传文件"模式`
          }
        </p>
      )}
    </div>
  );
}
