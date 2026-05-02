import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase";
import { Product, PrintMethodRecord } from "@/types/types";
import ProductEditorUnified from "@/app/editor/[productId]/ProductEditorUnified";
import "./editor-overrides.css";
import {
  PrintMethod,
  EditorEmpty,
  EditorTemplates,
  EditorAIModal,
  EditorAIResults,
  EditorUpload,
  EditorTextPanel,
  EditorLayers,
  EditorWarning,
  EditorPreview,
  EditorSaving,
} from "../../_components/screens/editor";

interface Params {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ scenario?: string }>;
}

export default async function V2EditorPage({ params, searchParams }: Params) {
  const { productId } = await params;
  const { scenario } = await searchParams;

  // Design-reference scenarios (for showcase QA) — stay as v2 mock screens.
  switch (scenario) {
    case "print-method":
      return <PrintMethod />;
    case "empty":
      return <EditorEmpty />;
    case "templates":
      return <EditorTemplates />;
    case "ai-prompt":
      return <EditorAIModal />;
    case "ai-results":
      return <EditorAIResults />;
    case "upload":
      return <EditorUpload />;
    case "text-panel":
      return <EditorTextPanel />;
    case "layers":
      return <EditorLayers />;
    case "warning":
      return <EditorWarning />;
    case "preview":
      return <EditorPreview />;
    case "saving":
      return <EditorSaving />;
  }

  // Default: full functional editor — reuse the existing prod canvas verbatim.
  // Mirrors app/editor/[productId]/page.tsx data loading.
  const supabase = await createClient();
  const userAgent = (await headers()).get("user-agent") || "";
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent
    );

  const { data: productData, error } = await supabase
    .from("products")
    .select(
      `
      *,
      manufacturers (
        name
      )
    `
    )
    .eq("id", productId)
    .eq("is_active", true)
    .single();

  const product = productData
    ? {
        ...productData,
        manufacturer_name: productData.manufacturers?.name ?? null,
      }
    : null;

  if (error || !product) {
    notFound();
  }

  const [{ data: allPrintMethodsData }, { data: productPrintMethodsData }] =
    await Promise.all([
      supabase
        .from("print_methods")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("product_print_methods")
        .select("print_method_id")
        .eq("product_id", productId),
    ]);

  const allPrintMethods: PrintMethodRecord[] =
    (allPrintMethodsData || []) as PrintMethodRecord[];
  const enabledPrintMethodIds = new Set(
    (productPrintMethodsData || []).map(
      (r: { print_method_id: string }) => r.print_method_id
    )
  );

  // Escape v2 layout's max-width:480 wrapper so the existing editor renders
  // at full viewport width (matches /editor/[productId] behavior exactly).
  return (
    <div
      className="v2-editor-shell"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#fafaf7",
        overflow: "auto",
      }}
    >
      <ProductEditorUnified
        product={product as Product}
        allPrintMethods={allPrintMethods}
        enabledPrintMethodIds={enabledPrintMethodIds}
        isMobile={isMobile}
      />
    </div>
  );
}
