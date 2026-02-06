import { useState } from 'react';
import { FileText, Github, Copy, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { generateReportApi, publishReportApi, type ReportSections } from '@/lib/api';

interface ReportActionsProps {
  analysisId: string;
  packageName: string;
  grade: string;
}

const SECTION_OPTIONS: { key: keyof ReportSections; label: string; description: string }[] = [
  { key: 'scores', label: 'Score Breakdown', description: 'Dimension scores and grade rationale' },
  { key: 'repoHealth', label: 'Repository Health', description: 'Stars, forks, contributors, bus factor' },
  { key: 'findings', label: 'Findings', description: 'Security and maintenance findings by severity' },
  { key: 'alternatives', label: 'Alternatives', description: 'Alternative packages with migration info' },
  { key: 'verdict', label: 'Verdict', description: 'Overall recommendation' },
];

const ReportActions = ({ analysisId, packageName, grade }: ReportActionsProps) => {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [sections, setSections] = useState<ReportSections>({
    scores: true,
    repoHealth: true,
    findings: true,
    alternatives: true,
    verdict: true,
  });
  const { toast } = useToast();

  const toggleSection = (key: keyof ReportSections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await generateReportApi(analysisId, sections);
      setMarkdown(data.markdown);
      setDialogOpen(true);
    } catch (err: any) {
      toast({ title: 'Failed to generate report', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const data = await publishReportApi(analysisId, sections);
      toast({
        title: 'Published to GitHub',
        description: data.message,
      });
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (err: any) {
      if (err.markdown) {
        setMarkdown(err.markdown);
        setDialogOpen(true);
      }
      toast({
        title: 'Cannot publish to repo',
        description: `${err.message}. You can copy or download the report instead.`,
        variant: 'destructive',
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleCopy = async () => {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    toast({ title: 'Copied to clipboard' });
  };

  const handleDownload = () => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'DEPSCOPE.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="p-5 rounded-2xl bg-card/80 border border-border/60 shadow-lg shadow-black/20 backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Export your <span className="font-semibold text-foreground">{packageName}</span> (Grade {grade}) analysis as a DEPSCOPE.md report
          </p>
          <div className="flex gap-3 shrink-0 ml-4">
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={generating}
              className="gap-2"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Generate Report
            </Button>
            <Button
              variant="default"
              onClick={handlePublish}
              disabled={publishing}
              className="gap-2"
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
              Publish to Repo
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 pt-2 border-t border-border/40">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide self-center mr-1">Include:</span>
          {SECTION_OPTIONS.map(({ key, label, description }) => (
            <label
              key={key}
              className="flex items-center gap-2 cursor-pointer group"
              title={description}
            >
              <Checkbox
                checked={sections[key]}
                onCheckedChange={() => toggleSection(key)}
              />
              <span className="text-sm text-foreground group-hover:text-primary transition-colors">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              DEPSCOPE.md — {packageName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-3">
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
              <Copy className="w-3.5 h-3.5" /> Copy
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Download
            </Button>
          </div>
          <div className="flex-1 overflow-auto rounded-lg bg-muted/50 border border-border/40 p-4">
            <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">
              {markdown}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReportActions;
