import Link from 'next/link';

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container">
        <span className="hero-badge">弘知出品</span>
        <h1 id="hero-title">
          多智能体AI课程<br />
          <em>精准提分</em>，因材施教
        </h1>
        <p>
          基于知识图谱诊断薄弱点，LLM多智能体实时生成互动课程。每个孩子都有自己的AI老师——不是看录播视频，是真实互动对话。
        </p>
        <Link href="#flow" className="btn-primary">
          了解如何提分
        </Link>
      </div>
    </section>
  );
}
