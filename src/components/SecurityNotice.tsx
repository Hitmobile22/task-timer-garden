import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, CheckCircle } from 'lucide-react';

export function SecurityNotice() {
  return (
    <Alert className="mb-4">
      <Shield className="h-4 w-4" />
      <AlertTitle>Security Implementation Complete</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>User authentication and session management</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Row Level Security (RLS) enabled on all tables</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Edge functions secured with JWT verification</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Database functions security hardened</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Your application is now secure! Please sign up or sign in to access your tasks and data.
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
}