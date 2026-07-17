import { getCountryName } from "./countries";

export function getPlayerFindText(player) {
  return [
    player.rank,
    player.name,
    player.teamTag,
    player.countryCode,
    player.countryCode ? getCountryName(player.countryCode) : "",
  ].filter(Boolean).join(" ");
}

export function getPlayerFindKey(player) {
  return player.findKey || player.playerKey;
}
