
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Local fallback: compute scores from raw data without an LLM ────────────

function localSynthesize(repoHealth, research) {
  // Maintenance score
  let maintenance = 50;
  if (repoHealth.commitFrequencyPerWeek >= 5) maintenance += 30;
  else if (repoHealth.commitFrequencyPerWeek >= 1) maintenance += 15;
  else if (repoHealth.commitFrequencyPerWeek < 0.5) maintenance -= 20;
  if (repoHealth.lastCommitDaysAgo > 180) maintenance -= 25;
  else if (repoHealth.lastCommitDaysAgo > 90) maintenance -= 15;
  else if (repoHealth.lastCommitDaysAgo < 14) maintenance += 10;
  if (repoHealth.releaseFrequencyPerMonth >= 1) maintenance += 10;
  maintenance = Math.max(0, Math.min(100, maintenance));

  // Security score
  let security = 85;
  const criticalCVEs = (research.cves || []).filter(c => c.severity === 'CRITICAL').length;
  const highCVEs = (research.cves || []).filter(c => c.severity === 'HIGH').length;
  security -= criticalCVEs * 30;
  security -= highCVEs * 15;
  security -= (research.cves || []).length * 5;
  security = Math.max(0, Math.min(100, security));

  // Community score
  let community = 50;
  if (repoHealth.stars >= 10000) community += 25;
  else if (repoHealth.stars >= 1000) community += 15;
  else if (repoHealth.stars >= 100) community += 5;
  if (repoHealth.forks >= 1000) community += 10;
  if (repoHealth.issueCloseRate >= 0.7) community += 10;
  else if (repoHealth.issueCloseRate < 0.3) community -= 10;
  const sentiment = research.sentiment?.overall;
  if (sentiment === 'positive') community += 10;
  else if (sentiment === 'negative') community -= 15;
  community = Math.max(0, Math.min(100, community));

  // Stability score
  let stability = 60;
  if (repoHealth.busFactorScore === 'healthy') stability += 20;
  else if (repoHealth.busFactorScore === 'critical') stability -= 25;
  if (repoHealth.contributorCount >= 10) stability += 10;
  else if (repoHealth.contributorCount <= 1) stability -= 15;
  if (repoHealth.staleIssueCount > 100) stability -= 15;
  else if (repoHealth.staleIssueCount > 30) stability -= 5;
  stability = Math.max(0, Math.min(100, stability));

  // Documentation score (rough heuristic)
  let documentation = 55;
  if (repoHealth.stars >= 5000) documentation += 15;
  if (repoHealth.license && repoHealth.license !== 'NONE') documentation += 10;
  documentation = Math.max(0, Math.min(100, documentation));

  const scores = { maintenance, security, community, documentation, stability };

  // Weighted score
  const weightedScore = Math.round(
    security * 0.30 +
    maintenance * 0.25 +
    stability * 0.20 +
    community * 0.15 +
    documentation * 0.10
  );

  // Grade
  let grade = weightedScore >= 80 ? 'A' : weightedScore >= 65 ? 'B' : weightedScore >= 50 ? 'C' : weightedScore >= 35 ? 'D' : 'F';

  // Findings
  const findings = [];
  if (criticalCVEs > 0) {
    findings.push({
      severity: 'CRITICAL', category: 'security',
      title: `${criticalCVEs} critical CVE(s) found`,
      detail: `Found ${criticalCVEs} critical vulnerability(ies) in web searches for ${repoHealth.name}.`,
      recommendation: 'Check if patched versions are available and upgrade immediately.',
    });
  }
  if (repoHealth.busFactorScore === 'critical') {
    findings.push({
      severity: 'HIGH', category: 'maintenance',
      title: 'Critical bus factor',
      detail: `Top contributor accounts for ${Math.round(repoHealth.topContributorPct * 100)}% of commits with only ${repoHealth.contributorCount} active contributor(s).`,
      recommendation: 'This is a supply-chain risk. Consider alternatives with broader maintainer bases.',
    });
  }
  if (repoHealth.lastCommitDaysAgo > 90) {
    findings.push({
      severity: repoHealth.lastCommitDaysAgo > 180 ? 'HIGH' : 'MEDIUM',
      category: 'maintenance',
      title: 'Infrequent commits',
      detail: `Last commit was ${repoHealth.lastCommitDaysAgo} days ago. Commit frequency: ${repoHealth.commitFrequencyPerWeek}/week.`,
      recommendation: 'Monitor for signs of abandonment or evaluate alternatives.',
    });
  }
  if (repoHealth.staleIssueCount > 30) {
    findings.push({
      severity: 'MEDIUM', category: 'community',
      title: `${repoHealth.staleIssueCount} stale issues`,
      detail: `${repoHealth.staleIssueCount} open issues have had no activity in over 30 days.`,
      recommendation: 'May indicate slow maintainer response or waning interest.',
    });
  }
  if (highCVEs > 0) {
    findings.push({
      severity: 'HIGH', category: 'security',
      title: `${highCVEs} high-severity CVE(s) found`,
      detail: `Found ${highCVEs} high-severity vulnerability(ies) for ${repoHealth.name}.`,
      recommendation: 'Review advisories and upgrade to patched versions.',
    });
  }

  // Auto-downgrades
  if (criticalCVEs > 0 && ['A', 'B'].includes(grade)) grade = 'C';
  if (repoHealth.busFactorScore === 'critical' && repoHealth.lastCommitDaysAgo > 90 && ['A', 'B', 'C'].includes(grade)) grade = 'D';

  // Alternatives (pass through from research)
  const alternatives = (research.alternatives || []).map(a => ({
    name: a.name,
    reason: a.context || 'Found as alternative in web search',
    migrationDifficulty: 'moderate',
    comparison: `Alternative to ${repoHealth.name}`,
  }));

  // Verdict
  const verdictParts = [];
  if (grade === 'A' || grade === 'B') verdictParts.push(`${repoHealth.name} is in good shape overall.`);
  else if (grade === 'C') verdictParts.push(`${repoHealth.name} is usable but has notable risks.`);
  else verdictParts.push(`${repoHealth.name} carries significant risk.`);
  if (criticalCVEs > 0) verdictParts.push(`Critical vulnerabilities demand immediate attention.`);
  if (repoHealth.busFactorScore === 'critical') verdictParts.push(`The thin maintainer base is a supply-chain concern.`);
  if (alternatives.length > 0) verdictParts.push(`Consider ${alternatives[0].name} as an alternative.`);

  return {
    grade,
    gradeRationale: verdictParts[0],
    scores,
    findings,
    alternatives,
    verdict: verdictParts.join(' '),
    weightedScore,
    _fallback: true,
  };
}

