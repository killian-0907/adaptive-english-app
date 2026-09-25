"use client";
export default function ErrorPage({reset}:{reset:()=>void}){return <section className="product-card"><h1>We couldn’t load this page</h1><p>Your saved learning progress is safe. Please try again.</p><button onClick={reset}>Try again</button></section>;}
