import PartySocket from 'partysocket';
import { stringify } from 'superjson';
import { v4 as uuidv4 } from 'uuid';
import { createBrowserInspector } from './browser';
import {
  InspectorOptions,
  createInspector as inspectCreator,
  // Inspector,
} from './createInspector';
import { isNode } from './utils';
import { Adapter, Inspector } from './types';

// Not the most elegant way to do this, but it makes it much easier to test local changes
const isDevMode = false;

type SkyInspectorOptions = {
  apiKey?: string;
  onerror?: (error: Error) => void;
} & InspectorOptions & {
    inspectorType?: 'node' | 'browser';
    WebSocket?: typeof WebSocket;
  };

type SkyInspectorResult = {
  connectToWebSocketServer: () => Promise<string>;
  createInspector: () => Inspector<Adapter>;
};

export function createSkyInspector(
  options: SkyInspectorOptions = {}
): SkyInspectorResult {
  const { host, apiBaseURL } = {
    host: isDevMode
      ? 'localhost:1999'
      : 'stately-sky-beta.mellson.partykit.dev',
    apiBaseURL: isDevMode
      ? 'http://localhost:3000/registry/api/sky'
      : 'https://stately.ai/registry/api/sky',
  };
  const server = apiBaseURL.replace('/api/sky', '');
  const { apiKey, onerror, ...inspectorOptions } = options;
  // const sessionId = uuidv4();
  const sessionId = 'learningtocodemakeslifeeasier';
  const room = `inspect-${sessionId}`;
  const defaultWS = isNode ? require('isomorphic-ws') : undefined;
  const liveInspectUrl = `${server}/inspect/${sessionId}`;

  let socket: PartySocket | null = null;

  const connectToWebSocketServer = (): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      socket = new PartySocket({
        host,
        room,
        WebSocket: inspectorOptions?.WebSocket ?? defaultWS,
      });

      socket.onerror = (error: Event) => {
        if (onerror) {
          onerror(new Error(error.type));
        } else {
          console.error(error);
        }
        reject(new Error(error.type));
      };

      socket.onopen = () => {
        console.log('Connected to Sky, link to your live inspect session:');
        console.log(liveInspectUrl);
        resolve(liveInspectUrl);
      };
    });
  };

  const createInspector = (): Inspector<Adapter> => {
    if (!socket) {
      throw new Error(
        'WebSocket connection not established. Call connectToWebSocketServer first.'
      );
    }

    const sendEvent = (event: any): void => {
      const skyEvent = apiKey ? { apiKey, ...event } : event;
      socket!.send(stringify(skyEvent));
    };

    if (inspectorOptions?.inspectorType === 'node' || isNode) {
      return inspectCreator({
        ...inspectorOptions,
        send: sendEvent,
      });
    } else {
      return createBrowserInspector({
        ...inspectorOptions,
        url: liveInspectUrl,
        send: sendEvent,
      });
    }
  };

  return {
    connectToWebSocketServer,
    createInspector,
  };
}
