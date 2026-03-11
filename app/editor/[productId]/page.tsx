import { createClient } from "@/lib/supabase";
import { Product, PrintMethodRecord } from "@/types/types";
import { notFound } from "next/navigation";
import ProductEditorClient from "./ProductEditorClient";
import ProductEditorClientDesktop from "./ProductEditorClientDesktop";
import { headers } from "next/headers";

interface PageProps {
  params: Promise<{
    productId: string;
  }>;
}

export default async function ProductEditorPage({ params }: PageProps) {
  const { productId } = await params;
  const supabase = await createClient();
  const userAgent = (await headers()).get('user-agent') || '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  const { data: productData, error } = await supabase
    .from('products')
    .select(`
      *,
      manufacturers (
        name
      )
    `)
    .eq('id', productId)
    .eq('is_active', true)
    .single();

  // Extract manufacturer name from joined data
  const product = productData ? {
    ...productData,
    manufacturer_name: productData.manufacturers?.name ?? null,
  } : null;

  if (error || !product) {
    notFound();
  }

  // Fetch all active print methods + product's linked ones
  const [{ data: allPrintMethodsData }, { data: productPrintMethodsData }] = await Promise.all([
    supabase.from('print_methods').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
    supabase.from('product_print_methods').select('print_method_id').eq('product_id', productId),
  ]);

  const allPrintMethods: PrintMethodRecord[] = (allPrintMethodsData || []) as PrintMethodRecord[];
  const enabledPrintMethodIds = new Set((productPrintMethodsData || []).map((r: any) => r.print_method_id));

  return isMobile
    ? <ProductEditorClient product={product as Product} allPrintMethods={allPrintMethods} enabledPrintMethodIds={enabledPrintMethodIds} />
    : <ProductEditorClientDesktop product={product as Product} allPrintMethods={allPrintMethods} enabledPrintMethodIds={enabledPrintMethodIds} />;
}
