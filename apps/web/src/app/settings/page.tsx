'use client';

/**
 * Settings page — Full-featured preferences with sections:
 * Account, Appearance, Notifications, Privacy, Content, API
 *
 * Thin re-export from components/settings/ for backward compatibility.
 * The actual implementation lives in components/settings/SettingsPage.tsx
 * with UI sub-components split into individual modules.
 *
 * @see components/settings/SettingsPage.tsx
 * @see components/settings/SettingsSection.tsx
 * @see components/settings/Toggle.tsx
 * @see components/settings/SelectRow.tsx
 * @see components/settings/TagList.tsx
 * @see components/settings/ApiKeyCard.tsx
 * @see components/settings/AccountsCredentialsDisplay.tsx
 */
export { default } from '../../components/settings/SettingsPage';
