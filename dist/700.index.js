export const id = 700;
export const ids = [700,725];
export const modules = {

/***/ 4725:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   sanitizeIdentifier: () => (/* binding */ sanitizeIdentifier)
/* harmony export */ });
/* unused harmony exports escapeStringLiteral, formatImports, formatJSDocComment, generateTypeImports, isNameReserved, isTupleStruct, parseTypeFromTypeDef, toCamelCase, toPascalCase */
function isNameReserved(name) {
  const reservedNames = [
    // Keywords
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "export",
    "extends",
    "finally",
    "for",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "new",
    "return",
    "super",
    "switch",
    "this",
    "throw",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "yield",
    // Future reserved words
    "enum",
    // Strict mode reserved words
    "implements",
    "interface",
    "let",
    "package",
    "private",
    "protected",
    "public",
    "static",
    // Contextual keywords
    "async",
    "await",
    "constructor",
    // Literals
    "null",
    "true",
    "false"
  ];
  return reservedNames.includes(name);
}
function sanitizeIdentifier(identifier) {
  const sanitized = identifier.replace(/[^a-zA-Z0-9_$]/g, "_");
  if (isNameReserved(sanitized)) {
    return sanitized + "_";
  }
  if (/^\d/.test(sanitized)) {
    return "_" + sanitized;
  }
  if (sanitized === "" || /^_+$/.test(sanitized)) {
    return "_unnamed";
  }
  return sanitized;
}
function escapeStringLiteral(str) {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
function parseTypeFromTypeDef(typeDef, isFunctionInput = false) {
  switch (typeDef.type) {
    case "scSpecTypeVal":
      return "any";
    case "scSpecTypeBool":
      return "boolean";
    case "scSpecTypeVoid":
      return "null";
    case "scSpecTypeError":
      return "Error";
    case "scSpecTypeU32":
    case "scSpecTypeI32":
      return "number";
    case "scSpecTypeU64":
    case "scSpecTypeI64":
    case "scSpecTypeTimepoint":
    case "scSpecTypeDuration":
    case "scSpecTypeU128":
    case "scSpecTypeI128":
    case "scSpecTypeU256":
    case "scSpecTypeI256":
      return "bigint";
    case "scSpecTypeBytes":
    case "scSpecTypeBytesN":
      return "Uint8Array";
    case "scSpecTypeString":
      return "string";
    case "scSpecTypeSymbol":
      return "string";
    case "scSpecTypeAddress":
    case "scSpecTypeMuxedAddress": {
      if (isFunctionInput) {
        return "string | Address";
      }
      return "string";
    }
    case "scSpecTypeVec": {
      const vecType = parseTypeFromTypeDef(
        typeDef.value.elementType,
        isFunctionInput
      );
      return `Array<${vecType}>`;
    }
    case "scSpecTypeMap": {
      const keyType = parseTypeFromTypeDef(
        typeDef.value.keyType,
        isFunctionInput
      );
      const valueType = parseTypeFromTypeDef(
        typeDef.value.valueType,
        isFunctionInput
      );
      return `Map<${keyType}, ${valueType}>`;
    }
    case "scSpecTypeTuple": {
      const tupleTypes = typeDef.value.valueTypes.map(
        (t) => parseTypeFromTypeDef(t, isFunctionInput)
      );
      return `[${tupleTypes.join(", ")}]`;
    }
    case "scSpecTypeOption": {
      while (typeDef.value.valueType.type === "scSpecTypeOption") {
        typeDef = typeDef.value.valueType;
      }
      const optionType = parseTypeFromTypeDef(
        typeDef.value.valueType,
        isFunctionInput
      );
      return `${optionType} | null`;
    }
    case "scSpecTypeResult": {
      const okType = parseTypeFromTypeDef(
        typeDef.value.okType,
        isFunctionInput
      );
      const errorType = parseTypeFromTypeDef(
        typeDef.value.errorType,
        isFunctionInput
      );
      return `Result<${okType}, ${errorType}>`;
    }
    case "scSpecTypeUdt": {
      const udtName = sanitizeIdentifier(typeDef.value.name.toString());
      return udtName;
    }
    default:
      return "unknown";
  }
}
function extractNestedTypes(typeDef) {
  switch (typeDef.type) {
    case "scSpecTypeVec":
      return [typeDef.value.elementType];
    case "scSpecTypeMap":
      return [typeDef.value.keyType, typeDef.value.valueType];
    case "scSpecTypeTuple":
      return typeDef.value.valueTypes;
    case "scSpecTypeOption":
      return [typeDef.value.valueType];
    case "scSpecTypeResult":
      return [typeDef.value.okType, typeDef.value.errorType];
    default:
      return [];
  }
}
function visitTypeDef(typeDef, accumulator) {
  const typeSwitch = typeDef.type;
  switch (typeSwitch) {
    case "scSpecTypeUdt":
      accumulator.typeFileImports.add(
        sanitizeIdentifier(typeDef.value.name.toString())
      );
      return;
    case "scSpecTypeAddress":
    case "scSpecTypeMuxedAddress":
      accumulator.stellarImports.add("Address");
      return;
    case "scSpecTypeBytes":
    case "scSpecTypeBytesN":
      return;
    case "scSpecTypeVal":
      accumulator.stellarImports.add("xdr");
      return;
    case "scSpecTypeResult":
      accumulator.stellarContractImports.add("Result");
      break;
    // Primitive types that need no imports
    case "scSpecTypeBool":
    case "scSpecTypeVoid":
    case "scSpecTypeError":
    case "scSpecTypeU32":
    case "scSpecTypeI32":
    case "scSpecTypeU64":
    case "scSpecTypeI64":
    case "scSpecTypeTimepoint":
    case "scSpecTypeDuration":
    case "scSpecTypeU128":
    case "scSpecTypeI128":
    case "scSpecTypeU256":
    case "scSpecTypeI256":
    case "scSpecTypeString":
    case "scSpecTypeSymbol":
      return;
  }
  const nestedTypes = extractNestedTypes(typeDef);
  nestedTypes.forEach((nested) => visitTypeDef(nested, accumulator));
}
function generateTypeImports(typeDefs) {
  const imports = {
    typeFileImports: /* @__PURE__ */ new Set(),
    stellarContractImports: /* @__PURE__ */ new Set(),
    stellarImports: /* @__PURE__ */ new Set()
  };
  typeDefs.forEach((typeDef) => visitTypeDef(typeDef, imports));
  return imports;
}
function formatImports(imports, options) {
  const importLines = [];
  const typeFileImports = imports.typeFileImports;
  const stellarContractImports = [
    ...imports.stellarContractImports,
    ...options?.additionalStellarContractImports || []
  ];
  const stellarImports = [
    ...imports.stellarImports,
    ...options?.additionalStellarImports || []
  ];
  if (options?.includeTypeFileImports && typeFileImports.size > 0) {
    importLines.push(
      `import {${Array.from(typeFileImports).join(", ")}} from './types.js';`
    );
  }
  if (stellarContractImports.length > 0) {
    const uniqueContractImports = Array.from(new Set(stellarContractImports));
    importLines.push(
      `import {${uniqueContractImports.join(", ")}} from '@stellar/stellar-sdk/contract';`
    );
  }
  if (stellarImports.length > 0) {
    const uniqueStellarImports = Array.from(new Set(stellarImports));
    importLines.push(
      `import {${uniqueStellarImports.join(", ")}} from '@stellar/stellar-sdk';`
    );
  }
  return importLines.join("\n");
}
function escapeJSDocContent(text) {
  return text.replace(/\*\//g, "* /").replace(
    /@(?!(param|returns?|type|throws?|example|deprecated|see|link|since|author|version|description|summary)\b)/g,
    "\\@"
  );
}
function formatJSDocComment(comment, indentLevel = 0) {
  if (comment.trim() === "") {
    return "";
  }
  const indent = " ".repeat(indentLevel);
  const escapedComment = escapeJSDocContent(comment);
  const lines = escapedComment.split("\n").map((line) => `${indent} * ${line}`.trimEnd());
  return `${indent}/**
${lines.join("\n")}
${indent} */
`;
}
function toPascalCase(identifier) {
  const pascal = identifier.split(/[_$]+/).filter((part) => part.length > 0).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
  return pascal === "" ? "Unnamed" : pascal;
}
function toCamelCase(identifier) {
  const pascal = toPascalCase(identifier);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
function isTupleStruct(udtStruct) {
  const fields = udtStruct.fields;
  return fields.every(
    (field, index) => field.name.toString().trim() === index.toString()
  );
}


//# sourceMappingURL=utils.js.map


/***/ }),

/***/ 700:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  Client: () => (/* binding */ Client)
});

// EXTERNAL MODULE: ./node_modules/uint8array-extras/index.js
var uint8array_extras = __webpack_require__(5770);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/base/util/base64.js
var base64 = __webpack_require__(5601);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/base/operation.js + 36 modules
var base_operation = __webpack_require__(1843);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/base/address.js
var base_address = __webpack_require__(9263);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/index.js
var xdr = __webpack_require__(8940);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/base/scval.js + 1 modules
var scval = __webpack_require__(6519);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/base/contract.js
var base_contract = __webpack_require__(453);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/base/numbers/index.js
var numbers = __webpack_require__(8370);
;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/contract/rust_result.js
class Ok {
  constructor(value) {
    this.value = value;
  }
  value;
  unwrapErr() {
    throw new Error("No error");
  }
  unwrap() {
    return this.value;
  }
  isOk() {
    return true;
  }
  isErr() {
    return false;
  }
}
class Err {
  constructor(error) {
    this.error = error;
  }
  error;
  unwrapErr() {
    return this.error;
  }
  unwrap() {
    throw new Error(this.error.message);
  }
  isOk() {
    return false;
  }
  isErr() {
    return true;
  }
}


//# sourceMappingURL=rust_result.js.map

// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/base/account.js
var account = __webpack_require__(6676);
;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/contract/types.js
const DEFAULT_TIMEOUT = 5 * 60;
const NULL_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";


//# sourceMappingURL=types.js.map

// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/values/xdr-value.js + 2 modules
var xdr_value = __webpack_require__(7690);
// EXTERNAL MODULE: ./node_modules/@stellar/js-xdr/dist/js-xdr.mjs
var js_xdr = __webpack_require__(5133);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/values/enum-value.js
var enum_value = __webpack_require__(882);
;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-entry-kind.js



class ScSpecEntryKind extends enum_value/* EnumValue */.RS {
  static scSpecEntryFunctionV0 = new ScSpecEntryKind(
    "scSpecEntryFunctionV0",
    0
  );
  static scSpecEntryUdtStructV0 = new ScSpecEntryKind(
    "scSpecEntryUdtStructV0",
    1
  );
  static scSpecEntryUdtUnionV0 = new ScSpecEntryKind(
    "scSpecEntryUdtUnionV0",
    2
  );
  static scSpecEntryUdtEnumV0 = new ScSpecEntryKind(
    "scSpecEntryUdtEnumV0",
    3
  );
  static scSpecEntryUdtErrorEnumV0 = new ScSpecEntryKind(
    "scSpecEntryUdtErrorEnumV0",
    4
  );
  static scSpecEntryEventV0 = new ScSpecEntryKind(
    "scSpecEntryEventV0",
    5
  );
  static schema = (0,enum_value/* withMemberPrefix */.P8)(
    (0,js_xdr/* enumType */.QT)("ScSpecEntryKind", {
      scSpecEntryFunctionV0: 0,
      scSpecEntryUdtStructV0: 1,
      scSpecEntryUdtUnionV0: 2,
      scSpecEntryUdtEnumV0: 3,
      scSpecEntryUdtErrorEnumV0: 4,
      scSpecEntryEventV0: 5
    }),
    "scSpecEntry"
  );
  static fromValue(value) {
    return (0,enum_value/* enumFromValue */.t4)(
      "ScSpecEntryKind",
      ScSpecEntryKind.schema,
      ScSpecEntryKind,
      value
    );
  }
  static fromName(name) {
    return (0,enum_value/* enumFromName */.$2)("ScSpecEntryKind", ScSpecEntryKind, name);
  }
  static fromXdrObject(wire) {
    return ScSpecEntryKind.fromValue(wire);
  }
}


//# sourceMappingURL=sc-spec-entry-kind.js.map

// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/values/xdr-string.js
var xdr_string = __webpack_require__(4503);
;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-type.js



class ScSpecType extends enum_value/* EnumValue */.RS {
  static scSpecTypeVal = new ScSpecType("scSpecTypeVal", 0);
  static scSpecTypeBool = new ScSpecType("scSpecTypeBool", 1);
  static scSpecTypeVoid = new ScSpecType("scSpecTypeVoid", 2);
  static scSpecTypeError = new ScSpecType("scSpecTypeError", 3);
  static scSpecTypeU32 = new ScSpecType("scSpecTypeU32", 4);
  static scSpecTypeI32 = new ScSpecType("scSpecTypeI32", 5);
  static scSpecTypeU64 = new ScSpecType("scSpecTypeU64", 6);
  static scSpecTypeI64 = new ScSpecType("scSpecTypeI64", 7);
  static scSpecTypeTimepoint = new ScSpecType(
    "scSpecTypeTimepoint",
    8
  );
  static scSpecTypeDuration = new ScSpecType("scSpecTypeDuration", 9);
  static scSpecTypeU128 = new ScSpecType("scSpecTypeU128", 10);
  static scSpecTypeI128 = new ScSpecType("scSpecTypeI128", 11);
  static scSpecTypeU256 = new ScSpecType("scSpecTypeU256", 12);
  static scSpecTypeI256 = new ScSpecType("scSpecTypeI256", 13);
  static scSpecTypeBytes = new ScSpecType("scSpecTypeBytes", 14);
  static scSpecTypeString = new ScSpecType("scSpecTypeString", 16);
  static scSpecTypeSymbol = new ScSpecType("scSpecTypeSymbol", 17);
  static scSpecTypeAddress = new ScSpecType("scSpecTypeAddress", 19);
  static scSpecTypeMuxedAddress = new ScSpecType(
    "scSpecTypeMuxedAddress",
    20
  );
  static scSpecTypeOption = new ScSpecType("scSpecTypeOption", 1e3);
  static scSpecTypeResult = new ScSpecType("scSpecTypeResult", 1001);
  static scSpecTypeVec = new ScSpecType("scSpecTypeVec", 1002);
  static scSpecTypeMap = new ScSpecType("scSpecTypeMap", 1004);
  static scSpecTypeTuple = new ScSpecType("scSpecTypeTuple", 1005);
  static scSpecTypeBytesN = new ScSpecType("scSpecTypeBytesN", 1006);
  static scSpecTypeUdt = new ScSpecType("scSpecTypeUdt", 2e3);
  static schema = (0,enum_value/* withMemberPrefix */.P8)(
    (0,js_xdr/* enumType */.QT)("ScSpecType", {
      scSpecTypeVal: 0,
      scSpecTypeBool: 1,
      scSpecTypeVoid: 2,
      scSpecTypeError: 3,
      scSpecTypeU32: 4,
      scSpecTypeI32: 5,
      scSpecTypeU64: 6,
      scSpecTypeI64: 7,
      scSpecTypeTimepoint: 8,
      scSpecTypeDuration: 9,
      scSpecTypeU128: 10,
      scSpecTypeI128: 11,
      scSpecTypeU256: 12,
      scSpecTypeI256: 13,
      scSpecTypeBytes: 14,
      scSpecTypeString: 16,
      scSpecTypeSymbol: 17,
      scSpecTypeAddress: 19,
      scSpecTypeMuxedAddress: 20,
      scSpecTypeOption: 1e3,
      scSpecTypeResult: 1001,
      scSpecTypeVec: 1002,
      scSpecTypeMap: 1004,
      scSpecTypeTuple: 1005,
      scSpecTypeBytesN: 1006,
      scSpecTypeUdt: 2e3
    }),
    "scSpecType"
  );
  static fromValue(value) {
    return (0,enum_value/* enumFromValue */.t4)("ScSpecType", ScSpecType.schema, ScSpecType, value);
  }
  static fromName(name) {
    return (0,enum_value/* enumFromName */.$2)("ScSpecType", ScSpecType, name);
  }
  static fromXdrObject(wire) {
    return ScSpecType.fromValue(wire);
  }
}


//# sourceMappingURL=sc-spec-type.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-type-bytes-n.js



