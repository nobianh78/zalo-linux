const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const PROFILES_FILE = path.join(os.homedir(), '.config', 'zalo_profiles.json');

const DEFAULT_PROFILES_STATE = {
  activeProfile: 'default',
  profiles: [
    {
      id: 'default',
      name: 'Tài khoản Chính (Cá nhân)',
      avatar: '',
      userDataDir: 'ZaloData',
      createdAt: Date.now()
    }
  ]
};

function getProfilesData() {
  try {
    if (fs.existsSync(PROFILES_FILE)) {
      const content = fs.readFileSync(PROFILES_FILE, 'utf8');
      const data = JSON.parse(content);
      if (data && Array.isArray(data.profiles) && data.profiles.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[ProfilesManager] Error reading profiles file:', err.message);
  }

  // Initialize default
  try {
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(DEFAULT_PROFILES_STATE, null, 2), 'utf8');
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_PROFILES_STATE));
}

function saveProfilesData(data) {
  try {
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[ProfilesManager] Error saving profiles file:', err.message);
    return false;
  }
}

function getCurrentProfileId() {
  // 1. Check CLI arguments
  for (const arg of process.argv) {
    if (arg.startsWith('--profile=')) {
      return arg.split('=')[1].trim() || 'default';
    }
  }
  // 2. Check environment variable
  if (process.env.ZALO_PROFILE) {
    return process.env.ZALO_PROFILE.trim() || 'default';
  }
  // 3. Fallback to activeProfile from file
  const data = getProfilesData();
  return data.activeProfile || 'default';
}

function getProfileUserDataDir(profileId) {
  if (!profileId || profileId === 'default') {
    return path.join(os.homedir(), '.config', 'ZaloData');
  }
  return path.join(os.homedir(), '.config', `ZaloData_${profileId}`);
}

function createProfile(name) {
  const data = getProfilesData();
  const safeId = 'acc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const profileName = (name && name.trim()) ? name.trim() : `Tài khoản ${data.profiles.length + 1}`;
  const userDataDir = `ZaloData_${safeId}`;
  const fullDir = path.join(os.homedir(), '.config', userDataDir);

  if (!fs.existsSync(fullDir)) {
    try {
      fs.mkdirSync(fullDir, { recursive: true });
    } catch (e) {}
  }

  const newProfile = {
    id: safeId,
    name: profileName,
    avatar: '',
    userDataDir: userDataDir,
    createdAt: Date.now()
  };

  data.profiles.push(newProfile);
  saveProfilesData(data);
  return newProfile;
}

function renameProfile(profileId, newName) {
  if (!newName || !newName.trim()) return false;
  const data = getProfilesData();
  const profile = data.profiles.find(p => p.id === profileId);
  if (profile) {
    profile.name = newName.trim();
    return saveProfilesData(data);
  }
  return false;
}

function updateProfileInfo(profileId, { name, avatar }) {
  const data = getProfilesData();
  const profile = data.profiles.find(p => p.id === profileId);
  if (profile) {
    let changed = false;
    if (name && typeof name === 'string' && name.trim() && profile.name.startsWith('Tài khoản ')) {
      profile.name = name.trim();
      changed = true;
    }
    if (avatar && typeof avatar === 'string' && avatar.trim() && !profile.avatar) {
      profile.avatar = avatar.trim();
      changed = true;
    }
    if (changed) {
      saveProfilesData(data);
    }
    return true;
  }
  return false;
}

function deleteProfile(profileId, deleteFiles = false) {
  if (profileId === 'default') {
    return { success: false, message: 'Không thể xóa tài khoản mặc định' };
  }
  const data = getProfilesData();
  const idx = data.profiles.findIndex(p => p.id === profileId);
  if (idx === -1) {
    return { success: false, message: 'Không tìm thấy tài khoản' };
  }

  const [removed] = data.profiles.splice(idx, 1);
  if (data.activeProfile === profileId) {
    data.activeProfile = 'default';
  }
  saveProfilesData(data);

  if (deleteFiles && removed.userDataDir) {
    const fullDir = path.join(os.homedir(), '.config', removed.userDataDir);
    try {
      if (fs.existsSync(fullDir)) {
        fs.rmSync(fullDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn('[ProfilesManager] Could not delete dir:', e.message);
    }
  }

  return { success: true };
}

function switchProfile(profileId) {
  const electron = require('electron');
  const data = getProfilesData();
  const exists = data.profiles.some(p => p.id === profileId);
  if (!exists) {
    return { success: false, message: 'Profile không tồn tại' };
  }

  data.activeProfile = profileId;
  saveProfilesData(data);

  // Relaunch app with new profile
  const filteredArgs = process.argv.slice(1).filter(a => !a.startsWith('--profile='));
  const newArgs = filteredArgs.concat([`--profile=${profileId}`]);

  try {
    electron.app.relaunch({ args: newArgs });
    electron.app.exit(0);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function launchDualProfile(profileId) {
  const data = getProfilesData();
  const exists = data.profiles.some(p => p.id === profileId);
  if (!exists) {
    return { success: false, message: 'Profile không tồn tại' };
  }

  const rootDir = path.resolve(__dirname, '..', '..');
  const startScript = path.join(rootDir, '..', 'start_zalo.sh');

  try {
    let child;
    if (fs.existsSync(startScript)) {
      child = spawn(startScript, [`--profile=${profileId}`], {
        cwd: path.dirname(startScript),
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, ZALO_PROFILE: profileId }
      });
    } else {
      const electronBin = process.execPath;
      child = spawn(electronBin, ['--no-sandbox', rootDir, `--profile=${profileId}`], {
        cwd: rootDir,
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, ZALO_PROFILE: profileId }
      });
    }

    if (child) {
      child.unref();
      return { success: true, pid: child.pid };
    }
  } catch (err) {
    return { success: false, message: err.message };
  }
  return { success: false, message: 'Không thể khởi động tiến trình song song' };
}

module.exports = {
  getProfilesData,
  saveProfilesData,
  getCurrentProfileId,
  getProfileUserDataDir,
  createProfile,
  renameProfile,
  updateProfileInfo,
  deleteProfile,
  switchProfile,
  launchDualProfile
};
