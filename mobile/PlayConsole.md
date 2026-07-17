# DegenFeed — Google Play Console Configuration

## Package & Identity

| Field | Value |
|-------|-------|
| Package Name | `xyz.degenfeed.app` |
| App Name | DegenFeed: Crypto Social Feed |
| Default Language | English (United States) |

### App Signing

- **App Signing by Google Play**: Enabled (recommended)
- **Upload Certificate**: Generated via Android Studio or keytool
- **Signing Certificate**: SHA-256 fingerprint (auto-generated on opt-in)

```bash
# Generate upload key (if not existing)
keytool -genkey -v -keystore degenfeed-upload.keystore \
  -alias degenfeed \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass <YOUR_STORE_PASS> \
  -keypass <YOUR_KEY_PASS>

# Check fingerprint
keytool -list -v -keystore degenfeed-upload.keystore -alias degenfeed
```

---

## Store Listing

### App Details

| Field | Value |
|-------|-------|
| Title | **DegenFeed: Crypto Social Feed** |
| Short Description (80 chars max) | Unified feed for Nostr, Farcaster, Lens, Bluesky & more — decentralized social, one scroll. |
| Full Description | *(See `mobile/play-store/listing.json`)* |

### Category & Tags

| Field | Selection |
|-------|-----------|
| Application Type | **Apps** |
| Category | **Social** |
| Tags | crypto, web3, decentralized, social, blockchain, nostr, farcaster, lens, bluesky |

### Store Listing Assets

| Asset | Size | Format | Location |
|-------|------|--------|----------|
| Feature Graphic | 1024×500 | PNG/JPG | `mobile/play-store/feature-graphic-1024x500.png` |
| App Icon | 512×512 | PNG (32-bit) | `mobile/play-store/icon-512x512.png` |
| Phone Screenshots | 1080×1920 or 1080×2340 | PNG/JPG | `mobile/screenshots/` |
| Tablet Screenshots | 2001×2001 or 2001×1500 (7" & 10") | PNG/JPG | `mobile/screenshots/` |
| Promo Video (optional) | 1920×1080 | MP4 | YouTube URL only |

---

## Content Rating Questionnaire

