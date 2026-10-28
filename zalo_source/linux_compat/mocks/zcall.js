/**
 * Linux Compatibility Mock for zcall (VoIP / Video Call engine)
 * Provides realistic Linux audio/video devices for Settings and stub methods.
 */

function createDeviceList() {
  const devices = [
    { t: 0, n: "HP Wide Vision HD Camera: HP Wi", i: "default" },
    { t: 1, n: "PulseAudio Input", i: 0, g: "{0.0.1.00000000}.{25DA76D0-033C-4235-9002-19F48894AC6F}" },
    { t: 2, n: "PulseAudio Output", i: 0, g: "{0.0.0.00000000}.{FD47D9CC-4218-4135-9CE2-0C195C87405B}" }
  ];

  // Return a String object so it satisfies both string operations (replace, JSON.parse)
  // in pc-dist getListDevicesFromNative() and direct property access (.cameras, .microphones, .speakers).
  const jsonStr = JSON.stringify(devices);
  const res = new String(jsonStr);
  res.cameras = [
    { id: "default", name: "HP Wide Vision HD Camera: HP Wi" }
  ];
  res.microphones = [
    { id: 0, name: "PulseAudio Input", guid: "{0.0.1.00000000}.{25DA76D0-033C-4235-9002-19F48894AC6F}" }
  ];
  res.speakers = [
    { id: 0, name: "PulseAudio Output", guid: "{0.0.0.00000000}.{FD47D9CC-4218-4135-9CE2-0C195C87405B}" }
  ];
  return res;
}

class DummyMainApp {
  constructor() {
    this.session = "";
    this.eventCallback = null;
  }

  incomingCall() {
    return Promise.resolve(true);
  }

  makeCall() {
    return Promise.resolve(true);
  }

  startDesktopCapture() {}
  stopDesktopCapture() {}

  holdAudio(hold, local = false) {}
  mute(isMute) {}
  stopCapture(isStop) {}

  getCallInfo() {
    return null;
  }

  getJsonStats406(startNetworkType = 0, endNetworkType = 0) {
    return "{}";
  }

  changeAudioDevice(inputId, outputId) {}
  setAudioVolume(input, output) {
    return 0;
  }

  changeVideoDevice(id) {}
  setAgc(auto) {}
  changeMinMaxMobileBitrate() {}
  getExtendData() {
    return null;
  }

  getListDevices() {
    return createDeviceList();
  }

  check() {
    return 1;
  }

  getEventMessage() {
    return null;
  }

  updateCallerInfo(audioConfig, extendData) {}

  setConfigData(config, isCaller, isVideoCall) {
    return Promise.resolve(true);
  }

  setCallback(fn) {
    this.eventCallback = fn;
  }

  stop() {}

  getVideoFrame() {
    return null;
  }

  getVideoFrameLocal() {
    return null;
  }

  bindGetPeerId() {}
  setStartRender() {}
  setState() {}
  authenication() {
    return Promise.resolve(true);
  }
}

function MainApp() {
  return new DummyMainApp();
}

module.exports = {
  MainApp,
  DummyMainApp,
  getListDevices: () => createDeviceList(),
  makeCall: () => Promise.resolve(true),
  incomingCall: () => Promise.resolve(true),
  getVideoFrame: () => null,
  getVideoFrameLocal: () => null
};
