import { AskChat } from "@/lib/ui/ask/chat";

export const metadata = {
  title: "Ask — Far Country",
};

export default function AskPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Ask</h1>
        <p className="text-sm text-(--color-fg-muted)">
          Grounded Q&amp;A over the canonical dataset. Every answer cites the
          descriptors it draws on. Symbolic and debated material is flagged so
          you can see what kind of claim it is.
        </p>
      </header>

      <AskChat />
    </div>
  );
}
