"use client";
import { useEffect, useState } from "react";
export function useDraft(activityId:string|undefined){const [text,setText]=useState("");const key=`learning-draft:${activityId}`;useEffect(()=>{
  // Restore only this activity's draft after hydration, including after re-authentication.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  try{setText(sessionStorage.getItem(key)??"");}catch{}
},[key]);return [text,(value:string)=>{setText(value);try{sessionStorage.setItem(key,value);}catch{}}] as const;}
