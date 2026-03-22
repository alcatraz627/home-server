import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin, ViteDevServer } from 'vite';

function webSocketPlugin(): Plugin {
  return {
    name: 'websocket-terminal',
    configureServer(server: ViteDevServer) {
      server.httpServer?.on('listening', async () => {
        try {
          const ws = await import('ws');
          console.log('[terminal] Loading terminal module...');
          const terminalModule = await server.ssrLoadModule('/src/lib/server/terminal.ts');
          const { createSession, getSession, resizeSession, listSessions } = terminalModule as any;
          console.log('[terminal] Terminal module loaded. createSession:', typeof createSession);

          const wss = new ws.WebSocketServer({ noServer: true });

          server.httpServer!.on('upgrade', (request: any, socket: any, head: any) => {
            const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;

            if (pathname !== '/ws/terminal') return;

            console.log('[terminal] WebSocket upgrade request received');

            wss.handleUpgrade(request, socket, head, (wsConn: any) => {
              const url = new URL(request.url || '', `http://${request.headers.host}`);
              const cols = parseInt(url.searchParams.get('cols') || '80');
              const rows = parseInt(url.searchParams.get('rows') || '24');
              const sessionParam = url.searchParams.get('session');

              console.log(`[terminal] Creating session — cols=${cols} rows=${rows} resume=${sessionParam || 'new'}`);

              let session: any;
              try {
                session = sessionParam ? getSession(sessionParam) : undefined;
                if (!session) {
                  session = createSession(cols, rows);
                  console.log(`[terminal] Session created: ${session.id}`);
                } else {
                  console.log(`[terminal] Session resumed: ${session.id}`);
                }
              } catch (err: any) {
                console.error(`[terminal] FAILED to create session:`, err.message || err);
                wsConn.send(
                  JSON.stringify({ type: 'output', data: `\r\n\x1b[31mTerminal error: ${err.message}\x1b[0m\r\n` }),
                );
                wsConn.close();
                return;
              }

              wsConn.send(JSON.stringify({ type: 'session', id: session.id, shell: session.label }));
              // Resize pty to match new client dimensions on reconnect
              if (sessionParam) {
                resizeSession(session.id, cols, rows);
              }
              // Send scrollback buffer for reconnected sessions
              if (session.scrollback) {
                // Clear screen first, then write scrollback to avoid stale rendering
                wsConn.send(JSON.stringify({ type: 'output', data: '\x1b[2J\x1b[H' }));
                wsConn.send(JSON.stringify({ type: 'scrollback', data: session.scrollback }));
                console.log(`[terminal] Session ${session.id} — sent ${session.scrollback.length} chars of scrollback`);
              }
              console.log(`[terminal] Session ${session.id} — WebSocket connected`);

              const dataHandler = session.onData((data: string) => {
                if (wsConn.readyState === ws.WebSocket.OPEN) {
                  wsConn.send(JSON.stringify({ type: 'output', data }));
                }
              });

              const exitHandler = session.onExit((code: number) => {
                if (wsConn.readyState === ws.WebSocket.OPEN) {
                  wsConn.send(JSON.stringify({ type: 'exit', code }));
                  wsConn.close();
                }
              });

              let msgCount = 0;
              wsConn.on('message', (raw: any) => {
                try {
                  const msg = JSON.parse(raw.toString());
                  if (msg.type === 'input') {
                    session.write(msg.data);
                    msgCount++;
                    if (msgCount <= 3) {
                      console.log(`[terminal] Session ${session.id} — input received (msg #${msgCount})`);
                    }
                  } else if (msg.type === 'resize') {
                    console.log(`[terminal] Session ${session.id} — resize ${msg.cols}x${msg.rows}`);
                    resizeSession(session.id, msg.cols, msg.rows);
                  }
                } catch (err: any) {
                  console.error(`[terminal] Session ${session.id} — message parse error:`, err.message);
                }
              });

              wsConn.on('close', () => {
                console.log(`[terminal] Session ${session.id} — WebSocket closed (${msgCount} messages received)`);
                dataHandler.dispose();
                exitHandler.dispose();
              });

              wsConn.on('error', (err: any) => {
                console.error(`[terminal] Session ${session.id} — WebSocket error:`, err.message);
              });
            });
          });

          console.log('[terminal] WebSocket terminal server attached');
        } catch (err: any) {
          console.error('[terminal] FATAL — Failed to start WebSocket terminal:', err.message || err);
          console.error(err.stack);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [sveltekit(), webSocketPlugin()],
    server: {
      host: '0.0.0.0',
      port: parseInt(env.PORT || '5555'),
      allowedHosts: true,
    },
  };
});
