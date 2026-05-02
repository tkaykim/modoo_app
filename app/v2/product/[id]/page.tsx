import { notFound } from "next/navigation";
import { ProductDetail } from "../../_components/screens/shop";
import { getV2ProductDetail } from "../../_lib/queries";

interface Params {
  params: Promise<{ id: string }>;
}

export default async function V2ProductPage({ params }: Params) {
  const { id } = await params;
  const product = await getV2ProductDetail(id);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
