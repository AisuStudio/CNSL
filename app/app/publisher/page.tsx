import PublisherView from "@/components/PublisherView";

export const metadata = { title: "Publisher · CNSL" };

export default function PublisherPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--color-bg)",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-family)",
      }}
    >
      <PublisherView />
    </main>
  );
}
