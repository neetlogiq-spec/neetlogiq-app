var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../.nvm/versions/node/v22.19.0/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// ../../.nvm/versions/node/v22.19.0/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// ../../.nvm/versions/node/v22.19.0/lib/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// ../../.nvm/versions/node/v22.19.0/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// ../../.nvm/versions/node/v22.19.0/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// ../../.nvm/versions/node/v22.19.0/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// ../../.nvm/versions/node/v22.19.0/lib/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// ../../.nvm/versions/node/v22.19.0/lib/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// ../../.nvm/versions/node/v22.19.0/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// ../../.nvm/versions/node/v22.19.0/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// ../../.nvm/versions/node/v22.19.0/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// ../../.nvm/versions/node/v22.19.0/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str, encoding, cb) {
    if (str instanceof Uint8Array) {
      str = new TextDecoder().decode(str);
    }
    try {
      console.log(str);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// ../../.nvm/versions/node/v22.19.0/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// ../../.nvm/versions/node/v22.19.0/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// ../../.nvm/versions/node/v22.19.0/lib/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var workerdProcess = getBuiltinModule("node:process");
var isWorkerdProcessV2 = globalThis.Cloudflare.compatibilityFlags.enable_nodejs_process_v2;
var unenvProcess = new Process({
  env: globalProcess.env,
  // `hrtime` is only available from workerd process v2
  hrtime: isWorkerdProcessV2 ? workerdProcess.hrtime : hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  // Always implemented by workerd
  env,
  // Only implemented in workerd v2
  hrtime: hrtime3,
  // Always implemented by workerd
  nextTick
} = unenvProcess;
var {
  _channel,
  _disconnect,
  _events,
  _eventsCount,
  _handleQueue,
  _maxListeners,
  _pendingMessage,
  _send,
  assert: assert2,
  disconnect,
  mainModule
} = unenvProcess;
var {
  // @ts-expect-error `_debugEnd` is missing typings
  _debugEnd,
  // @ts-expect-error `_debugProcess` is missing typings
  _debugProcess,
  // @ts-expect-error `_exiting` is missing typings
  _exiting,
  // @ts-expect-error `_fatalException` is missing typings
  _fatalException,
  // @ts-expect-error `_getActiveHandles` is missing typings
  _getActiveHandles,
  // @ts-expect-error `_getActiveRequests` is missing typings
  _getActiveRequests,
  // @ts-expect-error `_kill` is missing typings
  _kill,
  // @ts-expect-error `_linkedBinding` is missing typings
  _linkedBinding,
  // @ts-expect-error `_preload_modules` is missing typings
  _preload_modules,
  // @ts-expect-error `_rawDebug` is missing typings
  _rawDebug,
  // @ts-expect-error `_startProfilerIdleNotifier` is missing typings
  _startProfilerIdleNotifier,
  // @ts-expect-error `_stopProfilerIdleNotifier` is missing typings
  _stopProfilerIdleNotifier,
  // @ts-expect-error `_tickCallback` is missing typings
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  availableMemory,
  // @ts-expect-error `binding` is missing typings
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  // @ts-expect-error `domain` is missing typings
  domain,
  emit,
  emitWarning,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  // @ts-expect-error `initgroups` is missing typings
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  memoryUsage,
  // @ts-expect-error `moduleLoadList` is missing typings
  moduleLoadList,
  off,
  on,
  once,
  // @ts-expect-error `openStdin` is missing typings
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  // @ts-expect-error `reallyExit` is missing typings
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = isWorkerdProcessV2 ? workerdProcess : unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// ../../.nvm/versions/node/v22.19.0/lib/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// src/worker.js
var CompressionManager = class {
  static {
    __name(this, "CompressionManager");
  }
  async compress(data, algorithm = "gzip") {
    return new Uint8Array(data.length * 0.7);
  }
};
var VectorSearchProcessor = class {
  static {
    __name(this, "VectorSearchProcessor");
  }
  async search(query, vectors) {
    return vectors.filter((v) => v.includes(query));
  }
};
var PerformanceMonitor = class {
  static {
    __name(this, "PerformanceMonitor");
  }
  recordMetric(key, value) {
    console.log(`Metric: ${key} = ${value}`);
  }
};
var compressionManager = new CompressionManager();
var vectorProcessor = new VectorSearchProcessor();
var performanceMonitor = new PerformanceMonitor();
var STREAM_CONFIGS = {
  UG: {
    description: "Undergraduate Medical & Dental (MBBS, BDS)",
    courses: ["MBBS", "BDS"],
    rounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    priority_rounds: [1, 2]
  },
  PG_MEDICAL: {
    description: "Postgraduate Medical (MD, MS, DNB, DIPLOMA)",
    courses: ["MD", "MS", "DNB", "DIPLOMA", "DNB- DIPLOMA"],
    rounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    priority_rounds: [1, 2],
    exclude_streams: ["DENTAL"]
  },
  PG_DENTAL: {
    description: "Postgraduate Dental (MDS, PG DIPLOMA)",
    courses: ["MDS", "PG DIPLOMA"],
    rounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    priority_rounds: [1, 2],
    exclude_streams: ["MEDICAL"]
  }
};
var edgeCache = /* @__PURE__ */ new Map();
var worker_default = {
  async fetch(request, env2, ctx) {
    const url = new URL(request.url);
    const startTime = Date.now();
    try {
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400"
      };
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 200, headers: corsHeaders });
      }
      let response;
      if (url.pathname.startsWith("/api/cutoffs")) {
        response = await handleCutoffs(request, env2, url);
      } else if (url.pathname.startsWith("/api/streams/")) {
        response = await handleStreamData(request, env2, url);
      } else if (url.pathname.startsWith("/api/search/")) {
        response = await handleSearch(request, env2, url);
      } else if (url.pathname.startsWith("/api/analytics/")) {
        response = await handleAnalytics(request, env2, url);
      } else if (url.pathname.startsWith("/api/performance/")) {
        response = await handlePerformance(request, env2, url);
      } else if (url.pathname.startsWith("/api/compression/")) {
        response = await handleCompression(request, env2, url);
      } else {
        response = await handleStatic(request, env2, url);
      }
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      newHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      newHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      response = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
      const duration = Date.now() - startTime;
      performanceMonitor.recordMetric("request_duration", duration);
      performanceMonitor.recordMetric("request_count", 1);
      return response;
    } catch (error3) {
      console.error("Worker error:", error3);
      return new Response(JSON.stringify({
        error: "Internal Server Error",
        message: error3.message
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
  }
};
async function handleStreamData(request, env2, url) {
  const pathParts = url.pathname.split("/");
  const stream = pathParts[3];
  const dataType = pathParts[4];
  const round = pathParts[5];
  if (!STREAM_CONFIGS[stream]) {
    return new Response(JSON.stringify({ error: "Invalid stream" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const requestBody = await request.clone().json().catch(() => ({}));
  const cacheKey = `${stream}_${dataType}_${round || "all"}_${JSON.stringify(requestBody)}`;
  if (env2.CACHE) {
    try {
      const cached2 = await env2.CACHE.get(cacheKey);
      if (cached2) {
        console.log("\u2705 KV cache hit");
        const data2 = JSON.parse(cached2);
        return new Response(JSON.stringify(data2), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
            // CDN cache
            "CF-Cache-Status": "HIT",
            // Mark as cached
            "X-Cache-Layer": "KV"
          }
        });
      }
    } catch (err) {
      console.warn("KV cache read failed:", err);
    }
  }
  if (edgeCache.has(cacheKey)) {
    const cached2 = edgeCache.get(cacheKey);
    if (Date.now() - cached2.timestamp < 6e5) {
      console.log("\u2705 In-memory cache hit");
      return new Response(JSON.stringify(cached2.data), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600",
          "CF-Cache-Status": "HIT",
          "X-Cache-Layer": "Memory"
        }
      });
    }
  }
  const cacheKeyOld = `${stream}_${dataType}_${round || "static"}`;
  const cached = edgeCache.get(cacheKey);
  if (cached) {
    console.log(`\u2705 Cache hit for ${cacheKey}`);
    return new Response(JSON.stringify({
      data: cached,
      metadata: {
        source: "cache",
        stream,
        dataType,
        round: round ? parseInt(round) : null,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const data = await generateStreamData(stream, dataType, round);
  edgeCache.set(cacheKey, data);
  return new Response(JSON.stringify({
    data,
    metadata: {
      source: "edge",
      stream,
      dataType,
      round: round ? parseInt(round) : null,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleStreamData, "handleStreamData");
async function handleSearch(request, env2, url) {
  const searchParams = url.searchParams;
  const query = searchParams.get("q");
  const stream = searchParams.get("stream") || "UG";
  const filters = {
    collegeName: searchParams.get("college"),
    courseName: searchParams.get("course"),
    minRank: searchParams.get("min_rank") ? parseInt(searchParams.get("min_rank")) : null,
    maxRank: searchParams.get("max_rank") ? parseInt(searchParams.get("max_rank")) : null,
    state: searchParams.get("state"),
    category: searchParams.get("category")
  };
  const results = await performSearch(query, stream, filters);
  return new Response(JSON.stringify({
    results,
    query,
    stream,
    filters,
    total: results.length,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleSearch, "handleSearch");
async function handleAnalytics(request, env2, url) {
  const stream = url.pathname.split("/")[3];
  const analytics = {
    stream,
    totalRequests: performanceMonitor.getTotalRequests(),
    averageResponseTime: performanceMonitor.getAverageMetric("request_duration"),
    cacheHitRate: calculateCacheHitRate(),
    dataTypes: ["colleges", "courses", "cutoffs"],
    rounds: STREAM_CONFIGS[stream]?.rounds || [],
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  return new Response(JSON.stringify(analytics), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleAnalytics, "handleAnalytics");
async function handlePerformance(request, env2, url) {
  const metrics = {
    requestCount: performanceMonitor.getTotalRequests(),
    averageResponseTime: performanceMonitor.getAverageMetric("request_duration"),
    cacheSize: edgeCache.size,
    cacheHitRate: calculateCacheHitRate(),
    memoryUsage: process.memoryUsage ? process.memoryUsage() : null,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  return new Response(JSON.stringify(metrics), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handlePerformance, "handlePerformance");
async function handleCompression(request, env2, url) {
  const { data, algorithm = "gzip" } = await request.json();
  const compressed = await compressionManager.compress(
    new TextEncoder().encode(JSON.stringify(data)),
    algorithm
  );
  const compressionRatio = ((data.length - compressed.length) / data.length * 100).toFixed(2);
  return new Response(JSON.stringify({
    compressed: Array.from(compressed),
    originalSize: data.length,
    compressedSize: compressed.length,
    compressionRatio: parseFloat(compressionRatio),
    algorithm,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleCompression, "handleCompression");
async function handleStatic(request, env2, url) {
  const filePath = url.pathname.replace("/api/static/", "");
  const response = await fetch(`http://localhost:3500${url.pathname}`);
  if (response.ok) {
    return response;
  }
  return new Response("File not found", { status: 404 });
}
__name(handleStatic, "handleStatic");
async function generateStreamData(stream, dataType, round) {
  const config2 = STREAM_CONFIGS[stream];
  switch (dataType) {
    case "colleges":
      return generateCollegesData(stream, config2);
    case "courses":
      return generateCoursesData(stream, config2);
    case "cutoffs":
      return generateCutoffsData(stream, config2, round ? parseInt(round) : 1);
    default:
      throw new Error(`Unknown data type: ${dataType}`);
  }
}
__name(generateStreamData, "generateStreamData");
function generateCollegesData(stream, config2) {
  const count3 = Math.floor(Math.random() * 50) + 20;
  return Array.from({ length: count3 }, (_, i) => ({
    id: `college_${stream}_${i + 1}`,
    name: `${stream} Medical College ${i + 1}`,
    state: ["Maharashtra", "Karnataka", "Tamil Nadu", "Delhi", "Gujarat"][i % 5],
    city: `City ${i + 1}`,
    type: ["Government", "Private", "Deemed"][i % 3],
    established_year: 1950 + i % 70,
    rating: (3 + Math.random() * 2).toFixed(1),
    total_seats: Math.floor(Math.random() * 200) + 50,
    stream,
    courses: config2.courses
  }));
}
__name(generateCollegesData, "generateCollegesData");
function generateCoursesData(stream, config2) {
  return config2.courses.map((course, i) => ({
    id: `course_${stream}_${course}`,
    name: course,
    duration: course.includes("MBBS") || course.includes("BDS") ? 5 : 3,
    level: course.includes("MBBS") || course.includes("BDS") ? "UG" : "PG",
    stream,
    total_seats: Math.floor(Math.random() * 100) + 10,
    fee_range: {
      min: Math.floor(Math.random() * 5e4) + 1e4,
      max: Math.floor(Math.random() * 5e5) + 1e5
    }
  }));
}
__name(generateCoursesData, "generateCoursesData");
function generateCutoffsData(stream, config2, round) {
  const count3 = Math.floor(Math.random() * 100) + 50;
  return Array.from({ length: count3 }, (_, i) => ({
    id: `cutoff_${stream}_${round}_${i + 1}`,
    college_id: `college_${stream}_${Math.floor(Math.random() * 20) + 1}`,
    course_id: `course_${stream}_${config2.courses[Math.floor(Math.random() * config2.courses.length)]}`,
    opening_rank: Math.floor(Math.random() * 1e4) + 1,
    closing_rank: Math.floor(Math.random() * 1e4) + 1e3,
    year: 2024,
    round,
    category: ["General", "OBC", "SC", "ST"][i % 4],
    state: ["Maharashtra", "Karnataka", "Tamil Nadu", "Delhi", "Gujarat"][i % 5],
    stream,
    priority: config2.priority_rounds.includes(round) ? "high" : "normal"
  }));
}
__name(generateCutoffsData, "generateCutoffsData");
async function performSearch(query, stream, filters) {
  const data = await generateStreamData(stream, "cutoffs", 1);
  let results = data;
  if (filters.collegeName) {
    results = results.filter(
      (item) => item.college_id.toLowerCase().includes(filters.collegeName.toLowerCase())
    );
  }
  if (filters.courseName) {
    results = results.filter(
      (item) => item.course_id.toLowerCase().includes(filters.courseName.toLowerCase())
    );
  }
  if (filters.minRank) {
    results = results.filter((item) => item.opening_rank >= filters.minRank);
  }
  if (filters.maxRank) {
    results = results.filter((item) => item.closing_rank <= filters.maxRank);
  }
  if (filters.state) {
    results = results.filter((item) => item.state === filters.state);
  }
  if (filters.category) {
    results = results.filter((item) => item.category === filters.category);
  }
  results.sort((a, b) => a.opening_rank - b.opening_rank);
  return results.slice(0, 100);
}
__name(performSearch, "performSearch");
async function handleCutoffs(request, env2, url) {
  const requestBody = await request.clone().json().catch(() => ({}));
  const cacheKey = `cutoffs:${JSON.stringify(requestBody)}`;
  if (env2.CACHE) {
    try {
      const cached = await env2.CACHE.get(cacheKey);
      if (cached) {
        console.log("\u2705 Cutoffs KV cache hit");
        const data2 = JSON.parse(cached);
        return new Response(JSON.stringify(data2), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
            "CF-Cache-Status": "HIT",
            "X-Cache-Layer": "KV"
          }
        });
      }
    } catch (err) {
      console.warn("KV cache read failed:", err);
    }
  }
  if (edgeCache.has(cacheKey)) {
    const cached = edgeCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 6e5) {
      console.log("\u2705 Cutoffs memory cache hit");
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600",
          "CF-Cache-Status": "HIT",
          "X-Cache-Layer": "Memory"
        }
      });
    }
  }
  let data = [];
  if (env2.DB) {
    try {
      const { stream, year, round, filters } = requestBody;
      let query = `SELECT * FROM cutoffs WHERE stream = ? AND year = ?`;
      const params = [stream, year];
      if (round) {
        query += ` AND round = ?`;
        params.push(round);
      }
      if (filters?.college_id) {
        query += ` AND college_id = ?`;
        params.push(filters.college_id);
      }
      if (filters?.course_id) {
        query += ` AND course_id = ?`;
        params.push(filters.course_id);
      }
      if (filters?.rank?.min) {
        query += ` AND closing_rank >= ?`;
        params.push(filters.rank.min);
      }
      if (filters?.rank?.max) {
        query += ` AND closing_rank <= ?`;
        params.push(filters.rank.max);
      }
      query += ` LIMIT 1000`;
      const result = await env2.DB.prepare(query).bind(...params).all();
      data = result.results || [];
      console.log(`\u26A1 Cutoffs Worker query: ${data.length} results`);
    } catch (err) {
      console.error("D1 query failed:", err);
      data = [];
    }
  }
  const response = {
    data,
    cached: false,
    cacheLayer: "d1",
    timestamp: Date.now()
  };
  if (env2.CACHE) {
    try {
      await env2.CACHE.put(cacheKey, JSON.stringify(response), {
        expirationTtl: 1800
        // 30 minutes
      });
    } catch (err) {
      console.warn("KV cache write failed:", err);
    }
  }
  edgeCache.set(cacheKey, {
    data: response,
    timestamp: Date.now()
  });
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      "CF-Cache-Status": "MISS",
      "X-Cache-Layer": "D1"
    }
  });
}
__name(handleCutoffs, "handleCutoffs");
function calculateCacheHitRate() {
  const totalRequests = performanceMonitor.getTotalRequests();
  const cacheHits = edgeCache.size;
  return totalRequests > 0 ? (cacheHits / totalRequests * 100).toFixed(2) : 0;
}
__name(calculateCacheHitRate, "calculateCacheHitRate");

// ../../.nvm/versions/node/v22.19.0/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../.nvm/versions/node/v22.19.0/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } catch (e) {
    const error3 = reduceError(e);
    return Response.json(error3, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-oJH4vf/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../.nvm/versions/node/v22.19.0/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env2, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env2, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env2, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env2, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-oJH4vf/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env2, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env2, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env2, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env2, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env2, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env2, ctx) => {
      this.env = env2;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
