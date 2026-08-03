// Marketplace plan catalogue. Prices are expressed in pence for GitHub billing metadata.
const PLANS = Object.freeze([
  // Direct Buildy checkout: one-off, per-project access for individuals.
  { slug: 'project-pass', name: 'Project Pass', purchaseModel: 'one_time', oneTimePriceGbp: 5, projectLimit: 1 },
  // GitHub Marketplace: recurring plans for people building and maintaining sites for others.
  { slug: 'client-starter', name: 'Client Starter', purchaseModel: 'recurring', monthlyPriceGbp: 15, annualPriceGbp: 150, projectLimit: 5, audience: 'freelancers and small studios' },
  { slug: 'client-studio', name: 'Client Studio', purchaseModel: 'recurring', monthlyPriceGbp: 35, annualPriceGbp: 350, projectLimit: 25, audience: 'agencies and teams' }
]);

function planForGithubId(id) {
  return PLANS.find(plan => String(plan.githubPlanId || '') === String(id)) || null;
}

function planForSlug(slug) {
  return PLANS.find(plan => plan.slug === slug) || null;
}

module.exports = { PLANS, planForGithubId, planForSlug };
