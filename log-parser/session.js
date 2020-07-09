const helpers = require("./helpers");
const firestore = require("./firestore");

const SCORE_KILL = 2;
const SCORE_ASSIST = 1;
const SCORE_BOMB_PLANTED = 2;
const SCORE_BOMB_DEFUSED = 2;

let matchData = null;
let usersData = [];

const matchStart = (event) => {
  const map = event.data.map;
  const date = new Date(`${event.data.date} ${event.data.time}`);

  matchData = {
    id: helpers.getMatchId(date, map),
    rankId: helpers.getRankId(date),
    map: map,
    date: date,
    users: [],
    chats: [],
    kills: {},
    deaths: {},
    damages: {},
  };
};

const enteredGame = (event) => {
  const userId = event.data.source.steam;
  const user = usersData.find((user) => user.id === userId);
  if (user === undefined) {
    usersData.push({
      id: userId,
      team: "Unassigned",
      name: event.data.source.name,
    });
  } else {
    user.team = "Unassigned";
    user.name = event.data.source.name;
  }
  firestore.setUserOnline(userId, true);
};

const disconnected = (event) => {
  const userId = event.data.source.steam;
  const index = usersData.findIndex((user) => user.id === userId);
  if (index > -1) {
    usersData.splice(index, 1);
  }
  firestore.setUserOnline(userId, false);
};

const switchedTeam = (event) => {
  const userId = event.data.source.steam;
  const user = usersData.find((user) => user.id === userId);
  if (user === undefined) {
    usersData.push({
      id: userId,
      team: event.data.target.team,
    });
  } else {
    user.team = event.data.target.team;
  }
};

const kill = (event) => {
  const source = helpers.findPlayer(matchData, event.data.source);
  const target = helpers.findPlayer(matchData, event.data.target);
  helpers.checkKill(matchData, source.id, target.id, event.data.weapon);
  helpers.checkDeadh(matchData, source.id, target.id, event.data.weapon);

  source.kills++;
  target.deaths++;
  matchData.kills[source.id].count++;
  matchData.kills[source.id].targets[target.id].count++;
  matchData.kills[source.id].weapons[event.data.weapon].count++;
  matchData.deaths[target.id].count++;
  matchData.deaths[target.id].sources[source.id].count++;
  matchData.deaths[target.id].weapons[event.data.weapon].count++;
  if (event.data.headshot) {
    source.headshots++;
    matchData.kills[source.id].headshots++;
    matchData.kills[source.id].targets[target.id].headshots++;
    matchData.kills[source.id].weapons[event.data.weapon].headshots++;
    matchData.deaths[target.id].headshots++;
    matchData.deaths[target.id].sources[source.id].headshots++;
    matchData.deaths[target.id].weapons[event.data.weapon].headshots++;
  }
  source.score += SCORE_KILL;
};

const damage = (event) => {
  const source = helpers.findPlayer(matchData, event.data.source);
  const hitgroupId = event.data.hitgroup.trim();
  helpers.checkDamage(matchData, source.id, hitgroupId);
  matchData.damages[source.id][hitgroupId]++;
};

const assist = (event) => {
  const source = helpers.findPlayer(matchData, event.data.source);
  source.assists++;
  source.score += SCORE_ASSIST;
};

const say = (event) => {
  const source = helpers.findPlayer(matchData, event.data.source);
  matchData.chats.push({
    source: source.id,
    type: event.type,
    date: new Date(`${event.data.date} ${event.data.time}`),
    message: event.data.message,
  });
};

const playerTriggered = (event) => {
  const source = helpers.findPlayer(matchData, event.data.source);
  if (event.data.action === "Planted_The_Bomb") {
    source.score += SCORE_BOMB_PLANTED;
  }
  if (event.data.action === "Defused_The_Bomb") {
    source.score += SCORE_BOMB_DEFUSED;
  }
};

const roundEnd = (event) => {
  usersData.forEach((user) => {
    if (user.team === "TERRORIST" || user.team === "CT") {
      const player = helpers.findPlayerById(matchData, user.id);
      if (player !== undefined) {
        player.rounds++;
      }
    }
  });
};

const gameOver = (event) => {
  matchData.duration = event.data.duration;
  matchData.score = event.data.score;

  usersData.forEach((user) => {
    if (user.team === "TERRORIST" || user.team === "CT") {
      const player = helpers.findPlayerById(matchData, user.id);
      if (player !== undefined) {
        player.team = user.team;
      }
    }
  });

  if (helpers.isFinished(matchData)) {
    firestore.sendMatch(matchData);
  }
};

module.exports = {
  matchstart: matchStart,
  enteredgame: enteredGame,
  disconnected: disconnected,
  switchedteam: switchedTeam,
  kill: kill,
  damage: damage,
  assist: assist,
  say: say,
  sayteam: say,
  playertriggered: playerTriggered,
  roundend: roundEnd,
  gameover: gameOver,
};
