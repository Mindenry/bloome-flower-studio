/**
 * Central environment access. Server-only — never import from client components.
 */
const raw = (key: string, fallback = ""): string => {
  const value = process.env[key];
  return value === undefined || value === "" ? fallback : value;
};

const bool = (key: string, fallback = false): boolean => {
  const value = process.env[key];
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const int = (key: string, fallback: number): number => {
  const parsed = Number.parseInt(process.env[key] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  get nodeEnv() {
    return raw("NODE_ENV", "development");
  },
  get isProduction() {
    return this.nodeEnv === "production";
  },
  get appUrl() {
    return raw("APP_URL", "http://localhost:3000").replace(/\/$/, "");
  },
  get appName() {
    return raw("APP_NAME", "BLOOMÉ FLOWER STUDIO");
  },
  get authSecret() {
    return raw("AUTH_SECRET", "dev-only-insecure-secret-change-me-please-32b");
  },
  get cronSecret() {
    return raw("CRON_SECRET", "");
  },
  get adminIpAllowlist() {
    return raw("ADMIN_IP_ALLOWLIST")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },

  get databaseUrl() {
    return raw("DATABASE_URL", "file:./data/bloome.db");
  },
  get databaseSsl() {
    return bool("DATABASE_SSL", false);
  },

  line: {
    get channelId() {
      return raw("LINE_CHANNEL_ID");
    },
    get channelSecret() {
      return raw("LINE_CHANNEL_SECRET");
    },
    get callbackUrl() {
      return raw("LINE_CALLBACK_URL", `${env.appUrl}/api/auth/line/callback`);
    },
    get scope() {
      return raw("LINE_LOGIN_SCOPE", "profile openid email");
    },
    get configured() {
      return Boolean(env.line.channelId && env.line.channelSecret);
    },
    get messagingToken() {
      return raw("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN");
    },
    get messagingSecret() {
      return raw("LINE_MESSAGING_CHANNEL_SECRET");
    },
    get addFriendUrl() {
      return raw("LINE_OA_ADD_FRIEND_URL");
    },
  },

  google: {
    get clientId() {
      return raw("GOOGLE_CLIENT_ID");
    },
    get clientSecret() {
      return raw("GOOGLE_CLIENT_SECRET");
    },
    get callbackUrl() {
      return raw("GOOGLE_CALLBACK_URL", `${env.appUrl}/api/auth/google/callback`);
    },
    get configured() {
      return Boolean(env.google.clientId && env.google.clientSecret);
    },
  },

  payments: {
    get provider() {
      return raw("PAYMENT_PROVIDER", "manual_bank_transfer");
    },
    get currency() {
      return raw("PAYMENT_CURRENCY", "THB");
    },
    get omisePublicKey() {
      return raw("OMISE_PUBLIC_KEY");
    },
    get omiseSecretKey() {
      return raw("OMISE_SECRET_KEY");
    },
    get omiseApiVersion() {
      return raw("OMISE_API_VERSION", "2019-05-29");
    },
    get omiseWebhookKey() {
      return raw("OMISE_WEBHOOK_KEY");
    },
    get stripeSecretKey() {
      return raw("STRIPE_SECRET_KEY");
    },
    get stripePublishableKey() {
      return raw("STRIPE_PUBLISHABLE_KEY");
    },
    get stripeWebhookSecret() {
      return raw("STRIPE_WEBHOOK_SECRET");
    },
    bank: {
      get accountName() {
        return raw("BANK_ACCOUNT_NAME");
      },
      get accountNumber() {
        return raw("BANK_ACCOUNT_NUMBER");
      },
      get name() {
        return raw("BANK_NAME");
      },
      get branch() {
        return raw("BANK_BRANCH");
      },
      get configured() {
        return Boolean(raw("BANK_ACCOUNT_NUMBER"));
      },
    },
  },

  mail: {
    get driver() {
      return raw("MAIL_DRIVER", env.isProduction ? "smtp" : "log");
    },
    get host() {
      return raw("MAIL_HOST");
    },
    get port() {
      return int("MAIL_PORT", 587);
    },
    get secure() {
      return bool("MAIL_SECURE", false);
    },
    get user() {
      return raw("MAIL_USER");
    },
    get pass() {
      return raw("MAIL_PASS");
    },
    get from() {
      return raw("MAIL_FROM", "BLOOMÉ FLOWER STUDIO <hello@bloome.local>");
    },
    get replyTo() {
      return raw("MAIL_REPLY_TO", "");
    },
  },

  storage: {
    get driver() {
      return raw("STORAGE_DRIVER", "local");
    },
    get uploadDir() {
      return raw("UPLOAD_DIR", "./public/uploads");
    },
    get publicPrefix() {
      return raw("PUBLIC_UPLOAD_PREFIX", "/uploads");
    },
    get s3Bucket() {
      return raw("S3_BUCKET");
    },
    get s3Region() {
      return raw("S3_REGION", "ap-southeast-1");
    },
    get s3Endpoint() {
      return raw("S3_ENDPOINT");
    },
    get s3AccessKeyId() {
      return raw("S3_ACCESS_KEY_ID");
    },
    get s3SecretAccessKey() {
      return raw("S3_SECRET_ACCESS_KEY");
    },
    get s3PublicUrl() {
      return raw("S3_PUBLIC_URL");
    },
  },

  get seedAdminEmail() {
    return raw("SEED_ADMIN_EMAIL", "admin@bloome.local");
  },
  get seedAdminPassword() {
    return raw("SEED_ADMIN_PASSWORD", "ChangeMe!2026");
  },
  get seedDemoData() {
    return bool("SEED_DEMO_DATA", true);
  },
};

/** Capability report used by docs + admin settings screen. */
export function integrationStatus() {
  return {
    lineLogin: env.line.configured,
    lineMessaging: Boolean(env.line.messagingToken),
    googleLogin: env.google.configured,
    paymentProvider: env.payments.provider,
    paymentConfigured:
      env.payments.provider === "stripe"
        ? Boolean(env.payments.stripeSecretKey && env.payments.stripeWebhookSecret)
        : env.payments.provider === "promptpay_omise"
          ? Boolean(env.payments.omiseSecretKey)
          : env.payments.provider === "sandbox"
            ? !env.isProduction && false
            : env.payments.bank.configured,
    email: env.mail.driver === "smtp" ? Boolean(env.mail.host) : true,
    storage: env.storage.driver,
    storageConfigured:
      env.storage.driver === "s3" ? Boolean(env.storage.s3Bucket) : true,
  };
}
