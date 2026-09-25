import { productIdentity } from "@/server/services/product";
import { ProductShell } from "@/components/product-shell";
export default async function Layout({children}:{children:React.ReactNode}){const user=await productIdentity();return <ProductShell language={user.language}>{children}</ProductShell>;}
