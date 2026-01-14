import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import AIVideo from "./pages/AIVideo";
import AIVideoResult from "./pages/AIVideoResult";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import BatchUpload from "./pages/BatchUpload";
import JobList from "./pages/JobList";
import Glossary from "./pages/Glossary";
import More from "./pages/More";
import ParseResultJSON from "./pages/ParseResultJSON";
import ParseList from "./pages/ParseList";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            {/* Figma-based main dashboard */}
            <Route path="/" element={<Index />} />
            {/* AI video workflow */}
            <Route path="/ai-video" element={<AIVideo />} />
            <Route path="/ai-video/result/:id" element={<AIVideoResult />} />
            <Route path="/glossary" element={<Glossary />} />
            <Route path="/more" element={<More />} />
            {/* Public helpers */}
            <Route path="/upload" element={<BatchUpload />} />
            <Route path="/jobs" element={<JobList />} />
            {/* Parse results */}
            <Route path="/parse" element={<ParseList />} />
            <Route path="/parse/:runId" element={<ParseResultJSON />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
