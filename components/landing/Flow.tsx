export function Flow() {
  return (
    <section
      className="bg-white border-t border-b border-slate-200"
      id="flow"
      aria-labelledby="flow-title"
    >
      <div className="container">
        <div className="text-center mb-16">
          <h2
            id="flow-title"
            className="font-bold text-2xl text-slate-900 tracking-tight mb-2"
          >
            知识图谱诊断 · AI互动教学 · 靶向练习
          </h2>
          <p className="text-slate-600 text-base">
            从定位薄弱点到因材施教到真正掌握，完整提分闭环
          </p>
        </div>
        <div className="flex gap-16 justify-center flex-wrap">
          <div className="flex-1 min-w-72 max-w-80 text-center px-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-4xl font-black bg-primary/10 text-primary">
              测
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-2">
              知识图谱诊断
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              基于学科知识图谱，精准定位每个知识点的掌握程度。不是只给答案，是告诉你"哪里不会、为什么不会"。
            </p>
          </div>

          <div className="hidden md:flex items-center text-slate-200 text-4xl font-light">
            →
          </div>

          <div className="flex-1 min-w-72 max-w-80 text-center px-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-4xl font-black bg-amber-500/12 text-amber-500">
              学
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-2">
              AI互动课堂
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              多智能体实时生成互动课程，AI教师与学生对话讨论，针对薄弱点因材施教。不是看视频，是真实互动。
            </p>
          </div>

          <div className="hidden md:flex items-center text-slate-200 text-4xl font-light">
            →
          </div>

          <div className="flex-1 min-w-72 max-w-80 text-center px-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-4xl font-black bg-green-500/10 text-green-600">
              练
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-2">
              靶向练习
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              精准推题巩固薄弱知识点，练到真正掌握为止。每一步进步都有数据追踪。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
