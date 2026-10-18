import { preview } from 'vite';

// Keep the server in this process so Windows teardown never needs taskkill /T.
export default async function globalSetup() {
  const server = await preview({ preview: { host: '127.0.0.1', port: 4174, strictPort: true } });
  return async () => {
    if ('closeAllConnections' in server.httpServer) server.httpServer.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.httpServer.close(error => error ? reject(error) : resolve());
    });
  };
}
