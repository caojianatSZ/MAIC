export function Flow() {
  return (
    <section className="flow" id="flow" aria-labelledby="flow-title">
      <div className="container">
        <div className="flow-header">
          <h2 id="flow-title">
            知识图谱诊断 · AI互动教学 · 靶向练习
          </h2>
          <p>
            从定位薄弱点到因材施教到真正掌握，完整提分闭环
          </p>
        </div>
        <div className="flow-steps">
          <div className="flow-step">
            <div className="flow-step-icon diagnose">测</div>
            <h3>知识图谱诊断</h3>
            <p>
              基于学科知识图谱，精准定位每个知识点的掌握程度。不是只给答案，是告诉你"哪里不会、为什么不会"。
            </p>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="flow-step-icon learn">学</div>
            <h3>AI互动课堂</h3>
            <p>
              多智能体实时生成互动课程，AI教师与学生对话讨论，针对薄弱点因材施教。不是看视频，是真实互动。
            </p>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="flow-step-icon practice">练</div>
            <h3>靶向练习</h3>
            <p>
              精准推题巩固薄弱知识点，练到真正掌握为止。每一步进步都有数据追踪。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
