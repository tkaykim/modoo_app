import { Catalog } from "../_components/screens/shop";
import { getV2CatalogProducts, getV2Categories } from "../_lib/queries";

interface SP {
  searchParams: Promise<{ category?: string }>;
}

export default async function V2MallPage({ searchParams }: SP) {
  const { category } = await searchParams;
  const [products, categories] = await Promise.all([
    getV2CatalogProducts(),
    getV2Categories(),
  ]);
  return (
    <Catalog
      products={products}
      categories={categories}
      selectedCategory={category ?? "all"}
    />
  );
}
