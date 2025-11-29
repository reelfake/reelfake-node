type EnvironmentVariables = {
  nodeEnv: string;
  jwtSecret: string;
  db: string;
  user: string;
  password: string;
  host: string;
  port: number;
  enableSequelizeLogs?: boolean;
  shouldBlockNonOwner?: boolean;
  apiOwnerSecretKey?: string;
};

function setupEnvironmentVariables() {
  const db = process.env['DB_NAME'];
  const user = process.env['DB_USER'];
  const password = process.env['DB_PASSWORD'];
  const host = process.env['DB_HOST'];
  const port = process.env['DB_PORT'];
  const jwtSecret = process.env['JWT_SECRET'];
  const shouldBlockNonOwner = process.env['SHOULD_BLOCK_NON_OWNER']?.toLowerCase() === 'true';
  const apiOwnerSecretKey = process.env['API_OWNER_SECRET_KEY'];
  const enableSequelizeLogs = process.env['ENABLE_SEQUELIZE_LOGS']?.toLowerCase() === 'true';

  if (process.env.NODE_ENV === undefined) {
    throw new Error('NODE_ENV is missing form the environment variables');
  }

  if (!db || !user || !password || !host || !port) {
    throw new Error('Missing environment variables required for connecting to the database');
  }

  if (isNaN(Number(port))) {
    throw new Error(`Unknown port - ${port}`);
  }

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is missing from the environment variables');
  }

  return {
    nodeEnv: process.env.NODE_ENV,
    jwtSecret,
    db,
    user,
    password,
    host,
    enableSequelizeLogs,
    shouldBlockNonOwner,
    apiOwnerSecretKey,
    port: Number(port),
  };
}

const envVars: EnvironmentVariables = setupEnvironmentVariables();

export default envVars;
