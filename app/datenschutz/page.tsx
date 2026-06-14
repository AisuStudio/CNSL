import type { Metadata } from "next";
import LegalArticle, { LegalSection, LegalLangDivider } from "@/components/LegalArticle";

export const metadata: Metadata = {
  title: "Datenschutzerklärung — CNSL",
};

const CONTROLLER = (
  <>
    Dominik Heilig, c/o Working, Manteuffelstraße 58, 10999 Berlin, Germany.
    <br />
    E-Mail: CNSL@aisu.studio
  </>
);

export default function DatenschutzPage() {
  return (
    <LegalArticle
      title="Datenschutzerklärung / Privacy Policy"
      subtitle="Stand / Last updated: 8 June 2026 · Beta"
    >
      {/* ── Deutsch ── */}
      <LegalSection title="1. Verantwortlicher" paras={[CONTROLLER]} />
      <LegalSection
        title="2. Überblick"
        paras={[
          "CNSL ist ein privat betriebenes Beta-Projekt zur Aufgabenverwaltung. Wir verarbeiten so wenige personenbezogene Daten wie möglich. Es findet kein Tracking statt, es gibt keine Werbung und keine Weitergabe deiner Daten zu Werbezwecken.",
        ]}
      />
      <LegalSection
        title="3. Welche Daten wir verarbeiten"
        paras={[
          "Kontodaten: deine E-Mail-Adresse und ein verschlüsselt (gehasht) gespeichertes Passwort, um dein Konto bereitzustellen und dich anzumelden.",
          "Inhaltsdaten: die von dir in der App erstellten Inhalte – Aufgaben, Notizen, Log-Einträge und Zeiterfassung.",
          "Server-Logdaten: beim Aufruf der Anwendung technisch übermittelte Daten (z. B. IP-Adresse, Zeitpunkt, Browsertyp), die der Hosting-Anbieter verarbeitet.",
          "Lokale Speicherung: im rein clientseitigen Modus werden deine Inhalte unter dem Schlüssel „cnsl.v1\" lokal in deinem Browser (localStorage) gespeichert und verlassen dein Gerät nicht.",
        ]}
      />
      <LegalSection
        title="4. Zwecke und Rechtsgrundlagen"
        paras={[
          "Bereitstellung von Konto und Dienst: Art. 6 Abs. 1 lit. b DSGVO (Nutzungsverhältnis im Rahmen der Beta).",
          "Sicherheit, Stabilität und Missbrauchsvermeidung (insb. Server-Logs): Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren Betrieb).",
        ]}
      />
      <LegalSection
        title="5. Hosting (Vercel)"
        paras={[
          "Die Anwendung wird bei Vercel Inc. gehostet (Auftragsverarbeiter). Der Serverstandort liegt in der EU; das Unternehmen hat seinen Sitz in den USA. Soweit dabei Daten in die USA übermittelt werden, erfolgt dies auf Grundlage geeigneter Garantien (EU-Standardvertragsklauseln bzw. EU-US Data Privacy Framework).",
        ]}
      />
      <LegalSection
        title="6. Datenbank und Authentifizierung (Supabase)"
        paras={[
          "Konto- und Inhaltsdaten werden bei Supabase (Auftragsverarbeiter) in einer Region innerhalb der EU gespeichert. Das Unternehmen hat seinen Sitz in den USA; etwaige Übermittlungen erfolgen auf Grundlage geeigneter Garantien wie oben.",
        ]}
      />
      <LegalSection
        title="7. Cookies"
        paras={[
          "Wir verwenden ausschließlich technisch notwendige Cookies, insbesondere ein Anmelde-/Session-Cookie, um dich eingeloggt zu halten. Es werden keine Analyse-, Tracking- oder Werbe-Cookies gesetzt; daher ist kein Einwilligungsbanner erforderlich.",
        ]}
      />
      <LegalSection
        title="8. Schriftarten"
        paras={[
          "Schriftarten werden lokal von unserem Server ausgeliefert (selbst gehostet). Es werden keine externen Dienste wie Google Fonts eingebunden; deine IP-Adresse wird hierfür nicht an Dritte übermittelt.",
        ]}
      />
      <LegalSection
        title="9. Keine Analyse, kein Tracking"
        paras={[
          "Wir nutzen keine Webanalyse, kein Profiling und keine Werbenetzwerke.",
        ]}
      />
      <LegalSection
        title="10. Speicherdauer"
        paras={[
          "Kontodaten werden gespeichert, bis du dein Konto löschst (jederzeit selbst über Einstellungen → „Delete account“) oder die Beta endet. Bei einer Löschung werden alle deine Inhalte sofort aus der Live-Datenbank entfernt; aus unseren verschlüsselten Sicherungskopien werden sie im Zuge der regelmäßigen Backup-Rotation spätestens innerhalb von 30 Tagen entfernt. Server-Logs werden nur kurzfristig vorgehalten. Hinweis: Während der Beta können Daten zurückgesetzt oder gelöscht werden – bitte sichere wichtige Inhalte über die Exportfunktion (Einstellungen → „Download my data“).",
        ]}
      />
      <LegalSection
        title="11. Deine Rechte"
        paras={[
          "Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO). Löschung und Datenexport kannst du jederzeit selbst in den Einstellungen auslösen („Delete account“ bzw. „Download my data“); für alle weiteren Anliegen wende dich an CNSL@aisu.studio.",
        ]}
      />
      <LegalSection
        title="12. Beschwerderecht"
        paras={[
          "Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren, z. B. der Berliner Beauftragten für Datenschutz und Informationsfreiheit (BlnBDI).",
        ]}
      />
      <LegalSection
        title="13. Änderungen"
        paras={[
          "Wir können diese Datenschutzerklärung anpassen. Es gilt jeweils die hier veröffentlichte Fassung.",
        ]}
      />

      <LegalLangDivider label="English" />

      {/* ── English ── */}
      <LegalSection title="1. Controller" paras={[CONTROLLER]} />
      <LegalSection
        title="2. Overview"
        paras={[
          "CNSL is a privately run beta project for task management. We process as little personal data as possible. There is no tracking, no advertising, and no sharing of your data for advertising purposes.",
        ]}
      />
      <LegalSection
        title="3. What data we process"
        paras={[
          "Account data: your email address and a hashed (encrypted) password, used to provide your account and sign you in.",
          "Content data: the content you create in the app — tasks, notes, log entries, and time tracking.",
          "Server log data: data transmitted for technical reasons when the app is accessed (e.g. IP address, timestamp, browser type), processed by the hosting provider.",
          'Local storage: in client-only mode, your content is stored locally in your browser (localStorage) under the key "cnsl.v1" and does not leave your device.',
        ]}
      />
      <LegalSection
        title="4. Purposes and legal bases"
        paras={[
          "Providing the account and service: Art. 6(1)(b) GDPR (use relationship during the beta).",
          "Security, stability, and abuse prevention (in particular server logs): Art. 6(1)(f) GDPR (legitimate interest in secure operation).",
        ]}
      />
      <LegalSection
        title="5. Hosting (Vercel)"
        paras={[
          "The application is hosted by Vercel Inc. (processor). The server location is in the EU; the company is based in the USA. Where data is transferred to the USA, this is based on appropriate safeguards (EU Standard Contractual Clauses / EU-US Data Privacy Framework).",
        ]}
      />
      <LegalSection
        title="6. Database and authentication (Supabase)"
        paras={[
          "Account and content data are stored with Supabase (processor) in a region within the EU. The company is based in the USA; any transfers are based on appropriate safeguards as above.",
        ]}
      />
      <LegalSection
        title="7. Cookies"
        paras={[
          "We use only strictly necessary cookies, in particular a login/session cookie to keep you signed in. No analytics, tracking, or advertising cookies are set; therefore no consent banner is required.",
        ]}
      />
      <LegalSection
        title="8. Fonts"
        paras={[
          "Fonts are served locally from our own server (self-hosted). No external services such as Google Fonts are used; your IP address is not transmitted to third parties for this purpose.",
        ]}
      />
      <LegalSection
        title="9. No analytics, no tracking"
        paras={["We do not use web analytics, profiling, or advertising networks."]}
      />
      <LegalSection
        title="10. Retention"
        paras={[
          "Account data is stored until you delete your account (anytime yourself via Settings → “Delete account”) or until the beta ends. On deletion, all your content is removed from the live database immediately; it is purged from our encrypted backups as part of regular backup rotation, at the latest within 30 days. Server logs are kept only for a short period. Note: during the beta, data may be reset or deleted at any time — please back up important content via the export function (Settings → “Download my data”).",
        ]}
      />
      <LegalSection
        title="11. Your rights"
        paras={[
          "You have the right to access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20), and objection (Art. 21 GDPR). You can trigger erasure and data export yourself anytime in Settings (“Delete account” / “Download my data”); for anything else, contact CNSL@aisu.studio.",
        ]}
      />
      <LegalSection
        title="12. Right to lodge a complaint"
        paras={[
          "You may lodge a complaint with a data protection supervisory authority, e.g. the Berlin Commissioner for Data Protection and Freedom of Information (BlnBDI).",
        ]}
      />
      <LegalSection
        title="13. Changes"
        paras={[
          "We may update this Privacy Policy. The version published here applies in each case.",
        ]}
      />
    </LegalArticle>
  );
}
