import DhlQuickQuoteModal from "../components/DhlQuickQuoteModal";

export default function DhlQuickQuotePage() {
  return (
    <DhlQuickQuoteModal
      embedded
      onboarding={{ origem: "Rio de Janeiro", cep: "", cidade: "" }}
    />
  );
}
