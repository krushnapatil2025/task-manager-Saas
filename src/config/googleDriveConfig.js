// ─────────────────────────────────────────────────────────────────────────────
// Google Drive OAuth2 Configuration
// All credentials are loaded from .env — NO hardcoded secrets here.
// Vite exposes only VITE_* prefixed variables to the browser.
// ─────────────────────────────────────────────────────────────────────────────
export const GOOGLE_DRIVE_CONFIG = {
  folderId:  import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID,
  useOAuth2: true,
  oauth2: {
    clientId:     import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID,
    clientSecret: import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_SECRET,
    refreshToken: import.meta.env.VITE_GOOGLE_DRIVE_REFRESH_TOKEN,
  },
};
