const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

export function getCountryName(countryCode) {
  if (!countryCode) return "Unknown";

  try {
    return displayNames.of(countryCode) || countryCode;
  } catch {
    return countryCode;
  }
}

export function getCountrySlug(countryCode) {
  return getCountryName(countryCode)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
