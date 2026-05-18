export function Classroom() {
  return (
    <section className="text-center" aria-labelledby="classroom-title">
      <div className="container">
        <h2
          id="classroom-title"
          className="font-bold text-2xl text-slate-900 tracking-tight mb-4"
        >
          不是题库，是AI老师
        </h2>
        <p className="text-slate-600 max-w-lg mx-auto mb-8 text-base">
          学迹基于OpenMAIC多智能体引擎，AI教师与AI学生实时对话、辩论、讲解——针对每个学生的薄弱点量身生成互动课程。诊断只是起点，因材施教才是核心。
        </p>
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-left max-w-2xl mx-auto shadow-sm">
          <h3 className="font-bold text-xl text-slate-900 mb-4">
            AI多智能体互动课堂
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            LLM驱动的AI教师和AI学生实时对话、辩论、讲解——不是被动看录播视频，而是主动参与互动讨论。每个知识点的教学方式都根据诊断结果量身定制。
          </p>
          <div className="flex gap-6 flex-wrap">
            <div className="flex-1 min-w-48 p-4 bg-slate-50 rounded-lg">
              <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                教学方式
              </div>
              <div className="font-bold text-base text-slate-900">
                AI多智能体对话
              </div>
            </div>
            <div className="flex-1 min-w-48 p-4 bg-slate-50 rounded-lg">
              <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                内容生成
              </div>
              <div className="font-bold text-base text-slate-900">
                实时自适应
              </div>
            </div>
            <div className="flex-1 min-w-48 p-4 bg-slate-50 rounded-lg">
              <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                教学节奏
              </div>
              <div className="font-bold text-base text-slate-900">
                每个学生不同
              </div>
            </div>
            <div className="flex-1 min-w-48 p-4 bg-slate-50 rounded-lg">
              <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">
                学习效果
              </div>
              <div className="font-bold text-base text-slate-900">
                可追踪验证
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
