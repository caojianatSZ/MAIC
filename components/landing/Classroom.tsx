export function Classroom() {
  return (
    <section className="classroom" aria-labelledby="classroom-title">
      <div className="container">
        <h2 id="classroom-title">不是题库，是AI老师</h2>
        <p>
          学迹基于OpenMAIC多智能体引擎，AI教师与AI学生实时对话、辩论、讲解——针对每个学生的薄弱点量身生成互动课程。诊断只是起点，因材施教才是核心。
        </p>
        <div className="classroom-card">
          <h3>AI多智能体互动课堂</h3>
          <p>
            LLM驱动的AI教师和AI学生实时对话、辩论、讲解——不是被动看录播视频，而是主动参与互动讨论。每个知识点的教学方式都根据诊断结果量身定制。
          </p>
          <div className="classroom-features">
            <div className="classroom-feature">
              <div className="label">教学方式</div>
              <div className="value">AI多智能体对话</div>
            </div>
            <div className="classroom-feature">
              <div className="label">内容生成</div>
              <div className="value">实时自适应</div>
            </div>
            <div className="classroom-feature">
              <div className="label">教学节奏</div>
              <div className="value">每个学生不同</div>
            </div>
            <div className="classroom-feature">
              <div className="label">学习效果</div>
              <div className="value">可追踪验证</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
