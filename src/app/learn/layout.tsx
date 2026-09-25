import { productIdentity } from "@/server/services/product";
import { ProductNav } from "@/components/product-nav";
export default async function Layout({children}:{children:React.ReactNode}){const user=await productIdentity(true);return <div className="learning-product-shell"><ProductNav language={user.language}/>{children}</div>;}
