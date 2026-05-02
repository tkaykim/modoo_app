import { MyPage } from "../_components/screens/account";
import {
  getV2CurrentUser,
  getV2UserStats,
  getV2InProgressOrders,
  getV2UserDesigns,
} from "../_lib/queries";

export default async function V2MyPage() {
  const user = await getV2CurrentUser();
  if (!user) {
    return <MyPage user={null} />;
  }
  const [stats, inProgressOrders, designs] = await Promise.all([
    getV2UserStats(user.id),
    getV2InProgressOrders(user.id),
    getV2UserDesigns(user.id),
  ]);
  return (
    <MyPage
      user={user}
      stats={stats}
      inProgressOrders={inProgressOrders}
      designs={designs}
    />
  );
}
