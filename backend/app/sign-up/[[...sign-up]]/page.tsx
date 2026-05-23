import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 8,
      }}
    >
      <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 }}>
        Recy
      </h1>
      <p style={{ color: "#71717A", fontSize: 14, marginBottom: 18 }}>
        Crea il tuo account
      </p>
      <SignUp signInUrl="/sign-in" />
    </main>
  );
}
