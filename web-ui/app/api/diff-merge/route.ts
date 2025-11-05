import { NextRequest, NextResponse } from 'next/server';
import { compareSchemas, generateMigrationScript, compareSQLFiles, generateUnifiedDiff, getDiffStatistics } from '@/lib/diff-merger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, localSchema, remoteSchema, localSQL, remoteSQL } = body;

    switch (action) {
      case 'compare-schemas':
        const diffs = compareSchemas(localSchema || [], remoteSchema || []);
        const stats = getDiffStatistics(diffs);
        return NextResponse.json({ diffs, stats });

      case 'generate-migration':
        const migration = generateMigrationScript(body.diffs, body.direction || 'up');
        return NextResponse.json({ migration });

      case 'compare-sql':
        const changes = compareSQLFiles(localSQL || '', remoteSQL || '');
        const diff = generateUnifiedDiff(changes);
        return NextResponse.json({ changes, diff });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
