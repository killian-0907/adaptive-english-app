import catalog from "./catalog.json";
export const languages=["en","zh","es"] as const;
export type Language=typeof languages[number];
export function language(value:unknown):Language{return value==="zh"||value==="es"?value:"en";}
export type Catalog=Record<string,{en:string;zh?:string;es?:string}>;
export const messages:Catalog=catalog;
const byEnglish=new Map(Object.entries(messages).map(([key,value])=>[value.en,key]));
export function translate(locale:Language,key:string,values:Record<string,string|number>={},source:Catalog=messages){
  let entry=source[key]??source[byEnglish.get(key)??""];
  if(!entry&&source===messages&&locale!=="en"){for(const candidate of Object.values(messages)){if(!candidate.en.includes("{"))continue;const names:string[]=[];const pattern=candidate.en.split(/(\{\w+\})/).map(part=>{if(/^\{\w+\}$/.test(part)){names.push(part.slice(1,-1));return "(.+?)";}return part.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}).join("");const match=key.match(new RegExp("^"+pattern+"$"));if(match){entry=candidate;values={...values,...Object.fromEntries(names.map((name,i)=>[name,name==="skill"?translate(locale,match[i+1][0].toUpperCase()+match[i+1].slice(1)):match[i+1]]))};break;}}}
  const value=entry?.[locale]||entry?.en||key;
  return value.replace(/\{(\w+)\}/g,(_,name)=>String(values[name]??`{${name}}`));
}
export function missingTranslations(source:Catalog=messages){return Object.entries(source).flatMap(([key,v])=>languages.filter(lang=>!v[lang]).map(lang=>`${lang}:${key}`));}
