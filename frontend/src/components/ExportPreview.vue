<script setup lang="ts">
import { computed } from 'vue';
import { useCanBusStore } from '../store/canbus';
import type { ExportPreviewData, AnomalyType } from '../types';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm'): void;
}>();

const store = useCanBusStore();

const preview = computed<ExportPreviewData>(() => store.getExportPreview());

const totalAnomalies = computed(() => {
  const t = preview.value.anomalyCountByType;
  return t.out_of_range + t.unknown_id + t.data_length + t.jump;
});

const anomalyTypeLabels: Record<AnomalyType, { label: string; color: string; bg: string }> = {
  out_of_range: { label: '值超出范围', color: 'text-red-400', bg: 'bg-red-900/30' },
  unknown_id: { label: '未知 CAN ID', color: 'text-orange-400', bg: 'bg-orange-900/30' },
  data_length: { label: '数据长度异常', color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  jump: { label: '信号值突变', color: 'text-purple-400', bg: 'bg-purple-900/30' }
};

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour12: false }) + '.' + d.getMilliseconds().toString().padStart(3, '0');
}

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', { hour12: false });
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/70 backdrop-blur-sm"
        @click="emit('close')"
      ></div>

      <!-- Modal -->
      <div
        class="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-cyan-600/20 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 class="text-lg font-bold text-gray-100">导出预览</h2>
              <p class="text-xs text-gray-500">确认数据无误后再导出，减少反复试错</p>
            </div>
          </div>
          <button
            @click="emit('close')"
            class="w-8 h-8 rounded-lg hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-200 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <!-- Empty State -->
          <div
            v-if="preview.frameCount === 0"
            class="flex flex-col items-center justify-center py-12 text-gray-500"
          >
            <svg class="w-16 h-16 mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p class="text-lg font-medium">暂无数据可导出</p>
            <p class="text-sm mt-1">请先开始捕获 CAN 帧</p>
          </div>

          <template v-else>
            <!-- Overview Cards -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div class="text-xs text-gray-500 mb-1">总帧数</div>
                <div class="text-2xl font-bold text-cyan-400 font-mono">{{ preview.frameCount }}</div>
              </div>
              <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div class="text-xs text-gray-500 mb-1">时间跨度</div>
                <div class="text-2xl font-bold text-gray-100 font-mono">
                  <template v-if="preview.timeRange">
                    {{ formatDuration(preview.timeRange.end - preview.timeRange.start) }}
                  </template>
                  <template v-else>-</template>
                </div>
              </div>
              <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div class="text-xs text-gray-500 mb-1">唯一 CAN ID</div>
                <div class="text-2xl font-bold text-blue-400 font-mono">{{ preview.uniqueIds }}</div>
              </div>
              <div class="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div class="text-xs text-gray-500 mb-1">异常总数</div>
                <div
                  class="text-2xl font-bold font-mono"
                  :class="totalAnomalies > 0 ? 'text-red-400' : 'text-green-400'"
                >
                  {{ totalAnomalies }}
                </div>
              </div>
            </div>

            <!-- Secondary Stats -->
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div class="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
                <div class="flex items-center gap-2 mb-1">
                  <span class="w-2 h-2 rounded-full bg-green-500"></span>
                  <span class="text-xs text-gray-500">RX 帧</span>
                </div>
                <div class="text-lg font-bold text-green-400 font-mono">{{ preview.rxCount }}</div>
              </div>
              <div class="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
                <div class="flex items-center gap-2 mb-1">
                  <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span class="text-xs text-gray-500">TX 帧</span>
                </div>
                <div class="text-lg font-bold text-blue-400 font-mono">{{ preview.txCount }}</div>
              </div>
              <div class="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
                <div class="flex items-center gap-2 mb-1">
                  <span class="w-2 h-2 rounded-full bg-cyan-500"></span>
                  <span class="text-xs text-gray-500">已解码</span>
                </div>
                <div class="text-lg font-bold text-cyan-400 font-mono">{{ preview.decodedCount }}</div>
              </div>
              <div class="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
                <div class="flex items-center gap-2 mb-1">
                  <span class="w-2 h-2 rounded-full bg-orange-500"></span>
                  <span class="text-xs text-gray-500">未解码</span>
                </div>
                <div class="text-lg font-bold text-orange-400 font-mono">{{ preview.undecodedCount }}</div>
              </div>
              <div class="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
                <div class="flex items-center gap-2 mb-1">
                  <span class="w-2 h-2 rounded-full bg-purple-500"></span>
                  <span class="text-xs text-gray-500">信号数</span>
                </div>
                <div class="text-lg font-bold text-purple-400 font-mono">{{ preview.signalStats.length }}</div>
              </div>
            </div>

            <!-- Time Range -->
            <div v-if="preview.timeRange" class="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
              <div class="text-xs text-gray-500 mb-2">采集时间范围</div>
              <div class="flex items-center gap-4 text-sm font-mono">
                <span class="text-gray-300">{{ formatDateTime(preview.timeRange.start) }}</span>
                <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <span class="text-gray-300">{{ formatDateTime(preview.timeRange.end) }}</span>
              </div>
            </div>

            <!-- Signal Statistics -->
            <div>
              <div class="flex items-center gap-2 mb-3">
                <h3 class="text-sm font-semibold text-gray-300">信号统计</h3>
                <span class="text-xs text-gray-500">(共 {{ preview.signalStats.length }} 个)</span>
              </div>
              <div v-if="preview.signalStats.length === 0" class="text-sm text-gray-500 py-4 text-center bg-gray-800/30 rounded-lg border border-gray-700/50">
                暂无已解码的信号数据
              </div>
              <div v-else class="overflow-x-auto rounded-lg border border-gray-700">
                <table class="w-full text-sm">
                  <thead class="bg-gray-800">
                    <tr class="text-gray-400 text-left">
                      <th class="px-4 py-2.5 font-medium">信号名</th>
                      <th class="px-4 py-2.5 font-medium text-right">样本数</th>
                      <th class="px-4 py-2.5 font-medium text-right">最小值</th>
                      <th class="px-4 py-2.5 font-medium text-right">最大值</th>
                      <th class="px-4 py-2.5 font-medium text-right">平均值</th>
                      <th class="px-4 py-2.5 font-medium text-right">最新值</th>
                      <th class="px-4 py-2.5 font-medium text-right">超范围</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="stat in preview.signalStats"
                      :key="stat.name"
                      class="border-t border-gray-800 hover:bg-gray-800/30 transition-colors font-mono"
                    >
                      <td class="px-4 py-2.5 text-cyan-400 font-medium">{{ stat.name }}</td>
                      <td class="px-4 py-2.5 text-right text-gray-300">{{ stat.count }}</td>
                      <td class="px-4 py-2.5 text-right text-blue-400">{{ stat.min.toFixed(1) }}<span class="text-gray-600 text-xs ml-1">{{ stat.unit }}</span></td>
                      <td class="px-4 py-2.5 text-right text-red-400">{{ stat.max.toFixed(1) }}<span class="text-gray-600 text-xs ml-1">{{ stat.unit }}</span></td>
                      <td class="px-4 py-2.5 text-right text-yellow-400">{{ stat.avg.toFixed(1) }}<span class="text-gray-600 text-xs ml-1">{{ stat.unit }}</span></td>
                      <td class="px-4 py-2.5 text-right text-gray-200">{{ stat.last.toFixed(1) }}<span class="text-gray-600 text-xs ml-1">{{ stat.unit }}</span></td>
                      <td class="px-4 py-2.5 text-right">
                        <span
                          v-if="stat.outOfRangeCount > 0"
                          class="px-2 py-0.5 bg-red-900/40 text-red-400 rounded text-xs font-bold"
                        >{{ stat.outOfRangeCount }}</span>
                        <span v-else class="text-gray-600 text-xs">0</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Anomaly Summary -->
            <div>
              <div class="flex items-center gap-2 mb-3">
                <h3 class="text-sm font-semibold text-gray-300">异常摘要</h3>
                <span
                  class="text-xs px-2 py-0.5 rounded-full font-medium"
                  :class="totalAnomalies > 0 ? 'bg-red-900/40 text-red-400' : 'bg-green-900/40 text-green-400'"
                >
                  {{ totalAnomalies > 0 ? `${totalAnomalies} 条异常` : '无异常' }}
                </span>
              </div>

              <!-- Anomaly Type Breakdown -->
              <div v-if="totalAnomalies > 0" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div
                  v-for="(info, type) in anomalyTypeLabels"
                  :key="type"
                  class="rounded-lg p-3 border border-gray-700"
                  :class="preview.anomalyCountByType[type as AnomalyType] > 0 ? info.bg : 'bg-gray-800/20 opacity-60'"
                >
                  <div class="text-xs mb-1" :class="info.color">{{ info.label }}</div>
                  <div class="text-xl font-bold font-mono" :class="preview.anomalyCountByType[type as AnomalyType] > 0 ? info.color : 'text-gray-600'">
                    {{ preview.anomalyCountByType[type as AnomalyType] }}
                  </div>
                </div>
              </div>

              <!-- Anomaly List -->
              <div v-if="preview.anomalies.length === 0" class="text-sm text-green-400 py-6 text-center bg-gray-800/30 rounded-lg border border-green-900/30">
                <svg class="w-8 h-8 mx-auto mb-2 text-green-500/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                数据质量良好，未检测到异常
              </div>
              <div v-else class="overflow-x-auto rounded-lg border border-gray-700 max-h-64 overflow-y-auto">
                <table class="w-full text-sm">
                  <thead class="bg-gray-800 sticky top-0">
                    <tr class="text-gray-400 text-left">
                      <th class="px-4 py-2.5 font-medium w-28">时间</th>
                      <th class="px-4 py-2.5 font-medium w-28">类型</th>
                      <th class="px-4 py-2.5 font-medium">描述</th>
                      <th class="px-4 py-2.5 font-medium">详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="anomaly in preview.anomalies.slice(0, 50)"
                      :key="anomaly.frameId + anomaly.type"
                      class="border-t border-gray-800 hover:bg-gray-800/30 transition-colors"
                    >
                      <td class="px-4 py-2 text-gray-400 font-mono text-xs whitespace-nowrap">{{ formatTime(anomaly.timestamp) }}</td>
                      <td class="px-4 py-2">
                        <span
                          class="px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap"
                          :class="[anomalyTypeLabels[anomaly.type].color, anomalyTypeLabels[anomaly.type].bg]"
                        >
                          {{ anomalyTypeLabels[anomaly.type].label }}
                        </span>
                      </td>
                      <td class="px-4 py-2 text-gray-200">{{ anomaly.message }}</td>
                      <td class="px-4 py-2 text-gray-500 text-xs font-mono">{{ anomaly.details }}</td>
                    </tr>
                  </tbody>
                </table>
                <div v-if="preview.anomalies.length > 50" class="px-4 py-2 bg-gray-800/50 text-center text-xs text-gray-500 border-t border-gray-700">
                  仅显示前 50 条，共 {{ preview.anomalies.length }} 条异常
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-4 border-t border-gray-700 bg-gray-800/50">
          <div v-if="preview.frameCount > 0 && totalAnomalies > 0" class="text-xs text-yellow-500 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            检测到 {{ totalAnomalies }} 条异常，请确认是否继续导出
          </div>
          <div v-else-if="preview.frameCount > 0" class="text-xs text-green-500 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            数据检查通过，可以安全导出
          </div>
          <div v-else class="text-xs text-gray-500">暂无可导出的数据</div>

          <div class="flex items-center gap-2">
            <button
              @click="emit('close')"
              class="px-4 py-2 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              @click="emit('confirm')"
              :disabled="preview.frameCount === 0"
              class="px-4 py-2 text-sm rounded-lg font-medium transition-colors flex items-center gap-2"
              :class="preview.frameCount > 0
                ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              确认导出 CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
