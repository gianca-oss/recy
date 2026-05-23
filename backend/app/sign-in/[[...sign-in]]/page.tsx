import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <SignIn />
    </main>
  );
}
