import { createServer } from 'http';
import { WebClient } from '@slack/web-api';

export function startOAuthServer(port = 3001): void {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;

  if (!clientId || !clientSecret) return;

  const redirectUri = process.env.SLACK_REDIRECT_URI ?? `http://localhost:${port}/slack/oauth_redirect`;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, `http://localhost:${port}`);

    if (url.pathname === '/slack/install') {
      const oauthUrl =
        `https://slack.com/oauth/v2/authorize` +
        `?client_id=${clientId}` +
        `&user_scope=chat:write` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}`;
      res.writeHead(302, { Location: oauthUrl });
      res.end();
      return;
    }

    if (url.pathname === '/slack/oauth_redirect') {
      const code = url.searchParams.get('code');
      if (!code) {
        res.writeHead(400);
        res.end('Missing code');
        return;
      }

      try {
        const result = await new WebClient().oauth.v2.access({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        });

        const userToken = (result as any).authed_user?.access_token as string | undefined;
        const userId = (result as any).authed_user?.id as string | undefined;

        console.log('\n[oauth] OOC user authorized!');
        console.log(`[oauth] User ID: ${userId}`);
        console.log(`[oauth] Add to .env: SLACK_USER_TOKEN=${userToken}\n`);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          `<h2>Authorized!</h2><p>User: <code>${userId}</code></p>` +
          `<p>Add to your <code>.env</code> and restart:</p>` +
          `<pre>SLACK_USER_TOKEN=${userToken}</pre>`,
        );
      } catch (error) {
        console.error('[oauth] Exchange failed:', error);
        res.writeHead(500);
        res.end('OAuth exchange failed — check server logs');
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(port, () => {
    console.log(`[oauth] Install URL: http://localhost:${port}/slack/install`);
  });
}
