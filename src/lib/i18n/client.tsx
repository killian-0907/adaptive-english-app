"use client";
import { createContext, useContext } from "react";
import { translate, language, type Language } from "./core";
const Locale=createContext<Language>("en");
export function LocaleProvider({language,children}:{language:Language;children:React.ReactNode}){return <Locale.Provider value={language}>{children}</Locale.Provider>;}
export function useLocale(){return useContext(Locale);}
export function useT(override?:string){const current=useContext(Locale);const locale=override?language(override):current;return (key:string|number|undefined,values?:Record<string,string|number>)=>translate(locale,String(key??""),values);}
export function LanguagePicker(){const locale=useContext(Locale);return <label className="language-picker">{translate(locale,"Display language")}<select aria-label={translate(locale,"Display language")} value={locale} onChange={async e=>{await fetch("/api/locale",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({language:e.target.value})});location.reload();}}><option value="en">English</option><option value="zh">中文</option><option value="es">Español</option></select></label>;}
