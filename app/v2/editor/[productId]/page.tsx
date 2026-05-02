import {
  Editor,
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
import { getV2ProductDetail } from "../../_lib/queries";

interface Params {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ scenario?: string }>;
}

export default async function V2EditorPage({ params, searchParams }: Params) {
  const { productId } = await params;
  const { scenario } = await searchParams;
  const product = await getV2ProductDetail(productId);

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
    default:
      return <Editor product={product} />;
  }
}
