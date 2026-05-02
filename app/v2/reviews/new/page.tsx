import { ReviewPrompt } from "../../_components/screens/account";
import { getV2ProductDetail } from "../../_lib/queries";

interface SP {
  searchParams: Promise<{ productId?: string; orderId?: string }>;
}

export default async function V2ReviewPage({ searchParams }: SP) {
  const { productId, orderId } = await searchParams;
  let product = null;
  if (productId) {
    const p = await getV2ProductDetail(productId);
    if (p) {
      product = {
        id: p.id,
        title: p.title,
        thumbnail: p.primaryImage,
      };
    }
  }
  return <ReviewPrompt product={product} orderId={orderId ?? null} />;
}
