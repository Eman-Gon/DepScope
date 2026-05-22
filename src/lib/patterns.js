function getPatternInsights(analysisHistory) {
  if (analysisHistory.length < 2) return null;

  const total = analysisHistory.length;
  const gradeValues = { A: 4, B: 3, C: 2, D: 1, F: 0 };
  const avgGradeNum = analysisHistory.reduce((sum, analysis) => (
    sum + (gradeValues[analysis.grade] ?? 0)
  ), 0) / total;
  const avgGradeLetter =
    avgGradeNum >= 3.5 ? 'A' :
    avgGradeNum >= 2.5 ? 'B' :
    avgGradeNum >= 1.5 ? 'C' :
    avgGradeNum >= 0.5 ? 'D' : 'F';

  const singleMaintainerCount = analysisHistory.filter(
    analysis => analysis.repoHealth?.busFactorScore === 'critical'
  ).length;
  const withCVEs = analysisHistory.filter(
    analysis => (analysis.research?.cves?.length || 0) > 0
  ).length;

  const patterns = [];
  if (singleMaintainerCount > 0) {
    patterns.push({
      insight: `Single-maintainer projects appeared in ${Math.round((singleMaintainerCount / total) * 100)}% of analyzed repos`,
      basedOn: `${singleMaintainerCount} of ${total} repos analyzed`,
      confidence: parseFloat((singleMaintainerCount / total).toFixed(2)),
    });
  }

  if (withCVEs > 0) {
    patterns.push({
      insight: `${Math.round((withCVEs / total) * 100)}% of analyzed packages had at least one known CVE`,
      basedOn: `${withCVEs} of ${total} repos analyzed`,
      confidence: parseFloat((withCVEs / total).toFixed(2)),
    });
  }

  const severityCounts = {};
  analysisHistory.forEach(analysis => {
    (analysis.findings || []).forEach(finding => {
      severityCounts[finding.severity] = (severityCounts[finding.severity] || 0) + 1;
    });
  });

  const riskCategoryCounts = {};
  analysisHistory.forEach(analysis => {
    (analysis.findings || []).forEach(finding => {
      const key = `${finding.category}: ${finding.title}`;
      riskCategoryCounts[key] = (riskCategoryCounts[key] || 0) + 1;
    });
  });

  const categoryTotals = { maintenance: 0, security: 0, community: 0, documentation: 0, stability: 0 };
  analysisHistory.forEach(analysis => {
    if (!analysis.scores) return;
    Object.keys(categoryTotals).forEach(category => {
      categoryTotals[category] += analysis.scores[category] || 0;
    });
  });

  return {
    totalAnalyzed: total,
    avgGrade: avgGradeLetter,
    patterns,
    mostCommonSeverities: Object.entries(severityCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([severity, count]) => ({ severity, count })),
    riskFactors: Object.entries(riskCategoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([factor, count]) => ({ factor, count })),
    safestCategories: Object.entries(categoryTotals)
      .map(([category, totalScore]) => ({ category, avgScore: Math.round(totalScore / total) }))
      .sort((a, b) => b.avgScore - a.avgScore),
  };
}

module.exports = { getPatternInsights };
