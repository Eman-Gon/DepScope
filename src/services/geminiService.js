
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function synthesizeRiskAssessment(repoHealth, research) {
  const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash'];
  let lastError;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      return await _synthesize(model, repoHealth, research);
    } catch (error) {
      lastError = error;
      if (error.status === 429 || error.status === 404) {
        console.warn(`[Gemini] ${modelName} ${error.status === 429 ? 'rate limited' : 'not found'}, trying next model...`);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function _synthesize(model, repoHealth, research) {

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

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Remove markdown code blocks if present
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const assessment = JSON.parse(cleanText);
    
    // Calculate overall grade based on weighted scores
    const weightedScore = 
      assessment.scores.security * 0.30 +
      assessment.scores.maintenance * 0.25 +
      assessment.scores.stability * 0.20 +
      assessment.scores.community * 0.15 +
      assessment.scores.documentation * 0.10;
    
    // Auto-downgrades
    let finalGrade = assessment.grade;
    
    // Critical CVE downgrade
    const hasCriticalCVE = assessment.findings.some(
      f => f.severity === 'CRITICAL' && f.category === 'security'
    );
    if (hasCriticalCVE && ['A', 'B'].includes(finalGrade)) {
      finalGrade = 'C';
    }
    
    // Single maintainer + stale downgrade
    if (repoHealth.busFactorScore === 'critical' && 
        repoHealth.lastCommitDaysAgo > 90 &&
        ['A', 'B', 'C'].includes(finalGrade)) {
      finalGrade = 'D';
    }
    
    // Archived or deprecated repo → automatic F
    if (repoHealth.isArchived || repoHealth.isDeprecated) {
      finalGrade = 'F';
    }
    
    return {
      ...assessment,
      grade: finalGrade,
      weightedScore: Math.round(weightedScore)
    };
    
  } catch (error) {
    console.error('Gemini synthesis error:', error);
    // Preserve the original error so status code is available for model fallback
    error.message = `Failed to synthesize risk assessment: ${error.message}`;
    throw error;
  }
}

module.exports = { synthesizeRiskAssessment };
