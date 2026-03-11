import 'dotenv/config';

if (!process.env.HOST || !process.env.BOT_TOKEN || !process.env.SECRET_TOKEN) {
  throw new Error('HOST, BOT_TOKEN, SECRET_TOKEN env')
}

const setWebhook = async () => {
    const url = new URL(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/setWebhook`);

    const isSSL = process.env.SSL_PRIVATE_KEY && process.env.SSL_CERTIFICATE;
    const port = process.env.PORT || (isSSL ? 8443 : 88);
    const webhookUrl = `http${isSSL ? 's' : ''}://${process.env.HOST}:${port}/tg-signature-validator-bot-webhook`;

    const body = new FormData();
    body.append('url', webhookUrl);
    body.append('secret_token', process.env.SECRET_TOKEN);

    if (isSSL) {
      const blob = new Blob([process.env.SSL_CERTIFICATE], { type: "text/plain" });
      body.append('certificate', blob);
    }

    return fetch(url.toString(), { method: 'POST', body });
}

setWebhook().then(res => res.json()).then(res => console.log(res));
