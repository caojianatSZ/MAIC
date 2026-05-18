export function Comparison() {
  return (
    <section className="diff" aria-labelledby="diff-title">
      <div className="container">
        <h2 id="diff-title">同样是学习，效果不同</h2>
        <p>
          培训班刷题不知道弱点在哪，拍题工具给了答案就走。学迹把诊断、教学、练习串成闭环。
        </p>
        <div className="diff-grid">
          <div className="diff-card them">
            <h3>传统学习方式</h3>
            <ul>
              <li>培训班：统一进度，不针对个人弱点</li>
              <li>拍题工具：给答案但不教思路</li>
              <li>录播课：被动观看，没有互动</li>
            </ul>
          </div>
          <div className="diff-card us">
            <h3>学迹</h3>
            <ul>
              <li>知识图谱定位薄弱点，精准到每个知识点</li>
              <li>多智能体互动课堂，因材施教</li>
              <li>靶向练习 + 提分追踪，效果看得见</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
