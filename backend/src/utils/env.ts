export class Env {
  static PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  static DB_DATABASE = process.env.DB_DATABASE as string;
  static DB_USERNAME = process.env.DB_USERNAME as string;
  static DB_PASSWORD = process.env.DB_PASSWORD as string;
  static DB_HOSTNAME = process.env.DB_HOSTNAME as string;
  static DB_PORT = parseInt(process.env.DB_PORT as string, 10);
  static DB_SSL = process.env.DB_SSL === 'true';

  static ENCRYPTION_KEY = process.env.ENCRYPTION_KEY as string;

  static APP_ENDPOINT = process.env.APP_ENDPOINT as string;

  static GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID as string;
  static GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET as string;
  static GOOGLE_OAUTH_CALLBACK_URL = process.env.GOOGLE_OAUTH_CALLBACK_URL as string;
}
