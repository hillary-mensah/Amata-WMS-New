'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/lib/store';

export default function UsersPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Users</h1>
      <Card>
        <CardHeader>
          <CardTitle>Current User</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm"><span className="font-medium">Name:</span> {user?.firstName} {user?.lastName}</p>
            <p className="text-sm"><span className="font-medium">Email:</span> {user?.email}</p>
            <p className="text-sm"><span className="font-medium">Role:</span> {user?.role}</p>
            <p className="text-sm"><span className="font-medium">Branch:</span> {user?.branchName || 'N/A'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}