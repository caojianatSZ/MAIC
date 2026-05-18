import type { Metadata } from 'next';
import { Noto_Sans_SC } from 'next/font/google';
import './landing.css';

const notoSansSC = Noto_Sans_SC({
  weight: ['400', '500', '700', '900'],
  subsets: ['latin'],
  variable: '--font-noto-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '学迹 — 多智能体AI课程，精准提分',
  description: '学迹基于知识图谱诊断薄弱点，LLM多智能体实时生成互动课程，因材施教靶向练习。不是录播课，不是拍题工具——是每个孩子专属的AI老师。',
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={notoSansSC.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
