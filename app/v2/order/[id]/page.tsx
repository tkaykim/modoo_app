import { Tracking } from "../../_components/screens/flow";
import { getV2Order } from "../../_lib/queries";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ track?: string }>;
}

export default async function V2OrderPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { track } = await searchParams;
  const style =
    track === "horizontal" || track === "map" ? track : "vertical";
  const order = await getV2Order(id);
  return <Tracking style={style} order={order} />;
}
