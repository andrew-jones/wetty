import pty from 'node-pty';
import { logger as getLogger } from '../shared/logger.js';
import { tinybuffer, FlowControlServer } from './flowcontrol.js';
import { xterm } from './shared/xterm.js';
import { envVersionOr } from './spawn/env.js';
import type SocketIO from 'socket.io';

const DISCONNECT_GRACE_MS = 30000;

export async function spawn(
  socket: SocketIO.Socket,
  args: string[],
): Promise<void> {
  const logger = getLogger();
  const version = await envVersionOr(0);
  const cmd = version >= 9 ? ['-S', ...args] : args;
  logger.debug('Spawning PTY', { cmd });
  const term = pty.spawn('/usr/bin/env', cmd, xterm);
  const { pid } = term;
  const address = args[0] === 'ssh' ? args[1] : 'localhost';
  logger.info('Process Started on behalf of user', { pid, address });
  socket.emit('login');

  let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  term.onExit(({ exitCode }) => {
    logger.info('Process exited', { exitCode, pid });
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }
    socket.emit('logout');
    socket
      .removeAllListeners('disconnect')
      .removeAllListeners('resize')
      .removeAllListeners('input');
  });
  const send = tinybuffer(socket, 2, 524288);
  const fcServer = new FlowControlServer();
  term.onData((data: string) => {
    send(data);
    if (fcServer.account(data.length)) {
      term.pause();
    }
  });
  socket
    .on('resize', ({ cols, rows }: { cols: number; rows: number }) => {
      term.resize(cols, rows);
    })
    .on('input', (input: string) => {
      term.write(input);
      if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
        logger.info('Client reconnected, cancelled PTY teardown', { pid });
      }
    })
    .on('disconnect', () => {
      logger.info(
        'Socket disconnected, waiting for reconnect before killing PTY',
        { pid },
      );
      disconnectTimer = setTimeout(() => {
        term.kill();
        logger.info('Grace period expired, PTY killed', { pid });
      }, DISCONNECT_GRACE_MS);
    })
    .on('commit', (size: number) => {
      if (fcServer.commit(size)) {
        term.resume();
      }
    });
}
