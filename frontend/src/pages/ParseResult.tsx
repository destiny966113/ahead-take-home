import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getParseRun, updateParseMetadata, ParseRunResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileText, Table as TableIcon, Image, Edit, Save, X } from "lucide-react";
import { toast } from "sonner";

export default function ParseResult() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ParseRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [editedMetadata, setEditedMetadata] = useState<any>(null);

  useEffect(() => {
    if (!runId) return;
    loadData();
  }, [runId]);

  async function loadData() {
    try {
      setLoading(true);
      const result = await getParseRun(runId!);
      setData(result);
      setEditedMetadata(result.metadata);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Failed to load parse result");
      toast.error("Failed to load parse result");
    } finally {
      setLoading(false);
    }
  }

  function handleEdit() {
    setEditing(true);
  }

  function handleCancelEdit() {
    setEditedMetadata(data?.metadata);
    setEditing(false);
  }

  async function handleSave() {
    try {
      await updateParseMetadata(runId!, editedMetadata);
      toast.success("Changes saved successfully");
      setEditing(false);
      // Reload data to get the updated version
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save changes");
      console.error("Save error:", e);
    }
  }

  function renderTableContent(content: any) {
    if (!content || !content.rows) return <div className="text-muted-foreground">No table data</div>;

    return (
      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableBody>
            {content.rows.map((row: any[], rowIdx: number) => (
              <TableRow key={rowIdx}>
                {row.map((cell: any, cellIdx: number) => {
                  const cellText = typeof cell === 'object' ? cell.text : cell;
                  const colspan = typeof cell === 'object' ? cell.colspan : undefined;
                  const rowspan = typeof cell === 'object' ? cell.rowspan : undefined;
                  
                  return (
                    <TableCell 
                      key={cellIdx}
                      colSpan={colspan}
                      rowSpan={rowspan}
                      className={rowIdx === 0 ? "font-semibold bg-muted" : ""}
                    >
                      {cellText || ""}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  function renderFigureContent(content: any) {
    if (!content) return <div className="text-muted-foreground">No figure data</div>;

    return (
      <div className="space-y-4">
        {content.image && content.image.path && (
          <div className="border rounded-lg p-4 bg-muted/50">
            <div className="text-sm text-muted-foreground mb-2">
              Image: {content.image.path}
            </div>
            {content.image.page && (
              <div className="text-sm text-muted-foreground">
                Page: {content.image.page}
              </div>
            )}
            {content.image.bbox && (
              <div className="text-sm text-muted-foreground">
                BBox: [{content.image.bbox.join(", ")}]
              </div>
            )}
          </div>
        )}
        {content.caption && (
          <div className="text-sm">
            <span className="font-semibold">Caption:</span> {content.caption}
          </div>
        )}
      </div>
    );
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
          <Button onClick={() => navigate("/")}>Go Back</Button>
        </div>
      </div>
    );
  }

  const tables = data.elements.filter(e => e.type === "table");
  const figures = data.elements.filter(e => e.type === "figure");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">Parse Result</h1>
              <p className="text-sm text-muted-foreground">Run ID: {data.run.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button variant="outline" onClick={handleCancelEdit}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </>
            ) : (
              <Button onClick={handleEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
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
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Paper ID</Label>
                <div className="font-mono text-sm">{data.paper.id}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Source PDF</Label>
                <div className="text-sm">{data.paper.source_pdf}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">File Hash</Label>
                <div className="font-mono text-xs">{data.paper.file_hash}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Created At</Label>
                <div className="text-sm">{data.paper.created_at ? new Date(data.paper.created_at).toLocaleString() : "N/A"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Parse Run Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Parse Run Status</CardTitle>
            <CardDescription>Run ID: {data.run.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
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
              {data.run.task_state && (
                <Badge variant="outline">{String(data.run.task_state).toUpperCase()}</Badge>
              )}
            </div>
            {data.run.error_msg && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                Error: {data.run.error_msg}
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold">{data.run.result.tables}</div>
                <div className="text-sm text-muted-foreground">Tables</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{data.run.result.figures}</div>
                <div className="text-sm text-muted-foreground">Figures</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{data.elements.length}</div>
                <div className="text-sm text-muted-foreground">Total Elements</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metadata Card */}
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
            <CardDescription>Extracted paper metadata</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <>
                <div>
                  <Label htmlFor="omip_id">OMIP ID</Label>
                  <Input
                    id="omip_id"
                    value={editedMetadata?.omip_id || ""}
                    onChange={(e) => setEditedMetadata({ ...editedMetadata, omip_id: e.target.value })}
                    placeholder="OMIP-001"
                  />
                </div>
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={editedMetadata?.title || ""}
                    onChange={(e) => setEditedMetadata({ ...editedMetadata, title: e.target.value })}
                    placeholder="Paper title"
                  />
                </div>
                <div>
                  <Label htmlFor="authors">Authors (comma-separated)</Label>
                  <Input
                    id="authors"
                    value={editedMetadata?.authors?.join(", ") || ""}
                    onChange={(e) => setEditedMetadata({ ...editedMetadata, authors: e.target.value.split(",").map(a => a.trim()) })}
                    placeholder="Author 1, Author 2"
                  />
                </div>
                <div>
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    value={editedMetadata?.year || ""}
                    onChange={(e) => setEditedMetadata({ ...editedMetadata, year: parseInt(e.target.value) })}
                    placeholder="2024"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="text-muted-foreground">OMIP ID</Label>
                  <div className="text-lg font-semibold">{data.run.result.omip_id || "N/A"}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Title</Label>
                  <div>{data.run.result.title || "N/A"}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Authors</Label>
                  <div>{data.run.result.authors.length > 0 ? data.run.result.authors.join(", ") : "N/A"}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Year</Label>
                  <div>{data.run.result.year || "N/A"}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Elements Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Extracted Elements</CardTitle>
            <CardDescription>Tables and figures extracted from the PDF</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">All ({data.elements.length})</TabsTrigger>
                <TabsTrigger value="tables">
                  <TableIcon className="w-4 h-4 mr-2" />
                  Tables ({tables.length})
                </TabsTrigger>
                <TabsTrigger value="figures">
                  <Image className="w-4 h-4 mr-2" />
                  Figures ({figures.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-4 mt-4">
                {data.elements.map((element) => (
                  <Card key={element.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {element.type === "table" ? <TableIcon className="w-4 h-4" /> : <Image className="w-4 h-4" />}
                          {element.label || `${element.type} ${element.order_index + 1}`}
                        </CardTitle>
                        <Badge variant="outline">{element.type}</Badge>
                      </div>
                      {element.caption && (
                        <CardDescription>{element.caption}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      {element.type === "table" ? renderTableContent(element.content) : renderFigureContent(element.content)}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="tables" className="space-y-4 mt-4">
                {tables.map((element) => (
                  <Card key={element.id}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TableIcon className="w-4 h-4" />
                        {element.label || `Table ${element.order_index + 1}`}
                      </CardTitle>
                      {element.caption && (
                        <CardDescription>{element.caption}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      {renderTableContent(element.content)}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="figures" className="space-y-4 mt-4">
                {figures.map((element) => (
                  <Card key={element.id}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Image className="w-4 h-4" />
                        {element.label || `Figure ${element.order_index + 1}`}
                      </CardTitle>
                      {element.caption && (
                        <CardDescription>{element.caption}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      {renderFigureContent(element.content)}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
