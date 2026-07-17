export class Player {
  constructor(countryCode, name, rank, teamId, teamTag, countrySlug, searchText, playerKey, findKey = playerKey) {
    this.countryCode = countryCode;
    this.name = name;
    this.rank = rank;
    this.teamId = teamId;
    this.teamTag = teamTag;
    this.countrySlug = countrySlug;
    this.searchText = searchText;
    this.playerKey = playerKey;
    this.findKey = findKey;
  }
}
