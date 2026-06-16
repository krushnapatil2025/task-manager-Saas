// ─────────────────────────────────────────────────────────────────────────────
// Google Drive Service Account Configuration
// This file holds your Google Drive credentials for chat file uploads.
// ⚠️  Do NOT commit this file to a public GitHub repository!
//     Add 'src/config/googleDriveConfig.js' to your .gitignore file.
// ─────────────────────────────────────────────────────────────────────────────
export const GOOGLE_DRIVE_CONFIG = {
  folderId: '13uCQRv4KsesuB1YHhheX5ljhqHvq0fHX',
  useOAuth2: true, // flag to toggle OAuth2
  oauth2: {
    clientId: '918420926347-l8f1isbn9nklkm6hsuqto62m9l91uq8v.apps.googleusercontent.com',
    clientSecret: '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',
    refreshToken: '1//046r9JAcD-SuPCgYIARAAGAQSNwF-L9Ir-zmwMu9UZawIu5GecW5_-h4T_4x14X3mqL-zG8hD4yjVghgyvPd8rXK8QqqU9FsL5j4',
  }
};
