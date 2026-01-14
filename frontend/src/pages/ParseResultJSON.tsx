import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getParseRun, updateParseMetadata, ParseRunResult, getRunVersions, getRunVersionContent, MetadataVersion } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, Edit, Save, X, Eye, Download, Copy, Check, History } from "lucide-react";
import { toast } from "sonner";

export default function ParseResultJSON() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ParseRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [jsonText, setJsonText] = useState<string>("");
  const [jsonError, setJsonError] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [versions, setVersions] = useState<MetadataVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("latest");
  const [loadingVersions, setLoadingVersions] = useState(false);

  useEffect(() => {
    if (!runId) return;
    loadData();
    loadVersions();
  }, [runId]);

  useEffect(() => {
    if (!runId || selectedVersion === "latest" || !versions.length) return;
    const v = versions.find(v => v.id === selectedVersion);
    if (v) loadVersionContent(v.id);
  }, [selectedVersion, versions]);

  useEffect(() => {
    if (versions.length > 0 && selectedVersion === "latest") {
      // Auto-select the most recent version (first in list)
      setSelectedVersion(versions[0].id);
    }
  }, [versions]);

  async function loadData() {
    try {
      setLoading(true);
      const result = await getParseRun(runId!);
      setData(result);
      // Format the complete result as JSON
      const fullJson = {
        paper: result.paper,
        run: result.run,
        metadata: result.metadata,
        elements: result.elements
      };
      setJsonText(JSON.stringify(fullJson, null, 2));
      setError("");
      setJsonError("");
      setError("");
      setJsonError("");
      // selectedVersion will be set by the useEffect when versions are loaded
    } catch (e: any) {
      setError(e?.message || "Failed to load parse result");
      toast.error("Failed to load parse result");
    } finally {
      setLoading(false);
    }
  }

  async function loadVersions() {
    try {
      setLoadingVersions(true);
      const versionList = await getRunVersions(runId!);
      setVersions(versionList);
    } catch (e: any) {
      console.error("Failed to load versions:", e);
      // Don't show error toast for versions, just log it
    } finally {
      setLoadingVersions(false);
    }
  }

  async function loadVersionContent(versionId: string) {
    try {
      setLoading(true);
      const versionContent = await getRunVersionContent(runId!, versionId);

      // Update JSON text with historical version data
      if (data) {
        const fullJson = {
          paper: data.paper,
          run: data.run,
          metadata: {
            omip_id: versionContent.omip_id,
            title: versionContent.title,
            authors: versionContent.authors || [],
            year: versionContent.year,
          },
          elements: versionContent.tables ?
            [...(versionContent.tables || []).map((t: any) => ({ type: 'table', ...t })),
             ...(versionContent.figures || []).map((f: any) => ({ type: 'figure', ...f }))]
            : data.elements,
        };
        setJsonText(JSON.stringify(fullJson, null, 2));
      }
      setError("");
      setJsonError("");
      toast.success("Version loaded");
    } catch (e: any) {
      toast.error(e?.message || "Failed to load version");
    } finally {
      setLoading(false);
    }
  }

  function handleEdit() {
    setEditing(true);
    setJsonError("");
  }

  function handleCancelEdit() {
    if (data) {
      const fullJson = {
        paper: data.paper,
        run: data.run,
        metadata: data.metadata,
        elements: data.elements
      };
      setJsonText(JSON.stringify(fullJson, null, 2));
    }
    setEditing(false);
    setJsonError("");
  }

  async function handleSave() {
    try {
      // Validate JSON
      const parsed = JSON.parse(jsonText);
      setJsonError("");
      
      // Extract metadata from the parsed JSON
      const metadata = parsed.metadata || {};
      
      // Save to backend
      await updateParseMetadata(runId!, metadata);
      toast.success("Changes saved successfully");
      setEditing(false);
      
      // Reload versions and select the new one
      const newVersions = await getRunVersions(runId!);
      setVersions(newVersions);
      if (newVersions.length > 0) {
        setSelectedVersion(newVersions[0].id);
      }
      
      // Reload data
      await loadData();
    } catch (e: any) {
      if (e instanceof SyntaxError) {
        setJsonError(`JSON Syntax Error: ${e.message}`);
        toast.error("Invalid JSON format");
      } else {
        setJsonError(e?.message || "Failed to save changes");
        toast.error(e?.message || "Failed to save changes");
      }
      console.error("Save error:", e);
    }
  }

  function handleJsonChange(value: string) {
    setJsonText(value);
    // Try to parse to check for errors
    try {
      JSON.parse(value);
      setJsonError("");
    } catch (e: any) {
      setJsonError(`JSON Error: ${e.message}`);
    }
  }

  function formatJson() {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      setJsonError("");
      toast.success("JSON formatted");
    } catch (e: any) {
      toast.error("Cannot format invalid JSON");
    }
  }

  function handleCopyJson() {
    navigator.clipboard.writeText(jsonText).then(() => {
      setCopied(true);
      toast.success("JSON copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error("Failed to copy JSON");
    });
  }

  function handleDownloadJson() {
    try {
      const blob = new Blob([jsonText], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `parse-result-${runId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("JSON downloaded");
    } catch (e: any) {
      toast.error("Failed to download JSON");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-destructive">{error || "Parse result not found"}</div>
          <Button onClick={() => navigate("/parse")}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/parse")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold">Review & Edit</h1>
                <Badge variant="outline" className="text-xs">
                  PARSER API Result
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Parsed from PARSER Server • Run ID: {data.run.id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Version Selector */}
            {versions.length > 0 && !editing && (
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                <Select
                  value={selectedVersion}
                  onValueChange={setSelectedVersion}
                >
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((version, idx) => {
                      const date = version.created_at
                        ? new Date(version.created_at).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : "Unknown date";
                      const versionLabel = `v${versions.length - idx}`;
                      const title = version.title || version.omip_id || "Untitled";

                      return (
                        <SelectItem key={version.id} value={version.id}>
                          {versionLabel}: {title.substring(0, 25)}
                          {title.length > 25 ? '...' : ''} ({date})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={formatJson}>
                  Format JSON
                </Button>
                <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!!jsonError}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={handleCopyJson}>
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy JSON
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadJson}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button size="sm" onClick={handleEdit}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit JSON
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Paper Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Paper Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Paper ID:</span>{" "}
                <span className="font-mono">{data.paper.id}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Source PDF:</span>{" "}
                <span>{data.paper.source_pdf}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                <Badge
                  variant={
                    data.run.status === "approved"
                      ? "default"
                      : data.run.status === "draft"
                      ? "secondary"
                      : data.run.status === "rejected"
                      ? "destructive"
                      : "outline"
                  }
                >
                  {String(data.run.status).toUpperCase()}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">OMIP ID:</span>{" "}
                <span className="font-semibold">{data.run.result.omip_id || "N/A"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Version Info Banner */}
        {/* We always show the version banner if we can identify which version it is, 
            or maybe we don't need it if we are sticking to "what you see is what you get" 
            but the user asked to remove "Latest" so effectively we are always determining 
            state from the selected version. For now keeping it simple. */}

        {/* JSON Editor Card */}
        <Card>
          <CardHeader>
            <CardTitle>PARSER Parsed JSON</CardTitle>
            <CardDescription>
              {editing
                ? "Edit the JSON data below and click Save to persist changes to the database"
                : "Complete JSON output from PARSER API including metadata, tables, and figures"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {jsonError && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md font-mono">
                {jsonError}
              </div>
            )}
            
            <div className="relative border rounded-lg overflow-hidden">
              {!editing && (
                <div className="absolute top-3 right-3 z-10">
                  <Badge variant="secondary" className="shadow-sm">
                    <Eye className="w-3 h-3 mr-1" />
                    Preview Mode
                  </Badge>
                </div>
              )}
              {editing && (
                <div className="absolute top-3 right-3 z-10">
                  <Badge variant="default" className="shadow-sm">
                    <Edit className="w-3 h-3 mr-1" />
                    Edit Mode
                  </Badge>
                </div>
              )}
              <Textarea
                value={jsonText}
                onChange={(e) => handleJsonChange(e.target.value)}
                readOnly={!editing}
                className={`font-mono text-xs min-h-[600px] border-0 focus-visible:ring-0 resize-none ${
                  editing
                    ? "bg-background"
                    : "bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300"
                }`}
                placeholder="JSON data..."
                spellCheck={false}
              />
            </div>

            {editing && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  📝 Editing Tips
                </p>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1.5">
                  <li>• Edit the <code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded text-xs font-mono">metadata</code> section to update paper information (omip_id, title, authors, year)</li>
                  <li>• Modify <code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded text-xs font-mono">elements</code> array to update tables and figures</li>
                  <li>• Use "Format JSON" button to auto-format and validate JSON structure</li>
                  <li>• JSON must be valid before saving - errors will be shown above</li>
                  <li>• Changes will be persisted to the database after clicking "Save Changes"</li>
                </ul>
              </div>
            )}

            {!editing && (
              <div className="text-sm text-muted-foreground border-t pt-4">
                <p className="font-medium mb-2">About this JSON:</p>
                <ul className="space-y-1.5">
                  <li>• <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">metadata</code>: Paper metadata (OMIP ID, title, authors, year)</li>
                  <li>• <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">elements</code>: Extracted tables and figures from the PDF</li>
                  <li>• <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">paper</code>: Source file information</li>
                  <li>• <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">run</code>: Parse job information and status</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{data.run.result.tables}</div>
                <div className="text-sm text-muted-foreground">Tables</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{data.run.result.figures}</div>
                <div className="text-sm text-muted-foreground">Figures</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{data.elements.length}</div>
                <div className="text-sm text-muted-foreground">Total Elements</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{data.run.result.authors.length}</div>
                <div className="text-sm text-muted-foreground">Authors</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
