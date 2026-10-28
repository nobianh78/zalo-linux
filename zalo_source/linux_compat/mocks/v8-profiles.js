/**
 * Linux Compatibility Mock for v8-profiles
 */

function CpuProfile() {}
CpuProfile.prototype.getHeader = function() {
  return { typeId: 0, uid: 0, title: '' };
};

const profiler = {
  get profiles() {
    return {};
  },
  startProfiling: function(name, recsamples) {},
  stopProfiling: function(name) {
    const profile = Object.create(CpuProfile.prototype);
    profile.startTime = Date.now();
    profile.endTime = Date.now();
    return profile;
  },
  setSamplingInterval: function(num) {},
  deleteAllProfiles: function() {}
};

module.exports = profiler;
process.profiler = profiler;
