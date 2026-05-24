<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { uuid } from "@/lib/utils";
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Database,
  KeyRound,
  Loader2,
  Maximize2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConnectionStore } from "@/stores/connectionStore";
import { useTheme } from "@/composables/useTheme";
import { useToast } from "@/composables/useToast";
import { type SqlHighlighter, createShikiSqlHighlighter } from "@/lib/sqlHighlighter";
import { type EditableStructureColumn, type EditableStructureIndex } from "@/lib/tableStructureEditorSql";
import { getTableStructureCapabilities } from "@/lib/tableStructureCapabilities";
import {
  buildStructureTargetLabel,
  combineDataType,
  createColumnDrafts,
  createIndexDrafts,
  DATA_TYPE_OPTIONS,
  splitDataType,
  toColumnNames,
} from "@/lib/tableStructureEditorState";
import type { ForeignKeyInfo, TriggerInfo } from "@/types/database";
import * as api from "@/lib/api";

const { t } = useI18n();
const { isDark } = useTheme();
const store = useConnectionStore();
const { toast } = useToast();

const sqlHighlighter = ref<SqlHighlighter>();
onMounted(async () => {
  sqlHighlighter.value = await createShikiSqlHighlighter({
    appearance: () => (isDark.value ? "dark" : "light"),
  });
});

const highlightedSql = computed(() => {
  if (!pendingStatements.value.length) return "";
  const sql = pendingStatements.value.join("\n");
  return sqlHighlighter.value?.(sql) ?? sql;
});

const props = defineProps<{
  connectionId: string;
  database: string;
  schema?: string;
  tableName: string;
}>();

const emit = defineEmits<{
  saved: [];
  close: [];
}>();

const activeTab = ref("columns");
const loading = ref(false);
const saving = ref(false);
const sqlPreviewLoading = ref(false);
const errorMessage = ref("");
const columns = ref<EditableStructureColumn[]>([]);
const indexes = ref<EditableStructureIndex[]>([]);
const pendingStatements = ref<string[]>([]);
const warnings = ref<string[]>([]);
const foreignKeys = ref<ForeignKeyInfo[]>([]);
const triggers = ref<TriggerInfo[]>([]);

const indexColWidths = ref([132, 200, 64, 96, 132, 160, 132, 76]);
const resizing = ref<{ col: number; startX: number; startW: number } | null>(null);

