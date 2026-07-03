const storageKey = "github-dashboard-comparison-favorites-v1";

export function loadFavoriteSets(storage = window.localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(storageKey) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeFavorite)
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  } catch {
    return [];
  }
}

export function saveFavoriteSet(favorites, name, repositories, storage = window.localStorage) {
  const favorite = normalizeFavorite({ name, repositories });
  if (!favorite) throw new Error("Informe um nome e selecione dois ou três repositórios.");

  const remaining = favorites.filter(item => item.name.localeCompare(favorite.name, "pt-BR", { sensitivity: "base" }) !== 0);
  const next = [...remaining, favorite].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  persistFavoriteSets(next, storage);
  return next;
}

export function deleteFavoriteSet(favorites, name, storage = window.localStorage) {
  const next = favorites.filter(item => item.name !== name);
  persistFavoriteSets(next, storage);
  return next;
}

function normalizeFavorite(value) {
  const name = String(value?.name || "").trim().slice(0, 48);
  const repositories = Array.from(new Set(Array.isArray(value?.repositories) ? value.repositories.map(String) : []))
    .filter(Boolean)
    .slice(0, 3);
  if (!name || repositories.length < 2) return null;
  return { name, repositories };
}

function persistFavoriteSets(favorites, storage) {
  storage.setItem(storageKey, JSON.stringify(favorites));
}
