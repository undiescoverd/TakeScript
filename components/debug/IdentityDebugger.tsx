"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function IdentityDebugger() {
  const [showDebug, setShowDebug] = useState(false);
  const identityData = useQuery(api.debug.checkIdentity);
  const forceUpdate = useMutation(api.debug.forceUpdateUserName);
  const [updateResult, setUpdateResult] = useState<any>(null);

  const handleForceUpdate = async () => {
    try {
      const result = await forceUpdate();
      setUpdateResult(result);
    } catch (error: any) {
      setUpdateResult({ error: error.message });
    }
  };

  if (!showDebug) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDebug(true)}
        className="fixed bottom-4 right-4 z-50"
      >
        Debug Identity
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-[500px] max-h-[600px] overflow-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Identity Debug Info
          <Button variant="ghost" size="sm" onClick={() => setShowDebug(false)}>
            ✕
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {identityData && (
          <>
            <div>
              <h3 className="font-bold mb-2">Clerk Identity Fields:</h3>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                {JSON.stringify(identityData.identity, null, 2)}
              </pre>
            </div>

            <div>
              <h3 className="font-bold mb-2">User in Database:</h3>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                {JSON.stringify(identityData.userInDb, null, 2)}
              </pre>
            </div>

            <Button onClick={handleForceUpdate} className="w-full">
              Force Update User Name
            </Button>

            {updateResult && (
              <div>
                <h3 className="font-bold mb-2">Update Result:</h3>
                <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                  {JSON.stringify(updateResult, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
