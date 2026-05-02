import { OrderSuccess } from "../../../_components/screens/account";
import { getV2Order } from "../../../_lib/queries";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function V2OrderSuccessPage({ params }: Props) {
  const { id } = await params;
  const order = await getV2Order(id);
  return <OrderSuccess order={order} />;
}
