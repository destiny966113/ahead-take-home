import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listParseRuns, retryRun, retryAllFailed } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Eye, RefreshCw, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getParseRunsCount } from "@/lib/api";

export default function ParseList() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [retryingAll, setRetryingAll] = useState(false);
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null);

  useEffect(() => {
    loadRuns();
  }, [page, pageSize]);

  async function loadRuns() {
    try {
      setLoading(true);
      const [data, count] = await Promise.all([
        listParseRuns(page, pageSize),
        getParseRunsCount()
      ]);
      setRuns(data);
      setTotalCount(count);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Failed to load parse runs");
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadgeVariant(status: string) {
    switch (status) {
      case "approved":
        return "default";
      case "draft":
        return "secondary";
      case "rejected":
        return "destructive";
      default:
        return "outline";
    }
  }

  async function handleRetryRun(runId: string) {
    try {
      setRetryingRunId(runId);
      await retryRun(runId);
      toast({
        title: "重試成功",
        description: "已重新排程該任務",
      });
      await loadRuns();
    } catch (e: any) {
      toast({
        title: "重試失敗",
        description: e?.message || "請稍後再試",
        variant: "destructive",
      });
    } finally {
      setRetryingRunId(null);
    }
  }

  async function handleRetryAllFailed() {
    const failedRuns = runs.filter(r => r.task_state === "failed");
    if (failedRuns.length === 0) {
      toast({
        title: "沒有失敗的任務",
        description: "目前沒有需要重試的失敗任務",
      });
      return;
    }

    try {
      setRetryingAll(true);
      const result = await retryAllFailed();
      toast({
        title: "批次重試成功",
        description: `已重新排程 ${result.retried_count} 個失敗任務`,
      });
      await loadRuns();
    } catch (e: any) {
      toast({
        title: "批次重試失敗",
        description: e?.message || "請稍後再試",
        variant: "destructive",
      });
    } finally {
      setRetryingAll(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Parse Runs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              View and manage PDF parsing results
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleRetryAllFailed}
              disabled={retryingAll || runs.filter(r => r.task_state === "failed").length === 0}
            >
              <RotateCcw className={`w-4 h-4 mr-2 ${retryingAll ? "animate-spin" : ""}`} />
              重試所有失敗任務
            </Button>
            <Button variant="outline" onClick={loadRuns} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={() => navigate("/")}>
              Back to Home
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading && runs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading parse runs...
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-destructive mb-4">{error}</div>
              <Button onClick={loadRuns}>Try Again</Button>
            </CardContent>
          </Card>
        ) : runs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No parse runs found
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>All Parse Runs</CardTitle>

              <CardDescription className="flex items-center justify-between">
                <span>
                  Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCount)} of {totalCount} parse run{totalCount !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground mr-2">Rows per page</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => {
                      setPageSize(Number(v));
                      setPage(1); // Reset to first page
                    }}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue placeholder={pageSize} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Filename</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Task State</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => (
                      <TableRow key={run.run_id}>
                        <TableCell className="font-medium">
                          {run.filename || "Unknown"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(run.parse_status)}>
                            {String(run.parse_status).toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {run.task_state ? (
                            <Badge variant="outline">{run.task_state}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {run.created_at
                            ? new Date(run.created_at).toLocaleString()
                            : "N/A"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {run.task_state === "failed" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRetryRun(run.run_id)}
                                disabled={retryingRunId === run.run_id}
                              >
                                <RotateCcw className={`w-4 h-4 mr-2 ${retryingRunId === run.run_id ? "animate-spin" : ""}`} />
                                重試
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/parse/${run.run_id}`)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination Controls */}
              <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="text-sm font-medium">
                  Page {page} of {Math.ceil(totalCount / pageSize)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                  disabled={page >= Math.ceil(totalCount / pageSize) || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
