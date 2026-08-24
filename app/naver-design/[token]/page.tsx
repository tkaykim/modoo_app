import NaverDesignIntake from './NaverDesignIntake';

type PageProps = { params: Promise<{ token: string }> };

export default async function NaverDesignPage({ params }: PageProps) {
  const { token } = await params;
  return <NaverDesignIntake token={token} />;
}
