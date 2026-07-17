# DegenFeed — TestFlight Beta Testing Guide

## Prerequisites

- Apple Developer Program membership ($99/year)
- Xcode 15+ installed on macOS
- App Store Connect access with Admin role
- Completed app record in App Store Connect

---

## 1. Set Up TestFlight in App Store Connect

### Enable TestFlight

1. Sign in to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **My Apps** → **DegenFeed** → **TestFlight**
3. Click **Enable TestFlight Beta Testing**
4. Accept the beta testing agreement (first time only)

### App Store Connect Users & Roles

Add your team members under **Users and Access**:
- **Admin**: Full access — can manage builds, testers, and submissions
- **Developer**: Can view builds and crash data
- **Tester**: Can only test builds (invite-only)

---

## 2. Create a Build for TestFlight

### Automated build via GitHub Actions

The `mobile-build.yml` workflow at `.github/workflows/mobile-build.yml` can build and upload for you when triggered on `main`. However, due to Apple hardware requirements, iOS builds must run on a macOS runner.

### Manual build from Xcode

```bash
# 1. Ensure Native iOS project is synced
cd apps/web
pnpm cap:sync:ios

# 2. Open the Xcode project
open ios/App/App.xcworkspace

# 3. In Xcode:
#    - Select "Any iOS Device" as the build target
#    - Product → Archive
#    - Wait for archive to complete (may take 5-10 minutes)

# 4. After archiving:
#    - Window → Organizer
#    - Select the latest archive
#    - Click "Distribute App"
#    - Choose "App Store Connect"
#    - Select "Upload"
#    - Follow the prompts to upload
```

### Version & Build Number

Update the version before archiving:

```bash
# Update Capacitor config version
npx cap set version 1.0.0
npx cap set build 1

# Sync with native projects
pnpm cap:sync:ios
```

### Required Assets for Upload

Before archiving, ensure you have:
- [ ] App icon (1024×1024px, PNG, no transparency)
- [ ] App Store screenshots (see `mobile/screenshots/`)
- [ ] App description in App Store Connect
- [ ] Privacy policy URL set
- [ ] Export Compliance: NO (DegenFeed uses standard crypto, no encryption export)

> **Export Compliance Note**: DegenFeed uses standard Web Crypto API (key generation, signing) which is not subject to EAR/OFAC encryption export restrictions. Select **"No"** for "Does your app use encryption?" during upload.

---

## 3. Manage Builds in TestFlight

### After Upload

1. Upload completes in Xcode → processed by Apple (5-30 minutes)
2. You'll receive an email when processing is done
3. In App Store Connect → TestFlight → **iOS** tab
4. The build will appear under **Builds**

### Required Metadata for Each Build

For each build you want to test, you must provide:
- **What's New in This Version** (release notes)
- **Beta App Description** (optional, shown to testers)

### Beta App Review

- First build of a new app requires Beta App Review (similar to App Review)
- Subsequent builds skip review unless there are major changes
- Review typically takes 1-2 business days
- Submit for review: **TestFlight** → **iOS** → Select build → **Submit for Beta Review**

---

## 4. Invite Testers

### Internal Testers (up to 100 users)

1. App Store Connect → **Users and Access** → **TestFlight Beta Testers**
2. Click **+** → **Add Existing Users** (users must already be in App Store Connect)
3. Select users and click **Add**
4. They will receive an invite email with instructions

### External Testers (up to 10,000 users)

1. App Store Connect → **TestFlight** → **iOS** → Select build
2. Click **Add to External Test**
3. Configure:
   - **Beta App Review Required**: Submit for review first
   - **Group Name**: e.g., "Public Beta"
   - **What to Test**: Brief instructions for testers
4. Click **Start Testing**
5. After Beta Review passes, share the public link:
   - `https://testflight.apple.com/join/<YOUR-CODE>`

### Tester Onboarding

Testers need:
1. **TestFlight app** installed from the App Store
2. The invite email or public TestFlight link
3. iOS 16.0 or later

---

## 5. Beta Testing Checklist

### Before Each Build

- [ ] Test on real devices (iPhone 14/15/16, iPad)
- [ ] Test on iOS 16, 17, 18
- [ ] Verify push notifications work end-to-end
- [ ] Test offline mode and caching
- [ ] Verify wallet connect flows
- [ ] Cross-protocol posting works correctly
- [ ] No crash on cold start
- [ ] Verify relay connections re-establish after network loss
- [ ] Test memory usage during extended scrolling (30+ min)
- [ ] Verify notification tap navigates to correct content

### Release Candidates

- [ ] Analytics tracking verified (opt-in)
- [ ] Crash reporting configured
- [ ] All critical bugs fixed
- [ ] Performance: feed loads within 3 seconds
- [ ] Battery drain: <5% per 30 minutes of use
- [ ] App size: <100MB

### Before Public Release

- [ ] Beta feedback incorporated
- [ ] App Store screenshots updated
- [ ] Privacy policy final
- [ ] Support email monitored
- [ ] Server capacity verified for launch
- [ ] Rollback plan documented

---

## 6. Troubleshooting

### "Missing Privacy Policy" error
→ Set the privacy policy URL in App Store Connect → App Information → Privacy Policy

### Build not appearing in TestFlight
→ Check email for processing errors
→ Verify bundle ID matches `xyz.degenfeed.app`
→ Ensure all code signing certs are valid

### Export Compliance warning
→ Answer "No" — DegenFeed uses Web Crypto API only, no custom encryption

### Tester can't install
→ Verify they're on iOS 16.0+
→ Ensure the build has passed Beta App Review (for external testers)
→ Maximum 100 internal testers per app
