require('dotenv').config();
const { analyzeRepo } = require('./src/services/githubService');
const { researchPackage } = require('./src/services/youService');
const { synthesizeRiskAssessment } = require('./src/services/geminiService');

async function testFullAnalysis(repoUrl) {
  console.log('=== FULL ANALYSIS TEST ===\n');
  
  console.log('Step 1: Analyzing repo health...');
  const repoHealth = await analyzeRepo(repoUrl);
  console.log(`✓ ${repoHealth.name} - ${repoHealth.stars} stars\n`);
  
  console.log('Step 2: Researching external signals...');
  const research = await researchPackage(repoHealth.name);
  console.log(`✓ Found ${research.cves.length} CVEs, ${research.alternatives.length} alternatives\n`);
  
  console.log('Step 3: Synthesizing risk assessment with Gemini...');
  const assessment = await synthesizeRiskAssessment(repoHealth, research);
  console.log(`✓ Grade: ${assessment.grade}\n`);
  
  console.log('=== FINAL ASSESSMENT ===');
  console.log(JSON.stringify(assessment, null, 2));
}

testFullAnalysis('https://github.com/lodash/lodash')
  .catch(err => console.error('Error:', err.message));