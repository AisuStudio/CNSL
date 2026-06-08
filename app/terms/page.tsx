import type { Metadata } from "next";
import Link from "next/link";
import LegalArticle, { LegalSection } from "@/components/LegalArticle";

export const metadata: Metadata = {
  title: "Beta Terms & Conditions — CNSL",
};

const LAST_UPDATED = "8 June 2026";

// Single source of truth for the beta EULA. Rendered here and linked from the
// login page's acceptance checkbox. Keep wording in sync with any printed copy.
const SECTIONS: { title: string; paras: React.ReactNode[] }[] = [
  {
    title: "1. Provider",
    paras: [
      'The Service is operated by Dominik Heilig, a private individual operating under the name "Aisu.Studio", c/o Working, Manteuffelstraße 58, 10999 Berlin, Germany. Contact: CNSL@aisu.studio. CNSL is a non-commercial, privately run beta project — there is no company or organisation behind it.',
    ],
  },
  {
    title: "2. Eligibility & Acceptance",
    paras: [
      "You must be at least 16 years old (or the age required for valid consent in your country) to use the Service. By creating an account or entering a beta access code, you accept these Terms.",
    ],
  },
  {
    title: "3. Beta Nature — No Warranty of Availability or Data Retention",
    paras: [
      "The Service is a pre-release beta provided for testing and evaluation. It may contain bugs, change, be interrupted, or be discontinued at any time without notice. We do not guarantee availability, uptime, or that your data will be preserved. Your data may be lost, corrupted, or reset at any time. You are responsible for keeping your own backups (e.g. via the export function).",
    ],
  },
  {
    title: "4. License",
    paras: [
      "We grant you a limited, personal, non-exclusive, non-transferable, revocable license to use the Service during the beta for your own internal or personal use. You may not sublicense, resell, or commercially exploit the Service.",
    ],
  },
  {
    title: "5. Beta Access",
    paras: [
      "Access may require an invitation or access code. Keep your access credentials confidential and do not share them. You are responsible for activity under your account.",
    ],
  },
  {
    title: "6. Acceptable Use",
    paras: [
      "You agree not to: (a) use the Service unlawfully or to store unlawful content; (b) reverse engineer, decompile, or attempt to extract source code, except where permitted by law; (c) disrupt, overload, or probe the Service or its infrastructure; (d) circumvent access controls or usage limits.",
    ],
  },
  {
    title: "7. Your Content",
    paras: [
      'You retain all rights to the content you create or upload ("Your Content"). You are solely responsible for it and confirm you have the rights to use it. You grant us the limited right to host and process Your Content only as needed to operate the Service. We may delete or reset data during the beta as described in Section 3.',
    ],
  },
  {
    title: "8. Privacy",
    paras: [
      <>
        We process personal data in accordance with applicable data protection
        law (GDPR). Please review our{" "}
        <Link
          href="/datenschutz"
          style={{ color: "var(--color-accent)", textDecoration: "underline" }}
        >
          Privacy Policy
        </Link>{" "}
        before using the Service.
      </>,
    ],
  },
  {
    title: "9. Feedback",
    paras: [
      "If you send feedback, suggestions, or bug reports, you grant us a perpetual, worldwide, royalty-free right to use them without obligation or compensation.",
    ],
  },
  {
    title: "10. Intellectual Property",
    paras: [
      "The Service, its software, design, and trademarks remain our exclusive property. These Terms grant no rights other than the limited license in Section 4.",
    ],
  },
  {
    title: "11. Disclaimer of Warranties",
    paras: [
      'To the maximum extent permitted by law, the Service is provided "AS IS" and "AS AVAILABLE", without warranties of any kind, whether express or implied, including fitness for a particular purpose, accuracy, reliability, or non-infringement.',
    ],
  },
  {
    title: "12. Limitation of Liability",
    paras: [
      "The Service is provided free of charge by a private individual on a non-commercial basis. We are liable without limitation for damages caused intentionally or by gross negligence, for injury to life, body, or health, and under the German Product Liability Act (Produkthaftungsgesetz). For slight negligence we are liable only for breach of an essential contractual obligation, limited to foreseeable, typical damages. Beyond that — in particular for data loss, lost profits, or indirect or consequential damages — any liability is excluded.",
    ],
  },
  {
    title: "13. Term & Termination",
    paras: [
      "These Terms apply for the duration of the beta. We may suspend or terminate your access, or end the beta, at any time and for any reason. You may stop using the Service at any time. Sections 7–12 survive termination.",
    ],
  },
  {
    title: "14. Changes",
    paras: [
      "We may update these Terms during the beta. Material changes will be communicated by reasonable means. Continued use after changes take effect constitutes acceptance.",
    ],
  },
  {
    title: "15. Governing Law & Jurisdiction",
    paras: [
      "These Terms are governed by the laws of the Federal Republic of Germany, excluding its conflict-of-law rules and the UN Convention on Contracts for the International Sale of Goods (CISG). To the extent permitted by law, the place of jurisdiction is Berlin, Germany. Mandatory consumer-protection rights of your country of residence remain unaffected.",
    ],
  },
  {
    title: "16. Contact",
    paras: ["Questions about these Terms: CNSL@aisu.studio."],
  },
];

export default function TermsPage() {
  return (
    <LegalArticle
      title="Beta Terms & Conditions / End User License Agreement (EULA)"
      subtitle={`Last updated: ${LAST_UPDATED} · Beta version`}
    >
      <p style={{ margin: "0 0 24px" }}>
        These Terms govern your access to and use of CNSL (the &quot;Service&quot;)
        during its beta phase. By accessing or using the Service, you agree to
        these Terms. If you do not agree, do not use the Service.
      </p>

      {SECTIONS.map((s) => (
        <LegalSection key={s.title} title={s.title} paras={s.paras} />
      ))}
    </LegalArticle>
  );
}
