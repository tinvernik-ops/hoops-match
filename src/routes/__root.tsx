import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary text-display">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Out of bounds</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          That page isn't on the court.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Back to Hoops
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Airball.</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#e07b3a" },
      { title: "Hoops — Find hoopers near you" },
      { name: "description", content: "Hoops is the pickup basketball app. Find hoopers near you, see offensive and defensive ratings, and call up a sesh." },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Hoops" },
      { property: "og:title", content: "Hoops — Find hoopers near you" },
      { property: "og:description", content: "Hoops is the pickup basketball app. Find hoopers near you, see offensive and defensive ratings, and call up a sesh." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Hoops — Find hoopers near you" },
      { name: "twitter:description", content: "Hoops is the pickup basketball app. Find hoopers near you, see offensive and defensive ratings, and call up a sesh." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2187478a-acf0-47ec-91dd-03c07d19f3f4/id-preview-ca3c2160--740886c7-5e38-4bde-89ba-5533e780e0bd.lovable.app-1778392983309.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2187478a-acf0-47ec-91dd-03c07d19f3f4/id-preview-ca3c2160--740886c7-5e38-4bde-89ba-5533e780e0bd.lovable.app-1778392983309.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Outlet />
          <Toaster position="top-center" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
