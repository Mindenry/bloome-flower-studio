# LINE Login setup

LINE Login is **implemented and ready for configuration**. It has not been exercised against the live LINE platform from this environment, so treat it as READY FOR CONFIGURATION until you complete the checklist below.

## 1. Create the LINE Login channel

1. Open <https://developers.line.biz/console/> and select (or create) a provider.
2. Create a **LINE Login** channel — *not* a Messaging API channel. They are separate products.
3. In **Basic settings**, note the **Channel ID** and **Channel secret**.
4. In **LINE Login → Callback URL**, add exactly:
   - Local: `http://localhost:3000/api/auth/line/callback`
   - Production: `https://your-domain.com/api/auth/line/callback`
5. Under **Scopes**, enable `profile` and `openid`; enable `email` if you need the customer's LINE email. The app requests `profile openid email` by default (`LINE_LOGIN_SCOPE`).
6. Choose the **Web app** login flow. The app uses the authorization-code flow with PKCE.

> If you also send order notifications on LINE, create a **Messaging API** channel and set `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`. Never reuse the Login channel secret for messaging.

## 2. Configure the environment

```env
LINE_CHANNEL_ID=1234567890
LINE_CHANNEL_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LINE_CALLBACK_URL=https://your-domain.com/api/auth/line/callback
LINE_LOGIN_SCOPE=profile openid email
```

Restart the app after changing env values (`env.ts` reads them at request time, but the OAuth start URL is cached per request).

## 3. Security model

| Step | Implementation |
| --- | --- |
| State | 32-byte random value stored in `oauth_states` **and** an HttpOnly `bloome_oauth_state` cookie; both must match; single use; 10-minute expiry |
| PKCE | 32-byte verifier stored server-side, SHA-256 challenge sent to LINE |
| Nonce | Random value sent with `openid` scope and verified in the ID token |
| Code exchange | `POST https://api.line.me/oauth2/v2.1/token` with the channel secret — server only |
| ID token | Verified with `jose` against LINE JWKS (`https://api.line.me/oauth2/v2.1/certs`), issuer `https://access.line.me`, audience = channel ID |
| Profile data | Taken from the verified ID token, never from query parameters or the client |
| Account linking | A provider account is matched by `(provider, provider_account_id)`. If an email already belongs to another account, the app refuses to auto-link and asks the user to sign in first (`?linkRequired=1`) |
| Session | Opaque token, SHA-256 hashed in `sessions`, HttpOnly/SameSite=Lax/Secure cookie |

## 4. Linking an existing account

Signed-in customers can link LINE from **Account → Security** (`/api/auth/line/start?link=1`). Ownership is proven by the existing session before the link is written. Unlinking is blocked when it would leave the account without any sign-in method.

## 5. Test checklist

| Test | Expected |
| --- | --- |
| First login | Customer created, `accounts` row with provider `line`, session cookie set |
| Cancel on LINE consent screen | Redirect to `/{locale}/login?error=access_denied` |
| Reused/forged state | `?error=invalid_state`, no session |
| Expired state (>10 min) | `?error=invalid_state` |
| Existing email, no link | `?linkRequired=1&email=…` — no duplicate account |
| Linked account | Straight sign-in; `last_login_at` updated |
| Disabled account | `?error=account_disabled` |
| Logout | Session revoked in DB, cookie removed |

## 6. Common issues

- **`redirect_uri` mismatch** — the callback in the LINE console must match character-for-character, including `https` and trailing paths.
- **No email returned** — the `email` scope is not approved on the channel, or the user's LINE account has no email. The app will create an account with `email = NULL`; the customer can still check out by entering a contact email, and staff can add one later.
- **`invalid_nonce`** — the browser reused an old callback URL; start again from the login page.
- **Production cookies not set** — `APP_URL` must be `https://…` so `Secure` cookies are accepted; check that no proxy strips `Set-Cookie`.

## 7. Environment recap

```env
LINE_CHANNEL_ID=
LINE_CHANNEL_SECRET=
LINE_CALLBACK_URL=https://your-domain.com/api/auth/line/callback
LINE_LOGIN_SCOPE=profile openid email
```

The **Admin → Settings** screen shows `LINE Login: READY / CONFIGURE` based on whether these values are present.
