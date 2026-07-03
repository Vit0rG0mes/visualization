export function calculateSnapshotMomentum(snapshots, filteredNames, metric = "stars") {
  if ((snapshots?.length ?? 0) < 2) return emptyMomentum();
  const safeMetric = metric === "forks" ? "forks" : "stars";
  const latest = snapshots.at(-1);
  const previous = snapshots.at(-2);
  const earlier = snapshots.length >= 3 ? snapshots.at(-3) : null;
  const latestMap = repositoryMap(latest);
  const previousMap = repositoryMap(previous);
  const earlierMap = earlier ? repositoryMap(earlier) : null;
  const cohort = filteredNames.filter(fullName => latestMap.has(fullName) && previousMap.has(fullName));
  const latestRanks = snapshotRanks(cohort, latestMap, safeMetric);
  const previousRanks = snapshotRanks(cohort, previousMap, safeMetric);
  const intervalDays = dayInterval(previous.collectedAt, latest.collectedAt);
  const previousIntervalDays = earlier ? dayInterval(earlier.collectedAt, previous.collectedAt) : null;
  const rows = cohort.map(fullName => {
    const weeklyGain = (metricValue(latestMap, fullName, safeMetric) - metricValue(previousMap, fullName, safeMetric)) * 7 / intervalDays;
    let acceleration = null;
    if (earlierMap?.has(fullName)) {
      const previousGain = (metricValue(previousMap, fullName, safeMetric) - metricValue(earlierMap, fullName, safeMetric)) * 7 / previousIntervalDays;
      acceleration = weeklyGain - previousGain;
    }
    return {
      fullName,
      weeklyGain,
      rankChange: previousRanks.get(fullName) - latestRanks.get(fullName),
      acceleration
    };
  }).sort((a, b) => {
    if (earlier) return (b.acceleration ?? -Infinity) - (a.acceleration ?? -Infinity) || b.weeklyGain - a.weeklyGain;
    return b.weeklyGain - a.weeklyGain;
  });
  return {
    available: true,
    accelerationAvailable: Boolean(earlier),
    weeklyGain: rows.reduce((total, item) => total + item.weeklyGain, 0),
    rankMovers: rows.filter(item => item.rankChange !== 0).length,
    accelerating: rows.filter(item => item.acceleration > 0).length,
    rows
  };
}

function emptyMomentum() {
  return { available: false, accelerationAvailable: false, weeklyGain: 0, rankMovers: 0, accelerating: 0, rows: [] };
}

function repositoryMap(snapshot) {
  return new Map((snapshot.repositories ?? []).map(repository => [repository.fullName, repository]));
}

function metricValue(map, fullName, metric) {
  return Number(map.get(fullName)?.[metric]) || 0;
}

function dayInterval(start, end) {
  return Math.max(1, (new Date(end) - new Date(start)) / 86400000);
}

function snapshotRanks(names, repositories, metric) {
  return new Map(
    names
      .slice()
      .sort((a, b) => metricValue(repositories, b, metric) - metricValue(repositories, a, metric))
      .map((fullName, index) => [fullName, index + 1])
  );
}
