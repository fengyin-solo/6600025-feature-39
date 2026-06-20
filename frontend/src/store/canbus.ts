import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  CanFrame,
  DbcMessage,
  BusStats,
  SignalStats,
  AnomalyItem,
  AnomalyType,
  ExportPreviewData
} from '../types';
import { parseDbc, decodeCanFrame, DEFAULT_DBC_CONTENT } from '../utils/dbc-parser';

let frameIdCounter = 0;

export const useCanBusStore = defineStore('canbus', () => {
  const frames = ref<CanFrame[]>([]);
  const signals = ref<Map<string, { name: string; data: { time: number; value: number }[] }>>(new Map());
  const dbcMessages = ref<Map<number, DbcMessage>>(new Map());
  const filterId = ref('');
  const filterText = ref('');
  const isCapturing = ref(false);
  const pollInterval = ref<number | null>(null);

  const busStats = ref<BusStats>({
    totalFrames: 0,
    rxCount: 0,
    txCount: 0,
    errorCount: 0,
    busLoad: 0,
    lastUpdate: Date.now()
  });

  const filteredFrames = computed(() => {
    let result = frames.value;

    if (filterId.value.trim()) {
      const idFilter = filterId.value.trim().toLowerCase().replace(/^0x/, '');
      result = result.filter(f =>
        f.arbitrationId.toString(16).toLowerCase().includes(idFilter)
      );
    }

    if (filterText.value.trim()) {
      const textFilter = filterText.value.trim().toLowerCase();
      result = result.filter(f => {
        if (f.arbitrationId.toString(16).toLowerCase().includes(textFilter)) return true;
        if (f.data.toLowerCase().includes(textFilter)) return true;
        for (const key of Object.keys(f.decoded)) {
          if (key.toLowerCase().includes(textFilter)) return true;
        }
        return false;
      });
    }

    return result;
  });

  const busLoadPercent = computed(() => {
    return busStats.value.busLoad.toFixed(1);
  });

  function addFrame(frame: CanFrame) {
    frames.value.push(frame);
    if (frames.value.length > 500) {
      frames.value = frames.value.slice(-500);
    }

    busStats.value.totalFrames++;
    if (frame.direction === 'RX') busStats.value.rxCount++;
    else busStats.value.txCount++;
    busStats.value.lastUpdate = Date.now();

    // Update signal history
    const msgDef = dbcMessages.value.get(frame.arbitrationId);
    if (msgDef) {
      const decoded = decodeCanFrame(frame, msgDef);
      frame.decoded = decoded;
      for (const [name, value] of Object.entries(decoded)) {
        if (!signals.value.has(name)) {
          signals.value.set(name, { name, data: [] });
        }
        const sig = signals.value.get(name)!;
        sig.data.push({ time: frame.timestamp, value });
        if (sig.data.length > 100) {
          sig.data = sig.data.slice(-100);
        }
      }
    }

    // Simulate bus load (random 15-45%)
    busStats.value.busLoad = 15 + Math.random() * 30;
  }

  function clearFrames() {
    frames.value = [];
    signals.value = new Map();
    busStats.value = {
      totalFrames: 0,
      rxCount: 0,
      txCount: 0,
      errorCount: 0,
      busLoad: 0,
      lastUpdate: Date.now()
    };
    frameIdCounter = 0;
  }

  function loadMockDbc() {
    parseAndLoadDbc(DEFAULT_DBC_CONTENT);
  }

  function parseAndLoadDbc(text: string) {
    dbcMessages.value = parseDbc(text);
  }

  function generateMockFrame(): CanFrame {
    const messageIds = Array.from(dbcMessages.value.keys());
    const arbId = messageIds.length > 0
      ? messageIds[Math.floor(Math.random() * messageIds.length)]
      : 0x7DF;

    const msgDef = dbcMessages.value.get(arbId);

    // Generate realistic OBD-II values
    const rpm = Math.floor(800 + Math.random() * 5200);
    const speed = Math.floor(Math.random() * 120);
    const temp = Math.floor(70 + Math.random() * 35);
    const throttle = Math.floor(Math.random() * 100);
    const load = Math.floor(Math.random() * 100);

    // Encode values into bytes (simplified encoding for display)
    const rpmRaw = Math.round(rpm / 0.25);
    const rpmLow = rpmRaw & 0xFF;
    const rpmHigh = (rpmRaw >> 8) & 0xFF;
    const speedByte = speed & 0xFF;
    const tempByte = (temp + 40) & 0xFF;
    const throttleByte = Math.round(throttle / 0.392) & 0xFF;
    const loadByte = Math.round(load / 0.392) & 0xFF;

    const dataBytes = [rpmLow, rpmHigh, speedByte, tempByte, throttleByte, loadByte, 0x00, 0x00];
    const dataHex = dataBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

    const frame: CanFrame = {
      id: `frame-${++frameIdCounter}`,
      timestamp: Date.now(),
      arbitrationId: arbId,
      dlc: 8,
      data: dataHex,
      decoded: {},
      direction: Math.random() > 0.3 ? 'RX' : 'TX'
    };

    if (msgDef) {
      frame.decoded = {
        EngineRPM: rpm,
        VehicleSpeed: speed,
        CoolantTemp: temp,
        ThrottlePosition: throttle,
        EngineLoad: load
      };
    }

    return frame;
  }

  function startCapture() {
    if (isCapturing.value) return;
    isCapturing.value = true;

    // Load mock DBC if not loaded
    if (dbcMessages.value.size === 0) {
      loadMockDbc();
    }

    pollInterval.value = window.setInterval(() => {
      const frame = generateMockFrame();
      addFrame(frame);
    }, 200);
  }

  function stopCapture() {
    isCapturing.value = false;
    if (pollInterval.value !== null) {
      clearInterval(pollInterval.value);
      pollInterval.value = null;
    }
  }

  function decodeFrame(frame: CanFrame): Record<string, number> {
    const msgDef = dbcMessages.value.get(frame.arbitrationId);
    if (!msgDef) return {};
    return decodeCanFrame(frame, msgDef);
  }

  function getSignalMap(): Map<string, { min: number; max: number; unit: string }> {
    const map = new Map<string, { min: number; max: number; unit: string }>();
    for (const msg of dbcMessages.value.values()) {
      for (const sig of msg.signals) {
        map.set(sig.name, { min: sig.minValue, max: sig.maxValue, unit: sig.unit });
      }
    }
    return map;
  }

  function getExportPreview(): ExportPreviewData {
    const fs = frames.value;
    const signalMap = getSignalMap();
    const anomalyCountByType: Record<AnomalyType, number> = {
      out_of_range: 0,
      unknown_id: 0,
      data_length: 0,
      jump: 0
    };

    let rxCount = 0;
    let txCount = 0;
    let decodedCount = 0;
    let undecodedCount = 0;
    const uniqueIdSet = new Set<number>();
    let timeStart: number | null = null;
    let timeEnd: number | null = null;

    const signalDataMap = new Map<string, number[]>();
    const anomalies: AnomalyItem[] = [];
    const prevSignalValues = new Map<string, number>();

    for (const frame of fs) {
      uniqueIdSet.add(frame.arbitrationId);
      if (frame.direction === 'RX') rxCount++;
      else txCount++;

      if (timeStart === null || frame.timestamp < timeStart) timeStart = frame.timestamp;
      if (timeEnd === null || frame.timestamp > timeEnd) timeEnd = frame.timestamp;

      const msgDef = dbcMessages.value.get(frame.arbitrationId);
      if (msgDef) {
        decodedCount++;

        if (frame.dlc !== msgDef.dlc) {
          anomalyCountByType.data_length++;
          anomalies.push({
            type: 'data_length',
            frameId: frame.id,
            timestamp: frame.timestamp,
            message: `数据长度异常: 期望 DLC=${msgDef.dlc}, 实际 DLC=${frame.dlc}`,
            details: `CAN ID: 0x${frame.arbitrationId.toString(16).toUpperCase()}`
          });
        }

        for (const [name, rawValue] of Object.entries(frame.decoded)) {
          const value = rawValue as number;
          if (!signalDataMap.has(name)) signalDataMap.set(name, []);
          signalDataMap.get(name)!.push(value);

          const sigInfo = signalMap.get(name);
          if (sigInfo && (value < sigInfo.min || value > sigInfo.max)) {
            anomalyCountByType.out_of_range++;
            anomalies.push({
              type: 'out_of_range',
              frameId: frame.id,
              timestamp: frame.timestamp,
              message: `${name} 值超出范围`,
              details: `值: ${value.toFixed(2)}${sigInfo.unit}, 范围: [${sigInfo.min}, ${sigInfo.max}]`
            });
          }

          const prev = prevSignalValues.get(name);
          if (prev !== undefined && sigInfo) {
            const range = sigInfo.max - sigInfo.min;
            if (range > 0 && Math.abs(value - prev) > range * 0.5) {
              anomalyCountByType.jump++;
              anomalies.push({
                type: 'jump',
                frameId: frame.id,
                timestamp: frame.timestamp,
                message: `${name} 值突变`,
                details: `${prev.toFixed(2)} → ${value.toFixed(2)}${sigInfo.unit}, 变化: ${(Math.abs(value - prev)).toFixed(2)}`
              });
            }
          }
          prevSignalValues.set(name, value);
        }
      } else {
        undecodedCount++;
        anomalyCountByType.unknown_id++;
        anomalies.push({
          type: 'unknown_id',
          frameId: frame.id,
          timestamp: frame.timestamp,
          message: '未知 CAN ID（无 DBC 定义）',
          details: `CAN ID: 0x${frame.arbitrationId.toString(16).toUpperCase()}`
        });
      }
    }

    const signalStats: SignalStats[] = [];
    for (const [name, values] of signalDataMap.entries()) {
      const sigInfo = signalMap.get(name);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      const outOfRangeCount = sigInfo
        ? values.filter(v => v < sigInfo.min || v > sigInfo.max).length
        : 0;

      signalStats.push({
        name,
        count: values.length,
        min,
        max,
        avg,
        last: values[values.length - 1],
        unit: sigInfo?.unit || '',
        outOfRangeCount
      });
    }
    signalStats.sort((a, b) => b.count - a.count);

    anomalies.sort((a, b) => b.timestamp - a.timestamp);

    return {
      frameCount: fs.length,
      timeRange: timeStart !== null && timeEnd !== null
        ? { start: timeStart, end: timeEnd }
        : null,
      rxCount,
      txCount,
      uniqueIds: uniqueIdSet.size,
      decodedCount,
      undecodedCount,
      signalStats,
      anomalies,
      anomalyCountByType
    };
  }

  function exportFrames(): string {
    const header = 'Timestamp,Direction,CAN_ID,DLC,Data,Decoded\n';
    const rows = frames.value.map(f => {
      const decodedStr = Object.entries(f.decoded)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      return `${f.timestamp},${f.direction},0x${f.arbitrationId.toString(16).toUpperCase()},${f.dlc},"${f.data}","${decodedStr}"`;
    }).join('\n');
    return header + rows;
  }

  return {
    frames,
    signals,
    dbcMessages,
    filterId,
    filterText,
    busStats,
    isCapturing,
    filteredFrames,
    busLoadPercent,
    addFrame,
    clearFrames,
    loadMockDbc,
    parseAndLoadDbc,
    startCapture,
    stopCapture,
    decodeFrame,
    getExportPreview,
    exportFrames
  };
});
