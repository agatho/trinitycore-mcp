/**
 * TrinityCore SOAP API Endpoint
 *
 * Proxies requests to TrinityCore's SOAP API and returns data in a structured format.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getOnlinePlayers,
  getServerStatus,
  getServerInfo,
  executeCommand,
  testConnection,
  broadcastMessage,
  kickPlayer,
  saveAll,
  reloadConfig,
  getSOAPConfig,
  MockSOAPClient,
} from '@/lib/soap-client';

/**
 * GET /api/soap?action=<action>&params...
 *
 * Supported actions:
 * - players: Get list of online players
 * - status: Get server status
 * - info: Get detailed server info
 * - test: Test SOAP connection
 * - command: Execute custom command (requires 'cmd' param)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    // Use mock client in development if SOAP is not configured
    const useMock = process.env.TRINITY_SOAP_MOCK === 'true' || !process.env.TRINITY_SOAP_HOST;

    if (useMock) {
      const mockClient = new MockSOAPClient();

      switch (action) {
        case 'players': {
          const players = await mockClient.getOnlinePlayers();
          return NextResponse.json({ players });
        }

        case 'status': {
          const status = await mockClient.getServerStatus();
          return NextResponse.json({ status });
        }

        case 'info': {
          const result = await mockClient.executeCommand('server info');
          return NextResponse.json({ info: result.result });
        }

        case 'test': {
          return NextResponse.json({ connected: true, mock: true });
        }

        case 'command': {
          const cmd = searchParams.get('cmd');
          if (!cmd) {
            return NextResponse.json({ error: 'Missing cmd parameter' }, { status: 400 });
          }
          const result = await mockClient.executeCommand(cmd);
          return NextResponse.json(result);
        }

        default:
          return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
      }
    }

    // Real SOAP API calls
    switch (action) {
      case 'players': {
        const players = await getOnlinePlayers();
        return NextResponse.json({ players });
      }

      case 'status': {
        const status = await getServerStatus();
        return NextResponse.json({ status });
      }

      case 'info': {
        const info = await getServerInfo();
        return NextResponse.json({ info });
      }

      case 'test': {
        const connected = await testConnection();
        return NextResponse.json({ connected, mock: false });
      }

      case 'command': {
        const cmd = searchParams.get('cmd');
        if (!cmd) {
          return NextResponse.json({ error: 'Missing cmd parameter' }, { status: 400 });
        }

        const result = await executeCommand(cmd);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('SOAP API Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'SOAP request failed',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/soap
 *
 * Execute administrative commands that modify server state.
 *
 * Body:
 * {
 *   action: 'broadcast' | 'kick' | 'save' | 'reload',
 *   ...params
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Use mock client in development
    const useMock = process.env.TRINITY_SOAP_MOCK === 'true' || !process.env.TRINITY_SOAP_HOST;

    if (useMock) {
      const mockClient = new MockSOAPClient();

      switch (action) {
        case 'broadcast':
          return NextResponse.json({
            success: true,
            result: `Mock broadcast: ${body.message}`,
          });

        case 'kick':
          return NextResponse.json({
            success: true,
            result: `Mock kick: ${body.playerName}`,
          });

        case 'save':
          return NextResponse.json({
            success: true,
            result: 'Mock save all executed',
          });

        case 'reload':
          return NextResponse.json({
            success: true,
            result: 'Mock reload config executed',
          });

        default:
          return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
      }
    }

    // Real SOAP API calls
    switch (action) {
      case 'broadcast': {
        const { message } = body;
        if (!message) {
          return NextResponse.json({ error: 'Missing message' }, { status: 400 });
        }
        const result = await broadcastMessage(message);
        return NextResponse.json(result);
      }

      case 'kick': {
        const { playerName, reason } = body;
        if (!playerName) {
          return NextResponse.json({ error: 'Missing playerName' }, { status: 400 });
        }
        const result = await kickPlayer(playerName, reason);
        return NextResponse.json(result);
      }

      case 'save': {
        const result = await saveAll();
        return NextResponse.json(result);
      }

      case 'reload': {
        const result = await reloadConfig();
        return NextResponse.json(result);
      }

      case 'execute': {
        const { command } = body;
        if (!command) {
          return NextResponse.json({ error: 'Missing command' }, { status: 400 });
        }
        const result = await executeCommand(command);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('SOAP API Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'SOAP request failed',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