function onIndexColResize(e: MouseEvent, col: number) {
  e.preventDefault();
  resizing.value = { col, startX: e.clientX, startW: indexColWidths.value[col] };
  const onMove = (ev: MouseEvent) => {
    if (!resizing.value) return;
    const delta = ev.clientX - resizing.value.startX;
    indexColWidths.value[col] = Math.max(60, resizing.value.startW + delta);
  };
  const onUp = () => {
    resizing.value = null;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  };
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

const connection = computed(() => (props.connectionId ? store.getConfig(props.connectionId) : undefined));
const databaseType = computed(() => connection.value?.db_type);
const structureCapabilities = computed(() => getTableStructureCapabilities(databaseType.value));
const dataTypeOptions = computed(() => DATA_TYPE_OPTIONS[databaseType.value ?? ""] ?? []);

const indexTypesByDb: Record<string, string[]> = {
  postgres: ["BTREE", "HASH", "GIST", "SPGIST", "GIN", "BRIN"],
  mysql: ["BTREE", "HASH", "FULLTEXT", "SPATIAL", "RTREE"],
  sqlserver: ["CLUSTERED", "NONCLUSTERED", "COLUMNSTORE", "NONCLUSTERED COLUMNSTORE", "XML", "SPATIAL"],
  oracle: ["NORMAL", "BITMAP", "FUNCTION-BASED NORMAL", "FUNCTION-BASED DOMAIN", "DOMAIN", "CLUSTER"],
  sqlite: ["BTREE"],
};
const indexTypeOptions = computed(() =>
  structureCapabilities.value.indexType ? (indexTypesByDb[databaseType.value ?? ""] ?? []) : [],
);

const indexColLabels = computed(() => [
  t("structureEditor.indexName"),
  t("structureEditor.indexColumns"),
  t("structureEditor.unique"),
  t("structureEditor.indexType"),
  t("structureEditor.includedColumns"),
  t("structureEditor.filter"),
  t("structureEditor.comment"),
  t("structureEditor.actions"),
]);
const targetSchema = computed(() => props.schema || props.database || "");
const isCreateMode = computed(() => !props.tableName);
const newTableName = ref("");
const targetLabel = computed(() =>
  buildStructureTargetLabel(
    connection.value?.name,
    props.database,
    props.schema,
    isCreateMode.value ? undefined : props.tableName,
  ),
);

let sqlPreviewRequestId = 0;

async function refreshSqlPreview() {
  const requestId = ++sqlPreviewRequestId;
  sqlPreviewLoading.value = true;
  const options = {
    databaseType: databaseType.value,
    schema: props.schema,
    tableName: isCreateMode.value ? newTableName.value : props.tableName || "",
    columns: columns.value,
    indexes: indexes.value,
  };
  try {
    const result = isCreateMode.value
      ? await api.buildCreateTableSql(options)
      : await api.buildTableStructureChangeSql(options);
    if (requestId !== sqlPreviewRequestId) return;
    pendingStatements.value = result.statements;
    warnings.value = result.warnings;
  } catch (e: any) {
    if (requestId !== sqlPreviewRequestId) return;
    pendingStatements.value = [];
    warnings.value = [e?.message || String(e)];
  } finally {
    if (requestId === sqlPreviewRequestId) sqlPreviewLoading.value = false;
  }
}

const canApply = computed(
  () =>
    !loading.value &&
    !saving.value &&
    !sqlPreviewLoading.value &&
    pendingStatements.value.length > 0 &&
    warnings.value.length === 0 &&
    !!props.connectionId &&
    (isCreateMode.value ? !!newTableName.value.trim() : !!props.tableName),
);

function resetState() {
  activeTab.value = "columns";
  loading.value = false;
  saving.value = false;
  sqlPreviewLoading.value = false;
  errorMessage.value = "";
  columns.value = [];
  indexes.value = [];
  pendingStatements.value = [];
  warnings.value = [];
  foreignKeys.value = [];
  triggers.value = [];
  newTableName.value = "";
}

async function loadStructure(silent = false) {
  if (!props.connectionId || !props.database || !props.tableName) return;
  if (!silent) loading.value = true;
  errorMessage.value = "";
  try {
    await store.ensureConnected(props.connectionId);
    const nextColumns = await api.getColumns(
      props.connectionId,
      props.database,
      targetSchema.value,
      props.tableName,
    );
    const [nextIndexes, nextForeignKeys, nextTriggers] = await Promise.all([
      api
        .listIndexes(props.connectionId, props.database, targetSchema.value, props.tableName)
        .catch(() => []),
      api
        .listForeignKeys(props.connectionId, props.database, targetSchema.value, props.tableName)
        .catch(() => []),
      api
        .listTriggers(props.connectionId, props.database, targetSchema.value, props.tableName)
        .catch(() => []),
    ]);
    columns.value = createColumnDrafts(nextColumns);
    indexes.value = createIndexDrafts(nextIndexes);
    foreignKeys.value = nextForeignKeys;
    triggers.value = nextTriggers;
  } catch (e: any) {
    errorMessage.value = e?.message || String(e);
  } finally {
    if (!silent) loading.value = false;
  }
}

function addColumn() {
  if (!structureCapabilities.value.addColumn) return;
  columns.value.push({
    id: `new:${uuid()}`,
    name: "",
    dataType: "varchar(255)",
    isNullable: true,
    defaultValue: "",
    comment: "",
    isPrimaryKey: false,
    markedForDrop: false,
  });
}

function removeNewColumn(column: EditableStructureColumn) {
  columns.value = columns.value.filter((item) => item.id !== column.id);
}

function canMoveColumn(index: number, direction: -1 | 1): boolean {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= columns.value.length) return false;
  if (columns.value[index]?.markedForDrop || columns.value[targetIndex]?.markedForDrop) return false;
  return isCreateMode.value || structureCapabilities.value.reorderColumn;
}

