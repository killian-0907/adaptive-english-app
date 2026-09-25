"use client";
export default function LearningError({reset}:{reset:()=>void}){return <main className="assessment-shell"><h1>Let’s resume your learning</h1><p>We could not load this session. Your saved progress is safe.</p><button onClick={reset}>Try again</button></main>;}
