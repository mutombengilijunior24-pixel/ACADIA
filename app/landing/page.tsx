import { redirect } from "next/navigation";

// P13 — la landing vit désormais à la racine (/). Cette route est
// conservée pour ne pas casser un lien existant vers /landing.
export default function LandingRedirect() {
  redirect("/");
}
