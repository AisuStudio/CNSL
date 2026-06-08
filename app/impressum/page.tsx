import type { Metadata } from "next";
import LegalArticle, { LegalSection, LegalLangDivider } from "@/components/LegalArticle";

export const metadata: Metadata = {
  title: "Impressum — CNSL",
};

const ADDRESS = (
  <>
    Dominik Heilig
    <br />
    c/o Working
    <br />
    Manteuffelstraße 58
    <br />
    10999 Berlin
    <br />
    Germany
  </>
);

export default function ImpressumPage() {
  return (
    <LegalArticle title="Impressum / Legal Notice">
      {/* ── Deutsch ── */}
      <LegalSection title="Angaben gemäß § 5 DDG" paras={[ADDRESS]} />
      <LegalSection
        title="Kontakt"
        paras={[<>E-Mail: CNSL@aisu.studio</>]}
      />
      <LegalSection
        title="Hinweis"
        paras={[
          'CNSL ist ein nicht-kommerzielles, privat betriebenes Beta-Projekt einer Privatperson, die unter dem Namen „Aisu.Studio" auftritt. Es steht keine Firma oder Organisation dahinter. Eine Umsatzsteuer-Identifikationsnummer besteht nicht (Privatperson).',
        ]}
      />
      <LegalSection
        title="Haftung für Inhalte"
        paras={[
          "Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Wir sind nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben unberührt.",
        ]}
      />
      <LegalSection
        title="Haftung für Links"
        paras={[
          "Unser Angebot kann Links zu externen Websites Dritter enthalten, auf deren Inhalte wir keinen Einfluss haben. Für diese fremden Inhalte können wir keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich.",
        ]}
      />
      <LegalSection
        title="Datenschutz"
        paras={[
          "Informationen zur Verarbeitung personenbezogener Daten findest du in unserer Datenschutzerklärung.",
        ]}
      />

      <LegalLangDivider label="English" />

      {/* ── English ── */}
      <LegalSection title="Information pursuant to § 5 DDG" paras={[ADDRESS]} />
      <LegalSection title="Contact" paras={[<>Email: CNSL@aisu.studio</>]} />
      <LegalSection
        title="Note"
        paras={[
          'CNSL is a non-commercial, privately run beta project operated by a private individual under the name "Aisu.Studio". There is no company or organisation behind it. No VAT identification number exists (private individual).',
        ]}
      />
      <LegalSection
        title="Liability for Content"
        paras={[
          "As a service provider, we are responsible for our own content on these pages under the general laws. We are not obliged to monitor transmitted or stored third-party information or to investigate circumstances that indicate illegal activity. Obligations to remove or block the use of information under the general laws remain unaffected.",
        ]}
      />
      <LegalSection
        title="Liability for Links"
        paras={[
          "Our offering may contain links to external third-party websites over whose content we have no influence. We cannot accept any liability for this third-party content. The respective provider or operator of the linked pages is always responsible for their content.",
        ]}
      />
      <LegalSection
        title="Privacy"
        paras={[
          "Information on the processing of personal data can be found in our Privacy Policy.",
        ]}
      />
    </LegalArticle>
  );
}
