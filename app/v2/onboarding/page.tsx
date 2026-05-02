import {
  Onboarding,
  HomeFriendly,
  HomeMinimal,
  HomeProfessional,
  HomeEditorial,
  HomeDarkSport,
  HomeColorfield,
} from "../_components/screens/home";

interface SP {
  searchParams: Promise<{ style?: string }>;
}

export default async function OnboardingPage({ searchParams }: SP) {
  const { style } = await searchParams;
  switch (style) {
    case "friendly":
      return <HomeFriendly />;
    case "minimal":
      return <HomeMinimal />;
    case "professional":
      return <HomeProfessional />;
    case "editorial":
      return <HomeEditorial />;
    case "darksport":
      return <HomeDarkSport />;
    case "colorfield":
      return <HomeColorfield />;
    default:
      return <Onboarding />;
  }
}
