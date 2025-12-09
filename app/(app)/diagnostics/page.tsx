"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, XCircle, Wrench } from "lucide-react";

export default function DiagnosticsPage() {
  const scriptsHealth = useQuery(api.diagnostics.listAllScriptsHealth);
  const [selectedScriptId, setSelectedScriptId] = useState<Id<"scripts"> | null>(null);
  const scriptDetail = useQuery(
    api.diagnostics.checkScriptHealth,
    selectedScriptId ? { scriptId: selectedScriptId } : "skip"
  );
  const repairPreview = useQuery(
    api.diagnostics.repairScript,
    selectedScriptId ? { scriptId: selectedScriptId } : "skip"
  );
  const applyRepair = useMutation(api.diagnostics.applyRepair);

  const handleRepair = async (scriptId: Id<"scripts">) => {
    try {
      const result = await applyRepair({ scriptId });
      alert(`✅ ${result.message}`);
      setSelectedScriptId(null); // Refresh
      window.location.reload(); // Reload to see changes
    } catch (error) {
      alert(`❌ Repair failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (!scriptsHealth) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse">Loading diagnostics...</div>
      </div>
    );
  }

  if ("error" in scriptsHealth) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-destructive">Error: {scriptsHealth.error}</div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ok":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> OK</Badge>;
      case "empty":
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" /> Empty</Badge>;
      case "invalid_structure":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Invalid Structure</Badge>;
      case "parse_error":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Parse Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Script Diagnostics</h1>
        <p className="text-muted-foreground mt-2">
          Check the health of your scripts and repair any issues
        </p>
      </div>

      <div className="grid gap-4">
        {scriptsHealth.map((script) => (
          <Card key={script.id} className={script.contentStatus !== "ok" ? "border-destructive" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{script.title}</CardTitle>
                  <CardDescription>
                    Last edited: {new Date(script.lastEditedAt).toLocaleString()}
                  </CardDescription>
                </div>
                {getStatusBadge(script.contentStatus)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Content length: {script.contentLength} characters
                </div>
                {script.contentError && (
                  <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                    Error: {script.contentError}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedScriptId(script.id)}
                  >
                    View Details
                  </Button>
                  {script.contentStatus !== "ok" && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleRepair(script.id)}
                    >
                      <Wrench className="w-4 h-4 mr-1" /> Repair
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedScriptId && scriptDetail && "contentType" in scriptDetail && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Detailed Diagnostics</CardTitle>
            <CardDescription>Script ID: {selectedScriptId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium">Status</div>
                <div>{scriptDetail.status}</div>
              </div>
              <div>
                <div className="font-medium">Content Type</div>
                <div>{scriptDetail.contentType}</div>
              </div>
              <div>
                <div className="font-medium">Title</div>
                <div>{scriptDetail.title}</div>
              </div>
              <div>
                <div className="font-medium">Content Length</div>
                <div>{scriptDetail.contentLength}</div>
              </div>
            </div>

            {scriptDetail.issues && scriptDetail.issues.length > 0 && (
              <div>
                <div className="font-medium mb-2">Issues Found:</div>
                <ul className="list-disc list-inside space-y-1 text-sm text-destructive">
                  {scriptDetail.issues.map((issue: string, idx: number) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="font-medium mb-2">Content Preview:</div>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                {scriptDetail.contentPreview}
              </pre>
            </div>

            {repairPreview && repairPreview.success && (
              <div className="border-t pt-4">
                <div className="font-medium mb-2">Repair Preview:</div>
                <div className="text-sm space-y-2">
                  <div>Strategy: <Badge>{repairPreview.repairStrategy}</Badge></div>
                  <div>
                    Original size: {repairPreview.originalContentLength} characters
                    → Repaired size: {repairPreview.repairedContentLength} characters
                  </div>
                  <div className="mt-4">
                    <Button onClick={() => handleRepair(selectedScriptId)}>
                      <Wrench className="w-4 h-4 mr-2" /> Apply Repair
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <Button variant="outline" onClick={() => setSelectedScriptId(null)}>
              Close
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