// ─── Gemini synthesis with retry + local fallback ────────────────────────────

async function synthesizeRiskAssessment(repoHealth, research) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('your_')) {
    console.warn('[Gemini] No API key configured, using local fallback');
    return localSynthesize(repoHealth, research);
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are a senior software engineer evaluating an open-source dependency for production use.

Given the following data about a package, produce a structured risk assessment.

## Repository Health Data
${JSON.stringify(repoHealth, null, 2)}

## Security Research
${JSON.stringify(research.cves, null, 2)}

## Community Sentiment
${JSON.stringify(research.sentiment, null, 2)}

## Alternatives Found
${JSON.stringify(research.alternatives, null, 2)}

Respond with ONLY valid JSON in this exact format:
{
  "grade": "A" | "B" | "C" | "D" | "F",
  "gradeRationale": "One sentence explaining the grade",

  "scores": {
    "maintenance": 0-100,
    "security": 0-100,
    "community": 0-100,
    "documentation": 0-100,
    "stability": 0-100
  },

  "findings": [
    {
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "category": "security" | "maintenance" | "community" | "stability",
      "title": "Short title",
      "detail": "Explanation with evidence",
      "recommendation": "What to do about it"
    }
  ],

  "alternatives": [
    {
      "name": "package-name",
      "reason": "Why this is a viable alternative",
      "migrationDifficulty": "easy" | "moderate" | "hard",
      "comparison": "Brief comparison to the evaluated package"
    }
  ],

  "verdict": "2-3 sentence executive summary. Be opinionated."
}`;

  // Retry once after backoff for rate-limit errors
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const assessment = JSON.parse(cleanText);

      // Weighted score
      const weightedScore =
        assessment.scores.security * 0.30 +
        assessment.scores.maintenance * 0.25 +
        assessment.scores.stability * 0.20 +
        assessment.scores.community * 0.15 +
        assessment.scores.documentation * 0.10;

      // Auto-downgrades
      let finalGrade = assessment.grade;
      const hasCriticalCVE = assessment.findings.some(
        f => f.severity === 'CRITICAL' && f.category === 'security'
      );
      if (hasCriticalCVE && ['A', 'B'].includes(finalGrade)) finalGrade = 'C';
      if (repoHealth.busFactorScore === 'critical' &&
          repoHealth.lastCommitDaysAgo > 90 &&
          ['A', 'B', 'C'].includes(finalGrade)) {
        finalGrade = 'D';
      }

      return { ...assessment, grade: finalGrade, weightedScore: Math.round(weightedScore) };
    } catch (error) {
      console.error(`Gemini synthesis error (attempt ${attempt + 1}):`, error.message);
      if (error.status === 429 && attempt === 0) {
        console.log('[Gemini] Rate limited, waiting 50s before retry...');
        await new Promise(r => setTimeout(r, 50000));
        continue;
      }
      // Fall through to local fallback
      break;
    }
  }

  console.warn('[Gemini] All attempts failed, using local fallback synthesizer');
  return localSynthesize(repoHealth, research);
}

module.exports = { synthesizeRiskAssessment };
