import type { Dimension, Modality } from "./contracts";

export type Item = { id: string; type: "recognition" | "listening" | "spoken" | "reading" | "written" | "practical"; skill: Dimension; modality: Modality; difficulty: number; knowledge: string; prompt: string; tts: string | null; options: string[]; answer: string | null; strategy: "exact" | "evaluator"; native: Record<string, string>; hint: string; expectedSkills: Dimension[]; branching: "performance_and_coverage" };
const listen = [
  ["Hello.", "Which greeting did you hear?", "Hello", "Goodbye", "Thank you"],
  ["The bus leaves at nine.", "When does the bus leave?", "Nine", "Five", "Ten"],
  ["Please bring your passport, but you can leave your ticket at home.", "What must you bring?", "Passport", "Ticket", "Lunch"],
  ["We were going to meet on Tuesday, but let's move it to Thursday afternoon.", "When will they meet?", "Thursday afternoon", "Tuesday morning", "Tuesday afternoon"],
  ["Although the cheaper option is tempting, its maintenance costs make the other proposal more sensible in the long run.", "Which proposal does the speaker favor?", "The initially more expensive proposal", "The cheapest proposal", "Neither proposal"],
  ["I wouldn't say the pilot was a failure; if anything, it exposed assumptions we'd otherwise have carried into a far costlier rollout.", "What is the speaker implying?", "The pilot provided valuable warnings", "The rollout should proceed unchanged", "The pilot proved the assumptions correct"],
];
const reading = [
  ["OPEN", "A shop sign says OPEN. Can you go inside?", "Yes", "No", "Only tomorrow"],
  ["Closed on Sunday", "When is the shop closed?", "Sunday", "Monday", "Every day"],
  ["Buy two drinks and get the cheaper one free.", "What is free?", "The cheaper drink", "Both drinks", "The expensive drink"],
  ["Applications received after Friday will be considered only if places remain.", "Can a late application be considered?", "Yes, if places remain", "Never", "Always"],
  ["The report links flexible hours with retention, while cautioning that voluntary participation may have biased the sample.", "What limits the conclusion?", "Selection bias", "No retention data", "Inflexible hours"],
  ["By treating absence of evidence as evidence of absence, the committee converted a methodological limitation into an unwarranted policy certainty.", "What is the criticism?", "The committee overstated what missing data imply", "The committee collected too much evidence", "The policy was deliberately uncertain"],
];
const recognition = [
  ["water", "Match the word: water", "💧", "☀️", "🌳"],
  ["appointment", "An appointment is…", "An arranged meeting", "A kind of food", "A place to sleep"],
  ["reschedule", "To reschedule means…", "Arrange another time", "Cancel forever", "Arrive early"],
  ["reliable", "A reliable service is one you can…", "Depend on", "Never afford", "Easily forget"],
  ["contingency", "A contingency plan prepares for…", "Possible unexpected events", "Only the most likely outcome", "An event that already happened"],
  ["equivocal", "An equivocal response is…", "Ambiguous or noncommittal", "Unequivocally supportive", "Unrelated to the question"],
];
const spoken = ["Say hello. One word is enough.", "Tell someone your name and one thing you like.", "Describe what you usually do in the morning.", "Explain a change you would like to make to your daily routine and why.", "Compare two ways of learning a skill and explain which you prefer.", "Give a nuanced argument about when convenience should give way to privacy, including a counterargument."];
const practical = ["Ask for water. You can say just one word.", "Order a drink politely.", "Ask to change an appointment to tomorrow.", "Your order is wrong. Explain the problem and ask politely for a solution.", "Negotiate a deadline extension while acknowledging the other person's constraints.", "Respond diplomatically to a colleague's flawed proposal: acknowledge its strengths, challenge an assumption, and suggest a compromise."];
const written = ["Write your name or one English word you know.", "Write one sentence about something you like.", "Write a short message inviting a friend to meet tomorrow.", "Write a short message explaining why you need to change a plan and suggesting another time.", "Write a short paragraph comparing two solutions to a workplace problem.", "Write a concise recommendation that weighs competing priorities and acknowledges uncertainty."];
const translated: Record<string, {zh:string[];es:string[]}> = {
  spoken:{zh:["说一句问候语。一个词就够了。","说说你的名字和一件喜欢的事。","说说你平常早上做什么。","说说你想改变的日常习惯及原因。","比较两种学习方式，解释你的偏好。","讨论便利何时应该让位于隐私，也考虑反方观点。"],es:["Saluda. Basta una palabra.","Di tu nombre y algo que te gusta.","Describe tu rutina de mañana.","Explica un cambio que deseas hacer en tu rutina y por qué.","Compara dos formas de aprender y explica tu preferencia.","Argumenta cuándo la privacidad debe prevalecer sobre la comodidad e incluye un contraargumento."]},
  practical:{zh:["向别人要水。说一个词也可以。","礼貌地点一杯饮料。","请求把预约改到明天。","收到的订单不对，说明问题并礼貌地请求解决。","协商延长截止日期，同时考虑对方的限制。","礼貌回应同事的方案：肯定优点，质疑假设，提出折中办法。"],es:["Pide agua. Basta una palabra.","Pide una bebida con cortesía.","Pide cambiar una cita a mañana.","Tu pedido está equivocado. Explica y pide una solución.","Negocia una prórroga teniendo en cuenta las limitaciones de la otra persona.","Responde diplomáticamente a una propuesta: reconoce sus ventajas, cuestiona una suposición y ofrece un compromiso."]},
  written:{zh:["写下你的名字或一个认识的英语单词。","写一句话描述你喜欢的事。","写个简短消息，邀请朋友明天见面。","写个简短消息，说明改变计划的原因并建议新时间。","写一小段话，比较解决工作问题的两种方法。","简洁地提出建议，权衡不同需求并说明不确定之处。"],es:["Escribe tu nombre o una palabra inglesa que conozcas.","Escribe una frase sobre algo que te gusta.","Invita a un amigo a quedar mañana.","Explica por qué necesitas cambiar un plan y sugiere otra hora.","Compara dos soluciones a un problema laboral.","Escribe una recomendación que sopese prioridades y reconozca la incertidumbre."]},
  listening:{zh:["你听到了哪句问候语？","公交车几点出发？","必须带什么？","他们什么时候见面？","说话者更倾向于哪个方案？","说话者暗示了什么？"],es:["¿Qué saludo escuchaste?","¿Cuándo sale el autobús?","¿Qué debes llevar?","¿Cuándo se reunirán?","¿Qué propuesta prefiere?","¿Qué insinúa la persona?"]},
  reading:{zh:["商店写着 OPEN，可以进去吗？","商店什么时候关门？","哪杯饮料免费？","迟交的申请还能考虑吗？","什么因素限制了结论？","这段话批评了什么？"],es:["La tienda dice OPEN. ¿Puedes entrar?","¿Cuándo cierra la tienda?","¿Qué bebida es gratis?","¿Se puede considerar una solicitud tardía?","¿Qué limita la conclusión?","¿Cuál es la crítica?"]},
};
const native: Record<string, Record<string, string>> = {
  listening: { zh: "听短音频，选择意思相符的答案。不懂也没关系。", es: "Escucha y elige la respuesta. Está bien no saber." },
  recognition: { zh: "选出对应的意思。不需要懂语法。", es: "Elige el significado. No necesitas saber gramática." },
  reading: { zh: "阅读短文字并选择答案。", es: "Lee el texto y elige la respuesta." },
  spoken: { zh: "试着用英语说话。初学者说一个词即可，可以重试。", es: "Intenta hablar en inglés. Al empezar basta una palabra; puedes repetir." },
  practical: { zh: "试着完成这个生活情景。可以用一个词，也可以请求帮助。", es: "Responde a esta situación. Puedes pedir ayuda." },
  written: { zh: "尝试用英语写一点。初学者写一个词即可。", es: "Escribe algo en inglés. Al empezar basta una palabra." },
};
export const items: Item[] = Array.from({ length: 6 }, (_, difficulty) => {
  const base = { difficulty, branching: "performance_and_coverage" as const };
  return (["listening", "spoken", "practical", "reading", "written", "recognition"] as const).map(type => {
    const row = type === "listening" ? listen[difficulty] : type === "recognition" ? recognition[difficulty] : reading[difficulty];
    const exact = ["listening", "reading", "recognition"].includes(type);
    const skill: Dimension = type === "listening" ? "listening" : type === "spoken" ? "spoken_expression" : type === "practical" ? "practical_communication" : type === "written" ? "written_expression" : type === "recognition" ? "vocabulary" : "reading";
    const prompt = type === "spoken" ? spoken[difficulty] : type === "practical" ? practical[difficulty] : type === "written" ? written[difficulty] : type === "reading" ? `${row[0]}\n\n${row[1]}` : row[1];
    return { ...base, id: `${type}-${difficulty}`, type, skill, modality: type === "listening" ? "listening_recognition" : type === "spoken" || type === "practical" ? "spoken_production" : type === "written" ? "written_production" : "reading_recognition", knowledge: `${type}-${difficulty}`, prompt, tts: type === "listening" ? row[0] : type === "spoken" || type === "practical" ? prompt : null,
      options: exact ? [row[2],row[3],row[4]].map((_,i,all)=>all[(i+difficulty+type.length)%3]) : [], answer: exact ? row[2] : null, strategy: exact ? "exact" : "evaluator", native: Object.fromEntries(["zh","es"].map(lang=>[lang,`${native[type][lang]} ${type === "recognition" ? (lang === "zh" ? "选择这个英语词对应的意思。" : "Elige el significado de la palabra inglesa.") : translated[type][lang as "zh"|"es"][difficulty]}`])), hint: difficulty === 0 ? (type === "practical" ? "Water, please." : type === "spoken" ? "Hello." : "Take your time. One word is enough.") : "Use simple words. Say or write the main idea first.",
      expectedSkills: exact ? [skill] : type === "written" ? [skill, "vocabulary", "grammar", "sentence_formation"] : type === "practical" ? [skill, "conversational_response", "spoken_expression", "vocabulary", "grammar", "sentence_formation"] : [skill, "vocabulary", "grammar", "sentence_formation"],
    } as Item;
  });
}).flat();
export function getItem(id: string): Item { const item = items.find(i => i.id === id); if (!item) throw new Error("Unknown assessment item"); return item; }
