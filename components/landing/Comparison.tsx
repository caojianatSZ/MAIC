export function Comparison() {
  return (
    <section className="text-center" aria-labelledby="diff-title">
      <div className="container">
        <h2
          id="diff-title"
          className="font-bold text-2xl text-slate-900 tracking-tight mb-4"
        >
          同样是学习，效果不同
        </h2>
        <p className="text-slate-600 max-w-xl mx-auto mb-12">
          培训班刷题不知道弱点在哪，拍题工具给了答案就走。学迹把诊断、教学、练习串成闭环。
        </p>
        <div className="flex gap-6 justify-center flex-wrap">
          <div className="flex-1 min-w-72 max-w-sm px-6 py-8 bg-white border border-slate-200 rounded-xl text-left">
            <h3 className="font-bold text-base text-slate-400 mb-6">
              传统学习方式
            </h3>
            <ul className="list-none text-sm text-slate-600 space-y-4">
              <li className="before:content-['✗_'] before:text-red-500 before:font-bold before:mr-2">
                培训班：统一进度，不针对个人弱点
              </li>
              <li className="before:content-['✗_'] before:text-red-500 before:font-bold before:mr-2">
                拍题工具：给答案但不教思路
              </li>
              <li className="before:content-['✗_'] before:text-red-500 before:font-bold before:mr-2">
                录播课：被动观看，没有互动
              </li>
            </ul>
          </div>
          <div className="flex-1 min-w-72 max-w-sm px-6 py-8 bg-white border border-slate-200 rounded-xl text-left">
            <h3 className="font-bold text-base text-primary mb-6">
              学迹
            </h3>
            <ul className="list-none text-sm text-slate-600 space-y-4">
              <li className="before:content-['✓_'] before:text-green-500 before:font-bold before:mr-2">
                知识图谱定位薄弱点，精准到每个知识点
              </li>
              <li className="before:content-['✓_'] before:text-green-500 before:font-bold before:mr-2">
                多智能体互动课堂，因材施教
              </li>
              <li className="before:content-['✓_'] before:text-green-500 before:font-bold before:mr-2">
                靶向练习 + 提分追踪，效果看得见
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
