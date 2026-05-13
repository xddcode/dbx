<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { X, Pin, ChevronRight, Table2, Code2, TableProperties, Package } from "lucide-vue-next";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useQueryStore } from "@/stores/queryStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTabScroll } from "@/composables/useTabScroll";
import { connectionColor, tabDisplayTitle, tabTooltipLines } from "@/lib/tabPresentation";
import { hexToRgba } from "@/lib/color";
import type { QueryTab } from "@/types/database";

const props = defineProps<{
  showDriverStore?: boolean;
}>();

const emit = defineEmits<{
  "toggle-driver-store": [];
  "close-driver-store": [];
}>();

const { t } = useI18n();
const queryStore = useQueryStore();
const settingsStore = useSettingsStore();

const tabsContainerRef = ref<HTMLElement | null>(null);
const { canScrollLeft, canScrollRight, updateScrollButtons, scrollTabs } = useTabScroll(tabsContainerRef);

watch(
  () => queryStore.tabs.length,
  () => {
    nextTick(updateScrollButtons);
  },
);

watch(
  () => queryStore.activeTabId,
  () => {
    nextTick(() => {
      const container = tabsContainerRef.value;
      if (!container) return;
      const activeEl = container.querySelector('[data-active-tab="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
      updateScrollButtons();
    });
  },
);

watch(
  () => props.showDriverStore,
  (show) => {
    if (!show) return;
    nextTick(() => {
      const container = tabsContainerRef.value;
      if (!container) return;
      const el = container.querySelector("[data-driver-store-tab]");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
      updateScrollButtons();
    });
  },
);

function tabColorStyle(tab: QueryTab) {
  const color = connectionColor(tab.connectionId);
  const isActive = tab.id === queryStore.activeTabId && !props.showDriverStore;
  const isClassic = settingsStore.editorSettings.appLayout === "classic";
  if (!color) {
    if (isClassic) {
      return isActive ? { boxShadow: "0 1px 0 0 var(--color-background)" } : undefined;
    }
    return isActive
      ? {
          borderColor: "var(--ring)",
        }
      : undefined;
  }

  if (isClassic) {
    return {
      backgroundColor: hexToRgba(color, isActive ? 0.16 : 0.07),
      boxShadow: isActive ? `inset 0 -2px 0 ${color}` : undefined,
    };
  }

  return {
    backgroundColor: hexToRgba(color, isActive ? 0.16 : 0.09),
    borderColor: isActive ? hexToRgba(color, 0.72) : hexToRgba(color, 0.18),
  };
}

function tabIconClass(tab: QueryTab) {
  if (tab.mode === "data" || tab.mode === "objects") return "text-emerald-600 dark:text-emerald-400";
  return "text-blue-600 dark:text-blue-400";
}
</script>

<template>
  <div
    v-if="queryStore.tabs.length > 0 || showDriverStore"
    class="relative flex border-b shrink-0"
    :class="
      settingsStore.editorSettings.appLayout === 'classic'
        ? 'h-9 items-stretch bg-muted'
        : 'h-10 items-center bg-background px-2'
    "
  >
    <button
      v-if="canScrollLeft"
      class="absolute left-0 z-10 h-full pl-1 pr-6 bg-linear-to-r from-background from-40% to-transparent text-muted-foreground hover:text-foreground"
      :aria-label="t('tabs.scrollLeft')"
      @click="scrollTabs('left')"
    >
      <ChevronRight class="h-4 w-4 rotate-180" />
    </button>
    <div
      ref="tabsContainerRef"
      class="flex-1 flex items-center overflow-x-auto min-w-0"
      :class="settingsStore.editorSettings.appLayout === 'classic' ? '' : 'gap-1.5'"
      style="-ms-overflow-style: none; scrollbar-width: none; -webkit-overflow-scrolling: touch"
      @scroll="updateScrollButtons"
    >
      <ContextMenu v-for="tab in queryStore.tabs" :key="tab.id">
        <ContextMenuTrigger :class="settingsStore.editorSettings.appLayout === 'classic' ? 'h-full' : ''">
          <Tooltip>
            <TooltipTrigger as-child>
              <div
                class="group flex min-w-38 items-center gap-1 px-2 text-xs cursor-pointer transition-colors whitespace-nowrap"
                :class="
                  settingsStore.editorSettings.appLayout === 'classic'
                    ? [
                        'h-full border-r border-border/50',
                        tab.id === queryStore.activeTabId && !showDriverStore
                          ? 'bg-background text-foreground font-medium'
                          : 'text-foreground/70 hover:text-foreground/90',
                      ]
                    : [
                        'h-7 rounded-md border',
                        tab.id === queryStore.activeTabId && !showDriverStore
                          ? 'text-foreground font-medium'
                          : 'border-border/60 text-foreground/70 hover:border-border hover:text-foreground/90',
                      ]
                "
                :style="tabColorStyle(tab)"
                :data-active-tab="tab.id === queryStore.activeTabId && !showDriverStore"
                @click="
                  queryStore.activeTabId = tab.id;
                  emit('close-driver-store');
                "
                @mousedown.middle.prevent="queryStore.closeTab(tab.id)"
              >
                <span class="shrink-0" :class="tabIconClass(tab)">
                  <Table2 v-if="tab.mode === 'data'" class="h-3.5 w-3.5" />
                  <TableProperties v-else-if="tab.mode === 'objects'" class="h-3.5 w-3.5" />
                  <Code2 v-else class="h-3.5 w-3.5" />
                </span>
                <span class="min-w-0 truncate flex-1">{{ tabDisplayTitle(tab) }}</span>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button
                      class="inline-flex rounded p-0.5 text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground focus:opacity-100"
                      :class="tab.pinned ? 'visible text-primary' : 'invisible group-hover:visible'"
                      @click.stop="queryStore.togglePinnedTab(tab.id)"
                    >
                      <Pin class="h-3 w-3" :class="{ 'fill-current': tab.pinned }" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{{ tab.pinned ? t("contextMenu.unpin") : t("contextMenu.pin") }}</TooltipContent>
                </Tooltip>
                <button
                  class="rounded hover:bg-muted-foreground/20 p-0.5 shrink-0"
                  @click.stop="queryStore.closeTab(tab.id)"
                >
                  <X class="h-3 w-3" />
                </button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" class="text-xs grid grid-cols-[auto_1fr] gap-x-2">
              <template v-for="line in tabTooltipLines(tab)" :key="line.label">
                <span class="text-muted-foreground">{{ line.label }}</span>
                <span>{{ line.value }}</span>
              </template>
            </TooltipContent>
          </Tooltip>
        </ContextMenuTrigger>

        <ContextMenuContent class="w-44">
          <ContextMenuItem @click="queryStore.togglePinnedTab(tab.id)">
            <Pin class="w-3.5 h-3.5 mr-2" :class="{ 'fill-current': tab.pinned }" />
            {{ tab.pinned ? t("contextMenu.unpin") : t("contextMenu.pin") }}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem @click="queryStore.closeTab(tab.id)">
            <X class="w-3.5 h-3.5 mr-2" />
            {{ t("contextMenu.closeTab") }}
          </ContextMenuItem>
          <ContextMenuItem :disabled="queryStore.tabs.length <= 1" @click="queryStore.closeOtherTabs(tab.id)">
            <X class="w-3.5 h-3.5 mr-2" />
            {{ t("contextMenu.closeOtherTabs") }}
          </ContextMenuItem>
          <ContextMenuItem variant="destructive" @click="queryStore.closeAllTabs">
            <X class="w-3.5 h-3.5 mr-2" />
            {{ t("contextMenu.closeAllTabs") }}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <!-- Driver Store Tab -->
      <div
        v-if="showDriverStore"
        data-driver-store-tab
        class="group flex min-w-38 items-center gap-1 px-2 text-xs cursor-pointer transition-colors whitespace-nowrap"
        :class="
          settingsStore.editorSettings.appLayout === 'classic'
            ? ['h-full border-r border-border/50 bg-background text-foreground font-medium']
            : ['h-7 rounded-md border text-foreground font-medium', 'border-ring']
        "
        :style="
          settingsStore.editorSettings.appLayout === 'classic' ? { boxShadow: '0 1px 0 0 var(--color-background)' } : {}
        "
        @click="emit('toggle-driver-store')"
      >
        <span class="shrink-0 text-amber-600 dark:text-amber-400">
          <Package class="h-3.5 w-3.5" />
        </span>
        <span class="min-w-0 truncate flex-1">驱动管理</span>
        <button class="rounded hover:bg-muted-foreground/20 p-0.5 shrink-0" @click.stop="emit('close-driver-store')">
          <X class="h-3 w-3" />
        </button>
      </div>
    </div>
    <button
      v-if="canScrollRight"
      class="absolute right-0 z-10 h-full pr-1 pl-6 bg-linear-to-l from-background from-40% to-transparent text-muted-foreground hover:text-foreground"
      :aria-label="t('tabs.scrollRight')"
      @click="scrollTabs('right')"
    >
      <ChevronRight class="h-4 w-4" />
    </button>
  </div>
</template>
