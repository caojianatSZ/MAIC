import { Navigation } from '@/components/landing/Navigation';
import { Footer } from '@/components/landing/Footer';
import Link from 'next/link';

export default function FeaturesPage() {
  return (
    <>
      <Navigation />
      <main>
        <section className="text-center pt-32 pb-16" aria-labelledby="features-title">
          <div className="container">
            <h1
              id="features-title"
              className="font-black text-[clamp(2rem,5vw,3rem)] text-slate-900 leading-tight tracking-tight max-w-3xl mx-auto mb-6"
            >
              三步提分
            </h1>
            <p className="text-lg text-slate-600 max-w-xl mx-auto leading-relaxed">
              诊断、学习、练习，完整闭环让每分努力都有效
            </p>
          </div>
        </section>

        <section className="bg-white border-t border-slate-200" aria-labelledby="step1-title">
          <div className="container">
            <div className="flex flex-col md:flex-row items-center gap-12 py-20">
              <div className="flex-1">
                <span className="inline-block w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-black bg-primary/10 text-primary mb-6">
                  01
                </span>
                <h2 id="step1-title" className="font-bold text-2xl text-slate-900 tracking-tight mb-4">
                  知识图谱诊断
                </h2>
                <p className="text-slate-600 leading-relaxed mb-6">
                  基于学科知识图谱，精准定位每个知识点的掌握程度。不只是告诉你"错了"，更告诉你"为什么错""哪里不会""怎么才能会"。
                </p>
                <ul className="list-none text-sm text-slate-600 space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>覆盖初中、高中数学、物理、化学等主要学科</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>拍照即可诊断，秒级出结果</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>可视化知识图谱，薄弱点一目了然</span>
                  </li>
                </ul>
              </div>
              <div className="flex-1 max-w-md">
                <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
                  <h3 className="font-bold text-lg text-slate-900 mb-4">诊断报告</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600">二次函数</span>
                        <span className="text-red-500 font-medium">薄弱</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 w-1/3"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600">一元二次方程</span>
                        <span className="text-amber-500 font-medium">部分掌握</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 w-2/3"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600">函数基础</span>
                        <span className="text-green-500 font-medium">已掌握</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 w-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="step2-title">
          <div className="container">
            <div className="flex flex-col md:flex-row-reverse items-center gap-12 py-20">
              <div className="flex-1">
                <span className="inline-block w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-black bg-amber-500/12 text-amber-500 mb-6">
                  02
                </span>
                <h2 id="step2-title" className="font-bold text-2xl text-slate-900 tracking-tight mb-4">
                  AI互动课堂
                </h2>
                <p className="text-slate-600 leading-relaxed mb-6">
                  多智能体实时生成互动课程。AI教师和AI学生实时对话、辩论、讲解——不是被动看视频，而是主动参与讨论。每个知识点都根据诊断结果量身定制教学内容。
                </p>
                <ul className="list-none text-sm text-slate-600 space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>AI教师讲解 + AI学生提问，模拟真实课堂</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>针对性讲解薄弱知识点</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>可暂停、可回放、可反复学习</span>
                  </li>
                </ul>
              </div>
              <div className="flex-1 max-w-md">
                <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                      师
                    </div>
                    <div className="bg-white rounded-lg p-3 text-sm text-slate-700 shadow-sm">
                      二次函数的开口方向由a的正负决定...
                    </div>
                  </div>
                  <div className="flex items-start gap-3 mb-4 flex-row-reverse">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 text-xs font-bold shrink-0">
                      生
                    </div>
                    <div className="bg-white rounded-lg p-3 text-sm text-slate-700 shadow-sm">
                      那a=0的时候是什么情况？
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                      师
                    </div>
                    <div className="bg-white rounded-lg p-3 text-sm text-slate-700 shadow-sm">
                      好问题！当a=0时，二次函数就退化成一次函数了...
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white border-t border-slate-200" aria-labelledby="step3-title">
          <div className="container">
            <div className="flex flex-col md:flex-row items-center gap-12 py-20">
              <div className="flex-1">
                <span className="inline-block w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-black bg-green-500/10 text-green-600 mb-6">
                  03
                </span>
                <h2 id="step3-title" className="font-bold text-2xl text-slate-900 tracking-tight mb-4">
                  靶向练习
                </h2>
                <p className="text-slate-600 leading-relaxed mb-6">
                  精准推送针对薄弱知识点的练习题，练到真正掌握为止。每道题都有详细解析，错题自动加入错题本，方便复习巩固。
                </p>
                <ul className="list-none text-sm text-slate-600 space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>智能推题，只练不会的</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>详细解析，知其然更知其所以然</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>错题本自动整理，针对性复习</span>
                  </li>
                </ul>
              </div>
              <div className="flex-1 max-w-md">
                <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
                  <h3 className="font-bold text-lg text-slate-900 mb-4">今日练习</h3>
                  <div className="space-y-3">
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-900">二次函数图像</span>
                        <span className="text-xs text-green-500 bg-green-50 px-2 py-1 rounded">已完成</span>
                      </div>
                      <div className="text-xs text-slate-500">正确率: 5/5</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-900">抛物线顶点</span>
                        <span className="text-xs text-amber-500 bg-amber-50 px-2 py-1 rounded">进行中</span>
                      </div>
                      <div className="text-xs text-slate-500">进度: 3/8</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-900">函数对称轴</span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">待练习</span>
                      </div>
                      <div className="text-xs text-slate-500">预计 5 题</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="text-center py-20">
          <div className="container">
            <h2 className="font-bold text-2xl text-slate-900 tracking-tight mb-6">
              开始提分之旅
            </h2>
            <p className="text-slate-600 mb-8">
              三步闭环，让每一分努力都算数
            </p>
            <Link href="/" className="btn-primary">
              返回首页
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
