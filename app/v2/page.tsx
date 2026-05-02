import { HomeFriendly } from "./_components/screens/home";
import { getV2HomeData } from "./_lib/queries";

export default async function V2HomePage() {
  const { user, featuredProducts, categories, ongoingOrder } =
    await getV2HomeData();
  return (
    <HomeFriendly
      user={user}
      featuredProducts={featuredProducts}
      categories={categories}
      ongoingOrder={ongoingOrder}
    />
  );
}
