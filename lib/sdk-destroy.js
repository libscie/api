/**
 * shutdown a sdk instance closing all the open hyperdrives
 *
 * @public
 * @async
 * @param {Boolean} db=true - if true it will close all the internal databases
 * @param {Boolean} swarm=true - if true it will close the swarm
 */
const debug = require('debug')
const _log = require('./_log')

module.exports = async (sdk, db = true, swarm = true) => {
  // index.json watcher for external drives
  for (const unwatch of sdk.externalUpdates.values()) {
    unwatch.destroy()
  }
  sdk.externalUpdates = new Map()
  // general drive watch for external drives
  for (const unwatch of sdk.driveUnwatches.values()) {
    unwatch.destroy()
  }
  sdk.driveUnwatches = new Map()
  // Close importFiles watches (mirror folder instances)
  for (const mirror of sdk.drivesToWatch.values()) {
    mirror.destroy()
  }
  sdk.drivesToWatch = new Map()
  // cancel active downloads (feed.download calls)

  for (const cancelActiveDl of sdk.activeFeedDownloads.values()) {
    cancelActiveDl()
  }
  sdk.activeFeedDownloads = new Map()

  if (db) {
    debug('closing db...')
    try {
      if (sdk.localdb) await sdk.localdb.close()
      if (sdk.seeddb) await sdk.seeddb.close()
      if (sdk.db) await sdk.db.close()
    } catch (err) {
      _log(sdk, err.message, 'error')
    }
    debug('db successfully closed')
  }

  if (swarm && sdk.networker) {
    await Promise.all(Array.from(sdk.drives, ([_, drive]) => drive.close()))
    sdk.drives = new Map()

    debug('closing swarm...')
    try {
      await sdk.networker.close()
    } catch (err) {
      _log(sdk, err.message, 'error')
    }

    debug('swarm successfully closed')
  }

  sdk.start = false
}
