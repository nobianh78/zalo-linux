'use strict';

// Zalo allows one running instance per profile. When the lock is taken, Zalo's own
// second-instance handler just quits, trusting the running instance to show its window.
// That fails when the "running" instance is in the middle of quitting (user closes
// Zalo and reopens it within a second or two): the old process ignores the signal, then
// exits, and the new one has already quit silently. Nothing opens.
//
// Fix: if the lock holder dies within a few seconds, it was quitting, so relaunch
// ourselves and take the lock. If it is still alive after that, it is a normal running
// instance (it has already been told to show its window) and we quit as before.

const fs = require('fs');
const path = require('path');

const WAIT_MS = 5000;
const POLL_MS = 200;
const RETRY_ENV = 'ZALO_LOCK_RETRIED';

function lockHolderPid(app) {
  try {
    // Chromium's ProcessSingleton symlink: "<hostname>-<pid>"
    const target = fs.readlinkSync(path.join(app.getPath('userData'), 'SingletonLock'));
    const pid = Number(target.slice(target.lastIndexOf('-') + 1));
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch (e) {
    return null; // no lock file: the holder is already gone
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

// Returns true when it has taken over handling of this process (it will either
// relaunch or quit later); false when the caller should fall back to Zalo's handler.
function waitForQuittingInstance(app, relaunchOptions, fallback) {
  // A relaunch that still could not get the lock must not loop.
  const alreadyRetried = process.env[RETRY_ENV] === '1';
  if (alreadyRetried) return false;

  const relaunch = () => {
    console.log('[SingleInstance] Previous instance exited; relaunching');
    process.env[RETRY_ENV] = '1';
    app.relaunch(relaunchOptions());
    app.exit(0);
  };

  const pid = lockHolderPid(app);
  if (pid === process.pid) return false;
  if (pid === null || !isAlive(pid)) {
    relaunch();
    return true;
  }

  const started = Date.now();
  const timer = setInterval(() => {
    if (!isAlive(pid) || lockHolderPid(app) === null) {
      clearInterval(timer);
      relaunch();
    } else if (Date.now() - started > WAIT_MS) {
      clearInterval(timer);
      fallback(); // a normal running instance: let Zalo quit this one
    }
  }, POLL_MS);
  return true;
}

// Clear the marker in a successfully started instance so later relaunches
// (for example "Khởi động lại" in TADaZa) can retry again.
function clearRetryMarker() {
  delete process.env[RETRY_ENV];
}

module.exports = { waitForQuittingInstance, clearRetryMarker };
