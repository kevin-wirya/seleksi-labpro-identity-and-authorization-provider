import 'dotenv/config';

export const config={
    port:process.env.PORT||4000,
    databaseUrl:process.env.DATABASE_URL||'postgresql://admin:secret@localhost:5432/sso_db?schema=public',
    rabbitmqUrl:process.env.RABBITMQ_URL||'amqp://guest:guest@localhost:5672',
    nodeEnv:process.env.NODE_ENV||'development',
    sessionDurationMs:24*60*60*1000,
    authCodeDurationMs:10*60*1000,
    accessTokenDurationMs:60*60*1000,
};
