import * as _ from 'lodash';
import { cpus, homedir } from 'os';
import { ConfigType } from './types/Config';
import parseArgv from './utils/parseArgv';
let program = parseArgv([], ['config']);

function findConfig(): ConfigType | undefined {
  let foundConfig;
  const envConfigPath = process.env.BITCORE_CONFIG_PATH;
  const argConfigPath = program.config;
  const configFileName = 'bitcore.config.json';
  let bitcoreConfigPaths = [
    `${homedir()}/${configFileName}`,
    `../../../../${configFileName}`,
    `../../${configFileName}`
  ];
  const overrideConfig = argConfigPath || envConfigPath;
  if (overrideConfig) {
    bitcoreConfigPaths.unshift(overrideConfig);
  }
  // No config specified. Search home, bitcore and cur directory
  for (let path of bitcoreConfigPaths) {
    if (!foundConfig) {
      try {
        const expanded = path[0] === '~' ? path.replace('~', homedir()) : path;
        const bitcoreConfig = require(expanded) as { bitcoreNode: ConfigType };
        foundConfig = bitcoreConfig.bitcoreNode;
      } catch (e) {
        foundConfig = undefined;
      }
    }
  }
  return foundConfig;
}

function setTrustedPeers(config: ConfigType): ConfigType {
  for (let [chain, chainObj] of Object.entries(config)) {
    for (let network of Object.keys(chainObj)) {
      let env = process.env;
      const envString = `TRUSTED_${chain.toUpperCase()}_${network.toUpperCase()}_PEER`;
      if (env[envString]) {
        let peers = config.chains[chain][network].trustedPeers || [];
        peers.push({
          host: env[envString],
          port: env[`${envString}_PORT`]
        });
        config.chains[chain][network].trustedPeers = peers;
      }
    }
  }
  return config;
}
const Config = function(): ConfigType {
  let config: ConfigType = {
    maxPoolSize: 50,
    port: 3000,
    dbUrl: process.env.DB_URL || '',
    dbHost: process.env.DB_HOST || '127.0.0.1',
    dbName: process.env.DB_NAME || 'bitcore2',
    dbPort: process.env.DB_PORT || '27017',
    dbUser: process.env.DB_USER || 'spo',
    dbPass: process.env.DB_PASS || '123457',
    numWorkers: cpus().length,
    startBlockHeight: 689270,
    startBlockHash: '0000000000000000000b09dd576bb758b60ab9f2a308d7b652af54b6c5508ab8',

    chains: {},
    modules: ['./bitcoin', './bitcoin-cash', './ethereum'],
    services: {
      api: {
        rateLimiter: {
          disabled: false,
          whitelist: ['::ffff:127.0.0.1', '::1']
        },
        wallets: {
          allowCreationBeforeCompleteSync: false,
          allowUnauthenticatedCalls: false
        }
      },
      event: {
        onlyWalletEvents: false
      },
      p2p: {},
      socket: {
        bwsKeys: []
      },
      storage: {}
    }
  };

  let foundConfig = findConfig();
  const mergeCopyArray = (objVal, srcVal) => (objVal instanceof Array ? srcVal : undefined);
  config = _.mergeWith(config, foundConfig, mergeCopyArray);
  if (!Object.keys(config.chains).length) {
    Object.assign(config.chains, {
      BTC: {
        mainnet: {
          chainSource: 'p2p',
          trustedPeers: [{ host: '127.0.0.1', port: 8333 }],
          rpc: {
            host: '127.0.0.1',
            port: 8332,
            username: 'spo',
            password: '132456'
          }
        }
      }
    });
  }
  config = setTrustedPeers(config);
  return config;
};

export default Config();
