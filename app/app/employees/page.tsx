'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { dataQuery, dataInsert, dataUpdate } from '@/lib/org-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus, Users, AlertCircle, ShieldAlert, Mail } from 'lucide-react';

interface Member {
  id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
  email?: string;
}

export default function EmployeesPage() {
  const { orgId, orgRole, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isAdmin = orgRole === 'admin';

  const fetchMembers = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await dataQuery<Member>('organization_members', {
        select: 'id, user_id, role, is_active, created_at',
        eq: { org_id: orgId },
        order: { column: 'created_at', ascending: false },
      });

      // Fetch emails from auth.users via the user_id
      // Since we can't directly query auth.users, we'll use the profiles or just show user_id
      // In a real app, there would be a profiles table. For now, we'll show what we have.
      setMembers(data ?? []);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/app/dashboard');
      return;
    }
    if (orgId && isAdmin) {
      fetchMembers();
    }
  }, [orgId, isAdmin, authLoading, router, fetchMembers]);

  const handleAddMember = async () => {
    if (!orgId) return;
    setError('');

    if (!newEmail.trim()) {
      setError('Email is required');
      return;
    }

    setAdding(true);
    try {
      // Look up the user by email in auth.users
      // We need to use a server function or edge function for this
      // For now, we'll try to find the user via the auth API
      // Actually, we can't do that. Let's use a different approach.
      // We'll insert into organization_members with a placeholder and let an admin approve
      // But we need the user_id. Let's try querying via RPC or just show the flow.

      // For this implementation, we'll use the supabase admin API to look up the user
      // Since we can't do that client-side, we'll create an invitation flow
      // For now, let's just show the error that this requires server-side implementation

      setError('Adding members requires server-side implementation. Please use the Supabase dashboard to add members.');
    } catch (err: any) {
      setError(err.message || 'Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: string) => {
    if (!orgId) return;
    setUpdatingId(memberId);
    try {
      await dataUpdate('organization_members', { role }, { id: memberId, org_id: orgId });

      // Log to audit
      await dataInsert('audit_log', {
        org_id: orgId,
        action: 'update',
        entity_type: 'member',
        entity_id: memberId,
        description: `Changed member role to ${role}`,
      });

      fetchMembers();
    } catch (error) {
      console.error('Error updating role:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleActive = async (member: Member) => {
    if (!orgId) return;
    setUpdatingId(member.id);
    try {
      await dataUpdate('organization_members', { is_active: !member.is_active }, { id: member.id, org_id: orgId });

      // Log to audit
      await dataInsert('audit_log', {
        org_id: orgId,
        action: 'update',
        entity_type: 'member',
        entity_id: member.id,
        description: `${member.is_active ? 'Deactivated' : 'Activated'} member`,
      });

      fetchMembers();
    } catch (error) {
      console.error('Error toggling active:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  if (authLoading || !orgId) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!isAdmin) {
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

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your organization members
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add Member
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Organization Members</CardTitle>
          <CardDescription>{members.length} total members</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium text-foreground">No members found</p>
              <p className="text-xs mt-1">Add your first member to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-mono text-xs">
                      {member.user_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Select
                        value={member.role}
                        onValueChange={(value) => handleRoleChange(member.id, value)}
                        disabled={updatingId === member.id}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={member.is_active ? 'active' : 'inactive'} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(member.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(member)}
                        disabled={updatingId === member.id}
                      >
                        {member.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Member</DialogTitle>
            <DialogDescription>
              Invite a new member to your organization by email
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="newmember@company.com"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded">
              <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={adding}>
              {adding ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
