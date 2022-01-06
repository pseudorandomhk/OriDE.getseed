const fs = require('fs');
const https = require('https');

const genurl = 'https://orirando.com/generator/build';

const defaultItemPool = {
  'TP|Grove': [1],
  'TP|Swamp': [1],
  'TP|Grotto': [1],
  'TP|Valley': [1],
  'TP|Sorrow': [1],
  'TP|Ginso': [1],
  'TP|Horu': [1],
  'TP|Forlorn': [1],
  'HC|1': [12], //health cells
  'EC|1': [14], //energy cells
  'AC|1': [33], //ability cells
  'RB|0': [3],  //mega healths
  'RB|1': [3],  //mega energies
  'RB|6': [3],  //attack upgrades
  'RB|9': [1],  //spirit light efficiencies
  'RB|10': [1], //extra air dashes
  'RB|11': [1], //charge dash efficiences
  'RB|12': [1], //extra double jumps
  'RB|13': [3], //health regens
  'RB|15': [3]  //energy regens
};
const defaultVariations = ['ForceTrees'];
const presetPaths = {};
presetPaths.casual = ['casual-core', 'casual-dboost'];
presetPaths.standard = [...presetPaths.casual, 'standard-core', 'standard-dboost', 'standard-lure', 'standard-abilities'];
presetPaths.expert = [...presetPaths.standard, 'expert-core', 'expert-dboost', 'expert-lure', 'expert-abilities', 'dbash'];
presetPaths.master = [...presetPaths.expert, 'master-core', 'master-dboost', 'master-lure', 'master-abilities', 'gjump'];
presetPaths.glitched = [...presetPaths.master, 'glitched', 'timed-level'];
const KEY_MODES = ['None', 'Shards', 'Limitkeys', 'Clues', 'Free'];
const GOAL_MODES = { 'none':'None', 'forcetrees':'ForceTrees', 'worldtour':'WorldTour', 'forcemaps':'ForceMaps', 'warmthfrags':'WarmthFrags', 'bingo':'Bingo' };
let seedobj = {
  keyMode: 'Clues',
  fillAlg: 'Balanced',
  variations: new Set(defaultVariations),
  paths: new Set(presetPaths.standard),
  expPool: 10000,
  cellFreq: 40,
  selectedPool: 'Standard',
  players: 1,
  fass: [],
  itemPool: defaultItemPool,
  tracking: false,
  seed: Math.floor(Math.random() * 1000000001) // randInt(0, 1000000000)
};

async function sleep(ms) {
  await new Promise(_ => setTimeout(_, ms));
}
function getArgOption(args) {
  if (args.length <= 1) {
    console.error('No option provided for ' + args[0]);
    process.exit(1);
  }
  return args[1].toLowerCase();
}
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function parseFail(msg) {
  console.error(msg);
  process.exit(1);
}

function parseCLIArgs() {
  let args = process.argv.slice(2);
  while (args.length > 0) {
    switch (args[0].toLowerCase()) {
      case '--help':
      case '-h':
        console.log('node getseed.js [-h|--help] [--logic logic] [--key key] [--add-goal new_goal] [--set-goal goal] [--track]');
        process.exit(0);
        break;
      case '--logic':
        let newlogic = getArgOption(args);
        if (presetPaths[newlogic] === undefined) {
          parseFail('Unknown logic preset ' + newlogic + '\nPresets: ' + Object.keys(presetPaths).join(', '));
        }
        seedobj.paths = new Set(presetPaths[newlogic]);
        args = args.slice(2);
        break;
      case '--key':
        let newmode = capitalize(getArgOption(args));
        if (!KEY_MODES.includes(newmode)) {
          parseFail('Unknown key mode ' + newmode + '\nPossible modes: ' + KEY_MODES.join(', '));
        }
        seedobj.keyMode = newmode;
        args = args.slice(2);
        break;
      case '--add-goal':
      case '--set-goal':
        let newgoal = getArgOption(args);
        if (!GOAL_MODES.includes(newgoal)) {
          parseFail('Unknown goal mode ' + newgoal + '\nPossible modes: ' + Object.values(GOAL_MODES).join(', '));
        }
        if (args[0].toLowerCase() === '--set-goal') {
          seedobj.variations = new Set([GOAL_MODES[newgoal]]);
        } else {
          seedobj.variations.add(newgoal);
        }
        args = args.slice(2);
        break;
      case '--track':
        seedobj.tracking = true;
        args.shift();
        break;
      default:
        parseFail('Unknown option ' + args[0]);
    }
  }
}

async function generateSeed() {
  seedobj.variations = Array.from(seedobj.variations);
  seedobj.paths = Array.from(seedobj.paths);
  const content = 'params=' + encodeURI(JSON.stringify(seedobj));
  let result;
  let done = false;
  let req = https.request(genurl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': content.length
    }
  }, res => {
    res.on('end', () => done = true);
    if (res.statusCode !== 200) {
      console.error('Server error: ' + res.statusCode);
      result = null;
    } else {
      res.setEncoding('utf8');
      result = '';
      res.on('data', d => result += d);
    }
  });
  req.on('error', e => console.error('Error in seed generation request: ' + e));
  req.write(content);
  req.end();

  while (!done) {
    await sleep(500);
  }
  return JSON.parse(result);
}

function downloadSeed(params, datastream) {
  const url = `https://orirando.com/generator/seed/${params.paramId}?${params.gameId ? 'game_id=' + params.gameId : ''}`;
  https.get(url, res => {
    if (res.statusCode !== 200) {
      console.error('Error downloading seed: ' + res.statusCode);
      datastream.close();
    } else {
      res.on('data', d => datastream.write(d));
      res.on('end', () => {
        datastream.close();
        console.log(`Seed downloaded! (${params.flagLine})`);
        console.log(`https://orirando.com/?param_id=${params.paramId}${params.gameId ? '&game_id=' + params.gameId : ''}`);
      });
    }
  });
}

(async () => {
  parseCLIArgs();
  let res = await generateSeed();
  if (res !== null) {
    const datastream = fs.createWriteStream('./randomizer.dat');
    downloadSeed(res, datastream);
  }
})();