Complete the [Google Play Content Rating](https://play.google.com/console/content-rating) questionnaire.

### Answers for DegenFeed

#### Section 1: Media & Communication

| Question | Answer |
|----------|--------|
| Does your app allow users to create or share content? | **Yes** (users create and share posts across protocols) |
| Does your app allow user-to-user communication? | **Yes** (replies, mentions, DMs on Nostr/Farcaster) |
| Does your app allow sharing of user locations? | **No** |

#### Section 2: User-Generated Content

| Question | Answer |
|----------|--------|
| Does your app contain user-generated content? | **Yes** — all feed content is user-generated from decentralized protocols |
| Do you moderate user-generated content? | **No** — content is fetched from public decentralized relays with no central moderation |
| Do you allow users to report content? | **No** — users can mute/block locally but there is no central reporting mechanism |
| Does your app include sexual content in user content? | **Not intentionally** — but decentralized protocols may contain any type of content |
| Does your app include violent content in user content? | **Not intentionally** — but decentralized protocols may contain any type of content |
| Does your app include hate speech in user content? | **Not intentionally** — but decentralized protocols may contain any type of content |

#### Section 3: Gambling

| Question | Answer |
|----------|--------|
| Does your app include gambling? | **No** |
| Does your app simulate gambling? | **No** — price tickers and crypto references are informational, not gambling |

#### Section 4: Alcohol, Tobacco, Drugs

| Question | Answer |
|----------|--------|
| Does your app reference or promote alcohol? | **Not intentionally** — user content may include references |
| Does your app reference or promote tobacco/drugs? | **Not intentionally** — user content may include references |

#### Section 5: Mature Content

| Question | Answer |
|----------|--------|
| Does your app contain sexually suggestive content? | **Not intentionally** — user-generated content from decentralized networks may contain such content |
| Does your app contain profanity or crude humor? | **Not intentionally** — but user content may contain profanity |

### Resulting Rating

| Region | Rating |
|--------|--------|
| Worldwide | **Mature 17+** |
| Brazil | **16** |
| Germany | **USK 16 (estimated)** |
| South Korea | **19+ (estimated)** |

### Target Audience

| Setting | Value |
|---------|-------|
| Target Audience Age | **18+** |
| Designed for Families | **No** |

---

## App Content

### Target Age Group

- **Primary**: Adults (18+)
- **Rationale**: App connects to decentralized social networks where content is user-generated and unmoderated. Not suitable for children.

### Ads

| Setting | Value |
|---------|-------|
| Contains Ads? | **No** |
| Ad Networks Used | None |

### News

| Setting | Value |
|---------|-------|
| Is this a news app? | **Secondary** — App aggregates feeds including news-oriented content from RSS and other protocols |

---

## Pricing & Distribution

| Field | Value |
|-------|-------|
| App Pricing | **Free** |
| Countries | **All** |
| Available on | Phones, Tablets, Chromebooks |
| Managed Google Play | Include for EMM distribution |

### In-App Products (Future)

| Product ID | Type | Status |
|------------|------|--------|
| `xyz.degenfeed.app.premium.monthly` | Subscription | Not yet configured |
| `xyz.degenfeed.app.premium.annual` | Subscription | Not yet configured |
| `xyz.degenfeed.app.tip.1` | Managed product | Not yet configured |
| `xyz.degenfeed.app.tip.5` | Managed product | Not yet configured |

---

## Production Setup

### Release Tracks

| Track | Purpose | Who Gets It |
|-------|---------|-------------|
| **Internal testing** | Quick smoke tests | Up to 100 developers |
| **Closed alpha** | Feature testing | 5-20 trusted testers |
| **Closed beta** | Pre-release QA | Up to 100,000 testers |
| **Open beta** | Public pre-release | Everyone |
| **Production** | Public release | Everyone |

### Rollout Strategy v1.0

1. ✅ Internal testing (developers) — 1 day
2. ✅ Closed alpha (core team + testers) — 3 days
3. ✅ Closed beta (invite-only) — 1 week
4. ⏳ Production rollout:
   - **Phase 1**: 5% of users — 1 day (monitor crashes/ANRs)
   - **Phase 2**: 25% — 2 days
   - **Phase 3**: 50% — 3 days
   - **Phase 4**: 100% — 1 week after previous stage

---

## Android Build Configuration

### Gradle Properties

Set in `android/gradle.properties`:

```properties
android.useAndroidX=true
android.enableJetifier=true
org.gradle.jvmargs=-Xmx4g
keyAlias=degenfeed
keyPassword=<KEY_PASSWORD>
storeFile=degenfeed-upload.keystore
storePassword=<STORE_PASSWORD>
```

### App Signing in GitHub Actions

For CI/CD signing, store the following in GitHub Secrets:

| Secret | Description |
|--------|-------------|
| `PLAY_STORE_UPLOAD_KEYSTORE` | Base64-encoded upload keystore |
| `PLAY_STORE_KEYSTORE_PASSWORD` | Keystore password |
| `PLAY_STORE_KEY_ALIAS` | Key alias (`degenfeed`) |
| `PLAY_STORE_KEY_PASSWORD` | Key password |
| `PLAY_STORE_SERVICE_ACCOUNT_JSON` | Google Play Console service account JSON key |
| `PLAY_STORE_TRACK` | Deployment track (`internal`, `alpha`, `beta`, `production`) |

### Google Play Developer API

1. Go to [Google Play Console](https://play.google.com/console) → **Setup** → **API Access**
2. Create a Google Cloud Platform project (or use existing)
3. Enable the **Google Play Android Developer API**
4. Create a **Service Account**
5. Grant the service account access: **Admin (All permissions)**
6. Download the JSON key
7. Store as `PLAY_STORE_SERVICE_ACCOUNT_JSON` in GitHub Secrets

---

## Submission Checklist

### Pre-Submission

- [ ] App icon (512×512px, 32-bit PNG) uploaded
- [ ] Feature graphic (1024×500px) uploaded
- [ ] Phone screenshots uploaded (2-8 required, 1080×1920 or 1080×2340)
- [ ] Tablet screenshots uploaded (optional but recommended for 7" and 10")
- [ ] Short description finalized (80 chars max)
- [ ] Full description finalized (4000 chars max)
- [ ] Category and tags set
- [ ] Content rating questionnaire completed
- [ ] Target audience set to 18+
- [ ] Privacy policy URL set: `https://degenfeed.xyz/privacy`
- [ ] App pricing set to Free
- [ ] Countries: All
- [ ] App signing configured
- [ ] Test accounts listed (if needed)

### Post-Submission

- [ ] Review status monitored (typically 1-3 hours for pre-review)
- [ ] Android vitals checked (ANR rate, crash rate, render time)
- [ ] User feedback collected from closed beta
- [ ] Production rollout staged in phases
