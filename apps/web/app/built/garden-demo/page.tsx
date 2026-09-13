import { CommunityProjects } from "@/components/CommunityProjects";
import { ExplorePage, LinkButton } from "@/components/explore/ExplorePage";
export const metadata = {
  title: "From a shared idea to a shared harvest",
  description:
    "A reproducible scripted engine scenario: neighbors exchange experience, contribute and grow food. Separate from the live island.",
};
export default function GardenDemo() {
  return (
    <ExplorePage
      eyebrow="Recorded garden scenario"
      title="From an idea to a shared harvest."
      description="A scripted engine demonstration of neighbors exchanging experience, contributing, and growing food. This is separate from the live island."
      art="/harbor/orchard.png"
    >
      <div>
        <LinkButton href="/built" kind="secondary">
          Back to the live projects ↗
        </LinkButton>
      </div>
      <CommunityProjects demo embedded />
    </ExplorePage>
  );
}
