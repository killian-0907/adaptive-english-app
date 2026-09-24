"use client";
export default function AssessmentErrorPage({reset}:{reset:()=>void}) {
  return <main className="assessment-shell"><section className="assessment-card"><h1>We could not load your assessment</h1><p role="alert">Your saved progress is safe. Please try again. 暂时无法加载，已保存的进度不会丢失。</p><button onClick={reset}>Try again / 重试</button></section></main>;
}
