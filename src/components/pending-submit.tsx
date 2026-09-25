"use client";
import { useFormStatus } from "react-dom";
import { useT } from "@/lib/i18n/client";
export function PendingSubmit({children}:{children:React.ReactNode}){const {pending}=useFormStatus();const t=useT();return <button disabled={pending} aria-busy={pending} type="submit">{pending?t("Working…"):children}</button>;}
