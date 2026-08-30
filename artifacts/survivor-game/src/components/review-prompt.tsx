import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const REVIEW_KEY_PREFIX = "survivor.review.";

function storageKey(userId: string, suffix: string) {
  return `${REVIEW_KEY_PREFIX}${userId}.${suffix}`;
}

export function markOnboardingComplete(userId: string) {
  window.localStorage.setItem(storageKey(userId, "onboarding-complete"), "true");
}

function ReviewPrompt({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);

  function finish(value: string) {
    window.localStorage.setItem(storageKey(userId, "decision"), value);
    onDone();
  }

  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && finish("dismissed")}>
      <DialogContent className="max-w-sm text-center" data-testid="review-prompt">
        <DialogHeader className="items-center text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Star className="h-6 w-6 fill-current" />
        </div>
        <DialogTitle className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Oswald', sans-serif" }}>
          ENJOYING THE GAME?
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted-foreground">
          A quick star rating helps us keep the game going. It only takes one tap.
        </DialogDescription>
        </DialogHeader>

        <fieldset className="mt-6 flex justify-center gap-2">
          <legend className="sr-only">Rate the game</legend>
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="review-rating"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                aria-label={`${value} star${value === 1 ? "" : "s"}`}
                data-testid={`review-star-${value}`}
                className="peer sr-only"
              />
              <Star
                className={`h-9 w-9 fill-current rounded-lg p-1 transition-transform hover:scale-110 peer-focus-visible:ring-2 peer-focus-visible:ring-primary ${
                  value <= rating ? "text-primary" : "text-muted-foreground/35"
                }`}
              />
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          data-testid="button-submit-review"
          disabled={!rating}
          onClick={() => finish(`rated:${rating}`)}
          className="mt-6 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {rating ? `Give ${rating} Star${rating === 1 ? "" : "s"}` : "Choose a rating"}
        </button>
        <button
          type="button"
          data-testid="button-dismiss-review"
          onClick={() => finish("dismissed")}
          className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Maybe later
        </button>
      </DialogContent>
    </Dialog>
  );
}

export function ReviewPromptGate({ userId, route }: { userId: string; route: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onboardingComplete =
      window.localStorage.getItem(storageKey(userId, "onboarding-complete")) === "true";
    const featureUsed =
      window.localStorage.getItem(storageKey(userId, "feature-used")) === "true";
    const alreadyDecided = window.localStorage.getItem(storageKey(userId, "decision"));
    const excludedRoute =
      route === "/onboarding" ||
      route.startsWith("/sign-in") ||
      route.startsWith("/sign-up");

    if (excludedRoute || !onboardingComplete || alreadyDecided) {
      setOpen(false);
      return;
    }

    if (featureUsed) {
      setOpen(true);
      return;
    }

    const recordFirstFeatureUse = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("button, a, input, select, textarea, [role='button'], [role='link']")) {
        return;
      }
      window.localStorage.setItem(storageKey(userId, "feature-used"), "true");
      window.setTimeout(() => setOpen(true), 300);
      document.removeEventListener("click", recordFirstFeatureUse, true);
      document.removeEventListener("keydown", recordFirstFeatureUse, true);
    };

    document.addEventListener("click", recordFirstFeatureUse, true);
    document.addEventListener("keydown", recordFirstFeatureUse, true);
    return () => {
      document.removeEventListener("click", recordFirstFeatureUse, true);
      document.removeEventListener("keydown", recordFirstFeatureUse, true);
    };
  }, [route, userId]);

  if (!open) return null;
  return <ReviewPrompt userId={userId} onDone={() => setOpen(false)} />;
}