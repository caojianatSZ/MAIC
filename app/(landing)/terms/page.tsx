import { Navigation } from '@/components/landing/Navigation';
import { Footer } from '@/components/landing/Footer';

export const metadata = {
  title: '用户协议 - 学迹',
  description: '学迹用户协议',
};

export default function TermsPage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen py-20">
        <div className="container max-w-3xl">
          <h1 className="font-black text-3xl text-slate-900 mb-8">用户协议</h1>

          <section className="mb-8">
            <h2 className="font-bold text-xl text-slate-900 mb-4">1. 服务说明</h2>
            <p className="text-slate-600 leading-relaxed">
              学迹是一个基于人工智能的教育平台，为用户提供知识图谱诊断、AI互动课程、靶向练习等服务。本协议是您与学迹之间关于使用本服务的法律协议。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-bold text-xl text-slate-900 mb-4">2. 用户注册</h2>
            <p className="text-slate-600 leading-relaxed">
              使用本服务需要注册账户。您承诺提供的注册信息真实、准确、完整，并及时更新。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-bold text-xl text-slate-900 mb-4">3. 用户行为</h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              在使用本服务时，您同意遵守以下规范：
            </p>
            <ul className="list-none text-slate-600 space-y-2 ml-4">
              <li>• 不得利用本服务从事任何违法违规活动</li>
              <li>• 不得干扰或破坏本服务的正常运行</li>
              <li>• 不得侵犯他人合法权益</li>
              <li>• 不得传播有害信息或虚假信息</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="font-bold text-xl text-slate-900 mb-4">4. 知识产权</h2>
            <p className="text-slate-600 leading-relaxed">
              本服务中的所有内容，包括但不限于文字、图片、音频、视频、软件等，均受知识产权法保护。未经授权，您不得复制、传播、展示或以其他方式使用这些内容。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-bold text-xl text-slate-900 mb-4">5. 免责声明</h2>
            <p className="text-slate-600 leading-relaxed">
              本服务按"现状"提供，不提供任何明示或暗示的保证。对于因使用本服务而产生的任何直接或间接损失，我们不承担责任。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-bold text-xl text-slate-900 mb-4">6. 协议变更</h2>
            <p className="text-slate-600 leading-relaxed">
              我们保留随时修改本协议的权利。修改后的协议将在本页面发布，继续使用本服务即表示您同意接受修改后的协议。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="font-bold text-xl text-slate-900 mb-4">7. 联系我们</h2>
            <p className="text-slate-600 leading-relaxed">
              如您对本协议有任何疑问，请通过以下方式联系我们：
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
