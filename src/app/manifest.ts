// src/app/manifest.ts
// ─── Web app manifest ────────────────────────────────────────────────────────
// Served at `/manifest.webmanifest` and linked automatically by Next from the
// root segment. The proxy never sees it: `webmanifest` is in the matcher's static
// -extension exclusion list, so this is one of the few routes that is reachable
// without a session by construction rather than by an entry in `PUBLIC_ROUTES`.
//
// What this is for, concretely:
//   • Android/Chrome uses `name`, `short_name` and `icons` when a student taps
//     "Add to Home screen", and `background_color`/`theme_color` for the splash
//     and the toolbar of the installed window.
//   • `lang: "id"` matters: the app is Indonesian, and a manifest that does not
//     say so makes screen readers and the install UI guess.
//
// What this is NOT: an offline story. There is no service worker, so Chrome will
// not show an automatic install prompt and nothing works offline. `display:
// "standalone"` is still the right declaration — it describes how the app should
// appear *if* it is installed, which on iOS ("Add to Home Screen") it can be
// today. Shipping a service worker is a separate decision with its own cache
// -invalidation and privacy surface; claiming one here would be a lie.
import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_TITLE,
    // Home-screen labels get truncated at roughly 12 characters. "NAWA-LEARN" is
    // 10, so it fits without an ellipsis on every device.
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    lang: "id",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    // The single SVG mark served by the `src/app/icon.svg` file convention. One
    // vector source scales to every size, so there is no 48/72/96/192/512 set to
    // keep in sync — and no rasterised copy to go stale against it.
    //
    // `purpose: "any"` only. A `maskable` entry needs its artwork inset to a
    // safe zone (Android crops to a circle, and this mark reaches the edges of
    // its viewBox), so declaring one here would get the glow clipped.
    //
    // Known gap, stated rather than papered over: iOS has historically read a
    // separate `apple-touch-icon` PNG for the home-screen tile, and SVG is not
    // accepted there. Recent iOS versions do read `manifest.icons`, so this is
    // not always broken — but it is not guaranteed either. The fix is a 180×180
    // PNG at `src/app/apple-icon.png`; it is deliberately not faked here by
    // pointing `apple-touch-icon` at an SVG that iOS will ignore.
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
    ],
    // Default theme is dark (`ThemeProvider` sets `defaultTheme="dark"`), so the
    // splash background is the dark body colour rather than white — otherwise an
    // installed app flashes white before painting dark.
    background_color: "#09090b",
    // The brand indigo. Once the page loads, the per-scheme `<meta
    // name="theme-color">` from `viewport` in the root layout takes over, so this
    // only decides the colour of the installed window's toolbar before paint.
    theme_color: "#4f46e5",
    display: "standalone",
    orientation: "portrait",
    categories: ["education"],
  };
}
