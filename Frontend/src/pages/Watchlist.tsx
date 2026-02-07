import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, Plus, Trash2, RefreshCw, Phone, Shield, AlertTriangle,
  CheckCircle, Clock, Loader2,
} from 'lucide-react';
import Header from '@/components/Header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  getWatchlist, addToWatchlist, removeFromWatchlist, triggerScan,
  getScanHistory, configureAlertPhone,
  type WatchlistEntry,
} from '@/lib/api';

const gradeColor: Record<string, string> = {
  A: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  B: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  C: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  D: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  F: 'text-red-400 bg-red-400/10 border-red-400/30',
};

const Watchlist = () => {
  const { toast } = useToast();
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [addInput, setAddInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneConfigured, setPhoneConfigured] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [wl, sh] = await Promise.all([getWatchlist(), getScanHistory()]);
      setEntries(wl.entries);
      setScans(sh.scans);
    } catch (err: any) {
      toast({ title: 'Error loading watchlist', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addInput.trim()) return;
    setAdding(true);
    try {
      await addToWatchlist(addInput.trim());
      setAddInput('');
      toast({ title: 'Added to watchlist' });
      await refresh();
    } catch (err: any) {
      toast({ title: 'Failed to add', description: err.message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeFromWatchlist(id);
      toast({ title: 'Removed from watchlist' });
      await refresh();
    } catch (err: any) {
      toast({ title: 'Failed to remove', description: err.message, variant: 'destructive' });
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setScanStatus('Starting scan...');
    try {
      const { scan } = await triggerScan();
      const failed = scan.results?.filter((r: any) => r.grade === 'F') || [];
      if (failed.length > 0) {
        const failNames = failed.map((r: any) => r.packageName).join(', ');
        toast({
          title: `🚨 ${failed.length} package${failed.length > 1 ? 's' : ''} failing`,
          description: `${failNames} received grade F.${scan.alertTriggered ? ' Voice alert sent to your phone!' : phoneConfigured ? '' : ' Set alert phone to receive voice calls.'}`,
          variant: 'destructive',
        });
      } else {
        toast({ title: '✅ All clear', description: `All ${scan.results?.length || 0} packages are healthy.` });
      }
      await refresh();
    } catch (err: any) {
      toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
    } finally {
      setScanning(false);
      setScanStatus('');
    }
  };

  const handlePhoneSave = async () => {
    if (!phoneInput.trim()) return;
    setPhoneSaving(true);
    try {
      await configureAlertPhone(phoneInput.trim());
      setPhoneConfigured(phoneInput.trim());
      setPhoneDialogOpen(false);
      toast({ title: 'Alert phone configured', description: `Calls will go to ${phoneInput.trim()}` });
    } catch (err: any) {
      toast({ title: 'Failed to configure phone', description: err.message, variant: 'destructive' });
    } finally {
      setPhoneSaving(false);
    }
  };

  const latestScan = scans[0];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          {/* Title */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/15">
                <Eye className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-foreground">Watchlist</h2>
                <p className="text-sm text-muted-foreground">Monitor packages for security regressions — get a phone call when something fails.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPhoneDialogOpen(true)}
                className="gap-2"
              >
                <Phone className="w-4 h-4" />
                {phoneConfigured ? 'Phone set ✓' : 'Set alert phone'}
              </Button>
              <Button
                size="sm"
                onClick={handleScan}
                disabled={scanning || entries.length === 0}
                className="gap-2"
              >
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {scanning ? 'Scanning...' : 'Scan now'}
              </Button>
            </div>
          </div>

          {/* Add form */}
          <form onSubmit={handleAdd} className="flex gap-3 mb-8">
            <Input
              value={addInput}
              onChange={e => setAddInput(e.target.value)}
              placeholder="Package name or GitHub URL (e.g. lodash, https://github.com/user/repo)"
              className="flex-1"
              disabled={adding}
            />
            <Button type="submit" disabled={adding || !addInput.trim()} className="gap-2">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </Button>
          </form>

          {/* Scan progress banner */}
          {scanning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3"
            >
              <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Scanning watchlist...</p>
                <p className="text-xs text-muted-foreground">{scanStatus || 'Analyzing packages — this may take a minute per package.'}</p>
              </div>
            </motion.div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          )}

          {/* Empty state */}
          {!loading && entries.length === 0 && (
            <div className="text-center py-20">
              <Eye className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">No packages being monitored yet.</p>
              <p className="text-muted-foreground text-sm mt-1">Add a package above to start watching.</p>
            </div>
          )}

          {/* Watchlist entries */}
          {!loading && entries.length > 0 && (
            <div className="space-y-3 mb-12">
              <AnimatePresence>
                {entries.map((entry, i) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-card/80 border border-border/60 shadow-lg shadow-black/20 backdrop-blur-sm hover:border-primary/30 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4">
                      <Shield className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-foreground">{entry.packageName}</p>
                        {entry.owner && entry.repo && (
                          <p className="text-xs text-muted-foreground">{entry.owner}/{entry.repo}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {entry.lastGrade ? (
                        <Badge className={`text-lg font-bold px-3 py-1 ${gradeColor[entry.lastGrade] || ''}`}>
                          {entry.lastGrade}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not scanned</span>
                      )}
                      {entry.lastScanAt && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(entry.lastScanAt).toLocaleString()}
                        </span>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleRemove(entry.id)}>
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-400" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Scan history */}
          {scans.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Scan History
              </h3>
              <div className="space-y-3">
                {scans.slice(0, 10).map((scan: any) => {
                  const failCount = scan.results?.filter((r: any) => r.grade === 'F').length || 0;
                  const total = scan.results?.length || 0;
                  return (
                    <div
                      key={scan.id}
                      className="p-4 rounded-xl bg-card/80 border border-border/60 shadow-lg shadow-black/20 backdrop-blur-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {failCount > 0 ? (
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                          )}
                          <div>
                            <p className="font-medium text-foreground">
                              {failCount > 0
                                ? `${failCount} of ${total} packages failing`
                                : `All ${total} packages healthy`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(scan.startedAt).toLocaleString()}
                              {scan.alertTriggered && ' · Voice alert sent'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {scan.results?.map((r: any, j: number) => (
                            <Badge
                              key={j}
                              className={`text-xs ${gradeColor[r.grade] || ''}`}
                            >
                              {r.packageName}: {r.grade}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </main>

      {/* Phone dialog */}
      <Dialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Alert Phone</DialogTitle>
            <DialogDescription>
              Enter your phone number. If any package on your watchlist receives an F grade during a scan,
              you'll get a phone call with the details. Press 1 during the call to receive the full report via text.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={phoneInput}
            onChange={e => setPhoneInput(e.target.value)}
            placeholder="+1 555 123 4567"
            type="tel"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhoneDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePhoneSave} disabled={phoneSaving || !phoneInput.trim()}>
              {phoneSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Phone className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Watchlist;
