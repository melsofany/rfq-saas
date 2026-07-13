'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Database,
  Table as TableIcon,
  Copy,
  Check,
  Server,
  HardDrive,
  Globe,
  Hash,
} from 'lucide-react';
import { adminCount } from '@/lib/admin-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const DB_INFO = {
  name: 'rfq_saas',
  host: 'dpg-d9a0q8d8nd3s73a9n6og-a.oregon-postgres.render.com',
  port: 5432,
  user: 'rfq_admin',
  databaseId: 'dpg-d9a0q8d8nd3s73a9n6og-a',
  plan: 'basic_256mb',
  region: 'oregon',
  version: '16',
};

const TABLES_TO_COUNT = [
  'organizations',
  'subscriptions',
  'organization_members',
  'suppliers',
  'rfqs',
  'purchase_orders',
  'offers',
  'items',
  'audit_log',
  'company_settings',
  'saas_admins',
];

const CONNECTION_STRING = `postgresql://rfq_admin:••••••••@${DB_INFO.host}:${DB_INFO.port}/${DB_INFO.name}`;

export default function DatabasePage() {
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    try {
      const counts: Record<string, number> = {};
      for (const table of TABLES_TO_COUNT) {
        counts[table] = await adminCount(table);
      }
      setTableCounts(counts);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Table counts error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const handleCopy = () => {
    navigator.clipboard.writeText(CONNECTION_STRING);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dbInfoItems = [
    { label: 'Database Name', value: DB_INFO.name, icon: Database },
    { label: 'Host', value: DB_INFO.host, icon: Server },
    { label: 'Port', value: String(DB_INFO.port), icon: Hash },
    { label: 'User', value: DB_INFO.user, icon: HardDrive },
    { label: 'Database ID', value: DB_INFO.databaseId, icon: Hash },
    { label: 'Plan', value: DB_INFO.plan, icon: HardDrive },
    { label: 'Region', value: DB_INFO.region, icon: Globe },
    { label: 'Version', value: DB_INFO.version, icon: Server },
  ];

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Database</h1>
        <p className="text-sm text-muted-foreground">
          PostgreSQL database information and table statistics
        </p>
      </div>

      {/* Database Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Connection Information</CardTitle>
              <CardDescription>Render PostgreSQL database details</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {dbInfoItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-lg border p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  </div>
                  <p className="text-sm font-semibold truncate">{item.value}</p>
                </div>
              );
            })}
          </div>

          {/* Connection String */}
          <div className="mt-6 space-y-2">
            <p className="text-sm font-medium">Connection String</p>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
              <code className="flex-1 overflow-x-auto whitespace-nowrap text-sm font-mono text-muted-foreground">
                {CONNECTION_STRING}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4 text-success" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Password is masked for security. Use your actual password to connect.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Table Statistics */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TableIcon className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Table Statistics</CardTitle>
              <CardDescription>Row counts for each table in the database</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TABLES_TO_COUNT.map((table) => (
                <div
                  key={table}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <TableIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{table}</p>
                      <p className="text-xs text-muted-foreground">rows</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{tableCounts[table] ?? 0}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