function moveColumn(index: number, direction: -1 | 1) {
  if (!canMoveColumn(index, direction)) return;
  const targetIndex = index + direction;
  const [column] = columns.value.splice(index, 1);
  if (!column) return;
  columns.value.splice(targetIndex, 0, column);
}

function toggleDropColumn(column: EditableStructureColumn) {
  if (!canDropColumn(column)) return;
  column.markedForDrop = !column.markedForDrop;
}

function isColumnNameDisabled(column: EditableStructureColumn): boolean {
  return column.markedForDrop || (!!column.original && !structureCapabilities.value.renameColumn);
}

function isColumnTypeDisabled(column: EditableStructureColumn): boolean {
  return column.markedForDrop || (!!column.original && !structureCapabilities.value.alterType);
}

function isColumnNullableDisabled(column: EditableStructureColumn): boolean {
  return (
    column.markedForDrop || column.isPrimaryKey || (!!column.original && !structureCapabilities.value.alterNullability)
  );
}

function isColumnDefaultDisabled(column: EditableStructureColumn): boolean {
  return column.markedForDrop || (!!column.original && !structureCapabilities.value.alterDefault);
}

function isColumnCommentDisabled(column: EditableStructureColumn): boolean {
  return column.markedForDrop || !structureCapabilities.value.comment;
}

function isPrimaryKeyDisabled(column: EditableStructureColumn): boolean {
  if (column.markedForDrop) return true;
  if (!column.original) return false;
  return !structureCapabilities.value.alterPrimaryKey;
}

function canDropColumn(column: EditableStructureColumn): boolean {
  return !!column.original && !column.isPrimaryKey && structureCapabilities.value.dropColumn;
}

function addIndex() {
  if (!structureCapabilities.value.createIndex) return;
  indexes.value.push({
    id: `new:${uuid()}`,
    name: "",
    columns: [],
    isUnique: false,
    isPrimary: false,
    filter: "",
    indexType: "",
    includedColumns: [],
    comment: "",
    markedForDrop: false,
  });
}

const availableColumnNames = computed(() =>
  columns.value
    .filter((c) => !c.markedForDrop)
    .map((c) => c.name)
    .filter(Boolean),
);

const colSearch = ref("");
const filteredColumnNames = computed(() => {
  const q = colSearch.value.toLowerCase().trim();
  if (!q) return availableColumnNames.value;
  return availableColumnNames.value.filter((c) => c.toLowerCase().includes(q));
});

function toggleIndexColumn(index: EditableStructureIndex, col: string) {
  const i = index.columns.indexOf(col);
  if (i >= 0) index.columns.splice(i, 1);
  else index.columns.push(col);
}

function toggleIncludedColumn(index: EditableStructureIndex, col: string) {
  if (!structureCapabilities.value.indexInclude) return;
  const i = index.includedColumns.indexOf(col);
  if (i >= 0) index.includedColumns.splice(i, 1);
  else index.includedColumns.push(col);
}

function removeNewIndex(index: EditableStructureIndex) {
  indexes.value = indexes.value.filter((item) => item.id !== index.id);
}

function toggleDropIndex(index: EditableStructureIndex) {
  if (!canDropIndex(index)) return;
  index.markedForDrop = !index.markedForDrop;
}

function canEditIndexDraft(index: EditableStructureIndex): boolean {
  if (index.markedForDrop || index.isPrimary) return false;
  if (!index.original) return structureCapabilities.value.createIndex;
  return (
    structureCapabilities.value.rebuildIndex &&
    structureCapabilities.value.createIndex &&
    structureCapabilities.value.dropIndex
  );
}

function canEditIndexFilter(index: EditableStructureIndex): boolean {
  return canEditIndexDraft(index) && structureCapabilities.value.indexFilter;
}

function canEditIndexComment(index: EditableStructureIndex): boolean {
  return canEditIndexDraft(index) && structureCapabilities.value.indexComment;
}

function canDropIndex(index: EditableStructureIndex): boolean {
  return !!index.original && !index.isPrimary && structureCapabilities.value.dropIndex;
}

