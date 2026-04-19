import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 暂时禁用standalone模式，与新模块有内存冲突
  // TODO: 修复内存泄漏后重新启用
  // output: process.env.VERCEL ? undefined : 'standalone',
  transpilePackages: ['mathml2omml', 'pptxgenjs'],
  serverExternalPackages: [],
  experimental: {
    proxyClientMaxBodySize: '200mb',
  },
};

export default nextConfig;
