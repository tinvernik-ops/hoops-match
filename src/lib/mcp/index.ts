import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfile from "./tools/get-my-profile";
import listMyLeagues from "./tools/list-my-leagues";
import listNearbyPlayers from "./tools/list-nearby-players";
import listNearbyCourts from "./tools/list-nearby-courts";

// The OAuth issuer MUST be the direct Supabase host, not the .lovable.cloud proxy.
// The project ref is the only Supabase value that survives publish unchanged.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "hoops-mcp",
  title: "Hoops",
  version: "0.1.0",
  instructions:
    "Tools for the Hoops pickup basketball app. Use these to look up the signed-in hooper's profile, their leagues, players checked in nearby, and nearby courts.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfile, listMyLeagues, listNearbyPlayers, listNearbyCourts],
});
