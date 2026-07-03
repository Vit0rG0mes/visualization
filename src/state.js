export const state = {
  repositories: [],
  contributors: [],
  contributorRepositories: [],
  contributorByKey: new Map(),
  contributorMonthlyRows: [],
  monthlyContributions: [],
  repositorySnapshots: [],
  filtered: [],
  activeStory: "popularity",
  activeContributorStory: "repositories",
  query: "",
  domain: "all",
  secondaryDomain: "all",
  language: "all",
  calendarMetric: "changes",
  paretoRepository: "all",
  paretoMetric: "commits",
  natureRepository: "all",
  natureGroup: "contributors",
  contributorType: "all",
  compareRepositories: [],
  favoriteComparisons: [],
  presentationMode: false,
  highContrast: false,
  growthMetric: "stars",
  outlierMode: "popularity",
  healthWeights: {
    recency: 30,
    issues: 25,
    forks: 25,
    activity: 20
  },
  tablePage: 1,
  tablePageSize: 25,
  metadata: {}
};

export const defaultHealthWeights = Object.freeze({ recency: 30, issues: 25, forks: 25, activity: 20 });

export const formatNumber = new Intl.NumberFormat("pt-BR");
export const formatCompact = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1
});
export const formatPercent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0
});

export const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