async function applyChanges() {
  if (!canApply.value || !props.connectionId || !props.database) return;
  saving.value = true;
  errorMessage.value = "";
  try {
    await api.executeBatch(props.connectionId, props.database, pendingStatements.value);
    toast(t("structureEditor.saved"), 2500);
    emit("saved");
    if (isCreateMode.value) {
      emit("close");
    } else {
      await loadStructure(true);
    }
  } catch (e: any) {
    errorMessage.value = e?.message || String(e);
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  resetState();
  void loadStructure();
});

watch(
  [
    isCreateMode,
    databaseType,
    () => props.schema,
    () => props.tableName,
    newTableName,
    columns,
    indexes,
  ],
  () => {
    void refreshSqlPreview();
  },
  { deep: true, immediate: true },
);
</script>

<template>
  <div class="flex h-full flex-col space-y-2 p-3 text-[11px]" data-structure-density="compact">
    <div class="flex items-center gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5 text-[11px]">
      <Database class="h-3.5 w-3.5 text-muted-foreground" />
      <span class="min-w-0 flex-1 truncate font-medium">{{ targetLabel || t("editor.noDatabase") }}</span>
      <Badge variant="outline">{{ connection?.driver_label || databaseType }}</Badge>
      <Button
        v-if="!isCreateMode"
        variant="ghost"
        size="sm"
        class="h-6 gap-1 px-2 text-[11px]"
        :disabled="loading || saving"
        @click="loadStructure()"
      >
        <RefreshCw class="h-3.5 w-3.5" />
        {{ t("structureEditor.refresh") }}
      </Button>
    </div>

    <div v-if="isCreateMode" class="flex items-center gap-2">
      <label class="shrink-0 text-[11px] font-medium text-muted-foreground">{{
        t("structureEditor.tableName")
      }}</label>
      <Input
        v-model="newTableName"
        :placeholder="t('contextMenu.duplicateNamePlaceholder')"
        class="h-6 max-w-[220px] text-[11px]"
      />
    </div>

    <div v-if="loading" class="flex h-[420px] items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 class="h-4 w-4 animate-spin" />
      {{ t("common.loading") }}
    </div>

    <div v-else class="grid flex-1 min-h-0 grid-cols-[minmax(0,1fr)_300px] gap-2">
      <div class="min-w-0 rounded-md border">
        <Tabs v-model="activeTab" class="flex h-full flex-col">
          <div class="flex items-center justify-between border-b px-2 py-1.5">
            <TabsList>
              <TabsTrigger value="columns">{{ t("structureEditor.columns") }}</TabsTrigger>
              <TabsTrigger value="indexes">{{ t("structureEditor.indexes") }}</TabsTrigger>
              <TabsTrigger value="foreignKeys">{{ t("structureEditor.foreignKeys") }}</TabsTrigger>
              <TabsTrigger value="triggers">{{ t("structureEditor.triggers") }}</TabsTrigger>
            </TabsList>
            <Button
              v-if="activeTab === 'columns'"
              size="sm"
              class="h-6 gap-1 px-2 text-[11px]"
              :disabled="!structureCapabilities.addColumn"
              @click="addColumn"
            >
              <Plus class="h-3.5 w-3.5" />
              {{ t("structureEditor.addColumn") }}
            </Button>
            <Button
              v-if="activeTab === 'indexes'"
              size="sm"
              class="h-6 gap-1 px-2 text-[11px]"
              :disabled="!structureCapabilities.createIndex"
              @click="addIndex"
            >
              <Plus class="h-3.5 w-3.5" />
              {{ t("structureEditor.addIndex") }}
            </Button>
          </div>

          <TabsContent value="columns" class="m-0 min-h-0 flex-1 overflow-auto p-0">
            <table class="min-w-full border-separate border-spacing-0 text-[11px]">
              <thead class="sticky top-0 z-10 bg-background">
                <tr>
                  <th class="w-7 border-b border-r px-1.5 py-1.5 text-left">#</th>
                  <th class="min-w-32 border-b border-r px-1.5 py-1.5 text-left">
                    {{ t("structureEditor.columnName") }}
                  </th>
                  <th class="min-w-28 border-b border-r px-1.5 py-1.5 text-left">
                    {{ t("structureEditor.dataType") }}
                  </th>
                  <th class="min-w-20 border-b border-r px-1.5 py-1.5 text-left">
                    {{ t("structureEditor.length") }}
                  </th>
                  <th class="w-16 whitespace-nowrap border-b border-r px-1.5 py-1.5 text-left">
                    {{ t("structureEditor.nullable") }}
                  </th>
                  <th class="w-14 whitespace-nowrap border-b border-r px-1.5 py-1.5 text-center">
                    {{ t("structureEditor.primaryKey") }}
                  </th>
                  <th class="min-w-28 border-b border-r px-1.5 py-1.5 text-left">
                    {{ t("structureEditor.defaultValue") }}
                  </th>
                  <th class="min-w-32 border-b border-r px-1.5 py-1.5 text-left">
                    {{ t("structureEditor.comment") }}
                  </th>
                  <th class="w-32 border-b px-1.5 py-1.5 text-left">
                    {{ t("structureEditor.actions") }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(column, index) in columns"
                  :key="column.id"
                  :class="column.markedForDrop ? 'bg-destructive/5 opacity-60' : ''"
                >
                  <td class="border-b border-r px-1.5 py-1 text-muted-foreground">
                    <div class="flex items-center gap-1">
                      <span>{{ index + 1 }}</span>
                      <KeyRound v-if="column.isPrimaryKey" class="h-3 w-3 text-amber-500" />
                    </div>
                  </td>
                  <td class="border-b border-r px-1.5 py-1">
                    <Input
                      v-model="column.name"
                      class="h-6 min-w-28 text-[11px]"
                      :disabled="isColumnNameDisabled(column)"
                    />
                  </td>
                  <td class="border-b border-r px-1.5 py-1">
                    <SearchableSelect
                      v-if="!isColumnTypeDisabled(column)"
                      :model-value="splitDataType(column.dataType).baseType"
                      :options="dataTypeOptions"
                      :placeholder="t('structureEditor.typePlaceholder')"
                      :search-placeholder="t('structureEditor.typePlaceholder')"
                      :empty-text="t('structureEditor.noMatchingType')"
                      :loading-text="t('common.loading')"
                      :allow-custom="true"
                      trigger-class="h-6 min-w-24 font-mono text-[11px]"
                      @update:model-value="(v: string) => column.dataType = combineDataType(v, splitDataType(column.dataType).params)"
                    />
                    <Input
                      v-else
                      :model-value="splitDataType(column.dataType).baseType"
                      class="h-6 min-w-24 font-mono text-[11px]"
                      disabled
                    />
                  </td>
                  <td class="border-b border-r px-1.5 py-1">
                    <Input
                      :model-value="splitDataType(column.dataType).params"
                      class="h-6 min-w-16 font-mono text-[11px]"
                      :disabled="isColumnTypeDisabled(column)"
                      @update:model-value="column.dataType = combineDataType(splitDataType(column.dataType).baseType, String($event))"
                    />
                  </td>
                  <td class="border-b border-r px-1.5 py-1">
                    <label class="flex items-center gap-1.5">
                      <input
                        v-model="column.isNullable"
                        type="checkbox"
                        class="h-3.5 w-3.5"
                        :disabled="isColumnNullableDisabled(column)"
                      />
                      <span>{{ column.isNullable ? t("structureEditor.yes") : t("structureEditor.no") }}</span>
                    </label>
                  </td>
                  <td class="border-b border-r px-1.5 py-1 text-center">
                    <input
                      v-model="column.isPrimaryKey"
                      type="checkbox"
                      class="h-3.5 w-3.5"
                      :disabled="isPrimaryKeyDisabled(column)"
                      @change="() => { if (column.isPrimaryKey) column.isNullable = false; }"
                    />
                  </td>
                  <td class="border-b border-r px-1.5 py-1">
                    <Input
                      v-model="column.defaultValue"
                      class="h-6 min-w-24 font-mono text-[11px]"
                      :disabled="isColumnDefaultDisabled(column)"
                    />
                  </td>
                  <td class="border-b border-r px-1.5 py-1">
                    <div class="flex min-w-36 items-center gap-1">
                      <Input
                        v-model="column.comment"
                        class="h-6 min-w-0 flex-1 text-[11px]"
                        :disabled="isColumnCommentDisabled(column)"
                      />
                      <Popover>
                        <PopoverTrigger as-child>
                          <Button
                            variant="ghost"
                            size="icon"
                            class="h-6 w-6 shrink-0"
                            :disabled="isColumnCommentDisabled(column)"
                            :aria-label="t('structureEditor.editComment')"
                            :title="t('structureEditor.editComment')"
                          >
                            <Maximize2 class="h-3.5 w-3.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" class="w-[420px] p-2.5">
                          <div class="mb-2 flex items-center justify-between gap-2">
                            <span class="min-w-0 truncate text-xs font-medium">
                              {{ t("structureEditor.editComment") }}
                            </span>
                            <span class="max-w-44 truncate font-mono text-[11px] text-muted-foreground">
                              {{ column.name || t("structureEditor.columnName") }}
                            </span>
                          </div>
                          <textarea
                            v-model="column.comment"
                            class="min-h-36 w-full resize-y rounded-md border bg-background px-2.5 py-2 text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
                            :placeholder="t('structureEditor.commentPlaceholder')"
                            :disabled="isColumnCommentDisabled(column)"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </td>
                  <td class="border-b px-1.5 py-1">
                    <div class="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        class="h-6 w-6"
                        :disabled="!canMoveColumn(index, -1)"
                        :title="t('structureEditor.moveColumnUp')"
                        :aria-label="t('structureEditor.moveColumnUp')"
                        @click="moveColumn(index, -1)"
                      >
                        <ChevronUp class="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="h-6 w-6"
                        :disabled="!canMoveColumn(index, 1)"
                        :title="t('structureEditor.moveColumnDown')"
                        :aria-label="t('structureEditor.moveColumnDown')"
                        @click="moveColumn(index, 1)"
                      >
                        <ChevronDown class="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        v-if="column.original"
                        variant="ghost"
                        size="sm"
                        class="h-6 gap-1 px-1.5 text-[11px]"
                        :disabled="!canDropColumn(column)"
                        @click="toggleDropColumn(column)"
                      >
                        <Trash2 class="h-3.5 w-3.5" />
                        {{ column.markedForDrop ? t("structureEditor.restore") : t("structureEditor.drop") }}
                      </Button>
                      <Button
                        v-else
                        variant="ghost"
                        size="sm"
                        class="h-6 gap-1 px-1.5 text-[11px]"
                        @click="removeNewColumn(column)"
                      >
                        <X class="h-3.5 w-3.5" />
                        {{ t("structureEditor.remove") }}
                      </Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="indexes" class="m-0 min-h-0 flex-1 overflow-auto p-0">
            <table class="min-w-full border-separate border-spacing-0 text-[11px]">
              <thead class="sticky top-0 z-10 bg-background">
                <tr>
                  <th
                    v-for="(label, i) in indexColLabels"
                    :key="i"
                    class="relative border-b border-r px-1.5 py-1.5 text-left"
                    :style="{
                      width: indexColWidths[i] + 'px',
                      minWidth: indexColWidths[i] + 'px',
                    }"
                  >
                    {{ label }}
                    <div
                      v-if="i < indexColLabels.length - 1"
                      class="absolute right-0 top-0 z-20 h-full w-1 cursor-col-resize hover:bg-primary/30"
                      :class="resizing?.col === i ? 'bg-primary/30' : ''"
                      @mousedown="onIndexColResize($event, i)"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="index in indexes"
                  :key="index.id"
                  :class="index.markedForDrop ? 'bg-destructive/5 opacity-60' : ''"
                >
                  <td class="border-b border-r px-1.5 py-1">
                    <Input v-model="index.name" class="h-6 text-[11px]" :disabled="!canEditIndexDraft(index)" />
                  </td>
                  <td class="overflow-hidden border-b border-r px-1.5 py-1">
                    <DropdownMenu v-if="canEditIndexDraft(index)">
                      <DropdownMenuTrigger as-child>
                        <Button variant="outline" class="h-6 w-full justify-between px-2 font-mono text-[11px]">
                          <span class="truncate">{{
                            toColumnNames(index.columns) || t("structureEditor.indexColumnsPlaceholder")
                          }}</span>
                          <ChevronDown class="ml-1 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        class="max-h-56 min-w-44 overflow-y-auto"
                        side="bottom"
                        :side-offset="2"
                        :avoid-collisions="false"
                        @interactOutside="colSearch = ''"
                      >
                        <div class="px-1.5 pb-1 pt-0.5">
                          <Input
                            v-model="colSearch"
                            class="h-6 text-[11px]"
                            :placeholder="t('grid.search')"
                            @click.stop
                          />
                        </div>
                        <DropdownMenuCheckboxItem
                          v-for="col in filteredColumnNames"
                          :key="col"
                          :checked="index.columns.includes(col)"
                          :class="index.columns.includes(col) ? 'bg-primary/10' : ''"
                          @select.prevent
                          @click="toggleIndexColumn(index, col)"
                        >
                          {{ col }}
                        </DropdownMenuCheckboxItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <span v-else class="font-mono text-[11px] text-muted-foreground">{{
                      toColumnNames(index.columns)
                    }}</span>
                  </td>
                  <td class="border-b border-r px-1.5 py-1">
                    <label class="flex items-center gap-1.5">
                      <input
                        v-model="index.isUnique"
                        type="checkbox"
                        class="h-3.5 w-3.5"
                        :disabled="!canEditIndexDraft(index)"
                      />
                      <span>{{ index.isUnique ? t("structureEditor.yes") : t("structureEditor.no") }}</span>
                    </label>
                  </td>
                  <td class="border-b border-r px-1.5 py-1">
                    <Select
                      v-if="indexTypeOptions.length > 0"
                      :model-value="index.indexType || 'BTREE'"
                      :disabled="!canEditIndexDraft(index)"
                      @update:model-value="(v: any) => (index.indexType = String(v ?? ''))"
                    >
                      <SelectTrigger class="h-6 font-mono text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="opt in indexTypeOptions" :key="opt" :value="opt">{{ opt }}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      v-else
                      v-model="index.indexType"
                      class="h-6 font-mono text-[11px]"
                      placeholder="BTREE"
                      :disabled="!canEditIndexDraft(index) || !structureCapabilities.indexType"
                    />
                  </td>
                  <td class="overflow-hidden border-b border-r px-1.5 py-1">
                    <DropdownMenu v-if="canEditIndexDraft(index) && structureCapabilities.indexInclude">
                      <DropdownMenuTrigger as-child>
                        <Button variant="outline" class="h-6 w-full justify-between px-2 font-mono text-[11px]">
                          <span class="truncate">{{
                            index.includedColumns.join(", ") || t("structureEditor.includedColumnsPlaceholder")
                          }}</span>
                          <ChevronDown class="ml-1 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        class="max-h-56 min-w-44 overflow-y-auto"
                        side="bottom"
                        :side-offset="2"
                        :avoid-collisions="false"
                        @interactOutside="colSearch = ''"
                      >
                        <div class="px-1.5 pb-1 pt-0.5">
                          <Input
                            v-model="colSearch"
                            class="h-6 text-[11px]"
                            :placeholder="t('grid.search')"
                            @click.stop
                          />
                        </div>
                        <DropdownMenuCheckboxItem
                          v-for="col in filteredColumnNames"
                          :key="col"
                          :checked="index.includedColumns.includes(col)"
                          :class="index.includedColumns.includes(col) ? 'bg-primary/10' : ''"
                          @select.prevent
                          @click="toggleIncludedColumn(index, col)"
                        >
                          {{ col }}
                        </DropdownMenuCheckboxItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <span v-else class="text-[11px] text-muted-foreground">{{
                      index.includedColumns.join(", ")
                    }}</span>
                  </td>
                  <td class="border-b border-r px-1.5 py-1">
                    <Input
                      v-model="index.filter"
                      class="h-6 font-mono text-[11px]"
                      :placeholder="index.original?.filter || ''"
                      :disabled="!canEditIndexFilter(index)"
                    />
                  </td>
                  <td class="border-b border-r px-1.5 py-1">
                    <Input
                      v-model="index.comment"
                      class="h-6 text-[11px]"
                      :disabled="!canEditIndexComment(index)"
                    />
                  </td>
                  <td class="border-b px-1.5 py-1">
                    <Badge v-if="index.isPrimary" variant="outline">{{ t("structureEditor.primary") }}</Badge>
                    <Button
                      v-else-if="index.original"
                      variant="ghost"
                      size="sm"
                      class="h-6 gap-1 px-1.5 text-[11px]"
                      :disabled="!canDropIndex(index)"
                      @click="toggleDropIndex(index)"
                    >
                      <Trash2 class="h-3.5 w-3.5" />
                      {{ index.markedForDrop ? t("structureEditor.restore") : t("structureEditor.drop") }}
                    </Button>
                    <Button
                      v-else
                      variant="ghost"
                      size="sm"
                      class="h-6 gap-1 px-1.5 text-[11px]"
                      @click="removeNewIndex(index)"
                    >
                      <X class="h-3.5 w-3.5" />
                      {{ t("structureEditor.remove") }}
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="foreignKeys" class="m-0 min-h-0 flex-1 overflow-auto p-2">
            <div v-if="foreignKeys.length === 0" class="py-10 text-center text-sm text-muted-foreground">
              {{ t("structureEditor.emptyReadonly") }}
            </div>
            <div v-else class="space-y-1.5">
              <div v-for="fk in foreignKeys" :key="fk.name" class="rounded-md border px-2 py-1.5 text-[11px]">
                <div class="font-medium">{{ fk.name }}</div>
                <div class="mt-1 font-mono text-muted-foreground">
                  {{ fk.column }} -> {{ fk.ref_table }}.{{ fk.ref_column }}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="triggers" class="m-0 min-h-0 flex-1 overflow-auto p-2">
            <div v-if="triggers.length === 0" class="py-10 text-center text-sm text-muted-foreground">
              {{ t("structureEditor.emptyReadonly") }}
            </div>
            <div v-else class="space-y-1.5">
              <div
                v-for="trigger in triggers"
                :key="trigger.name"
                class="rounded-md border px-2 py-1.5 text-[11px]"
              >
                <div class="font-medium">{{ trigger.name }}</div>
                <div class="mt-1 font-mono text-muted-foreground">{{ trigger.timing }} {{ trigger.event }}</div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div class="flex min-w-0 flex-col rounded-md border">
        <div class="flex items-center justify-between border-b px-2 py-1.5 text-[11px] font-medium">
          <div class="flex items-center gap-1.5">
            <span>{{ t("structureEditor.sqlPreview") }}</span>
            <Badge v-if="!saving && pendingStatements.length && warnings.length === 0" variant="outline" class="h-4 px-1 text-[10px]">
              <Check class="h-3 w-3" />
              {{ t("structureEditor.ready") }}
            </Badge>
          </div>
          <Badge variant="secondary">
            <Loader2 v-if="sqlPreviewLoading" class="h-3 w-3 animate-spin" />
            <span v-else>{{ pendingStatements.length }}</span>
          </Badge>
        </div>
        <div class="min-h-0 flex-1 overflow-auto p-2">
          <div v-if="warnings.length" class="mb-2 space-y-1">
            <div
              v-for="warning in warnings"
              :key="warning"
              class="flex gap-1.5 rounded-md border border-yellow-300/40 bg-yellow-500/10 px-2 py-1 text-[11px] text-yellow-700 dark:text-yellow-300"
            >
              <AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{{ warning }}</span>
            </div>
          </div>
          <pre
            v-if="pendingStatements.length"
            class="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-2 font-mono text-[11px] leading-4"
            v-html="highlightedSql" />
          <div v-else class="flex h-full items-center justify-center text-sm text-muted-foreground">
            {{ t("structureEditor.noChanges") }}
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="errorMessage"
      class="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive"
    >
      {{ errorMessage }}
    </div>

    <div class="flex items-center justify-end gap-2">
      <Button :disabled="!canApply" @click="applyChanges">
        <Loader2 v-if="saving" class="mr-1.5 h-3.5 w-3.5 animate-spin" />
        <Save v-else class="mr-1.5 h-3.5 w-3.5" />
        {{ t("structureEditor.apply") }}
      </Button>
    </div>
  </div>
</template>
