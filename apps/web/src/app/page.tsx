import { redirect } from "next/navigation";

// Root redirects to the dashboard; middleware will redirect to /login if not authed.
export default function Home() {
  redirect("/dashboard");
}
