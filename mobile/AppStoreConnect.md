# DegenFeed — App Store Connect Configuration

## Bundle & Identity

| Field | Value |
|-------|-------|
| Bundle ID | `xyz.degenfeed.app` |
| SKU | `degenfeed-ios` |
| Apple ID | Assigned on first App Store Connect submission |
| Team ID | Rug Munch Media LLC |

### Bundle ID Registration

1. Sign in to [Apple Developer Portal](https://developer.apple.com/account)
2. **Certificates, Identifiers & Profiles** → **Identifiers** → **+**
3. Select **App IDs** → Continue
4. **Bundle ID**: `xyz.degenfeed.app`
5. **Capabilities**:
   - [x] Push Notifications
   - [x] Associated Domains (for wallet connect deep links)
   - [x] App Groups (for widget data sharing, future)

---

## App Information

### Categories

| Field | Selection |
|-------|-----------|
| Primary Category | **Social Networking** |
| Secondary Category | **News** |
| Subcategory (Primary) | *(none)* |
| Subcategory (Secondary) | *(none)* |

### Age Rating

| Question | Answer |
|----------|--------|
| Frequency of simulated gambling? | **Infrequent/Mild** (crypto price references) |
| Gambling or contests? | **No** |
| Horror/Fear themes? | **None** |
| Mature/Suggestive themes? | **Frequent/Intense** (user-generated crypto content) |
| Profanity or crude humor? | **None** (in-app); user-generated content may include |
| Unrestricted web access? | **Yes** (connects to decentralized relays) |
| Sexual content or nudity? | **None** |

**Result: 17+** — Required due to unrestricted web access and user-generated content about crypto/Web3 topics.

### Rating Board Details

- **Rating**: 17+
- **Reasons**: Frequent/Intense Mature/Suggestive Themes, Unrestricted Web Access, Infrequent/Mild Simulated Gambling (user posts referencing crypto trading)
- **Kids Category**: No (app not designed for children under 17)

---

## Pricing & Availability

| Field | Value |
|-------|-------|
| Price Tier | **Free** |
| Availability | **All Territories** |
| Start Date | Immediate |
| End Date | None |
| Discount | None |
| Volume Purchase Program | **Yes** (include for education/business) |

### In-App Purchases (Future)

| Reference Name | Product ID | Type | Price Tier | Status |
|----------------|------------|------|------------|--------|
| DegenFeed Premium Monthly | `xyz.degenfeed.app.premium.monthly` | Auto-Renewable Subscription | TBD | Not yet configured |
| DegenFeed Premium Annual | `xyz.degenfeed.app.premium.annual` | Auto-Renewable Subscription | TBD | Not yet configured |
| DegenFeed Tip Jar $1 | `xyz.degenfeed.app.tip.1` | Consumable | Tier 1 | Not yet configured |
| DegenFeed Tip Jar $5 | `xyz.degenfeed.app.tip.5` | Consumable | Tier 5 | Not yet configured |

> ⚠️ **Note**: IAPs are planned for future releases. Do not include in initial v1.0 submission.

---

## App Privacy

### Privacy Manifest (Required for iOS 17+)

File: `ios/App/PrivacyInfo.xcprivacy`

DegenFeed's privacy practices:

| Data Type | Collected | Purpose | Required for Core Function? |
|-----------|-----------|---------|----------------------------|
| Push Token | Yes | Push notifications | Yes |
| Cryptographic Keys (local) | Yes* | Identity/authentication | Yes |
| Wallet Address | Optional | Profile verification | No |
| Email | No | — | — |
| Name | No | — | — |
| Location | No | — | — |
| Phone Number | No | — | — |
| Contacts | No | — | — |
| Photos | No | — | — |
| Browsing History | No | — | — |
| Search History | No | — | — |
| User ID (npub/pubkey) | Yes* | App functionality | Yes |
| Crash Data | Yes (if opted in) | Analytics | No |
| Usage Data | Yes (if opted in) | Analytics | No |

*\*Keys never leave the device*

### Privacy Policy URL

```
https://degenfeed.xyz/privacy
```

### Data Deletion

- Users can delete their account at `https://degenfeed.xyz/account/delete`
- Local keys can be removed in Settings → Clear Local Keys
- In-app data deletion triggers revocation of any server-stored push tokens

---

## App Store Screenshots

See `mobile/screenshots/README.md` for full screenshot spec and generation instructions.

### Required Screenshots Per Device

| Device | Screens | Size |
|--------|---------|------|
| iPhone 6.7" | Feed, Post, Discover, Profile, Messages | 1290×2796 |
| iPhone 6.5" | Feed, Post, Discover, Profile, Messages | 1242×2688 |
| iPhone 5.5" | Feed, Post, Discover, Profile, Messages | 1242×2208 |
| iPad 12.9" | Feed, Discover | 2048×2732 |

### Preview Video (Optional)

- 15-30 second app demo
- Landscape or portrait
- No audio required
- Must not include UI not visible in the actual app

---

## Export Compliance

DegenFeed does **not** implement custom encryption algorithms.

### Answer the Export Compliance Questions:

**Q: Does your app use encryption?**
A: **No**

> DegenFeed uses the standard Web Crypto API provided by the operating system's built-in Secure Enclave / Keychain for key generation and signing — this is NOT "encryption" under EAR/CCATS regulations. No custom cryptographic implementations. No data encryption at rest or in transit beyond standard HTTPS.

**Result**: No export compliance documentation needed. No CCATS classification required.

---

## Submission Checklist

### Pre-Submission

- [ ] App icon (1024×1024px, PNG, no alpha) uploaded
- [ ] Screenshots for all required devices uploaded
- [ ] App description finalized
- [ ] Keywords optimized (max 100 characters, comma-separated)
- [ ] Support URL set
- [ ] Marketing URL set
- [ ] Privacy policy URL set
- [ ] Age rating completed
- [ ] Pricing tier set to Free
- [ ] Territories: All
- [ ] App Review contact info filled in
- [ ] Export compliance answered

### Post-Submission

- [ ] Review status monitored (1-3 business days typical)
- [ ] Prepare for potential rejection feedback
- [ ] Have promo codes ready for reviewers if needed
- [ ] Plan release timing (immediate vs. scheduled)

---

## App Store Optimization (ASO) Notes

### Keywords Strategy

Top keywords (100 characters max):
```
crypto,decentralized,social,nostr,farcaster,lens,bluesky,web3,blockchain,feed,aggregator,defi,bitcoin,ethereum,solana
```

### Description Highlights

The first three lines of your description are the most important — they appear before the "more" truncation:
> DegenFeed brings together all your decentralized social networks in one place. Follow what matters across Nostr, Farcaster, Lens, Bluesky, and more — all from a single unified feed.

### Screenshot Best Practices

- **First screenshot**: Feed view — the most important screen users will see
- **Second screenshot**: Composer/Post view — shows the unified posting capability
- Use bright, clear text overlays highlighting key features
- Maintain consistent top and bottom safe areas (Apple HIG)
- Avoid showing real user content — use mock data
