import { Navigation } from '@/components/landing/Navigation';
import { Footer } from '@/components/landing/Footer';

export const metadata = {
  title: '隐私政策 - 学迹',
  description: '学迹隐私政策',
};

export default function PrivacyPage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen py-20">
        <div className="container max-w-3xl">
          <h1 className="font-black text-3xl text-slate-900 mb-8">隐私政策</h1>

          <section className="mb-8">
            <h2 className="font-bold text-xl text-slate-900 mb-4">1. 信息收集</h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              我们收集您在使用学迹服务时主动提供的信息，包括但不限于：
            </p>
            <ul className="list-none text-slate-600 space-y-2 ml-4">
              <li>• 账户信息（用户名、头像等）</li>
              <li>• 学习数据（诊断结果、练习记录等）</li>
              <li>• 设备信息（设备型号、操作系统版本等）</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="font-bold text-xl text-slate-900 mb-4">2. 信息使用</h2>
            <p className="text-slate-600 leading-relaxed">
              我们使用收集的信息来提供、改进和个性化我们的服务，包括为您生成个性化学习方案、追踪学习进度等。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-bold text-xl text-slate-900 mb-4">3. 信息保护</h2>
            <p className="text-slate-600 leading-relaxed">
              我们采取合理的技术措施保护您的个人信息安全，包括数据加密、访问控制等。但请注意，任何安全措施都无法做到绝对安全。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-bold text-xl text-slate-900 mb-4">4. 信息共享</h2>
            <p className="text-slate-600 leading-relaxed">
              除以下情况外，我们不会与第三方共享您的个人信息：
            </p>
            <ul className="list-none text-slate-600 space-y-2 ml-4">
              <li>• 获得您的明确同意</li>
              <li>• 根据法律法规或政府要求</li>
              <li>• 保护我们的合法权益</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="font-bold text-xl text-slate-900 mb-4">5. 未成年人保护</h2>
            <p className="text-slate-600 leading-relaxed">
              我们的服务主要面向未成年人用户。我们将特别注重保护未成年人的个人信息安全，只会在监护人同意的情况下收集相关信息。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-bold text-xl text-slate-900 mb-4">6. 政策更新</h2>
            <p className="text-slate-600 leading-relaxed">
              我们可能会不时更新本隐私政策。更新后的政策将在本页面发布，请您定期查阅。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-bold text-xl text-slate-900 mb-4">7. 联系我们</h2>
            <p className="text-slate-600 leading-relaxed">
              如您对本隐私政策有任何疑问或建议，请通过以下方式联系我们：
            </p>
            <p className="text-slate-600 leading-relaxed">
              邮箱：hello@hz-college.com
            </p>
          </section>

          <p className="text-sm text-slate-400 mt-12">
            最后更新时间：2026年5月18日
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
