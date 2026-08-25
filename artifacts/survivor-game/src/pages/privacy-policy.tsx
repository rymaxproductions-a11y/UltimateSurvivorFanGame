import { useEffect } from "react";
import { Link } from "wouter";

const LAST_UPDATED = "August 25, 2026";

function setMeta(selector: string, attribute: "name" | "property", value: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, value);
    document.head.appendChild(element);
  }
  return element;
}

export default function PrivacyPolicy() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Privacy Policy | Ultimate Survivor Fan Game";

    const description = setMeta('meta[name="description"]', "name", "description");
    const openGraphTitle = setMeta('meta[property="og:title"]', "property", "og:title");
    const openGraphDescription = setMeta(
      'meta[property="og:description"]',
      "property",
      "og:description",
    );
    const previousDescription = description.content;
    const previousOpenGraphTitle = openGraphTitle.content;
    const previousOpenGraphDescription = openGraphDescription.content;

    description.content =
      "How Ultimate Survivor Fan Game collects, uses, shares, and deletes player data.";
    openGraphTitle.content = "Privacy Policy | Ultimate Survivor Fan Game";
    openGraphDescription.content = description.content;

    return () => {
      document.title = previousTitle;
      description.content = previousDescription;
      openGraphTitle.content = previousOpenGraphTitle;
      openGraphDescription.content = previousOpenGraphDescription;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground sm:px-8">
      <article className="mx-auto max-w-3xl">
        <header className="border-b border-border pb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-3 text-sm font-semibold text-primary hover:underline"
          >
            <img
              src={`${import.meta.env.BASE_URL}logo-mark.png`}
              alt=""
              className="h-10 w-10 object-contain"
            />
            Ultimate Survivor Fan Game
          </Link>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Your data, explained
          </p>
          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Privacy Policy</h1>
          <p className="mt-4 text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>
        </header>

        <div className="prose prose-slate mt-8 max-w-none prose-headings:text-foreground prose-p:text-foreground/85 prose-li:text-foreground/85 prose-a:text-primary">
          <p>
            Ultimate Survivor Fan Game is a fan competition app where players join tribes,
            predict outcomes, earn scores, and compare rankings. This policy explains what
            information the app handles and the choices available to you.
          </p>

          <h2>Information we collect</h2>
          <ul>
            <li>
              <strong>Account information:</strong> your email address, username, display name,
              authentication identifier, role, and tribe membership.
            </li>
            <li>
              <strong>Gameplay information:</strong> season picks, episode answers, calculated
              scores, ranks, and participation history.
            </li>
            <li>
              <strong>Profile content:</strong> an optional profile avatar that you choose from
              your photo library or take with your camera.
            </li>
            <li>
              <strong>Community content:</strong> messages you choose to post in tribe chat.
            </li>
            <li>
              <strong>Notification information:</strong> your notification preferences and a
              device push token when you explicitly enable push notifications.
            </li>
            <li>
              <strong>Technical information:</strong> limited service logs needed to operate,
              secure, diagnose, and prevent abuse of the app.
            </li>
          </ul>

          <h2>Camera and photo library</h2>
          <p>
            Camera and photo-library access is optional. The app requests access only after you
            choose <strong>Take Photo</strong> or <strong>Choose Photo</strong> while setting a
            profile avatar. For example, you may take a selfie to use as your player picture. The
            selected image is uploaded to provide that avatar; the app does not continuously
            access your camera or scan your photo library.
          </p>

          <h2>Gameplay submissions and leaderboards</h2>
          <p>
            Season picks and episode answers are sent to our server so the game can lock entries,
            calculate points, and maintain rankings. Before the mobile app first sends this
            score-related data, it asks for your consent.
          </p>
          <p>
            Your display name or username, optional avatar, tribe, rank, and score may be visible
            to other game participants on tribe and global leaderboards. Individual picks and
            answers are used to calculate scores but are not displayed on those leaderboards.
            If you decline the consent prompt, the mobile app does not submit the pending picks
            or answers.
          </p>

          <h2>How we use information</h2>
          <ul>
            <li>Provide accounts, tribes, gameplay, scoring, leaderboards, chat, and avatars.</li>
            <li>Send game and chat notifications you choose to enable.</li>
            <li>Maintain security, prevent abuse, troubleshoot problems, and improve reliability.</li>
            <li>Respond to support, privacy, and account-deletion requests.</li>
          </ul>

          <h2>Service providers and disclosure</h2>
          <p>
            We use service providers for authentication, app hosting, database and file storage,
            and push-notification delivery. They process information only to provide those
            services and are expected to protect it consistently with this policy. We do not sell
            personal information. We may disclose information when required by law or when
            necessary to protect players, the service, or legal rights.
          </p>

          <h2>Retention and deletion</h2>
          <p>
            We keep information while your account is active and as needed to operate the current
            game, maintain security, resolve disputes, or meet legal obligations. You can delete
            your account from <strong>Profile → Delete Account</strong>. Account deletion removes
            your active account and associated picks, answers, and chat messages. Limited backup
            or security records may remain temporarily where technically or legally necessary.
          </p>

          <h2>Your choices</h2>
          <ul>
            <li>You may decline camera, photo-library, or notification permission.</li>
            <li>You may decline the leaderboard consent prompt; the pending submission is not sent.</li>
            <li>You may change your display name, avatar, and notification choices in Profile.</li>
            <li>You may delete your account and associated gameplay data in Profile.</li>
          </ul>

          <h2>Children’s privacy</h2>
          <p>
            The app is not directed to children under 13, and we do not knowingly collect personal
            information from children under 13. If you believe a child has provided information,
            please use the support contact listed for the app so it can be reviewed and removed.
          </p>

          <h2>Changes and questions</h2>
          <p>
            We may update this policy as the app changes. The date at the top identifies the latest
            version. For privacy questions or requests, use the support contact listed for Ultimate
            Survivor Fan Game in its App Store listing.
          </p>
        </div>

        <footer className="mt-10 border-t border-border py-8 text-sm text-muted-foreground">
          <Link href="/" className="font-semibold text-primary hover:underline">
            Return to Ultimate Survivor Fan Game
          </Link>
        </footer>
      </article>
    </main>
  );
}