import type { Metadata } from "next";
import LegalArticle, { LegalSection } from "@/components/LegalArticle";

export const metadata: Metadata = {
  title: "The Story — CNSL",
};

// Verbatim from the author's RTF (CNSL_Documentation.rtf) — do not edit the copy.
// Same architecture as the legal pages (LegalArticle + LegalSection).
const para: React.CSSProperties = { margin: "0 0 12px" };
const linkStyle: React.CSSProperties = {
  color: "var(--color-accent)",
  textDecoration: "underline",
  wordBreak: "break-word",
};

// Full-width article image.
function StoryFigure({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      style={{
        display: "block",
        width: "100%",
        height: "auto",
        borderRadius: "var(--radius-container)",
        border: "1px solid var(--color-border)",
        margin: "8px 0 24px",
      }}
    />
  );
}

export default function StoryPage() {
  return (
    <LegalArticle title="20 years of the wrong digital planners. So I built my own — CNSL">
      <StoryFigure src="/article/CNSL_Website_Functions.png" alt="CNSL — features" />

      <p style={para}>
        For ~20 years I searched for the one tool to track tasks, time and notes
        across work, family and life — none ever fit. So over the past weeks I built
        my own: CNSL, a multi-domain &quot;console&quot;, with Claude Code — and
        shipped it to a public beta. Below is the honest build log: the vision, the
        scoping calls, the stack, the bugs, and the design.
      </p>

      <p style={{ ...para, fontWeight: 700, margin: "16px 0 6px" }}>TL;DR</p>
      <ul style={{ margin: "0 0 16px", paddingLeft: "1.2em" }}>
        <li style={{ margin: "0 0 8px" }}>
          <strong>Product sense from real need</strong> A validated problem, then
          ruthless scope (Phase 1 ships browser-only, no backend, no accounts).
        </li>
        <li style={{ margin: "0 0 8px" }}>
          <strong>End-to-end maker</strong> Product + UX &amp; design system +
          frontend + DB/infra (Next.js · Supabase · Vercel · GitHub).
        </li>
        <li style={{ margin: "0 0 8px" }}>
          <strong>AI-native workflow</strong> Scoping, triaging and prioritising a
          whole roadmap with Claude Code — including the app exporting itself so
          Claude can review its own backlog.
        </li>
        <li style={{ margin: "0 0 8px" }}>
          Ship → use → iterate — daily dogfooding, real-user feedback going straight
          into production.
        </li>
        <li style={{ margin: "0 0 8px" }}>
          Craft — screens built pixel-precise from design specs; a solid design-token
          foundation made a full restyle cheap.
        </li>
        <li style={{ margin: "0 0 8px" }}>Build in public, at near-zero budget.</li>
        <li style={{ margin: "0 0 8px" }}>Beta Link below</li>
      </ul>

      <p style={para}>
        Since about 2005 (before Google Suite) I&rsquo;d been looking for software to
        time-track freelance gigs, plan projects, note ideas, write songs or sketch
        out stories (I&rsquo;m also a graphic novelist — link below). Back then I had
        an HTC Apache and noted everything in MS Mobile Office. The keyboard was
        fantastically ergonomic. Word was enough for notes, but tracking or planning
        in Excel was a drag.
      </p>
      <p style={para}>
        Then the phone got stolen, and then the iPhone arrived, and Trello and Jira,
        and around 2014 I started using Tyme to track my personal and freelance
        projects. That was very close — but Tyme shifted to a subscription model.
        I&rsquo;d paid for the app upfront, and when they discontinued maintenance in
        late 2025, a replacement was needed.
      </p>
      <p style={para}>
        The Toggl app was way too packed with functions I didn&rsquo;t need, and it
        lacked others an one crucial detail: the badge for a running task when the app
        is closed. I forgot to turn it off too many times while testing and had to
        recalculate. Some people told me it happens to them as well — still!
      </p>
      <p style={{ ...para, marginBottom: "24px" }}>
        The app stayed in my mind and grew in functionality as technology and
        infrastructure developed. Finally, with Claude Code under my fingertips, I
        started building it myself recently — and I&rsquo;ve used it every day since.
        Even this text is written in the Notes section of CNSL.
      </p>

      <p style={{ fontWeight: 700, fontSize: "var(--text-logo)", margin: "0 0 12px" }}>
        My process so far in 12 quick steps
      </p>
      <StoryFigure src="/article/CNSL_Website_Prototype.png" alt="The first CNSL prototype" />

      <LegalSection
        title="1) Idea:"
        paras={[
          "I started bouncing the whole idea off Claude first — all the tools beyond the tracker (Notes, a Scheduler for recurring fitness or workshop plans, Calendar and more). On top of that syncing across devices and a progressive web app (PWA) for mobile was a requirement too. All to figure out the final tech stack and infrastructure at low or no extra cost (besides Claude Max).",
        ]}
      />
      <LegalSection
        title="2) First prototype / Built fast & break necks (so fast):"
        paras={[
          "After rough scoping, Claude suggested building a local shell prototype. I quickly sketched the layout with some basic design I had in my head and — bam — there it was. The first functions already worked perfectly. I named it CNSL — short for Console, the name I'd had in mind since 2005.",
        ]}
      />
      <LegalSection
        title="3) The first other tool, the Blurp Console:"
        paras={[
          "Until then I'd scattered every quick thought across random tools — email, messaging myself, mostly Apple Notes — depending on the kind of content and complexity. So I built the Blurp Console: an entry field to quickly collect thoughts, ideas and todos you want to sort out later. In the Log view you can assign each blurp to a project and topic, and groom it if needed.",
        ]}
      />
      <LegalSection
        title="4) First iterations & testing:"
        paras={[
          "Since it worked well, I started using it right away, threw things into my own pipeline, and added new useful functions and views.",
        ]}
      />
      <LegalSection
        title="5) Next tool:"
        paras={[
          "I asked Claude to sketch a very basic rich-text editor to feel out what having more tools in the app would be like. It went well, and we refined the first details like text formatting.",
        ]}
      />
      <LegalSection
        title="6) Going live / the database:"
        paras={[
          "While local, CNSL still used browser storage. But since I wanted others to use it and to sync across devices on the web, we went with Supabase + Vercel as host, all through GitHub.",
        ]}
      />
      <LegalSection
        title="7) The production pipeline:"
        paras={[
          "Naturally I threw every idea into the app, into a dedicated CNSL Project, and wanted a way to get them back into Claude for validation, scoping and so on — without MCP first. Claude suggested a complete MD export; I decided to scope it down to project level, so the rest (shopping lists, birthday-gift lists, the usual) stays out. Signal versus noise. Here a new level of dopeness kicked in! Claude triaged quick wins (swap an icon) and bigger tasks (autofill, clean up design tokens). Since the tasks already have id-numbers, prioritising and merging them was easy. An MCP server with cron jobs and automation is on the roadmap. Even simple roadmapping is on the roadmap.",
        ]}
      />
      <LegalSection
        title="8) The first hiccups:"
        paras={[
          "Running CNSL on desktop and phone at once really sweet :-) — but suddenly syncing wasn't there yet. After some refactoring and adding Supabase Realtime, the data settled and things ran smoother.",
          "Some data was lost along the way; luckily we found a backup in local storage. Now there's a backup on Supabase and in CNSL too.",
        ]}
      />
      <LegalSection
        title="10) New users & first feedback:"
        paras={[
          "Before onboarding anyone, we built a landing page and a login — and solved a few more hiccups around registration. Once that was tight, my first couple of friends started using it. I was ready for feedback, and some of it went straight into production.",
          "Inbetween I started to use Claude Code from my phone, and was able to review and change issues on the go via GitHub. That felt quite invigorating.",
        ]}
      />
      <StoryFigure src="/article/CNSL_Website_Design_1.png" alt="The CNSL design" />
      <LegalSection
        title={'11) The first "real" design:'}
        paras={[
          "With everything working, it was time to polish. Long story short: since Figma's SVG export is useless for type (it outlines the text), I went back to Illustrator — type styles and colours dropped right in. I drew more icons, weeded out colors to make it neat and tidy.",
        ]}
      />
      <LegalSection
        title={'12) The second "real" design:'}
        paras={[
          "A couple days laterstumbled on a design I'd made a year ago in Figma (yes, I'd been tinkering on this in the background now and then) — and I liked the old design much better. So I asked Claude how much effort it'd be to restyle everything to that old-new design. Because the design-token foundation was already solid, it didn't take long.",
        ]}
      />
      <StoryFigure src="/article/CNSL_Website_Notepad.png" alt="The CNSL Note Pad" />

      <p style={para}>
        And here it is — for free — the first public beta, with a view on the Notepad:
      </p>
      <p style={para}>
        <a href="https://cnsl.aisu.studio" style={linkStyle}>https://cnsl.aisu.studio</a>
        {"   Beta access code: LocalHorst:3000"}
      </p>
      <p style={para}>There&rsquo;s more in the near-term pipeline:</p>
      <p style={para}>
        Calendar, deadlines, sharing, and the scheduling tool mentioned earlier, and
        more useful stuff and polishing.
      </p>
      <p style={para}>Feel free to send feedback or suggestions.</p>
      <p style={para}>And here&rsquo;s my Graphic Novel Link</p>
      <p style={para}>
        A scientific, journalistic action story about a real incident in the field of
        Climate Change research and decolonising Science
      </p>
      <p style={para}>
        <a href="https://www.aisu.studio/fotl" style={linkStyle}>https://www.aisu.studio/fotl</a>
      </p>
      <p style={{ ...para, color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
        #BuildInPublic #ProductManagement #ClaudeCode #prototyping #digitalProduct
        #RapidPrototyping
      </p>
    </LegalArticle>
  );
}
