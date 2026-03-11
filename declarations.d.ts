declare namespace NodeJS {
  interface ProcessEnv {
    DEV?: string;
    HOST: string;
    PORT?: string;
    SSL_PRIVATE_KEY?: string;
    SSL_CERTIFICATE?: string;
    WHITELIST_IDS: string;
    BOT_TOKEN: string;
    SECRET_TOKEN: string;
    MONGO_URL: string;
    CA_CHAT_ID: string;
    CA_TOPIC_ID?: string;
    PUBLISH_DESTINATIONS: string;
    START_MESSAGE?: string;
  }
}