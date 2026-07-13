'use client';

import { ShieldAlert, MonitorX, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { takeoverTab } from '@/lib/tab-guard';

interface Props {
  reason: 'another_tab' | 'takeover' | 'session_replaced';
  onUseThisTab?: () => void;
  onSignIn?: () => void;
}

export function SessionConflictScreen({ reason, onUseThisTab, onSignIn }: Props) {
  if (reason === 'session_replaced') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-destructive" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">Session Ended</h1>
            <p className="text-sm text-muted-foreground">
              Your account was signed in from another device or browser.
              For security, this session has been ended.
            </p>
          </div>
          <Button className="w-full" onClick={onSignIn}>
            <LogIn className="w-4 h-4 mr-2" />
            Sign In Again
          </Button>
        </div>
      </div>
    );
  }

  if (reason === 'takeover') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
              <MonitorX className="w-8 h-8 text-orange-600" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">Session Moved</h1>
            <p className="text-sm text-muted-foreground">
              The session was moved to another tab. This tab is now inactive.
            </p>
          </div>
          <Button className="w-full" onClick={onSignIn}>
            <LogIn className="w-4 h-4 mr-2" />
            Sign In Again
          </Button>
        </div>
      </div>
    );
  }

  // another_tab
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <MonitorX className="w-8 h-8 text-amber-600" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">Already Open</h1>
          <p className="text-sm text-muted-foreground">
            Your account is already open in another tab.
            Only one tab is allowed at a time.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button
            className="w-full"
            onClick={() => {
              takeoverTab();
              onUseThisTab?.();
            }}
          >
            Use This Tab
          </Button>
          <Button variant="outline" className="w-full" onClick={() => window.close()}>
            Close This Tab
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Choosing "Use This Tab" will close the other tab's session.
        </p>
      </div>
    </div>
  );
}
