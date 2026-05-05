import { useEffect, useRef, lazy, Suspense } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Redirect, Router as WouterRouter } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import NotFound from "@/pages/not-found";

const Onboarding = lazy(() => import("@/pages/onboarding"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Admin = lazy(() => import("@/pages/admin"));
const Leaderboard = lazy(() => import("@/pages/leaderboard"));

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/survivor-logo.png`,
  },
  variables: {
    colorPrimary: "hsl(35 90% 50%)",
    colorForeground: "hsl(140 30% 15%)",
    colorMutedForeground: "hsl(140 20% 40%)",
    colorDanger: "hsl(0 84% 55%)",
    colorBackground: "hsl(40 50% 98%)",
    colorInput: "hsl(40 40% 100%)",
    colorInputForeground: "hsl(140 30% 15%)",
    colorNeutral: "hsl(140 10% 85%)",
    fontFamily: "'Work Sans', sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: { width: "100%", maxWidth: "100vw", minWidth: "0", display: "flex", justifyContent: "center" },
    cardBox: { width: "100%", maxWidth: "100vw", minWidth: "0", boxSizing: "border-box", backgroundColor: "white", overflow: "hidden", borderRadius: "0", boxShadow: "none", border: "none" },
    card: { width: "100%", maxWidth: "100vw", minWidth: "0", boxSizing: "border-box", boxShadow: "none", border: "none", backgroundColor: "transparent", borderRadius: "0" },
    footer: { boxShadow: "none", border: "none", backgroundColor: "transparent", borderRadius: "0" },
    headerTitle: "text-foreground font-bold",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground",
    formFieldLabel: "text-foreground font-medium",
    footerActionLink: "text-primary font-semibold",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-green-600",
    alertText: "text-foreground",
    logoBox: "flex justify-center mb-2",
    logoImage: "h-10",
    socialButtonsBlockButton: "border border-border bg-background hover:bg-muted",
    formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold",
    formFieldInput: "border-border bg-background text-foreground",
    footerAction: "bg-muted/40",
    dividerLine: "bg-border",
    alert: "border-border bg-muted/30",
    otpCodeFieldInput: "border-border",
    formFieldRow: "",
    main: "",
    userButtonPopoverActionButton: { color: "hsl(140, 30%, 15%)" },
    userButtonPopoverActionButtonText: { color: "hsl(140, 30%, 15%)", fontWeight: "600" },
    userButtonPopoverActionButtonIcon: { color: "hsl(140, 30%, 15%)" },
    userButtonPopoverFooter: "hidden",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center py-8">
      {/* Branding */}
      <div className="w-full flex flex-col items-center text-center px-6 mb-6">
        <img src={`${basePath}/survivor-logo.png`} alt="Survivor" className="h-28 mb-4" />
        <div className="inline-block bg-primary/10 text-primary font-semibold text-sm px-4 py-1 rounded-full mb-3 uppercase tracking-widest">
          Season Active
        </div>
        <h1 className="text-4xl font-bold text-foreground mb-2 w-full" style={{ fontFamily: "'Oswald', sans-serif", overflowWrap: "break-word", wordBreak: "break-word" }}>
          ULTIMATE SURVIVOR<br /><span className="text-primary">FAN GAME</span>
        </h1>
        <p className="text-base text-muted-foreground">
          Predict weekly outcomes, pick your winner, and climb the leaderboard.
        </p>
      </div>

      {/* Sign-in — edge-to-edge on mobile, constrained card on desktop */}
      <div className="w-full flex justify-center">
        <SignIn
          routing="hash"
          signUpUrl={`${basePath}/sign-up`}
          fallbackRedirectUrl={`${basePath}/dashboard`}
        />
      </div>
    </div>
  );
}

function RouterContent() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading...</div>}>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/admin" component={Admin} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Welcome back", subtitle: "Sign in to your Ultimate Survivor Fan Game account" } },
        signUp: { start: { title: "Join the Ultimate Survivor Fan Game", subtitle: "Create your account and start predicting" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <RouterContent />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
