'use client';

import { useState } from 'react';

export default function OCRTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');

      // 创建预览
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setError('请选择图片文件');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('language_type', 'CHN_ENG');
      formData.append('probability', 'true');

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '请求失败');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '识别失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold mb-2">OCR识别测试</h1>
          <p className="text-gray-600 mb-8">
            上传图片进行文字识别，支持印刷体和手写体
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 文件上传 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择图片文件
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/bmp"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-indigo-50 file:text-indigo-700
                  hover:file:bg-indigo-100
                "
              />
              <p className="mt-1 text-xs text-gray-500">
                支持 PNG、JPG、JPEG、BMP 格式，最大 8MB
              </p>
            </div>

            {/* 预览 */}
            {preview && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  图片预览
                </label>
                <div className="border-2 border-gray-300 rounded-lg p-4">
                  <img
                    src={preview}
                    alt="Preview"
                    className="max-w-full h-auto max-h-96 mx-auto"
                  />
                </div>
              </div>
            )}

            {/* 错误信息 */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={!file || loading}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md
                font-semibold hover:bg-indigo-700 disabled:bg-gray-400
                disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '识别中...' : '开始识别'}
            </button>
          </form>

          {/* 识别结果 */}
          {result && (
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-4">识别结果</h2>

              <div className="space-y-4">
                {/* 基本信息 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">基本信息</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">任务ID:</span>{' '}
                      <span className="text-gray-600">{result.data?.task_id}</span>
                    </div>
                    <div>
                      <span className="font-medium">状态:</span>{' '}
                      <span className="text-green-600">{result.data?.status}</span>
                    </div>
                    <div>
                      <span className="font-medium">识别行数:</span>{' '}
                      <span className="text-gray-600">
                        {result.data?.words_result_num}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 识别文本 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">识别文本</h3>
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                    {result.data?.text || '无'}
                  </pre>
                </div>

                {/* 详细结果 */}
                {result.data?.words_result && result.data.words_result.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">详细结果</h3>
                    <div className="space-y-3">
                      {result.data.words_result.map((item: any, index: number) => (
                        <div
                          key={index}
                          className="border-l-4 border-indigo-500 pl-3"
                        >
                          <div className="text-sm text-gray-700 mb-1">
                            {item.words}
                          </div>
                          {item.probability && (
                            <div className="text-xs text-gray-500">
                              置信度: {item.probability.average?.toFixed(2)}%
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* API说明 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-900 mb-2">💡 API使用说明</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>
              <strong>端点:</strong> POST /api/ocr
            </p>
            <p>
              <strong>Content-Type:</strong> multipart/form-data
            </p>
            <p>
              <strong>参数:</strong>
            </p>
            <ul className="list-disc list-inside ml-4">
              <li>file: 图片文件 (必需)</li>
              <li>language_type: 语言类型 (可选, 默认CHN_ENG)</li>
              <li>probability: 是否返回置信度 (可选, 默认false)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
