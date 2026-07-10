
export function decodeJWT(token: string): Record<string, any> | null {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

/** Polls localStorage until the popup's redirect page writes a token or error. */
export function waitForToken(
  tokenKey: string,
  errorKey: string,
  timeoutMs = 120_000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const deadline = setTimeout(() => {
      clearInterval(poller);
      reject(new Error("Login timed out. Please try again."));
    }, timeoutMs);

    const poller = setInterval(() => {
      const token = localStorage.getItem(tokenKey);
      const err = localStorage.getItem(errorKey);
      if (token) {
        clearInterval(poller);
        clearTimeout(deadline);
        localStorage.removeItem(tokenKey);
        resolve(token);
      } else if (err) {
        clearInterval(poller);
        clearTimeout(deadline);
        localStorage.removeItem(errorKey);
        reject(new Error(err));
      }
    }, 100);
  });
}