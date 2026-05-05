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
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg border border-border",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
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
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Branding side */}
      <div className="flex flex-col items-center justify-center px-8 py-12 md:flex-1 text-center">
        <img src={`${basePath}/survivor-logo.png`} alt="Survivor" className="h-28 mb-8" />
        <div className="inline-block bg-primary/10 text-primary font-semibold text-sm px-4 py-1 rounded-full mb-4 uppercase tracking-widest">
          Season Active
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4" style={{ fontFamily: "'Oswald', sans-serif" }}>
          ULTIMATE SURVIVOR<br /><span className="text-primary">FAN GAME</span>
        </h1>
        <p className="text-base text-muted-foreground max-w-sm mx-auto">
          Predict weekly outcomes, pick your winner, and climb the leaderboard. Who will you back to the end?
        </p>
      </div>

      {/* Sign-in side */}
      <div className="flex flex-col items-center justify-center px-8 py-12 md:flex-1 bg-card border-t md:border-t-0 md:border-l border-border">
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
