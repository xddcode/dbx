import type { ColumnInfo, IndexInfo } from "../types/database.ts";
import type { EditableStructureColumn, EditableStructureIndex } from "./tableStructureEditorSql.ts";

export const DATA_TYPE_OPTIONS: Record<string, string[]> = {
  mysql: [
    "tinyint", "smallint", "mediumint", "int", "integer", "bigint",
    "float", "double", "double precision", "real",
    "decimal", "numeric",
    "bit", "boolean", "bool", "serial",
    "char", "varchar", "tinytext", "text", "mediumtext", "longtext",
    "binary", "varbinary", "tinyblob", "blob", "mediumblob", "longblob",
    "enum", "set",
    "date", "datetime", "timestamp", "time", "year",
    "json",
    "geometry", "point", "linestring", "polygon", "multipoint", "multilinestring", "multipolygon", "geometrycollection",
  ],
  postgres: [
    "smallint", "int2", "integer", "int", "int4", "bigint", "int8",
    "smallserial", "serial", "bigserial",
    "decimal", "numeric", "real", "float", "float4", "double precision", "float8", "money",
    "boolean", "bool",
    "char", "character", "varchar", "character varying", "text",
    "bytea",
    "date", "time", "time without time zone", "time with time zone", "timetz", "timestamp", "timestamp without time zone", "timestamp with time zone", "timestamptz", "interval",
    "uuid",
    "json", "jsonb", "xml",
    "bit", "bit varying", "varbit",
    "tsvector", "tsquery",
    "cidr", "inet", "macaddr", "macaddr8",
    "point", "line", "lseg", "box", "path", "polygon", "circle",
    "int4range", "int8range", "numrange", "tsrange", "tstzrange", "daterange",
    "oid",
  ],
  sqlite: [
    "integer", "real", "text", "blob", "numeric",
  ],
  sqlserver: [
    "bit",
    "tinyint", "smallint", "int", "integer", "bigint",
    "decimal", "numeric", "float", "real", "money", "smallmoney",
    "char", "nchar", "varchar", "nvarchar", "text", "ntext",
    "date", "time", "datetime", "datetime2", "smalldatetime", "datetimeoffset", "timestamp",
    "binary", "varbinary", "image",
    "uniqueidentifier", "xml", "sql_variant", "hierarchyid",
    "geography", "geometry",
  ],
  oracle: [
    "number", "integer", "float", "binary_float", "binary_double",
    "char", "nchar", "varchar2", "nvarchar2",
    "clob", "nclob", "long",
    "date", "timestamp", "timestamp with time zone", "timestamp with local time zone",
    "interval year to month", "interval day to second",
    "raw", "long raw", "blob", "bfile",
    "boolean", "json", "vector",
    "rowid", "urowid",
    "xmltype", "sdo_geometry",
  ],
  clickhouse: [
    "Int8", "Int16", "Int32", "Int64", "Int128", "Int256",
    "UInt8", "UInt16", "UInt32", "UInt64", "UInt128", "UInt256",
    "Float16", "Float32", "Float64",
    "Decimal", "Decimal32", "Decimal64", "Decimal128", "Decimal256",
    "Bool",
    "String", "FixedString",
    "Date", "Date32", "DateTime", "DateTime64",
    "UUID",
    "IPv4", "IPv6",
    "Enum8", "Enum16",
    "Array", "Map", "Tuple", "Nested",
    "Nullable", "LowCardinality",
    "SimpleAggregateFunction", "AggregateFunction",
    "Point", "Ring", "Polygon", "MultiPolygon",
    "JSON",
  ],
};

export function createColumnDrafts(columns: ColumnInfo[]): EditableStructureColumn[] {
  return columns.map((column, index) => ({
    id: `existing:${column.name}`,
    name: column.name,
    dataType: column.data_type,
    isNullable: column.is_nullable,
    defaultValue: column.column_default ?? "",
    comment: column.comment ?? "",
    isPrimaryKey: column.is_primary_key,
    original: column,
    originalPosition: index,
    markedForDrop: false,
  }));
}

export function createIndexDrafts(indexes: IndexInfo[]): EditableStructureIndex[] {
  return indexes.map((index) => ({
    id: `existing:${index.name}`,
    name: index.name,
    columns: [...index.columns],
    isUnique: index.is_unique,
    isPrimary: index.is_primary,
    filter: index.filter ?? "",
    indexType: index.index_type ?? "",
    includedColumns: index.included_columns ? [...index.included_columns] : [],
    comment: index.comment ?? "",
    original: index,
    markedForDrop: false,
  }));
}

export function toColumnNames(columns: string[]): string {
  return columns.join(", ");
}

export function splitDataType(raw: string): { baseType: string; params: string } {
  const trimmed = raw.trim();
  const parenIdx = trimmed.indexOf("(");
  if (parenIdx === -1) return { baseType: trimmed, params: "" };
  const baseType = trimmed.slice(0, parenIdx).trim();
  const params = trimmed.slice(parenIdx + 1, trimmed.lastIndexOf(")")).trim();
  return { baseType, params };
}

export function combineDataType(baseType: string, params: string): string {
  const type = baseType.trim();
  const p = params.trim();
  if (!type) return "";
  if (!p) return type;
  return `${type}(${p})`;
}

export function buildStructureTargetLabel(
  connectionName: string | undefined,
  database: string | undefined,
  schema: string | undefined,
  tableName: string | undefined,
): string {
  const parts = [connectionName, database];
  if (schema && schema !== database) parts.push(schema);
  if (tableName) parts.push(tableName);
  return parts.filter(Boolean).join(" / ");
}