class ScSpecTypeBytesN extends xdr_value/* XdrValue */.SD {
  n;
  static schema = (0,js_xdr/* struct */.w3)(
    "ScSpecTypeBytesN",
    {
      n: (0,js_xdr/* uint32 */.S8)()
    }
  );
  constructor(input) {
    super();
    this.n = input.n;
  }
  toXdrObject() {
    return {
      n: this.n
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecTypeBytesN({
      n: wire.n
    });
  }
}


//# sourceMappingURL=sc-spec-type-bytes-n.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-type-udt.js




class ScSpecTypeUdt extends xdr_value/* XdrValue */.SD {
  name;
  static schema = (0,js_xdr/* struct */.w3)("ScSpecTypeUdt", {
    name: (0,xdr_string/* xdrString */.G)(60)
  });
  constructor(input) {
    super();
    this.name = input.name instanceof xdr_string/* XdrString */.u ? input.name : new xdr_string/* XdrString */.u(input.name);
  }
  toXdrObject() {
    return {
      name: this.name
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecTypeUdt({
      name: wire.name
    });
  }
}


//# sourceMappingURL=sc-spec-type-udt.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-type-def.js






class ScSpecTypeDefBase extends xdr_value/* XdrValue */.SD {
  constructor() {
    super();
    if (new.target === ScSpecTypeDefBase) {
      throw new TypeError(
        "new xdr.ScSpecTypeDef(...) is not supported: XDR unions are built from per-variant factories. Call xdr.ScSpecTypeDef.scSpecTypeVal() (or another arm factory) instead."
      );
    }
  }
  static schema = (0,js_xdr/* union */.KC)("ScSpecTypeDef", {
    switchOn: ScSpecType.schema,
    cases: [
      (0,js_xdr/* case */.DH)("scSpecTypeVal", 0, (0,js_xdr/* void */.rI)()),
      (0,js_xdr/* case */.DH)("scSpecTypeBool", 1, (0,js_xdr/* void */.rI)()),
      (0,js_xdr/* case */.DH)("scSpecTypeVoid", 2, (0,js_xdr/* void */.rI)()),
      (0,js_xdr/* case */.DH)("scSpecTypeError", 3, (0,js_xdr/* void */.rI)()),
      (0,js_xdr/* case */.DH)("scSpecTypeU32", 4, (0,js_xdr/* void */.rI)()),
      (0,js_xdr/* case */.DH)("scSpecTypeI32", 5, (0,js_xdr/* void */.rI)()),
      (0,js_xdr/* case */.DH)("scSpecTypeU64", 6, (0,js_xdr/* void */.rI)()),
      (0,js_xdr/* case */.DH)("scSpecTypeI64", 7, (0,js_xdr/* void */.rI)()),
      (0,js_xdr/* case */.DH)("scSpecTypeTimepoint", 8, (0,js_xdr/* void */.rI)()),
      (0,js_xdr/* case */.DH)("scSpecTypeDuration", 9, (0,js_xdr/* void */.rI)()),
      (0,js_xdr/* case */.DH)("scSpecTypeU128", 10, (0,js_xdr/* void */.rI)()),
      (0,js_xdr/* case */.DH)("scSpecTypeI128", 11, (0,js_xdr/* void */.rI)()),
      (0,js_xdr/* case */.DH)("scSpecTypeU256", 12, (0,js_xdr/* void */.rI)()),
      (0,js_xdr/* case */.DH)("scSpecTypeI256", 13, (0,js_xdr/* void */.rI)()),
      (0,js_xdr/* case */.DH)("scSpecTypeBytes", 14, (0,js_xdr/* void */.rI)()),
      (0,js_xdr/* case */.DH)("scSpecTypeString", 16, (0,js_xdr/* void */.rI)()),
      (0,js_xdr/* case */.DH)("scSpecTypeSymbol", 17, (0,js_xdr/* void */.rI)()),
      (0,js_xdr/* case */.DH)("scSpecTypeAddress", 19, (0,js_xdr/* void */.rI)()),
      (0,js_xdr/* case */.DH)("scSpecTypeMuxedAddress", 20, (0,js_xdr/* void */.rI)()),
      (0,js_xdr/* case */.DH)(
        "scSpecTypeOption",
        1e3,
        (0,js_xdr/* field */.ZZ)(
          "option",
          (0,js_xdr/* lazy */.RZ)(() => ScSpecTypeOption.schema)
        )
      ),
      (0,js_xdr/* case */.DH)(
        "scSpecTypeResult",
        1001,
        (0,js_xdr/* field */.ZZ)(
          "result",
          (0,js_xdr/* lazy */.RZ)(() => ScSpecTypeResult.schema)
        )
      ),
      (0,js_xdr/* case */.DH)(
        "scSpecTypeVec",
        1002,
        (0,js_xdr/* field */.ZZ)(
          "vec",
          (0,js_xdr/* lazy */.RZ)(() => ScSpecTypeVec.schema)
        )
      ),
      (0,js_xdr/* case */.DH)(
        "scSpecTypeMap",
        1004,
        (0,js_xdr/* field */.ZZ)(
          "map",
          (0,js_xdr/* lazy */.RZ)(() => ScSpecTypeMap.schema)
        )
      ),
      (0,js_xdr/* case */.DH)(
        "scSpecTypeTuple",
        1005,
        (0,js_xdr/* field */.ZZ)(
          "tuple",
          (0,js_xdr/* lazy */.RZ)(() => ScSpecTypeTuple.schema)
        )
      ),
      (0,js_xdr/* case */.DH)("scSpecTypeBytesN", 1006, (0,js_xdr/* field */.ZZ)("bytesN", ScSpecTypeBytesN.schema)),
      (0,js_xdr/* case */.DH)("scSpecTypeUdt", 2e3, (0,js_xdr/* field */.ZZ)("udt", ScSpecTypeUdt.schema))
    ]
  });
  static scSpecTypeVal() {
    return new ScSpecTypeDefVal();
  }
  static scSpecTypeBool() {
    return new ScSpecTypeDefBool();
  }
  static scSpecTypeVoid() {
    return new ScSpecTypeDefVoid();
  }
  static scSpecTypeError() {
    return new ScSpecTypeDefError();
  }
  static scSpecTypeU32() {
    return new ScSpecTypeDefU32();
  }
  static scSpecTypeI32() {
    return new ScSpecTypeDefI32();
  }
  static scSpecTypeU64() {
    return new ScSpecTypeDefU64();
  }
  static scSpecTypeI64() {
    return new ScSpecTypeDefI64();
  }
  static scSpecTypeTimepoint() {
    return new ScSpecTypeDefTimepoint();
  }
  static scSpecTypeDuration() {
    return new ScSpecTypeDefDuration();
  }
  static scSpecTypeU128() {
    return new ScSpecTypeDefU128();
  }
  static scSpecTypeI128() {
    return new ScSpecTypeDefI128();
  }
  static scSpecTypeU256() {
    return new ScSpecTypeDefU256();
  }
  static scSpecTypeI256() {
    return new ScSpecTypeDefI256();
  }
  static scSpecTypeBytes() {
    return new ScSpecTypeDefBytes();
  }
  static scSpecTypeString() {
    return new ScSpecTypeDefString();
  }
  static scSpecTypeSymbol() {
    return new ScSpecTypeDefSymbol();
  }
  static scSpecTypeAddress() {
    return new ScSpecTypeDefAddress();
  }
  static scSpecTypeMuxedAddress() {
    return new ScSpecTypeDefMuxedAddress();
  }
  static scSpecTypeOption(option) {
    return new ScSpecTypeDefOption(option);
  }
  static scSpecTypeResult(result) {
    return new ScSpecTypeDefResult(result);
  }
  static scSpecTypeVec(vec) {
    return new ScSpecTypeDefVec(vec);
  }
  static scSpecTypeMap(map) {
    return new ScSpecTypeDefMap(map);
  }
  static scSpecTypeTuple(tuple) {
    return new ScSpecTypeDefTuple(tuple);
  }
  static scSpecTypeBytesN(bytesN) {
    return new ScSpecTypeDefBytesN(bytesN);
  }
  static scSpecTypeUdt(udt) {
    return new ScSpecTypeDefUdt(udt);
  }
  static fromXdrObject(wire) {
    switch (wire.type) {
      case 0:
        return new ScSpecTypeDefVal();
      case 1:
        return new ScSpecTypeDefBool();
      case 2:
        return new ScSpecTypeDefVoid();
      case 3:
        return new ScSpecTypeDefError();
      case 4:
        return new ScSpecTypeDefU32();
      case 5:
        return new ScSpecTypeDefI32();
      case 6:
        return new ScSpecTypeDefU64();
      case 7:
        return new ScSpecTypeDefI64();
      case 8:
        return new ScSpecTypeDefTimepoint();
      case 9:
        return new ScSpecTypeDefDuration();
      case 10:
        return new ScSpecTypeDefU128();
      case 11:
        return new ScSpecTypeDefI128();
      case 12:
        return new ScSpecTypeDefU256();
      case 13:
        return new ScSpecTypeDefI256();
      case 14:
        return new ScSpecTypeDefBytes();
      case 16:
        return new ScSpecTypeDefString();
      case 17:
        return new ScSpecTypeDefSymbol();
      case 19:
        return new ScSpecTypeDefAddress();
      case 20:
        return new ScSpecTypeDefMuxedAddress();
      case 1e3:
        return new ScSpecTypeDefOption(
          ScSpecTypeOption.fromXdrObject(wire.option)
        );
      case 1001:
        return new ScSpecTypeDefResult(
          ScSpecTypeResult.fromXdrObject(wire.result)
        );
      case 1002:
        return new ScSpecTypeDefVec(ScSpecTypeVec.fromXdrObject(wire.vec));
      case 1004:
        return new ScSpecTypeDefMap(ScSpecTypeMap.fromXdrObject(wire.map));
      case 1005:
        return new ScSpecTypeDefTuple(
          ScSpecTypeTuple.fromXdrObject(wire.tuple)
        );
      case 1006:
        return new ScSpecTypeDefBytesN(
          ScSpecTypeBytesN.fromXdrObject(wire.bytesN)
        );
      case 2e3:
        return new ScSpecTypeDefUdt(ScSpecTypeUdt.fromXdrObject(wire.udt));
    }
    throw new js_xdr/* XdrError */.zj(
      `ScSpecTypeDef: unknown type ${wire.type}`
    );
  }
  /**
   * Type guard narrowing an unknown value to a concrete ScSpecTypeDef variant.
   * Use this instead of `instanceof ScSpecTypeDef`: the exported `ScSpecTypeDef` value
   * is the abstract base, so `instanceof` narrows to the base (not the
   * variant union) and forces a cast. `ScSpecTypeDef.is(x)` narrows to the union.
   */
  static is(value) {
    return value instanceof ScSpecTypeDefBase;
  }
}
class ScSpecTypeDefVal extends ScSpecTypeDefBase {
  type = "scSpecTypeVal";
  get value() {
    return null;
  }
  toXdrObject() {
    return { type: 0 };
  }
}
class ScSpecTypeDefBool extends ScSpecTypeDefBase {
  type = "scSpecTypeBool";
  get value() {
    return null;
  }
  toXdrObject() {
    return { type: 1 };
  }
}
class ScSpecTypeDefVoid extends ScSpecTypeDefBase {
  type = "scSpecTypeVoid";
  get value() {
    return null;
  }
  toXdrObject() {
    return { type: 2 };
  }
}
class ScSpecTypeDefError extends ScSpecTypeDefBase {
  type = "scSpecTypeError";
  get value() {
    return null;
  }
  toXdrObject() {
    return { type: 3 };
  }
}
class ScSpecTypeDefU32 extends ScSpecTypeDefBase {
  type = "scSpecTypeU32";
  get value() {
    return null;
  }
  toXdrObject() {
    return { type: 4 };
  }
}
class ScSpecTypeDefI32 extends ScSpecTypeDefBase {
  type = "scSpecTypeI32";
  get value() {
    return null;
  }
  toXdrObject() {
    return { type: 5 };
  }
}
class ScSpecTypeDefU64 extends ScSpecTypeDefBase {
  type = "scSpecTypeU64";
  get value() {
    return null;
  }
  toXdrObject() {
    return { type: 6 };
  }
}
class ScSpecTypeDefI64 extends ScSpecTypeDefBase {
  type = "scSpecTypeI64";
  get value() {
    return null;
  }
  toXdrObject() {
    return { type: 7 };
  }
}
class ScSpecTypeDefTimepoint extends ScSpecTypeDefBase {
  type = "scSpecTypeTimepoint";
  get value() {
    return null;
  }
  toXdrObject() {
    return { type: 8 };
  }
}
class ScSpecTypeDefDuration extends ScSpecTypeDefBase {
  type = "scSpecTypeDuration";
  get value() {
    return null;
  }
  toXdrObject() {
    return { type: 9 };
  }
}
class ScSpecTypeDefU128 extends ScSpecTypeDefBase {
  type = "scSpecTypeU128";
  get value() {
    return null;
  }
  toXdrObject() {
    return { type: 10 };
  }
}
class ScSpecTypeDefI128 extends ScSpecTypeDefBase {
  type = "scSpecTypeI128";
  get value() {
    return null;
  }
  toXdrObject() {
    return { type: 11 };
  }
}
class ScSpecTypeDefU256 extends ScSpecTypeDefBase {
  type = "scSpecTypeU256";
  get value() {
    return null;
  }
  toXdrObject() {
    return { type: 12 };
  }
}
class ScSpecTypeDefI256 extends ScSpecTypeDefBase {
  type = "scSpecTypeI256";
  get value() {
    return null;
  }
  toXdrObject() {
    return { type: 13 };
  }
}
class ScSpecTypeDefBytes extends ScSpecTypeDefBase {
  type = "scSpecTypeBytes";
  get value() {
    return null;
  }
  toXdrObject() {
    return { type: 14 };
  }
}
class ScSpecTypeDefString extends ScSpecTypeDefBase {
  type = "scSpecTypeString";
  get value() {
    return null;
  }
  toXdrObject() {
    return { type: 16 };
  }
}
class ScSpecTypeDefSymbol extends ScSpecTypeDefBase {
  type = "scSpecTypeSymbol";
  get value() {
    return null;
  }
  toXdrObject() {
    return { type: 17 };
  }
}
class ScSpecTypeDefAddress extends ScSpecTypeDefBase {
  type = "scSpecTypeAddress";
  get value() {
    return null;
  }
  toXdrObject() {
    return { type: 19 };
  }
}
class ScSpecTypeDefMuxedAddress extends ScSpecTypeDefBase {
  type = "scSpecTypeMuxedAddress";
  get value() {
    return null;
  }
  toXdrObject() {
    return { type: 20 };
  }
}
class ScSpecTypeDefOption extends ScSpecTypeDefBase {
  type = "scSpecTypeOption";
  option;
  constructor(option) {
    super();
    this.option = option;
  }
  get value() {
    return this.option;
  }
  toXdrObject() {
    return { type: 1e3, option: this.option.toXdrObject() };
  }
}
class ScSpecTypeDefResult extends ScSpecTypeDefBase {
  type = "scSpecTypeResult";
  result;
  constructor(result) {
    super();
    this.result = result;
  }
  get value() {
    return this.result;
  }
  toXdrObject() {
    return { type: 1001, result: this.result.toXdrObject() };
  }
}
class ScSpecTypeDefVec extends ScSpecTypeDefBase {
  type = "scSpecTypeVec";
  vec;
  constructor(vec) {
    super();
    this.vec = vec;
  }
  get value() {
    return this.vec;
  }
  toXdrObject() {
    return { type: 1002, vec: this.vec.toXdrObject() };
  }
}
class ScSpecTypeDefMap extends ScSpecTypeDefBase {
  type = "scSpecTypeMap";
  map;
  constructor(map) {
    super();
    this.map = map;
  }
  get value() {
    return this.map;
  }
  toXdrObject() {
    return { type: 1004, map: this.map.toXdrObject() };
  }
}
class ScSpecTypeDefTuple extends ScSpecTypeDefBase {
  type = "scSpecTypeTuple";
  tuple;
  constructor(tuple) {
    super();
    this.tuple = tuple;
  }
  get value() {
    return this.tuple;
  }
  toXdrObject() {
    return { type: 1005, tuple: this.tuple.toXdrObject() };
  }
}
class ScSpecTypeDefBytesN extends ScSpecTypeDefBase {
  type = "scSpecTypeBytesN";
  bytesN;
  constructor(bytesN) {
    super();
    this.bytesN = bytesN;
  }
  get value() {
    return this.bytesN;
  }
  toXdrObject() {
    return { type: 1006, bytesN: this.bytesN.toXdrObject() };
  }
}
class ScSpecTypeDefUdt extends ScSpecTypeDefBase {
  type = "scSpecTypeUdt";
  udt;
  constructor(udt) {
    super();
    this.udt = udt;
  }
  get value() {
    return this.udt;
  }
  toXdrObject() {
    return { type: 2e3, udt: this.udt.toXdrObject() };
  }
}
const ScSpecTypeDef = ScSpecTypeDefBase;
class ScSpecTypeMap extends xdr_value/* XdrValue */.SD {
  keyType;
  valueType;
  static schema = (0,js_xdr/* struct */.w3)("ScSpecTypeMap", {
    keyType: (0,js_xdr/* lazy */.RZ)(() => ScSpecTypeDef.schema),
    valueType: (0,js_xdr/* lazy */.RZ)(() => ScSpecTypeDef.schema)
  });
  constructor(input) {
    super();
    this.keyType = input.keyType;
    this.valueType = input.valueType;
  }
  toXdrObject() {
    return {
      keyType: this.keyType.toXdrObject(),
      valueType: this.valueType.toXdrObject()
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecTypeMap({
      keyType: ScSpecTypeDef.fromXdrObject(wire.keyType),
      valueType: ScSpecTypeDef.fromXdrObject(wire.valueType)
    });
  }
}
class ScSpecTypeOption extends xdr_value/* XdrValue */.SD {
  valueType;
  static schema = (0,js_xdr/* struct */.w3)(
    "ScSpecTypeOption",
    {
      valueType: (0,js_xdr/* lazy */.RZ)(() => ScSpecTypeDef.schema)
    }
  );
  constructor(input) {
    super();
    this.valueType = input.valueType;
  }
  toXdrObject() {
    return {
      valueType: this.valueType.toXdrObject()
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecTypeOption({
      valueType: ScSpecTypeDef.fromXdrObject(wire.valueType)
    });
  }
}
class ScSpecTypeResult extends xdr_value/* XdrValue */.SD {
  okType;
  errorType;
  static schema = (0,js_xdr/* struct */.w3)(
    "ScSpecTypeResult",
    {
      okType: (0,js_xdr/* lazy */.RZ)(() => ScSpecTypeDef.schema),
      errorType: (0,js_xdr/* lazy */.RZ)(() => ScSpecTypeDef.schema)
    }
  );
  constructor(input) {
    super();
    this.okType = input.okType;
    this.errorType = input.errorType;
  }
  toXdrObject() {
    return {
      okType: this.okType.toXdrObject(),
      errorType: this.errorType.toXdrObject()
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecTypeResult({
      okType: ScSpecTypeDef.fromXdrObject(wire.okType),
      errorType: ScSpecTypeDef.fromXdrObject(wire.errorType)
    });
  }
}
class ScSpecTypeTuple extends xdr_value/* XdrValue */.SD {
  valueTypes;
  static schema = (0,js_xdr/* struct */.w3)(
    "ScSpecTypeTuple",
    {
      valueTypes: (0,js_xdr/* array */.YO)(
        (0,js_xdr/* lazy */.RZ)(() => ScSpecTypeDef.schema),
        12
      )
    }
  );
  constructor(input) {
    super();
    this.valueTypes = input.valueTypes;
  }
  toXdrObject() {
    return {
      valueTypes: this.valueTypes.map((v) => v.toXdrObject())
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecTypeTuple({
      valueTypes: wire.valueTypes.map((w) => ScSpecTypeDef.fromXdrObject(w))
    });
  }
}
class ScSpecTypeVec extends xdr_value/* XdrValue */.SD {
  elementType;
  static schema = (0,js_xdr/* struct */.w3)("ScSpecTypeVec", {
    elementType: (0,js_xdr/* lazy */.RZ)(() => ScSpecTypeDef.schema)
  });
  constructor(input) {
    super();
    this.elementType = input.elementType;
  }
  toXdrObject() {
    return {
      elementType: this.elementType.toXdrObject()
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecTypeVec({
      elementType: ScSpecTypeDef.fromXdrObject(wire.elementType)
    });
  }
}


//# sourceMappingURL=sc-spec-type-def.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-function-input-v0.js





class ScSpecFunctionInputV0 extends xdr_value/* XdrValue */.SD {
  doc;
  name;
  type;
  static schema = (0,js_xdr/* struct */.w3)(
    "ScSpecFunctionInputV0",
    {
      doc: (0,xdr_string/* xdrString */.G)(1024),
      name: (0,xdr_string/* xdrString */.G)(30),
      type: ScSpecTypeDef.schema
    }
  );
  constructor(input) {
    super();
    this.doc = input.doc instanceof xdr_string/* XdrString */.u ? input.doc : new xdr_string/* XdrString */.u(input.doc);
    this.name = input.name instanceof xdr_string/* XdrString */.u ? input.name : new xdr_string/* XdrString */.u(input.name);
    this.type = input.type;
  }
  toXdrObject() {
    return {
      doc: this.doc,
      name: this.name,
      type: this.type.toXdrObject()
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecFunctionInputV0({
      doc: wire.doc,
      name: wire.name,
      type: ScSpecTypeDef.fromXdrObject(wire.type)
    });
  }
}


//# sourceMappingURL=sc-spec-function-input-v0.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-function-v0.js






class ScSpecFunctionV0 extends xdr_value/* XdrValue */.SD {
  doc;
  name;
  inputs;
  outputs;
  static schema = (0,js_xdr/* struct */.w3)(
    "ScSpecFunctionV0",
    {
      doc: (0,xdr_string/* xdrString */.G)(1024),
      name: (0,xdr_string/* xdrString */.G)(32),
      inputs: (0,js_xdr/* array */.YO)(ScSpecFunctionInputV0.schema, js_xdr/* UNBOUNDED_MAX_LENGTH */.dp),
      outputs: (0,js_xdr/* array */.YO)(ScSpecTypeDef.schema, 1)
    }
  );
  constructor(input) {
    super();
    this.doc = input.doc instanceof xdr_string/* XdrString */.u ? input.doc : new xdr_string/* XdrString */.u(input.doc);
    this.name = input.name instanceof xdr_string/* XdrString */.u ? input.name : new xdr_string/* XdrString */.u(input.name);
    this.inputs = input.inputs;
    this.outputs = input.outputs;
  }
  toXdrObject() {
    return {
      doc: this.doc,
      name: this.name,
      inputs: this.inputs.map((v) => v.toXdrObject()),
      outputs: this.outputs.map((v) => v.toXdrObject())
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecFunctionV0({
      doc: wire.doc,
      name: wire.name,
      inputs: wire.inputs.map((w) => ScSpecFunctionInputV0.fromXdrObject(w)),
      outputs: wire.outputs.map((w) => ScSpecTypeDef.fromXdrObject(w))
    });
  }
}


//# sourceMappingURL=sc-spec-function-v0.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-udt-struct-field-v0.js





class ScSpecUdtStructFieldV0 extends xdr_value/* XdrValue */.SD {
  doc;
  name;
  type;
  static schema = (0,js_xdr/* struct */.w3)(
    "ScSpecUdtStructFieldV0",
    {
      doc: (0,xdr_string/* xdrString */.G)(1024),
      name: (0,xdr_string/* xdrString */.G)(30),
      type: ScSpecTypeDef.schema
    }
  );
  constructor(input) {
    super();
    this.doc = input.doc instanceof xdr_string/* XdrString */.u ? input.doc : new xdr_string/* XdrString */.u(input.doc);
    this.name = input.name instanceof xdr_string/* XdrString */.u ? input.name : new xdr_string/* XdrString */.u(input.name);
    this.type = input.type;
  }
  toXdrObject() {
    return {
      doc: this.doc,
      name: this.name,
      type: this.type.toXdrObject()
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecUdtStructFieldV0({
      doc: wire.doc,
      name: wire.name,
      type: ScSpecTypeDef.fromXdrObject(wire.type)
    });
  }
}


//# sourceMappingURL=sc-spec-udt-struct-field-v0.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-udt-struct-v0.js





class ScSpecUdtStructV0 extends xdr_value/* XdrValue */.SD {
  doc;
  lib;
  name;
  fields;
  static schema = (0,js_xdr/* struct */.w3)(
    "ScSpecUdtStructV0",
    {
      doc: (0,xdr_string/* xdrString */.G)(1024),
      lib: (0,xdr_string/* xdrString */.G)(80),
      name: (0,xdr_string/* xdrString */.G)(60),
      fields: (0,js_xdr/* array */.YO)(ScSpecUdtStructFieldV0.schema, js_xdr/* UNBOUNDED_MAX_LENGTH */.dp)
    }
  );
  constructor(input) {
    super();
    this.doc = input.doc instanceof xdr_string/* XdrString */.u ? input.doc : new xdr_string/* XdrString */.u(input.doc);
    this.lib = input.lib instanceof xdr_string/* XdrString */.u ? input.lib : new xdr_string/* XdrString */.u(input.lib);
    this.name = input.name instanceof xdr_string/* XdrString */.u ? input.name : new xdr_string/* XdrString */.u(input.name);
    this.fields = input.fields;
  }
  toXdrObject() {
    return {
      doc: this.doc,
      lib: this.lib,
      name: this.name,
      fields: this.fields.map((v) => v.toXdrObject())
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecUdtStructV0({
      doc: wire.doc,
      lib: wire.lib,
      name: wire.name,
      fields: wire.fields.map((w) => ScSpecUdtStructFieldV0.fromXdrObject(w))
    });
  }
}


//# sourceMappingURL=sc-spec-udt-struct-v0.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-udt-union-case-v0-kind.js



class ScSpecUdtUnionCaseV0Kind extends enum_value/* EnumValue */.RS {
  static scSpecUdtUnionCaseVoidV0 = new ScSpecUdtUnionCaseV0Kind(
    "scSpecUdtUnionCaseVoidV0",
    0
  );
  static scSpecUdtUnionCaseTupleV0 = new ScSpecUdtUnionCaseV0Kind(
    "scSpecUdtUnionCaseTupleV0",
    1
  );
  static schema = (0,enum_value/* withMemberPrefix */.P8)(
    (0,js_xdr/* enumType */.QT)("ScSpecUdtUnionCaseV0Kind", {
      scSpecUdtUnionCaseVoidV0: 0,
      scSpecUdtUnionCaseTupleV0: 1
    }),
    "scSpecUdtUnionCase"
  );
  static fromValue(value) {
    return (0,enum_value/* enumFromValue */.t4)(
      "ScSpecUdtUnionCaseV0Kind",
      ScSpecUdtUnionCaseV0Kind.schema,
      ScSpecUdtUnionCaseV0Kind,
      value
    );
  }
  static fromName(name) {
    return (0,enum_value/* enumFromName */.$2)(
      "ScSpecUdtUnionCaseV0Kind",
      ScSpecUdtUnionCaseV0Kind,
      name
    );
  }
  static fromXdrObject(wire) {
    return ScSpecUdtUnionCaseV0Kind.fromValue(wire);
  }
}


//# sourceMappingURL=sc-spec-udt-union-case-v0-kind.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-udt-union-case-void-v0.js




class ScSpecUdtUnionCaseVoidV0 extends xdr_value/* XdrValue */.SD {
  doc;
  name;
  static schema = (0,js_xdr/* struct */.w3)(
    "ScSpecUdtUnionCaseVoidV0",
    {
      doc: (0,xdr_string/* xdrString */.G)(1024),
      name: (0,xdr_string/* xdrString */.G)(60)
    }
  );
  constructor(input) {
    super();
    this.doc = input.doc instanceof xdr_string/* XdrString */.u ? input.doc : new xdr_string/* XdrString */.u(input.doc);
    this.name = input.name instanceof xdr_string/* XdrString */.u ? input.name : new xdr_string/* XdrString */.u(input.name);
  }
  toXdrObject() {
    return {
      doc: this.doc,
      name: this.name
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecUdtUnionCaseVoidV0({
      doc: wire.doc,
      name: wire.name
    });
  }
}


//# sourceMappingURL=sc-spec-udt-union-case-void-v0.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-udt-union-case-tuple-v0.js





class ScSpecUdtUnionCaseTupleV0 extends xdr_value/* XdrValue */.SD {
  doc;
  name;
  type;
  static schema = (0,js_xdr/* struct */.w3)(
    "ScSpecUdtUnionCaseTupleV0",
    {
      doc: (0,xdr_string/* xdrString */.G)(1024),
      name: (0,xdr_string/* xdrString */.G)(60),
      type: (0,js_xdr/* array */.YO)(ScSpecTypeDef.schema, js_xdr/* UNBOUNDED_MAX_LENGTH */.dp)
    }
  );
  constructor(input) {
    super();
    this.doc = input.doc instanceof xdr_string/* XdrString */.u ? input.doc : new xdr_string/* XdrString */.u(input.doc);
    this.name = input.name instanceof xdr_string/* XdrString */.u ? input.name : new xdr_string/* XdrString */.u(input.name);
    this.type = input.type;
  }
  toXdrObject() {
    return {
      doc: this.doc,
      name: this.name,
      type: this.type.map((v) => v.toXdrObject())
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecUdtUnionCaseTupleV0({
      doc: wire.doc,
      name: wire.name,
      type: wire.type.map((w) => ScSpecTypeDef.fromXdrObject(w))
    });
  }
}


//# sourceMappingURL=sc-spec-udt-union-case-tuple-v0.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-udt-union-case-v0.js






class ScSpecUdtUnionCaseV0Base extends xdr_value/* XdrValue */.SD {
  constructor() {
    super();
    if (new.target === ScSpecUdtUnionCaseV0Base) {
      throw new TypeError(
        "new xdr.ScSpecUdtUnionCaseV0(...) is not supported: XDR unions are built from per-variant factories. Call xdr.ScSpecUdtUnionCaseV0.scSpecUdtUnionCaseVoidV0(...) (or another arm factory) instead."
      );
    }
  }
  static schema = (0,js_xdr/* union */.KC)(
    "ScSpecUdtUnionCaseV0",
    {
      switchOn: ScSpecUdtUnionCaseV0Kind.schema,
      cases: [
        (0,js_xdr/* case */.DH)(
          "scSpecUdtUnionCaseVoidV0",
          0,
          (0,js_xdr/* field */.ZZ)("voidCase", ScSpecUdtUnionCaseVoidV0.schema)
        ),
        (0,js_xdr/* case */.DH)(
          "scSpecUdtUnionCaseTupleV0",
          1,
          (0,js_xdr/* field */.ZZ)("tupleCase", ScSpecUdtUnionCaseTupleV0.schema)
        )
      ],
      switchKey: "kind"
    }
  );
  static scSpecUdtUnionCaseVoidV0(voidCase) {
    return new ScSpecUdtUnionCaseV0VoidV0(voidCase);
  }
  static scSpecUdtUnionCaseTupleV0(tupleCase) {
    return new ScSpecUdtUnionCaseV0TupleV0(tupleCase);
  }
  static fromXdrObject(wire) {
    switch (wire.kind) {
      case 0:
        return new ScSpecUdtUnionCaseV0VoidV0(
          ScSpecUdtUnionCaseVoidV0.fromXdrObject(wire.voidCase)
        );
      case 1:
        return new ScSpecUdtUnionCaseV0TupleV0(
          ScSpecUdtUnionCaseTupleV0.fromXdrObject(wire.tupleCase)
        );
    }
    throw new js_xdr/* XdrError */.zj(
      `ScSpecUdtUnionCaseV0: unknown kind ${wire.kind}`
    );
  }
  /**
   * Type guard narrowing an unknown value to a concrete ScSpecUdtUnionCaseV0 variant.
   * Use this instead of `instanceof ScSpecUdtUnionCaseV0`: the exported `ScSpecUdtUnionCaseV0` value
   * is the abstract base, so `instanceof` narrows to the base (not the
   * variant union) and forces a cast. `ScSpecUdtUnionCaseV0.is(x)` narrows to the union.
   */
  static is(value) {
    return value instanceof ScSpecUdtUnionCaseV0Base;
  }
}
class ScSpecUdtUnionCaseV0VoidV0 extends ScSpecUdtUnionCaseV0Base {
  type = "scSpecUdtUnionCaseVoidV0";
  voidCase;
  constructor(voidCase) {
    super();
    this.voidCase = voidCase;
  }
  get value() {
    return this.voidCase;
  }
  toXdrObject() {
    return { kind: 0, voidCase: this.voidCase.toXdrObject() };
  }
}
class ScSpecUdtUnionCaseV0TupleV0 extends ScSpecUdtUnionCaseV0Base {
  type = "scSpecUdtUnionCaseTupleV0";
  tupleCase;
  constructor(tupleCase) {
    super();
    this.tupleCase = tupleCase;
  }
  get value() {
    return this.tupleCase;
  }
  toXdrObject() {
    return { kind: 1, tupleCase: this.tupleCase.toXdrObject() };
  }
}
const ScSpecUdtUnionCaseV0 = ScSpecUdtUnionCaseV0Base;


//# sourceMappingURL=sc-spec-udt-union-case-v0.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-udt-union-v0.js





class ScSpecUdtUnionV0 extends xdr_value/* XdrValue */.SD {
  doc;
  lib;
  name;
  cases;
  static schema = (0,js_xdr/* struct */.w3)(
    "ScSpecUdtUnionV0",
    {
      doc: (0,xdr_string/* xdrString */.G)(1024),
      lib: (0,xdr_string/* xdrString */.G)(80),
      name: (0,xdr_string/* xdrString */.G)(60),
      cases: (0,js_xdr/* array */.YO)(ScSpecUdtUnionCaseV0.schema, js_xdr/* UNBOUNDED_MAX_LENGTH */.dp)
    }
  );
  constructor(input) {
    super();
    this.doc = input.doc instanceof xdr_string/* XdrString */.u ? input.doc : new xdr_string/* XdrString */.u(input.doc);
    this.lib = input.lib instanceof xdr_string/* XdrString */.u ? input.lib : new xdr_string/* XdrString */.u(input.lib);
    this.name = input.name instanceof xdr_string/* XdrString */.u ? input.name : new xdr_string/* XdrString */.u(input.name);
    this.cases = input.cases;
  }
  toXdrObject() {
    return {
      doc: this.doc,
      lib: this.lib,
      name: this.name,
      cases: this.cases.map((v) => v.toXdrObject())
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecUdtUnionV0({
      doc: wire.doc,
      lib: wire.lib,
      name: wire.name,
      cases: wire.cases.map((w) => ScSpecUdtUnionCaseV0.fromXdrObject(w))
    });
  }
}


//# sourceMappingURL=sc-spec-udt-union-v0.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-udt-enum-case-v0.js




class ScSpecUdtEnumCaseV0 extends xdr_value/* XdrValue */.SD {
  doc;
  name;
  value;
  static schema = (0,js_xdr/* struct */.w3)(
    "ScSpecUdtEnumCaseV0",
    {
      doc: (0,xdr_string/* xdrString */.G)(1024),
      name: (0,xdr_string/* xdrString */.G)(60),
      value: (0,js_xdr/* uint32 */.S8)()
    }
  );
  constructor(input) {
    super();
    this.doc = input.doc instanceof xdr_string/* XdrString */.u ? input.doc : new xdr_string/* XdrString */.u(input.doc);
    this.name = input.name instanceof xdr_string/* XdrString */.u ? input.name : new xdr_string/* XdrString */.u(input.name);
    this.value = input.value;
  }
  toXdrObject() {
    return {
      doc: this.doc,
      name: this.name,
      value: this.value
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecUdtEnumCaseV0({
      doc: wire.doc,
      name: wire.name,
      value: wire.value
    });
  }
}


//# sourceMappingURL=sc-spec-udt-enum-case-v0.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-udt-enum-v0.js





class ScSpecUdtEnumV0 extends xdr_value/* XdrValue */.SD {
  doc;
  lib;
  name;
  cases;
  static schema = (0,js_xdr/* struct */.w3)(
    "ScSpecUdtEnumV0",
    {
      doc: (0,xdr_string/* xdrString */.G)(1024),
      lib: (0,xdr_string/* xdrString */.G)(80),
      name: (0,xdr_string/* xdrString */.G)(60),
      cases: (0,js_xdr/* array */.YO)(ScSpecUdtEnumCaseV0.schema, js_xdr/* UNBOUNDED_MAX_LENGTH */.dp)
    }
  );
  constructor(input) {
    super();
    this.doc = input.doc instanceof xdr_string/* XdrString */.u ? input.doc : new xdr_string/* XdrString */.u(input.doc);
    this.lib = input.lib instanceof xdr_string/* XdrString */.u ? input.lib : new xdr_string/* XdrString */.u(input.lib);
    this.name = input.name instanceof xdr_string/* XdrString */.u ? input.name : new xdr_string/* XdrString */.u(input.name);
    this.cases = input.cases;
  }
  toXdrObject() {
    return {
      doc: this.doc,
      lib: this.lib,
      name: this.name,
      cases: this.cases.map((v) => v.toXdrObject())
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecUdtEnumV0({
      doc: wire.doc,
      lib: wire.lib,
      name: wire.name,
      cases: wire.cases.map((w) => ScSpecUdtEnumCaseV0.fromXdrObject(w))
    });
  }
}


//# sourceMappingURL=sc-spec-udt-enum-v0.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-udt-error-enum-case-v0.js




class ScSpecUdtErrorEnumCaseV0 extends xdr_value/* XdrValue */.SD {
  doc;
  name;
  value;
  static schema = (0,js_xdr/* struct */.w3)(
    "ScSpecUdtErrorEnumCaseV0",
    {
      doc: (0,xdr_string/* xdrString */.G)(1024),
      name: (0,xdr_string/* xdrString */.G)(60),
      value: (0,js_xdr/* uint32 */.S8)()
    }
  );
  constructor(input) {
    super();
    this.doc = input.doc instanceof xdr_string/* XdrString */.u ? input.doc : new xdr_string/* XdrString */.u(input.doc);
    this.name = input.name instanceof xdr_string/* XdrString */.u ? input.name : new xdr_string/* XdrString */.u(input.name);
    this.value = input.value;
  }
  toXdrObject() {
    return {
      doc: this.doc,
      name: this.name,
      value: this.value
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecUdtErrorEnumCaseV0({
      doc: wire.doc,
      name: wire.name,
      value: wire.value
    });
  }
}


//# sourceMappingURL=sc-spec-udt-error-enum-case-v0.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-udt-error-enum-v0.js





class ScSpecUdtErrorEnumV0 extends xdr_value/* XdrValue */.SD {
  doc;
  lib;
  name;
  cases;
  static schema = (0,js_xdr/* struct */.w3)(
    "ScSpecUdtErrorEnumV0",
    {
      doc: (0,xdr_string/* xdrString */.G)(1024),
      lib: (0,xdr_string/* xdrString */.G)(80),
      name: (0,xdr_string/* xdrString */.G)(60),
      cases: (0,js_xdr/* array */.YO)(ScSpecUdtErrorEnumCaseV0.schema, js_xdr/* UNBOUNDED_MAX_LENGTH */.dp)
    }
  );
  constructor(input) {
    super();
    this.doc = input.doc instanceof xdr_string/* XdrString */.u ? input.doc : new xdr_string/* XdrString */.u(input.doc);
    this.lib = input.lib instanceof xdr_string/* XdrString */.u ? input.lib : new xdr_string/* XdrString */.u(input.lib);
    this.name = input.name instanceof xdr_string/* XdrString */.u ? input.name : new xdr_string/* XdrString */.u(input.name);
    this.cases = input.cases;
  }
  toXdrObject() {
    return {
      doc: this.doc,
      lib: this.lib,
      name: this.name,
      cases: this.cases.map((v) => v.toXdrObject())
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecUdtErrorEnumV0({
      doc: wire.doc,
      lib: wire.lib,
      name: wire.name,
      cases: wire.cases.map((w) => ScSpecUdtErrorEnumCaseV0.fromXdrObject(w))
    });
  }
}


//# sourceMappingURL=sc-spec-udt-error-enum-v0.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-event-param-location-v0.js



class ScSpecEventParamLocationV0 extends enum_value/* EnumValue */.RS {
  static scSpecEventParamLocationData = new ScSpecEventParamLocationV0(
    "scSpecEventParamLocationData",
    0
  );
  static scSpecEventParamLocationTopicList = new ScSpecEventParamLocationV0("scSpecEventParamLocationTopicList", 1);
  static schema = (0,enum_value/* withMemberPrefix */.P8)(
    (0,js_xdr/* enumType */.QT)("ScSpecEventParamLocationV0", {
      scSpecEventParamLocationData: 0,
      scSpecEventParamLocationTopicList: 1
    }),
    "scSpecEventParamLocation"
  );
  static fromValue(value) {
    return (0,enum_value/* enumFromValue */.t4)(
      "ScSpecEventParamLocationV0",
      ScSpecEventParamLocationV0.schema,
      ScSpecEventParamLocationV0,
      value
    );
  }
  static fromName(name) {
    return (0,enum_value/* enumFromName */.$2)(
      "ScSpecEventParamLocationV0",
      ScSpecEventParamLocationV0,
      name
    );
  }
  static fromXdrObject(wire) {
    return ScSpecEventParamLocationV0.fromValue(wire);
  }
}


//# sourceMappingURL=sc-spec-event-param-location-v0.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-event-param-v0.js






class ScSpecEventParamV0 extends xdr_value/* XdrValue */.SD {
  doc;
  name;
  type;
  location;
  static schema = (0,js_xdr/* struct */.w3)(
    "ScSpecEventParamV0",
    {
      doc: (0,xdr_string/* xdrString */.G)(1024),
      name: (0,xdr_string/* xdrString */.G)(30),
      type: ScSpecTypeDef.schema,
      location: ScSpecEventParamLocationV0.schema
    }
  );
  constructor(input) {
    super();
    this.doc = input.doc instanceof xdr_string/* XdrString */.u ? input.doc : new xdr_string/* XdrString */.u(input.doc);
    this.name = input.name instanceof xdr_string/* XdrString */.u ? input.name : new xdr_string/* XdrString */.u(input.name);
    this.type = input.type;
    this.location = input.location;
  }
  toXdrObject() {
    return {
      doc: this.doc,
      name: this.name,
      type: this.type.toXdrObject(),
      location: this.location.toXdrObject()
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecEventParamV0({
      doc: wire.doc,
      name: wire.name,
      type: ScSpecTypeDef.fromXdrObject(wire.type),
      location: ScSpecEventParamLocationV0.fromXdrObject(wire.location)
    });
  }
}


//# sourceMappingURL=sc-spec-event-param-v0.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-event-data-format.js



class ScSpecEventDataFormat extends enum_value/* EnumValue */.RS {
  static scSpecEventDataFormatSingleValue = new ScSpecEventDataFormat(
    "scSpecEventDataFormatSingleValue",
    0
  );
  static scSpecEventDataFormatVec = new ScSpecEventDataFormat(
    "scSpecEventDataFormatVec",
    1
  );
  static scSpecEventDataFormatMap = new ScSpecEventDataFormat(
    "scSpecEventDataFormatMap",
    2
  );
  static schema = (0,enum_value/* withMemberPrefix */.P8)(
    (0,js_xdr/* enumType */.QT)("ScSpecEventDataFormat", {
      scSpecEventDataFormatSingleValue: 0,
      scSpecEventDataFormatVec: 1,
      scSpecEventDataFormatMap: 2
    }),
    "scSpecEventDataFormat"
  );
  static fromValue(value) {
    return (0,enum_value/* enumFromValue */.t4)(
      "ScSpecEventDataFormat",
      ScSpecEventDataFormat.schema,
      ScSpecEventDataFormat,
      value
    );
  }
  static fromName(name) {
    return (0,enum_value/* enumFromName */.$2)("ScSpecEventDataFormat", ScSpecEventDataFormat, name);
  }
  static fromXdrObject(wire) {
    return ScSpecEventDataFormat.fromValue(wire);
  }
}


//# sourceMappingURL=sc-spec-event-data-format.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-event-v0.js






class ScSpecEventV0 extends xdr_value/* XdrValue */.SD {
  doc;
  lib;
  name;
  prefixTopics;
  params;
  dataFormat;
  static schema = (0,js_xdr/* struct */.w3)("ScSpecEventV0", {
    doc: (0,xdr_string/* xdrString */.G)(1024),
    lib: (0,xdr_string/* xdrString */.G)(80),
    name: (0,xdr_string/* xdrString */.G)(32),
    prefixTopics: (0,js_xdr/* array */.YO)((0,xdr_string/* xdrString */.G)(32), 2),
    params: (0,js_xdr/* array */.YO)(ScSpecEventParamV0.schema, js_xdr/* UNBOUNDED_MAX_LENGTH */.dp),
    dataFormat: ScSpecEventDataFormat.schema
  });
  constructor(input) {
    super();
    this.doc = input.doc instanceof xdr_string/* XdrString */.u ? input.doc : new xdr_string/* XdrString */.u(input.doc);
    this.lib = input.lib instanceof xdr_string/* XdrString */.u ? input.lib : new xdr_string/* XdrString */.u(input.lib);
    this.name = input.name instanceof xdr_string/* XdrString */.u ? input.name : new xdr_string/* XdrString */.u(input.name);
    this.prefixTopics = input.prefixTopics.map(
      (v) => v instanceof xdr_string/* XdrString */.u ? v : new xdr_string/* XdrString */.u(v)
    );
    this.params = input.params;
    this.dataFormat = input.dataFormat;
  }
  toXdrObject() {
    return {
      doc: this.doc,
      lib: this.lib,
      name: this.name,
      prefixTopics: this.prefixTopics,
      params: this.params.map((v) => v.toXdrObject()),
      dataFormat: this.dataFormat.toXdrObject()
    };
  }
  static fromXdrObject(wire) {
    return new ScSpecEventV0({
      doc: wire.doc,
      lib: wire.lib,
      name: wire.name,
      prefixTopics: wire.prefixTopics,
      params: wire.params.map((w) => ScSpecEventParamV0.fromXdrObject(w)),
      dataFormat: ScSpecEventDataFormat.fromXdrObject(wire.dataFormat)
    });
  }
}


//# sourceMappingURL=sc-spec-event-v0.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-spec-entry.js










class ScSpecEntryBase extends xdr_value/* XdrValue */.SD {
  constructor() {
    super();
    if (new.target === ScSpecEntryBase) {
      throw new TypeError(
        "new xdr.ScSpecEntry(...) is not supported: XDR unions are built from per-variant factories. Call xdr.ScSpecEntry.scSpecEntryFunctionV0(...) (or another arm factory) instead."
      );
    }
  }
  static schema = (0,js_xdr/* union */.KC)("ScSpecEntry", {
    switchOn: ScSpecEntryKind.schema,
    cases: [
      (0,js_xdr/* case */.DH)(
        "scSpecEntryFunctionV0",
        0,
        (0,js_xdr/* field */.ZZ)("functionV0", ScSpecFunctionV0.schema)
      ),
      (0,js_xdr/* case */.DH)(
        "scSpecEntryUdtStructV0",
        1,
        (0,js_xdr/* field */.ZZ)("udtStructV0", ScSpecUdtStructV0.schema)
      ),
      (0,js_xdr/* case */.DH)(
        "scSpecEntryUdtUnionV0",
        2,
        (0,js_xdr/* field */.ZZ)("udtUnionV0", ScSpecUdtUnionV0.schema)
      ),
      (0,js_xdr/* case */.DH)(
        "scSpecEntryUdtEnumV0",
        3,
        (0,js_xdr/* field */.ZZ)("udtEnumV0", ScSpecUdtEnumV0.schema)
      ),
      (0,js_xdr/* case */.DH)(
        "scSpecEntryUdtErrorEnumV0",
        4,
        (0,js_xdr/* field */.ZZ)("udtErrorEnumV0", ScSpecUdtErrorEnumV0.schema)
      ),
      (0,js_xdr/* case */.DH)("scSpecEntryEventV0", 5, (0,js_xdr/* field */.ZZ)("eventV0", ScSpecEventV0.schema))
    ],
    switchKey: "kind"
  });
  static scSpecEntryFunctionV0(functionV0) {
    return new ScSpecEntryFunctionV0(functionV0);
  }
  static scSpecEntryUdtStructV0(udtStructV0) {
    return new ScSpecEntryUdtStructV0(udtStructV0);
  }
  static scSpecEntryUdtUnionV0(udtUnionV0) {
    return new ScSpecEntryUdtUnionV0(udtUnionV0);
  }
  static scSpecEntryUdtEnumV0(udtEnumV0) {
    return new ScSpecEntryUdtEnumV0(udtEnumV0);
  }
  static scSpecEntryUdtErrorEnumV0(udtErrorEnumV0) {
    return new ScSpecEntryUdtErrorEnumV0(udtErrorEnumV0);
  }
  static scSpecEntryEventV0(eventV0) {
    return new ScSpecEntryEventV0(eventV0);
  }
  static fromXdrObject(wire) {
    switch (wire.kind) {
      case 0:
        return new ScSpecEntryFunctionV0(
          ScSpecFunctionV0.fromXdrObject(wire.functionV0)
        );
      case 1:
        return new ScSpecEntryUdtStructV0(
          ScSpecUdtStructV0.fromXdrObject(wire.udtStructV0)
        );
      case 2:
        return new ScSpecEntryUdtUnionV0(
          ScSpecUdtUnionV0.fromXdrObject(wire.udtUnionV0)
        );
      case 3:
        return new ScSpecEntryUdtEnumV0(
          ScSpecUdtEnumV0.fromXdrObject(wire.udtEnumV0)
        );
      case 4:
        return new ScSpecEntryUdtErrorEnumV0(
          ScSpecUdtErrorEnumV0.fromXdrObject(wire.udtErrorEnumV0)
        );
      case 5:
        return new ScSpecEntryEventV0(
          ScSpecEventV0.fromXdrObject(wire.eventV0)
        );
    }
    throw new js_xdr/* XdrError */.zj(
      `ScSpecEntry: unknown kind ${wire.kind}`
    );
  }
  /**
   * Type guard narrowing an unknown value to a concrete ScSpecEntry variant.
   * Use this instead of `instanceof ScSpecEntry`: the exported `ScSpecEntry` value
   * is the abstract base, so `instanceof` narrows to the base (not the
   * variant union) and forces a cast. `ScSpecEntry.is(x)` narrows to the union.
   */
  static is(value) {
    return value instanceof ScSpecEntryBase;
  }
}
class ScSpecEntryFunctionV0 extends ScSpecEntryBase {
  type = "scSpecEntryFunctionV0";
  functionV0;
  constructor(functionV0) {
    super();
    this.functionV0 = functionV0;
  }
  get value() {
    return this.functionV0;
  }
  toXdrObject() {
    return { kind: 0, functionV0: this.functionV0.toXdrObject() };
  }
}
class ScSpecEntryUdtStructV0 extends ScSpecEntryBase {
  type = "scSpecEntryUdtStructV0";
  udtStructV0;
  constructor(udtStructV0) {
    super();
    this.udtStructV0 = udtStructV0;
  }
  get value() {
    return this.udtStructV0;
  }
  toXdrObject() {
    return { kind: 1, udtStructV0: this.udtStructV0.toXdrObject() };
  }
}
class ScSpecEntryUdtUnionV0 extends ScSpecEntryBase {
  type = "scSpecEntryUdtUnionV0";
  udtUnionV0;
  constructor(udtUnionV0) {
    super();
    this.udtUnionV0 = udtUnionV0;
  }
  get value() {
    return this.udtUnionV0;
  }
  toXdrObject() {
    return { kind: 2, udtUnionV0: this.udtUnionV0.toXdrObject() };
  }
}
class ScSpecEntryUdtEnumV0 extends ScSpecEntryBase {
  type = "scSpecEntryUdtEnumV0";
  udtEnumV0;
  constructor(udtEnumV0) {
    super();
    this.udtEnumV0 = udtEnumV0;
  }
  get value() {
    return this.udtEnumV0;
  }
  toXdrObject() {
    return { kind: 3, udtEnumV0: this.udtEnumV0.toXdrObject() };
  }
}
class ScSpecEntryUdtErrorEnumV0 extends ScSpecEntryBase {
  type = "scSpecEntryUdtErrorEnumV0";
  udtErrorEnumV0;
  constructor(udtErrorEnumV0) {
    super();
    this.udtErrorEnumV0 = udtErrorEnumV0;
  }
  get value() {
    return this.udtErrorEnumV0;
  }
  toXdrObject() {
    return { kind: 4, udtErrorEnumV0: this.udtErrorEnumV0.toXdrObject() };
  }
}
class ScSpecEntryEventV0 extends ScSpecEntryBase {
  type = "scSpecEntryEventV0";
  eventV0;
  constructor(eventV0) {
    super();
    this.eventV0 = eventV0;
  }
  get value() {
    return this.eventV0;
  }
  toXdrObject() {
    return { kind: 5, eventV0: this.eventV0.toXdrObject() };
  }
}
const ScSpecEntry = ScSpecEntryBase;


//# sourceMappingURL=sc-spec-entry.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/contract/utils.js















async function withExponentialBackoff(fn, keepWaitingIf, timeoutInSeconds, exponentialFactor = 1.5, verbose = false) {
  const attempts = [];
  let count = 0;
  attempts.push(await fn());
  if (!keepWaitingIf(attempts[attempts.length - 1])) return attempts;
  const waitUntil = new Date(Date.now() + timeoutInSeconds * 1e3).valueOf();
  let waitTime = 1e3;
  let totalWaitTime = waitTime;
  while (Date.now() < waitUntil && keepWaitingIf(attempts[attempts.length - 1])) {
    count += 1;
    if (verbose) {
      console.info(
        `Waiting ${waitTime}ms before trying again (bringing the total wait time to ${totalWaitTime}ms so far, of total ${timeoutInSeconds * 1e3}ms)`
      );
    }
    await new Promise((res) => setTimeout(res, waitTime));
    waitTime *= exponentialFactor;
    if (new Date(Date.now() + waitTime).valueOf() > waitUntil) {
      waitTime = waitUntil - Date.now();
      if (verbose) {
        console.info(`was gonna wait too long; new waitTime: ${waitTime}ms`);
      }
    }
    totalWaitTime = waitTime + totalWaitTime;
    attempts.push(await fn(attempts[attempts.length - 1]));
    if (verbose && keepWaitingIf(attempts[attempts.length - 1])) {
      console.info(
        `${count}. Called ${fn}; ${attempts.length} prev attempts. Most recent: ${JSON.stringify(
          attempts[attempts.length - 1],
          null,
          2
        )}`
      );
    }
  }
  return attempts;
}
const contractErrorPattern = /Error\(Contract, #(\d+)\)/;
function implementsToString(obj) {
  return typeof obj === "object" && obj !== null && "toString" in obj;
}
function parseWasmCustomSections(buffer) {
  const sections = /* @__PURE__ */ new Map();
  let offset = 0;
  const read = (length) => {
    if (offset + length > buffer.byteLength)
      throw new Error("WASM read out of bounds");
    const bytes = buffer.subarray(offset, offset + length);
    offset += length;
    return bytes;
  };
  function readVarUint32() {
    let value = 0;
    let shift = 0;
    while (true) {
      const byte = read(1)[0];
      value |= (byte & 127) << shift;
      if ((byte & 128) === 0) break;
      if ((shift += 7) >= 32) throw new Error("Invalid WASM value");
    }
    return value >>> 0;
  }
  if ([...read(4)].join() !== "0,97,115,109")
    throw new Error("Invalid WASM magic");
  if ([...read(4)].join() !== "1,0,0,0")
    throw new Error("Invalid WASM version");
  while (offset < buffer.byteLength) {
    const sectionId = read(1)[0];
    const sectionLength = readVarUint32();
    const start = offset;
    if (sectionId === 0) {
      const nameLen = readVarUint32();
      if (nameLen > 0 && offset + nameLen <= start + sectionLength) {
        const nameBytes = read(nameLen);
        const payload = read(sectionLength - (offset - start));
        try {
          const name = new TextDecoder("utf-8", { fatal: true }).decode(
            nameBytes
          );
          if (payload.length > 0) {
            sections.set(name, (sections.get(name) || []).concat(payload));
          }
        } catch {
        }
      }
    }
    offset = start + sectionLength;
  }
  return sections;
}
function processSpecEntryStream(buffer) {
  return (0,xdr_value/* decodeStream */.Vn)(ScSpecEntry, buffer);
}
async function getAccount(options, server) {
  return options.publicKey ? server.getAccount(options.publicKey) : new account/* Account */.g(NULL_ACCOUNT, "0");
}


//# sourceMappingURL=utils.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/contract/wasm_spec_parser.js


function specFromWasm(wasm) {
  const customData = parseWasmCustomSections(wasm);
  const xdrSections = customData.get("contractspecv0");
  if (!xdrSections || xdrSections.length === 0) {
    throw new Error("Could not obtain contract spec from wasm");
  }
  return Uint8Array.from(xdrSections[0]);
}


//# sourceMappingURL=wasm_spec_parser.js.map

// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-val.js + 5 modules
var sc_val = __webpack_require__(9679);
;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/contract/event_spec.js





function events(entries) {
  return entries.filter(
    (entry) => entry.type === "scSpecEntryEventV0"
  ).map((entry) => entry.value);
}
function findEvent(entries, name, occurrence = 0) {
  if (!Number.isInteger(occurrence) || occurrence < 0) {
    throw new Error(
      `invalid occurrence for event ${name}: ${occurrence} (expected a non-negative integer)`
    );
  }
  return events(entries).filter((e) => e.name.toString() === name)[occurrence];
}
function topicListParams(event) {
  return event.params.filter(
    (p) => p.location.value === ScSpecEventParamLocationV0.scSpecEventParamLocationTopicList.value
  );
}
function dataParams(event) {
  return event.params.filter(
    (p) => p.location.value === ScSpecEventParamLocationV0.scSpecEventParamLocationData.value
  );
}
function prefixTopicText(topic) {
  switch (topic.type) {
    case "scvSymbol":
    case "scvString":
      return topic.value.toString();
    default:
      return void 0;
  }
}
function matchesTopics(event, topics) {
  const prefixTopics = event.prefixTopics;
  const tlParams = topicListParams(event);
  if (topics.length < prefixTopics.length + tlParams.length) {
    return void 0;
  }
  for (let i = 0; i < prefixTopics.length; i++) {
    if (prefixTopicText(topics[i]) !== prefixTopics[i].toString()) {
      return void 0;
    }
  }
  return tlParams;
}
function parseEvent(spec, entries, topics, data) {
  let topicVals;
  let dataVal;
  try {
    topicVals = topics.map(
      (t) => typeof t === "string" ? sc_val/* ScVal */.wq.fromXdr(t, "base64") : t
    );
    dataVal = typeof data === "string" ? sc_val/* ScVal */.wq.fromXdr(data, "base64") : data;
  } catch {
    return void 0;
  }
  const specEvents = events(entries);
  for (const event of specEvents) {
    const tlParams = matchesTopics(event, topicVals);
    if (!tlParams) {
      continue;
    }
    try {
      const prefixLen = event.prefixTopics.length;
      const dataOut = /* @__PURE__ */ Object.create(null);
      tlParams.forEach((param, i) => {
        const val = topicVals[prefixLen + i];
        dataOut[param.name.toString()] = spec.scValToNative(val, param.type);
      });
      const dParams = dataParams(event);
      const format = event.dataFormat.value;
      if (format === ScSpecEventDataFormat.scSpecEventDataFormatSingleValue.value) {
        const param = dParams[0];
        if (param) {
          dataOut[param.name.toString()] = spec.scValToNative(
            dataVal,
            param.type
          );
        }
      } else if (format === ScSpecEventDataFormat.scSpecEventDataFormatVec.value) {
        const vec = (dataVal.type === "scvVec" ? dataVal.value : null) ?? [];
        if (vec.length < dParams.length) {
          continue;
        }
        dParams.forEach((param, i) => {
          dataOut[param.name.toString()] = spec.scValToNative(
            vec[i],
            param.type
          );
        });
      } else if (format === ScSpecEventDataFormat.scSpecEventDataFormatMap.value) {
        const map = (dataVal.type === "scvMap" ? dataVal.value : null) ?? [];
        dParams.forEach((param) => {
          const name = param.name.toString();
          const entry = map.find(
            (e) => e.key.type === "scvSymbol" && e.key.value.toString() === name
          );
          if (entry) {
            dataOut[name] = spec.scValToNative(entry.val, param.type);
          }
        });
      }
      return {
        name: event.name.toString(),
        data: dataOut
      };
    } catch {
      continue;
    }
  }
  return void 0;
}
function eventTopicFilter(spec, entries, name, topicValues, occurrence = 0) {
  const event = findEvent(entries, name, occurrence);
  if (!event) {
    throw new Error(
      occurrence > 0 ? `no such event: ${name} (occurrence ${occurrence})` : `no such event: ${name}`
    );
  }
  const filter = event.prefixTopics.map(
    (topic) => sc_val/* ScVal */.wq.scvSymbol(topic.toString()).toXdr("base64")
  );
  topicListParams(event).forEach((param) => {
    const paramName = param.name.toString();
    if (topicValues && Object.prototype.hasOwnProperty.call(topicValues, paramName)) {
      const scVal = spec.nativeToScVal(topicValues[paramName], param.type);
      filter.push(scVal.toXdr("base64"));
    } else {
      filter.push("*");
    }
  });
  return filter;
}


//# sourceMappingURL=event_spec.js.map

// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/base/numbers/xdr_large_int.js
var xdr_large_int = __webpack_require__(7738);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/sc-bytes.js
var sc_bytes = __webpack_require__(5756);
;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/contract/spec.js
























function enumToJsonSchema(udt) {
  const description = udt.doc.toString();
  const cases = udt.cases;
  const oneOf = [];
  cases.forEach((aCase) => {
    const title = aCase.name.toString();
    const desc = aCase.doc.toString();
    oneOf.push({
      description: desc,
      title,
      enum: [aCase.value],
      type: "number"
    });
  });
  const res = { oneOf };
  if (description.length > 0) {
    res.description = description;
  }
  return res;
}
function isNumeric(field) {
  return /^\d+$/.test(field.name.toString());
}
function readObj(args, input) {
  const inputName = input.name.toString();
  const entry = Object.entries(args).find(([name]) => name === inputName);
  if (!entry) {
    throw new Error(`Missing field ${inputName}`);
  }
  return entry[1];
}
function findCase(name) {
  return function matches(entry) {
    switch (entry.type) {
      case "scSpecUdtUnionCaseTupleV0": {
        const tuple = entry.value;
        return tuple.name.toString() === name;
      }
      case "scSpecUdtUnionCaseVoidV0": {
        const voidCase = entry.value;
        return voidCase.name.toString() === name;
      }
      default:
        return false;
    }
  };
}
function stringToScVal(str, ty) {
  switch (ty) {
    case "scSpecTypeString":
      return sc_val/* ScVal */.wq.scvString(str);
    case "scSpecTypeSymbol":
      return sc_val/* ScVal */.wq.scvSymbol(str);
    case "scSpecTypeAddress":
    case "scSpecTypeMuxedAddress":
      return base_address/* Address */.p.fromString(str).toScVal();
    case "scSpecTypeU64":
      return new xdr_large_int/* XdrLargeInt */.x("u64", str).toScVal();
    case "scSpecTypeI64":
      return new xdr_large_int/* XdrLargeInt */.x("i64", str).toScVal();
    case "scSpecTypeU128":
      return new xdr_large_int/* XdrLargeInt */.x("u128", str).toScVal();
    case "scSpecTypeI128":
      return new xdr_large_int/* XdrLargeInt */.x("i128", str).toScVal();
    case "scSpecTypeU256":
      return new xdr_large_int/* XdrLargeInt */.x("u256", str).toScVal();
    case "scSpecTypeI256":
      return new xdr_large_int/* XdrLargeInt */.x("i256", str).toScVal();
    case "scSpecTypeBytes":
    case "scSpecTypeBytesN":
      return sc_val/* ScVal */.wq.scvBytes(new sc_bytes/* ScBytes */.W((0,base64/* base64ToUint8Array */.E)(str)));
    case "scSpecTypeTimepoint": {
      return sc_val/* ScVal */.wq.scvTimepoint((0,xdr/* Uint64 */.Rf3)(str));
    }
    case "scSpecTypeDuration": {
      return sc_val/* ScVal */.wq.scvDuration((0,xdr/* Uint64 */.Rf3)(str));
    }
    default:
      throw new TypeError(`invalid type ${ty} specified for string value`);
  }
}
const PRIMITIVE_DEFINITONS = {
  U32: {
    type: "integer",
    minimum: 0,
    maximum: 4294967295
  },
  I32: {
    type: "integer",
    minimum: -2147483648,
    maximum: 2147483647
  },
  U64: {
    type: "string",
    pattern: "^([1-9][0-9]*|0)$",
    minLength: 1,
    maxLength: 20
    // 64-bit max value has 20 digits
  },
  Timepoint: {
    type: "string",
    pattern: "^([1-9][0-9]*|0)$",
    minLength: 1,
    maxLength: 20
    // 64-bit max value has 20 digits
  },
  Duration: {
    type: "string",
    pattern: "^([1-9][0-9]*|0)$",
    minLength: 1,
    maxLength: 20
    // 64-bit max value has 20 digits
  },
  I64: {
    type: "string",
    pattern: "^(-?[1-9][0-9]*|0)$",
    minLength: 1,
    maxLength: 21
    // Includes additional digit for the potential '-'
  },
  U128: {
    type: "string",
    pattern: "^([1-9][0-9]*|0)$",
    minLength: 1,
    maxLength: 39
    // 128-bit max value has 39 digits
  },
  I128: {
    type: "string",
    pattern: "^(-?[1-9][0-9]*|0)$",
    minLength: 1,
    maxLength: 40
    // Includes additional digit for the potential '-'
  },
  U256: {
    type: "string",
    pattern: "^([1-9][0-9]*|0)$",
    minLength: 1,
    maxLength: 78
    // 256-bit max value has 78 digits
  },
  I256: {
    type: "string",
    pattern: "^(-?[1-9][0-9]*|0)$",
    minLength: 1,
    maxLength: 79
    // Includes additional digit for the potential '-'
  },
  Address: {
    type: "string",
    format: "address",
    description: "Address can be a public key or contract id"
  },
  MuxedAddress: {
    type: "string",
    format: "address",
    description: "Stellar public key with M prefix combining a G address and unique ID"
  },
  ScString: {
    type: "string",
    description: "ScString is a string"
  },
  ScSymbol: {
    type: "string",
    description: "ScSymbol is a string"
  },
  DataUrl: {
    type: "string",
    pattern: "^(?:[A-Za-z0-9+\\/]{4})*(?:[A-Za-z0-9+\\/]{2}==|[A-Za-z0-9+\\/]{3}=)?$"
  }
};
function typeRef(typeDef) {
  let ref;
  switch (typeDef.type) {
    case "scSpecTypeVal": {
      ref = "Val";
      break;
    }
    case "scSpecTypeBool": {
      return { type: "boolean" };
    }
    case "scSpecTypeVoid": {
      return { type: "null" };
    }
    case "scSpecTypeError": {
      ref = "Error";
      break;
    }
    case "scSpecTypeU32": {
      ref = "U32";
      break;
    }
    case "scSpecTypeI32": {
      ref = "I32";
      break;
    }
    case "scSpecTypeU64": {
      ref = "U64";
      break;
    }
    case "scSpecTypeI64": {
      ref = "I64";
      break;
    }
    case "scSpecTypeTimepoint": {
      ref = "Timepoint";
      break;
    }
    case "scSpecTypeDuration": {
      ref = "Duration";
      break;
    }
    case "scSpecTypeU128": {
      ref = "U128";
      break;
    }
    case "scSpecTypeI128": {
      ref = "I128";
      break;
    }
    case "scSpecTypeU256": {
      ref = "U256";
      break;
    }
    case "scSpecTypeI256": {
      ref = "I256";
      break;
    }
    case "scSpecTypeBytes": {
      ref = "DataUrl";
      break;
    }
    case "scSpecTypeString": {
      ref = "ScString";
      break;
    }
    case "scSpecTypeSymbol": {
      ref = "ScSymbol";
      break;
    }
    case "scSpecTypeAddress": {
      ref = "Address";
      break;
    }
    case "scSpecTypeMuxedAddress": {
      ref = "MuxedAddress";
      break;
    }
    case "scSpecTypeOption": {
      const opt = typeDef.value;
      return typeRef(opt.valueType);
    }
    case "scSpecTypeResult": {
      const result = typeDef.value;
      return typeRef(result.okType);
    }
    case "scSpecTypeVec": {
      const arr = typeDef.value;
      const reference = typeRef(arr.elementType);
      return {
        type: "array",
        items: reference
      };
    }
    case "scSpecTypeMap": {
      const map = typeDef.value;
      const items = [typeRef(map.keyType), typeRef(map.valueType)];
      return {
        type: "array",
        items: {
          type: "array",
          items,
          minItems: 2,
          maxItems: 2
        }
      };
    }
    case "scSpecTypeTuple": {
      const tuple = typeDef.value;
      const minItems = tuple.valueTypes.length;
      const maxItems = minItems;
      const items = tuple.valueTypes.map(typeRef);
      return { type: "array", items, minItems, maxItems };
    }
    case "scSpecTypeBytesN": {
      const arr = typeDef.value;
      return {
        $ref: "#/definitions/DataUrl",
        maxLength: arr.n
      };
    }
    case "scSpecTypeUdt": {
      const udt = typeDef.value;
      ref = udt.name.toString();
      break;
    }
  }
  return { $ref: `#/definitions/${ref}` };
}
function isRequired(typeDef) {
  return typeDef.type !== "scSpecTypeOption";
}
function argsAndRequired(input) {
  const properties = {};
  const required = [];
  input.forEach((arg) => {
    const aType = arg.type;
    const name = arg.name.toString();
    properties[name] = typeRef(aType);
    if (isRequired(aType)) {
      required.push(name);
    }
  });
  const res = { properties };
  if (required.length > 0) {
    res.required = required;
  }
  return res;
}
function structToJsonSchema(udt) {
  const fields = udt.fields;
  if (fields.some(isNumeric)) {
    if (!fields.every(isNumeric)) {
      throw new Error(
        "mixed numeric and non-numeric field names are not allowed"
      );
    }
    const items = fields.map((_, i) => typeRef(fields[i].type));
    return {
      type: "array",
      items,
      minItems: fields.length,
      maxItems: fields.length
    };
  }
  const description = udt.doc.toString();
  const { properties, required } = argsAndRequired(fields);
  return {
    description,
    properties,
    required,
    additionalProperties: false,
    type: "object"
  };
}
function functionToJsonSchema(func) {
  const { properties, required } = argsAndRequired(func.inputs);
  const args = {
    additionalProperties: false,
    properties,
    type: "object"
  };
  if (required?.length > 0) {
    args.required = required;
  }
  const input = {
    properties: {
      args
    }
  };
  const outputs = func.outputs;
  const output = outputs.length > 0 ? typeRef(outputs[0]) : typeRef(ScSpecTypeDef.scSpecTypeVoid());
  const description = func.doc.toString();
  if (description.length > 0) {
    input.description = description;
  }
  input.additionalProperties = false;
  output.additionalProperties = false;
  return {
    input,
    output
  };
}
function unionToJsonSchema(udt) {
  const description = udt.doc.toString();
  const cases = udt.cases;
  const oneOf = [];
  cases.forEach((aCase) => {
    switch (aCase.type) {
      case "scSpecUdtUnionCaseVoidV0": {
        const c = aCase.value;
        const title = c.name.toString();
        oneOf.push({
          type: "object",
          title,
          properties: {
            tag: title
          },
          additionalProperties: false,
          required: ["tag"]
        });
        break;
      }
      case "scSpecUdtUnionCaseTupleV0": {
        const c = aCase.value;
        const title = c.name.toString();
        oneOf.push({
          type: "object",
          title,
          properties: {
            tag: title,
            values: {
              type: "array",
              items: c.type.map(typeRef)
            }
          },
          required: ["tag", "values"],
          additionalProperties: false
        });
      }
    }
  });
  const res = {
    oneOf
  };
  if (description.length > 0) {
    res.description = description;
  }
  return res;
}
class Spec {
  /**
   * The XDR spec entries.
   */
  entries = [];
  /**
   * Generates a Spec instance from the contract's wasm binary.
   *
   * @param wasm - The contract's wasm binary as a Uint8Array.
   * @returns A Promise that resolves to a Spec instance.
   * @throws If the contract spec cannot be obtained from the provided wasm binary.
   */
  static fromWasm(wasm) {
    const spec = specFromWasm(wasm);
    return new Spec(spec);
  }
  /**
   * Generates a Spec instance from contract specs in any of the following forms:
   * - An XDR encoded stream of ScSpecEntry entries, the format of the spec
   *   stored inside Wasm files.
   * - A base64 XDR encoded stream of ScSpecEntry entries.
   * - An array of ScSpecEntry.
   * - An array of base64 XDR encoded ScSpecEntry.
   *
   * @returns A Promise that resolves to a Client instance.
   * @throws If the contract spec cannot be obtained from the provided wasm binary.
   */
  constructor(entries) {
    if (entries instanceof Uint8Array) {
      this.entries = processSpecEntryStream(entries);
    } else if (typeof entries === "string") {
      this.entries = processSpecEntryStream((0,base64/* base64ToUint8Array */.E)(entries));
    } else {
      if (entries.length === 0) {
        throw new Error("Contract spec must have at least one entry");
      }
      const entry = entries[0];
      if (typeof entry === "string") {
        this.entries = entries.map(
          (s) => ScSpecEntry.fromXdr(s, "base64")
        );
      } else {
        this.entries = entries;
      }
    }
  }
  /**
   * Gets the XDR functions from the spec.
   * @returns all contract functions
   */
  funcs() {
    return this.entries.filter((entry) => entry.type === "scSpecEntryFunctionV0").map((entry) => entry.value);
  }
  /**
   * Gets the XDR function spec for the given function name.
   *
   * @param name - the name of the function
   * @returns the function spec
   *
   * @throws if no function with the given name exists
   */
  getFunc(name) {
    const entry = this.findEntry(name);
    if (entry.type !== "scSpecEntryFunctionV0") {
      throw new Error(`${name} is not a function`);
    }
    return entry.value;
  }
  /**
   * Converts native JS arguments to ScVals for calling a contract function.
   *
   * @param name - the name of the function
   * @param args - the arguments object
   * @returns the converted arguments
   *
   * @throws if argument is missing or incorrect type
   *
   * @example
   * ```ts
   * const args = {
   *   arg1: 'value1',
   *   arg2: 1234
   * };
   * const scArgs = contractSpec.funcArgsToScVals('funcName', args);
   * ```
   */
  funcArgsToScVals(name, args) {
    const fn = this.getFunc(name);
    return fn.inputs.map(
      (input) => this.nativeToScVal(readObj(args, input), input.type)
    );
  }
  /**
   * Converts the result ScVal of a function call to a native JS value.
   *
   * @param name - the name of the function
   * @param val_or_base64 - the result ScVal or base64 encoded string
   * @returns the converted native value
   *
   * @throws if return type mismatch or invalid input
   *
   * @example
   * ```ts
   * const resultScv = 'AAA=='; // Base64 encoded ScVal
   * const result = contractSpec.funcResToNative('funcName', resultScv);
   * ```
   */
  funcResToNative(name, val_or_base64) {
    const val = typeof val_or_base64 === "string" ? sc_val/* ScVal */.wq.fromXdr(val_or_base64, "base64") : val_or_base64;
    const func = this.getFunc(name);
    const outputs = func.outputs;
    if (outputs.length === 0) {
      if (val.type !== "scvVoid") {
        throw new Error(`Expected void, got ${val.type}`);
      }
      return null;
    }
    if (outputs.length > 1) {
      throw new Error(`Multiple outputs not supported`);
    }
    const output = outputs[0];
    if (output.type === "scSpecTypeResult") {
      if (val.type === "scvError") {
        return new Err({
          message: (0,base64/* uint8ArrayToBase64 */.Y)(val.value.toXdr())
        });
      }
      return new Ok(this.scValToNative(val, output.value.okType));
    }
    return this.scValToNative(val, output);
  }
  /**
   * Finds the XDR spec entry for the given name.
   *
   * @param name - the name to find
   * @returns the entry
   *
   * @throws if no entry with the given name exists
   */
  findEntry(name) {
    const entry = this.entries.find((e) => {
      if (e.type === "scSpecEntryFunctionV0") {
        return e.value.name.toString() === name;
      }
      return e.value.name.toString() === name;
    });
    if (!entry) {
      throw new Error(`no such entry: ${name}`);
    }
    return entry;
  }
  /**
   * Converts a native JS value to an ScVal based on the given type.
   *
   * @param val - the native JS value
   * @param ty - the expected type
   * @returns the converted ScVal
   *
   * @throws if value cannot be converted to the given type
   */
  nativeToScVal(val, ty) {
    const tyType = ty.type;
    if (tyType === "scSpecTypeUdt") {
      const udt = ty.value;
      return this.nativeToUdt(val, udt.name.toString());
    }
    if (tyType === "scSpecTypeOption") {
      const opt = ty.value;
      if (val === null || val === void 0) {
        return sc_val/* ScVal */.wq.scvVoid();
      }
      return this.nativeToScVal(val, opt.valueType);
    }
    if (tyType === "scSpecTypeVal") {
      return (0,scval/* nativeToScVal */.o5)(val);
    }
    switch (typeof val) {
      case "object": {
        if (val === null) {
          switch (tyType) {
            case "scSpecTypeVoid":
              return sc_val/* ScVal */.wq.scvVoid();
            default:
              throw new TypeError(
                `Type ${ty} was not void, but value was null`
              );
          }
        }
        if (sc_val/* ScVal */.wq.is(val)) {
          return val;
        }
        if (val instanceof base_address/* Address */.p) {
          if (ty.type !== "scSpecTypeAddress") {
            throw new TypeError(
              `Type ${ty} was not address, but value was Address`
            );
          }
          return val.toScVal();
        }
        if (val instanceof base_contract/* Contract */.N) {
          if (ty.type !== "scSpecTypeAddress") {
            throw new TypeError(
              `Type ${ty} was not address, but value was Address`
            );
          }
          return val.address().toScVal();
        }
        if (val instanceof Uint8Array) {
          const copy = Uint8Array.from(val);
          switch (tyType) {
            case "scSpecTypeBytesN": {
              const bytesN = ty.value;
              if (copy.length !== bytesN.n) {
                throw new TypeError(
                  `expected ${bytesN.n} bytes, but got ${copy.length}`
                );
              }
              return sc_val/* ScVal */.wq.scvBytes(new sc_bytes/* ScBytes */.W(copy));
            }
            case "scSpecTypeBytes":
              return sc_val/* ScVal */.wq.scvBytes(new sc_bytes/* ScBytes */.W(copy));
            default:
              throw new TypeError(
                `invalid type (${ty}) specified for Bytes and BytesN`
              );
          }
        }
        if (Array.isArray(val)) {
          switch (tyType) {
            case "scSpecTypeVec": {
              const vec = ty.value;
              const elementType = vec.elementType;
              return sc_val/* ScVal */.wq.scvVec(
                val.map((v) => this.nativeToScVal(v, elementType))
              );
            }
            case "scSpecTypeTuple": {
              const tup = ty.value;
              const valTypes = tup.valueTypes;
              if (val.length !== valTypes.length) {
                throw new TypeError(
                  `Tuple expects ${valTypes.length} values, but ${val.length} were provided`
                );
              }
              return sc_val/* ScVal */.wq.scvVec(
                val.map((v, i) => this.nativeToScVal(v, valTypes[i]))
              );
            }
            case "scSpecTypeMap": {
              const map = ty.value;
              const keyType = map.keyType;
              const valueType = map.valueType;
              return sc_val/* ScVal */.wq.scvMap(
                val.map((entry) => {
                  const key = this.nativeToScVal(entry[0], keyType);
                  const mapVal = this.nativeToScVal(entry[1], valueType);
                  return new sc_val/* ScMapEntry */.Dh({ key, val: mapVal });
                })
              );
            }
            default:
              throw new TypeError(
                `Type ${ty} was not vec, but value was Array`
              );
          }
        }
        if (val instanceof Map) {
          if (tyType !== "scSpecTypeMap") {
            throw new TypeError(`Type ${ty} was not map, but value was Map`);
          }
          const scMap = ty.value;
          const map = val;
          const entries = [];
          const values = map.entries();
          let res = values.next();
          while (!res.done) {
            const [k, v] = res.value;
            const key = this.nativeToScVal(k, scMap.keyType);
            const mapval = this.nativeToScVal(v, scMap.valueType);
            entries.push(new sc_val/* ScMapEntry */.Dh({ key, val: mapval }));
            res = values.next();
          }
          return sc_val/* ScVal */.wq.scvMap(entries);
        }
        const proto = Object.getPrototypeOf(val);
        if (proto !== Object.prototype && proto !== null) {
          throw new TypeError(
            `cannot interpret ${val.constructor?.name} value as ScVal (${JSON.stringify(val)})`
          );
        }
        throw new TypeError(
          `Received object ${val}  did not match the provided type ${ty}`
        );
      }
      case "number":
      case "bigint": {
        switch (tyType) {
          case "scSpecTypeU32":
            if (BigInt(val) < BigInt(xdr/* Uint32 */.SSn.MIN_VALUE) || BigInt(val) > BigInt(xdr/* Uint32 */.SSn.MAX_VALUE)) {
              throw new RangeError(`Value ${val} is out of range for U32`);
            }
            return sc_val/* ScVal */.wq.scvU32(Number(val));
          case "scSpecTypeI32":
            if (BigInt(val) < BigInt(xdr/* Int32 */.P_H.MIN_VALUE) || BigInt(val) > BigInt(xdr/* Int32 */.P_H.MAX_VALUE)) {
              throw new RangeError(`Value ${val} is out of range for I32`);
            }
            return sc_val/* ScVal */.wq.scvI32(Number(val));
          case "scSpecTypeU64":
          case "scSpecTypeI64":
          case "scSpecTypeU128":
          case "scSpecTypeI128":
          case "scSpecTypeU256":
          case "scSpecTypeI256":
          case "scSpecTypeTimepoint":
          case "scSpecTypeDuration": {
            const intType = tyType.substring(10).toLowerCase();
            return new xdr_large_int/* XdrLargeInt */.x(intType, val).toScVal();
          }
          default:
            throw new TypeError(`invalid type (${ty}) specified for integer`);
        }
      }
      case "string":
        return stringToScVal(val, tyType);
      case "boolean": {
        if (tyType !== "scSpecTypeBool") {
          throw TypeError(`Type ${ty} was not bool, but value was bool`);
        }
        return sc_val/* ScVal */.wq.scvBool(val);
      }
      case "undefined": {
        if (!ty) {
          return sc_val/* ScVal */.wq.scvVoid();
        }
        switch (tyType) {
          case "scSpecTypeVoid":
            return sc_val/* ScVal */.wq.scvVoid();
          default:
            throw new TypeError(
              `Type ${ty} was not void, but value was undefined`
            );
        }
      }
      case "function":
        return this.nativeToScVal(val(), ty);
      default:
        throw new TypeError(`failed to convert typeof ${typeof val} (${val})`);
    }
  }
  nativeToUdt(val, name) {
    const entry = this.findEntry(name);
    switch (entry.type) {
      case "scSpecEntryUdtEnumV0":
        if (typeof val !== "number") {
          throw new TypeError(
            `expected number for enum ${name}, but got ${typeof val}`
          );
        }
        return this.nativeToEnum(val, entry.value);
      case "scSpecEntryUdtStructV0":
        return this.nativeToStruct(val, entry.value);
      case "scSpecEntryUdtUnionV0":
        return this.nativeToUnion(val, entry.value);
      default:
        throw new Error(`failed to parse udt ${name}`);
    }
  }
  nativeToUnion(val, union_) {
    const entryName = val.tag;
    const caseFound = union_.cases.find((entry) => {
      return entry.value.name.toString() === entryName;
    });
    if (!caseFound) {
      throw new TypeError(`no such enum entry: ${entryName} in ${union_}`);
    }
    const key = sc_val/* ScVal */.wq.scvSymbol(entryName);
    switch (caseFound.type) {
      case "scSpecUdtUnionCaseVoidV0": {
        return sc_val/* ScVal */.wq.scvVec([key]);
      }
      case "scSpecUdtUnionCaseTupleV0": {
        const types = caseFound.value.type;
        if (Array.isArray(val.values)) {
          if (val.values.length !== types.length) {
            throw new TypeError(
              `union ${union_} expects ${types.length} values, but got ${val.values.length}`
            );
          }
          const scvals = val.values.map(
            (v, i) => this.nativeToScVal(v, types[i])
          );
          scvals.unshift(key);
          return sc_val/* ScVal */.wq.scvVec(scvals);
        }
        throw new Error(`failed to parse union case ${caseFound} with ${val}`);
      }
      default:
        throw new Error(`failed to parse union ${union_} with ${val}`);
    }
  }
  nativeToStruct(val, struct) {
    const fields = struct.fields;
    if (fields.some(isNumeric)) {
      if (!fields.every(isNumeric)) {
        throw new Error(
          "mixed numeric and non-numeric field names are not allowed"
        );
      }
      return sc_val/* ScVal */.wq.scvVec(
        fields.map(
          (_, i) => this.nativeToScVal(val[i], fields[i].type)
        )
      );
    }
    return sc_val/* ScVal */.wq.scvMap(
      fields.map((field) => {
        const name = field.name.toString();
        return new sc_val/* ScMapEntry */.Dh({
          key: this.nativeToScVal(name, ScSpecTypeDef.scSpecTypeSymbol()),
          val: this.nativeToScVal(val[name], field.type)
        });
      })
    );
  }
  nativeToEnum(val, enum_) {
    if (enum_.cases.some((entry) => entry.value === val)) {
      return sc_val/* ScVal */.wq.scvU32(val);
    }
    throw new TypeError(`no such enum entry: ${val} in ${enum_}`);
  }
  /**
   * Converts an base64 encoded ScVal back to a native JS value based on the given type.
   *
   * @param scv - the base64 encoded ScVal
   * @param typeDef - the expected type
   * @returns the converted native JS value
   *
   * @throws if ScVal cannot be converted to the given type
   */
  scValStrToNative(scv, typeDef) {
    return this.scValToNative(sc_val/* ScVal */.wq.fromXdr(scv, "base64"), typeDef);
  }
  /**
   * Converts an ScVal back to a native JS value based on the given type.
   *
   * @param scv - the ScVal
   * @param typeDef - the expected type
   * @returns the converted native JS value
   *
   * @throws if ScVal cannot be converted to the given type
   */
  scValToNative(scv, typeDef) {
    const tyType = typeDef.type;
    if (tyType === "scSpecTypeOption") {
      switch (scv.type) {
        case "scvVoid":
          return null;
        default:
          return this.scValToNative(scv, typeDef.value.valueType);
      }
    }
    if (tyType === "scSpecTypeUdt") {
      return this.scValUdtToNative(scv, typeDef.value);
    }
    if (tyType === "scSpecTypeVal") {
      return (0,scval/* scValToNative */.io)(scv);
    }
    switch (scv.type) {
      case "scvVoid":
        return null;
      // these can be converted to bigints directly
      case "scvU64":
      case "scvI64":
      case "scvTimepoint":
      case "scvDuration":
      // these can be parsed by internal abstractions note that this can also
      // handle the above two cases, but it's not as efficient (another
      // type-check, parsing, etc.)
      case "scvU128":
      case "scvI128":
      case "scvU256":
      case "scvI256":
        return (0,numbers/* scValToBigInt */.O)(scv);
      case "scvVec": {
        if (tyType === "scSpecTypeVec") {
          const vec = typeDef.value;
          return (scv.value ?? []).map(
            (elm) => this.scValToNative(elm, vec.elementType)
          );
        }
        if (tyType === "scSpecTypeTuple") {
          const tuple = typeDef.value;
          const valTypes = tuple.valueTypes;
          return (scv.value ?? []).map(
            (elm, i) => this.scValToNative(elm, valTypes[i])
          );
        }
        throw new TypeError(`Type ${typeDef} was not vec, but ${scv} is`);
      }
      case "scvAddress":
        return base_address/* Address */.p.fromScVal(scv).toString();
      case "scvMap": {
        const map = scv.value ?? [];
        if (tyType === "scSpecTypeMap") {
          const typed = typeDef.value;
          const keyType = typed.keyType;
          const valueType = typed.valueType;
          const res = map.map((entry) => [
            this.scValToNative(entry.key, keyType),
            this.scValToNative(entry.val, valueType)
          ]);
          return res;
        }
        throw new TypeError(
          `ScSpecType ${tyType} was not map, but ${JSON.stringify(
            scv,
            null,
            2
          )} is`
        );
      }
      // these return the primitive type directly
      case "scvBool":
      case "scvU32":
      case "scvI32":
        return scv.value;
      case "scvBytes":
        return scv.value.value;
      case "scvString":
      case "scvSymbol": {
        if (tyType !== "scSpecTypeString" && tyType !== "scSpecTypeSymbol") {
          throw new Error(
            `ScSpecType ${tyType} was not string or symbol, but ${JSON.stringify(scv, null, 2)} is`
          );
        }
        return scv.value?.toString();
      }
      // in the fallthrough case, just return the underlying value directly
      default:
        throw new TypeError(
          `failed to convert ${JSON.stringify(
            scv,
            null,
            2
          )} to native type from type ${tyType}`
        );
    }
  }
  scValUdtToNative(scv, udt) {
    const entry = this.findEntry(udt.name.toString());
    switch (entry.type) {
      case "scSpecEntryUdtEnumV0":
        return this.enumToNative(scv);
      case "scSpecEntryUdtStructV0":
        return this.structToNative(scv, entry.value);
      case "scSpecEntryUdtUnionV0":
        return this.unionToNative(scv, entry.value);
      default:
        throw new Error(`failed to parse udt ${udt.name.toString()}: ${entry}`);
    }
  }
  unionToNative(val, udt) {
    if (val.type !== "scvVec") {
      throw new Error(`${JSON.stringify(val, null, 2)} is not a vec`);
    }
    const vec = val.value;
    if (!vec) {
      throw new Error(`${JSON.stringify(val, null, 2)} is not a vec`);
    }
    if (vec.length === 0 && udt.cases.length !== 0) {
      throw new Error(
        `${val} has length 0, but the there are at least one case in the union`
      );
    }
    if (vec[0].type !== "scvSymbol") {
      throw new Error(`${vec[0]} is not a symbol`);
    }
    const name = vec[0].value.toString();
    const entry = udt.cases.find(findCase(name));
    if (!entry) {
      throw new Error(
        `failed to find entry ${name} in union ${udt.name.toString()}`
      );
    }
    const res = { tag: name };
    if (entry.type === "scSpecUdtUnionCaseTupleV0") {
      const tuple = entry.value;
      const ty = tuple.type;
      const values = ty.map(
        (e, i) => this.scValToNative(vec[i + 1], e)
      );
      res.values = values;
    }
    return res;
  }
  structToNative(val, udt) {
    const res = {};
    const fields = udt.fields;
    if (fields.some(isNumeric)) {
      if (val.type !== "scvVec") {
        throw new Error(
          `${JSON.stringify(val, null, 2)} is not a vec (expected for tuple-like struct)`
        );
      }
      const vec = val.value ?? [];
      return vec.map(
        (elm, i) => this.scValToNative(elm, fields[i].type)
      );
    }
    if (val.type !== "scvMap") {
      throw new Error(`${JSON.stringify(val, null, 2)} is not a map`);
    }
    const entries = val.value ?? [];
    entries.forEach((entry, i) => {
      const field = fields[i];
      res[field.name.toString()] = this.scValToNative(entry.val, field.type);
    });
    return res;
  }
  enumToNative(scv) {
    if (scv.type !== "scvU32") {
      throw new Error(`Enum must have a u32 value`);
    }
    const num = scv.value;
    return num;
  }
  /**
   * Gets the XDR error cases from the spec.
   *
   * @returns all contract functions
   *
   */
  errorCases() {
    return this.entries.filter((entry) => entry.type === "scSpecEntryUdtErrorEnumV0").flatMap((entry) => entry.value.cases);
  }
  /**
   * Gets the SEP-48 event spec entries from the spec.
   *
   * @returns all contract events
   */
  events() {
    return events(this.entries);
  }
  /**
   * Finds the XDR event spec for the given event name.
   *
   * Unlike {@link Spec.findEntry}, a missing event is not an error: this
   * returns `undefined` so callers can probe a contract for an event without
   * wrapping the call in a `try`.
   *
   * @param name - the name of the event
   * @param occurrence - (optional) 0-based index among same-named events, in
   *        declaration order, for contracts that declare the same event name
   *        more than once (defaults to the first)
   * @returns the event spec, or `undefined` if the contract declares no event
   *          with that name (at that occurrence)
   *
   * @throws if `occurrence` is not a non-negative integer
   *
   * @example
   * ```ts
   * if (contractSpec.findEvent("transfer")) {
   *   // the contract declares a "transfer" event
   * }
   * ```
   */
  findEvent(name, occurrence) {
    return findEvent(this.entries, name, occurrence);
  }
  /**
   * Attempts to parse an emitted contract event (its topics and data) using
   * the event specs (SEP-48) declared in this contract's spec.
   *
   * An event's topics are `[...prefixTopics, ...topicListParamValues]` (in
   * that order), and its data is decoded according to the event's
   * `dataFormat` (`singleValue`, `vec`, or `map`).
   *
   * @param topics - the event's topics, as `ScVal[]` or base64 XDR strings
   * @param data - the event's data, as an `ScVal` or a base64 XDR string
   * @returns the parsed event (its name plus all decoded params — topic-list
   *          and data-located alike — merged into `data`), or `undefined` if
   *          no event spec matches (e.g. when filtering a mixed stream of
   *          events from multiple contracts/specs)
   *
   * Note that matching compares only the prefix topics and the topic count;
   * if two event specs share both (in particular, events with no prefix
   * topics match on arity alone), the first declared spec whose values
   * decode successfully wins.
   *
   * @example
   * ```ts
   * const parsed = contractSpec.parseEvent(response.topic, response.value);
   * if (parsed) {
   *   console.log(parsed.name, parsed.data);
   * }
   * ```
   */
  parseEvent(topics, data) {
    return parseEvent(this, this.entries, topics, data);
  }
  /**
   * Builds a `getEvents` topic filter (a single row of `Api.EventFilter.topics`)
   * for the named event: base64-encoded `scvSymbol`s for the event's prefix
   * topics, followed by one entry per topic-list param — either the
   * base64-encoded ScVal for a value supplied in `topicValues`, or the
   * wildcard `"*"`.
   *
   * @param name - the name of the event
   * @param topicValues - (optional) native values for topic-list params, keyed by param name
   * @param occurrence - (optional) 0-based index among same-named events, in
   *        declaration order, for contracts that declare the same event name
   *        more than once (defaults to the first)
   * @returns a single topic filter row
   *
   * @throws if no event with the given name (at the given occurrence) exists,
   *         or if `occurrence` is not a non-negative integer
   *
   * @example
   * ```ts
   * const topics = contractSpec.eventTopicFilter('transfer', { to: someAddress });
   * ```
   */
  eventTopicFilter(name, topicValues, occurrence) {
    return eventTopicFilter(
      this,
      this.entries,
      name,
      topicValues,
      occurrence
    );
  }
  /**
   * Converts the contract spec to a JSON schema.
   *
   * If `funcName` is provided, the schema will be a reference to the function schema.
   *
   * @param funcName - (optional) the name of the function to convert
   * @returns the converted JSON schema
   *
   * @throws if the contract spec is invalid
   */
  jsonSchema(funcName) {
    const definitions = {};
    this.entries.forEach((entry) => {
      switch (entry.type) {
        case "scSpecEntryUdtEnumV0": {
          const udt = entry.value;
          definitions[udt.name.toString()] = enumToJsonSchema(udt);
          break;
        }
        case "scSpecEntryUdtStructV0": {
          const udt = entry.value;
          definitions[udt.name.toString()] = structToJsonSchema(udt);
          break;
        }
        case "scSpecEntryUdtUnionV0": {
          const udt = entry.value;
          definitions[udt.name.toString()] = unionToJsonSchema(udt);
          break;
        }
        case "scSpecEntryFunctionV0": {
          const fn = entry.value;
          const fnName = fn.name.toString();
          const { input } = functionToJsonSchema(fn);
          definitions[fnName] = input;
          break;
        }
      }
    });
    const res = {
      $schema: "http://json-schema.org/draft-07/schema#",
      definitions: { ...PRIMITIVE_DEFINITONS, ...definitions }
    };
    if (funcName) {
      res.$ref = `#/definitions/${funcName}`;
    }
    return res;
  }
}


//# sourceMappingURL=spec.js.map

// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/rpc/server.js + 6 modules
var rpc_server = __webpack_require__(9812);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/base/transaction_builder.js + 2 modules
var transaction_builder = __webpack_require__(2931);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/base/sorobandata_builder.js
var sorobandata_builder = __webpack_require__(7229);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/base/keypair.js + 2 modules
var keypair = __webpack_require__(8477);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/base/strkey.js + 7 modules
var strkey = __webpack_require__(3697);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/base/hashing.js
var hashing = __webpack_require__(7935);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/soroban-address-credentials.js
var soroban_address_credentials = __webpack_require__(7050);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/hash-id-preimage-soroban-authorization-with-address.js
var hash_id_preimage_soroban_authorization_with_address = __webpack_require__(5916);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/hash-id-preimage-soroban-authorization.js
var hash_id_preimage_soroban_authorization = __webpack_require__(7256);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/soroban-address-credentials-with-delegates.js
var soroban_address_credentials_with_delegates = __webpack_require__(3542);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/soroban-delegate-signature.js
var soroban_delegate_signature = __webpack_require__(357);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/soroban-authorization-entry.js
var soroban_authorization_entry = __webpack_require__(2813);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/soroban-credentials.js + 1 modules
var soroban_credentials = __webpack_require__(8133);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/hash-id-preimage.js + 1 modules
var hash_id_preimage = __webpack_require__(9976);
;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/base/auth.js

















function toScVal(value) {
  if (sc_val/* ScVal */.wq.is(value)) return value;
  if (typeof value !== "object" || value === null) return null;
  const ctor = value.constructor;
  if (ctor?.schema?.name !== sc_val/* ScVal */.wq.schema.name) return null;
  const toXdrObject = value.toXdrObject;
  if (typeof toXdrObject !== "function") return null;
  try {
    return sc_val/* ScVal */.wq.fromXdr(sc_val/* ScVal */.wq.schema.encode(toXdrObject.call(value)));
  } catch {
    return null;
  }
}
async function authorizeEntry(entry, signer, validUntilLedgerSeq, networkPassphrase, forAddress) {
  if (entry.credentials.type === "sorobanCredentialsSourceAccount") {
    return entry;
  }
  const credentials = entry.credentials;
  const addrAuth = getAddressCredentials(credentials);
  if (addrAuth === null) {
    throw new Error(`unsupported credential type ${credentials.type}`);
  }
  const preimage = buildAuthorizationEntryPreimage(
    entry,
    validUntilLedgerSeq,
    networkPassphrase
  );
  const payload = (0,hashing/* hash */.t)(preimage.toXdr());
  let signatureScVal;
  let targetAddress = forAddress;
  let sigResult = null;
  if (typeof signer === "function") {
    sigResult = await signer(preimage, Uint8Array.from(payload));
  }
  if (sigResult !== null && typeof sigResult === "object" && "signatureScVal" in sigResult) {
    const candidate = sigResult.signatureScVal;
    const asScVal = toScVal(candidate);
    if (asScVal === null) {
      throw new TypeError(
        `signatureScVal must be an xdr.ScVal, got ${candidate === null ? "null" : typeof candidate}`
      );
    }
    signatureScVal = asScVal;
    targetAddress ??= sigResult.address;
  } else {
    let signature;
    let publicKey;
    if (typeof signer === "function") {
      if (sigResult !== null && typeof sigResult === "object" && "signature" in sigResult) {
        signature = sigResult.signature;
        publicKey = sigResult.publicKey;
      } else if ((0,uint8array_extras/* isUint8Array */.mg)(sigResult)) {
        signature = sigResult;
        publicKey = base_address/* Address */.p.fromScAddress(addrAuth.address).toString();
      } else {
        throw new TypeError(
          `SigningCallback must resolve to a Uint8Array, { signature, publicKey }, or { signatureScVal }; got ${sigResult === null ? "null" : typeof sigResult}`
        );
      }
    } else {
      signature = signer.sign(payload);
      publicKey = signer.publicKey();
    }
    if (typeof publicKey !== "string") {
      throw new TypeError(
        `expected a public key string from the signer, got ${typeof publicKey}`
      );
    }
    if (!(0,uint8array_extras/* isUint8Array */.mg)(signature)) {
      throw new TypeError(
        `expected a Uint8Array signature from the signer, got ${signature === null ? "null" : typeof signature}`
      );
    }
    if (!keypair/* Keypair */.A.fromPublicKey(publicKey).verify(payload, signature)) {
      throw new Error(`signature doesn't match payload`);
    }
    const sigScVal = (0,scval/* nativeToScVal */.o5)(
      {
        public_key: strkey/* StrKey */.L8.decodeEd25519PublicKey(publicKey),
        signature
      },
      {
        type: {
          public_key: ["symbol", null],
          signature: ["symbol", null]
        }
      }
    );
    signatureScVal = sc_val/* ScVal */.wq.scvVec([sigScVal]);
  }
  const { credentials: signedCredentials, matched } = applyExpirationAndSignature(
    credentials,
    validUntilLedgerSeq,
    signatureScVal,
    targetAddress
  );
  if (matched === 0) {
    throw new Error(
      `the authorization entry has no credential node for address ${targetAddress}`
    );
  }
  return new soroban_authorization_entry/* SorobanAuthorizationEntry */.Q({
    credentials: signedCredentials,
    rootInvocation: entry.rootInvocation
  });
}
function authorizeInvocation(params) {
  const {
    signer,
    validUntilLedgerSeq,
    invocation,
    networkPassphrase,
    publicKey = "",
    authV2 = true
  } = params;
  const kp = Keypair.random().rawPublicKey();
  const nonce = Int64(bytesToInt64(kp));
  const pk = publicKey || (signer instanceof Keypair ? signer.publicKey() : null);
  if (!pk) {
    throw new Error(`authorizeInvocation requires publicKey parameter`);
  }
  const addressCredentials = new SorobanAddressCredentials({
    address: new Address(pk).toScAddress(),
    nonce,
    signatureExpirationLedger: 0,
    // replaced
    signature: ScVal.scvVec([])
    // replaced
  });
  const entry = new SorobanAuthorizationEntry({
    rootInvocation: invocation,
    credentials: authV2 ? SorobanCredentials.sorobanCredentialsAddressV2(addressCredentials) : SorobanCredentials.sorobanCredentialsAddress(addressCredentials)
  });
  return authorizeEntry(entry, signer, validUntilLedgerSeq, networkPassphrase);
}
function buildAuthorizationEntryPreimage(entry, validUntilLedgerSeq, networkPassphrase) {
  const credentials = entry.credentials;
  const addrAuth = getAddressCredentials(credentials);
  if (addrAuth === null) {
    throw new Error(
      `cannot build a signature payload for credential type ${credentials.type}`
    );
  }
  const networkId = (0,hashing/* hash */.t)(networkPassphrase);
  switch (credentials.type) {
    // legacy address credentials are not address-bound
    case "sorobanCredentialsAddress":
      return hash_id_preimage/* HashIdPreimage */.co.envelopeTypeSorobanAuthorization(
        new hash_id_preimage_soroban_authorization/* HashIdPreimageSorobanAuthorization */.t({
          networkId,
          nonce: addrAuth.nonce,
          invocation: entry.rootInvocation,
          signatureExpirationLedger: validUntilLedgerSeq
        })
      );
    // ADDRESS_V2 and ADDRESS_WITH_DELEGATES bind the address into the signed
    // payload via the WithAddress preimage (CAP-71)
    case "sorobanCredentialsAddressV2":
    case "sorobanCredentialsAddressWithDelegates":
      return hash_id_preimage/* HashIdPreimage */.co.envelopeTypeSorobanAuthorizationWithAddress(
        new hash_id_preimage_soroban_authorization_with_address/* HashIdPreimageSorobanAuthorizationWithAddress */.T({
          networkId,
          nonce: addrAuth.nonce,
          invocation: entry.rootInvocation,
          address: addrAuth.address,
          signatureExpirationLedger: validUntilLedgerSeq
        })
      );
    default:
      throw new Error(`unsupported credential type ${credentials.type}`);
  }
}
function buildWithDelegatesEntry(params) {
  const { entry, validUntilLedgerSeq, delegates, signature } = params;
  const credentials = entry.credentials;
  const addrAuth = getAddressCredentials(credentials);
  if (addrAuth === null || credentials.type === "sorobanCredentialsAddressWithDelegates") {
    throw new Error(
      `buildWithDelegatesEntry expects ADDRESS or ADDRESS_V2 credentials, got ${credentials.type}`
    );
  }
  return new SorobanAuthorizationEntry({
    rootInvocation: entry.rootInvocation,
    credentials: SorobanCredentials.sorobanCredentialsAddressWithDelegates(
      new SorobanAddressCredentialsWithDelegates({
        addressCredentials: new SorobanAddressCredentials({
          address: addrAuth.address,
          nonce: addrAuth.nonce,
          signatureExpirationLedger: validUntilLedgerSeq,
          signature: signature ?? ScVal.scvVoid()
        }),
        delegates: buildDelegateNodes(delegates)
      })
    )
  });
}
function buildDelegateNodes(delegates) {
  const nodes = delegates.map(
    (delegate) => new SorobanDelegateSignature({
      address: new Address(delegate.address).toScAddress(),
      signature: delegate.signature ?? ScVal.scvVoid(),
      nestedDelegates: buildDelegateNodes(delegate.nestedDelegates ?? [])
    })
  );
  nodes.sort(
    (a, b) => compareUint8Arrays(a.address.toXdr(), b.address.toXdr())
  );
  for (let i = 1; i < nodes.length; i++) {
    if (compareUint8Arrays(
      nodes[i - 1].address.toXdr(),
      nodes[i].address.toXdr()
    ) === 0) {
      throw new Error(
        `duplicate delegate address ${Address.fromScAddress(
          nodes[i].address
        ).toString()}`
      );
    }
  }
  return nodes;
}
function getAddressCredentials(credentials) {
  switch (credentials.type) {
    case "sorobanCredentialsAddress":
      return credentials.address;
    case "sorobanCredentialsAddressV2":
      return credentials.addressV2;
    case "sorobanCredentialsAddressWithDelegates":
      return credentials.addressWithDelegates.addressCredentials;
    default:
      return null;
  }
}
function applyExpirationAndSignature(credentials, validUntilLedgerSeq, signature, forAddress) {
  const topAddr = getAddressCredentials(credentials);
  if (topAddr === null) {
    return { credentials, matched: 0 };
  }
  let matched = 0;
  const topIsTarget = forAddress === void 0 || base_address/* Address */.p.fromScAddress(topAddr.address).toString() === forAddress;
  if (topIsTarget) {
    matched++;
  }
  const newTopAddr = new soroban_address_credentials/* SorobanAddressCredentials */.l({
    address: topAddr.address,
    nonce: topAddr.nonce,
    signatureExpirationLedger: validUntilLedgerSeq,
    signature: topIsTarget ? signature : topAddr.signature
  });
  switch (credentials.type) {
    case "sorobanCredentialsAddress":
      return {
        credentials: soroban_credentials/* SorobanCredentials */.j5.sorobanCredentialsAddress(newTopAddr),
        matched
      };
    case "sorobanCredentialsAddressV2":
      return {
        credentials: soroban_credentials/* SorobanCredentials */.j5.sorobanCredentialsAddressV2(newTopAddr),
        matched
      };
    case "sorobanCredentialsAddressWithDelegates": {
      const withDelegates = credentials.addressWithDelegates;
      const newDelegates = forAddress === void 0 ? withDelegates.delegates : rebuildDelegatesWithSignature(
        withDelegates.delegates,
        forAddress,
        signature,
        () => {
          matched++;
        }
      );
      return {
        credentials: soroban_credentials/* SorobanCredentials */.j5.sorobanCredentialsAddressWithDelegates(
          new soroban_address_credentials_with_delegates/* SorobanAddressCredentialsWithDelegates */.J({
            addressCredentials: newTopAddr,
            delegates: newDelegates
          })
        ),
        matched
      };
    }
    default:
      return { credentials, matched };
  }
}
function rebuildDelegatesWithSignature(delegates, forAddress, signature, onMatch) {
  return delegates.map((delegate) => {
    const isMatch = base_address/* Address */.p.fromScAddress(delegate.address).toString() === forAddress;
    if (isMatch) {
      onMatch();
    }
    return new soroban_delegate_signature/* SorobanDelegateSignature */.a({
      address: delegate.address,
      signature: isMatch ? signature : delegate.signature,
      nestedDelegates: rebuildDelegatesWithSignature(
        delegate.nestedDelegates,
        forAddress,
        signature,
        onMatch
      )
    });
  });
}
function inspectAuthEntry(entry) {
  const credentials = entry.credentials;
  const addrAuth = getAddressCredentials(credentials);
  let credentialType;
  switch (credentials.type) {
    case "sorobanCredentialsSourceAccount":
      credentialType = "sourceAccount";
      break;
    case "sorobanCredentialsAddress":
      credentialType = "address";
      break;
    case "sorobanCredentialsAddressV2":
      credentialType = "addressV2";
      break;
    case "sorobanCredentialsAddressWithDelegates":
      credentialType = "addressWithDelegates";
      break;
    default:
      throw new Error(
        `unsupported credential type ${credentials.type}`
      );
  }
  const signers = collectSignatureNodes(credentials).map(
    (node) => ({
      address: base_address/* Address */.p.fromScAddress(node.address).toString(),
      signed: signaturePresent(node.signature),
      signatures: parseEd25519Signatures(node.signature),
      rawSignature: node.signature
    })
  );
  return {
    credentialType,
    address: addrAuth === null ? null : base_address/* Address */.p.fromScAddress(addrAuth.address).toString(),
    nonce: addrAuth === null ? null : addrAuth.nonce,
    signatureExpirationLedger: addrAuth === null ? null : addrAuth.signatureExpirationLedger,
    signers,
    signed: signers.length > 0 && signers.every((signer) => signer.signed),
    invocation: entry.rootInvocation
  };
}
function collectSignatureNodes(credentials) {
  const addrAuth = getAddressCredentials(credentials);
  if (addrAuth === null) {
    return [];
  }
  const nodes = [
    { address: addrAuth.address, signature: addrAuth.signature }
  ];
  if (credentials.type === "sorobanCredentialsAddressWithDelegates") {
    const walk = (delegates) => {
      delegates.forEach((delegate) => {
        nodes.push({
          address: delegate.address,
          signature: delegate.signature
        });
        walk(delegate.nestedDelegates);
      });
    };
    walk(credentials.addressWithDelegates.delegates);
  }
  return nodes;
}
function checkAuthEntryReadiness(entry, currentLedgerSeq) {
  if (!Number.isInteger(currentLedgerSeq) || currentLedgerSeq < 0 || currentLedgerSeq > 4294967295) {
    throw new Error(
      `currentLedgerSeq must be a uint32 ledger sequence, got ${currentLedgerSeq}`
    );
  }
  const info = inspectAuthEntry(entry);
  if (info.credentialType === "sourceAccount") {
    return { ready: true, expired: false, unsignedBy: [] };
  }
  const expired = currentLedgerSeq >= (info.signatureExpirationLedger ?? 0);
  const unsignedBy = info.signers.filter((signer) => !signer.signed).map((signer) => signer.address);
  return { ready: !expired && unsignedBy.length === 0, expired, unsignedBy };
}
function signaturePresent(signature) {
  switch (signature.type) {
    case "scvVoid":
      return false;
    case "scvVec":
      return (signature.value ?? []).length > 0;
    default:
      return true;
  }
}
function parseEd25519Signatures(signature) {
  if (signature.type !== "scvVec") {
    return null;
  }
  const parsed = [];
  for (const element of signature.value ?? []) {
    if (element.type !== "scvMap") {
      return null;
    }
    let publicKey = null;
    let sig = null;
    for (const mapEntry of element.value ?? []) {
      const { key, val } = mapEntry;
      if (key.type !== "scvSymbol" || val.type !== "scvBytes") {
        return null;
      }
      switch (key.value.toString()) {
        case "public_key":
          publicKey = val.value.value;
          break;
        case "signature":
          sig = val.value.value;
          break;
        default:
          return null;
      }
    }
    if (publicKey === null || sig === null || publicKey.length !== 32 || sig.length !== 64) {
      return null;
    }
    parsed.push({
      publicKey: strkey/* StrKey */.L8.encodeEd25519PublicKey(publicKey),
      signature: sig
    });
  }
  return parsed;
}
function bytesToInt64(bytes) {
  const buf = bytes.subarray(0, 8);
  if (buf.length < 8) {
    throw new Error(
      `need at least 8 bytes to convert to Int64, got ${bytes.length}`
    );
  }
  const view = new DataView(buf.buffer, buf.byteOffset, 8);
  const value = view.getBigInt64(0, false);
  return value;
}


//# sourceMappingURL=auth.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/contract/signer.js













class KeypairSigner {
  /**
   * @param keypair - the {@link Keypair} to sign with. Signing throws
   *    `cannot sign: no secret key available` if it holds only a public key.
   * @param networkPassphrase - passphrase of the network to sign for, used
   *    whenever the caller does not pass one at signing time
   */
  constructor(keypair, networkPassphrase) {
    this.keypair = keypair;
    this.networkPassphrase = networkPassphrase;
    this.address = keypair.publicKey();
  }
  keypair;
  networkPassphrase;
  /**
   * The keypair's Ed25519 account address (`G…`), always `keypair.publicKey()`.
   */
  address;
  /* Arrow instance properties rather than prototype methods because
       `basicNodeSigner` destructures them into a plain object, which would lose
       `this` on a prototype method. (The normalizers below tolerate either, since
       they bind what they extract.)
  
       They stay `async` despite having nothing to await (hence the rule
       suppressions): that way a synchronous failure — malformed XDR, or a keypair
       holding no secret key — rejects the returned promise instead of throwing,
       preserving the behavior `basicNodeSigner` had before it delegated here. */
  // eslint-disable-next-line @typescript-eslint/require-await
  signTransaction = async (xdr, opts) => {
    const t = transaction_builder/* TransactionBuilder */.Qc.fromXdr(
      xdr,
      opts?.networkPassphrase || this.networkPassphrase
    );
    t.sign(this.keypair);
    return {
      signedTxXdr: t.toXdr(),
      signerAddress: this.address
    };
  };
  // eslint-disable-next-line @typescript-eslint/require-await
  signAuthEntry = async (authEntry) => {
    const signedAuthEntry = (0,base64/* uint8ArrayToBase64 */.Y)(
      this.keypair.sign((0,hashing/* hash */.t)((0,base64/* base64ToUint8Array */.E)(authEntry)))
    );
    return {
      signedAuthEntry,
      signerAddress: this.address
    };
  };
}
function isKeypairLike(value) {
  return "publicKey" in value && typeof value.publicKey === "function" && "sign" in value && typeof value.sign === "function" && "signDecorated" in value && typeof value.signDecorated === "function";
}
function signerAddress(value) {
  if (value == null || typeof value !== "object") return void 0;
  if ("signTransaction" in value && typeof value.address === "string") {
    return value.address;
  }
  return isKeypairLike(value) ? value.publicKey() : void 0;
}
function toSignTransaction(value, networkPassphrase) {
  if (value == null) return void 0;
  if (typeof value === "function") return value;
  if (typeof value !== "object") return void 0;
  if ("signTransaction" in value) {
    const fn = value.signTransaction;
    return typeof fn === "function" ? fn.bind(value) : void 0;
  }
  if (isKeypairLike(value)) {
    return new KeypairSigner(value, networkPassphrase).signTransaction;
  }
  return void 0;
}
function toSignAuthEntry(value, networkPassphrase) {
  if (value == null) return void 0;
  if (typeof value === "function") return value;
  if (typeof value !== "object") return void 0;
  if ("signTransaction" in value) {
    const fn = value.signAuthEntry;
    return typeof fn === "function" ? fn.bind(value) : void 0;
  }
  if (isKeypairLike(value)) {
    return new KeypairSigner(value, networkPassphrase).signAuthEntry;
  }
  return void 0;
}


//# sourceMappingURL=signer.js.map

// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/rpc/api.js
var api = __webpack_require__(2361);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/rpc/transaction.js
var transaction = __webpack_require__(9753);
;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/contract/errors.js
class ExpiredStateError extends Error {
}
class RestoreFailureError extends Error {
}
class NeedsMoreSignaturesError extends Error {
}
class NoSignatureNeededError extends Error {
}
class NoUnsignedNonInvokerAuthEntriesError extends Error {
}
class NoSignerError extends Error {
}
class NotYetSimulatedError extends Error {
}
class FakeAccountError extends Error {
}
class SimulationFailedError extends Error {
}
class InternalWalletError extends Error {
}
class ExternalServiceError extends Error {
}
class InvalidClientRequestError extends Error {
}
class UserRejectedError extends Error {
}
class SendFailedError extends Error {
}
class SendResultOnlyError extends Error {
}
class TransactionStillPendingError extends Error {
}


//# sourceMappingURL=errors.js.map

;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/contract/sent_transaction.js
















class SentTransaction {
  constructor(assembled) {
    this.assembled = assembled;
    const { server, allowHttp, headers, rpcUrl } = this.assembled.options;
    this.server = server ?? new rpc_server/* RpcServer */.vO(rpcUrl, { allowHttp, headers });
  }
  assembled;
  server;
  /**
   * The result of calling `sendTransaction` to broadcast the transaction to the
   * network.
   */
  sendTransactionResponse;
  /**
   * If `sendTransaction` completes successfully (which means it has `status: 'PENDING'`),
   * then `getTransaction` will be called in a loop for
   * {@link MethodOptions.timeoutInSeconds} seconds. This array contains all
   * the results of those calls.
   */
  getTransactionResponseAll;
  /**
   * The most recent result of calling `getTransaction`, from the
   * `getTransactionResponseAll` array.
   */
  getTransactionResponse;
  static Errors = {
    SendFailed: SendFailedError,
    SendResultOnly: SendResultOnlyError,
    TransactionStillPending: TransactionStillPendingError
  };
  /**
   * Initialize a `SentTransaction` from {@link AssembledTransaction}
   * `assembled`, passing an optional {@link Watcher} `watcher`. This will also
   * send the transaction to the network.
   */
  static init = async (assembled, watcher) => {
    const tx = new SentTransaction(assembled);
    const sent = await tx.send(watcher);
    return sent;
  };
  send = async (watcher) => {
    this.sendTransactionResponse = await this.server.sendTransaction(
      this.assembled.signed
    );
    if (this.sendTransactionResponse.status !== "PENDING") {
      throw new SentTransaction.Errors.SendFailed(
        `Sending the transaction to the network failed!
${JSON.stringify(
          this.sendTransactionResponse,
          null,
          2
        )}`
      );
    }
    if (watcher?.onSubmitted) watcher.onSubmitted(this.sendTransactionResponse);
    const { hash } = this.sendTransactionResponse;
    const timeoutInSeconds = this.assembled.options.timeoutInSeconds ?? DEFAULT_TIMEOUT;
    this.getTransactionResponseAll = await withExponentialBackoff(
      async () => {
        const tx = await this.server.getTransaction(hash);
        if (watcher?.onProgress) watcher.onProgress(tx);
        return tx;
      },
      (resp) => resp.status === api/* Api */.j.GetTransactionStatus.NOT_FOUND,
      timeoutInSeconds
    );
    this.getTransactionResponse = this.getTransactionResponseAll[this.getTransactionResponseAll.length - 1];
    if (this.getTransactionResponse.status === api/* Api */.j.GetTransactionStatus.NOT_FOUND) {
      throw new SentTransaction.Errors.TransactionStillPending(
        `Waited ${timeoutInSeconds} seconds for transaction to complete, but it did not. Returning anyway. Check the transaction status manually. Sent transaction: ${JSON.stringify(
          this.sendTransactionResponse,
          null,
          2
        )}
All attempts to get the result: ${JSON.stringify(
          this.getTransactionResponseAll,
          null,
          2
        )}`
      );
    }
    return this;
  };
  get result() {
    if ("getTransactionResponse" in this && this.getTransactionResponse) {
      if ("returnValue" in this.getTransactionResponse) {
        return this.assembled.options.parseResultXdr(
          this.getTransactionResponse.returnValue
        );
      }
      throw new Error("Transaction failed! Cannot parse result.");
    }
    if (this.sendTransactionResponse) {
      const errorResult = this.sendTransactionResponse.errorResult?.result;
      if (errorResult) {
        throw new SentTransaction.Errors.SendFailed(
          `Transaction simulation looked correct, but attempting to send the transaction failed. Check \`simulation\` and \`sendTransactionResponseAll\` to troubleshoot. Decoded \`sendTransactionResponse.errorResultXdr\`: ${errorResult}`
        );
      }
      throw new SentTransaction.Errors.SendResultOnly(
        `Transaction was sent to the network, but not yet awaited. No result to show. Await transaction completion with \`getTransaction(sendTransactionResponse.hash)\``
      );
    }
    throw new Error(
      `Sending transaction failed: ${JSON.stringify(this.assembled.signed)}`
    );
  }
}
class Watcher {
}


//# sourceMappingURL=sent_transaction.js.map

// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/soroban-transaction-data.js
var soroban_transaction_data = __webpack_require__(9434);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/transaction-envelope.js
var transaction_envelope = __webpack_require__(9675);
;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/contract/assembled_transaction.js































class AssembledTransaction {
  constructor(options) {
    this.options = options;
    this.options.simulate = this.options.simulate ?? true;
    const { server, allowHttp, headers, rpcUrl } = this.options;
    this.server = server ?? new rpc_server/* RpcServer */.vO(rpcUrl, { allowHttp, headers });
  }
  options;
  /**
   * The TransactionBuilder as constructed in
   * {@link AssembledTransaction}.build. Feel free set `simulate: false` to modify
   * this object before calling `tx.simulate()` manually. Example:
   *
   * ```ts
   * const tx = await myContract.myMethod(
   *   { args: 'for', my: 'method', ... },
   *   { simulate: false }
   * );
   * tx.raw.addMemo(Memo.text('Nice memo, friend!'))
   * await tx.simulate();
   * ```
   */
  raw;
  /**
   * Stores the original operation from `buildWithOp` for reuse during
   * automatic state restoration rebuilds.
   */
  originalOp;
  /**
   * The Transaction as it was built with `raw.build()` right before
   * simulation. Once this is set, modifying `raw` will have no effect unless
   * you call `tx.simulate()` again.
   */
  built;
  /**
   * The result of the transaction simulation. This is set after the first call
   * to `simulate`. It is difficult to serialize and deserialize, so it is not
   * included in the `toJson` and `fromJson` methods. See `simulationData`
   * cached, serializable access to the data needed by AssembledTransaction
   * logic.
   */
  simulation;
  /**
   * Cached simulation result. This is set after the first call to
   * {@link AssembledTransaction.simulationData}, and is used to facilitate
   * serialization and deserialization of the AssembledTransaction.
   *
   * Most of the time, if you need this data, you can call
   * `tx.simulation.result`.
   *
   * If you need access to this data after a transaction has been serialized
   * and then deserialized, you can call `simulationData.result`.
   */
  simulationResult;
  /**
   * Cached simulation transaction data. This is set after the first call to
   * {@link AssembledTransaction.simulationData}, and is used to facilitate
   * serialization and deserialization of the AssembledTransaction.
   *
   * Most of the time, if you need this data, you can call
   * `simulation.transactionData`.
   *
   * If you need access to this data after a transaction has been serialized
   * and then deserialized, you can call `simulationData.transactionData`.
   */
  simulationTransactionData;
  /**
   * The Soroban server to use for all RPC calls. This is constructed from the
   * `rpcUrl` in the options.
   */
  server;
  /**
   * The signed transaction.
   */
  signed;
  /**
   * A list of the most important errors that various AssembledTransaction
   * methods can throw. Feel free to catch specific errors in your application
   * logic.
   */
  static Errors = {
    ExpiredState: ExpiredStateError,
    RestorationFailure: RestoreFailureError,
    NeedsMoreSignatures: NeedsMoreSignaturesError,
    NoSignatureNeeded: NoSignatureNeededError,
    NoUnsignedNonInvokerAuthEntries: NoUnsignedNonInvokerAuthEntriesError,
    NoSigner: NoSignerError,
    NotYetSimulated: NotYetSimulatedError,
    FakeAccount: FakeAccountError,
    SimulationFailed: SimulationFailedError,
    InternalWalletError: InternalWalletError,
    ExternalServiceError: ExternalServiceError,
    InvalidClientRequest: InvalidClientRequestError,
    UserRejected: UserRejectedError
  };
  /**
   * Serialize the AssembledTransaction to a JSON string. This is useful for
   * saving the transaction to a database or sending it over the wire for
   * multi-auth workflows. `fromJson` can be used to deserialize the
   * transaction. This only works with transactions that have been simulated.
   */
  toJson() {
    return JSON.stringify({
      method: this.options.method,
      tx: this.built?.toXdr(),
      simulationResult: {
        auth: this.simulationData.result.auth.map((a) => a.toXdr("base64")),
        retval: this.simulationData.result.retval.toXdr("base64")
      },
      simulationTransactionData: this.simulationData.transactionData.toXdr("base64")
    });
  }
  /**
   * @deprecated Use {@link toJson} instead. Kept so existing callers and the
   * `JSON.stringify` protocol hook keep working.
   */
  toJSON() {
    return this.toJson();
  }
  /**
   * Validate that a built transaction is a single invokeContract operation
   * targeting the expected contract, and return the parsed InvokeContractArgs.
   */
  static validateInvokeContractOp(built, expectedContractId) {
    if (built.operations.length !== 1) {
      throw new Error(
        "Transaction envelope must contain exactly one operation."
      );
    }
    const operation = built.operations[0];
    if (operation.type !== "invokeHostFunction") {
      throw new Error(
        "Transaction envelope does not contain an invokeHostFunction operation."
      );
    }
    const invokeOp = operation;
    if (invokeOp.func.type !== "hostFunctionTypeInvokeContract") {
      throw new Error(
        "Transaction envelope does not contain an invokeContract host function."
      );
    }
    const invokeContractArgs = invokeOp.func.value;
    let contractAddress;
    let functionName;
    try {
      contractAddress = invokeContractArgs.contractAddress;
      functionName = invokeContractArgs.functionName.toString();
    } catch {
      throw new Error(
        "Could not extract contract address or method name from the transaction envelope."
      );
    }
    if (!contractAddress || !functionName) {
      throw new Error(
        "Could not extract contract address or method name from the transaction envelope."
      );
    }
    const xdrContractId = base_address/* Address */.p.fromScAddress(contractAddress).toString();
    if (xdrContractId !== expectedContractId) {
      throw new Error(
        `Transaction envelope targets contract ${xdrContractId}, but this Client is configured for ${expectedContractId}.`
      );
    }
    return invokeContractArgs;
  }
  static fromJson(options, {
    tx,
    simulationResult,
    simulationTransactionData
  }) {
    const txn = new AssembledTransaction(options);
    txn.built = transaction_builder/* TransactionBuilder */.Qc.fromXdr(tx, options.networkPassphrase);
    const invokeContractArgs = AssembledTransaction.validateInvokeContractOp(
      txn.built,
      options.contractId
    );
    const xdrMethod = invokeContractArgs.functionName.toString();
    if (xdrMethod !== options.method) {
      throw new Error(
        `Transaction envelope calls method '${xdrMethod}', but the provided method is '${options.method}'.`
      );
    }
    txn.simulationResult = {
      auth: simulationResult.auth.map(
        (a) => soroban_authorization_entry/* SorobanAuthorizationEntry */.Q.fromXdr(a, "base64")
      ),
      retval: sc_val/* ScVal */.wq.fromXdr(simulationResult.retval, "base64")
    };
    txn.simulationTransactionData = soroban_transaction_data/* SorobanTransactionData */.j.fromXdr(
      simulationTransactionData,
      "base64"
    );
    return txn;
  }
  /**
   * @deprecated Use {@link fromJson} instead.
   */
  static fromJSON(...args) {
    return AssembledTransaction.fromJson(...args);
  }
  /**
   * Serialize the AssembledTransaction to a base64-encoded XDR string.
   */
  toXdr() {
    if (!this.built)
      throw new Error(
        "Transaction has not yet been simulated; call `AssembledTransaction.simulate` first."
      );
    return this.built?.toEnvelope().toXdr("base64");
  }
  /**
   * Deserialize the AssembledTransaction from a base64-encoded XDR string.
   */
  static fromXdr(options, encodedXDR, spec) {
    const envelope = transaction_envelope/* TransactionEnvelope */.BB.fromXdr(encodedXDR, "base64");
    const built = transaction_builder/* TransactionBuilder */.Qc.fromXdr(
      envelope,
      options.networkPassphrase
    );
    const invokeContractArgs = AssembledTransaction.validateInvokeContractOp(
      built,
      options.contractId
    );
    const method = invokeContractArgs.functionName.toString();
    const txn = new AssembledTransaction({
      ...options,
      method,
      parseResultXdr: (result) => spec.funcResToNative(method, result)
    });
    txn.built = built;
    return txn;
  }
  /**
   * @deprecated Use {@link toXdr} instead.
   * Deprecated in version v17.0.0
   */
  toXDR() {
    return this.toXdr();
  }
  /**
   * @deprecated Use {@link AssembledTransaction.fromXdr} instead.
   * Deprecated in version v17.0.0
   */
  static fromXDR(...args) {
    return AssembledTransaction.fromXdr(...args);
  }
  handleWalletError(error) {
    if (!error) return;
    const { message, code } = error;
    const fullMessage = `${message}${error.ext ? ` (${error.ext.join(", ")})` : ""}`;
    switch (code) {
      case -1:
        throw new AssembledTransaction.Errors.InternalWalletError(fullMessage);
      case -2:
        throw new AssembledTransaction.Errors.ExternalServiceError(fullMessage);
      case -3:
        throw new AssembledTransaction.Errors.InvalidClientRequest(fullMessage);
      case -4:
        throw new AssembledTransaction.Errors.UserRejected(fullMessage);
      default:
        throw new Error(`Unhandled error: ${fullMessage}`);
    }
  }
  /**
   * Construct a new AssembledTransaction. This is the main way to create a new
   * AssembledTransaction; the constructor is private.
   *
   * This is an asynchronous constructor for two reasons:
   *
   * 1. It needs to fetch the account from the network to get the current
   *   sequence number.
   * 2. It needs to simulate the transaction to get the expected fee.
   *
   * If you don't want to simulate the transaction, you can set `simulate` to
   * `false` in the options.
   *
   * If you need to create an operation other than `invokeHostFunction`, you
   * can use {@link AssembledTransaction.buildWithOp} instead.
   *
   * @example
   * ```ts
   * const tx = await AssembledTransaction.build({
   *   ...,
   *   simulate: false,
   * })
   * ```
   */
  static build(options) {
    const contract = new base_contract/* Contract */.N(options.contractId);
    return AssembledTransaction.buildWithOp(
      contract.call(options.method, ...options.args ?? []),
      options
    );
  }
  /**
   * Construct a new AssembledTransaction, specifying an Operation other than
   * `invokeHostFunction` (the default used by {@link AssembledTransaction.build}).
   *
   * Note: `AssembledTransaction` currently assumes these operations can be
   * simulated. This is not true for classic operations; only for those used by
   * Soroban Smart Contracts like `invokeHostFunction` and `createCustomContract`.
   *
   * @example
   * ```ts
   * const tx = await AssembledTransaction.buildWithOp(
   *   Operation.createCustomContract({ ... });
   *   {
   *     ...,
   *     simulate: false,
   *   }
   * )
   * ```
   */
  static async buildWithOp(operation, options) {
    const tx = new AssembledTransaction(options);
    tx.originalOp = operation;
    const account = await getAccount(options, tx.server);
    tx.raw = new transaction_builder/* TransactionBuilder */.Qc(account, {
      fee: options.fee ?? transaction_builder/* BASE_FEE */.hJ,
      networkPassphrase: options.networkPassphrase
    }).setTimeout(options.timeoutInSeconds ?? DEFAULT_TIMEOUT).addOperation(operation);
    if (options.simulate) await tx.simulate();
    return tx;
  }
  static async buildFootprintRestoreTransaction(options, sorobanData, account, fee) {
    const tx = new AssembledTransaction(options);
    tx.raw = new transaction_builder/* TransactionBuilder */.Qc(account, {
      fee,
      networkPassphrase: options.networkPassphrase
    }).setSorobanData(
      sorobanData instanceof sorobandata_builder/* SorobanDataBuilder */.W ? sorobanData.build() : sorobanData
    ).addOperation(base_operation/* Operation */.I.restoreFootprint({})).setTimeout(options.timeoutInSeconds ?? DEFAULT_TIMEOUT);
    await tx.simulate({ restore: false });
    return tx;
  }
  simulate = async ({
    restore,
    useUpgradedAuth
  } = {}) => {
    if (!this.built) {
      if (!this.raw) {
        throw new Error(
          "Transaction has not yet been assembled; call `AssembledTransaction.build` first."
        );
      }
      this.built = this.raw.build();
    }
    restore = restore ?? this.options.restore;
    useUpgradedAuth = useUpgradedAuth ?? this.options.useUpgradedAuth;
    delete this.simulationResult;
    delete this.simulationTransactionData;
    this.simulation = await this.server.simulateTransaction(
      this.built,
      void 0,
      void 0,
      useUpgradedAuth
    );
    if (restore && api/* Api */.j.isSimulationRestore(this.simulation)) {
      const account = await getAccount(this.options, this.server);
      const result = await this.restoreFootprint(
        this.simulation.restorePreamble,
        account
      );
      if (result.status === api/* Api */.j.GetTransactionStatus.SUCCESS) {
        const op = this.originalOp ? this.originalOp : new base_contract/* Contract */.N(this.options.contractId).call(
          this.options.method,
          ...this.options.args ?? []
        );
        this.raw = new transaction_builder/* TransactionBuilder */.Qc(account, {
          fee: this.options.fee ?? transaction_builder/* BASE_FEE */.hJ,
          networkPassphrase: this.options.networkPassphrase
        }).addOperation(op).setTimeout(this.options.timeoutInSeconds ?? DEFAULT_TIMEOUT);
        delete this.built;
        await this.simulate({ useUpgradedAuth });
        return this;
      }
      throw new AssembledTransaction.Errors.RestorationFailure(
        `Automatic restore failed! You set 'restore: true' but the attempted restore did not work. Result:
${JSON.stringify(result)}`
      );
    }
    if (api/* Api */.j.isSimulationSuccess(this.simulation)) {
      this.built = (0,transaction/* assembleTransaction */.X)(this.built, this.simulation).build();
    }
    return this;
  };
  get simulationData() {
    if (this.simulationResult && this.simulationTransactionData) {
      return {
        result: this.simulationResult,
        transactionData: this.simulationTransactionData
      };
    }
    const simulation = this.simulation;
    if (!simulation) {
      throw new AssembledTransaction.Errors.NotYetSimulated(
        "Transaction has not yet been simulated"
      );
    }
    if (api/* Api */.j.isSimulationError(simulation)) {
      throw new AssembledTransaction.Errors.SimulationFailed(
        `Transaction simulation failed: "${simulation.error}"`
      );
    }
    if (api/* Api */.j.isSimulationRestore(simulation)) {
      throw new AssembledTransaction.Errors.ExpiredState(
        `You need to restore some contract state before you can invoke this method.
You can set \`restore\` to true in the method options in order to automatically restore the contract state when needed.`
      );
    }
    this.simulationResult = simulation.result ?? {
      auth: [],
      retval: sc_val/* ScVal */.wq.scvVoid()
    };
    this.simulationTransactionData = simulation.transactionData.build();
    return {
      result: this.simulationResult,
      transactionData: this.simulationTransactionData
    };
  }
  get result() {
    try {
      if (!this.simulationData.result) {
        throw new Error("No simulation result!");
      }
      return this.options.parseResultXdr(this.simulationData.result.retval);
    } catch (e) {
      if (!implementsToString(e)) throw e;
      const err = this.parseError(e.toString());
      if (err) return err;
      throw e;
    }
  }
  parseError(errorMessage) {
    if (!this.options.errorTypes) return void 0;
    const match = errorMessage.match(contractErrorPattern);
    if (!match) return void 0;
    const i = parseInt(match[1], 10);
    const err = this.options.errorTypes[i];
    if (!err) return void 0;
    return new Err(err);
  }
  /**
   * Sign the transaction with the signTransaction function included previously.
   * If you did not previously include one, you need to include one now.
   */
  sign = async ({
    force = false,
    signTransaction = this.options.signTransaction
  } = {}) => {
    if (!this.built) {
      throw new Error("Transaction has not yet been simulated");
    }
    if (!force && this.isReadCall) {
      throw new AssembledTransaction.Errors.NoSignatureNeeded(
        "This is a read call. It requires no signature or sending. Use `force: true` to sign and send anyway."
      );
    }
    const signTx = toSignTransaction(
      signTransaction,
      this.options.networkPassphrase
    );
    if (!signTx) {
      throw new AssembledTransaction.Errors.NoSigner(
        "You must provide a signTransaction function, either when calling `signAndSend` or when initializing your Client"
      );
    }
    if (!this.options.publicKey) {
      throw new AssembledTransaction.Errors.FakeAccount(
        "This transaction was constructed using a default account. Provide a valid publicKey in the AssembledTransactionOptions."
      );
    }
    const sigsNeeded = this.needsNonInvokerSigningBy().filter(
      (id) => !id.startsWith("C")
    );
    if (sigsNeeded.length) {
      throw new AssembledTransaction.Errors.NeedsMoreSignatures(
        `Transaction requires signatures from ${sigsNeeded}. See \`needsNonInvokerSigningBy\` for details.`
      );
    }
    const timeoutInSeconds = this.options.timeoutInSeconds ?? DEFAULT_TIMEOUT;
    this.built = transaction_builder/* TransactionBuilder */.Qc.cloneFrom(this.built, {
      fee: this.built.fee,
      timebounds: void 0,
      sorobanData: this.simulationData.transactionData
    }).setTimeout(timeoutInSeconds).build();
    const signOpts = {
      networkPassphrase: this.options.networkPassphrase
    };
    if (this.options.address) signOpts.address = this.options.address;
    if (this.options.submit !== void 0)
      signOpts.submit = this.options.submit;
    if (this.options.submitUrl) signOpts.submitUrl = this.options.submitUrl;
    const { signedTxXdr: signature, error } = await signTx(
      this.built.toXdr(),
      signOpts
    );
    this.handleWalletError(error);
    this.signed = transaction_builder/* TransactionBuilder */.Qc.fromXdr(
      signature,
      this.options.networkPassphrase
    );
  };
  /**
   * Sends the transaction to the network to return a `SentTransaction` that
   * keeps track of all the attempts to fetch the transaction. Optionally pass
   * a {@link Watcher} that allows you to keep track of the progress as the
   * transaction is sent and processed.
   */
  async send(watcher) {
    if (!this.signed) {
      throw new Error(
        "The transaction has not yet been signed. Run `sign` first, or use `signAndSend` instead."
      );
    }
    const sent = await SentTransaction.init(this, watcher);
    return sent;
  }
  /**
   * Sign the transaction with the `signTransaction` function included previously.
   * If you did not previously include one, you need to include one now.
   * After signing, this method will send the transaction to the network and
   * return a `SentTransaction` that keeps track of all the attempts to fetch
   * the transaction. You may pass a {@link Watcher} to keep
   * track of this progress.
   */
  signAndSend = async ({
    force = false,
    signTransaction = this.options.signTransaction,
    watcher
  } = {}) => {
    if (!this.signed) {
      const signer = toSignTransaction(
        signTransaction || this.options.signTransaction,
        this.options.networkPassphrase
      );
      const wrappedSignTransaction = this.options.submit && signer ? (tx, opts) => signer(tx, { ...opts, submit: false }) : signTransaction;
      await this.sign({ force, signTransaction: wrappedSignTransaction });
    }
    return this.send(watcher);
  };
  /**
   * Get a list of accounts, other than the invoker of the simulation, that
   * need to sign auth entries in this transaction.
   *
   * Soroban allows multiple people to sign a transaction. Someone needs to
   * sign the final transaction envelope; this person/account is called the
   * _invoker_, or _source_. Other accounts might need to sign individual auth
   * entries in the transaction, if they're not also the invoker.
   *
   * This function returns a list of accounts that need to sign auth entries,
   * assuming that the same invoker/source account will sign the final
   * transaction envelope as signed the initial simulation.
   *
   * One at a time, for each public key in this array, you will need to
   * serialize this transaction with `toJson`, send to the owner of that key,
   * deserialize the transaction with `txFromJson`, and call
   * {@link AssembledTransaction.signAuthEntries}. Then re-serialize and send to
   * the next account in this list.
   */
  needsNonInvokerSigningBy = ({
    includeAlreadySigned = false
  } = {}) => {
    if (!this.built) {
      throw new Error("Transaction has not yet been simulated");
    }
    if (!("operations" in this.built)) {
      throw new Error(
        `Unexpected Transaction type; no operations: ${JSON.stringify(
          this.built
        )}`
      );
    }
    const rawInvokeHostFunctionOp = this.built.operations[0];
    return [
      ...new Set(
        (rawInvokeHostFunctionOp.auth ?? []).map((entry) => inspectAuthEntry(entry)).filter(
          (info) => (
            // skip source-account credentials (no address payload), which
            // are covered by the envelope signature on the source account.
            // Only the top-level credentials (signers[0]) matter here — this
            // method reports (and signAuthEntries signs) the top-level
            // address, so unsigned delegate nodes must not keep it listed.
            info.address !== null && (includeAlreadySigned || !info.signers[0].signed)
          )
        ).map((info) => info.address)
      )
    ];
  };
  /**
   * If {@link AssembledTransaction#needsNonInvokerSigningBy} returns a
   * non-empty list, you can serialize the transaction with `toJson`, send it to
   * the owner of one of the public keys in the map, deserialize with
   * `txFromJson`, and call this method on their machine. Internally, this will
   * use `signAuthEntry` function from connected `wallet` for each.
   *
   * Then, re-serialize the transaction and either send to the next
   * `needsNonInvokerSigningBy` owner, or send it back to the original account
   * who simulated the transaction so they can {@link AssembledTransaction.sign}
   * the transaction envelope and {@link AssembledTransaction.send} it to the
   * network.
   *
   * Sending to all `needsNonInvokerSigningBy` owners in parallel is not
   * currently supported!
   */
  signAuthEntries = async ({
    expiration = (async () => (await this.server.getLatestLedger()).sequence + 100)(),
    signAuthEntry = this.options.signAuthEntry,
    address = signerAddress(signAuthEntry) ?? this.options.publicKey,
    authorizeEntry: authorizeEntry$1 = authorizeEntry
  } = {}) => {
    if (!this.built)
      throw new Error("Transaction has not yet been assembled or simulated");
    const signAuth = toSignAuthEntry(
      signAuthEntry,
      this.options.networkPassphrase
    );
    if (authorizeEntry$1 === authorizeEntry) {
      const needsNonInvokerSigningBy = this.needsNonInvokerSigningBy();
      if (needsNonInvokerSigningBy.length === 0) {
        throw new AssembledTransaction.Errors.NoUnsignedNonInvokerAuthEntries(
          "No unsigned non-invoker auth entries; maybe you already signed?"
        );
      }
      if (needsNonInvokerSigningBy.indexOf(address ?? "") === -1) {
        throw new AssembledTransaction.Errors.NoSignatureNeeded(
          `No auth entries for public key "${address}"`
        );
      }
      if (!signAuth) {
        throw new AssembledTransaction.Errors.NoSigner(
          "You must provide `signAuthEntry` or a custom `authorizeEntry`"
        );
      }
    }
    const rawInvokeHostFunctionOp = this.built.operations[0];
    const authEntries = rawInvokeHostFunctionOp.auth ?? [];
    for (const [i, entry] of authEntries.entries()) {
      const credentials = soroban_credentials/* SorobanCredentials */.j5.fromXdr(entry.credentials.toXdr());
      const addrAuth = getAddressCredentials(credentials);
      if (addrAuth === null) {
        continue;
      }
      const authEntryAddress = base_address/* Address */.p.fromScAddress(
        addrAuth.address
      ).toString();
      if (authEntryAddress !== address) continue;
      const sign = signAuth ?? Promise.resolve;
      authEntries[i] = await authorizeEntry$1(
        entry,
        async (preimage) => {
          const { signedAuthEntry, error } = await sign(
            preimage.toXdr("base64"),
            {
              address
            }
          );
          this.handleWalletError(error);
          return (0,base64/* base64ToUint8Array */.E)(signedAuthEntry);
        },
        await expiration,
        this.options.networkPassphrase
      );
    }
  };
  /**
   * Whether this transaction is a read call. This is determined by the
   * simulation result and the transaction data. If the transaction is a read
   * call, it will not need to be signed and sent to the network. If this
   * returns `false`, then you need to call `signAndSend` on this transaction.
   */
  get isReadCall() {
    const authsCount = this.simulationData.result.auth.length;
    const writeLength = this.simulationData.transactionData.resources.footprint.readWrite.length;
    return authsCount === 0 && writeLength === 0;
  }
  /**
   * Restores the footprint (resource ledger entries that can be read or written)
   * of an expired transaction.
   *
   * The method will:
   * 1. Build a new transaction aimed at restoring the necessary resources.
   * 2. Sign this new transaction if a `signTransaction` handler is provided.
   * 3. Send the signed transaction to the network.
   * 4. Await and return the response from the network.
   *
   * Preconditions:
   * - A `signTransaction` function must be provided during the Client initialization.
   * - The provided `restorePreamble` should include a minimum resource fee and valid
   *   transaction data.
   *
   * @throws - Throws an error if no `signTransaction` function is provided during
   * Client initialization.
   * @throws - Throws a custom error if the
   * restore transaction fails, providing the details of the failure.
   */
  async restoreFootprint(restorePreamble, account) {
    if (!this.options.signTransaction) {
      throw new Error(
        "For automatic restore to work you must provide a signTransaction function when initializing your Client"
      );
    }
    account = account ?? await getAccount(this.options, this.server);
    const restoreTx = await AssembledTransaction.buildFootprintRestoreTransaction(
      { ...this.options },
      restorePreamble.transactionData,
      account,
      restorePreamble.minResourceFee
    );
    const sentTransaction = await restoreTx.signAndSend();
    if (!sentTransaction.getTransactionResponse) {
      throw new AssembledTransaction.Errors.RestorationFailure(
        `The attempt at automatic restore failed. 
${JSON.stringify(sentTransaction)}`
      );
    }
    return sentTransaction.getTransactionResponse;
  }
}


//# sourceMappingURL=assembled_transaction.js.map

// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/bindings/utils.js
var utils = __webpack_require__(4725);
// EXTERNAL MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/xdr/generated/contract-executable-external-ref.js
var contract_executable_external_ref = __webpack_require__(6627);
;// CONCATENATED MODULE: ./node_modules/@stellar/stellar-sdk/lib/esm/contract/client.js



















const CONSTRUCTOR_FUNC = "__constructor";
class Client {
  constructor(spec, options) {
    this.spec = spec;
    this.options = options;
    if (options.server === void 0) {
      const { allowHttp, headers } = options;
      options.server = new rpc_server/* RpcServer */.vO(options.rpcUrl, {
        allowHttp,
        headers
      });
    }
    this.spec.funcs().forEach((xdrFn) => {
      const method = xdrFn.name.toString();
      if (method === CONSTRUCTOR_FUNC) {
        return;
      }
      const assembleTransaction = (args, methodOptions) => AssembledTransaction.build({
        method,
        args: args && spec.funcArgsToScVals(method, args),
        ...options,
        ...methodOptions,
        errorTypes: spec.errorCases().reduce(
          (acc, curr) => ({
            ...acc,
            [curr.value]: { message: curr.doc.toString() }
          }),
          {}
        ),
        parseResultXdr: (result) => spec.funcResToNative(method, result)
      });
      this[(0,utils.sanitizeIdentifier)(method)] = spec.getFunc(method).inputs.length === 0 ? (opts) => assembleTransaction(void 0, opts) : assembleTransaction;
    });
  }
  spec;
  options;
  static async deploy(args, options) {
    const {
      wasmHash,
      externalRef,
      salt,
      format,
      fee,
      timeoutInSeconds,
      simulate,
      ...clientOptions
    } = options;
    if (!clientOptions.rpcUrl) {
      throw new TypeError("options must contain rpcUrl");
    }
    const { rpcUrl, allowHttp, headers } = clientOptions;
    const server = clientOptions.server ?? new rpc_server/* RpcServer */.vO(rpcUrl, { allowHttp, headers });
    let executableOpts;
    let specWasmHash;
    if (externalRef !== void 0) {
      const ref = externalRef instanceof contract_executable_external_ref/* ContractExecutableExternalRef */.H ? externalRef : new contract_executable_external_ref/* ContractExecutableExternalRef */.H({
        executableOwner: (externalRef.owner instanceof base_address/* Address */.p ? externalRef.owner : new base_address/* Address */.p(externalRef.owner)).toScAddress(),
        tag: externalRef.tag
      });
      specWasmHash = await server.getExternalRefWasmHash(ref);
      executableOpts = { externalRef: ref };
    } else {
      specWasmHash = typeof wasmHash === "string" ? (format ?? "hex") === "base64" ? (0,base64/* base64ToUint8Array */.E)(wasmHash) : (0,uint8array_extras/* hexToUint8Array */.AS)(wasmHash) : wasmHash;
      executableOpts = { wasmHash: specWasmHash };
    }
    const spec = Spec.fromWasm(
      await server.getContractWasmByHash(specWasmHash)
    );
    const operation = base_operation/* Operation */.I.createCustomContract({
      address: new base_address/* Address */.p(options.address || options.publicKey),
      ...executableOpts,
      salt,
      constructorArgs: args ? spec.funcArgsToScVals(CONSTRUCTOR_FUNC, args) : []
    });
    return AssembledTransaction.buildWithOp(operation, {
      fee,
      timeoutInSeconds,
      simulate,
      ...clientOptions,
      contractId: "ignored",
      method: CONSTRUCTOR_FUNC,
      parseResultXdr: (result) => new Client(spec, {
        ...clientOptions,
        contractId: base_address/* Address */.p.fromScVal(result).toString()
      })
    });
  }
  /**
   * Generates a Client instance from the provided ClientOptions and the contract's wasm hash.
   * The wasmHash can be provided in either hex or base64 format.
   *
   * @typeParam T - An interface describing the contract's methods, used to type
   * the returned client. Defaults to `unknown`, so calling without a type
   * argument yields a plain `Client` (backward compatible). Provide it to get
   * typed, autocompleted contract methods without code generation.
   *
   * @param wasmHash - The hash of the contract's wasm binary, in either hex or base64 format.
   * @param options - The ClientOptions object containing the necessary configuration, including the rpcUrl.
   * @param format - (optional) The format of the provided wasmHash, either "hex" or "base64". Defaults to "hex".
   * @returns A Promise that resolves to a Client instance.
   * @throws If the provided options object does not contain an rpcUrl.
   *
   * @example
   * ```ts
   * interface MyContract {
   *   increment: (opts?: MethodOptions) => Promise<AssembledTransaction<number>>;
   * }
   * const client = await contract.Client.fromWasmHash<MyContract>(hash, options);
   * const tx = await client.increment(); // typed
   * ```
   */
  static async fromWasmHash(wasmHash, options, format = "hex") {
    if (!options || !options.rpcUrl) {
      throw new TypeError("options must contain rpcUrl");
    }
    const { rpcUrl, allowHttp, headers } = options;
    const server = options.server ?? new rpc_server/* RpcServer */.vO(rpcUrl, {
      allowHttp,
      headers
    });
    const wasm = await server.getContractWasmByHash(wasmHash, format);
    return Client.fromWasm(wasm, options);
  }
  /**
   * Generates a Client instance from the provided ClientOptions and the contract's wasm binary.
   *
   * @typeParam T - An interface describing the contract's methods, used to type
   * the returned client. Defaults to `unknown`, so calling without a type
   * argument yields a plain `Client` (backward compatible). Provide it to get
   * typed, autocompleted contract methods without code generation.
   *
   * @param wasm - The contract's wasm binary as a Uint8Array.
   * @param options - The ClientOptions object containing the necessary configuration.
   * @returns A Promise that resolves to a Client instance.
   * @throws If the contract spec cannot be obtained from the provided wasm binary.
   *
   * @example
   * ```ts
   * interface MyContract {
   *   increment: (opts?: MethodOptions) => Promise<AssembledTransaction<number>>;
   * }
   * const client = await contract.Client.fromWasm<MyContract>(wasm, options);
   * const tx = await client.increment(); // typed
   * ```
   */
  static async fromWasm(wasm, options) {
    const spec = await Spec.fromWasm(wasm);
    return new Client(spec, options);
  }
  /**
   * Generates a Client instance from the provided ClientOptions, which must include the contractId and rpcUrl.
   *
   * If the contract is a built-in Stellar Asset Contract (SAC), the embedded
   * SAC spec is used instead of downloading Wasm, since a SAC has no Wasm
   * executable on-chain.
   *
   * If the contract was created from a CAP-85 external executable reference,
   * the reference is resolved to a Wasm hash first (see
   * {@link rpc.Server.getExternalRefWasmHash}), then the spec is read from
   * that Wasm.
   *
   * @typeParam T - An interface describing the contract's methods, used to type
   * the returned client. Defaults to `unknown`, so calling without a type
   * argument yields a plain `Client` (backward compatible). Provide it to get
   * typed, autocompleted contract methods without code generation.
   *
   * @param options - The ClientOptions object containing the necessary configuration, including the contractId and rpcUrl.
   * @returns A Promise that resolves to a Client instance.
   * @throws If the provided options object does not contain both rpcUrl and contractId.
   *
   * @example
   * ```ts
   * interface MyContract {
   *   increment: (opts?: MethodOptions) => Promise<AssembledTransaction<number>>;
   * }
   * const client = await contract.Client.from<MyContract>(options);
   * const tx = await client.increment(); // typed
   * ```
   */
  static async from(options) {
    if (!options || !options.rpcUrl || !options.contractId) {
      throw new TypeError("options must contain rpcUrl and contractId");
    }
    const { rpcUrl, contractId, allowHttp, headers } = options;
    const server = options.server ?? new rpc_server/* RpcServer */.vO(rpcUrl, {
      allowHttp,
      headers
    });
    const instance = await server.getContractInstance(contractId);
    const executable = instance.executable;
    if (executable.type === "contractExecutableStellarAsset") {
      const { SAC_SPEC } = await __webpack_require__.e(/* import() */ 561).then(__webpack_require__.bind(__webpack_require__, 9561));
      return new Client(new Spec(SAC_SPEC), options);
    }
    const wasmHash = executable.type === "contractExecutableExternalRef" ? await server.getExternalRefWasmHash(executable.externalRef) : executable.wasmHash.value;
    const wasm = await server.getContractWasmByHash(wasmHash);
    return Client.fromWasm(wasm, options);
  }
  txFromJson = (json) => {
    const { method, ...tx } = JSON.parse(json);
    return AssembledTransaction.fromJson(
      {
        ...this.options,
        method,
        parseResultXdr: (result) => this.spec.funcResToNative(method, result)
      },
      tx
    );
  };
  /**
   * @deprecated Use {@link txFromJson} instead.
   */
  txFromJSON = this.txFromJson;
  txFromXDR = (xdrBase64) => AssembledTransaction.fromXdr(this.options, xdrBase64, this.spec);
}


//# sourceMappingURL=client.js.map


/***/ })

};
