import Link from 'next/link';

export function Hero() {
  return (
    <section className="hero text-center" aria-labelledby="hero-title">
      <div className="container">
        <span className="inline-block px-2 py-1.5 bg-primary/8 text-primary rounded-full text-sm font-semibold mb-6">
          弘知出品
        </span>
        <h1
          id="hero-title"
          className="font-black text-[clamp(2rem,5vw,3.5rem)] text-slate-900 leading-tight tracking-tight mb-6"
        >
          多智能体AI课程<br />
          <em className="not-italic text-amber-500">精准提分</em>，因材施教
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8 leading-relaxed">
          基于知识图谱诊断薄弱点，LLM多智能体实时生成互动课程。每个孩子都有自己的AI老师——不是看录播视频，是真实互动对话。
        </p>
        <Link href="#flow" className="btn-primary">
          了解如何提分
        </Link>
      </div>
    </section>
  );
}
