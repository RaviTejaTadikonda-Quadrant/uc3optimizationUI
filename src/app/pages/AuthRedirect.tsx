import { broadcastResponseToMainFrame } from "@azure/msal-browser/redirect-bridge";
import { useEffect } from "react";

// This route is the registered MSAL popup callback. Do not add application
// routing, token parsing, storage writes, or window.close logic here.
export default function AuthRedirect() {
  useEffect(() => {
    void broadcastResponseToMainFrame();
  }, []);

  return <p>Completing sign-in…</p>;
}
