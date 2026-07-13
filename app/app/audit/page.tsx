'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { dataQuery } from '@/lib/org-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollText, Search, ShieldAlert } from 'lucide-react';

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string;
  created_at: string;
  member_id: string | null;
}

export default function AuditLogPage() {
  const { orgId, orgRole, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const fetchEntries = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const eq: Record<string, any> = { org_id: orgId };
      if (actionFilter !== 'all') {
        eq.action = actionFilter;
      }

      const data = await dataQuery<AuditEntry>('audit_log', {
        select: 'id, action, entity_type, entity_id, description, created_at, member_id',
        eq,
        order: { column: 'created_at', ascending: false },
        limit: 200,
      });

      setEntries(data ?? []);
    } catch (error) {
      console.error('Error fetching audit log:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId, actionFilter]);

  useEffect(() => {
    if (!authLoading && orgRole !== 'admin') {
      router.push('/app/dashboard');
      return;
    }
    if (orgId && orgRole === 'admin') {
      fetchEntries();
    }
  }, [orgId, orgRole, authLoading, router, fetchEntries]);

  const filteredEntries = entries.filter((entry) => {
    const searchLower = search.toLowerCase();
    return (
      entry.description.toLowerCase().includes(searchLower) ||
      (entry.entity_type?.toLowerCase().includes(searchLower) ?? false) ||
      entry.action.toLowerCase().includes(searchLower)
    );
  });

  if (authLoading || !orgId) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (orgRole !== 'admin') {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Access Denied</h2>
            <p className="text-sm text-muted-foreground mt-1">
              You need admin privileges to view this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const actionColors: Record<string, string> = {
    create: 'text-green-600 bg-green-50',
    update: 'text-blue-600 bg-blue-50',
    delete: 'text-red-600 bg-red-50',
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track all activities within your organization
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity Log</CardTitle>
          <CardDescription>
            {entries.length} recent {entries.length === 1 ? 'entry' : 'entries'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by description or entity..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ScrollText className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium text-foreground">
                {search || actionFilter !== 'all' ? 'No entries match your filters' : 'No audit entries yet'}
              </p>
              <p className="text-xs mt-1">
                {search || actionFilter !== 'all' ? 'Try adjusting your search or filters' : 'Activities will be logged here as they occur'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          actionColors[entry.action] ?? 'text-gray-600 bg-gray-50'
                        }`}
                      >
                        {entry.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm capitalize">
                      {entry.entity_type ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">{entry.description}</TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
