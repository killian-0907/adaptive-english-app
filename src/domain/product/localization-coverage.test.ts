import { readdirSync,readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { it,expect } from "vitest";
import { messages } from "../../lib/i18n/core";
it("major JSX surfaces do not add untranslated static text or missing catalog IDs",()=>{
  const failures:string[]=[];
  for(const root of ["src/app","src/components"]){for(const file of readdirSync(root,{recursive:true}).filter(f=>String(f).endsWith(".tsx"))){const path=join(root,String(file)),text=readFileSync(path,"utf8");const source=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    function walk(node:ts.Node){if(ts.isJsxText(node)){const value=node.text.trim();if(/[A-Za-z]{3}/.test(value)&&!["Adaptive English","UTC"].includes(value))failures.push(`${path}: ${value}`);}if(ts.isCallExpression(node)&&node.expression.getText(source)==="t"&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0])){const key=node.arguments[0].text;if(key.startsWith("ui.")&&!messages[key])failures.push(`${path}: ${key}`);}ts.forEachChild(node,walk);}walk(source);
  }}expect(failures).toEqual([]);
});
